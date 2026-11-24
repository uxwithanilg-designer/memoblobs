"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Search, X } from "lucide-react";
import { CATEGORIES } from "@/lib/game-index";
import { ALL_PLAYABLE, categoryHref, gameHref, thumbOf } from "@/lib/catalog";
import { ALL_PAGES } from "@/components/layout/nav";

type Item = { href: string; title: string; sub: string; img?: string; emoji?: string; accent?: string; thumb?: boolean };

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const items = useMemo<Item[]>(() => {
    const games: Item[] = ALL_PLAYABLE.map((g) => ({
      href: gameHref(g),
      title: g.title,
      sub: `${g.short} · ${CATEGORIES.find((x) => x.id === g.category)?.label ?? ""}`,
      img: thumbOf(g),
      thumb: true,
    }));
    const cats: Item[] = CATEGORIES.map((c) => ({ href: categoryHref(c.id), title: `${c.label} games`, sub: c.blurb, emoji: c.emoji }));
    const pages: Item[] = ALL_PAGES.map((p) => ({ href: p.href, title: p.label, sub: p.desc, emoji: p.emoji }));
    const all = [...games, ...cats, ...pages];
    const s = q.trim().toLowerCase();
    if (!s) return games.slice(0, 8);
    return all.filter((i) => `${i.title} ${i.sub}`.toLowerCase().includes(s)).slice(0, 12);
  }, [q]);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setQ(""); setSel(0); }
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 50);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { clearTimeout(t); window.removeEventListener("keydown", esc); };
  }, [open, onClose]);

  const go = (i: Item) => { onClose(); router.push(i.href); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-start justify-center p-3 pt-[calc(var(--safe-top)+4rem)] sm:pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={{ y: -16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -16, scale: 0.97 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-[#160d31] shadow-2xl ring-1 ring-white/10"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search className="size-5 text-faint" />
              <input
                ref={input}
                value={q}
                onChange={(e) => { setQ(e.target.value); setSel(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
                  if (e.key === "Enter" && items[sel]) go(items[sel]);
                }}
                placeholder="Search games and categories…"
                className="h-14 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-faint"
                aria-label="Search games and pages"
              />
              <button onClick={onClose} aria-label="Close search" className="grid size-9 place-items-center rounded-full bg-white/10"><X className="size-4" /></button>
            </div>
            <ul className="max-h-[60dvh] overflow-y-auto p-2" role="listbox">
              {!q.trim() && <li className="px-3 pt-2 pb-1 text-xs font-bold tracking-[0.14em] text-faint uppercase">Top picks</li>}
              {items.length === 0 && <li className="p-6 text-center text-muted">No results. Try “race”, “jungle” or “memory”.</li>}
              {items.map((i, k) => (
                <li key={i.href + i.title} role="option" aria-selected={k === sel}>
                  <button
                    onMouseEnter={() => setSel(k)}
                    onClick={() => go(i)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${k === sel ? "bg-white/10" : ""}`}
                  >
                    {i.thumb && i.img ? (
                      <Image src={i.img} alt="" width={96} height={54} className="aspect-video w-20 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
                    ) : (
                      <span className="grid aspect-video w-20 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-2xl">{i.emoji}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{i.title}</span>
                      <span className="block truncate text-sm text-faint">{i.sub}</span>
                    </span>
                    {k === sel && <CornerDownLeft className="size-4 text-faint" />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
