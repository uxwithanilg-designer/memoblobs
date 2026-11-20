"use client";
// Rollo Rush's screens beside the run: the mode picker, the Time Trial stage list, Rollo's Locker and the card at the
// end of a mode run.
import { useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { useProfile } from "@/lib/store";
import { STAGES_PER_WORLD, WORLDS } from "../data/worlds";
import { ITEMS, SLOTS, type Slot } from "../locker";
import { bossesBeaten, dayNumber, MODE, MODES, type ModeId } from "../modes";
import { useRush, type ModeOut } from "../save";
import type { ModeResult } from "../session";

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const km = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`);
export function Sheet({ title, onClose, children, tabs }: { title: string; onClose: () => void; children: ReactNode; tabs?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex flex-col justify-end bg-black/45" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="flex max-h-[86%] w-full flex-col rounded-t-[1.8rem] border-t border-white/15 bg-gradient-to-b from-[#1A2668] to-[#0B1240] text-white shadow-[0_-12px_40px_rgba(0,0,0,0.4)]" style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <h2 className="flex-1 font-display text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-white/10 active:scale-95"><X className="size-5" /></button>
        </div>
        {tabs}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">{children}</div>
      </motion.div>
    </motion.div>
  );
}
function Tabs<T extends string>({ value, set, items }: { value: T; set: (v: T) => void; items: { id: T; label: string }[] }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 pb-3">
      {items.map((t) => <button key={t.id} onClick={() => set(t.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${value === t.id ? "bg-[#5CF2C9] text-[#0B3A33]" : "bg-white/10 text-white"}`}>{t.label}</button>)}
    </div>
  );
}

// ---------------------------------------------------------------- modes
export function ModesSheet({ onClose, onPick }: { onClose: () => void; onPick: (id: ModeId) => void }) {
  const stage = useRush((s) => s.stage), best = useRush((s) => s.best), daily = useRush((s) => s.daily), trials = useRush((s) => s.trials);
  const today = dayNumber();
  const info = (id: ModeId) => {
    if (id === "endless") return best.endless ? `Best ${km(best.endless)}` : "No run yet";
    if (id === "park") return best.park ? `Best ${best.park.toLocaleString()} pts` : "No run yet";
    if (id === "boss") { const n = bossesBeaten(stage); return `${n} boss${n === 1 ? "" : "es"}${best[`boss${n}`] ? ` · best ${clock(best[`boss${n}`])}` : ""}`; }
    if (id === "daily") return `${daily.last === today ? "✓ Done today" : "New today!"}${daily.streak && daily.last >= today - 1 ? ` · 🔥 ${daily.streak} day${daily.streak === 1 ? "" : "s"}` : ""}`;
    return `${Object.keys(trials).length} ghost${Object.keys(trials).length === 1 ? "" : "s"} saved`;
  };
  return (
    <Sheet title="Modes" onClose={onClose}>
      <div className="flex flex-col gap-2.5">
        {MODES.map((m) => {
          const locked = stage < m.unlockAt;
          return (
            <button key={m.id} disabled={locked} onClick={() => onPick(m.id)} className="relative flex items-center gap-3 overflow-hidden rounded-2xl p-3 text-left shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-0.5 disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${m.grad[0]}, ${m.grad[1]})` }}>
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-black/20 text-3xl">{locked ? "🔒" : m.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl leading-tight">{m.name}</span>
                <span className="block text-xs leading-snug opacity-90">{locked ? `Opens at stage ${m.unlockAt} of the journey` : m.blurb}</span>
                {!locked && <span className="mt-1 inline-block rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">{info(m.id)}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export function TrialSheet({ onClose, onPick }: { onClose: () => void; onPick: (n: number) => void }) {
  const stage = useRush((s) => s.stage), ranks = useRush((s) => s.ranks), trials = useRush((s) => s.trials);
  const top = Math.min(stage - 1, WORLDS.length * STAGES_PER_WORLD);
  const list = useMemo(() => Array.from({ length: Math.max(0, top) }, (_, i) => top - i), [top]);
  return (
    <Sheet title="Time Trial" onClose={onClose}>
      <p className="mb-3 text-sm text-[#CFE0FF]">Pick a stage you have cleared. Your best run comes back as a ghost to race.</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {list.map((n) => {
          const w = WORLDS[Math.ceil(n / STAGES_PER_WORLD) - 1], g = trials[n], rk = ranks[n];
          return (
            <button key={n} onClick={() => onPick(n)} className="flex flex-col items-center rounded-xl bg-white/10 px-1 py-2 active:scale-95">
              <span className="text-lg leading-none">{w?.emoji}</span>
              <span className="font-display text-lg leading-tight">{n}</span>
              <span className="text-[10px] font-bold opacity-90">{g ? `👻 ${clock(g.t)}` : rk ? `Rank ${rk}` : "—"}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Rollo's Locker
export function LockerSheet({ onClose }: { onClose: () => void }) {
  const [slot, setSlot] = useState<Slot>("armour");
  const owned = useRush((s) => s.owned), wear = useRush((s) => s.wear), buy = useRush((s) => s.buy);
  const coins = useProfile((s) => s.coins);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Sheet title="Rollo's Locker" onClose={onClose} tabs={<>
      <div className="-mt-1 mb-2 px-5 text-sm font-bold text-[#FFE27A]">🪙 {coins.toLocaleString()} coins</div>
      <Tabs value={slot} set={setSlot} items={SLOTS.map((s) => ({ id: s.id, label: `${s.emoji} ${s.name}` }))} />
    </>}>
      {msg && <div className="mb-2 rounded-xl bg-[#FF5A7A]/30 px-3 py-2 text-sm font-bold">{msg}</div>}
      <div className="grid grid-cols-3 gap-2">
        {ITEMS.filter((i) => i.slot === slot).map((it) => {
          const has = owned.includes(it.id), on = wear[slot] === it.id;
          return (
            <button key={it.id} onClick={() => { setMsg(null); if (!buy(it.id)) setMsg(`Not enough coins yet — ${it.name} needs ${it.price}.`); }} className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 active:scale-95 ${on ? "bg-[#5CF2C9]/25 ring-2 ring-[#5CF2C9]" : "bg-white/10"}`}>
              <span className="size-11 rounded-full border-2 border-white/40" style={{ background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${it.swatch} 45%, ${it.swatch} 100%)`, boxShadow: `0 0 14px ${it.swatch}88` }} />
              <span className="text-center text-xs font-bold leading-tight">{it.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${on ? "bg-[#5CF2C9] text-[#0B3A33]" : has ? "bg-white/15" : "bg-[#FFE27A] text-[#3A2A00]"}`}>{on ? "Wearing" : has ? "Wear" : `🪙 ${it.price}`}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] opacity-70">Just for looks — every power is found on the track.</p>
    </Sheet>
  );
}

// ---------------------------------------------------------------- the end of a mode run
export function ModeResultCard({ res, out, onAgain, onHome }: { res: ModeResult; out: ModeOut; onAgain: () => void; onHome: () => void }) {
  const m = MODE[res.id];
  let head = "", big = "", line = "";
  if (res.id === "endless") { head = "Knocked out!"; big = km(res.metres); line = `Best ${km(out.best)} · ${res.stages} stage${res.stages === 1 ? "" : "s"}`; }
  else if (res.id === "park") { head = "Time's up!"; big = `${res.score.toLocaleString()} pts`; line = `Best ${out.best.toLocaleString()} pts`; }
  else if (res.id === "boss") { head = res.finished ? "Every boss beaten!" : "Knocked out!"; big = `${res.bosses ?? 0} boss${res.bosses === 1 ? "" : "es"}`; line = `${clock(res.time)}${out.best ? ` · best ${clock(out.best)}` : ""}`; }
  else { head = res.finished ? "Finished!" : "Over"; big = clock(res.time); line = `${res.rank ? `Rank ${res.rank} · ` : ""}${res.id === "trial" ? `stage ${res.n} · best ${clock(out.best)}` : `today's best ${clock(out.best)}`}`; }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center bg-black/40 px-6">
      <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 240, damping: 18 }} className="w-full max-w-sm rounded-[2rem] p-5 text-center text-white shadow-[0_18px_60px_rgba(0,0,0,0.5)]" style={{ background: `linear-gradient(160deg, ${m.grad[0]}, ${m.grad[1]})` }}>
        <div className="text-4xl">{m.emoji}</div>
        <div className="mt-1 text-sm font-bold uppercase tracking-widest opacity-85">{m.name}</div>
        <div className="mt-2 font-display text-2xl">{head}</div>
        <div className="font-display text-5xl leading-tight drop-shadow-[0_4px_0_rgba(0,0,0,0.25)]">{big}</div>
        <div className="mt-1 text-sm font-bold opacity-90">{line}</div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-xs font-bold">
          {out.newBest && <span className="rounded-full bg-[#FFE27A] px-2.5 py-1 text-[#3A2A00]">⭐ New best!</span>}
          {out.streak ? <span className="rounded-full bg-black/25 px-2.5 py-1">🔥 {out.streak}-day streak</span> : null}
          <span className="rounded-full bg-black/25 px-2.5 py-1">🪙 +{out.coins}</span>
          <span className="rounded-full bg-black/25 px-2.5 py-1">✨ {res.pearls} pearls</span>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onHome} className="flex-1 rounded-2xl bg-black/25 py-3 font-display text-lg active:scale-95">Home</button>
          <button onClick={onAgain} className="flex-1 rounded-2xl bg-white py-3 font-display text-lg text-[#0B1240] shadow-[0_5px_0_rgba(0,0,0,0.25)] active:translate-y-0.5">Again</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
