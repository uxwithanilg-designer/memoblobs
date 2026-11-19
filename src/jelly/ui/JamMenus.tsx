"use client";
// Momo Jelly Jam menus (phase 4): the mode grid on the title screen, bottom sheets for the Concept Dex, the Jelly Shop,
// the Jam Lab, Puzzle Packs and helpers, the "oh no" sheet when a stage is lost, and the little rule chips under the
// HUD (move limit, clock, exit order, keys, coins, lives). Built for one thumb on a phone: big targets, sheets that
// scroll, nothing hidden behind a hover.
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { CONCEPTS, GROUP_LABEL, type ConceptGroup } from "../data/concepts";
import { WORLDS } from "../data/worlds";
import { SHOP, type ModeProgress, type ShopState } from "../save";
import type { HelperId, JamHud } from "../session";
import { COLORS } from "../types";

export const MODE_TILES = [
  { id: "daily", icon: "📅", name: "Daily Jam", color: "from-[#FF7AB8] to-[#E8459A]" },
  { id: "rush", icon: "⚡", name: "Rush", color: "from-[#FFB23F] to-[#FF7A3D]" },
  { id: "zen", icon: "🍵", name: "Zen", color: "from-[#5ED8A8] to-[#2EA67A]" },
  { id: "weekly", icon: "😈", name: "Kranky Weekly", color: "from-[#E8504F] to-[#9E2B3A]" },
  { id: "packs", icon: "🎁", name: "Puzzle Packs", color: "from-[#7FD3FF] to-[#3E8EF0]" },
  { id: "lab", icon: "🧪", name: "Jam Lab", color: "from-[#B58CFF] to-[#6A45E0]" },
  { id: "dex", icon: "📖", name: "Concept Dex", color: "from-[#FFD45C] to-[#E8962A]" },
  { id: "shop", icon: "🛍️", name: "Jelly Shop", color: "from-[#FF9F43] to-[#E8459A]" },
] as const;
export type ModeTile = (typeof MODE_TILES)[number]["id"];

export function ModeGrid({ onPick, sub }: { onPick: (id: ModeTile) => void; sub: Partial<Record<ModeTile, string>> }) {
  return (
    <div className="grid w-full grid-cols-4 gap-2">
      {MODE_TILES.map((m, i) => (
        <motion.button key={m.id} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 * i }}
          onClick={() => onPick(m.id)}
          className={`flex aspect-square flex-col items-center justify-center rounded-2xl bg-gradient-to-b ${m.color} p-1 text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(0,0,0,0.25)]`}>
          <span className="text-2xl leading-none drop-shadow">{m.icon}</span>
          <span className="mt-1 text-[10px] leading-tight font-extrabold">{m.name}</span>
          {sub[m.id] && <span className="mt-0.5 rounded-full bg-black/20 px-1.5 text-[9px] font-bold">{sub[m.id]}</span>}
        </motion.button>
      ))}
    </div>
  );
}

/** a bottom sheet that scrolls (closes on the backdrop or the ×) */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-end justify-center bg-[#1b1430]/55" onClick={onClose}>
          <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="flex max-h-[86%] w-full max-w-md flex-col rounded-t-[2rem] bg-white shadow-2xl" style={{ paddingBottom: "calc(var(--safe-bottom) + 0.75rem)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="font-display text-2xl text-[#2a1e4a]">{title}</h2>
              <button aria-label="Close" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-[#f1edfa] text-[#5b4a8a]"><X className="size-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const GROUP_ORDER: ConceptGroup[] = ["B", "P", "F", "G", "T", "M", "O", "J", "C", "R", "S", "K", "H", "W"];
const worldOfId = (c: string) => WORLDS.find((w) => w.teach?.includes(c));

export function DexSheet({ open, onClose, dex, fusions, sel, onSel }: { open: boolean; onClose: () => void; dex: string[]; fusions: number; sel: string | null; onSel: (c: string | null) => void }) {
  const have = new Set(dex);
  const found = CONCEPTS.filter((c) => have.has(c.id)).length;
  const pick = sel ? CONCEPTS.find((c) => c.id === sel) : null;
  return (
    <Sheet open={open} title="Concept Dex" onClose={onClose}>
      <div className="mb-3 rounded-2xl bg-[#f6f2ff] p-3">
        <div className="flex items-baseline justify-between"><span className="font-display text-xl text-[#2a1e4a]">{found} / 400</span><span className="text-xs font-bold text-[#8E5BFF]">✨ {fusions} fusions found</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-[#FF6FAE] to-[#8E5BFF]" style={{ width: `${(found / 400) * 100}%` }} /></div>
      </div>
      {pick && (
        <div className="mb-3 rounded-2xl border-2 border-[#8E5BFF] bg-white p-3">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#8E5BFF] uppercase">{pick.id} · {GROUP_LABEL[pick.g]}{worldOfId(pick.id) ? ` · ${worldOfId(pick.id)!.emoji} ${worldOfId(pick.id)!.name}` : ""}</p>
          <p className="font-display text-xl text-[#2a1e4a]">{have.has(pick.id) ? pick.name : "???"}</p>
          <p className="text-sm text-[#4b3f6b]">{have.has(pick.id) ? pick.text : "Keep playing to find this one."}</p>
        </div>
      )}
      {GROUP_ORDER.map((g) => {
        const list = CONCEPTS.filter((c) => c.g === g);
        const n = list.filter((c) => have.has(c.id)).length;
        return (
          <section key={g} className="mb-3">
            <h3 className="mb-1.5 flex items-baseline justify-between text-sm font-extrabold text-[#5b4a8a]"><span>{GROUP_LABEL[g]}</span><span className="text-xs">{n}/{list.length}</span></h3>
            <div className="grid grid-cols-5 gap-1.5">
              {list.map((c) => (
                <button key={c.id} onClick={() => onSel(c.id === sel ? null : c.id)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl p-0.5 text-center ${have.has(c.id) ? "bg-gradient-to-b from-[#fff4c9] to-[#ffe08a] text-[#2a1e4a]" : "bg-[#efeaf8] text-[#b3a9cc]"} ${c.id === sel ? "ring-2 ring-[#8E5BFF]" : ""}`}>
                  <span className="text-[9px] font-black">{c.id}</span>
                  <span className="line-clamp-2 text-[8.5px] leading-tight font-bold">{have.has(c.id) ? c.name : "?"}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </Sheet>
  );
}

export function ShopSheet({ open, onClose, shop, bank, onBuy, onEquip }: { open: boolean; onClose: () => void; shop: ShopState; bank: number; onBuy: (id: string) => void; onEquip: (id: string) => void }) {
  const slots: { slot: "finish" | "tray" | "confetti"; title: string }[] = [{ slot: "finish", title: "Jelly finish" }, { slot: "tray", title: "Tray" }, { slot: "confetti", title: "Confetti" }];
  return (
    <Sheet open={open} title="Jelly Shop" onClose={onClose}>
      <p className="mb-3 text-sm font-bold text-[#5b4a8a]">Your jar: 💰 {bank.toLocaleString()}</p>
      {slots.map(({ slot, title }) => (
        <section key={slot} className="mb-4">
          <h3 className="mb-1.5 text-sm font-extrabold text-[#5b4a8a]">{title}</h3>
          <div className="grid grid-cols-3 gap-2">
            {SHOP.filter((i) => i.slot === slot).map((i) => {
              const owned = shop.owned.includes(i.id), on = shop[slot] === i.id;
              return (
                <button key={i.id} onClick={() => (owned ? onEquip(i.id) : onBuy(i.id))} disabled={!owned && bank < i.price}
                  className={`flex flex-col items-center rounded-2xl p-2 text-center shadow ${on ? "bg-gradient-to-b from-[#B58CFF] to-[#6A45E0] text-white" : "bg-[#f6f2ff] text-[#2a1e4a]"} disabled:opacity-50`}>
                  <span className="text-3xl">{i.icon}</span>
                  <span className="mt-1 text-[11px] leading-tight font-extrabold">{i.name}</span>
                  <span className="mt-0.5 text-[10px] font-bold opacity-80">{on ? "Wearing" : owned ? "Wear" : `💰 ${i.price}`}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </Sheet>
  );
}

export function LabSheet({ open, onClose, choices, picked, onToggle, level, onLevel, onBuild }: { open: boolean; onClose: () => void; choices: string[]; picked: string[]; onToggle: (c: string) => void; level: number; onLevel: (n: number) => void; onBuild: () => void }) {
  const byId = new Map(CONCEPTS.map((c) => [c.id, c]));
  return (
    <Sheet open={open} title="Jam Lab" onClose={onClose}>
      <p className="mb-2 text-sm text-[#4b3f6b]">Pick up to three ideas you have found. The lab mixes them into a brand-new stage (always solvable).</p>
      <div className="mb-3 flex gap-2">
        {["Easy", "Normal", "Hard"].map((l, i) => (
          <button key={l} onClick={() => onLevel(i)} className={`flex-1 rounded-xl py-2 text-sm font-extrabold ${level === i ? "bg-[#6A45E0] text-white" : "bg-[#f1edfa] text-[#5b4a8a]"}`}>{l}</button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {choices.length === 0 && <p className="text-sm text-[#8a80a8]">Play a few stages to find ideas first.</p>}
        {choices.map((c) => (
          <button key={c} onClick={() => onToggle(c)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${picked.includes(c) ? "bg-[#FF6FAE] text-white" : "bg-[#f6f2ff] text-[#2a1e4a]"}`}>{byId.get(c)?.name ?? c}</button>
        ))}
      </div>
      <button onClick={onBuild} className="sticky bottom-0 w-full rounded-2xl bg-gradient-to-b from-[#B58CFF] to-[#6A45E0] py-3.5 font-display text-xl text-white shadow-[0_5px_0_#4A2FA8] active:translate-y-0.5">🧪 Build my stage</button>
    </Sheet>
  );
}

export const PACK_GROUPS: ConceptGroup[] = ["B", "P", "F", "G", "T", "M", "O", "J", "C", "R", "S", "K"];
export function PacksSheet({ open, onClose, progress, unlocked, onPlay }: { open: boolean; onClose: () => void; progress: ModeProgress["packs"]; unlocked: (g: ConceptGroup) => boolean; onPlay: (g: ConceptGroup) => void }) {
  return (
    <Sheet open={open} title="Puzzle Packs" onClose={onClose}>
      <p className="mb-3 text-sm text-[#4b3f6b]">Twenty stages around one family of ideas. A pack opens once you have found a few of its ideas.</p>
      <div className="grid grid-cols-2 gap-2">
        {PACK_GROUPS.map((g) => {
          const done = Math.min(20, progress[g] ?? 0), open2 = unlocked(g);
          return (
            <button key={g} disabled={!open2} onClick={() => onPlay(g)} className="flex flex-col items-start rounded-2xl bg-[#f6f2ff] p-3 text-left shadow disabled:opacity-45">
              <span className="font-display text-lg leading-tight text-[#2a1e4a]">{GROUP_LABEL[g]}</span>
              <span className="text-xs font-bold text-[#8E5BFF]">{open2 ? `${done}/20 cleared` : "🔒 find more ideas"}</span>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white"><div className="h-full bg-[#8E5BFF]" style={{ width: `${(done / 20) * 100}%` }} /></div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export const HELPERS: { id: HelperId; icon: string; name: string; text: string }[] = [
  { id: "H11", icon: "🧲", name: "Bolt Magnet", text: "Makes the next good move for you" },
  { id: "H03", icon: "🍬", name: "Bonbon Squish", text: "Squishes the next pair for you" },
  { id: "H14", icon: "🦉", name: "Hoot Rewind", text: "Rewinds five moves (free)" },
  { id: "H12", icon: "🔨", name: "Hammer", text: "Tap a wall, door or crate to break it" },
  { id: "H04", icon: "💪", name: "Momo Push", text: "Tap a blocker to push it away" },
  { id: "H13", icon: "🧽", name: "Gloop Sponge", text: "Tap a pit or puddle to fill it" },
  { id: "H10", icon: "✨", name: "Zib Beam", text: "Tap a jelly, then any free spot" },
  { id: "H08", icon: "🖌️", name: "Paint Brush", text: "Tap a jelly to give it another colour" },
  { id: "H05", icon: "🔄", name: "Extra Turn", text: "+1 use on every turn pad" },
  { id: "H06", icon: "➕", name: "Extra Moves", text: "+5 moves on a move-limit stage" },
  { id: "H07", icon: "🔦", name: "Tiki Peek", text: "Blows the fog away" },
  { id: "H09", icon: "🧊", name: "Pip Freeze", text: "Stops the clock for 10 seconds" },
  { id: "H15", icon: "🎲", name: "Turbo Reroll", text: "Builds this stage again with the same ideas" },
];
export function HelperSheet({ open, onClose, charges, dex, onUse }: { open: boolean; onClose: () => void; charges: number; dex: string[]; onUse: (id: HelperId) => void }) {
  const have = new Set(dex);
  return (
    <Sheet open={open} title="Helpers" onClose={onClose}>
      <p className="mb-3 text-sm font-bold text-[#5b4a8a]">⚡ {charges} charge{charges === 1 ? "" : "s"} · earn more with stars and bosses</p>
      <div className="grid gap-2">
        {HELPERS.map((h) => {
          const known = have.has(h.id) || h.id === "H11" || h.id === "H14";
          return (
            <button key={h.id} disabled={!known || charges <= 0} onClick={() => onUse(h.id)} className="flex items-center gap-3 rounded-2xl bg-[#f6f2ff] p-3 text-left shadow disabled:opacity-45">
              <span className="text-3xl">{known ? h.icon : "🔒"}</span>
              <span className="min-w-0"><span className="block font-display text-lg leading-tight text-[#2a1e4a]">{known ? h.name : "Not found yet"}</span><span className="block text-xs text-[#4b3f6b]">{known ? h.text : "Meet it on the journey"}</span></span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

const LOST_TEXT: Record<string, [string, string]> = {
  moves: ["Out of moves!", "This stage has a move limit. Undo or try again."],
  time: ["Time's up!", "Beat the clock — try again."],
  countdown: ["Boom!", "A countdown jelly didn't get out in time."],
  set: ["It set solid!", "A fresh block has to leave quickly on this stage."],
  combo: ["Combo broken!", "Blocks have to leave close together here."],
  keeper: ["Oops, the keeper left!", "That pinned jelly has to stay on the tray."],
  falls: ["Too many falls!", "Watch out for the trap tiles."],
};
export function LostSheet({ why, canUndo, onUndo, onRetry }: { why: string | null; canUndo: boolean; onUndo: () => void; onRetry: () => void }) {
  const [title, text] = LOST_TEXT[why ?? ""] ?? ["Stuck!", "Try that again."];
  return (
    <AnimatePresence>
      {why && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-end justify-center bg-[#1b1430]/45 p-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}>
          <motion.div initial={{ y: 80, scale: 0.92 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 26 }} className="w-full max-w-sm rounded-[2rem] bg-white p-5 text-center shadow-2xl">
            <p className="text-4xl">😵</p>
            <p className="font-display text-2xl text-[#2a1e4a]">{title}</p>
            <p className="mt-1 text-sm text-[#4b3f6b]">{text}</p>
            <div className="mt-4 flex gap-2">
              {canUndo && <button onClick={onUndo} className="flex-1 rounded-2xl bg-[#f1edfa] py-3 font-display text-lg text-[#5b4a8a]">Undo</button>}
              <button onClick={onRetry} className="flex-1 rounded-2xl bg-gradient-to-b from-[#FF7AB8] to-[#E8459A] py-3 font-display text-lg text-white shadow-[0_5px_0_#B22F74]">Try again</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** small chips under the HUD: the stage's own rules and what you are holding */
export function RuleChips({ hud, rushLeft }: { hud: JamHud; rushLeft?: number }) {
  const chips: { k: string; text: ReactNode; warn?: boolean }[] = [];
  if (rushLeft !== undefined) chips.push({ k: "rush", text: `⚡ ${Math.floor(rushLeft / 60)}:${String(rushLeft % 60).padStart(2, "0")}`, warn: rushLeft <= 15 });
  if (hud.limit !== undefined) { const left = hud.limit - hud.moves; chips.push({ k: "lim", text: `🎯 ${left} move${left === 1 ? "" : "s"} left`, warn: left <= 2 }); }
  if (hud.timeLeft !== undefined) chips.push({ k: "time", text: `⏱ ${Math.floor(hud.timeLeft / 60)}:${String(hud.timeLeft % 60).padStart(2, "0")}`, warn: hud.timeLeft <= 10 });
  if (hud.order?.length) chips.push({ k: "ord", text: <span className="flex items-center gap-0.5">Order {hud.order.slice(hud.out, hud.out + 4).map((c, i) => <span key={i} className={`inline-grid size-4 place-items-center rounded-full text-[9px] text-white ${i === 0 ? "ring-2 ring-white" : "opacity-70"}`} style={{ background: COLORS[c]?.hex }}>{COLORS[c]?.sym}</span>)}</span> });
  if (hud.lives !== undefined) chips.push({ k: "lives", text: `❤️ ${Math.max(0, hud.lives - hud.falls)}` });
  if (hud.keys) chips.push({ k: "keys", text: "🔑" });
  if (hud.coins) chips.push({ k: "coins", text: `💰 ${hud.coins}` });
  if (hud.bonus) chips.push({ k: "bonus", text: `⭐ ${hud.bonus}` });
  if (hud.noUndo) chips.push({ k: "nu", text: "🚫 No undo" });
  if (hud.undoCost) chips.push({ k: "uc", text: `↩ costs 💰${hud.undoCost}` });
  if (hud.armed) chips.push({ k: "armed", text: hud.armed.endsWith("+") ? "✨ Now tap a free spot" : "👆 Tap the board", warn: true });
  if (!chips.length) return null;
  return (
    <div className="mx-auto mt-1.5 flex max-w-lg flex-wrap justify-center gap-1.5">
      {chips.map((c) => <span key={c.k} className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow ${c.warn ? "bg-[#FF4D6D] text-white" : "bg-white/85 text-[#2a1e4a]"}`}>{c.text}</span>)}
    </div>
  );
}
