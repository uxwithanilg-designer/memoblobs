export const SITE = {
  name: "MOMOBLOBS",
  shortName: "Momoblobs",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://momoblobs.com").replace(/\/$/, ""),
  tagline: "Clay games for sharp eyes",
  description:
    "Play free online games at MOMOBLOBS: 3D runners, racing, action, brain and puzzle games starring Momo and the clay crew. No download, no sign-up — works on phones, tablets and computers.",
  locale: "en_US",
  themeColor: "#160C33",
  social: {
    youtube: "https://www.youtube.com/@momoblobs",
    instagram: "https://www.instagram.com/momoblobs",
  },
  keywords: [
    "momoblobs", "free online games", "3d games", "running games", "racing games", "brain games", "cup game", "shell game", "find the ball",
    "claymation games", "focus games", "memory games", "browser games", "no download games", "family games",
  ],
};

export const abs = (path = "/") => `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
