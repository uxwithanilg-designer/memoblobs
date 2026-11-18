// Hazard motion + collision for the 7 archetypes, shared by the level generator (to prove a safe line exists), the
// simulation and the renderer — so what you see is exactly what can hit you. Every motion is a pure function of the
// beat. `by` everywhere = the ball's height above the floor of the hazard's row.
import type { Hazard } from "./types";

export const BALL_R = 0.34;

const frac = (v: number) => v - Math.floor(v);
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- mallet: pendulum hanging from a cloud
export const MALLET_PIVOT_Y = 9.1;
export const MALLET_LEN = 8.6;
export const MALLET_HEAD_R = 0.5;
export const MALLET_HEAD_HALF = 0.46;

export function malletAngle(h: Hazard, beat: number) {
  const amp = Math.asin(Math.min(0.42, h.size / MALLET_LEN));
  return amp * Math.sin(TAU * (beat / h.period + h.phase));
}
export function malletHead(h: Hazard, beat: number, out: { x: number; y: number }) {
  const a = malletAngle(h, beat);
  out.x = h.x + MALLET_LEN * Math.sin(a);
  out.y = MALLET_PIVOT_Y - MALLET_LEN * Math.cos(a);
  return out;
}

// ---------------------------------------------------------------- daisy: flat spinner, 1–4 arms
export const DAISY_CORE_R = 0.52;
export const DAISY_ARM_R = 0.2;
export const DAISY_ARM_TOP = 0.5;
export function daisyAngle(h: Hazard, beat: number) { return h.dir * TAU * (beat / h.period + h.phase); }

// ---------------------------------------------------------------- claw: drops from the sky
export const CLAW_WARN = 2;
export const CLAW_DOWN = 0.75;
/** the slam beat that matters at `beat` (one-shot claws have `slam`; periodic ones slam every period) */
export function clawSlamNear(h: Hazard, beat: number) {
  if (h.slam !== undefined) return h.slam;
  const p = Math.max(1, h.period), off = h.phase * p;
  return Math.round((beat - off - CLAW_DOWN / 2) / p) * p + off;
}
/** 0 = resting on the ground … 1 = up in the sky */
export function clawLift(h: Hazard, beat: number) {
  const t = beat - clawSlamNear(h, beat);
  if (t < -0.35) return 1;
  if (t < 0) return Math.max(0, -t / 0.35) ** 2;
  if (t < CLAW_DOWN) return 0;
  return Math.min(1, (t - CLAW_DOWN) / 0.6);
}

// ---------------------------------------------------------------- slider: crosses the lanes
export function sliderX(h: Hazard, beat: number) {
  const p = frac(beat / h.period + h.phase);
  switch (h.mode ?? "swing") {
    case "static": return h.x;
    case "saw": return h.x - h.size * h.dir + 2 * h.size * h.dir * p;
    case "hop": {
      // hops between x − size and x + size on the beat, with a quick bounce
      const half = p < 0.5 ? -1 : 1;
      const k = p < 0.5 ? p * 2 : (p - 0.5) * 2;
      const from = -half, t = Math.min(1, k / 0.3);
      const e = t * t * (3 - 2 * t);
      return h.x + h.size * (from + (half - from) * e);
    }
    default: return h.x + h.size * Math.sin(TAU * p);
  }
}
/** hop height (for the gloop-style hoppers) */
export function sliderHop(h: Hazard, beat: number) {
  if (h.mode !== "hop") return 0;
  const p = frac((beat / h.period + h.phase) * 2);
  return p < 0.3 ? Math.sin((p / 0.3) * Math.PI) * 0.6 : 0;
}

// ---------------------------------------------------------------- roller: rolls down a lane towards Momo
/** `slam` = the beat it reaches row h.s; `speed` rows per beat */
export function rollerS(h: Hazard, beat: number) { return h.s + (h.speed ?? 2) * ((h.slam ?? 0) - beat); }
export const ROLLER_R = 0.45;

// ---------------------------------------------------------------- popper: pops out of the floor on a cycle
export function popperUp(h: Hazard, beat: number) {
  const p = frac(beat / h.period + h.phase);
  const d = h.duty ?? 0.45;
  if (p > d) return 0;
  const edge = Math.min(p, d - p) / 0.08;
  return Math.min(1, edge);
}

// ---------------------------------------------------------------- laser / doors: on/off across lanes
export function laserOn(h: Hazard, beat: number) {
  const p = frac(beat / h.period + h.phase);
  const d = h.duty ?? 0.5;
  if (p > d) return 0;
  return Math.min(1, Math.min(p, d - p) / 0.04);
}

// ---------------------------------------------------------------- collision
const head = { x: 0, y: 0 };
function segDist(px: number, ps: number, ax: number, as: number, bx: number, bs: number) {
  const vx = bx - ax, vs = bs - as, wx = px - ax, ws = ps - as;
  const l2 = vx * vx + vs * vs;
  const t = l2 > 0 ? Math.max(0, Math.min(1, (wx * vx + ws * vs) / l2)) : 0;
  const dx = px - (ax + vx * t), ds = ps - (as + vs * t);
  return Math.sqrt(dx * dx + ds * ds);
}

/**
 * Does hazard `h` touch a ball at lane `bx`, row `bs`, `by` above the floor at `beat`? `r` = ball radius
 * (Tiny / Giant Momo). `slack` shrinks the hit shapes a little (players get the benefit of the doubt; the solver uses 0).
 */
export function hazardHits(h: Hazard, beat: number, bx: number, bs: number, by: number, slack = 0.08, r = BALL_R): boolean {
  const ds = bs - h.s;
  switch (h.kind) {
    case "mallet": {
      if (Math.abs(ds) > MALLET_HEAD_HALF + r - slack) return false;
      malletHead(h, beat, head);
      const dx = bx - head.x, dy = r + by - head.y;
      return dx * dx + dy * dy < (MALLET_HEAD_R + r - slack) ** 2;
    }
    case "daisy": {
      if (Math.abs(ds) > h.size + r || Math.abs(bx - h.x) > h.size + r) return false;
      if (by > DAISY_ARM_TOP - 0.05) return false;
      const dx = bx - h.x;
      if (Math.sqrt(dx * dx + ds * ds) < DAISY_CORE_R + r - slack) return true;
      const a = daisyAngle(h, beat), n = h.arms ?? 4;
      for (let k = 0; k < n; k++) {
        const c = Math.cos(a + (k * TAU) / n), sn = Math.sin(a + (k * TAU) / n);
        if (segDist(bx, bs, h.x + c * DAISY_CORE_R, h.s + sn * DAISY_CORE_R, h.x + c * h.size, h.s + sn * h.size) < DAISY_ARM_R + r - slack) return true;
      }
      return false;
    }
    case "claw": {
      if (Math.abs(ds) > 0.55 + r - slack) return false;
      if (clawLift(h, beat) > 0.25 || by > 0.6) return false;
      return Math.abs(bx - h.x) < h.size + 0.5 + r * 0.5 - slack;
    }
    case "slider": {
      if (Math.abs(ds) > 0.42 + r - slack) return false;
      if (by > 0.95 + sliderHop(h, beat)) return false;
      return Math.abs(bx - sliderX(h, beat)) < (h.w ?? 1) / 2 + r * 0.85 - slack;
    }
    case "roller": {
      const rs = rollerS(h, beat);
      if (Math.abs(bs - rs) > ROLLER_R + r - slack || by > ROLLER_R * 2) return false;
      return Math.abs(bx - h.x) < ROLLER_R + r - slack;
    }
    case "popper": {
      if (Math.abs(ds) > 0.42 + r - slack || by > 1.05) return false;
      if (popperUp(h, beat) < 0.55) return false;
      return Math.abs(bx - h.x) < (h.w ?? 1) / 2 + r * 0.8 - slack;
    }
    case "laser": {
      if (Math.abs(ds) > 0.12 + r - slack || by > 0.7) return false;
      if (laserOn(h, beat) < 0.5) return false;
      return Math.abs(bx - h.x) < h.size + 0.5;
    }
  }
}

/** how far (rows) a hazard can reach from h.s at any time — for culling and the solver */
export function hazardReach(h: Hazard) {
  switch (h.kind) {
    case "daisy": return h.size + 0.6;
    // a roller only ever meets the ball around h.s (it arrives there exactly at its `slam` beat)
    case "roller": return 2;
    default: return 0.9;
  }
}
