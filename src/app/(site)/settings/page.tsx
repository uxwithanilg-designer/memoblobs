import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata: Metadata = {
  title: "Settings — Sound, Graphics & Gameplay",
  description: "Adjust MOMOBLOBS game settings: music and sound volume, graphics quality, frame rate, Kid Mode slower shuffles, big buttons, vibration and controls.",
  alternates: { canonical: "/settings" },
  robots: { index: false, follow: true },
};

export default function SettingsPage() {
  return (
    <>
      <PageHero kicker="Make it yours" title="Settings" crumbs={[{ name: "Settings", href: "/settings" }]} intro="These settings apply to every MOMOBLOBS game and are saved on this device." art={{ src: "/brand/tiki.webp", w: 560, h: 577 }} />
      <div className="mx-auto max-w-3xl px-5 lg:px-6">
        <SettingsForm />
      </div>
    </>
  );
}
