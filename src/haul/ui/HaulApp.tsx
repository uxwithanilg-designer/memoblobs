"use client";
// Tumble Truck: the screens around the game canvas — the home screen over a live view of your current world with the
// next delivery's ticket, the HUD (stage, route with checkpoints and the depot, fuel, the load meter with the share that
// must arrive, coins, lives, power timers), the thumb pedals, the cinematic delivery ticket at each stage's start, the
// delivered card with stars that moves on to the next stage by itself, the garage and the world map.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Map as MapIcon, Play, Wrench, HelpCircle, X, Lock, Check, ChevronRight, Heart, Fuel, Flame, Grid3x3, Magnet, Coins, Flag, Wind, Warehouse } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { useProfile } from "@/lib/store";
import { Game, type GameEvent, type Hud, type StageStats } from "../game";
import { stagePlan, type StagePlan } from "../stages";
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, worldOf } from "../worlds";
import { CARGO, stackLoad, type CargoKind } from "../cargo";
import { MAX_LEVEL, TRUCKS, UPGRADES, bedLength, tuned, truckOf, upgradeCost, type TruckId } from "../trucks";
import { levelsOf, useHaul, useHaulHydrated } from "../save";
import { HAUL_SOUNDS, UI_SOUNDS, sfx } from "../sound";
import { HaulMusic } from "../music";
import { Truck } from "../physics";
import { Terrain } from "../terrain";
import { CargoSprites, drawTruckPreview } from "../art/truck";
import { lookFor } from "../art/grade";
import { paintStrip } from "../art/backdrop";
import { POWER_COLOR } from "../art/ground";
import { HAUL_CSS } from "./styles";

type Sheet = "" | "garage" | "worlds" | "help";
interface Msg { id: number; big: string; sub?: string; color?: string }

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
function StarIcon({ on, size = 56, delay = 0 }: { on: boolean; size?: number; delay?: number }) {
  return (
    <motion.svg className="tt-star" width={size} height={size} viewBox="0 0 48 48" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 380, damping: 14, delay }} aria-hidden="true">
      <path d="M24 3.5l6.2 12.6 13.9 2-10 9.8 2.4 13.8L24 35.2 11.5 41.7l2.4-13.8-10-9.8 13.9-2z" fill={on ? "#FFD23F" : "rgba(28,20,48,.15)"} stroke={on ? "#C9781A" : "rgba(28,20,48,.25)"} strokeWidth="2.5" strokeLinejoin="round" />
      {on && <path d="M16 15.5c3-1 5.5-1 7 0" stroke="#FFF6C8" strokeWidth="3" strokeLinecap="round" fill="none" />}
    </motion.svg>
  );
}
/** a little picture of each load */
export function CargoIcon({ kind, size = 20, dim = false }: { kind: CargoKind; size?: number; dim?: boolean }) {
  const s = CARGO[kind];
  const body = (() => {
    switch (kind) {
      case "crate": return <><rect x="3" y="5" width="18" height="15" rx="2" fill="#D99A52" /><rect x="5" y="7" width="14" height="11" fill="#E8B06E" /><path d="M5 18L19 7" stroke="#8A5527" strokeWidth="2.2" /><rect x="3" y="5" width="18" height="15" rx="2" fill="none" stroke="#8A5527" strokeWidth="2" /></>;
      case "melon": return <><circle cx="12" cy="12.5" r="8.5" fill="#3E9A3A" /><path d="M8 5c-1.5 4.5-1.5 10 0 15M12 4v17M16 5c1.5 4.5 1.5 10 0 15" stroke="#1E5A22" strokeWidth="1.6" fill="none" /><ellipse cx="9" cy="9" rx="2.4" ry="1.3" fill="#B8F09A" opacity=".6" /></>;
      case "barrel": return <><path d="M6 4h12c1.8 5 1.8 11 0 16H6c-1.8-5-1.8-11 0-16z" fill="#B8743E" /><rect x="4.6" y="7" width="14.8" height="2" fill="#5A5E6E" /><rect x="4.6" y="15" width="14.8" height="2" fill="#5A5E6E" /></>;
      case "jar": return <><rect x="5" y="7" width="14" height="14" rx="3" fill="#FFB627" /><rect x="4" y="3.5" width="16" height="4.5" rx="1.5" fill="#E8423A" /><rect x="7" y="9" width="2" height="9" rx="1" fill="#FFE7A8" /></>;
      case "egg": return <><ellipse cx="12" cy="13" rx="7" ry="8.6" fill="#FFF1DC" stroke="#C9A27A" strokeWidth="1.4" /><circle cx="10" cy="11" r="1" fill="#C9A27A" /><circle cx="14.5" cy="15" r="1" fill="#C9A27A" /></>;
      case "vase": return <><path d="M9 3h6v3c4 2 5 9 1.5 13l.5 2H7l.5-2C4 15 5 8 9 6z" fill="#E0774A" /><rect x="5.6" y="11" width="12.8" height="2.4" fill="#2A3A5A" /></>;
      case "potion": return <><path d="M10 3h4v5c4 1.5 5 4 5 7 0 4-3 6-7 6s-7-2-7-6c0-3 1-5.5 5-7z" fill="rgba(220,240,255,.7)" /><path d="M5.2 14c0 4 3 6.5 6.8 6.5s6.8-2.5 6.8-6.5z" fill="#B46CFF" /><rect x="9.5" y="1.8" width="5" height="3" rx="1" fill="#A8784A" /></>;
      case "log": return <><rect x="2" y="8" width="20" height="9" rx="4.5" fill="#7A4E2A" /><ellipse cx="19" cy="12.5" rx="3" ry="4.5" fill="#E2B27A" /><ellipse cx="19" cy="12.5" rx="1.4" ry="2.2" fill="none" stroke="#B07A48" strokeWidth="1.2" /></>;
      case "gift": return <><rect x="3.5" y="8" width="17" height="13" rx="2" fill="#FF4F6D" /><rect x="10.8" y="8" width="2.4" height="13" fill="#FFD23F" /><rect x="3.5" y="12.8" width="17" height="2.4" fill="#FFD23F" /><path d="M12 8c-2-4-6-3-4 0zM12 8c2-4 6-3 4 0z" fill="#FFD23F" /></>;
      case "lantern": return <><rect x="8" y="2.5" width="8" height="2.5" rx="1" fill="#2A2D3E" /><rect x="8" y="19" width="8" height="2.5" rx="1" fill="#2A2D3E" /><ellipse cx="12" cy="12" rx="8" ry="7.5" fill="#FF5A3D" /><ellipse cx="12" cy="12" rx="4" ry="7.5" fill="none" stroke="#B8301A" strokeWidth="1.2" /><ellipse cx="12" cy="12" rx="4" ry="3.5" fill="#FFE08A" opacity=".6" /></>;
      case "crystal": return <><path d="M7 20l-1-11 6-6 6 6-1 11z" fill="#FF5F8F" /><path d="M7 20l-1-11 6-6v17z" fill="#FFB3CB" opacity=".7" /></>;
      case "orb": return <><circle cx="12" cy="12" r="9" fill="#5AB8F2" /><circle cx="12" cy="12" r="9" fill="url(#ttorb)" /><path d="M12 6.8l1.5 3.3 3.6.4-2.7 2.4.8 3.6L12 14.6l-3.2 1.9.8-3.6-2.7-2.4 3.6-.4z" fill="#FFF6B0" /><defs><radialGradient id="ttorb" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient></defs></>;
    }
  })();
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-label={s.name} style={{ opacity: dim ? 0.45 : 1 }}>{body}</svg>;
}
const Hearts = ({ n, of }: { n: number; of: number }) => (
  <span className="tt-hearts">{Array.from({ length: of }, (_, i) => <Heart key={i} className={`size-[17px] ${i < n ? "" : "opacity-30"}`} fill={i < n ? "#FF4F7A" : "rgba(255,255,255,.4)"} stroke={i < n ? "#B0183F" : "none"} strokeWidth={1.5} />)}</span>
);
const POWER_ICON: Record<string, React.ReactNode> = {
  nitro: <Flame className="size-5" fill="#FFB23A" stroke="#FF6A2C" />, net: <Grid3x3 className="size-5" stroke="#3EE08F" strokeWidth={2.6} />,
  bubble: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7CC8FF" strokeWidth="2.4"><circle cx="8" cy="9" r="4" /><circle cx="16" cy="10" r="3" /><circle cx="12" cy="17" r="4" /></svg>,
  magnet: <Magnet className="size-5" stroke="#FF4F7A" strokeWidth={2.6} />, double: <Coins className="size-5" stroke="#FFD23F" strokeWidth={2.4} />,
};
const POWER_NAME: Record<string, string> = { nitro: "Nitro!", net: "Cargo net!", bubble: "Bubble wrap!", magnet: "Coin magnet!", double: "Coins ×2!" };
const plural = (n: number, k: CargoKind) => `${n} ${n === 1 ? CARGO[k].name : CARGO[k].plural}`;

export default function HaulApp({ slug }: { slug: string; title: string }) {
  const ready = useHaulHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const save = useHaul();
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
    loadRef.current(0.3, "Loading the truck");
    void audio.preload(UI_SOUNDS);
    void audio.preload(HAUL_SOUNDS);
    // the site's own music player stays quiet: Tumble Truck's music is composed live (src/haul/music.ts)
    void audio.stopMusic(0.2);
  }, []);
  const music = useRef<HaulMusic | null>(null);
  useEffect(() => {
    const m = new HaulMusic();
    music.current = m;
    m.title();
    return () => { m.dispose(); music.current = null; };
  }, []);

  const onEvent = useCallback((e: GameEvent) => {
    const g = gameRef.current;
    switch (e.k) {
      case "go":
        say("GO!", "Easy on the gas — keep the load in", "#3EE08F", 1000);
        if (!useHaul.getState().seenHelp) { setTimeout(() => toastIt("Right = gas · Left = brake", "#FFD23F"), 1100); useHaul.getState().sawHelp(); }
        break;
      case "checkpoint": toastIt("Checkpoint — load saved"); break;
      case "air": toastIt(`Big air! +${e.coins}`, "#7CF5FF"); break;
      case "lowFuel": toastIt("Low fuel — grab a can!", "#FF6B5A"); break;
      case "wind": toastIt("Gusty wind — slow down!", "#BFE6FF"); break;
      case "pickup":
        if (e.what === "fuel") toastIt("Tank full!", "#FF6B5A");
        else if (e.what === "heart") toastIt("+1 life!", "#FF5D8F");
        else toastIt(POWER_NAME[e.what], POWER_COLOR[e.what]);
        break;
      case "cargo": {
        const word = CARGO[e.kind].name;
        const danger = e.left <= e.need;
        say(e.what === "broke" ? "Smashed!" : "Lost one!", `${word[0].toUpperCase()}${word.slice(1)} ${e.what === "broke" ? "broke" : "fell out"} · ${e.left} left, need ${e.need}`, danger ? "#FF5D6C" : "#FFD23F", 1300);
        break;
      }
      case "crash": {
        const why = e.why === "fuel" ? "Out of fuel!" : e.why === "fall" ? "Into the gap!" : e.why === "cargo" ? "Too much lost!" : "Flipped!";
        say(why, e.livesLeft > 0 ? `${e.livesLeft} ${e.livesLeft === 1 ? "life" : "lives"} left · back to the checkpoint` : "No lives left · the delivery starts again", "#FF5D6C", 2000);
        break;
      }
      case "restart": useHaul.getState().restartStage(); break;
      case "respawn": break;
      case "stuck": say("Stuck?", "Back to the checkpoint", "#FFD23F", 1400); break;
      case "deliver": {
        setResult(e.stats);
        const s = useHaul.getState();
        s.setCoins(g?.coins ?? s.coins);
        s.clear(e.stats.stage, e.stats.stars, e.stats.delivered);
        useProfile.getState().earnCoins(3 + e.stats.stars + Math.floor(e.stats.stage / 25));
        if (e.stats.stage % STAGES_PER_WORLD === 0 && e.stats.stage <= DESIGNED_STAGES) sfx("worldClear", { delay: 0.9 });
        track("haul_clear", { stage: e.stats.stage, stars: e.stats.stars });
        break;
      }
    }
  }, [say, toastIt]);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const s = useHaul.getState();
    coinsRef.current = s.coins;
    let flush: ReturnType<typeof setTimeout> | null = null;
    const g = new Game(host.current, {
      truck: s.truck, levels: levelsOf(s, s.truck), lives: s.lives || 3, coins: s.coins,
      onHud: (h) => setHud(h),
      onEvent: (e) => onEventRef.current(e),
      onCoins: (n) => { coinsRef.current = n; if (!flush) flush = setTimeout(() => { flush = null; useHaul.getState().setCoins(coinsRef.current); }, 900); },
      onLives: (n) => useHaul.getState().setLives(n),
      onCheckpoint: (st, cp, carry) => useHaul.getState().reach(st, cp, carry),
    });
    gameRef.current = g;
    g.load(s.stage, s.checkpoint, "attract", s.carry);
    g.start();
    // through the ref: the player hands out a new setLoading when its state changes, which must not rebuild the game
    loadRef.current(null);
    setGameReady(true);
    return () => { if (flush) { clearTimeout(flush); useHaul.getState().setCoins(coinsRef.current); } g.dispose(); gameRef.current = null; setGameReady(false); };
  }, [ready]);

  const nitroOn = !!hud?.powers.some((p) => p.id === "nitro");
  useEffect(() => { music.current?.fever(nitroOn); }, [nitroOn]);

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

  const next = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setResult(null);
    const s = useHaul.getState();
    g.load(s.stage, 0, "intro");
    music.current?.stage(g.course.plan);
  }, []);

  const home = useCallback(() => {
    const g = gameRef.current;
    setResult(null);
    setScreen("home");
    if (g) { const s = useHaul.getState(); g.load(s.stage, s.checkpoint, "attract", s.carry); }
    music.current?.title();
  }, []);

  useEffect(() => {
    setMenu(screen === "play" ? [
      { id: "restart", label: "Restart delivery", onSelect: () => { const g = gameRef.current; if (g) { setResult(null); useHaul.getState().restartStage(); g.load(g.stage, 0, "intro"); } } },
      { id: "garage", label: "Garage", onSelect: () => { home(); setSheet("garage"); } },
      { id: "home", label: "Main menu", onSelect: home },
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
  const intro = hud?.mode === "intro" && screen === "play";
  const playing = screen === "play" && hud && (hud.mode === "play" || hud.mode === "crash");

  return (
    <div className="tt-root" style={{ ["--acc" as string]: acc }} data-slug={slug}>
      <style>{HAUL_CSS}</style>
      <div ref={host} className="tt-stage" />

      {screen === "home" && (
        <div className="tt-ui">
          <div className="tt-home">
            <div className="flex flex-col items-center gap-3">
              <div className="tt-logo" aria-label="Tumble Truck">
                <span className="tt-l1" style={{ ["--c" as string]: "#FFD23F" }}>TUMBLE</span>
                <span className="tt-l2" style={{ ["--c" as string]: "#FF6A2C" }}>TRUCK</span>
              </div>
              <p className="tt-tag">Drive easy · Deliver it all</p>
            </div>
            <div className="flex w-full flex-col items-center gap-3">
              <Ticket plan={plan} checkpoint={save.checkpoint} carry={save.carry} />
              <div className="flex w-[min(420px,100%)] items-center justify-between px-1">
                <span className="tt-pill tt-cap"><CoinIcon />{save.coins.toLocaleString()}</span>
                <span className="tt-pill tt-cap"><StarMini />{save.stars.toLocaleString()}</span>
                <Hearts n={save.lives} of={5} />
              </div>
              <button type="button" className="tt-btn tt-cta tt-shine w-[min(420px,100%)] py-4 text-2xl" onClick={play} disabled={!gameReady}>
                <Play className="size-7 fill-current" /> <span className="tt-display">{save.stage === 1 && save.checkpoint === 0 ? "Start delivering" : save.checkpoint > 0 ? `Resume stage ${save.stage}` : `Stage ${save.stage}`}</span>
              </button>
              <div className="grid w-[min(420px,100%)] grid-cols-3 gap-2">
                <button type="button" className="tt-btn tt-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("garage"); }}><Wrench className="size-5" /> Garage</button>
                <button type="button" className="tt-btn tt-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("worlds"); }}><MapIcon className="size-5" /> Worlds</button>
                <button type="button" className="tt-btn tt-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("help"); }}><HelpCircle className="size-5" /> Help</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "play" && hud && (
        <div className={`tt-hud ${hud.mode === "deliver" || hud.mode === "over" ? "tt-cine" : ""}`}>
          <div className="tt-top">
            <div className="tt-row">
              <div className="tt-chip tt-cap min-w-0">
                <span className="tt-badge">{hud.stage}</span>
                <span className="min-w-0 truncate text-sm leading-tight font-extrabold"><span className="block truncate">{hud.title}</span><span className="block text-[11px] font-bold opacity-70">{hud.distance} m · {hud.speed} km/h</span></span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="tt-pill tt-cap"><CoinIcon />{hud.coins.toLocaleString()}</span>
                <Hearts n={hud.lives} of={Math.max(3, hud.lives)} />
              </div>
            </div>
            <div className="tt-track">
              <b style={{ width: `${hud.progress * 100}%` }} />
              {hud.checkpoints.map((c, i) => <s key={i} className={hud.progress >= c ? "on" : ""} style={{ left: `${c * 100}%` }} />)}
              <em style={{ left: `${hud.progress * 100}%` }}><svg width="16" height="16" viewBox="0 0 24 24"><rect x="2" y="9" width="13" height="7" rx="2" fill={acc} /><rect x="13" y="6" width="7" height="10" rx="2" fill="#FF6A2C" /><circle cx="6.5" cy="17.5" r="3" fill="#24252E" /><circle cx="16.5" cy="17.5" r="3" fill="#24252E" /></svg></em>
              <span className="tt-depot"><Warehouse className="size-5" fill="#FFF9EE" stroke="#1c1430" strokeWidth={2} /></span>
            </div>
            <div className="tt-row">
              <div className={`tt-fuel tt-cap ${hud.lowFuel ? "tt-low" : ""}`}>
                <Fuel className="size-[18px]" stroke={hud.lowFuel ? "#FF6B5A" : "#fff"} strokeWidth={2.4} />
                <span className="tt-fuelbar"><i style={{ width: `${Math.max(2, hud.fuel * 100)}%`, background: hud.fuel > 0.5 ? "linear-gradient(90deg,#3EE08F,#9CFF6B)" : hud.fuel > 0.22 ? "linear-gradient(90deg,#FFB627,#FFE27A)" : "linear-gradient(90deg,#FF3B3B,#FF7A5A)" }} /></span>
              </div>
              <LoadMeter hud={hud} />
            </div>
          </div>
          {hud.powers.length > 0 && (
            <div className="tt-powers">
              {hud.powers.map((p) => (
                <div key={p.id} className="tt-power" title={p.id}>
                  <svg className="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" /><circle cx="22" cy="22" r="19" fill="none" stroke={POWER_COLOR[p.id]} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(p.left / p.secs) * 119.4} 200`} /></svg>
                  {POWER_ICON[p.id]}
                </div>
              ))}
            </div>
          )}
          {Math.abs(hud.wind) > 0.6 && <div className="tt-wind tt-cap"><Wind className="size-4" style={{ transform: hud.wind > 0 ? "none" : "scaleX(-1)" }} /> Wind</div>}
          {!result && (
            <>
              <div className="tt-zone" data-side="brake" style={{ left: 0 }} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
              <div className="tt-zone" data-side="gas" style={{ right: 0 }} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
              <div className="tt-pedals">
                <div className={`tt-pedal brake ${pedal.brake ? "on" : ""}`} data-side="brake" onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="3" /><path d="M8 9h8M8 13h8" /></svg>
                  <small>BRAKE</small>
                </div>
                <div className={`tt-pedal gas ${pedal.gas ? "on" : ""}`} data-side="gas" onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="3" /><path d="M10 7h4M10 11h4M10 15h4" /></svg>
                  <small>GAS</small>
                </div>
              </div>
              {!touchDevice && playing && <div className="tt-keys tt-cap">← A brake · D → gas · tap for gentle speed</div>}
            </>
          )}
          <AnimatePresence>
            {intro && (
              <motion.div key={`intro-${hud.stage}`} className="tt-intro" initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12, scale: 0.96 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                <IntroTicket hud={hud} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {msg && (
          <motion.div key={msg.id} className="tt-pop" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
            <p className="tt-big" style={{ color: msg.color }}>{msg.big}</p>
            {msg.sub && <p className="tt-sub">{msg.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="tt-toast tt-cap" style={{ color: toast.color }} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>{toast.text}</motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{result && <ResultCard key={result.stage} r={result} onNext={next} onHome={home} />}</AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div key="veil" className="tt-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet("")} />
            <motion.div key={sheet} className="tt-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}>
              <div className="tt-grab" />
              <div className="mb-3 flex items-center justify-between">
                <p className="tt-display text-2xl">{sheet === "garage" ? "Garage" : sheet === "worlds" ? "Worlds" : "How to play"}</p>
                <button type="button" aria-label="Close" className="tt-btn tt-ghost size-10 !rounded-full p-0" onClick={() => setSheet("")}><X className="size-5" /></button>
              </div>
              <div className="tt-scroll">
                {sheet === "garage" && <Garage onPick={(id) => gameRef.current?.setTruck(id, levelsOf(useHaul.getState(), id))} />}
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

function StarMini() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3.5l6.2 12.6 13.9 2-10 9.8 2.4 13.8L24 35.2 11.5 41.7l2.4-13.8-10-9.8 13.9-2z" fill="#FFD23F" stroke="#C9781A" strokeWidth="3" strokeLinejoin="round" /></svg>;
}

// ---------------------------------------------------------------- the delivery ticket (home)
function Ticket({ plan, checkpoint, carry }: { plan: StagePlan; checkpoint: number; carry: number }) {
  const w = worldOf(plan.world), local = plan.local;
  const wi = Math.floor((plan.n - 1) / STAGES_PER_WORLD);
  return (
    <div className="tt-ticket">
      <div className="flex items-center justify-between gap-2">
        <span className="tt-kicker">{plan.remix ? `Remix ${plan.remix}` : `World ${wi + 1} · ${w.name}`}</span>
        <span className="text-xs font-extrabold opacity-60">Delivery #{plan.n}</span>
      </div>
      <p className="tt-display mt-2 truncate text-[22px] leading-tight">{plural(plan.count, plan.cargo[0])}{plan.cargo.length > 1 ? ` & ${CARGO[plan.cargo[1]].plural}` : ""}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {Array.from({ length: plan.count }, (_, i) => <CargoIcon key={i} kind={plan.cargo[i % plan.cargo.length]} size={22} />)}
        <span className="ml-1 text-xs font-extrabold opacity-70">deliver at least {plan.need}</span>
      </div>
      <div className="tt-perf" />
      <div className="tt-route"><span className="truncate">{plan.from}</span><i /><Warehouse className="size-4 shrink-0" /><span className="truncate">{plan.to}</span></div>
      <p className="mt-1 truncate text-xs font-bold opacity-65">{plan.subtitle}{checkpoint > 0 ? ` · resume at checkpoint ${checkpoint}${carry ? ` with ${carry} aboard` : ""}` : ""}</p>
      {!plan.remix && (
        <div className="tt-short-hide mt-2">
          <div className="mb-1 flex justify-between text-[11px] font-extrabold opacity-70"><span>Stage {local} of {STAGES_PER_WORLD}</span><span>{plan.n} / {DESIGNED_STAGES}</span></div>
          <div className="tt-progress"><i style={{ width: `${(local / STAGES_PER_WORLD) * 100}%` }} /></div>
        </div>
      )}
    </div>
  );
}

function IntroTicket({ hud }: { hud: Hud }) {
  return (
    <div className="tt-ticket">
      <div className="flex items-center justify-between">
        <span className="tt-kicker">{hud.remix ? "Remix delivery" : `Delivery #${hud.stage}`}</span>
        {hud.big && <span className="text-xs font-black tracking-widest text-[#E8423A] uppercase">Big haul</span>}
      </div>
      <p className="tt-display mt-1.5 text-[24px] leading-tight">{plural(hud.count, hud.cargo[0])}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1">{Array.from({ length: hud.aboard }, (_, i) => <CargoIcon key={i} kind={hud.cargo[i % hud.cargo.length]} size={20} />)}</div>
      <div className="tt-perf" />
      <div className="tt-route"><span className="truncate">{hud.from}</span><i /><Warehouse className="size-4 shrink-0" /><span className="truncate">{hud.to}</span></div>
      <p className="mt-1 text-xs font-extrabold opacity-70">{hud.title} · {hud.subtitle} · deliver at least {hud.need}</p>
      <span className="tt-stamp">GO</span>
    </div>
  );
}

function LoadMeter({ hud }: { hud: Hud }) {
  const slots = [];
  for (let i = 0; i < hud.count; i++) {
    if (i === hud.need) slots.push(<i key="need" className="tt-need" />);
    slots.push(<span key={i} className={`tt-slot ${i < hud.aboard ? "" : "gone"}`}><CargoIcon kind={hud.cargo[i % hud.cargo.length]} size={18} /></span>);
  }
  const danger = hud.aboard <= hud.need && hud.aboard < hud.count;
  return (
    <div className={`tt-load tt-cap ${danger ? "danger" : ""}`} aria-label={`${hud.aboard} of ${hud.count} aboard, need ${hud.need}`}>
      <div className="tt-slots">{slots}</div>
      <span className="ml-1 text-sm font-black">{hud.aboard}/{hud.count}</span>
    </div>
  );
}

// ---------------------------------------------------------------- the delivered card: moves on by itself
function ResultCard({ r, onNext, onHome }: { r: StageStats; onNext: () => void; onHome: () => void }) {
  const worldDone = r.stage % STAGES_PER_WORLD === 0 && r.stage <= DESIGNED_STAGES;
  const secs = worldDone ? 6 : 4.5;
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
    <motion.div className="tt-result-wrap" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div className="tt-result tt-ticket" initial={{ opacity: 0, scale: 0.8, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} onPointerDown={() => setHold(true)}>
        <span className="tt-kicker">{worldDone ? "World complete" : r.stage > DESIGNED_STAGES ? `Remix ${r.stage - DESIGNED_STAGES}` : `Delivery #${r.stage}`}</span>
        <p className="tt-big mt-1" style={{ fontSize: "clamp(34px,10vw,50px)", color: worldDone ? "#FFD23F" : "#FFFFFF" }}>{worldDone ? "World cleared!" : "Delivered!"}</p>
        <div className="tt-stars">{[0, 1, 2].map((i) => <StarIcon key={i} on={i < r.stars} delay={0.15 + i * 0.18} />)}</div>
        <div className="tt-stats">
          <div><b className="inline-flex items-center gap-1"><CargoIcon kind={r.kind} size={20} />{r.delivered}/{r.count}</b><span>Load</span></div>
          <div><b className="inline-flex items-center gap-1"><CoinIcon size={18} />{r.coins + r.bonus}</b><span>Coins</span></div>
          <div><b>{mins}:{String(s).padStart(2, "0")}</b><span>Time</span></div>
        </div>
        {r.delivered === r.count && <p className="mb-2 text-sm font-extrabold text-[#1F9E5A]">Every piece arrived — perfect delivery!</p>}
        <div className="tt-next">
          <div className="tt-count">
            <svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" /><circle cx="22" cy="22" r="19" fill="none" stroke="var(--acc)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(left / secs) * 119.4} 200`} /></svg>
            <b>{hold ? "‖" : Math.ceil(left)}</b>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold tracking-[.14em] uppercase opacity-70">Next delivery {nextPlan.remix ? "· Remix" : `· Stage ${nextPlan.n}`}</p>
            <p className="tt-display truncate text-lg">{plural(nextPlan.count, nextPlan.cargo[0])} → {nextPlan.to}</p>
            <p className="truncate text-xs opacity-75">{nextPlan.title} · {nextPlan.subtitle}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <button type="button" className="tt-btn tt-cta tt-shine py-3 text-lg" onClick={() => { fired.current = true; onNext(); }}><span className="tt-display">Next delivery</span> <ChevronRight className="size-5" /></button>
          <button type="button" className="tt-btn tt-ghost px-4 py-3 text-sm !text-[#1c1430] !bg-[rgba(28,20,48,.08)]" onClick={onHome}>Menu</button>
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
    const w = cv.clientWidth || 230, h = cv.clientHeight || 120;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext("2d")!;
    const flat = new Terrain(-20, 0.5, new Float32Array(81));
    const spec = truckOf(id);
    const R = new Truck(spec);
    R.place(flat, 0);
    R.loadCargo(stackLoad(["crate"], 3, bedLength(spec), 3));
    for (let i = 0; i < 480; i++) R.step(flat, { gas: 0, brake: 0 });
    const sp = new CargoSprites(0);
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const top = R.y + spec.cab.roof + 0.5;
      const sc = Math.min(w / 4.9, (h * 0.86) / top);
      c.save(); c.translate(w / 2, h * 0.9); c.scale(sc, -sc);
      c.translate(-(R.wx[0] + R.wx[1]) / 2, 0);
      drawTruckPreview(c, R, sp, t);
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
  const s = useHaul();
  const [view, setView] = useState<TruckId>(s.truck);
  const v = truckOf(view), owned = s.owned.includes(view), lv = levelsOf(s, view), t = tuned(v, lv);
  const full = { engine: MAX_LEVEL, suspension: MAX_LEVEL, tires: MAX_LEVEL, tank: MAX_LEVEL, padding: MAX_LEVEL };
  const maxP = Math.max(...TRUCKS.map((x) => tuned(x, full).torque / x.chassis.mass));
  return (
    <div>
      <div className="tt-trucks">
        {TRUCKS.map((x) => (
          <button type="button" key={x.id} className={`tt-truck ${view === x.id ? "sel" : ""}`} onClick={() => { sfx("tap"); setView(x.id); }}>
            <TruckCanvas id={x.id} />
            <p className="tt-display mt-1 text-lg">{x.name}</p>
            <p className="text-xs font-bold opacity-75">{s.owned.includes(x.id) ? (s.truck === x.id ? "Driving" : "Owned") : <span className="inline-flex items-center gap-1"><CoinIcon size={14} />{x.price.toLocaleString()}</span>}</p>
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm opacity-85">{v.tagline}</p>
      <div className="mt-2 grid gap-1.5">
        <Stat label="Power" v={(t.torque / t.chassis.mass) / maxP} />
        <Stat label="Grip" v={t.grip / 1.85} />
        <Stat label="Soft ride" v={(t.wheel.c / t.wheel.k) / 0.14} />
        <Stat label="Side boards" v={t.bed.wall / 0.7} />
        <Stat label="Fuel" v={t.fuel / 240} />
      </div>
      {owned ? (
        <>
          {s.truck !== view && <button type="button" className="tt-btn tt-cta mt-3 w-full py-3" onClick={() => { s.select(view); onPick(view); sfx("buy"); }}>Drive the {v.name}</button>}
          {UPGRADES.map((u) => {
            const level = lv[u.id], cost = upgradeCost(v, level), max = level >= MAX_LEVEL;
            return (
              <div key={u.id} className="tt-up">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{u.label}</p>
                  <p className="text-xs opacity-70">{u.hint}</p>
                  <div className="tt-dots">{Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < level ? "on" : ""} />)}</div>
                </div>
                <button type="button" disabled={max || s.coins < cost} className={`tt-btn ${max ? "tt-ghost" : "tt-cta"} px-3 py-2 text-sm`}
                  onClick={() => { if (s.upgrade(view, u.id)) { sfx("upgrade"); if (s.truck === view) onPick(view); } }}>
                  {max ? <><Check className="size-4" /> Max</> : <><CoinIcon size={16} />{cost.toLocaleString()}</>}
                </button>
              </div>
            );
          })}
        </>
      ) : (
        <button type="button" disabled={s.coins < v.price} className="tt-btn tt-cta mt-3 w-full py-3" onClick={() => { if (s.buy(view)) { sfx("buy"); onPick(view); } }}>
          {s.coins < v.price ? <><Lock className="size-4" /> Need <CoinIcon size={16} />{(v.price - s.coins).toLocaleString()} more</> : <>Buy for <CoinIcon size={16} />{v.price.toLocaleString()}</>}
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
      <div className="tt-worlds">
        {WORLDS.map((w, i) => {
          const done = Math.max(0, Math.min(STAGES_PER_WORLD, stage - 1 - i * STAGES_PER_WORLD));
          const lock = i > cur && stage <= DESIGNED_STAGES;
          return (
            <div key={w.id} className={`tt-world ${lock ? "lock" : ""} ${i === cur && stage <= DESIGNED_STAGES ? "now" : ""}`}>
              <WorldThumb index={i} />
              <span className="tt-wc"><CargoIcon kind={w.cargo} size={24} /></span>
              <div className="tt-wl">
                <p className="truncate">{lock ? <Lock className="mr-1 inline size-3.5" /> : null}{w.name}</p>
                <p className="text-[11px] font-bold opacity-80">{done}/{STAGES_PER_WORLD} · {CARGO[w.cargo].plural}{w.gravity < 9 ? " · low gravity" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm font-bold opacity-80">{stage > DESIGNED_STAGES ? `All 600 deliveries done! You're on remix ${stage - DESIGNED_STAGES} — they never end.` : "Finish all 600 deliveries to unlock endless remixes."}</p>
    </div>
  );
}

function Help({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="grid gap-2 text-[15px]">
      {[
        [<Play key="i" className="size-5" fill="#3EE08F" stroke="none" />, "Hold the right side (or → / D) for gas. Hold the left side (or ← / A) to brake and reverse. Tap the gas for a gentle speed."],
        [<CargoIcon key="i" kind="crate" size={22} />, "Your load rides loose in the open bed. Bumps, crests and hard braking throw it out — drive easy and keep it in."],
        [<CargoIcon key="i" kind="jar" size={22} />, "Fragile loads (jars, eggs, vases, potions, crystals) break on hard knocks. Land softly!"],
        [<Flag key="i" className="size-5" fill="#fff" stroke="none" />, "Each delivery needs a minimum number of pieces. Deliver everything for three stars. Checkpoints save your load."],
        [<Fuel key="i" className="size-5" stroke="#FF6B5A" />, "Fuel runs down as you drive. Grab the red cans to fill up."],
        [<Heart key="i" className="size-5" fill="#FF4F7A" stroke="none" />, "A flip, a fall, an empty tank or too much lost costs a life. Hearts give you lives."],
        [<Grid3x3 key="i" className="size-5" stroke="#3EE08F" />, "Power-ups: Nitro, a Cargo net that keeps everything in, Bubble wrap for fragile loads, a coin Magnet and Coins ×2."],
        [<Wind key="i" className="size-5" stroke="#BFE6FF" />, "Watch out for mud, ice, water crossings, rope bridges and gusty wind."],
        [<CoinIcon key="i" size={20} />, "Spend coins in the Garage on new trucks and upgrades — softer suspension and cargo padding help a lot."],
      ].map(([i, t], k) => (
        <div key={k} className="flex items-start gap-3 rounded-2xl bg-white/[.06] p-3"><span className="mt-0.5 shrink-0">{i}</span><span>{t}</span></div>
      ))}
      <button type="button" className="tt-btn tt-cta mt-2 py-3 text-lg" onClick={onPlay}><Play className="size-5 fill-current" /> Let&apos;s deliver</button>
    </div>
  );
}
