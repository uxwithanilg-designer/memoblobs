export const SITE = {
  name: "MOMOBLOBS",
  shortName: "Momoblobs",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://momoblobs.com").replace(/\/$/, ""),
  tagline: "Clay games for sharp eyes",
  description:
    "MOMOBLOBS is a free claymation games website for kids and families. Play Momo Shuffle, the cup-tracking brain game with Momo, Kranky and Tiki — no download, no sign-up, works on phones, tablets and computers.",
  locale: "en_US",
  themeColor: "#160C33",
  social: {
    youtube: "https://www.youtube.com/@momoblobs",
    instagram: "https://www.instagram.com/momoblobs",
  },
  keywords: [
    "momoblobs", "kids games", "free online games", "brain games for kids", "cup game", "shell game", "find the ball",
    "claymation games", "focus games", "memory games", "browser games", "no download games", "family games",
  ],
};

export const abs = (path = "/") => `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
