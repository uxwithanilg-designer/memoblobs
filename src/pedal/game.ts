// Obby Bike Blaster: the game. A pixel rider on a BMX rides a long obstacle course in the sky — narrow bridges, gaps,
// ramps, kill blocks, moving and falling platforms, spinners, hammers, ice, belts, jelly bounces and laser gates —
// with a blaster on the handlebar to shoot targets that open bridges, crate walls in the way and gremlins that try to
// knock you off. Checkpoint pads keep your place (and your save); a fall costs a life and puts you back on the last
// checkpoint; running out of lives sends you back to the start of the sector. Chain oil keeps the bike fast: grab the
// cans before it runs dry.
//
// Flow, with no menus between levels: a cinematic fly-over of the course → ride → the finish line in slow motion → a
// victory orbit with fireworks → the camera rises → the next level → "Level N started!" → ride, forever.
import * as THREE from "three";
import type { Quality } from "@/lib/perf";
import { autoQuality, isPhone } from "@/lib/perf";
import { buildCourse, levelPlan, MOD_LABEL, moveAt, PATTERN_LABEL, PATTERN_TIP, sectorOf, type Course, type LevelPlan, type Piece, type PickupKind } from "./course";
import { bikeOf, POWERS, POWER_IDS, statsFor, type BikeId, type Levels, type PowerId } from "./gear";
import { newPose, poseBike, poseGremlin, poseRider, RIDERS, RigBatch } from "./models";
import { Bike, CourseWorld, type BikeInput } from "./physics";
import { Ambience, ear, sfx, sfxAt } from "./sound";
import { View } from "./render";
import { LEVELS_PER_WORLD, WORLDS, type World } from "./worlds";
import { angleTo, clamp, damp, lerp, rgb, smooth } from "./util";

export type Mode = "attract" | "intro" | "play" | "crash" | "finish" | "travel";
export interface Hud {
  level: number; codename: string; world: string; accent: string; remix: boolean; mods: string[]; finale: boolean;
  section: number; sections: number; sector: number; sectors: number; progress: number; part: string;
  oil: number; lowOil: boolean; coins: number; lives: number; speed: number;
  powers: { id: PowerId; left: number; secs: number }[]; mode: Mode; time: number;
}
export interface LevelStats { level: number; time: number; coins: number; falls: number; gremlins: number; stars: number; worldDone: boolean; bonus: number }
export type GameEvent =
  | { k: "intro"; plan: LevelPlan; next: boolean; resume: boolean }
  | { k: "go" }
  | { k: "checkpoint"; section: number; sections: number; tip?: string }
  | { k: "sector"; sector: number; sectors: number }
  | { k: "crash"; why: "fall" | "hit" | "gremlin"; livesLeft: number; saved: boolean }
  | { k: "outOfLives"; sector: number }
  | { k: "finish"; stats: LevelStats }
  | { k: "pickup"; what: PickupKind }
  | { k: "power"; id: PowerId }
  | { k: "target" } | { k: "crates" } | { k: "gremlin" }
  | { k: "lowOil" } | { k: "air"; secs: number }
  | { k: "hint"; text: string };

interface Opts {
  bike: BikeId; levels: Levels; rider: string; lives: number; coins: number; autoPedal: boolean;
  onHud: (h: Hud) => void; onEvent: (e: GameEvent) => void; onCoins: (n: number) => void; onLives: (n: number) => void; onCheckpoint: (level: number, cp: number) => void;
}
interface Drop { kind: PickupKind; x: number; y: number; z: number; t: number; alive: boolean; section: number }
interface Grem { x0: number; y0: number; z0: number; x: number; y: number; z: number; amp: number; speed: number; phase: number; alive: boolean; t: number }

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _dir = new THREE.Vector3();

export class Game {
  readonly view: View;
  private host: HTMLElement; private o: Opts;
  private raf = 0; private last = 0; private running = false;
  level = 1; plan!: LevelPlan; course!: Course; cw!: CourseWorld; world!: World;
  mode: Mode = "attract"; private modeT = 0;
  readonly bike = new Bike();
  private stats: ReturnType<typeof statsFor>; private bikeId: BikeId; private levels: Levels;
  private riderB: RigBatch | null = null; private bikeB: RigBatch | null = null; private gremB: RigBatch | null = null;
  private riderPose = newPose("rider"); private bikePose = newPose("bike"); private gremPose = newPose("gremlin");
  coins: number; lives: number; oil = 100;
  private autoPedal: boolean; private touch = isPhone();
  // input
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 }; private jumpBuf = 0; private tipped = new Set<string>(); private firing = false; private fireCd = 0;
  // level state
  private dynamic: Piece[] = [];
  drops: Drop[] = [];
  private grems: Grem[] = [];
  powers = new Map<PowerId, number>();
  section = -1; private sectorStart = -1; private time = 0; private falls = 0; private gremKills = 0; private coinsAtStart = 0;
  private respawnAt = { x: 0, y: 0, z: 0 }; private inv = 0; private crashAt = { x: 0, y: 0, z: 0 };
  /** the traps' clock (slower with Slow-mo) */
  private trapT = 0;
  private G = { y: 0, p: null as Piece | null };
  private grav = 24; private timeScale = 1; private slowT = 0; private slowTo = 1;
  private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3(); private camYaw = 0; private cine = 0; private cineSide = 1;
  private lowOilSaid = false; private hudT = 0; private tickT = 0; private rollT = 0; private ambience = new Ambience();
  private ro: ResizeObserver;

  constructor(host: HTMLElement, o: Opts, quality: Quality = autoQuality()) {
    this.host = host; this.o = o;
    this.bikeId = o.bike; this.levels = o.levels; this.stats = statsFor(o.bike, o.levels);
    this.coins = o.coins; this.lives = Math.max(1, o.lives); this.autoPedal = o.autoPedal;
    this.view = new View(host, quality);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.setLooks(o.rider, o.bike);
    (window as unknown as { __obbybike?: Game }).__obbybike = this;
  }
  private resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.view.resize(w, h);
    this.view.camera.fov = h > w ? 74 : 60;
    this.view.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ settings
  setLooks(rider: string, bike: BikeId) {
    this.riderB?.dispose(); this.bikeB?.dispose();
    const look = (RIDERS.find((r) => r.id === rider) ?? RIDERS[0]).look;
    this.riderB = new RigBatch("rider", look, "#000000", 1, 5); this.riderB.addTo(this.view.scene);
    this.bikeB = new RigBatch("bike", look, bikeOf(bike).frame, 1, 6); this.bikeB.addTo(this.view.scene);
  }
  setBike(bike: BikeId, levels: Levels, rider: string) { this.bikeId = bike; this.levels = levels; this.stats = statsFor(bike, levels); this.setLooks(rider, bike); }
  setLevels(levels: Levels) { this.levels = levels; this.stats = statsFor(this.bikeId, levels); }
  setAutoPedal(on: boolean) { this.autoPedal = on; }
  setStick(x: number, y: number) { this.stick.x = clamp(x, -1, 1); this.stick.y = clamp(y, -1, 1); }
  /** a tap a moment before landing still jumps (a short buffer) */
  jump() { this.jumpBuf = 0.14; }
  setFire(on: boolean) { this.firing = on; }
  skipIntro() { if (this.mode === "intro" && this.modeT > 0.4) this.modeT = 99; }
  private onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (this.mode === "play" && ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (k === " " && !e.repeat) this.jumpBuf = 0.14;
    if ((k === "f" || k === "j" || k === "enter") && !e.repeat) this.firing = true;
    this.keys.add(k);
  };
  private onKeyUp = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); this.keys.delete(k); if (k === "f" || k === "j" || k === "enter") this.firing = false; };
  private onBlur = () => { this.keys.clear(); this.firing = false; };

  // ------------------------------------------------------------------ loop
  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.firing = false; }

  // ------------------------------------------------------------------ levels
  /** load level n; start at checkpoint `cp` (−1: the start pad) */
  load(n: number, mode: "attract" | "intro", cp = -1, next = false) {
    this.level = n;
    this.plan = levelPlan(n);
    this.world = WORLDS.find((w) => w.id === this.plan.world)!;
    this.course = buildCourse(this.plan);
    this.cw = new CourseWorld(this.course);
    this.view.setLevel(this.plan, this.course);
    this.grav = this.world.gravity * (this.plan.mods.includes("lowgrav") && this.world.id !== "moon" ? 0.6 : 1);
    this.dynamic = this.course.pieces.filter((p) => p.move || p.spin || p.kind === "fall" || p.kind === "bridge" || p.kind === "crate" || p.kind === "target" || p.kind === "laser" || p.kind === "belt");
    this.drops = this.course.pickups.map((p) => ({ ...p, t: Math.random() * 6, alive: true }));
    this.grems = this.course.gremlins.map((g) => ({ x0: g.x, y0: g.y, z0: g.z, x: g.x, y: g.y, z: g.z, amp: g.amp, speed: g.speed, phase: g.phase, alive: true, t: 0 }));
    this.gremB?.dispose();
    this.gremB = new RigBatch("gremlin", RIDERS[0].look, this.world.accent, Math.max(1, this.grems.length), 9); this.gremB.addTo(this.view.scene);
    this.powers.clear();
    this.time = 0; this.falls = 0; this.gremKills = 0; this.coinsAtStart = this.coins; this.lowOilSaid = false;
    this.oil = this.stats.oil;
    cp = Math.min(cp, this.course.checkpoints.length - 1);
    this.section = cp; this.sectorStart = cp < 0 ? -1 : sectorOf(cp + 1) * 6 - 1;
    if (this.sectorStart >= cp) this.sectorStart = cp;
    // what's behind the checkpoint is collected and done
    if (cp >= 0) for (const d of this.drops) if (d.section <= cp) d.alive = false;
    const at = cp >= 0 ? this.course.checkpoints[cp] : this.course.start;
    this.respawnAt = { x: at.x, y: at.y, z: at.z };
    this.bike.place(at.x, at.y, at.z, 0);
    this.camYaw = 0;
    this.ambience.set(this.world.ambient);
    this.mode = mode; this.modeT = 0; this.timeScale = 1; this.slowT = 0; this.cine = 0; this.inv = 0;
    this.view.flagsReached(this.section + 1);
    if (mode === "intro") { this.o.onEvent({ k: "intro", plan: this.plan, next, resume: cp >= 0 }); sfx("levelStart"); }
    this.placeCamera();
    this.emitHud();
  }
  play() { if (this.mode === "attract") { this.mode = "intro"; this.modeT = 0; this.o.onEvent({ k: "intro", plan: this.plan, next: false, resume: this.section >= 0 }); sfx("levelStart"); } }
  restartLevel() { this.load(this.level, "intro"); }
  private slow(to: number, secs: number) { this.slowTo = to; this.slowT = secs; }

  // ------------------------------------------------------------------ the frame
  frame(rawDt: number) {
    this.slowT -= rawDt;
    if (this.slowT <= 0) this.slowTo = 1;
    this.timeScale = damp(this.timeScale, this.slowTo, this.slowTo < 1 ? 0.05 : 0.2, rawDt);
    const dt = rawDt * this.timeScale;
    this.modeT += rawDt;
    if (this.mode === "play") this.time += dt;
    // traps move (slower with Slow-mo)
    this.trapT += dt * (this.powers.has("slowmo") ? 0.45 : 1);
    this.updatePieces(dt * (this.powers.has("slowmo") ? 0.45 : 1));
    this.updateBike(dt);
    this.updateGremlins(dt * (this.powers.has("slowmo") ? 0.5 : 1));
    this.updateDrops(dt);
    if (this.mode === "play") { this.hazards(dt); this.blaster(dt); this.updatePowers(dt); }
    this.flow();
    this.updateCamera(rawDt);
    const cam = this.view.camera;
    ear.x = cam.position.x; ear.y = cam.position.y; ear.z = cam.position.z;
    cam.getWorldDirection(_dir); ear.rx = -_dir.z; ear.rz = _dir.x;
    if (this.mode !== "attract") this.ambience.update(rawDt);
    this.draw();
    this.view.render(dt, this.grav, this.cw);
    this.hudT -= rawDt;
    if (this.hudT <= 0) { this.hudT = 0.12; this.emitHud(); }
  }

  private updatePieces(dt: number) {
    const t = this.trapT;
    for (const p of this.dynamic) {
      if (p.move && p.kind !== "laser") {
        const v = moveAt(p.move, t);
        if (p.move.ax === 0) p.dx = v; else if (p.move.ax === 1) p.dy = v; else p.dz = v;
      }
      if (p.kind === "laser" && p.move) p.on = Math.sin((t / p.move.period) * Math.PI * 2 + p.move.phase) > -0.15;
      if (p.kind === "fall" && p.t > 0) {
        p.t += dt;
        if (p.t > 0.55) p.dy -= dt * (6 + (p.t - 0.55) * 22);
        if (p.t > 5) { p.t = 0; p.dy = 0; }
      }
      if (p.kind === "bridge" && !p.on && p.t > -50 && p.hp === 99) { p.t += dt * 4; if (p.t >= 1) { p.on = true; p.t = 1; } }
    }
  }
  /** a spinner's angle now, a hammer's swing */
  private angleOf(p: Piece) {
    const s = p.spin!, t = this.trapT;
    return s.swing ? Math.sin(t * s.speed + s.phase) * 1.05 : s.phase + t * s.speed;
  }

  // ------------------------------------------------------------------ the bike
  private updateBike(dt: number) {
    const b = this.bike;
    if (this.mode === "crash" || this.mode === "attract") return;
    let steer = this.stick.x, thr = this.stick.y;
    if (this.keys.has("a") || this.keys.has("arrowleft")) steer -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) steer += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) thr += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) thr -= 1;
    const playing = this.mode === "play";
    if (playing && this.touch && this.autoPedal && this.stick.y > -0.3) thr = Math.max(thr, 1);
    if (!playing) { steer = 0; thr = this.mode === "finish" ? 0.3 : 0; }
    const inp: BikeInput = { throttle: clamp(thr, -1, 1), steer: clamp(steer, -1, 1), jump: playing && this.jumpBuf > 0 };
    const st = this.stats;
    const turbo = this.powers.has("turbo");
    const speed = (turbo ? st.speed + 5 : st.speed) * (this.plan.mods.includes("turbo") ? 1.06 : 1);
    b.step(dt, inp, this.cw, { speed, accel: st.accel * (turbo ? 1.6 : 1), jump: st.jump, grip: st.grip, turn: st.turn }, this.grav, this.powers.has("wings") ? 2 : 1, this.oil <= 0);
    const ev = b.ev;
    this.jumpBuf = ev.jump || !playing ? 0 : Math.max(0, this.jumpBuf - dt);
    if (ev.jump) sfx(ev.double ? "wings" : "jump", { rate: 0.95 + Math.random() * 0.1 });
    if (ev.land > 0.1) {
      if (ev.land > 12) { sfx("landHard"); this.view.debris.smoke(b.x, b.y, b.z, 4, 0.85, 0.4); }
      else if (ev.land > 4) sfx("land", { gain: Math.min(1, ev.land / 10) });
      if (b.airT > 0.9 && this.mode === "play") this.o.onEvent({ k: "air", secs: b.airT });
    }
    if (ev.bounce) { sfx("bounce"); this.view.sparks.burst(b.x, b.y + 0.2, b.z, 12, 1, 0.5, 0.9, 4, 0.1, 0.4, 2); this.startCine(); }
    if (ev.boost) { sfx("boost"); this.startCine(); }
    if (ev.wall) sfx("wall");
    ev.jump = false; ev.double = false; ev.land = 0; ev.bounce = false; ev.boost = false; ev.wall = false;
    // a long jump off a ramp: the camera swings to the side in slow motion
    if (!b.onGround && b.airT > 0.12 && b.airT < 0.15 && b.vy > 6.5 && this.mode === "play") this.startCine();
    // chain oil: runs down while you pedal
    if (playing && Math.abs(b.speed) > 2 && thr > 0) {
      this.oil = Math.max(0, this.oil - dt * 1.5);
      if (this.oil / this.stats.oil < 0.2 && !this.lowOilSaid) { this.lowOilSaid = true; this.o.onEvent({ k: "lowOil" }); sfx("lowOil"); }
    }
    // sounds of the ride: tyre roll, freewheel ticks, a squeaky dry chain
    const sp = Math.abs(b.speed);
    if (playing && b.onGround && sp > 2) {
      this.rollT -= dt; if (this.rollT <= 0) { this.rollT = 0.32; sfx("roll", { gain: Math.min(1, sp / 12), rate: 0.85 + sp * 0.03 }); }
      if (thr <= 0.05) { this.tickT -= dt; if (this.tickT <= 0) { this.tickT = 0.09; sfx("tick", { rate: 0.9 + Math.random() * 0.2 }); } }
      if (this.oil <= 0 && Math.random() < dt * 2) sfx("squeak");
    }
    // checkpoints and the finish
    const g = b.onGround ? b.ground : null;
    if (g && this.mode === "play") {
      if (g.kind === "cp" && g.section > this.section) this.reachCheckpoint(g.section);
      if (g.kind === "finish") this.finishLevel();
      if (g.kind === "fall" && g.t === 0) { g.t = 0.001; sfxAt("crate", g.x0, g.y1, g.z0, { rate: 1.4, gain: 0.5 }); }
    }
    if (playing && b.y < this.course.minY - 14) this.crash("fall");
  }
  private startCine() { if (this.cine <= 0) { this.cine = 1.4; this.cineSide = Math.random() < 0.5 ? -1 : 1; this.slow(0.55, 0.7); } }
  private reachCheckpoint(s: number) {
    this.section = s;
    const c = this.course.checkpoints[s];
    if (c) this.respawnAt = { x: c.x, y: c.y, z: c.z };
    this.o.onCheckpoint(this.level, s);
    this.view.flagsReached(s + 1);
    sfx("checkpoint");
    if (c) this.view.sparks.burst(c.x + 2.2, c.y + 2.4, c.z, 20, 0.4, 1, 0.6, 5, 0.12, 0.6, 3);
    if ((s + 1) % 6 === 0) { this.sectorStart = s; this.o.onEvent({ k: "sector", sector: (s + 1) / 6, sectors: Math.ceil(this.course.sections / 6) }); sfx("sector", { delay: 0.2 }); }
    else this.o.onEvent({ k: "checkpoint", section: s + 1, sections: this.course.sections, tip: this.tipFor(s + 1) });
  }
  /** a one-line tip the first time (this session) you meet a tricky part */
  private tipFor(section: number) {
    const pat = this.course.patterns[section];
    if (!pat || !PATTERN_TIP[pat] || this.tipped.has(pat)) return undefined;
    this.tipped.add(pat);
    return PATTERN_TIP[pat];
  }

  // ------------------------------------------------------------------ crashes
  private hazards(dt: number) {
    const b = this.bike;
    if (this.inv > 0) { this.inv -= dt; return; }
    const l = this.cw.near(b.z);
    if (!l) return;
    for (const p of l) {
      if (p.kind === "kill" || (p.kind === "laser" && p.on)) {
        if (b.x > p.x0 + p.dx - 0.25 && b.x < p.x1 + p.dx + 0.25 && b.z > p.z0 + p.dz - 0.35 && b.z < p.z1 + p.dz + 0.35 && b.y + 1.2 > p.y0 + p.dy && b.y < p.y1 + p.dy - 0.05) { this.crash("hit"); return; }
      } else if (p.kind === "spinner") {
        const a = this.angleOf(p), s = p.spin!, dx = b.x - s.cx, dz = b.z - s.cz;
        const lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
        if (Math.abs(lx) < s.len / 2 && Math.abs(lz) < 0.6 && b.y < s.cy + 0.25 && b.y > s.cy - 1.4) { this.crash("hit"); return; }
      } else if (p.kind === "hammer") {
        const a = this.angleOf(p), s = p.spin!;
        const hx = s.cx + Math.sin(a) * s.len, hy = s.cy - Math.cos(a) * s.len, hz = s.cz;
        if (Math.abs(b.x - hx) < 1.1 && Math.abs(b.y + 0.8 - hy) < 1.3 && Math.abs(b.z - hz) < 1.1) { this.crash("hit"); return; }
      }
    }
  }
  private crash(why: "fall" | "hit" | "gremlin") {
    if (this.mode !== "play") return;
    const b = this.bike;
    if (this.powers.has("shield")) {
      // the bubble pops and saves you: straight back to the checkpoint (a fall) or a bounce (a hit)
      this.powers.delete("shield");
      sfx("shieldPop");
      this.view.sparks.burst(b.x, b.y + 1, b.z, 16, 0.5, 1, 1, 5, 0.12, 0.4, 0);
      this.o.onEvent({ k: "crash", why, livesLeft: this.lives, saved: true });
      if (why === "fall") this.respawn(); else { this.inv = 1.2; b.speed = -3; }
      return;
    }
    this.falls++;
    this.lives = Math.max(0, this.lives - 1);
    this.o.onLives(this.lives);
    this.crashAt = { x: b.x, y: Math.max(b.y, this.course.minY - 6), z: b.z };
    sfx(why === "fall" ? "fall" : "crash");
    if (why !== "fall") {
      const look = this.riderLook();
      this.view.debris.burst(b.x, b.y + 0.9, b.z, 14, look[0], look[1], look[2], 5, 0.14);
      this.view.debris.burst(b.x, b.y + 0.5, b.z, 8, 0.25, 0.75, 1, 4, 0.12);
    }
    this.mode = "crash"; this.modeT = 0;
    this.slow(0.35, 0.6);
    if (this.lives > 0) this.o.onEvent({ k: "crash", why, livesLeft: this.lives, saved: false });
    else this.o.onEvent({ k: "outOfLives", sector: Math.max(0, sectorOf(this.section + 1)) + 1 });
  }
  private riderLook() { const c = rgb((RIDERS.find((r) => r.id === this.o.rider) ?? RIDERS[0]).look.b); return [c[0] / 255, c[1] / 255, c[2] / 255]; }
  private respawn() {
    const at = this.respawnAt;
    this.bike.place(at.x, at.y, at.z, 0);
    this.camYaw = 0; this.inv = 1.2;
    sfx("respawn");
    this.view.sparks.burst(at.x, at.y + 1, at.z, 16, 0.6, 0.9, 1, 3, 0.12, 0.5, -1);
    // falling tiles come back
    for (const p of this.dynamic) if (p.kind === "fall") { p.t = 0; p.dy = 0; }
  }

  // ------------------------------------------------------------------ the blaster
  private blaster(dt: number) {
    this.fireCd -= dt;
    if (!this.firing || this.fireCd > 0) return;
    const rapid = this.powers.has("rapid");
    this.fireCd = 1 / (this.stats.fireRate * (rapid ? 2.4 : 1));
    const b = this.bike, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    const mx = b.x + fx * 0.9, my = b.y + 1.05, mz = b.z + fz * 0.9;
    // aim help: the nearest target, crate or gremlin within a cone ahead
    let tx = mx + fx * 30, ty = my + 0.3, tz = mz + fz * 30, best = 0.42, hit: Piece | Grem | null = null;
    const consider = (x: number, y: number, z: number, who: Piece | Grem) => {
      const dx = x - mx, dy = y - my, dz = z - mz, d = Math.hypot(dx, dy, dz);
      if (d < 1 || d > 34) return;
      const a = Math.acos(clamp((dx * fx + dz * fz) / Math.max(0.01, Math.hypot(dx, dz)), -1, 1));
      if (a < best) { best = a; tx = x; ty = y; tz = z; hit = who; }
    };
    for (let k = -1; k <= 8; k++) {
      const l = this.cw.near(b.z + k * 4);
      if (!l) continue;
      for (const p of l) if ((p.kind === "target" || p.kind === "crate") && p.on) consider((p.x0 + p.x1) / 2 + p.dx, (p.y0 + p.y1) / 2 + p.dy, (p.z0 + p.z1) / 2 + p.dz, p);
    }
    for (const g of this.grems) if (g.alive) consider(g.x, g.y, g.z, g);
    const look = (RIDERS.find((r) => r.id === this.o.rider) ?? RIDERS[0]).look;
    const [r, g2, bl] = rgb(look.glow).map((v) => v / 255);
    this.view.tracers.add(mx, my, mz, tx, ty, tz, r, g2, bl, 0.08);
    this.view.sparks.flash(mx, my, mz, 0.35, r, g2, bl, 0.06);
    sfx("shoot", { rate: (rapid ? 1.1 : 1) * (0.94 + Math.random() * 0.12) });
    const h = hit as Piece | Grem | null;
    if (!h) return;
    if ("kind" in h) {
      if (h.kind === "target") { h.on = false; this.openBridge(h.group ?? -1); this.view.sparks.burst(tx, ty, tz, 24, 1, 0.9, 0.3, 6, 0.14, 0.6, 3); sfxAt("targetHit", tx, ty, tz); this.addCoins(3); this.o.onEvent({ k: "target" }); }
      else if (h.kind === "crate") {
        h.hp--;
        this.view.sparks.burst(tx, ty, tz, 4, 1, 0.8, 0.5, 3, 0.07, 0.2, 5);
        if (h.hp <= 0) { h.on = false; this.view.debris.burst(tx, ty, tz, 8, 0.7, 0.48, 0.27, 4, 0.18); sfxAt("crate", tx, ty, tz); if (Math.random() < 0.35) this.dropCoin(tx, ty, tz); }
      }
    } else {
      h.alive = false; this.gremKills++;
      this.view.debris.burst(h.x, h.y, h.z, 12, 0.55, 0.35, 0.9, 5, 0.12);
      this.view.sparks.burst(h.x, h.y, h.z, 14, 1, 0.5, 1, 5, 0.1, 0.5, 2);
      sfxAt("gremlinPop", h.x, h.y, h.z);
      this.addCoins(this.plan.mods.includes("gold") ? 6 : 3);
      this.o.onEvent({ k: "gremlin" });
    }
  }
  private openBridge(group: number) {
    let z0 = Infinity;
    for (const p of this.dynamic) if (p.kind === "bridge" && p.group === group) z0 = Math.min(z0, p.z0);
    // the planks fold out one after another, from your side
    for (const p of this.dynamic) if (p.kind === "bridge" && p.group === group) { p.hp = 99; p.t = -(p.z0 - z0) * 0.08; }
    sfx("bridge", { delay: 0.15 });
  }
  private dropCoin(x: number, y: number, z: number) { this.drops.push({ kind: "coin", x, y: y - 0.5, z, t: 0, alive: true, section: this.section + 1 }); }

  // ------------------------------------------------------------------ gremlins
  private updateGremlins(dt: number) {
    const b = this.bike;
    for (const g of this.grems) {
      if (!g.alive) continue;
      g.t += dt;
      if (Math.abs(g.z0 - b.z) > 60) continue;
      g.x = g.x0 + Math.sin(g.t * g.speed + g.phase) * g.amp;
      g.y = g.y0 + Math.sin(g.t * 2.3 + g.phase) * 0.4;
      // they drift toward you when you're close
      g.z = g.z0 + clamp((b.z - g.z0) * 0.15, -1.5, 1.5);
      if (this.mode === "play" && this.inv <= 0 && Math.abs(g.x - b.x) < 0.8 && Math.abs(g.z - b.z) < 0.8 && Math.abs(g.y - (b.y + 1)) < 1) { this.crash("gremlin"); return; }
      if (Math.random() < dt * 0.3) sfxAt("gremlin", g.x, g.y, g.z, { gain: 0.6 });
    }
  }

  // ------------------------------------------------------------------ pickups and powers
  private updateDrops(dt: number) {
    const b = this.bike, mag = this.powers.has("magnet") ? 6 : 1.4;
    for (const d of this.drops) {
      if (!d.alive) continue;
      d.t += dt;
      if (this.mode !== "play") continue;
      const dx = b.x - d.x, dy = b.y + 0.8 - d.y, dz = b.z - d.z;
      if (Math.abs(dz) > mag + 2) continue;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < mag) { const k = Math.min(1, dt * 10); d.x += dx * k; d.y += dy * k; d.z += dz * k; }
      if (dist < 1.1) { d.alive = false; this.collect(d.kind, d.x, d.y, d.z); }
    }
  }
  private collect(kind: PickupKind, x: number, y: number, z: number) {
    switch (kind) {
      case "coin": this.addCoins(this.plan.mods.includes("gold") ? 2 : 1); sfx("coin", { rate: 0.95 + Math.random() * 0.15 }); this.view.sparks.burst(x, y, z, 3, 1, 0.85, 0.3, 2, 0.06, 0.25, 0); return;
      case "gem": this.addCoins(15); sfx("gem"); break;
      case "oil": this.oil = Math.min(this.stats.oil, this.oil + this.stats.oil * 0.5); this.lowOilSaid = false; sfx("oil"); break;
      case "heart": this.lives = Math.min(9, this.lives + 1); this.o.onLives(this.lives); sfx("heart"); break;
      case "power": { const id = POWER_IDS[Math.floor(Math.random() * POWER_IDS.length)]; this.givePower(id); break; }
    }
    this.view.sparks.burst(x, y, z, 10, 1, 1, 0.8, 4, 0.1, 0.4, 0);
    this.o.onEvent({ k: "pickup", what: kind });
  }
  givePower(id: PowerId) { this.powers.set(id, POWERS[id].secs); sfx(id === "shield" ? "shield" : id === "wings" ? "wings" : "power"); this.o.onEvent({ k: "power", id }); }
  private addCoins(n: number) { this.coins += n; this.o.onCoins(this.coins); }
  private updatePowers(dt: number) { for (const [id, left] of this.powers) { const l = left - dt; if (l <= 0) this.powers.delete(id); else this.powers.set(id, l); } }

  // ------------------------------------------------------------------ flow
  private finishLevel() {
    this.mode = "finish"; this.modeT = 0;
    this.firing = false;
    this.slow(0.3, 1.0);
    sfx("finish");
    const f = this.course.finish;
    const bonus = 20 + Math.floor(this.level / 3) + (this.plan.finale ? 200 : 0);
    this.addCoins(bonus);
    const stars = this.falls === 0 ? 3 : this.falls <= 3 ? 2 : 1;
    const worldDone = !this.plan.remix && this.plan.local === LEVELS_PER_WORLD;
    this.o.onEvent({ k: "finish", stats: { level: this.level, time: this.time, coins: this.coins - this.coinsAtStart, falls: this.falls, gremlins: this.gremKills, stars, worldDone, bonus } });
    for (let k = 0; k < 6; k++) setTimeout(() => this.view.sparks.burst(f.x + (Math.random() - 0.5) * 10, f.y + 6 + Math.random() * 5, f.z + (Math.random() - 0.5) * 6, 30, Math.random(), Math.random(), 1, 9, 0.18, 1, 3), 300 + k * 380);
  }
  private flow() {
    const t = this.modeT;
    if (this.mode === "intro" && t > 3.6) { this.mode = "play"; this.modeT = 0; this.o.onEvent({ k: "go" }); sfx("go"); if (this.plan.mods.length) this.o.onEvent({ k: "hint", text: this.plan.mods.map((m) => MOD_LABEL[m]).join(" · ") }); }
    if (this.mode === "crash" && t > 1.4) {
      if (this.lives <= 0) {
        // out of lives: back to the start of this sector with a fresh set
        this.lives = 3; this.o.onLives(3);
        this.section = this.sectorStart;
        const c = this.sectorStart >= 0 ? this.course.checkpoints[this.sectorStart] : this.course.start;
        this.respawnAt = { x: c.x, y: c.y, z: c.z };
        this.view.flagsReached(this.section + 1);
      }
      this.respawn();
      this.mode = "play"; this.modeT = 0;
    }
    if (this.mode === "finish" && t > 4.4) { this.mode = "travel"; this.modeT = 0; sfx("whoosh"); }
    if (this.mode === "travel" && t > 1.1) this.load(this.level + 1, "intro", -1, true);
  }

  // ------------------------------------------------------------------ the camera
  private chasePose(pos: THREE.Vector3, look: THREE.Vector3, yaw: number) {
    const b = this.bike, { w, h } = this.view.size, portrait = h > w;
    const dist = portrait ? 6.4 : 5.4, up = portrait ? 3.0 : 2.5;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    pos.set(b.x - fx * dist, b.y + up, b.z - fz * dist);
    look.set(b.x + fx * 5, b.y + 0.9, b.z + fz * 5);
  }
  private placeCamera() { this.chasePose(this.camPos, this.camLook, this.bike.yaw); this.view.camera.position.copy(this.camPos); this.view.camera.lookAt(this.camLook); }
  /** art and checks: a fixed camera (position, then the point it looks at) */
  photoCam: [number, number, number, number, number, number] | null = null;
  private updateCamera(dt: number) {
    const cam = this.view.camera, b = this.bike, C = this.course;
    if (this.photoCam) { const c = this.photoCam; cam.position.set(c[0], c[1], c[2]); cam.lookAt(c[3], c[4], c[5]); return; }
    this.camYaw += angleTo(this.camYaw, b.yaw) * Math.min(1, dt * 3.2);
    switch (this.mode) {
      case "attract": {
        // drift along the first stretch of the course, high and to the side
        const k = (this.view.t * 0.05) % 1, z = C.start.z + 10 + k * 70;
        cam.position.set(C.start.x + 16 + Math.sin(this.view.t * 0.2) * 6, C.start.y + 10, z - 12);
        cam.lookAt(C.start.x, C.start.y + 1, z + 8);
        return;
      }
      case "intro": {
        // a fly-over: from high above the course ahead, sweeping back to behind the rider
        const k = smooth(Math.min(1, this.modeT / 3.6));
        this.chasePose(_v, _v2, b.yaw);
        const far = Math.min(C.length * 0.5, 160);
        const ox = b.x + Math.sin(k * 2.5) * 22, oy = b.y + lerp(34, 8, k), oz = b.z + lerp(far, 10, k);
        const lx = b.x, ly = b.y, lz = b.z + lerp(far * 0.6, 4, k);
        const blend = smooth(clamp((k - 0.62) / 0.38, 0, 1));
        cam.position.set(lerp(ox, _v.x, blend), lerp(oy, _v.y, blend), lerp(oz, _v.z, blend));
        this.camLook.set(lerp(lx, _v2.x, blend), lerp(ly, _v2.y, blend), lerp(lz, _v2.z, blend));
        cam.lookAt(this.camLook);
        this.camPos.copy(cam.position);
        return;
      }
      case "crash": {
        _v.set(this.crashAt.x - Math.sin(this.camYaw) * 7, this.crashAt.y + 5, this.crashAt.z - Math.cos(this.camYaw) * 7);
        cam.position.lerp(_v, Math.min(1, dt * 2));
        cam.lookAt(this.crashAt.x, this.crashAt.y, this.crashAt.z);
        return;
      }
      case "finish": {
        const a = this.camYaw + 0.6 + this.modeT * 0.6;
        _v.set(b.x + Math.sin(a) * 5.5, b.y + 2.2, b.z + Math.cos(a) * 5.5);
        cam.position.lerp(_v, Math.min(1, dt * 3));
        cam.lookAt(b.x, b.y + 1.1, b.z);
        return;
      }
      case "travel": {
        cam.position.y += dt * (14 + this.modeT * 40);
        cam.lookAt(b.x, b.y, b.z);
        return;
      }
      default: {
        this.chasePose(_v, _v2, this.camYaw);
        if (this.cine > 0) {
          // the side shot for a big jump: out to the side, looking at the rider, then back
          this.cine -= dt;
          const k = Math.sin(clamp((1.4 - this.cine) / 1.4, 0, 1) * Math.PI);
          const rx = Math.cos(b.yaw) * this.cineSide, rz = -Math.sin(b.yaw) * this.cineSide;
          const sx = b.x + rx * 7 + Math.sin(b.yaw) * 2, sy = b.y + 1.6, sz = b.z + rz * 7 + Math.cos(b.yaw) * 2;
          _v.set(lerp(_v.x, sx, k * 0.85), lerp(_v.y, sy, k * 0.85), lerp(_v.z, sz, k * 0.85));
          _v2.set(lerp(_v2.x, b.x, k), lerp(_v2.y, b.y + 1, k), lerp(_v2.z, b.z, k));
        }
        this.camPos.lerp(_v, Math.min(1, dt * (this.cine > 0 ? 6 : 9)));
        this.camLook.lerp(_v2, Math.min(1, dt * 10));
        cam.position.copy(this.camPos);
        cam.lookAt(this.camLook);
      }
    }
  }

  // ------------------------------------------------------------------ drawing
  private draw() {
    const v = this.view, b = this.bike;
    v.beginShadows();
    for (const p of this.dynamic) v.syncPiece(p, Math.abs((p.z0 + p.z1) / 2 + p.dz - b.z) < 110, p.spin ? this.angleOf(p) : 0);
    if (this.riderB && this.bikeB) {
      this.riderB.begin(); this.bikeB.begin();
      if (this.mode !== "crash") {
        const bp = this.bikePose, rp = this.riderPose;
        bp.x = b.x; bp.y = b.y; bp.z = b.z; bp.yaw = b.yaw; bp.pitch = b.pitch; bp.roll = b.lean; bp.scale = 1;
        poseBike(bp, b.wheel, b.steerVis, b.crank);
        const flash = this.inv > 0 && Math.sin(v.t * 30) > 0 ? 2.2 : 1;
        const shield = this.powers.has("shield");
        bp.r = flash; bp.g = flash; bp.b = flash;
        this.bikeB.push(bp);
        // the rider sits on the saddle (rotated with the bike)
        const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
        const sx = -0.25 + b.tuck * 0.05, sy = 0.85 - b.land * 0.12 - b.tuck * 0.05;
        rp.x = b.x + fx * sx; rp.y = b.y + sy - Math.sin(b.pitch) * sx; rp.z = b.z + fz * sx;
        rp.yaw = b.yaw; rp.pitch = b.pitch; rp.roll = b.lean * 1.2; rp.scale = 1;
        poseRider(rp, b.crank, Math.min(1, Math.abs(b.speed) / 10), b.tuck, this.mode === "finish" && this.modeT > 0.8 ? 1 : 0, v.t);
        rp.r = flash * (shield ? 0.8 : 1); rp.g = flash * (shield ? 1.3 : 1); rp.b = flash * (shield ? 1.5 : 1);
        this.riderB.push(rp);
        const fl = this.cw.ground(b.x, b.z, b.y + 0.3, this.G);
        if (fl.p) v.shadow(b.x, fl.y, b.z, 0.55 * clamp(1 - (b.y - fl.y) / 8, 0.3, 1));
      }
      this.riderB.end(); this.bikeB.end();
    }
    if (this.gremB) {
      this.gremB.begin();
      for (const g of this.grems) {
        if (!g.alive || Math.abs(g.z - b.z) > 90) continue;
        const P = this.gremPose;
        P.x = g.x; P.y = g.y; P.z = g.z; P.yaw = Math.atan2(b.x - g.x, b.z - g.z); P.pitch = 0; P.roll = Math.sin(g.t * 3) * 0.2; P.scale = 1.2; P.r = 1; P.g = 1; P.b = 1;
        poseGremlin(P, g.t);
        this.gremB.push(P);
      }
      this.gremB.end();
    }
    v.endShadows();
    v.drawPickups(this.drops, b.z);
  }

  // ------------------------------------------------------------------ HUD
  private emitHud() {
    const p = this.plan, b = this.bike;
    const sec = Math.max(0, this.section + 1);
    this.o.onHud({
      level: this.level, codename: p.codename, world: p.blend ? `${this.world.name} × ${WORLDS.find((x) => x.id === p.blend)!.name}` : this.world.name, accent: this.world.accent, remix: p.remix,
      mods: p.mods.map((m) => MOD_LABEL[m]), finale: p.finale,
      section: sec, sections: this.course.sections, sector: Math.floor(sec / 6) + 1, sectors: Math.ceil(this.course.sections / 6),
      progress: clamp(b.z / this.course.length, 0, 1), part: PATTERN_LABEL[this.course.patterns[Math.min(this.course.patterns.length - 1, sec)]] ?? "",
      oil: this.oil / this.stats.oil, lowOil: this.oil / this.stats.oil < 0.2, coins: this.coins, lives: this.lives, speed: Math.round(Math.abs(b.speed) * 3.6),
      powers: [...this.powers].map(([id, left]) => ({ id, left, secs: POWERS[id].secs })), mode: this.mode, time: this.time,
    });
  }

  dispose() {
    this.stop();
    this.ro.disconnect();
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.riderB?.dispose(); this.bikeB?.dispose(); this.gremB?.dispose();
    this.view.dispose();
    const w = window as unknown as { __obbybike?: Game };
    if (w.__obbybike === this) delete w.__obbybike;
  }
}
