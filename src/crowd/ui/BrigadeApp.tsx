"use client";
// Blob Brigade front-end: title (with the brigade marching behind it), the stage map, the stage card, the game with
// its HUD, results and settings. A soft clay-toy look — pastel boards, chunky buttons — unlike the racing games.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Lock, Play, RotateCcw, Settings2, Star, Map as MapIcon, ChevronRight } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import {
  DAILY_MODS, REMIX_START, RUSH, STAGES, TIER_NAMES, TYPE_INFO, VILLAINS, WORLDS, buildStage, dailyInfo, dailyKey, dailySpec, endlessOpen, endlessSpec,
  remixDef, remixLoop, remixSpec, remixTier, rushSpec, stageOpen, villainOf, type StageDef,
} from "../levels";
import { BUBBLES, HATS, LEADERS, UPGRADES, leaderOf, upgradeCost, type Loadout, type Look, type Progress } from "../leaders";
import { BRIGADE_CSS, BrigadeSession, type HudState, type Toast } from "../session";
import { autoQuality, useBrigade, useBrigadeHydrated } from "../save";
import type { MathMode, SimEvent, SimResult, StageSpec } from "../types";

type Screen = "title" | "map" | "game" | "results" | "settings" | "leaders" | "shop" | "wardrobe";
type Mode = "stage" | "endless" | "remix" | "daily" | "rush";
type Launch = { mode: "stage"; def: StageDef } | { mode: "endless" } | { mode: "remix"; n: number } | { mode: "daily" } | { mode: "rush" };
interface GameRun { key: number; spec: StageSpec; def: StageDef | null; mode: Mode; launch: Launch; n?: number; dkey?: string }
interface ResultInfo {
  res: SimResult; def: StageDef | null; reward: number; newBest: boolean; prevStars: number; endlessBest: boolean; bestWave: number;
  mode: Mode; n?: number; dkey?: string; streak?: number; rushTime?: number; unlocked: string[];
}
const progressOf = (st: ReturnType<typeof useBrigade.getState>): Progress => ({
  stars: st.totalStars(), starsBy: st.stars, remixBest: st.remixBest, bestStreak: st.daily.bestStreak, rushCleared: st.rush.cleared,
});
const bigOpen = (stars: Record<string, number>) => (stars["castle-10"] ?? 0) > 0;

const UI_SOUNDS: Sound[] = ["v:kranky_laugh", "v:kranky_wow", "v:gloop_wow", "v:gloop_laugh", "v:bonbon_laugh", "a:splat", "a:zap", "a:poof", "a:rocket", "a:whistle", "a:blip", "a:bubble", "pop", "squish", "a:coin", "a:ding", "a:bwomp", "a:whooshIn", "a:clunk", "a:tink", "a:crunch", "confetti", "a:cheer", "a:kazoo", "a:gong", "a:bonk", "tada", "impact", "a:levelup", "a:go", "a:perfect", "a:applause", "sadtrombone", "a:click", "a:whooshOut"];
const music = (w: number, act: boolean, boss = false): MusicName => (boss ? "a:brigade_boss_action" : `a:brigade_${WORLDS[w]?.music ?? "march"}_${act ? "action" : "calm"}`);
const tintOf = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const m = (c: number) => Math.round(c + (255 - c) * (1 - a)); return `rgb(${m(r)},${m(g)},${m(b)})`; };
const isAutomation = () => typeof navigator !== "undefined" && Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver);
const isPhone = () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false) && Math.min(window.innerWidth, window.innerHeight) < 600;
/** a tap: click sound + a tiny haptic tick on phones */
const ui = (s: Sound = "a:click", gain = 0.4) => {
  audio.play(s, { gain, duck: false });
  if (useBrigade.getState().settings.vibrate && typeof navigator !== "undefined" && navigator.vibrate) { try { navigator.vibrate(8); } catch { /* blocked */ } }
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
/** phones: play like an app — fullscreen and portrait (Android; iPhone Safari keeps its bars, which is fine) */
async function appMode() {
  if (!isPhone() || isAutomation()) return;
  try {
    const d = document as Document & { webkitFullscreenElement?: Element };
    if (!(document.fullscreenElement || d.webkitFullscreenElement)) {
      const el = document.documentElement as FsEl;
      await (el.requestFullscreen?.({ navigationUI: "hide" }) ?? el.webkitRequestFullscreen?.());
    }
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o?.lock?.("portrait").catch(() => {});
  } catch { /* not supported */ }
}

// ------------------------------------------------------------------ kit
type Tone = "orange" | "mint" | "pink" | "blue" | "purple" | "white" | "ghost";
const TONES: Record<Tone, string> = {
  orange: "bg-[#FF8A3D] text-white shadow-[0_6px_0_#C95A14] active:shadow-[0_2px_0_#C95A14]",
  mint: "bg-[#2FCB8B] text-white shadow-[0_6px_0_#178A5C] active:shadow-[0_2px_0_#178A5C]",
  pink: "bg-[#FF5FA2] text-white shadow-[0_6px_0_#C2306F] active:shadow-[0_2px_0_#C2306F]",
  blue: "bg-[#3D8BFF] text-white shadow-[0_6px_0_#1E5BC2] active:shadow-[0_2px_0_#1E5BC2]",
  purple: "bg-[#8F6BFF] text-white shadow-[0_6px_0_#5A3DC2] active:shadow-[0_2px_0_#5A3DC2]",
  white: "bg-white text-[#2B1D52] shadow-[0_6px_0_#C9BFE6] active:shadow-[0_2px_0_#C9BFE6]",
  ghost: "bg-white/70 text-[#2B1D52] shadow-[0_4px_0_rgba(43,29,82,0.18)] active:shadow-[0_1px_0_rgba(43,29,82,0.18)]",
};
function Btn({ tone = "orange", big, className = "", children, onClick, disabled, label }: { tone?: Tone; big?: boolean; className?: string; children: ReactNode; onClick?: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={() => { ui(); onClick?.(); }}
      className={`inline-flex items-center justify-center gap-2 rounded-[22px] font-display tracking-wide transition-[transform,box-shadow] duration-75 active:translate-y-1 disabled:pointer-events-none disabled:opacity-45 ${big ? "min-h-16 px-7 text-2xl" : "min-h-12 px-5 text-lg"} ${TONES[tone]} ${className}`}>
      {children}
    </button>
  );
}
function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 font-display text-[15px] text-[#2B1D52] shadow-[0_3px_0_rgba(43,29,82,0.18)] ${className}`}>{children}</span>;
}
function Stars({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => <Star key={i} style={{ width: size, height: size }} className={i < n ? "fill-[#FFC93C] text-[#E0A100]" : "fill-white/50 text-[#2B1D52]/25"} />)}
    </span>
  );
}
function TopBar({ title, sub, onBack, right }: { title: string; sub?: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pr-16 pl-4 pb-2" style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)" }}>
      <button type="button" aria-label="Back" onClick={() => { ui("a:whooshOut", 0.3); onBack(); }} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-[#2B1D52] shadow-[0_4px_0_#C9BFE6] active:translate-y-1 active:shadow-none"><ArrowLeft className="size-6" /></button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[26px] leading-tight text-[#2B1D52]">{title}</h1>
        {sub && <p className="truncate text-sm font-semibold text-[#2B1D52]/60">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
/** soft pastel sky with drifting blobs */
function Backdrop({ w = 0 }: { w?: number }) {
  const W0 = WORLDS[w] ?? WORLDS[0];
  const bg = w === 0 ? "linear-gradient(180deg,#BDEBFF 0%,#DDF7E4 55%,#B9EDB0 100%)" : w === 1 ? "linear-gradient(180deg,#FFD6EC 0%,#FFE9F4 55%,#E9D8FF 100%)"
    : `linear-gradient(180deg,${tintOf(W0.accent2, 0.35)} 0%,${tintOf(W0.accent, 0.12)} 55%,${tintOf(W0.accent, 0.32)} 100%)`;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: bg }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="bb-drift absolute rounded-full opacity-50" style={{
          left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, width: 40 + (i % 4) * 26, height: 34 + (i % 4) * 22,
          background: ["#FF8A3D", "#FFD23F", "#7CE0FF", "#FF7AB6", "#9FF0B5"][i % 5], animationDelay: `${-i * 1.7}s`, animationDuration: `${11 + (i % 5) * 3}s`,
        }} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ the 3D view (game or title attract)
function GameCanvas({ spec, attract, onReady, quality, sensitivity, vibrate, onEnd, onToast, onEvent, loadout, look }: {
  spec: StageSpec; attract?: boolean; quality: "low" | "medium" | "high"; sensitivity?: number; vibrate?: boolean; loadout?: Loadout; look?: Look;
  onReady?: (s: BrigadeSession) => void; onEnd?: (r: SimResult) => void; onToast?: (t: Toast) => void; onEvent?: (e: SimEvent) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onEnd, onToast, onEvent });
  useEffect(() => { cb.current = { onReady, onEnd, onToast, onEvent }; });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const s = new BrigadeSession(el, spec, {
      quality, attract, sensitivity, vibrate, loadout, look,
      onEnd: (r) => cb.current.onEnd?.(r), onToast: (t) => cb.current.onToast?.(t), onEvent: (e) => cb.current.onEvent?.(e),
    });
    cb.current.onReady?.(s);
    return () => s.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, attract, quality, sensitivity, vibrate]);
  return <div ref={host} className="absolute inset-0" />;
}

// ------------------------------------------------------------------ the app
export default function BrigadeApp({ title }: { slug: string; title: string }) {
  const ready = useBrigadeHydrated();
  const s = useBrigade();
  const player = usePlayer();
  const { setImmersive, setLoading, setInRound, setMenu } = player;
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<GameRun | null>(null);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [sheet, setSheet] = useState<StageDef | null>(null);
  const [world, setWorld] = useState(0);
  const quality = s.settings.quality === "auto" ? autoQuality() : s.settings.quality;
  const stars = s.totalStars();
  // a locked leader (e.g. after a reset) falls back to Momo
  const leaderOk = (leaderOf(s.leader).unlock ?? 0) <= stars ? s.leader : "momo";
  const loadout = useMemo<Loadout>(() => ({ leader: leaderOk, up: s.upgrades }), [leaderOk, s.upgrades]);
  const look = s.look;

  useEffect(() => { setLoading(null); }, [setLoading]);
  useEffect(() => { void audio.preload(UI_SOUNDS); }, []);
  // the site chrome stays on the title screen; every other screen has its own bar (and the site's pause button)
  useEffect(() => { setImmersive(screen !== "title"); setInRound(screen === "game"); }, [screen, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => {
    if (screen === "game") return;
    void audio.playMusic(music(screen === "results" && result?.def ? result.def.world : world, false));
    // (Daily, Boss Rush and Endless results reuse the current world's calm track)
  }, [screen, world, result]);

  const titleSpec = useMemo(() => buildStage(STAGES[1], "off"), []);

  const start = useCallback((l: Launch) => {
    const math: MathMode = useBrigade.getState().settings.math;
    let spec: StageSpec, def: StageDef | null = null, n: number | undefined, dkey: string | undefined;
    if (l.mode === "stage") { def = l.def; spec = buildStage(def, math); }
    else if (l.mode === "remix") { n = l.n; def = remixDef(n); spec = remixSpec(n, math); }
    else if (l.mode === "daily") { dkey = dailyKey(); spec = dailySpec(dkey, math); }
    else if (l.mode === "rush") spec = rushSpec(math);
    else spec = endlessSpec(Math.floor(Math.random() * 1e6), math);
    setSheet(null); setResult(null);
    setRun((r) => ({ key: (r?.key ?? 0) + 1, spec, def, mode: l.mode, launch: l, n, dkey }));
    if (def) setWorld(def.world);
    setScreen("game");
  }, []);

  const onEnd = useCallback((res: SimResult) => {
    if (!run) return;
    const st = useBrigade.getState(), before = progressOf(st);
    const def = run.def;
    const prevStars = def && run.mode === "stage" ? st.stars[def.id] ?? 0 : 0;
    let newBest = false, endlessBest = false, reward = 0, streak = 0;
    if (run.mode === "stage" && def) {
      st.setStars(def.id, res.stars);
      newBest = res.won && st.setBest(def.id, res.count);
      reward = res.coins + res.stars * 10 + (res.won ? 15 : 0);
    } else if (run.mode === "remix" && run.n) {
      if (res.won) newBest = st.clearRemix(run.n);
      reward = res.coins + res.stars * 12 + (res.won ? 25 : 0);
    } else if (run.mode === "daily" && run.dkey) {
      if (res.won) streak = st.dailyDone(run.dkey, res.stars);
      reward = res.coins + res.stars * 15 + (streak > 0 ? 40 + streak * 5 : 0);
    } else if (run.mode === "rush") {
      newBest = st.setRush(res.time, res.wave ?? 0, res.won);
      // a long run pops thousands of Grumpies: half of those coins, plus a bonus per villain
      reward = Math.round(res.coins * 0.5) + (res.wave ?? 0) * 10 + (res.won ? 60 : 0);
    } else {
      endlessBest = st.setEndless(res.wave ?? 1, res.score ?? 0);
      reward = res.coins + (res.wave ?? 1) * 5;
    }
    st.record(res.won, res.pops, reward);
    useProfile.getState().earnCoins(reward);
    const after = progressOf(useBrigade.getState());
    const unlocked = [...HATS, ...BUBBLES].filter((c) => !c.open(before) && c.open(after)).map((c) => `${c.icon} ${c.name}`);
    const now = useBrigade.getState();
    setResult({ res, def, reward, newBest, prevStars, endlessBest, bestWave: now.endless.wave, mode: run.mode, n: run.n, dkey: run.dkey, streak, rushTime: now.rush.bestTime, unlocked });
    setScreen("results");
  }, [run]);

  // pause menu (the site player's pause button)
  useEffect(() => {
    if (screen !== "game") return;
    setMenu([
      { id: "restart", label: "Restart", icon: "🔄", onSelect: () => { player.setPaused(false); if (run) start(run.launch); } },
      { id: "map", label: "Stage map", icon: "🗺️", onSelect: () => { player.setPaused(false); setScreen("map"); } },
    ]);
  }, [screen, run, setMenu, start, player]);

  if (!ready) return <div className="absolute inset-0 bg-[#DDF7E4]" />;
  const next = result?.mode === "stage" && result.def ? STAGES[result.def.n] : undefined;
  const nextOpen = next ? stageOpen(next, s.stars) : false;
  const progress = progressOf(s);
  const today = dailyKey();
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return dailyKey(d); })();
  // a streak only counts while it is alive (played today or yesterday)
  const streak = s.daily.doneKey === today || s.daily.doneKey === yesterday ? s.daily.streak : 0;

  return (
    <div className="bb-root absolute inset-0 overflow-hidden text-[#2B1D52] select-none" onContextMenu={(e) => e.preventDefault()}>
      <style>{BRIGADE_CSS + APP_CSS}</style>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={screen === "game" ? `game-${run?.key}` : screen} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="absolute inset-0">
          {screen === "title" && (
            <TitleScreen title={title} spec={titleSpec} quality={quality} stars={stars} best={s.endless.wave} endless={endlessOpen(s.stars)}
              leader={s.leader} onLeaders={() => setScreen("leaders")} onShop={() => setScreen("shop")}
              onWardrobe={() => setScreen("wardrobe")} streak={streak} dailyDone={s.daily.doneKey === today}
              onDaily={() => { void appMode(); start({ mode: "daily" }); }}
              onPlay={() => { void appMode(); setScreen("map"); }} onEndless={() => { void appMode(); start({ mode: "endless" }); }} onSettings={() => setScreen("settings")} />
          )}
          {screen === "map" && (
            <MapScreen stars={s.stars} total={stars} world={world} setWorld={setWorld} endless={endlessOpen(s.stars)} bestWave={s.endless.wave}
              onBack={() => setScreen("title")} onPick={(d) => setSheet(d)} onEndless={() => start({ mode: "endless" })}
              remixNext={Math.max(REMIX_START, s.remixBest + 1)} bigOpen={bigOpen(s.stars)} onRemix={(n) => start({ mode: "remix", n })} onRush={() => start({ mode: "rush" })}
              rush={s.rush} dailyDone={s.daily.doneKey === today} streak={streak} todayKey={today} onDaily={() => start({ mode: "daily" })} />
          )}
          {screen === "game" && run && (
            <GameScreen key={run.key} run={run} quality={quality} sensitivity={s.settings.sensitivity} vibrate={s.settings.vibrate} loadout={loadout} look={look}
              tutorial={!s.tutorialDone && run.def?.n === 1 && !isAutomation()} onTutorialDone={() => useBrigade.getState().setTutorialDone(true)} onEnd={onEnd} />
          )}
          {screen === "results" && result && (
            <ResultsScreen info={result} hasNext={(!!next && nextOpen) || (result.mode === "remix" && result.res.won)}
              onNext={() => { if (result.mode === "remix" && result.n) start({ mode: "remix", n: result.n + 1 }); else if (next) start({ mode: "stage", def: next }); }}
              onRetry={() => run && start(run.launch)} onMap={() => setScreen(result.mode === "stage" || result.mode === "remix" ? "map" : "title")} />
          )}
          {screen === "settings" && <SettingsScreen onBack={() => setScreen("title")} />}
          {screen === "leaders" && <LeadersScreen total={stars} onBack={() => setScreen("title")} />}
          {screen === "shop" && <ShopScreen onBack={() => setScreen("title")} />}
          {screen === "wardrobe" && <WardrobeScreen progress={progress} onBack={() => setScreen("title")} />}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>{sheet && <StageSheet def={sheet} stars={s.stars[sheet.id] ?? 0} best={s.best[sheet.id] ?? 0} onClose={() => setSheet(null)} onPlay={() => start({ mode: "stage", def: sheet })} />}</AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ title
function TitleScreen({ title, spec, quality, stars, best, endless, onPlay, onEndless, onSettings, leader, onLeaders, onShop, onWardrobe, onDaily, streak, dailyDone }: {
  title: string; spec: StageSpec; quality: "low" | "medium" | "high"; stars: number; best: number; endless: boolean; onPlay: () => void; onEndless: () => void; onSettings: () => void;
  leader: Loadout["leader"]; onLeaders: () => void; onShop: () => void; onWardrobe: () => void; onDaily: () => void; streak: number; dailyDone: boolean;
}) {
  const L = leaderOf(leader);
  return (
    <div className="absolute inset-0">
      <GameCanvas spec={spec} attract quality={quality === "high" ? "medium" : quality} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/70 via-transparent to-white/80" />
      <div className="absolute inset-x-0 top-0 flex flex-col items-center px-4 text-center" style={{ paddingTop: "calc(var(--safe-top) + 4.2rem)" }}>
        <p className="font-display text-sm tracking-[0.25em] text-[#FF8A3D]">MOMOBLOBS</p>
        <h1 className="bb-logo font-display text-[clamp(44px,13vw,84px)] leading-[0.92]">
          {title.toUpperCase().split(" ").map((w, i) => (
            <span key={w} className="block">{w.split("").map((c, j) => <span key={j} className="bb-wob inline-block" style={{ animationDelay: `${(i * 5 + j) * 0.09}s`, color: i ? "#FF8A3D" : "#3D8BFF" }}>{c}</span>)}</span>
          ))}
        </h1>
        <p className="mt-2 max-w-xs text-[15px] font-semibold text-[#2B1D52]/75">From one little blob to a mighty brigade!</p>
        <div className="mt-3 flex gap-2"><Chip><Star className="size-4 fill-[#FFC93C] text-[#E0A100]" />{stars} / {STAGES.length * 3}</Chip>{best > 0 && <Chip>🌊 Best wave {best}</Chip>}</div>
      </div>
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-3 px-5" style={{ paddingBottom: "calc(var(--safe-bottom) + 1.4rem)" }}>
        <Btn big tone="orange" onClick={onPlay} className="w-full"><Play className="size-7 fill-current" />PLAY</Btn>
        <div className="grid grid-cols-2 gap-3">
          <Btn tone={endless ? "pink" : "ghost"} onClick={onDaily} disabled={!endless} className="w-full px-2">{endless ? <>📅 DAILY{dailyDone ? " ✓" : ""}{streak > 0 ? ` 🔥${streak}` : ""}</> : <><Lock className="size-4" />DAILY</>}</Btn>
          <Btn tone={endless ? "purple" : "ghost"} onClick={onEndless} disabled={!endless} className="w-full px-2">{endless ? "🌊 ENDLESS" : <><Lock className="size-4" />ENDLESS</>}</Btn>
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Btn tone="blue" onClick={onLeaders} className="w-full px-2 text-base"><img src={L.img} alt="" className="size-7 rounded-full bg-white object-cover" />LEADERS</Btn>
          <Btn tone="mint" onClick={onShop} className="w-full px-2 text-base">SHOP</Btn>
          <Btn tone="white" onClick={onWardrobe} label="Wardrobe" className="w-12 !px-0 text-2xl">🎩</Btn>
          <Btn tone="white" onClick={onSettings} label="Settings" className="w-12 !px-0"><Settings2 className="size-6" /></Btn>
        </div>
        {!endless && <p className="-mt-1 text-center text-[12.5px] font-bold text-[#2B1D52]/60">Beat stage 3 to open Daily and Endless</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ stage map
function MapScreen({ stars, total, world, setWorld, endless, bestWave, onBack, onPick, onEndless, remixNext, bigOpen: big, onRemix, onRush, rush, dailyDone, streak, todayKey, onDaily }: {
  stars: Record<string, number>; total: number; world: number; setWorld: (w: number) => void; endless: boolean; bestWave: number;
  onBack: () => void; onPick: (d: StageDef) => void; onEndless: () => void;
  remixNext: number; bigOpen: boolean; onRemix: (n: number) => void; onRush: () => void; rush: { bestTime: number; bestBosses: number; cleared: boolean };
  dailyDone: boolean; streak: number; todayKey: string; onDaily: () => void;
}) {
  const di = dailyInfo(todayKey), rd = remixDef(remixNext);
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop w={world} />
      <div className="relative z-10"><TopBar title="Stage Map" sub={`${total} of ${STAGES.length * 3} stars`} onBack={onBack} right={<Chip><Star className="size-4 fill-[#FFC93C] text-[#E0A100]" />{total}</Chip>} /></div>
      <div ref={scroller} className="relative z-10 flex-1 overflow-y-auto px-4 pb-8" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto flex max-w-xl flex-col gap-5">
          {WORLDS.map((w, wi) => {
            const list = STAGES.filter((d) => d.world === wi);
            const got = list.reduce((a, d) => a + (stars[d.id] ?? 0), 0);
            const open = stageOpen(list[0], stars);
            return (
              <section key={w.id} onPointerEnter={() => setWorld(wi)} className="relative overflow-hidden rounded-[28px] bg-white/80 p-4 shadow-[0_6px_0_rgba(43,29,82,0.15)] ring-2 ring-white">
                <div className="flex items-center gap-3">
                  <span className="grid size-14 place-items-center rounded-2xl text-3xl" style={{ background: `${w.accent}33` }}>{w.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-2xl leading-tight" style={{ color: w.accent }}>{w.name}</h2>
                    <p className="text-[13px] font-semibold text-[#2B1D52]/60">New: {w.newIdea}</p>
                  </div>
                  <Chip><Star className="size-4 fill-[#FFC93C] text-[#E0A100]" />{got}/30</Chip>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-x-2 gap-y-4">
                  {list.map((d) => {
                    const st = stars[d.id] ?? 0, can = stageOpen(d, stars), nextUp = can && st === 0;
                    return (
                      <button key={d.id} type="button" disabled={!can} onClick={() => { ui(); setWorld(wi); onPick(d); }}
                        className="group flex flex-col items-center gap-1 disabled:opacity-60" aria-label={`Stage ${d.s}: ${d.name}`}>
                        <span className={`relative grid size-14 place-items-center rounded-full font-display text-xl text-white transition-transform group-active:scale-90 ${nextUp ? "bb-pulse" : ""}`}
                          style={{ background: can ? (d.type === "boss" ? "#FF5FA2" : d.type === "pinata" ? "#8F6BFF" : w.accent) : "#B9B3CC", boxShadow: `0 5px 0 ${can ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.12)"}` }}>
                          {can ? (d.type === "boss" ? "👑" : d.type === "pinata" ? "🪅" : d.s) : <Lock className="size-5" />}
                        </span>
                        <Stars n={st} size={13} />
                      </button>
                    );
                  })}
                </div>
                {!open && (
                  <div className="absolute inset-0 grid place-items-center bg-white/55 backdrop-blur-[2px]">
                    <Chip className="text-base"><Lock className="size-4" />{w.unlockStars > total ? `Earn ${w.unlockStars}★ to open` : "Beat the last world's boss"}</Chip>
                  </div>
                )}
              </section>
            );
          })}
          <ModeCard emoji="🔁" color="#E8504F" title={`Remix Loop · R${remixNext - 100}`} open={big} onPlay={() => onRemix(remixNext)}
            text={big ? `Loop ${remixLoop(remixNext)} · ${TIER_NAMES[remixTier(remixNext)]} · ${WORLDS[rd.world].name} ${TYPE_INFO[rd.type].label}. New layouts forever!` : "Beat King Kranky Mech (10-10) to open"} />
          <ModeCard emoji="📅" color="#FF5FA2" title={`Daily Challenge${dailyDone ? " ✓" : ""}`} open={endless} onPlay={onDaily}
            text={endless ? `${DAILY_MODS[di.mod].icon} ${DAILY_MODS[di.mod].name} in ${WORLDS[di.world].name}${streak ? ` · 🔥 ${streak}-day streak` : ""}` : "Beat stage 3 to open"} />
          <ModeCard emoji="👑" color="#C9A227" title="Boss Rush" open={big} onPlay={onRush}
            text={big ? (rush.cleared ? `All ${RUSH.length} beaten · best ${rush.bestTime.toFixed(1)} s` : rush.bestBosses ? `Best: ${rush.bestBosses} of ${RUSH.length} villains` : `All ${RUSH.length} villains in a row. How fast can you go?`) : "Beat King Kranky Mech (10-10) to open"} />
          <section className="flex items-center gap-3 rounded-[28px] bg-[#2B1D52] p-4 text-white shadow-[0_6px_0_rgba(43,29,82,0.35)]">
            <span className="grid size-14 place-items-center rounded-2xl bg-white/10 text-3xl">🌊</span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl leading-tight">Endless Waves</h2>
              <p className="text-[13px] font-semibold text-white/65">{endless ? (bestWave ? `Best: wave ${bestWave}` : "How many waves can you hold?") : "Beat stage 3 to open"}</p>
            </div>
            <Btn tone={endless ? "purple" : "ghost"} disabled={!endless} onClick={onEndless}>{endless ? <Play className="size-5 fill-current" /> : <Lock className="size-5" />}</Btn>
          </section>
        </div>
      </div>
    </div>
  );
}

function StageSheet({ def, stars, best, onClose, onPlay }: { def: StageDef; stars: number; best: number; onClose: () => void; onPlay: () => void }) {
  const info = TYPE_INFO[def.type], w = WORLDS[def.world];
  const goal = useMemo(() => buildStage(def, "plus").goal.text, [def]);
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-[#2B1D52]/40 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} transition={{ type: "spring", damping: 24, stiffness: 300 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[32px] bg-white p-5 shadow-2xl sm:rounded-[32px]" style={{ paddingBottom: "calc(var(--safe-bottom) + 1.25rem)" }}>
        <div className="flex items-center gap-3">
          <span className="grid size-16 place-items-center rounded-3xl text-4xl" style={{ background: `${w.accent}2E` }}>{info.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm tracking-widest" style={{ color: w.accent }}>{w.name.toUpperCase()} · STAGE {def.s}</p>
            <h2 className="font-display text-[28px] leading-tight">{def.name}</h2>
          </div>
        </div>
        <p className="mt-3 text-[15px] font-semibold text-[#2B1D52]/75">{info.blurb}</p>
        {def.s === 1 && def.world >= 2 && <p className="mt-2 rounded-2xl px-3 py-2 text-[14px] font-extrabold text-white" style={{ background: w.accent }}>New here: {w.newIdea}. {w.blurb}</p>}
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#2B1D52] px-3 py-2.5 text-white">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-2xl">{VILLAINS[villainOf(def)].emoji}</span>
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight">Villain: {VILLAINS[villainOf(def)].name}</p>
            <p className="text-[13px] font-semibold text-white/70">{VILLAINS[villainOf(def)].how}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Row icon="⭐">Win the stage</Row>
          <Row icon="⭐⭐">{def.type === "pinata" ? "Pop 7 of 10 piñatas" : "Keep 40% of your biggest brigade"}</Row>
          <Row icon="⭐⭐⭐">{goal}</Row>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm font-bold text-[#2B1D52]/60">
          <span>Your stars <Stars n={stars} size={16} /></span>{best > 0 && <span>Best brigade {best}</span>}
        </div>
        <Btn big tone="orange" onClick={onPlay} className="mt-4 w-full"><Play className="size-7 fill-current" />PLAY</Btn>
      </motion.div>
    </motion.div>
  );
}
const ModeCard = ({ emoji, color, title, text, open, onPlay }: { emoji: string; color: string; title: string; text: string; open: boolean; onPlay: () => void }) => (
  <section className="flex items-center gap-3 rounded-[28px] p-4 text-white shadow-[0_6px_0_rgba(43,29,82,0.3)]" style={{ background: open ? color : "#8C86A0" }}>
    <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-3xl">{emoji}</span>
    <div className="min-w-0 flex-1">
      <h2 className="font-display text-2xl leading-tight">{title}</h2>
      <p className="text-[13px] font-semibold text-white/80">{text}</p>
    </div>
    <Btn tone={open ? "white" : "ghost"} disabled={!open} onClick={onPlay}>{open ? <Play className="size-5 fill-current" /> : <Lock className="size-5" />}</Btn>
  </section>
);
const Row = ({ icon, children }: { icon: string; children: ReactNode }) => (
  <div className="flex items-center gap-3 rounded-2xl bg-[#F4F0FF] px-3 py-2.5 text-[15px] font-bold"><span className="w-16 shrink-0 text-center text-sm">{icon}</span>{children}</div>
);

// ------------------------------------------------------------------ the game + HUD
interface ToastItem extends Toast { id: number }
interface HudView extends HudState { goal: { met: boolean; extra?: string }; pinatas: number; pinatasTotal: number; power: number }
function GameScreen({ run, quality, sensitivity, vibrate, tutorial, onTutorialDone, onEnd, loadout, look }: {
  run: GameRun; quality: "low" | "medium" | "high"; sensitivity: number; vibrate: boolean; tutorial: boolean; onTutorialDone: () => void; onEnd: (r: SimResult) => void; loadout: Loadout; look: Look;
}) {
  const player = usePlayer();
  const sess = useRef<BrigadeSession | null>(null);
  const [hud, setHud] = useState<HudView | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [tip, setTip] = useState(tutorial ? 0 : -1);
  const [bossMusic, setBossMusic] = useState(false);
  const [flash, setFlash] = useState(0);
  const tid = useRef(0);
  const doneRef = useRef(onTutorialDone);
  useEffect(() => { doneRef.current = onTutorialDone; });
  const def = run.def, spec = run.spec, w = def?.world ?? spec.world ?? 0;

  useEffect(() => { void audio.playMusic(music(w, true, bossMusic || run.mode === "rush")); }, [w, bossMusic, run.mode]);
  useEffect(() => {
    const iv = setInterval(() => {
      const s = sess.current;
      if (s) setHud({ ...s.hud(), goal: goalProgress(s, run.spec), pinatas: s.sim.stats.pinatas, pinatasTotal: s.sim.stats.pinatasTotal, power: s.power });
    }, 120);
    return () => clearInterval(iv);
  }, [run.spec]);
  useEffect(() => { const s = sess.current; if (!s) return; if (player.paused) s.pause(); else s.resume(); }, [player.paused]);
  // tutorial: drag, then the +1 tiles, then done
  useEffect(() => {
    if (tip < 0) return;
    if (tip >= 2) { doneRef.current(); return; }
    const s = sess.current;
    const start = s?.sim.tx ?? 0;
    const iv = setInterval(() => {
      const cur = sess.current;
      if (!cur) return;
      if (tip === 0 && Math.abs(cur.sim.tx - start) > 1.2) setTip(1);
      if (tip === 1 && cur.sim.stats.recruits >= 3) setTip(2);
    }, 150);
    const to = setTimeout(() => setTip((t) => (t === tip ? t + 1 : t)), tip === 0 ? 7000 : 9000);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, [tip]);

  const onToast = useCallback((t: Toast) => {
    const id = ++tid.current;
    setToasts((l) => [...l.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), t.big ? 1700 : 1300);
  }, []);
  const onEvent = useCallback((e: SimEvent) => {
    if (e.t === "bossIn") setBossMusic(true);
    if ((e.t === "land" && e.hit) || e.t === "bossSmash" || (e.t === "hit" && e.n >= 3)) setFlash((f) => f + 1);
    if (e.t === "bossDown" || e.t === "bossSmash") setBossMusic(false);
  }, []);
  const onReady = useCallback((s: BrigadeSession) => {
    sess.current = s;
    if (process.env.NODE_ENV !== "production" || isAutomation()) (window as unknown as { __brigade?: BrigadeSession }).__brigade = s;
  }, []);

  const h = hud;
  const left = h ? Math.max(0, Math.min(1, h.hpLeft / Math.max(1, h.hpTotal))) : 1;
  const pinata = spec.type === "pinata";
  const goal = spec.goal;
  const goalNow = h?.goal ?? null;
  const recLeft = spec.lanes.findIndex((l) => l.kind === "recruit") === 0;

  return (
    <div className="absolute inset-0 bg-[#DDF7E4]">
      <GameCanvas spec={spec} quality={quality} sensitivity={sensitivity} vibrate={vibrate} onReady={onReady} onEnd={onEnd} onToast={onToast} onEvent={onEvent} loadout={loadout} look={look} />
      {/* top HUD (the site's pause button sits top-right) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-1.5 px-3" style={{ paddingTop: "calc(var(--safe-top) + 0.55rem)" }}>
        <div className="flex w-full max-w-md items-center gap-2 pr-14">
          <span className="rounded-full bg-white/90 px-3 py-1 font-display text-[15px] whitespace-nowrap shadow-[0_3px_0_rgba(43,29,82,0.18)]">
            {run.mode === "endless" ? `🌊 WAVE ${h?.wave ?? 1}` : run.mode === "rush" ? `👑 ${h?.wave ?? 1}/${RUSH.length}` : run.mode === "remix" ? `🔁 R${(run.n ?? 101) - 100}` : run.mode === "daily" ? "📅 DAILY" : `${WORLDS[w].emoji} ${def?.world != null ? `${def.world + 1}-${def.s}` : ""}`}
          </span>
          <div className="relative h-7 flex-1 overflow-hidden rounded-full bg-white/80 shadow-[0_3px_0_rgba(43,29,82,0.18)] ring-2 ring-white">
            {pinata ? (
              <div className="absolute inset-y-0 left-0 rounded-full bg-[#B26BFF] transition-[width] duration-200" style={{ width: `${((h?.pinatas ?? 0) / Math.max(1, h?.pinatasTotal ?? 10)) * 100}%` }} />
            ) : (
              <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#8F86B8] to-[#B3A9E0] transition-[width] duration-200" style={{ width: `${left * 100}%` }} />
            )}
            <span className="absolute inset-0 grid place-items-center font-display text-[13px] text-[#2B1D52]">
              {pinata ? `🪅 ${h?.pinatas ?? 0} / ${h?.pinatasTotal ?? 10} piñatas` : left > 0 ? `😠 Grumpies left ${Math.ceil(left * 100)}%` : "😊 All cheered up!"}
            </span>
          </div>
          <span className="rounded-full bg-white/90 px-2.5 py-1 font-display text-[15px] whitespace-nowrap shadow-[0_3px_0_rgba(43,29,82,0.18)]">🪙 {h?.coins ?? 0}</span>
        </div>
        {run.mode !== "endless" && run.mode !== "rush" && goalNow && (
          <span className={`rounded-full px-3 py-0.5 text-[12.5px] font-extrabold shadow-[0_2px_0_rgba(43,29,82,0.15)] ${goalNow.met ? "bg-[#2FCB8B] text-white" : "bg-white/80 text-[#2B1D52]/80"}`}>
            {goalNow.met ? "✓ " : "⭐ "}{goal.text}{goalNow.extra ? ` · ${goalNow.extra}` : ""}
          </span>
        )}
        {h?.boss && (
          <div className="mt-1 w-full max-w-sm">
            <div className="flex items-center justify-between px-1 font-display text-[14px] text-white [text-shadow:0_2px_0_rgba(43,29,82,0.6)]">
              <span>{VILLAINS[h.boss.kind as keyof typeof VILLAINS].emoji} {VILLAINS[h.boss.kind as keyof typeof VILLAINS].name.toUpperCase()}</span><span>{Math.ceil(h.boss.hp)}</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-[#2B1D52]/40 ring-2 ring-white">
              <div className="h-full rounded-full bg-gradient-to-r from-[#FF5FA2] to-[#FF8A3D] transition-[width] duration-150" style={{ width: `${(h.boss.hp / Math.max(1, h.boss.max)) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
      {flash > 0 && <div key={flash} className="bb-flash pointer-events-none absolute inset-0 z-10" />}
      {/* toasts */}
      <div className="pointer-events-none absolute inset-x-0 top-[24%] z-20 flex flex-col items-center gap-1.5">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: "spring", damping: 16, stiffness: 380 }}
              className={`rounded-full px-4 py-1 font-display whitespace-nowrap shadow-[0_4px_0_rgba(43,29,82,0.25)] ${t.big ? "text-[26px]" : "text-[19px]"} ${t.tone === "good" ? "bg-[#2FCB8B] text-white" : t.tone === "bad" ? "bg-[#FF5F7E] text-white" : t.tone === "gold" ? "bg-[#FFC93C] text-[#5A3A00]" : "bg-white text-[#2B1D52]"}`}>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {/* the leader's POWER button (bottom right, under the thumb) */}
      {(() => {
        const L = leaderOf(loadout.leader), pw = h?.power ?? 0, ready = pw >= 1;
        return (
          <button type="button" aria-label={`Power: ${L.powerName}`} disabled={!ready}
            onPointerDown={(e) => { e.stopPropagation(); if (sess.current?.usePower()) { ui("a:whooshIn", 0.5); } }}
            className={`absolute z-30 grid size-[84px] place-items-center rounded-full ${ready ? "bb-ready" : ""}`}
            style={{ right: "calc(var(--safe-right, 0px) + 14px)", bottom: "calc(var(--safe-bottom) + 18px)", background: `conic-gradient(${L.color} ${pw * 360}deg, rgba(255,255,255,0.55) 0deg)`, boxShadow: "0 5px 0 rgba(43,29,82,0.3)" }}>
            <span className="grid size-[70px] place-items-center overflow-hidden rounded-full bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={L.img} alt="" className={`size-16 object-contain ${ready ? "" : "opacity-55 grayscale"}`} />
            </span>
            <span className="absolute -bottom-2 rounded-full px-2 py-0.5 font-display text-[11px] whitespace-nowrap text-white" style={{ background: ready ? L.color : "#2B1D52" }}>{ready ? "POWER!" : `${Math.floor(pw * 100)}%`}</span>
          </button>
        );
      })()}
      {/* tutorial */}
      <AnimatePresence>
        {tip === 0 && (
          <motion.div key="t0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-[16%] z-20 flex flex-col items-center gap-2">
            <span className="bb-hand text-5xl">👆</span>
            <span className="rounded-full bg-white px-4 py-1.5 font-display text-xl shadow-[0_4px_0_rgba(43,29,82,0.2)]">Drag left and right to move</span>
          </motion.div>
        )}
        {tip === 1 && (
          <motion.div key="t1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`pointer-events-none absolute bottom-[22%] z-20 flex flex-col gap-2 ${recLeft ? "left-3 items-start" : "right-3 items-end"}`}>
            <span className="rounded-2xl bg-white px-4 py-2 font-display text-lg leading-tight shadow-[0_4px_0_rgba(43,29,82,0.2)]">Walk onto the blue <span className="text-[#2F6BFF]">+1</span> tiles<br />to grow your brigade!</span>
            <span className={`bb-bounce text-4xl ${recLeft ? "" : "self-end"}`}>{recLeft ? "⬅️" : "➡️"}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function goalProgress(s: BrigadeSession, spec: StageSpec): { met: boolean; extra?: string } {
  const g = spec.goal, st = s.sim.stats, sim = s.sim;
  switch (g.kind) {
    case "jars": return { met: st.jarsTotal > 0 && st.jars >= st.jarsTotal };
    case "count": return { met: sim.peak >= g.value, extra: `${Math.min(sim.peak, g.value)}/${g.value}` };
    case "cages": return { met: st.cages >= st.cagesTotal, extra: `${st.cages}/${st.cagesTotal}` };
    case "pinatas": return { met: st.pinatas >= g.value };
    case "fast": return { met: sim.t <= g.value && !sim.boss && sim.phase === "won", extra: `${Math.max(0, Math.ceil(g.value - sim.t))}s` };
    case "keep": return { met: sim.peak > 0 && sim.n >= g.value * sim.peak };
  }
}

// ------------------------------------------------------------------ results
function ResultsScreen({ info, hasNext, onNext, onRetry, onMap }: { info: ResultInfo; hasNext: boolean; onNext: () => void; onRetry: () => void; onMap: () => void }) {
  const { res, def, mode } = info;
  const endless = mode === "endless", rush = mode === "rush", daily = mode === "daily", remix = mode === "remix";
  const starred = mode === "stage" || remix || daily;
  const won = res.won || endless;
  const head = endless ? `WAVE ${res.wave}!` : rush ? (res.won ? "ALL 15!" : `${res.wave ?? 0} VILLAINS`) : res.won ? (daily ? "DAILY DONE!" : res.stars === 3 ? "SUPER!" : "HOORAY!") : "OOPS!";
  useEffect(() => {
    const t = [0, 1, 2].filter((i) => i < res.stars).map((i) => setTimeout(() => audio.play("a:ding", { gain: 0.4, rate: 1 + i * 0.12, duck: false }), 450 + i * 280));
    return () => t.forEach(clearTimeout);
  }, [res.stars]);
  const pinata = def?.type === "pinata";
  const sub = mode === "stage" && def ? `${WORLDS[def.world].emoji} ${def.world + 1}-${def.s} · ${def.name}`
    : remix && info.n ? `🔁 Remix ${info.n - 100} · ${TIER_NAMES[remixTier(info.n)]} · ${def ? WORLDS[def.world].name : ""}`
    : daily && info.dkey ? `📅 ${DAILY_MODS[dailyInfo(info.dkey).mod].icon} ${DAILY_MODS[dailyInfo(info.dkey).mod].name} · ${WORLDS[dailyInfo(info.dkey).world].name}`
    : rush ? `👑 Boss Rush · ${res.time.toFixed(1)} s` : "";
  const nextLabel = remix ? "NEXT REMIX" : "NEXT STAGE";
  const home = endless || rush || daily;
  // phones in landscape: headline + stars on the left, numbers + buttons on the right
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop w={def?.world ?? (rush ? 9 : 0)} />
      <div className="relative z-10 flex flex-1 overflow-y-auto px-5" style={{ paddingTop: "calc(var(--safe-top) + 1rem)", paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}>
        <div className="bb-res m-auto flex w-full max-w-sm flex-col items-center">
          <div className="bb-res-a flex flex-col items-center">
            <motion.h1 initial={{ scale: 0.4, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 10, stiffness: 220 }}
              className="bb-logo bb-res-h text-center font-display leading-none" style={{ color: won ? "#2FCB8B" : "#FF5F7E" }}>{head}</motion.h1>
            {sub && <p className="mt-1 text-center font-display text-lg text-[#2B1D52]/70">{sub}</p>}
            {starred && (
              <div className="mt-3 flex gap-3">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.4 + i * 0.28, type: "spring", damping: 9, stiffness: 260 }}>
                    <Star className={`bb-res-star ${i < res.stars ? "fill-[#FFC93C] text-[#E0A100] drop-shadow-[0_4px_0_rgba(160,100,0,0.35)]" : "fill-white/70 text-[#2B1D52]/20"}`} />
                  </motion.span>
                ))}
              </div>
            )}
            {(info.newBest || info.endlessBest) && <p className="mt-3 rounded-full bg-[#FFC93C] px-4 py-1 font-display text-lg text-[#5A3A00]">NEW BEST!</p>}
            {daily && (info.streak ?? 0) > 0 && <p className="mt-2 rounded-full bg-[#FF5F7E] px-4 py-1 font-display text-lg text-white">🔥 {info.streak}-day streak!</p>}
            {info.unlocked.map((u) => <motion.p key={u} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2, type: "spring" }} className="mt-2 rounded-full bg-[#8F6BFF] px-4 py-1 font-display text-lg text-white">NEW: {u}!</motion.p>)}
          </div>
          <div className="bb-res-b flex w-full flex-col items-center">
            <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
              {endless ? (
                <>
                  <Stat label="Score" value={(res.score ?? 0).toLocaleString("en-US")} />
                  <Stat label="Biggest brigade" value={res.peak.toLocaleString("en-US")} />
                </>
              ) : rush ? (
                <>
                  <Stat label="Villains" value={`${res.wave ?? 0} / ${RUSH.length}`} />
                  <Stat label="Time" value={`${res.time.toFixed(1)} s`} />
                </>
              ) : (
                <>
                  <Stat label="Brigade" value={`${res.count} / ${res.peak}`} />
                  {pinata ? <Stat label="Piñatas" value={`${res.pinatas} / ${res.pinatasTotal}`} /> : <Stat label="Grumpies cheered" value={res.pops.toLocaleString("en-US")} />}
                </>
              )}
              <Stat label="Coins" value={`+${info.reward}`} gold />
              {endless ? <Stat label="Best wave" value={String(Math.max(res.wave ?? 0, info.bestWave))} />
                : rush ? <Stat label="Best time" value={info.rushTime ? `${info.rushTime.toFixed(1)} s` : "—"} />
                : <Stat label="Goal" value={res.goalMet ? "✓ Done" : "Not yet"} />}
            </div>
            {starred && !res.won && <p className="mt-3 max-w-xs text-center text-[15px] font-bold text-[#2B1D52]/70">Tip: grab more +1 tiles before the Grumpies get close, and use your POWER when the button glows!</p>}
            <div className="mt-5 flex w-full flex-col gap-3">
              {hasNext && res.won && <Btn big tone="orange" onClick={onNext} className="w-full">{nextLabel}<ChevronRight className="size-7" /></Btn>}
              <div className="grid grid-cols-2 gap-3">
                <Btn tone={hasNext && res.won ? "white" : "orange"} onClick={onRetry}><RotateCcw className="size-5" />{endless || rush ? "AGAIN" : "RETRY"}</Btn>
                <Btn tone="white" onClick={onMap}><MapIcon className="size-5" />{home ? "HOME" : "MAP"}</Btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ wardrobe
function WardrobeScreen({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const s = useBrigade();
  const tile = (on: boolean, open: boolean, icon: string, name: string, how: string, pick: () => void) => (
    <button key={name} type="button" disabled={!open} onClick={() => { ui("a:ding"); pick(); }}
      className={`flex flex-col items-center gap-1 rounded-[22px] p-3 text-center transition active:scale-95 ${on ? "bg-white ring-4 ring-[#FF8A3D] shadow-[0_5px_0_rgba(43,29,82,0.2)]" : "bg-white/75 shadow-[0_4px_0_rgba(43,29,82,0.14)]"} ${open ? "" : "opacity-60"}`}>
      <span className={`text-4xl ${open ? "" : "grayscale"}`}>{icon}</span>
      <span className="font-display text-[15px] leading-tight">{name}</span>
      {!open && <span className="text-[11.5px] font-bold text-[#2B1D52]/60">🔒 {how}</span>}
      {on && <span className="rounded-full bg-[#2FCB8B] px-2 font-display text-[11px] text-white">WEARING</span>}
    </button>
  );
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop w={4} />
      <div className="relative z-10"><TopBar title="Wardrobe" sub="Hats and bubbles for your brigade" onBack={onBack} /></div>
      <div className="relative z-10 flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <h2 className="font-display text-xl">Hats</h2>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {HATS.map((h) => tile(s.look.hat === h.id, h.open(progress), h.icon, h.name, h.how, () => s.setLook({ hat: h.id })))}
          </div>
          <h2 className="font-display text-xl">Bubbles</h2>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {BUBBLES.map((b) => tile(s.look.bubble === b.id, b.open(progress), b.icon, b.name, b.how, () => s.setLook({ bubble: b.id })))}
          </div>
          <p className="px-2 text-center text-[13px] font-bold text-[#2B1D52]/55">Unlock more with stars, Daily Challenge streaks, the Remix Loop and Boss Rush.</p>
        </div>
      </div>
    </div>
  );
}

const Stat = ({ label, value, gold }: { label: string; value: string; gold?: boolean }) => (
  <div className="rounded-3xl bg-white/85 px-3 py-2.5 text-center shadow-[0_4px_0_rgba(43,29,82,0.14)]">
    <p className="text-[12px] font-extrabold tracking-wide text-[#2B1D52]/55 uppercase">{label}</p>
    <p className={`font-display text-2xl ${gold ? "text-[#E0A100]" : ""}`}>{value}</p>
  </div>
);

// ------------------------------------------------------------------ settings
function SettingsScreen({ onBack }: { onBack: () => void }) {
  const s = useBrigade();
  const [confirm, setConfirm] = useState(false);
  const seg = <T extends string>(val: T, opts: [T, string][], set: (v: T) => void) => (
    <div className="grid gap-1.5 rounded-2xl bg-[#F4F0FF] p-1.5" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }}>
      {opts.map(([v, l]) => (
        <button key={v} type="button" onClick={() => { ui(); set(v); }} className={`min-h-11 rounded-xl px-2 font-display text-[15px] ${val === v ? "bg-[#FF8A3D] text-white shadow-[0_3px_0_#C95A14]" : "text-[#2B1D52]/70"}`}>{l}</button>
      ))}
    </div>
  );
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop />
      <div className="relative z-10"><TopBar title="Settings" onBack={onBack} /></div>
      <div className="relative z-10 flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto flex max-w-md flex-col gap-4 rounded-[28px] bg-white/85 p-4 shadow-[0_6px_0_rgba(43,29,82,0.15)]">
          <Field label="Math gates" hint="Which gates show up in Candy Kitchen and Endless Waves.">
            {seg<MathMode>(s.settings.math, [["off", "+ only"], ["easy", "+ and −"], ["plus", "+ − × ÷"]], (v) => s.setSettings({ math: v }))}
          </Field>
          <Field label="Drag speed" hint="How far the brigade moves when you drag.">
            {seg(String(s.settings.sensitivity), [["0.7", "Slow"], ["1", "Normal"], ["1.4", "Fast"]], (v) => s.setSettings({ sensitivity: Number(v) }))}
          </Field>
          <Field label="Graphics" hint="Lower it if the game feels slow.">
            {seg(s.settings.quality, [["auto", "Auto"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]], (v) => s.setSettings({ quality: v }))}
          </Field>
          <Field label="Vibration">{seg(s.settings.vibrate ? "on" : "off", [["on", "On"], ["off", "Off"]], (v) => s.setSettings({ vibrate: v === "on" }))}</Field>
          <Field label="Progress" hint={`${s.plays} games · ${s.pops.toLocaleString("en-US")} Grumpies cheered up`}>
            {confirm ? (
              <div className="grid grid-cols-2 gap-2"><Btn tone="pink" onClick={() => { s.reset(); setConfirm(false); }}>Yes, reset</Btn><Btn tone="white" onClick={() => setConfirm(false)}>Keep it</Btn></div>
            ) : <Btn tone="white" onClick={() => setConfirm(true)} className="w-full">Reset stars and records</Btn>}
          </Field>
        </div>
      </div>
    </div>
  );
}
const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <div><p className="font-display text-xl">{label}</p>{hint && <p className="text-[13px] font-semibold text-[#2B1D52]/55">{hint}</p>}</div>
    {children}
  </div>
);

const APP_CSS = `
.bb-root{font-family:var(--font-sans),system-ui;overscroll-behavior:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
.bb-root canvas{touch-action:none}
.bb-root button{touch-action:manipulation}
.bb-logo{-webkit-text-stroke:7px #2B1D52;paint-order:stroke fill;text-shadow:0 7px 0 #2B1D52}
.bb-wob{animation:bb-wob 2.4s ease-in-out infinite}
@keyframes bb-wob{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-5px) rotate(-3deg)}75%{transform:translateY(2px) rotate(2deg)}}
.bb-drift{animation:bb-drift 14s ease-in-out infinite;filter:blur(1px)}
@keyframes bb-drift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,-40px) scale(1.15)}}
.bb-pulse{animation:bb-pulse 1.2s ease-in-out infinite}
@keyframes bb-pulse{0%,100%{box-shadow:0 5px 0 rgba(0,0,0,.22),0 0 0 0 rgba(255,138,61,.7)}50%{box-shadow:0 5px 0 rgba(0,0,0,.22),0 0 0 10px rgba(255,138,61,0)}}
.bb-hand{animation:bb-hand 1.4s ease-in-out infinite}
@keyframes bb-hand{0%,100%{transform:translateX(-60px) rotate(-10deg)}50%{transform:translateX(60px) rotate(10deg)}}
.bb-bounce{animation:bb-bounce .8s ease-in-out infinite}
.bb-ready{animation:bb-ready 0.9s ease-in-out infinite}
@keyframes bb-ready{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.bb-flash{box-shadow:inset 0 0 90px 30px rgba(255,60,90,.55);animation:bb-flash .45s ease-out forwards}
@keyframes bb-flash{from{opacity:1}to{opacity:0}}
.bb-res-h{font-size:clamp(52px,15vw,92px)}
.bb-res-star{width:64px;height:64px}
@media (orientation:landscape) and (max-height:520px){
  .bb-res{max-width:760px;flex-direction:row;align-items:center;gap:28px}
  .bb-res-a,.bb-res-b{flex:1 1 0}
  .bb-res-h{font-size:clamp(44px,9vh + 20px,72px)}
  .bb-res-star{width:52px;height:52px}
}
@keyframes bb-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}
`;

// ------------------------------------------------------------------ leaders
function LeadersScreen({ total, onBack }: { total: number; onBack: () => void }) {
  const s = useBrigade();
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop w={0} />
      <div className="relative z-10"><TopBar title="Leaders" sub="Every leader has a passive and a POWER" onBack={onBack} right={<Chip><Star className="size-4 fill-[#FFC93C] text-[#E0A100]" />{total}</Chip>} /></div>
      <div className="relative z-10 flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          {LEADERS.map((l) => {
            const open = total >= l.unlock, on = s.leader === l.id;
            return (
              <button key={l.id} type="button" disabled={!open} onClick={() => { ui("a:ding"); s.setLeader(l.id); }}
                className={`relative flex items-center gap-3 rounded-[24px] p-3 text-left transition active:scale-[0.98] ${on ? "bg-white shadow-[0_6px_0_rgba(43,29,82,0.2)] ring-4" : "bg-white/75 shadow-[0_4px_0_rgba(43,29,82,0.14)]"} ${open ? "" : "opacity-70"}`}
                style={on ? { ["--tw-ring-color" as string]: l.color } : undefined}>
                <span className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl" style={{ background: `${l.color}2A` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.img} alt="" className={`size-[4.6rem] object-contain ${open ? "" : "grayscale"}`} />
                  {!open && <span className="absolute inset-0 grid place-items-center bg-white/40"><Lock className="size-6 text-[#2B1D52]" /></span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="font-display text-xl" style={{ color: l.color }}>{l.name}</span>{on && <span className="rounded-full bg-[#2FCB8B] px-2 py-0.5 font-display text-xs text-white">LEADING</span>}</span>
                  <span className="block text-[13px] font-bold text-[#2B1D52]/75">{l.passive}</span>
                  <span className="mt-1 block text-[13px] font-extrabold text-[#2B1D52]">⚡ {l.powerName}: <span className="font-bold text-[#2B1D52]/70">{l.power}</span></span>
                  {!open && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#2B1D52] px-2 py-0.5 text-xs font-bold text-white"><Star className="size-3 fill-[#FFC93C] text-[#FFC93C]" />{l.unlock} stars to unlock</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ upgrade shop
function ShopScreen({ onBack }: { onBack: () => void }) {
  const s = useBrigade();
  const coins = useProfile((p) => p.coins);
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop w={3} />
      <div className="relative z-10"><TopBar title="Upgrades" sub="Spend coins to make every leader stronger" onBack={onBack} right={<Chip>🪙 {coins.toLocaleString("en-US")}</Chip>} /></div>
      <div className="relative z-10 flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          {UPGRADES.map((u) => {
            const lvl = s.upgrades[u.id] ?? 0, maxed = lvl >= u.max, cost = upgradeCost(lvl), can = !maxed && coins >= cost;
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-[24px] bg-white/85 p-3 shadow-[0_4px_0_rgba(43,29,82,0.14)]">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#F4F0FF] text-3xl">{u.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg leading-tight">{u.name} <span className="text-[#2B1D52]/50">· {u.value(lvl)}</span></p>
                  <p className="text-[12.5px] font-bold text-[#2B1D52]/60">{u.per} per level</p>
                  <div className="mt-1.5 flex gap-1">{Array.from({ length: u.max }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < lvl ? "bg-[#FF8A3D]" : "bg-[#2B1D52]/12"}`} />)}</div>
                </div>
                <Btn tone={maxed ? "ghost" : can ? "mint" : "ghost"} disabled={!can} onClick={() => { if (s.buyUpgrade(u.id)) ui("a:levelup"); }} className="min-w-24 px-3 text-base">
                  {maxed ? "MAX" : <>🪙 {cost}</>}
                </Btn>
              </div>
            );
          })}
          <p className="px-2 text-center text-[13px] font-bold text-[#2B1D52]/55">Coins come from popping Grumpies, coin tiles, jars, piñatas and stars.</p>
        </div>
      </div>
    </div>
  );
}
