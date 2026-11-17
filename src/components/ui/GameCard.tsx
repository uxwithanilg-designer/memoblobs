import Image from "next/image";
import Link from "next/link";
import { Lock, Play } from "lucide-react";
import type { Game } from "@/lib/games";
import { CATEGORIES } from "@/lib/games";

export function GameCard({ g, size = "md", priority = false }: { g: Game; size?: "md" | "lg"; priority?: boolean }) {
  const live = g.status === "live";
  const href = `/games/${g.slug}`;
  return (
    <article className={`group relative isolate overflow-hidden rounded-[1.6rem] ring-1 ring-white/12 transition-all duration-300 hover:-translate-y-1.5 hover:ring-white/30 hover:shadow-[0_30px_60px_-25px_var(--glow)] ${size === "lg" ? "aspect-[3/4]" : "aspect-[3/4]"}`} style={{ ["--glow" as string]: g.accent }}>
      <div className="absolute inset-0 -z-10" style={{ background: `radial-gradient(120% 80% at 50% 0%, ${g.accent}, ${g.accent2} 60%, #1b1040)` }} />
      <div className="sunburst absolute inset-0 -z-10 opacity-60 transition-transform duration-[2s] group-hover:rotate-12 group-hover:scale-125" />
      {live && g.art !== "character" ? (
        <Image src={g.cover} alt={`${g.title} game cover`} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px" priority={priority} className="-z-10 object-cover object-top transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-x-0 top-[9%] -z-10 flex h-[48%] justify-center">
          <Image src={g.character} alt={`${g.title} character`} width={360} height={360} className={`h-full w-[80%] object-contain drop-shadow-[0_18px_24px_rgb(0_0_0/0.45)] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3 ${live ? "" : "opacity-90"}`} />
        </div>
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
      <div className="absolute top-3 left-3 flex gap-1.5">
        {live ? <span className="chip !border-0 !bg-lime !text-ink shadow">● LIVE</span> : <span className="chip glass !text-text"><Lock className="size-3" /> SOON</span>}
      </div>
      <div className="absolute top-3 right-3 chip glass !text-[12px]">{g.ages}</div>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="font-display text-xl leading-none drop-shadow sm:text-2xl">{g.title}</h3>
        <p className="mt-1.5 line-clamp-2 hidden text-sm font-medium text-text/80 sm:block">{g.short}</p>
        <div className="mt-2 hidden flex-wrap gap-1.5 sm:flex">
          {g.categories.slice(0, 2).map((c) => {
            const cat = CATEGORIES.find((x) => x.id === c);
            return <span key={c} className="rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-bold backdrop-blur">{cat?.emoji} {cat?.label}</span>;
          })}
        </div>
        {live && (
          <span className="btn-clay sm mt-3 w-full"><Play className="size-4 fill-current" /> Play now</span>
        )}
      </div>
      <Link href={href} className="absolute inset-0 z-10" aria-label={`${g.title} — ${live ? "play now" : "coming soon"}`} />
    </article>
  );
}
