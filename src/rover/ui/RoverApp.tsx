"use client";
// Peak Rover: the screens around the game canvas — the home screen over a live view of your current world, the HUD
// (stage, progress with checkpoints, fuel, coins, lives, power timers), the thumb pedals, the cinematic stage cards,
// the stage-complete card that moves on to the next stage by itself, the garage and the world map.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Map as MapIcon, Play, Wrench, HelpCircle, X, Lock, Check, ChevronRight, Heart, Fuel, Zap, Shield, Magnet, Feather, Coins, Flag } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { useProfile } from "@/lib/store";
import { Game, type GameEvent, type Hud, type StageStats } from "../game";
import { stagePlan } from "../stages";
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, worldOf } from "../worlds";
import { MAX_LEVEL, UPGRADES, VEHICLES, tuned, upgradeCost, vehicleOf, type VehicleId } from "../vehicles";
import { levelsOf, useRover, useRoverHydrated } from "../save";
import { ROVER_SOUNDS, sfx } from "../sound";
import { RoverMusic } from "../music";
import { Rover } from "../physics";
import { Terrain } from "../terrain";
import { drawRoverPreview } from "../art/rover-art";
import { lookFor } from "../art/grade";
import { paintStrip } from "../art/backdrop";
import { powerColor } from "../art/ground";
import { ROVER_CSS } from "./styles";

type Sheet = "" | "garage" | "worlds" | "help";
interface Msg { id: number; big: string; sub?: string; color?: string }
/** drawn icons (emoji differ from phone to phone, and older ones lack the newer symbols) */
function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#E8A317" /><circle cx="12" cy="12" r="8.2" fill="#FFD23F" /><circle cx="12" cy="12" r="5.2" fill="none" stroke="#E8A317" strokeWidth="1.6" />
      <ellipse cx="8.6" cy="8.2" rx="2.4" ry="1.3" fill="#FFF6C8" transform="rotate(-35 8.6 8.2)" />
    </svg>
  );
}
const Hearts = ({ n, of }: { n: number; of: number }) => (
  <span className="rv-hearts">{Array.from({ length: of }, (_, i) => <Heart key={i} className={`size-[17px] ${i < n ? "" : "opacity-30"}`} fill={i < n ? "#FF4F7A" : "rgba(255,255,255,.4)"} stroke={i < n ? "#B0183F" : "none"} strokeWidth={1.5} />)}</span>
);
const POWER_ICON: Record<string, React.ReactNode> = {
  turbo: <Zap className="size-5" fill="#FFD23F" stroke="#FF6B3D" />, shield: <Shield className="size-5" fill="#7FC4FF" stroke="#2E9BFF" />,
  magnet: <Magnet className="size-5" stroke="#FF4F7A" strokeWidth={2.6} />, feather: <Feather className="size-5" stroke="#3EE08F" strokeWidth={2.4} />, double: <Coins className="size-5" stroke="#FFD23F" strokeWidth={2.4} />,
};
const POWER_NAME: Record<string, string> = { turbo: "Turbo!", shield: "Shield!", magnet: "Magnet!", feather: "Feather jumps!", double: "Coins ×2!" };

export default function RoverApp({ slug }: { slug: string; title: string }) {
  const ready = useRoverHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const save = useRover();
  const [screen, setScreen] = useState<"home" | "play">("home");
  const [sheet, setSheet] = useState<Sheet>("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; color: string } | null>(null);
  const [result, setResult] = useState<StageStats | null>(null);
  const [pedal, setPedal] = useState({ gas: false, brake: false });
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const coinsRef = useRef(0);
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  const [touchDevice] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const [gameReady, setGameReady] = useState(false);

  const say = useCallback((big: string, sub?: string, color?: string, ms = 1300) => {
    const id = Math.random();
    setMsg({ id, big, sub, color });
    setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), ms);
  }, []);
  const toastIt = useCallback((text: string, color = "#3EE08F") => {
    const id = Math.random();
    setToast({ id, text, color });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1500);
  }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Fuelling up the rover");
    void audio.preload(ROVER_SOUNDS.slice(0, 12));
    // the site's own music player stays quiet: Peak Rover's music is composed live (src/rover/music.ts)
    void audio.stopMusic(0.2);
  }, []);
  const music = useRef<RoverMusic | null>(null);
  useEffect(() => {
    const m = new RoverMusic();
    music.current = m;
    m.title();
    return () => { m.dispose(); music.current = null; };
  }, []);

  const onEvent = useCallback((e: GameEvent) => {
    const g = gameRef.current;
    switch (e.k) {
      case "go": say("GO!", undefined, "#3EE08F", 900); break;
      case "checkpoint": toastIt("Checkpoint reached"); break;
      case "flip": say(e.n > 1 ? `${e.n}× Flip!` : "Flip!", `+${e.coins} coins`, "#FFD23F", 1100); break;
      case "air": toastIt(`Big air! +${e.coins}`, "#7CF5FF"); break;
      case "lowFuel": toastIt("Low fuel — find a can!", "#FF6B5A"); break;
      case "pickup":
        if (e.what === "fuel") toastIt("Tank full!", "#FF6B5A");
        else if (e.what === "heart") toastIt("+1 life!", "#FF5D8F");
        else toastIt(POWER_NAME[e.what], powerColor(e.what));
        break;
      case "crash": {
        const why = e.why === "fuel" ? "Out of fuel!" : e.why === "fall" ? "Into the gap!" : "Ouch!";
        say(why, e.livesLeft > 0 ? `${e.livesLeft} ${e.livesLeft === 1 ? "life" : "lives"} left · back to the checkpoint` : "No lives left · the stage starts again", "#FF5D6C", 2000);
        break;
      }
      case "restart": break;
      case "respawn": if (e.rescue) say("Rescue shield!", "It saves your head once — drive carefully", "#7CF5FF", 1600); break;
      case "stuck": say("Stuck?", "Back to the checkpoint", "#FFD23F", 1400); break;
      case "finish": {
        setResult(e.stats);
        const s = useRover.getState();
        s.setCoins(g?.coins ?? s.coins);
        s.clear(e.stats.stage, e.stats.flips);
        useProfile.getState().earnCoins(4 + Math.floor(e.stats.stage / 25));
        if (e.stats.stage % STAGES_PER_WORLD === 0) sfx("worldClear", { delay: 0.6 });
        track("rover_clear", { stage: e.stats.stage });
        break;
      }
    }
  }, [say, toastIt]);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const s = useRover.getState();
    coinsRef.current = s.coins;
    let flush: ReturnType<typeof setTimeout> | null = null;
    const g = new Game(host.current, {
      vehicle: s.vehicle, levels: levelsOf(s, s.vehicle), lives: s.lives || 3, coins: s.coins,
      onHud: (h) => setHud(h),
      onEvent: (e) => onEventRef.current(e),
      onCoins: (n) => { coinsRef.current = n; if (!flush) flush = setTimeout(() => { flush = null; useRover.getState().setCoins(coinsRef.current); }, 900); },
      onLives: (n) => useRover.getState().setLives(n),
      onCheckpoint: (st, cp) => useRover.getState().reach(st, cp),
    });
    gameRef.current = g;
    g.load(s.stage, s.checkpoint, "attract");
    g.start();
    // through the ref: the player hands out a new setLoading when its state changes (e.g. on Play), and that must not
    // build the game again
    loadRef.current(null);
    setGameReady(true);
    return () => { if (flush) { clearTimeout(flush); useRover.getState().setCoins(coinsRef.current); } g.dispose(); gameRef.current = null; setGameReady(false); };
  }, [ready]);

  // turbo adds a sparkle layer to the music
  const turboOn = !!hud?.powers.some((p) => p.id === "turbo");
  useEffect(() => { music.current?.fever(turboOn); }, [turboOn]);

  // pause from the player
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    if (paused) { g.stop(); music.current?.pause(); } else { g.start(); music.current?.resume(); }
  }, [paused]);

  useEffect(() => { setInRound(screen === "play"); setImmersive(screen === "play"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  // ---------------------------------------------------------------- flow
  const play = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    sfx("tap");
    setSheet("");
    setScreen("play");
    music.current?.stage(g.track.plan);
    g.play();
    if (!useRover.getState().seenHelp) toastIt("Right = gas · Left = brake", "#FFD23F");
    useRover.getState().sawHelp();
  }, [toastIt]);

  const next = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setResult(null);
    const s = useRover.getState();
    g.load(s.stage, 0, "intro");
    music.current?.stage(g.track.plan);
  }, []);

  const home = useCallback(() => {
    const g = gameRef.current;
    setResult(null);
    setScreen("home");
    if (g) { const s = useRover.getState(); g.load(s.stage, s.checkpoint, "attract"); }
    music.current?.title();
  }, []);

  useEffect(() => {
    setMenu(screen === "play" ? [
      { id: "restart", label: "Restart stage", icon: "🔄", onSelect: () => { const g = gameRef.current; if (g) { setResult(null); g.load(g.stage, 0, "intro"); } } },
      { id: "garage", label: "Garage", icon: "🔧", onSelect: () => { home(); setSheet("garage"); } },
      { id: "home", label: "Main menu", icon: "🏠", onSelect: home },
    ] : []);
  }, [screen, setMenu, home]);

  // ---------------------------------------------------------------- pedals
  const pointers = useRef(new Map<number, "gas" | "brake">());
  const applyPedals = useCallback(() => {
    let gas = false, brake = false;
    for (const v of pointers.current.values()) { if (v === "gas") gas = true; else brake = true; }
    gameRef.current?.setTouch(gas ? 1 : 0, brake ? 1 : 0);
    setPedal((p) => (p.gas === gas && p.brake === brake ? p : { gas, brake }));
  }, []);
  /** a press on a pedal or a screen half (data-side = gas | brake) */
  const down = useCallback((e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    const side = e.currentTarget.dataset.side === "gas" ? "gas" : "brake";
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, side);
    applyPedals();
  }, [applyPedals]);
  const up = useCallback((e: React.PointerEvent) => { pointers.current.delete(e.pointerId); applyPedals(); }, [applyPedals]);

  // ---------------------------------------------------------------- render
  const plan = stagePlan(save.stage);
  const acc = hud?.accent ?? worldOf(plan.world).accent;
  const local = plan.local;
  const intro = hud?.mode === "intro" && screen === "play";

  return (
    <div className="rv-root" style={{ ["--acc" as string]: acc }} data-slug={slug}>
      <style>{ROVER_CSS}</style>
      <div ref={host} className="rv-stage" />

      {screen === "home" && (
        <div className="rv-ui">
          <div className="rv-home">
            <div className="flex flex-col items-center gap-3">
              <div className="rv-logo" aria-label="Peak Rover">
                <span className="rv-l1" style={{ ["--c" as string]: "#FFD23F" }}>PEAK</span>
                <span className="rv-l2" style={{ ["--c" as string]: "#FF7A3D", animationDelay: ".12s" }}>ROVER</span>
              </div>
              <p className="rv-tag">Climb · Fly · Never stop</p>
            </div>
            <div className="flex w-full flex-col items-center gap-3">
              <div className="rv-card rv-glass">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold tracking-[.16em] uppercase opacity-70">{plan.remix ? "Endless remix" : `World ${Math.floor((save.stage - 1) / STAGES_PER_WORLD) + 1} of 12`}</p>
                    <p className="rv-display truncate text-2xl">{plan.title}</p>
                    <p className="truncate text-sm opacity-80">{plan.subtitle}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rv-pill rv-glass"><CoinIcon />{save.coins.toLocaleString()}</span>
                    <Hearts n={save.lives} of={5} />
                  </div>
                </div>
                {!plan.remix && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs font-bold opacity-80"><span>Stage {local} of {STAGES_PER_WORLD}</span><span>{save.stage} / {DESIGNED_STAGES}{save.stage > DESIGNED_STAGES ? "+" : ""}</span></div>
                    <div className="rv-progress"><i style={{ width: `${(local / STAGES_PER_WORLD) * 100}%` }} /></div>
                  </div>
                )}
              </div>
              <button type="button" className="rv-btn rv-cta rv-shine w-[min(420px,100%)] py-4 text-2xl" onClick={play} disabled={!gameReady}>
                <Play className="size-7 fill-current" /> <span className="rv-display">{save.stage === 1 && save.checkpoint === 0 ? "Play" : `Stage ${save.stage}`}</span>
                {save.checkpoint > 0 && <span className="text-sm font-extrabold opacity-80">· checkpoint {save.checkpoint}</span>}
              </button>
              <div className="grid w-[min(420px,100%)] grid-cols-3 gap-2">
                <button type="button" className="rv-btn rv-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("garage"); }}><Wrench className="size-5" /> Garage</button>
                <button type="button" className="rv-btn rv-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("worlds"); }}><MapIcon className="size-5" /> Worlds</button>
                <button type="button" className="rv-btn rv-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("help"); }}><HelpCircle className="size-5" /> Help</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "play" && hud && (
        <div className="rv-hud">
          <div className="rv-top">
            <div className="flex min-w-0 flex-col">
              <div className="rv-stagechip rv-glass">
                <span className="rv-badge">{hud.stage}</span>
                <span className="min-w-0 truncate text-sm leading-tight font-extrabold"><span className="block truncate">{hud.title}</span><span className="block text-[11px] font-bold opacity-70">{hud.distance} m · {hud.speed} km/h</span></span>
              </div>
              <div className={`rv-fuel rv-glass ${hud.lowFuel ? "rv-low" : ""}`}>
                <Fuel className="size-[18px]" stroke={hud.lowFuel ? "#FF6B5A" : "#fff"} strokeWidth={2.4} />
                <span className="rv-fuelbar"><i style={{ width: `${Math.max(2, hud.fuel * 100)}%`, background: hud.fuel > 0.5 ? "linear-gradient(90deg,#3EE08F,#9CFF6B)" : hud.fuel > 0.22 ? "linear-gradient(90deg,#FFB627,#FFE27A)" : "linear-gradient(90deg,#FF3B3B,#FF7A5A)" }} /></span>
              </div>
            </div>
            <div className="mt-1 min-w-0 flex-1">
              <div className="rv-track">
                <b style={{ width: `${hud.progress * 100}%` }} />
                {hud.checkpoints.map((c, i) => <s key={i} className={hud.progress >= c ? "on" : ""} style={{ left: `${c * 100}%` }} />)}
                <em style={{ left: `${hud.progress * 100}%`, background: "var(--acc)" }}><i className="block size-2.5 rounded-full bg-white" /></em>
                <Flag className="rv-flag size-4" fill="#fff" stroke="#1b1430" strokeWidth={2} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rv-pill rv-glass"><CoinIcon />{hud.coins.toLocaleString()}</span>
              <Hearts n={hud.lives} of={Math.max(3, hud.lives)} />
            </div>
          </div>
          {hud.powers.length > 0 && (
            <div className="rv-powers">
              {hud.powers.map((p) => (
                <div key={p.id} className="rv-power" title={p.id}>
                  <svg className="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" /><circle cx="22" cy="22" r="19" fill="none" stroke={powerColor(p.id)} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(p.left / p.secs) * 119.4} 200`} /></svg>
                  {POWER_ICON[p.id]}
                </div>
              ))}
            </div>
          )}
          {/* thumbs: the whole left half brakes, the right half drives */}
          {!result && (
            <>
              <div className="rv-zone" data-side="brake" style={{ left: 0 }} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
              <div className="rv-zone" data-side="gas" style={{ right: 0 }} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
              <div className="rv-pedals">
                <div className={`rv-pedal brake ${pedal.brake ? "on" : ""}`} data-side="brake" onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="3" /><path d="M8 9h8M8 13h8" /></svg>
                  <small>BRAKE</small>
                </div>
                <div className={`rv-pedal gas ${pedal.gas ? "on" : ""}`} data-side="gas" onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="3" /><path d="M10 7h4M10 11h4M10 15h4" /></svg>
                  <small>GAS</small>
                </div>
              </div>
              {!touchDevice && <div className="rv-keys rv-glass">← A brake · D → gas · in the air they tilt</div>}
            </>
          )}
          <AnimatePresence>
            {intro && (
              <motion.div key={`intro-${hud.stage}`} className="rv-intro" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 1.08 }} transition={{ duration: 0.35 }}>
                <span className="rv-kicker">{hud.remix ? "Remix" : `Stage ${hud.stage}`}</span>
                <p className="rv-big mt-2">{hud.title}</p>
                <p className="rv-sub">{hud.subtitle}{hud.summit ? " · Summit stage" : ""}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {msg && (
          <motion.div key={msg.id} className="rv-pop" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.25 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
            <p className="rv-big" style={{ color: msg.color }}>{msg.big}</p>
            {msg.sub && <p className="rv-sub">{msg.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="rv-toast rv-glass" style={{ color: toast.color }} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>{toast.text}</motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{result && <ResultCard key={result.stage} r={result} onNext={next} onHome={home} />}</AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div key="veil" className="rv-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet("")} />
            <motion.div key={sheet} className="rv-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}>
              <div className="rv-grab" />
              <div className="mb-3 flex items-center justify-between">
                <p className="rv-display text-2xl">{sheet === "garage" ? "Garage" : sheet === "worlds" ? "Worlds" : "How to play"}</p>
                <button type="button" aria-label="Close" className="rv-btn rv-ghost size-10 !rounded-full p-0" onClick={() => setSheet("")}><X className="size-5" /></button>
              </div>
              <div className="rv-scroll">
                {sheet === "garage" && <Garage onPick={(id) => gameRef.current?.setVehicle(id, levelsOf(useRover.getState(), id))} />}
                {sheet === "worlds" && <Worlds stage={save.stage} />}
                {sheet === "help" && <Help onPlay={play} />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ the stage-complete card: moves on by itself
function ResultCard({ r, onNext, onHome }: { r: StageStats; onNext: () => void; onHome: () => void }) {
  const worldDone = r.stage % STAGES_PER_WORLD === 0 && r.stage <= DESIGNED_STAGES;
  const secs = worldDone ? 6 : 4;
  const [left, setLeft] = useState(secs);
  const [hold, setHold] = useState(false);
  const nextPlan = stagePlan(r.stage + 1);
  useEffect(() => {
    if (hold) return;
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 0.1)), 100);
    return () => clearInterval(id);
  }, [hold]);
  const fired = useRef(false);
  useEffect(() => { if (left <= 0 && !fired.current) { fired.current = true; onNext(); } }, [left, onNext]);
  const mins = Math.floor(r.time / 60), s = Math.round(r.time % 60);
  return (
    // the wrapper centres the card (the card's own transform belongs to its pop-in animation)
    <motion.div className="rv-result-wrap" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
    <motion.div className="rv-result rv-glass" initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} onPointerDown={() => setHold(true)}>
      <p className="text-xs font-extrabold tracking-[.18em] uppercase opacity-70">{worldDone ? "World complete" : r.stage > DESIGNED_STAGES ? `Remix ${r.stage - DESIGNED_STAGES}` : `Stage ${r.stage}`}</p>
      <p className="rv-big" style={{ fontSize: "clamp(34px,10vw,52px)", color: worldDone ? "#FFD23F" : "#fff" }}>{worldDone ? "World cleared!" : "Stage clear!"}</p>
      <div className="rv-stats">
        <div><b className="inline-flex items-center gap-1"><CoinIcon size={20} />{r.coins}</b><span>Coins</span></div>
        <div><b>{mins}:{String(s).padStart(2, "0")}</b><span>Time</span></div>
        <div><b>{r.flips}</b><span>Flips</span></div>
      </div>
      {r.best && <p className="mb-2 text-sm font-extrabold text-[#3EE08F]">Clean run — no crashes!</p>}
      <div className="flex items-center gap-3 rounded-2xl bg-white/[.07] p-3 text-left">
        <div className="rv-count">
          <svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" /><circle cx="22" cy="22" r="19" fill="none" stroke="var(--acc)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(left / secs) * 119.4} 200`} /></svg>
          <b>{hold ? "‖" : Math.ceil(left)}</b>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-[.14em] uppercase opacity-70">Next up {nextPlan.remix ? "· Remix" : `· Stage ${nextPlan.n}`}</p>
          <p className="rv-display truncate text-xl">{nextPlan.title}</p>
          <p className="truncate text-xs opacity-75">{nextPlan.subtitle}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button type="button" className="rv-btn rv-cta rv-shine py-3 text-lg" onClick={() => { fired.current = true; onNext(); }}><span className="rv-display">Next stage</span> <ChevronRight className="size-5" /></button>
        <button type="button" className="rv-btn rv-ghost px-4 py-3 text-sm" onClick={onHome}>Menu</button>
      </div>
    </motion.div>
    </motion.div>
  );
}

// ------------------------------------------------------------------ garage
function VehicleCanvas({ id }: { id: VehicleId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 220, h = cv.clientHeight || 110;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext("2d")!;
    const flat = new Terrain(-20, 0.5, new Float32Array(81));
    const R = new Rover(vehicleOf(id));
    R.place(flat, 0);
    // settle on its springs (no pedals: on flat ground the brake pedal reverses)
    for (let i = 0; i < 480; i++) R.step(flat, { gas: 0, brake: 0 });
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      // fit the ride and the top of the driver's cap (the monster truck sits much taller than the bike)
      const top = R.y + R.spec.head.y + R.spec.head.r * 1.35;
      const sc = Math.min(w / 4.4, (h * 0.82) / top);
      c.save(); c.translate(w / 2, h * 0.88); c.scale(sc, -sc);
      c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(0, 0, 1.7, 0.12, 0, 0, Math.PI * 2); c.fill();
      c.translate(-(R.wx[0] + R.wx[1]) / 2, 0); // the wheels' midpoint at the card's centre
      drawRoverPreview(c, R, t);
      c.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [id]);
  return <canvas ref={ref} />;
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold">
      <span className="w-14 opacity-70">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"><i className="block h-full rounded-full bg-[var(--acc)]" style={{ width: `${Math.round(v * 100)}%` }} /></span>
    </div>
  );
}

function Garage({ onPick }: { onPick: (id: VehicleId) => void }) {
  const s = useRover();
  const [view, setView] = useState<VehicleId>(s.vehicle);
  const v = vehicleOf(view), owned = s.owned.includes(view), lv = levelsOf(s, view), t = tuned(v, lv);
  const maxT = Math.max(...VEHICLES.map((x) => tuned(x, { engine: MAX_LEVEL, suspension: MAX_LEVEL, tires: MAX_LEVEL, tank: MAX_LEVEL }).torque / x.chassis.mass));
  return (
    <div>
      <div className="rv-cars">
        {VEHICLES.map((x) => (
          <button type="button" key={x.id} className={`rv-car ${view === x.id ? "sel" : ""}`} onClick={() => { sfx("tap"); setView(x.id); }}>
            <VehicleCanvas id={x.id} />
            <p className="rv-display mt-1 text-lg">{x.name}</p>
            <p className="text-xs font-bold opacity-75">{s.owned.includes(x.id) ? (s.vehicle === x.id ? "✔ Driving" : "Owned") : <span className="inline-flex items-center gap-1"><CoinIcon size={14} />{x.price.toLocaleString()}</span>}</p>
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm opacity-85">{v.tagline}</p>
      <div className="mt-2 grid gap-1.5">
        <Stat label="Power" v={(t.torque / t.chassis.mass) / maxT} />
        <Stat label="Grip" v={t.grip / 1.9} />
        <Stat label="Fuel" v={t.fuel / 230} />
        <Stat label="Air spin" v={t.airControl / 10.5} />
      </div>
      {owned ? (
        <>
          {s.vehicle !== view && <button type="button" className="rv-btn rv-cta mt-3 w-full py-3" onClick={() => { s.select(view); onPick(view); sfx("buy"); }}>Drive the {v.name}</button>}
          {UPGRADES.map((u) => {
            const level = lv[u.id], cost = upgradeCost(v, level), max = level >= MAX_LEVEL;
            return (
              <div key={u.id} className="rv-up">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{u.label}</p>
                  <p className="text-xs opacity-70">{u.hint}</p>
                  <div className="rv-dots">{Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < level ? "on" : ""} />)}</div>
                </div>
                <button type="button" disabled={max || s.coins < cost} className={`rv-btn ${max ? "rv-ghost" : "rv-cta"} px-3 py-2 text-sm disabled:opacity-50`}
                  onClick={() => { if (s.upgrade(view, u.id)) { sfx("upgrade"); if (s.vehicle === view) onPick(view); } }}>
                  {max ? <><Check className="size-4" /> Max</> : <><CoinIcon size={16} />{cost.toLocaleString()}</>}
                </button>
              </div>
            );
          })}
        </>
      ) : (
        <button type="button" disabled={s.coins < v.price} className="rv-btn rv-cta mt-3 w-full py-3 disabled:opacity-50" onClick={() => { if (s.buy(view)) { sfx("buy"); onPick(view); } }}>
          {s.coins < v.price ? <><Lock className="size-4" /> Need <CoinIcon size={16} />{(v.price - s.coins).toLocaleString()} more</> : <>Buy for <CoinIcon size={16} />{v.price.toLocaleString()}</>}
        </button>
      )}
      <p className="mt-3 flex items-center justify-center gap-1 text-sm font-bold opacity-80">You have <CoinIcon size={16} />{s.coins.toLocaleString()}</p>
    </div>
  );
}

// ------------------------------------------------------------------ world map
function WorldThumb({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let alive = true;
    const id = setTimeout(() => {
      if (!alive) return;
      const W = 320, H = 220;
      cv.width = W; cv.height = H;
      const c = cv.getContext("2d")!;
      const plan = stagePlan(index * STAGES_PER_WORLD + 3);
      const look = lookFor(plan);
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, look.sky[0]); g.addColorStop(0.55, look.sky[1]); g.addColorStop(1, look.sky[2]);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const sg = c.createRadialGradient(W * look.sunX, H * 0.3, 2, W * look.sunX, H * 0.3, 70);
      sg.addColorStop(0, "rgba(255,255,255,0.95)"); sg.addColorStop(0.2, "rgba(255,240,200,0.5)"); sg.addColorStop(1, "rgba(255,240,200,0)");
      c.fillStyle = sg; c.fillRect(0, 0, W, H);
      look.world.ridges.forEach((rg, i) => {
        const s = paintStrip(rg.style, look.ridges[i], rg.h, i, look, plan.seed + i, 0.25);
        const bottom = H * [0.7, 0.82, 0.94][i];
        c.drawImage(s.canvas, 0, 0, s.canvas.width * 0.5, s.canvas.height, 0, bottom - H, W, H);
        c.fillStyle = s.base; c.fillRect(0, bottom - 1, W, H - bottom + 1);
      });
      c.fillStyle = look.surface; c.fillRect(0, H * 0.94, W, H * 0.06);
    }, 40 + index * 60);
    return () => { alive = false; clearTimeout(id); };
  }, [index]);
  return <canvas ref={ref} />;
}

function Worlds({ stage }: { stage: number }) {
  const cur = Math.floor((Math.min(stage, DESIGNED_STAGES) - 1) / STAGES_PER_WORLD);
  return (
    <div>
      <div className="rv-worlds">
        {WORLDS.map((w, i) => {
          const done = Math.max(0, Math.min(STAGES_PER_WORLD, stage - 1 - i * STAGES_PER_WORLD));
          const lock = i > cur && stage <= DESIGNED_STAGES;
          return (
            <div key={w.id} className={`rv-world ${lock ? "lock" : ""} ${i === cur && stage <= DESIGNED_STAGES ? "now" : ""}`}>
              <WorldThumb index={i} />
              <div className="rv-wl">
                <p className="truncate">{lock ? <Lock className="mr-1 inline size-3.5" /> : null}{w.name}</p>
                <p className="text-[11px] font-bold opacity-80">{done}/{STAGES_PER_WORLD} stages{w.gravity < 9 ? " · low gravity" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm font-bold opacity-80">{stage > DESIGNED_STAGES ? `All 600 stages done! You're on remix ${stage - DESIGNED_STAGES} — they never end.` : "Clear all 600 stages to unlock endless remixes."}</p>
    </div>
  );
}

function Help({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="grid gap-2 text-[15px]">
      {[
        [<Play key="i" className="size-5" fill="#3EE08F" stroke="none" />, "Hold the right side (or → / D) to drive. Hold the left side (or ← / A) to brake and reverse."],
        [<Zap key="i" className="size-5" stroke="#7CF5FF" />, "In the air, gas tilts you back and brake tilts you forward. Land on your wheels — Zuzu's head must not touch the ground!"],
        [<Fuel key="i" className="size-5" stroke="#FF6B5A" />, "Fuel runs down as you drive. Grab the red cans to fill up."],
        [<CoinIcon key="i" size={20} />, "Collect coins, gems and flip bonuses, then upgrade your ride or buy new ones in the Garage."],
        [<Heart key="i" className="size-5" fill="#FF4F7A" stroke="none" />, "A crash costs a life and puts you back at the last checkpoint. Hearts give you lives."],
        [<Shield key="i" className="size-5" fill="#7FC4FF" stroke="#2E9BFF" />, "Power-ups: Turbo, Shield, Magnet, Feather jumps and Coins ×2."],
        [<Flag key="i" className="size-5" fill="#fff" stroke="none" />, "Reach the finish flag — the next stage starts right away. 600 stages across 12 worlds, then endless remixes."],
      ].map(([i, t], k) => (
        <div key={k} className="flex items-start gap-3 rounded-2xl bg-white/[.06] p-3"><span className="mt-0.5 shrink-0">{i}</span><span>{t}</span></div>
      ))}
      <button type="button" className="rv-btn rv-cta mt-2 py-3 text-lg" onClick={onPlay}><Play className="size-5 fill-current" /> Let&apos;s drive</button>
    </div>
  );
}
