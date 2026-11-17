"use client";
import { create } from "zustand";
import { AnimatePresence, motion } from "motion/react";

export interface Toast { id: number; title: string; body?: string; icon?: string; tone?: "gold" | "mint" | "bubble" | "plain" }

const useToasts = create<{ items: Toast[]; push: (t: Omit<Toast, "id">) => void; drop: (id: number) => void }>((set, get) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set({ items: [...get().items.slice(-2), { ...t, id }] });
    setTimeout(() => get().drop(id), 3600);
  },
  drop: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
}));

export const toast = (t: Omit<Toast, "id">) => useToasts.getState().push(t);

const tones = {
  gold: "from-sun/95 to-gold/95 text-ink",
  mint: "from-mint/95 to-mint-dark/95 text-ink",
  bubble: "from-bubble/95 to-tomato/95 text-ink",
  plain: "from-grape/95 to-plum/95 text-text",
};

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+0.75rem)] z-[90] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ y: -40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl bg-gradient-to-br px-4 py-3 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.6)] ring-1 ring-white/20 ${tones[t.tone ?? "plain"]}`}
            onClick={() => useToasts.getState().drop(t.id)}
          >
            {t.icon && <span className="text-3xl leading-none">{t.icon}</span>}
            <div>
              <p className="font-display text-lg leading-tight">{t.title}</p>
              {t.body && <p className="text-sm font-medium opacity-80">{t.body}</p>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
