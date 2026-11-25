// Peak Rover's interface: a phone-game look — chunky clay buttons with depth, solid tinted glass panels (no blur needed,
// so phones stay smooth), a bold display font, colours that follow the world (--acc), safe areas on every edge, and big
// pedals for thumbs. Animations are transform/opacity only.
export const ROVER_CSS = `
.rv-root{position:absolute;inset:0;overflow:hidden;background:#0b0d1a;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:none}
.rv-root *{box-sizing:border-box}
.rv-stage{position:absolute;inset:0}
.rv-canvas{position:absolute;inset:0;display:block}
.rv-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.rv-ui{position:absolute;inset:0;pointer-events:none;z-index:5}
.rv-ui > *{pointer-events:auto}
.rv-glass{background:rgba(14,16,36,.62);border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 30px -12px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.12)}
.rv-pill{display:inline-flex;align-items:center;gap:.4rem;border-radius:999px;padding:.32rem .7rem .32rem .4rem;font-weight:800;font-size:15px;line-height:1}
.rv-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:0;border-radius:20px;font-weight:800;cursor:pointer;color:#1b1430;
  background:linear-gradient(180deg,#fff 0%,#e9e6f6 100%);box-shadow:0 5px 0 #b9b2d6,0 12px 22px -10px rgba(0,0,0,.6);transition:transform .12s ease,box-shadow .12s ease}
.rv-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #b9b2d6,0 6px 14px -8px rgba(0,0,0,.6)}
.rv-cta{color:#2a1300;background:linear-gradient(180deg,#FFE27A 0%,#FFB627 55%,#FF9A1F 100%);box-shadow:0 6px 0 #C46A0E,0 16px 30px -10px rgba(255,150,30,.75)}
.rv-cta:active{box-shadow:0 2px 0 #C46A0E,0 8px 18px -8px rgba(255,150,30,.6)}
.rv-ghost{color:#fff;background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.25),0 4px 0 rgba(0,0,0,.25)}
.rv-ghost:active{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.25),0 0 0 rgba(0,0,0,.25)}
.rv-shine::after{content:"";position:absolute;inset:3px 12% auto;height:38%;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.65),rgba(255,255,255,0));pointer-events:none}
/* title */
.rv-logo{display:flex;flex-direction:column;align-items:center;line-height:.86;filter:drop-shadow(0 10px 24px rgba(0,0,0,.45))}
.rv-logo span{display:inline-block;font-family:var(--font-lilita),sans-serif;color:var(--c);-webkit-text-stroke:.07em #1b1430;paint-order:stroke fill;text-shadow:0 .07em 0 #1b1430,0 .13em 0 rgba(0,0,0,.25);animation:rv-drop .7s cubic-bezier(.3,1.6,.5,1) both,rv-bob 3.2s ease-in-out infinite}
.rv-logo .rv-l1{font-size:clamp(46px,13vw,92px)}.rv-logo .rv-l2{font-size:clamp(56px,16vw,112px);margin-top:.02em}
@keyframes rv-drop{0%{transform:translateY(-80%) scale(.6) rotate(-6deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes rv-bob{50%{transform:translateY(-4%) rotate(-1.5deg)}}
.rv-tag{font-weight:700;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.85);text-shadow:0 2px 6px rgba(0,0,0,.5)}
/* home */
.rv-home{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:calc(var(--safe-top) + 4.6rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + 1.2rem) calc(var(--safe-left) + 1rem);
  background:linear-gradient(180deg,rgba(8,10,25,.0) 40%,rgba(8,10,25,.55) 100%)}
.rv-card{width:min(420px,100%);border-radius:26px;padding:14px}
.rv-progress{height:9px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden}
.rv-progress i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--acc),#fff);box-shadow:0 0 12px var(--acc)}
/* HUD */
.rv-hud{position:absolute;inset:0;pointer-events:none}
.rv-top{position:absolute;left:calc(var(--safe-left) + 10px);right:calc(var(--safe-right) + 66px);top:calc(var(--safe-top) + 8px);display:flex;align-items:flex-start;gap:8px}
.rv-stagechip{border-radius:16px;padding:6px 10px 6px 8px;display:flex;align-items:center;gap:8px}
.rv-badge{display:grid;place-items:center;min-width:34px;height:34px;padding:0 6px;border-radius:11px;background:linear-gradient(180deg,var(--acc),color-mix(in srgb,var(--acc) 60%,#000));font-family:var(--font-lilita),sans-serif;font-size:17px;box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}
.rv-track{position:relative;height:10px;border-radius:99px;background:rgba(255,255,255,.16);margin-top:5px}
.rv-track b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 70%,#fff),var(--acc))}
.rv-track s{position:absolute;top:-3px;width:4px;height:16px;border-radius:2px;background:#FFD23F;text-decoration:none;box-shadow:0 0 0 2px rgba(0,0,0,.3)}
.rv-track s.on{background:#3EE08F}
.rv-track em{position:absolute;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.45);display:grid;place-items:center;font-style:normal;font-size:12px}
.rv-flag{position:absolute;right:-6px;top:-9px;font-size:16px}
.rv-fuel{display:flex;align-items:center;gap:6px;border-radius:14px;padding:5px 9px 5px 6px;margin-top:6px;width:max-content}
.rv-fuelbar{position:relative;width:clamp(86px,24vw,150px);height:12px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden}
.rv-fuelbar i{position:absolute;inset:0 auto 0 0;border-radius:99px;transition:width .2s linear,background .4s}
.rv-low{animation:rv-blink .6s steps(2) infinite}
@keyframes rv-blink{50%{opacity:.25}}
.rv-hearts{display:flex;gap:2px}
.rv-hearts span{font-size:17px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));transition:transform .3s}
.rv-hearts span.off{opacity:.28;filter:grayscale(1)}
.rv-powers{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 74px);display:flex;gap:8px}
.rv-power{position:relative;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(14,16,36,.7);box-shadow:0 6px 16px -6px rgba(0,0,0,.6)}
.rv-power svg.ring{position:absolute;inset:0;transform:rotate(-90deg)}
/* pedals */
.rv-pedals{position:absolute;inset:auto 0 0 0;height:min(44%,280px);display:flex;justify-content:space-between;align-items:flex-end;padding:0 calc(var(--safe-right) + 14px) calc(var(--safe-bottom) + 14px) calc(var(--safe-left) + 14px);pointer-events:none}
.rv-pedal{pointer-events:auto;position:relative;width:clamp(96px,27vw,128px);height:clamp(96px,27vw,128px);border-radius:32px;display:grid;place-items:center;
  background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.07));border:2px solid rgba(255,255,255,.35);box-shadow:0 8px 0 rgba(0,0,0,.35),0 18px 30px -12px rgba(0,0,0,.6);transition:transform .08s,box-shadow .08s,background .12s}
.rv-pedal.on{transform:translateY(6px) scale(.96);box-shadow:0 2px 0 rgba(0,0,0,.35),0 8px 18px -10px rgba(0,0,0,.6)}
.rv-pedal.gas.on{background:linear-gradient(180deg,rgba(62,224,143,.65),rgba(62,224,143,.25))}
.rv-pedal.brake.on{background:linear-gradient(180deg,rgba(255,79,122,.6),rgba(255,79,122,.22))}
.rv-pedal small{position:absolute;bottom:9px;font-weight:800;font-size:11px;letter-spacing:.12em;opacity:.85}
.rv-zone{position:absolute;top:0;bottom:0;width:50%;pointer-events:auto}
/* web (mouse and keyboard): brake and gas side by side in the bottom-right corner, a little smaller */
@media (hover:hover) and (pointer:fine){.rv-pedals{justify-content:flex-end;gap:14px}.rv-pedal{width:clamp(84px,9vw,108px);height:clamp(84px,9vw,108px);border-radius:28px}}
.rv-keys{position:absolute;bottom:calc(var(--safe-bottom) + 12px);left:50%;transform:translateX(-50%);font-size:13px;font-weight:700;opacity:.8;white-space:nowrap;padding:6px 12px;border-radius:99px}
/* centre messages */
.rv-pop{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;white-space:nowrap}
.rv-big{font-family:var(--font-lilita),sans-serif;font-size:clamp(40px,12vw,84px);line-height:.95;color:#fff;-webkit-text-stroke:.06em #1b1430;paint-order:stroke fill;text-shadow:0 .08em 0 #1b1430,0 .16em .3em rgba(0,0,0,.35)}
.rv-mid{font-family:var(--font-lilita),sans-serif;font-size:clamp(26px,7vw,44px);color:#fff;-webkit-text-stroke:.07em #1b1430;paint-order:stroke fill;text-shadow:0 .08em 0 #1b1430}
.rv-sub{margin-top:6px;font-weight:800;font-size:15px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)}
.rv-intro{position:absolute;left:0;right:0;top:calc(var(--safe-top) + 18%);text-align:center;pointer-events:none}
.rv-intro .rv-kicker{display:inline-block;padding:5px 14px;border-radius:99px;background:var(--acc);color:#14102a;font-weight:900;font-size:13px;letter-spacing:.14em;text-transform:uppercase;box-shadow:0 8px 20px -8px var(--acc)}
/* sheets */
.rv-sheet{position:absolute;inset:auto 0 0 0;max-height:88%;display:flex;flex-direction:column;border-radius:28px 28px 0 0;padding:16px calc(var(--safe-right) + 16px) calc(var(--safe-bottom) + 16px) calc(var(--safe-left) + 16px);background:linear-gradient(180deg,#22264a,#14162e);box-shadow:0 -20px 50px -10px rgba(0,0,0,.6);z-index:20}
.rv-sheet .rv-grab{width:46px;height:5px;border-radius:9px;background:rgba(255,255,255,.25);margin:0 auto 12px}
.rv-scroll{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;margin:0 -4px;padding:0 4px}
.rv-scroll::-webkit-scrollbar{display:none}
.rv-veil{position:absolute;inset:0;background:rgba(5,6,16,.55);z-index:19}
.rv-cars{display:grid;grid-auto-flow:column;grid-auto-columns:min(70%,240px);gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;scrollbar-width:none}
.rv-cars::-webkit-scrollbar{display:none}
.rv-car{scroll-snap-align:center;border-radius:22px;padding:10px;background:rgba(255,255,255,.07);border:2px solid transparent;text-align:left;color:#fff;cursor:pointer}
.rv-car.sel{border-color:var(--acc);background:rgba(255,255,255,.12)}
.rv-car canvas{display:block;width:100%;height:110px;border-radius:14px;background:radial-gradient(120% 90% at 50% 100%,rgba(255,255,255,.18),rgba(255,255,255,0))}
.rv-up{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:16px;background:rgba(255,255,255,.06);margin-top:8px}
.rv-dots{display:flex;gap:3px;margin-top:4px}
.rv-dots i{width:11px;height:6px;border-radius:3px;background:rgba(255,255,255,.18)}
.rv-dots i.on{background:var(--acc);box-shadow:0 0 8px var(--acc)}
.rv-worlds{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px}
.rv-world{position:relative;border-radius:20px;overflow:hidden;aspect-ratio:16/11;background:#222;box-shadow:0 10px 22px -12px rgba(0,0,0,.7)}
.rv-world canvas{position:absolute;inset:0;width:100%;height:100%}
.rv-world .rv-wl{position:absolute;inset:auto 0 0 0;padding:8px 10px;background:linear-gradient(0deg,rgba(0,0,0,.75),rgba(0,0,0,0));font-weight:800;font-size:14px}
.rv-world.lock{filter:grayscale(.85) brightness(.6)}
.rv-world.now{outline:3px solid var(--acc);outline-offset:-3px}
/* results */
.rv-result-wrap{position:absolute;inset:0;display:grid;place-items:center;padding:calc(var(--safe-top) + 12px) 14px calc(var(--safe-bottom) + 12px);z-index:15;pointer-events:none}
.rv-result{position:relative;pointer-events:auto;width:min(380px,100%);max-height:100%;overflow-y:auto;border-radius:30px;padding:20px 18px 16px;text-align:center}
/* a short game window (the player inside a web page, a phone on its side): a tighter card that still fits */
@media (max-height:600px){.rv-result{padding:12px 14px 12px;border-radius:24px}.rv-result .rv-big{font-size:clamp(28px,8vh,40px)!important}.rv-result .rv-stats{margin:8px 0;gap:6px}.rv-result .rv-stats div{padding:5px 4px}.rv-result .rv-stats b{font-size:18px}.rv-result .rv-cta{padding-top:.5rem;padding-bottom:.5rem}}
.rv-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
.rv-stats div{border-radius:16px;padding:9px 4px;background:rgba(255,255,255,.08)}
.rv-stats b{display:block;font-family:var(--font-lilita),sans-serif;font-size:22px}
.rv-stats span{font-size:11px;font-weight:700;opacity:.75;text-transform:uppercase;letter-spacing:.08em}
.rv-count{position:relative;width:44px;height:44px;flex:none}
.rv-count svg{position:absolute;inset:0;transform:rotate(-90deg)}
.rv-count b{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-lilita),sans-serif;font-size:19px}
.rv-toast{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 120px);padding:8px 16px;border-radius:99px;font-weight:800;white-space:nowrap;z-index:12;pointer-events:none}
@media (orientation:landscape) and (max-height:500px){
  .rv-home{padding-top:calc(var(--safe-top) + 3.6rem)}
  .rv-logo .rv-l1{font-size:clamp(34px,8vh,60px)}.rv-logo .rv-l2{font-size:clamp(42px,11vh,76px)}
  .rv-pedals{height:62%}
  .rv-pedal{width:clamp(86px,20vh,118px);height:clamp(86px,20vh,118px)}
  .rv-powers{top:calc(var(--safe-top) + 62px)}
}
`;
