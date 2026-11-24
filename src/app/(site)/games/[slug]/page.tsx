import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight, Gamepad2, Keyboard, ListOrdered, MessageCircleQuestion, Play } from "lucide-react";
import { GameStage } from "@/components/game/GameStage";
import { GameRow } from "@/components/home/GameRow";
import { GameListItem } from "@/components/ui/GameTile";
import { JsonLd } from "@/components/JsonLd";
import { CATEGORY_ICON } from "@/components/layout/nav";
import { CATEGORIES, CHARACTERS, GAMES, getGame } from "@/lib/games";
import { ROW_SIZE, categoryHref, is3D, playHref, posterOf } from "@/lib/catalog";
import { inCategory, similarTo, toCard } from "@/lib/lists";
import { abs, absAsset } from "@/lib/site";
import { seoOf } from "@/lib/seo";

export function generateStaticParams() {
  return GAMES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/games/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const g = getGame(slug);
  if (!g) return {};
  const live = g.status === "live";
  const seo = seoOf(g);
  const title = !live ? `${g.title} — Coming Soon` : seo.title;
  const og = live ? absAsset(`/games/${g.slug}/og.jpg`) : "/og.jpg";
  const social = `${title} | MOMOBLOBS`;
  return {
    title,
    description: seo.description,
    keywords: [g.title, ...seo.keywords, "free online game", "MOMOBLOBS"],
    alternates: { canonical: `/games/${g.slug}` },
    robots: live ? { index: true, follow: true, "max-image-preview": "large" } : { index: false, follow: true },
    openGraph: {
      type: "website", siteName: "MOMOBLOBS", title: social, description: seo.description, url: `/games/${g.slug}`,
      images: [{ url: og, width: 1200, height: 630, alt: `${g.title} — ${g.tagline}` }],
    },
    twitter: { card: "summary_large_image", title: social, description: seo.description, images: [{ url: og, alt: g.title }] },
  };
}

function H2({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <h2 className="mt-8 mb-3 flex items-center gap-2 text-xl font-bold text-white">{icon}{children}</h2>;
}

async function GameDetail({ params }: { params: PageProps<"/games/[slug]">["params"] }) {
  const { slug } = await params;
  const g = getGame(slug);
  if (!g) notFound();
  const live = g.status === "live";
  const next = similarTo(g, 14);
  const main = CATEGORIES.find((c) => c.id === g.category)!;
  const released = g.released ? new Date(`${g.released}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "2026";
  const seo = seoOf(g);

  const ld = live && {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["VideoGame", "SoftwareApplication"],
        "@id": abs(`/games/${g.slug}#game`),
        name: g.title,
        url: abs(`/games/${g.slug}`),
        alternateName: seo.title,
        description: g.description,
        abstract: seo.description,
        keywords: seo.keywords.join(", "),
        image: [absAsset(g.hero), absAsset(posterOf(g)), absAsset(`/games/${g.slug}/og.jpg`)],
        thumbnailUrl: absAsset(g.hero),
        ...(g.shots.length ? { screenshot: g.shots.map(absAsset) } : {}),
        genre: [main.label, ...(is3D(g) ? ["3D"] : [])],
        author: { "@id": abs("/#org") },
        dateModified: seo.updated,
        mainEntityOfPage: abs(`/games/${g.slug}`),
        gamePlatform: ["Web browser", "iOS", "Android", "Windows", "macOS"],
        applicationCategory: "GameApplication",
        operatingSystem: "Any (web browser)",
        playMode: "SinglePlayer",
        inLanguage: "en",
        isAccessibleForFree: true,
        character: (g.slug === "momo-shuffle" ? ["Momo", "Kranky", "Tiki"] : [CHARACTERS.find((c) => c.id === g.host)?.name ?? (g.host ? g.host[0].toUpperCase() + g.host.slice(1) : "Momo")]).map((n) => ({ "@type": "Person", name: n })),
        publisher: { "@id": abs("/#org") },
        datePublished: g.released,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
        potentialAction: { "@type": "PlayAction", target: abs(playHref(g)) },
      },
      { "@type": "HowTo", name: `How to play ${g.title}`, step: g.howTo.map((h, i) => ({ "@type": "HowToStep", position: i + 1, name: h.title, text: h.text })) },
      { "@type": "FAQPage", mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Games", item: abs("/games") },
          { "@type": "ListItem", position: 2, name: `${main.label} games`, item: abs(categoryHref(main.id)) },
          { "@type": "ListItem", position: 3, name: g.title, item: abs(`/games/${g.slug}`) },
        ],
      },
    ],
  };

  const facts: [string, string][] = [
    ["Developer", "MOMOBLOBS"],
    ["Released", released],
    ["Technology", is3D(g) ? "3D · WebGL" : "HTML5"],
    ["Platforms", "Browser (desktop, mobile, tablet)"],
    ["Controls", g.controls.some((c) => /swipe|tap/i.test(c.keys)) ? "Keyboard, mouse and touch" : "Mouse, keyboard and touch"],
    ["Price", "Free"],
  ];

  return (
    <div className="page">
      {ld && <JsonLd data={ld} />}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-5">
          {live ? <GameStage game={toCard(g)} /> : (
            <div className="grid aspect-video place-items-center rounded-2xl bg-[#140b2c] text-center ring-1 ring-white/[0.07]">
              <div><p className="text-2xl font-bold">{g.title}</p><p className="mt-1 text-muted">Coming soon</p></div>
            </div>
          )}

          {/* about the game */}
          <article className="rounded-[1.5rem] bg-[#140b2c] p-5 ring-1 ring-white/[0.07] sm:p-7">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm font-medium text-faint">
              <Link href="/games" className="hover:text-white">Games</Link>
              <ChevronRight className="size-3.5" />
              <Link href={categoryHref(main.id)} className="hover:text-white">{main.label}</Link>
              <ChevronRight className="size-3.5" />
              <span className="text-white/80">{g.title}</span>
            </nav>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-3xl leading-tight font-bold text-white sm:text-4xl">{g.title}</h1>
                <p className="mt-1.5 text-[17px] text-muted">{g.tagline}</p>
              </div>
              {live && (
                <Link href={playHref(g)} className="flex items-center gap-2 rounded-full bg-sun px-5 py-2.5 font-bold text-ink transition hover:brightness-105 active:scale-95 lg:hidden">
                  <Play className="size-4 fill-current" /> Play full screen
                </Link>
              )}
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/[0.06] sm:grid-cols-3">
              {facts.map(([k, v]) => (
                <div key={k} className="bg-[#170e33] px-4 py-3">
                  <dt className="text-xs font-semibold tracking-wide text-faint uppercase">{k}</dt>
                  <dd className="mt-0.5 font-semibold text-white">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              {(() => {
                const { icon: Icon, color } = CATEGORY_ICON[g.category];
                return (
                  <Link href={categoryHref(g.category)} className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3.5 py-1.5 text-sm font-semibold text-white/85 ring-1 ring-white/[0.06] hover:bg-white/[0.12] hover:text-white">
                    <Icon className="size-4" style={{ color }} /> {main.label} games <span className="text-faint">{inCategory(g.category).length}</span>
                  </Link>
                );
              })()}
              {is3D(g) && <Link href="/c/3d" className="rounded-full bg-[#6d4aff]/25 px-3.5 py-1.5 text-sm font-semibold text-[#c9bcff] ring-1 ring-[#6d4aff]/40 hover:bg-[#6d4aff]/35">3D</Link>}
            </div>

            <div className="grid grid-cols-1 gap-x-7 md:grid-cols-[minmax(0,1fr)_230px] lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0">
                <H2 icon={<Gamepad2 className="size-5 text-sun" />}>About {g.title}</H2>
                <p className="max-w-4xl text-[15.5px] leading-relaxed text-muted">{g.description}</p>
                <ul aria-label={`${g.title} tags`} className="mt-4 flex flex-wrap gap-1.5">
                  {seo.keywords.map((k) => (
                    <li key={k} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-faint ring-1 ring-white/[0.06]">{k}</li>
                  ))}
                </ul>
              </div>
              {live && (
                <figure className="mx-auto mt-6 w-full max-w-[300px] md:mt-8">
                  <Image src={posterOf(g)} alt={`${g.title} poster`} width={1000} height={1500} sizes="(max-width: 768px) 300px, 260px"
                    className="h-auto w-full rounded-2xl shadow-[0_24px_50px_-20px_rgb(0_0_0/0.8)] ring-1 ring-white/10" />
                  <figcaption className="mt-2 text-center text-xs font-semibold text-faint">Official {g.title} poster</figcaption>
                </figure>
              )}
            </div>

            <H2 icon={<ListOrdered className="size-5 text-mint" />}>How to play</H2>
            <ol className="grid gap-3 sm:grid-cols-2">
              {g.howTo.map((h, i) => (
                <li key={h.title} className="flex gap-3 rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/[0.05]">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sun/15 font-bold text-sun">{i + 1}</span>
                  <span><span className="block font-bold text-white">{h.title}</span><span className="mt-0.5 block text-sm leading-relaxed text-muted">{h.text}</span></span>
                </li>
              ))}
            </ol>

            <H2 icon={<Keyboard className="size-5 text-[#9FB8FF]" />}>Controls</H2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.controls.map((c) => (
                <li key={c.keys + c.action} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-4 py-2.5 ring-1 ring-white/[0.05]">
                  <span className="text-sm text-muted">{c.action}</span>
                  <kbd className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-white">{c.keys}</kbd>
                </li>
              ))}
            </ul>

            {g.modes.length > 1 && (
              <>
                <H2 icon={<Play className="size-5 text-momo" />}>Game modes</H2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {g.modes.map((m) => (
                    <Link key={m.id} href={playHref(g, { mode: m.id })} className="group rounded-xl p-4 ring-1 ring-white/[0.08] transition hover:-translate-y-0.5 hover:ring-white/25" style={{ background: `linear-gradient(150deg, ${m.color}40, #170e33 75%)` }}>
                      <p className="text-lg font-bold text-white">{m.label}</p>
                      <p className="mt-0.5 text-sm text-muted">{m.desc}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-sun">Play {m.label} <ChevronRight className="size-4 transition group-hover:translate-x-0.5" /></span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {g.faq.length > 0 && (
              <>
                <H2 icon={<MessageCircleQuestion className="size-5 text-bubble" />}>Questions</H2>
                <div className="grid gap-2">
                  {g.faq.map((f) => (
                    <details key={f.q} className="group rounded-xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/[0.05] open:bg-white/[0.07]">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-white">
                        <h3>{f.q}</h3>
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-sm transition group-open:rotate-45">+</span>
                      </summary>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
                    </details>
                  ))}
                </div>
              </>
            )}
          </article>

          {/* phones and tablets: play next comes after the game's details */}
          <div className="xl:hidden"><GameRow title="Play next" games={next} /></div>
        </div>

        {/* play next */}
        <aside className="hidden xl:block">
          <div className="sticky top-20 rounded-[1.5rem] bg-[#140b2c] p-3 ring-1 ring-white/[0.07]">
            <h2 className="mb-1.5 px-2 pt-1 text-lg font-bold text-white">Play next</h2>
            <div className="grid gap-0.5">
              {next.slice(0, 10).map((x) => <GameListItem key={x.slug} g={x} />)}
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8">
        <GameRow title={`More ${main.label.toLowerCase()} games`} href={categoryHref(main.id)} games={inCategory(main.id).filter((x) => x.slug !== g.slug).slice(0, ROW_SIZE)} />
      </div>
    </div>
  );
}

export default function GamePage({ params }: PageProps<"/games/[slug]">) {
  return (
    <Suspense fallback={<div className="page"><div className="aspect-video w-full animate-pulse rounded-2xl bg-white/[0.04] xl:w-[calc(100%-320px)]" /></div>}>
      <GameDetail params={params} />
    </Suspense>
  );
}
