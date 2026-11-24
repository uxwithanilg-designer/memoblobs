import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { CATEGORIES, type Game } from "@/lib/game-index";
import { gameHref, is3D, isNew, thumbOf } from "@/lib/catalog";

const catLabel = (g: Game) => CATEGORIES.find((c) => c.id === g.category)?.label ?? "Game";

function Badges({ g, small = false }: { g: Game; small?: boolean }) {
  const fresh = isNew(g), three = is3D(g);
  if (!fresh && !three) return null;
  const pill = `rounded-full font-bold tracking-wide shadow-[0_2px_8px_rgb(0_0_0/0.35)] ${small ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]"}`;
  return (
    <span className="pointer-events-none absolute top-2 right-2 flex gap-1">
      {fresh && <span className={`${pill} bg-lime text-[#0b2a00]`}>NEW</span>}
      {three && <span className={`${pill} bg-[#6d4aff] text-white`}>3D</span>}
    </span>
  );
}

/**
 * A game card.
 * - "card" (default): the cover art on top and the title + category below — taller, readable on phones with no hover.
 * - "wide": a 16:9 tile with the title over a soft fade (continue-playing rows, small spaces).
 * - "feature" (or `big`): a large tile that fills its cell, title, tagline and a play button over the art.
 */
export function GameTile({ g, big = false, variant, priority = false, sizes, className = "" }: { g: Game; big?: boolean; variant?: "card" | "wide" | "feature"; priority?: boolean; sizes?: string; className?: string }) {
  const v = variant ?? (big ? "feature" : "card");
  const accent = g.accent ?? "#ffd25a";
  if (v === "card") {
    return (
      <Link
        href={gameHref(g)}
        aria-label={g.title}
        style={{ "--acc": accent } as React.CSSProperties}
        className={`tile group relative flex flex-col overflow-hidden rounded-2xl bg-[#1a1036] ring-1 ring-white/[0.07] transition duration-300 hover:z-10 hover:-translate-y-1 hover:ring-[color:var(--acc)]/70 hover:shadow-[0_22px_44px_-18px_var(--acc)] focus-visible:ring-2 focus-visible:ring-sun ${className}`}
      >
        <span className="relative block aspect-[16/10] overflow-hidden">
          <Image
            src={thumbOf(g)}
            alt={`${g.title} game`}
            fill
            priority={priority}
            sizes={sizes ?? "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 18vw"}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.07]"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#1a1036] to-transparent" />
          <Badges g={g} />
          <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100">
            <span className="grid size-11 scale-75 place-items-center rounded-full bg-sun text-ink shadow-[0_8px_24px_rgb(0_0_0/0.5)] transition duration-300 group-hover:scale-100"><Play className="ml-0.5 size-5 fill-current" /></span>
          </span>
        </span>
        <span className="relative flex min-h-[3.25rem] items-center gap-2 px-3 pt-1 pb-2.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] leading-tight font-bold text-white sm:text-[15px]">{g.title}</span>
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] font-medium text-faint">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: accent }} />{catLabel(g)}{is3D(g) ? " · 3D" : ""}
            </span>
          </span>
        </span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" style={{ background: `linear-gradient(90deg, ${accent}, ${g.accent2 ?? accent})` }} />
      </Link>
    );
  }
  if (v === "wide") {
    return (
      <Link href={gameHref(g)} aria-label={g.title} className={`tile group relative block aspect-video overflow-hidden rounded-2xl bg-[#1a1036] ring-1 ring-white/[0.07] transition duration-300 hover:-translate-y-0.5 hover:ring-white/25 focus-visible:ring-2 focus-visible:ring-sun ${className}`}>
        <Image src={thumbOf(g)} alt={`${g.title} game`} fill priority={priority} sizes={sizes ?? "(max-width: 640px) 60vw, 22vw"} className="object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pt-8 pb-2">
          <span className="block truncate text-sm font-bold text-white drop-shadow">{g.title}</span>
        </span>
        <Badges g={g} small />
      </Link>
    );
  }
  // feature
  return (
    <Link href={gameHref(g)} aria-label={g.title} style={{ "--acc": accent } as React.CSSProperties}
      className={`tile group relative block min-h-[200px] overflow-hidden rounded-3xl bg-[#1a1036] ring-1 ring-white/[0.08] transition duration-300 hover:-translate-y-1 hover:ring-[color:var(--acc)]/70 hover:shadow-[0_26px_50px_-20px_var(--acc)] focus-visible:ring-2 focus-visible:ring-sun ${className}`}>
      {/* the whole cover over a soft blurred copy of itself, so a tall cell never crops the art's logo */}
      <Image src={thumbOf(g)} alt="" fill sizes="30vw" className="scale-125 object-cover opacity-55 blur-2xl" />
      <span className="absolute inset-x-0 top-0 bottom-[22%] sm:bottom-[24%]">
        <Image src={thumbOf(g)} alt={`${g.title} game`} fill priority={priority} sizes={sizes ?? "(max-width: 768px) 92vw, 45vw"} className="object-contain object-center drop-shadow-[0_18px_30px_rgb(0_0_0/0.55)] transition-transform duration-700 group-hover:scale-[1.04]" />
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b0619] via-[#0b0619]/80 to-transparent px-4 pt-14 pb-4 sm:px-5">
        <span className="flex items-end gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-2xl leading-none text-white drop-shadow sm:text-3xl">{g.title}</span>
            <span className="mt-1 block truncate text-sm font-medium text-white/80">{g.short}</span>
          </span>
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sun text-ink shadow-[0_10px_24px_rgb(0_0_0/0.5)] transition duration-300 group-hover:scale-110"><Play className="ml-0.5 size-5 fill-current" /></span>
        </span>
      </span>
      <Badges g={g} />
    </Link>
  );
}

/** a compact list row: a small thumbnail, the title and its category (the game page's side list) */
export function GameListItem({ g }: { g: Game }) {
  return (
    <Link href={gameHref(g)} className="group flex items-center gap-3 rounded-2xl p-1.5 pr-3 transition hover:bg-white/[0.06]">
      <span className="relative block aspect-video w-[118px] shrink-0 overflow-hidden rounded-xl ring-1 ring-white/[0.07]">
        <Image src={thumbOf(g)} alt="" fill sizes="118px" className="object-cover transition-transform duration-500 group-hover:scale-[1.08]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] leading-tight font-bold text-white">{g.title}</span>
        <span className="mt-0.5 block truncate text-xs text-faint">{catLabel(g)}{is3D(g) ? " · 3D" : ""}{isNew(g) ? " · New" : ""}</span>
      </span>
    </Link>
  );
}
