"use client";
// Slide Splash — swipe the jelly cube: it slides until it hits a wall, painting every tile it passes. Paint the whole
// maze within the moves you have, and never slide into a spiky mine. Stages never end and arrive one by one: 600
// designed mazes across twelve colour worlds (each with its own paint and music, a big maze halfway and a finale),
// then endless remixes. Hard from stage 3. Phone-app flow: swipe or arrow keys.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronRight, Footprints, Lightbulb, Paintbrush, Play, Plus, RotateCcw, Shield, Star, Undo2, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import type { Dir } from "../engine";
import { DESIGNED, STAGES_PER_WORLD, WORLDS, passOf, worldOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { hintOf, newGame, starsOf, step } from "../play";
import { useSplash, useSplashHydrated, type Game } from "../save";
import { SplashScene, type SceneSound } from "./Scene";
import { SPLASH_CSS } from "./styles";

export const SPLASH_SFX = ["slide", "stop", "paint", "pop", "shield", "bump", "hint", "undo", "clear", "star", "world", "lose", "open"] as const;
type Sfx = (typeof SPLASH_SFX)[number];
const sfxName = (k: Sfx) => `a:splash_${k}` as Sound;
const music = (k: string) => `a:splash_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  mines: ["Spiky mines!", "A slide that runs into a mine pops your cube. Look where every slide ends before you swipe — a Shield bursts one mine for you."],
  moves: ["Every move counts", "You get just the moves the fastest route needs, plus one. Plan the whole path before you start!"],
  boss: ["World finale", "The last maze of every world is a big one. Paint it all to open the next world."],
  remix: ["Endless mazes", "You've finished all 600 designed mazes! From here every stage is a fresh remix — new mazes, forever."],
};
const ARROWS = ["↑", "→", "↓", "←"];
interface Result { stage: number; stars: number; coins: number; worldDone: boolean; gift: string; used: number; tiles: number }

export default function SplashApp({ slug }: { slug: string; title: string }) {
  const ready = useSplashHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useSplash((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [revived, setRevived] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "out" | "dead" | "help" | "tip">("");
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [toast, setToast] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SplashScene | null>(null);
  const hist = useRef<Game[]>([]);
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  const applyPending = useCallback(() => { const sc = sceneRef.current, p = pendingRef.current; if (!sc || !p) return; pendingRef.current = null; sc.setStage(p.d.maze, worldOf(p.d.stage), p.g.painted, p.g.pos, p.g.burst); sc.setShield(p.g.shield); }, []);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null);
  const stateRef = useRef({ revived: false, result: false, sheet: "", paused: false });
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { revived, result: !!result, sheet, paused }; }, [revived, result, sheet, paused]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);
  const setG = useCallback((g: Game) => { setGame(g); gameRef.current = g; }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Mixing the paint");
    void audio.preload(SPLASH_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(worldOf(useSplash.getState().stage).music)]);
    prepareStage(useSplash.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.14, duck: k === "clear" || k === "world" });
  }, []);
  const persist = useCallback((g: Game) => {
    const d = defRef.current; if (!d) return;
    useSplash.getState().saveCurrent({ stage: d.stage, game: g, revived: stateRef.current.revived });
  }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback((g: Game) => {
    const d = defRef.current!;
    const stars = starsOf(g, d.par);
    const coins = 4 + Math.round(d.floor / 5) + stars * 3 + (d.boss ? 20 : d.showcase ? 8 : 0);
    useProfile.getState().earnCoins(coins);
    useSplash.getState().win(d.stage, stars, d.floor);
    let gift = "";
    if (d.boss) { useSplash.getState().giveBooster("hint", 2); useSplash.getState().giveBooster("shield", 1); useSplash.getState().giveBooster("undo", 2); gift = "+2 Hints · +1 Shield · +2 Undos"; }
    else if (d.showcase) { useSplash.getState().giveBooster("undo", 2); gift = "+2 Undos"; }
    else if (d.stage % 10 === 0) { useSplash.getState().giveBooster(d.stage % 20 === 0 ? "shield" : "hint", 1); gift = d.stage % 20 === 0 ? "+1 Shield" : "+1 Hint"; }
    const worldDone = d.stage % STAGES_PER_WORLD === 0;
    sceneRef.current?.celebrate();
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, worldDone, gift, used: g.used, tiles: d.floor });
      sfx(worldDone ? "world" : "clear", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 1300);
    track("splash_clear", { stage: d.stage, stars });
  }, [sfx]);

  // ---------------------------------------------------------------- moves
  const moveRef = useRef<(d: Dir) => void>(() => undefined);
  const doMove = (dir: Dir) => {
    const g0 = gameRef.current, d = defRef.current, sc = sceneRef.current, st = stateRef.current;
    if (!g0 || !d || !sc || st.result || st.sheet || st.paused) return;
    const r = step(d, g0, dir);
    if (!r) { sc.slide(dir, [], false); return; }
    hist.current = [...hist.current, g0].slice(-40);
    setG(r.game); buzz(r.dead ? 80 : 10);
    sc.slide(dir, r.s.path, r.dead, r.shielded);
    if (r.dead) { setTimeout(() => { setSheet("dead"); sfx("lose", { gain: 0.5 }); }, 700); persist(g0); return; }
    if (r.win) { useSplash.getState().saveCurrent(null); setTimeout(() => finishStage(r.game), Math.max(250, r.s.path.length * 70)); return; }
    persist(r.game);
    if (r.out) setTimeout(() => { setSheet("out"); sfx("lose", { gain: 0.55 }); }, 600);
  };
  useEffect(() => { moveRef.current = doMove; });

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const sc = new SplashScene(host.current, {
      canPlay: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused; },
      move: (d) => moveRef.current(d),
      sound: (e: SceneSound, pan: number, n = 1) => {
        if (e === "slide") sfx("slide", { x: pan, gain: 0.45, rate: Math.max(0.8, 1.2 - n * 0.04) });
        else if (e === "paint") sfx("paint", { x: pan, gain: 0.22, rate: 1 + n * 0.06 });
        else sfx(e as Sfx, { x: pan, gain: 0.55 });
      },
    });
    sceneRef.current = sc;
    applyPending();
    return () => { sc.dispose(); sceneRef.current = null; };
  }, [screen, sfx, applyPending]);

  // ---------------------------------------------------------------- stages
  const start = useCallback(async (stage: number, resume?: { game: Game; revived: boolean }) => {
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const g = resume?.game ?? newGame(d);
    setDef(d); setG(g); setResult(null); setSheet("");
    setRevived(resume?.revived ?? false);
    hist.current = [];
    setScreen("game");
    const w = worldOf(stage);
    void audio.playMusic(music(w.music));
    audio.warmMusic([music(worldOf(stage + STAGES_PER_WORLD).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = useSplash.getState().tips;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, boss: d.boss, mines: d.maze.cells.includes(2), moves: stage >= 3 };
    const tip = ["remix", "boss", "mines", "moves"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useSplash.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); } else setToast(`${w.name} · ${d.moves} moves`);
    track("splash_start", { stage });
  }, [sfx, applyPending, setG]);

  // ---------------------------------------------------------------- boosters
  const doHint = () => {
    const g = gameRef.current, d = defRef.current; if (!g || !d || result) return;
    const dir = hintOf(d, g);
    if (dir < 0) { setToast("No way to finish from here — undo!"); return; }
    if (!useSplash.getState().useBooster("hint")) { setToast("No hints left"); return; }
    const g2 = { ...g, helped: true }; setG(g2); persist(g2);
    setToast(`Slide ${ARROWS[dir]}`); sfx("hint", { gain: 0.5 });
  };
  const doUndo = () => {
    const prev = hist.current[hist.current.length - 1], d = defRef.current;
    if (!prev || !d || result) { setToast("Nothing to undo"); return; }
    if (!useSplash.getState().useBooster("undo")) { setToast("No undos left"); return; }
    hist.current = hist.current.slice(0, -1);
    const g = { ...prev, helped: true }; setG(g); setSheet("");
    sceneRef.current?.setStage(d.maze, worldOf(d.stage), g.painted, g.pos, g.burst); sceneRef.current?.setShield(g.shield); sfx("undo", { gain: 0.5 }); persist(g);
  };
  const doShield = () => {
    const g = gameRef.current; if (!g || result) return;
    if (g.shield) { setToast("Shield is already on"); return; }
    if (!useSplash.getState().useBooster("shield")) { setToast("No shields left"); return; }
    const g2 = { ...g, shield: true, helped: true }; setG(g2); persist(g2); sceneRef.current?.setShield(true); sfx("shield", { gain: 0.5 }); setToast("The next mine bursts harmlessly");
  };
  const doMore = () => { const g0 = gameRef.current; if (!g0) return; const g = { ...g0, moves: g0.moves + 4, helped: true }; setRevived(true); setG(g); setSheet(""); sfx("star", { gain: 0.5 }); persist(g); };
  const doRestart = () => { const d = defRef.current; if (!d) return; useSplash.getState().saveCurrent(null); void start(d.stage); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __splash?: unknown }).__splash = {
      game: () => gameRef.current, def: () => defRef.current, start: (stage: number) => void start(stage),
      move: (d: Dir) => sceneRef.current?.send(d), hint: () => { const g = gameRef.current, d = defRef.current; return g && d ? hintOf(d, g) : -1; },
      busy: () => !!sceneRef.current?.busy,
    };
  }, [start]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const w = worldOf(screen === "game" ? stage : useSplash.getState().stage);
  const dark = w.id === "galaxy" || w.id === "lava";
  const inS = ((stage - 1) % STAGES_PER_WORLD) + 1;
  const pct = def && game ? Math.round((game.painted.length / def.floor) * 100) : 0;
  return (
    <div className={`spl-root ${dark ? "spl-dark" : ""}`} style={{ ["--s1" as string]: w.bg[0], ["--s2" as string]: w.bg[1], ["--paint" as string]: w.paint }}>
      <style>{SPLASH_CSS}</style>
      <div className="spl-bubbles" aria-hidden>{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, width: 14 + ((i * 13) % 30), height: 14 + ((i * 13) % 30), animationDuration: `${12 + (i % 5) * 4}s`, animationDelay: `${-i * 2.3}s` }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-start gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="spl-amber grid size-11 shrink-0 place-items-center"><ArrowLeft className="size-5" /></button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <p className="spl-display text-xl leading-none">Stage {stage}{def?.boss ? " · Finale" : def?.showcase ? " · Big maze" : ""}</p>
              <p className="text-[11px] font-bold opacity-75">{w.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_WORLD}</p>
              <div className="flex items-center gap-2"><span className={`spl-chip ${game && game.moves <= 2 ? "spl-low" : ""}`}><Footprints className="size-3.5" /> {game?.moves ?? 0} moves</span><span className="spl-chip"><Paintbrush className="size-3.5" /> {pct}%</span></div>
            </div>
            <button type="button" aria-label="Restart" onClick={doRestart} className="spl-amber grid size-11 shrink-0 place-items-center"><RotateCcw className="size-5" /></button>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="spl-stage" />
          </div>
          <div className="flex items-end justify-center gap-4 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Undo2} label="Undo" n={boosters.undo} onClick={doUndo} />
            <Tool icon={Lightbulb} label="Hint" n={boosters.hint} onClick={doHint} />
            <Tool icon={Shield} label="Shield" n={boosters.shield} on={!!game?.shield} onClick={doShield} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/10">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/50 border-t-[var(--paint)]" /><p className="spl-display text-lg">Carving the maze…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "dead" && !result && (
          <Sheet key="dead" title="Pop! A mine!" onClose={() => undefined}>
            <p className="opacity-85">Your cube slid into a spiky mine. Step back and pick another way — or start the maze again.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" className="spl-btn spl-cta py-3 text-lg" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Undo ({boosters.undo})</button>
              <button type="button" className="spl-btn spl-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "out" && !result && (
          <Sheet key="out" title="Out of moves!" onClose={() => undefined}>
            <p className="opacity-85">{revived ? "Try again — plan the whole route before the first swipe." : "Take 4 more moves — free, once per stage."}</p>
            <div className="mt-4 grid gap-2">
              {!revived && <button type="button" className="spl-btn spl-cta spl-shine py-3 text-lg" onClick={doMore}><Plus className="mr-1 inline size-5" /> +4 moves</button>}
              <button type="button" className="spl-btn spl-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useSplash.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>👆 Swipe (or use the arrow keys): the cube slides until it hits a wall.</li>
              <li>🎨 Every tile it slides over gets painted. Paint the whole maze to win!</li>
              <li>💣 Never slide into a spiky mine — it pops your cube.</li>
              <li>🎯 Moves are tight: plan the route first. Undo, Hint and Shield help.</li>
            </ul>
            <button type="button" className="spl-btn spl-cta mt-5 w-full py-3 text-lg" onClick={() => { useSplash.getState().sawHelp(); setSheet(""); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useSplash.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="spl-btn spl-cta mt-5 w-full py-3 text-lg" onClick={() => { useSplash.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="spl-pill pointer-events-none absolute top-32 left-1/2 z-50 -translate-x-1/2 text-sm whitespace-nowrap">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label: text, n, on, onClick }: { icon: typeof Star; label: string; n?: number; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`spl-tool ${on ? "spl-tool-on" : ""}`} onClick={onClick}>
      <span className="spl-tool-ico spl-amber"><Icon className="size-6" />{n !== undefined && <span className="spl-badge">{n}</span>}</span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="spl-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="spl-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-black/5"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClearSheet({ r, onNext, onHome }: { r: Result; onNext: () => void; onHome: () => void }) {
  const [left, setLeft] = useState(r.worldDone ? 7 : 5);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, onNext]);
  const s = worldOf(r.stage), ns = worldOf(r.stage + 1);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/30 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="spl-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="spl-head px-5 pt-5 pb-4">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#fff3a0] text-white" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="spl-display mt-1 text-3xl drop-shadow">{r.worldDone ? "World complete!" : "Maze painted!"}</h2>
          <p className="mt-1 text-sm font-bold opacity-90">{r.worldDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD} · ${r.used} moves`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-bold opacity-75">{r.tiles} tiles painted</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/50 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="spl-btn spl-cta spl-shine flex items-center justify-center gap-2 py-3 text-lg" onClick={onNext}>Stage {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="spl-btn spl-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  const cols = ["#1fb87a", "#ff4f9a", "#1f8ae0", "#ff7a2a", "#8a4ae0"];
  return (
    <div className="spl-title" role="img" aria-label="Slide Splash" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="spl-word spl-w1">{[..."SLIDE"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: cols[i], animationDelay: `${i * 0.07}s, ${1 + i * 0.15}s` }}>{ch}</span>)}</div>
      <div className="spl-word spl-w2">{[..."SPLASH"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "#ffffff", animationDelay: `${0.4 + i * 0.07}s, ${1.4 + i * 0.15}s` }}>{ch}</span>)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = useSplash();
  const stage = save.stage, w = worldOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const wi = Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length;
  const remix = passOf(stage) > 0;
  const at = (shown - 1) % STAGES_PER_WORLD;
  return (
    <div className="spl-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Stage"], [Star, String(save.totalStars), "Stars"], [Paintbrush, String(save.tiles), "Tiles"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="spl-sheet flex items-center gap-2 !rounded-[18px] px-3 py-2.5 !shadow-none">
                <Icon className="size-6 shrink-0 text-[var(--paint)]" />
                <span className="min-w-0"><span className="spl-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Slide Splash — slide and paint maze puzzle</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-bold opacity-90 sm:mx-auto">Swipe the jelly cube, paint every tile of the maze — and dodge the spiky mines!</p>

        <div className="spl-sheet spl-shine relative mt-3 overflow-hidden p-5">
          <p className="text-xs font-extrabold tracking-widest uppercase opacity-70">🎨 {w.name}{remix ? " · Remix" : ""}</p>
          <p className="spl-display mt-1 text-5xl leading-none">Stage {shown}</p>
          <div className="spl-bar mt-3"><b style={{ width: `${Math.round((at / STAGES_PER_WORLD) * 100)}%`, background: w.paint }} /></div>
          <p className="mt-1 text-[11px] font-bold opacity-70">{at} of {STAGES_PER_WORLD} mazes in this world</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="spl-btn spl-cta inline-flex items-center gap-2 px-7 py-3 text-xl"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useSplash.getState().saveCurrent(null); onPlay(cur.stage); }} className="spl-btn spl-soft inline-flex items-center gap-1.5 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="spl-btn spl-cta inline-flex items-center gap-2 px-9 py-3.5 text-2xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="spl-display text-[24px] leading-none">The colour worlds</h2>
          <span className="text-xs font-bold opacity-70">{STAGES_PER_WORLD} mazes each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORLDS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_WORLD) > i || remix, now = i === wi;
            const dk = s.id === "galaxy" || s.id === "lava";
            return (
              <div key={s.id} className={`rounded-2xl border-[3px] p-3 shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: now ? s.paint : "#ffffff", background: `linear-gradient(150deg, ${s.bg[0]}, ${s.bg[1]})`, color: dk ? "#fff" : "#2a2440" }}>
                <p className="text-[13px] font-extrabold">{s.name}</p>
                <p className="text-[11px] font-bold opacity-80">{now ? `maze ${((stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}` : done ? "★ complete" : `from stage ${i * STAGES_PER_WORLD + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="spl-sheet mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="spl-display text-lg">How it works</p>
          <p>👆 Swipe: the cube slides until a wall stops it, painting every tile it passes.</p>
          <p>💣 Spiky mines pop the cube — check where each slide ends before you swipe.</p>
          <p>🎯 Moves are tight from stage 3. 600 mazes across twelve colour worlds, then endless remixes.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-60">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
