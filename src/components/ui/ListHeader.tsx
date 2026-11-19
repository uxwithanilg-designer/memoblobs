import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** the header of a list page: breadcrumb, icon, title, count and a line about it */
export function ListHeader({ title, icon, color = "#FFD25A", count, blurb, crumb = true }: { title: string; icon: React.ReactNode; color?: string; count?: number; blurb?: string; crumb?: boolean }) {
  return (
    <header className="mb-5">
      {crumb && (
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-sm font-medium text-faint">
          <Link href="/" className="hover:text-white">Home</Link><ChevronRight className="size-3.5" /><span className="text-white/80">{title}</span>
        </nav>
      )}
      <div className="relative flex items-center gap-4 overflow-hidden rounded-[1.5rem] p-4 ring-1 ring-white/[0.07] sm:p-6" style={{ background: `radial-gradient(90% 160% at 0% 0%, ${color}33, transparent 60%), linear-gradient(135deg, #1d1240, #120a2a)` }}>
        <span className="pointer-events-none absolute -right-10 -bottom-16 size-56 rounded-full opacity-20 blur-3xl" style={{ background: color }} />
        <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl ring-1 ring-white/10 sm:size-16" style={{ background: `${color}26`, color }}>{icon}</span>
        <div className="relative min-w-0">
          <h1 className="font-display text-3xl leading-none text-white sm:text-4xl">{title}</h1>
          {(count != null || blurb) && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              {count != null && <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white">{count} games</span>}
              {blurb && <span>{blurb}</span>}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
