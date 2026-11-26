"use client";
// Cube Clash: the screens around the 3D view — the home screen over a slow orbit of your next map, the HUD (stage,
// mode and goal, health, jetpack oil, building cubes, coins, lives, the team crystals, power timers, the Titan's bar),
// the knockout feed, the thumb stick and the FIRE / JUMP / BUILD buttons, the cinematic stage cards ("Stage 12
// started!"), the stage-clear banner that moves on by itself (no menu between stages), and the Armory (upgrades and
// outfits), the theme map and the help sheet with the play settings.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Silkscreen } from "next/font/google";
import { Map as MapIcon, Play, Shield, HelpCircle, X, Lock, Check, Heart, Zap, Magnet, Rocket, Droplet, Star, Swords, Box, Gem, Footprints } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { useProfile } from "@/lib/store";
import { Game, type GameEvent, type Hud, type StageStats } from "../game";
import { stagePlan, MOD_LABEL, MODE_LABEL, type Mode } from "../stages";
import { DESIGNED_STAGES, STAGES_PER_THEME, THEMES } from "../worlds";
import { MAX_LEVEL, POWERS, UPGRADES, upgradeCost, type Levels, type PowerId } from "../gear";
import { OUTFITS, type SkinLook } from "../rigs";
import { TEAM_COLORS } from "../blocks";
import { useClash, useClashHydrated } from "../save";
import { CLASH_SOUNDS, FIRST_SOUNDS, sfx } from "../sound";
import { ClashMusic } from "../music";
import { mix, shade } from "../util";
import { CLASH_CSS } from "./styles";

const pixel = Silkscreen({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-pixel", display: "swap" });

type Sheet = "" | "armory" | "worlds" | "help";
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
  <span className="cc-hearts">
    {Array.from({ length: Math.max(3, Math.min(6, n)) }, (_, i) => <Heart key={i} className={`size-[17px] ${i < n ? "" : "opacity-30"}`} fill={i < n ? "#FF4F7A" : "rgba(255,255,255,.4)"} stroke={i < n ? "#B0183F" : "none"} strokeWidth={1.5} />)}
    {n > 6 && <b className="ml-0.5 text-sm">+{n - 6}</b>}
  </span>
);
const POWER_ICON: Record<PowerId, React.ReactNode> = {
  rapid: <Zap className="size-5" fill="#FFD23F" stroke="#FF8F1F" />, rocket: <Rocket className="size-5" fill="#FF6A2B" stroke="#FFD23F" />,
  shield: <Shield className="size-5" fill="#7CF5FF" stroke="#2E9BFF" />, magnet: <Magnet className="size-5" stroke="#3EE08F" strokeWidth={2.6} />,
  speed: <Footprints className="size-5" stroke="#FF8AC0" strokeWidth={2.6} />, builder: <Box className="size-5" stroke="#B98AFF" strokeWidth={2.6} />,
};
const MODE_ICON: Record<Mode, typeof Swords> = { sky: Swords, crystal: Gem, zombie: Shield, obby: Footprints, titan: Star };

export default function ClashApp({ slug }: { slug: string; title: string }) {
  const ready = useClashHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const save = useClash();
  const [screen, setScreen] = useState<"home" | "play">("home");
  const [sheet, setSheet] = useState<Sheet>("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; color: string } | null>(null);
  const [feed, setFeed] = useState<{ id: number; text: string; color: string }[]>([]);
  const [cleared, setCleared] = useState<StageStats | null>(null);
  const [intro, setIntro] = useState<{ n: number; next: boolean } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const coinsRef = useRef(0);
  const [touchDevice] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const [gameReady, setGameReady] = useState(false);
  /** computers: the controls card shown when a game starts */
  const [coach, setCoach] = useState(false);

  const say = useCallback((big: string, sub?: string, color?: string, ms = 1300) => {
    const id = Math.random(); setMsg({ id, big, sub, color });
    setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), ms);
  }, []);
  const toastIt = useCallback((text: string, color = "#3EE08F", ms = 1500) => {
    const id = Math.random(); setToast({ id, text, color });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), ms);
  }, []);
  const feedIt = useCallback((text: string, color: string) => {
    const id = Math.random();
    setFeed((f) => [...f.slice(-3), { id, text, color }]);
    setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 4200);
  }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Stacking the islands");
    void audio.preload(FIRST_SOUNDS);
    const id = setTimeout(() => void audio.preload(CLASH_SOUNDS), 2500);
    void audio.stopMusic(0.2);
    return () => clearTimeout(id);
  }, []);
  const music = useRef<ClashMusic | null>(null);
  useEffect(() => { const m = new ClashMusic(); music.current = m; m.title(); return () => { m.dispose(); music.current = null; }; }, []);

  const onEvent = useCallback((e: GameEvent) => {
    switch (e.k) {
      case "intro": setCleared(null); setFeed([]); setIntro({ n: e.plan.n, next: e.next }); music.current?.stage(e.plan); break;
      case "go": setIntro(null); say("GO!", undefined, "#9CFFB4", 900); break;
      case "clear": {
        setCleared(e.stats);
        const s = useClash.getState();
        s.setCoins(gameRef.current?.coins ?? s.coins);
        s.clear(e.stats.stage, e.stats.kos);
        useProfile.getState().earnCoins(5 + Math.floor(e.stats.stage / 20));
        if (e.stats.worldDone) sfx("worldClear", { delay: 0.5 });
        track("clash_clear", { stage: e.stats.stage, mode: e.stats.mode });
        break;
      }
      case "lifeLost": say("Ouch!", `${e.why} · ${e.livesLeft} ${e.livesLeft === 1 ? "life" : "lives"} left`, "#FF5D6C", 1900); break;
      case "outOfLives": say("Out of lives!", "The stage starts again with 3 lives", "#FF5D6C", 2200); break;
      case "failed": say("Match lost!", e.why, "#FF5D6C", 2200); break;
      case "elim": {
        const text = e.by === "you" ? `You knocked out ${e.name}` : e.by === "void" ? `${e.name} fell into the void` : `${e.name} is out`;
        feedIt(text, e.by === "you" || e.by === "void" ? "#9CFFB4" : "#FFD23F");
        if (e.left === 1 && (e.by === "you" || e.by === "void")) toastIt("One rival left!", "#FFD23F");
        break;
      }
      case "crystal": if (e.mine) say("Your crystal broke!", "Don't fall — you can't come back now", "#FF5D6C", 2400); else { const name = ["Blue", "Red", "Green", "Gold"][e.team]; say("Crystal down!", `${name} team can't come back`, TEAM_COLORS[e.team], 1600); } break;
      case "wave": say(`Wave ${e.n}`, e.n === e.of ? "The last wave!" : `${e.of - e.n + 1} to go`, "#FFB627", 1500); break;
      case "checkpoint": toastIt("Checkpoint!", "#9CFFB4"); break;
      case "titan": say("TITAN!", e.name, "#FF5CE1", 2000); break;
      case "pickup":
        if (e.what === "oil") toastIt("Jetpack oil +50%", "#FFB627");
        else if (e.what === "heart") toastIt("+1 life!", "#FF5D8F");
        else if (e.what === "health") toastIt("+40 health", "#3EE08F");
        else if (e.what === "cubes") toastIt("+16 cubes", "#7CC4FF");
        else if (e.what === "gem") toastIt("Gem +10 coins", "#7CF5FF");
        break;
      case "power": toastIt(`${POWERS[e.id].name}!`, POWERS[e.id].color, 1700); break;
      case "noCubes": toastIt("Out of cubes — break blocks or find a cube pack", "#FF6B5A", 1800); break;
      case "lowOil": toastIt("Jetpack oil low!", "#FF6B5A", 1800); break;
      case "hint": toastIt(e.text, "#FFD23F", 2000); break;
      case "streak": toastIt(e.n >= 4 ? `RAMPAGE ×${e.n}!` : e.n === 3 ? "TRIPLE KO!" : "DOUBLE KO!", "#FFD23F", 1200); break;
    }
  }, [say, toastIt, feedIt]);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const s = useClash.getState();
    coinsRef.current = s.coins;
    let flush: ReturnType<typeof setTimeout> | null = null;
    const g = new Game(host.current, {
      levels: s.levels, outfit: s.outfit, lives: s.lives || 3, coins: s.coins, autoFire: s.autoFire, sens: s.sens,
      onHud: (h) => setHud(h), onEvent: (e) => onEventRef.current(e),
      onCoins: (n) => { coinsRef.current = n; if (!flush) flush = setTimeout(() => { flush = null; useClash.getState().setCoins(coinsRef.current); }, 900); },
      onLives: (n) => useClash.getState().setLives(n),
    });
    gameRef.current = g;
    g.load(s.stage, "attract");
    g.start();
    loadRef.current(null);
    setGameReady(true);
    return () => { if (flush) { clearTimeout(flush); useClash.getState().setCoins(coinsRef.current); } g.dispose(); gameRef.current = null; setGameReady(false); };
  }, [ready]);

  const fever = !!hud?.boss || !!hud?.powers.some((p) => p.id === "rapid");
  useEffect(() => { music.current?.fever(fever); }, [fever]);
  useEffect(() => { const g = gameRef.current; if (!g) return; if (paused) { g.stop(); music.current?.pause(); } else { g.start(); music.current?.resume(); } }, [paused]);
  useEffect(() => { setInRound(screen === "play"); setImmersive(screen === "play"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const play = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    sfx("tap"); setSheet(""); setScreen("play"); g.play();
    if (!touchDevice) { g.setHoldIntro(true); setCoach(true); }
    else if (!useClash.getState().seenHelp) setTimeout(() => toastIt("Left: move · Right: aim · FIRE · hold JUMP to jet · BUILD bridges", "#FFD23F", 3600), 3600);
    useClash.getState().sawHelp();
  }, [toastIt, touchDevice]);
  const closeCoach = useCallback(() => {
    setCoach(false);
    const g = gameRef.current;
    if (!g) return;
    g.setHoldIntro(false); g.skipIntro(); g.lockMouse();
    sfx("tap");
  }, []);
  // any key (except the player's pause / mute / fullscreen keys) closes the controls card
  useEffect(() => {
    if (!coach) return;
    const on = (e: KeyboardEvent) => { if (!e.repeat && !["escape", "p", "m", "f"].includes(e.key.toLowerCase())) closeCoach(); };
    window.addEventListener("keydown", on, true);
    return () => window.removeEventListener("keydown", on, true);
  }, [coach, closeCoach]);
  const home = useCallback(() => {
    setCoach(false); setCleared(null); setIntro(null); setScreen("home");
    gameRef.current?.load(useClash.getState().stage, "attract");
    music.current?.title();
  }, []);
  useEffect(() => {
    setMenu(screen === "play" ? [
      { id: "restart", label: "Restart stage", icon: "🔄", onSelect: () => { setCleared(null); gameRef.current?.restartStage(); } },
      { id: "armory", label: "Armory", icon: "🛡️", onSelect: () => { home(); setSheet("armory"); } },
      { id: "home", label: "Main menu", icon: "🏠", onSelect: home },
    ] : []);
  }, [screen, setMenu, home]);
  useEffect(() => { if (cleared) { const id = setTimeout(() => setCleared(null), 4600); return () => clearTimeout(id); } }, [cleared]);

  // ---------------------------------------------------------------- render
  const plan = stagePlan(save.stage);
  const ti = Math.min(THEMES.length - 1, Math.floor((Math.min(save.stage, DESIGNED_STAGES) - 1) / STAGES_PER_THEME));
  const acc = hud?.accent ?? THEMES[plan.themeIndex].accent;
  const travel = hud?.phase === "travel";
  const introPlan = intro ? stagePlan(intro.n) : null;
  const ModeIcon = MODE_ICON[plan.mode];

  return (
    <div className={`cc-root ${pixel.variable}`} style={{ ["--acc" as string]: acc, ["--fade" as string]: "#EAF4FF" }} data-slug={slug}>
      <style>{CLASH_CSS}</style>
      <div ref={host} className="cc-stage" />

      {screen === "home" && (
        <div className="cc-ui">
          <div className="cc-home">
            <div className="flex flex-col items-center gap-3">
              <div className="cc-logo" aria-label="Cube Clash">
                <span className="l1" style={{ ["--c" as string]: "#FFFFFF", ["--d" as string]: "#3D8BFF" }}>CUBE</span>
                <span className="l2" style={{ ["--c" as string]: "#9CFFB4", ["--d" as string]: "#1FA84E", animationDelay: ".12s" }}>CLASH</span>
              </div>
              <p className="cc-tag">Build · Bridge · Blast</p>
            </div>
            <div className="flex w-full flex-col items-center gap-3">
              <div className="cc-card cc-panel">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold tracking-[.16em] uppercase opacity-70">{plan.remix ? "Endless remix" : `Map ${ti + 1} of ${THEMES.length} · ${THEMES[ti].name}`}</p>
                    <p className="cc-px truncate text-xl font-bold">{plan.title}</p>
                    <p className="flex items-center gap-1.5 truncate text-sm opacity-85"><ModeIcon className="size-4 shrink-0" />{plan.subtitle}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="cc-pill cc-panel"><CoinIcon />{save.coins.toLocaleString()}</span>
                    <Hearts n={save.lives} />
                  </div>
                </div>
                {!plan.remix && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs font-bold opacity-80"><span>Stage {plan.local} of {STAGES_PER_THEME}</span><span>{save.stage} / {DESIGNED_STAGES}</span></div>
                    <div className="cc-bar"><i style={{ width: `${(plan.local / STAGES_PER_THEME) * 100}%` }} /></div>
                  </div>
                )}
              </div>
              <button type="button" className="cc-btn cc-cta cc-shine w-[min(430px,100%)] py-4 text-2xl" onClick={play} disabled={!gameReady}>
                <Play className="size-7 fill-current" /> <span className="cc-px font-bold">{save.stage === 1 ? "PLAY" : `STAGE ${save.stage}`}</span>
              </button>
              <div className="grid w-[min(430px,100%)] grid-cols-3 gap-2">
                <button type="button" className="cc-btn cc-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("armory"); }}><Shield className="size-5" /> Armory</button>
                <button type="button" className="cc-btn cc-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("worlds"); }}><MapIcon className="size-5" /> Maps</button>
                <button type="button" className="cc-btn cc-ghost py-3 text-sm" onClick={() => { sfx("open"); setSheet("help"); }}><HelpCircle className="size-5" /> Help</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "play" && hud && (
        <div className="cc-hud">
          <div className="cc-top">
            <div className="flex min-w-0 flex-col">
              <div className="cc-chip cc-panel">
                <span className="cc-badge">{hud.stage}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] leading-tight font-extrabold tracking-wider uppercase opacity-80">{hud.modeLabel}</span>
                  <span className="block truncate text-[12.5px] font-extrabold">{hud.goalText}</span>
                  <span className="cc-bar mt-1 block !h-[6px]"><i style={{ width: `${hud.progress * 100}%` }} /></span>
                </span>
              </div>
              <div className="cc-meters">
                <div className="cc-meter cc-panel"><Heart className="size-[16px]" fill="#FF4F7A" stroke="none" /><span className="cc-mbar"><i style={{ width: `${Math.max(2, (hud.hp / hud.maxHp) * 100)}%`, background: hud.hp / hud.maxHp > 0.5 ? "#3EE08F" : hud.hp / hud.maxHp > 0.25 ? "#FFB627" : "#FF3B4E" }} /></span></div>
                <div className={`cc-meter cc-panel ${hud.oil < 0.2 ? "cc-low" : ""}`}><Droplet className="size-[16px]" fill="#FFB627" stroke="none" /><span className="cc-mbar"><i style={{ width: `${Math.max(2, hud.oil * 100)}%`, background: hud.oil > 0.2 ? "#FFB627" : "#FF6B5A" }} /></span></div>
                <div className="cc-meter cc-panel"><Box className="size-[16px]" stroke="#7CC4FF" strokeWidth={2.6} /><b className="text-sm">{hud.cubes}</b><span className="text-[11px] font-bold opacity-70">cubes</span></div>
              </div>
              {hud.crystals && (
                <div className="cc-crystals">
                  {hud.crystals.map((c) => (
                    <span key={c.team} className={c.alive ? "" : "off"} style={{ borderColor: TEAM_COLORS[c.team] }} title={c.team === 0 ? "Your crystal" : "Enemy crystal"}>
                      <Gem className="size-4" fill={TEAM_COLORS[c.team]} stroke="#fff" strokeWidth={1.5} />
                      <i><b style={{ width: `${c.hp * 100}%`, background: TEAM_COLORS[c.team] }} /></i>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="cc-pill cc-panel"><CoinIcon />{hud.coins.toLocaleString()}</span>
              <Hearts n={hud.lives} />
            </div>
          </div>
          {hud.boss && (
            <div className="cc-boss cc-panel">
              <p className="cc-px mb-1 text-sm font-bold tracking-wide" style={{ color: "#FF9AF5" }}>{hud.boss.name}</p>
              <span className="cc-mbar block"><i style={{ width: `${hud.boss.hp * 100}%`, background: "linear-gradient(90deg,#FF3DF0,#FF7A3D)" }} /></span>
            </div>
          )}
          {hud.powers.length > 0 && (
            <div className="cc-powers">
              {hud.powers.map((p) => (
                <div key={p.id} className="cc-power" title={POWERS[p.id].name}>
                  <svg className="ring" viewBox="0 0 48 48"><rect x="3" y="3" width="42" height="42" rx="12" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" /><rect x="3" y="3" width="42" height="42" rx="12" fill="none" stroke={POWERS[p.id].color} strokeWidth="4" pathLength={100} strokeDasharray={`${(p.left / p.secs) * 100} 100`} /></svg>
                  {POWER_ICON[p.id]}
                </div>
              ))}
            </div>
          )}
          <div className="cc-feed">{feed.map((f) => <p key={f.id} style={{ color: f.color }}>{f.text}</p>)}</div>
          {hud.phase === "play" && touchDevice && <TouchControls game={gameRef} cubes={hud.cubes} />}
          {hud.phase === "play" && !touchDevice && <div className="cc-keys cc-panel">WASD move · mouse aim · click fire · right-click / E build · Space jump (hold: jetpack) · P pause</div>}
          {hud.phase === "intro" && !coach && <div className="absolute inset-0 pointer-events-auto" onPointerDown={() => gameRef.current?.skipIntro()} />}
        </div>
      )}

      <motion.div className="cc-fade" initial={false} animate={{ opacity: travel ? 1 : 0 }} transition={{ duration: travel ? 0.9 : 0.6 }} />

      <AnimatePresence>
        {screen === "play" && intro && introPlan && hud?.phase === "intro" && (
          <motion.div key={`intro-${intro.n}`} className="cc-intro" initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 1.08 }} transition={{ duration: 0.4 }}>
            <span className="cc-kicker">{intro.next ? `Stage ${intro.n} started!` : introPlan.remix ? `Remix · Stage ${intro.n}` : `Stage ${intro.n}`}</span>
            <p className="cc-big mt-3" style={{ fontSize: "clamp(30px,9vw,64px)" }}>{introPlan.title}</p>
            <div className="cc-goal cc-panel">{(() => { const I = MODE_ICON[introPlan.mode]; return <I className="size-4" />; })()}{introPlan.subtitle}</div>
            {introPlan.mods.length > 0 && <div className="cc-mods">{introPlan.mods.map((m) => <span key={m}>{MOD_LABEL[m]}</span>)}</div>}
            {introPlan.finale && <p className="cc-sub" style={{ color: "#FFD23F" }}>Map finale!</p>}
          </motion.div>
        )}
      </AnimatePresence>
      {screen === "play" && hud?.phase === "intro" && !coach && <p className="cc-skip">{touchDevice ? "Tap" : "Click"} to skip</p>}
      <AnimatePresence>{coach && screen === "play" && <KeysCoach key="coach" onClose={closeCoach} />}</AnimatePresence>

      <div className="cc-wrap cc-clearwrap"><AnimatePresence>{cleared && screen === "play" && <ClearBanner key={cleared.stage} r={cleared} />}</AnimatePresence></div>
      <div className="cc-wrap cc-popwrap"><AnimatePresence>
        {msg && (
          <motion.div key={msg.id} className="cc-pop" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.25 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
            <p className="cc-big" style={{ color: msg.color }}>{msg.big}</p>
            {msg.sub && <p className="cc-sub">{msg.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence></div>
      <div className="cc-wrap cc-toastwrap"><AnimatePresence>
        {toast && <motion.div key={toast.id} className="cc-toast cc-panel" style={{ color: toast.color }} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>{toast.text}</motion.div>}
      </AnimatePresence></div>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div key="veil" className="cc-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet("")} />
            <motion.div key={sheet} className="cc-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}>
              <div className="cc-grab" />
              <div className="mb-3 flex items-center justify-between">
                <p className="cc-px text-xl font-bold">{sheet === "armory" ? "Armory" : sheet === "worlds" ? "Maps" : "How to play"}</p>
                <button type="button" aria-label="Close" className="cc-btn cc-ghost size-10 !rounded-xl p-0" onClick={() => setSheet("")}><X className="size-5" /></button>
              </div>
              <div className="cc-scroll">
                {sheet === "armory" && <Armory onLevels={(l) => gameRef.current?.setLevels(l)} onOutfit={(id) => gameRef.current?.setOutfit(id)} />}
                {sheet === "worlds" && <Maps stage={save.stage} />}
                {sheet === "help" && <Help onPlay={play} game={gameRef} />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ touch controls
function TouchControls({ game, cubes }: { game: React.RefObject<Game | null>; cubes: number }) {
  const [stick, setStick] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const [fire, setFire] = useState(false);
  const [jump, setJump] = useState(false);
  const [build, setBuild] = useState(false);
  const roles = useRef(new Map<number, { role: string; x: number; y: number; ox: number; oy: number }>());
  const R = 52;
  /** a thumb lands on the stick area, the look area, FIRE, JUMP or BUILD (data-role); FIRE and BUILD also look */
  const down = (e: React.PointerEvent<HTMLElement>) => {
    const role = e.currentTarget.dataset.role ?? "look";
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    roles.current.set(e.pointerId, { role, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY });
    const g = game.current;
    if (role === "stick") setStick({ x: e.clientX, y: e.clientY, kx: 0, ky: 0 });
    if (role === "fire") { setFire(true); g?.setFire(true); }
    if (role === "jump") { setJump(true); g?.setJump(true); }
    if (role === "build") { setBuild(true); g?.setBuild(true); }
  };
  const move = (e: React.PointerEvent) => {
    const r = roles.current.get(e.pointerId);
    if (!r) return;
    const g = game.current;
    if (r.role === "stick") {
      let dx = e.clientX - r.ox, dy = e.clientY - r.oy;
      const l = Math.hypot(dx, dy); if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      g?.setMove(dx / R, -dy / R); setStick({ x: r.ox, y: r.oy, kx: dx, ky: dy });
    } else if (r.role !== "jump") { g?.look(e.clientX - r.x, e.clientY - r.y); r.x = e.clientX; r.y = e.clientY; }
  };
  const up = (e: React.PointerEvent) => {
    const r = roles.current.get(e.pointerId);
    if (!r) return;
    roles.current.delete(e.pointerId);
    const g = game.current;
    if (r.role === "stick") { setStick(null); g?.setMove(0, 0); }
    if (r.role === "fire") { setFire(false); g?.setFire(false); }
    if (r.role === "jump") { setJump(false); g?.setJump(false); }
    if (r.role === "build") { setBuild(false); g?.setBuild(false); }
  };
  useEffect(() => () => { const g = game.current; g?.setMove(0, 0); g?.setFire(false); g?.setJump(false); g?.setBuild(false); }, [game]);
  return (
    <>
      <div className="cc-left" data-role="stick" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      <div className="cc-right" data-role="look" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {stick ? <div className="cc-stick" style={{ left: stick.x, top: stick.y }}><div className="cc-knob" style={{ transform: `translate(${stick.kx}px,${stick.ky}px)` }} /></div> : <div className="cc-stickhint">MOVE</div>}
      <div className="cc-btns">
        <div className={`cc-build ${build ? "on" : ""}`} data-role="build" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <Box className="size-7" stroke="#fff" strokeWidth={2.6} /><b>{cubes}</b><small>BUILD</small>
        </div>
        <div className={`cc-jump ${jump ? "on" : ""}`} data-role="jump" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V6M6 11l6-6 6 6" /></svg>
          <small>JUMP</small>
        </div>
        <div className={`cc-fire ${fire ? "on" : ""}`} data-role="fire" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="7" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></svg>
          <small>FIRE</small>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ the stage-clear banner (no buttons: the game moves on by itself)
// ---------------------------------------------------------------- the controls card (computers, when a game starts)
const Kbd = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => <kbd className={`cc-kbd cc-px ${wide ? "wide" : ""}`}>{children}</kbd>;
/** a mouse with its left or right button lit */
function MouseIcon({ side }: { side?: "l" | "r" }) {
  return (
    <svg className="cc-mouse" viewBox="0 0 24 34" aria-hidden>
      <rect x="1.5" y="1.5" width="21" height="31" rx="10.5" fill="#E8EEF8" stroke="#16233F" strokeWidth="2.2" />
      {side === "l" && <path d="M12 2.6V14H2.6V12A9.4 9.4 0 0 1 12 2.6Z" fill="#38D96B" />}
      {side === "r" && <path d="M12 2.6V14H21.4V12A9.4 9.4 0 0 0 12 2.6Z" fill="#FFB627" />}
      <path d="M12 2.5V14M2.5 14H21.5" stroke="#16233F" strokeWidth="2" fill="none" />
      {!side && <path d="M12 20v7M9.5 24.5 12 27l2.5-2.5" stroke="#3D8BFF" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
const Or = () => <span className="cc-or">or</span>;
const COACH: [React.ReactNode, string, string][] = [
  [<><Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd></>, "Move", "or the arrow keys"],
  [<MouseIcon key="k" />, "Aim", "move the mouse"],
  [<MouseIcon key="k" side="l" />, "Fire", "left click · hold to keep firing"],
  [<><MouseIcon side="r" /><Or /><Kbd>E</Kbd></>, "Build cubes", "bridges and walls · hold while you walk off an edge"],
  [<Kbd key="k" wide>Space</Kbd>, "Jump", "hold in the air: jetpack (uses oil)"],
  [<Kbd key="k" wide>Shift</Kbd>, "Sprint", "hold to run faster"],
  [<><Kbd>P</Kbd><Or /><Kbd wide>Esc</Kbd></>, "Pause", "and the menu"],
];
function KeysCoach({ onClose }: { onClose: () => void }) {
  return (
    <motion.div className="cc-coach" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="cc-coach-card cc-panel" role="dialog" aria-label="Controls" initial={{ y: 26, scale: 0.94 }} animate={{ y: 0, scale: 1 }} exit={{ y: -14, scale: 0.97 }} transition={{ type: "spring", stiffness: 340, damping: 26 }}>
        <p className="cc-kicker">How to play</p>
        <div className="cc-coach-grid">
          {COACH.map(([keys, what, more], i) => (
            <motion.div key={what} className="cc-coach-row" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.05 }}>
              <span className="cc-coach-keys">{keys}</span>
              <span className="min-w-0"><b className="block text-[15px] leading-tight">{what}</b><span className="block text-[12px] leading-snug opacity-70">{more}</span></span>
            </motion.div>
          ))}
        </div>
        <button type="button" className="cc-btn cc-cta cc-shine mt-4 w-full py-3 text-lg" onClick={onClose}>
          <Play className="size-5 fill-current" /> <span className="cc-px font-bold">GOT IT · PLAY</span>
        </button>
        <p className="mt-2 text-center text-[12px] font-bold opacity-60">or press any key</p>
      </motion.div>
    </motion.div>
  );
}

function ClearBanner({ r }: { r: StageStats }) {
  const next = stagePlan(r.stage + 1);
  const big = r.worldDone ? "MAP CLEAR!" : r.mode === "titan" ? "TITAN DOWN!" : r.mode === "obby" ? "FINISHED!" : r.mode === "zombie" ? "SURVIVED!" : "VICTORY!";
  return (
    <motion.div className="cc-clear" initial={{ opacity: 0, scale: 0.7, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <p className="text-xs font-extrabold tracking-[.2em] uppercase opacity-85">{r.worldDone ? "Map complete" : `Stage ${r.stage}`}</p>
      <p className="cc-big" style={{ color: r.worldDone ? "#FFD23F" : "#fff", fontSize: "clamp(32px,9.5vw,64px)" }}>{big}</p>
      <div className="cc-stars">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.35 + i * 0.18, type: "spring", stiffness: 400, damping: 14 }}>
            <Star className="size-9" fill={i < r.stars ? "#FFD23F" : "rgba(255,255,255,.2)"} stroke={i < r.stars ? "#C2410C" : "rgba(255,255,255,.35)"} strokeWidth={2} />
          </motion.span>
        ))}
      </div>
      <div className="cc-loot">
        <span className="cc-panel"><CoinIcon />+{r.coins}</span>
        <span className="cc-panel"><Swords className="size-4" />{r.kos} KO</span>
      </div>
      <p className="cc-sub mt-3">Next up: {next.remix ? "Remix" : `Stage ${next.n}`} · {MODE_LABEL[next.mode]} · {next.title}</p>
    </motion.div>
  );
}

// ------------------------------------------------------------------ armory
function OutfitPreview({ look }: { look: SkinLook }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    cv.width = 14; cv.height = 22;
    const c = cv.getContext("2d")!; c.clearRect(0, 0, 14, 22);
    const px = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const helmet = look.style === "astro" || look.style === "knight" || look.style === "robo";
    px(3, 0, 8, 8, helmet ? look.a : look.skin);
    if (!helmet) { px(3, 0, 8, 2, look.hair); px(4, 3, 2, 2, "#1d1d2a"); px(8, 3, 2, 2, "#1d1d2a"); px(5, 6, 4, 1, shade(look.skin, -0.35)); }
    else { px(4, 2, 6, 3, look.style === "knight" ? "#14141c" : look.glow); }
    if (look.style === "ninja") { px(3, 0, 8, 3, look.a); px(3, 5, 8, 3, look.a); px(3, 2, 8, 1, look.b); }
    if (look.style === "kitty") { px(3, 0, 2, 1, "#ffffff"); px(9, 0, 2, 1, "#ffffff"); }
    if (look.style === "wizard") px(4, 5, 6, 3, look.hair);
    px(3, 8, 8, 7, look.style === "pirate" ? look.b : look.a); px(5, 10, 4, 2, look.b);
    px(0, 8, 3, 7, look.a); px(11, 8, 3, 7, look.a); px(0, 14, 3, 1, look.skin); px(11, 14, 3, 1, look.skin);
    px(3, 15, 4, 7, look.c); px(7, 15, 4, 7, look.c); px(3, 20, 4, 2, look.dark); px(7, 20, 4, 2, look.dark);
    px(12, 12, 2, 5, "#3A3F4E"); px(12, 16, 2, 1, look.glow);
  }, [look]);
  return <canvas ref={ref} />;
}
function Armory({ onLevels, onOutfit }: { onLevels: (l: Levels) => void; onOutfit: (id: string) => void }) {
  const s = useClash();
  const [tab, setTab] = useState<"gear" | "outfits">("gear");
  return (
    <div>
      <div className="cc-tabs">
        <button type="button" className={tab === "gear" ? "on" : ""} onClick={() => { sfx("tap"); setTab("gear"); }}>Upgrades</button>
        <button type="button" className={tab === "outfits" ? "on" : ""} onClick={() => { sfx("tap"); setTab("outfits"); }}>Outfits</button>
      </div>
      {tab === "gear" ? UPGRADES.map((u) => {
        const level = s.levels[u.id] ?? 0, cost = upgradeCost(level), max = level >= MAX_LEVEL;
        return (
          <div key={u.id} className="cc-up">
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{u.label}</p>
              <p className="text-xs opacity-70">{u.hint}</p>
              <div className="cc-dots">{Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < level ? "on" : ""} />)}</div>
            </div>
            <button type="button" disabled={max || s.coins < cost} className={`cc-btn ${max ? "cc-ghost" : "cc-cta"} px-3 py-2 text-sm disabled:opacity-50`} onClick={() => { if (s.upgrade(u.id)) { sfx("upgrade"); onLevels(useClash.getState().levels); } }}>
              {max ? <><Check className="size-4" /> Max</> : <><CoinIcon size={16} />{cost.toLocaleString()}</>}
            </button>
          </div>
        );
      }) : (
        <div className="cc-skins">
          {OUTFITS.map((o) => {
            const owned = s.outfits.includes(o.id), on = s.outfit === o.id;
            return (
              <button type="button" key={o.id} className={`cc-skin ${on ? "sel" : ""}`} onClick={() => { if (owned) { s.wear(o.id); onOutfit(o.id); sfx("tap"); } else if (s.buyOutfit(o.id)) { onOutfit(o.id); sfx("buy"); } }}>
                <OutfitPreview look={o.look} />
                <p className="cc-px mt-1 text-base font-bold">{o.name}</p>
                <p className="text-xs font-bold opacity-80">{on ? "✔ Wearing" : owned ? "Owned" : <span className="inline-flex items-center gap-1">{s.coins < o.price && <Lock className="size-3" />}<CoinIcon size={14} />{o.price.toLocaleString()}</span>}</p>
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-3 flex items-center justify-center gap-1 text-sm font-bold opacity-80">You have <CoinIcon size={16} />{s.coins.toLocaleString()}</p>
    </div>
  );
}

// ------------------------------------------------------------------ the theme map
function MapThumb({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const W = 80, H = 55; cv.width = W; cv.height = H;
    const c = cv.getContext("2d")!, t = THEMES[index], s = t.sky;
    for (let y = 0; y < H; y++) { c.fillStyle = mix(s.top, s.bot, Math.floor((y / H) * 8) / 7); c.fillRect(0, y, W, 1); }
    c.fillStyle = t.belowColor; if (t.below !== "void") c.fillRect(0, H - 8, W, 8);
    // floating islands
    for (const [x, y, w] of [[8, 30, 18], [34, 22, 22], [60, 32, 14]] as [number, number, number][]) {
      c.fillStyle = t.pal.top; c.fillRect(x, y, w, 3);
      c.fillStyle = t.pal.soil; c.fillRect(x + 1, y + 3, w - 2, 3);
      c.fillStyle = t.pal.stone; c.fillRect(x + 3, y + 6, w - 6, 3); c.fillRect(x + 6, y + 9, w - 12, 3);
    }
    c.fillStyle = TEAM_COLORS[1]; c.fillRect(44, 17, 3, 5); c.fillStyle = TEAM_COLORS[0]; c.fillRect(14, 25, 3, 5);
    c.fillStyle = "#ffffff"; for (let x = 26; x < 34; x += 2) c.fillRect(x, 27, 1, 1);
  }, [index]);
  return <canvas ref={ref} />;
}
function Maps({ stage }: { stage: number }) {
  const cur = Math.floor((Math.min(stage, DESIGNED_STAGES) - 1) / STAGES_PER_THEME);
  return (
    <div>
      <div className="cc-worlds">
        {THEMES.map((t, i) => {
          const done = Math.max(0, Math.min(STAGES_PER_THEME, stage - 1 - i * STAGES_PER_THEME));
          const lock = i > cur && stage <= DESIGNED_STAGES;
          return (
            <div key={t.id} className={`cc-world ${lock ? "lock" : ""} ${i === cur && stage <= DESIGNED_STAGES ? "now" : ""}`}>
              <MapThumb index={i} />
              <div className="cc-wl">
                <p className="truncate">{lock ? <Lock className="mr-1 inline size-3.5" /> : null}{t.name}</p>
                <p className="text-[11px] font-bold opacity-80">{done}/{STAGES_PER_THEME} stages{t.gravity < 20 ? " · low gravity" : ""}</p>
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
  const s = useClash();
  return (
    <div className="grid gap-2 text-[15px]">
      {[
        [<Swords key="i" className="size-5" stroke="#FF6B5A" />, "Phone: drag the left side to move, drag the right side to aim, hold FIRE to shoot, tap JUMP (hold it in the air for the jetpack), hold BUILD to place cubes. Computer: WASD, mouse to aim, click to shoot, right-click or E to build, Space to jump (hold for the jetpack)."],
        [<Box key="i" className="size-5" stroke="#7CC4FF" />, "Build bridges to cross the gaps between islands — hold BUILD while you walk off an edge and cubes appear under your feet. Break blocks to get cubes back."],
        [<Gem key="i" className="size-5" fill="#FF4D5E" stroke="none" />, "Sky Clash: knock every rival off their island. Crystal Clash: break the enemy crystals and guard yours. Zombie Night: survive the waves. Obby Run: reach the flag — shoot the red targets to build bridges."],
        [<Droplet key="i" className="size-5" fill="#FFB627" stroke="none" />, "Your jetpack runs on oil — it can save you from a fall. Grab the oil cans."],
        [<CoinIcon key="i" size={20} />, "Coins come from knockouts, chests and gold ore. Spend them in the Armory on upgrades and outfits."],
        [<Heart key="i" className="size-5" fill="#FF4F7A" stroke="none" />, "Hearts give lives, green packs give health. When a stage is won, the next one starts by itself — 1,000 stages on 20 maps, then endless remixes."],
      ].map(([i, t], k) => <div key={k} className="flex items-start gap-3 rounded-2xl bg-white/[.06] p-3"><span className="mt-0.5 shrink-0">{i}</span><span>{t}</span></div>)}
      <div className="mt-1 flex items-center justify-between gap-3 rounded-2xl bg-white/[.06] p-3">
        <span><b>Auto-fire</b><br /><span className="text-xs opacity-75">On phones, shoot by itself when a rival or mob is in your sights</span></span>
        <button type="button" aria-label="Auto-fire" className={`cc-toggle ${s.autoFire ? "on" : ""}`} onClick={() => { s.setAutoFire(!s.autoFire); game.current?.setAutoFire(!s.autoFire); sfx("tap"); }}><i /></button>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[.06] p-3">
        <span><b>Look speed</b></span>
        <input type="range" min={0.4} max={2.2} step={0.1} value={s.sens} onChange={(e) => { const v = Number(e.target.value); s.setSens(v); game.current?.setSens(v); }} className="w-40" />
      </div>
      <button type="button" className="cc-btn cc-cta mt-2 py-3 text-lg" onClick={onPlay}><Play className="size-5 fill-current" /> Let&apos;s go</button>
    </div>
  );
}
