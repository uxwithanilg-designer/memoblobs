// A Kiko's Jungle Quest run: the Sim, the renderer, the rAF loop, swipe / tap / keyboard input (tap grabs a vine,
// double-tap starts the Smoothie Rush), the 3-2-1-GO countdown, the white flash at each new region, the dark blink when
// Kiko goes back to a banana flag, sound effects (bananas ring like coins) and a jungle ambience of birds, frogs
// and monkeys placed all around you (stereo + reverb), and DOM bits anchored to Kiko ("+200 VINE SWING").
import { audio, type Sound } from "@/lib/audio";
import { BOSSES, FRUITS, LW, METER, POWERS, RIDES, RIDE_T, boostTime, sectionOf } from "./levels";
import { JungleRenderer, type KikoLook, type Quality } from "./render";
import { Sim, TRICK_TEXT, type SimOpts } from "./sim";
import type { PowerId, RideId, RunSpec, Section, SimEvent, SimResult } from "./types";

export interface HudState {
  score: number; bananas: number; z: number; t: number; phase: Sim["phase"]; speed: number; base: number; mult: number;
  place: string; emoji: string; region: string; hearts: number; maxHearts: number; meter: number; rushReady: boolean;
  powers: { id: PowerId; icon: string; left: number; max: number; color: string }[];
  boost: number; boostLeft: number; boostMax: number; rush: boolean;
  chase: boolean; pads: number; seeds: number; vine: boolean; counting: boolean; ouch: boolean; golden: number;
  ride: { id: RideId; left: number; max: number } | null; boss: string | null; chaser: string | null;
}
export interface Toast { text: string; tone: "good" | "bad" | "gold" | "info"; big?: boolean }
export interface SessionOptions extends SimOpts {
  quality: Quality;
  /** title-screen demo: the bot runs, no sound, no countdown */
  attract?: boolean;
  vibrate?: boolean;
  look?: KikoLook;
  onEnd?: (r: SimResult, used: string[]) => void;
  onToast?: (t: Toast) => void;
  onEvent?: (e: SimEvent) => void;
  /** a new place (for the place card) or region (music, region card) */
  onPlace?: (sec: Section, region: boolean) => void;
}

const SWIPE_PX = 24;
const AMBIENT: Record<string, Sound[]> = {
  grove: ["a:kiko_bird1", "a:kiko_bird2", "a:kiko_bird1", "a:tweet", "a:kiko_monkey", "a:kiko_bird2"],
  river: ["a:croak", "a:kiko_bird2", "a:croak", "a:kiko_bird1", "a:tweet", "a:kiko_monkey"],
  bamboo: ["a:tweet", "a:kiko_bird2", "a:chime", "a:kiko_bird1", "a:chime"],
  falls: ["a:splash", "a:kiko_bird2", "a:tweet", "a:splash"],
  mushroom: ["a:kiko_bird3", "a:bubble", "a:kiko_bird2", "a:bubble"],
  marsh: ["a:croak", "a:croak", "a:splash", "a:kiko_bird2"],
  canopy: ["a:kiko_bird1", "a:kiko_wind", "a:kiko_bird2", "a:kiko_monkey", "a:tweet"],
  blossom: ["a:buzz", "a:tweet", "a:kiko_bird1", "a:buzz"],
  caves: ["a:drip", "a:drip", "a:kiko_bird3", "a:drip"],
  autumn: ["a:tweet", "a:kiko_wind", "a:kiko_bird2", "a:kiko_bird3"],
  plains: ["a:kiko_bird1", "a:kiko_wind", "a:tweet", "a:kiko_bird2"],
  mangrove: ["a:croak", "a:splash", "a:kiko_bird3", "a:croak"],
  snow: ["a:kiko_wind", "a:kiko_bird3", "a:kiko_wind"],
  volcano: ["a:kiko_lava", "a:kiko_geyser", "a:kiko_lava"],
  night: ["a:kiko_bird3", "a:croak", "a:kiko_bird3", "a:croak"],
};
const CHASER_TEXT: Record<string, string> = { bees: "🐝 Angry bees! RUN!", bats: "🦇 A swarm of bats! Keep going!", stampede: "🦓 STAMPEDE! Run, run, run!", avalanche: "❄️ AVALANCHE! Go go go!", boulder: "🌑 A giant boulder! RUN!" };

export class KikoSession {
  sim: Sim;
  r: JungleRenderer;
  private host: HTMLElement;
  private overlay: HTMLDivElement;
  private countEl: HTMLDivElement;
  private flashEl: HTMLDivElement;
  private dimEl: HTMLDivElement;
  private floaters: { el: HTMLDivElement; t: number; dx: number; dy: number }[] = [];
  private raf = 0; private last = 0;
  private paused = false; private ended = false; private endT = -1;
  private o: SessionOptions;
  private ro: ResizeObserver;
  private touch: { id: number; x: number; y: number; moved: boolean } | null = null;
  private lastTap = 0;
  private snd: Record<string, number> = {};
  private ambT = 2;
  private countT: number; private lastBeep = 4;
  autopilot = false;

  constructor(host: HTMLElement, spec: RunSpec, o: SessionOptions) {
    this.host = host; this.o = o;
    this.sim = new Sim(spec, { bot: !!o.attract, skill: 1, mult: o.mult, up: o.up });
    this.r = new JungleRenderer(host, this.sim, o.quality, !!o.attract, o.look);
    if (!o.attract) this.r.lightning = () => this.play("a:kiko_thunder", 0.55, 0.9 + Math.random() * 0.2, 0, 0.25, (Math.random() - 0.5) * 1.2, 0.5);
    this.countT = o.attract ? 0 : 2.4;
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden" });
    host.appendChild(this.overlay);
    this.flashEl = document.createElement("div"); this.flashEl.className = "kq-wflash"; this.overlay.appendChild(this.flashEl);
    this.dimEl = document.createElement("div"); this.dimEl.className = "kq-dim"; this.overlay.appendChild(this.dimEl);
    this.countEl = document.createElement("div"); this.countEl.className = "kq-count"; this.overlay.appendChild(this.countEl);
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
        "a:kiko_coin", "a:kiko_fruit", "a:kiko_jump", "a:kiko_land", "a:kiko_swipe", "a:kiko_slide", "a:kiko_bounce", "a:kiko_vine", "a:kiko_heart",
        "a:kiko_hurt", "a:kiko_splash", "a:kiko_flag", "a:kiko_trick", "a:kiko_melody", "a:kiko_power", "a:kiko_rush", "a:kiko_salad", "a:kiko_yuck",
        "a:kiko_slip", "a:kiko_monkey", "a:kiko_bird1", "a:kiko_bird2", "a:kiko_bird3", "a:kiko_croc", "a:kiko_count", "a:kiko_go", "a:kiko_gold",
        "a:kiko_faint", "a:kiko_caught", "a:kiko_raft", "a:kiko_coco", "a:kiko_maxup",
        "a:croak", "a:tweet", "a:buzz", "a:whooshIn", "a:poof", "a:crunch", "a:rocket", "a:bubble", "a:blip", "popBig", "pop", "tada", "a:cheer", "a:splash", "a:creak", "a:whistle",
        "a:kiko_ride", "a:kiko_web", "a:kiko_mud", "a:kiko_wind", "a:kiko_thunder", "a:kiko_geyser", "a:kiko_zip", "a:kiko_roar", "a:kiko_throw", "a:kiko_stomp", "a:kiko_ice", "a:kiko_lava", "a:drip", "a:chime",
      ]);
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private resize() {
    const b = this.host.getBoundingClientRect();
    this.r.resize(b.width, b.height);
  }

  // ---------------------------------------------------------------- input: swipe anywhere; tap grabs a vine; double-tap = Smoothie Rush
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
    this.act("tap");
    const now = performance.now();
    if (now - this.lastTap < 300) { this.rush(); this.lastTap = 0; } else this.lastTap = now;
  };
  private onKey = (e: KeyboardEvent) => {
    if (e.repeat || this.paused) return;
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") this.act("left");
    else if (k === "ArrowRight" || k === "d" || k === "D") this.act("right");
    else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") this.act("up");
    else if (k === "ArrowDown" || k === "s" || k === "S") this.act("down");
    else if (k === "e" || k === "E" || k === "Enter" || k === "r" || k === "R") this.rush();
    else return;
    e.preventDefault();
  };
  act(a: "left" | "right" | "up" | "down" | "tap") {
    if (this.countT > 0 || this.sim.phase !== "play") return;
    if (a === "left") this.sim.left(); else if (a === "right") this.sim.right(); else if (a === "up") this.sim.jump(); else if (a === "down") this.sim.slide(); else this.sim.grab();
  }
  /** the Smoothie Rush (double-tap, the HUD button, E or Enter) */
  rush() {
    if (this.countT > 0) return false;
    return this.sim.rush();
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
    if (!this.o.attract) { this.sounds(ev); this.ambience(dt); }
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
      if (n > 0) this.play("a:kiko_count", 0.5, n === 1 ? 1.12 : 1);
    }
    if (this.countEl.textContent !== txt) {
      this.countEl.textContent = txt;
      this.countEl.classList.remove("kq-pop"); void this.countEl.offsetWidth; this.countEl.classList.add("kq-pop");
    }
    if (this.countT <= 0) {
      this.play("a:kiko_go", 0.6);
      setTimeout(() => { this.countEl.textContent = ""; }, 650);
    }
  }
  private restartAttract() {
    const spec = this.sim.spec;
    this.r.dispose();
    this.sim = new Sim({ ...spec, seed: spec.seed + 1 }, { bot: true, skill: 1 });
    this.r = new JungleRenderer(this.host, this.sim, this.o.quality, true, this.o.look);
    this.host.insertBefore(this.r.renderer.domElement, this.overlay);
    this.resize();
  }
  private flash(el: HTMLDivElement, cls: string) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  private handle(ev: SimEvent[]) {
    const s = this.sim;
    for (const e of ev) {
      if (e.t === "end") { this.ended = true; this.endT = 1.2; this.vibe(280); }
      else if (e.t === "trick") { this.floater(`+${e.pts}`, TRICK_TEXT[e.kind] + (e.combo > 1 ? ` ×${e.combo}` : ""), "gold"); this.vibe(10); }
      else if (e.t === "melody") this.floater("+100", "BANANA SONG ♪", "good");
      else if (e.t === "power") this.o.onToast?.({ text: `${POWERS[e.id].icon} ${POWERS[e.id].name}!${e.id === "glide" ? " Pico carries you!" : ""}`, tone: "gold", big: true });
      else if (e.t === "boost" && e.on) { this.o.onToast?.({ text: e.rush ? `🥤 SMOOTHIE RUSH! ${boostTime(3, true)} seconds of star power!` : `🌶️ PEPPER ROCKET ×${e.x}! ${boostTime(e.x)} seconds of turbo!`, tone: "gold", big: true }); this.vibe([30, 30, 60]); }
      else if (e.t === "boost" && !e.on) this.o.onToast?.({ text: "Back to normal speed", tone: "info" });
      else if (e.t === "rushReady") { this.o.onToast?.({ text: "🥤 Smoothie ready! Double-tap for a RUSH!", tone: "good", big: true }); this.vibe([15, 20, 15]); }
      else if (e.t === "fruit") this.floater(FRUITS[e.id].icon, `${e.meter}/${METER}`, "good");
      else if (e.t === "salad") { this.o.onToast?.({ text: "🥗 FRUIT SALAD! Five different fruits! *burp*", tone: "gold", big: true }); this.vibe([20, 20, 40]); }
      else if (e.t === "gold") this.floater("+250", "GOLDEN BANANA!", "gold");
      else if (e.t === "heart") { if (e.bonus && e.hearts >= e.max) this.floater("+500", "HEARTS FULL", "gold"); else this.floater("❤️ +1", e.bonus ? "150 BANANAS!" : "HEART FRUIT!", "good"); this.vibe(20); }
      else if (e.t === "maxUp") { this.o.onToast?.({ text: `💖 Heart limit up! Now ${e.max} hearts`, tone: "gold", big: true }); this.vibe([20, 30, 20]); }
      else if (e.t === "rotten") { this.floater("YUCK!", "Rotten fruit", "bad"); this.vibe(60); }
      else if (e.t === "helmetPop") { this.floater("BONK!", "The helmet saved you", "good"); this.vibe(40); }
      else if (e.t === "stumble") { this.floater("OOPS!", e.lost ? `−${e.lost} bananas` : "", "bad"); this.vibe(80); }
      else if (e.t === "hurt") { this.vibe(220); if (s.hearts > 0) setTimeout(() => this.flash(this.dimEl, "kq-dimming"), 650); }
      else if (e.t === "respawn") this.floater("READY…", "back at the banana flag", "good");
      else if (e.t === "slip") this.vibe(30);
      else if (e.t === "flag") this.floater("🚩", "CHECKPOINT", "good");
      else if (e.t === "grab") { this.vibe(15); if (e.zip) this.floater("ZIP!", "hold on!", "good"); }
      else if (e.t === "raft" && e.on) this.o.onToast?.({ text: "🛶 All aboard the raft!", tone: "info" });
      else if (e.t === "pad") { this.floater("BOING!", e.n < 3 ? `${3 - e.n} more to catch the Grumpy` : "Got him!", "good"); this.vibe(30); }
      else if (e.t === "chase" && e.on) { const b = BOSSES[e.boss ?? "gatekeeper"]; this.o.onToast?.({ text: `${b?.icon ?? "😠"} ${b?.name ?? "A Grumpy"} has a Golden Seed! Hit 3 banana pads!`, tone: "gold", big: true }); }
      else if (e.t === "caught") { const b = BOSSES[s.boss ?? "gatekeeper"]; this.o.onToast?.({ text: `🌰 You beat ${b?.name ?? "the Grumpy"}! Golden Seed + all hearts back!`, tone: "gold", big: true }); this.vibe([30, 30, 30, 30, 80]); }
      else if (e.t === "escaped") this.o.onToast?.({ text: `${BOSSES[s.boss ?? "gatekeeper"]?.icon ?? "😠"} Got away… catch him next time!`, tone: "info" });
      else if (e.t === "ride" && e.on) { this.o.onToast?.({ text: `${RIDES[e.id].icon} ${RIDES[e.id].name}! ${RIDES[e.id].text}`, tone: "gold", big: true }); this.vibe([20, 20, 40]); }
      else if (e.t === "ride" && !e.on) this.floater("BYE!", `${RIDES[e.id].name} waves`, "good");
      else if (e.t === "stuck") { this.floater("STUCK!", "sticky web", "bad"); this.vibe(50); }
      else if (e.t === "chaser" && e.on && e.what) { this.o.onToast?.({ text: CHASER_TEXT[e.what] ?? "RUN!", tone: "bad", big: true }); this.vibe([40, 40, 40]); }

      else if (e.t === "place") this.o.onPlace?.(sectionOf(e.n), false);
      else if (e.t === "region") { this.flash(this.flashEl, "kq-flashing"); this.o.onPlace?.(sectionOf(e.n), true); this.vibe([20, 40, 20]); }
      if (!this.o.attract) this.o.onEvent?.(e);
    }
  }

  private vibe(p: number | number[]) {
    if (!this.o.vibrate || this.o.attract || typeof navigator === "undefined" || !navigator.vibrate) return;
    try { navigator.vibrate(p); } catch { /* not allowed */ }
  }

  // ---------------------------------------------------------------- sound
  private play(name: Sound, gain: number, rate = 1, gap = 0, delay = 0, pan = 0, reverb = 0) {
    const now = performance.now();
    if (gap && now - (this.snd[name] ?? 0) < gap) return;
    this.snd[name] = now;
    audio.play(name, { gain, rate, duck: false, delay, pan, reverb });
  }
  /** every banana is a bright coin 'ba-ding' (the same sound each time, a hair of random pitch so a line doesn't drone) */
  private bananaNote() {
    this.play("a:kiko_coin", 0.32, 0.985 + Math.random() * 0.03, 35, 0, Math.max(-0.5, Math.min(0.5, this.sim.x / (LW * 2))));
  }
  /** birds, frogs and monkeys all around: random calls panned left and right, with a bit of room */
  private ambience(dt: number) {
    if (this.countT > 0 || this.sim.phase !== "play") return;
    this.ambT -= dt;
    if (this.ambT > 0) return;
    this.ambT = 1.4 + Math.random() * 2.8;
    const sec = this.sim.sec;
    const list = sec.tod === "night" && sec.scene !== "volcano" ? AMBIENT.night : AMBIENT[sec.scene] ?? AMBIENT.grove;
    const name = list[Math.floor(Math.random() * list.length)];
    const side = Math.random() < 0.5 ? -1 : 1;
    this.play(name, 0.1 + Math.random() * 0.1, 0.85 + Math.random() * 0.35, 0, 0, side * (0.45 + Math.random() * 0.5), 0.6);
    if ((sec.weather === "rain" || sec.weather === "storm") && Math.random() < 0.4) this.play("a:splash", 0.05, 1.6, 0, 0.2, -side * 0.6, 0.5);
    if (sec.weather === "wind" && Math.random() < 0.3) this.play("a:kiko_wind", 0.12, 0.8, 0, 0.1, side * 0.8, 0.5);
  }
  private sounds(ev: SimEvent[]) {
    const pan = Math.max(-0.5, Math.min(0.5, this.sim.x / (LW * 2)));
    for (const e of ev) {
      switch (e.t) {
        case "lane": this.play("a:kiko_swipe", 0.3, 0.95 + Math.random() * 0.15, 40, 0, e.dir * 0.35); break;
        case "jump": this.play("a:kiko_jump", 0.42, 1 + Math.random() * 0.06, 50, 0, pan); break;
        case "bounce": this.play("a:kiko_bounce", 0.55, 0.95 + Math.random() * 0.1, 60, 0, pan); break;
        case "land": if (e.v < -4) this.play("a:kiko_land", Math.min(0.5, 0.18 + -e.v * 0.025), 1, 60, 0, pan); break;
        case "slide": this.play("a:kiko_slide", 0.42, 1, 80, 0, pan); break;
        case "slam": this.play("a:kiko_slide", 0.4, 0.8, 80); this.play("a:kiko_land", 0.5, 0.8); break;
        case "banana": this.bananaNote(); break;
        case "melody": this.play("a:kiko_melody", 0.4); break;
        case "fruit": this.play("a:kiko_fruit", 0.5, 0.9 + (e.meter / METER) * 0.4, 40, 0, pan); break;
        case "salad": this.play("a:kiko_salad", 0.6); this.play("a:kiko_monkey", 0.35, 1.15, 0, 0.5); break;
        case "gold": this.play("a:kiko_gold", 0.55); break;
        case "heart": this.play("a:kiko_heart", 0.55); break;
        case "maxUp": this.play("a:kiko_maxup", 0.6); break;
        case "rotten": this.play("a:kiko_yuck", 0.6); break;
        case "rushReady": this.play("a:kiko_power", 0.45, 1.2); break;
        case "power": this.play("a:kiko_power", 0.55); if (e.id === "helmet") this.play("a:creak", 0.3, 1.4); if (e.id === "glide") this.play("a:tweet", 0.5, 0.9, 0, 0.1); break;
        case "powerEnd": this.play("a:blip", 0.25, 0.8, 200); break;
        case "helmetPop": this.play("popBig", 0.55); break;
        case "boost": if (e.on) { this.play(e.rush ? "a:kiko_rush" : "a:rocket", 0.65); } else this.play("a:kiko_land", 0.5, 0.7); break;
        case "smash": this.play("a:crunch", 0.45, 0.9 + Math.random() * 0.3, 60); break;
        case "trick": this.play("a:kiko_trick", 0.42, 1 + Math.min(0.35, (e.combo - 1) * 0.07), 60); break;
        case "stumble": this.play("a:kiko_hurt", 0.4, 1.25); break;
        case "hurt": if (e.by === "water") this.play("a:kiko_splash", 0.7); else if (e.by === "lava") { this.play("a:kiko_lava", 0.7); this.play("a:kiko_hurt", 0.5, 1.2); } else if (e.by === "fall") this.play("a:whistle", 0.4, 0.7); else this.play("a:kiko_hurt", 0.7); if (e.by === "croc") this.play("a:kiko_croc", 0.5); break;
        case "splash": this.play("a:kiko_splash", 0.6, 1, 0, 0, pan); break;
        case "respawn": this.play("a:kiko_flag", 0.35, 1.1); break;
        case "flag": this.play("a:kiko_flag", 0.4, 1, 0, 0, -0.5); break;
        case "grab": if (e.zip) this.play("a:kiko_zip", 0.55, 1, 0, 0, pan); else this.play("a:kiko_vine", 0.6, 1, 0, 0, pan); this.play("a:kiko_monkey", 0.3, 1.1, 1200, 0.1, pan); break;
        case "release": this.play("a:whooshIn", 0.35, 1.2); break;
        case "branch": if (e.on) this.play("a:creak", 0.3, 1.2, 400); break;
        case "raft": if (e.on) this.play("a:kiko_raft", 0.5); else this.play("a:kiko_splash", 0.3, 1.3); break;
        case "slip": this.play("a:kiko_slip", 0.6); break;
        case "coco": this.play("a:kiko_coco", 0.4); break;
        case "pad": this.play("a:kiko_bounce", 0.6, 1.2); break;
        case "chase": if (e.on) { this.play("a:whistle", 0.45); this.play("a:kiko_roar", 0.55, 1, 0, 0.4); } break;
        case "caught": this.play("a:kiko_caught", 0.65); break;
        case "region": this.play("a:whooshIn", 0.6, 0.8); this.play("a:kiko_go", 0.45, 1.2, 0, 0.15); break;
        case "end": this.play("a:kiko_faint", 0.6, 1, 0, 0.3); break;
        case "ride": if (e.on) { this.play("a:kiko_ride", 0.6); if (e.id === "elephant" || e.id === "dino") this.play("a:kiko_stomp", 0.6, 0.9, 0, 0.2); if (e.id === "frog") this.play("a:croak", 0.6); } else this.play("a:poof", 0.4, 1.2); break;
        case "stuck": this.play("a:kiko_web", 0.6, 1, 0, 0, pan); break;
        case "mud": this.play("a:kiko_mud", 0.5, 0.9 + Math.random() * 0.2, 200, 0, pan); break;
        case "gust": this.play("a:kiko_wind", 0.55, 1, 300, 0, -e.dir * 0.6); break;
        case "throw": this.play("a:kiko_throw", 0.45, 1, 300, 0, e.lane * 0.5); if (Math.random() < 0.3) this.play("a:kiko_roar", 0.35, 1.1, 1500); break;
        case "escaped": this.play("a:kiko_roar", 0.5, 1.2); break;
        case "chaser": if (e.on) { this.play(e.what === "bees" ? "a:buzz" : e.what === "bats" ? "a:kiko_bird3" : "a:kiko_stomp", 0.6, e.what === "avalanche" ? 0.6 : 1); this.play("a:whistle", 0.4, 1, 0, 0.2); } break;
        default: break;
      }
    }
    // a bee buzz near hives, a coconut whistle when one drops
    const s = this.sim;
    s.near(s.z + 2, s.z + s.speed * 1.3, (o) => {
      if (o.kind === "hive" && !o.used) { o.used = true; this.play("a:buzz", 0.22, 1.2, 600, 0, o.lane * 0.4); }
      if (o.kind === "coco" && !o.used && o.z - s.z < s.speed * 1.25) { o.used = true; this.play("a:kiko_coco", 0.35, 1, 300, 0, o.lane * 0.4); }
      if (o.kind === "croc" && !o.used && o.z - s.z < s.speed * 1.1) { o.used = true; this.play("a:kiko_croc", 0.4, 1, 300, 0, o.lane * 0.4); }
      if (o.kind === "geyser" && !o.used && o.z - s.z < s.speed * 1.0) { o.used = true; this.play("a:kiko_geyser", 0.3, 1, 400, 0, o.lane * 0.4); }
    });
  }

  // ---------------------------------------------------------------- world-anchored DOM bits
  private floater(big: string, small: string, tone: "good" | "bad" | "gold") {
    if (this.o.attract) return;
    const el = document.createElement("div");
    el.className = `kq-float kq-${tone}`;
    el.innerHTML = `<b>${big}</b>${small ? `<span>${small}</span>` : ""}`;
    this.overlay.appendChild(el);
    if (this.floaters.length > 3) { const f = this.floaters.shift(); f?.el.remove(); }
    const busy = this.floaters.filter((f) => f.t < 0.7).length;
    this.floaters.push({ el, t: 0, dx: (Math.random() - 0.5) * 30, dy: -busy * 58 });
  }
  private labels(dt: number) {
    const [mx, my] = this.r.kikoScreen(2.0);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 1.1) { f.el.remove(); this.floaters.splice(i, 1); continue; }
      const x = Math.max(90, Math.min(this.host.clientWidth - 90, mx + 40 + f.dx)), y = Math.max(140, my + f.dy - f.t * 70);
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${f.t < 0.12 ? 0.6 + f.t * 4 : 1.08 - Math.min(0.1, f.t * 0.1)})`;
      f.el.style.opacity = String(1 - Math.max(0, f.t - 0.75) / 0.35);
    }
  }

  // ---------------------------------------------------------------- API for the React layer and QA
  hud(): HudState {
    const s = this.sim, sec = s.sec;
    const powers: HudState["powers"] = [];
    const pw = (id: PowerId, left: number) => { if (left > 0) powers.push({ id, icon: POWERS[id].icon, left, max: POWERS[id].time * (1 + 0.2 * (s.up[id] ?? 0)), color: POWERS[id].color }); };
    pw("magnet", s.magnetT); pw("helmet", s.helmetT); pw("double", s.doubleT); pw("glide", s.glideT);
    return {
      score: Math.round(s.score), bananas: s.stats.bananas, z: s.z, t: s.t, phase: s.phase, speed: s.speed, base: s.base, mult: s.mul(),
      place: sec.place, emoji: sec.emoji, region: sec.region, hearts: s.hearts, maxHearts: s.maxHearts, meter: s.meter, rushReady: s.meter >= METER && s.boostT <= 0,
      powers, boost: s.boostT > 0 ? s.boostX : 0, boostLeft: s.boostT, boostMax: boostTime(s.boostX, s.rushing), rush: s.rushing,
      chase: s.chase != null, pads: s.pads, seeds: s.seeds, vine: !!s.vineNear() && !s.swing && s.rideT <= 0, counting: this.countT > 0, ouch: s.ouchT > 0, golden: s.stats.golden,
      ride: s.ride && s.rideT > 0 ? { id: s.ride, left: s.rideT, max: RIDE_T } : null, boss: s.chase != null ? s.boss : null, chaser: s.chaser,
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

export const KIKO_CSS = `
.kq-float{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;line-height:1;font-family:var(--font-display),system-ui;white-space:nowrap;will-change:transform,opacity}
.kq-float b{font-size:34px;-webkit-text-stroke:7px rgba(40,25,10,.9);paint-order:stroke fill;font-weight:400}
.kq-float span{margin-top:2px;font-size:17px;letter-spacing:.04em;-webkit-text-stroke:5px rgba(40,25,10,.9);paint-order:stroke fill}
.kq-good{color:#9CFF6B}.kq-bad{color:#FF6B8A}.kq-gold{color:#FFD23F}
.kq-count{position:absolute;left:50%;top:38%;translate:-50% -50%;font-family:var(--font-display),system-ui;font-size:min(30vw,150px);color:#FFD23F;-webkit-text-stroke:12px #3A2410;paint-order:stroke fill;text-shadow:0 10px 0 rgba(58,36,16,.35)}
.kq-pop{animation:kq-pop .45s cubic-bezier(.2,1.6,.4,1)}
@keyframes kq-pop{from{scale:2.2;opacity:0}to{scale:1;opacity:1}}
.kq-wflash{position:absolute;inset:0;background:#fff;opacity:0}
.kq-flashing{animation:kq-wf .9s ease-out}
@keyframes kq-wf{0%{opacity:0}12%{opacity:1}35%{opacity:1}100%{opacity:0}}
.kq-dim{position:absolute;inset:0;background:radial-gradient(circle at 50% 55%,rgba(20,12,4,.55),rgba(10,6,2,.95));opacity:0}
.kq-dimming{animation:kq-dim .9s ease-in-out}
@keyframes kq-dim{0%{opacity:0}40%{opacity:1}60%{opacity:1}100%{opacity:0}}
`;
