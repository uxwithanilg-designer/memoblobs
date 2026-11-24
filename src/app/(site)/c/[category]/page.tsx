import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Box } from "lucide-react";
import { GameGridMore, GameRow } from "@/components/home/GameRow";
import { ListHeader } from "@/components/ui/ListHeader";
import { CATEGORY_ICON } from "@/components/layout/nav";
import { CATEGORIES, type Category } from "@/lib/categories";
import { ALL_PLAYABLE, GAMES_3D, inCategory } from "@/lib/lists";
import { PAGE_SIZE, ROW_SIZE } from "@/lib/catalog";

const BLURB: Record<string, string> = {
  "3d": "Big 3D runners, racers and adventures that play right in your browser.",
};
const find = (id: string) => (id === "3d" ? { id, label: "3D", blurb: BLURB["3d"] } : CATEGORIES.find((c) => c.id === id));

export function generateStaticParams() {
  return [...CATEGORIES.map((c) => ({ category: c.id })), { category: "3d" }];
}

export async function generateMetadata({ params }: PageProps<"/c/[category]">): Promise<Metadata> {
  const { category } = await params;
  const c = find(category);
  if (!c) return {};
  const title = `${c.label} Games — Play Free Online`;
  return { title, description: `Play free ${c.label.toLowerCase()} games online at MOMOBLOBS. ${c.blurb} No download, no sign-up.`, alternates: { canonical: `/c/${category}` } };
}

async function List({ params }: { params: PageProps<"/c/[category]">["params"] }) {
  const { category } = await params;
  const c = find(category);
  if (!c) notFound();
  const games = category === "3d" ? GAMES_3D : inCategory(category as Category);
  const meta = category === "3d" ? { icon: Box, color: "#9FB8FF" } : CATEGORY_ICON[category as Category];
  const Icon = meta.icon;
  return (
    <>
      <ListHeader title={`${c.label} games`} icon={<Icon className="size-6" />} color={meta.color} count={games.length} blurb={c.blurb} />
      <GameGridMore games={games.slice(0, PAGE_SIZE)} total={games.length} list={category === "3d" ? "3d" : `c:${category}`} priority />
      <div className="mt-10"><GameRow title="More games you might like" href="/top" games={ALL_PLAYABLE.filter((g) => !games.includes(g)).slice(0, Math.min(16, ROW_SIZE))} /></div>
    </>
  );
}

export default function CategoryPage({ params }: PageProps<"/c/[category]">) {
  return (
    <div className="page">
      <Suspense fallback={<div className="h-[50vh]" />}><List params={params} /></Suspense>
    </div>
  );
}
