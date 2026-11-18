import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { PlayClient } from "./PlayClient";

export const metadata: Metadata = {
  title: "Play free online",
  description: "Play MOMOBLOBS games free in your browser.",
  robots: { index: false, follow: true },
};

/** what the page shows until the game is picked from the address (same look as the player's loading splash) */
function Opening() {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-night">
      <div className="sunburst absolute inset-0 opacity-60" style={{ scale: 2 }} />
      <div className="relative flex w-[min(86vw,420px)] flex-col items-center text-center">
        <Logo size={64} href={null} />
        <Image src="/brand/momo-wave.webp" alt="" width={260} height={193} priority className="mt-6 w-40 drop-shadow-2xl" />
        <div className="mt-[4.5rem] h-4 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
          <div className="shine h-full w-[6%] rounded-full bg-gradient-to-r from-sun via-momo to-bubble" />
        </div>
        <p className="mt-3 h-5 text-sm font-semibold text-muted">Opening the clay box…</p>
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<Opening />}>
      <PlayClient />
    </Suspense>
  );
}
