"use client";
// Obby Bike Blaster: the screens around the 3D view — the home screen over a drifting view of your course, the HUD
// (level and checkpoint, the course strip with sector ticks, chain oil, coins, lives, power timers, speed), the thumb
// stick with JUMP and FIRE, the cinematic level cards ("Level 12 started!"), checkpoint and sector messages, the
// finish banner that moves on by itself (no menu between levels), the Garage (bikes, upgrades, riders), the world map
// and the help sheet with the play settings.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pixelify_Sans } from "next/font/google";
import { Map as MapIcon, Play, Wrench, HelpCircle, X, Lock, Check, Heart, Zap, Magnet, Shield, Feather, Timer, Crosshair, Droplet, Star, Flag } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { useProfile } from "@/lib/store";
import { Game, type GameEvent, type Hud, type LevelStats } from "../game";
import { levelPlan, MOD_LABEL } from "../course";
import { DESIGNED_LEVELS, LEVELS_PER_WORLD, WORLDS } from "../worlds";
import { BIKES, MAX_LEVEL, POWERS, UPGRADES, upgradeCost, type BikeId, type PowerId } from "../gear";
import { RIDERS, type Look } from "../models";
import { usePedal, usePedalHydrated } from "../save";
import { FIRST_SOUNDS, PEDAL_SOUNDS, sfx } from "../sound";
import { PedalMusic } from "../music";
import { mix, shade } from "../util";
import { PEDAL_CSS, PEDAL_EXTRA_CSS } from "./styles";

const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-pixel", display: "swap" });

type Sheet = "" | "garage" | "worlds" | "help";
interface Msg { id: number; big: string; sub?: string; color?: string }
function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M2 0h4v1h1v1h1v4h-1v1h-1v1h-4v-1h-1v-1h-1v-4h1v-1h1z" fill="#E8A317" />
      <path d="M2 1h4v1h1v4h-1v1h-4v-1h-1v-4h1z" fill="#FFD23F" />
      <path d="M2 2h1v3h-1zM3 1h2v1h-2z" fill="#FFF6C8" /><path d="M5 3h1v3h-1z" fill="#E8A317" />
    </svg>
  );
}
const Hearts = ({ n }: { n: number }) => (
  <span className="ob-hearts">
    {Array.from({ length: Math.max(3, Math.min(6, n)) }, (_, i) => <Heart key={i} className={`size-[17px] ${i < n ? "" : "opacity-30"}`} fill={i < n ? "#FF4F7A" : "rgba(255,255,255,.4)"} stroke={i < n ? "#B0183F" : "none"} strokeWidth={1.5} />)}
    {n > 6 && <b className="ml-0.5 text-sm">+{n - 6}</b>}
  </span>
);
const POWER_ICON: Record<PowerId, React.ReactNode> = {
  turbo: <Zap className="size-5" fill="#FFD23F" stroke="#FF8F1F" />, shield: <Shield className="size-5" fill="#7CF5FF" stroke="#2E9BFF" />,
  magnet: <Magnet className="size-5" stroke="#3EE08F" strokeWidth={2.6} />, wings: <Feather className="size-5" stroke="#FFFFFF" strokeWidth={2.4} />,
  slowmo: <Timer className="size-5" stroke="#B98AFF" strokeWidth={2.6} />, rapid: <Crosshair className="size-5" stroke="#FF6A2B" strokeWidth={2.6} />,
};
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export default function PedalApp({ slug }: { slug: string; title: string }) {
  const ready = usePedalHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const save = usePedal();
  const [screen, setScreen] = useState<"home" | "play">("home");
  const [sheet, setSheet] = useState<Sheet>("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; color: string } | null>(null);
  const [done, setDone] = useState<LevelStats | null>(null);
  const [intro, setIntro] = useState<{ n: number; next: boolean; resume: boolean } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const coinsRef = useRef(0);
  const [touchDevice] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const [gameReady, setGameReady] = useState(false);

  const say = useCallback((big: string, sub?: string, color?: string, ms = 1300) => {
    const id = Math.random();
    setMsg({ id, big, sub, color });
    setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), ms);
  }, []);
  const toastIt = useCallback((text: string, color = "#3EE08F", ms = 1500) => {
    const id = Math.random();
    setToast({ id, text, color });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), ms);
  }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Pumping the tyres");
    void audio.preload(FIRST_SOUNDS);
    const id = setTimeout(() => void audio.preload(PEDAL_SOUNDS), 2500);
    void audio.stopMusic(0.2);
    return () => clearTimeout(id);
  }, []);
  const music = useRef<PedalMusic | null>(null);
  useEffect(() => { const m = new PedalMusic(); music.current = m; m.title(); return () => { m.dispose(); music.current = null; }; }, []);

  const onEvent = useCallback((e: GameEvent) => {
    switch (e.k) {
      case "intro": setDone(null); setIntro({ n: e.plan.n, next: e.next, resume: e.resume }); music.current?.level(e.plan); break;
      case "go": setIntro(null); say("GO!", undefined, "#FFD23F", 900); break;
      case "checkpoint": {
        toastIt(`Checkpoint ${e.section} / ${e.sections}`, "#3EE08F");
        const tip = e.tip;
        if (tip) setTimeout(() => toastIt(tip, "#FFD23F", 2800), 1500);
        break;
      }
      case "sector": say(`SECTOR ${e.sector} CLEAR!`, `${e.sectors - e.sector > 0 ? `${e.sectors - e.sector} to go` : "The finish is near!"}`, "#3EE08F", 1700); break;
      case "crash":
        if (e.saved) toastIt("The bubble saved you!", "#7CF5FF");
        else say(e.why === "fall" ? "Whoops!" : e.why === "gremlin" ? "Gremlin attack!" : "Ouch!", `${e.livesLeft} ${e.livesLeft === 1 ? "life" : "lives"} left · back to the checkpoint`, "#FF5D6C", 1700);
        break;
      case "outOfLives": say("Out of lives!", `Back to the start of sector ${e.sector} — with 3 fresh lives`, "#FF5D6C", 2300); break;
      case "finish": {
        setDone(e.stats);
        const s = usePedal.getState();
        s.setCoins(gameRef.current?.coins ?? s.coins);
        s.finish(e.stats.level, e.stats.falls);
        useProfile.getState().earnCoins(5 + Math.floor(e.stats.level / 20));
        if (e.stats.worldDone) sfx("worldClear", { delay: 0.6 });
        track("obbybike_clear", { level: e.stats.level });
        break;
      }
      case "pickup":
        if (e.what === "oil") toastIt("Chain oiled!", "#FFB627");
        else if (e.what === "heart") toastIt("+1 life!", "#FF5D8F");
        else if (e.what === "gem") toastIt("Gem +15 coins", "#7CF5FF");
        break;
      case "power": toastIt(`${POWERS[e.id].name}!`, POWERS[e.id].color, 1700); break;
      case "target": toastIt("Bridge open!", "#FFD23F"); break;
      case "gremlin": toastIt("Gremlin down! +3", "#B98AFF", 900); break;
      case "lowOil": toastIt("Low oil — grab a can!", "#FF6B5A", 2000); break;
      case "air": if (e.secs > 1.1) toastIt(`BIG AIR ${e.secs.toFixed(1)}s`, "#7CF5FF", 1000); break;
      case "hint": toastIt(e.text, "#FFD23F", 2200); break;
    }
  }, [say, toastIt]);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const s = usePedal.getState();
    coinsRef.current = s.coins;
    let flush: ReturnType<typeof setTimeout> | null = null;
    const g = new Game(host.current, {
      bike: s.bike, levels: s.levels, rider: s.rider, lives: s.lives || 5, coins: s.coins, autoPedal: s.autoPedal,
      onHud: (h) => setHud(h),
      onEvent: (e) => onEventRef.current(e),
      onCoins: (n) => { coinsRef.current = n; if (!flush) flush = setTimeout(() => { flush = null; usePedal.getState().setCoins(coinsRef.current); }, 900); },
      onLives: (n) => usePedal.getState().setLives(n),
      onCheckpoint: (lv, cp) => usePedal.getState().reach(lv, cp),
    });
    gameRef.current = g;
    g.load(s.level, "attract", s.checkpoint);
    g.start();
    loadRef.current(null);
    setGameReady(true);
    return () => { if (flush) { clearTimeout(flush); usePedal.getState().setCoins(coinsRef.current); } g.dispose(); gameRef.current = null; setGameReady(false); };
  }, [ready]);

  const fever = !!hud?.powers.some((p) => p.id === "turbo");
  useEffect(() => { music.current?.fever(fever); }, [fever]);
  useEffect(() => { const g = gameRef.current; if (!g) return; if (paused) { g.stop(); music.current?.pause(); } else { g.start(); music.current?.resume(); } }, [paused]);
  useEffect(() => { setInRound(screen === "play"); setImmersive(screen === "play"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  // ---------------------------------------------------------------- flow
  const play = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    sfx("bell");
    setSheet(""); setScreen("play");
    g.play();
    if (!usePedal.getState().seenHelp) setTimeout(() => toastIt(touchDevice ? "Left thumb steers · JUMP and FIRE on the right" : "W pedal · A/D steer · Space jump · F fire", "#FFD23F", 3600), 4400);
    usePedal.getState().sawHelp();
  }, [toastIt, touchDevice]);
  const home = useCallback(() => {
    const g = gameRef.current;
    setDone(null); setIntro(null); setScreen("home");
    if (g) { const s = usePedal.getState(); g.load(s.level, "attract", s.checkpoint); }
    music.current?.title();
  }, []);
  useEffect(() => {
    setMenu(screen === "play" ? [
      { id: "restart", label: "Restart level", icon: "🔄", onSelect: () => { setDone(null); gameRef.current?.restartLevel(); } },
      { id: "garage", label: "Garage", icon: "🚲", onSelect: () => { home(); setSheet("garage"); } },
      { id: "home", label: "Main menu", icon: "🏠", onSelect: home },
    ] : []);
  }, [screen, setMenu, home]);
  useEffect(() => { if (done) { const id = setTimeout(() => setDone(null), 4800); return () => clearTimeout(id); } }, [done]);

  // ---------------------------------------------------------------- render
  const plan = levelPlan(save.level);
  const wi = Math.min(WORLDS.length - 1, Math.floor((Math.min(save.level, DESIGNED_LEVELS) - 1) / LEVELS_PER_WORLD));
  const acc = hud?.accent ?? WORLDS.find((w) => w.id === plan.world)!.accent;
  const travel = hud?.mode === "travel";
  const introPlan = intro ? levelPlan(intro.n) : null;
  const resumeCp = save.checkpoint >= 0 ? save.checkpoint + 1 : 0;

  return (
    <div className={`ob-root ${pixel.variable}`} style={{ ["--acc" as string]: acc, ["--fade" as string]: "#EAF4FF" }} data-slug={slug}>
      <style>{PEDAL_CSS + PEDAL_EXTRA_CSS}</style>
      <div ref={host} className="ob-stage" />

      {screen === "home" && (
        <div className="ob-ui">
          <div className="ob-home">
            <div className="flex flex-col items-center gap-3">
              <div className="ob-logo" aria-label="Obby Bike Blaster">
                <span className="l1" style={{ ["--c" as string]: "#7CF5FF", ["--d" as string]: "#1D4ED8", fontSize: "clamp(40px,12vw,88px)" }}>OBBY BIKE</span>
                <span className="l2" style={{ ["--c" as string]: "#FFD23F", ["--d" as string]: "#C2410C", animationDelay: ".12s", fontSize: "clamp(44px,13.5vw,100px)" }}>BLASTER</span>
              </div>
              <p className="ob-tag">Ride · Jump · Blast · Never fall</p>
            </div>
            <div className="flex w-full flex-col items-center gap-3">
              <div className="ob-card ob-panel">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold tracking-[.16em] uppercase opacity-70">{plan.remix ? "Endless remix" : `World ${wi + 1} of ${WORLDS.length} · ${WORLDS[wi].name}`}</p>
                    <p className="ob-px truncate text-2xl font-bold">{plan.codename}</p>
                    <p className="flex items-center gap-1.5 truncate text-sm opacity-85"><Flag className="size-4 shrink-0" />{plan.subtitle}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="ob-pill ob-panel"><CoinIcon />{save.coins.toLocaleString()}</span>
                    <Hearts n={save.lives} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs font-bold opacity-80"><span>{resumeCp > 0 ? `Checkpoint ${resumeCp} of ${plan.sections}` : `Level ${plan.local} of ${LEVELS_PER_WORLD}`}</span><span>{save.level} / {DESIGNED_LEVELS}{save.level > DESIGNED_LEVELS ? "+" : ""}</span></div>
                  <div className="ob-bar"><i style={{ width: `${(resumeCp > 0 ? resumeCp / plan.sections : plan.local / LEVELS_PER_WORLD) * 100}%` }} /></div>
                </div>
              </div>
              <button type="button" className="ob-btn ob-cta ob-shine w-[min(430px,100%)] py-4 text-2xl" onClick={play} disabled={!gameReady}>
                <Play className="size-7 fill-current" /> <span className="ob-px font-bold">{save.level === 1 && resumeCp === 0 ? "RIDE" : resumeCp > 0 ? "CONTINUE" : `LEVEL ${save.level}`}</span>
              </button>
              <div className="grid w-[min(430px,100%)] grid-cols-3 gap-2">
                <button type="button" className="ob-btn ob-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("garage"); }}><Wrench className="size-5" /> Garage</button>
                <button type="button" className="ob-btn ob-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("worlds"); }}><MapIcon className="size-5" /> Worlds</button>
                <button type="button" className="ob-btn ob-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("help"); }}><HelpCircle className="size-5" /> Help</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "play" && hud && (
        <div className="ob-hud">
          <div className="ob-top">
            <div className="flex min-w-0 flex-col">
              <div className="ob-chip ob-panel">
                <span className="ob-badge">{hud.level}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-tight font-extrabold">{hud.codename}</span>
                  <span className="flex items-center gap-1 text-[11.5px] font-bold opacity-90"><Flag className="size-3.5 shrink-0" />CP {hud.section}/{hud.sections} · {fmt(hud.time)}</span>
                  <span className="block truncate text-[11px] font-bold opacity-70">{hud.part}</span>
                </span>
              </div>
              <div className="ob-meters">
                <div className={`ob-meter ob-panel ${hud.lowOil ? "ob-low" : ""}`}>
                  <Droplet className="size-[16px]" fill="#FFB627" stroke="none" />
                  <span className="ob-mbar"><i style={{ width: `${Math.max(2, hud.oil * 100)}%`, background: hud.oil > 0.2 ? "#FFB627" : "#FF6B5A" }} /></span>
                </div>
                <div className="ob-meter ob-panel"><span className="ob-speed">{hud.speed}</span><span className="text-[10px] font-extrabold opacity-70">KM/H</span></div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="ob-pill ob-panel"><CoinIcon />{hud.coins.toLocaleString()}</span>
              <Hearts n={hud.lives} />
            </div>
          </div>
          <div className="ob-courseWrap">
            <div className="ob-course">
              <b style={{ width: `${hud.progress * 100}%` }} />
              {Array.from({ length: Math.max(0, hud.sectors - 1) }, (_, i) => { const at = ((i + 1) * 6) / hud.sections; return <s key={i} className={hud.section >= (i + 1) * 6 ? "on" : ""} style={{ left: `${Math.min(100, at * 100)}%` }} />; })}
              <em style={{ left: `${hud.progress * 100}%`, background: "var(--acc)" }} />
            </div>
          </div>
          {hud.powers.length > 0 && (
            <div className="ob-powers">
              {hud.powers.map((p) => (
                <div key={p.id} className="ob-power" title={POWERS[p.id].name}>
                  <svg className="ring" viewBox="0 0 48 48"><rect x="3" y="3" width="42" height="42" rx="12" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" /><rect x="3" y="3" width="42" height="42" rx="12" fill="none" stroke={POWERS[p.id].color} strokeWidth="4" pathLength={100} strokeDasharray={`${(p.left / p.secs) * 100} 100`} /></svg>
                  {POWER_ICON[p.id]}
                </div>
              ))}
            </div>
          )}
          {hud.mode === "play" && touchDevice && <TouchControls game={gameRef} />}
          {hud.mode === "play" && !touchDevice && <div className="ob-keys ob-panel">W pedal · S brake · A/D steer · Space jump · F fire</div>}
          {hud.mode === "intro" && <div className="absolute inset-0 pointer-events-auto" onPointerDown={() => gameRef.current?.skipIntro()} />}
        </div>
      )}

      <motion.div className="ob-fade" initial={false} animate={{ opacity: travel ? 1 : 0 }} transition={{ duration: travel ? 0.9 : 0.6 }} />

      <AnimatePresence>
        {screen === "play" && intro && introPlan && hud?.mode === "intro" && (
          <motion.div key={`intro-${intro.n}`} className="ob-intro" initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 1.08 }} transition={{ duration: 0.4 }}>
            <span className="ob-kicker">{intro.next ? `Level ${intro.n} started!` : intro.resume ? `Level ${intro.n} · back on track` : introPlan.remix ? `Remix · Level ${intro.n}` : `Level ${intro.n}`}</span>
            <p className="ob-big mt-3" style={{ fontSize: "clamp(34px,10vw,72px)" }}>{introPlan.codename}</p>
            <div className="ob-goal ob-panel"><Flag className="size-4" />{introPlan.subtitle}</div>
            {introPlan.mods.length > 0 && <div className="ob-mods">{introPlan.mods.map((m) => <span key={m}>{MOD_LABEL[m]}</span>)}</div>}
            {introPlan.finale && <p className="ob-sub" style={{ color: "#FFD23F" }}>World finale!</p>}
          </motion.div>
        )}
      </AnimatePresence>
      {screen === "play" && hud?.mode === "intro" && <p className="ob-skip">Tap to skip</p>}

      <div className="ob-wrap ob-clearwrap"><AnimatePresence>{done && screen === "play" && <FinishBanner key={done.level} r={done} />}</AnimatePresence></div>
      <div className="ob-wrap ob-popwrap"><AnimatePresence>
        {msg && (
          <motion.div key={msg.id} className="ob-pop" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.25 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
            <p className="ob-big" style={{ color: msg.color }}>{msg.big}</p>
            {msg.sub && <p className="ob-sub">{msg.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence></div>
      <div className="ob-wrap ob-toastwrap"><AnimatePresence>
        {toast && <motion.div key={toast.id} className="ob-toast ob-panel" style={{ color: toast.color }} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>{toast.text}</motion.div>}
      </AnimatePresence></div>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div key="veil" className="ob-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet("")} />
            <motion.div key={sheet} className="ob-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}>
              <div className="ob-grab" />
              <div className="mb-3 flex items-center justify-between">
                <p className="ob-px text-2xl font-bold">{sheet === "garage" ? "Garage" : sheet === "worlds" ? "Worlds" : "How to play"}</p>
                <button type="button" aria-label="Close" className="ob-btn ob-ghost size-10 !rounded-xl p-0" onClick={() => setSheet("")}><X className="size-5" /></button>
              </div>
              <div className="ob-scroll">
                {sheet === "garage" && <Garage onChange={() => { const s = usePedal.getState(); gameRef.current?.setBike(s.bike, s.levels, s.rider); }} />}
                {sheet === "worlds" && <Worlds level={save.level} />}
                {sheet === "help" && <Help onPlay={play} game={gameRef} />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ touch controls: a floating stick (steer, and pull back to brake), JUMP and FIRE
function TouchControls({ game }: { game: React.RefObject<Game | null> }) {
  const [stick, setStick] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const [fire, setFire] = useState(false);
  const [jump, setJump] = useState(false);
  const origin = useRef<{ id: number; x: number; y: number } | null>(null);
  const R = 52;
  const down = (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    origin.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setStick({ x: e.clientX, y: e.clientY, kx: 0, ky: 0 });
  };
  const move = (e: React.PointerEvent) => {
    const o = origin.current;
    if (!o || o.id !== e.pointerId) return;
    let dx = e.clientX - o.x, dy = e.clientY - o.y;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
    game.current?.setStick(dx / R, -dy / R);
    setStick({ x: o.x, y: o.y, kx: dx, ky: dy });
  };
  const up = (e: React.PointerEvent) => { if (origin.current?.id !== e.pointerId) return; origin.current = null; setStick(null); game.current?.setStick(0, 0); };
  useEffect(() => () => { game.current?.setStick(0, 0); game.current?.setFire(false); }, [game]);
  return (
    <>
      <div className="ob-left" style={{ width: "52%", top: "18%" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {stick ? (
        <div className="ob-stick" style={{ left: stick.x, top: stick.y }}><div className="ob-knob" style={{ transform: `translate(${stick.kx}px,${stick.ky}px)` }} /></div>
      ) : <div className="ob-stickhint">STEER</div>}
      <div className="ob-btns">
        <div className={`ob-jump ${fire ? "on" : ""}`} style={{ left: 6, bottom: 24, width: 74, height: 74 }} onPointerDown={(e) => { e.preventDefault(); setFire(true); game.current?.setFire(true); }} onPointerUp={() => { setFire(false); game.current?.setFire(false); }} onPointerCancel={() => { setFire(false); game.current?.setFire(false); }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="7" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></svg>
          <small>FIRE</small>
        </div>
        <div className={`ob-fire ${jump ? "on" : ""}`} style={{ background: "linear-gradient(180deg,rgba(124,245,255,.65),rgba(46,155,255,.55))" }} onPointerDown={(e) => { e.preventDefault(); setJump(true); game.current?.jump(); }} onPointerUp={() => setJump(false)} onPointerCancel={() => setJump(false)}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V6M6 11l6-6 6 6" /></svg>
          <small>JUMP</small>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ the finish banner (no buttons: the game moves on by itself)
function FinishBanner({ r }: { r: LevelStats }) {
  const next = levelPlan(r.level + 1);
  return (
    <motion.div className="ob-clear" initial={{ opacity: 0, scale: 0.7, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <p className="text-xs font-extrabold tracking-[.2em] uppercase opacity-85">{r.worldDone ? "World complete" : `Level ${r.level}`}</p>
      <p className="ob-big" style={{ color: r.worldDone ? "#FFD23F" : "#fff", fontSize: "clamp(36px,10.5vw,70px)" }}>{r.worldDone ? "WORLD CLEAR!" : "FINISH!"}</p>
      <div className="ob-stars">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.35 + i * 0.18, type: "spring", stiffness: 400, damping: 14 }}>
            <Star className="size-9" fill={i < r.stars ? "#FFD23F" : "rgba(255,255,255,.2)"} stroke={i < r.stars ? "#C2410C" : "rgba(255,255,255,.35)"} strokeWidth={2} />
          </motion.span>
        ))}
      </div>
      <div className="ob-loot">
        <span className="ob-panel"><CoinIcon />+{r.coins}</span>
        <span className="ob-panel"><Timer className="size-4" />{fmt(r.time)}</span>
        <span className="ob-panel">💥 {r.falls}</span>
      </div>
      <p className="ob-sub mt-3">Next up: {next.remix ? "Remix" : `Level ${next.n}`} · {next.codename}</p>
    </motion.div>
  );
}

// ------------------------------------------------------------------ garage: bikes, upgrades and riders
function BikeCanvas({ frame, look }: { frame: string; look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    cv.width = 32; cv.height = 18;
    const c = cv.getContext("2d")!;
    const px = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    c.clearRect(0, 0, 32, 18);
    // a side view in pixels: two wheels, the frame, the saddle and the handlebar blaster
    const wheel = (cx: number) => { for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const d = Math.hypot(x - 4, y - 4); if (d < 4.6 && d > 3.3) px(cx - 4 + x, 9 + y - 0, 1, 1, "#1E1E26"); else if (d < 1.2) px(cx - 4 + x, 9 + y, 1, 1, "#C8CED8"); } };
    wheel(7); wheel(24);
    px(8, 9, 12, 1, frame); px(9, 10, 1, 4, frame); px(10, 10, 1, 1, frame); px(11, 11, 1, 1, frame); px(12, 12, 6, 1, frame); px(18, 11, 1, 1, frame); px(19, 10, 1, 1, frame); px(20, 8, 1, 6, frame); px(7, 13, 6, 1, frame);
    px(7, 7, 4, 1, "#22222A"); px(9, 8, 1, 1, "#9AA3B5"); px(19, 6, 4, 1, "#2A2A33"); px(21, 5, 4, 1, "#3A3F4E"); px(25, 5, 1, 1, look.glow);
  }, [frame, look]);
  return <canvas ref={ref} />;
}
function RiderCanvas({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    cv.width = 16; cv.height = 20;
    const c = cv.getContext("2d")!;
    const px = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    c.clearRect(0, 0, 16, 20);
    px(3, 0, 10, 3, look.a); px(3, 3, 10, 5, look.skin); px(4, 3, 8, 2, look.dark); px(5, 3, 2, 2, look.glow); px(9, 3, 2, 2, look.glow); px(6, 6, 4, 1, shade(look.skin, -0.4));
    px(4, 8, 8, 6, look.b); px(7, 9, 2, 3, look.a); px(4, 13, 8, 1, look.dark);
    px(1, 8, 3, 5, look.b); px(12, 8, 3, 5, look.b); px(1, 12, 3, 1, look.dark); px(12, 12, 3, 1, look.dark);
    px(4, 14, 3, 5, look.c); px(9, 14, 3, 5, look.c); px(4, 18, 3, 1, "#F5F7FF"); px(9, 18, 3, 1, "#F5F7FF");
  }, [look]);
  return <canvas ref={ref} />;
}
function Garage({ onChange }: { onChange: () => void }) {
  const s = usePedal();
  const [tab, setTab] = useState<"bikes" | "gear" | "riders">("bikes");
  const [view, setView] = useState<BikeId>(s.bike);
  const look = (RIDERS.find((r) => r.id === s.rider) ?? RIDERS[0]).look;
  const v = BIKES.find((b) => b.id === view)!;
  return (
    <div>
      <div className="ob-tabs">
        {(["bikes", "gear", "riders"] as const).map((t) => <button type="button" key={t} className={tab === t ? "on" : ""} onClick={() => { sfx("tap"); setTab(t); }}>{t === "bikes" ? "Bikes" : t === "gear" ? "Upgrades" : "Riders"}</button>)}
      </div>
      {tab === "bikes" && (
        <>
          <div className="ob-bikes">
            {BIKES.map((b) => (
              <button type="button" key={b.id} className={`ob-bike ${view === b.id ? "sel" : ""}`} onClick={() => { sfx("tap"); setView(b.id); }}>
                <BikeCanvas frame={b.frame} look={look} />
                <p className="ob-px mt-1 text-lg font-bold">{b.name}</p>
                <p className="text-xs font-bold opacity-75">{s.bikes.includes(b.id) ? (s.bike === b.id ? "✔ Riding" : "Owned") : <span className="inline-flex items-center gap-1"><CoinIcon size={14} />{b.price.toLocaleString()}</span>}</p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm opacity-85">{v.line}</p>
          {s.bikes.includes(view) ? (
            s.bike !== view && <button type="button" className="ob-btn ob-cta mt-3 w-full py-3" onClick={() => { s.ride(view); sfx("buy"); onChange(); }}>Ride the {v.name}</button>
          ) : (
            <button type="button" disabled={s.coins < v.price} className="ob-btn ob-cta mt-3 w-full py-3 disabled:opacity-50" onClick={() => { if (s.buyBike(view)) { sfx("buy"); onChange(); } }}>
              {s.coins < v.price ? <><Lock className="size-4" /> Need <CoinIcon size={16} />{(v.price - s.coins).toLocaleString()} more</> : <>Buy for <CoinIcon size={16} />{v.price.toLocaleString()}</>}
            </button>
          )}
        </>
      )}
      {tab === "gear" && UPGRADES.map((u) => {
        const level = s.levels[u.id], cost = upgradeCost(level), max = level >= MAX_LEVEL;
        return (
          <div key={u.id} className="ob-up">
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{u.label}</p>
              <p className="text-xs opacity-70">{u.hint}</p>
              <div className="ob-dots">{Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < level ? "on" : ""} />)}</div>
            </div>
            <button type="button" disabled={max || s.coins < cost} className={`ob-btn ${max ? "ob-ghost" : "ob-cta"} px-3 py-2 text-sm disabled:opacity-50`} onClick={() => { if (s.upgrade(u.id)) { sfx("upgrade"); onChange(); } }}>
              {max ? <><Check className="size-4" /> Max</> : <><CoinIcon size={16} />{cost.toLocaleString()}</>}
            </button>
          </div>
        );
      })}
      {tab === "riders" && (
        <div className="ob-skins">
          {RIDERS.map((k) => {
            const owned = s.riders.includes(k.id), on = s.rider === k.id;
            return (
              <button type="button" key={k.id} className={`ob-skin ${on ? "sel" : ""}`} onClick={() => { if (owned) { s.wear(k.id); sfx("tap"); onChange(); } else if (s.buyRider(k.id)) { sfx("buy"); onChange(); } }}>
                <RiderCanvas look={k.look} />
                <p className="ob-px mt-1 text-lg font-bold">{k.name}</p>
                <p className="text-xs font-bold opacity-80">{on ? "✔ Riding" : owned ? "Owned" : <span className="inline-flex items-center gap-1">{s.coins < k.price && <Lock className="size-3" />}<CoinIcon size={14} />{k.price.toLocaleString()}</span>}</p>
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-3 flex items-center justify-center gap-1 text-sm font-bold opacity-80">You have <CoinIcon size={16} />{s.coins.toLocaleString()}</p>
    </div>
  );
}

// ------------------------------------------------------------------ world map
function WorldThumb({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const W = 80, H = 55; cv.width = W; cv.height = H;
    const c = cv.getContext("2d")!, w = WORLDS[index], s = w.sky;
    for (let y = 0; y < H; y++) { c.fillStyle = mix(s.top, s.bot, Math.floor((y / H) * 8) / 7); c.fillRect(0, y, W, 1); }
    c.fillStyle = s.sun; c.fillRect(60, 7, 6, 6);
    for (let x = 0; x < W; x += 4) { const h = 4 + Math.abs(Math.sin(x * 0.21 + index) * 10); c.fillStyle = mix(w.skyCol[0], s.fog, 0.3); c.fillRect(x, H - 18 - h, 4, h); }
    c.fillStyle = w.below === "void" ? shade(s.bot, -0.3) : w.belowColor; c.fillRect(0, H - 10, W, 10);
    // a checker path with a gap and a rider
    for (let x = 0; x < W; x += 4) { if (x > 30 && x < 40) continue; c.fillStyle = (x / 4) % 2 ? w.pal.platA : w.pal.platB; c.fillRect(x, H - 16, 4, 3); }
    c.fillStyle = w.pal.kill; c.fillRect(52, H - 18, 4, 2);
    c.fillStyle = "#1E1E26"; c.fillRect(14, H - 19, 3, 3); c.fillRect(21, H - 19, 3, 3); c.fillStyle = "#FFD23F"; c.fillRect(17, H - 24, 3, 4);
  }, [index]);
  return <canvas ref={ref} />;
}
function Worlds({ level }: { level: number }) {
  const cur = Math.floor((Math.min(level, DESIGNED_LEVELS) - 1) / LEVELS_PER_WORLD);
  return (
    <div>
      <div className="ob-worlds">
        {WORLDS.map((w, i) => {
          const doneN = Math.max(0, Math.min(LEVELS_PER_WORLD, level - 1 - i * LEVELS_PER_WORLD));
          const lock = i > cur && level <= DESIGNED_LEVELS;
          return (
            <div key={w.id} className={`ob-world ${lock ? "lock" : ""} ${i === cur && level <= DESIGNED_LEVELS ? "now" : ""}`}>
              <WorldThumb index={i} />
              <div className="ob-wl">
                <p className="truncate">{lock ? <Lock className="mr-1 inline size-3.5" /> : null}{w.name}</p>
                <p className="text-[11px] font-bold opacity-80">{doneN}/{LEVELS_PER_WORLD} levels{w.gravity < 20 ? " · low gravity" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm font-bold opacity-80">{level > DESIGNED_LEVELS ? `All ${DESIGNED_LEVELS} levels done! You're on remix ${level - DESIGNED_LEVELS} — they never end.` : `Clear all ${DESIGNED_LEVELS} levels to unlock endless remixes.`}</p>
    </div>
  );
}

function Help({ onPlay, game }: { onPlay: () => void; game: React.RefObject<Game | null> }) {
  const s = usePedal();
  return (
    <div className="grid gap-2 text-[15px]">
      {[
        [<Play key="i" className="size-5" fill="#3EE08F" stroke="none" />, "Phone: drag the left side to steer (pull back to brake); the bike pedals by itself. Tap JUMP to hop and hold FIRE to shoot. Computer: W to pedal, S to brake, A/D to steer, Space to jump, F to fire."],
        [<Flag key="i" className="size-5" stroke="#FFD23F" />, "Each level is a long obstacle course of checkpoint pads in sectors of six. Fall off and you lose a life and go back to the last checkpoint; run out and you restart the sector."],
        [<Crosshair key="i" className="size-5" stroke="#FF6A2B" />, "Your handlebar blaster aims itself at what's ahead: shoot targets to open bridges, crates to break walls, and gremlins before they knock you off."],
        [<Zap key="i" className="size-5" stroke="#FF4E6A" />, "Mind the red kill blocks, laser gates, spinners and hammers. Jelly pads launch you, boost strips fire you forward, ice slides, belts push and some tiles fall."],
        [<Droplet key="i" className="size-5" fill="#FFB627" stroke="none" />, "Pedalling uses chain oil — when it runs dry the bike slows down. Grab the red oil cans."],
        [<CoinIcon key="i" size={20} />, "Collect coins and gems for new bikes, upgrades and riders in the Garage. Hearts give lives; ? boxes hold Turbo, a Bubble shield, a Coin magnet, Wings (double jump), Slow-mo traps and a Rapid blaster."],
        [<Star key="i" className="size-5" fill="#FFD23F" stroke="none" />, "Cross the finish and the next level starts by itself — 1,200 levels in 20 worlds, then endless remixes. Leave any time: you come back at your last checkpoint."],
      ].map(([i, t], k) => (
        <div key={k} className="flex items-start gap-3 rounded-2xl bg-white/[.06] p-3"><span className="mt-0.5 shrink-0">{i}</span><span>{t}</span></div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-3 rounded-2xl bg-white/[.06] p-3">
        <span><b>Auto-pedal</b><br /><span className="text-xs opacity-75">On phones, the bike pedals by itself; pull the stick back to brake</span></span>
        <button type="button" aria-label="Auto-pedal" className={`ob-toggle ${s.autoPedal ? "on" : ""}`} onClick={() => { s.setAutoPedal(!s.autoPedal); game.current?.setAutoPedal(!s.autoPedal); sfx("tap"); }}><i /></button>
      </div>
      <button type="button" className="ob-btn ob-cta mt-2 py-3 text-lg" onClick={onPlay}><Play className="size-5 fill-current" /> Let&apos;s ride</button>
    </div>
  );
}
