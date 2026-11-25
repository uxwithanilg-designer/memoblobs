// Gizmo Drive's interface: a bright mobile-game look — chunky buttons with depth, solid tinted panels (no blur, so
// phones stay smooth), the display font, colours that follow the world (--acc), safe areas on every edge, big pedals
// for thumbs on phones and side-by-side pedals in the bottom-right corner on the web. Animations are transform and
// opacity only.
export const GIZMO_CSS = `
.gz-root{position:absolute;inset:0;overflow:hidden;background:#0b0d1a;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:none}
.gz-root *{box-sizing:border-box}
.gz-stage{position:absolute;inset:0}
.gz-canvas{position:absolute;inset:0;display:block}
.gz-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.gz-ui{position:absolute;inset:0;pointer-events:none;z-index:5}
.gz-ui > *{pointer-events:auto}
.gz-panel{background:rgba(16,14,38,.7);border:1px solid rgba(255,255,255,.14);box-shadow:0 12px 32px -14px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.12)}
.gz-pill{display:inline-flex;align-items:center;gap:.4rem;border-radius:999px;padding:.32rem .75rem .32rem .4rem;font-weight:800;font-size:15px;line-height:1}
.gz-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:0;border-radius:22px;font-weight:800;cursor:pointer;color:#14102a;
  background:linear-gradient(180deg,#fff 0%,#e8e5f7 100%);box-shadow:0 5px 0 #b6aed8,0 12px 22px -10px rgba(0,0,0,.6);transition:transform .12s ease,box-shadow .12s ease}
.gz-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #b6aed8,0 6px 14px -8px rgba(0,0,0,.6)}
.gz-btn:disabled{opacity:.55;cursor:default}
.gz-cta{color:#062a24;background:linear-gradient(180deg,#B8FFE9 0%,#4DF2C4 50%,#16D3A6 100%);box-shadow:0 6px 0 #0B8F72,0 16px 32px -10px rgba(22,211,166,.7)}
.gz-cta:active{box-shadow:0 2px 0 #0B8F72,0 8px 18px -8px rgba(22,211,166,.6)}
.gz-violet{color:#fff;background:linear-gradient(180deg,#B79CFF 0%,#7C5CFF 55%,#5B3BE0 100%);box-shadow:0 6px 0 #3A22A8,0 14px 28px -10px rgba(124,92,255,.7)}
.gz-violet:active{box-shadow:0 2px 0 #3A22A8}
.gz-ghost{color:#fff;background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.25),0 4px 0 rgba(0,0,0,.25)}
.gz-ghost:active{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.25),0 0 0 rgba(0,0,0,.25)}
.gz-shine::after{content:"";position:absolute;inset:3px 12% auto;height:38%;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.7),rgba(255,255,255,0));pointer-events:none}
/* title */
.gz-logo{display:flex;flex-direction:column;align-items:center;line-height:.84;filter:drop-shadow(0 10px 24px rgba(0,0,0,.45))}
.gz-logo .w{display:flex;align-items:center;gap:.04em}
.gz-logo span{display:inline-block;font-family:var(--font-lilita),sans-serif;color:var(--c);-webkit-text-stroke:.075em #14102a;paint-order:stroke fill;text-shadow:0 .07em 0 #14102a,0 .14em 0 rgba(0,0,0,.25);animation:gz-drop .7s cubic-bezier(.3,1.6,.5,1) both}
.gz-logo .l1 span{font-size:clamp(50px,14vw,100px)}.gz-logo .l2 span{font-size:clamp(44px,12.5vw,88px)}
.gz-logo .gear{display:inline-block;width:.78em;height:.78em;animation:gz-spin 4s linear infinite;filter:drop-shadow(0 .06em 0 #14102a)}
@keyframes gz-drop{0%{transform:translateY(-80%) scale(.6) rotate(-8deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes gz-spin{to{transform:rotate(360deg)}}
@keyframes gz-bob{50%{transform:translateY(-5%)}}
.gz-tag{font-weight:700;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.88);text-shadow:0 2px 6px rgba(0,0,0,.5)}
/* home */
.gz-home{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:calc(var(--safe-top) + 4.6rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + 1.2rem) calc(var(--safe-left) + 1rem);
  background:linear-gradient(180deg,rgba(8,8,24,.0) 38%,rgba(8,8,24,.6) 100%)}
.gz-card{width:min(430px,100%);border-radius:28px;padding:14px}
.gz-progress{height:9px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden}
.gz-progress i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--acc),#fff);box-shadow:0 0 12px var(--acc)}
.gz-ride{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:3px 10px 3px 4px;background:rgba(255,255,255,.1);font-size:12px;font-weight:800}
.gz-ride i{display:block;width:18px;height:18px;border-radius:50%;background:var(--acc)}
/* HUD */
.gz-hud{position:absolute;inset:0;pointer-events:none}
.gz-top{position:absolute;left:calc(var(--safe-left) + 10px);right:calc(var(--safe-right) + 64px);top:calc(var(--safe-top) + 8px);display:flex;align-items:flex-start;gap:8px}
/* a narrow phone: the progress track gets its own row under the chips */
@media (max-width:560px){.gz-top{flex-wrap:wrap}.gz-top .gz-trackrow{order:3;flex-basis:100%;margin-top:2px}}
.gz-chip{border-radius:18px;padding:6px 10px 6px 7px;display:flex;align-items:center;gap:8px}
.gz-badge{display:grid;place-items:center;min-width:36px;height:36px;padding:0 6px;border-radius:12px;background:linear-gradient(180deg,var(--acc),color-mix(in srgb,var(--acc) 55%,#000));font-family:var(--font-lilita),sans-serif;font-size:17px;box-shadow:inset 0 1px 0 rgba(255,255,255,.45)}
.gz-track{position:relative;height:10px;border-radius:99px;background:rgba(255,255,255,.16);margin-top:5px}
.gz-track b{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 65%,#fff),var(--acc))}
.gz-track s{position:absolute;top:-3px;width:4px;height:16px;border-radius:2px;background:#FFC233;text-decoration:none;box-shadow:0 0 0 2px rgba(0,0,0,.3)}
.gz-track s.on{background:#3EE08F}
.gz-track em{position:absolute;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.45);display:grid;place-items:center}
.gz-flag{position:absolute;right:-6px;top:-9px}
.gz-fuel{display:flex;align-items:center;gap:6px;border-radius:14px;padding:5px 9px 5px 6px;margin-top:6px;width:max-content}
.gz-fuelbar{position:relative;width:clamp(84px,23vw,150px);height:12px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden}
.gz-fuelbar i{position:absolute;inset:0 auto 0 0;border-radius:99px;transition:width .2s linear,background .4s}
.gz-low{animation:gz-blink .6s steps(2) infinite}
@keyframes gz-blink{50%{opacity:.25}}
.gz-hearts{display:flex;gap:2px}
.gz-powers{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 76px);display:flex;gap:8px}
.gz-power{position:relative;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(16,14,38,.75);box-shadow:0 6px 16px -6px rgba(0,0,0,.6)}
.gz-power svg.ring{position:absolute;inset:0;transform:rotate(-90deg)}
/* pedals: phones — brake on the left, gas on the right, big */
.gz-pedals{position:absolute;inset:auto 0 0 0;height:min(44%,280px);display:flex;justify-content:space-between;align-items:flex-end;padding:0 calc(var(--safe-right) + 14px) calc(var(--safe-bottom) + 14px) calc(var(--safe-left) + 14px);pointer-events:none}
.gz-pedal{pointer-events:auto;position:relative;width:clamp(98px,28vw,132px);height:clamp(98px,28vw,132px);border-radius:34px;display:grid;place-items:center;
  background:linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,.08));border:2px solid rgba(255,255,255,.38);box-shadow:0 8px 0 rgba(0,0,0,.35),0 18px 30px -12px rgba(0,0,0,.6);transition:transform .08s,box-shadow .08s,background .12s}
.gz-pedal.on{transform:translateY(6px) scale(.96);box-shadow:0 2px 0 rgba(0,0,0,.35),0 8px 18px -10px rgba(0,0,0,.6)}
.gz-pedal.gas.on{background:linear-gradient(180deg,rgba(77,242,196,.7),rgba(22,211,166,.3))}
.gz-pedal.brake.on{background:linear-gradient(180deg,rgba(255,90,110,.65),rgba(255,79,122,.25))}
.gz-pedal small{position:absolute;bottom:9px;font-weight:800;font-size:11px;letter-spacing:.12em;opacity:.88}
.gz-zone{position:absolute;top:0;bottom:0;width:50%;pointer-events:auto}
/* web (mouse and keyboard): brake and gas side by side in the bottom-right corner */
@media (hover:hover) and (pointer:fine){.gz-pedals{justify-content:flex-end;gap:14px}.gz-pedal{width:clamp(86px,8.5vw,110px);height:clamp(86px,8.5vw,110px);border-radius:28px}}
.gz-keys{position:absolute;bottom:calc(var(--safe-bottom) + 14px);left:calc(var(--safe-left) + 14px);font-size:13px;font-weight:700;opacity:.85;white-space:nowrap;padding:7px 12px;border-radius:99px}
.gz-keys kbd{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 5px;margin:0 2px;border-radius:7px;background:rgba(255,255,255,.16);font-family:inherit;font-size:12px}
/* centre messages */
.gz-pop{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;white-space:nowrap}
.gz-big{font-family:var(--font-lilita),sans-serif;font-size:clamp(40px,12vw,84px);line-height:.95;color:#fff;-webkit-text-stroke:.06em #14102a;paint-order:stroke fill;text-shadow:0 .08em 0 #14102a,0 .16em .3em rgba(0,0,0,.35)}
.gz-sub{margin-top:6px;font-weight:800;font-size:15px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)}
.gz-intro{position:absolute;left:0;right:0;top:calc(var(--safe-top) + 15%);text-align:center;pointer-events:none;padding:0 16px}
.gz-intro .gz-big{font-size:clamp(30px,8.6vw,72px)}
.gz-kicker{display:inline-block;padding:5px 14px;border-radius:99px;background:var(--acc);color:#14102a;font-weight:900;font-size:13px;letter-spacing:.14em;text-transform:uppercase;box-shadow:0 8px 20px -8px var(--acc)}
.gz-new{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:6px 14px;border-radius:99px;background:linear-gradient(90deg,#7C5CFF,#FF5FA2);font-weight:900;font-size:14px;box-shadow:0 10px 24px -10px rgba(124,92,255,.8);animation:gz-bob 1.4s ease-in-out infinite}
.gz-skip{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--safe-bottom) + 26%);padding:8px 16px;border-radius:99px;font-weight:800;font-size:13px;pointer-events:auto;cursor:pointer;border:0;color:#fff}
/* sheets */
.gz-sheet{position:absolute;inset:auto 0 0 0;max-height:88%;display:flex;flex-direction:column;border-radius:30px 30px 0 0;padding:16px calc(var(--safe-right) + 16px) calc(var(--safe-bottom) + 16px) calc(var(--safe-left) + 16px);background:linear-gradient(180deg,#241f4f,#141230);box-shadow:0 -20px 50px -10px rgba(0,0,0,.6);z-index:20}
@media (min-width:760px){.gz-sheet{left:50%;right:auto;width:640px;margin-left:-320px}}
.gz-sheet .grab{width:46px;height:5px;border-radius:9px;background:rgba(255,255,255,.25);margin:0 auto 12px}
.gz-scroll{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;margin:0 -4px;padding:0 4px}
.gz-scroll::-webkit-scrollbar{display:none}
.gz-veil{position:absolute;inset:0;background:rgba(5,6,16,.55);z-index:19}
.gz-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;border-radius:16px;background:rgba(255,255,255,.08);margin-bottom:12px}
.gz-tabs button{border:0;border-radius:12px;padding:8px;font-weight:800;color:#fff;background:transparent;cursor:pointer}
.gz-tabs button.on{background:var(--acc);color:#14102a}
.gz-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.gz-tile{position:relative;border-radius:20px;padding:10px;background:rgba(255,255,255,.07);border:2px solid transparent;text-align:left;color:#fff;cursor:pointer}
.gz-tile.sel{border-color:var(--acc);background:rgba(255,255,255,.12)}
.gz-tile canvas{display:block;width:100%;height:92px;border-radius:14px;background:radial-gradient(120% 90% at 50% 100%,rgba(255,255,255,.18),rgba(255,255,255,0))}
.gz-tile.lock canvas{filter:brightness(0) opacity(.45)}
.gz-swatch{display:block;width:100%;height:46px;border-radius:12px;box-shadow:inset 0 -6px 0 rgba(0,0,0,.18)}
.gz-stat{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800}
.gz-stat b{display:block;height:6px;border-radius:9px;background:var(--acc)}
.gz-worlds{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.gz-world{position:relative;border-radius:20px;overflow:hidden;aspect-ratio:16/11;background:#222;box-shadow:0 10px 22px -12px rgba(0,0,0,.7)}
.gz-world canvas{position:absolute;inset:0;width:100%;height:100%}
.gz-world .wl{position:absolute;inset:auto 0 0 0;padding:8px 10px;background:linear-gradient(0deg,rgba(0,0,0,.78),rgba(0,0,0,0));font-weight:800;font-size:14px}
.gz-world.lock{filter:grayscale(.85) brightness(.6)}
.gz-world.now{outline:3px solid var(--acc);outline-offset:-3px}
/* results */
.gz-result-wrap{position:absolute;inset:0;display:grid;place-items:center;padding:calc(var(--safe-top) + 12px) 14px calc(var(--safe-bottom) + 12px);z-index:15;pointer-events:none}
.gz-result{position:relative;pointer-events:auto;width:min(390px,100%);max-height:100%;overflow-y:auto;border-radius:32px;padding:20px 18px 16px;text-align:center}
@media (max-height:600px){.gz-result{padding:12px 14px 12px;border-radius:24px}.gz-result .gz-big{font-size:clamp(28px,8vh,40px)!important}.gz-result .gz-stats{margin:8px 0;gap:6px}.gz-result .gz-stats div{padding:5px 4px}.gz-result .gz-stats b{font-size:18px}.gz-result .gz-cta{padding-top:.5rem;padding-bottom:.5rem}.gz-stars svg{width:38px;height:38px}}
.gz-stars{display:flex;justify-content:center;gap:6px;margin:6px 0 2px}
.gz-stars svg{width:48px;height:48px}
.gz-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
.gz-stats div{border-radius:16px;padding:9px 4px;background:rgba(255,255,255,.08)}
.gz-stats b{display:block;font-family:var(--font-lilita),sans-serif;font-size:22px}
.gz-stats span{font-size:11px;font-weight:700;opacity:.75;text-transform:uppercase;letter-spacing:.08em}
.gz-count{position:relative;width:44px;height:44px;flex:none}
.gz-count svg{position:absolute;inset:0;transform:rotate(-90deg)}
.gz-count b{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-lilita),sans-serif;font-size:19px}
.gz-toast{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 124px);padding:8px 16px;border-radius:99px;font-weight:800;white-space:nowrap;z-index:12;pointer-events:none}
@media (orientation:landscape) and (max-height:500px){
  .gz-home{padding-top:calc(var(--safe-top) + 3.4rem)}
  .gz-tag{display:none}
  .gz-low{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-areas:"card play" "card more";gap:10px!important;width:min(860px,100%)!important;align-items:end}
  .gz-low .gz-card{grid-area:card;width:100%}.gz-low .gz-play{grid-area:play;width:100%;padding-top:.7rem;padding-bottom:.7rem}.gz-low .gz-more{grid-area:more;width:100%}
  .gz-logo .l1 span{font-size:clamp(36px,9vh,64px)}.gz-logo .l2 span{font-size:clamp(32px,8vh,56px)}
  .gz-pedals{height:64%}
  .gz-pedal{width:clamp(88px,21vh,120px);height:clamp(88px,21vh,120px)}
  .gz-powers{top:calc(var(--safe-top) + 64px)}
  .gz-intro{top:calc(var(--safe-top) + 8%)}
  .gz-toast{top:calc(var(--safe-top) + 116px)}
}
`;
