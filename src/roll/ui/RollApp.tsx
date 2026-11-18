"use client";
// Momo Sky Roll app shell — phone-first, feels like a native app: full-bleed 3D, thumb-zone buttons, bottom sheets,
// haptic taps, safe-area padding. Play is one endless run: the track keeps growing through every world, speed rushes
// come and go, coins / hearts / boosters lie on the road and grumpy spikes cost a life.
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, BookOpen, ChevronRight, Hand, Heart, Lock, Map as MapIcon, Play, RotateCcw, Shuffle, Sparkles, Star, Trophy, Users } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { CONCEPT, CONCEPTS } from "../data/concepts";
import { JOURNEY } from "../data/journey";
import { BOSS_CONCEPTS, dailyKey, dailyRecipe, decodeLab, encodeLab, fusionRecipe, labRecipe, rushRecipe } from "../fusion";
import { buildLevel, buildRecipe, cloneLevel, JOURNEY_LEN, journeyRecipe, runChunk } from "../levels";
import type { RunWorkerAsk, RunWorkerReply } from "../runWorker";
import { BOOST_K, RollSession, type Hud, type RunResult, type SessionOptions } from "../session";
import { CHARACTERS, useRoll, useRollHydrated, type RecordOutcome } from "../save";
import { moodOf, WORLDS, worldOf } from "../themes";
import type { Quality } from "../render";
import type { Level, SimEvent } from "../types";

type Screen = "title" | "map" | "game" | "modes" | "dex" | "chars";
type Run =
  | { kind: "run"; from: number }
  | { kind: "daily"; key: string }
  | { kind: "lab"; atoms: string[]; world: number; style: string; seed: number }
  | { kind: "rush" };
interface Toast { id: number; kind: "tip" | "zone" | "check" | "sprout" | "power" | "fever" | "life" | "hurt" | "speed" | "boost"; title: string; text?: string; emoji?: string }
/** revive after the last heart: paid with this run's coins, doubling each time */
const reviveCost = (n: number) => 100 * 2 ** n;

const ABILITY: Record<string, [string, string]> = {
  A01: ["🦘", "Jump — tap!"], A02: ["🦘", "Double jump — tap twice!"], A03: ["💨", "Dash"], A04: ["🎈", "Glide"], A05: ["🫧", "Shield"], A06: ["🔔", "Slow-mo"],
  A07: ["🧲", "Bead magnet"], A08: ["👯", "Twin roll"], A09: ["🛤️", "Rail grind"], A10: ["🧱", "Wall ride"], A11: ["🙃", "Ceiling roll"], A12: ["🚀", "Rocket shell"],
  A13: ["👻", "Ghost mode"], A14: ["🌉", "Stretch bridge"], A15: ["💥", "Super squash"],
};
const CAT_EMOJI: Record<string, string> = { floor: "🛣️", tile: "🟩", hazard: "🔨", ability: "⚡", camera: "🎥", rule: "📜", theme: "🌍", music: "🎵", boss: "👑", collect: "💎" };

function autoQuality(): Quality {
  if (typeof navigator === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 4;
  const touch = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0);
  if (cores <= 4) return "low";
  return touch ? "medium" : "high";
}
const tap = (haptics: boolean) => {
  audio.ensure(); void audio.resume();
  audio.play("pop", { gain: 0.35, rate: 1.25, duck: false });
  if (haptics) { try { navigator.vibrate?.(8); } catch { /* ignore */ } }
};

/** piece k of the endless run: Journey content first (1..200), then fusions forever */
function runPiece(k: number): Level {
  const rec = k <= JOURNEY_LEN ? journeyRecipe(k) : fusionRecipe(k, useRoll.getState().memory());
  return cloneLevel(runChunk(rec, String(k)));
}
function buildRun(run: Run): Level {
  switch (run.kind) {
    case "run": { const L = runPiece(run.from); L.kind = "run"; L.name = "Sky Run"; L.id = run.from; return L; }
    case "daily": return buildRecipe(dailyRecipe(run.key), `d:${run.key}`);
    case "lab": return buildRecipe(labRecipe(run.atoms, run.world, run.style, run.seed), `l:${run.atoms.join("+")}:${run.world}:${run.style}:${run.seed}`);
    case "rush": return buildRecipe(rushRecipe(), "rush");
  }
}
const runKeyOf = (r: Run) => JSON.stringify(r);

// ---------------------------------------------------------------- 3D stage
interface StageProps {
  run: Run | null; runId: number; attract: boolean; quality: Quality; kid: boolean; ch: string; autoStart: boolean;
  onSession: (s: RollSession | null) => void;
  onEvent?: (e: SimEvent) => void; onHud?: (h: Hud) => void; onFinish?: (r: RunResult) => void; onFps?: (f: number) => void;
}
function Stage(p: StageProps) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef(p);
  useEffect(() => { cb.current = p; });
  const player = usePlayer();
  const settings = useRef(player.settings);
  useEffect(() => { settings.current = player.settings; });
  const runKey = p.run ? runKeyOf(p.run) : "title";
  useEffect(() => {
    if (!host.current) return;
    const st = settings.current;
    const L = p.run ? buildRun(p.run) : buildLevel(0);
    // the endless run: hand out the next piece when asked, and build the one after it a little later (off the hot frame)
    // (built in a Web Worker; on the main thread only if the worker is missing or late)
    let runOpt: SessionOptions["run"];
    let worker: Worker | null = null;
    if (p.run?.kind === "run") {
      let k = p.run.from;
      const ready = new Map<number, Level>();
      const asked = new Set<number>();
      const m = useRoll.getState().memory();
      const mem = { seen: [...m.seen], recent: m.recent, promoted: m.promoted };
      try {
        worker = new Worker(new URL("../runWorker.ts", import.meta.url));
        worker.onmessage = (ev: MessageEvent<RunWorkerReply>) => { if (ev.data.L && ev.data.id > k) ready.set(ev.data.id, ev.data.L); };
        worker.onerror = () => { worker?.terminate(); worker = null; };
      } catch { worker = null; }
      const ask = (n: number) => { if (!worker || asked.has(n)) return; asked.add(n); worker.postMessage({ id: n, k: n, mem } satisfies RunWorkerAsk); };
      const make = (n: number) => { for (let i = 0; i < 3; i++) { try { return runPiece(n + i); } catch { /* try the next piece */ } } return null; };
      runOpt = { next: () => { k++; const got = ready.get(k) ?? make(k); ready.delete(k); ask(k + 1); return got; } };
      ask(k + 1);
    }
    const s = new RollSession(host.current, L, {
      quality: p.quality, kid: p.kid, sensitivity: useRoll.getState().sensitivity, haptics: st.haptics, shake: st.cameraShake,
      reduced: st.reducedMotion, renderScale: st.renderScale || 1, attract: p.attract, ch: p.ch, autoStart: p.autoStart, run: runOpt,
      onEvent: (e) => cb.current.onEvent?.(e), onHud: (h) => cb.current.onHud?.(h), onFinish: (r) => cb.current.onFinish?.(r), onFps: (f) => cb.current.onFps?.(f),
    });
    cb.current.onSession(s);
    return () => { worker?.terminate(); cb.current.onSession(null); s.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, p.runId, p.attract, p.quality, p.kid, p.ch]);
  return <div ref={host} className="absolute inset-0 overflow-hidden" style={{ touchAction: "none" }} />;
}

// ---------------------------------------------------------------- small pieces
function SproutIcon({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={on ? "drop-shadow-[0_0_6px_rgba(255,200,60,0.9)]" : "opacity-40"}>
      <path d="M12 22V12" stroke={on ? "#c98a00" : "#6b6488"} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12 13C12 8 8.5 5.5 3.5 5.5 3.5 10.5 7 13 12 13Z" fill={on ? "#ffc533" : "#8a82a8"} />
      <path d="M12 11C12 6.5 15 4 20.5 4 20.5 8.5 17.5 11 12 11Z" fill={on ? "#ffd84d" : "#9a93b8"} />
    </svg>
  );
}
const Coin = ({ size = 20 }: { size?: number }) => <Image src="/brand/coin.webp" alt="" width={size} height={size} className="shrink-0 drop-shadow" style={{ width: size, height: size }} />;
const Bead = ({ size = 18 }: { size?: number }) => (
  <span aria-hidden className="inline-block shrink-0 rounded-full shadow-[inset_-2px_-3px_0_rgba(0,0,0,0.25),0_0_8px_rgba(255,120,200,0.6)]" style={{ width: size, height: size, background: "radial-gradient(circle at 35% 30%, #fff 0 12%, #ff7ad0 13% 45%, #9b5de5 90%)" }} />
);
function Stars({ n, size = 18, animate = false }: { n: number; size?: number; animate?: boolean }) {
  return (
    <span className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} initial={animate ? { scale: 0, rotate: -40 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ delay: animate ? 0.3 + i * 0.25 : 0, type: "spring", stiffness: 420, damping: 14 }}>
          <Star className={i < n ? "fill-sun text-sun drop-shadow-[0_2px_0_#b8860b]" : "fill-white/10 text-white/25"} style={{ width: size, height: size }} />
        </motion.span>
      ))}
    </span>
  );
}
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
function Header({ title, kicker, onBack, right }: { title: string; kicker?: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-3 px-4 pb-3" style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)", paddingRight: "4.5rem" }}>
      <button onClick={onBack} aria-label="Back" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/15 active:scale-90"><ArrowLeft className="size-5" /></button>
      <div className="min-w-0">
        {kicker && <p className="text-[11px] font-bold tracking-widest text-white/60">{kicker}</p>}
        <h2 className="truncate font-display text-2xl leading-tight">{title}</h2>
      </div>
      <div className="ml-auto shrink-0">{right}</div>
    </header>
  );
}
const Panel = ({ children }: { children: React.ReactNode }) => (
  <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%", transition: { duration: 0.22 } }} transition={{ type: "spring", stiffness: 300, damping: 34 }}
    className="absolute inset-0 z-30 flex flex-col" style={{ background: "linear-gradient(180deg, rgba(22,12,51,0.7), rgba(22,12,51,0.94))", backdropFilter: "blur(4px)" }}>
    {children}
  </motion.div>
);
const Scroll = ({ children }: { children: React.ReactNode }) => (
  <div className="no-scrollbar flex-1 overflow-y-auto px-4" style={{ touchAction: "pan-y", overscrollBehavior: "contain", paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>{children}</div>
);

// ---------------------------------------------------------------- the app
export default function RollApp({ title }: { slug: string; title: string }) {
  const ready = useRollHydrated();
  const player = usePlayer();
  const { setLoading, setImmersive, setInRound, setMenu } = player;
  const ch = useRoll((s) => s.ch);
  const tutorial = useRoll((s) => s.tutorial);
  const runBest = useRoll((s) => s.runBest);
  const runWorld = useRoll((s) => s.runWorld);
  const bank = useRoll((s) => s.bank);
  const levels = useRoll((s) => s.levels);
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<Run | null>(null);
  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState<Hud | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [result, setResult] = useState<{ r: RunResult; o: RecordOutcome } | null>(null);
  const [over, setOver] = useState<RunResult | null>(null);
  const [revives, setRevives] = useState(0);
  const [hurt, setHurt] = useState(0);
  const [oops, setOops] = useState<{ pct: number; cp: number } | null>(null);
  const session = useRef<RollSession | null>(null);
  const titleSession = useRef<RollSession | null>(null);
  const toastId = useRef(0);
  const recorded = useRef(false);
  const maxWorld = useRef(1);
  const lastWorld = useRef(0);
  const tier = useRef(1);
  const quality: Quality = player.settings.quality === "auto" ? autoQuality() : player.settings.quality;
  const kid = player.settings.speedAssist;
  const haptics = player.settings.haptics;
  const isRun = run?.kind === "run";
  const level = useMemo(() => (run && run.kind !== "run" && screen === "game" ? buildRun(run) : null), [run, screen]);
  // worlds open to start from: reached in a run (or cleared in the old level-by-level Journey)
  const openWorlds = useMemo(() => {
    let w = runWorld;
    for (const [k, v] of Object.entries(levels)) if (v.done) w = Math.max(w, Math.min(20, Math.floor(Number(k) / 10) + 1));
    return Math.max(1, Math.min(20, w));
  }, [levels, runWorld]);

  useEffect(() => { setLoading(null); }, [setLoading]);
  useEffect(() => { void audio.preload(["pop", "boing", "hop", "squish", "sparkle", "confetti", "tada", "whooshLong", "clack", "a:whooshIn", "a:whooshOut", "a:zap", "a:bonk", "a:splat", "a:slideDown", "a:poof", "a:twinkle", "a:cheer", "a:applause", "a:ding", "a:levelup", "a:teleport", "a:sparks", "v:momo_wow", "v:momo_sad", "v:momo_happy", "v:kranky_laugh"]); }, []);
  useEffect(() => { setImmersive(screen !== "title"); setInRound(screen === "game" && !result && !over); }, [screen, result, over, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => {
    const s = screen === "game" ? session.current : titleSession.current;
    if (!s) return;
    if (player.paused) s.pause(); else s.resume();
  }, [player.paused, screen]);

  const pushToast = useCallback((t: Omit<Toast, "id">, ms = 3000) => {
    const id = ++toastId.current;
    setToasts((x) => [...x.filter((y) => y.kind !== t.kind || t.kind === "tip"), { ...t, id }].slice(-3));
    window.setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), ms);
  }, []);

  /** save the run once: distance, coins (to the bank + wallet), furthest world */
  const recordRun = useCallback(() => {
    const s = session.current;
    if (!s || recorded.current || s.L.kind !== "run") return;
    recorded.current = true;
    useRoll.getState().record({ ...s.result(false), world: maxWorld.current });
  }, []);

  const start = useCallback((r: Run) => {
    audio.ensure(); void audio.resume();
    setResult(null); setOver(null); setOops(null); setToasts([]); setHud(null); setRevives(0); setHurt(0);
    recorded.current = false; tier.current = 1;
    const w0 = r.kind === "run" ? Math.ceil(r.from / 10) : 1;
    maxWorld.current = w0; lastWorld.current = w0;
    setRun(r); setRunId((k) => k + 1);
    setScreen("game");
  }, []);

  const quitTo = useCallback((to: Screen) => {
    recordRun();
    setResult(null); setOver(null); setOops(null); setToasts([]);
    setScreen(to);
  }, [recordRun]);

  useEffect(() => {
    if (screen !== "game") { setMenu([]); return; }
    setMenu([
      { id: "restart", label: "Restart", icon: "🔄", onSelect: () => { if (run) { recordRun(); start(run); } } },
      { id: "levels", label: "Worlds", icon: "🗺️", onSelect: () => quitTo("map") },
    ]);
  }, [screen, setMenu, quitTo, recordRun, start, run]);

  // speed rushes: tell the player when it speeds up and when it calms down
  useEffect(() => {
    if (!hud || !isRun || hud.phase !== "play" || hud.reviving) return;
    const raw = hud.boost > 0 ? hud.speed / BOOST_K : hud.speed;
    const tt = raw >= 1.85 ? 2 : raw >= 1.4 ? 1.5 : 1;
    if (tt === tier.current) return;
    if (tt > tier.current) pushToast({ kind: "speed", title: `SPEED ×${tt}`, emoji: tt >= 2 ? "🔥" : "⚡" }, 1800);
    else if (tt === 1) pushToast({ kind: "speed", title: "Normal speed", emoji: "😮‍💨" }, 1400);
    tier.current = tt;
  }, [hud, isRun, pushToast]);

  const onEvent = useCallback((e: SimEvent) => {
    const L = session.current?.L;
    if (!L) return;
    const runMode = L.kind === "run";
    switch (e.t) {
      case "tip": if (!runMode) pushToast({ kind: "tip", title: e.tip.title, text: e.tip.text, emoji: "✨" }, 4200); break;
      case "zone": {
        const z = L.zones[e.zone]; const m = moodOf(z.mood);
        if (!runMode) { pushToast({ kind: "zone", title: z.boss ? "Boss!" : m.name, emoji: z.boss ? "👑" : m.emoji }, 2400); break; }
        // the run only names a new world (no stage numbers) — and bosses
        if (z.boss) pushToast({ kind: "zone", title: "Boss!", emoji: "👑" }, 2000);
        else if (m.world !== lastWorld.current) { const w = worldOf(m.world); pushToast({ kind: "zone", title: w.name, emoji: w.emoji }, 2400); }
        lastWorld.current = m.world;
        if (m.world <= 20) maxWorld.current = Math.max(maxWorld.current, m.world);
        break;
      }
      case "checkpoint": if (!runMode) pushToast({ kind: "check", title: "Checkpoint!", emoji: "🚩" }, 1600); break;
      case "sprout": if (!runMode) pushToast({ kind: "sprout", title: `Golden Sprout ${e.n}/3`, emoji: "🌱" }, 1800); else pushToast({ kind: "sprout", title: "+25 coins", emoji: "🌱" }, 1500); break;
      case "ability": if (e.on && ABILITY[e.ab]) pushToast({ kind: "power", title: ABILITY[e.ab][1], emoji: ABILITY[e.ab][0] }, 2600); break;
      case "fever": if (e.on) pushToast({ kind: "fever", title: "FEVER ×2", emoji: "🌈" }, 2200); break;
      case "pickup": if (e.kind === "booster") pushToast({ kind: "boost", title: "BOOSTER! 30s", emoji: "🚀" }, 2200); break;
      case "life":
        if (e.delta > 0) pushToast({ kind: "life", title: "+1 Life", emoji: "❤️" }, 1600);
        else if (e.delta < 0) { setHurt((k) => k + 1); if (e.lives > 0) pushToast({ kind: "hurt", title: e.lives === 1 ? "Last life!" : `${e.lives} lives left`, emoji: "💔" }, 1600); }
        break;
      case "dead": { const s = session.current!; if (!L.oneLife && !runMode) setOops({ pct: s.sim.progress, cp: s.sim.cp }); break; }
      case "respawn": window.setTimeout(() => setOops(null), 450); break;
      case "start": if (!useRoll.getState().tutorial) useRoll.getState().setTutorial(true); break;
    }
  }, [pushToast]);

  const onFinish = useCallback((r: RunResult) => {
    if (r.kind === "run") { setOver(r); return; }
    const o = useRoll.getState().record(r);
    setResult({ r, o });
  }, []);

  const revive = useCallback(() => {
    const s = session.current;
    if (!s || !s.revive(reviveCost(revives))) return;
    setRevives((n) => n + 1); setOver(null); tier.current = 1;
  }, [revives]);

  if (!ready) return <div className="absolute inset-0 bg-[#0b0718]" />;
  const startWorld = run?.kind === "run" ? worldOf(Math.ceil(run.from / 10)) : null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#9fdcff] select-none" style={{ overscrollBehavior: "none", WebkitTapHighlightColor: "transparent" }}>
      {screen === "game" && run ? (
        <Stage key="game" run={run} runId={runId} attract={false} quality={quality} kid={kid} ch={ch} autoStart={isRun}
          onSession={(s) => { session.current = s; }} onEvent={onEvent} onHud={setHud} onFinish={onFinish} onFps={player.reportFps} />
      ) : (
        <Stage key="title" run={null} runId={0} attract quality={quality === "high" ? "medium" : quality} kid={false} ch={ch} autoStart={false}
          onSession={(s) => { titleSession.current = s; }} onFps={player.reportFps} />
      )}

      <AnimatePresence mode="wait">
        {screen === "title" && (
          <TitleScreen key="title" title={title} best={runBest} bank={bank} worlds={openWorlds}
            onPlay={() => { tap(haptics); start({ kind: "run", from: 1 }); }}
            onNav={(s) => { tap(haptics); titleSession.current?.playTitleMusic(); setScreen(s); }}
            onTouch={() => titleSession.current?.playTitleMusic()} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {screen === "map" && <WorldsScreen key="map" open={openWorlds} onBack={() => { tap(haptics); setScreen("title"); }} onPick={(w) => { tap(haptics); start({ kind: "run", from: (w - 1) * 10 + 1 }); }} />}
        {screen === "modes" && <ModesScreen key="modes" onBack={() => { tap(haptics); setScreen("title"); }} onRun={(r) => { tap(haptics); start(r); }} />}
        {screen === "dex" && <DexScreen key="dex" onBack={() => { tap(haptics); setScreen("title"); }} />}
        {screen === "chars" && <CharsScreen key="chars" haptics={haptics} onBack={() => { tap(haptics); setScreen("title"); }} />}
      </AnimatePresence>

      {screen === "game" && !result && !over && hud && (isRun ? <RunHud hud={hud} best={runBest} /> : level && <GameHud hud={hud} L={level} />)}
      {screen === "game" && !isRun && !result && (!hud || hud.phase === "ready") && level && <StartHint name={level.name} n={level.id} kind={level.kind} first={!tutorial} />}
      {screen === "game" && (hud?.phase === "countin" && hud.count > 0) && (
        <CountIn n={hud.count} title={startWorld && hud.meters < 3 ? `${startWorld.emoji} ${startWorld.name}` : undefined} sub={startWorld && hud.meters < 3 ? (tutorial ? "Collect coins · dodge the grumpies" : "Drag left / right to steer") : undefined} />
      )}

      {hurt > 0 && screen === "game" && <motion.div key={hurt} initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.8 }} className="pointer-events-none absolute inset-0 z-10" style={{ boxShadow: "inset 0 0 110px rgba(255,40,80,0.8)" }} />}
      {screen === "game" && isRun && hud && hud.boost > 0 && !over && <div className="pointer-events-none absolute inset-0 z-10" style={{ boxShadow: "inset 0 0 80px rgba(70,210,255,0.35)" }} />}
      <AnimatePresence>
        {screen === "game" && toasts.length > 0 && !result && !over && <Toasts key="toasts" toasts={toasts} />}
        {screen === "game" && oops && !result && <Oops key="oops" pct={oops.pct} cp={oops.cp} />}
      </AnimatePresence>
      {screen === "game" && hud?.fever && !result && !over && <div className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded-none ring-[6px] ring-inset ring-fuchsia-400/60" style={{ boxShadow: "inset 0 0 60px rgba(255,120,220,0.45)" }} />}

      <AnimatePresence>
        {over && run?.kind === "run" && (
          <RunOver key={`o${runId}-${revives}`} r={over} best={runBest} cost={reviveCost(revives)} coins={hud?.beads ?? over.beads}
            onRevive={() => { tap(haptics); revive(); }}
            onAgain={() => { tap(haptics); recordRun(); start(run); }}
            onMenu={() => { tap(haptics); quitTo("title"); }} />
        )}
        {result && run && <Results key={`r${runId}`} run={run} result={result} onAgain={() => { tap(haptics); start(run); }} onMenu={() => { tap(haptics); quitTo("title"); }} />}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- title
function TitleScreen({ title, best, bank, worlds, onPlay, onNav, onTouch }: { title: string; best: number; bank: number; worlds: number; onPlay: () => void; onNav: (s: Screen) => void; onTouch: () => void }) {
  const [first, ...rest] = title.split(" ");
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }} onPointerDown={onTouch}
      className="absolute inset-0 flex flex-col items-center justify-between px-5 text-center short:flex-row short:justify-around short:gap-6 short:px-8"
      style={{ paddingTop: "calc(var(--safe-top) + 4.5rem)", paddingBottom: "calc(var(--safe-bottom) + 1.25rem)", background: "linear-gradient(180deg, rgba(12,6,31,0.35) 0%, rgba(12,6,31,0) 30%, rgba(12,6,31,0) 50%, rgba(12,6,31,0.8) 100%)" }}>
      <div className="flex flex-col items-center">
        <motion.p initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold tracking-wide text-[#7a3cff] shadow">🎵 ROLL TO THE BEAT</motion.p>
        <motion.h1 initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }} className="mt-3 font-display leading-[0.85] drop-shadow-[0_6px_0_rgba(60,20,90,0.55)]">
          <span className="block text-[clamp(3.2rem,16vw,6.5rem)] text-momo [-webkit-text-stroke:3px_#5a2100] short:text-[min(16vh,4.6rem)]">{first}</span>
          <span className="block text-[clamp(2.6rem,13vw,5.4rem)] text-white [-webkit-text-stroke:3px_#3b2878] short:text-[min(13vh,3.8rem)]">{rest.join(" ")}</span>
        </motion.h1>
      </div>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 220, damping: 20 }} className="flex w-full max-w-sm flex-col items-center gap-2.5 short:max-w-xs short:gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-white drop-shadow">
          <span className="flex items-center gap-1 rounded-full bg-ink/45 px-3 py-1 backdrop-blur"><Trophy className="size-4 text-sun" /> {best} m</span>
          <span className="flex items-center gap-1 rounded-full bg-ink/45 px-3 py-1 backdrop-blur"><Coin size={16} /> {bank}</span>
          <span className="flex items-center gap-1 rounded-full bg-ink/45 px-3 py-1 backdrop-blur"><MapIcon className="size-4 text-mint" /> {worlds}/20</span>
        </div>
        <button onClick={onPlay} className="btn-clay lg w-full !py-3.5 !text-2xl">
          <Play className="size-7 fill-current" />
          <span className="flex flex-col items-start leading-none"><span>Play</span><span className="mt-1 text-xs font-bold opacity-80">{best > 0 ? `Beat ${best} m!` : "Roll as far as you can"}</span></span>
        </button>
        <div className="grid w-full grid-cols-2 gap-2">
          <button onClick={() => onNav("map")} className="btn-clay grape w-full !text-base"><MapIcon className="size-5" /> Worlds</button>
          <button onClick={() => onNav("modes")} className="btn-clay mint w-full !text-base"><Sparkles className="size-5" /> Modes</button>
          <button onClick={() => onNav("dex")} className="btn-clay ghost w-full !text-base"><BookOpen className="size-5" /> Dex</button>
          <button onClick={() => onNav("chars")} className="btn-clay ghost w-full !text-base"><Users className="size-5" /> Rollers</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------- worlds: where the run starts
function WorldsScreen({ open, onBack, onPick }: { open: number; onBack: () => void; onPick: (w: number) => void }) {
  return (
    <Panel>
      <Header title="Worlds" kicker={`START ANYWHERE YOU REACHED · ${open}/20`} onBack={onBack} />
      <Scroll>
        <p className="mx-auto mb-3 max-w-md text-center text-sm text-white/70">It is one endless run through every world. Reach a world in a run and you can start from it next time.</p>
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2.5 pb-4 short:max-w-4xl short:grid-cols-4">
          {JOURNEY.map((jw, i) => {
            const w = worldOf(jw.id);
            const ok = jw.id <= open;
            const m = moodOf(w.moods[0]);
            return (
              <motion.button key={jw.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(0.5, 0.02 * i) }} disabled={!ok} onClick={() => onPick(jw.id)}
                className={`relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-3xl p-3 text-left ring-1 transition active:scale-[0.96] ${ok ? "ring-white/25 shadow-[inset_0_-6px_0_rgba(0,0,0,0.2)]" : "ring-white/8"}`}
                style={{ background: ok ? `linear-gradient(155deg, ${hex(m.tileA)}, ${hex(m.side)})` : "#2d2350", color: ok ? "#fff" : "#8a7fb0" }}>
                <span className="absolute top-2 right-3 text-4xl drop-shadow">{ok ? w.emoji : "🔒"}</span>
                <span className="text-[11px] font-extrabold tracking-wider opacity-85">WORLD {jw.id}</span>
                <span className="font-display text-lg leading-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">{w.name}</span>
                {ok && <span className="absolute top-2.5 left-3 grid size-7 place-items-center rounded-full bg-white/90 text-ink shadow"><Play className="size-3.5 fill-current" /></span>}
              </motion.button>
            );
          })}
        </div>
      </Scroll>
    </Panel>
  );
}

// ---------------------------------------------------------------- modes
function ModesScreen({ onBack, onRun }: { onBack: () => void; onRun: (r: Run) => void }) {
  const daily = useRoll((s) => s.daily);
  const rush = useRoll((s) => s.rushBest);
  const dex = useRoll((s) => s.dex);
  const levels = useRoll((s) => s.levels);
  const key = dailyKey();
  const dName = useMemo(() => dailyRecipe(key).name, [key]);
  const [lab, setLab] = useState<string[]>([]);
  const [labWorld, setLabWorld] = useState(1);
  const [labStyle, setLabStyle] = useState("M01");
  const [code, setCode] = useState("");
  const labPool = useMemo(() => CONCEPTS.filter((c) => "FTHACR".includes(c.id[0]) && dex.includes(c.id)), [dex]);
  const runWorld = useRoll((s) => s.runWorld);
  const rushOpen = runWorld >= 4 || Object.values(levels).filter((l) => l.done).length >= 30;
  const doneDaily = daily.key === key && daily.done;
  const labSeed = 1234;
  return (
    <Panel>
      <Header title="Modes" kicker="PLAY YOUR WAY" onBack={onBack} />
      <Scroll>
        <div className="mx-auto grid max-w-lg gap-3 pb-4">
          <button onClick={() => onRun({ kind: "daily", key })} className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-amber-400 to-pink-500 p-4 text-left text-ink shadow-lg active:scale-[0.98]">
            <span className="text-4xl">📅</span>
            <span className="flex-1"><span className="block font-display text-2xl leading-tight">Daily Fusion</span><span className="block text-sm font-bold opacity-80">{dName}</span><span className="text-xs font-bold">{doneDaily ? `✅ Done today · streak ${daily.streak}` : `Streak ${daily.streak} · same level for everyone today`}</span></span>
            <ChevronRight className="size-6" />
          </button>
          <button disabled={!rushOpen} onClick={() => onRun({ kind: "rush" })} className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-rose-500 to-orange-500 p-4 text-left shadow-lg active:scale-[0.98] disabled:opacity-45">
            <span className="text-4xl">👑</span>
            <span className="flex-1"><span className="block font-display text-2xl leading-tight">Boss Rush</span><span className="block text-sm font-bold opacity-85">{BOSS_CONCEPTS.length} bosses back to back</span><span className="text-xs font-bold">{rushOpen ? (rush ? `Best ${rush}s` : "No clear yet") : "🔒 Reach world 4 in a run"}</span></span>
            <ChevronRight className="size-6" />
          </button>
          <div className="rounded-3xl bg-white/8 p-4 ring-1 ring-white/12">
            <p className="flex items-center gap-2 font-display text-2xl"><Shuffle className="size-6" /> Concept Lab</p>
            <p className="text-sm text-white/65">Mix up to 3 concepts you have discovered into your own level.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {labPool.length === 0 && <span className="text-sm text-white/55">Play a few levels to discover concepts!</span>}
              {labPool.map((c) => {
                const on = lab.includes(c.id);
                return <button key={c.id} onClick={() => setLab((x) => (on ? x.filter((y) => y !== c.id) : [...x, c.id].slice(-3)))} className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 active:scale-95 ${on ? "bg-sun text-ink ring-sun" : "bg-white/8 ring-white/15"}`}>{CAT_EMOJI[c.cat]} {c.name}</button>;
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select value={labWorld} onChange={(e) => setLabWorld(+e.target.value)} className="rounded-xl bg-ink/60 px-3 py-2.5 text-sm font-bold ring-1 ring-white/15">{WORLDS.map((w) => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}</select>
              <select value={labStyle} onChange={(e) => setLabStyle(e.target.value)} className="rounded-xl bg-ink/60 px-3 py-2.5 text-sm font-bold ring-1 ring-white/15">{CONCEPTS.filter((c) => c.cat === "music").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <button disabled={!lab.length} onClick={() => onRun({ kind: "lab", atoms: lab, world: labWorld, style: labStyle, seed: labSeed })} className="btn-clay mt-3 w-full !text-lg disabled:opacity-50"><Play className="size-5 fill-current" /> Build & play</button>
            {lab.length > 0 && <p className="mt-2 text-center text-xs font-bold text-white/70">Share code: <span className="select-all rounded bg-ink/60 px-2 py-0.5 font-mono text-sun">{encodeLab(lab, labWorld, labStyle, labSeed)}</span></p>}
            <div className="mt-3 flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MOMO-XXXXXXXXXXXX" aria-label="Share code" className="min-w-0 flex-1 rounded-xl bg-ink/60 px-3 py-2.5 font-mono text-sm uppercase ring-1 ring-white/15 outline-none" />
              <button onClick={() => { const d = decodeLab(code); if (d) onRun({ kind: "lab", ...d }); }} className="btn-clay grape !px-4 !text-base">Load</button>
            </div>
          </div>
        </div>
      </Scroll>
    </Panel>
  );
}

// ---------------------------------------------------------------- Concept Dex
function DexScreen({ onBack }: { onBack: () => void }) {
  const dex = useRoll((s) => s.dex);
  const fusions = useRoll((s) => s.fusions);
  const found = new Set(dex);
  const cats: [string, string][] = [["floor", "Floors"], ["tile", "Tiles"], ["hazard", "Hazards"], ["ability", "Abilities"], ["camera", "Cameras"], ["rule", "Rules"], ["theme", "Worlds"], ["music", "Music"], ["boss", "Bosses"], ["collect", "Collectibles"]];
  const count = CONCEPTS.filter((c) => found.has(c.id)).length;
  return (
    <Panel>
      <Header title="Concept Dex" kicker={`${count}/${CONCEPTS.length} + ${fusions.length} FUSIONS`} onBack={onBack} />
      <Scroll>
        <div className="mx-auto max-w-2xl pb-4">
          {fusions.length > 0 && (
            <section className="mb-4">
              <h3 className="mb-2 font-display text-xl">🧪 Fusions you created</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[...fusions].reverse().slice(0, 60).map((f) => (
                  <div key={f.key} className="rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-violet-600/30 p-3 ring-1 ring-white/15">
                    <p className="text-[11px] font-bold text-white/60">#{f.n}</p>
                    <p className="font-display text-lg leading-tight">{f.name}</p>
                    <p className="text-xs text-white/70">{f.atoms.map((a) => CONCEPT[a]?.name ?? a).join(" + ")}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {cats.map(([cat, label]) => {
            const list = CONCEPTS.filter((c) => c.cat === cat);
            return (
              <section key={cat} className="mb-4">
                <h3 className="mb-2 font-display text-xl">{CAT_EMOJI[cat]} {label} <span className="text-sm text-white/50">{list.filter((c) => found.has(c.id)).length}/{list.length}</span></h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {list.map((c) => {
                    const on = found.has(c.id);
                    return (
                      <div key={c.id} className={`rounded-2xl p-2.5 ring-1 ${on ? "bg-white/12 ring-white/20" : "bg-white/4 ring-white/8"}`}>
                        <p className="text-[10px] font-bold text-white/45">#{CONCEPTS.indexOf(c) + 1} · {c.id}</p>
                        <p className={`text-sm font-extrabold leading-tight ${on ? "" : "text-white/35"}`}>{on ? c.name : "???"}</p>
                        {on && c.desc && <p className="mt-0.5 line-clamp-2 text-[11px] text-white/60">{c.desc}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </Scroll>
    </Panel>
  );
}

// ---------------------------------------------------------------- characters
function CharsScreen({ onBack, haptics }: { onBack: () => void; haptics: boolean }) {
  const bank = useRoll((s) => s.bank);
  const owned = useRoll((s) => s.owned);
  const ch = useRoll((s) => s.ch);
  return (
    <Panel>
      <Header title="Rollers" kicker="PICK YOUR BALL" onBack={onBack} right={<span className="flex items-center gap-1 rounded-full bg-ink/60 px-3 py-1.5 font-display text-lg"><Bead size={16} />{bank}</span>} />
      <Scroll>
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 pb-4 sm:grid-cols-3">
          {CHARACTERS.map((c) => {
            const have = owned.includes(c.id);
            const sel = ch === c.id;
            return (
              <button key={c.id} onClick={() => { tap(haptics); if (have) useRoll.getState().choose(c.id); else useRoll.getState().buy(c.id); }}
                className={`flex flex-col items-center rounded-3xl p-3 text-center ring-1 transition active:scale-95 ${sel ? "bg-white/16 ring-2 ring-sun" : "bg-white/8 ring-white/15"}`}>
                <span className="relative grid size-20 place-items-center rounded-full shadow-[inset_-6px_-8px_0_rgba(0,0,0,0.22),0_8px_18px_-6px_rgba(0,0,0,0.5)]" style={{ background: `radial-gradient(circle at 35% 30%, #ffffffaa 0 10%, ${c.color} 30%)` }}>
                  {!have && <Lock className="size-7 text-white/90" />}
                </span>
                <span className="mt-2 font-display text-lg leading-tight">{c.name}</span>
                <span className="text-[11px] font-semibold text-white/65">{c.perk}</span>
                <span className={`mt-2 rounded-full px-3 py-1 text-xs font-extrabold ${sel ? "bg-sun text-ink" : have ? "bg-white/12" : bank >= c.price ? "bg-lime text-ink" : "bg-white/8 text-white/50"}`}>
                  {sel ? "Rolling!" : have ? "Pick" : <span className="flex items-center gap-1"><Bead size={12} />{c.price}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mx-auto max-w-md pb-6 text-center text-xs text-white/55">Beads you collect go into your bead jar — spend them on new rollers.</p>
      </Scroll>
    </Panel>
  );
}

// ---------------------------------------------------------------- in-game HUD
function GameHud({ hud, L }: { hud: Hud; L: Level }) {
  const pct = Math.round(hud.pct * 100);
  const total = L.pickups.filter((p) => p.kind === "bead").length;
  const endless = L.kind === "endless";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3" style={{ paddingTop: "calc(var(--safe-top) + 0.6rem)", paddingRight: "calc(var(--safe-right, 0px) + 4.2rem)", paddingLeft: "calc(var(--safe-left, 0px) + 0.75rem)" }}>
      <div className="flex items-center gap-2.5">
        <div className="flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-ink/50 px-3 ring-1 ring-white/15 backdrop-blur-md">
          <Bead size={18} /><span className="font-display text-xl tabular-nums">{hud.beads}</span>{!endless && <span className="text-xs font-bold text-white/50">/{total}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-4 overflow-hidden rounded-full bg-ink/45 ring-1 ring-white/20 backdrop-blur">
            <div className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ${hud.fever ? "bg-[linear-gradient(90deg,#ff5d8f,#ffd23d,#5fe08a,#46d2ff,#9b6bff)]" : "bg-gradient-to-r from-lime via-sun to-momo"}`} style={{ width: `${Math.max(3, pct)}%` }} />
            {L.checkpoints.slice(1).map((s) => <span key={s} className="absolute top-0.5 bottom-0.5 w-1 rounded-full bg-white/80" style={{ left: `${((s - 1) / (L.finish - 1)) * 100}%` }} />)}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 px-0.5 text-[11px] font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            <span className="truncate">{L.kind === "journey" ? `${L.id}. ` : ""}{L.name}</span>
            <span className="font-display text-base tabular-nums">{endless ? `${Math.round(hud.pct * L.finish)} m` : `${pct}%`}</span>
          </div>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-center gap-2">
        <span className="flex gap-1">{[0, 1, 2].map((k) => <SproutIcon key={k} on={k < hud.sprouts} size={20} />)}</span>
        {hud.abilities.filter((a) => ABILITY[a]).map((a) => <span key={a} className="rounded-full bg-ink/55 px-2 py-0.5 text-xs font-bold backdrop-blur">{ABILITY[a][0]} {ABILITY[a][1].split(" — ")[0]}</span>)}
        {hud.shield && <span className="rounded-full bg-mint/80 px-2 py-0.5 text-xs font-bold text-ink">🫧</span>}
        {hud.fever && <span className="animate-pulse rounded-full bg-fuchsia-500 px-2 py-0.5 text-xs font-extrabold">FEVER ×2</span>}
        {!hud.fever && hud.streak >= 3 && hud.streak < 8 && <span className="rounded-full bg-ink/50 px-2 py-0.5 text-[11px] font-bold text-white/80">🔥 {hud.streak}/8</span>}
      </div>
    </div>
  );
}

function StartHint({ n, name, kind, first }: { n: number; name: string; kind: string; first: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-6 text-center short:items-end short:pr-[calc(var(--safe-right,0px)+1.5rem)] short:text-right" style={{ paddingBottom: "calc(var(--safe-bottom) + 2.5rem)" }}>
      <p className="font-display text-[clamp(1.6rem,7vw,2.4rem)] text-white drop-shadow-[0_4px_0_rgba(40,20,70,0.6)] short:text-2xl">{kind === "journey" ? `${n}. ` : ""}{name}</p>
      <div className="relative mt-5 h-16 w-56 short:mt-1 short:h-12 short:w-44">
        <div className="absolute inset-x-6 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/35" />
        <motion.div className="absolute top-1/2 left-1/2 -translate-y-1/2" animate={{ x: [-70, 50, -70] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
          <Hand className="size-12 -rotate-12 fill-white text-ink drop-shadow-lg" />
        </motion.div>
      </div>
      <p className="mt-2 rounded-full bg-ink/55 px-4 py-2 text-base font-bold text-white backdrop-blur">{first ? "Touch & drag left / right to steer" : "Touch to roll!"}</p>
    </motion.div>
  );
}

function CountIn({ n, title, sub }: { n: number; title?: string; sub?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
      {title && <motion.p initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-1 rounded-full bg-ink/55 px-4 py-1 text-sm font-extrabold text-white/90 backdrop-blur">{sub}</motion.p>}
      {title && <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-2 px-6 text-center font-display text-[clamp(1.8rem,8vw,3rem)] leading-tight text-white drop-shadow-[0_5px_0_rgba(60,20,90,0.6)]">{title}</motion.p>}
      <motion.span key={n} initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }} className="font-display text-[8rem] leading-none text-white drop-shadow-[0_8px_0_rgba(60,20,90,0.6)] short:text-[5rem]">{n}</motion.span>
    </div>
  );
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-2 px-4" style={{ top: "calc(var(--safe-top) + 6.4rem)" }}>
      <AnimatePresence>
        {toasts.map((t) => t.kind === "zone" ? (
          <motion.div key={t.id} initial={{ opacity: 0, scale: 0.7, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="font-display text-[clamp(1.5rem,7vw,2.3rem)] text-white drop-shadow-[0_4px_0_rgba(40,20,70,0.55)]">{t.emoji} {t.title}</motion.div>
        ) : t.kind === "tip" ? (
          <motion.div key={t.id} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} className="flex max-w-sm items-start gap-3 rounded-3xl bg-white/92 px-4 py-3 text-left text-ink shadow-xl">
            <span className="mt-0.5 rounded-full bg-sun px-2 py-0.5 text-[11px] font-extrabold">NEW</span>
            <span><span className="block font-display text-lg leading-tight">{t.title}</span><span className="block text-sm font-semibold text-ink/75">{t.text}</span></span>
          </motion.div>
        ) : (
          <motion.div key={t.id} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className={`rounded-full px-5 py-2 font-display text-xl shadow-lg ${t.kind === "sprout" ? "bg-sun text-ink" : t.kind === "fever" ? "bg-fuchsia-500 text-white" : t.kind === "power" ? "bg-white text-ink" : "bg-mint text-ink"}`}>{t.emoji} {t.title}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Oops({ pct, cp }: { pct: number; cp: number }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-ink/25">
      <motion.div initial={{ scale: 0.5, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 16 }} className="flex flex-col items-center">
        <Image src="/brand/momo-surprised.webp" alt="" width={140} height={140} className="size-28 object-contain drop-shadow-xl short:size-20" />
        <p className="font-display text-5xl text-white drop-shadow-[0_5px_0_rgba(60,20,90,0.6)]">Oops!</p>
        <p className="mt-1 rounded-full bg-ink/55 px-4 py-1.5 text-sm font-bold text-white">{Math.round(pct * 100)}% · back to {cp === 0 ? "the start" : `checkpoint ${cp}`}</p>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------- the endless run: HUD + game over
function RunHud({ hud, best }: { hud: Hud; best: number }) {
  const slots = Math.max(3, hud.lives);
  const raw = hud.boost > 0 ? hud.speed / BOOST_K : hud.speed;
  const tt = raw >= 1.85 ? 2 : raw >= 1.4 ? 1.5 : 1;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3" style={{ paddingTop: "calc(var(--safe-top) + 0.6rem)", paddingRight: "calc(var(--safe-right, 0px) + 4.2rem)", paddingLeft: "calc(var(--safe-left, 0px) + 0.75rem)" }}>
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-start gap-1.5">
          <div className={`flex h-10 items-center gap-0.5 rounded-2xl bg-ink/50 px-2 ring-1 backdrop-blur-md ${hud.lives === 1 ? "animate-pulse ring-rose-400/80" : "ring-white/15"}`} aria-label={`${hud.lives} lives`}>
            {Array.from({ length: slots }, (_, i) => (
              <motion.span key={`${i}-${i < hud.lives}`} initial={{ scale: i < hud.lives ? 1.6 : 1.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
                <Heart className={i < hud.lives ? "size-6 fill-[#ff3d6e] text-[#ff3d6e] drop-shadow-[0_2px_0_rgba(120,0,40,0.5)]" : "size-6 text-white/30"} />
              </motion.span>
            ))}
          </div>
          <div className="flex h-10 items-center gap-1.5 rounded-2xl bg-ink/50 px-3 ring-1 ring-white/15 backdrop-blur-md">
            <Coin size={20} /><span className="font-display text-xl tabular-nums">{hud.beads}</span>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end text-right drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]">
          <span className="font-display text-[clamp(1.6rem,8vw,2.3rem)] leading-none tabular-nums">{hud.meters}<span className="text-base"> m</span></span>
          <span className={`mt-0.5 text-[11px] font-extrabold tracking-wide ${best > 0 && hud.meters > best ? "text-sun" : "text-white/75"}`}>{best > 0 && hud.meters > best ? "NEW BEST!" : `BEST ${best} m`}</span>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
        {tt > 1 && hud.boost <= 0 && <motion.span key={tt} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 12 }} className={`rounded-full px-3 py-0.5 font-display text-lg shadow-lg ${tt >= 2 ? "bg-gradient-to-r from-rose-500 to-orange-400" : "bg-gradient-to-r from-orange-400 to-amber-300 text-ink"}`}>{tt >= 2 ? "🔥" : "⚡"} {tt}x</motion.span>}
        {hud.boost > 0 && (
          <span className="flex items-center gap-2 rounded-full bg-sky-500/85 px-3 py-0.5 font-display text-lg shadow-lg">
            🚀 <span className="relative h-2 w-16 overflow-hidden rounded-full bg-white/30"><span className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${(hud.boost / 30) * 100}%` }} /></span><span className="tabular-nums">{Math.ceil(hud.boost)}s</span>
          </span>
        )}
        {hud.abilities.filter((a) => ABILITY[a]).map((a) => <span key={a} className="rounded-full bg-ink/55 px-2 py-0.5 text-xs font-bold backdrop-blur">{ABILITY[a][0]} {ABILITY[a][1].split(" — ")[0]}</span>)}
        {hud.shield && <span className="rounded-full bg-mint/80 px-2 py-0.5 text-xs font-bold text-ink">🫧</span>}
        {hud.fever && <span className="animate-pulse rounded-full bg-fuchsia-500 px-2 py-0.5 text-xs font-extrabold">FEVER ×2</span>}
        {!hud.fever && hud.streak >= 3 && hud.streak < 8 && <span className="rounded-full bg-ink/50 px-2 py-0.5 text-[11px] font-bold text-white/80">🔥 {hud.streak}/8</span>}
      </div>
    </div>
  );
}

function RunOver({ r, best, cost, coins, onRevive, onAgain, onMenu }: { r: RunResult; best: number; cost: number; coins: number; onRevive: () => void; onAgain: () => void; onMenu: () => void }) {
  const newBest = r.distance > best;
  const can = coins >= cost;
  useEffect(() => { audio.play(newBest ? "a:cheer" : "a:poof", { gain: 0.5, duck: false }); }, [newBest]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-end justify-center bg-gradient-to-t from-ink/90 via-ink/45 to-transparent sm:items-center short:items-center">
      <motion.div initial={{ y: 80, scale: 0.94 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="glass-strong w-full max-w-md rounded-t-[2.2rem] px-5 pt-4 text-center sm:rounded-[2.2rem] short:grid short:max-w-3xl short:grid-cols-2 short:items-center short:gap-5 short:rounded-[1.8rem] short:pt-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 1.1rem)" }}>
        <div>
          <Image src={newBest ? "/brand/momo-cheer.webp" : "/brand/momo-surprised.webp"} alt="" width={120} height={120} className="mx-auto -mt-14 size-24 object-contain drop-shadow-xl short:-mt-2 short:size-16" />
          <p className="text-xs font-extrabold tracking-widest text-white/60">{newBest ? "NEW BEST!" : "OUT OF LIVES"}</p>
          <p className="font-display text-[clamp(2.6rem,12vw,3.6rem)] leading-none tabular-nums">{r.distance} m</p>
          <div className="mt-2 flex items-center justify-center gap-4 text-sm font-bold">
            <span className="flex items-center gap-1"><Coin size={18} />{coins}</span>
            <span className="flex items-center gap-1 text-white/70"><Trophy className="size-4 text-sun" />{Math.max(best, r.distance)} m</span>
          </div>
        </div>
        <div className="mt-4 grid gap-2.5 short:mt-0">
          <button onClick={onRevive} disabled={!can} className="btn-clay lg w-full !py-3 !text-xl disabled:opacity-45">
            <Heart className="size-6 fill-current" /> Keep rolling <span className="ml-1 flex items-center gap-1 rounded-full bg-ink/25 px-2 py-0.5 text-base"><Coin size={16} />{cost}</span>
          </button>
          <div className="grid grid-cols-[1fr_auto] gap-2.5">
            <button onClick={onAgain} className="btn-clay mint w-full !text-lg"><RotateCcw className="size-5" /> Play again</button>
            <button onClick={onMenu} className="btn-clay grape !px-4 !text-base">Menu</button>
          </div>
          {!can && <p className="text-xs font-bold text-white/55">Collect {cost} coins in a run to keep rolling</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Results({ run, result, onAgain, onMenu }: { run: Run; result: { r: RunResult; o: RecordOutcome }; onAgain: () => void; onMenu: () => void }) {
  const { r, o } = result;
  const title = run.kind === "rush" ? (r.completed ? "Bosses beaten!" : "Rush over") : r.completed ? "Cleared!" : "Try again";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-end justify-center bg-gradient-to-t from-ink/85 via-ink/40 to-transparent sm:items-center short:items-center">
      <motion.div initial={{ y: 80, scale: 0.94 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="glass-strong w-full max-w-md rounded-t-[2.2rem] px-5 pt-5 text-center sm:rounded-[2.2rem] short:max-w-2xl" style={{ paddingBottom: "calc(var(--safe-bottom) + 1.25rem)" }}>
        <p className="text-xs font-bold tracking-widest text-white/60">{r.name.toUpperCase()}</p>
        <h3 className="font-display text-[clamp(2rem,9vw,2.8rem)] leading-tight">{title}</h3>
        {r.completed && <div className="mt-1 flex justify-center"><Stars n={o.stars} size={40} animate /></div>}
        <div className="mt-3 flex items-center justify-center gap-4 text-sm font-bold">
          <span className="flex items-center gap-1"><Bead size={15} />{r.beads}</span>
          <span className="flex items-center gap-1"><Image src="/brand/coin.webp" alt="" width={18} height={18} className="size-4" />+{o.coins}</span>
          {o.newFusion && <span className="text-sun">🧪 #{o.newFusion.n}</span>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button onClick={onAgain} className="btn-clay lg w-full !text-xl"><RotateCcw className="size-5" /> Again</button>
          <button onClick={onMenu} className="btn-clay grape w-full !text-lg">Menu</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

