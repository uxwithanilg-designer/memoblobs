"use client";
// The player on a game page: a start screen with the cover and a big Play button, the game itself running in the box,
// and the control bar under it (like, dislike, save, share, play on phone, sound, fullscreen).
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Bookmark, Maximize, Minimize, Play, Share2, Smartphone, ThumbsDown, ThumbsUp, Volume2, VolumeX } from "lucide-react";
import { QrModal } from "@/components/game/QrModal";
import { warmGame } from "@/components/player/GameView";
import { whenIdle } from "@/lib/preload";
import { toast } from "@/components/ui/Toaster";
import type { GameCard } from "@/lib/game-index";
import { playHref, thumbOf } from "@/lib/catalog";
import { useLibrary } from "@/lib/library";
import { useHydrated, useSettings } from "@/lib/store";

type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
const noop = () => () => {};
/** phones and tablets play full screen on /play (touch controls, orientation lock); mice play right here */
const touchFirst = () => window.matchMedia("(pointer: coarse)").matches;

export function GameStage({ game: g }: { game: GameCard }) {
  const slug = g.slug;
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);
  const [fs, setFs] = useState(false);
  const [qr, setQr] = useState(false);
  const ok = useHydrated();
  const vote = useLibrary((s) => s.votes[slug]);
  const saved = useLibrary((s) => s.saved.includes(slug));
  const muted = useSettings((s) => s.muted);
  const coarse = useSyncExternalStore(noop, touchFirst, () => false);

  const enterFs = useCallback(async () => {
    const el = box.current as FsEl | null;
    try { await (el?.requestFullscreen?.({ navigationUI: "hide" }) ?? el?.webkitRequestFullscreen?.()); } catch { /* not allowed */ }
  }, []);
  const exitFs = useCallback(async () => {
    const d = document as FsDoc;
    try { if (document.fullscreenElement || d.webkitFullscreenElement) await (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.()); } catch { /* not allowed */ }
  }, []);

  const start = useCallback((full = false) => {
    if (touchFirst()) { router.push(playHref(slug)); return; }
    useLibrary.getState().touch(slug);
    setPlaying(true);
    if (full) void enterFs();
  }, [router, slug, enterFs]);
  const stop = useCallback(() => { void exitFs(); setPlaying(false); }, [exitFs]);

  // while the player looks at the page, the game's code and menu sounds download, so Play opens it almost at once
  useEffect(() => {
    const t = setTimeout(() => whenIdle(() => warmGame(g), 2000), 900);
    return () => clearTimeout(t);
  }, [g]);

  useEffect(() => {
    const d = document as FsDoc;
    const on = () => setFs(Boolean(document.fullscreenElement || d.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => { document.removeEventListener("fullscreenchange", on); document.removeEventListener("webkitfullscreenchange", on); };
  }, []);

  // leaving the page keeps it alive but hidden (Next keeps visited routes in a hidden <Activity>), so the frame would
  // keep running its game and music in the background — blank it and go back to the start screen instead
  useLayoutEffect(() => {
    if (!playing) return;
    const f = frame.current;
    return () => { if (f) f.src = "about:blank"; setPlaying(false); };
  }, [playing]);

  // the game runs in a frame (its own screen size, keys and full screen); "Quit game" in its pause menu ends it
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "momoblobs:exit" && e.data.slug === slug) stop();
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [slug, stop]);

  const share = async () => {
    const url = `${window.location.origin}/games/${slug}`;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share && touchFirst()) { try { await nav.share({ title: g.title, text: g.tagline, url }); } catch { /* closed */ } return; }
    try { await navigator.clipboard.writeText(url); toast({ title: "Link copied", body: "Send it to a friend!", icon: "🔗", tone: "mint" }); } catch { /* clipboard blocked */ }
  };
  const save = () => {
    const on = useLibrary.getState().toggleSave(slug);
    toast(on ? { title: "Saved", body: `${g.title} is in your saved games`, icon: "🔖", tone: "gold" } : { title: "Removed from saved", icon: "🔖", tone: "plain" });
  };

  const btn = "group relative grid size-10 place-items-center rounded-xl text-white/75 transition hover:bg-white/[0.09] hover:text-white active:scale-90";
  const tip = "pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-xs font-semibold whitespace-nowrap text-white opacity-0 transition group-hover:opacity-100";

  return (
    <div className="overflow-hidden rounded-2xl bg-[#140b2c] ring-1 ring-white/[0.07]">
      <div ref={box} className="stage-box relative aspect-video max-h-[calc(100dvh-9rem)] w-full overflow-hidden bg-black">
        {playing ? (
          <iframe
            ref={frame}
            src={playHref(slug, { embed: "1" })}
            title={`${g.title} game`}
            allow="fullscreen; autoplay; gamepad; screen-wake-lock"
            allowFullScreen
            onLoad={() => frame.current?.contentWindow?.focus()}
            className="absolute inset-0 h-full w-full border-0 bg-[#2a2030]"
          />
        ) : (
          <button onClick={() => start()} className="group absolute inset-0 block w-full cursor-pointer text-left" aria-label={`Play ${g.title}`}>
            <Image src={thumbOf(g)} alt="" fill priority sizes="(max-width: 1280px) 100vw, 70vw" className="scale-110 object-cover opacity-60 blur-2xl" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/70" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 sm:gap-5">
              <div className="relative aspect-video w-[min(62%,460px)] overflow-hidden rounded-2xl shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)] ring-2 ring-white/15 transition duration-300 group-hover:scale-[1.03] group-hover:ring-sun/70">
                <Image src={thumbOf(g)} alt={`${g.title} cover`} fill priority sizes="460px" className="object-cover" />
              </div>
              <span className="flex items-center gap-2.5 rounded-full bg-sun px-7 py-3 text-lg font-bold text-ink shadow-[0_10px_30px_-8px_rgb(255_210_90/0.7)] transition group-hover:scale-105 group-hover:brightness-105 sm:px-9 sm:py-3.5 sm:text-xl">
                <Play className="size-5 fill-current sm:size-6" /> Play now
              </span>
            </div>
          </button>
        )}
      </div>

      {/* control bar */}
      <div className="flex h-14 items-center gap-2 border-t border-white/[0.06] px-2 sm:h-16 sm:px-3">
        <div className="relative size-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10 sm:size-10">
          <Image src={thumbOf(g)} alt="" fill sizes="40px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-bold text-white sm:text-base">{g.title}</p>
          <p className="truncate text-xs text-faint">by MOMOBLOBS</p>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => useLibrary.getState().vote(slug, 1)} aria-pressed={ok && vote === 1} aria-label="Like" className={btn}>
            <ThumbsUp className={`size-5 ${ok && vote === 1 ? "fill-lime text-lime" : ""}`} /><span className={tip}>Like</span>
          </button>
          <button onClick={() => useLibrary.getState().vote(slug, -1)} aria-pressed={ok && vote === -1} aria-label="Dislike" className={btn}>
            <ThumbsDown className={`size-5 ${ok && vote === -1 ? "fill-bubble text-bubble" : ""}`} /><span className={tip}>Dislike</span>
          </button>
          <button onClick={save} aria-pressed={ok && saved} aria-label="Save game" className={btn}>
            <Bookmark className={`size-5 ${ok && saved ? "fill-sun text-sun" : ""}`} /><span className={tip}>{ok && saved ? "Saved" : "Save"}</span>
          </button>
          <button onClick={share} aria-label="Share" className={btn}><Share2 className="size-5" /><span className={tip}>Share</span></button>
          <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          {!coarse && <button onClick={() => setQr(true)} aria-label="Play on your phone" className={btn}><Smartphone className="size-5" /><span className={tip}>Play on mobile</span></button>}
          <button onClick={() => useSettings.getState().set({ muted: !muted })} aria-label={ok && muted ? "Unmute" : "Mute"} className={`${btn} hidden sm:grid`}>
            {ok && muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}<span className={tip}>{ok && muted ? "Sound on" : "Sound off"}</span>
          </button>
          {!coarse && (
            <button onClick={() => (fs ? void exitFs() : playing ? void enterFs() : start(true))} aria-label={fs ? "Exit fullscreen" : "Fullscreen"} className={btn}>
              {fs ? <Minimize className="size-5" /> : <Maximize className="size-5" />}<span className={tip}>{fs ? "Exit fullscreen" : "Fullscreen"}</span>
            </button>
          )}
        </div>
      </div>
      <QrModal game={g} open={qr} onClose={() => setQr(false)} />
    </div>
  );
}
