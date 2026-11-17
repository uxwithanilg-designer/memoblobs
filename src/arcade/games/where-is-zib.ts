// Where's Zib? — find the one-eyed purple alien with ONE antenna in a busy space party.
// Look-alikes (purple with 2 eyes, one eye but 2 antennas, green one-eyed…) get trickier every level.
import { ArcadeGame, Bag, byDiff, clamp, ease, ramp, type GameMeta } from "../engine";
import { blob, clayFill, darken, eye, hsl, lighten, mouth, rr, shadow, star, type G } from "../paint";

type Shape = "egg" | "tall" | "round" | "bean";
interface Alien { x: number; y: number; s: number; color: string; eyes: number; ant: number; shape: Shape; hat: number; zib: boolean; ph: number; vx: number; vy: number; nope: number; jump: number; mouthK: "smile" | "oh" | "grin" }
type Theme = "party" | "moon" | "station" | "beach";

export default class WhereIsZib extends ArcadeGame {
  readonly meta: GameMeta = {
    slug: "where-is-zib", title: "Where's Zib?", host: "zib", style: "rounds",
    music: { calm: "a:zib_calm", action: "a:zib_action" },
    sounds: ["a:zap", "a:ufo", "a:teleport", "a:giggle", "a:honk", "a:blip", "a:heartbeat", "a:ooh"],
    voicePitch: 1.5,
  };
  private crowd: Alien[] = [];
  private themes = new Bag<Theme>(["party", "moon", "station", "beach"]);
  private theme: Theme = "party";
  private limit = 30; private left = 30; private found = false; private wrongs = 0;
  private dance = false; private radarAt = 0.5; private radar = 0; private beat = 0;
  private stars: { x: number; y: number; r: number; tw: number }[] = [];
  private beam = 0;

  protected onResize() { this.placeCrowd(false); }

  protected setupLevel() {
    const L = this.level, d = this.diff;
    this.theme = this.themes.next(this.rng);
    const A = this.area;
    const want = Math.min(byDiff(d, { easy: 45, medium: 70, hard: 100 }), byDiff(d, { easy: 10, medium: 16, hard: 24 }) + (L - 1) * byDiff(d, { easy: 3, medium: 4, hard: 5 }));
    const fit = Math.floor((this.W * A.h) / 1300);
    const n = Math.max(8, Math.min(want, fit));
    this.limit = ramp(L, byDiff(d, { easy: 30, medium: 24, hard: 20 }), -0.5, byDiff(d, { easy: 14, medium: 11, hard: 8 }));
    this.left = this.limit; this.found = false; this.wrongs = 0; this.beam = 0; this.beat = 0;
    this.dance = L >= byDiff(d, { easy: 10, medium: 6, hard: 4 });
    this.radarAt = byDiff(d, { easy: 0.5, medium: 0.25, hard: -1 });
    this.radar = 0;
    const look = clamp((L - byDiff(d, { easy: 3, medium: 1, hard: 0 })) / 10, 0, 0.75); // share of look-alikes
    const purple = "#8E5BE8";
    const pal = ["#2EC4B6", "#FF8A3D", "#74C94E", "#FF6F91", "#FFC93C", "#3B82F6", "#E8504F", "#C9D2E3"];
    this.crowd = [];
    for (let i = 0; i < n - 1; i++) {
      const alike = this.rng.chance(look);
      let color = this.rng.pick(pal), eyes = this.rng.pick([2, 2, 3]), ant = this.rng.pick([0, 2, 2]);
      if (alike) {
        const kind = this.rng.int(0, 2);
        if (kind === 0) { color = this.shade(purple); eyes = 2; ant = this.rng.pick([1, 2]); }
        else if (kind === 1) { color = this.shade(purple); eyes = 1; ant = this.rng.pick([0, 2]); }
        else { color = this.rng.pick(pal); eyes = 1; ant = 1; }
      }
      this.crowd.push(this.makeAlien(color, eyes, ant, false));
    }
    this.crowd.push(this.makeAlien(purple, 1, 1, true));
    this.rng.shuffle(this.crowd);
    this.placeCrowd(true);
    this.stars = Array.from({ length: 50 }, () => ({ x: this.rng.range(0, 1), y: this.rng.range(0, 1), r: this.rng.range(0.6, 2.2), tw: this.rng.range(0, 6) }));
    this.hint("Find Zib: purple, ONE eye, ONE antenna 👽");
    this.react("happy", this.rng.pick(["Bet you can't find me!", "Hehe, I'm hiding!", "Party time!", "Bloop bloop!"]));
    this.sfx("a:ufo", { gain: 0.4 });
    this.music("calm");
    this.timerBar(1, "#B7FF5A");
  }

  private shade(c: string) { return this.rng.chance(0.5) ? lighten(c, this.rng.range(0.05, 0.2)) : darken(c, this.rng.range(0.05, 0.15)); }

  private makeAlien(color: string, eyes: number, ant: number, zib: boolean): Alien {
    return {
      x: 0, y: 0, s: 30, color, eyes, ant, zib, shape: zib ? "egg" : this.rng.pick(["egg", "tall", "round", "bean"] as const),
      hat: zib ? 0 : this.rng.chance(0.25) ? this.rng.int(1, 2) : 0, ph: this.rng.range(0, 6), vx: this.rng.range(-1, 1), vy: this.rng.range(-1, 1),
      nope: 0, jump: 0, mouthK: this.rng.pick(["smile", "oh", "grin"] as const),
    };
  }

  /** poisson-ish scatter so everyone is tappable and nobody fully hides another */
  private placeCrowd(fresh: boolean) {
    const A = this.area, n = this.crowd.length;
    if (!n) return;
    const top = A.y + 8, bottom = A.y + A.h - 6;
    const s = clamp(Math.sqrt((this.W * (bottom - top)) / n) * 0.3, 15, 40);
    const minD = s * 1.7;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      let best = { x: 0, y: 0 }, bestD = -1;
      for (let k = 0; k < 18; k++) {
        const c = { x: this.rng.range(s * 1.3, this.W - s * 1.3), y: this.rng.range(top + s * 2.4, bottom - s * 0.2) };
        const d = pts.reduce((m, p) => Math.min(m, Math.hypot(p.x - c.x, (p.y - c.y) * 1.25)), Infinity);
        if (d > bestD) { bestD = d; best = c; }
        if (d > minD * 1.4) break;
      }
      pts.push(best);
    }
    this.crowd.forEach((a, i) => { a.s = s * (a.zib ? 1 : this.rng.range(0.92, 1.12)); if (fresh || !a.x) { a.x = pts[i].x; a.y = pts[i].y; } });
    this.crowd.sort((a, b) => a.y - b.y);
  }

  protected onDown(x: number, y: number) {
    if (this.found) return;
    let hit: Alien | null = null, bd = Infinity;
    for (const a of this.crowd) {
      const d = Math.hypot(a.x - x, a.y - a.s * 0.9 - y);
      if (d < Math.max(a.s * 1.25, 24) && d < bd) { hit = a; bd = d; }
    }
    if (!hit) return;
    if (hit.zib) {
      this.found = true; hit.jump = 0.0001; this.beam = 0.0001;
      this.good(hit.x, hit.y - hit.s * 2, 150, this.left / this.limit);
      this.sfx("a:teleport", { x: hit.x, gain: 0.7 }); this.sfx("a:ooh", { gain: 0.35, delay: 0.3 });
      this.react("wow", this.rng.pick(["You found me!", "Noooo, caught!", "How?!", "Bloop! Busted!"]));
      this.timerBar(null); this.hint(null);
      this.after(1.3, () => this.levelClear({ perfect: this.wrongs === 0 }));
    } else {
      this.wrongs++; hit.nope = 1;
      this.left = Math.max(0, this.left - 2);
      this.sfx("a:zap", { x: hit.x, gain: 0.4 });
      this.bad(hit.x, hit.y - hit.s, { line: this.rng.pick([hit.eyes === 2 ? "I have TWO eyes!" : "Not Zib!", hit.ant === 2 ? "Two antennas, see?" : "I'm Zorp!", "Wrong alien!", "Nope, I'm Blip!"]) });
      this.float("-2s", hit.x, hit.y - hit.s * 2.4, "#FF6F91", 22);
    }
  }

  protected update(dt: number) {
    for (const a of this.crowd) {
      a.nope = Math.max(0, a.nope - dt * 1.6);
      if (a.jump > 0) a.jump = Math.min(1, a.jump + dt * 0.9);
      if (this.dance && !this.found) {
        a.x = clamp(a.x + Math.sin(this.t * 0.7 + a.ph) * a.vx * 16 * dt, a.s * 1.3, this.W - a.s * 1.3);
        a.y = clamp(a.y + Math.cos(this.t * 0.6 + a.ph) * a.vy * 10 * dt, this.area.y + a.s * 2.4, this.area.y + this.area.h - 6);
      }
    }
    if (this.dance) this.crowd.sort((a, b) => a.y - b.y);
    if (this.beam > 0) this.beam = Math.min(1, this.beam + dt);
    if (this.found || this.ending) return;
    this.left -= dt;
    const f = this.left / this.limit;
    this.timerBar(f, f < 0.3 ? "#FF6F91" : f < 0.6 ? "#FFD25A" : "#B7FF5A");
    if (this.radarAt > 0 && f < this.radarAt && this.radar === 0) { this.radar = 1; this.sfx("a:blip", { gain: 0.5 }); this.hint("Radar on! Zib is near the ring 📡"); }
    if (f < 0.3) { this.beat -= dt; if (this.beat <= 0) { this.beat = 0.8; this.sfx("a:heartbeat", { gain: 0.45, duck: false }); } }
    if (f < 0.5 && f + dt / this.limit >= 0.5) this.music("action");
    if (this.left <= 0) {
      this.found = true; this.timerBar(null);
      const z = this.crowd.find((c) => c.zib)!; z.jump = 0.0001;
      this.sfx("a:giggle", { gain: 0.6 });
      this.levelFail("Zib was hiding here!");
    }
  }

  // ------------------------------------------------------------ drawing
  private drawSky(g: G) {
    const W = this.W, H = this.H;
    const pal: Record<Theme, [string, string, string]> = {
      party: ["#120a35", "#3b1a78", "#6e2fa8"], moon: ["#0a0f2e", "#1e2b66", "#3c4f9a"], station: ["#091a2b", "#13405a", "#1f6f80"], beach: ["#2a0f4a", "#a0306f", "#ff8a5c"],
    };
    const [c0, c1, c2] = pal[this.theme];
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, c0); bg.addColorStop(0.6, c1); bg.addColorStop(1, c2);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (const s of this.stars) { g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 1.5 + s.tw)); g.fillStyle = "#fff"; g.beginPath(); g.arc(s.x * W, s.y * H * 0.6, s.r, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    // ringed planet
    const px = W * 0.82, py = Math.max(60, this.area.y * 0.5), pr = Math.min(W, H) * 0.09;
    blob(g, px, py, pr, pr, this.theme === "beach" ? "#FFC93C" : "#FF8FB1", { gloss: 0.4 });
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 4; g.beginPath(); g.ellipse(px, py, pr * 1.7, pr * 0.42, -0.3, 0, Math.PI * 2); g.stroke();
    // ground
    const gy = this.area.y + this.area.h * 0.08;
    const gr = g.createLinearGradient(0, gy, 0, H);
    const ground: Record<Theme, string> = { party: "#4b2f7a", moon: "#7a7f9a", station: "#3d5566", beach: "#e9b77a" };
    gr.addColorStop(0, lighten(ground[this.theme], 0.08)); gr.addColorStop(1, darken(ground[this.theme], 0.25));
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, gy); for (let x = 0; x <= W; x += 30) g.lineTo(x, gy + Math.sin(x * 0.02) * 10); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    for (let i = 0; i < 9; i++) { const cx = ((i * 137) % W), cy = gy + 40 + ((i * 91) % Math.max(60, H - gy - 60)); g.fillStyle = "rgba(0,0,0,0.12)"; g.beginPath(); g.ellipse(cx, cy, 22 + (i % 3) * 10, 8 + (i % 2) * 4, 0, 0, Math.PI * 2); g.fill(); }
    if (this.theme === "party") for (let i = 0; i < 6; i++) { const x = W * (0.08 + i * 0.17); const y = this.area.y + 20 + Math.sin(this.t + i) * 6; g.strokeStyle = "rgba(255,255,255,0.4)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + 20); g.lineTo(x + 3, y + 60); g.stroke(); blob(g, x, y, 13, 16, ["#FF6F91", "#FFD25A", "#2EC4B6", "#74C94E", "#FF8A3D", "#3B82F6"][i], { gloss: 0.6 }); }
  }

  protected drawBackground(g: G) {
    this.drawSky(g);
    const A = this.area;
    const demo = [this.makeAlien("#2EC4B6", 2, 2, false), this.makeAlien("#8E5BE8", 1, 1, true), this.makeAlien("#FF8A3D", 3, 0, false), this.makeAlien("#8E5BE8", 2, 1, false)];
    demo.forEach((a, i) => { a.s = 34; a.x = this.W * (0.2 + i * 0.2); a.y = A.y + A.h * 0.45 + (i % 2) * 30; a.ph = i; this.drawAlien(g, a); });
  }

  protected draw(g: G) {
    this.drawSky(g);
    for (const a of this.crowd) this.drawAlien(g, a);
    const z = this.crowd.find((c) => c.zib);
    if (z && this.radar && !this.found) {
      const off = 46; // ring centred near Zib, not on him
      const rx = z.x + Math.sin(z.ph * 3) * off, ry = z.y - z.s + Math.cos(z.ph * 2) * off * 0.6;
      g.strokeStyle = `rgba(183,255,90,${0.5 + Math.sin(this.t * 6) * 0.3})`; g.lineWidth = 4; g.setLineDash([12, 10]);
      g.beginPath(); g.arc(rx, ry, Math.min(this.W, this.H) * 0.17, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    if (z && this.beam > 0) {
      const u = ease.out(this.beam);
      const gr = g.createLinearGradient(z.x, 0, z.x, z.y);
      gr.addColorStop(0, "rgba(183,255,90,0.0)"); gr.addColorStop(1, `rgba(183,255,90,${0.45 * (1 - u * 0.5)})`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(z.x - z.s * 0.6, 0); g.lineTo(z.x + z.s * 0.6, 0); g.lineTo(z.x + z.s * 1.6, z.y); g.lineTo(z.x - z.s * 1.6, z.y); g.closePath(); g.fill();
      // UFO swoops in
      const ux = z.x, uy = -40 + (z.y - z.s * 4 + 40) * Math.min(1, u * 1.5);
      blob(g, ux, uy, z.s * 1.6, z.s * 0.45, "#C9D2E3", { gloss: 0.7 });
      blob(g, ux, uy - z.s * 0.35, z.s * 0.7, z.s * 0.5, "#9FE6FF", { gloss: 0.8 });
    }
  }

  private drawAlien(g: G, a: Alien) {
    const bob = Math.sin(this.t * 3 + a.ph) * a.s * 0.06;
    const lift = a.jump > 0 ? (a.zib && this.beam > 0 ? -ease.in(a.jump) * a.s * 5 : -Math.sin(Math.min(1, a.jump) * Math.PI) * a.s * 1.6) : 0;
    const x = a.x + Math.sin(a.nope * 20) * a.nope * 5, y = a.y + bob + lift, s = a.s;
    shadow(g, a.x, a.y + 2, s * 0.95, s * 0.22, 0.3);
    g.save(); g.translate(x, y);
    const [rx, ry] = a.shape === "tall" ? [0.75, 1.35] : a.shape === "round" ? [1.05, 0.95] : a.shape === "bean" ? [0.95, 1.1] : [0.85, 1.15];
    // feet
    blob(g, -s * 0.3, -s * 0.08, s * 0.24, s * 0.12, darken(a.color, 0.25));
    blob(g, s * 0.3, -s * 0.08, s * 0.24, s * 0.12, darken(a.color, 0.25));
    // antennas
    const top = -s * (0.15 + ry * 1.9);
    for (let i = 0; i < a.ant; i++) {
      const ox = a.ant === 1 ? 0 : (i ? 0.32 : -0.32) * s;
      const tx = ox * 1.6 + Math.sin(this.t * 2 + a.ph + i) * s * 0.08, ty = top - s * 0.75;
      g.strokeStyle = a.color; g.lineWidth = s * 0.09; g.lineCap = "round"; g.beginPath(); g.moveTo(ox, top + s * 0.15); g.quadraticCurveTo(ox * 1.2, top - s * 0.4, tx, ty); g.stroke();
      const glowC = a.zib ? "#B7FF5A" : "#FFE38A";
      const gl = g.createRadialGradient(tx, ty, 0, tx, ty, s * 0.35); gl.addColorStop(0, glowC); gl.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gl; g.beginPath(); g.arc(tx, ty, s * 0.35, 0, Math.PI * 2); g.fill();
      blob(g, tx, ty, s * 0.13, s * 0.13, glowC, { gloss: 0.7 });
    }
    // body
    g.beginPath(); g.ellipse(0, -s * (0.15 + ry * 0.95), s * rx, s * ry * 0.95, 0, 0, Math.PI * 2);
    clayFill(g, a.color, 0, -s * ry, s * Math.max(rx, ry), { gloss: 0.45 });
    blob(g, 0, -s * 0.55, s * rx * 0.55, s * 0.36, lighten(a.color, 0.3), { gloss: 0.15 });
    // arms
    g.strokeStyle = a.color; g.lineWidth = s * 0.16; g.lineCap = "round";
    const wave = Math.sin(this.t * 6 + a.ph) * 0.4;
    g.beginPath(); g.moveTo(-s * rx * 0.85, -s * 0.9); g.lineTo(-s * rx * 1.25, -s * (1.0 + Math.max(0, wave))); g.stroke();
    g.beginPath(); g.moveTo(s * rx * 0.85, -s * 0.9); g.lineTo(s * rx * 1.25, -s * (1.0 + Math.max(0, -wave))); g.stroke();
    // face
    const fy = -s * (0.15 + ry * 1.25);
    const look = (a.nope > 0 ? [Math.sin(a.nope * 18), 0] : [Math.sin(this.t * 0.8 + a.ph) * 0.4, 0]) as [number, number];
    if (a.eyes === 1) eye(g, 0, fy, s * 0.42, { look, pupil: 0.46 });
    else if (a.eyes === 2) for (const sd of [-1, 1]) eye(g, sd * s * 0.3, fy, s * 0.25, { look, pupil: 0.5 });
    else for (const [ex, ey] of [[-0.36, 0.05], [0.36, 0.05], [0, -0.3]]) eye(g, ex * s, fy + ey * s, s * 0.2, { look, pupil: 0.5 });
    mouth(g, 0, fy + s * 0.6, s * 0.45, a.nope > 0.3 ? "oh" : a.mouthK);
    if (a.hat === 1) { g.beginPath(); g.moveTo(-s * 0.3, top + s * 0.2); g.lineTo(s * 0.3, top + s * 0.2); g.lineTo(0, top - s * 0.55); g.closePath(); clayFill(g, hsl((a.ph * 60) % 360, 75, 60), 0, top - s * 0.1, s * 0.4); star(g, 0, top - s * 0.58, s * 0.1, "#FFD25A"); }
    else if (a.hat === 2) { rr(g, -s * 0.4, top - s * 0.05, s * 0.8, s * 0.22, s * 0.08); clayFill(g, "#23305A", 0, top, s * 0.4); rr(g, -s * 0.25, top - s * 0.42, s * 0.5, s * 0.4, s * 0.08); clayFill(g, "#23305A", 0, top - s * 0.25, s * 0.35); }
    g.restore();
  }
}
