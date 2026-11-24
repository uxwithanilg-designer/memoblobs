"use client";
// Picnic Pairs — a connect-pairs puzzle on a picnic blanket. Tap two matching food tiles that can be linked by a path
// with at most two turns (around the outside too) to clear them; clear the board before the clock runs out. Stages
// never end and arrive one by one: 500 designed stages across eight picnic spots (each with its own colours and
// music, closed by a finale), with sliding-tile rules, board shapes and stone blockers joining along the way, then
// endless remixes. Phone-app flow: home → stage → clear → next stage.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Clock, Lightbulb, Minimize2, Maximize2, Play, RotateCcw, Shuffle, Sparkles, Star, Timer, Utensils, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { STONE, tilesLeft, type Gravity } from "../grid";
import { DESIGNED, SPOTS, STAGES_PER_SPOT, passOf, spotOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { hint, newGame, shuffleGame, starsOf, tryMatch, type Game } from "../play";
import { usePicnic, usePicnicHydrated } from "../save";
import { PicnicBoard, type BoardSound } from "./Board";
import { PICNIC_CSS, PICNIC_EXTRA } from "./styles";

export const PICNIC_SFX = ["pick", "match", "combo", "nope", "slide", "shuffle", "hint", "tick", "clear", "star", "spot", "timeup", "open", "confetti"] as const;
type Sfx = (typeof PICNIC_SFX)[number];
const sfxName = (k: Sfx) => `a:picnic_${k}` as Sound;
const music = (k: string) => `a:picnic_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const fmt = (s: number) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const GRAV: Record<Gravity, [string, typeof ArrowDown | null]> = {
  none: ["", null], down: ["Tiles drop down", ArrowDown], up: ["Tiles rise up", ArrowUp], left: ["Tiles slide left", ArrowLeft], right: ["Tiles slide right", ArrowLeft],
  midX: ["Tiles squeeze to the middle", Minimize2], midY: ["Tiles squeeze to the middle", Minimize2], apart: ["Tiles slide apart", Maximize2],
};
const TIPS: Record<string, [string, string]> = {
  slide: ["Sliding tiles", "From now on tiles slide after every pair — the arrow at the top shows which way. Plan for where they'll land!"],
  shape: ["New shapes", "Boards now come in shapes with gaps. Links can run through the gaps and around the outside."],
  stone: ["Stone blockers", "Grey stones never clear and block links. Find a way around them."],
  boss: ["Picnic finale", "The last stage of every spot is its finale: a big board with a bigger reward."],
  remix: ["Endless picnics", "You've finished all 500 designed stages! From here every stage is a fresh remix — new shapes and mixes, forever."],
};

interface Result { stage: number; stars: number; coins: number; score: number; spotDone: boolean; gift: string }
interface Float { id: number; x: number; y: number; text: string; big: boolean }

export default function PicnicApp({ slug }: { slug: string; title: string }) {
  const ready = usePicnicHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = usePicnic((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [left, setLeft] = useState(0);
  const [revived, setRevived] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "time" | "help" | "tip">("");
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [toast, setToast] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const boardRef = useRef<PicnicBoard | null>(null);
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  const applyPending = useCallback(() => { const b = boardRef.current, p = pendingRef.current; if (!b || !p) return; pendingRef.current = null; b.setStage(p.g, spotOf(p.d.stage), p.d.stage); }, []);
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
    loadRef.current(0.3, "Packing the basket");
    void audio.preload(PICNIC_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(spotOf(usePicnic.getState().stage).music)]);
    prepareStage(usePicnic.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.18, duck: k === "clear" || k === "spot" });
  }, []);
  const addFloat = useCallback((x: number, y: number, text: string, big = false) => {
    const id = Math.random();
    setFloats((f) => [...f.slice(-6), { id, x, y, text, big }]);
    setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 1100);
  }, []);
  const persist = useCallback((g: Game) => {
    const d = defRef.current; if (!d) return;
    usePicnic.getState().saveCurrent({ stage: d.stage, game: g, revived: stateRef.current.revived });
  }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback((g: Game) => {
    const d = defRef.current!;
    const st = stateRef.current;
    const stars = starsOf(st.left, d.seconds, st.revived);
    const total = g.score + Math.round(st.left * 10) + (d.boss ? 500 : 0);
    const coins = 5 + Math.round(d.pairs / 3) + stars * 3 + (d.boss ? 20 : 0);
    useProfile.getState().earnCoins(coins);
    usePicnic.getState().win(d.stage, stars, total);
    usePicnic.getState().saveCurrent(null);
    let gift = "";
    if (d.boss) { usePicnic.getState().giveBooster("hint", 2); usePicnic.getState().giveBooster("shuffle", 1); usePicnic.getState().giveBooster("time", 1); gift = "+2 Hints · +1 Shuffle · +1 Time"; }
    else if (d.stage % 10 === 0) { usePicnic.getState().giveBooster("hint", 1); gift = "+1 Hint"; }
    const spotDone = d.stage % STAGES_PER_SPOT === 0;
    setResult({ stage: d.stage, stars, coins, score: total, spotDone, gift });
    sfx(spotDone ? "spot" : "clear", { gain: 0.8 });
    for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    track("picnic_clear", { stage: d.stage, stars });
  }, [sfx]);

  // ---------------------------------------------------------------- board
  const matchRef = useRef<(a: number, b: number) => ReturnType<typeof tryMatch>>(() => null);
  const doMatch = useCallback((a: number, b: number) => {
    const g0 = gameRef.current, st = stateRef.current;
    if (!g0 || st.result || st.sheet || st.paused) return null;
    const out = tryMatch(g0, a, b, performance.now(), Math.random);
    if (!out) return null;
    setGame(out.game); gameRef.current = out.game;
    buzz(12);
    if (out.res.combo > 1) sfx("combo", { gain: 0.45, rate: Math.min(1.6, 0.9 + out.res.combo * 0.08), delay: 0.15 });
    if (out.res.reshuffled) setTimeout(() => setToast("No pairs left — shuffled!"), 500);
    if (out.res.win) setTimeout(() => finishStage(out.game), 950);
    else persist(out.game);
    return out;
  }, [sfx, finishStage, persist]);
  useEffect(() => { matchRef.current = doMatch; }, [doMatch]);
  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const board = new PicnicBoard(host.current, {
      match: (a, b) => matchRef.current(a, b),
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
    setLeft(d.seconds * (resume ? Math.max(0.3, tilesLeft(g.board) / (d.pairs * 2)) : 1)); setRevived(resume?.revived ?? false);
    setScreen("game");
    const sp = spotOf(stage);
    void audio.playMusic(music(sp.music));
    audio.warmMusic([music(spotOf(stage + STAGES_PER_SPOT).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = usePicnic.getState().tips;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, slide: d.gravity !== "none", shape: d.board.c.includes(-1), stone: d.board.c.includes(STONE), boss: d.boss };
    const tip = ["remix", "slide", "shape", "stone", "boss"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!usePicnic.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); }
    else if (d.gravity !== "none") setToast(GRAV[d.gravity][0]);
    track("picnic_start", { stage });
  }, [sfx, applyPending]);

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
  const doHint = () => {
    const g = gameRef.current; if (!g || result) return;
    const h = hint(g); if (!h) return;
    if (!usePicnic.getState().useBooster("hint")) { setToast("No hints left — win stages to earn more"); return; }
    boardRef.current?.showHint(h[0], h[1]);
  };
  const doShuffle = () => {
    const g0 = gameRef.current; if (!g0 || result) return;
    if (!usePicnic.getState().useBooster("shuffle")) { setToast("No shuffles left"); return; }
    const { game: g, map } = shuffleGame(g0, Math.random);
    setGame(g); gameRef.current = g; boardRef.current?.sync(g); void boardRef.current?.reshuffle(map); persist(g);
  };
  const doTime = () => {
    if (result) return;
    if (!usePicnic.getState().useBooster("time")) { setToast("No extra time left"); return; }
    setLeft((l) => l + 30); sfx("star", { gain: 0.5 }); setToast("+30 seconds");
  };
  const doRestart = () => { const d = defRef.current; if (!d) return; usePicnic.getState().saveCurrent(null); void start(d.stage); };
  const doRevive = () => { setRevived(true); setLeft(30); setSheet(""); sfx("star", { gain: 0.5 }); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __picnic?: unknown }).__picnic = {
      game: () => gameRef.current, def: () => defRef.current, start: (stage: number) => void start(stage),
      hint: () => { const g = gameRef.current; return g ? hint(g) : null; },
      tap: (i: number) => boardRef.current?.tap(i),
      time: (s: number) => setLeft(s),
    };
  }, [start]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const sp = spotOf(screen === "game" ? stage : usePicnic.getState().stage);
  const night = sp.id === "lantern";
  const inS = ((stage - 1) % STAGES_PER_SPOT) + 1;
  const done = game && def ? 1 - tilesLeft(game.board) / (def.pairs * 2) : 0;
  const GI = def ? GRAV[def.gravity][1] : null;
  return (
    <div className={`pic-root ${night ? "pic-night" : ""}`} style={{ ["--s1" as string]: sp.sky[0], ["--s2" as string]: sp.sky[1], ["--s3" as string]: sp.sky[2] }}>
      <style>{PICNIC_CSS + PICNIC_EXTRA}</style>
      <div className="pic-clouds" aria-hidden>{Array.from({ length: 5 }, (_, i) => <i key={i} style={{ top: `${6 + i * 12}%`, width: 70 + (i % 3) * 30, animationDuration: `${40 + i * 9}s`, animationDelay: `${-i * 12}s`, opacity: night ? 0.12 : 0.7 }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-center gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="pic-panel grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="pic-panel min-w-0 flex-1 !rounded-2xl px-3 py-1">
              <p className="pic-display truncate text-lg leading-tight">Stage {stage}{def?.boss && <span className="ml-2 rounded-full bg-[#ff4f6d] px-2 py-0.5 align-middle font-sans text-[10px] font-extrabold tracking-wider text-white uppercase">Finale</span>}</p>
              <p className="flex items-center gap-1 truncate text-[11px] font-bold opacity-70">{sp.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_SPOT}{GI && <GI className={`ml-1 size-3.5 ${def?.gravity === "right" ? "rotate-180" : ""} ${def?.gravity === "midY" ? "rotate-90" : ""}`} />}</p>
            </div>
            <div className={`pic-panel pic-time flex items-center gap-1 !rounded-2xl px-3 py-1.5 font-extrabold ${left <= 10 ? "pic-low" : ""}`}><Timer className="size-4" />{fmt(left)}</div>
          </div>
          <div className="mx-4 mt-0.5 flex items-center gap-2">
            <div className="pic-bar flex-1"><b style={{ width: `${done * 100}%` }} /></div>
            <span className="pic-panel pic-display !rounded-full px-3 py-0.5 text-lg tabular-nums">{(game?.score ?? 0).toLocaleString()}</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="pic-stage" />
            {floats.map((f) => <span key={f.id} className={`pic-float ${f.big ? "pic-float-big" : ""}`} style={{ left: f.x, top: f.y }}>{f.text}</span>)}
          </div>
          <div className="flex items-end justify-center gap-3 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Lightbulb} label="Hint" n={boosters.hint} onClick={doHint} />
            <Tool icon={Shuffle} label="Shuffle" n={boosters.shuffle} onClick={doShuffle} />
            <Tool icon={Clock} label="+30 s" n={boosters.time} onClick={doTime} />
            <Tool icon={RotateCcw} label="Restart" onClick={doRestart} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/15 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/40 border-t-[#e0602a]" /><p className="pic-display text-lg text-white drop-shadow">Laying the blanket…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "time" && !result && (
          <Sheet key="time" title="Time's up!" onClose={() => undefined}>
            <p className="opacity-85">So close! {revived ? "Try the stage again." : "Take 30 more seconds — free, once per stage."}</p>
            <div className="mt-4 grid gap-2">
              {!revived && <button type="button" className="pic-btn pic-cta pic-shine py-3" onClick={doRevive}><Timer className="mr-1 inline size-5" /> +30 seconds</button>}
              <button type="button" className="pic-btn pic-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { usePicnic.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>🍓 Tap two matching foods to link them.</li>
              <li>↪️ The link may turn at most twice and can&apos;t cross other tiles — but it can run around the outside of the board.</li>
              <li>⏱️ Clear every tile before the clock runs out. More time left, more stars.</li>
              <li>💡 Stuck? Use a hint or a shuffle — and if no pair is left, the board shuffles itself for free.</li>
            </ul>
            <button type="button" className="pic-btn pic-cta mt-5 w-full py-3" onClick={() => { usePicnic.getState().sawHelp(); setSheet(""); }}>Let&apos;s eat!</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { usePicnic.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="pic-btn pic-cta mt-5 w-full py-3" onClick={() => { usePicnic.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#4a2a1a] px-4 py-2 text-sm font-bold whitespace-nowrap text-white shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label, n, onClick }: { icon: typeof Star; label: string; n?: number; onClick: () => void }) {
  return (
    <button type="button" className="pic-tool" onClick={onClick}>
      <span className="pic-tool-ico"><Icon className="size-5" />{n !== undefined && <span className="pic-badge">{n}</span>}</span>{label}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="pic-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="pic-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-[#4a2a1a]/10"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClearSheet({ r, onNext, onHome }: { r: Result; onNext: () => void; onHome: () => void }) {
  const [left, setLeft] = useState(r.spotDone ? 6 : 4);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, onNext]);
  const s = spotOf(r.stage), ns = spotOf(r.stage + 1);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/35 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="pic-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="pic-head px-5 pt-6 pb-5">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="pic-display mt-1 text-4xl text-white">{r.spotDone ? "Picnic complete!" : `Stage ${r.stage} clear!`}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{r.spotDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_SPOT) + 1} of ${STAGES_PER_SPOT}`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="pic-display text-5xl text-[#e0602a]">{r.score.toLocaleString()}</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/40 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="pic-btn pic-cta pic-shine flex items-center justify-center gap-2 py-3" onClick={onNext}>Stage {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="pic-btn pic-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const TITLE_COLS = ["#e0402a", "#3fa34a", "#e0a000", "#2f78d0", "#d04a86", "#8a4ad8"];
function Title() {
  const [hop, setHop] = useState(0);
  return (
    <div className="pic-title" role="img" aria-label="Picnic Pairs" onPointerDown={() => setHop((h) => h + 1)}>
      {["PICNIC", "PAIRS"].map((w, line) => (
        <div key={w} className={line ? "pic-tl2" : "pic-tl1"}>
          {[...w].map((ch, i) => <span key={`${i}-${hop}`} className="pic-ttile" style={{ ["--c" as string]: TITLE_COLS[(i + line * 2) % TITLE_COLS.length], animationDelay: `${(line ? 0.4 : 0) + i * 0.07}s, ${1 + i * 0.13}s` }}>{ch}</span>)}
        </div>
      ))}
      <div className="mt-2 flex gap-2 text-[28px]" aria-hidden>{["🍓", "🥐", "🍉", "🧁", "🍋"].map((f, i) => <span key={f} className="pic-tbub-e" style={{ animationDelay: `${i * 0.3}s` }}>{f}</span>)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = usePicnic();
  const stage = save.stage, sp = spotOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const si = Math.floor((stage - 1) / STAGES_PER_SPOT) % SPOTS.length;
  const remix = passOf(stage) > 0;
  return (
    <div className="pic-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Stage"], [Star, String(save.totalStars), "Stars"], [Sparkles, save.totalScore.toLocaleString(), "Score"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="pic-panel flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0 text-[#e0602a]" />
                <span className="min-w-0"><span className="pic-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Picnic Pairs — connect pairs puzzle</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-semibold opacity-85 sm:mx-auto">Link matching picnic treats with a path of up to two turns and clear the blanket before the clock runs out!</p>

        <div className="pic-shine relative mt-3 overflow-hidden rounded-[30px] border-2 border-white p-5 text-white shadow-[0_24px_50px_-24px_rgba(110,60,20,.8)]" style={{ background: `linear-gradient(150deg, ${sp.accent}, ${sp.sky[0]} 130%)` }}>
          <p className="text-xs font-extrabold tracking-widest text-white/90 uppercase"><Utensils className="mr-1 inline size-4" />{sp.name}{remix ? " · Remix" : ""}</p>
          <p className="pic-display mt-1 text-5xl leading-none drop-shadow">Stage {shown}</p>
          <div className="mt-3 flex gap-1">{Array.from({ length: STAGES_PER_SPOT }, (_, i) => { const at = (shown - 1) % STAGES_PER_SPOT; return <span key={i} className={`h-2 flex-1 rounded-full ${i < at ? "bg-white" : i === at ? "animate-pulse bg-[#fff3a0]" : "bg-white/35"}`} />; })}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="pic-btn pic-cta inline-flex items-center gap-2 px-6 py-3 text-lg"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { usePicnic.getState().saveCurrent(null); onPlay(cur.stage); }} className="pic-btn inline-flex items-center gap-1.5 bg-white/20 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="pic-btn pic-cta inline-flex items-center gap-2 px-8 py-3.5 text-xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="pic-display text-[24px] leading-none">The picnic spots</h2>
          <span className="text-xs font-bold opacity-60">{STAGES_PER_SPOT} stages each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SPOTS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_SPOT) > i || remix, now = i === si;
            return (
              <div key={s.id} className={`rounded-2xl border-2 border-white/70 p-3 text-white shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ background: `linear-gradient(150deg, ${s.accent}, ${s.sky[0]} 140%)` }}>
                <p className="text-[13px] font-extrabold drop-shadow">{s.name}</p>
                <p className="text-[11px] font-bold text-white/85">{now ? `stage ${((stage - 1) % STAGES_PER_SPOT) + 1} of ${STAGES_PER_SPOT}` : done ? "★ complete" : `from stage ${i * STAGES_PER_SPOT + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="pic-panel mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="pic-display text-lg text-[#e0602a]">How it works</p>
          <p>🍓 Tap two matching foods. They link if a path with at most two turns joins them — around the outside counts too.</p>
          <p>↕️ Deeper in, tiles slide after every pair (down, up, sideways, to the middle…), boards take new shapes and stones block the way.</p>
          <p>⏱️ Clear the board before the clock runs out. Hints, shuffles and extra time help — and a stuck board shuffles itself for free.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-50">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}

