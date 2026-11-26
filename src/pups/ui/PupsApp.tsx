"use client";
// Noodle Pups — tap the long noodle dogs to send them running out of the yard. A pup runs head first the way it faces;
// if a pup or a rock is in the way it bumps and you lose a bone (three per stage). Get every pup out to clear the yard.
// Stages never end and arrive one by one: 600 designed stages across twelve dog parks (each with its own ground,
// colours and music, a big show yard halfway and a heart-shaped finale), then endless remixes. Hard all the way.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bone, ChevronRight, Dog, Lightbulb, Play, Plus, RotateCcw, Star, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { DESIGNED, PARKS, STAGES_PER_PARK, parkOf, passOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { arrowsLeft, erase, hintOf, move, newGame, starsOf, type Game } from "../play";
import { usePups, usePupsHydrated } from "../save";
import { PupsBoard, PUP_COLS, type BoardSound } from "./Board";
import { PUPS_CSS } from "./styles";

export const PUPS_SFX = ["tap", "run", "out", "bump", "bone", "bark", "hint", "treat", "clear", "star", "park", "lose", "open"] as const;
type Sfx = (typeof PUPS_SFX)[number];
const sfxName = (k: Sfx) => `a:pups_${k}` as Sound;
const music = (k: string) => `a:pups_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  rocks: ["Rocks & bushes", "Pups can never run through rocks or bushes. A pup facing one is stuck for good — find another way to free the yard."],
  shape: ["Shaped yards", "Yards now come in shapes — hearts, circles, diamonds and more. Pups still run out across the gaps."],
  showcase: ["Big show yard", "Halfway through every park comes a big show yard full of pups. Take your time!"],
  boss: ["Park finale", "The last stage of every park is a big heart-shaped yard. Clear it to open the next park."],
  remix: ["Endless parks", "You've finished all 600 designed stages! From here every stage is a fresh remix — new yards, forever."],
};

interface Result { stage: number; stars: number; coins: number; parkDone: boolean; gift: string; pups: number; mistakes: number }

export default function PupsApp({ slug }: { slug: string; title: string }) {
  const ready = usePupsHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = usePups((s) => s.boosters);
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [def, setDef] = useState<StageDef | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [revived, setRevived] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<"" | "out" | "help" | "tip">("");
  const [armed, setArmed] = useState(false);
  const [tipKey, setTipKey] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);
  const [toast, setToast] = useState("");
  const [hurt, setHurt] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const boardRef = useRef<PupsBoard | null>(null);
  const armedRef = useRef(false);
  useEffect(() => { armedRef.current = armed; }, [armed]);
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  const applyPending = useCallback(() => { const b = boardRef.current, p = pendingRef.current; if (!b || !p) return; pendingRef.current = null; b.setStage(p.d, parkOf(p.d.stage), p.g); }, []);
  const gameRef = useRef<Game | null>(null), defRef = useRef<StageDef | null>(null);
  const stateRef = useRef({ revived: false, result: false, sheet: "", paused: false });
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { defRef.current = def; }, [def]);
  useEffect(() => { stateRef.current = { revived, result: !!result, sheet, paused }; }, [revived, result, sheet, paused]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2000); return () => clearTimeout(t); }, [toast]);

  // ---------------------------------------------------------------- boot
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.3, "Calling the pups");
    void audio.preload(PUPS_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(parkOf(usePups.getState().stage).music)]);
    prepareStage(usePups.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.14, duck: k === "clear" || k === "park" });
  }, []);
  const persist = useCallback((g: Game) => {
    const d = defRef.current; if (!d) return;
    usePups.getState().saveCurrent({ stage: d.stage, game: g, revived: stateRef.current.revived });
  }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback((g: Game) => {
    const d = defRef.current!;
    const stars = starsOf(g);
    const coins = 4 + Math.round(d.board.arrows.length / 3) + stars * 3 + (d.boss ? 20 : d.showcase ? 8 : 0);
    useProfile.getState().earnCoins(coins);
    usePups.getState().win(d.stage, stars, d.board.arrows.length);
    let gift = "";
    if (d.boss) { usePups.getState().giveBooster("hint", 3); usePups.getState().giveBooster("treat", 2); gift = "+3 Hints · +2 Treats"; }
    else if (d.showcase) { usePups.getState().giveBooster("hint", 2); gift = "+2 Hints"; }
    else if (d.stage % 10 === 0) { usePups.getState().giveBooster(d.stage % 20 === 0 ? "treat" : "hint", 1); gift = d.stage % 20 === 0 ? "+1 Treat" : "+1 Hint"; }
    const parkDone = d.stage % STAGES_PER_PARK === 0;
    boardRef.current?.celebrate();
    sfx("bark", { gain: 0.6 });
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, parkDone, gift, pups: d.board.arrows.length, mistakes: g.mistakes });
      sfx(parkDone ? "park" : "clear", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 1100);
    track("pups_clear", { stage: d.stage, stars });
  }, [sfx]);

  // ---------------------------------------------------------------- moves
  const tapRef = useRef<(id: number) => void>(() => undefined);
  const doTap = (id: number) => {
    const g0 = gameRef.current, d = defRef.current, st = stateRef.current, b = boardRef.current;
    if (!g0 || !d || !b || st.result || st.sheet || st.paused) return;
    const r = move(d, g0, id);
    if (!r) return;
    setGame(r.game); gameRef.current = r.game;
    if (r.ok) {
      b.exit(id); buzz(8);
      if (r.win) { usePups.getState().saveCurrent(null); setTimeout(() => finishStage(r.game), 700); }
      else persist(r.game);
    } else {
      b.bump(id, r.blockId, r.steps); buzz(60);
      setTimeout(() => { sfx("bone", { gain: 0.6 }); setHurt((h) => h + 1); }, 220);
      persist(r.game);
      if (r.lose) setTimeout(() => { setSheet("out"); sfx("lose", { gain: 0.55 }); }, 900);
    }
  };
  useEffect(() => { tapRef.current = doTap; });
  const treatRef = useRef<(id: number) => void>(() => undefined);
  const doTreat = (id: number) => {
    const g0 = gameRef.current, d = defRef.current, b = boardRef.current;
    if (!g0 || !d || !b || result) return;
    if (!usePups.getState().useBooster("treat")) { setToast("No treats left"); setArmed(false); return; }
    const g = erase(g0, id); setGame(g); gameRef.current = g; setArmed(false); b.pop(id);
    if (g.gone.length === d.board.arrows.length) { usePups.getState().saveCurrent(null); setTimeout(() => finishStage(g), 700); } else persist(g);
  };
  useEffect(() => { treatRef.current = doTreat; });

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const board = new PupsBoard(host.current, {
      canPlay: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused; },
      treatArmed: () => armedRef.current,
      tap: (id) => tapRef.current(id),
      treat: (id) => treatRef.current(id),
      sound: (e: BoardSound, pan: number, n = 1) => {
        if (e === "run") sfx("run", { x: pan, gain: 0.45, rate: Math.max(0.8, 1.15 - n * 0.04) });
        else if (e === "out") sfx(Math.random() < 0.35 ? "bark" : "out", { x: pan, gain: 0.45, rate: 0.9 + Math.random() * 0.3 });
        else if (e === "tap") sfx("tap", { x: pan, gain: 0.3 });
        else sfx(e as Sfx, { x: pan, gain: 0.55 });
      },
    });
    boardRef.current = board;
    applyPending();
    return () => { board.dispose(); boardRef.current = null; };
  }, [screen, sfx, applyPending]);

  // ---------------------------------------------------------------- stages
  const start = useCallback(async (stage: number, resume?: { game: Game; revived: boolean }) => {
    setLoadingStage(true);
    let d: StageDef;
    try { d = await getStage(stage); } finally { setLoadingStage(false); }
    const g = resume?.game ?? newGame(d);
    setDef(d); setGame(g); setResult(null); setSheet("");
    setRevived(resume?.revived ?? false); setArmed(false);
    setScreen("game");
    const pk = parkOf(stage);
    void audio.playMusic(music(pk.music));
    audio.warmMusic([music(parkOf(stage + STAGES_PER_PARK).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = usePups.getState().tips;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, boss: d.boss, showcase: d.showcase, rocks: (d.board.rocks?.length ?? 0) > 0, shape: d.shape !== "rect" };
    const tip = ["remix", "boss", "showcase", "rocks", "shape"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!usePups.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); } else setToast(`${pk.name} · ${d.board.arrows.length} pups`);
    track("pups_start", { stage });
  }, [sfx, applyPending]);

  // ---------------------------------------------------------------- boosters
  const doHint = () => {
    const g = gameRef.current, d = defRef.current; if (!g || !d || result) return;
    const id = hintOf(d.board, g); if (id < 0) return;
    if (!usePups.getState().useBooster("hint")) { setToast("No hints left"); return; }
    const g2 = { ...g, helped: true }; setGame(g2); gameRef.current = g2; persist(g2);
    boardRef.current?.hint(id); sfx("hint", { gain: 0.5 });
  };
  const doMore = () => { const g0 = gameRef.current; if (!g0) return; const g = { ...g0, bones: g0.bones + 2, helped: true }; setRevived(true); setGame(g); gameRef.current = g; setSheet(""); sfx("treat", { gain: 0.5 }); persist(g); };
  const doRestart = () => { const d = defRef.current; if (!d) return; usePups.getState().saveCurrent(null); void start(d.stage); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __pups?: unknown }).__pups = {
      game: () => gameRef.current, def: () => defRef.current, start: (stage: number) => void start(stage),
      tap: (id: number) => boardRef.current?.tapId(id),
      hint: () => { const g = gameRef.current, d = defRef.current; return g && d ? hintOf(d.board, g) : -1; },
      busy: () => !!boardRef.current?.busy,
      pup: (id: number) => { const b = boardRef.current, r = host.current?.getBoundingClientRect(); const p = b?.pupScreen(id); return p && r ? { x: r.left + p.x, y: r.top + p.y } : null; },
      board: () => boardRef.current,
    };
  }, [start]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const pk = parkOf(screen === "game" ? stage : usePups.getState().stage);
  const inS = ((stage - 1) % STAGES_PER_PARK) + 1;
  const total = def?.board.arrows.length ?? 1, out = def && game ? total - arrowsLeft(def, game) : 0;
  const night = pk.id === "night";
  return (
    <div className={`pup-root ${night ? "pup-night" : ""}`} style={{ ["--g1" as string]: pk.ground[0], ["--g2" as string]: pk.ground[1], ["--ln" as string]: pk.line }}>
      <style>{PUPS_CSS}</style>
      {screen === "home" && <div className="pup-pattern" aria-hidden />}

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-start gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="pup-wood grid size-11 shrink-0 place-items-center"><ArrowLeft className="size-5" /></button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div key={hurt} className="pup-banner" aria-label={`${game?.bones ?? 0} bones left`}>
                {Array.from({ length: Math.max(3, game?.bones ?? 0) }, (_, i) => <BoneIcon key={i} on={i < (game?.bones ?? 0)} lose={i === (game?.bones ?? 0) && hurt > 0} />)}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-extrabold"><span className="tabular-nums opacity-80">{out}/{total}</span><span className="pup-ribbon text-sm">Stage {stage}</span>{def?.boss ? <span className="opacity-80">Finale</span> : def?.showcase ? <span className="opacity-80">Show yard</span> : <span className="opacity-70">{inS}/{STAGES_PER_PARK}</span>}</div>
            </div>
            <button type="button" aria-label="Restart" onClick={doRestart} className="pup-wood grid size-11 shrink-0 place-items-center"><RotateCcw className="size-5" /></button>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="pup-stage" />
            {hurt > 0 && <div key={`f${hurt}`} className="pup-flash" />}
          </div>
          <div className="flex items-end justify-center gap-4 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Lightbulb} label="Hint" n={boosters.hint} onClick={doHint} />
            <Tool icon={Bone} label={armed ? "Tap a pup" : "Treat"} n={boosters.treat} on={armed} onClick={() => { if (!armed && boosters.treat <= 0) { setToast("No treats left"); return; } setArmed((a) => !a); }} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/10">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-[#c8702c]/30 border-t-[#c8702c]" /><p className="pup-display text-lg">Calling the pups…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "out" && !result && (
          <Sheet key="out" title="Out of bones!" onClose={() => undefined}>
            <p className="opacity-85">{revived ? "Try the yard again — trace each pup's line to the edge first." : "Take 2 more bones and keep going — free, once per stage."}</p>
            <div className="mt-4 grid gap-2">
              {!revived && <button type="button" className="pup-btn pup-next pup-shine py-3 text-lg" onClick={doMore}><Plus className="mr-1 inline size-5" /> +2 bones</button>}
              <button type="button" className="pup-btn pup-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { usePups.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>👆 Tap a pup — it runs out of the yard the way its head faces, its long body following.</li>
              <li>🚧 If another pup or a rock is in its way, it bumps and you lose a 🦴. You have 3 per stage.</li>
              <li>🐶 Get every pup out to clear the yard. Plan the order — only a few can go at a time!</li>
              <li>💡 Stuck? A Hint lights up a pup that can go; a Treat lures any pup out.</li>
            </ul>
            <button type="button" className="pup-btn pup-next mt-5 w-full py-3 text-lg" onClick={() => { usePups.getState().sawHelp(); setSheet(""); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { usePups.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="pup-btn pup-next mt-5 w-full py-3 text-lg" onClick={() => { usePups.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-28 left-1/2 z-50 -translate-x-1/2 rounded-full border-2 border-[#e8cfa4] bg-[#fffaf0] px-4 py-2 text-sm font-bold whitespace-nowrap text-[#5a3418] shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function BoneIcon({ on, lose }: { on: boolean; lose?: boolean }) {
  return <span className={`pup-bone ${on ? "pup-bone-on" : "pup-bone-off"} ${lose ? "pup-lose" : ""}`} aria-hidden><b /><b /><b /><b /><i /></span>;
}

function Tool({ icon: Icon, label: text, n, on, onClick }: { icon: typeof Star; label: string; n?: number; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`pup-tool ${on ? "pup-tool-on" : ""}`} onClick={onClick}>
      <span className="pup-tool-ico pup-wood"><Icon className="size-6" />{n !== undefined && <span className="pup-badge">{n}</span>}</span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="pup-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="pup-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-black/5"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClearSheet({ r, onNext, onHome }: { r: Result; onNext: () => void; onHome: () => void }) {
  const [left, setLeft] = useState(r.parkDone ? 7 : 5);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, onNext]);
  const s = parkOf(r.stage), ns = parkOf(r.stage + 1);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/30 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="pup-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="pup-head px-5 pt-5 pb-4 text-white">
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }} className={i < r.stars ? "" : "opacity-40"}>
                <BoneIcon on />
              </motion.span>
            ))}
          </div>
          <h2 className="pup-display mt-1 text-3xl drop-shadow">{r.parkDone ? "Park complete!" : "All pups out!"}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{r.parkDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_PARK) + 1} of ${STAGES_PER_PARK} · ${r.mistakes ? `${r.mistakes} bump${r.mistakes > 1 ? "s" : ""}` : "no bumps!"}`}</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex justify-center gap-1 text-4xl" aria-hidden>{["🐶", "🐕", "🐩"].map((e, i) => <motion.span key={i} initial={{ y: 30, opacity: 0 }} animate={{ y: [30, -8, 0], opacity: 1 }} transition={{ delay: 0.3 + i * 0.12 }}>{e}</motion.span>)}</div>
          <p className="mt-1 text-sm font-bold opacity-75">{r.pups} pups safely out</p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/50 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="pup-btn pup-next pup-shine flex items-center justify-center gap-2 py-3 text-xl" onClick={onNext}>Next{left > 0 ? ` · ${left}` : ""} <ChevronRight className="size-6" /></button>
            <button type="button" className="pup-btn pup-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  return (
    <div className="pup-title" role="img" aria-label="Noodle Pups" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="pup-tl">
        <div className="pup-word">{[..."NOODLE"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: PUP_COLS[(i + 2) % PUP_COLS.length], animationDelay: `${i * 0.07}s, ${1 + i * 0.13}s` }}>{ch}</span>)}</div>
        <div className="pup-word">{[..."PUPS"].map((ch, i) => <span key={`${i}-${hop}`} style={{ ["--c" as string]: "#fff6e4", animationDelay: `${0.45 + i * 0.07}s, ${1.4 + i * 0.13}s` }}>{ch}</span>)}<span style={{ ["--c" as string]: "#fff", animationDelay: "0.8s, 2s", WebkitTextStroke: "0" }}>🐶</span></div>
      </div>
    </div>
  );
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = usePups();
  const stage = save.stage, pk = parkOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const pi = Math.floor((stage - 1) / STAGES_PER_PARK) % PARKS.length;
  const remix = passOf(stage) > 0;
  const at = (shown - 1) % STAGES_PER_PARK;
  return (
    <div className="pup-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Stage"], [Star, String(save.totalStars), "Bones"], [Dog, String(save.dogs), "Pups out"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="pup-panel flex items-center gap-2 px-3 py-2.5">
                <Icon className="size-6 shrink-0 text-[#c8702c]" />
                <span className="min-w-0"><span className="pup-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Noodle Pups — tap the dogs out puzzle</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-semibold opacity-90 sm:mx-auto">Tap the long noodle pups to send them running out of the yard — in the right order, or they bump!</p>

        <div className="pup-shine relative mt-3 overflow-hidden rounded-[28px] border-4 border-[#e8cfa4] p-5 shadow-[0_24px_50px_-24px_rgba(90,40,10,.6)]" style={{ background: `radial-gradient(80% 90% at 85% 10%, ${pk.glow}44, transparent 60%), linear-gradient(150deg, ${pk.ground[0]}, ${pk.ground[1]})`, color: night(pk.id) ? "#fff4e0" : "#5a3418" }}>
          <p className="text-xs font-extrabold tracking-widest uppercase opacity-80">🐾 {pk.name}{remix ? " · Remix" : ""}</p>
          <p className="pup-display mt-1 text-5xl leading-none">Stage {shown}</p>
          <div className="pup-bar mt-3"><b style={{ width: `${Math.round((at / STAGES_PER_PARK) * 100)}%` }} /></div>
          <p className="mt-1 text-[11px] font-bold opacity-70">{at} of {STAGES_PER_PARK} yards in this park</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="pup-btn pup-next inline-flex items-center gap-2 px-7 py-3 text-xl"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { usePups.getState().saveCurrent(null); onPlay(cur.stage); }} className="pup-btn pup-soft inline-flex items-center gap-1.5 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="pup-btn pup-next inline-flex items-center gap-2 px-9 py-3.5 text-2xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <h2 className="pup-display text-[24px] leading-none">The dog parks</h2>
          <span className="text-xs font-bold opacity-60">{STAGES_PER_PARK} yards each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PARKS.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_PARK) > i || remix, now = i === pi;
            return (
              <div key={s.id} className={`rounded-2xl border-[3px] p-3 shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: now ? s.glow : "#e8cfa4", background: `linear-gradient(150deg, ${s.ground[0]}, ${s.ground[1]})`, color: night(s.id) ? "#fff4e0" : "#5a3418" }}>
                <p className="text-[13px] font-extrabold">{s.name}</p>
                <p className="text-[11px] font-bold opacity-75">{now ? `yard ${((stage - 1) % STAGES_PER_PARK) + 1} of ${STAGES_PER_PARK}` : done ? "🦴 complete" : `from stage ${i * STAGES_PER_PARK + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="pup-panel mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="pup-display text-lg">How it works</p>
          <p>👆 Tap a pup and it runs out the way its head faces — its long body follows its own path.</p>
          <p>🚧 A pup or a rock in the way? It bumps and costs a bone. Only a few pups can go at a time — plan the order!</p>
          <p>🐾 Yards grow, take shapes and fill with rocks and longer pups as you go. 600 stages, then endless remixes.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-50">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
const night = (id: string) => id === "night";
