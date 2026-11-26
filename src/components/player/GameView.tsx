"use client";
// Picks the right engine for a game. Used by the full-screen /play?g=<slug> page and by the player on the game page.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Game, GameCard } from "@/lib/game-index";
import type { Difficulty } from "@/lib/store";
import { ARCADE_MODULES } from "@/arcade/registry";
import { audio } from "@/lib/audio";
import { soundFamily } from "@/lib/catalog";
import { thinNetwork } from "@/lib/preload";
import { loadGame } from "@/lib/catalog-data";
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
const SlurpApp = dynamic(() => import("@/slurp/ui/SlurpApp"), { ssr: false });
const VineApp = dynamic(() => import("@/vine/ui/VineApp"), { ssr: false });
const JellyApp = dynamic(() => import("@/jelly/ui/JellyApp"), { ssr: false });
const RushApp = dynamic(() => import("@/rush/ui/RushApp"), { ssr: false });
const SudokuApp = dynamic(() => import("@/sudoku/ui/SudokuApp"), { ssr: false });
const OrbiApp = dynamic(() => import("@/orbi/ui/OrbiApp"), { ssr: false });
const TrailApp = dynamic(() => import("@/trail/ui/TrailApp"), { ssr: false });
const QuiltApp = dynamic(() => import("@/quilt/ui/QuiltApp"), { ssr: false });
const GlowApp = dynamic(() => import("@/glow/ui/GlowApp"), { ssr: false });
const CrownApp = dynamic(() => import("@/crown/ui/CrownApp"), { ssr: false });
const TideApp = dynamic(() => import("@/tide/ui/TideApp"), { ssr: false });
const MoonvialApp = dynamic(() => import("@/vial/ui/MoonvialApp"), { ssr: false });
const TreatApp = dynamic(() => import("@/treat/ui/TreatApp"), { ssr: false });
const SproutApp = dynamic(() => import("@/sprout/ui/SproutApp"), { ssr: false });
const RelicApp = dynamic(() => import("@/relic/ui/RelicApp"), { ssr: false });
const BreezeApp = dynamic(() => import("@/breeze/ui/BreezeApp"), { ssr: false });
const PicnicApp = dynamic(() => import("@/picnic/ui/PicnicApp"), { ssr: false });
const JadeApp = dynamic(() => import("@/jade/ui/JadeApp"), { ssr: false });
const NovaApp = dynamic(() => import("@/nova/ui/NovaApp"), { ssr: false });
const MarbleApp = dynamic(() => import("@/marble/ui/MarbleApp"), { ssr: false });
const RoverApp = dynamic(() => import("@/rover/ui/RoverApp"), { ssr: false });
const HaulApp = dynamic(() => import("@/haul/ui/HaulApp"), { ssr: false });
const RumbleApp = dynamic(() => import("@/rumble/ui/RumbleApp"), { ssr: false });
const GizmoApp = dynamic(() => import("@/gizmo/ui/GizmoApp"), { ssr: false });
const WakeApp = dynamic(() => import("@/wake/ui/WakeApp"), { ssr: false });
const StormApp = dynamic(() => import("@/storm/ui/StormApp"), { ssr: false });
const ClashApp = dynamic(() => import("@/clash/ui/ClashApp"), { ssr: false });
const CrumbleApp = dynamic(() => import("@/crumble/ui/CrumbleApp"), { ssr: false });
const VanguardApp = dynamic(() => import("@/vanguard/ui/VanguardApp"), { ssr: false });
const MelonApp = dynamic(() => import("@/melon/ui/MelonApp"), { ssr: false });
const UnveilApp = dynamic(() => import("@/unveil/ui/UnveilApp"), { ssr: false });
const PupsApp = dynamic(() => import("@/pups/ui/PupsApp"), { ssr: false });
const PlankApp = dynamic(() => import("@/plank/ui/PlankApp"), { ssr: false });
const SplashApp = dynamic(() => import("@/splash/ui/SplashApp"), { ssr: false });
const RopeApp = dynamic(() => import("@/rope/ui/RopeApp"), { ssr: false });
const BandApp = dynamic(() => import("@/band/ui/BandApp"), { ssr: false });
const TacApp = dynamic(() => import("@/tac/ui/TacApp"), { ssr: false });
const BeadApp = dynamic(() => import("@/bead/ui/BeadApp"), { ssr: false });
const WiggleApp = dynamic(() => import("@/wiggle/ui/WiggleApp"), { ssr: false });
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
  slurp: () => import("@/slurp/ui/SlurpApp"),
  vine: () => import("@/vine/ui/VineApp"),
  jelly: () => import("@/jelly/ui/JellyApp"),
  rush: () => import("@/rush/ui/RushApp"),
  sudoku: () => import("@/sudoku/ui/SudokuApp"),
  orbi: () => import("@/orbi/ui/OrbiApp"),
  trail: () => import("@/trail/ui/TrailApp"),
  quilt: () => import("@/quilt/ui/QuiltApp"),
  glow: () => import("@/glow/ui/GlowApp"),
  crown: () => import("@/crown/ui/CrownApp"),
  tide: () => import("@/tide/ui/TideApp"),
  vial: () => import("@/vial/ui/MoonvialApp"),
  treat: () => import("@/treat/ui/TreatApp"),
  sprout: () => import("@/sprout/ui/SproutApp"),
  relic: () => import("@/relic/ui/RelicApp"),
  breeze: () => import("@/breeze/ui/BreezeApp"),
  picnic: () => import("@/picnic/ui/PicnicApp"),
  jade: () => import("@/jade/ui/JadeApp"),
  nova: () => import("@/nova/ui/NovaApp"),
  marble: () => import("@/marble/ui/MarbleApp"),
  rover: () => import("@/rover/ui/RoverApp"),
  haul: () => import("@/haul/ui/HaulApp"),
  rumble: () => import("@/rumble/ui/RumbleApp"),
  gizmo: () => import("@/gizmo/ui/GizmoApp"),
  wake: () => import("@/wake/ui/WakeApp"),
  storm: () => import("@/storm/ui/StormApp"),
  clash: () => import("@/clash/ui/ClashApp"),
  crumble: () => import("@/crumble/ui/CrumbleApp"),
  vanguard: () => import("@/vanguard/ui/VanguardApp"),
  melon: () => import("@/melon/ui/MelonApp"),
  unveil: () => import("@/unveil/ui/UnveilApp"),
  pups: () => import("@/pups/ui/PupsApp"),
  plank: () => import("@/plank/ui/PlankApp"),
  splash: () => import("@/splash/ui/SplashApp"),
  rope: () => import("@/rope/ui/RopeApp"),
  band: () => import("@/band/ui/BandApp"),
  tac: () => import("@/tac/ui/TacApp"),
  bead: () => import("@/bead/ui/BeadApp"),
  wiggle: () => import("@/wiggle/ui/WiggleApp"),
  arcade: () => import("@/arcade/ArcadeHost"),
};

const warmed = new Set<string>();
/**
 * Called on a game's page while the player looks at it: the game's code and its menu music + sounds download in
 * the background, so pressing Play opens the game almost at once. Skipped on Save-Data / 2G connections.
 */
export function warmGame(g: GameCard) {
  const slug = g.slug;
  if (warmed.has(slug) || thinNetwork()) return;
  warmed.add(slug);
  const engine = slug === "momo-shuffle" ? "momo" : g.engine ?? "arcade";
  void ENGINE_CODE[engine]?.().catch(() => {});
  if (engine === "arcade") void ARCADE_MODULES[slug]?.().catch(() => {});
  // the player's own data for this game (/games/<slug>/game.json), so the player opens without waiting for it
  void loadGame(slug).catch(() => {});
  audio.warmFamily(soundFamily(g), "menu");
}

function Arcade({ g }: { g: Game }) {
  const slug = g.slug;
  const [Ctor, setCtor] = useState<GameCtor | null>(null);
  useEffect(() => {
    let alive = true;
    ARCADE_MODULES[slug]?.().then((m) => { if (alive) setCtor(() => m.default); });
    return () => { alive = false; };
  }, [slug]);
  return Ctor ? <ArcadeHost game={g} Ctor={Ctor} host={(g.host ?? "momo") as CastId} /> : null;
}

export function GameView({ game: g, mode }: { game: Game; mode?: Difficulty }) {
  const slug = g.slug;
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
    case "slurp": return <SlurpApp slug={slug} title={g.title} />;
    case "vine": return <VineApp slug={slug} title={g.title} />;
    case "jelly": return <JellyApp slug={slug} title={g.title} />;
    case "rush": return <RushApp slug={slug} title={g.title} />;
    case "sudoku": return <SudokuApp slug={slug} title={g.title} />;
    case "orbi": return <OrbiApp slug={slug} title={g.title} />;
    case "trail": return <TrailApp slug={slug} title={g.title} />;
    case "quilt": return <QuiltApp slug={slug} title={g.title} />;
    case "glow": return <GlowApp slug={slug} title={g.title} />;
    case "crown": return <CrownApp slug={slug} title={g.title} />;
    case "tide": return <TideApp slug={slug} title={g.title} />;
    case "vial": return <MoonvialApp slug={slug} title={g.title} />;
    case "treat": return <TreatApp slug={slug} title={g.title} />;
    case "sprout": return <SproutApp slug={slug} title={g.title} />;
    case "relic": return <RelicApp slug={slug} title={g.title} />;
    case "breeze": return <BreezeApp slug={slug} title={g.title} />;
    case "picnic": return <PicnicApp slug={slug} title={g.title} />;
    case "jade": return <JadeApp slug={slug} title={g.title} />;
    case "nova": return <NovaApp slug={slug} title={g.title} />;
    case "marble": return <MarbleApp slug={slug} title={g.title} />;
    case "rover": return <RoverApp slug={slug} title={g.title} />;
    case "haul": return <HaulApp slug={slug} title={g.title} />;
    case "rumble": return <RumbleApp slug={slug} title={g.title} />;
    case "gizmo": return <GizmoApp slug={slug} title={g.title} />;
    case "wake": return <WakeApp slug={slug} title={g.title} />;
    case "storm": return <StormApp slug={slug} title={g.title} />;
    case "clash": return <ClashApp slug={slug} title={g.title} />;
    case "crumble": return <CrumbleApp slug={slug} title={g.title} />;
    case "vanguard": return <VanguardApp slug={slug} title={g.title} />;
    case "melon": return <MelonApp slug={slug} title={g.title} />;
    case "unveil": return <UnveilApp slug={slug} title={g.title} />;
    case "pups": return <PupsApp slug={slug} title={g.title} />;
    case "plank": return <PlankApp slug={slug} title={g.title} />;
    case "splash": return <SplashApp slug={slug} title={g.title} />;
    case "rope": return <RopeApp slug={slug} title={g.title} />;
    case "band": return <BandApp slug={slug} title={g.title} />;
    case "tac": return <TacApp slug={slug} title={g.title} />;
    case "bead": return <BeadApp slug={slug} title={g.title} />;
    case "wiggle": return <WiggleApp slug={slug} title={g.title} />;
    default: return <Arcade g={g} />;
  }
}
