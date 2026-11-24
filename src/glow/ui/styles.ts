// Glowfold's look: a night-city synthwave room — deep navy with a neon horizon grid, glass tiles, glowing orbs and
// neon sign chips. Dark and bright at once, unlike the clay, aurora and felt games.
export const GLOW_CSS = `
.qlt-root{position:absolute;inset:0;overflow:hidden;color:#eaf2ff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:radial-gradient(70% 50% at 50% 0%,rgba(123,92,255,.45),transparent 70%),radial-gradient(60% 40% at 50% 100%,rgba(255,92,180,.35),transparent 70%),linear-gradient(180deg,#0a0a24,#120a2e 55%,#1a0b30)}
.qlt-root::before{content:"";position:absolute;left:-20%;right:-20%;bottom:0;height:42%;pointer-events:none;opacity:.35;
  background-image:linear-gradient(rgba(47,214,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(47,214,255,.5) 1px,transparent 1px);background-size:40px 40px;transform:perspective(300px) rotateX(60deg);transform-origin:bottom;mask-image:linear-gradient(transparent,#000 70%)}
.qlt-root *{box-sizing:border-box}
.qlt-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none}
.qlt-scroll::-webkit-scrollbar{display:none}
.qlt-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.qlt-grad{background:linear-gradient(100deg,#ff8a3d,#ff5cb4 45%,#2fd6ff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(255,92,180,.45))}
.qlt-stitched{position:relative;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 18px 40px -24px rgba(0,0,0,.9);backdrop-filter:blur(10px)}
.qlt-sheet{background:linear-gradient(180deg,#1d1745,#120d30)!important}
.qlt-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.qlt-btn:active{transform:translateY(2px) scale(.98)}
.qlt-cta{color:#fff;background:linear-gradient(100deg,#ff8a3d,#ff5cb4);box-shadow:0 0 24px -4px rgba(255,92,180,.8)}
.glw-host{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
.glw-board{border-radius:24px;background:rgba(10,10,36,.65);box-shadow:0 0 0 1px rgba(255,255,255,.12),0 0 40px -6px var(--c1),0 30px 60px -30px #000;backdrop-filter:blur(8px)}
.glw-cellg{cursor:pointer}
.glw-cell{fill:rgba(255,255,255,.07);stroke:rgba(255,255,255,.1);stroke-width:1;transition:fill .15s ease}
.glw-cellg:hover .glw-cell{fill:rgba(255,255,255,.12)}
.glw-given{fill:rgba(255,255,255,.14)}
.glw-bad{fill:rgba(255,60,90,.28);stroke:#ff3d5a;stroke-width:2;animation:glw-pulse 1s ease-in-out infinite}
@keyframes glw-pulse{50%{fill:rgba(255,60,90,.12)}}
@keyframes glw-sweep{0%{fill:rgba(255,255,255,.07)}40%{fill:rgba(255,255,255,.55)}100%{fill:rgba(255,255,255,.07)}}
.glw-sign line{stroke:#0a0a24;stroke-width:2.2;stroke-linecap:round;pointer-events:none}
.glw-sign-bg{fill:#eaf2ff;filter:drop-shadow(0 0 4px rgba(255,255,255,.7))}
.glw-sign-bad{fill:#ff3d5a;filter:drop-shadow(0 0 6px #ff3d5a)}
.glw-sign{pointer-events:none}
.glw-hint{fill:none;stroke:#ffd23d;stroke-width:4;animation:glw-hint 1.6s ease both;pointer-events:none}
@keyframes glw-hint{0%,60%{opacity:1}100%{opacity:0}}
.qlt-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:rgba(234,242,255,.8)}
.qlt-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:48px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);box-shadow:0 0 18px -8px var(--tool,#7b5cff)}
.qlt-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:#ff5cb4;color:#fff;font-size:10px;font-weight:900;display:grid;place-items:center}
.qlt-shine{position:relative;overflow:hidden}
.qlt-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.3) 50%,transparent 60%);animation:qlt-sweep 3.4s ease-in-out infinite}
@keyframes qlt-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.qlt-shine::after,.glw-bad{animation:none}}
`;
