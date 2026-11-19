"use client";
// Rollo Rush app shell — phone-first and app-like. The 3D run fills the screen and never stops: there are no stage
// numbers, no cards between stages and nothing to tap; the road just keeps going. A slim HUD sits on top (pearls and
// streak, distance run, armour scales, the boss bar when one turns up) with the boost meter at the bottom, one-time move
// hints, and little toasts for checkpoints. Closing the game carries on from the last lamp.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Play, Sparkles } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { worldOf } from "../data/worlds";
import { outfit } from "../locker";
import { bossesBeaten, dayNumber, MODE, type ModeId, type ModeRun } from "../modes";
import { autoQuality, type Quality } from "../render3d";
import { useRush, useRushHydrated, type ModeOut } from "../save";
import { RushSession, registerDev, type ModeResult, type RushHud } from "../session";
import { DexSheet, LockerSheet, ModeResultCard, ModesSheet, TrialSheet } from "./RushSheets";

const gfx = (q: string | undefined): Quality => (q === "low" || q === "medium" || q === "high" ? q : autoQuality());
const Pearl = ({ size = 18 }: { size?: number }) => <span className="inline-block shrink-0 rounded-full shadow-[0_0_10px_rgba(255,210,122,0.9)]" style={{ width: size, height: size, background: "radial-gradient(circle at 35% 30%, #FFFFFF 0%, #FFE9B0 35%, #FFC24A 75%, #E89A1A 100%)" }} />;
const dist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 100000 ? 2 : 1)} km`);

const HINTS: Record<string, { icon: string; text: string }> = {
  steer: { icon: "👆↔", text: "Drag anywhere to steer" },
  hop: { icon: "👆⬆", text: "Swipe up to hop" },
  curl: { icon: "👆⬇", text: "Swipe down to curl into a ball" },
  double: { icon: "⬆⬆", text: "Swipe up again in the air: double hop!" },
  burst: { icon: "👆", text: "Tap for a Burst when the meter glows" },
  trick: { icon: "↔✨", text: "Flick sideways in the air for a trick" },
  pound: { icon: "👆⬇", text: "Swipe down in the air: ground pound" },
  slide: { icon: "👆⬇", text: "Swipe down while running: slide under bars" },
  drift: { icon: "↪️", text: "Hold your steer through tight turns: drift boost" },
  star: { icon: "🎯", text: "Tap when a target glows: Star Hop" },
  dash: { icon: "👆", text: "Tap in the air: air dash" },
  flick: { icon: "↔", text: "Quick flick sideways: side step" },
  brake: { icon: "✌️", text: "Hold a second finger down to brake" },
  whip: { icon: "👆", text: "Tap near crates and bells: tail whip" },
  guard: { icon: "🛡️", text: "Curl just before a hit to bounce off it" },
  rush: { icon: "🌙", text: "Fill the meter: Moon Rush!" },
  skip: { icon: "💧", text: "At Turbo, skim across water" },
};

const POWER_ICON: Record<string, string> = {
  shield: "🫧", fire: "🔥", water: "💧", thunder: "⚡", shoes: "👟", giant: "⬆️", mini: "⬇️", ghost: "👻", double: "✖️2", cape: "🦸", rocket: "🚀", snowball: "❄️",
  star: "⭐", autohop: "🎯", buddy: "🐣", board: "🏄", skates: "⛸️", bouncy: "🏀", wings: "🪽",
};
const WEAK_TIP: Record<string, string> = { ball: "Swipe ⬇ — ball into its core!", spring: "Hit the spring — up to its core!", hop: "Tap — Star Hop onto its core!", burst: "Tap — Burst into its core!" };
export default function RushApp({ title }: { slug: string; title: string }) {
  const ready = useRushHydrated();
  const player = usePlayer();
  const { setLoading, setImmersive, setInRound, setMenu } = player;
  const stage = useRush((s) => s.stage);
  const medals = useRush((s) => s.medals);
  const pearlsTotal = useRush((s) => s.pearls);
  const run = useRush((s) => s.dist);
  const [screen, setScreen] = useState<"title" | "game">("title");
  const [hud, setHud] = useState<RushHud | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // ---- the story on screen: the cinematic is playing, the subtitle, the title card, Mayamma is here, her last magic
  const [story, setStory] = useState(false);
  const [line, setLine] = useState<{ who: string; text: string; id: number } | null>(null);
  const [titleCard, setTitleCard] = useState(false);
  const [witch, setWitch] = useState(false);
  const [spell, setSpell] = useState<{ name: string; id: number } | null>(null);
  const lineN = useRef(0);
  // ---- modes, the Dex and the Locker
  const [sheet, setSheet] = useState<null | "modes" | "trial" | "dex" | "locker">(null);
  const [inMode, setInMode] = useState<ModeId | null>(null);
  const [modeRes, setModeRes] = useState<{ res: ModeResult; out: ModeOut } | null>(null);
  const lastMode = useRef<{ id: ModeId; n?: number } | null>(null);
  const wear = useRush((s) => s.wear);
  const [toast, setToastState] = useState<{ text: string; id: number } | null>(null);
  const setToast = useCallback((text: string | null) => setToastState(text ? { text, id: ++toastN.current } : null), []);
  const [busy, setBusy] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  const session = useRef<RushSession | null>(null);
  const toastN = useRef(0);
  const settings = useRef(player.settings);
  useEffect(() => { settings.current = player.settings; });

  useEffect(() => { setLoading(null); }, [setLoading]);
  useEffect(() => { void audio.preload(["pop", "whoosh"]); }, []);
  useEffect(() => { setImmersive(screen === "game"); setInRound(screen === "game"); }, [screen, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => { const s = session.current; if (!s) return; if (player.paused) s.pause(); else s.resume(); }, [player.paused]);

  /** load the stage the save says we are on (the saved stage at its last lamp, or a freshly built one) */
  const loadCurrent = useCallback((s: RushSession) => {
    const st = useRush.getState();
    if (st.level && st.level.n === st.stage) { s.load(st.level, st.check, st.checkPearls); setBusy(false); return; }
    setBusy(true);
    void s.stage(st.stage).then((L) => {
      if (session.current !== s) return;
      useRush.getState().setLevel(L);
      s.load(L);
      setBusy(false);
    });
  }, []);

  // the run lives as long as the app
  useEffect(() => {
    if (!ready || !host.current) return;
    const st0 = settings.current, st = useRush.getState();
    const s = new RushSession(host.current, {
      quality: gfx(st0.quality), haptics: st0.haptics, reduced: st0.reducedMotion, salt: st.salt,
      memory: () => useRush.getState().memory(),
      odo: () => useRush.getState().dist,
      lives: () => useRush.getState().lives,
      onHud: setHud,
      onOut: (e) => {
        if (e.t === "check") { useRush.getState().setCheck(e.i, e.pearls); setToast("Checkpoint!"); return; }
        if (e.t === "fell") { setToast("Oops!"); return; }
        if (e.t === "fail") { setToast(e.why.charAt(0).toUpperCase() + e.why.slice(1) + "!"); return; }
        if (e.t === "power") { setToast(`${POWER_ICON[e.p] ?? "✨"} Power up!`); return; }
        if (e.t === "story") { setStory(e.on); if (!e.on) { setLine(null); setTitleCard(false); } return; }
        if (e.t === "line") { const id = ++lineN.current; setLine({ who: e.who, text: e.text, id }); window.setTimeout(() => setLine((l) => (l && l.id === id ? null : l)), Math.max(1400, e.dur * 1000)); return; }
        if (e.t === "title") { setTitleCard(true); window.setTimeout(() => setTitleCard(false), 2400); return; }
        if (e.t === "witch") { setWitch(e.on); return; }
        if (e.t === "magic") { useRush.getState().seeSpell(e.id); setSpell({ name: e.name, id: ++lineN.current }); return; }
        if (e.t === "life") { useRush.getState().useLife(); setToast("❤️ A life saved you!"); return; }
        if (e.t === "heart") { useRush.getState().addLife(); setToast("+1 ❤️"); return; }
        if (e.t === "modeEnd") { const out = useRush.getState().modeEnd(e.res); setModeRes({ res: e.res, out }); return; }
        if (e.t === "hint") { if (!useRush.getState().hints.includes(e.move)) { useRush.getState().seeHint(e.move); setHint(e.move); } return; }
        // the run carries straight on: the stage just run is saved quietly, and so is the one now underfoot
        if (e.t === "done") { useRush.getState().win(e.res); return; }
        if (e.t === "next") useRush.getState().setLevel(e.st);
      },
    });
    session.current = s; registerDev(s);
    s.setTitle(true);
    loadCurrent(s);
    return () => { s.destroy(); session.current = null; };
  }, [ready, loadCurrent, setToast]);

  // a link to one of the modes (the game page’s mode cards: ?mode=daily…) opens the mode list ready to go
  const linked = useRef(false);
  useEffect(() => {
    if (!ready || linked.current) return;
    const m = new URLSearchParams(window.location.search).get("mode");
    if (!m || !(m in MODE)) return;
    // just after the title has faded in
    const t = window.setTimeout(() => { linked.current = true; setSheet(m === "trial" && useRush.getState().stage >= MODE.trial.unlockAt ? "trial" : "modes"); }, 400);
    return () => window.clearTimeout(t);
  }, [ready]);
  // Rollo wears what his Locker says
  useEffect(() => { const s = session.current; if (!s) return; const o = outfit(wear); s.r.setLook(o.look, o.trail, o.ball); }, [wear, ready]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 1400); return () => window.clearTimeout(t); }, [toast, setToast]);
  useEffect(() => { if (!hint) return; const t = window.setTimeout(() => setHint(null), 3600); return () => window.clearTimeout(t); }, [hint]);

  const start = () => {
    audio.ensure(); void audio.resume();
    audio.play("pop", { gain: 0.3, rate: 1.1, duck: false });
    setScreen("game");
    const s = session.current, save = useRush.getState();
    // the very first run opens with the story
    if (s && !save.seenIntro && save.stage <= 1) { save.seeIntro(); s.playStory(); }
    else s?.setTitle(false);
  };
  useEffect(() => { if (!spell) return; const t = window.setTimeout(() => setSpell(null), 1600); return () => window.clearTimeout(t); }, [spell]);
  /** start a mode run (Time Trial: on stage n, against its ghost) */
  const runMode = useCallback((id: ModeId, n?: number) => {
    const s = session.current; if (!s) return;
    const save = useRush.getState();
    audio.ensure(); void audio.resume();
    const m: ModeRun = { id, seed: id === "daily" ? dayNumber() : id === "trial" || id === "boss" ? save.salt : ((Math.random() * 2 ** 30) | 0) + 1, upto: Math.max(1, save.stage - 1), n, bosses: Math.max(1, bossesBeaten(save.stage)) };
    lastMode.current = { id, n };
    setSheet(null); setModeRes(null); setInMode(id); setHud(null); setScreen("game"); setBusy(true);
    void s.startMode(m, id === "trial" && n ? save.trials[n] ?? null : null).then(() => { if (session.current === s) setBusy(false); });
  }, []);
  /** back from a mode to the journey's title screen */
  const exitMode = useCallback(() => {
    const s = session.current; if (!s) return;
    s.endMode(); setInMode(null); setModeRes(null); setHud(null);
    s.setTitle(true); setScreen("title"); loadCurrent(s);
  }, [loadCurrent]);
  useEffect(() => {
    if (screen !== "game") { setMenu([]); return; }
    if (inMode) { setMenu([{ id: "quit", label: "Leave this run", icon: "🏁", onSelect: exitMode }]); return; }
    setMenu([
      { id: "story", label: "Watch the story", icon: "🎬", onSelect: () => session.current?.playStory() },
      { id: "title", label: "Title screen", icon: "🏠", onSelect: () => { session.current?.skipStory(); session.current?.setTitle(true); setScreen("title"); } },
    ]);
  }, [screen, setMenu, inMode, exitMode]);

  const W = worldOf(hud?.world ?? Math.max(1, Math.ceil(stage / 20)));
  const boostOn = hud?.moves.burst;

  return (
    <div className="relative h-full w-full touch-none overflow-hidden bg-[#0B1240] select-none">
      <div ref={host} className="absolute inset-0" />

      {/* ---------------- title */}
      <AnimatePresence>
        {screen === "title" && (
          <motion.div key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between px-5" style={{ paddingTop: "max(28px, env(safe-area-inset-top))", paddingBottom: "max(22px, env(safe-area-inset-bottom))" }}>
            <div className="mt-6 text-center">
              <motion.h1 initial={{ y: -20, scale: 0.9 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }} className="font-display text-6xl leading-none tracking-tight text-white drop-shadow-[0_6px_0_rgba(20,30,90,0.6)] sm:text-7xl">
                <span className="bg-gradient-to-b from-[#FFFFFF] to-[#9FF5DD] bg-clip-text text-transparent">Rollo</span>{" "}
                <span className="bg-gradient-to-b from-[#FFE27A] to-[#FF9F1A] bg-clip-text text-transparent">Rush</span>
              </motion.h1>
              <p className="mt-2 text-sm font-bold tracking-wide text-[#CFE0FF] drop-shadow">Curl up. Light up. Rush on!</p>
            </div>
            <div className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-3">
              <div className="flex gap-2 text-xs font-bold text-white">
                <span className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 backdrop-blur"><Pearl size={14} />{pearlsTotal.toLocaleString()}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 backdrop-blur">🌙 {medals}</span>
                {run > 0 && <span className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 backdrop-blur">🏃 {dist(run)}</span>}
              </div>
              <button onClick={start} disabled={busy} aria-label={`Play ${title}`} className="group relative flex w-full items-center justify-center gap-3 rounded-[1.6rem] bg-gradient-to-b from-[#5CF2C9] to-[#1E9C8A] px-6 py-4 text-white shadow-[0_8px_0_#13665B,0_18px_40px_rgba(0,0,0,0.35)] transition active:translate-y-1.5 active:shadow-[0_3px_0_#13665B] disabled:opacity-70">
                <Play className="size-9 fill-white" />
                <span className="text-left leading-tight">
                  <span className="block font-display text-3xl">{stage > 1 ? "Continue" : "Play"}</span>
                  <span className="block text-sm font-bold opacity-90">{busy ? "Building the track…" : `${W.emoji} ${W.name}`}</span>
                </span>
              </button>
              <div className="grid w-full grid-cols-3 gap-2">
                {([["modes", "🎮", "Modes"], ["dex", "📖", "Dex"], ["locker", "🎽", "Locker"]] as const).map(([id, icon, label]) => (
                  <button key={id} onClick={() => { audio.ensure(); audio.play("pop", { gain: 0.25, rate: 1.2, duck: false }); setSheet(id); }} className="flex flex-col items-center rounded-2xl bg-black/35 py-2 text-white backdrop-blur active:scale-95">
                    <span className="text-xl leading-none">{icon}</span><span className="mt-0.5 text-xs font-bold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- HUD */}
      {/* ---------------- Mayamma is here: a dark red pulse round the edges */}
      <AnimatePresence>
        {witch && screen === "game" && !story && (
          <motion.div key="witch" initial={{ opacity: 0 }} animate={{ opacity: [0.55, 0.85, 0.55] }} exit={{ opacity: 0 }} transition={{ duration: 1.6, repeat: Infinity }} className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(110,10,40,0.55) 100%)" }} />
        )}
      </AnimatePresence>

      {screen === "game" && hud && !story && (
        <div className="pointer-events-none absolute inset-x-0 top-0 px-3" style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}>
          <div className="flex items-start gap-2 pr-12">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 rounded-full bg-black/40 py-1 pr-3 pl-1.5 text-white backdrop-blur">
                <Pearl size={20} /><span className="font-display text-lg leading-none tabular-nums">{hud.pearls}</span>
              </div>
              <div className="flex gap-1">
                <span className="flex items-center gap-0.5 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">❤️ {hud.lives}</span>
                <span className="flex items-center gap-0.5 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-bold text-[#FFE27A] tabular-nums">🪙 {hud.coins}</span>
              </div>
              {hud.target ? <div className={`rounded-full px-2 py-0.5 text-center text-[11px] font-bold ${hud.got >= hud.target ? "bg-[#5CF2C9] text-[#0B3A33]" : "bg-black/40 text-[#FFE27A]"}`}>🚪 {Math.min(hud.got, hud.target)}/{hud.target}</div> : null}
              {hud.streak >= 10 && <div className="rounded-full bg-gradient-to-r from-[#FFB347] to-[#FF5A7A] px-2 text-center text-[11px] font-bold text-white">🔥 ×{hud.streak}</div>}
              {hud.powers.map((p) => <div key={p.k} className="flex items-center gap-1 rounded-full bg-[#1E5A8A]/70 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">{POWER_ICON[p.k] ?? "✨"} {Math.ceil(p.t)}</div>)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              {hud.mode ? (
                <div className="flex flex-col items-center rounded-2xl bg-black/45 px-3 py-0.5 text-white backdrop-blur">
                  <span className="font-display text-xl leading-tight tabular-nums">{hud.mode.main}</span>
                  {hud.mode.sub && <span className="text-[11px] font-bold leading-tight opacity-90 tabular-nums">{hud.mode.sub}</span>}
                </div>
              ) : <div className="rounded-full bg-black/35 px-3 py-0.5 text-xs font-bold text-white tabular-nums backdrop-blur">{dist(hud.dist)}</div>}
              {hud.chips.length > 0 && <div className="flex max-w-full flex-wrap justify-center gap-1">{hud.chips.map((c) => <span key={c.replace(/[0-9+-]/g, "")} className="rounded-full bg-[#2B1F5A]/75 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums backdrop-blur">{c}</span>)}</div>}
              {hud.boss && (
                <div className="mt-1 flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1 rounded-full bg-[#3A0F1A]/70 px-2.5 py-0.5 text-[11px] font-bold text-white">😈 {hud.boss.name} {Array.from({ length: hud.boss.max }, (_, i) => <span key={i} className={i < hud.boss!.hp ? "" : "opacity-25"}>❤️</span>)}</div>
                  {hud.boss.tired && <motion.div initial={{ scale: 0.8 }} animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="rounded-full bg-[#5CF2C9] px-3 py-0.5 text-xs font-bold text-[#0B3A33]">{WEAK_TIP[hud.boss.weak] ?? WEAK_TIP.ball}</motion.div>}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-0.5 rounded-full bg-black/40 px-1.5 py-1 backdrop-blur">
                {[0, 1, 2].map((i) => <span key={i} className={`block size-4 rounded-[40%_40%_50%_50%] border border-[#7DFFE0]/60 ${i < hud.scales ? "bg-gradient-to-b from-[#3FB8C4] to-[#156B76] shadow-[0_0_6px_rgba(92,242,201,0.8)]" : "bg-black/30"}`} />)}
              </div>
            </div>
          </div>
        </div>
      )}
      {screen === "game" && hud && boostOn && (
        <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ bottom: "max(18px, env(safe-area-inset-bottom))" }}>
          <div className={`flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur ${hud.boost >= 0.34 ? "shadow-[0_0_18px_rgba(92,242,201,0.8)]" : ""}`}>
            <Sparkles className="size-4 text-[#7DFFE0]" />
            <div className="h-2.5 w-36 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-[#5CF2C9] to-[#FFFFFF]" style={{ width: `${hud.boost * 100}%` }} /></div>
            <span className="text-[11px] font-bold text-white">{hud.boost >= 0.34 ? "TAP!" : "Burst"}</span>
          </div>
        </div>
      )}

      {/* ---------------- move hint (once per move) */}
      <AnimatePresence>
        {screen === "game" && hint && !hud?.intro && (
          <motion.div key={hint} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-[16%] flex justify-center px-6">
            <div className="flex items-center gap-3 rounded-full bg-black/55 px-4 py-2.5 text-white backdrop-blur">
              <motion.span animate={{ y: hint === "hop" || hint === "double" ? [0, -8, 0] : hint === "curl" ? [0, 8, 0] : 0, x: hint === "steer" || hint === "trick" ? [-8, 8, -8] : 0 }} transition={{ repeat: Infinity, duration: 0.9 }} className="text-2xl">{HINTS[hint]?.icon}</motion.span>
              <span className="text-sm font-bold">{HINTS[hint]?.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- her magic's name */}
      <AnimatePresence>
        {spell && screen === "game" && !story && (
          <motion.div key={spell.id} initial={{ opacity: 0, y: -10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center">
            <div className="rounded-full bg-[#2A0A2A]/80 px-4 py-1.5 font-display text-lg text-[#E8C8FF] shadow-[0_0_24px_rgba(200,90,255,0.6)]">✨ {spell.name}!</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- the story: subtitles, the title card, skip */}
      <AnimatePresence>
        {line && (
          <motion.div key={line.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 flex justify-center px-5" style={{ bottom: story ? "calc(10% + 18px)" : "18%" }}>
            <div className={`max-w-md rounded-2xl bg-black/60 px-4 py-2 text-center text-[15px] font-bold leading-snug backdrop-blur ${line.who === "Mayamma" ? "text-[#C8FF9A] drop-shadow-[0_0_8px_rgba(160,255,120,0.7)]" : line.who === "Narrator" ? "italic text-white" : "text-[#FFE27A]"}`}>
              {line.who !== "Narrator" && <span className="mr-1 text-[11px] uppercase tracking-widest opacity-80">{line.who}</span>}{line.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {titleCard && (
          <motion.div key="tc" initial={{ opacity: 0, scale: 1.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 180, damping: 16 }} className="pointer-events-none absolute inset-x-0 top-[30%] text-center font-display text-6xl drop-shadow-[0_6px_0_rgba(20,30,90,0.6)]">
            <span className="bg-gradient-to-b from-[#FFFFFF] to-[#9FF5DD] bg-clip-text text-transparent">Rollo</span> <span className="bg-gradient-to-b from-[#FFE27A] to-[#FF9F1A] bg-clip-text text-transparent">Rush</span>
          </motion.div>
        )}
      </AnimatePresence>
      {story && (
        <button onClick={() => session.current?.skipStory()} className="absolute right-4 rounded-full bg-white/20 px-4 py-2 text-sm font-bold text-white backdrop-blur active:scale-95" style={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}>Skip ⏭</button>
      )}

      {/* ---------------- toasts */}
      <AnimatePresence>
        {toast && screen === "game" && (
          <motion.div key={toast.id} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} className="pointer-events-none absolute inset-x-0 top-[34%] flex justify-center">
            <div className={`font-display text-4xl drop-shadow-[0_4px_0_rgba(0,0,0,0.4)] ${toast.text === "Oops!" ? "text-[#FF8FA3]" : "text-[#FFE27A]"}`}>{toast.text}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- modes, Dex, Locker, the end of a mode run */}
      <AnimatePresence>
        {sheet === "modes" && <ModesSheet key="modes" onClose={() => setSheet(null)} onPick={(id) => (id === "trial" ? setSheet("trial") : runMode(id))} />}
        {sheet === "trial" && <TrialSheet key="trial" onClose={() => setSheet("modes")} onPick={(n) => runMode("trial", n)} />}
        {sheet === "dex" && <DexSheet key="dex" onClose={() => setSheet(null)} />}
        {sheet === "locker" && <LockerSheet key="locker" onClose={() => setSheet(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {modeRes && screen === "game" && <ModeResultCard key="res" res={modeRes.res} out={modeRes.out} onHome={exitMode} onAgain={() => lastMode.current && runMode(lastMode.current.id, lastMode.current.n)} />}
      </AnimatePresence>

      {busy && screen === "game" && (
        <div className="absolute inset-0 grid place-items-center bg-[#0B1240]/60"><div className="rounded-full bg-black/50 px-4 py-2 text-sm font-bold text-white">Building the track…</div></div>
      )}
    </div>
  );
}
