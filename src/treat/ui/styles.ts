// Treatrio's look: a sunny dessert shop — a warm sky tinted by the current shop, festoon lights and bunting along
// the top, frosted-cream panels, glossy 3D treats on wooden cabinets. Light and sweet, unlike the night games.
export const TREAT_CSS = `
.trt-root{position:absolute;inset:0;overflow:hidden;color:#5a2a3a;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:radial-gradient(70% 40% at 50% 0%,rgba(255,255,255,.55),transparent 70%),linear-gradient(180deg,var(--s1),var(--s2) 55%,var(--s3));transition:background 1s ease}
.trt-root *{box-sizing:border-box}
.trt-root::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.12;background-image:radial-gradient(circle at 25% 25%,#fff 2px,transparent 3px),radial-gradient(circle at 75% 75%,#fff 2px,transparent 3px);background-size:38px 38px}
/* the shop's striped awning with a scalloped edge, gently swaying */
.trt-awning{position:absolute;top:0;left:0;right:0;height:44px;pointer-events:none;z-index:1;transform-origin:top;animation:trt-sway 6s ease-in-out infinite;
  background:repeating-linear-gradient(90deg,#ff5fa8 0 30px,#fff6fb 30px 60px);
  -webkit-mask:radial-gradient(15px 13px at 15px 31px,transparent 98%,#000) 0 0/30px 100% repeat-x,linear-gradient(#000,#000) 0 0/100% 31px no-repeat;
  mask:radial-gradient(15px 13px at 15px 31px,transparent 98%,#000) 0 0/30px 100% repeat-x,linear-gradient(#000,#000) 0 0/100% 31px no-repeat;
  filter:drop-shadow(0 5px 6px rgba(200,50,120,.28))}
.trt-awning::after{content:"";position:absolute;inset:0 0 auto;height:31px;background:linear-gradient(180deg,rgba(255,255,255,.35),transparent 60%)}
@keyframes trt-sway{50%{transform:scaleY(1.06)}}
.trt-awning-thin{height:24px;-webkit-mask:radial-gradient(15px 9px at 15px 17px,transparent 98%,#000) 0 0/30px 100% repeat-x,linear-gradient(#000,#000) 0 0/100% 17px no-repeat;mask:radial-gradient(15px 9px at 15px 17px,transparent 98%,#000) 0 0/30px 100% repeat-x,linear-gradient(#000,#000) 0 0/100% 17px no-repeat}
.trt-awning-thin::after{height:17px}
/* sprinkles drifting down the shop window */
.trt-sprinkles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.trt-sprinkles i{position:absolute;top:-20px;width:5px;height:15px;border-radius:4px;opacity:.75;animation:trt-fall linear infinite}
@keyframes trt-fall{from{transform:translateY(-20px) rotate(var(--r))}to{transform:translateY(110vh) rotate(calc(var(--r) + 260deg))}}
/* whipped-cream clouds along the bottom */
.trt-cream{position:absolute;left:-20px;right:-20px;bottom:-52px;height:90px;pointer-events:none;opacity:.7;
  background:radial-gradient(circle at 40px 60px,#fff 38px,transparent 39px) 0 0/80px 90px repeat-x,radial-gradient(circle at 0 70px,#fff8ef 34px,transparent 35px) 40px 6px/80px 90px repeat-x}
.trt-home-bg{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(55% 35% at 50% 18%,rgba(255,255,255,.75),transparent 70%),radial-gradient(40% 30% at 10% 85%,rgba(127,216,255,.45),transparent 70%),radial-gradient(40% 30% at 90% 80%,rgba(184,240,138,.45),transparent 70%),linear-gradient(180deg,#ffd3ea,#ffe4cf 45%,#ffd7e6);
  }
.trt-home-bg::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.22) 0 22px,transparent 22px 44px)}
.trt-title3d{position:relative;width:100%;height:clamp(190px,50vw,300px);margin-top:6px;filter:drop-shadow(0 14px 18px rgba(200,50,120,.28))}
.trt-lights{position:absolute;top:0;left:0;right:0;height:60px;pointer-events:none;z-index:1}
.trt-lights b{position:absolute;top:36px;width:9px;height:9px;border-radius:50%;background:#fff6c0;box-shadow:0 0 12px 4px rgba(255,236,160,.8);animation:trt-blink 2.4s ease-in-out infinite}
@keyframes trt-blink{50%{opacity:.4}}
.trt-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.trt-scroll::-webkit-scrollbar{display:none}
.trt-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.trt-title{font-size:66px;line-height:.92}
@media (min-width:640px){.trt-title{font-size:86px}}
.trt-grad{background:linear-gradient(180deg,#ff8fc8,#ff4f9a 55%,#c8327a);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #fff) drop-shadow(0 6px 10px rgba(200,50,120,.3))}
.trt-glass{position:relative;border-radius:22px;background:rgba(255,255,255,.62);border:1px solid rgba(255,255,255,.9);box-shadow:0 10px 24px -14px rgba(120,40,80,.5);backdrop-filter:blur(10px);color:#5a2a3a}
.trt-sheet{border-radius:26px;background:linear-gradient(180deg,#fffaf4,#fff0f6);box-shadow:0 30px 60px -20px rgba(90,42,58,.5)}
.trt-head{background:linear-gradient(140deg,#ff6fb5,#ffb52e);border-bottom-left-radius:50% 18px;border-bottom-right-radius:50% 18px}
.trt-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.trt-btn:active{transform:translateY(2px) scale(.98)}
.trt-cta{color:#fff;background:linear-gradient(180deg,#ff8fc8,#ff4f9a);box-shadow:0 4px 0 #c8327a,0 10px 24px -8px rgba(255,79,154,.7)}
.trt-cta:active{box-shadow:0 2px 0 #c8327a}
.trt-soft{color:#5a2a3a;background:rgba(90,42,58,.08)}
.trt-stage{position:absolute;inset:0}
.trt-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:#5a2a3a}
.trt-tool-ico{position:relative;display:grid;place-items:center;width:54px;height:48px;border-radius:18px;background:rgba(255,255,255,.75);border:1px solid #fff;box-shadow:0 4px 0 rgba(200,120,150,.35)}
.trt-badge{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#ff4f9a;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center}
.trt-float{position:absolute;transform:translate(-50%,-50%);pointer-events:none;font-family:var(--font-lilita),sans-serif;font-size:26px;color:#fff;-webkit-text-stroke:2px #c8327a;paint-order:stroke;animation:trt-rise 1.1s ease-out forwards;z-index:5}
.trt-float-big{font-size:30px;color:#fff3a0;-webkit-text-stroke:2px #e07a00}
@keyframes trt-rise{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-160%) scale(1)}}
.trt-shine{position:relative;overflow:hidden}
.trt-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:trt-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes trt-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.trt-shine::after,.trt-lights b,.trt-awning,.trt-sprinkles i{animation:none}}
`;
