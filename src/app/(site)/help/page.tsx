import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "Answers to common MOMOBLOBS questions: how to play Momo Shuffle, where coins are saved, sound not working, playing full screen on iPhone and Android, and more.",
  alternates: { canonical: "/help" },
};

const GROUPS = [
  {
    title: "Playing",
    items: [
      { q: "How do I play Momo Shuffle?", a: "Watch which cup Momo hops under, follow that cup while Kranky shuffles, then tap it (or press its number). Finding Momo wins coins and takes you to the next level." },
      { q: "What do Easy, Medium and Hard mean?", a: "Easy has 3 cups, Medium has 4 cups and Hard has 6 cups. Each level adds more swaps and more speed, and twists like Fake-Out and Lights Off appear as you go." },
      { q: "Is there an end?", a: "No — every mode has unlimited levels. If you miss, you replay the same level with a new shuffle." },
      { q: "It's too fast for my child.", a: "Open Settings → Gameplay and turn on Kid Mode. Shuffles get slower with fewer swaps. You can also turn on Big buttons." },
    ],
  },
  {
    title: "Coins & progress",
    items: [
      { q: "Where are my coins saved?", a: "In your browser's local storage on this device. Clearing browser data or using private/incognito mode will reset them." },
      { q: "Can I move progress to another device?", a: "Not yet. Because there are no accounts, progress stays on the device you play on." },
      { q: "What can I buy with coins?", a: "New cup colours in the Rewards → Cup shop. Coins are never real money." },
    ],
  },
  {
    title: "Technical",
    items: [
      { q: "There is no sound.", a: "Tap the screen once (phones need a tap before playing sound), check the mute button in the game's top bar, and make sure your phone isn't on silent." },
      { q: "How do I play full screen?", a: "On computers and Android use the fullscreen button in the game. On iPhone, tap Share → Add to Home Screen and open MOMOBLOBS from your home screen." },
      { q: "The game is slow or choppy.", a: "Open Settings → Graphics and choose Low quality or lower the Resolution slider. Auto quality also adapts automatically." },
      { q: "Which browsers are supported?", a: "Recent versions of Chrome, Safari, Edge and Firefox on phones, tablets and computers. WebGL must be enabled." },
    ],
  },
];

export default function HelpPage() {
  const all = GROUPS.flatMap((g) => g.items);
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: all.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <PageHero kicker="Help centre" title="Help & FAQ" crumbs={[{ name: "Help", href: "/help" }]} intro={<>Stuck? Here are quick answers. Still need help? Check the <Link className="text-sun underline" href="/parents">parents guide</Link>.</>} art={{ src: "/brand/momo-surprised.webp", w: 720, h: 575 }} />
      <div className="mx-auto grid max-w-4xl gap-10 px-5 lg:px-6">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="mb-4 font-display text-3xl">{g.title}</h2>
            <div className="grid gap-3">
              {g.items.map((f) => (
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
        ))}
      </div>
    </>
  );
}
