"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { useHydrated, useProfile } from "@/lib/store";

export function CoinIcon({ size = 22, className = "" }: { size?: number; className?: string }) {
  return <Image src="/brand/coin.webp" alt="" width={size} height={size} className={`inline-block drop-shadow ${className}`} style={{ width: size, height: size }} />;
}

export function useAnimatedNumber(value: number) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const ctl = animate(prev.current, value, { duration: 0.8, ease: "easeOut", onUpdate: (v) => setShown(Math.round(v)) });
    prev.current = value;
    return () => ctl.stop();
  }, [value]);
  return shown;
}

export function CoinPill({ href = "/rewards", compact = false }: { href?: string | null; compact?: boolean }) {
  const ok = useHydrated();
  const coins = useProfile((s) => s.coins);
  const shown = useAnimatedNumber(ok ? coins : 0);
  const body = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#3a2470] to-[#2a1958] py-1 pr-3 pl-1 font-display tabular-nums text-sun ring-1 ring-sun/30 shadow-[inset_0_1px_0_rgb(255_255_255/0.15)] ${compact ? "text-base" : "text-lg"}`}
      aria-label={`${coins} coins`}
    >
      <CoinIcon size={compact ? 24 : 28} />
      {ok ? shown.toLocaleString() : "—"}
    </span>
  );
  return href ? <Link href={href} className="transition-transform hover:scale-105 active:scale-95">{body}</Link> : body;
}
