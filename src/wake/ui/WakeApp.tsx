"use client";
// Wake Racers: the screens around the 3D water. The home screen over a live shot of your boat idling at the start of
// your current stage (leave and come back, you're right there), the cinematic stage card during the drone fly-over,
// the countdown, the race HUD (place, progress with every rival, hearts, coins, oil, nitro ring, the power you hold,
// timers and goals for each event), big thumb controls (steer left/right on the left; nitro, jump, brake and power on
// the right; keys shown on the web), the result card that rolls on to the next stage by itself, the stage map (twelve
// worlds and the endless remix) and the garage (boats, tuning, paint).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Map as MapIcon, Wrench, HelpCircle, X, Lock, Heart, Fuel, Zap, Shield, Magnet, Ghost, Waves, Snowflake, ArrowBigUp, Pause, Play, RotateCcw, Home as HomeIcon, Timer, Coins as CoinsIcon, Flag } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { useProfile } from "@/lib/store";
import { WakeGame, type GameEvent, type Hud } from "../game";
import { stagePlan, MODE_INFO, twistName, type StagePlan } from "../stages";
import { WORLDS, STAGES_PER_WORLD, DESIGNED_STAGES, worldOf } from "../worlds";
import { BOATS, PAINTS, UPGRADES, MAX_LEVEL, boatOf, tuned, upgradeCost, liveryOf, type BoatId, type Upgrade } from "../boats";
import { useWake, useWakeHydrated } from "../save";
import { MENU_SOUNDS, WAKE_SOUNDS, sfx } from "../sound";
import { ordinal, POWER_INFO, type PowerId, type Result } from "../race";
import { WAKE_CSS } from "./styles";

type Sheet = "" | "map" | "garage" | "help" | "pause";
interface Msg { id: number; big: string; sub?: string; color?: string }

function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12.6" r="10.5" fill="#B87309" /><circle cx="12" cy="12" r="10.5" fill="#FFD23F" /><circle cx="12" cy="12" r="7.2" fill="none" stroke="#E8A317" strokeWidth="1.8" />
      <ellipse cx="8.4" cy="7.9" rx="2.4" ry="1.2" fill="#FFF6C8" transform="rotate(-35 8.4 7.9)" />
    </svg>
  );
}
function Star({ on, delay = 0, size = 52 }: { on: boolean; delay?: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: `wk-pop .5s ${delay}s cubic-bezier(.3,1.7,.5,1) both` }}>
      <path d="M12 2.2l2.9 6.2 6.7.8-5 4.6 1.3 6.7L12 17.2l-5.9 3.3 1.3-6.7-5-4.6 6.7-.8z" fill={on ? "#FFD23F" : "rgba(255,255,255,.15)"} stroke={on ? "#B87309" : "rgba(255,255,255,.3)"} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
const POWER_ICON: Record<PowerId, React.ReactNode> = {
  turbo: <Zap className="size-7" fill="#FFD23F" stroke="#FF6A3D" strokeWidth={2} />, shield: <Shield className="size-7" fill="#9AF6FF" stroke="#1A9BC8" strokeWidth={2} />,
  magnet: <Magnet className="size-7" stroke="#FF4F7A" strokeWidth={2.6} />, wave: <Waves className="size-7" stroke="#5AB8FF" strokeWidth={2.6} />,
  ghost: <Ghost className="size-7" fill="#E8DCFF" stroke="#8B6BFF" strokeWidth={2} />, jump: <ArrowBigUp className="size-7" fill="#3EE08F" stroke="#0B8F52" strokeWidth={2} />,
  freeze: <Snowflake className="size-7" stroke="#9AF6FF" strokeWidth={2.6} />,
};
const GOAL = (p: StagePlan) => {
  switch (p.mode) {
    case "race": return `Finish ${ordinal(p.need)} or better`;
    case "knockout": return `Survive 4 knockout gates · finish ${ordinal(p.need)} or better`;
    case "duel": return `Beat ${worldOf(p.world).boss.name} one on one`;
    case "rush": return "Reach every checkpoint before the clock hits zero";
    case "coins": return "Collect the coins you need, then cross the line";
    case "traffic": return "Weave through the traffic and finish in time";
    case "survival": return "Dodge the hazards and reach the finish";
    case "dock": return "Cross the line, then stop in the glowing berth";
  }
};
const fmt = (s: number) => { if (!isFinite(s)) return "--"; const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, "0")}`; };

export default function WakeApp({ slug }: { slug: string; title: string }) {
  const ready = useWakeHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const save = useWake();
  const [screen, setScreen] = useState<"home" | "play">("home");
  const [sheet, setSheet] = useState<Sheet>("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; color: string } | null>(null);
  const [count, setCount] = useState<{ id: number; n: string } | null>(null);
  const [result, setResult] = useState<{ r: Result; plan: StagePlan; earned: number; cont: boolean } | null>(null);
  const [intro, setIntro] = useState<StagePlan | null>(null);
  const [busy, setBusy] = useState("");
  const [held, setHeld] = useState({ left: false, right: false, brake: false, nitro: false });
  const [mapWorld, setMapWorld] = useState(-1);
  const [gBoat, setGBoat] = useState<BoatId>("minnow");
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<WakeGame | null>(null);
  const [touchDevice] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const [gameReady, setGameReady] = useState(false);
  const [autoNext, setAutoNext] = useState(0);
  /** the stage the game has built (the home screen shows the saved stage) */
  const [curPlan, setCurPlan] = useState<StagePlan>(() => stagePlan(1));

  const say = useCallback((big: string, sub?: string, color?: string, ms = 1300) => {
    const id = Math.random();
    setMsg({ id, big, sub, color });
    setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), ms);
  }, []);
  const toastIt = useCallback((text: string, color = "#5FF2E0") => {
    const id = Math.random();
    setToast({ id, text, color });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1500);
  }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Filling the lagoon");
    void audio.preload(MENU_SOUNDS);
    // the site's own music player stays quiet: Wake Racers' music is composed live (src/wake/music.ts)
    void audio.stopMusic(0.2);
  }, []);

  const onEvent = useCallback((e: GameEvent) => {
    switch (e.k) {
      case "intro": setIntro(e.plan); break;
      case "count": setIntro(null); setCount({ id: Math.random(), n: String(e.n) }); break;
      case "go":
        setCount({ id: Math.random(), n: "GO!" });
        setTimeout(() => setCount(null), 900);
        if (!useWake.getState().seenHelp) {
          setTimeout(() => toastIt(window.matchMedia("(pointer: coarse)").matches ? "Steer ◀ ▶ · hold NITRO on straights" : "← → steer · Shift nitro · Space jump", "#FFD23F"), 1100);
          useWake.getState().sawHelp();
        }
        break;
      case "overtake": toastIt(`Overtake! ${ordinal(e.place)}`, "#5FF2E0"); break;
      case "knockout": if (e.you) say("Knocked out!", undefined, "#FF5A5F", 1600); else toastIt(`${e.name} is out!`, "#FF5A5F"); break;
      case "checkpoint": toastIt("Checkpoint!", "#FFD23F"); break;
      case "timeAdd": toastIt(`+${Math.round(e.secs)}s`, "#FFD23F"); break;
      case "nearMiss": toastIt("Near miss! +nitro", "#FF8A3D"); break;
      case "lowFuel": toastIt("Low oil — grab a can!", "#FF6A5A"); break;
      case "gotPower": toastIt(`${POWER_INFO[e.id].name}!`, POWER_INFO[e.id].color); break;
      case "power": say(POWER_INFO[e.id].name, undefined, POWER_INFO[e.id].color, 900); break;
      case "hit": say(e.hearts > 0 ? "Crash!" : "Wrecked!", e.hearts > 0 ? `${e.hearts} ${e.hearts === 1 ? "heart" : "hearts"} left` : undefined, "#FF5A5F", 1100); break;
      case "saved": {
        const g = gameRef.current;
        if (g) useWake.getState().setResume({ stage: g.plan.n, cp: e.cp, of: e.of, snap: e.snap });
        break;
      }
      case "result": {
        const s = useWake.getState();
        const earned = e.result.coins + e.result.bonus;
        s.addCoins(earned);
        s.played();
        if (e.result.ok) {
          s.setResume(null);
          s.clear(e.plan.n, e.result.stars);
          useProfile.getState().earnCoins(4 + Math.floor(e.plan.n / 25));
          track("wake_clear", { stage: e.plan.n, stars: e.result.stars, mode: e.plan.mode });
          setAutoNext(5);
        } else track("wake_fail", { stage: e.plan.n, reason: e.result.reason });
        // a wreck, an empty tank or the clock can be picked up at the last checkpoint (a lost race can't)
        const cont = !e.result.ok && !!gameRef.current?.race.lastSnap && /wrecked|oil|Time/.test(e.result.reason);
        setResult({ r: e.result, plan: e.plan, earned: cont ? 0 : earned, cont });
        if (cont) s.addCoins(-earned);
        break;
      }
      default: break;
    }
  }, [say, toastIt]);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const s = useWake.getState();
    setGBoat(s.boat);
    const g = new WakeGame(host.current, {
      onHud: (h) => setHud(h),
      onEvent: (e) => onEventRef.current(e),
    }, s.stage, s.boat, s.tune[s.boat] ?? {}, s.paint);
    gameRef.current = g;
    // QA and the art capture drive the game through this handle
    (window as unknown as { __wake?: WakeGame }).__wake = g;
    setCurPlan(g.plan);
    g.music.title();
    g.start();
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(host.current);
    // the rest of the sounds load in the background
    void audio.preload(WAKE_SOUNDS.filter((x) => !MENU_SOUNDS.includes(x)));
    loadRef.current(null);
    setGameReady(true);
    const vis = () => { if (document.hidden) g.pause(true); };
    document.addEventListener("visibilitychange", vis);
    return () => { ro.disconnect(); document.removeEventListener("visibilitychange", vis); g.dispose(); gameRef.current = null; setGameReady(false); };
  }, [ready]);

  useEffect(() => { gameRef.current?.pause(paused || sheet === "pause"); }, [paused, sheet]);
  useEffect(() => { setInRound(screen === "play"); setImmersive(screen === "play"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  // ---------------------------------------------------------------- flow
  /** build a stage (a heavy moment: the card shows first) then run f */
  const withStage = useCallback((stage: number, label: string, f: (g: WakeGame) => void) => {
    const g = gameRef.current;
    if (!g) return;
    setBusy(label);
    setTimeout(() => {
      const s = useWake.getState();
      g.load(stage, s.boat, s.tune[s.boat] ?? {}, s.paint);
      setCurPlan(g.plan);
      setBusy("");
      f(g);
    }, 40);
  }, []);

  const play = useCallback((stage?: number, resume = false) => {
    const g = gameRef.current;
    if (!g) return;
    sfx("tap");
    setSheet(""); setResult(null); setAutoNext(0);
    window.focus();
    const n = stage ?? useWake.getState().stage;
    const rs = useWake.getState().resume;
    const snap = resume && rs && rs.stage === n ? rs.snap : null;
    if (!snap) useWake.getState().setResume(null);
    const go = (gg: WakeGame) => { setScreen("play"); gg.play(snap); };
    if (n !== g.plan.n || g.phase !== "home") withStage(n, `Stage ${n}`, go); else go(g);
  }, [withStage]);

  const next = useCallback(() => {
    setResult(null); setAutoNext(0);
    const g = gameRef.current;
    const n = Math.min(useWake.getState().stage, (g?.plan.n ?? 0) + 1) || useWake.getState().stage;
    withStage(n, `Stage ${n}`, (g) => g.play());
  }, [withStage]);
  const retry = useCallback(() => {
    const g = gameRef.current; if (!g) return;
    setResult(null); setAutoNext(0); setSheet("");
    useWake.getState().setResume(null);
    withStage(g.plan.n, "Again!", (gg) => gg.play());
  }, [withStage]);
  const cont = useCallback(() => {
    const g = gameRef.current; if (!g) return;
    sfx("tap");
    setResult(null); setAutoNext(0); setSheet("");
    if (!g.continueRace()) retry();
  }, [retry]);
  const home = useCallback(() => {
    setResult(null); setAutoNext(0); setSheet(""); setScreen("home"); setIntro(null); setCount(null);
    const n = useWake.getState().stage;
    withStage(n, "", (g) => g.music.title());
  }, [withStage]);

  // the next stage rolls in by itself after a win
  useEffect(() => {
    if (autoNext <= 0) return;
    const id = setTimeout(() => { if (autoNext <= 1) next(); else setAutoNext(autoNext - 1); }, 1000);
    return () => clearTimeout(id);
  }, [autoNext, next]);

  useEffect(() => {
    setMenu(screen === "play" ? [
      { id: "restart", label: "Restart stage", onSelect: retry },
      { id: "garage", label: "Garage", onSelect: () => { home(); setSheet("garage"); } },
      { id: "home", label: "Main menu", onSelect: home },
    ] : []);
  }, [screen, setMenu, home, retry]);

  // ---------------------------------------------------------------- thumb controls
  const pointers = useRef(new Map<number, keyof typeof held>());
  const apply = useCallback(() => {
    const st = { left: false, right: false, brake: false, nitro: false };
    for (const v of pointers.current.values()) st[v] = true;
    const g = gameRef.current;
    if (g) Object.assign(g.touch, st);
    setHeld((h) => (h.left === st.left && h.right === st.right && h.brake === st.brake && h.nitro === st.nitro ? h : st));
  }, []);
  const down = useCallback((e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    const k = e.currentTarget.dataset.k as keyof typeof held;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, k);
    apply();
  }, [apply]);
  const up = useCallback((e: React.PointerEvent) => { pointers.current.delete(e.pointerId); apply(); }, [apply]);

  // keyboard on the menus: Enter / Space plays (or moves on from the result)
  useEffect(() => {
    const on = (k: string, isDown: boolean, prevent?: () => void) => {
      if (!isDown || sheet) return;
      if (k !== "Enter" && k !== " ") return;
      if (screen === "home" && gameReady) { prevent?.(); play(); }
      else if (screen === "play" && result) { prevent?.(); if (result.r.ok) next(); else if (result.cont) cont(); else retry(); }
    };
    const kd = (e: KeyboardEvent) => on(e.key, true, () => e.preventDefault());
    const onMsg = (m: MessageEvent) => { if (m.origin === window.location.origin && m.data?.type === "momoblobs:key") on(m.data.key ?? "", !!m.data.down); };
    const esc = (e: KeyboardEvent) => { if ((e.key === "Escape" || e.key === "p") && screen === "play" && !result) setSheet((s) => (s === "pause" ? "" : "pause")); };
    window.addEventListener("keydown", kd); window.addEventListener("keydown", esc); window.addEventListener("message", onMsg);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keydown", esc); window.removeEventListener("message", onMsg); };
  }, [screen, sheet, result, gameReady, play, next, retry, cont]);

  // ---------------------------------------------------------------- render bits
  const plan = useMemo(() => stagePlan(save.stage), [save.stage]);
  const w = worldOf(plan.world);
  const cw = worldOf(curPlan.world);
  const acc = screen === "play" ? cw.accent : w.accent, acc2 = screen === "play" ? cw.accent2 : w.accent2;
  const racing = screen === "play" && hud && hud.phase === "race";
  const lb = screen === "play" ? (hud?.letterbox ?? 0) : 0;

  return (
    <div className="wk-root" style={{ ["--acc" as string]: acc, ["--acc2" as string]: acc2 }} data-slug={slug} onPointerDown={() => window.focus()}>
      <style>{WAKE_CSS}</style>
      <div ref={host} className="wk-stage" />
      {/* cinematic bars */}
      <div className="wk-bar top" style={{ transform: `translateY(${(lb - 1) * 100}%)` }} />
      <div className="wk-bar bot" style={{ transform: `translateY(${(1 - lb) * 100}%)` }} />

      {screen === "home" && gameReady && !sheet && (
        <div className="wk-ui wk-safe" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none", marginTop: 52 }}>
            <span className="wk-pill" style={{ pointerEvents: "auto" }}><CoinIcon /> {save.coins.toLocaleString()}</span>
            <span className="wk-pill" style={{ pointerEvents: "auto" }}><Star on size={18} /> {save.stars.reduce((a, b) => a + b, 0)}</span>
          </div>
          <div className="wk-logo wk-wave" style={{ ["--c1" as string]: w.accent, ["--c2" as string]: w.accent2, pointerEvents: "none", marginTop: "-4vh" }}>
            <div className="row l1">{"WAKE".split("").map((ch, i) => <span key={i} style={{ animationDelay: `${i * 0.06}s` }}>{ch}</span>)}</div>
            <div className="row l2">{"RACERS".split("").map((ch, i) => <span key={i} style={{ animationDelay: `${0.25 + i * 0.05}s` }}>{ch}</span>)}</div>
          </div>
          <div className="wk-panel" style={{ padding: "16px 16px 14px", width: "min(100%, 460px)", alignSelf: "center" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              <span className="wk-chip acc">{plan.remix ? `REMIX ${plan.local}` : `${w.name.toUpperCase()} · ${plan.local}/${STAGES_PER_WORLD}`}</span>
              <span className="wk-chip" style={{ borderColor: MODE_INFO[plan.mode].color, color: MODE_INFO[plan.mode].color }}>{MODE_INFO[plan.mode].name.toUpperCase()}</span>
              {plan.twist && <span className="wk-chip">{twistName(plan.twist)}</span>}
            </div>
            <div className="wk-display" style={{ fontSize: 26, textAlign: "center", marginTop: 8, lineHeight: 1.05 }}>Stage {plan.n} · {plan.name}</div>
            <div style={{ textAlign: "center", fontSize: 13.5, opacity: 0.85, fontWeight: 700, marginTop: 4 }}>{GOAL(plan)}</div>
            {save.resume && save.resume.stage === plan.n ? (
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="wk-btn wk-cta wk-shine wk-display" style={{ flex: 1, height: 64, fontSize: 22, borderRadius: 22, lineHeight: 1 }} onClick={() => play(undefined, true)}>
                  <Play className="size-6" fill="#032b33" /> <span>CONTINUE<br /><small style={{ fontSize: 13 }}>Checkpoint {save.resume.cp} of {save.resume.of}</small></span>
                </button>
                <button className="wk-btn wk-ghost" style={{ width: 92, height: 64, fontSize: 14, borderRadius: 22 }} onClick={() => play()}><RotateCcw className="size-4" /> Restart</button>
              </div>
            ) : (
              <button className="wk-btn wk-cta wk-shine wk-display" style={{ width: "100%", height: 64, fontSize: 30, marginTop: 12, borderRadius: 22 }} onClick={() => play()}>
                <Play className="size-7" fill="#032b33" /> RACE
              </button>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "center" }}>
              <button className="wk-btn wk-ghost" style={{ flex: 1, height: 50, fontSize: 15 }} onClick={() => { sfx("open"); setMapWorld(-1); setSheet("map"); }}><MapIcon className="size-5" /> Stages</button>
              <button className="wk-btn wk-ghost" style={{ flex: 1, height: 50, fontSize: 15 }} onClick={() => { sfx("open"); setGBoat(useWake.getState().boat); setSheet("garage"); }}><Wrench className="size-5" /> Garage</button>
              <button className="wk-btn wk-ghost wk-icon" style={{ width: 50, height: 50 }} onClick={() => { sfx("open"); setSheet("help"); }} aria-label="How to play"><HelpCircle className="size-5" /></button>
            </div>
          </div>
        </div>
      )}

      {/* intro card during the fly-over */}
      {screen === "play" && intro && hud?.phase === "intro" && (
        <>
          <div className="wk-card wk-panel">
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
              <span className="wk-chip acc">{intro.remix ? `REMIX · ${worldOf(intro.world).name} × ${worldOf(intro.blend!).name}` : `${worldOf(intro.world).name.toUpperCase()}`}</span>
              <span className="wk-chip" style={{ color: MODE_INFO[intro.mode].color, borderColor: MODE_INFO[intro.mode].color }}>{MODE_INFO[intro.mode].name.toUpperCase()}</span>
              {intro.twist && <span className="wk-chip">{twistName(intro.twist)}</span>}
            </div>
            <div className="wk-display" style={{ fontSize: "clamp(26px,7vw,40px)", marginTop: 8, lineHeight: 1 }}>Stage {intro.n}</div>
            <div className="wk-display" style={{ fontSize: "clamp(18px,4.6vw,24px)", opacity: 0.9 }}>{intro.name}</div>
            <div style={{ fontWeight: 800, fontSize: 14, marginTop: 6, color: "#FFE066" }}>{GOAL(intro)}</div>
          </div>
          <button className="wk-btn wk-ghost wk-skip" style={{ height: 40, padding: "0 16px", fontSize: 14 }} onClick={() => gameRef.current?.skipIntro()}>Skip <ChevronRight className="size-4" /></button>
        </>
      )}

      {count && <div className="wk-count" key={count.id}><b style={{ color: count.n === "GO!" ? "#5FF2E0" : "#fff" }}>{count.n}</b></div>}
      {msg && <div className="wk-big" key={msg.id}><b style={{ color: msg.color ?? "#fff" }}>{msg.big}</b>{msg.sub && <span>{msg.sub}</span>}</div>}
      {toast && <div className="wk-toast" key={toast.id} style={{ ["--tc" as string]: toast.color, color: toast.color }}>{toast.text}</div>}

      {/* race HUD */}
      {racing && hud && <RaceHud hud={hud} plan={curPlan} onPause={() => { sfx("tap"); setSheet("pause"); }} />}
      {racing && hud?.wrongWay && <div className="wk-wrong">WRONG WAY!</div>}

      {/* thumb controls */}
      {screen === "play" && hud && (hud.phase === "race" || hud.phase === "countdown") && !result && (
        <>
          <div className="wk-pad l">
            <button className={`wk-tb wk-steer ${held.left ? "on" : ""}`} data-k="left" onPointerDown={down} onPointerUp={up} onPointerCancel={up} aria-label="Steer left"><ChevronLeft className="size-10" strokeWidth={3.2} />{!touchDevice && <span className="k">← / A</span>}</button>
            <button className={`wk-tb wk-steer ${held.right ? "on" : ""}`} data-k="right" onPointerDown={down} onPointerUp={up} onPointerCancel={up} aria-label="Steer right"><ChevronRight className="size-10" strokeWidth={3.2} />{!touchDevice && <span className="k">→ / D</span>}</button>
          </div>
          <div className="wk-pad r" style={{ flexDirection: "column", alignItems: "flex-end", gap: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <button className={`wk-tb wk-power ${hud.power ? "ready" : ""}`} style={{ ["--pc" as string]: hud.power ? POWER_INFO[hud.power].color : "#fff", opacity: hud.power ? 1 : 0.45 }} onPointerDown={(e) => { e.preventDefault(); gameRef.current?.usePower(); }} aria-label="Use power">
                {hud.power ? POWER_ICON[hud.power] : <span style={{ fontSize: 22, opacity: 0.6 }}>?</span>}{!touchDevice && <span className="k">E</span>}
              </button>
              <button className="wk-tb wk-small" onPointerDown={(e) => { e.preventDefault(); gameRef.current?.jump(); }} aria-label="Jump"><ArrowBigUp className="size-8" strokeWidth={2.4} />{!touchDevice && <span className="k">SPACE</span>}</button>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <button className={`wk-tb wk-small ${held.brake ? "on" : ""}`} data-k="brake" onPointerDown={down} onPointerUp={up} onPointerCancel={up} aria-label="Brake" style={{ fontSize: 12, letterSpacing: ".06em" }}>BRAKE{!touchDevice && <span className="k">↓ / S</span>}</button>
              <button className={`wk-tb wk-nitro ${held.nitro ? "on" : ""} ${hud.nitro < 0.05 ? "empty" : ""}`} data-k="nitro" onPointerDown={down} onPointerUp={up} onPointerCancel={up} aria-label="Nitro">
                <svg className="wk-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="7" /><circle cx="50" cy="50" r="46" fill="none" stroke="#FFE24A" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${hud.nitro * 289} 289`} transform="rotate(-90 50 50)" /></svg>
                <Zap className="size-8" fill="#fff" stroke="#fff" /><span style={{ fontSize: 11, letterSpacing: ".1em" }}>NITRO</span>{!touchDevice && <span className="k">SHIFT</span>}
              </button>
            </div>
          </div>
        </>
      )}

      {busy && (
        <div className="wk-modal" style={{ background: "rgba(3,8,20,.55)" }}>
          <div className="wk-panel" style={{ padding: "16px 26px", textAlign: "center" }}>
            <div className="wk-display" style={{ fontSize: 30 }}>{busy}</div>
            <div style={{ fontWeight: 700, opacity: 0.8, fontSize: 13 }}>{busy.startsWith("Stage") ? "Next stage starting…" : "Getting ready…"}</div>
          </div>
        </div>
      )}

      {result && <ResultCard res={result} autoNext={autoNext} onNext={next} onRetry={retry} onContinue={cont} onHome={home} onGarage={() => { home(); setGBoat(useWake.getState().boat); setSheet("garage"); }} />}

      {sheet === "pause" && (
        <div className="wk-modal">
          <div className="wk-panel wk-result">
            <div className="wk-display" style={{ fontSize: 40 }}>Paused</div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <button className="wk-btn wk-cta wk-shine" style={{ height: 56, fontSize: 20 }} onClick={() => { sfx("tap"); setSheet(""); }}><Play className="size-5" fill="#032b33" /> Resume</button>
              <button className="wk-btn" style={{ height: 50, fontSize: 17 }} onClick={retry}><RotateCcw className="size-5" /> Restart</button>
              <button className="wk-btn wk-ghost" style={{ height: 50, fontSize: 17 }} onClick={home}><HomeIcon className="size-5" /> Main menu</button>
            </div>
          </div>
        </div>
      )}
      {sheet === "map" && <MapSheet stage={save.stage} stars={save.stars} world={mapWorld} setWorld={setMapWorld} onClose={() => setSheet("")} onPlay={(n) => play(n)} />}
      {sheet === "garage" && <GarageSheet sel={gBoat} setSel={setGBoat} onClose={() => setSheet("")} onChange={() => { const s = useWake.getState(); gameRef.current?.load(gameRef.current.plan.n, s.boat, s.tune[s.boat] ?? {}, s.paint); }} />}
      {sheet === "help" && <HelpSheet onClose={() => setSheet("")} touch={touchDevice} />}
    </div>
  );
}

// ---------------------------------------------------------------- race HUD
function RaceHud({ hud, plan, onPause }: { hud: Hud; plan: StagePlan; onPause: () => void }) {
  const timed = isFinite(hud.timeLimit);
  const RIVAL = ["#FF5A5F", "#FFD23F", "#3EE08F", "#B98CFF", "#FF8FC3", "#5AB8FF"];
  return (
    <div className="wk-hud">
      <div className="tl">
        {plan.rivals > 0 ? <div className="wk-place"><b>{hud.place}</b><i>{ordinal(hud.place).replace(/\d+/, "")}</i><small>/{hud.of}</small></div>
          : <div className="wk-place"><b style={{ fontSize: 30 }}>{MODE_INFO[plan.mode].name}</b></div>}
        {timed && <div className={`wk-timer ${hud.timeLeft < 8 ? "warn" : ""}`}><Timer className="inline size-6 -mt-1" /> {fmt(hud.timeLeft)}</div>}
        {plan.mode === "coins" && <span className="wk-pill"><CoinIcon /> {hud.coins}/{hud.need}</span>}
        {plan.mode === "knockout" && <span className="wk-pill"><Flag className="size-4" /> Gate {Math.min(hud.cp + 1, hud.cps)}/{hud.cps}</span>}
        <div className="wk-speed2">{hud.speed}<small>KM/H · {hud.toGo >= 1000 ? `${(hud.toGo / 1000).toFixed(1)} KM` : `${Math.round(hud.toGo)} M`} TO GO</small></div>
        <div className={`wk-meter ${hud.fuel < 0.25 ? "wk-low" : ""}`}><Fuel className="size-4" stroke="#FF6A5A" /><div className="bar"><div style={{ width: `${hud.fuel * 100}%`, background: hud.fuel < 0.25 ? "#FF5A5F" : "linear-gradient(90deg,#FFB21F,#FF6A3D)" }} /></div></div>
        {(hud.shield > 0 || hud.magnet > 0 || hud.ghost > 0) && (
          <div style={{ display: "flex", gap: 6 }}>
            {hud.shield > 0 && <span className="wk-pill" style={{ padding: ".25rem .5rem" }}><Shield className="size-4" stroke="#36E3FF" /></span>}
            {hud.magnet > 0 && <span className="wk-pill" style={{ padding: ".25rem .5rem" }}><Magnet className="size-4" stroke="#FF4F7A" /> {Math.ceil(hud.magnet)}</span>}
            {hud.ghost > 0 && <span className="wk-pill" style={{ padding: ".25rem .5rem" }}><Ghost className="size-4" stroke="#B98CFF" /> {Math.ceil(hud.ghost)}</span>}
          </div>
        )}
      </div>
      <div className="wk-track">
        <div className="fill" style={{ width: `${hud.progress * 100}%` }} />
        {hud.cps <= 24 && Array.from({ length: hud.cps }, (_, i) => <div key={i} className="cp" style={{ left: `${((i + 1) / (hud.cps + 1)) * 100}%` }} />)}
        {hud.rivals.map((p, i) => !hud.out[i] && <div key={i} className="dot" style={{ left: `${p * 100}%`, background: RIVAL[i % RIVAL.length] }} />)}
        <div className="dot me" style={{ left: `${hud.progress * 100}%` }} />
        <span className="flag">🏁</span>
      </div>
      <div className="tr">
        <button className="wk-btn wk-ghost" style={{ width: 44, height: 44, padding: 0, borderRadius: 14 }} onClick={onPause} aria-label="Pause"><Pause className="size-5" fill="#fff" /></button>
        <div style={{ display: "flex", gap: 2 }}>{Array.from({ length: hud.maxHearts }, (_, i) => <Heart key={i} className="size-[19px]" fill={i < hud.hearts ? "#FF3B5C" : "rgba(255,255,255,.18)"} stroke={i < hud.hearts ? "#9A1530" : "none"} strokeWidth={1.6} />)}</div>
        <span className="wk-pill"><CoinIcon size={16} /> {hud.coins}</span>
      </div>
      <div className="wk-speed">{hud.speed}<small>KM/H · {hud.toGo >= 1000 ? `${(hud.toGo / 1000).toFixed(1)} KM` : `${Math.round(hud.toGo)} M`} TO GO</small></div>
    </div>
  );
}

// ---------------------------------------------------------------- result
function ResultCard({ res, autoNext, onNext, onRetry, onContinue, onHome, onGarage }: { res: { r: Result; plan: StagePlan; earned: number; cont: boolean }; autoNext: number; onNext: () => void; onRetry: () => void; onContinue: () => void; onHome: () => void; onGarage: () => void }) {
  const { r, plan } = res;
  const racing = plan.rivals > 0;
  const head = r.ok ? (racing ? (r.place === 1 ? "1st Place!" : `${ordinal(r.place)} Place!`) : plan.mode === "dock" ? "Docked!" : "Stage Clear!") : r.reason.includes("wrecked") ? "Wrecked!" : r.reason.includes("oil") ? "Out of oil!" : r.reason.includes("Time") ? "Time's up!" : "Not this time";
  return (
    <div className="wk-modal">
      <div className="wk-panel wk-result">
        <div className="wk-display" style={{ fontSize: "clamp(34px,10vw,48px)", lineHeight: 1, color: r.ok ? "#5FF2E0" : "#FF6A5A" }}>{head}</div>
        <div style={{ fontWeight: 800, opacity: 0.85, marginTop: 4 }}>Stage {plan.n} · {plan.name}</div>
        {r.ok ? <div className="wk-stars">{[1, 2, 3].map((k) => <Star key={k} on={r.stars >= k} delay={0.2 + k * 0.15} />)}</div>
          : <div style={{ fontWeight: 800, fontSize: 15, margin: "12px 0 6px", color: "#FFE066" }}>{r.reason}</div>}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", margin: "6px 0 14px" }}>
          <span className="wk-pill"><Timer className="size-4" /> {fmt(r.time)}</span>
          <span className="wk-pill"><CoinIcon size={16} /> +{res.earned}</span>
          <span className="wk-pill"><CoinsIcon className="size-4" /> {r.coins}/{r.coinsTotal}</span>
        </div>
        {r.ok ? (
          <div style={{ display: "grid", gap: 10 }}>
            <button className="wk-btn wk-cta wk-shine wk-display" style={{ height: 60, fontSize: 24 }} onClick={onNext}>Next stage {autoNext > 0 ? `· ${autoNext}` : ""} <ChevronRight className="size-6" /></button>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="wk-btn wk-ghost" style={{ flex: 1, height: 48, fontSize: 15 }} onClick={onRetry}><RotateCcw className="size-4" /> Again</button>
              <button className="wk-btn wk-ghost" style={{ flex: 1, height: 48, fontSize: 15 }} onClick={onHome}><HomeIcon className="size-4" /> Menu</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {res.cont ? (
              <>
                <button className="wk-btn wk-cta wk-shine wk-display" style={{ height: 60, fontSize: 22 }} onClick={onContinue}><Play className="size-6" fill="#032b33" /> Continue from checkpoint</button>
                <button className="wk-btn wk-hot" style={{ height: 48, fontSize: 15 }} onClick={onRetry}><RotateCcw className="size-4" /> Restart stage</button>
              </>
            ) : <button className="wk-btn wk-hot wk-shine wk-display" style={{ height: 60, fontSize: 24 }} onClick={onRetry}><RotateCcw className="size-6" /> Try again</button>}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="wk-btn wk-violet" style={{ flex: 1, height: 48, fontSize: 15 }} onClick={onGarage}><Wrench className="size-4" /> Upgrade</button>
              <button className="wk-btn wk-ghost" style={{ flex: 1, height: 48, fontSize: 15 }} onClick={onHome}><HomeIcon className="size-4" /> Menu</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- stage map
function MapSheet({ stage, stars, world, setWorld, onClose, onPlay }: { stage: number; stars: number[]; world: number; setWorld: (n: number) => void; onClose: () => void; onPlay: (n: number) => void }) {
  const cur = Math.min(stage, DESIGNED_STAGES + 100000);
  const wi = world >= 0 ? world : Math.min(WORLDS.length, Math.floor((Math.min(cur, DESIGNED_STAGES + 1) - 1) / STAGES_PER_WORLD));
  const remix = wi >= WORLDS.length;
  const w = remix ? null : WORLDS[wi];
  const first = remix ? DESIGNED_STAGES + 1 + Math.max(0, Math.floor((cur - DESIGNED_STAGES - 1) / 50) * 50) : wi * STAGES_PER_WORLD + 1;
  const list = Array.from({ length: 50 }, (_, i) => first + i);
  return (
    <div className="wk-sheet wk-panel" style={{ ["--acc" as string]: w?.accent ?? "#FF3DCB" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="wk-display" style={{ fontSize: 26 }}>{remix ? "Endless Remix" : w!.name}</div>
        <button className="wk-btn wk-ghost" style={{ width: 42, height: 42, padding: 0, borderRadius: 14 }} onClick={onClose} aria-label="Close"><X className="size-5" /></button>
      </div>
      <div className="wk-hscroll" style={{ marginBottom: 10 }}>
        {WORLDS.map((x, i) => {
          const open = cur > i * STAGES_PER_WORLD;
          return <button key={x.id} className="wk-chip" style={{ cursor: open ? "pointer" : "default", opacity: open ? 1 : 0.45, background: i === wi ? x.accent : undefined, color: i === wi ? "#06142e" : undefined, border: i === wi ? 0 : undefined, fontFamily: "inherit" }} onClick={() => open && (sfx("tap"), setWorld(i))}>{!open && <Lock className="size-3" />}{x.name}</button>;
        })}
        <button className="wk-chip" style={{ cursor: cur > DESIGNED_STAGES ? "pointer" : "default", opacity: cur > DESIGNED_STAGES ? 1 : 0.45, background: remix ? "#FF3DCB" : undefined, color: remix ? "#06142e" : undefined, fontFamily: "inherit" }} onClick={() => cur > DESIGNED_STAGES && (sfx("tap"), setWorld(WORLDS.length))}>{cur <= DESIGNED_STAGES && <Lock className="size-3" />}Remix ∞</button>
      </div>
      {w && <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 700, marginBottom: 10 }}>{w.tagline}</div>}
      <div className="wk-scroll" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(58px,1fr))", gap: 8 }}>
        {list.map((n) => {
          const open = n <= cur, st = stars[n - 1] ?? 0;
          return (
            <button key={n} className={`wk-tile ${n === cur ? "cur" : ""} ${open ? "" : "locked"}`} onClick={() => open && onPlay(n)}>
              {open ? n : <Lock className="size-4" />}
              {open && n < cur && <span className="st">{[1, 2, 3].map((k) => <Star key={k} on={st >= k} size={11} />)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- garage
function GarageSheet({ sel, setSel, onClose, onChange }: { sel: BoatId; setSel: (b: BoatId) => void; onClose: () => void; onChange: () => void }) {
  const s = useWake();
  const b = boatOf(sel), owned = s.boats.includes(sel), lv = s.tune[sel] ?? {};
  const t = tuned(sel, lv);
  const maxTop = 50, maxAcc = 15, maxTurn = 3, maxGrip = 6, maxBoost = 20;
  const stat = (label: string, v: number, max: number) => <div className="wk-stat"><span>{label}</span><div className="bar"><div style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></div></div>;
  const pick = (id: BoatId) => { sfx("tap"); setSel(id); if (s.boats.includes(id)) { s.useBoat(id); onChange(); } };
  return (
    <div className="wk-sheet wk-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="wk-display" style={{ fontSize: 26 }}>Garage</div>
        <span className="wk-pill"><CoinIcon /> {s.coins.toLocaleString()}</span>
        <button className="wk-btn wk-ghost" style={{ width: 42, height: 42, padding: 0, borderRadius: 14 }} onClick={onClose} aria-label="Close"><X className="size-5" /></button>
      </div>
      <div className="wk-hscroll" style={{ marginBottom: 10 }}>
        {BOATS.map((x) => {
          const own = s.boats.includes(x.id), L = liveryOf(x, s.paint);
          return (
            <button key={x.id} onClick={() => pick(x.id)} className="wk-panel" style={{ width: 112, padding: "10px 8px", borderRadius: 18, cursor: "pointer", color: "#fff", fontFamily: "inherit", borderColor: x.id === sel ? "#fff" : undefined, outline: x.id === s.boat ? "3px solid var(--acc)" : "none" }}>
              <div style={{ height: 34, borderRadius: 12, background: `linear-gradient(135deg, ${L.hull} 0 55%, ${L.stripe} 55% 70%, ${L.deck} 70%)`, border: "2px solid rgba(255,255,255,.3)" }} />
              <div style={{ fontWeight: 900, fontSize: 14, marginTop: 6 }}>{x.name}</div>
              <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 700 }}>{x.cls}</div>
              <div style={{ fontSize: 12, fontWeight: 800, marginTop: 3 }}>{own ? (x.id === s.boat ? "Racing" : "Owned") : <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}><CoinIcon size={13} />{x.price.toLocaleString()}</span>}</div>
            </button>
          );
        })}
      </div>
      <div className="wk-scroll" style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.85 }}>{b.blurb}</div>
        <div style={{ display: "grid", gap: 6 }}>
          {stat("Top speed", t.top, maxTop)}{stat("Pick-up", t.accel, maxAcc)}{stat("Handling", t.turn, maxTurn)}{stat("Grip", t.grip, maxGrip)}{stat("Nitro", t.boost, maxBoost)}
        </div>
        {!owned ? (
          <button className="wk-btn wk-cta wk-shine" style={{ height: 54, fontSize: 18 }} disabled={s.coins < b.price} onClick={() => { if (s.buyBoat(sel)) { sfx("buy"); onChange(); } }}>
            Buy {b.name} · <CoinIcon /> {b.price.toLocaleString()}
          </button>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {UPGRADES.map((u: Upgrade) => {
              const l = lv[u] ?? 0, cost = upgradeCost(sel, l);
              return (
                <div key={u} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 80, fontWeight: 800, fontSize: 14, textTransform: "capitalize" }}>{u}</div>
                  <div style={{ display: "flex", gap: 4, flex: 1 }}>{Array.from({ length: MAX_LEVEL }, (_, i) => <div key={i} style={{ flex: 1, height: 10, borderRadius: 4, background: i < l ? "var(--acc)" : "rgba(255,255,255,.14)" }} />)}</div>
                  <button className="wk-btn wk-violet" style={{ height: 40, minWidth: 92, fontSize: 13, borderRadius: 14 }} disabled={l >= MAX_LEVEL || s.coins < cost} onClick={() => { if (s.upgrade(sel, u)) { sfx("buy"); onChange(); } }}>
                    {l >= MAX_LEVEL ? "MAX" : <><CoinIcon size={14} />{cost}</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="wk-display" style={{ fontSize: 18, marginTop: 4 }}>Paint</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PAINTS.map((p) => {
            const own = s.paints.includes(p.id), L = liveryOf(b, p.id);
            return (
              <button key={p.id} onClick={() => { if (own) { sfx("tap"); s.usePaint(p.id); onChange(); } else if (s.buyPaint(p.id)) { sfx("buy"); onChange(); } }} disabled={!own && s.coins < p.price}
                style={{ width: 64, borderRadius: 14, padding: 5, border: s.paint === p.id ? "2.5px solid #fff" : "1.5px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.06)", color: "#fff", cursor: "pointer", fontFamily: "inherit", opacity: !own && s.coins < p.price ? 0.5 : 1 }}>
                <div style={{ height: 26, borderRadius: 8, background: `linear-gradient(135deg, ${L.hull} 0 60%, ${L.stripe} 60%)` }} />
                <div style={{ fontSize: 10.5, fontWeight: 800, marginTop: 3 }}>{own ? p.name : <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}><CoinIcon size={11} />{p.price}</span>}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HelpSheet({ onClose, touch }: { onClose: () => void; touch: boolean }) {
  const rows: [string, string][] = touch
    ? [["◀ ▶", "Steer (your boat speeds up by itself)"], ["NITRO", "Hold for a burst of speed — fills from coins, jumps, slides and near misses"], ["Jump", "Hop over logs and debris"], ["Brake", "Slow down; hold with a turn for a power slide"], ["Power", "Use the power from a ? box"]]
    : [["← → / A D", "Steer (your boat speeds up by itself)"], ["Shift", "Nitro — fills from coins, jumps, slides and near misses"], ["Space", "Jump over logs and debris"], ["↓ / S", "Brake; hold with a turn for a power slide"], ["E", "Use the power from a ? box"], ["P / Esc", "Pause"]];
  return (
    <div className="wk-sheet wk-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="wk-display" style={{ fontSize: 26 }}>How to race</div>
        <button className="wk-btn wk-ghost" style={{ width: 42, height: 42, padding: 0, borderRadius: 14 }} onClick={onClose} aria-label="Close"><X className="size-5" /></button>
      </div>
      <div className="wk-scroll" style={{ display: "grid", gap: 10, fontSize: 14, fontWeight: 700 }}>
        {rows.map(([k, v]) => <div key={k} style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="wk-chip acc" style={{ minWidth: 92, justifyContent: "center" }}>{k}</span><span style={{ opacity: 0.9 }}>{v}</span></div>)}
        <div style={{ opacity: 0.85, lineHeight: 1.45 }}>
          Grab <b style={{ color: "#FFD23F" }}>coins</b> to buy and tune boats, <b style={{ color: "#FF3B5C" }}>hearts</b> to mend your hull, <b style={{ color: "#FF6A3D" }}>oil cans</b> before your tank runs dry, and <b style={{ color: "#B98CFF" }}>? boxes</b> for powers. Rocks, mines, logs and bridge pillars hurt; buoys, barrels and crates just get knocked away.
          Every stage is a different event: races, knockouts, checkpoint rushes, coin rushes, traffic, survival, docking and a champion duel at the end of each world. After stage 600 the remix never ends.
        </div>
      </div>
    </div>
  );
}
