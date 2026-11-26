"use client";
// Melon Merge Fiesta — drop cute fruits into a festival crate; two equal fruits that touch merge into the next fruit
// (cherry → strawberry → grape → lemon → orange → apple → pear → peach → pineapple → melon → watermelon), and the merges
// chain as the crate settles. Every stage has a goal — grow a target fruit, crack every walnut, or reach a score —
// within a number of drops and without overflowing the crate. Stages never end and arrive one by one: 500 designed
// stages across eight fruit markets (each with its own look and music, closed by a finale — some ask for the
// watermelon), then endless remixes. Boosters: Hammer, Bomb, Shake and Undo. Phone-app flow.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bomb, ChevronRight, Hammer, Nut, Play, Plus, RotateCcw, Sparkles, Star, Store, Target, Trophy, Undo2, Vibrate, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import type { Sim } from "../physics";
import { DESIGNED, ROOMS, STAGES_PER_ROOM, bestDrop, goalDone, passOf, roomOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { newGame, starsOf, take, type Game } from "../play";
import { useMelon, useMelonHydrated } from "../save";
import { MelonBoard, fruitOf, type BoardSound } from "./Board";
import { MELON_CSS } from "./styles";

export const MELON_SFX = ["aim", "drop", "tap", "merge", "combo", "crack", "smash", "thaw", "hammer", "bomb", "shake", "undo", "clear", "star", "room", "lose", "open"] as const;
type Sfx = (typeof MELON_SFX)[number];
const sfxName = (k: Sfx) => `a:melon_${k}` as Sound;
const music = (k: string) => `a:melon_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  nuts: ["Walnuts", "Walnuts never merge. A merge right next to one cracks it — the second crack breaks it. Crack them all!"],
  score: ["Score goal", "Reach the target score. Bigger fruits and chain reactions score much more."],
  ice: ["Jelly fruit", "A fruit wrapped in jelly can't merge until a merge happens right next to it and pops the jelly."],
  boss: ["Market finale", "The last stage of every market is its finale: a bigger fruit to grow and a bigger reward."],
  melon: ["The watermelon!", "This finale starts with a melon, a pineapple, a peach and a pear. Grow one more pear next to the pear and chain them all the way up to the watermelon!"],
  jar: ["A new crate", "Crates change shape as you go — V-bottoms, bowls, ramps, bumpers, dividers and steps. Watch how the fruit rolls!"],
  remix: ["Endless fiesta", "You've finished all 500 designed stages! From here every stage is a fresh remix — new crates and goals, forever."],
};
const EMOJI = ["", "🍒", "🍓", "🍇", "🍋", "🍊", "🍎", "🍐", "🍑", "🍍", "🍈", "🍉", "🍉"];
const emojiOf = (v: number) => EMOJI[Math.max(1, Math.min(12, Math.round(Math.log2(Math.max(2, v)))))];
const goalText = (d: StageDef | null) => !d ? "" : d.goal.kind === "fruit" ? `Grow a ${fruitOf(d.goal.target).name}` : d.goal.kind === "nuts" ? "Crack every walnut" : `Score ${d.goal.target.toLocaleString()}`;

interface Result { stage: number; stars: number; coins: number; score: number; roomDone: boolean; gift: string; left: number }
interface Float { id: number; x: number; y: number; text: string; big: boolean }
interface Live { score: number; best: number; rocks: number }

export default function MelonApp({ slug }: { slug: string; title: string }) {
  const ready = useMelonHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useMelon((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [live, setLive] = useState<Live>({ score: 0, best: 0, rocks: 0 });
  const [revived, setRevived] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "out" | "full" | "help" | "tip">("");
  const [armed, setArmed] = useState<"" | "hammer" | "bomb">("");
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [toast, setToast] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const boardRef = useRef<MelonBoard | null>(null);
  const hist = useRef<Game[]>([]);
  const armedRef = useRef<"" | "hammer" | "bomb">("");
  useEffect(() => { armedRef.current = armed; }, [armed]);
  const helped = useRef(false);
  const doneRef = useRef(false);
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  const applyPending = useCallback(() => { const b = boardRef.current, p = pendingRef.current; if (!b || !p) return; pendingRef.current = null; b.setStage(p.d, roomOf(p.d.stage), p.g); }, []);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null);
  const stateRef = useRef({ revived: false, result: false, sheet: "", paused: false });
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { revived, result: !!result, sheet, paused }; }, [revived, result, sheet, paused]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2000); return () => clearTimeout(t); }, [toast]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Picking the fruit");
    void audio.preload(MELON_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(roomOf(useMelon.getState().stage).music)]);
    prepareStage(useMelon.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.16, duck: k === "clear" || k === "room" });
  }, []);
  const addFloat = useCallback((x: number, y: number, text: string, big = false) => {
    const id = Math.random();
    setFloats((f) => [...f.slice(-6), { id, x, y, text, big }]);
    setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 1100);
  }, []);
  /** the game as it is right now (the jar comes from the live physics) */
  const current = useCallback((): Game | null => {
    const g = gameRef.current, b = boardRef.current;
    if (!g) return null;
    return b?.sim ? { ...g, balls: b.snapshot(), score: b.sim.score, best: Math.max(g.best, b.sim.maxValue()) } : g;
  }, []);
  const persist = useCallback(() => {
    const d = defRef.current, g = current(); if (!d || !g || doneRef.current) return;
    useMelon.getState().saveCurrent({ stage: d.stage, game: g, revived: stateRef.current.revived });
  }, [current]);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback(() => {
    const d = defRef.current!, g = current()!;
    const stars = starsOf(g.dropsLeft, d.drops, helped.current);
    const total = g.score + g.dropsLeft * 40 + (d.boss ? 500 : 0);
    const coins = 5 + Math.round(Math.log2(Math.max(2, g.best))) + stars * 3 + (d.boss ? 20 : 0);
    useProfile.getState().earnCoins(coins);
    useMelon.getState().win(d.stage, stars, total);
    useMelon.getState().saveCurrent(null);
    let gift = "";
    if (d.boss) { useMelon.getState().giveBooster("hammer", 2); useMelon.getState().giveBooster("bomb", 1); useMelon.getState().giveBooster("shake", 1); useMelon.getState().giveBooster("undo", 1); gift = "+2 Hammers · +1 Bomb · +1 Shake · +1 Undo"; }
    else if (d.stage % 10 === 0) { useMelon.getState().giveBooster(d.stage % 20 === 0 ? "bomb" : "hammer", 1); gift = d.stage % 20 === 0 ? "+1 Bomb" : "+1 Hammer"; }
    const roomDone = d.stage % STAGES_PER_ROOM === 0;
    setResult({ stage: d.stage, stars, coins, score: total, roomDone, gift, left: g.dropsLeft });
    sfx(roomDone ? "room" : "clear", { gain: 0.8 });
    boardRef.current?.celebrate();
    for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    track("melon_clear", { stage: d.stage, stars });
  }, [sfx, current]);

  // ---------------------------------------------------------------- board hooks
  const onChanged = useCallback((s: Sim) => {
    setLive({ score: s.score, best: s.maxValue(), rocks: s.rocks() });
    const d = defRef.current;
    if (!d || doneRef.current) return;
    if (goalDone(d.goal, s)) { doneRef.current = true; setTimeout(() => finishStage(), 650); }
  }, [finishStage]);
  const onSettled = useCallback(() => {
    const g = gameRef.current;
    if (!g || doneRef.current) return;
    persist();
    if (g.dropsLeft <= 0 && !stateRef.current.sheet) { setSheet("out"); sfx("lose", { gain: 0.55 }); }
  }, [persist, sfx]);
  const takeRef = useRef<(x: number) => number | null>(() => null);
  const doTake = () => {
    const g0 = gameRef.current, st = stateRef.current, b = boardRef.current;
    if (!g0 || !b?.sim || st.result || st.sheet || st.paused || doneRef.current || g0.dropsLeft <= 0) return null;
    const snap = current();
    if (snap) hist.current = [...hist.current, snap].slice(-20);
    const v = g0.cur;
    const g = take(g0, b.sim.maxValue());
    setGame(g); gameRef.current = g;
    b.setShot(g.cur, g.nxt);
    buzz(8);
    return v;
  };
  useEffect(() => { takeRef.current = doTake; });

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const board = new MelonBoard(host.current, {
      canPlay: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused; },
      take: (x) => takeRef.current(x),
      changed: (s) => onChanged(s),
      settled: () => onSettled(),
      overflow: () => { if (doneRef.current) return; setSheet("full"); sfx("lose", { gain: 0.55 }); buzz(60); },
      hammerArmed: () => armedRef.current === "hammer",
      hammered: () => { useMelon.getState().useBooster("hammer"); helped.current = true; setArmed(""); },
      bombArmed: () => armedRef.current === "bomb",
      bombed: () => { useMelon.getState().useBooster("bomb"); helped.current = true; setArmed(""); buzz(40); },
      sound: (e: BoardSound, pan: number, n = 0) => {
        if (e === "merge") { sfx("merge", { x: pan, gain: 0.6, rate: Math.min(1.9, 0.92 + (n - 1) * 0.12) }); if (n >= 3) sfx("combo", { x: pan, gain: 0.4, rate: Math.min(1.5, 0.9 + n * 0.06) }); }
        else if (e === "aim") sfx("aim", { x: pan, gain: 0.14 });
        else if (e === "tap") sfx("tap", { x: pan, gain: 0.1 + n * 0.35, rate: 0.9 + Math.random() * 0.25 });
        else if (e === "smash") { sfx("smash", { x: pan, gain: 0.6 }); buzz(30); }
        else if (e === "bomb") sfx("bomb", { x: pan, gain: 0.75 });
        else sfx(e as Sfx, { x: pan, gain: 0.5 });
      },
      float: (x, y, text, big) => addFloat(x, y, text, big),
    });
    boardRef.current = board;
    applyPending();
    return () => { board.dispose(); boardRef.current = null; };
  }, [screen, sfx, addFloat, applyPending, onChanged, onSettled]);

  // ---------------------------------------------------------------- stages
  const start = useCallback(async (stage: number, resume?: { game: Game; revived: boolean }) => {
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const g = resume?.game ?? newGame(d);
    setDef(d); setGame(g); setResult(null); setSheet("");
    setRevived(resume?.revived ?? false); setArmed("");
    setLive({ score: g.score, best: g.balls.reduce((m, b) => Math.max(m, b.v), 0), rocks: g.balls.filter((b) => b.v < 0).length });
    hist.current = []; helped.current = !!resume?.revived; doneRef.current = false;
    setScreen("game");
    const rm = roomOf(stage);
    void audio.playMusic(music(rm.music));
    audio.warmMusic([music(roomOf(stage + STAGES_PER_ROOM).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = useMelon.getState().tips;
    const melonGoal = d.goal.kind === "fruit" && d.goal.target >= 2048;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, nuts: d.goal.kind === "nuts", score: d.goal.kind === "score", ice: d.balls.some((b) => b.ice), melon: melonGoal, boss: d.boss && !melonGoal, jar: d.jar.kind !== "classic" };
    const tip = melonGoal ? "melon" : ["remix", "nuts", "score", "ice", "boss", "jar"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useMelon.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); } else setToast(goalText(d));
    track("melon_start", { stage });
  }, [sfx, applyPending]);

  // ---------------------------------------------------------------- boosters
  const doShake = () => {
    const b = boardRef.current; if (!b?.sim || result) return;
    if (!useMelon.getState().useBooster("shake")) { setToast("No shakes left"); return; }
    helped.current = true; b.shakeAll(); buzz(50);
  };
  const arm = (k: "hammer" | "bomb") => {
    if (armed !== k && boosters[k] <= 0) { setToast(k === "bomb" ? "No bombs left" : "No hammers left"); return; }
    setArmed((a) => (a === k ? "" : k));
  };
  const doUndo = () => {
    const prev = hist.current[hist.current.length - 1];
    if (!prev || result) { setToast("Nothing to undo"); return; }
    if (!useMelon.getState().useBooster("undo")) { setToast("No undos left"); return; }
    hist.current = hist.current.slice(0, -1); helped.current = true;
    setGame(prev); gameRef.current = prev; boardRef.current?.load(prev); setSheet("");
    setLive({ score: prev.score, best: prev.balls.reduce((m, b) => Math.max(m, b.v), 0), rocks: prev.balls.filter((b) => b.v < 0).length });
    sfx("undo", { gain: 0.5 });
    setTimeout(persist, 50);
  };
  const doMore = () => { const g0 = gameRef.current; if (!g0) return; const g = { ...g0, dropsLeft: g0.dropsLeft + 5 }; setRevived(true); helped.current = true; setGame(g); gameRef.current = g; setSheet(""); sfx("star", { gain: 0.5 }); setTimeout(persist, 50); };
  const doRestart = () => { const d = defRef.current; if (!d) return; useMelon.getState().saveCurrent(null); void start(d.stage); };
  const doResume = () => { boardRef.current?.resume(); setSheet(""); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __melon?: unknown }).__melon = {
      game: () => current(), def: () => defRef.current, start: (stage: number) => void start(stage),
      drop: (x: number) => boardRef.current?.dropNow(x),
      best: () => { const g = gameRef.current, d = defRef.current, s = boardRef.current?.sim; return g && d && s ? bestDrop(s, g.cur, d.goal) : NaN; },
      busy: () => !!boardRef.current?.busy,
      board: () => boardRef.current,
      screen: (x: number, y: number) => { const b = boardRef.current, r = host.current?.getBoundingClientRect(); if (!b || !r) return null; const p = b.toScreen(x, y); return { x: r.left + p.x, y: r.top + p.y }; },
    };
  }, [start, current]);

  const leave = () => { if (gameRef.current && !result) persist(); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const rm = roomOf(screen === "game" ? stage : useMelon.getState().stage);
  const inS = ((stage - 1) % STAGES_PER_ROOM) + 1;
  const goalNow = def ? (def.goal.kind === "fruit" ? emojiOf(live.best) : def.goal.kind === "nuts" ? `${live.rocks} left` : `${Math.min(100, Math.round((live.score / def.goal.target) * 100))}%`) : "";
  return (
    <div className="mln-root" style={{ ["--s1" as string]: rm.sky[0], ["--s2" as string]: rm.sky[1], ["--s3" as string]: rm.sky[2], ["--trim" as string]: rm.glow }}>
      <style>{MELON_CSS}</style>
      <div className="mln-stars" aria-hidden />

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-center gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="mln-panel grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="mln-panel min-w-0 flex-1 !rounded-2xl px-3 py-1">
              <p className="mln-display truncate text-lg leading-tight">Stage {stage}{def?.boss && <span className="ml-2 rounded-full bg-[#ffb21a] px-2 py-0.5 align-middle font-sans text-[10px] font-extrabold tracking-wider text-[#4a1a00] uppercase">Finale</span>}</p>
              <p className="truncate text-[11px] font-bold opacity-75">{rm.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_ROOM}</p>
            </div>
            <div className="mln-panel flex flex-col items-center !rounded-2xl px-3 py-1 leading-none"><span className={`mln-display text-xl tabular-nums ${game && game.dropsLeft <= 5 ? "mln-low" : ""}`}>{game?.dropsLeft ?? 0}</span><span className="mt-0.5 text-[9px] font-extrabold tracking-wider uppercase opacity-70">drops</span></div>
          </div>
          <div className="mx-4 mt-0.5 flex items-center gap-2">
            <div className="mln-panel flex min-w-0 flex-1 items-center gap-2 !rounded-full px-3 py-1 text-sm font-extrabold">
              {def?.goal.kind === "nuts" ? <Nut className="size-4 shrink-0 text-[var(--trim)]" /> : def?.goal.kind === "score" ? <Trophy className="size-4 shrink-0 text-[var(--trim)]" /> : <Target className="size-4 shrink-0 text-[var(--trim)]" />}
              {def?.goal.kind === "fruit" && <span className="text-base leading-none">{emojiOf(def.goal.target)}</span>}<span className="truncate">{goalText(def)}</span>
              <span className="ml-auto shrink-0 tabular-nums opacity-80">{goalNow}</span>
            </div>
            <span key={live.score} className="mln-panel mln-display mln-bump !rounded-full px-3 py-0.5 text-lg tabular-nums">{live.score.toLocaleString()}</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="mln-stage" />
            {floats.map((f) => <span key={f.id} className={`mln-float ${f.big ? "mln-float-big" : ""}`} style={{ left: f.x, top: f.y }}>{f.text}</span>)}
          </div>
          <div className="flex items-end justify-center gap-3 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Hammer} label={armed === "hammer" ? "Tap a fruit" : "Hammer"} n={boosters.hammer} on={armed === "hammer"} onClick={() => arm("hammer")} />
            <Tool icon={Bomb} label={armed === "bomb" ? "Tap to blast" : "Bomb"} n={boosters.bomb} on={armed === "bomb"} onClick={() => arm("bomb")} />
            <Tool icon={Vibrate} label="Shake" n={boosters.shake} onClick={doShake} />
            <Tool icon={Undo2} label="Undo" n={boosters.undo} onClick={doUndo} />
            <Tool icon={RotateCcw} label="Restart" onClick={doRestart} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/15 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/30 border-t-[var(--trim)]" /><p className="mln-display text-lg text-white drop-shadow">Packing the crate…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "out" && !result && (
          <Sheet key="out" title="Out of drops!" onClose={() => undefined}>
            <p className="opacity-85">So close! {revived ? "Try the stage again." : "Take 5 more drops — free, once per stage."}</p>
            <div className="mt-4 grid gap-2">
              {!revived && <button type="button" className="mln-btn mln-cta mln-shine py-3" onClick={doMore}><Plus className="mr-1 inline size-5" /> +5 drops</button>}
              <button type="button" className="mln-btn mln-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "full" && !result && (
          <Sheet key="full" title="The crate is full!" onClose={() => undefined}>
            <p className="opacity-85">Fruit stayed over the line. Step back a drop, blast or hammer some fruit away, or start the stage again.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" className="mln-btn mln-cta py-3" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Undo ({boosters.undo})</button>
              {boosters.bomb > 0 && <button type="button" className="mln-btn mln-soft py-3" onClick={() => { doResume(); setArmed("bomb"); }}><Bomb className="mr-1 inline size-5" /> Bomb some fruit ({boosters.bomb})</button>}
              {boosters.hammer > 0 && <button type="button" className="mln-btn mln-soft py-3" onClick={() => { doResume(); setArmed("hammer"); }}><Hammer className="mr-1 inline size-5" /> Hammer a fruit ({boosters.hammer})</button>}
              <button type="button" className="mln-btn mln-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useMelon.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>👆 Slide to aim the fruit over the crate and let go to drop it (or ← → and space).</li>
              <li>🍒 Two equal fruits that touch merge into the next fruit — cherry, strawberry, grape … all the way to the watermelon 🍉</li>
              <li>🎯 Each stage has a goal: grow a fruit, crack the walnuts, or reach a score — before the drops run out.</li>
              <li>⚠️ Don&apos;t let fruit rest above the dashed line, or the crate overflows. Hammer, Bomb and Shake help out!</li>
            </ul>
            <button type="button" className="mln-btn mln-cta mt-5 w-full py-3" onClick={() => { useMelon.getState().sawHelp(); setSheet(""); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useMelon.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="mln-btn mln-cta mt-5 w-full py-3" onClick={() => { useMelon.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-28 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--trim)] bg-[#2a1014] px-4 py-2 text-sm font-bold whitespace-nowrap text-white shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label: text, n, on, onClick }: { icon: typeof Star; label: string; n?: number; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`mln-tool ${on ? "mln-tool-on" : ""}`} onClick={onClick}>
      <span className="mln-tool-ico"><Icon className="size-5" />{n !== undefined && <span className="mln-badge">{n}</span>}</span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="mln-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="mln-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/10"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClearSheet({ r, onNext, onHome }: { r: Result; onNext: () => void; onHome: () => void }) {
  const [left, setLeft] = useState(r.roomDone ? 6 : 4);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, onNext]);
  const s = roomOf(r.stage), ns = roomOf(r.stage + 1);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/35 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="mln-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="mln-head px-5 pt-6 pb-5">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="mln-display mt-1 text-4xl text-white">{r.roomDone ? "Market complete!" : `Stage ${r.stage} clear!`}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{r.roomDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_ROOM) + 1} of ${STAGES_PER_ROOM} · ${r.left} drops to spare`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="mln-display text-5xl text-[var(--trim)]">{r.score.toLocaleString()}</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/40 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="mln-btn mln-cta mln-shine flex items-center justify-center gap-2 py-3" onClick={onNext}>Stage {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="mln-btn mln-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  return (
    <div className="mln-title" role="img" aria-label="Melon Merge Fiesta" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="mln-tl mln-tl1" key={`t-${hop}`}>MELON MERGE</div>
      <div className="mln-tl3" key={`f-${hop}`}>FIESTA</div>
      <div className="mln-fruits" aria-hidden>{EMOJI.slice(1, 12).map((e, i) => <span key={`${i}-${hop}`} style={{ animationDelay: `${0.2 + i * 0.07}s, ${1 + i * 0.13}s`, fontSize: `${18 + i * 2.4}px` }}>{e}</span>)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = useMelon();
  const stage = save.stage, rm = roomOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const ri = Math.floor((stage - 1) / STAGES_PER_ROOM) % ROOMS.length;
  const remix = passOf(stage) > 0;
  return (
    <div className="mln-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Stage"], [Star, String(save.totalStars), "Stars"], [Sparkles, save.totalScore.toLocaleString(), "Score"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="mln-panel flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0 text-[var(--trim)]" />
                <span className="min-w-0"><span className="mln-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Melon Merge Fiesta — drop and merge fruits to the watermelon</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-semibold opacity-90 sm:mx-auto">Drop the fruit, merge the matches, chain the juicy pops — all the way to the watermelon!</p>

        <div className="mln-shine relative mt-3 overflow-hidden rounded-[30px] border-2 p-5 text-white shadow-[0_24px_50px_-24px_rgba(0,0,0,.8)]" style={{ borderColor: rm.glow, background: `radial-gradient(80% 90% at 85% 10%, ${rm.glow}55, transparent 60%), linear-gradient(150deg, ${rm.sky[2]}, ${rm.sky[0]})` }}>
          <p className="text-xs font-extrabold tracking-widest text-white/90 uppercase"><Store className="mr-1 inline size-4" />{rm.name}{remix ? " · Remix" : ""}</p>
          <p className="mln-display mt-1 text-5xl leading-none drop-shadow">Stage {shown}</p>
          <div className="mt-3 flex gap-1">{Array.from({ length: STAGES_PER_ROOM }, (_, i) => { const at = (shown - 1) % STAGES_PER_ROOM; return <span key={i} className={`h-2 flex-1 rounded-full ${i < at ? "bg-white" : i === at ? "animate-pulse bg-[#fff3a0]" : "bg-white/35"}`} />; })}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="mln-btn mln-cta inline-flex items-center gap-2 px-6 py-3 text-lg"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useMelon.getState().saveCurrent(null); onPlay(cur.stage); }} className="mln-btn inline-flex items-center gap-1.5 bg-white/20 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="mln-btn mln-cta inline-flex items-center gap-2 px-8 py-3.5 text-xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="mln-display text-[24px] leading-none">The markets</h2>
          <span className="text-xs font-bold opacity-60">{STAGES_PER_ROOM} stages each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROOMS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_ROOM) > i || remix, now = i === ri;
            return (
              <div key={s.id} className={`rounded-2xl border-2 p-3 text-white shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: s.glow, background: `radial-gradient(70% 80% at 90% 0%, ${s.glow}66, transparent 70%), linear-gradient(150deg, ${s.sky[2]}, ${s.sky[0]})` }}>
                <p className="text-[13px] font-extrabold drop-shadow">{s.name}</p>
                <p className="text-[11px] font-bold text-white/85">{now ? `stage ${((stage - 1) % STAGES_PER_ROOM) + 1} of ${STAGES_PER_ROOM}` : done ? "★ complete" : `from stage ${i * STAGES_PER_ROOM + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="mln-panel mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="mln-display text-lg">How it works</p>
          <p>👆 Slide to aim, let go to drop. Two equal fruits that touch merge into the next fruit — 🍒 → 🍓 → 🍇 → 🍋 → 🍊 → 🍎 → 🍐 → 🍑 → 🍍 → 🍈 → 🍉</p>
          <p>⛓️ A merge can push fruit into new matches: chain reactions score big.</p>
          <p>🎯 Every stage has a goal and a number of drops. New crate shapes, walnuts, jelly fruit and watermelon finales join as you go.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-50">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
