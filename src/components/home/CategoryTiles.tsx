// Category tiles (home "Explore by category" and the Explore page) and the category chip bar under the home spotlight.
import Image from "next/image";
import Link from "next/link";
import { Box, ChevronRight, Sparkles, Flame } from "lucide-react";
import { CATEGORY_ICON } from "@/components/layout/nav";
import { CATEGORIES, type GameCard as Game } from "@/lib/game-index";
import { MOODS, categoryHref, thumbOf } from "@/lib/catalog";
import { GAMES_3D, NEW_GAMES, inCategory } from "@/lib/lists";

/** three real game covers fanned like a hand of cards; they spread on hover */
function Fan({ games }: { games: Game[] }) {
  // the category's top game sits in front, the next two fan out behind it
  const pos = [
    "left-1/2 top-0 z-10 -translate-x-1/2 group-hover:-translate-y-[5%] group-hover:scale-[1.04]",
    "left-0 top-[15%] -rotate-[9deg] group-hover:-translate-x-[5%] group-hover:-rotate-[13deg]",
    "right-0 top-[15%] rotate-[9deg] group-hover:translate-x-[5%] group-hover:rotate-[13deg]",
  ];
  return (
    <span className="pointer-events-none absolute inset-x-[4%] top-[7%] h-[60%]">
      {games.slice(0, 3).map((g, k) => (
        <span key={g.slug} className={`absolute block aspect-video w-[74%] overflow-hidden rounded-xl shadow-[0_14px_26px_-8px_rgb(0_0_0/0.8)] ring-2 ring-white/85 transition duration-500 ease-out ${pos[k]}`}>
          <Image src={thumbOf(g)} alt="" fill sizes="(max-width: 640px) 36vw, (max-width: 1024px) 22vw, 15vw" className="object-cover" />
        </span>
      ))}
    </span>
  );
}

function Tile({ href, label, count, games, from, to, icon }: { href: string; label: string; count: number; games: Game[]; from: string; to: string; icon: React.ReactNode }) {
  const lead = games[0];
  return (
    <Link href={href} className="group relative block h-44 overflow-hidden rounded-2xl ring-1 ring-white/[0.09] transition duration-300 hover:-translate-y-1 hover:ring-white/30 hover:shadow-[0_22px_44px_-18px_rgb(0_0_0/0.9)] sm:h-52"
      style={{ background: `linear-gradient(150deg, ${from}, ${to})` }}>
      {lead && <Image src={thumbOf(lead)} alt="" fill sizes="20vw" className="scale-125 object-cover opacity-30 blur-2xl" />}
      <span className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(90% 70% at 50% 25%, transparent, ${to}cc 80%)` }} />
      <Fan games={games} />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-black/70 via-black/35 to-transparent" />
      <span className="absolute inset-x-3 bottom-3 flex items-end gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] leading-tight font-bold text-white sm:text-lg">{label}</span>
          <span className="block text-xs font-semibold text-white/75">{count} games</span>
        </span>
        <span className="hidden size-8 shrink-0 place-items-center rounded-full bg-white text-ink transition duration-300 group-hover:translate-x-0.5 sm:grid"><ChevronRight className="size-4" /></span>
      </span>
    </Link>
  );
}

/** every category as a tile showing three of its real games (home "Explore by category" and the Explore page) */
export function CategoryTiles() {
  const lists = CATEGORIES.map((c) => ({ c, games: inCategory(c.id) }));
  // the 3D tile shows 3D games that don't already lead a category tile
  const shown = new Set(lists.flatMap((l) => l.games.slice(0, 3).map((g) => g.slug)));
  const three = [...GAMES_3D.filter((g) => !shown.has(g.slug)), ...GAMES_3D.filter((g) => shown.has(g.slug))];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
      {lists.map(({ c, games }) => {
        const { icon: Icon, color } = CATEGORY_ICON[c.id];
        const mood = MOODS.find((m) => m.href === categoryHref(c.id));
        return <Tile key={c.id} href={categoryHref(c.id)} label={c.label} count={games.length} games={games} from={mood?.from ?? "#2d1c5f"} to={mood?.to ?? "#160c33"} icon={<Icon className="size-5" style={{ color }} />} />;
      })}
      <Tile href="/c/3d" label="3D games" count={GAMES_3D.length} games={three} from="#4a2fd6" to="#1a1150" icon={<Box className="size-5 text-[#9FB8FF]" />} />
    </div>
  );
}

/** a sideways bar of category chips (scrolls on phones, wraps on wide screens) */
export function CategoryChips() {
  const chip = "flex shrink-0 items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-white/90 ring-1 ring-white/[0.08] transition hover:bg-white/[0.12] hover:text-white active:scale-95";
  return (
    <nav aria-label="Categories" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 xl:mx-0 xl:flex-wrap xl:px-0">
      <Link href="/new" className={chip}><Sparkles className="size-4 text-mint" /> New <span className="text-xs text-faint">{NEW_GAMES.length}</span></Link>
      <Link href="/top" className={chip}><Flame className="size-4 text-momo" /> Top picks</Link>
      <Link href="/c/3d" className={chip}><Box className="size-4 text-[#9FB8FF]" /> 3D <span className="text-xs text-faint">{GAMES_3D.length}</span></Link>
      {CATEGORIES.map((c) => {
        const { icon: Icon, color } = CATEGORY_ICON[c.id];
        return <Link key={c.id} href={categoryHref(c.id)} className={chip}><Icon className="size-4" style={{ color }} /> {c.label} <span className="text-xs text-faint">{inCategory(c.id).length}</span></Link>;
      })}
    </nav>
  );
}
