"use client";
import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import { useHydrated, useSettings } from "@/lib/store";
import { audio } from "@/lib/audio";
import { Toaster } from "@/components/ui/Toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  useHydrated();
  const reduced = useSettings((s) => s.reducedMotion);
  useEffect(() => {
    const apply = (s: ReturnType<typeof useSettings.getState>) => { audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted, voice: s.voice, charVoices: s.charVoices }); audio.setVoicePreference(s.voiceName); }
    apply(useSettings.getState());
    return useSettings.subscribe(apply);
  }, []);
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "user"}>
      {children}
      <Toaster />
    </MotionConfig>
  );
}
