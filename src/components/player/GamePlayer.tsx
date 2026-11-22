"use client";
// The one player every MOMOBLOBS game runs inside: loading splash, top bar, pause menu,
// settings sheet, fullscreen, auto-pause, wake lock, keyboard + gamepad shortcuts, FPS meter.
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CircleHelp, Expand, House, Pause, Play, Settings as Cog, Shrink, Volume2, VolumeX, X } from "lucide-react";
import { PlayerContext, type MenuAction, type PlayerApi } from "@/components/player/PlayerContext";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { CoinPill } from "@/components/brand/CoinPill";
import { Logo } from "@/components/brand/Logo";
import { useHydrated, useSettings } from "@/lib/store";
import { audio } from "@/lib/audio";
import { soundFamily } from "@/lib/catalog";
import type { Game } from "@/lib/games";
import { preloader, whenIdle } from "@/lib/preload";

const TIPS_COMMON = [
  "Tip: correct answers in a row build a combo — up to ×5 points!",
  "Tip: every level is brand new, so no two games are the same.",
  "Tip: turn on Relaxed Mode in Settings for slower, calmer games.",
  "Tip: coins buy new cup colours in the Rewards shop.",
];

const noop = () => () => {};
type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void>; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

/** embedded = runs in the frame on a game page (the page owns the title, sound and fullscreen buttons); onExit ends it */
export function GamePlayer({ game, children, embedded = false, onExit }: { game: Game; children: React.ReactNode; embedded?: boolean; onExit?: () => void }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const settings = useSettings();
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPausedState] = useState(false);
  const [loading, setLoadingState] = useState<{ p: number; label: string } | null>({ p: 0, label: "Opening the clay box…" });
  /** the game said it's set up (setLoading(null)); the splash still waits for the files its first screen asked for */
  const [engineReady, setEngineReady] = useState(false);
  const [base] = useState(() => ({ asked: preloader.now.asked, loaded: preloader.now.loaded }));
  // the game's menu music and sounds start downloading right away, alongside the game's code
  useEffect(() => { audio.warmFamily(soundFamily(game), "calm"); }, [game]);
  const [panel, setPanel] = useState<null | "settings" | "help">(null);
  const [menu, setMenuState] = useState<MenuAction[]>([]);
  const [fps, setFps] = useState(0);
  const [fs, setFs] = useState(false);
  const fsOk = useSyncExternalStore(
    noop,
    () => Boolean(document.fullscreenEnabled || (document as FsDoc).webkitFullscreenEnabled),
    () => false,
  );
  const [inRound, setInRound] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [tip, setTip] = useState(0);
  const TIPS = useMemo(() => [...game.howTo.map((h) => `Tip: ${h.text}`), ...TIPS_COMMON], [game.howTo]);
  const wake = useRef<WakeLockSentinel | null>(null);

  const setPaused = useCallback((p: boolean) => {
    setPausedState(p);
    if (!p) setPanel(null);
  }, []);

  // ---------- fullscreen
  useEffect(() => {
    const d = document as FsDoc;
    const on = () => setFs(Boolean(document.fullscreenElement || d.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => { document.removeEventListener("fullscreenchange", on); document.removeEventListener("webkitfullscreenchange", on); };
  }, []);
  const goLandscape = useCallback(async () => {
    const d = document as FsDoc;
    try {
      if (!(document.fullscreenElement || d.webkitFullscreenElement)) {
        const el = root.current as FsEl;
        await (el.requestFullscreen?.({ navigationUI: "hide" }) ?? el.webkitRequestFullscreen?.());
      }
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await o?.lock?.("landscape").catch(() => {});
    } catch { /* not supported (e.g. iPhone Safari) — the game still works in any orientation */ }
  }, []);
  const toggleFs = useCallback(async () => {
    const d = document as FsDoc;
    try {
      if (document.fullscreenElement || d.webkitFullscreenElement) await (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      else {
        const el = root.current as FsEl;
        await (el.requestFullscreen?.({ navigationUI: "hide" }) ?? el.webkitRequestFullscreen?.());
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        o?.lock?.("landscape").catch(() => {});
      }
    } catch { /* not allowed */ }
  }, []);

  // ---------- auto-pause when the tab/app is hidden
  useEffect(() => {
    const vis = () => { if (document.hidden && inRound) setPaused(true); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", vis);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("pagehide", vis); };
  }, [inRound, setPaused]);

  // ---------- keep the screen awake while playing
  useEffect(() => {
    const want = inRound && !paused && !document.hidden;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } };
    if (want && nav.wakeLock && !wake.current) nav.wakeLock.request("screen").then((w) => { wake.current = w; }).catch(() => {});
    if (!want && wake.current) { void wake.current.release().catch(() => {}); wake.current = null; }
  }, [inRound, paused]);
  useEffect(() => () => { void wake.current?.release().catch(() => {}); }, []);

  // ---------- keyboard + gamepad shortcuts
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const key = e.key.toLowerCase();
      if (key === "escape") { if (panel) setPanel(null); else if (inRound) setPaused(!paused); }
      else if ((key === "p" || key === " ") && inRound) { e.preventDefault(); setPaused(!paused); }
      else if (key === "m") useSettings.getState().set({ muted: !useSettings.getState().muted });
      else if (key === "f") void toggleFs();
    };
    window.addEventListener("keydown", k);
    let raf = 0, prev = false;
    const poll = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const start = pads.some((p) => p?.buttons[9]?.pressed);
      if (start && !prev && inRound) setPaused(!paused);
      prev = start;
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => { window.removeEventListener("keydown", k); cancelAnimationFrame(raf); };
  }, [paused, inRound, panel, setPaused, toggleFs]);

  // leaving the app / switching tabs pauses the round (music is silenced by the audio engine)
  useEffect(() => {
    const onHide = () => { if (document.hidden && inRound) setPaused(true); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [inRound, setPaused]);

  // safety net: whatever route the player leaves by, the game music stops
  useEffect(() => () => { audio.stopMusic(0.2); window.speechSynthesis?.cancel(); }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setTip((x) => (x + 1) % TIPS.length), 2600);
    return () => clearInterval(t);
  }, [loading, TIPS.length]);

  // ---------- loading: the splash stays up until the game's code is running AND the files its first screen asked
  // for (menu music, button sounds, pictures) are in, so the game opens ready to play. On a very slow line it lets
  // the game in after a few seconds anyway (the rest streams in while the menu is up).
  const loadingOn = loading !== null;
  // background downloads wait while the splash is up, so they don't slow the game's own files down
  useEffect(() => { preloader.holdBackground(loadingOn); }, [loadingOn]);
  useEffect(() => () => preloader.holdBackground(false), []);
  useEffect(() => {
    if (!loadingOn) return;
    const t0 = performance.now();
    let readyAt = 0, quietSince = 0;
    const iv = setInterval(() => {
      const now = performance.now();
      if (!engineReady) {
        const p = 0.45 * (1 - Math.exp(-(now - t0) / 1800)); // the game's code is downloading
        setLoadingState((l) => (l && p > l.p + 0.005 ? { ...l, p } : l));
        return;
      }
      readyAt ||= now;
      const asked = preloader.now.asked - base.asked, done = preloader.now.loaded - base.loaded;
      const frac = asked > 0 ? Math.min(1, done / asked) : 1;
      setLoadingState((l) => (l ? { p: Math.max(l.p, 0.5 + 0.5 * frac), label: frac < 1 ? "Tuning the music…" : "Ready!" } : l));
      if (preloader.pending > 0) quietSince = 0; else quietSince ||= now;
      if ((quietSince && now - quietSince > 160) || now - readyAt > 7000) setLoadingState(null);
    }, 80);
    return () => clearInterval(iv);
  }, [loadingOn, engineReady, base]);

  // ---------- once the game is up: the rest of its sounds and every later level's music load in the background
  const warmed = useRef(false);
  useEffect(() => {
    if (loadingOn || warmed.current) return;
    warmed.current = true;
    whenIdle(() => audio.warmFamily(soundFamily(game)), 2500);
  }, [loadingOn, game]);

  const api: PlayerApi = useMemo(() => ({
    paused,
    setPaused,
    settings,
    setLoading: (p, label) => {
      if (p == null) { setEngineReady(true); return; }
      setEngineReady(false);
      setLoadingState((l) => ({ p: Math.max(p, l?.p ?? 0), label: label ?? "" }));
    },
    reportFps: setFps,
    setMenu: setMenuState,
    setInRound,
    openHelp: () => { setPaused(true); setPanel("help"); },
    immersive,
    setImmersive,
    goLandscape,
  }), [paused, setPaused, settings, immersive, goLandscape]);

  const exit = () => {
    const d = document as FsDoc;
    if (document.fullscreenElement || d.webkitFullscreenElement) void (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
    audio.stopMusic(0.2);
    if (embedded) { onExit?.(); return; }
    if (window.history.length > 1) router.back(); else router.push(`/games/${game.slug}`);
  };

  const iconBtn = "grid size-11 place-items-center rounded-2xl bg-ink/45 text-text ring-1 ring-white/15 backdrop-blur-md transition hover:bg-ink/65 active:scale-90";

  return (
    <PlayerContext.Provider value={api}>
      <div
        ref={root}
        className="fixed inset-0 overflow-hidden bg-[#2a2030] select-none"
        style={{ touchAction: "manipulation", WebkitUserSelect: "none" }}
      >
        {/* the game */}
        <div className="absolute inset-0">{hydrated && children}</div>

        {/* warm vignette + film finish (same idea as the video FinishShader) */}
        {!immersive && <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 100% at 50% 45%, transparent 55%, rgb(20 8 30 / 0.45))" }} />}

        {/* immersive: only a compact pause button */}
        {immersive && !loading && (
          <button onClick={() => setPaused(true)} aria-label="Pause" className="absolute z-30 grid size-11 place-items-center rounded-2xl bg-ink/55 text-cream ring-1 ring-white/25 backdrop-blur-md active:scale-90"
            style={{ top: "calc(var(--safe-top) + 0.5rem)", right: "calc(var(--safe-right, 0px) + 0.6rem)" }}>
            <Pause className="size-5 fill-current" />
          </button>
        )}

        {/* top bar */}
        <div className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start gap-2 p-3 sm:p-4 ${immersive ? "hidden" : ""}`} style={{ paddingTop: "calc(var(--safe-top) + 0.6rem)" }}>
          {!embedded && <button onClick={exit} aria-label="Exit game" className={`${iconBtn} pointer-events-auto`}><ArrowLeft className="size-5" /></button>}
          <div className={`pointer-events-auto hidden items-center gap-2 rounded-2xl bg-ink/45 py-1.5 pr-3 pl-1.5 ring-1 ring-white/15 backdrop-blur-md ${embedded ? "" : "sm:flex"}`}>
            <Image src={game.character} alt="" width={32} height={32} className="size-8 object-contain" />
            <span className="font-display text-lg">{game.title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="pointer-events-auto"><CoinPill href={null} compact /></span>
            <button onClick={() => settings.set({ muted: !settings.muted })} aria-label={settings.muted ? "Unmute" : "Mute"} className={`${iconBtn} pointer-events-auto ${embedded ? "!hidden" : ""}`}>
              {settings.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            {fsOk && !embedded && (
              <button onClick={toggleFs} aria-label={fs ? "Exit fullscreen" : "Fullscreen"} className={`${iconBtn} pointer-events-auto hidden sm:grid`}>
                {fs ? <Shrink className="size-5" /> : <Expand className="size-5" />}
              </button>
            )}
            <button onClick={() => { setPaused(true); }} aria-label="Pause" disabled={!!loading} className={`${iconBtn} pointer-events-auto !bg-sun/90 !text-ink`}>
              <Pause className="size-5 fill-current" />
            </button>
          </div>
        </div>

        {settings.showFps && !loading && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-30 rounded-lg bg-ink/70 px-2 py-1 font-mono text-xs text-lime" style={{ marginBottom: "var(--safe-bottom)" }}>{Math.round(fps)} FPS</div>
        )}

        {/* loading splash */}
        <AnimatePresence>
          {loading && (
            <motion.div exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.45 }} className="absolute inset-0 z-40 grid place-items-center bg-night">
              <div className="sunburst absolute inset-0 animate-[spin-slow_60s_linear_infinite] opacity-60" style={{ transformOrigin: "50% 50%", scale: 2 }} />
              <div className="relative flex w-[min(86vw,420px)] flex-col items-center text-center">
                <Logo size={64} href={null} />
                <Image src="/brand/momo-wave.webp" alt="" width={260} height={193} priority className={`mt-6 animate-[bob_1.2s_ease-in-out_infinite] drop-shadow-2xl ${embedded ? "w-28" : "w-40"}`} />
                <p className="mt-6 font-display text-2xl">{game.title}</p>
                <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
                  <motion.div className="shine h-full rounded-full bg-gradient-to-r from-sun via-momo to-bubble" animate={{ width: `${Math.max(6, loading.p * 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                </div>
                <p className="mt-3 h-5 text-sm font-semibold text-muted">{loading.label}</p>
                <p className="mt-6 min-h-12 text-sm text-faint">{TIPS[tip]}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* pause menu */}
        <AnimatePresence>
          {paused && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-md sm:items-center" onClick={() => !panel && setPaused(false)}>
              <motion.div
                initial={{ y: 60, scale: 0.96 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 60, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={panel === "settings" ? "Settings" : panel === "help" ? "How to play" : "Paused"}
                className="glass-strong relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] p-5 shadow-2xl sm:rounded-[2rem] sm:p-6"
                style={{ paddingBottom: "calc(var(--safe-bottom) + 1.25rem)" }}
              >
                {panel ? (
                  <>
                    <div className="mb-4 flex items-center gap-3">
                      <button onClick={() => setPanel(null)} aria-label="Back" className="grid size-10 place-items-center rounded-full bg-white/10"><ArrowLeft className="size-5" /></button>
                      <p className="font-display text-2xl">{panel === "settings" ? "Settings" : "How to play"}</p>
                      <button onClick={() => setPaused(false)} aria-label="Close" className="ml-auto grid size-10 place-items-center rounded-full bg-white/10"><X className="size-5" /></button>
                    </div>
                    {panel === "settings" ? (
                      <SettingsForm compact fullscreenNote={!fsOk} />
                    ) : (
                      <ol className="grid gap-3">
                        {game.howTo.map((h, i) => (
                          <li key={h.title} className="flex gap-3 rounded-2xl bg-white/6 p-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-momo font-display text-lg text-ink">{i + 1}</span>
                            <span><span className="block font-bold">{h.title}</span><span className="text-sm text-muted">{h.text}</span></span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <Image src={game.slug === "momo-shuffle" ? "/brand/momo-sly.webp" : game.character} alt="" width={200} height={192} className="-mt-2 h-28 w-auto object-contain drop-shadow-xl" />
                    <p className="text-clay text-5xl text-cream">Paused</p>
                    <div className="mt-6 grid w-full gap-3">
                      <button autoFocus onClick={() => setPaused(false)} className="btn-clay lg w-full"><Play className="size-6 fill-current" /> Resume</button>
                      <div className="grid grid-cols-2 gap-3">
                        {menu.map((m) => (
                          <button key={m.id} onClick={() => { setPaused(false); m.onSelect(); }} className="btn-clay grape w-full !text-base">{m.icon} {m.label}</button>
                        ))}
                        <button onClick={() => setPanel("settings")} className="btn-clay ghost w-full !text-base"><Cog className="size-5" /> Settings</button>
                        <button onClick={() => setPanel("help")} className="btn-clay ghost w-full !text-base"><CircleHelp className="size-5" /> How to play</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {embedded
                          ? <button onClick={() => setPanel("settings")} className="btn-clay ghost w-full !text-base"><Cog className="size-5" /> Sound</button>
                          : <Link href="/" onClick={() => audio.stopMusic(0.2)} className="btn-clay ghost w-full !text-base"><House className="size-5" /> Home</Link>}
                        <button onClick={exit} className="btn-clay bubble w-full !text-base"><ArrowLeft className="size-5" /> {embedded ? "Quit game" : "Exit"}</button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PlayerContext.Provider>
  );
}
