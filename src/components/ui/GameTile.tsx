import Image from "next/image";
import Link from "next/link";
import type { Game } from "@/lib/games";
import { gameHref, is3D, isNew, thumbOf } from "@/lib/catalog";

/** a 16:9 game thumbnail: the cover art, a NEW / 3D badge, and the title sliding up on hover */
export function GameTile({ g, big = false, priority = false, sizes, className = "" }: { g: Game; big?: boolean; priority?: boolean; sizes?: string; className?: string }) {
  const fresh = isNew(g);
  return (
    <Link
      href={gameHref(g)}
      aria-label={g.title}
      className={`tile group relative block aspect-video overflow-hidden rounded-xl bg-[#1b1236] ring-1 ring-white/[0.06] transition duration-200 hover:z-10 hover:-translate-y-0.5 hover:ring-2 hover:ring-sun/80 hover:shadow-[0_18px_40px_-14px_rgb(0_0_0/0.9)] focus-visible:ring-2 focus-visible:ring-sun ${big ? "md:aspect-auto md:h-full" : ""} ${className}`}
    >
      <Image
        src={thumbOf(g)}
        alt={`${g.title} game`}
        fill
        priority={priority}
        sizes={sizes ?? (big ? "(max-width: 768px) 90vw, 40vw" : "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 18vw")}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
      />
      <span className="pointer-events-none absolute top-2 left-2 flex gap-1">
        {fresh && <span className="rounded-md bg-lime px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[#0b2a00] shadow">NEW</span>}
        {is3D(g) && <span className="rounded-md bg-[#6d4aff] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow">3D</span>}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pt-6 pb-2.5 transition-transform duration-200 group-hover:translate-y-0 group-focus-visible:translate-y-0">
        <span className={`block truncate font-bold text-white drop-shadow ${big ? "text-lg" : "text-sm"}`}>{g.title}</span>
        {big && <span className="block truncate text-xs font-medium text-white/75">{g.short}</span>}
      </span>
    </Link>
  );
}
