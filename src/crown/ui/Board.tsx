"use client";
// The Crownfold board: a stained-glass window. Each court is one jewel-toned glass colour, courts are framed by gold
// leading, crowns are gold with a ruby. Stones, watchtowers (with their count) and compass arrows sit in their
// squares. Tap a square to cycle × → crown → empty; drag to paint × (or wipe them, if the drag starts on a ×).
// Rule breaks pulse red, squares a crown rules out get a faint dot, finished lines and courts flash.
import { memo, useLayoutEffect, useRef, useState } from "react";
import { kindOf, type Puzzle } from "../kinds";
import { CROWN, MARK } from "../play";

/** jewel glass: [light, deep] */
export const GLASS: [string, string][] = [
  ["#F7A1AC", "#C9364B"], ["#9CC3FF", "#2D5FD0"], ["#A8E6B5", "#2E9A55"], ["#FFD98A", "#D08A12"], ["#D3B4FF", "#7B49D6"],
  ["#9EE8E4", "#169C95"], ["#FFB98F", "#D2601E"], ["#F2B5E3", "#B33A97"], ["#D9E79A", "#7E9A1A"], ["#C2CBDA", "#5B6B86"],
  ["#FFC7C7", "#D04848"], ["#B8E2FF", "#2F8CC9"],
];

export function CrownMark({ cx, cy, s, given = false }: { cx: number; cy: number; s: number; given?: boolean }) {
  // a gold crown, 1 unit = s; drawn around (cx, cy)
  const P = (x: number, y: number) => `${cx + x * s} ${cy + y * s}`;
  return (
    <g>
      <ellipse cx={cx} cy={cy + 0.36 * s} rx={0.46 * s} ry={0.1 * s} fill="#000" opacity={0.18} />
      <path d={`M${P(-0.42, 0.28)}L${P(-0.48, -0.2)}L${P(-0.22, 0.02)}L${P(0, -0.34)}L${P(0.22, 0.02)}L${P(0.48, -0.2)}L${P(0.42, 0.28)}Z`}
        fill="url(#crw-gold)" stroke={given ? "#6b3d00" : "#8a5200"} strokeWidth={s * 0.045} strokeLinejoin="round" />
      <rect x={cx - 0.43 * s} y={cy + 0.2 * s} width={0.86 * s} height={0.14 * s} rx={0.05 * s} fill="url(#crw-gold)" stroke="#8a5200" strokeWidth={s * 0.04} />
      {[-0.48, 0, 0.48].map((x, k) => <circle key={k} cx={cx + x * s} cy={cy + (k === 1 ? -0.38 : -0.23) * s} r={0.075 * s} fill="#FFF1B8" stroke="#8a5200" strokeWidth={s * 0.03} />)}
      <circle cx={cx} cy={cy + 0.06 * s} r={0.09 * s} fill={given ? "#2D5FD0" : "#E0254B"} stroke="#fff" strokeOpacity={0.6} strokeWidth={s * 0.025} />
      <path d={`M${P(-0.3, 0.12)}L${P(-0.34, -0.04)}`} stroke="#fff" strokeOpacity={0.7} strokeWidth={s * 0.05} strokeLinecap="round" />
    </g>
  );
}

export interface BoardProps {
  p: Puzzle;
  v: number[];
  bad: Set<number>;
  dots: Set<number>;
  sweep: Map<number, number>;
  sweepKey: number;
  glow: number;
  glowKey: number;
  hidden: boolean;
  onTap: (i: number) => void;
  /** a drag: begins with the first square, then every square it crosses; `to` is MARK or EMPTY */
  onPaint: (i: number, to: number, first: boolean) => void;
}

export const Board = memo(function Board({ p, v, bad, dots, sweep, sweepKey, glow, glowKey, hidden, onTap, onPaint }: BoardProps) {
  const host = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 340, h: 340 });
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const pad = 10, n = p.n;
  const cs = Math.max(22, Math.floor(Math.min(box.w - pad * 2, box.h - pad * 2) / n));
  const W = cs * n + pad * 2;
  const X = (c: number) => pad + c * cs, Y = (r: number) => pad + r * cs;
  const info = kindOf(p.kind);
  const rocks = new Set(p.rocks);
  const givens = new Set(p.givens);

  // court borders (gold leading)
  const lead: string[] = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    if (c < n - 1 && p.regions[i] !== p.regions[i + 1]) lead.push(`M${X(c + 1)} ${Y(r)}V${Y(r + 1)}`);
    if (r < n - 1 && p.regions[i] !== p.regions[i + n]) lead.push(`M${X(c)} ${Y(r + 1)}H${X(c + 1)}`);
  }

  // pointer: tap vs drag
  const drag = useRef<{ start: number; to: number; moved: boolean; last: number } | null>(null);
  const cellAt = (e: React.PointerEvent) => {
    const el = svg.current;
    if (!el) return -1;
    const b = el.getBoundingClientRect(), k = W / b.width;
    const x = (e.clientX - b.left) * k - pad, y = (e.clientY - b.top) * k - pad;
    const c = Math.floor(x / cs), r = Math.floor(y / cs);
    return c < 0 || r < 0 || c >= n || r >= n ? -1 : r * n + c;
  };
  const down = (e: React.PointerEvent) => {
    const i = cellAt(e);
    if (i < 0) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { start: i, to: v[i] === MARK ? 0 : MARK, moved: false, last: i };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const i = cellAt(e);
    if (i < 0 || i === d.last) return;
    if (!d.moved) { d.moved = true; if (v[d.start] !== CROWN) onPaint(d.start, d.to, true); }
    d.last = i;
    if (v[i] !== CROWN) onPaint(i, d.to, false);
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) onTap(d.start);
  };

  return (
    <div ref={host} className="crw-host">
      <svg ref={svg} width={W} height={W} viewBox={`0 0 ${W} ${W}`} className="crw-board" style={{ ["--c1" as string]: info.c1, ["--c2" as string]: info.c2 }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}>
        <defs>
          <linearGradient id="crw-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFF3B0" /><stop offset="0.45" stopColor="#FFC83D" /><stop offset="1" stopColor="#D98A0B" />
          </linearGradient>
          {GLASS.map(([a, b], k) => (
            <linearGradient key={k} id={`crw-g${k}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} stopOpacity={0.55} />
            </linearGradient>
          ))}
        </defs>
        <rect x={pad - 4} y={pad - 4} width={cs * n + 8} height={cs * n + 8} rx={10} fill="#2a1a08" />
        {v.map((x, i) => {
          const r = Math.floor(i / n), c = i % n, g = p.regions[i] % GLASS.length;
          const w = sweep.get(i);
          const cx = X(c) + cs / 2, cy = Y(r) + cs / 2;
          const tower = p.towers[i], arrow = p.arrows[i];
          return (
            <g key={i}>
              <rect x={X(c)} y={Y(r)} width={cs} height={cs} fill={`url(#crw-g${g})`} />
              <rect x={X(c)} y={Y(r)} width={cs} height={cs} className={`crw-cell ${bad.has(i) ? "crw-bad" : ""}`}
                style={w !== undefined ? { animation: `crw-sweep 750ms ${w}ms ease both` } : undefined} key={w !== undefined ? `s${sweepKey}` : "n"} />
              {!hidden && rocks.has(i) && (
                <g>
                  <path d={`M${cx - cs * 0.3} ${cy + cs * 0.22}L${cx - cs * 0.24} ${cy - cs * 0.08}L${cx - cs * 0.05} ${cy - cs * 0.24}L${cx + cs * 0.2} ${cy - cs * 0.16}L${cx + cs * 0.31} ${cy + cs * 0.1}L${cx + cs * 0.22} ${cy + cs * 0.24}Z`} fill="#7a6a5c" stroke="#3d3128" strokeWidth={cs * 0.04} strokeLinejoin="round" />
                  <path d={`M${cx - cs * 0.16} ${cy - cs * 0.04}L${cx + cs * 0.04} ${cy - cs * 0.14}`} stroke="#b9a999" strokeWidth={cs * 0.05} strokeLinecap="round" />
                </g>
              )}
              {!hidden && tower !== undefined && (
                <g>
                  <path d={`M${cx - cs * 0.28} ${cy + cs * 0.34}V${cy - cs * 0.2}H${cx - cs * 0.16}V${cy - cs * 0.32}H${cx - cs * 0.05}V${cy - cs * 0.2}H${cx + cs * 0.05}V${cy - cs * 0.32}H${cx + cs * 0.16}V${cy - cs * 0.2}H${cx + cs * 0.28}V${cy + cs * 0.34}Z`}
                    fill={bad.has(i) ? "#ff5a6e" : "#3b2a4d"} stroke="#FFC83D" strokeWidth={cs * 0.035} strokeLinejoin="round" />
                  <text x={cx} y={cy + cs * 0.2} textAnchor="middle" fontSize={cs * 0.42} className="crw-num">{tower}</text>
                </g>
              )}
              {!hidden && arrow !== undefined && (
                <g transform={`rotate(${arrow * 90} ${cx} ${cy})`}>
                  <circle cx={cx} cy={cy} r={cs * 0.33} fill={bad.has(i) ? "#ff5a6e" : "#3b2a4d"} stroke="#FFC83D" strokeWidth={cs * 0.035} />
                  <path d={`M${cx} ${cy - cs * 0.22}L${cx + cs * 0.15} ${cy - cs * 0.02}H${cx + cs * 0.06}V${cy + cs * 0.2}H${cx - cs * 0.06}V${cy - cs * 0.02}H${cx - cs * 0.15}Z`} fill="#FFE08A" />
                </g>
              )}
              {!hidden && x === MARK && <g className="crw-x"><path d={`M${cx - cs * 0.13} ${cy - cs * 0.13}L${cx + cs * 0.13} ${cy + cs * 0.13}M${cx + cs * 0.13} ${cy - cs * 0.13}L${cx - cs * 0.13} ${cy + cs * 0.13}`} strokeWidth={Math.max(2, cs * 0.07)} /></g>}
              {!hidden && x === 0 && dots.has(i) && <circle cx={cx} cy={cy} r={Math.max(1.8, cs * 0.05)} fill="#2a1a08" opacity={0.35} />}
              {!hidden && x === CROWN && <g className="crw-crown" key={`c${i}`} style={{ transformOrigin: `${cx}px ${cy}px` }}><CrownMark cx={cx} cy={cy} s={cs * 0.78} given={givens.has(i)} /></g>}
            </g>
          );
        })}
        {/* thin glass lines, then gold leading */}
        <path d={Array.from({ length: n - 1 }, (_, k) => `M${X(k + 1)} ${Y(0)}V${Y(n)}M${X(0)} ${Y(k + 1)}H${X(n)}`).join("")} stroke="#2a1a08" strokeOpacity={0.25} strokeWidth={1} />
        <path d={lead.join("")} stroke="#2a1a08" strokeWidth={Math.max(3, cs * 0.1)} strokeLinecap="round" />
        <path d={lead.join("")} stroke="#E7B23C" strokeWidth={Math.max(1.2, cs * 0.035)} strokeLinecap="round" opacity={0.9} />
        <rect x={pad} y={pad} width={cs * n} height={cs * n} fill="none" stroke="#E7B23C" strokeWidth={2.5} rx={4} />
        {p.kind === "wrap" && [0, 1, 2, 3].map((k) => (
          <rect key={k} x={k === 3 ? 1 : k === 1 ? W - 4 : pad} y={k === 0 ? 1 : k === 2 ? W - 4 : pad} width={k % 2 ? 3 : W - pad * 2} height={k % 2 ? W - pad * 2 : 3} rx={1.5} fill={info.c2} opacity={0.9} />
        ))}
        {glow >= 0 && <rect key={`g${glowKey}`} x={X(glow % n) + 2} y={Y(Math.floor(glow / n)) + 2} width={cs - 4} height={cs - 4} rx={cs * 0.15} className="crw-hint" />}
      </svg>
    </div>
  );
});
