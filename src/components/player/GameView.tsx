"use client";
// Picks the right engine for a game. Used by the full-screen /play page and by the player on the game page.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getGame } from "@/lib/games";
import type { Difficulty } from "@/lib/store";
import { ARCADE_MODULES } from "@/arcade/registry";
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
const ArcadeHost = dynamic(() => import("@/arcade/ArcadeHost").then((m) => m.ArcadeHost), { ssr: false });

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
    default: return <Arcade slug={slug} />;
  }
}
