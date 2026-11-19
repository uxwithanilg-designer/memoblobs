"""In-game action shots for posters and thumbnails (needs `next dev` on :3000).

python scripts/art/capture_action.py rush [wide|tall]     Rollo mid-run on several stages, the game's own cinematic camera
                                                          -> out/src/rollo-rush/run_<size>_<stage>_<k>.jpg
python scripts/art/capture_action.py race [slug ...]      the whole field racing, from a camera ahead of / beside the pack
                                                          -> out/src/<slug>/pack_<angle>_<size>.png
"""
import base64
import json
import os
import sys

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "out", "src")
BASE = "http://localhost:3000"
SIZES = {"wide": (1600, 900, 1.2), "tall": (720, 1080, 1.5)}
HIDE = ("(() => { const st = document.createElement('style'); st.textContent = `body * { visibility: hidden !important; } "
        "canvas { visibility: visible !important; } nextjs-portal { display: none !important; }`; document.head.appendChild(st); })()")
ARGS = ["--mute-audio", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"]


def save_data_url(url, path):
    open(path, "wb").write(base64.b64decode(url.split(",", 1)[1]))


# ------------------------------------------------------------------ Rollo Rush
# the game's chase camera sits far behind Rollo; for key art the camera moves round him for one frame:
# [ahead of Rollo (m), to the side (m), height (m), look ahead (m), look height (m), fov]
RUSH_GRAB = """([ahead, side, up, la, lu, fov]) => { const S = window.__rush && window.__rush.last; if (!S || !S.sim) return null;
  const R = S.r, r = S.sim.r, cam = R.camera;
  cam.position.copy(R.tp(r.s + ahead, r.u + side, (r.h || 0) + up)); cam.up.set(0, 1, 0); cam.fov = fov; cam.updateProjectionMatrix();
  cam.lookAt(R.tp(r.s + la, r.u, (r.h || 0) + lu));
  return R.capture(0.93); }"""
RUSH_ANGLES = {
    "front34": [3.6, 1.9, 1.15, 0.2, 1.0, 38],  # running at us, three-quarter
    "low": [3.0, -1.6, 0.4, 0.0, 1.5, 46],      # low hero angle looking up
    "close": [2.4, 1.2, 0.9, 0.0, 1.05, 34],    # tight on Rollo
    "side": [0.6, 3.0, 0.8, 1.0, 1.1, 44],      # tracking alongside, inside the fence
}


def rush(sizes):
    d = os.path.join(SRC, "rollo-rush"); os.makedirs(d, exist_ok=True)
    stages = [int(x) for x in os.environ.get("RUSH_STAGES", "4,19,27,52").split(",")]
    for size in sizes:
        w, h, dpr = SIZES[size]
        for st in stages:
            with sync_playwright() as p:
                b = p.chromium.launch(channel="chrome", args=ARGS)
                pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=dpr)
                pg.add_init_script("""((n) => { try { const k = 'momoblobs:rollorush'; const raw = JSON.parse(localStorage.getItem(k) || '{"state":{},"version":1}');
                  raw.state = Object.assign(raw.state || {}, { stage: n, seenIntro: true, lives: 3, check: -1 }); localStorage.setItem(k, JSON.stringify(raw)); } catch (e) {} })(%d)""" % st)
                pg.goto(f"{BASE}/play?g=rollo-rush", wait_until="domcontentloaded", timeout=180000)
                btn = pg.get_by_role("button", name="Play Rollo Rush")
                btn.first.wait_for(timeout=180000)
                pg.wait_for_timeout(2500)
                btn.first.click()
                pg.wait_for_timeout(1500)
                pg.evaluate(HIDE)
                for k in range(5):
                    pg.wait_for_timeout(1500)
                    for name, a in RUSH_ANGLES.items():
                        url = pg.evaluate(RUSH_GRAB, a)
                        if url: save_data_url(url, os.path.join(d, f"run_{size}_{st:03d}_{k}_{name}.jpg"))
                b.close()
            print("rush", size, "stage", st, flush=True)


# ------------------------------------------------------------------ racing
RACE = {
    "nitro-rush": dict(themeId="sunny-circuit", carId="thunder-v8", mode="race"),
    "drift-kings": dict(themeId="dk-touge-pass", carId="dk-sakura-86", mode="race"),
    "highway-heat": dict(themeId="hh-sunny-interstate", carId="hh-canyon-muscle", mode="race"),
    "moto-rush": dict(themeId="mr-sunny-raceway", carId="mr-sprint-400", mode="race"),
}
START = """async (cfg) => {
  const S = window.__RaceSession;
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000';
  document.body.appendChild(host);
  const s = new S(host, cfg, { quality: 'high', camera: 'chase', renderScale: 1, onHud: () => {}, onEvent: () => {} });
  await s.init(); window.__race = s; s.pause();
}"""
# just after the lights go out the whole field is still bunched together
RUN = """(t) => { const s = window.__race; s.debugAdvance(6.2); s.debugAutopilot && s.debugAutopilot('hard'); s.debugAdvance(t);
  const cars = s.racers.map((r) => r.car); const ds = cars.map((c) => s.track.delta(s.player.car.s, c.s));
  return { n: cars.length, spread: Math.max(...ds) - Math.min(...ds) }; }"""
# a camera framed on the pack: [where (lead|tail|mid), ahead of that car (m), side (m), up (m), look at (pack|lead), look up, fov]
GRAB = """([where, ahead, side, up, lookAt, lookUp, fov]) => {
  const r = window.__race, cam = r.camera, V = cam.position.constructor;
  if (r.items && r.items.group) r.items.group.visible = false;
  const cars = r.racers.filter((x) => !x.out).map((x) => x.car);
  // track.delta(a, b) = b - a, wrapped round the lap
  const lead = cars.reduce((m, c) => (r.track.delta(m.s, c.s) > 0 ? c : m), cars[0]);
  const tail = cars.reduce((m, c) => (r.track.delta(m.s, c.s) < 0 ? c : m), cars[0]);
  const ds = cars.map((c) => r.track.delta(tail.s, c.s)); const midS = tail.s + ds.reduce((a, b) => a + b, 0) / ds.length;
  const midD = cars.reduce((a, c) => a + c.d, 0) / cars.length;
  const base = where === "lead" ? lead : where === "tail" ? tail : { s: midS, d: midD };
  const pos = r.track.point(base.s + ahead, side, new V()); pos.y += up;
  const tgt = lookAt === "lead" ? lead : { s: midS, d: midD };
  const look = r.track.point(tgt.s, tgt.d, new V()); look.y += lookUp;
  cam.position.copy(pos); cam.up.set(0, 1, 0); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(look);
  r.renderer.render(r.scene, cam);
  return r.renderer.domElement.toDataURL('image/png');
}"""
ANGLES = {
    "head": ["lead", 14, 3.5, 1.6, "pack", 0.6, 38],     # in front of the leader, low, the whole pack charging at you
    "high": ["lead", 10, -7, 7.5, "pack", 0.0, 44],      # higher front three-quarter: every car visible
    "chase": ["tail", -9, -1.5, 3.0, "lead", 0.8, 50],   # behind the last car, the field streaming away
    "side": ["mid", 2, -13, 1.8, "pack", 0.6, 46],       # trackside, the pack side by side
    "tele": ["lead", 48, 2.5, 2.4, "pack", 0.7, 17],     # long lens far ahead: the whole field squeezed together
    "teleside": ["lead", 34, -9, 3.2, "pack", 0.5, 20],  # long lens from the outside of the bend
}


def race(slugs):
    for slug in slugs:
        d = os.path.join(SRC, slug); os.makedirs(d, exist_ok=True)
        cfg = {"game": slug, "variant": 0, "reverse": False, "laps": 3, "opponents": 7, "ai": "hard", "paint": 0,
               "upgrades": {"speed": 0, "accel": 0, "handling": 0, "nitro": 0}, "weather": "clear", "night": "auto", "pickups": False, "hazards": False}
        cfg.update(RACE[slug])
        for size, (w, h, dpr) in SIZES.items():
            with sync_playwright() as p:
                b = p.chromium.launch(channel="chrome", args=ARGS)
                pg = b.new_page(viewport={"width": int(w * dpr), "height": int(h * dpr)}, device_scale_factor=1)
                pg.set_default_timeout(300000)
                pg.goto(f"{BASE}/play?g={slug}", wait_until="load", timeout=180000)
                pg.wait_for_function("!!window.__RaceSession", timeout=300000)
                try:
                    pg.evaluate(START, cfg)
                except Exception as e:
                    if cfg["mode"] != "race": raise
                    print("race mode failed, trying drift", slug, str(e)[:120]); cfg["mode"] = "drift"; pg.evaluate(START, cfg)
                info = pg.evaluate(RUN, float(os.environ.get("RACE_T", "1.7")))
                for name, a in ANGLES.items():
                    save_data_url(pg.evaluate(GRAB, a), os.path.join(d, f"pack_{name}_{size}.png"))
                near = info
                b.close()
            print("race", slug, size, near, flush=True)


# ------------------------------------------------------------------ Rollo in a loop
# run until Rollo is a set way round a loop, freeze the game there, then shoot from outside the ring and close up
LOOP_WAIT = """async (target) => { const S = window.__rush && window.__rush.last;
  for (let i = 0; i < 6000; i++) { await new Promise((ok) => requestAnimationFrame(ok));
    if (!S || !S.sim || !S.tr) continue; const tr = S.tr, r = S.sim.r, gi = tr.seg[Math.max(0, Math.min(tr.n - 1, Math.floor(r.s)))], g = tr.segs[gi];
    if (g && g.tag === "loop") { const k = (r.s - tr.segStart[gi]) / g.len; if (k >= target && k < target + 0.1) { S.pause(); return k; } } }
  return null; }"""
LOOP_GRAB = """([kind, dist, lift, fov]) => { const S = window.__rush.last, R = S.r, r = S.sim.r, tr = S.tr, cam = R.camera, V = cam.position.constructor;
  const gi = tr.seg[Math.max(0, Math.min(tr.n - 1, Math.floor(r.s)))], s0 = tr.segStart[gi], g = tr.segs[gi];
  if (kind === "game") return R.capture(0.94);
  const n = R.tp(r.s, r.u, 2).sub(R.tp(r.s, r.u, 0)).normalize();  // the loop's "up" where Rollo is
  const me = R.tp(r.s, r.u, 1.0);
  if (kind === "close" || kind === "front") {
    const sgn = kind === "front" ? 1 : -1;
    cam.position.copy(R.tp(r.s + sgn * dist, r.u + 1.7, lift)); cam.up.copy(n); cam.fov = fov; cam.updateProjectionMatrix();
    cam.lookAt(kind === "front" ? me : R.tp(r.s + 1.5, r.u, 0.9));
    return R.capture(0.94);
  }
  const a0 = R.tp(s0 - 4, 0, 0), b0 = R.tp(s0, 0, 0), f0 = b0.clone().sub(a0).normalize(), right0 = f0.clone().cross(new V(0, 1, 0)).normalize();
  if (kind === "entry") {  // behind and above Rollo as he enters, the ring towering ahead
    cam.position.copy(R.tp(r.s - dist, r.u - 0.9, lift)); cam.up.set(0, 1, 0); cam.fov = fov; cam.updateProjectionMatrix();
    cam.lookAt(me.clone().lerp(R.tp(s0 + g.len * 0.5, 0, 0), 0.28));
    return R.capture(0.94);
  }
  if (kind === "profile") {  // off the open side of the ring, level with Rollo, looking straight at him
    const shift = (g.shift || 0) * Math.min(1, Math.max(0, (r.s - s0) / g.len));
    const pos = me.clone().add(right0.clone().multiplyScalar(dist + shift * 0.2)).add(new V(0, lift, 0));
    cam.position.copy(pos); cam.up.set(0, 1, 0); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(me);
    return R.capture(0.94);
  }
  // outside the ring: its real centre from four points round it, the camera off to one side
  let c = new V(); for (const q of [0, 0.25, 0.5, 0.75]) c.add(R.tp(s0 + g.len * q, 0, 0)); c.multiplyScalar(0.25);
  const a = R.tp(s0 - 4, 0, 0), b = R.tp(s0, 0, 0), f = b.clone().sub(a).normalize(), right = f.clone().cross(new V(0, 1, 0)).normalize();
  const side = kind === "ringL" ? -1 : 1;
  const pos = c.clone().add(right.clone().multiplyScalar(side * dist)).add(f.clone().multiplyScalar(-dist * 0.25)).add(new V(0, lift, 0));
  cam.position.copy(pos); cam.up.set(0, 1, 0); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(c.clone().lerp(me, 0.35));
  return R.capture(0.94); }"""
LOOP_ANGLES = {
    0.02: [("entry", 4.5, 1.6, 58), ("entry", 6.5, 2.4, 62), ("game", 0, 0, 0)],
    0.1: [("entry", 4.5, 1.6, 58), ("game", 0, 0, 0)],
    0.24: [("profile", 4.5, 0.4, 52), ("profile", 7, 0.8, 50), ("profile", -4.5, 0.4, 52)],
    0.42: [("profile", 5, 0.4, 52), ("profile", 8, 0.8, 50)],
}


def rushloop(sizes):
    d = os.path.join(SRC, "rollo-rush"); os.makedirs(d, exist_ok=True)
    stages = [int(x) for x in os.environ.get("LOOP_STAGES", "1,21,41").split(",")]
    for size in sizes:
        w, h, dpr = SIZES[size]
        for st in stages:
            got = 0
            with sync_playwright() as p:
                b = p.chromium.launch(channel="chrome", args=ARGS)
                pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=dpr)
                pg.add_init_script("""((n) => { try { const k = 'momoblobs:rollorush'; const raw = JSON.parse(localStorage.getItem(k) || '{"state":{},"version":1}');
                  raw.state = Object.assign(raw.state || {}, { stage: n, seenIntro: true, lives: 3, check: -1 }); localStorage.setItem(k, JSON.stringify(raw)); } catch (e) {} })(%d)""" % st)
                pg.goto(f"{BASE}/play?g=rollo-rush", wait_until="domcontentloaded", timeout=180000)
                btn = pg.get_by_role("button", name="Play Rollo Rush"); btn.first.wait_for(timeout=180000)
                pg.wait_for_timeout(2500); btn.first.click(); pg.wait_for_timeout(1200); pg.evaluate(HIDE)
                pg.set_default_timeout(240000)
                for t, angles in LOOP_ANGLES.items():
                    k = pg.evaluate(LOOP_WAIT, t)
                    if k is None: break
                    for name, *a in angles:
                        url = pg.evaluate(LOOP_GRAB, [name, *a])
                        if url: save_data_url(url, os.path.join(d, f"loop_{size}_{st:03d}_{int(t * 100):02d}_{name}_{a[0]}.jpg"))
                    got += 1
                    pg.evaluate("window.__rush.last.resume()")
                b.close()
            print("rushloop", size, "stage", st, "shots", got, flush=True)


if __name__ == "__main__":
    cmd, rest = sys.argv[1], sys.argv[2:]
    if cmd == "rush": rush(rest or ["wide", "tall"])
    elif cmd == "race": race(rest or list(RACE))
    elif cmd == "rushloop": rushloop(rest or ["wide", "tall"])
