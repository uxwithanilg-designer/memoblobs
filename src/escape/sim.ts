// Momo Escape simulation. One deterministic step function moves Momo (used by the game, the solver and the autopilot).
// Momo sticks to a wall and stays put until the player picks a direction (swipe, tap or arrow key). Then he dashes that
// way in a straight line, cell centre to cell centre, and sticks to the first wall in his way. Teleport pads move him
// mid-dash, bumpers turn him around, a bounce wall throws him straight back, a conveyor carries him along, speed and
// ice walls launch him fast and honey launches him slowly. All motion is tick-aligned (U = 10 units per cell).
import { hits, nearHazard } from "./hazards";
import { COLS, DX, DY, LEAP_V, opp, U, type Dir, type Face, type Hazard, type Pickup, type PickupKind, type Room, type SimEvent } from "./types";

export interface Runner {
  x: number; y: number;
  /** the side his wall is on (his feet point there) */ g: Dir;
  /** dash direction (the last one while resting) */ d: Dir;
  /** 0 resting on a wall · 1 dashing */ mode: 0 | 1;
  /** next cell centre while dashing */ tx: number; ty: number;
  v: number;
  /** resting and waiting for the player's next direction (the solver's decision point) */
  arrived: boolean;
  /** bounces and teleports in this dash (capped, so every dash ends) */
  kicks: number;
}

export interface Env {
  wall(cx: number, cy: number): boolean;
  face(cx: number, cy: number, n: Dir): Face | undefined;
  bumper(cx: number, cy: number): boolean;
  pad(cx: number, cy: number): [number, number] | null;
}

/** dash started · landed · resting · tried to move into a wall · bounced · teleported */
export const F_LEAP = 1, F_LAND = 2, F_ARRIVE = 4, F_BUMP = 8, F_BOUNCE = 16, F_TELE = 32;
const MAX_KICKS = 6;
/** no direction this tick */
export const NO_MOVE = -1;

export const cellOf = (v: number) => Math.floor(v / U);
export const centre = (c: number) => (c + 0.5) * U;

/** how fast Momo leaves the wall he rests on */
export function launchSpeed(f: Face | undefined) {
  if (!f) return LEAP_V;
  switch (f.k) {
    case "ice": case "speed": return LEAP_V * 1.6;
    case "honey": return LEAP_V * 0.5;
    default: return LEAP_V;
  }
}

export const cloneRunner = (r: Runner): Runner => ({ ...r });

function launch(r: Runner, d: Dir, v: number) {
  r.mode = 1; r.d = d; r.v = v; r.arrived = false;
  r.tx = centre(cellOf(r.x) + DX[d]); r.ty = centre(cellOf(r.y) + DY[d]);
}

/** Momo reached a cell centre mid-dash: pads, bumpers, then stick to the wall ahead (bounce / conveyor walls kick him on) */
function atCentre(r: Runner, env: Env): number {
  let flags = 0;
  let cx = cellOf(r.x), cy = cellOf(r.y);
  const p = r.kicks < MAX_KICKS ? env.pad(cx, cy) : null;
  if (p) { cx = p[0]; cy = p[1]; r.x = centre(cx); r.y = centre(cy); r.kicks++; flags |= F_TELE; }
  if (r.kicks < MAX_KICKS && env.bumper(cx, cy)) { r.d = opp(r.d); r.kicks++; flags |= F_BOUNCE; }
  const ax = cx + DX[r.d], ay = cy + DY[r.d];
  if (!env.wall(ax, ay)) { r.tx = centre(ax); r.ty = centre(ay); return flags; }
  r.g = r.d; r.mode = 0; r.arrived = true; r.tx = r.x; r.ty = r.y;
  flags |= F_LAND | F_ARRIVE;
  if (r.kicks >= MAX_KICKS) return flags;
  const f = env.face(ax, ay, opp(r.g));
  if (f?.k === "bounce" && !env.wall(cx - DX[r.g], cy - DY[r.g])) { r.kicks++; launch(r, opp(r.g), LEAP_V * 1.3); flags |= F_BOUNCE | F_LEAP; }
  else if (f?.k === "conveyor" && f.dir !== undefined && !env.wall(cx + DX[f.dir], cy + DY[f.dir])) { r.kicks++; launch(r, f.dir, LEAP_V * 0.5); flags |= F_LEAP; }
  return flags;
}

/** advance one tick. `move` = the direction the player picked this tick (NO_MOVE for none). Returns F_* flags. */
export function stepRunner(r: Runner, env: Env, move: number): number {
  let flags = 0;
  if (r.mode === 0) {
    if (move < 0) return 0;
    const d = (move & 3) as Dir, cx = cellOf(r.x), cy = cellOf(r.y);
    if (env.wall(cx + DX[d], cy + DY[d])) return F_BUMP;
    r.kicks = 0;
    launch(r, d, launchSpeed(env.face(cx + DX[r.g], cy + DY[r.g], opp(r.g))));
    flags |= F_LEAP;
  }
  let rem = r.v;
  for (let guard = 0; guard < 16 && rem > 1e-9; guard++) {
    const dx = r.tx - r.x, dy = r.ty - r.y, dist = Math.abs(dx) + Math.abs(dy);
    if (dist > rem + 1e-9) { r.x += Math.sign(dx) * rem; r.y += Math.sign(dy) * rem; break; }
    r.x = r.tx; r.y = r.ty; rem -= dist;
    flags |= atCentre(r, env);
    if (r.mode === 0) break;
  }
  return flags;
}

// ---------------------------------------------------------------- room-local environment (solver + autopilot)
export function roomEnv(room: Room, st: { key: boolean; inClosed: boolean }): Env {
  const faces = new Map<number, Face>();
  for (const f of room.faces) faces.set((f.cy * COLS + f.cx) * 4 + f.n, f);
  const pads = new Map<number, [number, number]>();
  for (const p of room.pads) { pads.set(p.ay * COLS + p.ax, [p.bx, p.by]); pads.set(p.by * COLS + p.bx, [p.ax, p.ay]); }
  const bump = new Set(room.bumpers.map((b) => b.cy * COLS + b.cx));
  return {
    wall(cx, cy) {
      if (cx < 0 || cx >= COLS || cy < 0 || cy >= room.h) return true;
      if (cy === 0 && cx === room.inX) return st.inClosed;
      if (cy === room.h - 1 && cx === room.outX) return room.key && !st.key;
      const i = cy * COLS + cx;
      if (room.door[i]) return !st.key;
      return room.cells[i] === 1 && !room.fake[i];
    },
    face: (cx, cy, n) => faces.get((cy * COLS + cx) * 4 + n),
    bumper: (cx, cy) => bump.has(cy * COLS + cx),
    pad: (cx, cy) => pads.get(cy * COLS + cx) ?? null,
  };
}

/** every floor starts the same way: Momo resting in the entrance hatch, waiting for the player */
export function entryRunner(room: Room): Runner {
  const x = centre(room.inX), y = centre(0);
  return { x, y, g: 2, d: 0, mode: 0, tx: x, ty: y, v: LEAP_V, arrived: true, kicks: 0 };
}

/** the autopilot's move list packs (tick << 2) | direction */
export const packMove = (t: number, d: number) => t * 4 + (d & 3);
// ---------------------------------------------------------------- the game
export interface SimOptions { lives: number; maxLives: number; kid?: boolean; bot?: boolean }
interface RoomState { t0: number; active: boolean; inClosed: boolean; key: boolean; switched: boolean; got: Set<number>; variant: number; enterTick: number; leaps: number }

export const MAX_LIVES = 5;
const FREEZE = 36;

export class EscapeSim {
  rooms: Room[] = [];
  st: RoomState[] = [];
  r: Runner;
  tick = 0;
  cur = 0;
  lives: number;
  coins = 0;
  diamonds = 0;
  buddies = 0;
  floorsDone = 0;
  shield = false;
  ghostT = 0;
  magnetT = 0;
  frozen = 0;
  dead = false;
  events: SimEvent[] = [];
  /** a direction picked mid-dash fires as soon as Momo lands (input buffer) */
  private buffer = 0;
  private want: Dir = 0;
  private faces = new Map<number, Face>();
  private pads = new Map<number, [number, number]>();
  private bumps = new Set<number>();
  readonly o: SimOptions;
  private env: Env;
  private nearT = 0;
  /** diamonds collected in the current room */
  roomDiamonds = 0;

  constructor(first: Room, o: SimOptions) {
    this.o = o;
    this.lives = o.lives;
    this.env = {
      wall: (cx, cy) => this.wallAt(cx, cy),
      face: (cx, cy, n) => this.faces.get(this.fkey(cx, cy) * 4 + n),
      bumper: (cx, cy) => this.bumps.has(this.fkey(cx, cy)),
      pad: (cx, cy) => this.pads.get(this.fkey(cx, cy)) ?? null,
    };
    this.add(first);
    // start: Momo comes up through the first hatch
    this.r = entryRunner(first);
    this.activate(0, 0);
  }

  private fkey(cx: number, cy: number) { return cy * COLS + cx; }

  /** glue the next floor on top of the tower */
  add(room: Room) {
    const last = this.rooms[this.rooms.length - 1];
    room.y0 = last ? last.y0 + last.h - 1 : 0;
    if (last) room.inX = last.outX;
    this.rooms.push(room);
    this.st.push({ t0: 0, active: false, inClosed: false, key: false, switched: false, got: new Set(), variant: 0, enterTick: 0, leaps: 0 });
    for (const f of room.faces) this.faces.set(this.fkey(f.cx, f.cy + room.y0) * 4 + f.n, { ...f, cy: f.cy + room.y0 });
    for (const p of room.pads) { this.pads.set(this.fkey(p.ax, p.ay + room.y0), [p.bx, p.by + room.y0]); this.pads.set(this.fkey(p.bx, p.by + room.y0), [p.ax, p.ay + room.y0]); }
    for (const b of room.bumpers) this.bumps.add(this.fkey(b.cx, b.cy + room.y0));
  }

  /** room index that owns global row cy (a room owns its floor row; the top room also owns its ceiling) */
  roomAt(cy: number) {
    const R = this.rooms;
    let lo = 0, hi = R.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (R[m].y0 <= cy) lo = m; else hi = m - 1; }
    return lo;
  }

  wallAt(cx: number, cy: number): boolean {
    if (cx < 0 || cx >= COLS || cy < 0) return true;
    const ri = this.roomAt(cy), room = this.rooms[ri], st = this.st[ri];
    // the floors below are sealed once Momo is through their exit
    if (ri < this.cur) return true;
    const ly = cy - room.y0;
    if (ly >= room.h) return true;
    if (ly === 0 && cx === room.inX) {
      if (ri === 0) return st.inClosed;
      const prev = this.rooms[ri - 1];
      return st.inClosed || (prev.key && !this.st[ri - 1].key);
    }
    if (ly === room.h - 1 && cx === room.outX) return room.key && !st.key;
    const i = ly * COLS + cx;
    if (room.door[i]) return !st.key;
    return room.cells[i] === 1 && !room.fake[i];
  }

  get room() { return this.rooms[this.cur]; }
  get state() { return this.st[this.cur]; }
  /** local tick of room i */
  localT(i: number) { const s = this.st[i]; return s.active ? Math.max(0, this.tick - s.t0) : 0; }

  private activate(i: number, variant: number) {
    const s = this.st[i];
    s.active = true; s.t0 = this.tick; s.variant = variant; s.enterTick = this.tick; s.leaps = 0;
    this.cur = i;
    this.roomDiamonds = 0;
    this.events.push({ t: "room", n: this.rooms[i].n, room: this.rooms[i] });
  }

  /** the player picks a direction (world space); it fires now, or the moment Momo lands */
  move(d: Dir) { this.want = d; this.buffer = 14; }

  /** advance one tick of game time */
  step() {
    if (this.dead) return;
    this.tick++;
    if (this.ghostT > 0) this.ghostT--;
    if (this.magnetT > 0) this.magnetT--;
    if (this.nearT > 0) this.nearT--;
    if (this.frozen > 0) { this.frozen--; return; }
    const r = this.r;
    let move = NO_MOVE;
    if (this.o.bot) {
      const s = this.st[this.cur], room = this.rooms[this.cur];
      const t = this.tick - s.t0;
      const m = (room.bots?.[0] ?? []).find((v) => v >> 2 === t);
      if (m !== undefined) move = m & 3;
    } else if (this.buffer > 0) {
      if (r.mode === 0) { move = this.want; this.buffer = 0; } else this.buffer--;
    }
    const f = stepRunner(r, this.env, move);
    if (f & F_LEAP) { this.events.push({ t: "leap", x: r.x, y: r.y }); this.st[this.cur].leaps++; }
    if (f & F_LAND) this.events.push({ t: "land", x: r.x, y: r.y, g: r.g });
    if (f & F_BUMP) this.events.push({ t: "bump", x: r.x, y: r.y, d: move as Dir });
    if (f & F_BOUNCE) this.events.push({ t: "bounce" });
    if (f & F_TELE) this.events.push({ t: "teleport" });

    // rooms: a dash up through the exit is caught by the next floor's hatch, and that floor starts · the hatch below closes
    const cy = cellOf(r.y);
    const ri = this.roomAt(cy);
    if (ri > this.cur && r.mode === 1 && r.d === 0 && cy === this.rooms[ri].y0 && cellOf(r.x) === this.rooms[ri].inX) {
      r.x = centre(this.rooms[ri].inX); r.y = centre(cy); r.tx = r.x; r.ty = r.y;
      r.mode = 0; r.g = 2; r.arrived = true; r.kicks = 0;
      this.buffer = 0;
      const done = this.rooms[this.cur], ds = this.st[this.cur];
      this.floorsDone++;
      this.events.push({ t: "exit", n: done.n, ticks: this.tick - ds.enterTick, diamonds: this.roomDiamonds });
      this.activate(ri, 0);
    }
    const room = this.rooms[this.cur], st = this.st[this.cur];
    if (!st.inClosed && cy >= room.y0 + 1) st.inClosed = true;

    // hazards (room-local coordinates)
    const t = this.tick - st.t0, lx = r.x, ly = r.y - room.y0 * U;
    if (this.ghostT <= 0) {
      for (const h of room.hazards) {
        if (hits(h, t, lx, ly, -0.6, st.switched)) { this.hit(h); return; }
      }
      if (this.nearT <= 0 && nearHazard(room.hazards, t, lx, ly, st.switched, 2.2)) { this.nearT = 90; this.events.push({ t: "nearmiss" }); }
    }
    // pickups
    const mag = this.magnetT > 0 ? 26 : 0;
    for (const p of room.pickups) {
      if (st.got.has(p.id)) continue;
      const dx = p.x - lx, dy = p.y - ly;
      const rr = p.k === "coin" ? 6.5 + mag : 7;
      if (dx * dx + dy * dy < rr * rr) this.collect(p, st);
    }
  }

  private collect(p: Pickup, st: RoomState) {
    st.got.add(p.id);
    let n = 0;
    switch (p.k) {
      case "coin": this.coins += 1; n = this.coins; break;
      case "diamond": this.diamonds++; this.roomDiamonds++; n = this.roomDiamonds; break;
      case "heart": { const before = this.lives; this.lives = Math.min(MAX_LIVES, this.lives + 1); this.events.push({ t: "life", lives: this.lives, delta: this.lives - before }); break; }
      case "vend": { if (this.coins >= 25 && this.lives < MAX_LIVES) { this.coins -= 25; this.lives++; this.events.push({ t: "life", lives: this.lives, delta: 1 }); } else st.got.delete(p.id); return; }
      case "shield": this.shield = true; break;
      case "ghost": this.ghostT = 240; break;
      case "magnet": this.magnetT = 600; break;
      case "key": st.key = true; this.events.push({ t: "key" }); break;
      case "switch": st.switched = true; this.events.push({ t: "switch" }); break;
      case "buddy": this.buddies++; this.coins += 10; break;
      case "plate": this.coins += 3; break;
      default: break;
    }
    this.events.push({ t: "pickup", k: p.k as PickupKind, x: p.x, y: p.y + this.room.y0 * U, n });
  }

  private hit(h: Hazard) {
    const r = this.r;
    if (this.shield) {
      this.shield = false; this.ghostT = 90;
      this.events.push({ t: "hit", x: r.x, y: r.y, skin: h.skin, shield: true });
      return;
    }
    this.events.push({ t: "hit", x: r.x, y: r.y, skin: h.skin, shield: false });
    this.lives--;
    this.events.push({ t: "life", lives: this.lives, delta: -1 });
    if (this.lives <= 0) { this.dead = true; this.events.push({ t: "dead" }); return; }
    this.respawn();
  }

  /** back to this floor's hatch; the floor's security restarts (keys and switches reset, coins stay) */
  respawn() {
    const i = this.cur, room = this.rooms[i], st = this.st[i];
    st.inClosed = false; st.key = false; st.switched = false;
    for (const p of room.pickups) if (p.k === "key" || p.k === "switch") st.got.delete(p.id);
    const e = entryRunner(room);
    e.y += room.y0 * U; e.ty += room.y0 * U;
    this.r = e;
    st.t0 = this.tick + FREEZE; st.variant = 0;
    this.frozen = FREEZE;
    this.buffer = 0;
    this.dead = false;
    this.events.push({ t: "respawn" });
  }

  /** spend coins to keep going after the last heart */
  revive() {
    this.lives = 1; this.dead = false;
    this.respawn();
  }

  drain() { const e = this.events; this.events = []; return e; }

  /** rooms far below can be forgotten */
  prune(keep = 3) {
    // the tower keeps its rooms (the renderer drops their canvases); nothing to free in the sim itself
    return keep;
  }
}
