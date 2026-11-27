"use client";
// Flutter Pairs — a 3D felt stack puzzle. A wooden belt brings felt blocks one at a time (you see the one in your
// hand and the next five). Tap a stack on a stump to drop the block there: on a matching top block, the pair sprouts
// wings and flutters away; otherwise it joins the stack — but never past the leafy rope, or the stack topples. Clear
// every stack to win. Powers: Move (a top block to another stack), Swap (two blocks trade places) and Hint. 1000
// designed levels across twenty felt worlds, then endless remixes, arriving one by one.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRightLeft, ChevronRight, Lightbulb, MoveUpRight, Play, RotateCcw, Star, Trophy, Undo2, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { cdn } from "@/lib/cdn";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { cloneStacks, dropResult, solve, ERASE, type Stack } from "../engine";
import { BLOCK_COLS, DESIGNED, STAGES_PER_WORLD, WORLDS, passOf, worldOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { useFlutter, useFlutterHydrated } from "../save";
import { FlutterScene, type SceneSound } from "./Scene";
import { FLT_CSS } from "./styles";

export const FLUTTER_SFX = ["hop", "land", "pop", "flap", "topple", "erase", "belt", "select", "swap", "deny", "hint", "undo", "win", "lose", "star", "world", "open"] as const;
type Sfx = (typeof FLUTTER_SFX)[number];
const sfxName = (k: Sfx) => `a:flutter_${k}` as Sound;
const music = (k: string) => `a:flutter_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  powers: ["Powers", "Move puts a stack's top block on another stack. Swap trades any two blocks. Use them when you're stuck — but they cost a star."],
  erase: ["Erase ball", "The white ball removes the top block of the stack you drop it on. Save it for a stack that's close to the rope!"],
  boss: ["World finale", "The last level of every world is a long one. Clear it to move on to the next felt world."],
  remix: ["Endless levels", "You've finished all 1000 designed levels! From here every level is a fresh remix — forever."],
};
interface Result { stage: number; stars: number; coins: number; worldDone: boolean; gift: string }
interface Game { stacks: Stack[]; at: number; helped: number; over: "" | "win" | "lose" }
type Mode = "" | "move" | "swap";

export default function FlutterApp({ slug }: { slug: string; title: string }) {
  const ready = useFlutterHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useFlutter((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGameState] = useState<Game | null>(null);
  const [mode, setMode] = useState<Mode>("");
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "lose" | "help" | "tip">("");
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [toast, setToast] = useState("");
  const [tookBack, setTookBack] = useState(false);
  const [canTakeBack, setCanTakeBack] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlutterScene | null>(null);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null);
  const prevRef = useRef<Game | null>(null);
  const pickRef = useRef<{ stack: number; k: number } | null>(null);
  const busy = useRef(false);
  const stateRef = useRef({ result: false, sheet: "", paused: false, mode: "" as Mode });
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { result: !!result, sheet, paused, mode }; }, [result, sheet, paused, mode]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);
  const setGame = useCallback((g: Game) => { gameRef.current = g; setGameState(g); }, []);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Stitching the felt");
    void audio.preload(FLUTTER_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(worldOf(useFlutter.getState().stage).music)]);
    prepareStage(useFlutter.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.12, duck: k === "win" || k === "world" });
  }, []);

  // ---------------------------------------------------------------- endings
  const finish = useCallback((g: Game) => {
    const d = defRef.current!;
    const stars = g.helped === 0 ? 3 : g.helped === 1 ? 2 : 1;
    const coins = 6 + stars * 4 + Math.round(d.level.queue.length / 8) + (d.boss ? 25 : d.showcase ? 10 : 0);
    useProfile.getState().earnCoins(coins);
    useFlutter.getState().win(d.stage, stars, Math.floor(d.level.queue.length / 2));
    let gift = "";
    const give = useFlutter.getState().giveBooster;
    if (d.boss) { give("move", 2); give("swap", 2); give("hint", 2); gift = "+2 Moves · +2 Swaps · +2 Hints"; }
    else if (d.showcase) { give("hint", 1); give("move", 1); gift = "+1 Hint · +1 Move"; }
    else if (d.stage % 10 === 0) { give(d.stage % 20 === 0 ? "swap" : "move", 1); gift = d.stage % 20 === 0 ? "+1 Swap" : "+1 Move"; }
    const worldDone = d.stage % STAGES_PER_WORLD === 0;
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, worldDone, gift });
      sfx(worldDone ? "world" : "win", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 700);
    track("flutter_clear", { stage: d.stage, stars });
  }, [sfx]);

  // ---------------------------------------------------------------- drops
  const doDrop = (i: number) => {
    const d = defRef.current, g0 = gameRef.current, sc = sceneRef.current, st = stateRef.current;
    if (!d || !g0 || !sc || st.result || st.sheet || st.paused || busy.current || g0.over || g0.at >= d.level.queue.length) return;
    const c = d.level.queue[g0.at];
    const out = dropResult(d.level.cap, g0.stacks[i], c);
    if (out === "noop") { sc.deny(i); buzz(20); return; }
    prevRef.current = g0; setCanTakeBack(true);
    const stacks = cloneStacks(g0.stacks);
    if (out === "pop" || out === "erase") stacks[i].pop(); else stacks[i].push(c);
    const g: Game = { ...g0, stacks: out === "topple" ? g0.stacks : stacks, at: g0.at + 1, over: out === "topple" ? "lose" : "" };
    busy.current = true; buzz(out === "pop" ? 14 : 8);
    sc.play(i, out, c, () => {
      sc.setData(g.stacks);
      sc.syncBelt(d.level.queue.slice(g.at), true);
      setGame(g);
      if (out === "topple") { setTimeout(() => { setSheet("lose"); sfx("lose", { gain: 0.6 }); }, 300); return; }
      busy.current = false;
      if (g.at >= d.level.queue.length) {
        if (g.stacks.every((s) => s.length === 0)) { busy.current = true; setGame({ ...g, over: "win" }); useFlutter.getState().saveCurrent(null); finish(g); }
        else { setGame({ ...g, over: "lose" }); setTimeout(() => { setSheet("lose"); sfx("lose", { gain: 0.6 }); }, 300); }
      }
    });
  };
  const doTapStack = (i: number) => {
    const d = defRef.current, g0 = gameRef.current, sc = sceneRef.current, st = stateRef.current;
    if (!d || !g0 || !sc || busy.current) return;
    if (st.mode === "move") {
      const from = pickRef.current?.stack;
      if (from === undefined) { if (!g0.stacks[i].length) { sc.deny(i); return; } pickRef.current = { stack: i, k: -1 }; sc.setHighlight(i); sfx("select", { gain: 0.4 }); return; }
      if (from === i) { pickRef.current = null; sc.setHighlight(-1); return; }
      const c = g0.stacks[from][g0.stacks[from].length - 1];
      const out = dropResult(d.level.cap, g0.stacks[i], c);
      if (out === "topple" || out === "noop") { sc.deny(i); setToast("That stack is full"); return; }
      if (!useFlutter.getState().useBooster("move")) { setToast("No moves left"); setMode(""); return; }
      const stacks = cloneStacks(g0.stacks); stacks[from].pop(); if (out === "pop") stacks[i].pop(); else stacks[i].push(c);
      prevRef.current = g0; busy.current = true; pickRef.current = null; sc.setHighlight(-1); setMode("");
      sc.moveTop(from, i, out === "pop" ? "pop" : "push", () => { busy.current = false; sc.setData(stacks); const g = { ...g0, stacks, helped: g0.helped + 1 }; setGame(g); checkEnd(g); });
      return;
    }
    if (st.mode === "swap") return; // swap works on blocks
    doDrop(i);
  };
  const doTapBlock = (i: number, k: number) => {
    const g0 = gameRef.current, sc = sceneRef.current, st = stateRef.current;
    if (!g0 || !sc || busy.current || st.mode !== "swap") return;
    const first = pickRef.current;
    if (!first || first.k < 0) { pickRef.current = { stack: i, k }; sc.setSelBlock([i, k]); sfx("select", { gain: 0.4 }); return; }
    if (first.stack === i && first.k === k) { pickRef.current = null; sc.setSelBlock(null); return; }
    const a = g0.stacks[first.stack][first.k], b = g0.stacks[i][k];
    if (a === b) { setToast("Those two are the same"); return; }
    if (!useFlutter.getState().useBooster("swap")) { setToast("No swaps left"); setMode(""); return; }
    const stacks = cloneStacks(g0.stacks); stacks[first.stack][first.k] = b; stacks[i][k] = a;
    prevRef.current = g0; busy.current = true; pickRef.current = null; sc.setSelBlock(null); setMode("");
    sc.swapBlocks([first.stack, first.k], [i, k], () => { busy.current = false; sc.setData(stacks); setGame({ ...g0, stacks, helped: g0.helped + 1 }); });
  };
  const checkEnd = (g: Game) => {
    const d = defRef.current!;
    if (g.at >= d.level.queue.length && g.stacks.every((s) => s.length === 0)) { busy.current = true; setGame({ ...g, over: "win" }); finish(g); }
  };
  const dropRef = useRef(doTapStack), blockRef = useRef(doTapBlock);
  useEffect(() => { dropRef.current = doTapStack; blockRef.current = doTapBlock; });

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const sc = new FlutterScene(host.current, {
      canPlay: () => { const s = stateRef.current; return !s.result && !s.sheet && !s.paused && !busy.current; },
      tapStack: (i) => dropRef.current(i),
      tapBlock: (i, k) => blockRef.current(i, k),
      sound: (e: SceneSound, pan: number) => sfx(e as Sfx, { x: pan, gain: e === "belt" ? 0.3 : e === "hop" ? 0.4 : 0.55, rate: e === "pop" ? 0.95 + Math.random() * 0.15 : undefined }),
    });
    sceneRef.current = sc;
    const d = defRef.current, g = gameRef.current;
    if (d && g) { sc.setStage(g.stacks, d.level.cap); sc.syncBelt(d.level.queue.slice(g.at)); }
    return () => { sc.dispose(); sceneRef.current = null; };
  }, [screen, sfx]);

  const toggle = (m: Mode) => {
    const d = defRef.current; if (!d || busy.current) return;
    if (d.stage < 3 && !d.stage) return;
    const has = useFlutter.getState().boosters[m === "move" ? "move" : "swap"];
    if (!has) { setToast(`No ${m === "move" ? "moves" : "swaps"} left`); return; }
    pickRef.current = null; sceneRef.current?.setHighlight(-1); sceneRef.current?.setSelBlock(null);
    setMode((cur) => (cur === m ? "" : m));
    setToast(m === "move" ? "Tap a stack, then where its top block goes" : "Tap two blocks to swap them");
  };
  const toggleRef = useRef(toggle);
  useEffect(() => { toggleRef.current = toggle; });

  // keys: 1–5 drop, M move, S swap, Escape cancels
  useEffect(() => {
    if (screen !== "game") return;
    const on = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 5) { dropRef.current(n - 1); e.preventDefault(); }
      else if (e.key === "m" || e.key === "M") toggleRef.current("move");
      else if (e.key === "s" || e.key === "S") toggleRef.current("swap");
      else if (e.key === "Escape") { setMode(""); pickRef.current = null; sceneRef.current?.setHighlight(-1); sceneRef.current?.setSelBlock(null); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [screen]);

  // ---------------------------------------------------------------- stages
  const start = useCallback(async (stage: number) => {
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const g: Game = { stacks: cloneStacks(d.level.stacks), at: 0, helped: 0, over: "" };
    defRef.current = d; setDef(d); setGame(g); prevRef.current = null; pickRef.current = null; setCanTakeBack(false);
    setResult(null); setSheet(""); setMode(""); setTookBack(false); busy.current = false;
    setScreen("game");
    const sc = sceneRef.current; if (sc) { sc.setStage(g.stacks, d.level.cap); sc.syncBelt(d.level.queue); }
    const w = worldOf(stage);
    void audio.playMusic(music(w.music));
    audio.warmMusic([music(worldOf(stage + STAGES_PER_WORLD).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    const tips = useFlutter.getState().tips;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, boss: d.boss, powers: stage >= 3, erase: d.level.queue.includes(ERASE) };
    const tip = ["remix", "boss", "powers", "erase"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useFlutter.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); }
    else setToast(`${w.name} · ${d.level.queue.length} blocks`);
    track("flutter_start", { stage });
  }, [sfx, setGame]);

  // ---------------------------------------------------------------- powers
  const nextDrop = useCallback((): number => {
    const d = defRef.current, g = gameRef.current; if (!d || !g) return -1;
    // the level's own plan while the stacks are on it
    const key = (s: Stack[]) => s.map((x) => x.join(",")).join("|");
    const want = key(g.stacks);
    const st = { stacks: cloneStacks(d.level.stacks) };
    for (let k = 0; k < g.at && k < d.plan.length; k++) { const i = d.plan[k], c = d.level.queue[k]; const r = dropResult(d.level.cap, st.stacks[i], c); if (r === "pop" || r === "erase") st.stacks[i].pop(); else st.stacks[i].push(c); }
    if (key(st.stacks) === want && d.plan[g.at] !== undefined) return d.plan[g.at];
    const path = solve(d.level, { stacks: g.stacks, at: g.at }, { n: 40000 });
    return path ? path[0] : -1;
  }, []);
  const doHint = () => {
    const g = gameRef.current, sc = sceneRef.current; if (!g || !sc || busy.current || g.over) return;
    const i = nextDrop();
    if (i < 0) { setToast("No safe way from here — try Undo"); return; }
    if (!useFlutter.getState().useBooster("hint")) { setToast("No hints left"); return; }
    setGame({ ...g, helped: g.helped + 1 }); sc.showHint(i); sfx("hint", { gain: 0.5 }); setToast(`Drop it on stack ${i + 1}`);
  };
  const doTakeBack = () => {
    const prev = prevRef.current, d = defRef.current, sc = sceneRef.current;
    if (!prev || !d || !sc || tookBack) return;
    setTookBack(true); prevRef.current = null; setCanTakeBack(false);
    const g = { ...prev, helped: prev.helped + 1, over: "" as const }; setGame(g); setSheet(""); busy.current = false;
    sc.setStage(g.stacks, d.level.cap); sc.syncBelt(d.level.queue.slice(g.at)); sfx("undo", { gain: 0.5 });
  };
  const doRestart = () => { const d = defRef.current; if (d) void start(d.stage); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __flutter?: unknown }).__flutter = {
      def: () => defRef.current, game: () => gameRef.current, start: (stage: number) => void start(stage),
      drop: (i: number) => dropRef.current(i), busy: () => busy.current, next: () => nextDrop(),
      at: (i: number) => { const r = host.current?.getBoundingClientRect(), p = sceneRef.current?.stackScreen(i); return p && r ? { x: r.left + p.x, y: r.top + p.y } : null; },
    };
  }, [start, nextDrop]);

  const leave = () => { setScreen("home"); setResult(null); setSheet(""); busy.current = false; void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const w = worldOf(screen === "game" ? stage : useFlutter.getState().stage);
  const inS = ((stage - 1) % STAGES_PER_WORLD) + 1;
  const left = def && game ? def.level.queue.length - game.at : 0;
  return (
    <div className="flt-root" style={{ ["--s1" as string]: w.felt[0], ["--s2" as string]: w.felt[1], ["--paint" as string]: "#ff7a5a" }}>
      <style>{FLT_CSS}</style>
      <div className="flt-bg" aria-hidden style={{ ["--bg-wide" as string]: `url(${cdn("/games/flutter-pairs/bg.webp")})`, ["--bg-tall" as string]: `url(${cdn("/games/flutter-pairs/bg-tall.webp")})` }} />
      <div className="flt-bubbles" aria-hidden>{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ left: `${(i * 41) % 100}%`, width: 14 + ((i * 13) % 26), height: 14 + ((i * 13) % 26), animationDuration: `${14 + (i % 5) * 4}s`, animationDelay: `${-i * 2.7}s` }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={(st) => void start(st)} />}

      {screen === "game" && def && game && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-center gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+4px)] pr-[64px] pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="flt-amber grid size-10 shrink-0 place-items-center"><ArrowLeft className="size-5" /></button>
            <div className="min-w-0 flex-1 text-center">
              <p className="flt-display text-xl leading-none" style={{ color: "#5a3a1a", textShadow: "0 2px 0 rgba(255,255,255,.7)" }}>Level {stage}{def.boss ? " · Finale" : def.showcase ? " · Long belt" : ""}</p>
              <p className="text-[11px] font-bold" style={{ color: "#6a4a2a" }}>{w.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_WORLD}</p>
            </div>
            <button type="button" aria-label="Restart" onClick={doRestart} className="flt-amber grid size-10 shrink-0 place-items-center"><RotateCcw className="size-5" /></button>
          </div>
          <div className="flex justify-center pt-1"><span className="flt-chip2">🧶 {left} block{left === 1 ? "" : "s"} on the belt · clear every stack</span></div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="flt-stage" />
            {mode && <div className="flt-chip2 pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 whitespace-nowrap">{mode === "move" ? "Move: tap a stack, then its new place" : "Swap: tap two blocks"}</div>}
          </div>
          <div className="flex items-end justify-center gap-4 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Power icon={MoveUpRight} label="Move" n={boosters.move} color="#ff8a4a" on={mode === "move"} locked={stage < 3} onClick={() => toggle("move")} />
            <Power icon={ArrowRightLeft} label="Swap" n={boosters.swap} color="#8a6aff" on={mode === "swap"} locked={stage < 3} onClick={() => toggle("swap")} />
            <Power icon={Lightbulb} label="Hint" n={boosters.hint} color="#3ab86a" onClick={doHint} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/10">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/60 border-t-[var(--paint)]" /><p className="flt-display text-lg" style={{ color: "#5a3a1a" }}>Stitching the level…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "lose" && !result && (
          <Sheet key="lose" title={game?.at && def && game.at >= def.level.queue.length ? "Blocks left over!" : "The stack toppled!"} onClose={() => undefined}>
            <p className="opacity-85">{game?.at && def && game.at >= def.level.queue.length ? "The belt is empty but some blocks are still standing. Plan the pairs from the start!" : "A different block on a stack at the rope makes it fall. Watch the belt — the next five blocks are always in view."}</p>
            <div className="mt-4 grid gap-2">
              {!tookBack && canTakeBack && <button type="button" className="flt-btn flt-cta flt-shine py-3 text-lg" onClick={doTakeBack}><Undo2 className="mr-1 inline size-5" /> Take it back (once)</button>}
              <button type="button" className={`flt-btn ${!tookBack ? "flt-soft" : "flt-cta"} py-3`} onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useFlutter.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>👆 Tap a stack to drop the block in your hand on it (keys 1–5 work too).</li>
              <li>🦋 Same colour on top? Both blocks grow wings and fly away!</li>
              <li>🌿 Otherwise the block joins the stack — but a stack can&apos;t grow past the leafy rope. A different block on a full stack makes it topple.</li>
              <li>🧶 Clear every stack by the time the belt is empty. You can always see the next five blocks.</li>
            </ul>
            <button type="button" className="flt-btn flt-cta mt-5 w-full py-3 text-lg" onClick={() => { useFlutter.getState().sawHelp(); setSheet(""); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useFlutter.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="flt-btn flt-cta mt-5 w-full py-3 text-lg" onClick={() => { useFlutter.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="flt-chip2 pointer-events-none absolute bottom-32 left-1/2 z-50 -translate-x-1/2 text-sm whitespace-nowrap">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Power({ icon: Icon, label: text, n, color, on, locked, onClick }: { icon: typeof Star; label: string; n: number; color: string; on?: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={text} className={`flt-power ${on ? "on" : ""} ${locked ? "opacity-50" : ""}`} onClick={locked ? undefined : onClick}>
      <span className="flt-power-ico" style={{ background: color }}><Icon className="size-7" />{!locked && <span className="flt-badge">{n}</span>}{locked && <span className="flt-badge">🔒</span>}</span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="flt-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flt-display text-2xl">{title}</h2>
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
      <motion.div className="flt-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="flt-head px-5 pt-5 pb-4">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#fff3a0] text-white" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="flt-display mt-1 text-3xl drop-shadow">{r.worldDone ? "World complete!" : "All flew away!"}</h2>
          <p className="mt-1 text-sm font-bold opacity-90">{r.worldDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="mt-1 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/50 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="flt-btn flt-cta flt-shine flex items-center justify-center gap-2 py-3 text-lg" onClick={onNext}>Level {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="flt-btn flt-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  return (
    <div className="flt-title" role="img" aria-label="Flutter Pairs" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="flt-word flt-w1">{[..."FLUTTER"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: BLOCK_COLS[i % BLOCK_COLS.length], animationDelay: `${i * 0.06}s, ${1 + i * 0.15}s` }}>{ch}</span>)}</div>
      <div className="flt-word flt-w2">{[..."PAIRS"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "#ffffff", animationDelay: `${0.45 + i * 0.07}s, ${1.5 + i * 0.15}s` }}>{ch}</span>)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number) => void }) {
  const save = useFlutter();
  const stage = save.stage, w = worldOf(stage);
  const wi = Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length;
  const remix = passOf(stage) > 0;
  const at = (stage - 1) % STAGES_PER_WORLD;
  return (
    <div className="flt-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Level"], [Star, String(save.totalStars), "Stars"], [Trophy, String(save.pairs), "Pairs flown"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="flt-sheet flex items-center gap-2 !rounded-[18px] px-3 py-2.5 !shadow-none">
                <Icon className="size-6 shrink-0 text-[#ff7a5a]" />
                <span className="min-w-0"><span className="flt-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Flutter Pairs — 3D felt stack and match puzzle</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-bold sm:mx-auto" style={{ color: "#5a3a1a" }}>Drop felt blocks on the stacks — matching pairs sprout wings and fly away. Keep every stack under the leafy rope!</p>

        <div className="flt-sheet flt-shine relative mt-3 overflow-hidden p-5">
          <p className="text-xs font-extrabold tracking-widest uppercase opacity-70">🧶 {w.name}{remix ? " · Remix" : ""}</p>
          <p className="flt-display mt-1 text-5xl leading-none">Level {stage}</p>
          <div className="flt-bar mt-3"><b style={{ width: `${Math.round((at / STAGES_PER_WORLD) * 100)}%` }} /></div>
          <p className="mt-1 text-[11px] font-bold opacity-70">{at} of {STAGES_PER_WORLD} levels in this world</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onPlay(stage)} className="flt-btn flt-cta inline-flex items-center gap-2 px-9 py-3.5 text-2xl"><Play className="size-6 fill-current" /> Play</button>
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="flt-display text-[24px] leading-none" style={{ color: "#5a3a1a" }}>The felt worlds</h2>
          <span className="text-xs font-bold" style={{ color: "#5a3a1a" }}>{STAGES_PER_WORLD} levels each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORLDS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_WORLD) > i || remix, now = i === wi;
            return (
              <div key={s.id} className={`rounded-2xl border-[3px] border-dashed p-3 shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: now ? "#ff7a5a" : "#ffffff", background: `linear-gradient(180deg, ${s.felt[0]}, ${s.felt[1]} 70%, ${s.ground} 70%)`, color: "#3a2a1a" }}>
                <p className="text-[13px] font-extrabold">{s.name}</p>
                <p className="text-[11px] font-bold opacity-80">{now ? `level ${((stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}` : done ? "★ complete" : `from level ${i * STAGES_PER_WORLD + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="flt-sheet mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="flt-display text-lg">How it works</p>
          <p>👆 Tap a stack to drop the block in your hand. A matching top block? The pair flies away on felt wings.</p>
          <p>🌿 Stacks can&apos;t grow past the leafy rope. You always see the next five blocks — plan the pairs ahead.</p>
          <p>🧶 Move and Swap powers help when you&apos;re stuck. 1000 levels across twenty felt worlds, then endless remixes.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-75" style={{ color: "#5a3a1a" }}>Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
