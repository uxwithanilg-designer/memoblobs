// Loads game files ahead of time so a game never waits on the network while it is being played.
//
//  - NOW   files the screen needs right away (the game's menu sounds, its first music): full speed, tracked by the
//          loading screen, which stays up until they're in.
//  - NEXT  files the next level needs (its music, the sounds it adds): loaded as soon as a slot is free.
//  - LATER the rest of the game, in the background, one or two at a time, only while the tab is visible, never on
//          Save-Data / 2G connections, and paused while NOW/NEXT files are loading.
//
// Downloaded bytes are kept in a small in-memory store (and the browser cache keeps them too: R2 URLs are versioned
// and cached for a year), so starting a level only has to decode, never download.
import { cdn } from "./cdn";

export const NOW = 0, NEXT = 1, LATER = 2;
export type Priority = typeof NOW | typeof NEXT | typeof LATER;

type Conn = { saveData?: boolean; effectiveType?: string; addEventListener?: (t: string, f: () => void) => void };
type Job = { path: string; pri: Priority; done: Promise<ArrayBuffer | null>; resolve: (b: ArrayBuffer | null) => void; started: boolean };

const conn = (): Conn | undefined => (typeof navigator !== "undefined" ? (navigator as Navigator & { connection?: Conn }).connection : undefined);
/** phones with little memory keep fewer files around */
export const lowMemory = () => typeof navigator !== "undefined" && ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
/** Save-Data on, or a 2G connection: don't fetch anything that isn't needed soon */
export const thinNetwork = () => { const c = conn(); return Boolean(c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? "")); };

/**
 * Fetch a game file (from R2 in production). If R2 fails or doesn't answer in time (r2.dev is rate-limited), it waits
 * a moment and asks once more, so a game never hangs on one file.
 */
export async function fetchAsset(path: string, pri: Priority = NOW): Promise<ArrayBuffer | null> {
  const url = cdn(path);
  const tries = url === path ? 1 : 2;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1200));
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    // no answer at all after a while: give up on this try (a slow but flowing download is left alone)
    const timer = ac && i < tries - 1 ? setTimeout(() => ac.abort(), pri === LATER ? 20000 : 8000) : undefined;
    try {
      const init: RequestInit & { priority?: "high" | "low" | "auto" } = { priority: pri === LATER ? "low" : pri === NOW ? "high" : "auto", signal: ac?.signal };
      const r = await fetch(i ? `${url}${url.includes("?") ? "&" : "?"}retry=1` : url, init);
      clearTimeout(timer);
      if (r.ok) return await r.arrayBuffer();
    } catch { /* offline, blocked or timed out: try again */ }
    clearTimeout(timer);
  }
  return null;
}

class Preloader {
  private jobs = new Map<string, Job>();
  private queue: Job[] = [];
  private active = { urgent: 0, later: 0 };
  /** downloaded but not yet used bytes, oldest first */
  private bytes = new Map<string, ArrayBuffer>();
  private heldBytes = 0;
  private listeners = new Set<() => void>();
  /** NOW files: loaded / asked (for the loading screen) */
  readonly now = { asked: 0, loaded: 0 };

  private get budget() { return (lowMemory() ? 12 : 32) * 1024 * 1024; }

  constructor() {
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => this.pump());
    conn()?.addEventListener?.("change", () => this.pump());
  }

  /** ask for a file; resolves when it's downloaded (null if it couldn't be, or LATER was skipped) */
  want(path: string, pri: Priority): Promise<ArrayBuffer | null> {
    const have = this.bytes.get(path);
    if (have) return Promise.resolve(have);
    const p = this.request(path, pri);
    if (pri === NOW) {
      // the loading screen waits for every NOW file, even one that was already coming in the background
      this.now.asked++; this.emit();
      void p.then(() => { this.now.loaded++; this.emit(); });
    }
    return p;
  }

  private request(path: string, pri: Priority): Promise<ArrayBuffer | null> {
    const j = this.jobs.get(path);
    if (j) {
      if (pri < j.pri && !j.started) { j.pri = pri; this.sort(); this.pump(); }
      return j.done;
    }
    let resolve!: (b: ArrayBuffer | null) => void;
    const done = new Promise<ArrayBuffer | null>((r) => { resolve = r; });
    const job: Job = { path, pri, done, resolve, started: false };
    this.jobs.set(path, job);
    this.queue.push(job);
    this.sort();
    this.pump();
    return done;
  }

  /** take the bytes of a file for decoding (they leave the store: decoding takes ownership of them) */
  take(path: string): ArrayBuffer | null {
    const b = this.bytes.get(path);
    if (!b) return null;
    this.bytes.delete(path); this.heldBytes -= b.byteLength;
    return b;
  }

  has(path: string) { return this.bytes.has(path) || this.jobs.has(path); }

  private holdLater = false;
  /** hold LATER downloads (while a game's own files load), then let them go */
  holdBackground(on: boolean) { this.holdLater = on; if (!on) this.pump(); }

  /** NOW files still loading */
  get pending() { return this.now.asked - this.now.loaded; }
  subscribe(f: () => void) { this.listeners.add(f); return () => { this.listeners.delete(f); }; }
  private emit() { for (const f of this.listeners) f(); }

  private sort() { this.queue.sort((a, b) => a.pri - b.pri); }

  private pump() {
    while (this.queue.length) {
      const j = this.queue[0];
      if (j.pri === LATER) {
        // background files: one or two at a time, only when nothing urgent is loading and someone is looking
        const room = (lowMemory() ? 1 : 2) - this.active.later;
        if (this.holdLater || this.active.urgent > 0 || room <= 0) return;
        if (typeof document !== "undefined" && document.hidden) return;
        if (thinNetwork()) { this.queue.shift(); this.finish(j, null); continue; }
      } else if (this.active.urgent >= 10) return; // r2.dev answers in ~0.5–1 s: keep several requests in flight
      this.queue.shift();
      this.start(j);
    }
  }

  private start(j: Job) {
    j.started = true;
    const lane = j.pri === LATER ? "later" : "urgent";
    this.active[lane]++;
    void fetchAsset(j.path, j.pri).then((b) => {
      this.active[lane]--;
      if (b) this.keep(j.path, b);
      this.finish(j, b);
      this.pump();
    });
  }

  private finish(j: Job, b: ArrayBuffer | null) {
    this.jobs.delete(j.path);
    j.resolve(b);
  }

  private keep(path: string, b: ArrayBuffer) {
    this.bytes.set(path, b); this.heldBytes += b.byteLength;
    // over budget: drop the oldest (the browser cache still has them, so a later load is quick)
    for (const [k, v] of this.bytes) {
      if (this.heldBytes <= this.budget || k === path) break;
      this.bytes.delete(k); this.heldBytes -= v.byteLength;
    }
  }
}

export const preloader = new Preloader();

/** run f when the browser is idle (or after `max` ms) */
export function whenIdle(f: () => void, max = 1500) {
  if (typeof window === "undefined") return;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(f, { timeout: max }); else setTimeout(f, Math.min(max, 200));
}
