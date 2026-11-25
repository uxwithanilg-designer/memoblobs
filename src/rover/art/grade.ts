// The colour grade of a stage: the world's palette (blended with a remix partner's), moved to the stage's time of day.
// Far ridges fade into the haze (atmospheric depth); mornings are soft peach, golden hours warm, dusks violet, nights
// deep blue with the ground still readable.
import type { StagePlan } from "../stages";
import { worldOf, type TimeOfDay, type Weather, type World } from "../worlds";
import { mix, shade } from "../util";

export interface Look {
  world: World;
  partner: World | null;
  time: TimeOfDay;
  weather: Weather;
  enclosed: World["enclosed"];
  sky: [string, string, string];
  sun: string;
  haze: string;
  ridges: [string, string, string];
  surface: string; surfaceHi: string; soil: [string, string]; strata: string;
  accent: string; glow: string;
  /** 0 day … 1 night: lights, windows, glows and stars come up with it */
  night: number;
  /** sun / moon height on screen (0 = horizon, 1 = top) and side (0 = left, 1 = right) */
  sunY: number; sunX: number;
  /** light colour for rims and highlights */
  light: string;
  /** a full-screen tint laid over everything (night blue, golden warmth) and its strength */
  tint: string; tintAmt: number;
}

const TIME: Record<TimeOfDay, { sky: [string, string, string]; tint: string; amt: number; dark: number; light: string; sunY: number; w: number }> = {
  morning: { sky: ["#6FA6EA", "#BFD7F2", "#FFDCC0"], tint: "#FFC9A8", amt: 0.1, dark: 0.02, light: "#FFE6CC", sunY: 0.3, w: 0.55 },
  day: { sky: ["#4FA3F7", "#8CCBFF", "#DDF3FF"], tint: "#FFFFFF", amt: 0, dark: 0, light: "#FFFBEA", sunY: 0.78, w: 0 },
  golden: { sky: ["#4767B6", "#EE9C6C", "#FFD596"], tint: "#FF9A4A", amt: 0.2, dark: 0.06, light: "#FFD08A", sunY: 0.2, w: 0.7 },
  dusk: { sky: ["#272A66", "#A65A9C", "#FF9C7A"], tint: "#7A4CA8", amt: 0.26, dark: 0.22, light: "#FFB8A0", sunY: 0.06, w: 0.78 },
  night: { sky: ["#060A1E", "#111C4A", "#26387A"], tint: "#1E2C6A", amt: 0.42, dark: 0.5, light: "#BFD4FF", sunY: 0.72, w: 0.85 },
};
const DEPTH_HAZE = [0.5, 0.26, 0.1];

export function lookFor(plan: StagePlan): Look {
  const world = worldOf(plan.world), partner = plan.blend ? worldOf(plan.blend) : null;
  const b = partner ? plan.blendAmt : 0;
  const P = (a: string, k: string) => (partner ? mix(a, k, b) : a);
  const tm = TIME[plan.time];
  const enclosed = world.enclosed;
  const wsky = world.sky.map((c, i) => P(c, partner ? partner.sky[i] : c)) as [string, string, string];
  // a twist night drive or a night stage: the world's own sky pulled towards the time's sky
  const sky = enclosed ? wsky : (wsky.map((c, i) => mix(c, tm.sky[i], world.id === "metro" ? tm.w * 0.6 : tm.w)) as [string, string, string]);
  const haze = enclosed ? P(world.haze, partner?.haze ?? world.haze) : mix(P(world.haze, partner?.haze ?? world.haze), sky[2], 0.45 * tm.w + 0.2);
  const tint = tm.tint, amt = enclosed ? 0.1 : tm.amt, dark = enclosed ? 0.18 : tm.dark;
  const grade = (c: string, depth: number) => {
    let x = mix(c, haze, DEPTH_HAZE[depth] ?? 0);
    x = mix(x, tint, amt * (0.6 + 0.4 * (depth === undefined ? 0 : 1)));
    return dark > 0 ? shade(x, -dark * (0.85 - (depth ?? 0) * 0.1)) : x;
  };
  const ridges = world.ridges.map((r, i) => grade(P(r.color, partner ? partner.ridges[i].color : r.color), i)) as [string, string, string];
  const g0 = (c: string) => (dark > 0 ? shade(mix(c, tint, amt * 0.5), -dark * 0.55) : mix(c, tint, amt * 0.5));
  const night = enclosed ? 0.85 : plan.time === "night" ? 1 : plan.time === "dusk" ? 0.45 : plan.time === "golden" ? 0.12 : 0;
  return {
    world, partner, time: plan.time, weather: plan.weather, enclosed,
    sky, sun: plan.time === "night" ? "#F4F1FF" : world.sun, haze,
    ridges,
    surface: g0(P(world.surface, partner?.surface ?? world.surface)), surfaceHi: g0(P(world.surfaceHi, partner?.surfaceHi ?? world.surfaceHi)),
    soil: [g0(P(world.soil[0], partner?.soil[0] ?? world.soil[0])), g0(P(world.soil[1], partner?.soil[1] ?? world.soil[1]))],
    strata: world.id === "volcano" ? world.strata : g0(P(world.strata, partner?.strata ?? world.strata)),
    accent: world.accent, glow: world.glow,
    night, sunY: enclosed === "space" ? 0.62 : tm.sunY, sunX: 0.72 - (plan.seed % 7) * 0.04,
    light: enclosed === "cave" ? "#C9B6FF" : tm.light, tint, tintAmt: amt,
  };
}
