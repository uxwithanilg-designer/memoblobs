// Prints a Puddo's Clayland stage as ASCII (and where the autopilot got stuck or hurt), for checking layouts by eye.
//   node scripts/clay_ascii.mjs <stage> [x0] [x1]
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const n = Number(process.argv[2] ?? 1);
const src = join(import.meta.dirname, "..", "src", "clayland");
const dir = mkdtempSync(join(tmpdir(), "clay-"));
for (const f of ["types", "islands", "physics", "bestiary", "stages", "sim", "bot"]) {
  writeFileSync(join(dir, `${f}.ts`), readFileSync(join(src, `${f}.ts`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"'));
}
const { buildStage } = await import(pathToFileURL(join(dir, "stages.ts")).href);
const { Sim } = await import(pathToFileURL(join(dir, "sim.ts")).href);
const { botInput, newBotMem } = await import(pathToFileURL(join(dir, "bot.ts")).href);
const st = buildStage(n);
const s = new Sim(st, {});
const m = newBotMem();
const hurts = [];
let steps = 0;
while (!s.done && steps < 120 * 120) { s.step(botInput(s, m)); for (const e of s.events) if (e.t === "hurt") hurts.push(`${e.why}@${s.x.toFixed(1)},${s.y.toFixed(1)}`); s.events.length = 0; steps++; }
const x0 = Number(process.argv[3] ?? 0), x1 = Math.min(st.w, Number(process.argv[4] ?? st.w));
const CH = { 0: " ", 1: "#", 2: "B", 3: "=", 4: "-", 5: "%", 6: "^", 7: "~", 8: "w", 9: "i", 10: "c", 11: "*", 12: ">", 13: "<", 14: "A", 15: "b", 16: "s", 17: ":", 18: "o", 19: "1", 20: "2", 21: "p", 22: "|", 23: "W" };
const over = new Map();
const put = (x, y, c) => over.set(`${Math.floor(x)},${Math.floor(y)}`, c);
for (const it of st.items) put(it.x, it.y, it.kind === "coin" ? "." : it.kind === "fruit" ? "f" : it.kind === "drop" ? "D" : "?");
for (const e of st.enemies) put(e.x, e.y + 0.3, "E");
for (const g of st.gadgets) put(g.x, g.y + 0.2, g.kind[0].toUpperCase());
for (const p of st.plats) put(p.x, p.y, "L");
for (const p of st.pots) put(p.x, p.y + 0.3, "P");
for (let y = st.h - 1; y >= 0; y--) {
  let row = String(y).padStart(2) + " ";
  for (let x = x0; x < x1; x++) row += over.get(`${x},${y}`) ?? CH[st.tiles[y * st.w + x]] ?? "?";
  console.log(row);
}
let ruler = "   ";
for (let x = x0; x < x1; x++) ruler += x % 10 === 0 ? String(Math.floor(x / 10) % 10) : " ";
console.log(ruler);
console.log(`stage ${n} ${st.name} (${st.type}, d=${st.d.toFixed(2)}) w=${st.w} goal=${st.goal.x}`);
console.log(`bot: ${s.cleared ? "CLEAR" : "stuck"} at x=${s.x.toFixed(1)} y=${s.y.toFixed(1)} t=${s.t.toFixed(0)}s hurts: ${hurts.slice(0, 12).join("  ")}`);
