"use client";
// The Trailfold board, drawn in one SVG: frosted tiles, walls, the numbered stops, arrows, rings and diamonds, and the
// line itself — a thick glowing ribbon whose colour shifts from start to finish. Pointer input: press a stop 1 (or any
// cell already on a line) and drag; a cell only counts once the finger is near its middle, so cutting a corner never
// steps into the wrong tile.
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DIRS, kindOf, type Puzzle } from "../kinds";
import type { Lines } from "../play";

const PINK = ["#FF7A45", "#FF3D7F"], BLUE = ["#2FD3FF", "#3D6BFF"];

export interface GridProps {
  p: Puzzle;
  L: Lines;
  /** cells to flash (hint) */
  glow: number[];
  /** cell that refused a move */
  bump: number;
  bumpKey: number;
  solved: boolean;
  hidden: boolean;
  onPress: (c: number) => void;
  onDrag: (c: number) => void;
  onRelease: () => void;
}

export const Grid = memo(function Grid({ p, L, glow, bump, bumpKey, solved, hidden, onPress, onDrag, onRelease }: GridProps) {
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
  const pad = 10;
  const cs = Math.max(18, Math.floor(Math.min((box.w - pad * 2) / p.cols, (box.h - pad * 2) / p.rows)));
  const W = cs * p.cols + pad * 2, H = cs * p.rows + pad * 2;
  const info = kindOf(p.kind);
  const cx = (c: number) => pad + (c % p.cols) * cs + cs / 2, cy = (c: number) => pad + Math.floor(c / p.cols) * cs + cs / 2;
  const drawing = useRef(false);

  const cellAt = (e: React.PointerEvent, strict: boolean) => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W - pad, y = ((e.clientY - r.top) / r.height) * H - pad;
    const col = Math.floor(x / cs), row = Math.floor(y / cs);
    if (col < 0 || row < 0 || col >= p.cols || row >= p.rows) return -1;
    if (strict) {
      // only near the middle of a tile while dragging (corners are dead zones)
      const dx = x - (col + 0.5) * cs, dy = y - (row + 0.5) * cs;
      if (Math.hypot(dx, dy) > cs * (p.kind === "diagonal" ? 0.36 : 0.46)) return -1;
    }
    const c = row * p.cols + col;
    return p.open[c] ? c : -1;
  };

  // the line as a path; Wrap Around splits a step that crosses an edge into two half-steps
  const lineD = (ln: number[]) => {
    if (!ln.length) return "";
    let d = `M${cx(ln[0])} ${cy(ln[0])}`;
    for (let i = 1; i < ln.length; i++) {
      const a = ln[i - 1], b = ln[i];
      const dr = Math.floor(b / p.cols) - Math.floor(a / p.cols), dc = (b % p.cols) - (a % p.cols);
      if (p.kind === "wrap" && (Math.abs(dr) > 1 || Math.abs(dc) > 1)) {
        const sr = Math.sign(dr) * -1, sc = Math.sign(dc) * -1;
        d += `L${cx(a) + sc * cs * 0.62} ${cy(a) + sr * cs * 0.62}M${cx(b) - sc * cs * 0.62} ${cy(b) - sr * cs * 0.62}L${cx(b)} ${cy(b)}`;
      } else d += `L${cx(b)} ${cy(b)}`;
    }
    return d;
  };
  const twin = p.kind === "twin";
  const stopsShown = useMemo(() => p.stops.map((s, c) => (s > 0 ? c : -1)).filter((c) => c >= 0), [p]);
  const onLine = useMemo(() => new Set([...L.a, ...L.b]), [L]);
  const heads = [L.a[L.a.length - 1], L.b[L.b.length - 1]].filter((c) => c !== undefined);

  return (
    <div ref={host} className="trl-host">
      <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={`trl-board ${solved ? "trl-solved" : ""}`}
        style={{ ["--c1" as string]: info.c1, ["--c2" as string]: info.c2 }}
        onPointerDown={(e) => { const c = cellAt(e, false); if (c < 0) return; (e.target as Element).setPointerCapture?.(e.pointerId); drawing.current = true; onPress(c); }}
        onPointerMove={(e) => { if (!drawing.current) return; const c = cellAt(e, true); if (c >= 0) onDrag(c); }}
        onPointerUp={() => { drawing.current = false; onRelease(); }} onPointerCancel={() => { drawing.current = false; onRelease(); }}>
        <defs>
          <linearGradient id="trl-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={twin ? PINK[0] : info.c1} /><stop offset="1" stopColor={twin ? PINK[1] : info.c2} /></linearGradient>
          <linearGradient id="trl-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={BLUE[0]} /><stop offset="1" stopColor={BLUE[1]} /></linearGradient>
          <filter id="trl-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={cs * 0.12} /></filter>
        </defs>
        {/* tiles */}
        {p.open.map((o, c) => o && (
          <rect key={c} x={pad + (c % p.cols) * cs + 2} y={pad + Math.floor(c / p.cols) * cs + 2} width={cs - 4} height={cs - 4} rx={cs * 0.22}
            className={`trl-tile ${onLine.has(c) ? "trl-tile-on" : ""} ${glow.includes(c) ? "trl-tile-glow" : ""}`} />
        ))}
        {/* wrap hints on the edges */}
        {p.kind === "wrap" && [0, 1, 2, 3].map((k) => (
          <rect key={`w${k}`} x={k === 3 ? 1 : k === 1 ? W - 5 : pad} y={k === 0 ? 1 : k === 2 ? H - 5 : pad} width={k % 2 ? 4 : W - pad * 2} height={k % 2 ? H - pad * 2 : 4} rx={2} fill="url(#trl-b)" opacity={0.55} />
        ))}
        {/* the lines: soft glow under a crisp ribbon */}
        {!hidden && [L.a, L.b].map((ln, k) => ln.length > 0 && (
          <g key={k}>
            <path d={lineD(ln)} fill="none" stroke={`url(#trl-${k ? "b" : "a"})`} strokeWidth={cs * 0.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} filter="url(#trl-glow)" />
            <path d={lineD(ln)} fill="none" stroke={`url(#trl-${k ? "b" : "a"})`} strokeWidth={cs * 0.4} strokeLinecap="round" strokeLinejoin="round" className="trl-line" />
          </g>
        ))}
        {/* walls */}
        {p.walls.map((w) => {
          const [a, b] = w.split("-").map(Number);
          const ra = Math.floor(a / p.cols), ca = a % p.cols, rb = Math.floor(b / p.cols), cb = b % p.cols;
          if (Math.abs(ra - rb) + Math.abs(ca - cb) !== 1) return null;
          const vertical = ra === rb;
          const x = vertical ? pad + Math.max(ca, cb) * cs : pad + ca * cs, y = vertical ? pad + ra * cs : pad + Math.max(ra, rb) * cs;
          return <rect key={w} x={vertical ? x - cs * 0.06 : x + cs * 0.04} y={vertical ? y + cs * 0.04 : y - cs * 0.06} width={vertical ? cs * 0.12 : cs * 0.92} height={vertical ? cs * 0.92 : cs * 0.12} rx={cs * 0.06} className="trl-wall" />;
        })}
        {/* arrows, rings and diamonds */}
        {p.arrows?.map((a, c) => a >= 0 && (
          <g key={`a${c}`} transform={`translate(${cx(c)} ${cy(c)}) rotate(${[0, 90, 180, 270][a]})`} className="trl-arrow">
            <path d={`M0 ${-cs * 0.3}L${cs * 0.2} ${-cs * 0.06}H${cs * 0.07}V${cs * 0.28}H${-cs * 0.07}V${-cs * 0.06}H${-cs * 0.2}Z`} />
          </g>
        ))}
        {p.marks?.map((m, c) => m === 1 ? <circle key={`m${c}`} cx={cx(c)} cy={cy(c)} r={cs * 0.17} className="trl-ring" strokeWidth={cs * 0.06} />
          : m === 2 ? <rect key={`m${c}`} x={cx(c) - cs * 0.13} y={cy(c) - cs * 0.13} width={cs * 0.26} height={cs * 0.26} rx={cs * 0.04} transform={`rotate(45 ${cx(c)} ${cy(c)})`} className="trl-diamond" /> : null)}
        {/* stops */}
        {stopsShown.map((c) => {
          const blue = p.line?.[c] === 1;
          const reached = (blue ? L.b : L.a).includes(c);
          return (
            <g key={`s${c}`} className="trl-stop">
              <circle cx={cx(c)} cy={cy(c)} r={cs * 0.33} fill={reached ? `url(#trl-${blue ? "b" : "a"})` : blue ? "#1d3a8a" : twin ? "#9c1f5c" : "#1c1533"} stroke="#fff" strokeWidth={cs * 0.05} />
              <text x={cx(c)} y={cy(c)} dy="0.36em" textAnchor="middle" fontSize={cs * 0.34} className="trl-stop-n">{hidden ? "" : p.stops[c]}</text>
            </g>
          );
        })}
        {/* the heads pulse */}
        {!hidden && heads.map((h, k) => <circle key={`h${k}`} cx={cx(h)} cy={cy(h)} r={cs * 0.18} className="trl-head" />)}
        {bump >= 0 && <rect key={`b${bumpKey}`} x={pad + (bump % p.cols) * cs + 2} y={pad + Math.floor(bump / p.cols) * cs + 2} width={cs - 4} height={cs - 4} rx={cs * 0.22} className="trl-bump" />}
      </svg>
    </div>
  );
});

export { DIRS };
