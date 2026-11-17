"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GamePlayer } from "@/components/player/GamePlayer";
import { getGame } from "@/lib/games";
import type { Difficulty } from "@/lib/store";
import { ARCADE_MODULES } from "@/arcade/registry";
import type { GameCtor } from "@/arcade/ArcadeHost";
import type { CastId } from "@/arcade/engine";

const MomoShuffle = dynamic(() => import("@/games/momo-shuffle/MomoShuffle"), { ssr: false });
const RacingApp = dynamic(() => import("@/racing/ui/RacingApp"), { ssr: false });
const BrigadeApp = dynamic(() => import("@/crowd/ui/BrigadeApp"), { ssr: false });
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

export function PlayClient({ slug }: { slug: string }) {
  const sp = useSearchParams();
  const g = getGame(slug)!;
  const m = sp.get("mode");
  const mode = m === "easy" || m === "medium" || m === "hard" ? (m as Difficulty) : undefined;
  return (
    <GamePlayer game={g}>
      {slug === "momo-shuffle" ? <MomoShuffle initialMode={mode} /> : g.engine === "racing" ? <RacingApp slug={slug} title={g.title} /> : g.engine === "brigade" ? <BrigadeApp slug={slug} title={g.title} /> : <Arcade slug={slug} />}
    </GamePlayer>
  );
}
