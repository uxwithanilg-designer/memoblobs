// Moonvial's look: a moonlit garden at night — a sky tinted by the current constellation, twinkling stars, a big soft
// moon, drifting fireflies and dark hills, with frosted-glass panels and glowing potion vials. Unlike the clay,
// aurora, felt, neon, stained-glass and undersea games.
export const MOON_CSS = `
.mvl-root{position:absolute;inset:0;overflow:hidden;color:#f3efff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:linear-gradient(180deg,var(--s1),var(--s2) 55%,color-mix(in srgb,var(--s3) 45%,var(--s2)));transition:background 1.2s ease}
.mvl-root *{box-sizing:border-box}
.mvl-sky{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.mvl-star{position:absolute;border-radius:50%;background:#fff;box-shadow:0 0 6px #fff;animation:mvl-tw 3.2s ease-in-out infinite}
@keyframes mvl-tw{50%{opacity:.25;transform:scale(.6)}}
.mvl-moon{position:absolute;top:7%;right:-6%;width:44vmin;height:44vmin;max-width:260px;max-height:260px;border-radius:50%;opacity:.55;
  background:radial-gradient(circle at 38% 35%,#fffbe8,#f3e6c4 45%,#d8c79c 70%,transparent 72%);filter:drop-shadow(0 0 40px rgba(255,240,200,.55))}
.mvl-fly{position:absolute;bottom:12%;width:6px;height:6px;border-radius:50%;background:var(--glow);box-shadow:0 0 12px 3px var(--glow);opacity:.8;animation:mvl-fly linear infinite}
@keyframes mvl-fly{0%{transform:translate(0,0);opacity:0}15%{opacity:.9}50%{transform:translate(30px,-38vh)}85%{opacity:.8}100%{transform:translate(-20px,-70vh);opacity:0}}
.mvl-hills{position:absolute;left:-5%;right:-5%;bottom:0;height:20%;background:radial-gradient(60% 100% at 25% 100%,rgba(8,6,24,.85),transparent 70%),radial-gradient(70% 100% at 80% 100%,rgba(8,6,24,.8),transparent 70%)}
.mvl-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none}
.mvl-scroll::-webkit-scrollbar{display:none}
.mvl-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.mvl-title{font-size:64px;line-height:.92}
@media (min-width:640px){.mvl-title{font-size:84px}}
.mvl-grad{background:linear-gradient(180deg,#ffffff,#ffe9a8 50%,#ffb6e0);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #2a1a5e) drop-shadow(0 0 22px rgba(255,214,160,.45))}
.mvl-glass{position:relative;border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.05));border:1px solid rgba(220,210,255,.25);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 18px 40px -24px rgba(0,0,0,.9);backdrop-filter:blur(12px)}
.mvl-sheet{background:linear-gradient(180deg,#2e2366,#160f38)!important}
.mvl-head{color:#fff;background:linear-gradient(140deg,var(--s3),var(--s2) 70%);border-bottom-left-radius:50% 18px;border-bottom-right-radius:50% 18px}
.mvl-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.mvl-btn:active{transform:translateY(2px) scale(.98)}
.mvl-cta{color:#2a1500;background:linear-gradient(180deg,#ffe9a0,#ffc23d);box-shadow:0 4px 0 #b9780c,0 0 26px -6px rgba(255,214,120,.9)}
.mvl-cta:active{box-shadow:0 2px 0 #b9780c}
.mvl-shelf{position:absolute;inset:0}
.mvl-shelf canvas{display:block;touch-action:manipulation}
.mvl-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:rgba(243,239,255,.85)}
.mvl-tool-ico{position:relative;display:grid;place-items:center;width:56px;height:48px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.06));border:1px solid rgba(220,210,255,.3)}
.mvl-badge{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#ffc23d;color:#2a1500;font-size:11px;font-weight:900;display:grid;place-items:center;box-shadow:0 2px 0 #b9780c}
.mvl-pulse{animation:mvl-pulse 1.2s ease-in-out infinite;transform-origin:center;transform-box:fill-box}
@keyframes mvl-pulse{50%{transform:scale(1.5)}}
.mvl-shine{position:relative;overflow:hidden}
.mvl-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.25) 50%,transparent 60%);animation:mvl-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes mvl-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.mvl-shine::after,.mvl-star,.mvl-fly,.mvl-pulse{animation:none}}
`;
