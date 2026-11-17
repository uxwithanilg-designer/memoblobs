import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { ProfileClient } from "@/components/profile/ProfileClient";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Choose your MOMOBLOBS player name and avatar, and see your levels, streaks and stats. Saved only on this device.",
  alternates: { canonical: "/profile" },
  robots: { index: false, follow: true },
};

export default function ProfilePage() {
  return (
    <>
      <PageHero kicker="Player card" title="My profile" crumbs={[{ name: "Profile", href: "/profile" }]} />
      <div className="mx-auto max-w-5xl px-5 lg:px-6">
        <ProfileClient />
      </div>
    </>
  );
}
