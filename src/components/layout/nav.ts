export const NAV = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games", mega: true },
  { href: "/characters", label: "Characters" },
  { href: "/rewards", label: "Rewards" },
  { href: "/parents", label: "Parents" },
] as const;

export const ALL_PAGES = [
  { href: "/", label: "Home", emoji: "🏠", desc: "Featured games and news" },
  { href: "/games", label: "All games", emoji: "🎮", desc: "Browse every MOMOBLOBS game" },
  { href: "/games/momo-shuffle", label: "Momo Shuffle", emoji: "🥤", desc: "How to play, levels and tips" },
  { href: "/play/momo-shuffle", label: "Play Momo Shuffle", emoji: "▶️", desc: "Jump straight into the game" },
  { href: "/characters", label: "Characters", emoji: "🟠", desc: "Meet Momo, Kranky and Tiki" },
  { href: "/rewards", label: "Rewards & shop", emoji: "🏆", desc: "Coins, trophies, daily gift, cup skins" },
  { href: "/profile", label: "My profile", emoji: "😊", desc: "Name, avatar and stats" },
  { href: "/settings", label: "Settings", emoji: "⚙️", desc: "Sound, graphics and gameplay" },
  { href: "/parents", label: "Parents & teachers", emoji: "🛡️", desc: "Safety, privacy and learning" },
  { href: "/help", label: "Help & FAQ", emoji: "💬", desc: "Answers to common questions" },
  { href: "/about", label: "About MOMOBLOBS", emoji: "✨", desc: "Our story and channels" },
  { href: "/privacy", label: "Privacy", emoji: "🔒", desc: "No accounts, no tracking" },
  { href: "/terms", label: "Terms", emoji: "📄", desc: "The simple rules" },
];
