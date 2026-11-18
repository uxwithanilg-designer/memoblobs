"use client";
// Kiko's Jungle Quest front-end, Subway style: home (Kiko running toward you through Banana Grove, your best, missions),
// RUN starts at Kiko's Treehouse every time and the places keep coming — no stage numbers, no stage select — region after
// region until the hearts run out. A short comic tells the story the first time. Then the run card, the shop (fur,
// hats, trails, upgrades) and settings. Made for phones: swipe anywhere, big buttons, the Smoothie Rush button, vibration.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, BookOpen, Home, Play, RotateCcw, Settings2, ShoppingBag } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { BOSSES, FINALE, FRUITS, INTRO_TEXT, METER, PIECE_TEXT, POWERS, REGIONS, RIDES, STAGES_PER_REGION, TWIST_TEXT, dailyGoal, dailyKey, dailyRun, newPiece, regionIndex, sectionOf, setWildForest, wildDay } from "../levels";
import { DECOS } from "../models2";
import { TreehouseView } from "../treehouse";
import { WardrobeView } from "../wardrobe";
import { MISSION_DEFS, missionText, type Mission } from "../missions";
import { KIKO_FUR, RIBBONS } from "../models";
import { TRAILS } from "../render";
import { KIKO_CSS, KikoSession, type HudState, type Toast } from "../session";
import { autoQuality, useKiko, useKikoHydrated } from "../save";
import type { PowerId, RunSpec, Section, SimEvent, SimResult } from "../types";

type Screen = "title" | "story" | "game" | "over" | "shop" | "settings" | "treehouse" | "stickers";
interface GameRun { key: number; spec: RunSpec }
interface Over { res: SimResult; reward: number; newBest: boolean; done: Mission[]; levelUp: boolean; daily?: string; streak: number; newStickers: number; finale: boolean }
/** Golden Seeds won so far (one per boss beaten, 15 in all) */
const seedsWon = (met: string[]) => Math.min(15, met.filter((m) => m.startsWith("beat:")).length);
/** Pico's lines when something new shows up */
const PICO_JOKES = ["Ooh, this looks fun!", "I'd fly over it. Oh wait, you can't fly.", "Watch your tail!", "Bananas ahead! I can smell them.", "Don't look down. OK, look down. Wow!", "That looked angry. Was it angry? It was angry."];

const UI_SOUNDS: Sound[] = ["a:click", "a:whooshOut", "a:whooshIn", "a:ding", "a:levelup", "tada", "a:cheer", "a:kiko_coin", "a:kiko_trick", "a:bwomp", "a:kiko_monkey"];
const musicOf = (id: string): MusicName => `a:kiko_${id}_action` as MusicName;
/** the music of the next region after stage n, so it is loaded before Kiko gets there */
const nextMusicAfter = (n: number) => {
  try { const cur = sectionOf(n).music; for (let k = 1; k <= 40; k++) { const m = sectionOf(n + k).music; if (m !== cur) return m; } } catch { /* past the end */ }
  return null;
};
const isAutomation = () => typeof navigator !== "undefined" && Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver);
const isPhone = () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false) && Math.min(window.innerWidth, window.innerHeight) < 600;
const ui = (s: Sound = "a:click", gain = 0.4) => {
  audio.play(s, { gain, duck: false });
  if (useKiko.getState().settings.vibrate && typeof navigator !== "undefined" && navigator.vibrate) { try { navigator.vibrate(8); } catch { /* blocked */ } }
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
const FURS: { id: string; name: string; price: number }[] = [
  { id: "kiko", name: "Kiko", price: 0 }, { id: "golden", name: "Golden Kiko", price: 400 }, { id: "ginger", name: "Ginger", price: 450 },
  { id: "cocoa", name: "Cocoa", price: 500 }, { id: "snow", name: "Snowy", price: 600 }, { id: "night", name: "Midnight", price: 800 },
];
const HATS: { id: string; name: string; icon: string; price: number }[] = [
  { id: "none", name: "No hat", icon: "🚫", price: 0 }, { id: "flower", name: "Flower Crown", icon: "🌼", price: 200 }, { id: "party", name: "Party Hat", icon: "🎉", price: 150 },
  { id: "cowboy", name: "Explorer Hat", icon: "🤠", price: 300 }, { id: "pirate", name: "Pirate Hat", icon: "🏴‍☠️", price: 350 }, { id: "propeller", name: "Propeller Cap", icon: "🌀", price: 450 },
  { id: "wizard", name: "Wizard Hat", icon: "🧙", price: 400 }, { id: "chef", name: "Chef Hat", icon: "👨‍🍳", price: 450 }, { id: "crown", name: "Banana Crown", icon: "👑", price: 900 },
];
const TRAIL_ITEMS: { id: string; name: string; icon: string; price: number }[] = [
  { id: "none", name: "No trail", icon: "🚫", price: 0 }, { id: "leaves", name: "Leaf Trail", icon: "🍃", price: 150 }, { id: "petals", name: "Petal Trail", icon: "🌸", price: 200 },
  { id: "bubbles", name: "Bubble Trail", icon: "🫧", price: 200 }, { id: "fireflies", name: "Firefly Trail", icon: "✨", price: 300 }, { id: "stars", name: "Star Trail", icon: "⭐", price: 300 },
  { id: "rainbow", name: "Rainbow Trail", icon: "🌈", price: 600 },
];
const RUNNERS: { id: string; name: string; icon: string; price: number; text: string }[] = [
  { id: "kiko", name: "Kiko", icon: "🐒", price: 0, text: "The cheeky monkey himself" },
  { id: "momo", name: "Momo", icon: "🟠", price: 1500, text: "Guest runner from MOMOBLOBS!" },
];
const UP_PRICE = [100, 250, 450, 700, 1000];
const STORY: { art: string; text: string; bg: string }[] = [
  { art: "🌳🍎🍌🥭", text: "In the middle of the forest stands the Great Fruit Tree. Every morning it drops fruit for every animal.", bg: "linear-gradient(180deg,#7FD3FF,#BFF0A8)" },
  { art: "🌵😠🌰", text: "One night grumpy Baron Bramble and his Grumpy gang stole the tree's 15 Golden Seeds and hid them all over the forest!", bg: "linear-gradient(180deg,#2A2160,#5A3A8A)" },
  { art: "🐒🥣❓", text: "Kiko wakes up to an empty fruit bowl. No bananas?! That's it — Kiko is going on a quest.", bg: "linear-gradient(180deg,#FFD27A,#FF9A6A)" },
  { art: "🦜🐒🍌", text: "Pico the toucan comes too. \"Run, jump and swing — grab the bananas, dodge the thorns, and win the seeds back!\"", bg: "linear-gradient(180deg,#5FD3A8,#2FB86B)" },
];

/** the finale, told over the running game while Kiko jogs home under the Great Fruit Tree */
const FINALE_STORY: { art: string; text: string }[] = [
  { art: "🐒🌰✨", text: "Kiko plants all 15 Golden Seeds around the Great Fruit Tree…" },
  { art: "🌳🌸✨", text: "The tree wakes up — and BLOOMS!" },
  { art: "🍎🍌🥭🍉", text: "Fruit rains down on the whole forest!" },
  { art: "🌵🍌😊", text: "Even Baron Bramble gets a banana… and smiles for the first time." },
  { art: "🌱🌳🌱", text: "New seeds fall… the Wild Forest grows new places every day!" },
];

// ------------------------------------------------------------------ kit: jungle, chunky, glossy
type Tone = "banana" | "leaf" | "berry" | "night" | "white";
const TONES: Record<Tone, string> = {
  banana: "bg-[linear-gradient(180deg,#FFE26A_0%,#FFC23D_55%,#FF9A1F_100%)] text-[#4A2A08] shadow-[0_6px_0_#A8611E,0_10px_18px_rgba(90,50,10,0.35)] active:shadow-[0_2px_0_#A8611E]",
  leaf: "bg-[linear-gradient(180deg,#9CFF6B_0%,#3FC45A_60%,#2A9E48_100%)] text-white shadow-[0_6px_0_#1E6A34,0_10px_18px_rgba(20,80,40,0.3)] active:shadow-[0_2px_0_#1E6A34]",
  berry: "bg-[linear-gradient(180deg,#FF8FC7_0%,#FF4F9A_60%,#E0307A_100%)] text-white shadow-[0_6px_0_#9A1F55] active:shadow-[0_2px_0_#9A1F55]",
  night: "bg-[linear-gradient(180deg,#2F7A5A_0%,#1E5A42_100%)] text-white shadow-[0_6px_0_#0F3A28] active:shadow-[0_2px_0_#0F3A28]",
  white: "bg-[#FFFBEF] text-[#3A2410] shadow-[0_6px_0_#D9C49A] active:shadow-[0_2px_0_#D9C49A]",
};
function Btn({ tone = "banana", big, className = "", children, onClick, disabled, label }: { tone?: Tone; big?: boolean; className?: string; children: ReactNode; onClick?: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={() => { ui(); onClick?.(); }}
      className={`kq-btn relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[20px] border-[3px] border-[#3A2410] font-display tracking-wide transition-[transform,box-shadow] duration-75 active:translate-y-1 disabled:pointer-events-none disabled:opacity-45 ${big ? "min-h-16 px-7 text-[26px]" : "min-h-12 px-5 text-lg"} ${TONES[tone]} ${className}`}>
      <span className="pointer-events-none absolute inset-x-2 top-1 h-[38%] rounded-full bg-white/30" />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  );
}
const Pill = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border-2 border-white/25 bg-[#1E3A1A]/75 px-3 py-1 font-display text-[16px] text-white shadow-[0_3px_0_rgba(10,30,10,0.35)] backdrop-blur-sm ${className}`}>{children}</span>
);
function TopBar({ title, sub, onBack, right }: { title: string; sub?: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pr-16 pl-4 pb-2" style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)" }}>
      <button type="button" aria-label="Back" onClick={() => { ui("a:whooshOut", 0.3); onBack(); }} className="grid size-12 shrink-0 place-items-center rounded-2xl border-[3px] border-[#3A2410] bg-[#FFFBEF] text-[#3A2410] shadow-[0_4px_0_#D9C49A] active:translate-y-1 active:shadow-none"><ArrowLeft className="size-6" /></button>
      <div className="min-w-0 flex-1">
        <h1 className="kq-title truncate font-display text-[28px] leading-tight text-white">{title}</h1>
        {sub && <p className="truncate text-sm font-bold text-white/80">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
function Backdrop({ r = 0 }: { r?: number }) {
  const R = REGIONS[r] ?? REGIONS[0];
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(180deg,#123A22 0%,${R.accent2} 62%,${R.accent} 135%)` }}>
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} className="kq-leaf absolute text-2xl" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 90}%`, animationDelay: `${-i * 0.8}s`, opacity: 0.5 }}>{["🍃", "🍌", "🌿", "🥭"][i % 4]}</span>
      ))}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(0deg,rgba(20,40,15,0.6),transparent)]" />
    </div>
  );
}

// ------------------------------------------------------------------ the 3D view (game or title attract)
function GameCanvas({ spec, attract, onReady, quality, vibrate, onEnd, onToast, onEvent, onPlace }: {
  spec: RunSpec; attract?: boolean; quality: "low" | "medium" | "high"; vibrate?: boolean;
  onReady?: (s: KikoSession) => void; onEnd?: (r: SimResult, used: string[]) => void; onToast?: (t: Toast) => void; onEvent?: (e: SimEvent) => void; onPlace?: (s: Section, region: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onEnd, onToast, onEvent, onPlace });
  useEffect(() => { cb.current = { onReady, onEnd, onToast, onEvent, onPlace }; });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const st = useKiko.getState();
    const s = new KikoSession(el, spec, {
      quality, attract, vibrate, look: st.look, mult: attract ? 1 : st.level, up: st.up,
      onEnd: (r, used) => cb.current.onEnd?.(r, used), onToast: (t) => cb.current.onToast?.(t), onEvent: (e) => cb.current.onEvent?.(e),
      onPlace: (sec, region) => cb.current.onPlace?.(sec, region),
    });
    cb.current.onReady?.(s);
    return () => s.destroy();
  }, [spec, attract, quality, vibrate]);
  return <div ref={host} className="absolute inset-0" />;
}

// ------------------------------------------------------------------ the app
export default function KikoApp({ title }: { slug: string; title: string }) {
  const ready = useKikoHydrated();
  const s = useKiko();
  const player = usePlayer();
  const { setImmersive, setLoading, setInRound, setMenu } = player;
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<GameRun | null>(null);
  const [over, setOver] = useState<Over | null>(null);
  const [after, setAfter] = useState<"run" | "title">("title");
  const quality = s.settings.quality === "auto" ? autoQuality() : s.settings.quality;

  useEffect(() => { setLoading(null); }, [setLoading]);
  useEffect(() => { void audio.preload(UI_SOUNDS); }, []);
  useEffect(() => { setImmersive(screen !== "title"); setInRound(screen === "game"); }, [screen, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => { if (screen !== "game") void audio.playMusic("a:kiko_grove_calm"); }, [screen]);

  // the title demo: Kiko running through Banana Grove
  const titleSpec = useMemo<RunSpec>(() => ({ seed: 4242, start: 2, demo: true }), []);

  const start = useCallback((daily?: string) => {
    setOver(null);
    const st = useKiko.getState();
    const today = wildDay();
    setWildForest(today, st.wild.filter((w) => w.day < today).map((w) => w.key));
    // the quiet helper: after a few very short runs in a row, the next run starts a little kinder (nothing on screen says so)
    const spec: RunSpec = daily ? dailyRun(daily) : { seed: Math.floor(Math.random() * 1e9), start: 1, help: st.shortRuns >= 3 };
    // dev / QA: ?start=N starts the run at place N
    if (!daily && process.env.NODE_ENV !== "production") { const n = Number(new URLSearchParams(window.location.search).get("start")); if (n > 0) spec.start = n; }
    spec.recent = st.recent;
    setRun((r) => ({ key: (r?.key ?? 0) + 1, spec }));
    setScreen("game");
  }, []);
  const go = useCallback((daily?: string) => {
    void appMode();
    if (!useKiko.getState().storySeen && !daily && !isAutomation()) { setAfter("run"); setScreen("story"); return; }
    start(daily);
  }, [start]);

  const onEnd = useCallback((res: SimResult, used: string[]) => {
    if (!run) return;
    const st = useKiko.getState();
    const out = st.finishRun(res, used, run.spec.daily);
    const reward = Math.round(res.bananas * 0.5) + res.golden * 10 + res.seeds * 100 + out.done.length * 25 + (out.levelUp ? 100 * useKiko.getState().level : 0) + (out.streak > 0 ? 50 + out.streak * 10 : 0) + (out.finale ? 1000 : 0);
    useProfile.getState().earnCoins(reward);
    setOver({ res, reward, newBest: out.newBest, done: out.done, levelUp: out.levelUp, daily: run.spec.daily, streak: out.streak, newStickers: out.newStickers, finale: out.finale });
    setScreen("over");
  }, [run]);

  useEffect(() => {
    if (screen !== "game") return;
    setMenu([
      { id: "restart", label: "Run again", icon: "🔄", onSelect: () => { player.setPaused(false); start(run?.spec.daily); } },
      { id: "home", label: "Home", icon: "🏠", onSelect: () => { player.setPaused(false); setScreen("title"); } },
    ]);
  }, [screen, run, setMenu, start, player]);

  if (!ready) return <div className="absolute inset-0 bg-[#1E5A32]" />;

  return (
    <div className="kq-root absolute inset-0 overflow-hidden text-[#3A2410] select-none" onContextMenu={(e) => e.preventDefault()}>
      <style>{KIKO_CSS + APP_CSS}</style>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={screen === "game" ? `game-${run?.key}` : screen} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="absolute inset-0">
          {screen === "title" && <TitleScreen title={title} spec={titleSpec} quality={quality} onRun={() => go()} onDaily={() => go(dailyKey())} onShop={() => setScreen("shop")} onSettings={() => setScreen("settings")} onStory={() => { setAfter("title"); setScreen("story"); }} onTreehouse={() => setScreen("treehouse")} onStickers={() => setScreen("stickers")} />}
          {screen === "treehouse" && <TreehouseScreen onBack={() => setScreen("title")} />}
          {screen === "stickers" && <StickersScreen onBack={() => setScreen("title")} />}
          {screen === "story" && <StoryScreen onDone={() => { useKiko.getState().setStorySeen(true); if (after === "run") start(); else setScreen("title"); }} />}
          {screen === "game" && run && (
            <GameScreen key={run.key} run={run} quality={quality} vibrate={s.settings.vibrate} best={s.best.score}
              tutorial={!s.tutorialDone && !isAutomation()} onTutorialDone={() => useKiko.getState().setTutorialDone(true)} onEnd={onEnd} />
          )}
          {screen === "over" && over && <OverScreen info={over} onRetry={() => start(over.daily)} onHome={() => setScreen("title")} onShop={() => setScreen("shop")} />}
          {screen === "shop" && <ShopScreen onBack={() => setScreen("title")} />}
          {screen === "settings" && <SettingsScreen onBack={() => setScreen("title")} onStory={() => { setAfter("title"); setScreen("story"); }} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ the story comic
function StoryScreen({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const p = STORY[i];
  useEffect(() => { ui(i === 2 ? "a:kiko_monkey" : "a:whooshIn", 0.35); }, [i]);
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: p.bg, transition: "background .4s" }}>
      <div className="flex justify-start px-4" style={{ paddingTop: "calc(var(--safe-top) + 0.8rem)" }}>
        <button type="button" onClick={() => { ui(); onDone(); }} className="rounded-full border-[3px] border-[#3A2410] bg-white/90 px-4 py-1.5 font-display text-[15px]">Skip ⏭</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, scale: 0.8, rotate: -4 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: "spring", damping: 14, stiffness: 200 }} className="flex flex-col items-center">
            <div className="kq-art text-[clamp(64px,22vw,120px)] leading-none">{p.art}</div>
            <p className="mt-6 max-w-md rounded-[24px] border-[3px] border-[#3A2410] bg-[#FFFBEF] px-5 py-4 font-display text-[clamp(18px,5vw,24px)] leading-snug shadow-[0_6px_0_rgba(40,25,10,0.35)]">{p.text}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-5" style={{ paddingBottom: "calc(var(--safe-bottom) + 1.4rem)" }}>
        <div className="flex gap-2">{STORY.map((_, k) => <span key={k} className={`h-2.5 rounded-full transition-all ${k === i ? "w-8 bg-white" : "w-2.5 bg-white/45"}`} />)}</div>
        <Btn big tone={i === STORY.length - 1 ? "banana" : "leaf"} className="w-full" onClick={() => (i < STORY.length - 1 ? setI(i + 1) : onDone())}>{i < STORY.length - 1 ? "NEXT ▶" : "LET'S GO! 🍌"}</Btn>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ home
function Missions({ list, level, compact }: { list: Mission[]; level: number; compact?: boolean }) {
  return (
    <div className="w-full rounded-[22px] border-[3px] border-[#3A2410] bg-[#FFFBEF]/95 p-3 shadow-[0_5px_0_rgba(40,25,10,0.35)]">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="font-display text-[15px] tracking-wide">🎯 MISSIONS</p>
        <span className="rounded-full bg-[#FFC23D] px-2.5 py-0.5 font-display text-[14px] text-[#4A2A08]">Score ×{level}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {list.map((m) => {
          const done = m.have >= m.goal, f = Math.min(1, m.have / Math.max(1, m.goal));
          return (
            <div key={m.kind} className="flex items-center gap-2">
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[13px] ${done ? "bg-[#3FC45A] text-white" : "bg-[#F2E8CF]"}`}>{done ? "✓" : ""}</span>
              <div className="min-w-0 flex-1">
                <p className={`truncate font-bold ${compact ? "text-[12.5px]" : "text-[13.5px]"} ${done ? "text-[#3A2410]/45 line-through" : ""}`}>{missionText(m)}</p>
                {!done && !MISSION_DEFS[m.kind]?.one && <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[#F2E8CF]"><div className="h-full rounded-full bg-[#FF9A1F]" style={{ width: `${f * 100}%` }} /></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function TitleScreen({ title, spec, quality, onRun, onDaily, onShop, onSettings, onStory, onTreehouse, onStickers }: {
  title: string; spec: RunSpec; quality: "low" | "medium" | "high"; onRun: () => void; onDaily: () => void; onShop: () => void; onSettings: () => void; onStory: () => void; onTreehouse: () => void; onStickers: () => void;
}) {
  const s = useKiko();
  const coins = useProfile((p) => p.coins);
  const today = dailyKey(), dailyDone = s.daily.doneKey === today;
  const dsec = sectionOf(dailyRun(today).start);
  const words = title.replace("'s", "’s").toUpperCase().split(" ");
  return (
    <div className="absolute inset-0 bg-[#1E5A32]">
      <GameCanvas spec={spec} attract quality={quality === "high" ? "medium" : quality} onReady={(ss) => { if (process.env.NODE_ENV !== "production" || isAutomation()) (window as unknown as { __kikoTitle?: KikoSession }).__kikoTitle = ss; }} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,45,20,0.6)_0%,transparent_30%,transparent_42%,rgba(15,40,15,0.82)_100%)]" />
      <div className="absolute inset-x-0 top-0 flex flex-col items-center px-4 text-center" style={{ paddingTop: "calc(var(--safe-top) + 3.4rem)" }}>
        <p className="font-display text-sm tracking-[0.3em] text-[#FFD23F]">MOMOBLOBS</p>
        <h1 className="kq-logo font-display text-[clamp(34px,min(13.5vw,9vh),92px)] leading-[0.86]">
          {words.map((wd, i) => (
            <span key={wd + i} className="block">{wd.split("").map((c, j) => <span key={j} className="kq-run inline-block" style={{ animationDelay: `${(i * 5 + j) * 0.08}s`, color: i === 0 ? "#FFD23F" : i === 1 ? "#9CFF6B" : "#FF9A3D" }}>{c}</span>)}</span>
          ))}
        </h1>
        <div className="mt-2.5 flex flex-wrap justify-center gap-2 [@media(max-height:430px)]:hidden">
          <Pill>🏆 {s.best.score.toLocaleString("en-US")}</Pill>
          <Pill>🏁 {s.best.distance.toLocaleString("en-US")} m</Pill>
          <Pill>🌰 {seedsWon(s.met)}/15</Pill>
          {s.finales > 0 && <Pill>🌳 ×{s.finales}</Pill>}
          <Pill><CoinIcon size={18} />{coins.toLocaleString("en-US")}</Pill>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-3 px-5" style={{ paddingBottom: "calc(var(--safe-bottom) + 1.2rem)" }}>
        <div className="[@media(max-height:640px)]:hidden"><Missions list={s.missions} level={s.level} compact /></div>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
          <Btn big tone="banana" onClick={onRun} className="w-full"><Play className="size-7 fill-current" />RUN!</Btn>
          <Btn big tone="white" onClick={onShop} label="Shop" className="w-14 !px-0"><ShoppingBag style={{ width: 26, height: 26 }} strokeWidth={2.4} /></Btn>
          <Btn big tone="white" onClick={onStory} label="Story" className="w-14 !px-0"><BookOpen style={{ width: 26, height: 26 }} strokeWidth={2.4} /></Btn>
          <Btn big tone="white" onClick={onSettings} label="Settings" className="w-14 !px-0"><Settings2 style={{ width: 26, height: 26 }} strokeWidth={2.4} /></Btn>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Btn tone="leaf" onClick={onTreehouse} className="w-full !min-h-11 !text-[16px]">🏡 Treehouse</Btn>
          <Btn tone="berry" onClick={onStickers} className="w-full !min-h-11 !text-[16px]">📒 Stickers {s.stickers.length + s.met.length}</Btn>
        </div>
        <Btn tone="night" onClick={onDaily} label="Daily Jungle Hunt" className="relative w-full">
          {dailyDone ? "✅" : "📅"} DAILY HUNT · {dsec.emoji} {dsec.place} · {FRUITS[dailyGoal(today).fruit].icon}×{dailyGoal(today).count}
          {s.daily.streak > 0 && <span className="absolute -top-2.5 -right-1 rounded-full bg-[#FFC93C] px-1.5 py-0.5 text-[12px] leading-none text-[#4A2A08]">🔥{s.daily.streak}</span>}
        </Btn>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the run + HUD
interface ToastItem extends Toast { id: number }
const TIPS = [
  { icon: "👆", text: "Swipe LEFT or RIGHT to change lanes", cls: "kq-hand-x" },
  { icon: "👆", text: "Swipe UP to jump", cls: "kq-hand-up" },
  { icon: "👆", text: "Swipe DOWN to slide", cls: "kq-hand-down" },
];
function Hearts({ n, max }: { n: number; max: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border-2 border-white/25 bg-[#1E3A1A]/75 px-2 py-1 shadow-[0_3px_0_rgba(10,30,10,0.35)] backdrop-blur-sm">
      {Array.from({ length: max }, (_, i) => <span key={i} className={`text-[18px] leading-none transition-transform ${i < n ? "kq-heart" : "opacity-35 grayscale"}`}>{i < n ? "❤️" : "🤍"}</span>)}
    </span>
  );
}
function GameScreen({ run, quality, vibrate, best, tutorial, onTutorialDone, onEnd }: {
  run: GameRun; quality: "low" | "medium" | "high"; vibrate: boolean; best: number; tutorial: boolean; onTutorialDone: () => void; onEnd: (r: SimResult, used: string[]) => void;
}) {
  const player = usePlayer();
  const sess = useRef<KikoSession | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [tip, setTip] = useState(tutorial ? 0 : -1);
  const [card, setCard] = useState<Section | null>(() => sectionOf(run.spec.start));
  const [place, setPlace] = useState<Section | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const tid = useRef(0);
  const [finaleI, setFinaleI] = useState(-1);
  const goal = useMemo(() => (run.spec.daily ? dailyGoal(run.spec.daily) : null), [run.spec.daily]);
  const [goalHave, setGoalHave] = useState(0);
  const doneRef = useRef(onTutorialDone);
  const music = useRef("");
  const cb2 = useRef<((t: Toast) => void) | null>(null);
  const seen = useRef(new Set<string>());
  useEffect(() => { doneRef.current = onTutorialDone; });
  const { spec } = run;

  // the region card at the start (and at every new region) with that region's music; a small banner for each new place
  const onPlace = useCallback((sec: Section, region: boolean) => {
    if (sec.finale) {
      // the finale: Kiko is home — the seeds go in and the Great Fruit Tree blooms
      setCard(sec); setTimeout(() => setCard((c) => (c === sec ? null : c)), 2800);
      setTimeout(() => setFinaleI(0), 2600);
      void audio.play("tada", { gain: 0.6, duck: false });
    } else if (region || sec.n === FINALE + 1) { setCard(sec); setTimeout(() => setCard((c) => (c === sec ? null : c)), 2600); }
    else { setPlace(sec); setTimeout(() => setPlace((c) => (c === sec ? null : c)), 2400); }
  }, []);
  useEffect(() => { const t = setTimeout(() => setCard((c) => (c?.n === spec.start ? null : c)), 2600); return () => clearTimeout(t); }, [spec.start]);
  useEffect(() => {
    // the rush, chase and boss tracks can start any moment: have them downloaded from the start
    audio.warmMusic([musicOf("rush"), musicOf("chase"), musicOf("boss")]);
    let ahead = -1;
    const iv = setInterval(() => {
      const s = sess.current;
      if (!s) return;
      const h = s.hud();
      setHud(h);
      if (s.sim.sec.n !== ahead) { ahead = s.sim.sec.n; const m = nextMusicAfter(ahead); if (m) audio.prepareMusic(musicOf(m)); }
      if (goal) {
        const now = s.sim.stats.fruitBy[goal.fruit] ?? 0;
        setGoalHave((was) => {
          if (was < goal.count && now >= goal.count) setTimeout(() => cb2.current?.({ text: "🎯 Daily Jungle Hunt done!", tone: "gold", big: true }), 0);
          return now;
        });
      }
      const want = h.boost > 0 ? "rush" : h.chase ? (s.sim.sec.r < 2 ? "chase" : "boss") : s.sim.sec.music;
      if (want !== music.current) { music.current = want; void audio.playMusic(musicOf(want)); }
      const sec = s.sim.sec, np = newPiece(sec.n);
      const pieceHint = sec.piece !== "none" && !seen.current.has(sec.piece) ? PIECE_TEXT[sec.piece] : undefined;
      const bossLine = h.boss && BOSSES[h.boss] ? `${BOSSES[h.boss].name}: "${BOSSES[h.boss].line}"` : null;
      setHint(h.vine ? null : bossLine && h.pads === 0 ? bossLine : np && INTRO_TEXT[np] ? INTRO_TEXT[np] : pieceHint ? `${pieceHint} ${PICO_JOKES[sec.n % PICO_JOKES.length]}` : null);
    }, 100);
    return () => clearInterval(iv);
  }, [goal]);
  useEffect(() => { const s = sess.current; if (!s) return; if (player.paused) s.pause(); else s.resume(); }, [player.paused]);
  useEffect(() => {
    if (finaleI < 0 || finaleI >= FINALE_STORY.length) return;
    ui(finaleI === 1 ? "a:levelup" : finaleI === 2 ? "a:kiko_salad" : finaleI === 3 ? "a:kiko_monkey" : "a:kiko_trick", 0.45);
    const t = setTimeout(() => setFinaleI((i) => i + 1), 3200);
    return () => clearTimeout(t);
  }, [finaleI]);
  // tutorial: lanes, jump, slide (each waits for the move, or moves on after ~120 m)
  useEffect(() => {
    if (tip < 0) return;
    if (tip >= TIPS.length) { doneRef.current(); return; }
    const z0 = sess.current?.sim.z ?? 0, j0 = sess.current?.sim.stats.jumps ?? 0, s0 = sess.current?.sim.stats.slides ?? 0;
    const iv = setInterval(() => {
      const cur = sess.current;
      if (!cur) return;
      if (tip === 0 && cur.sim.lane !== 0) setTip(1);
      else if (tip === 1 && cur.sim.stats.jumps > j0) setTip(2);
      else if (tip === 2 && cur.sim.stats.slides > s0) setTip(3);
      else if (cur.sim.z - z0 > 120) setTip(tip + 1);
    }, 120);
    return () => clearInterval(iv);
  }, [tip]);

  const onToast = useCallback((t: Toast) => {
    const id = ++tid.current;
    setToasts((l) => [...l.slice(-1), { ...t, id }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 1700);
  }, []);
  useEffect(() => { cb2.current = onToast; }, [onToast]);
  const onReady = useCallback((s: KikoSession) => {
    sess.current = s;
    if (process.env.NODE_ENV !== "production" || isAutomation()) (window as unknown as { __kiko?: KikoSession }).__kiko = s;
  }, []);
  const [flash, setFlash] = useState(0);
  const onEvent = useCallback((e: SimEvent) => {
    if (e.t === "hurt" || e.t === "stumble") setFlash((f) => f + 1);
    if (e.t === "grab") seen.current.add("vines");
    if (e.t === "branch" && e.on) seen.current.add("highroad");
    if (e.t === "bounce") seen.current.add("bounce");
    if (e.t === "raft" && e.on) seen.current.add("raft");
  }, []);

  const h = hud;
  const meterF = h ? Math.min(1, h.meter / METER) : 0;
  return (
    <div className="absolute inset-0 bg-[#123A22]">
      <GameCanvas spec={spec} quality={quality} vibrate={vibrate} onReady={onReady} onEnd={onEnd} onToast={onToast} onEvent={onEvent} onPlace={onPlace} />
      {flash > 0 && <div key={flash} className="kq-hurt pointer-events-none absolute inset-0 z-10" />}
      {h && h.boost > 0 && <div className={`${h.rush ? "kq-rushfx" : "kq-boostfx"} pointer-events-none absolute inset-0 z-10`} />}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-1.5 px-3" style={{ paddingTop: "calc(var(--safe-top) + 0.55rem)" }}>
        <div className="flex items-start justify-between gap-2 pr-14">
          <div className="flex flex-col items-start gap-1.5">
            <Pill className="!text-[22px]"><span className="text-[#FFD23F]">{(h?.score ?? 0).toLocaleString("en-US")}</span>{h && h.mult > 1 && <span className="rounded-full bg-[#FFD23F] px-1.5 text-[13px] text-[#4A2A08]">×{h.mult}</span>}</Pill>
            <Pill>🍌 {h?.bananas ?? 0}{h && h.golden > 0 && <span className="text-[13px] text-[#FFD23F]">· ⭐{h.golden}</span>}</Pill>
            {goal && <Pill className={`!text-[14px] ${goalHave >= goal.count ? "!bg-[#3FC45A]/90" : ""}`}>🎯 {FRUITS[goal.fruit].icon} {Math.min(goalHave, goal.count)}/{goal.count}{goalHave >= goal.count ? " ✓" : ""}</Pill>}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {h && <Hearts n={h.hearts} max={h.maxHearts} />}
            <Pill className="!text-[14px]">🏁 {Math.round(h?.z ?? 0).toLocaleString("en-US")} m</Pill>
            {h && h.score > best && best > 0 && <Pill className="!bg-[#3FC45A]/90 !text-[13px]">NEW BEST!</Pill>}
          </div>
        </div>
        {h && h.boost > 0 && (
          <div className="mx-auto w-[70%] max-w-xs">
            <p className="kq-title text-center font-display text-[22px] text-[#FFD23F]">{h.rush ? "🥤 SMOOTHIE RUSH" : `🌶️ PEPPER ×${h.boost}`}</p>
            <div className="h-3 overflow-hidden rounded-full border-2 border-[#3A2410] bg-white/40"><div className={`h-full rounded-full ${h.rush ? "bg-[linear-gradient(90deg,#FF8FC7,#FFD23F,#7CFFB2)]" : "bg-[linear-gradient(90deg,#FFC23D,#FF5F3D)]"}`} style={{ width: `${(h.boostLeft / h.boostMax) * 100}%` }} /></div>
          </div>
        )}
        <div className="flex flex-col items-start gap-1.5">
          {h?.powers.map((p) => (
            <span key={p.id} className="relative grid size-12 place-items-center rounded-2xl border-[3px] border-[#3A2410] text-2xl" style={{ background: `conic-gradient(${p.color} ${(p.left / p.max) * 360}deg, rgba(30,58,26,0.75) 0deg)` }}>
              <span className="grid size-9 place-items-center rounded-xl bg-[#1E3A1A]">{p.icon}</span>
            </span>
          ))}
          {h && h.chase && <Pill className="!text-[14px]">{BOSSES[h.boss ?? "gatekeeper"]?.icon ?? "🏃"} {BOSSES[h.boss ?? "gatekeeper"]?.name ?? "Grumpy"}: {Math.min(3, h.pads)}/3 pads</Pill>}
          {h && h.ride && (
            <span className="relative grid size-12 place-items-center rounded-2xl border-[3px] border-[#3A2410] text-2xl" style={{ background: `conic-gradient(#FFD23F ${(h.ride.left / h.ride.max) * 360}deg, rgba(30,58,26,0.75) 0deg)` }}>
              <span className="grid size-9 place-items-center rounded-xl bg-[#1E3A1A]">{RIDES[h.ride.id].icon}</span>
            </span>
          )}
        </div>
      </div>

      {/* smoothie meter + the RUSH button */}
      {h && !h.counting && (
        <div className="pointer-events-none absolute left-3 z-20 flex items-end gap-2" style={{ bottom: "calc(var(--safe-bottom) + 0.9rem)" }}>
          <div className="relative h-16 w-11 overflow-hidden rounded-b-[16px] rounded-t-[8px] border-[3px] border-[#3A2410] bg-white/45 shadow-[0_4px_0_rgba(20,10,5,0.35)]">
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,#FF4FA8,#FFA62B,#FFD23F)] transition-[height] duration-300" style={{ height: `${meterF * 100}%` }} />
            <span className="absolute inset-x-0 top-0.5 text-center text-[15px]">🥤</span>
          </div>
          <span className="mb-1 font-display text-[13px] text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">{h.meter}/{METER}</span>
        </div>
      )}
      {h && h.rushReady && !h.counting && (
        <button type="button" onClick={() => { if (sess.current?.rush()) ui("a:kiko_trick", 0.3); }} aria-label="Smoothie Rush"
          className="kq-rushbtn absolute right-3 z-30 grid size-20 place-items-center rounded-full border-[4px] border-[#3A2410] bg-[conic-gradient(#FF4FA8,#FFD23F,#7CFFB2,#5FB8FF,#FF4FA8)] font-display text-[15px] text-white shadow-[0_6px_0_rgba(40,20,5,0.45)]"
          style={{ bottom: "calc(var(--safe-bottom) + 0.9rem)" }}>
          <span className="kq-title leading-none">🥤<br />RUSH!</span>
        </button>
      )}
      {/* the vine prompt */}
      {h && h.vine && <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center" style={{ bottom: "calc(var(--safe-bottom) + 7rem)" }}><span className="kq-tap rounded-full border-[4px] border-[#3A2410] bg-[#9CFF6B] px-6 py-2 font-display text-[30px] text-[#1E4A10] shadow-[0_6px_0_rgba(20,40,10,0.4)]">👆 TAP!</span></div>}

      {/* toasts */}
      <div className="pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-2 px-6" style={{ top: "calc(var(--safe-top) + 10.5rem)" }}>
        <AnimatePresence>
          {!(finaleI >= 0 && finaleI < FINALE_STORY.length) && toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: -10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className={`rounded-full border-[3px] border-[#3A2410] px-4 py-1.5 text-center font-display shadow-[0_4px_0_rgba(40,25,10,0.35)] ${t.big ? "text-xl" : "text-[15px]"} ${t.tone === "gold" ? "bg-[#FFD23F] text-[#4A2A08]" : t.tone === "good" ? "bg-[#9CFF6B] text-[#1E4A10]" : t.tone === "bad" ? "bg-[#FF6B8A] text-white" : "bg-[#FFFBEF] text-[#3A2410]"}`}>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* a small banner for each new place */}
      <AnimatePresence>
        {place && !card && (
          <motion.div key={place.n} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-6" style={{ top: "calc(var(--safe-top) + 6.4rem)" }}>
            <span className="kq-sign flex flex-col items-center rounded-[14px] border-[3px] border-[#3A2410] bg-[#C98A55] px-4 py-1 font-display text-[17px] text-[#FFF4D6] shadow-[0_4px_0_rgba(40,25,10,0.4)]">
              <span>📍 {place.place}</span>
              {place.twist && <span className="text-[13px] text-[#FFE27F]">{TWIST_TEXT[place.twist]}</span>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* the region card */}
      <AnimatePresence>
        {card && (
          <motion.div key={card.n} initial={{ opacity: 0, scale: 0.7, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -20 }} transition={{ type: "spring", damping: 16, stiffness: 240 }}
            className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-6" style={{ bottom: "calc(var(--safe-bottom) + 6rem)" }}>
            <div className="w-full max-w-sm rounded-[24px] border-[3px] border-[#3A2410] bg-[#FFFBEF]/95 px-5 py-3 text-center shadow-[0_6px_0_rgba(40,25,10,0.35)]">
              <p className="font-display text-xs tracking-[0.2em] text-[#FF9A1F]">{card.finale ? "🏆 THE FINALE" : card.n === FINALE + 1 ? "🌱 NEW SEEDS, NEW PLACES" : run.spec.daily && card.n === spec.start ? "📅 DAILY JUNGLE HUNT" : card.n === spec.start ? "GET READY!" : "NEW REGION!"}</p>
              <h2 className="font-display text-[28px] leading-tight">{card.finale ? "🌳 The Great Fruit Tree" : card.n === FINALE + 1 ? "🌱 The Wild Forest" : `${card.emoji} ${card.remix ? card.place : REGIONS[card.r].name}`}</h2>
              <p className="text-[13px] font-bold text-[#3A2410]/65">{card.finale ? "All 15 Golden Seeds come home!" : card.n === FINALE + 1 ? "The tree grows brand-new places every day!" : <>{card.n === spec.start ? `📍 ${card.place} · ` : ""}{card.remix ? `${card.season ? `${card.season[0].toUpperCase()}${card.season.slice(1)} in the ` : ""}Wild Forest — new places every day!` : REGIONS[regionIndex(card.region)].blurb}</>}</p>
              {goal && card.n === spec.start && <p className="mt-1 font-display text-[15px] text-[#FF5F7E]">🎯 Eat {goal.count} {FRUITS[goal.fruit].icon} {FRUITS[goal.fruit].name.toLowerCase()} today!</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {hint && !card && tip < 0 && !h?.vine && (
        <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-5" style={{ bottom: "calc(var(--safe-bottom) + 5.4rem)" }}>
          <div className="kq-pico flex max-w-md items-end gap-1.5">
            <span className="text-[34px] leading-none">🦜</span>
            <p className="rounded-[18px] rounded-bl-[4px] border-[3px] border-[#3A2410] bg-[#FFFBEF] px-3.5 py-1.5 font-display text-[14.5px] leading-snug shadow-[0_4px_0_rgba(40,25,10,0.3)]">{hint}</p>
          </div>
        </div>
      )}
      {h && h.chaser && <div className="kq-chaser pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32" />}
      <AnimatePresence>
        {finaleI >= 0 && finaleI < FINALE_STORY.length && (
          <motion.div key={`fin${finaleI}`} initial={{ opacity: 0, scale: 0.7, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -16 }} transition={{ type: "spring", damping: 14, stiffness: 220 }}
            className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-5" style={{ top: "calc(var(--safe-top) + 11.5rem)" }}>
            <div className="flex max-w-sm flex-col items-center text-center">
              <div className="kq-art text-[64px] leading-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]">{FINALE_STORY[finaleI].art}</div>
              <p className="mt-2 rounded-[22px] border-[3px] border-[#3A2410] bg-[#FFFBEF]/95 px-4 py-2.5 font-display text-[19px] leading-snug shadow-[0_5px_0_rgba(40,25,10,0.35)]">{FINALE_STORY[finaleI].text}</p>
              <div className="mt-2 flex gap-1.5">{FINALE_STORY.map((_, k) => <span key={k} className={`h-2 rounded-full ${k === finaleI ? "w-6 bg-[#FFD23F]" : "w-2 bg-white/60"}`} />)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* tutorial */}
      {tip >= 0 && tip < TIPS.length && !card && (
        <div className="pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-3 px-6" style={{ bottom: "calc(var(--safe-bottom) + 6.5rem)" }}>
          <span className={`text-6xl ${TIPS[tip].cls}`}>{TIPS[tip].icon}</span>
          <p className="rounded-full border-[3px] border-[#3A2410] bg-[#FFFBEF] px-4 py-2 text-center font-display text-lg shadow-[0_4px_0_rgba(40,25,10,0.35)]">{TIPS[tip].text}</p>
        </div>
      )}
    </div>
  );
}

function DailyLine({ info }: { info: Over }) {
  const g = dailyGoal(info.daily!), have = info.res.fruitBy[g.fruit] ?? 0;
  const text = info.streak > 0 ? `📅 Hunt done! 🔥 ${info.streak}-day streak` : have >= g.count ? "📅 Hunt done today" : `📅 ${FRUITS[g.fruit].icon} ${have}/${g.count} — eat ${g.count} to finish today's hunt`;
  return <p className="mt-2 rounded-full bg-[#FF5F7E] px-4 py-1 text-center font-display text-white">{text}</p>;
}

// ------------------------------------------------------------------ the run card
function OverScreen({ info, onRetry, onHome, onShop }: { info: Over; onRetry: () => void; onHome: () => void; onShop: () => void }) {
  const { res } = info;
  const s = useKiko();
  useEffect(() => { if (info.newBest) setTimeout(() => audio.play("tada", { gain: 0.6, duck: false }), 400); }, [info.newBest]);
  const stat = (label: string, value: ReactNode) => (
    <div className="flex flex-col items-center rounded-2xl border-[3px] border-[#3A2410] bg-[#FFFBEF] px-2 py-2 shadow-[0_4px_0_rgba(40,25,10,0.3)]">
      <span className="text-[11px] font-extrabold tracking-wider text-[#3A2410]/55 uppercase">{label}</span>
      <span className="font-display text-[21px] leading-tight">{value}</span>
    </div>
  );
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop r={Math.max(0, res.bestRegion - 1)} />
      <div className="relative z-10 flex flex-1 overflow-y-auto px-5" style={{ paddingTop: "calc(var(--safe-top) + 1rem)", paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}>
        <div className="m-auto flex w-full max-w-sm flex-col items-center">
          <div className="kq-pile text-[56px] leading-none">🍌🐒🍌</div>
          <motion.h1 initial={{ scale: 0.4, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 10, stiffness: 220 }}
            className="kq-logo mt-1 text-center font-display text-[clamp(38px,11vw,56px)] leading-none" style={{ color: info.newBest ? "#9CFF6B" : "#FFD23F" }}>{info.newBest ? "NEW BEST!" : "KIKO FAINTED!"}</motion.h1>
          {!info.newBest && <p className="mt-1 font-display text-white/85">…into a big pile of bananas</p>}
          <p className="mt-2 font-display text-[44px] leading-none text-white drop-shadow-[0_3px_0_rgba(40,25,10,0.8)]">{res.score.toLocaleString("en-US")}</p>
          <p className="font-display text-white/80">Best {Math.max(s.best.score, res.score).toLocaleString("en-US")}</p>
          {info.finale && <p className="mt-2 rounded-full border-[3px] border-[#3A2410] bg-[#9CFF6B] px-4 py-1 text-center font-display text-[17px] text-[#1E4A10]">🌳 You saved the Great Fruit Tree! +1000</p>}
          {info.daily && <DailyLine info={info} />}
          <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
            {stat("Distance", `${res.distance.toLocaleString("en-US")} m`)}
            {stat("Coins", <span className="inline-flex items-center gap-1"><CoinIcon size={20} />+{info.reward}</span>)}
            {stat("Bananas", `🍌 ${res.bananas}`)}
            {stat("Places", `📍 ${res.places}`)}
            {stat("Golden", `⭐ ${res.golden}`)}
            {stat("Seeds", `🌰 ${res.seeds}`)}
            {stat("Rides", `🐘 ${res.rides}`)}
            {stat("Region", `${REGIONS[Math.max(0, res.bestRegion - 1)].emoji} ${res.bestRegion}/15`)}
          </div>
          {info.newStickers > 0 && <p className="mt-3 rounded-full border-[3px] border-[#3A2410] bg-[#FF8FC7] px-4 py-1 text-center font-display text-[15px] text-white">📒 {info.newStickers} new sticker{info.newStickers > 1 ? "s" : ""}!</p>}
          {info.done.length > 0 && <p className="mt-3 rounded-full border-[3px] border-[#3A2410] bg-[#9CFF6B] px-4 py-1 text-center font-display text-[15px] text-[#1E4A10]">🎯 {info.done.length} mission{info.done.length > 1 ? "s" : ""} done!</p>}
          {info.levelUp && <p className="mt-2 rounded-full border-[3px] border-[#3A2410] bg-[#FFC23D] px-4 py-1 text-center font-display text-lg text-[#4A2A08]">⬆️ Score multiplier ×{s.level}!</p>}
          <div className="mt-3 w-full"><Missions list={s.missions} level={s.level} compact /></div>
          <div className="mt-4 flex w-full flex-col gap-3">
            <Btn big tone="banana" onClick={onRetry} className="w-full"><RotateCcw className="size-6" />RUN AGAIN</Btn>
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
type Tab = "runner" | "fur" | "hats" | "ribbons" | "trails" | "ups";
/** the dressing room: the chosen runner turning on a stump, wearing everything picked */
function WardrobePreview() {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<WardrobeView | null>(null);
  const look = useKiko((st) => st.look);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const v = new WardrobeView(el);
    view.current = v;
    v.set(useKiko.getState().look);
    return () => { v.dispose(); view.current = null; };
  }, []);
  useEffect(() => { view.current?.set(look); }, [look]);
  const r = RUNNERS.find((x) => x.id === (look.runner ?? "kiko")) ?? RUNNERS[0];
  return (
    <div className="relative mx-4 mb-2 h-[30vh] max-h-60 min-h-36 shrink-0 overflow-hidden rounded-[24px] border-[3px] border-[#3A2410] bg-[radial-gradient(circle_at_50%_35%,#E6FFF0,#9EDFB0_60%,#5FB878)] shadow-[0_5px_0_rgba(40,25,10,0.3)] [@media(max-height:560px)]:h-[24vh]">
      <div ref={host} className="absolute inset-0" />
      <span className="pointer-events-none absolute top-2 left-3 rounded-full bg-[#FFFBEF]/90 px-3 py-0.5 font-display text-[14px]">{r.icon} {r.name}</span>
      <span className="pointer-events-none absolute right-3 bottom-2 rounded-full bg-[#1E3A1A]/60 px-2.5 py-0.5 text-[11px] font-bold text-white">drag to turn</span>
    </div>
  );
}
function ShopScreen({ onBack }: { onBack: () => void }) {
  const s = useKiko();
  const coins = useProfile((p) => p.coins);
  const [tab, setTab] = useState<Tab>("runner");
  const [shake, setShake] = useState("");
  const fail = (key: string) => { ui("a:bwomp"); setShake(key); setTimeout(() => setShake(""), 400); };
  const tile = (key: string, on: boolean, own: boolean, price: number, icon: ReactNode, name: string, onPick: () => void) => (
    <button key={key} type="button" onClick={onPick}
      className={`flex flex-col items-center gap-1 rounded-[20px] border-[3px] p-2.5 text-center transition active:scale-95 ${on ? "border-[#FF9A1F] bg-[#FFFBEF] shadow-[0_5px_0_rgba(40,25,10,0.2)]" : "border-[#3A2410] bg-[#FFFBEF]/90 shadow-[0_4px_0_rgba(40,25,10,0.18)]"} ${shake === key ? "kq-shake" : ""}`}>
      <span className="text-4xl">{icon}</span>
      <span className="font-display text-[14px] leading-tight">{name}</span>
      {on ? <span className="rounded-full bg-[#3FC45A] px-2 font-display text-[11px] text-white">USING</span>
        : own ? <span className="rounded-full bg-[#F2E8CF] px-2 font-display text-[11px] text-[#3A2410]/70">USE</span>
        : <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FFC93C] py-px pr-2 pl-0.5 font-display text-[12px] text-[#4A2A08]"><CoinIcon size={14} />{price}</span>}
    </button>
  );
  const buyUse = (key: string, price: number, apply: () => void) => {
    const own = price === 0 || s.owned.includes(key);
    if (!own) { if (!s.buy(key, price)) return fail(key); ui("a:levelup"); } else ui("a:ding");
    apply();
  };
  const furDot = (id: string) => { const [fur, face] = KIKO_FUR[id] ?? KIKO_FUR.kiko; return <span className="relative inline-block size-11 rounded-full border-[3px] border-[#3A2410]" style={{ background: fur }}><span className="absolute inset-x-2 bottom-1 top-3 rounded-full" style={{ background: face }} /></span>; };
  const TABS: [Tab, string][] = [["runner", "🏃 Runners"], ["fur", "🐒 Fur"], ["hats", "🎩 Hats"], ["ribbons", "🎀 Bows"], ["trails", "✨ Trails"], ["ups", "⬆️ Power-ups"]];
  const bowDot = (id: string) => { const rb = RIBBONS[id]; return <span className="relative inline-block h-8 w-12">{rb ? <><span className="absolute top-1 left-0 h-6 w-5 rounded-full border-2 border-[#3A2410]" style={{ background: rb.style === "rainbow" ? "conic-gradient(#FF4F5E,#FFD23F,#5FCB4E,#3DA8FF,#9B5DE5,#FF4F5E)" : rb.color }} /><span className="absolute top-1 right-0 h-6 w-5 rounded-full border-2 border-[#3A2410]" style={{ background: rb.style === "rainbow" ? "conic-gradient(#9B5DE5,#3DA8FF,#5FCB4E,#FFD23F,#FF4F5E,#9B5DE5)" : rb.color }} /><span className="absolute top-2.5 left-[18px] size-3 rounded-full border-2 border-[#3A2410] bg-white/80" /></> : <span className="text-3xl">🚫</span>}</span>; };
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop r={0} />
      <div className="relative z-10"><TopBar title="Wardrobe" sub="Runners, fur, hats, bows, trails and upgrades" onBack={onBack} right={<Pill><CoinIcon size={18} />{coins.toLocaleString("en-US")}</Pill>} /></div>
      <div className="relative z-10"><WardrobePreview /></div>
      <div className="no-scrollbar relative z-10 flex shrink-0 gap-2 overflow-x-auto px-4 pb-2">
        {TABS.map(([id, l]) => <button key={id} type="button" onClick={() => { ui(); setTab(id); }} className={`shrink-0 rounded-full border-[3px] border-[#3A2410] px-3.5 py-1.5 font-display text-[15px] ${tab === id ? "bg-[#FFC23D] text-[#4A2A08]" : "bg-[#FFFBEF]/90"}`}>{l}</button>)}
      </div>
      <div className="relative z-10 flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto grid max-w-xl grid-cols-3 gap-2.5 sm:grid-cols-4">
          {tab === "runner" && RUNNERS.map((r) => tile(`runner:${r.id}`, (s.look.runner ?? "kiko") === r.id, r.price === 0 || s.owned.includes(`runner:${r.id}`), r.price, r.icon, r.name, () => buyUse(`runner:${r.id}`, r.price, () => s.setLook({ runner: r.id }))))}
          {tab === "ribbons" && [["none", { name: "No bow", price: 0 }] as const, ...Object.entries(RIBBONS)].map(([id, rb]) => tile(`bow:${id}`, (s.look.ribbon ?? "none") === id, rb.price === 0 || s.owned.includes(`bow:${id}`), rb.price, bowDot(id), rb.name, () => buyUse(`bow:${id}`, rb.price, () => s.setLook({ ribbon: id }))))}
          {tab === "fur" && FURS.map((c) => tile(`fur:${c.id}`, s.look.fur === c.id, c.price === 0 || s.owned.includes(`fur:${c.id}`), c.price, furDot(c.id), c.name, () => buyUse(`fur:${c.id}`, c.price, () => s.setLook({ fur: c.id }))))}
          {tab === "hats" && HATS.map((h) => tile(`hat:${h.id}`, s.look.hat === h.id, h.price === 0 || s.owned.includes(`hat:${h.id}`), h.price, h.icon, h.name, () => buyUse(`hat:${h.id}`, h.price, () => s.setLook({ hat: h.id }))))}
          {tab === "trails" && TRAIL_ITEMS.map((t) => tile(`trail:${t.id}`, s.look.trail === t.id, t.price === 0 || s.owned.includes(`trail:${t.id}`), t.price, t.icon, t.name, () => buyUse(`trail:${t.id}`, t.price, () => s.setLook({ trail: t.id }))))}
          {tab === "ups" && (Object.keys(POWERS) as PowerId[]).map((p) => {
            const lv = s.up[p] ?? 0, price = UP_PRICE[lv] ?? 0;
            return (
              <button key={p} type="button" disabled={lv >= 5} onClick={() => { if (s.upgrade(p, price)) ui("a:levelup"); else fail(`up:${p}`); }}
                className={`col-span-3 flex items-center gap-3 rounded-[20px] border-[3px] border-[#3A2410] bg-[#FFFBEF]/95 px-3 py-2.5 text-left sm:col-span-2 ${shake === `up:${p}` ? "kq-shake" : ""}`}>
                <span className="text-3xl">{POWERS[p].icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[16px]">{POWERS[p].name}</span>
                  <span className="mt-1 flex gap-1">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < lv ? "bg-[#FF9A1F]" : "bg-[#F2E8CF]"}`} />)}</span>
                  <span className="text-[12px] font-bold text-[#3A2410]/55">Lasts {Math.round(POWERS[p].time * (1 + 0.2 * lv))} s</span>
                </span>
                {lv >= 5 ? <span className="font-display text-[13px] text-[#3FC45A]">MAX</span> : <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FFC93C] py-0.5 pr-2 pl-0.5 font-display text-[13px] text-[#4A2A08]"><CoinIcon size={14} />{price}</span>}
              </button>
            );
          })}
        </div>
        <p className="mx-auto mt-4 max-w-xl px-2 text-center text-[13px] font-bold text-white/85">Coins come from every MOMOBLOBS game. In Kiko&apos;s Jungle Quest: bananas, Golden Bananas, Golden Seeds, missions and the Daily Jungle Hunt.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Kiko's Treehouse
function TreehouseScreen({ onBack }: { onBack: () => void }) {
  const s = useKiko();
  const coins = useProfile((p) => p.coins);
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<TreehouseView | null>(null);
  const [shake, setShake] = useState("");
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const v = new TreehouseView(el);
    view.current = v;
    return () => { v.dispose(); view.current = null; };
  }, []);
  useEffect(() => { view.current?.set(s.owned, seedsWon(s.met)); }, [s.owned, s.met]);
  const owned = DECOS.filter((d) => s.owned.includes(`deco:${d.id}`)).length;
  return (
    <div className="absolute inset-0 flex flex-col bg-[linear-gradient(180deg,#7FD3FF_0%,#BFF0A8_70%,#5FB84A_100%)]">
      <div className="relative z-10"><TopBar title="Kiko's Treehouse" sub={`${owned}/${DECOS.length} things · 🌰 ${seedsWon(s.met)}/15 Golden Seeds`} onBack={onBack} right={<Pill><CoinIcon size={18} />{coins.toLocaleString("en-US")}</Pill>} /></div>
      <div ref={host} className="relative min-h-0 flex-1" />
      <div className="relative z-10 max-h-[42%] overflow-y-auto px-4 pt-2" style={{ paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}>
        <div className="mx-auto grid max-w-xl grid-cols-3 gap-2 sm:grid-cols-4">
          {DECOS.map((d) => {
            const own = s.owned.includes(`deco:${d.id}`);
            return (
              <button key={d.id} type="button" disabled={own}
                onClick={() => { if (s.buy(`deco:${d.id}`, d.price)) ui("a:levelup"); else { ui("a:bwomp"); setShake(d.id); setTimeout(() => setShake(""), 400); } }}
                className={`flex flex-col items-center gap-0.5 rounded-[18px] border-[3px] border-[#3A2410] p-2 text-center ${own ? "bg-[#9CFF6B]/80" : "bg-[#FFFBEF]/95"} ${shake === d.id ? "kq-shake" : ""}`}>
                <span className="text-3xl">{d.icon}</span>
                <span className="font-display text-[13px] leading-tight">{d.name}</span>
                {own ? <span className="rounded-full bg-[#3FC45A] px-2 font-display text-[11px] text-white">BUILT</span>
                  : <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FFC93C] py-px pr-2 pl-0.5 font-display text-[12px] text-[#4A2A08]"><CoinIcon size={14} />{d.price}</span>}
              </button>
            );
          })}
        </div>
        <p className="mx-auto mt-3 max-w-xl text-center text-[13px] font-bold text-[#1E4A10]/80">Drag to look around. Every Golden Seed you win glows on the tree.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the sticker album
const FRIEND_STICKERS: { key: string; icon: string; name: string }[] = [
  ...Object.entries(RIDES).map(([id, r]) => ({ key: `ride:${id}`, icon: r.icon, name: r.name })),
  { key: "croc", icon: "🐊", name: "Crocodile" }, { key: "snake", icon: "🐍", name: "Snake" }, { key: "bees", icon: "🐝", name: "Bees" }, { key: "spider", icon: "🕷️", name: "Spider" },
  { key: "chaser:bats", icon: "🦇", name: "Bat Swarm" }, { key: "chaser:stampede", icon: "🦓", name: "Stampede" }, { key: "chaser:avalanche", icon: "❄️", name: "Avalanche" }, { key: "chaser:boulder", icon: "🌑", name: "Giant Boulder" }, { key: "finale", icon: "🌳", name: "Great Fruit Tree" },
  ...Object.entries(BOSSES).map(([id, b]) => ({ key: `beat:${id}`, icon: b.icon, name: b.name })),
];
function StickersScreen({ onBack }: { onBack: () => void }) {
  const s = useKiko();
  const [tab, setTab] = useState<number>(-1);
  const have = new Set(s.stickers), met = new Set(s.met);
  const placesFound = s.stickers.filter((n) => n <= 300).length;
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop r={Math.max(0, tab)} />
      <div className="relative z-10"><TopBar title="Sticker Album" sub={`📍 ${placesFound}/300 places · 🐾 ${FRIEND_STICKERS.filter((f) => met.has(f.key)).length}/${FRIEND_STICKERS.length} friends`} onBack={onBack} /></div>
      <div className="no-scrollbar relative z-10 flex shrink-0 gap-2 overflow-x-auto px-4 pb-2">
        <button type="button" onClick={() => { ui(); setTab(-1); }} className={`shrink-0 rounded-full border-[3px] border-[#3A2410] px-3 py-1.5 font-display text-[14px] ${tab === -1 ? "bg-[#FFC23D] text-[#4A2A08]" : "bg-[#FFFBEF]/90"}`}>🐾 Friends</button>
        {REGIONS.map((r, i) => <button key={r.id} type="button" onClick={() => { ui(); setTab(i); }} className={`shrink-0 rounded-full border-[3px] border-[#3A2410] px-3 py-1.5 font-display text-[14px] ${tab === i ? "bg-[#FFC23D] text-[#4A2A08]" : "bg-[#FFFBEF]/90"}`}>{r.emoji} {r.name}</button>)}
      </div>
      <div className="relative z-10 flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto grid max-w-xl grid-cols-3 gap-2 sm:grid-cols-4">
          {tab === -1 && FRIEND_STICKERS.map((f) => {
            const got = met.has(f.key);
            return (
              <div key={f.key} className={`flex flex-col items-center gap-0.5 rounded-[18px] border-[3px] border-[#3A2410] p-2 text-center ${got ? "kq-sticker bg-[#FFFBEF]" : "bg-[#3A2410]/30"}`}>
                <span className={`text-4xl ${got ? "" : "opacity-30 grayscale"}`}>{got ? f.icon : "❓"}</span>
                <span className={`font-display text-[12px] leading-tight ${got ? "" : "text-white/70"}`}>{got ? f.name : "???"}</span>
              </div>
            );
          })}
          {tab >= 0 && REGIONS[tab].places.map(([name], i) => {
            const n = tab * STAGES_PER_REGION + i + 1, got = have.has(n);
            return (
              <div key={n} className={`flex min-h-24 flex-col items-center justify-center gap-0.5 rounded-[18px] border-[3px] border-[#3A2410] p-2 text-center ${got ? "kq-sticker bg-[#FFFBEF]" : "bg-[#3A2410]/30"}`}>
                <span className={`text-3xl ${got ? "" : "opacity-30 grayscale"}`}>{got ? (i === 19 ? BOSSES[REGIONS[tab].boss]?.icon ?? REGIONS[tab].emoji : REGIONS[tab].emoji) : "❓"}</span>
                <span className={`font-display text-[12px] leading-tight ${got ? "" : "text-white/70"}`}>{got ? name : `Place ${i + 1}`}</span>
              </div>
            );
          })}
        </div>
        <p className="mx-auto mt-4 max-w-xl px-2 text-center text-[13px] font-bold text-white/85">Every place you reach and every animal you meet becomes a sticker. The Daily Jungle Hunt starts somewhere new each day.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ settings
function SettingsScreen({ onBack, onStory }: { onBack: () => void; onStory: () => void }) {
  const s = useKiko();
  const [confirm, setConfirm] = useState(false);
  const seg = <T extends string>(val: T, opts: [T, string][], set: (v: T) => void) => (
    <div className="grid gap-1.5 rounded-2xl bg-[#F2E8CF] p-1.5" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }}>
      {opts.map(([v, l]) => (
        <button key={v} type="button" onClick={() => { ui(); set(v); }} className={`min-h-11 rounded-xl px-2 font-display text-[15px] ${val === v ? "bg-[#3FC45A] text-white shadow-[0_3px_0_#1E6A34]" : "text-[#3A2410]/70"}`}>{l}</button>
      ))}
    </div>
  );
  return (
    <div className="absolute inset-0 flex flex-col">
      <Backdrop r={1} />
      <div className="relative z-10"><TopBar title="Settings" onBack={onBack} /></div>
      <div className="relative z-10 flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}>
        <div className="mx-auto flex max-w-md flex-col gap-4 rounded-[26px] border-[3px] border-[#3A2410] bg-[#FFFBEF]/95 p-4 shadow-[0_6px_0_rgba(40,25,10,0.3)]">
          <Field label="Graphics" hint="Lower it if the game feels slow. High adds the glow.">
            {seg(s.settings.quality, [["auto", "Auto"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]], (v) => s.setSettings({ quality: v }))}
          </Field>
          <Field label="Vibration">{seg(s.settings.vibrate ? "on" : "off", [["on", "On"], ["off", "Off"]], (v) => s.setSettings({ vibrate: v === "on" }))}</Field>
          <Field label="The story"><Btn tone="leaf" onClick={onStory} className="w-full"><BookOpen className="size-5" />Watch the story</Btn></Field>
          <Field label="How to play" hint="Swipe left / right to change lanes, up to jump, down to slide (in the air it drops you fast). TAP to grab a vine when the green ring shows. Fruits fill the smoothie cup — double-tap (or the RUSH button) for a Smoothie Rush. A head-on bump or a fall costs a heart and sends Kiko back to the last banana flag. Keyboard: arrows or WASD, Space to jump or grab, E for the Rush." />
          <Field label="Your runs" hint={`${s.runs} runs · ${Math.round(s.distance / 1000).toLocaleString("en-US")} km · best ${s.best.distance.toLocaleString("en-US")} m · ${s.bananas.toLocaleString("en-US")} bananas · ${s.golden} Golden Bananas · ${s.seeds} Golden Seeds`}>
            {confirm ? (
              <div className="grid grid-cols-2 gap-2"><Btn tone="berry" onClick={() => { s.reset(); setConfirm(false); }}>Yes, reset</Btn><Btn tone="white" onClick={() => setConfirm(false)}>Keep it</Btn></div>
            ) : <Btn tone="white" onClick={() => setConfirm(true)} className="w-full">Reset Kiko&apos;s Jungle Quest</Btn>}
          </Field>
        </div>
      </div>
    </div>
  );
}
const Field = ({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <div><p className="font-display text-xl">{label}</p>{hint && <p className="text-[13px] font-semibold text-[#3A2410]/60">{hint}</p>}</div>
    {children}
  </div>
);
void FRUITS; void TRAILS;

const APP_CSS = `
.kq-root{font-family:var(--font-sans),system-ui;overscroll-behavior:none;touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
.kq-root canvas{touch-action:none}
.kq-root button{touch-action:manipulation}
.kq-logo{-webkit-text-stroke:8px #2A1A08;paint-order:stroke fill;text-shadow:0 8px 0 #2A1A08,0 14px 22px rgba(20,10,0,.45)}
.kq-title{-webkit-text-stroke:6px #2A1A08;paint-order:stroke fill}
.kq-btn{transform:rotate(-1deg)}.kq-btn>span{transform:rotate(1deg)}
.kq-run{animation:kq-run .8s cubic-bezier(.3,0,.4,1) infinite}
@keyframes kq-run{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-9px) rotate(4deg)}}
.kq-leaf{animation:kq-leaf 6s ease-in-out infinite alternate}
@keyframes kq-leaf{from{transform:translateY(-8px) rotate(-14deg)}to{transform:translateY(10px) rotate(16deg)}}
.kq-art{animation:kq-art 2.4s ease-in-out infinite;filter:drop-shadow(0 8px 0 rgba(0,0,0,.18))}
@keyframes kq-art{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.04)}}
.kq-pile{animation:kq-art 1.6s ease-in-out infinite}
.kq-heart{display:inline-block;animation:kq-beat 1.1s ease-in-out infinite}
@keyframes kq-beat{0%,100%{transform:scale(1)}15%{transform:scale(1.18)}30%{transform:scale(1)}}
.kq-hurt{box-shadow:inset 0 0 100px 34px rgba(255,60,90,.55);animation:kq-hurt .5s ease-out forwards}
@keyframes kq-hurt{from{opacity:1}to{opacity:0}}
.kq-boostfx{box-shadow:inset 0 0 120px 30px rgba(255,170,40,.45);animation:kq-glow .25s ease-in-out infinite alternate}
.kq-rushfx{box-shadow:inset 0 0 120px 30px rgba(255,120,200,.45);animation:kq-glow .25s ease-in-out infinite alternate}
@keyframes kq-glow{from{opacity:.35}to{opacity:1}}
.kq-rushbtn{animation:kq-rb .7s ease-in-out infinite}
@keyframes kq-rb{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.1) rotate(6deg)}}
.kq-tap{animation:kq-tp .45s ease-in-out infinite alternate}
@keyframes kq-tp{from{transform:scale(.92)}to{transform:scale(1.1)}}
.kq-sign{transform:rotate(-2deg)}
.kq-pico{animation:kq-pico .5s cubic-bezier(.2,1.5,.4,1)}
@keyframes kq-pico{from{transform:translateY(30px) scale(.8);opacity:0}to{transform:none;opacity:1}}
.kq-chaser{background:linear-gradient(0deg,rgba(255,80,60,.35),transparent);animation:kq-glow .3s ease-in-out infinite alternate}
.kq-sticker{transform:rotate(-1.5deg);box-shadow:0 4px 0 rgba(40,25,10,.25)}
.kq-shake{animation:kq-shake .35s ease-in-out}
@keyframes kq-shake{0%,100%{translate:0}25%{translate:-6px}75%{translate:6px}}
.kq-hand-x{animation:kq-hx 1.3s ease-in-out infinite}
@keyframes kq-hx{0%,100%{transform:translateX(-70px) rotate(-12deg)}50%{transform:translateX(70px) rotate(12deg)}}
.kq-hand-up{animation:kq-hu 1.1s ease-in-out infinite}
@keyframes kq-hu{0%{transform:translateY(40px);opacity:0}30%{opacity:1}100%{transform:translateY(-60px);opacity:0}}
.kq-hand-down{animation:kq-hd 1.1s ease-in-out infinite}
@keyframes kq-hd{0%{transform:translateY(-50px) rotate(180deg);opacity:0}30%{opacity:1}100%{transform:translateY(50px) rotate(180deg);opacity:0}}
`;
