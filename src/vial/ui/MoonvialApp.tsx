"use client";
// Moonvial — sort glowing potions in a moonlit garden. Tap a vial, tap another to pour; fill a vial with one colour and
// it is corked and handed to the star spirit who ordered it. Stages never end and arrive one by one; every ten light
// up a constellation, with a new sky and new music. Phone-app flow: home → stage → clear → next stage on its own.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronRight, FlaskConical, Play, RotateCcw, Sparkles, Star, Undo2, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { rngFrom } from "../../sudoku/rng";
import { STAGES_PER_ZONE, ZONES, loopOf, solve, zoneOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { addVial, canPour, cleared, cloneGame, corkedCount, hasMove, isLocked, pour, serve, startGame, type Game } from "../play";
import { useVial, useVialHydrated } from "../save";
import { Shelf as Shelf2D, type ShelfHandle } from "./Shelf";
import { Shelf as Shelf3D } from "./Shelf3D";
import { MOON_CSS } from "./styles";

export const VIAL_SFX = ["select", "flow", "fill", "nope", "cork", "reveal", "deliver", "clear", "star", "constellation", "undo", "extra", "restart", "stuck", "open"] as const;
type Sfx = (typeof VIAL_SFX)[number];
const sfxName = (k: Sfx) => `a:vial_${k}` as Sound;
const music = (k: string) => `a:vial_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const UNDO_PER_STAGE = 5;
/** 3D when the device can do WebGL, the flat shelf otherwise */
const canWebGL = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };

const TIPS: Record<string, [string, string]> = {
  hidden: ["Hidden layers", "Some layers start as ? — a hidden layer shows its colour once nothing sits on top of it."],
  tall: ["Tall vials", "These vials hold five layers each. More room to juggle — and more to sort."],
  lock: ["Locked vial", "A frosted vial with a padlock stays shut until enough vials are corked. The number shows how many more."],
  boss: ["Boss stage", "The last stage of every constellation is its boss: the knottiest shelf of the ten, with a bigger reward."],
};

interface Result { stage: number; stars: number; coins: number; score: number; zoneDone: boolean }

export default function MoonvialApp({ slug }: { slug: string; title: string }) {
  const ready = useVialHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [sel, setSel] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [undos, setUndos] = useState(UNDO_PER_STAGE);
  const [result, setResult] = useState<Result | null>(null);
  const [stuck, setStuck] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  const [tipKey, setTipKey] = useState("");
  const [use3D] = useState(() => typeof window !== "undefined" && canWebGL());
  const shelf = useRef<ShelfHandle>(null);
  const hist = useRef<Game[]>([]);
  const gameRef = useRef<Game | null>(null);
  const defRef = useRef<StageDef | null>(null);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  const busyRef = useRef(false);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Lighting the lanterns");
    void audio.preload(VIAL_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(zoneOf(useVial.getState().stage).music)]);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.3, duck: k === "clear" || k === "constellation" });
  }, []);
  /** pan from a vial's place on the shelf (−1 left … 1 right) */
  const panOf = (g: Game, id: number) => { const live = g.vials.filter((v) => !v.gone); const i = live.findIndex((v) => v.id === id); return live.length > 1 ? ((i % Math.ceil(live.length / (live.length > 5 ? 2 : 1))) / Math.max(1, Math.ceil(live.length / (live.length > 5 ? 2 : 1)) - 1)) * 1.4 - 0.7 : 0; };

  // ---------------------------------------------------------------- stages
  const persist = useCallback((g: Game) => { const d = defRef.current; if (d) useVial.getState().saveCurrent({ stage: d.stage, game: g, history: hist.current.slice(-20) }); }, []);

  const [loadingStage, setLoadingStage] = useState(false);
  const start = useCallback(async (stage: number, resume?: { game: Game; history: Game[] }) => {
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const g = resume?.game ?? startGame(d, rngFrom(`moonvial:orders:${stage}`));
    hist.current = resume?.history ?? [];
    setDef(d); setGame(g); setSel(-1); setResult(null); setStuck(false); setBusy(false); setUndos(UNDO_PER_STAGE);
    setScreen("game");
    void audio.playMusic(music(zoneOf(stage).music));
    audio.warmMusic([music(zoneOf(stage + STAGES_PER_ZONE).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    // one-time tips for each new twist
    const tips = useVial.getState().tips;
    const tip = !useVial.getState().seenHelp ? "" : d.vials.some((v) => v.lock) && !tips.includes("lock") ? "lock" : d.cap === 5 && !tips.includes("tall") ? "tall" : d.boss && !tips.includes("boss") ? "boss" : d.vials.some((v) => v.hidden.some(Boolean)) && !tips.includes("hidden") ? "hidden" : "";
    setTipKey(tip);
    if (!useVial.getState().seenHelp) setHelp(true);
    track("vial_start", { stage });
  }, [sfx]);

  const finishStage = useCallback((g: Game) => {
    const d = defRef.current!;
    // par is a near-shortest solution, so a little slack for three stars
    const three = Math.ceil(d.par * 1.2) + 1, two = Math.ceil(d.par * 1.6) + 2;
    const stars = g.extra ? Math.min(2, g.moves <= two ? 2 : 1) : g.moves <= three ? 3 : g.moves <= two ? 2 : 1;
    const score = 100 + d.colors * d.cap * 5 + stars * 50 + (d.boss ? 150 : 0);
    const coins = 5 + d.colors + stars * 3;
    useProfile.getState().earnCoins(coins);
    useVial.getState().win(d.stage, stars, score);
    const zoneDone = d.stage % STAGES_PER_ZONE === 0;
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, score, zoneDone });
      sfx(zoneDone ? "constellation" : "clear", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 350);
    track("vial_clear", { stage: d.stage, moves: g.moves, stars });
  }, [sfx]);

  // ---------------------------------------------------------------- tapping vials
  const onTap = useCallback(async (id: number) => {
    const g0 = gameRef.current;
    if (!g0 || busy || result || paused) return;
    const v = g0.vials[id];
    if (isLocked(g0, v)) { shelf.current?.shake(id); sfx("nope", { x: panOf(g0, id), gain: 0.4 }); const left = v.lock - corkedCount(g0); setToast(`Opens after ${left} more cork${left > 1 ? "s" : ""}`); return; }
    const selectable = v.layers.length > 0 && !v.corked;
    if (sel < 0) {
      if (selectable) { setSel(id); sfx("select", { x: panOf(g0, id), gain: 0.45, rate: 0.95 + v.layers.length * 0.04 }); }
      else { shelf.current?.shake(id); sfx("nope", { x: panOf(g0, id), gain: 0.4 }); }
      return;
    }
    if (sel === id) { setSel(-1); sfx("select", { x: panOf(g0, id), gain: 0.3, rate: 0.85 }); return; }
    const amt = canPour(g0, sel, id);
    if (!amt) {
      if (selectable) { setSel(id); sfx("select", { x: panOf(g0, id), gain: 0.45 }); }
      else { shelf.current?.shake(id); sfx("nope", { x: panOf(g0, id), gain: 0.4 }); buzz(30); }
      return;
    }
    // pour
    setBusy(true);
    hist.current = [...hist.current, cloneGame(g0)].slice(-40);
    const g = cloneGame(g0);
    const srcBefore = g.vials[sel].layers.length, dstBefore = g.vials[id].layers.length;
    const res = pour(g, sel, id);
    const from = sel;
    setSel(-1); setGame(g);
    // the stream starts as the vial tips over the opening; the glass "sings" higher as it fills up
    const capB = g.vials[id].cap;
    sfx("flow", { x: panOf(g0, id), gain: 0.5, delay: 0.19, rate: 1.05 - res.amount * 0.04 });
    sfx("fill", { x: panOf(g0, id), gain: 0.55, delay: 0.23, rate: 0.82 + ((dstBefore + res.amount) / capB) * 0.42 });
    buzz(12);
    await shelf.current?.pour(from, id, res.amount, res.color, srcBefore, dstBefore);
    if (res.revealed) { shelf.current?.sparkle(from, g.vials[from].layers[g.vials[from].layers.length - 1], false); sfx("reveal", { x: panOf(g, from), gain: 0.5 }); }
    if (res.corked) { shelf.current?.sparkle(id, res.color, true); sfx("cork", { x: panOf(g, id), gain: 0.6 }); buzz(25); }
    if (res.unlocked.length) { res.unlocked.forEach((u) => shelf.current?.sparkle(u, 4, true)); sfx("extra", { gain: 0.55, delay: 0.25 }); setToast("A locked vial opened!"); }
    // hand corked vials to the spirits
    const g2 = cloneGame(g);
    const handed = serve(g2);
    const flights = handed.map((h, k) => new Promise<void>((ok) => setTimeout(() => { sfx("deliver", { x: (h.slot - 1) * 0.6, gain: 0.55, rate: 1 + k * 0.06 }); void shelf.current?.deliver(h.vial, h.slot, h.color).then(ok); }, res.corked ? 260 + k * 120 : k * 120)));
    if (handed.length) await new Promise((r) => setTimeout(r, res.corked ? 260 : 0));
    setGame(g2);
    await Promise.all(flights);
    setBusy(false);
    if (cleared(g2)) { useVial.getState().saveCurrent(null); finishStage(g2); return; }
    persist(g2);
    if (!hasMove(g2)) { setStuck(true); sfx("stuck", { gain: 0.5 }); }
  }, [busy, result, paused, sel, sfx, finishStage, persist]);

  const doUndo = () => {
    const prev = hist.current[hist.current.length - 1];
    if (busy || result) return;
    if (!prev) { setToast("Nothing to undo"); return; }
    if (undos <= 0) { setToast("No undo left on this stage"); return; }
    hist.current = hist.current.slice(0, -1);
    setUndos((u) => u - 1); setGame(prev); setSel(-1); setStuck(false); persist(prev);
    sfx("undo", { gain: 0.5 });
  };
  const doExtra = () => {
    const g0 = gameRef.current;
    if (!g0 || busy || result) return;
    if (g0.extra) { setToast("One extra vial per stage"); return; }
    hist.current = [...hist.current, cloneGame(g0)].slice(-40);
    const g = cloneGame(g0); addVial(g);
    setGame(g); setStuck(false); persist(g);
    sfx("extra", { gain: 0.6 });
  };
  const doRestart = () => { const d = defRef.current; if (!d || busy) return; useVial.getState().saveCurrent(null); void start(d.stage); sfx("restart", { gain: 0.5 }); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __vial?: unknown }).__vial = {
      game: () => gameRef.current,
      def: () => defRef.current,
      start: (stage: number) => void start(stage),
      tap: (id: number) => onTap(id),
      idle: () => !busyRef.current,
      where: (id: number) => shelf.current?.where(id),
      solve: () => { const g = gameRef.current; if (!g) return null; const n = corkedCount(g); return solve(g.vials.map((v) => ({ layers: v.gone || v.corked ? Array(v.cap).fill(99) : v.layers, cap: v.cap, lock: Math.max(0, (v.lock ?? 0) - n) })), 400000).moves; },
    };
  }, [start, onTap]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setStuck(false); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const zone = zoneOf(screen === "game" ? stage : useVial.getState().stage);
  return (
    <div className="mvl-root" style={{ ["--s1" as string]: zone.sky[0], ["--s2" as string]: zone.sky[1], ["--s3" as string]: zone.sky[2], ["--glow" as string]: zone.glow }}>
      <style>{MOON_CSS}</style>
      <Sky />

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && game && def && (
        <div className="absolute inset-0 flex flex-col">
          <div className="flex items-center gap-2 pt-[max(env(safe-area-inset-top),10px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="mvl-glass grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="min-w-0 flex-1">
              <p className="mvl-display truncate text-xl leading-tight">Stage {stage}{def.boss && <span className="ml-2 rounded-full bg-[#ff4f9a] px-2 py-0.5 align-middle font-sans text-[10px] font-extrabold tracking-wider text-white uppercase">Boss</span>}</p>
              <p className="truncate text-[11px] font-bold text-white/70">{zone.name}{loopOf(stage) ? ` · Night ${loopOf(stage) + 1}` : ""} · star {((stage - 1) % STAGES_PER_ZONE) + 1}/10</p>
            </div>
            <div className="mvl-glass flex items-center gap-1 !rounded-2xl px-3 py-1.5 text-sm font-extrabold tabular-nums">{game.moves} <span className="text-[10px] text-white/60">/ {def.par}</span></div>
          </div>
          <div className="relative min-h-0 flex-1">
            {use3D ? <Shelf3D ref={shelf} game={game} selected={sel} onTap={(id) => void onTap(id)} glow={zone.glow} /> : <Shelf2D ref={shelf} game={game} selected={sel} onTap={(id) => void onTap(id)} glow={zone.glow} />}
          </div>
          <div className="flex justify-center gap-5 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),12px)]">
            <button type="button" className="mvl-tool" onClick={doUndo}><span className="mvl-tool-ico"><Undo2 className="size-5" /><span className="mvl-badge">{undos}</span></span>Undo</button>
            <button type="button" className="mvl-tool" onClick={doExtra}><span className="mvl-tool-ico"><FlaskConical className="size-5" /><span className="mvl-badge">{game.extra ? 0 : 1}</span></span>+ Vial</button>
            <button type="button" className="mvl-tool" onClick={doRestart}><span className="mvl-tool-ico"><RotateCcw className="size-5" /></span>Restart</button>
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/30 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/15 border-t-[#ffc23d]" /><p className="mvl-display text-lg">Brewing the stage…</p></div>
        </div>
      )}

      <AnimatePresence>
        {stuck && !result && (
          <Sheet key="stuck" title="No pours left" onClose={() => setStuck(false)}>
            <p className="text-white/80">Every vial is blocked. Step back, add a vial or start the stage again.</p>
            <div className="mt-4 grid gap-2">
              {undos > 0 && <button type="button" className="mvl-btn mvl-cta py-3" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Undo ({undos})</button>}
              {!game?.extra && <button type="button" className="mvl-btn bg-white/12 py-3" onClick={doExtra}><FlaskConical className="mr-1 inline size-5" /> Add an empty vial</button>}
              <button type="button" className="mvl-btn bg-white/10 py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Restart stage</button>
            </div>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
        {tipKey && !help && !result && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useVial.getState().sawTip(tipKey); setTipKey(""); }}>
            <p className="text-white/85">{TIPS[tipKey][1]}</p>
            <button type="button" className="mvl-btn mvl-cta mt-5 w-full py-3" onClick={() => { useVial.getState().sawTip(tipKey); setTipKey(""); }}>Got it</button>
          </Sheet>
        )}
        {help && (
          <Sheet key="help" title="How to play" onClose={() => { setHelp(false); useVial.getState().sawHelp(); }}>
            <ul className="grid gap-2 text-[15px] text-white/85">
              <li>🧪 Tap a vial, then tap another to pour the top colour across.</li>
              <li>🎨 You can pour onto the same colour or into an empty vial, as much as fits.</li>
              <li>⭐ Fill a vial with one colour: it gets a cork and goes to the star spirit who ordered it.</li>
              <li>❓ Hidden layers show themselves once nothing sits on top.</li>
            </ul>
            <button type="button" className="mvl-btn mvl-cta mt-5 w-full py-3" onClick={() => { setHelp(false); useVial.getState().sawHelp(); }}>Let&apos;s brew</button>
          </Sheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1c1440] px-4 py-2 text-sm font-bold whitespace-nowrap text-white shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

// ------------------------------------------------------------------ sky

function Sky() {
  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ x: (i * 53) % 100, y: (i * 29) % 62, s: 1 + (i % 3), d: (i % 7) * 0.6 })), []);
  return (
    <div className="mvl-sky" aria-hidden>
      {stars.map((s, i) => <i key={i} className="mvl-star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }} />)}
      <div className="mvl-moon" />
      {Array.from({ length: 9 }, (_, i) => <b key={i} className="mvl-fly" style={{ left: `${(i * 23 + 7) % 100}%`, animationDelay: `${i * 1.3}s`, animationDuration: `${9 + (i % 4) * 3}s` }} />)}
      <div className="mvl-hills" />
    </div>
  );
}

// ------------------------------------------------------------------ sheets

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="mvl-glass mvl-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="mvl-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/10"><X className="size-5" /></button>
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
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/55 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="mvl-glass mvl-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="mvl-head px-5 pt-6 pb-5">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/25 text-white/40"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="mvl-display mt-1 text-4xl">{r.zoneDone ? "Constellation lit!" : `Stage ${r.stage} clear!`}</h2>
          <p className="mt-1 text-sm font-bold text-white/85">{r.zoneDone ? `${z.name} shines — next: ${nz.name}` : `${z.name} · star ${((r.stage - 1) % STAGES_PER_ZONE) + 1} of 10`}</p>
        </div>
        <div className="px-5 py-4">
          <ConstellationRow lit={((r.stage - 1) % STAGES_PER_ZONE) + 1} />
          <div className="mt-3 flex items-center justify-center gap-4 text-sm font-bold">
            <span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>
            <span className="flex items-center gap-1 text-[#ffe08a]"><Sparkles className="size-4" /> +{r.score}</span>
          </div>
          <div className="mt-4 grid gap-2">
            <button type="button" className="mvl-btn mvl-cta mvl-shine flex items-center justify-center gap-2 py-3" onClick={onNext}>Stage {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="mvl-btn bg-white/10 py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** a constellation of ten stars, `lit` of them shining */
function ConstellationRow({ lit }: { lit: number }) {
  const pts = [[6, 60], [16, 30], [27, 52], [38, 20], [49, 44], [60, 14], [70, 40], [80, 22], [89, 50], [96, 30]];
  return (
    <svg viewBox="0 0 100 70" className="mx-auto h-16 w-full max-w-[280px]">
      <polyline points={pts.slice(0, lit).map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="rgba(255,226,122,.7)" strokeWidth="1.2" strokeDasharray="2 2" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i < lit ? 3.4 : 2} fill={i < lit ? "#FFE27A" : "rgba(255,255,255,.25)"} className={i === lit - 1 ? "mvl-pulse" : ""} />)}
    </svg>
  );
}

// ------------------------------------------------------------------ home

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; history: Game[] }) => void }) {
  const save = useVial();
  const stage = save.stage, zone = zoneOf(stage);
  const cur = save.current;
  const zi = Math.floor((stage - 1) / STAGES_PER_ZONE) % ZONES.length;
  return (
    <div className="mvl-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Stage"], [Star, String(save.totalStars), "Stars"], [Sparkles, save.totalScore.toLocaleString(), "Score"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="mvl-glass flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0 text-[#FFE27A]" />
                <span className="min-w-0"><span className="mvl-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider text-white/60 uppercase">{k as string}</span></span>
              </div>
            );
          })}
        </div>

        <h1 className="mvl-display mvl-grad mvl-title mt-5">Moonvial</h1>
        <p className="mt-1 max-w-lg text-[15px] font-semibold text-white/80">Pour glowing potions until every vial holds one colour, and hand them to the star spirits. Stages never end — light up constellation after constellation.</p>

        <div className="mvl-shine relative mt-5 overflow-hidden rounded-[30px] p-5 text-white shadow-[0_24px_60px_-24px_rgba(154,107,255,.8)]" style={{ background: `linear-gradient(150deg, ${zone.sky[2]}, ${zone.sky[1]} 55%, ${zone.sky[0]})` }}>
          <p className="text-xs font-extrabold tracking-widest text-white/85 uppercase">{zone.name}{loopOf(stage) ? ` · Night ${loopOf(stage) + 1}` : ""}</p>
          <p className="mvl-display mt-1 text-5xl leading-none">Stage {cur?.stage ?? stage}</p>
          <ConstellationRow lit={((cur?.stage ?? stage) - 1) % STAGES_PER_ZONE} />
          <div className="mt-2 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, { game: cur.game, history: cur.history })} className="mvl-btn mvl-cta inline-flex items-center gap-2 px-6 py-3 text-lg"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useVial.getState().saveCurrent(null); onPlay(cur.stage); }} className="mvl-btn inline-flex items-center gap-1.5 bg-white/20 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : (
              <button type="button" onClick={() => onPlay(stage)} className="mvl-btn mvl-cta inline-flex items-center gap-2 px-8 py-3.5 text-xl"><Play className="size-6 fill-current" /> Play</button>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="mvl-display text-[24px] leading-none">Constellations</h2>
          <span className="text-xs font-bold text-white/60">10 stages each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ZONES.map((z, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_ZONE) > i || loopOf(stage) > 0;
            const now = i === zi;
            return (
              <div key={z.id} className={`mvl-glass !rounded-2xl p-3 ${done || now ? "" : "opacity-50"}`} style={{ background: `linear-gradient(150deg, ${z.sky[2]}55, ${z.sky[0]}aa)` }}>
                <p className="text-[13px] font-extrabold">{z.name}</p>
                <p className="text-[11px] font-bold text-white/70">{done ? "★ lit" : now ? `stage ${((stage - 1) % STAGES_PER_ZONE) + 1} of 10` : `from stage ${i * STAGES_PER_ZONE + 1}`}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[11px] font-bold text-white/45">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
