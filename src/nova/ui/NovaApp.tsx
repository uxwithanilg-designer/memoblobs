"use client";
// Merge Nova — drop & merge numbers in space. Drop number blocks into five columns; equal numbers that touch merge
// and double, and the merges chain. Every stage has a goal — build a target number, smash every asteroid, or reach a
// score — within a number of drops. Stages never end and arrive one by one: 500 designed stages across eight
// galaxies (each with its own sky and music, closed by a finale), then endless remixes. Phone-app flow.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowLeftRight, ChevronRight, Gem, Hammer, Orbit, Play, RotateCcw, Sparkles, Star, Target, Trophy, Undo2, X, Plus } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { label, maxTile, stonesLeft } from "../engine";
import { DESIGNED, GALAXIES, STAGES_PER_GALAXY, bestColumn, passOf, galaxyOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { hammer, newGame, play, starsOf, swapNext, type Game } from "../play";
import { useNova, useNovaHydrated } from "../save";
import { NovaBoard, type BoardSound } from "./Board";
import { NOVA_CSS } from "./styles";

export const NOVA_SFX = ["aim", "drop", "land", "merge", "combo", "crack", "smash", "thaw", "hammer", "swap", "undo", "clear", "star", "galaxy", "lose", "open"] as const;
type Sfx = (typeof NOVA_SFX)[number];
const sfxName = (k: Sfx) => `a:nova_${k}` as Sound;
const music = (k: string) => `a:nova_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  stones: ["Asteroid stones", "Stones never merge. A merge right next to one cracks it — the second crack smashes it. Smash them all!"],
  score: ["Score goal", "Reach the target score. Bigger merges and chain reactions score much more."],
  ice: ["Frozen numbers", "A frozen number can't merge until a merge happens right next to it and melts the ice."],
  boss: ["Galaxy finale", "The last stage of every galaxy is its finale: a bigger number to build and a bigger reward."],
  remix: ["Endless space", "You've finished all 500 designed stages! From here every stage is a fresh remix — new boards and goals, forever."],
};
const goalText = (d: StageDef | null) => !d ? "" : d.goal.kind === "tile" ? `Make ${label(d.goal.target)}` : d.goal.kind === "stones" ? "Smash every asteroid" : `Score ${d.goal.target.toLocaleString()}`;

interface Result { stage: number; stars: number; coins: number; score: number; galaxyDone: boolean; gift: string; left: number }
interface Float { id: number; x: number; y: number; text: string; big: boolean }

export default function NovaApp({ slug }: { slug: string; title: string }) {
  const ready = useNovaHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useNova((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [left] = useState(0);
  const [revived, setRevived] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "out" | "full" | "help" | "tip">("");
  const [armed, setArmed] = useState(false);
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [toast, setToast] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const boardRef = useRef<NovaBoard | null>(null);
  const hist = useRef<Game[]>([]);
  const armedRef = useRef(false);
  const hammerRef = useRef<(i: number) => void>(() => undefined);
  useEffect(() => { armedRef.current = armed; }, [armed]);
  const helped = useRef(false);
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  const applyPending = useCallback(() => { const b = boardRef.current, p = pendingRef.current; if (!b || !p) return; pendingRef.current = null; b.setStage(p.g, galaxyOf(p.d.stage), p.d.stage); }, []);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null);
  const stateRef = useRef({ left: 0, revived: false, result: false, sheet: "", paused: false });
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { left, revived, result: !!result, sheet, paused }; }, [left, revived, result, sheet, paused]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2000); return () => clearTimeout(t); }, [toast]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Charging the stars");
    void audio.preload(NOVA_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(galaxyOf(useNova.getState().stage).music)]);
    prepareStage(useNova.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.18, duck: k === "clear" || k === "galaxy" });
  }, []);
  const addFloat = useCallback((x: number, y: number, text: string, big = false) => {
    const id = Math.random();
    setFloats((f) => [...f.slice(-6), { id, x, y, text, big }]);
    setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 1100);
  }, []);
  const persist = useCallback((g: Game) => {
    const d = defRef.current; if (!d) return;
    useNova.getState().saveCurrent({ stage: d.stage, game: g, revived: stateRef.current.revived });
  }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback((g: Game) => {
    const d = defRef.current!;
    const stars = starsOf(g.dropsLeft, d.drops, helped.current);
    const total = g.score + g.dropsLeft * 50 + (d.boss ? 500 : 0);
    const coins = 5 + Math.round(Math.log2(Math.max(2, g.best))) + stars * 3 + (d.boss ? 20 : 0);
    useProfile.getState().earnCoins(coins);
    useNova.getState().win(d.stage, stars, total);
    useNova.getState().saveCurrent(null);
    let gift = "";
    if (d.boss) { useNova.getState().giveBooster("hammer", 2); useNova.getState().giveBooster("swap", 2); useNova.getState().giveBooster("undo", 1); gift = "+2 Hammers · +2 Swaps · +1 Undo"; }
    else if (d.stage % 10 === 0) { useNova.getState().giveBooster("hammer", 1); gift = "+1 Hammer"; }
    const galaxyDone = d.stage % STAGES_PER_GALAXY === 0;
    setResult({ stage: d.stage, stars, coins, score: total, galaxyDone, gift, left: g.dropsLeft });
    sfx(galaxyDone ? "galaxy" : "clear", { gain: 0.8 });
    boardRef.current?.celebrate();
    for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    track("nova_clear", { stage: d.stage, stars });
  }, [sfx]);

  // ---------------------------------------------------------------- board
  const dropRef = useRef<(c: number) => ReturnType<typeof playDrop>>(() => null);
  const playDrop = (c: number) => {
    const g0 = gameRef.current, d = defRef.current, st = stateRef.current;
    if (!g0 || !d || st.result || st.sheet || st.paused) return null;
    const r = play(g0, d, c);
    if (!r) return null;
    hist.current = [...hist.current, g0].slice(-20);
    setGame(r.game); gameRef.current = r.game;
    buzz(10);
    const chains = r.out.res.merges.length ? r.out.res.merges[r.out.res.merges.length - 1].chain : 0;
    if (chains > 2) sfx("combo", { gain: 0.5, rate: Math.min(1.6, 0.9 + chains * 0.08), delay: 0.25 });
    const wait = 260 + r.out.res.steps.length * 160;
    if (r.out.win) setTimeout(() => finishStage(r.game), wait + 300);
    else { persist(r.game); if (r.out.lose) setTimeout(() => { setSheet(r.game.dropsLeft <= 0 ? "out" : "full"); sfx("lose", { gain: 0.55 }); boardRef.current?.jolt(); }, wait); }
    return { res: r.out.res, game: r.game };
  };
  useEffect(() => { dropRef.current = playDrop; });
  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const board = new NovaBoard(host.current, {
      drop: (c) => dropRef.current(c),
      hammerArmed: () => armedRef.current,
      hammer: (i) => hammerRef.current(i),
      canPlay: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused; },
      sound: (e: BoardSound, pan: number, n = 0) => {
        if (e === "merge") sfx("merge", { x: pan, gain: 0.6, rate: Math.min(1.8, 1 + (n - 1) * 0.12) });
        else if (e === "aim") sfx("aim", { x: pan, gain: 0.18 });
        else if (e === "smash") { sfx("smash", { x: pan, gain: 0.6 }); buzz(30); }
        else sfx(e as Sfx, { x: pan, gain: 0.5 });
      },
      float: (x, y, text, big) => addFloat(x, y, text, big),
    });
    boardRef.current = board;
    applyPending();
    return () => { board.dispose(); boardRef.current = null; };
  }, [screen, sfx, addFloat, applyPending]);

  // ---------------------------------------------------------------- stages
  const start = useCallback(async (stage: number, resume?: { game: Game; revived: boolean }) => {
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const g = resume?.game ?? newGame(d);
    setDef(d); setGame(g); setResult(null); setSheet("");
    setRevived(resume?.revived ?? false); setArmed(false);
    hist.current = []; helped.current = !!resume?.revived;
    setScreen("game");
    const sp = galaxyOf(stage);
    void audio.playMusic(music(sp.music));
    audio.warmMusic([music(galaxyOf(stage + STAGES_PER_GALAXY).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = useNova.getState().tips;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, stones: d.goal.kind === "stones", score: d.goal.kind === "score", ice: d.board.some((x) => x?.ice), boss: d.boss };
    const tip = ["remix", "stones", "score", "ice", "boss"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useNova.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); } else setToast(goalText(d));
    track("nova_start", { stage });
  }, [sfx, applyPending]);

  // ---------------------------------------------------------------- the clock
  // ---------------------------------------------------------------- boosters
  const doHammerAt = (i: number) => {
    const g0 = gameRef.current; if (!g0) return;
    if (!useNova.getState().useBooster("hammer")) { setToast("No hammers left"); setArmed(false); return; }
    const g = hammer(g0, i); if (!g) return;
    helped.current = true; hist.current = [...hist.current, g0].slice(-20);
    setGame(g); gameRef.current = g; setArmed(false);
    setTimeout(() => boardRef.current?.sync(g), 180); persist(g);
  };
  useEffect(() => { hammerRef.current = doHammerAt; });
  const doSwap = () => {
    const g0 = gameRef.current; if (!g0 || result) return;
    if (!useNova.getState().useBooster("swap")) { setToast("No swaps left"); return; }
    const g = swapNext(g0); setGame(g); gameRef.current = g; boardRef.current?.sync(g); persist(g); sfx("swap", { gain: 0.5 });
  };
  const doUndo = () => {
    const prev = hist.current[hist.current.length - 1];
    if (!prev || result) { setToast("Nothing to undo"); return; }
    if (!useNova.getState().useBooster("undo")) { setToast("No undos left"); return; }
    hist.current = hist.current.slice(0, -1); helped.current = true;
    setGame(prev); gameRef.current = prev; boardRef.current?.sync(prev); setSheet(""); persist(prev);
    sfx("undo", { gain: 0.5 });
  };
  const doMore = () => { const g0 = gameRef.current; if (!g0) return; const g = { ...g0, dropsLeft: g0.dropsLeft + 5 }; setRevived(true); helped.current = true; setGame(g); gameRef.current = g; boardRef.current?.sync(g); setSheet(""); persist(g); sfx("star", { gain: 0.5 }); };
  const doRestart = () => { const d = defRef.current; if (!d) return; useNova.getState().saveCurrent(null); void start(d.stage); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __nova?: unknown }).__nova = {
      game: () => gameRef.current, def: () => defRef.current, start: (stage: number) => void start(stage),
      drop: (c: number) => boardRef.current?.dropAt(c),
      best: () => { const g = gameRef.current, d = defRef.current; return g && d ? bestColumn(g.board, g.cur, g.nxt, d.goal) : -1; },
      busy: () => !!boardRef.current && (boardRef.current as unknown as { busy: boolean }).busy,
      col: (c: number) => { const b = boardRef.current, r = host.current?.getBoundingClientRect(); if (!b || !r) return null; const p = b.columnScreen(c); return { x: r.left + p.x, y: r.top + p.y }; },
    };
  }, [start]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const sp = galaxyOf(screen === "game" ? stage : useNova.getState().stage);
  const night = true;
  const inS = ((stage - 1) % STAGES_PER_GALAXY) + 1;
  return (
    <div className={`nov-root ${night ? "nov-night" : ""}`} style={{ ["--s1" as string]: sp.sky[0], ["--s2" as string]: sp.sky[1], ["--s3" as string]: sp.sky[2], ["--trim" as string]: sp.glow }}>
      <style>{NOVA_CSS}</style>
      <div className="nov-stars" aria-hidden />

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-center gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="nov-panel grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="nov-panel min-w-0 flex-1 !rounded-2xl px-3 py-1">
              <p className="nov-display truncate text-lg leading-tight">Stage {stage}{def?.boss && <span className="ml-2 rounded-full bg-[#ff4f8a] px-2 py-0.5 align-middle font-sans text-[10px] font-extrabold tracking-wider text-white uppercase">Finale</span>}</p>
              <p className="truncate text-[11px] font-bold opacity-75">{sp.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_GALAXY}</p>
            </div>
            <div className="nov-panel flex flex-col items-center !rounded-2xl px-3 py-1 leading-none"><span className={`nov-display text-xl tabular-nums ${game && game.dropsLeft <= 5 ? "nov-low" : ""}`}>{game?.dropsLeft ?? 0}</span><span className="mt-0.5 text-[9px] font-extrabold tracking-wider uppercase opacity-70">drops</span></div>
          </div>
          <div className="mx-4 mt-0.5 flex items-center gap-2">
            <div className="nov-panel flex min-w-0 flex-1 items-center gap-2 !rounded-full px-3 py-1 text-sm font-extrabold">{def?.goal.kind === "stones" ? <Gem className="size-4 shrink-0 text-[var(--trim)]" /> : def?.goal.kind === "score" ? <Trophy className="size-4 shrink-0 text-[var(--trim)]" /> : <Target className="size-4 shrink-0 text-[var(--trim)]" />}<span className="truncate">{goalText(def)}</span><span className="ml-auto shrink-0 tabular-nums opacity-80">{def && game ? (def.goal.kind === "tile" ? `${label(maxTile(game.board))}` : def.goal.kind === "stones" ? `${stonesLeft(game.board)} left` : `${Math.min(100, Math.round((game.score / def.goal.target) * 100))}%`) : ""}</span></div>
            <span className="nov-panel nov-display !rounded-full px-3 py-0.5 text-lg tabular-nums">{(game?.score ?? 0).toLocaleString()}</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="nov-stage" />
            {floats.map((f) => <span key={f.id} className={`nov-float ${f.big ? "nov-float-big" : ""}`} style={{ left: f.x, top: f.y }}>{f.text}</span>)}
          </div>
          <div className="flex items-end justify-center gap-3 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Hammer} label={armed ? "Tap a block" : "Hammer"} n={boosters.hammer} onClick={() => { if (!armed && boosters.hammer <= 0) { setToast("No hammers left"); return; } setArmed((a) => !a); }} />
            <Tool icon={ArrowLeftRight} label="Swap" n={boosters.swap} onClick={doSwap} />
            <Tool icon={Undo2} label="Undo" n={boosters.undo} onClick={doUndo} />
            <Tool icon={RotateCcw} label="Restart" onClick={doRestart} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/15 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/30 border-t-[var(--trim)]" /><p className="nov-display text-lg text-white drop-shadow">Charging the stars…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "out" && !result && (
          <Sheet key="out" title="Out of drops!" onClose={() => undefined}>
            <p className="opacity-85">So close! {revived ? "Try the stage again." : "Take 5 more drops — free, once per stage."}</p>
            <div className="mt-4 grid gap-2">
              {!revived && <button type="button" className="nov-btn nov-cta nov-shine py-3" onClick={doMore}><Plus className="mr-1 inline size-5" /> +5 drops</button>}
              <button type="button" className="nov-btn nov-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "full" && !result && (
          <Sheet key="full" title="The board is full!" onClose={() => undefined}>
            <p className="opacity-85">No column has room left. Step back a drop, or start the stage again.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" className="nov-btn nov-cta py-3" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Undo ({boosters.undo})</button>
              <button type="button" className="nov-btn nov-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useNova.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>👆 Tap a column (or move and tap, or use ← → and space) to drop the block.</li>
              <li>✨ Equal numbers that touch merge and double — and the merges can chain!</li>
              <li>🎯 Each stage has a goal: make a number, smash the asteroids, or reach a score — before the drops run out.</li>
              <li>🔨 Hammer a block away, swap the shot with the next block, or undo a drop.</li>
            </ul>
            <button type="button" className="nov-btn nov-cta mt-5 w-full py-3" onClick={() => { useNova.getState().sawHelp(); setSheet(""); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useNova.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="nov-btn nov-cta mt-5 w-full py-3" onClick={() => { useNova.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1a2a22] border border-[var(--trim)] px-4 py-2 text-sm font-bold whitespace-nowrap text-white shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label, n, onClick }: { icon: typeof Star; label: string; n?: number; onClick: () => void }) {
  return (
    <button type="button" className="nov-tool" onClick={onClick}>
      <span className="nov-tool-ico"><Icon className="size-5" />{n !== undefined && <span className="nov-badge">{n}</span>}</span>{label}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="nov-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="nov-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/10"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClearSheet({ r, onNext, onHome }: { r: Result; onNext: () => void; onHome: () => void }) {
  const [left, setLeft] = useState(r.galaxyDone ? 6 : 4);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, onNext]);
  const s = galaxyOf(r.stage), ns = galaxyOf(r.stage + 1);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/35 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="nov-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="nov-head px-5 pt-6 pb-5">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="nov-display mt-1 text-4xl text-white">{r.galaxyDone ? "Galaxy complete!" : `Stage ${r.stage} clear!`}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{r.galaxyDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_GALAXY) + 1} of ${STAGES_PER_GALAXY} · ${r.left} drops to spare`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="nov-display text-5xl text-[var(--trim)]">{r.score.toLocaleString()}</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/40 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="nov-btn nov-cta nov-shine flex items-center justify-center gap-2 py-3" onClick={onNext}>Stage {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="nov-btn nov-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  const cols = ["#ff4f8a", "#3fd36b", "#2fb4ff", "#ff9a2f", "#ff4a4a", "#a65cff", "#ffd23f", "#2f6fff", "#1fd0b0", "#ff5fd0"];
  return (
    <div className="nov-title" role="img" aria-label="Merge Nova" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="nov-tl1">{[..."MERGE"].map((ch, i) => <span key={`${i}-${hop}`} className="nov-ttile" style={{ ["--c" as string]: cols[i], animationDelay: `${i * 0.08}s, ${1 + i * 0.13}s` }}>{ch}</span>)}</div>
      <div className="nov-tl2">{[..."NOVA"].map((ch, i) => <span key={`${i}-${hop}`} className="nov-ttile" style={{ ["--c" as string]: cols[i + 5], animationDelay: `${0.4 + i * 0.08}s, ${1.2 + i * 0.13}s` }}>{ch}</span>)}</div>
      <div className="mt-2 flex gap-1.5" aria-hidden>{["2", "4", "8", "16", "32", "64"].map((f, i) => <span key={f} className="nov-mini" style={{ background: cols[i], animationDelay: `${i * 0.25}s` }}>{f}</span>)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = useNova();
  const stage = save.stage, sp = galaxyOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const si = Math.floor((stage - 1) / STAGES_PER_GALAXY) % GALAXIES.length;
  const remix = passOf(stage) > 0;
  return (
    <div className="nov-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Stage"], [Star, String(save.totalStars), "Stars"], [Sparkles, save.totalScore.toLocaleString(), "Score"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="nov-panel flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0 text-[var(--trim)]" />
                <span className="min-w-0"><span className="nov-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Merge Nova — drop and merge numbers</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-semibold opacity-90 sm:mx-auto">Drop the numbers, merge the matches, chain the combos — and reach each stage&apos;s goal among the stars!</p>

        <div className="nov-shine relative mt-3 overflow-hidden rounded-[30px] border-2 p-5 text-white shadow-[0_24px_50px_-24px_rgba(0,0,0,.8)]" style={{ borderColor: sp.glow, background: `radial-gradient(80% 90% at 85% 10%, ${sp.glow}55, transparent 60%), linear-gradient(150deg, ${sp.sky[2]}, ${sp.sky[0]})` }}>
          <p className="text-xs font-extrabold tracking-widest text-white/90 uppercase"><Orbit className="mr-1 inline size-4" />{sp.name}{remix ? " · Remix" : ""}</p>
          <p className="nov-display mt-1 text-5xl leading-none drop-shadow">Stage {shown}</p>
          <div className="mt-3 flex gap-1">{Array.from({ length: STAGES_PER_GALAXY }, (_, i) => { const at = (shown - 1) % STAGES_PER_GALAXY; return <span key={i} className={`h-2 flex-1 rounded-full ${i < at ? "bg-white" : i === at ? "animate-pulse bg-[#fff3a0]" : "bg-white/35"}`} />; })}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="nov-btn nov-cta inline-flex items-center gap-2 px-6 py-3 text-lg"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useNova.getState().saveCurrent(null); onPlay(cur.stage); }} className="nov-btn inline-flex items-center gap-1.5 bg-white/20 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="nov-btn nov-cta inline-flex items-center gap-2 px-8 py-3.5 text-xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="nov-display text-[24px] leading-none">The galaxies</h2>
          <span className="text-xs font-bold opacity-60">{STAGES_PER_GALAXY} stages each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GALAXIES.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_GALAXY) > i || remix, now = i === si;
            return (
              <div key={s.id} className={`rounded-2xl border-2 p-3 text-white shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: s.glow, background: `radial-gradient(70% 80% at 90% 0%, ${s.glow}66, transparent 70%), linear-gradient(150deg, ${s.sky[2]}, ${s.sky[0]})` }}>
                <p className="text-[13px] font-extrabold drop-shadow">{s.name}</p>
                <p className="text-[11px] font-bold text-white/85">{now ? `stage ${((stage - 1) % STAGES_PER_GALAXY) + 1} of ${STAGES_PER_GALAXY}` : done ? "★ complete" : `from stage ${i * STAGES_PER_GALAXY + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="nov-panel mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="nov-display text-lg">How it works</p>
          <p>👆 Drop number blocks into five columns. Equal numbers that touch merge and double — 2 → 4 → 8 … → 1K and beyond.</p>
          <p>⛓️ A merge can set off another: chain reactions score big.</p>
          <p>🎯 Every stage has a goal and a number of drops. Asteroids, frozen numbers and big finales join as you travel.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-50">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}

