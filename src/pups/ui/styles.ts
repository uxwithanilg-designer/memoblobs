// Noodle Pups' look: a light, patterned dog-park ground (per park), chunky wooden buttons with a carved rim, a wooden
// banner for the stage and bones, cream sheets and a sausage-shaped "Next" button. Warm, cute and readable.
export const PUPS_CSS = `
.pup-root{position:absolute;inset:0;overflow:hidden;color:#5a3418;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:linear-gradient(180deg,var(--g1),var(--g2));transition:background 1s ease}
.pup-root *{box-sizing:border-box}
.pup-night{color:#fff4e0}
.pup-pattern{position:absolute;inset:0;pointer-events:none;opacity:.55;background-image:
  linear-gradient(30deg,var(--ln) 12%,transparent 12.5%,transparent 87%,var(--ln) 87.5%,var(--ln)),
  linear-gradient(150deg,var(--ln) 12%,transparent 12.5%,transparent 87%,var(--ln) 87.5%,var(--ln)),
  linear-gradient(30deg,var(--ln) 12%,transparent 12.5%,transparent 87%,var(--ln) 87.5%,var(--ln)),
  linear-gradient(150deg,var(--ln) 12%,transparent 12.5%,transparent 87%,var(--ln) 87.5%,var(--ln));
  background-size:40px 70px;background-position:0 0,0 0,20px 35px,20px 35px}
.pup-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.pup-scroll::-webkit-scrollbar{display:none}
.pup-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.pup-stage{position:absolute;inset:0}
/* wood */
.pup-wood{position:relative;border-radius:16px;color:#fff6e4;background:linear-gradient(180deg,#f0a052,#c8702c 55%,#a8561e);
  box-shadow:inset 0 2px 0 rgba(255,230,180,.6),inset 0 -3px 0 rgba(90,40,10,.35),0 4px 0 #7a3a12,0 8px 16px -8px rgba(90,40,10,.6);
  text-shadow:0 2px 0 rgba(90,40,10,.6)}
.pup-wood::after{content:"";position:absolute;inset:4px;border-radius:12px;border:2px solid rgba(255,220,170,.35);pointer-events:none}
.pup-wood:active{transform:translateY(2px);box-shadow:inset 0 2px 0 rgba(255,230,180,.6),0 2px 0 #7a3a12}
.pup-panel{border-radius:18px;background:rgba(255,252,244,.88);border:2px solid #e8cfa4;box-shadow:0 8px 18px -12px rgba(90,40,10,.5);color:#5a3418}
.pup-night .pup-panel{background:rgba(40,44,74,.85);border-color:#4a5080;color:#fff4e0}
.pup-banner{position:relative;display:inline-flex;align-items:center;gap:6px;padding:6px 18px;border-radius:14px;background:linear-gradient(180deg,#f3a85a,#c8702c);box-shadow:inset 0 2px 0 rgba(255,230,180,.6),0 4px 0 #7a3a12;color:#fff}
.pup-banner::before,.pup-banner::after{content:"";position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:#f3e0c0;box-shadow:0 0 0 3px #c8702c;transform:translateY(-50%)}
.pup-banner::before{left:-8px}.pup-banner::after{right:-8px}
.pup-ribbon{display:inline-block;padding:2px 14px;border-radius:999px;background:linear-gradient(180deg,#8a5ae0,#5a2ab0);color:#ffe27a;font-family:var(--font-lilita),sans-serif;box-shadow:0 2px 0 #3a1a7a}
.pup-bone{display:inline-block;width:30px;height:14px;position:relative}
.pup-bone i{position:absolute;inset:3px 6px;border-radius:4px;background:currentColor}
.pup-bone b{position:absolute;width:10px;height:10px;border-radius:50%;background:currentColor}
.pup-bone b:nth-child(1){left:0;top:0}.pup-bone b:nth-child(2){left:0;bottom:0}.pup-bone b:nth-child(3){right:0;top:0}.pup-bone b:nth-child(4){right:0;bottom:0}
.pup-bone-on{color:#fff6e4;filter:drop-shadow(0 1px 0 rgba(90,40,10,.6))}.pup-bone-off{color:rgba(90,40,10,.35)}
.pup-lose{animation:pup-lose .5s ease}
@keyframes pup-lose{30%{transform:scale(1.5) rotate(-15deg)}}
.pup-flash{position:absolute;inset:0;pointer-events:none;z-index:20;box-shadow:inset 0 0 0 4px rgba(255,60,60,.9),inset 0 0 50px rgba(255,60,60,.5);animation:pup-flash .6s ease forwards}
@keyframes pup-flash{0%{opacity:1}100%{opacity:0}}
.pup-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.pup-btn:active{transform:translateY(2px) scale(.98)}
.pup-next{position:relative;color:#fff;font-family:var(--font-lilita),sans-serif;text-shadow:0 2px 0 rgba(120,30,10,.6);
  background:linear-gradient(180deg,#ff8a5a,#e0402a 60%,#b02a1a);border:4px solid #ffcf8a;box-shadow:0 5px 0 #7a1a0a,0 12px 24px -10px rgba(120,30,10,.7)}
.pup-soft{color:inherit;background:rgba(90,40,10,.08)}
.pup-night .pup-soft{background:rgba(255,255,255,.12)}
.pup-sheet{border-radius:26px;background:linear-gradient(180deg,#fffaf0,#fbeed6);border:3px solid #e8cfa4;box-shadow:0 30px 60px -20px rgba(90,40,10,.55);color:#5a3418}
.pup-head{background:linear-gradient(140deg,#f3a85a,#c8702c);border-bottom:3px solid #e8cfa4}
.pup-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:inherit}
.pup-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:48px}
.pup-tool-on .pup-tool-ico{box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,211,74,.9)}
.pup-badge{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#e0402a;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff;z-index:2}
.pup-bar{position:relative;height:12px;border-radius:99px;background:rgba(90,40,10,.15);border:2px solid #fff}
.pup-bar>b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#f3a85a,#ffd23f);transition:width .4s ease}
.pup-shine{position:relative;overflow:hidden}
.pup-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:pup-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes pup-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
/* the title */
.pup-title{display:flex;flex-direction:column;align-items:center;justify-content:center;height:clamp(150px,min(46vw,27vh),250px);cursor:pointer}
.pup-tl{font-family:var(--font-lilita),sans-serif;line-height:.92;text-align:center}
.pup-word{display:flex;justify-content:center;gap:.03em;font-size:clamp(46px,13vw,80px)}
.pup-word span{display:inline-block;color:var(--c);-webkit-text-stroke:.07em #5a2a0a;paint-order:stroke;text-shadow:0 .07em 0 #5a2a0a,0 .14em .2em rgba(90,40,10,.35);animation:pup-drop .6s cubic-bezier(.3,1.6,.5,1) both,pup-wig 2.4s ease-in-out infinite}
@keyframes pup-drop{0%{transform:translateY(-120%) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes pup-wig{50%{transform:translateY(-5%) rotate(-3deg)}}
.pup-float{position:absolute;transform:translate(-50%,-50%);pointer-events:none;font-family:var(--font-lilita),sans-serif;font-size:22px;color:#fff;-webkit-text-stroke:2px #c8702c;paint-order:stroke;animation:pup-pop 1s ease-out forwards;z-index:5}
@keyframes pup-pop{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-160%)}}
@media (prefers-reduced-motion:reduce){.pup-shine::after,.pup-word span{animation:none}}
`;
