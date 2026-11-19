"use client";
// Momo Jelly Jam app shell — phone-first and app-like: the 3D tray fills the screen, a slim HUD on top (with chips for
// the stage's own rules), big thumb buttons below. The journey has no stage picker: it continues stage after stage, and
// closing and reopening carries on from the exact same board. The title screen also opens the modes — Daily Jam, Rush,
// Zen, Kranky Weekly, Puzzle Packs, the Jam Lab — plus the Concept Dex and the Jelly Shop.
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lightbulb, Play, RotateCcw, Sparkles, Star, Undo2, Zap } from "lucide-react";
import { usePlayer } from "@/components/player/PlayerContext";
import { audio } from "@/lib/audio";
import { useRoll } from "../../roll/save";
import { CONCEPT, CONCEPTS, type ConceptGroup } from "../data/concepts";
import { worldOf } from "../data/worlds";
import { groupConcepts, isBuildable, knownAt, type ModeSpec } from "../gen";
import { autoQuality, type Quality } from "../render3d";
import { starsFor, useJam, useJamHydrated, type WinResult } from "../save";
import { JamSession, registerDev, type HelperId, type JamHud } from "../session";
import { DexSheet, HelperSheet, LabSheet, LostSheet, ModeGrid, PacksSheet, RuleChips, Sheet, ShopSheet, type ModeTile } from "./JamMenus";

const gfx = (q: string | undefined): Quality => (q === "low" || q === "medium" || q === "high" ? q : autoQuality());
const tap = (haptics: boolean) => {
  audio.ensure(); void audio.resume();
  audio.play("pop", { gain: 0.32, rate: 1.2, duck: false });
  if (haptics) { try { navigator.vibrate?.(8); } catch { /* ignore */ } }
};
const Coin = ({ size = 20 }: { size?: number }) => <Image src="/brand/coin.webp" alt="" width={size} height={size} className="shrink-0 drop-shadow" style={{ width: size, height: size }} />;
const pad2 = (n: number) => String(n).padStart(2, "0");
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const weekKey = () => { const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-W${pad2(Math.ceil(((+t - +y0) / 864e5 + 1) / 7))}`; };
const RUSH_SECONDS = 180;
const MODE_NAME: Record<string, string> = { daily: "📅 Daily Jam", weekly: "😈 Kranky Weekly", rush: "⚡ Rush", zen: "🍵 Zen", lab: "🧪 Jam Lab", pack: "🎁 Puzzle Pack" };

type Run = { kind: "journey" } | { kind: "mode"; spec: ModeSpec };
interface ModeWin { title: string; stars: number; coins: number; moves: number; par: number; next?: string }

export default function JellyApp({ title }: { slug: string; title: string }) {
  const ready = useJamHydrated();
  const player = usePlayer();
  const { setLoading, setImmersive, setInRound, setMenu } = player;
  const haptics = player.settings.haptics;
  const stage = useJam((s) => s.stage);
  const dex = useJam((s) => s.dex);
  const modes = useJam((s) => s.modes);
  const shop = useJam((s) => s.shop);
  const fusionCount = useJam((s) => s.fusions.length);
  const totalStars = useJam((s) => s.totalStars);
  const helperSpent = useJam((s) => s.helperSpent);
  const bank = useRoll((s) => s.bank);
  const [screen, setScreen] = useState<"title" | "game">("title");
  const [hud, setHud] = useState<JamHud | null>(null);
  const [win, setWin] = useState<(WinResult & { moves: number; par: number }) | null>(null);
  const [modeWin, setModeWin] = useState<ModeWin | null>(null);
  const [lost, setLost] = useState<string | null>(null);
  const [shownCards, setShownCards] = useState<string[]>([]);
  const [loadingStage, setLoadingStage] = useState(false);
  const [sheet, setSheet] = useState<null | "dex" | "shop" | "lab" | "packs" | "helpers" | "rushEnd">(null);
  const [dexSel, setDexSel] = useState<string | null>(null);
  const [labPick, setLabPick] = useState<string[]>([]);
  const [labLevel, setLabLevel] = useState(1);
  const [rush, setRush] = useState<{ endsAt: number; score: number; best: boolean } | null>(null);
  const [rushLeft, setRushLeft] = useState<number | undefined>(undefined);
  const [run, setRunState] = useState<Run>({ kind: "journey" });
  const runRef = useRef<Run>({ kind: "journey" });
  const setRun = (r: Run) => { runRef.current = r; setRunState(r); };
  const host = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const session = useRef<JamSession | null>(null);
  const nextTimer = useRef(0);
  const settings = useRef(player.settings);
  useEffect(() => { settings.current = player.settings; });

  useEffect(() => { setLoading(null); }, [setLoading]);
  useEffect(() => { void audio.preload(["pop", "squish", "whoosh", "rewind", "confetti", "hmm", "a:squelch", "a:plop", "a:wobble", "a:bubble", "a:whooshOut", "a:ding", "a:levelup", "a:twinkle", "a:scramble", "a:tickHi", "a:slideUp", "a:chime"]); }, []);
  useEffect(() => { setImmersive(screen === "game"); setInRound(screen === "game" && !win && !modeWin); }, [screen, win, modeWin, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => { const s = session.current; if (!s) return; if (player.paused || sheet === "helpers") s.pause(); else s.resume(); }, [player.paused, sheet]);
  useEffect(() => { session.current?.setStyle(shop); }, [shop]);

  /** the ideas this player knows (for the modes) */
  const known = useCallback(() => { const st = useJam.getState(); return [...new Set([...knownAt(st.stage), ...st.dex])]; }, []);

  /** load the journey stage the save says we are on (the saved board and moves, or a freshly built one) */
  const loadCurrent = useCallback((s: JamSession) => {
    const st = useJam.getState();
    setLost(null);
    if (st.level && st.level.n === st.stage && !st.level.mode) { s.load(st.level, st.moves, st.hinted); return; }
    setLoadingStage(true);
    void s.stage(st.stage, st.reroll).then((L) => {
      if (session.current !== s || runRef.current.kind !== "journey") return;
      useJam.getState().setLevel(L);
      s.load(L);
      setLoadingStage(false);
    });
  }, []);
  /** load a mode's stage */
  const loadMode = useCallback((s: JamSession, spec: ModeSpec) => {
    setLost(null); setModeWin(null);
    setLoadingStage(true);
    void s.modeStage(spec, known()).then((L) => {
      const r = runRef.current;
      if (session.current !== s || r.kind !== "mode" || r.spec !== spec) return;
      s.load(L);
      setLoadingStage(false);
    });
  }, [known]);

  const goNext = useCallback(() => {
    window.clearTimeout(nextTimer.current);
    setWin(null);
    const s = session.current;
    if (s) loadCurrent(s);
  }, [loadCurrent]);

  /** a mode stage was cleared */
  const onModeWin = useCallback((L: { par: number; name: string }, moves: number, hinted: boolean) => {
    const r = runRef.current; if (r.kind !== "mode") return;
    const sp = r.spec, stars = starsFor(moves, L.par, hinted);
    const coins = useJam.getState().modeWin(sp.mode, sp.key, sp.idx, stars);
    for (let i = 0; i < stars; i++) audio.play("a:chime", { gain: 0.3, rate: 1 + i * 0.25, delay: 0.35 + i * 0.22, duck: false });
    if (sp.mode === "rush") {
      setRush((x) => (x ? { ...x, score: x.score + 1 } : x));
      const next: ModeSpec = { ...sp, idx: sp.idx + 1 };
      setRun({ kind: "mode", spec: next });
      window.clearTimeout(nextTimer.current);
      nextTimer.current = window.setTimeout(() => { const s = session.current; if (s) loadMode(s, next); }, 700);
      return;
    }
    const next = sp.mode === "zen" ? "Next zen stage" : sp.mode === "pack" ? (sp.idx + 1 < 20 ? "Next in pack" : undefined) : sp.mode === "lab" ? "Another one" : undefined;
    setModeWin({ title: `${MODE_NAME[sp.mode]} clear!`, stars, coins, moves, par: L.par, next });
  }, [loadMode]);

  // the board lives as long as the app
  useEffect(() => {
    if (!ready || !host.current) return;
    const st0 = settings.current;
    const st = useJam.getState();
    const s = new JamSession(host.current, {
      quality: gfx(st0.quality), haptics: st0.haptics, reduced: st0.reducedMotion,
      salt: st.salt, memory: () => useJam.getState().memory(), style: st.shop,
      spend: (n) => useJam.getState().spend(n),
      onHud: setHud,
      onOut: (e) => {
        const journey = runRef.current.kind === "journey";
        if (e.t === "moved") { if (journey) useJam.getState().setMoves(e.moves, e.hinted); return; }
        if (e.t === "level") { if (journey) useJam.setState({ level: e.level, moves: e.moves }); return; }
        if (e.t === "lost") { setLost(e.why); return; }
        if (!journey) { onModeWin(e.level, e.moves, e.hinted); return; }
        const res = useJam.getState().win(e.level, e.moves, e.hinted);
        setWin({ ...res, moves: e.moves, par: e.level.par });
        for (let i = 0; i < res.stars; i++) audio.play("a:chime", { gain: 0.3, rate: 1 + i * 0.25, delay: 0.35 + i * 0.22, duck: false });
        window.clearTimeout(nextTimer.current);
        nextTimer.current = window.setTimeout(() => goNext(), 2600);
      },
    });
    registerDev(s);
    session.current = s;
    loadCurrent(s);
    return () => { window.clearTimeout(nextTimer.current); s.destroy(); session.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // keep the tray between the HUD and the buttons (the HUD grows when a stage has rule chips)
  const hudN = hud?.n, hudLimit = hud?.limit, hasClock = hud?.timeLeft !== undefined, orderLen = hud?.order?.length ?? 0, rushing = rush !== null;
  useEffect(() => {
    const s = session.current;
    if (!s) return;
    const measure = () => {
      const top = screen === "game" ? (topRef.current?.getBoundingClientRect().bottom ?? 0) : 150;
      const hostTop = host.current?.getBoundingClientRect().top ?? 0;
      const hostBottom = host.current?.getBoundingClientRect().bottom ?? 0;
      const bar = screen === "game" ? (barRef.current?.getBoundingClientRect().height ?? 0) : Math.max(260, hostBottom - (titleRef.current?.getBoundingClientRect().top ?? hostBottom - 260));
      s.setInsets(Math.max(0, top - hostTop) + 6, bar + 10);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (host.current) ro.observe(host.current);
    if (topRef.current) ro.observe(topRef.current);
    if (titleRef.current) ro.observe(titleRef.current);
    return () => ro.disconnect();
  }, [screen, hudN, hudLimit, hasClock, orderLen, rushing]);

  // the rush clock
  useEffect(() => {
    if (!rush) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((rush.endsAt - Date.now()) / 1000));
      setRushLeft(left);
      if (left <= 0) {
        window.clearInterval(id);
        session.current?.pause();
        const best = useJam.getState().rushScore(rush.score);
        setRush({ ...rush, best });
        setSheet("rushEnd");
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [rush]);

  // a concept shows up for the first time: a card about it (until it times out or is tapped away)
  const meetId = screen === "game" && run.kind === "journey" && hud?.meet && CONCEPT[hud.meet] && !dex.includes(hud.meet) ? hud.meet : null;
  const toastId = meetId && !shownCards.includes(meetId) ? meetId : null;
  const toast = toastId ? { id: toastId, title: CONCEPT[toastId].name, text: CONCEPT[toastId].text } : null;
  const closeToast = useCallback((id: string) => setShownCards((a) => (a.includes(id) ? a : [...a, id])), []);
  useEffect(() => {
    if (!toastId) return;
    const t = window.setTimeout(() => closeToast(toastId), 5200);
    return () => window.clearTimeout(t);
  }, [toastId, closeToast]);

  const toTitle = useCallback(() => {
    window.clearTimeout(nextTimer.current);
    setRush(null); setModeWin(null); setLost(null); setSheet(null); setWin(null);
    if (runRef.current.kind !== "journey") { setRun({ kind: "journey" }); const s = session.current; if (s) { s.resume(); loadCurrent(s); } }
    setScreen("title");
  }, [loadCurrent]);

  useEffect(() => {
    if (screen !== "game") { setMenu([]); return; }
    setMenu([
      { id: "restart", label: "Restart stage", icon: "🔄", onSelect: () => { setLost(null); session.current?.restart(); } },
      { id: "title", label: "Title screen", icon: "🏠", onSelect: () => toTitle() },
    ]);
  }, [screen, setMenu, toTitle]);

  const startJourney = () => { setRun({ kind: "journey" }); setRush(null); setScreen("game"); const s = session.current; if (s && (!s.L || s.L.mode)) loadCurrent(s); };
  const startMode = (spec: ModeSpec) => {
    setRun({ kind: "mode", spec }); setScreen("game"); setSheet(null); setWin(null);
    const s = session.current; if (s) { s.resume(); loadMode(s, spec); }
  };
  const pickTile = (id: ModeTile) => {
    tap(haptics);
    switch (id) {
      case "daily": startMode({ mode: "daily", key: todayKey(), idx: 0 }); break;
      case "weekly": startMode({ mode: "weekly", key: weekKey(), idx: 0 }); break;
      case "zen": startMode({ mode: "zen", key: "zen", idx: useJam.getState().modes.zen }); break;
      case "rush": setRush({ endsAt: Date.now() + RUSH_SECONDS * 1000, score: 0, best: false }); startMode({ mode: "rush", key: `${Date.now()}`, idx: 0 }); break;
      default: setSheet(id); break;
    }
  };
  const useHelper = (id: HelperId) => {
    const s = session.current; if (!s) return;
    if (!useJam.getState().useHelper()) return;
    setSheet(null);
    if (id === "H15") {
      const r = runRef.current;
      if (r.kind === "journey") { useJam.getState().bumpReroll(); loadCurrent(s); }
      else { const spec = { ...r.spec, idx: r.spec.idx + 1000 }; setRun({ kind: "mode", spec }); loadMode(s, spec); }
      return;
    }
    if (!s.helper(id)) useJam.setState({ helperSpent: Math.max(0, useJam.getState().helperSpent - 1) });
  };
  const labChoices = [...new Set([...dex, ...knownAt(stage)])].filter((c) => isBuildable(c) && CONCEPT[c]).sort();
  const packUnlocked = (g: ConceptGroup) => groupConcepts(g).filter((c) => dex.includes(c)).length >= 2 || (g === "P" || g === "B" || g === "G");

  if (!ready) return <div className="absolute inset-0 bg-[#1b1430]" />;
  const W = worldOf(hud?.world ?? 1);
  const live = hud ? starsFor(Math.max(hud.moves, 1), hud.par, hud.hinted) : 3;
  const charges = Math.max(0, Math.floor(totalStars / 12) + useJam.getState().helperBonus + 3 - helperSpent);
  const found = CONCEPTS.filter((c) => dex.includes(c.id)).length;
  const today = todayKey(), week = weekKey();
  const modeSpec = run.kind === "mode" ? run.spec : null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#1b1430] select-none" style={{ overscrollBehavior: "none", WebkitTapHighlightColor: "transparent" }}>
      <div ref={host} className="absolute inset-0" style={{ touchAction: "none" }} />

      {/* ---------------------------------------------------------------- HUD */}
      {screen === "game" && hud && (
        <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 z-20 pl-3" style={{ paddingTop: "calc(var(--safe-top) + 0.5rem)", paddingRight: "calc(var(--safe-right, 0px) + 3.7rem)" }}>
          <div className="mx-auto flex max-w-lg items-start gap-2">
            <div className="pointer-events-auto flex min-w-0 flex-col items-start rounded-2xl bg-white/85 px-3 py-1.5 shadow-lg backdrop-blur">
              <span className="max-w-full truncate text-[10px] font-extrabold tracking-[0.12em] whitespace-nowrap text-[#5b4a8a] uppercase">{modeSpec ? MODE_NAME[modeSpec.mode] : hud.kind === "fusion" ? "Fusion Jam" : `${W.emoji} ${W.name}`}</span>
              <span className="max-w-[9.5rem] truncate font-display text-2xl leading-none whitespace-nowrap text-[#2a1e4a]">{modeSpec ? (modeSpec.mode === "rush" ? `Score ${rush?.score ?? 0}` : hud.name.split(" · ")[0]) : `Stage ${hud.n}`}</span>
            </div>
            <div className="mx-auto flex shrink-0 flex-col items-center rounded-2xl bg-white/85 px-2.5 py-1.5 shadow-lg backdrop-blur">
              <div className="flex gap-0.5">
                {[1, 2, 3].map((i) => <Star key={i} className={`size-5 ${i <= live ? "fill-[#FFC21A] text-[#E89B00]" : "fill-[#d9d3ea] text-[#bdb4d6]"}`} />)}
              </div>
              <span className="text-[11px] font-bold whitespace-nowrap text-[#2a1e4a]">Moves {hud.moves} · Par {hud.par}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/85 py-1 pr-3 pl-1.5 shadow-lg backdrop-blur">
              <Coin size={22} />
              <span className="font-display text-lg text-[#2a1e4a]">{bank.toLocaleString()}</span>
            </div>
          </div>
          {(hud.kind === "boss" || hud.kind === "fusion" || hud.kind === "burner") && !modeSpec && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-2 w-fit rounded-full bg-[#2a1e4a]/85 px-3 py-1 text-xs font-extrabold text-white shadow">
              {hud.kind === "boss" ? `😈 ${hud.name}` : hud.kind === "fusion" ? `✨ ${hud.fusion}` : "🔥 Brain burner"}
            </motion.div>
          )}
          <RuleChips hud={hud} rushLeft={rush ? rushLeft ?? RUSH_SECONDS : undefined} />
        </div>
      )}

      {/* ---------------------------------------------------------------- buttons */}
      {screen === "game" && (
        <div ref={barRef} className="absolute inset-x-0 bottom-0 z-20 px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 0.9rem)" }}>
          <div className="mx-auto flex max-w-sm items-end justify-center gap-3.5">
            <RoundBtn label={hud?.undoCost ? `Undo 💰${hud.undoCost}` : "Undo"} onClick={() => { tap(haptics); session.current?.undo(); }} disabled={!hud?.canUndo}><Undo2 className="size-7" /></RoundBtn>
            <RoundBtn label="Restart" onClick={() => { tap(haptics); setLost(null); session.current?.restart(); }} disabled={!hud?.moves}><RotateCcw className="size-7" /></RoundBtn>
            <RoundBtn label={hud?.hinting ? "Thinking…" : "Hint"} onClick={() => { tap(haptics); session.current?.hint(); }} accent><Lightbulb className="size-7" /></RoundBtn>
            <RoundBtn label={hud?.armed ? "Cancel" : `Help ${charges}`} onClick={() => { tap(haptics); if (hud?.armed) session.current?.disarm(); else setSheet("helpers"); }} green><Zap className="size-7" /></RoundBtn>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- new concept card */}
      <AnimatePresence>
        {screen === "game" && toast && !win && (
          <motion.div key={toast.id} initial={{ opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
            className="pointer-events-auto absolute inset-x-4 z-30 mx-auto max-w-sm rounded-3xl bg-white p-4 shadow-2xl" style={{ bottom: "calc(var(--safe-bottom) + 7.2rem)" }}
            onClick={() => closeToast(toast.id)}>
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#FF6FAE] to-[#8E5BFF] text-white shadow"><Sparkles className="size-6" /></div>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold tracking-[0.16em] text-[#8E5BFF] uppercase">New!</p>
                <p className="font-display text-xl leading-tight text-[#2a1e4a]">{toast.title}</p>
                <p className="mt-0.5 text-sm text-[#4b3f6b]">{toast.text}.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------------- stage clear (journey) */}
      <AnimatePresence>
        {win && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-end justify-center bg-[#1b1430]/35 p-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 1rem)" }} onClick={goNext}>
            <motion.div initial={{ y: 80, scale: 0.9 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 26 }} className="w-full max-w-sm rounded-[2rem] bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs font-extrabold tracking-[0.2em] text-[#8E5BFF] uppercase">Stage {win.n} clear!</p>
              <Stars n={win.stars} />
              <p className="text-sm font-semibold text-[#4b3f6b]">{win.moves} moves · par {win.par}</p>
              <div className="mt-2 flex items-center justify-center gap-1.5 font-display text-2xl text-[#2a1e4a]"><Coin size={26} /> +{win.coins}</div>
              {win.fusion && <p className="mt-1 text-sm font-bold text-[#8E5BFF]">✨ New fusion #{win.fusion.n}: {win.fusion.name}</p>}
              <button onClick={() => { tap(haptics); goNext(); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#FF7AB8] to-[#E8459A] py-3.5 font-display text-xl text-white shadow-[0_6px_0_#B22F74] active:translate-y-1 active:shadow-[0_2px_0_#B22F74]">
                Next stage <Play className="size-5 fill-white" />
              </button>
              <motion.div className="mx-auto mt-3 h-1.5 overflow-hidden rounded-full bg-[#eee9f8]">
                <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2.6, ease: "linear" }} className="h-full bg-[#8E5BFF]" />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------------- mode stage clear */}
      <AnimatePresence>
        {modeWin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-end justify-center bg-[#1b1430]/35 p-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}>
            <motion.div initial={{ y: 80, scale: 0.9 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 26 }} className="w-full max-w-sm rounded-[2rem] bg-white p-5 text-center shadow-2xl">
              <p className="text-xs font-extrabold tracking-[0.2em] text-[#8E5BFF] uppercase">{modeWin.title}</p>
              <Stars n={modeWin.stars} />
              <p className="text-sm font-semibold text-[#4b3f6b]">{modeWin.moves} moves · par {modeWin.par}</p>
              <div className="mt-2 flex items-center justify-center gap-1.5 font-display text-2xl text-[#2a1e4a]"><Coin size={26} /> +{modeWin.coins}</div>
              {modeSpec?.mode === "daily" && <p className="mt-1 text-sm font-bold text-[#E8459A]">🔥 Streak {modes.streak}</p>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => { tap(haptics); toTitle(); }} className="flex-1 rounded-2xl bg-[#f1edfa] py-3 font-display text-lg text-[#5b4a8a]">Menu</button>
                {modeWin.next && modeSpec && (
                  <button onClick={() => { tap(haptics); const s = session.current; const spec = { ...modeSpec, idx: modeSpec.idx + 1 }; setRun({ kind: "mode", spec }); if (s) loadMode(s, spec); }} className="flex-[1.4] rounded-2xl bg-gradient-to-b from-[#FF7AB8] to-[#E8459A] py-3 font-display text-lg text-white shadow-[0_5px_0_#B22F74]">{modeWin.next}</button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LostSheet why={screen === "game" ? lost : null} canUndo={!!hud?.canUndo} onUndo={() => { tap(haptics); setLost(null); session.current?.undo(); }} onRetry={() => { tap(haptics); setLost(null); session.current?.restart(); }} />

      {/* ---------------------------------------------------------------- title */}
      <AnimatePresence>
        {screen === "title" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex flex-col items-center justify-between bg-gradient-to-b from-[#1b1430]/70 via-[#1b1430]/20 to-[#1b1430]/85 px-5 text-center" style={{ paddingTop: "calc(var(--safe-top) + 2.2rem)", paddingBottom: "calc(var(--safe-bottom) + 1.2rem)" }}>
            <div>
              <motion.p initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-5xl leading-none text-white drop-shadow-[0_4px_0_#E8459A]">Momo</motion.p>
              <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 14 }} className="font-display text-6xl leading-none text-[#FFC21A] drop-shadow-[0_5px_0_#8E5BFF]">Jelly Jam</motion.p>
              <p className="mt-3 text-sm font-bold text-white/85">Squish it. Fit it. Pop it out!</p>
            </div>
            <div ref={titleRef} className="w-full max-w-sm">
              <button disabled={loadingStage && run.kind === "journey"} onClick={() => { tap(haptics); startJourney(); }}
                className="flex w-full flex-col items-center rounded-[1.75rem] bg-gradient-to-b from-[#FFD45C] to-[#FFA81A] py-3.5 font-display text-white shadow-[0_8px_0_#C77700] active:translate-y-1 active:shadow-[0_3px_0_#C77700] disabled:opacity-70">
                <span className="flex items-center gap-2 text-3xl drop-shadow"><Play className="size-7 fill-white" /> {stage > 1 ? "Continue" : "Play"}</span>
                <span className="text-sm opacity-95">Stage {stage} · {worldOf(Math.min(20, Math.ceil(stage / 60))).emoji} {stage > 1200 ? "Fusion Jam" : worldOf(Math.ceil(stage / 60)).name}</span>
              </button>
              <div className="mt-3">
                <ModeGrid onPick={pickTile} sub={{
                  daily: modes.daily[today] !== undefined ? "✓ today" : modes.streak ? `🔥${modes.streak}` : "new!",
                  rush: modes.rushBest ? `best ${modes.rushBest}` : undefined,
                  zen: modes.zen ? `${modes.zen}` : undefined,
                  weekly: modes.weekly[week] !== undefined ? "✓ week" : "new!",
                  dex: `${found}/400`,
                }} />
              </div>
              <p className="mt-2.5 text-[11px] font-semibold text-white/70">{title} · 400 puzzle ideas in 20 worlds, then endless mixes</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loadingStage && screen === "game" && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="rounded-2xl bg-white/90 px-4 py-2 font-display text-lg text-[#2a1e4a] shadow-xl">Mixing jelly…</div>
        </div>
      )}

      {/* ---------------------------------------------------------------- sheets */}
      <DexSheet open={sheet === "dex"} onClose={() => setSheet(null)} dex={dex} fusions={fusionCount} sel={dexSel} onSel={setDexSel} />
      <ShopSheet open={sheet === "shop"} onClose={() => setSheet(null)} shop={shop} bank={bank} onBuy={(id) => { if (useJam.getState().buy(id)) audio.play("a:levelup", { gain: 0.35, duck: false }); }} onEquip={(id) => { tap(haptics); useJam.getState().equip(id); }} />
      <LabSheet open={sheet === "lab"} onClose={() => setSheet(null)} choices={labChoices} picked={labPick} level={labLevel} onLevel={setLabLevel}
        onToggle={(c) => setLabPick((p) => (p.includes(c) ? p.filter((x) => x !== c) : p.length >= 3 ? [...p.slice(1), c] : [...p, c]))}
        onBuild={() => { tap(haptics); startMode({ mode: "lab", key: labPick.join("+") || "free", idx: useJam.getState().modes.lab, focus: labPick, d: [0.35, 0.65, 1.0][labLevel] }); }} />
      <PacksSheet open={sheet === "packs"} onClose={() => setSheet(null)} progress={modes.packs} unlocked={packUnlocked} onPlay={(g) => { tap(haptics); startMode({ mode: "pack", key: g, idx: Math.min(19, modes.packs[g] ?? 0) }); }} />
      <HelperSheet open={sheet === "helpers"} onClose={() => setSheet(null)} charges={charges} dex={dex} onUse={useHelper} />
      <Sheet open={sheet === "rushEnd"} title="Rush over!" onClose={toTitle}>
        <div className="py-2 text-center">
          <p className="text-5xl">⚡</p>
          <p className="font-display text-4xl text-[#2a1e4a]">{rush?.score ?? 0} stage{rush?.score === 1 ? "" : "s"}</p>
          <p className="mt-1 text-sm font-bold text-[#8E5BFF]">{rush?.best ? "🏆 New best!" : `Best: ${modes.rushBest}`}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={toTitle} className="flex-1 rounded-2xl bg-[#f1edfa] py-3 font-display text-lg text-[#5b4a8a]">Menu</button>
            <button onClick={() => { setSheet(null); setRush({ endsAt: Date.now() + RUSH_SECONDS * 1000, score: 0, best: false }); startMode({ mode: "rush", key: `${Date.now()}`, idx: 0 }); }} className="flex-[1.4] rounded-2xl bg-gradient-to-b from-[#FFB23F] to-[#FF7A3D] py-3 font-display text-lg text-white shadow-[0_5px_0_#C2501A]">Again</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <div className="my-2 flex justify-center gap-2">
      {[1, 2, 3].map((i) => (
        <motion.div key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i <= n ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.25 + i * 0.2, type: "spring", stiffness: 420, damping: 14 }}>
          <Star className={`size-12 ${i <= n ? "fill-[#FFC21A] text-[#E89B00] drop-shadow-lg" : "fill-[#e6e1f2] text-[#cfc7e4]"}`} />
        </motion.div>
      ))}
    </div>
  );
}

function RoundBtn({ label, onClick, disabled, accent, green, children }: { label: string; onClick: () => void; disabled?: boolean; accent?: boolean; green?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} className="group flex flex-col items-center gap-1 disabled:opacity-45">
      <span className={`grid size-[3.75rem] place-items-center rounded-full text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] transition active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.25)] ${accent ? "bg-gradient-to-b from-[#FFD45C] to-[#FFA81A]" : green ? "bg-gradient-to-b from-[#5ED8A8] to-[#2EA67A]" : "bg-gradient-to-b from-[#9C7BFF] to-[#6A45E0]"}`}>{children}</span>
      <span className="rounded-full bg-black/30 px-2 text-xs font-bold whitespace-nowrap text-white backdrop-blur">{label}</span>
    </button>
  );
}
