"use client";
import { useEffect, useState } from "react";
import { audio } from "@/lib/audio";
import { Gamepad2, Keyboard, Monitor, Music, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useHydrated, useSettings, type Quality, type Settings } from "@/lib/store";

type Tab = "audio" | "graphics" | "gameplay" | "controls";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="font-semibold leading-tight">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-faint">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-14 rounded-full transition-colors ${on ? "bg-lime" : "bg-white/15"}`}
    >
      <span className={`absolute top-1 size-6 rounded-full bg-white shadow-md transition-all duration-200 ${on ? "left-7" : "left-1"}`} />
    </button>
  );
}

function Slider({ value, onChange, label, min = 0, max = 1, step = 0.05, fmt }: { value: number; onChange: (v: number) => void; label: string; min?: number; max?: number; step?: number; fmt?: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
      <input
        type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-2 w-36 cursor-pointer appearance-none rounded-full sm:w-44 [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_0_#23305A,0_4px_10px_rgb(0_0_0/0.4)] [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white"
        style={{ background: `linear-gradient(90deg, var(--color-sun) ${pct}%, rgb(255 255 255 / 0.15) ${pct}%)` }}
      />
      <span className="w-11 text-right font-display text-sm tabular-nums text-muted">{fmt ? fmt(value) : `${Math.round(value * 100)}%`}</span>
    </div>
  );
}

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-white/8 p-1 ring-1 ring-white/10">
      {options.map((o) => (
        <button
          key={String(o.v)}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${value === o.v ? "bg-sun text-ink shadow" : "text-muted hover:text-text"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function VoicePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [voices, setVoices] = useState<{ name: string; lang: string }[]>([]);
  useEffect(() => {
    const load = () => setVoices(audio.voiceList().map((v) => ({ name: v.name, lang: v.lang })));
    load();
    window.speechSynthesis?.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", load);
  }, []);
  if (!voices.length) return null;
  return (
    <Row label="Voice" hint="Natural voices are listed first">
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => { onChange(e.target.value); audio.setVoicePreference(e.target.value); audio.ensure(); audio.say("Hi! I'm your game voice.", { pitch: 1.2 }); }}
          aria-label="Voice"
          className="max-w-40 rounded-xl bg-white/10 px-2 py-2 text-sm font-semibold ring-1 ring-white/15 sm:max-w-56"
        >
          <option value="" className="bg-night">Auto (best)</option>
          {voices.map((v) => <option key={v.name} value={v.name} className="bg-night">{v.name.replace(/^Microsoft |^Google /, "")}</option>)}
        </select>
        <button onClick={() => { audio.ensure(); audio.say("Level five! Great job!", { pitch: 1.2 }); }} className="btn-clay sm mint">Test</button>
      </div>
    </Row>
  );
}

export function SettingsForm({ compact = false, fullscreenNote = false }: { compact?: boolean; fullscreenNote?: boolean }) {
  const ok = useHydrated();
  const s = useSettings();
  const set = (p: Partial<Settings>) => s.set(p);
  const [tab, setTab] = useState<Tab>("audio");
  const tabs: { id: Tab; label: string; icon: typeof Music }[] = [
    { id: "audio", label: "Sound", icon: Music },
    { id: "graphics", label: "Graphics", icon: Monitor },
    { id: "gameplay", label: "Gameplay", icon: Sparkles },
    { id: "controls", label: "Controls", icon: Keyboard },
  ];
  if (!ok) return <div className="h-64 animate-pulse rounded-2xl bg-white/5" />;
  return (
    <div>
      <div role="tablist" className="no-scrollbar -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1">
        {tabs.map((t) => {
          const I = t.icon;
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`chip !px-3.5 !py-2 ${tab === t.id ? "active" : ""}`}>
              <I className="size-4" /> {t.label}
            </button>
          );
        })}
      </div>
      <div className={`divide-y divide-white/8 ${compact ? "" : "glass rounded-3xl px-5"}`}>
        {tab === "audio" && (
          <>
            <Row label="Sound" hint="All game sounds and music">
              <button onClick={() => set({ muted: !s.muted })} className={`btn-clay sm ${s.muted ? "ghost" : "mint"}`}>
                {s.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />} {s.muted ? "Muted" : "On"}
              </button>
            </Row>
            <Row label="Master volume"><Slider label="Master volume" value={s.master} onChange={(v) => set({ master: v })} /></Row>
            <Row label="Music" hint="Original Track Momo game-show music"><Slider label="Music volume" value={s.music} onChange={(v) => set({ music: v })} /></Row>
            <Row label="Sound effects" hint="Whooshes, pops, boings and Kranky"><Slider label="Sound effects volume" value={s.sfx} onChange={(v) => set({ sfx: v })} /></Row>
            <Row label="Character voices" hint="Funny gibberish voices for Pip, Gloop, Hoot…"><Toggle label="Character voices" on={s.charVoices} onChange={(v) => set({ charVoices: v })} /></Row>
            <Row label="Voice-over" hint="Spoken lines like “Level 5!” using your device voice"><Toggle label="Voice-over" on={s.voice} onChange={(v) => set({ voice: v })} /></Row>
            {s.voice && <VoicePicker value={s.voiceName} onChange={(v) => set({ voiceName: v })} />}
          </>
        )}
        {tab === "graphics" && (
          <>
            <Row label="Quality" hint="Auto adapts to your device">
              <Seg<Quality> label="Quality" value={s.quality} onChange={(v) => set({ quality: v })} options={[{ v: "auto", l: "Auto" }, { v: "low", l: "Low" }, { v: "medium", l: "Mid" }, { v: "high", l: "High" }]} />
            </Row>
            <Row label="Resolution" hint="Lower = faster on older phones">
              <Slider label="Resolution" value={s.renderScale} min={0.5} max={1} step={0.05} onChange={(v) => set({ renderScale: v })} />
            </Row>
            <Row label="Frame rate cap">
              <Seg<0 | 30 | 60> label="Frame rate cap" value={s.fpsCap} onChange={(v) => set({ fpsCap: v })} options={[{ v: 30, l: "30" }, { v: 60, l: "60" }, { v: 0, l: "Max" }]} />
            </Row>
            <Row label="Claymation 12 FPS look" hint="Stop-motion style, just like the videos"><Toggle label="Claymation look" on={s.stopMotion} onChange={(v) => set({ stopMotion: v })} /></Row>
            <Row label="Shadows"><Toggle label="Shadows" on={s.shadows} onChange={(v) => set({ shadows: v })} /></Row>
            <Row label="Show FPS counter"><Toggle label="Show FPS" on={s.showFps} onChange={(v) => set({ showFps: v })} /></Row>
          </>
        )}
        {tab === "gameplay" && (
          <>
            <Row label="Relaxed Mode" hint="Slower, calmer games with more help"><Toggle label="Relaxed Mode" on={s.speedAssist} onChange={(v) => set({ speedAssist: v })} /></Row>
            <Row label="Auto next round" hint="Keep playing without tapping"><Toggle label="Auto next round" on={s.autoContinue} onChange={(v) => set({ autoContinue: v })} /></Row>
            {s.autoContinue && (
              <Row label="Wait before next round">
                <Slider label="Delay" value={s.autoDelay} min={0.5} max={4} step={0.5} fmt={(v) => `${v}s`} onChange={(v) => set({ autoDelay: v })} />
              </Row>
            )}
            <Row label="Cup numbers" hint="Show 1, 2, 3… when it's time to pick"><Toggle label="Cup numbers" on={s.showNumbers} onChange={(v) => set({ showNumbers: v })} /></Row>
            <Row label="Big buttons" hint="Larger tap targets for little fingers"><Toggle label="Big buttons" on={s.bigButtons} onChange={(v) => set({ bigButtons: v })} /></Row>
            <Row label="Camera shake"><Toggle label="Camera shake" on={s.cameraShake} onChange={(v) => set({ cameraShake: v })} /></Row>
            <Row label="Vibration" hint="Android phones only"><Toggle label="Vibration" on={s.haptics} onChange={(v) => set({ haptics: v })} /></Row>
            <Row label="Reduce motion" hint="Calmer menus and camera"><Toggle label="Reduce motion" on={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} /></Row>
          </>
        )}
        {tab === "controls" && (
          <div className="py-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["Tap / Click", "Pick a cup"], ["1 – 6", "Pick cup by number"], ["← →", "Move selection"], ["Enter", "Pick / next round"],
                ["Space · P · Esc", "Pause"], ["M", "Mute"], ["F", "Fullscreen"],
              ].map(([k, a]) => (
                <div key={k} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
                  <span className="text-muted">{a}</span>
                  <kbd className="rounded-lg bg-white/12 px-2 py-1 font-display text-sm">{k}</kbd>
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Gamepad2 className="size-5 text-mint" /> Gamepads work too: D-pad to move, A to pick, Start to pause.</p>
            {fullscreenNote && <p className="mt-2 text-sm text-faint">On iPhone, tap Share → “Add to Home Screen” to play full screen like an app.</p>}
          </div>
        )}
      </div>
      {!compact && (
        <button onClick={() => s.reset()} className="mt-4 text-sm font-semibold text-faint underline-offset-4 hover:text-text hover:underline">Reset all settings</button>
      )}
    </div>
  );
}
