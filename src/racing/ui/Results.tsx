"use client";
// Results: headline + animated stars, podium (or the solo score card), reward count-up with a breakdown,
// race stats, the full standings, and celebrations for a newly unlocked car / world. Actions sit at the
// bottom: NEXT EVENT / RETRY / GARAGE / MENU.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Home, RotateCcw, Settings2, Star, Wrench } from "lucide-react";
import { AppBar, Btn, MODE_SHORT, fmt, isHighway, isMoto, isStreet, ord, pts, sfx, useCountUp, useViewport, vibrate } from "./kit";
import { Showroom } from "./Showroom";
import { MODE_INFO, type CareerLevel } from "../levels";
import { getCar, getTheme } from "../games";
import type { RaceConfig, RaceResult, RacerView } from "../types";
import { CoinIcon } from "@/components/brand/CoinPill";
import { cdn } from "@/lib/cdn";

export interface ResultInfo { r: RaceResult; unlocked: string[]; newBest: boolean; bestLap: boolean; level?: CareerLevel; newWorld?: string | null; prevStars: number }

interface Props {
  res: ResultInfo; cfg: RaceConfig; hasNext: boolean; vibrateOn: boolean; units: "kmh" | "mph";
  onNext: () => void; onRetry: () => void; onGarage: (carId?: string) => void; onMenu: () => void; onSetup: () => void;
}

function Podium({ st }: { st: RacerView[] }) {
  const top = [st[1], st[0], st[2]];
  const H = [64, 92, 46];
  return (
    <div className="flex items-end justify-center gap-1.5 px-2">
      {top.map((r, i) => r ? (
        <motion.div key={r.id} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 + [0.2, 0, 0.35][i], type: "spring", stiffness: 260, damping: 20 }} className="flex w-[30%] max-w-[120px] flex-col items-center">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cdn(r.avatar)} alt="" className={`object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)] ${i === 1 ? "size-16" : "size-12"}`} />
            {r.isPlayer && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[#FFD25A] px-1.5 font-display text-[10px] text-[#2a1600]">YOU</span>}
          </div>
          <p className={`w-full truncate text-center font-display text-[13px] ${r.isPlayer ? "text-[#FFD25A]" : ""}`}>{r.name}</p>
          <div className={`mt-0.5 grid w-full place-items-start justify-center rounded-t-xl pt-1 font-display text-2xl shadow-[inset_0_2px_0_rgba(255,255,255,0.35)] ${i === 1 ? "bg-[linear-gradient(180deg,#FFE680,#E0A21A)] text-[#4a2a00]" : i === 0 ? "bg-[linear-gradient(180deg,#F0F4FA,#9AA6B8)] text-[#2a3240]" : "bg-[linear-gradient(180deg,#F2B27A,#B0662E)] text-[#3a1a00]"} ${r.isPlayer ? "ring-2 ring-[#FFD25A]" : ""}`} style={{ height: H[i] }}>
            {[2, 1, 3][i]}
          </div>
        </motion.div>
      ) : <div key={i} className="w-[30%]" />)}
    </div>
  );
}

export function Results({ res, cfg, hasNext, vibrateOn, units, onNext, onRetry, onGarage, onMenu, onSetup }: Props) {
  const vp = useViewport();
  const land = !vp.portrait;
  const r = res.r;
  const theme = getTheme(cfg.themeId);
  const solo = cfg.mode === "coinrush" || cfg.mode === "timetrial" || cfg.mode === "drift" || cfg.mode === "rally" || cfg.mode === "heat" || cfg.mode === "escape" || cfg.mode === "takedown" || cfg.mode === "wheelie";
  const battle = cfg.mode === "battle";
  const won = r.stars > 0 && r.pos === 1 && !solo;
  const headline = cfg.mode === "escape" ? (r.stars > 0 ? "ESCAPED!" : r.damage != null && r.damage >= 100 ? "WRECKED!" : "BUSTED!")
    : cfg.mode === "takedown" ? (r.suspects && r.suspects[0] === r.suspects[1] ? "ALL BUSTED!" : "THEY GOT AWAY!")
    : cfg.mode === "wheelie" ? (r.stars > 0 ? "WHEELIE KING!" : "TRY AGAIN!")
    : cfg.mode === "heat" ? (r.busted ? (r.stars > 0 ? "BUSTED — NICE RUN!" : "BUSTED!") : r.stars > 0 ? "HEAT RUN!" : "TRY AGAIN!")
    : r.stars === 0 ? (cfg.mode === "elimination" ? "KNOCKED OUT!" : cfg.mode === "coinrush" ? "OUT OF TIME!" : "TRY AGAIN!")
    : won ? (cfg.mode === "duel" ? "BOSS BEATEN!" : battle ? "BATTLE WON!" : "VICTORY!")
    : solo ? (cfg.mode === "coinrush" ? "COIN RUSH!" : cfg.mode === "drift" ? "DRIFT ATTACK!" : cfg.mode === "rally" ? "STAGE CLEAR!" : "FINISHED!")
    : battle ? "CLOSE BATTLE!" : `${r.pos}${ord(r.pos).toUpperCase()} PLACE!`;
  const reward = useCountUp(r.reward, 1.3, 1.25, () => sfx("a:coin", 0.18, 1.2));
  const breakdown = useMemo(() => {
    const starB = r.stars * 25, coinB = r.coins, tdB = r.takedowns * 10, drB = Math.round((r.driftPoints ?? 0) / 100);
    return [["Finish", Math.max(0, r.reward - starB - coinB - tdB - drB)], ["Stars", starB], ["Coins", coinB], ["Drift", drB], ["Takedowns", tdB]].filter(([, v]) => (v as number) > 0) as [string, number][];
  }, [r]);
  const [celebrate, setCelebrate] = useState<"car" | "world" | null>(null);
  const [shownCar, setShownCar] = useState(false);
  const [shownWorld, setShownWorld] = useState(false);
  const speed = (kmh: number) => units === "mph" ? `${Math.round(kmh * 0.621)} mph` : `${Math.round(kmh)} km/h`;

  useEffect(() => {
    sfx(r.stars > 0 ? (won ? "a:cheer" : "a:applause") : "a:fail", 0.4, 1, 0.15);
    vibrate(vibrateOn, r.stars > 0 ? [60, 60, 120] : 200);
    const t = setTimeout(() => { if (res.unlocked.length) show("car"); else if (res.newWorld) show("world"); }, 2900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function show(k: "car" | "world") { setCelebrate(k); sfx("tada", 0.5); sfx("confetti", 0.4, 1, 0.1); vibrate(vibrateOn, [40, 40, 80]); }
  const closeCelebrate = () => {
    if (celebrate === "car") { setShownCar(true); if (res.newWorld && !shownWorld) { show("world"); return; } }
    if (celebrate === "world") setShownWorld(true);
    setCelebrate(null);
  };
  void shownCar;

  const banner = (
    <div className="relative flex flex-col items-center overflow-hidden pt-1 pb-1">
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 opacity-40" style={{ background: isStreet() ? `radial-gradient(closest-side, ${r.stars > 0 ? "#FF1F7A" : "#2EF2FF"}40, transparent)` : `repeating-conic-gradient(from 0deg, ${r.stars > 0 ? "#FFD25A" : "#7C3AED"}33 0deg 8deg, transparent 8deg 22deg)`, animation: isStreet() ? "nr-neon 4s linear infinite" : "nr-spin 30s linear infinite", maskImage: "radial-gradient(circle, black 20%, transparent 65%)", WebkitMaskImage: "radial-gradient(circle, black 20%, transparent 65%)" }} />
      <motion.p initial={{ scale: 2.2, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: -3 }} transition={{ type: "spring", stiffness: 300, damping: 16 }}
        className="nr-italic relative font-display text-[clamp(2.2rem,11vw,4.2rem)] leading-none"
        style={isMoto()
          ? { color: "#F5F5F7", textShadow: "0.06em 0.06em 0 #E10600, 0.1em 0.1em 0 #000", textTransform: "uppercase" }
          : isHighway()
          ? { color: r.stars > 0 ? "#FFC600" : "#FF5A6E", textShadow: "0 5px 0 #111, 0 0 26px rgba(255,160,40,0.4)", WebkitTextStroke: "1.5px #111", fontStyle: "italic" }
          : isStreet()
          ? { color: "#fff", textShadow: `-3px 0 0 #FF1F7A, 3px 0 0 #2EF2FF, 0 5px 0 #000, 0 0 26px ${r.stars > 0 ? "rgba(255,31,122,0.55)" : "rgba(46,242,255,0.45)"}`, textTransform: "uppercase" }
          : { color: r.stars > 0 ? "#FFD25A" : "#FF8FD8", textShadow: "0 5px 0 #1a0838, 0 0 30px rgba(255,180,40,0.35)", WebkitTextStroke: "1.5px #1a0838" }}>
        {headline}
      </motion.p>
      <div className="relative mt-1.5 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} initial={{ scale: 0, rotate: -90 }} animate={{ scale: i < r.stars ? 1 : 0.75, rotate: 0 }} transition={{ delay: 0.45 + i * 0.28, type: "spring", stiffness: 420, damping: 13 }}
            onAnimationStart={() => { if (i < r.stars) sfx("a:ding", 0.45, 1 + i * 0.14, 0.45 + i * 0.28); }}>
            <Star className={`${i === 1 ? "size-14" : "size-11"} ${i < r.stars ? "fill-[#FFD25A] text-[#FFB000] drop-shadow-[0_0_14px_rgba(255,210,90,0.85)]" : "fill-black/40 text-white/20"}`} />
          </motion.span>
        ))}
      </div>
      {res.prevStars > 0 && r.stars > res.prevStars && <p className="relative mt-1 font-display text-xs text-[#5CE39A]">+{r.stars - res.prevStars} new star{r.stars - res.prevStars > 1 ? "s" : ""}!</p>}
    </div>
  );

  const soloCard = (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="mx-auto flex w-full max-w-sm items-center justify-around rounded-3xl bg-black/30 p-3 ring-1 ring-white/10">
      {cfg.mode === "wheelie" ? (
        <>
          <div className="text-center"><p className="font-display text-4xl text-[#FFD400] tabular-nums">{pts(r.score ?? 0)}</p><p className="text-[11px] font-bold tracking-widest text-white/55 uppercase">wheelie points</p></div>
          {r.targets && <div className="text-center text-[12px] text-white/70">{r.targets.map((c, i) => <p key={i} className={(r.score ?? 0) >= c ? "text-[#FFD400]" : ""}>{"★".repeat(i + 1)} {pts(c)}</p>)}</div>}
        </>
      ) : cfg.mode === "heat" ? (
        <>
          <div className="text-center"><p className="font-display text-4xl text-[#FFC600] tabular-nums">{pts(r.score ?? 0)}</p><p className="text-[11px] font-bold tracking-widest text-white/55 uppercase">heat score</p></div>
          {r.targets && <div className="text-center text-[12px] text-white/70">{r.targets.map((c, i) => <p key={i} className={(r.score ?? 0) >= c ? "text-[#FFC600]" : ""}>{"★".repeat(i + 1)} {pts(c)}</p>)}</div>}
        </>
      ) : cfg.mode === "escape" ? (
        <div className="text-center"><p className={`font-display text-4xl tabular-nums ${r.stars > 0 ? "text-[#2FD47A]" : "text-[#FF5A6E]"}`}>{r.damage ?? 0}%</p><p className="text-[11px] font-bold tracking-widest text-white/55 uppercase">damage taken</p></div>
      ) : cfg.mode === "takedown" ? (
        <div className="text-center"><p className="font-display text-4xl tabular-nums text-[#2A6BFF]">{r.suspects ? `${r.suspects[0]}/${r.suspects[1]}` : "0"}</p><p className="text-[11px] font-bold tracking-widest text-white/55 uppercase">suspects busted</p></div>
      ) : cfg.mode === "drift" ? (
        <>
          <div className="text-center"><p className="nr-italic font-display text-4xl text-[#FF9BE8] tabular-nums drop-shadow-[0_0_14px_rgba(255,79,216,0.5)]">{pts(r.driftPoints ?? 0)}</p><p className="text-[11px] font-bold tracking-widest text-white/55 uppercase">drift points</p></div>
          {r.targets && <div className="text-center text-[12px] text-white/70">{r.targets.map((c, i) => <p key={i} className={(r.driftPoints ?? 0) >= c ? "text-[#FFD25A]" : ""}>{"★".repeat(i + 1)} {pts(c)}</p>)}</div>}
        </>
      ) : cfg.mode === "coinrush" ? (
        <>
          <div className="text-center"><p className="font-display text-4xl text-[#FFD25A]"><CoinIcon size={32} className="mr-1.5 align-[-3px]" />{r.coins}</p><p className="text-[11px] font-bold tracking-widest text-white/55 uppercase">coins grabbed</p></div>
          {(r.targets ?? cfg.coinTarget) && <div className="text-center text-[12px] text-white/70">{(r.targets ?? cfg.coinTarget)!.map((c, i) => <p key={i} className={r.coins >= c ? "text-[#FFD25A]" : ""}>{"★".repeat(i + 1)} {c}</p>)}</div>}
        </>
      ) : (
        <div className="text-center"><p className="font-display text-4xl tabular-nums">{fmt(r.time)}</p><p className="text-[11px] font-bold tracking-widest text-white/55 uppercase">total time</p></div>
      )}
    </motion.div>
  );

  const rewardCard = (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.1 }} className={`p-3 ${isStreet() ? "rounded-lg bg-[linear-gradient(110deg,#17171f,#0a0a0f)] shadow-[inset_0_0_0_1.5px_#FF1F7A]" : isHighway() ? "rounded-xl bg-[#0B6E4F] shadow-[inset_0_0_0_3px_#0B6E4F,inset_0_0_0_5.5px_#fff]" : isMoto() ? "nr-carbon rounded-[6px] shadow-[inset_8px_0_0_#E10600,inset_0_0_0_1.5px_rgba(255,255,255,0.18)]" : "rounded-3xl bg-[linear-gradient(110deg,#3a2470,#1a0f38)] ring-1 ring-[#FFD25A]/30"}`}>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold tracking-widest text-white/60 uppercase">Reward</span>
        <span className="ml-auto font-display text-3xl text-[#FFD25A] tabular-nums drop-shadow-[0_0_12px_rgba(255,210,90,0.5)]">+{reward} <CoinIcon size={26} className="align-[-3px]" /></span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {breakdown.map(([k, v]) => <span key={k} className="rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-bold text-white/75">{k} +{v}</span>)}
        {res.newBest && <span className="rounded-full bg-[#2FD47A] px-2 py-0.5 font-display text-[11px] text-[#03230f]">NEW BEST TIME!</span>}
        {res.bestLap && <span className="rounded-full bg-[#7CF2FF] px-2 py-0.5 font-display text-[11px] text-[#06122e]">TRACK RECORD LAP!</span>}
      </div>
    </motion.div>
  );

  const stats = (
    <div className="nr-scroll -mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5">
      {([
        !solo && ["Position", `${r.pos}/${r.racers}`], ["Time", fmt(r.time)], r.bestLap > 0 && ["Best lap", fmt(r.bestLap)], ["Top speed", speed(r.topSpeed)],
        r.driftPoints != null ? ["Drift pts", pts(r.driftPoints)] : r.driftScore > 0 && ["Drift", r.driftScore.toLocaleString()], (r.bestChain ?? 0) > 0 && ["Best chain", pts(r.bestChain ?? 0)], r.takedowns > 0 && ["Takedowns", String(r.takedowns)], cfg.mode !== "coinrush" && r.coins > 0 && ["Coins", String(r.coins)],
      ].filter(Boolean) as [string, string][]).map(([k, v]) => (
        <div key={k} className="min-w-[84px] shrink-0 rounded-2xl bg-black/30 px-2.5 py-1.5 ring-1 ring-white/10"><p className="text-[10px] font-bold tracking-widest text-white/50 uppercase">{k}</p><p className="font-display text-[17px] tabular-nums">{v}</p></div>
      ))}
    </div>
  );

  const standings = r.standings.length > 1 && (
    <div className="flex flex-col gap-1">
      {r.standings.map((x) => (
        <div key={x.id} className={`flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm ${x.isPlayer ? "bg-[#FFD25A] text-[#2a1600]" : "bg-white/[0.05]"} ${x.out ? "opacity-55" : ""}`}>
          <span className="w-6 text-center font-display">{x.pos}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cdn(x.avatar)} alt="" className="size-7 object-contain" />
          <span className="min-w-0 flex-1 truncate font-semibold">{x.name}</span>
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: x.color }} />
          <span className="w-16 text-right font-display text-xs tabular-nums opacity-75">{x.out ? "OUT" : x.finished ? fmt(x.time * 1000) : "DNF"}</span>
        </div>
      ))}
    </div>
  );

  const hasCareerNext = !!res.level && r.stars > 0 && hasNext;
  const actions = (
    <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
      <Btn tone="ghost" className="w-12 shrink-0 !px-0" label="Menu" onClick={onMenu}><Home className="size-5" /></Btn>
      <Btn tone="ghost" className="w-12 shrink-0 !px-0" label="Garage" onClick={() => onGarage()}><Wrench className="size-5" /></Btn>
      {!res.level && <Btn tone="ghost" className="w-12 shrink-0 !px-0" label="Change setup" onClick={onSetup}><Settings2 className="size-5" /></Btn>}
      {hasCareerNext ? (
        <>
          <Btn tone="blue" className="flex-1" onClick={onRetry}><RotateCcw className="size-5" />RETRY</Btn>
          <Btn tone="gold" size="lg" className="flex-[1.4]" sound="a:whooshIn" onClick={onNext}>NEXT EVENT<ChevronRight className="size-5" /></Btn>
        </>
      ) : (
        <Btn tone="gold" size="lg" className="flex-1" sound="a:whooshIn" onClick={onRetry}><RotateCcw className="size-5" />{res.level ? "RETRY" : "RACE AGAIN"}</Btn>
      )}
    </div>
  );

  const sub = res.level ? `${theme.emoji} ${theme.name} · ${MODE_SHORT[res.level.mode]}` : `${theme.emoji} ${theme.name} · ${MODE_INFO[cfg.mode].label}`;
  const battleCard = battle && (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="mx-auto flex w-full max-w-sm items-stretch gap-2">
      {[["YOU", r.driftPoints ?? 0, true], [r.rivalName ?? "Rival", r.rivalPoints ?? 0, false]].map(([name, v, me]) => {
        const best = (v as number) >= Math.max(r.driftPoints ?? 0, r.rivalPoints ?? 0);
        return (
          <div key={String(name)} className={`flex-1 rounded-3xl p-3 text-center ring-2 ${best ? "bg-[linear-gradient(160deg,#FFD25A33,#1a0f38)] ring-[#FFD25A]" : "bg-black/30 ring-white/10"}`}>
            <p className={`font-display text-sm ${me ? "text-[#FFD25A]" : "text-white/80"}`}>{name as string}{best && " 👑"}</p>
            <p className="nr-italic font-display text-3xl tabular-nums">{pts(v as number)}</p>
            <p className="text-[10px] font-bold tracking-widest text-white/50 uppercase">drift points</p>
          </div>
        );
      })}
    </motion.div>
  );
  const top = battle ? battleCard : solo || r.standings.length < 2 ? soloCard : <Podium st={r.standings} />;
  const pad = { paddingLeft: "calc(var(--safe-left, 0px) + 0.75rem)", paddingRight: "calc(var(--safe-right, 0px) + 0.75rem)" };

  return (
    <div className="absolute inset-0 flex flex-col">
      <AppBar title="Results" sub={sub} onBack={onMenu} />
      {land ? (
        <div className="flex min-h-0 flex-1 gap-3 pt-1" style={pad}>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">{banner}{top}</div>
          <div className="nr-scroll flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto py-1">{rewardCard}{stats}{standings}</div>
        </div>
      ) : (
        <div className="nr-scroll mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-2.5 overflow-y-auto pt-1 pb-2" style={pad}>{banner}{top}{rewardCard}{stats}{standings}</div>
      )}
      <div className="shrink-0 pt-2" style={{ ...pad, paddingBottom: "calc(var(--safe-bottom) + 0.7rem)" }}>{actions}</div>

      {/* celebrations */}
      <AnimatePresence>
        {celebrate && (
          <motion.div key={celebrate} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-[#05020c]/85 px-4 backdrop-blur-md">
            <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 opacity-50" style={{ background: "repeating-conic-gradient(from 0deg, #FFD25A44 0deg 7deg, transparent 7deg 18deg)", animation: "nr-spin 24s linear infinite", maskImage: "radial-gradient(circle, black 15%, transparent 60%)", WebkitMaskImage: "radial-gradient(circle, black 15%, transparent 60%)" }} />
            {celebrate === "car" ? (() => {
              const c = getCar(res.unlocked[0]);
              return (
                <>
                  <motion.p initial={{ scale: 0.4, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 14 }} className="nr-italic relative text-center font-display text-[clamp(1.8rem,8vw,3.2rem)] leading-none text-[#FFD25A]" style={{ textShadow: "0 4px 0 #1a0838" }}>NEW CAR UNLOCKED!</motion.p>
                  <div className="relative my-2 h-[min(38vh,300px)] w-full max-w-xl"><Showroom spec={c} color={c.colors[0]} view="hero" className="absolute inset-0" /></div>
                  <p className="relative font-display text-2xl">{c.name}</p>
                  <p className="relative text-sm text-white/65">{c.cls} · Tier {c.tier}{res.unlocked.length > 1 ? ` · +${res.unlocked.length - 1} more` : ""}</p>
                  <div className="relative mt-4 flex w-full max-w-sm gap-2">
                    <Btn tone="ghost" className="flex-1" onClick={closeCelebrate}>LATER</Btn>
                    <Btn tone="gold" className="flex-[1.5]" onClick={() => onGarage(c.id)}>SEE IN GARAGE</Btn>
                  </div>
                </>
              );
            })() : (() => {
              const w = getTheme(res.newWorld ?? "");
              return (
                <>
                  <motion.p initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 12 }} className="relative text-[96px] leading-none">{w.emoji}</motion.p>
                  <p className="nr-italic relative mt-2 text-center font-display text-[clamp(1.6rem,7vw,2.8rem)] leading-none text-[#7CF2FF]" style={{ textShadow: "0 4px 0 #1a0838" }}>NEW WORLD OPEN!</p>
                  <p className="relative mt-1 font-display text-2xl">{w.name}</p>
                  <p className="relative max-w-sm text-center text-sm text-white/65">{w.blurb}</p>
                  <Btn tone="gold" className="relative mt-4 w-full max-w-xs" onClick={closeCelebrate}>AWESOME!</Btn>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
