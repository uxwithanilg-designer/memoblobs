"use client";
// Arrow Unveil — tap the arrows to slide them off the board and uncover the hidden painting underneath. An arrow
// slides out in the direction it points; if another arrow is in its way it bumps and you lose a heart. Stages never
// end and arrive one by one: 600 designed stages across twelve galleries (each with its own paintings, colours and
// music, a showcase board halfway and a big gallery finale), then endless remixes. Phone-app flow.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronRight, Eraser, Heart, Image as ImageIcon, Lightbulb, Play, Plus, RotateCcw, Star, X } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { track } from "@/lib/analytics";
import { DESIGNED, GALLERIES, STAGES_PER_GALLERY, galleryOf, passOf, type StageDef } from "../stage";
import { getStage, prepareStage } from "../factory";
import { arrowsLeft, erase, hintOf, move, newGame, starsOf, type Game } from "../play";
import { paintPicture } from "../picture";
import { useUnveil, useUnveilHydrated } from "../save";
import { UnveilBoard, type BoardSound } from "./Board";
import { UNVEIL_CSS } from "./styles";

export const UNVEIL_SFX = ["tap", "slide", "exit", "bump", "heart", "reveal", "hint", "erase", "clear", "star", "gallery", "lose", "open"] as const;
type Sfx = (typeof UNVEIL_SFX)[number];
const sfxName = (k: Sfx) => `a:unveil_${k}` as Sound;
const music = (k: string) => `a:unveil_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const TIPS: Record<string, [string, string]> = {
  shape: ["Shaped boards", "Boards now come in shapes — hearts, circles, diamonds and more. Arrows still slide out across the gaps."],
  showcase: ["Showcase board", "Halfway through every gallery comes a big showcase board with a bigger painting. Take your time!"],
  boss: ["Gallery finale", "The last stage of every gallery is a big heart-shaped board. Clear it to open the next gallery."],
  long: ["Bendy arrows", "Long arrows follow their own path as they leave — only the line ahead of the arrowhead has to be clear."],
  remix: ["Endless gallery", "You've finished all 600 designed stages! From here every stage is a fresh remix — new boards and paintings, forever."],
};

interface Result { stage: number; stars: number; coins: number; galleryDone: boolean; gift: string; pic: string; mistakes: number }

export default function UnveilApp({ slug }: { slug: string; title: string }) {
  const ready = useUnveilHydrated();
  const { setLoading, setInRound, setImmersive, setMenu, paused } = usePlayer();
  const boosters = useUnveil((s) => s.boosters);
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
  const boardRef = useRef<UnveilBoard | null>(null);
  const armedRef = useRef(false);
  useEffect(() => { armedRef.current = armed; }, [armed]);
  const pendingRef = useRef<{ g: Game; d: StageDef } | null>(null);
  const applyPending = useCallback(() => { const b = boardRef.current, p = pendingRef.current; if (!b || !p) return; pendingRef.current = null; b.setStage(p.d, galleryOf(p.d.stage), p.g); }, []);
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
    loadRef.current(0.3, "Hanging the paintings");
    void audio.preload(UNVEIL_SFX.map(sfxName), [music("title")]);
    void audio.playMusic(music("title"));
    audio.warmMusic([music(galleryOf(useUnveil.getState().stage).music)]);
    prepareStage(useUnveil.getState().stage);
  }, []);
  useEffect(() => { if (ready) setLoading(null); }, [ready, setLoading]);
  useEffect(() => { setInRound(screen === "game"); setImmersive(screen === "game"); }, [screen, setInRound, setImmersive]);
  useEffect(() => () => { setInRound(false); setImmersive(false); setMenu([]); }, [setInRound, setImmersive, setMenu]);

  const sfx = useCallback((k: Sfx, o: { x?: number; rate?: number; gain?: number; delay?: number } = {}) => {
    audio.play(sfxName(k), { gain: o.gain ?? 0.6, pan: o.x ?? 0, rate: o.rate, delay: o.delay, reverb: 0.16, duck: k === "clear" || k === "gallery" });
  }, []);
  const persist = useCallback((g: Game) => {
    const d = defRef.current; if (!d) return;
    useUnveil.getState().saveCurrent({ stage: d.stage, game: g, revived: stateRef.current.revived });
  }, []);

  // ---------------------------------------------------------------- finishing
  const finishStage = useCallback((g: Game) => {
    const d = defRef.current!;
    const stars = starsOf(g);
    const coins = 4 + Math.round(d.board.arrows.length / 4) + stars * 3 + (d.boss ? 20 : d.showcase ? 8 : 0);
    useProfile.getState().earnCoins(coins);
    useUnveil.getState().win(d.stage, stars);
    let gift = "";
    if (d.boss) { useUnveil.getState().giveBooster("hint", 3); useUnveil.getState().giveBooster("eraser", 2); gift = "+3 Hints · +2 Erasers"; }
    else if (d.showcase) { useUnveil.getState().giveBooster("hint", 2); gift = "+2 Hints"; }
    else if (d.stage % 10 === 0) { useUnveil.getState().giveBooster(d.stage % 20 === 0 ? "eraser" : "hint", 1); gift = d.stage % 20 === 0 ? "+1 Eraser" : "+1 Hint"; }
    const galleryDone = d.stage % STAGES_PER_GALLERY === 0;
    boardRef.current?.celebrate();
    sfx("reveal", { gain: 0.6 });
    setTimeout(() => {
      setResult({ stage: d.stage, stars, coins, galleryDone, gift, pic: boardRef.current?.pictureURL() ?? "", mistakes: g.mistakes });
      sfx(galleryDone ? "gallery" : "clear", { gain: 0.8 });
      for (let k = 0; k < stars; k++) sfx("star", { delay: 0.55 + k * 0.28, gain: 0.5, rate: 1 + k * 0.08 });
    }, 1300);
    track("unveil_clear", { stage: d.stage, stars });
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
      if (r.win) { useUnveil.getState().saveCurrent(null); setTimeout(() => finishStage(r.game), 650); }
      else persist(r.game);
    } else {
      b.bump(id, r.blockId, r.steps); buzz(60);
      setTimeout(() => { sfx("heart", { gain: 0.6 }); setHurt((h) => h + 1); }, 220);
      persist(r.game);
      if (r.lose) setTimeout(() => { setSheet("out"); sfx("lose", { gain: 0.55 }); }, 900);
    }
  };
  useEffect(() => { tapRef.current = doTap; });
  const eraseRef = useRef<(id: number) => void>(() => undefined);
  const doErase = (id: number) => {
    const g0 = gameRef.current, d = defRef.current, b = boardRef.current;
    if (!g0 || !d || !b || result) return;
    if (!useUnveil.getState().useBooster("eraser")) { setToast("No erasers left"); setArmed(false); return; }
    const g = erase(g0, id); setGame(g); gameRef.current = g; setArmed(false); b.pop(id);
    if (g.gone.length === d.board.arrows.length) { useUnveil.getState().saveCurrent(null); setTimeout(() => finishStage(g), 650); } else persist(g);
  };
  useEffect(() => { eraseRef.current = doErase; });

  useLayoutEffect(() => {
    if (screen !== "game" || !host.current) return;
    const board = new UnveilBoard(host.current, {
      canPlay: () => { const s = stateRef.current; return !!gameRef.current && !s.result && !s.sheet && !s.paused; },
      eraserArmed: () => armedRef.current,
      tap: (id) => tapRef.current(id),
      erase: (id) => eraseRef.current(id),
      sound: (e: BoardSound, pan: number, n = 1) => {
        if (e === "slide") sfx("slide", { x: pan, gain: 0.45, rate: Math.max(0.75, 1.15 - n * 0.05) });
        else if (e === "exit") sfx("exit", { x: pan, gain: 0.5, rate: 0.9 + Math.random() * 0.25 });
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
    const gal = galleryOf(stage);
    void audio.playMusic(music(gal.music));
    audio.warmMusic([music(galleryOf(stage + STAGES_PER_GALLERY).music)]);
    sfx("open", { gain: 0.45 });
    prepareStage(stage + 1);
    pendingRef.current = { g, d };
    requestAnimationFrame(() => applyPending());
    const tips = useUnveil.getState().tips;
    const has: Record<string, boolean> = { remix: stage > DESIGNED, boss: d.boss, showcase: d.showcase, shape: d.shape !== "rect", long: d.board.arrows.some((a) => a.cells.length >= 4) };
    const tip = ["remix", "boss", "showcase", "shape", "long"].find((k) => has[k] && !tips.includes(k)) ?? "";
    if (!useUnveil.getState().seenHelp) setSheet("help"); else if (tip) { setTipKey(tip); setSheet("tip"); } else setToast(`${gal.name} · ${d.board.arrows.length} arrows`);
    track("unveil_start", { stage });
  }, [sfx, applyPending]);

  // ---------------------------------------------------------------- boosters
  const doHint = () => {
    const g = gameRef.current, d = defRef.current; if (!g || !d || result) return;
    const id = hintOf(d.board, g); if (id < 0) return;
    if (!useUnveil.getState().useBooster("hint")) { setToast("No hints left"); return; }
    const g2 = { ...g, helped: true }; setGame(g2); gameRef.current = g2; persist(g2);
    boardRef.current?.hint(id); sfx("hint", { gain: 0.5 });
  };
  const doMore = () => { const g0 = gameRef.current; if (!g0) return; const g = { ...g0, hearts: g0.hearts + 2, helped: true }; setRevived(true); setGame(g); gameRef.current = g; setSheet(""); sfx("heart", { gain: 0.5, rate: 1.4 }); persist(g); };
  const doRestart = () => { const d = defRef.current; if (!d) return; useUnveil.getState().saveCurrent(null); void start(d.stage); };

  // QA hook (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __unveil?: unknown }).__unveil = {
      game: () => gameRef.current, def: () => defRef.current, start: (stage: number) => void start(stage),
      tap: (id: number) => boardRef.current?.tapId(id),
      hint: () => { const g = gameRef.current, d = defRef.current; return g && d ? hintOf(d.board, g) : -1; },
      busy: () => !!boardRef.current?.busy,
      arrow: (id: number) => { const b = boardRef.current, r = host.current?.getBoundingClientRect(); const p = b?.arrowScreen(id); return p && r ? { x: r.left + p.x, y: r.top + p.y } : null; },
      board: () => boardRef.current,
    };
  }, [start]);

  const leave = () => { const g = gameRef.current; if (g && !result) persist(g); setScreen("home"); setGame(null); setResult(null); setSheet(""); void audio.playMusic(music("title")); };
  const next = useCallback(() => { const r = result; if (r) void start(r.stage + 1); }, [result, start]);

  const stage = def?.stage ?? 1;
  const gal = galleryOf(screen === "game" ? stage : useUnveil.getState().stage);
  const inS = ((stage - 1) % STAGES_PER_GALLERY) + 1;
  const left = def && game ? arrowsLeft(def, game) : 0, total = def?.board.arrows.length ?? 1;
  return (
    <div className="unv-root" style={{ ["--s1" as string]: gal.sky[0], ["--s2" as string]: gal.sky[1], ["--s3" as string]: gal.sky[2], ["--trim" as string]: gal.glow }}>
      <style>{UNVEIL_CSS}</style>
      <div className="unv-stars" aria-hidden />

      {screen === "home" && <Home ready={ready} onPlay={(st, resume) => void start(st, resume)} />}

      {screen === "game" && (
        <div className="absolute inset-0 z-[2] flex flex-col">
          <div className="flex items-center gap-2 pt-[calc(max(env(safe-area-inset-top),10px)+6px)] pr-[64px] pb-1 pl-3">
            <button type="button" aria-label="Back" onClick={leave} className="unv-panel grid size-11 shrink-0 place-items-center !rounded-2xl"><ArrowLeft className="size-5" /></button>
            <div className="unv-panel min-w-0 flex-1 !rounded-2xl px-3 py-1">
              <p className="unv-display truncate text-lg leading-tight">Stage {stage}{def?.boss ? <Badge text="Finale" /> : def?.showcase ? <Badge text="Showcase" /> : null}</p>
              <p className="truncate text-[11px] font-bold opacity-75">{gal.name}{passOf(stage) ? " · Remix" : ""} · {inS}/{STAGES_PER_GALLERY}</p>
            </div>
            <div key={hurt} className={`unv-panel flex items-center gap-0.5 !rounded-2xl px-2.5 py-2 ${hurt ? "unv-bump" : ""}`} aria-label={`${game?.hearts ?? 0} hearts`}>
              {Array.from({ length: Math.max(3, game?.hearts ?? 0) }, (_, i) => <Heart key={i} className={`size-5 ${i < (game?.hearts ?? 0) ? "fill-[#ff4f6a] text-[#ff4f6a]" : "text-white/30"}`} />)}
            </div>
          </div>
          <div className="mx-4 mt-0.5 flex items-center gap-2">
            <div className="unv-panel flex min-w-0 flex-1 items-center gap-2 !rounded-full px-3 py-1 text-sm font-extrabold">
              <ImageIcon className="size-4 shrink-0 text-[var(--trim)]" />
              <div className="unv-bar min-w-0 flex-1"><b style={{ width: `${Math.round(((total - left) / Math.max(1, total)) * 100)}%` }} /></div>
              <span className="shrink-0 tabular-nums opacity-85">{left} left</span>
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={host} className="unv-stage" />
          </div>
          <div className="flex items-end justify-center gap-3 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Tool icon={Lightbulb} label="Hint" n={boosters.hint} onClick={doHint} />
            <Tool icon={Eraser} label={armed ? "Tap an arrow" : "Eraser"} n={boosters.eraser} on={armed} onClick={() => { if (!armed && boosters.eraser <= 0) { setToast("No erasers left"); return; } setArmed((a) => !a); }} />
            <Tool icon={RotateCcw} label="Restart" onClick={doRestart} />
          </div>
        </div>
      )}

      {loadingStage && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/15 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3"><div className="h-12 w-12 animate-spin rounded-full border-[5px] border-white/30 border-t-[var(--trim)]" /><p className="unv-display text-lg text-white drop-shadow">Hanging the painting…</p></div>
        </div>
      )}

      <AnimatePresence>
        {sheet === "out" && !result && (
          <Sheet key="out" title="Out of hearts!" onClose={() => undefined}>
            <p className="opacity-85">{revived ? "Try the board again — look for arrows with a clear line to the edge." : "Take 2 more hearts and keep going — free, once per stage."}</p>
            <div className="mt-4 grid gap-2">
              {!revived && <button type="button" className="unv-btn unv-cta unv-shine py-3" onClick={doMore}><Plus className="mr-1 inline size-5" /> +2 hearts</button>}
              <button type="button" className="unv-btn unv-soft py-3" onClick={doRestart}><RotateCcw className="mr-1 inline size-5" /> Try again</button>
            </div>
          </Sheet>
        )}
        {sheet === "help" && (
          <Sheet key="help" title="How to play" onClose={() => { useUnveil.getState().sawHelp(); setSheet(""); }}>
            <ul className="grid gap-2 text-[15px]">
              <li>👆 Tap an arrow — it slides off the board in the direction it points.</li>
              <li>🚧 If another arrow is in its way, it bumps back and you lose a ❤️. You have 3 per stage.</li>
              <li>🖼️ Every arrow that leaves uncovers part of a hidden painting. Clear them all to reveal it!</li>
              <li>💡 Stuck? A Hint lights up an arrow that can go; the Eraser removes any arrow.</li>
            </ul>
            <button type="button" className="unv-btn unv-cta mt-5 w-full py-3" onClick={() => { useUnveil.getState().sawHelp(); setSheet(""); }}>Let&apos;s play</button>
          </Sheet>
        )}
        {sheet === "tip" && tipKey && (
          <Sheet key={`tip-${tipKey}`} title={TIPS[tipKey][0]} onClose={() => { useUnveil.getState().sawTip(tipKey); setSheet(""); }}>
            <p>{TIPS[tipKey][1]}</p>
            <button type="button" className="unv-btn unv-cta mt-5 w-full py-3" onClick={() => { useUnveil.getState().sawTip(tipKey); setSheet(""); }}>Got it</button>
          </Sheet>
        )}
        {result && <ClearSheet key={`clear-${result.stage}`} r={result} onNext={next} onHome={leave} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute top-28 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--trim)] bg-[#1e1636] px-4 py-2 text-sm font-bold whitespace-nowrap text-white shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
      <span className="hidden" data-slug={slug} />
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return <span className="ml-2 rounded-full bg-[#ff4f6a] px-2 py-0.5 align-middle font-sans text-[10px] font-extrabold tracking-wider text-white uppercase">{text}</span>;
}

function Tool({ icon: Icon, label: text, n, on, onClick }: { icon: typeof Star; label: string; n?: number; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`unv-tool ${on ? "unv-tool-on" : ""}`} onClick={onClick}>
      <span className="unv-tool-ico"><Icon className="size-5" />{n !== undefined && <span className="unv-badge">{n}</span>}</span>{text}
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="unv-sheet w-full max-w-md !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:!rounded-b-[26px]" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="unv-display text-2xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/10"><X className="size-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ClearSheet({ r, onNext, onHome }: { r: Result; onNext: () => void; onHome: () => void }) {
  const [left, setLeft] = useState(r.galleryDone ? 7 : 5);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => { if (left === 1) onNext(); setLeft((x) => x - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left, onNext]);
  const s = galleryOf(r.stage), ns = galleryOf(r.stage + 1);
  return (
    <motion.div className="absolute inset-0 z-40 grid place-items-center bg-black/35 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="unv-sheet w-full max-w-sm overflow-hidden text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 16 }}>
        <div className="unv-head px-5 pt-5 pb-4">
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -40 }} animate={{ scale: i < r.stars ? 1 : 0.8, rotate: 0 }} transition={{ delay: 0.5 + i * 0.28, type: "spring" }}>
                <Star className={`size-10 ${i < r.stars ? "fill-[#FFE27A] text-[#FFB23D]" : "fill-white/40 text-white/60"}`} />
              </motion.span>
            ))}
          </div>
          <h2 className="unv-display mt-1 text-3xl text-white">{r.galleryDone ? "Gallery complete!" : "Painting revealed!"}</h2>
          <p className="mt-1 text-sm font-bold text-white/90">{r.galleryDone ? `${s.name} done — next: ${ns.name}` : `${s.name} · ${((r.stage - 1) % STAGES_PER_GALLERY) + 1} of ${STAGES_PER_GALLERY} · ${r.mistakes ? `${r.mistakes} bump${r.mistakes > 1 ? "s" : ""}` : "no bumps!"}`}</p>
        </div>
        <div className="px-5 py-4">
          {r.pic && <motion.img src={r.pic} alt={`Painting from stage ${r.stage}`} className="mx-auto max-h-44 rounded-xl border-4 border-white shadow-lg" initial={{ rotate: -4, scale: 0.9 }} animate={{ rotate: 2, scale: 1 }} transition={{ type: "spring", damping: 10 }} />}
          <p className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm font-bold"><span className="flex items-center gap-1"><CoinIcon size={18} /> +{r.coins}</span>{r.gift && <span className="rounded-full bg-[#ffd34a]/40 px-2 py-0.5">🎁 {r.gift}</span>}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="unv-btn unv-cta unv-shine flex items-center justify-center gap-2 py-3" onClick={onNext}>Stage {r.stage + 1}{left > 0 ? ` in ${left}` : ""} <ChevronRight className="size-5" /></button>
            <button type="button" className="unv-btn unv-soft py-2.5" onClick={onHome}>Home</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Title() {
  const [hop, setHop] = useState(0);
  const cols = ["#ff6a5a", "#ffb84a", "#ffd23f", "#5ad08a", "#4ab0ff", "#a07aff"];
  return (
    <div className="unv-title" role="img" aria-label="Arrow Unveil" onPointerDown={() => setHop((h) => h + 1)}>
      <div className="unv-tl">
        <div className="unv-word">{[..."ARROW"].map((ch, i) => <span key={`${i}-${hop}`} style={{ color: cols[i], animationDelay: `${i * 0.07}s` }}>{ch}</span>)}</div>
        <div className="unv-arrows" aria-hidden>{["#ff6a5a", "#ffd23f", "#4ab0ff", "#5ad08a"].map((c, i) => <i key={i} style={{ color: c, animationDelay: `${i * 0.35}s` }}>➜</i>)}</div>
        <div className="unv-word">{[..."UNVEIL"].map((ch, i) => <span key={`${i}-${hop}`} style={{ animationDelay: `${0.35 + i * 0.07}s` }}>{ch}</span>)}</div>
      </div>
    </div>
  );
}

/** a small painting from a cleared stage, drawn live */
function Pic({ stage, size }: { stage: number; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const d = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(size * d); c.height = Math.round(size * 1.3 * d);
    paintPicture(c.getContext("2d")!, c.width, c.height, galleryOf(stage).id, stage);
  }, [stage, size]);
  return <canvas ref={ref} className="rounded-lg border-2 border-white/80 shadow-md" style={{ width: size, height: size * 1.3 }} aria-label={`Painting from stage ${stage}`} />;
}

function Home({ ready, onPlay }: { ready: boolean; onPlay: (stage: number, resume?: { game: Game; revived: boolean }) => void }) {
  const save = useUnveil();
  const stage = save.stage, gal = galleryOf(stage), cur = save.current;
  const shown = cur?.stage ?? stage;
  const gi = Math.floor((stage - 1) / STAGES_PER_GALLERY) % GALLERIES.length;
  const remix = passOf(stage) > 0;
  const recent = Array.from({ length: Math.min(6, stage - 1) }, (_, i) => stage - 1 - i);
  const at = (shown - 1) % STAGES_PER_GALLERY;
  return (
    <div className="unv-scroll">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(max(env(safe-area-inset-top),14px)+58px)] pb-16">
        <div className="grid grid-cols-3 gap-2">
          {[[Play, String(stage), "Stage"], [Star, String(save.totalStars), "Stars"], [ImageIcon, String(save.pictures), "Paintings"]].map(([I, v, k]) => {
            const Icon = I as typeof Star;
            return (
              <div key={k as string} className="unv-panel flex items-center gap-2 !rounded-[20px] px-3 py-2.5">
                <Icon className="size-6 shrink-0 text-[var(--trim)]" />
                <span className="min-w-0"><span className="unv-display block truncate text-xl leading-none">{ready ? (v as string) : "–"}</span><span className="text-[10px] font-extrabold tracking-wider uppercase opacity-60">{k as string}</span></span>
              </div>
            );
          })}
        </div>
        <h1 className="sr-only">Arrow Unveil — slide the arrows out and reveal the hidden picture</h1>
        <Title />
        <p className="max-w-lg text-center text-[14px] leading-snug font-semibold opacity-90 sm:mx-auto">Tap the arrows to slide them away, mind the bumps — and uncover the painting hidden underneath!</p>

        <div className="unv-shine relative mt-3 overflow-hidden rounded-[30px] border-2 p-5 text-white shadow-[0_24px_50px_-24px_rgba(0,0,0,.8)]" style={{ borderColor: gal.glow, background: `radial-gradient(80% 90% at 85% 10%, ${gal.glow}55, transparent 60%), linear-gradient(150deg, ${gal.sky[2]}, ${gal.sky[0]})` }}>
          <p className="text-xs font-extrabold tracking-widest text-white/90 uppercase"><ImageIcon className="mr-1 inline size-4" />{gal.name}{remix ? " · Remix" : ""}</p>
          <p className="unv-display mt-1 text-5xl leading-none drop-shadow">Stage {shown}</p>
          <div className="unv-bar mt-3 !h-2.5"><b style={{ width: `${Math.round((at / STAGES_PER_GALLERY) * 100)}%` }} /></div>
          <p className="mt-1 text-[11px] font-bold text-white/80">{at} of {STAGES_PER_GALLERY} paintings in this gallery</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {cur ? (
              <>
                <button type="button" onClick={() => onPlay(cur.stage, cur)} className="unv-btn unv-cta inline-flex items-center gap-2 px-6 py-3 text-lg"><Play className="size-5 fill-current" /> Continue</button>
                <button type="button" onClick={() => { useUnveil.getState().saveCurrent(null); onPlay(cur.stage); }} className="unv-btn inline-flex items-center gap-1.5 bg-white/20 px-4 py-3"><RotateCcw className="size-4" /> Restart</button>
              </>
            ) : <button type="button" onClick={() => onPlay(stage)} className="unv-btn unv-cta inline-flex items-center gap-2 px-8 py-3.5 text-xl"><Play className="size-6 fill-current" /> Play</button>}
          </div>
        </div>

        {ready && recent.length > 0 && (
          <>
            <h2 className="unv-display mt-6 text-[22px] leading-none">Your latest paintings</h2>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{recent.map((s) => <Pic key={s} stage={s} size={84} />)}</div>
          </>
        )}

        <div className="mt-6 flex items-end justify-between">
          <h2 className="unv-display text-[24px] leading-none">The galleries</h2>
          <span className="text-xs font-bold opacity-60">{STAGES_PER_GALLERY} paintings each · never ending</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GALLERIES.map((s, i) => {
            const done = Math.floor((stage - 1) / STAGES_PER_GALLERY) > i || remix, now = i === gi;
            return (
              <div key={s.id} className={`rounded-2xl border-2 p-3 text-white shadow-md ${done || now ? "" : "opacity-55 grayscale-[.4]"}`} style={{ borderColor: s.glow, background: `radial-gradient(70% 80% at 90% 0%, ${s.glow}66, transparent 70%), linear-gradient(150deg, ${s.sky[2]}, ${s.sky[0]})` }}>
                <p className="text-[13px] font-extrabold drop-shadow">{s.name}</p>
                <p className="text-[11px] font-bold text-white/85">{now ? `painting ${((stage - 1) % STAGES_PER_GALLERY) + 1} of ${STAGES_PER_GALLERY}` : done ? "★ complete" : `from stage ${i * STAGES_PER_GALLERY + 1}`}</p>
              </div>
            );
          })}
        </div>
        <div className="unv-panel mt-6 grid gap-1.5 p-4 text-[14px]">
          <p className="unv-display text-lg">How it works</p>
          <p>👆 Tap an arrow and it slides off the board the way it points — bendy arrows follow their own path.</p>
          <p>🚧 Another arrow in the way? It bumps and costs a heart. Plan the order!</p>
          <p>🖼️ Each arrow that leaves uncovers the hidden painting. Boards grow, take shapes and get trickier as you go.</p>
        </div>
        <p className="mt-6 text-center text-[11px] font-bold opacity-50">Progress is saved on this device and joins the global ranking when MOMOBLOBS sign-in arrives.</p>
      </div>
    </div>
  );
}
