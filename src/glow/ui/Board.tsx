"use client";
// The Glowfold board: dark glass cells, glowing orbs (Ember = warm flame, Frost = icy flake, Bloom = green leaf), neon
// = and × chips on the seams, box outlines for Glow Boxes, edge arrows for Wrap Around. Tap to cycle a cell; rule
// breaks pulse red, finished lines sweep with light.
import { memo, useLayoutEffect, useRef, useState } from "react";
import { kindOf, type Puzzle } from "../kinds";

export const ORB_COL = ["", "#FF8A3D", "#2FD6FF", "#3DFF9A"];

function Orb({ v, cx, cy, r }: { v: number; cx: number; cy: number; r: number }) {
  const id = `glw-o${v}`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 1.35} fill={ORB_COL[v]} opacity={0.22} filter="url(#glw-blur)" />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
      {v === 1 && <path d={`M${cx} ${cy - r * 0.55}C${cx + r * 0.42} ${cy - r * 0.1} ${cx + r * 0.38} ${cy + r * 0.45} ${cx} ${cy + r * 0.5}C${cx - r * 0.38} ${cy + r * 0.45} ${cx - r * 0.42} ${cy - r * 0.05} ${cx - r * 0.08} ${cy - r * 0.2}C${cx - r * 0.02} ${cy} ${cx + r * 0.12} ${cy - r * 0.1} ${cx} ${cy - r * 0.55}Z`} fill="#fff" opacity={0.85} />}
      {v === 2 && [0, 60, 120].map((a) => <line key={a} x1={cx} y1={cy - r * 0.5} x2={cx} y2={cy + r * 0.5} stroke="#fff" strokeWidth={r * 0.13} strokeLinecap="round" opacity={0.9} transform={`rotate(${a} ${cx} ${cy})`} />)}
      {v === 3 && <path d={`M${cx - r * 0.4} ${cy + r * 0.4}C${cx - r * 0.4} ${cy - r * 0.2} ${cx} ${cy - r * 0.5} ${cx + r * 0.45} ${cy - r * 0.45}C${cx + r * 0.45} ${cy} ${cx + r * 0.1} ${cy + r * 0.4} ${cx - r * 0.4} ${cy + r * 0.4}Z`} fill="#fff" opacity={0.85} />}
    </g>
  );
}

export interface BoardProps {
  p: Puzzle;
  v: number[];
  bad: Set<number>;
  badSigns: Set<string>;
  sweep: Map<number, number>;
  sweepKey: number;
  glow: number;
  glowKey: number;
  hidden: boolean;
  onTap: (i: number) => void;
}

export const Board = memo(function Board({ p, v, bad, badSigns, sweep, sweepKey, glow, glowKey, hidden, onTap }: BoardProps) {
  const host = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 340, h: 340 });
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const pad = 12, n = p.n;
  const cs = Math.max(20, Math.floor(Math.min(box.w - pad * 2, box.h - pad * 2) / n));
  const W = cs * n + pad * 2;
  const X = (c: number) => pad + c * cs, Y = (r: number) => pad + r * cs;
  const info = kindOf(p.kind);
  const boxEdges: string[] = [];
  if (p.boxes) for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    if (c < n - 1 && p.boxes[i] !== p.boxes[i + 1]) boxEdges.push(`M${X(c + 1)} ${Y(r)}V${Y(r + 1)}`);
    if (r < n - 1 && p.boxes[i] !== p.boxes[i + n]) boxEdges.push(`M${X(c)} ${Y(r + 1)}H${X(c + 1)}`);
  }
  return (
    <div ref={host} className="glw-host">
      <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} className="glw-board" style={{ ["--c1" as string]: info.c1, ["--c2" as string]: info.c2 }}>
        <defs>
          <filter id="glw-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={cs * 0.12} /></filter>
          {[1, 2, 3].map((o) => (
            <radialGradient key={o} id={`glw-o${o}`} cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="0.3" stopColor={ORB_COL[o]} /><stop offset="1" stopColor={o === 1 ? "#B8370F" : o === 2 ? "#0E6FA8" : "#0F8F55"} />
            </radialGradient>
          ))}
        </defs>
        {v.map((x, i) => {
          const r = Math.floor(i / n), c = i % n, given = p.givens[i] > 0;
          const w = sweep.get(i);
          return (
            <g key={i} onPointerDown={(e) => { e.preventDefault(); onTap(i); }} className="glw-cellg">
              <rect x={X(c) + 2} y={Y(r) + 2} width={cs - 4} height={cs - 4} rx={cs * 0.2}
                className={`glw-cell ${given ? "glw-given" : ""} ${bad.has(i) ? "glw-bad" : ""}`}
                style={w !== undefined ? { animation: `glw-sweep 700ms ${w}ms ease both` } : undefined} key={w !== undefined ? `s${sweepKey}` : "n"} />
              {!hidden && x > 0 && <Orb v={x} cx={X(c) + cs / 2} cy={Y(r) + cs / 2} r={cs * (given ? 0.3 : 0.33)} />}
              {given && !hidden && <circle cx={X(c) + cs * 0.84} cy={Y(r) + cs * 0.16} r={cs * 0.045} fill="#fff" opacity={0.5} />}
            </g>
          );
        })}
        {boxEdges.length > 0 && <path d={boxEdges.join("")} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={Math.max(2, cs * 0.06)} strokeLinecap="round" />}
        {p.kind === "wrap" && [0, 1, 2, 3].map((k) => (
          <rect key={k} x={k === 3 ? 2 : k === 1 ? W - 6 : pad} y={k === 0 ? 2 : k === 2 ? W - 6 : pad} width={k % 2 ? 4 : W - pad * 2} height={k % 2 ? W - pad * 2 : 4} rx={2} fill={info.c1} opacity={0.6} />
        ))}
        {Object.entries(p.signs).map(([e, s]) => {
          const [a, b] = e.split("-").map(Number);
          const ra = Math.floor(a / n), ca = a % n;
          const vertical = b === a + 1;
          const x = vertical ? X(ca + 1) : X(ca) + cs / 2, y = vertical ? Y(ra) + cs / 2 : Y(ra + 1);
          const R = cs * 0.15, broken = badSigns.has(e);
          return (
            <g key={e} className="glw-sign">
              <circle cx={x} cy={y} r={R} className={broken ? "glw-sign-bad" : "glw-sign-bg"} />
              {s === "=" ? <><line x1={x - R * 0.45} y1={y - R * 0.25} x2={x + R * 0.45} y2={y - R * 0.25} /><line x1={x - R * 0.45} y1={y + R * 0.25} x2={x + R * 0.45} y2={y + R * 0.25} /></>
                : <><line x1={x - R * 0.38} y1={y - R * 0.38} x2={x + R * 0.38} y2={y + R * 0.38} /><line x1={x + R * 0.38} y1={y - R * 0.38} x2={x - R * 0.38} y2={y + R * 0.38} /></>}
            </g>
          );
        })}
        {glow >= 0 && <rect key={`g${glowKey}`} x={X(glow % n) + 1} y={Y(Math.floor(glow / n)) + 1} width={cs - 2} height={cs - 2} rx={cs * 0.2} className="glw-hint" />}
      </svg>
    </div>
  );
});
