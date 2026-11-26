"use client";
// Rope Loop — a 3D colour-sort puzzle with rope: tap a spool, then another, and the top rope winds over if the colour
// matches and there's room. Sort every colour onto its own spool. Hidden "?" coils show their colour only on top. Stages
// never end and arrive one by one: 600 designed boards across twelve worlds (each with its own backdrop and music, a
// big board halfway and a finale), then endless remixes. Hard from early on.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronRight, Lightbulb, Play, Plus, RotateCcw, Star, Undo2, X, Cylinder, Footprints } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { amount, apply, canMove, moves, run, solve, solved } from "../engine";
import { DESIGNED, ROPE_COLS, STAGES_PER_WORLD, WORLDS, passOf, planned, worldOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { useRope, useRopeHydrated, type Game } from "../save";
import { RopeScene, type SceneSound } from "./Scene";
import { ROPE_CSS } from "./styles";

export const ROPE_SFX = ["pick", "drop", "wind", "done", "denied", "hint", "undo", "spool", "clear", "star", "world", "lose", "open"] as const;
type Sfx = (typeof ROPE_SFX)[number];
const sfxName = (k: Sfx) => `a:rope_${k}` as Sound;
const music = (k: string) => `a:rope_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  hidden: ["Hidden coils", "Grey \"?\" coils keep their colour secret until they're on top of their spool. Plan for surprises!"],
  spare: ["One spare spool", "From here you only get one empty spool. Every move matters — a wrong one can leave you stuck."],
  boss: ["World finale", "The last board of every world is a big one. Sort it all to open the next world."],
  remix: ["Endless spools", "You've finished all 600 designed boards! From here every stage is a fresh remix — new boards, forever."],
};
interface Result { stage: number; stars: number; coins: number; worldDone: boolean; gift: string; used: number; colors: number }
const clone = (g: Game): Game => ({ ...g, spools: g.spools.map((s) => s.slice()), hid: g.hid.map((h) => h.slice()) });
/** a hidden coil shows its colour once it's on top */
const reveal = (g: Game) => { g.spools.forEach((s, i) => { if (s.length) g.hid[i][s.length - 1] = false; }); };

export default function RopeApp({ slug }: { slug: string; title: string }) {
  const ready = useRopeHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useRope((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "stuck" | "out" | "help" | "tip">("");
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [toast, setToast] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RopeScene | null>(null);
  const hist = useRef<Game[]>([]);
  const busy = useRef(false);
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  const applyPending = useCallback(() => { const sc = sceneRef.current, p = pendingRef.current; if (!sc || !p) return; pendingRef.current = null; sc.setStage(p.d.board.cap, p.g.spools, p.g.hid, worldOf(p.d.stage)); sc.setColors(p.g.spools); }, []);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null);
  const stateRef = useRef({ result: false, sheet: "", paused: false });
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { result: !!result, sheet, paused }; }, [result, sheet, paused]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);
  const setG = useCallback((g: Game) => { setGame(g); gameRef.current = g; sceneRef.current?.setColors(g.spools); }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Winding the ropes");
    void audio.preload(ROPE_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(worldOf(useRope.getState().stage).music)]);
    prepareStage(useRope.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.14, duck: k === "clear" || k === "world" });
  }, []);
  const persist = useCallback((g: Game) => { const d = defRef.current; if (!d) return; useRope.getState().saveCurrent({ stage: d.stage, game: g, revived: false }); }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback((g: Game) => {
    const d = defRef.current!;
    const stars = g.helped ? Math.min(2, g.used <= d.par ? 3 : 2) : g.used <= d.par ? 3 : g.used <= d.par * 1.3 ? 2 : 1;
    const colors = d.board.spools.filter((s) => s.length).length;
    const coins = 4 + colors * 2 + stars * 3 + (d.boss ? 20 : d.showcase ? 8 : 0);
    useProfile.getState().earnCoins(coins);
    useRope.getState().win(d.stage, stars, colors);
    let gift = "";
    if (d.boss) { useRope.getState().giveBooster("hint", 2); useRope.getState().giveBooster("spool", 1); useRope.getState().giveBooster("undo", 3); gift = "+2 Hints · +1 Spool · +3 Undos"; }
    else if (d.showcase) { useRope.getState().giveBooster("undo", 3); gift = "+3 Undos"; }
    else if (d.stage % 10 === 0) { useRope.getState().giveBooster(d.stage % 20 === 0 ? "spool" : "hint", 1); gift = d.stage % 20 === 0 ? "+1 Spool" : "+1 Hint"; }
    const worldDone = d.stage % STAGES_PER_WORLD === 0;
    sceneRef.current?.celebrate();
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, worldDone, gift, used: g.used, colors });
      sfx(worldDone ? "world" : "clear", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 1100);
    track("rope_clear", { stage: d.stage, stars });
  }, [sfx]);

  // ---------------------------------------------------------------- taps
  const tapRef = useRef<(i: number) => void>(() => undefined);
  const doTap = (i: number) => {
    const g0 = gameRef.current, d = defRef.current, sc = sceneRef.current, st = stateRef.current;
    if (!g0 || !d || !sc || st.result || st.sheet || st.paused || busy.current) return;
    const sel = sc.selected;
    if (sel < 0) { if (!g0.spools[i].length || (g0.spools[i].length === d.board.cap && run(g0.spools[i]) === d.board.cap)) { sc.deny(i); return; } sc.select(i); buzz(6); return; }
    if (sel === i) { sc.deselect(); return; }
    if (!canMove(d.board, g0.spools, sel, i)) {
      // tapping another movable spool switches the selection
      if (g0.spools[i].length && !(g0.spools[i].length === d.board.cap && run(g0.spools[i]) === d.board.cap) && (g0.spools[i].length >= d.board.cap || (g0.spools[i].length && g0.spools[sel].length && g0.spools[i][g0.spools[i].length - 1] !== g0.spools[sel][g0.spools[sel].length - 1]))) { sc.select(i); return; }
      sc.deny(i); buzz(30); return;
    }
    hist.current = [...hist.current, clone(g0)].slice(-60);
    const g = clone(g0); const toLen = g.spools[i].length;
    const n = amount(d.board, g.spools, sel, i);
    const color = g.spools[sel][g.spools[sel].length - 1];
    apply(d.board, g.spools, sel, i);
    for (let k = 0; k < n; k++) g.hid[i][toLen + k] = false;
    g.hid[sel] = g.hid[sel].slice(0, g.spools[sel].length);
    reveal(g); g.used++;
    busy.current = true;
    sc.move(sel, i, n, () => color, toLen, () => {
      busy.current = false;
      sc.sync(g.spools, g.hid);
      const dest = g.spools[i];
      if (dest.length === d.board.cap && run(dest) === d.board.cap) sc.sparkle(i);
      if (solved(d.board, g.spools)) { useRope.getState().saveCurrent(null); setTimeout(() => finishStage(g), 400); return; }
      persist(g);
      if (g.used >= d.moves + (g.bonus ?? 0)) { setTimeout(() => { setSheet("out"); sfx("lose", { gain: 0.55 }); }, 300); return; }
      if (!moves(d.board, g.spools).length) setTimeout(() => { setSheet("stuck"); sfx("lose", { gain: 0.5 }); }, 300);
    });
    setG(g); buzz(10);
  };
  useEffect(() => { tapRef.current = doTap; });

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const sc = new RopeScene(host.current, {
      canPlay: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused; },
      tap: (i) => tapRef.current(i),
      sound: (e: SceneSound, pan: number, n = 1) => {
        if (e === "wind") sfx("wind", { x: pan, gain: 0.5, rate: Math.max(0.8, 1.15 - n * 0.06) });
        else sfx(e as Sfx, { x: pan, gain: 0.5 });
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
    const g: Game = resume?.game ?? { spools: d.board.spools.map((s) => s.slice()), hid: d.board.hidden.map((h) => h.slice()), used: 0, helped: false, extra: false };
    reveal(g);
    setDef(d); setG(g); setResult(null); setSheet("");
    hist.current = []; busy.current = false;
    setScreen("game");
    const w = worldOf(stage);
    void audio.playMusic(music(w.music));
    audio.warmMusic([music(worldOf(stage + STAGES_PER_WORLD).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = useRope.getState().tips;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, boss: d.boss, hidden: d.board.hidden.flat().some(Boolean), spare: d.board.spools.filter((s) => !s.length).length === 1 };
    const tip = ["remix", "boss", "hidden", "spare"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useRope.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); } else setToast(`${w.name} · ${d.board.spools.filter((s) => s.length).length} colours`);
    track("rope_start", { stage });
  }, [sfx, applyPending, setG]);

  // ---------------------------------------------------------------- boosters
  const doHint = () => {
    const g = gameRef.current, d = defRef.current, sc = sceneRef.current; if (!g || !d || !sc || result || busy.current) return;
    // follow the level's own plan while the board is on it (it fits the move limit), else search afresh
    const p0 = g.extra ? null : planned(d, g.spools);
    const r = p0 ? { path: [p0], visited: 0 } : solve(d.board, g.spools, 40000);
    if (!r.path?.length) { setToast(r.visited <= 40000 ? "Stuck — undo a few moves!" : "No hint found — try undoing"); return; }
    if (!useRope.getState().useBooster("hint")) { setToast("No hints left"); return; }
    const m = r.path[0]; const g2 = { ...g, helped: true }; setG(g2); persist(g2);
    sc.select(m.from); setToast("Move this rope…"); sfx("hint", { gain: 0.5 });
    setTimeout(() => { if (sceneRef.current?.selected === m.from) setToast(`…onto spool ${m.to + 1}`); }, 900);
  };
  const doUndo = () => {
    const prev = hist.current[hist.current.length - 1], d = defRef.current;
    if (!prev || !d || result || busy.current) { setToast("Nothing to undo"); return; }
    if (!useRope.getState().useBooster("undo")) { setToast("No undos left"); return; }
    hist.current = hist.current.slice(0, -1);
    const g = { ...prev, helped: true }; setG(g); setSheet("");
    sceneRef.current?.setStage(d.board.cap, g.spools, g.hid, worldOf(d.stage)); sfx("undo", { gain: 0.5 }); persist(g);
  };
  const doSpool = () => {
    const g0 = gameRef.current, d = defRef.current; if (!g0 || !d || result || busy.current) return;
    if (g0.extra) { setToast("One extra spool per board"); return; }
    if (!useRope.getState().useBooster("spool")) { setToast("No spare spools left"); return; }
    const g = clone(g0); g.spools.push([]); g.hid.push([]); g.extra = true; g.helped = true;
    setG(g); setSheet(""); sceneRef.current?.setStage(d.board.cap, g.spools, g.hid, worldOf(d.stage)); sfx("spool", { gain: 0.55 }); persist(g);
  };
  const doMore = () => { const g0 = gameRef.current; if (!g0 || g0.bonus) return; const g = { ...g0, bonus: 10, helped: true }; setG(g); setSheet(""); sfx("spool", { gain: 0.5 }); persist(g); };
  const doRestart = () => { const d = defRef.current; if (!d) return; useRope.getState().saveCurrent(null); void start(d.stage); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __rope?: unknown }).__rope = {
      game: () => gameRef.current, def: () => defRef.current, start: (stage: number) => void start(stage),
      tap: (i: number) => tapRef.current(i), busy: () => busy.current,
      next: () => { const g = gameRef.current, d = defRef.current; if (!g || !d) return null; return planned(d, g.spools) ?? solve(d.board, g.spools, 40000).path?.[0] ?? null; },
      at: (i: number) => { const r = host.current?.getBoundingClientRect(), p = sceneRef.current?.spoolScreen(i); return p && r ? { x: r.left + p.x, y: r.top + p.y } : null; },
    };
  }, [start]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const w = worldOf(screen === "game" ? stage : useRope.getState().stage);
  const dark = w.id === "lantern" || w.id === "neon";
  const inS = ((stage - 1) % STAGES_PER_WORLD) + 1;
  const done = def && game ? game.spools.filter((s) => s.length === def.board.cap && run(s) === def.board.cap).length : 0;
  const colors = def ? def.board.spools.filter((s) => s.length).length : 0;
  const left = def && game ? Math.max(0, def.moves + (game.bonus ?? 0) - game.used) : 0;
  return (
    <div className={`rop-root ${dark ? "rop-dark" : ""}`} style={{ ["--s1" as string]: w.bg[0], ["--s2" as string]: w.bg[1], ["--paint" as string]: ROPE_COLS[(Math.floor((stage - 1) / STAGES_PER_WORLD)) % 8] }}>
      <style>{ROPE_CSS}</style>
      <div className="rop-bubbles" aria-hidden>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ left: `${(i * 41) % 100}%`, width: 14 + ((i * 13) % 26), height: 14 + ((i * 13) % 26), animationDuration: `${14 + (i % 5) * 4}s`, animationDelay: `${-i * 2.7}s` }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-start gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="rop-amber grid size-11 shrink-0 place-items-center"><ArrowLeft className="size-5" /></button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <p className="rop-display text-xl leading-none">Level {stage}{def?.boss ? " · Finale" : def?.showcase ? " · Big board" : ""}</p>
              <p className="text-[11px] font-bold opacity-75">{w.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_WORLD}</p>
              <div className="flex items-center gap-2"><span className={`rop-chip ${left <= 3 ? "rop-low" : ""}`}><Footprints className="size-3.5" /> {left} moves</span><span className="rop-chip"><Cylinder className="size-3.5" /> {done}/{colors}</span></div>
            </div>
            <button type="button" aria-label="Restart" onClick={doRestart} className="rop-amber grid size-11 shrink-0 place-items-center"><RotateCcw className="size-5" /></button>
          </div>
          <div className="relative min-h-0 flex-1"><div ref={host} className="rop-stage" /></div>
          <div className="flex items-end justify-center gap-4 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Undo2} label="Undo" n={boosters.undo} onClick={doUndo} />
            <Tool icon={Lightbulb} label="Hint" n={boosters.hint} onClick={doHint} />
            <Tool icon={Plus} label="Spool" n={boosters.spool} onClick={doSpool} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/10">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/50 border-t-[var(--paint)]" /><p className="rop-display text-lg">Winding the ropes…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "stuck" && !result && (
          <Sheet key="stuck" title="No moves left!" onClose={() => setSheet("")}>
            <p className="opacity-85">No rope can move any more. Step back, add a spare spool, or start the board again.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" className="rop-btn rop-cta py-3 text-lg" onClick={doUndo}><Undo2 className="mr-1 inline size-5" /> Undo ({boosters.undo})</button>
              {!game?.extra && boosters.spool > 0 && <button type="button" className="rop-btn rop-soft py-3" onClick={doSpool}><Plus className="mr-1 inline size-5" /> Extra spool ({boosters.spool})</button>}
              <button type="button" className="rop-btn rop-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "out" && !result && (
          <Sheet key="out" title="Out of moves!" onClose={() => undefined}>
            <p className="opacity-85">{game?.bonus ? "Try the board again — plan where every rope goes first." : "Take 10 more moves — free, once per level."}</p>
            <div className="mt-4 grid gap-2">
              {!game?.bonus && <button type="button" className="rop-btn rop-cta rop-shine py-3 text-lg" onClick={doMore}><Plus className="mr-1 inline size-5" /> +10 moves</button>}
              <button type="button" className="rop-btn rop-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useRope.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>👆 Tap a spool to lift its top rope, then tap another spool to wind it there.</li>
              <li>🎨 Rope only goes onto an empty spool or onto the same colour — and only as much as fits.</li>
              <li>🧶 Sort every colour onto its own full spool to win!</li>
              <li>❓ Grey coils hide their colour until they&apos;re on top. Moves are limited — Undo, Hint and an extra Spool help.</li>
            </ul>
            <button type="button" className="rop-btn rop-cta mt-5 w-full py-3 text-lg" onClick={() => { useRope.getState().sawHelp(); setSheet(""); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useRope.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="rop-btn rop-cta mt-5 w-full py-3 text-lg" onClick={() => { useRope.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="rop-pill pointer-events-none absolute top-32 left-1/2 z-50 -translate-x-1/2 text-sm whitespace-nowrap">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label: text, n, onClick }: { icon: typeof Star; label: string; n?: number; onClick: () => void }) {
  return (
    <button type="button" className="rop-tool" onClick={onClick}>
      <span className="rop-tool-ico rop-amber"><Icon className="size-6" />{n !== undefined && <span className="rop-badge">{n}</span>}</span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="rop-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="rop-display text-2xl">{title}</h2>
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
      <motion.div className="rop-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="rop-head px-5 pt-5 pb-4">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#fff3a0] text-white" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="rop-display mt-1 text-3xl drop-shadow">{r.worldDone ? "World complete!" : "All sorted!"}</h2>
          <p className="mt-1 text-sm font-bold opacity-90">{r.worldDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD} · ${r.used} moves`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-bold opacity-75">{r.colors} colours sorted</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/50 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="rop-btn rop-cta rop-shine flex items-center justify-center gap-2 py-3 text-lg" onClick={onNext}>Level {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="rop-btn rop-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  return (
    <div className="rop-title" role="img" aria-label="Rope Loop" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="rop-word rop-w1">{[..."ROPE"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: ROPE_COLS[i], animationDelay: `${i * 0.07}s, ${1 + i * 0.15}s` }}>{ch}</span>)}</div>
      <div className="rop-word rop-w2">{[..."LOOP"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "#ffffff", animationDelay: `${0.4 + i * 0.07}s, ${1.4 + i * 0.15}s` }}>{ch}</span>)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = useRope();
  const stage = save.stage, w = worldOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const wi = Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length;
  const remix = passOf(stage) > 0;
  const at = (shown - 1) % STAGES_PER_WORLD;
  return (
    <div className="rop-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Level"], [Star, String(save.totalStars), "Stars"], [Cylinder, String(save.sorted), "Sorted"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="rop-sheet flex items-center gap-2 !rounded-[18px] px-3 py-2.5 !shadow-none">
                <Icon className="size-6 shrink-0 text-[var(--paint)]" />
                <span className="min-w-0"><span className="rop-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Rope Loop — 3D rope colour sort puzzle</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-bold opacity-90 sm:mx-auto">Wind the coloured ropes from spool to spool until every colour has its own — think before you move!</p>

        <div className="rop-sheet rop-shine relative mt-3 overflow-hidden p-5">
          <p className="text-xs font-extrabold tracking-widest uppercase opacity-70">🧶 {w.name}{remix ? " · Remix" : ""}</p>
          <p className="rop-display mt-1 text-5xl leading-none">Level {shown}</p>
          <div className="rop-bar mt-3"><b style={{ width: `${Math.round((at / STAGES_PER_WORLD) * 100)}%` }} /></div>
          <p className="mt-1 text-[11px] font-bold opacity-70">{at} of {STAGES_PER_WORLD} boards in this world</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="rop-btn rop-cta inline-flex items-center gap-2 px-7 py-3 text-xl"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useRope.getState().saveCurrent(null); onPlay(cur.stage); }} className="rop-btn rop-soft inline-flex items-center gap-1.5 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="rop-btn rop-cta inline-flex items-center gap-2 px-9 py-3.5 text-2xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="rop-display text-[24px] leading-none">The worlds</h2>
          <span className="text-xs font-bold opacity-70">{STAGES_PER_WORLD} boards each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORLDS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_WORLD) > i || remix, now = i === wi;
            const dk = s.id === "lantern" || s.id === "neon";
            return (
              <div key={s.id} className={`rounded-2xl border-[3px] p-3 shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: now ? ROPE_COLS[i % 8] : "#ffffff", background: `linear-gradient(150deg, ${s.bg[0]}, ${s.bg[1]})`, color: dk ? "#fff" : "#2a2440" }}>
                <p className="text-[13px] font-extrabold">{s.name}</p>
                <p className="text-[11px] font-bold opacity-80">{now ? `board ${((stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}` : done ? "★ complete" : `from level ${i * STAGES_PER_WORLD + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="rop-sheet mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="rop-display text-lg">How it works</p>
          <p>👆 Tap a spool, then another: the top rope winds over if the colour matches and there&apos;s room.</p>
          <p>🧶 Sort every colour onto its own spool. Only one spare spool on most boards — plan ahead!</p>
          <p>❓ Hidden coils show their colour only on top. 600 levels across twelve worlds, then endless remixes.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-60">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
