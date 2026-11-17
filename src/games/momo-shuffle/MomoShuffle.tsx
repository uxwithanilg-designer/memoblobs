"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, CircleHelp, Flame, Play, Zap } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { CoinIcon } from "@/components/brand/CoinPill";
import { toast } from "@/components/ui/Toaster";
import { CUP_SKINS, emptyStats, TROPHIES, useProfile, type Difficulty } from "@/lib/store";
import { audio } from "@/lib/audio";
import { DIFF, MomoShuffleGame, TWIST_LABEL, type CupScreen, type HudState } from "./game";

const GAME_ID = "momo-shuffle";
const MODES: { id: Difficulty; label: string; cups: number; color: string; dark: string; blurb: string }[] = [
  { id: "easy", label: "Easy", cups: 3, color: "#2FA866", dark: "#1f7a49", blurb: "3 cups" },
  { id: "medium", label: "Medium", cups: 4, color: "#F2B544", dark: "#c98b1a", blurb: "4 cups" },
  { id: "hard", label: "Hard", cups: 6, color: "#E8504F", dark: "#b8383b", blurb: "6 cups" },
];
const TWIST_ICON: Record<string, string> = { warmup: "🔥", zigzag: "⚡", fakeout: "🃏", spin: "🌀", blackout: "🌙" };

function ClayBanner({ title, sub, color = "#FFD25A", size = "lg" }: { title: string; sub?: React.ReactNode; color?: string; size?: "lg" | "md" }) {
  return (
    <motion.div
      initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      exit={{ scale: 0.6, opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 520, damping: 20 }}
      className="flex flex-col items-center text-center"
    >
      <p className={`text-clay leading-[0.95] ${size === "lg" ? "text-[clamp(2.6rem,9vw,5.2rem)]" : "text-[clamp(2rem,6vw,3.6rem)]"}`} style={{ color }}>{title}</p>
      {sub && <div className="mt-2">{sub}</div>}
    </motion.div>
  );
}

function Pill({ children, tone = "navy" }: { children: React.ReactNode; tone?: "navy" | "red" | "green" }) {
  const bg = tone === "red" ? "bg-tomato" : tone === "green" ? "bg-[#2FA866]" : "bg-navy";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display text-[clamp(0.95rem,2.6vw,1.25rem)] text-cream shadow-[0_4px_0_rgb(10_4_30/0.45)] ${bg}`}>{children}</span>;
}

function CoinBurst({ n, onDone }: { n: number; onDone: () => void }) {
  const [vp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => { const t = setTimeout(onDone, 1700); return () => clearTimeout(t); }, [onDone]);
  const count = Math.min(9, 3 + Math.floor(n / 10));
  const tx = vp.w / 2 - (vp.w < 640 ? 150 : 210), ty = -(vp.h / 2) + 34;
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2 -mt-4 -ml-4"
          initial={{ x: 0, y: 30, scale: 0.4, opacity: 0 }}
          animate={{ x: [0, (i - count / 2) * 34, tx], y: [30, -70 - (i % 3) * 18, ty], scale: [0.4, 1.25, 0.55], opacity: [0, 1, 0.95] }}
          transition={{ duration: 1.1, delay: 0.25 + i * 0.07, ease: "easeInOut", times: [0, 0.35, 1] }}
          onAnimationComplete={() => audio.play("pop", { gain: 0.25, rate: 1.4 + i * 0.05, duck: false })}
        >
          <CoinIcon size={34} />
        </motion.span>
      ))}
    </div>
  );
}

export default function MomoShuffle({ initialMode }: { initialMode?: Difficulty }) {
  const player = usePlayer();
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<MomoShuffleGame | null>(null);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const [hud, setHud] = useState<HudState | null>(null);
  const stats = useProfile((s) => s.games[GAME_ID]) ?? emptyStats();
  const equipped = useProfile((s) => s.equippedCup);
  const cupColor = CUP_SKINS.find((c) => c.id === equipped)?.color ?? "#8E6CE0";
  const [mode, setMode] = useState<Difficulty>(initialMode ?? stats.lastDifficulty ?? "easy");
  const [fly, setFly] = useState<{ id: number; n: number } | null>(null);
  const statsRef = useRef(stats);
  const settingsRef = useRef(player.settings);
  const playerRef = useRef(player);
  useEffect(() => { statsRef.current = stats; settingsRef.current = player.settings; playerRef.current = player; });

  // ---------- create the game once
  useEffect(() => {
    if (!canvas.current) return;
    const g = new MomoShuffleGame(canvas.current, settingsRef.current, {
      onProgress: (p, label) => playerRef.current.setLoading(p < 1 ? p : null, label),
      onHud: (s) => setHud(s),
      onFps: (f) => playerRef.current.reportFps(f),
      onFrame: (cups: CupScreen[]) => {
        cups.forEach((c, i) => {
          const b = btns.current[i];
          if (!b) return;
          const h = Math.max(40, (c.y - c.top) * 1.7);
          const w = Math.max(44, c.r * 2.1);
          b.style.transform = `translate3d(${c.x - w / 2}px, ${c.top - 6}px, 0)`;
          b.style.width = `${w}px`;
          b.style.height = `${h}px`;
          b.style.visibility = c.visible ? "visible" : "hidden";
        });
      },
      onRound: (r) => {
        const fresh = useProfile.getState().recordRound({ game: GAME_ID, difficulty: r.difficulty, correct: r.correct, level: r.level, streak: r.streak, twist: r.twist, coins: r.coins });
        if (r.correct) setFly({ id: Date.now(), n: r.coins });
        for (const id of fresh) {
          const t = TROPHIES.find((x) => x.id === id);
          if (t) { toast({ title: `Trophy: ${t.title}`, body: t.desc, icon: t.icon, tone: "gold" }); audio.play("sting", { gain: 0.6, delay: 0.9 }); }
        }
      },
    });
    game.current = g;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __momo: MomoShuffleGame }).__momo = g;
    const st = statsRef.current;
    g.init({ difficulty: mode, level: st.level[mode], bestStreak: st.bestStreak[mode], cupColor }).catch((e) => {
      console.error(e);
      playerRef.current.setLoading(0, "Could not start 3D. Please update your browser.");
    });
    return () => { g.destroy(); game.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { game.current?.updateSettings(player.settings); }, [player.settings]);
  useEffect(() => { if (player.paused) game.current?.pause(); else game.current?.resume(); }, [player.paused]);
  useEffect(() => { game.current?.setCupColor(cupColor); }, [cupColor]);
  useEffect(() => { player.setInRound(!!hud && hud.phase !== "lobby" && hud.phase !== "loading"); }, [hud?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback((d: Difficulty, fromOne = false) => {
    audio.ensure();
    void audio.resume();
    const st = statsRef.current;
    useProfile.getState().setDifficulty(GAME_ID, d);
    setMode(d);
    game.current?.start(d, fromOne ? 1 : st.level[d], st.bestStreak[d]);
  }, []);

  // pause-menu actions
  useEffect(() => {
    player.setMenu([
      { id: "restart", label: "Restart level", icon: "🔄", onSelect: () => { const h = game.current?.getHud(); if (h && h.phase !== "lobby") start(h.difficulty); } },
      { id: "mode", label: "Change mode", icon: "🎚️", onSelect: () => game.current?.backToLobby() },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  // lobby music once loaded
  useEffect(() => { if (hud?.phase === "lobby") void audio.playMusic("playful"); }, [hud?.phase]);

  // ---------- keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const g = game.current, h = g?.getHud();
      if (!g || !h || player.paused) return;
      if ((e.target as HTMLElement)?.closest?.("input,textarea")) return;
      const n = h.cups;
      if (h.phase === "pick") {
        const d = parseInt(e.key, 10);
        if (d >= 1 && d <= n) { g.pickSlot(d - 1); return; }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); g.setFocus((h.focus + 1 + n) % n); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); g.setFocus(h.focus < 0 ? n - 1 : (h.focus - 1 + n) % n); }
        if (e.key === "Enter" && h.focus >= 0) g.pickSlot(h.focus);
      } else if (h.waitingNext && e.key === "Enter") g.next();
      else if (h.phase === "lobby" && e.key === "Enter") start(mode);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [player.paused, mode, start]);

  // ---------- gamepad (D-pad / stick + A)
  useEffect(() => {
    let raf = 0;
    const prev: Record<string, boolean> = {};
    const edge = (key: string, v: boolean) => { const was = prev[key]; prev[key] = v; return v && !was; };
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const pad = (navigator.getGamepads?.() ?? []).find(Boolean);
      const g = game.current, h = g?.getHud();
      if (!pad || !g || !h || player.paused) return;
      const right = pad.buttons[15]?.pressed || (pad.axes[0] ?? 0) > 0.6;
      const left = pad.buttons[14]?.pressed || (pad.axes[0] ?? 0) < -0.6;
      const a = pad.buttons[0]?.pressed;
      if (h.phase === "pick") {
        if (edge("r", right)) g.setFocus((h.focus + 1) % h.cups);
        if (edge("l", left)) g.setFocus(h.focus <= 0 ? h.cups - 1 : h.focus - 1);
        if (edge("a", a) && h.focus >= 0) g.pickSlot(h.focus);
      } else {
        edge("r", right); edge("l", left);
        if (edge("a", a)) { if (h.waitingNext) g.next(); else if (h.phase === "lobby") start(mode); }
      }
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [player.paused, mode, start]);

  // ---------- play time
  useEffect(() => {
    const t = setInterval(() => {
      const h = game.current?.getHud();
      if (h && h.phase !== "lobby" && !player.paused && !document.hidden) useProfile.getState().addPlayTime(GAME_ID, 15);
    }, 15000);
    return () => clearInterval(t);
  }, [player.paused]);

  const h = hud;
  const big = player.settings.bigButtons;
  const showChips = h?.phase === "pick" && (h.layout === "grid" || !player.settings.showNumbers);

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvas}
        className="absolute inset-0 block size-full"
        onPointerMove={(e) => e.pointerType === "mouse" && game.current?.pointerMove(e.clientX, e.clientY)}
        onPointerUp={(e) => game.current?.pointerUp(e.clientX, e.clientY)}
        aria-label="Momo Shuffle game. Use the cup buttons or number keys to pick a cup."
      />

      {/* blackout */}
      <AnimatePresence>
        {h?.blackout && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.08 }} className="pointer-events-none absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_55%,rgb(8_4_16/0.25),rgb(8_4_16/0.85))]">
            <p className="text-clay text-[clamp(2.4rem,8vw,4.5rem)] text-sun">LIGHTS OFF!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* accessible cup buttons positioned over the 3D cups */}
      <div className="pointer-events-none absolute inset-0" aria-hidden={h?.phase !== "pick"}>
        {Array.from({ length: h?.cups ?? 0 }).map((_, i) => (
          <button
            key={i}
            ref={(el) => { btns.current[i] = el; }}
            onClick={() => game.current?.pickSlot(i)}
            onFocus={() => game.current?.setFocus(i)}
            onPointerEnter={() => game.current?.setFocus(i)}
            onPointerLeave={() => game.current?.setFocus(-1)}
            tabIndex={h?.phase === "pick" ? 0 : -1}
            aria-label={`Cup ${i + 1}`}
            className="absolute top-0 left-0 rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-sun"
            style={{ visibility: "hidden", pointerEvents: h?.phase === "pick" ? "auto" : "none" }}
          >
            {showChips && (
              <span className={`absolute -top-3 left-1/2 grid -translate-x-1/2 place-items-center rounded-xl bg-cream font-display text-navy shadow-[0_4px_0_#23305A] ring-2 ring-navy ${big ? "size-12 text-2xl" : "size-9 text-xl"}`}>{i + 1}</span>
            )}
          </button>
        ))}
      </div>

      {/* in-game HUD */}
      {h && h.phase !== "lobby" && h.phase !== "loading" && (
        <>
          <div className="pointer-events-none absolute inset-x-0 z-20 flex flex-wrap items-center justify-center gap-2 px-3" style={{ top: "calc(var(--safe-top) + 4.4rem)" }}>
            <span className="rounded-full px-3 py-1 font-display text-sm text-white shadow-[0_3px_0_rgb(10_4_30/0.5)]" style={{ background: DIFF[h.difficulty].color }}>{DIFF[h.difficulty].label}</span>
            <span className="rounded-full bg-navy px-3 py-1 font-display text-sm text-sun shadow-[0_3px_0_rgb(10_4_30/0.5)]">LEVEL {h.level}</span>
            {h.streak > 0 && <span className="flex items-center gap-1 rounded-full bg-momo px-3 py-1 font-display text-sm text-ink shadow-[0_3px_0_rgb(10_4_30/0.5)]"><Flame className="size-4" /> {h.streak}</span>}
            {(h.phase === "shuffle" || h.phase === "hide") && h.twist !== "warmup" && (
              <span className="rounded-full bg-white/85 px-3 py-1 font-display text-sm text-navy">{TWIST_ICON[h.twist]} {TWIST_LABEL[h.twist]}</span>
            )}
            {h.phase === "shuffle" && <span className="flex items-center gap-1 rounded-full bg-ink/60 px-3 py-1 font-display text-sm text-text backdrop-blur"><Zap className="size-3.5 text-sun" /> ×{h.speed}</span>}
          </div>

          {/* center banners */}
          <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4" style={{ top: "calc(var(--safe-top) + 7.2rem)" }}>
            <AnimatePresence mode="wait">
              {h.phase === "intro" && (
                <ClayBanner key={`lv${h.level}`} title={`LEVEL ${h.level}`} sub={h.bonus ? <Pill tone="green">⭐ BONUS ROUND · 2× COINS</Pill> : h.twist !== "warmup" ? <Pill>{TWIST_ICON[h.twist]} {TWIST_LABEL[h.twist]}</Pill> : undefined} />
              )}
              {h.phase === "pick" && <ClayBanner key="where" size="md" title="WHERE IS MOMO?" color="#FF8A3D" />}
              {h.phase === "reveal" && h.result?.correct && (
                <ClayBanner key="yes" title="YOU FOUND MOMO!" color="#FFD25A" sub={<Pill tone="green"><CoinIcon size={22} /> +{h.result.coins} coins</Pill>} />
              )}
              {(h.phase === "reveal" || h.phase === "result") && h.result && !h.result.correct && (
                <ClayBanner key="no" size="md" title="OOPS!" color="#FF6F91" sub={<Pill tone="red">Momo was in cup {h.result.answer + 1}</Pill>} />
              )}
              {h.phase === "result" && h.result?.correct && (
                <ClayBanner key="next" size="md" title={h.result.newBest ? "NEW BEST STREAK!" : "GREAT EYES!"} color="#2EC4B6" sub={<Pill tone="green">Next: Level {h.level}</Pill>} />
              )}
            </AnimatePresence>
          </div>

          {/* bottom hint / next */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 1.25rem)" }}>
            <AnimatePresence mode="wait">
              {h.phase === "hide" && <motion.div key="h" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}><Pill>👀 Watch closely…</Pill></motion.div>}
              {h.phase === "shuffle" && <motion.div key="s" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}><Pill>Keep your eyes on Momo&apos;s cup!</Pill></motion.div>}
              {h.phase === "pick" && (
                <motion.div key="p" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
                  <Pill tone="red">👆 Tap the cup! {typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches ? `(or press 1–${h.cups})` : ""}</Pill>
                </motion.div>
              )}
              {h.waitingNext && (
                <motion.button
                  key="n"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => game.current?.next()}
                  className={`btn-clay ${big ? "lg" : ""} pointer-events-auto`}
                >
                  {player.settings.autoContinue && !player.paused && (
                    <svg viewBox="0 0 40 40" className="size-7 -rotate-90" aria-hidden>
                      <circle cx="20" cy="20" r="18" fill="none" stroke="rgb(0 0 0 / 0.2)" strokeWidth="4" />
                      <circle key={h.nextAt} cx="20" cy="20" r="18" fill="none" stroke="#2a0f00" strokeWidth="4" strokeDasharray="113" strokeLinecap="round" style={{ animation: `ring ${player.settings.autoDelay}s linear forwards` }} />
                    </svg>
                  )}
                  Next round <ChevronRight className="size-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* coins flying to the wallet */}
          {fly && <CoinBurst key={fly.id} n={fly.n} onDone={() => setFly(null)} />}
        </>
      )}

      <p className="sr-only" aria-live="polite">
        {h?.phase === "pick" ? "Pick the cup where Momo is hiding." : h?.phase === "shuffle" ? "Kranky is shuffling the cups." : h?.result ? (h.result.correct ? `Correct! You won ${h.result.coins} coins.` : `Oops, Momo was in cup ${h.result.answer + 1}.`) : ""}
      </p>

      {/* lobby */}
      <AnimatePresence>
        {h?.phase === "lobby" && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-3"
            style={{ paddingBottom: "calc(var(--safe-bottom) + 0.9rem)" }}
          >
            <div className="glass-strong w-full max-w-xl rounded-[2rem] p-4 shadow-[0_-20px_60px_-20px_rgb(0_0_0/0.7)] sm:p-5">
              <div className="mb-3 flex items-center gap-3">
                <Image src="/brand/momo-cheer.webp" alt="" width={80} height={58} className="w-14 drop-shadow-lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-2xl leading-none">Momo Shuffle</p>
                  <p className="text-sm text-muted">Pick a mode — levels never end!</p>
                </div>
                <button onClick={() => player.openHelp()} aria-label="How to play" className="grid size-10 place-items-center rounded-full bg-white/10"><CircleHelp className="size-5" /></button>
              </div>
              <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-3 gap-2 sm:gap-3">
                {MODES.map((m) => {
                  const on = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      role="radio"
                      aria-checked={on}
                      onClick={() => { setMode(m.id); audio.ensure(); audio.play("pop", { gain: 0.5, rate: 1 + MODES.indexOf(m) * 0.15 }); }}
                      className={`relative overflow-hidden rounded-2xl p-2.5 text-center transition sm:p-3 ${on ? "scale-[1.03] ring-4 ring-sun" : "opacity-80 ring-1 ring-white/15 hover:opacity-100"}`}
                      style={{ background: `linear-gradient(180deg, ${m.color}, ${m.dark})`, boxShadow: "inset 0 -5px 0 rgb(0 0 0 / 0.2)" }}
                    >
                      <span className="block font-display text-xl text-cream sm:text-2xl" style={{ WebkitTextStroke: "0.12em #23305A", paintOrder: "stroke fill" }}>{m.label}</span>
                      <span className="block text-xs font-bold text-white/90">{m.blurb}</span>
                      <span className="mt-1 inline-block rounded-full bg-ink/30 px-2 py-0.5 text-[11px] font-bold text-white">Lv {stats.level[m.id]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between px-1 text-sm text-muted">
                <span className="flex items-center gap-1"><CoinIcon size={18} /> +{DIFF[mode].coins} per find</span>
                <span className="flex items-center gap-1"><Flame className="size-4 text-momo" /> Best streak {stats.bestStreak[mode]}</span>
              </div>
              <button autoFocus onClick={() => start(mode)} className={`btn-clay mt-3 w-full ${big ? "lg" : "lg"}`}>
                <Play className="size-6 fill-current" /> {stats.level[mode] > 1 ? `Continue · Level ${stats.level[mode]}` : "Play"}
              </button>
              {stats.level[mode] > 1 && (
                <button onClick={() => start(mode, true)} className="mt-2 w-full text-center text-sm font-semibold text-faint hover:text-text">Start again from level 1</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
