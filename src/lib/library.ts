"use client";
// The player's own game library, saved on this device: recently played, saved (bookmarked) games and likes.
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LibraryState {
  recent: { slug: string; t: number }[];
  saved: string[];
  votes: Record<string, 1 | -1>;
  touch: (slug: string) => void;
  toggleSave: (slug: string) => boolean;
  vote: (slug: string, v: 1 | -1) => void;
  clearRecent: () => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      recent: [],
      saved: [],
      votes: {},
      touch: (slug) => set({ recent: [{ slug, t: Date.now() }, ...get().recent.filter((r) => r.slug !== slug)].slice(0, 40) }),
      toggleSave: (slug) => {
        const on = !get().saved.includes(slug);
        set({ saved: on ? [slug, ...get().saved] : get().saved.filter((s) => s !== slug) });
        return on;
      },
      vote: (slug, v) => {
        const votes = { ...get().votes };
        if (votes[slug] === v) delete votes[slug]; else votes[slug] = v;
        set({ votes });
      },
      clearRecent: () => set({ recent: [] }),
    }),
    { name: "momoblobs-library", version: 1 },
  ),
);
