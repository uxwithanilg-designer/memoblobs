"use client";
import { createContext, useContext } from "react";
import type { Settings } from "@/lib/store";

export interface MenuAction { id: string; label: string; icon?: string; onSelect: () => void }

export interface PlayerApi {
  paused: boolean;
  setPaused: (p: boolean) => void;
  settings: Settings;
  /** p in 0..1 while loading, null when ready */
  setLoading: (p: number | null, label?: string) => void;
  reportFps: (fps: number) => void;
  setMenu: (actions: MenuAction[]) => void;
  /** true once the player left the lobby (enables auto-pause) */
  setInRound: (v: boolean) => void;
  openHelp: () => void;
  /** immersive mode (e.g. during a race): hides the site chrome, leaving only a small pause button */
  immersive: boolean;
  setImmersive: (on: boolean) => void;
  /** phones: go fullscreen and lock to landscape where the browser allows it (call from a tap) */
  goLandscape: () => Promise<void>;
}

export const PlayerContext = createContext<PlayerApi | null>(null);
export const usePlayer = () => {
  const c = useContext(PlayerContext);
  if (!c) throw new Error("usePlayer outside <GamePlayer>");
  return c;
};
