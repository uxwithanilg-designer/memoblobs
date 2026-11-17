"use client";
import { motion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { CUP_SKINS, TROPHIES, useHydrated, useProfile } from "@/lib/store";
import { CoinIcon, useAnimatedNumber } from "@/components/brand/CoinPill";
import { toast } from "@/components/ui/Toaster";
import { audio } from "@/lib/audio";

function ClayCup({ color, size = 96 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 100 110" width={size} height={size * 1.1} aria-hidden className="drop-shadow-[0_10px_12px_rgb(0_0_0/0.4)]">
      <defs>
        <linearGradient id={`cup${color.slice(1)}`} x1="0" x2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.85" />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <path d="M22 14 Q50 6 78 14 L92 98 Q50 108 8 98 Z" fill={color} />
      <path d="M22 14 Q50 6 78 14 L92 98 Q50 108 8 98 Z" fill={`url(#cup${color.slice(1)})`} />
      <path d="M14 66 Q50 74 86 66" stroke="#FFE3C2" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M19 38 Q50 45 81 38" stroke="#FFD25A" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M8 98 Q50 108 92 98" stroke="#FFE3C2" strokeWidth="6" fill="none" strokeLinecap="round" />
      <ellipse cx="50" cy="9" rx="9" ry="7" fill="#FFE3C2" />
      {[24, 40, 60, 76].map((x) => <circle key={x} cx={x} cy={53} r="2.6" fill="#FFD25A" />)}
      <path d="M30 22 Q36 50 30 86" stroke="#fff" strokeOpacity="0.25" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function RewardsClient() {
  const ok = useHydrated();
  const p = useProfile();
  const coins = useAnimatedNumber(ok ? p.coins : 0);
  const got = ok ? Object.keys(p.trophies).length : 0;

  const buy = (id: string, price: number, name: string) => {
    audio.ensure();
    if (p.owned.includes(id)) { p.equipCup(id); audio.play("clack", { gain: 0.6 }); toast({ title: `${name} equipped!`, icon: "🥤", tone: "mint" }); return; }
    if (p.coins < price) { audio.play("hmm", { gain: 0.6 }); toast({ title: "Not enough coins yet", body: `Find Momo a few more times to earn ${price - p.coins} more.`, icon: "🪙" }); return; }
    if (p.buy(id, price)) { audio.play("tada", { gain: 0.6 }); toast({ title: `You got ${name}!`, body: "Your cups have a new colour in Momo Shuffle.", icon: "🎉", tone: "gold" }); }
  };

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-[1.75rem] p-5">
          <p className="text-sm font-bold tracking-widest text-faint uppercase">Wallet</p>
          <p className="mt-1 flex items-center gap-2 font-display text-5xl text-sun"><CoinIcon size={44} /> {ok ? coins.toLocaleString() : "—"}</p>
          <p className="mt-1 text-sm text-muted">{ok ? p.totalCoins.toLocaleString() : 0} coins earned all-time</p>
        </div>
        <div className="glass rounded-[1.75rem] p-5">
          <p className="text-sm font-bold tracking-widest text-faint uppercase">Trophies</p>
          <p className="mt-1 font-display text-5xl">{got}<span className="text-2xl text-faint">/{TROPHIES.length}</span></p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-mint to-lime" style={{ width: `${(got / TROPHIES.length) * 100}%` }} /></div>
        </div>
        <div className="glass rounded-[1.75rem] p-5">
          <p className="text-sm font-bold tracking-widest text-faint uppercase">Cup skins</p>
          <p className="mt-1 font-display text-5xl">{ok ? p.owned.length : 1}<span className="text-2xl text-faint">/{CUP_SKINS.length}</span></p>
          <p className="mt-1 text-sm text-muted">Equipped: {CUP_SKINS.find((c) => c.id === (ok ? p.equippedCup : "classic"))?.name}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-3xl sm:text-4xl">Trophy room</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TROPHIES.map((t, i) => {
            const won = ok && !!p.trophies[t.id];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.05 }}
                className={`relative overflow-hidden rounded-[1.5rem] p-4 ring-1 ${won ? "bg-gradient-to-br from-sun/25 to-momo/10 ring-sun/40" : "bg-white/5 ring-white/10"}`}
              >
                <span className={`grid size-14 place-items-center rounded-2xl text-3xl ${won ? "bg-sun/90 shadow-[0_5px_0_#d9a520]" : "bg-white/10 grayscale"}`}>{won ? t.icon : <Lock className="size-6 text-faint" />}</span>
                <p className={`mt-3 font-display text-lg leading-tight ${won ? "" : "text-muted"}`}>{t.title}</p>
                <p className="mt-0.5 text-sm text-faint">{t.desc}</p>
                {won && <Check className="absolute top-3 right-3 size-5 text-lime" />}
              </motion.div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-3xl sm:text-4xl">Cup shop</h2>
          <p className="text-sm text-muted">New colours show up in Momo Shuffle</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CUP_SKINS.map((c) => {
            const owned = ok && p.owned.includes(c.id);
            const on = ok && p.equippedCup === c.id;
            const afford = ok && p.coins >= c.price;
            return (
              <div key={c.id} className={`relative flex flex-col items-center rounded-[1.75rem] p-4 text-center ring-1 transition ${on ? "bg-white/12 ring-sun" : "bg-white/5 ring-white/10"}`}>
                {on && <span className="absolute top-3 left-3 chip !bg-sun !py-0.5 !text-[11px] !text-ink">EQUIPPED</span>}
                <div className="py-2"><ClayCup color={c.color} size={84} /></div>
                <p className="font-display text-lg">{c.name}</p>
                <button
                  onClick={() => buy(c.id, c.price, c.name)}
                  disabled={!ok || on}
                  className={`btn-clay sm mt-3 w-full ${owned ? "mint" : afford ? "sun" : "ghost"}`}
                >
                  {on ? "In use" : owned ? "Use" : c.price === 0 ? "Free" : (<><CoinIcon size={18} /> {c.price.toLocaleString()}</>)}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
