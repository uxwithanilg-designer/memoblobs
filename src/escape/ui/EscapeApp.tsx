"use client";
// Momo Escape app shell — phone-first and app-like: full-bleed canvas, one-thumb play (swipe, or tap where Momo should go), bottom
// sheets, haptics, safe areas. Escape Run is one continuous climb (no level screens); Daily Heist, Speed Series and Room
// Lab are separate modes.
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, BookOpen, Building2, ChevronRight, Hand, Heart, Lock, Play, RotateCcw, Sparkles, Timer, Trophy, Users } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { CHARACTERS, useRoll } from "../../roll/save";
import { BUILDINGS, buildingOf } from "../data/buildings";
import { CAT_LABEL, CONCEPT, CONCEPTS, type ConceptCat } from "../data/concepts";
import { PLACERS, type EscapeMode, type ModeParams } from "../gen";
import { autoQuality, type Quality } from "../render3d";
import { dailyKeyNow, useEscape, useEscapeHydrated, type Outcome } from "../save";
import { EscapeSession, registerDev, type EscapeHud, type EscapeResult, type SessionEvent } from "../session";

type Screen = "title" | "game" | "buildings" | "modes" | "dex" | "rollers";
interface RunCfg { mode: EscapeMode; start: number; params: ModeParams }
interface Toast { id: number; kind: "building" | "speed" | "life" | "hurt" | "power" | "info" | "fusion"; title: string; emoji?: string }

const reviveCost = (n: number) => 100 * 2 ** n;
const tap = (haptics: boolean) => {
  audio.ensure(); void audio.resume();
  audio.play("pop", { gain: 0.35, rate: 1.25, duck: false });
  if (haptics) { try { navigator.vibrate?.(8); } catch { /* ignore */ } }
};
const hex = (s: string) => s;
const fmtT = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const chOf = (id: string) => { const c = CHARACTERS.find((x) => x.id === id) ?? CHARACTERS[0]; return { id: c.id, color: c.color }; };

// ---------------------------------------------------------------- canvas stage
interface StageProps {
  cfg: RunCfg; runId: number; kid: boolean; ch: string;
  onSession: (s: EscapeSession | null) => void; onHud?: (h: EscapeHud) => void; onEvent?: (e: SessionEvent) => void; onEnd?: (r: EscapeResult) => void;
}
const gfx = (q: string | undefined): Quality => (q === "low" || q === "medium" || q === "high" ? q : autoQuality());
function Stage(p: StageProps) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef(p);
  useEffect(() => { cb.current = p; });
  const player = usePlayer();
  const settings = useRef(player.settings);
  useEffect(() => { settings.current = player.settings; });
  const key = JSON.stringify(p.cfg);
  useEffect(() => {
    if (!host.current) return;
    const st = settings.current;
    const s = new EscapeSession(host.current, {
      mode: p.cfg.mode, start: p.cfg.start, params: p.cfg.params, mem: useEscape.getState().memory(), ch: chOf(p.ch),
      haptics: st.haptics, shake: st.cameraShake, reduced: st.reducedMotion, kid: p.kid,
      quality: p.cfg.mode === "attract" ? (gfx(st.quality) === "high" ? "medium" : gfx(st.quality)) : gfx(st.quality),
      onHud: (h) => cb.current.onHud?.(h), onEvent: (e) => cb.current.onEvent?.(e), onEnd: (r) => cb.current.onEnd?.(r),
    });
    registerDev(s);
    cb.current.onSession(s);
    return () => { cb.current.onSession(null); s.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, p.runId, p.kid, p.ch]);
  return <div ref={host} className="absolute inset-0 overflow-hidden" style={{ touchAction: "none" }} />;
}

// ---------------------------------------------------------------- small pieces
const Coin = ({ size = 20 }: { size?: number }) => <Image src="/brand/coin.webp" alt="" width={size} height={size} className="shrink-0 drop-shadow" style={{ width: size, height: size }} />;
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
    className="absolute inset-0 z-30 flex flex-col" style={{ background: "linear-gradient(180deg, rgba(22,12,51,0.78), rgba(22,12,51,0.95))", backdropFilter: "blur(4px)" }}>
    {children}
  </motion.div>
);
const Scroll = ({ children }: { children: React.ReactNode }) => (
  <div className="no-scrollbar flex-1 overflow-y-auto px-4" style={{ touchAction: "pan-y", overscrollBehavior: "contain", paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>{children}</div>
);

// ---------------------------------------------------------------- the app
export default function EscapeApp({ title }: { slug: string; title: string }) {
  const ready = useEscapeHydrated();
  const player = usePlayer();
  const { setLoading, setImmersive, setInRound, setMenu } = player;
  const best = useEscape((s) => s.best);
  const reached = useEscape((s) => s.reached);
  const tutorial = useEscape((s) => s.tutorial);
  const bank = useRoll((s) => s.bank);
  const ch = useRoll((s) => s.ch);
  const [screen, setScreen] = useState<Screen>("title");
  const [cfg, setCfg] = useState<RunCfg>({ mode: "run", start: 1, params: {} });
  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState<EscapeHud | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [over, setOver] = useState<EscapeResult | null>(null);
  const [done, setDone] = useState<{ r: EscapeResult; o: Outcome } | null>(null);
  const [revives, setRevives] = useState(0);
  const [hurt, setHurt] = useState(0);
  const session = useRef<EscapeSession | null>(null);
  const title_ = useRef<EscapeSession | null>(null);
  const toastId = useRef(0);
  const recorded = useRef(false);
  const kid = player.settings.speedAssist;
  const haptics = player.settings.haptics;

  useEffect(() => { setLoading(null); }, [setLoading]);
  useEffect(() => { void audio.preload(["pop", "hop", "boing", "squish", "sparkle", "confetti", "tada", "whooshLong", "whooshShort", "clack", "tick", "thud", "rewind", "sadtrombone", "lightsOff", "a:coin", "a:ding", "a:tink", "a:zap", "a:bonk", "a:splat", "a:poof", "a:twinkle", "a:cheer", "a:levelup", "a:teleport", "a:rocket", "a:doorOpen", "a:doorClose", "a:click", "a:giggle", "a:blip", "a:plop", "a:sizzle", "a:crunch", "a:bubble", "a:go"]); }, []);
  useEffect(() => { setImmersive(screen !== "title"); setInRound(screen === "game" && !over && !done); }, [screen, over, done, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => {
    const s = screen === "game" ? session.current : title_.current;
    if (!s) return;
    if (player.paused) s.pause(); else s.resume();
  }, [player.paused, screen]);

  const pushToast = useCallback((t: Omit<Toast, "id">, ms = 2200) => {
    const id = ++toastId.current;
    setToasts((x) => [...x.filter((y) => y.kind !== t.kind), { ...t, id }].slice(-3));
    window.setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), ms);
  }, []);

  /** save a finished / abandoned run once */
  const record = useCallback((r?: EscapeResult): Outcome | null => {
    const s = session.current;
    if (recorded.current) return null;
    const res = r ?? s?.result(false);
    if (!res || (res.floorsDone === 0 && res.coins === 0)) { recorded.current = true; return null; }
    recorded.current = true;
    const par = s ? s.sim.rooms.slice(0, res.floorsDone).reduce((a, x) => a + x.par, 0) / 60 : undefined;
    return useEscape.getState().record(res, par);
  }, []);

  const start = useCallback((c: RunCfg) => {
    audio.ensure(); void audio.resume();
    setOver(null); setDone(null); setToasts([]); setHud(null); setRevives(0); setHurt(0);
    recorded.current = false;
    setCfg(c); setRunId((k) => k + 1); setScreen("game");
  }, []);

  const quitTo = useCallback((to: Screen) => {
    record();
    setOver(null); setDone(null); setToasts([]);
    setScreen(to);
  }, [record]);

  useEffect(() => {
    if (screen !== "game") { setMenu([]); return; }
    setMenu([
      { id: "restart", label: "Restart", icon: "🔄", onSelect: () => { record(); start(cfg); } },
      { id: "buildings", label: "Buildings", icon: "🏢", onSelect: () => quitTo("buildings") },
    ]);
  }, [screen, setMenu, quitTo, record, start, cfg]);

  const onEvent = useCallback((e: SessionEvent) => {
    switch (e.t) {
      case "building": pushToast({ kind: "building", title: e.name, emoji: e.emoji }, 2600); break;
      case "speed": pushToast({ kind: "speed", title: e.tier > 1 ? `SPEED ×${e.tier}` : "Normal speed", emoji: e.tier >= 2 ? "🔥" : e.tier > 1 ? "⚡" : "😮‍💨" }, 1700); break;
      case "life":
        if (e.delta > 0) pushToast({ kind: "life", title: "+1 Life", emoji: "❤️" }, 1500);
        else { setHurt((k) => k + 1); if (e.lives > 0) pushToast({ kind: "hurt", title: e.lives === 1 ? "Last life!" : `${e.lives} lives left`, emoji: "💔" }, 1500); }
        break;
      case "power": pushToast({ kind: "power", title: e.k === "booster" ? "BOOSTER! 30s" : e.k === "slowmo" ? "Slow-mo!" : e.k === "shield" ? "Bubble shield" : e.k === "ghost" ? "Ghost mode" : "Coin magnet", emoji: e.k === "booster" ? "⚡" : e.k === "slowmo" ? "⏱️" : e.k === "shield" ? "🫧" : e.k === "ghost" ? "👻" : "🧲" }, 1800); break;
      case "key": pushToast({ kind: "info", title: "Key! The hatch is open", emoji: "🔑" }, 1700); break;
      case "switch": pushToast({ kind: "info", title: "Security off!", emoji: "🔌" }, 1500); break;
      case "buddy": pushToast({ kind: "info", title: "Buddy rescued!", emoji: "💚" }, 1500); break;
      case "allDiamonds": pushToast({ kind: "info", title: "All 3 diamonds!", emoji: "💎" }, 1500); break;
      case "near": pushToast({ kind: "info", title: "Close one!", emoji: "😅" }, 900); break;
      case "floor":
        if (!useEscape.getState().tutorial) useEscape.getState().setTutorial(true);
        if (e.finale) pushToast({ kind: "fusion", title: "Finale floor!", emoji: "👑" }, 1800);
        else if (e.fusion) pushToast({ kind: "fusion", title: e.fusion, emoji: "✨" }, 1800);
        break;
    }
  }, [pushToast]);

  const onEnd = useCallback((r: EscapeResult) => {
    if (r.mode === "run" || r.mode === "lab") { if (!r.completed) setOver(r); return; }
    const o = record(r);
    setDone({ r, o: o ?? { coins: 0, newBest: false, newConcepts: [], newFusions: [], medal: 0, dailyBest: false } });
  }, [record]);

  const revive = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const cost = reviveCost(revives);
    if (s.sim.coins < cost) return;
    s.spend(cost);
    if (s.revive()) { setRevives((n) => n + 1); setOver(null); }
  }, [revives]);

  if (!ready) return <div className="absolute inset-0 bg-[#141014]" />;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#fff4e6] select-none" style={{ overscrollBehavior: "none", WebkitTapHighlightColor: "transparent" }}>
      {screen === "game" ? (
        <Stage key="game" cfg={cfg} runId={runId} kid={kid} ch={ch} onSession={(s) => { session.current = s; }} onHud={setHud} onEvent={onEvent} onEnd={onEnd} />
      ) : (
        <Stage key="title" cfg={{ mode: "attract", start: 1, params: {} }} runId={0} kid={false} ch={ch} onSession={(s) => { title_.current = s; }} />
      )}

      <AnimatePresence mode="wait">
        {screen === "title" && (
          <TitleScreen key="title" title={title} best={best} bank={bank} reached={reached}
            onPlay={() => { tap(haptics); start({ mode: "run", start: 1, params: {} }); }}
            onNav={(s) => { tap(haptics); setScreen(s); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {screen === "buildings" && <BuildingsScreen key="b" reached={reached} onBack={() => { tap(haptics); setScreen("title"); }} onPick={(b) => { tap(haptics); start({ mode: "run", start: (b - 1) * 10 + 1, params: {} }); }} />}
        {screen === "modes" && <ModesScreen key="m" onBack={() => { tap(haptics); setScreen("title"); }} onRun={(c) => { tap(haptics); start(c); }} />}
        {screen === "dex" && <DexScreen key="d" onBack={() => { tap(haptics); setScreen("title"); }} />}
        {screen === "rollers" && <RollersScreen key="r" haptics={haptics} onBack={() => { tap(haptics); setScreen("title"); }} />}
      </AnimatePresence>

      {screen === "game" && hud && !over && !done && <EscapeHudView hud={hud} best={best} mode={cfg.mode} />}
      {screen === "game" && hud?.phase === "count" && hud.count > 0 && <CountIn n={hud.count} sub={!tutorial ? "Swipe to move Momo!" : undefined} />}
      {screen === "game" && !tutorial && hud && hud.phase === "play" && hud.floorsDone === 0 && hud.moves < 2 && <TapHint />}
      {hurt > 0 && screen === "game" && <motion.div key={hurt} initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.8 }} className="pointer-events-none absolute inset-0 z-10" style={{ boxShadow: "inset 0 0 110px rgba(255,40,80,0.8)" }} />}
      {screen === "game" && hud && hud.boost > 0 && !over && <div className="pointer-events-none absolute inset-0 z-10" style={{ boxShadow: "inset 0 0 80px rgba(70,210,255,0.4)" }} />}
      <AnimatePresence>{screen === "game" && toasts.length > 0 && !over && !done && <Toasts key="t" toasts={toasts} />}</AnimatePresence>

      <AnimatePresence>
        {over && (
          <CaughtSheet key={`o${runId}-${revives}`} r={over} best={best} cost={reviveCost(revives)} coins={hud?.coins ?? over.coins}
            onRevive={() => { tap(haptics); revive(); }}
            onAgain={() => { tap(haptics); record(); start(cfg); }}
            onMenu={() => { tap(haptics); quitTo("title"); }} />
        )}
        {done && (
          <DoneSheet key={`d${runId}`} done={done}
            onNext={cfg.mode === "series" ? () => { tap(haptics); start({ mode: "series", start: 1, params: { series: (cfg.params.series ?? 1) + 1 } }); } : undefined}
            onAgain={() => { tap(haptics); start(cfg); }}
            onMenu={() => { tap(haptics); quitTo("title"); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- title
function TitleScreen({ title, best, bank, reached, onPlay, onNav }: { title: string; best: number; bank: number; reached: number; onPlay: () => void; onNav: (s: Screen) => void }) {
  const [first, ...rest] = title.split(" ");
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}
      className="absolute inset-0 flex flex-col items-center justify-between px-5 text-center short:flex-row short:justify-around short:gap-6 short:px-8"
      style={{ paddingTop: "calc(var(--safe-top) + 4.5rem)", paddingBottom: "calc(var(--safe-bottom) + 1.25rem)", background: "linear-gradient(180deg, rgba(255,244,230,0.85) 0%, rgba(255,244,230,0.2) 34%, rgba(20,12,40,0) 52%, rgba(20,12,40,0.82) 100%)" }}>
      <div className="flex flex-col items-center">
        <motion.p initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="rotate-[-2deg] border-2 border-[#ff3d6e] bg-white px-3 py-1 text-xs font-extrabold tracking-[0.2em] text-[#ff3d6e] shadow-[3px_3px_0_#2fb8ff]">SWIPE TO DASH · ESCAPE EVERY FLOOR</motion.p>
        <motion.h1 initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }} className="mt-3 font-display leading-[0.85]">
          <span className="block text-[clamp(3.2rem,16vw,6.5rem)] text-[#2b1d4e] [text-shadow:5px_5px_0_#ff5fa2] short:text-[min(16vh,4.6rem)]">{first}</span>
          <span className="block -rotate-2 text-[clamp(3rem,15vw,6rem)] text-[#ff3d6e] [text-shadow:5px_5px_0_#2fb8ff] short:text-[min(15vh,4.4rem)]">{rest.join(" ").toUpperCase()}</span>
        </motion.h1>
      </div>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 220, damping: 20 }} className="flex w-full max-w-sm flex-col items-center gap-2.5 short:max-w-xs short:gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-white drop-shadow">
          <span className="flex items-center gap-1 rounded-full bg-ink/55 px-3 py-1 backdrop-blur"><Trophy className="size-4 text-sun" /> Floor {best}</span>
          <span className="flex items-center gap-1 rounded-full bg-ink/55 px-3 py-1 backdrop-blur"><Coin size={16} /> {bank}</span>
          <span className="flex items-center gap-1 rounded-full bg-ink/55 px-3 py-1 backdrop-blur"><Building2 className="size-4 text-mint" /> {reached}/24</span>
        </div>
        <button onClick={onPlay} className="btn-clay lg w-full !py-3.5 !text-2xl">
          <Play className="size-7 fill-current" />
          <span className="flex flex-col items-start leading-none"><span>Play</span><span className="mt-1 text-xs font-bold opacity-80">{best > 0 ? `Beat floor ${best}!` : "Escape Kranky's buildings"}</span></span>
        </button>
        <div className="grid w-full grid-cols-2 gap-2">
          <button onClick={() => onNav("buildings")} className="btn-clay grape w-full !text-base"><Building2 className="size-5" /> Buildings</button>
          <button onClick={() => onNav("modes")} className="btn-clay mint w-full !text-base"><Sparkles className="size-5" /> Modes</button>
          <button onClick={() => onNav("dex")} className="btn-clay ghost w-full !text-base"><BookOpen className="size-5" /> Dex</button>
          <button onClick={() => onNav("rollers")} className="btn-clay ghost w-full !text-base"><Users className="size-5" /> Rollers</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------- buildings (start picker)
function BuildingsScreen({ reached, onBack, onPick }: { reached: number; onBack: () => void; onPick: (b: number) => void }) {
  return (
    <Panel>
      <Header title="Buildings" kicker={`START FROM ANY YOU REACHED · ${reached}/24`} onBack={onBack} />
      <Scroll>
        <p className="mx-auto mb-3 max-w-md text-center text-sm text-white/70">One endless climb through Kranky&apos;s 24 buildings — then they start mixing forever. Reach a building in a run to start from it.</p>
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2.5 pb-4 short:max-w-4xl short:grid-cols-4">
          {BUILDINGS.map((b, i) => {
            const ok = b.id <= reached;
            return (
              <motion.button key={b.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(0.5, 0.02 * i) }} disabled={!ok} onClick={() => onPick(b.id)}
                className="relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-3xl p-3 text-left ring-1 ring-white/15 transition active:scale-[0.96] disabled:opacity-60"
                style={{ background: ok ? hex(b.inks.paper) : "#2d2350", color: ok ? b.inks.text : "#8a7fb0", boxShadow: ok ? `5px 5px 0 ${b.inks.shade}` : undefined }}>
                <span className="absolute top-2 right-3 text-4xl">{ok ? b.emoji : "🔒"}</span>
                {ok && <span className="absolute top-2 left-3 font-display text-3xl opacity-15" style={{ color: b.inks.hot }}>{b.poster}</span>}
                <span className="text-[11px] font-extrabold tracking-wider opacity-80">BUILDING {b.id} · FLOOR {(b.id - 1) * 10 + 1}</span>
                <span className="font-display text-lg leading-tight">{b.name}</span>
              </motion.button>
            );
          })}
        </div>
      </Scroll>
    </Panel>
  );
}

// ---------------------------------------------------------------- modes
const LAB_POOL = Object.keys(PLACERS).filter((k) => k[0] === "H" || ["S06", "S07", "S08", "S09", "S10", "S11", "S12", "S24"].includes(k));
function ModesScreen({ onBack, onRun }: { onBack: () => void; onRun: (c: RunCfg) => void }) {
  const daily = useEscape((s) => s.daily);
  const series = useEscape((s) => s.series);
  const dex = useEscape((s) => s.dex);
  const key = dailyKeyNow();
  const doneToday = daily.key === key;
  const [lab, setLab] = useState<string[]>([]);
  const [labB, setLabB] = useState(1);
  const pool = useMemo(() => LAB_POOL.filter((c) => dex.includes(c) && CONCEPT[c]), [dex]);
  const code = lab.length ? `ESC-${labB.toString(36)}-${lab.join("")}` : "";
  const [input, setInput] = useState("");
  const load = () => {
    const m = input.trim().toUpperCase().match(/^ESC-([0-9A-Z]+)-((?:[HS]\d{2}){1,3})$/);
    if (!m) return;
    const atoms = m[2].match(/[HS]\d{2}/g)!.filter((a) => LAB_POOL.includes(a));
    const b = Math.max(1, Math.min(24, parseInt(m[1], 36) || 1));
    if (atoms.length) onRun({ mode: "lab", start: 1, params: { lab: { atoms, building: b, seed: atoms.join("").length * 97 + b } } });
  };
  return (
    <Panel>
      <Header title="Modes" kicker="MORE WAYS TO ESCAPE" onBack={onBack} />
      <Scroll>
        <div className="mx-auto grid max-w-lg gap-3 pb-4">
          <button onClick={() => onRun({ mode: "daily", start: 1, params: { daily: key } })} className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-amber-400 to-pink-500 p-4 text-left text-ink shadow-lg active:scale-[0.98]">
            <span className="text-4xl">📅</span>
            <span className="flex-1"><span className="block font-display text-2xl leading-tight">Daily Heist</span><span className="block text-sm font-bold opacity-80">10 floors · same for everyone today</span><span className="text-xs font-bold">{doneToday ? `✅ Best ${fmtT(daily.best)} · streak ${daily.streak}` : `Streak ${daily.streak}`}</span></span>
            <ChevronRight className="size-6" />
          </button>
          <div className="rounded-3xl bg-gradient-to-br from-sky-400 to-indigo-600 p-4 shadow-lg">
            <div className="flex items-center gap-4">
              <span className="text-4xl">⏱️</span>
              <span className="flex-1"><span className="block font-display text-2xl leading-tight">Speed Series</span><span className="block text-sm font-bold opacity-85">3 floors against the clock · medals</span></span>
            </div>
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" style={{ touchAction: "pan-x" }}>
              {Array.from({ length: Math.max(6, series.next + 2) }, (_, i) => i + 1).map((n) => {
                const open = n <= series.next;
                const m = series.medals[String(n)] ?? 0;
                return (
                  <button key={n} disabled={!open} onClick={() => onRun({ mode: "series", start: 1, params: { series: n } })} className="flex shrink-0 flex-col items-center rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/20 active:scale-95 disabled:opacity-40">
                    <span className="font-display text-xl">{open ? n : "🔒"}</span>
                    <span className="text-xs">{m === 3 ? "🥇" : m === 2 ? "🥈" : m === 1 ? "🥉" : "·"}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-3xl bg-white/8 p-4 ring-1 ring-white/12">
            <p className="flex items-center gap-2 font-display text-2xl">🧪 Room Lab</p>
            <p className="text-sm text-white/65">Mix up to 3 concepts you have met into your own endless building.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pool.length === 0 && <span className="text-sm text-white/55">Play a few floors to discover concepts!</span>}
              {pool.map((c) => { const on = lab.includes(c); return <button key={c} onClick={() => setLab((x) => (on ? x.filter((y) => y !== c) : [...x, c].slice(-3)))} className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 active:scale-95 ${on ? "bg-sun text-ink ring-sun" : "bg-white/8 ring-white/15"}`}>{CONCEPT[c].name}</button>; })}
            </div>
            <select value={labB} onChange={(e) => setLabB(+e.target.value)} className="mt-3 w-full rounded-xl bg-ink/60 px-3 py-2.5 text-sm font-bold ring-1 ring-white/15">{BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}</select>
            <button disabled={!lab.length} onClick={() => onRun({ mode: "lab", start: 1, params: { lab: { atoms: lab, building: labB, seed: lab.join("").length * 97 + labB } } })} className="btn-clay mt-3 w-full !text-lg disabled:opacity-50"><Play className="size-5 fill-current" /> Build & play</button>
            {code && <p className="mt-2 text-center text-xs font-bold text-white/70">Share code: <span className="select-all rounded bg-ink/60 px-2 py-0.5 font-mono text-sun">{code}</span></p>}
            <div className="mt-3 flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="ESC-1-H02S06" aria-label="Share code" className="min-w-0 flex-1 rounded-xl bg-ink/60 px-3 py-2.5 font-mono text-sm uppercase ring-1 ring-white/15 outline-none" />
              <button onClick={load} className="btn-clay grape !px-4 !text-base">Load</button>
            </div>
          </div>
        </div>
      </Scroll>
    </Panel>
  );
}

// ---------------------------------------------------------------- Concept Dex
const CATS: ConceptCat[] = ["surface", "object", "hazard", "rule", "camera", "building", "music", "finale", "collect"];
function DexScreen({ onBack }: { onBack: () => void }) {
  const dex = useEscape((s) => s.dex);
  const fusions = useEscape((s) => s.fusions);
  const found = new Set(dex);
  const [cat, setCat] = useState<ConceptCat | "fusion">("hazard");
  const list = cat === "fusion" ? [] : CONCEPTS.filter((c) => c.cat === cat);
  return (
    <Panel>
      <Header title="Concept Dex" kicker={`${dex.filter((d) => CONCEPT[d]).length}/${CONCEPTS.length} FOUND · ${fusions.length} FUSIONS`} onBack={onBack} />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3" style={{ touchAction: "pan-x" }}>
        {[...CATS, "fusion" as const].map((c) => <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-extrabold ring-1 ${cat === c ? "bg-sun text-ink ring-sun" : "bg-white/10 ring-white/15"}`}>{c === "fusion" ? "Fusions" : CAT_LABEL[c]}</button>)}
      </div>
      <Scroll>
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2 pb-4 sm:grid-cols-3">
          {cat === "fusion" && fusions.length === 0 && <p className="col-span-full text-center text-sm text-white/60">Climb past floor 240 and every new mix of concepts gets a numbered card here.</p>}
          {cat === "fusion" && [...fusions].reverse().map((f) => (
            <div key={f.key} className="rounded-2xl bg-gradient-to-br from-fuchsia-500/40 to-violet-600/40 p-3 ring-1 ring-white/15">
              <p className="text-[11px] font-extrabold text-white/60">#{f.n}</p>
              <p className="font-display text-lg leading-tight">{f.name}</p>
              <p className="text-[11px] text-white/65">{f.atoms.map((a) => CONCEPT[a]?.name ?? a).join(" + ")}</p>
            </div>
          ))}
          {list.map((c) => {
            const ok = found.has(c.id);
            return (
              <div key={c.id} className={`rounded-2xl p-3 ring-1 ${ok ? "bg-white/12 ring-white/20" : "bg-white/4 ring-white/8"}`}>
                <p className="text-[11px] font-extrabold text-white/50">{c.id}</p>
                <p className="font-display text-base leading-tight">{ok ? c.name : "???"}</p>
                {ok && c.desc && <p className="mt-0.5 text-[11px] text-white/65">{c.desc}</p>}
              </div>
            );
          })}
        </div>
      </Scroll>
    </Panel>
  );
}

// ---------------------------------------------------------------- rollers (shared with Sky Roll)
function RollersScreen({ onBack, haptics }: { onBack: () => void; haptics: boolean }) {
  const bank = useRoll((s) => s.bank);
  const owned = useRoll((s) => s.owned);
  const ch = useRoll((s) => s.ch);
  return (
    <Panel>
      <Header title="Rollers" kicker="SHARED WITH SKY ROLL" onBack={onBack} right={<span className="flex items-center gap-1 rounded-full bg-ink/60 px-3 py-1.5 font-display text-lg"><Coin size={16} />{bank}</span>} />
      <Scroll>
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 pb-4 sm:grid-cols-3">
          {CHARACTERS.map((c) => {
            const have = owned.includes(c.id), sel = ch === c.id;
            return (
              <button key={c.id} onClick={() => { tap(haptics); if (have) useRoll.getState().choose(c.id); else useRoll.getState().buy(c.id); }}
                className={`flex flex-col items-center rounded-3xl p-3 text-center ring-1 transition active:scale-95 ${sel ? "bg-white/16 ring-2 ring-sun" : "bg-white/8 ring-white/15"}`}>
                <span className="relative grid size-20 place-items-center rounded-full shadow-[inset_-6px_-8px_0_rgba(0,0,0,0.22),0_8px_18px_-6px_rgba(0,0,0,0.5)]" style={{ background: `radial-gradient(circle at 35% 30%, #ffffffaa 0 10%, ${c.color} 30%)` }}>
                  {!have && <Lock className="size-7 text-white/90" />}
                </span>
                <span className="mt-2 font-display text-lg leading-tight">{c.name}</span>
                <span className={`mt-2 rounded-full px-3 py-1 text-xs font-extrabold ${sel ? "bg-sun text-ink" : have ? "bg-white/12" : bank >= c.price ? "bg-lime text-ink" : "bg-white/8 text-white/50"}`}>
                  {sel ? "Running!" : have ? "Pick" : <span className="flex items-center gap-1"><Coin size={12} />{c.price}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mx-auto max-w-md pb-6 text-center text-xs text-white/55">Coins from Momo Escape and Sky Roll share one jar.</p>
      </Scroll>
    </Panel>
  );
}

// ---------------------------------------------------------------- in-game HUD
function EscapeHudView({ hud, best, mode }: { hud: EscapeHud; best: number; mode: EscapeMode }) {
  const slots = Math.max(3, hud.lives);
  const tier = hud.rush >= 1.9 ? 2 : hud.rush >= 1.4 ? 1.5 : 1;
  const timed = mode === "daily" || mode === "series";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3" style={{ paddingTop: "calc(var(--safe-top) + 0.6rem)", paddingRight: "calc(var(--safe-right, 0px) + 4.2rem)", paddingLeft: "calc(var(--safe-left, 0px) + 0.75rem)" }}>
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-start gap-1.5">
          <div className={`flex h-10 items-center gap-0.5 rounded-2xl bg-ink/70 px-2 ring-1 backdrop-blur-md ${hud.lives === 1 ? "animate-pulse ring-rose-400/80" : "ring-white/15"}`} aria-label={`${hud.lives} lives`}>
            {Array.from({ length: slots }, (_, i) => (
              <motion.span key={`${i}-${i < hud.lives}`} initial={{ scale: i < hud.lives ? 1.6 : 1.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
                <Heart className={i < hud.lives ? "size-6 fill-[#ff3d6e] text-[#ff3d6e]" : "size-6 text-white/30"} />
              </motion.span>
            ))}
          </div>
          <div className="flex h-10 items-center gap-1.5 rounded-2xl bg-ink/70 px-3 ring-1 ring-white/15 backdrop-blur-md">
            <Coin size={20} /><span className="font-display text-xl tabular-nums text-white">{hud.coins}</span>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end text-right">
          <span className="rounded-xl bg-ink/70 px-2.5 py-0.5 font-display text-[clamp(1.4rem,7vw,2rem)] leading-tight text-white tabular-nums">{timed ? fmtT(hud.seconds) : `F${hud.floor}`}</span>
          <span className="mt-0.5 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-extrabold text-white/85">{hud.emoji} {hud.buildingName}{!timed && best > 0 ? ` · best ${best}` : ""}</span>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
        <span className="flex items-center gap-0.5 rounded-full bg-ink/65 px-2 py-0.5">{[0, 1, 2].map((i) => <span key={i} className={`text-sm ${i < hud.roomDiamonds ? "" : "opacity-30 grayscale"}`}>💎</span>)}</span>
        {tier > 1 && <motion.span key={tier} initial={{ scale: 0.4 }} animate={{ scale: 1 }} className={`rounded-full px-3 py-0.5 font-display text-lg text-white shadow-lg ${tier >= 2 ? "bg-gradient-to-r from-rose-500 to-orange-400" : "bg-gradient-to-r from-orange-400 to-amber-400"}`}>{tier >= 2 ? "🔥" : "⚡"} {tier}x</motion.span>}
        {hud.boost > 0 && <Bar label="⚡" color="bg-sky-500/90" v={hud.boost / 30} t={hud.boost} />}
        {hud.slowmo > 0 && <Bar label="⏱️" color="bg-amber-500/90" v={hud.slowmo / 8} t={hud.slowmo} />}
        {hud.shield && <span className="rounded-full bg-mint/90 px-2 py-0.5 text-xs font-bold text-ink">🫧</span>}
        {hud.ghost && <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-ink">👻</span>}
        {hud.magnet && <span className="rounded-full bg-pink-400/90 px-2 py-0.5 text-xs font-bold text-ink">🧲</span>}
        {hud.keyNeeded && <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${hud.hasKey ? "bg-lime text-ink" : "bg-ink/70 text-white"}`}>🔑 {hud.hasKey ? "open!" : "find the key"}</span>}
      </div>
    </div>
  );
}
function Bar({ label, color, v, t }: { label: string; color: string; v: number; t: number }) {
  return (
    <span className={`flex items-center gap-1.5 rounded-full ${color} px-2.5 py-0.5 font-display text-base text-white shadow`}>
      {label}<span className="relative h-2 w-12 overflow-hidden rounded-full bg-white/30"><span className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} /></span><span className="tabular-nums">{Math.ceil(t)}s</span>
    </span>
  );
}

function CountIn({ n, sub }: { n: number; sub?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
      <motion.span key={n} initial={{ scale: 2.2, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: -4 }} transition={{ type: "spring", stiffness: 400, damping: 18 }} className="font-display text-[8rem] leading-none text-[#ff3d6e] [text-shadow:6px_6px_0_#2fb8ff] short:text-[5rem]">{n}</motion.span>
      {sub && <p className="mt-2 rounded-full bg-ink/70 px-4 py-2 font-bold text-white">{sub}</p>}
    </div>
  );
}
function TapHint() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-6 text-center" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
      <motion.div animate={{ x: [0, 0, 26, 26, 0], y: [0, -26, -26, 0, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}><Hand className="size-12 fill-white text-ink drop-shadow-lg" /></motion.div>
      <p className="mt-2 rounded-full bg-ink/75 px-4 py-2 text-base font-bold text-white">Swipe ↑ ↓ ← → (or tap where to go) — Momo dashes until he hits a wall!</p>
      <p className="mt-1.5 hidden rounded-full bg-ink/60 px-3 py-1 text-xs font-semibold text-white/85 [@media(hover:hover)]:block">Keyboard: arrow keys or W A S D</p>
    </motion.div>
  );
}
function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-2 px-4" style={{ top: "calc(var(--safe-top) + 7rem)" }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, scale: 0.6, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: -2 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className={`border-2 px-4 py-1.5 font-display text-xl shadow-[4px_4px_0_rgba(0,0,0,0.35)] ${t.kind === "hurt" ? "border-rose-600 bg-rose-500 text-white" : t.kind === "life" ? "border-pink-600 bg-pink-400 text-white" : t.kind === "speed" ? "border-orange-600 bg-orange-400 text-white" : t.kind === "power" ? "border-sky-600 bg-sky-400 text-white" : t.kind === "fusion" ? "border-fuchsia-700 bg-fuchsia-500 text-white" : t.kind === "building" ? "border-ink bg-white text-ink" : "border-ink bg-sun text-ink"}`}>
            {t.emoji} {t.title}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function CaughtSheet({ r, best, cost, coins, onRevive, onAgain, onMenu }: { r: EscapeResult; best: number; cost: number; coins: number; onRevive: () => void; onAgain: () => void; onMenu: () => void }) {
  const newBest = r.mode === "run" && r.floor > best;
  const can = coins >= cost;
  useEffect(() => { audio.play(newBest ? "a:cheer" : "a:poof", { gain: 0.5, duck: false }); }, [newBest]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-end justify-center bg-gradient-to-t from-ink/90 via-ink/45 to-transparent sm:items-center short:items-center">
      <motion.div initial={{ y: 80, scale: 0.94 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="glass-strong w-full max-w-md rounded-t-[2.2rem] px-5 pt-4 text-center sm:rounded-[2.2rem] short:grid short:max-w-3xl short:grid-cols-2 short:items-center short:gap-5 short:rounded-[1.8rem] short:pt-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 1.1rem)" }}>
        <div>
          <Image src={newBest ? "/brand/momo-cheer.webp" : "/brand/kranky-laugh.webp"} alt="" width={120} height={120} className="mx-auto -mt-14 size-24 object-contain drop-shadow-xl short:-mt-2 short:size-16" />
          <p className="text-xs font-extrabold tracking-widest text-white/60">{newBest ? "NEW BEST!" : "CAUGHT BY KRANKY"}</p>
          <p className="font-display text-[clamp(2.4rem,11vw,3.4rem)] leading-none">Floor {r.floor}</p>
          <div className="mt-2 flex items-center justify-center gap-4 text-sm font-bold">
            <span className="flex items-center gap-1"><Coin size={18} />{coins}</span>
            <span>💎 {r.diamonds}</span>
            <span className="flex items-center gap-1 text-white/70"><Trophy className="size-4 text-sun" />{Math.max(best, r.floor)}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-2.5 short:mt-0">
          <button onClick={onRevive} disabled={!can} className="btn-clay lg w-full !py-3 !text-xl disabled:opacity-45">
            <Heart className="size-6 fill-current" /> Keep going <span className="ml-1 flex items-center gap-1 rounded-full bg-ink/25 px-2 py-0.5 text-base"><Coin size={16} />{cost}</span>
          </button>
          <div className="grid grid-cols-[1fr_auto] gap-2.5">
            <button onClick={onAgain} className="btn-clay mint w-full !text-lg"><RotateCcw className="size-5" /> Play again</button>
            <button onClick={onMenu} className="btn-clay grape !px-4 !text-base">Menu</button>
          </div>
          {!can && <p className="text-xs font-bold text-white/55">Collect {cost} coins in a run to keep going</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

function DoneSheet({ done, onNext, onAgain, onMenu }: { done: { r: EscapeResult; o: Outcome }; onNext?: () => void; onAgain: () => void; onMenu: () => void }) {
  const { r, o } = done;
  const titleTxt = r.mode === "daily" ? "Heist complete!" : r.mode === "series" ? `Series ${r.series} cleared!` : "Escaped!";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-end justify-center bg-gradient-to-t from-ink/90 via-ink/45 to-transparent sm:items-center short:items-center">
      <motion.div initial={{ y: 80, scale: 0.94 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="glass-strong w-full max-w-md rounded-t-[2.2rem] px-5 pt-5 text-center sm:rounded-[2.2rem] short:max-w-2xl" style={{ paddingBottom: "calc(var(--safe-bottom) + 1.1rem)" }}>
        <p className="text-xs font-extrabold tracking-widest text-white/60">SUCCESSFUL ESCAPE</p>
        <h3 className="font-display text-[clamp(2rem,9vw,2.8rem)] leading-tight">{titleTxt}</h3>
        {r.mode === "series" && <p className="text-5xl">{o.medal === 3 ? "🥇" : o.medal === 2 ? "🥈" : "🥉"}</p>}
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/8 p-2"><p className="text-[11px] font-bold text-white/55">TIME</p><p className="flex items-center justify-center gap-1 font-display text-xl"><Timer className="size-4" />{fmtT(r.seconds)}</p></div>
          <div className="rounded-2xl bg-white/8 p-2"><p className="text-[11px] font-bold text-white/55">DIAMONDS</p><p className="font-display text-xl">💎 {r.diamonds}</p></div>
          <div className="rounded-2xl bg-white/8 p-2"><p className="text-[11px] font-bold text-white/55">COINS</p><p className="flex items-center justify-center gap-1 font-display text-xl"><Coin size={16} />+{o.coins}</p></div>
        </div>
        {o.newConcepts.length > 0 && <p className="mt-2 text-xs font-bold text-sun">📖 {o.newConcepts.length} new in your Dex</p>}
        <div className={`mt-4 grid gap-2.5 ${onNext ? "grid-cols-3" : "grid-cols-2"}`}>
          {onNext && <button onClick={onNext} className="btn-clay lg w-full !text-lg">Next <ChevronRight className="size-5" /></button>}
          <button onClick={onAgain} className="btn-clay mint w-full !text-lg"><RotateCcw className="size-5" /> Again</button>
          <button onClick={onMenu} className="btn-clay grape w-full !text-lg">Menu</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export { buildingOf };
