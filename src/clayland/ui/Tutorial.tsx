"use client";
// How to play — shown once before a first-time player's first stage (and from Settings / the title's "?" any time):
// five pages, each with the keyboard keys (web) or the on-screen buttons (phones) drawn and highlighted. Then the Coach
// walks the first stage with live prompts: fire at the first Dustie, grab the coins, open a crate, throw a bomb.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Keyboard, Smartphone, X } from "lucide-react";
import type { ClaySession } from "../session";

type Mode = "keys" | "touch";
type BtnId = "left" | "right" | "up" | "down" | "fire" | "bomb" | "super";
type KeyId = "left" | "right" | "up" | "down" | "space" | "x" | "c" | "v";

interface Page { title: string; art: string; keys: KeyId[]; touch: BtnId[]; lines: { keys: ReactNode; touch: ReactNode; text: string }[] }

function K({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <kbd className={`inline-grid h-7 min-w-7 place-items-center rounded-lg border-b-[3px] border-[#BDB3D6] bg-white px-1.5 font-display text-sm text-[#2B2140] shadow ${wide ? "px-3" : ""}`}>{children}</kbd>;
}
function B({ children, tone = "#2B2140" }: { children: ReactNode; tone?: string }) {
  return <span className="inline-grid h-7 min-w-7 place-items-center rounded-full px-2 font-display text-xs text-white shadow" style={{ background: tone }}>{children}</span>;
}

const PAGES: Page[] = [
  {
    title: "Move and jump", art: "🏃💨", keys: ["left", "right", "up", "space"], touch: ["left", "right", "up"],
    lines: [
      { keys: <><K>←</K><K>→</K> or <K>A</K><K>D</K></>, touch: <><B>◀</B><B>▶</B> left thumb</>, text: "Run left and right" },
      { keys: <><K>↑</K> or <K wide>Space</K></>, touch: <><B tone="#2FA86A">▲</B> above the arrows</>, text: "Jump — hold it for a higher jump" },
      { keys: <><K>→</K> + <K>↑</K></>, touch: <>slide your thumb from <B>▶</B> up to <B tone="#2FA86A">▲</B></>, text: "A running jump over gaps (about 5 tiles)" },
    ],
  },
  {
    title: "Blast the Dust Army", art: "💦💥", keys: ["x"], touch: ["fire"],
    lines: [
      { keys: <>hold <K>X</K> (or <K>J</K>)</>, touch: <>hold <B tone="#3DA8FF">FIRE</B> right thumb</>, text: "Fire the Rain Blaster — keep it held to keep shooting" },
      { keys: <K>X</K>, touch: <B tone="#3DA8FF">FIRE</B>, text: "Shots bend toward the nearest enemy in front — even flyers and ledges above" },
      { keys: <>💰</>, touch: <>💰</>, text: "Dusties melt into mud and drop coins — melt them fast in a row for a combo (up to ×5)" },
    ],
  },
  {
    title: "Storm Bombs and Super Rain", art: "💣⚡", keys: ["c", "v"], touch: ["bomb", "super"],
    lines: [
      { keys: <K>C</K>, touch: <B tone="#3A3430">BOMB</B>, text: "Throw a Storm Bomb — breaks shields, cracked floors, Dust Pumps and Hives (the number shows how many you have)" },
      { keys: <K>V</K>, touch: <B tone="#3DA8FF">SUPER</B>, text: "Super Rain: when the Storm meter at the top is full, rain hits everything on screen (the SUPER button appears then)" },
      { keys: <>📦</>, touch: <>📦</>, text: "Shoot crates open: a new weapon (Sprinkler, Downpour, Hailstone…) or more bombs" },
    ],
  },
  {
    title: "Duck, stomp, shoot down", art: "⬇️🎯", keys: ["down", "x"], touch: ["down", "fire"],
    lines: [
      { keys: <K>↓</K>, touch: <B>▼</B>, text: "Duck: under high shots and low beams (mine carts, rafts) — and shoot under shields" },
      { keys: <><K>↓</K> in the air</>, touch: <><B>▼</B> in the air</>, text: "Squish Stomp: drop down hard on enemies and cracked blocks" },
      { keys: <><K>↓</K> + <K>X</K> in the air</>, touch: <><B>▼</B> + <B tone="#3DA8FF">FIRE</B> in the air</>, text: "Shoot straight down — for the shaft dives" },
    ],
  },
  {
    title: "Stay alive, finish the job", art: "❤️🏁", keys: [], touch: [],
    lines: [
      { keys: <>❤️ × 3</>, touch: <>❤️ × 3</>, text: "3 hearts and 3 lives a stage. A hit costs a heart — and your weapon pickup" },
      { keys: <>✨</>, touch: <>✨</>, text: "An enemy flashes and swells right before it attacks — that's your cue to jump or duck" },
      { keys: <>📋</>, touch: <>📋</>, text: "Every stage tells you its job on the card: reach the gong, melt the waves, free Sprouts, smash pumps, find keys, hold the well…" },
      { keys: <>🛍️</>, touch: <>🛍️</>, text: "Spend coins in the Blaster Shop: faster fire, more power, more bombs, more hearts" },
    ],
  },
];

/** a little keyboard with the page's keys lit */
function KeyboardArt({ lit }: { lit: KeyId[] }) {
  const key = (id: KeyId, label: string, cls = "") => (
    <div className={`grid place-items-center rounded-lg border-b-4 font-display text-sm transition ${lit.includes(id) ? "animate-pulse border-[#C98A00] bg-[#FFC21A] text-[#3A2600]" : "border-[#BDB3D6] bg-white text-[#2B2140]/60"} ${cls}`}>{label}</div>
  );
  return (
    <div className="mx-auto flex w-full max-w-[420px] items-end justify-between gap-4 rounded-2xl bg-[#2B2140]/8 p-3">
      <div className="grid grid-cols-3 gap-1.5" style={{ gridTemplateRows: "34px 34px" }}>
        {key("x", "X", "h-[34px] w-[38px]")}{key("c", "C", "h-[34px] w-[38px]")}{key("v", "V", "h-[34px] w-[38px]")}
        <div className="col-span-3">{key("space", "SPACE", "h-[34px] w-full")}</div>
      </div>
      <div className="grid grid-cols-3 gap-1.5" style={{ gridTemplateRows: "34px 34px" }}>
        <div />{key("up", "↑", "h-[34px] w-[38px]")}<div />
        {key("left", "←", "h-[34px] w-[38px]")}{key("down", "↓", "h-[34px] w-[38px]")}{key("right", "→", "h-[34px] w-[38px]")}
      </div>
    </div>
  );
}
/** a little phone (landscape) with the game's buttons where they really are, the page's ones lit */
function PhoneArt({ lit }: { lit: BtnId[] }) {
  const b = (id: BtnId, label: string, size: number, color: string) => (
    <div className={`grid place-items-center rounded-full font-display text-white ring-2 transition ${lit.includes(id) ? "animate-pulse ring-[#FFC21A] ring-4" : "opacity-50 ring-white/40"}`} style={{ width: size, height: size, background: color, fontSize: size * 0.32 }}>{label}</div>
  );
  return (
    <div className="mx-auto w-full max-w-[460px] rounded-[26px] border-[5px] border-[#2B2140] bg-gradient-to-b from-[#7FD0FF] to-[#B8E890] p-2.5">
      <div className="relative h-[120px]">
        <div className="absolute left-1/2 top-1 h-2.5 w-24 -translate-x-1/2 rounded-full bg-white/70" />
        <div className="absolute left-1/2 top-[44%] -translate-x-1/2 text-3xl">🍃</div>
        <div className="absolute bottom-0 left-0 flex flex-col items-center gap-1">
          {b("up", "▲", 34, "#2FA86A")}
          <div className="flex gap-1.5">{b("left", "◀", 34, "#3A3A4A")}{b("right", "▶", 34, "#3A3A4A")}</div>
        </div>
        <div className="absolute bottom-0 right-0 flex items-end gap-1.5">
          {b("down", "▼", 28, "#3A3A4A")}
          {b("bomb", "💣", 34, "#3A3430")}
          <div className="flex flex-col items-center gap-1">{b("super", "⚡", 30, "#3DA8FF")}{b("fire", "FIRE", 46, "#3DA8FF")}</div>
        </div>
      </div>
    </div>
  );
}

export function Tutorial({ coarse, onDone, first }: { coarse: boolean; onDone: () => void; first: boolean }) {
  const [mode, setMode] = useState<Mode>(coarse ? "touch" : "keys");
  const [i, setI] = useState(0);
  const p = PAGES[i], last = i === PAGES.length - 1;
  return (
    <motion.div key="tutorial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-[#0F2A44]/80 px-3 py-3 backdrop-blur-sm">
      <div className="flex max-h-full w-[min(96vw,720px)] flex-col overflow-hidden rounded-3xl bg-[#FFF6E8] text-[#2B2140] shadow-2xl">
        <div className="flex items-center gap-2 px-4 pt-3">
          <div className="font-display text-xs tracking-widest text-[#FF8A3D]">HOW TO PLAY · {i + 1}/{PAGES.length}</div>
          <div className="ml-auto flex rounded-full bg-[#2B2140]/10 p-0.5">
            {(["keys", "touch"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-xs ${mode === m ? "bg-white shadow" : "opacity-60"}`}>
                {m === "keys" ? <><Keyboard className="size-4" /> Keyboard</> : <><Smartphone className="size-4" /> Phone</>}
              </button>
            ))}
          </div>
          <button aria-label="Skip" onClick={onDone} className="grid size-8 place-items-center rounded-full bg-[#2B2140]/10"><X className="size-4" /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-2 pt-2 [@media(max-height:520px)]:flex-row [@media(max-height:520px)]:items-start">
          <div className="flex shrink-0 flex-col gap-2 [@media(max-height:520px)]:w-[44%]">
            <div className="flex items-center gap-2"><span className="text-3xl">{p.art}</span><span className="font-display text-2xl leading-tight [@media(max-height:520px)]:text-xl">{p.title}</span></div>
            <AnimatePresence mode="wait">
              <motion.div key={`${mode}${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {mode === "keys" ? <KeyboardArt lit={p.keys} /> : <PhoneArt lit={p.touch} />}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex flex-col gap-2">
            {p.lines.map((l, k) => (
              <div key={k} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-white p-2.5 shadow-sm">
                <span className="flex flex-wrap items-center gap-1 text-sm font-bold">{mode === "keys" ? l.keys : l.touch}</span>
                <span className="text-sm font-semibold text-[#5A4F78]">{l.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 pb-3 pt-1">
          <div className="flex gap-1">{PAGES.map((_, k) => <span key={k} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-[#FF8A3D]" : "w-2 bg-[#2B2140]/20"}`} />)}</div>
          <div className="ml-auto flex gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="flex items-center gap-1 rounded-2xl bg-[#2B2140]/10 px-4 py-2.5 font-display"><ChevronLeft className="size-5" /> Back</button>}
            <button onClick={() => (last ? onDone() : setI(i + 1))} className="flex items-center gap-1 rounded-2xl bg-[#FFC21A] px-5 py-2.5 font-display text-[#3A2600] shadow-[0_5px_0_#C98A00] active:translate-y-1 active:shadow-none">
              {last ? (first ? "Let's go!" : "Got it") : "Next"} <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** the first stage's live coach: prompts that wait for the player to do each thing once */
export function Coach({ sess, coarse, onDone }: { sess: React.MutableRefObject<ClaySession | null>; coarse: boolean; onDone: () => void }) {
  const [show, setShow] = useState<string | null>(null);
  const st = useRef({ step: 0, melted: 0, pots: 0, bombs: 0, t: 0 });
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    const id = setInterval(() => {
      const s = sess.current?.sim, c = st.current; if (!s) return;
      const ahead = s.foes.some((f) => f.alive && f.x > s.x - 1 && f.x - s.x < 11 && Math.abs(f.y - s.y) < 5);
      const crate = s.st.pots.some((p) => p.crate && !s.potsOpen.has(p.id) && Math.abs(p.x - s.x) < 7);
      const crowd = s.foes.filter((f) => f.alive && Math.abs(f.x - s.x) < 9).length;
      const say = (t: string | null, next?: number) => { setShow(t); if (next !== undefined) { c.step = next; c.t = s.t; } };
      switch (c.step) {
        case 0: say(coarse ? "◀ ▶ to run · ▲ to jump" : "← → to run · ↑ or Space to jump", 1); break;
        case 1: if (ahead) { c.melted = s.melted; say(coarse ? "A Dustie! Hold FIRE to blast it 💦" : "A Dustie! Hold X to blast it 💦", 2); } else if (s.t - c.t > 5) setShow(null); break;
        case 2: if (s.melted > c.melted) say("Melted! Run through the coins 💰", 3); break;
        case 3: if (s.t - c.t > 2.5) { if (crate) { c.pots = s.potsOpen.size; say(coarse ? "A crate! Hold FIRE to shoot it open 📦" : "A crate! Shoot it open with X 📦", 4); } else setShow(null); } break;
        case 4: if (s.potsOpen.size > c.pots) say("Grab what's inside!", 5); else if (!crate) say(null, 3); break;
        case 5: if (s.t - c.t > 2) { if (crowd >= 2) { c.bombs = s.bombs; say(coarse ? "A group! Tap BOMB to throw a Storm Bomb 💣" : "A group! Press C to throw a Storm Bomb 💣", 6); } else setShow(null); } break;
        case 6: if (s.bombs < c.bombs) say("Boom! Fill the Storm meter for a Super Rain ⚡", 7); else if (crowd === 0) say(null, 5); break;
        case 7: if (s.t - c.t > 3) { say(null, 8); done.current(); } break;
      }
    }, 200);
    return () => clearInterval(id);
  }, [sess, coarse]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div key={show} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-x-0 bottom-[34%] z-30 mx-auto w-fit max-w-[88vw] rounded-2xl border-[3px] border-[#2B2140] bg-[#FFF6E8] px-4 py-2 text-center font-display text-lg text-[#2B2140] shadow-xl [@media(max-height:520px)]:bottom-[38%] [@media(max-height:520px)]:text-base">
          {show}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
