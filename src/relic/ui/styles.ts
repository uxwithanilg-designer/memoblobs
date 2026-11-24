// Bubble Relics' look: a torch-lit temple — warm darkness tinted by the current chamber, flickering torch glow at the
// sides, drifting embers, carved-stone panels with gold trim, glossy gold buttons.
export const RELIC_CSS = `
.rlc-root{position:absolute;inset:0;overflow:hidden;color:#fff4dc;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:radial-gradient(70% 45% at 50% 30%,color-mix(in srgb,var(--glow) 22%,transparent),transparent 70%),linear-gradient(180deg,var(--s1),var(--s2) 55%,var(--s3));transition:background 1.2s ease}
.rlc-root *{box-sizing:border-box}
/* torch glows on both sides */
.rlc-torch{position:absolute;top:18%;width:240px;height:320px;pointer-events:none;background:radial-gradient(closest-side,color-mix(in srgb,var(--glow) 55%,transparent),transparent);filter:blur(6px);animation:rlc-flick 1.6s ease-in-out infinite}
.rlc-torch.l{left:-110px}.rlc-torch.r{right:-110px;animation-delay:-.7s}
@keyframes rlc-flick{0%,100%{opacity:.75}25%{opacity:.95}50%{opacity:.7}75%{opacity:1}}
/* a brick wall pattern and a vignette */
.rlc-bricks{position:absolute;inset:0;pointer-events:none;opacity:.16;background-image:linear-gradient(rgba(0,0,0,.55) 2px,transparent 2px),linear-gradient(90deg,rgba(0,0,0,.55) 2px,transparent 2px),linear-gradient(90deg,rgba(0,0,0,.55) 2px,transparent 2px);background-size:100% 34px,68px 68px,68px 68px;background-position:0 0,0 0,34px 34px}
.rlc-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 50% 40%,transparent 55%,rgba(0,0,0,.55))}
/* rising embers */
.rlc-embers{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.rlc-embers i{position:absolute;bottom:-10px;width:4px;height:4px;border-radius:50%;background:var(--glow);box-shadow:0 0 8px 2px var(--glow);opacity:.8;animation:rlc-rise linear infinite}
@keyframes rlc-rise{0%{transform:translate(0,0);opacity:0}10%{opacity:.9}100%{transform:translate(30px,-105vh);opacity:0}}
.rlc-title3d{position:relative;width:100%;height:clamp(150px,min(48vw,28vh),300px);margin-top:2px;filter:drop-shadow(0 14px 18px rgba(0,0,0,.5))}
.rlc-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.rlc-scroll::-webkit-scrollbar{display:none}
.rlc-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.rlc-title{font-size:60px;line-height:.92}
.rlc-gold{background:linear-gradient(180deg,#fff2a8,#ffcf3a 45%,#c8860a);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #4a2a08) drop-shadow(0 8px 12px rgba(0,0,0,.45))}
.rlc-panel{position:relative;border-radius:20px;background:linear-gradient(180deg,rgba(74,58,50,.9),rgba(44,34,30,.92));border:2px solid #c99a46;box-shadow:inset 0 1px 0 rgba(255,230,170,.35),0 10px 24px -12px rgba(0,0,0,.7);color:#fff4dc}
.rlc-sheet{border-radius:26px;background:linear-gradient(180deg,#4a3a32,#2c221e);border:2px solid #c99a46;box-shadow:0 30px 60px -20px rgba(0,0,0,.8);color:#fff4dc}
.rlc-head{background:linear-gradient(140deg,#ffcf3a,#e0780a);border-bottom-left-radius:50% 18px;border-bottom-right-radius:50% 18px}
.rlc-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.rlc-btn:active{transform:translateY(2px) scale(.98)}
.rlc-cta{color:#3a1e00;background:linear-gradient(180deg,#ffe27a,#ffb21a);box-shadow:0 4px 0 #a8620a,0 10px 24px -8px rgba(255,178,26,.7)}
.rlc-cta:active{box-shadow:0 2px 0 #a8620a}
.rlc-soft{color:#fff4dc;background:rgba(255,244,220,.1)}
.rlc-stage{position:absolute;inset:0}
.rlc-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:#fff4dc}
.rlc-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:46px;border-radius:16px;background:linear-gradient(180deg,#7a5a3a,#4a3422);border:2px solid #c99a46;box-shadow:0 4px 0 #2a1a10;color:#ffe9b0}
.rlc-tool-on .rlc-tool-ico{background:linear-gradient(180deg,#ffe27a,#ffb21a);color:#3a1e00;box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,200,60,.8)}
.rlc-badge{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#36cf4a;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #1a3a1a}
.rlc-float{position:absolute;transform:translate(-50%,-50%);pointer-events:none;font-family:var(--font-lilita),sans-serif;font-size:24px;color:#fff4c0;-webkit-text-stroke:2px #6a3a08;paint-order:stroke;animation:rlc-pop 1.1s ease-out forwards;z-index:5;white-space:nowrap}
.rlc-float-big{font-size:32px;color:#ffe27a;-webkit-text-stroke:3px #8a2a00}
@keyframes rlc-pop{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-170%) scale(1)}}
.rlc-bump{animation:rlc-bump .45s ease}
@keyframes rlc-bump{40%{transform:scale(1.4)}}
.rlc-bar{position:relative;height:12px;border-radius:99px;background:rgba(0,0,0,.45);border:1px solid rgba(255,220,150,.35);overflow:visible}
.rlc-bar>b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#ffb21a,#ffe27a);transition:width .5s ease}
.rlc-bar>i{position:absolute;top:50%;transform:translate(-50%,-50%);font-style:normal}
.rlc-shine{position:relative;overflow:hidden}
.rlc-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.3) 50%,transparent 60%);animation:rlc-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes rlc-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.rlc-shine::after,.rlc-embers i,.rlc-torch{animation:none}}
`;
