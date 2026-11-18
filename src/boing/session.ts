// A running Momo Boing! climb: the Sim, the renderer, the rAF loop, drag/tap/keyboard input, the bounce song and sound
// effects, and DOM bits anchored to the world (floating words, the chain pill, "!" warnings for falling things).
// The React HUD polls `hud()` a few times a second.
import { audio, type Sound } from "@/lib/audio";
import { CARDS, FRIENDS, HALF } from "./levels";
import { BoingRenderer, type BoingLook, type Quality } from "./render";
import { Sim } from "./sim";
import type { CardId, FriendId, SimEvent, SimResult, StageSpec } from "./types";

export interface HudState {
  height: number; top: number; coins: number; notes: number; perfects: number; chain: number; comets: number; stomps: number;
  friends: number; stack: FriendId[]; bumps: number; t: number; phase: Sim["phase"]; goo: number; cometNeed: number; comet: boolean;
  cards: CardId[]; choosing: CardId[] | null; shields: number;
}
export interface Toast { text: string; tone: "good" | "bad" | "gold" | "info"; big?: boolean }
export interface SessionOptions {
  quality: Quality;
  sensitivity?: number;
  /** title-screen demo: the bot bounces, no sound */
  attract?: boolean;
  vibrate?: boolean;
  /** the result, plus Momo's path (x, y every 0.1 s) for the ghost race */
  onEnd?: (r: SimResult, path: number[]) => void;
  onToast?: (t: Toast) => void;
  onEvent?: (e: SimEvent) => void;
  look?: BoingLook;
  /** a ghost to race: your best try at this stage */
  ghost?: number[];
}


export class BoingSession {
  sim: Sim;
  r: BoingRenderer;
  private host: HTMLElement;
  private overlay: HTMLDivElement;
  private chainEl: HTMLDivElement;
  private warnEls = new Map<number, HTMLDivElement>();
  private floaters: { el: HTMLDivElement; x: number; y: number; t: number }[] = [];
  private raf = 0; private last = 0;
  private paused = false; private ended = false; private endT = -1;
  private o: SessionOptions;
  private ro: ResizeObserver;
  private drag: { id: number; x0: number; tx0: number } | null = null;
  private keys = { l: false, r: false };
  private snd: Record<string, number> = {};
  private noteI = 0;
  private voice: Sound; private tune: number[];
  private path: number[] = []; private recT = 0;
  autopilot = false;

  constructor(host: HTMLElement, spec: StageSpec, o: SessionOptions) {
    this.host = host; this.o = o;
    this.sim = new Sim(spec, { bot: !!o.attract, skill: 0.85 });
    // the goo waits while the stage card is up, until the first touch (or about three seconds)
    if (!o.attract) this.sim.gooPause = 3;
    this.r = new BoingRenderer(host, this.sim, o.quality, o.look, o.ghost);
    this.voice = `a:boing_${spec.voice}` as Sound; this.tune = spec.tune;
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden" });
    host.appendChild(this.overlay);
    this.chainEl = document.createElement("div");
    this.chainEl.className = "mb-chain";
    this.overlay.appendChild(this.chainEl);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    if (!o.attract) {
      const c = this.r.renderer.domElement;
      c.addEventListener("pointerdown", this.onDown);
      window.addEventListener("pointermove", this.onMove);
      window.addEventListener("pointerup", this.onUp);
      window.addEventListener("pointercancel", this.onUp);
      window.addEventListener("keydown", this.onKey);
      window.addEventListener("keyup", this.onKey);
      void audio.preload([this.voice, "a:boing_perfect", "a:coin", "a:bubble", "a:bonk", "a:crunch", "a:rocket", "a:twinkle", "a:slideUp", "boing", "pop", "a:splat", "a:whooshIn", "a:whooshOut", "a:levelup", "a:blip", "tada", "a:cheer", "sadtrombone", "squish", "a:squelch", "a:poof"]);
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private resize() {
    const b = this.host.getBoundingClientRect();
    this.r.resize(b.width, b.height);
  }

  // ---------------------------------------------------------------- input: drag anywhere to steer, every touch is a tap
  private pxPerUnit() {
    const y = this.sim.y;
    const [a] = this.r.screen(-HALF, y), [b] = this.r.screen(HALF, y);
    return Math.max(1, (b - a) / (HALF * 2));
  }
  private onDown = (e: PointerEvent) => {
    void audio.resume?.();
    if (this.paused) return;
    this.wake();
    this.sim.tap();
    if (!this.drag) this.drag = { id: e.pointerId, x0: e.clientX, tx0: this.sim.tx };
  };
  private onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id || this.paused) return;
    const k = ((this.o.sensitivity ?? 1) * 1.35) / this.pxPerUnit();
    this.sim.tx = d.tx0 + (e.clientX - d.x0) * k;
  };
  /** the first touch lets the goo start (it waits while the stage card is up) */
  private wake() { if (this.sim.t < 3 && this.sim.gooPause > 0.5) this.sim.gooPause = 0.5; }
  private onUp = (e: PointerEvent) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };
  private onKey = (e: KeyboardEvent) => {
    const on = e.type === "keydown";
    if (on && !this.paused) this.wake();
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { this.keys.l = on; e.preventDefault(); }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { this.keys.r = on; e.preventDefault(); }
    if (on && !e.repeat && (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W")) { e.preventDefault(); if (!this.paused) this.sim.tap(); }
  };

  // ---------------------------------------------------------------- loop
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    if (this.paused) { this.r.render(); return; }
    if (this.keys.l || this.keys.r) this.sim.tx += (this.keys.r ? 1 : -1) * 9.5 * dt;
    if (this.autopilot) this.sim.bot = true;
    // title demo: start over near the top (or after a tumble)
    if (this.o.attract && (this.sim.phase !== "play" || this.sim.y > this.sim.spec.top - 30)) this.restartAttract();
    // small physics steps keep landings exact on slow phones
    const n = dt > 0.021 ? 2 : 1;
    for (let i = 0; i < n; i++) this.sim.step(dt / n);
    const ev = this.sim.events.splice(0);
    this.r.update(dt, ev);
    this.record();
    if (!this.o.attract) this.sounds(ev);
    this.handle(ev);
    this.labels(dt);
    this.r.render();
    if (this.ended && this.endT >= 0) {
      this.endT -= dt;
      if (this.endT < 0) { this.endT = -1; this.o.onEnd?.(this.sim.result(), this.path); }
    }
  };

  private restartAttract() {
    const spec = this.sim.spec;
    this.r.dispose();
    this.sim = new Sim(spec, { bot: true, skill: 0.85 });
    this.r = new BoingRenderer(this.host, this.sim, this.o.quality);
    this.host.insertBefore(this.r.renderer.domElement, this.overlay);
    this.resize();
  }

  private handle(ev: SimEvent[]) {
    for (const e of ev) {
      if (e.t === "end") { this.ended = true; this.endT = e.won ? 1.7 : 1.1; this.vibe(e.won ? [30, 40, 70] : 260); }
      else if (e.t === "perfect") { this.floater(e.chain >= 2 ? `PERFECT ×${e.chain}` : "PERFECT!", e.x, e.y + 1.6, "gold"); this.vibe(12); }
      else if (e.t === "comet" && e.on) { this.o.onToast?.({ text: "☄️ COMET!", tone: "gold", big: true }); this.vibe([20, 30, 50]); }
      else if (e.t === "friendJoin") this.o.onToast?.({ text: `🫧 ${FRIENDS[e.id].name} joined! ${FRIENDS[e.id].power}`, tone: "good" });
      else if (e.t === "friendSave") { this.o.onToast?.({ text: `${FRIENDS[e.id].name} saved you!`, tone: "gold", big: true }); this.vibe([40, 30, 40]); }
      else if (e.t === "card") { this.o.onToast?.({ text: `${CARDS[e.id].icon} ${CARDS[e.id].name}!`, tone: "gold", big: true }); this.vibe([20, 20]); }
      else if (e.t === "cannon") { this.floater("BOOM!", e.x, e.y + 2, "gold"); this.vibe(50); }
      else if (e.t === "cake") { this.o.onToast?.({ text: "🎂 CAKE BOMB!", tone: "gold", big: true }); this.vibe([30, 30, 60]); }
      else if (e.t === "snip") this.floater("SNIP!", e.x, e.y + 1, "good");
      else if (e.t === "double") this.floater("DOUBLE BOING!", e.x, e.y + 1.4, "good");
      else if (e.t === "hit") { this.vibe(e.by === "enemy" || e.by === "drop" ? 60 : 120); if (e.by === "enemy" || e.by === "drop") this.floater("BONK!", e.x, e.y + 1.4, "bad"); }
      else if (e.t === "stomp") this.floater("POP!", e.x, e.y + 1.2, "good");
      else if (e.t === "safe") this.o.onToast?.({ text: "☁️ SAFE CLOUD! The goo stops", tone: "info", big: true });
      else if (e.t === "spring") this.floater("BOING!", e.x, e.y + 1.2, "good");
      if (!this.o.attract) this.o.onEvent?.(e);
    }
  }

  private vibe(p: number | number[]) {
    if (!this.o.vibrate || this.o.attract || typeof navigator === "undefined" || !navigator.vibrate) return;
    try { navigator.vibrate(p); } catch { /* not allowed */ }
  }

  // ---------------------------------------------------------------- sound: the bounces play the song
  private play(name: Sound, gain: number, rate = 1, gap = 0, delay = 0) {
    const now = performance.now();
    if (gap && now - (this.snd[name] ?? 0) < gap) return;
    this.snd[name] = now;
    audio.play(name, { gain, rate, duck: false, delay });
  }
  private note(gain = 0.55, up = 0, chain = 0) {
    const m = this.tune[this.noteI++ % this.tune.length] + up, rate = 2 ** ((m - 72) / 12);
    audio.play(this.voice, { gain, rate, duck: false, reverb: 0.25, pan: Math.max(-0.6, Math.min(0.6, this.sim.x / HALF * 0.5)) });
    // a perfect chain adds octaves around the tune
    if (chain >= 2) audio.play(this.voice, { gain: gain * 0.35, rate: rate * 2, duck: false, delay: 0.012 });
    if (chain >= 4) audio.play(this.voice, { gain: gain * 0.3, rate: rate / 2, duck: false, delay: 0.02 });
  }
  private sounds(ev: SimEvent[]) {
    for (const e of ev) {
      switch (e.t) {
        case "land":
          if (e.kind === "finish") break;
          this.note(e.perfect ? 0.62 : 0.5, 0, e.chain);
          this.play("squish", 0.08, 1.4 + Math.random() * 0.3, 60);
          break;
        case "perfect": this.play("a:boing_perfect", 0.28 + Math.min(0.2, e.chain * 0.03), 1 + Math.min(0.3, e.chain * 0.04)); break;
        case "stomp": this.note(0.5); this.play("pop", 0.55, 0.9 + Math.random() * 0.3); this.play("a:poof", 0.3); break;
        case "spring": this.play("boing", 0.45, 1.25); this.play("a:slideUp", 0.25, 1.3); break;
        case "gum": this.note(0.5); this.play("a:squelch", 0.4, 1.2); this.play("a:slideUp", 0.3, 1.1); break;
        case "coin": this.play("a:coin", 0.32, 0.95 + Math.random() * 0.15, 30); break;
        case "note": this.note(0.55, 12); this.play("a:twinkle", 0.35); break;
        case "friendJoin": this.play("a:bubble", 0.6, 1.1); audio.play(`v:${e.id}_happy` as Sound, { gain: 0.75, delay: 0.12, duck: false }); break;
        case "friendSave": this.play("a:whooshIn", 0.5); audio.play(`v:${e.id}_wow` as Sound, { gain: 0.8, duck: false }); break;
        case "hit": this.play(e.by === "goo" ? "a:splat" : e.by === "fall" ? "a:whooshOut" : "a:bonk", 0.6); break;
        case "crumble": this.play("a:crunch", 0.35, 1.1, 80); break;
        case "comet": if (e.on) { this.play("a:rocket", 0.55); this.play("a:boing_perfect", 0.4, 1.3); } break;
        case "warn": this.play("a:blip", 0.3, e.up ? 0.55 : 0.7, 200); break;
        case "cannon": this.play("impact", 0.6, 0.8); this.play("a:rocket", 0.45, 1.2); this.note(0.5); break;
        case "vine": this.play("a:slideUp", 0.35, 0.9); break;
        case "lift": this.play(this.sim.spec.theme === "lava" ? "a:sizzle" : "a:splash", 0.45, 1.1, 250); break;
        case "cake": this.play("a:splat", 0.6, 0.9); this.play("confetti", 0.5); break;
        case "snip": this.play("clack", 0.5, 1.2); this.play("pop", 0.4); break;
        case "double": this.play("boing", 0.4, 1.5); break;
        case "cards": this.play("a:ding", 0.5, 1.2); break;
        case "card": this.play("a:levelup", 0.5); break;
        case "throw": this.play("a:whooshIn", 0.3, 1.3, 200); break;
        case "safe": this.play("a:levelup", 0.5); break;
        case "end": if (e.won) { this.play("tada", 0.7); this.play("a:cheer", 0.45, 1, 0, 0.3); } else this.play("sadtrombone", 0.55); break;
        default: break;
      }
    }
  }

  // ---------------------------------------------------------------- world-anchored DOM bits
  private floater(text: string, x: number, y: number, tone: "good" | "bad" | "gold") {
    if (this.o.attract) return;
    const el = document.createElement("div");
    el.className = `mb-float mb-${tone}`; el.textContent = text;
    this.overlay.appendChild(el);
    this.floaters.push({ el, x, y, t: 0 });
  }
  private labels(dt: number) {
    const s = this.sim;
    // the chain pill sits above the friend tower
    if (s.chain >= 2 && s.cometT <= 0 && !this.o.attract) {
      const [x, y] = this.r.screen(s.x, s.y + 1.45 + s.stack.length * 0.53);
      this.chainEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      const left = s.cometNeed - s.chain;
      const t = left > 0 ? `×${s.chain} · ${left} to ☄️` : `×${s.chain}`;
      if (this.chainEl.textContent !== t) this.chainEl.textContent = t;
      this.chainEl.style.opacity = "1";
    } else this.chainEl.style.opacity = "0";
    // "!" where something is about to fall
    const seen = new Set<number>();
    for (const d of s.drops) {
      if (d.falling) continue;
      seen.add(d.id);
      let el = this.warnEls.get(d.id);
      if (!el) { el = document.createElement("div"); el.className = "mb-warn"; el.textContent = "!"; this.overlay.appendChild(el); this.warnEls.set(d.id, el); }
      const [x] = this.r.screen(d.x, s.floor + (d.up ? 1 : 12));
      el.classList.toggle("mb-warn-up", d.up);
      el.style.transform = `translate(${Math.max(26, Math.min(this.host.clientWidth - 26, x))}px, 0) translate(-50%, 0)`;
    }
    for (const [id, el] of this.warnEls) if (!seen.has(id)) { el.remove(); this.warnEls.delete(id); }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 0.85) { f.el.remove(); this.floaters.splice(i, 1); continue; }
      const [x0, y] = this.r.screen(f.x, f.y + f.t * 1.6);
      const x = Math.max(60, Math.min(this.host.clientWidth - 60, x0));
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${0.8 + Math.min(0.35, f.t * 2)})`;
      f.el.style.opacity = String(1 - Math.max(0, f.t - 0.5) / 0.35);
    }
  }

  // ---------------------------------------------------------------- API for the React layer and QA
  hud(): HudState {
    const s = this.sim, st = s.stats;
    return {
      height: Math.max(0, s.maxY), top: s.spec.top, coins: st.coins, notes: st.notes, perfects: st.perfects, chain: s.chain, comets: st.comets, stomps: st.stomps,
      friends: st.friends, stack: [...s.stack], bumps: st.bumps, t: s.t, phase: s.phase, goo: s.y - s.gooY, cometNeed: s.cometNeed, comet: s.cometT > 0,
      cards: [...s.cards], choosing: s.choosing ? [...s.choosing] : null, shields: s.shields,
    };
  }
  /** a power card from the Safe Cloud picker */
  pickCard(id: CardId) { this.sim.pickCard(id); this.last = performance.now();
  }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.last = performance.now(); }
  get isPaused() { return this.paused; }
  /** dev/QA: run the simulation forward (with the bot when autopilot is on) */
  debugAdvance(sec: number) {
    const dt = 1 / 60;
    this.sim.bot = this.autopilot || this.sim.bot;
    for (let t = 0; t < sec && this.sim.phase === "play"; t += dt) {
      this.sim.step(dt);
      const ev = this.sim.events.splice(0);
      this.handle(ev);
      this.r.update(dt, ev);
      this.record();
    }
  }
  /** the ghost race: remember where Momo was every 0.1 s */
  private record() {
    while (this.recT <= this.sim.t && this.path.length < 12000) { this.path.push(Math.round(this.sim.x * 100) / 100, Math.round(this.sim.y * 100) / 100); this.recT += 0.1; }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const c = this.r.renderer.domElement;
    c.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    this.r.dispose();
    this.overlay.remove();
  }
}

export const BOING_CSS = `
.mb-float{position:absolute;left:0;top:0;font-family:var(--font-display),system-ui;font-size:26px;white-space:nowrap;-webkit-text-stroke:6px rgba(30,15,70,.85);paint-order:stroke fill;will-change:transform,opacity}
.mb-good{color:#7CFFB2}.mb-bad{color:#FF6B8A}.mb-gold{color:#FFD23F}
.mb-chain{position:absolute;left:0;top:0;padding:1px 10px 2px;border-radius:999px;background:#FFD23F;color:#5A3A00;font-family:var(--font-display),system-ui;font-size:15px;white-space:nowrap;box-shadow:0 3px 0 rgba(90,58,0,.35);transition:opacity .2s;will-change:transform}
.mb-warn-up{top:auto!important;bottom:calc(var(--safe-bottom,0px) + 28px);background:#FF7A1F!important}
.mb-warn{position:absolute;left:0;top:calc(var(--safe-top,0px) + 92px);width:42px;height:42px;border-radius:999px;display:grid;place-items:center;background:#FF4D6D;color:#fff;font-family:var(--font-display),system-ui;font-size:28px;box-shadow:0 0 0 4px #fff,0 4px 0 rgba(0,0,0,.25);animation:mb-warn .32s ease-in-out infinite alternate}
@keyframes mb-warn{from{scale:.9}to{scale:1.12}}
`;
