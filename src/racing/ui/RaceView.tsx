"use client";
// One race on screen: the 3D session, loading card, HUD and touch controls.
// Layout: the site chrome is hidden (immersive) — only the player's pause button sits top-right, so the race
// cluster lives top-left, minimap + camera under the pause button, controls in the thumb zones and the
// speedometer bottom-centre (landscape) / above the pedals (portrait) / bottom-right (desktop).
// Cheap by design: speed, RPM, nitro and the minimap are written straight to the DOM from one rAF loop;
// React only re-renders the light 12 Hz parts (position, laps, standings, toasts).
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ChevronLeft, ChevronRight, Flame, Heart, Smartphone, Zap, Shield, Magnet, Wind } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { RaceSession } from "../race";
import type { CameraView, HudFrame, RaceConfig, RaceEvent, RaceResult, RacerView } from "../types";
import type { RacingSettings } from "../save";
import { MODE_INFO } from "../levels";
import { activeGame, getCar, getTheme } from "../games";
import { AI_LABEL, MODE_SHORT, fmt, isHighway, isMoto, isStreet, ord, pts, useIsTouch, useViewport, vibrate } from "./kit";
import { askMotionPermission } from "./SettingsScreen";
import { CoinIcon } from "@/components/brand/CoinPill";

type TouchKey = "left" | "right" | "brake" | "nitro" | "drift" | "gas";
interface Toast { id: number; text: string; tone: string; big?: boolean }
interface Fast {
  speed: HTMLElement | null; gear: HTMLElement | null; rpm: SVGPathElement | null; segs: (SVGPathElement | null)[];
  speedo: HTMLElement | null; ready: HTMLElement | null; nitroBtn: HTMLElement | null; map: HTMLCanvasElement | null; wheel: HTMLElement | null; tilt: HTMLElement | null;
}
const TONE: Record<string, [string, string]> = { gold: ["#FFD25A", "#FF9F1C"], blue: ["#7CF2FF", "#2E6BFF"], red: ["#FF6B7E", "#D61F3A"], green: ["#7CF2C9", "#16A35A"], pink: ["#FF9BE6", "#D21FB0"] };
/** street skin (Drift Kings): neon text on black glass instead of candy plates */
const STREET_TONE: Record<string, string> = { gold: "#FFE14D", blue: "#2EF2FF", red: "#FF4D5E", green: "#7CFF6B", pink: "#FF1F7A" };
/** highway skin: toasts are road signs — [face, text] */
const SIGN_TONE: Record<string, [string, string]> = { gold: ["#FFC600", "#111"], blue: ["#0B6E4F", "#fff"], red: ["#C8102E", "#fff"], green: ["#0B6E4F", "#fff"], pink: ["#1E4FD8", "#fff"] };
const TIPS = [
  "Hold NITRO as the lights hit GO for a perfect start!", "Drift round corners to fill your nitro bar.", "Tuck in behind a rival to slipstream — free speed!",
  "Boost into rivals for a TAKEDOWN!", "Brake a little before tight corners, then boost out.", "Grab 🛡️ shields to survive fire and spikes.",
];
const MS = (t: number) => (t > 0 && t < 10000 ? t * 1000 : t);

// ------------------------------------------------------------------ speedometer geometry (viewBox 200×126)
const GX = 100, GY = 98, GR = 80;
const gpt = (t: number, r: number) => { const a = ((195 - t * 210) * Math.PI) / 180; return [GX + r * Math.cos(a), GY - r * Math.sin(a)] as const; };
const garc = (t0: number, t1: number, r: number) => {
  const [x0, y0] = gpt(t0, r), [x1, y1] = gpt(t1, r);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${(t1 - t0) * 210 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
const ARC = garc(0, 1, GR), RED = garc(0.84, 1, GR);
const SEGS = Array.from({ length: 10 }, (_, i) => garc(i / 10 + 0.01, (i + 1) / 10 - 0.01, GR - 16));
const TICKS = Array.from({ length: 21 }, (_, i) => { const t = i / 20, big = i % 4 === 0; const [x0, y0] = gpt(t, GR + 8), [x1, y1] = gpt(t, GR + (big ? 15 : 11)); return { x0, y0, x1, y1, big, red: t >= 0.84 }; });

type Reg = (k: Exclude<keyof Fast, "segs">, el: HTMLElement | SVGElement | null) => void;
type RegSeg = (i: number, el: SVGPathElement | null) => void;

const Speedo = memo(function Speedo({ reg, regSeg, units, width }: { reg: Reg; regSeg: RegSeg; units: string; width: number }) {
  return (
    <div ref={(el) => reg("speedo", el)} className="relative" style={{ width }}>
      <svg viewBox="0 0 200 126" className="w-full overflow-visible drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]">
        <defs>
          {isMoto()
            ? <linearGradient id="nr-rpm" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#F5F5F7" /><stop offset="0.6" stopColor="#FFD400" /><stop offset="0.85" stopColor="#FF7A1A" /><stop offset="1" stopColor="#E10600" /></linearGradient>
            : isHighway()
            ? <linearGradient id="nr-rpm" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#2FD47A" /><stop offset="0.5" stopColor="#FFC600" /><stop offset="0.8" stopColor="#FF7A1A" /><stop offset="1" stopColor="#E3262F" /></linearGradient>
            : isStreet()
            ? <linearGradient id="nr-rpm" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#2EF2FF" /><stop offset="0.6" stopColor="#B06BFF" /><stop offset="0.85" stopColor="#FF1F7A" /><stop offset="1" stopColor="#FFE14D" /></linearGradient>
            : <linearGradient id="nr-rpm" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#2E86FF" /><stop offset="0.55" stopColor="#7CF2FF" /><stop offset="0.82" stopColor="#FFE066" /><stop offset="1" stopColor="#FF5A6E" /></linearGradient>}
          <radialGradient id="nr-dial" cx="0.5" cy="0.62" r="0.62"><stop offset="0.55" stopColor="rgba(11,7,24,0.82)" /><stop offset="1" stopColor="rgba(11,7,24,0)" /></radialGradient>
        </defs>
        <ellipse cx={GX} cy={GY - 8} rx={GR + 18} ry={GR + 4} fill="url(#nr-dial)" />
        {TICKS.map((k, i) => <line key={i} x1={k.x0} y1={k.y0} x2={k.x1} y2={k.y1} stroke={k.red ? "#FF5A6E" : "white"} strokeOpacity={k.big ? 0.9 : 0.45} strokeWidth={k.big ? 2.6 : 1.4} strokeLinecap="round" />)}
        <path d={ARC} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={10} strokeLinecap="round" />
        <path d={RED} fill="none" stroke="#FF5A6E" strokeOpacity={0.35} strokeWidth={10} />
        <path ref={(el) => reg("rpm", el)} d={ARC} pathLength={100} fill="none" stroke="url(#nr-rpm)" strokeWidth={10} strokeLinecap="round" strokeDasharray="0 200" />
        {SEGS.map((d, i) => <path key={i} ref={(el) => regSeg(i, el)} d={d} fill="none" stroke={isStreet() ? "#FF1F7A" : isHighway() ? "#FFC600" : "#7CF2FF"} strokeWidth={7} opacity={0.16} />)}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center leading-none" style={{ top: "31%" }}>
        <span ref={(el) => reg("speed", el)} className="font-display tabular-nums text-white drop-shadow-[0_3px_0_rgba(10,6,30,0.9)]" style={{ fontSize: width * 0.25 }}>0</span>
        <span className="font-bold tracking-[0.22em] text-white/65" style={{ fontSize: Math.max(8, width * 0.055) }}>{units === "mph" ? "MPH" : "KM/H"}</span>
      </div>
      <div className={`absolute left-1/2 grid -translate-x-1/2 place-items-center font-display ${isStreet() ? "rounded-sm bg-[#FF1F7A] text-white shadow-[0_0_12px_#FF1F7A]" : isHighway() ? "rounded-md bg-[#FFC600] text-[#111] shadow-[inset_0_0_0_1.5px_#111]" : isMoto() ? "-skew-x-[10deg] rounded-[3px] bg-[#E10600] text-white" : "rounded-lg bg-white text-[#14102a] shadow-[0_2px_0_rgba(0,0,0,0.4)]"}`} style={{ bottom: "2%", width: width * 0.16, height: width * 0.15, fontSize: width * 0.1 }}>
        <span ref={(el) => reg("gear", el)}>1</span>
      </div>
    </div>
  );
});

/** radial streaks — one static SVG layer, animated with transform/opacity only (compositor-cheap) */
const STREAKS = Array.from({ length: 30 }, (_, i) => {
  const a = (i / 30) * Math.PI * 2 + ((i * 7919) % 13) * 0.012, r0 = 34 + ((i * 31) % 9) * 2.2, r1 = 78;
  return { x0: 50 + Math.cos(a) * r0, y0: 56 + Math.sin(a) * r0 * 0.9, x1: 50 + Math.cos(a) * r1, y1: 56 + Math.sin(a) * r1 * 0.9, w: 1.2 + ((i * 17) % 5) * 0.55 };
});
const SpeedLines = memo(function SpeedLines() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" style={{ animation: "nr-zoom 0.32s linear infinite", willChange: "transform, opacity", transformOrigin: "50% 56%" }} aria-hidden>
      {STREAKS.map((s, i) => <line key={i} x1={s.x0} y1={s.y0} x2={s.x1} y2={s.y1} stroke="rgba(210,245,255,0.55)" strokeWidth={s.w} vectorEffect="non-scaling-stroke" strokeLinecap="round" />)}
    </svg>
  );
});

// ------------------------------------------------------------------ touch controls
function useHold(k: TouchKey, press: (k: TouchKey, v: boolean) => void, onDown?: () => void) {
  return useMemo(() => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); e.currentTarget.dataset.on = "1"; press(k, true); onDown?.(); },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => { e.currentTarget.dataset.on = "0"; press(k, false); },
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => { e.currentTarget.dataset.on = "0"; press(k, false); },
    onLostPointerCapture: (e: React.PointerEvent<HTMLElement>) => { e.currentTarget.dataset.on = "0"; press(k, false); },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }), [k, press, onDown]);
}
const PRESS = "data-[on=1]:scale-[0.93] data-[on=1]:brightness-125 transition-transform duration-75 touch-none select-none";

interface Sizes { steer: number; small: number; nitro: number; gap: number; pedalW: number; pedalH: number }

const SteerPad = memo(function SteerPad({ S, press }: { S: Sizes; press: (k: TouchKey, v: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const L = useRef<HTMLDivElement>(null), R = useRef<HTMLDivElement>(null);
  const ptr = useRef(new Map<number, -1 | 1>());
  const sync = useCallback(() => {
    const v = [...ptr.current.values()];
    const l = v.includes(-1), r = v.includes(1);
    press("left", l); press("right", r);
    if (L.current) L.current.dataset.on = l ? "1" : "0";
    if (R.current) R.current.dataset.on = r ? "1" : "0";
  }, [press]);
  const side = (x: number) => { const b = box.current!.getBoundingClientRect(); return x < b.left + b.width / 2 ? -1 : 1; };
  const btn = isHighway()
    ? `grid place-items-center rounded-xl bg-[#1b1e23]/75 text-white shadow-[inset_0_0_0_2px_rgba(27,30,35,0.75),inset_0_0_0_4px_rgba(255,255,255,0.75)] backdrop-blur-md data-[on=1]:bg-[#0B6E4F] data-[on=1]:scale-95 ${PRESS}`
    : isStreet()
    ? `grid place-items-center rounded-lg bg-[#0b0b10]/70 text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.28)] backdrop-blur-md data-[on=1]:bg-[#FF1F7A]/30 data-[on=1]:shadow-[inset_0_0_0_2px_#FF1F7A,0_0_20px_rgba(255,31,122,0.7)] ${PRESS}`
    : `grid place-items-center rounded-[28%] bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0.08))] text-white ring-2 ring-white/30 shadow-[0_6px_0_rgba(0,0,0,0.35)] backdrop-blur-md data-[on=1]:translate-y-[3px] data-[on=1]:bg-white/40 data-[on=1]:shadow-none ${PRESS}`;
  return (
    <div ref={box} data-hud="steer" className="flex touch-none" style={{ gap: S.gap }} role="group" aria-label="Steering"
      onPointerDown={(e) => { e.preventDefault(); box.current?.setPointerCapture?.(e.pointerId); ptr.current.set(e.pointerId, side(e.clientX)); sync(); }}
      onPointerMove={(e) => { if (!ptr.current.has(e.pointerId)) return; const s = side(e.clientX); if (ptr.current.get(e.pointerId) !== s) { ptr.current.set(e.pointerId, s); sync(); } }}
      onPointerUp={(e) => { ptr.current.delete(e.pointerId); sync(); }} onPointerCancel={(e) => { ptr.current.delete(e.pointerId); sync(); }}
      onLostPointerCapture={(e) => { ptr.current.delete(e.pointerId); sync(); }} onContextMenu={(e) => e.preventDefault()}>
      <div ref={L} aria-label="Steer left" role="button" className={btn} style={{ width: S.steer, height: S.steer * 1.05 }}><ChevronLeft style={{ width: S.steer * 0.55, height: S.steer * 0.55 }} strokeWidth={3} /></div>
      <div ref={R} aria-label="Steer right" role="button" className={btn} style={{ width: S.steer, height: S.steer * 1.05 }}><ChevronRight style={{ width: S.steer * 0.55, height: S.steer * 0.55 }} strokeWidth={3} /></div>
    </div>
  );
});

/** drag-to-turn steering wheel (analog, writes touch.tilt) */
const Wheel = memo(function Wheel({ size, onSteer }: { size: number; onSteer: (rot: number) => void }) {
  const st = useRef<{ id: number; a0: number; rot: number } | null>(null);
  const face = useRef<HTMLDivElement>(null);
  const ang = (e: React.PointerEvent, el: HTMLElement) => { const b = el.getBoundingClientRect(); return (Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180) / Math.PI; };
  const apply = (rot: number, spring: boolean) => {
    const w = face.current; if (w) { w.style.transition = spring ? "transform 180ms ease-out" : "none"; w.style.transform = `rotate(${rot}deg)`; }
    onSteer(rot);
  };
  return (
    <div role="slider" aria-label="Steering wheel" aria-valuemin={-1} aria-valuemax={1} aria-valuenow={0} className="relative touch-none select-none" style={{ width: size, height: size }}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); st.current = { id: e.pointerId, a0: ang(e, e.currentTarget) - (st.current?.rot ?? 0), rot: 0 }; }}
      onPointerMove={(e) => { const s = st.current; if (!s || s.id !== e.pointerId) return; let d = ang(e, e.currentTarget) - s.a0; while (d > 180) d -= 360; while (d < -180) d += 360; s.rot = Math.max(-120, Math.min(120, d)); apply(s.rot, false); }}
      onPointerUp={() => { st.current = null; apply(0, true); }} onPointerCancel={() => { st.current = null; apply(0, true); }} onContextMenu={(e) => e.preventDefault()}>
      <div ref={face} className="absolute inset-0">
        <svg viewBox="0 0 100 100" className="size-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]">
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(20,16,42,0.85)" strokeWidth="12" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="7" />
          <path d="M50 6 A44 44 0 0 1 58 6.8" stroke="#FF5A6E" strokeWidth="8" fill="none" />
          <path d="M8 52 Q50 40 92 52 M50 50 L50 92" stroke="rgba(255,255,255,0.8)" strokeWidth="8" strokeLinecap="round" fill="none" />
          <circle cx="50" cy="52" r="11" fill="#14102a" stroke="#FFD25A" strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
});

const Pedals = memo(function Pedals({ S, press, autoGas, onNitroDown }: { S: Sizes; press: (k: TouchKey, v: boolean) => void; autoGas: boolean; onNitroDown: () => void }) {
  const drift = useHold("drift", press), brake = useHold("brake", press), gas = useHold("gas", press), nitro = useHold("nitro", press, onNitroDown);
  // bikes: the drift button pops a wheelie
  const bikeGame = activeGame().style === "bike";
  const street = isStreet(), hwy = isHighway();
  const sm = hwy
    ? `grid place-items-center rounded-xl font-display text-white data-[on=1]:scale-95 data-[on=1]:brightness-125 ${PRESS}`
    : street
    ? `grid place-items-center rounded-lg font-display text-white backdrop-blur-md data-[on=1]:scale-95 data-[on=1]:brightness-150 ${PRESS}`
    : `grid place-items-center rounded-2xl font-display text-white ring-2 ring-white/35 shadow-[0_5px_0_rgba(0,0,0,0.35)] data-[on=1]:translate-y-[3px] data-[on=1]:shadow-none ${PRESS}`;
  const nitroBtn = (d: number) => (
    <div {...nitro} role="button" aria-label="Nitro" className={`relative grid shrink-0 place-items-center rounded-full ${PRESS} data-[on=1]:scale-[0.92]`} style={{ width: d, height: d }}>
      <NitroRing d={d} />
    </div>
  );
  return (
    <div data-hud="pedals" className="flex items-end" style={{ gap: S.gap }}>
      <div className="flex flex-col" style={{ gap: S.gap }}>
        <div {...drift} role="button" aria-label="Drift" className={`${sm} ${isMoto() ? "rounded-[6px] bg-[#FFD400] text-[#121316] shadow-[inset_0_0_0_2px_#121316,0_4px_0_#8a7200]" : hwy ? "bg-[#1E4FD8] shadow-[inset_0_0_0_2px_#1E4FD8,inset_0_0_0_4px_#fff,0_4px_0_#0b2470]" : street ? "bg-[linear-gradient(160deg,#FF1F7A,#9C0048)] shadow-[inset_0_0_0_2px_#FF8CC0,0_0_22px_rgba(255,31,122,0.6)]" : "bg-[linear-gradient(180deg,#FFB3EC,#E04FC0)]"}`} style={{ width: S.small, height: S.small, fontSize: S.small * 0.2 }}>
          <span className="flex flex-col items-center leading-none"><span style={{ fontSize: S.small * 0.36 }}>{bikeGame ? "🏍️" : "〰"}</span>{bikeGame ? "WHEELIE" : "DRIFT"}</span>
        </div>
        <div {...brake} role="button" aria-label="Brake" className={`${sm} ${hwy ? "bg-[#C8102E] shadow-[inset_0_0_0_2px_#C8102E,inset_0_0_0_4px_#fff,0_4px_0_#5e0614]" : street ? "bg-[#19070b]/80 text-[#FF4D5E] shadow-[inset_0_0_0_2px_#FF4D5E]" : "bg-[linear-gradient(180deg,#FF8A9A,#D61F3A)]"}`} style={{ width: S.small, height: S.small, fontSize: S.small * 0.2 }}>BRAKE</div>
      </div>
      {autoGas ? nitroBtn(S.nitro) : (
        <div className="flex flex-col items-center" style={{ gap: S.gap }}>
          {nitroBtn(Math.round(S.small * 1.12))}
          <div {...gas} role="button" aria-label="Gas" className={`${sm} rounded-[1.1rem] bg-[linear-gradient(180deg,#A8FFCB,#16A35A)] text-[#03230f]`} style={{ width: S.pedalW, height: S.pedalH, fontSize: S.small * 0.22 }}>GAS</div>
        </div>
      )}
    </div>
  );
});

/** the nitro button face — its fill ring is driven by the fast loop through the --n custom property */
function NitroRing({ d }: { d: number }) {
  return (
    <span id="nr-nitro-face" className={`pointer-events-none absolute inset-0 grid place-items-center rounded-full ${isStreet() ? "ring-2 ring-[#2EF2FF]/70" : "ring-4 ring-white/40"}`}
      style={{ background: `conic-gradient(from -90deg, ${isStreet() ? "#2EF2FF" : isHighway() ? "#FF7A1A" : isMoto() ? "#FFD400" : "#7CF2FF"} calc(var(--n,0) * 360deg), rgba(255,255,255,0.14) 0)`, boxShadow: isStreet() ? "0 0 22px rgba(46,242,255,0.45)" : "0 6px 0 rgba(0,0,0,0.35)" }}>
      <span className={`grid place-items-center rounded-full text-white ${isStreet() ? "bg-[radial-gradient(circle_at_40%_30%,#1b2a33,#06090c)] text-[#2EF2FF]" : isHighway() ? "bg-[radial-gradient(circle_at_40%_30%,#FF9A3D,#C2152B)]" : isMoto() ? "bg-[radial-gradient(circle_at_40%_30%,#FF4A3D,#A10400)]" : "bg-[radial-gradient(circle_at_40%_30%,#4FB8FF,#1E3FB0)]"}`} style={{ width: d * 0.8, height: d * 0.8 }}>
        <span className="flex flex-col items-center leading-none"><Zap style={{ width: d * 0.32, height: d * 0.32 }} className={isStreet() ? "fill-[#2EF2FF]" : "fill-white"} /><span className="font-display" style={{ fontSize: Math.max(10, d * 0.14) }}>NITRO</span></span>
      </span>
    </span>
  );
}

// ------------------------------------------------------------------ HUD pieces
const Standings = memo(function Standings({ list, max, mode, danger }: { list: RacerView[]; max: number; mode: string; danger: boolean }) {
  const alive = list.filter((r) => !r.out);
  const lastAlive = alive[alive.length - 1]?.id;
  let rows = list.slice(0, max);
  const me = list.find((r) => r.isPlayer);
  if (me && !rows.includes(me)) rows = [...list.slice(0, max - 1), me];
  return (
    <div className="flex w-[clamp(118px,30vw,168px)] flex-col gap-[3px]">
      {rows.map((r) => {
        const knock = mode === "elimination" && r.id === lastAlive && !r.out;
        return (
          <motion.div layout key={r.id} transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className={`flex h-[24px] items-center gap-1 rounded-lg pr-1.5 text-[11.5px] leading-none ring-1 ${r.isPlayer ? (isMoto() ? "bg-[#E10600] text-white ring-white/60" : isHighway() ? "bg-[#FFC600] text-[#111] ring-[#111]/60" : isStreet() ? "bg-[linear-gradient(90deg,#FF1F7A,#C2005C)] text-white ring-[#FF8CC0]/60" : "bg-[linear-gradient(90deg,#FFD25A,#FFAA1C)] text-[#2a1600] ring-white/50") : "bg-[#0b0718]/70 text-white ring-white/10"} ${r.out ? "opacity-40" : ""} ${knock ? "!ring-2 !ring-[#FF5A6E]" : ""}`}>
            <span className={`grid h-full w-5 shrink-0 place-items-center rounded-l-lg font-display ${r.isPlayer ? (isStreet() ? "bg-black/40 text-white" : "bg-[#2a1600] text-[#FFD25A]") : "bg-white/10"}`}>{r.pos}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.avatar} alt="" draggable={false} className="size-[19px] shrink-0 object-contain" />
            <span className={`min-w-0 flex-1 truncate font-semibold ${r.out ? "line-through" : ""}`}>{r.isPlayer ? "YOU" : r.name}</span>
            <span className="shrink-0 font-display text-[10px] tabular-nums opacity-80">{knock ? (danger && r.isPlayer ? "OUT?" : "💥") : r.out ? "OUT" : r.pos === 1 ? "LEAD" : `+${Math.max(0, r.gap).toFixed(1)}`}</span>
          </motion.div>
        );
      })}
    </div>
  );
});

// ------------------------------------------------------------------ the view
export function RaceView({ cfg, settings, tutorial, onFinish, onQuit, onRestart, onCamera, onTutorialDone }: {
  cfg: RaceConfig; settings: RacingSettings; tutorial: boolean;
  onFinish: (r: RaceResult) => void; onQuit: () => void; onRestart: () => void; onCamera: (v: CameraView) => void; onTutorialDone: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const sess = useRef<RaceSession | null>(null);
  const fast = useRef<Fast>({ speed: null, gear: null, rpm: null, segs: [], speedo: null, ready: null, nitroBtn: null, map: null, wheel: null, tilt: null });
  const player = usePlayer();
  const vp = useViewport();
  const touch = useIsTouch();
  const [hud, setHud] = useState<HudFrame | null>(null);
  const [load, setLoad] = useState<{ p: number; label: string }>({ p: 0, label: "Loading" });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [count, setCount] = useState<{ text: string; k: number } | null>(null);
  const [split, setSplit] = useState<{ lap: number; ms: number; delta: number | null; best: boolean; k: number } | null>(null);
  const [posFx, setPosFx] = useState<{ dir: number; k: number } | null>(null);
  const [coinK, setCoinK] = useState(0);
  const [plus, setPlus] = useState<{ v: number; k: number } | null>(null);
  const [hurt, setHurt] = useState(0);
  const [elimMax, setElimMax] = useState(20);
  const [cam, setCam] = useState<CameraView>(settings.camera);
  const [err, setErr] = useState<string | null>(null);
  const [howto, setHowto] = useState(tutorial);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const ids = useRef(0);
  const prev = useRef({ pos: 0, coins: 0, timeLeft: -1, best: 0, phase: "" });
  const theme = getTheme(cfg.themeId);
  const solo = cfg.mode === "coinrush" || cfg.mode === "timetrial" || cfg.mode === "drift" || cfg.mode === "rally" || cfg.mode === "heat" || cfg.mode === "escape";
  const S = settings;

  const toast = useCallback((text: string, tone = "gold", big = false) => {
    const id = ++ids.current;
    setToasts((t) => [...t.filter((x) => !big || !x.big).slice(-2), { id, text, tone, big }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), big ? 1300 : 1600);
  }, []);

  // ---------------------------------------------------------------- session
  useEffect(() => {
    const q = S.quality === "auto" ? (window.matchMedia("(pointer: coarse)").matches ? "medium" : "high") : S.quality;
    const s = new RaceSession(host.current!, cfg, {
      quality: q, camera: S.camera, renderScale: player.settings.renderScale ?? 1,
      onHud: (f) => {
        const p = prev.current;
        if (f.phase === "racing") {
          if (p.pos && f.pos !== p.pos) setPosFx({ dir: f.pos < p.pos ? 1 : -1, k: ++ids.current });
          if (f.coins > p.coins) setCoinK((k) => k + 1);
          if (f.timeLeft != null && p.timeLeft >= 0 && cfg.mode === "coinrush" && f.timeLeft > p.timeLeft + 3) setPlus({ v: Math.round(f.timeLeft - p.timeLeft), k: ++ids.current });
          if (f.timeLeft != null && cfg.mode === "elimination" && (p.timeLeft < 0 || f.timeLeft > p.timeLeft + 1)) setElimMax(Math.max(5, f.timeLeft));
        }
        p.pos = f.pos; p.coins = f.coins; p.timeLeft = f.timeLeft ?? -1; p.phase = f.phase;
        setHud(f);
      },
      onProgress: (p, label) => setLoad({ p, label }),
      onEvent: (e: RaceEvent) => {
        if (e.type === "toast") {
          if (e.big && /^(\d|GO!)$/.test(e.text)) {
            const k = ++ids.current; setCount({ text: e.text, k }); setTimeout(() => setCount((c) => (c?.k === k ? null : c)), 950);
            if (e.text === "GO!") vibrate(S.vibrate, 50);
            return;
          }
          toast(e.text, e.tone ?? "gold", e.big);
          if (/CRASH|OUCH|TAKEDOWN|OIL|SPIKES|OUT OF LIVES|YOU'RE OUT/.test(e.text)) {
            vibrate(S.vibrate, /YOU'RE OUT|OUT OF LIVES/.test(e.text) ? 260 : /TAKEDOWN/.test(e.text) ? [30, 40, 60] : 70);
            if (!/TAKEDOWN/.test(e.text)) setHurt((h) => h + 1);
          } else if (/PERFECT|FINAL LAP/.test(e.text)) vibrate(S.vibrate, [20, 30, 20]);
        } else if (e.type === "lap") {
          const ms = MS(e.time), before = prev.current.best;
          setSplit({ lap: e.lap, ms, delta: before ? ms - before : null, best: e.best, k: ++ids.current });
          if (e.best || !before) prev.current.best = before ? Math.min(before, ms) : ms;
          vibrate(S.vibrate, 25);
          const k = ids.current; setTimeout(() => setSplit((x) => (x?.k === k ? null : x)), 3200);
        } else if (e.type === "finish") onFinish(e.result);
      },
    });
    s.touch.autoGas = S.autoGas;
    s.touch.useTilt = S.controls === "tilt" || S.controls === "wheel";
    sess.current = s;
    s.init().catch((x) => setErr(String(x?.message ?? x)));
    player.setInRound(true);
    return () => { s.destroy(); sess.current = null; player.setInRound(false); player.setMenu([]); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const s = sess.current; if (!s) return; if (player.paused || howto) s.pause(); else s.resume(); }, [player.paused, howto]);

  const cycleCam = useCallback(() => { const v = sess.current?.cycleCamera(); if (v) { setCam(v); onCamera(v); } }, [onCamera]);

  // pause menu actions
  useEffect(() => {
    player.setMenu([
      { id: "restart", label: "Restart", icon: "🔄", onSelect: () => onRestart() },
      { id: "camera", label: "Camera", icon: "🎥", onSelect: () => cycleCam() },
      { id: "quit", label: "Quit race", icon: "🏳️", onSelect: () => onQuit() },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tilt steering
  useEffect(() => {
    if (S.controls !== "tilt") return;
    const h = (e: DeviceOrientationEvent) => {
      const s = sess.current; if (!s) return;
      const angle = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number;
      const land = Math.abs(angle) === 90 || angle === 270;
      const raw = land ? (e.beta ?? 0) * (angle === 90 ? 1 : -1) : (e.gamma ?? 0);
      const v = Math.max(-1, Math.min(1, (raw / 24) * S.sensitivity));
      s.touch.tilt = Math.abs(v) < 0.04 ? 0 : v;
      const bar = fast.current.tilt; if (bar) bar.style.transform = `translateX(${v * 100}%)`;
    };
    window.addEventListener("deviceorientation", h);
    return () => window.removeEventListener("deviceorientation", h);
  }, [S.controls, S.sensitivity]);

  // fast loop: speedo, nitro, minimap (no React)
  useEffect(() => {
    let raf = 0, frame = 0, lastSpeed = -1, lastGear = -1, lastSeg = -1, lastMode = "";
    let outline: [number, number][] | null = null;
    const mph = S.units === "mph";
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = sess.current, f = fast.current;
      if (!s || s.phase === "loading" || !s.player) return;
      frame++;
      const c = s.player.car;
      const kmh = Math.abs(c.v) * 3.6, shown = Math.round(mph ? kmh * 0.621 : kmh);
      if (shown !== lastSpeed && f.speed) { f.speed.textContent = String(shown); lastSpeed = shown; }
      const gear = c.v < -0.5 ? -1 : c.gear;
      if (gear !== lastGear && f.gear) { f.gear.textContent = gear < 0 ? "R" : kmh < 2 ? "N" : String(gear); lastGear = kmh < 2 ? -9 : gear; }
      if (f.rpm) f.rpm.style.strokeDasharray = `${(Math.min(1, Math.max(0, c.rpm)) * 100).toFixed(1)} 200`;
      const n = Math.max(0, Math.min(1, c.nitro));
      const full = n >= 0.9, boost = c.boosting;
      const mode = boost ? "b" : full ? "f" : "n";
      const seg = Math.round(n * 40);
      if (seg !== lastSeg || mode !== lastMode) {
        lastSeg = seg; lastMode = mode;
        const col = boost ? "#FFB14A" : full ? "#E8FDFF" : "#7CF2FF";
        f.segs.forEach((p, i) => { if (!p) return; const fill = Math.max(0, Math.min(1, n * 10 - i)); p.setAttribute("opacity", String(0.16 + fill * 0.84)); p.setAttribute("stroke", col); });
        if (f.ready) f.ready.style.opacity = full && !boost ? "1" : "0";
        if (f.speedo) f.speedo.style.filter = boost ? "drop-shadow(0 0 14px rgba(255,140,40,0.75))" : full ? "drop-shadow(0 0 12px rgba(124,242,255,0.8))" : "none";
        const face = document.getElementById("nr-nitro-face");
        if (face) { face.style.setProperty("--n", n.toFixed(3)); face.style.boxShadow = full || boost ? `0 6px 0 rgba(0,0,0,0.35), 0 0 ${boost ? 34 : 24}px ${boost ? "rgba(255,150,40,0.9)" : "rgba(124,242,255,0.9)"}` : "0 6px 0 rgba(0,0,0,0.35)"; }
      }
      // minimap at ~20 fps
      const cv = f.map;
      if (cv && frame % 3 === 0) {
        const g = cv.getContext("2d"); if (!g) return;
        if (!outline) outline = s.minimap().outline;
        const W = cv.width, H = cv.height, pad = W * 0.09, sc = W / 150;
        g.clearRect(0, 0, W, H);
        const X = (v: number) => pad + v * (W - pad * 2), Y = (v: number) => pad + v * (H - pad * 2);
        g.lineJoin = "round"; g.beginPath();
        outline.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath();
        g.strokeStyle = "rgba(8,4,24,0.85)"; g.lineWidth = 11 * sc; g.stroke();
        g.strokeStyle = "rgba(255,255,255,0.92)"; g.lineWidth = 5 * sc; g.stroke();
        const [sx, sy] = outline[0];
        g.fillStyle = "#14102a"; g.fillRect(X(sx) - 5 * sc, Y(sy) - 5 * sc, 10 * sc, 10 * sc);
        g.fillStyle = "#fff"; g.fillRect(X(sx) - 5 * sc, Y(sy) - 5 * sc, 5 * sc, 5 * sc); g.fillRect(X(sx), Y(sy), 5 * sc, 5 * sc);
        const dots = s.mapDots();
        for (const d of dots) if (!d.player) { g.beginPath(); g.arc(X(d.xy[0]), Y(d.xy[1]), 5 * sc, 0, Math.PI * 2); g.fillStyle = d.color; g.fill(); g.lineWidth = 2 * sc; g.strokeStyle = "#fff"; g.stroke(); }
        for (const d of dots) if (d.player) { g.beginPath(); g.arc(X(d.xy[0]), Y(d.xy[1]), 7.5 * sc, 0, Math.PI * 2); g.fillStyle = "#FFD25A"; g.fill(); g.lineWidth = 3 * sc; g.strokeStyle = "#14102a"; g.stroke(); }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [S.units]);

  const press = useCallback((k: TouchKey, v: boolean) => { const s = sess.current; if (s) s.touch[k] = v; }, []);
  const reg = useCallback<Reg>((k, el) => { (fast.current as unknown as Record<string, unknown>)[k] = el; }, []);
  const regSeg = useCallback<RegSeg>((i, el) => { fast.current.segs[i] = el; }, []);
  const onWheel = useCallback((rot: number) => { const s = sess.current; if (s) s.touch.tilt = Math.max(-1, Math.min(1, (rot / 95) * S.sensitivity)); }, [S.sensitivity]);
  const onNitroDown = useCallback(() => { const s = sess.current; if (s && s.player && s.player.car.nitro > 0.05) vibrate(S.vibrate, 14); }, [S.vibrate]);

  // ---------------------------------------------------------------- layout
  const portrait = vp.portrait;
  const sizes: Sizes = useMemo(() => {
    const m = Math.min(vp.w, vp.h), k = S.controlSize ?? 1;
    let steer = Math.max(60, Math.min(100, m * 0.205)) * k;
    const fit = (st: number) => { const small = st * 0.74, nitro = st * 1.16, gap = Math.max(8, st * 0.1); return 2 * st + gap + (S.autoGas ? small + gap + nitro : small + gap + small * 1.15) + gap * 2 + 24; };
    if (portrait) while (fit(steer) > vp.w && steer > 54) steer -= 2;
    const small = Math.round(steer * 0.74), gap = Math.round(Math.max(8, steer * 0.1));
    return { steer: Math.round(steer), small, nitro: Math.round(steer * 1.16), gap, pedalW: Math.round(small * 1.15), pedalH: Math.round(small * 1.3) };
  }, [vp.w, vp.h, portrait, S.controlSize, S.autoGas]);
  const pedalsH = S.autoGas ? Math.max(sizes.nitro, sizes.small * 2 + sizes.gap) : Math.max(sizes.small * 2 + sizes.gap, Math.round(sizes.small * 1.12) + sizes.gap + sizes.pedalH);
  const speedoW = touch ? (portrait ? Math.round(Math.min(150, vp.w * 0.4)) : Math.round(Math.min(200, Math.max(140, vp.h * 0.42)))) : 230;
  const mapSize = Math.round(touch ? (portrait ? Math.min(118, vp.w * 0.3) : Math.min(116, vp.h * 0.27)) : 150);
  const lh = S.leftHanded;
  const h = hud;
  const live = !!h && h.phase !== "loading";
  const showControls = touch && live && h!.phase !== "finished";
  const maxRows = vp.h < 430 ? 4 : portrait ? 4 : vp.h < 700 ? 6 : 8;

  const speedoStyle: React.CSSProperties = !touch
    ? { right: "calc(var(--safe-right, 0px) + 18px)", bottom: "calc(var(--safe-bottom) + 14px)" }
    : portrait
      ? { [lh ? "left" : "right"]: "calc(var(--safe-" + (lh ? "left" : "right") + ", 0px) + 8px)", bottom: `calc(var(--safe-bottom) + ${12 + pedalsH + 6}px)` }
      : { left: "50%", transform: "translateX(-50%)", bottom: "calc(var(--safe-bottom) + 6px)" };

  const timeLeft = h?.timeLeft ?? null;
  const targets = h?.targets ?? (cfg.mode === "coinrush" ? cfg.coinTarget : undefined);
  const coinStars = cfg.mode === "coinrush" && targets ? targets.filter((t) => (h?.coins ?? 0) >= t).length : 0;
  const nextCoinTarget = cfg.mode === "coinrush" && targets ? targets.find((t) => (h?.coins ?? 0) < t) : undefined;

  return (
    <div className="nr-noselect absolute inset-0 overflow-hidden bg-[#0b0718]" style={{ touchAction: "none" }} onContextMenu={(e) => e.preventDefault()}>
      <div ref={host} className="absolute inset-0" />

      {/* boost speed lines + edge glow */}
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${h?.boosting ? "opacity-100" : "opacity-0"}`}>
        {h?.boosting && <SpeedLines />}
        <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 90px ${h?.perfectNitro ? "rgba(255,120,240,0.55)" : "rgba(80,190,255,0.45)"}` }} />
      </div>
      {/* damage flash */}
      <AnimatePresence>{hurt > 0 && <motion.div key={hurt} initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }} className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 120px rgba(255,40,60,0.85)" }} />}</AnimatePresence>
      {h?.danger && <div className="pointer-events-none absolute inset-0 animate-[nr-blink_0.8s_ease-in-out_infinite]" style={{ boxShadow: "inset 0 0 80px rgba(255,40,60,0.6)" }} />}

      {/* loading card */}
      <AnimatePresence>
        {!live && (
          <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="absolute inset-0 z-40 grid place-items-center overflow-hidden px-5" style={{ background: isStreet() ? `radial-gradient(circle at 50% 38%, ${theme.accent}44, transparent 70%), linear-gradient(180deg, #121219, #050507)` : `radial-gradient(circle at 50% 38%, ${theme.accent}77, transparent 72%), linear-gradient(180deg, #1b0d3d, #0b0718)` }}>
            <div aria-hidden className="absolute inset-0 opacity-40" style={{ background: isStreet() ? "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 4px)" : "repeating-linear-gradient(110deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 40px)", animation: isStreet() ? "nr-scan 0.5s linear infinite" : "nr-stripes 3s linear infinite" }} />
            <div className="relative w-[min(88vw,460px)] text-center">
              <p className="text-[clamp(3rem,14vmin,5rem)] leading-none drop-shadow-[0_8px_12px_rgba(0,0,0,0.4)]" style={{ animation: "nr-float 1.6s ease-in-out infinite" }}>{theme.emoji}</p>
              <p className="mt-1 text-[11px] font-bold tracking-[0.3em] text-white/70 uppercase">{MODE_INFO[cfg.mode].icon} {MODE_SHORT[cfg.mode]}</p>
              <p className="nr-italic font-display text-[clamp(1.8rem,8vmin,3rem)] leading-none text-white drop-shadow-[0_4px_0_rgba(10,4,30,0.8)]">{theme.name}</p>
              <p className="mt-1.5 text-[12.5px] font-semibold text-white/70">
                {cfg.laps < 50 ? `${cfg.laps} lap${cfg.laps > 1 ? "s" : ""}` : cfg.mode === "coinrush" ? `${cfg.timeLimit ?? 60}s on the clock` : "Last car standing"}
                {cfg.opponents && !solo ? ` · ${cfg.mode === "duel" ? "Boss duel" : cfg.mode === "battle" ? "Drift battle" : `${cfg.opponents} rivals`} · ${AI_LABEL[cfg.ai]}` : " · Solo"} · {getCar(cfg.carId).name}
              </p>
              <div className="relative mt-5 h-3.5 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/15">
                <div className={`h-full rounded-full transition-[width] duration-200 ${isStreet() ? "bg-[linear-gradient(90deg,#2EF2FF,#B06BFF,#FF1F7A)] shadow-[0_0_14px_#FF1F7A]" : "bg-[linear-gradient(90deg,#2E86FF,#7CF2FF,#FFD25A)]"}`} style={{ width: `${Math.max(4, Math.round(load.p * 100))}%` }} />
              </div>
              <p className="mt-2 font-display text-[13px] tracking-[0.2em] text-white/60 uppercase">{err ? "Oops — the track didn't load" : load.label}</p>
              {err && <p className="mt-1 text-[11px] break-words text-white/40">{err}</p>}
              {err && <button type="button" onClick={onQuit} className="mt-3 min-h-12 rounded-2xl bg-white/15 px-5 font-display ring-1 ring-white/25 active:scale-95">Back to menu</button>}
              <p className="mt-4 rounded-2xl bg-black/30 px-3 py-2 text-[13px] text-white/80 ring-1 ring-white/10">💡 {tip}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {live && h && (
        <>
          {/* ---------------------------------------------- top-left race cluster */}
          <div data-hud="cluster" className="pointer-events-none absolute z-20 flex flex-col items-start gap-1.5" style={{ top: "calc(var(--safe-top) + 8px)", left: "calc(var(--safe-left, 0px) + 10px)" }}>
            <div className="flex items-stretch gap-1 rounded-2xl bg-[#0b0718]/72 p-1 ring-1 ring-white/15 backdrop-blur-md">
              {!solo && (
                <motion.div key={posFx?.k ?? 0} initial={posFx ? { scale: 1.35 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 16 }}
                  className="relative flex items-baseline rounded-xl px-2.5 py-0.5 text-[#2a1600]" style={{ background: posFx && posFx.dir < 0 ? "linear-gradient(180deg,#FF9AA8,#FF5A6E)" : isStreet() ? "linear-gradient(180deg,#FF5FA8,#FF1F7A 45%,#B0004E)" : isHighway() ? "#FFC600" : isMoto() ? "#F5F5F7" : "linear-gradient(180deg,#FFF3B0,#FFD25A 45%,#FFAA1C)", color: isStreet() ? "#fff" : isHighway() || isMoto() ? "#111" : undefined, boxShadow: isHighway() ? "inset 0 0 0 2px #FFC600, inset 0 0 0 3.5px #111" : isMoto() ? "inset 6px 0 0 #E10600" : undefined }}>
                  <span className="nr-italic font-display text-[34px] leading-[1]">{h.pos}</span>
                  <span className="font-display text-[13px] uppercase">{ord(h.pos)}</span>
                  <span className="ml-0.5 font-display text-[13px] opacity-55">/{h.racers}</span>
                  {posFx && <motion.span key={posFx.k} initial={{ y: 0, opacity: 1 }} animate={{ y: posFx.dir > 0 ? -18 : 18, opacity: 0 }} transition={{ duration: 0.9 }} className={`absolute -right-2 top-0 font-display text-sm ${posFx.dir > 0 ? "text-[#5CE39A]" : "text-[#FF6B7E]"}`}>{posFx.dir > 0 ? "▲" : "▼"}</motion.span>}
                </motion.div>
              )}
              {h.laps > 0 && (
                <div className="flex flex-col justify-center px-1.5 text-center"><span className="text-[9px] font-bold tracking-widest text-white/55">LAP</span>
                  <span className="font-display text-[19px] leading-none text-white">{Math.min(h.lap, h.laps)}<span className="text-[13px] text-white/50">/{h.laps}</span></span></div>
              )}
              {cfg.mode !== "coinrush" && (
                <div className="flex min-w-[78px] flex-col justify-center px-1.5"><span className="text-[9px] font-bold tracking-widest text-white/55">{h.laps > 0 ? "TIME" : "TIME"}</span>
                  <span className="font-display text-[17px] leading-none tabular-nums text-white">{fmt(h.time)}</span>
                  {h.bestLap > 0 && <span className="text-[9.5px] font-bold tabular-nums text-[#7CF2C9]">BEST {fmt(h.bestLap)}</span>}
                </div>
              )}
              {h.driftPoints != null && (cfg.mode === "drift" || cfg.mode === "battle") && (
                <div className="flex flex-col justify-center rounded-xl bg-[#FF4FD8]/15 px-2">
                  <span className="nr-italic font-display text-[20px] leading-none text-[#FF9BE8] tabular-nums">{pts(h.driftPoints)}</span>
                  <span className="text-[9.5px] font-bold text-white/60">{cfg.mode === "drift" && targets ? (() => { const n = targets.find((t) => (h.driftPoints ?? 0) < t); const k = targets.filter((t) => (h.driftPoints ?? 0) >= t).length; return n != null ? `${"★".repeat(k + 1)} at ${pts(n)}` : "★★★ MAX!"; })() : "DRIFT PTS"}</span>
                </div>
              )}
              {h.score != null && (cfg.mode === "heat" || cfg.mode === "escape" || cfg.mode === "takedown" || cfg.mode === "wheelie") && (
                <div className="flex flex-col justify-center rounded-xl bg-[#FFC600]/15 px-2">
                  <span className="font-display text-[20px] leading-none text-[#FFC600] tabular-nums">{pts(h.score)}{(h.combo ?? 0) > 1 && <span className="ml-1 text-[13px] text-[#7CF2FF]">×{h.combo}</span>}</span>
                  <span className="text-[9.5px] font-bold text-white/60">{(cfg.mode === "heat" || cfg.mode === "wheelie") && targets ? (() => { const n = targets.find((t) => (h.score ?? 0) < t); const k = targets.filter((t) => (h.score ?? 0) >= t).length; return n != null ? `${"★".repeat(k + 1)} at ${pts(n)}` : "★★★ MAX!"; })() : "SCORE"}</span>
                </div>
              )}
              {(cfg.mode === "heat" || cfg.mode === "wheelie") && h.lives != null && <div className="flex items-center gap-0.5 px-1">{[0, 1, 2].map((i) => <Heart key={i} className={`size-[18px] ${i < (h.lives ?? 0) ? "fill-[#FF5A6E] text-[#FF5A6E] drop-shadow-[0_0_4px_rgba(255,90,110,0.7)]" : "text-white/25"}`} />)}</div>}
              {cfg.mode === "coinrush" && (
                <>
                  <motion.div key={coinK} initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 15 }} className="flex flex-col justify-center rounded-xl bg-[#FFD25A]/15 px-2">
                    <span className="flex items-center gap-1 font-display text-[22px] leading-none text-[#FFD25A]"><CoinIcon size={20} />{h.coins}</span>
                    <span className="text-[9.5px] font-bold text-white/60">{nextCoinTarget != null ? `${"★".repeat(coinStars + 1)} at ${nextCoinTarget}` : "★★★ MAX!"}</span>
                  </motion.div>
                  {h.lives != null && <div className="flex items-center gap-0.5 px-1">{[0, 1, 2].map((i) => <Heart key={i} className={`size-[18px] ${i < (h.lives ?? 0) ? "fill-[#FF5A6E] text-[#FF5A6E] drop-shadow-[0_0_4px_rgba(255,90,110,0.7)]" : "text-white/25"}`} />)}</div>}
                </>
              )}
              {timeLeft != null && (
                <div className={`relative flex flex-col justify-center rounded-xl px-2 text-center ${timeLeft < 8 ? "animate-[nr-pulse_0.6s_ease-in-out_infinite] bg-[#FF5A6E] text-white" : "bg-white/10 text-white"}`}>
                  <span className="text-[9px] font-bold tracking-widest opacity-75">{cfg.mode === "elimination" ? "KNOCKOUT" : "TIME"}</span>
                  <span className="font-display text-[19px] leading-none tabular-nums">{Math.ceil(timeLeft)}s</span>
                  {cfg.mode === "elimination" && <span className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-black/40"><span className="block h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${Math.max(0, Math.min(100, (timeLeft / elimMax) * 100))}%` }} /></span>}
                  <AnimatePresence>{plus && <motion.span key={plus.k} initial={{ y: 4, opacity: 1, scale: 1.4 }} animate={{ y: 26, opacity: 0, scale: 1 }} transition={{ duration: 1.4 }} className="absolute top-full left-1/2 -translate-x-1/2 font-display text-lg text-[#5CE39A] drop-shadow-[0_2px_0_#03230f]">+{plus.v}s</motion.span>}</AnimatePresence>
                </div>
              )}
            </div>
            {/* mode sub-line */}
            {h.rival && <BattleBar me={(h.driftPoints ?? 0) + (h.driftChain ?? 0)} rival={h.rival} tandem={!!h.tandem} />}
            {(h.heat != null || h.suspects) && <PursuitPanel h={h} />}
            {(h.ghostDelta != null || (h.boss && cfg.mode !== "battle") || h.nextGate != null || (cfg.mode === "elimination" && h.danger)) && (
              <div className="flex flex-wrap gap-1">
                {h.ghostDelta != null && <span className={`rounded-full px-2 py-0.5 font-display text-[12px] tabular-nums ${h.ghostDelta <= 0 ? "bg-[#16A35A]" : "bg-[#D61F3A]"}`}>👻 {h.ghostDelta <= 0 ? "−" : "+"}{Math.abs(h.ghostDelta).toFixed(2)}</span>}
                {h.boss && cfg.mode !== "battle" && <span className={`rounded-full px-2 py-0.5 font-display text-[12px] ${h.boss.gap >= 0 ? "bg-[#16A35A]" : "bg-[#7B1FA2]"}`}>👑 {h.boss.name} {h.boss.gap >= 0 ? "behind" : "ahead"} {Math.abs(h.boss.gap).toFixed(1)}s</span>}
                {h.nextGate != null && <span className="rounded-full bg-[#0b0718]/70 px-2 py-0.5 font-display text-[12px] text-[#7CF2C9] ring-1 ring-white/10">🏁 {Math.round(h.nextGate)} m · +{h.gateBonus ?? 12}s</span>}
                {cfg.mode === "elimination" && h.danger && <span className="animate-[nr-blink_0.6s_ease-in-out_infinite] rounded-full bg-[#FF5A6E] px-2 py-0.5 font-display text-[12px]">💥 DANGER ZONE — PASS SOMEONE!</span>}
              </div>
            )}
            {/* lap split */}
            <AnimatePresence>
              {split && (
                <motion.div key={split.k} initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} className="flex items-center gap-2 rounded-xl bg-[#0b0718]/80 px-2.5 py-1 ring-1 ring-white/15">
                  <span className="text-[10px] font-bold tracking-widest text-white/60">LAP {split.lap}</span>
                  <span className="font-display text-[15px] tabular-nums">{fmt(split.ms)}</span>
                  {split.delta != null && <span className={`font-display text-[13px] tabular-nums ${split.delta <= 0 ? "text-[#5CE39A]" : "text-[#FF6B7E]"}`}>{split.delta <= 0 ? "−" : "+"}{(Math.abs(split.delta) / 1000).toFixed(2)}</span>}
                  {split.best && <span className="rounded-full bg-[#2FD47A] px-1.5 font-display text-[10px] text-[#03230f]">BEST</span>}
                </motion.div>
              )}
            </AnimatePresence>
            {!solo && S.showStandings && h.standings.length > 1 && <Standings list={h.standings} max={maxRows} mode={cfg.mode} danger={!!h.danger} />}
          </div>

          {/* ---------------------------------------------- top-right: minimap + camera (under the pause button) */}
          <div data-hud="map" className="absolute z-20 flex flex-col items-end gap-2" style={{ top: "calc(var(--safe-top) + 60px)", right: "calc(var(--safe-right, 0px) + 10px)" }}>
            {S.showMap && <canvas ref={(el) => reg("map", el)} width={mapSize * 2} height={mapSize * 2} className="pointer-events-none rounded-2xl bg-[#0b0718]/45 ring-1 ring-white/15 backdrop-blur-sm" style={{ width: mapSize, height: mapSize }} />}
            <button type="button" onClick={cycleCam} aria-label={`Camera: ${cam}`} className="flex h-11 items-center gap-1.5 rounded-2xl bg-[#0b0718]/65 px-3 font-display text-xs text-white ring-1 ring-white/20 backdrop-blur-md active:scale-95"><Camera className="size-4" />{cam.toUpperCase()}</button>
          </div>

          {/* ---------------------------------------------- centre: status chips, wrong way */}
          <div className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1" style={{ top: portrait ? "37%" : "24%" }}>
            {h.driftChain != null ? <DriftChain chain={h.driftChain} mult={h.driftMult ?? 1} tandem={!!h.tandem} /> : h.drift > 40 && (
              <span className="nr-italic rounded-full px-3 py-1 font-display text-[15px] text-[#14102a] shadow-[0_0_16px_rgba(255,255,255,0.4)]"
                style={{ background: ["#FF9BE6", "#7CF2FF", "#FFB14A", "#C08CFF"][Math.min(3, h.driftLevel ?? 0)] }}>
                DRIFT {h.drift.toLocaleString()}{h.driftLevel ? ` · ${"🔥".repeat(h.driftLevel)}` : ""}
              </span>
            )}
            <div className="flex gap-1">
              {h.shield > 0 && <span className="flex items-center gap-1 rounded-full bg-[#7CF2FF] px-2.5 py-0.5 font-display text-xs text-[#06122e]"><Shield className="size-3.5" />{Math.ceil(h.shield)}s</span>}
              {h.magnet > 0 && <span className="flex items-center gap-1 rounded-full bg-[#FF5A6E] px-2.5 py-0.5 font-display text-xs"><Magnet className="size-3.5" />{Math.ceil(h.magnet)}s</span>}
              {(h.draft ?? 0) > 0.3 && <span className="flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-0.5 font-display text-xs text-[#14102a]"><Wind className="size-3.5" />SLIPSTREAM</span>}
            </div>
            {h.wrongWay && <span className="mt-6 animate-[nr-blink_0.5s_ease-in-out_infinite] rounded-2xl bg-[#FF5A6E] px-5 py-2 font-display text-[clamp(1.2rem,5vw,2rem)] text-white shadow-[0_0_30px_rgba(255,90,110,0.7)]">⟲ WRONG WAY!</span>}
          </div>

          {/* ---------------------------------------------- rally co-driver */}
          {h.call && (
            <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center" style={{ top: portrait ? "21%" : "calc(var(--safe-top) + 8px)" }}>
              <PaceCard call={h.call} />
            </div>
          )}

          {/* ---------------------------------------------- toasts */}
          <div className="pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-1.5 px-4" style={{ top: portrait ? "29%" : "16%" }}>
            <AnimatePresence>
              {toasts.filter((t) => !t.big).map((t) => (
                <motion.div key={t.id} initial={{ scale: 0.5, opacity: 0, x: -30 }} animate={{ scale: 1, opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ type: "spring", stiffness: 520, damping: 26 }}
                  className={`px-3.5 py-1 font-display text-[clamp(1rem,4.4vw,1.6rem)] leading-tight ${isMoto() ? "-skew-x-[12deg] rounded-[4px] uppercase" : isHighway() ? "rounded-lg" : `nr-italic -skew-x-6 ${isStreet() ? "rounded-md bg-[#07070b]/85 uppercase backdrop-blur-sm" : "rounded-xl text-[#14102a] shadow-[0_4px_0_rgba(10,6,30,0.6)]"}`}`}
                  style={isMoto()
                    ? { background: t.tone === "red" ? "#E10600" : t.tone === "gold" ? "#FFD400" : "#F5F5F7", color: t.tone === "red" ? "#fff" : "#121316", boxShadow: `inset 6px 0 0 ${t.tone === "red" ? "#121316" : "#E10600"}, 0 4px 0 rgba(0,0,0,0.5)` }
                    : isHighway()
                    ? { background: (SIGN_TONE[t.tone] ?? SIGN_TONE.gold)[0], color: (SIGN_TONE[t.tone] ?? SIGN_TONE.gold)[1], boxShadow: `inset 0 0 0 2.5px ${(SIGN_TONE[t.tone] ?? SIGN_TONE.gold)[0]}, inset 0 0 0 4.5px ${(SIGN_TONE[t.tone] ?? SIGN_TONE.gold)[1]}, 0 4px 0 rgba(0,0,0,0.45)` }
                    : isStreet()
                    ? { color: STREET_TONE[t.tone] ?? "#FFE14D", boxShadow: `inset 0 0 0 2px ${STREET_TONE[t.tone] ?? "#FFE14D"}, 0 0 18px ${STREET_TONE[t.tone] ?? "#FFE14D"}66`, textShadow: `0 0 10px ${STREET_TONE[t.tone] ?? "#FFE14D"}` }
                    : { background: `linear-gradient(180deg, ${TONE[t.tone]?.[0] ?? "#FFD25A"}, ${TONE[t.tone]?.[1] ?? "#FF9F1C"})` }}>
                  {t.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-3" style={{ top: portrait ? "40%" : "34%" }}>
            <AnimatePresence>
              {toasts.filter((t) => t.big).slice(-1).map((t) => (
                <motion.p key={t.id} initial={{ scale: 2.4, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: -4 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 15 }}
                  className="nr-italic text-center font-display text-[clamp(2.4rem,12vw,6rem)] leading-none"
                  style={{ color: TONE[t.tone]?.[0] ?? "#FFD25A", textShadow: "0 6px 0 #14102a, 0 0 30px rgba(0,0,0,0.5)", WebkitTextStroke: "2px #14102a" }}>
                  {t.text}
                </motion.p>
              ))}
            </AnimatePresence>
          </div>

          {/* ---------------------------------------------- countdown */}
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
            <AnimatePresence>
              {count && (
                <motion.div key={count.k} initial={{ scale: 2.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 18 }} className="relative grid place-items-center">
                  <motion.span initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.8 }} className="absolute size-[clamp(120px,34vmin,240px)] rounded-full border-[6px]" style={{ borderColor: count.text === "GO!" ? "#5CE39A" : "#FFD25A" }} />
                  <span className="nr-italic font-display text-[clamp(5rem,26vmin,12rem)] leading-none" style={{ color: count.text === "GO!" ? "#7CF2C9" : "#FFD25A", textShadow: "0 8px 0 #14102a, 0 0 40px rgba(255,200,60,0.5)", WebkitTextStroke: "3px #14102a" }}>{count.text}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ---------------------------------------------- intro card / start tips */}
          <AnimatePresence>
            {(h.phase === "intro" || h.phase === "countdown") && (
              <motion.div key="intro" initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -80, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="pointer-events-none absolute z-20" style={{ left: "calc(var(--safe-left, 0px) + 10px)", top: portrait ? "46%" : "47%" }}>
                <div className="-skew-x-6 overflow-hidden rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                  <div className="px-3 py-1 font-display text-[11px] tracking-[0.25em] text-white uppercase" style={{ background: theme.accent }}>{MODE_INFO[cfg.mode].icon} {MODE_SHORT[cfg.mode]}</div>
                  <div className="bg-[#0b0718]/85 px-3 py-1.5">
                    <p className="nr-italic font-display text-[clamp(1.1rem,4.6vw,1.7rem)] leading-none">{theme.emoji} {theme.name}</p>
                    <p className="mt-0.5 text-[11.5px] font-semibold text-white/65">{cfg.laps < 50 ? `${cfg.laps} lap${cfg.laps > 1 ? "s" : ""}` : cfg.mode === "coinrush" ? "Beat the clock" : "Survive!"}{!solo ? ` · ${cfg.opponents} rival${cfg.opponents > 1 ? "s" : ""}` : ""}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {h.phase === "countdown" && (
            <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4" style={{ bottom: touch ? `calc(var(--safe-bottom) + ${Math.round(portrait ? 12 + pedalsH + 16 + speedoW * 0.65 : 18 + speedoW * 0.65)}px)` : "18%" }}>
              <span data-hud="tip" className="rounded-full bg-[#0b0718]/75 px-3 py-1 text-center text-[12px] font-bold text-[#7CF2FF] ring-1 ring-[#7CF2FF]/40">⚡ Hold NITRO right at GO for a perfect start!</span>
            </div>
          )}
          {touch && portrait && (h.phase === "intro" || h.phase === "countdown") && (
            <div data-hud="rotate" className="pointer-events-none absolute z-20" style={{ [lh ? "right" : "left"]: `calc(var(--safe-${lh ? "right" : "left"}, 0px) + 10px)`, bottom: `calc(var(--safe-bottom) + ${12 + Math.round(sizes.steer * 1.05) + 12}px)`, maxWidth: Math.max(140, vp.w - speedoW - 40) }}>
              <span className="flex items-center gap-1.5 rounded-2xl bg-[#0b0718]/75 px-2.5 py-1.5 text-[11.5px] leading-tight font-bold text-white/85 ring-1 ring-white/15"><Smartphone className="size-5 shrink-0 rotate-90 animate-[nr-float_1.2s_ease-in-out_infinite]" />Turn sideways for the full view</span>
            </div>
          )}
          {!touch && (h.phase === "intro" || h.phase === "countdown") && (
            <div className="pointer-events-none absolute z-20 rounded-2xl bg-[#0b0718]/75 px-3 py-2 text-[12px] text-white/75 ring-1 ring-white/10" style={{ left: 16, bottom: 16 }}>
              <b className="font-display text-white">Keys</b> ← → steer · ↑ gas · ↓ brake · Shift nitro · X drift · C camera · P pause
            </div>
          )}

          {/* ---------------------------------------------- nitro full hint */}
          {live && (h.nitroFull ?? h.nitro >= 0.9) && !h.boosting && h.phase === "racing" && (
            <div className="pointer-events-none absolute z-20" style={{ [lh ? "left" : "right"]: `calc(var(--safe-${lh ? "left" : "right"}, 0px) + 10px)`, bottom: `calc(var(--safe-bottom) + ${Math.round(!touch ? 24 + speedoW * 0.64 : 12 + pedalsH + (portrait ? speedoW * 0.66 + 14 : 8))}px)` }}>
              <span data-hud="nitrohint" className="animate-[nr-pulse_0.7s_ease-in-out_infinite] rounded-full bg-[#7CF2FF] px-2.5 py-1 font-display text-[11px] whitespace-nowrap text-[#06122e] shadow-[0_0_16px_#7CF2FF]">{touch ? "NITRO FULL · DOUBLE-TAP!" : "NITRO FULL · DOUBLE-TAP SHIFT!"}</span>
            </div>
          )}

          {/* ---------------------------------------------- speedometer */}
          <div data-hud="speedo" className="pointer-events-none absolute z-20" style={speedoStyle}><Speedo reg={reg} regSeg={regSeg} units={S.units} width={speedoW} /></div>

          {/* ---------------------------------------------- touch controls */}
          {showControls && (
            <div className={`pointer-events-none absolute z-20 flex items-end justify-between *:pointer-events-auto ${lh ? "flex-row-reverse" : ""}`} style={{ left: "calc(var(--safe-left, 0px) + 12px)", right: "calc(var(--safe-right, 0px) + 12px)", bottom: "calc(var(--safe-bottom) + 12px)" }}>
              {S.controls === "buttons" ? <SteerPad S={sizes} press={press} />
                : S.controls === "wheel" ? <Wheel size={Math.round(sizes.steer * 1.75)} onSteer={onWheel} />
                  : (
                    <div className="flex flex-col items-center gap-1 rounded-2xl bg-[#0b0718]/55 px-3 py-2 ring-1 ring-white/15" style={{ width: sizes.steer * 1.6 }}>
                      <span className="font-display text-[11px] tracking-widest text-white/70">📱 TILT TO STEER</span>
                      <span className="relative h-2 w-full overflow-hidden rounded-full bg-white/15"><span ref={(el) => reg("tilt", el)} className="absolute top-0 left-[45%] h-full w-[10%] rounded-full bg-[#FFD25A]" /></span>
                    </div>
                  )}
              <Pedals S={sizes} press={press} autoGas={S.autoGas} onNitroDown={onNitroDown} />
            </div>
          )}
        </>
      )}

      {/* ---------------------------------------------- first race: how to play */}
      <AnimatePresence>
        {howto && (live || (load.p >= 1 && !err)) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[45] grid place-items-center bg-[#05020c]/80 p-3 backdrop-blur-sm"
            style={{ paddingTop: "calc(var(--safe-top) + 12px)", paddingBottom: "calc(var(--safe-bottom) + 12px)" }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className={`nr-scroll max-h-full w-[min(94vw,640px)] overflow-y-auto p-4 ${isStreet() ? "rounded-lg bg-[linear-gradient(180deg,#16161f,#08080c)] shadow-[inset_0_0_0_2px_#FF1F7A,0_0_30px_rgba(255,31,122,0.3)]" : "rounded-[1.6rem] bg-[linear-gradient(180deg,#2a1458,#120a28)] ring-1 ring-white/15"}`}>
              <p className="nr-italic text-center font-display text-[clamp(1.6rem,6vw,2.4rem)] leading-none" style={{ color: isStreet() ? "#FF1F7A" : "#FFD25A", textShadow: isStreet() ? "0 0 16px rgba(255,31,122,0.6)" : "0 4px 0 #1a0838" }}>{isStreet() ? "HOW TO DRIFT" : "HOW TO RACE"}</p>
              <div className={`mt-3 grid gap-2 ${portrait ? "" : "grid-cols-2"}`}>
                {[
                  touch ? (S.controls === "tilt" ? ["📱", "Steer", "Tilt your phone left and right like a steering wheel."] : S.controls === "wheel" ? ["🛞", "Steer", "Drag the wheel round to turn."] : ["◀ ▶", "Steer", "Hold the big arrows. Slide your thumb across to switch sides."])
                    : ["⬅️➡️", "Steer", "Arrow keys or A / D to steer."],
                  S.autoGas ? ["🚗", "Go!", "Your car speeds up by itself. Hold BRAKE before tight corners."] : ["🟢", "Gas & brake", "Hold GAS to go, BRAKE to slow down."],
                  cfg.game === "drift-kings"
                    ? ["〰", "Drift chains", "Hold DRIFT and steer into a bend. Keep sliding for ×2…×5 — but a wall hit breaks the chain!"]
                    : ["〰", "Drift", "Hold DRIFT while turning to slide — it fills your nitro!"],
                  ["⚡", "Nitro", "Tap NITRO for a speed burst. Full bar? Double-tap!"],
                ].map(([icon, title, text]) => (
                  <div key={title} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-2.5 ring-1 ring-white/10">
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#0b0718] font-display text-xl">{icon}</span>
                    <span><span className="block font-display text-[17px] leading-tight">{title}</span><span className="text-[13px] leading-snug text-white/70">{text}</span></span>
                  </div>
                ))}
              </div>
              <button type="button" autoFocus onClick={async () => { if (S.controls === "tilt") await askMotionPermission(); setHowto(false); onTutorialDone(); }}
                className={`mt-3 flex min-h-14 w-full items-center justify-center gap-2 font-display text-xl ${isStreet() ? "rounded-md bg-[linear-gradient(100deg,#FF1F7A,#FF6FB0)] text-white uppercase shadow-[0_0_24px_rgba(255,31,122,0.55)] active:scale-[0.98]" : "rounded-2xl bg-[linear-gradient(180deg,#FFF3B0,#FFD25A_38%,#FF9F1C)] text-[#2a1600] shadow-[0_5px_0_#a65a00] active:translate-y-1 active:shadow-none"}`}>
                <Flame className="size-6" />LET&apos;S RACE!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- Drift Kings HUD pieces
const MULT_COL = ["#FFE14D", "#FFE14D", "#2EF2FF", "#B06BFF", "#FF1F7A", "#FF1F7A"];
/** the live (unbanked) drift chain: big points and the ×multiplier */
const DriftChain = memo(function DriftChain({ chain, mult, tandem }: { chain: number; mult: number; tandem: boolean }) {
  if (chain <= 0) return null;
  const col = MULT_COL[Math.min(5, mult)];
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1.5">
        <motion.span key={mult} initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 14 }}
          className="nr-italic grid min-w-11 place-items-center rounded-xl px-1.5 font-display text-[22px] leading-[1.15] text-[#14102a] shadow-[0_3px_0_rgba(10,6,30,0.6)]" style={{ background: col }}>×{mult}</motion.span>
        <span className="nr-italic font-display text-[clamp(1.6rem,7vw,2.6rem)] leading-none tabular-nums" style={{ color: col, textShadow: "0 4px 0 #14102a, 0 0 18px rgba(0,0,0,0.45)", WebkitTextStroke: "1.5px #14102a" }}>{pts(chain)}</span>
      </div>
      {tandem && <span className="mt-0.5 rounded-full bg-[#FF4FD8] px-2.5 py-0.5 font-display text-[12px] text-white shadow-[0_0_14px_rgba(255,79,216,0.7)]">TANDEM ×1.5</span>}
    </div>
  );
});

/** drift battle: you vs the rival, with a tug-of-war bar */
const BattleBar = memo(function BattleBar({ me, rival, tandem }: { me: number; rival: { name: string; points: number }; tandem: boolean }) {
  const total = Math.max(1, me + rival.points), share = me / total;
  const lead = me >= rival.points;
  return (
    <div className="w-[min(62vw,260px)] rounded-xl bg-[#0b0718]/75 p-1.5 ring-1 ring-white/15 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 font-display text-[12px] leading-none">
        <span className={lead ? "text-[#FFD25A]" : "text-white/80"}>YOU {pts(me)}{lead && " 👑"}</span>
        <span className={!lead ? "text-[#FF9AA8]" : "text-white/70"}>{!lead && "👑 "}{pts(rival.points)} {rival.name.toUpperCase()}</span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-[#FF5A6E]">
        <div className={`h-full rounded-full transition-[width] duration-300 ${tandem ? "bg-[#FF4FD8]" : "bg-[#FFD25A]"}`} style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
    </div>
  );
});

/** rally pace note: direction, grade and distance; long or very tight bends get a caution flag */
const PaceCard = memo(function PaceCard({ call }: { call: NonNullable<HudFrame["call"]> }) {
  const hair = call.grade === "HAIRPIN";
  const sharp = hair || call.grade === "2";
  const col = sharp ? "#FF5A6E" : call.grade === "3" ? "#FFB14A" : call.grade === "4" ? "#FFD25A" : "#5CE39A";
  return (
    <motion.div key={`${call.dir}${call.grade}`} initial={{ y: -10, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }}
      className="flex items-center gap-2 rounded-2xl bg-[#0b0718]/80 py-1 pr-3 pl-1 ring-2 backdrop-blur-md" style={{ ["--tw-ring-color" as string]: col }}>
      <span className="grid size-11 place-items-center rounded-xl text-[26px] leading-none text-[#14102a]" style={{ background: col }}>
        {hair ? (call.dir < 0 ? "↶" : "↷") : call.dir < 0 ? "⬅" : "➡"}
      </span>
      <div className="flex flex-col leading-none">
        <span className="nr-italic font-display text-[19px] text-white">{hair ? `HAIRPIN ${call.dir < 0 ? "LEFT" : "RIGHT"}` : `${call.dir < 0 ? "LEFT" : "RIGHT"} ${call.grade}`}{call.caution && <span className="ml-1 text-[#FF5A6E]">!!</span>}</span>
        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-white/65">in {Math.max(0, Math.round(call.dist / 10) * 10)} m</span>
      </div>
    </motion.div>
  );
});

// ---------------------------------------------------------------- Highway Heat HUD
/** heat level (police badges), the BUSTED meter and damage — or the suspects' health in Takedown */
const PursuitPanel = memo(function PursuitPanel({ h }: { h: HudFrame }) {
  if (h.suspects) {
    return (
      <div className="flex w-[min(62vw,240px)] flex-col gap-1 rounded-xl bg-[#0b0f14]/80 p-1.5 ring-1 ring-white/15 backdrop-blur-md">
        {h.suspects.map((x) => (
          <div key={x.name} className="flex items-center gap-1.5 text-[11px] font-bold">
            <span className={`w-16 truncate ${x.out ? "text-[#2FD47A] line-through" : "text-white"}`}>{x.out ? "BUSTED" : x.name.toUpperCase()}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#E3262F,#FF7A1A)] transition-[width] duration-200" style={{ width: `${x.out ? 0 : x.hp}%` }} /></span>
          </div>
        ))}
      </div>
    );
  }
  const heat = h.heat ?? 1, bust = h.bust ?? 0, dmg = h.damage ?? 0;
  return (
    <div className="flex w-[min(62vw,240px)] flex-col gap-1 rounded-xl bg-[#0b0f14]/80 p-1.5 ring-1 ring-white/15 backdrop-blur-md">
      <div className="flex items-center gap-1">
        <span className="text-[9.5px] font-bold tracking-widest text-white/60">HEAT</span>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`grid size-4 place-items-center rounded-full text-[9px] ${i <= heat ? (i % 2 ? "bg-[#E3262F]" : "bg-[#2A6BFF]") + " text-white shadow-[0_0_8px_rgba(255,60,60,0.6)]" : "bg-white/10 text-white/30"}`}>★</span>
        ))}
      </div>
      {bust > 0.02 && (
        <div className="flex items-center gap-1.5 text-[10px] font-bold">
          <span className="w-12 animate-[nr-blink_0.5s_ease-in-out_infinite] text-[#FF5A6E]">BUSTED</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#2A6BFF,#E3262F)]" style={{ width: `${Math.round(bust * 100)}%` }} /></span>
        </div>
      )}
      {dmg > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] font-bold">
          <span className="w-12 text-white/70">DAMAGE</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/15"><span className={`block h-full rounded-full ${dmg > 70 ? "bg-[#E3262F]" : dmg > 35 ? "bg-[#FF7A1A]" : "bg-[#FFC600]"}`} style={{ width: `${Math.round(dmg)}%` }} /></span>
        </div>
      )}
    </div>
  );
});
