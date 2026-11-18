import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { CATEGORIES } from "@/lib/games";
import { categoryHref } from "@/lib/catalog";
import { FOOTER_LINKS } from "@/components/layout/nav";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-white/[0.06] bg-[#0d0720]">
      <div className="mx-auto grid max-w-[1680px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo size={38} />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Free online games made by MOMOBLOBS — 3D runners, racing, action and brain games starring Momo and the clay crew. Play instantly in your browser on any phone, tablet or computer.
          </p>
          <div className="mt-4 flex gap-2 text-sm font-semibold">
            <a href={SITE.social.youtube} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/[0.07] px-3.5 py-1.5 hover:bg-white/[0.12]">YouTube</a>
            <a href={SITE.social.instagram} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/[0.07] px-3.5 py-1.5 hover:bg-white/[0.12]">Instagram</a>
          </div>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-faint uppercase">Categories</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {CATEGORIES.map((c) => <li key={c.id}><Link href={categoryHref(c.id)} className="text-white/75 hover:text-white">{c.label} games</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-faint uppercase">MOMOBLOBS</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <li><Link href="/games" className="text-white/75 hover:text-white">All games</Link></li>
            <li><Link href="/characters" className="text-white/75 hover:text-white">Characters</Link></li>
            {FOOTER_LINKS.map((l) => <li key={l.href}><Link href={l.href} className="text-white/75 hover:text-white">{l.label}</Link></li>)}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.05] px-4 py-4 text-center text-xs text-faint sm:px-6">© MOMOBLOBS · {SITE.tagline}</div>
    </footer>
  );
}
