// Blocktide pieces: every shape the tray can deal, grouped in tiers (small → huge). Pieces never rotate. Colours are
// sea-glass jelly tones. Shared by the dealer and the stage.

export interface Shape { id: string; cells: [number, number][]; w: number; h: number; size: number; tier: 0 | 1 | 2 | 3 }

const parse = (id: string, art: string, tier: 0 | 1 | 2 | 3): Shape => {
  const rows = art.split("/"), cells: [number, number][] = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === "X") cells.push([r, c]); }));
  return { id, cells, w: Math.max(...rows.map((r) => r.length)), h: rows.length, size: cells.length, tier };
};

const T0 = ["X", "XX", "X/X", "XX/X.", "XX/.X", "X./XX", ".X/XX", "XXX", "X/X/X"];
const T1 = ["XX/XX", "XXXX", "X/X/X/X", "X./X./XX", ".X/.X/XX", "XX/X./X.", "XX/.X/.X", "XXX/X..", "XXX/..X", "X../XXX", "..X/XXX",
  "XXX/.X.", ".X./XXX", "X./XX/X.", ".X/XX/.X", ".XX/XX.", "XX./.XX", "X./XX/.X", ".X/XX/X."];
const T2 = ["XXXXX", "X/X/X/X/X", "XX/XX/XX", "XXX/XXX", "XXX/X../X..", "XXX/..X/..X", "X../X../XXX", "..X/..X/XXX"];
const T3 = ["XXX/XXX/XXX"];

export const SHAPES: Shape[] = [
  ...T0.map((a, i) => parse(`s${i}`, a, 0)),
  ...T1.map((a, i) => parse(`m${i}`, a, 1)),
  ...T2.map((a, i) => parse(`l${i}`, a, 2)),
  ...T3.map((a, i) => parse(`h${i}`, a, 3)),
];
export const shapeById = new Map(SHAPES.map((s) => [s.id, s]));

/** jelly colours, index 1… (0 = empty): [main, light, dark] */
export const JELLY: [string, string, string][] = [
  ["", "", ""],
  ["#FF6B6B", "#FFB0A8", "#C8364A"], // coral
  ["#FFB938", "#FFE08A", "#D07C0E"], // mango
  ["#7EDC4A", "#C6F59A", "#3F9A22"], // lime
  ["#22D3C5", "#9CF5EC", "#0E8F8C"], // aqua
  ["#3FA2F5", "#A6D6FF", "#1F5FC4"], // sky
  ["#9370FF", "#CDBBFF", "#5A39C9"], // violet
  ["#FF6FB5", "#FFB8DD", "#C43A84"], // pink
];
export const COLORS = JELLY.length - 1;

/** pearl: index into the shape's cells that carries a pearl (bonus when it washes away) */
export interface Piece { shape: string; color: number; key: number; pearl?: number }
