"use client";
// Blocktide — one endless block puzzle. Drag sea-glass jelly pieces onto an 8×8 reef; full rows and columns wash
// away. No levels and no modes: one run until the tray no longer fits, and as the score climbs the run dives
// through eight depth zones, each with its own light and music. Phone-app flow: home → play → result → play again.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Layers, Play, RefreshCcw, Shuffle, Sparkles, Trophy, Undo2, Waves, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { cloneBoard, emptyBoard, fillRatio, fitsAnywhere, N, place, shapeOf, type Board } from "../board";
import { deal, endlessDifficulty } from "../dealer";
import { PRAISE, REALMS, demoBoard, depthOf, scoreMove } from "../levels";
import { useTide, useTideHydrated, type Run } from "../save";
import type { Piece } from "../shapes";
import { rngFrom } from "../../sudoku/rng";
import { Stage, type StageHandle } from "./Stage";
import { TIDE_CSS } from "./styles";

export const TIDE_SFX = ["pick", "place", "back", "clear1", "clear2", "clear3", "combo", "pearl", "allclear", "deal", "undo", "swap", "over", "win", "open", "power"] as const;
type Sfx = (typeof TIDE_SFX)[number];
const sfxName = (k: Sfx) => `a:tide_${k}` as Sound;
const music = (k: string) => `a:tide_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };

interface Result { score: number; coins: number; newBest: boolean; lines: number; zone: number }
interface Snap { board: Board; tray: (Piece | null)[]; score: number; combo: number; miss: number; moves: number; lines: number }

export default function TideApp({ slug }: { slug: string; title: string }) {
  const ready = useTideHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [run, setRun] = useState<Run | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [over, setOver] = useState(false);
  const [toast, setToast] = useState("");
  const [banner, setBanner] = useState<{ name: string; k: number } | null>(null);
  const [help, setHelp] = useState(false);
  const [shown, setShown] = useState(0);
  const runRef = useRef<Run | null>(null);
  const hist = useRef<Snap[]>([]);
  const miss = useRef(0);
  const stage = useRef<StageHandle>(null);
  useEffect(() => { runRef.current = run; }, [run]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 2600); return () => clearTimeout(t); }, [banner]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Filling the tide pools");
    void audio.preload(TIDE_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    const r = useTide.getState().run;
    audio.warmMusic([music(REALMS[r ? depthOf(r.score).zone : 0].music)]);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { col?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    const pan = o.col !== undefined ? ((o.col / (N - 1)) * 2 - 1) * 0.7 : 0;
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan, rate: o.rate, delay: o.delay, reverb: 0.22, duck: k === "allclear" || k === "win" });
  }, []);

  // score counter eases toward the real score
  useEffect(() => {
    const target = run?.score ?? 0;
    if (shown === target) return;
    const t = setTimeout(() => setShown((s) => (Math.abs(target - s) < 3 ? target : Math.round(s + (target - s) * 0.35))), 30);
    return () => clearTimeout(t);
  }, [run?.score, shown]);

  // ---------------------------------------------------------------- dealing
  const dealFor = useCallback((r: Run, board: Board) => deal(board, rngFrom(`${r.seed}:deal:${r.deals}`), { difficulty: endlessDifficulty(r.score) }), []);

  const start = useCallback((resume?: Run) => {
    hist.current = []; miss.current = 0;
    setResult(null); setOver(false);
    let r: Run;
    if (resume) r = resume;
    else {
      r = { board: emptyBoard(), tray: [], score: 0, combo: 0, moves: 0, lines: 0, seed: `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`, deals: 0, revived: false };
      r.tray = dealFor(r, r.board); r.deals = 1;
    }
    setRun(r); setShown(r.score);
    setScreen("game");
    const zone = depthOf(r.score).zone;
    void audio.playMusic(music(REALMS[zone].music));
    audio.warmMusic([music(REALMS[(zone + 1) % REALMS.length].music)]);
    sfx("open", { gain: 0.5 });
    if (!useTide.getState().seenHelp) setHelp(true);
    track("tide_start", { resume: !!resume });
  }, [dealFor, sfx]);

  // ---------------------------------------------------------------- end of a run
  const finishGame = useCallback((r: Run) => {
    const { newBest } = useTide.getState().endGame(r.score, r.lines);
    const coins = Math.max(2, Math.round(r.score / 120));
    useProfile.getState().earnCoins(coins);
    setResult({ score: r.score, coins, newBest, lines: r.lines, zone: depthOf(r.score).zone });
    track("tide_end", { score: r.score, lines: r.lines, moves: r.moves });
    sfx(newBest && r.score > 0 ? "win" : "over", { gain: 0.75 });
  }, [sfx]);

  // ---------------------------------------------------------------- a move
  const onPlace = useCallback((slot: number, rr: number, cc: number) => {
    const r0 = runRef.current;
    if (!r0 || result || over || paused) return;
    const p = r0.tray[slot];
    if (!p) return;
    hist.current = [...hist.current, { board: cloneBoard(r0.board), tray: r0.tray.slice(), score: r0.score, combo: r0.combo, miss: miss.current, moves: r0.moves, lines: r0.lines }].slice(-6);
    const board = cloneBoard(r0.board);
    const res = place(board, p.shape, p.color, rr, cc, p.pearl);
    const lines = res.rows.length + res.cols.length;
    let combo = r0.combo;
    if (lines) { combo += 1; miss.current = 0; } else if (++miss.current >= 3) combo = 0;
    const ms = scoreMove(res.placed.length, lines, res.pearls.length, res.allClear, lines ? combo : 0);
    const tray = r0.tray.slice(); tray[slot] = null;
    const r: Run = { ...r0, board, tray, score: r0.score + ms.total, combo, moves: r0.moves + 1, lines: r0.lines + lines };
    // sounds + feel
    const s = shapeOf(p.shape), col = cc + s.w / 2;
    sfx("place", { col, gain: 0.5, rate: 1.12 - Math.min(0.3, s.size * 0.03) });
    buzz(lines ? 28 : 8);
    if (lines) {
      sfx(lines >= 3 ? "clear3" : lines === 2 ? "clear2" : "clear1", { col, gain: 0.7, delay: 0.04 });
      if (combo > 1) sfx("combo", { col, gain: 0.55, rate: Math.min(1.6, 0.9 + combo * 0.08), delay: 0.12 });
    }
    res.pearls.forEach((i, k) => sfx("pearl", { col: i % N, delay: 0.1 + k * 0.07, gain: 0.55, rate: 1 + k * 0.05 }));
    if (res.allClear) sfx("allclear", { gain: 0.8, delay: 0.15 });
    const praise = res.allClear ? "All clear!" : lines >= 2 || combo >= 3 ? PRAISE[Math.min(PRAISE.length - 1, lines + Math.floor(combo / 2))] : "";
    stage.current?.burst(res, lines ? ms.total : 0, praise, lines ? combo : 0);
    // powers: every 12 lines cleared earns one
    if (lines && Math.floor(r.lines / 12) > Math.floor(r0.lines / 12)) {
      const k = Math.floor(r.lines / 12) % 2 ? "undo" : "swap";
      useTide.getState().addPower(k);
      setToast(k === "undo" ? "+1 Undo earned!" : "+1 Swap earned!");
      sfx("power", { gain: 0.5, delay: 0.3 });
    }
    // deeper? new zone: new light, new music
    const d0 = depthOf(r0.score), d1 = depthOf(r.score);
    if (d1.zone !== d0.zone || d1.dive !== d0.dive) {
      const z = REALMS[d1.zone];
      setBanner({ name: z.name, k: Date.now() });
      void audio.playMusic(music(z.music));
      audio.warmMusic([music(REALMS[(d1.zone + 1) % REALMS.length].music)]);
      sfx("win", { gain: 0.55, delay: 0.35 });
      useTide.getState().reached(d1.zone + d1.dive * REALMS.length);
    }
    // next tray
    if (tray.every((x) => !x)) { r.tray = dealFor(r, board); r.deals += 1; sfx("deal", { gain: 0.35, delay: 0.2 }); }
    setRun(r);
    useTide.getState().saveRun(r);
  }, [result, over, paused, sfx, dealFor]);

  // stuck? (after a move, a swap, or a resumed run) — none of the pieces fit anywhere
  const stuck = screen === "game" && !!run && !result && !over && run.tray.some(Boolean) && !run.tray.some((x) => x && fitsAnywhere(run.board, shapeOf(x.shape)));
  useEffect(() => {
    if (!stuck) return;
    const t = setTimeout(() => { setOver(true); sfx("over", { gain: 0.5 }); stage.current?.shake(12); }, 600);
    return () => clearTimeout(t);
  }, [stuck, sfx]);

  // ---------------------------------------------------------------- powers
  const restoreSnap = (snap: Snap) => {
    const r0 = runRef.current!;
    miss.current = snap.miss;
    const r = { ...r0, board: snap.board, tray: snap.tray, score: snap.score, combo: snap.combo, moves: snap.moves, lines: snap.lines };
    setRun(r); setOver(false);
    useTide.getState().saveRun(r);
  };
  const doUndo = () => {
    const snap = hist.current[hist.current.length - 1];
    if (result) return;
    if (!snap) { setToast("Nothing to undo"); return; }
    if (!useTide.getState().usePower("undo")) { setToast("No Undo left — clear lines to earn more"); return; }
    hist.current = hist.current.slice(0, -1);
    restoreSnap(snap); sfx("undo", { gain: 0.55 });
  };
  const doSwap = () => {
    const r0 = runRef.current;
    if (!r0 || result) return;
    if (!useTide.getState().usePower("swap")) { setToast("No Swap left — clear lines to earn more"); return; }
    const r = { ...r0, deals: r0.deals + 1 };
    const fresh = dealFor(r, r0.board);
    r.tray = r0.tray.map((x, k) => (x ? fresh[k] : null));
    hist.current = [];
    setRun(r); setOver(false);
    useTide.getState().saveRun(r);
    sfx("swap", { gain: 0.55 });
  };
  /** one free rescue per run: the three fullest lines wash away */
  const doWave = () => {
    const r0 = runRef.current;
    if (!r0 || r0.revived) return;
    const b = cloneBoard(r0.board);
    const lines: { k: number; cells: number[] }[] = [];
    for (let i = 0; i < N; i++) {
      const row = Array.from({ length: N }, (_, j) => i * N + j), col = Array.from({ length: N }, (_, j) => j * N + i);
      lines.push({ k: row.filter((x) => b.color[x]).length, cells: row }, { k: col.filter((x) => b.color[x]).length, cells: col });
    }
    lines.sort((a, c) => c.k - a.k);
    const cleared: { i: number; color: number }[] = [];
    for (const l of lines.slice(0, 3)) for (const i of l.cells) if (b.color[i]) { cleared.push({ i, color: b.color[i] }); b.color[i] = 0; b.pearl[i] = 0; b.ice[i] = 0; }
    const r = { ...r0, board: b, revived: true };
    setRun(r); setOver(false);
    useTide.getState().saveRun(r);
    stage.current?.burst({ placed: [], rows: [], cols: [], cleared, pearls: [], iceBroken: [], allClear: false }, 0, "Second wave!", 0);
    sfx("allclear", { gain: 0.7 });
  };

  // keyboard
  useEffect(() => {
    if (screen !== "game") return;
    const on = (e: KeyboardEvent) => { if (result) return; const k = e.key.toLowerCase(); if (k === "z" || k === "u") doUndo(); else if (k === "s") doSwap(); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __tide?: unknown }).__tide = {
      run: () => runRef.current,
      start: () => start(),
      place: (slot: number, r: number, c: number) => onPlace(slot, r, c),
      score: (s: number) => { const r = runRef.current; if (r) setRun({ ...r, score: s }); },
      demo: (seed: string, fill = 0.4) => { const r = runRef.current; if (r) setRun({ ...r, board: demoBoard(seed, fill) }); },
      fill: (k: number) => { const r = runRef.current; if (!r) return; const b = cloneBoard(r.board); let n = 0; for (let i = 0; i < N * N && n < k; i++) if (!b.color[i] && (i % N) !== (Math.floor(i / N) % N)) { b.color[i] = 1 + (i % 7); n++; } setRun({ ...r, board: b }); },
    };
  }, [start, onPlace]);

  const leave = () => { if (runRef.current && !result) useTide.getState().saveRun(runRef.current); setScreen("home"); setRun(null); setResult(null); setOver(false); void audio.playMusic(music("title")); };
  const endOver = () => { const r = runRef.current; setOver(false); if (r) finishGame(r); };

  const depth = depthOf(run?.score ?? 0);
  const realm = REALMS[screen === "game" ? depth.zone : 0];
  const fits = run ? run.tray.map((x) => (x ? fitsAnywhere(run.board, shapeOf(x.shape)) : true)) : [true, true, true];
  const crowded = run ? fillRatio(run.board) > 0.68 : false;
  const save = useTide();
  const toNext = run ? Math.min(1, Math.max(0, (run.score - depth.from) / Math.max(1, depth.next - depth.from))) : 0;

  return (
    <div className="tde-root" style={{ ["--deep" as string]: realm.deep, ["--c1" as string]: realm.c1, ["--c2" as string]: realm.c2 }}>
      <style>{TIDE_CSS}</style>
      <div className="tde-rays" /><div className="tde-bubbles">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.7) % 9}s`, animationDuration: `${7 + (i % 5) * 2}s`, width: 4 + (i % 4) * 3, height: 4 + (i % 4) * 3 }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={() => start()} onResume={() => { const r = useTide.getState().run; if (r) start(r); }} />}

      {screen === "game" && run && (
        <div className={`absolute inset-0 flex flex-col ${crowded ? "tde-danger" : ""}`}>
          <div className="flex items-center gap-2 pt-[max(env(safe-area-inset-top),10px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="tde-glass grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="min-w-0 flex-1">
              <p className="tde-display truncate text-lg leading-tight">{realm.name}{depth.dive ? ` · Dive ${depth.dive + 1}` : ""}</p>
              <div className="mt-1 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${toNext * 100}%`, background: `linear-gradient(90deg, ${realm.c1}, ${realm.c2})` }} /></div>
            </div>
            <div className="tde-glass flex items-center gap-1.5 !rounded-2xl px-3 py-1.5 text-sm font-extrabold"><Trophy className="size-4 text-[#FFD166]" />{Math.max(save.best, run.score).toLocaleString()}</div>
          </div>
          <div className="px-4 text-center">
            <p className="tde-display tde-score tabular-nums">{shown.toLocaleString()}</p>
            {run.combo > 1 && <p className="-mt-1 text-xs font-extrabold tracking-wider text-[#ffb8dd] uppercase">Combo ×{run.combo}</p>}
          </div>
          <div className="relative min-h-0 flex-1">
            <Stage ref={stage} board={run.board} tray={run.tray} glow={realm.c1} locked={!!result || over || paused} fits={fits} onPlace={onPlace}
              onPick={(k) => { if (run.tray[k]) sfx("pick", { col: k * 3.5, gain: 0.35, rate: 1.1 }); }}
              onDrop={(ok) => { if (!ok) sfx("back", { gain: 0.3 }); }} />
            <AnimatePresence>
              {banner && (
                <motion.div key={banner.k} className="pointer-events-none absolute inset-x-0 top-[30%] z-20 text-center" initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20 }}>
                  <p className="text-xs font-extrabold tracking-[.3em] text-white/80 uppercase">Diving deeper</p>
                  <p className="tde-display tde-grad text-5xl">{banner.name}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex justify-center gap-5 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),12px)]">
            <button type="button" className="tde-tool" onClick={doUndo}><span className="tde-tool-ico"><Undo2 className="size-5" /><span className="tde-badge">{save.undo}</span></span>Undo</button>
            <button type="button" className="tde-tool" onClick={doSwap}><span className="tde-tool-ico"><Shuffle className="size-5" /><span className="tde-badge">{save.swap}</span></span>Swap</button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {over && run && !result && (
          <Sheet key="over" title="No room left!" onClose={endOver}>
            <p className="text-white/80">None of these pieces fit the reef.</p>
            <div className="mt-4 grid gap-2">
              {!run.revived && <button type="button" className="tde-btn tde-cta tde-shine flex items-center justify-center gap-2 py-3" onClick={doWave}><Waves className="size-5" /> Second wave — free</button>}
              {save.swap > 0 && <button type="button" className="tde-btn flex items-center justify-center gap-2 bg-white/12 py-3" onClick={doSwap}><Shuffle className="size-5" /> Swap pieces ({save.swap})</button>}
              {save.undo > 0 && run.moves > 0 && <button type="button" className="tde-btn flex items-center justify-center gap-2 bg-white/12 py-3" onClick={doUndo}><Undo2 className="size-5" /> Undo ({save.undo})</button>}
              <button type="button" className="tde-btn bg-white/8 py-3" onClick={endOver}>End game</button>
            </div>
          </Sheet>
        )}
        {result && <ResultSheet key="res" r={result} best={save.best} onAgain={() => start()} onHome={leave} />}
        {help && (
          <Sheet key="help" title="How to play" onClose={() => { setHelp(false); useTide.getState().sawHelp(); }}>
            <ul className="grid gap-2 text-[15px] text-white/85">
              <li>🧩 Drag a piece from the tray onto the reef. Pieces don&apos;t rotate.</li>
              <li>🌊 Fill a whole row or column and it washes away. Clear several at once, or clear move after move, for combos.</li>
              <li>🫧 Some pieces carry a pearl — wash it away for +100.</li>
              <li>🐠 The higher your score, the deeper you dive. It never ends until the pieces don&apos;t fit.</li>
            </ul>
            <button type="button" className="tde-btn tde-cta mt-5 w-full py-3" onClick={() => { setHelp(false); useTide.getState().sawHelp(); }}>Let&apos;s dive in</button>
          </Sheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#06304a] px-4 py-2 text-sm font-bold whitespace-nowrap text-white shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

// ------------------------------------------------------------------ sheets

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="tde-glass tde-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="tde-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/10"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ResultSheet({ r, best, onAgain, onHome }: { r: Result; best: number; onAgain: () => void; onHome: () => void }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 1000); setShown(Math.round(r.score * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [r.score]);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/55 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="tde-glass tde-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="tde-wavehead px-5 pt-6 pb-5">
          {r.newBest && r.score > 0 && <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }} className="mx-auto mb-1 w-fit rounded-full bg-[#FFD166] px-3 py-1 text-xs font-extrabold text-[#3a1d00] uppercase">New best!</motion.p>}
          <h2 className="tde-display text-4xl">The tide is out</h2>
          <p className="mt-1 text-sm font-bold text-white/85">You reached {REALMS[r.zone].name} · {r.lines} lines washed away</p>
        </div>
        <div className="px-5 py-4">
          <p className="tde-display tde-grad text-5xl">{shown.toLocaleString()}</p>
          <p className="mt-1 text-sm font-bold text-white/70">Best {best.toLocaleString()}</p>
          <p className="mt-2 flex items-center justify-center gap-1 text-sm font-bold"><CoinIcon size={18} /> +{r.coins}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="tde-btn tde-cta tde-shine flex items-center justify-center gap-2 py-3" onClick={onAgain}><RefreshCcw className="size-5" /> Play again</button>
            <button type="button" className="tde-btn bg-white/10 py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ------------------------------------------------------------------ home

function Home({ ready, onPlay, onResume }: { ready: boolean; onPlay: () => void; onResume: () => void }) {
  const save = useTide();
  const cur = save.run;
  const deepest = Math.min(REALMS.length - 1, save.deepest);
  return (
    <div className="tde-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Trophy, save.best.toLocaleString(), "Best", "#FFD166"], [Layers, save.lines.toLocaleString(), "Lines", "#22D3C5"], [Waves, String(save.games), "Games", "#FF8A6B"]].map(([I, v, k, c]) => {
            const Icon = I as typeof Trophy;
            return (
              <div key={k as string} className="tde-glass flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0" style={{ color: c as string }} />
                <span className="min-w-0"><span className="tde-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider text-white/60 uppercase">{k as string}</span></span>
              </div>
            );
          })}
        </div>

        <h1 className="tde-display tde-grad tde-title mt-5">Blocktide</h1>
        <p className="mt-1 max-w-lg text-[15px] font-semibold text-white/80">Drag jelly blocks onto the reef. Fill a row or a column and the tide washes it away. One puzzle that never ends — the higher you score, the deeper you dive.</p>

        {/* the one big play card */}
        <div className="tde-shine relative mt-5 overflow-hidden rounded-[30px] p-5 text-white shadow-[0_24px_50px_-24px_rgba(34,211,197,.8)]" style={{ background: "linear-gradient(150deg, #22d3c5, #0a5f7a 70%, #06233d)" }}>
          <MiniReef />
          <div className="relative">
            <p className="text-xs font-extrabold tracking-widest text-white/85 uppercase">{cur ? "Your dive is waiting" : "Endless block puzzle"}</p>
            <p className="tde-display mt-1 text-4xl leading-none">{cur ? `${cur.score.toLocaleString()} pts` : save.games ? `Best ${save.best.toLocaleString()}` : "Ready to dive?"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {cur ? (
                <>
                  <button type="button" onClick={onResume} className="tde-btn tde-cta inline-flex items-center gap-2 px-6 py-3 text-lg"><Play className="size-5 fill-current" /> Continue</button>
                  <button type="button" onClick={onPlay} className="tde-btn inline-flex items-center gap-1.5 bg-white/20 px-4 py-3"><RefreshCcw className="size-4" /> New game</button>
                </>
              ) : (
                <button type="button" onClick={onPlay} className="tde-btn tde-cta inline-flex items-center gap-2 px-8 py-3.5 text-xl"><Play className="size-6 fill-current" /> Play</button>
              )}
            </div>
          </div>
        </div>

        {/* the dive: zones you pass as the score climbs */}
        <div className="mt-6 flex items-end justify-between">
          <h2 className="tde-display text-[24px] leading-none">The dive</h2>
          <span className="text-xs font-bold text-white/60">Deeper as you score</span>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {REALMS.map((rl, i) => (
            <div key={rl.id} className={`tde-glass shrink-0 !rounded-2xl px-3 py-2 ${i <= deepest ? "" : "opacity-45"}`} style={{ boxShadow: i <= deepest ? `inset 0 -3px 0 ${rl.c1}` : undefined }}>
              <span className="block text-[12px] font-extrabold whitespace-nowrap">{rl.name}</span>
              <span className="block text-[10px] font-bold text-white/60">{i <= deepest ? "reached" : "deeper…"}</span>
            </div>
          ))}
        </div>

        <h2 className="tde-display mt-7 text-2xl">How to play</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            [Layers, "Fill a line", "Drag pieces onto the 8×8 reef. A full row or column washes away; several at once, or one after another, make combos."],
            [Sparkles, "Pearls and bonuses", "Some pieces carry a pearl — wash it away for +100. Clear the whole reef for +500."],
            [Waves, "Never-ending", "Every tray is checked to fit before it's dealt, so the run lasts as long as your plans do."],
            [Undo2, "Get out of a jam", "Undo and Swap are earned by clearing lines, and every run has one free Second wave."],
          ].map(([I, t, d]) => {
            const Icon = I as typeof Trophy;
            return (
              <div key={t as string} className="tde-glass flex gap-3 p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15"><Icon className="size-5 text-[#7ff3ff]" /></span>
                <span><span className="block font-extrabold">{t as string}</span><span className="block text-sm text-white/70">{d as string}</span></span>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[11px] font-bold text-white/45">Scores are saved on this device and join the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}

/** a small decorative reef in the play card (CSS blocks, no images) */
function MiniReef() {
  const cells = [[0, 1, 4], [0, 2, 4], [1, 2, 4], [1, 3, 5], [2, 1, 1], [2, 2, 1], [2, 3, 5], [3, 0, 2], [3, 1, 1], [3, 3, 6], [4, 0, 2], [4, 1, 2], [4, 2, 7], [4, 3, 6]];
  const col = ["", "#FF6B6B", "#FFB938", "#7EDC4A", "#22D3C5", "#3FA2F5", "#9370FF", "#FF6FB5"];
  return (
    <div className="pointer-events-none absolute top-4 right-4 grid grid-cols-4 gap-1 opacity-90" style={{ width: 104 }}>
      {Array.from({ length: 20 }, (_, k) => {
        const r = Math.floor(k / 4), c = k % 4;
        const hit = cells.find(([a, b]) => a === r && b === c);
        return <span key={k} className="aspect-square rounded-[6px]" style={hit ? { background: `linear-gradient(145deg, #ffffff88, ${col[hit[2]]} 45%)`, boxShadow: "inset 0 -3px 0 #0003" } : { background: "#ffffff14" }} />;
      })}
    </div>
  );
}
