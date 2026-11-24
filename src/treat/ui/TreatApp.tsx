"use client";
// Treatrio — a 3D dessert-shop sorting puzzle. Drag (or tap, then tap a box) a treat from a front row into another
// box; three alike in a front row pop, the row behind slides forward. Stages never end and arrive one by one; every
// ten make a shop (Sunrise Bakery, Candy Corner, …) with its own colours and music, closed by a boss stage. A soft
// clock gives the stars; run out and you get one free +30 s. Phone-app flow: home → stage → clear → next stage.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronRight, Lightbulb, Play, RotateCcw, Shuffle, Sparkles, Star, Store, Timer, Undo2, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { STAGES_PER_ZONE, ZONES, loopOf, zoneOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { canPick, cloneGame, freeSlots, hasMove, hint, moveTreat, settleGame, shuffleFronts, startGame, treatsLeft, type Game } from "../play";
import { useTreat, useTreatHydrated } from "../save";
import { TreatScene } from "./Scene";
import { TREAT_CSS } from "./styles";
import { ITEMS } from "../items";
import { Title3D } from "./Title3D";

export const TREAT_SFX = ["pick", "drop", "nope", "pop", "combo", "slide", "unwrap", "ice", "unlock", "undo", "hint", "shuffle", "tick", "clear", "star", "shop", "timeup", "open"] as const;
type Sfx = (typeof TREAT_SFX)[number];
const sfxName = (k: Sfx) => `a:treat_${k}` as Sound;
const music = (k: string) => `a:treat_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const fmt = (s: number) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const BOOST = { undo: 3, hint: 3, shuffle: 1 };
const TIPS: Record<string, [string, string]> = {
  mystery: ["Mystery treats", "Some treats wait gift-wrapped in the back rows. They unwrap when they reach the front."],
  lock: ["Locked box", "A frosted box with a padlock opens after enough pops — the number shows how many more."],
  ice: ["Frozen treats", "A treat in ice can't be moved until enough pops have happened, but it still pops in place with two of its kind."],
  boss: ["Boss stage", "The last stage of every shop is its boss: the busiest shelf of the ten, with a bigger reward."],
  picky: ["Picky box", "A box with a sign takes only the treat on its sign. Move the other treats out of it, then fill it up."],
  hurry: ["Hurry treats", "A treat with a stopwatch must pop before its moves run out — or it melts and the stage is lost."],
  recipe: ["Recipe lock", "This box opens once the treat floating in front of it has been popped somewhere on the shelf."],
  tight: ["Tight shelves", "From here on the shelves have fewer free spots. Plan a few moves ahead!"],
};

interface Result { stage: number; stars: number; coins: number; score: number; zoneDone: boolean }
interface Float { id: number; x: number; y: number; text: string; big: boolean }

export default function TreatApp({ slug }: { slug: string; title: string }) {
  const ready = useTreatHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [left, setLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [boost, setBoost] = useState({ ...BOOST });
  const [revived, setRevived] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "stuck" | "time" | "help" | "tip" | "melted">("");
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [toast, setToast] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TreatScene | null>(null);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null), hist = useRef<Game[]>([]);
  const stateRef = useRef({ left: 0, score: 0, revived: false, result: false, sheet: "", paused: false });
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { left, score, revived, result: !!result, sheet, paused }; }, [left, score, revived, result, sheet, paused]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Stocking the shelves");
    void audio.preload(TREAT_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(zoneOf(useTreat.getState().stage).music)]);
    prepareStage(useTreat.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.2, duck: k === "clear" || k === "shop" });
  }, []);
  /** pan from a box's column */
  const panBox = (b: number) => { const d = defRef.current; if (!d) return 0; const c = Math.min(d.cols, d.boxes.length); return c > 1 ? ((b % c) / (c - 1)) * 1.4 - 0.7 : 0; };

  const addFloat = useCallback((x: number, y: number, text: string, big = false) => {
    const id = Math.random();
    setFloats((f) => [...f.slice(-6), { id, x, y, text, big }]);
    setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 1100);
  }, []);

  const persist = useCallback((g: Game) => {
    const d = defRef.current; if (!d) return;
    const st = stateRef.current;
    useTreat.getState().saveCurrent({ stage: d.stage, game: g, history: hist.current.slice(-10), left: st.left, score: st.score, revived: st.revived });
  }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback((g: Game) => {
    const d = defRef.current!;
    const st = stateRef.current;
    const frac = st.left / d.seconds;
    const stars = st.revived ? 1 : frac >= 0.45 ? 3 : frac >= 0.2 ? 2 : 1;
    const timeBonus = Math.round(st.left * 10);
    const total = st.score + timeBonus + (d.boss ? 500 : 0);
    const coins = 5 + Math.round(g.total / 6) + stars * 3 + (d.boss ? 20 : 0);
    useProfile.getState().earnCoins(coins);
    useTreat.getState().win(d.stage, stars, total);
    const zoneDone = d.stage % STAGES_PER_ZONE === 0;
    sceneRef.current?.celebrate();
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, score: total, zoneDone });
      sfx(zoneDone ? "shop" : "clear", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 700);
    track("treat_clear", { stage: d.stage, moves: g.moves, stars });
  }, [sfx]);

  // ---------------------------------------------------------------- a move (from the scene)
  const tryMove = useCallback((from: number, slot: number, to: number, nearX: number) => {
    const g0 = gameRef.current, scene = sceneRef.current;
    const st = stateRef.current;
    if (!g0 || !scene || st.result || st.sheet || st.paused) return null;
    const tt = g0.boxes[from].rows[0][slot]?.t ?? 0;
    if (tt && g0.boxes[to].only && g0.boxes[to].only !== tt) { setToast(`This box only takes ${ITEMS[g0.boxes[to].only - 1]?.name ?? "one treat"}s`); return null; }
    const free = freeSlots(g0, to, tt);
    if (!free.length || !canPick(g0, from, slot)) return null;
    // the free spot nearest where the treat was dropped
    const centre = scene.boxScreen(to).x, dx = nearX - centre;
    const at = free.sort((a, b) => Math.abs((a - 1) * 40 - dx) - Math.abs((b - 1) * 40 - dx))[0];
    hist.current = [...hist.current, cloneGame(g0)].slice(-30);
    const g = cloneGame(g0);
    const movedId = g.boxes[from].rows[0][slot]!.id;
    const res = moveTreat(g, from, slot, to, at);
    scene.sync(g, res, false, movedId);
    setGame(g);
    sfx("drop", { x: panBox(to), gain: 0.5, rate: 0.95 + Math.random() * 0.1 });
    buzz(10);
    let gained = 0;
    res.popped.forEach((p, k) => {
      const pts = Math.round(100 * (1 + (g.combo - res.popped.length + k) * 0.5));
      gained += pts;
      const s = scene.boxScreen(p.box);
      setTimeout(() => {
        sfx("pop", { x: panBox(p.box), gain: 0.7, rate: Math.min(1.5, 1 + (g.combo - 1) * 0.07) });
        addFloat(s.x, s.y - 30, `+${pts}`);
        if (g.combo > 1) { addFloat(s.x, s.y - 70, `Combo ×${g.combo}`, true); sfx("combo", { gain: 0.5, rate: Math.min(1.6, 0.9 + g.combo * 0.08) }); }
        buzz(25);
      }, 300 + k * 120);
    });
    if (res.advanced.length) setTimeout(() => sfx("slide", { x: panBox(res.advanced[0]), gain: 0.45 }), 520);
    if (res.unlocked.length) { setTimeout(() => { sfx("unlock", { gain: 0.6 }); setToast("A box opened!"); }, 450); }
    if (res.thawed.length) setTimeout(() => sfx("ice", { gain: 0.55 }), 420);
    if (defRef.current?.mystery && res.advanced.length) setTimeout(() => sfx("unwrap", { gain: 0.45 }), 700);
    if (gained) setScore((s) => s + gained);
    if (res.melted.length && !res.cleared) {
      scene.melt(res.melted);
      setTimeout(() => { setSheet("melted"); sfx("timeup", { gain: 0.6 }); buzz(60); }, 650);
      persist(g);
    } else if (res.cleared) { useTreat.getState().saveCurrent(null); finishStage(g); }
    else {
      persist(g);
      if (!hasMove(g)) setTimeout(() => { setSheet("stuck"); sfx("timeup", { gain: 0.4 }); }, 700);
    }
    return { at, res };
  }, [sfx, addFloat, finishStage, persist]);

  // ---------------------------------------------------------------- scene
  const tryMoveRef = useRef(tryMove);
  useEffect(() => { tryMoveRef.current = tryMove; }, [tryMove]);
  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const scene = new TreatScene(host.current, {
      canPick: (b, s) => { const g = gameRef.current; return !!g && canPick(g, b, s) && !stateRef.current.result && !stateRef.current.sheet; },
      tryMove: (f, s, t, x) => tryMoveRef.current(f, s, t, x),
      onPick: (b) => sfx("pick", { x: panBox(b), gain: 0.4, rate: 1.05 }),
      onNope: (b) => { sfx("nope", { x: panBox(b), gain: 0.4 }); buzz(30); },
    });
    sceneRef.current = scene;
    return () => { scene.dispose(); sceneRef.current = null; };
  }, [screen, sfx]);

  // ---------------------------------------------------------------- stages
  const start = useCallback(async (stage: number, resume?: { game: Game; history: Game[]; left: number; score: number; revived: boolean }) => {
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const g = resume?.game ?? startGame(d);
    hist.current = resume?.history ?? [];
    setDef(d); setGame(g); setResult(null); setSheet(""); setBoost({ ...BOOST });
    setLeft(resume?.left ?? d.seconds); setScore(resume?.score ?? 0); setRevived(resume?.revived ?? false);
    setScreen("game");
    const z = zoneOf(stage);
    void audio.playMusic(music(z.music));
    audio.warmMusic([music(zoneOf(stage + STAGES_PER_ZONE).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    // the scene appears after this render: give it the stage then
    requestAnimationFrame(() => sceneRef.current?.setStage(g, { mystery: d.mystery, cols: d.cols, wood: z.wood, trim: z.trim, glow: z.glow }));
    const tips = useTreat.getState().tips;
    const has: Record<string, boolean> = {
      picky: d.boxes.some((b) => b.only), hurry: (d.bombs ?? []).length > 0, recipe: d.boxes.some((b) => b.key), tight: stage >= 71,
      lock: d.boxes.some((b) => b.lock), ice: d.boxes.some((b) => b.rows.flat().some((v) => v >= 1000)), mystery: d.mystery, boss: d.boss,
    };
    const tip = !useTreat.getState().seenHelp ? "" : (["picky", "hurry", "recipe", "tight", "lock", "ice", "mystery", "boss"].find((k) => has[k] && !tips.includes(k)) ?? "");
    if (!useTreat.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); }
    track("treat_start", { stage });
  }, [sfx]);

  // ---------------------------------------------------------------- the clock
  const running = screen === "game" && !!game && !result && !sheet && !paused && !loadingStage;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((l) => {
        const n = Math.max(0, l - 0.25);
        if (Math.ceil(n) !== Math.ceil(l) && n <= 10 && n > 0) sfx("tick", { gain: 0.35, rate: n <= 5 ? 1.2 : 1 });
        if (n <= 0 && l > 0) setTimeout(() => { setSheet("time"); sfx("timeup", { gain: 0.6 }); }, 0);
        return n;
      });
    }, 250);
    return () => clearInterval(t);
  }, [running, sfx]);

  // ---------------------------------------------------------------- boosters
  const doUndo = () => {
    const prev = hist.current[hist.current.length - 1];
    if (!prev || result) { setToast("Nothing to undo"); return; }
    if (boost.undo <= 0) { setToast("No undo left on this stage"); return; }
    hist.current = hist.current.slice(0, -1);
    setBoost((b) => ({ ...b, undo: b.undo - 1 }));
    setGame(prev); sceneRef.current?.sync(prev, null); setSheet(""); persist(prev);
    sfx("undo", { gain: 0.5 });
  };
  const doHint = () => {
    const g = gameRef.current; if (!g || result) return;
    if (boost.hint <= 0) { setToast("No hints left on this stage"); return; }
    const h = hint(g);
    if (!h) { setToast("No move to suggest"); return; }
    setBoost((b) => ({ ...b, hint: b.hint - 1 }));
    sceneRef.current?.hint(h.from, h.slot, h.to);
    sfx("hint", { gain: 0.55 });
  };
  const doShuffle = () => {
    const g0 = gameRef.current; if (!g0 || result) return;
    if (boost.shuffle <= 0) { setToast("One shuffle per stage"); return; }
    hist.current = [...hist.current, cloneGame(g0)].slice(-30);
    const g = cloneGame(g0);
    shuffleFronts(g, Math.random);
    const s = settleGame(g);
    setBoost((b) => ({ ...b, shuffle: b.shuffle - 1 }));
    sceneRef.current?.sync(g, { popped: s.popped, advanced: s.advanced, unlocked: [], thawed: [], cleared: false, melted: [] });
    setGame(g); setSheet(""); persist(g);
    sfx("shuffle", { gain: 0.6 });
    if (treatsLeft(g) === 0) finishStage(g);
  };
  const doRestart = () => { const d = defRef.current; if (!d) return; useTreat.getState().saveCurrent(null); void start(d.stage); };
  const doRevive = () => { setRevived(true); setLeft(30); setSheet(""); sfx("unlock", { gain: 0.5 }); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __treat?: unknown }).__treat = {
      game: () => gameRef.current, def: () => defRef.current,
      start: (stage: number) => void start(stage),
      move: (f: number, s: number, t: number) => tryMoveRef.current(f, s, t, sceneRef.current?.boxScreen(t).x ?? 0),
      screen: (b: number, s: number) => { const sc = sceneRef.current; const r = host.current?.getBoundingClientRect(); if (!sc || !r) return null; const p = sc.itemScreen(b, s); return { x: r.left + p.x, y: r.top + p.y }; },
      boxScreen: (b: number) => { const sc = sceneRef.current; const r = host.current?.getBoundingClientRect(); if (!sc || !r) return null; const p = sc.boxScreen(b); return { x: r.left + p.x, y: r.top + p.y }; },
      hint: () => { const g = gameRef.current; return g ? hint(g) : null; },
      time: (sec: number) => setLeft(sec),
    };
  }, [start]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const zone = zoneOf(screen === "game" ? stage : useTreat.getState().stage);
  const done = game ? 1 - treatsLeft(game) / Math.max(1, game.total) : 0;
  return (
    <div className="trt-root" style={{ ["--s1" as string]: zone.sky[0], ["--s2" as string]: zone.sky[1], ["--s3" as string]: zone.sky[2], ["--glow" as string]: zone.glow, ["--wood" as string]: zone.wood }}>
      <style>{TREAT_CSS}</style>
      {screen === "home" && <div className="trt-home-bg" aria-hidden />}
      <div className="trt-sprinkles" aria-hidden>{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ left: `${(i * 47) % 100}%`, background: ["#ff5fa8", "#ffc23d", "#3fa2f5", "#7edc4a", "#9a6bff", "#ffffff"][i % 6], animationDuration: `${11 + (i % 7) * 2.3}s`, animationDelay: `${-((i * 1.9) % 14)}s`, ["--r" as string]: `${(i * 67) % 180}deg` }} />)}</div>
      {screen === "home" && <div className="trt-cream" aria-hidden />}
      <div className={`trt-awning ${screen === "game" ? "trt-awning-thin" : ""}`} aria-hidden />
      <div className="trt-lights" aria-hidden>{Array.from({ length: 10 }, (_, i) => <b key={i} style={{ left: `${5 + i * 10}%`, animationDelay: `${i * 0.3}s` }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-center gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+12px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="trt-glass grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="trt-glass min-w-0 flex-1 !rounded-2xl px-3 py-1">
              <p className="trt-display truncate text-lg leading-tight">Stage {stage}{def?.boss && <span className="ml-2 rounded-full bg-[#ff4f6a] px-2 py-0.5 align-middle font-sans text-[10px] font-extrabold tracking-wider text-white uppercase">Boss</span>}</p>
              <p className="truncate text-[11px] font-bold text-[#5a2a3a]/80">{zone.name}{loopOf(stage) ? ` · Round ${loopOf(stage) + 1}` : ""} · {((stage - 1) % STAGES_PER_ZONE) + 1}/10</p>
            </div>
            <div className={`trt-glass flex items-center gap-1 !rounded-2xl px-3 py-1.5 font-extrabold tabular-nums ${left <= 10 ? "text-[#e0283a]" : ""}`}><Timer className="size-4" />{fmt(left)}</div>
          </div>
          <div className="mx-4 mt-1 flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/50"><div className="h-full rounded-full bg-gradient-to-r from-[#ff6fb5] to-[#ffb52e] transition-[width] duration-500" style={{ width: `${done * 100}%` }} /></div>
            <span className="trt-glass trt-display !rounded-full px-3 py-0.5 text-lg tabular-nums">{score.toLocaleString()}</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="trt-stage" />
            {floats.map((f) => <span key={f.id} className={`trt-float ${f.big ? "trt-float-big" : ""}`} style={{ left: f.x, top: f.y }}>{f.text}</span>)}
          </div>
          <div className="flex justify-center gap-4 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),12px)]">
            <Tool icon={Undo2} label="Undo" n={boost.undo} onClick={doUndo} />
            <Tool icon={Lightbulb} label="Hint" n={boost.hint} onClick={doHint} />
            <Tool icon={Shuffle} label="Shuffle" n={boost.shuffle} onClick={doShuffle} />
            <Tool icon={RotateCcw} label="Restart" onClick={doRestart} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/20 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/40 border-t-[#ff6fb5]" /><p className="trt-display text-lg text-white drop-shadow">Stocking the shelves…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "stuck" && !result && (
          <Sheet key="stuck" title="No room to move" onClose={() => setSheet("")}>
            <p className="text-[#5a2a3a]/80">Every box is full. Step back, shuffle the front rows, or start the stage again.</p>
            <div className="mt-4 grid gap-2">
              {boost.undo > 0 && <button type="button" className="trt-btn trt-cta py-3" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Undo ({boost.undo})</button>}
              {boost.shuffle > 0 && <button type="button" className="trt-btn trt-soft py-3" onClick={doShuffle}><Shuffle className="mr-1 inline size-5" /> Shuffle</button>}
              <button type="button" className="trt-btn trt-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Restart stage</button>
            </div>
          </Sheet>
        )}
        {sheet === "time" && !result && (
          <Sheet key="time" title="Time's up!" onClose={() => undefined}>
            <p className="text-[#5a2a3a]/80">So close! {revived ? "Try the stage again." : "Take 30 more seconds — free, once per stage."}</p>
            <div className="mt-4 grid gap-2">
              {!revived && <button type="button" className="trt-btn trt-cta trt-shine py-3" onClick={doRevive}><Timer className="mr-1 inline size-5" /> +30 seconds</button>}
              <button type="button" className="trt-btn trt-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "melted" && !result && (
          <Sheet key="melted" title="A treat melted!" onClose={() => undefined}>
            <p className="text-[#5a2a3a]/80">A hurry treat ran out of moves before it popped. Step back and pop it sooner, or start the stage again.</p>
            <div className="mt-4 grid gap-2">
              {boost.undo > 0 && <button type="button" className="trt-btn trt-cta py-3" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Undo ({boost.undo})</button>}
              <button type="button" className="trt-btn trt-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useTreat.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px] text-[#5a2a3a]">
              <li>🍩 Drag a treat from a box&apos;s front row into another box — or tap it, then tap a box.</li>
              <li>✨ Three of the same in a front row pop!</li>
              <li>📦 When a front row empties, the row behind slides forward.</li>
              <li>⏱️ Clear every treat before the clock runs out for three stars.</li>
            </ul>
            <button type="button" className="trt-btn trt-cta mt-5 w-full py-3" onClick={() => { useTreat.getState().sawHelp(); setSheet(""); }}>Open the shop</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useTreat.getState().sawTip(tipKey); setSheet(""); }}>
            <p className="text-[#5a2a3a]">{TIPS[tipKey][1]}</p>
            <button type="button" className="trt-btn trt-cta mt-5 w-full py-3" onClick={() => { useTreat.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#5a2a3a] px-4 py-2 text-sm font-bold whitespace-nowrap text-white shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label, n, onClick }: { icon: typeof Undo2; label: string; n?: number; onClick: () => void }) {
  return (
    <button type="button" className="trt-tool" onClick={onClick}>
      <span className="trt-tool-ico"><Icon className="size-5" />{n !== undefined && <span className="trt-badge">{n}</span>}</span>{label}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="trt-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="trt-display text-2xl text-[#5a2a3a]">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-[#5a2a3a]/10 text-[#5a2a3a]"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClearSheet({ r, onNext, onHome }: { r: Result; onNext: () => void; onHome: () => void }) {
  const [left, setLeft] = useState(r.zoneDone ? 6 : 4);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, onNext]);
  const z = zoneOf(r.stage), nz = zoneOf(r.stage + 1);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="trt-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="trt-head px-5 pt-6 pb-5">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="trt-display mt-1 text-4xl text-white">{r.zoneDone ? "Shop complete!" : `Stage ${r.stage} clear!`}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{r.zoneDone ? `${z.name} is stocked — next: ${nz.name}` : `${z.name} · ${((r.stage - 1) % STAGES_PER_ZONE) + 1} of 10`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="trt-display trt-grad text-5xl">{r.score.toLocaleString()}</p>
          <p className="mt-2 flex items-center justify-center gap-1 text-sm font-bold text-[#5a2a3a]"><CoinIcon size={18} /> +{r.coins}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="trt-btn trt-cta trt-shine flex items-center justify-center gap-2 py-3" onClick={onNext}>Stage {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="trt-btn trt-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; history: Game[]; left: number; score: number; revived: boolean }) => void }) {
  const save = useTreat();
  const stage = save.stage, zone = zoneOf(stage), cur = save.current;
  const zi = Math.floor((stage - 1) / STAGES_PER_ZONE) % ZONES.length;
  return (
    <div className="trt-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Stage"], [Star, String(save.totalStars), "Stars"], [Sparkles, save.totalScore.toLocaleString(), "Score"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="trt-glass flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0 text-[#ff6fb5]" />
                <span className="min-w-0"><span className="trt-display block truncate text-xl leading-none text-[#5a2a3a]">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider text-[#5a2a3a]/60 uppercase">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Treatrio</h1>
        <Title3D fallback={<p className="trt-display trt-grad trt-title mt-5" aria-hidden>Treatrio</p>} />
        <p className="-mt-1 max-w-lg text-center text-[15px] font-semibold text-[#5a2a3a]/85 sm:mx-auto">Sort the sweets on the shop shelves — three alike in a row pop! Endless stages, one shop after another.</p>

        <div className="trt-shine relative mt-5 overflow-hidden rounded-[30px] p-5 text-white shadow-[0_24px_50px_-24px_rgba(255,111,181,.8)]" style={{ background: `linear-gradient(150deg, ${zone.sky[2]}, ${zone.glow} 120%)` }}>
          <p className="text-xs font-extrabold tracking-widest text-white/90 uppercase"><Store className="mr-1 inline size-4" />{zone.name}{loopOf(stage) ? ` · Round ${loopOf(stage) + 1}` : ""}</p>
          <p className="trt-display mt-1 text-5xl leading-none drop-shadow">Stage {cur?.stage ?? stage}</p>
          <div className="mt-3 flex gap-1.5">{Array.from({ length: 10 }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < ((cur?.stage ?? stage) - 1) % 10 ? "bg-white" : i === ((cur?.stage ?? stage) - 1) % 10 ? "animate-pulse bg-[#fff3a0]" : "bg-white/35"}`} />)}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="trt-btn trt-cta inline-flex items-center gap-2 px-6 py-3 text-lg"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useTreat.getState().saveCurrent(null); onPlay(cur.stage); }} className="trt-btn inline-flex items-center gap-1.5 bg-white/25 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="trt-btn trt-cta inline-flex items-center gap-2 px-8 py-3.5 text-xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="trt-display text-[24px] leading-none text-[#5a2a3a]">The shops</h2>
          <span className="text-xs font-bold text-[#5a2a3a]/60">10 stages each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ZONES.map((z, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_ZONE) > i || loopOf(stage) > 0, now = i === zi;
            return (
              <div key={z.id} className={`rounded-2xl p-3 text-white shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ background: `linear-gradient(150deg, ${z.sky[2]}, ${z.sky[1]})` }}>
                <p className="text-[13px] font-extrabold drop-shadow">{z.name}</p>
                <p className="text-[11px] font-bold text-white/85">{done ? "★ stocked" : now ? `stage ${((stage - 1) % STAGES_PER_ZONE) + 1} of 10` : `from stage ${i * STAGES_PER_ZONE + 1}`}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[11px] font-bold text-[#5a2a3a]/50">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
