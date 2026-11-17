import Image from "next/image";
import Link from "next/link";

export function Logo({ className = "", priority = false, height = 40 }: { className?: string; priority?: boolean; height?: number }) {
  const width = Math.round((height * 1400) / 231);
  return (
    <Link href="/" aria-label="MOMOBLOBS home" className={`inline-flex shrink-0 items-center transition-transform hover:scale-[1.03] active:scale-95 ${className}`}>
      <Image src="/brand/logo.webp" alt="MOMOBLOBS" width={width} height={height} priority={priority} className="drop-shadow-[0_6px_10px_rgb(0_0_0/0.35)]" style={{ height, width: "auto" }} />
    </Link>
  );
}

export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <Link href="/" aria-label="MOMOBLOBS home" className={`inline-flex shrink-0 items-center gap-2 ${className}`}>
      <Image src="/brand/avatar-momo.webp" alt="" width={size} height={size} className="rounded-full ring-2 ring-sun/80 shadow-lg" />
    </Link>
  );
}
