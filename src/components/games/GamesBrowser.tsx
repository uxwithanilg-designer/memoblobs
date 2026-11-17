"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { CATEGORIES, GAMES, type Category } from "@/lib/games";
import { GameCard } from "@/components/ui/GameCard";

export function GamesBrowser() {
  const sp = useSearchParams();
  const router = useRouter();
  const cat = (sp.get("category") as Category | null) ?? null;
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? "popular";

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`/games${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };

  const list = useMemo(() => {
    let l = GAMES.filter((g) => (!cat || g.categories.includes(cat)) && (!q || `${g.title} ${g.short} ${g.tagline}`.toLowerCase().includes(q.toLowerCase())));
    if (sort === "az") l = [...l].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "popular") l = [...l].sort((a, b) => (a.status === b.status ? 0 : a.status === "live" ? -1 : 1));
    return l;
  }, [cat, q, sort]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="glass flex h-12 flex-1 items-center gap-2 rounded-2xl px-4">
          <Search className="size-5 text-faint" />
          <input
            defaultValue={q}
            onChange={(e) => set("q", e.target.value || null)}
            placeholder="Search games…"
            aria-label="Search games"
            className="h-full flex-1 bg-transparent font-medium outline-none placeholder:text-faint"
          />
          {q && <button onClick={() => set("q", null)} aria-label="Clear search"><X className="size-4" /></button>}
        </label>
        <div role="radiogroup" aria-label="Sort" className="flex rounded-2xl bg-white/8 p-1 ring-1 ring-white/10">
          {[["popular", "Popular"], ["new", "Newest"], ["az", "A–Z"]].map(([v, l]) => (
            <button key={v} role="radio" aria-checked={sort === v} onClick={() => set("sort", v === "popular" ? null : v)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${sort === v ? "bg-sun text-ink" : "text-muted hover:text-text"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="no-scrollbar -mx-5 mb-6 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
        <button aria-pressed={!cat} onClick={() => set("category", null)} className="chip shrink-0 !px-4 !py-2">✨ All</button>
        {CATEGORIES.map((c) => (
          <button key={c.id} aria-pressed={cat === c.id} onClick={() => set("category", cat === c.id ? null : c.id)} className="chip shrink-0 !px-4 !py-2">{c.emoji} {c.label}</button>
        ))}
      </div>
      {cat && <p className="mb-4 text-muted">{CATEGORIES.find((c) => c.id === cat)?.blurb}</p>}
      <motion.div layout className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {list.map((g) => (
            <motion.div key={g.slug} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <GameCard g={g} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {list.length === 0 && (
        <div className="glass mt-4 rounded-3xl p-10 text-center">
          <p className="font-display text-2xl">No games found</p>
          <p className="mt-1 text-muted">Kranky must have hidden them! Try another word.</p>
        </div>
      )}
    </div>
  );
}
