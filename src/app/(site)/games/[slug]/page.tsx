import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Bell, Clock, Gamepad2, Keyboard, Play, Sparkles, Star } from "lucide-react";
import { Breadcrumbs, SectionTitle } from "@/components/ui/PageHero";
import { GameCard } from "@/components/ui/GameCard";
import { JsonLd } from "@/components/JsonLd";
import { GameStatsCard } from "@/components/games/GameStatsCard";
import { CATEGORIES, CHARACTERS, GAMES, getGame } from "@/lib/games";
import { SITE, abs } from "@/lib/site";

export function generateStaticParams() {
  return GAMES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/games/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const g = getGame(slug);
  if (!g) return {};
  const live = g.status === "live";
  const cat = CATEGORIES.find((c) => c.id === g.categories[0])?.label ?? "Brain";
  const title = !live ? `${g.title} — Coming Soon` : g.slug === "momo-shuffle" ? `${g.title} — Free Cup Game for Kids (3, 4 & 6 Cups)` : `${g.title} — Free ${cat} Game for Kids`;
  const og = live ? `/games/${g.slug}/og.jpg` : "/og.jpg";
  return {
    title,
    description: g.description.slice(0, 158),
    alternates: { canonical: `/games/${g.slug}` },
    robots: live ? undefined : { index: false, follow: true },
    openGraph: { type: "website", title, description: g.tagline, url: `/games/${g.slug}`, images: [{ url: og, width: 1200, height: 630, alt: g.title }] },
    twitter: { card: "summary_large_image", title, description: g.tagline, images: [og] },
  };
}

async function GameDetail({ params }: { params: PageProps<"/games/[slug]">["params"] }) {
  const { slug } = await params;
  const g = getGame(slug);
  if (!g) notFound();
  const live = g.status === "live";
  const related = GAMES.filter((x) => x.slug !== g.slug).slice(0, 4);

  const ld = live && {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["VideoGame", "SoftwareApplication"],
        "@id": abs(`/games/${g.slug}#game`),
        name: g.title,
        url: abs(`/games/${g.slug}`),
        description: g.description,
        image: [abs(g.hero), abs(`/games/${g.slug}/og.jpg`)],
        genre: ["Puzzle", "Brain game", "Casual"],
        gamePlatform: ["Web browser", "iOS", "Android", "Windows", "macOS"],
        applicationCategory: "GameApplication",
        operatingSystem: "Any (web browser)",
        playMode: "SinglePlayer",
        inLanguage: "en",
        isAccessibleForFree: true,
        typicalAgeRange: "4-",
        audience: { "@type": "PeopleAudience", suggestedMinAge: 4 },
        character: (g.slug === "momo-shuffle" ? ["Momo", "Kranky", "Tiki"] : [CHARACTERS.find((c) => c.id === g.host)?.name ?? "Momo"]).map((n) => ({ "@type": "Person", name: n })),
        publisher: { "@id": abs("/#org") },
        datePublished: g.released,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
        potentialAction: { "@type": "PlayAction", target: abs(`/play/${g.slug}`) },
      },
      {
        "@type": "HowTo",
        name: `How to play ${g.title}`,
        step: g.howTo.map((h, i) => ({ "@type": "HowToStep", position: i + 1, name: h.title, text: h.text })),
      },
      {
        "@type": "FAQPage",
        mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <>
      {ld && <JsonLd data={ld} />}
      <section className="relative mx-auto max-w-7xl px-5 pt-6 lg:px-6 lg:pt-10">
        <Breadcrumbs items={[{ name: "Games", href: "/games" }, { name: g.title, href: `/games/${g.slug}` }]} />
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="relative order-2 lg:order-1">
            <div className="flex flex-wrap gap-2">
              {g.categories.map((c) => {
                const cat = CATEGORIES.find((x) => x.id === c)!;
                return <Link key={c} href={`/games?category=${c}`} className="chip hover:bg-white/14">{cat.emoji} {cat.label}</Link>;
              })}
              <span className="chip">👶 Ages {g.ages}</span>
              {live ? <span className="chip !bg-lime !text-ink">● Free · Live</span> : <span className="chip">🔒 Coming soon</span>}
            </div>
            <h1 className="text-clay mt-4 text-[3rem] leading-[0.95] text-cream sm:text-7xl">{g.title}</h1>
            <p className="mt-3 text-xl font-semibold text-sun">{g.tagline}</p>
            <p className="mt-4 max-w-2xl text-lg text-muted">{g.description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {live ? (
                <>
                  <Link href={`/play/${g.slug}`} className="btn-clay lg"><Play className="size-6 fill-current" /> Play now — free</Link>
                  <a href="#how" className="btn-clay ghost lg">How to play</a>
                </>
              ) : (
                <>
                  <span className="btn-clay ghost lg"><Bell className="size-5" /> Coming soon</span>
                  <Link href="/play/momo-shuffle" className="btn-clay lg"><Play className="size-6 fill-current" /> Play Momo Shuffle</Link>
                </>
              )}
            </div>
          </div>
          <div className="relative order-1 lg:order-2">
            <div className="absolute -inset-6 -z-10 rounded-[3rem] blur-3xl" style={{ background: `linear-gradient(135deg, ${g.accent}88, ${g.accent2}55)` }} />
            {live ? (
              <Link href={`/play/${g.slug}`} className="group relative block overflow-hidden rounded-[2rem] ring-2 ring-white/20">
                <Image src={g.hero} alt={`${g.title} gameplay`} width={1600} height={900} priority sizes="(max-width: 1024px) 100vw, 50vw" className="aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute inset-0 flex items-end justify-end p-4 transition group-hover:bg-ink/20">
                  <span className="btn-clay icon !size-16 !rounded-[1.4rem] sm:!size-20"><Play className="size-8 fill-current" /></span>
                </span>
              </Link>
            ) : (
              <div className="relative grid aspect-video place-items-center overflow-hidden rounded-[2rem] ring-2 ring-white/20" style={{ background: `radial-gradient(circle at 50% 30%, ${g.accent}, ${g.accent2} 70%)` }}>
                <div className="sunburst absolute inset-0 animate-[spin-slow_80s_linear_infinite] opacity-60" style={{ scale: 2 }} />
                <Image src={g.character} alt={g.title} width={420} height={420} priority className="relative w-1/2 animate-float drop-shadow-2xl" />
                <span className="absolute bottom-4 rounded-full bg-ink/60 px-4 py-1.5 font-display text-lg backdrop-blur">Coming soon</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {live && (
        <div className="mx-auto mt-14 grid max-w-7xl gap-14 px-5 lg:px-6">
          <section>
            <SectionTitle kicker="Modes" title="Three ways to play" />
            <div className="grid gap-4 sm:grid-cols-3">
              {g.modes.map((m) => (
                <Link key={m.id} href={`/play/${g.slug}?mode=${m.id}`} className="group relative overflow-hidden rounded-[1.75rem] p-6 ring-1 ring-white/15 transition hover:-translate-y-1" style={{ background: `linear-gradient(160deg, ${m.color}, #1b1040 85%)` }}>
                  <div className="sunburst absolute inset-0 opacity-40" />
                  <p className="relative font-display text-4xl text-cream" style={{ WebkitTextStroke: "0.1em #23305A", paintOrder: "stroke fill" }}>{m.label}</p>
                  {m.cups ? <p className="relative mt-1 text-lg font-semibold">{m.cups} cups</p> : null}
                  <p className="relative text-text/80">{m.desc}</p>
                  {m.coins ? <p className="relative mt-3 flex items-center gap-1.5 font-display text-sun"><Star className="size-4 fill-current" /> +{m.coins} coins per find</p> : <p className="relative mt-3 flex items-center gap-1.5 font-display text-sun"><Star className="size-4 fill-current" /> Unlimited levels</p>}
                  <span className="btn-clay sm relative mt-4">Play {m.label} →</span>
                </Link>
              ))}
            </div>
          </section>

          <Suspense fallback={null}><GameStatsCard slug={g.slug} /></Suspense>

          <section id="how" className="scroll-mt-24">
            <SectionTitle kicker="Rules" title={`How to play ${g.title}`} />
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {g.howTo.map((h, i) => (
                <li key={h.title} className="glass rounded-[1.5rem] p-5">
                  <span className="grid size-11 place-items-center rounded-2xl bg-momo font-display text-2xl text-ink shadow-[0_4px_0_#e0631f]">{i + 1}</span>
                  <h3 className="mt-3 font-display text-xl">{h.title}</h3>
                  <p className="mt-1 text-muted">{h.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {g.slug === "momo-shuffle" ? (
            <div className="glass rounded-[1.75rem] p-6">
                <h2 className="flex items-center gap-2 font-display text-2xl"><Sparkles className="size-5 text-sun" /> Twists that keep it fresh</h2>
                <ul className="mt-4 grid gap-3">
                  {[
                    ["⚡ Zigzag", "Kranky loves long swaps from end to end."],
                    ["🃏 Fake-Out", "Kranky lifts an empty cup to trick you."],
                    ["🌀 Triple Spin", "Every cup moves at once in a big circle."],
                    ["🌙 Lights Off", "The lights go out mid-shuffle. Listen and guess!"],
                    ["⭐ Bonus Round", "Every 5th level: more swaps, double coins."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex gap-3 rounded-2xl bg-white/5 p-3"><span className="w-32 shrink-0 font-bold">{t}</span><span className="text-muted">{d}</span></li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="glass rounded-[1.75rem] p-6">
                <h2 className="flex items-center gap-2 font-display text-2xl"><Sparkles className="size-5 text-sun" /> Levels &amp; score</h2>
                <ul className="mt-4 grid gap-3">
                  {[
                    ["♾️ Unlimited", "Every level is generated fresh — it never repeats and never ends."],
                    ["📈 Gentle ramp", "Each level is a little harder; new twists appear as you go."],
                    ["🔥 Combo ×5", "Correct answers in a row multiply your points up to ×5."],
                    ["⚡ Speed bonus", "Answer faster for bonus points. Perfect levels score extra."],
                    ["🪙 Coins", "Clear levels to earn coins for the Rewards shop."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex gap-3 rounded-2xl bg-white/5 p-3"><span className="w-32 shrink-0 font-bold">{t}</span><span className="text-muted">{d}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="glass rounded-[1.75rem] p-6">
              <h2 className="flex items-center gap-2 font-display text-2xl"><Keyboard className="size-5 text-mint" /> Controls</h2>
              <ul className="mt-4 grid gap-2">
                {g.controls.map((c) => (
                  <li key={c.keys} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5"><span className="text-muted">{c.action}</span><kbd className="rounded-lg bg-white/12 px-2 py-1 font-display text-sm">{c.keys}</kbd></li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Gamepad2 className="size-5" /> Gamepad supported · <Clock className="size-4" /> No time limit to pick</p>
            </div>
          </section>

          {g.shots.length > 0 && <section>
            <SectionTitle kicker="Gallery" title="Screenshots" />
            <div className="no-scrollbar -mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
              {g.shots.map((s, i) => (
                <Image key={s} src={s} alt={`${g.title} screenshot ${i + 1}: Momo, Kranky and the clay cups`} width={1280} height={720} className="aspect-video w-[80%] shrink-0 snap-center rounded-2xl object-cover ring-1 ring-white/15 sm:w-[45%] lg:w-full" />
              ))}
            </div>
          </section>}

          <section className="mx-auto w-full max-w-4xl">
            <SectionTitle kicker="FAQ" title={`${g.title} questions`} />
            <div className="grid gap-3">
              {g.faq.map((f) => (
                <details key={f.q} className="glass group rounded-2xl p-5 open:bg-white/10">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                    <h3>{f.q}</h3>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      )}

      {!live && (
        <section className="mx-auto mt-12 max-w-3xl px-5 lg:px-6">
          <div className="glass rounded-[1.75rem] p-6 text-center">
            <p className="font-display text-2xl">Want to know when it&apos;s ready?</p>
            <p className="mt-1 text-muted">Follow MOMOBLOBS on YouTube and Instagram — new games are announced there first.</p>
            <div className="mt-4 flex justify-center gap-2">
              <a href={SITE.social.youtube} target="_blank" rel="noopener noreferrer" className="btn-clay bubble sm">YouTube ↗</a>
              <a href={SITE.social.instagram} target="_blank" rel="noopener noreferrer" className="btn-clay grape sm">Instagram ↗</a>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto mt-14 max-w-7xl px-5 lg:px-6">
        <SectionTitle kicker="More" title="You might also like" action={{ href: "/games", label: "All games" }} />
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {related.map((r) => <GameCard key={r.slug} g={r} />)}
        </div>
      </section>
    </>
  );
}

export default function GamePage({ params }: PageProps<"/games/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[60vh] max-w-7xl" />}>
      <GameDetail params={params} />
    </Suspense>
  );
}
