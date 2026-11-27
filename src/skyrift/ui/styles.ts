// Skyrift Gems' look: a bright fantasy sky in the world's colours with drifting clouds and bubbles, glossy round buttons,
// white pill labels and white sheets — calm and tidy, the floating 3D island board in the middle and a jewel-bright title.
export const SKY_CSS = `
.sky-root{position:absolute;inset:0;overflow:hidden;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:linear-gradient(180deg,color-mix(in srgb,var(--s1) 45%,#bff3f0) 0%,color-mix(in srgb,var(--s2) 30%,#fbd3ea) 62%,#f7c3df 100%);transition:background 1s ease}
.sky-dark{color:#fff}
.sky-bubbles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.sky-bubbles i{position:absolute;bottom:-60px;border-radius:50%;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.9),rgba(255,255,255,.15) 60%,rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.5);animation:sky-rise linear infinite}
@keyframes sky-rise{to{transform:translateY(-120vh) translateX(30px)}}
.sky-root *{box-sizing:border-box}
/* unused */.sky-grain{position:absolute;inset:0;pointer-events:none;opacity:.25;background:repeating-linear-gradient(88deg,rgba(90,40,10,.18) 0 1px,transparent 1px 9px),repeating-linear-gradient(92deg,rgba(255,220,170,.15) 0 1px,transparent 1px 13px)}
.sky-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.sky-scroll::-webkit-scrollbar{display:none}
.sky-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.sky-stage{position:absolute;inset:0}
.sky-amber{position:relative;border-radius:999px;color:#fff;background:radial-gradient(circle at 35% 30%,#8ad8ff,#2a9ae0 60%,#1a6ab0);border:3px solid #fff;box-shadow:0 4px 0 #1a5a9a,0 8px 16px -6px rgba(26,90,154,.6)}
.sky-amber:active{transform:translateY(2px);box-shadow:0 2px 0 #1a5a9a}
.sky-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:14px;background:#fff;box-shadow:0 4px 12px -4px rgba(60,30,10,.45);color:#2a6ae0;font-weight:800}
.sky-chip{display:inline-flex;white-space:nowrap;align-items:center;gap:4px;padding:3px 12px;border-radius:999px;background:rgba(30,24,60,.55);color:#fff;font-weight:800;font-variant-numeric:tabular-nums}
.sky-low{color:#ff7a6a;animation:sky-blink 1s ease-in-out infinite}
@keyframes sky-blink{50%{opacity:.55}}
.sky-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.sky-btn:active{transform:translateY(2px) scale(.98)}
.sky-cta{color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.25);background:linear-gradient(180deg,color-mix(in srgb,var(--paint) 70%,#fff),var(--paint));border:3px solid #fff;box-shadow:0 4px 0 color-mix(in srgb,var(--paint) 60%,#000),0 10px 22px -8px var(--paint)}
.sky-soft{color:inherit;background:rgba(60,30,10,.08)}
.sky-sheet{border-radius:26px;background:#ffffff;border:3px solid color-mix(in srgb,var(--paint) 50%,#fff);box-shadow:0 30px 60px -20px rgba(30,20,60,.45);color:#2a2440}
.sky-head{background:linear-gradient(140deg,color-mix(in srgb,var(--paint) 60%,#fff),var(--paint));color:#fff;border-bottom:3px solid #fff}
.sky-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:inherit}
.sky-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:48px}
.sky-tool-on .sky-tool-ico{box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,215,90,.9)}
.sky-badge{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#e0402a;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff;text-shadow:none}
.sky-bar{position:relative;height:10px;border-radius:99px;background:rgba(40,20,6,.35);border:2px solid #fff}
.sky-bar>b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#8ae05a,#3ab04a);transition:width .4s ease}
.sky-shine{position:relative;overflow:hidden}
.sky-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:sky-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes sky-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
.sky-title{display:flex;flex-direction:column;align-items:center;justify-content:center;height:clamp(150px,min(46vw,27vh),250px);cursor:pointer}
.sky-word{display:flex;justify-content:center;gap:.02em;font-family:var(--font-lilita),sans-serif;line-height:.92}
.sky-w1{font-size:clamp(50px,14vw,86px)}.sky-w2{font-size:clamp(40px,11vw,68px)}
.sky-word span{display:inline-block;color:var(--c);-webkit-text-stroke:.07em #2a2050;paint-order:stroke;text-shadow:0 .08em 0 #2a2050,0 .15em .25em rgba(30,20,60,.35);animation:sky-drop .6s cubic-bezier(.3,1.6,.5,1) both,sky-wob 3s ease-in-out infinite}
@keyframes sky-drop{0%{transform:translateY(-120%) rotate(-12deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes sky-wob{50%{transform:rotate(-2deg) translateY(-3%)}}
.sky-screw{display:inline-block;width:.62em;height:.62em;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c0,#e8c25a 45%,#8a6a1a);box-shadow:0 .05em 0 #3a1a06;position:relative;vertical-align:middle;animation:sky-spin 4s linear infinite}
.sky-screw::before,.sky-screw::after{content:"";position:absolute;left:18%;right:18%;top:44%;height:12%;background:#5a4210;border-radius:2px}
.sky-screw::after{transform:rotate(90deg)}
@keyframes sky-spin{to{transform:rotate(360deg)}}

.sky-card{position:relative;border-radius:20px;background:#fff;border:3px solid #fff;box-shadow:0 8px 0 rgba(20,30,70,.18),0 14px 30px -10px rgba(10,20,60,.5);padding:6px}
.sky-card canvas{display:block}
.sky-card-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);padding:1px 10px;border-radius:99px;background:var(--paint);color:#fff;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;border:2px solid #fff;white-space:nowrap}
.sky-pop{animation:sky-pop .5s cubic-bezier(.3,1.8,.5,1)}
@keyframes sky-pop{0%{transform:scale(.8)}100%{transform:scale(1)}}
.sky-clouds{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.sky-clouds i{position:absolute;height:60px;border-radius:999px;background:rgba(255,255,255,.75);filter:blur(2px);animation:sky-drift linear infinite}
.sky-clouds i::before,.sky-clouds i::after{content:"";position:absolute;bottom:20px;border-radius:50%;background:inherit}
.sky-clouds i::before{left:18%;width:46%;height:80px}.sky-clouds i::after{left:48%;width:36%;height:62px}
@keyframes sky-drift{from{transform:translateX(-40vw)}to{transform:translateX(140vw)}}
.sky-goal{display:flex;align-items:center;gap:4px;padding:4px 10px 4px 6px;border-radius:999px;background:rgba(255,255,255,.9);color:#2a2a5a;font-weight:900;font-size:13px;box-shadow:0 3px 0 rgba(20,30,80,.18)}
.sky-goal.done{background:#c8f7c8}
.sky-gem{display:inline-block;width:18px;height:18px;border-radius:5px;transform:rotate(45deg);box-shadow:inset -3px -3px 0 rgba(0,0,0,.18),inset 3px 3px 0 rgba(255,255,255,.45)}
.sky-face{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;font-size:22px;background:rgba(255,255,255,.9);box-shadow:0 0 0 3px #fff}
.sky-turn{box-shadow:0 0 0 3px #ffd23a,0 0 18px 4px rgba(255,210,58,.8)}
.sky-score{font-family:var(--font-lilita),sans-serif;font-size:26px;line-height:1;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.sky-bg{position:absolute;inset:0;pointer-events:none;background-size:cover;background-position:center bottom;background-image:var(--bg-wide)}
@media (max-aspect-ratio:1/1){.sky-bg{background-image:var(--bg-tall)}}
.sky-land{position:absolute;left:-5%;right:-5%;bottom:0;height:46%;pointer-events:none}
.sky-land i{position:absolute;bottom:-12%;border-radius:50% 50% 0 0/80% 80% 0 0;box-shadow:inset 0 14px 0 rgba(255,255,255,.85)}
.sky-land i:nth-child(1){left:-4%;width:46%;height:62%;background:linear-gradient(180deg,#ff9fd0,#e86ab0)}
.sky-land i:nth-child(2){left:34%;width:40%;height:44%;background:linear-gradient(180deg,#ffc2e2,#f08ac4)}
.sky-land i:nth-child(3){right:-6%;width:44%;height:74%;background:linear-gradient(180deg,#8af0d8,#3ac8b0);border-radius:30% 30% 0 0/50% 50% 0 0}
.sky-land i:nth-child(4){right:24%;width:20%;height:36%;background:linear-gradient(180deg,#b8f8e8,#6ad8c4)}
.sky-panel{position:relative;border-radius:22px;background:#ffd3bd;box-shadow:0 6px 0 #e8a88a,0 14px 24px -10px rgba(120,40,40,.4);color:#fff}
.sky-panel-top{position:relative;padding:10px 14px 14px;border-radius:22px 22px 0 0;background:linear-gradient(180deg,#ffc8ac,#f7b597);text-align:center}
.sky-panel-top::after{content:"";position:absolute;left:12px;right:12px;bottom:-2px;border-top:3px dotted rgba(255,255,255,.75)}
.sky-panel-bot{display:flex;align-items:flex-end;justify-content:space-around;gap:6px;padding:12px 10px 10px}
.sky-lbl{font-family:var(--font-lilita),sans-serif;font-size:13px;letter-spacing:.06em;color:#f08aa0;text-transform:uppercase}
.sky-ptitle{font-family:var(--font-lilita),sans-serif;font-size:24px;line-height:1;text-shadow:0 2px 0 rgba(200,90,70,.45)}
.sky-movesbig{font-family:var(--font-lilita),sans-serif;font-size:44px;line-height:.9;color:#ff3a9a;-webkit-text-stroke:2px #fff;paint-order:stroke;text-shadow:0 3px 0 #c8206a}
.sky-sq{display:grid;place-items:center;width:52px;height:48px;border-radius:12px;color:#fff;background:linear-gradient(180deg,#ffa63a,#ff6a1a);box-shadow:0 4px 0 #c84a0a,inset 0 2px 0 rgba(255,255,255,.5)}
.sky-rd{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;color:#fff;background:linear-gradient(180deg,#c88aff,#8a4ae8);box-shadow:0 4px 0 #5a2aa8,inset 0 2px 0 rgba(255,255,255,.5)}
.sky-sq:active,.sky-rd:active{transform:translateY(2px)}
.sky-ggoal{position:relative;display:inline-grid;place-items:center;width:48px;height:48px}
.sky-gnum{position:absolute;right:-6px;bottom:-4px;min-width:24px;height:24px;padding:0 6px;border-radius:99px;background:#b04aff;color:#fff;font-weight:900;font-size:13px;display:grid;place-items:center;border:2px solid #fff}
.sky-gnum.ok{background:#36c04a}
.sky-cand{display:block;border-radius:40% 40% 46% 46%;box-shadow:inset -5px -6px 0 rgba(0,0,0,.16),inset 4px 5px 0 rgba(255,255,255,.55)}
.sky-banner{border-radius:16px;background:#fff;color:#2a2440;box-shadow:0 10px 30px -10px rgba(80,30,80,.45);text-align:center;padding:12px 26px}
.sky-orb{display:grid;place-items:center;width:62px;height:62px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffffff,#e4e8f0 55%,#b8c0d0);box-shadow:0 4px 0 #9aa2b4,0 10px 18px -8px rgba(40,40,80,.45);color:#5a6a8a}
.sky-orb.on{box-shadow:0 0 0 4px #ffd23a,0 0 18px 6px rgba(255,210,58,.8)}
.sky-play{display:flex;flex-direction:column}
.sky-side{display:flex;gap:14px;justify-content:center}
@media (min-aspect-ratio:1/1) and (min-width:700px){
  .sky-play{flex-direction:row;align-items:center}
  .sky-left{width:250px;flex:none;padding-left:16px}
  .sky-side{flex-direction:column;width:100px;flex:none;align-items:center}
}
@media (prefers-reduced-motion:reduce){.sky-shine::after,.sky-word span,.sky-screw,.sky-clouds i{animation:none}}
`;
