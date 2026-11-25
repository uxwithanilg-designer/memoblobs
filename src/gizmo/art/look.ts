// A stage's look: its world, the sky mood the stage picked, and the colours worked out from them — the far layers
// melt into the haze, nights darken and cool everything, remix stages borrow a little of their partner world's
// colours. Everything the painters and the renderer need, computed once per stage.
import type { StagePlan } from "../stages";
import { worldOf, type Mood, type WorldDef } from "../worlds";
import { mix, shade } from "../util";

export interface Look {
  world: WorldDef;
  mood: Mood;
  night: number;
  sky: [string, string, string];
  /** backdrop layers far → near, already hazed and lit */
  layers: [string, string, string, string];
  haze: string;
  /** rim light on the tops of things (from the sun / moon) */
  rim: string;
  /** glowing things (windows, lamps, crystals) */
  glow: string;
  ground: WorldDef["ground"];
  metal: WorldDef["metal"];
  accent: string;
  seed: number;
  /** remix stages: the partner world, the backdrop layer painted from its scenery (−1: none), whose sky life shows */
  blend: WorldDef["id"] | null;
  mixLayer: number;
  skyWorld: WorldDef["id"];
}

export function lookFor(plan: StagePlan): Look {
  const w = worldOf(plan.world);
  const mood = w.moods[plan.mood % w.moods.length];
  const partner = plan.blend ? worldOf(plan.blend) : null;
  const night = mood.night;
  const dim = (c: string, k: number) => mix(c, shade(mood.haze, -0.55), night * k);
  let layers = w.layers.map((c, i) => {
    const hazed = mix(c, mood.haze, [0.55, 0.36, 0.18, 0.06][i]);
    return dim(mix(hazed, mood.tint, mood.tintAmt * 0.6), [0.55, 0.62, 0.7, 0.75][i]);
  }) as Look["layers"];
  if (partner) layers = layers.map((c, i) => mix(c, partner.layers[i], 0.22)) as Look["layers"];
  // remixes mix the places themselves: one backdrop layer is the partner world's scenery
  const mixLayer = partner ? plan.seed % 3 : -1;
  if (partner && mixLayer >= 0) layers[mixLayer] = dim(mix(mix(partner.layers[mixLayer], mood.haze, [0.5, 0.32, 0.16][mixLayer]), w.layers[mixLayer], 0.25), [0.55, 0.62, 0.7][mixLayer]);
  const g = w.ground;
  const ground = {
    ...g,
    cap: dim(g.cap, 0.35), cap2: dim(g.cap2, 0.4),
    body: [dim(g.body[0], 0.45), dim(g.body[1], 0.5)] as [string, string],
    detail: dim(g.detail, 0.4),
  };
  const m = w.metal;
  const metal = { ...m, main: dim(m.main, 0.3), dark: dim(m.dark, 0.35), light: dim(m.light, 0.25) };
  return {
    world: w, mood, night, sky: mood.sky, layers, haze: mood.haze,
    rim: mix(mood.sun, "#FFFFFF", 0.35), glow: w.metal.glow,
    ground, metal, accent: w.accent, seed: plan.seed,
    blend: partner ? partner.id : null, mixLayer, skyWorld: partner && plan.seed % 2 === 1 ? partner.id : w.id,
  };
}
