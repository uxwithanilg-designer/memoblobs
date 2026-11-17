"use client";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Gift, Play, Flame } from "lucide-react";
import { emptyStats, today, TROPHIES, useHydrated, useProfile, dayStreak } from "@/lib/store";
import { CoinIcon } from "@/components/brand/CoinPill";
import { toast } from "@/components/ui/Toaster";
import { audio } from "@/lib/audio";

const MODES = [
  { id: "easy", label: "Easy", cups: 3, color: "#2FA866", dark: "#1f7a49", coins: 10 },
  { id: "medium", label: "Medium", cups: 4, color: "#F2B544", dark: "#c98b1a", coins: 20 },
  { id: "hard", label: "Hard", cups: 6, color: "#E8504F", dark: "#b8383b", coins: 40 },
] as const;

function Cups({ n, color }: { n: number; color: string }) {
  return (
    <div className="flex items-end justify-center gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <svg key={i} viewBox="0 0 40 44" className="w-6 sm:w-7" aria-hidden>
          <path d="M8 6 Q20 2 32 6 L37 40 Q20 44 3 40 Z" fill={color} stroke="#23305A" strokeWidth="3" strokeLinejoin="round" />
          <path d="M6 24 Q20 27 34 24" stroke="#FFE3C2" strokeWidth="3" fill="none" />
          <circle cx="20" cy="4" r="3.5" fill="#FFE3C2" stroke="#23305A" strokeWidth="2" />
        </svg>
      ))}
    </div>
  );
}

export function ModePicker() {
  const ok = useHydrated();
  const st = useProfile((s) => s.games["momo-shuffle"]) ?? emptyStats();
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {MODES.map((m, i) => (
        <motion.div key={m.id} initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
          <Link
            href={`/play/momo-shuffle?mode=${m.id}`}
            className="group relative flex flex-col items-center gap-2 overflow-hidden rounded-[1.5rem] p-3 pt-4 text-center ring-1 ring-white/15 transition hover:-translate-y-1 active:translate-y-0.5 sm:p-5"
            style={{ background: `linear-gradient(180deg, ${m.color}, ${m.dark})`, boxShadow: `inset 0 -6px 0 rgb(0 0 0 / 0.18), 0 18px 30px -18px ${m.color}` }}
          >
            <div className="sunburst absolute inset-0 opacity-40" />
            <span className="relative font-display text-xl text-cream drop-shadow sm:text-3xl" style={{ WebkitTextStroke: "0.12em #23305A", paintOrder: "stroke fill" }}>{m.label}</span>
            <div className="relative"><Cups n={m.cups} color="#8E6CE0" /></div>
            <span className="relative text-xs font-bold text-white/90 sm:text-sm">{m.cups} cups</span>
            <span className="relative flex items-center gap-1 rounded-full bg-ink/35 px-2 py-0.5 text-xs font-bold text-sun"><CoinIcon size={16} />+{m.coins}</span>
            <span className="relative rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white">Level {ok ? st.level[m.id] : 1}</span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

export function ContinueStrip() {
  const ok = useHydrated();
  const st = useProfile((s) => s.games["momo-shuffle"]);
  if (!ok || !st || !st.rounds) return null;
  const d = st.lastDifficulty;
  return (
    <section className="mx-auto w-full max-w-7xl px-5 lg:px-6">
      <Link href={`/play/momo-shuffle?mode=${d}`} className="glass group flex items-center gap-4 rounded-3xl p-3 pr-4 transition hover:bg-white/10">
        <Image src="/games/momo-shuffle/cover-1.webp" alt="" width={64} height={96} className="h-20 w-14 rounded-xl object-cover object-top" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-widest text-momo uppercase">Continue playing</p>
          <p className="font-display text-xl leading-tight">Momo Shuffle · <span className="capitalize">{d}</span></p>
          <p className="text-sm text-muted">Level {st.level[d]} · Best streak {st.bestStreak[d]} · {st.correct} finds</p>
        </div>
        <span className="btn-clay icon !size-12 !rounded-2xl"><Play className="size-5 fill-current" /></span>
      </Link>
    </section>
  );
}

export function DailyGift({ compact = false }: { compact?: boolean }) {
  const ok = useHydrated();
  const lastGift = useProfile((s) => s.lastGift);
  const days = useProfile((s) => s.playDays);
  const claimed = ok && lastGift === today();
  const streak = ok ? dayStreak(days) : 0;
  const claim = () => {
    const n = useProfile.getState().claimGift();
    if (n > 0) {
      audio.ensure();
      audio.play("tada", { gain: 0.6 }); audio.play("sparkle", { gain: 0.5, delay: 0.15 });
      toast({ title: `+${n} coins!`, body: "Daily gift collected. See you tomorrow!", icon: "🎁", tone: "gold" });
    }
  };
  return (
    <div className={`relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#ffcf4d] via-[#ff9f43] to-[#ff6f91] p-5 text-ink shadow-[0_30px_60px_-30px_#ff9f43] ${compact ? "" : "sm:p-7"}`}>
      <div className="sunburst absolute inset-0 opacity-50" />
      <Image src="/brand/coin.webp" alt="" width={120} height={123} className="absolute -right-4 -bottom-6 w-28 rotate-12 opacity-90 sm:w-36" />
      <div className="relative">
        <p className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase opacity-80"><Gift className="size-4" /> Daily gift</p>
        <p className="mt-1 font-display text-3xl leading-tight sm:text-4xl">{claimed ? "Come back tomorrow!" : "Free coins waiting!"}</p>
        <p className="mt-1 flex items-center gap-1.5 font-semibold opacity-80"><Flame className="size-4" /> {streak} day streak · bigger gift every day you play</p>
        <button onClick={claim} disabled={!ok || claimed} className="btn-clay grape mt-4">
          <Gift className="size-5" /> {claimed ? "Collected" : "Open gift"}
        </button>
      </div>
    </div>
  );
}

export function TrophyCount() {
  const ok = useHydrated();
  const n = useProfile((s) => Object.keys(s.trophies).length);
  return <span>{ok ? n : 0}/{TROPHIES.length}</span>;
}
