import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { DailyGift } from "@/components/home/ClientBits";
import { RewardsClient } from "@/components/profile/RewardsClient";

export const metadata: Metadata = {
  title: "Rewards — Coins, Trophies & Cup Shop",
  description: "Collect coins in MOMOBLOBS games, open your free daily gift, unlock trophies and spend coins on new clay cup colours. Everything is saved in your browser.",
  alternates: { canonical: "/rewards" },
};

export default function RewardsPage() {
  return (
    <>
      <PageHero kicker="Your treasure" title="Rewards" crumbs={[{ name: "Rewards", href: "/rewards" }]} intro="Find Momo to earn coins. Open a gift every day, win trophies and buy shiny new cups!" art={{ src: "/brand/coin.webp", w: 160, h: 164 }} />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:px-6">
        <DailyGift />
        <RewardsClient />
      </div>
    </>
  );
}
