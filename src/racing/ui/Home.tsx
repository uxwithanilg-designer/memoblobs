"use client";
// Title / home screen: animated logo, the player's car on the 3D podium, a big "continue career" card and
// the main menu — primary actions sit at the bottom (thumb zone) in portrait, on the left in landscape.
import { motion } from "motion/react";
import { Car, ChevronRight, Flag, Settings2, Star, Trophy, Wrench } from "lucide-react";
import { Showroom } from "./Showroom";
import { Btn, Stars, MODE_SHORT, isHighway, isMoto, isStreet, useViewport, sfx } from "./kit";
import { MODE_INFO, type CareerLevel } from "../levels";
import { activeGame, getTheme } from "../games";
import type { CarSpec } from "../types";
import { CoinIcon } from "@/components/brand/CoinPill";

export interface HomeProps {
  title: string; car: CarSpec; paint: string; stars: number; maxStars: number; carsOwned: number; carsTotal: number; newCars: number; wins: number;
  next: CareerLevel | null; nextStars: number;
  onCareer: () => void; onNext: () => void; onQuick: () => void; onCoinRush: () => void; onGarage: () => void; onSettings: () => void;
}

/** street skin: chrome lettering with a neon pink / cyan split, a crown and a slanted underline */
function StreetLogo({ title, compact }: { title: string; compact: boolean }) {
  return (
    <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="relative select-none">
      <p className="flex items-center gap-1.5 font-display text-[11px] tracking-[0.42em] text-[#FF1F7A] drop-shadow-[0_0_8px_rgba(255,31,122,0.8)] sm:text-xs">
        <span className="text-[14px] leading-none">👑</span>{activeGame().kicker}
      </p>
      <h1 className={`pb-[0.04em] font-display leading-[0.9] tracking-[0.02em] uppercase ${compact ? "text-[clamp(2rem,10vh,4.3rem)]" : "text-[clamp(2.5rem,12.5vw,6rem)]"}`}
        style={{ fontStyle: "oblique 10deg", backgroundImage: "linear-gradient(180deg,#FFFFFF 0%,#E4E8F0 42%,#7E8698 50%,#C9CFDA 62%,#FFFFFF 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          filter: "drop-shadow(-3px 0 0 #FF1F7A) drop-shadow(3px 0 0 #2EF2FF) drop-shadow(0 5px 0 #000) drop-shadow(0 0 18px rgba(255,31,122,0.35))", animation: "nr-neon 6s linear infinite" }}>
        {title}
      </h1>
      <div className="mt-1 flex items-center gap-1">
        <span className="h-1 w-16 -skew-x-[30deg] bg-[#FF1F7A] shadow-[0_0_10px_#FF1F7A]" />
        <span className="h-1 w-6 -skew-x-[30deg] bg-[#2EF2FF] shadow-[0_0_10px_#2EF2FF]" />
        <span className="h-1 w-3 -skew-x-[30deg] bg-white/70" />
      </div>
    </motion.div>
  );
}

/** highway skin: the first word on a green motorway sign, the rest in flames, a police light bar on top */
function HighwayLogo({ title, compact }: { title: string; compact: boolean }) {
  const [first, ...rest] = title.toUpperCase().split(" ");
  return (
    <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="relative inline-flex select-none flex-col items-center">
      <div className="mb-1 flex h-2.5 w-28 overflow-hidden rounded-full shadow-[0_0_14px_rgba(255,255,255,0.35)]">
        <span className="flex-1 bg-[#FF2A3A]" style={{ animation: "nr-police 0.7s steps(1) infinite" }} />
        <span className="flex-1 bg-[#2A6BFF]" style={{ animation: "nr-police 0.7s steps(1) 0.35s infinite" }} />
      </div>
      <p className="mb-1 font-display text-[10.5px] tracking-[0.3em] text-[#FFC600] sm:text-xs">{activeGame().kicker}</p>
      <span className={`rounded-xl bg-[#0B6E4F] px-4 pt-1 pb-0.5 font-display leading-none text-white shadow-[inset_0_0_0_3px_#0B6E4F,inset_0_0_0_6px_#fff,0_6px_0_#04382a] ${compact ? "text-[clamp(1.4rem,7vh,2.6rem)]" : "text-[clamp(1.8rem,9vw,3.6rem)]"}`}>{first}</span>
      <span className={`nr-italic -mt-1 font-display leading-[0.9] ${compact ? "text-[clamp(2.4rem,12vh,4.6rem)]" : "text-[clamp(3.2rem,16vw,6.4rem)]"}`}
        style={{ backgroundImage: "linear-gradient(180deg,#FFF4B0 0%,#FFC600 35%,#FF7A1A 70%,#C2152B 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "drop-shadow(0 4px 0 #111) drop-shadow(0 0 16px rgba(255,122,26,0.45))" }}>
        {rest.join(" ")}
      </span>
    </motion.div>
  );
}

/** paddock skin: white italic lettering with a red offset, the last word on a yellow race-number plate */
function MotoLogo({ title, compact }: { title: string; compact: boolean }) {
  const words = title.toUpperCase().split(" "), last = words.pop();
  return (
    <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="relative select-none">
      <p className="font-display text-[11px] tracking-[0.34em] text-[#E10600] sm:text-xs">{activeGame().kicker}</p>
      <h1 className={`flex items-center gap-[0.18em] font-display leading-[0.95] ${compact ? "text-[clamp(2rem,10vh,4.4rem)]" : "text-[clamp(2.4rem,12vw,6rem)]"}`}>
        <span className="text-[#F5F5F7]" style={{ textShadow: "0.06em 0.06em 0 #E10600, 0.1em 0.1em 0 #000" }}>{words.join(" ")}</span>
        <span className="-skew-x-[12deg] rounded-[0.2em] bg-[#FFD400] px-[0.18em] text-[#121316] shadow-[inset_0_0_0_0.06em_#121316,0.08em_0.08em_0_#E10600]">{last}</span>
      </h1>
      <div className="mt-1 h-2.5 w-40" style={{ backgroundImage: "repeating-conic-gradient(#F5F5F7 0 25%, #121316 0 50%)", backgroundSize: "10px 10px" }} />
    </motion.div>
  );
}

function Logo({ title, compact }: { title: string; compact: boolean }) {
  if (isStreet()) return <StreetLogo title={title} compact={compact} />;
  if (isMoto()) return <MotoLogo title={title} compact={compact} />;
  if (isHighway()) return <HighwayLogo title={title} compact={compact} />;
  const words = title.toUpperCase().split(" ");
  return (
    <motion.div initial={{ x: -60, opacity: 0, skewX: -12 }} animate={{ x: 0, opacity: 1, skewX: 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="relative select-none">
      <p className="font-display text-[11px] tracking-[0.42em] text-[#7CF2FF] drop-shadow-[0_0_8px_rgba(124,242,255,0.7)] sm:text-xs">{activeGame().kicker}</p>
      <h1 className={`nr-italic pr-[0.14em] pb-[0.06em] font-display leading-[0.82] ${compact ? "text-[clamp(2.1rem,10.5vh,4.6rem)]" : "text-[clamp(2.7rem,13.5vw,6.5rem)]"}`}>
        {words.map((w, i) => (
          <span key={i} className="mr-[0.18em] inline-block bg-clip-text text-transparent last:mr-0"
            style={{
              backgroundImage: `linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.85) 50%, transparent 58%), ${i === 0 ? "linear-gradient(180deg,#FFFDE8 0%,#FFE066 40%,#FF9A1F 72%,#FF5A1F 100%)" : "linear-gradient(180deg,#E8FDFF 0%,#7CF2FF 45%,#2E86FF 100%)"}`,
              backgroundSize: "250% 100%, 100% 100%", backgroundRepeat: "no-repeat", WebkitBackgroundClip: "text", animation: `nr-textshine 4s ease-in-out ${i * 0.25}s infinite`,
              filter: "drop-shadow(0 4px 0 #1a0838) drop-shadow(0 0 18px rgba(255,140,40,0.35))",
            }}>
            {w}
          </span>
        ))}
      </h1>
    </motion.div>
  );
}

export function Home(p: HomeProps) {
  const vp = useViewport();
  const street = isStreet(), hw = isHighway(), mo = isMoto();
  const land = !vp.portrait;
  const nextTheme = p.next ? getTheme(p.next.themeId) : null;

  const chips = (
    <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
      <span className="flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 ring-1 ring-white/15"><Star className="size-3.5 fill-[#FFD25A] text-[#FFD25A]" />{p.stars}<span className="text-white/45">/{p.maxStars}</span></span>
      <span className="flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 ring-1 ring-white/15"><Car className="size-3.5 text-[#7CF2FF]" />{p.carsOwned}<span className="text-white/45">/{p.carsTotal}</span></span>
      <span className="flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 ring-1 ring-white/15"><Trophy className="size-3.5 text-[#FFB000]" />{p.wins}</span>
    </div>
  );

  const careerCard = (
    <motion.button type="button" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12, type: "spring", stiffness: 300, damping: 26 }}
      onClick={() => { sfx("a:whooshIn", 0.35); if (p.next) p.onNext(); else p.onCareer(); }}
      className={mo
        ? "nr-shine nr-carbon group relative flex w-full -skew-x-[8deg] items-center gap-3 overflow-hidden rounded-[6px] p-2.5 pr-3 text-left text-white shadow-[inset_8px_0_0_#E10600,inset_0_0_0_1.5px_rgba(255,255,255,0.2),0_5px_0_#000] transition active:translate-y-[3px]"
        : hw
        ? "nr-shine group relative flex w-full items-center gap-3 overflow-hidden rounded-xl bg-[#0B6E4F] p-2.5 pr-3 text-left text-white shadow-[inset_0_0_0_3px_#0B6E4F,inset_0_0_0_6px_#fff,0_6px_0_#04382a] transition active:translate-y-[3px]"
        : street
        ? "nr-shine group relative flex w-full -skew-x-[6deg] items-center gap-3 overflow-hidden rounded-lg bg-[linear-gradient(100deg,#0c0c12_0%,#16161f_60%,#2a0a1a_100%)] p-2.5 pr-3 text-left text-white shadow-[inset_0_0_0_2px_#FF1F7A,0_0_26px_rgba(255,31,122,0.35)] transition active:scale-[0.98]"
        : "nr-shine group relative flex w-full items-center gap-3 overflow-hidden rounded-[1.4rem] bg-[linear-gradient(100deg,#FFF3B0_0%,#FFD25A_30%,#FF9F1C_75%,#FF6A1F_100%)] p-2.5 pr-3 text-left text-[#2a1600] shadow-[0_6px_0_#a65a00,0_16px_34px_rgba(255,150,30,0.35)] transition active:translate-y-[3px] active:shadow-none"}>
      <span className={`grid size-12 shrink-0 place-items-center text-2xl shadow-inner sm:size-14 ${mo ? "skew-x-[8deg] rounded-[5px] bg-[#FFD400] shadow-[inset_0_0_0_2px_#121316]" : hw ? "rounded-lg bg-[#FFC600] shadow-[inset_0_0_0_2px_#111]" : street ? "skew-x-[6deg] rounded-md bg-[#FF1F7A] shadow-[0_0_16px_rgba(255,31,122,0.6)]" : "rounded-2xl bg-[#2a1600]/85"}`}>{nextTheme?.emoji ?? "🏆"}</span>
      <span className={`min-w-0 flex-1 ${street ? "skew-x-[6deg]" : ""}`}>
        <span className={`nr-italic block font-display leading-none ${street ? "text-[20px] tracking-[0.08em] sm:text-[24px]" : "text-[22px] sm:text-[26px]"}`}>CAREER</span>
        <span className={`mt-0.5 block truncate text-[12.5px] font-bold ${mo ? "text-[#FFD400]" : hw ? "text-[#FFC600]" : street ? "text-[#2EF2FF]" : "text-[#2a1600]/80"}`}>
          {p.next ? <>{MODE_INFO[p.next.mode].icon} Next: {MODE_SHORT[p.next.mode]} · {nextTheme?.name}</> : "Every event cleared — go for 3 stars!"}
        </span>
      </span>
      {p.next && <span className="hidden shrink-0 min-[380px]:block"><Stars n={p.nextStars} size={13} /></span>}
      <span className={`grid size-10 shrink-0 place-items-center ${mo ? "skew-x-[8deg] rounded-[5px] bg-[#E10600] text-white" : hw ? "rounded-lg bg-white text-[#0B6E4F]" : street ? "skew-x-[6deg] rounded-md bg-[#FF1F7A] text-white" : "rounded-full bg-[#2a1600] text-[#FFD25A]"}`}><ChevronRight className="size-6" /></span>
    </motion.button>
  );

  const grid = (
    <div className="grid grid-cols-2 gap-2.5">
      <Btn tone="blue" size={land && vp.h < 420 ? "md" : "lg"} className="w-full" onClick={p.onQuick}><Flag className="size-5" />QUICK RACE</Btn>
      <Btn tone="pink" size={land && vp.h < 420 ? "md" : "lg"} className="w-full" onClick={p.onCoinRush}>{activeGame().feature.mode === "coinrush" ? <CoinIcon size={22} /> : <span className="text-lg leading-none">{MODE_INFO[activeGame().feature.mode].icon}</span>}{activeGame().feature.label}</Btn>
      <div className="relative">
        <Btn tone="dark" size={land && vp.h < 420 ? "md" : "lg"} className="w-full" onClick={p.onGarage}><Wrench className="size-5 text-[#7CF2FF]" />GARAGE</Btn>
        {p.newCars > 0 && <span className="pointer-events-none absolute -top-1.5 right-1 z-10 rounded-full bg-[#FF4FD8] px-1.5 font-display text-[10px] leading-4 text-white shadow">{p.newCars} NEW</span>}
      </div>
      <Btn tone="dark" size={land && vp.h < 420 ? "md" : "lg"} className="w-full" onClick={p.onSettings}><Settings2 className="size-5 text-[#7CF2FF]" />SETTINGS</Btn>
    </div>
  );

  const plate = (
    <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
      <span className="nr-italic flex items-center gap-2 rounded-full bg-[#0b0718]/75 px-3.5 py-1 font-display text-sm ring-1 ring-white/15 backdrop-blur-md">
        <span className="size-2.5 rounded-full" style={{ background: p.paint }} />{p.car.name}<span className="text-white/50">· {p.car.cls}</span>
      </span>
    </div>
  );

  if (land) {
    return (
      <div className="absolute inset-0">
        <div className="absolute inset-y-0 right-0 w-[60%]">
          <div className="absolute inset-x-0" style={{ top: "calc(var(--safe-top) + 52px)", bottom: "calc(var(--safe-bottom) + 0.4rem)" }}>
            <Showroom spec={p.car} color={p.paint} view="hero" className="absolute inset-0" />
            {plate}
          </div>
        </div>
        <div className="absolute inset-y-0 left-0 flex w-[min(46%,520px)] min-w-[300px] flex-col justify-between gap-2"
          style={{ paddingTop: "calc(var(--safe-top) + 60px)", paddingBottom: "calc(var(--safe-bottom) + 0.8rem)", paddingLeft: "calc(var(--safe-left, 0px) + 1rem)" }}>
          <div className="flex flex-col gap-2"><Logo title={p.title} compact />{chips}</div>
          <div className="flex flex-col gap-2.5">{careerCard}{grid}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col" style={{ paddingTop: "calc(var(--safe-top) + 62px)", paddingBottom: "calc(var(--safe-bottom) + 0.8rem)" }}>
      <div className="flex flex-col items-center gap-2 px-4 text-center">
        <Logo title={p.title} compact={false} />
        {chips}
      </div>
      <div className="relative min-h-[120px] flex-1">
        <Showroom spec={p.car} color={p.paint} view="hero" className="absolute inset-0" />
        {plate}
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-2.5 px-3.5 pt-2">{careerCard}{grid}</div>
    </div>
  );
}
