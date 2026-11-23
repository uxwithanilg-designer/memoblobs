"use client";
// Orbi GP's other screens, phone first: the Modes menu (Endless Sky Run, Daily Cup, Time Trial, Knockout Royale, Boss
// Rush), the Dex of all 500 ideas (the ones you've met lit up, tap one to read it) and the Marbles collection (buy with
// coins, tap to race with it). Each is a full-screen sheet with a back button, like the road map.
import { memo, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Lock, Play } from "lucide-react";
import { CONCEPTS, FAMILY_ORDER, FAMILY_TITLE, type Family } from "../data/concepts";
import { JOURNEY, STAGES_PER_WORLD } from "../data/worlds";
import { conceptAt, isExact, MECH_LABEL, mechOf } from "../gen";
import type { Best, Daily, Trial } from "../save";
import { SKINS, skinPrice } from "../three/tex";

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

export function Panel({ title, onBack, right, children, bg }: { title: string; onBack: () => void; right?: ReactNode; children: ReactNode; bg?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="absolute inset-0 z-30 flex flex-col" style={{ background: bg ?? "linear-gradient(180deg,#5AB4F5,#CFEBFF 60%,#F4FAFF)" }}>
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onBack} aria-label="Back" className="grid size-11 place-items-center rounded-2xl bg-white/85 text-[#1A2A5A] shadow-[0_4px_0_rgba(0,0,0,0.15)] active:translate-y-0.5"><ChevronLeft className="size-6" /></button>
        <h2 className="min-w-0 flex-1 truncate font-display text-2xl text-white drop-shadow-[0_3px_0_rgba(20,40,90,0.35)]">{title}</h2>
      </div>
      {right && <div className="flex shrink-0 justify-center px-3 pb-2">{right}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>{children}</div>
    </motion.div>
  );
}

// ---------------------------------------------------------------- modes
export type ModeKind = "endless" | "daily" | "trial" | "royale" | "bossrush";
function ModeCard({ emoji, title, line, stat, grad, locked, onClick }: { emoji: string; title: string; line: string; stat?: string; grad: string; locked?: string; onClick: () => void }) {
  return (
    <button type="button" disabled={!!locked} onClick={onClick} className="flex w-full items-center gap-3 rounded-3xl p-3 text-left text-white shadow-[0_6px_0_rgba(20,40,90,0.25)] transition active:translate-y-1 disabled:opacity-60" style={{ background: grad }}>
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/25 text-4xl">{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl leading-tight">{title}</span>
        <span className="block text-[13px] leading-snug font-semibold opacity-90">{locked ?? line}</span>
        {stat && !locked && <span className="mt-0.5 inline-block rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-bold">{stat}</span>}
      </span>
      {locked ? <Lock className="size-5 opacity-80" /> : <Play className="size-6 fill-white" />}
    </button>
  );
}
export function ModesPanel({ stage, best, daily, endless, royale, trials, onPick, onBack }: {
  stage: number; best: Record<string, Best>; daily: Daily; endless: number; royale: { wins: number; played: number }; trials: Record<string, Trial>;
  onPick: (k: ModeKind, n?: number) => void; onBack: () => void;
}) {
  const [pickTrial, setPickTrial] = useState(false);
  const cleared = useMemo(() => Object.keys(best).map(Number).filter((n) => n <= stage).sort((a, b) => b - a), [best, stage]);
  const bosses = cleared.filter((n) => n <= JOURNEY && n % STAGES_PER_WORLD === 0).length;
  const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, dd = daily.day === today ? daily : null;
  return (
    <Panel title={pickTrial ? "Time Trial" : "Modes"} onBack={pickTrial ? () => setPickTrial(false) : onBack}>
      {!pickTrial ? (
        <div className="mx-auto flex max-w-md flex-col gap-3 pt-1">
          <ModeCard emoji="♾️" title="Endless Sky Run" line="One run that never ends — course after course, 3 lives. How far can you roll?" stat={endless ? `Best ${endless.toLocaleString()} m` : undefined} grad="linear-gradient(135deg,#7A4AE8,#FF5AB8)" onClick={() => onPick("endless")} />
          <ModeCard emoji="📅" title="Daily Cup" line="Three races, the same for everybody today. Points for every place." stat={dd ? (dd.race >= 3 ? `Done today · ${dd.pts} pts · 🔥 ${daily.streak}` : `Race ${dd.race + 1}/3 · ${dd.pts} pts`) : daily.streak ? `🔥 Streak ${daily.streak}` : undefined} grad="linear-gradient(135deg,#FF9A2E,#FF5A7A)" onClick={() => onPick("daily")} />
          <ModeCard emoji="👻" title="Time Trial" line="Race your own ghost on any stage you've cleared." stat={Object.keys(trials).length ? `${Object.keys(trials).length} ghosts saved` : undefined} grad="linear-gradient(135deg,#1E9CD8,#5CF2C9)" locked={cleared.length ? undefined : "Clear a stage first"} onClick={() => setPickTrial(true)} />
          <ModeCard emoji="🥊" title="Knockout Royale" line="16 marbles, 3 rounds, the floor falls away. Top half goes through." stat={royale.played ? `🏆 ${royale.wins} wins · ${royale.played} played` : undefined} grad="linear-gradient(135deg,#E8344A,#7A1A3A)" locked={stage > 10 ? undefined : "Unlocks at stage 10"} onClick={() => onPick("royale")} />
          <ModeCard emoji="👑" title="Boss Rush" line="Every Kranky machine you've beaten, back to back." stat={bosses ? `${bosses} bosses` : undefined} grad="linear-gradient(135deg,#30343E,#7A4AE8)" locked={bosses ? undefined : "Beat a boss (stage 20) first"} onClick={() => onPick("bossrush")} />
        </div>
      ) : (
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2 pt-1">
          {cleared.slice(0, 120).map((n) => (
            <button key={n} type="button" onClick={() => onPick("trial", n)} className="rounded-2xl bg-white/90 p-2 text-center text-[#1A2A5A] shadow-[0_4px_0_rgba(20,40,90,0.15)] active:translate-y-0.5">
              <div className="font-display text-lg leading-none">{n > JOURNEY ? `R${n - JOURNEY}` : n}</div>
              <div className="text-[10px] font-bold opacity-60">{clock(best[n].t)}</div>
              <div className="text-[11px] font-bold text-[#1E9CD8]">{trials[n] ? `👻 ${clock(trials[n].t)}` : "—"}</div>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- the Dex
const FAMS: Family[] = [...FAMILY_ORDER, "W", "K"];
const STAGE_OF: Record<string, number> = {};
for (let n = 1; n <= JOURNEY; n++) STAGE_OF[conceptAt(n)] ??= n;
const DexTile = memo(function DexTile({ id, name, on, onTap }: { id: string; name: string; on: boolean; onTap: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onTap(id)} className={`flex h-16 flex-col items-center justify-center rounded-2xl px-1 text-center shadow-[0_3px_0_rgba(20,40,90,0.15)] active:translate-y-0.5 ${on ? "bg-white text-[#1A2A5A]" : "bg-white/35 text-[#1A2A5A]/50"}`}>
      <span className="text-[10px] font-bold opacity-60">{id}</span>
      <span className="line-clamp-2 text-[11px] leading-tight font-bold">{on ? name : "???"}</span>
    </button>
  );
});
export function DexPanel({ met, best, onBack }: { met: string[]; best: Record<string, Best>; onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const seen = useMemo(() => { const s = new Set(met); for (const [id, n] of Object.entries(STAGE_OF)) if (best[n]) s.add(id); return s; }, [met, best]);
  const c = open ? CONCEPTS.find((x) => x.id === open) : null;
  return (
    <Panel title="Idea Dex" onBack={onBack} right={<span className="rounded-full bg-white/85 px-2.5 py-0.5 text-sm font-bold text-[#1A2A5A]">{seen.size}/500</span>}>
      <div className="mx-auto max-w-md pt-1">
        {FAMS.map((f) => {
          const list = CONCEPTS.filter((x) => x.fam === f), got = list.filter((x) => seen.has(x.id)).length;
          return (
            <section key={f} className="mb-4">
              <div className="mb-1.5 flex items-center justify-between px-1 text-[#1A2A5A]"><span className="font-display text-lg">{FAMILY_TITLE[f]}</span><span className="text-xs font-bold opacity-70">{got}/{list.length}</span></div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">{list.map((x) => <DexTile key={x.id} id={x.id} name={x.name} on={seen.has(x.id)} onTap={setOpen} />)}</div>
            </section>
          );
        })}
      </div>
      <AnimatePresence>
        {c && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 grid place-items-center bg-[#0A1030]/50 px-6" onClick={() => setOpen(null)}>
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="w-full max-w-xs rounded-[2rem] bg-white p-5 text-center text-[#1A2A5A]" onClick={(e) => e.stopPropagation()}>
              <div className="text-xs font-bold tracking-widest uppercase opacity-60">{FAMILY_TITLE[c.fam]} · {c.id}</div>
              <div className="mt-1 font-display text-2xl leading-tight">{seen.has(c.id) ? c.name : "Not met yet"}</div>
              <p className="mt-2 text-sm font-semibold opacity-80">{seen.has(c.id) ? c.desc : "Keep racing the Grand Prix to meet this idea."}</p>
              <div className="mt-3 text-xs font-bold opacity-60">Stage {STAGE_OF[c.id] ?? "—"}{c.fam !== "W" && c.fam !== "K" && !isExact(c.id) ? ` · rolls as ${MECH_LABEL[mechOf(c.id)]}` : ""}</div>
              <button type="button" onClick={() => setOpen(null)} className="mt-4 w-full rounded-2xl bg-[#EEF4FF] py-2.5 font-display text-lg active:scale-95">OK</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

// ---------------------------------------------------------------- the Marbles
/** a marble drawn in CSS (its own texture when it has one) */
const SKIN_IMG = new Map<number, string | null>();
function skinImg(i: number) {
  if (SKIN_IMG.has(i)) return SKIN_IMG.get(i)!;
  let url: string | null = null;
  try { const c = SKINS[i]?.tex?.().image as HTMLCanvasElement | undefined; if (c?.toDataURL) url = c.toDataURL("image/png"); } catch { /* no canvas */ }
  SKIN_IMG.set(i, url); return url;
}
export const SkinBall = memo(function SkinBall({ i, size = 64 }: { i: number; size?: number }) {
  const sk = SKINS[i];
  const img = useMemo(() => (typeof document === "undefined" ? null : skinImg(i)), [i]);
  if (!sk) return null;
  const base = sk.glass ? `radial-gradient(circle at 35% 30%, #ffffffcc, ${sk.tint ?? "#6FD8FF"}99 45%, ${sk.tint ?? "#2E8BFF"}dd)` : sk.metal ? `radial-gradient(circle at 35% 30%, #ffffff, ${sk.color} 40%, #20242e)` : sk.color;
  return (
    <span className="relative inline-block overflow-hidden rounded-full shadow-[inset_-6px_-8px_14px_rgba(0,0,0,0.35),0_4px_8px_rgba(0,0,0,0.2)]" style={{ width: size, height: size, background: base }}>
      {img && <span className="absolute inset-0" style={{ backgroundImage: `url(${img})`, backgroundSize: "200% 100%", backgroundPosition: "center" }} />}
      <span className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.75), rgba(255,255,255,0) 32%), radial-gradient(circle at 70% 75%, rgba(0,0,0,0.3), rgba(0,0,0,0) 55%)" }} />
      {sk.glass && <span className="absolute inset-[22%] rounded-full" style={{ background: `conic-gradient(from 0deg, #5CF2FF, #FF7CF0, #FFD23A, #5CF2FF)`, opacity: 0.55, filter: "blur(3px)" }} />}
    </span>
  );
});
export function ShopPanel({ coins, owned, skin, onBuy, onEquip, onBack }: { coins: number; owned: number[]; skin: number; onBuy: (i: number) => void; onEquip: (i: number) => void; onBack: () => void }) {
  return (
    <Panel title="Marbles" onBack={onBack} right={<span className="rounded-full bg-white/85 px-2.5 py-0.5 text-sm font-bold text-[#1A2A5A]">🪙 {coins.toLocaleString()}</span>}>
      <p className="mx-auto mb-2 max-w-md px-1 text-[13px] font-semibold text-[#2A3A6A]">Every marble looks different but rolls exactly the same — a fair race. Win coins, collect them all.</p>
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2 sm:grid-cols-4">
        {SKINS.map((sk, i) => {
          const have = owned.includes(i), on = skin === i, price = skinPrice(i), can = coins >= price;
          return (
            <button key={i} type="button" onClick={() => (have ? onEquip(i) : can && onBuy(i))} className={`flex flex-col items-center gap-1 rounded-3xl p-2 shadow-[0_4px_0_rgba(20,40,90,0.15)] active:translate-y-0.5 ${on ? "bg-[#FFF6D8] ring-4 ring-[#FFD23A]" : "bg-white/90"}`}>
              <SkinBall i={i} size={58} />
              <span className="text-[13px] font-bold text-[#1A2A5A]">{sk.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${on ? "bg-[#FFD23A] text-[#5A3A00]" : have ? "bg-[#EEF4FF] text-[#1E9CD8]" : can ? "bg-[#16A35A] text-white" : "bg-[#EEF0F4] text-[#8A94A8]"}`}>{on ? "Racing" : have ? "Use" : `🪙 ${price}`}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
