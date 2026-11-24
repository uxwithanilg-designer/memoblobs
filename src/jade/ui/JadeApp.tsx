"use client";
// Jade Slide — slide mahjong. Tap two identical tiles that see each other along a row or column, or drag a tile
// (pushing the tiles in front of it) until it lines up with its twin. Clear the board; a calm clock races a par time
// for the stars. Stages never end and arrive one by one: 500 designed stages across eight tea houses (each with its
// own felt and music, closed by a finale), then endless remixes. Phone-app flow: home → stage → clear → next stage.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Lightbulb, Play, RotateCcw, Shuffle, Sparkles, Star, Timer, Undo2, X, Landmark, ArrowLeft } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { tilesLeft } from "../grid";
import { DESIGNED, HOUSES, STAGES_PER_HOUSE, passOf, houseOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { dragMove, hint, newGame, shuffleGame, starsOf, tapPair, type Game } from "../play";
import { useJade, useJadeHydrated } from "../save";
import { JadeBoard, type BoardSound } from "./Board";
import { JADE_CSS } from "./styles";

export const JADE_SFX = ["pick", "match", "combo", "nope", "slide", "shuffle", "hint", "undo", "clear", "star", "house", "stuck", "open", "confetti"] as const;
type Sfx = (typeof JADE_SFX)[number];
const sfxName = (k: Sfx) => `a:jade_${k}` as Sound;
const music = (k: string) => `a:jade_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const fmt = (s: number) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const TIPS: Record<string, [string, string]> = {
  slide: ["Slide to match", "Drag a tile along its row or column — it pushes the tiles in front of it. Let go where it lines up with its twin and the pair clears; if not, it springs back."],
  shape: ["New shapes", "Boards now come in shapes with gaps. Tiles slide only over empty cells inside the board."],
  boss: ["Tea house finale", "The last stage of every tea house is its finale: a bigger board with a bigger reward."],
  remix: ["Endless tea houses", "You've finished all 500 designed stages! From here every stage is a fresh remix — new shapes and mixes, forever."],
};

interface Result { stage: number; stars: number; coins: number; score: number; houseDone: boolean; gift: string; secs: number }
interface Float { id: number; x: number; y: number; text: string; big: boolean }

export default function JadeApp({ slug }: { slug: string; title: string }) {
  const ready = useJadeHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useJade((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [left, setLeft] = useState(0);
  const [revived, setRevived] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "stuck" | "help" | "tip">("");
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [toast, setToast] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const boardRef = useRef<JadeBoard | null>(null);
  const hist = useRef<Game[]>([]);
  const helped = useRef(false);
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  const applyPending = useCallback(() => { const b = boardRef.current, p = pendingRef.current; if (!b || !p) return; pendingRef.current = null; b.setStage(p.g, houseOf(p.d.stage), p.d.stage); }, []);
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
    loadRef.current(0.3, "Setting the tiles");
    void audio.preload(JADE_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(houseOf(useJade.getState().stage).music)]);
    prepareStage(useJade.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.18, duck: k === "clear" || k === "house" });
  }, []);
  const addFloat = useCallback((x: number, y: number, text: string, big = false) => {
    const id = Math.random();
    setFloats((f) => [...f.slice(-6), { id, x, y, text, big }]);
    setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 1100);
  }, []);
  const persist = useCallback((g: Game) => {
    const d = defRef.current; if (!d) return;
    useJade.getState().saveCurrent({ stage: d.stage, game: g, revived: stateRef.current.revived });
  }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback((g: Game) => {
    const d = defRef.current!;
    const st = stateRef.current;
    const stars = starsOf(st.left, d.par, helped.current);
    const total = g.score + Math.max(0, Math.round((d.par - st.left) * 10)) + (d.boss ? 500 : 0);
    const coins = 5 + Math.round(d.pairs / 3) + stars * 3 + (d.boss ? 20 : 0);
    useProfile.getState().earnCoins(coins);
    useJade.getState().win(d.stage, stars, total);
    useJade.getState().saveCurrent(null);
    let gift = "";
    if (d.boss) { useJade.getState().giveBooster("hint", 2); useJade.getState().giveBooster("shuffle", 1); useJade.getState().giveBooster("undo", 3); gift = "+2 Hints · +1 Shuffle · +3 Undo"; }
    else if (d.stage % 10 === 0) { useJade.getState().giveBooster("hint", 1); gift = "+1 Hint"; }
    const houseDone = d.stage % STAGES_PER_HOUSE === 0;
    setResult({ stage: d.stage, stars, coins, score: total, houseDone, gift, secs: st.left });
    sfx(houseDone ? "house" : "clear", { gain: 0.8 });
    for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    track("jade_clear", { stage: d.stage, stars });
  }, [sfx]);

  // ---------------------------------------------------------------- board
  const after = useCallback((g0: Game, out: { game: Game; res: { combo: number; win: boolean; stuck: boolean } }) => {
    hist.current = [...hist.current, g0].slice(-40);
    setGame(out.game); gameRef.current = out.game;
    buzz(12);
    if (out.res.combo > 1) sfx("combo", { gain: 0.45, rate: Math.min(1.6, 0.9 + out.res.combo * 0.08), delay: 0.2 });
    if (out.res.win) setTimeout(() => finishStage(out.game), 900);
    else { persist(out.game); if (out.res.stuck) setTimeout(() => { setSheet("stuck"); sfx("stuck", { gain: 0.5 }); }, 700); }
  }, [sfx, finishStage, persist]);
  const pairRef = useRef<(a: number, b: number) => ReturnType<typeof tapPair>>(() => null);
  const dragRef = useRef<(f: number, d: number, k: number) => ReturnType<typeof dragMove>>(() => null);
  const doPair = useCallback((a: number, b: number) => {
    const g0 = gameRef.current, st = stateRef.current;
    if (!g0 || st.result || st.sheet || st.paused) return null;
    const out = tapPair(g0, a, b, performance.now()); if (!out) return null;
    after(g0, out); return out;
  }, [after]);
  const doDrag = useCallback((f: number, d: number, k: number) => {
    const g0 = gameRef.current, st = stateRef.current;
    if (!g0 || st.result || st.sheet || st.paused) return null;
    const out = dragMove(g0, f, d, k, performance.now()); if (!out) return null;
    after(g0, out); return out;
  }, [after]);
  useEffect(() => { pairRef.current = doPair; dragRef.current = doDrag; }, [doPair, doDrag]);
  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const board = new JadeBoard(host.current, {
      pair: (a, b) => pairRef.current(a, b),
      drag: (f, d, k) => dragRef.current(f, d, k),
      canPlay: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused; },
      sound: (e: BoardSound, pan: number, n = 0) => {
        if (e === "match") sfx("match", { x: pan, gain: 0.6, rate: Math.min(1.5, 1 + (n - 1) * 0.05) });
        else if (e === "pick") sfx("pick", { x: pan, gain: 0.45, rate: 0.95 + Math.random() * 0.1 });
        else if (e === "nope") { sfx("nope", { x: pan, gain: 0.45 }); buzz(25); }
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
    setLeft(resume ? Math.round(d.par * (1 - tilesLeft(g.board) / (d.pairs * 2))) : 0); setRevived(resume?.revived ?? false);
    hist.current = []; helped.current = !!resume?.revived;
    setScreen("game");
    const sp = houseOf(stage);
    void audio.playMusic(music(sp.music));
    audio.warmMusic([music(houseOf(stage + STAGES_PER_HOUSE).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = useJade.getState().tips;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, slide: d.slides > 0, shape: d.board.c.includes(-1), boss: d.boss };
    const tip = ["remix", "slide", "shape", "boss"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useJade.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); }
    track("jade_start", { stage });
  }, [sfx, applyPending]);

  // ---------------------------------------------------------------- the clock
  const running = screen === "game" && !!game && !result && !sheet && !paused && !loadingStage;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => l + 0.25), 250);
    return () => clearInterval(t);
  }, [running]);

  // ---------------------------------------------------------------- boosters
  const doHint = () => {
    const g = gameRef.current; if (!g || result) return;
    const h = hint(g); if (!h) { setSheet("stuck"); return; }
    if (!useJade.getState().useBooster("hint")) { setToast("No hints left — win stages to earn more"); return; }
    helped.current = true;
    boardRef.current?.showHint(h);
  };
  const doUndo = () => {
    const prev = hist.current[hist.current.length - 1];
    if (!prev || result) { setToast("Nothing to undo"); return; }
    if (!useJade.getState().useBooster("undo")) { setToast("No undos left"); return; }
    hist.current = hist.current.slice(0, -1);
    setGame(prev); gameRef.current = prev; boardRef.current?.sync(prev); setSheet(""); persist(prev);
    sfx("undo", { gain: 0.5 });
  };
  const doShuffle = (free = false) => {
    const g0 = gameRef.current; if (!g0 || result) return;
    if (!free && !useJade.getState().useBooster("shuffle")) { setToast("No shuffles left"); return; }
    const { game: g, map } = shuffleGame(g0, Math.random);
    hist.current = [];
    setGame(g); gameRef.current = g; boardRef.current?.sync(g); void boardRef.current?.reshuffle(map); setSheet(""); persist(g);
  };
  const doRestart = () => { const d = defRef.current; if (!d) return; useJade.getState().saveCurrent(null); void start(d.stage); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __jade?: unknown }).__jade = {
      game: () => gameRef.current, def: () => defRef.current, start: (stage: number) => void start(stage),
      hint: () => { const g = gameRef.current; return g ? hint(g) : null; },
      tap: (i: number) => boardRef.current?.tap(i),
      drag: (f: number, d: number, k: number) => boardRef.current?.dragTo(f, d, k),
      cell: (i: number) => { const b = boardRef.current, r = host.current?.getBoundingClientRect(); if (!b || !r) return null; const p = b.cellScreen(i); return { x: r.left + p.x, y: r.top + p.y }; },
    };
  }, [start]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const sp = houseOf(screen === "game" ? stage : useJade.getState().stage);
  const night = true;
  const inS = ((stage - 1) % STAGES_PER_HOUSE) + 1;
  const done = game && def ? 1 - tilesLeft(game.board) / (def.pairs * 2) : 0;
  return (
    <div className={`jad-root ${night ? "jad-night" : ""}`} style={{ ["--s1" as string]: sp.felt[0], ["--s2" as string]: sp.felt[1], ["--s3" as string]: sp.felt[1], ["--trim" as string]: sp.trim }}>
      <style>{JADE_CSS}</style>
      <div className="jad-waves" aria-hidden />

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-center gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="jad-panel grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="jad-panel min-w-0 flex-1 !rounded-2xl px-3 py-1">
              <p className="jad-display truncate text-lg leading-tight">Stage {stage}{def?.boss && <span className="ml-2 rounded-full bg-[#c8202a] px-2 py-0.5 align-middle font-sans text-[10px] font-extrabold tracking-wider text-white uppercase">Finale</span>}</p>
              <p className="truncate text-[11px] font-bold opacity-75">{sp.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_HOUSE}</p>
            </div>
            <div className={`jad-panel jad-time flex flex-col items-center !rounded-2xl px-3 py-1 font-extrabold leading-none ${def && left > def.par ? "opacity-70" : ""}`}><span className="flex items-center gap-1"><Timer className="size-4" />{fmt(left)}</span><span className="mt-0.5 text-[9px] tracking-wider uppercase opacity-70">par {fmt(def?.par ?? 0)}</span></div>
          </div>
          <div className="mx-4 mt-0.5 flex items-center gap-2">
            <div className="jad-bar flex-1"><b style={{ width: `${done * 100}%` }} /></div>
            <span className="jad-panel jad-display !rounded-full px-3 py-0.5 text-lg tabular-nums">{(game?.score ?? 0).toLocaleString()}</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="jad-stage" />
            {floats.map((f) => <span key={f.id} className={`jad-float ${f.big ? "jad-float-big" : ""}`} style={{ left: f.x, top: f.y }}>{f.text}</span>)}
          </div>
          <div className="flex items-end justify-center gap-3 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Lightbulb} label="Hint" n={boosters.hint} onClick={doHint} />
            <Tool icon={Undo2} label="Undo" n={boosters.undo} onClick={doUndo} />
            <Tool icon={Shuffle} label="Shuffle" n={boosters.shuffle} onClick={() => doShuffle()} />
            <Tool icon={RotateCcw} label="Restart" onClick={doRestart} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/15 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/40 border-t-[#e8c25a]" /><p className="jad-display text-lg text-white drop-shadow">Setting the tiles…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "stuck" && !result && (
          <Sheet key="stuck" title="No moves left" onClose={() => setSheet("")}>
            <p className="opacity-85">No pair can be tapped or slid together. Step back, or shuffle the tiles — free this time.</p>
            <div className="mt-4 grid gap-2">
              {<button type="button" className="jad-btn jad-cta py-3" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Undo ({boosters.undo})</button>}
              <button type="button" className="jad-btn jad-soft py-3" onClick={() => doShuffle(true)}><Shuffle className="mr-1 inline size-5" /> Shuffle (free)</button>
              <button type="button" className="jad-btn jad-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Restart stage</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useJade.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>🀄 Tap two identical tiles that see each other along a row or column — side by side, or with only empty space between.</li>
              <li>↔️ Or drag a tile along its row or column: it pushes the tiles in front of it. Let go where it lines up with its twin to clear them.</li>
              <li>⏱️ Clear the board. Beat the par time for three stars.</li>
              <li>💡 Hint, Undo and Shuffle help — and when you&apos;re stuck, a shuffle is free.</li>
            </ul>
            <button type="button" className="jad-btn jad-cta mt-5 w-full py-3" onClick={() => { useJade.getState().sawHelp(); setSheet(""); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useJade.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="jad-btn jad-cta mt-5 w-full py-3" onClick={() => { useJade.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
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
    <button type="button" className="jad-tool" onClick={onClick}>
      <span className="jad-tool-ico"><Icon className="size-5" />{n !== undefined && <span className="jad-badge">{n}</span>}</span>{label}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="jad-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="jad-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-black/10"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClearSheet({ r, onNext, onHome }: { r: Result; onNext: () => void; onHome: () => void }) {
  const [left, setLeft] = useState(r.houseDone ? 6 : 4);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, onNext]);
  const s = houseOf(r.stage), ns = houseOf(r.stage + 1);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/35 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="jad-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="jad-head px-5 pt-6 pb-5">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="jad-display mt-1 text-4xl text-white">{r.houseDone ? "Tea house complete!" : `Stage ${r.stage} clear!`}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{r.houseDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_HOUSE) + 1} of ${STAGES_PER_HOUSE} · ${fmt(r.secs)}`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="jad-display text-5xl text-[#1f7a4a]">{r.score.toLocaleString()}</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/40 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="jad-btn jad-cta jad-shine flex items-center justify-center gap-2 py-3" onClick={onNext}>Stage {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="jad-btn jad-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  const faces = ["中", "發", "東", "南", "西", "北"];
  return (
    <div className="jad-title" role="img" aria-label="Jade Slide" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="jad-tl1">{[..."JADE"].map((ch, i) => <span key={`${i}-${hop}`} className="jad-ttile" style={{ ["--c" as string]: i % 2 ? "#c8202a" : "#1f7a4a", animationDelay: `${i * 0.08}s, ${1 + i * 0.13}s` }}>{ch}</span>)}</div>
      <div className="jad-tl2">{[..."SLIDE"].map((ch, i) => <span key={`${i}-${hop}`} className="jad-ttile" style={{ ["--c" as string]: i % 2 ? "#1f5fbf" : "#c8202a", animationDelay: `${0.35 + i * 0.08}s, ${1.2 + i * 0.13}s` }}>{ch}</span>)}</div>
      <div className="mt-2 flex gap-1.5" aria-hidden>{faces.map((f, i) => <span key={f} className="jad-mini" style={{ color: i === 0 ? "#c8202a" : i === 1 ? "#1f8a3a" : "#1a1a2a", animationDelay: `${i * 0.25}s` }}>{f}</span>)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = useJade();
  const stage = save.stage, sp = houseOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const si = Math.floor((stage - 1) / STAGES_PER_HOUSE) % HOUSES.length;
  const remix = passOf(stage) > 0;
  return (
    <div className="jad-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Stage"], [Star, String(save.totalStars), "Stars"], [Sparkles, save.totalScore.toLocaleString(), "Score"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="jad-panel flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0 text-[var(--trim)]" />
                <span className="min-w-0"><span className="jad-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Jade Slide — slide mahjong tile match</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-semibold opacity-90 sm:mx-auto">Tap or slide mahjong tiles into line with their twins and clear the board — calm, clever and endless.</p>

        <div className="jad-shine relative mt-3 overflow-hidden rounded-[30px] border-2 p-5 text-white shadow-[0_24px_50px_-24px_rgba(0,0,0,.8)]" style={{ borderColor: sp.trim, background: `linear-gradient(150deg, ${sp.felt[0]}, ${sp.felt[1]})` }}>
          <p className="text-xs font-extrabold tracking-widest text-white/90 uppercase"><Landmark className="mr-1 inline size-4" />{sp.name}{remix ? " · Remix" : ""}</p>
          <p className="jad-display mt-1 text-5xl leading-none drop-shadow">Stage {shown}</p>
          <div className="mt-3 flex gap-1">{Array.from({ length: STAGES_PER_HOUSE }, (_, i) => { const at = (shown - 1) % STAGES_PER_HOUSE; return <span key={i} className={`h-2 flex-1 rounded-full ${i < at ? "bg-white" : i === at ? "animate-pulse bg-[#fff3a0]" : "bg-white/35"}`} />; })}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="jad-btn jad-cta inline-flex items-center gap-2 px-6 py-3 text-lg"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useJade.getState().saveCurrent(null); onPlay(cur.stage); }} className="jad-btn inline-flex items-center gap-1.5 bg-white/20 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="jad-btn jad-cta inline-flex items-center gap-2 px-8 py-3.5 text-xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="jad-display text-[24px] leading-none">The tea houses</h2>
          <span className="text-xs font-bold opacity-60">{STAGES_PER_HOUSE} stages each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HOUSES.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_HOUSE) > i || remix, now = i === si;
            return (
              <div key={s.id} className={`rounded-2xl border-2 p-3 text-white shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: s.trim, background: `linear-gradient(150deg, ${s.felt[0]}, ${s.felt[1]})` }}>
                <p className="text-[13px] font-extrabold drop-shadow">{s.name}</p>
                <p className="text-[11px] font-bold text-white/85">{now ? `stage ${((stage - 1) % STAGES_PER_HOUSE) + 1} of ${STAGES_PER_HOUSE}` : done ? "★ complete" : `from stage ${i * STAGES_PER_HOUSE + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="jad-panel mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="jad-display text-lg">How it works</p>
          <p>🀄 Tap two identical tiles that see each other in a row or column — nothing but empty space between.</p>
          <p>↔️ Drag a tile along its row or column to push it (and the tiles in front of it) into line with its twin.</p>
          <p>⏱️ Clear the board; beat the par time for three stars. Hint, Undo and Shuffle help when you need them.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-50">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}

