import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Box, Clock, Flame, LayoutGrid, Sparkles, Bookmark } from "lucide-react";
import { ListHeader } from "@/components/ui/ListHeader";
import { CATEGORY_ICON } from "@/components/layout/nav";
import { CATEGORIES } from "@/lib/games";
import { GAMES_3D, MOODS, categoryHref, inCategory } from "@/lib/catalog";

export const metadata: Metadata = { title: "Game Categories", description: "Browse MOMOBLOBS games by category: action, adventure, racing, brain, puzzle, memory, focus, speed and number games.", alternates: { canonical: "/categories" } };

const LISTS = [
  { href: "/top", label: "Top picks", icon: Flame, color: "#FF8A3D" },
  { href: "/new", label: "New games", icon: Sparkles, color: "#7FF0E6" },
  { href: "/c/3d", label: "3D games", icon: Box, color: "#9FB8FF" },
  { href: "/recent", label: "Recently played", icon: Clock, color: "#B9AEDB" },
  { href: "/saved", label: "Saved", icon: Bookmark, color: "#FF6F91" },
];

export default function CategoriesPage() {
  return (
    <div className="page">
      <ListHeader title="Explore" icon={<LayoutGrid className="size-6" />} blurb="Every category in one place." />
      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        {LISTS.map((l) => (
          <Link key={l.href} href={l.href} className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/[0.06] hover:bg-white/[0.12]">
            <l.icon className="size-4" style={{ color: l.color }} /> {l.label}
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {CATEGORIES.map((c) => {
          const { icon: Icon, color } = CATEGORY_ICON[c.id];
          const mood = MOODS.find((m) => m.href === categoryHref(c.id));
          return (
            <Link key={c.id} href={categoryHref(c.id)} className="group relative flex h-28 items-end overflow-hidden rounded-2xl p-3.5 ring-1 ring-white/[0.07] transition hover:-translate-y-0.5 hover:ring-white/20 sm:h-32" style={{ background: `linear-gradient(135deg, ${mood?.from ?? "#2d1c5f"}, ${mood?.to ?? "#160c33"})` }}>
              {mood && <Image src={mood.img} alt="" width={140} height={140} className="absolute -top-1 -right-2 h-[74%] w-auto object-contain drop-shadow-[0_8px_12px_rgb(0_0_0/0.45)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />}
              <span className="relative">
                <Icon className="mb-1.5 size-6" style={{ color }} />
                <span className="block text-lg leading-tight font-bold text-white">{c.label}</span>
                <span className="block text-xs font-medium text-white/70">{inCategory(c.id).length} games</span>
              </span>
            </Link>
          );
        })}
        <Link href="/c/3d" className="group relative flex h-28 items-end overflow-hidden rounded-2xl bg-gradient-to-br from-[#4a2fd6] to-[#1a1150] p-3.5 ring-1 ring-white/[0.07] transition hover:-translate-y-0.5 hover:ring-white/20 sm:h-32">
          <Image src="/brand/momo-cheer.webp" alt="" width={140} height={140} className="absolute -top-1 -right-2 h-[74%] w-auto object-contain drop-shadow-[0_8px_12px_rgb(0_0_0/0.45)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
          <span className="relative">
            <Box className="mb-1.5 size-6 text-[#9FB8FF]" />
            <span className="block text-lg leading-tight font-bold text-white">3D games</span>
            <span className="block text-xs font-medium text-white/70">{GAMES_3D.length} games</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
