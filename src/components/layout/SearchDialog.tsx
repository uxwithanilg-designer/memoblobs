"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Search, X } from "lucide-react";
import { GAMES } from "@/lib/games";
import { ALL_PAGES } from "@/components/layout/nav";

type Item = { href: string; title: string; sub: string; img?: string; emoji?: string; accent?: string };

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const items = useMemo<Item[]>(() => {
    const games: Item[] = GAMES.map((g) => ({
      href: g.status === "live" ? `/play/${g.slug}` : `/games/${g.slug}`,
      title: g.title,
      sub: g.status === "live" ? `Play now · ${g.short}` : "Coming soon",
      img: g.character,
      accent: g.accent,
    }));
    const pages: Item[] = ALL_PAGES.map((p) => ({ href: p.href, title: p.label, sub: p.desc, emoji: p.emoji }));
    const all = [...games, ...pages];
    const s = q.trim().toLowerCase();
    if (!s) return all.slice(0, 9);
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
            className="glass-strong relative w-full max-w-xl overflow-hidden rounded-3xl shadow-2xl"
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
                placeholder="Search games and pages…"
                className="h-14 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-faint"
                aria-label="Search games and pages"
              />
              <button onClick={onClose} aria-label="Close search" className="grid size-9 place-items-center rounded-full bg-white/10"><X className="size-4" /></button>
            </div>
            <ul className="max-h-[60dvh] overflow-y-auto p-2" role="listbox">
              {items.length === 0 && <li className="p-6 text-center text-muted">No results. Try “Momo” or “cups”.</li>}
              {items.map((i, k) => (
                <li key={i.href + i.title} role="option" aria-selected={k === sel}>
                  <button
                    onMouseEnter={() => setSel(k)}
                    onClick={() => go(i)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${k === sel ? "bg-white/10" : ""}`}
                  >
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/8 text-2xl" style={i.accent ? { background: `linear-gradient(135deg, ${i.accent}, #2d1c5f)` } : undefined}>
                      {i.img ? <Image src={i.img} alt="" width={44} height={44} className="size-10 object-contain" /> : i.emoji}
                    </span>
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
