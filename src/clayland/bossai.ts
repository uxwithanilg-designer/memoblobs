// Rain Raid boss fights: the generals' war machines (stage 10) and the reworked zone bosses (stage 20). Every attack
// has a tell (a state ending in "Tell" — the renderer flashes the boss) and the second half of the fight (under 50% hp)
// adds a new move. Uses the Sim's public helpers (shoot, shootAt, spawnFoe, hurt, emit, bossContact).
import type { BossDef, BossPattern } from "./bestiary";
import { GRAV } from "./physics";
import type { Boss, Sim } from "./sim";

export const V2_PATTERNS = new Set<BossPattern>([
  "crawler", "copter", "worm", "sub", "clack", "bonk", "mole", "puffer",
  "gyro", "crusher", "express", "borer", "plow", "rig", "blimp", "forge",
  "gull2", "gummy2", "jack2", "spore2", "walrus2", "scorpion2", "moth2", "mecha2",
]);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** an arcing throw from (x, y) that lands at (tx, ty) after T seconds */
function lob(s: Sim, kind: string, x: number, y: number, tx: number, ty: number, T = 1.1, g = 20, r = 0.32) {
  s.shoot(kind, x, y, (tx - x) / T, (ty - y + 0.5 * g * T * T) / T, g, r, T + 2);
}
function radial(s: Sim, kind: string, x: number, y: number, n: number, speed: number, off = 0, grav = 0) {
  for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2; s.shoot(kind, x, y, Math.cos(a) * speed, Math.sin(a) * speed, grav, 0.27, 3.5); }
}

export function updateBossV2(s: Sim, b: Boss, def: BossDef, dt: number) {
  const ar = s.st.boss!;
  const lo = ar.x0 + b.w / 2 + 0.3, hi = ar.x1 - b.w / 2 - 0.3, floor = ar.floor;
  const p2 = b.hp < b.max * 0.5;
  // early zones fight slower: cooldowns stretch by up to 30%
  const ease = 1.3 - Math.min(0.5, s.st.d * 0.7);
  const toward = Math.sign(s.x - b.x) || -1;
  const go = (state: string) => { b.state = state; b.t = 0; b.cnt = 0; };
  b.t3 += dt;
  if (b.state === "intro") { b.vx = 0; b.vy = 0; if (b.t > 1.3) go("go"); }
  else switch (def.pattern) {
    // ---------------------------------------------------------------- Grit's Dust Crawler (a tank)
    case "crawler": case "plow": {
      b.y = floor; b.vy = 0;
      const gunX = b.x + b.dir * b.w * 0.5;
      if (b.state === "go") {
        b.dir = toward;
        b.t2 -= dt; if (b.t2 <= 0) { b.tx = b.x < (lo + hi) / 2 ? hi - 1 : lo + 1; b.t2 = 3.4; }
        b.vx = Math.abs(b.tx - b.x) > 0.3 ? Math.sign(b.tx - b.x) * def.speed : 0;
        if (b.shotT <= 0) { b.shotT = (p2 ? 1.6 : 2.3) * ease; lob(s, "shell", gunX, b.y + b.h * 0.9, s.x, s.y, 1.15); s.emit({ t: "cannon" }); }
        if (b.t > 5.2) { b.phase++; go(p2 && b.phase % 2 === 0 ? "ramTell" : "gunTell"); }
      } else if (b.state === "gunTell") { b.vx = 0; b.dir = toward; if (b.t > 0.6) go("gun"); }
      else if (b.state === "gun") {
        b.vx = 0;
        // a 6-shot burst, low (jump it) or high (crouch under it)
        if (def.pattern === "plow") {
          // the plow shoves snowballs along the ground: jump them
          if (b.cnt < (p2 ? 3 : 2) && b.t > b.cnt * 0.55) { b.cnt++; s.shoot("roller", b.x + b.dir * (b.w * 0.55), floor + 0.55, b.dir * (5.5 + b.cnt * 0.6), 0, 30, 0.55, 8); s.emit({ t: "crusher" }); }
          if (b.t > 1.6) go("go");
        } else {
          if (b.t > b.cnt * 0.16) { b.cnt++; const high = b.phase % 2 === 1; s.shoot("dust", gunX, floor + (high ? 1.35 : 0.42), b.dir * 9, 0, 0, 0.3, 3); s.emit({ t: "foeShot", x: gunX, y: floor + 1 }); }
          if (b.cnt >= (p2 ? 8 : 6)) go("go");
        }
      } else if (b.state === "ramTell") { b.vx = 0; b.dir = toward; if (b.t > 0.65) { go("ram"); s.emit({ t: "bossRoar" }); } }
      else if (b.state === "ram") {
        b.vx = b.dir * 9.5;
        if ((b.x <= lo + 0.05 && b.dir < 0) || (b.x >= hi - 0.05 && b.dir > 0)) { go("dizzy"); s.emit({ t: "crusher" }); for (let i = 0; i < 4; i++) s.shoot("rock", ar.x0 + 3 + ((i * 6.7 + b.t3 * 5) % (ar.x1 - ar.x0 - 6)), floor + 10, 0, -2, 26, 0.38, 3); }
      } else if (b.state === "dizzy") { b.vx = 0; if (b.t > 1.3) go("go"); }
      // the hatch: Dust Runners pour out in the second half
      if (p2) { if (Math.floor(b.t3 / 7) !== Math.floor((b.t3 - dt) / 7)) { const f = s.spawnFoe("dustRunner", b.x, b.y + b.h, { parent: -2 }); f.state = 1; f.vy = 7; } }
      break;
    }
    // ---------------------------------------------------------------- Grit's Saw Copter
    case "copter": case "gyro": {
      const cruise = floor + 6.4;
      if (b.state === "go") {
        b.t2 -= dt; if (b.t2 <= 0) { b.tx = clamp(s.x + (Math.sin(b.t3 * 1.3) * 4), lo, hi); b.t2 = 1.6; }
        b.vx = (b.tx - b.x) * 1.6; b.vy = (cruise + Math.sin(b.t3 * 2.2) * 0.4 - b.y) * 3; b.dir = toward;
        if (b.shotT <= 0) {
          if (Math.abs(s.x - b.x) < 1.6) { b.shotT = (p2 ? 0.9 : 1.3) * ease; s.shoot("bombDrop", b.x, b.y - 0.2, b.vx * 0.3, -1, 22, 0.32, 4); }
          else if (def.pattern === "gyro") { b.shotT = (p2 ? 1.3 : 1.8) * ease; for (let i = -1; i <= 1; i++) s.shootAt("laser", b.x, b.y, 11, i * 0.16); }
          else { b.shotT = (p2 ? 1.5 : 2.1) * ease; if (p2) for (let i = -1; i <= 1; i++) s.shootAt("dust", b.x, b.y, 6.5, i * 0.28); else s.shootAt("dust", b.x, b.y, 7); }
          s.emit({ t: "foeShot", x: b.x, y: b.y });
        }
        if (b.t > 6) go("sawTell");
      } else if (b.state === "sawTell") { b.vx = 0; b.vy = (cruise + 1.2 - b.y) * 3; b.tx = b.x < (lo + hi) / 2 ? hi : lo; if (b.t > 0.75) { go("saw"); s.emit({ t: "bossRoar" }); } }
      else if (b.state === "saw") {
        // a low sweep across the arena with the saw out: jump over it
        b.vy = (floor + 0.9 - b.y) * 6; b.vx = b.t > 0.35 ? Math.sign(b.tx - b.x) * 8.5 : 0;
        if (Math.abs(b.tx - b.x) < 0.4 && b.t > 0.6) go("up");
      } else if (b.state === "up") { b.vx = 0; b.vy = (cruise - b.y) * 2.5; if (b.t > 1.2) go("go"); }
      break;
    }
    // ---------------------------------------------------------------- Grit's Drill Worm
    case "worm": case "borer": case "rig": {
      if (b.state === "go" || b.state === "dig") {
        b.under = true; b.y = floor - b.h - 0.2; b.vy = 0;
        b.vx = clamp(s.x - b.x, -1, 1) * def.speed * 1.3;
        if (b.t > (b.state === "go" ? 1.4 : 0.9)) { go("eruptTell"); b.tx = s.x; }
      } else if (b.state === "eruptTell") {
        // dust spurts where it's about to come up
        b.vx = 0; b.x += (b.tx - b.x) * Math.min(1, dt * 6);
        if (b.t > 0.7) { go("erupt"); b.under = false; b.y = floor - b.h * 0.7; b.vy = 16; s.emit({ t: "bossRoar" }); }
      } else if (b.state === "erupt") {
        b.vy -= GRAV * 0.8 * dt; b.vx = 0;
        if (b.cnt === 0) {
          b.cnt = 1;
          for (let i = 0; i < (p2 ? 8 : 6); i++) { const a = Math.PI * (0.15 + 0.7 * (i / ((p2 ? 8 : 6) - 1))); s.shoot("rock", b.x, floor + 0.5, Math.cos(a) * 7, Math.sin(a) * 9, 22, 0.35, 3); }
          if (def.pattern === "rig") radial(s, "dust", b.x, floor + 1.5, p2 ? 12 : 8, 6, b.t3);
        }
        if (b.y <= floor && b.vy < 0) { b.y = floor; b.vy = 0; go("up"); s.emit({ t: "crusher" }); }
      } else if (b.state === "up") {
        b.vx = 0; b.y = floor;
        if (b.shotT <= 0) {
          b.shotT = (def.pattern === "borer" ? 1.1 : 0.75) * ease;
          if (def.pattern === "borer") for (let i = 0; i < (p2 ? 3 : 2); i++) lob(s, "spore", b.x, b.y + b.h * 0.9, s.x + (i - 0.5) * 2.4, floor + 0.6, 1.1, 14, 0.5);
          else if (p2) for (let i = -1; i <= 1; i++) s.shootAt("dust", b.x, b.y + b.h * 0.8, 7, i * 0.22); else s.shootAt("dust", b.x, b.y + b.h * 0.8, 7.5);
          s.emit({ t: "foeShot", x: b.x, y: b.y + b.h });
        }
        if (b.t > (def.pattern === "rig" ? 1.8 : 2.4)) go(p2 ? "dig" : "go");
      }
      break;
    }
    // ---------------------------------------------------------------- Grit's Bubble Sub
    case "sub": {
      const surf = ar.water ?? floor + 3;
      if (b.state === "go") {
        b.under = false;
        b.t2 -= dt; if (b.t2 <= 0) { b.tx = b.x < (lo + hi) / 2 ? hi - 1 : lo + 1; b.t2 = 4; }
        b.vx = Math.abs(b.tx - b.x) > 0.3 ? Math.sign(b.tx - b.x) * def.speed : 0; b.dir = toward;
        b.y += (surf - b.h * 0.55 - b.y) * Math.min(1, dt * 4); b.vy = 0;
        if (b.shotT <= 0) {
          b.shotT = (p2 ? 1.5 : 2.1) * ease;
          // a torpedo skims the surface; bubble mines float up
          s.shoot("dust", b.x + toward * b.w * 0.5, surf + 0.35, toward * 8.5, 0, 0, 0.32, 3);
          for (let i = -1; i <= 1; i += 2) s.shoot("ball", b.x + i * 0.6, surf + 0.6, i * 1.2, 2.4, -0.4, 0.34, 4.5);
          s.emit({ t: "foeShot", x: b.x, y: surf });
        }
        if (b.t > 6.5) go("dive");
      } else if (b.state === "dive") {
        b.under = true; b.vx = clamp(s.x - b.x, -1, 1) * 3; b.y += (surf - b.h - 1.5 - b.y) * Math.min(1, dt * 3);
        if (b.cnt < 4 && b.t > b.cnt * 0.45) { b.cnt++; s.shoot("ball", b.x + (b.cnt - 2.5) * 0.8, surf - 0.5, 0, 2.2, -0.3, 0.34, 5); }
        if (b.t > 2.2) go("leapTell");
      } else if (b.state === "leapTell") { b.under = true; b.vx = 0; if (b.t > 0.55) { go("leap"); b.under = false; b.vy = 15; b.vx = clamp(s.x - b.x, -6, 6); s.emit({ t: "splash" }); } }
      else if (b.state === "leap") {
        b.vy -= GRAV * 0.75 * dt;
        if (b.y <= surf - b.h * 0.55 && b.vy < 0) { b.vy = 0; b.vx = 0; go("go"); s.emit({ t: "splash" }); for (let i = 0; i < (p2 ? 10 : 7); i++) { const a = Math.PI * (0.12 + 0.76 * i / ((p2 ? 10 : 7) - 1)); s.shoot("drip", b.x, surf + 0.4, Math.cos(a) * 6.5, Math.sin(a) * 9, 20, 0.22, 3); } }
      }
      break;
    }
    // ---------------------------------------------------------------- Captain Clack
    case "clack": {
      if (b.state === "go") {
        b.y = floor; b.vy = 0; b.dir = toward; b.vx = b.dir * def.speed * (p2 ? 0.7 : 0.5);
        if (b.shotT <= 0) { b.shotT = (p2 ? 1.3 : 1.8) * ease; for (let i = -1; i <= 1; i++) s.shootAt("dust", b.x + b.dir * 0.8, b.y + 1.3, 7, i * 0.22); s.emit({ t: "foeShot", x: b.x, y: b.y + 1.3 }); }
        if (b.t > 3.6) go(p2 && b.phase++ % 2 === 1 ? "rushTell" : "jumpTell");
      } else if (b.state === "jumpTell") { b.vx = 0; b.y = floor; if (b.t > 0.45) { go("jump"); b.vy = 15; b.vx = clamp((s.x - b.x) * 0.9, -7, 7); } }
      else if (b.state === "jump") {
        b.vy -= GRAV * 0.9 * dt;
        if (b.y <= floor && b.vy < 0) {
          b.y = floor; b.vy = 0; b.vx = 0; go("go"); s.emit({ t: "crusher" });
          // the slam sends low shockwaves both ways: jump them
          for (const d of [-1, 1]) s.shoot("dust", b.x + d * b.w * 0.5, floor + 0.35, d * 8, 0, 0, 0.36, 2.5);
        }
      } else if (b.state === "rushTell") { b.vx = 0; b.y = floor; b.dir = toward; if (b.t > 0.55) { go("rush"); s.emit({ t: "bossRoar" }); } }
      else if (b.state === "rush") { b.y = floor; b.vx = b.dir * 10; if ((b.x <= lo + 0.05 && b.dir < 0) || (b.x >= hi - 0.05 && b.dir > 0)) { go("dizzy"); s.emit({ t: "crusher" }); } }
      else if (b.state === "dizzy") { b.vx = 0; b.y = floor; if (b.t > 1.2) go("go"); }
      if (p2 && Math.floor(b.t3 / 9) !== Math.floor((b.t3 - dt) / 9)) for (const x of [ar.x0 + 1.5, ar.x1 - 1.5]) { const f = s.spawnFoe("dustRunner", x, floor + 3, { parent: -2 }); f.state = 1; }
      break;
    }
    // ---------------------------------------------------------------- Big Bonk
    case "bonk": {
      if (b.state === "go") {
        b.y = floor; b.vy = 0; b.dir = toward; b.vx = 0;
        if (b.shotT <= 0) { b.shotT = (p2 ? 1.2 : 1.6) * ease; const n = p2 ? 5 : 3; for (let i = 0; i < n; i++) lob(s, "coconut", b.x, b.y + b.h, s.x + (i - (n - 1) / 2) * 2.2, floor + 0.3, 1.0 + i * 0.08, 20, 0.34); s.emit({ t: "foeShot", x: b.x, y: b.y + b.h }); }
        if (b.t > 5.2) go(p2 && b.phase++ % 2 === 1 ? "hopTell" : "slamTell");
      } else if (b.state === "slamTell") { b.vx = 0; if (b.t > 0.6) { go("slam"); s.emit({ t: "crusher" }); for (let i = 0; i < (p2 ? 3 : 2); i++) s.shoot("roller", b.x + toward * (b.w * 0.6 + i * 1.6), floor + 0.45, toward * (4.6 + i * 0.6), 0, 30, 0.45, 8); } }
      else if (b.state === "slam") { if (b.t > 0.9) go("go"); }
      else if (b.state === "hopTell") { b.vx = 0; if (b.t > 0.5) { go("hop"); b.vy = 16; b.tx = b.x < (lo + hi) / 2 ? hi - 1 : lo + 1; b.vx = (b.tx - b.x) / 1.4; } }
      else if (b.state === "hop") { b.vy -= GRAV * 0.85 * dt; if (b.y <= floor && b.vy < 0) { b.y = floor; b.vy = 0; b.vx = 0; go("go"); s.emit({ t: "crusher" }); for (const d of [-1, 1]) s.shoot("dust", b.x + d * b.w * 0.5, floor + 0.35, d * 8, 0, 0, 0.36, 2.5); } }
      break;
    }
    // ---------------------------------------------------------------- Mole Major
    case "mole": {
      if (b.state === "go") {
        b.under = true; b.y = floor; b.vx = clamp(s.x - b.x, -1, 1) * def.speed * 1.2; b.vy = 0;
        if (b.t > 1.9) { go("popTell"); b.tx = s.x + (s.face || 1) * 1.5; }
      } else if (b.state === "popTell") { b.vx = 0; b.x += (clamp(b.tx, lo, hi) - b.x) * Math.min(1, dt * 5); if (b.t > 0.6) { go("pop"); b.under = false; b.vy = 11; s.emit({ t: "bossRoar" }); if (Math.abs(s.x - b.x) < 1.5) s.hurt("burrow"); } }
      else if (b.state === "pop") {
        b.vx = 0; b.vy -= GRAV * dt; if (b.y <= floor) { b.y = floor; b.vy = 0; }
        if (b.shotT <= 0 && b.cnt < 2) { b.shotT = (0.8) * ease; b.cnt++; for (let i = -2; i <= 2; i++) s.shootAt("dust", b.x, b.y + b.h * 0.7, 6.8, i * 0.2); s.emit({ t: "foeShot", x: b.x, y: b.y + b.h }); }
        if (p2 && b.cnt === 2 && b.t > 1.6 && b.t - dt <= 1.6) for (let i = 0; i < 4; i++) s.shoot("rock", s.x + (i - 1.5) * 2.1, floor + 10, 0, -2, 26, 0.38, 3);
        if (b.t > 2.6) go("go");
      }
      break;
    }
    // ---------------------------------------------------------------- Puffer Pete
    case "puffer": {
      if (b.state === "go") {
        b.t2 -= dt; if (b.t2 <= 0) { b.tx = lo + 1 + ((b.t3 * 3.7) % 1) * (hi - lo - 2); b.t2 = 2.2; }
        b.vx = (b.tx - b.x) * 1.4; b.vy = (floor + 4.6 + Math.sin(b.t3 * 2) * 0.8 - b.y) * 2.6; b.dir = toward;
        if (b.t > 2.4) go(p2 && b.phase++ % 3 === 2 ? "swoopTell" : "puffTell");
      } else if (b.state === "puffTell") { b.vx = 0; b.vy = 0; if (b.t > 0.6) { radial(s, "spike", b.x, b.y + b.h / 2, p2 ? 12 : 8, 5.5, b.t3); s.emit({ t: "foeShot", x: b.x, y: b.y }); go("go"); } }
      else if (b.state === "swoopTell") { b.vx = 0; b.vy = 0; b.tx = s.x; if (b.t > 0.55) go("swoop"); }
      else if (b.state === "swoop") { b.vx = (b.tx - b.x) * 2.6; b.vy = (floor + 0.4 - b.y) * 4; if (b.t > 1.2) go("go"); }
      break;
    }

    // ---------------------------------------------------------------- Rasp's Candy Crusher
    case "crusher": {
      if (b.state === "go") {
        b.y = floor; b.vy = 0; b.dir = toward; b.vx = Math.abs(s.x - b.x) > 4 ? b.dir * def.speed : 0;
        if (b.shotT <= 0) { b.shotT = (p2 ? 1.6 : 2.2) * ease; for (let i = 0; i < 3; i++) lob(s, "shell", b.x, b.y + b.h, s.x + (i - 1) * 2.4, floor + 0.3, 1.05 + i * 0.07); s.emit({ t: "foeShot", x: b.x, y: b.y + b.h }); }
        if (b.t > 4.4) go("slamTell");
      } else if (b.state === "slamTell") { b.vx = 0; b.y = floor; if (b.t > 0.7) { go("slam"); if (p2) { b.vy = 15; b.vx = clamp((s.x - b.x) * 0.9, -7, 7); } } }
      else if (b.state === "slam") {
        if (p2 && (b.vy > 0 || b.y > floor)) { b.vy -= GRAV * 0.9 * dt; }
        if (b.y <= floor && b.vy <= 0) {
          b.y = floor; b.vy = 0; b.vx = 0; s.emit({ t: "crusher" });
          for (const d of [-1, 1]) { s.shoot("dust", b.x + d * b.w * 0.5, floor + 0.38, d * 7.5, 0, 0, 0.4, 2.6); s.shoot("dust", b.x + d * b.w * 0.5, floor + 0.38, d * 4.8, 0, 0, 0.4, 2.6); }
          go("rest");
        }
      } else if (b.state === "rest") { b.vx = 0; b.y = floor; if (b.t > 1.1) go("go"); }
      break;
    }
    // ---------------------------------------------------------------- Rasp's Toy Express: a train that charges across the arena
    case "express": {
      b.y = floor; b.vy = 0;
      if (b.state === "go" || b.state === "parked") {
        b.vx = 0; b.dir = b.x < (lo + hi) / 2 ? 1 : -1;
        if (b.shotT <= 0) { b.shotT = (p2 ? 1.4 : 2.0) * ease; lob(s, "shell", b.x, b.y + b.h + 0.4, s.x, floor + 0.3, 1.1); s.emit({ t: "cannon" }); }
        if (p2 && b.cnt === 0 && b.t > 1) { b.cnt = 1; for (let i = 0; i < 2; i++) { const f = s.spawnFoe("windupSwarm", b.x - b.dir * (1.5 + i), floor + 0.5, { parent: -2 }); f.state = 1; } }
        if (b.t > (p2 ? 2.6 : 3.4)) go("hornTell");
      } else if (b.state === "hornTell") { b.vx = 0; if (b.t > 0.9) { go("charge"); s.emit({ t: "bossRoar" }); } }
      else if (b.state === "charge") {
        b.vx = b.dir * def.speed;
        if ((b.x >= hi - 0.05 && b.dir > 0) || (b.x <= lo + 0.05 && b.dir < 0)) { go("parked"); s.emit({ t: "crusher" }); }
      }
      break;
    }
    // ---------------------------------------------------------------- Clinker's Lantern Blimp
    case "blimp": {
      const cruise = floor + 7.6;
      b.t2 -= dt; if (b.t2 <= 0) { b.tx = b.x < (lo + hi) / 2 ? hi - 2 : lo + 2; b.t2 = 5; }
      b.vx = clamp(b.tx - b.x, -1, 1) * def.speed; b.vy = (cruise - (p2 ? 1.2 : 0) + Math.sin(b.t3 * 1.3) * 0.5 - b.y) * 2; b.dir = toward;
      if (b.shotT <= 0) {
        b.shotT = (p2 ? 1.9 : 2.5) * ease;
        for (let i = -1; i <= 1; i++) s.shoot("bombDrop", b.x + i * 1.6, b.y - 0.2, b.vx * 0.3, -1, 22, 0.32, 4);
        if (p2) for (let i = -2; i <= 2; i++) s.shootAt("orb", b.x, b.y, 3.6, i * 0.3);
        s.emit({ t: "foeShot", x: b.x, y: b.y });
      }
      if (Math.floor(b.t3 / 8) !== Math.floor((b.t3 - dt) / 8)) for (let i = 0; i < 2; i++) { const f = s.spawnFoe("lanternGhost", b.x + (i ? 2 : -2), b.y - 1, { parent: -2, range: 4 }); f.x0 = f.x; f.y0 = floor + 4 + i; }
      break;
    }
    // ---------------------------------------------------------------- Clinker's Forge Mech
    case "forge": {
      if (b.state === "go") {
        b.y = floor; b.vy = 0; b.dir = toward; b.vx = Math.abs(s.x - b.x) > 5 ? b.dir * def.speed : 0;
        if (b.t > 3.2) { b.phase++; go(p2 && b.phase % 3 === 0 ? "missileTell" : b.phase % 2 ? "flameTell" : "jumpTell"); }
      } else if (b.state === "flameTell") { b.vx = 0; b.dir = toward; if (b.t > 0.6) go("flame"); }
      else if (b.state === "flame") {
        b.vx = 0;
        if (b.t > b.cnt * 0.06) { b.cnt++; const a = Math.sin(b.t * 3) * 0.35; s.shoot("flame", b.x + b.dir * b.w * 0.55, floor + b.h * 0.55, b.dir * 8 * Math.cos(a), 8 * Math.sin(a) - 0.5, 0, 0.32, 0.6); }
        if (b.t > 1.5) go("go");
      } else if (b.state === "jumpTell") { b.vx = 0; if (b.t > 0.5) { go("jump"); b.vy = 15; b.vx = clamp((s.x - b.x) * 0.9, -7, 7); } }
      else if (b.state === "jump") {
        b.vy -= GRAV * 0.9 * dt;
        if (b.y <= floor && b.vy < 0) { b.y = floor; b.vy = 0; b.vx = 0; s.emit({ t: "crusher" }); for (const d of [-1, 1]) s.shoot("dust", b.x + d * b.w * 0.5, floor + 0.38, d * 8, 0, 0, 0.4, 2.6); go("go"); }
      } else if (b.state === "missileTell") { b.vx = 0; if (b.t > 0.6) { for (let i = 0; i < 5; i++) lob(s, "shell", b.x, floor + b.h, s.x + (i - 2) * 1.8, floor + 0.3, 1.0 + i * 0.12); s.emit({ t: "cannon" }); go("go"); } }
      break;
    }
    // ---------------------------------------------------------------- Gale Gull
    case "gull2": {
      if (b.state === "go") {
        b.t2 -= dt; if (b.t2 <= 0) { b.tx = lo + 1 + ((b.t3 * 2.9) % 1) * (hi - lo - 2); b.t2 = 2; }
        b.vx = (b.tx - b.x) * 1.5; b.vy = (floor + 4.8 + Math.sin(b.t3 * 2) * 0.6 - b.y) * 2.6; b.dir = toward;
        if (b.t > 2.2) { b.phase++; go(p2 && b.phase % 3 === 0 ? "gustTell" : b.phase % 2 ? "fanTell" : "swoopTell"); }
      } else if (b.state === "fanTell") { b.vx = 0; b.vy = 0; if (b.t > 0.5) { for (let i = -2; i <= 2; i++) s.shootAt("spike", b.x, b.y + b.h / 2, 7, i * 0.2); s.emit({ t: "foeShot", x: b.x, y: b.y }); go("go"); } }
      else if (b.state === "swoopTell") { b.vx = 0; b.vy = 0; b.tx = s.x; if (b.t > 0.5) go("swoop"); }
      else if (b.state === "swoop") { b.vx = (b.tx - b.x) * 2.8; b.vy = (floor + 0.5 - b.y) * 4; if (b.t > 1.1) go("go"); }
      else if (b.state === "gustTell") { b.vx = 0; b.vy = 0; if (b.t > 0.6) go("gust"); }
      else if (b.state === "gust") { b.vx = 0; s.foePush += -toward * 5.5; if (b.t > b.cnt * 0.3) { b.cnt++; s.shootAt("spike", b.x, b.y + b.h / 2, 7.5); } if (b.t > 2) go("go"); }
      break;
    }
    // ---------------------------------------------------------------- Gummy Grump
    case "gummy2": case "spore2": {
      if (b.state === "go") { b.y = floor; b.vy = 0; b.vx = 0; b.dir = toward; if (b.t > (p2 ? 1.0 : 1.5)) { go("jump"); b.vy = 15; b.vx = clamp((s.x - b.x) * 0.9, -7, 7); } }
      else if (b.state === "jump") {
        b.vy -= GRAV * 0.9 * dt;
        if (b.y <= floor && b.vy < 0) {
          b.y = floor; b.vy = 0; b.vx = 0; go("go"); s.emit({ t: "crusher" });
          for (const d of [-1, 1]) s.shoot("dust", b.x + d * b.w * 0.5, floor + 0.38, d * 7.5, 0, 0, 0.4, 2.6);
          // two spore puffs: one where Puddo stands, one between him and the Spore Lord (step back to dodge)
          if (def.pattern === "spore2") { for (const off of [0, -toward * 2.6]) s.shoot("spore", b.x, b.y + b.h, (s.x + off - b.x) / 1.0, (floor + 0.6 - b.y - b.h + 7) / 1.0, 14, 0.5, 2.4); if (p2 && b.phase++ % 2 === 0) { const f = s.spawnFoe("rootGrabber", clamp(s.x + 2, lo, hi), floor, { parent: -2 }); f.state = 0; } }
          else if (p2 && s.foes.filter((f) => f.alive && f.parent === -2).length < 4) for (const d of [-1, 1]) { const f = s.spawnFoe("gumBouncer", b.x + d * 1.5, floor + 0.5, { parent: -2 }); f.vy = 8; }
        }
      }
      break;
    }
    // ---------------------------------------------------------------- Jack-in-the-Crab
    case "jack2": {
      if (b.state === "go") { b.under = true; b.y = floor; b.vx = clamp(s.x - b.x, -1, 1) * def.speed; if (b.t > 1.4) { go("popTell"); } }
      else if (b.state === "popTell") { b.vx = 0; if (b.t > 0.5) { go("pop"); b.under = false; b.vy = 12; radial(s, "ball", b.x, floor + 1.4, p2 ? 10 : 8, 5.5, b.t3); s.emit({ t: "bossRoar" }); } }
      else if (b.state === "pop") {
        b.vx = 0; b.vy -= GRAV * dt; if (b.y <= floor) { b.y = floor; b.vy = 0; }
        if (b.shotT <= 0 && b.cnt < 3) { b.shotT = 0.6 * ease; b.cnt++; if (p2) s.shootAt("orb", b.x, b.y + b.h * 0.8, 3.6); else s.shootAt("ball", b.x, b.y + b.h * 0.8, 7.5); }
        if (b.t > 2.3) go("go");
      }
      break;
    }
    // ---------------------------------------------------------------- Walrus Wally
    case "walrus2": {
      b.y = floor; b.vy = 0;
      if (b.state === "go") {
        b.dir = toward; b.vx = b.dir * def.speed * 0.4;
        if (b.shotT <= 0) { b.shotT = 1.7 * ease; for (let i = 0; i < 2; i++) lob(s, "snow", b.x, b.y + b.h, s.x + (i - 0.5) * 2, floor + 0.3, 1.0 + i * 0.1, 20, 0.35); }
        if (b.t > 3.2) go("rushTell");
      } else if (b.state === "rushTell") { b.vx = 0; b.dir = toward; if (b.t > 0.55) { go("rush"); s.emit({ t: "bossRoar" }); } }
      else if (b.state === "rush") {
        b.vx = b.dir * 11;
        if ((b.x <= lo + 0.05 && b.dir < 0) || (b.x >= hi - 0.05 && b.dir > 0)) { go("dizzy"); s.emit({ t: "crusher" }); if (p2) radial(s, "ice", b.x, floor + 1.2, 10, 6, b.t3); }
      } else if (b.state === "dizzy") { b.vx = 0; if (b.t > 1.2) go("go"); }
      break;
    }
    // ---------------------------------------------------------------- Sandy Scorpion
    case "scorpion2": {
      if (b.state === "go") { b.under = true; b.y = floor; b.vx = clamp(s.x - b.x, -1, 1) * def.speed * 1.2; if (b.t > 1.8) { go("popTell"); b.tx = s.x + (s.face || 1) * 2; } }
      else if (b.state === "popTell") { b.vx = 0; b.x += (clamp(b.tx, lo, hi) - b.x) * Math.min(1, dt * 5); if (b.t > 0.6) { go("pop"); b.under = false; b.vy = 10; if (p2) radial(s, "dust", b.x, floor + 1, 10, 6, b.t3); } }
      else if (b.state === "pop") {
        b.vx = 0; b.vy -= GRAV * dt; if (b.y <= floor) { b.y = floor; b.vy = 0; }
        if (b.t > 0.5 && b.cnt < 3 && b.t > 0.5 + b.cnt * 0.35) { b.cnt++; s.shootAt("laser", b.x, b.y + b.h, 14); s.emit({ t: "foeShot", x: b.x, y: b.y + b.h }); }
        if (b.t > 2.4) go("go");
      }
      break;
    }
    // ---------------------------------------------------------------- Moth Mama
    case "moth2": {
      if (b.state === "go") {
        b.t2 -= dt; if (b.t2 <= 0) { b.tx = lo + 1 + ((b.t3 * 3.3) % 1) * (hi - lo - 2); b.t2 = 2.2; }
        b.vx = (b.tx - b.x) * 1.3; b.vy = (floor + 5 + Math.sin(b.t3 * 1.7) * 0.8 - b.y) * 2.4; b.dir = toward;
        if (b.shotT <= 0) { b.shotT = (p2 ? 1.8 : 2.4) * ease; for (let i = -2; i <= 2; i++) s.shootAt("orb", b.x, b.y + b.h / 2, 3.4, i * 0.32); if (p2) for (let i = 0; i < 2; i++) lob(s, "spore", b.x, b.y, s.x + (i - 0.5) * 3, floor + 0.6, 1.0, 14, 0.5); }
        if (b.t > 5) go("swoopTell");
      } else if (b.state === "swoopTell") { b.vx = 0; b.vy = 0; b.tx = s.x; if (b.t > 0.5) go("swoop"); }
      else if (b.state === "swoop") { b.vx = (b.tx - b.x) * 2.6; b.vy = (floor + 0.5 - b.y) * 4; if (b.t > 1.2) go("go"); }
      break;
    }
    // ---------------------------------------------------------------- Mecha Pinch
    case "mecha2": {
      b.y = floor; b.vy = 0;
      if (b.state === "go") {
        b.dir = toward; b.vx = b.dir * def.speed * 0.35;
        if (b.shotT <= 0) { b.shotT = (p2 ? 1.2 : 1.7) * ease; for (let i = -1; i <= 1; i++) s.shootAt("laser", b.x + b.dir, b.y + b.h * 0.7, 11, i * 0.12); }
        if (b.t > 3.4) { b.phase++; go(p2 && b.phase % 2 === 0 ? "missileTell" : "rushTell"); }
      } else if (b.state === "rushTell") { b.vx = 0; b.dir = toward; if (b.t > 0.55) { go("rush"); s.emit({ t: "bossRoar" }); } }
      else if (b.state === "rush") { b.vx = b.dir * 10.5; if ((b.x <= lo + 0.05 && b.dir < 0) || (b.x >= hi - 0.05 && b.dir > 0)) { go("dizzy"); s.emit({ t: "crusher" }); } }
      else if (b.state === "dizzy") { b.vx = 0; if (b.t > 1.1) go("go"); }
      else if (b.state === "missileTell") { b.vx = 0; if (b.t > 0.6) { for (let i = 0; i < 4; i++) lob(s, "shell", b.x, floor + b.h, s.x + (i - 1.5) * 2, floor + 0.3, 1.0 + i * 0.12); for (let i = 0; i < 2; i++) { const f = s.spawnFoe("dustDrone", b.x + (i ? 2 : -2), floor + 4, { parent: -2, range: 4 }); f.x0 = f.x; f.y0 = f.y; } go("go"); } }
      break;
    }
  }
  b.x = clamp(b.x + b.vx * dt, lo, hi); b.y += b.vy * dt;
  if (def.pattern !== "worm" && def.pattern !== "borer" && def.pattern !== "rig" && def.pattern !== "sub" && b.y < floor) b.y = floor;
  s.bossContact(b, !["puffer", "copter", "gyro", "blimp", "gull2", "moth2"].includes(def.pattern));
}
