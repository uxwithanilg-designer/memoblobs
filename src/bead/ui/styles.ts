// Bead Rush's look: a deep slate gradient in the world's colours with soft floating bubbles, glossy round buttons,
// white pill labels and white sheets — calm and tidy, the 3D runway in the middle and a chunky yellow-and-white title.
export const BEAD_CSS = `
.bdr-root{position:absolute;inset:0;overflow:hidden;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:radial-gradient(70% 40% at 50% 30%,rgba(255,255,255,.10),transparent 70%),linear-gradient(180deg,var(--s1),var(--s2));transition:background 1s ease}
.bdr-dark{color:#fff}
.bdr-bubbles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.bdr-bubbles i{position:absolute;bottom:-60px;border-radius:50%;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.9),rgba(255,255,255,.15) 60%,rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.5);animation:bdr-rise linear infinite}
@keyframes bdr-rise{to{transform:translateY(-120vh) translateX(30px)}}
.bdr-root *{box-sizing:border-box}
/* unused */.bdr-grain{position:absolute;inset:0;pointer-events:none;opacity:.25;background:repeating-linear-gradient(88deg,rgba(90,40,10,.18) 0 1px,transparent 1px 9px),repeating-linear-gradient(92deg,rgba(255,220,170,.15) 0 1px,transparent 1px 13px)}
.bdr-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.bdr-scroll::-webkit-scrollbar{display:none}
.bdr-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.bdr-stage{position:absolute;inset:0}
.bdr-amber{position:relative;border-radius:999px;color:#fff;background:radial-gradient(circle at 35% 30%,#8ad8ff,#2a9ae0 60%,#1a6ab0);border:3px solid #fff;box-shadow:0 4px 0 #1a5a9a,0 8px 16px -6px rgba(26,90,154,.6)}
.bdr-amber:active{transform:translateY(2px);box-shadow:0 2px 0 #1a5a9a}
.bdr-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:14px;background:#fff;box-shadow:0 4px 12px -4px rgba(60,30,10,.45);color:#2a6ae0;font-weight:800}
.bdr-chip{display:inline-flex;white-space:nowrap;align-items:center;gap:4px;padding:3px 12px;border-radius:999px;background:rgba(30,24,60,.55);color:#fff;font-weight:800;font-variant-numeric:tabular-nums}
.bdr-low{color:#ff7a6a;animation:bdr-blink 1s ease-in-out infinite}
@keyframes bdr-blink{50%{opacity:.55}}
.bdr-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.bdr-btn:active{transform:translateY(2px) scale(.98)}
.bdr-cta{color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.25);background:linear-gradient(180deg,color-mix(in srgb,var(--paint) 70%,#fff),var(--paint));border:3px solid #fff;box-shadow:0 4px 0 color-mix(in srgb,var(--paint) 60%,#000),0 10px 22px -8px var(--paint)}
.bdr-soft{color:inherit;background:rgba(60,30,10,.08)}
.bdr-sheet{border-radius:26px;background:#ffffff;border:3px solid color-mix(in srgb,var(--paint) 50%,#fff);box-shadow:0 30px 60px -20px rgba(30,20,60,.45);color:#2a2440}
.bdr-head{background:linear-gradient(140deg,color-mix(in srgb,var(--paint) 60%,#fff),var(--paint));color:#fff;border-bottom:3px solid #fff}
.bdr-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:inherit}
.bdr-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:48px}
.bdr-tool-on .bdr-tool-ico{box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,215,90,.9)}
.bdr-badge{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#e0402a;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff;text-shadow:none}
.bdr-bar{position:relative;height:10px;border-radius:99px;background:rgba(40,20,6,.35);border:2px solid #fff}
.bdr-bar>b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#8ae05a,#3ab04a);transition:width .4s ease}
.bdr-shine{position:relative;overflow:hidden}
.bdr-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:bdr-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes bdr-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
.bdr-title{display:flex;flex-direction:column;align-items:center;justify-content:center;height:clamp(150px,min(46vw,27vh),250px);cursor:pointer}
.bdr-word{display:flex;justify-content:center;gap:.02em;font-family:var(--font-lilita),sans-serif;line-height:.92}
.bdr-w1{font-size:clamp(50px,14vw,86px)}.bdr-w2{font-size:clamp(40px,11vw,68px)}
.bdr-word span{display:inline-block;color:var(--c);-webkit-text-stroke:.07em #2a2050;paint-order:stroke;text-shadow:0 .08em 0 #2a2050,0 .15em .25em rgba(30,20,60,.35);animation:bdr-drop .6s cubic-bezier(.3,1.6,.5,1) both,bdr-wob 3s ease-in-out infinite}
@keyframes bdr-drop{0%{transform:translateY(-120%) rotate(-12deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes bdr-wob{50%{transform:rotate(-2deg) translateY(-3%)}}
.bdr-screw{display:inline-block;width:.62em;height:.62em;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c0,#e8c25a 45%,#8a6a1a);box-shadow:0 .05em 0 #3a1a06;position:relative;vertical-align:middle;animation:bdr-spin 4s linear infinite}
.bdr-screw::before,.bdr-screw::after{content:"";position:absolute;left:18%;right:18%;top:44%;height:12%;background:#5a4210;border-radius:2px}
.bdr-screw::after{transform:rotate(90deg)}
@keyframes bdr-spin{to{transform:rotate(360deg)}}

.bdr-card{position:relative;border-radius:20px;background:#fff;border:3px solid #fff;box-shadow:0 8px 0 rgba(20,30,70,.18),0 14px 30px -10px rgba(10,20,60,.5);padding:6px}
.bdr-card canvas{display:block}
.bdr-card-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);padding:1px 10px;border-radius:99px;background:var(--paint);color:#fff;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;border:2px solid #fff;white-space:nowrap}
.bdr-pop{animation:bdr-pop .5s cubic-bezier(.3,1.8,.5,1)}
@keyframes bdr-pop{0%{transform:scale(.8)}100%{transform:scale(1)}}
.bdr-big{font-family:var(--font-lilita),sans-serif;font-size:clamp(40px,12vw,64px);line-height:1;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.25),0 0 24px rgba(255,255,255,.25)}
.bdr-tapcue{animation:bdr-cue 1.2s ease-in-out infinite}
@keyframes bdr-cue{50%{transform:translateX(26px)}}
.bdr-bubbles i{opacity:.35}
@media (prefers-reduced-motion:reduce){.bdr-shine::after,.bdr-word span,.bdr-screw{animation:none}}
`;
