// Blocktide's look: under the sea at golden hour — a deep ocean gradient tinted by the realm, slow god-rays from the
// surface, bubbles drifting up, frosted sea-glass panels and glossy jelly blocks. Unlike the clay, aurora, felt, neon
// and stained-glass games.
export const TIDE_CSS = `
.tde-root{position:absolute;inset:0;overflow:hidden;color:#effcff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:radial-gradient(80% 45% at 50% -8%,color-mix(in srgb,var(--c1) 55%,transparent),transparent 70%),radial-gradient(60% 35% at 100% 100%,color-mix(in srgb,var(--c2) 25%,transparent),transparent 70%),linear-gradient(180deg,color-mix(in srgb,var(--deep) 80%,#2a9fd0),var(--deep) 45%,#030c1f);transition:background 1s ease}
.tde-root *{box-sizing:border-box}
.tde-rays{position:absolute;inset:-20% -30% 30%;pointer-events:none;opacity:.22;background:repeating-linear-gradient(100deg,transparent 0 60px,rgba(255,255,255,.55) 70px,transparent 110px);mask-image:linear-gradient(#000,transparent 85%);animation:tde-rays 14s ease-in-out infinite alternate}
@keyframes tde-rays{from{transform:translateX(-4%) skewX(-6deg)}to{transform:translateX(4%) skewX(6deg)}}
.tde-bubbles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.tde-bubbles i{position:absolute;bottom:-20px;border-radius:50%;border:1.5px solid rgba(220,250,255,.55);background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.6),transparent 45%);animation:tde-rise linear infinite}
@keyframes tde-rise{from{transform:translateY(0) translateX(0)}50%{transform:translateY(-55vh) translateX(14px)}to{transform:translateY(-115vh) translateX(-6px)}}
.tde-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none}
.tde-scroll::-webkit-scrollbar{display:none}
.tde-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.tde-title{font-size:64px;line-height:.92}
@media (min-width:640px){.tde-title{font-size:84px}}
.tde-grad{background:linear-gradient(180deg,#ffffff,#9cf5ec 45%,#22d3c5);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #06304a) drop-shadow(0 0 22px rgba(34,211,197,.45))}
.tde-score{font-size:44px;line-height:1;background:linear-gradient(180deg,#fff,#ffe08a);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 rgba(3,22,44,.8))}
.tde-glass{position:relative;border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.05));border:1px solid rgba(180,245,255,.25);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 18px 40px -24px rgba(0,0,0,.9);backdrop-filter:blur(12px)}
.tde-sheet{background:linear-gradient(180deg,#0d4a6e,#06233d)!important}
.tde-wavehead{color:#fff;background:linear-gradient(140deg,#22d3c5,#3fa2f5 60%,#9370ff);border-bottom-left-radius:50% 18px;border-bottom-right-radius:50% 18px}
.tde-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.tde-btn:active{transform:translateY(2px) scale(.98)}
.tde-cta{color:#3a1d00;background:linear-gradient(180deg,#ffe08a,#ffb938);box-shadow:0 4px 0 #c2700b,0 0 26px -6px rgba(255,209,102,.9)}
.tde-cta:active{box-shadow:0 2px 0 #c2700b}
.tde-stage{position:absolute;inset:0}
.tde-stage canvas{display:block;touch-action:none}
.tde-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:rgba(239,252,255,.85)}
.tde-tool-ico{position:relative;display:grid;place-items:center;width:56px;height:48px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.06));border:1px solid rgba(180,245,255,.3)}
.tde-badge{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#ffb938;color:#3a1d00;font-size:11px;font-weight:900;display:grid;place-items:center;box-shadow:0 2px 0 #c2700b}
.tde-pearl{width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#fdeefa 50%,#d9b8e8);box-shadow:0 0 8px rgba(255,255,255,.8)}
.tde-danger::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 60px rgba(255,70,90,.45);animation:tde-danger 1.2s ease-in-out infinite}
@keyframes tde-danger{50%{opacity:.4}}
.tde-shine{position:relative;overflow:hidden}
.tde-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.28) 50%,transparent 60%);animation:tde-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes tde-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.tde-shine::after,.tde-rays,.tde-bubbles i,.tde-danger::after{animation:none}}
`;
