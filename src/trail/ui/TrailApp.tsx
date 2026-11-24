"use client";
// Trailfold — one-stroke path puzzles in nine kinds. Phone-app flow: home (score, streak, the Daily Trail and the nine
// trail kinds with real puzzle pictures), the game (draw with one finger; undo, reset, hint), and the clear sheet that
// rolls straight into the next puzzle, which was already made in the background.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CalendarDays, Check, ChevronRight, Clock, Flame, Lightbulb, Play, RotateCcw, Route, Sparkles, Star, Trophy, Undo2, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { cdn } from "@/lib/cdn";
import { track } from "@/lib/analytics";
import { KINDS, LEVEL_LABEL, kindOf, scoreOf, type KindId, type Level, type Puzzle, type ScoreParts } from "../kinds";
import { getPuzzle, nextEndless, prepareEndless } from "../factory";
import { drag, hint, isSolved, openCount, press, type DrawEvent, type Lines } from "../play";
import { liveStreak, useTrail, useTrailHydrated, type InProgress } from "../save";
import { Grid } from "./Grid";
import { TRAIL_CSS } from "./styles";

export const TRAIL_SFX = ["step", "stop", "back", "bump", "solve", "hint", "undo", "reset", "select", "star", "open", "streak"] as const;
type Sfx = (typeof TRAIL_SFX)[number];
const sfxName = (k: Sfx) => `a:trail_${k}` as Sound;
const music = (k: string) => `a:trail_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const fmt = (s: number) => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60), x = s % 60; return `${m}:${String(x).padStart(2, "0")}`; };
const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
/** the Daily Trail: a different kind each day, Hard at weekends */
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

export default function TrailApp({ slug }: { slug: string; title: string }) {
  const ready = useTrailHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [run, setRun] = useState<Run | null>(null);
  const [puz, setPuz] = useState<Puzzle | null>(null);
  const [L, setL] = useState<Lines>({ a: [], b: [] });
  const [hist, setHist] = useState<Lines[]>([]);
  const [hints, setHints] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [glow, setGlow] = useState<number[]>([]);
  const [bump, setBump] = useState({ c: -1, k: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "rules" | "quit">("");
  const [pick, setPick] = useState<KindId | null>(null);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const active = useRef<0 | 1 | -1>(-1);
  const LRef = useRef(L), puzRef = useRef<Puzzle | null>(null), runRef = useRef<Run | null>(null), secRef = useRef(0), hintsRef = useRef(0);
  const dragStart = useRef<Lines | null>(null);
  useEffect(() => { LRef.current = L; }, [L]);
  useEffect(() => { puzRef.current = puz; }, [puz]);
  useEffect(() => { runRef.current = run; }, [run]);
  useEffect(() => { secRef.current = seconds; }, [seconds]);
  useEffect(() => { hintsRef.current = hints; }, [hints]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Laying the trails");
    void audio.preload(TRAIL_SFX.map(sfxName), [music("title")]);
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
    setBusy(true); setResult(null); setSheet(""); setGlow([]);
    try {
      const p = from?.puzzle ?? (r.seed ? await getPuzzle({ kind: r.kind, level: r.level, seed: r.seed }) : await nextEndless(r.kind, r.level));
      setRun({ ...r, seed: p.seed }); setPuz(p);
      setL(from ? { a: from.line, b: from.line2 } : { a: [], b: [] }); setHist([]);
      setHints(from?.hints ?? 0); setSeconds(from?.seconds ?? 0);
      if (!from) useTrail.getState().start(p.kind);
      setScreen("game");
      void audio.playMusic(music(r.daily ? "daily" : kindOf(p.kind).music));
      if (!r.daily) prepareEndless(r.kind, r.level);
      if (!useTrail.getState().seenRules.includes(p.kind)) setSheet("rules");
      sfx("open", { gain: 0.5 });
      track("trail_start", { kind: p.kind, level: p.level, daily: !!r.daily });
    } catch { setToast("That trail didn't come out — try again."); }
    finally { setBusy(false); }
  }, [sfx]);

  // ---------------------------------------------------------------- timer + autosave
  const running = screen === "game" && !!puz && !paused && !result && !busy && sheet === "";
  useEffect(() => { if (!running) return; const t = setInterval(() => setSeconds((s) => s + 1), 1000); return () => clearInterval(t); }, [running]);
  const persist = useCallback(() => {
    const p = puzRef.current, r = runRef.current;
    if (!p || !r) return;
    useTrail.getState().saveCurrent({ daily: r.daily, puzzle: p, line: LRef.current.a, line2: LRef.current.b, seconds: secRef.current, hints: hintsRef.current });
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
    track("trail_solve", { kind: p.kind, level: p.level, seconds: secs, score: parts.total, daily: !!r.daily });
    sfx("solve", { gain: 0.85, delay: 0.1 });
    setTimeout(() => {
      setResult({ parts, total: parts.total, coins, seconds: secs, stars, newBest: res.newBest, streak: res.streak });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.5 + k * 0.26, gain: 0.55 });
      if (r.daily && res.streak > 1) sfx("streak", { delay: 1.4, gain: 0.55 });
    }, 900);
  }, [sfx]);

  // ---------------------------------------------------------------- drawing
  const react = useCallback((e: DrawEvent, next: Lines) => {
    if (e.kind === "step") {
      const semi = PENTA[e.index % PENTA.length] + 12 * Math.min(1, Math.floor(e.index / PENTA.length) % 2);
      sfx(e.stop ? "stop" : "step", { cell: e.cell, rate: e.stop ? 1 : Math.pow(2, semi / 12) * 0.8, gain: e.stop ? 0.7 : 0.45 });
      if (e.stop && navigator.vibrate) navigator.vibrate(12);
      const p = puzRef.current!;
      if (isSolved(p, next)) finish();
    } else if (e.kind === "back" || e.kind === "jump") sfx("back", { cell: e.cell, gain: 0.35 });
    else if (e.kind === "start") sfx("select", { cell: e.cell, gain: 0.5 });
    else if (e.kind === "blocked") {
      sfx("bump", { cell: e.cell, gain: 0.45 });
      setBump((b) => ({ c: e.cell, k: b.k + 1 }));
      if (e.why) setToast(e.why[0].toUpperCase() + e.why.slice(1));
    }
  }, [sfx, finish]);

  const onPress = useCallback((c: number) => {
    const p = puzRef.current;
    if (!p || result || paused) return;
    dragStart.current = LRef.current;
    const r = press(p, LRef.current, c);
    active.current = r.line;
    LRef.current = r.L; setL(r.L);
    react(r.e, r.L);
  }, [result, paused, react]);
  const onDrag = useCallback((c: number) => {
    const p = puzRef.current;
    const line = active.current;
    if (!p || result || line === -1) return;
    const r = drag(p, LRef.current, line, c);
    if (r.e.kind === "none") return;
    if (r.e.kind === "blocked" && r.e.why === "not next to the line") return;
    LRef.current = r.L; setL(r.L);
    react(r.e, r.L);
  }, [result, react]);
  const onRelease = useCallback(() => {
    active.current = -1;
    const before = dragStart.current;
    dragStart.current = null;
    if (before && (before.a !== LRef.current.a || before.b !== LRef.current.b)) setHist((h) => [...h, before].slice(-80));
  }, []);

  const doUndo = () => { const prev = hist[hist.length - 1]; if (!prev || result) return; setHist(hist.slice(0, -1)); LRef.current = prev; setL(prev); sfx("undo", { gain: 0.5 }); };
  const doReset = () => { if (result) return; setHist((h) => [...h, LRef.current]); const e = { a: [], b: [] }; LRef.current = e; setL(e); sfx("reset", { gain: 0.5 }); };
  const doHint = () => {
    const p = puzRef.current;
    if (!p || result) return;
    const r = hint(p, LRef.current, p.rows * p.cols > 60 ? 4 : 3);
    if (!r.cells.length) return;
    setHist((h) => [...h, LRef.current]);
    LRef.current = r.L; setL(r.L); setHints((x) => x + 1); setGlow(r.cells);
    sfx("hint", { gain: 0.6 });
    setTimeout(() => setGlow([]), 2600);
    if (isSolved(p, r.L)) finish();
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
    (window as unknown as { __trail?: unknown }).__trail = {
      puzzle: () => puzRef.current,
      play: (kind: KindId, level: Level) => void startPuzzle({ kind, level, seed: "" }),
      draw: (keep = 1) => { const p = puzRef.current; if (!p) return; const n = p.solution.length - keep; const a = p.split !== undefined ? p.solution.slice(0, Math.min(n, p.split)) : p.solution.slice(0, n); const b = p.split !== undefined && n > p.split ? p.solution.slice(p.split, n) : []; const x = { a, b }; LRef.current = x; setL(x); },
    };
  }, [startPuzzle]);

  const leave = () => { persist(); setScreen("home"); setPuz(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const filled = puz ? L.a.length + L.b.length : 0, total = puz ? openCount(puz) : 1;

  return (
    <div className="trl-root">
      <style>{TRAIL_CSS}</style>
      <div className="trl-orb" style={{ width: 300, height: 300, left: -90, top: -60, background: "#ffb48f" }} />
      <div className="trl-orb" style={{ width: 280, height: 280, right: -100, top: 180, background: "#b9a6ff", animationDelay: "-5s" }} />
      <div className="trl-orb" style={{ width: 260, height: 260, left: "35%", bottom: -120, background: "#8fe3ff", animationDelay: "-9s" }} />

      {screen === "home" && (
        <Home ready={ready} now={now} busy={busy} onKind={(k) => { sfx("select", { gain: 0.4 }); setPick(k); }}
          onDaily={() => { const d = dailyOf(new Date(now)); void startPuzzle({ kind: d.kind, level: d.level, seed: d.seed, daily: d.day }); }}
          onResume={() => { const c = useTrail.getState().current; if (c) void startPuzzle({ kind: c.puzzle.kind, level: c.puzzle.level, seed: c.puzzle.seed, daily: c.daily }, c); }} />
      )}

      {screen === "game" && puz && run && (
        <div className="absolute inset-0 flex flex-col">
          <div className="flex items-center gap-2 pt-[max(env(safe-area-inset-top),10px)] pr-[64px] pb-2 pl-3">
            <button type="button" aria-label="Back" onClick={() => setSheet("quit")} className="trl-glass grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="min-w-0 flex-1">
              <p className="trl-display truncate text-xl leading-tight">{run.daily ? "Daily Trail" : kindOf(puz.kind).name}</p>
              <p className="truncate text-xs font-bold text-[#6b5d8f]">{run.daily ? `${kindOf(puz.kind).name} · ` : ""}{LEVEL_LABEL[puz.level]} · {puz.rows}×{puz.cols}</p>
            </div>
            <div className="trl-glass flex items-center gap-1 !rounded-2xl px-3 py-2 font-extrabold tabular-nums"><Clock className="size-4" /> {fmt(seconds)}</div>
          </div>
          {/* progress */}
          <div className="mx-4 h-2 overflow-hidden rounded-full bg-white/70">
            <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${kindOf(puz.kind).c1}, ${kindOf(puz.kind).c2})` }} animate={{ width: `${(filled / total) * 100}%` }} transition={{ type: "spring", damping: 20 }} />
          </div>
          <div className="min-h-0 flex-1 px-2 py-2">
            <Grid p={puz} L={L} glow={glow} bump={bump.c} bumpKey={bump.k} solved={!!result} hidden={paused} onPress={onPress} onDrag={onDrag} onRelease={onRelease} />
          </div>
          <p className="px-6 text-center text-[13px] font-bold text-[#6b5d8f]">{kindOf(puz.kind).rule}</p>
          <div className="flex justify-center gap-6 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
            <button type="button" className="trl-tool" onClick={doUndo}><span className="trl-tool-ico"><Undo2 className="size-5" /></span>Undo</button>
            <button type="button" className="trl-tool" onClick={doReset}><span className="trl-tool-ico"><RotateCcw className="size-5" /></span>Reset</button>
            <button type="button" className="trl-tool" onClick={doHint}><span className="trl-tool-ico"><Lightbulb className="size-5" />{hints > 0 && <span className="trl-badge">{hints}</span>}</span>Hint</button>
          </div>
        </div>
      )}

      {busy && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-white/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 animate-spin rounded-full border-[6px] border-[#ff3d7f]/15 border-t-[#ff3d7f]" />
            <p className="trl-display text-xl">Laying the trail…</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {pick && <LevelSheet key="lv" kind={pick} onClose={() => setPick(null)} onPlay={(k, l) => { useTrail.getState().setLevel(k, l); setPick(null); void startPuzzle({ kind: k, level: l, seed: "" }); }} />}
        {result && run && puz && <ClearSheet key="clear" r={result} run={run} p={puz} onNext={() => { if (!run.daily) void startPuzzle({ kind: run.kind, level: run.level, seed: "" }); else leave(); }} onHome={leave} />}
        {sheet === "quit" && (
          <Sheet key="quit" title="Leave this trail?" onClose={() => setSheet("")}>
            <p className="text-[#4b3f6b]">It&apos;s saved — tap Continue on the home screen to pick it up again.</p>
            <div className="mt-5 grid gap-2">
              <button type="button" className="trl-btn trl-cta py-3" onClick={() => setSheet("")}>Keep playing</button>
              <button type="button" className="trl-btn bg-[#ece6fb] py-3" onClick={leave}>Save &amp; go home</button>
            </div>
          </Sheet>
        )}
        {sheet === "rules" && puz && (
          <Sheet key="rules" title={kindOf(puz.kind).name} onClose={() => { useTrail.getState().sawRules(puz.kind); setSheet(""); }}>
            <p className="text-[#4b3f6b]">{kindOf(puz.kind).rule}</p>
            <p className="mt-2 text-sm text-[#6b5d8f]">Press the 1 and drag. Drag back over the line to undo a step; press any cell on the line to cut it back there.</p>
            <button type="button" className="trl-btn trl-cta mt-5 w-full py-3" onClick={() => { useTrail.getState().sawRules(puz.kind); setSheet(""); }}>Let&apos;s go</button>
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
      <motion.div className="trl-glass trl-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[24px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="trl-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-[#ece6fb]"><X className="size-5" /></button>
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
        <img src={cdn(`/games/trailfold/kinds/${kind}.webp`)} alt="" className="size-20 shrink-0 rounded-xl bg-white/30 object-contain p-1" />
        <p className="text-sm font-semibold leading-snug">{k.rule}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(["easy", "medium", "hard"] as Level[]).map((l) => (
          <button key={l} type="button" onClick={() => setLv(l)} className={`rounded-2xl border-2 px-3 py-2.5 text-left ${lv === l ? "border-[#ff3d7f] bg-[#ff3d7f]/10" : "border-[#e6def8] bg-white/70"}`}>
            <span className="block font-extrabold">{LEVEL_LABEL[l]}</span>
            <span className="block text-xs text-[#6b5d8f]">{k.size[l][0]}×{k.size[l][1]} · best {st?.best[l] !== undefined ? fmt(st.best[l]!) : "—"}</span>
          </button>
        ))}
      </div>
      <button type="button" className="trl-btn trl-cta trl-shine mt-5 flex w-full items-center justify-center gap-2 py-3.5 text-lg" onClick={() => onPlay(kind, lv)}><Play className="size-5 fill-current" /> Play {LEVEL_LABEL[lv]}</button>
      <p className="mt-2 text-center text-xs text-[#6b5d8f]">Endless — finish one and the next trail rolls in.</p>
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
  const rows: [string, number][] = [["Trail", r.parts.base], ["Speed bonus", r.parts.time], ["No hints", r.parts.clean], ...(r.parts.hints ? [["Hints", r.parts.hints] as [string, number]] : [])];
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-[#1c1533]/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="trl-glass trl-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="px-5 pt-6 pb-4 text-white" style={{ background: `linear-gradient(140deg, ${k.c1}, ${k.c2})` }}>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.45 + i * 0.26, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/25 text-white/40"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="trl-display mt-1 text-4xl">{r.stars === 3 ? "Perfect trail!" : run.daily ? "Daily done!" : "Trail complete!"}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{k.name} · {LEVEL_LABEL[p.level]} · {fmt(r.seconds)}{r.newBest ? " · new best!" : ""}</p>
        </div>
        <div className="px-5 py-4">
          <p className="trl-display trl-grad-text text-5xl">{shown.toLocaleString()}</p>
          <div className="mt-3 grid gap-1 text-sm">
            {rows.map(([a, v]) => <div key={a} className="flex justify-between text-[#4b3f6b]"><span>{a}</span><span className={v < 0 ? "text-[#e11d48]" : "font-bold text-[#1c1533]"}>{v > 0 ? "+" : ""}{v.toLocaleString()}</span></div>)}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 text-sm font-bold">
            <span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>
            {run.daily && <span className="flex items-center gap-1 text-[#ff6a1f]"><Flame className="size-4" /> {r.streak}-day streak</span>}
          </div>
          <p className="mt-2 text-xs font-bold text-[#6b5d8f]">+{r.total.toLocaleString()} added to your total score</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="trl-btn trl-cta trl-shine flex items-center justify-center gap-2 py-3" onClick={onNext}>
              {endless ? <>Next trail{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></> : <>Back home <ChevronRight className="size-5" /></>}
            </button>
            {endless && <button type="button" className="trl-btn bg-[#ece6fb] py-2.5" onClick={onHome}>Home</button>}
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
    <div className="trl-scroll">
      <div className="mx-auto max-w-5xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Trophy, save.totalScore.toLocaleString(), "Score", "#ff9f2e"], [Flame, String(streak), "Day streak", "#ff3d7f"], [Route, String(solved), "Trails", "#7a4dff"]].map(([I, v, k, c]) => {
            const Icon = I as typeof Trophy;
            return (
              <div key={k as string} className="trl-glass flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0" style={{ color: c as string }} />
                <span className="min-w-0"><span className="trl-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider text-[#6b5d8f] uppercase">{k as string}</span></span>
              </div>
            );
          })}
        </div>

        <h1 className="trl-display trl-grad-text mt-5 text-[54px] leading-[0.95] sm:text-7xl">Trailfold</h1>
        <p className="mt-1 max-w-lg text-[15px] font-semibold text-[#4b3f6b]">One line. Every cell. Nine kinds of trail, endless puzzles — each one has exactly one answer.</p>

        {cur && (
          <button type="button" disabled={busy} onClick={onResume} className="trl-glass mt-4 flex w-full items-center gap-3 p-3 text-left">
            <span className="grid size-12 place-items-center rounded-2xl text-white" style={{ background: `linear-gradient(140deg, ${kindOf(cur.puzzle.kind).c1}, ${kindOf(cur.puzzle.kind).c2})` }}><Route className="size-6" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-extrabold tracking-wider text-[#ff3d7f] uppercase">Continue</span>
              <span className="block truncate font-extrabold">{cur.daily ? "Daily Trail" : kindOf(cur.puzzle.kind).name} · {LEVEL_LABEL[cur.puzzle.level]} · {fmt(cur.seconds)}</span>
            </span>
            <Play className="size-6 fill-current text-[#ff3d7f]" />
          </button>
        )}

        {/* daily */}
        <button type="button" disabled={busy} onClick={onDaily} className="trl-shine relative mt-4 block w-full overflow-hidden rounded-[26px] p-5 text-left text-white shadow-[0_24px_50px_-24px_rgba(255,61,127,.7)]" style={{ background: `linear-gradient(130deg, #ff7a45, #ff3d7f 55%, #7a4dff)` }}>
          <span className="flex items-center gap-1.5 text-xs font-extrabold tracking-widest uppercase"><CalendarDays className="size-4" /> Daily Trail · {today}</span>
          <span className="trl-display mt-1 block text-4xl">{dk.name}</span>
          <span className="mt-1 block max-w-[62%] text-sm font-semibold text-white/90">{LEVEL_LABEL[d.level]} · the same trail for every player today. New in {untilMidnight(now)}.</span>
          <span className="mt-4 flex flex-wrap items-center gap-2">
            {doneToday ? <span className="rounded-full bg-white/25 px-3 py-1 text-xs font-extrabold"><Check className="mr-1 inline size-3.5" />Solved · {doneToday.score.toLocaleString()}</span> : <span className="rounded-full bg-white/25 px-3 py-1 text-xs font-extrabold">×1.5 score · +30 coins</span>}
            <span className="trl-btn inline-flex items-center gap-1.5 bg-white px-4 py-2 text-sm text-[#ff3d7f]"><Play className="size-4 fill-current" /> {doneToday ? "Play again" : "Play"}</span>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cdn(`/games/trailfold/kinds/${d.kind}.webp`)} alt="" className="absolute top-4 right-3 w-[34%] max-w-[150px] rotate-6 rounded-2xl drop-shadow-xl" />
        </button>

        {/* the nine trails */}
        <div className="mt-8 flex items-end justify-between">
          <h2 className="trl-display text-[28px] leading-none">The 9 trails</h2>
          <span className="text-xs font-bold text-[#6b5d8f]">Easy · Medium · Hard</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {KINDS.map((k, i) => {
            const st = save.stats[k.id];
            return (
              <motion.button key={k.id} type="button" whileTap={{ scale: 0.96 }} whileHover={{ y: -4 }} disabled={busy} onClick={() => onKind(k.id)} className="trl-glass group overflow-hidden text-left">
                <span className="relative block aspect-square overflow-hidden" style={{ background: `linear-gradient(150deg, ${k.c1}33, ${k.c2}44)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cdn(`/games/trailfold/kinds/${k.id}.webp`)} alt={`${k.name} puzzle`} loading="lazy" className="absolute top-[13%] left-[9%] h-[80%] w-[82%] object-contain drop-shadow-[0_12px_18px_rgba(60,30,120,.25)] transition duration-300 group-hover:scale-[1.04]" />
                  <span className="trl-display absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 text-[13px] text-white" style={{ background: `linear-gradient(120deg, ${k.c1}, ${k.c2})` }}>{String(i + 1).padStart(2, "0")}</span>
                  <span className="absolute top-2.5 right-2.5 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-[#4b3f6b] uppercase">{k.tag}</span>
                </span>
                <span className="block px-3 pt-2.5 pb-3">
                  <span className="trl-display block truncate text-[19px] leading-tight">{k.name}</span>
                  <span className="mt-0.5 line-clamp-2 block min-h-[2.4em] text-[12px] leading-snug font-semibold text-[#6b5d8f]">{k.blurb}</span>
                  <span className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-extrabold text-[#6b5d8f]">{st?.solved ? `${st.solved} solved · best ${st.bestScore.toLocaleString()}` : `${k.size.easy[0]}×${k.size.easy[1]} – ${k.size.hard[0]}×${k.size.hard[1]}`}</span>
                    <span className="trl-btn trl-cta grid size-9 shrink-0 place-items-center"><Play className="size-4 fill-current" /></span>
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>

        <h2 className="trl-display mt-9 text-2xl">How to play</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            [Route, "One line through everything", "Press 1 and drag through every cell exactly once, passing 2, 3, 4… in order and ending on the last number."],
            [Undo2, "Change your mind", "Drag back over the line to rub it out, press any cell on the line to cut it there, or use Undo and Reset."],
            [Sparkles, "Never the same twice", "Every trail is made fresh and checked to have exactly one answer. Finish one and the next rolls in."],
            [Trophy, "Score", "Each level has a base score; finish fast for a speed bonus and without hints for +20 %. The Daily Trail scores ×1.5."],
          ].map(([I, t, dsc]) => {
            const Icon = I as typeof Trophy;
            return (
              <div key={t as string} className="trl-glass flex gap-3 p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white"><Icon className="size-5 text-[#ff3d7f]" /></span>
                <span><span className="block font-extrabold">{t as string}</span><span className="block text-sm text-[#6b5d8f]">{dsc as string}</span></span>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[11px] font-bold text-[#8a7fae]">Scores are saved on this device and join the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
