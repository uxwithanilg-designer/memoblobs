// Melon Merge Fiesta's look: a dim fruit market behind a wooden crate — the sky and accent follow the room; frosted dark panels,
// juicy fruit with faces and glossy buttons. Warm, festive and bright where it matters (the fruit).
export const MELON_CSS_BASE = `
.mln-root{position:absolute;inset:0;overflow:hidden;color:#4a2a1a;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:linear-gradient(180deg,var(--s1),var(--s2) 55%,var(--s3));transition:background 1.2s ease}
.mln-root *{box-sizing:border-box}
.mln-night{color:#eef2ff}
.mln-clouds{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.mln-clouds i{position:absolute;height:38px;border-radius:40px;background:rgba(255,255,255,.75);filter:blur(1px);animation:mln-drift linear infinite}
.mln-clouds i::before,.mln-clouds i::after{content:"";position:absolute;border-radius:50%;background:inherit}
.mln-clouds i::before{width:46px;height:46px;left:16px;top:-22px}.mln-clouds i::after{width:34px;height:34px;left:48px;top:-14px}
@keyframes mln-drift{from{transform:translateX(-160px)}to{transform:translateX(110vw)}}
.mln-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.mln-scroll::-webkit-scrollbar{display:none}
.mln-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
/* the title */
.mln-title{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:clamp(150px,min(46vw,27vh),260px);cursor:pointer}
.mln-tl1,.mln-tl2{display:flex;gap:.02em;font-family:var(--font-lilita),sans-serif;line-height:.95}
.mln-tl1{font-size:clamp(40px,12vw,74px);color:#ff5a6e;-webkit-text-stroke:.06em #0f4a1e;text-shadow:0 .06em 0 #0f4a1e,0 .11em 0 #072a10,0 0 .5em rgba(255,90,110,.4);animation:mln-drop .7s cubic-bezier(.3,1.6,.5,1) both}
.mln-tl3{font-family:var(--font-lilita),sans-serif;font-size:clamp(28px,8vw,46px);line-height:1;margin-top:.05em;color:#ffd23f;-webkit-text-stroke:.07em #6a3a08;paint-order:stroke;text-shadow:0 .08em 0 #6a3a08,0 .14em .2em rgba(0,0,0,.45);letter-spacing:.08em;animation:mln-drop .7s .25s cubic-bezier(.3,1.6,.5,1) both}
.mln-fruits{display:flex;align-items:flex-end;justify-content:center;gap:2px;margin-top:6px}
.mln-fruits span{display:inline-block;line-height:1;filter:drop-shadow(0 3px 3px rgba(0,0,0,.4));animation:mln-drop .6s cubic-bezier(.3,1.6,.5,1) both,mln-bob 2.6s ease-in-out infinite}
.mln-letter{position:relative;display:inline-block;color:var(--c);-webkit-text-stroke:.06em #fff;paint-order:stroke;
  text-shadow:0 .06em 0 color-mix(in srgb,var(--c) 60%,#000),0 .12em .18em rgba(90,50,20,.35);
  animation:mln-drop .7s cubic-bezier(.3,1.6,.5,1) both,mln-bob 2.6s ease-in-out infinite}
.mln-letter::after{content:"";position:absolute;left:18%;top:16%;width:34%;height:16%;border-radius:50%;background:rgba(255,255,255,.75);filter:blur(1px);pointer-events:none}
.mln-hop{animation:mln-hop .5s ease both,mln-bob 2.6s ease-in-out infinite}
@keyframes mln-drop{0%{transform:translateY(-120%) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes mln-bob{50%{transform:translateY(-6%) rotate(-2deg)}}
@keyframes mln-hop{40%{transform:translateY(-30%) scale(1.1)}}
.mln-tbub{position:absolute;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0 12%,color-mix(in srgb,var(--c) 60%,#fff) 24%,var(--c) 62%,color-mix(in srgb,var(--c) 60%,#000));box-shadow:0 6px 12px -6px rgba(90,50,20,.5);animation:mln-float 4s ease-in-out infinite}
@keyframes mln-float{50%{transform:translateY(-10px)}}
/* panels and buttons */
.mln-panel{position:relative;border-radius:20px;background:rgba(255,255,255,.78);border:2px solid #fff;box-shadow:0 10px 24px -14px rgba(110,60,20,.55);backdrop-filter:blur(8px);color:#4a2a1a}
.mln-sheet{border-radius:26px;background:linear-gradient(180deg,#ffffff,#fff6ea);box-shadow:0 30px 60px -20px rgba(110,60,20,.55);color:#4a2a1a}
.mln-head{background:linear-gradient(140deg,#4fb6ff,#e0602a);border-bottom-left-radius:50% 18px;border-bottom-right-radius:50% 18px}
.mln-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.mln-btn:active{transform:translateY(2px) scale(.98)}
.mln-cta{color:#fff;background:linear-gradient(180deg,#5fd06a,#22a83f);box-shadow:0 4px 0 #15812c,0 10px 24px -8px rgba(34,168,63,.7)}
.mln-cta:active{box-shadow:0 2px 0 #15812c}
.mln-soft{color:#4a2a1a;background:rgba(74,42,26,.08)}
.mln-stage{position:absolute;inset:0}
.mln-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:inherit}
.mln-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:46px;border-radius:16px;background:linear-gradient(180deg,#ffffff,#fff0dc);border:2px solid #fff;box-shadow:0 4px 0 rgba(160,90,40,.3);color:#e0602a}
.mln-tool-on .mln-tool-ico{background:linear-gradient(180deg,#fff7c0,#ffd34a);box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,211,74,.8)}
.mln-badge{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#ff3b4e;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff}
.mln-float{position:absolute;transform:translate(-50%,-50%);pointer-events:none;font-family:var(--font-lilita),sans-serif;font-size:24px;color:#fff;-webkit-text-stroke:2px #e0602a;paint-order:stroke;animation:mln-pop 1.1s ease-out forwards;z-index:5;white-space:nowrap}
.mln-float-big{font-size:32px;color:#fff3a0;-webkit-text-stroke:3px #e07a00}
@keyframes mln-pop{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-170%) scale(1)}}
.mln-bump{animation:mln-bump2 .45s ease}
@keyframes mln-bump2{40%{transform:scale(1.4)}}
.mln-bar{position:relative;height:12px;border-radius:99px;background:rgba(90,50,20,.25);border:2px solid rgba(255,255,255,.8)}
.mln-bar>b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#ffcc1f,#ffe680);transition:width .5s ease}
.mln-bar>i{position:absolute;top:50%;transform:translate(-50%,-50%);font-style:normal}
.mln-shine{position:relative;overflow:hidden}
.mln-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:mln-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes mln-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.mln-shine::after,.mln-clouds i,.mln-letter,.mln-tbub{animation:none}}
`;
export const MELON_EXTRA = `
.mln-ttile{display:inline-grid;place-items:center;width:1.05em;height:1.15em;margin:0 .03em;border-radius:.2em;background:linear-gradient(180deg,#fffdf6,#f6ead2);box-shadow:0 .1em 0 #d9b98a,0 .16em .2em rgba(90,50,20,.35);
  font-family:var(--font-lilita),sans-serif;color:var(--c);-webkit-text-stroke:.03em #fff;animation:brz-drop .6s cubic-bezier(.3,1.6,.5,1) both,brz-bob 2.8s ease-in-out infinite}
.mln-time{font-variant-numeric:tabular-nums}
.mln-tbub-e{display:inline-block;animation:mln-bob 2.4s ease-in-out infinite;filter:drop-shadow(0 4px 4px rgba(90,50,20,.3))}
.mln-low{color:#e0283a;animation:mln-blink 1s ease-in-out infinite}
@keyframes mln-blink{50%{opacity:.55}}
`.replace(/brz-/g, "mln-");
export const MELON_FELT = `
.mln-root{color:#fff4ea}
.mln-stars{position:absolute;inset:0;pointer-events:none;opacity:.35;background-image:radial-gradient(40px 40px at 20% 30%,color-mix(in srgb,var(--trim) 35%,transparent),transparent),radial-gradient(60px 60px at 75% 20%,color-mix(in srgb,var(--trim) 25%,transparent),transparent),radial-gradient(30px 30px at 40% 80%,rgba(255,255,255,.18),transparent),radial-gradient(50px 50px at 88% 70%,color-mix(in srgb,var(--trim) 22%,transparent),transparent);background-size:340px 340px;animation:mln-float 9s ease-in-out infinite}
.mln-panel{background:rgba(20,8,10,.55);border-color:color-mix(in srgb,var(--trim) 55%,transparent);color:#fff4ea}
.mln-sheet{background:linear-gradient(180deg,#3a2418,#20120a);color:#fff4ea;border:2px solid color-mix(in srgb,var(--trim) 60%,transparent)}
.mln-soft{color:#fff4ea;background:rgba(255,255,255,.1)}
.mln-head{background:linear-gradient(140deg,#ff5a6e,#2fa84a)}
.mln-cta{color:#fff;text-shadow:0 1px 0 rgba(0,60,10,.5);background:linear-gradient(180deg,#8be85a,#2fa84a);box-shadow:0 4px 0 #1a6a2a,0 10px 24px -8px rgba(47,168,74,.75)}
.mln-cta:active{box-shadow:0 2px 0 #1a6a2a}
.mln-tool-ico{background:linear-gradient(180deg,#4a2026,#2a1014);border-color:color-mix(in srgb,var(--trim) 60%,transparent);color:var(--trim);box-shadow:0 4px 0 #12060a}
.mln-tool{color:#fff4ea}
.mln-tool-on .mln-tool-ico{background:linear-gradient(180deg,#fff7c0,#ffd34a);color:#7a3a00;box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,211,74,.8)}
.mln-ball{display:inline-grid;place-items:center;border-radius:50%;color:color-mix(in srgb,var(--c) 45%,#000);font-family:var(--font-lilita),sans-serif;
  background:radial-gradient(circle at 50% 50%,#fff 0 56%,transparent 57%),radial-gradient(circle at 32% 28%,color-mix(in srgb,var(--c) 40%,#fff) 0 10%,var(--c) 45%,color-mix(in srgb,var(--c) 55%,#000));
  box-shadow:inset -.06em -.08em .12em rgba(0,0,0,.35),inset .05em .06em .1em rgba(255,255,255,.5),0 .08em .2em rgba(0,0,0,.45);position:relative}
.mln-ball::after{content:"";position:absolute;left:16%;top:10%;width:38%;height:24%;border-radius:50%;background:rgba(255,255,255,.7);filter:blur(1px);transform:rotate(-30deg)}
.mln-tl{font-family:var(--font-lilita),sans-serif;line-height:.9;text-align:center;color:#fff;-webkit-text-stroke:.05em #5a1a10;paint-order:stroke;text-shadow:0 .07em 0 #5a1a10,0 .14em .25em rgba(0,0,0,.5)}
.mln-tl1{font-size:clamp(40px,12vw,72px);color:#ffd23f;-webkit-text-stroke:.06em #6a1e08;text-shadow:0 .06em 0 #6a1e08,0 .1em 0 #3a0e04,0 0 .5em rgba(255,180,40,.45);animation:mln-drop .7s cubic-bezier(.3,1.6,.5,1) both}
.mln-tl2{display:flex;align-items:center;justify-content:center;gap:.06em;margin-top:.1em}
.mln-tl2 .mln-ball{width:1.05em;height:1.05em;font-size:clamp(34px,10vw,60px);animation:mln-drop .7s cubic-bezier(.3,1.6,.5,1) both,mln-bob 2.6s ease-in-out infinite}
.mln-tl2 .mln-ball span{font-size:.48em;position:relative;z-index:1}
.mln-low{color:#ff7a8a;animation:mln-blink 1s ease-in-out infinite}
`;
export const MELON_CSS = MELON_CSS_BASE + MELON_EXTRA + MELON_FELT;
