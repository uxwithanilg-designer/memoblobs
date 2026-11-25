"""Rumble Rally QA: races sampled stages in the real game (headless Chrome, muted, the dev server on PORT, default 3000)
with a bot at the wheel, frame by frame with drawing switched off, and prints each race: the stage, its difficulty, the
place it needs, the place the bot got (L = the rivals took the places first, T = it never finished), the race time,
the bot's crashes and rocket hits, and where each rival ended (a finishing place, or its distance).

Bots: careful (reads the track ahead, balances in the air, uses nitro and rockets — it should make the podium or
better on most races with a stock truck early on, and with a few upgrades later), slow (80% speed, no nitro, no
rockets: a casual player — it should manage the first races), naive (full gas everywhere, no air control — it should
crash and fail).

usage: PORT=3000 python scripts/rumble_sweep.py [from] [to] [step] [bot] [upgrade level] [truck]
  e.g. python scripts/rumble_sweep.py 1 600 25 careful 0 brawler
"""
import os
import sys

PORT = os.environ.get("PORT", "3000")
HARNESS = """([stages, mode, lvl, truck]) => {
  const g = window.__rumbleRally;
  g.stop(); g.render = () => {};
  const L = Number(lvl);
  g.setTruck(truck, { engine: L, nitro: L, rockets: L, absorbers: L, armor: L });
  g.opts.onEvent = () => {}; g.opts.onHud = () => {}; g.opts.onCoins = () => {}; g.opts.onLives = () => {};
  const out = [];
  for (const n of stages) {
    g.lives = 3;
    g.load(n, 'grid');
    let t = 0, lastFire = 0;
    while (t < 400 && g.mode !== 'over') {
      const R = g.you.truck, co = g.course, T = co.terrain;
      if (g.mode === 'play' && g.you.down === 0 && !g.you.done) {
        let gas = 1, brake = 0, nitro = false;
        if (mode !== 'naive') {
          const top = R.spec.maxSpin * R.spec.wheel.r;
          if (R.grounded) {
            const pitch = R.a - Math.atan(T.slopeAt(R.x));
            let tgt = top * (mode === 'slow' ? 0.8 : 0.95);
            const look = 10 + Math.max(0, R.forward) * 1.1;
            let drop = 0; for (let d = 4; d < look; d += 2) { const sl = (T.heightAt(R.x + d + 2) - T.heightAt(R.x + d)) / 2; if (sl < drop) drop = sl; }
            if (drop < -0.32) tgt = top * 0.75;
            for (const rp of co.ramps) if (rp > R.x && rp - R.x < look) tgt = Math.min(tgt, top * 0.9);
            for (const p of co.pits) if (p.x0 > R.x && p.x0 - R.x < look + 10) tgt = top;
            const v = R.forward;
            gas = v < tgt ? 1 : 0.3; brake = v > tgt + 3 ? 0.6 : 0;
            if (pitch > 0.42) gas = 0; else if (pitch < -0.45) gas = 1;
            nitro = mode !== 'slow' && Math.abs(pitch) < 0.15 && drop > -0.2 && g.you.nitro > 0.5 && v < top * 1.1;
          } else {
            const land = Math.atan(T.slopeAt(R.x + Math.max(2, R.vx * 0.5))) + 0.06;
            const ctrl = -((R.a - land) * 2.2 + R.w * 0.38);
            gas = ctrl > 0.12 ? 1 : 0; brake = ctrl < -0.12 ? 1 : 0;
          }
          const ahead = g.racers.find((o) => !o.you && !o.down && !o.ghost && o.truck.x - R.x > 8 && o.truck.x - R.x < 28 && Math.abs(o.truck.y - R.y) < 4);
          if (mode !== 'slow' && ahead && g.you.ammo > 0 && t - lastFire > 1.5) { g.fire(); lastFire = t; }
        }
        g.setTouch(gas, brake); g.setNitro(nitro);
      } else { g.setTouch(0, 0); g.setNitro(false); }
      g.frame(1 / 60); t += 1 / 60;
      if (!Number.isFinite(g.you.truck.x)) break;
    }
    const plan = g.course.plan;
    const place = g.mode === 'over' ? (g.lost ? 'L' : String(g.you.done)) : 'T';
    out.push({ n, d: plan.difficulty, pass: plan.pass, place, ok: place !== 'L' && place !== 'T' && Number(place) <= plan.pass, t: g.stats.time, crashes: g.stats.crashes, hits: g.stats.hits,
      rivals: g.racers.slice(1).map((r) => r.done ? `#${r.done}` : `${Math.round(r.truck.x)}m`).join(' ') });
  }
  return out;
}"""


def main():
    from playwright.sync_api import sync_playwright
    a = sys.argv[1:]
    lo, hi, step = int(a[0]) if a else 1, int(a[1]) if len(a) > 1 else 60, int(a[2]) if len(a) > 2 else 5
    bot, lvl, truck = (a[3] if len(a) > 3 else "careful"), (a[4] if len(a) > 4 else "0"), (a[5] if len(a) > 5 else "brawler")
    stages = list(range(lo, hi + 1, step))
    ok = 0
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio"])
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.goto(f"http://localhost:{PORT}/play?g=rumble-rally", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => window.__rumbleRally && window.__rumbleRally.course", timeout=180000)
        for i in range(0, len(stages), 6):
            for r in pg.evaluate(HARNESS, [stages[i:i + 6], bot, lvl, truck]):
                ok += r["ok"]
                print(f"race {r['n']:4d}  d {r['d']:.2f}  need {r['pass']}  got {r['place']:>2}  {'PASS' if r['ok'] else 'fail'}  {r['t']:5.0f}s  crashes {r['crashes']}  hits {r['hits']:2d}  rivals {r['rivals']}", flush=True)
        b.close()
    print(f"{bot} bot, {truck} at upgrade level {lvl}: {ok}/{len(stages)} races passed")


if __name__ == "__main__":
    main()
