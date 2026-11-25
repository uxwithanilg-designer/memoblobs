"use client";
// Blockstorm: the screens around the 3D view — the home screen over a slow orbit of your current island, the HUD
// (stage and goal, health, oil, coins, lives, power timers, the boss bar), the thumb stick and the fire / jump buttons,
// the cinematic stage cards ("Stage 12 started!"), the stage-clear banner that moves on by itself (no menu between
// stages), and the Armory (upgrades and hero skins), the world map and the help sheet with the play settings.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pixelify_Sans } from "next/font/google";
import { Map as MapIcon, Play, Shield, HelpCircle, X, Lock, Check, Heart, Zap, Magnet, Coins, Crosshair, Rocket, Users, Droplet, Star, Swords } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { useProfile } from "@/lib/store";
import { Game, type GameEvent, type Hud, type StageStats } from "../game";
import { stagePlan, MOD_LABEL } from "../stages";
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS } from "../worlds";
import { MAX_LEVEL, POWERS, UPGRADES, upgradeCost, type Levels, type PowerId } from "../gear";
import { HERO_SKINS, type SkinLook } from "../rigs";
import { useStorm, useStormHydrated } from "../save";
import { FIRST_SOUNDS, STORM_SOUNDS, sfx } from "../sound";
import { StormMusic } from "../music";
import { mix, shade } from "../util";
import { STORM_CSS } from "./styles";

const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-pixel", display: "swap" });

type Sheet = "" | "armory" | "worlds" | "help";
interface Msg { id: number; big: string; sub?: string; color?: string }
function CoinIcon({ size = 18 }: { size?: number }) {
  // a pixel coin
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M2 0h4v1h1v1h1v4h-1v1h-1v1h-4v-1h-1v-1h-1v-4h1v-1h1z" fill="#E8A317" />
      <path d="M2 1h4v1h1v4h-1v1h-4v-1h-1v-4h1z" fill="#FFD23F" />
      <path d="M2 2h1v3h-1zM3 1h2v1h-2z" fill="#FFF6C8" /><path d="M5 3h1v3h-1z" fill="#E8A317" />
    </svg>
  );
}
const Hearts = ({ n }: { n: number }) => (
  <span className="bs-hearts">
    {Array.from({ length: Math.max(3, Math.min(6, n)) }, (_, i) => <Heart key={i} className={`size-[17px] ${i < n ? "" : "opacity-30"}`} fill={i < n ? "#FF4F7A" : "rgba(255,255,255,.4)"} stroke={i < n ? "#B0183F" : "none"} strokeWidth={1.5} />)}
    {n > 6 && <b className="ml-0.5 text-sm">+{n - 6}</b>}
  </span>
);
const POWER_ICON: Record<PowerId, React.ReactNode> = {
  rapid: <Zap className="size-5" fill="#FFD23F" stroke="#FF8F1F" />, triple: <Crosshair className="size-5" stroke="#FF7AB6" strokeWidth={2.6} />,
  rocket: <Rocket className="size-5" fill="#FF6A2B" stroke="#FFD23F" />, shield: <Shield className="size-5" fill="#7CF5FF" stroke="#2E9BFF" />,
  magnet: <Magnet className="size-5" stroke="#3EE08F" strokeWidth={2.6} />, ally: <Users className="size-5" stroke="#B98AFF" strokeWidth={2.6} />,
};
const GOAL_ICON = { clear: Swords, totems: Zap, wreck: Rocket, hold: Shield, rescue: Users, boss: Star } as const;

export default function StormApp({ slug }: { slug: string; title: string }) {
  const ready = useStormHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const save = useStorm();
  const [screen, setScreen] = useState<"home" | "play">("home");
  const [sheet, setSheet] = useState<Sheet>("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; color: string } | null>(null);
  const [streak, setStreak] = useState<{ id: number; text: string } | null>(null);
  const [cleared, setCleared] = useState<StageStats | null>(null);
  const [intro, setIntro] = useState<{ n: number; next: boolean } | null>(null);
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
    loadRef.current(0.3, "Stacking the blocks");
    void audio.preload(FIRST_SOUNDS);
    // the rest in the background
    const id = setTimeout(() => void audio.preload(STORM_SOUNDS), 2500);
    void audio.stopMusic(0.2);
    return () => clearTimeout(id);
  }, []);
  const music = useRef<StormMusic | null>(null);
  useEffect(() => {
    const m = new StormMusic();
    music.current = m;
    m.title();
    return () => { m.dispose(); music.current = null; };
  }, []);

  const onEvent = useCallback((e: GameEvent) => {
    switch (e.k) {
      case "intro": {
        setCleared(null);
        setIntro({ n: e.plan.n, next: e.next });
        music.current?.stage(e.plan);
        break;
      }
      case "go": setIntro(null); say("FIGHT!", undefined, "#FFD23F", 900); break;
      case "clear": {
        setCleared(e.stats);
        const s = useStorm.getState();
        s.setCoins(gameRef.current?.coins ?? s.coins);
        s.clear(e.stats.stage, e.stats.kills, e.stats.blocks, e.stats.boss);
        useProfile.getState().earnCoins(5 + Math.floor(e.stats.stage / 20));
        if (e.stats.worldDone) sfx("worldClear", { delay: 0.5 });
        track("storm_clear", { stage: e.stats.stage });
        break;
      }
      case "lifeLost": say("Ouch!", `${e.livesLeft} ${e.livesLeft === 1 ? "life" : "lives"} left`, "#FF5D6C", 1800); break;
      case "outOfLives": say("Out of lives!", "The stage starts again with 3 lives", "#FF5D6C", 2200); break;
      case "beaconLost": say("Beacon down!", "Guard it closer — the stage starts again", "#FF5D6C", 2200); break;
      case "pickup":
        if (e.what === "oil") toastIt("Oil +45%", "#FFB627");
        else if (e.what === "heart") toastIt("+1 life!", "#FF5D8F");
        else if (e.what === "health") toastIt("+35 health", "#3EE08F");
        else if (e.what === "gem") toastIt("Gem +10 coins", "#7CF5FF");
        break;
      case "power": toastIt(`${POWERS[e.id].name}!`, POWERS[e.id].color, 1700); break;
      case "boss": say("BOSS!", e.name, "#FF5CE1", 2000); break;
      case "totem": toastIt(e.left ? `Totem down! ${e.left} to go` : "Last totem down!", "#FF5CE1"); break;
      case "freed": toastIt(`Your ${e.ally} is free!`, "#FFD23F"); break;
      case "streak": { const id = Math.random(); setStreak({ id, text: e.n >= 6 ? `RAMPAGE ×${e.n}` : e.n >= 4 ? `MEGA ×${e.n}` : `TRIPLE!` }); setTimeout(() => setStreak((s) => (s?.id === id ? null : s)), 900); break; }
      case "collapse": toastIt(e.n > 40 ? "TIMBER!!" : "Crash!", "#FFD23F", 1100); break;
      case "lowOil": toastIt("Low oil — grab a can!", "#FF6B5A", 2000); break;
      case "hint": toastIt(e.text, "#FFD23F", 2200); break;
    }
  }, [say, toastIt]);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const s = useStorm.getState();
    coinsRef.current = s.coins;
    let flush: ReturnType<typeof setTimeout> | null = null;
    const g = new Game(host.current, {
      levels: s.levels, skin: s.skin, lives: s.lives || 3, coins: s.coins, autoFire: s.autoFire, sens: s.sens,
      onHud: (h) => setHud(h),
      onEvent: (e) => onEventRef.current(e),
      onCoins: (n) => { coinsRef.current = n; if (!flush) flush = setTimeout(() => { flush = null; useStorm.getState().setCoins(coinsRef.current); }, 900); },
      onLives: (n) => useStorm.getState().setLives(n),
    });
    gameRef.current = g;
    g.load(s.stage, "attract");
    g.start();
    loadRef.current(null);
    setGameReady(true);
    return () => { if (flush) { clearTimeout(flush); useStorm.getState().setCoins(coinsRef.current); } g.dispose(); gameRef.current = null; setGameReady(false); };
  }, [ready]);

  // the boss fight and rapid fire add a sparkle layer to the music
  const fever = !!hud?.boss || !!hud?.powers.some((p) => p.id === "rapid");
  useEffect(() => { music.current?.fever(fever); }, [fever]);

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
    g.play();
    if (!useStorm.getState().seenHelp) setTimeout(() => toastIt(touchDevice ? "Left thumb: move · Right thumb: look & fire" : "WASD move · Mouse aim · Click fire · Space jump", "#FFD23F", 3200), 3600);
    useStorm.getState().sawHelp();
  }, [toastIt, touchDevice]);

  const home = useCallback(() => {
    const g = gameRef.current;
    setCleared(null); setIntro(null);
    setScreen("home");
    if (g) { g.load(useStorm.getState().stage, "attract"); }
    music.current?.title();
  }, []);

  useEffect(() => {
    setMenu(screen === "play" ? [
      { id: "restart", label: "Restart stage", icon: "🔄", onSelect: () => { setCleared(null); gameRef.current?.restartStage(); } },
      { id: "armory", label: "Armory", icon: "🛡️", onSelect: () => { home(); setSheet("armory"); } },
      { id: "home", label: "Main menu", icon: "🏠", onSelect: home },
    ] : []);
  }, [screen, setMenu, home]);

  // the clear banner goes away as the camera rises to the next island
  useEffect(() => { if (cleared) { const id = setTimeout(() => setCleared(null), 4600); return () => clearTimeout(id); } }, [cleared]);

  // ---------------------------------------------------------------- render
  const plan = stagePlan(save.stage);
  const wi = Math.min(WORLDS.length - 1, Math.floor((Math.min(save.stage, DESIGNED_STAGES) - 1) / STAGES_PER_WORLD));
  const acc = hud?.accent ?? WORLDS.find((w) => w.id === plan.world)!.accent;
  const local = plan.local;
  const travel = hud?.mode === "travel";
  const introPlan = intro ? stagePlan(intro.n) : null;
  const GoalIcon = GOAL_ICON[hud?.goal ?? plan.goal];

  return (
    <div className={`bs-root ${pixel.variable}`} style={{ ["--acc" as string]: acc, ["--fade" as string]: "#E8F2FF" }} data-slug={slug}>
      <style>{STORM_CSS}</style>
      <div ref={host} className="bs-stage" />

      {screen === "home" && (
        <div className="bs-ui">
          <div className="bs-home">
            <div className="flex flex-col items-center gap-3">
              <div className="bs-logo" aria-label="Blockstorm">
                <span className="l1" style={{ ["--c" as string]: "#FFD23F", ["--d" as string]: "#C2410C" }}>BLOCK</span>
                <span className="l2" style={{ ["--c" as string]: "#7CF5FF", ["--d" as string]: "#1D4ED8", animationDelay: ".12s" }}>STORM</span>
              </div>
              <p className="bs-tag">Blast monsters · Tear blocks down</p>
            </div>
            <div className="flex w-full flex-col items-center gap-3">
              <div className="bs-card bs-panel">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold tracking-[.16em] uppercase opacity-70">{plan.remix ? "Endless remix" : `World ${wi + 1} of ${WORLDS.length} · ${WORLDS[wi].name}`}</p>
                    <p className="bs-px truncate text-2xl font-bold">{plan.title}</p>
                    <p className="flex items-center gap-1.5 truncate text-sm opacity-85"><GoalIcon className="size-4 shrink-0" />{plan.subtitle}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="bs-pill bs-panel"><CoinIcon />{save.coins.toLocaleString()}</span>
                    <Hearts n={save.lives} />
                  </div>
                </div>
                {!plan.remix && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs font-bold opacity-80"><span>Stage {local} of {STAGES_PER_WORLD}</span><span>{save.stage} / {DESIGNED_STAGES}</span></div>
                    <div className="bs-bar"><i style={{ width: `${(local / STAGES_PER_WORLD) * 100}%` }} /></div>
                  </div>
                )}
              </div>
              <button type="button" className="bs-btn bs-cta bs-shine w-[min(430px,100%)] py-4 text-2xl" onClick={play} disabled={!gameReady}>
                <Play className="size-7 fill-current" /> <span className="bs-px font-bold">{save.stage === 1 ? "PLAY" : `STAGE ${save.stage}`}</span>
              </button>
              <div className="grid w-[min(430px,100%)] grid-cols-3 gap-2">
                <button type="button" className="bs-btn bs-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("armory"); }}><Shield className="size-5" /> Armory</button>
                <button type="button" className="bs-btn bs-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("worlds"); }}><MapIcon className="size-5" /> Worlds</button>
                <button type="button" className="bs-btn bs-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("help"); }}><HelpCircle className="size-5" /> Help</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "play" && hud && (
        <div className="bs-hud">
          <div className="bs-top">
            <div className="flex min-w-0 flex-col">
              <div className="bs-chip bs-panel">
                <span className="bs-badge">{hud.stage}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-tight font-extrabold">{hud.title}</span>
                  <span className="flex items-center gap-1 text-[11.5px] font-bold opacity-90"><GoalIcon className="size-3.5 shrink-0" />{hud.goalText}</span>
                  <span className="bs-bar mt-1 block !h-[6px]"><i style={{ width: `${hud.progress * 100}%` }} /></span>
                </span>
              </div>
              <div className="bs-meters">
                <div className="bs-meter bs-panel">
                  <Heart className="size-[16px]" fill="#FF4F7A" stroke="none" />
                  <span className="bs-mbar"><i style={{ width: `${Math.max(2, (hud.hp / hud.maxHp) * 100)}%`, background: hud.hp / hud.maxHp > 0.5 ? "#3EE08F" : hud.hp / hud.maxHp > 0.25 ? "#FFB627" : "#FF3B4E" }} /></span>
                </div>
                <div className={`bs-meter bs-panel ${hud.lowOil ? "bs-low" : ""}`}>
                  <Droplet className="size-[16px]" fill="#FFB627" stroke="none" />
                  <span className="bs-mbar"><i style={{ width: `${Math.max(2, hud.oil * 100)}%`, background: hud.oil > 0.2 ? "#FFB627" : "#FF6B5A" }} /></span>
                </div>
                {hud.beacon !== null && (
                  <div className="bs-meter bs-panel">
                    <Zap className="size-[16px]" fill="#7CF5FF" stroke="none" />
                    <span className="bs-mbar"><i style={{ width: `${Math.max(2, hud.beacon * 100)}%`, background: "#7CF5FF" }} /></span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="bs-pill bs-panel"><CoinIcon />{hud.coins.toLocaleString()}</span>
              <Hearts n={hud.lives} />
            </div>
          </div>
          {hud.boss && (
            <div className="bs-boss bs-panel">
              <p className="bs-px mb-1 text-sm font-bold tracking-wide" style={{ color: "#FF9AF5" }}>{hud.boss.name}</p>
              <span className="bs-mbar block"><i style={{ width: `${hud.boss.hp * 100}%`, background: "linear-gradient(90deg,#FF3DF0,#FF7A3D)" }} /></span>
            </div>
          )}
          {hud.powers.length > 0 && (
            <div className="bs-powers">
              {hud.powers.map((p) => (
                <div key={p.id} className="bs-power" title={POWERS[p.id].name}>
                  <svg className="ring" viewBox="0 0 48 48"><rect x="3" y="3" width="42" height="42" rx="12" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" /><rect x="3" y="3" width="42" height="42" rx="12" fill="none" stroke={POWERS[p.id].color} strokeWidth="4" pathLength={100} strokeDasharray={`${(p.left / p.secs) * 100} 100`} /></svg>
                  {POWER_ICON[p.id]}
                </div>
              ))}
            </div>
          )}
          {hud.mode === "play" && touchDevice && <TouchControls game={gameRef} />}
          {hud.mode === "play" && !touchDevice && <div className="bs-keys bs-panel">WASD move · mouse aim · click fire · Space jump · Shift sprint</div>}
          {hud.mode === "intro" && <div className="absolute inset-0 pointer-events-auto" onPointerDown={() => gameRef.current?.skipIntro()} />}
        </div>
      )}

      {/* the fade between islands */}
      <motion.div className="bs-fade" initial={false} animate={{ opacity: travel ? 1 : 0 }} transition={{ duration: travel ? 0.9 : 0.6 }} />

      <AnimatePresence>
        {screen === "play" && intro && introPlan && hud?.mode === "intro" && (
          <motion.div key={`intro-${intro.n}`} className="bs-intro" initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 1.08 }} transition={{ duration: 0.4 }}>
            <span className="bs-kicker">{intro.next ? `Stage ${intro.n} started!` : introPlan.remix ? `Remix · Stage ${intro.n}` : `Stage ${intro.n}`}</span>
            <p className="bs-big mt-3" style={{ fontSize: "clamp(34px,10vw,72px)" }}>{introPlan.title}</p>
            <div className="bs-goal bs-panel">{(() => { const I = GOAL_ICON[introPlan.goal]; return <I className="size-4" />; })()}{introPlan.subtitle}</div>
            {introPlan.mods.length > 0 && <div className="bs-mods">{introPlan.mods.map((m) => <span key={m}>{MOD_LABEL[m]}</span>)}</div>}
            {introPlan.finale && <p className="bs-sub" style={{ color: "#FFD23F" }}>World finale!</p>}
          </motion.div>
        )}
      </AnimatePresence>
      {screen === "play" && hud?.mode === "intro" && <p className="bs-skip">Tap to skip</p>}

      <div className="bs-wrap bs-clearwrap"><AnimatePresence>{cleared && screen === "play" && <ClearBanner key={cleared.stage} r={cleared} />}</AnimatePresence></div>

      <div className="bs-wrap bs-popwrap"><AnimatePresence>
        {msg && (
          <motion.div key={msg.id} className="bs-pop" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.25 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
            <p className="bs-big" style={{ color: msg.color }}>{msg.big}</p>
            {msg.sub && <p className="bs-sub">{msg.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence></div>
      <div className="bs-wrap bs-streakwrap"><AnimatePresence>
        {streak && <motion.div key={streak.id} className="bs-streak" initial={{ opacity: 0, y: 10, scale: 0.7 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -14 }}>{streak.text}</motion.div>}
      </AnimatePresence></div>
      <div className="bs-wrap bs-toastwrap"><AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="bs-toast bs-panel" style={{ color: toast.color }} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>{toast.text}</motion.div>
        )}
      </AnimatePresence></div>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div key="veil" className="bs-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet("")} />
            <motion.div key={sheet} className="bs-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}>
              <div className="bs-grab" />
              <div className="mb-3 flex items-center justify-between">
                <p className="bs-px text-2xl font-bold">{sheet === "armory" ? "Armory" : sheet === "worlds" ? "Worlds" : "How to play"}</p>
                <button type="button" aria-label="Close" className="bs-btn bs-ghost size-10 !rounded-xl p-0" onClick={() => setSheet("")}><X className="size-5" /></button>
              </div>
              <div className="bs-scroll">
                {sheet === "armory" && <Armory onLevels={(l) => gameRef.current?.setLevels(l)} onSkin={(id) => gameRef.current?.setSkin(id)} />}
                {sheet === "worlds" && <Worlds stage={save.stage} />}
                {sheet === "help" && <Help onPlay={play} game={gameRef} />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ touch controls: a floating stick, look by dragging, fire and jump
function TouchControls({ game }: { game: React.RefObject<Game | null> }) {
  const [stick, setStick] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const [fire, setFire] = useState(false);
  const [jump, setJump] = useState(false);
  const roles = useRef(new Map<number, { role: "stick" | "look" | "fire"; x: number; y: number; ox: number; oy: number }>());
  const R = 52;
  /** a thumb lands on the stick area, the look area or FIRE (data-role) */
  const down = (e: React.PointerEvent<HTMLElement>) => {
    const role = (e.currentTarget.dataset.role ?? "look") as "stick" | "look" | "fire";
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    roles.current.set(e.pointerId, { role, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY });
    if (role === "stick") setStick({ x: e.clientX, y: e.clientY, kx: 0, ky: 0 });
    if (role === "fire") { setFire(true); game.current?.setFire(true); }
  };
  const move = (e: React.PointerEvent) => {
    const r = roles.current.get(e.pointerId);
    if (!r) return;
    const g = game.current;
    if (r.role === "stick") {
      let dx = e.clientX - r.ox, dy = e.clientY - r.oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      g?.setMove(dx / R, -dy / R);
      setStick({ x: r.ox, y: r.oy, kx: dx, ky: dy });
    } else {
      g?.look(e.clientX - r.x, e.clientY - r.y);
      r.x = e.clientX; r.y = e.clientY;
    }
  };
  const up = (e: React.PointerEvent) => {
    const r = roles.current.get(e.pointerId);
    if (!r) return;
    roles.current.delete(e.pointerId);
    if (r.role === "stick") { setStick(null); game.current?.setMove(0, 0); }
    if (r.role === "fire") { setFire(false); game.current?.setFire(false); }
  };
  useEffect(() => () => { game.current?.setMove(0, 0); game.current?.setFire(false); }, [game]);
  return (
    <>
      <div className="bs-left" data-role="stick" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      <div className="bs-right" data-role="look" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {stick ? (
        <div className="bs-stick" style={{ left: stick.x, top: stick.y }}><div className="bs-knob" style={{ transform: `translate(${stick.kx}px,${stick.ky}px)` }} /></div>
      ) : <div className="bs-stickhint">MOVE</div>}
      <div className="bs-btns">
        <div className={`bs-jump ${jump ? "on" : ""}`} onPointerDown={(e) => { e.preventDefault(); setJump(true); game.current?.jump(); }} onPointerUp={() => setJump(false)} onPointerCancel={() => setJump(false)}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V6M6 11l6-6 6 6" /></svg>
          <small>JUMP</small>
        </div>
        <div className={`bs-fire ${fire ? "on" : ""}`} data-role="fire" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="7" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></svg>
          <small>FIRE</small>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ the stage-clear banner (no buttons: the game moves on by itself)
function ClearBanner({ r }: { r: StageStats }) {
  const next = stagePlan(r.stage + 1);
  return (
    <motion.div className="bs-clear" initial={{ opacity: 0, scale: 0.7, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <p className="text-xs font-extrabold tracking-[.2em] uppercase opacity-85">{r.worldDone ? "World complete" : `Stage ${r.stage}`}</p>
      <p className="bs-big" style={{ color: r.worldDone ? "#FFD23F" : "#fff", fontSize: "clamp(36px,10.5vw,70px)" }}>{r.worldDone ? "WORLD CLEAR!" : r.boss ? "BOSS DOWN!" : "STAGE CLEAR!"}</p>
      <div className="bs-stars">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.35 + i * 0.18, type: "spring", stiffness: 400, damping: 14 }}>
            <Star className="size-9" fill={i < r.stars ? "#FFD23F" : "rgba(255,255,255,.2)"} stroke={i < r.stars ? "#C2410C" : "rgba(255,255,255,.35)"} strokeWidth={2} />
          </motion.span>
        ))}
      </div>
      <div className="bs-loot">
        <span className="bs-panel"><CoinIcon />+{r.coins}</span>
        <span className="bs-panel"><Swords className="size-4" />{r.kills}</span>
        <span className="bs-panel">▦ {r.blocks}</span>
      </div>
      <p className="bs-sub mt-3">Next up: {next.remix ? "Remix" : `Stage ${next.n}`} · {next.title}</p>
    </motion.div>
  );
}

// ------------------------------------------------------------------ armory: upgrades and hero skins
function SkinPreview({ look }: { look: SkinLook }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    cv.width = 16; cv.height = 20;
    const c = cv.getContext("2d")!;
    c.clearRect(0, 0, 16, 20);
    const px = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    // a front view: helmet + visor, jacket, arms with the blaster, trousers and boots
    px(3, 0, 10, 8, look.a); px(3, 0, 10, 1, shade(look.a, 0.15)); px(4, 2, 8, 2, look.glow); px(5, 2, 2, 1, "#ffffff");
    px(5, 5, 6, 2, look.skin); px(7, 6, 2, 1, shade(look.skin, -0.4));
    px(4, 8, 8, 6, look.b); px(7, 9, 2, 2, look.a); px(4, 12, 8, 1, look.dark);
    px(1, 8, 3, 5, look.b); px(12, 8, 3, 5, look.b); px(1, 12, 3, 1, look.skin); px(12, 12, 3, 1, look.skin);
    px(0, 11, 2, 5, "#3A3F4E"); px(0, 15, 2, 1, look.glow);
    px(4, 14, 3, 5, look.c); px(9, 14, 3, 5, look.c); px(4, 18, 3, 2, look.dark); px(9, 18, 3, 2, look.dark);
  }, [look]);
  return <canvas ref={ref} />;
}
function Armory({ onLevels, onSkin }: { onLevels: (l: Levels) => void; onSkin: (id: string) => void }) {
  const s = useStorm();
  const [tab, setTab] = useState<"gear" | "skins">("gear");
  return (
    <div>
      <div className="bs-tabs">
        <button type="button" className={tab === "gear" ? "on" : ""} onClick={() => { sfx("tap"); setTab("gear"); }}>Upgrades</button>
        <button type="button" className={tab === "skins" ? "on" : ""} onClick={() => { sfx("tap"); setTab("skins"); }}>Heroes</button>
      </div>
      {tab === "gear" ? UPGRADES.map((u) => {
        const level = s.levels[u.id], cost = upgradeCost(level), max = level >= MAX_LEVEL;
        return (
          <div key={u.id} className="bs-up">
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{u.label}</p>
              <p className="text-xs opacity-70">{u.hint}</p>
              <div className="bs-dots">{Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < level ? "on" : ""} />)}</div>
            </div>
            <button type="button" disabled={max || s.coins < cost} className={`bs-btn ${max ? "bs-ghost" : "bs-cta"} px-3 py-2 text-sm disabled:opacity-50`}
              onClick={() => { if (s.upgrade(u.id)) { sfx("upgrade"); onLevels(useStorm.getState().levels); } }}>
              {max ? <><Check className="size-4" /> Max</> : <><CoinIcon size={16} />{cost.toLocaleString()}</>}
            </button>
          </div>
        );
      }) : (
        <div className="bs-skins">
          {HERO_SKINS.map((k) => {
            const owned = s.skins.includes(k.id), on = s.skin === k.id;
            return (
              <button type="button" key={k.id} className={`bs-skin ${on ? "sel" : ""}`} onClick={() => {
                if (owned) { s.wear(k.id); onSkin(k.id); sfx("tap"); }
                else if (s.buySkin(k.id)) { onSkin(k.id); sfx("buy"); }
              }}>
                <SkinPreview look={k.look} />
                <p className="bs-px mt-1 text-lg font-bold">{k.name}</p>
                <p className="text-xs font-bold opacity-80">{on ? "✔ Playing" : owned ? "Owned" : s.coins >= k.price ? <span className="inline-flex items-center gap-1"><CoinIcon size={14} />{k.price.toLocaleString()}</span> : <span className="inline-flex items-center gap-1"><Lock className="size-3" /><CoinIcon size={14} />{k.price.toLocaleString()}</span>}</p>
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
    const W = 80, H = 55;
    cv.width = W; cv.height = H;
    const c = cv.getContext("2d")!;
    const w = WORLDS[index], s = w.sky;
    // a pixel sky in bands
    for (let y = 0; y < H; y++) { c.fillStyle = mix(s.top, s.bot, Math.floor((y / H) * 8) / 7); c.fillRect(0, y, W, 1); }
    c.fillStyle = s.sun; c.fillRect(56, 8, 6, 6);
    // the skyline in blocks
    for (let x = 0; x < W; x += 4) { const h = 6 + Math.abs(Math.sin(x * 0.21 + index) * 14) + Math.abs(Math.sin(x * 0.07 + index * 3)) * 8; c.fillStyle = mix(w.skyCol[0], s.fog, 0.3); c.fillRect(x, H - 14 - h, 4, h); }
    // the ground: a strip of the world's top block and its soil
    c.fillStyle = w.pal.top; c.fillRect(0, H - 14, W, 4);
    c.fillStyle = w.pal.soil; c.fillRect(0, H - 10, W, 10);
    for (let x = 0; x < W; x += 2) { c.fillStyle = shade(w.pal.soil, (Math.sin(x * 1.7) * 0.5) * 0.2); c.fillRect(x, H - 8 + (x % 4), 2, 2); }
    c.fillStyle = w.liquid === "lava" ? "#FF5A1F" : w.liquid === "goo" ? w.liquidColor : w.liquid === "water" ? w.liquidColor : "transparent";
    if (w.liquid !== "void") c.fillRect(20, H - 14, 14, 3);
    c.fillStyle = w.pal.gloom; c.fillRect(44, H - 26, 6, 12); c.fillStyle = w.pal.core; c.fillRect(45, H - 28, 4, 3);
  }, [index]);
  return <canvas ref={ref} />;
}
function Worlds({ stage }: { stage: number }) {
  const cur = Math.floor((Math.min(stage, DESIGNED_STAGES) - 1) / STAGES_PER_WORLD);
  return (
    <div>
      <div className="bs-worlds">
        {WORLDS.map((w, i) => {
          const done = Math.max(0, Math.min(STAGES_PER_WORLD, stage - 1 - i * STAGES_PER_WORLD));
          const lock = i > cur && stage <= DESIGNED_STAGES;
          return (
            <div key={w.id} className={`bs-world ${lock ? "lock" : ""} ${i === cur && stage <= DESIGNED_STAGES ? "now" : ""}`}>
              <WorldThumb index={i} />
              <div className="bs-wl">
                <p className="truncate">{lock ? <Lock className="mr-1 inline size-3.5" /> : null}{w.name}</p>
                <p className="text-[11px] font-bold opacity-80">{done}/{STAGES_PER_WORLD} stages{w.gravity < 20 ? " · low gravity" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm font-bold opacity-80">{stage > DESIGNED_STAGES ? `All ${DESIGNED_STAGES} stages done! You're on remix ${stage - DESIGNED_STAGES} — they never end.` : `Clear all ${DESIGNED_STAGES} stages to unlock endless remixes.`}</p>
    </div>
  );
}

function Help({ onPlay, game }: { onPlay: () => void; game: React.RefObject<Game | null> }) {
  const s = useStorm();
  return (
    <div className="grid gap-2 text-[15px]">
      {[
        [<Crosshair key="i" className="size-5" stroke="#FF6B5A" />, "Phone: drag the left side to move, drag the right side to look, hold FIRE to shoot. Computer: WASD to move, click to aim with the mouse, click to shoot, Space to jump, Shift to sprint."],
        [<Swords key="i" className="size-5" stroke="#FFD23F" />, "Every stage has a goal: defeat the monsters, topple the glowing gloom totems, wreck the gloom fortress, defend the beacon, free your caged friends — or beat the boss."],
        [<Rocket key="i" className="size-5" stroke="#FF6A2B" />, "Blocks break when you shoot them. Knock out what holds a tower up and it all comes crashing down — right on the monsters below. Red barrels explode!"],
        [<Droplet key="i" className="size-5" fill="#FFB627" stroke="none" />, "Your blaster runs on oil. Grab the red oil cans before it runs dry."],
        [<CoinIcon key="i" size={20} />, "Collect coins and gems (and break coin crates), then upgrade your blaster or buy new heroes in the Armory."],
        [<Heart key="i" className="size-5" fill="#FF4F7A" stroke="none" />, "Hearts give lives, green packs give health. When a stage is done, the next one starts by itself — 1,000 stages in 20 worlds, then endless remixes."],
        [<Coins key="i" className="size-5" stroke="#B98AFF" />, "? boxes hold powers: Rapid fire, Triple shot, Rocket blaster, Shield, Mega magnet and Call a friend."],
      ].map(([i, t], k) => (
        <div key={k} className="flex items-start gap-3 rounded-2xl bg-white/[.06] p-3"><span className="mt-0.5 shrink-0">{i}</span><span>{t}</span></div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-3 rounded-2xl bg-white/[.06] p-3">
        <span><b>Auto-fire</b><br /><span className="text-xs opacity-75">On phones, shoot by itself when a monster is in your sights</span></span>
        <button type="button" aria-label="Auto-fire" className={`bs-toggle ${s.autoFire ? "on" : ""}`} onClick={() => { s.setAutoFire(!s.autoFire); game.current?.setAutoFire(!s.autoFire); sfx("tap"); }}><i /></button>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[.06] p-3">
        <span><b>Look speed</b></span>
        <input type="range" min={0.4} max={2.2} step={0.1} value={s.sens} onChange={(e) => { const v = Number(e.target.value); s.setSens(v); game.current?.setSens(v); }} className="w-40" />
      </div>
      <button type="button" className="bs-btn bs-cta mt-2 py-3 text-lg" onClick={onPlay}><Play className="size-5 fill-current" /> Let&apos;s go</button>
    </div>
  );
}
