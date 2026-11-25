"use client";
// Gizmo Drive: the screens around the game canvas — the home screen over a live demo drive of your current stage, the
// HUD (stage, progress with checkpoints, fuel, coins, lives, power timers), the thumb pedals (side by side on the web),
// the cinematic stage card during the fly-over ("New gizmo!"), the stage-clear card with stars that moves on to the
// next stage by itself, the garage (paint jobs and the rides you've met) and the world map.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Map as MapIcon, Play, Paintbrush, HelpCircle, X, Lock, Check, ChevronRight, Heart, Fuel, Zap, Shield, Magnet, Feather, CircleDot, Flag, Sparkles } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { useProfile } from "@/lib/store";
import { Game, type GameEvent, type Hud, type StageStats } from "../game";
import { stagePlan } from "../stages";
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, worldOf } from "../worlds";
import { PAINTS, VEHICLES, colorsOf, paintOf, topSpeed, vehicleOf, type PaintId, type VehicleId } from "../vehicles";
import { useGizmo, useGizmoHydrated } from "../save";
import { MENU_SOUNDS, GIZMO_SOUNDS, sfx } from "../sound";
import { GizmoMusic } from "../music";
import { Car, World } from "../physics";
import { drawCarPreview } from "../art/car-art";
import { lookFor } from "../art/look";
import { paintBackdrop, STRIP_H, STRIP_W } from "../art/backdrop";
import { powerColor } from "../art/items";
import { GIZMO_CSS } from "./styles";

type Sheet = "" | "garage" | "worlds" | "help";
interface Msg { id: number; big: string; sub?: string; color?: string }

/** drawn icons (emoji differ from phone to phone, and older systems lack them) */
function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12.6" r="10.5" fill="#B87309" /><circle cx="12" cy="12" r="10.5" fill="#FFD23F" /><circle cx="12" cy="12" r="7.4" fill="none" stroke="#E8A317" strokeWidth="1.7" />
      <ellipse cx="8.4" cy="7.9" rx="2.4" ry="1.2" fill="#FFF6C8" transform="rotate(-35 8.4 7.9)" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg className="gear" viewBox="0 0 100 100" aria-hidden="true">
      <path fill="#FFC233" stroke="#14102a" strokeWidth="7" d="M43 6h14l3 13 9 4 11-7 10 10-7 11 4 9 13 3v14l-13 3-4 9 7 11-10 10-11-7-9 4-3 13H43l-3-13-9-4-11 7-10-10 7-11-4-9-13-3V43l13-3 4-9-7-11 10-10 11 7 9-4z" />
      <circle cx="50" cy="50" r="15" fill="#14102a" />
    </svg>
  );
}
function Star({ on, delay }: { on: boolean; delay: number }) {
  return (
    <motion.svg viewBox="0 0 24 24" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay, type: "spring", stiffness: 380, damping: 14 }}>
      <path d="M12 2.2l2.9 6.2 6.7.8-5 4.6 1.3 6.7L12 17.2l-5.9 3.3 1.3-6.7-5-4.6 6.7-.8z" fill={on ? "#FFD23F" : "rgba(255,255,255,.15)"} stroke={on ? "#B87309" : "rgba(255,255,255,.25)"} strokeWidth="1.4" strokeLinejoin="round" />
    </motion.svg>
  );
}
const Hearts = ({ n, of }: { n: number; of: number }) => (
  <span className="gz-hearts">{Array.from({ length: of }, (_, i) => <Heart key={i} className={`size-[17px] ${i < n ? "" : "opacity-30"}`} fill={i < n ? "#FF4F7A" : "rgba(255,255,255,.4)"} stroke={i < n ? "#B0183F" : "none"} strokeWidth={1.5} />)}</span>
);
const POWER_ICON: Record<string, React.ReactNode> = {
  turbo: <Zap className="size-5" fill="#FFD23F" stroke="#FF6B3D" />, shield: <Shield className="size-5" fill="#7FC4FF" stroke="#2E9BFF" />,
  magnet: <Magnet className="size-5" stroke="#FF4F7A" strokeWidth={2.6} />, float: <Feather className="size-5" stroke="#A78BFA" strokeWidth={2.4} />, grip: <CircleDot className="size-5" stroke="#3EE08F" strokeWidth={2.6} />,
};
const POWER_NAME: Record<string, string> = { turbo: "Turbo!", shield: "Helmet shield!", magnet: "Coin magnet!", float: "Floaty jumps!", grip: "Sticky tyres!" };

export default function GizmoApp({ slug }: { slug: string; title: string }) {
  const ready = useGizmoHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const save = useGizmo();
  const [screen, setScreen] = useState<"home" | "play">("home");
  const [sheet, setSheet] = useState<Sheet>("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; color: string } | null>(null);
  const [result, setResult] = useState<StageStats | null>(null);
  const [pedal, setPedal] = useState({ gas: false, brake: false });
  const [keyPedal, setKeyPedal] = useState({ gas: false, brake: false });
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
  const toastIt = useCallback((text: string, color = "#4DF2C4") => {
    const id = Math.random();
    setToast({ id, text, color });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1500);
  }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Tightening the bolts");
    void audio.preload(MENU_SOUNDS);
    // the site's own music player stays quiet: Gizmo Drive's music is composed live (src/gizmo/music.ts)
    void audio.stopMusic(0.2);
  }, []);
  const music = useRef<GizmoMusic | null>(null);
  useEffect(() => {
    const m = new GizmoMusic();
    music.current = m;
    m.title();
    return () => { m.dispose(); music.current = null; };
  }, []);

  const onEvent = useCallback((e: GameEvent) => {
    const g = gameRef.current;
    switch (e.k) {
      case "go":
        say("GO!", undefined, "#4DF2C4", 900);
        if (!useGizmo.getState().seenHelp) { setTimeout(() => toastIt(window.matchMedia("(pointer: coarse)").matches ? "Right = gas · Left = brake" : "→ gas · ← brake", "#FFD23F"), 1000); useGizmo.getState().sawHelp(); }
        break;
      case "checkpoint": toastIt("Checkpoint!"); break;
      case "flip": say(e.n > 1 ? `${e.n}× Flip!` : "Flip!", `+${e.coins} coins`, "#FFD23F", 1100); break;
      case "air": toastIt(`Big air! +${e.coins}`, "#7CF5FF"); break;
      case "lowFuel": toastIt("Low oil — grab a can!", "#FF6B5A"); break;
      case "gizmo": say("New gizmo!", e.name, "#B79CFF", 1600); break;
      case "ride": useGizmo.getState().meet(e.id); break;
      case "pickup":
        if (e.what === "fuel") toastIt("Tank full!", "#FF6B5A");
        else if (e.what === "heart") toastIt("+1 life!", "#FF5D8F");
        else if (e.what === "star") toastIt("Star coin +10!", "#B79CFF");
        else toastIt(POWER_NAME[e.what], powerColor(e.what));
        break;
      case "crash": {
        const why = e.why === "fuel" ? "Out of oil!" : e.why === "fall" ? "Splash!" : e.why === "roof" ? "Flipped!" : "Bonk!";
        say(why, e.livesLeft > 0 ? `${e.livesLeft} ${e.livesLeft === 1 ? "life" : "lives"} left · back to the checkpoint` : "No lives left · back one more checkpoint", "#FF5D6C", 2000);
        break;
      }
      case "stuck": say("Stuck?", "Back to the checkpoint", "#FFD23F", 1400); break;
      case "finish": {
        setResult(e.stats);
        const s = useGizmo.getState();
        s.setCoins(g?.coins ?? s.coins);
        s.clear(e.stats.stage, e.stats.flips, e.stats.stars);
        useProfile.getState().earnCoins(4 + Math.floor(e.stats.stage / 25));
        if (e.stats.stage % STAGES_PER_WORLD === 0 && e.stats.stage <= DESIGNED_STAGES) sfx("worldClear", { delay: 0.6 });
        track("gizmo_clear", { stage: e.stats.stage, stars: e.stats.stars });
        break;
      }
      default: break;
    }
  }, [say, toastIt]);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const s = useGizmo.getState();
    coinsRef.current = s.coins;
    let flush: ReturnType<typeof setTimeout> | null = null;
    const g = new Game(host.current, {
      paint: s.paint, lives: s.lives || 3, coins: s.coins,
      onHud: (h) => setHud(h),
      onEvent: (e) => onEventRef.current(e),
      onCoins: (n) => { coinsRef.current = n; if (!flush) flush = setTimeout(() => { flush = null; useGizmo.getState().setCoins(coinsRef.current); }, 900); },
      onLives: (n) => useGizmo.getState().setLives(n),
      onCheckpoint: (st, cp) => useGizmo.getState().reach(st, cp),
      onKeys: (gas, brake) => setKeyPedal({ gas, brake }),
    });
    gameRef.current = g;
    g.load(s.stage, s.checkpoint, "attract");
    g.attract();
    g.start();
    // the rest of the sounds load in the background
    void audio.preload(GIZMO_SOUNDS.filter((x) => !MENU_SOUNDS.includes(x)));
    // through the ref: the player hands out a new setLoading when its state changes, and that must not rebuild the game
    loadRef.current(null);
    setGameReady(true);
    return () => { if (flush) { clearTimeout(flush); useGizmo.getState().setCoins(coinsRef.current); } g.dispose(); gameRef.current = null; setGameReady(false); };
  }, [ready]);

  const turboOn = !!hud?.powers.some((p) => p.id === "turbo");
  useEffect(() => { music.current?.fever(turboOn); }, [turboOn]);

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
    // keyboard focus belongs to the game (inside a game page's frame too)
    window.focus();
    const s = useGizmo.getState();
    g.load(s.stage, s.checkpoint, "preview");
    g.play();
    music.current?.stage(g.course.plan);
  }, []);

  const next = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setResult(null);
    const s = useGizmo.getState();
    g.load(s.stage, 0, "preview");
    g.play();
    music.current?.stage(g.course.plan);
    // look ahead: the stage after this one's song is composed live, nothing to download
  }, []);

  const home = useCallback(() => {
    const g = gameRef.current;
    setResult(null);
    setScreen("home");
    if (g) { const s = useGizmo.getState(); g.load(s.stage, s.checkpoint, "attract"); g.attract(); }
    music.current?.title();
  }, []);

  const restart = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setResult(null);
    g.load(g.stage, 0, "intro");
    g.play();
  }, []);

  useEffect(() => {
    setMenu(screen === "play" ? [
      { id: "restart", label: "Restart stage", onSelect: restart },
      { id: "garage", label: "Garage", onSelect: () => { home(); setSheet("garage"); } },
      { id: "home", label: "Main menu", onSelect: home },
    ] : []);
  }, [screen, setMenu, home, restart]);

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

  // the keyboard on the menus: → / D / Enter / Space plays the stage, and on the stage-clear card moves on
  const nextRef = useRef<() => void>(() => {});
  useEffect(() => {
    const on = (e: KeyboardEvent | { key: string; code: string; down: boolean }) => {
      const down = "type" in e ? e.type === "keydown" : e.down;
      if (!down) return;
      const go = e.key === "Enter" || e.key === " " || e.key === "ArrowRight" || e.code === "ArrowRight" || e.code === "KeyD";
      if (!go || sheet) return;
      if (screen === "home" && gameReady) { if ("preventDefault" in e) e.preventDefault(); play(); }
      else if (screen === "play" && result) { if ("preventDefault" in e) e.preventDefault(); nextRef.current(); }
    };
    const onMsg = (m: MessageEvent) => { if (m.origin === window.location.origin && m.data?.type === "momoblobs:key") on({ key: m.data.key ?? "", code: m.data.code ?? "", down: !!m.data.down }); };
    window.addEventListener("keydown", on);
    window.addEventListener("message", onMsg);
    return () => { window.removeEventListener("keydown", on); window.removeEventListener("message", onMsg); };
  }, [screen, sheet, result, gameReady, play]);

  // ---------------------------------------------------------------- render
  const plan = stagePlan(save.stage);
  const acc = hud?.accent ?? worldOf(plan.world).accent;
  const intro = (hud?.mode === "intro" || hud?.mode === "preview") && screen === "play";
  const stars = save.stars.reduce((a, b) => a + b, 0);

  return (
    <div className="gz-root" style={{ ["--acc" as string]: acc }} data-slug={slug} onPointerDown={() => window.focus()}>
      <style>{GIZMO_CSS}</style>
      <div ref={host} className="gz-stage" />

      {screen === "home" && (
        <div className="gz-ui">
          <div className="gz-home">
            <div className="flex flex-col items-center gap-3">
              <div className="gz-logo" aria-label="Gizmo Drive">
                <div className="w l1">{"GIZ".split("").map((ch, i) => <span key={i} style={{ ["--c" as string]: "#4DF2C4", animationDelay: `${i * 0.05}s` }}>{ch}</span>)}<span style={{ ["--c" as string]: "#4DF2C4", animationDelay: ".15s" }}>M</span><span style={{ ["--c" as string]: "#4DF2C4", animationDelay: ".2s" }}><GearIcon /></span></div>
                <div className="w l2">{"DRIVE".split("").map((ch, i) => <span key={i} style={{ ["--c" as string]: "#B79CFF", animationDelay: `${0.25 + i * 0.05}s` }}>{ch}</span>)}</div>
              </div>
              <p className="gz-tag">Don&apos;t flip · Reach the flag</p>
            </div>
            <div className="gz-low flex w-full flex-col items-center gap-3">
              <div className="gz-card gz-panel">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold tracking-[.16em] uppercase opacity-70">{plan.remix ? "Endless remix" : `World ${Math.floor((save.stage - 1) / STAGES_PER_WORLD) + 1} of 12`}</p>
                    <p className="gz-display truncate text-2xl">{plan.title}</p>
                    <p className="flex items-center gap-2 truncate text-sm opacity-85"><span className="gz-ride"><i />{vehicleOf(plan.vehicle).name}</span>{plan.subtitle}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="gz-pill gz-panel"><CoinIcon />{save.coins.toLocaleString()}</span>
                    <Hearts n={save.lives} of={5} />
                  </div>
                </div>
                {!plan.remix && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs font-bold opacity-80"><span>Stage {plan.local} of {STAGES_PER_WORLD}</span><span className="inline-flex items-center gap-1"><Sparkles className="size-3.5" />{stars} stars · {save.stage}/{DESIGNED_STAGES}</span></div>
                    <div className="gz-progress"><i style={{ width: `${(plan.local / STAGES_PER_WORLD) * 100}%` }} /></div>
                  </div>
                )}
              </div>
              <button type="button" className="gz-play gz-btn gz-cta gz-shine w-[min(430px,100%)] py-4 text-2xl" onClick={play} disabled={!gameReady}>
                <Play className="size-7 fill-current" /> <span className="gz-display">{save.stage === 1 && save.checkpoint === 0 ? "Play" : `Stage ${save.stage}`}</span>
                {save.checkpoint > 0 && <span className="text-sm font-extrabold opacity-80">· checkpoint {save.checkpoint}</span>}
              </button>
              <div className="gz-more grid w-[min(430px,100%)] grid-cols-3 gap-2">
                <button type="button" className="gz-btn gz-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("garage"); }}><Paintbrush className="size-5" /> Garage</button>
                <button type="button" className="gz-btn gz-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("worlds"); }}><MapIcon className="size-5" /> Worlds</button>
                <button type="button" className="gz-btn gz-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("help"); }}><HelpCircle className="size-5" /> Help</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "play" && hud && (
        <div className="gz-hud">
          <div className="gz-top">
            <div className="flex min-w-0 flex-col">
              <div className="gz-chip gz-panel">
                <span className="gz-badge">{hud.stage > DESIGNED_STAGES ? "R" : hud.stage}</span>
                <span className="min-w-0 truncate text-sm leading-tight font-extrabold"><span className="block truncate">{hud.title}</span><span className="block text-[11px] font-bold opacity-70">{hud.ride}</span></span>
              </div>
              <div className={`gz-fuel gz-panel ${hud.lowFuel ? "gz-low" : ""}`}>
                <Fuel className="size-[18px]" stroke={hud.lowFuel ? "#FF6B5A" : "#fff"} strokeWidth={2.4} />
                <span className="gz-fuelbar"><i style={{ width: `${Math.max(2, hud.fuel * 100)}%`, background: hud.fuel > 0.5 ? "linear-gradient(90deg,#16D3A6,#B8FFE9)" : hud.fuel > 0.25 ? "linear-gradient(90deg,#FFB627,#FFE27A)" : "linear-gradient(90deg,#FF3B3B,#FF7A5A)" }} /></span>
              </div>
            </div>
            <div className="gz-trackrow mt-1 min-w-0 flex-1">
              <div className="gz-track">
                <b style={{ width: `${hud.progress * 100}%` }} />
                {hud.checkpoints.map((c, i) => <s key={i} className={hud.progress >= c ? "on" : ""} style={{ left: `${c * 100}%` }} />)}
                <em style={{ left: `${hud.progress * 100}%` }}><i className="block size-2.5 rounded-full" style={{ background: "var(--acc)" }} /></em>
                <Flag className="gz-flag size-4" fill="#fff" stroke="#14102a" strokeWidth={2} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="gz-pill gz-panel"><CoinIcon />{hud.coins.toLocaleString()}</span>
              <Hearts n={hud.lives} of={Math.max(3, hud.lives)} />
            </div>
          </div>
          {hud.powers.length > 0 && (
            <div className="gz-powers">
              {hud.powers.map((p) => (
                <div key={p.id} className="gz-power" title={p.id}>
                  <svg className="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" /><circle cx="22" cy="22" r="19" fill="none" stroke={powerColor(p.id)} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(p.left / p.secs) * 119.4} 200`} /></svg>
                  {POWER_ICON[p.id]}
                </div>
              ))}
            </div>
          )}
          {!result && (
            <>
              <div className="gz-zone" data-side="brake" style={{ left: 0 }} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
              <div className="gz-zone" data-side="gas" style={{ right: 0 }} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
              <div className="gz-pedals">
                <div className={`gz-pedal brake ${pedal.brake || keyPedal.brake ? "on" : ""}`} data-side="brake" onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
                  <small>BRAKE</small>
                </div>
                <div className={`gz-pedal gas ${pedal.gas || keyPedal.gas ? "on" : ""}`} data-side="gas" onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                  <small>GAS</small>
                </div>
              </div>
              {!touchDevice && <div className="gz-keys gz-panel"><kbd>←</kbd> / <kbd>A</kbd> brake · <kbd>→</kbd> / <kbd>D</kbd> gas · in the air they tilt</div>}
            </>
          )}
          <AnimatePresence>
            {intro && (
              <motion.div key={`intro-${hud.stage}`} className="gz-intro" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 1.08 }} transition={{ duration: 0.35 }}>
                <span className="gz-kicker">{hud.remix ? "Remix" : `Stage ${hud.stage}`}</span>
                <p className="gz-big mt-2">{hud.title}</p>
                <p className="gz-sub">{hud.subtitle} · {hud.ride}{hud.summit ? " · Big course" : ""}</p>
                {hud.fresh && <p><span className="gz-new"><Sparkles className="size-4" /> New gizmo: {hud.fresh}</span></p>}
              </motion.div>
            )}
          </AnimatePresence>
          {hud.mode === "preview" && (
            <button type="button" className="gz-skip gz-panel" onClick={() => gameRef.current?.skip()}>Tap to skip</button>
          )}
        </div>
      )}

      <AnimatePresence>
        {msg && (
          <motion.div key={msg.id} className="gz-pop" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.25 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
            <p className="gz-big" style={{ color: msg.color }}>{msg.big}</p>
            {msg.sub && <p className="gz-sub">{msg.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="gz-toast gz-panel" style={{ color: toast.color }} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>{toast.text}</motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{result && <ResultCard key={result.stage} r={result} onNext={next} onHome={home} onRetry={restart} nextRef={nextRef} />}</AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div key="veil" className="gz-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet("")} />
            <motion.div key={sheet} className="gz-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}>
              <div className="grab" />
              <div className="mb-3 flex items-center justify-between">
                <p className="gz-display text-2xl">{sheet === "garage" ? "Garage" : sheet === "worlds" ? "Worlds" : "How to play"}</p>
                <button type="button" aria-label="Close" className="gz-btn gz-ghost size-10 !rounded-full p-0" onClick={() => setSheet("")}><X className="size-5" /></button>
              </div>
              <div className="gz-scroll">
                {sheet === "garage" && <Garage onPaint={(p) => gameRef.current?.setPaint(p)} />}
                {sheet === "worlds" && <Worlds stage={save.stage} stars={save.stars} />}
                {sheet === "help" && <Help onPlay={play} />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ the stage-clear card: moves on by itself
function ResultCard({ r, onNext, onHome, onRetry, nextRef }: { r: StageStats; onNext: () => void; onHome: () => void; onRetry: () => void; nextRef: React.MutableRefObject<() => void> }) {
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
  // Enter / → on the keyboard moves on at once
  useEffect(() => { nextRef.current = () => { if (!fired.current) { fired.current = true; onNext(); } }; return () => { nextRef.current = () => {}; }; }, [nextRef, onNext]);
  const mins = Math.floor(r.time / 60), s = Math.round(r.time % 60);
  return (
    // the wrapper centres the card (the card's own transform belongs to its pop-in animation)
    <motion.div className="gz-result-wrap" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div className="gz-result gz-panel" initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} onPointerDown={() => setHold(true)}>
        <p className="text-xs font-extrabold tracking-[.18em] uppercase opacity-70">{worldDone ? "World complete" : r.stage > DESIGNED_STAGES ? `Remix ${r.stage - DESIGNED_STAGES}` : `Stage ${r.stage}`}</p>
        <p className="gz-big" style={{ fontSize: "clamp(34px,10vw,52px)", color: worldDone ? "#FFD23F" : "#fff" }}>{worldDone ? "World cleared!" : "Stage clear!"}</p>
        <div className="gz-stars">{[1, 2, 3].map((k) => <Star key={k} on={r.stars >= k} delay={0.25 + k * 0.18} />)}</div>
        <div className="gz-stats">
          <div><b className="!flex items-center justify-center gap-1"><CoinIcon size={20} />{r.coins}</b><span>Coins</span></div>
          <div><b>{mins}:{String(s).padStart(2, "0")}</b><span>Time</span></div>
          <div><b>{r.flips}</b><span>Flips</span></div>
        </div>
        {r.crashes === 0 && <p className="mb-2 text-sm font-extrabold text-[#4DF2C4]">Clean run — no crashes!</p>}
        <div className="flex items-center gap-3 rounded-2xl bg-white/[.07] p-3 text-left">
          <div className="gz-count">
            <svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" /><circle cx="22" cy="22" r="19" fill="none" stroke="var(--acc)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(left / secs) * 119.4} 200`} /></svg>
            <b>{hold ? "‖" : Math.ceil(left)}</b>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold tracking-[.14em] uppercase opacity-70">Next up {nextPlan.remix ? "· Remix" : `· Stage ${nextPlan.n}`}</p>
            <p className="gz-display truncate text-xl">{nextPlan.title}</p>
            <p className="truncate text-xs opacity-75">{vehicleOf(nextPlan.vehicle).name} · {nextPlan.subtitle}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
          <button type="button" className="gz-btn gz-cta gz-shine py-3 text-lg" onClick={() => { fired.current = true; onNext(); }}><span className="gz-display">Next stage</span> <ChevronRight className="size-5" /></button>
          <button type="button" className="gz-btn gz-ghost px-3 py-3 text-sm" onClick={() => { fired.current = true; onRetry(); }}>Retry</button>
          <button type="button" className="gz-btn gz-ghost px-3 py-3 text-sm" onClick={() => { fired.current = true; onHome(); }}>Menu</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ------------------------------------------------------------------ garage: paint jobs and rides
function RideCanvas({ id, paint }: { id: VehicleId; paint: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1); // perf-ok: a small menu thumbnail, drawn on demand
    const w = cv.clientWidth || 200, h = cv.clientHeight || 92;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext("2d")!;
    const world = new World();
    world.poly(world.bodies[0], [-20, 0, 20, 0, 20, -2, -20, -2], true);
    world.finalize();
    const car = new Car(vehicleOf(id));
    car.place(0, () => 0);
    for (let i = 0; i < 300; i++) world.step(car, { gas: 0, brake: 0 });
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const top = car.y + car.spec.head.y + car.spec.head.r * 1.3;
      const sc = Math.min(w / (car.spec.chassis.w + 1.6), (h * 0.84) / top);
      c.save(); c.translate(w / 2, h * 0.9); c.scale(sc, -sc);
      c.fillStyle = "rgba(0,0,0,0.3)"; c.beginPath(); c.ellipse(0, 0, car.spec.chassis.w * 0.62, 0.12, 0, 0, Math.PI * 2); c.fill();
      c.translate(-car.x, 0);
      drawCarPreview(c, car, t, paint);
      c.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [id, paint]);
  return <canvas ref={ref} />;
}

function Garage({ onPaint }: { onPaint: (p: PaintId) => void }) {
  const s = useGizmo();
  const [tab, setTab] = useState<"paint" | "rides">("paint");
  const [view, setView] = useState<PaintId>(s.paint);
  const ride = (stagePlan(s.stage).vehicle) as VehicleId;
  const maxTop = Math.max(...VEHICLES.map((v) => topSpeed(v)));
  const p = paintOf(view), owned = s.paints.includes(view);
  return (
    <div>
      <div className="gz-tabs"><button type="button" className={tab === "paint" ? "on" : ""} onClick={() => { sfx("tap"); setTab("paint"); }}>Paint shop</button><button type="button" className={tab === "rides" ? "on" : ""} onClick={() => { sfx("tap"); setTab("rides"); }}>Rides · {s.rides.length}/{VEHICLES.length}</button></div>
      {tab === "paint" ? (
        <>
          <div className="gz-tile sel mb-3"><RideCanvas id={ride} paint={view} /><p className="gz-display mt-1 text-lg">{p.name}</p><p className="text-xs font-bold opacity-75">Your next ride: {vehicleOf(ride).name}</p></div>
          <div className="gz-grid">
            {PAINTS.map((q) => {
              const col = colorsOf(vehicleOf(ride), q);
              return (
                <button type="button" key={q.id} className={`gz-tile ${view === q.id ? "sel" : ""}`} onClick={() => { sfx("tap"); setView(q.id); }}>
                  <span className="gz-swatch" style={{ background: q.pattern === "rainbow" ? "linear-gradient(90deg,#FF5A5F,#FFB72B,#FFE14D,#3EE08F,#38BDF8,#8B5CF6)" : `linear-gradient(135deg,${col.body} 0 60%,${col.accent} 60% 75%,${col.trim} 75%)` }} />
                  <p className="mt-1 truncate text-sm font-extrabold">{q.name}</p>
                  <p className="text-xs font-bold opacity-75">{s.paints.includes(q.id) ? (s.paint === q.id ? "Wearing" : "Owned") : <span className="inline-flex items-center gap-1"><CoinIcon size={13} />{q.price.toLocaleString()}</span>}</p>
                </button>
              );
            })}
          </div>
          {owned ? (
            s.paint !== view && <button type="button" className="gz-btn gz-cta mt-3 w-full py-3" onClick={() => { s.wear(view); onPaint(view); sfx("buy"); }}><Check className="size-5" /> Use {p.name}</button>
          ) : (
            <button type="button" disabled={s.coins < p.price} className="gz-btn gz-violet mt-3 w-full py-3" onClick={() => { if (s.buy(view)) { sfx("buy"); onPaint(view); } }}>
              {s.coins < p.price ? <><Lock className="size-4" /> Need <CoinIcon size={16} />{(p.price - s.coins).toLocaleString()} more</> : <>Buy for <CoinIcon size={16} />{p.price.toLocaleString()}</>}
            </button>
          )}
          <p className="mt-3 flex items-center justify-center gap-1 text-sm font-bold opacity-80">You have <CoinIcon size={16} />{s.coins.toLocaleString()}</p>
        </>
      ) : (
        <div className="gz-grid">
          {VEHICLES.map((v) => {
            const met = s.rides.includes(v.id);
            return (
              <div key={v.id} className={`gz-tile ${met ? "" : "lock"}`}>
                <RideCanvas id={v.id} paint={s.paint} />
                <p className="gz-display mt-1 text-lg">{met ? v.name : "???"}</p>
                <p className="min-h-[2.4em] text-xs opacity-80">{met ? v.blurb : "Meet it in a stage to unlock."}</p>
                {met && (
                  <div className="mt-1 grid gap-1">
                    <div className="gz-stat"><span className="w-10 opacity-70">Speed</span><b style={{ width: `${(topSpeed(v) / maxTop) * 70}%` }} /></div>
                    <div className="gz-stat"><span className="w-10 opacity-70">Grip</span><b style={{ width: `${(v.grip / 1.4) * 70}%` }} /></div>
                    <div className="gz-stat"><span className="w-10 opacity-70">Spin</span><b style={{ width: `${(v.airControl / 10.5) * 70}%` }} /></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
      const plan = stagePlan(index * STAGES_PER_WORLD + 4);
      const look = lookFor(plan);
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, look.sky[0]); g.addColorStop(0.55, look.sky[1]); g.addColorStop(1, look.sky[2]);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const strips = paintBackdrop(look, 0.3);
      strips.forEach((s, i) => {
        const bottom = H * [0.78, 0.9, 1.0][i];
        const sh = H * 1.05, sw = sh * (STRIP_W / STRIP_H);
        c.drawImage(s.canvas, 0, 0, s.canvas.width * (W / sw), s.canvas.height, 0, bottom - sh, W, sh);
      });
    }, 40 + index * 70);
    return () => { alive = false; clearTimeout(id); };
  }, [index]);
  return <canvas ref={ref} />;
}

function Worlds({ stage, stars }: { stage: number; stars: number[] }) {
  const cur = Math.floor((Math.min(stage, DESIGNED_STAGES) - 1) / STAGES_PER_WORLD);
  return (
    <div>
      <div className="gz-worlds">
        {WORLDS.map((w, i) => {
          const done = Math.max(0, Math.min(STAGES_PER_WORLD, stage - 1 - i * STAGES_PER_WORLD));
          const st = stars.slice(i * STAGES_PER_WORLD, (i + 1) * STAGES_PER_WORLD).reduce((a, b) => a + b, 0);
          const lock = i > cur && stage <= DESIGNED_STAGES;
          return (
            <div key={w.id} className={`gz-world ${lock ? "lock" : ""} ${i === cur && stage <= DESIGNED_STAGES ? "now" : ""}`}>
              <WorldThumb index={i} />
              <div className="wl">
                <p className="truncate">{lock ? <Lock className="mr-1 inline size-3.5" /> : null}{w.name}</p>
                <p className="text-[11px] font-bold opacity-80">{done}/{STAGES_PER_WORLD} stages · {st}/{STAGES_PER_WORLD * 3} stars{w.gravity < 9 ? " · low gravity" : ""}</p>
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
        [<Play key="i" className="size-5" fill="#4DF2C4" stroke="none" />, "Hold the right side (or → / D) to drive. Hold the left side (or ← / A) to brake and back up."],
        [<Zap key="i" className="size-5" stroke="#7CF5FF" />, "In the air, gas tilts you back and brake tilts you forward — let go and the car steadies itself. Land on your wheels: if Rivet's head bumps anything, it's a crash!"],
        [<Sparkles key="i" className="size-5" stroke="#B79CFF" />, "Every course is full of gizmos: seesaws, lifts, moving platforms, gates and buttons, drawbridges, wrecking balls, crushers, loops, fans and more. Watch them, wait for your moment, and don't rush."],
        [<Fuel key="i" className="size-5" stroke="#FF6B5A" />, "Oil runs down as you drive. Grab the red oil cans to fill up."],
        [<CoinIcon key="i" size={20} />, "Collect coins and star coins, then buy paint jobs in the Garage."],
        [<Heart key="i" className="size-5" fill="#FF4F7A" stroke="none" />, "A crash costs a life and puts you back at the last checkpoint. With no lives left you go back one more checkpoint. Hearts give you lives."],
        [<Shield key="i" className="size-5" fill="#7FC4FF" stroke="#2E9BFF" />, "Power-ups: Turbo, Helmet shield, Coin magnet, Floaty jumps and Sticky tyres."],
        [<Flag key="i" className="size-5" fill="#fff" stroke="none" />, "Reach the flag — the next stage starts right away. 600 stages across 12 worlds, then endless remixes."],
      ].map(([i, t], k) => (
        <div key={k} className="flex items-start gap-3 rounded-2xl bg-white/[.06] p-3"><span className="mt-0.5 shrink-0">{i}</span><span>{t}</span></div>
      ))}
      <button type="button" className="gz-btn gz-cta mt-2 py-3 text-lg" onClick={onPlay}><Play className="size-5 fill-current" /> Let&apos;s drive</button>
    </div>
  );
}
