"use client";
// Garage: 3D turntable (drag to spin), car carousel with tier/class filters and NEW badges, stats compared
// with the car you drive now, paint, upgrades bought with coins, and the unlock requirement for locked cars.
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, ChevronRight, Lock, Paintbrush, Star, Trophy, Wrench, BarChart3 } from "lucide-react";
import { useProfile } from "@/lib/store";
import { Showroom } from "./Showroom";
import { AppBar, Btn, CarThumb, Chip, StatBar, sfx, useViewport } from "./kit";
import { activeGame, getCar } from "../games";
import { NO_UPGRADES, upgradeCost } from "../save";
import type { CarSpec, Upgrades } from "../types";
import { CoinIcon } from "@/components/brand/CoinPill";

const STAT: Record<keyof Upgrades, string> = { speed: "Top speed", accel: "Accel", handling: "Handling", nitro: "Nitro" };
type Tab = "stats" | "paint" | "upgrade";

interface GarageProps {
  viewId: string; setViewId: (id: string) => void;
  carId: string; selectCar: (id: string) => void;
  stars: number; seen: string[]; markSeen: (ids: string[]) => void;
  paints: Record<string, number>; setPaint: (id: string, i: number) => void;
  upgrades: Record<string, Upgrades>; upgrade: (id: string, k: keyof Upgrades) => void;
  onBack: () => void; onCareer: () => void;
}

export const isNewCar = (c: CarSpec, stars: number, seen: string[]) => c.unlockStars > 0 && c.unlockStars <= stars && !seen.includes(c.id);

export function Garage(p: GarageProps) {
  const CARS = activeGame().cars;
  const vp = useViewport();
  const land = !vp.portrait;
  const coins = useProfile((s) => s.coins);
  const [tier, setTier] = useState<number | "all" | "owned">("all");
  const [cls, setCls] = useState<string>("all");
  const [tab, setTab] = useState<Tab>("stats");
  const [flash, setFlash] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const classes = useMemo(() => [...new Set(CARS.map((c) => c.cls))], [CARS]);
  const open = (c: CarSpec) => c.unlockStars <= p.stars;
  const list = CARS.filter((c) => (tier === "all" ? true : tier === "owned" ? open(c) : c.tier === tier) && (cls === "all" || c.cls === cls));
  const car = getCar(p.viewId);
  const cur = getCar(p.carId);
  const locked = !open(car);
  const paintI = p.paints[car.id] ?? 0;
  const color = car.colors[paintI] ?? car.colors[0];
  const up = { ...NO_UPGRADES, ...p.upgrades[car.id] };
  const upCur = { ...NO_UPGRADES, ...p.upgrades[cur.id] };
  const owned = CARS.filter(open).length;

  const pick = (id: string) => {
    if (id === p.viewId) return;
    sfx("a:click", 0.32);
    p.setViewId(id);
    const c = getCar(id);
    if (open(c)) p.markSeen([id]);
    setTimeout(() => strip.current?.querySelector<HTMLElement>(`[data-car="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }), 30);
  };
  const step = (d: number) => {
    const arr = list.length ? list : CARS;
    const i = arr.findIndex((c) => c.id === p.viewId);
    const n = arr[(i + d + arr.length) % arr.length];
    if (n) pick(n.id);
  };
  const buy = (k: keyof Upgrades) => {
    const cost = upgradeCost(up[k], car.tier);
    if (up[k] >= 5) return;
    if (useProfile.getState().spendCoins(cost)) { p.upgrade(car.id, k); sfx("a:register", 0.45); sfx("a:levelup", 0.35, 1, 0.1); setFlash(k); setTimeout(() => setFlash(null), 700); }
    else sfx("a:fail", 0.3);
  };

  const stage = (
    <div className={`relative h-[34vh] overflow-hidden rounded-[1.6rem] ring-1 ring-white/12 ${land ? "!h-full" : "min-h-[220px]"}`}
      style={{ background: `radial-gradient(120% 90% at 50% 75%, ${locked ? "#2a2340" : "#3a2370"} 0%, #160c33 55%, #07040f 100%)` }}>
      <Showroom spec={car} color={color} locked={locked} className="absolute inset-0" />
      <div className="pointer-events-none absolute top-2.5 left-3 max-w-[70%]">
        <p className="nr-italic truncate font-display text-[clamp(1.25rem,5.4vw,2rem)] leading-none drop-shadow-[0_3px_0_rgba(10,4,30,0.9)]">{car.name}</p>
        <p className="mt-1 flex flex-wrap gap-1 text-[11px] font-bold">
          <span className="rounded-full bg-black/45 px-2 py-0.5">{car.cls}</span>
          <span className="rounded-full bg-black/45 px-2 py-0.5">Tier {car.tier}</span>
          {isNewCar(car, p.stars, p.seen) && <span className="rounded-full bg-[#FF4FD8] px-2 py-0.5">NEW</span>}
        </p>
      </div>
      {p.carId === car.id && <span className="pointer-events-none absolute top-2.5 right-3 flex items-center gap-1 rounded-full bg-[#2FD47A] px-2 py-0.5 font-display text-xs text-[#03230f]"><Check className="size-3.5" />DRIVING</span>}
      <button type="button" aria-label="Previous car" onClick={() => step(-1)} className="absolute top-1/2 left-1.5 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 ring-1 ring-white/20 backdrop-blur active:scale-90"><ChevronLeft className="size-6" /></button>
      <button type="button" aria-label="Next car" onClick={() => step(1)} className="absolute top-1/2 right-1.5 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 ring-1 ring-white/20 backdrop-blur active:scale-90"><ChevronRight className="size-6" /></button>
      {locked && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
          <span className="flex items-center gap-2 rounded-2xl bg-[#0b0718]/85 px-3.5 py-2 font-display ring-1 ring-white/20"><Lock className="size-5" />Unlock at <Star className="size-5 fill-[#FFD25A] text-[#FFD25A]" />{car.unlockStars}</span>
        </div>
      )}
      {!locked && <p className="pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-[10px] font-bold tracking-widest text-white/35 uppercase">drag to spin</p>}
    </div>
  );

  const filters = (
    <div className="nr-scroll -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
      <Chip on={tier === "all" && cls === "all"} onClick={() => { setTier("all"); setCls("all"); }}>All {CARS.length}</Chip>
      <Chip on={tier === "owned"} onClick={() => setTier(tier === "owned" ? "all" : "owned")}>Owned {owned}</Chip>
      {[1, 2, 3, 4, 5].map((t) => <Chip key={t} on={tier === t} onClick={() => setTier(tier === t ? "all" : t)}>T{t}</Chip>)}
      {classes.length > 1 && <span className="my-2 w-px shrink-0 bg-white/15" />}
      {classes.length > 1 && classes.map((c) => <Chip key={c} on={cls === c} onClick={() => setCls(cls === c ? "all" : c)}>{c}</Chip>)}
    </div>
  );

  const carStrip = (
    <div ref={strip} className="nr-scroll -mx-3 flex snap-x gap-2 overflow-x-auto px-3 py-1">
      {list.map((c) => {
        const o = open(c), sel = c.id === p.viewId;
        return (
          <button type="button" key={c.id} data-car={c.id} onClick={() => pick(c.id)} aria-pressed={sel} aria-label={`${c.name}${o ? "" : " (locked)"}`}
            className={`relative flex w-[112px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl p-1.5 text-left ring-2 transition active:scale-95 ${sel ? "bg-white/[0.14] ring-[#FFD25A]" : o ? "bg-white/[0.06] ring-white/10" : "bg-black/35 ring-white/5"}`}>
            <CarThumb spec={c} color={c.colors[p.paints[c.id] ?? 0] ?? c.colors[0]} locked={!o} className="h-[52px] w-full" />
            <span className="mt-0.5 truncate font-display text-[12.5px] leading-tight">{c.name}</span>
            <span className="flex items-center gap-1 truncate text-[10.5px] font-semibold text-white/55">{o ? `T${c.tier} · ${c.cls}` : <><Lock className="size-3" />★{c.unlockStars}</>}</span>
            {p.carId === c.id && <span className="absolute top-1 left-1 rounded-full bg-[#2FD47A] px-1.5 text-[9px] font-bold leading-4 text-[#03230f]">ON</span>}
            {isNewCar(c, p.stars, p.seen) && <span className="absolute top-1 right-1 animate-[nr-pulse_1s_ease-in-out_infinite] rounded-full bg-[#FF4FD8] px-1.5 text-[9px] font-bold leading-4 text-white">NEW</span>}
          </button>
        );
      })}
      {!list.length && <p className="p-3 text-sm text-white/50">No cars match this filter.</p>}
    </div>
  );

  const tabs = (
    <div className="flex gap-1 rounded-2xl bg-black/30 p-1 ring-1 ring-white/10">
      {([["stats", "Stats", BarChart3], ["paint", "Paint", Paintbrush], ["upgrade", "Upgrade", Wrench]] as const).map(([k, l, I]) => (
        <button type="button" key={k} onClick={() => { sfx("a:click", 0.3); setTab(k); }} aria-pressed={tab === k}
          className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl font-display text-[14px] transition ${tab === k ? "bg-white text-[#1a0f38]" : "text-white/75"}`}>
          <I className="size-4" />{l}
        </button>
      ))}
    </div>
  );

  const comparing = car.id !== cur.id;
  const content = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }} className="flex flex-col gap-2">
        {tab === "stats" && (
          <>
            {(Object.keys(STAT) as (keyof Upgrades)[]).map((k) => <StatBar key={k} label={STAT[k]} value={car.stats[k] + up[k] * 0.45} compare={comparing ? cur.stats[k] + upCur[k] * 0.45 : undefined} />)}
            {car.stats.drift != null && <StatBar label="Drift" value={car.stats.drift} compare={comparing ? cur.stats.drift : undefined} color="from-[#FF4FD8] to-[#FF9BE8]" />}
            <p className="text-[12px] leading-snug text-white/60">{car.desc}</p>
            {comparing && <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/45"><span className="inline-block h-3 w-[3px] rounded bg-white" />= your {cur.name}</p>}
          </>
        )}
        {tab === "paint" && (
          locked ? <p className="text-sm text-white/60">Unlock this car to paint it.</p> : (
            <div className="flex flex-wrap gap-2.5 py-1">
              {car.colors.map((c, i) => (
                <button type="button" key={c} aria-label={`Paint ${i + 1}`} onClick={() => { sfx("a:click", 0.32); p.setPaint(car.id, i); }}
                  className={`relative size-12 rounded-full ring-2 transition active:scale-90 ${paintI === i ? "ring-white ring-offset-2 ring-offset-[#1a0f38]" : "ring-white/20"}`}
                  style={{ background: `radial-gradient(circle at 35% 30%, #ffffffbb, ${c} 42%, ${c})` }}>
                  {paintI === i && <Check className="absolute inset-0 m-auto size-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />}
                </button>
              ))}
            </div>
          )
        )}
        {tab === "upgrade" && (
          (Object.keys(STAT) as (keyof Upgrades)[]).map((k) => {
            const cost = upgradeCost(up[k], car.tier), max = up[k] >= 5, can = !locked && !max && coins >= cost;
            return (
              <div key={k} className={`flex items-center gap-2 rounded-xl px-2 py-1 transition ${flash === k ? "bg-[#2FD47A]/30" : "bg-white/[0.04]"}`}>
                <span className="w-[4.8rem] shrink-0 truncate text-[12px] font-bold tracking-wide text-white/75 uppercase">{STAT[k]}</span>
                <span className="flex flex-1 gap-1">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-3 flex-1 rounded-sm ${i < up[k] ? "bg-gradient-to-b from-[#7CF2FF] to-[#2E86FF] shadow-[0_0_6px_rgba(124,242,255,0.6)]" : "bg-white/10"}`} />)}</span>
                <button type="button" disabled={!can} onClick={() => buy(k)} aria-label={`Upgrade ${STAT[k]}`}
                  className={`flex min-h-11 w-[5.6rem] shrink-0 items-center justify-center gap-1 rounded-xl font-display text-[13px] transition active:scale-95 ${max ? "bg-white/10 text-[#FFD25A]" : can ? "bg-[linear-gradient(180deg,#5CE39A,#16A35A)] text-[#03230f] shadow-[0_3px_0_#0b6a39]" : "bg-white/10 text-white/40"}`}>
                  {max ? "MAX" : <>⬆ <CoinIcon size={14} className="mx-0.5 align-[-2px]" />{cost}</>}
                </button>
              </div>
            );
          })
        )}
      </motion.div>
    </AnimatePresence>
  );

  const action = locked ? (
    <div className="flex items-center gap-2.5 rounded-2xl bg-black/35 p-2 pl-3 ring-1 ring-white/10">
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px]">Need ★{car.unlockStars} · you have ★{p.stars}</p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#FFD25A]" style={{ width: `${Math.min(100, (p.stars / Math.max(1, car.unlockStars)) * 100)}%` }} /></div>
      </div>
      <Btn tone="gold" size="md" onClick={p.onCareer}><Trophy className="size-4" />Win stars</Btn>
    </div>
  ) : p.carId === car.id ? (
    <div className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#2FD47A]/20 font-display text-lg text-[#8ff5bf] ring-1 ring-[#2FD47A]/40"><Check className="size-5" />YOUR {activeGame().style === "bike" ? "BIKE" : "CAR"}</div>
  ) : (
    <Btn tone="gold" size="lg" className="w-full" sound="a:ding" onClick={() => p.selectCar(car.id)}>DRIVE THIS CAR</Btn>
  );

  const pad = { paddingLeft: "calc(var(--safe-left, 0px) + 0.75rem)", paddingRight: "calc(var(--safe-right, 0px) + 0.75rem)" };
  return (
    <div className="absolute inset-0 flex flex-col">
      <AppBar title="Garage" sub={`${owned} / ${CARS.length} ${activeGame().style === "bike" ? "bikes" : "cars"}`} onBack={p.onBack} />
      {land ? (
        <div className="flex min-h-0 flex-1 gap-3 pt-2" style={{ ...pad, paddingBottom: "calc(var(--safe-bottom) + 0.6rem)" }}>
          <div className="flex min-w-0 flex-[1.25] flex-col gap-2">
            <div className="min-h-0 flex-1">{stage}</div>
            {carStrip}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {filters}
            {tabs}
            <div className="nr-scroll min-h-0 flex-1 overflow-y-auto pr-0.5">{content}</div>
            {action}
          </div>
        </div>
      ) : (
        <>
          <div className="nr-scroll mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-2.5 overflow-y-auto pt-2 pb-2" style={pad}>
            {stage}
            {carStrip}
            {filters}
            {tabs}
            {content}
          </div>
          <div className="mx-auto w-full max-w-2xl shrink-0 pt-1" style={{ ...pad, paddingBottom: "calc(var(--safe-bottom) + 0.7rem)" }}>{action}</div>
        </>
      )}
    </div>
  );
}
