import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), fullscreen=(self), screen-wake-lock=(self), gamepad=(self)" },
];

/** `npm run build:static` (Cloudflare): a fully static site in out/ — headers come from public/_headers there */
const STATIC = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(STATIC ? { output: "export" as const } : {}),
  poweredByHeader: false,
  // dev only: let phones on the home Wi-Fi (http://192.168.x.x:3000) load dev chunks + the HMR socket;
  // without this Next blocks them and client-only games (Nitro Rush) never leave the loading screen
  allowedDevOrigins: ["192.168.1.4", "192.168.*.*", "10.*.*.*"],
  // static build: pictures load from the R2 bucket (src/lib/image-loader.ts); they're already sized .webp files
  images: STATIC
    ? { loader: "custom" as const, loaderFile: "./src/lib/image-loader.ts", deviceSizes: [1920], imageSizes: [256] }
    :{ formats: ["image/avif", "image/webp"], minimumCacheTTL: 60 * 60 * 24 * 30 },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(STATIC
    ? {}
    : {
      async headers() {
        return [
          { source: "/:path*", headers: securityHeaders },
          { source: "/audio/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
          { source: "/brand/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }] },
          { source: "/fonts/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
        ];
      },
    }),
};

export default nextConfig;
