import { AppShell } from "@/components/layout/AppShell";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <SiteFooter />
    </AppShell>
  );
}
