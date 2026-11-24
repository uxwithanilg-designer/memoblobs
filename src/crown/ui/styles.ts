// Crownfold's look: a royal hall at night — deep plum and indigo with warm gold light, a leaded-glass lattice in the
// background, gold-edged glass panels and a stained-glass board. Unlike the clay, aurora, felt and neon games.
export const CROWN_CSS = `
.qlt-root{position:absolute;inset:0;overflow:hidden;color:#fff6e6;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:radial-gradient(65% 45% at 50% -5%,rgba(255,200,61,.32),transparent 70%),radial-gradient(55% 40% at 0% 100%,rgba(224,71,91,.32),transparent 70%),radial-gradient(55% 40% at 100% 90%,rgba(80,90,230,.3),transparent 70%),linear-gradient(180deg,#1b0f2e,#25123a 50%,#160c26)}
.qlt-root::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.09;
  background-image:repeating-linear-gradient(45deg,#ffd77a 0 1px,transparent 1px 34px),repeating-linear-gradient(-45deg,#ffd77a 0 1px,transparent 1px 34px)}
.qlt-root *{box-sizing:border-box}
.qlt-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none}
.qlt-scroll::-webkit-scrollbar{display:none}
.qlt-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.qlt-grad{background:linear-gradient(180deg,#fff3b0,#ffc83d 50%,#e08a0b);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #6b2a12) drop-shadow(0 0 22px rgba(255,200,61,.35))}
.qlt-stitched{position:relative;border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.04));border:1px solid rgba(255,214,122,.28);box-shadow:inset 0 1px 0 rgba(255,240,200,.18),0 18px 40px -24px rgba(0,0,0,.9);backdrop-filter:blur(10px)}
.qlt-sheet{background:linear-gradient(180deg,#34204d,#1d1030)!important}
.qlt-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.qlt-btn:active{transform:translateY(2px) scale(.98)}
.qlt-cta{color:#3a1500;background:linear-gradient(180deg,#ffe48a,#ffb52e);box-shadow:0 4px 0 #b8650a,0 0 24px -6px rgba(255,200,61,.9)}
.qlt-cta:active{box-shadow:0 2px 0 #b8650a}
.crw-host{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
.crw-board{touch-action:none;cursor:pointer;border-radius:16px;filter:drop-shadow(0 0 28px color-mix(in srgb,var(--c1) 45%,transparent)) drop-shadow(0 24px 30px rgba(0,0,0,.55))}
.crw-cell{fill:transparent;transition:fill .15s ease}
.crw-bad{fill:rgba(255,40,70,.45);animation:crw-pulse 1s ease-in-out infinite}
@keyframes crw-pulse{50%{fill:rgba(255,40,70,.15)}}
@keyframes crw-sweep{0%{fill:rgba(255,255,255,0)}35%{fill:rgba(255,248,210,.85)}100%{fill:rgba(255,255,255,0)}}
.crw-x path{stroke:#2a1a08;stroke-opacity:.6;stroke-linecap:round;fill:none}
.crw-crown{animation:crw-pop .32s cubic-bezier(.3,1.6,.5,1) both}
@keyframes crw-pop{0%{transform:scale(.2) translateY(30%);opacity:0}100%{transform:scale(1);opacity:1}}
.crw-num{fill:#fff3c4;font-family:var(--font-lilita),sans-serif;pointer-events:none}
.crw-hint{fill:none;stroke:#fff;stroke-width:4;animation:crw-hint 1.6s ease both;pointer-events:none;filter:drop-shadow(0 0 6px #ffc83d)}
@keyframes crw-hint{0%,60%{opacity:1}100%{opacity:0}}
.qlt-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:rgba(255,246,230,.8)}
.qlt-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:48px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.05));border:1px solid rgba(255,214,122,.3)}
.qlt-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:#e0475b;color:#fff;font-size:10px;font-weight:900;display:grid;place-items:center}
.qlt-shine{position:relative;overflow:hidden}
.qlt-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.3) 50%,transparent 60%);animation:qlt-sweep 3.4s ease-in-out infinite;pointer-events:none}
@keyframes qlt-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.qlt-shine::after,.crw-bad,.crw-crown{animation:none}}
`;
