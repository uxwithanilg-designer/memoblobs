// Puddo's Clayland: Rain Raid session: runs the sim at a fixed 120 Hz, renders every frame, reads keyboard / gamepad /
// on-screen buttons, plays the sounds for what happens, and reports the HUD and the end of the stage to the UI.
import { audio, type Sound } from "@/lib/audio";
import { botInput, newBotMem, type BotMem } from "./bot";
import { STEP } from "./physics";
import { ClayRenderer, type ClayLookR, type Quality } from "./render";
import { NO_INPUT, Sim, type Input } from "./sim";
import { buildStage } from "./stages";
import type { FriendId, Hud, SimEvent, SimResult, Stage, Weapon } from "./types";

export type Button = "left" | "right" | "up" | "down" | "jump" | "fire" | "bomb" | "super";
export interface SessionOpts {
  quality: Quality; n: number; hearts: number; lives?: number; friend?: FriendId; attract?: boolean; easyRun?: boolean; vibrate?: boolean;
  look?: ClayLookR;
  /** Blaster Shop upgrades */
  up?: { fireMul: number; dmgMul: number; maxBombs: number; magnet: number };
  weapon?: Weapon; bombs?: number;
  onEvent?: (e: SimEvent, s: Sim) => void; onHud?: (h: Hud) => void; onFinish?: (r: SimResult) => void;
}

/** keys → buttons: arrows / WASD move (↑ jumps too), Space / Z jump, X / J fire, C / K bomb, V / L Super Rain */
const KEYS: Record<string, Button> = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  Space: "jump", KeyZ: "jump", KeyX: "fire", KeyJ: "fire", ShiftLeft: "fire", KeyC: "bomb", KeyK: "bomb", KeyV: "super", KeyL: "super",
};

/** sound for each sim event: [file, gain] (files: public/audio/arcade/sfx_clay_*.mp3, made by scripts/gen_clay_audio.py) */
const SFX: Partial<Record<SimEvent["t"], [string, number]>> = {
  jump: ["clay_jump", 0.38], coin: ["clay_coin", 0.22], fruit: ["clay_fruit", 0.45], drop: ["clay_drop", 0.7], heart: ["clay_heart", 0.6], juice: ["clay_juice", 0.6],
  hurt: ["clay_hurt", 0.7], stomp: ["clay_stomp", 0.6], break: ["clay_break", 0.45], pot: ["clay_crate", 0.6], friend: ["clay_friend", 0.7], friendLost: ["clay_lost", 0.6],
  checkpoint: ["clay_checkpoint", 0.7], gong: ["clay_gong", 0.85], bounce: ["clay_bounce", 0.6], spring: ["clay_spring", 0.5], swim: ["clay_swim", 0.35],
  splash: ["clay_splash", 0.5], switch: ["clay_switch", 0.6], star: ["clay_star", 0.7],
  fire: ["clay_fire", 0.4], laser: ["clay_laser", 0.3], crusher: ["clay_crusher", 0.45], arrow: ["clay_arrow", 0.4], cannon: ["clay_cannon", 0.4],
  geyser: ["clay_geyser", 0.45], rock: ["clay_rock", 0.35], ice: ["clay_ice", 0.45], bossHit: ["clay_hitdust", 0.32],
  bossRoar: ["clay_roar", 0.7], bossDown: ["clay_bossdown", 0.85], bell: ["clay_bell", 0.9], stretch: ["clay_stretch", 0.6], hover: ["clay_hover", 0.25],
  secretFound: ["clay_drop", 0.4], land: ["clay_land", 0.28],
  // Rain Raid
  bomb: ["clay_bomb_throw", 0.55], boom: ["clay_boom", 0.8], hit: ["clay_hitdust", 0.22], shield: ["clay_shield", 0.4], melt: ["clay_melt", 0.5],
  pickup: ["clay_pickup", 0.75], lostWeapon: ["clay_lost", 0.5], bombs: ["clay_pickup", 0.5], combo: ["clay_combo", 0.6], super: ["clay_super", 0.9], stormFull: ["clay_stormfull", 0.6],
  foeShot: ["clay_foeshot", 0.22], spawn: ["clay_spawn", 0.3], gateClose: ["clay_gate", 0.75], gateOpen: ["clay_door", 0.7], wave: ["clay_alarm", 0.55],
  pumpDown: ["clay_pump", 0.85], cageOpen: ["clay_cage", 0.75], key: ["clay_key", 0.8], doorOpen: ["clay_door", 0.75], wellHit: ["clay_well", 0.5],
  lifeLost: ["clay_life", 0.8], failed: ["clay_life", 0.8], goalDone: ["clay_checkpoint", 0.8],
  // Phase B
  alarm: ["clay_alarm", 0.7], cartHit: ["clay_well", 0.5], huntDown: ["clay_combo", 0.75], aim: ["clay_laser", 0.16],
};
const SHOT_SFX: Record<Weapon, string> = { drizzle: "clay_shot", sprinkler: "clay_shot_spread", downpour: "clay_shot_rapid", hailstone: "clay_shot_hail", thunder: "clay_shot_zap", rainbow: "clay_shot_rainbow", geyser: "clay_shot_geyser" };
/** sounds that fire often play at most this often (seconds) */
const LIMIT: Partial<Record<SimEvent["t"], number>> = { shoot: 0.07, coin: 0.045, hit: 0.06, foeShot: 0.1, melt: 0.05, spawn: 0.15, boom: 0.06, break: 0.05, bossHit: 0.12, cartHit: 0.4, aim: 0.3 };

export class ClaySession {
  sim: Sim; r: ClayRenderer; st: Stage; o: SessionOpts;
  private raf = 0; private last = 0; private acc = 0; private hudT = 0; private paused = false; private finished = false;
  private held: Record<Button, boolean> = { left: false, right: false, up: false, down: false, jump: false, fire: false, bomb: false, super: false };
  private keys = new Set<string>();
  private bot: BotMem = newBotMem();
  private host: HTMLElement; private ro: ResizeObserver;
  private lastSfx = new Map<string, number>();

  constructor(host: HTMLElement, o: SessionOpts) {
    this.host = host; this.o = o;
    this.st = buildStage(o.n);
    this.sim = this.makeSim();
    this.r = new ClayRenderer(host, o.quality);
    if (o.look) this.r.setLook(o.look);
    this.r.load(this.sim);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    // capture phase: Space is "jump" here (the player's own Space-to-pause never sees it); P / Esc still pause
    if (!o.attract) { window.addEventListener("keydown", this.onKey, true); window.addEventListener("keyup", this.onKey, true); window.addEventListener("blur", this.clearInput); }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    // art / QA hook (scripts/build_clay_art.py, the QA scripts)
    if (typeof window !== "undefined") (window as unknown as Record<string, ClaySession>)[o.attract ? "__clayTitle" : "__clayGame"] = this;
  }
  private makeSim() {
    const o = this.o, u = o.up;
    return new Sim(this.st, { hearts: o.hearts, lives: o.lives ?? 3, friend: o.friend, char: o.look?.char, maxBombs: u?.maxBombs, fireMul: u?.fireMul, dmgMul: u?.dmgMul, magnet: u?.magnet, weapon: o.weapon, bombs: o.bombs });
  }

  private resize() { const r = this.host.getBoundingClientRect(); this.r.resize(r.width, r.height); }

  /** the on-screen buttons */
  press(b: Button, down: boolean) { this.held[b] = down; }
  private clearInput = () => { this.keys.clear(); (Object.keys(this.held) as Button[]).forEach((k) => (this.held[k] = false)); };
  private onKey = (e: KeyboardEvent) => {
    const b = KEYS[e.code];
    if (!b) return;
    if (e.code === "Space") e.stopPropagation();
    if (e.type === "keydown") { this.keys.add(e.code); if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault(); }
    else this.keys.delete(e.code);
  };
  private input(): Input {
    if (this.o.attract) return botInput(this.sim, this.bot, 0.9);
    const k = (b: Button) => this.held[b] || [...this.keys].some((c) => KEYS[c] === b);
    // ↑ / W jump too (and climb on vines: the sim climbs instead of jumping when Puddo is on one)
    const inp: Input = { left: k("left"), right: k("right"), up: k("up"), down: k("down"), jump: k("jump") || k("up"), fire: k("fire"), bomb: k("bomb"), super: k("super") };
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
      inp.left ||= ax < -0.4 || !!p.buttons[14]?.pressed; inp.right ||= ax > 0.4 || !!p.buttons[15]?.pressed;
      inp.down ||= ay > 0.5 || !!p.buttons[13]?.pressed; inp.up ||= ay < -0.5 || !!p.buttons[12]?.pressed;
      inp.jump ||= !!p.buttons[0]?.pressed || ay < -0.5; inp.fire ||= !!p.buttons[2]?.pressed || !!p.buttons[7]?.pressed;
      inp.bomb ||= !!p.buttons[1]?.pressed || !!p.buttons[6]?.pressed; inp.super ||= !!p.buttons[3]?.pressed;
    }
    // Easy Run: Puddo runs (and fires) on his own (hold ◀ to go back)
    if (this.o.easyRun && !inp.left && !this.sim.climbing) inp.right = true;
    if (this.o.easyRun) inp.fire = true;
    return inp;
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 12) {
        const inp = this.finished ? NO_INPUT : this.input();
        this.sim.step(inp);
        this.acc -= STEP; n++;
        for (const e of this.sim.events) this.handle(e);
        this.sim.events.length = 0;
        if (this.sim.done && !this.finished) { this.finished = true; if (!this.o.attract) setTimeout(() => this.o.onFinish?.(this.sim.result()), !this.sim.cleared ? 1400 : this.sim.boss ? 2600 : 1500); }
      }
      if (this.o.attract && (this.sim.done || this.sim.t > 70)) this.restartAttract();
    }
    this.r.frame(this.paused ? 0 : dt);
    this.hudT -= dt;
    if (this.hudT <= 0 && this.o.onHud) { this.hudT = 0.08; this.o.onHud(this.sim.hud()); }
  };
  private restartAttract() {
    this.sim = new Sim(this.st, { hearts: 3, char: this.o.look?.char }); this.bot = newBotMem(); this.finished = false; this.r.load(this.sim);
  }
  private handle(e: SimEvent) {
    this.r.onEvent(e);
    if (this.o.attract) return;
    const lim = LIMIT[e.t];
    if (lim) { const k = e.t, last = this.lastSfx.get(k) ?? -1; if (this.sim.t - last < lim) { this.o.onEvent?.(e, this.sim); return; } this.lastSfx.set(k, this.sim.t); }
    const s = e.t === "shoot" ? ([SHOT_SFX[e.w], e.w === "downpour" ? 0.16 : 0.22] as [string, number]) : SFX[e.t];
    if (s) {
      let gain = s[1];
      if (e.t === "land" && !e.hard) gain *= 0.5;
      if (e.t === "boom" && e.r < 2) gain *= 0.6;
      audio.play(`a:${s[0]}` as Sound, { gain, rate: e.t === "coin" ? 0.95 + Math.random() * 0.12 : e.t === "shoot" || e.t === "melt" ? 0.94 + Math.random() * 0.12 : 1, duck: !["coin", "jump", "land", "shoot", "hit", "melt", "foeShot"].includes(e.t), pan: Math.max(-0.5, Math.min(0.5, (this.sim.x - this.r.camera.position.x) / 12)) });
    }
    if (e.t === "hurt" || e.t === "lifeLost") this.buzz(40);
    if (e.t === "stomp" || e.t === "boom") this.buzz(18);
    if (e.t === "gong" || e.t === "bell" || e.t === "super") this.buzz(60);
    // the hero's voice: Puddo's own (sfx_clay_puddo_*), or the guest's character voice
    const who = this.o.look?.char ?? "puddo";
    const voice = (mood: "sad" | "wow" | "happy") => (who === "puddo" ? `a:clay_puddo_${mood}` : `v:${who}_${mood}`) as Sound;
    if (e.t === "hurt") audio.play(voice("sad"), { gain: 0.45, delay: 0.05 });
    if (e.t === "drop" || e.t === "friend" || e.t === "pickup" || e.t === "super") audio.play(voice("wow"), { gain: 0.4, delay: 0.1 });
    if (e.t === "gong" || e.t === "bell" || e.t === "goalDone") audio.play(voice("happy"), { gain: 0.55, delay: 0.35 });
    if (e.t === "bossRoar" || e.t === "gateClose") audio.play("v:kranky_laugh", { gain: 0.3, delay: 0.2 });
    this.o.onEvent?.(e, this.sim);
  }
  private buzz(ms: number) { if (this.o.vibrate && typeof navigator !== "undefined" && navigator.vibrate) { try { navigator.vibrate(ms); } catch { /* blocked */ } } }

  pause(p: boolean) { this.paused = p; if (p) this.clearInput(); this.last = performance.now(); }
  setEasyRun(v: boolean) { this.o.easyRun = v; }
  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener("keydown", this.onKey, true); window.removeEventListener("keyup", this.onKey, true); window.removeEventListener("blur", this.clearInput);
    this.r.dispose();
  }
}
