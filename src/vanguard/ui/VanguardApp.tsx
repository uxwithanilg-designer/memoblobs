"use client";
// Voxel Vanguard: the screens around the 3D fight — the home screen over the squad standing in the sector (the
// operation's card: its codename, world, sectors and phases, how long it runs, the robots coming, the boss, where you
// left off), the HUD (health, lives, squad mates, operation / sector / phase, the objective with its progress, boss bar,
// coins, power timers; the radar, objective markers and crosshair are drawn by the game), the twin-stick thumb controls
// (a floating move stick on the left, drag anywhere on the right to aim, FIRE (drag it to aim too), JET with its oil
// ring, SWAP with the ammo count, VIEW), the banners that tell you "Operation Iron Fern started!", each phase, sector
// and boss with no pages in between, the Armory (blasters, suit, outfits) and the world map.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Map as MapIcon, Play, Swords, HelpCircle, X, Lock, Check, Heart, Eye, Repeat2, Crosshair, Flame, Shield, Magnet, Zap, Gauge, Coins as CoinsIcon, Clock, Flag } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { useProfile } from "@/lib/store";
import { Game, type GameEvent, type Hud, type PowerId } from "../game";
import { phasesIn, robotsIn, sectorView, stagePlan, whereOf, type Objective, type StagePlan } from "../stages";
import { DESIGNED_STAGES, STAGES_PER_WORLD, WORLDS, worldOf, type RobotKind } from "../worlds";
import { MAX_LEVEL, OUTFITS, ROBOTS, SUIT, WEAPONS, suitCost, weaponOf, weaponUpgradeCost, type Outfit, type WeaponId } from "../gear";
import { useVanguard, useVanguardHydrated, START_LIVES, MAX_LIVES, SUIT_MAX } from "../save";
import { VANGUARD_SOUNDS, UI_SOUNDS, sfx } from "../sound";
import { VanguardMusic } from "../music";
import { VANGUARD_CSS } from "./styles";

type Sheet = "" | "armory" | "worlds" | "help";
interface Banner { id: number; big: string; sub?: string; color?: string; ms: number }

// ---------------------------------------------------------------- pixel icons (emoji differ from device to device)
function PixelArt({ rows, pal, size = 4, className }: { rows: string[]; pal: Record<string, string>; size?: number; className?: string }) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  return (
    <svg className={className} width={w * size} height={h * size} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((r, y) => [...r].map((ch, x) => (pal[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={pal[ch]} /> : null)))}
    </svg>
  );
}
const GUN_ROWS: Record<WeaponId, string[]> = {
  zapper: ["...ccccc......", "..mmmmmmmmml..", "..mmmmmmmmmmc.", "...dd.........", "...dd........."],
  pulse: ["....cccccc......", "mmmmmmmmmmmmml..", "mmmmmmmmmmmmmmmc", "mm..dd..dd......", "....dd.........."],
  scatter: ["...cccccc.......", "..mmmmmmmmmmmdd.", "..mmmmmmmmmmmdd.", "..ww.dd.........", "..ww.dd........."],
  rail: ["....ddd...........", "mmmmmmmmlllllllll.", "mmmmmmmmccmmmccmml", "mm..dd............", "....dd............"],
  boom: ["...ddd.........", "mmmmmmmmmmmmmc.", "mmmmmmmmmmmmmc.", "mmmmmmmmmmmmmc.", "....dd........."],
  arc: ["...cccc.......", "..mmmmmmmc.c.c", "..mmmmmmmc.c.cl", "...dd.........", "...dd........."],
};
export function GunIcon({ id, size = 4 }: { id: WeaponId; size?: number }) {
  const w = weaponOf(id);
  return <PixelArt rows={GUN_ROWS[id]} pal={{ m: "#8A90A6", d: "#2A2D3A", c: w.color, l: w.glow, w: "#8A5A36" }} size={size} />;
}
function AceHead({ o, size = 3 }: { o: Outfit; size?: number }) {
  return <PixelArt rows={["..ssss..", ".ssttss.", "ssssssss", "vvvvvvvv", "vVvvvvvv", "ssffffss", ".ffffff."]} pal={{ s: o.suit, t: o.trim, v: o.visor, V: "#FFFFFF", f: "#E8B48A" }} size={size} />;
}
function MateHead({ kind, size = 3 }: { kind: "juno" | "brick"; size?: number }) {
  return kind === "juno"
    ? <PixelArt rows={["..hhhh..", ".hhhhhh.", "hhffffhh", "hfwfwffh", "hfefefff", ".ffrrff.", "..ffff.."]} pal={{ h: "#5A2A1A", f: "#F2C9A0", w: "#FFFFFF", e: "#2A3A6A", r: "#C85A5A" }} size={size} />
    : <PixelArt rows={["..rrrr..", ".rrrrrr.", "ffffffff", "kkkkkkkk", "ffffffff", "fbbbbbbf", ".bbffbb."]} pal={{ r: "#C8402A", f: "#8A5A3E", k: "#14141C", b: "#3A2418" }} size={size} />;
}
const BOT_ROWS: Record<RobotKind, string[]> = {
  scout: [".mmmmmm.", "mddddddm", "mdeEddddm", "mddddddm", ".mmmmmm."],
  trooper: ["mmmmmmm", "mdddddm", "meedeem", "mmmmmmm", ".m.m.m."],
  roller: [".oooo.", "ommmmo", "omeemo", "ommmmo", ".oooo."],
  drone: ["d..d..d", "ddddddd", ".mmmmm.", ".mmeem.", "..ddd.."],
  brute: ["oooooooo", "mmmmmmmm", "mdeeeedm", "mmmmmmmm", "mm.mm.mm"],
  sniper: ["..mmm..", "..mpm..", ".mmmmm.", "..m.m..", "..m.m.."],
  spider: ["..mmmm..", ".meemem.", "mmmmmmmm", "m.m..m.m", "m......m"],
};
function BotIcon({ kind, size = 3 }: { kind: RobotKind; size?: number }) {
  return <PixelArt rows={BOT_ROWS[kind]} pal={{ m: "#8A92A6", d: "#2A2D3A", e: "#FF3A3A", E: "#FF8A8A", o: "#FF8A2A", p: "#FF5AF0" }} size={size} />;
}
function CoinIcon({ size = 18 }: { size?: number }) {
  return <PixelArt rows={[".gggg.", "gyyyyg", "gyhyyg", "gyyyyg", "gyyyyg", ".gggg."]} pal={{ g: "#C8861A", y: "#FFC93D", h: "#FFF0A0" }} size={size / 6} />;
}
const Hearts = ({ n, of }: { n: number; of: number }) => (
  <span className="vv-hearts">{Array.from({ length: of }, (_, i) => <PixelArt key={i} rows={[".r.r.", "rrrrr", "rrrrr", ".rrr.", "..r.."]} pal={{ r: i < n ? "#FF3D6E" : "rgba(255,255,255,.25)" }} size={3.2} />)}</span>
);
const POWER_ICON: Record<PowerId, React.ReactNode> = {
  rapid: <Zap className="size-4" fill="#FFD23F" stroke="none" />, damage: <Flame className="size-4" fill="#FF4A4A" stroke="none" />,
  shield: <Shield className="size-4" fill="#5AB8FF" stroke="none" />, magnet: <Magnet className="size-4" stroke="#FF5AC8" strokeWidth={2.6} />, speed: <Gauge className="size-4" stroke="#5CE07A" strokeWidth={2.6} />,
};
const POWER_COL: Record<PowerId, string> = { rapid: "#FFD23F", damage: "#FF4A4A", shield: "#5AB8FF", magnet: "#FF5AC8", speed: "#5CE07A" };
const OBJ_COL: Record<Objective, string> = { assault: "#FFFFFF", survive: "#FFD23F", defend: "#5BF0FF", sabotage: "#FF5A8A", capture: "#FFD23F", elite: "#FFC93D", boss: "#FF5A7A" };
const POWER_NAME: Record<string, string> = { rapid: "Rapid fire!", damage: "Double damage!", shield: "Shield up!", magnet: "Coin magnet!", speed: "Speed boost!", heart: "Health up!", oil: "Jet oil full!" };

export default function VanguardApp({ slug }: { slug: string; title: string }) {
  const ready = useVanguardHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const save = useVanguard();
  const [screen, setScreen] = useState<"home" | "play">("home");
  const [sheet, setSheet] = useState<Sheet>("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; color: string } | null>(null);
  const [btn, setBtn] = useState({ fire: false, jet: false });
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [hurt, setHurt] = useState(0);
  const [locked, setLocked] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const coinsRef = useRef(0);
  const [touchDevice] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const [gameReady, setGameReady] = useState(false);

  const say = useCallback((big: string, sub?: string, color?: string, ms = 1600) => {
    const id = Math.random();
    setBanner({ id, big, sub, color, ms });
    setTimeout(() => setBanner((b) => (b?.id === id ? null : b)), ms);
  }, []);
  const toastIt = useCallback((text: string, color = "#5CF08A") => {
    const id = Math.random();
    setToast({ id, text, color });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1500);
  }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Charging blasters");
    void audio.preload(UI_SOUNDS);
    void audio.preload(VANGUARD_SOUNDS);
    // the site's own music player stays quiet: the music is composed live (src/vanguard/music.ts)
    void audio.stopMusic(0.2);
  }, []);
  const music = useRef<VanguardMusic | null>(null);
  useEffect(() => {
    const m = new VanguardMusic();
    music.current = m;
    m.title();
    return () => { m.dispose(); music.current = null; };
  }, []);

  const onEvent = useCallback((e: GameEvent) => {
    const g = gameRef.current;
    switch (e.k) {
      case "start": {
        const p = sectorView(stagePlan(e.stage), e.sector);
        music.current?.stage(p);
        const fresh = e.sector === 0 && e.phase === 0;
        const big = e.restart ? `${e.codename} — again!` : fresh ? `${e.codename} started!` : e.phase === 0 ? `Sector ${e.sector + 1}: ${e.sectorName}` : `Back in ${e.sectorName}`;
        const sub = fresh ? `${whereOf(p)} · ${e.sectors} sectors · about ${e.minutes} min` : `${e.codename} · sector ${e.sector + 1} of ${e.sectors}`;
        setTimeout(() => say(big, sub, fresh ? "#FFD23F" : "#FFFFFF", 2800), 250);
        sfx("start", { delay: 0.2 });
        if (!useVanguard.getState().seenHelp) { setTimeout(() => toastIt(touchDevice ? "Left: move · Right: aim · Hold FIRE" : "Click to aim · WASD · Space jet · Q swap", "#FFD23F"), 3400); useVanguard.getState().sawHelp(); }
        break;
      }
      case "phase": if (e.kind !== "boss") say(e.again ? `Phase ${e.phase} — again` : `Phase ${e.phase}: ${e.title}`, e.hint, OBJ_COL[e.kind], 2800); break;
      case "boss": { if (g) music.current?.stage(g.plan, true); say(e.name, "The boss is here — take it down!", "#FF4A6A", 2600); break; }
      case "phaseClear": say("Phase complete!", `+${e.coins} coins · get ready`, "#5CF08A", 2000); break;
      case "zone": toastIt(`Relay captured! ${e.left} to go`, "#FFD23F"); break;
      case "sectorClear": say("Sector clear!", `${e.name} is ours · +${e.coins} coins`, "#5CF08A", 2800); break;
      case "fail": say(e.why, "The phase starts over", "#FF5A6A", 2600); break;
      case "clear": {
        say("Operation complete!", `+${e.coins} coins · ${e.kills} robots`, "#5CF08A", 2800);
        const s = useVanguard.getState();
        s.setCoins(g?.coins ?? s.coins);
        useProfile.getState().earnCoins(8 + Math.floor(e.stage / 15));
        if (e.stage % STAGES_PER_WORLD === 0 && e.stage <= DESIGNED_STAGES) setTimeout(() => say("World complete!", `${worldOf(stagePlan(e.stage + 1).world).name} next`, "#FFD23F", 2600), 2900);
        track("vanguard_clear", { stage: e.stage, kills: e.kills });
        break;
      }
      case "pickup": if (e.what !== "coin" && e.what !== "gem") toastIt(POWER_NAME[e.what] ?? "", POWER_COL[e.what as PowerId] ?? (e.what === "heart" ? "#FF5A8A" : "#FF8A3A")); break;
      case "hurt": setHurt((h) => h + 1); break;
      case "down": say("You're down!", e.livesLeft > 0 ? `${e.livesLeft} ${e.livesLeft === 1 ? "life" : "lives"} left` : "No lives left · the phase starts over", "#FF5A6A", 2000); break;
      case "restart": break;
      case "ally": toastIt(e.up ? `${e.name} is back up!` : `${e.name} is down!`, e.up ? "#5CF08A" : "#FF8A6A"); break;
      case "lowFuel": toastIt("Jet oil low — grab an oil can!", "#FF8A3A"); break;
      case "kill": if (e.streak === 3 || e.streak === 5 || e.streak % 10 === 0) toastIt(e.streak >= 10 ? `Unstoppable! ${e.streak} robots` : e.streak >= 5 ? `Rampage! ${e.streak} in a row` : "Triple takedown!", "#FFD23F"); break;
      case "fell": toastIt("Fell off! Back to the pad", "#FF8A6A"); break;
      case "view": useVanguard.getState().setView(e.first); break;
      case "reload": break;
    }
  }, [say, toastIt, touchDevice]);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const s = useVanguard.getState();
    coinsRef.current = s.coins;
    let flush: ReturnType<typeof setTimeout> | null = null;
    const g = new Game(host.current, {
      weapons: s.loadout, levels: s.levels, suit: s.suit, outfit: s.outfit, lives: s.lives || START_LIVES, coins: s.coins, firstPerson: s.firstPerson,
      onHud: (h) => setHud(h),
      onEvent: (e) => onEventRef.current(e),
      onCoins: (n) => { coinsRef.current = n; if (!flush) flush = setTimeout(() => { flush = null; useVanguard.getState().setCoins(coinsRef.current); }, 900); },
      onLives: (n) => useVanguard.getState().setLives(n),
      onStage: (next, kills) => useVanguard.getState().clear(next, kills),
      onCheckpoint: (stage, sector, phase, kills) => useVanguard.getState().checkpoint(stage, sector, phase, kills),
    });
    gameRef.current = g;
    g.load(s.stage, "attract", false, { sector: s.sector, phase: s.phase });
    g.start();
    loadRef.current(null);
    setGameReady(true);
    const lock = () => setLocked(document.pointerLockElement != null);
    document.addEventListener("pointerlockchange", lock);
    return () => { document.removeEventListener("pointerlockchange", lock); if (flush) { clearTimeout(flush); useVanguard.getState().setCoins(coinsRef.current); } g.dispose(); gameRef.current = null; setGameReady(false); };
  }, [ready]);

  const powered = !!hud?.powers.length;
  useEffect(() => { music.current?.fever(powered); }, [powered]);
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    if (paused) { g.stop(); g.setFire(false); music.current?.pause(); if (document.pointerLockElement) document.exitPointerLock?.(); } else { g.start(); music.current?.resume(); }
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
  }, []);
  const home = useCallback(() => {
    const g = gameRef.current;
    setScreen("home");
    if (g) { const s = useVanguard.getState(); g.setFire(false); g.setMove(0, 0); g.load(s.stage, "attract", false, { sector: s.sector, phase: s.phase }); }
    if (document.pointerLockElement) document.exitPointerLock?.();
    music.current?.title();
  }, []);
  const refreshGear = useCallback(() => {
    const s = useVanguard.getState();
    gameRef.current?.setLoadout(s.loadout, s.levels, s.suit, s.outfit);
  }, []);
  useEffect(() => {
    setMenu(screen === "play" ? [
      { id: "restart", label: "Restart phase", onSelect: () => { const g = gameRef.current; if (g) g.load(g.stage, "intro", true, { sector: g.sectorI, phase: g.phaseI }); } },
      { id: "armory", label: "Armory", onSelect: () => { home(); setSheet("armory"); } },
      { id: "home", label: "Main menu", onSelect: home },
    ] : []);
  }, [screen, setMenu, home]);

  // ---------------------------------------------------------------- thumbs: move stick, aim drag, buttons
  const roles = useRef(new Map<number, { role: "move" | "look" | "fire" | "jet"; x: number; y: number; ox: number; oy: number }>());
  const R = 56;
  const updateStick = useCallback(() => {
    let m: { x: number; y: number; ox: number; oy: number } | null = null;
    for (const v of roles.current.values()) if (v.role === "move") m = v;
    const g = gameRef.current;
    if (!m) { g?.setMove(0, 0); setStick(null); return; }
    let dx = m.x - m.ox, dy = m.y - m.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    g?.setMove(dx / R, -dy / R);
    setStick({ x: m.ox, y: m.oy, dx, dy });
  }, []);
  const down = useCallback((role: "move" | "look" | "fire" | "jet") => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = (e.currentTarget.closest(".vv-root") as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    roles.current.set(e.pointerId, { role, x, y, ox: x, oy: y });
    const g = gameRef.current;
    if (role === "fire") { g?.setFire(true); setBtn((b) => ({ ...b, fire: true })); }
    if (role === "jet") { g?.setJet(true); setBtn((b) => ({ ...b, jet: true })); }
    if (role === "move") updateStick();
  }, [updateStick]);
  const moveP = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const v = roles.current.get(e.pointerId);
    if (!v) return;
    const rect = (e.currentTarget.closest(".vv-root") as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (v.role === "look" || v.role === "fire") gameRef.current?.turn((x - v.x) * 1.15, (y - v.y) * 1.15);
    v.x = x; v.y = y;
    if (v.role === "move") updateStick();
  }, [updateStick]);
  const up = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const v = roles.current.get(e.pointerId);
    if (!v) return;
    roles.current.delete(e.pointerId);
    const g = gameRef.current;
    if (v.role === "fire") { g?.setFire(false); setBtn((b) => ({ ...b, fire: false })); }
    if (v.role === "jet") { g?.setJet(false); setBtn((b) => ({ ...b, jet: false })); }
    if (v.role === "move") updateStick();
  }, [updateStick]);

  // ---------------------------------------------------------------- render
  const plan = stagePlan(save.stage);
  const acc = hud?.accent ?? worldOf(plan.world).accent;
  const playing = screen === "play" && hud?.mode === "play";
  const cine = screen === "play" && hud && hud.mode !== "play";
  const hpK = hud ? hud.hp / hud.maxHp : 1;

  return (
    <div className="vv-root" style={{ ["--acc" as string]: acc }} data-slug={slug}>
      <style>{VANGUARD_CSS}</style>
      <div ref={host} className="vv-stage" />

      {screen === "home" && (
        <div className="vv-ui">
          <div className="vv-home">
            <div className="flex flex-col items-center gap-3">
              <div className="vv-logo" aria-label="Voxel Vanguard">
                <span className="l1" style={{ ["--c" as string]: "#7CFF8A", ["--d" as string]: "#1E7A3A" }}>VOXEL</span>
                <span className="l2" style={{ ["--c" as string]: "#FFD23F", ["--d" as string]: "#A8661A" }}>VANGUARD</span>
              </div>
              <p className="vv-tag">Run · Gun · Jetpack</p>
            </div>
            <div className="flex w-full flex-col items-center gap-3">
              <OpCard plan={plan} sector={save.sector} phase={save.phase} />
              <div className="flex w-[min(420px,100%)] items-center justify-between px-1">
                <span className="vv-pill vv-cap vv-px"><CoinIcon />{save.coins.toLocaleString()}</span>
                <span className="vv-pill vv-cap vv-px"><Swords className="size-[16px]" stroke="#FF8A6A" strokeWidth={2.6} />{save.kills.toLocaleString()}</span>
                <Hearts n={save.lives} of={MAX_LIVES} />
              </div>
              <button type="button" className="vv-btn vv-cta vv-px w-[min(420px,100%)] py-4 text-2xl" onClick={play} disabled={!gameReady}>
                <Play className="size-7 fill-current" /> <span className="vv-display">{save.sector > 0 || save.phase > 0 ? "Resume operation" : save.stage === 1 ? "Deploy squad" : "Start operation"}</span>
              </button>
              <div className="grid w-[min(420px,100%)] grid-cols-3 gap-2">
                <button type="button" className="vv-btn vv-ghost vv-px py-3 text-sm" onClick={() => { sfx("open"); setSheet("armory"); }}><Crosshair className="size-5" /> Armory</button>
                <button type="button" className="vv-btn vv-ghost vv-px py-3 text-sm" onClick={() => { sfx("open"); setSheet("worlds"); }}><MapIcon className="size-5" /> Worlds</button>
                <button type="button" className="vv-btn vv-ghost vv-px py-3 text-sm" onClick={() => { sfx("open"); setSheet("help"); }}><HelpCircle className="size-5" /> Help</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "play" && hud && (
        <div className={`vv-hud ${cine ? "vv-cine" : ""}`}>
          {hurt > 0 && <div key={hurt} className="vv-hurt vv-flash" />}
          {hpK < 0.3 && playing && <div className="vv-hurt vv-low" />}
          {/* move and aim zones (under the buttons) */}
          {playing && touchDevice && (
            <>
              <div className="vv-move" onPointerDown={down("move")} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} />
              <div className="vv-look" onPointerDown={down("look")} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} />
              <div className={`vv-stick ${stick ? "" : "idle"}`} style={{ left: stick ? stick.x : 92, top: stick ? stick.y : "calc(100% - 120px)" }}><i style={{ transform: stick ? `translate(${stick.dx}px,${stick.dy}px)` : undefined }} /></div>
            </>
          )}
          <div className="vv-tl">
            <div className="vv-hp" style={{ ["--hc" as string]: hpK > 0.5 ? "#5CF08A" : hpK > 0.25 ? "#FFD23F" : "#FF4A4A" }}><i style={{ width: `${hpK * 100}%` }} /><b>{Math.ceil(hud.hp)} / {hud.maxHp}</b></div>
            <Hearts n={hud.lives} of={Math.max(3, hud.lives)} />
            <div className="vv-mates">
              {hud.allies.map((a) => (
                <div key={a.name} className={`vv-mate vv-cap vv-px ${a.down ? "down" : ""}`}>
                  <MateHead kind={a.name === "Juno" ? "juno" : "brick"} size={2.5} />
                  <span className="bar"><i style={{ width: `${a.down ? 0 : a.hp * 100}%`, background: a.color }} /></span>
                </div>
              ))}
            </div>
          </div>
          <div className="vv-tc vv-keep">
            <div className="vv-wave vv-cap vv-px"><span className="op">{hud.remix ? "Remix" : "Op"} <em>{hud.remix ? hud.stage - DESIGNED_STAGES : hud.stage}</em> ·</span> Sector <em>{hud.sector}/{hud.sectors}</em> · Phase <em>{hud.phase}/{hud.phases}</em></div>
            {hud.obj && !hud.boss && (
              <div className={`vv-obj vv-px ${hud.obj.done ? "done" : ""}`} style={{ ["--oc" as string]: OBJ_COL[hud.obj.kind] }}>
                <p className="t">{hud.obj.title}</p>
                <p className="l">{hud.obj.line}</p>
                <div className="bar"><i style={{ width: `${hud.obj.prog * 100}%` }} /></div>
              </div>
            )}
            {hud.boss && <div className="vv-boss vv-cap vv-px"><p>{hud.boss.name}</p><div className="bar"><i style={{ width: `${hud.boss.hp * 100}%` }} /></div></div>}
            {hud.powers.length > 0 && (
              <div className="vv-powers">
                {hud.powers.map((p) => (
                  <div key={p.id} className="vv-power vv-px">
                    <svg className="ring" viewBox="0 0 36 36"><rect x="2" y="2" width="32" height="32" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" /><rect x="2" y="2" width="32" height="32" fill="none" stroke={POWER_COL[p.id]} strokeWidth="3" strokeDasharray={`${(p.left / p.secs) * 128} 200`} /></svg>
                    {POWER_ICON[p.id]}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="vv-tr"><span className="vv-pill vv-cap vv-px"><CoinIcon />{hud.coins.toLocaleString()}</span></div>
          {/* the thumb buttons */}
          <div className="vv-acts">
            <button type="button" aria-label="Fire" className={`vv-act vv-fire ${btn.fire ? "on" : ""}`} onPointerDown={down("fire")} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up}>
              {hud.reload >= 0 && <svg className="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3" /><circle cx="22" cy="22" r="20" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray={`${hud.reload * 125.6} 200`} /></svg>}
              <Crosshair className="size-10" strokeWidth={2.6} />
              <small>{hud.reload >= 0 ? "RELOAD" : "FIRE"}</small>
            </button>
            <button type="button" aria-label="Jetpack" className={`vv-act vv-jet ${btn.jet ? "on" : ""} ${hud.fuel < 0.05 ? "off" : ""}`} onPointerDown={down("jet")} onPointerUp={up} onPointerCancel={up}>
              <svg className="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" /><circle cx="22" cy="22" r="20" fill="none" stroke={hud.fuel < 0.25 ? "#FF8A3A" : "#FFD23F"} strokeWidth="3" strokeDasharray={`${hud.fuel * 125.6} 200`} /></svg>
              <Flame className="size-7" fill="#fff" stroke="none" />
              <small>JET</small>
            </button>
            <button type="button" aria-label="Swap blaster" className={`vv-act vv-swap ${hud.weapons[0] === hud.weapons[1] ? "off" : ""}`} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); gameRef.current?.swap(); }}>
              <GunIcon id={hud.weapon} size={2.6} />
              <small>{hud.weapons[0] === hud.weapons[1] ? weaponOf(hud.weapon).name.toUpperCase() : "SWAP"}</small>
            </button>
            <button type="button" aria-label="Change view" className="vv-act vv-view" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); const f = gameRef.current?.toggleView(); if (f !== undefined) useVanguard.getState().setView(f); sfx("tap"); }}>
              <Eye className="size-5" />
            </button>
          </div>
          <div className="vv-ammo">{hud.ammo}<span className="text-sm opacity-70">/{hud.mag}</span></div>
          {!touchDevice && playing && !locked && <div className="vv-aimhint vv-cap vv-px">Click to aim · Esc to let go</div>}
          {!touchDevice && playing && <div className="vv-keys vv-cap vv-px">WASD move · Mouse aim · Click fire · Space jet · Shift run · Q swap · R reload · V view</div>}
        </div>
      )}

      <AnimatePresence>
        {banner && (
          <motion.div key={banner.id} className="vv-banner" initial={{ opacity: 0, x: -60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }} transition={{ type: "spring", stiffness: 380, damping: 26 }}>
            <p className="vv-big" style={{ ["--c" as string]: banner.color }}>{banner.big}</p>
            {banner.sub && <p className="vv-sub vv-px">{banner.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast.id} className="vv-toast vv-cap vv-px" style={{ color: toast.color }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{toast.text}</motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div key="veil" className="vv-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet("")} />
            <motion.div key={sheet} className="vv-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}>
              <div className="mb-3 flex items-center justify-between">
                <p className="vv-display text-2xl">{sheet === "armory" ? "Armory" : sheet === "worlds" ? "Worlds" : "How to play"}</p>
                <button type="button" aria-label="Close" className="vv-btn vv-ghost vv-px size-10 p-0" onClick={() => setSheet("")}><X className="size-5" /></button>
              </div>
              <div className="vv-scroll">
                {sheet === "armory" && <Armory onChange={refreshGear} />}
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

// ---------------------------------------------------------------- the operation card
function OpCard({ plan, sector, phase }: { plan: StagePlan; sector: number; phase: number }) {
  const kinds = new Set<RobotKind>();
  for (const s of plan.sectors) for (const ph of s.phases) for (const [k] of ph.mix) kinds.add(k);
  const resume = sector > 0 || phase > 0;
  return (
    <div className="vv-card vv-px">
      <span className="vv-strip" />
      <div className="flex items-center justify-between gap-2">
        <span className="vv-kicker truncate">{whereOf(plan)}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-extrabold opacity-80"><Clock className="size-3.5" />{plan.minutes}+ min</span>
      </div>
      <p className="vv-display mt-2 truncate text-[22px] leading-tight">{plan.codename}</p>
      <p className="truncate text-xs font-bold opacity-75">{plan.sectors.length} sectors · {phasesIn(plan)} phases · ~{robotsIn(plan).toLocaleString()} robots · Boss: {ROBOTS[plan.boss].name}</p>
      <div className="vv-sectors">
        {plan.sectors.map((s, i) => <span key={i} className={`vv-sec vv-px ${i < sector ? "done" : i === sector ? "now" : ""}`}>{i < sector ? <Check className="size-3" /> : <Flag className="size-3" />}{s.name}</span>)}
      </div>
      <div className="vv-bots">
        {[...kinds].slice(0, 5).map((k) => <span key={k} className="vv-bot vv-px"><BotIcon kind={k} size={2.5} />{ROBOTS[k].name}</span>)}
      </div>
      {resume && <p className="mt-2 text-xs font-extrabold" style={{ color: "var(--acc)" }}>Resume: sector {sector + 1} · {plan.sectors[sector]?.phases[phase]?.title ?? "next phase"}</p>}
      {!plan.remix && (
        <div className="vv-short mt-2">
          <div className="mb-1 flex justify-between text-[11px] font-extrabold opacity-70"><span>Operation {plan.local} of {STAGES_PER_WORLD} in this world</span><span>{plan.n} / {DESIGNED_STAGES}</span></div>
          <div className="vv-progress"><i style={{ width: `${(plan.local / STAGES_PER_WORLD) * 100}%` }} /></div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the armory
function Armory({ onChange }: { onChange: () => void }) {
  const s = useVanguard();
  const [tab, setTab] = useState<"guns" | "suit" | "outfit">("guns");
  return (
    <div>
      <div className="vv-tabs">
        {(["guns", "suit", "outfit"] as const).map((t) => <button type="button" key={t} className={`vv-tab vv-px ${tab === t ? "on" : ""}`} onClick={() => { sfx("tap"); setTab(t); }}>{t === "guns" ? "Blasters" : t === "suit" ? "Suit" : "Outfits"}</button>)}
      </div>
      {tab === "guns" && (
        <div>
          <p className="text-sm opacity-80">You carry two blasters. Tap A or B to choose which slot a blaster goes in.</p>
          {WEAPONS.map((w) => {
            const owned = s.owned.includes(w.id), lv = s.levels[w.id] ?? 0, cost = weaponUpgradeCost(w, lv);
            const inA = s.loadout[0] === w.id, inB = s.loadout[1] === w.id;
            return (
              <div key={w.id} className={`vv-item vv-px ${inA || inB ? "sel" : ""}`}>
                <div className="grid w-[74px] shrink-0 place-items-center"><GunIcon id={w.id} size={4.4} /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{w.name} {inA && <span className="vv-slot">A</span>} {inB && <span className="vv-slot">B</span>}</p>
                  <p className="text-xs opacity-70">{w.tagline}</p>
                  {owned && <div className="vv-dots">{Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < lv ? "on" : ""} />)}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {owned ? (
                    <>
                      <div className="flex gap-1">
                        <button type="button" className={`vv-btn ${inA ? "vv-cta" : "vv-ghost"} vv-px h-8 w-8 p-0 text-sm`} onClick={() => { s.equip(0, w.id); sfx("equip"); onChange(); }}>A</button>
                        <button type="button" className={`vv-btn ${inB ? "vv-cta" : "vv-ghost"} vv-px h-8 w-8 p-0 text-sm`} onClick={() => { s.equip(1, w.id); sfx("equip"); onChange(); }}>B</button>
                      </div>
                      <button type="button" disabled={lv >= MAX_LEVEL || s.coins < cost} className="vv-btn vv-ghost vv-px px-2 py-1 text-xs" onClick={() => { if (s.upgradeWeapon(w.id)) { sfx("upgrade"); onChange(); } }}>
                        {lv >= MAX_LEVEL ? <><Check className="size-3.5" /> Max</> : <><CoinIcon size={13} />{cost.toLocaleString()}</>}
                      </button>
                    </>
                  ) : (
                    <button type="button" disabled={s.coins < w.price} className="vv-btn vv-cta vv-px px-3 py-2 text-sm" onClick={() => { if (s.buyWeapon(w.id)) { sfx("buy"); onChange(); } }}>
                      {s.coins < w.price ? <Lock className="size-4" /> : null}<CoinIcon size={15} />{w.price.toLocaleString()}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === "suit" && SUIT.map((u) => {
        const lv = s.suit[u.id], cost = suitCost(lv);
        return (
          <div key={u.id} className="vv-item vv-px">
            <div className="grid size-10 shrink-0 place-items-center">{u.id === "armor" ? <Shield className="size-7" stroke="#5AB8FF" /> : u.id === "jet" ? <Flame className="size-7" stroke="#FFB03A" /> : <Gauge className="size-7" stroke="#5CE07A" />}</div>
            <div className="min-w-0 flex-1"><p className="font-extrabold">{u.label}</p><p className="text-xs opacity-70">{u.hint}</p><div className="vv-dots">{Array.from({ length: SUIT_MAX }, (_, i) => <i key={i} className={i < lv ? "on" : ""} />)}</div></div>
            <button type="button" disabled={lv >= SUIT_MAX || s.coins < cost} className="vv-btn vv-cta vv-px px-3 py-2 text-sm" onClick={() => { if (s.upgradeSuit(u.id)) { sfx("upgrade"); onChange(); } }}>
              {lv >= SUIT_MAX ? <><Check className="size-4" /> Max</> : <><CoinIcon size={15} />{cost.toLocaleString()}</>}
            </button>
          </div>
        );
      })}
      {tab === "outfit" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OUTFITS.map((o) => {
            const owned = s.outfits.includes(o.id), on = s.outfit === o.id;
            return (
              <button type="button" key={o.id} className={`vv-item vv-px m-0 flex-col !items-center text-white ${on ? "sel" : ""}`} onClick={() => { if (owned) { s.wear(o.id); sfx("equip"); onChange(); } else if (s.buyOutfit(o.id)) { sfx("buy"); onChange(); } }}>
                <AceHead o={o} size={6} />
                <p className="font-extrabold">{o.name}</p>
                <p className="flex items-center gap-1 text-xs opacity-80">{owned ? (on ? "Wearing" : "Owned") : <><CoinIcon size={13} />{o.price.toLocaleString()}</>}</p>
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-3 flex items-center justify-center gap-1 text-sm font-bold opacity-80">You have <CoinIcon size={15} />{s.coins.toLocaleString()}</p>
    </div>
  );
}

// ---------------------------------------------------------------- worlds
function WorldThumb({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const w = WORLDS[index], W = 64, H = 44;
    cv.width = W; cv.height = H;
    const c = cv.getContext("2d")!;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, w.sky[0]); g.addColorStop(0.6, w.sky[1]); g.addColorStop(1, w.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // a pixel skyline of the world's scenery, then the ground blocks
    let seed = index * 97 + 13;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const far = w.backdrop === "skyline" || w.backdrop === "fortress" ? "#2A2E4A" : w.palette.side;
    for (let x = 0; x < W; x += 4) { const h = 6 + Math.floor(rnd() * (w.backdrop === "skyline" || w.backdrop === "fortress" ? 18 : 10)); c.fillStyle = far; c.fillRect(x, H - 12 - h, 4, h); if (w.backdrop === "skyline") { c.fillStyle = "#FFD88A"; if (rnd() < 0.6) c.fillRect(x + 1, H - 10 - h + 3, 1, 1); } }
    c.fillStyle = w.palette.top; c.fillRect(0, H - 12, W, 3);
    c.fillStyle = w.palette.side; c.fillRect(0, H - 9, W, 9);
    for (let x = 0; x < W; x += 2) { c.fillStyle = rnd() < 0.5 ? w.palette.deep : w.palette.side; c.fillRect(x, H - 6 + Math.floor(rnd() * 5), 1, 1); }
    c.fillStyle = w.palette.glow; c.fillRect(Math.floor(W * 0.7), H - 15, 3, 3);
  }, [index]);
  return <canvas ref={ref} />;
}
function Worlds({ stage }: { stage: number }) {
  const cur = Math.floor((Math.min(stage, DESIGNED_STAGES) - 1) / STAGES_PER_WORLD);
  return (
    <div>
      <div className="vv-worlds">
        {WORLDS.map((w, i) => {
          const done = Math.max(0, Math.min(STAGES_PER_WORLD, stage - 1 - i * STAGES_PER_WORLD));
          const lock = i > cur && stage <= DESIGNED_STAGES;
          return (
            <div key={w.id} className={`vv-world vv-px ${lock ? "lock" : ""} ${i === cur && stage <= DESIGNED_STAGES ? "now" : ""}`}>
              <WorldThumb index={i} />
              <div className="lbl">
                <p className="truncate">{lock ? <Lock className="mr-1 inline size-3.5" /> : null}{w.name}</p>
                <p className="truncate text-[11px] font-bold opacity-80">{done}/{STAGES_PER_WORLD} · Boss: {ROBOTS[w.boss].name}{w.gravity < 15 ? " · low gravity" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm font-bold opacity-80">{stage > DESIGNED_STAGES ? `All ${DESIGNED_STAGES} operations done! You're on remix ${stage - DESIGNED_STAGES} — they never end.` : `Clear all ${DESIGNED_STAGES} operations to unlock endless remix operations.`}</p>
    </div>
  );
}

function Help({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="grid gap-2 text-[15px]">
      {[
        [<Play key="i" className="size-5" fill="#5CF08A" stroke="none" />, "Phone: move with your left thumb anywhere on the left. Drag on the right side to look and aim. Hold FIRE — you can drag it to aim while you shoot. The crosshair snaps onto the nearest robot."],
        [<Flame key="i" className="size-5" fill="#FFB03A" stroke="none" />, "Tap JET to jump, hold it to fly. The jetpack burns oil: it refills slowly on the ground, or all at once with an oil can."],
        [<Repeat2 key="i" className="size-5" stroke="#FFD23F" />, "Carry two blasters and SWAP between them. Buy and upgrade blasters, armour, jetpack and boots in the Armory."],
        [<Eye key="i" className="size-5" stroke="#B8B8D8" />, "VIEW switches between over-the-shoulder and first person."],
        [<Swords key="i" className="size-5" stroke="#FF8A6A" />, "Your squad mates Juno and Brick fight with you. If they go down they get back up."],
        [<Heart key="i" className="size-5" fill="#FF4F7A" stroke="none" />, "Hearts heal you — or give an extra life when you're healthy. Lose all your health and you lose a life."],
        [<Zap key="i" className="size-5" fill="#FFD23F" stroke="none" />, "Power cubes: rapid fire, double damage, a shield, a coin magnet and a speed boost."],
        [<Flag key="i" className="size-5" stroke="#FFD23F" />, "Every operation is a long fight across several sectors, phase after phase: clear the robots, survive, defend the core, destroy the robot beacons, capture the relay rings, beat the elites — and a boss at the end. It runs 30 minutes and more."],
        [<CoinsIcon key="i" className="size-5" stroke="#FFC93D" />, "Your progress is saved after every phase. With no lives left the phase starts over — never the whole operation. The next operation starts by itself."],
        [<Crosshair key="i" className="size-5" stroke="#fff" />, "Computer: click to aim with the mouse, WASD to move, click to fire, Space to jet, Shift to run, Q to swap, R to reload, V to change the view."],
      ].map(([i, t], k) => <div key={k} className="vv-px flex items-start gap-3 bg-white/[.06] p-3"><span className="mt-0.5 shrink-0">{i}</span><span>{t}</span></div>)}
      <button type="button" className="vv-btn vv-cta vv-px mt-2 py-3 text-lg" onClick={onPlay}><Play className="size-5 fill-current" /> Deploy</button>
    </div>
  );
}
