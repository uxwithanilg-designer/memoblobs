// Tumble Truck's interface: a mobile delivery-app look — cream "delivery ticket" cards with perforated edges and a
// stamp, chunky tangerine buttons with real depth, solid navy capsules for the HUD (no blur needed, so phones stay
// smooth), a bold display font, the world's colour as the accent (--acc), safe areas on every edge, and big pedals for
// thumbs. On a computer the gas and brake pedals sit side by side in the bottom-right corner. Animations are
// transform / opacity only.
export const HAUL_CSS = `
.tt-root{position:absolute;inset:0;overflow:hidden;background:#0c1024;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:none}
.tt-root *{box-sizing:border-box}
.tt-stage{position:absolute;inset:0}
.tt-canvas{position:absolute;inset:0;display:block}
.tt-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.tt-ui{position:absolute;inset:0;pointer-events:none;z-index:5}
.tt-ui > *{pointer-events:auto}
.tt-cap{background:rgba(16,20,44,.78);border:1.5px solid rgba(255,255,255,.14);box-shadow:0 10px 26px -12px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.14)}
.tt-pill{display:inline-flex;align-items:center;gap:.4rem;border-radius:999px;padding:.3rem .75rem .3rem .38rem;font-weight:800;font-size:15px;line-height:1}
.tt-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:0;border-radius:22px;font-weight:800;cursor:pointer;color:#1c1430;
  background:linear-gradient(180deg,#FFFDF7 0%,#F1E7D6 100%);box-shadow:0 5px 0 #C9B48F,0 14px 22px -12px rgba(0,0,0,.6);transition:transform .12s ease,box-shadow .12s ease}
.tt-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #C9B48F,0 6px 14px -8px rgba(0,0,0,.6)}
.tt-btn:focus-visible{outline:3px solid var(--acc);outline-offset:3px}
.tt-cta{color:#fff;background:linear-gradient(180deg,#FFA24A 0%,#FF6A2C 55%,#F2471E 100%);box-shadow:0 6px 0 #A82E12,0 18px 30px -12px rgba(255,100,40,.8);text-shadow:0 2px 0 rgba(120,30,0,.45)}
.tt-cta:active{box-shadow:0 2px 0 #A82E12,0 8px 18px -8px rgba(255,100,40,.6)}
.tt-ghost{color:#fff;background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.26),0 4px 0 rgba(0,0,0,.28)}
.tt-ghost:active{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.26),0 0 0 rgba(0,0,0,.28)}
.tt-btn:disabled{opacity:.5;cursor:default}
.tt-shine::after{content:"";position:absolute;inset:3px 12% auto;height:40%;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0));pointer-events:none}
/* logo */
.tt-logo{display:flex;flex-direction:column;align-items:center;line-height:.84;filter:drop-shadow(0 12px 22px rgba(0,0,0,.5))}
.tt-logo span{display:inline-block;font-family:var(--font-lilita),sans-serif;color:var(--c);-webkit-text-stroke:.075em #1c1430;paint-order:stroke fill;text-shadow:0 .08em 0 #1c1430,0 .15em 0 rgba(0,0,0,.25)}
.tt-logo .tt-l1{font-size:clamp(44px,12.5vw,88px);animation:tt-drop .7s cubic-bezier(.3,1.6,.5,1) both,tt-tilt 3.4s ease-in-out .7s infinite}
.tt-logo .tt-l2{font-size:clamp(58px,17vw,118px);margin-top:.02em;animation:tt-drop .7s cubic-bezier(.3,1.6,.5,1) .12s both,tt-bounce 2.2s ease-in-out .9s infinite}
@keyframes tt-drop{0%{transform:translateY(-90%) scale(.6) rotate(-8deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes tt-tilt{50%{transform:rotate(-3deg) translateY(-3%)}}
@keyframes tt-bounce{0%,100%{transform:none}30%{transform:translateY(-6%) rotate(1.5deg)}45%{transform:translateY(1%) scaleY(.94)}60%{transform:none}}
.tt-tag{font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.9);text-shadow:0 2px 6px rgba(0,0,0,.55)}
/* home */
.tt-home{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:calc(var(--safe-top) + 4.4rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + 1.1rem) calc(var(--safe-left) + 1rem);
  background:linear-gradient(180deg,rgba(8,10,25,0) 38%,rgba(8,10,25,.6) 100%)}
/* the delivery ticket */
.tt-ticket{position:relative;width:min(420px,100%);border-radius:22px;padding:14px 16px 12px;color:#1c1430;background:linear-gradient(180deg,#FFF9EE,#F6EBD6);
  box-shadow:0 18px 40px -16px rgba(0,0,0,.7),inset 0 -3px 0 rgba(0,0,0,.06)}
.tt-ticket::before,.tt-ticket::after{content:"";position:absolute;top:56%;width:20px;height:20px;border-radius:50%;background:#10142c;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.tt-ticket::before{left:-10px}.tt-ticket::after{right:-10px}
.tt-perf{border-top:2px dashed rgba(28,20,48,.22);margin:10px -4px 8px}
.tt-kicker{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:99px;background:var(--acc);color:#14102a;font-weight:900;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase}
.tt-route{display:flex;align-items:center;gap:8px;font-weight:800;font-size:13.5px}
.tt-route i{flex:1;height:0;border-top:2.5px dotted rgba(28,20,48,.35)}
.tt-stamp{position:absolute;right:14px;bottom:12px;transform:rotate(-12deg);border:3px solid #E8423A;color:#E8423A;border-radius:10px;padding:2px 8px;font-family:var(--font-lilita),sans-serif;font-size:15px;letter-spacing:.06em;opacity:.85}
.tt-progress{height:9px;border-radius:99px;background:rgba(28,20,48,.12);overflow:hidden}
.tt-progress i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--acc),#FF6A2C)}
/* HUD */
.tt-hud{position:absolute;inset:0;pointer-events:none}
.tt-hud > *{transition:opacity .5s ease}
.tt-hud.tt-cine > *{opacity:0}
.tt-top{position:absolute;left:calc(var(--safe-left) + 10px);right:calc(var(--safe-right) + 66px);top:calc(var(--safe-top) + 8px);display:flex;flex-direction:column;gap:8px}
.tt-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;min-width:0}
.tt-chip{border-radius:16px;padding:6px 10px 6px 7px;display:flex;align-items:center;gap:8px}
.tt-badge{display:grid;place-items:center;min-width:34px;height:34px;padding:0 6px;border-radius:11px;background:linear-gradient(180deg,var(--acc),color-mix(in srgb,var(--acc) 55%,#000));font-family:var(--font-lilita),sans-serif;font-size:17px;box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}
.tt-track{position:relative;height:10px;border-radius:99px;background:rgba(255,255,255,.22);margin:4px 12px 2px 4px;box-shadow:inset 0 1px 2px rgba(0,0,0,.35),0 0 0 1.5px rgba(16,20,44,.45)}
.tt-track b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 65%,#fff),var(--acc))}
.tt-track s{position:absolute;top:-3px;width:4px;height:16px;border-radius:2px;background:#FFD23F;text-decoration:none;box-shadow:0 0 0 2px rgba(0,0,0,.3)}
.tt-track s.on{background:#3EE08F}
.tt-track em{position:absolute;top:50%;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.45);display:grid;place-items:center}
.tt-depot{position:absolute;right:-8px;top:-10px}
.tt-fuel{display:flex;align-items:center;gap:6px;border-radius:14px;padding:6px 9px 6px 7px;width:max-content;flex:none}
.tt-fuelbar{position:relative;width:clamp(80px,22vw,140px);height:12px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden}
.tt-fuelbar i{position:absolute;inset:0 auto 0 0;border-radius:99px;transition:width .2s linear,background .4s}
.tt-low{animation:tt-blink .6s steps(2) infinite}
@keyframes tt-blink{50%{opacity:.25}}
.tt-hearts{display:flex;gap:2px}
/* the load meter */
.tt-load{display:flex;align-items:center;gap:6px;border-radius:999px;padding:4px 10px 4px 6px;min-width:0}
.tt-load .tt-slots{display:flex;align-items:center;gap:3px}
.tt-load .tt-slots{flex-wrap:wrap;max-width:46vw}
.tt-load .tt-slot{position:relative;display:grid;place-items:center;width:22px;height:22px;border-radius:7px;background:rgba(255,255,255,.1);transition:transform .25s,opacity .25s}
.tt-load .tt-slot.gone{opacity:.35;filter:grayscale(1)}
.tt-load .tt-slot.gone::after{content:"";position:absolute;inset:4px 10px;border-radius:2px;background:#FF4F6D;transform:rotate(45deg)}
.tt-load .tt-need{width:3px;height:22px;border-radius:2px;background:#FFD23F;box-shadow:0 0 8px #FFD23F}
.tt-load.danger{box-shadow:0 0 0 2px #FF4F6D,0 10px 26px -12px rgba(0,0,0,.65);animation:tt-pulse .8s ease-in-out infinite}
@keyframes tt-pulse{50%{transform:scale(1.05)}}
.tt-powers{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 132px);display:flex;gap:8px}
.tt-power{position:relative;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(16,20,44,.78);box-shadow:0 6px 16px -6px rgba(0,0,0,.6)}
.tt-power svg.ring{position:absolute;inset:0;transform:rotate(-90deg)}
.tt-wind{position:absolute;right:calc(var(--safe-right) + 12px);top:calc(var(--safe-top) + 134px);display:flex;align-items:center;gap:6px;border-radius:999px;padding:6px 12px;font-weight:800;font-size:13px}
/* pedals */
.tt-pedals{position:absolute;inset:auto 0 0 0;height:min(44%,280px);display:flex;justify-content:space-between;align-items:flex-end;padding:0 calc(var(--safe-right) + 14px) calc(var(--safe-bottom) + 14px) calc(var(--safe-left) + 14px);pointer-events:none}
.tt-pedal{pointer-events:auto;position:relative;width:clamp(96px,27vw,128px);height:clamp(104px,29vw,138px);border-radius:30px;display:grid;place-items:center;
  background:linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,.07));border:2px solid rgba(255,255,255,.36);box-shadow:0 8px 0 rgba(0,0,0,.35),0 18px 30px -12px rgba(0,0,0,.6);transition:transform .08s,box-shadow .08s,background .12s}
.tt-pedal.on{transform:translateY(6px) scale(.96);box-shadow:0 2px 0 rgba(0,0,0,.35),0 8px 18px -10px rgba(0,0,0,.6)}
.tt-pedal.gas.on{background:linear-gradient(180deg,rgba(62,224,143,.7),rgba(62,224,143,.25))}
.tt-pedal.brake.on{background:linear-gradient(180deg,rgba(255,79,109,.65),rgba(255,79,109,.22))}
.tt-pedal small{position:absolute;bottom:9px;font-weight:900;font-size:11px;letter-spacing:.14em;opacity:.9}
.tt-zone{position:absolute;top:0;bottom:0;width:50%;pointer-events:auto}
@media (hover:hover) and (pointer:fine){.tt-pedals{justify-content:flex-end;gap:14px}.tt-pedal{width:clamp(84px,8.6vw,108px);height:clamp(92px,9.4vw,118px);border-radius:26px}}
.tt-keys{position:absolute;bottom:calc(var(--safe-bottom) + 14px);left:calc(var(--safe-left) + 14px);font-size:13px;font-weight:800;opacity:.85;white-space:nowrap;padding:7px 13px;border-radius:99px}
/* centre messages */
.tt-pop{position:absolute;left:0;right:0;top:27%;display:flex;flex-direction:column;align-items:center;text-align:center;pointer-events:none;padding:0 12px}
.tt-big{font-family:var(--font-lilita),sans-serif;font-size:clamp(40px,11.5vw,82px);line-height:.95;color:#fff;-webkit-text-stroke:.065em #1c1430;paint-order:stroke fill;text-shadow:0 .08em 0 #1c1430,0 .16em .3em rgba(0,0,0,.35)}
.tt-sub{margin-top:6px;font-weight:800;font-size:15px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7)}
.tt-intro{position:absolute;left:0;right:0;top:calc(var(--safe-top) + 15%);display:flex;justify-content:center;pointer-events:none;padding:0 14px}
.tt-intro .tt-ticket{width:min(360px,100%);padding:12px 16px 12px}
/* sheets */
.tt-sheet{position:absolute;inset:auto 0 0 0;max-height:88%;display:flex;flex-direction:column;border-radius:28px 28px 0 0;padding:14px calc(var(--safe-right) + 16px) calc(var(--safe-bottom) + 16px) calc(var(--safe-left) + 16px);background:linear-gradient(180deg,#232a56,#141832);box-shadow:0 -20px 50px -10px rgba(0,0,0,.6);z-index:20}
@media (min-width:760px){.tt-sheet{width:min(720px,94vw);margin:0 auto}}
.tt-sheet .tt-grab{width:46px;height:5px;border-radius:9px;background:rgba(255,255,255,.25);margin:0 auto 12px}
.tt-scroll{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;margin:0 -4px;padding:0 4px 4px}
.tt-scroll::-webkit-scrollbar{display:none}
.tt-veil{position:absolute;inset:0;background:rgba(5,6,16,.55);z-index:19}
.tt-trucks{display:grid;grid-auto-flow:column;grid-auto-columns:min(72%,250px);gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;scrollbar-width:none}
.tt-trucks::-webkit-scrollbar{display:none}
.tt-truck{scroll-snap-align:center;border-radius:22px;padding:10px;background:rgba(255,255,255,.07);border:2px solid transparent;text-align:left;color:#fff;cursor:pointer}
.tt-truck.sel{border-color:var(--acc);background:rgba(255,255,255,.12)}
.tt-truck canvas{display:block;width:100%;height:120px;border-radius:14px;background:radial-gradient(120% 90% at 50% 100%,rgba(255,255,255,.2),rgba(255,255,255,0))}
.tt-up{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:16px;background:rgba(255,255,255,.06);margin-top:8px}
.tt-dots{display:flex;gap:3px;margin-top:4px}
.tt-dots i{width:11px;height:6px;border-radius:3px;background:rgba(255,255,255,.18)}
.tt-dots i.on{background:var(--acc);box-shadow:0 0 8px var(--acc)}
.tt-worlds{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px}
.tt-world{position:relative;border-radius:20px;overflow:hidden;aspect-ratio:16/11;background:#222;box-shadow:0 10px 22px -12px rgba(0,0,0,.7)}
.tt-world canvas{position:absolute;inset:0;width:100%;height:100%}
.tt-world .tt-wl{position:absolute;inset:auto 0 0 0;padding:8px 10px;background:linear-gradient(0deg,rgba(0,0,0,.78),rgba(0,0,0,0));font-weight:800;font-size:14px}
.tt-world .tt-wc{position:absolute;right:8px;top:8px;display:grid;place-items:center;width:34px;height:34px;border-radius:12px;background:rgba(255,249,238,.92)}
.tt-world.lock{filter:grayscale(.85) brightness(.6)}
.tt-world.now{outline:3px solid var(--acc);outline-offset:-3px}
/* results */
.tt-result-wrap{position:absolute;inset:0;display:grid;place-items:center;padding:calc(var(--safe-top) + 12px) 14px calc(var(--safe-bottom) + 12px);z-index:15;pointer-events:none}
.tt-result{position:relative;pointer-events:auto;width:min(380px,100%);max-height:100%;overflow-y:auto;text-align:center}
.tt-stars{display:flex;justify-content:center;gap:6px;margin:6px 0 4px}
.tt-star{width:clamp(46px,13vw,62px);height:clamp(46px,13vw,62px);filter:drop-shadow(0 4px 0 rgba(28,20,48,.35))}
.tt-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
.tt-stats div{border-radius:16px;padding:8px 4px;background:rgba(28,20,48,.07)}
.tt-stats b{display:block;font-family:var(--font-lilita),sans-serif;font-size:21px}
.tt-stats span{font-size:10.5px;font-weight:800;opacity:.65;text-transform:uppercase;letter-spacing:.08em}
.tt-next{display:flex;align-items:center;gap:12px;border-radius:16px;background:#1c1430;color:#fff;padding:10px 12px;text-align:left}
.tt-count{position:relative;width:44px;height:44px;flex:none}
.tt-count svg{position:absolute;inset:0;transform:rotate(-90deg)}
.tt-count b{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-lilita),sans-serif;font-size:19px}
.tt-toast{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 186px);padding:8px 16px;border-radius:99px;font-weight:800;white-space:nowrap;z-index:12;pointer-events:none}
@media (max-height:600px){.tt-result .tt-ticket{padding:10px 14px}.tt-result .tt-big{font-size:clamp(28px,8vh,40px)!important}.tt-result .tt-stats{margin:6px 0;gap:6px}.tt-result .tt-stats div{padding:5px 4px}.tt-result .tt-stats b{font-size:17px}.tt-star{width:40px;height:40px}.tt-result .tt-cta{padding-top:.5rem;padding-bottom:.5rem}}
@media (orientation:landscape) and (max-height:500px){
  .tt-home{padding:calc(var(--safe-top) + 3.5rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + .7rem) calc(var(--safe-left) + 1rem);flex-direction:row;align-items:center;justify-content:center;gap:clamp(16px,4vw,48px)}
  .tt-home > div:first-child{flex:none}
  .tt-home > div:last-child{width:min(420px,56vw);gap:8px}
  .tt-home .tt-ticket{padding:10px 14px 9px}
  .tt-home .tt-ticket .tt-short-hide{display:none}
  .tt-home .tt-perf{margin:6px -4px 6px}
  .tt-home .tt-cta{padding-top:.6rem;padding-bottom:.6rem;font-size:1.25rem}
  .tt-home .tt-ghost{padding-top:.5rem;padding-bottom:.5rem}
  .tt-logo .tt-l1{font-size:clamp(30px,8vh,52px)}.tt-logo .tt-l2{font-size:clamp(40px,11vh,70px)}
  .tt-tag{font-size:11px;letter-spacing:.14em}
  .tt-pedals{height:62%}
  .tt-pedal{width:clamp(86px,20vh,118px);height:clamp(92px,22vh,124px)}
  .tt-top{flex-direction:row;flex-wrap:wrap;align-items:flex-start}
  .tt-top .tt-track{order:1;flex:1 1 200px;margin-top:14px}
  .tt-top > .tt-row:last-child{order:2;flex:1 1 100%}
  .tt-powers{top:calc(var(--safe-top) + 104px)}
  .tt-wind{top:calc(var(--safe-top) + 104px)}
  .tt-toast{top:calc(var(--safe-top) + 112px)}
  .tt-intro{top:calc(var(--safe-top) + 10%)}
}
`;
