"use client";
// React shell for arcade games inside the global GamePlayer: app-style lobby (difficulty sheet),
// HUD (score / level / combo / timer / hearts), host reactions, banners, run results, saving.
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleHelp, Flame, Heart, Play, RotateCcw, Trophy } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { CoinIcon, useAnimatedNumber } from "@/components/brand/CoinPill";
import { toast } from "@/components/ui/Toaster";
import { emptyArcade, TROPHIES, useProfile, type Difficulty } from "@/lib/store";
import { audio } from "@/lib/audio";
import type { Game } from "@/lib/games";
import { spriteUrl, type ArcadeGame, type CastId, type EngineEvents, type HudState } from "./engine";
import type { Settings } from "@/lib/store";

export type GameCtor = new (canvas: HTMLCanvasElement, settings: Settings, ev: EngineEvents) => ArcadeGame;

const MODES: { id: Difficulty; label: string; color: string; dark: string }[] = [
  { id: "easy", label: "Easy", color: "#2FA866", dark: "#1f7a49" },
  { id: "medium", label: "Medium", color: "#F2B544", dark: "#c98b1a" },
  { id: "hard", label: "Hard", color: "#E8504F", dark: "#b8383b" },
];
const TONE: Record<string, string> = { gold: "#FFD25A", mint: "#7CF2C9", pink: "#FF6F91", navy: "#FFF4E2", red: "#FF6F91" };

export function ArcadeHost({ game, Ctor, host }: { game: Game; Ctor: GameCtor; host: CastId }) {
  const player = usePlayer();
  const canvas = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const inst = useRef<ArcadeGame | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const stats = useProfile((s) => s.arcade?.[game.slug]) ?? emptyArcade();
  const [mode, setMode] = useState<Difficulty>(stats.lastDifficulty ?? "easy");
  const [hiddenBanner, setHiddenBanner] = useState(0);
  const [hiddenBubble, setHiddenBubble] = useState(0);
  const statsRef = useRef(stats);
  const playerRef = useRef(player);
  useEffect(() => { statsRef.current = stats; playerRef.current = player; });

  // ---------- create the game once
  useEffect(() => {
    if (!canvas.current) return;
    const g = new Ctor(canvas.current, playerRef.current.settings, {
      onHud: (s) => setHud(s),
      onProgress: (p) => playerRef.current.setLoading(p < 1 ? p : null, p < 1 ? "Squishing the clay…" : ""),
      onFps: (f) => playerRef.current.reportFps(f),
      onClear: ({ difficulty, level, score, coins }) => {
        const fresh = useProfile.getState().arcadeClear(game.slug, difficulty, level, score, coins);
        fresh.forEach((id) => { const t = TROPHIES.find((x) => x.id === id); if (t) toast({ title: `Trophy: ${t.title}`, body: t.desc, icon: t.icon, tone: "gold" }); });
      },
      onRunOver: ({ difficulty, level, score, coins }) => {
        useProfile.getState().arcadeClear(game.slug, difficulty, level, score, coins, true);
      },
    });
    inst.current = g;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __arcade: ArcadeGame }).__arcade = g;
    g.init().then(() => playerRef.current.setLoading(null)).catch((e) => { console.error(e); playerRef.current.setLoading(0, "Could not start the game."); });
    return () => { g.destroy(); inst.current = null; };
  }, [Ctor, game.slug]);

  useEffect(() => { inst.current?.updateSettings(player.settings); }, [player.settings]);
  useEffect(() => { if (player.paused) inst.current?.pause(); else inst.current?.resume(); }, [player.paused]);
  useEffect(() => { player.setInRound(hud?.status === "playing"); }, [hud?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- keep the play area below the HUD
  useEffect(() => {
    const measure = () => {
      const g = inst.current, el = hudRef.current;
      if (!g || !el) return;
      const top = el.offsetTop + el.offsetHeight + 6;
      let probe = document.getElementById("safe-probe");
      if (!probe) {
        probe = document.createElement("div"); probe.id = "safe-probe";
        probe.style.cssText = "position:fixed;left:0;bottom:0;width:1px;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none";
        document.body.appendChild(probe);
      }
      g.setInsets(top, 14 + probe.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (hudRef.current) ro.observe(hudRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [hud?.status]);

  // ---------- banners & bubbles auto-hide
  const bannerId = hud?.banner?.id ?? 0, bubbleId = hud?.host.id ?? 0;
  useEffect(() => {
    if (!bannerId) return;
    const t = setTimeout(() => setHiddenBanner(bannerId), 1500);
    return () => clearTimeout(t);
  }, [bannerId]);
  useEffect(() => {
    if (!bubbleId) return;
    const t = setTimeout(() => setHiddenBubble(bubbleId), 2200);
    return () => clearTimeout(t);
  }, [bubbleId]);
  const banner = hud?.banner && hud.banner.id !== hiddenBanner ? hud.banner : null;
  const bubble = hud?.host.line && hud.host.id !== hiddenBubble ? { id: hud.host.id, line: hud.host.line } : null;

  const start = useCallback((d: Difficulty, fromOne = false) => {
    audio.ensure(); void audio.resume();
    const st = statsRef.current;
    setMode(d);
    useProfile.getState().arcadeTouch(game.slug, d);
    inst.current?.start(d, fromOne ? 1 : st.level[d], st.best[d]);
  }, [game.slug]);

  // ---------- pause menu actions
  useEffect(() => {
    player.setMenu([
      { id: "restart", label: "Restart", icon: "🔄", onSelect: () => { const h = inst.current?.hud; if (h) start(h.difficulty); } },
      { id: "mode", label: "Change mode", icon: "🎚️", onSelect: () => inst.current?.toLobby() },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  // ---------- keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea")) return;
      const h = inst.current?.hud;
      if (!h) return;
      if (h.status === "lobby" && e.key === "Enter") { start(mode); return; }
      if (h.status === "over" && e.key === "Enter") { start(h.difficulty); return; }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
      inst.current?.key(e.key);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [mode, start]);

  // ---------- play time
  useEffect(() => {
    const t = setInterval(() => {
      const h = inst.current?.hud;
      if (h?.status === "playing" && !player.paused && !document.hidden) useProfile.getState().arcadeTouch(game.slug, h.difficulty, 15);
    }, 15000);
    return () => clearInterval(t);
  }, [player.paused, game.slug]);

  const shownScore = useAnimatedNumber(hud?.score ?? 0);
  const h = hud;
  const playing = h?.status === "playing" || h?.status === "over";
  const hostImg = spriteUrl(host, h?.host.mood ?? "happy");

  return (
    <div className="absolute inset-0">
      <canvas ref={canvas} className="absolute inset-0 block size-full touch-none" aria-label={`${game.title} game`} />

      {/* HUD */}
      <div ref={hudRef} className="pointer-events-none absolute inset-x-0 z-20 px-3" style={{ top: "calc(var(--safe-top) + 4.1rem)" }}>
        {playing && h && (
          <div className="mx-auto flex max-w-xl items-center gap-2">
            <motion.div key={h.host.id} initial={{ scale: 0.7, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}
              className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-b from-cream to-[#ffd9a8] shadow-[0_3px_0_rgb(10_4_30/0.45)] ring-2 ring-white/60">
              <Image src={hostImg} alt="" width={96} height={96} className="size-11 object-contain" />
            </motion.div>
            <div className="flex min-w-0 flex-1 flex-col items-center rounded-2xl bg-navy/90 px-3 py-1 shadow-[0_3px_0_rgb(10_4_30/0.45)] ring-1 ring-white/20 backdrop-blur-md">
              <span className="text-[10px] font-bold tracking-[0.2em] text-faint uppercase">Score</span>
              <span className="font-display text-2xl leading-none tabular-nums text-sun">{shownScore.toLocaleString()}</span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="rounded-full px-2.5 py-0.5 font-display text-xs text-white shadow-[0_2px_0_rgb(10_4_30/0.5)]" style={{ background: MODES.find((m) => m.id === h.difficulty)?.color }}>LV {h.level}</span>
              {h.lives != null ? (
                <span className="flex gap-0.5">{[0, 1, 2].map((i) => <Heart key={i} className={`size-4 ${i < (h.lives ?? 0) ? "fill-bubble text-bubble" : "text-white/30"}`} />)}</span>
              ) : (
                <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 font-display text-xs ${h.mult > 1 ? "bg-momo text-ink" : "bg-white/10 text-faint"}`}><Flame className="size-3" />×{h.mult}</span>
              )}
            </div>
          </div>
        )}
        {/* fixed-height rows (timer + one message) so the play area never jumps when they change */}
        {playing && (
          <div className={`mx-auto mt-2 h-2.5 max-w-xl overflow-hidden rounded-full ring-1 transition-opacity duration-200 ${h?.timer != null ? "bg-ink/50 ring-white/15 opacity-100" : "opacity-0 ring-transparent"}`}>
            {h?.timer != null && <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${h.timer * 100}%`, background: h.timerColor }} />}
          </div>
        )}
        {playing && (
          <div className="relative mt-1.5 h-9">
            <AnimatePresence>
              {bubble && (
                <motion.div key={`b${bubble.id}`} initial={{ opacity: 0, y: -6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-x-0 top-0 mx-auto w-fit max-w-[80%] rounded-2xl rounded-tl-sm bg-cream px-3 py-1.5 text-center font-display text-sm text-navy shadow-lg">
                  {bubble.line}
                </motion.div>
              )}
              {h?.hint && !bubble && (
                <motion.div key={`h${h.hint}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute inset-x-0 top-0 mx-auto w-fit max-w-[90%] rounded-2xl bg-navy/90 px-4 py-1.5 text-center font-display text-sm leading-tight text-cream shadow-[0_3px_0_rgb(10_4_30/0.45)]">
                  {h.hint}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* banners */}
      <div className="pointer-events-none absolute inset-x-0 top-[34%] z-20 flex justify-center px-4">
        <AnimatePresence mode="wait">
          {banner && playing && (
            <motion.div key={banner.id} initial={{ scale: 0.3, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.7, opacity: 0, y: -24 }}
              transition={{ type: "spring", stiffness: 520, damping: 18 }} className="flex flex-col items-center text-center">
              <p className="text-clay text-[clamp(2.4rem,11vw,4.6rem)] leading-none" style={{ color: TONE[banner.tone] }}>{banner.title}</p>
              {banner.sub && <span className="mt-2 rounded-full bg-navy px-4 py-1 font-display text-lg text-cream shadow-[0_4px_0_rgb(10_4_30/0.45)]">{banner.sub}</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* lobby */}
      <AnimatePresence>
        {h?.status === "lobby" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex flex-col">
            <div className="flex flex-1 flex-col items-center justify-end px-4 pt-[calc(var(--safe-top)+4.5rem)]">
              <motion.div initial={{ y: 30, scale: 0.8 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="relative">
                <div className="absolute -inset-6 -z-10 rounded-full blur-2xl" style={{ background: `radial-gradient(circle, ${game.accent}aa, transparent 70%)` }} />
                <Image src={spriteUrl(host, "happy")} alt="" width={420} height={420} priority className="h-[min(26vh,220px)] w-auto animate-[bob_2s_ease-in-out_infinite] object-contain drop-shadow-[0_20px_30px_rgb(0_0_0/0.5)]" />
              </motion.div>
            </div>
            <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="glass-strong mx-auto w-full max-w-xl rounded-t-[2rem] p-4 pb-[calc(var(--safe-bottom)+1rem)] shadow-[0_-20px_60px_-20px_rgb(0_0_0/0.8)] sm:mb-4 sm:rounded-[2rem]">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25 sm:hidden" />
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-clay text-3xl leading-none text-cream">{game.title}</p>
                  <p className="mt-1 text-sm text-muted">{game.tagline}</p>
                </div>
                <button onClick={() => player.openHelp()} aria-label="How to play" className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10"><CircleHelp className="size-5" /></button>
              </div>
              <div role="radiogroup" aria-label="Difficulty" className="mt-4 grid grid-cols-3 gap-2">
                {MODES.map((m, i) => {
                  const on = mode === m.id;
                  return (
                    <button key={m.id} role="radio" aria-checked={on}
                      onClick={() => { setMode(m.id); audio.ensure(); audio.play("pop", { gain: 0.5, rate: 1 + i * 0.15 }); }}
                      className={`relative min-h-[5.5rem] overflow-hidden rounded-2xl p-2 text-center transition active:scale-95 ${on ? "scale-[1.03] ring-4 ring-sun" : "opacity-75 ring-1 ring-white/15"}`}
                      style={{ background: `linear-gradient(180deg, ${m.color}, ${m.dark})`, boxShadow: "inset 0 -5px 0 rgb(0 0 0 / 0.2)" }}>
                      <span className="block font-display text-xl text-cream" style={{ WebkitTextStroke: "0.12em #23305A", paintOrder: "stroke fill" }}>{m.label}</span>
                      <span className="mt-0.5 block text-[11px] font-bold leading-tight text-white/90">{game.modes.find((x) => x.id === m.id)?.desc ?? ""}</span>
                      <span className="mt-1 inline-block rounded-full bg-ink/30 px-2 py-0.5 text-[11px] font-bold text-white">Lv {stats.level[m.id]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between px-1 text-sm text-muted">
                <span className="flex items-center gap-1"><Trophy className="size-4 text-sun" /> Best {stats.best[mode].toLocaleString()}</span>
                <span className="flex items-center gap-1">Max level {stats.maxLevel[mode]}</span>
              </div>
              <button autoFocus onClick={() => start(mode)} className="btn-clay lg mt-3 w-full">
                <Play className="size-6 fill-current" /> {stats.level[mode] > 1 && game.slug && !game.categories.includes("speed") ? `Continue · Level ${stats.level[mode]}` : "Play"}
              </button>
              {stats.level[mode] > 1 && (
                <button onClick={() => start(mode, true)} className="mt-2 w-full py-1 text-center text-sm font-semibold text-faint">Start again from level 1</button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* run over */}
      <AnimatePresence>
        {h?.status === "over" && h.result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex items-end justify-center bg-ink/55 backdrop-blur-sm sm:items-center">
            <motion.div initial={{ y: 80 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="glass-strong w-full max-w-md rounded-t-[2rem] p-5 pb-[calc(var(--safe-bottom)+1.25rem)] text-center sm:rounded-[2rem]">
              <Image src={spriteUrl(host, h.result.newBest ? "wow" : "sad")} alt="" width={240} height={240} className="mx-auto -mt-16 h-28 w-auto drop-shadow-2xl" />
              <p className="text-clay mt-1 text-4xl text-cream">{h.result.newBest ? "NEW BEST!" : "RUN OVER"}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/8 p-2"><p className="text-xs font-bold text-faint">SCORE</p><p className="font-display text-2xl text-sun">{h.result.score.toLocaleString()}</p></div>
                <div className="rounded-2xl bg-white/8 p-2"><p className="text-xs font-bold text-faint">LEVEL</p><p className="font-display text-2xl">{h.result.level}</p></div>
                <div className="rounded-2xl bg-white/8 p-2"><p className="text-xs font-bold text-faint">COINS</p><p className="flex items-center justify-center gap-1 font-display text-2xl"><CoinIcon size={20} />{h.result.coins}</p></div>
              </div>
              <p className="mt-2 text-sm text-muted">Best: {h.result.best.toLocaleString()}</p>
              <button autoFocus onClick={() => start(h.difficulty, true)} className="btn-clay lg mt-4 w-full"><RotateCcw className="size-5" /> Play again</button>
              <button onClick={() => inst.current?.toLobby()} className="mt-2 w-full py-1 text-sm font-semibold text-faint">Change mode</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
