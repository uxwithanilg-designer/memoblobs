"use client";
// A titled row of game tiles that scrolls sideways (arrow buttons on desktop, swipe on phones).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Game } from "@/lib/games";
import { GameTile } from "@/components/ui/GameTile";

export function RowTitle({ title, href, icon }: { title: string; href?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 px-0.5">
      {icon}
      {href ? (
        <Link href={href} className="group flex items-center gap-1 text-lg font-bold text-white sm:text-xl">
          {title}
          <ChevronRight className="size-5 text-white/50 transition group-hover:translate-x-0.5 group-hover:text-white" />
        </Link>
      ) : <h2 className="text-lg font-bold text-white sm:text-xl">{title}</h2>}
    </div>
  );
}

export function GameRow({ title, games, href, icon, priority = false }: { title: string; games: Game[]; href?: string; icon?: React.ReactNode; priority?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: true });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = () => setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    const raf = requestAnimationFrame(on);
    el.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  const go = (d: number) => { const el = box.current; if (el) el.scrollBy({ left: d * el.clientWidth * 0.85, behavior: "smooth" }); };
  if (!games.length) return null;
  const arrow = "absolute top-0 bottom-0 z-20 hidden w-12 items-center justify-center bg-gradient-to-r opacity-0 transition group-hover/row:opacity-100 md:flex";
  return (
    <section className="group/row relative">
      <RowTitle title={title} href={href} icon={icon} />
      <div className="relative">
        <div ref={box} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-4 px-4 py-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 sm:gap-3">
          {games.map((g, i) => (
            <div key={g.slug} className="w-[44%] shrink-0 snap-start xs:w-[40%] sm:w-[30%] md:w-[23%] lg:w-[18.6%] 2xl:w-[15.5%]">
              <GameTile g={g} priority={priority && i < 4} />
            </div>
          ))}
        </div>
        {edge.l && <button onClick={() => go(-1)} aria-label="Scroll left" className={`${arrow} -left-4 from-[#0b0619] to-transparent sm:-left-6`}><span className="grid size-9 place-items-center rounded-full bg-white/90 text-ink shadow-lg"><ChevronLeft className="size-5" /></span></button>}
        {edge.r && <button onClick={() => go(1)} aria-label="Scroll right" className={`${arrow} -right-4 from-transparent to-[#0b0619] sm:-right-6`}><span className="grid size-9 place-items-center rounded-full bg-white/90 text-ink shadow-lg"><ChevronRight className="size-5" /></span></button>}
      </div>
    </section>
  );
}

/** a plain responsive grid of tiles (category pages, search results) */
export function GameGrid({ games, priority = false }: { games: Game[]; priority?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {games.map((g, i) => <GameTile key={g.slug} g={g} priority={priority && i < 6} />)}
    </div>
  );
}
