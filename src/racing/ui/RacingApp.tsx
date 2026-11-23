"use client";
// The racing front-end: home, career, quick-race stepper, garage, settings, the race itself and results.
// Screens slide like a native app; the site chrome stays on the title screen and is replaced by each
// screen's own app bar (immersive mode) everywhere else. Saves per game.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Overpass, Russo_One, Saira } from "next/font/google";
import { AnimatePresence, motion } from "motion/react";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio } from "@/lib/audio";
import { gameOf, getCar, getTheme, setActiveGame } from "../games";
import { buildCareer, isUnlocked, levelConfig, type CareerLevel } from "../levels";
import { NO_UPGRADES, racingStore, useRacingHydrated } from "../save";
import type { CameraView, RaceConfig, RaceResult } from "../types";
import { Backdrop, HIGHWAY_UI_SOUNDS, MOTO_UI_SOUNDS, NR_CSS, STREET_UI_SOUNDS, UI_SOUNDS, isAutomation, isTouchDevice, screenVariants } from "./kit";
import { Home } from "./Home";
import { Career, WORLDS, nextLevel } from "./Career";
import { QuickRace } from "./QuickRace";
import { Garage, isNewCar } from "./Garage";
import { SettingsScreen } from "./SettingsScreen";
import { Results, type ResultInfo } from "./Results";
import { RaceView } from "./RaceView";

// Drift Kings' street skin uses a motorsport display font (Nitro Rush keeps the rounded site font)
const russo = Russo_One({ weight: "400", subsets: ["latin"], variable: "--font-drift", display: "swap" });
// Highway Heat's road-sign skin uses Overpass (a Highway Gothic style face)
// Moto Rush GP's paddock skin uses Saira (a motorsport face)
const saira = Saira({ weight: ["800", "900"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-moto", display: "swap" });
const overpass = Overpass({ weight: ["800", "900"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-highway", display: "swap" });

type Screen = "home" | "career" | "quick" | "garage" | "settings" | "race" | "results";
const DEPTH: Record<Screen, number> = { home: 0, career: 1, quick: 1, settings: 1, garage: 2, race: 3, results: 4 };

export default function RacingApp({ slug, title }: { slug: string; title: string }) {
  // one racing game is mounted at a time: its garage, worlds and career drive every screen
  setActiveGame(slug);
  const game = gameOf(slug), CARS = game.cars;
  const store = racingStore(slug, gameOf(slug).cars[0].id, gameOf(slug).themes[0].id);
  const ready = useRacingHydrated(store);
  const s = store();
  const player = usePlayer();
  const { setImmersive, setLoading, goLandscape } = player;
  const [screen, setScreen] = useState<Screen>("home");
  const cur = useRef<Screen>("home");
  const [dir, setDir] = useState(1);
  const [cfg, setCfg] = useState<RaceConfig | null>(null);
  const [raceKey, setRaceKey] = useState(0);
  const [tutorial, setTutorial] = useState(false);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [garageId, setGarageId] = useState(s.carId);
  const [garageBack, setGarageBack] = useState<Screen>("home");
  const [world, setWorld] = useState(0);
  const [sheet, setSheet] = useState<CareerLevel | null>(null);
  const career = useMemo(() => buildCareer(gameOf(slug).themes, gameOf(slug).career), [slug]);
  const worlds = useMemo(() => WORLDS(), []);
  const stars = s.totalStars();
  const carOpen = (id: string) => getCar(id).unlockStars <= stars;
  const themeOpen = (id: string) => { const i = career.findIndex((l) => l.themeId === id); return i >= 0 && isUnlocked(career, s.stars, i); };

  const go = useCallback((to: Screen) => {
    setDir(DEPTH[to] >= DEPTH[cur.current] ? 1 : -1);
    cur.current = to;
    setScreen(to);
  }, []);

  useEffect(() => { setLoading(null); }, [setLoading]);
  const street = game.skin === "street", highway = game.skin === "highway", moto = game.skin === "moto";
  useEffect(() => { void audio.preload(street ? [...UI_SOUNDS, ...STREET_UI_SOUNDS] : highway ? [...UI_SOUNDS, ...HIGHWAY_UI_SOUNDS] : moto ? [...UI_SOUNDS, ...MOTO_UI_SOUNDS] : UI_SOUNDS); }, [street, highway, moto]);
  // site chrome on the title screen only; every other screen has its own app bar / race HUD
  useEffect(() => { setImmersive(screen !== "home"); }, [screen, setImmersive]);
  useEffect(() => () => setImmersive(false), [setImmersive]);
  useEffect(() => {
    if (screen === "race") return;
    void audio.playMusic(screen === "results" && cfg ? `a:race_${getTheme(cfg.themeId).music}_calm` : gameOf(slug).menuMusic);
  }, [screen, cfg, slug]);
  const carId = s.carId, selectCar = s.selectCar;
  useEffect(() => { if (ready && (getCar(carId).unlockStars > stars || !CARS.some((c) => c.id === carId))) selectCar(CARS[0].id); }, [ready, stars, carId, selectCar, CARS]);

  const base = () => ({ carId: s.carId, paint: s.paints[s.carId] ?? 0, upgrades: { ...NO_UPGRADES, ...s.upgrades[s.carId] } });
  const rivalFor = (l: CareerLevel) => {
    const tier = Math.min(5, getCar(s.carId).tier + 1 + (l.event === 3 && l.world > 12 ? 1 : 0));
    return [...CARS].filter((c) => c.tier >= Math.min(5, tier)).sort((a, b) => a.unlockStars - b.unlockStars)[0] ?? CARS[CARS.length - 1];
  };

  const launch = (c: RaceConfig) => {
    // phones: fullscreen + landscape (needs this tap's user gesture)
    if (s.settings.landscape && isTouchDevice() && !isAutomation()) void goLandscape();
    let forced = false;
    try { forced = localStorage.getItem("nr:howto") === "1"; } catch { /* private mode */ }
    setTutorial(forced || (!s.tutorialDone && !isAutomation()));
    setCfg(c); setResult(null); setSheet(null); setRaceKey((k) => k + 1); go("race");
  };
  const startLevel = (l: CareerLevel) => launch(levelConfig(l, base(), rivalFor(l).id, slug));
  const startQuick = () => {
    const q = s.quick;
    const solo = q.mode === "timetrial" || q.mode === "coinrush" || q.mode === "drift" || q.mode === "rally" || q.mode === "heat" || q.mode === "escape" || q.mode === "wheelie";
    // a quick drift battle is fair: the rival drives a car of your tier
    const mine = getCar(s.carId), peer = CARS.filter((c) => c.tier === mine.tier && c.id !== mine.id);
    launch({
      ...q, ...base(), game: slug, laps: q.mode === "coinrush" || q.mode === "elimination" || q.mode === "heat" || q.mode === "takedown" || q.mode === "wheelie" ? 99 : q.laps,
      opponents: solo ? 0 : q.mode === "duel" || q.mode === "battle" ? 1 : q.mode === "takedown" ? Math.min(3, q.opponents) : q.opponents,
      timeLimit: q.mode === "takedown" ? 90 : q.mode === "wheelie" ? 50 : 60, coinTarget: [15, 30, 45], rivalCar: q.mode === "battle" ? (peer[0] ?? mine).id : game.bossCar,
    });
  };
  const onFinish = (r: RaceResult) => {
    if (!cfg) return;
    const st = store.getState();
    const before = st.totalStars();
    const level = career.find((l) => l.id === cfg.levelId);
    const prevStars = cfg.levelId ? st.stars[cfg.levelId] ?? 0 : 0;
    if (cfg.levelId) st.setStars(cfg.levelId, r.stars);
    const after = store.getState().totalStars();
    const unlocked = CARS.filter((c) => c.unlockStars > before && c.unlockStars <= after).map((c) => c.id);
    const key = `${cfg.themeId}:${cfg.variant}:${cfg.reverse ? "r" : "f"}`;
    const newBest = r.completed && (cfg.mode === "timetrial" || cfg.mode === "race" || cfg.mode === "rally") ? st.setBest(`${key}:${cfg.mode}:${cfg.laps}`, r.time) : false;
    const hadLap = !!st.bestLaps[key];
    const lapRecord = st.setBestLap(key, r.bestLap) && hadLap;
    const newWorld = level && level.event === 3 && prevStars === 0 && r.stars > 0 ? career[level.index + 1]?.themeId ?? null : null;
    useProfile.getState().earnCoins(r.reward);
    const solo = cfg.mode === "coinrush" || cfg.mode === "timetrial" || cfg.mode === "drift" || cfg.mode === "rally";
    st.recordRace(r.completed && r.pos === 1 && !solo, 0, r.reward, { podium: r.completed && !solo && r.pos <= 3, takedowns: r.takedowns, topSpeed: r.topSpeed });
    setResult({ r, unlocked, newBest, bestLap: lapRecord, level, newWorld, prevStars });
    go("results");
  };
  const openGarage = (from: Screen, id?: string) => {
    const g = id ?? s.carId;
    setGarageId(g); setGarageBack(from);
    if (carOpen(g)) s.markSeen([g]);
    go("garage");
  };
  const openCareer = () => {
    const n = nextLevel(career, s.stars);
    if (n) setWorld(Math.max(0, worlds.findIndex((w) => w.id === n.themeId)));
    go("career");
  };
  const onCamera = useCallback((v: CameraView) => store.getState().setSettings({ camera: v }), [store]);

  if (!ready) return <div className="absolute inset-0 bg-[#0b0718]" />;
  const car = getCar(s.carId);
  const paint = car.colors[s.paints[car.id] ?? 0] ?? car.colors[0];
  const next = nextLevel(career, s.stars);
  const newCars = CARS.filter((c) => isNewCar(c, stars, s.seen)).length;
  const bgAccent = screen === "results" && cfg ? getTheme(cfg.themeId).accent : screen === "career" ? worlds[world]?.accent ?? "#7C3AED" : "#7C3AED";

  return (
    <div className={`nr-noselect absolute inset-0 overflow-hidden text-white ${street ? `nr-street ${russo.variable}` : highway ? `nr-highway ${overpass.variable}` : moto ? `nr-moto ${saira.variable}` : ""}`} onContextMenu={(e) => { if (!(e.target as HTMLElement).closest("input,textarea")) e.preventDefault(); }}>
      <style>{NR_CSS}</style>
      {screen !== "race" && <Backdrop accent={bgAccent} />}
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div key={screen === "race" ? `race-${raceKey}` : screen} custom={dir} variants={screen === "race" ? undefined : screenVariants}
          initial={screen === "race" ? { opacity: 0 } : "enter"} animate={screen === "race" ? { opacity: 1 } : "center"} exit={screen === "race" ? { opacity: 0 } : "exit"}
          transition={{ duration: screen === "race" ? 0.25 : 0.2, ease: "easeOut" }} className="absolute inset-0">
          {screen === "home" && (
            <Home title={title} car={car} paint={paint} stars={stars} maxStars={career.length * 3} carsOwned={CARS.filter((c) => carOpen(c.id)).length} carsTotal={CARS.length}
              newCars={newCars} wins={s.wins} next={next} nextStars={next ? s.stars[next.id] ?? 0 : 0}
              onCareer={openCareer} onNext={() => { openCareer(); if (next) setSheet(next); }}
              onQuick={() => go("quick")} onCoinRush={() => { s.setQuick({ mode: game.feature.mode, themeId: themeOpen(s.quick.themeId) ? s.quick.themeId : game.themes[0].id }); go("quick"); }}
              onGarage={() => openGarage("home")} onSettings={() => go("settings")} />
          )}
          {screen === "career" && (
            <Career career={career} stars={s.stars} total={stars} world={world} setWorld={setWorld} car={car} paint={paint} rivalFor={rivalFor}
              sheet={sheet} setSheet={setSheet} onStart={startLevel} onBack={() => go("home")} onGarage={() => openGarage("career")} />
          )}
          {screen === "quick" && (
            <QuickRace q={s.quick} setQ={s.setQuick} themeOpen={themeOpen} carId={s.carId} selectCar={s.selectCar} carOpen={carOpen}
              paints={s.paints} setPaint={s.setPaint} upgrades={s.upgrades} onStart={startQuick} onBack={() => go("home")} onGarage={() => openGarage("quick")} />
          )}
          {screen === "garage" && (
            <Garage viewId={garageId} setViewId={setGarageId} carId={s.carId} selectCar={s.selectCar} stars={stars} seen={s.seen} markSeen={s.markSeen}
              paints={s.paints} setPaint={s.setPaint} upgrades={s.upgrades} upgrade={s.upgrade}
              onBack={() => go(garageBack === "garage" || garageBack === "race" ? "home" : garageBack)} onCareer={openCareer} />
          )}
          {screen === "settings" && (
            <SettingsScreen settings={s.settings} set={s.setSettings} save={s} onReset={() => { s.reset(); setGarageId(CARS[0].id); }} onBack={() => go("home")} />
          )}
          {screen === "race" && cfg && (
            <RaceView cfg={cfg} settings={s.settings} tutorial={tutorial} onFinish={onFinish}
              onQuit={() => go(cfg.levelId ? "career" : "quick")} onRestart={() => { setResult(null); setRaceKey((k) => k + 1); }}
              onCamera={onCamera} onTutorialDone={() => { store.getState().setTutorialDone(true); setTutorial(false); }}
              onAutoDrive={(on) => store.getState().setSettings({ autoDrive: on })} />
          )}
          {screen === "results" && result && cfg && (
            <Results res={result} cfg={cfg} hasNext={!!result.level && !!career[result.level.index + 1]} vibrateOn={s.settings.vibrate} units={s.settings.units}
              onNext={() => { const n = career[result.level!.index + 1]; if (n) { setWorld(Math.max(0, worlds.findIndex((w) => w.id === n.themeId))); startLevel(n); } }}
              onRetry={() => launch({ ...cfg })} onGarage={(id) => openGarage("results", id)}
              onMenu={() => go(cfg.levelId ? "career" : "home")} onSetup={() => go("quick")} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
