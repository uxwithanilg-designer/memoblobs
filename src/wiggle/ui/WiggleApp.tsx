"use client";
// Wiggle Way — a 3D gravity worm puzzle: steer a hungry worm one cell at a time (arrows, swipes or the pad), eat apples
// to grow long enough to bridge gaps and climb ledges, dodge spikes and pits, and wriggle into the portal. The worm
// falls whenever nothing holds it up. Stages arrive one by one: 600 designed boards across twelve worlds (each with its
// own sky and music, a big board halfway and a finale), then endless remixes. Every board is solved by a solver.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, Lightbulb, Play, RotateCcw, Star, Undo2, X, Apple, Footprints } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { move, solve, type Dir } from "../engine";
import { DESIGNED, STAGES_PER_WORLD, WORLDS, passOf, plannedMove, worldOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { useWiggle, useWiggleHydrated, type Game } from "../save";
import { WiggleScene, type SceneSound } from "./Scene";
import { WIGGLE_CSS } from "./styles";

export const WIGGLE_SFX = ["step", "land", "eat", "plum", "die", "portal", "bump", "hint", "undo", "win", "star", "world", "open"] as const;
type Sfx = (typeof WIGGLE_SFX)[number];
const sfxName = (k: Sfx) => `a:wiggle_${k}` as Sound;
const music = (k: string) => `a:wiggle_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  spikes: ["Spikes!", "Silver spikes end the try if your worm lands on them or crawls in. Plan where you'll fall."],
  plums: ["Plums", "Purple plums make your worm one shorter. Sometimes being short is exactly what you need to fit."],
  boss: ["World finale", "The last board of every world is a big one. Reach the portal to open the next world."],
  remix: ["Endless boards", "You've finished all 600 designed boards! From here every stage is a fresh remix — forever."],
};
interface Result { stage: number; stars: number; coins: number; worldDone: boolean; gift: string; moves: number; par: number }
const DIR_KEYS: Record<string, Dir> = { ArrowLeft: 0, a: 0, A: 0, ArrowRight: 1, d: 1, D: 1, ArrowUp: 2, w: 2, W: 2, ArrowDown: 3, s: 3, S: 3 };

export default function WiggleApp({ slug }: { slug: string; title: string }) {
  const ready = useWiggleHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useWiggle((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "dead" | "help" | "tip">("");
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [toast, setToast] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WiggleScene | null>(null);
  const hist = useRef<Game[]>([]);
  const busy = useRef(false);
  const queued = useRef<Dir | null>(null);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null);
  const stateRef = useRef({ result: false, sheet: "", paused: false });
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { result: !!result, sheet, paused }; }, [result, sheet, paused]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);
  const setG = useCallback((g: Game) => { setGame(g); gameRef.current = g; }, []);
  const applyPending = useCallback(() => { const sc = sceneRef.current, p = pendingRef.current; if (!sc || !p) return; pendingRef.current = null; sc.setStage(p.d.board, p.g.worm, p.g.eaten, worldOf(p.d.stage)); }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Waking the worm");
    void audio.preload(WIGGLE_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(worldOf(useWiggle.getState().stage).music)]);
    prepareStage(useWiggle.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.12, duck: k === "win" || k === "world" });
  }, []);
  const persist = useCallback((g: Game) => { const d = defRef.current; if (!d) return; useWiggle.getState().saveCurrent({ stage: d.stage, game: g, revived: false }); }, []);

  // ---------------------------------------------------------------- finishing
  const finish = useCallback((g: Game) => {
    const d = defRef.current!;
    const stars = g.hints ? 1 : g.moves <= d.par ? 3 : g.moves <= Math.ceil(d.par * 1.3) + 2 ? 2 : 1;
    const coins = 5 + Math.round(d.par / 2) + stars * 3 + (d.boss ? 20 : d.showcase ? 8 : 0);
    useProfile.getState().earnCoins(coins);
    useWiggle.getState().win(d.stage, stars, d.board.items.filter((_, k) => g.eaten & (1 << k)).filter((it) => it.kind === "apple").length);
    let gift = "";
    const give = useWiggle.getState().giveBooster;
    if (d.boss) { give("hint", 2); give("undo", 5); gift = "+2 Hints · +5 Undos"; }
    else if (d.showcase) { give("undo", 3); gift = "+3 Undos"; }
    else if (d.stage % 10 === 0) { give("hint", 1); gift = "+1 Hint"; }
    const worldDone = d.stage % STAGES_PER_WORLD === 0;
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, worldDone, gift, moves: g.moves, par: d.par });
      sfx(worldDone ? "world" : "win", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 1000);
    track("wiggle_clear", { stage: d.stage, stars });
  }, [sfx]);

  // ---------------------------------------------------------------- moves
  const doMove = (dir: Dir) => {
    const g0 = gameRef.current, d = defRef.current, sc = sceneRef.current, st = stateRef.current;
    if (!g0 || !d || !sc || st.result || st.sheet || st.paused) return;
    if (busy.current) { queued.current = dir; return; }
    const r = move(d.board, { worm: g0.worm, eaten: g0.eaten }, dir);
    if (r.out === "blocked") { sc.bump(); sfx("bump", { gain: 0.35 }); return; }
    hist.current = [...hist.current, g0].slice(-200);
    const g: Game = { ...g0, worm: r.s.worm, eaten: r.s.eaten, moves: g0.moves + 1 };
    setG(g); busy.current = true; buzz(6);
    const ate = r.ate >= 0 ? { kind: d.board.items[r.ate].kind, k: r.ate } : null;
    sc.play(g0.worm, r.s.worm, r.fell, ate, () => {
      busy.current = false;
      if (r.out === "win") { busy.current = true; sc.win(); useWiggle.getState().saveCurrent(null); finish(g); return; }
      if (r.out === "dead") { busy.current = true; sc.die(); buzz(60); setTimeout(() => setSheet("dead"), 650); return; }
      persist(g);
      const q = queued.current; queued.current = null;
      if (q !== null) doMoveRef.current(q);
    });
  };
  const doMoveRef = useRef<(d: Dir) => void>(() => undefined);
  useEffect(() => { doMoveRef.current = doMove; });

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const sc = new WiggleScene(host.current, {
      canPlay: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused; },
      swipe: (dir) => doMoveRef.current(dir),
      sound: (e: SceneSound, pan: number) => sfx(e as Sfx, { x: pan, gain: e === "step" ? 0.3 : 0.55, rate: e === "step" ? 0.9 + Math.random() * 0.2 : undefined }),
    });
    sceneRef.current = sc;
    applyPending();
    return () => { sc.dispose(); sceneRef.current = null; };
  }, [screen, sfx, applyPending]);

  useEffect(() => {
    if (screen !== "game") return;
    const on = (e: KeyboardEvent) => { const dir = DIR_KEYS[e.key]; if (dir === undefined) return; e.preventDefault(); doMoveRef.current(dir); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [screen]);

  // ---------------------------------------------------------------- stages
  const start = useCallback(async (stage: number, resume?: { game: Game; revived: boolean }) => {
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const fresh: Game = { worm: d.start.worm.slice(), eaten: 0, moves: 0, hints: 0, undos: 0 };
    const g = resume?.game && resume.game.worm?.length ? resume.game : fresh;
    setDef(d); defRef.current = d; setG(g); setResult(null); setSheet("");
    hist.current = []; busy.current = false; queued.current = null;
    setScreen("game");
    const w = worldOf(stage);
    void audio.playMusic(music(w.music));
    audio.warmMusic([music(worldOf(stage + STAGES_PER_WORLD).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = useWiggle.getState().tips;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, boss: d.boss, spikes: d.board.cells.some((c) => c === 2), plums: d.board.items.some((it) => it.kind === "plum") };
    const tip = ["remix", "boss", "spikes", "plums"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useWiggle.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); } else setToast(`${w.name} · best ${d.par} moves`);
    track("wiggle_start", { stage });
  }, [sfx, applyPending, setG]);

  // ---------------------------------------------------------------- helpers
  const nextMove = useCallback((): Dir | null => {
    const g = gameRef.current, d = defRef.current; if (!g || !d) return null;
    const p = plannedMove(d, { worm: g.worm, eaten: g.eaten }); if (p !== null) return p;
    const r = solve(d.board, { worm: g.worm, eaten: g.eaten }, 60000);
    return r.path?.[0] ?? null;
  }, []);
  const doHint = () => {
    const g = gameRef.current; if (!g || result || busy.current) return;
    const m = nextMove();
    if (m === null) { setToast("No way from here — undo or restart"); return; }
    if (!useWiggle.getState().useBooster("hint")) { setToast("No hints left"); return; }
    const g2 = { ...g, hints: g.hints + 1 }; setG(g2); persist(g2);
    sfx("hint", { gain: 0.5 }); setToast(["Go left ←", "Go right →", "Go up ↑", "Go down ↓"][m]);
  };
  const doUndo = (free = false) => {
    const prev = hist.current[hist.current.length - 1], d = defRef.current;
    if (!prev || !d || result) { setToast("Nothing to undo"); return; }
    if (!free && !useWiggle.getState().useBooster("undo")) { setToast("No undos left"); return; }
    hist.current = hist.current.slice(0, -1);
    const g = { ...prev, undos: (gameRef.current?.undos ?? 0) + (free ? 0 : 1), hints: gameRef.current?.hints ?? prev.hints, moves: gameRef.current?.moves ?? prev.moves };
    setG(g); setSheet(""); busy.current = false; queued.current = null;
    sceneRef.current?.setWorm(g.worm); sceneRef.current?.syncItems(g.eaten);
    sfx("undo", { gain: 0.5 }); persist(g);
  };
  const doRestart = () => { const d = defRef.current; if (!d) return; useWiggle.getState().saveCurrent(null); void start(d.stage); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __wiggle?: unknown }).__wiggle = {
      game: () => gameRef.current, def: () => defRef.current, start: (stage: number) => void start(stage),
      move: (dir: Dir) => doMoveRef.current(dir), busy: () => busy.current, next: () => nextMove(),
    };
  }, [start, nextMove]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const w = worldOf(screen === "game" ? stage : useWiggle.getState().stage);
  const inS = ((stage - 1) % STAGES_PER_WORLD) + 1;
  const ateNow = def && game ? def.board.items.filter((it, k) => it.kind === "apple" && game.eaten & (1 << k)).length : 0;
  const applesAll = def ? def.board.items.filter((it) => it.kind === "apple").length : 0;
  return (
    <div className="wgl-root" style={{ ["--s1" as string]: w.sky[0], ["--s2" as string]: w.sky[1], ["--paint" as string]: "#3ab84a", ["--hill" as string]: w.grass }}>
      <style>{WIGGLE_CSS}</style>
      <div className="wgl-sun" aria-hidden />
      <div className="wgl-hills" aria-hidden />
      <div className="wgl-bubbles" aria-hidden>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ left: `${(i * 41) % 100}%`, width: 14 + ((i * 13) % 26), height: 14 + ((i * 13) % 26), animationDuration: `${14 + (i % 5) * 4}s`, animationDelay: `${-i * 2.7}s` }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && def && game && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-start gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="wgl-amber grid size-11 shrink-0 place-items-center"><ArrowLeft className="size-5" /></button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <p className="wgl-display text-xl leading-none drop-shadow">Level {stage}{def.boss ? " · Finale" : def.showcase ? " · Big board" : ""}</p>
              <p className="text-[11px] font-bold opacity-90 drop-shadow">{w.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_WORLD}</p>
              <div className="flex items-center gap-2"><span className="wgl-chip"><Footprints className="size-3.5" /> {game.moves} · best {def.par}</span><span className="wgl-chip"><Apple className="size-3.5" /> {ateNow}/{applesAll}</span></div>
            </div>
            <button type="button" aria-label="Restart" onClick={doRestart} className="wgl-amber grid size-11 shrink-0 place-items-center"><RotateCcw className="size-5" /></button>
          </div>
          <div className="relative min-h-0 flex-1"><div ref={host} className="wgl-stage" /></div>
          <div className="flex items-end justify-between gap-3 px-4 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <div className="flex gap-3">
              <Tool icon={Undo2} label="Undo" n={boosters.undo} onClick={() => doUndo()} />
              <Tool icon={Lightbulb} label="Hint" n={boosters.hint} onClick={doHint} />
            </div>
            <div className="wgl-pad" aria-label="Move">
              <span />
              <button type="button" aria-label="Up" className="wgl-amber" onClick={() => doMoveRef.current(2)}><ArrowUp className="size-6" /></button>
              <span />
              <button type="button" aria-label="Left" className="wgl-amber" onClick={() => doMoveRef.current(0)}><ArrowLeft className="size-6" /></button>
              <button type="button" aria-label="Down" className="wgl-amber" onClick={() => doMoveRef.current(3)}><ArrowDown className="size-6" /></button>
              <button type="button" aria-label="Right" className="wgl-amber" onClick={() => doMoveRef.current(1)}><ArrowRight className="size-6" /></button>
            </div>
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/10">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/50 border-t-[var(--paint)]" /><p className="wgl-display text-lg drop-shadow">Digging the burrows…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "dead" && !result && (
          <Sheet key="dead" title="Ouch!" onClose={() => undefined}>
            <p className="opacity-85">Your worm {def && game && game.worm.some((c) => def.board.cells[c] === 2) ? "landed on spikes" : "fell off the world"}. Take that move back — it&apos;s free — or start the board again.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" className="wgl-btn wgl-cta wgl-shine py-3 text-lg" onClick={() => doUndo(true)}><Undo2 className="mr-1 inline size-5" /> Take it back</button>
              <button type="button" className="wgl-btn wgl-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Restart</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useWiggle.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>🐛 Move the worm with the arrow keys, by swiping, or with the pad.</li>
              <li>🍎 Eat apples to grow longer — long enough to bridge gaps and climb up.</li>
              <li>⬇️ Watch out: if nothing holds your worm up, it falls!</li>
              <li>🌀 Crawl into the swirl portal to finish. Pits and spikes end the try.</li>
            </ul>
            <button type="button" className="wgl-btn wgl-cta mt-5 w-full py-3 text-lg" onClick={() => { useWiggle.getState().sawHelp(); setSheet(""); }}>Let&apos;s wiggle</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useWiggle.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="wgl-btn wgl-cta mt-5 w-full py-3 text-lg" onClick={() => { useWiggle.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="wgl-pill pointer-events-none absolute top-28 left-1/2 z-50 -translate-x-1/2 text-sm whitespace-nowrap">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label: text, n, onClick }: { icon: typeof Star; label: string; n?: number; onClick: () => void }) {
  return (
    <button type="button" className="wgl-tool" onClick={onClick}>
      <span className="wgl-tool-ico wgl-amber"><Icon className="size-6" />{n !== undefined && <span className="wgl-badge">{n}</span>}</span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="wgl-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="wgl-display text-2xl">{title}</h2>
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
      <motion.div className="wgl-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="wgl-head px-5 pt-5 pb-4">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#fff3a0] text-white" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="wgl-display mt-1 text-3xl drop-shadow">{r.worldDone ? "World complete!" : "Wiggled through!"}</h2>
          <p className="mt-1 text-sm font-bold opacity-90">{r.worldDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-bold opacity-75">{r.moves} moves · best {r.par}</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/50 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="wgl-btn wgl-cta wgl-shine flex items-center justify-center gap-2 py-3 text-lg" onClick={onNext}>Level {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="wgl-btn wgl-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  return (
    <div className="wgl-title" role="img" aria-label="Wiggle Way" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="wgl-word wgl-w1">{[..."WIGGLE"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "#ff4a3a", animationDelay: `${i * 0.07}s, ${1 + i * 0.15}s` }}>{ch}</span>)}</div>
      <div className="wgl-word wgl-w2">{[..."WAY"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "#6ad83a", animationDelay: `${0.45 + i * 0.07}s, ${1.5 + i * 0.15}s` }}>{ch}</span>)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = useWiggle();
  const stage = save.stage, w = worldOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const wi = Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length;
  const remix = passOf(stage) > 0;
  const at = (shown - 1) % STAGES_PER_WORLD;
  return (
    <div className="wgl-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Level"], [Star, String(save.totalStars), "Stars"], [Apple, String(save.apples), "Apples"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="wgl-sheet flex items-center gap-2 !rounded-[18px] px-3 py-2.5 !shadow-none">
                <Icon className="size-6 shrink-0 text-[#e8283a]" />
                <span className="min-w-0"><span className="wgl-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Wiggle Way — 3D gravity worm puzzle</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-bold drop-shadow sm:mx-auto">Eat apples, grow longer and wriggle into the portal — but if nothing holds your worm up, down it goes!</p>

        <div className="wgl-sheet wgl-shine relative mt-3 overflow-hidden p-5">
          <p className="text-xs font-extrabold tracking-widest uppercase opacity-70">🐛 {w.name}{remix ? " · Remix" : ""}</p>
          <p className="wgl-display mt-1 text-5xl leading-none">Level {shown}</p>
          <div className="wgl-bar mt-3"><b style={{ width: `${Math.round((at / STAGES_PER_WORLD) * 100)}%` }} /></div>
          <p className="mt-1 text-[11px] font-bold opacity-70">{at} of {STAGES_PER_WORLD} boards in this world</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="wgl-btn wgl-cta inline-flex items-center gap-2 px-7 py-3 text-xl"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useWiggle.getState().saveCurrent(null); onPlay(cur.stage); }} className="wgl-btn wgl-soft inline-flex items-center gap-1.5 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="wgl-btn wgl-cta inline-flex items-center gap-2 px-9 py-3.5 text-2xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="wgl-display text-[24px] leading-none drop-shadow">The worlds</h2>
          <span className="text-xs font-bold drop-shadow">{STAGES_PER_WORLD} boards each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORLDS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_WORLD) > i || remix, now = i === wi;
            return (
              <div key={s.id} className={`rounded-2xl border-[3px] p-3 shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: now ? "#ffd23a" : "#ffffff", background: `linear-gradient(180deg, ${s.sky[0]}, ${s.sky[1]} 70%, ${s.grass} 70%, ${s.dirt})`, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.4)" }}>
                <p className="text-[13px] font-extrabold">{s.name}</p>
                <p className="text-[11px] font-bold opacity-90">{now ? `board ${((stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}` : done ? "★ complete" : `from level ${i * STAGES_PER_WORLD + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="wgl-sheet mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="wgl-display text-lg">How it works</p>
          <p>🐛 Move one cell at a time. Apples make you one longer; plums one shorter.</p>
          <p>⬇️ If no part of your worm rests on something, it falls. Pits and spikes end the try — take it back for free.</p>
          <p>🌀 Reach the portal. 600 boards across twelve worlds, then endless remixes — every one solved by a solver.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-75 drop-shadow">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
