"use client";
// Momo Boing! front-end: home (Momo bouncing behind the logo and the next stage), the climb with its HUD, the stage
// intro card, the Safe Cloud power-card picker, results and settings. Stages come one by one — there is no stage
// select: win to move on, lose to try again, and leaving half-way means that stage starts from the bottom next time.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Home, Lock, Play, RotateCcw, Settings2, Star, ChevronRight } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { AVAILABLE, CARDS, CHAPTER_SIZE, FRIENDS, TWIST_INFO, TYPE_INFO, WORLDS, buildStage, dailyKey, dailySpec, endlessSpec, stageDef, type StageDef } from "../levels";
import type { BoingLook } from "../render";
import { BOING_CSS, BoingSession, type HudState, type Toast } from "../session";
import { autoQuality, useBoing, useBoingHydrated } from "../save";
import type { CardId, SimEvent, SimResult, StageSpec } from "../types";
import { cdn } from "@/lib/cdn";

type Screen = "title" | "game" | "results" | "settings" | "wardrobe";
interface GameRun { key: number; spec: StageSpec; def: StageDef; endless: boolean; daily?: string; ghost?: number[] }
interface ResultInfo { res: SimResult; def: StageDef; reward: number; newBest: boolean; endless: boolean; best: number; daily?: string; streak?: number }

const UI_SOUNDS: Sound[] = ["a:click", "a:whooshOut", "a:whooshIn", "a:ding", "a:levelup", "tada", "a:cheer", "sadtrombone", "a:boing_marimba", "a:boing_perfect"];
const MUSIC_WORLDS = new Set(["garden", "candy", "snow", "toy", "beach", "spooky", "jungle", "lava", "space", "castle"]);
const music = (w: number, act: boolean): MusicName => `a:boing_${MUSIC_WORLDS.has(WORLDS[w]?.id) ? WORLDS[w].id : "garden"}_${act ? "action" : "calm"}`;
const ENDLESS_AT = 11;
const DAILY_AT = 6;
const TOD_TEXT: Record<string, string> = { sunset: "🌅 Sunset", night: "🌙 Night", morning: "🌄 Morning", aurora: "🌌 Aurora" };
// the Wardrobe: hats (the same hats as Blob Brigade) and trails, bought with site coins
const HAT_ITEMS: { id: string; name: string; icon: string; price: number }[] = [
  { id: "none", name: "No hat", icon: "🚫", price: 0 }, { id: "party", name: "Party Hat", icon: "🎉", price: 0 }, { id: "flower", name: "Flower Crown", icon: "🌼", price: 150 },
  { id: "cowboy", name: "Cowboy Hat", icon: "🤠", price: 250 }, { id: "pirate", name: "Pirate Hat", icon: "🏴‍☠️", price: 300 }, { id: "wizard", name: "Wizard Hat", icon: "🧙", price: 350 },
  { id: "santa", name: "Santa Hat", icon: "🎅", price: 300 }, { id: "propeller", name: "Propeller Cap", icon: "🌀", price: 400 }, { id: "viking", name: "Viking Helmet", icon: "⚔️", price: 450 },
  { id: "chef", name: "Chef Hat", icon: "👨‍🍳", price: 400 }, { id: "crown", name: "Royal Crown", icon: "👑", price: 800 },
];
const TRAIL_ITEMS: { id: string; name: string; icon: string; price: number }[] = [
  { id: "none", name: "No trail", icon: "🚫", price: 0 }, { id: "stars", name: "Star Trail", icon: "⭐", price: 120 }, { id: "hearts", name: "Heart Trail", icon: "💖", price: 150 },
  { id: "bubbles", name: "Bubble Trail", icon: "🔵", price: 150 }, { id: "notes", name: "Music Trail", icon: "🎵", price: 200 }, { id: "sparkle", name: "Sparkle Trail", icon: "✨", price: 250 }, { id: "rainbow", name: "Rainbow Trail", icon: "🌈", price: 500 },
];
const isAutomation = () => typeof navigator !== "undefined" && Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver);
const isPhone = () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false) && Math.min(window.innerWidth, window.innerHeight) < 600;
const ui = (s: Sound = "a:click", gain = 0.4) => {
  audio.play(s, { gain, duck: false });
  if (useBoing.getState().settings.vibrate && typeof navigator !== "undefined" && navigator.vibrate) { try { navigator.vibrate(8); } catch { /* blocked */ } }
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
/** phones: play like an app — fullscreen and portrait (Android; iPhone Safari keeps its bars) */
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
const Chip = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span className={`inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 font-display text-[15px] text-[#2B1D52] shadow-[0_3px_0_rgba(43,29,82,0.18)] ${className}`}>{children}</span>
);
function TopBar({ title, sub, onBack }: { title: string; sub?: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 pr-16 pl-4 pb-2" style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)" }}>
      <button type="button" aria-label="Back" onClick={() => { ui("a:whooshOut", 0.3); onBack(); }} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-[#2B1D52] shadow-[0_4px_0_#C9BFE6] active:translate-y-1 active:shadow-none"><ArrowLeft className="size-6" /></button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[26px] leading-tight text-[#2B1D52]">{title}</h1>
        {sub && <p className="truncate text-sm font-semibold text-[#2B1D52]/60">{sub}</p>}
      </div>
    </div>
  );
}
/** a soft sky in the world's colours with drifting clouds */
function SkyBack({ w = 0 }: { w?: number }) {
  const W = WORLDS[w] ?? WORLDS[0];
  const dark = W.id === "spooky" || W.id === "space" || W.id === "lava";
  const bg = dark ? `linear-gradient(180deg, #150F38 0%, ${W.accent} 140%)` : `linear-gradient(180deg, ${W.accent}AA 0%, ${W.accent2}55 55%, #FFFFFF 100%)`;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: bg }}>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className="mb-cloud absolute" style={{ left: `${(i * 41) % 100 - 10}%`, top: `${(i * 29) % 90}%`, animationDelay: `${-i * 4}s`, animationDuration: `${26 + (i % 3) * 8}s`, transform: `scale(${0.6 + (i % 3) * 0.3})`, opacity: dark ? 0.25 : 1 }} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ the 3D view (game or title attract)
function GameCanvas({ spec, attract, onReady, quality, sensitivity, vibrate, onEnd, onToast, onEvent, look, ghost }: {
  spec: StageSpec; attract?: boolean; quality: "low" | "medium" | "high"; sensitivity?: number; vibrate?: boolean; look?: BoingLook; ghost?: number[];
  onReady?: (s: BoingSession) => void; onEnd?: (r: SimResult, path: number[]) => void; onToast?: (t: Toast) => void; onEvent?: (e: SimEvent) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onEnd, onToast, onEvent, look, ghost });
  useEffect(() => { cb.current = { onReady, onEnd, onToast, onEvent, look, ghost }; });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const s = new BoingSession(el, spec, {
      quality, attract, sensitivity, vibrate, look: cb.current.look, ghost: cb.current.ghost,
      onEnd: (r, path) => cb.current.onEnd?.(r, path), onToast: (t) => cb.current.onToast?.(t), onEvent: (e) => cb.current.onEvent?.(e),
    });
    cb.current.onReady?.(s);
    return () => s.destroy();
  }, [spec, attract, quality, sensitivity, vibrate]);
  return <div ref={host} className="absolute inset-0" />;
}

// ------------------------------------------------------------------ the app
export default function BoingApp({ title }: { slug: string; title: string }) {
  const ready = useBoingHydrated();
  const s = useBoing();
  const player = usePlayer();
  const { setImmersive, setLoading, setInRound, setMenu } = player;
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<GameRun | null>(null);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const quality = s.settings.quality === "auto" ? autoQuality() : s.settings.quality;
  const current = Math.max(1, Math.min(AVAILABLE, s.current));
  const nextDef = stageDef(current);
  const world = run?.def.world ?? nextDef.world;

  useEffect(() => { setLoading(null); }, [setLoading]);
  useEffect(() => { void audio.preload(UI_SOUNDS); }, []);
  useEffect(() => { setImmersive(screen !== "title"); setInRound(screen === "game"); }, [screen, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => {
    if (screen !== "game") void audio.playMusic(music(screen === "results" && result ? result.def.world : world, false));
    audio.warmMusic([music(world, true)]); // Play starts with its track already downloaded
  }, [screen, world, result]);

  // the title demo bounces through the world you are in
  const titleSpec = useMemo(() => buildStage({ ...stageDef(nextDef.world * CHAPTER_SIZE + 2), world: nextDef.world }, { demo: true, seed: 4242 }), [nextDef.world]);

  const start = useCallback((def: StageDef, endless = false, daily?: string) => {
    setResult(null);
    const st = useBoing.getState();
    // the quiet helper: after three losses in a row on a stage it gets a little kinder (nothing on screen says so)
    const help = !endless && !daily && (st.fails[def.id] ?? 0) >= 3;
    const spec = daily ? dailySpec(daily, st.current) : endless ? endlessSpec(def.world) : buildStage(def, { help });
    const d2: StageDef = daily ? { n: spec.n, id: spec.id, world: spec.world, s: def.s, type: spec.type, name: spec.name, place: spec.place, emoji: spec.emoji } : def;
    const ghost = !endless && !daily && st.ghost?.id === def.id ? st.ghost.pts : undefined;
    setRun((r) => ({ key: (r?.key ?? 0) + 1, spec, def: d2, endless, daily, ghost }));
    setScreen("game");
  }, []);

  const onEnd = useCallback((res: SimResult, path: number[]) => {
    if (!run) return;
    const st = useBoing.getState(), def = run.def;
    let reward: number, newBest = false, streak = 0;
    if (run.endless) {
      newBest = st.setEndless(res.height);
      reward = res.coins + Math.floor(res.height / 10) + res.notes * 2;
    } else if (run.daily) {
      if (res.won) streak = st.dailyDone(run.daily);
      reward = res.coins + res.stars * 10 + res.notes * 2 + (streak > 0 ? 30 + streak * 5 : 0);
    } else {
      st.noteResult(def.id, res.won);
      // the ghost race: keep your best try (the fastest win, or the highest climb)
      st.setGhost(def.id, res.won ? 1e6 - res.time * 100 : res.height, path);
      st.setStars(def.id, res.stars);
      newBest = res.won && st.setBest(def.id, res.score);
      if (res.won) st.advance(def.n, AVAILABLE);
      reward = res.coins + res.stars * 10 + (res.won ? 15 : 0) + res.notes * 2;
    }
    st.record(res.won, res.perfects, res.bestChain, reward);
    useProfile.getState().earnCoins(reward);
    setResult({ res, def, reward, newBest, endless: run.endless, best: useBoing.getState().endless.best, daily: run.daily, streak });
    setScreen("results");
  }, [run]);

  useEffect(() => {
    if (screen !== "game") return;
    setMenu([
      { id: "restart", label: "Restart", icon: "🔄", onSelect: () => { player.setPaused(false); if (run) start(run.def, run.endless, run.daily); } },
      { id: "home", label: "Home", icon: "🏠", onSelect: () => { player.setPaused(false); setScreen("title"); } },
    ]);
  }, [screen, run, setMenu, start, player]);

  if (!ready) return <div className="absolute inset-0 bg-[#A8E0FF]" />;
  const allDone = s.current >= AVAILABLE && (s.stars[`s${AVAILABLE}`] ?? 0) > 0;

  return (
    <div className="mb-root absolute inset-0 overflow-hidden text-[#2B1D52] select-none" onContextMenu={(e) => e.preventDefault()}>
      <style>{BOING_CSS + APP_CSS}</style>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={screen === "game" ? `game-${run?.key}` : screen} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="absolute inset-0">
          {screen === "title" && (
            <TitleScreen title={title} spec={titleSpec} quality={quality} stars={s.totalStars()} next={nextDef} allDone={allDone} endlessBest={s.endless.best}
              endlessOpen={s.current >= ENDLESS_AT} onPlay={() => { void appMode(); start(nextDef); }} onEndless={() => { void appMode(); start(nextDef, true); }} onSettings={() => setScreen("settings")}
              dailyOpen={s.current >= DAILY_AT} dailyDone={s.daily.doneKey === dailyKey()} streak={s.daily.streak} onDaily={() => { void appMode(); start(nextDef, false, dailyKey()); }} onWardrobe={() => setScreen("wardrobe")} />
          )}
          {screen === "game" && run && (
            <GameScreen key={run.key} run={run} quality={quality} sensitivity={s.settings.sensitivity} vibrate={s.settings.vibrate} endlessBest={s.endless.best} look={s.look}
              tutorial={!s.tutorialDone && run.def.n === 1 && !run.endless && !isAutomation()} onTutorialDone={() => useBoing.getState().setTutorialDone(true)} onEnd={onEnd} />
          )}
          {screen === "results" && result && (
            <ResultsScreen info={result} canNext={!result.endless && !result.daily && result.res.won && result.def.n < AVAILABLE}
              onNext={() => start(stageDef(result.def.n + 1))} onRetry={() => start(result.def, result.endless, result.daily)} onHome={() => setScreen("title")} />
          )}
          {screen === "settings" && <SettingsScreen onBack={() => setScreen("title")} />}
          {screen === "wardrobe" && <WardrobeScreen onBack={() => setScreen("title")} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ home
function TitleScreen({ title, spec, quality, stars, next, allDone, endlessOpen, endlessBest, onPlay, onEndless, onSettings, dailyOpen, dailyDone, streak, onDaily, onWardrobe }: {
  title: string; spec: StageSpec; quality: "low" | "medium" | "high"; stars: number; next: StageDef; allDone: boolean; endlessOpen: boolean; endlessBest: number;
  onPlay: () => void; onEndless: () => void; onSettings: () => void; dailyOpen: boolean; dailyDone: boolean; streak: number; onDaily: () => void; onWardrobe: () => void;
}) {
  const w = WORLDS[next.world], info = TYPE_INFO[next.type];
  return (
    <div className="absolute inset-0">
      <GameCanvas spec={spec} attract quality={quality === "high" ? "medium" : quality} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/55 via-transparent to-white/80" />
      <div className="absolute inset-x-0 top-0 flex flex-col items-center px-4 text-center" style={{ paddingTop: "calc(var(--safe-top) + 4.2rem)" }}>
        <p className="font-display text-sm tracking-[0.25em] text-[#FF8A3D]">MOMOBLOBS</p>
        <h1 className="mb-logo font-display text-[clamp(52px,15vw,96px)] leading-[0.9]">
          {title.toUpperCase().split(" ").map((wd, i) => (
            <span key={wd} className="block">{wd.split("").map((c, j) => <span key={j} className="mb-hop inline-block" style={{ animationDelay: `${(i * 4 + j) * 0.11}s`, color: i ? "#FF5FA2" : "#FF8A3D" }}>{c}</span>)}</span>
          ))}
        </h1>
        <p className="mt-2 max-w-xs text-[15px] font-bold text-[#2B1D52]/80">Every bounce plays the song!</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2"><Chip><Star className="size-4 fill-[#FFC93C] text-[#E0A100]" />{stars}</Chip>{endlessBest > 0 && <Chip>♾️ Best {endlessBest} m</Chip>}</div>
      </div>
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-3 px-5" style={{ paddingBottom: "calc(var(--safe-bottom) + 1.4rem)" }}>
        {/* the next stage — no stage select: stages come one by one */}
        <div className="flex items-center gap-3 rounded-[24px] bg-white/90 p-3 shadow-[0_5px_0_rgba(43,29,82,0.16)]">
          <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${next.emoji.length > 3 ? "text-2xl" : "text-3xl"}`} style={{ background: `${w.accent}33` }}>{next.emoji}</span>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate font-display text-xs tracking-widest" style={{ color: w.accent }}>{next.place.toUpperCase()} · {info.icon} {info.label.toUpperCase()}</p>
            <p className="truncate font-display text-[22px] leading-tight">{allDone ? "All 100 stages done! 🎉" : `Stage ${next.n}`}</p>
            <p className="truncate text-[12.5px] font-bold text-[#2B1D52]/60">{allDone ? "More sky worlds are on the way — try Endless!" : next.s === 1 ? `New: ${w.newIdea}` : next.name}</p>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Btn big tone="orange" onClick={onPlay} className="w-full"><Play className="size-7 fill-current" />{allDone ? "PLAY 100" : "PLAY"}</Btn>
          <Btn big tone="white" onClick={onSettings} label="Settings" className="w-16 !px-0"><Settings2 style={{ width: 30, height: 30 }} strokeWidth={2.4} /></Btn>
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2.5">
          <Btn tone={dailyOpen ? "pink" : "ghost"} disabled={!dailyOpen} onClick={onDaily} label="Daily Sky" className="relative w-full !px-2 text-base whitespace-nowrap">
            {dailyOpen ? <>{dailyDone ? "✅" : "📅"} DAILY{streak > 0 && <span className="absolute -top-2.5 -right-1 rounded-full bg-[#FFC93C] px-1.5 py-0.5 text-[12px] leading-none text-[#5A3A00] shadow-[0_2px_0_rgba(43,29,82,0.2)]">🔥{streak}</span>}</> : <><Lock className="size-4" />DAILY · {DAILY_AT}</>}
          </Btn>
          <Btn tone={endlessOpen ? "purple" : "ghost"} disabled={!endlessOpen} onClick={onEndless} className="w-full !px-2 text-base">
            {endlessOpen ? <>♾️ ENDLESS</> : <><Lock className="size-4" />ENDLESS · {ENDLESS_AT}</>}
          </Btn>
          <Btn tone="white" onClick={onWardrobe} label="Wardrobe" className="w-12 !px-0 text-2xl">🎩</Btn>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the climb + HUD
interface ToastItem extends Toast { id: number }
function goalNow(h: HudState, spec: StageSpec): { met: boolean; extra?: string } {
  const g = spec.goal;
  switch (g.kind) {
    case "perfects": return { met: h.perfects >= g.value, extra: `${Math.min(h.perfects, g.value)}/${g.value}` };
    case "notes": return { met: h.notes >= g.value, extra: `${Math.min(h.notes, g.value)}/${g.value}` };
    case "friends": return { met: h.friends >= g.value, extra: `${Math.min(h.friends, g.value)}/${g.value}` };
    case "comets": return { met: h.comets >= g.value, extra: `${Math.min(h.comets, g.value)}/${g.value}` };
    case "stack": return { met: h.stack.length >= g.value };
    case "coins": return { met: h.coins >= g.value, extra: `${Math.min(h.coins, g.value)}/${g.value}` };
    case "time": return { met: h.t <= g.value, extra: `${Math.max(0, Math.ceil(g.value - h.t))}s` };
    case "stomps": return { met: h.stomps >= g.value, extra: `${Math.min(h.stomps, g.value)}/${g.value}` };
  }
}
function GameScreen({ run, quality, sensitivity, vibrate, tutorial, endlessBest, look, onTutorialDone, onEnd }: {
  run: GameRun; quality: "low" | "medium" | "high"; sensitivity: number; vibrate: boolean; tutorial: boolean; endlessBest: number; look: BoingLook; onTutorialDone: () => void; onEnd: (r: SimResult, path: number[]) => void;
}) {
  const player = usePlayer();
  const sess = useRef<BoingSession | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [tip, setTip] = useState(tutorial ? 0 : -1);
  const [intro, setIntro] = useState(true);
  const [flash, setFlash] = useState(0);
  const tid = useRef(0);
  const doneRef = useRef(onTutorialDone);
  useEffect(() => { doneRef.current = onTutorialDone; });
  const { def, spec, endless } = run, w = WORLDS[def.world], info = TYPE_INFO[def.type];

  useEffect(() => { void audio.playMusic(`a:boing_${spec.music}_action` as MusicName); }, [spec.music]);
  useEffect(() => { audio.warmMusic([music(def.world, false)]); }, [def.world]); // the results track, ahead of time
  useEffect(() => { const t = setTimeout(() => setIntro(false), tutorial ? 1800 : 2600); return () => clearTimeout(t); }, [tutorial]);
  useEffect(() => {
    const iv = setInterval(() => { const s = sess.current; if (s) setHud(s.hud()); }, 110);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { const s = sess.current; if (!s) return; if (player.paused) s.pause(); else s.resume(); }, [player.paused]);
  // tutorial: steer, then Perfect Boings, then the comet tip
  useEffect(() => {
    if (tip < 0) return;
    if (tip >= 3) { doneRef.current(); return; }
    const s0 = sess.current, start = s0?.sim.tx ?? 0;
    const iv = setInterval(() => {
      const cur = sess.current;
      if (!cur) return;
      if (tip === 0 && Math.abs(cur.sim.tx - start) > 1.5) setTip(1);
      if (tip === 1 && cur.sim.stats.perfects >= 2) setTip(2);
    }, 150);
    const to = setTimeout(() => setTip((t) => (t === tip ? t + 1 : t)), tip === 0 ? 7000 : tip === 1 ? 14000 : 4500);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, [tip]);

  const onToast = useCallback((t: Toast) => {
    const id = ++tid.current;
    setToasts((l) => [...l.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), t.big ? 1600 : 1200);
  }, []);
  const onEvent = useCallback((e: SimEvent) => { if (e.t === "hit") setFlash((f) => f + 1); }, []);
  const onReady = useCallback((s: BoingSession) => {
    sess.current = s;
    if (process.env.NODE_ENV !== "production" || isAutomation()) (window as unknown as { __boing?: BoingSession }).__boing = s;
  }, []);
  const pick = (id: CardId) => { ui("a:levelup", 0.5); sess.current?.pickCard(id); setHud((h) => (h ? { ...h, choosing: null } : h)); };

  const h = hud;
  const prog = h ? Math.min(1, h.height / Math.max(1, h.top)) : 0;
  const g = h && !endless ? goalNow(h, spec) : null;
  const danger = h && h.phase === "play" ? Math.max(0, Math.min(1, 1 - (h.goo - 1.5) / 5)) : 0;

  return (
    <div className="absolute inset-0">
      <GameCanvas spec={spec} quality={quality} sensitivity={sensitivity} vibrate={vibrate} onReady={onReady} onEnd={onEnd} onToast={onToast} onEvent={onEvent} look={look} ghost={run.ghost} />
      {/* the goo is close: the bottom glows */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 transition-opacity duration-300" style={{ opacity: danger, background: `linear-gradient(0deg, ${w.id === "lava" ? "rgba(255,106,31,0.55)" : "rgba(126,63,203,0.55)"}, transparent)` }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-1.5 px-3" style={{ paddingTop: "calc(var(--safe-top) + 0.55rem)" }}>
        <div className="flex w-full max-w-md items-center gap-2 pr-14">
          <span className="rounded-full bg-white/90 px-3 py-1 font-display text-[15px] whitespace-nowrap shadow-[0_3px_0_rgba(43,29,82,0.18)]">{w.emoji} {endless ? "♾️" : run.daily ? "📅" : def.n}</span>
          <div className="relative h-7 flex-1 overflow-hidden rounded-full bg-white/80 shadow-[0_3px_0_rgba(43,29,82,0.18)] ring-2 ring-white">
            {endless ? (
              <span className="absolute inset-0 grid place-items-center font-display text-[13px] text-[#2B1D52]">{h ? `${Math.floor(h.height)} m · best ${Math.max(endlessBest, Math.floor(h.height))} m` : ""}</span>
            ) : (
              <>
                <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150" style={{ width: `${prog * 100}%`, background: `linear-gradient(90deg, ${w.accent}, #FFD23F)` }} />
                <span className="absolute inset-0 grid place-items-center font-display text-[13px] text-[#2B1D52]">{h ? `${Math.floor(h.height)} / ${h.top} m` : ""}</span>
                <span className="absolute top-1/2 right-1.5 -translate-y-1/2 text-[13px]">🏁</span>
              </>
            )}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 font-display text-[15px] whitespace-nowrap shadow-[0_3px_0_rgba(43,29,82,0.18)]"><CoinIcon size={17} />{h?.coins ?? 0}</span>
        </div>
        {g && (
          <span className={`rounded-full px-3 py-0.5 text-[12.5px] font-extrabold shadow-[0_2px_0_rgba(43,29,82,0.15)] ${g.met ? "bg-[#2FCB8B] text-white" : "bg-white/85 text-[#2B1D52]/80"}`}>
            {g.met ? "✓ " : "⭐ "}{spec.goal.text}{g.extra ? ` · ${g.extra}` : ""}
          </span>
        )}
        {h && (h.stack.length > 0 || h.cards.length > 0 || h.shields > 0) && (
          <div className="flex items-center gap-1 self-start rounded-full bg-white/80 px-2 py-1 shadow-[0_2px_0_rgba(43,29,82,0.15)]">
            {h.stack.map((f, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={cdn(FRIENDS[f].img)} alt={FRIENDS[f].name} className="size-7 rounded-full bg-white object-contain" />
            ))}
            {h.stack.length > 0 && <span className="pr-1 pl-0.5 font-display text-[12px] text-[#2B1D52]/70">= {h.stack.length} save{h.stack.length > 1 ? "s" : ""}</span>}
            {h.cards.map((c, i) => <span key={`c${i}`} className="grid size-7 place-items-center rounded-full text-[15px]" style={{ background: `${CARDS[c].color}33` }} title={CARDS[c].name}>{CARDS[c].icon}</span>)}
          </div>
        )}
      </div>
      {flash > 0 && <div key={flash} className="mb-flash pointer-events-none absolute inset-0 z-10" />}
      <div className="pointer-events-none absolute inset-x-0 top-[26%] z-20 flex flex-col items-center gap-1.5">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: "spring", damping: 16, stiffness: 380 }}
              className={`max-w-[92vw] truncate rounded-full px-4 py-1 font-display whitespace-nowrap shadow-[0_4px_0_rgba(43,29,82,0.25)] ${t.big ? "text-[26px]" : "text-[17px]"} ${t.tone === "good" ? "bg-[#2FCB8B] text-white" : t.tone === "bad" ? "bg-[#FF5F7E] text-white" : t.tone === "gold" ? "bg-[#FFC93C] text-[#5A3A00]" : "bg-white text-[#2B1D52]"}`}>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {/* the stage intro card */}
      <AnimatePresence>
        {intro && (
          <motion.div key="intro" initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -20 }} transition={{ type: "spring", damping: 18, stiffness: 260 }}
            className="pointer-events-none absolute inset-x-0 top-[30%] z-30 flex justify-center px-6">
            <div className="w-full max-w-sm rounded-[28px] bg-white/95 p-4 text-center shadow-[0_8px_0_rgba(43,29,82,0.2)]">
              <p className="font-display text-xs tracking-[0.2em]" style={{ color: w.accent }}>{spec.emoji} {spec.place.toUpperCase()}</p>
              <h2 className="font-display text-[34px] leading-tight">{endless ? "Endless Climb" : run.daily ? "📅 Daily Sky" : `Stage ${def.n}`}</h2>
              {(spec.twist || TOD_TEXT[spec.tod]) && (
                <p className="mt-1 flex flex-wrap justify-center gap-1.5">
                  {TOD_TEXT[spec.tod] && spec.twist !== "night" && <span className="rounded-full bg-[#2B1D52] px-2.5 py-0.5 font-display text-[13px] text-white">{TOD_TEXT[spec.tod]}</span>}
                  {spec.twist && <span className="rounded-full bg-[#FF5F7E] px-2.5 py-0.5 font-display text-[13px] text-white">{TWIST_INFO[spec.twist].icon} {TWIST_INFO[spec.twist].text}</span>}
                </p>
              )}
              {run.ghost && <p className="mt-1 text-[12.5px] font-extrabold text-[#2B1D52]/60">👻 Race your ghost — your best try so far!</p>}
              {!endless && <p className="font-display text-lg text-[#2B1D52]/70">{info.icon} {info.label}</p>}
              <p className="mt-1 text-[14px] font-bold text-[#2B1D52]/70">{endless ? "How high can you go? It gets harder with height!" : `⭐ ${spec.goal.text}`}</p>
              {!endless && !run.daily && def.s === 1 && def.n <= 100 && <p className="mt-2 rounded-2xl px-3 py-1.5 text-[13.5px] font-extrabold text-white" style={{ background: w.accent }}>New: {w.newIdea}!</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Safe Cloud: pick a power card */}
      <AnimatePresence>
        {h?.choosing && (
          <motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#2B1D52]/55 px-4">
            <p className="font-display text-[28px] text-white [text-shadow:0_3px_0_rgba(43,29,82,0.6)]">☁️ Safe Cloud! Pick a power</p>
            <div className="grid w-full max-w-md grid-cols-3 gap-2.5">
              {h.choosing.map((id, i) => (
                <motion.button key={id} type="button" onClick={() => pick(id)} initial={{ y: 40, opacity: 0, rotate: (i - 1) * 6 }} animate={{ y: 0, opacity: 1, rotate: (i - 1) * 3 }} transition={{ delay: 0.08 * i, type: "spring", damping: 14 }}
                  className="flex min-h-44 flex-col items-center justify-start gap-1.5 rounded-[22px] bg-white p-3 text-center shadow-[0_6px_0_rgba(43,29,82,0.3)] active:translate-y-1">
                  <span className="grid size-14 place-items-center rounded-2xl text-3xl" style={{ background: `${CARDS[id].color}2E` }}>{CARDS[id].icon}</span>
                  <span className="font-display text-[16px] leading-tight" style={{ color: CARDS[id].color }}>{CARDS[id].name}</span>
                  <span className="text-[12px] font-bold leading-snug text-[#2B1D52]/70">{CARDS[id].text}</span>
                </motion.button>
              ))}
            </div>
            <p className="text-[13px] font-bold text-white/80">It lasts for the rest of this climb.</p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tip === 0 && !intro && (
          <motion.div key="t0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-[14%] z-20 flex flex-col items-center gap-2">
            <span className="mb-hand text-5xl">👆</span>
            <span className="rounded-full bg-white px-4 py-1.5 font-display text-xl shadow-[0_4px_0_rgba(43,29,82,0.2)]">Drag left and right to steer</span>
          </motion.div>
        )}
        {tip === 1 && (
          <motion.div key="t1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-[14%] z-20 flex flex-col items-center gap-2 px-6 text-center">
            <span className="mb-tap text-5xl">👆</span>
            <span className="rounded-2xl bg-white px-4 py-2 font-display text-lg leading-tight shadow-[0_4px_0_rgba(43,29,82,0.2)]">TAP just as Momo lands —<br />when the ring turns <span className="text-[#E0A100]">gold</span> — for a PERFECT BOING!</span>
          </motion.div>
        )}
        {tip === 2 && (
          <motion.div key="t2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-[14%] z-20 flex justify-center px-6 text-center">
            <span className="rounded-2xl bg-[#FFC93C] px-4 py-2 font-display text-lg leading-tight text-[#5A3A00] shadow-[0_4px_0_rgba(90,58,0,0.25)]">5 Perfect Boings in a row = ☄️ COMET!<br />Pop friend bubbles — each friend saves you once.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ results
const Stat = ({ label, value, gold }: { label: string; value: string; gold?: boolean }) => (
  <div className="rounded-3xl bg-white/85 px-3 py-2.5 text-center shadow-[0_4px_0_rgba(43,29,82,0.14)]">
    <p className="text-[12px] font-extrabold tracking-wide text-[#2B1D52]/55 uppercase">{label}</p>
    <p className={`font-display text-2xl ${gold ? "text-[#E0A100]" : ""}`}>{value}</p>
  </div>
);
function ResultsScreen({ info, canNext, onNext, onRetry, onHome }: { info: ResultInfo; canNext: boolean; onNext: () => void; onRetry: () => void; onHome: () => void }) {
  const { res, def, endless, daily } = info;
  const head = endless ? `${res.height} m!` : res.won ? (daily ? "DAILY DONE!" : res.stars === 3 ? "SUPER!" : "HOORAY!") : "OOPS!";
  const goal = useMemo(() => (endless ? "" : daily ? dailySpec(daily, def.n).goal.text : buildStage(def).goal.text), [def, endless, daily]);
  useEffect(() => {
    const t = [0, 1, 2].filter((i) => i < res.stars).map((i) => setTimeout(() => audio.play("a:boing_marimba", { gain: 0.5, rate: [1, 1.26, 1.5][i], duck: false }), 450 + i * 280));
    return () => t.forEach(clearTimeout);
  }, [res.stars]);
  return (
    <div className="absolute inset-0 flex flex-col">
      <SkyBack w={def.world} />
      <div className="relative z-10 flex flex-1 overflow-y-auto px-5" style={{ paddingTop: "calc(var(--safe-top) + 1rem)", paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}>
        <div className="mb-res m-auto flex w-full max-w-sm flex-col items-center">
          <div className="mb-res-a flex flex-col items-center">
            <motion.h1 initial={{ scale: 0.4, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 10, stiffness: 220 }}
              className="mb-logo mb-res-h text-center font-display leading-none" style={{ color: res.won || endless ? "#2FCB8B" : "#FF5F7E" }}>{head}</motion.h1>
            <p className="mt-1 rounded-full bg-white/80 px-3 py-0.5 text-center font-display text-lg text-[#2B1D52]/75">{def.emoji} {endless ? "Endless Climb" : daily ? `Daily Sky · ${def.place}` : `Stage ${def.n} · ${def.name}`}</p>
            {daily && (info.streak ?? 0) > 0 && <p className="mt-2 rounded-full bg-[#FF5F7E] px-4 py-1 font-display text-lg text-white">🔥 {info.streak}-day streak!</p>}
            {!endless && (
              <div className="mt-3 flex gap-3">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.4 + i * 0.28, type: "spring", damping: 9, stiffness: 260 }}>
                    <Star className={`mb-res-star ${i < res.stars ? "fill-[#FFC93C] text-[#E0A100] drop-shadow-[0_4px_0_rgba(160,100,0,0.35)]" : "fill-white/70 text-[#2B1D52]/20"}`} />
                  </motion.span>
                ))}
              </div>
            )}
            {info.newBest && <p className="mt-3 rounded-full bg-[#FFC93C] px-4 py-1 font-display text-lg text-[#5A3A00]">NEW BEST!</p>}
          </div>
          <div className="mb-res-b flex w-full flex-col items-center">
            <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
              <Stat label={endless ? "Best height" : "Height"} value={endless ? `${Math.max(info.best, res.height)} m` : `${res.height} / ${res.top} m`} />
              <Stat label="Perfect Boings" value={String(res.perfects)} />
              <Stat label="Best chain" value={`×${res.bestChain}${res.comets ? ` · ☄️${res.comets}` : ""}`} />
              <Stat label="Coins" value={`+${info.reward}`} gold />
            </div>
            {!endless && <p className={`mt-3 rounded-full px-4 py-1 text-[14px] font-extrabold ${res.goalMet ? "bg-[#2FCB8B] text-white" : "bg-white/80 text-[#2B1D52]/70"}`}>{res.goalMet ? "✓" : "⭐"} {goal}</p>}
            {!res.won && !endless && <p className="mt-3 max-w-xs rounded-2xl bg-white/80 px-3 py-2 text-center text-[14.5px] font-bold text-[#2B1D52]/75">Tip: tap right as Momo lands for higher Perfect Boings, and grab friend bubbles — each friend saves you once!</p>}
            <div className="mt-5 flex w-full flex-col gap-3">
              {canNext ? <Btn big tone="orange" onClick={onNext} className="w-full">NEXT · STAGE {def.n + 1}<ChevronRight className="size-7" /></Btn>
                : daily && res.won ? null : <Btn big tone="orange" onClick={onRetry} className="w-full"><RotateCcw className="size-6" />{endless ? "CLIMB AGAIN" : res.won ? "PLAY AGAIN" : "TRY AGAIN"}</Btn>}
              <Btn tone="white" onClick={onHome} className="w-full"><Home className="size-5" />HOME</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ wardrobe
function WardrobeScreen({ onBack }: { onBack: () => void }) {
  const s = useBoing();
  const coins = useProfile((p) => p.coins);
  const [shake, setShake] = useState("");
  const tile = (kind: "hat" | "trail", it: { id: string; name: string; icon: string; price: number }) => {
    const key = `${kind}:${it.id}`, own = it.price === 0 || s.owned.includes(key), on = (kind === "hat" ? s.look.hat : s.look.trail) === it.id;
    return (
      <button key={key} type="button" onClick={() => {
        if (!own) { if (!s.buy(key, it.price)) { ui("a:bwomp"); setShake(key); setTimeout(() => setShake(""), 400); return; } ui("a:levelup"); }
        else ui("a:ding");
        s.setLook(kind === "hat" ? { hat: it.id } : { trail: it.id });
      }}
        className={`flex flex-col items-center gap-1 rounded-[22px] p-3 text-center transition active:scale-95 ${on ? "bg-white ring-4 ring-[#FF8A3D] shadow-[0_5px_0_rgba(43,29,82,0.2)]" : "bg-white/80 shadow-[0_4px_0_rgba(43,29,82,0.14)]"} ${shake === key ? "mb-shake" : ""}`}>
        <span className="text-4xl">{it.icon}</span>
        <span className="font-display text-[15px] leading-tight">{it.name}</span>
        {on ? <span className="rounded-full bg-[#2FCB8B] px-2 font-display text-[11px] text-white">WEARING</span>
          : own ? <span className="rounded-full bg-[#F4F0FF] px-2 font-display text-[11px] text-[#2B1D52]/70">WEAR</span>
          : <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FFC93C] py-px pr-2 pl-0.5 font-display text-[12px] text-[#5A3A00]"><CoinIcon size={14} />{it.price}</span>}
      </button>
    );
  };
  return (
    <div className="absolute inset-0 flex flex-col">
      <SkyBack w={1} />
      <div className="relative z-10"><TopBar title="Wardrobe" sub="Hats and trails for Momo" onBack={onBack} /></div>
      <div className="relative z-10 flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Hats</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 font-display text-lg shadow-[0_3px_0_rgba(43,29,82,0.16)]"><CoinIcon size={22} />{coins.toLocaleString("en-US")}</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">{HAT_ITEMS.map((h) => tile("hat", h))}</div>
          <h2 className="font-display text-xl">Trails</h2>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">{TRAIL_ITEMS.map((t) => tile("trail", t))}</div>
          <p className="px-2 text-center text-[13px] font-bold text-[#2B1D52]/55">Coins come from every MOMOBLOBS game: coins on the climb, stars, the Daily Sky and Endless.</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ settings
function SettingsScreen({ onBack }: { onBack: () => void }) {
  const s = useBoing();
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
      <SkyBack w={stageDef(Math.max(1, Math.min(AVAILABLE, s.current))).world} />
      <div className="relative z-10"><TopBar title="Settings" onBack={onBack} /></div>
      <div className="relative z-10 flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto flex max-w-md flex-col gap-4 rounded-[28px] bg-white/90 p-4 shadow-[0_6px_0_rgba(43,29,82,0.15)]">
          <Field label="Drag speed" hint="How far Momo moves when you drag.">
            {seg(String(s.settings.sensitivity), [["0.7", "Slow"], ["1", "Normal"], ["1.4", "Fast"]], (v) => s.setSettings({ sensitivity: Number(v) }))}
          </Field>
          <Field label="Graphics" hint="Lower it if the game feels slow.">
            {seg(s.settings.quality, [["auto", "Auto"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]], (v) => s.setSettings({ quality: v }))}
          </Field>
          <Field label="Vibration">{seg(s.settings.vibrate ? "on" : "off", [["on", "On"], ["off", "Off"]], (v) => s.setSettings({ vibrate: v === "on" }))}</Field>
          <Field label="Progress" hint={`On stage ${Math.min(AVAILABLE, s.current)} · ${s.plays} climbs · ${s.perfects.toLocaleString("en-US")} Perfect Boings · best chain ×${s.bestChain}`}>
            {confirm ? (
              <div className="grid grid-cols-2 gap-2"><Btn tone="pink" onClick={() => { s.reset(); setConfirm(false); }}>Yes, start over</Btn><Btn tone="white" onClick={() => setConfirm(false)}>Keep it</Btn></div>
            ) : <Btn tone="white" onClick={() => setConfirm(true)} className="w-full">Start over from stage 1</Btn>}
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
.mb-root{font-family:var(--font-sans),system-ui;overscroll-behavior:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
.mb-root canvas{touch-action:none}
.mb-root button{touch-action:manipulation}
.mb-logo{-webkit-text-stroke:7px #2B1D52;paint-order:stroke fill;text-shadow:0 7px 0 #2B1D52}
.mb-hop{animation:mb-hop 1.1s cubic-bezier(.3,0,.4,1) infinite}
@keyframes mb-hop{0%,100%{transform:translateY(0) scale(1.06,.92)}12%{transform:translateY(0) scale(.94,1.08)}45%{transform:translateY(-14px) scale(.98,1.03)}80%{transform:translateY(0) scale(1,1)}}
.mb-cloud{width:180px;height:60px;border-radius:999px;background:rgba(255,255,255,.75);box-shadow:40px -18px 0 6px rgba(255,255,255,.75),-38px -10px 0 0 rgba(255,255,255,.75);animation:mb-cloud linear infinite}
@keyframes mb-cloud{from{translate:-30vw 0}to{translate:130vw 0}}
.mb-hand{animation:mb-hand 1.4s ease-in-out infinite}
@keyframes mb-hand{0%,100%{transform:translateX(-60px) rotate(-10deg)}50%{transform:translateX(60px) rotate(10deg)}}
.mb-tap{animation:mb-tap .9s ease-in-out infinite}
@keyframes mb-tap{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(10px) scale(.88)}}
.mb-shake{animation:mb-shake .35s ease-in-out}
@keyframes mb-shake{0%,100%{translate:0}25%{translate:-6px}75%{translate:6px}}
.mb-flash{box-shadow:inset 0 0 90px 30px rgba(255,60,90,.5);animation:mb-flash .45s ease-out forwards}
@keyframes mb-flash{from{opacity:1}to{opacity:0}}
.mb-res-h{font-size:clamp(52px,15vw,92px)}
.mb-res-star{width:64px;height:64px}
@media (orientation:landscape) and (max-height:520px){
  .mb-res{max-width:760px;flex-direction:row;align-items:center;gap:28px}
  .mb-res-a,.mb-res-b{flex:1 1 0}
  .mb-res-h{font-size:clamp(44px,9vh + 20px,72px)}
  .mb-res-star{width:52px;height:52px}
}
`;
