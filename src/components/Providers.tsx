"use client";
import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import { useHydrated, useProfile, useSettings } from "@/lib/store";
import { useLibrary } from "@/lib/library";
import { audio } from "@/lib/audio";
import { Toaster } from "@/components/ui/Toaster";
import { ConsentBanner } from "@/components/ConsentBanner";

export function Providers({ children }: { children: React.ReactNode }) {
  useHydrated();
  const reduced = useSettings((s) => s.reducedMotion);
  useEffect(() => {
    const apply = (s: ReturnType<typeof useSettings.getState>) => { audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted, voice: s.voice, charVoices: s.charVoices }); audio.setVoicePreference(s.voiceName); }
    apply(useSettings.getState());
    return useSettings.subscribe(apply);
  }, []);
  // the game page and the game running in its frame share one save: pick up each other's changes (sound, coins, saves)
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === "momoblobs:settings") void useSettings.persist.rehydrate();
      else if (e.key === "momoblobs:profile") void useProfile.persist.rehydrate();
      else if (e.key === "momoblobs-library") void useLibrary.persist.rehydrate();
    };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "user"}>
      {children}
      <Toaster />
      <ConsentBanner />
    </MotionConfig>
  );
}
