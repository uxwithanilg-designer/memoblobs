"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Menu, Search, Settings, X, Play, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { CoinPill } from "@/components/brand/CoinPill";
import { SearchDialog } from "@/components/layout/SearchDialog";
import { NAV, ALL_PAGES } from "@/components/layout/nav";
import { CATEGORIES, GAMES } from "@/lib/games";
import { AVATARS, useHydrated, useProfile } from "@/lib/store";

function Avatar({ size = 40 }: { size?: number }) {
  const ok = useHydrated();
  const id = useProfile((s) => s.avatar);
  const a = AVATARS.find((x) => x.id === (ok ? id : "momo")) ?? AVATARS[0];
  return (
    <Link href="/profile" aria-label="My profile" className="relative grid place-items-center overflow-hidden rounded-full bg-gradient-to-b from-violet to-cup ring-2 ring-white/25 transition-transform hover:scale-105 active:scale-95" style={{ width: size, height: size }}>
      <Image src={a.src} alt="" width={size * 2} height={size * 2} className="h-[115%] w-[115%] object-contain pt-1" />
    </Link>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const [mega, setMega] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeT = useRef<number>(0);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  // close the menus when the route changes
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setMega(false); setMenu(false); }

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const openMega = () => { window.clearTimeout(closeT.current); setMega(true); };
  const closeMega = () => { closeT.current = window.setTimeout(() => setMega(false), 140); };

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "glass-strong shadow-[0_10px_30px_-18px_rgb(0_0_0/0.8)]" : "bg-transparent"}`}
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:h-[4.5rem] lg:px-6">
          <span className="flex lg:hidden"><Logo priority height={26} /></span>
          <span className="hidden lg:flex"><Logo priority height={38} /></span>

          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV.map((n) =>
              "mega" in n && n.mega ? (
                <div key={n.href} className="relative" onMouseEnter={openMega} onMouseLeave={closeMega}>
                  <Link
                    href={n.href}
                    aria-expanded={mega}
                    aria-haspopup="true"
                    onFocus={openMega}
                    className={`flex items-center gap-1 rounded-full px-4 py-2 font-semibold transition-colors ${active(n.href) ? "bg-white/12 text-text" : "text-muted hover:bg-white/8 hover:text-text"}`}
                  >
                    {n.label}
                    <ChevronDown className={`size-4 transition-transform ${mega ? "rotate-180" : ""}`} />
                  </Link>
                </div>
              ) : (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={`rounded-full px-4 py-2 font-semibold transition-colors ${active(n.href) ? "bg-white/12 text-text" : "text-muted hover:bg-white/8 hover:text-text"}`}
                >
                  {n.label}
                </Link>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSearch(true)}
              className="hidden h-10 items-center gap-2 rounded-full bg-white/8 px-4 text-sm font-semibold text-muted ring-1 ring-white/10 transition hover:bg-white/12 hover:text-text md:flex"
            >
              <Search className="size-4" /> Search games
              <kbd className="ml-2 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-faint">⌘K</kbd>
            </button>
            <button onClick={() => setSearch(true)} aria-label="Search" className="grid size-10 place-items-center rounded-full bg-white/8 ring-1 ring-white/10 md:hidden">
              <Search className="size-5" />
            </button>
            <CoinPill compact />
            <Link href="/settings" aria-label="Settings" className="hidden size-10 place-items-center rounded-full bg-white/8 ring-1 ring-white/10 transition hover:bg-white/14 lg:grid">
              <Settings className="size-5" />
            </Link>
            <div className="hidden lg:block"><Avatar /></div>
            <Link href="/play/momo-shuffle" className="btn-clay sm hidden lg:inline-flex"><Play className="size-4 fill-current" /> Play</Link>
            <button onClick={() => setMenu(true)} aria-label="Open menu" className="grid size-10 place-items-center rounded-full bg-white/8 ring-1 ring-white/10 lg:hidden">
              <Menu className="size-5" />
            </button>
          </div>
        </div>

        {/* mega menu */}
        <AnimatePresence>
          {mega && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              onMouseEnter={openMega}
              onMouseLeave={closeMega}
              className="absolute inset-x-0 top-full hidden lg:block"
            >
              <div className="mx-auto max-w-7xl px-6">
                <div className="glass-strong grid grid-cols-[1.25fr_1fr_1fr] gap-6 rounded-3xl p-6 shadow-2xl">
                  <Link href="/games/momo-shuffle" className="group relative overflow-hidden rounded-2xl ring-1 ring-white/10">
                    <Image src="/games/momo-shuffle/hero.webp" alt="Momo Shuffle" width={640} height={360} className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
                      <div>
                        <span className="chip !bg-momo !text-ink"><Sparkles className="size-3.5" /> Featured</span>
                        <p className="mt-2 font-display text-2xl">Momo Shuffle</p>
                        <p className="text-sm text-muted">Track Momo under 3, 4 or 6 cups</p>
                      </div>
                      <span className="btn-clay sm"><Play className="size-4 fill-current" /> Play</span>
                    </div>
                  </Link>
                  <div>
                    <p className="mb-3 text-xs font-bold tracking-widest text-faint uppercase">Categories</p>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.map((c) => (
                        <Link key={c.id} href={`/games?category=${c.id}`} className="flex items-center gap-2 rounded-xl px-3 py-2.5 font-semibold transition hover:bg-white/8">
                          <span className="text-xl">{c.emoji}</span> {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-bold tracking-widest text-faint uppercase">Play now</p>
                    <ul className="grid gap-1.5">
                      {GAMES.filter((g) => g.status === "live").slice(0, 6).map((g) => (
                        <li key={g.slug}>
                          <Link href={`/games/${g.slug}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/8">
                            <span className="grid size-10 place-items-center overflow-hidden rounded-lg" style={{ background: `linear-gradient(135deg, ${g.accent}, ${g.accent2})` }}>
                              <Image src={g.character} alt="" width={40} height={40} className="size-9 object-contain" />
                            </span>
                            <span className="flex-1">
                              <span className="block font-semibold leading-tight">{g.title}</span>
                              <span className="text-xs text-faint">{g.status === "live" ? g.short : "Coming soon"}</span>
                            </span>
                            {g.status === "live" ? <span className="chip !py-0.5 !text-[11px] !bg-lime !text-ink">PLAY</span> : <span className="chip !py-0.5 !text-[11px]">SOON</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link href="/games" className="mt-2 block rounded-xl px-2 py-1.5 text-sm font-bold text-sun hover:bg-white/8">All {GAMES.length} games →</Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* mobile full menu sheet */}
      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-[70] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={() => setMenu(false)} />
            <motion.nav
              aria-label="All pages"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="glass-strong absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[2rem] px-4 pt-3"
              style={{ paddingBottom: "calc(var(--safe-bottom) + 1.5rem)" }}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25" />
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-2xl">Menu</p>
                <button onClick={() => setMenu(false)} aria-label="Close menu" className="grid size-10 place-items-center rounded-full bg-white/10"><X className="size-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {ALL_PAGES.map((p) => (
                  <Link key={p.href} href={p.href} className="glass flex min-h-20 flex-col justify-between rounded-2xl p-3.5 active:scale-[0.98]">
                    <span className="text-2xl">{p.emoji}</span>
                    <span className="font-semibold leading-tight">{p.label}</span>
                  </Link>
                ))}
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
      <SearchDialog open={search} onClose={() => setSearch(false)} />
    </>
  );
}
