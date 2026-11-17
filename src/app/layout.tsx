import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Fredoka } from "next/font/google";
import "./globals.css";
import { SITE, abs } from "@/lib/site";
import { LIVE_GAMES } from "@/lib/games";
import { Providers } from "@/components/Providers";
import { JsonLd } from "@/components/JsonLd";

const lilita = localFont({ src: "../fonts/LilitaOne.ttf", variable: "--font-lilita", display: "swap", weight: "400", preload: true });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });

const title = "MOMOBLOBS — Free Claymation Games for Kids | Play Momo Shuffle";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: title, template: "%s | MOMOBLOBS" },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: SITE.keywords,
  authors: [{ name: "MOMOBLOBS", url: SITE.url }],
  creator: "MOMOBLOBS",
  publisher: "MOMOBLOBS",
  category: "games",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    url: "/",
    title,
    description: SITE.description,
    locale: SITE.locale,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "MOMOBLOBS — clay games for sharp eyes, starring Momo" }],
  },
  twitter: { card: "summary_large_image", title, description: SITE.description, images: ["/og.jpg"] },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  appleWebApp: { capable: true, title: "Momoblobs", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: SITE.themeColor,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const orgLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": abs("/#org"),
      name: SITE.name,
      url: SITE.url,
      logo: { "@type": "ImageObject", url: abs("/brand/logo.png"), width: 1200, height: 198 },
      image: abs("/og.jpg"),
      slogan: SITE.tagline,
      sameAs: [SITE.social.youtube, SITE.social.instagram],
    },
    {
      "@type": "WebSite",
      "@id": abs("/#website"),
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      inLanguage: "en",
      publisher: { "@id": abs("/#org") },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: abs("/games?q={search_term_string}") },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "ItemList",
      "@id": abs("/#games"),
      name: "MOMOBLOBS games",
      itemListElement: LIVE_GAMES.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/games/${g.slug}`), name: g.title })),
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${lilita.variable} ${fredoka.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <JsonLd data={orgLd} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
