"use client";
// Band Bend — a 3D line puzzle with rubber bands on a pegboard: every band is fixed at its two nails; stretch it onto
// pins to bend it, move a bend to another pin, or pull it off. Make the bands draw exactly the shape on the card. Stages
// never end and arrive one by one: 600 designed boards across twelve worlds (each with its own colours and music, a big
// board halfway and a finale), then endless remixes. Hard from early on: tight move limits and decoy bends.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronRight, Eye, Lightbulb, Play, Plus, RotateCcw, Shapes, Star, Undo2, X, Footprints } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { hookAt, matches, moveHook, progress, validBand, xy, type Band } from "../engine";
import { BAND_COLS, DESIGNED, STAGES_PER_WORLD, WORLDS, buildStage, passOf, planBand, plannedMove, worldOf, type Move, type StageDef } from "../stage";
import { useBand, useBandHydrated, type Game } from "../save";
import { BandScene, type Drag, type SceneSound } from "./Scene";
import { BAND_CSS } from "./styles";

export const BAND_SFX = ["grab", "stretch", "snap", "release", "denied", "hint", "undo", "peek", "clear", "star", "world", "lose", "open"] as const;
type Sfx = (typeof BAND_SFX)[number];
const sfxName = (k: Sfx) => `a:band_${k}` as Sound;
const music = (k: string) => `a:band_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  decoy: ["Wrong bends", "Some bands start hooked on the wrong pins. Drag a bend to the right pin — or pull it off into open space."],
  many: ["Which band is which?", "Any band may draw any part of the shape, but each one is stuck to its own two nails. Work out who draws what first."],
  boss: ["World finale", "The last board of every world is a big one. Finish it to open the next world."],
  remix: ["Endless boards", "You've finished all 600 designed boards! From here every stage is a fresh remix — new shapes, forever."],
};
interface Result { stage: number; stars: number; coins: number; worldDone: boolean; gift: string; used: number; lines: number }
const bandsOf = (d: StageDef, g: Game): Band[] => d.start.map((b, i) => ({ ...b, hooks: g.hooks[i].slice() }));

export default function BandApp({ slug }: { slug: string; title: string }) {
  const ready = useBandHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useBand((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "out" | "help" | "tip">("");
  const [tipKey, setTipKey] = useState("");
  const [toast, setToast] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BandScene | null>(null);
  const hist = useRef<Game[]>([]);
  const [histN, setHistN] = useState(0);
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  const applyPending = useCallback(() => { const sc = sceneRef.current, p = pendingRef.current; if (!sc || !p) return; pendingRef.current = null; sc.setStage(p.d.board.cols, p.d.board.rows, bandsOf(p.d, p.g), p.d.board.target, worldOf(p.d.stage)); }, []);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null);
  const stateRef = useRef({ result: false, sheet: "", paused: false });
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { result: !!result, sheet, paused }; }, [result, sheet, paused]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);
  const setG = useCallback((g: Game) => { setGame(g); gameRef.current = g; }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Stretching the bands");
    void audio.preload(BAND_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(worldOf(useBand.getState().stage).music)]);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.14, duck: k === "clear" || k === "world" });
  }, []);
  const persist = useCallback((g: Game) => { const d = defRef.current; if (!d) return; useBand.getState().saveCurrent({ stage: d.stage, game: g, revived: false }); }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback((g: Game) => {
    const d = defRef.current!;
    const stars = g.helped ? Math.min(2, g.used <= d.par ? 3 : 2) : g.used <= d.par ? 3 : g.used <= d.par + 1 ? 2 : 1;
    const lines = d.board.target.length;
    const coins = 4 + Math.round(lines / 2) + stars * 3 + (d.boss ? 20 : d.showcase ? 8 : 0);
    useProfile.getState().earnCoins(coins);
    useBand.getState().win(d.stage, stars, 1);
    let gift = "";
    const give = useBand.getState().giveBooster;
    if (d.boss) { give("hint", 2); give("peek", 2); give("undo", 3); gift = "+2 Hints · +2 Peeks · +3 Undos"; }
    else if (d.showcase) { give("undo", 3); gift = "+3 Undos"; }
    else if (d.stage % 10 === 0) { give(d.stage % 20 === 0 ? "peek" : "hint", 1); gift = d.stage % 20 === 0 ? "+1 Peek" : "+1 Hint"; }
    const worldDone = d.stage % STAGES_PER_WORLD === 0;
    sceneRef.current?.celebrate();
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, worldDone, gift, used: g.used, lines });
      sfx(worldDone ? "world" : "clear", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 1000);
    track("band_clear", { stage: d.stage, stars });
  }, [sfx]);

  // ---------------------------------------------------------------- drags
  /** apply one drag (from the scene, the hint or QA); false when the bend isn't allowed */
  const doMove = (m: Drag): boolean => {
    const g0 = gameRef.current, d = defRef.current, sc = sceneRef.current, st = stateRef.current;
    if (!g0 || !d || st.result || st.sheet || st.paused) return false;
    const bands = bandsOf(d, g0), b = bands[m.band];
    const nb = m.hook >= 0 ? moveHook(d.board, b, m.hook, m.pin) : m.pin >= 0 ? hookAt(d.board, b, m.seg, m.pin) : null;
    if (!nb || nb.hooks.length > 6 || !validBand(d.board, nb)) { buzz(30); return false; }
    hist.current = [...hist.current, g0].slice(-60); setHistN(hist.current.length);
    const g: Game = { ...g0, hooks: g0.hooks.map((h, i) => (i === m.band ? nb.hooks.slice() : h.slice())), used: g0.used + 1 };
    setG(g); buzz(8);
    bands[m.band] = nb;
    sc?.sync(bands);
    if (matches(d.board, bands)) { useBand.getState().saveCurrent(null); setTimeout(() => finishStage(g), 450); return true; }
    persist(g);
    if (g.used >= d.moves + (g.bonus ?? 0)) setTimeout(() => { setSheet("out"); sfx("lose", { gain: 0.55 }); }, 450);
    return true;
  };
  const moveRef = useRef<(m: Drag) => boolean>(() => false);
  useEffect(() => { moveRef.current = doMove; });

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const sc = new BandScene(host.current, {
      canPlay: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused; },
      drop: (m) => moveRef.current(m),
      sound: (e: SceneSound, pan: number) => {
        if (e === "stretch") sfx("stretch", { x: pan, gain: 0.22, rate: 0.9 + Math.random() * 0.25 });
        else sfx(e as Sfx, { x: pan, gain: e === "snap" ? 0.6 : 0.45 });
      },
    });
    sceneRef.current = sc;
    applyPending();
    return () => { sc.dispose(); sceneRef.current = null; };
  }, [screen, sfx, applyPending]);

  // ---------------------------------------------------------------- stages
  const start = useCallback((stage: number, resume?: { game: Game; revived: boolean }) => {
    const d = buildStage(stage);
    const g: Game = resume?.game && resume.game.hooks.length === d.start.length ? resume.game : { hooks: d.start.map((b) => b.hooks.slice()), used: 0, helped: false };
    setDef(d); defRef.current = d; setG(g); setResult(null); setSheet("");
    hist.current = []; setHistN(hist.current.length);
    setScreen("game");
    const w = worldOf(stage);
    void audio.playMusic(music(w.music));
    audio.warmMusic([music(worldOf(stage + STAGES_PER_WORLD).music)]);
    sfx("open", { gain: 0.45 });
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = useBand.getState().tips;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, boss: d.boss, decoy: d.start.some((b) => b.hooks.length), many: d.start.length >= 3 };
    const tip = ["remix", "boss", "decoy", "many"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useBand.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); } else setToast(`${w.name} · ${d.start.length} band${d.start.length > 1 ? "s" : ""} · ${d.moves} moves`);
    track("band_start", { stage });
  }, [sfx, applyPending, setG]);

  // ---------------------------------------------------------------- boosters
  /** the next drag: the stage's own plan while the bands are on it, else a fresh plan band by band */
  const nextMove = useCallback((): Move | null => {
    const g = gameRef.current, d = defRef.current; if (!g || !d) return null;
    const bands = bandsOf(d, g);
    const p = plannedMove(d, bands); if (p) return p;
    for (let i = 0; i < bands.length; i++) {
      const steps = planBand(d.board, bands[i], d.board.goal[i]);
      if (steps === null) {
        // off any plan: let a bend go first
        if (bands[i].hooks.length) return { band: i, kind: "move", i: bands[i].hooks.length - 1, pin: -1 };
        continue;
      }
      if (steps.length) return { ...steps[0], band: i };
    }
    return null;
  }, []);
  const doHint = () => {
    const d = defRef.current, sc = sceneRef.current; if (!d || !sc || result) return;
    const m = nextMove(); if (!m) { setToast("No hint here — try Undo"); return; }
    if (!useBand.getState().useBooster("hint")) { setToast("No hints left"); return; }
    const g = gameRef.current!; const g2 = { ...g, helped: true }; setG(g2); persist(g2);
    if (m.kind === "add") sc.showHint(m.band, m.seg, -1, m.pin); else sc.showHint(m.band, -1, m.i, m.pin);
    setToast(m.kind === "add" ? "Stretch this line onto the glowing pin" : m.pin < 0 ? "Pull this bend off" : "Move this bend");
    sfx("hint", { gain: 0.5 });
  };
  const doUndo = () => {
    const prev = hist.current[hist.current.length - 1], d = defRef.current;
    if (!prev || !d || result) { setToast("Nothing to undo"); return; }
    if (!useBand.getState().useBooster("undo")) { setToast("No undos left"); return; }
    hist.current = hist.current.slice(0, -1); setHistN(hist.current.length);
    // an undo gives the move back too
    const g = { ...prev, helped: true }; setG(g); setSheet("");
    sceneRef.current?.sync(bandsOf(d, g)); sfx("undo", { gain: 0.5 }); persist(g);
  };
  const doPeek = () => {
    const sc = sceneRef.current; if (!sc || result) return;
    if (!useBand.getState().useBooster("peek")) { setToast("No peeks left"); return; }
    sc.peek(3500); sfx("peek", { gain: 0.5 }); setToast("The shape, on the board…");
  };
  const doMore = () => { const g0 = gameRef.current; if (!g0 || g0.bonus) return; const g = { ...g0, bonus: 3, helped: true }; setG(g); setSheet(""); sfx("peek", { gain: 0.5 }); persist(g); };
  const doRestart = () => { const d = defRef.current; if (!d) return; useBand.getState().saveCurrent(null); start(d.stage); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __band?: unknown }).__band = {
      game: () => gameRef.current, def: () => defRef.current, start: (stage: number) => start(stage),
      next: () => nextMove(),
      move: (m: Move) => moveRef.current(m.kind === "add" ? { band: m.band, seg: m.seg, hook: -1, pin: m.pin } : { band: m.band, seg: -1, hook: m.i, pin: m.pin }),
      busy: () => sceneRef.current?.busy ?? false,
      pin: (p: number) => { const r = host.current?.getBoundingClientRect(), q = sceneRef.current?.pinScreen(p); return q && r ? { x: r.left + q.x, y: r.top + q.y } : null; },
      point: (b: number, seg: number, hook: number) => { const r = host.current?.getBoundingClientRect(), q = sceneRef.current?.pointScreen(b, seg, hook); return q && r ? { x: r.left + q.x, y: r.top + q.y } : null; },
    };
  }, [start, nextMove]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const w = worldOf(screen === "game" ? stage : useBand.getState().stage);
  const wi = Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length;
  const inS = ((stage - 1) % STAGES_PER_WORLD) + 1;
  const pr = def && game ? progress(def.board, bandsOf(def, game)) : { good: 0, stray: 0, total: 0 };
  const left = def && game ? Math.max(0, def.moves + (game.bonus ?? 0) - game.used) : 0;
  return (
    <div className="bnd-root" style={{ ["--s1" as string]: w.bg[0], ["--s2" as string]: w.bg[1], ["--paint" as string]: BAND_COLS[wi % BAND_COLS.length] }}>
      <style>{BAND_CSS}</style>
      <div className="bnd-bubbles" aria-hidden>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ left: `${(i * 41) % 100}%`, width: 14 + ((i * 13) % 26), height: 14 + ((i * 13) % 26), animationDuration: `${14 + (i % 5) * 4}s`, animationDelay: `${-i * 2.7}s` }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => start(st, resume)} />}

      {screen === "game" && def && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-start gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="bnd-amber grid size-11 shrink-0 place-items-center"><ArrowLeft className="size-5" /></button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <p className="bnd-display text-xl leading-none drop-shadow">Level {stage}{def.boss ? " · Finale" : def.showcase ? " · Big board" : ""}</p>
              <p className="text-[11px] font-bold opacity-85">{w.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_WORLD}</p>
              <div className="flex items-center gap-2"><span className={`bnd-chip ${left <= 2 ? "bnd-low" : ""}`}><Footprints className="size-3.5" /> {left} moves</span><span className="bnd-chip"><Shapes className="size-3.5" /> {pr.good}/{pr.total}{pr.stray ? ` · ${pr.stray} extra` : ""}</span></div>
            </div>
            <button type="button" aria-label="Restart" onClick={doRestart} className="bnd-amber grid size-11 shrink-0 place-items-center"><RotateCcw className="size-5" /></button>
          </div>
          <div className="flex justify-center pt-2"><TargetCard key={stage} d={def} /></div>
          <div className="relative min-h-0 flex-1"><div ref={host} className="bnd-stage" /></div>
          <div className="flex items-end justify-center gap-4 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Undo2} label="Undo" n={boosters.undo} onClick={doUndo} />
            <Tool icon={Lightbulb} label="Hint" n={boosters.hint} onClick={doHint} />
            <Tool icon={Eye} label="Peek" n={boosters.peek} onClick={doPeek} />
          </div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "out" && !result && (
          <Sheet key="out" title="Out of moves!" onClose={() => undefined}>
            <p className="opacity-85">{game?.bonus ? "Try the board again — work out which band draws each part first." : "Take 3 more moves — free, once per level."}</p>
            <div className="mt-4 grid gap-2">
              {!game?.bonus && <button type="button" className="bnd-btn bnd-cta bnd-shine py-3 text-lg" onClick={doMore}><Plus className="mr-1 inline size-5" /> +3 moves</button>}
              {histN > 0 && boosters.undo > 0 && <button type="button" className="bnd-btn bnd-soft py-3" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Undo ({boosters.undo})</button>}
              <button type="button" className="bnd-btn bnd-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useBand.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>✋ Grab a band anywhere along a line and stretch it onto a pin — it hooks round it.</li>
              <li>↔️ Grab a bend to move it to another pin, or pull it into open space to let it go.</li>
              <li>🎯 Make the bands draw exactly the shape on the card — no missing lines, no extra lines.</li>
              <li>📌 Each band stays stuck to its own two coloured nails. Moves are limited — Undo, Hint and Peek help.</li>
            </ul>
            <button type="button" className="bnd-btn bnd-cta mt-5 w-full py-3 text-lg" onClick={() => { useBand.getState().sawHelp(); setSheet(""); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useBand.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="bnd-btn bnd-cta mt-5 w-full py-3 text-lg" onClick={() => { useBand.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="bnd-pill pointer-events-none absolute bottom-28 left-1/2 z-50 -translate-x-1/2 text-sm whitespace-nowrap">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

/** the shape to make, drawn small on a white card: grey pin dots and thick navy lines */
function TargetCard({ d }: { d: StageDef }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { cols, rows, target } = d.board;
  const cell = Math.min(30, Math.floor(140 / Math.max(cols - 1, rows - 1.4)));
  const W = (cols - 1) * cell + 24, H = (rows - 1) * cell + 24;
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr; c.height = H * dpr; c.style.width = `${W}px`; c.style.height = `${H}px`;
    const g = c.getContext("2d")!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const at = (p: number) => { const [x, y] = xy(d.board, p); return [12 + x * cell, 12 + y * cell] as const; };
    g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#1e2a5a"; g.lineWidth = Math.max(3.5, cell * 0.2);
    for (const e of target) { const [a, b] = e.split("-").map(Number); const [ax, ay] = at(a), [bx, by] = at(b); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
    for (let p = 0; p < cols * rows; p++) { const [x, y] = at(p); g.fillStyle = "#b8c0d0"; g.beginPath(); g.arc(x, y, Math.max(2, cell * 0.09), 0, Math.PI * 2); g.fill(); }
    // the nails, in their band's colour
    for (const b of d.start) for (const p of [b.a, b.b]) { const [x, y] = at(p); g.fillStyle = BAND_COLS[b.color % BAND_COLS.length]; g.beginPath(); g.arc(x, y, Math.max(3.5, cell * 0.17), 0, Math.PI * 2); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.stroke(); }
  }, [d, W, H, cell, cols, rows, target]);
  return <div className="bnd-card bnd-pop"><span className="bnd-card-tag">Make this</span><canvas ref={ref} aria-label="Target shape" /></div>;
}

function Tool({ icon: Icon, label: text, n, onClick }: { icon: typeof Star; label: string; n?: number; onClick: () => void }) {
  return (
    <button type="button" className="bnd-tool" onClick={onClick}>
      <span className="bnd-tool-ico bnd-amber"><Icon className="size-6" />{n !== undefined && <span className="bnd-badge">{n}</span>}</span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bnd-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="bnd-display text-2xl">{title}</h2>
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
      <motion.div className="bnd-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="bnd-head px-5 pt-5 pb-4">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#fff3a0] text-white" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="bnd-display mt-1 text-3xl drop-shadow">{r.worldDone ? "World complete!" : "Shape made!"}</h2>
          <p className="mt-1 text-sm font-bold opacity-90">{r.worldDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD} · ${r.used} move${r.used === 1 ? "" : "s"}`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-bold opacity-75">{r.lines} lines drawn</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/50 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="bnd-btn bnd-cta bnd-shine flex items-center justify-center gap-2 py-3 text-lg" onClick={onNext}>Level {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="bnd-btn bnd-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  return (
    <div className="bnd-title" role="img" aria-label="Band Bend" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="bnd-word bnd-w1">{[..."BAND"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: BAND_COLS[i], animationDelay: `${i * 0.07}s, ${1 + i * 0.15}s` }}>{ch}</span>)}</div>
      <div className="bnd-word bnd-w2">{[..."BEND"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "#ffffff", animationDelay: `${0.4 + i * 0.07}s, ${1.4 + i * 0.15}s` }}>{ch}</span>)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = useBand();
  const stage = save.stage, w = worldOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const wi = Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length;
  const remix = passOf(stage) > 0;
  const at = (shown - 1) % STAGES_PER_WORLD;
  return (
    <div className="bnd-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Level"], [Star, String(save.totalStars), "Stars"], [Shapes, String(save.shapes), "Shapes"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="bnd-sheet flex items-center gap-2 !rounded-[18px] px-3 py-2.5 !shadow-none">
                <Icon className="size-6 shrink-0 text-[var(--paint)]" />
                <span className="min-w-0"><span className="bnd-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Band Bend — 3D line connect puzzle with rubber bands</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-bold opacity-95 drop-shadow sm:mx-auto">Stretch the rubber bands over the pins until they draw the shape on the card — every line, nothing extra.</p>

        <div className="bnd-sheet bnd-shine relative mt-3 overflow-hidden p-5">
          <p className="text-xs font-extrabold tracking-widest uppercase opacity-70">📌 {w.name}{remix ? " · Remix" : ""}</p>
          <p className="bnd-display mt-1 text-5xl leading-none">Level {shown}</p>
          <div className="bnd-bar mt-3"><b style={{ width: `${Math.round((at / STAGES_PER_WORLD) * 100)}%` }} /></div>
          <p className="mt-1 text-[11px] font-bold opacity-70">{at} of {STAGES_PER_WORLD} boards in this world</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="bnd-btn bnd-cta inline-flex items-center gap-2 px-7 py-3 text-xl"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useBand.getState().saveCurrent(null); onPlay(cur.stage); }} className="bnd-btn bnd-soft inline-flex items-center gap-1.5 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="bnd-btn bnd-cta inline-flex items-center gap-2 px-9 py-3.5 text-2xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="bnd-display text-[24px] leading-none drop-shadow">The worlds</h2>
          <span className="text-xs font-bold opacity-85">{STAGES_PER_WORLD} boards each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORLDS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_WORLD) > i || remix, now = i === wi;
            return (
              <div key={s.id} className={`rounded-2xl border-[3px] p-3 shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: now ? BAND_COLS[i % BAND_COLS.length] : "#ffffff", background: `linear-gradient(150deg, ${s.bg[0]}, ${s.bg[1]})`, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.35)" }}>
                <p className="text-[13px] font-extrabold">{s.name}</p>
                <p className="text-[11px] font-bold opacity-90">{now ? `board ${((stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}` : done ? "★ complete" : `from level ${i * STAGES_PER_WORLD + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="bnd-sheet mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="bnd-display text-lg">How it works</p>
          <p>✋ Grab a band along a line and stretch it onto a pin. Grab a bend to move it, or pull it off.</p>
          <p>🎯 Draw exactly the shape on the card with the bands you have — each band stays on its two nails.</p>
          <p>🧠 Tight move limits and wrong bends to fix. 600 levels across twelve worlds, then endless remixes.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-75">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
