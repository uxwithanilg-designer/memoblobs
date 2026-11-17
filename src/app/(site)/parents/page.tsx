import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Brain, CloudOff, Eye, HeartHandshake, Settings2, ShieldCheck, Timer, Users } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Parents & Teachers — Safe Kids Games",
  description: "MOMOBLOBS is a safe games site for kids: no accounts, no chat, no personal data. Learn how Momo Shuffle builds focus and visual tracking, plus screen-time tips for families and classrooms.",
  alternates: { canonical: "/parents" },
};

const POINTS = [
  { icon: ShieldCheck, title: "No purchases", text: "There are no in-app purchases. Coins are just for fun and can only be spent on cup colours." },
  { icon: CloudOff, title: "No accounts or personal data", text: "Children never sign up or type an email. Progress is stored in the browser on your device only." },
  { icon: Users, title: "No chat, no strangers", text: "There is no chat, no messaging and no leaderboards with other people's names." },
  { icon: Settings2, title: "Kid Mode & big buttons", text: "Turn on slower shuffles, bigger tap targets, reduced motion and quieter sound in Settings." },
];

const SKILLS = [
  { icon: Eye, title: "Visual tracking", text: "Following one cup among many trains smooth eye tracking — the same skill used when reading along a line." },
  { icon: Brain, title: "Working memory", text: "Remembering where Momo started and updating it with every swap exercises working memory." },
  { icon: Timer, title: "Sustained attention", text: "Each round asks for 5–20 seconds of full focus, then gives a quick reward — great for building attention span." },
  { icon: HeartHandshake, title: "Resilience", text: "A miss is never a game over. Kids simply retry the level with a new shuffle, which keeps frustration low." },
];

export default function ParentsPage() {
  return (
    <>
      <PageHero kicker="For grown-ups" title="Parents & teachers" crumbs={[{ name: "Parents", href: "/parents" }]} intro="MOMOBLOBS games are made to be calm, safe and genuinely good for focus. Here is everything you need to know." art={{ src: "/brand/tiki-sign.webp", w: 620, h: 680 }} />
      <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:px-6">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p) => (
            <div key={p.title} className="glass rounded-[1.75rem] p-5">
              <p.icon className="size-8 text-mint" />
              <h2 className="mt-3 font-display text-xl">{p.title}</h2>
              <p className="mt-1 text-muted">{p.text}</p>
            </div>
          ))}
        </section>

        <section className="grid items-center gap-8 lg:grid-cols-2">
          <Image src="/games/momo-shuffle/shot-main-stage.webp" alt="The Momo Shuffle stage with three clay cups" width={1280} height={720} className="rounded-[2rem] ring-1 ring-white/15" />
          <div>
            <h2 className="font-display text-4xl">What kids practise</h2>
            <ul className="mt-5 grid gap-4">
              {SKILLS.map((s) => (
                <li key={s.title} className="flex gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-momo/20 text-momo"><s.icon className="size-6" /></span>
                  <span><span className="block font-bold text-lg">{s.title}</span><span className="text-muted">{s.text}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="prose-kid glass mx-auto w-full max-w-3xl rounded-[2rem] p-6 sm:p-10">
          <h2>Healthy screen-time tips</h2>
          <ul>
            <li>Play together first: guess out loud and celebrate when you find Momo.</li>
            <li>Short sessions work best — 10 to 15 minutes, then a stretch break.</li>
            <li>Start on <strong>Easy (3 cups)</strong> with <strong>Kid Mode</strong> on, then move up when it feels too easy.</li>
            <li>Use the pause button any time; the game auto-pauses if you switch apps.</li>
          </ul>
          <h2>In the classroom</h2>
          <p>Momo Shuffle works great on an interactive whiteboard: put it in fullscreen, play Medium (4 cups) and let the class vote on the cup with 1, 2, 3 or 4 fingers before revealing. It needs no login and runs in any modern browser.</p>
          <h2>Privacy in one sentence</h2>
          <p>We don&apos;t collect personal information from children — read the full <Link href="/privacy">privacy notice</Link>.</p>
        </section>
      </div>
    </>
  );
}
