"use client";
// The performance overlay: add ?perf=1 to a game's play link (or turn on "FPS meter"-style debugging) to see, on the
// device itself, what the game costs — frames a second, the slowest frame, long main-thread pauses (the "hangs"),
// JavaScript memory, and the shared kit's choices (device tier, resolution, frame cap). Measures in refs and redraws
// twice a second, so it costs next to nothing itself.
import { useEffect, useRef, useState } from "react";
import { autoQuality, deviceTier, isPhone, pixelRatioFor } from "@/lib/perf";

interface Stats { fps: number; worst: number; longs: number; heap: number | null }

export function PerfOverlay({ cap }: { cap: number }) {
  const [st, setSt] = useState<Stats>({ fps: 0, worst: 0, longs: 0, heap: null });
  const acc = useRef({ frames: 0, worst: 0, last: 0, longs: 0 });
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      const a = acc.current;
      if (a.last) a.worst = Math.max(a.worst, t - a.last);
      a.last = t; a.frames++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    let obs: PerformanceObserver | null = null;
    try { obs = new PerformanceObserver((l) => { acc.current.longs += l.getEntries().length; }); obs.observe({ type: "longtask", buffered: false }); } catch { obs = null; }
    const iv = window.setInterval(() => {
      const a = acc.current, mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      setSt({ fps: a.frames * 2, worst: Math.round(a.worst), longs: a.longs, heap: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null });
      a.frames = 0; a.worst = 0;
    }, 500);
    return () => { cancelAnimationFrame(raf); window.clearInterval(iv); obs?.disconnect(); };
  }, []);
  const q = autoQuality();
  const bad = st.fps > 0 && (st.fps < (cap || 60) * 0.8 || st.worst > 50);
  return (
    <div className="pointer-events-none fixed top-14 left-2 z-[999] rounded-lg bg-black/80 px-2 py-1 font-mono text-[10px] leading-tight text-white">
      <div className={bad ? "text-[#FF8A8A]" : "text-[#8AFFB0]"}>{st.fps} fps · worst {st.worst} ms</div>
      <div>long pauses {st.longs}{st.heap !== null ? ` · heap ${st.heap} MB` : ""}</div>
      <div className="opacity-70">{isPhone() ? "phone" : "computer"} · tier {deviceTier()} · {q} · px {pixelRatioFor(q).toFixed(2)} · cap {cap || "off"}</div>
    </div>
  );
}
