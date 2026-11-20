"use client";
// Racing settings: controls (buttons / steering wheel / tilt with the iOS motion permission), Auto drive (off by default),
// control side & size, sensitivity, vibration, fullscreen-landscape; view (camera, minimap, standings,
// units); graphics; and progress stats with a guarded reset.
import { useState } from "react";
import { Gamepad2, Eye, Cpu, BarChart3, Keyboard, RotateCcw, Smartphone } from "lucide-react";
import { AppBar, Btn, Seg, Sheet, Toggle, useIsTouch, useViewport, sfx } from "./kit";
import { gameOf } from "../games";
import type { RacingSettings, RacingSave } from "../save";

type DOE = { requestPermission?: () => Promise<string> };
export async function askMotionPermission(): Promise<boolean> {
  const D = (typeof DeviceOrientationEvent !== "undefined" ? DeviceOrientationEvent : null) as unknown as DOE | null;
  if (!D) return false;
  if (typeof D.requestPermission !== "function") return true;
  try { return (await D.requestPermission()) === "granted"; } catch { return false; }
}

function Row({ title, sub, children, stack = false }: { title: string; sub?: string; children: React.ReactNode; stack?: boolean }) {
  return (
    <div className={`flex gap-2 rounded-2xl bg-white/[0.05] px-3 py-2 ring-1 ring-white/10 ${stack ? "flex-col" : "items-center"}`}>
      <div className="min-w-0 flex-1"><p className="font-display text-[15px] leading-tight">{title}</p>{sub && <p className="text-[12px] leading-snug text-white/55">{sub}</p>}</div>
      <div className={stack ? "w-full" : "shrink-0"}>{children}</div>
    </div>
  );
}
function Section({ icon: I, title, children }: { icon: typeof Eye; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 font-display text-[13px] tracking-[0.2em] text-[#7CF2FF] uppercase"><I className="size-4" />{title}</p>
      {children}
    </section>
  );
}

export function SettingsScreen({ settings: st, set, save, onReset, onBack }: { settings: RacingSettings; set: (p: Partial<RacingSettings>) => void; save: RacingSave; onReset: () => void; onBack: () => void }) {
  const vp = useViewport();
  const touch = useIsTouch();
  const [confirm, setConfirm] = useState(false);
  const [motionMsg, setMotionMsg] = useState<string | null>(null);

  const pickControls = async (v: RacingSettings["controls"]) => {
    if (v === "tilt") {
      const ok = await askMotionPermission();
      if (!ok) { setMotionMsg("Tilt needs motion access — allow it in your browser, or use buttons."); set({ controls: "buttons" }); return; }
      setMotionMsg(null);
    }
    set({ controls: v });
  };

  const controls = (
    <Section icon={Gamepad2} title="Controls">
      <Row title="Steering" sub={st.controls === "tilt" ? "Tilt your phone like a steering wheel" : st.controls === "wheel" ? "Drag the on-screen wheel" : "Big left / right buttons"} stack>
        <Seg value={st.controls} onChange={(v) => void pickControls(v)} options={[{ v: "buttons", label: "◀ ▶ Buttons" }, { v: "wheel", label: "🛞 Wheel" }, { v: "tilt", label: "📱 Tilt" }]} />
        {motionMsg && <p className="mt-1.5 text-[12px] text-[#FF8A9A]">{motionMsg}</p>}
      </Row>
      <Row title="Auto drive" sub={st.autoDrive ? "On: the car speeds up and keeps to the road by itself — you steer, brake and boost" : "Off: you drive — hold GAS (or ▲ / W) to go and steer yourself"}>
        <Toggle on={st.autoDrive} onChange={(v) => set({ autoDrive: v })} label="Auto drive" />
      </Row>
      {st.controls !== "buttons" && (
        <Row title="Sensitivity" sub={`${Math.round(st.sensitivity * 100)}%`} stack>
          <Seg value={st.sensitivity} onChange={(v) => set({ sensitivity: v })} options={[{ v: 0.6, label: "Low" }, { v: 1, label: "Normal" }, { v: 1.4, label: "High" }, { v: 1.8, label: "Max" }]} />
        </Row>
      )}
      <Row title="Steering side" stack>
        <Seg value={st.leftHanded ? 1 : 0} onChange={(v) => set({ leftHanded: v === 1 })} options={[{ v: 0, label: "Steer on left" }, { v: 1, label: "Steer on right" }]} />
      </Row>
      <Row title="Button size" stack>
        <Seg value={st.controlSize} onChange={(v) => set({ controlSize: v })} options={[{ v: 0.85, label: "Small" }, { v: 1, label: "Normal" }, { v: 1.15, label: "Big" }]} />
      </Row>
      <Row title="Vibration" sub="Buzz on crashes, nitro and the finish"><Toggle on={st.vibrate} onChange={(v) => { set({ vibrate: v }); if (v) navigator.vibrate?.(40); }} label="Vibration" /></Row>
      {touch && <Row title="Fullscreen landscape" sub="Turn sideways & go fullscreen when a race starts"><Toggle on={st.landscape} onChange={(v) => set({ landscape: v })} label="Fullscreen landscape racing" /></Row>}
    </Section>
  );
  const view = (
    <Section icon={Eye} title="View">
      <Row title="Camera" stack>
        <Seg value={st.camera} onChange={(v) => set({ camera: v })} options={[{ v: "chase", label: "Chase" }, { v: "far", label: "Far" }, { v: "hood", label: "Hood" }, { v: "bumper", label: "Bumper" }]} />
      </Row>
      <Row title="Minimap"><Toggle on={st.showMap} onChange={(v) => set({ showMap: v })} label="Minimap" /></Row>
      <Row title="Live standings"><Toggle on={st.showStandings} onChange={(v) => set({ showStandings: v })} label="Live standings" /></Row>
      <Row title="Speed units" stack>
        <Seg value={st.units} onChange={(v) => set({ units: v })} options={[{ v: "kmh", label: "km/h" }, { v: "mph", label: "mph" }]} />
      </Row>
    </Section>
  );
  const gfx = (
    <Section icon={Cpu} title="Graphics">
      <Row title="Quality" sub={{ auto: "Picks the best for this device", low: "Fastest — for older phones", medium: "Balanced", high: "Shadows & sharp details" }[st.quality]} stack>
        <Seg value={st.quality} onChange={(v) => set({ quality: v })} options={[{ v: "auto", label: "Auto" }, { v: "low", label: "Low" }, { v: "medium", label: "Med" }, { v: "high", label: "High" }]} />
      </Row>
    </Section>
  );
  const stats = (
    <Section icon={BarChart3} title="Your racing">
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {([["Races", save.races], ["Wins", save.wins], ["Podiums", save.podiums ?? 0], ["Takedowns", save.takedowns ?? 0], ["Top km/h", save.topSpeed ?? 0], ["Coins won", save.coinsEarned]] as const).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-black/30 py-1.5 ring-1 ring-white/10"><p className="font-display text-lg leading-tight">{Number(v).toLocaleString()}</p><p className="text-[10px] font-bold tracking-wider text-white/50 uppercase">{k}</p></div>
        ))}
      </div>
      {!touch && (
        <div className="rounded-2xl bg-white/[0.05] p-3 text-[13px] text-white/70 ring-1 ring-white/10">
          <p className="mb-1 flex items-center gap-1.5 font-display text-white"><Keyboard className="size-4" />Keyboard</p>
          <p>← → / A D steer · ▲ W gas · ▼ S brake · Shift / Space nitro · X drift · C camera · P pause</p>
        </div>
      )}
      <button type="button" onClick={() => { sfx("a:blip", 0.3); setConfirm(true); }} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white/55 ring-1 ring-white/10 active:scale-95"><RotateCcw className="size-4" />Reset racing progress</button>
    </Section>
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <AppBar title="Settings" sub={gameOf().slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")} onBack={onBack} />
      <div className="nr-scroll min-h-0 flex-1 overflow-y-auto pt-3" style={{ paddingLeft: "calc(var(--safe-left, 0px) + 0.75rem)", paddingRight: "calc(var(--safe-right, 0px) + 0.75rem)", paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}>
        <div className={`mx-auto grid max-w-5xl gap-4 ${!vp.portrait || vp.w >= 700 ? "grid-cols-2" : ""}`}>
          <div className="flex flex-col gap-4">{controls}</div>
          <div className="flex flex-col gap-4">{view}{gfx}{stats}</div>
        </div>
        {touch && vp.portrait && <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-white/45"><Smartphone className="size-4 rotate-90" />Tip: racing feels best with your phone sideways.</p>}
      </div>
      <Sheet open={confirm} onClose={() => setConfirm(false)} label="Reset progress">
        <div className="p-5 pt-6 text-center">
          <p className="text-4xl">⚠️</p>
          <p className="mt-2 font-display text-2xl">Reset all racing progress?</p>
          <p className="mt-1 text-sm text-white/65">Stars, best times, cars, paint and upgrades go back to the start. Your coins stay.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Btn tone="ghost" onClick={() => setConfirm(false)}>Keep it</Btn>
            <Btn tone="red" sound="a:fail" onClick={() => { onReset(); setConfirm(false); }}>Reset</Btn>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
