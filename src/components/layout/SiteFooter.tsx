import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { GAMES, CATEGORIES } from "@/lib/games";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-white/8 bg-ink/60">
      <div className="pointer-events-none absolute -top-16 right-6 hidden w-36 animate-[bob_3s_ease-in-out_infinite] md:block">
        <Image src="/brand/momo-wave.webp" alt="" width={240} height={178} />
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-6">
        <div>
          <Logo height={34} />
          <p className="mt-4 max-w-xs text-muted">{SITE.tagline}. Free claymation brain games for kids and families — no sign-up, nothing to download.</p>
          <div className="mt-5 flex gap-2">
            <a href={SITE.social.youtube} target="_blank" rel="noopener noreferrer" className="chip hover:bg-white/14">▶ YouTube</a>
            <a href={SITE.social.instagram} target="_blank" rel="noopener noreferrer" className="chip hover:bg-white/14">◎ Instagram</a>
          </div>
        </div>
        <div>
          <p className="mb-3 font-display text-lg">Games</p>
          <ul className="grid gap-2 text-muted">
            {GAMES.filter((g) => g.status === "live").slice(0, 8).map((g) => (
              <li key={g.slug}><Link className="hover:text-text" href={`/games/${g.slug}`}>{g.title}</Link></li>
            ))}
            <li><Link className="font-semibold text-sun hover:text-text" href="/games">All {GAMES.length} games →</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-display text-lg">Explore</p>
          <ul className="grid gap-2 text-muted">
            {CATEGORIES.slice(0, 4).map((c) => (
              <li key={c.id}><Link className="hover:text-text" href={`/games?category=${c.id}`}>{c.label} games</Link></li>
            ))}
            <li><Link className="hover:text-text" href="/characters">Characters</Link></li>
            <li><Link className="hover:text-text" href="/rewards">Rewards</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-display text-lg">Grown-ups</p>
          <ul className="grid gap-2 text-muted">
            <li><Link className="hover:text-text" href="/parents">Parents &amp; teachers</Link></li>
            <li><Link className="hover:text-text" href="/help">Help &amp; FAQ</Link></li>
            <li><Link className="hover:text-text" href="/about">About</Link></li>
            <li><Link className="hover:text-text" href="/privacy">Privacy</Link></li>
            <li><Link className="hover:text-text" href="/terms">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-6 text-sm text-faint md:flex-row lg:px-6">
          <p>© 2026 MOMOBLOBS. Handmade-style clay games.</p>
          <p>Made with clay, coffee and lots of cups 🥤</p>
        </div>
      </div>
    </footer>
  );
}
