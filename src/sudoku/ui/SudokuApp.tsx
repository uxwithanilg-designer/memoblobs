"use client";
// Sudoku Ninefold — the MOMOBLOBS sudoku. Feels like a phone app: a home screen with today's four tasks (Daily Classic, Mini
// Express, Speed Blitz, Weekly Epic), the nine boards, your stats and the world ranking; the game screen (clay board,
// tools, number pad) and the clear / out-of-hearts / time's-up sheets. Endless boards roll straight into a fresh
// puzzle that was already made in the background.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CalendarDays, Check, ChevronRight, Clock, Eraser, Flame, Globe2, Heart, Lightbulb, Pencil, Play, RotateCcw, Sparkles, Star, Trophy, Undo2, Wand2, X, ZoomIn, ZoomOut } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { cdn } from "@/lib/cdn";
import { track } from "@/lib/analytics";
import { BOARDS, LEVEL_LABEL, boardOf, scoreOf, sym, valueOfKey, type BoardId, type Level, type Puzzle, type ScoreParts } from "../boards";
import { CHALLENGES, challengeOf, countdown, msUntilNext, periodOf, seedOf, utcDay, type Challenge, type ChallengeId } from "../challenges";
import { getPuzzle, nextEndless, prepareEndless } from "../factory";
import { autoNotes, erase, hint, newGame, place, undo, valueCounts, type Game, type PlayEvent } from "../play";
import { BIG_BOARDS, liveStreak, useClay, useClayHydrated, type InProgress } from "../save";
import { localBoard, submitScore, type RankScope } from "../ranking";
import { Board, type BoardView } from "./Board";
import { SUDOKU_CSS } from "./styles";

type Kind = ChallengeId | "board";
interface Run { kind: Kind; board: BoardId; level: Level; period?: string; seed: string }
interface Result { parts: ScoreParts; total: number; coins: number; seconds: number; stars: number; newBest: boolean; streak: number; title: string; blitzLeft?: number; lifeEarned: boolean; bigWins: number; big: boolean }

export const SUDOKU_SFX = ["select", "place", "note", "erase", "wrong", "unit", "solve", "hint", "undo", "heart", "star", "open", "tick", "streak"] as const;
const sfxName = (k: (typeof SUDOKU_SFX)[number]) => `a:sudoku_${k}` as Sound;
const music = (k: string) => `a:sudoku_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];
/** a puzzle that hands out one bonus life half way: the big boards and every Hard / Expert */
const bonusLifeIn = (p: Puzzle) => BIG_BOARDS.includes(p.board) || p.level === "hard" || p.level === "expert";
const fmt = (s: number) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };

// ------------------------------------------------------------------ little board pictures for the cards

function BoardArt({ id, size = 58 }: { id: BoardId; size?: number }) {
  const b = boardOf(id), s = size, line = "rgba(255,255,255,.9)";
  if (id === "samurai") {
    const q = s / 21, sq = (r: number, c: number) => <rect key={`${r}${c}`} x={c * q + 1} y={r * q + 1} width={9 * q - 2} height={9 * q - 2} rx={3} fill="rgba(255,255,255,.28)" stroke={line} strokeWidth={1.4} />;
    return <svg width={s} height={s} aria-hidden>{[[0, 0], [0, 12], [12, 0], [12, 12], [6, 6]].map(([r, c]) => sq(r, c))}</svg>;
  }
  const n = Math.min(b.n, 9), [br, bc] = id === "giant16" ? [2, 2] : id === "giant25" ? [5, 5] : b.box;
  const cells = id === "giant25" ? 10 : id === "giant16" ? 8 : n, q = (s - 4) / cells;
  const thick: React.ReactNode[] = [];
  for (let k = 1; k < cells; k++) {
    const bold = id === "giant25" ? k % 5 === 0 : id === "giant16" ? k % 2 === 0 : k % bc === 0, boldR = id === "giant25" ? k % 5 === 0 : id === "giant16" ? k % 2 === 0 : k % br === 0;
    thick.push(<line key={`v${k}`} x1={2 + k * q} y1={2} x2={2 + k * q} y2={s - 2} stroke={line} strokeOpacity={bold ? 0.95 : 0.35} strokeWidth={bold ? 1.6 : 0.8} />);
    thick.push(<line key={`h${k}`} x1={2} y1={2 + k * q} x2={s - 2} y2={2 + k * q} stroke={line} strokeOpacity={boldR ? 0.95 : 0.35} strokeWidth={boldR ? 1.6 : 0.8} />);
  }
  return (
    <svg width={s} height={s} aria-hidden>
      <rect x={2} y={2} width={s - 4} height={s - 4} rx={6} fill="rgba(255,255,255,.2)" stroke={line} strokeWidth={1.6} />
      {thick}
      {id === "xsudoku" && <><line x1={4} y1={4} x2={s - 4} y2={s - 4} stroke="#fff" strokeWidth={2.4} strokeLinecap="round" /><line x1={s - 4} y1={4} x2={4} y2={s - 4} stroke="#fff" strokeWidth={2.4} strokeLinecap="round" /></>}
      {id === "killer" && <><rect x={2 + q * 0.6} y={2 + q * 0.6} width={q * 2.8} height={q * 1.8} fill="none" stroke="#fff" strokeDasharray="3 2" strokeWidth={1.4} /><text x={2 + q * 0.8} y={2 + q * 1.3} fontSize={8} fontWeight={900} fill="#fff">17</text><rect x={2 + q * 5.2} y={2 + q * 4.2} width={q * 1.8} height={q * 3.2} fill="none" stroke="#fff" strokeDasharray="3 2" strokeWidth={1.4} /></>}
      {id === "thermo" && <><polyline points={`${2 + q * 1.5},${2 + q * 6.5} ${2 + q * 2.5},${2 + q * 5.5} ${2 + q * 3.5},${2 + q * 4.5} ${2 + q * 4.5},${2 + q * 3.5} ${2 + q * 5.5},${2 + q * 3.5}`} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={q * 0.5} strokeLinecap="round" strokeLinejoin="round" /><circle cx={2 + q * 1.5} cy={2 + q * 6.5} r={q * 0.75} fill="#fff" /></>}
    </svg>
  );
}

/** the home screen's picture: a tilted clay 9×9 mid-solve, with a few tiles glowing */
const HERO = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const HERO_SHOWN = new Set([0, 1, 4, 9, 12, 13, 14, 19, 20, 25, 27, 31, 35, 36, 39, 41, 44, 45, 49, 53, 55, 60, 61, 66, 67, 68, 71, 76, 79, 80, 22, 58]);
const HERO_GLOW = new Set([22, 58, 40]);
function HeroBoard() {
  return (
    <div className="shrink-0 [perspective:600px]" aria-hidden>
      <div className="grid grid-cols-9 gap-[2px] rounded-[18px] bg-gradient-to-br from-[#4FA3FF] to-[#3557E0] p-2 shadow-[0_24px_40px_-18px_rgba(0,0,0,.8)] [transform:rotateX(14deg)_rotateZ(-8deg)]" style={{ width: "clamp(124px, 34vw, 190px)" }}>
        {HERO.split("").map((d, i) => {
          const r = Math.floor(i / 9), c = i % 9;
          return (
            <span key={i} className="grid aspect-square place-items-center rounded-[4px] font-[var(--font-lilita)] leading-none" style={{
              fontSize: "clamp(7px, 2.1vw, 12px)", marginRight: c === 2 || c === 5 ? 2 : 0, marginBottom: r === 2 || r === 5 ? 2 : 0,
              background: HERO_GLOW.has(i) ? "linear-gradient(180deg,#fff,#ffe9b8)" : "linear-gradient(180deg,#fffaf2,#f1dcbd)", color: HERO_GLOW.has(i) ? "#c2410c" : "#3a2a5c",
            }}>{HERO_SHOWN.has(i) || HERO_GLOW.has(i) ? d : ""}</span>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-white/85 ${className}`}>{children}</span>;
}

// ------------------------------------------------------------------ the app

export default function SudokuApp({ slug }: { slug: string; title: string }) {
  const ready = useClayHydrated();
  const save = useClay();
  const nickname = useProfile((p) => p.nickname);
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [run, setRun] = useState<Run | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(-1);
  const [notesMode, setNotesMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [continued, setContinued] = useState(false);
  const [lifeDrop, setLifeDrop] = useState(false);
  const [lifePop, setLifePop] = useState(0);
  const [wave, setWave] = useState<{ m: Map<number, number>; k: number }>({ m: new Map(), k: 0 });
  const [shake, setShake] = useState({ cell: -1, k: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "hearts" | "time" | "rules" | "quit">("");
  const [levelPick, setLevelPick] = useState<BoardId | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState("");
  const [wide, setWide] = useState(false);
  const secRef = useRef(0);
  const gameRef = useRef<Game | null>(null);
  const runRef = useRef<Run | null>(null);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { runRef.current = run; }, [run]);
  useEffect(() => { secRef.current = seconds; }, [seconds]);

  const challenge = run && run.kind !== "board" ? challengeOf(run.kind) : null;
  const today = utcDay(new Date(now));

  // ---------------------------------------------------------------- boot (once)
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Rolling the clay");
    void audio.preload(SUDOKU_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music("daily"), music("studio")]);
    // today's Daily Classic is made while the home screen shows
    const d = challengeOf("daily");
    void getPuzzle({ board: d.board, level: d.level, seed: seedOf(d) }).catch(() => {});
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px) and (min-aspect-ratio: 5/4)");
    const on = () => setWide(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);

  const sfx = useCallback((k: (typeof SUDOKU_SFX)[number], o: { cell?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    const g = gameRef.current;
    const pan = g && o.cell !== undefined && o.cell >= 0 ? (((o.cell % g.p.cols) / Math.max(1, g.p.cols - 1)) * 2 - 1) * 0.75 : 0;
    audio.play(sfxName(k), { gain: o.gain ?? 0.7, pan, rate: o.rate, delay: o.delay, reverb: 0.28, duck: k === "solve" || k === "unit" });
  }, []);

  // ---------------------------------------------------------------- starting a puzzle
  const startPuzzle = useCallback(async (r: Run, from?: InProgress) => {
    setBusy(true);
    setResult(null); setSheet(""); setSel(-1); setNotesMode(false); setWave({ m: new Map(), k: 0 });
    try {
      const p: Puzzle = from?.puzzle ?? (r.kind === "board" && !r.seed ? await nextEndless(r.board, r.level) : await getPuzzle({ board: r.board, level: r.level, seed: r.seed }));
      const run2 = { ...r, seed: p.seed };
      const g = newGame(p, from ? { values: from.values, notes: from.notes, mistakes: from.mistakes, hints: from.hints } : undefined);
      setRun(run2); setGame(g);
      setSeconds(from?.seconds ?? 0); setContinued(from?.continued ?? false); setLifeDrop(from?.lifeDrop ?? false);
      const info = boardOf(p.board);
      setZoom(1);
      if (!from) useClay.getState().start(p.board);
      setScreen("game");
      const c = r.kind !== "board" ? challengeOf(r.kind) : null;
      void audio.playMusic(music(c?.music ?? info.music));
      audio.warmMusic([music("title")]);
      if (r.kind === "board") prepareEndless(r.board, r.level);
      if (!useClay.getState().seenRules.includes(p.board) && (info.tag === "New rule" || info.n >= 16)) setSheet("rules");
      sfx("open", { gain: 0.6 });
      track("sudoku_start", { board: p.board, level: p.level, kind: r.kind });
    } catch {
      setToast("That puzzle didn't come out right — try again.");
    } finally { setBusy(false); }
  }, [sfx]);

  const playBoard = (board: BoardId, level: Level) => { useClay.getState().setLevel(board, level); setLevelPick(null); void startPuzzle({ kind: "board", board, level, seed: "" }); };
  const playChallenge = (c: Challenge) => void startPuzzle({ kind: c.id, board: c.board, level: c.level, period: periodOf(c), seed: seedOf(c) });

  // ---------------------------------------------------------------- timer + autosave
  const done = !!result;
  const running = screen === "game" && !!game && !paused && !done && !busy && sheet === "";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  // Speed Blitz clock
  useEffect(() => {
    if (!challenge?.clock || continued || !running) return;
    const left = challenge.clock - seconds;
    const t = setTimeout(() => {
      if (left <= 0) { sfx("heart"); setSheet("time"); }
      else if (left <= 10) sfx("tick", { gain: 0.45 });
    }, 0);
    return () => clearTimeout(t);
  }, [seconds, challenge, continued, running, sfx]);
  const persist = useCallback(() => {
    const g = gameRef.current, r = runRef.current;
    if (!g || !r) return;
    useClay.getState().saveCurrent({ kind: r.kind, period: r.period, puzzle: g.p, values: g.values, notes: g.notes, seconds: secRef.current, mistakes: g.mistakes, hints: g.hints, continued, lifeDrop });
  }, [continued, lifeDrop]);
  useEffect(() => { if (screen === "game" && game && !done && seconds % 5 === 0) persist(); }, [seconds, screen, game, done, persist]);

  // ---------------------------------------------------------------- finishing
  const finish = useCallback((g: Game) => {
    const r = runRef.current!;
    const c = r.kind !== "board" ? challengeOf(r.kind) : null;
    const secs = secRef.current;
    const mult = (c?.mult ?? 1) * (continued ? 0.7 : 1);
    const parts = scoreOf(g.p.board, g.p.level, secs, g.mistakes, g.hints, mult);
    const blitzLeft = c?.clock && !continued ? Math.max(0, c.clock - secs) : undefined;
    const total = parts.total + (blitzLeft ? blitzLeft * 12 : 0);
    const par = boardOf(g.p.board).par[g.p.level] ?? 600;
    const stars = g.mistakes === 0 && g.hints === 0 && secs <= par ? 3 : g.mistakes <= 1 && secs <= par * 2 ? 2 : 1;
    const earned = Math.max(3, Math.round(total / 40)) + (c?.bonusCoins ?? 0);
    useProfile.getState().earnCoins(earned);
    const res = useClay.getState().finish({ board: g.p.board, level: g.p.level, kind: r.kind, period: r.period, score: total, seconds: secs, mistakes: g.mistakes, hints: g.hints, at: Date.now() });
    useClay.getState().saveCurrent(null);
    void submitScore({ kind: r.kind, board: g.p.board, level: g.p.level, seed: g.p.seed, period: r.period, score: total, seconds: secs, mistakes: g.mistakes, hints: g.hints });
    track("sudoku_solve", { board: g.p.board, level: g.p.level, kind: r.kind, seconds: secs, score: total });
    const title = stars === 3 ? "Flawless!" : c ? `${c.name} done!` : "Solved!";
    setTimeout(() => {
      setResult({ parts, total, coins: earned, seconds: secs, stars, newBest: res.newBest, streak: res.streak, title, blitzLeft, lifeEarned: res.lifeEarned, bigWins: res.bigWins, big: BIG_BOARDS.includes(g.p.board) });
      if (res.lifeEarned) sfx("streak", { delay: 1.9, gain: 0.6 });
      sfx("solve", { gain: 0.9 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.6 });
      if (r.kind === "daily" && res.streak > 1) sfx("streak", { delay: 1.5, gain: 0.6 });
      if (r.kind === "board") prepareEndless(r.board, r.level);
    }, 900);
  }, [continued, sfx]);

  // ---------------------------------------------------------------- moves
  // big boards and Hard / Expert puzzles drop one bonus life when the board is half filled
  const bonusLife = useCallback((g: Game) => {
    if (lifeDrop || !bonusLifeIn(g.p)) return;
    let open = 0, right = 0;
    g.p.givens.forEach((v, i) => { if (v === 0) { open++; if (g.values[i] === g.p.solution[i]) right++; } });
    if (open === 0 || right / open < 0.5) return;
    setLifeDrop(true);
    useClay.getState().addLives(1);
    setLifePop((x) => x + 1);
    sfx("star", { gain: 0.7, delay: 0.15 });
    setToast("Half way! +1 life saved to your wallet");
  }, [lifeDrop, sfx]);

  const react = useCallback((g: Game, e: PlayEvent) => {
    if (e.kind === "place" || e.kind === "hint") {
      // each number has its own note on a pentatonic ladder (10+ wrap round an octave lower)
      const v = e.value, semi = PENTA[(v - 1) % 9] - (v > 9 ? 5 : 0);
      sfx(e.kind === "hint" ? "hint" : "place", { cell: e.cell, rate: e.kind === "hint" ? 1 : Math.pow(2, semi / 12) * 0.9 });
      bonusLife(g);
      if (e.units.length) {
        const m = new Map<number, number>();
        e.units.forEach((u) => {
          const order = [...u].sort((a, b) => Math.abs(a - e.cell) - Math.abs(b - e.cell));
          order.forEach((c, k) => { if (!m.has(c)) m.set(c, k * 38); });
        });
        setWave((w) => ({ m, k: w.k + 1 }));
        e.units.forEach((u, k) => sfx("unit", { cell: u[Math.floor(u.length / 2)], delay: 0.08 + k * 0.12, rate: 1 + k * 0.12 }));
        if (navigator.vibrate) navigator.vibrate(18);
      }
      if (e.solved) finish(g);
    } else if (e.kind === "wrong") {
      sfx("wrong", { cell: e.cell });
      setShake((s) => ({ cell: e.cell, k: s.k + 1 }));
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
      if (!continued) {
        const left = useClay.getState().loseLife();
        if (left === 0) setTimeout(() => { sfx("heart"); setSheet("hearts"); }, 420);
      }
    } else if (e.kind === "note") sfx("note", { cell: e.cell, gain: 0.45 });
    else if (e.kind === "erase") sfx("erase", { cell: e.cell, gain: 0.5 });
    else if (e.kind === "undo") sfx("undo", { cell: e.cell, gain: 0.5 });
  }, [sfx, finish, continued, bonusLife]);

  const act = useCallback((fn: (g: Game) => { g: Game; e: PlayEvent }) => {
    const g = gameRef.current;
    if (!g || result || sheet || paused) return;
    const r = fn(g);
    if (r.e.kind === "none") return;
    gameRef.current = r.g;
    setGame(r.g);
    react(r.g, r.e);
  }, [result, sheet, paused, react]);

  const input = useCallback((v: number) => act((g) => place(g, sel, v, notesMode)), [act, sel, notesMode]);
  const pick = useCallback((i: number) => { setSel(i); sfx("select", { cell: i, gain: 0.25 }); }, [sfx]);

  // keyboard
  useEffect(() => {
    if (screen !== "game") return;
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g || result || sheet) return;
      const k = e.key;
      if (k.startsWith("Arrow")) {
        e.preventDefault();
        const cols = g.p.cols, rows = g.p.rows;
        let i = sel < 0 ? g.p.givens.findIndex((v) => v >= 0) : sel;
        const dr = k === "ArrowUp" ? -1 : k === "ArrowDown" ? 1 : 0, dc = k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : 0;
        for (let step = 0; step < Math.max(rows, cols); step++) {
          const r = Math.floor(i / cols) + dr, c = (i % cols) + dc;
          if (r < 0 || r >= rows || c < 0 || c >= cols) break;
          i = r * cols + c;
          if (g.p.givens[i] >= 0) { pick(i); break; }
        }
        return;
      }
      if (k === "Backspace" || k === "Delete" || k === "0") { e.preventDefault(); act((x) => erase(x, sel)); return; }
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") { e.preventDefault(); act(undo); return; }
      if (!e.ctrlKey && !e.metaKey && g.p.n <= 9) {
        if (k.toLowerCase() === "n") { setNotesMode((x) => !x); return; }
        if (k.toLowerCase() === "u" || k.toLowerCase() === "z") { act(undo); return; }
        if (k.toLowerCase() === "h") { act((x) => hint(x, sel)); return; }
      }
      if (k === " " && g.p.n > 9) return;
      const v = valueOfKey(k, g.p.n);
      if (v) { e.preventDefault(); act((x) => place(x, sel, v, notesMode || e.shiftKey)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, sel, notesMode, result, sheet, act, pick]);

  const leave = () => {
    persist();
    setScreen("home"); setGame(null); setResult(null); setSheet("");
    void audio.playMusic(music("title"));
  };
  const restart = () => {
    const g = gameRef.current, r = runRef.current;
    if (!g || !r) return;
    setGame(newGame(g.p)); setSeconds(0); setContinued(false); setLifeDrop(false); setSheet(""); setResult(null); setSel(-1);
  };

  // dev / QA hook: fill all but `left` cells correctly, or play one move
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __sudoku?: unknown }).__sudoku = {
      game: () => gameRef.current,
      fillAllBut: (left = 1) => {
        const g = gameRef.current;
        if (!g) return;
        const open = g.values.map((v, i) => (g.p.givens[i] === 0 && v !== g.p.solution[i] ? i : -1)).filter((i) => i >= 0);
        const values = g.values.slice();
        open.slice(0, Math.max(0, open.length - left)).forEach((i) => { values[i] = g.p.solution[i]; });
        const n = { ...g, values }; gameRef.current = n; setGame(n);
        return open.slice(open.length - left);
      },
      select: (i: number) => setSel(i),
      lives: () => useClay.getState().lives,
      play: (board: BoardId, level: Level) => void startPuzzle({ kind: "board", board, level, seed: "" }),
    };
  }, [startPuzzle]);

  // ---------------------------------------------------------------- render
  const view: BoardView | null = game ? {
    values: game.values, notes: game.notes, sel, wrongShown: save.settings.showMistakes, highlight: save.settings.highlight,
    wave: wave.m, waveKey: wave.k, shake: shake.cell, shakeKey: shake.k, hidden: paused,
  } : null;

  return (
    <div className="cdk-root">
      <style>{SUDOKU_CSS}</style>
      <div className="cdk-blob" style={{ width: 340, height: 340, left: -120, top: -80, background: "#ff7a3d" }} />
      <div className="cdk-blob" style={{ width: 300, height: 300, right: -110, top: 120, background: "#7b5cff", animationDelay: "-6s" }} />
      <div className="cdk-blob" style={{ width: 280, height: 280, left: "30%", bottom: -140, background: "#2ed3e6", animationDelay: "-11s" }} />

      {screen === "home" && (
        <Home ready={ready} nickname={nickname} today={today} now={now} busy={busy}
          onBoard={(b) => { sfx("open", { gain: 0.4 }); setLevelPick(b); }} onChallenge={playChallenge}
          onResume={() => { const c = useClay.getState().current; if (c) void startPuzzle({ kind: c.kind, board: c.puzzle.board, level: c.puzzle.level, period: c.period, seed: c.puzzle.seed }, c); }} />
      )}

      {screen === "game" && game && view && run && (
        <GameScreen game={game} view={view} run={run} challenge={challenge} seconds={seconds} continued={continued} lives={save.lives} lifePop={lifePop} bonus={bonusLifeIn(game.p) && !lifeDrop} zoom={zoom} wide={wide} notesMode={notesMode} timer={save.settings.timer}
          onZoom={() => setZoom((z) => (z >= 2.2 ? 1 : z < 1.5 ? 1.6 : 2.2))} onPick={pick} onInput={input}
          onErase={() => act((g) => erase(g, sel))} onUndo={() => act(undo)} onHint={() => act((g) => hint(g, sel))}
          onNotes={() => { setNotesMode((x) => !x); sfx("note", { gain: 0.35 }); }}
          onAutoNotes={() => { const g = gameRef.current; if (!g) return; const n = autoNotes(g); gameRef.current = n; setGame(n); sfx("hint", { gain: 0.4 }); setNotesMode(true); }}
          onBack={() => setSheet("quit")} />
      )}

      {busy && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-[#110828]/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 animate-spin rounded-full border-[6px] border-white/15 border-t-[#ffb23d]" />
            <p className="cdk-display text-xl">Shaping the clay…</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {levelPick && <LevelSheet key="lv" board={levelPick} onClose={() => setLevelPick(null)} onPlay={playBoard} />}
        {result && run && game && (
          <ClearSheet key="clear" r={result} run={run} p={game.p} onNext={() => { if (run.kind === "board") void startPuzzle({ ...run, seed: "" }); else leave(); }} onHome={leave} />
        )}
        {sheet === "hearts" && (
          <Sheet key="hearts" title="Out of lives" onClose={() => setSheet("")}>
            <p className="text-white/80">Your lives wallet is empty. Keep going for 70 % of the score, or start this puzzle again. Win two big puzzles (16×16, 25×25, Samurai) for a new life — big and Hard puzzles also drop a bonus life half way.</p>
            <div className="mt-5 grid gap-2">
              <button type="button" className="cdk-btn bg-[#ffb23d] py-3 text-[#3b1d00]" onClick={() => { setContinued(true); setSheet(""); }}>Keep going</button>
              <button type="button" className="cdk-btn bg-white/15 py-3" onClick={restart}>Restart puzzle</button>
            </div>
          </Sheet>
        )}
        {sheet === "time" && (
          <Sheet key="time" title="Time's up!" onClose={() => setSheet("")}>
            <p className="text-white/80">The Blitz clock ran out. Try the same grid again, or finish it without the clock bonus.</p>
            <div className="mt-5 grid gap-2">
              <button type="button" className="cdk-btn bg-[#4FA3FF] py-3" onClick={restart}>Try again</button>
              <button type="button" className="cdk-btn bg-white/15 py-3" onClick={() => { setContinued(true); setSheet(""); }}>Finish without the clock</button>
            </div>
          </Sheet>
        )}
        {sheet === "quit" && (
          <Sheet key="quit" title="Leave this puzzle?" onClose={() => setSheet("")}>
            <p className="text-white/80">It&apos;s saved — tap Continue on the home screen to pick it up again.</p>
            <div className="mt-5 grid gap-2">
              <button type="button" className="cdk-btn bg-[#ffb23d] py-3 text-[#3b1d00]" onClick={() => setSheet("")}>Keep playing</button>
              <button type="button" className="cdk-btn bg-white/15 py-3" onClick={leave}>Save &amp; go home</button>
            </div>
          </Sheet>
        )}
        {sheet === "rules" && game && (
          <Sheet key="rules" title={boardOf(game.p.board).name} onClose={() => { useClay.getState().sawRules(game.p.board); setSheet(""); }}>
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-2xl p-2" style={{ background: `linear-gradient(150deg, ${boardOf(game.p.board).c1}, ${boardOf(game.p.board).c2})` }}><BoardArt id={game.p.board} size={72} /></div>
              <p className="text-white/85">{boardOf(game.p.board).rule}</p>
            </div>
            {game.p.n > 9 && <p className="mt-3 text-sm text-white/60">After 9 come letters: A = 10, B = 11 … On a keyboard just type them.</p>}
            <button type="button" className="cdk-btn mt-5 w-full bg-[#ffb23d] py-3 text-[#3b1d00]" onClick={() => { useClay.getState().sawRules(game.p.board); setSheet(""); }}>Let&apos;s go</button>
          </Sheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div key="toast" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
            className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-bold">{toast}</motion.div>
        )}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

// ------------------------------------------------------------------ sheets

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/55 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="cdk-card cdk-sheet w-full max-w-md rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:rounded-b-[22px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="cdk-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/10"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function LevelSheet({ board, onClose, onPlay }: { board: BoardId; onClose: () => void; onPlay: (b: BoardId, l: Level) => void }) {
  const b = boardOf(board);
  const st = useClay((s) => s.stats[board]);
  const last = useClay((s) => s.lastLevel[board]) ?? b.levels[0];
  const [lv, setLv] = useState<Level>(b.levels.includes(last) ? last : b.levels[0]);
  return (
    <Sheet title={b.name} onClose={onClose}>
      <div className="flex items-center gap-4 rounded-2xl p-3" style={{ background: `linear-gradient(150deg, ${b.c1}, ${b.c2})` }}>
        <BoardArt id={board} size={66} />
        <p className="text-sm font-semibold leading-snug text-white/95">{b.rule}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {b.levels.map((l) => (
          <button key={l} type="button" onClick={() => setLv(l)} className={`rounded-2xl border-2 px-3 py-2.5 text-left transition ${lv === l ? "border-[#ffb23d] bg-[#ffb23d]/15" : "border-white/10 bg-white/5"}`}>
            <span className="block font-extrabold">{LEVEL_LABEL[l]}</span>
            <span className="block text-xs text-white/60">{b.base[l]} pts · best {st?.best[l] !== undefined ? fmt(st.best[l]!) : "—"}</span>
          </button>
        ))}
      </div>
      <button type="button" className="cdk-btn cdk-shine mt-5 flex w-full items-center justify-center gap-2 bg-gradient-to-b from-[#ffd36b] to-[#ff9f2e] py-3.5 text-lg text-[#3b1d00]" onClick={() => onPlay(board, lv)}>
        <Play className="size-5 fill-current" /> Play {LEVEL_LABEL[lv]}
      </button>
      <p className="mt-2 text-center text-xs text-white/55">A new puzzle every time — finish one and the next rolls in.</p>
    </Sheet>
  );
}

function ClearSheet({ r, run, p, onNext, onHome }: { r: Result; run: Run; p: Puzzle; onNext: () => void; onHome: () => void }) {
  const endless = run.kind === "board";
  const [left, setLeft] = useState(endless ? 8 : 0);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 1100); setShown(Math.round(r.total * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [r.total]);
  useEffect(() => {
    if (!endless || left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, endless, onNext]);
  const b = boardOf(p.board);
  const rows: [string, number][] = [["Solve", r.parts.base], ["Speed bonus", r.parts.time], ["No mistakes", r.parts.clean], ...(r.parts.hints ? [["Hints", r.parts.hints] as [string, number]] : []), ...(r.blitzLeft ? [["Clock left", r.blitzLeft * 12] as [string, number]] : [])];
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="cdk-card cdk-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="relative px-5 pt-6 pb-4" style={{ background: `linear-gradient(160deg, ${b.c1}, ${b.c2})` }}>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((k) => (
              <motion.span key={k} initial={{ scale: 0, rotate: -40 }} animate={{ scale: k < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + k * 0.28, type: "spring" }}>
                <Star className={`size-11 ${k < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/15 text-white/25"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="cdk-display cdk-clay-text mt-1 text-4xl">{r.title}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{b.name} · {LEVEL_LABEL[p.level]} · {fmt(r.seconds)}{r.newBest ? " · new best time!" : ""}</p>
        </div>
        <div className="px-5 py-4">
          <p className="cdk-display text-5xl text-[#FFD36B]">{shown.toLocaleString()}</p>
          <div className="mt-3 grid gap-1 text-sm">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between text-white/75"><span>{k}</span><span className={v < 0 ? "text-[#ff8aa1]" : "font-bold text-white"}>{v > 0 ? "+" : ""}{v.toLocaleString()}</span></div>)}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 text-sm font-bold">
            <span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>
            {run.kind === "daily" && <span className="flex items-center gap-1 text-[#ffb23d]"><Flame className="size-4" /> {r.streak}-day streak</span>}
            {r.lifeEarned && <span className="flex items-center gap-1 text-[#ff8aa1]"><Heart className="size-4 fill-current" /> +1 life</span>}
          </div>
          {r.big && !r.lifeEarned && <p className="mt-2 text-xs font-bold text-white/60">Big puzzle wins: {r.bigWins % 2}/2 — one more for a new life</p>}
          <p className="mt-2 text-xs font-bold text-white/60">+{r.total.toLocaleString()} added to your total score</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="cdk-btn cdk-shine flex items-center justify-center gap-2 bg-gradient-to-b from-[#ffd36b] to-[#ff9f2e] py-3 text-[#3b1d00]" onClick={onNext}>
              {endless ? <>Next puzzle{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></> : <>Back to today <ChevronRight className="size-5" /></>}
            </button>
            {endless && <button type="button" className="cdk-btn bg-white/12 py-2.5" onClick={onHome}>Home</button>}
          </div>
          <p className="mt-3 text-[11px] text-white/45">Saved on this device · joins the world ranking when MOMOBLOBS sign-in arrives</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ------------------------------------------------------------------ game screen

function GameScreen(props: {
  game: Game; view: BoardView; run: Run; challenge: Challenge | null; seconds: number; continued: boolean; lives: number; lifePop: number; bonus: boolean; zoom: number; wide: boolean; notesMode: boolean; timer: boolean;
  onZoom: () => void; onPick: (i: number) => void; onInput: (v: number) => void; onErase: () => void; onUndo: () => void; onHint: () => void; onNotes: () => void; onAutoNotes: () => void; onBack: () => void;
}) {
  const { game, view, challenge, seconds, continued, lives, lifePop, bonus, zoom, wide, notesMode, timer } = props;
  const p = game.p, b = boardOf(p.board);
  const { have, need } = valueCounts(game);
  const clock = challenge?.clock && !continued ? Math.max(0, challenge.clock - seconds) : null;
  const big = p.n > 9 || p.board === "samurai";
  const perRow = p.n <= 9 ? p.n : p.n === 16 ? 8 : 9;
  const selV = view.sel >= 0 ? game.values[view.sel] : 0;
  const keypad = (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${wide && p.n <= 9 ? 3 : perRow}, minmax(0, 1fr))` }}>
      {Array.from({ length: p.n }, (_, k) => k + 1).map((v) => {
        const doneV = have[v] >= need;
        return (
          <button key={v} type="button" disabled={doneV && !notesMode} onClick={() => props.onInput(v)}
            className={`cdk-key ${notesMode ? "cdk-key-notes" : ""} ${selV === v ? "ring-2 ring-[#ffb23d]" : ""}`}
            style={{ height: wide ? 58 : p.n > 16 ? 40 : p.n > 9 ? 44 : 52, fontSize: p.n > 9 ? 20 : wide ? 30 : 26 }}>
            {sym(v)}
            {!doneV && p.n <= 16 && <span className="absolute right-1.5 bottom-0.5 font-[var(--font-fredoka)] text-[9px] font-bold text-[#a08a6a]">{need - have[v]}</span>}
          </button>
        );
      })}
    </div>
  );
  const tools = (
    <div className="flex items-start justify-around">
      <button type="button" className="cdk-tool" onClick={props.onUndo}><span className="cdk-tool-ico"><Undo2 className="size-5" /></span>Undo</button>
      <button type="button" className="cdk-tool" onClick={props.onErase}><span className="cdk-tool-ico"><Eraser className="size-5" /></span>Erase</button>
      <button type="button" className={`cdk-tool ${notesMode ? "cdk-tool-on" : ""}`} onClick={props.onNotes} onDoubleClick={props.onAutoNotes}>
        <span className="cdk-tool-ico"><Pencil className="size-5" /><span className="cdk-badge" style={{ background: notesMode ? "#3b1d00" : "#5b3fb0" }}>{notesMode ? "ON" : "OFF"}</span></span>Notes
      </button>
      <button type="button" className="cdk-tool" onClick={props.onAutoNotes}><span className="cdk-tool-ico"><Wand2 className="size-5" /></span>Auto notes</button>
      <button type="button" className="cdk-tool" onClick={props.onHint}><span className="cdk-tool-ico"><Lightbulb className="size-5" />{game.hints > 0 && <span className="cdk-badge">{game.hints}</span>}</span>Hint</button>
      {big && <button type="button" className="cdk-tool" onClick={props.onZoom}><span className="cdk-tool-ico">{zoom > 1 ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}</span>{zoom > 1 ? "Fit" : "Zoom"}</button>}
    </div>
  );
  const header = (
    <div className="flex items-center gap-2 pr-[64px] pl-3 pt-[max(env(safe-area-inset-top),10px)] pb-2">
      <button type="button" aria-label="Back" onClick={props.onBack} className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/10"><ArrowLeft className="size-5" /></button>
      <div className="min-w-0 flex-1">
        <p className="cdk-display truncate text-lg leading-tight">{challenge ? challenge.name : b.name}</p>
        <p className="truncate text-xs font-bold text-white/60">{challenge ? `${b.name} · ` : ""}{LEVEL_LABEL[p.level]}{continued ? " · 70 %" : ""}</p>
      </div>
      <motion.div key={lifePop} initial={lifePop ? { scale: 1.6 } : false} animate={{ scale: 1 }} transition={{ type: "spring", damping: 9 }}
        className={`flex items-center gap-1 rounded-2xl px-2.5 py-1.5 font-extrabold tabular-nums ${lives === 0 ? "bg-white/10 text-white/50" : "bg-[#ff5c7a]/20 text-white"}`}
        aria-label={`${lives} lives in your wallet`} title={bonus ? "A bonus life waits half way through this puzzle" : "Lives wallet"}>
        <Heart className={`size-4 ${lives > 0 ? "fill-[#ff5c7a] text-[#ff5c7a]" : ""}`} /> {lives}{bonus && <Sparkles className="size-3.5 text-[#ffd36b]" />}
      </motion.div>
      {(timer || clock !== null) && (
        <div className={`flex min-w-[68px] items-center justify-center gap-1 rounded-2xl px-2.5 py-1.5 font-extrabold tabular-nums ${clock !== null && clock <= 10 ? "bg-[#ff5c7a] text-white" : "bg-white/10"}`}>
          <Clock className="size-4" /> {fmt(clock ?? seconds)}
        </div>
      )}
    </div>
  );
  if (wide) {
    return (
      <div className="absolute inset-0 flex flex-col">
        {header}
        <div className="flex min-h-0 flex-1 gap-5 px-5 pb-5">
          <div className="min-h-0 min-w-0 flex-1"><Board p={p} view={view} zoom={zoom} onPick={props.onPick} /></div>
          <div className="flex w-[340px] shrink-0 flex-col justify-center gap-5">
            <div className="cdk-card p-4">{tools}</div>
            <div className="cdk-card p-4">{keypad}</div>
            <p className="text-center text-xs text-white/50">Keys: arrows move · 1–9{p.n > 9 ? ", A–" + sym(p.n) : ""} place · Shift = note · Backspace erase · Ctrl+Z undo</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col">
      {header}
      <div className="min-h-0 flex-1 px-1.5"><Board p={p} view={view} zoom={zoom} onPick={props.onPick} /></div>
      <div className="space-y-3 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        {tools}
        {keypad}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ home

function Home({ ready, nickname, today, now, busy, onBoard, onChallenge, onResume }: {
  ready: boolean; nickname: string; today: string; now: number; busy: boolean;
  onBoard: (b: BoardId) => void; onChallenge: (c: Challenge) => void; onResume: () => void;
}) {
  const save = useClay();
  const streak = liveStreak(save, today);
  const [scope, setScope] = useState<RankScope>("today");
  const rows = useMemo(() => (ready ? localBoard(scope, nickname, now) : []), [ready, scope, nickname, now, save.recent]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = save.current;
  const daily = CHALLENGES[0];
  const done = (c: Challenge) => save.tasks[`${c.id}:${periodOf(c, new Date(now))}`];
  const solvedAll = Object.values(save.stats).reduce((s, x) => s + (x?.solved ?? 0), 0);

  return (
    <div className="cdk-scroll cdk-hide-scroll">
      <div className="mx-auto max-w-5xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        {/* wallet: lives, total score, streak */}
        <div className="grid grid-cols-3 gap-2">
          <div className="cdk-card flex items-center gap-2 px-3 py-2.5">
            <Heart className="size-6 shrink-0 fill-[#ff5c7a] text-[#ff5c7a]" />
            <span className="min-w-0"><span className="cdk-display block text-xl leading-none">{save.lives}</span><span className="text-[10px] font-extrabold tracking-wider text-white/55 uppercase">Lives</span></span>
          </div>
          <div className="cdk-card flex items-center gap-2 px-3 py-2.5">
            <Trophy className="size-6 shrink-0 text-[#ffd36b]" />
            <span className="min-w-0"><span className="cdk-display block truncate text-xl leading-none">{save.totalScore.toLocaleString()}</span><span className="text-[10px] font-extrabold tracking-wider text-white/55 uppercase">Score</span></span>
          </div>
          <div className="cdk-card flex items-center gap-2 px-3 py-2.5">
            <Flame className="size-6 shrink-0 text-[#ff9f2e]" />
            <span className="min-w-0"><span className="cdk-display block text-xl leading-none">{streak}</span><span className="text-[10px] font-extrabold tracking-wider text-white/55 uppercase">Day streak</span></span>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] font-bold text-white/45">Every solve adds to your score · big puzzles earn lives · global score arrives with MOMOBLOBS sign-in</p>

        {/* title */}
        <div className="mt-5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="cdk-display cdk-clay-text text-[44px] leading-[0.92] sm:text-6xl">Sudoku Ninefold</h1>
            <p className="mt-2 text-[14px] font-semibold text-white/75">Nine sudoku puzzles in one place. Pick one and play — a fresh grid every time.</p>
          </div>
          <span className="hidden sm:block"><HeroBoard /></span>
        </div>

        {cur && (
          <button type="button" onClick={onResume} disabled={busy} className="cdk-card mt-5 flex w-full items-center gap-3 p-3 text-left">
            <span className="grid size-12 place-items-center rounded-2xl" style={{ background: `linear-gradient(150deg, ${boardOf(cur.puzzle.board).c1}, ${boardOf(cur.puzzle.board).c2})` }}><BoardArt id={cur.puzzle.board} size={38} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-extrabold tracking-wider text-[#ffb23d] uppercase">Continue</span>
              <span className="block truncate font-extrabold">{cur.kind !== "board" ? challengeOf(cur.kind).name : boardOf(cur.puzzle.board).name} · {LEVEL_LABEL[cur.puzzle.level]} · {fmt(cur.seconds)}</span>
            </span>
            <Play className="size-6 fill-current text-[#ffb23d]" />
          </button>
        )}

        {/* the nine puzzles — the heart of the game */}
        <div className="mt-6 flex items-end justify-between">
          <h2 className="cdk-display text-[28px] leading-none">The 9 puzzles</h2>
          <span className="text-xs font-bold text-white/55">{solvedAll} solved</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {BOARDS.map((bd, k) => {
            const st = save.stats[bd.id];
            const big = BIG_BOARDS.includes(bd.id);
            return (
              <motion.button key={bd.id} type="button" whileTap={{ scale: 0.96 }} whileHover={{ y: -4 }} disabled={busy} onClick={() => onBoard(bd.id)}
                className="group relative overflow-hidden rounded-[24px] text-left shadow-[0_20px_40px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/15"
                style={{ background: `linear-gradient(160deg, ${bd.c1}, ${bd.c2})` }}>
                <span className="relative block aspect-square overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cdn(`/games/sudoku-ninefold/boards/${bd.id}.webp`)} alt={`${bd.name} puzzle`} loading="lazy"
                    className="absolute top-[13%] left-[8%] h-[82%] w-[84%] object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,.45)] transition duration-300 group-hover:scale-[1.04] group-hover:rotate-[-1.5deg]" />
                  <span className="cdk-display absolute top-2.5 left-2.5 rounded-full bg-black/35 px-2 py-0.5 text-[13px] leading-tight backdrop-blur-sm">{String(k + 1).padStart(2, "0")}</span>
                  <span className="absolute top-2.5 right-2.5 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase backdrop-blur-sm">{bd.tag}</span>
                  {big && <span className="absolute right-2.5 bottom-2.5 flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-extrabold backdrop-blur-sm"><Heart className="size-3 fill-[#ff8aa1] text-[#ff8aa1]" /> earns lives</span>}
                </span>
                <span className="block bg-black/25 px-3 pt-2.5 pb-3 backdrop-blur-sm">
                  <span className="cdk-display block truncate text-[19px] leading-tight">{bd.name}</span>
                  <span className="mt-0.5 line-clamp-2 block min-h-[2.4em] text-[12px] leading-snug font-semibold text-white/80">{bd.blurb}</span>
                  <span className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-extrabold text-white/70">{st?.solved ? `${st.solved} solved · best ${st.bestScore.toLocaleString()}` : bd.levels.map((l) => LEVEL_LABEL[l]).join(" · ")}</span>
                    <span className="cdk-btn grid size-9 shrink-0 place-items-center bg-white text-[#3b1d00]"><Play className="size-4 fill-current" /></span>
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* today's tasks */}
        <div className="mt-9 flex items-end justify-between">
          <h2 className="cdk-display text-2xl">Today&apos;s challenges</h2>
          <span className="text-xs font-bold text-white/60">new in {countdown(msUntilNext(false, new Date(now)))}</span>
        </div>
        <button type="button" disabled={busy} onClick={() => onChallenge(daily)} className="cdk-card cdk-shine relative mt-3 block w-full overflow-hidden p-5 text-left" style={{ background: `linear-gradient(140deg, ${daily.c1}, ${daily.c2})` }}>
          <span className="text-xs font-extrabold tracking-widest text-white/85 uppercase">{daily.kicker} · {today}</span>
          <span className="cdk-display mt-1 block text-4xl">{daily.name}</span>
          <span className="mt-1 block max-w-[70%] text-sm font-semibold text-white/90">{daily.blurb}</span>
          <span className="mt-4 flex flex-wrap items-center gap-2">
            {done(daily) ? <Pill className="!bg-white/25"><Check className="size-3.5" /> Solved · {done(daily)!.score.toLocaleString()} pts</Pill> : <Pill className="!bg-white/25">×{daily.mult} score · +{daily.bonusCoins} coins</Pill>}
            <span className="cdk-btn inline-flex items-center gap-1.5 bg-white px-4 py-2 text-sm text-[#c2410c]"><Play className="size-4 fill-current" /> {done(daily) ? "Play again" : "Play"}</span>
          </span>
          <span className="absolute top-4 right-4 opacity-90"><BoardArt id="classic9" size={74} /></span>
        </button>
        <div className="cdk-hide-scroll -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
          {CHALLENGES.slice(1).map((c) => {
            const d = done(c);
            return (
              <button key={c.id} type="button" disabled={busy} onClick={() => onChallenge(c)} className="cdk-card relative w-[74%] shrink-0 snap-start overflow-hidden p-4 text-left sm:w-auto" style={{ background: `linear-gradient(150deg, ${c.c1}cc, ${c.c2}cc)` }}>
                <span className="text-[11px] font-extrabold tracking-widest text-white/85 uppercase">{c.kicker}</span>
                <span className="cdk-display block text-2xl">{c.name}</span>
                <span className="mt-1 block text-[13px] font-semibold text-white/85">{c.blurb}</span>
                <span className="mt-3 flex items-center justify-between">
                  {d ? <Pill className="!bg-white/25"><Check className="size-3.5" /> {d.score.toLocaleString()}</Pill> : <Pill className="!bg-white/25">+{c.bonusCoins} coins</Pill>}
                  {c.weekly && <span className="text-[11px] font-bold text-white/80">{countdown(msUntilNext(true, new Date(now)))}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* world ranking */}
        <div className="cdk-card mt-8 p-4">
          <div className="flex items-center justify-between">
            <h2 className="cdk-display flex items-center gap-2 text-2xl"><Globe2 className="size-6 text-[#2ed3e6]" /> World ranking</h2>
            <div className="flex rounded-full bg-white/10 p-0.5 text-xs font-extrabold">
              {(["today", "week", "all"] as RankScope[]).map((s) => (
                <button key={s} type="button" onClick={() => setScope(s)} className={`rounded-full px-3 py-1.5 ${scope === s ? "bg-white text-[#24154d]" : "text-white/70"}`}>{s === "all" ? "All time" : s === "week" ? "Week" : "Today"}</button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-end justify-center gap-2">
            {[2, 1, 3].map((place) => (
              <div key={place} className="flex w-24 flex-col items-center">
                <div className={`grid place-items-center rounded-full border-2 border-dashed border-white/25 bg-white/5 font-extrabold text-white/40 ${place === 1 ? "size-14" : "size-11"}`}>?</div>
                <div className={`mt-2 w-full rounded-t-xl text-center font-extrabold ${place === 1 ? "h-16 bg-gradient-to-b from-[#ffd36b] to-[#ff9f2e] text-[#3b1d00]" : place === 2 ? "h-12 bg-white/25" : "h-9 bg-[#c9824a]/60"}`}><span className="cdk-display text-2xl leading-[2.2]">{place}</span></div>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-2xl bg-white/5 p-3 text-center text-sm font-semibold text-white/75">
            <Sparkles className="mr-1 inline size-4 text-[#ffb23d]" />
            The world podium opens with MOMOBLOBS sign-in. Your solves are kept on this device and join the ranking automatically.
          </p>
          <h3 className="mt-4 text-xs font-extrabold tracking-widest text-white/55 uppercase">Your best {scope === "all" ? "ever" : scope === "week" ? "this week" : "today"}</h3>
          <div className="mt-2 grid gap-1.5">
            {rows.length === 0 && <p className="text-sm text-white/55">No solves yet — the Daily Classic is a great first one.</p>}
            {rows.slice(0, 5).map((r, i) => {
              const s = save.recent.filter((x) => x.score === r.score)[0];
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
                  <span className="cdk-display w-6 text-center text-lg text-[#ffb23d]">{r.rank}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{s ? (s.kind !== "board" ? challengeOf(s.kind).name : boardOf(s.board).name) + " · " + LEVEL_LABEL[s.level] : r.name}</span>
                  <span className="text-xs text-white/55">{fmt(r.seconds)}</span>
                  <span className="cdk-display text-lg">{r.score.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* how it works */}
        <h2 className="cdk-display mt-8 text-2xl">How Sudoku Ninefold works</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            [CalendarDays, "Same puzzles for the whole world", "A Daily Classic, Mini Express and Speed Blitz every day at midnight UTC, and a Weekly Epic every Monday."],
            [Sparkles, "Never the same grid twice", "Boards are made fresh on your device and every one is checked to have exactly one answer. Finish one and the next rolls in."],
            [Pencil, "Notes, undo and hints", "Tap Notes to pencil in candidates, Auto notes to fill them all. A hint fills one cell but trims the score."],
            [Heart, "Lives wallet", "A wrong number costs one life from your wallet. Win two big puzzles for a new life; big and Hard puzzles also drop a bonus life half way."],
            [Trophy, "Score", "Each level has a base score; finish fast for a speed bonus and clean for +25 %. Today's tasks multiply it."],
            [RotateCcw, "Pick up where you left", "Leave any time — the puzzle is saved and waits under Continue."],
          ].map(([I, t, d]) => {
            const Icon = I as typeof Trophy;
            return (
              <div key={t as string} className="cdk-card flex gap-3 p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10"><Icon className="size-5 text-[#ffb23d]" /></span>
                <span><span className="block font-extrabold">{t as string}</span><span className="block text-sm text-white/65">{d as string}</span></span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
