"use client";
// The portal frame around every page: a top bar (menu, logo, search, coins, profile), a side menu that folds to an icon
// rail on desktop, a slide-in drawer and an app-style bottom tab bar on phones.
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, Dices, House, LayoutGrid, Menu, Search, UserRound, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { BuBirdLink } from "@/components/brand/BuBird";
import { CoinPill } from "@/components/brand/CoinPill";
import { SearchDialog } from "@/components/layout/SearchDialog";
import { CATEGORY_ICON, FOOTER_LINKS, NAV_MAIN, NAV_ME, type NavItem } from "@/components/layout/nav";
import { CATEGORIES } from "@/lib/game-index";
import { categoryHref, goToGame } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-data";
import { AVATARS, useHydrated, useProfile } from "@/lib/store";
import { SITE } from "@/lib/site";
import { audio } from "@/lib/audio";

type SbState = "auto" | "open" | "closed";
const SB_KEY = "momoblobs-sidebar";
const sbSub = (cb: () => void) => { window.addEventListener("momoblobs-sb", cb); window.addEventListener("storage", cb); return () => { window.removeEventListener("momoblobs-sb", cb); window.removeEventListener("storage", cb); }; };
const sbGet = (): SbState => { try { const v = localStorage.getItem(SB_KEY); return v === "open" || v === "closed" ? v : "auto"; } catch { return "auto"; } };

function Avatar({ size = 36 }: { size?: number }) {
  const ok = useHydrated();
  const id = useProfile((s) => s.avatar);
  const a = AVATARS.find((x) => x.id === (ok ? id : "momo")) ?? AVATARS[0];
  return (
    <Link href="/profile" aria-label="My profile" className="relative grid place-items-center overflow-hidden rounded-full bg-gradient-to-b from-violet to-cup ring-2 ring-white/15 transition hover:ring-sun/60 active:scale-95" style={{ width: size, height: size }}>
      <Image src={a.src} alt="" width={size * 2} height={size * 2} className="h-[115%] w-[115%] object-contain pt-1" />
    </Link>
  );
}

const isActive = (path: string, href: string) => (href === "/" || href === "/games" ? path === href : path === href || path.startsWith(`${href}/`));

function Item({ item, path, onNav }: { item: NavItem; path: string; onNav?: () => void }) {
  const on = isActive(path, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNav}
      title={item.label}
      aria-current={on ? "page" : undefined}
      className={`sb-item group relative flex h-11 items-center gap-3.5 rounded-xl px-3 font-semibold transition-colors ${on ? "bg-white/[0.09] text-white" : "text-white/75 hover:bg-white/[0.05] hover:text-white"}`}
    >
      {on && <span className="absolute top-2 bottom-2 left-0 w-1 rounded-full" style={{ background: item.color }} />}
      <Icon className="size-[22px] shrink-0 transition-transform group-hover:scale-110" style={{ color: item.color }} strokeWidth={2.2} />
      <span className="sb-label truncate text-[15px]">{item.label}</span>
    </Link>
  );
}

function SideMenu({ path, onNav }: { path: string; onNav?: () => void }) {
  const cats: NavItem[] = CATEGORIES.map((c) => ({ href: categoryHref(c.id), label: c.label, ...CATEGORY_ICON[c.id] }));
  return (
    <nav aria-label="Side menu" className="flex flex-col gap-0.5 px-2.5 py-3">
      {NAV_MAIN.map((i) => <Item key={i.href} item={i} path={path} onNav={onNav} />)}
      <div className="mx-3 my-2.5 h-px bg-white/[0.08]" />
      <p className="sb-label px-3 pt-1 pb-1.5 text-[11px] font-bold tracking-[0.14em] text-faint uppercase">Categories</p>
      {cats.map((i) => <Item key={i.href} item={i} path={path} onNav={onNav} />)}
      <div className="mx-3 my-2.5 h-px bg-white/[0.08]" />
      {NAV_ME.map((i) => <Item key={i.href} item={i} path={path} onNav={onNav} />)}
      <div className="sb-label mt-4 px-3 pb-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13px] font-medium text-faint">
          {FOOTER_LINKS.map((l) => <Link key={l.href} href={l.href} onClick={onNav} className="hover:text-white">{l.label}</Link>)}
        </div>
        <div className="mt-3 flex gap-2 text-[13px] font-semibold">
          <a href={SITE.social.youtube} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-white/75 hover:bg-white/10 hover:text-white">YouTube</a>
          <a href={SITE.social.instagram} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-white/75 hover:bg-white/10 hover:text-white">Instagram</a>
        </div>
        <p className="mt-3 text-xs text-faint/80">© MOMOBLOBS</p>
      </div>
    </nav>
  );
}

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/categories", label: "Explore", icon: LayoutGrid },
  { href: "#search", label: "Search", icon: Search },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/profile", label: "Me", icon: UserRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const sb = useSyncExternalStore(sbSub, sbGet, () => "auto" as SbState);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);

  const toggleSb = () => {
    const wide = window.matchMedia("(min-width: 1280px)").matches && !window.location.pathname.startsWith("/games/");
    const shownOpen = sb === "open" || (sb === "auto" && wide);
    try { localStorage.setItem(SB_KEY, shownOpen ? "closed" : "open"); } catch { /* storage blocked */ }
    window.dispatchEvent(new Event("momoblobs-sb"));
  };
  const menu = () => (window.matchMedia("(min-width: 1024px)").matches ? toggleSb() : setDrawer(true));

  // site pages are silent: whatever game music was playing stops when a site page shows
  useEffect(() => { audio.stopMusic(0.3); }, [path]);

  // close the drawer when the route changes
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setDrawer(false); }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = drawer ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [drawer]);

  // a random game: the games list loads on the first press (it isn't part of the site's code)
  const random = useCallback(() => {
    loadCatalog().then(({ games }) => { if (games.length) goToGame(games[Math.floor(Math.random() * games.length)]); }).catch(() => {});
  }, []);

  const iconBtn = "grid size-10 place-items-center rounded-full bg-white/[0.07] text-white/85 transition hover:bg-white/[0.13] hover:text-white active:scale-95";

  // game pages fold the menu to its icon rail (unless the player opened it) so the game gets the room
  const gamePage = path.startsWith("/games/");
  return (
    <div data-sb={gamePage && sb === "auto" ? "closed" : sb} className="app">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-sun focus:px-4 focus:py-2 focus:font-bold focus:text-ink">Skip to content</a>

      {/* ── top bar */}
      <header className="app-top fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#110a26]/92 backdrop-blur-xl" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 lg:px-4">
          <button onClick={menu} aria-label="Menu" className="grid size-10 shrink-0 place-items-center rounded-xl text-white/85 transition hover:bg-white/[0.08] active:scale-95">
            <Menu className="size-6" />
          </button>
          <Logo size={34} byline className="mr-1" />
          <button
            onClick={() => setSearch(true)}
            className="mx-auto hidden h-11 w-full max-w-xl items-center gap-3 rounded-full bg-white/[0.07] px-5 text-[15px] font-medium text-white/50 ring-1 ring-white/[0.06] transition hover:bg-white/[0.1] hover:text-white/70 md:flex"
          >
            <span className="flex-1 text-left">Search games and categories</span>
            <Search className="size-5" />
          </button>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <button onClick={() => setSearch(true)} aria-label="Search" className={`${iconBtn} md:hidden`}><Search className="size-5" /></button>
            <button onClick={random} aria-label="Random game" title="Random game" className={`${iconBtn} hidden md:grid`}><Dices className="size-5" /></button>
            <Link href="/saved" aria-label="Saved games" title="Saved games" className={`${iconBtn} hidden md:grid`}><Bookmark className="size-5" /></Link>
            <BuBirdLink />
            <CoinPill compact />
            <span className="hidden lg:block"><Avatar /></span>
          </div>
        </div>
      </header>

      {/* ── desktop side menu */}
      <aside className="app-sb no-scrollbar fixed bottom-0 left-0 z-40 hidden overflow-y-auto border-r border-white/[0.05] bg-[#0f0822] lg:block" style={{ top: "calc(4rem + var(--safe-top))" }}>
        <SideMenu path={path} />
      </aside>

      {/* ── phone drawer */}
      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-[70] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className="no-scrollbar absolute top-0 bottom-0 left-0 w-[84vw] max-w-[320px] overflow-y-auto bg-[#0f0822] shadow-2xl"
              style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
            >
              <div className="flex h-16 items-center gap-2 border-b border-white/[0.06] px-3">
                <Logo size={34} byline />
                <button onClick={() => setDrawer(false)} aria-label="Close menu" className="ml-auto grid size-10 place-items-center rounded-full bg-white/[0.07]"><X className="size-5" /></button>
              </div>
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                <Avatar size={40} />
                <div className="min-w-0 flex-1"><Nick /></div>
                <button onClick={random} className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-2 text-sm font-semibold"><Dices className="size-4" /> Random</button>
              </div>
              <SideMenu path={path} onNav={() => setDrawer(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── page */}
      <main id="main" className="app-main">
        {children}
      </main>

      {/* ── phone tab bar */}
      <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.07] bg-[#110a26]/95 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "var(--safe-bottom)" }}>
        <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = t.href !== "#search" && isActive(path, t.href);
            const cls = "relative flex flex-1 flex-col items-center justify-center gap-1 active:scale-95";
            const inner = (
              <>
                {on && <motion.span layoutId="tab-dot" className="absolute top-0 h-[3px] w-8 rounded-b-full bg-sun" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <Icon className={`size-6 ${on ? "text-sun" : "text-white/60"}`} strokeWidth={on ? 2.5 : 2} />
                <span className={`text-[11px] font-semibold ${on ? "text-white" : "text-white/55"}`}>{t.label}</span>
              </>
            );
            return t.href === "#search"
              ? <button key={t.href} onClick={() => setSearch(true)} className={cls}>{inner}</button>
              : <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={cls}>{inner}</Link>;
          })}
        </div>
      </nav>

      <SearchDialog open={search} onClose={() => setSearch(false)} />
    </div>
  );
}

function Nick() {
  const ok = useHydrated();
  const name = useProfile((s) => s.nickname);
  const coins = useProfile((s) => s.coins);
  return (
    <>
      <p className="truncate font-semibold">{ok ? name : "Player"}</p>
      <p className="text-xs text-faint">{ok ? `${coins.toLocaleString()} coins` : " "}</p>
    </>
  );
}
