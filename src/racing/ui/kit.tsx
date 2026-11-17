"use client";
// Shared look & feel for the racing front-end: game buttons, chips, segmented controls, toggles, stat bars,
// app bar, bottom sheets, car thumbnails, track outlines and the little hooks the screens share.
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, animate, motion } from "motion/react";
import { ArrowLeft, Lock, Star, X } from "lucide-react";
import { audio, type Sound } from "@/lib/audio";
import { CoinPill } from "@/components/brand/CoinPill";
import { Track } from "../track";
import { activeGame, getTheme } from "../games";
import type { CarSpec, ModeId } from "../types";
import { cachedThumb, carThumb } from "./thumbs";

// ------------------------------------------------------------------ formatting
export const fmt = (ms: number) => {
  if (!ms || ms < 0 || !Number.isFinite(ms)) return "--:--.--";
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), c = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
};
export const ord = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th");
export const AI_LABEL: Record<string, string> = { easy: "Easy", normal: "Normal", hard: "Hard", pro: "Pro" };
export const AI_EMOJI: Record<string, string> = { easy: "🙂", normal: "😎", hard: "😤", pro: "🔥" };
export const MODE_COLOR: Record<ModeId, [string, string]> = {
  race: ["#FF6B3D", "#C2185B"], coinrush: ["#FFC93C", "#E07B00"], timetrial: ["#4FD1FF", "#2563EB"], elimination: ["#FF5A6E", "#7B1FA2"], duel: ["#B98CFF", "#4C1D95"],
  drift: ["#FF4FD8", "#6D28D9"], battle: ["#FF8A3D", "#B91C1C"], rally: ["#9BE34A", "#3F6212"],
  heat: ["#FF7A1A", "#C2152B"], escape: ["#2A6BFF", "#0B2A7A"], takedown: ["#FFC600", "#1F6F4A"], wheelie: ["#FFD400", "#E10600"],
};
export const MODE_SHORT: Record<ModeId, string> = { race: "Grand Prix", coinrush: "Coin Rush", timetrial: "Time Attack", elimination: "Knockout", duel: "Boss Duel", drift: "Drift Attack", battle: "Drift Battle", rally: "Rally Stage", heat: "Heat Run", escape: "Escape", takedown: "Takedown", wheelie: "Wheelies" };
/** points with thousands separators */
export const pts = (n: number) => Math.round(n).toLocaleString("en-US");

// ------------------------------------------------------------------ sound
export const UI_SOUNDS: Sound[] = ["pop", "swoosh", "tada", "sparkle", "confetti", "a:click", "a:whooshIn", "a:levelup", "a:register", "a:ding", "a:tickHi", "a:coin", "a:cheer", "a:applause", "a:fail", "a:blip"];

// ------------------------------------------------------------------ skins
/** Drift Kings wears the "street" skin: midnight asphalt, neon pink / cyan, slanted sharp buttons, motorsport font */
export const isStreet = () => activeGame().skin === "street";
/** Highway Heat wears the "highway" skin: road-sign green panels with white borders, yellow warning signs, police lights */
export const isHighway = () => activeGame().skin === "highway";
/** Moto Rush GP wears the "moto" skin: paddock red / white / carbon fibre, race-number plates, chequered flags */
export const isMoto = () => activeGame().skin === "moto";
/** street UI sounds: gear-shift clunks, turbo blow-off and tyre whooshes instead of the arcade pops */
const STREET_SFX: Partial<Record<Sound, [Sound, number, number]>> = {
  pop: ["a:race_shift", 0.55, 1.15], swoosh: ["a:race_nearMiss", 0.5, 1.35], "a:click": ["a:race_beep", 0.4, 1.6],
  "a:whooshIn": ["a:race_blowoff", 1.1, 1.0], "a:blip": ["a:race_beep", 0.35, 2.0],
};
export const STREET_UI_SOUNDS: Sound[] = ["a:race_shift", "a:race_nearMiss", "a:race_beep", "a:race_blowoff", "a:race_crowd", "a:race_airhorn"];
/** highway UI sounds: police-radio clicks, a siren whoop on big buttons, a horn on back */
const HIGHWAY_SFX: Partial<Record<Sound, [Sound, number, number]>> = {
  pop: ["a:race_radio", 0.7, 1.1], swoosh: ["a:race_nearMiss", 0.5, 1.2], "a:click": ["a:race_radio", 0.55, 1.35],
  "a:whooshIn": ["a:race_yelp", 1.0, 1.0], "a:blip": ["a:race_radio", 0.4, 1.6],
};
export const HIGHWAY_UI_SOUNDS: Sound[] = ["a:race_radio", "a:race_yelp", "a:race_nearMiss", "a:race_siren", "a:race_horn"];
/** paddock UI sounds: gear-lever clicks and a bike rev blip on the big buttons */
const MOTO_SFX: Partial<Record<Sound, [Sound, number, number]>> = {
  pop: ["a:race_shift", 0.6, 1.5], swoosh: ["a:race_nearMiss", 0.45, 1.5], "a:click": ["a:race_shift", 0.45, 1.8],
  "a:whooshIn": ["a:race_rev", 0.9, 1.0], "a:blip": ["a:race_beep", 0.35, 1.8],
};
export const MOTO_UI_SOUNDS: Sound[] = ["a:race_shift", "a:race_nearMiss", "a:race_rev", "a:race_beep"];
export const sfx = (name: Sound, gain = 0.32, rate = 1, delay = 0) => {
  const st = isStreet() ? STREET_SFX[name] : isHighway() ? HIGHWAY_SFX[name] : isMoto() ? MOTO_SFX[name] : undefined;
  return st ? audio.play(st[0], { gain: gain * st[1], rate: rate * st[2], delay, duck: false }) : audio.play(name, { gain, rate, delay, duck: false });
};

// ------------------------------------------------------------------ environment hooks
const noopSub = () => () => {};
const vpSub = (cb: () => void) => {
  window.addEventListener("resize", cb); window.addEventListener("orientationchange", cb);
  return () => { window.removeEventListener("resize", cb); window.removeEventListener("orientationchange", cb); };
};
const vpSnap = () => `${window.innerWidth}x${window.innerHeight}`;
export interface Viewport { w: number; h: number; portrait: boolean; short: boolean; narrow: boolean; wide: boolean }
export function useViewport(): Viewport {
  const k = useSyncExternalStore(vpSub, vpSnap, () => "390x844");
  return useMemo(() => {
    const [w, h] = k.split("x").map(Number);
    return { w, h, portrait: h >= w, short: h < 520, narrow: w < 400, wide: w >= 1024 && h >= 600 };
  }, [k]);
}
export const isTouchDevice = () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0);
export const useIsTouch = () => useSyncExternalStore(noopSub, isTouchDevice, () => true);
export const isAutomation = () => typeof navigator !== "undefined" && Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver);

export function vibrate(on: boolean, pattern: number | number[]) {
  if (!on || typeof navigator === "undefined" || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch { /* not allowed */ }
}

/** animated number (count-up) */
export function useCountUp(target: number, duration = 1.1, delay = 0, onTick?: () => void) {
  const [v, setV] = useState(0);
  const last = useRef(0);
  useEffect(() => {
    const ctl = animate(0, target, {
      duration, delay, ease: "easeOut",
      onUpdate: (x) => { const r = Math.round(x); setV(r); if (onTick && r !== last.current && r % Math.max(1, Math.round(target / 12)) === 0) onTick(); last.current = r; },
    });
    return () => ctl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, delay]);
  return v;
}

// ------------------------------------------------------------------ CSS (keyframes the screens share)
export const NR_CSS = `
@keyframes nr-stripes { from { background-position: 0 0; } to { background-position: 240px 0; } }
@keyframes nr-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 60%,100% { transform: translateX(220%) skewX(-20deg); } }
@keyframes nr-spin { to { transform: rotate(360deg); } }
@keyframes nr-glow { 0%,100% { filter: drop-shadow(0 0 6px var(--g,#7CF2FF)); } 50% { filter: drop-shadow(0 0 16px var(--g,#7CF2FF)); } }
@keyframes nr-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes nr-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes nr-zoom { from { transform: scale(1); opacity: .9; } to { transform: scale(1.18); opacity: 0; } }
@keyframes nr-streak { from { transform: translateX(-30vw); } to { transform: translateX(130vw); } }
@keyframes nr-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes nr-textshine { 0% { background-position: 160% 0, 0 0; } 55%,100% { background-position: -80% 0, 0 0; } }
.nr-noselect, .nr-noselect * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.nr-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.nr-scroll::-webkit-scrollbar { display: none; }
.nr-shine { position: relative; overflow: hidden; }
.nr-shine::after { content: ""; position: absolute; inset: -20% auto -20% 0; width: 35%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); animation: nr-shine 3.2s ease-in-out infinite; pointer-events: none; }
.nr-italic { font-style: italic; }
@keyframes nr-smoke { 0% { transform: translate3d(-10%, 0, 0) scale(1); opacity: 0; } 15% { opacity: .55; } 100% { transform: translate3d(60%, -8%, 0) scale(1.9); opacity: 0; } }
@keyframes nr-scan { from { background-position: 0 0; } to { background-position: 0 6px; } }
@keyframes nr-neon { 0%,100% { opacity: 1; } 47% { opacity: 1; } 48% { opacity: .55; } 50% { opacity: 1; } 78% { opacity: .85; } }
.nr-street { --font-display: var(--font-drift), "Russo One", system-ui, sans-serif; }
.nr-street .nr-italic { font-style: oblique 9deg; }
.nr-highway { --font-display: var(--font-highway), "Overpass", system-ui, sans-serif; }
.nr-highway .font-display { font-weight: 900; letter-spacing: 0.01em; }
.nr-highway .nr-italic { font-style: italic; }
.nr-moto { --font-display: var(--font-moto), "Saira", system-ui, sans-serif; }
.nr-moto .font-display { font-weight: 900; font-style: italic; letter-spacing: 0.01em; }
.nr-carbon { background-color: #141518; background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.045) 0 3px, transparent 3px 6px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.35) 0 3px, transparent 3px 6px); }
@keyframes nr-flag { 0%,100% { transform: skewY(-4deg) translateY(0); } 50% { transform: skewY(3deg) translateY(4px); } }
@keyframes nr-police { 0%,45% { opacity: 1; } 50%,100% { opacity: 0.15; } }
@keyframes nr-dash { from { background-position: 0 0; } to { background-position: 0 120px; } }
@keyframes nr-lamp { from { transform: translateY(-20vh) scale(.6); opacity: 0; } 20% { opacity: 1; } to { transform: translateY(70vh) scale(1.6); opacity: 0; } }
`;

// ------------------------------------------------------------------ buttons
export type Tone = "gold" | "blue" | "pink" | "green" | "ghost" | "dark" | "red" | "purple";
const TONES: Record<Tone, string> = {
  gold: "bg-[linear-gradient(180deg,#FFF3B0_0%,#FFD25A_38%,#FF9F1C_100%)] text-[#2a1600] shadow-[0_5px_0_#a65a00,0_12px_26px_rgba(255,160,30,0.35)]",
  blue: "bg-[linear-gradient(180deg,#C9FBFF_0%,#5FD8FF_40%,#2E6BFF_100%)] text-[#06122e] shadow-[0_5px_0_#1a3fa0,0_12px_26px_rgba(46,120,255,0.35)]",
  pink: "bg-[linear-gradient(180deg,#FFD3F2_0%,#FF7BE0_40%,#D21FB0_100%)] text-[#2a0420] shadow-[0_5px_0_#86176f,0_12px_26px_rgba(255,79,216,0.3)]",
  green: "bg-[linear-gradient(180deg,#D3FFE5_0%,#5CE39A_40%,#16A35A_100%)] text-[#03230f] shadow-[0_5px_0_#0b6a39,0_12px_26px_rgba(30,200,110,0.3)]",
  red: "bg-[linear-gradient(180deg,#FFD0D6_0%,#FF6B7E_40%,#D61F3A_100%)] text-white shadow-[0_5px_0_#8a1023]",
  purple: "bg-[linear-gradient(180deg,#E6D4FF_0%,#A57BFF_40%,#5B2BD9_100%)] text-white shadow-[0_5px_0_#3a1a8f]",
  ghost: "bg-white/10 text-white ring-1 ring-white/20 shadow-[0_4px_0_rgba(0,0,0,0.35)] backdrop-blur-md",
  dark: "bg-[#120a28]/85 text-white ring-1 ring-white/15 shadow-[0_4px_0_rgba(0,0,0,0.45)] backdrop-blur-md",
};
/** street skin: flat matte-black or neon panels with hard edges and a glow, slanted like a racing livery */
const STREET_TONES: Record<Tone, string> = {
  gold: "bg-[linear-gradient(100deg,#FF1F7A_0%,#FF3D8F_55%,#FF6FB0_100%)] text-white shadow-[inset_0_0_0_2px_rgba(255,190,220,0.55),0_6px_24px_rgba(255,31,122,0.5)] [text-shadow:0_2px_0_rgba(80,0,30,0.6)]",
  blue: "bg-[#071419]/90 text-[#2EF2FF] shadow-[inset_0_0_0_2px_#2EF2FF,0_0_18px_rgba(46,242,255,0.35)] backdrop-blur-md",
  pink: "bg-[repeating-linear-gradient(135deg,#FFE14D_0_12px,#F2BF00_12px_24px)] text-[#111] shadow-[inset_0_0_0_2px_#111,0_6px_20px_rgba(255,225,77,0.3)]",
  green: "bg-[#07140b]/90 text-[#7CFF6B] shadow-[inset_0_0_0_2px_#7CFF6B,0_0_14px_rgba(124,255,107,0.3)]",
  red: "bg-[#19070b]/90 text-[#FF4D5E] shadow-[inset_0_0_0_2px_#FF4D5E,0_0_14px_rgba(255,77,94,0.3)]",
  purple: "bg-[#100b1d]/90 text-[#B98CFF] shadow-[inset_0_0_0_2px_#B98CFF]",
  ghost: "bg-white/[0.06] text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.35)] backdrop-blur-md",
  dark: "bg-[#0b0b10]/90 text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.16)] backdrop-blur-md",
};
/** highway skin: real road-sign panels — a coloured face, a white border inset from the edge, a hard shadow */
const HIGHWAY_TONES: Record<Tone, string> = {
  gold: "bg-[#FFC600] text-[#111] shadow-[inset_0_0_0_3px_#FFC600,inset_0_0_0_5.5px_#111,0_5px_0_#7a5c00]",
  blue: "bg-[#0B6E4F] text-white shadow-[inset_0_0_0_3px_#0B6E4F,inset_0_0_0_5.5px_#fff,0_5px_0_#04382a]",
  pink: "bg-[#1E4FD8] text-white shadow-[inset_0_0_0_3px_#1E4FD8,inset_0_0_0_5.5px_#fff,0_5px_0_#0b2470]",
  green: "bg-[#0B6E4F] text-white shadow-[inset_0_0_0_3px_#0B6E4F,inset_0_0_0_5.5px_#fff,0_5px_0_#04382a]",
  red: "bg-[#C8102E] text-white shadow-[inset_0_0_0_3px_#C8102E,inset_0_0_0_5.5px_#fff,0_5px_0_#5e0614]",
  purple: "bg-[#1E4FD8] text-white shadow-[inset_0_0_0_3px_#1E4FD8,inset_0_0_0_5.5px_#fff,0_5px_0_#0b2470]",
  ghost: "bg-black/35 text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.65)] backdrop-blur-md",
  dark: "bg-[#1b1e23]/90 text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.3),0_4px_0_rgba(0,0,0,0.5)] backdrop-blur-md",
};
/** moto skin: race-number plates — slanted, hard-edged, a dark lip underneath */
const MOTO_TONES: Record<Tone, string> = {
  gold: "bg-[#E10600] text-white shadow-[inset_0_-4px_0_rgba(0,0,0,0.28),0_5px_0_#6b0300,0_10px_22px_rgba(225,6,0,0.35)]",
  blue: "bg-[#F5F5F7] text-[#121316] shadow-[inset_7px_0_0_#E10600,inset_0_-4px_0_rgba(0,0,0,0.12),0_5px_0_#9aa0aa]",
  pink: "bg-[#FFD400] text-[#121316] shadow-[inset_0_0_0_2px_#121316,inset_0_-4px_0_rgba(0,0,0,0.15),0_5px_0_#8a7200]",
  green: "bg-[#F5F5F7] text-[#121316] shadow-[inset_7px_0_0_#1E9C4F,0_5px_0_#9aa0aa]",
  red: "bg-[#E10600] text-white shadow-[0_5px_0_#6b0300]",
  purple: "bg-[#F5F5F7] text-[#121316] shadow-[inset_7px_0_0_#121316,0_5px_0_#9aa0aa]",
  ghost: "bg-white/10 text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.45)] backdrop-blur-md",
  dark: "nr-carbon text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.18),0_4px_0_#000]",
};
export function Btn({ children, onClick, tone = "gold", className = "", disabled, sound = "pop", label, size = "md" }: {
  children: ReactNode; onClick?: () => void; tone?: Tone; className?: string; disabled?: boolean; sound?: Sound | null; label?: string; size?: "sm" | "md" | "lg" | "xl";
}) {
  const street = isStreet(), hw = isHighway(), moto = isMoto();
  const sz = moto
    ? { sm: "min-h-11 px-3 text-sm rounded-[4px]", md: "min-h-12 px-4 text-base rounded-[5px]", lg: "min-h-14 px-5 text-lg rounded-[6px]", xl: "min-h-16 px-6 text-xl rounded-[6px]" }[size]
    : hw
    ? { sm: "min-h-11 px-3 text-sm rounded-lg", md: "min-h-12 px-4 text-base rounded-lg", lg: "min-h-14 px-5 text-lg rounded-xl", xl: "min-h-16 px-6 text-xl rounded-xl" }[size]
    : street
    ? { sm: "min-h-11 px-3 text-sm rounded-md", md: "min-h-12 px-4 text-[15px] rounded-md", lg: "min-h-14 px-5 text-[17px] rounded-lg", xl: "min-h-16 px-6 text-[19px] rounded-lg" }[size]
    : { sm: "min-h-11 px-3 text-sm rounded-xl", md: "min-h-12 px-4 text-base rounded-2xl", lg: "min-h-14 px-5 text-lg rounded-2xl", xl: "min-h-16 px-6 text-xl rounded-[1.4rem]" }[size];
  return (
    <button type="button" aria-label={label} disabled={disabled}
      onClick={() => { if (sound) sfx(sound, 0.3); onClick?.(); }}
      className={`group relative isolate inline-flex items-center justify-center gap-2 overflow-hidden font-display whitespace-nowrap transition-[transform,box-shadow,filter] duration-100 disabled:pointer-events-none disabled:opacity-40 disabled:saturate-50 ${street ? "-skew-x-[9deg] uppercase tracking-[0.06em] active:scale-[0.97] active:brightness-125" : moto ? "-skew-x-[12deg] uppercase active:translate-y-[3px] active:shadow-none" : "tracking-wide active:translate-y-[3px] active:shadow-none"} ${sz} ${street ? STREET_TONES[tone] : hw ? HIGHWAY_TONES[tone] : moto ? MOTO_TONES[tone] : TONES[tone]} ${className}`}>
      {hw || moto ? null : street
        ? <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[2px] bg-white/45" />
        : <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 rounded-t-[inherit] bg-gradient-to-b from-white/35 to-white/0" />}
      {street ? <span className="inline-flex skew-x-[9deg] items-center gap-2">{children}</span> : moto ? <span className="inline-flex skew-x-[12deg] items-center gap-2">{children}</span> : children}
    </button>
  );
}

export function IconBtn({ children, onClick, label, className = "", disabled }: { children: ReactNode; onClick?: () => void; label: string; className?: string; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={() => { sfx("pop", 0.22); onClick?.(); }}
      className={`grid size-11 shrink-0 place-items-center text-white backdrop-blur-md transition active:scale-90 disabled:opacity-30 ${isStreet() ? "rounded-md bg-[#0b0b10]/85 shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.3)]" : isHighway() ? "rounded-lg bg-[#0B6E4F] shadow-[inset_0_0_0_2px_#0B6E4F,inset_0_0_0_4px_#fff]" : isMoto() ? "nr-carbon rounded-[5px] shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.25)]" : "rounded-2xl bg-white/10 ring-1 ring-white/20"} ${className}`}>
      {children}
    </button>
  );
}

export function Stars({ n, size = 16, className = "" }: { n: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => <Star key={i} style={{ width: size, height: size }} className={i < n ? "fill-[#FFD25A] text-[#FFB000] drop-shadow-[0_0_4px_rgba(255,210,90,0.6)]" : "fill-black/30 text-white/25"} />)}
    </span>
  );
}

export function Chip({ on, onClick, children, className = "", disabled, label }: { on: boolean; onClick: () => void; children: ReactNode; className?: string; disabled?: boolean; label?: string }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} disabled={disabled} onClick={() => { sfx("a:click", 0.35); onClick(); }}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 font-display text-[15px] whitespace-nowrap transition active:scale-95 disabled:opacity-35 ${on ? "bg-[linear-gradient(180deg,#FFF3B0,#FFD25A_45%,#FFAA1C)] text-[#2a1600] shadow-[0_3px_0_#a65a00] ring-2 ring-white/70" : "bg-white/[0.08] text-white/90 ring-1 ring-white/15"} ${className}`}>
      {children}
    </button>
  );
}

/** segmented control (fills its row) */
export function Seg<T extends string | number>({ value, options, onChange, className = "" }: { value: T; options: { v: T; label: ReactNode; sub?: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`flex gap-1 rounded-2xl bg-black/30 p-1 ring-1 ring-white/10 ${className}`} role="radiogroup">
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} onClick={() => { sfx("a:click", 0.35); onChange(o.v); }}
          className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1.5 font-display text-[14px] leading-tight transition active:scale-95 ${value === o.v ? "bg-[linear-gradient(180deg,#FFF3B0,#FFD25A_45%,#FFAA1C)] text-[#2a1600] shadow-[0_2px_0_#a65a00]" : "text-white/80"}`}>
          <span className="max-w-full truncate">{o.label}</span>
          {o.sub && <span className={`max-w-full truncate font-sans text-[10px] font-semibold ${value === o.v ? "text-[#2a1600]/70" : "text-white/45"}`}>{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => { sfx("a:click", 0.35); onChange(!on); }} className="grid min-h-12 min-w-14 shrink-0 place-items-center">
      <span className={`relative h-8 w-14 rounded-full ring-1 transition-colors ${on ? "bg-[#2FD47A] ring-white/40" : "bg-white/12 ring-white/20"}`}>
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow-md transition-[left] duration-150 ${on ? "left-7" : "left-1"}`} />
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ stat bars
export function StatBar({ label, value, compare, max = 12.5, pips, color = "from-[#4FD1FF] to-[#7CF2FF]" }: { label: string; value: number; compare?: number; max?: number; pips?: number; color?: string }) {
  const pct = Math.max(3, Math.min(100, (value / max) * 100));
  const cmp = compare != null ? Math.max(0, Math.min(100, (compare / max) * 100)) : null;
  const delta = compare != null ? value - compare : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-[5.6rem] shrink-0 truncate text-[12px] font-bold tracking-wide text-white/70 uppercase">{label}</span>
      <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
        <motion.div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${color}`} initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 160, damping: 22 }} />
        {cmp != null && Math.abs(delta) > 0.05 && <span className="absolute inset-y-0 w-[3px] rounded-full bg-white shadow-[0_0_6px_white]" style={{ left: `calc(${cmp}% - 1.5px)` }} />}
        <span className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_calc(10%-2px),rgba(0,0,0,0.35)_calc(10%-2px)_10%)]" />
      </div>
      <span className="w-9 shrink-0 text-right font-display text-sm tabular-nums">{value.toFixed(1)}</span>
      {compare != null && (
        <span className={`w-10 shrink-0 text-right font-display text-xs tabular-nums ${Math.abs(delta) < 0.05 ? "text-white/35" : delta > 0 ? "text-[#5CE39A]" : "text-[#FF6B7E]"}`}>
          {Math.abs(delta) < 0.05 ? "=" : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}`}
        </span>
      )}
      {pips != null && <span className="sr-only">upgrade level {pips}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ screen chrome
/** top app bar for sub-screens (site chrome is hidden there; the player's pause button sits top-right) */
export function AppBar({ title, sub, onBack, right, coins = true }: { title: string; sub?: string; onBack: () => void; right?: ReactNode; coins?: boolean }) {
  return (
    <div className="relative z-20 flex shrink-0 items-center gap-2.5"
      style={{ paddingTop: "calc(var(--safe-top) + 0.5rem)", paddingLeft: "calc(var(--safe-left, 0px) + 0.6rem)", paddingRight: "calc(var(--safe-right, 0px) + 0.6rem + 52px)" }}>
      <button type="button" aria-label="Back" onClick={() => { sfx("swoosh", 0.25); onBack(); }}
        className={`grid size-11 shrink-0 place-items-center text-white backdrop-blur-md transition active:scale-90 ${isStreet() ? "rounded-md bg-[#0b0b10]/85 shadow-[inset_0_0_0_1.5px_#FF1F7A,0_0_12px_rgba(255,31,122,0.35)]" : isHighway() ? "rounded-lg bg-[#0B6E4F] shadow-[inset_0_0_0_2px_#0B6E4F,inset_0_0_0_4px_#fff,0_3px_0_#04382a]" : isMoto() ? "rounded-[5px] bg-[#F5F5F7] text-[#121316] shadow-[inset_5px_0_0_#E10600,0_3px_0_#9aa0aa]" : "rounded-2xl bg-white/12 ring-1 ring-white/25"}`}>
        <ArrowLeft className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        {isStreet() ? (
          <h2 className="truncate font-display text-[clamp(1.15rem,5vw,1.8rem)] leading-none tracking-[0.04em] text-white uppercase">
            <span className="mr-1.5 inline-block h-[0.8em] w-1.5 -skew-x-[14deg] bg-[#FF1F7A] align-[-0.05em] shadow-[0_0_10px_#FF1F7A]" />{title}
          </h2>
        ) : isMoto() ? (
          <h2 className="truncate font-display text-[clamp(1.2rem,5.2vw,1.95rem)] leading-none text-white uppercase drop-shadow-[3px_3px_0_#E10600]">{title}</h2>
        ) : isHighway() ? (
          <h2 className="flex min-w-0 items-center gap-2 truncate font-display text-[clamp(1.2rem,5vw,1.9rem)] leading-none text-white">
            <span className="grid h-[1.05em] shrink-0 place-items-center rounded-[5px] bg-[#FFC600] px-1 text-[0.55em] text-[#111] shadow-[inset_0_0_0_1.5px_#111]">HH</span><span className="truncate">{title}</span>
          </h2>
        ) : <h2 className="nr-italic truncate font-display text-[clamp(1.3rem,5.4vw,2rem)] leading-none text-white drop-shadow-[0_3px_0_rgba(10,4,30,0.9)]">{title}</h2>}
        {sub && <p className={`mt-0.5 truncate text-[11px] font-bold tracking-[0.18em] uppercase ${isStreet() ? "text-[#2EF2FF]" : isHighway() ? "text-[#FFC600]" : isMoto() ? "text-[#FFD400]" : "text-[#7CF2FF]"}`}>{sub}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}{coins && <CoinPill href={null} compact />}</div>
    </div>
  );
}

export const screenVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 44 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -32 }),
};

/** bottom sheet on phones (portrait), centred dialog on wider screens */
export function Sheet({ open, onClose, children, label, wide = false }: { open: boolean; onClose: () => void; children: ReactNode; label: string; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] flex items-end justify-center bg-[#05020c]/70 backdrop-blur-sm landscape:items-center" onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
            initial={{ y: 80, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className={`nr-scroll relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-[linear-gradient(180deg,#24124d,#120a28)] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/15 landscape:max-h-[94dvh] landscape:rounded-[1.75rem] ${wide ? "landscape:max-w-[min(48rem,calc(100vw-8.5rem))]" : "landscape:max-w-[min(32rem,calc(100vw-8.5rem))]"} sm:max-w-lg`}
            style={{ paddingBottom: "calc(var(--safe-bottom) + 0.75rem)" }}>
            <button type="button" aria-label="Close" onClick={onClose} className="absolute top-2.5 right-2.5 z-10 grid size-11 place-items-center rounded-full bg-black/35 text-white ring-1 ring-white/15 active:scale-90"><X className="size-5" /></button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------ car thumbnails
export const CarThumb = memo(function CarThumb({ spec, color, locked = false, className = "" }: { spec: CarSpec; color: string; locked?: boolean; className?: string }) {
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  const key = `${spec.id}|${locked ? "x" : color}`;
  const hit = cachedThumb(spec, color, locked);
  useEffect(() => {
    if (cachedThumb(spec, color, locked) != null) return;
    let alive = true;
    void carThumb(spec, color, locked).then((url) => { if (alive) setLoaded({ key, url }); });
    return () => { alive = false; };
  }, [spec, color, locked, key]);
  const url = hit ?? (loaded?.key === key ? loaded.url : null);
  return (
    <span className={`relative block ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" draggable={false} className="size-full object-contain" />
      ) : (
        <span className="absolute inset-[22%_12%] animate-pulse rounded-[40%_40%_18%_18%] bg-white/10" />
      )}
      {locked && <span className="absolute inset-0 grid place-items-center"><Lock className="size-5 text-white/80 drop-shadow" /></span>}
    </span>
  );
});

// ------------------------------------------------------------------ track outlines (for previews)
const hashStr = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const trackCache = new Map<string, { path: string; length: number; start: [number, number]; dir: [number, number] }>();
/** same seed recipe as RaceSession, so the preview matches the real layout */
export function trackInfo(themeId: string, variant: number, reverse: boolean) {
  const key = `${themeId}:${variant}:${reverse ? 1 : 0}`;
  let v = trackCache.get(key);
  if (!v) {
    const t = getTheme(themeId), tt = t.track;
    const tr = new Track({ seed: hashStr(`${t.id}:${variant}`), width: tt.width, curviness: tt.curviness, hills: tt.hills, size: tt.size, reverse });
    const o = tr.outline(120);
    const path = o.map(([x, y], i) => `${i ? "L" : "M"}${(x * 100).toFixed(1)} ${(y * 100).toFixed(1)}`).join(" ") + " Z";
    const a = o[0], b = o[3];
    v = { path, length: tr.length, start: [a[0] * 100, a[1] * 100], dir: [b[0] - a[0], b[1] - a[1]] };
    trackCache.set(key, v);
  }
  return v;
}
export const TrackPath = memo(function TrackPath({ themeId, variant, reverse, color = "#fff", className = "" }: { themeId: string; variant: number; reverse: boolean; color?: string; className?: string }) {
  const info = useMemo(() => { try { return trackInfo(themeId, variant, reverse); } catch { return null; } }, [themeId, variant, reverse]);
  if (!info) return null;
  const ang = Math.atan2(info.dir[1], info.dir[0]) * 180 / Math.PI;
  return (
    <svg viewBox="-8 -8 116 116" className={className} aria-hidden>
      <path d={info.path} fill="none" stroke="rgba(5,2,12,0.7)" strokeWidth={9} strokeLinejoin="round" />
      <path d={info.path} fill="none" stroke={color} strokeWidth={4.5} strokeLinejoin="round" />
      <g transform={`translate(${info.start[0]} ${info.start[1]}) rotate(${ang})`}>
        <rect x={-2} y={-6} width={4} height={12} fill="#14102a" />
        <rect x={-2} y={-6} width={2} height={3} fill="#fff" /><rect x={0} y={-3} width={2} height={3} fill="#fff" /><rect x={-2} y={0} width={2} height={3} fill="#fff" /><rect x={0} y={3} width={2} height={3} fill="#fff" />
        <path d="M6 -5 L13 0 L6 5 Z" fill="#FFD25A" stroke="#14102a" strokeWidth={1} />
      </g>
    </svg>
  );
});

/** animated speed-stripe backdrop used behind menus (street skin: night asphalt, tyre marks, neon and smoke) */
export function Backdrop({ accent = "#7C3AED", accent2 = "#FF4FD8" }: { accent?: string; accent2?: string }) {
  if (isStreet()) return <StreetBackdrop accent={accent} />;
  if (isHighway()) return <HighwayBackdrop />;
  if (isMoto()) return <MotoBackdrop />;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 80% at 70% 10%, ${accent}66 0%, transparent 55%), radial-gradient(90% 70% at 0% 100%, ${accent2}40 0%, transparent 60%), linear-gradient(180deg, #1b0d3d 0%, #0d0722 60%, #07040f 100%)` }} />
      <div className="absolute inset-0 opacity-60" style={{ background: "repeating-linear-gradient(110deg, rgba(124,242,255,0.06) 0 2px, transparent 2px 24px, rgba(255,79,216,0.05) 24px 26px, transparent 26px 60px)", animation: "nr-stripes 6s linear infinite" }} />
      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: "linear-gradient(180deg, transparent, rgba(5,2,12,0.6))" }} />
      {[18, 46, 72].map((top, i) => (
        <span key={top} className="absolute h-[2px] w-[22vw] rounded-full" style={{ top: `${top}%`, background: "linear-gradient(90deg, transparent, rgba(124,242,255,0.7), transparent)", animation: `nr-streak ${2.6 + i * 0.9}s linear ${i * 0.7}s infinite` }} />
      ))}
    </div>
  );
}

function StreetBackdrop({ accent }: { accent: string }) {
  const tint = accent === "#7C3AED" ? "#FF1F7A" : accent;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: `radial-gradient(80% 55% at 85% 0%, ${tint}38 0%, transparent 60%), radial-gradient(70% 50% at 0% 100%, #2EF2FF22 0%, transparent 60%), linear-gradient(180deg, #121219 0%, #0a0a0f 55%, #050507 100%)` }} />
      {/* asphalt grain */}
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1.2px), radial-gradient(rgba(0,0,0,0.5) 1px, transparent 1.4px)", backgroundSize: "5px 5px, 7px 7px", backgroundPosition: "0 0, 2px 3px" }} />
      {/* tyre marks from a big slide */}
      <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
        {[0, 3.2].map((o) => <path key={o} d={`M-10 ${82 + o} C 25 ${70 + o}, 40 ${40 + o}, 70 ${36 + o} S 110 ${44 + o}, 120 ${30 + o}`} fill="none" stroke="rgba(0,0,0,0.75)" strokeWidth={1.6} />)}
        {[0, 3.2].map((o) => <path key={`b${o}`} d={`M-10 ${30 + o} C 20 ${22 + o}, 45 ${18 + o}, 60 ${6 + o}`} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth={1.2} />)}
      </svg>
      {/* drifting tyre smoke */}
      {[{ t: 58, l: -10, s: 46, d: 11 }, { t: 22, l: 10, s: 34, d: 14 }, { t: 70, l: 30, s: 30, d: 9 }].map((m, i) => (
        <span key={i} className="absolute rounded-full" style={{ top: `${m.t}%`, left: `${m.l}%`, width: `${m.s}vmax`, height: `${m.s * 0.55}vmax`, background: "radial-gradient(closest-side, rgba(230,230,240,0.16), transparent)", filter: "blur(6px)", animation: `nr-smoke ${m.d}s linear ${i * 2.3}s infinite` }} />
      ))}
      {/* neon floor lines */}
      <div className="absolute inset-x-0 bottom-[14%] h-[2px]" style={{ background: "linear-gradient(90deg, transparent, #FF1F7A 20%, #FF1F7A 60%, transparent)", boxShadow: "0 0 14px #FF1F7A", animation: "nr-neon 5s linear infinite" }} />
      <div className="absolute inset-x-0 bottom-[11%] h-px" style={{ background: "linear-gradient(90deg, transparent 10%, #2EF2FF 45%, #2EF2FF 85%, transparent)", boxShadow: "0 0 12px #2EF2FF" }} />
      {/* scanlines */}
      <div className="absolute inset-0 opacity-[0.07]" style={{ background: "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px)", animation: "nr-scan 0.6s linear infinite" }} />
      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.65))" }} />
    </div>
  );
}

/** night highway: sodium lamps rushing past, a lit carriageway with moving lane dashes, police lights at the edges */
function HighwayBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "radial-gradient(90% 60% at 50% 105%, #FF9A2E33 0%, transparent 60%), linear-gradient(180deg, #0c1622 0%, #121a24 45%, #1b1f26 100%)" }} />
      {/* the road, in perspective */}
      <div className="absolute inset-x-0 bottom-0 h-[46%]" style={{ clipPath: "polygon(38% 0, 62% 0, 112% 100%, -12% 100%)", background: "linear-gradient(180deg, #2a2d33, #3a3d44)" }}>
        <div className="absolute inset-y-0 left-1/2 w-[2.2%] -translate-x-1/2" style={{ background: "repeating-linear-gradient(180deg, #F4F1E6 0 34px, transparent 34px 120px)", animation: "nr-dash 0.6s linear infinite" }} />
        <div className="absolute inset-y-0 left-[3%] w-[1.6%] bg-[#F2C230]/80" style={{ transform: "skewX(-38deg)", transformOrigin: "top" }} />
        <div className="absolute inset-y-0 right-[3%] w-[1.6%] bg-[#F2C230]/80" style={{ transform: "skewX(38deg)", transformOrigin: "top" }} />
      </div>
      {/* sodium lamps streaming past */}
      {[12, 88].map((x, i) => [0, 1, 2].map((k) => (
        <span key={`${i}${k}`} className="absolute size-3 rounded-full" style={{ left: `${x}%`, top: "40%", background: "#FFB45A", boxShadow: "0 0 18px 8px rgba(255,160,60,0.55)", animation: `nr-lamp 2.4s linear ${k * 0.8 + i * 0.4}s infinite` }} />
      )))}
      {/* police lights */}
      <div className="absolute -top-16 -left-16 size-64 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,42,58,0.55), transparent)", animation: "nr-police 0.9s steps(1) infinite" }} />
      <div className="absolute -top-16 -right-16 size-64 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(42,107,255,0.6), transparent)", animation: "nr-police 0.9s steps(1) 0.45s infinite" }} />
      <div className="absolute inset-x-0 bottom-0 h-1/4" style={{ background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.55))" }} />
    </div>
  );
}

/** paddock: carbon fibre, a red-and-white kerb band, a waving chequered flag and red speed streaks */
function MotoBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="nr-carbon absolute inset-0" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(80% 55% at 85% 0%, rgba(225,6,0,0.32), transparent 60%), radial-gradient(70% 50% at 0% 100%, rgba(255,212,0,0.12), transparent 60%)" }} />
      <div className="absolute -right-10 -top-6 h-28 w-56" style={{ backgroundImage: "repeating-conic-gradient(#F5F5F7 0 25%, #121316 0 50%)", backgroundSize: "28px 28px", opacity: 0.55, animation: "nr-flag 1.6s ease-in-out infinite", transformOrigin: "left" }} />
      <div className="absolute inset-x-[-10%] bottom-[9%] h-5 -rotate-3" style={{ background: "repeating-linear-gradient(90deg, #E10600 0 36px, #F5F5F7 36px 72px)", boxShadow: "0 4px 18px rgba(0,0,0,0.6)" }} />
      {[22, 48, 66].map((top, i) => (
        <span key={top} className="absolute h-[3px] w-[26vw] rounded-full" style={{ top: `${top}%`, background: "linear-gradient(90deg, transparent, rgba(225,6,0,0.75), transparent)", animation: `nr-streak ${2.2 + i * 0.7}s linear ${i * 0.5}s infinite` }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-1/4" style={{ background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.55))" }} />
    </div>
  );
}

export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  if (isMoto()) return <p className={`mb-1.5 flex items-center gap-1 font-display text-[12.5px] tracking-[0.14em] text-white/70 uppercase ${className}`}><span className="text-[#E10600]">»</span>{children}</p>;
  if (isHighway()) return <p className={`mb-1.5 flex items-center gap-1.5 font-display text-[12.5px] tracking-[0.14em] text-white/70 uppercase ${className}`}><span className="inline-block size-2.5 rotate-45 rounded-[2px] bg-[#FFC600] shadow-[inset_0_0_0_1px_#111]" />{children}</p>;
  return isStreet()
    ? <p className={`mb-1.5 flex items-center gap-1.5 font-display text-[12px] tracking-[0.22em] text-white/60 uppercase ${className}`}><span className="inline-block h-2.5 w-1 -skew-x-[14deg] bg-[#2EF2FF]" />{children}</p>
    : <p className={`mb-1.5 font-display text-[13px] tracking-[0.2em] text-white/55 uppercase ${className}`}>{children}</p>;
}

/** stars-needed lock pill */
export function LockPill({ need }: { need: number }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 font-display text-xs text-white ring-1 ring-white/20"><Lock className="size-3" /><Star className="size-3 fill-[#FFD25A] text-[#FFD25A]" />{need}</span>;
}
