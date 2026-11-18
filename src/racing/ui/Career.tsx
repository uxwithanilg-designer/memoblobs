"use client";
// Career map: swipeable world cards (theme colours, emoji, star progress, locks) → the four events of the
// selected world laid out as a progression path → an event detail sheet (mode, rivals, laps, star goals,
// rewards, your car) with a big START button. A sticky "continue" CTA always jumps to the next event.
import { useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import { ChevronRight, CloudRain, Lock, Moon, Play, Star, Sun } from "lucide-react";
import { AppBar, Btn, CarThumb, MODE_COLOR, MODE_SHORT, AI_EMOJI, AI_LABEL, Sheet, Stars, sfx, useViewport } from "./kit";
import { MODE_INFO, isUnlocked, modeBlurb, type CareerLevel } from "../levels";
import { activeGame } from "../games";
import { RIVALS } from "../race";
import type { CarSpec, ThemeSpec } from "../types";
import { CoinIcon } from "@/components/brand/CoinPill";
import { cdn } from "@/lib/cdn";

export const WORLDS = () => [...activeGame().themes].sort((a, b) => a.order - b.order);

/** the event the player should play next (first unplayed, else first without 3 stars) */
export function nextLevel(career: CareerLevel[], stars: Record<string, number>) {
  const open = career.filter((l) => isUnlocked(career, stars, l.index));
  return open.find((l) => !stars[l.id]) ?? open.find((l) => (stars[l.id] ?? 0) < 3) ?? null;
}

export function rewardEstimate(l: Pick<CareerLevel, "mode">) {
  const base = { race: 120, coinrush: 40, timetrial: 40, elimination: 140, duel: 150, drift: 60, battle: 150, rally: 60, heat: 80, escape: 130, takedown: 150, wheelie: 70 }[l.mode];
  return base + 75;
}

/** what each star needs, in kid words */
export function starGoals(l: CareerLevel): [string, string, string] {
  switch (l.mode) {
    case "race": return ["Finish 3rd or better", "Finish 2nd or better", "Win the race!"];
    case "duel": return ["Beat the boss", "Beat the boss", "Beat the boss!"];
    case "battle": return ["Score 80% of the boss's points", "Out-drift the boss", "Beat the boss by 15%!"];
    case "drift": return ["Reach the ★ drift score", "Reach the ★★ drift score", "Hit the gold ★★★ score!"];
    case "wheelie": return ["Reach the ★ wheelie score", "Reach the ★★ wheelie score", "Hit the gold ★★★ score!"];
    case "heat": return ["Reach the ★ heat score", "Reach the ★★ heat score", "Hit the gold ★★★ score!"];
    case "escape": return ["Escape to the finish", "Escape with under 70% damage", "Escape with under 35% damage!"];
    case "takedown": return ["Bust the suspects", "Bust them with 20% of the time left", "Bust them with 45% of the time left!"];
    case "rally": return ["Beat the ★ stage time", "Beat the ★★ stage time", "Beat the gold ★★★ time!"];
    case "elimination": return ["Last 3 standing", "Last 2 standing", "Be the last car standing!"];
    // coin and time goals are measured on the real track when the race loads (shown on the start banner)
    case "coinrush": return l.coinTarget ? [`Grab ${l.coinTarget[0]} coins`, `Grab ${l.coinTarget[1]} coins`, `Grab ${l.coinTarget[2]} coins`] : ["Reach the ★ coin goal", "Reach the ★★ coin goal", "Grab the most coins for ★★★!"];
    case "timetrial": return ["Beat the ★ time", "Beat the ★★ time", "Beat the gold ★★★ time!"];
  }
}

interface CareerProps {
  career: CareerLevel[]; stars: Record<string, number>; total: number; world: number; setWorld: (w: number) => void;
  car: CarSpec; paint: string; rivalFor: (l: CareerLevel) => CarSpec;
  sheet: CareerLevel | null; setSheet: (l: CareerLevel | null) => void;
  onStart: (l: CareerLevel) => void; onBack: () => void; onGarage: () => void;
}

function WorldCard({ t, w, open, got, sel, isNext, onPick, compact }: { t: ThemeSpec; w: number; open: boolean; got: number; sel: boolean; isNext: boolean; onPick: () => void; compact: boolean }) {
  if (compact) {
    return (
      <button type="button" data-world={w} onClick={onPick} aria-label={`${t.name}${open ? "" : " (locked)"}`}
        className={`relative flex min-h-14 w-full shrink-0 items-center gap-2.5 overflow-hidden rounded-2xl p-1.5 pr-2.5 text-left ring-2 transition active:scale-[0.98] ${sel ? "ring-[#FFD25A] shadow-[0_0_18px_rgba(255,210,90,0.35)]" : "ring-white/10"}`}
        style={{ background: `linear-gradient(100deg, ${t.accent}${open ? "cc" : "55"}, #140b2c 80%)` }}>
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-black/30 text-2xl ${open ? "" : "grayscale"}`}>{t.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] leading-tight">{w + 1}. {t.name}</span>
          <span className="mt-1 flex items-center gap-1.5">
            {open ? <><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40"><span className="block h-full rounded-full bg-[#FFD25A]" style={{ width: `${(got / 12) * 100}%` }} /></span><span className="text-[11px] font-bold text-white/75">★{got}/12</span></>
              : <span className="flex items-center gap-1 text-[11px] font-bold text-white/60"><Lock className="size-3" />Locked</span>}
          </span>
        </span>
        {isNext && <span className="absolute top-1 right-1 size-2.5 animate-[nr-blink_1s_ease-in-out_infinite] rounded-full bg-[#FF4FD8]" />}
      </button>
    );
  }
  return (
    <button type="button" data-world={w} onClick={onPick} aria-label={`${t.name}${open ? "" : " (locked)"}`}
      className={`relative flex h-[156px] w-[124px] shrink-0 snap-center flex-col overflow-hidden rounded-[1.3rem] p-2.5 text-left ring-2 transition active:scale-95 ${sel ? "-translate-y-1 ring-[#FFD25A] shadow-[0_10px_26px_rgba(255,210,90,0.35)]" : "ring-white/10"}`}
      style={{ background: `linear-gradient(165deg, ${t.accent}${open ? "" : "66"} 0%, ${t.accent}55 45%, #120a28 100%)` }}>
      <span className="absolute -top-3 -right-2 font-display text-[64px] leading-none text-white/10">{w + 1}</span>
      <span className={`text-[40px] leading-none drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)] ${open ? "" : "opacity-40 grayscale"}`}>{t.emoji}</span>
      <span className="mt-auto line-clamp-2 font-display text-[15px] leading-[1.05]">{t.name}</span>
      {open ? (
        <span className="mt-1.5 flex items-center gap-1.5">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40"><span className="block h-full rounded-full bg-[#FFD25A]" style={{ width: `${(got / 12) * 100}%` }} /></span>
          <span className="text-[11px] font-bold text-white/80">★{got}</span>
        </span>
      ) : <span className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-white/65"><Lock className="size-3" />Locked</span>}
      {isNext && <span className="absolute top-2 right-2 rounded-full bg-[#FF4FD8] px-1.5 font-display text-[10px] text-white">NEXT</span>}
    </button>
  );
}

export function Career(p: CareerProps) {
  const vp = useViewport();
  const land = !vp.portrait;
  const worlds = useMemo(() => WORLDS(), []);
  const next = nextLevel(p.career, p.stars);
  const t = worlds[Math.min(p.world, worlds.length - 1)];
  const lv = p.career.filter((l) => l.themeId === t.id);
  const worldOpen = lv.length > 0 && isUnlocked(p.career, p.stars, lv[0].index);
  const prevWorld = p.world > 0 ? worlds[p.world - 1] : null;
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-world="${p.world}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [p.world, land]);

  const worldMeta = (
    <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
      <span className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5">{t.night ? <Moon className="size-3" /> : <Sun className="size-3" />}{t.night ? "Night" : "Day"}</span>
      {t.weather !== "clear" && <span className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5"><CloudRain className="size-3" />{t.weather}</span>}
      {lv[0] && <span className="rounded-full bg-black/30 px-2 py-0.5">{AI_EMOJI[lv[0].ai]} {AI_LABEL[lv[0].ai]} rivals</span>}
    </div>
  );

  const events = (
    <div className={`relative grid gap-2 ${land ? "grid-cols-2" : ""}`}>
      {lv.map((l, i) => {
        const open = isUnlocked(p.career, p.stars, l.index), st = p.stars[l.id] ?? 0, isNext = next?.id === l.id;
        const [c1, c2] = MODE_COLOR[l.mode];
        return (
          <motion.button type="button" key={l.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            onClick={() => { if (open) { sfx("a:whooshIn", 0.3); p.setSheet(l); } else sfx("a:blip", 0.3); }}
            aria-label={`${MODE_SHORT[l.mode]}${open ? "" : " (locked)"}`}
            className={`relative flex min-h-[68px] items-center gap-2.5 overflow-hidden rounded-2xl p-2 pr-2.5 text-left ring-1 transition active:scale-[0.98] ${open ? "bg-white/[0.08] ring-white/15" : "bg-black/30 ring-white/5"} ${isNext ? "ring-2 ring-[#FFD25A] shadow-[0_0_20px_rgba(255,210,90,0.25)]" : ""}`}>
            <span className="relative grid size-12 shrink-0 place-items-center rounded-xl text-2xl shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]" style={{ background: open ? `linear-gradient(160deg, ${c1}, ${c2})` : "#2a2340" }}>
              {open ? MODE_INFO[l.mode].icon : <Lock className="size-5 text-white/60" />}
              <span className="absolute -bottom-1 -left-1 grid size-5 place-items-center rounded-full bg-[#0b0718] font-display text-[11px] ring-1 ring-white/30">{i + 1}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="nr-italic block truncate font-display text-[17px] leading-tight">{MODE_SHORT[l.mode]}</span>
              <span className="block truncate text-[11.5px] font-semibold text-white/60">
                {l.laps < 50 ? `${l.laps} laps` : l.mode === "coinrush" || l.mode === "wheelie" ? `${l.timeLimit ?? 60}s clock` : "survive"}{l.opponents ? ` · ${l.opponents} rival${l.opponents > 1 ? "s" : ""}` : " · solo"}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <Stars n={st} size={14} />
              {isNext ? <span className="rounded-full bg-[#FFD25A] px-1.5 font-display text-[10px] text-[#2a1600]">NEXT</span> : open ? <ChevronRight className="size-4 text-white/40" /> : null}
            </span>
          </motion.button>
        );
      })}
    </div>
  );

  const header = (
    <div className="relative overflow-hidden rounded-2xl p-3 ring-1 ring-white/10" style={{ background: `linear-gradient(110deg, ${t.accent}aa, #1a0f38 75%)` }}>
      <span className="pointer-events-none absolute -right-2 -bottom-6 text-[86px] leading-none opacity-30">{t.emoji}</span>
      <div className="relative flex items-center gap-2">
        <p className="nr-italic min-w-0 truncate font-display text-xl leading-none">{t.name}</p>
        <span className="ml-auto shrink-0 rounded-full bg-black/35 px-2 py-0.5 text-xs font-bold"><Star className="mr-0.5 inline size-3 fill-[#FFD25A] text-[#FFD25A]" />{lv.reduce((a, l) => a + (p.stars[l.id] ?? 0), 0)}/12</span>
      </div>
      <p className="relative mt-1 line-clamp-1 text-[12.5px] text-white/80">{t.blurb}</p>
      <div className="relative mt-1.5">{worldMeta}</div>
    </div>
  );

  const locked = !worldOpen && (
    <div className="grid place-items-center rounded-2xl bg-black/30 p-5 text-center ring-1 ring-white/10">
      <Lock className="size-8 text-white/60" />
      <p className="mt-2 font-display text-lg">World locked</p>
      <p className="text-sm text-white/65">{prevWorld ? <>Beat the <b>{prevWorld.name} {activeGame().career === "drift" ? "Drift Battle" : "Boss Duel"}</b> to open {t.name}.</> : "Keep racing to open this world."}</p>
    </div>
  );

  const nextTheme = next ? activeGame().themes.find((x) => x.id === next.themeId) : null;
  const cta = next && (
    <Btn tone="gold" size="lg" className="w-full" onClick={() => { const w = worlds.findIndex((x) => x.id === next.themeId); if (w >= 0) p.setWorld(w); p.setSheet(next); }}>
      <Play className="size-5 fill-current" /><span className="truncate">NEXT EVENT · {nextTheme?.emoji} {MODE_SHORT[next.mode]}</span>
    </Btn>
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <AppBar title="Career" sub={`${p.total} / ${p.career.length * 3} stars`} onBack={p.onBack} />
      {land ? (
        <div className="flex min-h-0 flex-1 gap-3 pt-2" style={{ paddingLeft: "calc(var(--safe-left, 0px) + 0.6rem)", paddingRight: "calc(var(--safe-right, 0px) + 0.6rem)", paddingBottom: "calc(var(--safe-bottom) + 0.6rem)" }}>
          <div ref={strip} className="nr-scroll flex w-[min(38%,330px)] shrink-0 flex-col gap-2 overflow-y-auto p-1">
            {worlds.map((w, i) => {
              const first = p.career.find((l) => l.themeId === w.id);
              const open = !!first && isUnlocked(p.career, p.stars, first.index);
              const got = p.career.filter((l) => l.themeId === w.id).reduce((a, l) => a + (p.stars[l.id] ?? 0), 0);
              return <WorldCard key={w.id} t={w} w={i} open={open} got={got} sel={i === p.world} isNext={next?.themeId === w.id} onPick={() => { sfx("a:click", 0.3); p.setWorld(i); }} compact />;
            })}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="nr-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-0.5">{header}{locked || events}</div>
            {cta}
          </div>
        </div>
      ) : (
        <>
          <div ref={strip} className="nr-scroll flex shrink-0 snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 pt-3 pb-3" style={{ scrollPaddingInline: "1rem" }}>
            {worlds.map((w, i) => {
              const first = p.career.find((l) => l.themeId === w.id);
              const open = !!first && isUnlocked(p.career, p.stars, first.index);
              const got = p.career.filter((l) => l.themeId === w.id).reduce((a, l) => a + (p.stars[l.id] ?? 0), 0);
              return <WorldCard key={w.id} t={w} w={i} open={open} got={got} sel={i === p.world} isNext={next?.themeId === w.id} onPick={() => { sfx("a:click", 0.3); p.setWorld(i); }} compact={false} />;
            })}
          </div>
          <div className="nr-scroll mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-2">{header}{locked || events}</div>
          {cta && <div className="mx-auto w-full max-w-2xl shrink-0 px-3 pt-1" style={{ paddingBottom: "calc(var(--safe-bottom) + 0.75rem)" }}>{cta}</div>}
        </>
      )}
      <EventSheet {...p} />
    </div>
  );
}

function EventSheet({ sheet: l, setSheet, stars, car, paint, rivalFor, onStart, onGarage }: CareerProps) {
  const t = l ? activeGame().themes.find((x) => x.id === l.themeId) : null;
  const goals = l ? starGoals(l) : null;
  const st = l ? stars[l.id] ?? 0 : 0;
  const rival = l?.mode === "duel" || l?.mode === "battle" ? rivalFor(l) : null;
  return (
    <Sheet open={!!l} onClose={() => setSheet(null)} label="Event details" wide>
      {l && t && goals && (
        <div className="landscape:grid landscape:grid-cols-[1.1fr_1fr] landscape:gap-0">
          <div>
            <div className="relative overflow-hidden px-4 pt-4 pb-3" style={{ background: `linear-gradient(120deg, ${t.accent}, ${MODE_COLOR[l.mode][1]}aa 60%, transparent)` }}>
              <span className="pointer-events-none absolute -right-3 -bottom-8 text-[110px] leading-none opacity-25">{t.emoji}</span>
              <p className="relative text-[11px] font-bold tracking-[0.25em] text-white/80 uppercase">{t.emoji} {t.name} · Event {l.event + 1}</p>
              <p className="nr-italic relative mt-1 pr-10 font-display text-[clamp(1.5rem,6vw,2.2rem)] leading-[0.95] drop-shadow-[0_3px_0_rgba(10,4,30,0.7)]">{l.title}</p>
              <p className="relative mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 font-display text-sm">{MODE_INFO[l.mode].icon} {MODE_INFO[l.mode].label}</p>
            </div>
            <div className="px-4 pt-3">
              <p className="text-[13px] text-white/75">{modeBlurb(l.mode)}</p>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
                <Info k={l.laps < 50 ? "Laps" : l.mode === "coinrush" ? "Clock" : "Laps"} v={l.laps < 50 ? String(l.laps) : l.mode === "coinrush" ? `${l.timeLimit ?? 60}s` : "∞"} />
                <Info k="Rivals" v={l.opponents ? String(l.opponents) : "Solo"} />
                <Info k="AI" v={`${AI_EMOJI[l.ai]} ${AI_LABEL[l.ai]}`} />
              </div>
              {rival && (
                <div className="mt-2.5 flex items-center gap-2.5 rounded-2xl bg-[linear-gradient(100deg,#4c1d95,#1a0f38)] p-2 ring-1 ring-[#B98CFF]/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cdn(RIVALS[0].avatar)} alt="" className="size-11 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1"><p className="text-[10px] font-bold tracking-widest text-[#d8c4ff] uppercase">Boss · {RIVALS[0].name}</p><p className="truncate font-display">{rival.name}</p><p className="text-[11px] text-white/55">{rival.cls} · Tier {rival.tier}</p></div>
                  <CarThumb spec={rival} color={rival.colors[0]} className="h-12 w-20 shrink-0" />
                </div>
              )}
              <div className="mt-3 space-y-1.5">
                {goals.map((g, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 ring-1 ${i < st ? "bg-[#FFD25A]/15 ring-[#FFD25A]/40" : "bg-white/[0.05] ring-white/10"}`}>
                    <Stars n={i + 1} size={13} /><span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{g}</span>
                    {i < st && <span className="font-display text-xs text-[#FFD25A]">DONE</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 px-4 pt-3 landscape:pt-14">
            <div className="flex items-center justify-between rounded-2xl bg-black/30 px-3 py-2 ring-1 ring-white/10">
              <span className="text-[12px] font-bold tracking-wider text-white/60 uppercase">Rewards</span>
              <span className="font-display text-lg text-[#FFD25A]"><CoinIcon size={18} className="mr-1 align-[-3px]" />up to {rewardEstimate(l)}+</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.06] p-2 ring-1 ring-white/10">
              <CarThumb spec={car} color={paint} className="h-12 w-20 shrink-0" />
              <div className="min-w-0 flex-1"><p className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Your {activeGame().style === "bike" ? "bike" : "car"}</p><p className="truncate font-display">{car.name}</p></div>
              <Btn tone="ghost" size="sm" onClick={() => { setSheet(null); onGarage(); }}>Change</Btn>
            </div>
            <Btn tone="gold" size="xl" className="w-full" sound="a:whooshIn" onClick={() => onStart(l)}><Play className="size-6 fill-current" />START EVENT</Btn>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return <div className="rounded-xl bg-black/30 px-1 py-1.5 ring-1 ring-white/10"><p className="text-[10px] font-bold tracking-widest text-white/50 uppercase">{k}</p><p className="truncate font-display text-[15px]">{v}</p></div>;
}
