"use client";
// Bead Rush — a 3D bead-snake runner: drag left and right to steer a chain of glossy beads up a neon runway, eat bead
// orbs to grow, chew through numbered blocks (each point costs one bead), squeeze between walls, dodge red orbs and pick
// the right gate. Reach the finish with any beads left. Stages arrive one by one: 600 designed tracks across twelve
// worlds (each with its own colours and music, a long track halfway and a finale), then endless remixes. Every track is
// planned so the best route survives — but only just.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronRight, Heart, Play, RotateCcw, Shield, Star, Trophy, X, Circle } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track as trackEv } from "@/lib/analytics";
import { laneX, type Run, type RunEvent } from "../engine";
import { DESIGNED, STAGES_PER_WORLD, WORLDS, buildStage, passOf, worldOf, type StageDef } from "../stage";
import { useBead, useBeadHydrated } from "../save";
import { BeadScene } from "./Scene";
import { BEAD_CSS } from "./styles";

export const BEAD_SFX = ["orb", "minus", "bite", "break", "bump", "up", "down", "shield", "lose", "win", "star", "world", "open"] as const;
type Sfx = (typeof BEAD_SFX)[number];
const sfxName = (k: Sfx) => `a:bead_${k}` as Sound;
const music = (k: string) => `a:bead_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  walls: ["Walls", "Glowing walls stop you sliding across lanes. Pick your lane before you reach them!"],
  minus: ["Red orbs", "Red orbs take beads away. Dodge them — unless the other lanes are worse."],
  gates: ["Gates", "Green ×2 doubles your beads, pink ½ halves them. You pass through one gate only."],
  boss: ["World finale", "The last track of every world is a long one. Make it to the finish to open the next world."],
  remix: ["Endless tracks", "You've finished all 600 designed tracks! From here every stage is a fresh remix — forever."],
};
interface Result { stage: number; stars: number; coins: number; worldDone: boolean; gift: string; beads: number; best: number }

export default function BeadApp({ slug }: { slug: string; title: string }) {
  const ready = useBeadHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useBead((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [hud, setHud] = useState({ L: 0, prog: 0, started: false, shield: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "dead" | "help" | "tip">("");
  const [tipKey, setTipKey] = useState("");
  const [toast, setToast] = useState("");
  const [revived, setRevived] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BeadScene | null>(null);
  const defRef = useRef<StageDef | null>(null);
  const stateRef = useRef({ result: false, sheet: "", paused: false });
  const helped = useRef(false);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { result: !!result, sheet, paused }; sceneRef.current?.wake(); }, [result, sheet, paused]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Stringing the beads");
    void audio.preload(BEAD_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(worldOf(useBead.getState().stage).music)]);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.12, duck: k === "win" || k === "world" });
  }, []);

  // ---------------------------------------------------------------- the HUD reads the run ten times a second
  useEffect(() => {
    if (screen !== "game") return;
    const id = setInterval(() => {
      const sc = sceneRef.current, d = defRef.current; if (!sc?.run || !d) return;
      const r = sc.run;
      setHud((h) => (h.L === r.L && h.started === sc.isStarted && h.shield === r.shield && Math.abs(h.prog - r.z / d.track.end) < 0.004 ? h : { L: r.L, prog: Math.min(1, r.z / d.track.end), started: sc.isStarted, shield: r.shield }));
    }, 100);
    return () => clearInterval(id);
  }, [screen]);

  // ---------------------------------------------------------------- run events
  const finish = useCallback((r: Run) => {
    const d = defRef.current!;
    const ratio = r.L / Math.max(1, d.best);
    const stars = helped.current ? Math.min(2, ratio >= 0.9 ? 3 : 2) : ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1;
    const coins = 5 + Math.min(30, r.L) + stars * 3 + (d.boss ? 20 : d.showcase ? 8 : 0);
    useProfile.getState().earnCoins(coins);
    useBead.getState().win(d.stage, stars, r.L);
    let gift = "";
    const give = useBead.getState().giveBooster;
    if (d.boss) { give("revive", 2); give("shield", 2); gift = "+2 Revives · +2 Shields"; }
    else if (d.showcase) { give("shield", 1); gift = "+1 Shield"; }
    else if (d.stage % 10 === 0) { give(d.stage % 20 === 0 ? "revive" : "shield", 1); gift = d.stage % 20 === 0 ? "+1 Revive" : "+1 Shield"; }
    const worldDone = d.stage % STAGES_PER_WORLD === 0;
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, worldDone, gift, beads: r.L, best: d.best });
      sfx(worldDone ? "world" : "win", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 900);
    trackEv("bead_clear", { stage: d.stage, stars });
  }, [sfx]);
  const onEvent = useCallback((e: RunEvent, r: Run) => {
    const d = defRef.current; if (!d) return;
    const pan = Math.max(-0.85, Math.min(0.85, (e.lane !== undefined ? laneX(e.lane, d.track.lanes) : r.x) / 2.4));
    switch (e.e) {
      case "orb": sfx("orb", { x: pan, gain: 0.5, rate: 1 + Math.min(0.4, (e.v ?? 1) * 0.04) }); break;
      case "minus": sfx("minus", { x: pan, gain: 0.55 }); buzz(30); break;
      case "bite": sfx("bite", { x: pan, gain: 0.32, rate: 0.9 + Math.min(0.7, r.chewCount * 0.025) }); buzz(6); break;
      case "break": sfx("break", { x: pan, gain: 0.55 }); buzz(18); break;
      case "bump": sfx("bump", { x: pan, gain: 0.4 }); break;
      case "x2": sfx("up", { x: pan, gain: 0.6 }); break;
      case "half": sfx("down", { x: pan, gain: 0.6 }); buzz(30); break;
      case "shield": sfx("shield", { x: pan, gain: 0.6 }); break;
      case "dead": sfx("lose", { gain: 0.6 }); buzz(80); setTimeout(() => setSheet("dead"), 700); break;
      case "done": finish(r); break;
    }
  }, [sfx, finish]);
  const evRef = useRef(onEvent);
  useEffect(() => { evRef.current = onEvent; }, [onEvent]);

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const sc = new BeadScene(host.current, {
      active: () => { const s = stateRef.current; return !s.result && !s.sheet && !s.paused; },
      event: (e, r) => evRef.current(e, r),
      started: () => setHud((h) => ({ ...h, started: true })),
    });
    sceneRef.current = sc;
    const d = defRef.current; if (d) sc.setStage(d.track, worldOf(d.stage).floor, worldOf(d.stage).bg[0]);
    return () => { sc.dispose(); sceneRef.current = null; };
  }, [screen]);

  // keyboard: ← → move a lane
  useEffect(() => {
    if (screen !== "game") return;
    const on = (e: KeyboardEvent) => {
      const sc = sceneRef.current, d = defRef.current; if (!sc?.run || !d) return;
      const half = (d.track.lanes - 1) / 2;
      const cur = Math.round(sc.run.x + half);
      if (e.key === "ArrowLeft" || e.key === "a") { sc.steer(laneX(Math.max(0, cur - 1), d.track.lanes)); e.preventDefault(); }
      if (e.key === "ArrowRight" || e.key === "d") { sc.steer(laneX(Math.min(d.track.lanes - 1, cur + 1), d.track.lanes)); e.preventDefault(); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [screen]);

  // ---------------------------------------------------------------- stages
  const start = useCallback((stage: number) => {
    const d = buildStage(stage);
    setDef(d); defRef.current = d; setResult(null); setSheet(""); setRevived(false); helped.current = false;
    setHud({ L: d.track.start, prog: 0, started: false, shield: 0 });
    setScreen("game");
    sceneRef.current?.setStage(d.track, worldOf(stage).floor, worldOf(stage).bg[0]);
    const w = worldOf(stage);
    void audio.playMusic(music(w.music));
    audio.warmMusic([music(worldOf(stage + STAGES_PER_WORLD).music)]);
    sfx("open", { gain: 0.45 });
    useBead.getState().saveCurrent({ stage, game: { stage }, revived: false });
    const tips = useBead.getState().tips;
    const has: Record<string, boolean> = {
      remix: stage > DESIGNED, boss: d.boss, walls: d.track.walls.length > 0,
      minus: d.track.rows.some((r) => r.cells.some((c) => c?.t === "minus")), gates: d.track.rows.some((r) => r.cells.some((c) => c?.t === "x2")),
    };
    const tip = ["remix", "boss", "walls", "minus", "gates"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useBead.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); }
    trackEv("bead_start", { stage });
  }, [sfx]);
  const doRestart = () => { const d = defRef.current; if (d) start(d.stage); };
  const doShield = () => {
    const r = sceneRef.current?.run; if (!r || result || r.state === "dead" || r.state === "done") return;
    if (r.shield >= 1) { setToast("Shield is already on"); return; }
    if (!useBead.getState().useBooster("shield")) { setToast("No shields left"); return; }
    sceneRef.current?.shieldOn(); helped.current = true; sfx("shield", { gain: 0.6 }); setToast("Shield on — the next block breaks free");
  };
  const doRevive = () => {
    const sc = sceneRef.current, r = sc?.run; if (!r || r.state !== "dead") return;
    if (revived) { setToast("One revive per track"); return; }
    if (!useBead.getState().useBooster("revive")) { setToast("No revives left"); return; }
    sc?.revive(5); helped.current = true; setRevived(true); setSheet("");
    sfx("shield", { gain: 0.6 }); sc?.wake();
  };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __bead?: unknown }).__bead = {
      def: () => defRef.current, start: (stage: number) => start(stage), run: () => sceneRef.current?.run,
      steer: (x: number) => sceneRef.current?.steer(x), begin: () => sceneRef.current?.begin(), head: () => { const r = host.current?.getBoundingClientRect(), p = sceneRef.current?.headScreen(); return p && r ? { x: r.left + p.x, y: r.top + p.y } : null; },
    };
  }, [start]);

  const leave = () => { setScreen("home"); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const w = worldOf(screen === "game" ? stage : useBead.getState().stage);
  const inS = ((stage - 1) % STAGES_PER_WORLD) + 1;
  return (
    <div className="bdr-root" style={{ ["--s1" as string]: w.bg[0], ["--s2" as string]: w.bg[1], ["--paint" as string]: "#ffc83a" }}>
      <style>{BEAD_CSS}</style>
      <div className="bdr-bubbles" aria-hidden>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ left: `${(i * 41) % 100}%`, width: 14 + ((i * 13) % 26), height: 14 + ((i * 13) % 26), animationDuration: `${14 + (i % 5) * 4}s`, animationDelay: `${-i * 2.7}s` }} />)}</div>

      {screen === "home" && <Home ready={ready} onPlay={(st) => start(st)} />}

      {screen === "game" && def && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-start gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="bdr-amber grid size-11 shrink-0 place-items-center"><ArrowLeft className="size-5" /></button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <p className="bdr-display text-xl leading-none drop-shadow">Level {stage}{def.boss ? " · Finale" : def.showcase ? " · Long track" : ""}</p>
              <p className="text-[11px] font-bold opacity-80">{w.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_WORLD}</p>
              <div className="bdr-bar w-full max-w-[220px]"><b style={{ width: `${Math.round(hud.prog * 100)}%` }} /></div>
            </div>
            <button type="button" aria-label="Restart" onClick={doRestart} className="bdr-amber grid size-11 shrink-0 place-items-center"><RotateCcw className="size-5" /></button>
          </div>
          <div className="pointer-events-none flex justify-center"><span className={`bdr-chip ${hud.L <= 3 ? "bdr-low" : ""}`}><Circle className="size-3.5 fill-current" /> {hud.L} beads{hud.shield ? " · 🛡️" : ""}</span></div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="bdr-stage" />
            {!hud.started && !sheet && (
              <div className="pointer-events-none absolute inset-x-0 bottom-[18%] flex flex-col items-center gap-2">
                <p className="bdr-big text-center">Drag to steer</p>
                <span className="bdr-tapcue text-4xl">👆</span>
              </div>
            )}
          </div>
          <div className="flex items-end justify-center gap-5 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Shield} label="Shield" n={boosters.shield} onClick={doShield} />
            <Tool icon={RotateCcw} label="Retry" onClick={doRestart} />
          </div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "dead" && !result && (
          <Sheet key="dead" title="Out of beads!" onClose={() => undefined}>
            <p className="opacity-85">{revived ? "Try the track again — look further ahead for the lane that gets through." : "Revive with 5 beads (the block that stopped you breaks), or try the track again."}</p>
            <div className="mt-4 grid gap-2">
              {!revived && boosters.revive > 0 && <button type="button" className="bdr-btn bdr-cta bdr-shine py-3 text-lg" onClick={doRevive}><Heart className="mr-1 inline size-5" /> Revive ({boosters.revive})</button>}
              <button type="button" className={`bdr-btn ${!revived && boosters.revive > 0 ? "bdr-soft" : "bdr-cta"} py-3`} onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useBead.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>👆 Drag left and right to steer your bead snake (or use ← →).</li>
              <li>⚪ Eat bead orbs to grow longer.</li>
              <li>🟩 Numbered blocks cost one bead per point — the snake chews through them. Too big a number and you run out!</li>
              <li>🏁 Reach the finish with any beads left. More beads = more stars.</li>
            </ul>
            <button type="button" className="bdr-btn bdr-cta mt-5 w-full py-3 text-lg" onClick={() => { useBead.getState().sawHelp(); setSheet(""); }}>Let&apos;s go</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useBead.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="bdr-btn bdr-cta mt-5 w-full py-3 text-lg" onClick={() => { useBead.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="bdr-pill pointer-events-none absolute bottom-28 left-1/2 z-50 -translate-x-1/2 text-sm whitespace-nowrap">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Tool({ icon: Icon, label: text, n, onClick }: { icon: typeof Star; label: string; n?: number; onClick: () => void }) {
  return (
    <button type="button" className="bdr-tool" onClick={onClick}>
      <span className="bdr-tool-ico bdr-amber"><Icon className="size-6" />{n !== undefined && <span className="bdr-badge">{n}</span>}</span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bdr-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="bdr-display text-2xl">{title}</h2>
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
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="bdr-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="bdr-head px-5 pt-5 pb-4">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#fff3a0] text-white" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="bdr-display mt-1 text-3xl drop-shadow">{r.worldDone ? "World complete!" : "Finish!"}</h2>
          <p className="mt-1 text-sm font-bold opacity-90">{r.worldDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}`}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-bold opacity-75">{r.beads} beads home · best possible {r.best}</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/50 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="bdr-btn bdr-cta bdr-shine flex items-center justify-center gap-2 py-3 text-lg" onClick={onNext}>Level {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="bdr-btn bdr-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  return (
    <div className="bdr-title" role="img" aria-label="Bead Rush" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="bdr-word bdr-w1">{[..."BEAD"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "#ffd23a", animationDelay: `${i * 0.07}s, ${1 + i * 0.15}s` }}>{ch}</span>)}</div>
      <div className="bdr-word bdr-w2">{[..."RUSH"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "#ffffff", animationDelay: `${0.4 + i * 0.07}s, ${1.4 + i * 0.15}s` }}>{ch}</span>)}</div>
      <div className="mt-2 flex items-center gap-1.5" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <span key={i} className="inline-block rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,.6)]" style={{ width: 18 - i * 2, height: 18 - i * 2 }} />)}</div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number) => void }) {
  const save = useBead();
  const stage = save.stage, w = worldOf(stage);
  const wi = Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length;
  const remix = passOf(stage) > 0;
  const at = (stage - 1) % STAGES_PER_WORLD;
  return (
    <div className="bdr-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Level"], [Star, String(save.totalStars), "Stars"], [Trophy, String(save.beads), "Beads home"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="bdr-sheet flex items-center gap-2 !rounded-[18px] px-3 py-2.5 !shadow-none">
                <Icon className="size-6 shrink-0 text-[#f0a81a]" />
                <span className="min-w-0"><span className="bdr-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Bead Rush — 3D snake and blocks runner</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-bold opacity-90 sm:mx-auto">Steer your bead snake up the track, grow on orbs and chew through number blocks — pick the lane that gets you home.</p>

        <div className="bdr-sheet bdr-shine relative mt-3 overflow-hidden p-5">
          <p className="text-xs font-extrabold tracking-widest uppercase opacity-70">⚪ {w.name}{remix ? " · Remix" : ""}</p>
          <p className="bdr-display mt-1 text-5xl leading-none">Level {stage}</p>
          <div className="bdr-bar mt-3"><b style={{ width: `${Math.round((at / STAGES_PER_WORLD) * 100)}%` }} /></div>
          <p className="mt-1 text-[11px] font-bold opacity-70">{at} of {STAGES_PER_WORLD} tracks in this world</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onPlay(stage)} className="bdr-btn bdr-cta inline-flex items-center gap-2 px-9 py-3.5 text-2xl"><Play className="size-6 fill-current" /> Play</button>
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="bdr-display text-[24px] leading-none drop-shadow">The worlds</h2>
          <span className="text-xs font-bold opacity-80">{STAGES_PER_WORLD} tracks each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORLDS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_WORLD) > i || remix, now = i === wi;
            return (
              <div key={s.id} className={`rounded-2xl border-[3px] p-3 shadow-md ${done || now ? "" : "opacity-50"}`} style={{ borderColor: now ? "#ffd23a" : "rgba(255,255,255,.25)", background: `linear-gradient(150deg, ${s.floor}, ${s.bg[1]})`, color: "#fff" }}>
                <p className="text-[13px] font-extrabold">{s.name}</p>
                <p className="text-[11px] font-bold opacity-80">{now ? `track ${((stage - 1) % STAGES_PER_WORLD) + 1} of ${STAGES_PER_WORLD}` : done ? "★ complete" : `from level ${i * STAGES_PER_WORLD + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="bdr-sheet mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="bdr-display text-lg">How it works</p>
          <p>👆 Drag to steer. Bead orbs make you longer; each point on a block costs one bead.</p>
          <p>🧱 Walls, red orbs and ×2 / ½ gates join as you go. Look ahead — the cheapest block now can trap you later.</p>
          <p>🏁 600 tracks across twelve worlds, then endless remixes. Every track has a route home — only just.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-60">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
