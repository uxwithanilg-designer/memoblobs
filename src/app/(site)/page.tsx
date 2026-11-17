import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CloudOff, Gamepad2, Play, ShieldCheck, Smartphone, Sparkles, Trophy, Clapperboard } from "lucide-react";
import { GameCard } from "@/components/ui/GameCard";
import { SectionTitle } from "@/components/ui/PageHero";
import { ContinueStrip, DailyGift, ModePicker, TrophyCount } from "@/components/home/ClientBits";
import { JsonLd } from "@/components/JsonLd";
import { CATEGORIES, CHARACTERS, GAMES } from "@/lib/games";
import { SITE } from "@/lib/site";

const FAQ = [
  { q: "What is MOMOBLOBS?", a: "MOMOBLOBS is a free website of claymation brain games for kids and families, starring Momo the orange clay blob, Kranky the crab and Tiki the bird. The games are made from the same characters as the MOMOBLOBS YouTube and Instagram videos." },
  { q: "Are the games free?", a: "Yes. Every MOMOBLOBS game is free to play in the browser, with no sign-up and nothing to download." },
  { q: "Do the games work on phones and tablets?", a: "Yes. The site works like an app on iPhone, iPad and Android phones and tablets, and on laptops and desktop computers. You can add it to your home screen for a full-screen app feel." },
  { q: "How are coins saved?", a: "Coins, levels, trophies and settings are saved in your browser on your own device. There is no account, so nothing is sent to a server." },
  { q: "Which game should I start with?", a: "Start with Momo Shuffle on Easy: 3 cups and gentle swaps. When you can find Momo every time, try Medium with 4 cups and Hard with 6 cups." },
];

export default function Home() {
  const live = GAMES.filter((g) => g.status === "live");
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />

      {/* ───────────── hero ───────────── */}
      <section className="relative mx-auto max-w-7xl px-5 pt-4 lg:px-6 lg:pt-10">
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
          <div className="relative z-10 order-2 lg:order-1">
            <p className="chip mb-4 !bg-momo/15 !text-momo ring-1 ring-momo/40"><Sparkles className="size-4" /> New game · Momo Shuffle</p>
            <h1 className="text-clay text-[3.1rem] leading-[0.92] text-cream sm:text-7xl xl:text-[5.6rem]">
              Can you find <span className="text-sun">Momo</span>?
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted sm:text-xl">
              Momo hides under a cup. Kranky shuffles. You track him! Free claymation brain games with <strong className="text-text">3, 4 or 6 cups</strong>, coins, trophies and levels that never end.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/play/momo-shuffle" className="btn-clay lg"><Play className="size-6 fill-current" /> Play free</Link>
              <Link href="/games/momo-shuffle" className="btn-clay ghost lg">How to play</Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-2 text-sm">
              {[
                [BadgeCheck, "100% free"], [ShieldCheck, "Kid-safe, no chat"], [CloudOff, "No sign-up"], [Smartphone, "Phone, tablet & PC"],
              ].map(([Icon, label]) => {
                const I = Icon as typeof BadgeCheck;
                return <li key={label as string} className="chip"><I className="size-4 text-mint" /> {label as string}</li>;
              })}
            </ul>
          </div>

          <div className="relative order-1 lg:order-2">
            <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-violet/40 via-bubble/20 to-mint/20 blur-3xl" />
            <Link href="/play/momo-shuffle" className="group relative block overflow-hidden rounded-[2rem] ring-2 ring-white/20 shadow-[0_40px_80px_-30px_rgb(155_93_229/0.8)] lg:rotate-[1.5deg]">
              <Image src="/games/momo-shuffle/hero.webp" alt="Momo Shuffle — Momo hides under the clay cups while Kranky the crab shuffles" width={1600} height={900} priority sizes="(max-width: 1024px) 100vw, 50vw" className="aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
              <span className="absolute bottom-4 left-4 flex items-center gap-3">
                <span className="btn-clay icon !size-14 !rounded-2xl"><Play className="size-6 fill-current" /></span>
                <span>
                  <span className="block font-display text-2xl leading-none">Momo Shuffle</span>
                  <span className="text-sm font-semibold text-text/80">Tap to play · no download</span>
                </span>
              </span>
            </Link>
            <Image src="/brand/kranky-laugh.webp" alt="" width={300} height={203} className="pointer-events-none absolute -top-10 -left-4 w-28 -scale-x-100 animate-[wiggle_3s_ease-in-out_infinite] drop-shadow-2xl sm:w-40 lg:-top-14 lg:-left-10" />
            <Image src="/brand/momo-cheer.webp" alt="" width={300} height={216} className="pointer-events-none absolute -right-3 -bottom-10 w-28 animate-float drop-shadow-2xl sm:w-40 lg:-right-10" />
            <Image src="/brand/coin.webp" alt="" width={70} height={72} className="pointer-events-none absolute top-1/2 -right-5 w-12 animate-[bob_2.4s_ease-in-out_infinite] drop-shadow-xl sm:w-14" />
          </div>
        </div>
      </section>

      <div className="mt-14 grid gap-14 sm:mt-20">
        <ContinueStrip />

        {/* ───────────── quick start ───────────── */}
        <section className="mx-auto w-full max-w-7xl px-5 lg:px-6">
          <SectionTitle kicker="Quick start" title="Pick your challenge" action={{ href: "/games/momo-shuffle", label: "Rules" }} />
          <ModePicker />
        </section>

        {/* ───────────── games ───────────── */}
        <section className="mx-auto w-full max-w-7xl px-5 lg:px-6">
          <SectionTitle kicker="Arcade" title="All games" action={{ href: "/games", label: "See all" }} />
          <div className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
            {CATEGORIES.map((c) => (
              <Link key={c.id} href={`/games?category=${c.id}`} className="chip shrink-0 !px-4 !py-2 transition hover:bg-white/14">{c.emoji} {c.label}</Link>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {[...GAMES].sort((a, b) => (a.status === b.status ? 0 : a.status === "live" ? -1 : 1)).slice(0, 8).map((g, i) => <GameCard key={g.slug} g={g} priority={i === 0} />)}
          </div>
        </section>

        {/* ───────────── rewards ───────────── */}
        <section className="mx-auto grid w-full max-w-7xl gap-4 px-5 md:grid-cols-[1.3fr_1fr] lg:px-6">
          <DailyGift />
          <Link href="/rewards" className="glass group relative overflow-hidden rounded-[1.75rem] p-6">
            <div className="absolute -right-10 -bottom-10 size-48 rounded-full bg-violet/30 blur-2xl" />
            <p className="flex items-center gap-2 text-sm font-bold tracking-widest text-mint uppercase"><Trophy className="size-4" /> Trophy room</p>
            <p className="mt-1 font-display text-4xl leading-tight"><TrophyCount /> trophies</p>
            <p className="mt-2 text-muted">Win streaks, beat twists and spend coins on new cup colours in the shop.</p>
            <div className="mt-4 flex -space-x-3">
              {["#8E6CE0", "#2EC4B6", "#FF6F91", "#FFC93C", "#E8504F"].map((c) => (
                <span key={c} className="size-11 rounded-2xl ring-4 ring-night" style={{ background: `linear-gradient(180deg, ${c}, color-mix(in oklab, ${c} 70%, black))` }} />
              ))}
            </div>
            <span className="mt-5 inline-flex items-center gap-1 font-bold text-sun group-hover:underline">Open rewards →</span>
          </Link>
        </section>

        {/* ───────────── cast ───────────── */}
        <section className="mx-auto w-full max-w-7xl px-5 lg:px-6">
          <SectionTitle kicker="The gang" title="Meet the clay crew" action={{ href: "/characters", label: "Characters" }} />
          <div className="grid gap-4 sm:grid-cols-3">
            {CHARACTERS.map((c) => (
              <Link key={c.id} href={`/characters#${c.id}`} className="group relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] p-4 ring-1 ring-white/12 transition hover:-translate-y-1 sm:flex-col sm:items-start sm:p-5" style={{ background: `linear-gradient(160deg, ${c.color}55, #1b1040 70%)` }}>
                <Image src={c.img} alt={`${c.name}, ${c.role}`} width={300} height={260} className="w-28 shrink-0 drop-shadow-2xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3 sm:mx-auto sm:w-44" />
                <div>
                  <p className="font-display text-3xl leading-none">{c.name}</p>
                  <p className="mt-1 font-semibold" style={{ color: c.color }}>{c.role}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{c.bio}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ───────────── how it works ───────────── */}
        <section className="mx-auto w-full max-w-7xl px-5 lg:px-6">
          <SectionTitle kicker="Easy as 1-2-3" title="How Momo Shuffle works" />
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              { n: "1", t: "Watch him hide", d: "Kranky lifts a cup and Momo hops underneath.", img: "/brand/momo-sly.webp", c: "#FF8A3D" },
              { n: "2", t: "Follow the shuffle", d: "Swaps, spins and fake-outs — keep your eyes on that cup!", img: "/brand/kranky.webp", c: "#E8504F" },
              { n: "3", t: "Tap & win coins", d: "Pick the right cup to earn coins and level up forever.", img: "/brand/tiki-sign.webp", c: "#2EC4B6" },
            ].map((s) => (
              <li key={s.n} className="glass relative overflow-hidden rounded-[1.75rem] p-5">
                <span className="font-display text-6xl leading-none" style={{ color: s.c, WebkitTextStroke: "0.06em #23305A" }}>{s.n}</span>
                <p className="mt-2 font-display text-2xl">{s.t}</p>
                <p className="mt-1 max-w-[16rem] text-muted">{s.d}</p>
                <Image src={s.img} alt="" width={200} height={180} className="absolute -right-4 -bottom-4 w-28 opacity-90 drop-shadow-xl" />
              </li>
            ))}
          </ol>
        </section>

        {/* ───────────── parents ───────────── */}
        <section className="mx-auto w-full max-w-7xl px-5 lg:px-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-mint/25 via-plum to-plum p-6 ring-1 ring-mint/30 sm:p-10">
            <div className="grid items-center gap-6 md:grid-cols-[1.3fr_1fr]">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold tracking-widest text-mint uppercase"><ShieldCheck className="size-4" /> For grown-ups</p>
                <h2 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Safe, calm play for kids</h2>
                <ul className="mt-4 grid gap-2 text-muted sm:grid-cols-2">
                  <li>✔ No in-app purchases</li>
                  <li>✔ No accounts, chat or personal data</li>
                  <li>✔ Progress saved only on your device</li>
                  <li>✔ Kid Mode: slower shuffles, big buttons</li>
                </ul>
                <Link href="/parents" className="btn-clay mint mt-6">Parents &amp; teachers guide</Link>
              </div>
              <Image src="/brand/tiki-sign.webp" alt="Tiki holding a PLAY sign" width={300} height={329} className="mx-auto w-44 animate-float drop-shadow-2xl sm:w-56" />
            </div>
          </div>
        </section>

        {/* ───────────── watch ───────────── */}
        <section className="mx-auto w-full max-w-7xl px-5 lg:px-6">
          <a href={SITE.social.youtube} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-[2rem] ring-1 ring-white/15">
            <Image src="/brand/banner.webp" alt="MOMOBLOBS channel banner with Momo, Kranky and Tiki" width={1920} height={1080} sizes="100vw" className="aspect-[16/7] w-full object-cover transition-transform duration-700 group-hover:scale-105 sm:aspect-[16/5]" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/40 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex flex-col justify-center p-6 sm:p-10">
              <p className="flex items-center gap-2 text-sm font-bold tracking-widest text-bubble uppercase"><Clapperboard className="size-4" /> Watch</p>
              <p className="mt-1 max-w-sm font-display text-3xl leading-tight sm:text-5xl">New clay challenge videos every day</p>
              <span className="btn-clay bubble sm mt-4 w-fit">@momoblobs ↗</span>
            </div>
          </a>
        </section>

        {/* ───────────── FAQ ───────────── */}
        <section className="mx-auto w-full max-w-4xl px-5 lg:px-6">
          <SectionTitle kicker="Questions" title="Frequently asked" action={{ href: "/help", label: "Help centre" }} />
          <div className="grid gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="glass group rounded-2xl p-5 open:bg-white/10">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-lg">
                  {f.q}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-5 text-center lg:px-6">
          <div className="glass relative overflow-hidden rounded-[2rem] px-6 py-12">
            <div className="sunburst absolute inset-0 opacity-50" />
            <Gamepad2 className="relative mx-auto size-10 text-sun" />
            <p className="relative mt-2 font-display text-4xl sm:text-5xl">Ready, set… shuffle!</p>
            <p className="relative mt-2 text-muted">{live.length < GAMES.length ? `${live.length} games live now · ${GAMES.length - live.length} more clay games coming soon` : `All ${GAMES.length} clay games are live · free, no sign-up, unlimited levels`}</p>
            <Link href="/play/momo-shuffle" className="btn-clay lg relative mt-6"><Play className="size-6 fill-current" /> Play Momo Shuffle</Link>
          </div>
        </section>
      </div>
    </>
  );
}
