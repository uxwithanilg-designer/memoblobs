"use client";
// Quick Race setup as a stepper: Event (mode + world) → Track (layout, direction, laps) → Rivals (count, AI)
// → Conditions (weather, time, pickups, hazards) → Car. The RACE button is always in reach at the bottom.
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, ChevronRight, CloudRain, CloudSnow, Moon, Play, Sparkles, Sun, Sunrise, Wrench } from "lucide-react";
import { AppBar, Btn, CarThumb, Chip, MODE_COLOR, AI_EMOJI, Seg, SectionLabel, StatBar, Toggle, TrackPath, sfx, trackInfo, useViewport } from "./kit";
import { MODE_INFO, modeBlurb } from "../levels";
import { activeGame } from "../games";
import { RIVALS } from "../race";
import type { AiLevel, CarSpec, ModeId, ThemeSpec, Upgrades, Weather } from "../types";
import { NO_UPGRADES, type QuickSetup } from "../save";
import { WORLDS } from "./Career";

const STEPS = ["Event", "Track", "Rivals", "Conditions", "Car"] as const;
const WEATHER_ICON: Record<string, string> = { auto: "✨", clear: "☀️", rain: "🌧️", snow: "❄️", sand: "🏜️", fireflies: "✨", ash: "🌋", leaves: "🍂", petals: "🌸" };

interface QuickProps {
  q: QuickSetup; setQ: (p: Partial<QuickSetup>) => void;
  themeOpen: (id: string) => boolean;
  carId: string; selectCar: (id: string) => void; carOpen: (id: string) => boolean;
  paints: Record<string, number>; setPaint: (id: string, i: number) => void; upgrades: Record<string, Upgrades>;
  onStart: () => void; onBack: () => void; onGarage: () => void;
}

export function QuickRace(p: QuickProps) {
  const game = activeGame(), CARS = game.cars;
  const vp = useViewport();
  const land = !vp.portrait;
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const worlds = useMemo(() => WORLDS(), []);
  const q = p.q;
  const theme = worlds.find((t) => t.id === q.themeId) ?? worlds[0];
  const solo = q.mode === "coinrush" || q.mode === "timetrial" || q.mode === "drift" || q.mode === "rally" || q.mode === "heat" || q.mode === "escape" || q.mode === "wheelie";
  const lapsOn = q.mode !== "coinrush" && q.mode !== "elimination" && q.mode !== "heat" && q.mode !== "takedown" && q.mode !== "wheelie";
  const oneOnOne = q.mode === "duel" || q.mode === "battle";
  const go = (n: number) => { if (n < 0 || n >= STEPS.length || n === step) return; sfx("swoosh", 0.22); setDir(n > step ? 1 : -1); setStep(n); };

  const summary = [
    `${MODE_INFO[q.mode].icon} ${MODE_INFO[q.mode].label}`, `${theme.emoji} ${theme.name}`, `Track ${"ABC"[q.variant]}${q.reverse ? " ⟲" : ""}`,
    lapsOn ? `${q.laps} lap${q.laps > 1 ? "s" : ""}` : null, solo ? "Solo" : q.mode === "duel" ? "1 boss" : q.mode === "battle" ? "1 rival" : `${q.opponents} rivals`,
  ].filter(Boolean).join(" · ");

  let body: React.ReactNode = null;
  if (step === 0) body = (
    <div className={`flex flex-col ${land ? "gap-2" : "gap-3"}`}>
      <div className="min-w-0">
        {!land && <SectionLabel>Game mode</SectionLabel>}
        <div className="nr-scroll -mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1">
          {(game.modes as ModeId[]).map((m) => {
            const on = q.mode === m, [c1, c2] = MODE_COLOR[m];
            return (
              <button type="button" key={m} onClick={() => { sfx("a:click", 0.35); p.setQ({ mode: m }); }} aria-pressed={on}
                className={`relative flex shrink-0 snap-start items-center gap-2 overflow-hidden rounded-2xl text-left ring-2 transition active:scale-95 ${land ? "min-h-12 min-w-[132px] p-1.5 pr-3" : "h-[84px] w-[118px] flex-col items-start justify-between p-2.5"} ${on ? "ring-[#FFD25A] shadow-[0_6px_18px_rgba(255,210,90,0.3)]" : "ring-white/10"}`}
                style={{ background: `linear-gradient(150deg, ${c1}${on ? "" : "88"}, ${c2}${on ? "" : "66"})` }}>
                <span className={`${land ? "grid size-9 place-items-center rounded-xl bg-black/25 text-xl" : "text-[28px] leading-none"}`}>{MODE_INFO[m].icon}</span>
                <span className="nr-italic font-display text-[15px] leading-none drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">{MODE_INFO[m].label}</span>
                {on && <Check className="absolute top-1.5 right-1.5 size-4 rounded-full bg-white p-0.5 text-[#2a1600]" />}
              </button>
            );
          })}
        </div>
        {!land && <p className="mt-1 line-clamp-2 text-[12.5px] text-white/65">{modeBlurb(q.mode)}</p>}
      </div>
      <div className="flex min-h-0 min-w-0 flex-col">
        <SectionLabel>World</SectionLabel>
        <div className={`nr-scroll -mx-3 grid snap-x grid-flow-col gap-2 overflow-x-auto px-3 pb-1 ${land ? `auto-cols-[minmax(170px,24%)] ${vp.h < 430 ? "grid-rows-2" : vp.h < 640 ? "grid-rows-3" : "grid-rows-4"}` : `auto-cols-[minmax(150px,46%)] ${vp.h >= 800 ? "grid-rows-5" : vp.h >= 700 ? "grid-rows-4" : "grid-rows-3"}`}`}>
          {worlds.map((t) => <WorldTile key={t.id} t={t} on={q.themeId === t.id} open={p.themeOpen(t.id)} onPick={() => p.setQ({ themeId: t.id })} />)}
        </div>
      </div>
    </div>
  );
  else if (step === 1) body = (
    <div className={land ? "grid h-full grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3" : "flex flex-col gap-3"}>
      <div>
        <SectionLabel>Layout · {theme.name}</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((v) => {
            const on = q.variant === v;
            let km = "";
            try { km = (trackInfo(theme.id, v, q.reverse).length / 1000).toFixed(1); } catch { /* preview */ }
            return (
              <button type="button" key={v} onClick={() => { sfx("a:click", 0.35); p.setQ({ variant: v }); }} aria-pressed={on} aria-label={`Track ${"ABC"[v]}`}
                className={`relative flex flex-col items-center overflow-hidden rounded-2xl p-1.5 pb-2 ring-2 transition active:scale-95 ${on ? "ring-[#FFD25A] shadow-[0_6px_18px_rgba(255,210,90,0.25)]" : "ring-white/10"}`}
                style={{ background: `linear-gradient(160deg, ${theme.accent}${on ? "aa" : "44"}, #120a28)` }}>
                <TrackPath themeId={theme.id} variant={v} reverse={q.reverse} color={on ? "#FFD25A" : "#ffffff"} className={`w-full ${land ? "h-[min(22vh,96px)]" : "h-[clamp(70px,22vw,110px)]"}`} />
                <span className="nr-italic font-display text-[15px] leading-none">Track {"ABC"[v]}</span>
                <span className="text-[11px] font-bold text-white/60">{km} km</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div><SectionLabel>Direction</SectionLabel>
          <Seg value={q.reverse ? 1 : 0} onChange={(v) => p.setQ({ reverse: v === 1 })} options={[{ v: 0, label: "⟳ Forward" }, { v: 1, label: "⟲ Reverse" }]} /></div>
        {lapsOn ? (
          <div><SectionLabel>Laps</SectionLabel>
            <Seg value={q.laps} onChange={(v) => p.setQ({ laps: v })} options={[1, 2, 3, 4, 5].map((n) => ({ v: n, label: String(n) }))} /></div>
        ) : <p className="rounded-2xl bg-white/[0.06] p-3 text-[13px] text-white/70 ring-1 ring-white/10">{q.mode === "coinrush" ? "⏱️ Coin Rush runs on the clock — checkpoints add time." : q.mode === "heat" ? "🚨 Heat Run is on the clock — checkpoints add time, the police get hotter and hotter." : q.mode === "takedown" ? "🚓 Takedown: 90 seconds to bust every suspect." : q.mode === "wheelie" ? "🏍️ Wheelie Challenge is on the clock — checkpoints add time." : "💥 Knockout runs until one car is left."}</p>}
      </div>
    </div>
  );
  else if (step === 2) body = solo ? (
    <div className="grid h-full place-items-center">
      <div className="max-w-sm rounded-3xl bg-white/[0.06] p-5 text-center ring-1 ring-white/10">
        <p className="text-5xl">{MODE_INFO[q.mode].icon}</p>
        <p className="mt-2 font-display text-xl">Solo run</p>
        <p className="mt-1 text-sm text-white/70">{MODE_INFO[q.mode].label} is just you and the road — no rivals to race. Tap NEXT!</p>
      </div>
    </div>
  ) : (
    <div className={land ? "grid grid-cols-2 gap-4" : "flex flex-col gap-4"}>
      {!oneOnOne ? (
        <div>
          <SectionLabel>Rivals · {q.opponents}</SectionLabel>
          <div className="grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button type="button" key={n} aria-label={`${n} rivals`} aria-pressed={q.opponents === n} onClick={() => { sfx("a:click", 0.35); p.setQ({ opponents: n }); }}
                className={`flex min-h-12 flex-col items-center justify-center rounded-xl font-display text-[15px] ring-1 transition active:scale-90 ${q.opponents === n ? "bg-[linear-gradient(180deg,#FFF3B0,#FFD25A_45%,#FFAA1C)] text-[#2a1600] ring-white/70" : n < q.opponents ? "bg-white/15 ring-white/15" : "bg-white/[0.06] ring-white/10"}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="mt-2 flex -space-x-2">
            {RIVALS.slice(0, q.opponents).map((r) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={r.name} src={r.avatar} alt={r.name} className="size-10 rounded-full bg-[#2a1a55] object-contain p-0.5 ring-2 ring-[#0b0718]" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(100deg,#4c1d95,#1a0f38)] p-3 ring-1 ring-[#B98CFF]/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={RIVALS[0].avatar} alt="" className="size-14 object-contain" />
          <div><p className="text-[11px] font-bold tracking-widest text-[#d8c4ff] uppercase">{q.mode === "battle" ? "Drift battle" : "Boss duel"}</p><p className="font-display text-lg">{q.mode === "battle" ? `${RIVALS[0].name} leads — chase and out-drift!` : `${RIVALS[0].name} in the fastest car`}</p></div>
        </div>
      )}
      <div>
        <SectionLabel>Rival skill</SectionLabel>
        <Seg value={q.ai} onChange={(v) => p.setQ({ ai: v as AiLevel })} options={(["easy", "normal", "hard", "pro"] as AiLevel[]).map((a) => ({ v: a, label: `${AI_EMOJI[a]} ${a[0].toUpperCase()}${a.slice(1)}` }))} />
      </div>
    </div>
  );
  else if (step === 3) {
    const weathers = (["auto", "clear", "rain", "snow"] as (Weather | "auto")[]).concat(theme.weather !== "clear" && !["rain", "snow"].includes(theme.weather) ? [theme.weather] : []);
    body = (
      <div className={land ? "grid grid-cols-2 gap-x-4 gap-y-3" : "flex flex-col gap-3.5"}>
        <div><SectionLabel>Weather</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {weathers.map((w) => <Chip key={w} on={q.weather === w} onClick={() => p.setQ({ weather: w })}>{WEATHER_ICON[w] ?? "✨"} {w === "auto" ? "World" : w[0].toUpperCase() + w.slice(1)}</Chip>)}
          </div></div>
        <div><SectionLabel>Time of day</SectionLabel>
          <Seg value={q.night === "auto" ? 0 : q.night ? 2 : 1} onChange={(v) => p.setQ({ night: v === 0 ? "auto" : v === 2 })}
            options={[{ v: 0, label: <span className="inline-flex items-center gap-1"><Sunrise className="size-4" />World</span> }, { v: 1, label: <span className="inline-flex items-center gap-1"><Sun className="size-4" />Day</span> }, { v: 2, label: <span className="inline-flex items-center gap-1"><Moon className="size-4" />Night</span> }]} /></div>
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-1 ring-1 ring-white/10">
          <Sparkles className="size-5 shrink-0 text-[#7CF2FF]" />
          <div className="min-w-0 flex-1"><p className="font-display">Pickups</p><p className="truncate text-[12px] text-white/55">Coins, nitro, shields, magnets, ramps</p></div>
          <Toggle on={q.pickups} onChange={(v) => p.setQ({ pickups: v })} label="Pickups" />
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-1 ring-1 ring-white/10">
          <span className="text-xl">🔥</span>
          <div className="min-w-0 flex-1"><p className="font-display">Hazards</p><p className="truncate text-[12px] text-white/55">Oil, cones, fire, rocks, spikes</p></div>
          <Toggle on={q.hazards} onChange={(v) => p.setQ({ hazards: v })} label="Hazards" />
        </div>
        {(q.weather === "rain" || q.weather === "snow") && <p className="flex items-center gap-1.5 text-[12px] text-white/60">{q.weather === "rain" ? <CloudRain className="size-4" /> : <CloudSnow className="size-4" />}Slippery roads — brake earlier!</p>}
      </div>
    );
  } else {
    const owned = CARS.filter((c) => p.carOpen(c.id));
    const car = CARS.find((c) => c.id === p.carId) ?? CARS[0];
    const up = { ...NO_UPGRADES, ...p.upgrades[car.id] };
    const pi = p.paints[car.id] ?? 0;
    body = (
      <div className={land ? "grid h-full grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3" : "flex flex-col gap-3"}>
        <div className="min-w-0">
          <SectionLabel>Your {game.style === "bike" ? "bikes" : "cars"} · {owned.length}</SectionLabel>
          <div className={`nr-scroll -mx-3 grid snap-x auto-cols-[132px] grid-flow-col gap-2 overflow-x-auto px-3 pb-1 ${land ? "grid-rows-2" : "grid-rows-1"}`}>
            {owned.map((c) => <CarTile key={c.id} c={c} on={c.id === p.carId} color={c.colors[p.paints[c.id] ?? 0] ?? c.colors[0]} onPick={() => p.selectCar(c.id)} />)}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-white/[0.05] p-2.5 ring-1 ring-white/10">
          <div className="flex items-center gap-2"><p className="nr-italic min-w-0 flex-1 truncate font-display text-lg">{car.name}</p><span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold">{car.cls} · T{car.tier}</span></div>
          {(["speed", "accel", "handling", "nitro"] as const).map((k) => <StatBar key={k} label={k === "accel" ? "Accel" : k} value={car.stats[k] + up[k] * 0.45} />)}
          {car.stats.drift != null && <StatBar label="Drift" value={car.stats.drift} color="from-[#FF4FD8] to-[#FF9BE8]" />}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {car.colors.map((c, i) => <button type="button" key={c} aria-label={`Paint ${i + 1}`} onClick={() => { sfx("a:click", 0.3); p.setPaint(car.id, i); }} className={`size-11 rounded-full ring-2 transition active:scale-90 ${pi === i ? "ring-white ring-offset-2 ring-offset-[#1a0f38]" : "ring-white/20"}`} style={{ background: `radial-gradient(circle at 35% 30%, #ffffffaa, ${c} 45%)` }} />)}
            <Btn tone="ghost" size="sm" className="ml-auto" onClick={p.onGarage}><Wrench className="size-4" />Garage</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <AppBar title="Quick Race" sub={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} onBack={p.onBack} />
      {/* step tabs */}
      <div className="nr-scroll flex shrink-0 gap-1.5 overflow-x-auto px-3 pt-2.5 pb-1" style={{ paddingLeft: "calc(var(--safe-left, 0px) + 0.75rem)" }}>
        {STEPS.map((s, i) => (
          <button type="button" key={s} onClick={() => go(i)} aria-current={i === step ? "step" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 font-display text-[13px] ring-1 transition active:scale-95 ${i === step ? "bg-white text-[#1a0f38] ring-white" : i < step ? "bg-[#2FD47A]/20 text-white ring-[#2FD47A]/50" : "bg-white/[0.06] text-white/70 ring-white/10"}`}>
            <span className={`grid size-7 place-items-center rounded-full text-[12px] ${i === step ? "bg-[#FFD25A] text-[#2a1600]" : i < step ? "bg-[#2FD47A] text-[#03230f]" : "bg-white/10"}`}>{i < step ? <Check className="size-4" /> : i + 1}</span>{s}
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -30 }} transition={{ duration: 0.16 }}
            className="nr-scroll absolute inset-0 overflow-y-auto px-3 pt-2 pb-2" style={{ paddingLeft: "calc(var(--safe-left, 0px) + 0.75rem)", paddingRight: "calc(var(--safe-right, 0px) + 0.75rem)" }}>
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* footer: summary + navigation + RACE (last button in the DOM on purpose) */}
      <div className="shrink-0 border-t border-white/10 bg-[#0b0718]/70 px-3 pt-2 backdrop-blur-md" style={{ paddingBottom: "calc(var(--safe-bottom) + 0.6rem)", paddingLeft: "calc(var(--safe-left, 0px) + 0.75rem)", paddingRight: "calc(var(--safe-right, 0px) + 0.75rem)" }}>
        <p className="mb-1.5 truncate text-center text-[12px] font-semibold text-white/60">{summary}</p>
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Btn tone="ghost" className="w-12 shrink-0 !px-0" label="Previous step" disabled={step === 0} onClick={() => go(step - 1)}><ChevronLeft className="size-6" /></Btn>
          {step < STEPS.length - 1 && <Btn tone="blue" className="flex-1" label="Next step" onClick={() => go(step + 1)}>NEXT<ChevronRight className="size-5" /></Btn>}
          <Btn tone="gold" size="lg" className="flex-[1.3]" sound="a:whooshIn" onClick={p.onStart}><Play className="size-5 fill-current" />RACE</Btn>
        </div>
      </div>
    </div>
  );
}

function WorldTile({ t, on, open, onPick }: { t: ThemeSpec; on: boolean; open: boolean; onPick: () => void }) {
  return (
    <button type="button" disabled={!open} aria-pressed={on} onClick={() => { sfx("a:click", 0.35); onPick(); }}
      className={`relative flex min-h-[54px] snap-start items-center gap-2 overflow-hidden rounded-2xl p-1.5 pr-2 text-left ring-2 transition active:scale-95 disabled:opacity-45 ${on ? "ring-[#FFD25A] shadow-[0_4px_16px_rgba(255,210,90,0.3)]" : "ring-white/10"}`}
      style={{ background: `linear-gradient(120deg, ${t.accent}${on ? "ee" : "99"}, #140b2c 85%)` }}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-black/25 text-2xl ${open ? "" : "grayscale"}`}>{open ? t.emoji : "🔒"}</span>
      <span className="line-clamp-2 min-w-0 font-display text-[14px] leading-[1.05]">{t.name}</span>
      {on && <Check className="absolute top-1 right-1 size-4 rounded-full bg-white p-0.5 text-[#2a1600]" />}
    </button>
  );
}

function CarTile({ c, on, color, onPick }: { c: CarSpec; on: boolean; color: string; onPick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => { sfx("a:click", 0.35); onPick(); }}
      className={`relative flex snap-start flex-col overflow-hidden rounded-2xl p-1.5 text-left ring-2 transition active:scale-95 ${on ? "bg-white/[0.12] ring-[#FFD25A]" : "bg-white/[0.05] ring-white/10"}`}>
      <CarThumb spec={c} color={color} className="h-[62px] w-full" />
      <span className="truncate font-display text-[13px] leading-tight">{c.name}</span>
      <span className="truncate text-[10.5px] font-semibold text-white/55">{c.cls}</span>
      {on && <Check className="absolute top-1 right-1 size-4 rounded-full bg-[#FFD25A] p-0.5 text-[#2a1600]" />}
    </button>
  );
}
