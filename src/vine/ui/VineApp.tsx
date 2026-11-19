"use client";
// Tondu's Vine Climb front-end, made to feel like a phone app: the title (Tondu on his vine under a slow cinematic
// orbit) with one big PLAY that always continues the climb, the climb itself (stage chip and a progress vine to the
// next flower gate, bugs, tail, shield, Sun meter, grip, combo, the CLING and LEAP pads), gate / world / guardian
// cards that never stop the climb, the fall card, the Daily Vine, the Bug Book, the Wardrobe (a live 3D preview),
// the upgrade Shop, missions and settings.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, BookOpen, CalendarDays, Play, Settings2, Shirt, ShoppingBag, Sparkles, Target, X, Zap } from "lucide-react";
import { CoinIcon } from "@/components/brand/CoinPill";
import { usePlayer } from "@/components/player/PlayerContext";
import { useProfile } from "@/lib/store";
import { audio, type MusicName, type Sound } from "@/lib/audio";
import { VineSession, VINE_SFX, type StageResult, type VineHud } from "../session";
import { DAILY_BASE, dayNumber, seasonOf, WILD_FROM } from "../stages";
import { BUGS, CAMPAIGN, CONCEPTS, GUARDIANS, WORLDS, stageIn, worldOf } from "../worlds";
import { SKINS } from "../lizard";
import { HATS, UPGRADES, UPGRADE_PRICE, autoQuality, nextStage, simOpts, useVine, useVineHydrated, wildVariant } from "../save";

type Screen = "title" | "game" | "book" | "wardrobe" | "shop" | "daily";
const UI_SOUNDS: Sound[] = ["a:click", "a:whooshOut", "a:whooshIn", "a:ding", "a:levelup", "a:coin", "a:sparks"];
const music = (k: string) => `a:vine_${k}_${k === "title" ? "calm" : "action"}` as MusicName;
const musicOf = (n: number) => {
  if (n >= DAILY_BASE) return WORLDS[(n - DAILY_BASE) % WORLDS.length].music;
  if (n >= WILD_FROM) return WORLDS[(n * 11) % WORLDS.length].music;
  return stageIn(n) === 20 ? "guardian" : worldOf(n).music;
};
const stageLabel = (n: number) => (n >= DAILY_BASE ? "Daily Vine" : n >= WILD_FROM ? `Wild ${n - CAMPAIGN}` : `World ${worldOf(n).n} · ${stageIn(n)}`);

function Btn({ children, onClick, tone = "sun", className = "", disabled, label, big }: { children: React.ReactNode; onClick?: () => void; tone?: "sun" | "glass" | "leaf" | "rose"; className?: string; disabled?: boolean; label?: string; big?: boolean }) {
  const tones = {
    sun: "bg-gradient-to-b from-[#FFE36A] to-[#FFB81E] text-[#3A2600] shadow-[0_6px_0_#B07A00,0_12px_26px_rgba(0,0,0,0.3)]",
    leaf: "bg-gradient-to-b from-[#9BEA6A] to-[#3FAE3A] text-[#08310A] shadow-[0_6px_0_#26762A,0_12px_26px_rgba(0,0,0,0.3)]",
    rose: "bg-gradient-to-b from-[#FFA08A] to-[#FF5A3A] text-white shadow-[0_6px_0_#B8361E,0_12px_26px_rgba(0,0,0,0.3)]",
    glass: "bg-white/18 text-white ring-1 ring-white/35 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.2)]",
  };
  return (
    <motion.button type="button" aria-label={label} whileTap={{ scale: 0.93, y: 3 }} disabled={disabled} onClick={() => { audio.play("a:click", { gain: 0.4, duck: false }); onClick?.(); }}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-2xl font-display tracking-wide disabled:opacity-40 ${big ? "px-9 py-4 text-2xl" : "px-4 py-2.5 text-base"} ${tones[tone]} ${className}`}>
      {children}
    </motion.button>
  );
}
function Panel({ title, onBack, children, right }: { title: string; onBack: () => void; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="absolute inset-0 z-10 flex flex-col bg-gradient-to-b from-[#0E3A1C]/55 via-[#0E3A1C]/30 to-[#0E3A1C]/80">
      <div className="flex items-center gap-3 px-4 pb-3 pt-[max(env(safe-area-inset-top),56px)]">
        <Btn tone="glass" onClick={onBack} label="Back"><ArrowLeft className="size-5" /></Btn>
        <div className="font-display text-2xl [text-shadow:0_2px_8px_rgba(0,0,0,0.35)]">{title}</div>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <div className="mx-auto min-h-0 w-full max-w-[560px] flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),20px)]">{children}</div>
    </motion.div>
  );
}
const Pill = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`inline-flex items-center gap-1 rounded-full bg-black/30 px-3 py-1 text-sm font-semibold backdrop-blur-md ${className}`}>{children}</div>;

/** a tiny SVG garden lizard for icons (tail full / dropped) */
function TailIcon({ full }: { full: boolean }) {
  return (
    <svg width="44" height="22" viewBox="0 0 44 22" aria-hidden>
      <path d={full ? "M2 11 C 6 6, 12 6, 16 9 C 22 12, 30 8, 42 13" : "M2 11 C 6 6, 12 6, 16 9 C 19 11, 21 11, 23 11"} fill="none" stroke={full ? "#9BEA6A" : "#E8A070"} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="7" cy="9.5" rx="5.5" ry="3.6" fill={full ? "#7ACB4A" : "#C8A070"} /><circle cx="5" cy="8.5" r="1.2" fill="#1A1A10" />
    </svg>
  );
}

export default function VineApp({ title }: { slug: string; title: string }) {
  const ready = useVineHydrated();
  const save = useVine();
  const coins = useProfile((p) => p.coins);
  const { setImmersive, setLoading, setInRound, setMenu, paused } = usePlayer();
  const [screen, setScreen] = useState<Screen>("title");
  const [titleEl, setTitleEl] = useState<HTMLDivElement | null>(null);
  const [gameEl, setGameEl] = useState<HTMLDivElement | null>(null);
  const [hud, setHud] = useState<VineHud | null>(null);
  const [cards, setCards] = useState<{ id: number; kind: "gate" | "world" | "guardian" | "tip" | "miss"; head: string; text?: string; sub?: string }[]>([]);
  const [fallen, setFallen] = useState<{ mid: boolean; tip: string } | null>(null);
  const [dailyDone, setDailyDone] = useState<{ coins: number; streak: number; first: boolean } | null>(null);
  const [settings, setSettings] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const sess = useRef<VineSession | null>(null), titleSess = useRef<VineSession | null>(null);
  const runN = useRef(save.stage);
  const quality = save.settings.quality === "auto" ? autoQuality() : save.settings.quality;
  const today = useMemo(() => dayNumber(), []);
  const season = useMemo(() => seasonOf(), []);
  const say = useCallback((text: string) => setToast({ id: Date.now() + Math.random(), text }), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast((x) => (x?.id === toast.id ? null : x)), 2200); return () => clearTimeout(t); }, [toast]);
  const card = useCallback((c: Omit<(typeof cards)[number], "id">, ms = 1600) => {
    const id = Date.now() + Math.random();
    setCards((cs) => [...cs.filter((x) => x.kind !== c.kind), { ...c, id }]);
    setTimeout(() => setCards((cs) => cs.filter((x) => x.id !== id)), ms);
  }, []);

  // ---------------------------------------------------------------- boot (once; the shell's setLoading changes identity)
  const loadRef = useRef(setLoading);
  useEffect(() => { loadRef.current = setLoading; }, [setLoading]);
  useEffect(() => {
    loadRef.current(0.25, "Growing the vines");
    void audio.preload([...UI_SOUNDS, ...VINE_SFX], [music("title")]);
    void audio.playMusic(music("title"));
  }, []);
  useEffect(() => { setImmersive(screen === "game" || screen === "daily"); setInRound(screen === "game" || screen === "daily"); }, [screen, setImmersive, setInRound]);
  useEffect(() => () => { setImmersive(false); setInRound(false); setMenu([]); }, [setImmersive, setInRound, setMenu]);
  useEffect(() => { sess.current?.pause(paused); titleSess.current?.pause(paused); }, [paused]);

  // ---------------------------------------------------------------- the title scene (also behind Book / Wardrobe / Shop)
  const showTitle = screen === "title" || screen === "book" || screen === "wardrobe" || screen === "shop";
  useEffect(() => {
    if (!showTitle || !titleEl || !ready) return;
    const n = Math.min(save.stage, CAMPAIGN);
    const s = new VineSession(titleEl, { quality: quality === "high" ? "medium" : quality, look: useVine.getState().look, n, mode: "title" });
    titleSess.current = s; loadRef.current(null);
    void audio.playMusic(music("title"));
    return () => { s.dispose(); titleSess.current = null; };
    // the look is applied live below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTitle, titleEl, ready, quality]);
  useEffect(() => { titleSess.current?.setLook(save.look); }, [save.look]);

  // ---------------------------------------------------------------- the climb
  const playing = screen === "game" || screen === "daily";
  const [runKey, setRunKey] = useState(0);
  useEffect(() => {
    if (!playing || !gameEl) return;
    const daily = screen === "daily";
    const n = daily ? DAILY_BASE + today : useVine.getState().stage;
    runN.current = n;
    const st = useVine.getState();
    const s = new VineSession(gameEl, {
      quality, look: st.look, n, mode: "climb", vibrate: st.settings.vibrate,
      next: daily ? undefined : nextStage, variant: wildVariant, sim: simOpts(st.up),
      onHud: (h) => {
        setHud(h);
        // first-time tips for flip, cling and leap
        const t = useVine.getState();
        if (!t.tips.flip && h.progress > 0.08) t.tip("flip");
        if (h.clingOn && !t.tips.cling) { t.tip("cling"); card({ kind: "tip", head: "HOLD TO CLING", text: "Hold the CLING pad (or Shift / ↓) to slow down and wait for a gap." }, 4200); }
        if (h.leapOn && !t.tips.leap) { t.tip("leap"); card({ kind: "tip", head: "LEAP!", text: "When the rings glow, press LEAP (or Enter) to jump the gap." }, 4200); }
      },
      onEvent: (e) => {
        if (e.t === "miss") { /* quiet */ }
        if (e.t === "tail") say("Tail dropped! Snap bugs to grow it back.");
        if (e.t === "regrow") say("Tail grown back!");
      },
      onStage: (r: StageResult, next) => {
        if (next < 0) {
          const d = useVine.getState().finishDaily(today);
          setDailyDone(d); audio.play("a:levelup", { gain: 0.7 });
          return;
        }
        const coinsGot = useVine.getState().gate(r.n, next, { bugs: r.bugs, gold: r.gold, best: r.best, crown: r.crown, rivalWon: r.rivalWon, kinds: r.kinds });
        const vs = useVine.getState();
        vs.progress("flips", r.flips); vs.progress("leaps", r.leaps); vs.progress("rush", r.rushes); vs.progress("smash", r.smashes);
        if (next >= WILD_FROM && next < DAILY_BASE) { const ses = sess.current; if (ses) useVine.getState().wildSeen(`${ses.st.def.world}|${[...ses.st.def.concepts].sort().join("+")}|${ses.st.def.guardian ?? ""}`); }
        runN.current = next;
        card({ kind: "gate", head: r.n >= WILD_FROM ? `Wild ${r.n - CAMPAIGN} ✓` : `Stage ${r.n} ✓`, text: `${r.bugs} bugs${r.gold ? ` · ${r.gold} golden` : ""}`, sub: `+${coinsGot} coins${r.crown ? " · Sun Seed!" : ""}${r.rivalWon ? " · beat Zeeza!" : ""}` }, 1500);
        void audio.playMusic(music(musicOf(next)));
        audio.prepareMusic(music(musicOf(nextStage(next))));
        const def = sess.current?.st.def;
        if (def?.guardian) setTimeout(() => card({ kind: "guardian", head: "GUARDIAN", text: GUARDIANS[def.guardian!].name, sub: "Reach the crown past it!" }, 2400), 600);
        else if (def) {
          const nc = def.concepts.find((c) => CONCEPTS[c]);
          if (def.k === 1 || def.kind === "gold" || def.kind === "long") setTimeout(() => card({ kind: "tip", head: def.kind === "long" ? "LONG VINE" : def.kind === "gold" ? "GOLD RUSH" : (CONCEPTS[nc ?? "classic"].name).toUpperCase(), text: def.kind === "long" ? "The moss halfway is a checkpoint." : CONCEPTS[nc ?? "classic"].tip }, 2600), 1300);
        }
      },
      onWorld: (w) => { const W = WORLDS[w]; card({ kind: "world", head: `WORLD ${W.n}`, text: W.name, sub: W.tip }, 3600); },
      onFall: () => { useVine.getState().fell(); const ses = sess.current; setFallen({ mid: !!(ses?.st.mid && ses.hud().mid), tip: CONCEPTS[ses?.st.def.concepts[0] ?? "classic"]?.tip ?? "" }); audio.play("a:whooshOut", { gain: 0.4, duck: false }); },
    });
    sess.current = s;
    const def = s.st.def;
    void audio.playMusic(music(musicOf(n)));
    audio.prepareMusic(music(musicOf(daily ? n : nextStage(n))));
    audio.warmMusic([music("guardian")]);
    // the first card: where you are
    const W = WORLDS[def.world];
    card({ kind: "world", head: daily ? `DAILY VINE · ${season.name.toUpperCase()}` : n >= WILD_FROM ? `WILD CANOPY · ${season.name.toUpperCase()}` : `WORLD ${W.n} · STAGE ${def.k}`, text: daily ? "Daily Vine" : n >= WILD_FROM ? `Wild ${n - CAMPAIGN}` : W.name, sub: def.guardian ? `Guardian: ${GUARDIANS[def.guardian].name}` : CONCEPTS[def.concepts[0]]?.tip }, 2800);
    if (!st.tips.flip) setTimeout(() => card({ kind: "tip", head: "TAP TO FLIP", text: "Tap anywhere — Tondu swings round the vine, away from the thorns." }, 4200), 2900);
    return () => { s.dispose(); sess.current = null; setHud(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, gameEl, runKey, quality]);

  useEffect(() => {
    if (!playing) { setMenu([]); return; }
    setMenu([{ id: "home", label: "Back to the title", icon: "🏠", onSelect: () => { setScreen("title"); setFallen(null); } }]);
  }, [playing, setMenu]);

  const retry = useCallback(() => { setFallen(null); sess.current?.retry(); }, []);
  const go = useCallback((s: Screen) => { audio.play("a:whooshIn", { gain: 0.35, duck: false }); setFallen(null); setDailyDone(null); setScreen(s); setRunKey((k) => k + 1); }, []);

  if (!ready) return <div className="absolute inset-0 bg-[#1E5A2A]" />;
  const leapGlow = !!hud?.canLeap;
  const W = worldOf(Math.min(save.stage, CAMPAIGN));
  const dailyCleared = save.daily.day === today && save.daily.cleared;
  const bookCount = BUGS.filter((_, i) => save.book[String(i)]).length;

  return (
    <div className="absolute inset-0 select-none overflow-hidden bg-[#1E5A2A] font-sans text-white" style={{ WebkitTapHighlightColor: "transparent", overscrollBehavior: "none" }}>
      {/* the 3D title scene */}
      {showTitle && <div ref={setTitleEl} className="absolute inset-0" />}
      {playing && <div ref={setGameEl} key={runKey} className="absolute inset-0" />}
      {/* cinematic vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(6,30,10,0.38)_100%)]" />

      <AnimatePresence mode="wait">
        {screen === "title" && (
          <motion.div key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-[#0E3A1C]/55 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-[#0E3A1C]/85 to-transparent" />
            <div className="absolute inset-x-0 top-0 flex flex-col items-center px-5 pt-[max(env(safe-area-inset-top),56px)] text-center [@media(max-height:520px)]:pt-2">
              <motion.div initial={{ y: -16, scale: 0.92 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }} className="font-display leading-[0.9] [text-shadow:0_4px_0_#2C7A22,0_8px_0_#174A12,0_14px_30px_rgba(0,0,0,0.45)]">
                <div className="text-[clamp(28px,8vw,46px)] text-[#FFE36A] [@media(max-height:520px)]:text-[26px]">Tondu&apos;s</div>
                <div className="text-[clamp(46px,14vw,88px)] text-white [@media(max-height:520px)]:text-[44px]">Vine Climb</div>
              </motion.div>
              <div className="mt-2 rounded-full bg-black/25 px-4 py-1 text-sm font-semibold backdrop-blur-md [@media(max-height:520px)]:hidden">A 3D garden-lizard climb · 30 green worlds · 600 stages + the Wild Canopy</div>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-5 pb-[max(env(safe-area-inset-bottom),20px)] [@media(max-height:520px)]:gap-2 [@media(max-height:520px)]:pb-2">
              <div className="flex w-full max-w-[440px] flex-col gap-1.5 rounded-2xl bg-black/25 p-2.5 text-sm backdrop-blur-md [@media(max-height:520px)]:hidden">
                {save.missions.map((m) => (
                  <div key={m.id} className="flex items-center gap-2"><Target className="size-4 shrink-0 text-[#FFE36A]" /><span className="flex-1 truncate font-semibold">{m.text}</span>
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#9BEA6A]" style={{ width: `${(m.got / m.goal) * 100}%` }} /></div>
                    <span className="inline-flex items-center gap-0.5 text-xs"><CoinIcon size={12} />{m.coins}</span></div>
                ))}
              </div>
              <Btn big tone="sun" onClick={() => go("game")} className="[@media(max-height:520px)]:!py-2.5 [@media(max-height:520px)]:!text-xl">
                <Play className="size-7 fill-current" /> {save.plays ? `CLIMB · ${stageLabel(save.stage)}` : "CLIMB"}
              </Btn>
              <div className="grid w-full max-w-[440px] grid-cols-4 gap-2 [@media(max-height:520px)]:max-w-[560px]">
                {([
                  ["daily", dailyCleared ? `Daily ✓ ${save.daily.streak}` : "Daily", <CalendarDays key="d" className="size-5" />],
                  ["book", `Bugs ${bookCount}/30`, <BookOpen key="b" className="size-5" />],
                  ["wardrobe", "Wardrobe", <Shirt key="w" className="size-5" />],
                  ["shop", "Shop", <ShoppingBag key="s" className="size-5" />],
                ] as [Screen, string, React.ReactNode][]).map(([s, label, icon]) => (
                  <Btn key={s} tone="glass" onClick={() => go(s)} className="flex-col !gap-0.5 !px-1 !py-2 text-[11px]">{icon}{label}</Btn>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold">
                <Pill><Sparkles className="size-4 text-[#FFE36A]" />{save.seeds} Sun Seeds</Pill>
                <Pill><CoinIcon size={15} />{coins}</Pill>
                <Pill className="text-xs">🌿 {save.stage > CAMPAIGN ? "Wild Canopy" : W.name}</Pill>
                <button type="button" aria-label="Settings" onClick={() => setSettings(true)} className="rounded-full bg-black/30 p-1.5 backdrop-blur-md"><Settings2 className="size-4" /></button>
              </div>
            </div>
          </motion.div>
        )}

        {screen === "book" && (
          <Panel key="book" title="Bug Book" onBack={() => go("title")} right={<Pill>{bookCount}/30</Pill>}>
            <div className="mb-3 rounded-2xl bg-black/30 p-3 text-sm font-semibold backdrop-blur-md">Every world has its own bug. Snap them to fill the book — and beat each world&apos;s guardian for its Sun Seed ({save.seeds}/30).</div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {BUGS.map((b, i) => {
                const n = save.book[String(i)] ?? 0;
                return (
                  <div key={b.name} className={`rounded-2xl p-3 shadow-lg backdrop-blur-md ${n ? "bg-white/90 text-[#123A16]" : "bg-black/30 text-white/70"}`}>
                    <div className="flex items-center gap-2">
                      <span className="grid size-9 place-items-center rounded-full text-lg" style={{ background: n ? `radial-gradient(circle at 35% 30%, #fff8, ${b.body})` : "#0004" }}>{n ? "🐞" : "?"}</span>
                      <div className="min-w-0"><div className="truncate font-display text-sm">{n ? b.name : "???"}</div><div className="text-[11px] opacity-70">World {i + 1}{n ? ` · ×${n}` : ""}</div></div>
                    </div>
                    {n > 0 && <div className="mt-1.5 text-[11px] leading-snug opacity-80">{b.fact}</div>}
                  </div>
                );
              })}
              <div className={`rounded-2xl p-3 shadow-lg ${save.book.gold ? "bg-[#FFE36A] text-[#3A2600]" : "bg-black/30"}`}><div className="font-display text-sm">Golden beetle</div><div className="text-[11px] opacity-80">×{save.book.gold ?? 0} — they&apos;re your coins</div></div>
            </div>
          </Panel>
        )}

        {screen === "wardrobe" && (
          <Panel key="wardrobe" title="Wardrobe" onBack={() => go("title")} right={<Pill><CoinIcon size={15} />{coins}</Pill>}>
            <div className="h-[34vh] min-h-[160px]" />
            {([["Colour morphs", Object.entries(SKINS).map(([id, s]) => ({ id, name: s.name, price: s.price })), "skin"], ["Hats", HATS, "hat"]] as const).map(([head, items, key]) => (
              <div key={key} className="mb-4">
                <div className="mb-2 font-display text-lg [text-shadow:0_2px_6px_rgba(0,0,0,0.4)]">{head}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.map((it) => {
                    const own = save.owned.includes(it.id) || it.price === 0, on = save.look[key] === it.id;
                    return (
                      <motion.button key={it.id} type="button" whileTap={{ scale: 0.95 }}
                        onClick={() => { audio.play("a:click", { gain: 0.4, duck: false }); if (own) useVine.getState().setLook({ [key]: it.id }); else if (useVine.getState().buy(it.id, it.price)) { useVine.getState().setLook({ [key]: it.id }); audio.play("a:coin", { gain: 0.6 }); say(`${it.name} is yours!`); } else say(`You need ${it.price} coins`); }}
                        className={`rounded-2xl p-3 text-left font-display shadow-lg ${on ? "bg-white text-[#123A16] ring-4 ring-[#FFE36A]" : "bg-white/85 text-[#123A16]"}`}>
                        <div className="text-base">{it.name}</div>
                        <div className="mt-0.5 text-sm opacity-70">{on ? "Wearing" : own ? "Tap to wear" : <span className="inline-flex items-center gap-1"><CoinIcon size={13} />{it.price}</span>}</div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </Panel>
        )}

        {screen === "shop" && (
          <Panel key="shop" title="Shop" onBack={() => go("title")} right={<Pill><CoinIcon size={15} />{coins}</Pill>}>
            <div className="mb-3 rounded-2xl bg-black/30 p-3 text-sm font-semibold backdrop-blur-md">Golden beetles and gates pay coins. Spend them on upgrades that last for every climb.</div>
            <div className="flex flex-col gap-2.5">
              {UPGRADES.map((u) => {
                const lv = save.up[u.id], maxed = lv >= u.max, price = UPGRADE_PRICE[lv];
                return (
                  <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-white/90 p-3 text-[#123A16] shadow-lg">
                    <Zap className="size-6 shrink-0 text-[#3FAE3A]" />
                    <div className="min-w-0 flex-1"><div className="font-display">{u.name}</div><div className="text-xs opacity-70">{u.text}</div>
                      <div className="mt-1 flex gap-1">{Array.from({ length: u.max }, (_, i) => <span key={i} className={`h-1.5 w-5 rounded-full ${i < lv ? "bg-[#3FAE3A]" : "bg-black/15"}`} />)}</div></div>
                    <Btn tone={maxed ? "glass" : "sun"} disabled={maxed} onClick={() => { if (useVine.getState().buyUp(u.id)) { audio.play("a:coin", { gain: 0.6 }); say(`${u.name} upgraded!`); } else say(`You need ${price} coins`); }} className={maxed ? "!text-[#123A16]" : ""}>
                      {maxed ? "MAX" : <span className="inline-flex items-center gap-1"><CoinIcon size={14} />{price}</span>}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------ the climb HUD */}
      {playing && hud && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1.5 px-3 pt-[max(env(safe-area-inset-top),58px)] [@media(max-height:520px)]:items-start [@media(max-height:520px)]:pt-2 [@media(max-height:520px)]:pl-3">
            <div className="flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-[13px] font-semibold backdrop-blur-md">
              <span className="font-display tracking-wide">{stageLabel(hud.n)}</span>
              <span className="opacity-60">·</span><span className="max-w-[34vw] truncate">{hud.name}</span>
            </div>
            {/* progress: a little vine to the flower gate */}
            <div className="relative h-3 w-[min(78vw,360px)] rounded-full bg-black/30 backdrop-blur-md [@media(max-height:520px)]:w-[220px]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#3FAE3A] to-[#9BEA6A]" style={{ width: `${hud.progress * 100}%` }} />
              {hud.kind === "long" || hud.kind === "crown" ? <span className={`absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${hud.mid ? "bg-[#9BEA6A]" : "bg-white/60"}`} /> : null}
              {hud.rival !== null && <span className="absolute -top-1 text-[11px]" style={{ left: `calc(${hud.rival * 100}% - 6px)` }}>🦎</span>}
              <span className="absolute -right-2 -top-2 text-base">🌸</span>
            </div>
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Pill className="!py-0.5">🐞 {hud.bugs}</Pill>
              {hud.gold > 0 && <Pill className="!py-0.5"><CoinIcon size={13} />{hud.gold}</Pill>}
              <Pill className="!px-1.5 !py-0"><TailIcon full={hud.tail} /></Pill>
              {hud.shield && <Pill className="!py-0.5">🌿 Shield</Pill>}
              {hud.egg && <Pill className="!py-0.5">🥚</Pill>}
              {hud.combo >= 5 && <motion.div key={hud.combo} initial={{ scale: 1.3 }} animate={{ scale: 1 }}><Pill className="!bg-[#FF8A3A]/80 !py-0.5">×{hud.combo}</Pill></motion.div>}
            </div>
            {hud.rush > 0 && <div className="h-2 w-40 overflow-hidden rounded-full bg-black/30"><div className="h-full bg-gradient-to-r from-[#FF7A2A] to-[#FFE04A]" style={{ width: `${Math.min(1, hud.rush / 4) * 100}%` }} /></div>}
            {hud.sun > 0.02 && hud.rush <= 0 && <Pill className="!py-0.5 text-xs">☀️ <span className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-white/25 align-middle"><span className="block h-full bg-[#FFC83A]" style={{ width: `${hud.sun * 100}%` }} /></span></Pill>}
            {hud.chase !== null && hud.chase < 6 && <Pill className="!bg-[#FF5A3A]/80 !py-0.5 text-xs">🐦‍⬛ Kaaki is close!</Pill>}
          </div>
          {/* pads */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
            {hud.clingOn ? (
              <div data-pad onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); sess.current?.setCling(true); }} onPointerUp={() => sess.current?.setCling(false)} onPointerCancel={() => sess.current?.setCling(false)} onPointerLeave={() => sess.current?.setCling(false)}
                className={`relative grid size-[88px] touch-none place-items-center rounded-full font-display text-sm shadow-xl ring-2 backdrop-blur-md transition [@media(max-height:520px)]:size-[72px] ${hud.clinging ? "scale-95 bg-[#9BEA6A]/80 text-[#08310A] ring-white" : "bg-black/30 ring-white/40"}`}>
                <span>CLING</span>
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88"><circle cx="44" cy="44" r="40" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" /><circle cx="44" cy="44" r="40" fill="none" stroke="#FFE36A" strokeWidth="5" strokeDasharray={`${hud.grip * 251} 251`} /></svg>
              </div>
            ) : <span />}
            {hud.leapOn ? (
              <motion.div data-pad animate={{ scale: leapGlow ? [1, 1.08, 1] : 1 }} transition={{ repeat: leapGlow ? Infinity : 0, duration: 0.5 }} onPointerDown={(e) => { e.stopPropagation(); sess.current?.leap(); }}
                className={`grid size-[88px] touch-none place-items-center rounded-full font-display text-sm shadow-xl ring-2 backdrop-blur-md [@media(max-height:520px)]:size-[72px] ${leapGlow ? "bg-[#FFE36A] text-[#3A2600] ring-white" : "bg-black/30 ring-white/40"}`}>
                LEAP
              </motion.div>
            ) : <span />}
          </div>
        </>
      )}

      {/* cards over the climb (they never stop it) */}
      <div className="pointer-events-none absolute inset-x-0 top-[24%] z-20 flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {playing && cards.map((c) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`w-fit max-w-[min(90vw,420px)] rounded-3xl px-5 py-3 text-center shadow-2xl backdrop-blur-md ${c.kind === "gate" ? "bg-[#FFF8E0]/92 text-[#2A3A10]" : c.kind === "guardian" ? "bg-[#3A1A10]/85 text-white" : c.kind === "world" ? "bg-[#0E3A1C]/80 text-white" : "bg-white/90 text-[#123A16]"}`}>
              <div className={`font-display text-xs tracking-[0.2em] ${c.kind === "guardian" ? "text-[#FF9A6A]" : c.kind === "world" ? "text-[#FFE36A]" : "text-[#3FAE3A]"}`}>{c.head}</div>
              {c.text && <div className="font-display text-2xl leading-tight">{c.text}</div>}
              {c.sub && <div className="mt-0.5 text-sm font-semibold opacity-85">{c.sub}</div>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* the fall */}
      <AnimatePresence>
        {playing && fallen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={retry} className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#0E3A1C]/45 backdrop-blur-[2px]">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="rounded-3xl bg-[#FFF8E0] px-7 py-5 text-center text-[#2A3A10] shadow-2xl">
              <div className="font-display text-3xl">Tondu fell!</div>
              <div className="mt-1 text-sm font-semibold opacity-80">{fallen.mid ? "Back to the moss checkpoint." : "Back to the flower gate — the vine is waiting."}</div>
            </motion.div>
            <Btn big tone="leaf" onClick={retry}><Play className="size-6 fill-current" /> Climb again</Btn>
            {fallen.tip && <div className="text-xs font-semibold opacity-80">Tip: {fallen.tip}</div>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* the Daily Vine result */}
      <AnimatePresence>
        {screen === "daily" && dailyDone && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-30 flex items-end justify-center bg-black/35 sm:items-center">
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} className="w-full max-w-[440px] rounded-t-[30px] bg-[#FFF8E0] px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-5 text-center text-[#2A3A10] sm:rounded-[30px]">
              <div className="font-display text-sm tracking-[0.2em] text-[#3FAE3A]">DAILY VINE · {season.name.toUpperCase()}</div>
              <div className="font-display text-4xl">Cleared!</div>
              <div className="my-2 text-lg font-semibold">{dailyDone.first ? <>🔥 Streak {dailyDone.streak} · <span className="inline-flex items-center gap-1"><CoinIcon size={16} />+{dailyDone.coins}</span></> : "Today's reward is already yours."}</div>
              <div className="mb-3 text-sm opacity-75">A new vine grows tomorrow.</div>
              <Btn tone="sun" onClick={() => go("title")} className="w-full">Done</Btn>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-end justify-center bg-black/45 sm:items-center" onClick={() => setSettings(false)}>
            <motion.div initial={{ y: 220 }} animate={{ y: 0 }} exit={{ y: 220 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[460px] rounded-t-[28px] bg-[#FFF8E0] px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4 text-[#123A16] sm:rounded-[28px]">
              <div className="mb-3 flex items-center"><div className="font-display text-2xl">Settings</div><button type="button" aria-label="Close" onClick={() => setSettings(false)} className="ml-auto rounded-full bg-black/5 p-2"><X className="size-5" /></button></div>
              <div className="mb-2 text-sm font-semibold opacity-70">Graphics</div>
              <div className="mb-4 grid grid-cols-4 gap-2">{(["auto", "low", "medium", "high"] as const).map((q) => <button key={q} type="button" onClick={() => useVine.getState().setSettings({ quality: q })} className={`rounded-xl py-2 font-display text-sm capitalize ${save.settings.quality === q ? "bg-[#3FAE3A] text-white" : "bg-black/5"}`}>{q}</button>)}</div>
              <label className="mb-3 flex items-center justify-between rounded-xl bg-black/5 px-3 py-2.5 font-semibold">Vibration <input type="checkbox" className="size-5 accent-[#3FAE3A]" checked={save.settings.vibrate} onChange={(e) => useVine.getState().setSettings({ vibrate: e.target.checked })} /></label>
              <div className="rounded-xl bg-[#3FAE3A]/10 px-3 py-2.5 text-sm font-semibold">Tap anywhere to flip round the vine. Hold CLING to slow down. Press LEAP when the rings glow. Keys: Space / ↑ / ← / → flip · Shift / ↓ cling · Enter leap. This week: {season.name}.</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <motion.div key={toast.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),58px)+96px)] z-40 mx-auto w-fit max-w-[90vw] rounded-full bg-[#0E2A12]/85 px-4 py-2 text-center text-sm font-semibold shadow-xl">{toast.text}</motion.div>}
      </AnimatePresence>
      <h1 className="sr-only">{title}</h1>
    </div>
  );
}
