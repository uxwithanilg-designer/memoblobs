"use client";
// The road map: all 25 worlds as one long winding road of stage stops (and the endless Remix Grand Prix after them).
// Cleared stops show their stars, the next new stage glows, stops ahead are locked; tap any open stop to race it.
import { memo, useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import { ChevronLeft, Lock, Play } from "lucide-react";
import { CONCEPT } from "../data/concepts";
import { JOURNEY, STAGES_PER_WORLD, WORLDS } from "../data/worlds";
import { conceptAt, isExact, MECH_LABEL, mechOf } from "../gen";
import type { Best } from "../save";

const ROW = 78;
const xAt = (i: number) => 50 + Math.sin(i * 0.95) * 28;

export function stageTitle(n: number) {
  if (n > JOURNEY) return `Remix ${n - JOURNEY}`;
  const c = conceptAt(n), s = ((n - 1) % STAGES_PER_WORLD) + 1;
  if (s === 1) return WORLDS[Math.ceil(n / STAGES_PER_WORLD) - 1].name;
  if (s === STAGES_PER_WORLD) return `Boss: ${CONCEPT[c]?.name.replace(/^The /, "") ?? "Kranky"}`;
  return isExact(c) ? CONCEPT[c]?.name ?? MECH_LABEL[mechOf(c)] : MECH_LABEL[mechOf(c)];
}

const Stop = memo(function Stop({ n, i, best, open, current, color, onPick, kind }: { n: number; i: number; best?: Best; open: boolean; current: boolean; color: string; onPick: (n: number) => void; kind: "open" | "boss" | "stage" | "remix" }) {
  const big = kind === "boss" || kind === "open";
  const d = big ? 64 : 54;
  return (
    <button type="button" disabled={!open} onClick={() => onPick(n)} data-stage={n} aria-label={`Stage ${n}${open ? "" : " (locked)"}`}
      className="absolute flex -translate-x-1/2 flex-col items-center active:scale-95 disabled:active:scale-100" style={{ left: `${xAt(i)}%`, top: i * ROW + 6 }}>
      <span className={`relative grid place-items-center rounded-full font-display text-white shadow-[0_5px_0_rgba(0,0,0,0.25)] ${current ? "ring-4 ring-white" : open ? "ring-2 ring-white/70" : ""}`}
        style={{ width: d, height: d, background: open ? `radial-gradient(circle at 35% 30%, #ffffff66, ${color} 55%, ${color})` : "linear-gradient(180deg,#9AA4B8,#6A7488)", fontSize: big ? 15 : 18 }}>
        {current && <motion.span className="absolute inset-[-8px] rounded-full ring-4 ring-[#5CF2FF]" animate={{ opacity: [0.9, 0.2, 0.9], scale: [1, 1.12, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />}
        {!open ? <Lock className="size-5 opacity-80" /> : kind === "boss" ? <span className="text-2xl leading-none">👑</span> : kind === "open" ? <span className="text-2xl leading-none">{WORLDS[Math.ceil(n / STAGES_PER_WORLD) - 1]?.emoji}</span> : current ? <Play className="size-6 fill-white" /> : n > JOURNEY ? `R${n - JOURNEY}` : n}
      </span>
      <span className="mt-0.5 flex h-3.5 gap-px text-[11px] leading-none drop-shadow">
        {open && best ? [0, 1, 2].map((k) => <span key={k} className={k < best.r ? "" : "opacity-25 grayscale"}>⭐</span>) : current ? <span className="rounded-full bg-white px-1.5 text-[10px] font-bold text-[#1A2A5A]">PLAY</span> : null}
      </span>
    </button>
  );
});

export function RoadMap({ stage, best, coins, stars, onPick, onBack }: { stage: number; best: Record<string, Best>; coins: number; stars: number; onPick: (n: number) => void; onBack: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  // the remix stops shown: everything played so far after the journey, and a few more ahead
  const remixTo = Math.max(JOURNEY + 3, stage + 2);
  useEffect(() => {
    const el = box.current?.querySelector(`[data-stage="${Math.min(stage, remixTo)}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "center" });
  }, [stage, remixTo]);
  const worlds = useMemo(() => WORLDS.map((w) => {
    const from = (w.id - 1) * STAGES_PER_WORLD + 1;
    let got = 0; for (let n = from; n < from + STAGES_PER_WORLD; n++) got += best[n]?.r ?? 0;
    return { w, from, got };
  }), [best]);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="absolute inset-0 z-30 flex flex-col bg-[linear-gradient(180deg,#5AB4F5,#CFEBFF_60%,#F4FAFF)]">
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onBack} aria-label="Back" className="grid size-11 place-items-center rounded-2xl bg-white/85 text-[#1A2A5A] shadow-[0_4px_0_rgba(0,0,0,0.15)] active:translate-y-0.5"><ChevronLeft className="size-6" /></button>
        <h2 className="font-display text-2xl text-white drop-shadow-[0_3px_0_rgba(20,40,90,0.35)]">Road Map</h2>
        <span className="rounded-full bg-white/85 px-2.5 py-0.5 text-sm font-bold text-[#1A2A5A]">⭐ {stars}</span>
        <span className="sr-only">{coins} coins</span>
      </div>
      <div ref={box} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
        {worlds.map(({ w, from, got }) => (
          <section key={w.id} className="mx-auto mb-4 max-w-md">
            <div className="sticky top-0 z-10 mb-1 flex items-center gap-3 rounded-2xl px-3 py-2 text-white shadow-[0_6px_18px_rgba(20,40,90,0.25)]" style={{ background: `linear-gradient(135deg, ${w.pal.top}, ${w.road.stripeA})` }}>
              <span className="text-3xl leading-none">{w.emoji}</span>
              <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold tracking-widest uppercase opacity-90">World {w.id}</span><span className="block truncate font-display text-xl leading-tight">{w.name}</span></span>
              <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs font-bold">⭐ {got}/60</span>
            </div>
            <div className="relative" style={{ height: STAGES_PER_WORLD * ROW }}>
              <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 100 ${STAGES_PER_WORLD * ROW}`} preserveAspectRatio="none" aria-hidden>
                <polyline fill="none" stroke="white" strokeOpacity="0.75" strokeWidth="2.2" strokeDasharray="3 4" vectorEffect="non-scaling-stroke"
                  points={Array.from({ length: STAGES_PER_WORLD }, (_, i) => `${xAt(i + from - 1)},${i * ROW + 34}`).join(" ")} />
              </svg>
              {Array.from({ length: STAGES_PER_WORLD }, (_, k) => {
                const n = from + k, s = k + 1;
                return <Stop key={n} n={n} i={k} best={best[n]} open={n <= stage} current={n === stage} color={w.road.stripeA} onPick={onPick} kind={s === 1 ? "open" : s === STAGES_PER_WORLD ? "boss" : "stage"} />;
              })}
            </div>
          </section>
        ))}
        <section className="mx-auto mb-6 max-w-md">
          <div className="mb-1 flex items-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#7A4AE8,#FF5AB8)] px-3 py-2 text-white shadow-[0_6px_18px_rgba(20,40,90,0.25)]">
            <span className="text-3xl leading-none">♾️</span>
            <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold tracking-widest uppercase opacity-90">After stage 500</span><span className="block font-display text-xl leading-tight">Remix Grand Prix</span></span>
          </div>
          <p className="mb-2 px-1 text-sm font-semibold text-[#2A3A6A]">Every idea you learned, mixed into brand-new courses forever — never the same mix twice.</p>
          <div className="relative" style={{ height: (remixTo - JOURNEY) * ROW }}>
            {Array.from({ length: remixTo - JOURNEY }, (_, k) => { const n = JOURNEY + 1 + k; return <Stop key={n} n={n} i={k} best={best[n]} open={n <= stage} current={n === stage} color="#B88CFF" onPick={onPick} kind="remix" />; })}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
