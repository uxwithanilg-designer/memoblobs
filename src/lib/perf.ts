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


// ---------------------------------------------------------------- the shared mobile performance kit
// Every 3D game uses these instead of its own guesses, so phones (Android above all) stay smooth and cool:
// - a device tier, worked out once from the device's hints (and kept);
// - per-tier render settings: pixel ratio, anti-aliasing and shadows (phones get far less than desktops);
// - a frame cap: 90/120 Hz phone screens would otherwise make every game draw two frames for every one it needs;
// - "lite UI" on phones while a game runs: no CSS backdrop blur over the moving 3D picture (very costly on Android).

export type Quality = "low" | "medium" | "high";
export type Tier = "low" | "mid" | "high";

const nav = () => (typeof navigator === "undefined" ? null : (navigator as Navigator & { deviceMemory?: number }));
/** a touch-first phone or tablet */
export function isPhone() {
  if (typeof window === "undefined") return false;
  return !!window.matchMedia?.("(pointer: coarse)").matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}
export function isAndroid() { return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent); }

let tierCache: Tier | null = null;
/** how strong this device is: phones are "low" or "mid" (a flagship is still a phone that gets hot), computers "mid" or "high" */
export function deviceTier(): Tier {
  if (tierCache) return tierCache;
  const n = nav();
  if (!n) return "mid";
  const mem = n.deviceMemory ?? 4, cores = n.hardwareConcurrency ?? 4;
  tierCache = isPhone() ? (mem >= 6 && cores >= 8 ? "mid" : "low") : mem <= 4 || cores <= 4 ? "mid" : "high";
  return tierCache;
}
/** the "auto" quality for this device */
export function autoQuality(): Quality { const t = deviceTier(); return t === "low" ? "low" : t === "mid" ? "medium" : "high"; }
/** the render resolution (device pixels per CSS pixel) for a quality: phones top out at 1.5 */
export function pixelRatioFor(q: Quality) {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const want = isPhone() ? (q === "high" ? 1.5 : q === "medium" ? 1.25 : 1) : q === "high" ? 2 : q === "medium" ? 1.5 : 1;
  return Math.min(dpr, want);
}
/** anti-aliasing: only "high" on phones (the pixel ratio already smooths edges there) */
export function antialiasFor(q: Quality) { return isPhone() ? q === "high" : q !== "low"; }
/** real-time shadows: only "high" on phones */
export function shadowsFor(q: Quality) { return isPhone() ? q === "high" : q !== "low"; }

// ---------------------------------------------------------------- the frame cap
let capFps = 60, capInstalled = false, phase = -1e9, acceptedT = -1, frameAt = 0, seq = 1 << 24;
const live = new Map<number, number>();
/** cap every animation loop on the page (games, three.js, UI animations) to `fps` frames a second (0: no cap).
 *  On a 120 Hz phone screen this halves the work. Frames are let through on an even rhythm (a 90 Hz screen still gets
 *  ~60), and every callback of the same screen frame gets the same answer. */
export function installFrameCap(fps: number) {
  capFps = fps;
  if (capInstalled || typeof window === "undefined") return;
  capInstalled = true;
  const raw = window.requestAnimationFrame.bind(window), rawCancel = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = ++seq;
    const run = (t: number) => {
      if (capFps > 0 && t !== acceptedT) {
        const min = 1000 / capFps;
        if (t < phase + min - 2.5) { live.set(id, raw(run)); return; }
        phase = t - (phase + min) > min ? t : phase + min; // keep the rhythm; start again after a stall
        acceptedT = t; frameAt = t;
      }
      live.delete(id); cb(t);
    };
    live.set(id, raw(run));
    return id;
  };
  window.cancelAnimationFrame = (id: number) => { const r = live.get(id); if (r !== undefined) { rawCancel(r); live.delete(id); } else rawCancel(id); };
}
/** the time of the last frame let through (for the perf overlay) */
export const lastFrameAt = () => frameAt;

// ---------------------------------------------------------------- lite UI
/** phones while a game runs: no backdrop blur anywhere on the page (see globals.css `html.perf-lite`) */
export function setLiteUi(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("perf-lite", on && isPhone());
}
