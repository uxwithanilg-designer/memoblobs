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
      <div className="flex items-center gap-3.5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${color}22`, color }}>{icon}</span>
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-bold text-white sm:text-3xl">{title}</h1>
          {(count != null || blurb) && <p className="mt-0.5 text-sm text-muted">{count != null && <span className="font-semibold text-white/80">{count} games</span>}{count != null && blurb ? " · " : ""}{blurb}</p>}
        </div>
      </div>
    </header>
  );
}
