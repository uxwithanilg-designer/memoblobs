"use client";
// Plank Panic — a 3D screw puzzle: tap a screw to pull it out, tap a free hole to screw it back in. A plank left on one
// screw swings down; with none it falls. Drop every plank within the moves you have — but careless moves can pin a plank
// again or cover the hole you needed. Stages never end and arrive one by one: 600 designed stages across twelve
// workshops (each with its own woods, board and music, a showcase board halfway and a finale), then endless remixes.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronRight, Clock, Hammer, Lightbulb, Play, Plus, RotateCcw, Star, Undo2, Wrench, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { apply, canLift, cloneState, freeHoles, initial, left, shortest, solve, solved, yank } from "../engine";
import { DESIGNED, SHOPS, STAGES_PER_SHOP, passOf, shopOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { usePlank, usePlankHydrated, type Game } from "../save";
import { PlankScene, type SceneSound } from "./Scene";
import { PLANK_CSS } from "./styles";

export const PLANK_SFX = ["tap", "lift", "screw", "swing", "fall", "denied", "clink", "hint", "undo", "clear", "star", "shop", "lose", "open"] as const;
type Sfx = (typeof PLANK_SFX)[number];
const sfxName = (k: Sfx) => `a:plank_${k}` as Sound;
const music = (k: string) => `a:plank_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  layers: ["Planks on top", "A screw under another plank can't come out until that plank is gone — and a covered hole can't take a screw. Clear from the top down!"],
  swing: ["Swinging planks", "A plank on one screw swings down and may cover holes or screws below it. Think before you let it swing!"],
  repin: ["Careful where it goes", "A screw put into a hole where a plank's end lies pins that plank again. Choose free holes wisely — moves are limited."],
  boss: ["Workshop finale", "The last stage of every workshop is a big board. Clear it to open the next workshop."],
  remix: ["Endless workshop", "You've finished all 600 designed stages! From here every stage is a fresh remix — new boards, forever."],
};
const starsOf = (g: Game, par: number) => { const s = g.used <= par ? 3 : g.used <= par + 2 ? 2 : 1; return g.helped ? Math.min(2, s) : s; };

interface Result { stage: number; stars: number; coins: number; shopDone: boolean; gift: string; used: number; planks: number }

export default function PlankApp({ slug }: { slug: string; title: string }) {
  const ready = usePlankHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = usePlank((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [revived, setRevived] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "out" | "time" | "stuck" | "help" | "tip">("");
  const [armed, setArmed] = useState(false);
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [toast, setToast] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PlankScene | null>(null);
  const hist = useRef<Game[]>([]);
  const armedRef = useRef(false);
  useEffect(() => { armedRef.current = armed; }, [armed]);
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  const applyPending = useCallback(() => { const sc = sceneRef.current, p = pendingRef.current; if (!sc || !p) return; pendingRef.current = null; sc.setStage(p.d.board, p.g.state, shopOf(p.d.stage)); }, []);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null);
  const stateRef = useRef({ revived: false, result: false, sheet: "", paused: false });
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { revived, result: !!result, sheet, paused }; }, [revived, result, sheet, paused]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2000); return () => clearTimeout(t); }, [toast]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Sharpening the screwdriver");
    void audio.preload(PLANK_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(shopOf(usePlank.getState().stage).music)]);
    prepareStage(usePlank.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.14, duck: k === "clear" || k === "shop" });
  }, []);
  const persist = useCallback((g: Game) => {
    const d = defRef.current; if (!d) return;
    usePlank.getState().saveCurrent({ stage: d.stage, game: g, revived: stateRef.current.revived });
  }, []);
  const setG = useCallback((g: Game) => { setGame(g); gameRef.current = g; }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback((g: Game) => {
    const d = defRef.current!;
    const stars = starsOf(g, d.par);
    const coins = 4 + d.board.planks.length + stars * 3 + (d.boss ? 20 : d.showcase ? 8 : 0);
    useProfile.getState().earnCoins(coins);
    usePlank.getState().win(d.stage, stars, d.board.planks.length);
    let gift = "";
    if (d.boss) { usePlank.getState().giveBooster("hint", 2); usePlank.getState().giveBooster("pliers", 1); usePlank.getState().giveBooster("undo", 2); gift = "+2 Hints · +1 Pliers · +2 Undos"; }
    else if (d.showcase) { usePlank.getState().giveBooster("undo", 2); gift = "+2 Undos"; }
    else if (d.stage % 10 === 0) { usePlank.getState().giveBooster(d.stage % 20 === 0 ? "pliers" : "hint", 1); gift = d.stage % 20 === 0 ? "+1 Pliers" : "+1 Hint"; }
    const shopDone = d.stage % STAGES_PER_SHOP === 0;
    sceneRef.current?.celebrate();
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, shopDone, gift, used: g.used, planks: d.board.planks.length });
      sfx(shopDone ? "shop" : "clear", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 900);
    track("plank_clear", { stage: d.stage, stars });
  }, [sfx]);
  /** after a move: win, out of moves, or proven stuck */
  const afterMove = useCallback((g: Game) => {
    const d = defRef.current!;
    if (solved(g.state)) { usePlank.getState().saveCurrent(null); setTimeout(() => finishStage(g), 900); return; }
    persist(g);
    if (g.moves <= 0) { setTimeout(() => { setSheet("out"); sfx("lose", { gain: 0.55 }); }, 700); return; }
    setTimeout(() => {
      if (gameRef.current !== g) return;
      const r = solve(d.board, g.state, 2500);
      if (!r.path && r.visited <= 2500) { setSheet("stuck"); sfx("lose", { gain: 0.5 }); }
    }, 900);
  }, [finishStage, persist, sfx]);

  // ---------------------------------------------------------------- taps
  const tapRef = useRef<{ screw: (k: number) => void; hole: (p: number) => void }>({ screw: () => undefined, hole: () => undefined });
  const tapScrew = (k: number) => {
    const g0 = gameRef.current, d = defRef.current, sc = sceneRef.current, st = stateRef.current;
    if (!g0 || !d || !sc || st.result || st.sheet || st.paused) return;
    if (armedRef.current) {
      if (!usePlank.getState().useBooster("pliers")) { setToast("No pliers left"); setArmed(false); return; }
      hist.current = [...hist.current, g0].slice(-30);
      const s = cloneState(g0.state), at = s.screws[k].at;
      yank(d.board, s, k);
      const g = { ...g0, state: s, helped: true }; setG(g); setArmed(false);
      sc.yanked(at, s); buzz(30);
      afterMove(g);
      return;
    }
    if (sc.liftedScrew === k) { sc.drop(); return; }
    if (!canLift(d.board, g0.state, k)) { sc.deny(k); setToast("A plank above is in the way"); buzz(40); return; }
    if (sc.liftedScrew >= 0) sc.drop();
    if (!freeHoles(d.board, g0.state, k).length) { sc.deny(k); setToast("No free hole for it"); return; }
    sc.lift(k); buzz(8);
  };
  const tapHole = (p: number) => {
    const g0 = gameRef.current, d = defRef.current, sc = sceneRef.current, st = stateRef.current;
    if (!g0 || !d || !sc || st.result || st.sheet || st.paused) return;
    const k = sc.liftedScrew; if (k < 0) return;
    if (!freeHoles(d.board, g0.state, k).includes(p)) { sfx("denied", { gain: 0.4 }); return; }
    hist.current = [...hist.current, g0].slice(-30);
    const s = cloneState(g0.state);
    apply(d.board, s, k, p);
    const g = { ...g0, state: s, moves: g0.moves - 1, used: g0.used + 1 };
    setG(g); sc.moveTo(k, s); buzz(10);
    afterMove(g);
  };
  useEffect(() => { tapRef.current = { screw: tapScrew, hole: tapHole }; });

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const sc = new PlankScene(host.current, {
      canPlay: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused; },
      tapScrew: (k) => tapRef.current.screw(k),
      tapHole: (p) => tapRef.current.hole(p),
      sound: (e: SceneSound, pan: number, n = 1) => {
        if (e === "fall") sfx("fall", { x: pan, gain: 0.6, rate: Math.max(0.75, 1.15 - n * 0.08) });
        else if (e === "lift") sfx("lift", { x: pan, gain: 0.5, rate: 0.95 + Math.random() * 0.1 });
        else if (e === "screw") sfx("screw", { x: pan, gain: 0.55, rate: 0.95 + Math.random() * 0.1 });
        else sfx(e as Sfx, { x: pan, gain: 0.45 });
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
    const g0: Game = resume?.game ?? { state: initial(d.board), moves: d.moves, used: 0, helped: false };
    const g: Game = { ...g0, time: g0.time ?? d.time };
    setDef(d); setG(g); setResult(null); setSheet("");
    setRevived(resume?.revived ?? false); setArmed(false);
    hist.current = [];
    setScreen("game");
    const sh = shopOf(stage);
    void audio.playMusic(music(sh.music));
    audio.warmMusic([music(shopOf(stage + STAGES_PER_SHOP).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = usePlank.getState().tips;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, boss: d.boss, layers: d.board.planks.length >= 3, swing: d.board.planks.length >= 2, repin: stage >= 12 };
    const tip = ["remix", "boss", "layers", "swing", "repin"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!usePlank.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); } else setToast(`${sh.name} · ${d.board.planks.length} planks`);
    track("plank_start", { stage });
  }, [sfx, applyPending, setG]);

  // ---------------------------------------------------------------- the clock (stops while a sheet is open or paused)
  useEffect(() => {
    if (screen !== "game") return;
    const t = setInterval(() => {
      const g = gameRef.current, st = stateRef.current;
      if (!g || st.result || st.sheet || st.paused || document.hidden || g.time === undefined) return;
      const time = Math.max(0, g.time - 1);
      const g2 = { ...g, time }; setG(g2);
      if (time <= 10 && time > 0) sfx("tap", { gain: 0.25, rate: 1.6 });
      if (time === 0) { setSheet("time"); sfx("lose", { gain: 0.55 }); persist(g2); }
      else if (time % 5 === 0) persist(g2);
    }, 1000);
    return () => clearInterval(t);
  }, [screen, sfx, persist, setG]);

  // ---------------------------------------------------------------- boosters
  const doHint = () => {
    const g = gameRef.current, d = defRef.current; if (!g || !d || result) return;
    // the hint follows the shortest way out, so it never wastes the few spare moves
    const path = shortest(d.board, g.state, 5000);
    const r = { path, visited: path ? 0 : solve(d.board, g.state, 6000).visited };
    if (!r.path?.length) { setToast(r.visited <= 6000 ? "This board can't be cleared — undo!" : "Keep going — no hint found"); return; }
    if (!usePlank.getState().useBooster("hint")) { setToast("No hints left"); return; }
    const m = r.path[0]; const g2 = { ...g, helped: true }; setG(g2); persist(g2);
    sceneRef.current?.showHint(m.from, m.to); sfx("hint", { gain: 0.5 });
    setToast("Move the glowing screw");
  };
  const doUndo = () => {
    const prev = hist.current[hist.current.length - 1], d = defRef.current;
    if (!prev || !d || result) { setToast("Nothing to undo"); return; }
    if (!usePlank.getState().useBooster("undo")) { setToast("No undos left"); return; }
    hist.current = hist.current.slice(0, -1);
    const g = { ...prev, helped: true }; setG(g); setSheet("");
    sceneRef.current?.setStage(d.board, g.state, shopOf(d.stage)); sfx("undo", { gain: 0.5 }); persist(g);
  };
  const doMoreTime = () => { const g0 = gameRef.current; if (!g0) return; const g = { ...g0, time: (g0.time ?? 0) + 30, helped: true }; setRevived(true); setG(g); setSheet(""); sfx("star", { gain: 0.5 }); persist(g); };
  const doMore = () => { const g0 = gameRef.current; if (!g0) return; const g = { ...g0, moves: g0.moves + 5, helped: true }; setRevived(true); setG(g); setSheet(""); sfx("star", { gain: 0.5 }); persist(g); };
  const doRestart = () => { const d = defRef.current; if (!d) return; usePlank.getState().saveCurrent(null); void start(d.stage); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __plank?: unknown }).__plank = {
      game: () => gameRef.current, def: () => defRef.current, start: (stage: number) => void start(stage),
      next: () => { const g = gameRef.current, d = defRef.current; if (!g || !d) return null; return shortest(d.board, g.state, 5000)?.[0] ?? null; },
      screw: (k: number) => tapRef.current.screw(k), hole: (p: number) => tapRef.current.hole(p),
      screwAt: (k: number) => { const r = host.current?.getBoundingClientRect(), p = sceneRef.current?.screwScreen(k); return p && r ? { x: r.left + p.x, y: r.top + p.y } : null; },
      holeAt: (p: number) => { const r = host.current?.getBoundingClientRect(), q = sceneRef.current?.holeScreen(p); return q && r ? { x: r.left + q.x, y: r.top + q.y } : null; },
    };
  }, [start]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const sh = shopOf(screen === "game" ? stage : usePlank.getState().stage);
  const inS = ((stage - 1) % STAGES_PER_SHOP) + 1;
  const total = def?.board.planks.length ?? 1, down = game ? total - left(game.state) : 0;
  return (
    <div className="plk-root" style={{ ["--s1" as string]: sh.sky[0], ["--s2" as string]: sh.sky[1] }}>
      <style>{PLANK_CSS}</style>
      <div className="plk-grain" aria-hidden />

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-start gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="plk-amber grid size-11 shrink-0 place-items-center"><ArrowLeft className="size-5" /></button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-white">
              <p className="plk-display text-xl leading-none drop-shadow-[0_2px_0_rgba(40,20,6,.6)]">Level {stage}{def?.boss ? " · Finale" : def?.showcase ? " · Showcase" : ""}</p>
              <p className="text-[11px] font-bold opacity-90 drop-shadow">{sh.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_SHOP}</p>
              <div className="flex items-center gap-2"><span className={`plk-chip ${game && game.moves <= 3 ? "plk-low" : ""}`}><Wrench className="size-3.5" /> {game?.moves ?? 0} moves</span><span className={`plk-chip ${game?.time !== undefined && game.time <= 10 ? "plk-low" : ""}`}><Clock className="size-3.5" /> {fmt(game?.time ?? 0)}</span><span className="plk-chip">{down}/{total}</span></div>
            </div>
            <button type="button" aria-label="Restart" onClick={doRestart} className="plk-amber grid size-11 shrink-0 place-items-center"><RotateCcw className="size-5" /></button>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="plk-stage" />
          </div>
          <div className="flex items-end justify-center gap-4 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Undo2} label="Undo" n={boosters.undo} onClick={doUndo} />
            <Tool icon={Lightbulb} label="Hint" n={boosters.hint} onClick={doHint} />
            <Tool icon={Hammer} label={armed ? "Tap a screw" : "Pliers"} n={boosters.pliers} on={armed} onClick={() => { if (!armed && boosters.pliers <= 0) { setToast("No pliers left"); return; } setArmed((a) => !a); }} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/10">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/40 border-t-[#5a3410]" /><p className="plk-display text-lg text-white drop-shadow">Building the board…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "out" && !result && (
          <Sheet key="out" title="Out of moves!" onClose={() => undefined}>
            <p className="opacity-85">{revived ? "Try the board again — plan which planks go first." : "Take 5 more moves — free, once per stage."}</p>
            <div className="mt-4 grid gap-2">
              {!revived && <button type="button" className="plk-btn plk-cta plk-shine py-3 text-lg" onClick={doMore}><Plus className="mr-1 inline size-5" /> +5 moves</button>}
              <button type="button" className="plk-btn plk-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "time" && !result && (
          <Sheet key="time" title="Time's up!" onClose={() => undefined}>
            <p className="opacity-85">{revived ? "Try the board again — plan the order before the clock runs out." : "Take 30 more seconds — free, once per stage."}</p>
            <div className="mt-4 grid gap-2">
              {!revived && <button type="button" className="plk-btn plk-cta plk-shine py-3 text-lg" onClick={doMoreTime}><Plus className="mr-1 inline size-5" /> +30 seconds</button>}
              <button type="button" className="plk-btn plk-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "stuck" && !result && (
          <Sheet key="stuck" title="Stuck!" onClose={() => setSheet("")}>
            <p className="opacity-85">This board can&apos;t be cleared any more — a plank or a hole you need is blocked. Step back or start over.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" className="plk-btn plk-cta py-3 text-lg" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Undo ({boosters.undo})</button>
              <button type="button" className="plk-btn plk-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { usePlank.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>🔩 Tap a screw to pull it out, then tap a free hole (it glows green) to screw it in there.</li>
              <li>🪵 A plank on one screw swings down; with no screws it falls. Drop every plank to win!</li>
              <li>🧱 A screw under a plank can&apos;t come out, and a covered hole can&apos;t take a screw.</li>
              <li>🎯 Moves and time are tight — a screw put where a plank&apos;s end lies pins it again. Plan the whole order first!</li>
            </ul>
            <button type="button" className="plk-btn plk-cta mt-5 w-full py-3 text-lg" onClick={() => { usePlank.getState().sawHelp(); setSheet(""); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { usePlank.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="plk-btn plk-cta mt-5 w-full py-3 text-lg" onClick={() => { usePlank.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="plk-pill pointer-events-none absolute top-32 left-1/2 z-50 -translate-x-1/2 text-sm whitespace-nowrap">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label: text, n, on, onClick }: { icon: typeof Star; label: string; n?: number; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`plk-tool ${on ? "plk-tool-on" : ""}`} onClick={onClick}>
      <span className="plk-tool-ico plk-amber"><Icon className="size-6" />{n !== undefined && <span className="plk-badge">{n}</span>}</span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="plk-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="plk-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-black/5"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClearSheet({ r, onNext, onHome }: { r: Result; onNext: () => void; onHome: () => void }) {
  const [left, setLeft] = useState(r.shopDone ? 7 : 5);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, onNext]);
  const s = shopOf(r.stage), ns = shopOf(r.stage + 1);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/35 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="plk-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="plk-head px-5 pt-5 pb-4">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#fff3a0] text-[#5a3410]" : "fill-white/50 text-[#5a3410]/40"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="plk-display mt-1 text-3xl">{r.shopDone ? "Workshop done!" : "Board cleared!"}</h2>
          <p className="mt-1 text-sm font-bold opacity-85">{r.shopDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_SHOP) + 1} of ${STAGES_PER_SHOP} · ${r.used} moves`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-bold opacity-75">{r.planks} planks dropped</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/50 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="plk-btn plk-cta plk-shine flex items-center justify-center gap-2 py-3 text-lg" onClick={onNext}>Level {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="plk-btn plk-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  const cols = ["#f2a83a", "#e0603a", "#c8783a", "#ffd77a", "#e0a050"];
  return (
    <div className="plk-title" role="img" aria-label="Plank Panic" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="plk-word plk-w1">{[..."PLANK"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: cols[i], animationDelay: `${i * 0.07}s, ${1 + i * 0.15}s` }}>{ch}</span>)}</div>
      <div className="plk-word plk-w2">{[..."PANIC"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "#fff6e0", animationDelay: `${0.4 + i * 0.07}s, ${1.4 + i * 0.15}s` }}>{ch}</span>)}</div>
      <div className="mt-1 flex gap-2 text-3xl" aria-hidden><i className="plk-screw" /><i className="plk-screw" style={{ animationDelay: "-1s" }} /><i className="plk-screw" style={{ animationDelay: "-2s" }} /></div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = usePlank();
  const stage = save.stage, sh = shopOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const si = Math.floor((stage - 1) / STAGES_PER_SHOP) % SHOPS.length;
  const remix = passOf(stage) > 0;
  const at = (shown - 1) % STAGES_PER_SHOP;
  return (
    <div className="plk-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Level"], [Star, String(save.totalStars), "Stars"], [Wrench, String(save.planks), "Planks"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="plk-sheet flex items-center gap-2 !rounded-[18px] px-3 py-2.5 !shadow-none">
                <Icon className="size-6 shrink-0 text-[#c8702c]" />
                <span className="min-w-0"><span className="plk-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Plank Panic — screw puzzle: unscrew the bolts and drop every plank</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-bold text-white drop-shadow-[0_1px_2px_rgba(40,20,6,.7)] sm:mx-auto">Twist out the screws, move them to free holes and drop every plank — before the moves run out!</p>

        <div className="plk-sheet plk-shine relative mt-3 overflow-hidden p-5">
          <p className="text-xs font-extrabold tracking-widest uppercase opacity-70">🔩 {sh.name}{remix ? " · Remix" : ""}</p>
          <p className="plk-display mt-1 text-5xl leading-none">Level {shown}</p>
          <div className="plk-bar mt-3"><b style={{ width: `${Math.round((at / STAGES_PER_SHOP) * 100)}%` }} /></div>
          <p className="mt-1 text-[11px] font-bold opacity-70">{at} of {STAGES_PER_SHOP} boards in this workshop</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="plk-btn plk-cta inline-flex items-center gap-2 px-7 py-3 text-xl"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { usePlank.getState().saveCurrent(null); onPlay(cur.stage); }} className="plk-btn plk-soft inline-flex items-center gap-1.5 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="plk-btn plk-cta inline-flex items-center gap-2 px-9 py-3.5 text-2xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between text-white drop-shadow-[0_1px_2px_rgba(40,20,6,.7)]">
          <h2 className="plk-display text-[24px] leading-none">The workshops</h2>
          <span className="text-xs font-bold opacity-80">{STAGES_PER_SHOP} boards each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHOPS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_SHOP) > i || remix, now = i === si;
            return (
              <div key={s.id} className={`rounded-2xl border-[3px] p-3 text-white shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: now ? "#fff" : "#5a3410", background: `linear-gradient(150deg, ${s.sky[0]}, ${s.sky[1]})` }}>
                <p className="text-[13px] font-extrabold drop-shadow">{s.name}</p>
                <p className="text-[11px] font-bold opacity-90 drop-shadow">{now ? `board ${((stage - 1) % STAGES_PER_SHOP) + 1} of ${STAGES_PER_SHOP}` : done ? "★ complete" : `from level ${i * STAGES_PER_SHOP + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="plk-sheet mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="plk-display text-lg">How it works</p>
          <p>🔩 Tap a screw, then a free hole. Planks on one screw swing; planks with none fall.</p>
          <p>🧱 Screws under a plank are stuck until it&apos;s gone — clear from the top down.</p>
          <p>🎯 Moves are limited and careless moves can trap you. 600 levels, then endless remixes.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold text-white/80">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
