// Picnic Pairs' look: a sunny picnic — the sky and accent follow the picnic spot, soft clouds drift, frosted
// white panels, cream food tiles with a thick edge, glossy buttons. Warm, light and tasty.
export const NOVA_CSS_BASE = `
.nov-root{position:absolute;inset:0;overflow:hidden;color:#4a2a1a;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:linear-gradient(180deg,var(--s1),var(--s2) 55%,var(--s3));transition:background 1.2s ease}
.nov-root *{box-sizing:border-box}
.nov-night{color:#eef2ff}
.nov-clouds{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.nov-clouds i{position:absolute;height:38px;border-radius:40px;background:rgba(255,255,255,.75);filter:blur(1px);animation:nov-drift linear infinite}
.nov-clouds i::before,.nov-clouds i::after{content:"";position:absolute;border-radius:50%;background:inherit}
.nov-clouds i::before{width:46px;height:46px;left:16px;top:-22px}.nov-clouds i::after{width:34px;height:34px;left:48px;top:-14px}
@keyframes nov-drift{from{transform:translateX(-160px)}to{transform:translateX(110vw)}}
.nov-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.nov-scroll::-webkit-scrollbar{display:none}
.nov-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
/* the title */
.nov-title{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:clamp(150px,min(46vw,27vh),260px);cursor:pointer}
.nov-tl1,.nov-tl2{display:flex;gap:.02em;font-family:var(--font-lilita),sans-serif;line-height:.95}
.nov-tl1{font-size:clamp(28px,8.6vw,50px)}.nov-tl2{font-size:clamp(34px,10.5vw,62px);margin-top:.12em}
.nov-letter{position:relative;display:inline-block;color:var(--c);-webkit-text-stroke:.06em #fff;paint-order:stroke;
  text-shadow:0 .06em 0 color-mix(in srgb,var(--c) 60%,#000),0 .12em .18em rgba(90,50,20,.35);
  animation:nov-drop .7s cubic-bezier(.3,1.6,.5,1) both,nov-bob 2.6s ease-in-out infinite}
.nov-letter::after{content:"";position:absolute;left:18%;top:16%;width:34%;height:16%;border-radius:50%;background:rgba(255,255,255,.75);filter:blur(1px);pointer-events:none}
.nov-hop{animation:nov-hop .5s ease both,nov-bob 2.6s ease-in-out infinite}
@keyframes nov-drop{0%{transform:translateY(-120%) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes nov-bob{50%{transform:translateY(-6%) rotate(-2deg)}}
@keyframes nov-hop{40%{transform:translateY(-30%) scale(1.1)}}
.nov-tbub{position:absolute;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0 12%,color-mix(in srgb,var(--c) 60%,#fff) 24%,var(--c) 62%,color-mix(in srgb,var(--c) 60%,#000));box-shadow:0 6px 12px -6px rgba(90,50,20,.5);animation:nov-float 4s ease-in-out infinite}
@keyframes nov-float{50%{transform:translateY(-10px)}}
/* panels and buttons */
.nov-panel{position:relative;border-radius:20px;background:rgba(255,255,255,.78);border:2px solid #fff;box-shadow:0 10px 24px -14px rgba(110,60,20,.55);backdrop-filter:blur(8px);color:#4a2a1a}
.nov-sheet{border-radius:26px;background:linear-gradient(180deg,#ffffff,#fff6ea);box-shadow:0 30px 60px -20px rgba(110,60,20,.55);color:#4a2a1a}
.nov-head{background:linear-gradient(140deg,#4fb6ff,#e0602a);border-bottom-left-radius:50% 18px;border-bottom-right-radius:50% 18px}
.nov-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.nov-btn:active{transform:translateY(2px) scale(.98)}
.nov-cta{color:#fff;background:linear-gradient(180deg,#5fd06a,#22a83f);box-shadow:0 4px 0 #15812c,0 10px 24px -8px rgba(34,168,63,.7)}
.nov-cta:active{box-shadow:0 2px 0 #15812c}
.nov-soft{color:#4a2a1a;background:rgba(74,42,26,.08)}
.nov-stage{position:absolute;inset:0}
.nov-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:inherit}
.nov-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:46px;border-radius:16px;background:linear-gradient(180deg,#ffffff,#fff0dc);border:2px solid #fff;box-shadow:0 4px 0 rgba(160,90,40,.3);color:#e0602a}
.nov-tool-on .nov-tool-ico{background:linear-gradient(180deg,#fff7c0,#ffd34a);box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,211,74,.8)}
.nov-badge{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#ff3b4e;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff}
.nov-float{position:absolute;transform:translate(-50%,-50%);pointer-events:none;font-family:var(--font-lilita),sans-serif;font-size:24px;color:#fff;-webkit-text-stroke:2px #e0602a;paint-order:stroke;animation:nov-pop 1.1s ease-out forwards;z-index:5;white-space:nowrap}
.nov-float-big{font-size:32px;color:#fff3a0;-webkit-text-stroke:3px #e07a00}
@keyframes nov-pop{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-170%) scale(1)}}
.nov-bump{animation:nov-bump2 .45s ease}
@keyframes nov-bump2{40%{transform:scale(1.4)}}
.nov-bar{position:relative;height:12px;border-radius:99px;background:rgba(90,50,20,.25);border:2px solid rgba(255,255,255,.8)}
.nov-bar>b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#ffcc1f,#ffe680);transition:width .5s ease}
.nov-bar>i{position:absolute;top:50%;transform:translate(-50%,-50%);font-style:normal}
.nov-shine{position:relative;overflow:hidden}
.nov-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:nov-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes nov-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.nov-shine::after,.nov-clouds i,.nov-letter,.nov-tbub{animation:none}}
`;
export const NOVA_EXTRA = `
.nov-ttile{display:inline-grid;place-items:center;width:1.05em;height:1.15em;margin:0 .03em;border-radius:.2em;background:linear-gradient(180deg,#fffdf6,#f6ead2);box-shadow:0 .1em 0 #d9b98a,0 .16em .2em rgba(90,50,20,.35);
  font-family:var(--font-lilita),sans-serif;color:var(--c);-webkit-text-stroke:.03em #fff;animation:brz-drop .6s cubic-bezier(.3,1.6,.5,1) both,brz-bob 2.8s ease-in-out infinite}
.nov-time{font-variant-numeric:tabular-nums}
.nov-tbub-e{display:inline-block;animation:nov-bob 2.4s ease-in-out infinite;filter:drop-shadow(0 4px 4px rgba(90,50,20,.3))}
.nov-low{color:#e0283a;animation:nov-blink 1s ease-in-out infinite}
@keyframes nov-blink{50%{opacity:.55}}
`.replace(/brz-/g, "nov-");
export const NOVA_FELT = `
.nov-root{color:#f2f0ff}
.nov-stars{position:absolute;inset:0;pointer-events:none;opacity:.5;background-image:radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 70% 20%,#fff,transparent),radial-gradient(1px 1px at 40% 80%,#fff,transparent),radial-gradient(1px 1px at 85% 65%,#fff,transparent),radial-gradient(1.5px 1.5px at 10% 75%,#fff,transparent);background-size:220px 220px}
.nov-panel{background:rgba(10,8,30,.55);border-color:color-mix(in srgb,var(--trim) 60%,transparent);color:#f2f0ff}
.nov-sheet{background:linear-gradient(180deg,#221a46,#140f2e);color:#f2f0ff;border:2px solid color-mix(in srgb,var(--trim) 60%,transparent)}
.nov-soft{color:#f2f0ff;background:rgba(255,255,255,.1)}
.nov-head{background:linear-gradient(140deg,var(--trim),#6a3aff)}
.nov-cta{color:#fff;background:linear-gradient(180deg,#ff6fae,#e0307a);box-shadow:0 4px 0 #a01a54,0 10px 24px -8px rgba(255,79,138,.7)}
.nov-tool-ico{background:linear-gradient(180deg,#2a2258,#1a1440);border-color:color-mix(in srgb,var(--trim) 60%,transparent);color:var(--trim);box-shadow:0 4px 0 #0a0820}
.nov-tool{color:#f2f0ff}
.nov-ttile{color:#fff;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 70%,#fff),var(--c));box-shadow:0 .1em 0 color-mix(in srgb,var(--c) 60%,#000),0 0 .4em color-mix(in srgb,var(--c) 60%,transparent);-webkit-text-stroke:.03em rgba(0,0,0,.25)}
.nov-mini{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;color:#fff;font-weight:900;font-size:13px;box-shadow:0 3px 0 rgba(0,0,0,.35),0 0 10px rgba(255,255,255,.25);animation:nov-bob 2.6s ease-in-out infinite}
.nov-low{color:#ff6a7a;animation:nov-blink 1s ease-in-out infinite}
`;
export const NOVA_CSS = NOVA_CSS_BASE + NOVA_EXTRA + NOVA_FELT;
