// Per-game racing save (career stars, best times, garage, settings). Coins use the site-wide wallet.
"use client";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AiLevel, CameraView, ControlScheme, GfxQuality, ModeId, Upgrades, Weather } from "./types";

export interface RacingSettings {
  controls: ControlScheme;
  /** Auto drive: the car speeds up by itself and steers itself back to the road. Off by default: you drive. */
  autoDrive: boolean;
  camera: CameraView;
  quality: GfxQuality | "auto";
  units: "kmh" | "mph";
  sensitivity: number; // tilt / wheel sensitivity 0.5..2
  showMap: boolean;
  vibrate: boolean;
  leftHanded: boolean;
  /** on-screen control size multiplier (0.85 small · 1 normal · 1.15 big) */
  controlSize: number;
  /** phones: go fullscreen + landscape when a race starts (where the browser allows it) */
  landscape: boolean;
  /** show the live standings tower during races */
  showStandings: boolean;
}
export interface QuickSetup {
  mode: ModeId; themeId: string; variant: number; reverse: boolean; laps: number; opponents: number; ai: AiLevel;
  weather: Weather | "auto"; night: boolean | "auto"; pickups: boolean; hazards: boolean;
}
export interface RacingSave {
  stars: Record<string, number>;
  best: Record<string, number>;
  carId: string;
  paints: Record<string, number>;
  upgrades: Record<string, Upgrades>;
  /** cars the player has looked at in the garage (drives the "NEW" badges) */
  seen: string[];
  settings: RacingSettings;
  quick: QuickSetup;
  races: number; wins: number; distance: number; coinsEarned: number;
  /** the first-race "how to play" card was dismissed */
  tutorialDone: boolean;
  /** best lap per track key (ms) */
  bestLaps: Record<string, number>;
  podiums: number; takedowns: number; topSpeed: number;
}
export interface RacingStore extends RacingSave {
  totalStars: () => number;
  setStars: (levelId: string, stars: number) => void;
  setBest: (key: string, ms: number) => boolean;
  setBestLap: (key: string, ms: number) => boolean;
  selectCar: (id: string) => void;
  setPaint: (carId: string, i: number) => void;
  upgrade: (carId: string, stat: keyof Upgrades) => void;
  markSeen: (ids: string[]) => void;
  setSettings: (p: Partial<RacingSettings>) => void;
  setQuick: (p: Partial<QuickSetup>) => void;
  recordRace: (won: boolean, meters: number, coins: number, extra?: { podium?: boolean; takedowns?: number; topSpeed?: number }) => void;
  setTutorialDone: (v: boolean) => void;
  reset: () => void;
}

export const NO_UPGRADES: Upgrades = { speed: 0, accel: 0, handling: 0, nitro: 0 };
export const upgradeCost = (level: number, tier: number) => Math.round((60 + level * 70) * (0.8 + tier * 0.3));

export const DEFAULT_SETTINGS: RacingSettings = {
  controls: "buttons", autoDrive: false, camera: "chase", quality: "auto", units: "kmh", sensitivity: 1, showMap: true, vibrate: true,
  leftHanded: false, controlSize: 1, landscape: true, showStandings: true,
};

const initial = (firstCar: string, firstTheme: string): RacingSave => ({
  stars: {}, best: {}, carId: firstCar, paints: {}, upgrades: {}, seen: [],
  settings: { ...DEFAULT_SETTINGS },
  quick: { mode: "race", themeId: firstTheme, variant: 0, reverse: false, laps: 2, opponents: 5, ai: "normal", weather: "auto", night: "auto", pickups: true, hazards: true },
  races: 0, wins: 0, distance: 0, coinsEarned: 0, tutorialDone: false, bestLaps: {}, podiums: 0, takedowns: 0, topSpeed: 0,
});

function make(slug: string, firstCar: string, firstTheme: string) {
  return create<RacingStore>()(
    persist(
      (set, get) => ({
        ...initial(firstCar, firstTheme),
        totalStars: () => Object.values(get().stars).reduce((a, b) => a + b, 0),
        setStars: (id, n) => { const cur = get().stars[id] ?? 0; if (n > cur) set({ stars: { ...get().stars, [id]: n } }); },
        setBest: (key, ms) => { const cur = get().best[key]; if (!cur || ms < cur) { set({ best: { ...get().best, [key]: ms } }); return true; } return false; },
        setBestLap: (key, ms) => { const cur = get().bestLaps[key]; if (ms > 0 && (!cur || ms < cur)) { set({ bestLaps: { ...get().bestLaps, [key]: ms } }); return true; } return false; },
        selectCar: (id) => set({ carId: id }),
        setPaint: (c, i) => set({ paints: { ...get().paints, [c]: i } }),
        upgrade: (c, stat) => { const u = { ...NO_UPGRADES, ...get().upgrades[c] }; if (u[stat] >= 5) return; u[stat]++; set({ upgrades: { ...get().upgrades, [c]: u } }); },
        markSeen: (ids) => { const cur = get().seen; if (ids.every((i) => cur.includes(i))) return; set({ seen: [...new Set([...cur, ...ids])] }); },
        setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
        setQuick: (p) => set({ quick: { ...get().quick, ...p } }),
        recordRace: (won, m, coins, x = {}) => set({
          races: get().races + 1, wins: get().wins + (won ? 1 : 0), distance: get().distance + m, coinsEarned: get().coinsEarned + coins,
          podiums: get().podiums + (x.podium ? 1 : 0), takedowns: get().takedowns + (x.takedowns ?? 0), topSpeed: Math.max(get().topSpeed, x.topSpeed ?? 0),
        }),
        setTutorialDone: (v) => set({ tutorialDone: v }),
        reset: () => set(initial(firstCar, firstTheme)),
      }),
      {
        name: `momoblobs:racing:${slug}`, version: 1, storage: createJSONStorage(() => localStorage), skipHydration: true,
        // older saves miss newer settings — merge nested objects instead of replacing them
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as Partial<RacingSave>;
          return { ...current, ...p, settings: { ...current.settings, ...p.settings }, quick: { ...current.quick, ...p.quick }, bestLaps: { ...current.bestLaps, ...p.bestLaps } };
        },
      },
    ),
  );
}
export type RacingBound = ReturnType<typeof make>;
const stores = new Map<string, RacingBound>();

export function racingStore(slug: string, firstCar: string, firstTheme: string) {
  let s = stores.get(slug);
  if (!s) { s = make(slug, firstCar, firstTheme); stores.set(slug, s); }
  return s;
}

/** hydrate once on the client; returns true when the save is ready */
export function useRacingHydrated(store: RacingBound) {
  return useSyncExternalStore(
    (cb) => {
      const p = store.persist;
      if (!p.hasHydrated()) void p.rehydrate();
      return p.onFinishHydration(cb);
    },
    () => store.persist.hasHydrated(),
    () => false,
  );
}
