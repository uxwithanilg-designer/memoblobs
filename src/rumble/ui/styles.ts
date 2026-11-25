// Rumble Rally's interface: a 2026 motorsport-arcade look — slanted race panels with checkered trims, solid dark
// capsules with a neon edge in the world's colour (no blur needed, so phones stay smooth), a huge italic position
// badge, start lights, chunky slanted buttons with real depth, a podium card, safe areas on every edge and big thumb
// controls: brake and rocket for the left thumb, gas and nitro for the right. On a computer the pedals sit side by
// side in the bottom-right corner with the nitro and rocket buttons above them. Animations are transform / opacity.
export const RUMBLE_CSS = `
.rr-root{position:absolute;inset:0;overflow:hidden;background:#090b1c;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:none}
.rr-root *{box-sizing:border-box}
.rr-stage{position:absolute;inset:0}
.rr-canvas{position:absolute;inset:0;display:block}
.rr-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.rr-it{font-style:italic}
.rr-ui{position:absolute;inset:0;pointer-events:none;z-index:5}
.rr-ui > *{pointer-events:auto}
.rr-cap{background:rgba(10,12,30,.82);border:1.5px solid rgba(255,255,255,.12);box-shadow:0 10px 26px -12px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.12)}
.rr-edge{box-shadow:0 0 0 1.5px color-mix(in srgb,var(--acc) 70%,transparent),0 10px 26px -12px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.12)}
.rr-pill{display:inline-flex;align-items:center;gap:.4rem;border-radius:999px;padding:.3rem .75rem .3rem .38rem;font-weight:800;font-size:15px;line-height:1}
.rr-check{background-image:linear-gradient(45deg,#fff 25%,transparent 25%,transparent 75%,#fff 75%),linear-gradient(45deg,#fff 25%,#15161e 25%,#15161e 75%,#fff 75%);background-size:10px 10px;background-position:0 0,5px 5px}
/* buttons: slanted, chunky */
.rr-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:0;border-radius:16px;font-weight:800;cursor:pointer;color:#14102a;transform:skewX(-8deg);
  background:linear-gradient(180deg,#FFFFFF 0%,#E6E9F4 100%);box-shadow:0 5px 0 #9AA2BC,0 14px 22px -12px rgba(0,0,0,.6);transition:transform .12s ease,box-shadow .12s ease}
.rr-btn > *{transform:skewX(8deg)}
.rr-btn:active{transform:skewX(-8deg) translateY(4px);box-shadow:0 1px 0 #9AA2BC,0 6px 14px -8px rgba(0,0,0,.6)}
.rr-btn:focus-visible{outline:3px solid var(--acc);outline-offset:3px}
.rr-cta{color:#fff;background:linear-gradient(180deg,#FF5A7A 0%,#F2264E 55%,#C8123A 100%);box-shadow:0 6px 0 #7A0A22,0 18px 30px -12px rgba(242,38,78,.85);text-shadow:0 2px 0 rgba(90,0,20,.5)}
.rr-cta:active{box-shadow:0 2px 0 #7A0A22,0 8px 18px -8px rgba(242,38,78,.6)}
.rr-ghost{color:#fff;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.24),0 4px 0 rgba(0,0,0,.3)}
.rr-ghost:active{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.24),0 0 0 rgba(0,0,0,.3)}
.rr-btn:disabled{opacity:.5;cursor:default}
.rr-shine::after{content:"";position:absolute;inset:3px 12% auto;height:40%;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,0));pointer-events:none}
/* logo */
.rr-logo{display:flex;flex-direction:column;align-items:center;line-height:.82;filter:drop-shadow(0 12px 22px rgba(0,0,0,.55));transform:skewX(-9deg)}
.rr-logo span{display:inline-block;font-family:var(--font-lilita),sans-serif;color:var(--c);-webkit-text-stroke:.07em #0d0a1e;paint-order:stroke fill;text-shadow:0 .08em 0 #0d0a1e,.06em .14em 0 rgba(0,0,0,.3)}
.rr-logo .rr-l1{font-size:clamp(50px,14vw,96px);animation:rr-in .65s cubic-bezier(.3,1.5,.5,1) both}
.rr-logo .rr-l2{font-size:clamp(50px,14vw,96px);margin-top:.02em;animation:rr-in .65s cubic-bezier(.3,1.5,.5,1) .12s both,rr-rev 1.8s ease-in-out 1s infinite}
.rr-logo .rr-bar{display:block;width:72%;height:clamp(8px,2.2vw,14px);margin-top:.35em;border-radius:3px;box-shadow:0 0 0 2px #0d0a1e;animation:rr-in .65s cubic-bezier(.3,1.5,.5,1) .24s both}
@keyframes rr-in{0%{transform:translateX(-60%) scale(.7);opacity:0}100%{transform:none;opacity:1}}
@keyframes rr-rev{0%,100%{transform:none}20%{transform:translateX(2%) rotate(-1deg)}35%{transform:translateX(-1%)}}
.rr-tag{font-weight:800;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.92);text-shadow:0 2px 6px rgba(0,0,0,.6)}
/* home */
.rr-home{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:calc(var(--safe-top) + 4.2rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + 1.1rem) calc(var(--safe-left) + 1rem);
  background:linear-gradient(180deg,rgba(6,8,22,0) 36%,rgba(6,8,22,.66) 100%)}
/* the race card */
.rr-card{position:relative;width:min(420px,100%);border-radius:20px;padding:13px 15px 12px;color:#fff;background:linear-gradient(160deg,#1f2550 0%,#121633 70%);overflow:hidden;
  box-shadow:0 0 0 1.5px color-mix(in srgb,var(--acc) 55%,transparent),0 18px 40px -16px rgba(0,0,0,.75)}
.rr-card::before{content:"";position:absolute;right:-30px;top:-30px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--acc) 40%,transparent),transparent 70%)}
.rr-card .rr-strip{position:absolute;left:0;right:0;bottom:0;height:6px;opacity:.9}
.rr-kicker{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:6px;transform:skewX(-10deg);background:var(--acc);color:#0f0c22;font-weight:900;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase}
.rr-kicker > *{transform:skewX(10deg)}
.rr-rivals{display:flex;gap:6px;margin-top:8px}
.rr-rival{display:flex;align-items:center;gap:6px;min-width:0;flex:1;border-radius:12px;padding:5px 7px 5px 5px;background:rgba(255,255,255,.07)}
.rr-rival p{font-size:11.5px;font-weight:800;line-height:1.1;min-width:0}
.rr-progress{height:8px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}
.rr-progress i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--acc),#FF3D6E)}
/* HUD */
.rr-hud{position:absolute;inset:0;pointer-events:none}
.rr-hud > *{transition:opacity .45s ease}
.rr-hud.rr-cine > *:not(.rr-keep){opacity:0}
.rr-top{position:absolute;left:calc(var(--safe-left) + 10px);right:calc(var(--safe-right) + 64px);top:calc(var(--safe-top) + 8px);display:flex;flex-direction:column;gap:7px}
.rr-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;min-width:0}
.rr-pos{display:flex;align-items:flex-end;gap:2px;padding:4px 14px 4px 10px;border-radius:12px;transform:skewX(-10deg);background:linear-gradient(180deg,var(--pc),color-mix(in srgb,var(--pc) 55%,#000));box-shadow:0 6px 0 rgba(0,0,0,.35),0 12px 22px -10px rgba(0,0,0,.6)}
.rr-pos > *{transform:skewX(10deg)}
.rr-pos b{font-family:var(--font-lilita),sans-serif;font-size:44px;line-height:.9;-webkit-text-stroke:.06em #0d0a1e;paint-order:stroke fill;text-shadow:0 3px 0 #0d0a1e}
.rr-pos sup{font-family:var(--font-lilita),sans-serif;font-size:18px;margin-bottom:22px;-webkit-text-stroke:.06em #0d0a1e;paint-order:stroke fill}
.rr-pos small{font-weight:900;font-size:13px;margin-bottom:6px;opacity:.85}
.rr-pos.pop{animation:rr-pop .45s cubic-bezier(.3,1.8,.5,1)}
@keyframes rr-pop{0%{transform:skewX(-10deg) scale(1.35)}100%{transform:skewX(-10deg) scale(1)}}
.rr-board{display:flex;flex-direction:column;gap:2px;border-radius:12px;padding:5px 7px;min-width:118px}
.rr-board div{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;line-height:1.25;white-space:nowrap}
.rr-board div i{width:4px;height:12px;border-radius:2px;flex:none}
.rr-board div em{font-style:normal;width:12px;opacity:.7}
.rr-board div.you{color:#FFD23F}
.rr-board div.down{opacity:.45}
.rr-track{position:relative;height:9px;border-radius:99px;background:rgba(255,255,255,.2);margin:6px 26px 4px 4px;box-shadow:inset 0 1px 2px rgba(0,0,0,.35),0 0 0 1.5px rgba(10,12,30,.5)}
.rr-track b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 60%,#fff),var(--acc))}
.rr-track s{position:absolute;top:-2px;width:3px;height:13px;border-radius:2px;background:rgba(255,255,255,.55);text-decoration:none}
.rr-track s.on{background:#3EE08F}
.rr-track em{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:2px solid #0d0a1e;transition:left .1s linear}
.rr-track em.you{width:22px;height:22px;margin:-11px 0 0 -11px;background:#FF6A2C;display:grid;place-items:center;z-index:2;box-shadow:0 2px 8px rgba(0,0,0,.5)}
.rr-track .rr-flag{position:absolute;right:-24px;top:-8px;width:20px;height:16px;border-radius:3px;box-shadow:0 0 0 2px #0d0a1e}
.rr-fuel{display:flex;align-items:center;gap:6px;border-radius:12px;padding:5px 9px 5px 7px;width:max-content;flex:none}
.rr-fuelbar{position:relative;width:clamp(70px,20vw,130px);height:10px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden}
.rr-fuelbar i{position:absolute;inset:0 auto 0 0;border-radius:99px;transition:width .2s linear,background .4s}
.rr-low{animation:rr-blink .6s steps(2) infinite}
@keyframes rr-blink{50%{opacity:.25}}
.rr-hearts{display:flex;gap:2px}
.rr-powers{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 150px);display:flex;gap:8px}
.rr-power{position:relative;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:rgba(10,12,30,.82);box-shadow:0 6px 16px -6px rgba(0,0,0,.6)}
.rr-power svg.ring{position:absolute;inset:0;transform:rotate(-90deg)}
.rr-wind{position:absolute;right:calc(var(--safe-right) + 12px);top:calc(var(--safe-top) + 150px);display:flex;align-items:center;gap:6px;border-radius:999px;padding:6px 12px;font-weight:800;font-size:13px}
/* thumb controls */
.rr-pads{position:absolute;inset:auto 0 0 0;display:flex;justify-content:space-between;align-items:flex-end;padding:0 calc(var(--safe-right) + 12px) calc(var(--safe-bottom) + 12px) calc(var(--safe-left) + 12px);pointer-events:none}
.rr-side{display:flex;flex-direction:column;align-items:center;gap:12px}
.rr-side.right{align-items:center}
.rr-pedal{pointer-events:auto;position:relative;width:clamp(92px,26vw,124px);height:clamp(100px,28vw,134px);border-radius:26px;display:grid;place-items:center;transform:skewX(-6deg);
  background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.06));border:2px solid rgba(255,255,255,.34);box-shadow:0 8px 0 rgba(0,0,0,.38),0 18px 30px -12px rgba(0,0,0,.6);transition:transform .08s,box-shadow .08s,background .12s}
.rr-pedal > *{transform:skewX(6deg)}
.rr-pedal.on{transform:skewX(-6deg) translateY(6px) scale(.96);box-shadow:0 2px 0 rgba(0,0,0,.38),0 8px 18px -10px rgba(0,0,0,.6)}
.rr-pedal.gas.on{background:linear-gradient(180deg,rgba(62,224,143,.72),rgba(62,224,143,.24))}
.rr-pedal.brake.on{background:linear-gradient(180deg,rgba(255,79,109,.66),rgba(255,79,109,.22))}
.rr-pedal small{position:absolute;bottom:9px;font-weight:900;font-size:11px;letter-spacing:.14em;opacity:.9}
.rr-act{pointer-events:auto;position:relative;width:clamp(68px,19vw,84px);height:clamp(68px,19vw,84px);border-radius:50%;display:grid;place-items:center;border:0;cursor:pointer;color:#fff;
  background:radial-gradient(circle at 50% 35%,var(--b1),var(--b2));box-shadow:0 6px 0 rgba(0,0,0,.38),0 14px 24px -10px var(--b2),inset 0 2px 0 rgba(255,255,255,.35);transition:transform .08s,box-shadow .08s,opacity .2s}
.rr-act.on,.rr-act:active{transform:translateY(5px) scale(.95);box-shadow:0 1px 0 rgba(0,0,0,.38),0 6px 14px -8px var(--b2),inset 0 2px 0 rgba(255,255,255,.35)}
.rr-act.off{opacity:.45;filter:grayscale(.6)}
.rr-act svg.ring{position:absolute;inset:-5px;width:calc(100% + 10px);height:calc(100% + 10px);transform:rotate(-90deg)}
.rr-act small{position:absolute;bottom:-17px;font-weight:900;font-size:10.5px;letter-spacing:.12em;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.rr-act .rr-ammo{position:absolute;top:-6px;right:-6px;min-width:24px;height:24px;padding:0 5px;border-radius:99px;display:grid;place-items:center;background:#0d0a1e;border:2px solid #fff;font-family:var(--font-lilita),sans-serif;font-size:14px}
.rr-act.burn{animation:rr-burn .25s ease-in-out infinite alternate}
@keyframes rr-burn{to{box-shadow:0 1px 0 rgba(0,0,0,.38),0 0 26px 6px rgba(90,232,255,.7),inset 0 2px 0 rgba(255,255,255,.35)}}
.rr-zone{position:absolute;top:0;bottom:0;width:50%;pointer-events:auto}
@media (hover:hover) and (pointer:fine){
  .rr-pads{justify-content:flex-end;gap:14px}
  .rr-side{flex-direction:column}
  .rr-pedal{width:clamp(82px,8.4vw,106px);height:clamp(90px,9.2vw,116px);border-radius:24px}
  .rr-act{width:clamp(62px,6vw,76px);height:clamp(62px,6vw,76px)}
}
.rr-keys{position:absolute;bottom:calc(var(--safe-bottom) + 14px);left:calc(var(--safe-left) + 14px);font-size:13px;font-weight:800;opacity:.88;white-space:nowrap;padding:7px 13px;border-radius:99px}
/* start lights and centre messages */
.rr-lights{position:absolute;left:0;right:0;margin:0 auto;width:max-content;top:calc(var(--safe-top) + 18%);display:flex;gap:clamp(6px,2vw,12px);padding:10px 14px;border-radius:18px;background:#0d0e18;box-shadow:0 0 0 2px rgba(255,255,255,.12),0 18px 36px -12px rgba(0,0,0,.8)}
.rr-lights i{width:clamp(30px,9vw,46px);height:clamp(30px,9vw,46px);border-radius:50%;background:#2a1c24;box-shadow:inset 0 3px 6px rgba(0,0,0,.6);transition:background .08s,box-shadow .08s}
.rr-lights i.red{background:radial-gradient(circle at 40% 35%,#FF8A8A,#FF1F3A 60%);box-shadow:0 0 22px 4px rgba(255,40,60,.7),inset 0 -3px 6px rgba(0,0,0,.3)}
.rr-lights i.green{background:radial-gradient(circle at 40% 35%,#B8FFD8,#22D878 60%);box-shadow:0 0 22px 4px rgba(40,230,120,.7),inset 0 -3px 6px rgba(0,0,0,.3)}
.rr-pop{position:absolute;left:0;right:0;top:30%;display:flex;flex-direction:column;align-items:center;text-align:center;pointer-events:none;padding:0 12px}
.rr-big{font-family:var(--font-lilita),sans-serif;font-style:italic;font-size:clamp(42px,12vw,86px);line-height:.95;color:#fff;-webkit-text-stroke:.065em #0d0a1e;paint-order:stroke fill;text-shadow:0 .08em 0 #0d0a1e,.05em .16em .3em rgba(0,0,0,.35);transform:skewX(-6deg)}
.rr-sub{margin-top:6px;font-weight:800;font-size:15px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.75)}
.rr-intro{position:absolute;left:0;right:0;top:calc(var(--safe-top) + 64px);display:flex;justify-content:center;pointer-events:none;padding:0 14px}
.rr-intro .rr-card{width:min(380px,100%)}
/* sheets */
.rr-sheet{position:absolute;inset:auto 0 0 0;max-height:88%;display:flex;flex-direction:column;border-radius:26px 26px 0 0;padding:14px calc(var(--safe-right) + 16px) calc(var(--safe-bottom) + 16px) calc(var(--safe-left) + 16px);background:linear-gradient(180deg,#1e2452,#10132c);box-shadow:0 -20px 50px -10px rgba(0,0,0,.6);z-index:20}
@media (min-width:760px){.rr-sheet{width:min(720px,94vw);margin:0 auto}}
.rr-sheet .rr-grab{width:46px;height:5px;border-radius:9px;background:rgba(255,255,255,.25);margin:0 auto 12px}
.rr-scroll{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;margin:0 -4px;padding:0 4px 4px}
.rr-scroll::-webkit-scrollbar{display:none}
.rr-veil{position:absolute;inset:0;background:rgba(4,5,14,.58);z-index:19}
.rr-trucks{display:grid;grid-auto-flow:column;grid-auto-columns:min(72%,250px);gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;scrollbar-width:none}
.rr-trucks::-webkit-scrollbar{display:none}
.rr-truck{scroll-snap-align:center;border-radius:20px;padding:10px;background:rgba(255,255,255,.07);border:2px solid transparent;text-align:left;color:#fff;cursor:pointer}
.rr-truck.sel{border-color:var(--acc);background:rgba(255,255,255,.12)}
.rr-truck canvas{display:block;width:100%;height:124px;border-radius:14px;background:radial-gradient(120% 90% at 50% 100%,rgba(255,255,255,.2),rgba(255,255,255,0))}
.rr-up{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:16px;background:rgba(255,255,255,.06);margin-top:8px}
.rr-dots{display:flex;gap:3px;margin-top:4px}
.rr-dots i{width:11px;height:6px;border-radius:2px;transform:skewX(-14deg);background:rgba(255,255,255,.18)}
.rr-dots i.on{background:var(--acc);box-shadow:0 0 8px var(--acc)}
.rr-worlds{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px}
.rr-world{position:relative;border-radius:18px;overflow:hidden;aspect-ratio:16/11;background:#222;box-shadow:0 10px 22px -12px rgba(0,0,0,.7)}
.rr-world canvas{position:absolute;inset:0;width:100%;height:100%}
.rr-world .rr-wl{position:absolute;inset:auto 0 0 0;padding:8px 10px;background:linear-gradient(0deg,rgba(0,0,0,.8),rgba(0,0,0,0));font-weight:800;font-size:14px}
.rr-world .rr-wc{position:absolute;right:8px;top:8px;display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:rgba(10,12,30,.8)}
.rr-world.lock{filter:grayscale(.85) brightness(.6)}
.rr-world.now{outline:3px solid var(--acc);outline-offset:-3px}
/* results: the podium card */
.rr-result-wrap{position:absolute;inset:0;display:grid;place-items:center;padding:calc(var(--safe-top) + 12px) 14px calc(var(--safe-bottom) + 12px);z-index:15;pointer-events:none}
.rr-result{position:relative;pointer-events:auto;width:min(390px,100%);max-height:100%;overflow-y:auto;text-align:center;scrollbar-width:none}
.rr-result::-webkit-scrollbar{display:none}
.rr-podium{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:end;gap:6px;margin:8px 4px 2px}
.rr-podium div{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}
.rr-podium p{font-size:11px;font-weight:800;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rr-podium p.you{color:#FFD23F}
.rr-step{width:100%;border-radius:10px 10px 4px 4px;display:grid;place-items:center;font-family:var(--font-lilita),sans-serif;font-size:22px;color:#0d0a1e;box-shadow:inset 0 2px 0 rgba(255,255,255,.5)}
.rr-stars{display:flex;justify-content:center;gap:6px;margin:4px 0 2px}
.rr-star{width:clamp(42px,12vw,56px);height:clamp(42px,12vw,56px);filter:drop-shadow(0 4px 0 rgba(0,0,0,.35))}
.rr-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}
.rr-stats div{border-radius:14px;padding:7px 2px;background:rgba(255,255,255,.07)}
.rr-stats b{display:flex;align-items:center;justify-content:center;gap:3px;font-family:var(--font-lilita),sans-serif;font-size:18px}
.rr-stats span{font-size:9.5px;font-weight:800;opacity:.65;text-transform:uppercase;letter-spacing:.08em}
.rr-next{display:flex;align-items:center;gap:12px;border-radius:16px;background:rgba(0,0,0,.32);color:#fff;padding:10px 12px;text-align:left;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.1)}
.rr-count{position:relative;width:44px;height:44px;flex:none}
.rr-count svg{position:absolute;inset:0;transform:rotate(-90deg)}
.rr-count b{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-lilita),sans-serif;font-size:19px}
.rr-toast{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 200px);padding:8px 16px;border-radius:99px;font-weight:800;white-space:nowrap;z-index:12;pointer-events:none}
@media (max-height:640px){.rr-result .rr-card{padding:10px 13px}.rr-result .rr-big{font-size:clamp(30px,8vh,44px)!important}.rr-result .rr-stats{margin:6px 0;gap:5px}.rr-result .rr-stats div{padding:4px 2px}.rr-result .rr-stats b{font-size:15px}.rr-star{width:36px;height:36px}.rr-result .rr-cta{padding-top:.5rem;padding-bottom:.5rem}.rr-step{font-size:17px}}
@media (orientation:landscape) and (max-height:500px){
  .rr-home{padding:calc(var(--safe-top) + 3.4rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + .7rem) calc(var(--safe-left) + 1rem);flex-direction:row;align-items:center;justify-content:center;gap:clamp(16px,4vw,48px)}
  .rr-home > div:first-child{flex:none}
  .rr-home > div:last-child{width:min(420px,56vw);gap:8px}
  .rr-home .rr-card{padding:9px 13px 9px}
  .rr-home .rr-card .rr-short-hide{display:none}
  .rr-home .rr-cta{padding-top:.6rem;padding-bottom:.6rem;font-size:1.25rem}
  .rr-home .rr-ghost{padding-top:.5rem;padding-bottom:.5rem}
  .rr-logo .rr-l1,.rr-logo .rr-l2{font-size:clamp(34px,10vh,60px)}
  .rr-tag{font-size:11px;letter-spacing:.14em}
  .rr-pedal{width:clamp(80px,19vh,108px);height:clamp(86px,21vh,116px)}
  .rr-act{width:clamp(56px,14vh,70px);height:clamp(56px,14vh,70px)}
  .rr-side{flex-direction:row-reverse;align-items:flex-end}
  .rr-side.right{flex-direction:row}
  .rr-top{flex-direction:row;flex-wrap:wrap;align-items:flex-start}
  .rr-top .rr-track{order:1;flex:1 1 200px;margin-top:14px}
  .rr-powers{top:calc(var(--safe-top) + 74px)}
  .rr-wind{top:calc(var(--safe-top) + 74px)}
  .rr-toast{top:calc(var(--safe-top) + 84px)}
  .rr-intro{top:calc(var(--safe-top) + 52px)}
  .rr-intro .rr-card{width:min(460px,100%)}
  .rr-intro .rr-rivals{display:none}
  .rr-lights{top:calc(var(--safe-top) + 36%)}
  .rr-pop{top:24%}
}
`;
