"use client";
// Rumble Rally: the screens around the game canvas — the home screen over a live view of the grid with the next
// race's card (world, cup, the three rivals, the place you need), the race HUD (a big position badge, the live
// standings, the track with every truck on it, fuel, coins, lives, power timers), the thumb controls (brake and
// rocket on the left, gas and nitro on the right; on a computer side by side in the bottom-right corner), the race
// card and start lights on the grid, the podium card that moves on to the next race by itself (or retries a lost
// race by itself), the garage and the world map.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Map as MapIcon, Play, Wrench, HelpCircle, X, Lock, Check, ChevronRight, Heart, Fuel, Zap, Rocket, Shield, Magnet, Coins, Flag, Wind, RotateCcw, Trophy } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { useProfile } from "@/lib/store";
import { Game, type GameEvent, type Hud, type RaceStats } from "../game";
import { stagePlan, type Rival, type StagePlan } from "../stages";
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, worldOf } from "../worlds";
import { MAX_LEVEL, NO_UPGRADES, TRUCKS, UPGRADES, tuned, truckOf, upgradeCost, type TruckId } from "../trucks";
import { levelsOf, useRumble, useRumbleHydrated, START_LIVES, MAX_LIVES } from "../save";
import { RUMBLE_SOUNDS, UI_SOUNDS, sfx } from "../sound";
import { RumbleMusic } from "../music";
import { Truck } from "../physics";
import { Terrain } from "../terrain";
import { drawTruck, type TruckFx } from "../art/truck";
import { lookFor } from "../art/grade";
import { paintStrip } from "../art/backdrop";
import { POWER_COLOR } from "../art/ground";
import { RUMBLE_CSS } from "./styles";

type Sheet = "" | "garage" | "worlds" | "help";
interface Msg { id: number; big: string; sub?: string; color?: string }
const ORD = ["", "st", "nd", "rd", "th"];
const PLACE_COL = ["#888", "#FFD23F", "#D8DEE8", "#E09A5A", "#8A90A8"];
const placeWord = (n: number) => `${n}${ORD[Math.min(4, n)]}`;
const needWord = (pass: number) => (pass === 1 ? "Win the race" : pass === 2 ? "Finish top 2" : "Finish on the podium");

// ---------------------------------------------------------------- drawn icons (emoji differ from device to device)
function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#E2A31A" /><circle cx="12" cy="12" r="8.2" fill="#FFD23F" />
      <path d="M12 7.2l1.45 2.95 3.25.47-2.35 2.3.55 3.23L12 14.6l-2.9 1.55.55-3.23-2.35-2.3 3.25-.47z" fill="#E2A31A" />
      <ellipse cx="8.4" cy="8" rx="2.3" ry="1.2" fill="#FFF6C8" transform="rotate(-35 8.4 8)" />
    </svg>
  );
}
function StarIcon({ on, delay = 0 }: { on: boolean; delay?: number }) {
  return (
    <motion.svg className="rr-star" viewBox="0 0 48 48" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 380, damping: 14, delay }} aria-hidden="true">
      <path d="M24 3.5l6.2 12.6 13.9 2-10 9.8 2.4 13.8L24 35.2 11.5 41.7l2.4-13.8-10-9.8 13.9-2z" fill={on ? "#FFD23F" : "rgba(255,255,255,.12)"} stroke={on ? "#C9781A" : "rgba(255,255,255,.25)"} strokeWidth="2.5" strokeLinejoin="round" />
      {on && <path d="M16 15.5c3-1 5.5-1 7 0" stroke="#FFF6C8" strokeWidth="3" strokeLinecap="round" fill="none" />}
    </motion.svg>
  );
}
function StarMini() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3.5l6.2 12.6 13.9 2-10 9.8 2.4 13.8L24 35.2 11.5 41.7l2.4-13.8-10-9.8 13.9-2z" fill="#FFD23F" stroke="#C9781A" strokeWidth="3" strokeLinejoin="round" /></svg>;
}
/** a driver's helmet-and-face badge */
function Helmet({ face, hat, fox = false, size = 30 }: { face: string; hat: string; fox?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#0d0a1e" />
      {fox && <><path d="M7 11L6 3l7 5z" fill={face} /><path d="M25 11l1-8-7 5z" fill={face} /></>}
      <ellipse cx="16" cy="19" rx="10" ry="9" fill={face} />
      {fox && <path d="M11 22c3 3 7 3 10 0-2-2-8-2-10 0z" fill="#FFF4E8" />}
      <circle cx="12.5" cy="18.5" r="1.6" fill="#1a1420" /><circle cx="19.5" cy="18.5" r="1.6" fill="#1a1420" />
      <path d="M5.5 15c0-7 4.7-11 10.5-11s10.5 4 10.5 11z" fill={hat} />
      <path d="M7 14.5h18" stroke="rgba(255,255,255,.55)" strokeWidth="2" />
      <path d="M12 24c2 1.5 6 1.5 8 0" stroke="#3a1a22" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
function Checker({ className = "" }: { className?: string }) { return <span className={`rr-check ${className}`} />; }
const Hearts = ({ n, of }: { n: number; of: number }) => (
  <span className="rr-hearts">{Array.from({ length: of }, (_, i) => <Heart key={i} className={`size-[16px] ${i < n ? "" : "opacity-30"}`} fill={i < n ? "#FF4F7A" : "rgba(255,255,255,.4)"} stroke={i < n ? "#B0183F" : "none"} strokeWidth={1.5} />)}</span>
);
const POWER_ICON: Record<string, React.ReactNode> = {
  shield: <Shield className="size-5" fill="#9B7BFF" stroke="#E8E0FF" strokeWidth={2} />,
  magnet: <Magnet className="size-5" stroke="#FF4F9A" strokeWidth={2.6} />, double: <Coins className="size-5" stroke="#FFD23F" strokeWidth={2.4} />,
};
const POWER_NAME: Record<string, string> = { shield: "Shield up!", magnet: "Coin magnet!", double: "Coins ×2!", rockets: "Rockets loaded!", nitro: "Nitro full!" };

export default function RumbleApp({ slug }: { slug: string; title: string }) {
  const ready = useRumbleHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const save = useRumble();
  const [screen, setScreen] = useState<"home" | "play">("home");
  const [sheet, setSheet] = useState<Sheet>("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; color: string } | null>(null);
  const [result, setResult] = useState<RaceStats | null>(null);
  const [pedal, setPedal] = useState({ gas: false, brake: false, nitro: false });
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const coinsRef = useRef(0);
  const [touchDevice] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const [gameReady, setGameReady] = useState(false);
  const [popKey, setPopKey] = useState(0);

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
    loadRef.current(0.3, "Warming up the engines");
    void audio.preload(UI_SOUNDS);
    void audio.preload(RUMBLE_SOUNDS);
    // the site's own music player stays quiet: Rumble Rally's music is composed live (src/rumble/music.ts)
    void audio.stopMusic(0.2);
  }, []);
  const music = useRef<RumbleMusic | null>(null);
  useEffect(() => {
    const m = new RumbleMusic();
    music.current = m;
    m.title();
    return () => { m.dispose(); music.current = null; };
  }, []);

  const onEvent = useCallback((e: GameEvent) => {
    const g = gameRef.current;
    switch (e.k) {
      case "go":
        say("GO!", undefined, "#3EE08F", 900);
        if (!useRumble.getState().seenHelp) { setTimeout(() => toastIt(touchDevice ? "Right: gas + nitro · Left: brake + rocket" : "→ gas · ← brake · Space nitro · X rocket", "#FFD23F"), 1000); useRumble.getState().sawHelp(); }
        break;
      case "lights": break;
      case "checkpoint": toastIt(`Checkpoint ${e.n}`); break;
      case "overtake": setPopKey((k) => k + 1); say(placeWord(e.place), `Passed ${e.name}!`, "#3EE08F", 900); break;
      case "passed": setPopKey((k) => k + 1); toastIt(`${e.name} got past you!`, "#FF8A6A"); break;
      case "hit": say("Direct hit!", `${e.name} is spinning · +20`, "#FFD23F", 1000); break;
      case "struck": if (e.blocked) toastIt(`Shield blocked ${e.name}'s rocket!`, "#C8B8FF"); else say("Hit!", `${e.name} got you`, "#FF5D6C", 900); break;
      case "ram": toastIt(`Rammed ${e.name}!`, "#FFB23A"); break;
      case "air": toastIt(`Big air! +${e.coins}`, "#7CF5FF"); break;
      case "lowFuel": toastIt("Low fuel — grab an oil can!", "#FF6B5A"); break;
      case "noAmmo": toastIt("Rockets reloading…", "#FF8A6A"); break;
      case "photo": say("Photo finish!", undefined, "#FFD23F", 900); break;
      case "pickup":
        if (e.what === "fuel") toastIt("Tank full!", "#FF6B5A");
        else if (e.what === "heart") toastIt("+1 life!", "#FF5D8F");
        else toastIt(POWER_NAME[e.what], POWER_COLOR[e.what]);
        break;
      case "crash": {
        const why = e.why === "fuel" ? "Out of fuel!" : e.why === "fall" ? "Into the gap!" : "Flipped!";
        say(why, e.livesLeft > 0 ? `${e.livesLeft} ${e.livesLeft === 1 ? "life" : "lives"} left` : "No lives left · the race starts again", "#FF5D6C", 1700);
        break;
      }
      case "restart": music.current?.stage(gameRef.current!.course.plan); break;
      case "respawn": break;
      case "finish": case "out": {
        setResult(e.stats);
        const s = useRumble.getState();
        s.setCoins(g?.coins ?? s.coins);
        if (e.stats.pass) {
          s.clear(e.stats.stage, e.stats.place, e.stats.stars);
          useProfile.getState().earnCoins(3 + e.stats.stars + Math.floor(e.stats.stage / 25));
          if (e.stats.stage % STAGES_PER_WORLD === 0 && e.stats.stage <= DESIGNED_STAGES) sfx("worldClear", { delay: 0.9 });
        }
        track("rumble_race", { stage: e.stats.stage, place: e.stats.place, pass: e.stats.pass });
        break;
      }
    }
  }, [say, toastIt, touchDevice]);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const s = useRumble.getState();
    coinsRef.current = s.coins;
    let flush: ReturnType<typeof setTimeout> | null = null;
    const g = new Game(host.current, {
      truck: s.truck, levels: levelsOf(s, s.truck), lives: s.lives || START_LIVES, coins: s.coins,
      onHud: (h) => setHud(h),
      onEvent: (e) => onEventRef.current(e),
      onCoins: (n) => { coinsRef.current = n; if (!flush) flush = setTimeout(() => { flush = null; useRumble.getState().setCoins(coinsRef.current); }, 900); },
      onLives: (n) => useRumble.getState().setLives(n),
    });
    g.music = (on) => music.current?.fever(on);
    gameRef.current = g;
    g.load(s.stage, "attract");
    g.start();
    // through the ref: the player hands out a new setLoading when its state changes, which must not rebuild the game
    loadRef.current(null);
    setGameReady(true);
    return () => { if (flush) { clearTimeout(flush); useRumble.getState().setCoins(coinsRef.current); } g.dispose(); gameRef.current = null; setGameReady(false); };
  }, [ready]);

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
    music.current?.stage(g.course.plan);
    g.play();
  }, []);

  /** the next race (after a win) or the same race again (after a loss) */
  const next = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setResult(null);
    const s = useRumble.getState();
    g.load(s.stage, "grid");
    music.current?.stage(g.course.plan);
  }, []);

  const home = useCallback(() => {
    const g = gameRef.current;
    setResult(null);
    setScreen("home");
    if (g) g.load(useRumble.getState().stage, "attract");
    music.current?.title();
  }, []);

  useEffect(() => {
    setMenu(screen === "play" ? [
      { id: "restart", label: "Restart race", onSelect: () => { const g = gameRef.current; if (g) { setResult(null); g.load(g.stage, "grid"); } } },
      { id: "garage", label: "Garage", onSelect: () => { home(); setSheet("garage"); } },
      { id: "home", label: "Main menu", onSelect: home },
    ] : []);
  }, [screen, setMenu, home]);

  // ---------------------------------------------------------------- thumb controls
  const pointers = useRef(new Map<number, "gas" | "brake" | "nitro">());
  const apply = useCallback(() => {
    let gas = false, brake = false, nitro = false;
    for (const v of pointers.current.values()) { if (v === "gas") gas = true; else if (v === "brake") brake = true; else nitro = true; }
    const g = gameRef.current;
    g?.setTouch(gas || nitro ? 1 : 0, brake ? 1 : 0);
    g?.setNitro(nitro);
    setPedal((p) => (p.gas === gas && p.brake === brake && p.nitro === nitro ? p : { gas, brake, nitro }));
  }, []);
  const down = useCallback((e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault(); e.stopPropagation();
    const side = e.currentTarget.dataset.side as "gas" | "brake" | "nitro";
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, side);
    apply();
  }, [apply]);
  const up = useCallback((e: React.PointerEvent) => { pointers.current.delete(e.pointerId); apply(); }, [apply]);
  const fire = useCallback((e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); gameRef.current?.fire(); }, []);

  // ---------------------------------------------------------------- render
  const plan = stagePlan(save.stage);
  const acc = hud?.accent ?? worldOf(plan.world).accent;
  const onGrid = screen === "play" && hud?.mode === "grid";
  const racing = screen === "play" && hud && hud.mode === "play";
  const cine = !!hud && (hud.mode === "finish" || hud.mode === "over" || onGrid);

  return (
    <div className="rr-root" style={{ ["--acc" as string]: acc }} data-slug={slug}>
      <style>{RUMBLE_CSS}</style>
      <div ref={host} className="rr-stage" />

      {screen === "home" && (
        <div className="rr-ui">
          <div className="rr-home">
            <div className="flex flex-col items-center gap-3">
              <div className="rr-logo" aria-label="Rumble Rally">
                <span className="rr-l1" style={{ ["--c" as string]: "#FFD23F" }}>RUMBLE</span>
                <span className="rr-l2" style={{ ["--c" as string]: "#FF3D6E" }}>RALLY</span>
                <Checker className="rr-bar" />
              </div>
              <p className="rr-tag">Race · Ram · Rocket</p>
            </div>
            <div className="flex w-full flex-col items-center gap-3">
              <RaceCard plan={plan} />
              <div className="flex w-[min(420px,100%)] items-center justify-between px-1">
                <span className="rr-pill rr-cap"><CoinIcon />{save.coins.toLocaleString()}</span>
                <span className="rr-pill rr-cap"><Trophy className="size-[17px]" stroke="#FFD23F" strokeWidth={2.4} />{save.wins.toLocaleString()}</span>
                <span className="rr-pill rr-cap"><StarMini />{save.stars.toLocaleString()}</span>
                <Hearts n={save.lives} of={MAX_LIVES} />
              </div>
              <button type="button" className="rr-btn rr-cta rr-shine w-[min(420px,100%)] py-4 text-2xl" onClick={play} disabled={!gameReady}>
                <span className="inline-flex items-center gap-2"><Play className="size-7 fill-current" /> <span className="rr-display">{save.stage === 1 ? "Start racing" : `Race ${save.stage}`}</span></span>
              </button>
              <div className="grid w-[min(420px,100%)] grid-cols-3 gap-2">
                <button type="button" className="rr-btn rr-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("garage"); }}><span className="inline-flex items-center gap-1.5"><Wrench className="size-5" /> Garage</span></button>
                <button type="button" className="rr-btn rr-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("worlds"); }}><span className="inline-flex items-center gap-1.5"><MapIcon className="size-5" /> Worlds</span></button>
                <button type="button" className="rr-btn rr-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("help"); }}><span className="inline-flex items-center gap-1.5"><HelpCircle className="size-5" /> Help</span></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "play" && hud && (
        <div className={`rr-hud ${cine ? "rr-cine" : ""}`}>
          <div className="rr-top">
            <div className="rr-row">
              <div className="flex min-w-0 items-start gap-2">
                <div key={popKey} className={`rr-pos ${popKey ? "pop" : ""}`} style={{ ["--pc" as string]: hud.place <= hud.pass ? (hud.place === 1 ? "#FFB627" : "#3EC88F") : "#E8304A" }} aria-label={`Position ${hud.place} of 4`}>
                  <b>{hud.place}</b><sup>{ORD[Math.min(4, hud.place)]}</sup><small>/4</small>
                </div>
                <div className="rr-board rr-cap">
                  {hud.standings.map((s) => (
                    <div key={s.name} className={`${s.you ? "you" : ""} ${s.down ? "down" : ""}`}><em>{s.place}</em><i style={{ background: s.color }} /><span className="truncate">{s.name}</span>{s.done && <Flag className="size-3" />}</div>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rr-pill rr-cap"><CoinIcon />{hud.coins.toLocaleString()}</span>
                <Hearts n={hud.lives} of={Math.max(3, hud.lives)} />
              </div>
            </div>
            <div className="rr-track">
              <b style={{ width: `${hud.progress * 100}%` }} />
              {hud.checkpoints.map((c, i) => <s key={i} className={hud.progress >= c ? "on" : ""} style={{ left: `${c * 100}%` }} />)}
              {hud.standings.filter((s) => !s.you).map((s) => <em key={s.name} style={{ left: `${s.progress * 100}%`, background: s.color }} />)}
              <em className="you" style={{ left: `${hud.progress * 100}%` }}><Helmet face="#F08A3A" hat="#FF6A2C" fox size={18} /></em>
              <Checker className="rr-flag" />
            </div>
            <div className="rr-row">
              <div className={`rr-fuel rr-cap ${hud.lowFuel ? "rr-low" : ""}`}>
                <Fuel className="size-[17px]" stroke={hud.lowFuel ? "#FF6B5A" : "#fff"} strokeWidth={2.4} />
                <span className="rr-fuelbar"><i style={{ width: `${Math.max(2, hud.fuel * 100)}%`, background: hud.fuel > 0.5 ? "linear-gradient(90deg,#3EE08F,#9CFF6B)" : hud.fuel > 0.22 ? "linear-gradient(90deg,#FFB627,#FFE27A)" : "linear-gradient(90deg,#FF3B3B,#FF7A5A)" }} /></span>
              </div>
              <span className="rr-pill rr-cap text-[13px]">{hud.speed} km/h</span>
            </div>
          </div>
          {hud.powers.length > 0 && (
            <div className="rr-powers">
              {hud.powers.map((p) => (
                <div key={p.id} className="rr-power" title={p.id}>
                  <svg className="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" /><circle cx="22" cy="22" r="19" fill="none" stroke={POWER_COLOR[p.id]} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(p.left / p.secs) * 119.4} 200`} /></svg>
                  {POWER_ICON[p.id]}
                </div>
              ))}
            </div>
          )}
          {Math.abs(hud.wind) > 0.6 && <div className="rr-wind rr-cap"><Wind className="size-4" style={{ transform: hud.wind > 0 ? "none" : "scaleX(-1)" }} /> Wind</div>}
          {!result && (
            <>
              <div className="rr-zone" data-side="brake" style={{ left: 0 }} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
              <div className="rr-zone" data-side="gas" style={{ right: 0 }} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
              <div className="rr-pads">
                <div className="rr-side">
                  <Act kind="rocket" hud={hud} onDown={fire} />
                  <div className={`rr-pedal brake ${pedal.brake ? "on" : ""}`} data-side="brake" onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="3" /><path d="M8 9h8M8 13h8" /></svg>
                    <small>BRAKE</small>
                  </div>
                </div>
                <div className="rr-side right">
                  <Act kind="nitro" hud={hud} on={pedal.nitro} onDown={down} onUp={up} />
                  <div className={`rr-pedal gas ${pedal.gas ? "on" : ""}`} data-side="gas" onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="3" /><path d="M10 7h4M10 11h4M10 15h4" /></svg>
                    <small>GAS</small>
                  </div>
                </div>
              </div>
              {!touchDevice && racing && <div className="rr-keys rr-cap">→ gas · ← brake · Space nitro · X rocket</div>}
            </>
          )}
          <AnimatePresence>
            {onGrid && hud.lights < 1 && (
              <motion.div key={`intro-${hud.stage}`} className="rr-intro rr-keep" initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12, scale: 0.96 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                <RaceCard plan={stagePlan(hud.stage)} compact />
              </motion.div>
            )}
          </AnimatePresence>
          {onGrid && hud.lights >= 1 && (
            <div className="rr-lights rr-keep" aria-label={`${hud.lights} of 5 lights`}>
              {[1, 2, 3, 4, 5].map((n) => <i key={n} className={hud.lights >= n ? "red" : ""} />)}
            </div>
          )}
          {hud.mode === "play" && hud.lights === 6 && <GoLights />}
        </div>
      )}

      <AnimatePresence>
        {msg && (
          <motion.div key={msg.id} className="rr-pop" initial={{ opacity: 0, scale: 0.5, x: -40 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 1.2, x: 40 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
            <p className="rr-big" style={{ color: msg.color }}>{msg.big}</p>
            {msg.sub && <p className="rr-sub">{msg.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="rr-toast rr-cap" style={{ color: toast.color }} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>{toast.text}</motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{result && <ResultCard key={`${result.stage}-${result.pass}`} r={result} onNext={next} onHome={home} onGarage={() => { home(); setSheet("garage"); }} />}</AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div key="veil" className="rr-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet("")} />
            <motion.div key={sheet} className="rr-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}>
              <div className="rr-grab" />
              <div className="mb-3 flex items-center justify-between">
                <p className="rr-display rr-it text-2xl">{sheet === "garage" ? "Garage" : sheet === "worlds" ? "Worlds" : "How to race"}</p>
                <button type="button" aria-label="Close" className="rr-btn rr-ghost size-10 !rounded-full p-0" onClick={() => setSheet("")}><X className="size-5" /></button>
              </div>
              <div className="rr-scroll">
                {sheet === "garage" && <Garage onPick={(id) => gameRef.current?.setTruck(id, levelsOf(useRumble.getState(), id))} />}
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

/** the five lights turn green and fade as the race starts */
function GoLights() {
  return (
    <motion.div className="rr-lights rr-keep" initial={{ opacity: 1 }} animate={{ opacity: 0, y: -20 }} transition={{ duration: 0.6, delay: 0.5 }}>
      {[1, 2, 3, 4, 5].map((n) => <i key={n} className="green" />)}
    </motion.div>
  );
}

/** the nitro and rocket buttons, each with its gauge */
function Act({ kind, hud, on = false, onDown, onUp }: { kind: "nitro" | "rocket"; hud: Hud; on?: boolean; onDown: (e: React.PointerEvent<HTMLElement>) => void; onUp?: (e: React.PointerEvent) => void }) {
  const nitro = kind === "nitro";
  const fill = nitro ? hud.nitro : hud.ammo > 0 ? 1 : hud.reload;
  const off = nitro ? hud.nitro < 0.05 : hud.ammo === 0;
  const style = { ["--b1" as string]: nitro ? "#7CF5FF" : "#FF8A5A", ["--b2" as string]: nitro ? "#1E8AD8" : "#D8302A" };
  return (
    <button type="button" aria-label={nitro ? "Nitro" : "Fire rocket"} className={`rr-act ${on ? "on" : ""} ${off ? "off" : ""} ${nitro && hud.burning ? "burn" : ""}`} style={style} data-side={nitro ? "nitro" : undefined}
      onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp}>
      <svg className="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" /><circle cx="22" cy="22" r="20" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${fill * 125.6} 200`} /></svg>
      {nitro ? <Zap className="size-8" fill="#fff" stroke="none" /> : <Rocket className="size-8" fill="#fff" stroke="#fff" strokeWidth={1.5} />}
      {!nitro && <span className="rr-ammo">{hud.ammo}</span>}
      <small>{nitro ? "NITRO" : "ROCKET"}</small>
    </button>
  );
}

// ---------------------------------------------------------------- the race card (home and grid)
function RaceCard({ plan, compact = false }: { plan: StagePlan; compact?: boolean }) {
  const w = worldOf(plan.world), local = plan.local;
  const wi = Math.floor((plan.n - 1) / STAGES_PER_WORLD);
  return (
    <div className="rr-card">
      <div className="relative flex items-center justify-between gap-2">
        <span className="rr-kicker"><span>{plan.remix ? `Remix ${plan.remix}` : `World ${wi + 1} · ${w.name}`}</span></span>
        <span className="text-xs font-extrabold opacity-70">Race #{plan.n}</span>
      </div>
      <p className="rr-display rr-it relative mt-2 truncate text-[23px] leading-tight">{plan.finale ? <><Trophy className="mr-1 inline size-5 align-[-2px]" stroke="#FFD23F" strokeWidth={2.6} />{plan.title}</> : plan.title}</p>
      <p className="relative truncate text-xs font-bold opacity-75">{plan.cup} · {plan.subtitle}</p>
      <div className="relative mt-2 flex items-center gap-2 text-sm font-extrabold">
        <Flag className="size-4" stroke="#FFD23F" /> {needWord(plan.pass)}
        <span className="ml-auto text-xs opacity-70">{(plan.length / 1000).toFixed(1)} km</span>
      </div>
      <Rivals rivals={plan.rivals} />
      {!plan.remix && !compact && (
        <div className="rr-short-hide relative mt-2">
          <div className="mb-1 flex justify-between text-[11px] font-extrabold opacity-70"><span>Race {local} of {STAGES_PER_WORLD}</span><span>{plan.n} / {DESIGNED_STAGES}</span></div>
          <div className="rr-progress"><i style={{ width: `${(local / STAGES_PER_WORLD) * 100}%` }} /></div>
        </div>
      )}
      <Checker className="rr-strip" />
    </div>
  );
}
function Rivals({ rivals }: { rivals: Rival[] }) {
  return (
    <div className="rr-rivals relative">
      {rivals.map((r) => (
        <div key={r.name} className="rr-rival" style={{ boxShadow: `inset 3px 0 0 ${r.colors.body}` }}>
          <Helmet face={r.face} hat={r.hat} size={26} />
          <p className="truncate">{r.name}<br /><span className="font-bold opacity-60">{truckOf(r.truck).name}</span></p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- the podium card: moves on (or retries) by itself
function ResultCard({ r, onNext, onHome, onGarage }: { r: RaceStats; onNext: () => void; onHome: () => void; onGarage: () => void }) {
  const worldDone = r.pass && r.stage % STAGES_PER_WORLD === 0 && r.stage <= DESIGNED_STAGES;
  const secs = worldDone ? 6.5 : r.pass ? 5 : 5.5;
  const [left, setLeft] = useState(secs);
  const [hold, setHold] = useState(false);
  const nextPlan = stagePlan(r.pass ? r.stage + 1 : r.stage);
  useEffect(() => {
    if (hold) return;
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 0.1)), 100);
    return () => clearInterval(id);
  }, [hold]);
  const fired = useRef(false);
  useEffect(() => { if (left <= 0 && !fired.current) { fired.current = true; onNext(); } }, [left, onNext]);
  const mins = Math.floor(r.time / 60), s = Math.round(r.time % 60);
  const podium = [r.standings[1], r.standings[0], r.standings[2]];
  const head = !r.pass ? (r.place >= 4 ? "Race lost" : `${placeWord(r.place)} — not enough`) : worldDone ? "World champion!" : r.place === 1 ? "You won!" : `${placeWord(r.place)} place!`;
  return (
    <motion.div className="rr-result-wrap" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div className="rr-result rr-card" initial={{ opacity: 0, scale: 0.8, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} onPointerDown={() => setHold(true)}>
        <span className="rr-kicker relative"><span>{worldDone ? `${worldOf(stagePlan(r.stage).world).cup} won` : r.stage > DESIGNED_STAGES ? `Remix ${r.stage - DESIGNED_STAGES}` : `Race #${r.stage}`}</span></span>
        <p className="rr-big relative mt-1" style={{ fontSize: "clamp(34px,10vw,50px)", color: r.pass ? PLACE_COL[r.place] : "#FF5D6C" }}>{head}</p>
        <div className="rr-podium relative">
          {podium.map((p, k) => p && (
            <div key={p.name}>
              <p className={p.you ? "you" : ""}>{p.you ? "You" : p.name}</p>
              <span className="inline-block size-3 rounded-full" style={{ background: p.color }} />
              <div className="rr-step" style={{ height: [46, 64, 34][k], background: PLACE_COL[p.place] }}>{p.place}</div>
            </div>
          ))}
        </div>
        {r.pass && <div className="rr-stars relative">{[0, 1, 2].map((i) => <StarIcon key={i} on={i < r.stars} delay={0.15 + i * 0.18} />)}</div>}
        {!r.pass && <p className="relative mt-2 text-sm font-extrabold opacity-90">{needWord(r.need)} to move on. Upgrades in the Garage help!</p>}
        <div className="rr-stats relative">
          <div><b><CoinIcon size={15} />{r.coins + r.bonus}</b><span>Coins</span></div>
          <div><b>{mins}:{String(s).padStart(2, "0")}</b><span>Time</span></div>
          <div><b><Rocket className="size-4" />{r.hits}</b><span>Hits</span></div>
          <div><b>{r.overtakes}</b><span>Passes</span></div>
        </div>
        <div className="rr-next relative">
          <div className="rr-count">
            <svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" /><circle cx="22" cy="22" r="19" fill="none" stroke="var(--acc)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(left / secs) * 119.4} 200`} /></svg>
            <b>{hold ? "‖" : Math.ceil(left)}</b>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold tracking-[.14em] uppercase opacity-70">{r.pass ? "Next race starts" : "Retrying"} {nextPlan.remix ? "· Remix" : `· Race ${nextPlan.n}`}</p>
            <p className="rr-display rr-it truncate text-lg">{nextPlan.title}</p>
            <p className="truncate text-xs opacity-75">{needWord(nextPlan.pass)} · {nextPlan.subtitle}</p>
          </div>
        </div>
        <div className="relative mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
          <button type="button" className="rr-btn rr-cta rr-shine py-3 text-lg" onClick={() => { fired.current = true; onNext(); }}>
            <span className="inline-flex items-center gap-1">{r.pass ? <><span className="rr-display">Next race</span> <ChevronRight className="size-5" /></> : <><RotateCcw className="size-5" /> <span className="rr-display">Retry</span></>}</span>
          </button>
          <button type="button" aria-label="Garage" className="rr-btn rr-ghost px-3 py-3 text-sm" onClick={onGarage}><span><Wrench className="size-5" /></span></button>
          <button type="button" className="rr-btn rr-ghost px-4 py-3 text-sm" onClick={onHome}><span>Menu</span></button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------- garage
function TruckCanvas({ id }: { id: TruckId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 230, h = cv.clientHeight || 124;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext("2d")!;
    const flat = new Terrain(-20, 0.5, new Float32Array(81));
    const spec = truckOf(id);
    const R = new Truck(spec);
    R.place(flat, 0);
    for (let i = 0; i < 480; i++) R.step(flat, { gas: 0, brake: 0 });
    const fx: TruckFx = { mood: "happy", blink: false, gas: 0, brake: 0, t: 0, nitro: false, shield: 0, night: 0, light: "#FFFFFF", ammo: spec.rockets, hurt: 0 };
    const driver = { face: "#F08A3A", hat: "#FF6A2C", fox: true };
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      fx.t = t; fx.blink = t % 3.2 < 0.12; fx.nitro = t % 4 > 3;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const top = R.y + spec.cab.roof + 0.6;
      const sc = Math.min(w / 6.2, (h * 0.86) / top);
      c.save(); c.translate(w / 2 + sc * 0.4, h * 0.92); c.scale(sc, -sc);
      c.translate(-(R.wx[0] + R.wx[1]) / 2, 0);
      drawTruck(c, R, spec.colors, driver, fx);
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
      <span className="w-16 opacity-70">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"><i className="block h-full rounded-full bg-[var(--acc)]" style={{ width: `${Math.round(Math.min(1, v) * 100)}%` }} /></span>
    </div>
  );
}

function Garage({ onPick }: { onPick: (id: TruckId) => void }) {
  const s = useRumble();
  const [view, setView] = useState<TruckId>(s.truck);
  const v = truckOf(view), owned = s.owned.includes(view), lv = levelsOf(s, view), t = tuned(v, lv);
  const full = { ...NO_UPGRADES, engine: MAX_LEVEL, nitro: MAX_LEVEL, rockets: MAX_LEVEL, absorbers: MAX_LEVEL, armor: MAX_LEVEL };
  const maxP = Math.max(...TRUCKS.map((x) => tuned(x, full).torque / x.chassis.mass));
  const maxV = Math.max(...TRUCKS.map((x) => tuned(x, full).maxSpin * x.wheel.r));
  return (
    <div>
      <div className="rr-trucks">
        {TRUCKS.map((x) => (
          <button type="button" key={x.id} className={`rr-truck ${view === x.id ? "sel" : ""}`} onClick={() => { sfx("tap"); setView(x.id); }}>
            <TruckCanvas id={x.id} />
            <p className="rr-display rr-it mt-1 text-lg">{x.name}</p>
            <p className="text-xs font-bold opacity-75">{s.owned.includes(x.id) ? (s.truck === x.id ? "Driving" : "Owned") : <span className="inline-flex items-center gap-1"><CoinIcon size={14} />{x.price.toLocaleString()}</span>}</p>
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm opacity-85">{v.tagline}</p>
      <div className="mt-2 grid gap-1.5">
        <Stat label="Power" v={(t.torque / t.chassis.mass) / maxP} />
        <Stat label="Top speed" v={(t.maxSpin * t.wheel.r) / maxV} />
        <Stat label="Nitro" v={(t.nitro * t.nitroPush) / (8.3 * 15.6)} />
        <Stat label="Rockets" v={t.rockets / 9} />
        <Stat label="Armour" v={t.armor / 0.85} />
      </div>
      {owned ? (
        <>
          {s.truck !== view && <button type="button" className="rr-btn rr-cta mt-3 w-full py-3" onClick={() => { s.select(view); onPick(view); sfx("buy"); }}><span>Drive the {v.name}</span></button>}
          {UPGRADES.map((u) => {
            const level = lv[u.id], cost = upgradeCost(v, level), max = level >= MAX_LEVEL;
            return (
              <div key={u.id} className="rr-up">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{u.label}</p>
                  <p className="text-xs opacity-70">{u.hint}</p>
                  <div className="rr-dots">{Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < level ? "on" : ""} />)}</div>
                </div>
                <button type="button" disabled={max || s.coins < cost} className={`rr-btn ${max ? "rr-ghost" : "rr-cta"} px-3 py-2 text-sm`}
                  onClick={() => { if (s.upgrade(view, u.id)) { sfx("upgrade"); if (s.truck === view) onPick(view); } }}>
                  <span className="inline-flex items-center gap-1">{max ? <><Check className="size-4" /> Max</> : <><CoinIcon size={16} />{cost.toLocaleString()}</>}</span>
                </button>
              </div>
            );
          })}
        </>
      ) : (
        <button type="button" disabled={s.coins < v.price} className="rr-btn rr-cta mt-3 w-full py-3" onClick={() => { if (s.buy(view)) { sfx("buy"); onPick(view); } }}>
          <span className="inline-flex items-center gap-1">{s.coins < v.price ? <><Lock className="size-4" /> Need <CoinIcon size={16} />{(v.price - s.coins).toLocaleString()} more</> : <>Buy for <CoinIcon size={16} />{v.price.toLocaleString()}</>}</span>
        </button>
      )}
      <p className="mt-3 flex items-center justify-center gap-1 text-sm font-bold opacity-80">You have <CoinIcon size={16} />{s.coins.toLocaleString()}</p>
    </div>
  );
}

// ---------------------------------------------------------------- world map
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
      const plan = stagePlan(index * STAGES_PER_WORLD + 4);
      const look = lookFor(plan);
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, look.sky[0]); g.addColorStop(0.55, look.sky[1]); g.addColorStop(1, look.sky[2]);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const sg = c.createRadialGradient(W * look.sunX, H * 0.3, 2, W * look.sunX, H * 0.3, 70);
      sg.addColorStop(0, "rgba(255,255,255,0.95)"); sg.addColorStop(0.2, "rgba(255,240,200,0.5)"); sg.addColorStop(1, "rgba(255,240,200,0)");
      c.fillStyle = sg; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) {
        const s = paintStrip(look.world.id, i as 0 | 1 | 2, look.layers[i], look, plan.seed + i, 0.25);
        const bottom = H * [0.72, 0.84, 0.96][i];
        c.drawImage(s.canvas, 0, 0, s.canvas.width * 0.5, s.canvas.height, 0, bottom - H, W, H);
        c.fillStyle = s.base; c.fillRect(0, bottom - 1, W, H - bottom + 1);
      }
      c.fillStyle = look.surface; c.fillRect(0, H * 0.95, W, H * 0.05);
    }, 40 + index * 60);
    return () => { alive = false; clearTimeout(id); };
  }, [index]);
  return <canvas ref={ref} />;
}

function Worlds({ stage }: { stage: number }) {
  const cur = Math.floor((Math.min(stage, DESIGNED_STAGES) - 1) / STAGES_PER_WORLD);
  return (
    <div>
      <div className="rr-worlds">
        {WORLDS.map((w, i) => {
          const done = Math.max(0, Math.min(STAGES_PER_WORLD, stage - 1 - i * STAGES_PER_WORLD));
          const lock = i > cur && stage <= DESIGNED_STAGES;
          return (
            <div key={w.id} className={`rr-world ${lock ? "lock" : ""} ${i === cur && stage <= DESIGNED_STAGES ? "now" : ""}`}>
              <WorldThumb index={i} />
              <span className="rr-wc">{done >= STAGES_PER_WORLD ? <Trophy className="size-4" stroke="#FFD23F" strokeWidth={2.6} /> : <Flag className="size-4" stroke={w.accent} strokeWidth={2.6} />}</span>
              <div className="rr-wl">
                <p className="truncate">{lock ? <Lock className="mr-1 inline size-3.5" /> : null}{w.name}</p>
                <p className="truncate text-[11px] font-bold opacity-80">{done}/{STAGES_PER_WORLD} · {w.cup}{w.gravity < 9 ? " · low gravity" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm font-bold opacity-80">{stage > DESIGNED_STAGES ? `All 600 races done! You're on remix ${stage - DESIGNED_STAGES} — they never end.` : "Win all 600 races to unlock endless remix races."}</p>
    </div>
  );
}

function Help({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="grid gap-2 text-[15px]">
      {[
        [<Play key="i" className="size-5" fill="#3EE08F" stroke="none" />, "Hold GAS (right side, or → / D) to drive. Hold BRAKE (left side, or ← / A) to slow down and back up. In the air, gas tips the nose up and brake tips it down — land on your wheels!"],
        [<Zap key="i" className="size-5" fill="#7CF5FF" stroke="none" />, "NITRO (Space) blasts you forward. The gauge refills slowly, or all at once with a nitro can."],
        [<Rocket key="i" className="size-5" stroke="#FF8A5A" />, "ROCKET (X) locks on to the truck ahead and knocks it spinning. Rockets reload one by one."],
        [<Flag key="i" className="size-5" fill="#fff" stroke="none" />, "Finish on the podium early on, top two later, and win each world's final. A race lost starts again by itself."],
        [<Shield key="i" className="size-5" stroke="#9B7BFF" />, "Rivals ram and fire back. A Shield blocks one rocket. Ram them with your front bumper to shove them away!"],
        [<Fuel key="i" className="size-5" stroke="#FF6B5A" />, "Fuel runs down as you drive. Grab the oil cans to fill up."],
        [<Heart key="i" className="size-5" fill="#FF4F7A" stroke="none" />, "A flip, a fall or an empty tank costs a life. Hearts give you lives."],
        [<Wind key="i" className="size-5" stroke="#BFE6FF" />, "Watch out for gaps, mud, ice, water, rope bridges and gusty wind."],
        [<CoinIcon key="i" size={20} />, "Spend coins in the Garage on new trucks and upgrades: engine, nitro, rockets, absorbers and armour."],
      ].map(([i, t], k) => (
        <div key={k} className="flex items-start gap-3 rounded-2xl bg-white/[.06] p-3"><span className="mt-0.5 shrink-0">{i}</span><span>{t}</span></div>
      ))}
      <button type="button" className="rr-btn rr-cta mt-2 py-3 text-lg" onClick={onPlay}><span className="inline-flex items-center gap-2"><Play className="size-5 fill-current" /> Let&apos;s race</span></button>
    </div>
  );
}
