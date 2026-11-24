// Marble Merge 2048's look: a dim room behind a glass jar — the sky and accent follow the room; frosted dark panels,
// glossy candy-coloured marbles and buttons. Warm, shiny and bright where it matters (the marbles).
export const MARBLE_CSS_BASE = `
.mbl-root{position:absolute;inset:0;overflow:hidden;color:#4a2a1a;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:linear-gradient(180deg,var(--s1),var(--s2) 55%,var(--s3));transition:background 1.2s ease}
.mbl-root *{box-sizing:border-box}
.mbl-night{color:#eef2ff}
.mbl-clouds{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.mbl-clouds i{position:absolute;height:38px;border-radius:40px;background:rgba(255,255,255,.75);filter:blur(1px);animation:mbl-drift linear infinite}
.mbl-clouds i::before,.mbl-clouds i::after{content:"";position:absolute;border-radius:50%;background:inherit}
.mbl-clouds i::before{width:46px;height:46px;left:16px;top:-22px}.mbl-clouds i::after{width:34px;height:34px;left:48px;top:-14px}
@keyframes mbl-drift{from{transform:translateX(-160px)}to{transform:translateX(110vw)}}
.mbl-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.mbl-scroll::-webkit-scrollbar{display:none}
.mbl-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
/* the title */
.mbl-title{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:clamp(150px,min(46vw,27vh),260px);cursor:pointer}
.mbl-tl1,.mbl-tl2{display:flex;gap:.02em;font-family:var(--font-lilita),sans-serif;line-height:.95}
.mbl-tl1{font-size:clamp(28px,8.6vw,50px)}.mbl-tl2{font-size:clamp(34px,10.5vw,62px);margin-top:.12em}
.mbl-letter{position:relative;display:inline-block;color:var(--c);-webkit-text-stroke:.06em #fff;paint-order:stroke;
  text-shadow:0 .06em 0 color-mix(in srgb,var(--c) 60%,#000),0 .12em .18em rgba(90,50,20,.35);
  animation:mbl-drop .7s cubic-bezier(.3,1.6,.5,1) both,mbl-bob 2.6s ease-in-out infinite}
.mbl-letter::after{content:"";position:absolute;left:18%;top:16%;width:34%;height:16%;border-radius:50%;background:rgba(255,255,255,.75);filter:blur(1px);pointer-events:none}
.mbl-hop{animation:mbl-hop .5s ease both,mbl-bob 2.6s ease-in-out infinite}
@keyframes mbl-drop{0%{transform:translateY(-120%) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes mbl-bob{50%{transform:translateY(-6%) rotate(-2deg)}}
@keyframes mbl-hop{40%{transform:translateY(-30%) scale(1.1)}}
.mbl-tbub{position:absolute;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0 12%,color-mix(in srgb,var(--c) 60%,#fff) 24%,var(--c) 62%,color-mix(in srgb,var(--c) 60%,#000));box-shadow:0 6px 12px -6px rgba(90,50,20,.5);animation:mbl-float 4s ease-in-out infinite}
@keyframes mbl-float{50%{transform:translateY(-10px)}}
/* panels and buttons */
.mbl-panel{position:relative;border-radius:20px;background:rgba(255,255,255,.78);border:2px solid #fff;box-shadow:0 10px 24px -14px rgba(110,60,20,.55);backdrop-filter:blur(8px);color:#4a2a1a}
.mbl-sheet{border-radius:26px;background:linear-gradient(180deg,#ffffff,#fff6ea);box-shadow:0 30px 60px -20px rgba(110,60,20,.55);color:#4a2a1a}
.mbl-head{background:linear-gradient(140deg,#4fb6ff,#e0602a);border-bottom-left-radius:50% 18px;border-bottom-right-radius:50% 18px}
.mbl-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.mbl-btn:active{transform:translateY(2px) scale(.98)}
.mbl-cta{color:#fff;background:linear-gradient(180deg,#5fd06a,#22a83f);box-shadow:0 4px 0 #15812c,0 10px 24px -8px rgba(34,168,63,.7)}
.mbl-cta:active{box-shadow:0 2px 0 #15812c}
.mbl-soft{color:#4a2a1a;background:rgba(74,42,26,.08)}
.mbl-stage{position:absolute;inset:0}
.mbl-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:inherit}
.mbl-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:46px;border-radius:16px;background:linear-gradient(180deg,#ffffff,#fff0dc);border:2px solid #fff;box-shadow:0 4px 0 rgba(160,90,40,.3);color:#e0602a}
.mbl-tool-on .mbl-tool-ico{background:linear-gradient(180deg,#fff7c0,#ffd34a);box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,211,74,.8)}
.mbl-badge{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#ff3b4e;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff}
.mbl-float{position:absolute;transform:translate(-50%,-50%);pointer-events:none;font-family:var(--font-lilita),sans-serif;font-size:24px;color:#fff;-webkit-text-stroke:2px #e0602a;paint-order:stroke;animation:mbl-pop 1.1s ease-out forwards;z-index:5;white-space:nowrap}
.mbl-float-big{font-size:32px;color:#fff3a0;-webkit-text-stroke:3px #e07a00}
@keyframes mbl-pop{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-170%) scale(1)}}
.mbl-bump{animation:mbl-bump2 .45s ease}
@keyframes mbl-bump2{40%{transform:scale(1.4)}}
.mbl-bar{position:relative;height:12px;border-radius:99px;background:rgba(90,50,20,.25);border:2px solid rgba(255,255,255,.8)}
.mbl-bar>b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#ffcc1f,#ffe680);transition:width .5s ease}
.mbl-bar>i{position:absolute;top:50%;transform:translate(-50%,-50%);font-style:normal}
.mbl-shine{position:relative;overflow:hidden}
.mbl-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:mbl-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes mbl-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.mbl-shine::after,.mbl-clouds i,.mbl-letter,.mbl-tbub{animation:none}}
`;
export const MARBLE_EXTRA = `
.mbl-ttile{display:inline-grid;place-items:center;width:1.05em;height:1.15em;margin:0 .03em;border-radius:.2em;background:linear-gradient(180deg,#fffdf6,#f6ead2);box-shadow:0 .1em 0 #d9b98a,0 .16em .2em rgba(90,50,20,.35);
  font-family:var(--font-lilita),sans-serif;color:var(--c);-webkit-text-stroke:.03em #fff;animation:brz-drop .6s cubic-bezier(.3,1.6,.5,1) both,brz-bob 2.8s ease-in-out infinite}
.mbl-time{font-variant-numeric:tabular-nums}
.mbl-tbub-e{display:inline-block;animation:mbl-bob 2.4s ease-in-out infinite;filter:drop-shadow(0 4px 4px rgba(90,50,20,.3))}
.mbl-low{color:#e0283a;animation:mbl-blink 1s ease-in-out infinite}
@keyframes mbl-blink{50%{opacity:.55}}
`.replace(/brz-/g, "mbl-");
export const MARBLE_FELT = `
.mbl-root{color:#fff4ea}
.mbl-stars{position:absolute;inset:0;pointer-events:none;opacity:.35;background-image:radial-gradient(40px 40px at 20% 30%,color-mix(in srgb,var(--trim) 35%,transparent),transparent),radial-gradient(60px 60px at 75% 20%,color-mix(in srgb,var(--trim) 25%,transparent),transparent),radial-gradient(30px 30px at 40% 80%,rgba(255,255,255,.18),transparent),radial-gradient(50px 50px at 88% 70%,color-mix(in srgb,var(--trim) 22%,transparent),transparent);background-size:340px 340px;animation:mbl-float 9s ease-in-out infinite}
.mbl-panel{background:rgba(20,8,10,.55);border-color:color-mix(in srgb,var(--trim) 55%,transparent);color:#fff4ea}
.mbl-sheet{background:linear-gradient(180deg,#3a1a1e,#200c10);color:#fff4ea;border:2px solid color-mix(in srgb,var(--trim) 60%,transparent)}
.mbl-soft{color:#fff4ea;background:rgba(255,255,255,.1)}
.mbl-head{background:linear-gradient(140deg,var(--trim),#e0304e)}
.mbl-cta{color:#4a1a00;background:linear-gradient(180deg,#ffe066,#ffb21a);box-shadow:0 4px 0 #c26a00,0 10px 24px -8px rgba(255,178,26,.75)}
.mbl-cta:active{box-shadow:0 2px 0 #c26a00}
.mbl-tool-ico{background:linear-gradient(180deg,#4a2026,#2a1014);border-color:color-mix(in srgb,var(--trim) 60%,transparent);color:var(--trim);box-shadow:0 4px 0 #12060a}
.mbl-tool{color:#fff4ea}
.mbl-tool-on .mbl-tool-ico{background:linear-gradient(180deg,#fff7c0,#ffd34a);color:#7a3a00;box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,211,74,.8)}
.mbl-ball{display:inline-grid;place-items:center;border-radius:50%;color:color-mix(in srgb,var(--c) 45%,#000);font-family:var(--font-lilita),sans-serif;
  background:radial-gradient(circle at 50% 50%,#fff 0 56%,transparent 57%),radial-gradient(circle at 32% 28%,color-mix(in srgb,var(--c) 40%,#fff) 0 10%,var(--c) 45%,color-mix(in srgb,var(--c) 55%,#000));
  box-shadow:inset -.06em -.08em .12em rgba(0,0,0,.35),inset .05em .06em .1em rgba(255,255,255,.5),0 .08em .2em rgba(0,0,0,.45);position:relative}
.mbl-ball::after{content:"";position:absolute;left:16%;top:10%;width:38%;height:24%;border-radius:50%;background:rgba(255,255,255,.7);filter:blur(1px);transform:rotate(-30deg)}
.mbl-tl{font-family:var(--font-lilita),sans-serif;line-height:.9;text-align:center;color:#fff;-webkit-text-stroke:.05em #5a1a10;paint-order:stroke;text-shadow:0 .07em 0 #5a1a10,0 .14em .25em rgba(0,0,0,.5)}
.mbl-tl1{font-size:clamp(40px,12vw,72px);color:#ffd23f;-webkit-text-stroke:.06em #6a1e08;text-shadow:0 .06em 0 #6a1e08,0 .1em 0 #3a0e04,0 0 .5em rgba(255,180,40,.45);animation:mbl-drop .7s cubic-bezier(.3,1.6,.5,1) both}
.mbl-tl2{display:flex;align-items:center;justify-content:center;gap:.06em;margin-top:.1em}
.mbl-tl2 .mbl-ball{width:1.05em;height:1.05em;font-size:clamp(34px,10vw,60px);animation:mbl-drop .7s cubic-bezier(.3,1.6,.5,1) both,mbl-bob 2.6s ease-in-out infinite}
.mbl-tl2 .mbl-ball span{font-size:.48em;position:relative;z-index:1}
.mbl-low{color:#ff7a8a;animation:mbl-blink 1s ease-in-out infinite}
`;
export const MARBLE_CSS = MARBLE_CSS_BASE + MARBLE_EXTRA + MARBLE_FELT;
