"use client";
// Momo Dash! front-end, Subway style: home (Momo running toward you behind the logo, your best, missions), RUN starts
// at the beginning every time and the stages keep coming — no stage numbers, no stage select — through world after
// world until Momo is caught. Then the run card (score, distance, missions), the shop and settings.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Home, Play, RotateCcw, Settings2, ShoppingBag, Star } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { FRIENDS, INTRO_TEXT, POWERS, TWIST_INFO, WORLDS, dailyKey, dailyRun, newPiece, sectionOf, worldIndex } from "../levels";
import { MISSION_DEFS, missionText, type Mission } from "../missions";
import { BOARDS, TRAILS } from "../render";
import { DASH_CSS, DashSession, type HudState, type Toast } from "../session";
import { autoQuality, useDash, useDashHydrated } from "../save";
import type { FriendId, PowerId, RunSpec, Section, SimEvent, SimResult } from "../types";

type Screen = "title" | "game" | "over" | "shop" | "settings";
interface GameRun { key: number; spec: RunSpec }
interface Over { res: SimResult; reward: number; newBest: boolean; done: Mission[]; levelUp: boolean; daily?: string; streak: number }

const UI_SOUNDS: Sound[] = ["a:click", "a:whooshOut", "a:whooshIn", "a:ding", "a:levelup", "tada", "a:cheer", "sadtrombone", "a:dash_coin", "a:dash_trick", "a:bwomp"];
const musicOf = (id: string): MusicName => (id === "chase" ? "a:dash_chase_action" : `a:dash_${id}_action`) as MusicName;
const isAutomation = () => typeof navigator !== "undefined" && Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver);
const isPhone = () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false) && Math.min(window.innerWidth, window.innerHeight) < 600;
const ui = (s: Sound = "a:click", gain = 0.4) => {
  audio.play(s, { gain, duck: false });
  if (useDash.getState().settings.vibrate && typeof navigator !== "undefined" && navigator.vibrate) { try { navigator.vibrate(8); } catch { /* blocked */ } }
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

// ------------------------------------------------------------------ shop catalogue
const CHARS: { id: string; name: string; price: number }[] = [
  { id: "momo", name: "Momo", price: 0 }, { id: "zib", name: "Zib", price: 500 }, { id: "pip", name: "Pip", price: 500 }, { id: "bolt", name: "Bolt", price: 600 },
  { id: "gloop", name: "Gloop", price: 700 }, { id: "bonbon", name: "Bonbon", price: 800 }, { id: "hoot", name: "Prof. Hoot", price: 900 }, { id: "turbo", name: "Turbo", price: 1000 },
  { id: "noodle", name: "Noodle", price: 1100 }, { id: "tiki", name: "Tiki", price: 1200 }, { id: "kranky", name: "Kranky", price: 1500 },
];
const CHAR_ICON: Record<string, string> = { momo: "🍊", zib: "👽", pip: "🐧", bolt: "🤖", gloop: "🟢", bonbon: "🧁", hoot: "🦉", turbo: "🏎️", noodle: "🍜", tiki: "🗿", kranky: "🦀" };
const HATS: { id: string; name: string; icon: string; price: number }[] = [
  { id: "none", name: "No hat", icon: "🚫", price: 0 }, { id: "party", name: "Party Hat", icon: "🎉", price: 150 }, { id: "flower", name: "Flower Crown", icon: "🌼", price: 200 },
  { id: "cowboy", name: "Cowboy Hat", icon: "🤠", price: 300 }, { id: "pirate", name: "Pirate Hat", icon: "🏴‍☠️", price: 350 }, { id: "wizard", name: "Wizard Hat", icon: "🧙", price: 400 },
  { id: "santa", name: "Santa Hat", icon: "🎅", price: 350 }, { id: "propeller", name: "Propeller Cap", icon: "🌀", price: 450 }, { id: "viking", name: "Viking Helmet", icon: "⚔️", price: 500 },
  { id: "chef", name: "Chef Hat", icon: "👨‍🍳", price: 450 }, { id: "crown", name: "Royal Crown", icon: "👑", price: 900 },
];
const TRAIL_ITEMS: { id: string; name: string; icon: string; price: number }[] = [
  { id: "none", name: "No trail", icon: "🚫", price: 0 }, { id: "stars", name: "Star Trail", icon: "⭐", price: 150 }, { id: "hearts", name: "Heart Trail", icon: "💖", price: 200 },
  { id: "bubbles", name: "Bubble Trail", icon: "🔵", price: 200 }, { id: "fire", name: "Fire Trail", icon: "🔥", price: 300 }, { id: "sparkle", name: "Sparkle Trail", icon: "✨", price: 300 }, { id: "rainbow", name: "Rainbow Trail", icon: "🌈", price: 600 },
];
const BOARD_ITEMS: { id: string; name: string; price: number }[] = [
  { id: "jelly", name: "Jelly Pink", price: 0 }, { id: "lime", name: "Lime Fizz", price: 200 }, { id: "ocean", name: "Ocean Glow", price: 250 }, { id: "night", name: "Night Grape", price: 400 }, { id: "gold", name: "Golden Board", price: 600 },
];
const UP_PRICE = [100, 250, 450, 700, 1000];
void TRAILS;

// ------------------------------------------------------------------ kit: sporty, slanted, glossy
type Tone = "sun" | "berry" | "mint" | "night" | "white";
const TONES: Record<Tone, string> = {
  sun: "bg-[linear-gradient(180deg,#FFC23D_0%,#FF8A3D_55%,#FF5F3D_100%)] text-white shadow-[0_6px_0_#A8361E,0_10px_18px_rgba(120,30,10,0.35)] active:shadow-[0_2px_0_#A8361E]",
  berry: "bg-[linear-gradient(180deg,#FF8FC7_0%,#FF4F9A_60%,#E0307A_100%)] text-white shadow-[0_6px_0_#9A1F55,0_10px_18px_rgba(120,20,60,0.3)] active:shadow-[0_2px_0_#9A1F55]",
  mint: "bg-[linear-gradient(180deg,#7CFFB2_0%,#2FCB8B_60%,#1FA872_100%)] text-white shadow-[0_6px_0_#127048] active:shadow-[0_2px_0_#127048]",
  night: "bg-[linear-gradient(180deg,#5B4BC4_0%,#3A2C8F_100%)] text-white shadow-[0_6px_0_#1E1656] active:shadow-[0_2px_0_#1E1656]",
  white: "bg-white text-[#2B1D52] shadow-[0_6px_0_#BDB2E6] active:shadow-[0_2px_0_#BDB2E6]",
};
function Btn({ tone = "sun", big, className = "", children, onClick, disabled, label }: { tone?: Tone; big?: boolean; className?: string; children: ReactNode; onClick?: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={() => { ui(); onClick?.(); }}
      className={`md-btn relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[18px] border-[3px] border-[#2B1D52] font-display tracking-wide transition-[transform,box-shadow] duration-75 active:translate-y-1 disabled:pointer-events-none disabled:opacity-45 ${big ? "min-h-16 px-7 text-[26px]" : "min-h-12 px-5 text-lg"} ${TONES[tone]} ${className}`}>
      <span className="pointer-events-none absolute inset-x-2 top-1 h-[38%] rounded-full bg-white/30" />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  );
}
const Pill = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border-2 border-white/25 bg-[#241A5A]/75 px-3 py-1 font-display text-[16px] text-white shadow-[0_3px_0_rgba(20,10,50,0.35)] backdrop-blur-sm ${className}`}>{children}</span>
);
function TopBar({ title, sub, onBack, right }: { title: string; sub?: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pr-16 pl-4 pb-2" style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)" }}>
      <button type="button" aria-label="Back" onClick={() => { ui("a:whooshOut", 0.3); onBack(); }} className="grid size-12 shrink-0 place-items-center rounded-2xl border-[3px] border-[#2B1D52] bg-white text-[#2B1D52] shadow-[0_4px_0_#BDB2E6] active:translate-y-1 active:shadow-none"><ArrowLeft className="size-6" /></button>
      <div className="min-w-0 flex-1">
        <h1 className="md-title truncate font-display text-[28px] leading-tight text-white">{title}</h1>
        {sub && <p className="truncate text-sm font-bold text-white/75">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
function Backdrop({ w = 0 }: { w?: number }) {
  const W = WORLDS[w] ?? WORLDS[0];
  const bg = `linear-gradient(180deg,#1C1956 0%,${W.accent2} 60%,${W.accent} 130%)`;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: bg }}>
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="md-dot absolute rounded-full" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 85}%`, width: 6 + (i % 4) * 4, height: 6 + (i % 4) * 4, background: ["#FFD58A", "#FF9FC8", "#9FE6FF", "#FFFFFF"][i % 4], animationDelay: `${-i * 0.7}s` }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(0deg,rgba(43,29,82,0.55),transparent)]" />
    </div>
  );
}

// ------------------------------------------------------------------ the 3D view (game or title attract)
function GameCanvas({ spec, attract, onReady, quality, vibrate, onEnd, onToast, onEvent, onWorld, onBoard }: {
  spec: RunSpec; attract?: boolean; quality: "low" | "medium" | "high"; vibrate?: boolean;
  onReady?: (s: DashSession) => void; onEnd?: (r: SimResult, used: string[]) => void; onToast?: (t: Toast) => void; onEvent?: (e: SimEvent) => void; onWorld?: (s: Section) => void; onBoard?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onEnd, onToast, onEvent, onWorld, onBoard });
  useEffect(() => { cb.current = { onReady, onEnd, onToast, onEvent, onWorld, onBoard }; });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const st = useDash.getState();
    const s = new DashSession(el, spec, {
      quality, attract, vibrate, look: st.look, mult: attract ? 1 : st.level, up: st.up, boards: st.boards,
      onEnd: (r, used) => cb.current.onEnd?.(r, used), onToast: (t) => cb.current.onToast?.(t), onEvent: (e) => cb.current.onEvent?.(e),
      onWorld: (sec) => cb.current.onWorld?.(sec), onBoard: () => cb.current.onBoard?.(),
    });
    cb.current.onReady?.(s);
    return () => s.destroy();
  }, [spec, attract, quality, vibrate]);
  return <div ref={host} className="absolute inset-0" />;
}

// ------------------------------------------------------------------ the app
export default function DashApp({ title }: { slug: string; title: string }) {
  const ready = useDashHydrated();
  const s = useDash();
  const player = usePlayer();
  const { setImmersive, setLoading, setInRound, setMenu } = player;
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<GameRun | null>(null);
  const [over, setOver] = useState<Over | null>(null);
  const quality = s.settings.quality === "auto" ? autoQuality() : s.settings.quality;

  useEffect(() => { setLoading(null); }, [setLoading]);
  useEffect(() => { void audio.preload(UI_SOUNDS); }, []);
  useEffect(() => { setImmersive(screen !== "title"); setInRound(screen === "game"); }, [screen, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => { if (screen !== "game") void audio.playMusic("a:dash_pier_calm"); }, [screen]);

  // the title demo: Momo running on Sunset Pier
  const titleSpec = useMemo<RunSpec>(() => ({ seed: 4242, start: 6, demo: true }), []);

  const start = useCallback((daily?: string) => {
    setOver(null);
    const st = useDash.getState();
    // the quiet helper: after a few very short runs in a row, the next run starts a little kinder (nothing on screen says so)
    const spec: RunSpec = daily ? dailyRun(daily) : { seed: Math.floor(Math.random() * 1e9), start: 1, help: st.shortRuns >= 3 };
    spec.recent = st.recent;
    setRun((r) => ({ key: (r?.key ?? 0) + 1, spec }));
    setScreen("game");
  }, []);

  const onEnd = useCallback((res: SimResult, used: string[]) => {
    if (!run) return;
    const st = useDash.getState();
    const out = st.finishRun(res, used, run.spec.daily);
    const reward = res.coins + out.done.length * 25 + (out.levelUp ? 100 * useDash.getState().level : 0) + (out.streak > 0 ? 50 + out.streak * 10 : 0);
    useProfile.getState().earnCoins(reward);
    setOver({ res, reward, newBest: out.newBest, done: out.done, levelUp: out.levelUp, daily: run.spec.daily, streak: out.streak });
    setScreen("over");
  }, [run]);

  useEffect(() => {
    if (screen !== "game") return;
    setMenu([
      { id: "restart", label: "Run again", icon: "🔄", onSelect: () => { player.setPaused(false); start(run?.spec.daily); } },
      { id: "home", label: "Home", icon: "🏠", onSelect: () => { player.setPaused(false); setScreen("title"); } },
    ]);
  }, [screen, run, setMenu, start, player]);

  if (!ready) return <div className="absolute inset-0 bg-[#3A2C8F]" />;

  return (
    <div className="md-root absolute inset-0 overflow-hidden text-[#2B1D52] select-none" onContextMenu={(e) => e.preventDefault()}>
      <style>{DASH_CSS + APP_CSS}</style>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={screen === "game" ? `game-${run?.key}` : screen} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="absolute inset-0">
          {screen === "title" && <TitleScreen title={title} spec={titleSpec} quality={quality} onRun={() => { void appMode(); start(); }} onDaily={() => { void appMode(); start(dailyKey()); }} onShop={() => setScreen("shop")} onSettings={() => setScreen("settings")} />}
          {screen === "game" && run && (
            <GameScreen key={run.key} run={run} quality={quality} vibrate={s.settings.vibrate} best={s.best.score}
              tutorial={!s.tutorialDone && !isAutomation()} onTutorialDone={() => useDash.getState().setTutorialDone(true)} onEnd={onEnd} />
          )}
          {screen === "over" && over && <OverScreen info={over} onRetry={() => start(over.daily)} onHome={() => setScreen("title")} onShop={() => setScreen("shop")} />}
          {screen === "shop" && <ShopScreen onBack={() => setScreen("title")} />}
          {screen === "settings" && <SettingsScreen onBack={() => setScreen("title")} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ home
function Missions({ list, level, compact }: { list: Mission[]; level: number; compact?: boolean }) {
  return (
    <div className="w-full rounded-[22px] border-[3px] border-[#2B1D52] bg-white/95 p-3 shadow-[0_5px_0_rgba(20,10,50,0.35)]">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="font-display text-[15px] tracking-wide">🎯 MISSIONS</p>
        <span className="rounded-full bg-[#FFC23D] px-2.5 py-0.5 font-display text-[14px] text-[#5A3A00]">Score ×{level}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {list.map((m) => {
          const done = m.have >= m.goal, f = Math.min(1, m.have / Math.max(1, m.goal));
          return (
            <div key={m.kind} className="flex items-center gap-2">
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[13px] ${done ? "bg-[#2FCB8B] text-white" : "bg-[#EEE9FF]"}`}>{done ? "✓" : ""}</span>
              <div className="min-w-0 flex-1">
                <p className={`truncate font-bold ${compact ? "text-[12.5px]" : "text-[13.5px]"} ${done ? "text-[#2B1D52]/45 line-through" : ""}`}>{missionText(m)}</p>
                {!done && !MISSION_DEFS[m.kind]?.one && <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[#EEE9FF]"><div className="h-full rounded-full bg-[#FF8A3D]" style={{ width: `${f * 100}%` }} /></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function TitleScreen({ title, spec, quality, onRun, onDaily, onShop, onSettings }: {
  title: string; spec: RunSpec; quality: "low" | "medium" | "high"; onRun: () => void; onDaily: () => void; onShop: () => void; onSettings: () => void;
}) {
  const s = useDash();
  const coins = useProfile((p) => p.coins);
  const today = dailyKey(), dailyDone = s.daily.doneKey === today;
  const dw = WORLDS[sectionOf(dailyRun(today).start).w];
  return (
    <div className="absolute inset-0 bg-[#3A2C8F]">
      <GameCanvas spec={spec} attract quality={quality === "high" ? "medium" : quality} onReady={(ss) => { if (process.env.NODE_ENV !== "production" || isAutomation()) (window as unknown as { __dashTitle?: DashSession }).__dashTitle = ss; }} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(28,25,86,0.55)_0%,transparent_30%,transparent_42%,rgba(28,25,86,0.8)_100%)]" />
      <div className="absolute inset-x-0 top-0 flex flex-col items-center px-4 text-center" style={{ paddingTop: "calc(var(--safe-top) + 3.6rem)" }}>
        <p className="font-display text-sm tracking-[0.3em] text-[#FFD23F]">MOMOBLOBS</p>
        <h1 className="md-logo font-display text-[clamp(52px,15vw,100px)] leading-[0.86]">
          {title.toUpperCase().replace("!", "").split(" ").map((wd, i) => (
            <span key={wd} className="block">{wd.split("").map((c, j) => <span key={j} className="md-run inline-block" style={{ animationDelay: `${(i * 4 + j) * 0.09}s`, color: i ? "#FF5FA2" : "#FFC23D" }}>{c}</span>)}{i ? <span className="md-run inline-block text-[#7CFFB2]" style={{ animationDelay: "0.7s" }}>!</span> : null}</span>
          ))}
        </h1>
        <div className="mt-2.5 flex flex-wrap justify-center gap-2">
          <Pill>🏆 {s.best.score.toLocaleString("en-US")}</Pill>
          <Pill>🏁 {s.best.distance.toLocaleString("en-US")} m</Pill>
          <Pill><CoinIcon size={18} />{coins.toLocaleString("en-US")}</Pill>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-3 px-5" style={{ paddingBottom: "calc(var(--safe-bottom) + 1.2rem)" }}>
        <Missions list={s.missions} level={s.level} compact />
        <div className="grid grid-cols-[1fr_auto_auto] gap-2.5">
          <Btn big tone="sun" onClick={onRun} className="w-full"><Play className="size-7 fill-current" />RUN!</Btn>
          <Btn big tone="white" onClick={onShop} label="Shop" className="w-16 !px-0"><ShoppingBag style={{ width: 28, height: 28 }} strokeWidth={2.4} /></Btn>
          <Btn big tone="white" onClick={onSettings} label="Settings" className="w-16 !px-0"><Settings2 style={{ width: 28, height: 28 }} strokeWidth={2.4} /></Btn>
        </div>
        <Btn tone="night" onClick={onDaily} label="Daily Dash" className="relative w-full">
          {dailyDone ? "✅" : "📅"} DAILY DASH · {dw.emoji} {dw.name}
          {s.daily.streak > 0 && <span className="absolute -top-2.5 -right-1 rounded-full bg-[#FFC93C] px-1.5 py-0.5 text-[12px] leading-none text-[#5A3A00]">🔥{s.daily.streak}</span>}
        </Btn>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the run + HUD
interface ToastItem extends Toast { id: number }
const TIPS = [
  { icon: "👆", text: "Swipe LEFT or RIGHT to change lanes", cls: "md-hand-x" },
  { icon: "👆", text: "Swipe UP to jump", cls: "md-hand-up" },
  { icon: "👆", text: "Swipe DOWN to squish (or drop fast)", cls: "md-hand-down" },
  { icon: "👆👆", text: "Double-tap to ride a Jelly Board — it saves you once!", cls: "md-tap" },
];
function GameScreen({ run, quality, vibrate, best, tutorial, onTutorialDone, onEnd }: {
  run: GameRun; quality: "low" | "medium" | "high"; vibrate: boolean; best: number; tutorial: boolean; onTutorialDone: () => void; onEnd: (r: SimResult, used: string[]) => void;
}) {
  const player = usePlayer();
  const sess = useRef<DashSession | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [tip, setTip] = useState(tutorial ? 0 : -1);
  const [card, setCard] = useState<Section | null>(() => sectionOf(run.spec.start));
  const [hint, setHint] = useState<string | null>(null);
  const tid = useRef(0);
  const doneRef = useRef(onTutorialDone);
  const music = useRef("");
  useEffect(() => { doneRef.current = onTutorialDone; });
  const { spec } = run;

  // the world card at the start (and at every new world), with that world's music
  const showWorld = useCallback((sec: Section) => {
    setCard(sec);
    setTimeout(() => setCard((c) => (c === sec ? null : c)), 2600);
  }, []);
  useEffect(() => { const t = setTimeout(() => setCard((c) => (c?.n === spec.start ? null : c)), 2600); return () => clearTimeout(t); }, [spec.start]);
  useEffect(() => {
    const iv = setInterval(() => {
      const s = sess.current;
      if (!s) return;
      const h = s.hud();
      setHud(h);
      const want = h.boost > 0 ? "star" : h.chase ? "chase" : s.sim.sec.music;
      if (want !== music.current) { music.current = want; void audio.playMusic(musicOf(want)); }
      const np = newPiece(s.sim.sec.n);
      setHint(np && INTRO_TEXT[np] ? INTRO_TEXT[np] : null);
    }, 100);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { const s = sess.current; if (!s) return; if (player.paused) s.pause(); else s.resume(); }, [player.paused]);
  // tutorial: lanes, jump, squish, the board (each waits for the move, or moves on after ~120 m)
  useEffect(() => {
    if (tip < 0) return;
    if (tip >= TIPS.length) { doneRef.current(); return; }
    const z0 = sess.current?.sim.z ?? 0, j0 = sess.current?.sim.stats.jumps ?? 0;
    const iv = setInterval(() => {
      const cur = sess.current;
      if (!cur) return;
      if (tip === 0 && cur.sim.lane !== 0) setTip(1);
      else if (tip === 1 && cur.sim.stats.jumps > j0) setTip(2);
      else if (tip === 2 && cur.sim.squishT > 0) setTip(3);
      else if (tip === 3 && cur.sim.boardT > 0) setTip(4);
      else if (cur.sim.z - z0 > 120) setTip(tip + 1);
    }, 120);
    return () => clearInterval(iv);
  }, [tip]);

  const onToast = useCallback((t: Toast) => {
    const id = ++tid.current;
    setToasts((l) => [...l.slice(-1), { ...t, id }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 1600);
  }, []);
  const onReady = useCallback((s: DashSession) => {
    sess.current = s;
    if (process.env.NODE_ENV !== "production" || isAutomation()) (window as unknown as { __dash?: DashSession }).__dash = s;
  }, []);
  const [flash, setFlash] = useState(0);
  const onEvent = useCallback((e: SimEvent) => { if (e.t === "crash" || e.t === "stumble" || e.t === "friendSave") setFlash((f) => f + 1); }, []);

  const h = hud;
  return (
    <div className="absolute inset-0 bg-[#1C1956]">
      <GameCanvas spec={spec} quality={quality} vibrate={vibrate} onReady={onReady} onEnd={onEnd} onToast={onToast} onEvent={onEvent} onWorld={showWorld} onBoard={() => useDash.getState().spendBoard()} />
      {flash > 0 && <div key={flash} className="md-flash pointer-events-none absolute inset-0 z-10" />}
      {h && h.stumble > 0 && <div className="md-danger pointer-events-none absolute inset-0 z-10" />}
      {h && h.boost > 0 && <div className="md-boostfx pointer-events-none absolute inset-0 z-10" />}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-1.5 px-3" style={{ paddingTop: "calc(var(--safe-top) + 0.55rem)" }}>
        <div className="flex items-start justify-between gap-2 pr-14">
          <div className="flex flex-col items-start gap-1.5">
            <Pill className="!text-[22px]"><span className="text-[#FFD23F]">{(h?.score ?? 0).toLocaleString("en-US")}</span>{h && h.mult > 1 && <span className="rounded-full bg-[#FFD23F] px-1.5 text-[13px] text-[#5A3A00]">×{h.mult}</span>}</Pill>
            <Pill><CoinIcon size={18} />{h?.coins ?? 0}</Pill>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Pill>🏁 {Math.round(h?.z ?? 0).toLocaleString("en-US")} m</Pill>
            {h && <Pill className="!text-[13px]">{h.emoji} {h.place}</Pill>}
            {h && h.score > best && best > 0 && <Pill className="!bg-[#2FCB8B]/90 !text-[13px]">NEW BEST!</Pill>}
          </div>
        </div>
        {h && h.boost > 0 && (
          <div className="mx-auto w-[70%] max-w-xs">
            <p className="md-title text-center font-display text-[22px] text-[#FFD23F]">🚀 BOOSTER ×{h.boost}</p>
            <div className="h-3 overflow-hidden rounded-full border-2 border-[#2B1D52] bg-white/40"><div className="h-full rounded-full bg-[linear-gradient(90deg,#FFC23D,#FF5F3D)]" style={{ width: `${(h.boostLeft / h.boostMax) * 100}%` }} /></div>
          </div>
        )}
        <div className="flex flex-col items-start gap-1.5">
          {h?.powers.map((p) => (
            <span key={p.id} className="relative grid size-12 place-items-center rounded-2xl border-[3px] border-[#2B1D52] text-2xl" style={{ background: `conic-gradient(${p.color} ${(p.left / p.max) * 360}deg, rgba(36,26,90,0.75) 0deg)` }}>
              <span className="grid size-9 place-items-center rounded-xl bg-[#241A5A]">{p.icon}</span>
            </span>
          ))}
          {h && h.friends.length > 0 && (
            <Pill className="!px-2">{h.friends.map((f, i) => <span key={i} className="grid size-6 place-items-center rounded-full border-2 border-white text-[11px] text-white" style={{ background: FRIENDS[f as FriendId].color }}>{FRIENDS[f as FriendId].name[0]}</span>)}{h.fever && <span className="text-[13px] text-[#FFD23F]">FEVER!</span>}</Pill>
          )}
          {h && h.letters && <Pill className="!text-[14px]">🔤 {"MOMO".split("").map((c, i) => <span key={i} className={i < h.letters.length ? "text-[#FFD23F]" : "text-white/35"}>{c}</span>)}</Pill>}
          {h && h.chase && <Pill className="!text-[14px]">🏃 Thief: {Math.min(3, h.pads)}/3 pads</Pill>}
        </div>
      </div>
      {h && h.boards > 0 && !h.counting && (
        <div className="pointer-events-none absolute right-3 z-20" style={{ bottom: "calc(var(--safe-bottom) + 1rem)" }}>
          <Pill className="!text-[13px]">🛹 ×{h.boards} · double-tap</Pill>
        </div>
      )}

      {/* toasts */}
      <div className="pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-2 px-6" style={{ top: "calc(var(--safe-top) + 10rem)" }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: -10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className={`rounded-full border-[3px] border-[#2B1D52] px-4 py-1.5 text-center font-display shadow-[0_4px_0_rgba(20,10,50,0.35)] ${t.big ? "text-xl" : "text-[15px]"} ${t.tone === "gold" ? "bg-[#FFD23F] text-[#5A3A00]" : t.tone === "good" ? "bg-[#7CFFB2] text-[#0F4A30]" : t.tone === "bad" ? "bg-[#FF6B8A] text-white" : "bg-white text-[#2B1D52]"}`}>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* the world card */}
      <AnimatePresence>
        {card && (
          <motion.div key={card.n} initial={{ opacity: 0, scale: 0.7, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -20 }} transition={{ type: "spring", damping: 16, stiffness: 240 }}
            className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-6" style={{ bottom: "calc(var(--safe-bottom) + 5.5rem)" }}>
            <div className="w-full max-w-sm rounded-[24px] border-[3px] border-[#2B1D52] bg-white/95 px-5 py-3 text-center shadow-[0_6px_0_rgba(20,10,50,0.35)]">
              <p className="font-display text-xs tracking-[0.2em] text-[#FF8A3D]">{run.spec.daily ? "📅 DAILY DASH" : card.n === spec.start ? "GET READY!" : "NEW WORLD!"}</p>
              <h2 className="font-display text-[30px] leading-tight">{card.emoji} {card.place}</h2>
              <p className="text-[13.5px] font-bold text-[#2B1D52]/65">{WORLDS[worldIndex(card.scene)].blurb}</p>
              {card.twist && <p className="mt-1.5 inline-block rounded-full bg-[#FF5F7E] px-3 py-0.5 font-display text-[13px] text-white">{TWIST_INFO[card.twist].icon} {TWIST_INFO[card.twist].text}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* a hint when a new piece first shows up */}
      {hint && !card && tip < 0 && <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-6" style={{ bottom: "calc(var(--safe-bottom) + 4.2rem)" }}><p className="rounded-full border-[3px] border-[#2B1D52] bg-white px-4 py-1.5 text-center font-display text-[15px] shadow-[0_4px_0_rgba(20,10,50,0.3)]">💡 {hint}</p></div>}

      {/* tutorial */}
      {tip >= 0 && tip < TIPS.length && !card && (
        <div className="pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-3 px-6" style={{ bottom: "calc(var(--safe-bottom) + 6rem)" }}>
          <span className={`text-6xl ${TIPS[tip].cls}`}>{TIPS[tip].icon}</span>
          <p className="rounded-full border-[3px] border-[#2B1D52] bg-white px-4 py-2 text-center font-display text-lg shadow-[0_4px_0_rgba(20,10,50,0.35)]">{TIPS[tip].text}</p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the run card
function OverScreen({ info, onRetry, onHome, onShop }: { info: Over; onRetry: () => void; onHome: () => void; onShop: () => void }) {
  const { res } = info;
  const s = useDash();
  useEffect(() => { if (info.newBest) setTimeout(() => audio.play("tada", { gain: 0.6, duck: false }), 400); }, [info.newBest]);
  const stat = (label: string, value: ReactNode) => (
    <div className="flex flex-col items-center rounded-2xl border-[3px] border-[#2B1D52] bg-white px-2 py-2 shadow-[0_4px_0_rgba(20,10,50,0.3)]">
      <span className="text-[11px] font-extrabold tracking-wider text-[#2B1D52]/55 uppercase">{label}</span>
      <span className="font-display text-[22px] leading-tight">{value}</span>
    </div>
  );
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop w={Math.max(0, res.bestWorld - 1)} />
      <div className="relative z-10 flex flex-1 overflow-y-auto px-5" style={{ paddingTop: "calc(var(--safe-top) + 1rem)", paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}>
        <div className="m-auto flex w-full max-w-sm flex-col items-center">
          <motion.h1 initial={{ scale: 0.4, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 10, stiffness: 220 }}
            className="md-logo text-center font-display text-[clamp(44px,13vw,64px)] leading-none" style={{ color: info.newBest ? "#7CFFB2" : "#FFC23D" }}>{info.newBest ? "NEW BEST!" : "CAUGHT!"}</motion.h1>
          <p className="mt-2 font-display text-[44px] leading-none text-white drop-shadow-[0_3px_0_rgba(43,29,82,0.8)]">{res.score.toLocaleString("en-US")}</p>
          <p className="font-display text-white/80">Best {Math.max(s.best.score, res.score).toLocaleString("en-US")}</p>
          {info.daily && <p className="mt-2 rounded-full bg-[#FF5F7E] px-4 py-1 font-display text-white">{info.streak > 0 ? `📅 Daily done! 🔥 ${info.streak}-day streak` : res.distance >= 1000 ? "📅 Daily done today" : "📅 Run 1000 m to finish today's Daily Dash"}</p>}
          <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
            {stat("Distance", `${res.distance.toLocaleString("en-US")} m`)}
            {stat("Coins", <span className="inline-flex items-center gap-1"><CoinIcon size={20} />+{info.reward}</span>)}
            {stat("World", `${WORLDS[Math.max(0, res.bestWorld - 1)].emoji} ${res.bestWorld}/12`)}
            {stat("Tricks", `${res.tricks} · ×${res.bestCombo}`)}
          </div>
          {info.done.length > 0 && <p className="mt-3 rounded-full border-[3px] border-[#2B1D52] bg-[#7CFFB2] px-4 py-1 text-center font-display text-[15px] text-[#0F4A30]">🎯 {info.done.length} mission{info.done.length > 1 ? "s" : ""} done!</p>}
          {info.levelUp && <p className="mt-2 rounded-full border-[3px] border-[#2B1D52] bg-[#FFC23D] px-4 py-1 text-center font-display text-lg text-[#5A3A00]">⬆️ Score multiplier ×{s.level}!</p>}
          <div className="mt-3 w-full"><Missions list={s.missions} level={s.level} compact /></div>
          <div className="mt-4 flex w-full flex-col gap-3">
            <Btn big tone="sun" onClick={onRetry} className="w-full"><RotateCcw className="size-6" />RUN AGAIN</Btn>
            <div className="grid grid-cols-2 gap-3">
              <Btn tone="white" onClick={onHome} className="w-full"><Home className="size-5" />HOME</Btn>
              <Btn tone="berry" onClick={onShop} className="w-full"><ShoppingBag className="size-5" />SHOP</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ shop
type Tab = "chars" | "hats" | "trails" | "boards" | "ups";
function ShopScreen({ onBack }: { onBack: () => void }) {
  const s = useDash();
  const coins = useProfile((p) => p.coins);
  const [tab, setTab] = useState<Tab>("chars");
  const [shake, setShake] = useState("");
  const fail = (key: string) => { ui("a:bwomp"); setShake(key); setTimeout(() => setShake(""), 400); };
  const tile = (key: string, on: boolean, own: boolean, price: number, icon: ReactNode, name: string, onPick: () => void) => (
    <button key={key} type="button" onClick={onPick}
      className={`flex flex-col items-center gap-1 rounded-[20px] border-[3px] p-2.5 text-center transition active:scale-95 ${on ? "border-[#FF8A3D] bg-white shadow-[0_5px_0_rgba(43,29,82,0.2)]" : "border-[#2B1D52] bg-white/90 shadow-[0_4px_0_rgba(43,29,82,0.18)]"} ${shake === key ? "md-shake" : ""}`}>
      <span className="text-4xl">{icon}</span>
      <span className="font-display text-[14px] leading-tight">{name}</span>
      {on ? <span className="rounded-full bg-[#2FCB8B] px-2 font-display text-[11px] text-white">USING</span>
        : own ? <span className="rounded-full bg-[#EEE9FF] px-2 font-display text-[11px] text-[#2B1D52]/70">USE</span>
        : <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FFC93C] py-px pr-2 pl-0.5 font-display text-[12px] text-[#5A3A00]"><CoinIcon size={14} />{price}</span>}
    </button>
  );
  const buyUse = (key: string, price: number, apply: () => void) => {
    const own = price === 0 || s.owned.includes(key);
    if (!own) { if (!s.buy(key, price)) return fail(key); ui("a:levelup"); } else ui("a:ding");
    apply();
  };
  const TABS: [Tab, string][] = [["chars", "🍊 Runners"], ["hats", "🎩 Hats"], ["trails", "✨ Trails"], ["boards", "🛹 Boards"], ["ups", "⬆️ Power-ups"]];
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop w={3} />
      <div className="relative z-10"><TopBar title="Shop" sub="Runners, hats, trails, boards and upgrades" onBack={onBack} right={<Pill><CoinIcon size={18} />{coins.toLocaleString("en-US")}</Pill>} /></div>
      <div className="relative z-10 flex gap-2 overflow-x-auto px-4 pb-2">
        {TABS.map(([id, l]) => <button key={id} type="button" onClick={() => { ui(); setTab(id); }} className={`shrink-0 rounded-full border-[3px] border-[#2B1D52] px-3.5 py-1.5 font-display text-[15px] ${tab === id ? "bg-[#FFC23D] text-[#5A3A00]" : "bg-white/90"}`}>{l}</button>)}
      </div>
      <div className="relative z-10 flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto grid max-w-xl grid-cols-3 gap-2.5 sm:grid-cols-4">
          {tab === "chars" && CHARS.map((c) => tile(`char:${c.id}`, s.look.char === c.id, c.price === 0 || s.owned.includes(`char:${c.id}`), c.price, CHAR_ICON[c.id], c.name, () => buyUse(`char:${c.id}`, c.price, () => s.setLook({ char: c.id }))))}
          {tab === "hats" && HATS.map((h) => tile(`hat:${h.id}`, s.look.hat === h.id, h.price === 0 || s.owned.includes(`hat:${h.id}`), h.price, h.icon, h.name, () => buyUse(`hat:${h.id}`, h.price, () => s.setLook({ hat: h.id }))))}
          {tab === "trails" && TRAIL_ITEMS.map((t) => tile(`trail:${t.id}`, s.look.trail === t.id, t.price === 0 || s.owned.includes(`trail:${t.id}`), t.price, t.icon, t.name, () => buyUse(`trail:${t.id}`, t.price, () => s.setLook({ trail: t.id }))))}
          {tab === "boards" && (
            <>
              <button type="button" onClick={() => { if (s.buyBoards(3, 150)) ui("a:levelup"); else fail("buyboards"); }}
                className={`col-span-3 flex items-center justify-between rounded-[20px] border-[3px] border-[#2B1D52] bg-[#FFF4DC] px-4 py-3 text-left sm:col-span-4 ${shake === "buyboards" ? "md-shake" : ""}`}>
                <span><span className="block font-display text-lg">🛹 Get 3 Jelly Boards</span><span className="text-[13px] font-bold text-[#2B1D52]/60">You have {s.boards}. Double-tap in a run to ride one — it saves you once.</span></span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FFC93C] py-0.5 pr-2.5 pl-1 font-display text-[#5A3A00]"><CoinIcon size={16} />150</span>
              </button>
              {BOARD_ITEMS.map((b) => tile(`board:${b.id}`, s.look.board === b.id, b.price === 0 || s.owned.includes(`board:${b.id}`), b.price, <span className="inline-block h-5 w-12 rounded-full border-2 border-[#2B1D52]" style={{ background: BOARDS[b.id] }} />, b.name, () => buyUse(`board:${b.id}`, b.price, () => s.setLook({ board: b.id }))))}
            </>
          )}
          {tab === "ups" && (Object.keys(POWERS) as PowerId[]).map((p) => {
            const lv = s.up[p] ?? 0, price = UP_PRICE[lv] ?? 0;
            return (
              <button key={p} type="button" disabled={lv >= 5} onClick={() => { if (s.upgrade(p, price)) ui("a:levelup"); else fail(`up:${p}`); }}
                className={`col-span-3 flex items-center gap-3 rounded-[20px] border-[3px] border-[#2B1D52] bg-white/95 px-3 py-2.5 text-left sm:col-span-2 ${shake === `up:${p}` ? "md-shake" : ""}`}>
                <span className="text-3xl">{POWERS[p].icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[16px]">{POWERS[p].name}</span>
                  <span className="mt-1 flex gap-1">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < lv ? "bg-[#FF8A3D]" : "bg-[#EEE9FF]"}`} />)}</span>
                  <span className="text-[12px] font-bold text-[#2B1D52]/55">Lasts {Math.round(POWERS[p].time * (1 + 0.2 * lv))} s</span>
                </span>
                {lv >= 5 ? <span className="font-display text-[13px] text-[#2FCB8B]">MAX</span> : <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FFC93C] py-0.5 pr-2 pl-0.5 font-display text-[13px] text-[#5A3A00]"><CoinIcon size={14} />{price}</span>}
              </button>
            );
          })}
        </div>
        <p className="mx-auto mt-4 max-w-xl px-2 text-center text-[13px] font-bold text-white/80">Coins come from every MOMOBLOBS game. In Momo Dash: coins on the run, missions and the Daily Dash.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ settings
function SettingsScreen({ onBack }: { onBack: () => void }) {
  const s = useDash();
  const [confirm, setConfirm] = useState(false);
  const seg = <T extends string>(val: T, opts: [T, string][], set: (v: T) => void) => (
    <div className="grid gap-1.5 rounded-2xl bg-[#EEE9FF] p-1.5" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }}>
      {opts.map(([v, l]) => (
        <button key={v} type="button" onClick={() => { ui(); set(v); }} className={`min-h-11 rounded-xl px-2 font-display text-[15px] ${val === v ? "bg-[#FF8A3D] text-white shadow-[0_3px_0_#A8361E]" : "text-[#2B1D52]/70"}`}>{l}</button>
      ))}
    </div>
  );
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop w={0} />
      <div className="relative z-10"><TopBar title="Settings" onBack={onBack} /></div>
      <div className="relative z-10 flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto flex max-w-md flex-col gap-4 rounded-[26px] border-[3px] border-[#2B1D52] bg-white/95 p-4 shadow-[0_6px_0_rgba(20,10,50,0.3)]">
          <Field label="Graphics" hint="Lower it if the game feels slow. High adds the glow.">
            {seg(s.settings.quality, [["auto", "Auto"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]], (v) => s.setSettings({ quality: v }))}
          </Field>
          <Field label="Vibration">{seg(s.settings.vibrate ? "on" : "off", [["on", "On"], ["off", "Off"]], (v) => s.setSettings({ vibrate: v === "on" }))}</Field>
          <Field label="How to play" hint="Swipe left / right to change lanes, up to jump, down to squish under bars (in the air it drops you fast). Double-tap to ride a Jelly Board. Keyboard: arrows or WASD, B for the board." />
          <Field label="Your runs" hint={`${s.runs} runs · ${Math.round(s.distance / 1000).toLocaleString("en-US")} km · best ${s.best.distance.toLocaleString("en-US")} m · ${s.tricks.toLocaleString("en-US")} tricks`}>
            {confirm ? (
              <div className="grid grid-cols-2 gap-2"><Btn tone="berry" onClick={() => { s.reset(); setConfirm(false); }}>Yes, reset</Btn><Btn tone="white" onClick={() => setConfirm(false)}>Keep it</Btn></div>
            ) : <Btn tone="white" onClick={() => setConfirm(true)} className="w-full">Reset Momo Dash</Btn>}
          </Field>
        </div>
      </div>
    </div>
  );
}
const Field = ({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <div><p className="font-display text-xl">{label}</p>{hint && <p className="text-[13px] font-semibold text-[#2B1D52]/60">{hint}</p>}</div>
    {children}
  </div>
);
void Star;

const APP_CSS = `
.md-root{font-family:var(--font-sans),system-ui;overscroll-behavior:none;touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
.md-root canvas{touch-action:none}
.md-root button{touch-action:manipulation}
.md-logo{-webkit-text-stroke:8px #2B1D52;paint-order:stroke fill;text-shadow:0 8px 0 #2B1D52,0 14px 22px rgba(20,10,50,.45)}
.md-title{-webkit-text-stroke:6px #2B1D52;paint-order:stroke fill}
.md-btn{transform:skewX(-6deg)}.md-btn>span{transform:skewX(6deg)}
.md-run{animation:md-run .7s cubic-bezier(.3,0,.4,1) infinite}
@keyframes md-run{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-9px) rotate(3deg)}}
.md-dot{opacity:.7;filter:blur(1px);animation:md-dot 3s ease-in-out infinite alternate}
@keyframes md-dot{from{opacity:.25;scale:.7}to{opacity:.85;scale:1.15}}
.md-flash{box-shadow:inset 0 0 100px 34px rgba(255,60,90,.55);animation:md-flash .5s ease-out forwards}
@keyframes md-flash{from{opacity:1}to{opacity:0}}
.md-danger{box-shadow:inset 0 0 80px 18px rgba(255,80,60,.35);animation:md-danger .5s ease-in-out infinite alternate}
@keyframes md-danger{from{opacity:.35}to{opacity:1}}
.md-boostfx{box-shadow:inset 0 0 120px 30px rgba(255,194,61,.45);animation:md-danger .25s ease-in-out infinite alternate}
.md-shake{animation:md-shake .35s ease-in-out}
@keyframes md-shake{0%,100%{translate:0}25%{translate:-6px}75%{translate:6px}}
.md-hand-x{animation:md-hx 1.3s ease-in-out infinite}
@keyframes md-hx{0%,100%{transform:translateX(-70px) rotate(-12deg)}50%{transform:translateX(70px) rotate(12deg)}}
.md-hand-up{animation:md-hu 1.1s ease-in-out infinite}
@keyframes md-hu{0%{transform:translateY(40px);opacity:0}30%{opacity:1}100%{transform:translateY(-60px);opacity:0}}
.md-hand-down{animation:md-hd 1.1s ease-in-out infinite}
@keyframes md-hd{0%{transform:translateY(-50px) rotate(180deg);opacity:0}30%{opacity:1}100%{transform:translateY(50px) rotate(180deg);opacity:0}}
.md-tap{animation:md-tp .8s ease-in-out infinite}
@keyframes md-tp{0%,100%{transform:scale(1)}50%{transform:scale(.85) translateY(8px)}}
`;
