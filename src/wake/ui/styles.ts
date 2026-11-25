// Wake Racers' interface: a 2026 mobile racing look — chunky glossy buttons with depth, solid tinted glass panels (no
// blur: phones stay smooth), the display font, colours that follow the world (--acc, --acc2), safe areas on every edge,
// big round thumb controls (steer on the left, nitro, jump, brake and power on the right), letterbox bars for the
// cinematic moments, and a race HUD (place, progress with rivals, hearts, coins, oil, nitro ring, timers) that stays
// out of the middle of the picture. Animations are transform and opacity only.
export const WAKE_CSS = `
.wk-root{position:absolute;inset:0;overflow:hidden;background:#061226;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:none}
.wk-root *{box-sizing:border-box}
.wk-stage{position:absolute;inset:0}
.wk-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.wk-ui{position:absolute;inset:0;pointer-events:none;z-index:5}
.wk-ui > *{pointer-events:auto}
.wk-safe{padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}
.wk-panel{background:rgba(8,16,40,.72);border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 40px -18px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.14);border-radius:26px}
.wk-pill{display:inline-flex;align-items:center;gap:.4rem;border-radius:999px;padding:.34rem .8rem .34rem .42rem;font-weight:800;font-size:15px;line-height:1;background:rgba(8,16,40,.66);border:1px solid rgba(255,255,255,.16)}
.wk-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:0;border-radius:20px;font-weight:800;cursor:pointer;color:#0a1a3a;
  background:linear-gradient(180deg,#fff 0%,#e3ecfa 100%);box-shadow:0 5px 0 #a9b8d6,0 12px 22px -10px rgba(0,0,0,.6);transition:transform .12s ease,box-shadow .12s ease;font-family:inherit}
.wk-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #a9b8d6,0 6px 14px -8px rgba(0,0,0,.6)}
.wk-btn:disabled{opacity:.5;cursor:default}
.wk-cta{color:#032b33;background:linear-gradient(180deg,#C9FFF6 0%,#5FF2E0 48%,#13C9D6 100%);box-shadow:0 6px 0 #0A7F96,0 18px 34px -12px rgba(19,201,214,.75)}
.wk-cta:active{box-shadow:0 2px 0 #0A7F96,0 8px 18px -8px rgba(19,201,214,.6)}
.wk-hot{color:#fff;background:linear-gradient(180deg,#FFB27A 0%,#FF6A3D 50%,#E8402A 100%);box-shadow:0 6px 0 #A82A1A,0 16px 30px -12px rgba(255,106,61,.7)}
.wk-hot:active{box-shadow:0 2px 0 #A82A1A}
.wk-violet{color:#fff;background:linear-gradient(180deg,#C7AFFF 0%,#8B6BFF 55%,#6243E8 100%);box-shadow:0 6px 0 #3E26A8,0 14px 28px -10px rgba(124,92,255,.7)}
.wk-violet:active{box-shadow:0 2px 0 #3E26A8}
.wk-ghost{color:#fff;background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.26),0 4px 0 rgba(0,0,0,.25)}
.wk-ghost:active{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.26)}
.wk-shine::after{content:"";position:absolute;inset:3px 12% auto;height:40%;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.75),rgba(255,255,255,0));pointer-events:none}
.wk-icon{width:56px;height:56px;border-radius:18px;padding:0}
/* logo */
.wk-logo{display:flex;flex-direction:column;align-items:center;line-height:.82;filter:drop-shadow(0 5px 0 #06142e) drop-shadow(0 14px 22px rgba(0,0,0,.45))}
.wk-logo .row{display:flex;gap:.03em}
.wk-logo span{display:inline-block;font-family:var(--font-lilita),sans-serif;-webkit-text-stroke:.06em #06142e;paint-order:stroke fill;animation:wk-drop .7s cubic-bezier(.3,1.6,.5,1) both;
  background:linear-gradient(180deg,#fff 0%,var(--c1) 45%,var(--c2) 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.wk-logo .l1 span{font-size:clamp(54px,15vw,104px)}.wk-logo .l2 span{font-size:clamp(40px,11vw,76px)}
@keyframes wk-drop{from{transform:translateY(-40px) scale(.6);opacity:0}to{transform:none;opacity:1}}
.wk-wave{animation:wk-bob 3.2s ease-in-out infinite}
@keyframes wk-bob{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-6px) rotate(1deg)}}
/* chips */
.wk-chip{display:inline-flex;align-items:center;gap:.35rem;border-radius:999px;padding:.3rem .7rem;font-weight:800;font-size:12.5px;letter-spacing:.02em;line-height:1;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);white-space:nowrap}
.wk-chip.acc{background:var(--acc);color:#06142e;border:0}
/* letterbox */
.wk-bar{position:absolute;left:0;right:0;height:11vh;background:#000;z-index:4;pointer-events:none;transition:transform .5s ease}
.wk-bar.top{top:0}.wk-bar.bot{bottom:0}
/* race HUD */
.wk-hud{position:absolute;inset:0;pointer-events:none;z-index:6}
.wk-hud .tl{position:absolute;left:max(12px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top));display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.wk-hud .tr{position:absolute;right:max(12px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));display:flex;flex-direction:column;gap:6px;align-items:flex-end;pointer-events:auto}
.wk-place{display:flex;align-items:baseline;gap:4px;font-family:var(--font-lilita),sans-serif;line-height:.9;-webkit-text-stroke:.06em #06142e;paint-order:stroke fill;text-shadow:0 3px 0 #06142e}
.wk-place b{font-size:52px;font-weight:400}.wk-place i{font-style:normal;font-size:22px}.wk-place small{font-size:20px;opacity:.85}
.wk-track{position:absolute;left:50%;transform:translateX(-50%);top:max(14px,env(safe-area-inset-top));width:min(46vw,420px);height:10px;border-radius:999px;background:rgba(6,20,46,.6);border:1.5px solid rgba(255,255,255,.25)}
.wk-track .fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,var(--acc),var(--acc2))}
.wk-track .dot{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:2px solid #06142e}
.wk-track .me{width:18px;height:18px;margin:-9px 0 0 -9px;background:#fff;border:3px solid var(--acc);box-shadow:0 0 10px var(--acc)}
.wk-track .cp{position:absolute;top:-3px;bottom:-3px;width:2px;background:rgba(255,255,255,.7)}
.wk-track .flag{position:absolute;right:-14px;top:-8px;font-size:16px}
.wk-meter{display:flex;align-items:center;gap:6px;font-weight:800;font-size:13px}
.wk-meter .bar{width:96px;height:9px;border-radius:999px;background:rgba(6,20,46,.65);border:1.5px solid rgba(255,255,255,.22);overflow:hidden}
.wk-meter .bar > div{height:100%;border-radius:999px;transition:width .2s linear}
.wk-low{animation:wk-blink .5s steps(2) infinite}
@keyframes wk-blink{50%{opacity:.35}}
.wk-timer{font-family:var(--font-lilita),sans-serif;font-size:28px;line-height:1;-webkit-text-stroke:.06em #06142e;paint-order:stroke fill;text-shadow:0 3px 0 #06142e}
.wk-timer.warn{color:#FF6A5A;animation:wk-pulse .5s ease-in-out infinite}
@keyframes wk-pulse{50%{transform:scale(1.1)}}
.wk-speed{position:absolute;left:50%;transform:translateX(-50%);bottom:max(14px,env(safe-area-inset-bottom));font-family:var(--font-lilita),sans-serif;font-size:30px;line-height:1;text-align:center;-webkit-text-stroke:.06em #06142e;paint-order:stroke fill;text-shadow:0 3px 0 #06142e;opacity:.95}
.wk-speed small{display:block;font-size:11px;font-family:var(--font-fredoka),sans-serif;font-weight:800;letter-spacing:.12em;opacity:.8;-webkit-text-stroke:0}
/* thumb controls */
.wk-pad{position:absolute;bottom:max(16px,calc(env(safe-area-inset-bottom) + 8px));display:flex;gap:12px;align-items:flex-end;pointer-events:auto;z-index:7}
.wk-pad.l{left:max(14px,env(safe-area-inset-left))}.wk-pad.r{right:max(14px,env(safe-area-inset-right))}
.wk-tb{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:50%;border:0;color:#fff;font-weight:900;font-family:inherit;cursor:pointer;touch-action:none;
  background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.28),rgba(255,255,255,.08) 60%),rgba(8,16,40,.62);box-shadow:inset 0 0 0 2px rgba(255,255,255,.3),0 8px 20px -8px rgba(0,0,0,.6);transition:transform .08s ease}
.wk-tb.on{transform:scale(.92);box-shadow:inset 0 0 0 3px var(--acc),0 0 24px -4px var(--acc)}
.wk-tb .k{position:absolute;bottom:-18px;font-size:10px;font-weight:800;letter-spacing:.08em;opacity:.75;white-space:nowrap}
.wk-steer{width:clamp(70px,20vw,92px);height:clamp(70px,20vw,92px)}
.wk-nitro{width:clamp(86px,24vw,108px);height:clamp(86px,24vw,108px);background:radial-gradient(circle at 50% 35%,#FFD08A,#FF6A3D 60%,#C8361E);box-shadow:inset 0 0 0 3px rgba(255,255,255,.45),0 10px 28px -8px rgba(255,106,61,.8)}
.wk-nitro.empty{filter:grayscale(.8) brightness(.7)}
.wk-ring{position:absolute;inset:-7px;border-radius:50%;pointer-events:none}
.wk-small{width:clamp(56px,15vw,68px);height:clamp(56px,15vw,68px)}
.wk-power{width:clamp(62px,17vw,74px);height:clamp(62px,17vw,74px)}
.wk-power.ready{animation:wk-glow 1s ease-in-out infinite}
@keyframes wk-glow{50%{box-shadow:inset 0 0 0 3px #fff,0 0 30px 2px var(--pc)}}
/* messages */
.wk-big{position:absolute;left:0;right:0;top:24%;display:flex;flex-direction:column;align-items:center;pointer-events:none;z-index:8}
.wk-big b{font-family:var(--font-lilita),sans-serif;font-weight:400;font-size:clamp(46px,13vw,96px);line-height:1;-webkit-text-stroke:.07em #06142e;paint-order:stroke fill;text-shadow:0 .08em 0 #06142e;animation:wk-pop .45s cubic-bezier(.3,1.7,.5,1) both}
.wk-big span{margin-top:6px;font-weight:800;font-size:16px;padding:.35rem .9rem;border-radius:999px;background:rgba(6,20,46,.7)}
@keyframes wk-pop{from{transform:scale(.3);opacity:0}to{transform:none;opacity:1}}
.wk-toast{position:absolute;left:50%;top:calc(max(10px,env(safe-area-inset-top)) + 118px);transform:translateX(-50%);z-index:8;pointer-events:none;font-weight:900;font-size:15px;padding:.45rem 1rem;border-radius:999px;background:rgba(6,20,46,.78);border:2px solid var(--tc);max-width:92vw;text-align:center;line-height:1.25;animation:wk-pop .3s ease both}
.wk-count{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:8}
.wk-count b{font-family:var(--font-lilita),sans-serif;font-weight:400;font-size:clamp(110px,34vw,220px);-webkit-text-stroke:.06em #06142e;paint-order:stroke fill;text-shadow:0 .06em 0 #06142e;animation:wk-count 1s ease-out both}
@keyframes wk-count{0%{transform:scale(1.8);opacity:0}25%{transform:scale(1);opacity:1}100%{transform:scale(.8);opacity:.0}}
.wk-wrong{position:absolute;left:50%;top:40%;transform:translateX(-50%);font-family:var(--font-lilita),sans-serif;font-size:34px;color:#FF5A5F;-webkit-text-stroke:.06em #06142e;paint-order:stroke fill;animation:wk-blink .6s steps(2) infinite;pointer-events:none;z-index:8}
/* stage card (intro) */
.wk-card{position:absolute;left:50%;bottom:calc(11vh + 18px);transform:translateX(-50%);width:min(92vw,520px);padding:18px 20px;z-index:8;text-align:center;animation:wk-rise .6s cubic-bezier(.2,1.3,.4,1) both}
@keyframes wk-rise{from{transform:translate(-50%,40px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
.wk-skip{position:absolute;right:max(14px,env(safe-area-inset-right));top:calc(11vh + 10px);z-index:9}
/* sheets */
.wk-sheet{position:absolute;left:0;right:0;bottom:0;max-height:78%;display:flex;flex-direction:column;border-radius:28px 28px 0 0;z-index:20;padding:14px max(14px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));animation:wk-sheet .35s cubic-bezier(.2,1,.4,1) both}
@keyframes wk-sheet{from{transform:translateY(100%)}to{transform:none}}
.wk-scroll{overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch}
.wk-hscroll{display:flex;gap:10px;overflow-x:auto;overscroll-behavior:contain;touch-action:pan-x;scroll-snap-type:x mandatory;padding-bottom:6px}
.wk-hscroll > *{scroll-snap-align:center;flex:none}
.wk-tile{position:relative;aspect-ratio:1;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;font-size:18px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.16);cursor:pointer;color:#fff;font-family:inherit}
.wk-tile.cur{background:var(--acc);color:#06142e;border-color:#fff}
.wk-tile.locked{opacity:.4;cursor:default}
.wk-tile .st{display:flex;gap:1px;margin-top:2px}
.wk-stat{display:grid;grid-template-columns:74px 1fr;align-items:center;gap:8px;font-size:12.5px;font-weight:800}
.wk-stat .bar{height:8px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden}
.wk-stat .bar > div{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--acc),var(--acc2))}
.wk-modal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:25;padding:16px;background:rgba(3,8,20,.45)}
.wk-result{width:min(92vw,440px);padding:22px 20px 20px;text-align:center;animation:wk-pop .45s cubic-bezier(.3,1.5,.5,1) both}
.wk-stars{display:flex;justify-content:center;gap:6px;margin:6px 0 4px}
.wk-stars svg{width:52px;height:52px}
.wk-ringtimer{transition:stroke-dashoffset 1s linear}
@media (orientation:landscape) and (max-height:520px){
  .wk-logo .l1 span{font-size:clamp(38px,9vh,64px)}.wk-logo .l2 span{font-size:clamp(28px,7vh,48px)}
  .wk-place b{font-size:40px}
  .wk-steer{width:76px;height:76px}.wk-nitro{width:88px;height:88px}.wk-small{width:56px;height:56px}.wk-power{width:62px;height:62px}
  .wk-sheet{max-height:92%}
}
.wk-speed2{display:none;font-family:var(--font-lilita),sans-serif;font-size:24px;line-height:1;-webkit-text-stroke:.06em #06142e;paint-order:stroke fill;text-shadow:0 3px 0 #06142e}
.wk-speed2 small{font-size:11px;font-family:var(--font-fredoka),sans-serif;font-weight:800;letter-spacing:.12em;margin-left:4px;-webkit-text-stroke:0;opacity:.85}
@media (orientation:portrait){
  .wk-speed{display:none}
  .wk-speed2{display:block}
  .wk-big{top:30%}
}
@media (pointer:fine){
  .wk-steer{width:64px;height:64px}.wk-nitro{width:78px;height:78px}.wk-small{width:54px;height:54px}.wk-power{width:58px;height:58px}
}
`;
