"use client";
// Neon Tac Duel — 3D neon tic-tac-toe puzzles. You are X. Most stages are "win in N": a position where you can force a
// win in exactly N moves against a rival that always blocks and always takes its own win — find the threats that leave
// it two cells to cover. Every 10th stage is a full duel. Twelve neon worlds bring bigger boards, pillars, gravity drops
// and Infinity marks (your oldest mark vanishes). 600 designed stages arrive one by one, then endless remixes.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronRight, Lightbulb, Play, RotateCcw, Star, Swords, Trophy, Undo2, X as XIcon, Target } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { clone, forcedWin, landing, lineAt, playable, put, rivalMove, X, O, type State } from "../engine";
import { DESIGNED, RULE_LABEL, STAGES_PER_WORLD, WORLDS, passOf, worldOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { useTac, useTacHydrated, type Game } from "../save";
import { TacScene, type SceneSound } from "./Scene";
import { TAC_CSS } from "./styles";

export const TAC_SFX = ["place", "drop", "rival", "vanish", "line", "denied", "hint", "undo", "win", "lose", "draw", "star", "world", "open"] as const;
type Sfx = (typeof TAC_SFX)[number];
const sfxName = (k: Sfx) => `a:tac_${k}` as Sound;
const music = (k: string) => `a:tac_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const RIVALS = ["Glitch", "Laser", "Pixel", "Dropbot", "Loopy", "Prism", "Turbo", "Retro", "Volt", "Bloom", "Nova", "Core"];
const TIPS: Record<string, [string, string]> = {
  puzzle: ["Win in N", "Every puzzle can be won in exactly that many moves — if you play the right threats. The rival always blocks and always takes its own win."],
  pillars: ["Pillars", "Glowing crystal pillars block their squares. Nobody can play there, and lines can't pass through them."],
  gravity: ["Gravity drop", "Marks drop to the lowest empty square of the column you tap, like coins in a slot."],
  infinity: ["Infinity marks", "Each side keeps only a few marks. When you place one more, your oldest mark vanishes — the blinking one."],
  five: ["Five in a row", "On this big board you need five in a row. Build threats from far away!"],
  duel: ["Duel!", "A whole game from an empty board against this world's rival. You go first. Win to move on — a draw means a rematch."],
  counter: ["Watch out!", "Here the rival already threatens a line. Block it first — and try to make your block a threat of your own."],
  remix: ["Endless duels", "You've finished all 600 designed stages! From here every stage is a fresh remix of all the rules — forever."],
};
interface Result { stage: number; stars: number; coins: number; worldDone: boolean; gift: string; used: number; duel: boolean }
const toState = (g: Game): State => ({ cells: Int8Array.from(g.cells), order: [g.order[0].slice(), g.order[1].slice()] });
const fromState = (s: State, g: Game): Game => ({ ...g, cells: Array.from(s.cells), order: [s.order[0].slice(), s.order[1].slice()] });
const swapped = (s: State): State => { const t = clone(s); for (let i = 0; i < t.cells.length; i++) t.cells[i] = t.cells[i] === 1 ? 2 : t.cells[i] === 2 ? 1 : t.cells[i]; t.order = [t.order[1], t.order[0]]; return t; };

export default function TacApp({ slug }: { slug: string; title: string }) {
  const ready = useTacHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useTac((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "lose" | "help" | "tip">("");
  const [loseWhy, setLoseWhy] = useState("");
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [toast, setToast] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TacScene | null>(null);
  const hist = useRef<Game[]>([]);
  const [histN, setHistN] = useState(0);
  const [rematch, setRematch] = useState(0);
  const busy = useRef(false);
  const onPlan = useRef(true);
  const timers = useRef<number[]>([]);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null);
  const stateRef = useRef({ result: false, sheet: "", paused: false });
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { result: !!result, sheet, paused }; }, [result, sheet, paused]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const clearTimers = () => { for (const t of timers.current) clearTimeout(t); timers.current = []; };
  const setG = useCallback((g: Game) => { setGame(g); gameRef.current = g; }, []);
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  const warnOf = (d: StageDef, g: Game) => d.rules.keep ? [0, 1].filter((p) => g.order[p].length >= d.rules.keep).map((p) => g.order[p][0]) : [];
  const applyPending = useCallback(() => {
    const sc = sceneRef.current, p = pendingRef.current; if (!sc || !p) return; pendingRef.current = null;
    const w = worldOf(p.d.stage); sc.setStage(p.d.rules, p.g.cells, w.c1, w.c2, w.grid); sc.setWarn(warnOf(p.d, p.g));
  }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Powering up the grid");
    void audio.preload(TAC_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(worldOf(useTac.getState().stage).music)]);
    prepareStage(useTac.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); clearTimers(); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.18, duck: k === "win" || k === "world" });
  }, []);
  const persist = useCallback((g: Game) => { const d = defRef.current; if (!d) return; useTac.getState().saveCurrent({ stage: d.stage, game: g, revived: false }); }, []);

  // ---------------------------------------------------------------- endings
  const finishWin = useCallback((g: Game) => {
    const d = defRef.current!;
    const stars = g.hints ? 1 : g.undos ? 2 : 3;
    const coins = 5 + (d.kind === "duel" ? 10 : d.moves * 3) + stars * 3 + (d.boss ? 20 : d.showcase ? 8 : 0);
    useProfile.getState().earnCoins(coins);
    useTac.getState().win(d.stage, stars, 1);
    let gift = "";
    const give = useTac.getState().giveBooster;
    if (d.boss) { give("hint", 2); give("undo", 3); gift = "+2 Hints · +3 Undos"; }
    else if (d.showcase) { give("undo", 2); gift = "+2 Undos"; }
    else if (d.stage % 10 === 0) { give("hint", 1); gift = "+1 Hint"; }
    const worldDone = d.stage % STAGES_PER_WORLD === 0;
    later(() => {
      setResult({ stage: d.stage, stars, coins, worldDone, gift, used: g.used, duel: d.kind === "duel" });
      sfx(worldDone ? "world" : "win", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 1300);
    track("tac_clear", { stage: d.stage, stars });
  }, [sfx]);
  const fail = useCallback((why: string) => {
    later(() => { setLoseWhy(why); setSheet("lose"); sfx("lose", { gain: 0.6 }); }, 900);
  }, [sfx]);

  // ---------------------------------------------------------------- moves
  const draw = (g: Game) => {
    const d = defRef.current!;
    busy.current = true;
    if (d.kind === "duel") { sfx("draw", { gain: 0.55 }); setToast("Draw! Rematch…"); later(() => setRematch((n) => n + 1), 1600); }
    else { setG({ ...g, over: "lose" }); fail("The board filled up without a line."); }
  };

  // a plain function (not a hook): it reads the latest state through refs
  const rivalTurn = (g0: Game) => {
    const d = defRef.current!, sc = sceneRef.current;
    busy.current = true; setTurn(2);
    later(() => {
      const s = toState(g0);
      const m = rivalMove(d.rules, s, d.kind === "puzzle" ? 1 : d.skill, Math.random);
      if (m < 0) { busy.current = false; setTurn(1); return; }
      put(d.rules, s, m, O);
      const line = lineAt(d.rules, s, m, O);
      const g: Game = { ...fromState(s, g0), over: line ? "lose" : "" , line: line ?? undefined };
      setG(g);
      sc?.sync(g.cells); sc?.setWarn(warnOf(d, g));
      sfx("rival", { x: 0, gain: 0.45 });
      if (line) { sc?.winLine(line, O); useTac.getState().saveCurrent(null); fail(d.kind === "duel" ? `${RIVALS[WORLDS.indexOf(worldOf(d.stage))]} got a line first.` : "The rival made a line."); busy.current = false; return; }
      if (!playable(d.rules, s).length) { draw(g); return; }
      busy.current = false; setTurn(1); persist(g);
    }, 520 + Math.random() * 280);
  };


  const doTap = (i: number) => {
    const g0 = gameRef.current, d = defRef.current, sc = sceneRef.current, st = stateRef.current;
    if (!g0 || !d || !sc || st.result || st.sheet || st.paused || busy.current || g0.over) return;
    const s = toState(g0);
    const at = landing(d.rules, s, i);
    if (at < 0) { sc.deny(i); buzz(25); return; }
    hist.current = [...hist.current, g0].slice(-40); setHistN(hist.current.length);
    if (d.kind === "puzzle") onPlan.current = onPlan.current && d.path[g0.used * 2] === at;
    put(d.rules, s, at, X);
    const line = lineAt(d.rules, s, at, X);
    const g: Game = { ...fromState(s, g0), used: g0.used + 1, over: line ? "win" : "", line: line ?? undefined };
    setG(g); buzz(10);
    sc.sync(g.cells); sc.setWarn(warnOf(d, g));
    if (line) { sc.winLine(line, X); busy.current = true; useTac.getState().saveCurrent(null); finishWin(g); return; }
    if (d.kind === "puzzle" && g.used >= d.moves) {
      busy.current = true; setG({ ...g, over: "lose" });
      // let the rival answer for show, then the sheet
      later(() => { const t = toState(g); const m = rivalMove(d.rules, t, 1, Math.random); if (m >= 0) { put(d.rules, t, m, O); sc.sync(Array.from(t.cells)); } }, 500);
      fail(`No line in ${d.moves} move${d.moves > 1 ? "s" : ""}. Every move must be a threat the rival has to block.`);
      return;
    }
    if (!playable(d.rules, s).length) { draw(g); return; }
    persist(g);
    rivalTurn(g);
  };
  const tapRef = useRef<(i: number) => void>(() => undefined);
  useEffect(() => { tapRef.current = doTap; });

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const sc = new TacScene(host.current, {
      canPlay: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused && !busy.current && !gameRef.current.over; },
      tap: (i) => tapRef.current(i),
      sound: (e: SceneSound, pan: number) => {
        if (e === "line") return;
        if (e === "hover") return;
        sfx(e as Sfx, { x: pan, gain: e === "vanish" ? 0.4 : 0.55 });
      },
    });
    sceneRef.current = sc;
    applyPending();
    return () => { sc.dispose(); sceneRef.current = null; };
  }, [screen, sfx, applyPending]);

  // ---------------------------------------------------------------- stages
  const start = useCallback(async (stage: number, resume?: { game: Game; revived: boolean }) => {
    clearTimers();
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const fresh: Game = { cells: Array.from(d.start.cells), order: [d.start.order[0].slice(), d.start.order[1].slice()], used: 0, hints: 0, undos: 0, over: "" };
    const g = resume?.game && resume.game.cells.length === fresh.cells.length && !resume.game.over ? resume.game : fresh;
    setDef(d); defRef.current = d; setG(g); setResult(null); setSheet(""); setTurn(1);
    hist.current = []; setHistN(hist.current.length); busy.current = false; onPlan.current = g === fresh;
    setScreen("game");
    const w = worldOf(stage);
    void audio.playMusic(music(w.music));
    audio.warmMusic([music(worldOf(stage + STAGES_PER_WORLD).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = useTac.getState().tips;
    const has: Record<string, boolean> = {
      remix: stage > DESIGNED, duel: d.kind === "duel", puzzle: d.kind === "puzzle", pillars: d.start.cells.some((c) => c === 3), gravity: d.rules.gravity,
      infinity: d.rules.keep > 0, five: d.rules.k >= 5, counter: d.kind === "puzzle" && d.path.length > 0 && (() => { const t = clone(d.start); return playable(d.rules, t).some((c) => { const u = clone(t); put(d.rules, u, c, O); return !!lineAt(d.rules, u, c, O); }); })(),
    };
    const tip = ["remix", "puzzle", "duel", "pillars", "gravity", "infinity", "five", "counter"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useTac.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); }
    else setToast(d.kind === "duel" ? `Duel vs ${RIVALS[WORLDS.indexOf(w)]}!` : `Win in ${d.moves} · ${RULE_LABEL[d.ruleName]}`);
    track("tac_start", { stage });
  }, [sfx, applyPending, setG]);
  const doRestart = () => { const d = defRef.current; if (!d) return; useTac.getState().saveCurrent(null); void start(d.stage); };
  // a drawn duel starts again by itself
  useEffect(() => { if (!rematch) return; const d = defRef.current; if (!d) return; useTac.getState().saveCurrent(null); void start(d.stage); }, [rematch, start]);

  // ---------------------------------------------------------------- boosters
  const nextMove = useCallback((): number => {
    const g = gameRef.current, d = defRef.current; if (!g || !d) return -1;
    const s = toState(g);
    if (d.kind === "duel") return rivalMove(d.rules, swapped(s), 1, () => 0.5);
    if (onPlan.current && d.path[g.used * 2] !== undefined) return d.path[g.used * 2];
    const p = forcedWin(d.rules, s, Math.max(1, d.moves - g.used), { n: 25000 });
    return p ? p[0] : -1;
  }, []);
  const doHint = () => {
    const g = gameRef.current, sc = sceneRef.current; if (!g || !sc || result || busy.current || g.over) return;
    const m = nextMove();
    if (m < 0) { setToast("No forced win from here — undo or restart"); return; }
    if (!useTac.getState().useBooster("hint")) { setToast("No hints left"); return; }
    const g2 = { ...g, hints: g.hints + 1 }; setG(g2); persist(g2);
    sc.hint(m); sfx("hint", { gain: 0.5 }); setToast("Play the glowing square");
  };
  const doUndo = () => {
    const prev = hist.current[hist.current.length - 1], d = defRef.current;
    if (!prev || !d || result || (busy.current && !gameRef.current?.over)) { setToast("Nothing to undo"); return; }
    if (!useTac.getState().useBooster("undo")) { setToast("No undos left"); return; }
    clearTimers();
    hist.current = hist.current.slice(0, -1); setHistN(hist.current.length);
    const g = { ...prev, undos: (gameRef.current?.undos ?? 0) + 1, hints: gameRef.current?.hints ?? prev.hints };
    // stepping back off the plan's line? the hint re-solves
    onPlan.current = g.used === 0;
    setG(g); setSheet(""); busy.current = false; setTurn(1);
    const w = worldOf(d.stage); sceneRef.current?.setStage(d.rules, g.cells, w.c1, w.c2, w.grid); sceneRef.current?.setWarn(warnOf(d, g));
    sfx("undo", { gain: 0.5 }); persist(g);
  };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __tac?: unknown }).__tac = {
      game: () => gameRef.current, def: () => defRef.current, start: (stage: number) => void start(stage),
      tap: (i: number) => tapRef.current(i), busy: () => busy.current, next: () => nextMove(),
      at: (i: number) => { const r = host.current?.getBoundingClientRect(), p = sceneRef.current?.screenOf(i); return p && r ? { x: r.left + p.x, y: r.top + p.y } : null; },
    };
  }, [start, nextMove]);

  const leave = () => { clearTimers(); const g = gameRef.current; if (g && !result && !g.over) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); busy.current = false; void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const w = worldOf(screen === "game" ? stage : useTac.getState().stage);
  const wi = WORLDS.indexOf(w);
  const rival = RIVALS[wi];
  const inS = ((stage - 1) % STAGES_PER_WORLD) + 1;
  const left = def && game ? Math.max(0, def.moves - game.used) : 0;
  const vars = { ["--c1" as string]: w.c1, ["--c2" as string]: w.c2, ["--c3" as string]: w.grid };
  return (
    <div className="tac-root" style={vars}>
      <style>{TAC_CSS}</style>
      <div className="tac-horizon" aria-hidden />
      <div className="tac-floor" aria-hidden />
      <div className="tac-bubbles" aria-hidden>{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, width: 12 + ((i * 13) % 28), height: 12 + ((i * 13) % 28), animationDuration: `${13 + (i % 5) * 4}s`, animationDelay: `${-i * 2.3}s` }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && def && game && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-start gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="tac-round grid size-11 shrink-0 place-items-center"><ArrowLeft className="size-5" /></button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <p className="tac-display tac-glowtext text-xl leading-none">Level {stage}{def.boss ? " · Finale" : def.showcase ? " · Big board" : ""}</p>
              <p className="text-[11px] font-bold opacity-80">{w.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_WORLD}</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="tac-chip">{RULE_LABEL[def.ruleName]} · {def.rules.k} in a row</span>
                {def.kind === "puzzle" ? <span className={`tac-chip ${left <= 1 ? "tac-low" : ""}`}><Target className="size-3.5" /> Win in {def.moves} · {left} left</span> : <span className="tac-chip"><Swords className="size-3.5" /> Duel</span>}
              </div>
            </div>
            <button type="button" aria-label="Restart" onClick={doRestart} className="tac-round grid size-11 shrink-0 place-items-center"><RotateCcw className="size-5" /></button>
          </div>
          <div className="flex items-center justify-center gap-2 px-3 pt-1">
            <div className={`tac-card ${turn === 1 && !game.over ? "on" : ""}`} style={{ ["--glow" as string]: w.c1 }}><span className="tac-display text-2xl" style={{ color: w.c1, textShadow: `0 0 10px ${w.c1}` }}>✕</span><span className="text-sm font-extrabold">You</span></div>
            <div className="tac-status min-w-[120px] text-center">{game.over === "win" ? "You win!" : game.over ? "Missed!" : turn === 1 ? "Your turn" : <span className="tac-think">thinking <i /><i /><i /></span>}</div>
            <div className={`tac-card ${turn === 2 && !game.over ? "on" : ""}`} style={{ ["--glow" as string]: w.c2 }}><span className="text-sm font-extrabold">{rival}</span><span className="tac-display text-2xl" style={{ color: w.c2, textShadow: `0 0 10px ${w.c2}` }}>◯</span></div>
          </div>
          <div className="relative min-h-0 flex-1"><div ref={host} className="tac-stage" /></div>
          <div className="flex items-end justify-center gap-5 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Undo2} label="Undo" n={boosters.undo} onClick={doUndo} />
            <Tool icon={Lightbulb} label="Hint" n={boosters.hint} onClick={doHint} />
            <Tool icon={RotateCcw} label="Retry" onClick={doRestart} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/20">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/30 border-t-[var(--c1)]" /><p className="tac-display tac-glowtext text-lg">Charging the grid…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "lose" && !result && (
          <Sheet key="lose" title={def?.kind === "duel" ? "Duel lost!" : "Not this time!"} onClose={() => undefined}>
            <p className="opacity-90">{loseWhy}</p>
            <div className="mt-4 grid gap-2">
              <button type="button" className="tac-btn tac-cta tac-shine py-3 text-lg" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
              {histN > 0 && boosters.undo > 0 && <button type="button" className="tac-btn tac-soft py-3" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Undo my move ({boosters.undo})</button>}
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useTac.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>✕ You are X. Tap a square to place your mark — get a full line (across, down or diagonal) to win.</li>
              <li>🎯 Puzzles say <b>Win in N</b>: you must make a line within N moves. The rival always blocks and always takes its own win.</li>
              <li>⚡ The trick: make threats it must block, until you make two at once.</li>
              <li>⚔️ Every 10th level is a duel from an empty board. Pillars, gravity and Infinity marks join later.</li>
            </ul>
            <button type="button" className="tac-btn tac-cta mt-5 w-full py-3 text-lg" onClick={() => { useTac.getState().sawHelp(); setSheet(""); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useTac.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="tac-btn tac-cta mt-5 w-full py-3 text-lg" onClick={() => { useTac.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="tac-pill pointer-events-none absolute bottom-28 left-1/2 z-50 -translate-x-1/2 text-sm whitespace-nowrap">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label: text, n, onClick }: { icon: typeof Star; label: string; n?: number; onClick: () => void }) {
  return (
    <button type="button" className="tac-tool" onClick={onClick}>
      <span className="tac-tool-ico tac-round"><Icon className="size-6" />{n !== undefined && <span className="tac-badge">{n}</span>}</span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="tac-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="tac-display tac-glowtext text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/10"><XIcon className="size-5" /></button>
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
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="tac-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="tac-head px-5 pt-5 pb-4">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#fff3a0] text-white drop-shadow-[0_0_8px_#ffe060]" : "fill-white/20 text-white/50"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="tac-display mt-1 text-3xl drop-shadow">{r.worldDone ? "World complete!" : r.duel ? "Duel won!" : "Line made!"}</h2>
          <p className="mt-1 text-sm font-bold opacity-90">{r.worldDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD} · ${r.used} move${r.used === 1 ? "" : "s"}`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="mt-1 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-white/15 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="tac-btn tac-cta tac-shine flex items-center justify-center gap-2 py-3 text-lg" onClick={onNext}>Level {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="tac-btn tac-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  return (
    <div className="tac-title" role="img" aria-label="Neon Tac Duel" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="tac-word tac-w1">{[..."NEON"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: i % 2 ? "var(--c2)" : "var(--c1)", animationDelay: `${i * 0.07}s, ${1 + i * 0.7}s` }}>{ch}</span>)}</div>
      <div className="tac-word tac-w2">{[..."TAC DUEL"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "var(--c3)", animationDelay: `${0.4 + i * 0.05}s, ${2 + i * 0.4}s`, width: ch === " " ? "0.3em" : undefined }}>{ch}</span>)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = useTac();
  const stage = save.stage, w = worldOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const wi = Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length;
  const remix = passOf(stage) > 0;
  const at = (shown - 1) % STAGES_PER_WORLD;
  return (
    <div className="tac-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Level"], [Star, String(save.totalStars), "Stars"], [Trophy, String(save.wins), "Wins"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="tac-sheet flex items-center gap-2 !rounded-[18px] px-3 py-2.5">
                <Icon className="size-6 shrink-0 text-[var(--c2)] drop-shadow-[0_0_6px_var(--c2)]" />
                <span className="min-w-0"><span className="tac-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Neon Tac Duel — 3D neon tic tac toe puzzles</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-bold opacity-90 sm:mx-auto">Neon tic-tac-toe with a brain twist: win in N moves against a rival that never misses a block.</p>

        <div className="tac-sheet tac-shine relative mt-3 overflow-hidden p-5">
          <p className="text-xs font-extrabold tracking-widest uppercase opacity-70">✕ {w.name}{remix ? " · Remix" : ""}</p>
          <p className="tac-display tac-glowtext mt-1 text-5xl leading-none">Level {shown}</p>
          <div className="tac-bar mt-3"><b style={{ width: `${Math.round((at / STAGES_PER_WORLD) * 100)}%` }} /></div>
          <p className="mt-1 text-[11px] font-bold opacity-70">{at} of {STAGES_PER_WORLD} levels in this world</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="tac-btn tac-cta inline-flex items-center gap-2 px-7 py-3 text-xl"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useTac.getState().saveCurrent(null); onPlay(cur.stage); }} className="tac-btn tac-soft inline-flex items-center gap-1.5 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="tac-btn tac-cta inline-flex items-center gap-2 px-9 py-3.5 text-2xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="tac-display tac-glowtext text-[24px] leading-none">The worlds</h2>
          <span className="text-xs font-bold opacity-75">{STAGES_PER_WORLD} levels each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORLDS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_WORLD) > i || remix, now = i === wi;
            return (
              <div key={s.id} className={`rounded-2xl border-2 p-3 ${done || now ? "" : "opacity-50"}`} style={{ borderColor: now ? s.c1 : "rgba(255,255,255,.2)", background: `linear-gradient(150deg, ${s.grid}44, #12062e)`, boxShadow: now ? `0 0 16px ${s.c1}` : undefined }}>
                <p className="text-[13px] font-extrabold" style={{ color: s.c2, textShadow: `0 0 8px ${s.c2}` }}>{s.name}</p>
                <p className="text-[11px] font-bold opacity-80">{now ? `level ${((stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}` : done ? "★ complete" : `vs ${RIVALS[i]} · from ${i * STAGES_PER_WORLD + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="tac-sheet mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="tac-display text-lg">How it works</p>
          <p>✕ Get a line of your marks. Puzzles give you N moves to force a win — the rival never misses a block.</p>
          <p>⚡ Make threats it has to block until you make two at once. Every 10th level is a full duel.</p>
          <p>🌆 Twelve neon worlds: bigger boards, pillars, gravity drops and Infinity marks. 600 levels, then endless remixes.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-60">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
