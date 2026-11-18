"use client";
// Puddo's Clayland: Rain Raid front-end: the title (Puddo playing behind the logo), the zone map (20 zones + the Endless
// Storm), each zone's 20 stages by district with their concepts and medals, the comics and story cards, the game (HUD
// with the Storm meter, lives, weapon, bombs, combo and goal; touch controls; the stage card; toasts; the dark veil on
// night stages), the stage-clear tally (and the Rain Bell after a boss), the Blaster Shop, the Wardrobe, settings and
// the ending.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bomb, CalendarDays, ChevronRight, CircleHelp, Droplet, Heart, Lock, Map as MapIcon, Play, RotateCcw, Settings2, Shirt, ShoppingBag, Star, Zap } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { DESIGNED, ISLANDS, STAGES_PER_ISLAND, islandOf, stageInIsland, stageLabel } from "../islands";
import { ClaySession, type Button } from "../session";
import { CONCEPT_ICON, CONCEPT_NAME, FRIEND_FROM, FRIEND_NAME, FRIEND_POWER, buildStage, dailyNumber, isDaily, today, zoneSchedule } from "../stages";
import { autoQuality, bellsRung, heartsFor, useClay, useClayHydrated, type CharId, type ClayLook } from "../save";
import { ClayWardrobe } from "../wardrobe";
import { START_BOMBS, UPGRADES, WEAPONS, upgradeEffects } from "../weapons";
import type { FriendId, Hud, SimEvent, SimResult } from "../types";
import type { Sim } from "../sim";
import { Coach, Tutorial } from "./Tutorial";

type Screen = "title" | "map" | "island" | "story" | "game" | "clear" | "settings" | "ending" | "wardrobe" | "shop" | "tutorial";
interface Run { key: number; n: number; friend?: FriendId; bonusHeart?: boolean; bombs?: boolean }
interface Clear { r: SimResult; firstClear: boolean; newDrops: number; newNoHit: boolean; boss: boolean; machine: boolean; daily?: { reward: number; streak: number; first: boolean } }

// ------------------------------------------------------------------ the wardrobe catalogue (site coins)
const CHARS: { id: CharId; name: string; price: number; from: number; power: string }[] = [
  { id: "puddo", name: "Puddo", price: 0, from: 0, power: "Rain-soaked clay with a leaf hat — the hero of Clayland" },
  { id: "pip", name: "Pip", price: 400, from: FRIEND_FROM.pip * STAGES_PER_ISLAND, power: "Slides on ice and swims fast; jumps a little lower" },
  { id: "gloop", name: "Gloop", price: 600, from: FRIEND_FROM.gloop * STAGES_PER_ISLAND, power: "Sticks to walls and wall-jumps; runs a little slower" },
  { id: "zib", name: "Zib", price: 800, from: FRIEND_FROM.zib * STAGES_PER_ISLAND, power: "Hovers for a moment — hold jump in the air" },
  { id: "momo", name: "Momo (guest)", price: 1000, from: 0, power: "The MOMOBLOBS star visits Clayland" },
];
const HATS: { id: string; name: string; icon: string; price: number }[] = [
  { id: "none", name: "Leaf hat", icon: "🍃", price: 0 }, { id: "party", name: "Party Hat", icon: "🎉", price: 150 }, { id: "flower", name: "Flower Crown", icon: "🌼", price: 200 },
  { id: "cowboy", name: "Cowboy Hat", icon: "🤠", price: 300 }, { id: "pirate", name: "Pirate Hat", icon: "🏴‍☠️", price: 350 }, { id: "wizard", name: "Wizard Hat", icon: "🧙", price: 400 },
  { id: "santa", name: "Santa Hat", icon: "🎅", price: 450 }, { id: "propeller", name: "Propeller Cap", icon: "🚁", price: 500 }, { id: "viking", name: "Viking Helmet", icon: "🛡️", price: 600 },
  { id: "chef", name: "Chef Hat", icon: "👨‍🍳", price: 650 }, { id: "crown", name: "Crown", icon: "👑", price: 1000 },
];
const TRAILS: { id: string; name: string; icon: string; price: number }[] = [
  { id: "none", name: "No trail", icon: "🚫", price: 0 }, { id: "stars", name: "Stars", icon: "⭐", price: 200 }, { id: "hearts", name: "Hearts", icon: "💗", price: 250 },
  { id: "bubbles", name: "Bubbles", icon: "🔵", price: 250 }, { id: "leaves", name: "Leaves", icon: "🍃", price: 250 }, { id: "sparkle", name: "Sparkle", icon: "✨", price: 350 },
  { id: "fire", name: "Fire", icon: "🔥", price: 400 }, { id: "rainbow", name: "Rainbow", icon: "🌈", price: 600 },
];
/** Bonbon's Snack Stop prices */
const SNACK_HEART = 40, SNACK_BOMBS = 50, SNACK_FRIEND = 60;
const WEAPON_HINT: Record<string, string> = { sprinkler: "3-way spray", downpour: "rapid fire", hailstone: "pierces through", thunder: "chains to 3 more", rainbow: "homing pellets", geyser: "big close blast" };

/** Act 1 comics: the prologue and Sergeant Grit's escapes */
const PROLOGUE: [string, string][] = [
  ["🦀🔔", "Kranky stole the 20 Rain Bells — and built the Dust Engine to drink the rain out of the sky."],
  ["🏭💨", "From the dry dust it bakes the Dust Army: grey, cracked clay soldiers called Dusties."],
  ["🍃💧", "Under Sprout Shore, Puddo finds the Rain Blaster — his clay bucket turned into a rain cannon."],
  ["🛡️🏖️", "Sergeant Grit leads the first wave up the beach. Soak them back into mud!"],
];
/** Act 2 (zone 5) and Act 3 (zone 9) open with a comic too */
const ACT_COMIC: Record<number, { sub: string; title: string; panels: [string, string][] }> = {
  5: {
    sub: "ACT 2 · DUST RISING", title: "Major Rasp",
    panels: [
      ["🐞⚙️", "Major Rasp takes command: a beetle general with a steel file for an arm, and a war machine in every zone."],
      ["🌬️🏔️", "Kite Cliffs, Sugarcrumb Hills, Toybox Town, the Mire: his Dust Army grows bigger, faster and meaner."],
      ["🦉🚂", "Puddo glides with Hoot, rides trains, drives tanks and mechs, and frees the Rain Squad from the Dust camps."],
      ["🔔💧", "Four more Rain Bells to win back. Rasp won't make it easy!"],
    ],
  },
  9: {
    sub: "ACT 3 · THE GREAT DROUGHT", title: "Colonel Clinker",
    panels: [
      ["🤖🔥", "Colonel Clinker fires up the Dust factories: a furnace-bellied robot who never sleeps."],
      ["❄️🏜️", "From Frostbite Peaks to the Dusty Dunes, the land dries to a crisp."],
      ["🏮🌲", "In Lantern Woods the lights go out, and the Gearworks Factory roars all night."],
      ["🏭💥", "Shut the factories down one by one, and blow up Clinker's forge!"],
    ],
  },
};
/** what the general does when his machine is wrecked (Grit in Act 1, Rasp in Act 2, Clinker in Act 3) */
const GRIT_ESCAPES: Record<number, [string, string][]> = {
  1: [["⚙️💥", "The Dust Crawler cracks open… Grit curls into a ball and rolls away!"], ["🍎", "\"You'll never catch me in the Grove!\""]],
  2: [["🚁🌊", "The Saw Copter spins into the juice river."], ["🌿", "Grit swings off on a vine: \"The caves are mine!\""]],
  3: [["🪨🔩", "The Drill Worm jams in the rock."], ["🫙", "Grit tunnels off toward the lagoon — with a whole tank of stolen rain."]],
  4: [["🌊💥", "The Bubble Sub pops like a soap bubble."], ["🗺️", "Grit escapes on a dust cloud… but he dropped Kranky's map of the Dust Fortress!"]],
  5: [["🚁💥", "The Gyro Copter spins out of control into the cliffs!"], ["🐞", "Rasp buzzes off on his beetle wings: \"The candy hills are mine!\""]],
  6: [["🍬💥", "The Candy Crusher's press jams on a lump of caramel."], ["🐞", "Rasp slips out the back hatch, licking sugar off his file."]],
  7: [["🚂💥", "The Toy Express jumps the tracks and tumbles into the toy box!"], ["🐞", "Rasp rides off on a wind-up horse: \"To the Mire!\""]],
  8: [["🍄💥", "The Root Borer's drill snaps on a giant root."], ["🐞", "Rasp burrows away… and hands the war to Colonel Clinker."]],
  9: [["❄️💥", "The Snow Plow skids off the slope into a snowdrift."], ["🤖", "Clinker clanks out, steaming: \"The desert will dry you up!\""]],
  10: [["🏜️💥", "The Worm Rig's drill bites the sand and blows a gasket."], ["🤖", "Clinker escapes in a dust devil, coughing soot."]],
  11: [["🏮💥", "The Lantern Blimp pops and drifts down into the bog."], ["🤖", "Clinker floats off on the last lantern: \"My forge awaits!\""]],
  12: [["⚙️💥", "The Forge Mech's furnace bursts in a shower of sparks!"], ["🤖", "Clinker's forge explodes and lights up Kranky's sky road…"]],
};

const UI_SOUNDS: Sound[] = ["a:click", "a:whooshOut", "a:whooshIn", "a:ding", "a:levelup", "tada", "a:cheer", "sadtrombone", "a:bwomp" as Sound];
const CORE_SFX = ["jump", "land", "coin", "shot", "hitdust", "melt", "boom", "bomb_throw", "hurt", "crate", "checkpoint", "gong", "stomp", "break", "drop", "foeshot", "pickup", "combo", "super", "gate", "alarm", "door"].map((n) => `a:clay_${n}` as Sound);
const music = (id: string) => `a:clay_${id}_${id === "map" ? "calm" : "action"}` as MusicName;
const isPhone = () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false);
const ui = (s: Sound = "a:click", gain = 0.4) => {
  audio.play(s, { gain, duck: false });
  if (useClay.getState().settings.vibrate && typeof navigator !== "undefined" && navigator.vibrate) { try { navigator.vibrate(8); } catch { /* blocked */ } }
};
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

// ------------------------------------------------------------------ small parts
function ClayBtn({ children, onClick, tone = "sun", className = "", big = false }: { children: ReactNode; onClick: () => void; tone?: "sun" | "mint" | "sky" | "plain" | "rose"; className?: string; big?: boolean }) {
  const bg = { sun: "bg-[#FFC21A] text-[#3A2600] shadow-[0_6px_0_#C98A00]", mint: "bg-[#4FD18B] text-[#0E3A22] shadow-[0_6px_0_#2A9A5E]", sky: "bg-[#5FB8FF] text-[#0B2A4A] shadow-[0_6px_0_#2F7FC8]", plain: "bg-white/90 text-[#2B2140] shadow-[0_6px_0_#BDB3D6]", rose: "bg-[#FF5F7E] text-white shadow-[0_6px_0_#C83A55]" }[tone];
  return (
    <button onClick={() => { ui(); onClick(); }} className={`${bg} flex items-center justify-center gap-2 rounded-2xl font-display tracking-wide transition active:translate-y-1 active:shadow-none ${big ? "px-8 py-4 text-2xl" : "px-5 py-3 text-lg"} ${className}`}>
      {children}
    </button>
  );
}
function Logo() {
  return (
    <div className="pointer-events-none text-center leading-none drop-shadow-[0_6px_0_rgba(60,20,0,0.35)]">
      <div className="font-display text-[clamp(18px,4.5vw,30px)] tracking-[0.3em] text-white [@media(max-height:520px)]:text-lg">PUDDO&apos;S</div>
      <div className="font-display text-[clamp(44px,12vw,92px)] text-[#FFC21A] [@media(max-height:520px)]:text-[54px]" style={{ WebkitTextStroke: "3px #7A3A00" }}>CLAYLAND</div>
      <div className="mt-1 inline-block rounded-full bg-[#3DA8FF] px-4 py-0.5 font-display text-[clamp(14px,3vw,22px)] tracking-[0.25em] text-white shadow-[0_4px_0_#1F6FB8] [@media(max-height:520px)]:text-sm">RAIN RAID</div>
    </div>
  );
}

/** the 3D stage (a session) — remounts on a new key */
function StageView({ n, runKey, attract, onHud, onEvent, onFinish, sessionRef, quality, easyRun, vibrate, hearts, look, friend, bombs }: {
  n: number; runKey: number; attract?: boolean; quality: "low" | "medium" | "high"; easyRun: boolean; vibrate: boolean; hearts: number; look: ClayLook; friend?: FriendId; bombs?: number;
  onHud?: (h: Hud) => void; onEvent?: (e: SimEvent) => void; onFinish?: (r: SimResult) => void; sessionRef?: React.MutableRefObject<ClaySession | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onHud, onEvent, onFinish });
  useEffect(() => { cb.current = { onHud, onEvent, onFinish }; });
  useEffect(() => {
    if (!host.current) return;
    const fx = upgradeEffects(useClay.getState().upgrades);
    const s = new ClaySession(host.current, {
      quality, n, hearts, attract, easyRun, vibrate, look, friend, bombs,
      up: attract ? undefined : { fireMul: fx.fireMul, dmgMul: fx.dmgMul, maxBombs: fx.maxBombs, magnet: fx.magnet },
      onHud: (h) => cb.current.onHud?.(h), onEvent: (e) => cb.current.onEvent?.(e), onFinish: (r) => cb.current.onFinish?.(r),
    });
    if (sessionRef) sessionRef.current = s;
    return () => { s.dispose(); if (sessionRef && sessionRef.current === s) sessionRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, n, attract, quality, look.char, look.hat, look.trail]);
  return <div ref={host} className="absolute inset-0" />;
}

/** the wardrobe's 3D dressing room */
function WardrobePreview({ look }: { look: ClayLook }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<ClayWardrobe | null>(null);
  useEffect(() => { if (!host.current) return; const v = new ClayWardrobe(host.current); view.current = v; return () => { v.dispose(); view.current = null; }; }, []);
  useEffect(() => { view.current?.set(look); }, [look]);
  return <div ref={host} className="relative h-full w-full" />;
}

/**
 * the left thumb's arrows: ◀ ▶ with ▲ above them (▲ = jump, hold for higher; it also climbs vines). It is one touch
 * surface, so the thumb can slide from arrow to arrow, and the spot between ▲ and ◀/▶ presses both — a running jump
 * with one thumb.
 */
function ArrowPad({ press, easyRun, s }: { press: (b: Button, d: boolean) => void; easyRun: boolean; s: number }) {
  const g = 12, W = 2 * s + g, H = Math.round(s * 1.9);
  const C: Record<"up" | "left" | "right", [number, number]> = { up: [W / 2, s / 2], left: [s / 2, H - s / 2], right: [W - s / 2, H - s / 2] };
  const host = useRef<HTMLDivElement>(null);
  const touches = useRef(new Map<number, Button[]>());
  const [on, setOn] = useState("");
  const zone = (e: RPointerEvent) => {
    const r = host.current!.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const d = (b: keyof typeof C) => Math.hypot(x - C[b][0], y - C[b][1]);
    const du = d("up"), dl = d("left"), dr = easyRun ? Infinity : d("right"), side: Button = dl < dr ? "left" : "right";
    const out: Button[] = [];
    if (du < s * 0.66) out.push("up");
    if (Math.min(dl, dr) < s * 0.66) out.push(side);
    if (!out.length && Math.min(du, dl, dr) < s * 1.2) out.push(du < Math.min(dl, dr) ? "up" : side);
    return out;
  };
  const apply = () => {
    const all = new Set<Button>(); touches.current.forEach((bs) => bs.forEach((b) => all.add(b)));
    (["up", "left", "right"] as Button[]).forEach((b) => press(b, all.has(b)));
    const key = [...all].sort().join(",");
    setOn((k) => (k === key ? k : key));
  };
  const down = (e: RPointerEvent) => { e.preventDefault(); host.current?.setPointerCapture?.(e.pointerId); touches.current.set(e.pointerId, zone(e)); apply(); };
  const move = (e: RPointerEvent) => { if (!touches.current.has(e.pointerId)) return; touches.current.set(e.pointerId, zone(e)); apply(); };
  const up = (e: RPointerEvent) => { touches.current.delete(e.pointerId); apply(); };
  const held = on.split(",");
  const btn = (b: keyof typeof C, label: string) => (
    <div aria-hidden className={`absolute grid place-items-center rounded-full font-display text-white ring-2 ring-white/40 backdrop-blur-sm transition-transform duration-75 ${held.includes(b) ? "scale-95 bg-white/35" : b === "up" ? "bg-[#4FD18B]/70" : "bg-black/30"}`}
      style={{ width: s, height: s, left: C[b][0] - s / 2, top: C[b][1] - s / 2, fontSize: s * 0.36 }}>{label}</div>
  );
  return (
    <div ref={host} role="group" aria-label="Arrows: left, right and up to jump"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}
      className="pointer-events-auto relative select-none" style={{ width: W, height: H, touchAction: "none", WebkitUserSelect: "none" }}>
      {btn("up", "▲")}{btn("left", "◀")}{!easyRun && btn("right", "▶")}
    </div>
  );
}

/** on-screen controls: ◀ ▲ ▶ on the left; ▼, BOMB, FIRE (hold) and SUPER (when the Storm meter is full) on the right */
function TouchPad({ press, easyRun, big, bombs, superReady }: { press: (b: Button, d: boolean) => void; easyRun: boolean; big: boolean; bombs: number; superReady: boolean }) {
  // narrow phones (portrait): a slightly smaller set so both thumbs' buttons fit
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 440);
  useEffect(() => { const f = () => setNarrow(window.innerWidth < 440); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const pad = (b: Button, label: ReactNode, cls: string) => (
    <button
      aria-label={b}
      onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); press(b, true); }}
      onPointerUp={() => press(b, false)} onPointerCancel={() => press(b, false)} onPointerLeave={() => press(b, false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-auto relative grid select-none place-items-center rounded-full font-display text-white ring-2 ring-white/40 backdrop-blur-sm active:scale-95 ${cls}`}
      style={{ touchAction: "none", WebkitUserSelect: "none" }}
    >{label}</button>
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-[max(14px,env(safe-area-inset-left))] pb-[max(16px,env(safe-area-inset-bottom))]">
      <ArrowPad press={press} easyRun={easyRun} s={narrow ? (big ? 64 : 56) : big ? 84 : 68} />
      <div className={`flex items-end ${narrow ? "gap-1.5" : "gap-2.5"}`}>
        {pad("down", "▼", `${narrow ? "size-11" : big ? "size-16" : "size-14"} mb-1 bg-black/25 text-xl`)}
        <div className="flex flex-col items-center gap-2">
          {pad("bomb", <span className="flex flex-col items-center leading-none"><Bomb className="size-6" /><span className="mt-0.5 text-xs">{bombs}</span></span>, `${narrow ? "size-14" : big ? "size-[72px]" : "size-16"} ${bombs > 0 ? "bg-[#3A3430]/80" : "bg-black/20 opacity-60"}`)}
        </div>
        <div className="flex flex-col items-center gap-2">
          {superReady && pad("super", <span className="flex flex-col items-center text-sm leading-none"><Zap className="size-6 fill-current" />SUPER</span>, `${narrow ? "size-14" : big ? "size-[76px]" : "size-16"} animate-pulse bg-[#3DA8FF]`)}
          {pad("fire", <span className="text-lg leading-tight">FIRE</span>, `${narrow ? "size-[76px]" : big ? "size-[104px]" : "size-[88px]"} bg-[#3DA8FF]/85`)}
        </div>
      </div>
    </div>
  );
}

function HudBar({ h, label, compact }: { h: Hud; label: string; compact: boolean }) {
  const W = WEAPONS[h.weapon];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-[max(12px,env(safe-area-inset-left))] pt-[max(10px,env(safe-area-inset-top))] font-display text-white">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-0.5 rounded-full bg-black/30 px-2.5 py-1 backdrop-blur-sm">
          {Array.from({ length: h.maxHearts }, (_, i) => <Heart key={i} className={`size-5 portrait:size-4 ${i < h.hearts ? "fill-[#FF3D6E] text-[#FF3D6E]" : "text-white/40"}`} />)}
          <span className="ml-1.5 text-sm">×{h.lives}</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-sm backdrop-blur-sm">
          {[0, 1, 2].map((i) => <Droplet key={i} className={`size-4 ${i < h.drops ? "fill-[#3DB8FF] text-[#3DB8FF]" : "text-white/40"}`} />)}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <div className={`relative h-5 w-full max-w-[280px] overflow-hidden rounded-full bg-black/35 ring-2 ${h.storm >= 1 ? "animate-pulse ring-[#9FE6FF]" : "ring-white/50"}`}>
          <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${Math.round(h.storm * 100)}%`, background: h.superOn ? "linear-gradient(90deg,#FFFFFF,#9FE6FF)" : "linear-gradient(90deg,#3DA8FF,#9FE6FF)" }} />
          <span className="absolute inset-0 grid place-items-center text-[11px] tracking-wider text-white drop-shadow">{h.superOn ? "SUPER RAIN!" : h.storm >= 1 ? (compact ? "SUPER READY — TAP SUPER" : "SUPER READY — PRESS V") : "STORM"}</span>
        </div>
        <div className="max-w-full truncate text-[11px] tracking-wide text-white/85 drop-shadow">{label}</div>
        {h.goal && (
          <div className="rounded-full bg-black/35 px-3 py-0.5 text-sm backdrop-blur-sm">
            {h.goal.label === "Vault" ? `🪙 ${mmss(h.goal.time ?? 0)}` : h.goal.label === "Well" ? `⛲ ${h.goal.have}/${h.goal.need} · ${mmss(h.goal.time ?? 0)}` : `${h.goal.label === "Pumps" ? "💣" : h.goal.label === "Sprouts" ? "🌱" : h.goal.label === "Keys" ? "🔑" : h.goal.label === "Cart" ? "🛒" : h.goal.label === "Elites" ? "🎖️" : "🏟️"} ${h.goal.label} ${h.goal.have}/${h.goal.need}`}
          </div>
        )}
        {h.bossHp !== undefined && h.bossMax ? (
          <div className="mt-1 h-3 w-full max-w-[320px] overflow-hidden rounded-full bg-black/40 ring-2 ring-[#FFD23F]"><div className="h-full bg-gradient-to-r from-[#FF3D4E] to-[#FF8A3D] transition-[width]" style={{ width: `${(h.bossHp / h.bossMax) * 100}%` }} /></div>
        ) : null}
      </div>
      <div className="mr-14 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 backdrop-blur-sm"><CoinIcon className="size-5" /><span className="text-lg">{h.coins}</span></div>
        <div className="flex items-center gap-1.5">
          <div className="rounded-full px-2.5 py-0.5 text-xs text-[#0B2A4A]" style={{ background: W.color }}>{W.short}</div>
          {!compact && <div className="flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-xs"><Bomb className="size-3.5" />{h.bombs}</div>}
        </div>
        {h.combo >= 2 && <div className="rounded-full bg-[#FFD23F] px-2.5 py-0.5 text-sm text-[#3A2600]">{h.combo} combo{h.mult > 1 ? ` ×${h.mult}` : ""}</div>}
        {h.friend && <div className="rounded-full bg-[#4FD18B]/85 px-2.5 py-0.5 text-xs text-[#0E3A22]">{FRIEND_NAME[h.friend]}</div>}
        {h.star > 0 && <div className="rounded-full bg-[#FFD23F] px-2.5 py-0.5 text-xs text-[#3A2600]">★ {Math.ceil(h.star)}</div>}
      </div>
      <div className="absolute inset-x-0 bottom-[-6px] mx-auto h-1 w-[min(60vw,360px)] overflow-hidden rounded-full bg-white/20"><div className="h-full bg-white/80" style={{ width: `${h.progress * 100}%` }} /></div>
    </div>
  );
}

/** night stages: everything is dark except a pool of light around Puddo (bigger near lit lanterns) */
function DarkVeil({ sess }: { sess: React.MutableRefObject<ClaySession | null> }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = sess.current, d = el.current; if (!s || !d) return;
      const sim = s.sim, [x, y] = s.r.screen(sim.x, sim.y + 0.6);
      const near = sim.st.gadgets.some((g) => g.kind === "lantern" && sim.lit.has(g.id) && Math.abs(g.x - sim.x) < 9);
      const r = Math.min(window.innerWidth, window.innerHeight) * (near ? 0.6 : 0.38) + (sim.star > 0 || sim.superT > 0 ? 140 : 0);
      d.style.background = `radial-gradient(circle ${r}px at ${x}px ${y}px, rgba(8,6,24,0) 0%, rgba(8,6,24,0.2) 55%, rgba(8,6,24,0.82) 100%)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sess]);
  return <div ref={el} className="pointer-events-none absolute inset-0 z-10" />;
}

/** Bonbon's Snack Stop, after a fight: an extra heart, bombs or a friend for the next stage, paid with coins */
function SnackStop({ next }: { next: number }) {
  const snack = useClay((s) => s.snack);
  const coins = useProfile((p) => p.coins);
  const isl = islandOf(next).n;
  const friends = (Object.keys(FRIEND_FROM) as FriendId[]).filter((f) => FRIEND_FROM[f] < isl);
  const buy = (price: number, set: () => void) => { if (useProfile.getState().spendCoins(price)) { ui("a:ding"); set(); } else ui("a:bwomp" as Sound); };
  const chip = (on: boolean, dis: boolean, label: string, price: number, set: () => void) => (
    <button disabled={on || dis} onClick={() => buy(price, set)} className={`rounded-xl px-2.5 py-1.5 font-display text-sm ${on ? "bg-[#4FD18B] text-white" : "bg-white"} disabled:opacity-60`}>{label} · {price}</button>
  );
  const put = (p: Partial<typeof snack>) => () => useClay.getState().setSnack({ ...useClay.getState().snack, ...p });
  return (
    <div className="mb-4 rounded-2xl bg-[#FF9FC4]/25 p-3 text-left">
      <div className="font-display text-base">🧁 Bonbon&apos;s Snack Stop</div>
      <div className="mb-2 text-xs font-semibold text-[#5A4F78]">A treat for the next stage{snack.heart || snack.friend || snack.bombs ? " — packed!" : ""}</div>
      <div className="flex flex-wrap gap-1.5">
        {chip(!!snack.heart, coins < SNACK_HEART, "❤️ +1 heart", SNACK_HEART, put({ heart: true }))}
        {chip(!!snack.bombs, coins < SNACK_BOMBS, "💣 +2 bombs", SNACK_BOMBS, put({ bombs: true }))}
        {friends.slice(-3).map((f) => <span key={f}>{chip(snack.friend === f, coins < SNACK_FRIEND, FRIEND_NAME[f], SNACK_FRIEND, put({ friend: f }))}</span>)}
      </div>
    </div>
  );
}

/** the Blaster Shop: permanent upgrades for site coins */
function Shop({ onBack }: { onBack: () => void }) {
  const save = useClay();
  const coins = useProfile((p) => p.coins);
  const fx = upgradeEffects(save.upgrades);
  return (
    <motion.div key="shop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex flex-col bg-[#0F2A44]/85 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 pb-2 pt-[max(70px,env(safe-area-inset-top))] [@media(max-height:520px)]:pt-[60px]">
        <button aria-label="Back" onClick={() => { ui(); onBack(); }} className="grid size-11 place-items-center rounded-full bg-white/15"><ArrowLeft className="size-6" /></button>
        <div className="font-display text-2xl">Blaster Shop</div>
        <div className="ml-auto flex items-center gap-1.5 font-display"><CoinIcon className="size-5" />{coins}</div>
      </div>
      <div className="px-4 pb-2 text-sm font-semibold text-white/80">Now: {fx.fireMul.toFixed(2)}× fire rate · {fx.dmgMul.toFixed(2)}× power · {fx.maxBombs} bombs · {fx.hearts} hearts</div>
      <div className="grid flex-1 auto-rows-max grid-cols-1 gap-2.5 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] sm:grid-cols-2">
        {UPGRADES.map((u) => {
          const lvl = save.upgrades[u.id] ?? 0, max = lvl >= u.prices.length, price = u.prices[lvl];
          return (
            <button key={u.id} disabled={max} onClick={() => { if (save.upgrade(u.id)) ui("a:levelup"); else ui("a:bwomp" as Sound); }}
              className={`flex items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.98] ${max ? "bg-[#4FD18B]/80 text-[#0E3A22]" : coins >= price ? "bg-white text-[#2B2140]" : "bg-white/60 text-[#2B2140]"}`}>
              <span className="text-3xl">{u.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg leading-tight">{u.name}</span>
                <span className="block text-xs font-semibold opacity-80">{u.what}</span>
                <span className="mt-1 flex gap-1">{u.prices.map((_, i) => <span key={i} className={`h-2 w-6 rounded-full ${i < lvl ? "bg-[#FFC21A]" : "bg-[#2B2140]/15"}`} />)}</span>
              </span>
              <span className="font-display text-sm">{max ? "MAX" : <span className="flex items-center gap-1"><CoinIcon className="size-4" />{price}</span>}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

/** the wardrobe: characters, hats and trails bought with the site's coins */
function Wardrobe({ onBack }: { onBack: () => void }) {
  const save = useClay();
  const coins = useProfile((p) => p.coins);
  const [tab, setTab] = useState<"char" | "hat" | "trail">("char");
  const [tryOn, setTryOn] = useState<ClayLook | null>(null);
  const preview = tryOn ?? save.look;
  const own = (id: string) => id === "char:puddo" || id === "hat:none" || id === "trail:none" || save.owned.includes(id);
  const pick = (kind: "char" | "hat" | "trail", id: string, price: number, locked: boolean) => {
    const key = `${kind}:${id}`;
    const next = { ...save.look, [kind]: id } as ClayLook;
    if (locked) { setTryOn(next); ui("a:bwomp" as Sound); return; }
    if (!own(key)) { if (!save.buy(key, price)) { setTryOn(next); ui("a:bwomp" as Sound); return; } ui("a:levelup"); }
    else ui();
    setTryOn(null);
    save.setLook({ [kind]: id } as Partial<ClayLook>);
  };
  const items = tab === "char" ? CHARS.map((c) => ({ id: c.id, name: c.name, icon: c.id === "puddo" ? "🍃" : c.id === "pip" ? "🐧" : c.id === "gloop" ? "🟢" : c.id === "zib" ? "👽" : "🍊", price: c.price, locked: save.unlocked <= c.from, note: c.power, lockNote: `Free ${c.name} in zone ${Math.ceil((c.from + 1) / STAGES_PER_ISLAND)}` }))
    : (tab === "hat" ? HATS : TRAILS).map((h) => ({ ...h, locked: false, note: "", lockNote: "" }));
  const kind = tab;
  return (
    <motion.div key="wardrobe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex flex-col bg-[#14304F]/80 backdrop-blur-sm landscape:flex-row">
      <div className="relative flex h-[44%] shrink-0 flex-col landscape:h-full landscape:w-[42%]">
        <div className="z-10 flex items-center gap-3 px-4 pt-[max(70px,env(safe-area-inset-top))] [@media(max-height:520px)]:pt-[60px]">
          <button aria-label="Back" onClick={() => { ui(); onBack(); }} className="grid size-11 place-items-center rounded-full bg-white/15"><ArrowLeft className="size-6" /></button>
          <div className="font-display text-2xl">Wardrobe</div>
        </div>
        <div className="relative min-h-0 flex-1"><WardrobePreview look={preview} /></div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(16px,env(safe-area-inset-bottom))] landscape:pt-[max(70px,env(safe-area-inset-top))] [@media(max-height:520px)]:pt-[60px]">
        <div className="mb-2 flex items-center gap-2">
          {(["char", "hat", "trail"] as const).map((t) => <button key={t} onClick={() => { ui(); setTab(t); }} className={`rounded-full px-4 py-1.5 font-display ${tab === t ? "bg-[#FFC21A] text-[#3A2600]" : "bg-white/15"}`}>{t === "char" ? "Characters" : t === "hat" ? "Hats" : "Trails"}</button>)}
          <div className="ml-auto flex items-center gap-1.5 font-display"><CoinIcon className="size-5" />{coins}</div>
        </div>
        <div className="grid flex-1 auto-rows-max grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {items.map((it) => {
            const key = `${kind}:${it.id}`, owned = own(key), on = save.look[kind] === it.id;
            return (
              <button key={it.id} onClick={() => pick(kind, it.id, it.price, it.locked)} className={`rounded-2xl p-2.5 text-left transition active:scale-95 ${on ? "bg-[#FFC21A] text-[#3A2600]" : "bg-white/90 text-[#2B2140]"} ${it.locked ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between"><span className="text-2xl">{it.icon}</span><span className="font-display text-xs">{on ? "WEARING" : it.locked ? <Lock className="size-4" /> : owned ? "OWNED" : <span className="flex items-center gap-1"><CoinIcon className="size-4" />{it.price}</span>}</span></div>
                <div className="mt-1 font-display text-sm leading-tight">{it.name}</div>
                {(it.note || it.locked) && <div className="mt-0.5 text-[11px] font-semibold leading-tight opacity-80">{it.locked ? it.lockNote : it.note}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/** a comic strip: big panels, a caption under each */
function Comic({ panels, title, sub }: { panels: [string, string][]; title: string; sub: string }) {
  return (
    <div className="w-[min(94vw,760px)] rounded-3xl bg-[#FFF6E8] p-4 text-[#2B2140] shadow-2xl [@media(max-height:520px)]:p-3">
      <div className="font-display text-sm tracking-widest text-[#FF8A3D]">{sub}</div>
      <div className="mb-3 font-display text-2xl leading-tight [@media(max-height:520px)]:mb-2">{title}</div>
      <div className={`grid gap-2.5 ${panels.length > 2 ? "grid-cols-2 sm:grid-cols-4 [@media(max-height:520px)]:grid-cols-4" : "grid-cols-2"}`}>
        {panels.map(([art, text], i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.35 }} className="flex flex-col overflow-hidden rounded-2xl border-[3px] border-[#2B2140] bg-white">
            <div className="grid h-20 place-items-center bg-gradient-to-b from-[#BFE3FF] to-[#FFE9C8] text-4xl [@media(max-height:520px)]:h-14">{art}</div>
            <div className="p-2 text-[13px] font-semibold leading-snug [@media(max-height:520px)]:text-xs">{text}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the app
export default function ClaylandApp({ title }: { slug: string; title: string }) {
  const ready = useClayHydrated();
  const save = useClay();
  const coins = useProfile((p) => p.coins);
  const player = usePlayer();
  const { setImmersive, setLoading, setInRound, setMenu, paused, goLandscape } = player;
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<Run | null>(null);
  const [islandView, setIslandView] = useState(0);
  const [storyIsland, setStoryIsland] = useState(0);
  const [clear, setClear] = useState<Clear | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [card, setCard] = useState<{ label: string; name: string; concept: string; brief: string; hint?: string } | null>(null);
  const [info, setInfo] = useState<{ name: string; dark: boolean; music: string }>({ name: "", dark: false, music: "shore" });
  const [toast, setToast] = useState<{ id: number; text: string; tone: string } | null>(null);
  const [tutorialFrom, setTutorialFrom] = useState<"play" | "title" | "settings">("title");
  const sess = useRef<ClaySession | null>(null);
  const quality = save.settings.quality === "auto" ? autoQuality() : save.settings.quality;
  const coarse = useMemo(() => isPhone(), []);

  useEffect(() => { setLoading(null); }, [setLoading]);
  useEffect(() => { void audio.preload([...UI_SOUNDS, ...CORE_SFX], [music("map")]); }, []);
  useEffect(() => { setImmersive(screen === "game"); setInRound(screen === "game"); }, [screen, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => { if (screen !== "game") void audio.playMusic(music("map")); }, [screen]);
  useEffect(() => { sess.current?.pause(paused); }, [paused]);

  // ---------------------------------------------------------------- starting a stage
  const begin = useCallback((n: number) => {
    const st = buildStage(n);
    const snack = isDaily(n) ? {} : useClay.getState().takeSnack();
    setRun((r) => ({ key: (r?.key ?? 0) + 1, n, friend: snack.friend, bonusHeart: snack.heart, bombs: snack.bombs }));
    setHud(null); setClear(null);
    setInfo({ name: st.name, dark: !!st.rules.dark, music: st.music });
    setCard({
      label: isDaily(n) ? `Daily Storm · ${new Date((n - dailyNumber(0)) * 86400000).toISOString().slice(0, 10)}` : n > DESIGNED ? `Endless Storm · ${n - DESIGNED}` : `${islandOf(n).name} · ${islandOf(n).districts[st.district]} · ${stageLabel(n)}`,
      name: st.name, concept: `${CONCEPT_ICON[st.concept]} ${CONCEPT_NAME[st.concept]}`, brief: st.brief,
      hint: snack.friend ? `${FRIEND_NAME[snack.friend]} from Bonbon's Snack Stop!` : snack.bombs ? "+2 Storm Bombs from Bonbon!" : st.hint,
    });
    setTimeout(() => setCard((c) => (c && c.name === st.name ? null : c)), 3600);
    setScreen("game");
    if (!isDaily(n)) useClay.getState().setNext(n);
    void audio.playMusic(music(st.music));
    const nx = buildStage(isDaily(n) ? Math.min(useClay.getState().next, DESIGNED) : n + 1);
    audio.prepareMusic(music(nx.music));
    audio.warmMusic([music("boss"), music("star"), music("chase")].filter((m) => m !== music(st.music)));
  }, []);
  const play = useCallback((n: number, skipTutorial = false) => {
    if (coarse) void goLandscape();
    // a first-time player sees how to play first
    if (!skipTutorial && !useClay.getState().tutorialSeen) { setRun({ key: (run?.key ?? 0) + 1, n }); setTutorialFrom("play"); setScreen("tutorial"); return; }
    const isl = n <= DESIGNED ? islandOf(n) : null;
    if (isl && stageInIsland(n) === 1 && !useClay.getState().storiesSeen.includes(isl.n)) { setStoryIsland(isl.n); setRun({ key: (run?.key ?? 0) + 1, n }); setScreen("story"); return; }
    begin(n);
  }, [begin, coarse, goLandscape, run?.key]);
  const cont = useCallback(() => { const st = useClay.getState(); play(Math.min(st.next, st.unlocked > DESIGNED ? st.remix : st.unlocked) || 1); }, [play]);

  // the pause menu
  useEffect(() => {
    if (screen !== "game" || !run) { setMenu([]); return; }
    setMenu([
      { id: "restart", label: "Restart stage", icon: "↻", onSelect: () => begin(run.n) },
      { id: "map", label: "Zone map", icon: "🗺️", onSelect: () => { setIslandView(run.n <= DESIGNED ? islandOf(run.n).n - 1 : 20); setScreen("island"); } },
    ]);
  }, [screen, run, setMenu, begin]);

  // ---------------------------------------------------------------- what happens in a stage
  const say = useCallback((text: string, tone = "sun") => { setToast({ id: Date.now() + Math.random(), text, tone }); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast((x) => (x?.id === toast.id ? null : x)), 2000); return () => clearTimeout(t); }, [toast]);
  const lastWell = useRef(0), lastCart = useRef(0);
  const onEvent = useCallback((e: SimEvent, sim?: Sim) => {
    switch (e.t) {
      case "friend": say(`${FRIEND_NAME[e.f]} joined! ${FRIEND_POWER[e.f]}`, "mint"); break;
      case "friendLost": say(`${FRIEND_NAME[e.f]} took the hit for you!`, "plain"); break;
      case "checkpoint": say(`Checkpoint ${e.n}!`, "sky"); break;
      case "drop": say(`Rain Drop ${e.n}/3!`, "sky"); break;
      case "star": say("Golden Sprout! Nothing can touch you", "sun"); audio.playMusic(music("star")); break;
      case "bossDown": say("Beaten!", "sun"); break;
      case "stretch": say("Noodle made a bridge!", "mint"); break;
      case "switch": say(e.on ? "ON!" : "OFF!", "plain"); break;
      case "pickup": say(`${WEAPONS[e.w].short}! ${WEAPON_HINT[e.w] ?? ""}`, "sky"); break;
      case "lostWeapon": say("Hit! Back to Drizzle", "rose"); break;
      case "combo": say(`${e.n} COMBO! ×${e.mult} coins`, "sun"); break;
      case "stormFull": say(coarse ? "SUPER RAIN ready — tap SUPER!" : "SUPER RAIN ready — press V!", "sky"); break;
      case "super": say("SUPER RAIN!", "sky"); break;
      case "gateClose": say("AMBUSH! Melt every wave", "rose"); break;
      case "wave": if (e.n > 1) say(`Wave ${e.n}/${e.of}`, "plain"); break;
      case "gateOpen": say("Gate open!", "mint"); break;
      case "pumpDown": say("Dust Pump down!", "mint"); break;
      case "cageOpen": say("Sprout freed!", "mint"); break;
      case "key": say(`Crystal key ${e.n}/3!`, "sky"); break;
      case "doorOpen": say("The exit is open — go!", "mint"); break;
      case "goalDone": say("Done! 🎉", "mint"); break;
      case "wellHit": if (Date.now() - lastWell.current > 2500) { lastWell.current = Date.now(); say("The well is under attack!", "rose"); } break;
      case "cartHit": if (Date.now() - lastCart.current > 2500) { lastCart.current = Date.now(); say(e.hp > 0 ? "The Rain Cart is hit — protect it!" : "The Rain Cart is wrecked!", "rose"); } break;
      case "alarm": say("Spotted! Dusties incoming", "rose"); break;
      case "huntDown": say(`Elite down! ${e.n}${sim ? `/${sim.st.need}` : ""}`, "sun"); break;
      case "lifeLost": say(e.lives > 0 ? `Life lost — ${e.lives} left` : "Out of lives!", "rose"); break;
      case "bombs": say(`Storm Bombs: ${e.n}`, "plain"); break;
      default: break;
    }
  }, [say, coarse]);
  const lastMusic = useRef("");
  useEffect(() => {
    if (screen !== "game" || !hud || !run) return;
    const want = hud.star > 0 ? "star" : hud.bossHp !== undefined ? "boss" : info.music;
    if (want !== lastMusic.current) { lastMusic.current = want; void audio.playMusic(music(want)); }
  }, [hud, screen, run, info.music]);
  useEffect(() => { if (screen !== "game") lastMusic.current = ""; }, [screen]);

  const onFinish = useCallback((r: SimResult) => {
    const out = useClay.getState().finish(r);
    const boss = r.n <= DESIGNED && r.s === STAGES_PER_ISLAND, machine = r.concept === "machine";
    const daily = isDaily(r.n) ? useClay.getState().finishDaily(r.n - dailyNumber(0), r.cleared, r.cleared && r.noHit) : undefined;
    setClear({ r, ...out, boss, machine, daily });
    setScreen("clear");
    audio.play(r.cleared ? (boss || machine ? "a:levelup" : "tada") : "sadtrombone", { gain: 0.6, duck: false });
    if (r.cleared) setTimeout(() => audio.play("a:cheer", { gain: 0.4, duck: false }), 300);
  }, []);
  const next = useCallback(() => {
    if (!clear) return;
    if (isDaily(clear.r.n)) { setScreen("title"); return; }
    const n = clear.r.n + 1;
    if (clear.r.n === DESIGNED && clear.r.cleared && !useClay.getState().endingSeen) { setScreen("ending"); return; }
    play(n);
  }, [clear, play]);

  if (!ready) return <div className="absolute inset-0 bg-[#5EC8FF]" />;
  const titleN = Math.min(save.unlocked, DESIGNED);
  const bells = bellsRung(save.medals);
  const totalDrops = Object.values(save.medals).reduce((a, m) => a + m.d, 0);
  const hearts = heartsFor(save.upgrades) + (run?.bonusHeart ? 1 : 0);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#5EC8FF] text-white select-none">
      {screen === "game" && run ? (
        <StageView key={`g${run.key}`} n={run.n} runKey={run.key} quality={quality} easyRun={save.settings.easyRun} vibrate={save.settings.vibrate} hearts={hearts} look={save.look} friend={run.friend}
          bombs={START_BOMBS + (run.bombs ? 2 : 0)} onHud={setHud} onEvent={onEvent} onFinish={onFinish} sessionRef={sess} />
      ) : (
        <StageView key={`t${titleN}`} n={titleN} runKey={0} attract quality={quality === "high" ? "medium" : quality} easyRun={false} vibrate={false} hearts={3} look={save.look} />
      )}

      {screen === "game" && run && (
        <>
          {info.dark && <DarkVeil sess={sess} />}
          {run.n === 1 && !save.coachDone && <Coach sess={sess} coarse={coarse} onDone={() => useClay.getState().finishCoach()} />}
          {hud?.superOn && <div className="pointer-events-none absolute inset-0 z-10 bg-[#3DA8FF]/15" />}
          {hud && <HudBar h={hud} label={`${stageLabel(run.n)} · ${info.name}`} compact={coarse} />}
          {coarse && <TouchPad press={(b, d) => sess.current?.press(b, d)} easyRun={save.settings.easyRun} big={save.settings.bigButtons} bombs={hud?.bombs ?? START_BOMBS} superReady={(hud?.storm ?? 0) >= 1 && !hud?.superOn} />}
          <AnimatePresence>
            {card && (
              <motion.div key="card" initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} className="pointer-events-none absolute inset-x-0 top-[20%] z-30 mx-auto w-[min(90vw,500px)] rounded-3xl bg-white/92 px-5 py-4 text-center text-[#2B2140] shadow-2xl [@media(max-height:520px)]:top-[14%] [@media(max-height:520px)]:py-3">
                <div className="font-display text-xs tracking-widest text-[#FF8A3D]">{card.label}</div>
                <div className="font-display text-3xl leading-tight [@media(max-height:520px)]:text-2xl">{card.name}</div>
                <div className="mt-1 inline-block rounded-full bg-[#2B2140] px-3 py-0.5 font-display text-sm text-white">{card.concept}</div>
                <div className="mt-1.5 text-base font-bold text-[#2B2140]">{card.brief}</div>
                {card.hint && <div className="mt-1 text-sm font-semibold text-[#5A4F78]">{card.hint}</div>}
                {!coarse && <div className="mt-2 text-xs text-[#8A80A8]">← → move · ↑ / Space jump · X fire · C bomb · V Super Rain · ↓ duck / stomp</div>}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {toast && (
              <motion.div key={toast.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`pointer-events-none absolute inset-x-0 top-[17%] z-30 mx-auto w-fit max-w-[86vw] rounded-full px-4 py-2 text-center font-display text-base shadow-lg ${{ sun: "bg-[#FFC21A] text-[#3A2600]", mint: "bg-[#4FD18B] text-[#0E3A22]", sky: "bg-[#5FB8FF] text-[#0B2A4A]", plain: "bg-white text-[#2B2140]", rose: "bg-[#FF5F7E] text-white" }[toast.tone]}`}>
                {toast.text}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ---------------------------------------------------------------- menus */}
      <AnimatePresence mode="wait">
        {screen === "title" && (
          <motion.div key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex flex-col items-center justify-between bg-gradient-to-b from-black/10 via-transparent to-black/40 px-4 pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(56px,env(safe-area-inset-top))] [@media(max-height:520px)]:pb-[max(10px,env(safe-area-inset-bottom))]">
            <div className="flex w-full max-w-md items-center justify-between">
              <div className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 font-display backdrop-blur-sm"><CoinIcon className="size-5" />{coins}</div>
              <div className="flex gap-2">
                <button aria-label="How to play" onClick={() => { ui(); setTutorialFrom("title"); setScreen("tutorial"); }} className="grid size-11 place-items-center rounded-full bg-black/30 backdrop-blur-sm"><CircleHelp className="size-6" /></button>
                <button aria-label="Settings" onClick={() => { ui(); setScreen("settings"); }} className="grid size-11 place-items-center rounded-full bg-black/30 backdrop-blur-sm"><Settings2 className="size-6" /></button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Logo />
              <div className="rounded-full bg-black/30 px-4 py-1 font-display text-sm tracking-wide backdrop-blur-sm">🔔 {bells}/20 Rain Bells · 💧 {totalDrops} Rain Drops</div>
            </div>
            <div className="flex w-full max-w-md flex-col gap-3 [@media(max-height:520px)]:max-w-3xl [@media(max-height:520px)]:gap-1.5">
              <div className="flex flex-col gap-3 [@media(max-height:520px)]:flex-row [@media(max-height:520px)]:gap-2">
                <ClayBtn big className="[@media(max-height:520px)]:flex-[1.1]" onClick={cont}><Play className="size-7 fill-current" /> {save.plays ? "CONTINUE" : "PLAY"}</ClayBtn>
                <div className="grid grid-cols-4 gap-2 [@media(max-height:520px)]:flex-[2.2]">
                  <ClayBtn tone="plain" className="!px-1 !text-sm" onClick={() => { setIslandView(Math.min(19, islandOf(titleN).n - 1)); setScreen("map"); }}><MapIcon className="size-5" /> MAP</ClayBtn>
                  <ClayBtn tone="sky" className="!px-1 !text-sm" onClick={() => { if (coarse) void goLandscape(); begin(dailyNumber()); }}><CalendarDays className="size-5" /> DAILY{save.daily.key === today() && save.daily.cleared ? "✓" : ""}</ClayBtn>
                  <ClayBtn tone="rose" className="!px-1 !text-sm" onClick={() => setScreen("shop")}><ShoppingBag className="size-5" /> SHOP</ClayBtn>
                  <ClayBtn tone="mint" className="!px-1 !text-sm" onClick={() => setScreen("wardrobe")}><Shirt className="size-5" /> STYLE</ClayBtn>
                </div>
              </div>
              <div className="text-center font-display text-sm text-white/90 drop-shadow">
                {save.next > DESIGNED ? `Endless Storm · ${save.next - DESIGNED}` : `${islandOf(Math.min(save.next, DESIGNED)).name} · ${stageLabel(Math.min(save.next, DESIGNED))} · ${CONCEPT_ICON[zoneSchedule(islandOf(Math.min(save.next, DESIGNED)))[stageInIsland(Math.min(save.next, DESIGNED)) - 1]]} ${CONCEPT_NAME[zoneSchedule(islandOf(Math.min(save.next, DESIGNED)))[stageInIsland(Math.min(save.next, DESIGNED)) - 1]]}`}
                {save.daily.streak > 0 && ` · 🔥 Daily ${save.daily.key === today() || save.daily.lastClear === today() - 1 ? save.daily.streak : 0}`}
              </div>
            </div>
          </motion.div>
        )}

        {screen === "map" && (
          <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex flex-col bg-[#14304F]/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-4 pb-2 pt-[max(70px,env(safe-area-inset-top))] [@media(max-height:520px)]:pt-[60px]">
              <button aria-label="Back" onClick={() => { ui(); setScreen("title"); }} className="grid size-11 place-items-center rounded-full bg-white/15"><ArrowLeft className="size-6" /></button>
              <div className="font-display text-2xl">Clayland</div>
              <div className="ml-auto font-display text-sm text-white/80">🔔 {bells}/20</div>
            </div>
            <div className="grid flex-1 auto-rows-max grid-cols-2 gap-3 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] sm:grid-cols-4">
              {ISLANDS.map((isl, i) => {
                const first = i * STAGES_PER_ISLAND + 1, open = save.unlocked >= first;
                const done = Array.from({ length: STAGES_PER_ISLAND }, (_, k) => save.medals[first + k]?.c).filter(Boolean).length;
                const rung = !!save.medals[first + STAGES_PER_ISLAND - 1]?.c;
                return (
                  <button key={isl.id} disabled={!open} onClick={() => { ui(); setIslandView(i); setScreen("island"); }}
                    className={`relative overflow-hidden rounded-2xl p-3 text-left ring-2 transition active:scale-95 ${open ? "ring-white/40" : "opacity-55 ring-white/10"}`}
                    style={{ background: `linear-gradient(160deg, ${isl.pal.sky[0]}, ${isl.pal.ground})` }}>
                    <div className="font-display text-xs text-white/85">ZONE {isl.n}{i < 4 ? " · ACT 1" : i < 8 ? " · ACT 2" : i < 12 ? " · ACT 3" : i < 16 ? " · ACT 4" : " · ACT 5"}</div>
                    <div className="font-display text-lg leading-tight drop-shadow">{isl.name}</div>
                    <div className="mt-2 flex items-center justify-between font-display text-sm">
                      <span>{open ? `${done}/20` : <Lock className="size-4" />}</span>
                      <span>{rung ? "🔔" : "🔕"}</span>
                    </div>
                  </button>
                );
              })}
              <button disabled={save.unlocked <= DESIGNED} onClick={() => { ui(); setIslandView(20); setScreen("island"); }}
                className={`col-span-2 rounded-2xl p-4 text-left ring-2 sm:col-span-4 ${save.unlocked > DESIGNED ? "ring-[#FFD23F]" : "opacity-55 ring-white/10"}`}
                style={{ background: "linear-gradient(120deg,#3A4A6A,#3DA8FF,#9F7BFF)" }}>
                <div className="font-display text-xl">Endless Storm ∞</div>
                <div className="text-sm font-semibold text-white/90">{save.unlocked > DESIGNED ? `Zones, armies and concepts mix forever · next: ${save.remix - DESIGNED}` : "Ring all 20 Rain Bells to open the never-ending storm"}</div>
              </button>
            </div>
          </motion.div>
        )}

        {screen === "island" && (
          <motion.div key="island" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex flex-col bg-[#14304F]/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-4 pb-2 pt-[max(70px,env(safe-area-inset-top))] [@media(max-height:520px)]:pt-[60px]">
              <button aria-label="Back" onClick={() => { ui(); setScreen("map"); }} className="grid size-11 place-items-center rounded-full bg-white/15"><ArrowLeft className="size-6" /></button>
              <div className="min-w-0">
                <div className="font-display text-xs text-white/75">{islandView < 20 ? `ZONE ${islandView + 1}` : "NEVER-ENDING"}</div>
                <div className="truncate font-display text-2xl">{islandView < 20 ? ISLANDS[islandView].name : "Endless Storm"}</div>
              </div>
            </div>
            {islandView < 20 ? (
              <div className="flex-1 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
                {(() => {
                  const first = islandView * STAGES_PER_ISLAND + 1, ms = Array.from({ length: STAGES_PER_ISLAND }, (_, k) => save.medals[first + k]);
                  const drops = ms.reduce((a, m) => a + (m?.d ?? 0), 0), nh = ms.filter((m) => m?.nh).length, done = ms.filter((m) => m?.c).length;
                  return <div className="mb-2 flex flex-wrap gap-2 font-display text-sm"><span className="rounded-full bg-white/15 px-3 py-1">✔ {done}/20</span><span className="rounded-full bg-white/15 px-3 py-1">💧 {drops}/60</span><span className="rounded-full bg-white/15 px-3 py-1">⭐ {nh}/20</span></div>;
                })()}
                <div className="mb-3 rounded-2xl bg-white/10 p-3 text-sm font-semibold">{ISLANDS[islandView].story} <span className="text-white/70">· ⚙️ {ISLANDS[islandView].machine.name} · 👑 {ISLANDS[islandView].boss.name}</span></div>
                {ISLANDS[islandView].districts.map((dname, di) => (
                  <div key={dname} className="mb-3">
                    <div className="mb-1.5 font-display text-sm tracking-wide text-white/80">{dname.toUpperCase()}</div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {Array.from({ length: 5 }, (_, j) => {
                        const k = di * 5 + j, n = islandView * STAGES_PER_ISLAND + k + 1, open = save.unlocked >= n, m = save.medals[n];
                        const c = zoneSchedule(ISLANDS[islandView])[k], fight = c === "boss" || c === "machine";
                        const st = open ? buildStage(n) : null;
                        return (
                          <button key={n} disabled={!open} onClick={() => play(n)} className={`flex min-h-24 flex-col justify-between rounded-2xl p-2.5 text-left transition active:scale-95 ${open ? (fight ? "bg-[#FF5F7E]" : "bg-white/90 text-[#2B2140]") : "bg-white/15 text-white/50"}`}>
                            <div className="flex items-center justify-between font-display text-sm"><span>{islandView + 1}-{k + 1}</span>{!open ? <Lock className="size-4" /> : <span title={CONCEPT_NAME[c]}>{CONCEPT_ICON[c]}</span>}</div>
                            <div className="line-clamp-2 text-xs font-bold leading-tight">{st?.name ?? CONCEPT_NAME[c]}</div>
                            {m && (
                              <div className="flex items-center gap-1 text-xs">
                                {m.c && <span>✔</span>}
                                {Array.from({ length: 3 }, (_, i) => <Droplet key={i} className={`size-3 ${i < m.d ? "fill-[#3DB8FF] text-[#3DB8FF]" : "opacity-30"}`} />)}
                                {m.nh && <Star className="size-3.5 fill-[#FFC21A] text-[#FFC21A]" />}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="text-lg font-semibold">The Dust Engine&apos;s last sparks keep baking Dusties. Every Endless stage blends one zone&apos;s look, another&apos;s army and a new concept — and it keeps getting tougher.</div>
                <ClayBtn big onClick={() => play(save.remix)}><Play className="size-6 fill-current" /> ENDLESS {save.remix - DESIGNED}</ClayBtn>
              </div>
            )}
          </motion.div>
        )}

        {screen === "story" && run && (
          <motion.div key="story" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/60 px-4 py-4 backdrop-blur-sm" onClick={() => { useClay.getState().seeStory(storyIsland); ui(); begin(run.n); }}>
            {storyIsland === 1 || ACT_COMIC[storyIsland] ? (
              <div className="flex flex-col items-center gap-3">
                {storyIsland === 1 ? <Comic panels={PROLOGUE} sub="ACT 1 · THE DRY COAST" title="Rain Raid" /> : <Comic panels={ACT_COMIC[storyIsland].panels} sub={ACT_COMIC[storyIsland].sub} title={ACT_COMIC[storyIsland].title} />}
                <div className="flex items-center gap-2 font-display text-white">Tap to start <ChevronRight className="size-5" /></div>
              </div>
            ) : (
              <motion.div initial={{ scale: 0.85, rotate: -2 }} animate={{ scale: 1, rotate: 0 }} className="w-[min(92vw,520px)] rounded-3xl bg-[#FFF6E8] p-6 text-[#2B2140] shadow-2xl [@media(max-height:520px)]:p-4">
                <div className="font-display text-sm tracking-widest text-[#FF8A3D]">ZONE {storyIsland} OF 20</div>
                <div className="font-display text-3xl leading-tight">{ISLANDS[storyIsland - 1].name}</div>
                <div className="my-3 flex items-center justify-center gap-3 text-4xl"><span>💦</span><span>🔔</span><span>🦀</span></div>
                <p className="text-lg font-semibold leading-snug [@media(max-height:520px)]:text-base">{ISLANDS[storyIsland - 1].story}</p>
                <div className="mt-4 flex items-center justify-center gap-2 font-display text-[#5A4F78]">Tap to start <ChevronRight className="size-5" /></div>
              </motion.div>
            )}
          </motion.div>
        )}

        {screen === "clear" && clear && (
          <motion.div key="clear" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/45 px-5 pt-12 backdrop-blur-sm [@media(max-height:520px)]:pt-11">
            <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 18 }} className="max-h-[86dvh] w-[min(92vw,480px)] overflow-y-auto rounded-3xl bg-[#FFF6E8] p-5 text-center text-[#2B2140] shadow-2xl [@media(max-height:520px)]:grid [@media(max-height:520px)]:w-[min(94vw,800px)] [@media(max-height:520px)]:grid-cols-2 [@media(max-height:520px)]:items-center [@media(max-height:520px)]:gap-x-5 [@media(max-height:520px)]:p-4">
              <div>
                <div className="font-display text-sm tracking-widest text-[#FF8A3D]">{isDaily(clear.r.n) ? "DAILY STORM" : clear.r.n > DESIGNED ? `ENDLESS ${clear.r.n - DESIGNED}` : `${islandOf(clear.r.n).name.toUpperCase()} · ${stageLabel(clear.r.n)}`}</div>
                <div className="font-display text-3xl leading-tight">{clear.r.cleared ? (clear.boss ? "The Rain Bell rings!" : clear.machine ? "Machine wrecked!" : "Stage clear!") : clear.r.livesLeft <= 0 ? "Out of lives!" : "So close!"}</div>
                {clear.boss && clear.r.cleared && <div className="mt-2 text-base font-semibold text-[#3A6A8A]">🌧️ Rain is back on {islandOf(clear.r.n).name}!</div>}
                {!clear.r.cleared && clear.r.concept === "holdwell" && clear.r.livesLeft > 0 && <div className="mt-2 text-base font-semibold text-[#C83A55]">The Rain Well fell — try again!</div>}
                <div className="my-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-white p-2 shadow"><div className="text-2xl">{clear.r.cleared ? "✔" : "✖"}</div><div className="text-xs font-bold">Cleared</div></div>
                  <div className="rounded-2xl bg-white p-2 shadow"><div className="flex justify-center gap-0.5">{Array.from({ length: 3 }, (_, i) => <Droplet key={i} className={`size-5 ${i < clear.r.drops ? "fill-[#3DB8FF] text-[#3DB8FF]" : "text-[#CFC6E0]"}`} />)}</div><div className="mt-1 text-xs font-bold">Rain Drops</div></div>
                  <div className="rounded-2xl bg-white p-2 shadow"><Star className={`mx-auto size-7 ${clear.r.noHit && clear.r.cleared ? "fill-[#FFC21A] text-[#FFC21A]" : "text-[#CFC6E0]"}`} /><div className="text-xs font-bold">No-hit</div></div>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2 font-display text-sm [@media(max-height:520px)]:mb-0">
                  <div className="rounded-xl bg-[#2B2140]/5 py-1.5">💦 {clear.r.melted}<div className="text-[10px] font-bold opacity-70">MELTED</div></div>
                  <div className="rounded-xl bg-[#2B2140]/5 py-1.5">🔥 {clear.r.bestCombo}<div className="text-[10px] font-bold opacity-70">BEST COMBO</div></div>
                  <div className="rounded-xl bg-[#2B2140]/5 py-1.5"><span className="inline-flex items-center gap-1"><CoinIcon className="size-4" />{clear.r.cleared ? clear.r.coins : 0}</span><div className="text-[10px] font-bold opacity-70">COINS</div></div>
                </div>
              </div>
              <div>
                {clear.machine && clear.r.cleared && GRIT_ESCAPES[islandOf(clear.r.n).n] && (
                  <div className="mb-3 grid grid-cols-2 gap-2 text-left">
                    {GRIT_ESCAPES[islandOf(clear.r.n).n].map(([art, text], i) => (
                      <div key={i} className="overflow-hidden rounded-xl border-2 border-[#2B2140] bg-white"><div className="grid h-12 place-items-center bg-gradient-to-b from-[#BFE3FF] to-[#FFE9C8] text-3xl">{art}</div><div className="p-1.5 text-xs font-semibold leading-snug">{text}</div></div>
                    ))}
                  </div>
                )}
                {clear.newNoHit && <div className="mb-3 rounded-full bg-[#FFC21A] px-3 py-1 font-display text-sm text-[#3A2600]">⭐ Perfect Clay — not one hit, start to goal!</div>}
                {clear.daily && clear.r.cleared && (
                  <div className="mb-3 rounded-2xl bg-[#5FB8FF]/20 p-3 font-display text-sm text-[#0B2A4A]">
                    {clear.daily.reward > 0 ? <>Daily reward <CoinIcon className="inline size-4" /> +{clear.daily.reward}</> : "Today's reward is already yours — come back tomorrow!"}
                    <div className="mt-1">🔥 Streak {clear.daily.streak}{clear.r.noHit ? " · ⭐ no-hit bonus!" : " · finish with no hits for +100"}</div>
                  </div>
                )}
                {(clear.boss || clear.machine) && clear.r.cleared && clear.r.n < DESIGNED && <SnackStop next={clear.r.n + 1} />}
                <div className="flex flex-col gap-2.5">
                  {clear.r.cleared ? <ClayBtn big onClick={next}>{isDaily(clear.r.n) ? "DONE" : "NEXT"} <ChevronRight className="size-6" /></ClayBtn> : <ClayBtn big tone="mint" onClick={() => (isDaily(clear.r.n) ? begin(clear.r.n) : play(clear.r.n))}><RotateCcw className="size-6" /> TRY AGAIN</ClayBtn>}
                  <div className="flex gap-2.5">
                    {clear.r.cleared && <ClayBtn tone="plain" className="flex-1" onClick={() => play(clear.r.n)}><RotateCcw className="size-5" /> Replay</ClayBtn>}
                    <ClayBtn tone="plain" className="flex-1" onClick={() => setScreen("shop")}><ShoppingBag className="size-5" /> Shop</ClayBtn>
                    <ClayBtn tone="plain" className="flex-1" onClick={() => { setIslandView(clear.r.n <= DESIGNED ? islandOf(clear.r.n).n - 1 : 20); setScreen("island"); }}><MapIcon className="size-5" /> Map</ClayBtn>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {screen === "ending" && (
          <motion.div key="ending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center bg-gradient-to-b from-[#3D8BFF]/80 to-[#FF5FA2]/80 px-5 backdrop-blur-sm">
            <div className="w-[min(92vw,520px)] rounded-3xl bg-[#FFF6E8] p-6 text-center text-[#2B2140] shadow-2xl">
              <div className="text-5xl">🌈🔔🌧️</div>
              <div className="mt-2 font-display text-3xl">All 20 Rain Bells!</div>
              <p className="mt-3 text-lg font-semibold">The Dust Engine bursts and every stolen raindrop falls at once — a rainbow storm over Clayland. Kranky, soaked, finally laughs. But the Engine&apos;s last sparks blew far away… the Endless Storm is open.</p>
              <ClayBtn big className="mt-5 w-full" onClick={() => { useClay.getState().seeEnding(); play(useClay.getState().remix); }}><Play className="size-6 fill-current" /> ENDLESS STORM</ClayBtn>
            </div>
          </motion.div>
        )}

        {screen === "wardrobe" && <Wardrobe onBack={() => setScreen("title")} />}
        {screen === "tutorial" && (
          <Tutorial coarse={coarse} first={tutorialFrom === "play"} onDone={() => {
            ui(); useClay.getState().seeTutorial();
            if (tutorialFrom === "play" && run) play(run.n, true); else setScreen(tutorialFrom === "settings" ? "settings" : "title");
          }} />
        )}
        {screen === "shop" && <Shop onBack={() => setScreen(clear ? "clear" : "title")} />}

        {screen === "settings" && (
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center bg-black/55 px-5 backdrop-blur-sm">
            <div className="w-[min(92vw,440px)] rounded-3xl bg-[#FFF6E8] p-5 text-[#2B2140] shadow-2xl">
              <div className="mb-3 flex items-center gap-3"><button aria-label="Back" onClick={() => { ui(); setScreen("title"); }} className="grid size-10 place-items-center rounded-full bg-[#2B2140]/10"><ArrowLeft className="size-5" /></button><div className="font-display text-2xl">Settings</div></div>
              <div className="flex flex-col gap-3 text-sm font-bold">
                <div>
                  <div className="mb-1.5">Graphics</div>
                  <div className="grid grid-cols-4 gap-1.5">{(["auto", "low", "medium", "high"] as const).map((q) => <button key={q} onClick={() => { ui(); save.setSettings({ quality: q }); }} className={`rounded-xl py-2 capitalize ${save.settings.quality === q ? "bg-[#FFC21A]" : "bg-[#2B2140]/10"}`}>{q}</button>)}</div>
                </div>
                {([["easyRun", "Easy Run — Puddo runs and fires by himself"], ["bigButtons", "Bigger buttons"], ["vibrate", "Vibration"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => { ui(); save.setSettings({ [k]: !save.settings[k] }); }} className="flex items-center justify-between rounded-xl bg-[#2B2140]/10 px-3 py-3 text-left">
                    <span>{label}</span><span className={`grid h-7 w-12 items-center rounded-full px-1 ${save.settings[k] ? "justify-items-end bg-[#4FD18B]" : "justify-items-start bg-[#CFC6E0]"}`}><span className="size-5 rounded-full bg-white" /></span>
                  </button>
                ))}
                <button onClick={() => { ui(); setTutorialFrom("settings"); setScreen("tutorial"); }} className="flex items-center justify-between rounded-xl bg-[#FFC21A] px-3 py-3 text-left font-display text-[#3A2600]"><span>📖 How to play</span><ChevronRight className="size-5" /></button>
                <div className="rounded-xl bg-[#2B2140]/5 px-3 py-2 text-xs font-semibold text-[#5A4F78]">Keys: ← → move · ↑ / Space / Z jump · X / J fire (hold) · C / K Storm Bomb · V / L Super Rain · ↓ duck, and in the air stomp (↓ + X shoots down). Gamepads work too.</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <h1 className="sr-only">{title}</h1>
    </div>
  );
}
