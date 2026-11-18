// Momo Sky Roll simulation (pure TypeScript, no three.js). Forward position comes from the music beat, so the ball,
// the hazards and the song can never drift apart; sideways steering, jumps, falls, tile effects, forces, abilities
// and knock-backs run on small fixed steps. Events are queued for the session (sounds, haptics, HUD, camera).
import { BALL_R, hazardHits, rollerS } from "./hazards";
import { beatAt, jumpY, tileOffset, tileSolid, zoneAt } from "./levels";
import { TK, type Hazard, type Jump, type Level, type SimEvent, type Tile } from "./types";

const STEP = 1 / 120;
const GRAVITY = 26;
const MARGIN = 0.15;
const ABILITY_BEATS = 16;
const FEVER_AT = 8;
const FEVER_BEATS = 16;

export type SimMode = "ready" | "roll" | "jump" | "fall" | "hit" | "dead" | "done" | "revive";

export interface SimOptions {
  /** autopilot along the par line (title screen, QA) */
  bot?: boolean;
  /** Kid Mode: soft bumpers keep Momo from rolling off the sides */
  kid?: boolean;
  /** playable character id (perks) */
  ch?: string;
  /** the endless run: lives instead of checkpoints, a revive bubble keeps the run going */
  run?: boolean;
}

export const MAX_LIVES = 5;
const firstPickup = (arr: { s: number }[], s: number) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].s < s) lo = m + 1; else hi = m; } return lo; };
const REVIVE_S = 1.8;

interface FreeJump { s0: number; s1: number; h: number; y0: number }

export class Sim {
  readonly L: Level;
  readonly o: SimOptions;
  s = 1;
  x = 0;
  /** absolute height of the ball's bottom */
  y = 0;
  vy = 0;
  vx = 0;
  tx = 0;
  beat = 0;
  mode: SimMode = "ready";
  jump: Jump | null = null;
  free: FreeJump | null = null;
  cp = 0;
  deaths = 0;
  zone = 0;
  beads = 0;
  sprouts = 0;
  gold = 0;
  extras = 0;
  got: Uint8Array;
  /** ball colour for colour tiles (−1 = none) */
  color = -1;
  /** active ability → beat it ends */
  ab = new Map<string, number>();
  shield = false;
  mirrorUntil = -1;
  flipUntil = -1;
  sizeUntil = -1;
  size = 1;
  fever = false;
  feverUntil = -1;
  streak = 0;
  doubleUsed = false;
  stretchUsedZone = -1;
  lives = 3;
  reviveT = 0;
  /** set by the session while a booster is active: coins ×2 + magnet */
  boosting = false;
  private pressed = new Set<number>();
  private tele: { r: number; to: number } | null = null;
  private since: number[] = [];
  private tip = 0;
  private hitT = 0;
  private fallT = 0;
  private coyote = 0;
  private knock = { vx: 0, vs: 0 };
  private hazards: Hazard[];
  private rollers: Hazard[];
  private jumpAt = new Map<number, Jump>();
  private seenRow = -1;
  private nextBead = 0;
  events: SimEvent[] = [];
  readyBeat = 0;

  constructor(L: Level, o: SimOptions = {}) {
    this.L = L; this.o = o;
    this.got = new Uint8Array(L.pickups.length);
    this.hazards = L.hazards.filter((h) => h.kind !== "roller").sort((a, b) => a.s - b.s);
    this.rollers = L.hazards.filter((h) => h.kind === "roller");
    for (const j of L.jumps) this.jumpAt.set(j.s0, j);
    this.placeAt(0);
  }

  /** the endless run appended more track: pick up the new hazards, jumps and pickups */
  extend() {
    const got = new Uint8Array(this.L.pickups.length);
    got.set(this.got.subarray(0, Math.min(this.got.length, got.length)));
    this.got = got;
    const cut = this.s - 12;
    this.hazards = this.L.hazards.filter((h) => h.kind !== "roller" && h.s > cut).sort((a, b) => a.s - b.s);
    this.rollers = this.L.hazards.filter((h) => h.kind === "roller" && h.s > cut - 30);
    for (const j of this.L.jumps) this.jumpAt.set(j.s0, j);
  }

  get progress() { return Math.max(0, Math.min(1, (this.s - 1) / (this.L.finish - 1))); }
  get finished() { return this.mode === "done"; }
  get radius() { return BALL_R * this.size; }
  get mirrored() { return this.beat < this.mirrorUntil || !!this.L.zones[this.zone]?.rules.mirror; }
  get flipped() { return this.beat < this.flipUntil; }
  isPressed(g: number) { return this.pressed.has(g); }
  has(a: string) { return (this.ab.get(a) ?? -1) > this.beat; }
  /** the beat hazards live in (Slow-mo Bell slows them) */
  get hazBeat() { return this.beat; }

  sOfBeat(beat: number) {
    const b = this.L.bRow;
    const n = b.length - 1;
    if (beat <= b[0]) return (beat - b[0]) / (b[1] - b[0]);
    if (beat >= b[n]) return n + (beat - b[n]) / (b[n] - b[n - 1]);
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m] <= beat) lo = m; else hi = m; }
    return lo + (beat - b[lo]) / (b[lo + 1] - b[lo]);
  }
  lineAt(s: number) {
    const l = this.L.line, n = l.length - 1;
    const i = Math.max(0, Math.min(n, Math.floor(s))), j = Math.min(n, i + 1), f = Math.max(0, Math.min(1, s - i));
    return l[i] + (l[j] - l[i]) * f;
  }
  floorAt(s: number) { const r = this.L.rows[Math.max(0, Math.min(this.L.rows.length - 1, Math.round(s)))]; return r ? r.h : 0; }

  private placeAt(cp: number) {
    const row = this.L.checkpoints[cp] ?? 1;
    const b = cp === 0 ? this.L.bRow[1] : Math.max(this.L.bRow[1], this.L.bRow[row] - 2);
    this.readyBeat = b;
    this.beat = b;
    this.s = this.sOfBeat(b);
    this.x = this.tx = this.lineAt(this.s);
    this.y = this.floorAt(this.s); this.vy = 0; this.vx = 0;
    this.jump = null; this.free = null;
    this.zone = zoneAt(this.L, this.s);
    this.mode = "ready";
    this.ab.clear(); this.shield = false; this.mirrorUntil = -1; this.flipUntil = -1; this.sizeUntil = -1; this.size = 1;
    this.fever = false; this.feverUntil = -1; this.streak = 0;
    this.color = -1;
    for (let s = 0; s < Math.round(this.s); s++) { const t = this.L.rows[s].tiles[0]; if (t?.k === TK.paint) this.color = t.c ?? -1; }
    this.seenRow = Math.round(this.s);
    this.nextBead = this.L.pickups.findIndex((p) => p.kind === "bead" && p.s > this.s);
    while (this.tip < this.L.tips.length && this.L.tips[this.tip].s < this.s) this.tip++;
  }

  reset() {
    this.got.fill(0);
    this.since = [];
    this.beads = 0; this.sprouts = 0; this.deaths = 0; this.gold = 0; this.extras = 0;
    this.cp = 0; this.tip = 0;
    this.pressed.clear();
    this.events = [];
    this.placeAt(0);
  }
  start() { if (this.mode !== "ready") return; this.mode = "roll"; this.events.push({ t: "start" }); }
  respawn() {
    for (const id of this.since) {
      this.got[id] = 0;
      const k = this.L.pickups[id].kind;
      if (k === "bead") this.beads--; else if (k === "sprout") this.sprouts--; else this.extras--;
    }
    this.beads = Math.max(0, this.beads);
    this.since = [];
    this.placeAt(this.cp);
    this.events.push({ t: "respawn", cp: this.cp });
  }

  /** tap: jump (Tap Jump / Double Jump abilities) */
  press() {
    if (this.mode === "roll" && (this.has("A01") || this.has("A02"))) { this.startFree(1.35, 6); this.doubleUsed = false; return true; }
    if ((this.mode === "jump") && this.has("A02") && !this.doubleUsed) { this.doubleUsed = true; this.startFree(1.2, 5); return true; }
    return false;
  }
  private startFree(h: number, len: number) {
    this.free = { s0: this.s, s1: this.s + len, h: h * (this.o.ch === "tiki" || this.has("A04") ? 1.2 : 1), y0: this.y };
    this.jump = null;
    this.mode = "jump";
    this.events.push({ t: "jump" });
  }

  /** solid tile under the ball's contact point at absolute height ≈ y */
  support(x: number, s: number, beat: number): { t: Tile; floor: number } | null {
    const rows = this.L.rows;
    const r0 = Math.round(s), f = s - r0;
    for (let k = 0; k < 2; k++) {
      const r = k === 0 ? r0 : f > 0.5 - MARGIN ? r0 + 1 : f < -(0.5 - MARGIN) ? r0 - 1 : -1;
      if (r < 0 || r >= rows.length) continue;
      const row = rows[r];
      for (const t of row.tiles) {
        const tx = t.x + (t.mv?.ax === 0 ? tileOffset(t, beat) : 0);
        if (Math.abs(x - tx) > 0.5 + MARGIN) continue;
        if (t.k === TK.bridge && !this.pressed.has(t.g ?? -1) && !this.o.bot) continue;
        if (t.k === TK.crumble && this.has("A15")) return { t, floor: row.h };
        if (!tileSolid(t, beat, this.color)) continue;
        return { t, floor: row.h + (t.mv?.ax === 1 ? tileOffset(t, beat) : 0) };
      }
    }
    return null;
  }

  private rowExtent(s: number) {
    const r = this.L.rows[Math.round(s)];
    if (!r || !r.tiles.length) return null;
    return [r.tiles[0].x, r.tiles[r.tiles.length - 1].x];
  }

  update(beat: number, dt: number) {
    if (this.mode === "ready" || this.mode === "dead") return;
    const b0 = this.beat;
    const rows = Math.abs(this.sOfBeat(beat) - this.sOfBeat(b0));
    const n = Math.max(1, Math.min(240, Math.max(Math.ceil(dt / STEP), Math.ceil(rows / 0.25))));
    const h = dt / n;
    for (let i = 1; i <= n; i++) {
      const bt = b0 + ((beat - b0) * i) / n;
      this.beat = bt;
      this.tick(bt, h);
      const m = this.mode as SimMode;
      if (m === "dead" || m === "ready") break;
    }
    this.beat = beat;
  }

  private tick(beat: number, dt: number) {
    const L = this.L;
    if (this.mode === "revive") { this.reviveTick(beat, dt); return; }
    if (this.mode === "hit") {
      this.hitT += dt;
      this.x += this.knock.vx * dt; this.s += this.knock.vs * dt;
      this.vy -= GRAVITY * dt; this.y += this.vy * dt;
      if (this.hitT > 0.9) { this.mode = "dead"; this.deaths++; this.events.push({ t: "dead" }); }
      return;
    }
    const prevS = this.s;
    this.s = this.sOfBeat(beat);
    const zr = L.zones[this.zone]?.rules ?? {};
    // timed states
    if (this.sizeUntil > 0 && beat > this.sizeUntil) { this.size = 1; this.sizeUntil = -1; }
    const zSize = zr.tiny ? 0.62 : zr.giant ? 1.45 : 1;
    const curSize = this.sizeUntil > beat ? this.size : zSize;
    this.size = curSize;
    if (this.fever && beat > this.feverUntil) { this.fever = false; this.events.push({ t: "fever", on: false }); }
    for (const [a, until] of this.ab) if (until <= beat) {
      this.ab.delete(a);
      // the rocket shell runs out: glide back down to the floor
      if (a === "A12" && this.mode === "jump") { this.free = { s0: this.s, s1: this.s + 3, h: 0.2, y0: this.y }; this.jump = null; }
      this.events.push({ t: "ability", ab: a, on: false });
    }

    // ---- steering
    const tile = this.mode === "roll" ? this.support(this.x, this.s, beat)?.t : undefined;
    if (this.o.bot) {
      const line = L.line, last = line.length - 1;
      const r = Math.max(0, Math.min(last, Math.round(this.s)));
      this.tx = this.s - r > 0.28 ? line[Math.min(last, r + 1)] : line[r];
    }
    let grip = this.mode === "jump" ? 0.7 : this.mode === "fall" ? 0.25 : 1;
    if (tile?.k === TK.ice) grip *= this.o.ch === "gloop" ? 1 : this.o.ch === "pip" ? 0.5 : 0.22;
    if (tile?.k === TK.sticky || tile?.k === TK.mud) grip *= 0.45;
    const maxV = (this.o.ch === "kranky" ? 19 : 15) * (tile?.k === TK.mud ? 0.55 : 1);
    const want = Math.max(-maxV, Math.min(maxV, (this.tx - this.x) * 16));
    this.vx += (want - this.vx) * Math.min(1, dt * 28 * grip);
    // forces drift both the ball and its steering anchor (the player must push back)
    let drift = 0;
    for (const f of L.forces) {
      if (this.s < f.s0 || this.s > f.s1) continue;
      if (f.kind === "magnet") drift += Math.max(-f.ax, Math.min(f.ax, ((f.to ?? 0) - this.x) * 2));
      else drift += f.ax * (f.period ? Math.sin(2 * Math.PI * (beat / f.period + (f.phase ?? 0))) : 1);
    }
    if (tile?.k === TK.push) drift += (tile.dir ?? 1) * 3;
    if (tile?.k === TK.seesaw) drift += Math.sign(this.x - tile.x || 0.01) * 2.2;
    if (drift && !this.o.bot) { this.tx += drift * dt; }
    this.x += (this.vx + (this.o.bot ? 0 : drift)) * dt;
    this.tx = Math.max(-7.5, Math.min(7.5, this.tx));
    const walled = L.walls.some((w) => this.s >= w.s0 && this.s <= w.s1) || this.has("A10");
    if ((this.o.kid && !zr.noEdges && this.mode === "roll") || (walled && this.mode === "roll")) {
      const e = this.rowExtent(this.s);
      if (e) { const nx = Math.max(e[0] - 0.32, Math.min(e[1] + 0.32, this.x)); if (nx !== this.x) { this.x = nx; this.vx *= -0.3; } }
    }

    // teleport pads zap you sideways as you roll off them
    if (this.tele && this.s >= this.tele.r + 0.42) { this.x += this.tele.to; this.tx += this.tele.to; this.tele = null; }

    // ---- vertical
    const floorNow = this.floorAt(this.s);
    if (this.has("A12") && this.mode !== "fall") {
      this.y += (floorNow + 1.6 - this.y) * Math.min(1, dt * 6);
      this.mode = "jump"; this.jump = null; this.free = null;
    } else if (this.mode === "jump") {
      const j = this.jump, fj = this.free;
      const end = j ? j.s1 : fj ? fj.s1 : this.s;
      if (this.s >= end) {
        this.jump = null; this.free = null;
        const sup = this.support(this.x, this.s, beat);
        if (sup && this.y <= sup.floor + 0.9) {
          this.y = sup.floor; this.mode = "roll";
          this.events.push({ t: "land", v: Math.min(1, 0.45 + (j?.h ?? 1) * 0.2) });
        } else { this.mode = "fall"; this.vy = -3; this.fallT = 0; this.events.push({ t: "fall" }); }
      } else if (j) this.y = jumpY(j, this.s, L.rows) * 1 + (this.has("A04") ? Math.sin(Math.PI * Math.max(0, Math.min(1, (this.s - j.s0) / (j.s1 - j.s0)))) * 0.5 : 0);
      else if (fj) {
        const u = Math.max(0, Math.min(1, (this.s - fj.s0) / (fj.s1 - fj.s0)));
        this.y = fj.y0 + (this.floorAt(fj.s1) - fj.y0) * u + fj.h * 4 * u * (1 - u);
      } else if (!this.has("A12")) { this.free = { s0: this.s, s1: this.s + 2.5, h: 0.3, y0: this.y }; }
    } else if (this.mode === "roll" || this.mode === "done") {
      const sup = this.support(this.x, this.s, beat);
      if (!sup) {
        if (this.mode === "done") { this.x = Math.max(-3, Math.min(3, this.x)); }
        else if (this.has("A14") || (this.o.ch === "noodle" && this.stretchUsedZone !== this.zone)) {
          // Stretch Bridge: Noodle stretches over one gap — keep rolling at the old height
          if (!this.has("A14")) { this.stretchUsedZone = this.zone; this.ab.set("A14", beat + 2); this.events.push({ t: "ability", ab: "A14", on: true }); }
        } else if ((this.o.ch === "zib" && this.coyote < 0.3)) { this.coyote += dt; }
        else { this.mode = "fall"; this.vy = 0; this.fallT = 0; this.events.push({ t: "fall" }); }
      } else {
        this.coyote = 0;
        // floors: roll up small slopes, drop off steps
        if (sup.floor > this.y + 0.42) { this.hit("slider", beat); return; }
        if (sup.floor >= this.y - 0.05) this.y = sup.floor;
        else { this.vy = Math.min(this.vy, 0); this.vy -= GRAVITY * dt; this.y = Math.max(sup.floor, this.y + this.vy * dt); if (this.y === sup.floor && this.vy < -2) { this.events.push({ t: "land", v: Math.min(1, -this.vy / 10) }); this.vy = 0; } }
        if (this.mode === "roll") this.onTile(sup.t, beat);
      }
    } else if (this.mode === "fall") {
      this.fallT += dt;
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.o.run && this.fallT > 0.5) { this.loseLife(); return; }
      if (this.fallT > 0.85) { this.mode = "dead"; this.deaths++; this.events.push({ t: "dead" }); return; }
    }

    // ---- hazards
    if ((this.mode === "roll" || this.mode === "jump") && !this.has("A13") && !this.has("A03")) {
      const r = this.radius;
      for (const hz of this.hazards) {
        if (hz.s > this.s + 3.5) break;
        if (hz.s < this.s - 3.5) continue;
        if (this.o.ch === "bonbon" && hz.mode === "static" && (hz.skin === "cake" || hz.skin === "pins")) continue;
        if (hazardHits(hz, beat, this.x, this.s, this.y - this.floorAt(hz.s), 0.1, r)) { if (this.hit(hz.kind, beat, hz.skin)) return; }
      }
      for (const hz of this.rollers) {
        if (Math.abs(rollerS(hz, beat) - this.s) > 2) continue;
        if (hazardHits(hz, beat, this.x, this.s, this.y - this.floorAt(this.s), 0.1, r)) { if (this.hit(hz.kind, beat)) return; }
      }
    }

    // ---- pickups
    if (this.mode !== "fall") {
      const mag = this.has("A07") || this.boosting ? 2.2 : this.o.ch === "bolt" ? 1.2 : 0;
      for (let pi = firstPickup(L.pickups, this.s - 1.2 - mag); pi < L.pickups.length; pi++) {
        const p = L.pickups[pi];
        if (p.s < this.s - 1.2 - mag) continue;
        if (p.s > this.s + 1.2 + mag) break;
        if (this.got[p.id]) continue;
        const dx = p.x - this.x, ds = p.s - this.s, dy = p.y - (this.y - this.floorAt(p.s) + this.radius);
        const rr = 0.62 + (p.kind === "bead" ? mag : 0) + (this.size - 1) * 0.3;
        if (dx * dx + ds * ds < rr * rr && Math.abs(dy) < 0.8 + mag * 0.5 + (this.has("A12") ? 1.4 : 0)) this.collect(p.id, beat);
      }
      // missed beads break the Fever streak
      while (this.nextBead >= 0 && this.nextBead < L.pickups.length && L.pickups[this.nextBead].s < this.s - 1.5) {
        const p = L.pickups[this.nextBead];
        if (p.kind === "bead" && !this.got[p.id]) this.streak = 0;
        this.nextBead++;
        while (this.nextBead < L.pickups.length && L.pickups[this.nextBead].kind !== "bead") this.nextBead++;
      }
    }

    // ---- progress markers
    if (this.mode !== "fall") {
      while (this.cp + 1 < L.checkpoints.length && this.s >= L.checkpoints[this.cp + 1]) {
        this.cp++; this.since = [];
        this.events.push({ t: "checkpoint", cp: this.cp, s: L.checkpoints[this.cp] });
      }
    }
    const z = zoneAt(L, this.s);
    if (z !== this.zone) { this.zone = z; this.events.push({ t: "zone", zone: z }); }
    while (this.tip < L.tips.length && this.s >= L.tips[this.tip].s) { this.events.push({ t: "tip", tip: L.tips[this.tip] }); this.tip++; }
    if (this.mode !== "done" && this.mode !== "fall" && prevS < L.finish && this.s >= L.finish) { this.mode = "done"; this.y = this.floorAt(this.s); this.events.push({ t: "finish" }); }
    if (this.mode === "done" && this.s > L.rows.length - 3) this.s = L.rows.length - 3;
  }

  private hit(kind: Hazard["kind"], beat: number, skin?: string) {
    if (this.shield) {
      this.shield = false; this.ab.delete("A05");
      this.ab.set("A13", beat + 1.5);
      this.events.push({ t: "hit", kind, x: this.x, s: this.s, shield: true, skin });
      return false;
    }
    if (this.o.run) {
      this.events.push({ t: "hit", kind, x: this.x, s: this.s, shield: false, skin });
      this.loseLife();
      return true;
    }
    this.mode = "hit"; this.hitT = 0;
    const away = this.vx >= 0 ? 1 : -1;
    this.knock.vx = away * (2.5 + Math.random() * 1.5); this.knock.vs = -1.8; this.vy = 7.5;
    this.events.push({ t: "hit", kind, x: this.x, s: this.s, shield: false });
    return true;
  }

  private onTile(t: Tile, beat: number) {
    const r = Math.round(this.s);
    if (r === this.seenRow) return;
    this.seenRow = r;
    switch (t.k) {
      case TK.pad: case TK.mega: {
        const j = this.jumpAt.get(r);
        if (j) {
          const glide = this.o.ch === "tiki" || this.has("A04") ? 1.2 : 1;
          this.jump = glide !== 1 ? { ...j, h: j.h * glide } : j;
          this.mode = "jump"; this.doubleUsed = false;
          this.events.push({ t: "pad", s: j.s0, mega: t.k === TK.mega });
        }
        return;
      }
      case TK.boost: this.events.push({ t: "boost", s: r }); return;
      case TK.teleport: this.tele = { r, to: t.to ?? 0 }; break;
      case TK.plate: this.pressed.add(t.g ?? -1); break;
      case TK.paint: this.color = t.c ?? -1; break;
      case TK.mirror: this.mirrorUntil = beat + 8; break;
      case TK.gravity: this.flipUntil = beat + 8; break;
      case TK.shrink: this.size = 0.62; this.sizeUntil = beat + 10; break;
      case TK.grow: this.size = 1.45; this.sizeUntil = beat + 10; break;
      case TK.updraft: this.startFree(1.1, 5); break;
      case TK.bouncy: this.startFree(0.45, 2.5); break;
      case TK.gold: this.gold++; break;
      case TK.piano: case TK.glass: case TK.color: case TK.blink: case TK.ghost: case TK.ice: case TK.sticky: case TK.mud: case TK.push: case TK.seesaw: case TK.magnet: break;
      default: return;
    }
    this.events.push({ t: "tile", k: t.k, x: this.x, s: r, note: t.note });
  }

  private collect(id: number, beat: number) {
    const p = this.L.pickups[id];
    this.got[id] = 1;
    this.since.push(id);
    if (p.kind === "bead") {
      const inc = (this.fever ? 2 : 1) * (this.boosting ? 2 : 1);
      this.beads += inc;
      this.streak++;
      if (!this.fever && this.streak >= FEVER_AT) { this.fever = true; this.feverUntil = beat + FEVER_BEATS; this.events.push({ t: "fever", on: true }); }
      else if (this.fever) this.feverUntil = Math.max(this.feverUntil, beat + 4);
      this.events.push({ t: "bead", id, x: p.x, s: p.s, y: p.y, n: this.beads, fever: this.fever });
    } else if (p.kind === "sprout") {
      this.sprouts++;
      if (this.o.run) this.beads += 25;
      this.events.push({ t: "sprout", id, x: p.x, s: p.s, y: p.y, n: this.sprouts });
    } else {
      this.extras++;
      if (p.kind === "power" && p.ab) {
        const dur = p.ab === "A06" && this.o.ch === "hoot" ? ABILITY_BEATS * 1.5 : ABILITY_BEATS;
        this.ab.set(p.ab, beat + dur);
        if (p.ab === "A05") this.shield = true;
        if (p.ab === "A11") this.flipUntil = beat + dur;
        this.events.push({ t: "ability", ab: p.ab, on: true });
      }
      if (p.kind === "box") { this.beads += 5; }
      if (p.kind === "life") { const before = this.lives; this.lives = Math.min(MAX_LIVES, this.lives + 1); this.events.push({ t: "life", lives: this.lives, delta: this.lives - before }); }
      this.events.push({ t: "pickup", id, kind: p.kind as Exclude<typeof p.kind, "bead" | "sprout">, ab: p.ab, x: p.x, s: p.s, y: p.y });
    }
  }

  /** spend coins after the run ended: one more life, starting in the revive bubble */
  revive() {
    this.lives = 1;
    this.mode = "revive"; this.reviveT = 2.2;
    this.jump = null; this.free = null; this.vy = 0;
    this.events.push({ t: "revive", on: true });
  }

  /** endless run: lose a life and float on in a bubble — or end the run on the last one */
  private loseLife() {
    if (this.lives <= 1) {
      this.lives = 0;
      this.events.push({ t: "life", lives: 0, delta: -1 });
      this.mode = "dead"; this.deaths++;
      this.events.push({ t: "dead" });
      return;
    }
    this.lives--;
    this.deaths++;
    this.streak = 0;
    this.events.push({ t: "life", lives: this.lives, delta: -1 });
    this.mode = "revive"; this.reviveT = REVIVE_S;
    this.jump = null; this.free = null; this.vy = 0;
    this.events.push({ t: "revive", on: true });
  }

  /** the revive bubble: carried safely along the par line, then dropped back onto solid ground */
  private reviveTick(beat: number, dt: number) {
    this.s = this.sOfBeat(beat);
    this.reviveT -= dt;
    const target = this.lineAt(this.s + 1.2);
    this.x += (target - this.x) * Math.min(1, dt * 7);
    this.tx = this.x;
    const floor = this.floorAt(this.s);
    this.y += (floor + 0.55 + Math.sin(beat * Math.PI) * 0.08 - this.y) * Math.min(1, dt * 8);
    const z = zoneAt(this.L, this.s);
    if (z !== this.zone) { this.zone = z; this.events.push({ t: "zone", zone: z }); }
    for (let pi = firstPickup(this.L.pickups, this.s - 1.2); pi < this.L.pickups.length; pi++) {
      const p = this.L.pickups[pi];
      if (p.s < this.s - 1.2) continue;
      if (p.s > this.s + 1.2) break;
      if (!this.got[p.id] && Math.abs(p.x - this.x) < 0.7 && Math.abs(p.s - this.s) < 0.7) this.collect(p.id, beat);
    }
    if (this.reviveT <= 0) {
      const sup = this.support(this.x, this.s, beat);
      const safe = sup && !this.L.hazards.some((h) => Math.abs(h.s - this.s) < 2.5);
      if (sup && safe) { this.y = sup.floor; this.mode = "roll"; this.ab.set("A13", beat + 1.2); this.events.push({ t: "revive", on: false }); }
    }
  }

  beatOf(s: number) { return beatAt(this.L.bRow, s); }
  drain(): SimEvent[] {
    if (!this.events.length) return [];
    const e = this.events;
    this.events = [];
    return e;
  }
}

/** QA: run the autopilot through the whole level; returns deaths (0 = the par line is clean). */
export function botRun(L: Level, kid = false): { deaths: number; beads: number; sprouts: number; finished: boolean; at: number[] } {
  const sim = new Sim(L, { bot: true, kid });
  sim.start();
  let beat = sim.readyBeat;
  const end = L.bRow[L.finish] + 2;
  const dt = 1 / 60;
  const at: number[] = [];
  let guard = 0;
  while (beat < end && guard++ < 400000) {
    beat += dt * (L.bpm / 60);
    sim.update(beat, dt);
    for (const e of sim.drain()) if (e.t === "fall" || e.t === "hit") at.push(Math.round(sim.s));
    if (sim.mode === "dead") { sim.respawn(); beat = sim.readyBeat; sim.start(); if (sim.deaths > 12) break; }
    if (sim.finished) break;
  }
  return { deaths: sim.deaths, beads: sim.beads, sprouts: sim.sprouts, finished: sim.finished, at };
}
