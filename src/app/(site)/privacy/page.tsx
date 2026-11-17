import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Privacy",
  description: "MOMOBLOBS privacy notice: no accounts, no tracking of children. Game progress and settings are stored only in your browser.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero kicker="Plain and simple" title="Privacy" crumbs={[{ name: "Privacy", href: "/privacy" }]} intro="Last updated 17 November 2026." />
      <article className="prose-kid mx-auto max-w-3xl px-5 lg:px-6">
        <h2>The short version</h2>
        <ul>
          <li>No accounts, no sign-up, no email addresses.</li>
          <li>Your coins, levels, trophies, name and settings are saved in <strong>your browser&apos;s local storage</strong> on your own device. We never receive them.</li>
        </ul>
        <h2>What is stored on your device</h2>
        <p>Two small entries in local storage: <code>momoblobs:profile</code> (player name, avatar, coins, levels, trophies, cup skins, days played) and <code>momoblobs:settings</code> (sound, graphics and gameplay options). You can erase them any time from <strong>Profile → Reset progress</strong> or by clearing your browser&apos;s site data.</p>
        <h2>What our servers see</h2>
        <p>Like every website, the server that delivers the pages receives standard technical request information (such as IP address and browser type) to send you the files. We do not use it to identify or profile anyone.</p>
        <h2>Children</h2>
        <p>MOMOBLOBS is designed for children and families. We do not knowingly collect personal information from children. The player name is optional, stays on the device and is never shared.</p>
        <h2>Links to other sites</h2>
        <p>Links to YouTube and Instagram open those services, which have their own privacy policies. We recommend a grown-up opens them.</p>
        <h2>Changes</h2>
        <p>If this notice changes, the date at the top of the page will change too.</p>
      </article>
    </>
  );
}
