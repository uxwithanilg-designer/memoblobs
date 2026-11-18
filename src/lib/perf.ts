// Keeps the 3D games smooth on every device. A FrameGovernor watches the real frame rate; when a device can't keep
// up (an older laptop, a budget phone, a phone getting warm) it lowers the render resolution a step, and it keeps
// that step only if the game actually got faster (a screen capped at 30 Hz isn't helped, so it goes back). When there
// is room again it slowly raises the resolution back up.

const SLOW = 50, FAST = 58;

export class FrameGovernor {
  /** current resolution scale (1 = the quality setting's full resolution) */
  scale = 1;
  private raf = 0; private last = 0; private acc = 0; private frames = 0;
  private slow = 0; private fast = 0;
  /** a step down being tried: the fps before it, the scale to go back to, windows waited */
  private trial: { before: number; prev: number; wait: number } | null = null;
  /** don't try going below this again for a while (a step that didn't help) */
  private floor = 0; private floorUntil = 0;

  constructor(private apply: (scale: number) => void, private min = 0.55) {
    if (typeof window === "undefined") return;
    const loop = (now: number) => { this.tick(now); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  private set(s: number) {
    s = Math.round(s * 100) / 100;
    if (s === this.scale) return;
    this.scale = s;
    this.apply(s);
  }

  private tick(now: number) {
    const dt = this.last ? now - this.last : 0;
    this.last = now;
    if (dt <= 0 || dt > 250) return; // first frame, or the tab was hidden / the game paused
    this.acc += dt; this.frames++;
    if (this.acc < 1000) return;
    const fps = (this.frames * 1000) / this.acc;
    this.acc = 0; this.frames = 0;

    if (this.trial) {
      if (--this.trial.wait > 0) return;
      const t = this.trial; this.trial = null;
      // the lower resolution didn't buy at least 8%: the limit is elsewhere (CPU, a 30 Hz screen) → go back
      if (fps < t.before * 1.08) { this.floor = t.prev; this.floorUntil = now + 30000; this.set(t.prev); }
      this.slow = this.fast = 0;
      return;
    }
    if (fps < SLOW) { this.slow++; this.fast = 0; } else if (fps > FAST) { this.fast++; this.slow = 0; } else { this.slow = 0; this.fast = 0; }

    const floor = now < this.floorUntil ? this.floor : this.min;
    if (this.slow >= 2 && this.scale > floor + 0.01) {
      const next = Math.max(floor, this.min, this.scale * (fps < 35 ? 0.8 : 0.88));
      this.trial = { before: fps, prev: this.scale, wait: 2 };
      this.slow = 0;
      this.set(next);
    } else if (this.fast >= 6 && this.scale < 1) {
      this.fast = 0;
      this.set(Math.min(1, this.scale * 1.1));
    }
  }

  dispose() { cancelAnimationFrame(this.raf); }
}

