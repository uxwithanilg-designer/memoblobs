"use client";
// The home page's spotlight: one big featured game at a time — its art on one side, its title, tagline and a Play
// button on a panel tinted with the game's colours — moving on every few seconds (swipe on phones, a picker strip
// on desktop). The art is shown whole, never covered, because most covers carry their own logo.
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Info, Play } from "lucide-react";
import { CATEGORIES, type Game } from "@/lib/game-index";
import { gameHref, is3D, isNew, playHref, thumbOf } from "@/lib/catalog";

const SLIDE_MS = 6500;
const label = (g: Game) => CATEGORIES.find((c) => c.id === g.category)?.label ?? "Game";

export function Spotlight({ games }: { games: Game[] }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const [tick, setTick] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const n = games.length;
  const go = useCallback((k: number) => { setI(((k % n) + n) % n); setTick((t) => t + 1); }, [n]);
  useEffect(() => {
    if (hold || n < 2) return;
    const t = setTimeout(() => go(i + 1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, hold, n, go, tick]);
  const g = games[i];
  return (
    <section
      aria-roledescription="carousel" aria-label="Featured games"
      onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => { const s = touch.current; touch.current = null; if (!s) return; const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(i + (dx < 0 ? 1 : -1)); }}
      className="relative overflow-hidden rounded-[1.75rem] ring-1 ring-white/[0.09] transition-[background] duration-700"
      style={{ background: `radial-gradient(120% 140% at 0% 0%, ${g.accent}55 0%, transparent 55%), radial-gradient(100% 120% at 100% 100%, ${g.accent2}40 0%, transparent 60%), #160c33` }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
        {/* info */}
        <div className="relative order-2 flex flex-col justify-center gap-3 p-5 sm:p-7 md:order-1 md:p-9">
          <div key={`chips${i}`} className="flex flex-wrap gap-1.5 animate-[rise_0.4s_ease-out_both]">
            <span className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/90 uppercase ring-1 ring-white/15">{label(g)}</span>
            {is3D(g) && <span className="rounded-full bg-[#6d4aff] px-2.5 py-1 text-[11px] font-bold text-white">3D</span>}
            {isNew(g) && <span className="rounded-full bg-lime px-2.5 py-1 text-[11px] font-bold text-[#0b2a00]">NEW</span>}
          </div>
          <h2 key={`t${i}`} className="font-display text-[clamp(30px,6.5vw,56px)] leading-[0.95] text-white drop-shadow-[0_3px_0_rgb(0_0_0/0.25)] animate-[rise_0.5s_ease-out_both]">{g.title}</h2>
          <p key={`p${i}`} className="max-w-md text-[15px] leading-snug text-white/80 sm:text-base animate-[rise_0.6s_ease-out_both]">{g.tagline}</p>
          <div className="mt-1 flex flex-wrap gap-2.5">
            <Link href={playHref(g)} className="flex items-center gap-2 rounded-full bg-sun px-6 py-3 font-bold text-ink shadow-[0_10px_26px_-8px_rgb(255_210_90/0.8)] transition hover:brightness-105 active:scale-95"><Play className="size-5 fill-current" /> Play now</Link>
            <Link href={gameHref(g)} className="flex items-center gap-1.5 rounded-full bg-white/10 px-5 py-3 font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15"><Info className="size-4" /> Details</Link>
          </div>
          {/* progress dots */}
          <div className="mt-2 flex items-center gap-1.5" role="tablist">
            {games.map((x, k) => (
              <button key={x.slug} role="tab" aria-selected={k === i} aria-label={x.title} onClick={() => go(k)} className={`relative h-1.5 overflow-hidden rounded-full transition-all duration-300 ${k === i ? "w-9 bg-white/25" : "w-2.5 bg-white/25 hover:bg-white/45"}`}>
                {k === i && <span key={tick} className="absolute inset-y-0 left-0 rounded-full bg-sun" style={{ animation: hold ? "none" : `spot-progress ${SLIDE_MS}ms linear forwards`, width: hold ? "100%" : undefined }} />}
              </button>
            ))}
          </div>
        </div>
        {/* art */}
        <div className="relative order-1 aspect-video md:order-2 md:aspect-auto md:min-h-[360px]">
          {games.map((x, k) => (
            <Image key={x.slug} src={thumbOf(x)} alt={k === i ? `${x.title} game` : ""} fill priority={k === 0} sizes="(max-width: 768px) 100vw, 60vw"
              className={`object-cover transition-all duration-700 ${k === i ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"}`} />
          ))}
          <span className="pointer-events-none absolute inset-y-0 left-0 hidden w-24 bg-gradient-to-r from-[#160c33]/70 to-transparent md:block" />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#160c33]/80 to-transparent md:hidden" />
          <Link href={gameHref(g)} aria-label={g.title} className="absolute inset-0" />
        </div>
      </div>
      {/* picker strip (desktop) */}
      <div className="hidden gap-2 px-9 pb-6 lg:flex">
        {games.map((x, k) => (
          <button key={x.slug} onClick={() => go(k)} className={`group relative flex min-w-0 flex-1 items-center gap-2 rounded-xl p-1.5 pr-2 text-left transition ${k === i ? "bg-white/14 ring-1 ring-white/25" : "bg-black/15 hover:bg-white/8"}`}>
            <span className="relative block aspect-video w-16 shrink-0 overflow-hidden rounded-lg"><Image src={thumbOf(x)} alt="" fill sizes="64px" className="object-cover" /></span>
            <span className={`line-clamp-2 text-[12.5px] leading-tight font-bold ${k === i ? "text-white" : "text-white/70 group-hover:text-white"}`}>{x.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
