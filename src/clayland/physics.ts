// Puddo's movement numbers, shared by the sim (the real thing) and the stage builder (so every gap it makes is one
// Puddo can really jump, with margin).

export const STEP = 1 / 120;
export const RUN = 7.4;          // top running speed (tiles/s)
export const ACC_GROUND = 62;
export const ACC_AIR = 34;
export const FRICTION = 52;
export const ICE_FRICTION = 5;
export const GRAV = 40;
export const FALL_MUL = 1.22;
export const JUMP_V = 16.2;      // ≈ 3.3 tiles high
export const JUMP_CUT = 0.45;
export const MAX_FALL = 24;
export const COYOTE = 0.1;
export const BUFFER = 0.13;
export const MOMO_W = 0.8;
export const MOMO_H = 1.15;
export const SQUEEZE_H = 0.62;
export const BOUNCE_V = 23;
export const STOMP_V = -26;

/** how far Puddo can jump (tiles, edge to edge) when landing dh tiles higher (+) or lower (−), running full speed */
export function reach(dh: number, grav = GRAV, run = RUN, jump = JUMP_V): number {
  let y = 0, vy = jump, t = 0, best = 0;
  for (let i = 0; i < 600; i++) {
    const g = vy > 0 ? grav : grav * FALL_MUL;
    vy = Math.max(-MAX_FALL, vy - g * STEP); y += vy * STEP; t += STEP;
    if (vy < 0 && y <= dh) { best = t; break; }
    if (vy < 0 && y < dh - 0.01 && y < -20) break;
  }
  if (!best) return 0;
  return Math.max(0, run * best - MOMO_W * 0.4);
}

/** highest ledge Puddo can land on */
export const maxRise = (grav = GRAV, jump = JUMP_V) => (jump * jump) / (2 * grav) - 0.25;
