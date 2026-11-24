"use client";
// Bubble Breeze — a light 2D bubble shooter in the sky. Aim with the dotted guide, bounce off the walls, match three
// or more to pop them and drop everything hanging below. Every stage has a quest — clear the board, drop every golden
// crown, or clear the cloud row along the top — to finish before the shots run out. Stages never end and arrive one by
// one: 500 designed stages across eight worlds (each with its own sky, scenery and music, closed by a finale), then
// endless remixes. Phone-app flow: home → stage → clear → next stage.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bomb, ChevronRight, Cloud, Crosshair, Crown, Play, RotateCcw, Sparkles, Star, Target, Undo2, Wind, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { BOMB, BOMB_SHOT, RAINBOW, STONE } from "../../sprout/grid";
import { DESIGNED, WORLDS, STAGES_PER_WORLD, bestShot, worldOf, passOf, type Quest, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { addShots, leftoverBonus, loadBooster, newGame, shoot, starsOf, swap, type Game } from "../play";
import { useBreeze, useBreezeHydrated } from "../save";
import { BreezeBoard, type BoardSound } from "./Board";
import { BREEZE_CSS } from "./styles";
import { Title } from "./Title";

export const BREEZE_SFX = ["shoot", "bounce", "stick", "pop", "blast", "thaw", "fall", "crown", "firework", "swap", "load", "stone", "crumble", "combo", "clear", "star", "world", "lose", "booster", "open"] as const;
type Sfx = (typeof BREEZE_SFX)[number];
const sfxName = (k: Sfx) => `a:breeze_${k}` as Sound;
const music = (k: string) => `a:breeze_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const QUEST: Record<Quest, [string, string]> = { clear: ["Clear the board", "Pop or drop every bubble"], crowns: ["Collect the crowns", "Drop every golden crown"], top: ["Clear the top", "Clear the cloud row along the top"] };
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const RESCUE = 5;
const TIPS: Record<string, [string, string]> = {
  crowns: ["Crown quest", "Golden crowns ride inside some bubbles. Pop them, or drop the bubbles holding them, to collect every crown."],
  top: ["Top quest", "Clear every bubble in the cloud row along the top. Whatever hangs below falls with it!"],
  stone: ["Stones", "Stones never pop. Pop or drop the bubbles holding them up and they fall with the rest."],
  ice: ["Frozen bubbles", "A bubble in ice won't join a match. Pop something right next to it and the ice cracks."],
  bomb: ["Bombs", "Pop a bomb (or hit it with a pop) and it bursts everything around it — stones too."],
  boss: ["World finale", "The last stage of every world is its finale: a bigger board with a bigger reward."],
  remix: ["Endless skies", "You've finished all 500 designed stages! From here every stage is a fresh remix — new shapes, new quests, forever."],
};

interface Result { stage: number; stars: number; coins: number; score: number; worldDone: boolean; gift: string; crowns: number }
interface Float { id: number; x: number; y: number; text: string; big: boolean }

export default function BreezeApp({ slug }: { slug: string; title: string }) {
  const ready = useBreezeHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useBreeze((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [revived, setRevived] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "out" | "lost" | "help" | "tip">("");
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [toast, setToast] = useState("");
  const [bump, setBump] = useState(0);
  const [busy, setBusy] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<{ stage: number; g: Game } | null>(null);
  const goalRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BreezeBoard | null>(null);
  const applyPending = useCallback(() => { const sc = sceneRef.current, p = pendingRef.current; if (!sc || !p) return; pendingRef.current = null; sc.setWorld(p.stage, worldOf(p.stage)); sc.setStage(p.g); sc.setShots(p.g.shots); }, []);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null), prevRef = useRef<Game | null>(null);
  const stateRef = useRef({ revived: false, result: false, sheet: "", paused: false, busy: false, undo: true });
  useEffect(() => { gameRef.current = game; if (game) sceneRef.current?.setShots(game.shots); }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { ...stateRef.current, revived, result: !!result, sheet, paused, busy }; }, [revived, result, sheet, paused, busy]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Blowing bubbles");
    void audio.preload(BREEZE_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(worldOf(useBreeze.getState().stage).music)]);
    prepareStage(useBreeze.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.22, duck: k === "clear" || k === "world" });
  }, []);

  const addFloat = useCallback((x: number, y: number, text: string, big = false) => {
    const id = Math.random();
    setFloats((f) => [...f.slice(-6), { id, x, y, text, big }]);
    setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 1100);
  }, []);

  const persist = useCallback((g: Game) => {
    const d = defRef.current; if (!d) return;
    useBreeze.getState().saveCurrent({ stage: d.stage, game: g, revived: stateRef.current.revived });
  }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback(async (g: Game) => {
    const d = defRef.current!;
    const scene = sceneRef.current;
    const left = g.shots;
    if (scene) await new Promise((r) => setTimeout(r, scene.crumble()));
    if (scene && left > 0) {
      const p = scene.launcherScreen();
      await scene.celebrate(left, (i) => { if (i % 2 === 0) addFloat(p.x + (Math.random() - 0.5) * 120, p.y - 140 - Math.random() * 120, "+50"); });
    }
    const stars = stateRef.current.revived ? 1 : starsOf(g, d);
    const total = g.score + leftoverBonus(g) + (d.boss ? 500 : 0);
    const coins = 5 + Math.round(d.grid.flat().filter(Boolean).length / 6) + g.crowns * 3 + stars * 3 + (d.boss ? 20 : 0);
    useProfile.getState().earnCoins(coins);
    useBreeze.getState().win(d.stage, stars, total);
    // gifts: a booster on every garden boss and every 10th stage
    let gift = "";
    if (d.boss) { useBreeze.getState().giveBooster("rainbow", 1); useBreeze.getState().giveBooster("bomb", 1); gift = "+1 Rainbow · +1 Bomb"; }
    else if (d.stage % 10 === 0) { const b = d.stage % 20 === 0 ? "bomb" : "rainbow"; useBreeze.getState().giveBooster(b, 1); gift = b === "bomb" ? "+1 Bomb" : "+1 Rainbow"; }
    const worldDone = d.stage % STAGES_PER_WORLD === 0;
    setResult({ stage: d.stage, stars, coins, score: total, worldDone, gift, crowns: g.crowns });
    sfx(worldDone ? "world" : "clear", { gain: 0.8 });
    for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    track("breeze_clear", { stage: d.stage, shots: g.fired, stars });
  }, [sfx, addFloat]);

  // ---------------------------------------------------------------- a shot (from the scene)
  const tryShoot = useCallback(async (angle: number) => {
    const g0 = gameRef.current, scene = sceneRef.current, st = stateRef.current;
    if (!g0 || !scene || st.result || st.sheet || st.paused || st.busy) return;
    const { game: g, res } = shoot(g0, angle);
    if (!res.out) return;
    prevRef.current = g0;
    stateRef.current.busy = true; setBusy(true);
    sfx("shoot", { gain: 0.5, rate: 0.95 + Math.random() * 0.1 });
    buzz(8);
    setGame(g);
    persist(g);
    const crownsBefore = g0.crowns;
    await scene.play(res, g);
    stateRef.current.busy = false; setBusy(false);
    if (g.crowns > crownsBefore || g.left < g0.left) setBump((b) => b + 1);
    if (res.out.popped.length >= 3 && g.combo > 1) {
      const p = scene.launcherScreen();
      addFloat(p.x, p.y - 220, `Combo ×${g.combo}`, true);
      sfx("combo", { gain: 0.5, rate: Math.min(1.6, 0.9 + g.combo * 0.08) });
    }
    if (res.out.fallen.length >= 6) { const p = scene.launcherScreen(); addFloat(p.x, p.y - 260, res.out.fallen.length >= 12 ? "Avalanche!" : "Big drop!", true); }
    if (res.win) { useBreeze.getState().saveCurrent(null); void finishStage(g); }
    else if (res.lose) {
      scene.jolt(); buzz(60);
      sfx("lose", { gain: 0.6 });
      setCanUndo(stateRef.current.undo);
      setTimeout(() => setSheet(res.out!.lost ? "lost" : "out"), 450);
    }
  }, [sfx, addFloat, finishStage, persist]);

  const doSwap = useCallback(() => {
    const g0 = gameRef.current, st = stateRef.current;
    if (!g0 || st.busy || st.result || st.sheet) return;
    const g = swap(g0);
    setGame(g); sceneRef.current?.swap(g); persist(g);
    sfx("swap", { gain: 0.45 });
  }, [sfx, persist]);

  // ---------------------------------------------------------------- scene
  const shootRef = useRef(tryShoot), swapRef = useRef(doSwap);
  useEffect(() => { shootRef.current = tryShoot; swapRef.current = doSwap; }, [tryShoot, doSwap]);
  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const scene = new BreezeBoard(host.current, {
      shoot: (a) => void shootRef.current(a),
      swap: () => swapRef.current(),
      canAim: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused && !s.busy; },
      goal: () => {
        const h = host.current?.getBoundingClientRect(), g = goalRef.current?.getBoundingClientRect();
        if (!h || !g) return { x: 40, y: -20 };
        return { x: g.left + g.width / 2 - h.left, y: g.top + g.height / 2 - h.top };
      },
      sound: (e: BoardSound, pan: number, n = 0) => {
        if (e === "pop") sfx("pop", { x: pan, gain: 0.55, rate: Math.min(1.8, 0.95 + n * 0.05) });
        else if (e === "fall") sfx("fall", { x: pan, gain: Math.min(0.75, 0.4 + n * 0.03) });
        else if (e === "crown") sfx("crown", { x: pan, gain: 0.55, rate: 1 + Math.min(8, n) * 0.06 });
        else if (e === "firework") sfx("firework", { x: pan, gain: 0.5, rate: 0.9 + (n % 5) * 0.08 });
        else if (e === "bounce") sfx("bounce", { x: pan, gain: 0.4 });
        else if (e === "stick") { sfx("stick", { x: pan, gain: 0.5 }); buzz(10); }
        else if (e === "blast") { sfx("blast", { x: pan, gain: 0.7 }); buzz(40); }
        else sfx(e as Sfx, { x: pan, gain: 0.45 });
      },
      float: (x, y, text, big) => addFloat(x, y, text, big),
    });
    sceneRef.current = scene;
    applyPending();
    return () => { scene.dispose(); sceneRef.current = null; };
  }, [screen, sfx, addFloat, applyPending]);

  // ---------------------------------------------------------------- stages
  const start = useCallback(async (stage: number, resume?: { game: Game; revived: boolean }) => {
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const g = resume?.game ?? newGame(d);
    prevRef.current = null; stateRef.current.undo = true; stateRef.current.busy = false;
    setDef(d); setGame(g); setResult(null); setSheet(""); setBusy(false);
    setRevived(resume?.revived ?? false);
    setScreen("game");
    const gd = worldOf(stage);
    void audio.playMusic(music(gd.music));
    audio.warmMusic([music(worldOf(stage + STAGES_PER_WORLD).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    // the scene may not exist yet on the first stage: hand the stage over whichever comes first
    pendingRef.current = { stage, g };
    requestAnimationFrame(() => applyPending());
    const tips = useBreeze.getState().tips;
    const flat = d.grid.flat();
    const has: Record<string, boolean> = { crowns: d.quest === "crowns", top: d.quest === "top", stone: flat.some((x) => x?.k === STONE), ice: flat.some((x) => x?.ice), bomb: flat.some((x) => x?.k === BOMB), boss: d.boss, remix: stage > DESIGNED };
    const tip = ["remix", "crowns", "top", "stone", "ice", "bomb", "boss"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useBreeze.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); }
    setToast(`${QUEST[d.quest][0]} — ${QUEST[d.quest][1].toLowerCase()}`);
    track("breeze_start", { stage });
  }, [sfx, applyPending]);

  // ---------------------------------------------------------------- boosters
  const applyBoost = (b: "rainbow" | "bomb") => {
    const g0 = gameRef.current; if (!g0 || busy || result) return;
    if (g0.cur === RAINBOW || g0.cur === BOMB_SHOT) { setToast("A booster is already loaded"); return; }
    if (!useBreeze.getState().useBooster(b)) { setToast(b === "rainbow" ? "No rainbow bubbles left" : "No bombs left"); return; }
    const g = loadBooster(g0, b === "rainbow" ? RAINBOW : BOMB_SHOT);
    setGame(g); sceneRef.current?.sync(g); persist(g);
    sfx("booster", { gain: 0.6 });
  };
  const doRestart = () => { const d = defRef.current; if (!d) return; useBreeze.getState().saveCurrent(null); void start(d.stage); };
  const doRescue = () => { const g0 = gameRef.current; if (!g0) return; const g = addShots(g0, RESCUE); setRevived(true); stateRef.current.revived = true; setGame(g); sceneRef.current?.sync(g); setSheet(""); persist(g); sfx("booster", { gain: 0.6 }); };
  const doUndo = () => {
    const p = prevRef.current; if (!p || !stateRef.current.undo) return;
    stateRef.current.undo = false; prevRef.current = null;
    setRevived(true); stateRef.current.revived = true;
    setGame(p); sceneRef.current?.setStage(p); setSheet(""); persist(p);
    sfx("swap", { gain: 0.5 });
  };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __breeze?: unknown }).__breeze = {
      game: () => gameRef.current, def: () => defRef.current, busy: () => stateRef.current.busy,
      start: (stage: number) => void start(stage),
      shoot: (a: number) => shootRef.current(a),
      best: () => { const g = gameRef.current; if (!g) return null; const a = bestShot(g.grid, g.cur), b = bestShot(g.grid, g.nxt); return b.score > a.score + 20 ? { swap: true, angle: b.angle } : { swap: false, angle: a.angle }; },
      swap: () => swapRef.current(),
      cell: (r: number, c: number) => { const sc = sceneRef.current, rr = host.current?.getBoundingClientRect(); if (!sc || !rr) return null; const p = sc.cellScreen(r, c); return { x: rr.left + p.x, y: rr.top + p.y }; },
      launcher: () => { const sc = sceneRef.current, r = host.current?.getBoundingClientRect(); if (!sc || !r) return null; const p = sc.launcherScreen(); return { x: r.left + p.x, y: r.top + p.y }; },
    };
  }, [start]);

  const leave = () => { const g = gameRef.current; if (g && !result && !busy) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const gd = worldOf(screen === "game" ? stage : useBreeze.getState().stage);
    const inG = ((stage - 1) % STAGES_PER_WORLD) + 1;
  const night = gd.id === "night" || gd.id === "aurora";
  return (
    <div className={`brz-root ${night ? "brz-night" : ""}`} style={{ ["--s1" as string]: gd.sky[0], ["--s2" as string]: gd.sky[1], ["--s3" as string]: gd.sky[2], ["--glow" as string]: gd.glow }}>
      <style>{BREEZE_CSS}</style>
      <div className="brz-clouds" aria-hidden>{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ top: `${8 + i * 13}%`, width: 70 + (i % 3) * 30, animationDuration: `${38 + i * 9}s`, animationDelay: `${-i * 11}s`, opacity: night ? 0.15 : 0.8 }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-center gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="brz-panel grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="brz-panel min-w-0 flex-1 !rounded-2xl px-3 py-1">
              <p className="brz-display truncate text-lg leading-tight">Stage {stage}{def?.boss && <span className="ml-2 rounded-full bg-[#ff4f6d] px-2 py-0.5 align-middle font-sans text-[10px] font-extrabold tracking-wider text-white uppercase">Boss</span>}</p>
              <p className="truncate text-[11px] font-bold opacity-70">{gd.name}{passOf(stage) ? " · Remix" : ""} · {inG}/{STAGES_PER_WORLD}</p>
            </div>
            <div ref={goalRef} className="brz-panel flex items-center gap-1.5 !rounded-2xl px-3 py-1.5 font-extrabold tabular-nums">
              <QuestIcon key={bump} q={game?.quest ?? "clear"} className={`size-5 ${bump ? "brz-bump" : ""}`} />{game ? game.left : "–"}
            </div>
          </div>
          <div className="mx-4 mt-0.5 flex items-center gap-2">
            <div className="brz-bar flex-1"><b style={{ width: `${game ? (1 - game.left / Math.max(1, game.total)) * 100 : 0}%` }} />{[0.5, 0.8, 1].map((p, i) => <i key={p} style={{ left: `${p * 100}%` }}><Star className={`size-4 ${game && 1 - game.left / Math.max(1, game.total) >= p ? "fill-[#ffe27a] text-[#e08a00]" : "fill-white/70 text-[#2f6fe0]/50"}`} style={{ marginLeft: i === 2 ? -8 : 0 }} /></i>)}</div>
            <span className="brz-panel brz-display !rounded-full px-3 py-0.5 text-lg tabular-nums">{(game?.score ?? 0).toLocaleString()}</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="brz-stage" />
            {floats.map((f) => <span key={f.id} className={`brz-float ${f.big ? "brz-float-big" : ""}`} style={{ left: f.x, top: f.y }}>{f.text}</span>)}
          </div>
          <div className="flex items-end justify-center gap-3 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <div className="brz-panel flex flex-col items-center !rounded-2xl px-3 py-1">
              <span className="brz-display text-2xl leading-none tabular-nums">{game?.left ?? 0}</span>
              <span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{game?.quest === "crowns" ? "Crowns" : game?.quest === "top" ? "Top row" : "Bubbles"}</span>
            </div>
            <Tool icon={Sparkles} label="Rainbow" n={boosters.rainbow} on={game?.cur === RAINBOW} onClick={() => applyBoost("rainbow")} />
            <Tool icon={Bomb} label="Bomb" n={boosters.bomb} on={game?.cur === BOMB_SHOT} onClick={() => applyBoost("bomb")} />
            <Tool icon={RotateCcw} label="Restart" onClick={doRestart} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/15 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/40 border-t-[#2f6fe0]" /><p className="brz-display text-lg text-white drop-shadow">Blowing bubbles…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "out" && !result && (
          <Sheet key="out" title="Out of shots!" onClose={() => undefined}>
            <p className="opacity-85">{game ? `${game.left} ${game.quest === "crowns" ? "crown" : "bubble"}${game.left === 1 ? "" : "s"} still to go.` : ""} {revived ? "Try the stage again." : `Take ${RESCUE} more shots — free, once per stage.`}</p>
            <div className="mt-4 grid gap-2">
              {!revived && <button type="button" className="brz-btn brz-cta brz-shine py-3" onClick={doRescue}><Crosshair className="mr-1 inline size-5" /> +{RESCUE} shots</button>}
              <button type="button" className="brz-btn brz-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "lost" && !result && (
          <Sheet key="lost" title="Too low!" onClose={() => undefined}>
            <p className="opacity-85">A bubble crossed the line at the bottom of the board. {canUndo ? "Take that shot back once, or start again." : "Start the stage again."}</p>
            <div className="mt-4 grid gap-2">
              {canUndo && <button type="button" className="brz-btn brz-cta py-3" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Take it back</button>}
              <button type="button" className="brz-btn brz-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useBreeze.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>🎯 Drag to aim (or move the mouse) — the dots show the path. Let go to shoot, and bounce shots off the walls!</li>
              <li>🔴 Three or more of the same colour pop — and everything hanging below them falls.</li>
              <li>🏁 Each stage has a quest: clear the board, collect the crowns, or clear the top row. Finish it before the shots run out!</li>
              <li>🔄 Tap the launcher to swap your bubble with the next one.</li>
            </ul>
            <button type="button" className="brz-btn brz-cta mt-5 w-full py-3" onClick={() => { useBreeze.getState().sawHelp(); setSheet(""); }}>Let&apos;s pop!</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useBreeze.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="brz-btn brz-cta mt-5 w-full py-3" onClick={() => { useBreeze.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1e3a6a] px-4 py-2 text-sm font-bold whitespace-nowrap text-white shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label, n, on, onClick }: { icon: typeof Sparkles; label: string; n?: number; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`brz-tool ${on ? "brz-tool-on" : ""}`} onClick={onClick}>
      <span className="brz-tool-ico"><Icon className="size-5" />{n !== undefined && <span className="brz-badge">{n}</span>}</span>{label}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="brz-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="brz-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-[#1e3a6a]/10"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClearSheet({ r, onNext, onHome }: { r: Result; onNext: () => void; onHome: () => void }) {
  const [left, setLeft] = useState(r.worldDone ? 6 : 4);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, onNext]);
  const g = worldOf(r.stage), ng = worldOf(r.stage + 1);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/35 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="brz-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="brz-head px-5 pt-6 pb-5">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="brz-display mt-1 text-4xl text-white">{r.worldDone ? "World complete!" : `Stage ${r.stage} clear!`}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{r.worldDone ? `${g.name} done — next: ${ng.name}` : `${g.name} · ${((r.stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="brz-display text-5xl text-[#2f6fe0]">{r.score.toLocaleString()}</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.crowns > 0 && <span className="flex items-center gap-1"><Crown className="size-4 text-[#e0a000]" /> {r.crowns}</span>}{r.gift && <span className="rounded-full bg-[#ffd34a]/40 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="brz-btn brz-cta brz-shine flex items-center justify-center gap-2 py-3" onClick={onNext}>Stage {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="brz-btn brz-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = useBreeze();
  const stage = save.stage, gd = worldOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const gi = Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length;
  const remix = passOf(stage) > 0;
  return (
    <div className="brz-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Stage"], [Star, String(save.totalStars), "Stars"], [Sparkles, save.totalScore.toLocaleString(), "Score"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="brz-panel flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0 text-[#2f6fe0]" />
                <span className="min-w-0"><span className="brz-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Bubble Breeze — bubble shooter</h1>
        <Title />
        <p className="-mt-1 max-w-lg text-center text-[14px] leading-snug font-semibold opacity-85 sm:mx-auto">Aim, bounce and pop! A breezy bubble shooter with quests and endless stages across eight sky worlds.</p>

        <div className="brz-shine relative mt-3 overflow-hidden rounded-[30px] border-2 border-white p-5 text-white shadow-[0_24px_50px_-24px_rgba(20,50,110,.8)]" style={{ background: `linear-gradient(150deg, ${gd.sky[0]}, ${gd.accent} 120%)` }}>
          <p className="text-xs font-extrabold tracking-widest text-white/90 uppercase"><Wind className="mr-1 inline size-4" />{gd.name}{remix ? " · Remix" : ""}</p>
          <p className="brz-display mt-1 text-5xl leading-none drop-shadow">Stage {shown}</p>
          <div className="mt-3 flex gap-1">{Array.from({ length: STAGES_PER_WORLD }, (_, i) => { const at = (shown - 1) % STAGES_PER_WORLD; return <span key={i} className={`h-2 flex-1 rounded-full ${i < at ? "bg-white" : i === at ? "animate-pulse bg-[#fff3a0]" : "bg-white/35"}`} />; })}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="brz-btn brz-cta inline-flex items-center gap-2 px-6 py-3 text-lg"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useBreeze.getState().saveCurrent(null); onPlay(cur.stage); }} className="brz-btn inline-flex items-center gap-1.5 bg-white/15 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="brz-btn brz-cta inline-flex items-center gap-2 px-8 py-3.5 text-xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="brz-display text-[24px] leading-none">The worlds</h2>
          <span className="text-xs font-bold opacity-60">{STAGES_PER_WORLD} stages each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORLDS.map((g, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_WORLD) > i || remix, now = i === gi;
            return (
              <div key={g.id} className={`rounded-2xl border-2 border-white/70 p-3 text-white shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ background: `linear-gradient(150deg, ${g.sky[0]}, ${g.accent})` }}>
                <p className="text-[13px] font-extrabold drop-shadow">{g.name}</p>
                <p className="text-[11px] font-bold text-white/85">{now ? `stage ${((stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}` : done ? "★ complete" : `from stage ${i * STAGES_PER_WORLD + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="brz-panel mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="brz-display text-lg text-[#2f6fe0]">How it works</p>
          <p>🎯 Aim with the dotted guide, bounce off the walls and match three or more bubbles of a colour.</p>
          <p>🏁 Every stage has a quest — clear the board, collect the crowns or clear the top row. Leftover shots burst as fireworks for bonus points.</p>
          <p>🪨 Stones, ❄️ ice and 💣 bombs join as you travel. Rainbow and bomb boosters help in a pinch.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-50">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}

function QuestIcon({ q, className }: { q: Quest; className?: string }) {
  const I = q === "crowns" ? Crown : q === "top" ? Cloud : Target;
  return <I className={`${className ?? ""} ${q === "crowns" ? "text-[#e0a000]" : "text-[#2f6fe0]"}`} />;
}
