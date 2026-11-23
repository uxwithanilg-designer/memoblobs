"use client";
// The Sudoku Ninefold board: soft clay tiles laid out cell by cell on a coloured tray, with wider gaps between boxes (so no
// thick lines are needed), and an overlay for each board's extra rule — dashed killer cages with their sums, clay
// thermometers, the X diagonals. Big boards (16×16, 25×25, Samurai) can zoom so every tile stays big enough to tap.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SAMURAI_OFFSETS, boardOf, geometry, sym, type Puzzle } from "../boards";

export interface BoardView {
  values: number[];
  notes: number[];
  sel: number;
  wrongShown: boolean;
  highlight: boolean;
  /** cell → wave delay (ms) for rows / boxes just completed */
  wave: Map<number, number>;
  waveKey: number;
  /** cell that just took a wrong number (shake) */
  shake: number;
  shakeKey: number;
  hidden: boolean;
}

const GAP_RATIO = 0.14;

function layout(p: Puzzle, cs: number) {
  const info = boardOf(p.board);
  const [br, bc] = info.box;
  const G = Math.max(3, Math.round(cs * GAP_RATIO));
  const x = (c: number) => c * cs + Math.floor(c / bc) * G;
  const y = (r: number) => r * cs + Math.floor(r / br) * G;
  const W = x(p.cols - 1) + cs, H = y(p.rows - 1) + cs;
  return { x, y, W, H, G };
}

const Tile = memo(function Tile(props: {
  i: number; left: number; top: number; cs: number; v: number; notes: number; n: number; given: boolean; wrong: boolean;
  state: "sel" | "peer" | "same" | "none"; wave?: number; waveKey: number; shake: boolean; shakeKey: number; hidden: boolean; onPick: (i: number) => void;
}) {
  const { i, left, top, cs, v, notes, n, given, wrong, state, wave, waveKey, shake, shakeKey, hidden, onPick } = props;
  const cols = n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : 5;
  const cls = ["cdk-tile", given ? "cdk-given" : v ? "cdk-user" : "cdk-empty", state !== "none" ? `cdk-${state}` : "", wrong ? "cdk-wrong" : ""].join(" ");
  return (
    <button type="button" aria-label={`cell ${i + 1}${v ? ` ${sym(v)}` : ""}`} data-cell={i} onPointerDown={(e) => { e.preventDefault(); onPick(i); }}
      className={cls} style={{ left, top, width: cs, height: cs, fontSize: cs * (n > 9 ? 0.5 : 0.6) }}>
      <span className="cdk-face" key={`${waveKey}-${shakeKey}`} style={wave !== undefined ? { animation: `cdk-wave 620ms ${wave}ms cubic-bezier(.3,1.6,.5,1) both` } : shake ? { animation: "cdk-shake 380ms ease both" } : undefined}>
        {hidden ? "" : v ? sym(v) : notes ? (
          <span className="cdk-notes" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, fontSize: cs * (n > 9 ? 0.18 : 0.24) }}>
            {Array.from({ length: n }, (_, k) => <span key={k}>{notes & (1 << k) ? sym(k + 1) : ""}</span>)}
          </span>
        ) : ""}
      </span>
    </button>
  );
});

const TINTS = ["#ff5c7a", "#ffb23d", "#2ed3e6", "#7b5cff", "#3ddc97"];
const tintCache = new WeakMap<Puzzle, string[]>();
/** a colour per cage, never the same as a touching cage */
function cageTint(p: Puzzle): string[] {
  const hit = tintCache.get(p);
  if (hit) return hit;
  const owner = new Map<number, number>();
  p.cages!.forEach((cg, k) => cg.cells.forEach((c) => owner.set(c, k)));
  const out: string[] = [];
  p.cages!.forEach((cg, k) => {
    const near = new Set<string>();
    for (const c of cg.cells) for (const d of [-1, 1, -p.cols, p.cols]) {
      const o = owner.get(c + d);
      if (o !== undefined && o < k && !(Math.abs(d) === 1 && Math.floor((c + d) / p.cols) !== Math.floor(c / p.cols))) near.add(out[o]);
    }
    out.push(TINTS.find((x) => !near.has(x)) ?? TINTS[k % TINTS.length]);
  });
  tintCache.set(p, out);
  return out;
}

export function Board({ p, view, zoom, onPick }: { p: Puzzle; view: BoardView; zoom: number; onPick: (i: number) => void }) {
  const geo = geometry(p.board);
  const info = boardOf(p.board);
  const host = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 360, h: 360 });
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  // the cell size that fits, before zoom
  const pad = 14;
  const fit = useMemo(() => {
    const gapsX = Math.ceil(p.cols / info.box[1]) - 1, gapsY = Math.ceil(p.rows / info.box[0]) - 1;
    const byW = (box.w - pad * 2) / (p.cols + gapsX * GAP_RATIO), byH = (box.h - pad * 2) / (p.rows + gapsY * GAP_RATIO);
    // gaps are rounded and never under 3 px: step down until the whole tray really fits
    let cs = Math.max(12, Math.floor(Math.min(byW, byH)));
    while (cs > 12) { const l = layout(p, cs); if (l.W + pad * 2 <= box.w && l.H + pad * 2 <= box.h) break; cs--; }
    return cs;
  }, [box, p, info.box]);
  const cs = Math.round(fit * zoom);
  const L = layout(p, cs);

  const sel = view.sel, sv = sel >= 0 ? view.values[sel] : 0;
  const peers = useMemo(() => new Set(sel >= 0 ? geo.peers[sel] : []), [sel, geo]);

  // keep the selected tile in view when zoomed
  useEffect(() => {
    if (zoom <= 1 || sel < 0) return;
    host.current?.querySelector<HTMLElement>(`[data-cell="${sel}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sel, zoom]);

  const tiles = [];
  for (let i = 0; i < p.givens.length; i++) {
    if (p.givens[i] < 0) continue;
    const r = Math.floor(i / p.cols), c = i % p.cols, v = view.values[i];
    const state = i === sel ? "sel" : view.highlight && sv && v === sv ? "same" : view.highlight && peers.has(i) ? "peer" : "none";
    tiles.push(
      <Tile key={i} i={i} left={L.x(c) + pad} top={L.y(r) + pad} cs={cs} v={v} notes={view.notes[i]} n={p.n} given={p.givens[i] > 0}
        wrong={view.wrongShown && v > 0 && v !== p.solution[i]} state={state} wave={view.wave.get(i)} waveKey={view.wave.has(i) ? view.waveKey : 0}
        shake={view.shake === i} shakeKey={view.shake === i ? view.shakeKey : 0} hidden={view.hidden} onPick={onPick} />,
    );
  }

  const cx = (i: number) => L.x(i % p.cols) + cs / 2 + pad, cy = (i: number) => L.y(Math.floor(i / p.cols)) + cs / 2 + pad;
  const overlay = (
    <svg className="cdk-overlay" width={L.W + pad * 2} height={L.H + pad * 2} aria-hidden>
      {geo.diag && geo.diag.map((d, k) => (
        <line key={k} x1={cx(d[0])} y1={cy(d[0])} x2={cx(d[8])} y2={cy(d[8])} stroke={info.c2} strokeOpacity={0.28} strokeWidth={Math.max(2, cs * 0.08)} strokeLinecap="round" />
      ))}
      {p.thermos?.map((t, k) => (
        <g key={k} opacity={0.42}>
          <polyline points={t.map((c) => `${cx(c)},${cy(c)}`).join(" ")} fill="none" stroke="#B9562F" strokeWidth={cs * 0.3} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={cx(t[0])} cy={cy(t[0])} r={cs * 0.36} fill="#B9562F" />
        </g>
      ))}
      {p.cages && cageTint(p).map((fill, k) => p.cages![k].cells.map((c) => (
        <rect key={`t${k}-${c}`} x={L.x(c % p.cols) + pad + 1.5} y={L.y(Math.floor(c / p.cols)) + pad + 1.5} width={cs - 3} height={cs - 3} rx={cs * 0.22} fill={fill} opacity={0.2} />
      )))}
      {p.cages?.map((cg, k) => {
        const inset = Math.max(2.5, cs * 0.08), set = new Set(cg.cells), segs: string[] = [];
        for (const c of cg.cells) {
          const r = Math.floor(c / p.cols), col = c % p.cols, x0 = L.x(col) + pad, y0 = L.y(r) + pad, x1 = x0 + cs, y1 = y0 + cs;
          const up = !set.has(c - p.cols) || r === 0, dn = !set.has(c + p.cols), lf = !set.has(c - 1) || col === 0, rt = !set.has(c + 1) || col === p.cols - 1;
          // edges toward another cage get a dashed line inside the tile; edges inside the cage join across the gap
          if (up) segs.push(`M${x0 + inset} ${y0 + inset}H${x1 - inset}`);
          if (dn) segs.push(`M${x0 + inset} ${y1 - inset}H${x1 - inset}`);
          if (lf) segs.push(`M${x0 + inset} ${y0 + inset}V${y1 - inset}`);
          if (rt) segs.push(`M${x1 - inset} ${y0 + inset}V${y1 - inset}`);
          if (!rt && set.has(c + 1)) { if (up) segs.push(`M${x1 - inset} ${y0 + inset}H${L.x(col + 1) + pad + inset}`); if (dn) segs.push(`M${x1 - inset} ${y1 - inset}H${L.x(col + 1) + pad + inset}`); }
          if (!dn && set.has(c + p.cols)) { if (lf) segs.push(`M${x0 + inset} ${y1 - inset}V${L.y(r + 1) + pad + inset}`); if (rt) segs.push(`M${x1 - inset} ${y1 - inset}V${L.y(r + 1) + pad + inset}`); }
        }
        const first = Math.min(...cg.cells);
        return (
          <g key={k}>
            <path d={segs.join("")} fill="none" stroke="#7A2E4A" strokeOpacity={0.75} strokeWidth={Math.max(1.2, cs * 0.035)} strokeDasharray={`${cs * 0.1} ${cs * 0.07}`} />
            <text x={L.x(first % p.cols) + pad + inset + 1} y={L.y(Math.floor(first / p.cols)) + pad + inset + cs * 0.2} fontSize={cs * 0.22} fontWeight={800} fill="#7A2E4A">{cg.sum}</text>
          </g>
        );
      })}
    </svg>
  );

  return (
    <div ref={host} className={`cdk-board-host ${zoom > 1 ? "overflow-auto" : "overflow-hidden"}`}>
      <div className={p.board === "samurai" ? "cdk-tray cdk-tray-open" : "cdk-tray"} style={{ width: L.W + pad * 2, height: L.H + pad * 2, ["--c1" as string]: info.c1, ["--c2" as string]: info.c2, margin: zoom > 1 ? undefined : "auto" }}>
        {p.board === "samurai" && SAMURAI_OFFSETS.map(([r, c]) => (
          <div key={`${r}-${c}`} className="cdk-tray cdk-subtray" style={{ left: L.x(c) + pad - pad * 0.7, top: L.y(r) + pad - pad * 0.7, width: L.x(c + 8) + cs - L.x(c) + pad * 1.4, height: L.y(r + 8) + cs - L.y(r) + pad * 1.4, ["--c1" as string]: info.c1, ["--c2" as string]: info.c2 }} />
        ))}
        {tiles}
        {overlay}
      </div>
    </div>
  );
}
