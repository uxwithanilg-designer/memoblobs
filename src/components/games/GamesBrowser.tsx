"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { CATEGORIES, type Category, type GameCard } from "@/lib/game-index";
import { PAGE_SIZE } from "@/lib/catalog";
import { useCatalog } from "@/lib/catalog-data";
import { CATEGORY_ICON } from "@/components/layout/nav";
import { GameGrid } from "@/components/home/GameRow";

/**
 * Search, sort and filter every game. `firstPage`: the top picks the page was built with (shown until something is
 * searched, sorted or filtered); the full list loads from /data/catalog.json only when it's needed.
 */
export function GamesBrowser({ firstPage, total }: { firstPage: GameCard[]; total: number }) {
  const sp = useSearchParams();
  const router = useRouter();
  const raw = sp.get("category");
  const cat = CATEGORIES.some((c) => c.id === raw) ? (raw as Category) : null;
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? "top";

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`/games${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };

  // a page of games at a time; a new search / sort / filter starts again at one page
  const view = `${cat}|${q}|${sort}`;
  const [page, setPage] = useState({ view, n: PAGE_SIZE });
  const n = page.view === view ? page.n : PAGE_SIZE;
  const changed = cat !== null || q.trim() !== "" || sort !== "top";
  const catalog = useCatalog(changed || n > PAGE_SIZE);

  const list = useMemo(() => {
    if (!catalog) return null;
    const base = sort === "new" ? catalog.newest : sort === "az" ? [...catalog.games].sort((a, b) => a.title.localeCompare(b.title)) : catalog.games;
    const s = q.trim().toLowerCase();
    return base.filter((g) => (!cat || g.category === cat) && (!s || `${g.title} ${g.short} ${g.tagline}`.toLowerCase().includes(s)));
  }, [catalog, cat, q, sort]);
  // until the list has loaded: the page's own first page (or nothing yet, for a search)
  const visible = list ? list.slice(0, n) : changed ? null : firstPage;
  const left = list ? list.length - n : changed ? 0 : total - firstPage.length;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-full bg-white/[0.07] px-4 ring-1 ring-white/[0.06] focus-within:ring-sun/50">
          <Search className="size-5 text-faint" />
          <input defaultValue={q} onChange={(e) => set("q", e.target.value || null)} placeholder="Search games…" aria-label="Search games" className="h-full flex-1 bg-transparent font-medium outline-none placeholder:text-faint" />
          {q && <button onClick={() => set("q", null)} aria-label="Clear search"><X className="size-4" /></button>}
        </label>
        <div role="radiogroup" aria-label="Sort" className="flex rounded-full bg-white/[0.07] p-1 ring-1 ring-white/[0.06]">
          {[["top", "Top picks"], ["new", "Newest"], ["az", "A–Z"]].map(([v, l]) => (
            <button key={v} role="radio" aria-checked={sort === v} onClick={() => set("sort", v === "top" ? null : v)} className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${sort === v ? "bg-sun text-ink" : "text-muted hover:text-white"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
        <button aria-pressed={!cat} onClick={() => set("category", null)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${!cat ? "bg-white text-ink ring-white" : "bg-white/[0.06] text-white/80 ring-white/[0.06] hover:bg-white/[0.1]"}`}>All</button>
        {CATEGORIES.map((c) => {
          const { icon: Icon, color } = CATEGORY_ICON[c.id];
          const on = cat === c.id;
          return (
            <button key={c.id} aria-pressed={on} onClick={() => set("category", on ? null : c.id)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${on ? "bg-white text-ink ring-white" : "bg-white/[0.06] text-white/80 ring-white/[0.06] hover:bg-white/[0.1]"}`}>
              <Icon className="size-4" style={{ color: on ? undefined : color }} /> {c.label}
            </button>
          );
        })}
      </div>
      {visible === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" aria-busy="true">
          {Array.from({ length: 10 }, (_, i) => <div key={i} className="aspect-[16/13] animate-pulse rounded-2xl bg-white/[0.05]" />)}
        </div>
      ) : visible.length > 0 ? (
        <>
          <GameGrid games={visible} />
          {left > 0 && (
            <div className="mt-6 flex justify-center">
              <button onClick={() => setPage({ view, n: n + PAGE_SIZE })} className="rounded-full bg-white/[0.08] px-6 py-3 font-bold text-white ring-1 ring-white/[0.08] transition hover:bg-white/[0.14] active:scale-95">
                {n > PAGE_SIZE && !catalog ? "Loading…" : "Show more games"} <span className="text-faint">({left})</span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl bg-white/[0.04] p-10 text-center ring-1 ring-white/[0.06]">
          <p className="text-lg font-bold">No games found</p>
          <p className="mt-1 text-sm text-muted">Try another word or category.</p>
        </div>
      )}
    </div>
  );
}
