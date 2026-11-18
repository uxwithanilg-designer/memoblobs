"use client";
// Picks the right engine for a game. Used by the full-screen /play?g=<slug> page and by the player on the game page.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getGame } from "@/lib/games";
import type { Difficulty } from "@/lib/store";
import { ARCADE_MODULES } from "@/arcade/registry";
import { audio } from "@/lib/audio";
import { soundFamily } from "@/lib/catalog";
import { thinNetwork } from "@/lib/preload";
import type { GameCtor } from "@/arcade/ArcadeHost";
import type { CastId } from "@/arcade/engine";

const MomoShuffle = dynamic(() => import("@/games/momo-shuffle/MomoShuffle"), { ssr: false });
const RacingApp = dynamic(() => import("@/racing/ui/RacingApp"), { ssr: false });
const BrigadeApp = dynamic(() => import("@/crowd/ui/BrigadeApp"), { ssr: false });
const BoingApp = dynamic(() => import("@/boing/ui/BoingApp"), { ssr: false });
const DashApp = dynamic(() => import("@/dash/ui/DashApp"), { ssr: false });
const KikoApp = dynamic(() => import("@/jungle/ui/KikoApp"), { ssr: false });
const RollApp = dynamic(() => import("@/roll/ui/RollApp"), { ssr: false });
const EscapeApp = dynamic(() => import("@/escape/ui/EscapeApp"), { ssr: false });
const ClaylandApp = dynamic(() => import("@/clayland/ui/ClaylandApp"), { ssr: false });
const ArcadeHost = dynamic(() => import("@/arcade/ArcadeHost").then((m) => m.ArcadeHost), { ssr: false });

/** each engine's code (the same chunks the players below load) */
const ENGINE_CODE: Record<string, () => Promise<unknown>> = {
  momo: () => import("@/games/momo-shuffle/MomoShuffle"),
  racing: () => import("@/racing/ui/RacingApp"),
  brigade: () => import("@/crowd/ui/BrigadeApp"),
  boing: () => import("@/boing/ui/BoingApp"),
  dash: () => import("@/dash/ui/DashApp"),
  jungle: () => import("@/jungle/ui/KikoApp"),
  roll: () => import("@/roll/ui/RollApp"),
  escape: () => import("@/escape/ui/EscapeApp"),
  clayland: () => import("@/clayland/ui/ClaylandApp"),
  arcade: () => import("@/arcade/ArcadeHost"),
};

const warmed = new Set<string>();
/**
 * Called on a game's page while the player looks at it: the game's code and its menu music + sounds download in
 * the background, so pressing Play opens the game almost at once. Skipped on Save-Data / 2G connections.
 */
export function warmGame(slug: string) {
  const g = getGame(slug);
  if (!g || warmed.has(slug) || thinNetwork()) return;
  warmed.add(slug);
  const engine = slug === "momo-shuffle" ? "momo" : g.engine ?? "arcade";
  void ENGINE_CODE[engine]?.().catch(() => {});
  if (engine === "arcade") void ARCADE_MODULES[slug]?.().catch(() => {});
  audio.warmFamily(soundFamily(g), "menu");
}

function Arcade({ slug }: { slug: string }) {
  const g = getGame(slug)!;
  const [Ctor, setCtor] = useState<GameCtor | null>(null);
  useEffect(() => {
    let alive = true;
    ARCADE_MODULES[slug]?.().then((m) => { if (alive) setCtor(() => m.default); });
    return () => { alive = false; };
  }, [slug]);
  return Ctor ? <ArcadeHost game={g} Ctor={Ctor} host={(g.host ?? "momo") as CastId} /> : null;
}

export function GameView({ slug, mode }: { slug: string; mode?: Difficulty }) {
  const g = getGame(slug)!;
  if (slug === "momo-shuffle") return <MomoShuffle initialMode={mode} />;
  switch (g.engine) {
    case "racing": return <RacingApp slug={slug} title={g.title} />;
    case "brigade": return <BrigadeApp slug={slug} title={g.title} />;
    case "boing": return <BoingApp slug={slug} title={g.title} />;
    case "dash": return <DashApp slug={slug} title={g.title} />;
    case "jungle": return <KikoApp slug={slug} title={g.title} />;
    case "roll": return <RollApp slug={slug} title={g.title} />;
    case "escape": return <EscapeApp slug={slug} title={g.title} />;
    case "clayland": return <ClaylandApp slug={slug} title={g.title} />;
    default: return <Arcade slug={slug} />;
  }
}
