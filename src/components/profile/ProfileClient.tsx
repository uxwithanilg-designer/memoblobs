"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Flame, Pencil, Play, RotateCcw, Target, Timer, Trophy } from "lucide-react";
import { AVATARS, TROPHIES, dayStreak, emptyStats, useHydrated, useProfile } from "@/lib/store";
import { CoinIcon } from "@/components/brand/CoinPill";
import { ALL_PAGES } from "@/components/layout/nav";
import { toast } from "@/components/ui/Toaster";
import { playHref } from "@/lib/catalog";

export function ProfileClient() {
  const ok = useHydrated();
  const p = useProfile();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const st = p.games["momo-shuffle"] ?? emptyStats();
  const av = AVATARS.find((a) => a.id === p.avatar) ?? AVATARS[0];

  if (!ok) return <div className="h-96 animate-pulse rounded-[2rem] bg-white/5" />;

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet/60 via-cup/40 to-plum p-6 ring-1 ring-white/15 sm:p-8">
        <div className="sunburst absolute inset-0 opacity-40" />
        <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <div className="grid size-32 shrink-0 place-items-center overflow-hidden rounded-[2rem] bg-gradient-to-b from-sun to-momo ring-4 ring-white/30 shadow-2xl">
            <Image src={av.src} alt={av.label} width={240} height={240} className="h-[110%] w-[110%] object-contain pt-3" />
          </div>
          <div className="min-w-0 flex-1">
            {edit ? (
              <form
                className="flex flex-wrap items-center justify-center gap-2 sm:justify-start"
                onSubmit={(e) => { e.preventDefault(); p.setNickname(name); setEdit(false); toast({ title: "Name saved!", icon: "✏️", tone: "mint" }); }}
              >
                <input autoFocus value={name} maxLength={16} onChange={(e) => setName(e.target.value)} aria-label="Player name" className="h-12 w-56 rounded-2xl bg-ink/40 px-4 font-display text-2xl ring-2 ring-sun outline-none" />
                <button className="btn-clay sm">Save</button>
              </form>
            ) : (
              <button onClick={() => { setName(p.nickname); setEdit(true); }} className="group inline-flex items-center gap-2">
                <span className="text-clay text-5xl text-cream">{p.nickname}</span>
                <Pencil className="size-5 text-muted group-hover:text-text" />
              </button>
            )}
            <p className="mt-2 text-text/80">Player since {new Date(p.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })} · <Flame className="inline size-4 text-momo" /> {dayStreak(p.playDays)} day streak</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="chip !bg-ink/40"><CoinIcon size={18} /> {p.coins.toLocaleString()} coins</span>
              <span className="chip !bg-ink/40"><Trophy className="size-4 text-sun" /> {Object.keys(p.trophies).length}/{TROPHIES.length} trophies</span>
            </div>
          </div>
        </div>
      </section>

      <section className="glass rounded-[1.75rem] p-5">
        <h2 className="font-display text-2xl">Pick your avatar</h2>
        <div role="radiogroup" aria-label="Avatar" className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {AVATARS.map((a) => (
            <button key={a.id} role="radio" aria-checked={p.avatar === a.id} onClick={() => p.setAvatar(a.id)} className={`flex flex-col items-center rounded-2xl p-2 transition ${p.avatar === a.id ? "bg-sun/20 ring-2 ring-sun" : "bg-white/5 ring-1 ring-white/10 hover:bg-white/10"}`}>
              <Image src={a.src} alt="" width={120} height={120} className="size-16 object-contain drop-shadow-lg" />
              <span className="mt-1 text-xs font-bold">{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="glass rounded-[1.75rem] p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Momo Shuffle stats</h2>
          <Link href={playHref("momo-shuffle", { mode: st.lastDifficulty })} className="btn-clay sm"><Play className="size-4 fill-current" /> Play</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [Target, "Rounds", st.rounds], [Trophy, "Finds", st.correct], [Timer, "Minutes", Math.round(st.seconds / 60)], [CoinIcon, "Coins won", st.coinsEarned],
          ].map(([I, l, v]) => {
            const Icon = I as typeof Target;
            return (
              <div key={l as string} className="rounded-2xl bg-white/6 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-faint"><Icon className="size-4" /> {l as string}</p>
                <p className="mt-1 font-display text-3xl">{(v as number).toLocaleString()}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(["easy", "medium", "hard"] as const).map((d, i) => (
            <div key={d} className="rounded-2xl p-4 ring-1 ring-white/10" style={{ background: `linear-gradient(135deg, ${["#2FA866", "#F2B544", "#E8504F"][i]}44, transparent)` }}>
              <p className="font-display text-xl capitalize">{d} <span className="text-sm text-faint">· {[3, 4, 6][i]} cups</span></p>
              <p className="mt-1 text-muted">Level <b className="text-text">{st.level[d]}</b> (best {st.maxLevel[d]}) · Streak <b className="text-text">{st.bestStreak[d]}</b></p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass overflow-hidden rounded-[1.75rem]">
        <h2 className="px-5 pt-5 font-display text-2xl">More</h2>
        <ul className="mt-2 divide-y divide-white/8">
          {ALL_PAGES.filter((x) => ["/settings", "/rewards", "/characters", "/parents", "/help", "/about"].includes(x.href)).map((x) => (
            <li key={x.href}>
              <Link href={x.href} className="flex items-center gap-3 px-5 py-4 transition hover:bg-white/5">
                <span className="grid size-10 place-items-center rounded-xl bg-white/8 text-xl">{x.emoji}</span>
                <span className="flex-1"><span className="block font-semibold">{x.label}</span><span className="text-sm text-faint">{x.desc}</span></span>
                <ChevronRight className="size-5 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[1.75rem] bg-tomato/10 p-5 ring-1 ring-tomato/30">
        <h2 className="font-display text-xl">Start over</h2>
        <p className="mt-1 text-sm text-muted">Erase coins, levels, trophies and cup skins saved on this device. This can&apos;t be undone.</p>
        {confirm ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => { p.resetProgress(); setConfirm(false); toast({ title: "Progress reset", icon: "🧽" }); }} className="btn-clay bubble sm">Yes, erase everything</button>
            <button onClick={() => setConfirm(false)} className="btn-clay ghost sm">Keep my progress</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="btn-clay ghost sm mt-3"><RotateCcw className="size-4" /> Reset progress</button>
        )}
      </section>
    </div>
  );
}
