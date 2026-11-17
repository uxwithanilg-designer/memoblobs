"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Gamepad2, House, Play, Trophy, UserRound } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/play/momo-shuffle", label: "Play", icon: Play, center: true },
  { href: "/rewards", label: "Rewards", icon: Trophy },
  { href: "/profile", label: "Me", icon: UserRound },
];

export function MobileTabBar() {
  const path = usePathname();
  const isActive = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <nav
      aria-label="Tabs"
      className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
      style={{ paddingBottom: "max(var(--safe-bottom), 0.5rem)" }}
    >
      <div className="glass-strong mx-3 flex h-[var(--tabbar-h)] items-center justify-around rounded-[1.75rem] px-1 shadow-[0_-10px_40px_-10px_rgb(0_0_0/0.7)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = isActive(t.href);
          if (t.center)
            return (
              <Link key={t.href} href={t.href} aria-label="Play Momo Shuffle" className="relative -mt-9 grid place-items-center">
                <span className="btn-clay icon !size-16 !rounded-[1.4rem]">
                  <Icon className="size-7 fill-current" />
                </span>
                <span className="mt-1 text-[11px] font-bold text-sun">Play</span>
              </Link>
            );
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className="relative flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 active:scale-95"
            >
              {on && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-2xl bg-white/10" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <Icon className={`relative size-6 ${on ? "text-sun" : "text-muted"}`} strokeWidth={on ? 2.6 : 2} />
              <span className={`relative text-[11px] font-bold ${on ? "text-text" : "text-faint"}`}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
