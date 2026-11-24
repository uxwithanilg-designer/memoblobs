"use client";
// Sproutpop — a 3D bubble shooter in a greenhouse. Aim from the flower pod, bounce off the glass walls, match three
// or more to pop them and drop everything hanging below. Free every seedling to clear the stage before the shots run
// out. Stages never end and arrive one by one: 500 designed stages across eight gardens (each with its own sky and
// music, closed by a boss), then endless remixes. Phone-app flow: home → stage → clear → next stage.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bomb, ChevronRight, Flower2, Play, RotateCcw, Sparkles, Sprout, Star, Undo2, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { BOMB, BOMB_SHOT, RAINBOW, STONE } from "../grid";
import { DESIGNED, GARDENS, STAGES_PER_GARDEN, bestShot, gardenOf, passOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { addShots, leftoverBonus, loadBooster, newGame, shoot, starsOf, swap, type Game } from "../play";
import { useSprout, useSproutHydrated } from "../save";
import { SproutScene, type SceneSound } from "./Scene";
import { SPROUT_CSS } from "./styles";
import { Title3D } from "./Title3D";

export const SPROUT_SFX = ["shoot", "bounce", "stick", "pop", "blast", "thaw", "fall", "sprout", "firework", "swap", "load", "stone", "combo", "clear", "star", "garden", "lose", "booster", "open"] as const;
type Sfx = (typeof SPROUT_SFX)[number];
const sfxName = (k: Sfx) => `a:sprout_${k}` as Sound;
const music = (k: string) => `a:sprout_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const RESCUE = 5;
const TIPS: Record<string, [string, string]> = {
  stone: ["Stones", "Grey stones never pop. Pop or drop the bubbles holding them up and they fall with the rest."],
  ice: ["Frozen bubbles", "A bubble in ice won't join a match. Pop something right next to it and the ice cracks."],
  bomb: ["Bombs", "Pop a bomb (or hit it with a pop) and it bursts everything around it — stones too."],
  boss: ["Garden boss", "The last stage of every garden is its boss: more seedlings, more rows, a bigger reward."],
  remix: ["Remix gardens", "You've grown all 500 designed stages! From here every stage is a fresh remix — new shapes, new mixes, forever."],
};

interface Result { stage: number; stars: number; coins: number; score: number; gardenDone: boolean; gift: string }
interface Float { id: number; x: number; y: number; text: string; big: boolean }

export default function SproutApp({ slug }: { slug: string; title: string }) {
  const ready = useSproutHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useSprout((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [revived, setRevived] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "out" | "lost" | "help" | "tip">("");
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [toast, setToast] = useState("");
  const [bump, setBump] = useState(0);
  const [busy, setBusy] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<{ stage: number; g: Game } | null>(null);
  const goalRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SproutScene | null>(null);
  const applyPending = useCallback(() => { const sc = sceneRef.current, p = pendingRef.current; if (!sc || !p) return; pendingRef.current = null; sc.setGarden(gardenOf(p.stage)); sc.setStage(p.g); }, []);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null), prevRef = useRef<Game | null>(null);
  const stateRef = useRef({ revived: false, result: false, sheet: "", paused: false, busy: false, undo: true });
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { ...stateRef.current, revived, result: !!result, sheet, paused, busy }; }, [revived, result, sheet, paused, busy]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Watering the garden");
    void audio.preload(SPROUT_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(gardenOf(useSprout.getState().stage).music)]);
    prepareStage(useSprout.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.22, duck: k === "clear" || k === "garden" });
  }, []);

  const addFloat = useCallback((x: number, y: number, text: string, big = false) => {
    const id = Math.random();
    setFloats((f) => [...f.slice(-6), { id, x, y, text, big }]);
    setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 1100);
  }, []);

  const persist = useCallback((g: Game) => {
    const d = defRef.current; if (!d) return;
    useSprout.getState().saveCurrent({ stage: d.stage, game: g, revived: stateRef.current.revived });
  }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback(async (g: Game) => {
    const d = defRef.current!;
    const scene = sceneRef.current;
    const left = g.shots;
    if (scene && left > 0) {
      const p = scene.launcherScreen();
      await scene.celebrate(left, (i) => { if (i % 2 === 0) addFloat(p.x + (Math.random() - 0.5) * 120, p.y - 140 - Math.random() * 120, "+50"); });
    }
    const stars = stateRef.current.revived ? 1 : starsOf(g, d);
    const total = g.score + leftoverBonus(g) + (d.boss ? 500 : 0);
    const coins = 5 + Math.round(g.total * 1.5) + stars * 3 + (d.boss ? 20 : 0);
    useProfile.getState().earnCoins(coins);
    useSprout.getState().win(d.stage, stars, total);
    // gifts: a booster on every garden boss and every 10th stage
    let gift = "";
    if (d.boss) { useSprout.getState().giveBooster("rainbow", 1); useSprout.getState().giveBooster("bomb", 1); gift = "+1 Rainbow · +1 Bomb"; }
    else if (d.stage % 10 === 0) { const b = d.stage % 20 === 0 ? "bomb" : "rainbow"; useSprout.getState().giveBooster(b, 1); gift = b === "bomb" ? "+1 Bomb" : "+1 Rainbow"; }
    const gardenDone = d.stage % STAGES_PER_GARDEN === 0;
    setResult({ stage: d.stage, stars, coins, score: total, gardenDone, gift });
    sfx(gardenDone ? "garden" : "clear", { gain: 0.8 });
    for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    track("sprout_clear", { stage: d.stage, shots: g.fired, stars });
  }, [sfx, addFloat]);

  // ---------------------------------------------------------------- a shot (from the scene)
  const tryShoot = useCallback(async (angle: number) => {
    const g0 = gameRef.current, scene = sceneRef.current, st = stateRef.current;
    if (!g0 || !scene || st.result || st.sheet || st.paused || st.busy) return;
    const { game: g, res } = shoot(g0, angle);
    if (!res.out) return;
    prevRef.current = g0;
    stateRef.current.busy = true; setBusy(true);
    sfx("shoot", { gain: 0.5, rate: 0.95 + Math.random() * 0.1 });
    buzz(8);
    setGame(g);
    persist(g);
    const freedBefore = g0.freed;
    await scene.play(res, g);
    stateRef.current.busy = false; setBusy(false);
    if (g.freed > freedBefore) setBump((b) => b + 1);
    if (res.out.popped.length >= 3 && g.combo > 1) {
      const p = scene.launcherScreen();
      addFloat(p.x, p.y - 220, `Combo ×${g.combo}`, true);
      sfx("combo", { gain: 0.5, rate: Math.min(1.6, 0.9 + g.combo * 0.08) });
    }
    if (res.out.fallen.length >= 6) { const p = scene.launcherScreen(); addFloat(p.x, p.y - 260, res.out.fallen.length >= 12 ? "Avalanche!" : "Big drop!", true); }
    if (res.win) { useSprout.getState().saveCurrent(null); void finishStage(g); }
    else if (res.lose) {
      scene.jolt(); buzz(60);
      sfx("lose", { gain: 0.6 });
      setCanUndo(stateRef.current.undo);
      setTimeout(() => setSheet(res.out!.lost ? "lost" : "out"), 450);
    }
  }, [sfx, addFloat, finishStage, persist]);

  const doSwap = useCallback(() => {
    const g0 = gameRef.current, st = stateRef.current;
    if (!g0 || st.busy || st.result || st.sheet) return;
    const g = swap(g0);
    setGame(g); sceneRef.current?.swap(g); persist(g);
    sfx("swap", { gain: 0.45 });
  }, [sfx, persist]);

  // ---------------------------------------------------------------- scene
  const shootRef = useRef(tryShoot), swapRef = useRef(doSwap);
  useEffect(() => { shootRef.current = tryShoot; swapRef.current = doSwap; }, [tryShoot, doSwap]);
  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const scene = new SproutScene(host.current, {
      shoot: (a) => void shootRef.current(a),
      swap: () => swapRef.current(),
      canAim: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused && !s.busy; },
      goal: () => {
        const h = host.current?.getBoundingClientRect(), g = goalRef.current?.getBoundingClientRect();
        if (!h || !g) return { x: 40, y: -20 };
        return { x: g.left + g.width / 2 - h.left, y: g.top + g.height / 2 - h.top };
      },
      sound: (e: SceneSound, pan: number, n = 0) => {
        if (e === "pop") sfx("pop", { x: pan, gain: 0.55, rate: Math.min(1.8, 0.95 + n * 0.05) });
        else if (e === "fall") sfx("fall", { x: pan, gain: Math.min(0.75, 0.4 + n * 0.03) });
        else if (e === "sprout") sfx("sprout", { x: pan, gain: 0.55, rate: 1 + Math.min(8, n) * 0.06 });
        else if (e === "firework") sfx("firework", { x: pan, gain: 0.5, rate: 0.9 + (n % 5) * 0.08 });
        else if (e === "bounce") sfx("bounce", { x: pan, gain: 0.4 });
        else if (e === "stick") { sfx("stick", { x: pan, gain: 0.5 }); buzz(10); }
        else if (e === "blast") { sfx("blast", { x: pan, gain: 0.7 }); buzz(40); }
        else sfx(e as Sfx, { x: pan, gain: 0.45 });
      },
      float: (x, y, text, big) => addFloat(x, y, text, big),
    });
    sceneRef.current = scene;
    applyPending();
    return () => { scene.dispose(); sceneRef.current = null; };
  }, [screen, sfx, addFloat, applyPending]);

  // ---------------------------------------------------------------- stages
  const start = useCallback(async (stage: number, resume?: { game: Game; revived: boolean }) => {
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const g = resume?.game ?? newGame(d);
    prevRef.current = null; stateRef.current.undo = true; stateRef.current.busy = false;
    setDef(d); setGame(g); setResult(null); setSheet(""); setBusy(false);
    setRevived(resume?.revived ?? false);
    setScreen("game");
    const gd = gardenOf(stage);
    void audio.playMusic(music(gd.music));
    audio.warmMusic([music(gardenOf(stage + STAGES_PER_GARDEN).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    // the scene may not exist yet on the first stage: hand the stage over whichever comes first
    pendingRef.current = { stage, g };
    requestAnimationFrame(() => applyPending());
    const tips = useSprout.getState().tips;
    const flat = d.grid.flat();
    const has: Record<string, boolean> = { stone: flat.some((x) => x?.k === STONE), ice: flat.some((x) => x?.ice), bomb: flat.some((x) => x?.k === BOMB), boss: d.boss, remix: stage > DESIGNED };
    const tip = ["remix", "stone", "ice", "bomb", "boss"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useSprout.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); }
    track("sprout_start", { stage });
  }, [sfx, applyPending]);

  // ---------------------------------------------------------------- boosters
  const applyBoost = (b: "rainbow" | "bomb") => {
    const g0 = gameRef.current; if (!g0 || busy || result) return;
    if (g0.cur === RAINBOW || g0.cur === BOMB_SHOT) { setToast("A booster is already loaded"); return; }
    if (!useSprout.getState().useBooster(b)) { setToast(b === "rainbow" ? "No rainbow bubbles left" : "No bombs left"); return; }
    const g = loadBooster(g0, b === "rainbow" ? RAINBOW : BOMB_SHOT);
    setGame(g); sceneRef.current?.sync(g); persist(g);
    sfx("booster", { gain: 0.6 });
  };
  const doRestart = () => { const d = defRef.current; if (!d) return; useSprout.getState().saveCurrent(null); void start(d.stage); };
  const doRescue = () => { const g0 = gameRef.current; if (!g0) return; const g = addShots(g0, RESCUE); setRevived(true); stateRef.current.revived = true; setGame(g); sceneRef.current?.sync(g); setSheet(""); persist(g); sfx("booster", { gain: 0.6 }); };
  const doUndo = () => {
    const p = prevRef.current; if (!p || !stateRef.current.undo) return;
    stateRef.current.undo = false; prevRef.current = null;
    setRevived(true); stateRef.current.revived = true;
    setGame(p); sceneRef.current?.setStage(p); setSheet(""); persist(p);
    sfx("swap", { gain: 0.5 });
  };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __sprout?: unknown }).__sprout = {
      game: () => gameRef.current, def: () => defRef.current, busy: () => stateRef.current.busy,
      start: (stage: number) => void start(stage),
      shoot: (a: number) => shootRef.current(a),
      best: () => { const g = gameRef.current; if (!g) return null; const a = bestShot(g.grid, g.cur), b = bestShot(g.grid, g.nxt); return b.score > a.score + 20 ? { swap: true, angle: b.angle } : { swap: false, angle: a.angle }; },
      swap: () => swapRef.current(),
      launcher: () => { const sc = sceneRef.current, r = host.current?.getBoundingClientRect(); if (!sc || !r) return null; const p = sc.launcherScreen(); return { x: r.left + p.x, y: r.top + p.y }; },
    };
  }, [start]);

  const leave = () => { const g = gameRef.current; if (g && !result && !busy) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const gd = gardenOf(screen === "game" ? stage : useSprout.getState().stage);
  const night = gd.id === "moonflower" || gd.id === "mushroom";
  const inG = ((stage - 1) % STAGES_PER_GARDEN) + 1;
  return (
    <div className={`spp-root ${night && screen === "game" ? "spp-night" : ""}`} style={{ ["--s1" as string]: gd.sky[0], ["--s2" as string]: gd.sky[1], ["--s3" as string]: gd.sky[2], ["--glow" as string]: gd.glow, ["--ground" as string]: gd.ground }}>
      <style>{SPROUT_CSS}</style>
      <div className="spp-sun" aria-hidden />
      <div className="spp-hills" aria-hidden />
      <div className="spp-petals" aria-hidden>{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ left: `${(i * 53) % 100}%`, background: [gd.glow, "#ffffff", "#ffb3d1", "#b8f08a"][i % 4], animationDuration: `${13 + (i % 6) * 2.4}s`, animationDelay: `${-((i * 2.3) % 15)}s`, ["--r" as string]: `${(i * 71) % 180}deg` }} />)}</div>
      {screen === "home" && <div className="spp-soap" aria-hidden>{Array.from({ length: 12 }, (_, i) => { const sz = 18 + ((i * 13) % 46); return <i key={i} style={{ left: `${(i * 37 + 5) % 100}%`, width: sz, height: sz, animationDuration: `${14 + (i % 5) * 3}s`, animationDelay: `${-((i * 3.1) % 16)}s` }} />; })}</div>}

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-center gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="spp-glass grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="spp-glass min-w-0 flex-1 !rounded-2xl px-3 py-1">
              <p className="spp-display truncate text-lg leading-tight">Stage {stage}{def?.boss && <span className="ml-2 rounded-full bg-[#ff4f6d] px-2 py-0.5 align-middle font-sans text-[10px] font-extrabold tracking-wider text-white uppercase">Boss</span>}</p>
              <p className="truncate text-[11px] font-bold opacity-75">{gd.name}{passOf(stage) ? " · Remix" : ""} · {inG}/{STAGES_PER_GARDEN}</p>
            </div>
            <div ref={goalRef} className="spp-glass spp-sproutpill !rounded-2xl px-3 py-1.5 font-extrabold tabular-nums">
              <Sprout key={bump} className={`size-5 text-[#22b04f] ${bump ? "spp-bump" : ""}`} />{game ? `${game.freed}/${game.total}` : "–"}
            </div>
          </div>
          <div className="mx-4 mt-0.5 flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/50"><div className="h-full rounded-full bg-gradient-to-r from-[#3fd36b] to-[#ffc531] transition-[width] duration-500" style={{ width: `${game ? (game.freed / Math.max(1, game.total)) * 100 : 0}%` }} /></div>
            <span className="spp-glass spp-display !rounded-full px-3 py-0.5 text-lg tabular-nums">{(game?.score ?? 0).toLocaleString()}</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="spp-stage" />
            {floats.map((f) => <span key={f.id} className={`spp-float ${f.big ? "spp-float-big" : ""}`} style={{ left: f.x, top: f.y }}>{f.text}</span>)}
          </div>
          <div className="flex items-end justify-center gap-3 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <div className="spp-glass flex flex-col items-center !rounded-2xl px-3 py-1">
              <span className={`spp-display spp-shots text-2xl leading-none ${game && game.shots <= 3 ? "spp-low" : ""}`}>{game?.shots ?? 0}</span>
              <span className="text-[10px] font-extrabold tracking-wider uppercase opacity-70">Shots</span>
            </div>
            <Tool icon={Sparkles} label="Rainbow" n={boosters.rainbow} on={game?.cur === RAINBOW} onClick={() => applyBoost("rainbow")} />
            <Tool icon={Bomb} label="Bomb" n={boosters.bomb} on={game?.cur === BOMB_SHOT} onClick={() => applyBoost("bomb")} />
            <Tool icon={RotateCcw} label="Restart" onClick={doRestart} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/15 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/40 border-t-[#3fd36b]" /><p className="spp-display text-lg text-white drop-shadow">Planting seeds…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "out" && !result && (
          <Sheet key="out" title="Out of shots!" onClose={() => undefined}>
            <p className="opacity-80">{game ? `${game.total - game.freed} seedling${game.total - game.freed === 1 ? "" : "s"} still waiting.` : ""} {revived ? "Try the stage again." : `Take ${RESCUE} more shots — free, once per stage.`}</p>
            <div className="mt-4 grid gap-2">
              {!revived && <button type="button" className="spp-btn spp-cta spp-shine py-3" onClick={doRescue}><Flower2 className="mr-1 inline size-5" /> +{RESCUE} shots</button>}
              <button type="button" className="spp-btn spp-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "lost" && !result && (
          <Sheet key="lost" title="Too low!" onClose={() => undefined}>
            <p className="opacity-80">A bubble crossed the line at the bottom of the glass. {canUndo ? "Take that shot back once, or start again." : "Start the stage again."}</p>
            <div className="mt-4 grid gap-2">
              {canUndo && <button type="button" className="spp-btn spp-cta py-3" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Take it back</button>}
              <button type="button" className="spp-btn spp-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useSprout.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>🎯 Drag to aim (or move the mouse), let go to shoot. Bounce shots off the glass walls!</li>
              <li>🔵 Three or more of the same colour pop — and everything hanging below them falls.</li>
              <li>🌱 Free every seedling before your shots run out.</li>
              <li>🔄 Tap the flower pod to swap your bubble with the next one.</li>
            </ul>
            <button type="button" className="spp-btn spp-cta mt-5 w-full py-3" onClick={() => { useSprout.getState().sawHelp(); setSheet(""); }}>Let&apos;s grow</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useSprout.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="spp-btn spp-cta mt-5 w-full py-3" onClick={() => { useSprout.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1f4a2a] px-4 py-2 text-sm font-bold whitespace-nowrap text-white shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label, n, on, onClick }: { icon: typeof Sparkles; label: string; n?: number; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`spp-tool ${on ? "spp-tool-on" : ""}`} onClick={onClick}>
      <span className="spp-tool-ico"><Icon className="size-5" />{n !== undefined && <span className="spp-badge">{n}</span>}</span>{label}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="spp-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="spp-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-[#1f4a2a]/10"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClearSheet({ r, onNext, onHome }: { r: Result; onNext: () => void; onHome: () => void }) {
  const [left, setLeft] = useState(r.gardenDone ? 6 : 4);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, onNext]);
  const g = gardenOf(r.stage), ng = gardenOf(r.stage + 1);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/35 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="spp-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="spp-head px-5 pt-6 pb-5">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="spp-display mt-1 text-4xl text-white">{r.gardenDone ? "Garden in bloom!" : `Stage ${r.stage} clear!`}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{r.gardenDone ? `${g.name} is blooming — next: ${ng.name}` : `${g.name} · ${((r.stage - 1) % STAGES_PER_GARDEN) + 1} of ${STAGES_PER_GARDEN}`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="spp-display spp-grad text-5xl">{r.score.toLocaleString()}</p>
          <p className="mt-2 flex items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/40 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="spp-btn spp-cta spp-shine flex items-center justify-center gap-2 py-3" onClick={onNext}>Stage {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="spp-btn spp-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = useSprout();
  const stage = save.stage, gd = gardenOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const gi = Math.floor((stage - 1) / STAGES_PER_GARDEN) % GARDENS.length;
  const remix = passOf(stage) > 0;
  return (
    <div className="spp-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Stage"], [Star, String(save.totalStars), "Stars"], [Sparkles, save.totalScore.toLocaleString(), "Score"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="spp-glass flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0 text-[#22b04f]" />
                <span className="min-w-0"><span className="spp-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Sproutpop — 3D bubble shooter</h1>
        <Title3D fallback={<p className="spp-display spp-grad spp-title mt-5 text-center" aria-hidden>Sproutpop</p>} />
        <p className="-mt-1 max-w-lg text-center text-[14px] leading-snug font-semibold opacity-85 sm:mx-auto">Pop the bubbles, free the seedlings! A 3D bubble shooter with endless stages across eight gardens.</p>

        <div className="spp-shine relative mt-3 overflow-hidden rounded-[30px] p-5 text-white shadow-[0_24px_50px_-24px_rgba(20,90,40,.8)]" style={{ background: `linear-gradient(150deg, ${gd.sky[2]}, ${gd.ground} 120%)` }}>
          <p className="text-xs font-extrabold tracking-widest text-white/90 uppercase"><Flower2 className="mr-1 inline size-4" />{gd.name}{remix ? " · Remix" : ""}</p>
          <p className="spp-display mt-1 text-5xl leading-none drop-shadow">Stage {shown}</p>
          <div className="mt-3 flex gap-1">{Array.from({ length: STAGES_PER_GARDEN }, (_, i) => { const at = (shown - 1) % STAGES_PER_GARDEN; return <span key={i} className={`h-2 flex-1 rounded-full ${i < at ? "bg-white" : i === at ? "animate-pulse bg-[#fff3a0]" : "bg-white/35"}`} />; })}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="spp-btn spp-cta inline-flex items-center gap-2 px-6 py-3 text-lg"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useSprout.getState().saveCurrent(null); onPlay(cur.stage); }} className="spp-btn inline-flex items-center gap-1.5 bg-white/25 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="spp-btn spp-cta inline-flex items-center gap-2 px-8 py-3.5 text-xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="spp-display text-[24px] leading-none">The gardens</h2>
          <span className="text-xs font-bold opacity-60">{STAGES_PER_GARDEN} stages each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GARDENS.map((g, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_GARDEN) > i || remix, now = i === gi;
            return (
              <div key={g.id} className={`rounded-2xl p-3 text-white shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ background: `linear-gradient(150deg, ${g.sky[2]}, ${g.ground})` }}>
                <p className="text-[13px] font-extrabold drop-shadow">{g.name}</p>
                <p className="text-[11px] font-bold text-white/85">{now ? `stage ${((stage - 1) % STAGES_PER_GARDEN) + 1} of ${STAGES_PER_GARDEN}` : done ? "★ in bloom" : `from stage ${i * STAGES_PER_GARDEN + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="spp-glass mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="spp-display text-lg">How it works</p>
          <p>🎯 Aim, bounce off the glass, and match three or more bubbles of a colour.</p>
          <p>🌱 Free every seedling to clear the stage — leftover shots burst as fireworks for bonus points.</p>
          <p>🪨 Stones, ❄️ ice and 💣 bombs join as the gardens grow. Rainbow and bomb boosters help in a pinch.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-50">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
