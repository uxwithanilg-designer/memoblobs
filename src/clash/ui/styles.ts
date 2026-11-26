// Cube Clash's interface: a bright toy-block look — chunky candy-coloured buttons with a cube bevel, solid navy panels
// with a coloured top edge (no blur, so phones stay smooth), an 8-bit display font, colours that follow the theme
// (--acc), safe areas on every edge, a floating thumb stick and big FIRE / JUMP / BUILD buttons, a knockout feed and
// the team crystals' status. Animations are transform/opacity only.
export const CLASH_CSS = `
.cc-root{position:absolute;inset:0;overflow:hidden;background:#0a1030;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:none}
.cc-root *{box-sizing:border-box}
.cc-stage{position:absolute;inset:0}
.cc-px{font-family:var(--font-pixel),var(--font-lilita),monospace;letter-spacing:.02em}
.cc-ui{position:absolute;inset:0;pointer-events:none;z-index:5}
.cc-ui > *{pointer-events:auto}
.cc-panel{background:rgba(14,22,52,.82);border:2px solid rgba(255,255,255,.14);border-top-color:color-mix(in srgb,var(--acc) 70%,#fff);border-radius:12px;box-shadow:0 4px 0 rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.1),0 14px 30px -14px rgba(0,0,0,.7)}
.cc-pill{display:inline-flex;align-items:center;gap:.38rem;border-radius:12px;padding:.3rem .62rem .3rem .38rem;font-weight:800;font-size:15px;line-height:1}
.cc-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:0;border-radius:14px;font-weight:800;cursor:pointer;color:#141028;
  background:linear-gradient(180deg,#fff 0%,#e4e0f4 100%);box-shadow:inset 0 3px 0 rgba(255,255,255,.9),inset 0 -4px 0 rgba(0,0,0,.12),0 5px 0 #8f88b4,0 12px 22px -10px rgba(0,0,0,.6);transition:transform .1s ease,box-shadow .1s ease}
.cc-btn:active{transform:translateY(4px);box-shadow:inset 0 3px 0 rgba(255,255,255,.9),inset 0 -2px 0 rgba(0,0,0,.12),0 1px 0 #8f88b4,0 6px 14px -8px rgba(0,0,0,.6)}
.cc-cta{color:#06230F;background:linear-gradient(180deg,#9CFFB4 0%,#38D96B 55%,#1FA84E 100%);box-shadow:inset 0 3px 0 rgba(255,255,255,.55),inset 0 -5px 0 rgba(0,80,30,.35),0 6px 0 #127A35,0 16px 30px -10px rgba(56,217,107,.7)}
.cc-cta:active{box-shadow:inset 0 3px 0 rgba(255,255,255,.55),inset 0 -2px 0 rgba(0,80,30,.35),0 2px 0 #127A35,0 8px 18px -8px rgba(56,217,107,.6)}
.cc-ghost{color:#fff;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 2px rgba(255,255,255,.22),inset 0 2px 0 rgba(255,255,255,.12),0 4px 0 rgba(0,0,0,.35)}
.cc-ghost:active{box-shadow:inset 0 0 0 2px rgba(255,255,255,.22),0 0 0 rgba(0,0,0,.35)}
.cc-shine::after{content:"";position:absolute;inset:4px 10% auto;height:34%;border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,.6),rgba(255,255,255,0));pointer-events:none}
/* title: pixel letters with a stepped voxel shadow */
.cc-logo{display:flex;flex-direction:column;align-items:center;line-height:.82;filter:drop-shadow(0 12px 22px rgba(0,0,0,.5))}
.cc-logo span{display:inline-block;font-family:var(--font-pixel),monospace;font-weight:700;color:var(--c);
  text-shadow:2px 2px 0 var(--d),4px 4px 0 var(--d),6px 6px 0 var(--d),8px 8px 0 rgba(0,0,0,.35),-2px -2px 0 #14102a,2px -2px 0 #14102a,-2px 2px 0 #14102a;animation:cc-drop .7s cubic-bezier(.3,1.6,.5,1) both,cc-bob 3.4s ease-in-out infinite}
.cc-logo .l1{font-size:clamp(50px,15vw,104px)}.cc-logo .l2{font-size:clamp(56px,17vw,120px);margin-top:.04em}
@keyframes cc-drop{0%{transform:translateY(-90%) scale(.5);opacity:0}100%{transform:none;opacity:1}}
@keyframes cc-bob{50%{transform:translateY(-3%)}}
.cc-tag{font-weight:800;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.88);text-shadow:0 2px 6px rgba(0,0,0,.6)}
/* home */
.cc-home{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:calc(var(--safe-top) + 4.4rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + 1.2rem) calc(var(--safe-left) + 1rem);
  background:linear-gradient(180deg,rgba(6,8,22,.15) 0%,rgba(6,8,22,0) 30%,rgba(6,8,22,.62) 100%)}
.cc-card{width:min(430px,100%);padding:14px}
.cc-bar{height:10px;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden;box-shadow:inset 0 2px 0 rgba(0,0,0,.25)}
.cc-bar i{display:block;height:100%;border-radius:4px;background:repeating-linear-gradient(90deg,var(--acc) 0 8px,color-mix(in srgb,var(--acc) 75%,#fff) 8px 10px);box-shadow:0 0 12px var(--acc);transition:width .25s}
/* HUD */
.cc-hud{position:absolute;inset:0;pointer-events:none}
.cc-top{position:absolute;left:calc(var(--safe-left) + 10px);right:calc(var(--safe-right) + 64px);top:calc(var(--safe-top) + 8px);display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.cc-chip{padding:6px 10px 7px 7px;display:flex;align-items:center;gap:8px;max-width:min(62vw,330px)}
.cc-badge{display:grid;place-items:center;min-width:36px;height:36px;padding:0 6px;border-radius:9px;background:linear-gradient(180deg,var(--acc),color-mix(in srgb,var(--acc) 55%,#000));font-family:var(--font-pixel),monospace;font-weight:700;font-size:17px;box-shadow:inset 0 2px 0 rgba(255,255,255,.45),inset 0 -3px 0 rgba(0,0,0,.25)}
.cc-meters{display:flex;flex-direction:column;gap:5px;margin-top:6px;width:max-content}
.cc-meter{display:flex;align-items:center;gap:6px;padding:4px 8px 4px 6px;border-radius:10px}
.cc-mbar{position:relative;width:clamp(92px,26vw,160px);height:11px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden;box-shadow:inset 0 2px 0 rgba(0,0,0,.3)}
.cc-mbar i{position:absolute;inset:0 auto 0 0;transition:width .15s linear,background .3s}
.cc-mbar i::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(0,0,0,0) 0 9px,rgba(0,0,0,.25) 9px 10px)}
.cc-low{animation:cc-blink .55s steps(2) infinite}
@keyframes cc-blink{50%{opacity:.3}}
.cc-hearts{display:flex;gap:2px;justify-content:flex-end}
.cc-boss{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 100px);width:min(440px,82vw);padding:7px 10px 9px;text-align:center}
.cc-boss .cc-mbar{width:100%;height:13px}
.cc-powers{position:absolute;left:calc(var(--safe-left) + 10px);top:calc(var(--safe-top) + 196px);display:flex;flex-direction:column;gap:8px}
.cc-power{position:relative;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(10,12,30,.78);box-shadow:0 4px 0 rgba(0,0,0,.4)}
.cc-power svg.ring{position:absolute;inset:-3px;width:48px;height:48px;transform:rotate(-90deg)}
/* touch controls */
.cc-left{position:absolute;left:0;top:22%;bottom:0;width:46%;pointer-events:auto}
.cc-right{position:absolute;right:0;top:18%;bottom:0;width:54%;pointer-events:auto}
.cc-stick{position:absolute;width:130px;height:130px;margin:-65px 0 0 -65px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.08) 55%,rgba(255,255,255,.18) 56%,rgba(255,255,255,.08) 70%);border:2px solid rgba(255,255,255,.28);pointer-events:none}
.cc-knob{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(220,220,240,.7));box-shadow:inset 0 -4px 0 rgba(0,0,0,.18),0 6px 14px rgba(0,0,0,.4)}
.cc-stickhint{position:absolute;left:calc(var(--safe-left) + 34px);bottom:calc(var(--safe-bottom) + 40px);width:110px;height:110px;border-radius:50%;border:2px dashed rgba(255,255,255,.25);display:grid;place-items:center;font-size:11px;font-weight:800;letter-spacing:.1em;opacity:.75;pointer-events:none}
.cc-btns{position:absolute;right:calc(var(--safe-right) + 14px);bottom:calc(var(--safe-bottom) + 20px);width:210px;height:210px;pointer-events:none}
.cc-fire,.cc-jump{position:absolute;pointer-events:auto;display:grid;place-items:center;border-radius:26px;border:2px solid rgba(255,255,255,.35);
  box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -6px 0 rgba(0,0,0,.25),0 7px 0 rgba(0,0,0,.35),0 16px 30px -12px rgba(0,0,0,.6);transition:transform .07s,box-shadow .07s}
.cc-fire{right:0;bottom:0;width:104px;height:104px;background:linear-gradient(180deg,rgba(255,92,92,.72),rgba(200,30,60,.6))}
.cc-jump{left:4px;bottom:14px;width:72px;height:72px;border-radius:20px;background:linear-gradient(180deg,rgba(124,245,255,.55),rgba(46,155,255,.45))}
.cc-build{position:absolute;pointer-events:auto;display:grid;place-items:center;right:10px;top:4px;width:72px;height:72px;border-radius:20px;border:2px solid rgba(255,255,255,.35);background:linear-gradient(180deg,rgba(255,200,61,.6),rgba(255,140,30,.5));box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -6px 0 rgba(0,0,0,.25),0 7px 0 rgba(0,0,0,.35);transition:transform .07s}
.cc-build.on{transform:translateY(5px) scale(.96)}
.cc-build small{position:absolute;bottom:6px;font-weight:900;font-size:10px;letter-spacing:.12em}
.cc-build b{position:absolute;top:4px;right:6px;font-size:11px;font-weight:900}
.cc-fire.on,.cc-jump.on{transform:translateY(5px) scale(.96);box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -3px 0 rgba(0,0,0,.25),0 2px 0 rgba(0,0,0,.35)}
.cc-fire small,.cc-jump small{position:absolute;bottom:7px;font-weight:900;font-size:10px;letter-spacing:.14em;opacity:.9}
.cc-keys{position:absolute;bottom:calc(var(--safe-bottom) + 12px);left:50%;transform:translateX(-50%);font-size:12.5px;font-weight:800;opacity:.85;white-space:nowrap;padding:6px 12px;border-radius:12px}
/* centre messages */
/* the animated messages sit in static full-width rows (their own transform belongs to the animation) */
.cc-wrap{position:absolute;left:0;right:0;display:flex;justify-content:center;pointer-events:none;padding:0 12px}
.cc-popwrap{top:31%;transform:translateY(-50%);z-index:9}.cc-streakwrap{top:44%;z-index:9}.cc-toastwrap{top:calc(var(--safe-top) + 150px);z-index:12}.cc-clearwrap{top:13%;z-index:10}
.cc-pop{text-align:center;pointer-events:none;white-space:nowrap}
.cc-big{font-family:var(--font-pixel),monospace;font-weight:700;font-size:clamp(38px,11vw,80px);line-height:.95;color:#fff;
  text-shadow:2px 2px 0 #14102a,-2px -2px 0 #14102a,2px -2px 0 #14102a,-2px 2px 0 #14102a,4px 5px 0 rgba(0,0,0,.45)}
.cc-sub{margin-top:8px;font-weight:800;font-size:15px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7)}
.cc-intro{position:absolute;left:0;right:0;top:calc(var(--safe-top) + 17%);text-align:center;pointer-events:none;padding:0 16px;z-index:8}
.cc-kicker{display:inline-block;padding:6px 14px;border-radius:9px;background:var(--acc);color:#120e26;font-weight:900;font-size:13px;letter-spacing:.14em;text-transform:uppercase;box-shadow:inset 0 2px 0 rgba(255,255,255,.5),0 4px 0 rgba(0,0,0,.35)}
.cc-goal{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:7px 13px;border-radius:11px;font-weight:800;font-size:15px}
.cc-mods{display:flex;gap:6px;justify-content:center;margin-top:8px;flex-wrap:wrap}
.cc-mods span{padding:4px 10px;border-radius:8px;background:rgba(255,90,140,.85);font-weight:900;font-size:12px;letter-spacing:.06em}
.cc-skip{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--safe-bottom) + 26px);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.7;pointer-events:none}
.cc-clear{text-align:center;pointer-events:none;width:min(92vw,520px)}
.cc-stars{display:flex;justify-content:center;gap:10px;margin-top:10px}
.cc-loot{display:flex;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap}
.cc-loot span{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:10px;font-weight:800;font-size:14px}
.cc-fade{position:absolute;inset:0;background:var(--fade);pointer-events:none;z-index:7}
.cc-toast{padding:8px 15px;border-radius:12px;font-weight:800;white-space:nowrap;pointer-events:none;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.cc-streak{font-family:var(--font-pixel),monospace;font-weight:700;font-size:26px;color:#FFD23F;text-shadow:2px 2px 0 #14102a,-2px -2px 0 #14102a,2px -2px 0 #14102a,-2px 2px 0 #14102a;pointer-events:none;white-space:nowrap}
/* the knockout feed and the crystals */
.cc-feed{position:absolute;right:calc(var(--safe-right) + 10px);top:calc(var(--safe-top) + 92px);display:flex;flex-direction:column;align-items:flex-end;gap:4px;pointer-events:none;z-index:6}
.cc-feed p{padding:4px 9px;border-radius:9px;background:rgba(14,22,52,.82);font-size:12px;font-weight:800;white-space:nowrap}
.cc-crystals{display:flex;gap:5px;margin-top:6px}
.cc-crystals span{position:relative;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:rgba(14,22,52,.82);border:2px solid rgba(255,255,255,.18)}
.cc-crystals span.off{opacity:.35;filter:grayscale(1)}
.cc-crystals span i{position:absolute;left:3px;right:3px;bottom:2px;height:3px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden}
.cc-crystals span i b{display:block;height:100%;background:#fff}
/* sheets */
.cc-sheet{position:absolute;inset:auto 0 0 0;max-height:88%;display:flex;flex-direction:column;border-radius:24px 24px 0 0;padding:14px calc(var(--safe-right) + 16px) calc(var(--safe-bottom) + 16px) calc(var(--safe-left) + 16px);
  background:linear-gradient(180deg,#1f2348,#121430);box-shadow:0 -6px 0 rgba(255,255,255,.06),0 -20px 50px -10px rgba(0,0,0,.6);z-index:20}
.cc-grab{width:46px;height:6px;border-radius:3px;background:rgba(255,255,255,.25);margin:0 auto 12px}
.cc-scroll{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;margin:0 -4px;padding:0 4px}
.cc-scroll::-webkit-scrollbar{display:none}
.cc-veil{position:absolute;inset:0;background:rgba(4,5,14,.55);z-index:19}
.cc-tabs{display:flex;gap:6px;margin-bottom:12px}
.cc-tabs button{flex:1;padding:9px 0;border-radius:11px;font-weight:800;background:rgba(255,255,255,.08);color:#fff;border:0;cursor:pointer}
.cc-tabs button.on{background:var(--acc);color:#120e26;box-shadow:inset 0 2px 0 rgba(255,255,255,.45),0 3px 0 rgba(0,0,0,.35)}
.cc-up{display:flex;align-items:center;gap:10px;padding:10px;border-radius:13px;background:rgba(255,255,255,.06);margin-top:8px}
.cc-dots{display:flex;gap:3px;margin-top:5px}
.cc-dots i{width:12px;height:7px;border-radius:2px;background:rgba(255,255,255,.16)}
.cc-dots i.on{background:var(--acc);box-shadow:0 0 8px var(--acc)}
.cc-skins{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
.cc-skin{border-radius:16px;padding:10px;background:rgba(255,255,255,.06);border:2px solid transparent;text-align:center;color:#fff;cursor:pointer}
.cc-skin.sel{border-color:var(--acc);background:rgba(255,255,255,.12)}
.cc-skin canvas{display:block;width:96px;height:120px;margin:0 auto;image-rendering:pixelated}
.cc-worlds{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.cc-world{position:relative;border-radius:16px;overflow:hidden;aspect-ratio:16/11;background:#222;box-shadow:0 4px 0 rgba(0,0,0,.4)}
.cc-world canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}
.cc-world .cc-wl{position:absolute;inset:auto 0 0 0;padding:8px 10px;background:linear-gradient(0deg,rgba(0,0,0,.8),rgba(0,0,0,0));font-weight:800;font-size:14px}
.cc-world.lock{filter:grayscale(.85) brightness(.55)}
.cc-world.now{outline:3px solid var(--acc);outline-offset:-3px}
.cc-toggle{position:relative;width:52px;height:30px;border-radius:9px;background:rgba(255,255,255,.18);border:0;cursor:pointer;flex:none}
.cc-toggle i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:7px;background:#fff;transition:transform .15s}
.cc-toggle.on{background:#3EE08F}.cc-toggle.on i{transform:translateX(22px)}
@media (orientation:landscape) and (max-height:520px){
  .cc-home{padding-top:calc(var(--safe-top) + 3.4rem)}
  .cc-logo .l1{font-size:clamp(34px,9vh,64px)}.cc-logo .l2{font-size:clamp(40px,11vh,76px)}
  .cc-btns{width:170px;height:170px;bottom:calc(var(--safe-bottom) + 14px)}
  .cc-fire{width:92px;height:92px}
  .cc-powers{top:calc(var(--safe-top) + 74px)}
  .cc-boss{top:calc(var(--safe-top) + 64px)}
  .cc-intro{top:calc(var(--safe-top) + 10%)}
}
/* the controls card (computers, when a game starts) */
.cc-coach{position:absolute;inset:0;z-index:18;display:flex;align-items:flex-end;justify-content:center;padding:16px 16px calc(var(--safe-bottom) + 18px);background:linear-gradient(180deg,rgba(6,10,30,0) 28%,rgba(6,10,30,.6) 100%);pointer-events:auto}
.cc-coach-card{width:min(580px,100%);max-height:calc(100% - 8px);overflow:auto;padding:16px 18px 14px;text-align:left}
.cc-coach-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin-top:12px}
.cc-coach-row{display:flex;align-items:center;gap:10px;padding:7px 9px;border-radius:12px;background:rgba(255,255,255,.06)}
.cc-coach-keys{display:flex;align-items:center;justify-content:center;gap:4px;flex-shrink:0;width:124px}
.cc-kbd{display:inline-grid;place-items:center;min-width:26px;height:28px;padding:0 6px;border-radius:7px;background:linear-gradient(180deg,#FFFFFF,#D9E3F2);color:#16233F;font-size:12px;font-weight:700;line-height:1;box-shadow:inset 0 -3px 0 #A9B9D3,0 2px 0 rgba(0,0,0,.45)}
.cc-kbd.wide{padding:0 11px}
.cc-mouse{width:22px;height:31px;flex-shrink:0;filter:drop-shadow(0 2px 0 rgba(0,0,0,.4))}
.cc-or{font-size:11px;font-weight:800;opacity:.6;margin:0 2px}
@media (max-width:560px){.cc-coach-grid{grid-template-columns:1fr}}
`;
