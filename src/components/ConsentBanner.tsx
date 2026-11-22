"use client";
// Cookie choice for visitors in Europe (Consent Mode v2, see lib/analytics.ts). Everyone can reopen it from
// Privacy → Cookie settings. Never shown inside a game page's frame.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ANALYTICS_ON, OPEN_CONSENT_EVENT, needsConsentBanner, readConsent, saveConsent, type Consent } from "@/lib/analytics";

export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ANALYTICS_ON || window.parent !== window) return;
    // a moment after the page appears, so it doesn't fight the first paint
    const first = setTimeout(() => { if (readConsent() === null && needsConsentBanner()) setOpen(true); }, 800);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => { clearTimeout(first); window.removeEventListener(OPEN_CONSENT_EVENT, reopen); };
  }, []);

  if (!open) return null;
  const pick = (v: Consent) => { saveConsent(v); setOpen(false); };
  return (
    <div role="dialog" aria-label="Cookie choices" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[90] mx-auto max-w-xl rounded-2xl bg-[#1d1240]/95 p-4 shadow-[0_20px_60px_-15px_rgb(0_0_0/0.8)] ring-1 ring-white/15 backdrop-blur sm:bottom-6 sm:p-5">
      <p className="font-bold text-white">Cookies on MOMOBLOBS</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        We use Google Analytics cookies to see which games people play and to keep the site fast. Your game progress stays on
        your device either way. <Link href="/privacy#cookies" className="font-semibold text-sun underline-offset-2 hover:underline">Learn more</Link>
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => pick("denied")} className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-white/15">
          Decline
        </button>
        <button type="button" onClick={() => pick("granted")} className="rounded-full bg-sun px-5 py-2 text-sm font-bold text-ink hover:brightness-105">
          Accept
        </button>
      </div>
    </div>
  );
}

/** Privacy page button: shows the current choice and reopens the banner */
export function CookieSettingsButton() {
  const [c, setC] = useState<Consent | null>(null);
  useEffect(() => {
    const read = () => setC(readConsent());
    read();
    window.addEventListener("momoblobs:consent", read);
    return () => window.removeEventListener("momoblobs:consent", read);
  }, []);
  return (
    <span className="not-prose inline-flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
        className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-white/15">
        Cookie settings
      </button>
      <span className="text-sm text-muted">Analytics: {c === "denied" ? "off" : c === "granted" ? "on" : "default for your region"}</span>
    </span>
  );
}
