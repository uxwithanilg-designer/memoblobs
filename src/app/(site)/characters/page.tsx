import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Heart, Play } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { JsonLd } from "@/components/JsonLd";
import { CHARACTERS } from "@/lib/games";
import { abs } from "@/lib/site";

export const metadata: Metadata = {
  title: "Characters — Meet Momo, Kranky and Tiki",
  description: "Meet the MOMOBLOBS clay crew: Momo the orange blob who hides under cups, Kranky the sneaky shuffle-master crab, and Tiki the cheerful level-keeper bird.",
  alternates: { canonical: "/characters" },
  openGraph: { images: [{ url: "/games/momo-shuffle/shot-cast.webp", width: 1280, height: 720 }] },
};

export default function CharactersPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "MOMOBLOBS characters",
          itemListElement: CHARACTERS.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: { "@type": "Thing", name: c.name, description: c.bio, image: abs(c.img), url: abs(`/characters#${c.id}`) },
          })),
        }}
      />
      <PageHero kicker="The clay crew" title="Meet the gang" crumbs={[{ name: "Characters", href: "/characters" }]} intro="Every MOMOBLOBS game stars the same handmade-style clay friends — the very same characters from our videos." />
      <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:px-6">
        <Image src="/games/momo-shuffle/shot-cast.webp" alt="Momo, Kranky and Tiki on the clay game-show stage" width={1280} height={720} priority className="aspect-[16/7] w-full rounded-[2rem] object-cover ring-1 ring-white/15" />
        {CHARACTERS.map((c, i) => (
          <section key={c.id} id={c.id} className={`scroll-mt-24 grid items-center gap-6 overflow-hidden rounded-[2rem] p-6 ring-1 ring-white/12 sm:p-10 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`} style={{ background: `linear-gradient(140deg, ${c.color}55, #1b1040 65%)` }}>
            <div className="relative grid place-items-center">
              <div className="sunburst absolute size-[120%] animate-[spin-slow_70s_linear_infinite] rounded-full opacity-60" />
              <Image src={c.img} alt={`${c.name} — ${c.role}`} width={600} height={520} className="relative w-[78%] animate-float drop-shadow-[0_30px_40px_rgb(0_0_0/0.5)]" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: c.color }}>{c.role}</p>
              <h2 className="text-clay mt-1 text-6xl text-cream sm:text-7xl">{c.name}</h2>
              <p className="mt-4 text-lg text-muted">{c.bio}</p>
              <p className="mt-5 flex items-center gap-2 font-bold"><Heart className="size-5 fill-bubble text-bubble" /> Loves</p>
              <ul className="mt-2 flex flex-wrap gap-2">{c.likes.map((l) => <li key={l} className="chip">{l}</li>)}</ul>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/play/momo-shuffle" className="btn-clay"><Play className="size-5 fill-current" /> Play with {c.name}</Link>
                <Image src={c.alt} alt={`${c.name} another pose`} width={160} height={140} className="w-20 drop-shadow-xl" />
              </div>
            </div>
          </section>
        ))}
        <section className="glass rounded-[2rem] p-6 sm:p-8">
          <h2 className="font-display text-3xl">Momo&apos;s many faces</h2>
          <p className="mt-1 text-muted">Happy, sneaky, surprised, scared — Momo shows how he feels in every round.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[["momo-cheer", "Happy"], ["momo-sly", "Sneaky"], ["momo-surprised", "Surprised"], ["momo-scared", "Scared"], ["momo-wave", "Hello!"]].map(([f, l]) => (
              <figure key={f} className="rounded-2xl bg-white/5 p-3 text-center">
                <Image src={`/brand/${f}.webp`} alt={`Momo looking ${l.toLowerCase()}`} width={240} height={220} className="mx-auto h-28 w-auto object-contain drop-shadow-lg" />
                <figcaption className="mt-2 font-display">{l}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
