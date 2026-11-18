import Link from "next/link";
import { Flame, Sparkles, Box } from "lucide-react";
import { GameRow, RowTitle } from "@/components/home/GameRow";
import { AppCard, ContinueRow, SavedRow } from "@/components/home/HomeClient";
import { GameTile } from "@/components/ui/GameTile";
import { JsonLd } from "@/components/JsonLd";
import { CATEGORY_ICON } from "@/components/layout/nav";
import { CATEGORIES, LIVE_GAMES } from "@/lib/games";
import { GAMES_3D, NEW_GAMES, TOP_PICKS, categoryHref, inCategory } from "@/lib/catalog";

const FAQ = [
  { q: "What is MOMOBLOBS?", a: "MOMOBLOBS is a free games website with 3D runners, racing games, action games and quick brain games, starring Momo the orange clay blob and the clay crew from the MOMOBLOBS videos." },
  { q: "Are the games free?", a: "Yes. Every MOMOBLOBS game is free to play in the browser, with no sign-up and nothing to download." },
  { q: "Do the games work on phones and tablets?", a: "Yes. Every game works on iPhone, iPad and Android phones and tablets as well as laptops and desktop computers. Add the site to your home screen for a full-screen app feel, or scan the QR code on any game page to open it on your phone." },
  { q: "How is my progress saved?", a: "Coins, levels, trophies, saved games and settings are kept in your browser on your own device. There is no account to make." },
  { q: "Which game should I play first?", a: "Try Kiko's Jungle Quest or Momo Dash for a big 3D run, Nitro Rush for racing, or Momo Shuffle for a quick brain challenge." },
];

export default function Home() {
  const [big1, a, b, c, d, big2] = TOP_PICKS;
  return (
    <div className="page grid gap-7 sm:gap-9">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <h1 className="sr-only">MOMOBLOBS — free online games</h1>

      {/* top picks mosaic */}
      <section>
        <RowTitle title="Top picks today" href="/top" icon={<Flame className="size-5 text-momo" />} />
        <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
          <GameTile g={big1} big priority />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {[a, b, c, d].map((g) => <GameTile key={g.slug} g={g} priority />)}
          </div>
          <div className="hidden xl:block"><GameTile g={big2} big priority className="h-full" /></div>
        </div>
      </section>

      <ContinueRow />
      <GameRow title="New games" href="/new" games={NEW_GAMES.slice(0, 16)} icon={<Sparkles className="size-5 text-mint" />} />
      <GameRow title="3D games" href="/c/3d" games={GAMES_3D} icon={<Box className="size-5 text-[#9FB8FF]" />} />
      <AppCard />
      <SavedRow />

      {CATEGORIES.map((c) => {
        const { icon: Icon, color } = CATEGORY_ICON[c.id];
        return <GameRow key={c.id} title={`${c.label} games`} href={categoryHref(c.id)} games={inCategory(c.id)} icon={<Icon className="size-5" style={{ color }} />} />;
      })}

      {/* explore by category */}
      <section>
        <RowTitle title="Explore by category" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => {
            const { icon: Icon, color } = CATEGORY_ICON[c.id];
            return (
              <Link key={c.id} href={categoryHref(c.id)} className="group flex items-center gap-3 rounded-xl bg-white/[0.05] p-3 ring-1 ring-white/[0.06] transition hover:bg-white/[0.09] hover:ring-white/15">
                <span className="grid size-10 place-items-center rounded-lg" style={{ background: `${color}22` }}><Icon className="size-5" style={{ color }} /></span>
                <span className="min-w-0">
                  <span className="block font-bold text-white">{c.label}</span>
                  <span className="block text-xs text-faint">{inCategory(c.id).length} games</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* about */}
      <section className="grid gap-6 rounded-2xl bg-white/[0.035] p-5 ring-1 ring-white/[0.06] sm:p-7 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="text-2xl font-bold text-white">Free online games at MOMOBLOBS</h2>
          <div className="mt-3 grid gap-3 text-[15px] leading-relaxed text-muted">
            <p>MOMOBLOBS has {LIVE_GAMES.length} free games you can play instantly in your browser — no download, no sign-up. Run through 300 jungle places in <Link className="text-sun hover:underline" href="/games/kiko-jungle-quest">Kiko&apos;s Jungle Quest</Link>, dash across twelve worlds in <Link className="text-sun hover:underline" href="/games/momo-dash">Momo Dash</Link>, race 30+ cars in <Link className="text-sun hover:underline" href="/games/nitro-rush">Nitro Rush</Link> or lead a giant crowd in <Link className="text-sun hover:underline" href="/games/blob-brigade">Blob Brigade</Link>.</p>
            <p>Every game is made in-house with our own clay characters — Momo, Kranky, Tiki and friends — and works on phones, tablets and computers. Your coins, trophies and saved games stay on your device.</p>
          </div>
        </div>
        <div className="grid gap-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl bg-white/[0.04] px-4 py-3 open:bg-white/[0.07]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-white">
                {f.q}
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-sm transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
