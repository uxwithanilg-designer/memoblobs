"use client";
// Orbi GP app shell — phone first, app-like. Home: the 3D grid behind a big title, the next stage and RACE, with the
// Road Map, Modes, Marbles and the Idea Dex a tap away. In a race the HUD sits round the edges (position, a progress bar
// with every marble on it, the clock, the stage's goal, hearts and letters, the boost meter and the power button) and the
// whole screen is the controller: hold anywhere to roll, slide to steer, swipe up to jump. Modes run here too: Endless
// Sky Run (courses back to back on 3 lives), the Daily Cup (three races, points), Time Trial (your ghost), Knockout
// Royale (three rounds, the top half goes through) and Boss Rush. The results card fits each one.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, ChevronLeft, ChevronRight, ChevronsUp, Gamepad2, Map as MapIcon, Play, RotateCcw, Zap } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { JOURNEY, STAGES_PER_WORLD, worldOf } from "../data/worlds";
import { autoQuality, type Quality } from "../render3d";
import { useOrbi, useOrbiHydrated, type FinishOut } from "../save";
import { NEXT } from "@/lib/preload";
import { ORBI_MENU_SOUNDS, ORBI_RACE_SOUNDS, OrbiSession, registerDev, type Controls, type OrbiHud, type RaceResult } from "../session";
import { skinPrice } from "../three/tex";
import type { Stage } from "../types";
import { DexPanel, ModesPanel, ShopPanel, SkinBall, type ModeKind } from "./Panels";
import { RoadMap, stageTitle } from "./RoadMap";

const gfx = (q: string | undefined): Quality => (q === "low" || q === "medium" || q === "high" ? q : autoQuality());
const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const ORD = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
const POWER_ICON: Record<string, string> = { turbo: "🚀", magnet: "🧲", shield: "🫧", jump: "⏫", giant: "🟣", feather: "🪶", bridge: "🌈", star: "⭐" };
const CONTROL_LABEL: Record<Controls, string> = { stick: "🕹️ Stick", drag: "👆 Drag", tilt: "📱 Tilt", buttons: "🎮 Buttons" };
const NEXT_CTRL: Record<Controls, Controls> = { stick: "drag", drag: "tilt", tilt: "buttons", buttons: "stick" };
const DAILY_PTS = [10, 8, 6, 5, 4, 3, 2, 1];
const ROYALE = [{ rivals: 15, cut: 8 }, { rivals: 7, cut: 4 }, { rivals: 3, cut: 1 }];
const dayIndex = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);

type Run =
  | { kind: "gp" }
  | { kind: "endless"; leg: number; dist: number; coins: number; lives: number; salt: number }
  | { kind: "daily"; race: number }
  | { kind: "trial"; n: number }
  | { kind: "royale"; round: number; salt: number }
  | { kind: "bossrush"; list: number[]; leg: number; time: number; places: number[] };
type Screen = "home" | "map" | "race" | "modes" | "dex" | "shop";
interface Card { medal: string; title: string; line: string; ok: boolean; stats: [string, string][]; rating?: number; next?: { label: string; go: () => void }; retry?: () => void; note?: string }

/** the joystick: a ring with a dot. Touch anywhere on the left side and the ring jumps under your thumb; push the dot
 *  forward to roll, left / right to steer, back to brake. Let go and it slides home. */
function Joystick({ get }: { get: () => OrbiSession | null }) {
  const R = 52;
  const zone = useRef<HTMLDivElement>(null), id = useRef<number | null>(null);
  const [base, setBase] = useState<{ x: number; y: number } | null>(null);
  // where the touch began, kept in a ref too (a quick finger can move before the ring has been drawn there)
  const at = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const put = (bx: number, by: number, px: number, py: number) => {
    let dx = px - bx, dy = py - by; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    setKnob({ x: dx, y: dy }); get()?.stick(dx / R, dy / R);
  };
  const end = () => { id.current = null; at.current = null; setBase(null); setKnob({ x: 0, y: 0 }); get()?.stick(0, 0); };
  useEffect(() => () => { get()?.stick(0, 0); }, [get]);
  return (
    <div ref={zone} className="absolute bottom-0 left-0 h-[64%] w-1/2 touch-none"
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); const z = zone.current!.getBoundingClientRect(); id.current = e.pointerId; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ } const b = { x: e.clientX - z.left, y: e.clientY - z.top }; at.current = b; setBase(b); put(b.x, b.y, b.x, b.y); }}
      onPointerMove={(e) => { const b = at.current; if (id.current !== e.pointerId || !b) return; const z = zone.current!.getBoundingClientRect(); put(b.x, b.y, e.clientX - z.left, e.clientY - z.top); }}
      onPointerUp={(e) => { if (id.current === e.pointerId) end(); }} onPointerCancel={(e) => { if (id.current === e.pointerId) end(); }}>
      <div className="pointer-events-none absolute" style={base ? { left: base.x - R - 14, top: base.y - R - 14 } : { left: 18, bottom: "calc(max(16px, env(safe-area-inset-bottom)) + 72px)" }}>
        <div className="relative rounded-full bg-[#14183A]/35 ring-4 ring-white/60 backdrop-blur-[2px]" style={{ width: (R + 14) * 2, height: (R + 14) * 2, opacity: base ? 1 : 0.75 }}>
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[11px] font-black text-white/80">ROLL</span>
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[11px] font-black text-white/80">BRAKE</span>
          <span className="absolute top-1/2 left-1.5 -translate-y-1/2 text-sm font-black text-white/80">‹</span>
          <span className="absolute top-1/2 right-1.5 -translate-y-1/2 text-sm font-black text-white/80">›</span>
          <span className="absolute top-1/2 left-1/2 grid size-[3.4rem] place-items-center rounded-full bg-gradient-to-b from-white to-[#9FE8FF] shadow-[0_4px_10px_rgba(0,0,0,0.35)] ring-2 ring-[#1E9CD8]"
            style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}>
            <span className="size-3 rounded-full bg-[#1E9CD8]" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** the speedometer: 0–350 km/h on an arc, cyan → gold → red */
function Speedo({ kmh, high, right }: { kmh: number; high: boolean; right?: boolean }) {
  const k = Math.min(1, kmh / 350), R = 40, C = Math.PI * R * 1.5, col = kmh > 300 ? "#FF4A5A" : kmh > 200 ? "#FFC23A" : "#5CF2FF";
  return (
    <div className={`pointer-events-none absolute ${right ? "right-3" : "left-3"} grid size-[6.2rem] place-items-center`} style={{ bottom: right ? "calc(max(16px, env(safe-area-inset-bottom)) + 6.2rem)" : high ? "calc(max(16px, env(safe-area-inset-bottom)) + 5.4rem)" : "calc(max(16px, env(safe-area-inset-bottom)) + 3.6rem)" }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-[225deg]" aria-hidden>
        <circle cx="50" cy="50" r={R} fill="rgba(20,24,58,0.62)" stroke="rgba(255,255,255,0.18)" strokeWidth="9" strokeDasharray={`${C} ${Math.PI * 2 * R}`} strokeLinecap="round" />
        <circle cx="50" cy="50" r={R} fill="none" stroke={col} strokeWidth="9" strokeDasharray={`${C * k} ${Math.PI * 2 * R}`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${col})` }} />
      </svg>
      <div className="relative flex flex-col items-center leading-none text-white">
        <span className="font-display text-[1.7rem] tabular-nums" style={{ color: kmh > 300 ? "#FFB3BC" : "#fff" }}>{kmh}</span>
        <span className="text-[10px] font-bold opacity-80">km/h</span>
      </div>
    </div>
  );
}

export default function OrbiApp({ title }: { slug: string; title: string }) {
  const ready = useOrbiHydrated();
  const player = usePlayer();
  const { setLoading, setImmersive, setInRound, setMenu } = player;
  const stage = useOrbi((s) => s.stage), best = useOrbi((s) => s.best), coins = useOrbi((s) => s.coins), stars = useOrbi((s) => s.stars);
  const controls = useOrbi((s) => s.controls), tutorial = useOrbi((s) => s.tutorial), skin = useOrbi((s) => s.skin), owned = useOrbi((s) => s.owned);
  const met = useOrbi((s) => s.met), daily = useOrbi((s) => s.daily), endless = useOrbi((s) => s.endless), royale = useOrbi((s) => s.royale), trials = useOrbi((s) => s.trials);
  const [screen, setScreen] = useState<Screen>("home");
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  const [hud, setHud] = useState<OrbiHud | null>(null);
  const [toast, setToast] = useState<{ text: string; tone?: string; id: number } | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [run, setRunState] = useState<Run>({ kind: "gp" });
  const runRef = useRef<Run>(run);
  const setRun = useCallback((r: Run) => { runRef.current = r; setRunState(r); }, []);
  const host = useRef<HTMLDivElement>(null);
  const session = useRef<OrbiSession | null>(null);
  const toastN = useRef(0);
  const settings = useRef(player.settings);
  useEffect(() => { settings.current = player.settings; });
  const n = pick ?? stage;

  useEffect(() => { setLoading(null); }, [setLoading]);
  // sounds ahead of time: the menu's before the first screen, the race's while the menu is up
  useEffect(() => { void audio.preload(ORBI_MENU_SOUNDS); void audio.preload(ORBI_RACE_SOUNDS, [], undefined, NEXT); }, []);
  // full-screen sheets and races hide the site's own top bar (so their back button is the only one)
  useEffect(() => { setImmersive(screen !== "home"); setInRound(screen === "race"); }, [screen, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => { const s = session.current; if (!s) return; if (player.paused) s.pause(); else s.resume(); }, [player.paused]);

  /** build the stage (or the mode's course) for a run and put Orbi on its grid */
  const loadRun = useCallback(async (s: OrbiSession, r: Run, k = useOrbi.getState().stage) => {
    setBusy(true);
    let st: Stage;
    if (r.kind === "gp") { s.setMode({ kind: "gp" }); st = await s.stage(k); }
    else if (r.kind === "endless") { s.setMode({ kind: "endless", lives: r.lives, dist: r.dist, leg: r.leg }); st = await s.stage(JOURNEY + 200000 + r.leg, { d: Math.min(1.7, 0.45 + r.leg * 0.12), sections: 18, world: 1 + ((r.salt + r.leg) % 25) }, r.salt, true); }
    else if (r.kind === "daily") { const d = dayIndex(); s.setMode({ kind: "daily" }); st = await s.stage(JOURNEY + 100000 + (d % 30000) * 3 + r.race, { d: 0.7 + r.race * 0.18, sections: 22, world: 1 + ((d * 3 + r.race) % 25) }, 9001, true); }
    else if (r.kind === "trial") { s.setMode({ kind: "trial", rivals: 0, ghost: useOrbi.getState().trials[r.n]?.g }); st = await s.stage(r.n); }
    else if (r.kind === "royale") { s.setMode({ kind: "royale", rivals: ROYALE[r.round].rivals }); st = await s.stage(JOURNEY + 300000 + (r.salt % 5000) * 3 + r.round, { d: 0.75 + r.round * 0.2, sections: 10, world: 1 + ((r.salt + r.round * 7) % 25), collapse: true }, r.salt, true); }
    else { s.setMode({ kind: "bossrush" }); st = await s.stage(r.list[r.leg]); }
    if (session.current !== s) return;
    s.load(st); setBusy(false);
  }, []);

  /** start a mode: build its first course and go */
  const startMode = useCallback((k: ModeKind, tn?: number) => {
    const s = session.current; if (!s) return;
    const O = useOrbi.getState(), salt = ((Math.random() * 2 ** 30) | 0) + 1;
    let r: Run;
    if (k === "endless") r = { kind: "endless", leg: 0, dist: 0, coins: 0, lives: 3, salt };
    else if (k === "daily") { const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; r = { kind: "daily", race: O.daily.day === today ? Math.min(2, O.daily.race) : 0 }; }
    else if (k === "trial") r = { kind: "trial", n: tn ?? Math.max(1, O.stage - 1) };
    else if (k === "royale") r = { kind: "royale", round: 0, salt };
    else r = { kind: "bossrush", list: Object.keys(O.best).map(Number).filter((x) => x <= JOURNEY && x % STAGES_PER_WORLD === 0).sort((a, b) => a - b), leg: 0, time: 0, places: [] };
    setRun(r); setCard(null); setScreen("race");
    void loadRun(s, r).then(() => s.start());
  }, [loadRun, setRun]);

  /** a run's result: save what it earns and make its card */
  const onResult = useCallback((res: RaceResult) => {
    const r = runRef.current, O = useOrbi.getState(), s = session.current;
    const again = (rr: Run) => () => { setCard(null); if (s) void loadRun(s, rr).then(() => { setScreen("race"); s.start(); }); };
    if (r.kind === "gp") {
      const out: FinishOut = O.finish(res);
      const k = res.n + 1;
      setCard({
        medal: res.place === 1 ? "🥇" : res.place === 2 ? "🥈" : res.place === 3 ? "🥉" : "🏁", title: res.n === JOURNEY && res.pass ? "GRAND PRIX CHAMPION!" : `${ORD(res.place)} place!`,
        line: res.pass ? (out.unlocked ? "You won — next stage unlocked!" : "You won!") : res.why === "Win the race to pass" ? "Only 1st place opens the next stage — race it again!" : res.why || "So close — try again!", ok: res.pass, rating: res.rating,
        stats: [["Time", clock(res.time)], ["Gold time", res.gold ? clock(res.gold) : "—"], ["Coins", `+${out.coins}`]],
        note: "⭐ win · ⭐⭐ win with no falls · ⭐⭐⭐ also under the gold time (or all 3 hidden stars)",
        retry: again({ kind: "gp" }),
        next: res.pass ? { label: "Next", go: () => { setPick(null); setCard(null); if (s) void loadRun(s, { kind: "gp" }, Math.min(k, useOrbi.getState().stage)).then(() => { setScreen("race"); s.start(); }); } } : undefined,
      });
      return;
    }
    if (r.kind === "endless") {
      const dist = res.dist ?? r.dist, earned = res.coins + r.coins + Math.floor(dist / 40), rec = O.setEndless(dist);
      O.earn(earned);
      setCard({ medal: "♾️", title: `${dist.toLocaleString()} m`, line: rec ? "New best run!" : `Best ${Math.max(O.endless, dist).toLocaleString()} m`, ok: true, stats: [["Courses", String(r.leg + 1)], ["Distance", `${dist.toLocaleString()} m`], ["Coins", `+${earned}`]], retry: () => startMode("endless") });
      return;
    }
    if (r.kind === "daily") {
      const pts = res.place <= DAILY_PTS.length ? DAILY_PTS[res.place - 1] : 0, d = O.dailyRace(pts), earned = res.coins + pts * 3 + (d.race >= 3 ? 30 : 0);
      O.earn(earned);
      setCard({
        medal: d.race >= 3 ? "🏆" : "📅", title: d.race >= 3 ? `Daily Cup: ${d.pts} pts` : `Race ${d.race}/3 · ${ORD(res.place)}`, line: d.race >= 3 ? `🔥 Streak ${d.streak} day${d.streak === 1 ? "" : "s"} — come back tomorrow!` : `+${pts} points · ${d.pts} so far`, ok: true,
        stats: [["Time", clock(res.time)], ["Points", `+${pts}`], ["Coins", `+${earned}`]],
        next: d.race < 3 ? { label: `Race ${d.race + 1}`, go: again({ kind: "daily", race: d.race }) } : undefined,
      });
      return;
    }
    if (r.kind === "trial") {
      const old = O.trials[r.n], rec = O.setTrial(r.n, res.time, res.path ?? []);
      O.earn(res.coins);
      setCard({ medal: "👻", title: clock(res.time), line: rec ? (old ? `New record — ${(old.t - res.time).toFixed(2)} s faster than your ghost!` : "Ghost saved — race it next time!") : `Your ghost: ${clock(old?.t ?? 0)}`, ok: rec, stats: [["Time", clock(res.time)], ["Ghost", old ? clock(old.t) : "—"], ["Coins", `+${res.coins}`]], retry: again(r) });
      return;
    }
    if (r.kind === "royale") {
      const R = ROYALE[r.round], through = res.place <= R.cut && res.why.indexOf("Knocked") < 0, last = r.round === ROYALE.length - 1;
      if (last || !through) O.royaleDone(last && through);
      const earned = res.coins + (through ? 20 * (r.round + 1) : 5) + (last && through ? 100 : 0);
      O.earn(earned);
      setCard({
        medal: last && through ? "🏆" : through ? "✅" : "💥", title: last && through ? "Royale winner!" : through ? `Through to round ${r.round + 2}!` : "Knocked out!",
        line: through ? (last ? "Last marble rolling. Champion!" : `Top ${R.cut} go through — you were ${ORD(res.place)}`) : `You needed the top ${R.cut} — you were ${ORD(res.place)}`, ok: through,
        stats: [["Round", `${r.round + 1}/3`], ["Place", `${ORD(res.place)}/${res.total}`], ["Coins", `+${earned}`]],
        next: through && !last ? { label: `Round ${r.round + 2}`, go: again({ ...r, round: r.round + 1 }) } : undefined, retry: () => startMode("royale"),
      });
      return;
    }
    // boss rush
    const time = r.time + res.time, places = [...r.places, res.place], more = r.leg + 1 < r.list.length;
    O.earn(res.coins + (res.place === 1 ? 15 : 5));
    setRun({ ...r, time, places });
    setCard({
      medal: more ? "👑" : "🏆", title: more ? `Boss ${r.leg + 1}/${r.list.length}: ${ORD(res.place)}` : `Boss Rush done!`, line: more ? `Total ${clock(time)}` : `${places.filter((p) => p === 1).length} wins · total ${clock(time)}`, ok: true,
      stats: [["Time", clock(res.time)], ["Total", clock(time)], ["Wins", String(places.filter((p) => p === 1).length)]],
      next: more ? { label: "Next boss", go: again({ ...r, leg: r.leg + 1, time, places }) } : undefined,
    });
  }, [loadRun, setRun, startMode]);
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  // the 3D scene lives as long as the app
  useEffect(() => {
    if (!ready || !host.current) return;
    const st0 = settings.current;
    const s = new OrbiSession(host.current, {
      quality: gfx(st0.quality), haptics: st0.haptics, salt: useOrbi.getState().salt,
      memory: () => useOrbi.getState().memory(),
      controls: () => useOrbi.getState().controls,
      skin: () => useOrbi.getState().skin,
      onHud: setHud,
      onOut: (e) => {
        if (e.t === "toast") setToast({ text: e.text, tone: e.tone, id: ++toastN.current });
        else if (e.t === "finish") window.setTimeout(() => onResultRef.current(e.res), 1600);
        else if (e.t === "next") {
          // Endless: on into the next course
          const r = runRef.current; if (r.kind !== "endless") return;
          const nr: Run = { ...r, leg: r.leg + 1, dist: e.dist, coins: r.coins + e.coins, lives: e.lives };
          setRun(nr); setToast({ text: `Course ${nr.leg + 1}!`, tone: "gold", id: ++toastN.current });
          void loadRun(s, nr).then(() => s.go());
        }
      },
    });
    session.current = s; registerDev(s);
    // a mode linked from the game's page (/play?g=orbi-gp&mode=endless)
    const want = new URLSearchParams(window.location.search).get("mode");
    void loadRun(s, { kind: "gp" }).then(() => {
      if (want === "endless" || want === "daily") startMode(want);
      else if (want === "trial" || want === "royale" || want === "bossrush") setScreen("modes");
    });
    return () => { s.destroy(); session.current = null; };
  }, [ready, loadRun, setRun, startMode]);

  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), toast.tone === "big" ? 800 : 1300); return () => window.clearTimeout(t); }, [toast]);

  const play = useCallback(() => {
    const s = session.current; if (!s || busy) return;
    audio.ensure(); void audio.resume();
    audio.play("pop", { gain: 0.3, rate: 1.1, duck: false });
    setCard(null); setScreen("race");
    s.start();
  }, [busy]);
  const toStage = useCallback((k: number) => {
    const s = session.current; if (!s) return;
    setRun({ kind: "gp" });
    setPick(k === useOrbi.getState().stage ? null : k); setCard(null); setScreen("home");
    void loadRun(s, { kind: "gp" }, k);
  }, [loadRun, setRun]);
  const restart = useCallback(() => {
    const s = session.current; if (!s) return; const r = runRef.current;
    const rr: Run = r.kind === "endless" ? { ...r, leg: 0, dist: 0, coins: 0, lives: 3 } : r;
    setRun(rr); setCard(null); void loadRun(s, rr, n).then(() => { setScreen("race"); s.start(); });
  }, [loadRun, n, setRun]);
  const home = useCallback(() => { setCard(null); setScreen("home"); setRun({ kind: "gp" }); const s = session.current; if (s) void loadRun(s, { kind: "gp" }, pick ?? useOrbi.getState().stage); }, [loadRun, pick, setRun]);

  useEffect(() => {
    if (screen !== "race") { setMenu([]); return; }
    setMenu([
      { id: "restart", label: "Restart", icon: "🔄", onSelect: restart },
      ...(run.kind === "gp" ? [{ id: "map", label: "Road map", icon: "🗺️", onSelect: () => { setCard(null); setScreen("map"); } }] : []),
      { id: "home", label: "Home", icon: "🏠", onSelect: home },
    ]);
  }, [screen, setMenu, restart, home, run.kind]);

  const getSession = useCallback(() => session.current, []);
  const W = worldOf(hud?.world ?? Math.min(25, Math.ceil(Math.min(n, JOURNEY) / STAGES_PER_WORLD)));
  const s = session.current;
  const race = screen === "race" && hud;
  const firstRace = !tutorial && n <= 2 && run.kind === "gp";
  useEffect(() => { if (race && hud?.phase === "race" && firstRace) { const t = window.setTimeout(() => useOrbi.getState().seeTutorial(), 9000); return () => window.clearTimeout(t); } }, [race, hud?.phase, firstRace]);
  const btn = "flex items-center justify-center gap-2 rounded-2xl bg-white/88 py-3 font-display text-lg text-[#1A2A5A] shadow-[0_5px_0_rgba(20,40,90,0.2)] active:translate-y-1";

  return (
    <div className="relative h-full w-full touch-none overflow-hidden bg-[#7EC4F5] select-none">
      <div ref={host} className="absolute inset-0" />

      {/* ---------------- home */}
      <AnimatePresence>
        {screen === "home" && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between px-5" style={{ paddingTop: "max(20px, env(safe-area-inset-top))", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            <div className="h-10 shrink-0" />
            <motion.div initial={{ y: -16, scale: 0.92 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }} className="-mt-6 text-center [@media(max-height:480px)]:mt-0">
              <h1 className="font-display text-[clamp(2.6rem,min(17vw,13vh),5.6rem)] leading-[0.9] tracking-tight drop-shadow-[0_6px_0_rgba(20,40,90,0.35)]">
                <span className="bg-gradient-to-b from-white to-[#9FE8FF] bg-clip-text text-transparent">ORBI</span>{" "}
                <span className="bg-gradient-to-b from-[#FFE68A] to-[#FF9F1C] bg-clip-text text-transparent">GP</span>
              </h1>
              <p className="mt-1 text-sm font-bold tracking-wide text-white drop-shadow">Marble Sky Grand Prix</p>
            </motion.div>
            <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2.5 [@media(max-height:480px)]:gap-1.5">
              <div className="flex items-center justify-center gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-[#1A2A5A] backdrop-blur">⭐ {stars}</span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-[#1A2A5A] backdrop-blur">🪙 {coins.toLocaleString()}</span>
                <button type="button" onClick={() => useOrbi.getState().setControls(NEXT_CTRL[controls])} className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-[#1A2A5A] backdrop-blur active:scale-95" aria-label="Change controls">{CONTROL_LABEL[controls]}</button>
              </div>
              <div className="flex items-center gap-3 rounded-3xl bg-white/88 px-4 py-3 text-[#1A2A5A] shadow-[0_8px_24px_rgba(20,40,90,0.25)] backdrop-blur [@media(max-height:480px)]:py-2">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-3xl" style={{ background: `linear-gradient(135deg, ${W.pal.top}, ${W.road.stripeA})` }}>{n > JOURNEY ? "♾️" : W.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold tracking-widest text-[#5A6A9A] uppercase">{n > JOURNEY ? "Remix Grand Prix" : `World ${W.id} · ${W.name}`}</span>
                  <span className="block truncate font-display text-xl leading-tight">Stage {n} · {stageTitle(n)}</span>
                  <span className="flex gap-0.5 text-sm">{[0, 1, 2].map((k) => <span key={k} className={k < (best[n]?.r ?? 0) ? "" : "opacity-25 grayscale"}>⭐</span>)}{best[n] && <span className="ml-2 text-xs font-bold text-[#5A6A9A]">best {clock(best[n].t)}</span>}</span>
                </span>
                <button type="button" onClick={() => setScreen("shop")} aria-label="Your marble" className="shrink-0 active:scale-95"><SkinBall i={skin} size={44} /></button>
              </div>
              <button type="button" onClick={play} disabled={busy} aria-label={`Play ${title}`} className="flex w-full items-center justify-center gap-3 rounded-[1.7rem] bg-gradient-to-b from-[#7CF2FF] to-[#1E9CD8] px-6 py-4 text-white shadow-[0_8px_0_#1060A0,0_18px_40px_rgba(0,0,0,0.25)] transition active:translate-y-1.5 active:shadow-[0_3px_0_#1060A0] disabled:opacity-70 [@media(max-height:480px)]:py-2.5">
                <Play className="size-9 fill-white" />
                <span className="font-display text-3xl">{busy ? "Building…" : "RACE!"}</span>
              </button>
              <div className="grid grid-cols-4 gap-2">
                <button type="button" onClick={() => setScreen("map")} className={`${btn} flex-col gap-0 py-2 text-sm`}><MapIcon className="size-5" />Map</button>
                <button type="button" onClick={() => setScreen("modes")} className={`${btn} flex-col gap-0 py-2 text-sm`}><Gamepad2 className="size-5" />Modes</button>
                <button type="button" onClick={() => setScreen("shop")} className={`${btn} flex-col gap-0 py-2 text-sm`}><span className="text-lg leading-5">🔮</span>Marbles</button>
                <button type="button" onClick={() => setScreen("dex")} className={`${btn} flex-col gap-0 py-2 text-sm`}><BookOpen className="size-5" />Dex</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- sheets */}
      <AnimatePresence>
        {screen === "map" && <RoadMap key="map" stage={stage} best={best} coins={coins} stars={stars} onBack={() => setScreen(card ? "race" : "home")} onPick={(k) => toStage(k)} />}
        {screen === "modes" && <ModesPanel key="modes" stage={stage} best={best} daily={daily} endless={endless} royale={royale} trials={trials} onBack={() => setScreen("home")} onPick={(k, tn) => startMode(k, tn)} />}
        {screen === "dex" && <DexPanel key="dex" met={met} best={best} onBack={() => setScreen("home")} />}
        {screen === "shop" && <ShopPanel key="shop" coins={coins} owned={owned} skin={skin} onBack={() => { setScreen("home"); const ss = session.current; if (ss && run.kind === "gp") void loadRun(ss, { kind: "gp" }, n); }} onBuy={(i) => { if (useOrbi.getState().buySkin(i, skinPrice(i))) audio.play("a:levelup", { gain: 0.5 }); }} onEquip={(i) => { useOrbi.getState().setSkin(i); audio.play("pop", { gain: 0.3 }); }} />}
      </AnimatePresence>

      {/* ---------------- race HUD */}
      {race && (
        <>
          {hud.speed > 170 && <div className="pointer-events-none absolute inset-0" style={{ opacity: Math.min(0.55, (hud.speed - 170) / 260), background: "repeating-conic-gradient(from 0deg at 50% 46%, rgba(255,255,255,0.0) 0deg 5deg, rgba(255,255,255,0.55) 5.4deg 5.8deg, rgba(255,255,255,0) 6.2deg 11deg)", WebkitMaskImage: "radial-gradient(ellipse at 50% 46%, transparent 32%, black 78%)", maskImage: "radial-gradient(ellipse at 50% 46%, transparent 32%, black 78%)" }} />}
          {hud.phase === "race" && <Speedo kmh={hud.speed} high={controls === "buttons"} right={controls === "stick"} />}
          {(hud.phase === "race" || hud.phase === "count") && controls === "stick" && <Joystick get={getSession} />}
          {hud.view === "narrow" && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_28%,rgba(0,0,0,0.92)_62%)]" />}
          <div className="pointer-events-none absolute inset-x-0 top-0 px-3" style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}>
            <div className="flex items-start gap-2 pr-12">
              <div className="flex items-baseline gap-0.5 rounded-2xl bg-[#14183A]/70 px-3 py-1 text-white backdrop-blur">
                {hud.mode === "endless" ? <span className="font-display text-2xl leading-none tabular-nums">{hud.dist.toLocaleString()}<span className="text-sm">m</span></span>
                  : <><span className={`font-display text-3xl leading-none ${hud.place === 1 ? "text-[#FFD23A]" : ""}`}>{ORD(hud.place)}</span><span className="text-sm font-bold opacity-75">/{hud.total}</span></>}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <div className="relative h-3.5 rounded-full bg-[#14183A]/55 ring-1 ring-white/30">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#5CF2FF] to-[#FFFFFF]" style={{ width: `${hud.progress * 100}%`, opacity: 0.55 }} />
                  {hud.dots.map((d, i) => <span key={i} className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${d.me ? "z-10 size-4 ring-2 ring-white shadow-[0_0_10px_#5CF2FF]" : "size-2.5 ring-1 ring-black/30"}`} style={{ left: `${d.p * 100}%`, background: d.me ? "#9FE8FF" : d.c }} />)}
                  <span className="absolute -top-1 -right-1 text-base leading-none">🏁</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-white drop-shadow">
                  <span className="tabular-nums">⏱ {clock(hud.time)}</span>
                  <span className="truncate px-2 opacity-90">{hud.mode === "gp" ? `${hud.emoji} ${hud.name}` : hud.mode === "endless" ? `${"❤️".repeat(Math.max(0, hud.lives))}` : hud.mode === "daily" ? "📅 Daily Cup" : hud.mode === "trial" ? "👻 Time Trial" : hud.mode === "royale" ? "🥊 Royale" : "👑 Boss Rush"}</span>
                  <span>🪙 {hud.coins}{hud.stars ? ` · ⭐ ${hud.stars}` : ""}</span>
                </div>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {hud.warn && <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="rounded-full bg-[#D61F3A]/85 px-2.5 py-0.5 text-[12px] font-bold text-white">{hud.warn}</motion.span>}
              {hud.goal && <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold text-white ${hud.goalOk ? "bg-[#16A35A]/80" : "bg-[#14183A]/70"}`}>{hud.goal}</span>}
              {hud.hearts > 0 && <span className="rounded-full bg-[#FF3A5A]/75 px-2 py-0.5 text-[12px] font-bold text-white">{"❤️".repeat(hud.hearts)}</span>}
              {hud.letters > 0 && <span className="flex gap-0.5 rounded-full bg-[#14183A]/70 px-2 py-0.5 text-[12px] font-black">{["O", "R", "B", "I"].map((c, i) => <span key={c} className={hud.letters & (1 << i) ? "text-[#FFD23A]" : "text-white/30"}>{c}</span>)}</span>}
              {hud.active.map((a) => <span key={a.k} className="rounded-full bg-[#7A3AC8]/75 px-2 py-0.5 text-[11px] font-bold text-white">{POWER_ICON[a.k]} {Math.ceil(a.t)}</span>)}
            </div>
          </div>

          {/* boost meter + power */}
          {hud.phase === "race" && (
            <div className="absolute inset-x-0 flex items-end justify-center gap-3 px-4" style={{ bottom: `max(16px, env(safe-area-inset-bottom))` }}>
              {controls === "buttons" && (
                <div className="absolute left-4 bottom-0 flex gap-2">
                  {(["left", "right"] as const).map((k) => (
                    <button key={k} type="button" aria-label={k} onPointerDown={(e) => { e.preventDefault(); s?.press(k, true); }} onPointerUp={() => s?.press(k, false)} onPointerCancel={() => s?.press(k, false)} onPointerLeave={() => s?.press(k, false)}
                      className="grid size-[4.6rem] place-items-center rounded-3xl bg-white/30 text-white ring-2 ring-white/50 backdrop-blur active:scale-95 active:bg-white/50">{k === "left" ? <ChevronLeft className="size-10" /> : <ChevronRight className="size-10" />}</button>
                  ))}
                </div>
              )}
              <button type="button" onPointerDown={(e) => { e.stopPropagation(); s?.useBoost(); }} className={`relative h-12 w-44 overflow-hidden rounded-full bg-[#14183A]/60 ring-2 backdrop-blur ${hud.meter >= 1 ? "ring-[#5CF2FF] shadow-[0_0_22px_#5CF2FF]" : "ring-white/30"}`} aria-label="Boost">
                <span className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#1E9CD8] to-[#7CF2FF]" style={{ width: `${hud.meter * 100}%` }} />
                <span className="relative flex items-center justify-center gap-1 font-display text-lg text-white"><Zap className="size-5 fill-white" />{hud.boosting ? "BOOST!" : hud.meter >= 1 ? "TAP!" : "BOOST"}</span>
              </button>
              {controls === "buttons" ? (
                <div className="absolute right-4 bottom-0 flex items-end gap-2">
                  <div className="flex flex-col gap-2">
                    <button type="button" aria-label="Jump" onPointerDown={(e) => { e.preventDefault(); s?.press("jump", true); }} className="grid size-16 place-items-center rounded-full bg-[#FF5AB8] text-white shadow-[0_5px_0_#A02878] active:translate-y-1"><ChevronsUp className="size-8" /></button>
                    <button type="button" aria-label="Brake" onPointerDown={(e) => { e.preventDefault(); s?.press("brake", true); }} onPointerUp={() => s?.press("brake", false)} onPointerCancel={() => s?.press("brake", false)} onPointerLeave={() => s?.press("brake", false)}
                      className="grid size-16 place-items-center rounded-full bg-[#5A6A8A] text-xs font-black text-white shadow-[0_5px_0_#2A3448] active:translate-y-1">BRAKE</button>
                  </div>
                  <button type="button" aria-label="Roll" onPointerDown={(e) => { e.preventDefault(); s?.press("roll", true); }} onPointerUp={() => s?.press("roll", false)} onPointerCancel={() => s?.press("roll", false)} onPointerLeave={() => s?.press("roll", false)}
                    className="grid h-28 w-20 place-items-center rounded-3xl bg-gradient-to-b from-[#A8FFCB] to-[#16A35A] font-display text-white shadow-[0_6px_0_#0a6a38] active:translate-y-1"><span className="flex flex-col items-center"><ChevronsUp className="size-9" />ROLL</span></button>
                </div>
              ) : hud.held && (
                <motion.button initial={{ scale: 0.4 }} animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 0.9 }} type="button" onPointerDown={(e) => { e.stopPropagation(); s?.usePower(); }} aria-label="Use power"
                  className="absolute right-4 bottom-0 grid size-20 place-items-center rounded-full bg-gradient-to-b from-[#FF9BE6] to-[#B83AC8] text-4xl shadow-[0_6px_0_#7A1A8A,0_0_24px_rgba(255,124,240,0.7)] ring-4 ring-white/60">{POWER_ICON[hud.held]}</motion.button>
              )}
              {controls === "buttons" && hud.held && <button type="button" onPointerDown={() => s?.usePower()} className="absolute right-4 bottom-32 grid size-14 place-items-center rounded-full bg-gradient-to-b from-[#FF9BE6] to-[#B83AC8] text-2xl ring-2 ring-white/60">{POWER_ICON[hud.held]}</button>}
            </div>
          )}

          {/* first race: how to roll */}
          <AnimatePresence>
            {firstRace && (hud.phase === "count" || hud.phase === "intro" || (hud.phase === "race" && hud.time < 7)) && controls === "stick" && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-[30%] flex justify-center px-6">
                <div className="flex flex-col items-center gap-1 rounded-3xl bg-[#14183A]/75 px-5 py-3 text-center text-white backdrop-blur">
                  <span className="text-3xl">🕹️</span>
                  <span className="font-display text-lg leading-tight">Push the stick forward to roll</span>
                  <span className="text-sm font-semibold opacity-85">Left / right to steer · pull back to brake · tap the right side to jump</span>
                </div>
              </motion.div>
            )}
            {firstRace && (hud.phase === "count" || hud.phase === "intro" || (hud.phase === "race" && hud.time < 6)) && controls === "drag" && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-[22%] flex justify-center px-6">
                <div className="flex flex-col items-center gap-1 rounded-3xl bg-[#14183A]/75 px-5 py-3 text-center text-white backdrop-blur">
                  <motion.span animate={{ x: [-16, 16, -16] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-3xl">👆</motion.span>
                  <span className="font-display text-lg leading-tight">Hold anywhere to roll</span>
                  <span className="text-sm font-semibold opacity-85">Slide left / right to steer · swipe up to jump</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ---------------- toasts */}
      <AnimatePresence>
        {toast && (screen === "race") && (
          <motion.div key={toast.id} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.3 }} className="pointer-events-none absolute inset-x-0 top-[26%] flex justify-center px-4 text-center">
            <span className={`font-display drop-shadow-[0_5px_0_rgba(20,30,90,0.45)] ${toast.tone === "big" ? "text-8xl text-white" : toast.tone === "go" ? "text-8xl text-[#7CFF6B]" : toast.tone === "red" ? "text-4xl text-[#FF8FA3]" : toast.tone === "pink" ? "text-3xl text-[#FFB3EC]" : toast.tone === "green" ? "text-3xl text-[#9CFFB8]" : toast.tone === "blue" ? "text-3xl text-[#9FE8FF]" : "text-4xl text-[#FFE27A]"}`}>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- results */}
      <AnimatePresence>
        {card && screen === "race" && (
          <motion.div key="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 grid place-items-center bg-[#0A1030]/45 px-5">
            <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 17 }} className="max-h-[calc(100%-16px)] w-full max-w-sm overflow-y-auto rounded-[2rem] bg-white p-5 text-center text-[#1A2A5A] shadow-[0_20px_60px_rgba(0,0,0,0.4)] [@media(max-height:480px)]:max-w-xl [@media(max-height:480px)]:p-3">
              <div className="text-6xl leading-none [@media(max-height:480px)]:text-3xl">{card.medal}</div>
              <div className="mt-1 font-display text-4xl [@media(max-height:480px)]:mt-0 [@media(max-height:480px)]:text-2xl">{card.title}</div>
              <div className={`text-sm font-bold ${card.ok ? "text-[#16A35A]" : "text-[#D61F3A]"}`}>{card.line}</div>
              {card.rating !== undefined && <div className="mt-3 flex justify-center gap-1 text-4xl [@media(max-height:480px)]:mt-1 [@media(max-height:480px)]:text-2xl">{[0, 1, 2].map((k) => <motion.span key={k} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.25 + k * 0.2, type: "spring" }} className={k < card.rating! ? "" : "opacity-20 grayscale"}>⭐</motion.span>)}</div>}
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold">
                {card.stats.map(([k, v], i) => <div key={k} className={`rounded-2xl py-2 ${["bg-[#EEF4FF]", "bg-[#FFF6D8]", "bg-[#EFFFF4]"][i % 3]}`}><div className="text-[10px] uppercase opacity-60">{k}</div><div className="font-display text-lg tabular-nums">{v}</div></div>)}
              </div>
              {card.note && <div className="mt-2 text-[11px] font-semibold opacity-70 [@media(max-height:480px)]:hidden">{card.note}</div>}
              <div className="mt-4 flex gap-2 [@media(max-height:480px)]:mt-2">
                <button type="button" onClick={run.kind === "gp" ? () => setScreen("map") : home} aria-label={run.kind === "gp" ? "Road map" : "Home"} className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] active:scale-95">{run.kind === "gp" ? <MapIcon className="size-6" /> : <span className="text-2xl">🏠</span>}</button>
                {card.retry && <button type="button" onClick={card.retry} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#EEF4FF] font-display text-lg active:scale-95"><RotateCcw className="size-5" />{run.kind === "gp" || run.kind === "trial" ? "Retry" : "Again"}</button>}
                {card.next && <button type="button" onClick={card.next.go} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#7CF2FF] to-[#1E9CD8] font-display text-lg text-white shadow-[0_5px_0_#1060A0] active:translate-y-1">{card.next.label}<Play className="size-5 fill-white" /></button>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {busy && screen === "race" && <div className="absolute inset-0 grid place-items-center bg-[#0A1030]/40"><div className="rounded-full bg-black/50 px-4 py-2 text-sm font-bold text-white">Building the course…</div></div>}
    </div>
  );
}
