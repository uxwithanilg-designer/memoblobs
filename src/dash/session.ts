// A Momo Dash! run: the Sim, the renderer, the rAF loop, swipe / keyboard input (double-tap rides a Jelly Board), the
// 3-2-1-GO countdown, the white flash at each new world, sound effects (coins play the song), and DOM bits anchored to
// Momo (trick pop-ups like "+150 JUMP OVER"). The React HUD polls `hud()` a few times a second.
import { audio, type Sound } from "@/lib/audio";
import { FRIENDS, LW, MORPHS, POWERS, sectionOf } from "./levels";
import { DashRenderer, type DashLook, type Quality } from "./render";
import { MAX_LIVES, Sim, TRICK_TEXT, boostTime, type SimOpts } from "./sim";
import type { FriendId, MorphId, PowerId, RunSpec, Section, SimEvent, SimResult } from "./types";

export interface HudState {
  score: number; coins: number; z: number; t: number; phase: Sim["phase"]; speed: number; base: number; mult: number;
  place: string; emoji: string;
  friends: FriendId[]; stumble: number; combo: number; pads: number; chase: boolean; letters: string;
  powers: { id: PowerId | "board" | MorphId | "boost"; icon: string; left: number; max: number; color: string }[];
  boost: number; boostLeft: number; boostMax: number; fever: boolean; counting: boolean; boards: number;
  lives: number; maxLives: number;
}
export interface Toast { text: string; tone: "good" | "bad" | "gold" | "info"; big?: boolean }
export interface SessionOptions extends SimOpts {
  quality: Quality;
  /** title-screen demo: the bot runs, no sound, no countdown */
  attract?: boolean;
  vibrate?: boolean;
  look?: DashLook;
  onEnd?: (r: SimResult, used: string[]) => void;
  onToast?: (t: Toast) => void;
  onEvent?: (e: SimEvent) => void;
  /** a new world (for the music and the world card) */
  onWorld?: (sec: Section) => void;
  /** a Jelly Board was used up */
  onBoard?: () => void;
}

const SWIPE_PX = 24;

export class DashSession {
  sim: Sim;
  r: DashRenderer;
  private host: HTMLElement;
  private overlay: HTMLDivElement;
  private countEl: HTMLDivElement;
  private flashEl: HTMLDivElement;
  private floaters: { el: HTMLDivElement; t: number; dx: number; dy: number }[] = [];
  private raf = 0; private last = 0;
  private paused = false; private ended = false; private endT = -1;
  private o: SessionOptions;
  private ro: ResizeObserver;
  private touch: { id: number; x: number; y: number; moved: boolean } | null = null;
  private lastTap = 0;
  private snd: Record<string, number> = {};
  private countT: number; private lastBeep = 4;
  autopilot = false;

  constructor(host: HTMLElement, spec: RunSpec, o: SessionOptions) {
    this.host = host; this.o = o;
    this.sim = new Sim(spec, { bot: !!o.attract, skill: 1, mult: o.mult, up: o.up, boards: o.attract ? 0 : o.boards });
    this.r = new DashRenderer(host, this.sim, o.quality, !!o.attract, o.look);
    this.countT = o.attract ? 0 : 2.4;
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden" });
    host.appendChild(this.overlay);
    this.flashEl = document.createElement("div");
    this.flashEl.className = "md-wflash";
    this.overlay.appendChild(this.flashEl);
    this.countEl = document.createElement("div");
    this.countEl.className = "md-count";
    this.overlay.appendChild(this.countEl);
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
      void audio.preload([
        "a:dash_coin", "a:dash_jump", "a:dash_land", "a:dash_swipe", "a:dash_squish", "a:dash_trick", "a:dash_melody", "a:dash_power", "a:dash_wobble",
        "a:dash_crash", "a:dash_count", "a:dash_go", "a:dash_pad", "a:dash_fever", "a:dash_horn", "a:dash_catch",
        "a:bubble", "a:whooshIn", "a:whistle", "a:ding", "a:blip", "popBig", "pop", "tada", "a:cheer", "sadtrombone", "a:rocket", "a:teleport", "a:poof", "a:crunch", "a:splat", "confetti", "clack", "impact",
      ]);
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private resize() {
    const b = this.host.getBoundingClientRect();
    this.r.resize(b.width, b.height);
  }

  // ---------------------------------------------------------------- input: swipe anywhere; double-tap rides a Jelly Board
  private onDown = (e: PointerEvent) => {
    void audio.resume?.();
    if (this.paused) return;
    this.touch = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };
  private onMove = (e: PointerEvent) => {
    const t = this.touch;
    if (!t || e.pointerId !== t.id || this.paused) return;
    // one swipe = one move: after the first lane change / jump / slide, the rest of that finger's travel is ignored
    // until it lifts (a long swipe used to fire again and jump two lanes)
    if (t.moved) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) this.act(dx > 0 ? "right" : "left"); else this.act(dy < 0 ? "up" : "down");
    t.moved = true;
  };
  private onUp = (e: PointerEvent) => {
    const t = this.touch;
    if (!t || e.pointerId !== t.id) return;
    this.touch = null;
    if (t.moved || this.paused) return;
    const now = performance.now();
    if (now - this.lastTap < 300) { this.board(); this.lastTap = 0; } else this.lastTap = now;
  };
  private onKey = (e: KeyboardEvent) => {
    if (e.repeat || this.paused) return;
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") this.act("left");
    else if (k === "ArrowRight" || k === "d" || k === "D") this.act("right");
    else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") this.act("up");
    else if (k === "ArrowDown" || k === "s" || k === "S") this.act("down");
    else if (k === "b" || k === "B" || k === "Enter") this.board();
    else return;
    e.preventDefault();
  };
  act(a: "left" | "right" | "up" | "down") {
    if (this.countT > 0 || this.sim.phase !== "play") return;
    if (a === "left") this.sim.left(); else if (a === "right") this.sim.right(); else if (a === "up") this.sim.jump(); else this.sim.squish();
  }
  /** ride a Jelly Board (double-tap) */
  board() {
    if (this.countT > 0) return;
    if (this.sim.useBoard()) this.o.onBoard?.();
  }

  // ---------------------------------------------------------------- loop
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    if (this.paused) { this.r.render(); return; }
    if (this.autopilot) this.sim.bot = true;
    if (this.o.attract && (this.sim.phase !== "play" || this.sim.z > 1500)) this.restartAttract();
    if (this.countT > 0) this.countdown(dt);
    else {
      const n = dt > 0.021 ? 2 : 1;
      for (let i = 0; i < n; i++) this.sim.step(dt / n);
    }
    const ev = this.sim.events.splice(0);
    this.r.update(dt, ev);
    if (!this.o.attract) this.sounds(ev);
    this.handle(ev);
    this.labels(dt);
    this.r.render();
    if (this.ended && this.endT >= 0) {
      this.endT -= dt;
      if (this.endT < 0) { this.endT = -1; this.o.onEnd?.(this.sim.result(), this.sim.track.used); }
    }
  };
  private countdown(dt: number) {
    this.countT -= dt;
    const n = Math.ceil(this.countT / 0.8);
    const txt = this.countT <= 0 ? "GO!" : n <= 3 ? String(n) : "";
    if (n < this.lastBeep && n <= 3) {
      this.lastBeep = n;
      if (n > 0) this.play("a:dash_count", 0.5, n === 1 ? 1.12 : 1);
    }
    if (this.countEl.textContent !== txt) {
      this.countEl.textContent = txt;
      this.countEl.classList.remove("md-pop"); void this.countEl.offsetWidth; this.countEl.classList.add("md-pop");
    }
    if (this.countT <= 0) {
      this.play("a:dash_go", 0.6);
      setTimeout(() => { this.countEl.textContent = ""; }, 650);
    }
  }
  private restartAttract() {
    const spec = this.sim.spec;
    this.r.dispose();
    this.sim = new Sim({ ...spec, seed: spec.seed + 1 }, { bot: true, skill: 1 });
    this.r = new DashRenderer(this.host, this.sim, this.o.quality, true, this.o.look);
    this.host.insertBefore(this.r.renderer.domElement, this.overlay);
    this.resize();
  }
  private flash() {
    this.flashEl.classList.remove("md-flashing"); void this.flashEl.offsetWidth; this.flashEl.classList.add("md-flashing");
  }

  private handle(ev: SimEvent[]) {
    for (const e of ev) {
      if (e.t === "end") { this.ended = true; this.endT = 1.4; this.vibe(280); }
      else if (e.t === "trick") { this.floater(`+${e.pts}`, TRICK_TEXT[e.kind] + (e.combo > 1 ? ` ×${e.combo}` : ""), "gold"); this.vibe(10); }
      else if (e.t === "melody") this.floater("+100", "COIN LINE!", "good");
      else if (e.t === "power") this.o.onToast?.({ text: `${POWERS[e.id].icon} ${POWERS[e.id].name}!`, tone: "gold", big: true });
      else if (e.t === "boost" && e.on) { this.o.onToast?.({ text: `🚀 BOOSTER ×${e.x}! ${boostTime(e.x)} seconds of turbo!`, tone: "gold", big: true }); this.vibe([30, 30, 60]); }
      else if (e.t === "boost" && !e.on) this.o.onToast?.({ text: "Booster over — back to normal speed", tone: "info" });
      else if (e.t === "morph" && e.on) { this.o.onToast?.({ text: `${MORPHS[e.id].icon} ${MORPHS[e.id].name}! ${MORPHS[e.id].text}`, tone: "gold", big: true }); this.vibe([20, 20, 40]); }
      else if (e.t === "friendJoin") this.o.onToast?.({ text: `${FRIENDS[e.id].name} joined the conga! ${FRIENDS[e.id].power}`, tone: "good" });
      else if (e.t === "friendSave") { this.o.onToast?.({ text: `${FRIENDS[e.id].name} saved you!`, tone: "gold", big: true }); this.vibe([40, 30, 40]); }
      else if (e.t === "fever" && e.on) { this.o.onToast?.({ text: "🎉 CONGA FEVER! Score ×2", tone: "gold", big: true }); this.vibe([20, 20, 20, 20, 60]); }
      else if (e.t === "shieldPop") { this.floater("POP!", "Shield saved you", "good"); this.vibe(40); }
      else if (e.t === "board") { if (e.on) this.o.onToast?.({ text: "🛹 Jelly Board! It saves you once", tone: "good" }); else this.floater("WHOA!", "The board saved you", "good"); }
      else if (e.t === "stumble") { this.floater("OOPS!", e.side === 0 ? "Gloop held you up" : this.sim.stumbleT > 0 && !this.sim.friends.includes("pip") ? "The Guard is after you!" : "", "bad"); this.vibe(90); }
      else if (e.t === "crash") this.vibe(200);
      else if (e.t === "letter") this.o.onToast?.({ text: `🔤 ${"MOMO".slice(0, e.n).split("").join(" ")}${"MOMO".slice(e.n).replace(/./g, " _")}`, tone: "info" });
      else if (e.t === "momo") this.o.onToast?.({ text: "🔤 M-O-M-O! +1000", tone: "gold", big: true });
      else if (e.t === "free") this.o.onToast?.({ text: `🎈 ${FRIENDS[e.id].name} is free!`, tone: "good" });
      else if (e.t === "pad") { this.floater("BOING!", e.n < 3 ? `${3 - e.n} more to catch the thief` : "Got him!", "good"); this.vibe(30); }
      else if (e.t === "chase" && e.on) this.o.onToast?.({ text: "🏃 A thief! Hit 3 green pads to catch them!", tone: "gold", big: true });
      else if (e.t === "caught") this.o.onToast?.({ text: "🎉 CAUGHT THE THIEF! +1500", tone: "gold", big: true });
      else if (e.t === "portal") this.o.onToast?.({ text: e.side ? "⭐ STAR LANE — grab the stars!" : "🪙 COIN LANE — coin feast!", tone: "gold", big: true });
      else if (e.t === "star") this.floater("+300", "STAR!", "gold");
      else if (e.t === "life") { this.o.onToast?.({ text: e.n > 0 ? `💔 Ouch! ${e.n} ${e.n === 1 ? "life" : "lives"} left` : "💔 Last life gone — grab a ❤️!", tone: "bad", big: true }); this.vibe([60, 40, 60]); }
      else if (e.t === "heart") { this.floater(e.full ? "+500" : "+1 ❤️", e.full ? "Lives full!" : `${e.n} lives`, "good"); this.vibe(30); }
      else if (e.t === "zoom") this.floater("ZOOM!", "", "good");
      else if (e.t === "cake") this.floater("CAKE BOMB!", "Bonbon cleared the way", "good");
      else if (e.t === "snip") this.floater("SNIP!", "", "good");
      else if (e.t === "world") { this.flash(); const sec = sectionOf(e.n); this.o.onWorld?.(sec); this.vibe([20, 40, 20]); }
      if (!this.o.attract) this.o.onEvent?.(e);
    }
  }

  private vibe(p: number | number[]) {
    if (!this.o.vibrate || this.o.attract || typeof navigator === "undefined" || !navigator.vibrate) return;
    try { navigator.vibrate(p); } catch { /* not allowed */ }
  }

  // ---------------------------------------------------------------- sound
  private play(name: Sound, gain: number, rate = 1, gap = 0, delay = 0, pan = 0) {
    const now = performance.now();
    if (gap && now - (this.snd[name] ?? 0) < gap) return;
    this.snd[name] = now;
    audio.play(name, { gain, rate, duck: false, delay, pan });
  }
  /** every coin is a bright gold 'cling' (the same sound each time, a hair of random pitch so a line doesn't drone) */
  private coinNote() {
    this.play("a:dash_coin", 0.32, 0.985 + Math.random() * 0.03, 35, 0, Math.max(-0.5, Math.min(0.5, this.sim.x / (LW * 2))));
  }
  private sounds(ev: SimEvent[]) {
    const pan = Math.max(-0.5, Math.min(0.5, this.sim.x / (LW * 2)));
    for (const e of ev) {
      switch (e.t) {
        case "lane": this.play("a:dash_swipe", 0.32, 0.95 + Math.random() * 0.15, 40, 0, e.dir * 0.3); break;
        case "jump": this.play("a:dash_jump", 0.42, e.big ? 0.85 : 1 + Math.random() * 0.06, 50, 0, pan); if (e.big) this.play("a:dash_pad", 0.5); break;
        case "land": if (e.v < -4) this.play("a:dash_land", Math.min(0.5, 0.18 + -e.v * 0.025), 1, 60, 0, pan); break;
        case "squish": this.play("a:dash_squish", 0.42, 1, 80, 0, pan); break;
        case "slam": this.play("a:dash_squish", 0.4, 0.8, 80); this.play("a:dash_land", 0.5, 0.8); break;
        case "coin": this.coinNote(); break;
        case "melody": this.play("a:dash_melody", 0.42); break;
        case "power": this.play("a:dash_power", 0.55); if (e.id === "shield") this.play("a:bubble", 0.5); break;
        case "powerEnd": this.play("a:blip", 0.25, 0.8, 200); break;
        case "boost": if (e.on) { this.play("a:rocket", 0.7); this.play("a:dash_fever", 0.5); } else this.play("a:dash_land", 0.5, 0.7); break;
        case "morph": if (e.on) { this.play("a:poof", 0.6); this.play("a:dash_power", 0.4, 1.2); } else this.play("a:poof", 0.4, 1.3); break;
        case "miniPop": this.play("pop", 0.6, 1.2); break;
        case "smash": this.play("a:crunch", 0.45, 0.9 + Math.random() * 0.3, 60); break;
        case "friendJoin": this.play("a:bubble", 0.55, 1.1); audio.play(`v:${e.id}_happy` as Sound, { gain: 0.75, delay: 0.12, duck: false }); break;
        case "free": this.play("a:dash_trick", 0.4, 0.9); break;
        case "friendSave": this.play("a:whooshIn", 0.5); this.play("a:dash_crash", 0.35, 1.2); audio.play(`v:${e.id}_wow` as Sound, { gain: 0.8, duck: false }); break;
        case "fever": if (e.on) this.play("a:dash_fever", 0.6); break;
        case "trick": this.play("a:dash_trick", 0.42, 1 + Math.min(0.35, (e.combo - 1) * 0.07), 60); break;
        case "stumble": this.play("a:dash_wobble", 0.55); if (e.side) this.play("a:whistle", 0.3, 1, 300, 0.15); break;
        case "crash": this.play("a:dash_crash", 0.75); break;
        case "shieldPop": this.play("popBig", 0.55); break;
        case "board": this.play(e.on ? "a:dash_power" : "popBig", 0.5, e.on ? 0.9 : 1); break;
        case "letter": this.play("a:ding", 0.5, 1 + e.n * 0.12); break;
        case "momo": this.play("tada", 0.55); break;
        case "pad": case "zoom": this.play("a:dash_pad", 0.55); break;
        case "chase": if (e.on) this.play("a:whistle", 0.45); break;
        case "caught": this.play("a:dash_catch", 0.65); break;
        case "portal": this.play("a:teleport", 0.55); break;
        case "star": this.play("a:dash_trick", 0.5, 1.3); break;
        case "life": this.play("a:dash_crash", 0.7); this.play("a:dash_wobble", 0.45, 0.9, 0, 0.1); break;
        case "heart": this.play("a:levelup", 0.5, 1.15); break;
        case "gust": this.play("a:whooshIn", 0.45, 0.8, 300); break;
        case "belt": this.play("clack", 0.35, 1.2, 200); break;
        case "cake": this.play("a:splat", 0.6, 0.9); this.play("confetti", 0.5); break;
        case "snip": this.play("clack", 0.5, 1.2); this.play("pop", 0.4); break;
        case "honk": this.play("a:dash_horn", 0.38, 1, 400, 0, e.lane * 0.4); break;
        case "roof": this.play("a:dash_land", 0.3, 1.2, 100); break;
        case "world": this.play("a:whooshIn", 0.6, 0.8); this.play("a:dash_go", 0.45, 1.2, 0, 0.15); break;
        case "end": this.play("sadtrombone", 0.45, 1, 0, 0.5); break;
        default: break;
      }
    }
  }

  // ---------------------------------------------------------------- world-anchored DOM bits
  private floater(big: string, small: string, tone: "good" | "bad" | "gold") {
    if (this.o.attract) return;
    const el = document.createElement("div");
    el.className = `md-float md-${tone}`;
    el.innerHTML = `<b>${big}</b>${small ? `<span>${small}</span>` : ""}`;
    this.overlay.appendChild(el);
    if (this.floaters.length > 3) { const f = this.floaters.shift(); f?.el.remove(); }
    const busy = this.floaters.filter((f) => f.t < 0.7).length;
    this.floaters.push({ el, t: 0, dx: (Math.random() - 0.5) * 30, dy: -busy * 58 });
  }
  private labels(dt: number) {
    const [mx, my] = this.r.momoScreen(1.9);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 1.1) { f.el.remove(); this.floaters.splice(i, 1); continue; }
      const x = Math.max(90, Math.min(this.host.clientWidth - 90, mx + 40 + f.dx)), y = my + f.dy - f.t * 70;
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${f.t < 0.12 ? 0.6 + f.t * 4 : 1.08 - Math.min(0.1, f.t * 0.1)})`;
      f.el.style.opacity = String(1 - Math.max(0, f.t - 0.75) / 0.35);
    }
  }

  // ---------------------------------------------------------------- API for the React layer and QA
  hud(): HudState {
    const s = this.sim, sec = s.sec;
    const powers: HudState["powers"] = [];
    const pw = (id: PowerId, left: number) => { if (left > 0) powers.push({ id, icon: POWERS[id].icon, left, max: POWERS[id].time * (1 + 0.2 * (s.up[id] ?? 0)) * (s.friends.includes("hoot") ? 1.3 : 1), color: POWERS[id].color }); };
    pw("magnet", s.magnetT); pw("shield", s.shieldT); pw("double", s.doubleT); pw("sky", s.skyT);
    if (s.morph) powers.push({ id: s.morph.id, icon: MORPHS[s.morph.id].icon, left: s.morph.t, max: MORPHS[s.morph.id].time * (s.friends.includes("noodle") ? 1.4 : 1), color: "#FF8A3D" });
    if (s.boardT > 0) powers.push({ id: "board", icon: "🛹", left: s.boardT, max: 30, color: "#FF5FA2" });
    return {
      score: Math.round(s.score), coins: s.stats.coins, z: s.z, t: s.t, phase: s.phase, speed: s.speed, base: s.base, mult: s.mul(),
      place: sec.place, emoji: sec.emoji,
      friends: [...s.friends], stumble: s.stumbleT, combo: s.combo, pads: s.pads, chase: s.chase != null, letters: s.letters,
      powers, boost: s.boostT > 0 ? s.boostX : 0, boostLeft: s.boostT, boostMax: boostTime(s.boostX), fever: s.feverT > 0, counting: this.countT > 0, boards: s.boards,
      lives: s.lives, maxLives: MAX_LIVES,
    };
  }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.last = performance.now(); }
  get isPaused() { return this.paused; }
  /** dev/QA: run the simulation forward (with the bot when autopilot is on) */
  debugAdvance(sec: number) {
    const dt = 1 / 60;
    this.countT = 0; this.countEl.textContent = "";
    this.sim.bot = this.autopilot || this.sim.bot;
    for (let t = 0; t < sec && this.sim.phase === "play"; t += dt) {
      this.sim.step(dt);
      const ev = this.sim.events.splice(0);
      this.handle(ev);
      this.r.update(dt, ev);
    }
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
    this.r.dispose();
    this.overlay.remove();
  }
}

export const DASH_CSS = `
.md-float{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;line-height:1;font-family:var(--font-display),system-ui;white-space:nowrap;will-change:transform,opacity}
.md-float b{font-size:34px;-webkit-text-stroke:7px rgba(30,15,70,.9);paint-order:stroke fill;font-weight:400}
.md-float span{margin-top:2px;font-size:17px;letter-spacing:.04em;-webkit-text-stroke:5px rgba(30,15,70,.9);paint-order:stroke fill}
.md-good{color:#7CFFB2}.md-bad{color:#FF6B8A}.md-gold{color:#FFD23F}
.md-count{position:absolute;left:50%;top:38%;translate:-50% -50%;font-family:var(--font-display),system-ui;font-size:min(30vw,150px);color:#FFD23F;-webkit-text-stroke:12px #2B1D52;paint-order:stroke fill;text-shadow:0 10px 0 rgba(43,29,82,.35)}
.md-pop{animation:md-pop .45s cubic-bezier(.2,1.6,.4,1)}
@keyframes md-pop{from{scale:2.2;opacity:0}to{scale:1;opacity:1}}
.md-wflash{position:absolute;inset:0;background:#fff;opacity:0}
.md-flashing{animation:md-wf .9s ease-out}
@keyframes md-wf{0%{opacity:0}12%{opacity:1}35%{opacity:1}100%{opacity:0}}
`;
