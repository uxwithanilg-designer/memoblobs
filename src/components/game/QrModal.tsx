"use client";
// "Play on your phone": a QR code that opens this game full screen on a phone, with the link to copy.
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import qrcode from "qrcode-generator";
import { Check, Copy, Smartphone, X } from "lucide-react";
import { MomoMark } from "@/components/brand/Logo";
import type { Game } from "@/lib/games";
import { playHref, thumbOf } from "@/lib/catalog";

/** the QR code as an SVG path (quiet zone 4 modules, high error correction so Momo can sit in the middle) */
function qrPath(text: string) {
  const qr = qrcode(0, "H");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
  return { d, size: n + 8, n };
}

export function QrModal({ game, open, onClose }: { game: Game; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => (typeof window === "undefined" ? "" : `${window.location.origin}${playHref(game)}`), [game]);
  const qr = useMemo(() => (url ? qrPath(url) : null), [url]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };
  const logo = qr ? Math.round(qr.n * 0.22) : 0;
  return (
    <AnimatePresence>
      {open && qr && (
        <motion.div className="fixed inset-0 z-[90] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Play on your phone"
            initial={{ y: 20, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="relative grid w-full max-w-[720px] overflow-hidden rounded-2xl bg-[#160d31] shadow-2xl ring-1 ring-white/10 sm:grid-cols-[1fr_1.05fr]"
          >
            <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60"><X className="size-5" /></button>
            <div className="hidden flex-col bg-gradient-to-b from-[#24164d] to-[#160d31] p-6 sm:flex">
              <div className="relative aspect-video overflow-hidden rounded-xl ring-1 ring-white/10">
                <Image src={thumbOf(game)} alt="" fill sizes="340px" className="object-cover" />
              </div>
              <span className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white"><Smartphone className="size-3.5" /> MOBILE READY</span>
              <p className="mt-2 text-2xl font-bold text-white">{game.title}</p>
              <p className="mt-1 text-sm text-white/70">{game.short}</p>
              <ol className="mt-auto grid gap-2 pt-5 text-sm text-white/75">
                <li className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-sun text-xs font-bold text-ink">1</span> Open your phone camera</li>
                <li className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-sun text-xs font-bold text-ink">2</span> Point it at the code</li>
                <li className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-sun text-xs font-bold text-ink">3</span> Tap the link — the game starts</li>
              </ol>
            </div>
            <div className="flex flex-col items-center p-6 text-center sm:p-7">
              <p className="text-xl font-bold text-white">Play on your phone</p>
              <p className="mt-1 text-sm text-muted">Scan with your phone camera — the game opens full screen.</p>
              <div className="relative mt-5 rounded-2xl bg-white p-3 shadow-[0_10px_40px_-10px_rgb(255_210_90/0.45)]">
                <svg viewBox={`0 0 ${qr.size} ${qr.size}`} width={224} height={224} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${url}`}>
                  <rect width={qr.size} height={qr.size} fill="#fff" />
                  <path d={qr.d} fill="#140b2e" />
                </svg>
                <span className="absolute top-1/2 left-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl bg-white p-1" style={{ width: `${(logo / qr.size) * 100 + 6}%`, aspectRatio: "1" }}>
                  <MomoMark size={44} className="h-full w-full" />
                </span>
              </div>
              <div className="mt-5 flex w-full items-center gap-2 rounded-xl bg-white/[0.06] p-1.5 pl-3 ring-1 ring-white/10">
                <span className="min-w-0 flex-1 truncate text-left text-sm text-white/80">{url.replace(/^https?:\/\//, "")}</span>
                <button onClick={copy} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-sun px-3 py-1.5 text-sm font-bold text-ink transition active:scale-95">
                  {copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}
                </button>
              </div>
              {/^(localhost|127\.)/.test(window.location.hostname) && <p className="mt-3 text-xs text-faint">This is a local address — open the site from your computer&apos;s Wi-Fi address to test it on a phone.</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
