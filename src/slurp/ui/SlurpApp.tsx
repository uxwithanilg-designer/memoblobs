"use client";
// Slurp Lab front-end, built to feel like a phone app: the title (the tray solving itself behind the logo) with the
// modes, the lab map (30 labs × 20 stages with stars), the game (counter bar, moves and par, Undo / Restart / Hint and
// boosters in a thumb-friendly bottom bar, the stage card, the stuck banner, Prof. Hoot's first-time coach), the clear
// sheet, the Daily Brain Jar, the Endless Lab, Exam Rush, the Lab Wardrobe, the Gloopy album and settings.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, BookOpen, CalendarDays, ChevronRight, CircleHelp, Infinity as InfinityIcon, Lightbulb, Lock, Map as MapIcon, Minus, Move, Play, RotateCcw, Settings2, Shirt, Star, Timer, Trophy, Undo2, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { cdn } from "@/lib/cdn";
import { CAMPAIGN, LABS, labOf, stageIn, stageName, type Lab } from "../campaign";
import { DAILY_BASE, dayNumber, endlessRecipe, fingerprint, isDaily, labFor, mutationOf } from "../endless";
import { decodeStage, type StageRow } from "../stagefile";
import { SlurpSession, SLURP_SFX, type SlurpResult } from "../session";
import { HATS, SKINS, STICKERS, autoQuality, totalStars, useSlurp, useSlurpHydrated } from "../save";
import { BF, COLORS, RAINBOW, type Hud, type SlurpEvent, type Stage } from "../types";

type Screen = "title" | "map" | "game" | "clear" | "wardrobe" | "album";
type Mode = "campaign" | "endless" | "daily" | "rush";
interface Run { key: number; n: number; mode: Mode; lab: Lab; fp?: string; rush?: { list: number[]; k: number; cleared: number } }
interface Clear { r: SlurpResult; coins: number; title: string; sub?: string; next?: () => void; nextLabel?: string }

const UI_SOUNDS: Sound[] = ["a:click", "a:whooshOut", "a:whooshIn", "a:ding", "a:levelup", "a:coin", "a:sparks"];
const music = (k: string) => `a:slurp_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const isPhone = () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false);
const HINT_PRICE = 60, SHRINK_PRICE = 80, LIFT_PRICE = 120;
/** Endless opens after Lab 10, Exam Rush after 5 passed exams */
const ENDLESS_AFTER = 200, RUSH_EXAMS = 5;

// the forged campaign, 100 stages per file (game files on R2)
const files = new Map<number, Promise<StageRow[]>>();
function loadFile(k: number): Promise<StageRow[]> {
  let p = files.get(k);
  if (!p) {
    p = fetch(cdn(`/games/slurp-lab/stages-${k}.json`)).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<StageRow[]>; });
    p.catch(() => files.delete(k));
    files.set(k, p);
  }
  return p;
}
async function loadStage(n: number): Promise<Stage> { const rows = await loadFile(Math.floor((n - 1) / 100) + 1); return decodeStage(rows[(n - 1) % 100]); }

// Endless / Daily stages are made on the device, in the worker
let genWorker: Worker | null = null, genId = 0;
const genWaits = new Map<number, (r: StageRow | null) => void>();
function generate(n: number, seen: string[]): Promise<{ st: Stage; fp: string } | null> {
  let v = 0, rc = endlessRecipe(n, 0);
  if (!isDaily(n)) while (seen.includes(fingerprint(rc)) && v < 8) rc = endlessRecipe(n, ++v);
  const fp = fingerprint(rc), lab = labFor(n);
  // a fun name from the campaign's word lists (picked so it is never "First …", "Big Tray" or "Hoot's Exam")
  const name = stageName(20 * (n % 997) + 2 + (n % 7));
  return new Promise((resolve) => {
    try {
      if (!genWorker) {
        genWorker = new Worker(new URL("../worker.ts", import.meta.url), { type: "module" });
        genWorker.onmessage = (m: MessageEvent<{ id: number; row?: StageRow | null }>) => { const w = genWaits.get(m.data.id); if (!w) return; genWaits.delete(m.data.id); w(m.data.row ?? null); };
      }
      const id = ++genId;
      genWaits.set(id, (row) => resolve(row ? { st: decodeStage(row, lab), fp } : null));
      genWorker.postMessage({ id, kind: "gen", rc, name });
    } catch { resolve(null); }
  });
}
const pending = new Map<number, ReturnType<typeof generate>>();
function generated(n: number, seen: string[]) { let p = pending.get(n); if (!p) { p = generate(n, seen); pending.set(n, p); } return p; }

const RAINBOW_STOPS = ["#FF3B5C", "#FF7A1A", "#FFC300", "#4CD137", "#16B8F3", "#8C4DF0"];
function GloopyDot({ color, size = 26, n }: { color: number; size?: number; n?: number }) {
  const rainbow = color === RAINBOW, c = COLORS[color] ?? COLORS[0];
  const id = `slg${color}`;
  return (
    <span className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <defs>
          {rainbow
            ? <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">{RAINBOW_STOPS.map((h, i) => <stop key={h} offset={`${i * 20}%`} stopColor={h} />)}</linearGradient>
            : <radialGradient id={id} cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor="#fff" stopOpacity="0.85" /><stop offset="35%" stopColor={c.glow} /><stop offset="100%" stopColor={c.hex} /></radialGradient>}
        </defs>
        <path d="M20 4 C 30 4 36 14 36 24 C 36 33 29 37 20 37 C 11 37 4 33 4 24 C 4 14 10 4 20 4 Z" fill={`url(#${id})`} />
        <ellipse cx="13" cy="14" rx="4" ry="2.4" fill="#fff" opacity="0.55" />
        <ellipse cx="14.5" cy="21" rx="3.2" ry="3.8" fill="#fff" /><ellipse cx="25.5" cy="21" rx="3.2" ry="3.8" fill="#fff" />
        <circle cx="15" cy="21.6" r="1.9" fill="#1B1530" /><circle cx="26" cy="21.6" r="1.9" fill="#1B1530" />
      </svg>
      {n !== undefined && <span className="-mt-1 min-w-[22px] rounded-full bg-white px-1.5 text-center font-display text-[13px] leading-[18px] text-[#1B1530] shadow">{n}</span>}
    </span>
  );
}
function Stars({ n, size = 18 }: { n: number; size?: number }) {
  return <span className="inline-flex gap-0.5">{[0, 1, 2].map((i) => <Star key={i} style={{ width: size, height: size }} className={i < n ? "fill-[#FFD23F] text-[#FFB000] drop-shadow" : "fill-black/10 text-black/20"} />)}</span>;
}
function Btn({ children, onClick, big, tone = "sun", className = "", disabled, label }: { children: React.ReactNode; onClick?: () => void; big?: boolean; tone?: "sun" | "glass" | "mint" | "rose"; className?: string; disabled?: boolean; label?: string }) {
  const tones = {
    sun: "bg-gradient-to-b from-[#FFE066] to-[#FFB000] text-[#3A2600] shadow-[0_6px_0_#B07400,0_10px_24px_rgba(0,0,0,0.3)]",
    mint: "bg-gradient-to-b from-[#8CF5B5] to-[#20C997] text-[#053B27] shadow-[0_6px_0_#0B8A5F,0_10px_24px_rgba(0,0,0,0.3)]",
    rose: "bg-gradient-to-b from-[#FF9FB8] to-[#FF4D6D] text-white shadow-[0_6px_0_#B8243F,0_10px_24px_rgba(0,0,0,0.3)]",
    glass: "bg-white/20 text-white ring-1 ring-white/35 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.2)]",
  };
  return (
    <motion.button type="button" aria-label={label} whileTap={{ scale: 0.93, y: 3 }} disabled={disabled} onClick={() => { audio.play("a:click", { gain: 0.4, duck: false }); onClick?.(); }}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-2xl font-display tracking-wide disabled:opacity-40 ${big ? "px-8 py-4 text-2xl" : "px-4 py-2.5 text-base"} ${tones[tone]} ${className}`}>
      {children}
    </motion.button>
  );
}
function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex items-end justify-center bg-black/45 sm:items-center" onClick={onClose}>
      <motion.div initial={{ y: 240 }} animate={{ y: 0 }} exit={{ y: 240 }} onClick={(e) => e.stopPropagation()} className="max-h-[88dvh] w-full max-w-[460px] overflow-y-auto rounded-t-[28px] bg-[#FFFDF6] px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4 text-[#1B1530] sm:rounded-[28px]">
        {children}
      </motion.div>
    </motion.div>
  );
}
function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 pb-3 pt-[max(env(safe-area-inset-top),56px)]">
      <Btn tone="glass" onClick={onBack} label="Back"><ArrowLeft className="size-5" /></Btn>
      <div className="font-display text-2xl">{title}</div>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}
const Pill = ({ children }: { children: React.ReactNode }) => <div className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">{children}</div>;
const mechText = (keys: string[] | undefined) => keys?.length ? keys.map((m) => LABS.find((l) => l.mech === m)?.idea ?? m).join(" · ") : "";

export default function SlurpApp({ title }: { slug: string; title: string }) {
  const ready = useSlurpHydrated();
  const save = useSlurp();
  const coins = useProfile((p) => p.coins);
  const { setImmersive, setLoading, setInRound, setMenu, paused } = usePlayer();
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<Run | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [titleStage, setTitleStage] = useState<Stage | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [clear, setClear] = useState<Clear | null>(null);
  const [card, setCard] = useState<{ head: string; name: string; tip?: string; mech?: string } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [coach, setCoach] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [settings, setSettingsOpen] = useState(false);
  const [mapLab, setMapLab] = useState(0);
  const [busy, setBusy] = useState("");
  const [booster, setBooster] = useState<"" | "shrink" | "lift" | "lift2">("");
  const [err, setErr] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const [titleEl, setTitleEl] = useState<HTMLDivElement | null>(null);
  const topBar = useRef<HTMLDivElement>(null), bottomBar = useRef<HTMLDivElement>(null);
  const sess = useRef<SlurpSession | null>(null), titleSess = useRef<SlurpSession | null>(null);
  const runRef = useRef<Run | null>(null);
  const stickers = useRef<string[]>([]);
  const liftFrom = useRef(-1);
  const askHintRef = useRef<() => void>(() => {});
  const quality = save.settings.quality === "auto" ? autoQuality() : save.settings.quality;
  const coarse = useMemo(() => isPhone(), []);
  const today = useMemo(() => dayNumber(), []);
  const mutation = useMemo(() => mutationOf(), []);
  const say = useCallback((text: string) => setToast({ id: Date.now() + Math.random(), text }), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast((x) => (x?.id === toast.id ? null : x)), 2300); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { runRef.current = run; }, [run]);

  // ---------------------------------------------------------------- loading
  // once per mount: the player's setLoading changes identity whenever the shell re-renders (pause, immersive …), so
  // keying this on it re-ran the boot on every stage start / clear (a splash flash and the title music mid-stage)
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    let live = true;
    loadRef.current(0.2, "Filling the lab");
    void audio.preload([...UI_SOUNDS, ...SLURP_SFX], [music("title")]);
    void audio.playMusic(music("title"));
    loadStage(10).then((st) => { if (live) setTitleStage(st); })
      .catch(() => { if (live) setErr("The lab couldn't load. Check your connection and try again."); });
    return () => { live = false; };
  }, []);
  useEffect(() => { if (titleStage || err) setLoading(null); }, [titleStage, err, setLoading]);
  useEffect(() => { setImmersive(screen === "game"); setInRound(screen === "game"); }, [screen, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => { sess.current?.pause(paused); titleSess.current?.pause(paused); }, [paused]);
  useEffect(() => { if (screen === "title" || screen === "map" || screen === "wardrobe" || screen === "album") void audio.playMusic(music("title")); }, [screen]);

  useEffect(() => {
    if (screen !== "title" || !titleStage || !titleEl) return;
    const s = new SlurpSession(titleEl, { st: titleStage, lab: labOf(titleStage.n), quality: quality === "high" ? "medium" : quality, attract: true, look: save.look });
    const shortScreen = titleEl.clientHeight <= 520 && titleEl.clientWidth > titleEl.clientHeight;
    s.setInsets(titleEl.clientHeight * (shortScreen ? 0.2 : 0.36), titleEl.clientHeight * (shortScreen ? 0.44 : 0.3));
    titleSess.current = s;
    return () => { s.dispose(); titleSess.current = null; };
  }, [screen, titleStage, titleEl, quality, save.look]);

  // ---------------------------------------------------------------- a stage
  const onEvent = useCallback((e: SlurpEvent) => {
    if (e.t === "stuck") say("Stuck! Undo, restart — or ask Prof. Hoot.");
    if (e.t === "burnt") say("A fuse burned out! Undo and slurp it sooner.");
    if (e.t === "seal") setCoach(null);
    if (e.t === "fx" && e.e.t === "unlock") say("Unlocked!");
    if (e.t === "fx" && e.e.t === "wake") say("A sleeper woke up!");
    if (e.t === "slurp") {
      const st = sess.current?.st; if (!st) return;
      for (const c of e.cells) {
        const b = st.blobs[c], f = st.bflags?.[c] ?? 0;
        stickers.current.push(b === RAINBOW ? "rainbow" : `c${b >= 0 ? b : e.color}`);
        if (f & BF.DOUBLE) stickers.current.push("double");
        if (f & BF.BUBBLE) stickers.current.push("bubble");
        if (f & BF.FROST) stickers.current.push("frost");
        if (f & BF.BOMB) stickers.current.push("bomb");
        if (f & BF.FUSE) stickers.current.push("fuse");
      }
    }
  }, [say]);

  const startStage = useCallback((st: Stage, r: Run) => {
    setStage(st); setHud(null); setClear(null); setCoach(null); setBooster("");
    setRun(r);
    stickers.current = [];
    const s = stageIn(st.n);
    const head = r.mode === "daily" ? `DAILY BRAIN JAR · ${mutation.name.toUpperCase()}`
      : r.mode === "endless" ? `ENDLESS LAB ${st.n - CAMPAIGN} · ${mutation.name.toUpperCase()}`
      : r.mode === "rush" ? `EXAM RUSH · ${(r.rush?.k ?? 0) + 1} OF ${RUSH_EXAMS}`
      : `${r.lab.name.toUpperCase()} · ${s}${st.kind === "exam" ? " · EXAM" : st.kind === "big" ? " · BIG TRAY" : ""}`;
    const coachNext = st.n === 1 && r.mode === "campaign" && !useSlurp.getState().tutorialSeen;
    const mech = mechText(st.mech);
    setCard({ head, name: st.name, tip: coachNext ? undefined : st.tip, mech: mech && s !== 1 ? `Twists: ${mech}` : undefined });
    setTimeout(() => setCard((c) => (c && c.name === st.name ? null : c)), coachNext ? 1500 : st.tip ? 4200 : 2800);
    setScreen("game");
    void audio.playMusic(music(r.mode === "rush" || st.kind === "exam" ? "exam" : r.lab.music));
    audio.warmMusic([music("exam")]);
  }, [mutation.name]);

  const begin = useCallback(async (n: number) => {
    setErr("");
    try {
      const st = await loadStage(n);
      useSlurp.getState().setNext(n);
      startStage(st, { key: Date.now(), n, mode: "campaign", lab: labOf(n) });
      if (n < CAMPAIGN) { audio.prepareMusic(music(stageIn(n + 1) === 20 ? "exam" : labOf(n + 1).music)); void loadFile(Math.floor(n / 100) + 1).catch(() => {}); }
    } catch { setErr("This stage couldn't load. Check your connection and try again."); setScreen("title"); }
  }, [startStage]);
  const beginGen = useCallback(async (n: number, mode: "endless" | "daily") => {
    setErr(""); setBusy(mode === "daily" ? "Mixing today's Brain Jar…" : "Prof. Hoot is building a new tray…");
    const g = await generated(n, useSlurp.getState().seen);
    pending.delete(n);
    setBusy("");
    if (!g) { setErr("Couldn't build that tray — try again."); setScreen("title"); return; }
    startStage(g.st, { key: Date.now(), n, mode, lab: labFor(n), fp: g.fp });
    if (mode === "endless") void generated(n + 1, useSlurp.getState().seen); // the next tray is ready before you need it
  }, [startStage]);
  const beginRush = useCallback(async (list: number[], k: number, cleared: number) => {
    try { const st = await loadStage(list[k]); startStage(st, { key: Date.now(), n: list[k], mode: "rush", lab: labOf(list[k]), rush: { list, k, cleared } }); }
    catch { setErr("This stage couldn't load. Check your connection and try again."); setScreen("title"); }
  }, [startStage]);

  const onFinish = useCallback((r: SlurpResult) => {
    const ru = runRef.current; if (!ru) return;
    useSlurp.getState().stick(stickers.current); stickers.current = [];
    audio.play(r.stars === 3 ? "a:levelup" : "a:ding", { gain: 0.7 });
    if (ru.mode === "campaign") {
      const res = useSlurp.getState().finish(r.n, r.stars, r.moves);
      const exam = stageIn(r.n) === 20, last = r.n >= CAMPAIGN;
      setClear({
        r, coins: res.coins, title: exam ? "Exam passed!" : r.stars === 3 ? "Perfect slurp!" : "Tray cleared!",
        sub: exam ? `🏅 ${labOf(r.n).name} badge! ${last ? "Every lab is cleared — the Endless Lab never ends." : `${labOf(r.n + 1).name} is open: ${labOf(r.n + 1).idea}.`}` : undefined,
        next: last ? () => void beginGen(useSlurp.getState().endless, "endless") : () => void begin(r.n + 1), nextLabel: last ? "Endless Lab" : "Next",
      });
    } else if (ru.mode === "endless") {
      const c = useSlurp.getState().finishEndless(r.n, r.stars, ru.fp ?? "");
      setClear({ r, coins: c, title: r.stars === 3 ? "Perfect slurp!" : "Tray cleared!", next: () => void beginGen(r.n + 1, "endless"), nextLabel: "Next tray" });
    } else if (ru.mode === "daily") {
      const d = useSlurp.getState().finishDaily(r.n - DAILY_BASE, r.stars);
      setClear({ r, coins: d.coins, title: "Brain Jar cleared!", sub: d.first ? `🔥 Streak ${d.streak} — a new jar comes tomorrow.` : "Today's reward is already yours — a new jar comes tomorrow!" });
    } else if (ru.mode === "rush" && ru.rush) {
      const { list, k, cleared } = ru.rush, done = cleared + 1;
      if (k + 1 < list.length) setClear({ r, coins: 0, title: `Exam ${k + 1} of ${list.length} passed!`, next: () => void beginRush(list, k + 1, done), nextLabel: "Next exam" });
      else { const c = useSlurp.getState().finishRush(done); setClear({ r, coins: c, title: "Exam Rush complete!", sub: `All ${done} exams in a row. Prof. Hoot is impressed.` }); }
    }
    setScreen("clear");
  }, [begin, beginGen, beginRush]);

  const inGame = screen === "game" || screen === "clear";
  useEffect(() => {
    if (!inGame || !stage || !run || !host.current) return;
    const el = host.current;
    const s = new SlurpSession(el, { st: stage, lab: run.lab, quality, vibrate: save.settings.vibrate, look: useSlurp.getState().look, onHud: setHud, onEvent, onFinish, onHintKey: () => askHintRef.current() });
    sess.current = s;
    const fit = () => {
      const r0 = el.getBoundingClientRect(), tb = topBar.current?.getBoundingClientRect(), bb = bottomBar.current?.getBoundingClientRect();
      if (el.clientHeight <= 520 && el.clientWidth > el.clientHeight) s.setInsets(8, 8, (tb ? tb.right - r0.left : 0) + 8, (bb ? r0.right - bb.left : 0) + 8);
      else s.setInsets((tb ? tb.bottom - r0.top : 120) + 6, (bb ? r0.bottom - bb.top : 90) + 6);
    };
    fit();
    const ro = new ResizeObserver(fit); if (topBar.current) ro.observe(topBar.current); if (bottomBar.current) ro.observe(bottomBar.current);
    let t = 0;
    if (stage.n === 1 && run.mode === "campaign" && !useSlurp.getState().tutorialSeen && stage.solution.length) {
      t = window.setTimeout(() => {
        const g = stage.solution[0], q = stage.slurpers[g.i];
        let x = q.x, y = q.y; for (const ch of g.dirs) { const k = "URDL".indexOf(ch); x += [0, 1, 0, -1][k]; y += [-1, 0, 1, 0][k]; }
        const [x0, y0] = s.r.screenOf(q.x + q.cells[0][0], q.y + q.cells[0][1]), [x1, y1] = s.r.screenOf(x + q.cells[0][0], y + q.cells[0][1]);
        setCoach({ x0, y0, x1, y1 });
      }, 1700);
    }
    return () => { clearTimeout(t); ro.disconnect(); s.dispose(); sess.current = null; };
  }, [inGame, stage, run, quality, save.settings.vibrate, onEvent, onFinish]);
  useEffect(() => { if (coach === null && stage?.n === 1 && screen === "game" && hud && hud.moves > 0 && !save.tutorialSeen) useSlurp.getState().seeTutorial(); }, [coach, stage, screen, hud, save.tutorialSeen]);

  const toMap = useCallback((n: number) => { setMapLab(labOf(Math.min(Math.max(1, n), CAMPAIGN)).n - 1); setScreen("map"); }, []);
  useEffect(() => {
    if (screen !== "game" || !run) { setMenu([]); return; }
    setMenu([
      { id: "restart", label: "Restart stage", icon: "↻", onSelect: () => sess.current?.restart() },
      run.mode === "campaign" ? { id: "map", label: "Lab map", icon: "🗺️", onSelect: () => toMap(run.n) } : { id: "home", label: "Leave this tray", icon: "🏠", onSelect: () => setScreen("title") },
    ]);
  }, [screen, run, setMenu, toMap]);

  const askHint = useCallback(async () => {
    const s = sess.current; if (!s) return;
    if (!useSlurp.getState().useHint()) {
      if (!useSlurp.getState().buyHints(HINT_PRICE, 3)) { say(`Hints cost ${HINT_PRICE} coins for 3 — clear stages to earn coins!`); return; }
      useSlurp.getState().useHint(); say(`Bought 3 hints for ${HINT_PRICE} coins`);
    }
    const r = await s.hint();
    if (r === "dead") say("Hmm… this tray can't be cleared from here. Undo a move or two!");
    else if (r === "none") say("Prof. Hoot is thinking… try Undo once and ask again.");
  }, [say]);
  useEffect(() => { askHintRef.current = () => void askHint(); }, [askHint]);

  // boosters: the next tap on the board picks what they act on
  useEffect(() => {
    const s = sess.current; if (!s) return;
    if (!booster) { s.tapMode = null; return; }
    s.tapMode = (cell) => {
      if (booster === "shrink") {
        const i = s.slurperAt(cell);
        if (i < 0) { say("Tap a Slurper"); return; }
        if (!useProfile.getState().spendCoins(SHRINK_PRICE)) { say(`Shrink costs ${SHRINK_PRICE} coins`); setBooster(""); return; }
        if (!s.boosterShrink(i)) { useProfile.getState().earnCoins(SHRINK_PRICE); say("That Slurper can't shrink"); }
        setBooster("");
      } else if (booster === "lift") {
        if (cell < 0 || s.s.blobs[cell] < 0) { say("Tap a Gloopy to lift"); return; }
        liftFrom.current = cell; setBooster("lift2"); say("Now tap an empty cell");
      } else {
        if (!useProfile.getState().spendCoins(LIFT_PRICE)) { say(`Lift costs ${LIFT_PRICE} coins`); setBooster(""); return; }
        if (!s.boosterLift(liftFrom.current, cell)) { useProfile.getState().earnCoins(LIFT_PRICE); say("It can't go there"); }
        setBooster("");
      }
    };
    return () => { s.tapMode = null; };
  }, [booster, say, stage, run]);

  const passedExams = useMemo(() => Object.keys(save.best).map(Number).filter((n) => n % 20 === 0 && n <= CAMPAIGN), [save.best]);
  const startRush = useCallback(() => {
    if (passedExams.length < RUSH_EXAMS) { say(`Pass ${RUSH_EXAMS} of Hoot's Exams to open Exam Rush`); return; }
    const list = [...passedExams].sort(() => Math.random() - 0.5).slice(0, RUSH_EXAMS).sort((a, b) => a - b);
    void beginRush(list, 0, 0);
  }, [passedExams, beginRush, say]);

  if (!ready) return <div className="absolute inset-0 bg-[#2C3FB8]" />;
  const stars = totalStars(save.best);
  const endlessOpen = save.unlocked > ENDLESS_AFTER;
  const rushOpen = passedExams.length >= RUSH_EXAMS;
  const dailyDone = save.daily.day === today && save.daily.cleared;
  const boostersOn = !!run && (run.mode === "endless" || (run.mode === "campaign" && stage?.kind !== "exam"));
  const modeBtn = "flex-col !gap-0.5 !px-2 !py-2 text-xs";
  const label = !run || !stage ? "" : run.mode === "campaign" ? `${run.lab.name} ${stageIn(stage.n)}` : run.mode === "daily" ? "Daily Jar" : run.mode === "rush" ? `Exam Rush ${(run.rush?.k ?? 0) + 1}/${RUSH_EXAMS}` : `Endless ${stage.n - CAMPAIGN}`;

  return (
    <div className="absolute inset-0 select-none overflow-hidden bg-[#2C3FB8] font-sans text-white" style={{ WebkitTapHighlightColor: "transparent", overscrollBehavior: "none" }}>
      <AnimatePresence mode="wait">
        {screen === "title" && (
          <motion.div key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
            <div ref={setTitleEl} className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-[#1d2a8a]/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-[#1d2a8a]/85 to-transparent" />
            <div className="absolute inset-x-0 top-0 flex flex-col items-center px-5 pt-[max(env(safe-area-inset-top),56px)] text-center [@media(max-height:520px)]:pt-[max(env(safe-area-inset-top),8px)]">
              <motion.div initial={{ y: -20, scale: 0.9 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}
                className="font-display text-[clamp(44px,13vw,84px)] leading-none tracking-wide [@media(max-height:520px)]:text-[44px] text-white [text-shadow:0_4px_0_#3B5BDB,0_8px_0_#1C2A6B,0_14px_30px_rgba(0,0,0,0.45)]">
                Slurp <span className="text-[#FFD23F]">Lab</span>
              </motion.div>
              <div className="mt-2 rounded-full bg-white/20 px-4 py-1 text-sm font-semibold backdrop-blur-md [@media(max-height:520px)]:hidden">A 3D brain puzzle with Prof. Hoot · 30 labs · 600 trays + Endless</div>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-5 pb-[max(env(safe-area-inset-bottom),20px)] [@media(max-height:520px)]:gap-2 [@media(max-height:520px)]:pb-[max(env(safe-area-inset-bottom),10px)]">
              {err && <div className="rounded-2xl bg-[#FF4D6D]/90 px-4 py-2 text-sm font-semibold">{err}</div>}
              {busy && <div className="animate-pulse rounded-2xl bg-black/30 px-4 py-2 text-sm font-semibold backdrop-blur">{busy}</div>}
              <Btn big onClick={() => void begin(Math.min(save.next, save.unlocked))} disabled={!titleStage || !!busy} className="[@media(max-height:520px)]:!py-2.5 [@media(max-height:520px)]:!text-xl">
                <Play className="size-7 fill-current" /> {save.plays ? `PLAY ${labOf(save.next).n}-${stageIn(save.next)}` : "PLAY"}
              </Btn>
              <div className="grid w-full max-w-[420px] grid-cols-3 gap-2 [@media(max-height:520px)]:max-w-[700px] [@media(max-height:520px)]:grid-cols-6">
                <Btn tone="glass" disabled={!!busy} onClick={() => void beginGen(DAILY_BASE + today, "daily")} className={modeBtn}><CalendarDays className="size-5" />{dailyDone ? `Daily ✓ 🔥${save.daily.streak}` : "Daily Jar"}</Btn>
                <Btn tone="glass" disabled={!!busy} onClick={() => (endlessOpen ? void beginGen(save.endless, "endless") : say("The Endless Lab opens after Lab 10"))} className={modeBtn}>{endlessOpen ? <InfinityIcon className="size-5" /> : <Lock className="size-5" />}Endless</Btn>
                <Btn tone="glass" disabled={!!busy} onClick={startRush} className={modeBtn}>{rushOpen ? <Timer className="size-5" /> : <Lock className="size-5" />}Exam Rush</Btn>
                <Btn tone="glass" onClick={() => toMap(save.next)} className={modeBtn}><MapIcon className="size-5" />Labs</Btn>
                <Btn tone="glass" onClick={() => setScreen("wardrobe")} className={modeBtn}><Shirt className="size-5" />Wardrobe</Btn>
                <Btn tone="glass" onClick={() => setScreen("album")} className={modeBtn}><BookOpen className="size-5" />Album</Btn>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-white/90">
                <span className="inline-flex items-center gap-1"><Star className="size-4 fill-[#FFD23F] text-[#FFB000]" />{stars}/{CAMPAIGN * 3}</span>
                <span className="inline-flex items-center gap-1"><CoinIcon size={16} />{coins}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs" title={mutation.text}>🧪 {mutation.name}</span>
                <button type="button" aria-label="Settings" onClick={() => setSettingsOpen(true)} className="rounded-full bg-white/20 p-1.5"><Settings2 className="size-4" /></button>
              </div>
            </div>
          </motion.div>
        )}

        {screen === "map" && (
          <motion.div key="map" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="absolute inset-0 flex flex-col" style={{ background: `linear-gradient(180deg, ${LABS[mapLab].sky[1]}, ${LABS[mapLab].sky[0]})` }}>
            <Header title="The Labs" onBack={() => setScreen("title")} right={<Pill><Star className="size-4 fill-[#FFD23F] text-[#FFB000]" />{stars}</Pill>} />
            <LabStrip mapLab={mapLab} unlocked={save.unlocked} onPick={setMapLab} />
            <LabPanel lab={LABS[mapLab]} unlocked={save.unlocked} best={save.best} onPlay={(n) => void begin(n)} />
          </motion.div>
        )}

        {screen === "wardrobe" && (
          <motion.div key="wardrobe" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col bg-gradient-to-b from-[#6F8CFF] to-[#2C3FB8]">
            <Header title="Lab Wardrobe" onBack={() => setScreen("title")} right={<Pill><CoinIcon size={16} />{coins}</Pill>} />
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
              {([["Slurper glass", SKINS, "skin"], ["Gloopy hats", HATS, "hat"]] as const).map(([head, items, key]) => (
                <div key={key} className="mb-5">
                  <div className="mb-2 font-display text-lg">{head}</div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {items.map((it) => {
                      const own = save.owned.includes(it.id), on = save.look[key] === it.id;
                      return (
                        <motion.button key={it.id} type="button" whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            audio.play("a:click", { gain: 0.4, duck: false });
                            if (own) useSlurp.getState().setLook({ [key]: it.id });
                            else if (useSlurp.getState().buy(it.id, it.price)) { useSlurp.getState().setLook({ [key]: it.id }); audio.play("a:coin", { gain: 0.6 }); say(`${it.name} is yours!`); }
                            else say(`You need ${it.price} coins`);
                          }}
                          className={`rounded-2xl p-3 text-left font-display shadow-lg ${on ? "bg-white text-[#1C2A6B] ring-4 ring-[#FFD23F]" : "bg-white/85 text-[#1B1530]"}`}>
                          <div className="text-base">{it.name}</div>
                          <div className="mt-1 text-sm opacity-70">{on ? "Wearing" : own ? "Tap to wear" : <span className="inline-flex items-center gap-1"><CoinIcon size={14} />{it.price}</span>}</div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="rounded-2xl bg-white/15 px-3 py-2 text-sm font-semibold">Your look shows on every tray: the title, the campaign, Endless and the Daily Jar.</div>
            </div>
          </motion.div>
        )}

        {screen === "album" && (
          <motion.div key="album" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col bg-gradient-to-b from-[#FF7EB6] to-[#8E2DA8]">
            <Header title="Gloopy Album" onBack={() => setScreen("title")} right={<Pill>{STICKERS.filter((s) => save.album[s.key]).length}/{STICKERS.length}</Pill>} />
            <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-3 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),20px)] sm:grid-cols-4">
              {STICKERS.map((s, i) => {
                const n = save.album[s.key] ?? 0;
                return (
                  <div key={s.key} className={`flex flex-col items-center rounded-2xl p-3 text-center shadow-lg ${n ? "bg-white text-[#1B1530]" : "bg-white/15 text-white/70"}`}>
                    {n ? <GloopyDot color={i < 8 ? i : s.key === "rainbow" ? RAINBOW : (i % 8)} size={44} /> : <Lock className="my-2 size-7" />}
                    <div className="mt-1 font-display text-sm">{s.name}</div>
                    <div className="text-xs opacity-70">{n ? `×${n}` : "Not found yet"}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------ the game */}
      {(screen === "game" || screen === "clear") && stage && run && (
        <div className="absolute inset-0">
          <div ref={host} key={run.key} className="absolute inset-0" />
          <div ref={topBar} className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),58px)] [@media(max-height:520px)]:right-auto [@media(max-height:520px)]:w-[214px] [@media(max-height:520px)]:items-start [@media(max-height:520px)]:pl-[max(env(safe-area-inset-left),10px)] [@media(max-height:520px)]:pt-[max(env(safe-area-inset-top),10px)]">
            <div className="flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-[13px] font-semibold backdrop-blur-md [@media(max-height:520px)]:flex-wrap [@media(max-height:520px)]:rounded-2xl">
              <span className="max-w-[40vw] truncate font-display tracking-wide">{label}</span>
              <span className="opacity-60">·</span>
              <span>Moves <b className="font-display text-[15px]">{hud?.moves ?? 0}</b></span>
              <span className="opacity-60">·</span>
              <span>Par <b className="font-display text-[15px] text-[#FFD23F]">{stage.m.par}</b></span>
              {hud?.fuse !== undefined && <span className={`rounded-full px-2 font-display text-[12px] ${hud.fuse <= 1 ? "animate-pulse bg-[#FF3B5C]" : "bg-[#FF7A1A]"}`}>🧨 {Math.max(0, hud.fuse)}</span>}
            </div>
            <div className="flex max-w-full flex-wrap justify-center gap-1.5 rounded-3xl bg-white/18 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-md">
              {(hud?.left ?? []).map((c) => <motion.div key={c.color} animate={{ scale: c.n === 0 ? 0.85 : 1, opacity: c.n === 0 ? 0.45 : 1 }}><GloopyDot color={c.color} n={c.n} size={coarse ? 24 : 28} /></motion.div>)}
            </div>
          </div>
          <div ref={bottomBar} className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-2 px-3 pb-[max(env(safe-area-inset-bottom),14px)] [@media(max-height:520px)]:left-auto [@media(max-height:520px)]:grid [@media(max-height:520px)]:grid-cols-2 [@media(max-height:520px)]:pr-[max(env(safe-area-inset-right),10px)] [@media(max-height:520px)]:pb-[max(env(safe-area-inset-bottom),10px)]">
            <Btn tone="glass" onClick={() => sess.current?.undo()} disabled={!hud?.canUndo} className={`min-w-[60px] ${modeBtn}`} label="Undo"><Undo2 className="size-6" />Undo</Btn>
            <Btn tone="glass" onClick={() => sess.current?.restart()} className={`min-w-[60px] ${modeBtn}`} label="Restart"><RotateCcw className="size-6" />Restart</Btn>
            {boostersOn && <Btn tone={booster === "shrink" ? "rose" : "glass"} onClick={() => setBooster(booster === "shrink" ? "" : "shrink")} className={`min-w-[60px] ${modeBtn}`} label="Shrink booster"><Minus className="size-6" />Shrink</Btn>}
            {boostersOn && <Btn tone={booster.startsWith("lift") ? "rose" : "glass"} onClick={() => setBooster(booster.startsWith("lift") ? "" : "lift")} className={`min-w-[60px] ${modeBtn}`} label="Lift booster"><Move className="size-6" />Lift</Btn>}
            <Btn tone="sun" onClick={() => void askHint()} className={`relative min-w-[60px] ${modeBtn}`} label="Hint">
              <Lightbulb className="size-6" />Hint
              <span className="absolute -right-2 -top-2 grid min-w-[22px] place-items-center rounded-full bg-[#FF4D6D] px-1 text-[12px] leading-[22px] text-white shadow">{save.hints > 0 ? save.hints : <CoinIcon size={14} />}</span>
            </Btn>
          </div>
          {booster && screen === "game" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),14px)+92px)] mx-auto w-fit max-w-[92vw] rounded-full bg-[#FF4D6D] px-4 py-2 text-center text-sm font-semibold shadow-xl">
              {booster === "shrink" ? `Shrink · ${SHRINK_PRICE} coins: tap a Slurper (−1 need)` : booster === "lift" ? `Lift · ${LIFT_PRICE} coins: tap a Gloopy` : "Now tap an empty cell"} · 2 stars max
            </div>
          )}
          <AnimatePresence>
            {card && screen === "game" && (
              <motion.div key={card.name + card.head} initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="pointer-events-none absolute inset-x-0 top-[32%] mx-auto w-[min(88vw,420px)] rounded-3xl bg-white/94 px-5 py-4 text-center text-[#1B1530] shadow-2xl">
                <div className="font-display text-xs tracking-[0.18em] text-[#5C7CFA]">{card.head}</div>
                <div className="font-display text-3xl leading-tight">{card.name}</div>
                {card.mech && <div className="mt-1 text-xs font-semibold text-[#8E2DA8]">{card.mech}</div>}
                {card.tip && <div className="mt-2 flex items-start gap-2 text-left text-sm font-semibold"><span className="text-xl">🦉</span><span>{card.tip}</span></div>}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {hud?.stuck && screen === "game" && !booster && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),14px)+92px)] mx-auto flex w-[min(90vw,420px)] items-center gap-3 rounded-2xl bg-[#FF4D6D] px-4 py-3 shadow-xl">
                <span className="text-2xl">🦉</span>
                <div className="flex-1 text-sm font-semibold leading-snug">{hud.fuse !== undefined && hud.fuse <= 0 ? "A fuse burned out. Undo and slurp it sooner." : "No Slurper can finish its colour from here. Undo a move or restart."}</div>
                <Btn tone="glass" onClick={() => sess.current?.undo()} className="!px-3 !py-2 text-sm" label="Undo"><Undo2 className="size-4" /></Btn>
              </motion.div>
            )}
          </AnimatePresence>
          {coach && screen === "game" && (
            <div className="pointer-events-none absolute inset-0">
              <motion.div className="absolute text-5xl drop-shadow-xl" initial={{ x: coach.x0 - 10, y: coach.y0 - 6 }} animate={{ x: [coach.x0 - 10, coach.x1 - 10, coach.x1 - 10], y: [coach.y0 - 6, coach.y1 - 6, coach.y1 - 6], scale: [1, 0.92, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>👆</motion.div>
              <div className="absolute inset-x-0 top-[30%] mx-auto w-[min(86vw,380px)] rounded-2xl bg-white/94 px-4 py-3 text-center text-[15px] font-semibold text-[#1B1530] shadow-xl">🦉 Drag the Slurper onto the Gloopies of its colour!</div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {screen === "clear" && clear && run && (
          <motion.div key="clear" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-end justify-center bg-black/35 backdrop-blur-[2px] sm:items-center">
            <motion.div initial={{ y: 260 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 22 }} className="w-full max-w-[460px] rounded-t-[32px] bg-gradient-to-b from-[#FFFDF6] to-[#FFF1D6] px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-5 text-center text-[#1B1530] shadow-2xl sm:rounded-[32px]">
              <div className="font-display text-sm tracking-[0.2em] text-[#5C7CFA]">{run.mode === "campaign" ? `${run.lab.name.toUpperCase()} · ${stageIn(clear.r.n)}` : run.mode === "daily" ? "DAILY BRAIN JAR" : run.mode === "rush" ? "EXAM RUSH" : `ENDLESS LAB · ${clear.r.n - CAMPAIGN}`}</div>
              <div className="font-display text-4xl">{clear.title}</div>
              <div className="my-3 flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < clear.r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.25 + i * 0.22, type: "spring", stiffness: 260, damping: 12 }}>
                    <Star className={`size-14 ${i < clear.r.stars ? "fill-[#FFD23F] text-[#FFB000] drop-shadow-[0_4px_0_#C58A00]" : "fill-[#E9E3D3] text-[#D8CFBA]"}`} />
                  </motion.div>
                ))}
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 font-display">
                <div className="rounded-2xl bg-white py-2 shadow"><div className="text-2xl">{clear.r.moves}</div><div className="text-[11px] tracking-wider opacity-60">MOVES</div></div>
                <div className="rounded-2xl bg-white py-2 shadow"><div className="text-2xl text-[#E8A200]">{clear.r.par}</div><div className="text-[11px] tracking-wider opacity-60">PAR</div></div>
                <div className="rounded-2xl bg-white py-2 shadow"><div className="inline-flex items-center gap-1 text-2xl"><CoinIcon size={20} />{clear.coins}</div><div className="text-[11px] tracking-wider opacity-60">COINS</div></div>
              </div>
              {clear.r.stars < 3 && !clear.r.boosted && <div className="mb-3 text-sm font-semibold text-[#5A4F78]">Clear it in {clear.r.par} moves for 3 stars.</div>}
              {clear.r.boosted && <div className="mb-3 text-sm font-semibold text-[#5A4F78]">Boosters were used: 2 stars at most.</div>}
              {clear.sub && <div className="mb-3 rounded-2xl bg-[#5C7CFA]/15 px-3 py-2 font-display text-[#1C2A6B]">{clear.sub}</div>}
              <div className="flex gap-2.5">
                {(run.mode === "campaign" || run.mode === "endless") && (
                  <Btn tone="glass" onClick={() => (run.mode === "campaign" ? void begin(clear.r.n) : startStage(stage!, { ...run, key: Date.now() }))} className="flex-1 !bg-[#1C2A6B]/10 !text-[#1C2A6B] !ring-[#1C2A6B]/20"><RotateCcw className="size-5" /> Replay</Btn>
                )}
                {clear.next
                  ? <Btn onClick={clear.next} className="flex-[1.6]">{clear.nextLabel ?? "Next"} <ChevronRight className="size-6" /></Btn>
                  : <Btn tone="mint" onClick={() => setScreen("title")} className="flex-[1.6]"><Trophy className="size-5" /> Done</Btn>}
              </div>
              <button type="button" onClick={() => (run.mode === "campaign" ? toMap(clear.r.n) : setScreen("title"))} className="mt-3 text-sm font-semibold text-[#5A4F78] underline-offset-2 hover:underline">{run.mode === "campaign" ? "Lab map" : "Back to the lab"}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settings && (
          <Sheet onClose={() => setSettingsOpen(false)}>
            <div className="mb-3 flex items-center"><div className="font-display text-2xl">Settings</div><button type="button" aria-label="Close" onClick={() => setSettingsOpen(false)} className="ml-auto rounded-full bg-black/5 p-2"><X className="size-5" /></button></div>
            <div className="mb-2 text-sm font-semibold opacity-70">Graphics</div>
            <div className="mb-4 grid grid-cols-4 gap-2">
              {(["auto", "low", "medium", "high"] as const).map((q) => <button key={q} type="button" onClick={() => useSlurp.getState().setSettings({ quality: q })} className={`rounded-xl py-2 font-display text-sm capitalize ${save.settings.quality === q ? "bg-[#3B5BDB] text-white" : "bg-black/5"}`}>{q}</button>)}
            </div>
            <label className="mb-3 flex items-center justify-between rounded-xl bg-black/5 px-3 py-2.5 font-semibold">Vibration <input type="checkbox" className="size-5 accent-[#3B5BDB]" checked={save.settings.vibrate} onChange={(e) => useSlurp.getState().setSettings({ vibrate: e.target.checked })} /></label>
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-[#5C7CFA]/10 px-3 py-2.5 text-sm font-semibold"><CircleHelp className="mt-0.5 size-4 shrink-0" /><span>Drag a Slurper over Gloopies of its colour. Its number is how many it still drinks — at 0 it pops. Other colours block the way. Keys: Tab picks, arrows move, Z undo, R restart, H hint.</span></div>
            <div className="rounded-xl bg-[#8E2DA8]/10 px-3 py-2.5 text-sm font-semibold">🧪 This week&apos;s Lab Mutation: <b>{mutation.name}</b> — {mutation.text} (Endless Lab and Daily Jar).</div>
          </Sheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),58px)+92px)] z-40 mx-auto w-fit max-w-[90vw] rounded-full bg-[#1B1530]/85 px-4 py-2 text-center text-sm font-semibold shadow-xl backdrop-blur">{toast.text}</motion.div>
        )}
      </AnimatePresence>
      <h1 className="sr-only">{title}</h1>
    </div>
  );
}

function LabStrip({ mapLab, unlocked, onPick }: { mapLab: number; unlocked: number; onPick: (k: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.querySelector<HTMLElement>(`[data-lab="${mapLab}"]`)?.scrollIntoView({ inline: "center", block: "nearest" }); }, [mapLab]);
  return (
    <div ref={box} className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
      {LABS.map((l, k) => {
        const open = (l.n - 1) * 20 + 1 <= unlocked;
        return (
          <button key={l.n} data-lab={k} type="button" onClick={() => { audio.play("a:click", { gain: 0.35, duck: false }); onPick(k); }}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-2 font-display text-sm transition ${mapLab === k ? "bg-white text-[#1C2A6B]" : "bg-white/20 text-white/90"}`}>
            {!open && <Lock className="size-3.5" />}{l.n}. {l.name}
          </button>
        );
      })}
    </div>
  );
}

function LabPanel({ lab, unlocked, best, onPlay }: { lab: Lab; unlocked: number; best: Record<number, { stars: number }>; onPlay: (n: number) => void }) {
  const first = (lab.n - 1) * 20 + 1;
  const labStars = Array.from({ length: 20 }, (_, k) => best[first + k]?.stars ?? 0).reduce((a, b) => a + b, 0);
  const open = first <= unlocked;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
      <div className="mx-auto w-full max-w-[560px]">
      <div className="mb-4 overflow-hidden rounded-3xl p-4 shadow-xl" style={{ background: `linear-gradient(135deg, ${lab.sky[1]}, ${lab.tray})` }}>
        <div className="font-display text-xs tracking-[0.2em] text-white/85">LAB {lab.n} OF {LABS.length}</div>
        <div className="font-display text-3xl leading-tight [text-shadow:0_2px_0_rgba(0,0,0,0.2)]">{lab.name}</div>
        <div className="mt-1 text-sm font-semibold text-white">New: {lab.idea}</div>
        <div className="mt-1 text-xs font-semibold text-white/90">{lab.tip}</div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-black/20 px-3 py-1 text-sm font-semibold"><Star className="size-4 fill-[#FFD23F] text-[#FFB000]" />{labStars}/60</div>
      </div>
      {!open && <div className="mb-3 rounded-2xl bg-black/20 px-3 py-2 text-center text-sm font-semibold">Pass the exam of Lab {lab.n - 1} to open this lab.</div>}
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
        {Array.from({ length: 20 }, (_, k) => {
          const n = first + k, on = n <= unlocked, b = best[n];
          const exam = k === 19, big = k === 9;
          return (
            <motion.button key={n} type="button" whileTap={{ scale: 0.92 }} disabled={!on} onClick={() => { audio.play("a:click", { gain: 0.4, duck: false }); onPlay(n); }}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl font-display shadow-lg ${on ? (exam ? "bg-gradient-to-b from-[#FFE066] to-[#FFB000] text-[#3A2600]" : "bg-white/92 text-[#1B1530]") : "bg-white/15 text-white/50"}`}>
              {on ? <span className="text-2xl leading-none">{k + 1}</span> : <Lock className="size-5" />}
              {on && <span className="mt-1"><Stars n={b?.stars ?? 0} size={12} /></span>}
              {on && (exam || big) && <span className="absolute -top-2 rounded-full bg-[#FF4D6D] px-1.5 text-[10px] text-white">{exam ? "EXAM" : "BIG"}</span>}
            </motion.button>
          );
        })}
      </div>
      </div>
    </div>
  );
}
