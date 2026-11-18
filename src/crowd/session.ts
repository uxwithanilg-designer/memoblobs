// A running Blob Brigade game: the Sim, the renderer, the rAF loop, drag/keyboard input, sound effects and the
// world-anchored DOM labels (brigade count, jar / cage HP). The React HUD polls `hud()` a few times a second.
import { audio, type Sound } from "@/lib/audio";
import { HALF, VILLAINS, applyGate } from "./levels";
import { BrigadeRenderer, type Quality } from "./render";
import { MAX_BRIGADE, Sim } from "./sim";
import { DEFAULT_LOADOUT, POWERUPS, leaderOf, type Loadout, type Look } from "./leaders";
import type { SimEvent, SimResult, StageSpec } from "./types";

export interface HudState {
  n: number; peak: number; hpLeft: number; hpTotal: number; coins: number; t: number;
  wave?: number; boss?: { hp: number; max: number; kind: string; mini: boolean };
  phase: Sim["phase"];
}
export interface Toast { text: string; tone: "good" | "bad" | "gold" | "info"; big?: boolean }
export interface SessionOptions {
  quality: Quality;
  sensitivity?: number;
  /** attract mode on the title screen: the bot plays, no sound, restarts when done */
  attract?: boolean;
  vibrate?: boolean;
  onEnd?: (r: SimResult) => void;
  onToast?: (t: Toast) => void;
  onWave?: (k: number) => void;
  /** every sim event, after the session handled it (music cues, tutorial) */
  onEvent?: (e: SimEvent) => void;
  loadout?: Loadout;
  look?: Look;
}

const fmt = (n: number) => (n >= MAX_BRIGADE ? "MAX!" : n.toLocaleString("en-US"));

export class BrigadeSession {
  sim: Sim;
  r: BrigadeRenderer;
  private host: HTMLElement;
  private overlay: HTMLDivElement;
  private countEl: HTMLDivElement;
  private countNum!: HTMLSpanElement;
  private lastX = 0;
  private blockEls = new Map<number, HTMLDivElement>();
  private floaters: { el: HTMLDivElement; x: number; z: number; t: number }[] = [];
  private raf = 0; private last = 0;
  private paused = false; private ended = false; private endT = -1;
  private o: SessionOptions;
  private ro: ResizeObserver;
  private drag: { id: number; x0: number; tx0: number } | null = null;
  private keys = { l: false, r: false };
  private hpTotal: number;
  private snd: Record<string, number> = {};
  private streak = 0; private streakT = 0;
  private shotT = 0;
  autopilot = false;

  constructor(host: HTMLElement, spec: StageSpec, o: SessionOptions) {
    this.host = host; this.o = o;
    this.sim = new Sim(spec, { bot: !!o.attract, skill: 0.8, loadout: o.loadout ?? DEFAULT_LOADOUT });
    this.hpTotal = Math.max(1, this.sim.hordeHpLeft());
    this.r = new BrigadeRenderer(host, this.sim, spec.theme, o.quality, o.look);
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden" });
    host.appendChild(this.overlay);
    this.countEl = document.createElement("div");
    this.countEl.className = "bb-count";
    const lead = leaderOf((o.loadout ?? DEFAULT_LOADOUT).leader);
    const img = document.createElement("img"); img.src = lead.img; img.alt = ""; img.className = "bb-lead"; img.style.borderColor = lead.color;
    this.countNum = document.createElement("span");
    this.countEl.append(img, this.countNum);
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
      window.addEventListener("keyup", this.onKey);
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private resize() {
    const b = this.host.getBoundingClientRect();
    this.r.resize(b.width, b.height);
  }

  // ---------------------------------------------------------------- input: relative drag anywhere
  private pxPerUnit() {
    const [a] = this.r.screen(-HALF, 0, 0), [b] = this.r.screen(HALF, 0, 0);
    return Math.max(1, (b - a) / (HALF * 2));
  }
  private onDown = (e: PointerEvent) => {
    if (this.drag) return;
    this.drag = { id: e.pointerId, x0: e.clientX, tx0: this.sim.tx };
    this.lastX = e.clientX;
    void audio.resume?.();
  };
  private onMove = (e: PointerEvent) => {
    this.lastX = e.clientX;
    const d = this.drag;
    if (!d || e.pointerId !== d.id || this.paused) return;
    const k = (this.o.sensitivity ?? 1) * 1.25 / this.pxPerUnit();
    this.sim.tx = Math.max(-HALF + 0.6, Math.min(HALF - 0.6, d.tx0 + (e.clientX - d.x0) * k));
  };
  private onUp = (e: PointerEvent) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };
  private onKey = (e: KeyboardEvent) => {
    const on = e.type === "keydown";
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { this.keys.l = on; e.preventDefault(); }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { this.keys.r = on; e.preventDefault(); }
  };

  // ---------------------------------------------------------------- loop
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    if (this.paused) { this.r.render(); return; }
    if (this.keys.l || this.keys.r) this.sim.tx = Math.max(-HALF + 0.6, Math.min(HALF - 0.6, this.sim.tx + (this.keys.r ? 1 : -1) * 11 * dt));
    if (this.autopilot) this.sim.tx = this.sim.botTarget();
    if (this.drag && this.sim.boss && this.sim.boss.pullT > 0) { this.drag.x0 = this.lastX; this.drag.tx0 = this.sim.tx; }
    // two half steps on slow frames keep bubbles from tunnelling
    if (dt > 0.034) { this.sim.step(dt / 2); this.sim.step(dt / 2); } else this.sim.step(dt);
    const ev = this.sim.events.splice(0);
    this.r.update(dt, ev);
    if (!this.o.attract) this.sounds(ev, dt);
    this.handle(ev);
    this.labels(dt);
    this.r.render();
    if (this.ended && this.endT >= 0) {
      this.endT -= dt;
      if (this.endT < 0) { this.endT = -1; this.o.onEnd?.(this.sim.result()); }
    }
  };

  private handle(ev: SimEvent[]) {
    for (const e of ev) {
      if (e.t === "end") {
        if (this.o.attract) { this.restartAttract(); return; }
        this.ended = true; this.endT = e.won ? 1.6 : 1.2;
        this.vibe(e.won ? [30, 40, 60] : 300);
      } else if (e.t === "gate") {
        const diff = e.after - e.before;
        this.o.onToast?.({ text: `${e.label}  →  ${fmt(e.after)}`, tone: e.good ? "good" : "bad", big: Math.abs(diff) >= 20 });
      } else if (e.t === "blockBreak") {
        if (e.kind === "jar") this.o.onToast?.({ text: "BONUS JAR!", tone: "gold", big: true });
        else if (e.kind === "cage") this.o.onToast?.({ text: `FREED +${e.n}!`, tone: "good" });
      } else if (e.t === "blockLost" && e.kind === "cage") this.o.onToast?.({ text: "Cage got away…", tone: "bad" });
      else if (e.t === "bossIn") {
        const v = VILLAINS[e.kind];
        this.o.onToast?.({ text: `${v.emoji} ${v.name.toUpperCase()}!`, tone: "bad", big: true });
        this.o.onToast?.({ text: `“${v.taunt}”`, tone: "info" });
      } else if (e.t === "bossRage") this.o.onToast?.({ text: `${VILLAINS[e.kind].name} is ANGRY!`, tone: "bad" });
      else if (e.t === "land" && e.hit && e.n > 0) { this.vibe(70); this.floater(`−${e.n}`, e.x, e.z, "bad"); }
      else if (e.t === "bossDrop") this.o.onToast?.({ text: "Grumpies from the sky!", tone: "bad" });
      else if (e.t === "power") this.o.onToast?.({ text: `${POWERUPS[e.kind].icon} ${POWERUPS[e.kind].name}`, tone: "gold", big: true });
      else if (e.t === "leaderPower") { const l = leaderOf(e.id); this.o.onToast?.({ text: `${l.powerName.toUpperCase()}!`, tone: "gold", big: true }); this.vibe([20, 30, 40]); }
      else if (e.t === "surf" && e.stage === "warn") this.o.onToast?.({ text: e.dir < 0 ? "⬅️ BIG WAVE!" : "BIG WAVE! ➡️", tone: "info", big: true });
      else if (e.t === "surf" && e.stage === "hit" && this.drag) { this.drag.x0 = this.lastX; this.drag.tx0 = this.sim.tx; }
      else if (e.t === "boulderHit" && e.hit) { this.vibe(90); this.floater(`−${e.n}`, e.x, 0, "bad"); }
      else if (e.t === "chill") this.o.onToast?.({ text: "❄️ Brrr! Slowed down", tone: "info" });
      else if (e.t === "bossArmor") this.o.onToast?.({ text: "ARMOUR OFF!", tone: "gold", big: true });
      else if (e.t === "bossCore" && e.open) this.o.onToast?.({ text: "💚 CORE OPEN — HIT IT!", tone: "good" });
      else if (e.t === "bossFade" && e.on) this.o.onToast?.({ text: "👻 He vanished…", tone: "info" });
      else if (e.t === "bossPhase") this.o.onToast?.({ text: e.phase === 2 ? "PHASE 2: LASERS!" : "PHASE 3: METEORS!", tone: "bad", big: true });
      else if (e.t === "bossBeam" && e.on) this.o.onToast?.({ text: "🛸 TRACTOR BEAM!", tone: "bad" });
      else if (e.t === "bossDown") this.o.onToast?.({ text: "CHEERED UP!", tone: "gold", big: true });
      else if (e.t === "merge") this.o.onToast?.({ text: e.tier === 1 ? "BIG BLOB!" : e.tier === 2 ? "GIANT BLOB!" : "MEGA BLOB!", tone: "gold", big: e.tier > 1 });
      else if (e.t === "hit") { this.vibe(e.n > 5 ? 60 : 25); this.floater(`−${e.n}`, e.x, e.z, "bad"); }
      else if (e.t === "recruit" && !e.coin && e.n < 0) { this.vibe(40); this.floater(`−${-e.n}`, e.x, e.z, "bad"); }
      else if (e.t === "recruit" && !e.coin) this.floater(`+${e.n}`, e.x, e.z, "good");
      else if (e.t === "recruit" && e.coin) this.floater(`+${e.n} 🪙`, e.x, e.z, "gold");
      else if (e.t === "wave") { this.o.onWave?.(e.k); this.hpTotal = Math.max(1, this.sim.hordeHpLeft()); }
      if (!this.o.attract) this.o.onEvent?.(e);
    }
  }

  private restartAttract() {
    const spec = this.sim.spec;
    this.r.dispose();
    this.sim = new Sim(spec, { bot: true, skill: 0.8 });
    this.r = new BrigadeRenderer(this.host, this.sim, spec.theme, this.o.quality, this.o.look);
    this.host.insertBefore(this.r.renderer.domElement, this.overlay);
    this.resize();
  }

  private vibe(p: number | number[]) {
    if (!this.o.vibrate || typeof navigator === "undefined" || !navigator.vibrate) return;
    try { navigator.vibrate(p); } catch { /* not allowed */ }
  }

  // ---------------------------------------------------------------- sound
  private play(name: Sound, gain: number, rate = 1, gap = 0) {
    const now = performance.now();
    if (gap && now - (this.snd[name] ?? 0) < gap) return;
    this.snd[name] = now;
    audio.play(name, { gain, rate, duck: false });
  }
  private sounds(ev: SimEvent[], dt: number) {
    // a soft fizz of bubbles while the brigade is shooting
    this.shotT -= dt;
    if (this.shotT <= 0 && this.sim.phase === "play") {
      this.shotT = 0.09 + Math.random() * 0.05;
      this.play("a:bubble", Math.min(0.16, 0.05 + this.sim.units.length * 0.004), 1.1 + Math.random() * 0.5);
    }
    this.streakT -= dt;
    if (this.streakT <= 0) this.streak = 0;
    let pops = 0;
    for (const e of ev) {
      switch (e.t) {
        case "pop": pops++; break;
        case "hit": this.play("squish", 0.5, 0.9 + Math.random() * 0.2, 90); break;
        case "recruit":
          if (e.coin) this.play("a:coin", 0.45);
          else if (e.n < 0) this.play("a:bwomp", 0.5, 1.2, 120);
          else { this.streak = Math.min(14, this.streak + 1); this.streakT = 0.7; this.play("a:blip", 0.32, 0.9 + this.streak * 0.06, 40); }
          break;
        case "gate": this.play(e.good ? "a:ding" : "a:bwomp", 0.55); this.play("a:whooshIn", 0.35); break;
        case "blockHit": this.play(e.kind === "jar" ? "a:clunk" : "a:tink", 0.22, 0.9 + Math.random() * 0.3, 110); break;
        case "blockBreak":
          this.play("a:crunch", 0.6); this.play("confetti", 0.5);
          if (e.kind === "cage") this.play("a:cheer", 0.45); else if (e.kind === "pinata") this.play("a:kazoo", 0.4, 1.1);
          break;
        case "bossIn": {
          this.play("a:gong", 0.55);
          const v = VILLAINS[e.kind];
          audio.play(v.voice as Sound, { gain: 0.85, rate: v.pitch, delay: 0.35, duck: false });
          break;
        }
        case "throw": this.play("a:whooshIn", 0.22, e.kind === "zap" ? 0.6 : 1.35, 110); break;
        case "land":
          if (e.kind === "zap") this.play("a:zap", 0.6, 0.8);
          else this.play("a:splat", 0.5, e.kind === "cake" ? 0.8 : 1.1);
          if (e.hit) this.play("squish", 0.55, 0.8);
          break;
        case "bossShield": if (e.on) this.play("a:tink", 0.5, 0.7); break;
        case "bossCharge": this.play("a:rocket", 0.3, 1.3, 400); break;
        case "bossDrop": this.play("a:poof", 0.5); this.play("a:whistle", 0.3, 1.2); break;
        case "power": this.play("a:levelup", 0.55, 1.15); this.play("a:twinkle", 0.4); break;
        case "leaderPower": { this.play("a:perfect", 0.5, 1.1); const v = `v:${e.id}_wow` as Sound; audio.play(v, { gain: 0.8, duck: false }); break; }
        case "cakeBomb": this.play("a:splat", 0.45, 0.8, 120); break;
        case "boulder": this.play("a:stone", 0.4, 0.6, 300); break;
        case "boulderHit": this.play(e.hit ? "impact" : "a:stone", e.hit ? 0.7 : 0.35, 0.8); break;
        case "vent": if (e.state === "warn") this.play("a:sizzle", 0.35, 1, 200); else if (e.state === "erupt") this.play("a:crunch", 0.4, 0.6, 200); break;
        case "burn": this.play("a:sizzle", 0.3, 1.3, 260); break;
        case "surf": this.play(e.stage === "warn" ? "a:slosh" : "a:splash", e.stage === "warn" ? 0.4 : 0.6); break;
        case "chill": this.play("a:tink", 0.5, 0.5); break;
        case "bossFade": this.play("a:poof", 0.4, e.on ? 0.8 : 1.2); break;
        case "bossArmor": this.play("a:clunk", 0.6); this.play("a:crunch", 0.5); break;
        case "bossCore": if (e.open) this.play("a:ding", 0.45, 0.6); break;
        case "bossPhase": this.play("a:gong", 0.6, 0.9); break;
        case "bossBeam": if (e.on) this.play("a:ufo", 0.55); break;
        case "bossHit": this.play("a:bonk", 0.28, 0.8 + Math.random() * 0.3, 140); break;
        case "bossRage": this.play("a:bwomp", 0.55, 0.8); break;
        case "bossDown": this.play("tada", 0.7); this.play("a:cheer", 0.6); break;
        case "bossSmash": this.play("impact", 0.8); break;
        case "merge": this.play("a:levelup", 0.45, 1 + e.tier * 0.1, 200); break;
        case "wave": this.play("a:go", 0.5); break;
        case "waveClear": this.play("a:perfect", 0.55); break;
        case "end": if (e.won) { this.play("tada", 0.7); this.play("a:applause", 0.5); } else this.play("sadtrombone", 0.6); break;
        default: break;
      }
    }
    if (pops) this.play("pop", Math.min(0.42, 0.16 + pops * 0.03), 1.05 + Math.random() * 0.5, 45);
  }

  // ---------------------------------------------------------------- world-anchored labels
  private floater(text: string, x: number, z: number, tone: "good" | "bad" | "gold") {
    if (this.floaters.length > 10) { const f = this.floaters.shift(); f?.el.remove(); }
    const el = document.createElement("div");
    el.className = `bb-float bb-${tone}`;
    el.textContent = text;
    this.overlay.appendChild(el);
    this.floaters.push({ el, x, z, t: 0 });
  }
  private labels(dt: number) {
    const s = this.sim;
    {
      const [x, y] = this.r.screen(s.bx, 1.25 + s.R * 0.75, -s.R * 0.2);
      this.countEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      const txt = fmt(s.n);
      if (this.countNum.textContent !== txt) {
        this.countNum.textContent = txt;
        this.countEl.classList.remove("bb-bump"); void this.countEl.offsetWidth; this.countEl.classList.add("bb-bump");
      }
      this.countEl.style.opacity = s.phase === "lost" ? "0" : "1";
    }
    const seen = new Set<number>();
    for (const o of s.blocks) {
      if (!o.alive || o.z < -40) continue;
      seen.add(o.id);
      let el = this.blockEls.get(o.id);
      if (!el) {
        el = document.createElement("div");
        el.className = `bb-hp bb-hp-${o.kind}`;
        this.overlay.appendChild(el); this.blockEls.set(o.id, el);
      }
      const [x, y] = this.r.screen(o.x, o.kind === "jar" ? 2.05 : 1.55, o.z);
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      const t = String(Math.ceil(o.hp));
      if (el.textContent !== t) el.textContent = t;
    }
    for (const [id, el] of this.blockEls) if (!seen.has(id)) { el.remove(); this.blockEls.delete(id); }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 0.9) { f.el.remove(); this.floaters.splice(i, 1); continue; }
      const [x0, y] = this.r.screen(f.x, 1 + f.t * 2.2, f.z);
      const x = Math.max(28, Math.min(this.host.clientWidth - 28, x0));
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + Math.min(0.3, f.t)})`;
      f.el.style.opacity = String(1 - Math.max(0, f.t - 0.55) / 0.35);
    }
  }

  // ---------------------------------------------------------------- API for the React layer and QA
  hud(): HudState {
    const s = this.sim, b = s.boss;
    return {
      n: s.n, peak: s.peak, hpLeft: s.hordeHpLeft(), hpTotal: this.hpTotal, coins: s.stats.coins, t: s.t, phase: s.phase,
      wave: s.spec.endless || s.spec.rush ? s.wave : undefined,
      boss: b ? { hp: b.hp, max: b.maxHp, kind: b.kind, mini: b.mini } : undefined,
    };
  }
  /** the best gate for the current count — used by the tutorial hint */
  bestGateHint(): number | null {
    const g = this.sim.gates.find((x) => !x.done && x.z > -12);
    if (!g) return null;
    let best = 0, bv = -1;
    g.gates.forEach((gate, i) => { const v = applyGate(this.sim.n, gate); if (v > bv) { bv = v; best = i; } });
    return best;
  }
  /** the POWER button */
  usePower(): boolean { return this.sim.usePower(); }
  get power(): number { return this.sim.power; }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.last = performance.now(); }
  get isPaused() { return this.paused; }
  /** dev/QA: run the simulation forward without rendering every frame */
  debugAdvance(sec: number) {
    const dt = 1 / 30;
    for (let t = 0; t < sec && this.sim.phase === "play"; t += dt) {
      if (this.autopilot) this.sim.tx = this.sim.botTarget();
      this.sim.step(dt);
      const ev = this.sim.events.splice(0);
      this.handle(ev);
      this.r.update(dt, ev.filter((e) => e.t !== "pop"));
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
    window.removeEventListener("keyup", this.onKey);
    this.r.dispose();
    this.overlay.remove();
  }
}

export const BRIGADE_CSS = `
.bb-lead{width:26px;height:26px;margin:-2px 5px -2px -8px;border-radius:999px;border:2px solid #FF8A3D;background:#fff;object-fit:cover;vertical-align:middle}
.bb-count{position:absolute;left:0;top:0;display:flex;align-items:center;padding:2px 12px 3px;border-radius:999px;background:#fff;color:#2b1d52;font-family:var(--font-display),system-ui;font-size:22px;line-height:1.1;box-shadow:0 3px 0 rgba(43,29,82,.35),0 0 0 3px #FF8A3D;white-space:nowrap;will-change:transform;transition:opacity .3s}
.bb-count.bb-bump{animation:bb-bump .22s ease-out}
@keyframes bb-bump{0%{scale:1}40%{scale:1.22}100%{scale:1}}
.bb-hp{position:absolute;left:0;top:0;min-width:34px;padding:1px 8px 2px;border-radius:10px;text-align:center;font-family:var(--font-display),system-ui;font-size:16px;color:#fff;background:#B5532E;box-shadow:0 2px 0 rgba(0,0,0,.3);will-change:transform}
.bb-hp-cage{background:#2AA7D6}.bb-hp-pinata{background:#B26BFF}
.bb-float{position:absolute;left:0;top:0;font-family:var(--font-display),system-ui;font-size:22px;white-space:nowrap;-webkit-text-stroke:5px rgba(20,10,50,.85);paint-order:stroke fill;will-change:transform,opacity}
.bb-good{color:#7CFFB2}.bb-bad{color:#FF6B8A}.bb-gold{color:#FFD23F}
`;
