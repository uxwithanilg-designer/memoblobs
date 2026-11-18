import Image from "next/image";
import Link from "next/link";
import { House, Play } from "lucide-react";
import { playHref } from "@/lib/catalog";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <div className="relative mx-auto w-fit">
          <Image src="/brand/cup.webp" alt="" width={420} height={410} className="mx-auto w-44 -rotate-6 drop-shadow-2xl" />
          <Image src="/brand/momo-scared.webp" alt="" width={300} height={295} className="absolute -right-16 bottom-0 w-28 animate-[bob_1.6s_ease-in-out_infinite] drop-shadow-2xl" />
        </div>
        <p className="text-clay mt-6 text-7xl text-sun">404</p>
        <h1 className="mt-2 font-display text-3xl">This cup is empty!</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">Kranky shuffled this page away. Let&apos;s go find Momo somewhere else.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-clay ghost"><House className="size-5" /> Home</Link>
          <Link href={playHref("momo-shuffle")} className="btn-clay"><Play className="size-5 fill-current" /> Play Momo Shuffle</Link>
        </div>
      </div>
    </main>
  );
}
