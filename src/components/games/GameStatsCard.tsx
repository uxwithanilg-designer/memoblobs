"use client";
import Link from "next/link";
import { Flame, Play, Target, Timer, TrendingUp } from "lucide-react";
import { emptyArcade, emptyStats, useHydrated, useProfile, type Difficulty } from "@/lib/store";
import { CoinIcon } from "@/components/brand/CoinPill";

const D: { id: Difficulty; label: string; color: string }[] = [
  { id: "easy", label: "Easy", color: "#2FA866" },
  { id: "medium", label: "Medium", color: "#F2B544" },
  { id: "hard", label: "Hard", color: "#E8504F" },
];

function ArcadeStatsCard({ slug }: { slug: string }) {
  const ok = useHydrated();
  const a = useProfile((s) => s.arcade?.[slug]) ?? emptyArcade();
  if (!ok || (!a.clears && !a.runs)) return null;
  return (
    <section className="glass rounded-[1.75rem] p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Your progress</h2>
        <Link href={`/play/${slug}`} className="btn-clay sm"><Play className="size-4 fill-current" /> Continue</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[[Target, "Levels cleared", a.clears.toLocaleString()], [Timer, "Played", `${Math.round(a.seconds / 60)} min`], [CoinIcon, "Coins won", a.coins.toLocaleString()]].map(([I, l, v]) => {
          const Icon = I as typeof Target;
          return (
            <div key={l as string} className="rounded-2xl bg-white/6 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-faint"><Icon className="size-4" /> {l as string}</p>
              <p className="mt-1 font-display text-2xl">{v as string}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {D.map((d) => (
          <div key={d.id} className="rounded-2xl p-3 ring-1 ring-white/10" style={{ background: `linear-gradient(90deg, ${d.color}33, transparent)` }}>
            <span className="font-display text-lg" style={{ color: d.color }}>{d.label}</span>
            <p className="text-sm text-muted">Level <b className="text-text">{a.level[d.id]}</b> · Best <b className="text-text">{a.best[d.id].toLocaleString()}</b></p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GameStatsCard({ slug }: { slug: string }) {
  if (slug !== "momo-shuffle") return <ArcadeStatsCard slug={slug} />;
  return <ShuffleStatsCard slug={slug} />;
}

function ShuffleStatsCard({ slug }: { slug: string }) {
  const ok = useHydrated();
  const st = useProfile((s) => s.games[slug]) ?? emptyStats();
  if (!ok || !st.rounds) return null;
  const acc = st.rounds ? Math.round((st.correct / st.rounds) * 100) : 0;
  return (
    <section className="glass rounded-[1.75rem] p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Your progress</h2>
        <Link href={`/play/${slug}?mode=${st.lastDifficulty}`} className="btn-clay sm"><Play className="size-4 fill-current" /> Continue</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [Target, "Finds", st.correct.toLocaleString()],
          [TrendingUp, "Accuracy", `${acc}%`],
          [Timer, "Played", `${Math.round(st.seconds / 60)} min`],
          [CoinIcon, "Coins won", st.coinsEarned.toLocaleString()],
        ].map(([I, l, v]) => {
          const Icon = I as typeof Target;
          return (
            <div key={l as string} className="rounded-2xl bg-white/6 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-faint"><Icon className="size-4" /> {l as string}</p>
              <p className="mt-1 font-display text-2xl">{v as string}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {D.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-2xl p-3 ring-1 ring-white/10" style={{ background: `linear-gradient(90deg, ${d.color}33, transparent)` }}>
            <span className="font-display text-lg" style={{ color: d.color }}>{d.label}</span>
            <span className="text-sm text-muted">Lv <b className="text-text">{st.level[d.id]}</b> · <Flame className="inline size-3.5 text-momo" /> {st.bestStreak[d.id]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
