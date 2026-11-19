import Link from "next/link";
import { FromBuBird } from "@/components/brand/BuBird";

/** Momo as a small vector mark: the orange clay blob with the sprout, googly eyes and a grin */
export function MomoMark({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mm-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB45E" />
          <stop offset="1" stopColor="#FF6A2A" />
        </linearGradient>
      </defs>
      <path d="M20 10.5c0-3 1.2-5.4 3.2-6.8" fill="none" stroke="#2A1458" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M20 10.5c0-3 1.2-5.4 3.2-6.8" fill="none" stroke="#5FCB4E" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="26.6" cy="5.2" rx="4.6" ry="2.5" transform="rotate(-18 26.6 5.2)" fill="#6FD85A" stroke="#2A1458" strokeWidth="1.6" />
      <ellipse cx="20" cy="24" rx="16.4" ry="14.2" fill="url(#mm-body)" stroke="#2A1458" strokeWidth="2.2" />
      <ellipse cx="13" cy="15.6" rx="4.2" ry="2" transform="rotate(-24 13 15.6)" fill="#fff" opacity="0.45" />
      <circle cx="14" cy="22.4" r="5.1" fill="#fff" stroke="#2A1458" strokeWidth="1.4" />
      <circle cx="26" cy="22.4" r="5.1" fill="#fff" stroke="#2A1458" strokeWidth="1.4" />
      <circle cx="15.1" cy="23.3" r="2.5" fill="#1B1530" />
      <circle cx="27.1" cy="23.3" r="2.5" fill="#1B1530" />
      <circle cx="15.8" cy="22.4" r="0.85" fill="#fff" />
      <circle cx="27.8" cy="22.4" r="0.85" fill="#fff" />
      <circle cx="8.6" cy="29" r="2" fill="#FF4F7E" opacity="0.45" />
      <circle cx="31.4" cy="29" r="2" fill="#FF4F7E" opacity="0.45" />
      <path d="M16 30.4q4 3.4 8 0" fill="none" stroke="#2A1458" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The MOMOBLOBS app icon: a sunset-orange tile holding a game controller — D-pad on the left, a PLAY button on the
 * right — with Momo's sprout growing out of the top. The tile is a CSS gradient and the controller uses flat fills,
 * so any number of icons can sit on one page (no shared SVG gradient ids). Source art: scripts/art/brand/icon.svg.
 */
export function AppIcon({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-block shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size, borderRadius: "25%", background: "linear-gradient(135deg, #FFC94A 0%, #FF7A2A 50%, #FF3D7F 100%)" }}>
      <span className="absolute inset-0" style={{ background: "radial-gradient(75% 75% at 30% 12%, rgb(255 255 255 / 0.55), rgb(255 255 255 / 0) 60%)" }} />
      <svg viewBox="0 0 100 100" width={size} height={size} className="relative block">
        <path d="M50 43C50 35 52.5 29 57.5 25.5" fill="none" stroke="#22104F" strokeWidth="6.5" strokeLinecap="round" />
        <path d="M50 43C50 35 52.5 29 57.5 25.5" fill="none" stroke="#5FCB4E" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="65.5" cy="22" rx="9.2" ry="5" transform="rotate(-22 65.5 22)" fill="#7BE35F" stroke="#22104F" strokeWidth="3" />
        <ellipse cx="63.5" cy="20.6" rx="4" ry="1.5" transform="rotate(-22 63.5 20.6)" fill="#fff" opacity="0.6" />
        <g transform="translate(50 60) scale(0.86) translate(-50 -58)">
          <path d="M29 38H71C82.5 38 88.5 45.5 90 55L92.5 71C93.6 79 87 84.5 80.5 80.5L70.5 71.5H29.5L19.5 80.5C13 84.5 6.4 79 7.5 71L10 55C11.5 45.5 17.5 38 29 38Z" fill="#22104F" transform="translate(0 3.2)" opacity="0.35" />
          <path d="M29 38H71C82.5 38 88.5 45.5 90 55L92.5 71C93.6 79 87 84.5 80.5 80.5L70.5 71.5H29.5L19.5 80.5C13 84.5 6.4 79 7.5 71L10 55C11.5 45.5 17.5 38 29 38Z" fill="#33197A" />
          <path d="M29 58V38H71C82.5 38 88.5 45.5 90 55L90.4 58Z" fill="#4B2A9E" opacity="0.55" />
          <path d="M30 41.5H70C77 41.5 82 44.5 84.5 49" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="22.5" y="51.5" width="17" height="6" rx="2.2" fill="#fff" />
          <rect x="28" y="46" width="6" height="17" rx="2.2" fill="#fff" />
          <circle cx="68" cy="54.5" r="11" fill="#FF6A2A" />
          <path d="M64.6 48.6Q64.6 46.6 66.4 47.6L74.6 52.8Q76.2 54.5 74.6 56.2L66.4 61.4Q64.6 62.4 64.6 60.4Z" fill="#FFE58A" />
        </g>
      </svg>
    </span>
  );
}

/** the MOMOBLOBS logo: the app icon + the stacked wordmark (compact = icon only); byline adds "from BuBird" under it */
export function Logo({ size = 34, compact = false, byline = false, className = "", href = "/" }: { size?: number; compact?: boolean; byline?: boolean; className?: string; href?: string | null }) {
  const body = (
    <span className={`inline-flex shrink-0 items-center gap-2 ${className}`}>
      <AppIcon size={size} className="shadow-[0_4px_12px_-2px_rgb(255_90_60/0.45)]" />
      {!compact && (
        <span className="flex flex-col font-display leading-[0.86] tracking-[0.03em]" style={{ fontSize: Math.round(size * 0.44) }}>
          <span className="bg-gradient-to-r from-sun to-momo bg-clip-text text-transparent [filter:drop-shadow(0_1.5px_0_#22104F)]">MOMO</span>
          <span className="text-white [text-shadow:0_1.5px_0_#22104F]">BLOBS</span>
          {byline && <span className="mt-[3px]"><FromBuBird size={Math.max(8, Math.round(size * 0.25))} /></span>}
        </span>
      )}
    </span>
  );
  return href ? (
    <Link href={href} aria-label="MOMOBLOBS home" className="inline-flex rounded-xl transition-transform hover:scale-[1.03] active:scale-95">{body}</Link>
  ) : body;
}

/** kept for older imports: the round Momo avatar */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return <Logo size={size} compact className={className} />;
}
