import Link from "next/link";

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

/** the MOMOBLOBS logo: Momo's mark + the stacked wordmark (compact = mark only) */
export function Logo({ size = 34, compact = false, className = "", href = "/" }: { size?: number; compact?: boolean; className?: string; href?: string | null }) {
  const body = (
    <span className={`inline-flex shrink-0 items-center gap-2 ${className}`}>
      <MomoMark size={size} className="drop-shadow-[0_3px_6px_rgb(0_0_0/0.35)]" />
      {!compact && (
        <span className="flex flex-col font-display leading-[0.86] tracking-[0.03em]" style={{ fontSize: Math.round(size * 0.44) }}>
          <span className="bg-gradient-to-r from-sun to-momo bg-clip-text text-transparent">MOMO</span>
          <span className="text-white">BLOBS</span>
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
