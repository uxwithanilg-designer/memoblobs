// Slide Splash's look: a soft pastel backdrop in the world's colours with floating bubbles, glossy round buttons,
// white pill labels and cream sheets — light, bright and playful, the 3D maze in the middle.
export const SPLASH_CSS = `
.spl-root{position:absolute;inset:0;overflow:hidden;color:#2a2440;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:radial-gradient(70% 50% at 50% 40%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,var(--s1),var(--s2));transition:background 1s ease}
.spl-dark{color:#fff}
.spl-bubbles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.spl-bubbles i{position:absolute;bottom:-60px;border-radius:50%;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.9),rgba(255,255,255,.15) 60%,rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.5);animation:spl-rise linear infinite}
@keyframes spl-rise{to{transform:translateY(-120vh) translateX(30px)}}
.spl-root *{box-sizing:border-box}
/* unused */.spl-grain{position:absolute;inset:0;pointer-events:none;opacity:.25;background:repeating-linear-gradient(88deg,rgba(90,40,10,.18) 0 1px,transparent 1px 9px),repeating-linear-gradient(92deg,rgba(255,220,170,.15) 0 1px,transparent 1px 13px)}
.spl-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.spl-scroll::-webkit-scrollbar{display:none}
.spl-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.spl-stage{position:absolute;inset:0}
.spl-amber{position:relative;border-radius:999px;color:#fff;background:radial-gradient(circle at 35% 30%,#8ad8ff,#2a9ae0 60%,#1a6ab0);border:3px solid #fff;box-shadow:0 4px 0 #1a5a9a,0 8px 16px -6px rgba(26,90,154,.6)}
.spl-amber:active{transform:translateY(2px);box-shadow:0 2px 0 #1a5a9a}
.spl-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:14px;background:#fff;box-shadow:0 4px 12px -4px rgba(60,30,10,.45);color:#2a6ae0;font-weight:800}
.spl-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 12px;border-radius:999px;background:rgba(30,24,60,.55);color:#fff;font-weight:800;font-variant-numeric:tabular-nums}
.spl-low{color:#ff7a6a;animation:spl-blink 1s ease-in-out infinite}
@keyframes spl-blink{50%{opacity:.55}}
.spl-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.spl-btn:active{transform:translateY(2px) scale(.98)}
.spl-cta{color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.25);background:linear-gradient(180deg,color-mix(in srgb,var(--paint) 70%,#fff),var(--paint));border:3px solid #fff;box-shadow:0 4px 0 color-mix(in srgb,var(--paint) 60%,#000),0 10px 22px -8px var(--paint)}
.spl-soft{color:inherit;background:rgba(60,30,10,.08)}
.spl-sheet{border-radius:26px;background:#ffffff;border:3px solid color-mix(in srgb,var(--paint) 50%,#fff);box-shadow:0 30px 60px -20px rgba(30,20,60,.45);color:#2a2440}
.spl-head{background:linear-gradient(140deg,color-mix(in srgb,var(--paint) 60%,#fff),var(--paint));color:#fff;border-bottom:3px solid #fff}
.spl-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:inherit}
.spl-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:48px}
.spl-tool-on .spl-tool-ico{box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,215,90,.9)}
.spl-badge{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#e0402a;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff;text-shadow:none}
.spl-bar{position:relative;height:10px;border-radius:99px;background:rgba(40,20,6,.35);border:2px solid #fff}
.spl-bar>b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#8ae05a,#3ab04a);transition:width .4s ease}
.spl-shine{position:relative;overflow:hidden}
.spl-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:spl-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes spl-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
.spl-title{display:flex;flex-direction:column;align-items:center;justify-content:center;height:clamp(150px,min(46vw,27vh),250px);cursor:pointer}
.spl-word{display:flex;justify-content:center;gap:.02em;font-family:var(--font-lilita),sans-serif;line-height:.92}
.spl-w1{font-size:clamp(50px,14vw,86px)}.spl-w2{font-size:clamp(40px,11vw,68px)}
.spl-word span{display:inline-block;color:var(--c);-webkit-text-stroke:.07em #2a2050;paint-order:stroke;text-shadow:0 .08em 0 #2a2050,0 .15em .25em rgba(30,20,60,.35);animation:spl-drop .6s cubic-bezier(.3,1.6,.5,1) both,spl-wob 3s ease-in-out infinite}
@keyframes spl-drop{0%{transform:translateY(-120%) rotate(-12deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes spl-wob{50%{transform:rotate(-2deg) translateY(-3%)}}
.spl-screw{display:inline-block;width:.62em;height:.62em;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c0,#e8c25a 45%,#8a6a1a);box-shadow:0 .05em 0 #3a1a06;position:relative;vertical-align:middle;animation:spl-spin 4s linear infinite}
.spl-screw::before,.spl-screw::after{content:"";position:absolute;left:18%;right:18%;top:44%;height:12%;background:#5a4210;border-radius:2px}
.spl-screw::after{transform:rotate(90deg)}
@keyframes spl-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.spl-shine::after,.spl-word span,.spl-screw{animation:none}}
`;
