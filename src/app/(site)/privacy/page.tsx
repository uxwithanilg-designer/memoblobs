import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { CookieSettingsButton } from "@/components/ConsentBanner";

export const metadata: Metadata = {
  title: "Privacy",
  description: "MOMOBLOBS privacy notice: no accounts or sign-up, game progress stays in your browser, and Google Analytics cookies you can switch off.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero kicker="Plain and simple" title="Privacy" crumbs={[{ name: "Privacy", href: "/privacy" }]} intro="Last updated 22 November 2026." />
      <article className="prose-page mx-auto max-w-3xl px-5 lg:px-6">
        <h2>The short version</h2>
        <ul>
          <li>No accounts, no sign-up, no email addresses.</li>
          <li>Your coins, levels, trophies, name and settings are saved in <strong>your browser&apos;s local storage</strong> on your own device. We never receive them.</li>
          <li>We use <strong>Google Analytics</strong> to count visits and see which games are played. You can switch it off any time.</li>
        </ul>
        <h2>What is stored on your device</h2>
        <p>A few small entries in local storage: <code>momoblobs:profile</code> (player name, avatar, coins, levels, trophies, cup skins, days played), <code>momoblobs:settings</code> (sound, graphics and gameplay options), each game&apos;s own save, and <code>momoblobs:consent</code> (your cookie choice). You can erase them any time from <strong>Profile → Reset progress</strong> or by clearing your browser&apos;s site data.</p>
        <h2 id="cookies">Analytics and cookies</h2>
        <p>MOMOBLOBS uses Google Analytics 4 (a service of Google) to understand how the site is used: pages viewed, which games are started, the kind of device and browser, the country or city (from a shortened IP address) and how people found the site. Google Analytics sets its own cookies to tell visits apart. We use this only to improve the games and the site; we don&apos;t combine it with anything that names you, and the player name never leaves your device.</p>
        <p>Visitors in the EU, EEA, UK and Switzerland are asked first, and no analytics cookies are set until they accept. Everyone can change their choice here:</p>
        <p><CookieSettingsButton /></p>
        <p>You can also use Google&apos;s <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Analytics opt-out add-on</a> or block cookies in your browser. How Google uses this data: <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">policies.google.com/technologies/partner-sites</a>.</p>
        <h2>What our servers see</h2>
        <p>Like every website, the server that delivers the pages receives standard technical request information (such as IP address and browser type) to send you the files. We do not use it to identify anyone.</p>
        <h2>Age</h2>
        <p>MOMOBLOBS is a general-audience games website. We do not knowingly collect personal information from anyone under 13. The player name is optional, stays on the device and is never shared.</p>
        <h2>Links to other sites</h2>
        <p>Links to YouTube and Instagram open those services, which have their own privacy policies. Their own rules apply there.</p>
        <h2>Changes</h2>
        <p>If this notice changes, the date at the top of the page will change too.</p>
      </article>
    </>
  );
}
