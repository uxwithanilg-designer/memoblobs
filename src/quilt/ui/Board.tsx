"use client";
// The Quiltfold board, one SVG: a linen base with a faint stitch grid, gaps cut out, fences stitched in thick thread,
// the numbers sewn on as buttons, and every patch drawn as a puffy fabric square in its button's colour with a dashed
// stitch round the inside. Press and drag to cut a rectangle (a live outline shows its size); tap a patch to lift it.
import { memo, useLayoutEffect, useRef, useState } from "react";
import { area, kindOf, type Puzzle, type Rect } from "../kinds";
import { judge, rectFrom, twinClash } from "../play";

export const FABRIC = ["#FF8A5B", "#5B8CFF", "#2FC6A0", "#FFC23D", "#E8579A", "#8B5CF6", "#4FB3E8", "#7CB342", "#FF6B6B", "#F59E0B", "#14B8A6", "#A855F7", "#EC4899", "#38BDF8"];

export interface BoardProps {
  p: Puzzle;
  patches: Rect[];
  flash: Rect | null;
  flashKey: number;
  hidden: boolean;
  onCut: (a: number, b: number) => void;
}

export const Board = memo(function Board({ p, patches, flash, flashKey, hidden, onCut }: BoardProps) {
  const host = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 340, h: 340 });
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const pad = 12;
  const cs = Math.max(16, Math.floor(Math.min((box.w - pad * 2) / p.cols, (box.h - pad * 2) / p.rows)));
  const W = cs * p.cols + pad * 2, H = cs * p.rows + pad * 2;
  const X = (c: number) => pad + c * cs, Y = (r: number) => pad + r * cs;
  const info = kindOf(p.kind);

  const cellAt = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W - pad, y = ((e.clientY - r.top) / r.height) * H - pad;
    const col = Math.min(p.cols - 1, Math.max(0, Math.floor(x / cs))), row = Math.min(p.rows - 1, Math.max(0, Math.floor(y / cs)));
    return row * p.cols + col;
  };
  // a colour per clue, in board order
  const clueIdx = new Map<number, number>();
  p.clue.forEach((v, c) => { if (v !== 0) clueIdx.set(c, clueIdx.size); });
  const judged = judge(p, patches);
  const clash = twinClash(p, patches);
  const preview = drag ? rectFrom(p.cols, drag.a, drag.b) : null;

  const patchEl = (x: Rect, fill: string, state: string, key: string, extra = "") => {
    const inset = Math.max(2, cs * 0.06);
    return (
      <g key={key} className={`qlt-patch qlt-${state} ${extra}`}>
        <rect x={X(x.c) + inset} y={Y(x.r) + inset} width={x.w * cs - inset * 2} height={x.h * cs - inset * 2} rx={cs * 0.2} fill={fill} />
        <rect x={X(x.c) + inset} y={Y(x.r) + inset} width={x.w * cs - inset * 2} height={x.h * cs - inset * 2} rx={cs * 0.2} fill="url(#qlt-puff)" />
        <rect x={X(x.c) + inset * 2.6} y={Y(x.r) + inset * 2.6} width={x.w * cs - inset * 5.2} height={x.h * cs - inset * 5.2} rx={cs * 0.14}
          fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={Math.max(1.2, cs * 0.035)} strokeDasharray={`${cs * 0.09} ${cs * 0.07}`} />
      </g>
    );
  };

  return (
    <div ref={host} className="qlt-host">
      <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="qlt-board" style={{ ["--c1" as string]: info.c1, ["--c2" as string]: info.c2 }}
        onPointerDown={(e) => { const c = cellAt(e); (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ a: c, b: c }); }}
        onPointerMove={(e) => { if (!drag) return; const c = cellAt(e); if (c !== drag.b) setDrag({ ...drag, b: c }); }}
        onPointerUp={() => { if (drag) onCut(drag.a, drag.b); setDrag(null); }}
        onPointerCancel={() => setDrag(null)}>
        <defs>
          <linearGradient id="qlt-puff" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.35" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.14" />
          </linearGradient>
          <pattern id="qlt-bad" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="#fff" fillOpacity="0.35" /></pattern>
        </defs>
        {/* linen cells with a faint stitch grid */}
        {p.open.map((o, c) => o ? (
          <rect key={c} x={X(c % p.cols) + 1} y={Y(Math.floor(c / p.cols)) + 1} width={cs - 2} height={cs - 2} rx={cs * 0.12} className="qlt-cell" />
        ) : (
          <rect key={c} x={X(c % p.cols) + cs * 0.12} y={Y(Math.floor(c / p.cols)) + cs * 0.12} width={cs * 0.76} height={cs * 0.76} rx={cs * 0.18} className="qlt-gap" />
        ))}
        {/* patches */}
        {!hidden && judged.map((j, k) => {
          const fill = j.clue >= 0 ? FABRIC[(clueIdx.get(j.clue) ?? 0) % FABRIC.length] : "#b9b0c9";
          const state = clash.has(k) ? "bad" : j.state;
          return (
            <g key={`${j.rect.r}-${j.rect.c}-${j.rect.h}-${j.rect.w}`}>
              {patchEl(j.rect, fill, state, "p")}
              {state === "bad" && <rect x={X(j.rect.c) + 3} y={Y(j.rect.r) + 3} width={j.rect.w * cs - 6} height={j.rect.h * cs - 6} rx={cs * 0.2} fill="url(#qlt-bad)" className="qlt-badfill" />}
            </g>
          );
        })}
        {flash && <rect key={`f${flashKey}`} x={X(flash.c) + 2} y={Y(flash.r) + 2} width={flash.w * cs - 4} height={flash.h * cs - 4} rx={cs * 0.2} className="qlt-flash" />}
        {/* fences */}
        {p.fences.map((f) => {
          const [a, b] = f.split("-").map(Number);
          const ra = Math.floor(a / p.cols), ca = a % p.cols, rb = Math.floor(b / p.cols);
          const vertical = ra === rb;
          const x1 = vertical ? X(ca + 1) : X(ca), y1 = vertical ? Y(ra) : Y(ra + 1);
          return <line key={f} x1={x1 + (vertical ? 0 : cs * 0.08)} y1={y1 + (vertical ? cs * 0.08 : 0)} x2={vertical ? x1 : x1 + cs * 0.92} y2={vertical ? y1 + cs * 0.92 : y1} className="qlt-fence" strokeWidth={Math.max(3, cs * 0.12)} />;
        })}
        {/* the numbers, sewn on like buttons */}
        {p.clue.map((v, c) => {
          if (!v) return null;
          const x = X(c % p.cols) + cs / 2, y = Y(Math.floor(c / p.cols)) + cs / 2, s = p.shape?.[c] ?? 0;
          const col = FABRIC[(clueIdx.get(c) ?? 0) % FABRIC.length];
          return (
            <g key={`n${c}`} className="qlt-button">
              <circle cx={x} cy={y} r={cs * 0.32} fill="#fff" stroke={col} strokeWidth={cs * 0.07} />
              <text x={x} y={y} dy="0.36em" textAnchor="middle" fontSize={cs * (v < 0 ? 0.36 : v > 9 ? 0.3 : 0.36)} fill="#2d2440" className="qlt-num">{hidden ? "" : v < 0 ? "?" : v}</text>
              {s > 0 && (
                <g transform={`translate(${x + cs * 0.3} ${y - cs * 0.3})`}>
                  <circle r={cs * 0.15} fill={col} />
                  {s === 1 && <rect x={-cs * 0.065} y={-cs * 0.065} width={cs * 0.13} height={cs * 0.13} rx={1} fill="#fff" />}
                  {s === 2 && <rect x={-cs * 0.04} y={-cs * 0.09} width={cs * 0.08} height={cs * 0.18} rx={1} fill="#fff" />}
                  {s === 3 && <rect x={-cs * 0.09} y={-cs * 0.04} width={cs * 0.18} height={cs * 0.08} rx={1} fill="#fff" />}
                </g>
              )}
            </g>
          );
        })}
        {/* the rectangle being cut */}
        {preview && (
          <g className="qlt-preview">
            <rect x={X(preview.c) + 2} y={Y(preview.r) + 2} width={preview.w * cs - 4} height={preview.h * cs - 4} rx={cs * 0.2} />
            <text x={X(preview.c) + (preview.w * cs) / 2} y={Y(preview.r) + (preview.h * cs) / 2} dy="0.36em" textAnchor="middle" fontSize={Math.min(cs * 0.5, 26)}>{area(preview)}</text>
          </g>
        )}
      </svg>
    </div>
  );
});
