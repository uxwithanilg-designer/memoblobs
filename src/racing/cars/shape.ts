// Shape parameters for the procedural car builder (stored in CarSpec.model).
import type { Pt } from "./body";
import type { RimStyle, TyreStyle } from "./wheels";

export type HeadStyle = "slim" | "round" | "twin" | "square" | "popup" | "bar" | "cat" | "bug" | "big" | "none";
export type TailStyle = "wrap" | "bar" | "round" | "block" | "vertical" | "slim" | "none";
export type GrilleStyle = "mesh" | "bars" | "slot" | "mouth" | "ev" | "truck" | "smile" | "none";
export type Spoiler = "none" | "lip" | "duck" | "wing" | "gt" | "roof" | "swan";
export type Exhaust = "single" | "dual" | "quad" | "center" | "side" | "stack" | "none";

export interface CarShape {
  len: number; wid: number; hgt: number;
  /** wheel radius / width, wheelbase (m), front axle offset from centre (+ = forward) */
  wheelR: number; wheelW: number; wheelbase: number; axleShift?: number;
  /**
   * side silhouette, x: -1 (rear) .. 1 (front), y: 0..1 of hgt — from the rear bumper's bottom corner, up and over
   * the roof, down to the front bumper's bottom corner. The builder lofts it and cuts the wheel arches.
   */
  profile: Pt[];
  /** glasshouse: side-window rear/front limits (rb, fb), roof panel rt..ft (x in -1..1), belt height (0..1) */
  glass: { rb: number; rt: number; ft: number; fb: number; belt: number; roof: number } | null;
  /** inward lean of the cabin sides (0..0.35) */
  tumble?: number;
  /** how round the nose/tail are in plan view (0..0.35) */
  round?: number; roundR?: number;
  spoiler?: Spoiler;
  rims?: RimStyle;
  /** class extras (see details.ts) */
  extras?: string[];
  /** bonnet/roof racing stripes colour ("accent" uses the accent paint) */
  stripe?: string | null;
  /** fender flare: extra width at the wheels (m) */
  flare?: number;

  /** builder family */
  kind?: "car" | "formula" | "kart" | "buggy" | "tractor";
  crown?: number; lift?: number; tuck?: number; noseW?: number; rTop?: number; shoulder?: number;
  /** extra fender bulge height over the wheels (m) */
  fender?: number;
  rearR?: number; rearW?: number; rimFrac?: number; rearRimFrac?: number;
  /** extra rear axle this far behind the rear axle (m) — semis, fire trucks */
  tandem?: number;
  dually?: boolean;
  camber?: number;
  rimColor?: string; tyre?: TyreStyle; caliper?: string;
  head?: HeadStyle; tail?: TailStyle; grille?: GrilleStyle;
  /** lamp centre heights (0..1 of hgt) when the automatic placement isn't right */
  lampY?: number; tailY?: number;
  doors?: 0 | 2 | 4 | 5;
  pillars?: number[]; dlo?: "chrome" | "black" | null; roof?: "paint" | "black" | "accent" | "glass"; pillarsBlack?: boolean;
  /** black lower cladding height (0..1 of hgt) */
  clad?: number;
  exhaust?: Exhaust;
  /** accent paint: "auto" (contrast with the body), "body", or a colour */
  accent?: string;
  /** liveries: stripes, side, rally, police, taxi, fire, flames, twotone, checker, number, bus */
  livery?: string[];
  number?: number;
  seat?: string; cage?: boolean;
  finish?: "gloss" | "matte" | "metal";
  plate?: boolean; mirrors?: boolean; handles?: "chrome" | "black" | "none"; skirt?: boolean;
  /** cargo box (box truck / ice-cream van / fire truck body) from x0..x1 (-1..1), top (0..1 of hgt) */
  box?: { x0: number; x1: number; top: number; color?: string; accent?: boolean };
  /** open pickup bed from x0..x1 (-1..1) */
  bed?: [number, number];
}
