// Bubble Breeze's look: a bright, breezy sky — the gradient and accent follow the world, soft clouds drift, frosted
// white panels with a blue rim, glossy candy buttons. Clean and light, like a classic phone bubble game.
export const BREEZE_CSS = `
.brz-root{position:absolute;inset:0;overflow:hidden;color:#1e3a6a;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:linear-gradient(180deg,var(--s1),var(--s2) 55%,var(--s3));transition:background 1.2s ease}
.brz-root *{box-sizing:border-box}
.brz-night{color:#eef2ff}
.brz-clouds{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.brz-clouds i{position:absolute;height:38px;border-radius:40px;background:rgba(255,255,255,.75);filter:blur(1px);animation:brz-drift linear infinite}
.brz-clouds i::before,.brz-clouds i::after{content:"";position:absolute;border-radius:50%;background:inherit}
.brz-clouds i::before{width:46px;height:46px;left:16px;top:-22px}.brz-clouds i::after{width:34px;height:34px;left:48px;top:-14px}
@keyframes brz-drift{from{transform:translateX(-160px)}to{transform:translateX(110vw)}}
.brz-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.brz-scroll::-webkit-scrollbar{display:none}
.brz-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
/* the title */
.brz-title{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:clamp(150px,min(46vw,27vh),260px);cursor:pointer}
.brz-tl1,.brz-tl2{display:flex;gap:.02em;font-family:var(--font-lilita),sans-serif;line-height:.95}
.brz-tl1{font-size:clamp(34px,10vw,58px)}.brz-tl2{font-size:clamp(52px,16vw,96px);margin-top:-.08em}
.brz-letter{position:relative;display:inline-block;color:var(--c);-webkit-text-stroke:.06em #fff;paint-order:stroke;
  text-shadow:0 .06em 0 color-mix(in srgb,var(--c) 60%,#000),0 .12em .18em rgba(20,40,90,.35);
  animation:brz-drop .7s cubic-bezier(.3,1.6,.5,1) both,brz-bob 2.6s ease-in-out infinite}
.brz-letter::after{content:"";position:absolute;left:18%;top:16%;width:34%;height:16%;border-radius:50%;background:rgba(255,255,255,.75);filter:blur(1px);pointer-events:none}
.brz-hop{animation:brz-hop .5s ease both,brz-bob 2.6s ease-in-out infinite}
@keyframes brz-drop{0%{transform:translateY(-120%) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes brz-bob{50%{transform:translateY(-6%) rotate(-2deg)}}
@keyframes brz-hop{40%{transform:translateY(-30%) scale(1.1)}}
.brz-tbub{position:absolute;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0 12%,color-mix(in srgb,var(--c) 60%,#fff) 24%,var(--c) 62%,color-mix(in srgb,var(--c) 60%,#000));box-shadow:0 6px 12px -6px rgba(20,40,90,.5);animation:brz-float 4s ease-in-out infinite}
@keyframes brz-float{50%{transform:translateY(-10px)}}
/* panels and buttons */
.brz-panel{position:relative;border-radius:20px;background:rgba(255,255,255,.78);border:2px solid #fff;box-shadow:0 10px 24px -14px rgba(20,50,110,.55);backdrop-filter:blur(8px);color:#1e3a6a}
.brz-sheet{border-radius:26px;background:linear-gradient(180deg,#ffffff,#eef6ff);box-shadow:0 30px 60px -20px rgba(20,50,110,.55);color:#1e3a6a}
.brz-head{background:linear-gradient(140deg,#4fb6ff,#2f6fe0);border-bottom-left-radius:50% 18px;border-bottom-right-radius:50% 18px}
.brz-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.brz-btn:active{transform:translateY(2px) scale(.98)}
.brz-cta{color:#fff;background:linear-gradient(180deg,#5fd06a,#22a83f);box-shadow:0 4px 0 #15812c,0 10px 24px -8px rgba(34,168,63,.7)}
.brz-cta:active{box-shadow:0 2px 0 #15812c}
.brz-soft{color:#1e3a6a;background:rgba(30,58,106,.08)}
.brz-stage{position:absolute;inset:0}
.brz-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:inherit}
.brz-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:46px;border-radius:16px;background:linear-gradient(180deg,#ffffff,#dfeeff);border:2px solid #fff;box-shadow:0 4px 0 rgba(30,70,140,.3);color:#2f6fe0}
.brz-tool-on .brz-tool-ico{background:linear-gradient(180deg,#fff7c0,#ffd34a);box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,211,74,.8)}
.brz-badge{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#ff3b4e;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;border:2px solid #fff}
.brz-float{position:absolute;transform:translate(-50%,-50%);pointer-events:none;font-family:var(--font-lilita),sans-serif;font-size:24px;color:#fff;-webkit-text-stroke:2px #2f6fe0;paint-order:stroke;animation:brz-pop 1.1s ease-out forwards;z-index:5;white-space:nowrap}
.brz-float-big{font-size:32px;color:#fff3a0;-webkit-text-stroke:3px #e07a00}
@keyframes brz-pop{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-170%) scale(1)}}
.brz-bump{animation:brz-bump2 .45s ease}
@keyframes brz-bump2{40%{transform:scale(1.4)}}
.brz-bar{position:relative;height:12px;border-radius:99px;background:rgba(20,40,90,.25);border:2px solid rgba(255,255,255,.8)}
.brz-bar>b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#ffcc1f,#ffe680);transition:width .5s ease}
.brz-bar>i{position:absolute;top:50%;transform:translate(-50%,-50%);font-style:normal}
.brz-shine{position:relative;overflow:hidden}
.brz-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:brz-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes brz-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.brz-shine::after,.brz-clouds i,.brz-letter,.brz-tbub{animation:none}}
`;
