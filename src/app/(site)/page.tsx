import { Flame, Sparkles, Box, LayoutGrid } from "lucide-react";
import { GameRow, RowTitle } from "@/components/home/GameRow";
import { AppCard, ContinueRow, SavedRow } from "@/components/home/HomeClient";
import { Spotlight } from "@/components/home/Spotlight";
import { CategoryChips, CategoryTiles } from "@/components/home/CategoryTiles";
import { GameTile } from "@/components/ui/GameTile";
import { JsonLd } from "@/components/JsonLd";
import { CATEGORY_ICON } from "@/components/layout/nav";
import { CATEGORIES } from "@/lib/categories";
import { ALL_PLAYABLE, GAMES_3D, NEW_GAMES, TOP_PICKS, inCategory } from "@/lib/lists";
import { ROW_SIZE, categoryHref, gameHref } from "@/lib/catalog";

const FAQ = [
  { q: "What is MOMOBLOBS?", a: "MOMOBLOBS is a free games website with 3D runners, racing games, action games and quick brain games, starring Momo the orange clay blob and the clay crew from the MOMOBLOBS videos." },
  { q: "Are the games free?", a: "Yes. Every MOMOBLOBS game is free to play in the browser, with no sign-up and nothing to download." },
  { q: "Do the games work on phones and tablets?", a: "Yes. Every game works on iPhone, iPad and Android phones and tablets as well as laptops and desktop computers. Add the site to your home screen for a full-screen app feel, or scan the QR code on any game page to open it on your phone." },
  { q: "How is my progress saved?", a: "Coins, levels, trophies, saved games and settings are kept in your browser on your own device. There is no account to make." },
  { q: "Which game should I play first?", a: "Try Kiko's Jungle Quest or Momo Dash for a big 3D run, Nitro Rush for racing, or Momo Shuffle for a quick brain challenge." },
];

export default function Home() {
  // the spotlight shows the newest big games; the top-picks grid the rest of the picks
  const spot = NEW_GAMES.filter((g) => g.engine && g.engine !== "arcade").slice(0, 6);
  // one feature + 8 cards fills the grid exactly on every width (2, 3 and 4 columns)
  const picks = [...new Set([...TOP_PICKS, ...ALL_PLAYABLE])].filter((g) => !spot.includes(g)).slice(0, 9);
  const [feature, ...rest] = picks;
  // every game sits in exactly one category, so these rows never show the same game twice
  const catRows = CATEGORIES.map((c) => ({ c, games: inCategory(c.id) })).filter((r) => r.games.length > 0);
  return (
    <div className="page grid grid-cols-1 gap-8 sm:gap-10">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <h1 className="sr-only">MOMOBLOBS — free online games</h1>

      <div className="grid min-w-0 grid-cols-1 gap-4">
        <Spotlight games={spot} />
        <CategoryChips />
      </div>

      <ContinueRow />

      {/* top picks: one big feature and a grid of cards */}
      <section>
        <RowTitle title="Top picks today" href="/top" icon={<Flame className="size-5 text-momo" />} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          <GameTile g={feature} variant="feature" priority className="col-span-2 row-span-2 aspect-[16/11] sm:aspect-auto" />
          {rest.slice(0, 4).map((g) => <GameTile key={g.slug} g={g} priority />)}
          {rest.slice(4, 8).map((g) => <GameTile key={g.slug} g={g} className="hidden sm:flex" />)}
        </div>
      </section>

      <GameRow title="New games" href="/new" games={NEW_GAMES.slice(0, 16)} icon={<Sparkles className="size-5 text-mint" />} />
      <GameRow title="3D games" href="/c/3d" games={GAMES_3D.slice(0, ROW_SIZE)} icon={<Box className="size-5 text-[#9FB8FF]" />} />
      <AppCard />
      <SavedRow />

      {catRows.map(({ c, games }) => {
        const { icon: Icon, color } = CATEGORY_ICON[c.id];
        return <GameRow key={c.id} title={`${c.label} games`} href={categoryHref(c.id)} games={games.slice(0, ROW_SIZE)} icon={<Icon className="size-5" style={{ color }} />} />;
      })}

      <section>
        <RowTitle title="Explore by category" href="/categories" icon={<LayoutGrid className="size-5 text-sun" />} />
        <CategoryTiles />
      </section>

      {/* about */}
      <section className="relative grid gap-6 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#1d1240] to-[#120a2a] p-5 ring-1 ring-white/[0.07] sm:p-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-momo/15 blur-3xl" />
        <div className="relative">
          <h2 className="font-display text-3xl leading-tight text-white sm:text-4xl">Free online games at <span className="text-sun">MOMOBLOBS</span></h2>
          <div className="mt-3 grid gap-3 text-[15px] leading-relaxed text-muted">
            <p>MOMOBLOBS has {ALL_PLAYABLE.length} free games you can play instantly in your browser — no download, no sign-up. Run through 300 jungle places in <a className="text-sun hover:underline" href={gameHref("kiko-jungle-quest")}>Kiko&apos;s Jungle Quest</a>, dash across twelve worlds in <a className="text-sun hover:underline" href={gameHref("momo-dash")}>Momo Dash</a>, race 30+ cars in <a className="text-sun hover:underline" href={gameHref("nitro-rush")}>Nitro Rush</a> or lead a giant crowd in <a className="text-sun hover:underline" href={gameHref("blob-brigade")}>Blob Brigade</a>.</p>
            <p>Every game is made in-house with our own clay characters — Momo, Kranky, Tiki and friends — and works on phones, tablets and computers. Your coins, trophies and saved games stay on your device.</p>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md">
            {[[ALL_PLAYABLE.length, "games"], [GAMES_3D.length, "in 3D"], ["Free", "to play"]].map(([n, l]) => (
              <div key={l as string} className="rounded-2xl bg-white/[0.05] px-3 py-3 text-center ring-1 ring-white/[0.06]"><div className="font-display text-2xl text-white">{n}</div><div className="text-xs font-semibold text-faint">{l}</div></div>
            ))}
          </div>
        </div>
        <div className="relative grid content-start gap-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/[0.05] open:bg-white/[0.07]">
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
