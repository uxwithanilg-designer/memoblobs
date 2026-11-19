"use client";
// The parts of the home page that depend on this device: "Continue playing", saved games and the add-to-home-screen card.
import { useEffect, useState } from "react";
import { Clock, Bookmark, Download, X } from "lucide-react";
import { AppIcon } from "@/components/brand/Logo";
import { GameRow } from "@/components/home/GameRow";
import { getGame, type Game } from "@/lib/games";
import { useLibrary } from "@/lib/library";
import { useHydrated } from "@/lib/store";

const pick = (slugs: string[]) => slugs.map(getGame).filter((g): g is Game => !!g && g.status === "live");

export function ContinueRow() {
  const ok = useHydrated();
  const recent = useLibrary((s) => s.recent);
  if (!ok || !recent.length) return null;
  return <GameRow title="Continue playing" href="/recent" games={pick(recent.map((r) => r.slug))} icon={<Clock className="size-5 text-white/70" />} variant="wide" />;
}

export function SavedRow() {
  const ok = useHydrated();
  const saved = useLibrary((s) => s.saved);
  if (!ok || !saved.length) return null;
  return <GameRow title="Your saved games" href="/saved" games={pick(saved)} icon={<Bookmark className="size-5 text-bubble" />} />;
}

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Play it like an app": installs the site to the home screen where the browser allows it */
export function AppCard() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [help, setHelp] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEvt(e as BIP); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  if (gone) return null;
  const install = async () => {
    if (evt) { await evt.prompt(); await evt.userChoice.catch(() => null); setEvt(null); }
    else setHelp(true);
  };
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-[#5b2fd6] via-[#7b3fe4] to-[#c2489e] p-4 sm:p-6">
      <div className="pointer-events-none absolute -top-10 -right-6 size-48 rounded-full bg-white/10 blur-2xl" />
      <button onClick={() => setGone(true)} aria-label="Hide" className="absolute top-2 right-2 z-10 grid size-8 place-items-center rounded-full text-white/70 hover:bg-white/10"><X className="size-4" /></button>
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3 pr-8 sm:contents">
          <AppIcon size={56} className="shadow-[0_8px_20px_-6px_rgb(0_0_0/0.5)] ring-2 ring-white/30" />
          <div className="min-w-0 sm:flex-1">
            <p className="text-lg leading-tight font-bold text-white sm:text-xl">Play MOMOBLOBS like an app</p>
            <p className="mt-0.5 text-sm text-white/80">{help ? "On iPhone: tap Share → Add to Home Screen. On Android: open the browser menu → Install app." : "Add it to your home screen — full screen, one tap away."}</p>
          </div>
        </div>
        <button onClick={install} className="flex items-center justify-center gap-2 rounded-full bg-sun px-5 py-2.5 font-bold text-ink shadow-lg transition hover:brightness-105 active:scale-95 sm:mr-8"><Download className="size-4" /> {evt ? "Install" : "How to add"}</button>
      </div>
    </section>
  );
}
