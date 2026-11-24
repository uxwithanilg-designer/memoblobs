"use client";
// Quiltfold — cut the board into rectangular patches, one number in each, its size. Nine kinds. Phone-app flow: home
// (score, streak, the Daily Quilt and the nine kinds with real puzzle pictures), the game (drag to cut a patch, tap to
// lift it; undo, reset, hint), and the clear sheet that rolls straight into the next puzzle, made in the background.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CalendarDays, Check, ChevronRight, Clock, Flame, LayoutGrid, Lightbulb, Play, RotateCcw, Sparkles, Star, Trophy, Undo2, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { cdn } from "@/lib/cdn";
import { track } from "@/lib/analytics";
import { KINDS, LEVEL_LABEL, area, kindOf, sameRect, scoreOf, type KindId, type Level, type Puzzle, type Rect, type ScoreParts } from "../kinds";
import { getPuzzle, nextEndless, prepareEndless } from "../factory";
import { coversGap, hint, isSolved, judge, lay, lift, patchAt, progress, rectFrom } from "../play";
import { liveStreak, useQuilt as useTrail, useQuiltHydrated as useTrailHydrated, type InProgress } from "../save";
import { Board } from "./Board";
import { QUILT_CSS } from "./styles";

export const QUILT_SFX = ["lay", "good", "lift", "bump", "solve", "hint", "undo", "reset", "select", "star", "open", "streak"] as const;
type Sfx = (typeof QUILT_SFX)[number];
const sfxName = (k: Sfx) => `a:quilt_${k}` as Sound;
const music = (k: string) => `a:quilt_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const fmt = (s: number) => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60), x = s % 60; return `${m}:${String(x).padStart(2, "0")}`; };
const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
/** the Daily Quilt: a different kind each day, Hard at weekends */
function dailyOf(d = new Date()): { kind: KindId; level: Level; seed: string; day: string } {
  const day = utcDay(d);
  const n = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
  const wd = d.getUTCDay();
  return { kind: KINDS[n % KINDS.length].id, level: wd === 0 || wd === 6 ? "hard" : "medium", seed: `daily-${day}`, day };
}
function untilMidnight(now: number) {
  const d = new Date(now), t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
  const s = Math.floor(t / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

interface Run { kind: KindId; level: Level; seed: string; daily?: string }
interface Result { parts: ScoreParts; total: number; coins: number; seconds: number; stars: number; newBest: boolean; streak: number }

export default function QuiltApp({ slug }: { slug: string; title: string }) {
  const ready = useTrailHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [run, setRun] = useState<Run | null>(null);
  const [puz, setPuz] = useState<Puzzle | null>(null);
  const [L, setL] = useState<Rect[]>([]);
  const [hist, setHist] = useState<Rect[][]>([]);
  const [hints, setHints] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ x: Rect | null; k: number }>({ x: null, k: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "rules" | "quit">("");
  const [pick, setPick] = useState<KindId | null>(null);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const LRef = useRef(L), puzRef = useRef<Puzzle | null>(null), runRef = useRef<Run | null>(null), secRef = useRef(0), hintsRef = useRef(0);
  useEffect(() => { LRef.current = L; }, [L]);
  useEffect(() => { puzRef.current = puz; }, [puz]);
  useEffect(() => { runRef.current = run; }, [run]);
  useEffect(() => { secRef.current = seconds; }, [seconds]);
  useEffect(() => { hintsRef.current = hints; }, [hints]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Threading the needle");
    void audio.preload(QUILT_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    const d = dailyOf();
    void getPuzzle({ kind: d.kind, level: d.level, seed: d.seed }).catch(() => {});
    audio.warmMusic([music("daily")]);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);

  const sfx = useCallback((k: Sfx, o: { cell?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    const p = puzRef.current;
    const pan = p && o.cell !== undefined && o.cell >= 0 ? (((o.cell % p.cols) / Math.max(1, p.cols - 1)) * 2 - 1) * 0.75 : 0;
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan, rate: o.rate, delay: o.delay, reverb: 0.25, duck: k === "solve" });
  }, []);

  // ---------------------------------------------------------------- start
  const startPuzzle = useCallback(async (r: Run, from?: InProgress) => {
    setBusy(true); setResult(null); setSheet(""); setFlash({ x: null, k: 0 });
    try {
      const p = from?.puzzle ?? (r.seed ? await getPuzzle({ kind: r.kind, level: r.level, seed: r.seed }) : await nextEndless(r.kind, r.level));
      setRun({ ...r, seed: p.seed }); setPuz(p);
      setL(from ? from.patches : []); setHist([]);
      setHints(from?.hints ?? 0); setSeconds(from?.seconds ?? 0);
      if (!from) useTrail.getState().start(p.kind);
      setScreen("game");
      void audio.playMusic(music(r.daily ? "daily" : kindOf(p.kind).music));
      if (!r.daily) prepareEndless(r.kind, r.level);
      if (!useTrail.getState().seenRules.includes(p.kind)) setSheet("rules");
      sfx("open", { gain: 0.5 });
      track("quilt_start", { kind: p.kind, level: p.level, daily: !!r.daily });
    } catch { setToast("That quilt didn't come out — try again."); }
    finally { setBusy(false); }
  }, [sfx]);

  // ---------------------------------------------------------------- timer + autosave
  const running = screen === "game" && !!puz && !paused && !result && !busy && sheet === "";
  useEffect(() => { if (!running) return; const t = setInterval(() => setSeconds((s) => s + 1), 1000); return () => clearInterval(t); }, [running]);
  const persist = useCallback(() => {
    const p = puzRef.current, r = runRef.current;
    if (!p || !r) return;
    useTrail.getState().saveCurrent({ daily: r.daily, puzzle: p, patches: LRef.current, seconds: secRef.current, hints: hintsRef.current });
  }, []);
  useEffect(() => { if (screen === "game" && puz && !result && seconds % 5 === 0) persist(); }, [seconds, screen, puz, result, persist]);

  // ---------------------------------------------------------------- finish
  const finish = useCallback(() => {
    const p = puzRef.current!, r = runRef.current!;
    const secs = secRef.current, h = hintsRef.current;
    const parts = scoreOf(p.kind, p.level, secs, h, r.daily ? 1.5 : 1);
    const par = kindOf(p.kind).par[p.level];
    const stars = h === 0 && secs <= par ? 3 : h <= 1 && secs <= par * 2 ? 2 : 1;
    const coins = Math.max(3, Math.round(parts.total / 30)) + (r.daily ? 30 : 0);
    useProfile.getState().earnCoins(coins);
    const res = useTrail.getState().finish({ kind: p.kind, level: p.level, daily: !!r.daily, score: parts.total, seconds: secs, hints: h, at: Date.now() }, r.daily);
    useTrail.getState().saveCurrent(null);
    track("quilt_solve", { kind: p.kind, level: p.level, seconds: secs, score: parts.total, daily: !!r.daily });
    sfx("solve", { gain: 0.85, delay: 0.1 });
    setTimeout(() => {
      setResult({ parts, total: parts.total, coins, seconds: secs, stars, newBest: res.newBest, streak: res.streak });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.5 + k * 0.26, gain: 0.55 });
      if (r.daily && res.streak > 1) sfx("streak", { delay: 1.4, gain: 0.55 });
    }, 900);
  }, [sfx]);

  // ---------------------------------------------------------------- cutting patches
  const commit = useCallback((next: Rect[]) => { setHist((h) => [...h, LRef.current].slice(-80)); LRef.current = next; setL(next); }, []);
  const onCut = useCallback((a: number, b: number) => {
    const p = puzRef.current;
    if (!p || result || paused) return;
    const cols = p.cols;
    // a tap on a patch lifts it
    if (a === b) {
      const on = patchAt(LRef.current, a, cols);
      if (on && area(on) > 1) { commit(lift(LRef.current, a, cols)); sfx("lift", { cell: a, gain: 0.45 }); return; }
    }
    const x = rectFrom(cols, a, b);
    if (coversGap(p, x)) { sfx("bump", { cell: b, gain: 0.45 }); setToast("A patch can't cover a hole"); return; }
    const r = lay(LRef.current, x);
    commit(r.patches);
    if (r.same) { sfx("lift", { cell: a, gain: 0.45 }); return; }
    const mine = judge(p, r.patches).find((j) => sameRect(j.rect, x));
    const pitch = Math.pow(2, PENTA[Math.min(PENTA.length - 1, area(x) - 1)] / 12);
    const mid = (x.r + Math.floor(x.h / 2)) * cols + x.c + Math.floor(x.w / 2);
    if (mine?.state === "good") { sfx("good", { cell: mid, rate: pitch * 0.85, gain: 0.6 }); if (navigator.vibrate) navigator.vibrate(10); }
    else sfx("lay", { cell: mid, rate: pitch * 0.9, gain: 0.5 });
    if (isSolved(p, r.patches)) finish();
  }, [result, paused, commit, sfx, finish]);

  const doUndo = () => { const prev = hist[hist.length - 1]; if (!prev || result) return; setHist(hist.slice(0, -1)); LRef.current = prev; setL(prev); sfx("undo", { gain: 0.5 }); };
  const doReset = () => { if (result || !LRef.current.length) return; commit([]); sfx("reset", { gain: 0.5 }); };
  const doHint = () => {
    const p = puzRef.current;
    if (!p || result) return;
    const r = hint(p, LRef.current);
    if (!r.rect) return;
    commit(r.patches); setHints((x) => x + 1); setFlash((f) => ({ x: r.rect, k: f.k + 1 }));
    sfx("hint", { gain: 0.6 });
    if (isSolved(p, r.patches)) finish();
  };

  // keyboard: Z undo, R reset, H hint
  useEffect(() => {
    if (screen !== "game") return;
    const on = (e: KeyboardEvent) => {
      if (sheet || result) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); doUndo(); }
      else if (k === "z" || k === "u") doUndo();
      else if (k === "r") doReset();
      else if (k === "h") doHint();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __quilt?: unknown }).__quilt = {
      puzzle: () => puzRef.current,
      play: (kind: KindId, level: Level) => void startPuzzle({ kind, level, seed: "" }),
      lay: (keep = 1) => { const p = puzRef.current; if (!p) return; const x = p.solution.slice(0, Math.max(0, p.solution.length - keep)); LRef.current = x; setL(x); return p.solution.slice(p.solution.length - keep); },
    };
  }, [startPuzzle]);

  const leave = () => { persist(); setScreen("home"); setPuz(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const done = puz ? progress(puz, L) : 0;

  return (
    <div className="qlt-root">
      <style>{QUILT_CSS}</style>

      {screen === "home" && (
        <Home ready={ready} now={now} busy={busy} onKind={(k) => { sfx("select", { gain: 0.4 }); setPick(k); }}
          onDaily={() => { const d = dailyOf(new Date(now)); void startPuzzle({ kind: d.kind, level: d.level, seed: d.seed, daily: d.day }); }}
          onResume={() => { const c = useTrail.getState().current; if (c) void startPuzzle({ kind: c.puzzle.kind, level: c.puzzle.level, seed: c.puzzle.seed, daily: c.daily }, c); }} />
      )}

      {screen === "game" && puz && run && (
        <div className="absolute inset-0 flex flex-col">
          <div className="flex items-center gap-2 pt-[max(env(safe-area-inset-top),10px)] pr-[64px] pb-2 pl-3">
            <button type="button" aria-label="Back" onClick={() => setSheet("quit")} className="qlt-stitched grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="min-w-0 flex-1">
              <p className="qlt-display truncate text-xl leading-tight">{run.daily ? "Daily Quilt" : kindOf(puz.kind).name}</p>
              <p className="truncate text-xs font-bold text-[#7a6650]">{run.daily ? `${kindOf(puz.kind).name} · ` : ""}{LEVEL_LABEL[puz.level]} · {puz.rows}×{puz.cols}</p>
            </div>
            <div className="qlt-stitched flex items-center gap-1 !rounded-2xl px-3 py-2 font-extrabold tabular-nums"><Clock className="size-4" /> {fmt(seconds)}</div>
          </div>
          {/* progress */}
          <div className="mx-4 h-2 overflow-hidden rounded-full bg-white/70">
            <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${kindOf(puz.kind).c1}, ${kindOf(puz.kind).c2})` }} animate={{ width: `${done * 100}%` }} transition={{ type: "spring", damping: 20 }} />
          </div>
          <div className="min-h-0 flex-1 px-2 py-2">
            <Board p={puz} patches={L} flash={flash.x} flashKey={flash.k} hidden={paused} onCut={onCut} />
          </div>
          <p className="px-6 text-center text-[13px] font-bold text-[#7a6650]">{kindOf(puz.kind).rule}</p>
          <div className="flex justify-center gap-6 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
            <button type="button" className="qlt-tool" onClick={doUndo}><span className="qlt-tool-ico"><Undo2 className="size-5" /></span>Undo</button>
            <button type="button" className="qlt-tool" onClick={doReset}><span className="qlt-tool-ico"><RotateCcw className="size-5" /></span>Reset</button>
            <button type="button" className="qlt-tool" onClick={doHint}><span className="qlt-tool-ico"><Lightbulb className="size-5" />{hints > 0 && <span className="qlt-badge">{hints}</span>}</span>Hint</button>
          </div>
        </div>
      )}

      {busy && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-white/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 animate-spin rounded-full border-[6px] border-[#ff3d7f]/15 border-t-[#ff3d7f]" />
            <p className="qlt-display text-xl">Cutting the cloth…</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {pick && <LevelSheet key="lv" kind={pick} onClose={() => setPick(null)} onPlay={(k, l) => { useTrail.getState().setLevel(k, l); setPick(null); void startPuzzle({ kind: k, level: l, seed: "" }); }} />}
        {result && run && puz && <ClearSheet key="clear" r={result} run={run} p={puz} onNext={() => { if (!run.daily) void startPuzzle({ kind: run.kind, level: run.level, seed: "" }); else leave(); }} onHome={leave} />}
        {sheet === "quit" && (
          <Sheet key="quit" title="Leave this quilt?" onClose={() => setSheet("")}>
            <p className="text-[#5c4b6e]">It&apos;s saved — tap Continue on the home screen to pick it up again.</p>
            <div className="mt-5 grid gap-2">
              <button type="button" className="qlt-btn qlt-cta py-3" onClick={() => setSheet("")}>Keep playing</button>
              <button type="button" className="qlt-btn bg-[#f3e6d3] py-3" onClick={leave}>Save &amp; go home</button>
            </div>
          </Sheet>
        )}
        {sheet === "rules" && puz && (
          <Sheet key="rules" title={kindOf(puz.kind).name} onClose={() => { useTrail.getState().sawRules(puz.kind); setSheet(""); }}>
            <p className="text-[#5c4b6e]">{kindOf(puz.kind).rule}</p>
            <p className="mt-2 text-sm text-[#7a6650]">Press a cell and drag to cut a rectangle; tap a patch to lift it off. Drawing over patches replaces them.</p>
            <button type="button" className="qlt-btn qlt-cta mt-5 w-full py-3" onClick={() => { useTrail.getState().sawRules(puz.kind); setSheet(""); }}>Let&apos;s go</button>
          </Sheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1c1533] px-4 py-2 text-sm font-bold text-white">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

// ------------------------------------------------------------------ sheets

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-[#1c1533]/35 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="qlt-stitched qlt-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[24px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="qlt-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-[#f3e6d3]"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function LevelSheet({ kind, onClose, onPlay }: { kind: KindId; onClose: () => void; onPlay: (k: KindId, l: Level) => void }) {
  const k = kindOf(kind);
  const st = useTrail((s) => s.stats[kind]);
  const last = useTrail((s) => s.lastLevel[kind]) ?? "easy";
  const [lv, setLv] = useState<Level>(last);
  return (
    <Sheet title={k.name} onClose={onClose}>
      <div className="flex items-center gap-4 rounded-2xl p-3 text-white" style={{ background: `linear-gradient(140deg, ${k.c1}, ${k.c2})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cdn(`/games/quiltfold/kinds/${kind}.webp`)} alt="" className="size-20 shrink-0 rounded-xl bg-white/30 object-contain p-1" />
        <p className="text-sm font-semibold leading-snug">{k.rule}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(["easy", "medium", "hard"] as Level[]).map((l) => (
          <button key={l} type="button" onClick={() => setLv(l)} className={`rounded-2xl border-2 px-3 py-2.5 text-left ${lv === l ? "border-[#ff3d7f] bg-[#ff3d7f]/10" : "border-[#e6def8] bg-white/70"}`}>
            <span className="block font-extrabold">{LEVEL_LABEL[l]}</span>
            <span className="block text-xs text-[#7a6650]">{k.size[l][0]}×{k.size[l][1]} · best {st?.best[l] !== undefined ? fmt(st.best[l]!) : "—"}</span>
          </button>
        ))}
      </div>
      <button type="button" className="qlt-btn qlt-cta qlt-shine mt-5 flex w-full items-center justify-center gap-2 py-3.5 text-lg" onClick={() => onPlay(kind, lv)}><Play className="size-5 fill-current" /> Play {LEVEL_LABEL[lv]}</button>
      <p className="mt-2 text-center text-xs text-[#7a6650]">Endless — finish one and the next quilt rolls in.</p>
    </Sheet>
  );
}

function ClearSheet({ r, run, p, onNext, onHome }: { r: Result; run: Run; p: Puzzle; onNext: () => void; onHome: () => void }) {
  const endless = !run.daily;
  const [left, setLeft] = useState(endless ? 6 : 0);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 1000); setShown(Math.round(r.total * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [r.total]);
  useEffect(() => {
    if (!endless || left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, endless, onNext]);
  const k = kindOf(p.kind);
  const rows: [string, number][] = [["Quilt", r.parts.base], ["Speed bonus", r.parts.time], ["No hints", r.parts.clean], ...(r.parts.hints ? [["Hints", r.parts.hints] as [string, number]] : [])];
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-[#1c1533]/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="qlt-stitched qlt-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="px-5 pt-6 pb-4 text-white" style={{ background: `linear-gradient(140deg, ${k.c1}, ${k.c2})` }}>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.45 + i * 0.26, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/25 text-white/40"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="qlt-display mt-1 text-4xl">{r.stars === 3 ? "Perfect quilt!" : run.daily ? "Daily done!" : "Quilt complete!"}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{k.name} · {LEVEL_LABEL[p.level]} · {fmt(r.seconds)}{r.newBest ? " · new best!" : ""}</p>
        </div>
        <div className="px-5 py-4">
          <p className="qlt-display qlt-grad text-5xl">{shown.toLocaleString()}</p>
          <div className="mt-3 grid gap-1 text-sm">
            {rows.map(([a, v]) => <div key={a} className="flex justify-between text-[#5c4b6e]"><span>{a}</span><span className={v < 0 ? "text-[#e11d48]" : "font-bold text-[#1c1533]"}>{v > 0 ? "+" : ""}{v.toLocaleString()}</span></div>)}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 text-sm font-bold">
            <span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>
            {run.daily && <span className="flex items-center gap-1 text-[#ff6a1f]"><Flame className="size-4" /> {r.streak}-day streak</span>}
          </div>
          <p className="mt-2 text-xs font-bold text-[#7a6650]">+{r.total.toLocaleString()} added to your total score</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="qlt-btn qlt-cta qlt-shine flex items-center justify-center gap-2 py-3" onClick={onNext}>
              {endless ? <>Next quilt{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></> : <>Back home <ChevronRight className="size-5" /></>}
            </button>
            {endless && <button type="button" className="qlt-btn bg-[#f3e6d3] py-2.5" onClick={onHome}>Home</button>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ------------------------------------------------------------------ home

function Home({ ready, now, busy, onKind, onDaily, onResume }: { ready: boolean; now: number; busy: boolean; onKind: (k: KindId) => void; onDaily: () => void; onResume: () => void }) {
  const save = useTrail();
  const today = utcDay(new Date(now));
  const streak = liveStreak(save, today);
  const d = dailyOf(new Date(now)), dk = kindOf(d.kind);
  const doneToday = save.daily[today];
  const solved = Object.values(save.stats).reduce((s, x) => s + (x?.solved ?? 0), 0);
  const cur = save.current;
  return (
    <div className="qlt-scroll">
      <div className="mx-auto max-w-5xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Trophy, save.totalScore.toLocaleString(), "Score", "#ff9f2e"], [Flame, String(streak), "Day streak", "#ff3d7f"], [LayoutGrid, String(solved), "Quilts", "#7a4dff"]].map(([I, v, k, c]) => {
            const Icon = I as typeof Trophy;
            return (
              <div key={k as string} className="qlt-stitched flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0" style={{ color: c as string }} />
                <span className="min-w-0"><span className="qlt-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider text-[#7a6650] uppercase">{k as string}</span></span>
              </div>
            );
          })}
        </div>

        <h1 className="qlt-display qlt-grad mt-5 text-[54px] leading-[0.95] sm:text-7xl">Quiltfold</h1>
        <p className="mt-1 max-w-lg text-[15px] font-semibold text-[#5c4b6e]">Cut the board into patches — one number in each, its size. Nine kinds, endless puzzles, each with exactly one answer.</p>

        {cur && (
          <button type="button" disabled={busy} onClick={onResume} className="qlt-stitched mt-4 flex w-full items-center gap-3 p-3 text-left">
            <span className="grid size-12 place-items-center rounded-2xl text-white" style={{ background: `linear-gradient(140deg, ${kindOf(cur.puzzle.kind).c1}, ${kindOf(cur.puzzle.kind).c2})` }}><LayoutGrid className="size-6" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-extrabold tracking-wider text-[#ff3d7f] uppercase">Continue</span>
              <span className="block truncate font-extrabold">{cur.daily ? "Daily Quilt" : kindOf(cur.puzzle.kind).name} · {LEVEL_LABEL[cur.puzzle.level]} · {fmt(cur.seconds)}</span>
            </span>
            <Play className="size-6 fill-current text-[#ff3d7f]" />
          </button>
        )}

        {/* daily */}
        <button type="button" disabled={busy} onClick={onDaily} className="qlt-shine relative mt-4 block w-full overflow-hidden rounded-[26px] p-5 text-left text-white shadow-[0_24px_50px_-24px_rgba(255,61,127,.7)]" style={{ background: `linear-gradient(130deg, #ff8a5b, #e8456b 60%, #8b5cf6)` }}>
          <span className="flex items-center gap-1.5 text-xs font-extrabold tracking-widest uppercase"><CalendarDays className="size-4" /> Daily Quilt · {today}</span>
          <span className="qlt-display mt-1 block text-4xl">{dk.name}</span>
          <span className="mt-1 block max-w-[62%] text-sm font-semibold text-white/90">{LEVEL_LABEL[d.level]} · the same quilt for every player today. New in {untilMidnight(now)}.</span>
          <span className="mt-4 flex flex-wrap items-center gap-2">
            {doneToday ? <span className="rounded-full bg-white/25 px-3 py-1 text-xs font-extrabold"><Check className="mr-1 inline size-3.5" />Solved · {doneToday.score.toLocaleString()}</span> : <span className="rounded-full bg-white/25 px-3 py-1 text-xs font-extrabold">×1.5 score · +30 coins</span>}
            <span className="qlt-btn inline-flex items-center gap-1.5 bg-white px-4 py-2 text-sm text-[#ff3d7f]"><Play className="size-4 fill-current" /> {doneToday ? "Play again" : "Play"}</span>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cdn(`/games/quiltfold/kinds/${d.kind}.webp`)} alt="" className="absolute top-4 right-3 w-[34%] max-w-[150px] rotate-6 rounded-2xl drop-shadow-xl" />
        </button>

        {/* the nine trails */}
        <div className="mt-8 flex items-end justify-between">
          <h2 className="qlt-display text-[28px] leading-none">The 9 quilts</h2>
          <span className="text-xs font-bold text-[#7a6650]">Easy · Medium · Hard</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {KINDS.map((k, i) => {
            const st = save.stats[k.id];
            return (
              <motion.button key={k.id} type="button" whileTap={{ scale: 0.96 }} whileHover={{ y: -4 }} disabled={busy} onClick={() => onKind(k.id)} className="qlt-stitched group overflow-hidden text-left">
                <span className="relative block aspect-square overflow-hidden" style={{ background: `linear-gradient(150deg, ${k.c1}33, ${k.c2}44)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cdn(`/games/quiltfold/kinds/${k.id}.webp`)} alt={`${k.name} puzzle`} loading="lazy" className="absolute top-[13%] left-[9%] h-[80%] w-[82%] object-contain drop-shadow-[0_12px_18px_rgba(60,30,120,.25)] transition duration-300 group-hover:scale-[1.04]" />
                  <span className="qlt-display absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 text-[13px] text-white" style={{ background: `linear-gradient(120deg, ${k.c1}, ${k.c2})` }}>{String(i + 1).padStart(2, "0")}</span>
                  <span className="absolute top-2.5 right-2.5 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-[#5c4b6e] uppercase">{k.tag}</span>
                </span>
                <span className="block px-3 pt-2.5 pb-3">
                  <span className="qlt-display block truncate text-[19px] leading-tight">{k.name}</span>
                  <span className="mt-0.5 line-clamp-2 block min-h-[2.4em] text-[12px] leading-snug font-semibold text-[#7a6650]">{k.blurb}</span>
                  <span className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-extrabold text-[#7a6650]">{st?.solved ? `${st.solved} solved · best ${st.bestScore.toLocaleString()}` : `${k.size.easy[0]}×${k.size.easy[1]} – ${k.size.hard[0]}×${k.size.hard[1]}`}</span>
                    <span className="qlt-btn qlt-cta grid size-9 shrink-0 place-items-center"><Play className="size-4 fill-current" /></span>
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>

        <h2 className="qlt-display mt-9 text-2xl">How to play</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            [LayoutGrid, "Cut it into rectangles", "Press a cell and drag to cut a rectangle. Every patch must hold exactly one number, and the number is its size."],
            [Undo2, "Change your mind", "Draw over patches to replace them, tap a patch to lift it, or use Undo and Reset."],
            [Sparkles, "Never the same twice", "Every quilt is made fresh and checked to have exactly one answer. Finish one and the next rolls in."],
            [Trophy, "Score", "Each level has a base score; finish fast for a speed bonus and without hints for +20 %. The Daily Quilt scores ×1.5."],
          ].map(([I, t, dsc]) => {
            const Icon = I as typeof Trophy;
            return (
              <div key={t as string} className="qlt-stitched flex gap-3 p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white"><Icon className="size-5 text-[#ff3d7f]" /></span>
                <span><span className="block font-extrabold">{t as string}</span><span className="block text-sm text-[#7a6650]">{dsc as string}</span></span>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[11px] font-bold text-[#9a8670]">Scores are saved on this device and join the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
