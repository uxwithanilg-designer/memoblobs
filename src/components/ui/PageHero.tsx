import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { abs } from "@/lib/site";

export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  const all = [{ name: "Home", href: "/" }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-sm font-semibold text-faint">
        {all.map((b, i) => (
          <span key={b.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5" />}
            {i < all.length - 1 ? <Link href={b.href} className="hover:text-text">{b.name}</Link> : <span className="text-muted" aria-current="page">{b.name}</span>}
          </span>
        ))}
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, item: abs(b.href) })),
        }}
      />
    </>
  );
}

/** iOS-style large title header used on inner pages */
export function PageHero({
  title, kicker, intro, art, crumbs, children,
}: { title: string; kicker?: string; intro?: React.ReactNode; art?: { src: string; w: number; h: number }; crumbs?: { name: string; href: string }[]; children?: React.ReactNode }) {
  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-5 pb-7 sm:px-6 lg:pt-7">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex items-end gap-4">
        <div className="min-w-0 flex-1">
          {kicker && <p className="mb-1.5 text-xs font-bold tracking-[0.18em] text-momo uppercase">{kicker}</p>}
          <h1 className="text-3xl leading-tight font-bold text-white sm:text-4xl lg:text-5xl">{title}</h1>
          {intro && <div className="mt-3 max-w-2xl text-[17px] text-muted">{intro}</div>}
          {children}
        </div>
        {art && (
          <Image src={art.src} alt="" width={art.w} height={art.h} priority className="pointer-events-none -mb-2 hidden w-28 shrink-0 object-contain drop-shadow-[0_20px_30px_rgb(0_0_0/0.5)] sm:block lg:w-40" />
        )}
      </div>
    </section>
  );
}

export function SectionTitle({ title, kicker, action }: { title: string; kicker?: string; action?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {kicker && <p className="mb-1 text-xs font-bold tracking-[0.2em] text-momo uppercase">{kicker}</p>}
        <h2 className="text-2xl leading-tight font-bold text-white sm:text-[1.7rem]">{title}</h2>
      </div>
      {action && (
        <Link href={action.href} className="flex shrink-0 items-center gap-1 rounded-full bg-white/8 px-3.5 py-2 text-sm font-bold text-muted ring-1 ring-white/10 transition hover:bg-white/14 hover:text-text">
          {action.label} <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
