import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { MobileTabBar } from "@/components/layout/MobileTabBar";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-sun focus:px-4 focus:py-2 focus:font-bold focus:text-ink">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <div className="pb-tabbar lg:pb-0"><SiteFooter /></div>
      <MobileTabBar />
    </>
  );
}
