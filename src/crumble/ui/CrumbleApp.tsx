"use client";
// Crumble Crew: the screens around the 3D heist — the home screen over the lot (the heist's card: its codename,
// district, sites, how long it runs, the security coming, where you left off), the HUD (health, lives, oil, heist /
// site / goal, the goal with its progress, the ALARM badge, the boss bar, coins and the loot meter, power timers; the
// crosshair, markers and radar are drawn by the game), the thumb controls (a floating move stick on the left, drag on
// the right to look, USE (hold), JUMP, NEXT TOOL, VIEW) and the tool bar, the banners that say "… Job started!", each
// goal, site and the boss with no pages in between, Pip on the radio, and the Shop (tools, ammo, suit, hoodies), the
// district map and help.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Map as MapIcon, Play, HelpCircle, X, Lock, Check, Eye, Repeat2, Hammer, Shield, Magnet, Zap, Gauge, ShoppingBag, ArrowUp, Clock, Flag, Radio, Siren, Coins as CoinsIcon, ScanEye, Flame } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { useProfile } from "@/lib/store";
import { Game, type GameEvent, type Hud, type PowerId } from "../game";
import { goalsIn, heistPlan, whereOf, type HeistPlan } from "../heists";
import { DESIGNED_HEISTS, DISTRICTS, HEISTS_PER_DISTRICT, districtOf, type BotKind } from "../districts";
import { BOTS, MAX_LEVEL, OUTFITS, SUIT, SUIT_MAX, TOOLS, suitCost, toolOf, upgradeCost, type ToolId } from "../gear";
import { useCrumble, useCrumbleHydrated, START_LIVES, MAX_LIVES } from "../save";
import { CRUMBLE_SOUNDS, UI_SOUNDS, sfx } from "../sound";
import { CrumbleMusic } from "../music";
import { CRUMBLE_CSS } from "./styles";

type Sheet = "" | "shop" | "districts" | "help";
interface Banner { id: number; big: string; sub?: string; color?: string; ms: number }

// ---------------------------------------------------------------- pixel icons (emoji differ from device to device)
function PixelArt({ rows, pal, size = 4 }: { rows: string[]; pal: Record<string, string>; size?: number }) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  return (
    <svg width={w * size} height={h * size} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((r, y) => [...r].map((ch, x) => (pal[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={pal[ch]} /> : null)))}
    </svg>
  );
}
const TOOL_ROWS: Record<ToolId, string[]> = {
  hammer: ["mmmmmm..", "mmmmmm..", "mlmmml..", "..hh....", "..hh....", "..hh....", "..dd....", "..hh...."],
  blaster: ["........", ".ccccccl", "cccccccl", "ooc.....", ".dd.....", ".dd....."],
  drill: ["..yyyy..", ".yyyyyss", "yyyyyyss", ".dd.....", ".dd.....", ".oo....."],
  grenade: ["...mm...", "..gggg..", ".gggggg.", ".gyyyyg.", ".gggggg.", "..gggg.."],
  dynamite: ["....w...", "...w....", ".rrrrrr.", ".rrrrrr.", ".dddddd.", ".rrrrrr.", ".rrrrrr."],
  rocket: ["........", "dggggggo", "gggggggo", "dggggggo", ".dd.....", "........"],
  paint: ["..dd....", ".dwwd...", ".wwww...", ".wrrw...", ".wrrw...", ".wwww..."],
};
function ToolIcon({ id, size = 3.4 }: { id: ToolId; size?: number }) {
  return <PixelArt rows={TOOL_ROWS[id]} pal={{ m: "#8A92A6", l: "#B8BCCB", h: "#FF8A3A", d: "#2A2D3A", c: "#2AB8B0", o: "#FF8A3A", y: "#FFD23F", s: "#B8BCCB", g: "#3E9A5A", w: "#F2F2EA", r: "#D8302A" }} size={size} />;
}
function RoccoHead({ hoodie = "#FF8A3A", size = 3 }: { hoodie?: string; size?: number }) {
  return <PixelArt rows={[".e....e.", "eggggggee", "gggggggg", "kkwkkwkk", "gggwwggg", "ggwwnwwg", "hhhhhhhh"]} pal={{ e: "#5A5E6A", g: "#8A8E9A", k: "#1E1E26", w: "#F2F2EA", n: "#1E1E26", h: hoodie }} size={size} />;
}
const BOT_ROWS: Record<BotKind, string[]> = {
  guard: [".ssss.", ".rrrr.", "nnnnnn", "nyyyyn", ".n..n."],
  hound: ["....ss", "nnnnsr", "nyyyn.", "n.n.n."],
  drone: ["d.d.d.", "dddddd", ".nnnn.", ".nrrn."],
  turret: ["dd....", "ddnnnd", "ddnrnd", "dd...."],
  shield: [".ssss.", "bbrrr.", "bbnnnn", "bbyynn", ".n..n."],
  heavy: ["dd.ss.", "ddrrrr", "nnnnnn", "nyyyyn", "nn..nn"],
};
function BotIcon({ kind, size = 3 }: { kind: BotKind; size?: number }) {
  return <PixelArt rows={BOT_ROWS[kind]} pal={{ s: "#8A92A6", r: "#FF3A3A", n: "#2A3A6A", y: "#FFD23F", d: "#2A2D3A", b: "#5A6A8A" }} size={size} />;
}
function CoinIcon({ size = 18 }: { size?: number }) {
  return <PixelArt rows={[".gggg.", "gyyyyg", "gyhyyg", "gyyyyg", "gyyyyg", ".gggg."]} pal={{ g: "#C8861A", y: "#FFC93D", h: "#FFF0A0" }} size={size / 6} />;
}
const Hearts = ({ n, of }: { n: number; of: number }) => (
  <span className="cc-hearts">{Array.from({ length: of }, (_, i) => <PixelArt key={i} rows={[".r.r.", "rrrrr", "rrrrr", ".rrr.", "..r.."]} pal={{ r: i < n ? "#FF3D6E" : "rgba(255,255,255,.25)" }} size={3.2} />)}</span>
);
const POWER_ICON: Record<PowerId, React.ReactNode> = {
  mega: <Hammer className="size-4" stroke="#FF8A3A" strokeWidth={2.6} />, shield: <Shield className="size-4" fill="#5AB8FF" stroke="none" />, magnet: <Magnet className="size-4" stroke="#FF5AC8" strokeWidth={2.6} />,
  speed: <Gauge className="size-4" stroke="#5CE07A" strokeWidth={2.6} />, xray: <ScanEye className="size-4" stroke="#C87CFF" strokeWidth={2.6} />, double: <CoinsIcon className="size-4" stroke="#FFD23F" strokeWidth={2.6} />,
};
const POWER_COL: Record<PowerId, string> = { mega: "#FF8A3A", shield: "#5AB8FF", magnet: "#FF5AC8", speed: "#5CE07A", xray: "#C87CFF", double: "#FFD23F" };
const POWER_NAME: Record<string, string> = { mega: "Mega mallet!", shield: "Shield up!", magnet: "Loot magnet!", speed: "Speed boost!", xray: "X-ray eyes — see the loot!", double: "Double loot!", heart: "Health up!", oil: "Drill oil full!", ammo: "Explosives restocked!", gold: "Gold bar!", gem: "A gem!", art: "A painting!" };
const GOAL_COL: Record<string, string> = { breach: "#FFD23F", loot: "#5CE07A", vault: "#FFD23F", hold: "#FF5A6A", wreck: "#FF8A3A", boss: "#FF5A7A", escape: "#5BF0FF" };

export default function CrumbleApp({ slug }: { slug: string; title: string }) {
  const ready = useCrumbleHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const save = useCrumble();
  const [screen, setScreen] = useState<"home" | "play">("home");
  const [sheet, setSheet] = useState<Sheet>("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; color: string } | null>(null);
  const [radio, setRadio] = useState<{ id: number; text: string } | null>(null);
  const [btn, setBtn] = useState({ use: false, jump: false });
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
  const toastIt = useCallback((text: string, color = "#5CE07A") => {
    const id = Math.random();
    setToast({ id, text, color });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1600);
  }, []);
  const radioIt = useCallback((text: string) => {
    const id = Math.random();
    setRadio({ id, text });
    setTimeout(() => setRadio((r) => (r?.id === id ? null : r)), 3200);
  }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Loading the van");
    void audio.preload(UI_SOUNDS);
    void audio.preload(CRUMBLE_SOUNDS);
    void audio.stopMusic(0.2);
  }, []);
  const music = useRef<CrumbleMusic | null>(null);
  useEffect(() => { const m = new CrumbleMusic(); music.current = m; m.title(); return () => { m.dispose(); music.current = null; }; }, []);
  const tune = useCallback((heat: 0 | 1 | 2) => {
    const g = gameRef.current;
    if (!g) return;
    music.current?.site({ district: g.plan.district, blend: g.plan.blend, time: g.site.time, seed: g.site.seed, heat });
  }, []);

  const onEvent = useCallback((e: GameEvent) => {
    const g = gameRef.current;
    switch (e.k) {
      case "start": {
        tune(g?.alarm ? 1 : 0);
        const fresh = e.site === 0 && e.goal === 0;
        const big = e.restart ? `${e.codename} — again!` : fresh ? `${e.codename} started!` : e.goal === 0 ? `Site ${e.site + 1}: ${e.siteName}` : `Back on ${e.siteName}`;
        const sub = fresh ? `${whereOf(heistPlan(e.heist))} · ${e.sites} sites · about ${e.minutes} min` : `${e.codename} · site ${e.site + 1} of ${e.sites}`;
        setTimeout(() => say(big, sub, fresh ? "#FFB05A" : "#FFFFFF", 2800), 250);
        sfx("start", { delay: 0.2 });
        if (!useCrumble.getState().seenHelp) { setTimeout(() => toastIt(touchDevice ? "Left: move · Right: look · Hold USE" : "Click to look · WASD · Click to use · 1–7 tools", "#FFD23F"), 3600); useCrumble.getState().sawHelp(); }
        break;
      }
      case "goal": if (e.kind !== "boss") say(e.again ? `Goal ${e.no} — again` : `Goal ${e.no}: ${e.title}`, e.hint, GOAL_COL[e.kind], 2800); if (e.kind === "escape") tune(2); break;
      case "alarm": say("ALARM!", "Bolt Security is on the way", "#FF4A5A", 1800); tune(1); break;
      case "boss": tune(2); say(e.name, "Baron Bolt's security mech — take it down!", "#FF4A6A", 2600); break;
      case "goalDone": toastIt(`${e.title} — done! +${e.coins}`, "#5CE07A"); break;
      case "siteClear": say("Site cleared!", `${e.name} · +${e.coins} coins · on to the next one`, "#5CE07A", 2800); break;
      case "fail": say(e.why, "The goal starts over", "#FF5A6A", 2600); break;
      case "clear": {
        say("Heist complete!", `$${e.loot.toLocaleString()} in loot`, "#5CE07A", 3000);
        const s = useCrumble.getState();
        s.setCoins(g?.coins ?? s.coins);
        useProfile.getState().earnCoins(8 + Math.floor(e.heist / 15));
        if (e.heist % HEISTS_PER_DISTRICT === 0 && e.heist <= DESIGNED_HEISTS) setTimeout(() => say("District cleared!", `${districtOf(heistPlan(e.heist + 1).district).name} next`, "#FFD23F", 2600), 3100);
        track("crumble_clear", { heist: e.heist });
        break;
      }
      case "pickup": if (e.what !== "coin" && e.what !== "cash") toastIt(e.value ? `${POWER_NAME[e.what] ?? ""} +$${e.value}` : POWER_NAME[e.what] ?? "", POWER_COL[e.what as PowerId] ?? "#FFD23F"); break;
      case "hurt": setHurt((h) => h + 1); break;
      case "down": say("You're down!", e.livesLeft > 0 ? `${e.livesLeft} ${e.livesLeft === 1 ? "life" : "lives"} left` : "No lives left · the goal starts over", "#FF5A6A", 2000); break;
      case "collapse": if (e.blocks > 150) toastIt(`CRASH! ${e.blocks} blocks came down`, "#FF8A3A"); break;
      case "lowOil": toastIt("Drill oil low — grab an oil can!", "#FF8A3A"); break;
      case "noAmmo": toastIt(`No ${toolOf(e.tool).name} left — buy more in the Shop`, "#FF8A3A"); break;
      case "view": useCrumble.getState().setView(e.first); break;
      case "radio": radioIt(e.text); break;
    }
  }, [say, toastIt, radioIt, touchDevice, tune]);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!ready || !host.current) return;
    const s = useCrumble.getState();
    coinsRef.current = s.coins;
    let flush: ReturnType<typeof setTimeout> | null = null;
    const g = new Game(host.current, {
      owned: [...s.owned], levels: { ...s.levels }, ammo: { ...s.ammo }, suit: { ...s.suit }, outfit: s.outfit, lives: s.lives || START_LIVES, coins: s.coins, firstPerson: s.firstPerson,
      onHud: (h) => setHud(h),
      onEvent: (e) => onEventRef.current(e),
      onCoins: (n) => { coinsRef.current = n; if (!flush) flush = setTimeout(() => { flush = null; useCrumble.getState().setCoins(coinsRef.current); }, 900); },
      onLives: (n) => useCrumble.getState().setLives(n),
      onAmmo: (a) => useCrumble.getState().setAmmo(a),
      onCheckpoint: (heist, site, goal, t) => useCrumble.getState().checkpoint(heist, site, goal, t),
      onDone: (next, t) => useCrumble.getState().done(next, t),
    });
    gameRef.current = g;
    g.load(s.heist, "attract", false, { site: s.site, goal: s.goal });
    g.start();
    loadRef.current(null);
    setGameReady(true);
    const lock = () => setLocked(document.pointerLockElement != null);
    document.addEventListener("pointerlockchange", lock);
    return () => { document.removeEventListener("pointerlockchange", lock); if (flush) { clearTimeout(flush); useCrumble.getState().setCoins(coinsRef.current); } g.dispose(); gameRef.current = null; setGameReady(false); };
  }, [ready]);

  const powered = !!hud?.powers.length;
  useEffect(() => { music.current?.fever(powered); }, [powered]);
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    if (paused) { g.stop(); g.setUse(false); music.current?.pause(); if (document.pointerLockElement) document.exitPointerLock?.(); } else { g.start(); music.current?.resume(); }
  }, [paused]);
  useEffect(() => { setInRound(screen === "play"); setImmersive(screen === "play"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  // ---------------------------------------------------------------- flow
  const play = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    sfx("tap"); setSheet(""); setScreen("play");
    g.play();
  }, []);
  const home = useCallback(() => {
    const g = gameRef.current;
    setScreen("home");
    if (g) { const s = useCrumble.getState(); g.setUse(false); g.setMove(0, 0); g.load(s.heist, "attract", false, { site: s.site, goal: s.goal }); }
    if (document.pointerLockElement) document.exitPointerLock?.();
    music.current?.title();
  }, []);
  const refreshGear = useCallback(() => {
    const s = useCrumble.getState();
    gameRef.current?.setGear({ owned: [...s.owned], levels: { ...s.levels }, ammo: { ...s.ammo }, suit: { ...s.suit }, outfit: s.outfit });
  }, []);
  useEffect(() => {
    setMenu(screen === "play" ? [
      { id: "restart", label: "Restart this goal", onSelect: () => { const g = gameRef.current; if (g) g.load(g.heist, "intro", true, { site: g.siteI, goal: g.goalI }); } },
      { id: "shop", label: "Shop", onSelect: () => { home(); setSheet("shop"); } },
      { id: "home", label: "Main menu", onSelect: home },
    ] : []);
  }, [screen, setMenu, home]);

  // ---------------------------------------------------------------- thumbs
  const roles = useRef(new Map<number, { role: "move" | "look" | "use"; x: number; y: number; ox: number; oy: number }>());
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
  const down = useCallback((role: "move" | "look" | "use") => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = (e.currentTarget.closest(".cc-root") as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    roles.current.set(e.pointerId, { role, x, y, ox: x, oy: y });
    if (role === "use") { gameRef.current?.setUse(true); setBtn((b) => ({ ...b, use: true })); }
    if (role === "move") updateStick();
  }, [updateStick]);
  const moveP = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const v = roles.current.get(e.pointerId);
    if (!v) return;
    const rect = (e.currentTarget.closest(".cc-root") as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (v.role === "look" || v.role === "use") gameRef.current?.turn((x - v.x) * 1.15, (y - v.y) * 1.15);
    v.x = x; v.y = y;
    if (v.role === "move") updateStick();
  }, [updateStick]);
  const up = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const v = roles.current.get(e.pointerId);
    if (!v) return;
    roles.current.delete(e.pointerId);
    if (v.role === "use") { gameRef.current?.setUse(false); setBtn((b) => ({ ...b, use: false })); }
    if (v.role === "move") updateStick();
  }, [updateStick]);

  // ---------------------------------------------------------------- render
  const plan = heistPlan(save.heist);
  const acc = hud?.accent ?? districtOf(plan.district).accent;
  const playing = screen === "play" && hud?.mode === "play";
  const cine = screen === "play" && hud && hud.mode !== "play";
  const hpK = hud ? hud.hp / hud.maxHp : 1;
  const outfit = OUTFITS.find((o) => o.id === save.outfit) ?? OUTFITS[0];

  return (
    <div className="cc-root" style={{ ["--acc" as string]: acc }} data-slug={slug}>
      <style>{CRUMBLE_CSS}</style>
      <div ref={host} className="cc-stage" />

      {screen === "home" && (
        <div className="cc-ui">
          <div className="cc-home">
            <div className="flex flex-col items-center gap-3">
              <div className="cc-logo" aria-label="Crumble Crew">
                <span className="l1" style={{ ["--c" as string]: "#FFB05A", ["--d" as string]: "#B8541A" }}>CRUMBLE</span>
                <span className="l2" style={{ ["--c" as string]: "#5BE8E0", ["--d" as string]: "#1A8A8A" }}>CREW</span>
              </div>
              <p className="cc-tag">Smash · Grab · Getaway</p>
            </div>
            <div className="flex w-full flex-col items-center gap-3">
              <HeistCard plan={plan} site={save.site} goal={save.goal} />
              <div className="flex w-[min(420px,100%)] items-center justify-between px-1">
                <span className="cc-pill cc-cap cc-px"><CoinIcon />{save.coins.toLocaleString()}</span>
                <span className="cc-pill cc-cap cc-px"><RoccoHead hoodie={outfit.hoodie} size={2.2} />{save.heists.toLocaleString()} jobs</span>
                <Hearts n={save.lives} of={MAX_LIVES} />
              </div>
              <button type="button" className="cc-btn cc-cta cc-px w-[min(420px,100%)] py-4 text-2xl" onClick={play} disabled={!gameReady}>
                <Play className="size-7 fill-current" /> <span className="cc-display">{save.site > 0 || save.goal > 0 ? "Resume the heist" : save.heist === 1 ? "Start the heist" : "Next heist"}</span>
              </button>
              <div className="grid w-[min(420px,100%)] grid-cols-3 gap-2">
                <button type="button" className="cc-btn cc-ghost cc-px py-3 text-sm" onClick={() => { sfx("open"); setSheet("shop"); }}><ShoppingBag className="size-5" /> Shop</button>
                <button type="button" className="cc-btn cc-ghost cc-px py-3 text-sm" onClick={() => { sfx("open"); setSheet("districts"); }}><MapIcon className="size-5" /> Districts</button>
                <button type="button" className="cc-btn cc-ghost cc-px py-3 text-sm" onClick={() => { sfx("open"); setSheet("help"); }}><HelpCircle className="size-5" /> Help</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "play" && hud && (
        <div className={`cc-hud ${cine ? "cc-cine" : ""}`}>
          {hurt > 0 && <div key={hurt} className="cc-hurt cc-flash" />}
          {hpK < 0.3 && playing && <div className="cc-hurt cc-low" />}
          {playing && touchDevice && (
            <>
              <div className="cc-move" onPointerDown={down("move")} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} />
              <div className="cc-look" onPointerDown={down("look")} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up} />
              <div className={`cc-stick ${stick ? "" : "idle"}`} style={{ left: stick ? stick.x : 92, top: stick ? stick.y : "calc(100% - 130px)" }}><i style={{ transform: stick ? `translate(${stick.dx}px,${stick.dy}px)` : undefined }} /></div>
            </>
          )}
          <div className="cc-tl">
            <div className="cc-hp" style={{ ["--hc" as string]: hpK > 0.5 ? "#5CF08A" : hpK > 0.25 ? "#FFD23F" : "#FF4A4A" }}><i style={{ width: `${hpK * 100}%` }} /><b>{Math.ceil(hud.hp)} / {hud.maxHp}</b></div>
            <Hearts n={hud.lives} of={Math.max(3, hud.lives)} />
            {hud.tools.some((t) => t.id === "drill") && <div className="flex items-center gap-1.5 text-[10px] font-black"><Flame className="size-3" stroke="#FF8A3A" />OIL<div className="cc-oil"><i style={{ width: `${hud.oil * 100}%` }} /></div></div>}
          </div>
          <div className="cc-tc cc-keep">
            <div className="cc-wave cc-cap cc-px"><span className="op">{hud.remix ? "Remix" : "Heist"} <em>{hud.remix ? hud.heist - DESIGNED_HEISTS : hud.heist}</em> ·</span> Site <em>{hud.site}/{hud.sites}</em> · Goal <em>{hud.goalNo}/{hud.goals}</em></div>
            {hud.alarm && <div className="cc-alarm cc-px"><Siren className="mr-1 inline size-3.5" />ALARM</div>}
            {hud.obj && !hud.boss && (
              <div className={`cc-obj cc-px ${hud.obj.done ? "done" : ""}`} style={{ ["--oc" as string]: GOAL_COL[hud.obj.kind] }}>
                <p className="t">{hud.obj.title}</p>
                <p className="l">{hud.obj.line}</p>
                <div className="bar"><i style={{ width: `${hud.obj.prog * 100}%` }} /></div>
              </div>
            )}
            {hud.boss && <div className="cc-boss cc-cap cc-px"><p>{hud.boss.name}</p><div className="bar"><i style={{ width: `${hud.boss.hp * 100}%` }} /></div></div>}
            {hud.powers.length > 0 && (
              <div className="cc-powers">
                {hud.powers.map((p) => (
                  <div key={p.id} className="cc-power cc-px">
                    <svg className="ring" viewBox="0 0 36 36"><rect x="2" y="2" width="32" height="32" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" /><rect x="2" y="2" width="32" height="32" fill="none" stroke={POWER_COL[p.id]} strokeWidth="3" strokeDasharray={`${(p.left / p.secs) * 128} 200`} /></svg>
                    {POWER_ICON[p.id]}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="cc-tr flex flex-col items-end gap-1.5">
            <span className="cc-pill cc-cap cc-px"><CoinIcon />{hud.coins.toLocaleString()}</span>
          </div>
          <div className="cc-tools cc-px">
            {hud.tools.map((t) => (
              <button type="button" key={t.id} aria-label={toolOf(t.id).name} className={`cc-tool cc-px ${hud.tool === t.id ? "on" : ""} ${t.ammo === 0 ? "empty" : ""}`} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); gameRef.current?.setTool(t.id); }}>
                <ToolIcon id={t.id} size={touchDevice ? 3.6 : 3.8} />
                {t.ammo >= 0 && <b>{t.ammo}</b>}
              </button>
            ))}
          </div>
          <div className="cc-acts">
            <button type="button" aria-label="Use" className={`cc-act cc-fire ${btn.use ? "on" : ""}`} onPointerDown={down("use")} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up}>
              <ToolIcon id={hud.tool} size={5} />
              <small>USE</small>
            </button>
            <button type="button" aria-label="Jump" className={`cc-act cc-jet ${btn.jump ? "on" : ""}`} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); gameRef.current?.setJump(true); setBtn((b) => ({ ...b, jump: true })); }} onPointerUp={() => { gameRef.current?.setJump(false); setBtn((b) => ({ ...b, jump: false })); }} onPointerCancel={() => { gameRef.current?.setJump(false); setBtn((b) => ({ ...b, jump: false })); }}>
              <ArrowUp className="size-8" strokeWidth={3} />
              <small>JUMP</small>
            </button>
            <button type="button" aria-label="Next tool" className="cc-act cc-swap" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); if (hud.tool === "paint") { gameRef.current?.cyclePaint(); sfx("tap"); } else gameRef.current?.cycleTool(1); }}>
              <Repeat2 className="size-6" strokeWidth={2.6} />
              <small>{hud.tool === "paint" ? "COLOUR" : "TOOL"}</small>
            </button>
            <button type="button" aria-label="Change view" className="cc-act cc-view" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); const f = gameRef.current?.toggleView(); if (f !== undefined) useCrumble.getState().setView(f); sfx("tap"); }}>
              <Eye className="size-5" />
            </button>
          </div>
          {!touchDevice && playing && !locked && <div className="cc-aimhint cc-cap cc-px">Click to look · Esc to let go</div>}
          {!touchDevice && playing && <div className="cc-keys cc-cap cc-px">WASD move · Mouse look · Click use · Space jump · 1–7 / Q E tools · C paint colour · V view</div>}
        </div>
      )}

      <AnimatePresence>
        {banner && (
          <motion.div key={banner.id} className="cc-banner" initial={{ opacity: 0, x: -60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }} transition={{ type: "spring", stiffness: 380, damping: 26 }}>
            <p className="cc-big" style={{ ["--c" as string]: banner.color }}>{banner.big}</p>
            {banner.sub && <p className="cc-sub cc-px">{banner.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast.id} className="cc-toast cc-cap cc-px" style={{ color: toast.color }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{toast.text}</motion.div>}
      </AnimatePresence>
      <AnimatePresence>
        {radio && screen === "play" && <motion.div key={radio.id} className="cc-radio cc-cap cc-px" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}><Radio className="size-4 shrink-0" stroke="#5BF0FF" />{radio.text}</motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div key="veil" className="cc-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet("")} />
            <motion.div key={sheet} className="cc-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}>
              <div className="mb-3 flex items-center justify-between">
                <p className="cc-display text-2xl">{sheet === "shop" ? "Shop" : sheet === "districts" ? "Districts" : "How to play"}</p>
                <button type="button" aria-label="Close" className="cc-btn cc-ghost cc-px size-10 p-0" onClick={() => setSheet("")}><X className="size-5" /></button>
              </div>
              <div className="cc-scroll">
                {sheet === "shop" && <Shop onChange={refreshGear} />}
                {sheet === "districts" && <Districts heist={save.heist} />}
                {sheet === "help" && <Help onPlay={play} />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- the heist card
function HeistCard({ plan, site, goal }: { plan: HeistPlan; site: number; goal: number }) {
  const kinds = new Set<BotKind>();
  for (const s of plan.sites) for (const [k] of s.bots) kinds.add(k);
  const resume = site > 0 || goal > 0;
  return (
    <div className="cc-card cc-px">
      <span className="cc-strip" />
      <div className="flex items-center justify-between gap-2">
        <span className="cc-kicker truncate">{whereOf(plan)}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-extrabold opacity-80"><Clock className="size-3.5" />{plan.minutes}+ min</span>
      </div>
      <p className="cc-display mt-2 truncate text-[22px] leading-tight">{plan.codename}</p>
      <p className="truncate text-xs font-bold opacity-75">{plan.sites.length} sites · {goalsIn(plan)} goals · {plan.sites.map((s) => s.building).filter((b, i, a) => a.indexOf(b) === i).join(", ")} · Boss: Vault Warden</p>
      <div className="cc-sectors">
        {plan.sites.map((s, i) => <span key={i} className={`cc-sec cc-px ${i < site ? "done" : i === site ? "now" : ""}`}>{i < site ? <Check className="size-3" /> : <Flag className="size-3" />}{s.name}</span>)}
      </div>
      <div className="cc-bots">
        {[...kinds].slice(0, 5).map((k) => <span key={k} className="cc-bot cc-px"><BotIcon kind={k} size={2.6} />{BOTS[k].name}</span>)}
      </div>
      {resume && <p className="mt-2 text-xs font-extrabold" style={{ color: "var(--acc)" }}>Resume: site {site + 1} · {plan.sites[site]?.goals[goal]?.title ?? "next goal"}</p>}
      {!plan.remix && (
        <div className="cc-short mt-2">
          <div className="mb-1 flex justify-between text-[11px] font-extrabold opacity-70"><span>Heist {plan.local} of {HEISTS_PER_DISTRICT} in this district</span><span>{plan.n} / {DESIGNED_HEISTS}</span></div>
          <div className="cc-progress"><i style={{ width: `${(plan.local / HEISTS_PER_DISTRICT) * 100}%` }} /></div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the shop
function Shop({ onChange }: { onChange: () => void }) {
  const s = useCrumble();
  const [tab, setTab] = useState<"tools" | "suit" | "hoodie">("tools");
  return (
    <div>
      <div className="cc-tabs">
        {(["tools", "suit", "hoodie"] as const).map((t) => <button type="button" key={t} className={`cc-tab cc-px ${tab === t ? "on" : ""}`} onClick={() => { sfx("tap"); setTab(t); }}>{t === "tools" ? "Tools" : t === "suit" ? "Suit" : "Hoodies"}</button>)}
      </div>
      {tab === "tools" && TOOLS.map((t) => {
        const owned = s.owned.includes(t.id), lv = s.levels[t.id] ?? 0, cost = upgradeCost(t, lv);
        return (
          <div key={t.id} className={`cc-item cc-px ${owned ? "sel" : ""}`}>
            <div className="grid w-[56px] shrink-0 place-items-center"><ToolIcon id={t.id} size={5.5} /></div>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{t.name}</p>
              <p className="text-xs opacity-70">{t.tagline}</p>
              {owned && <div className="cc-dots">{Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < lv ? "on" : ""} />)}</div>}
              {owned && t.ammo > 0 && <p className="mt-1 text-xs font-bold opacity-80">Carrying {s.ammo[t.id] ?? 0}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {owned ? (
                <>
                  {t.id !== "paint" && <button type="button" disabled={lv >= MAX_LEVEL || s.coins < cost} className="cc-btn cc-ghost cc-px px-2 py-1 text-xs" onClick={() => { if (s.upgradeTool(t.id)) { sfx("upgrade"); onChange(); } }}>{lv >= MAX_LEVEL ? <><Check className="size-3.5" /> Max</> : <><ArrowUp className="size-3.5" /><CoinIcon size={13} />{cost.toLocaleString()}</>}</button>}
                  {t.pack > 0 && <button type="button" disabled={s.coins < t.packPrice} className="cc-btn cc-ghost cc-px px-2 py-1 text-xs" onClick={() => { if (s.buyAmmo(t.id)) { sfx("buy"); onChange(); } }}>+{t.pack} <CoinIcon size={13} />{t.packPrice}</button>}
                </>
              ) : (
                <button type="button" disabled={s.coins < t.price} className="cc-btn cc-cta cc-px px-3 py-2 text-sm" onClick={() => { if (s.buyTool(t.id)) { sfx("buy"); onChange(); } }}>{s.coins < t.price ? <Lock className="size-4" /> : null}<CoinIcon size={15} />{t.price.toLocaleString()}</button>
              )}
            </div>
          </div>
        );
      })}
      {tab === "suit" && SUIT.map((u) => {
        const lv = s.suit[u.id], cost = suitCost(lv);
        return (
          <div key={u.id} className="cc-item cc-px">
            <div className="grid size-10 shrink-0 place-items-center">{u.id === "armor" ? <Shield className="size-7" stroke="#5AB8FF" /> : u.id === "boots" ? <Gauge className="size-7" stroke="#5CE07A" /> : u.id === "bag" ? <Magnet className="size-7" stroke="#FF5AC8" /> : <Flame className="size-7" stroke="#FF8A3A" />}</div>
            <div className="min-w-0 flex-1"><p className="font-extrabold">{u.label}</p><p className="text-xs opacity-70">{u.hint}</p><div className="cc-dots">{Array.from({ length: SUIT_MAX }, (_, i) => <i key={i} className={i < lv ? "on" : ""} />)}</div></div>
            <button type="button" disabled={lv >= SUIT_MAX || s.coins < cost} className="cc-btn cc-cta cc-px px-3 py-2 text-sm" onClick={() => { if (s.upgradeSuit(u.id)) { sfx("upgrade"); onChange(); } }}>{lv >= SUIT_MAX ? <><Check className="size-4" /> Max</> : <><CoinIcon size={15} />{cost.toLocaleString()}</>}</button>
          </div>
        );
      })}
      {tab === "hoodie" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OUTFITS.map((o) => {
            const owned = s.outfits.includes(o.id), on = s.outfit === o.id;
            return (
              <button type="button" key={o.id} className={`cc-item cc-px m-0 flex-col !items-center text-white ${on ? "sel" : ""}`} onClick={() => { if (owned) { s.wear(o.id); sfx("equip"); onChange(); } else if (s.buyOutfit(o.id)) { sfx("buy"); onChange(); } }}>
                <RoccoHead hoodie={o.hoodie} size={6} />
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

// ---------------------------------------------------------------- districts
function DistrictThumb({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const d = DISTRICTS[index], W = 64, H = 44;
    cv.width = W; cv.height = H;
    const c = cv.getContext("2d")!;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, d.sky[0]); g.addColorStop(0.6, d.sky[1]); g.addColorStop(1, d.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    let seed = index * 97 + 13;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let x = 0; x < W; x += 4) { const h = 4 + Math.floor(rnd() * 10); c.fillStyle = d.palette.side; c.fillRect(x, H - 12 - h, 4, h); }
    // the building to break into
    c.fillStyle = d.palette.wall; c.fillRect(20, H - 30, 26, 18);
    c.fillStyle = d.palette.roof; c.fillRect(18, H - 32, 30, 3);
    c.fillStyle = d.palette.glass; for (let x = 23; x < 44; x += 5) c.fillRect(x, H - 26, 3, 4);
    c.fillStyle = d.palette.accent; c.fillRect(30, H - 18, 6, 6);
    c.fillStyle = d.palette.top; c.fillRect(0, H - 12, W, 3);
    c.fillStyle = d.palette.road; c.fillRect(0, H - 9, W, 9);
    c.fillStyle = "#2AB8B0"; c.fillRect(4, H - 14, 12, 6); c.fillStyle = "#1E1E26"; c.fillRect(5, H - 9, 3, 2); c.fillRect(12, H - 9, 3, 2);
  }, [index]);
  return <canvas ref={ref} />;
}
function Districts({ heist }: { heist: number }) {
  const cur = Math.floor((Math.min(heist, DESIGNED_HEISTS) - 1) / HEISTS_PER_DISTRICT);
  return (
    <div>
      <div className="cc-worlds">
        {DISTRICTS.map((d, i) => {
          const done = Math.max(0, Math.min(HEISTS_PER_DISTRICT, heist - 1 - i * HEISTS_PER_DISTRICT));
          const lock = i > cur && heist <= DESIGNED_HEISTS;
          return (
            <div key={d.id} className={`cc-world cc-px ${lock ? "lock" : ""} ${i === cur && heist <= DESIGNED_HEISTS ? "now" : ""}`}>
              <DistrictThumb index={i} />
              <div className="lbl">
                <p className="truncate">{lock ? <Lock className="mr-1 inline size-3.5" /> : null}{d.name}</p>
                <p className="truncate text-[11px] font-bold opacity-80">{done}/{HEISTS_PER_DISTRICT} · {d.buildings.join(", ")}{d.gravity < 15 ? " · low gravity" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm font-bold opacity-80">{heist > DESIGNED_HEISTS ? `All ${DESIGNED_HEISTS} heists done! You're on remix ${heist - DESIGNED_HEISTS} — they never end.` : `Pull all ${DESIGNED_HEISTS} heists to unlock endless remix jobs.`}</p>
    </div>
  );
}

function Help({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="grid gap-2 text-[15px]">
      {[
        [<Play key="i" className="size-5" fill="#FFB05A" stroke="none" />, "Phone: move with your left thumb, drag on the right side to look. Hold USE to use the tool in your hands. JUMP climbs; TOOL switches tools (or picks a paint colour)."],
        [<Hammer key="i" className="size-5" stroke="#FF8A3A" />, "Every block breaks to the right tool: the Mallet smashes wood, glass, plaster and brick; the Drill bores steel (it burns oil); Dynamite, Rockets and Boom Balls blow holes in anything — only dynamite (or a top-level drill or rocket) cracks vault steel."],
        [<Siren key="i" className="size-5" stroke="#FF4A5A" />, "The first block you break trips the alarm: Bolt Security teleports in and keeps coming. Blast them with the Zap Blaster or the Mallet."],
        [<Flag key="i" className="size-5" stroke="#FFD23F" />, "Each heist is several sites, each a run of goals: break in, grab the loot quota, crack the vault, hold off security, bring the building down, beat the Vault Warden, and get back to Pip's van. It runs half an hour and more."],
        [<CoinsIcon key="i" className="size-5" stroke="#FFC93D" />, "Loot — cash, gold bars, gems and paintings — turns into coins. Safes and gold blocks pay out when you break them. Spend coins in the Shop on tools, upgrades, explosives, the suit and hoodies."],
        [<Zap key="i" className="size-5" fill="#FFD23F" stroke="none" />, "Hearts heal (or give a life when you're healthy), oil cans refill the drill, crates restock explosives, and power cubes give a mega mallet, a shield, a loot magnet, speed, x-ray eyes or double loot."],
        [<Check key="i" className="size-5" stroke="#5CE07A" />, "Progress is saved after every goal. Run out of lives and only that goal starts over. When a site is done the van takes you to the next one by itself."],
        [<Eye key="i" className="size-5" stroke="#B8B8D8" />, "VIEW switches between first person and over-the-shoulder. Computer: WASD, mouse to look (click first), click to use, Space to jump, 1–7 or Q/E for tools, C for paint colour, V for the view."],
      ].map(([i, t], k) => <div key={k} className="cc-px flex items-start gap-3 bg-white/[.06] p-3"><span className="mt-0.5 shrink-0">{i}</span><span>{t}</span></div>)}
      <button type="button" className="cc-btn cc-cta cc-px mt-2 py-3 text-lg" onClick={onPlay}><Play className="size-5 fill-current" /> Let&apos;s go</button>
    </div>
  );
}
