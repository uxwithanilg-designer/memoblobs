"use client";
// Skyrift Gems — a 3D match-3 among floating sky islands. Swap neighbouring gems to make lines of three; lines of four,
// L/T shapes and lines of five make line gems, bombs and prisms. Odd levels are quests (goals within a move limit:
// gems, ice, rocks, treasure chests), even levels are duels: you and a rival take turns on the same board and the
// higher score wins. 1000 designed levels across twenty sky worlds (each with its own sky and music), then endless
// remixes, arriving one by one.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronRight, Hammer, Lightbulb, Pause, Play, Plus, RotateCcw, Shuffle, Star, Swords, Trophy, Undo2, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { cdn } from "@/lib/cdn";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { clone, emptyTally, moves, play, shuffle as shuffleBoard, smash, type Board, type Tally } from "../engine";
import { DESIGNED, GEM_COLS, GEM_NAMES, STAGES_PER_WORLD, WORLDS, addTally, goalDone, passOf, rivalMove, valueOf, worldOf, type Goal, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { useSky, useSkyHydrated } from "../save";
import { SkyScene, type SceneSound } from "./Scene";
import { SKY_CSS } from "./styles";

export const SKY_SFX = ["swap", "bad", "match", "make", "line", "bomb", "prism", "ice", "rock", "chest", "land", "shuffle", "hammer", "turn", "win", "lose", "star", "world", "open"] as const;
type Sfx = (typeof SKY_SFX)[number];
const sfxName = (k: Sfx) => `a:skyrift_${k}` as Sound;
const music = (k: string) => `a:skyrift_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  duel: ["Duel!", "You and your rival take turns on the same board. Every match scores — make the biggest combos before your moves run out."],
  ice: ["Ice", "Clear gems sitting on ice to crack it. Thick ice needs two hits."],
  rock: ["Rocks", "Rocks don't match. Make matches or blasts right next to them to chip them away."],
  chest: ["Treasure chests", "Bring the chests down to the bottom row: clear the gems under them."],
  boss: ["World finale", "The last level of every world is a big quest. Finish it to fly on to the next island."],
  remix: ["Endless skies", "You've finished all 1000 designed levels! From here every level is a fresh remix — forever."],
};
/** the goal in words for the banner */
function goalText(goals: Goal[]) {
  const one = (g: Goal) => g.k === "gem" ? `${g.n} ${GEM_NAMES[g.c]} pieces` : g.k === "ice" ? `${g.n} ice` : g.k === "rock" ? `${g.n} rock${g.n > 1 ? "s" : ""}` : g.k === "chest" ? `${g.n} chest${g.n > 1 ? "s" : ""}` : `${g.n} points`;
  return `Collect ${goals.map(one).join(" and ")}!`;
}
interface Result { stage: number; stars: number; coins: number; worldDone: boolean; gift: string; won: boolean; line: string }
interface Run { tally: Tally; used: number; mine: number; theirs: number; rivalUsed: number; bonus: number; helped: boolean; over: boolean }

export default function SkyriftApp({ slug }: { slug: string; title: string }) {
  const ready = useSkyHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused, setPaused } = usePlayer();
  const boosters = useSky((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [run, setRunState] = useState<Run | null>(null);
  const [turn, setTurn] = useState<"me" | "rival">("me");
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "out" | "lost" | "help" | "tip">("");
  const [tipKey, setTipKey] = useState("");
  const [hammerOn, setHammerOn] = useState(false);
  const [loadingStage, setLoadingStage] = useState(false);
  const [toast, setToast] = useState("");
  const [banner, setBanner] = useState("");
  const undoRef = useRef<{ board: Board; run: Run } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SkyScene | null>(null);
  const boardRef = useRef<Board | null>(null);
  const runRef = useRef<Run | null>(null), defRef = useRef<StageDef | null>(null);
  const busy = useRef(false);
  const stateRef = useRef({ result: false, sheet: "", paused: false, turn: "me", hammer: false });
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { result: !!result, sheet, paused, turn, hammer: hammerOn }; }, [result, sheet, paused, turn, hammerOn]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(""), 2400); return () => clearTimeout(t); }, [banner]);
  const setRun = useCallback((r: Run) => { runRef.current = r; setRunState(r); }, []);
  /** a new run state from the current one (runs are never changed in place) */
  const patch = useCallback((p: Partial<Run>) => { const r = { ...runRef.current!, ...p }; runRef.current = r; setRunState(r); return r; }, []);
  const withTally = (t: Tally, add: Tally) => { const n = { ...t, gems: t.gems.slice() }; addTally(n, add); return n; };

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Raising the islands");
    void audio.preload(SKY_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(worldOf(useSky.getState().stage).music)]);
    prepareStage(useSky.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.14, duck: k === "win" || k === "world" });
  }, []);

  // ---------------------------------------------------------------- endings
  const finish = useCallback((won: boolean) => {
    const d = defRef.current!, r = patch({ over: true });
    if (!won) {
      setTimeout(() => { setSheet(d.kind === "duel" ? "lost" : "out"); sfx("lose", { gain: 0.6 }); }, 500);
      return;
    }
    let stars: number, line: string;
    if (d.kind === "quest") {
      const left = d.moves + r.bonus - r.used;
      stars = r.helped ? Math.min(2, left >= 2 ? 2 : 1) : left >= Math.max(3, d.moves * 0.25) ? 3 : left >= 2 ? 2 : 1;
      line = `${left} move${left === 1 ? "" : "s"} to spare`;
    } else {
      const margin = (r.mine - r.theirs) / Math.max(1, r.theirs);
      stars = margin >= 0.5 ? 3 : margin >= 0.15 ? 2 : 1;
      line = `${r.mine.toLocaleString()} – ${r.theirs.toLocaleString()}`;
    }
    const coins = 6 + stars * 4 + (d.kind === "duel" ? 8 : 0) + (d.boss ? 25 : d.showcase ? 10 : 0);
    useProfile.getState().earnCoins(coins);
    useSky.getState().win(d.stage, stars, d.kind === "duel" ? 1 : 0);
    let gift = "";
    const give = useSky.getState().giveBooster;
    if (d.boss) { give("hammer", 2); give("shuffle", 1); give("hint", 2); gift = "+2 Hammers · +1 Shuffle · +2 Hints"; }
    else if (d.showcase) { give("hammer", 1); gift = "+1 Hammer"; }
    else if (d.stage % 10 === 0) { give(d.stage % 20 === 0 ? "shuffle" : "hint", 1); gift = d.stage % 20 === 0 ? "+1 Shuffle" : "+1 Hint"; }
    const worldDone = d.stage % STAGES_PER_WORLD === 0;
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, worldDone, gift, won, line });
      sfx(worldDone ? "world" : "win", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 700);
    track("skyrift_clear", { stage: d.stage, stars });
  }, [sfx, patch]);

  const rivalTurn = () => {
    const d = defRef.current!, b = boardRef.current!, sc = sceneRef.current;
    busy.current = true; setTurn("rival");
    setTimeout(() => {
      if (!sc || defRef.current !== d) return;
      const m = rivalMove(b, d.rival!.skill, Math.random);
      if (!m) { afterRef.current("rival", emptyTally(b.colors)); return; }
      const res = play(b, m[0], m[1]);
      if (!res) { afterRef.current("rival", emptyTally(b.colors)); return; }
      sfx("turn", { gain: 0.35 });
      sc.playSteps(res.steps, b, () => afterRef.current("rival", res.tally));
    }, 650 + Math.random() * 350);
  };

  /** after a move (yours or the rival's) has finished playing */
  const afterMove = (who: "me" | "rival", tally: Tally) => {
    const d = defRef.current!, r0 = runRef.current!;
    const r = who === "me" ? patch({ tally: withTally(r0.tally, tally), mine: r0.mine + tally.score, used: r0.used + 1 }) : patch({ theirs: r0.theirs + tally.score, rivalUsed: r0.rivalUsed + 1 });
    if (d.kind === "quest") {
      if (goalDone(d.goals, r.tally).every((x) => x >= 1)) { busy.current = true; finish(true); return; }
      if (r.used >= d.moves + r.bonus) { busy.current = true; finish(false); return; }
      busy.current = false; return;
    }
    // a duel: turns alternate; it ends when both have used their moves
    if (r.used >= d.moves && r.rivalUsed >= d.moves) { busy.current = true; if (r.mine > r.theirs) finish(true); else finish(false); return; }
    if (who === "me") rivalTurn(); else { busy.current = false; setTurn("me"); }
  };
  const afterRef = useRef(afterMove);
  useEffect(() => { afterRef.current = afterMove; });


  // ---------------------------------------------------------------- input
  const doSwap = (a: number, c: number) => {
    const d = defRef.current, b = boardRef.current, sc = sceneRef.current, st = stateRef.current, r = runRef.current;
    if (!d || !b || !sc || !r || st.result || st.sheet || st.paused || busy.current || r.over || st.turn !== "me") return;
    if (st.hammer) return;
    const before = { board: clone(b), run: r };
    const res = play(b, a, c);
    if (!res) { sc.bounce(a, c); buzz(20); return; }
    undoRef.current = d.kind === "quest" ? before : null;
    busy.current = true; buzz(8);
    sc.playSteps(res.steps, b, () => afterRef.current("me", res.tally));
  };
  const doTap = (i: number) => {
    const d = defRef.current, b = boardRef.current, sc = sceneRef.current, st = stateRef.current, r = runRef.current;
    if (!d || !b || !sc || !r || st.result || st.sheet || st.paused || busy.current || r.over || st.turn !== "me") return;
    if (st.hammer) {
      const res = smash(b, i); if (!res) { setToast("Pick a gem or a rock"); return; }
      if (!useSky.getState().useBooster("hammer")) { setHammerOn(false); setToast("No hammers left"); return; }
      setHammerOn(false); patch({ helped: true }); busy.current = true; sfx("hammer", { gain: 0.6 });
      // a hammer isn't a move: its catch still counts for the goals
      sc.playSteps(res.steps, b, () => { const r0 = runRef.current!; const r2 = patch({ tally: withTally(r0.tally, res.tally), mine: r0.mine + res.tally.score }); busy.current = false; if (d.kind === "quest" && goalDone(d.goals, r2.tally).every((x) => x >= 1)) { busy.current = true; finish(true); } });
      return;
    }
    // tap one gem, then a neighbour
    const sel = sc.selected;
    if (sel < 0) { sc.select(i); return; }
    sc.select(-1);
    if (sel === i) return;
    const dx = Math.abs((sel % b.w) - (i % b.w)), dy = Math.abs(Math.floor(sel / b.w) - Math.floor(i / b.w));
    if (dx + dy === 1) doSwap(sel, i); else sc.select(i);
  };
  const swapRef = useRef(doSwap), tapRef = useRef(doTap);
  useEffect(() => { swapRef.current = doSwap; tapRef.current = doTap; });

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const sc = new SkyScene(host.current, {
      canPlay: () => { const s = stateRef.current; return !s.result && !s.sheet && !s.paused && s.turn === "me" && !busy.current; },
      swap: (a, c) => swapRef.current(a, c),
      tap: (i) => tapRef.current(i),
      sound: (e: SceneSound, pan: number, chain = 0) => {
        if (e === "match") sfx("match", { x: pan, gain: 0.5, rate: 1 + Math.min(0.6, chain * 0.12) });
        else sfx(e as Sfx, { x: pan, gain: e === "land" ? 0.25 : e === "swap" ? 0.4 : 0.55 });
      },
    });
    sceneRef.current = sc;
    const d = defRef.current, b = boardRef.current;
    if (d && b) sc.setBoard(b);
    return () => { sc.dispose(); sceneRef.current = null; };
  }, [screen, sfx]);

  // ---------------------------------------------------------------- stages
  const start = useCallback(async (stage: number) => {
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const b = clone(d.board);
    boardRef.current = b; defRef.current = d; setDef(d);
    setRun({ tally: emptyTally(b.colors), used: 0, mine: 0, theirs: 0, rivalUsed: 0, bonus: 0, helped: false, over: false });
    setResult(null); setSheet(""); setTurn("me"); setHammerOn(false); busy.current = false; undoRef.current = null;
    setScreen("game");
    sceneRef.current?.setBoard(b);
    const w = worldOf(stage);
    void audio.playMusic(music(w.music));
    audio.warmMusic([music(worldOf(stage + STAGES_PER_WORLD).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    useSky.getState().saveCurrent(null);
    const tips = useSky.getState().tips;
    const has: Record<string, boolean> = {
      remix: stage > DESIGNED, boss: d.boss, duel: d.kind === "duel",
      ice: d.goals.some((g) => g.k === "ice"), rock: d.goals.some((g) => g.k === "rock"), chest: d.goals.some((g) => g.k === "chest"),
    };
    const tip = ["remix", "boss", "duel", "ice", "rock", "chest"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useSky.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); }
    else setBanner(d.kind === "duel" ? `Beat ${d.rival!.name} in ${d.moves} moves each!` : goalText(d.goals));
    track("skyrift_start", { stage });
  }, [sfx, setRun]);

  // ---------------------------------------------------------------- boosters
  const doHint = () => {
    const d = defRef.current, b = boardRef.current, sc = sceneRef.current, r = runRef.current;
    if (!d || !b || !sc || !r || busy.current || r.over || turn !== "me") return;
    if (!useSky.getState().useBooster("hint")) { setToast("No hints left"); return; }
    let best: [number, number] | null = null, bv = -1;
    for (const [a, c] of moves(b)) { const t = clone(b); const res = play(t, a, c, 12); if (!res) continue; const v = d.kind === "quest" ? valueOf(d.goals, r.tally, res.tally) : res.tally.score; if (v > bv) { bv = v; best = [a, c]; } }
    if (best) { sc.hint(best[0], best[1]); sfx("make", { gain: 0.4 }); }
  };
  const doShuffle = () => {
    const b = boardRef.current, sc = sceneRef.current, r = runRef.current;
    if (!b || !sc || !r || busy.current || r.over || turn !== "me") return;
    if (!useSky.getState().useBooster("shuffle")) { setToast("No shuffles left"); return; }
    shuffleBoard(b); patch({ helped: true }); sc.resync(); sfx("shuffle", { gain: 0.6 });
  };
  const doMore = () => { const r = runRef.current; if (!r || r.bonus) return; patch({ bonus: 5, over: false, helped: true }); setSheet(""); busy.current = false; sfx("make", { gain: 0.5 }); };
  const doRestart = () => { const d = defRef.current; if (d) void start(d.stage); };
  const showGoal = () => { const d = defRef.current; if (d) setBanner(d.kind === "duel" ? `Beat ${d.rival!.name} in ${d.moves} moves each!` : goalText(d.goals)); };
  const doUndo = () => {
    const u = undoRef.current, sc = sceneRef.current, d = defRef.current;
    if (!sc || !d || busy.current) return;
    if (d.kind === "duel") { setToast("No undo in a duel"); return; }
    if (!u) { setToast("Nothing to undo"); return; }
    undoRef.current = null;
    boardRef.current = u.board; setRun({ ...u.run, helped: true, over: false }); setSheet("");
    sc.setBoard(u.board); sfx("swap", { gain: 0.5 });
  };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __skyrift?: unknown }).__skyrift = {
      def: () => defRef.current, run: () => runRef.current, board: () => boardRef.current, start: (stage: number) => void start(stage),
      swap: (a: number, c: number) => swapRef.current(a, c), busy: () => busy.current, turn: () => stateRef.current.turn,
      best: () => { const b = boardRef.current, d = defRef.current, r = runRef.current; if (!b || !d || !r) return null; let best: [number, number] | null = null, bv = -1; for (const [a, c] of moves(b)) { const t = clone(b); const res = play(t, a, c, 12); if (!res) continue; const v = d.kind === "quest" ? valueOf(d.goals, r.tally, res.tally) : res.tally.score; if (v > bv) { bv = v; best = [a, c]; } } return best; },
      at: (i: number) => { const r = host.current?.getBoundingClientRect(), p = sceneRef.current?.screenOf(i); return p && r ? { x: r.left + p.x, y: r.top + p.y } : null; },
    };
  }, [start]);

  const leave = () => { setScreen("home"); setResult(null); setSheet(""); busy.current = false; void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const w = worldOf(screen === "game" ? stage : useSky.getState().stage);
  const inS = ((stage - 1) % STAGES_PER_WORLD) + 1;
  const left = def && run ? Math.max(0, def.moves + run.bonus - run.used) : 0;
  const done = def && run ? goalDone(def.goals, run.tally) : [];
  return (
    <div className="sky-root" style={{ ["--s1" as string]: w.sky[0], ["--s2" as string]: w.sky[1], ["--paint" as string]: "#5a6aff" }}>
      <style>{SKY_CSS}</style>
      <div className="sky-bg" aria-hidden style={{ ["--bg-wide" as string]: `url(${cdn("/games/skyrift-gems/bg.webp")})`, ["--bg-tall" as string]: `url(${cdn("/games/skyrift-gems/bg-tall.webp")})` }} />
      <div className="sky-bubbles" aria-hidden>{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ left: `${(i * 41) % 100}%`, width: 14 + ((i * 13) % 26), height: 14 + ((i * 13) % 26), animationDuration: `${14 + (i % 5) * 4}s`, animationDelay: `${-i * 2.7}s` }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={(st) => void start(st)} />}

      {screen === "game" && def && run && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-center gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+4px)] pr-[64px] pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="sky-amber grid size-10 shrink-0 place-items-center"><ArrowLeft className="size-5" /></button>
            <div className="min-w-0 flex-1 text-center"><p className="sky-display text-lg leading-none" style={{ textShadow: "0 2px 0 rgba(90,40,90,.45)" }}>Level {stage}{def.boss ? " · Finale" : def.kind === "duel" ? " · Duel" : ""}</p><p className="text-[11px] font-bold opacity-90 drop-shadow">{w.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_WORLD}</p></div>
            <button type="button" aria-label="Restart" onClick={doRestart} className="sky-amber grid size-10 shrink-0 place-items-center"><RotateCcw className="size-5" /></button>
          </div>
          <div className="sky-play min-h-0 flex-1">
            {/* the goal card: goals on top, pause / undo / moves below (or the duel's scores) */}
            <div className="sky-left px-3 pt-2">
              <div className="sky-panel mx-auto w-full max-w-[420px]">
                {def.kind === "quest" ? (
                  <div className="sky-panel-top">
                    <p className="sky-ptitle">Goal</p>
                    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-3">
                      {def.goals.map((g, k) => <GoalChip key={k} g={g} have={g.k === "gem" ? run.tally.gems[g.c] : g.k === "ice" ? run.tally.ice : g.k === "rock" ? run.tally.rocks : g.k === "chest" ? run.tally.chests : run.tally.score} done={(done[k] ?? 0) >= 1} />)}
                    </div>
                  </div>
                ) : (
                  <div className="sky-panel-top">
                    <p className="sky-ptitle">Duel</p>
                    <div className="mt-1 flex items-center justify-center gap-3">
                      <div className="flex items-center gap-1.5"><span className={`sky-face ${turn === "me" && !run.over ? "sky-turn" : ""}`}>🙂</span><span className="sky-score">{run.mine.toLocaleString()}</span></div>
                      <Swords className="size-5" />
                      <div className="flex items-center gap-1.5"><span className="sky-score">{run.theirs.toLocaleString()}</span><span className={`sky-face ${turn === "rival" && !run.over ? "sky-turn" : ""}`}>😼</span></div>
                    </div>
                  </div>
                )}
                <div className="sky-panel-bot">
                  <div className="flex flex-col items-center gap-1"><span className="sky-lbl">Pause</span><button type="button" aria-label="Pause" className="sky-sq" onClick={() => setPaused(true)}><Pause className="size-6 fill-current" /></button></div>
                  <div className="flex flex-col items-center gap-1"><span className="sky-lbl">Undo</span><button type="button" aria-label="Undo" className="sky-rd" onClick={doUndo}><Undo2 className="size-6" /></button></div>
                  <div className="flex flex-col items-center gap-1"><span className="sky-lbl">{def.kind === "duel" ? "Your moves" : "Moves"}</span><span className={`sky-movesbig ${left <= 3 && def.kind === "quest" ? "sky-low" : ""}`}>{def.kind === "duel" ? Math.max(0, def.moves - run.used) : left}</span></div>
                </div>
              </div>
            </div>
            <div className="relative min-h-0 flex-1 self-stretch">
              <div ref={host} className="sky-stage" />
              {hammerOn && <div className="sky-pill pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 text-sm">Tap a candy or rock to smash it</div>}
              {turn === "rival" && !run.over && <div className="sky-pill pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 text-sm">{def.rival!.name} is thinking…</div>}
              <AnimatePresence>
                {banner && <motion.div key={banner} className="sky-banner pointer-events-none fixed top-[calc(max(env(safe-area-inset-top),8px)+52px)] left-1/2 z-30 w-[min(90%,440px)] -translate-x-1/2" initial={{ y: -30, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ type: "spring", damping: 15 }}><p className="sky-display text-2xl">{def.kind === "duel" ? "Duel!" : "Goal"}</p><p className="sky-display text-xl leading-tight">{banner}</p></motion.div>}
              </AnimatePresence>
            </div>
            <div className="sky-side px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
              <Booster icon={Hammer} label="Hammer" n={boosters.hammer} on={hammerOn} onClick={() => { if (boosters.hammer > 0) setHammerOn((h) => !h); else setToast("No hammers left"); }} />
              <Booster icon={Shuffle} label="Shuffle" n={boosters.shuffle} onClick={doShuffle} />
              <Booster icon={Lightbulb} label="Hint" n={boosters.hint} onClick={doHint} />
            </div>
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/10">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/50 border-t-[var(--paint)]" /><p className="sky-display text-lg drop-shadow">Raising the island…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "out" && !result && (
          <Sheet key="out" title="Out of moves!" onClose={() => undefined}>
            <p className="opacity-85">{run?.bonus ? "So close! Try the level again — plan for the specials." : "Take 5 more moves — free, once per level."}</p>
            <div className="mt-4 grid gap-2">
              {!run?.bonus && <button type="button" className="sky-btn sky-cta sky-shine py-3 text-lg" onClick={doMore}><Plus className="mr-1 inline size-5" /> +5 moves</button>}
              <button type="button" className="sky-btn sky-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "lost" && !result && (
          <Sheet key="lost" title={`${def?.rival?.name ?? "The rival"} wins this one`} onClose={() => undefined}>
            <p className="opacity-85">{run?.mine.toLocaleString()} – {run?.theirs.toLocaleString()}. Rematch! Big combos and specials score the most.</p>
            <div className="mt-4 grid gap-2"><button type="button" className="sky-btn sky-cta sky-shine py-3 text-lg" onClick={doRestart}><Swords className="mr-1 inline size-5" /> Rematch</button></div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useSky.getState().sawHelp(); setSheet(""); showGoal(); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>👆 Swipe a gem into a neighbour (or tap one, then the other) to swap them. Make lines of 3 or more.</li>
              <li>💎 4 in a line makes a line gem, an L or T a bomb, 5 in a line a rainbow prism. Swap two specials together for a mega blast!</li>
              <li>🎯 Quests: reach the goals before the moves run out.</li>
              <li>⚔️ Every second level is a duel: take turns with a rival on one board — the higher score wins.</li>
            </ul>
            <button type="button" className="sky-btn sky-cta mt-5 w-full py-3 text-lg" onClick={() => { useSky.getState().sawHelp(); setSheet(""); showGoal(); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useSky.getState().sawTip(tipKey); setSheet(""); showGoal(); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="sky-btn sky-cta mt-5 w-full py-3 text-lg" onClick={() => { useSky.getState().sawTip(tipKey); setSheet(""); showGoal(); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="sky-pill pointer-events-none absolute bottom-28 left-1/2 z-50 -translate-x-1/2 text-sm whitespace-nowrap">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function GoalChip({ g, have, done }: { g: Goal; have: number; done: boolean }) {
  const icon = g.k === "gem"
    ? <span className="sky-cand" style={{ width: 36, height: 36, background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.6), transparent 45%), ${GEM_COLS[g.c]}` }} />
    : g.k === "rock" ? <span className="sky-cand" style={{ width: 34, height: 30, borderRadius: "44% 52% 40% 48%", background: "#8a8a96" }} />
    : <span className="text-3xl leading-none">{g.k === "ice" ? "🧊" : g.k === "chest" ? "💰" : "⭐"}</span>;
  return <span className="sky-ggoal">{icon}<span className={`sky-gnum ${done ? "ok" : ""}`}>{done ? "✓" : Math.max(0, g.n - have)}</span></span>;
}

function Booster({ icon: Icon, label: text, n, on, onClick }: { icon: typeof Star; label: string; n: number; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={text} className="flex flex-col items-center gap-1 text-[11px] font-extrabold drop-shadow" onClick={onClick}>
      <span className={`sky-orb relative ${on ? "on" : ""}`}><Icon className="size-7" /><span className="sky-badge">{n}</span></span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="sky-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="sky-display text-2xl">{title}</h2>
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
      <motion.div className="sky-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="sky-head px-5 pt-5 pb-4">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#fff3a0] text-white" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="sky-display mt-1 text-3xl drop-shadow">{r.worldDone ? "World complete!" : "Level clear!"}</h2>
          <p className="mt-1 text-sm font-bold opacity-90">{r.worldDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-bold opacity-75">{r.line}</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/50 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="sky-btn sky-cta sky-shine flex items-center justify-center gap-2 py-3 text-lg" onClick={onNext}>Level {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="sky-btn sky-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  return (
    <div className="sky-title" role="img" aria-label="Skyrift Gems" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="sky-word sky-w1">{[..."SKYRIFT"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: GEM_COLS[i % GEM_COLS.length], animationDelay: `${i * 0.06}s, ${1 + i * 0.15}s` }}>{ch}</span>)}</div>
      <div className="sky-word sky-w2">{[..."GEMS"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "#ffffff", animationDelay: `${0.45 + i * 0.07}s, ${1.5 + i * 0.15}s` }}>{ch}</span>)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number) => void }) {
  const save = useSky();
  const stage = save.stage, w = worldOf(stage);
  const wi = Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length;
  const remix = passOf(stage) > 0;
  const at = (stage - 1) % STAGES_PER_WORLD;
  return (
    <div className="sky-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Level"], [Star, String(save.totalStars), "Stars"], [Trophy, String(save.duels), "Duels won"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="sky-sheet flex items-center gap-2 !rounded-[18px] px-3 py-2.5 !shadow-none">
                <Icon className="size-6 shrink-0 text-[#5a6aff]" />
                <span className="min-w-0"><span className="sky-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Skyrift Gems — 3D match 3 duel puzzle</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-bold drop-shadow sm:mx-auto">Match glittering gems on floating sky islands — finish quests and win head-to-head duels.</p>

        <div className="sky-sheet sky-shine relative mt-3 overflow-hidden p-5">
          <p className="text-xs font-extrabold tracking-widest uppercase opacity-70">☁️ {w.name}{remix ? " · Remix" : ""}</p>
          <p className="sky-display mt-1 text-5xl leading-none">Level {stage}</p>
          <div className="sky-bar mt-3"><b style={{ width: `${Math.round((at / STAGES_PER_WORLD) * 100)}%` }} /></div>
          <p className="mt-1 text-[11px] font-bold opacity-70">{at} of {STAGES_PER_WORLD} levels on this island · {stage % 2 === 0 ? "next: a duel" : "next: a quest"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onPlay(stage)} className="sky-btn sky-cta inline-flex items-center gap-2 px-9 py-3.5 text-2xl"><Play className="size-6 fill-current" /> Play</button>
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="sky-display text-[24px] leading-none drop-shadow">The islands</h2>
          <span className="text-xs font-bold drop-shadow">{STAGES_PER_WORLD} levels each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORLDS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_WORLD) > i || remix, now = i === wi;
            return (
              <div key={s.id} className={`rounded-2xl border-[3px] p-3 shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: now ? "#ffd23a" : "#ffffff", background: `linear-gradient(180deg, ${s.sky[0]}, ${s.sky[1]} 75%, ${s.isle} 75%)`, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.4)" }}>
                <p className="text-[13px] font-extrabold">{s.name}</p>
                <p className="text-[11px] font-bold opacity-90">{now ? `level ${((stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}` : done ? "★ complete" : `from level ${i * STAGES_PER_WORLD + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="sky-sheet mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="sky-display text-lg">How it works</p>
          <p>👆 Swap neighbouring gems to make lines of three. Bigger lines and L or T shapes make line gems, bombs and prisms.</p>
          <p>🎯 Quests: collect gems, crack ice, chip rocks and bring treasure down before the moves run out.</p>
          <p>⚔️ Every second level is a duel against a rival on the same board. 1000 levels across twenty islands, then endless remixes.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-75 drop-shadow">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
