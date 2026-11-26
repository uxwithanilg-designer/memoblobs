// Plank Panic's look: a warm workshop table of vertical wood boards with a soft lamp glow in the middle (the 3D board
// stands on it), glossy amber buttons with a dark rim, white pill labels with a blue word, cream sheets. Cosy and clear.
export const PLANK_CSS = `
.plk-root{position:absolute;inset:0;overflow:hidden;color:#3a2412;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:radial-gradient(60% 55% at 50% 45%,rgba(255,220,140,.55),transparent 70%),
    repeating-linear-gradient(90deg,rgba(0,0,0,.08) 0 2px,transparent 2px 62px),
    repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 21px),
    linear-gradient(180deg,var(--s1),var(--s2));transition:background 1s ease}
.plk-root *{box-sizing:border-box}
.plk-grain{position:absolute;inset:0;pointer-events:none;opacity:.25;background:repeating-linear-gradient(88deg,rgba(90,40,10,.18) 0 1px,transparent 1px 9px),repeating-linear-gradient(92deg,rgba(255,220,170,.15) 0 1px,transparent 1px 13px)}
.plk-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.plk-scroll::-webkit-scrollbar{display:none}
.plk-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.plk-stage{position:absolute;inset:0}
.plk-amber{position:relative;border-radius:14px;color:#3a2412;background:linear-gradient(180deg,#ffd77a,#f2a83a);border:3px solid #5a3410;box-shadow:inset 0 2px 0 rgba(255,255,255,.6),0 3px 0 #5a3410}
.plk-amber:active{transform:translateY(2px);box-shadow:inset 0 2px 0 rgba(255,255,255,.6),0 1px 0 #5a3410}
.plk-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:14px;background:#fff;box-shadow:0 4px 12px -4px rgba(60,30,10,.45);color:#2a6ae0;font-weight:800}
.plk-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 12px;border-radius:999px;background:rgba(40,20,6,.55);color:#fff;font-weight:800;font-variant-numeric:tabular-nums}
.plk-low{color:#ff7a6a;animation:plk-blink 1s ease-in-out infinite}
@keyframes plk-blink{50%{opacity:.55}}
.plk-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.plk-btn:active{transform:translateY(2px) scale(.98)}
.plk-cta{color:#fff;text-shadow:0 2px 0 rgba(20,60,140,.5);background:linear-gradient(180deg,#5ab0ff,#2a6ae0);border:3px solid #1a3a8a;box-shadow:inset 0 2px 0 rgba(255,255,255,.45),0 4px 0 #1a3a8a,0 10px 22px -8px rgba(42,106,224,.7)}
.plk-soft{color:inherit;background:rgba(60,30,10,.08)}
.plk-sheet{border-radius:26px;background:linear-gradient(180deg,#fffaf0,#fbecd2);border:3px solid #5a3410;box-shadow:0 30px 60px -20px rgba(60,30,10,.6);color:#3a2412}
.plk-head{background:linear-gradient(140deg,#ffd77a,#f2a83a);border-bottom:3px solid #5a3410}
.plk-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.plk-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:48px}
.plk-tool-on .plk-tool-ico{box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,215,90,.9)}
.plk-badge{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#e0402a;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff;text-shadow:none}
.plk-bar{position:relative;height:10px;border-radius:99px;background:rgba(40,20,6,.35);border:2px solid #fff}
.plk-bar>b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#8ae05a,#3ab04a);transition:width .4s ease}
.plk-shine{position:relative;overflow:hidden}
.plk-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:plk-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes plk-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
.plk-title{display:flex;flex-direction:column;align-items:center;justify-content:center;height:clamp(150px,min(46vw,27vh),250px);cursor:pointer}
.plk-word{display:flex;justify-content:center;gap:.02em;font-family:var(--font-lilita),sans-serif;line-height:.92}
.plk-w1{font-size:clamp(50px,14vw,86px)}.plk-w2{font-size:clamp(40px,11vw,68px)}
.plk-word span{display:inline-block;color:var(--c);-webkit-text-stroke:.07em #3a1a06;paint-order:stroke;text-shadow:0 .08em 0 #3a1a06,0 .15em .25em rgba(40,20,6,.45);animation:plk-drop .6s cubic-bezier(.3,1.6,.5,1) both,plk-wob 3s ease-in-out infinite}
@keyframes plk-drop{0%{transform:translateY(-120%) rotate(-12deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes plk-wob{50%{transform:rotate(-2deg) translateY(-3%)}}
.plk-screw{display:inline-block;width:.62em;height:.62em;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c0,#e8c25a 45%,#8a6a1a);box-shadow:0 .05em 0 #3a1a06;position:relative;vertical-align:middle;animation:plk-spin 4s linear infinite}
.plk-screw::before,.plk-screw::after{content:"";position:absolute;left:18%;right:18%;top:44%;height:12%;background:#5a4210;border-radius:2px}
.plk-screw::after{transform:rotate(90deg)}
@keyframes plk-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.plk-shine::after,.plk-word span,.plk-screw{animation:none}}
`;
