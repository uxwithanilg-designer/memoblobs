import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { SITE } from "@/lib/site";
import { playHref } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "About MOMOBLOBS — Clay Games for Sharp Eyes",
  description: "MOMOBLOBS makes handmade-style claymation brain games and videos starring Momo, Kranky and Tiki. Learn how the games and the YouTube cup challenges are made.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero kicker="Our story" title="About MOMOBLOBS" crumbs={[{ name: "About", href: "/about" }]} intro={SITE.tagline + "."} art={{ src: "/brand/momo-wave.webp", w: 720, h: 534 }} />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:px-6">
        <Image src="/brand/banner.webp" alt="MOMOBLOBS — clay games for sharp eyes" width={1920} height={1080} priority className="aspect-[16/6] w-full rounded-[2rem] object-cover ring-1 ring-white/15" />
        <section className="prose-page mx-auto w-full max-w-3xl">
          <h2>From videos to games</h2>
          <p>MOMOBLOBS started as a series of claymation cup-challenge videos: Momo hides under a cup, Kranky the crab shuffles faster every day, and viewers comment where they think Momo is. People kept asking to <strong>play</strong> it themselves — so we built the games.</p>
          <p>Every game on this site uses the <strong>same characters, the same clay stage and the same sounds</strong> as the videos. The clay look comes from hand-made-style materials with fingerprints, lumps and a 12-frames-per-second stop-motion feel.</p>
          <h2>What we believe</h2>
          <ul>
            <li>Games should be fair, kind and fun to come back to.</li>
            <li>Missing is part of learning — there&apos;s no game over, only “try again”.</li>
            <li>Your data belongs to you: everything is saved on your own device.</li>
          </ul>
          <h2>Watch &amp; follow</h2>
          <p>New cup challenges arrive every day on <a href={SITE.social.youtube} target="_blank" rel="noopener noreferrer">YouTube</a> and <a href={SITE.social.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>. Try to beat the video, then come back and <Link href={playHref("momo-shuffle")}>play Momo Shuffle</Link>.</p>
        </section>
      </div>
    </>
  );
}
