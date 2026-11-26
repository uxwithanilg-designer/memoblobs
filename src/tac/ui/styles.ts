// Neon Tac Duel's look: a deep synthwave night — purple sky, a glowing horizon and a perspective neon grid floor that
// scrolls toward you, neon bubbles drifting up, dark glass panels with glowing neon edges and chunky glowing type.
export const TAC_CSS = `
.tac-root{position:absolute;inset:0;overflow:hidden;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:radial-gradient(80% 45% at 50% 62%,color-mix(in srgb,var(--c3) 38%,transparent),transparent 70%),linear-gradient(180deg,#0c0420 0%,#1c0a44 46%,#2a0a52 62%,#12052c 100%)}
.tac-root *{box-sizing:border-box}
.tac-floor{position:absolute;left:-50%;right:-50%;bottom:-6%;height:46%;pointer-events:none;transform:perspective(320px) rotateX(62deg);transform-origin:50% 0;
  background-image:linear-gradient(color-mix(in srgb,var(--c3) 70%,transparent) 2px,transparent 2px),linear-gradient(90deg,color-mix(in srgb,var(--c3) 70%,transparent) 2px,transparent 2px);
  background-size:56px 56px;animation:tac-run 2.4s linear infinite;opacity:.55;-webkit-mask-image:linear-gradient(180deg,transparent,#000 30%);mask-image:linear-gradient(180deg,transparent,#000 30%)}
@keyframes tac-run{to{background-position:0 56px}}
.tac-horizon{position:absolute;left:0;right:0;top:54%;height:2px;background:var(--c3);box-shadow:0 0 18px 4px var(--c3);opacity:.6;pointer-events:none}
.tac-bubbles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.tac-bubbles i{position:absolute;bottom:-60px;border-radius:50%;border:2px solid color-mix(in srgb,var(--c2) 70%,#fff);box-shadow:0 0 10px var(--c2),inset 0 0 10px color-mix(in srgb,var(--c2) 50%,transparent);background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.35),transparent 60%);opacity:.55;animation:tac-rise linear infinite}
.tac-bubbles i:nth-child(2n){border-color:color-mix(in srgb,var(--c1) 70%,#fff);box-shadow:0 0 10px var(--c1),inset 0 0 10px color-mix(in srgb,var(--c1) 50%,transparent)}
@keyframes tac-rise{to{transform:translateY(-120vh) translateX(30px)}}
.tac-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.tac-scroll::-webkit-scrollbar{display:none}
.tac-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.02em}
.tac-glowtext{text-shadow:0 0 8px var(--c1),0 0 22px color-mix(in srgb,var(--c1) 60%,transparent)}
.tac-stage{position:absolute;inset:0}
.tac-round{position:relative;border-radius:999px;color:#fff;background:linear-gradient(180deg,#3a1a7a,#1e0c48);border:2px solid color-mix(in srgb,var(--c3) 80%,#fff);box-shadow:0 0 12px color-mix(in srgb,var(--c3) 70%,transparent),inset 0 0 10px color-mix(in srgb,var(--c3) 40%,transparent)}
.tac-round:active{transform:scale(.95)}
.tac-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:14px;background:#1a0a3e;border:2px solid var(--c2);box-shadow:0 0 14px color-mix(in srgb,var(--c2) 60%,transparent);color:#fff;font-weight:800}
.tac-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 12px;border-radius:999px;background:rgba(20,6,50,.75);border:1.5px solid color-mix(in srgb,var(--c3) 70%,transparent);color:#fff;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.tac-low{border-color:#ff4a6a;color:#ffb0c0;animation:tac-blink 1s ease-in-out infinite}
@keyframes tac-blink{50%{opacity:.55}}
.tac-card{display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:16px;background:rgba(20,6,50,.7);border:2px solid rgba(255,255,255,.15);transition:all .25s ease;min-width:0}
.tac-card.on{border-color:var(--glow);box-shadow:0 0 16px color-mix(in srgb,var(--glow) 70%,transparent),inset 0 0 12px color-mix(in srgb,var(--glow) 35%,transparent)}
.tac-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.tac-btn:active{transform:translateY(2px) scale(.98)}
.tac-cta{color:#fff;text-shadow:0 0 8px rgba(255,255,255,.6);background:linear-gradient(180deg,color-mix(in srgb,var(--c1) 85%,#fff),var(--c1));border:2px solid color-mix(in srgb,var(--c1) 40%,#fff);box-shadow:0 0 18px color-mix(in srgb,var(--c1) 75%,transparent),0 4px 0 color-mix(in srgb,var(--c1) 50%,#000)}
.tac-soft{color:#fff;background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.18)}
.tac-sheet{border-radius:26px;background:linear-gradient(180deg,#22104e,#140834);border:2px solid color-mix(in srgb,var(--c2) 70%,#fff);box-shadow:0 0 30px color-mix(in srgb,var(--c2) 45%,transparent),0 30px 60px -20px rgba(0,0,0,.6);color:#fff}
.tac-head{background:linear-gradient(140deg,color-mix(in srgb,var(--c1) 70%,#2a0a5a),color-mix(in srgb,var(--c2) 55%,#2a0a5a));border-bottom:2px solid rgba(255,255,255,.3)}
.tac-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:#fff}
.tac-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:48px}
.tac-badge{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:var(--c1);color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 0 8px var(--c1)}
.tac-bar{position:relative;height:10px;border-radius:99px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.4)}
.tac-bar>b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,var(--c1),var(--c2));box-shadow:0 0 10px var(--c2);transition:width .4s ease}
.tac-shine{position:relative;overflow:hidden}
.tac-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.25) 50%,transparent 60%);animation:tac-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes tac-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
.tac-title{display:flex;flex-direction:column;align-items:center;justify-content:center;height:clamp(150px,min(46vw,27vh),250px);cursor:pointer}
.tac-word{display:flex;justify-content:center;gap:.04em;font-family:var(--font-lilita),sans-serif;line-height:.95}
.tac-w1{font-size:clamp(52px,15vw,92px)}.tac-w2{font-size:clamp(34px,10vw,60px)}
.tac-word span{display:inline-block;color:#fff;-webkit-text-stroke:.03em var(--c);text-shadow:0 0 .1em var(--c),0 0 .3em var(--c),0 0 .6em color-mix(in srgb,var(--c) 60%,transparent);animation:tac-drop .6s cubic-bezier(.3,1.6,.5,1) both,tac-flick 5s ease-in-out infinite}
@keyframes tac-drop{0%{transform:translateY(-120%) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes tac-flick{0%,46%,50%,54%,100%{opacity:1}48%,52%{opacity:.55}}
.tac-status{font-family:var(--font-lilita),sans-serif;font-size:20px;line-height:1}
.tac-think i{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:var(--c2);box-shadow:0 0 8px var(--c2);animation:tac-dot 1s ease-in-out infinite}
.tac-think i:nth-child(2){animation-delay:.15s}.tac-think i:nth-child(3){animation-delay:.3s}
@keyframes tac-dot{50%{transform:translateY(-5px)}}
@media (prefers-reduced-motion:reduce){.tac-floor,.tac-shine::after,.tac-word span{animation:none}}
`;
