// Blockstorm's interface: a mobile-game look built from blocks — chunky buttons with a voxel bevel (light top edge,
// dark stepped base), solid tinted panels (no blur, so phones stay smooth), a pixel display font, colours that follow
// the world (--acc), safe areas on every edge, a floating thumb stick and big fire / jump buttons. Animations are
// transform/opacity only.
export const STORM_CSS = `
.bs-root{position:absolute;inset:0;overflow:hidden;background:#080a18;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:none}
.bs-root *{box-sizing:border-box}
.bs-stage{position:absolute;inset:0}
.bs-px{font-family:var(--font-pixel),var(--font-lilita),monospace;letter-spacing:.02em}
.bs-ui{position:absolute;inset:0;pointer-events:none;z-index:5}
.bs-ui > *{pointer-events:auto}
.bs-panel{background:rgba(10,12,30,.78);border:2px solid rgba(255,255,255,.16);border-radius:14px;box-shadow:0 4px 0 rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.1),0 14px 30px -14px rgba(0,0,0,.7)}
.bs-pill{display:inline-flex;align-items:center;gap:.38rem;border-radius:12px;padding:.3rem .62rem .3rem .38rem;font-weight:800;font-size:15px;line-height:1}
.bs-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:0;border-radius:14px;font-weight:800;cursor:pointer;color:#141028;
  background:linear-gradient(180deg,#fff 0%,#e4e0f4 100%);box-shadow:inset 0 3px 0 rgba(255,255,255,.9),inset 0 -4px 0 rgba(0,0,0,.12),0 5px 0 #8f88b4,0 12px 22px -10px rgba(0,0,0,.6);transition:transform .1s ease,box-shadow .1s ease}
.bs-btn:active{transform:translateY(4px);box-shadow:inset 0 3px 0 rgba(255,255,255,.9),inset 0 -2px 0 rgba(0,0,0,.12),0 1px 0 #8f88b4,0 6px 14px -8px rgba(0,0,0,.6)}
.bs-cta{color:#1b0a00;background:linear-gradient(180deg,#FFE97A 0%,#FFC23D 50%,#FF8F1F 100%);box-shadow:inset 0 3px 0 rgba(255,255,255,.55),inset 0 -5px 0 rgba(160,60,0,.35),0 6px 0 #A9530C,0 16px 30px -10px rgba(255,150,30,.7)}
.bs-cta:active{box-shadow:inset 0 3px 0 rgba(255,255,255,.55),inset 0 -2px 0 rgba(160,60,0,.35),0 2px 0 #A9530C,0 8px 18px -8px rgba(255,150,30,.6)}
.bs-ghost{color:#fff;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 2px rgba(255,255,255,.22),inset 0 2px 0 rgba(255,255,255,.12),0 4px 0 rgba(0,0,0,.35)}
.bs-ghost:active{box-shadow:inset 0 0 0 2px rgba(255,255,255,.22),0 0 0 rgba(0,0,0,.35)}
.bs-shine::after{content:"";position:absolute;inset:4px 10% auto;height:34%;border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,.6),rgba(255,255,255,0));pointer-events:none}
/* title: pixel letters with a stepped voxel shadow */
.bs-logo{display:flex;flex-direction:column;align-items:center;line-height:.82;filter:drop-shadow(0 12px 22px rgba(0,0,0,.5))}
.bs-logo span{display:inline-block;font-family:var(--font-pixel),monospace;font-weight:700;color:var(--c);
  text-shadow:2px 2px 0 var(--d),4px 4px 0 var(--d),6px 6px 0 var(--d),8px 8px 0 rgba(0,0,0,.35),-2px -2px 0 #14102a,2px -2px 0 #14102a,-2px 2px 0 #14102a;animation:bs-drop .7s cubic-bezier(.3,1.6,.5,1) both,bs-bob 3.4s ease-in-out infinite}
.bs-logo .l1{font-size:clamp(50px,15vw,104px)}.bs-logo .l2{font-size:clamp(56px,17vw,120px);margin-top:.04em}
@keyframes bs-drop{0%{transform:translateY(-90%) scale(.5);opacity:0}100%{transform:none;opacity:1}}
@keyframes bs-bob{50%{transform:translateY(-3%)}}
.bs-tag{font-weight:800;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.88);text-shadow:0 2px 6px rgba(0,0,0,.6)}
/* home */
.bs-home{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:calc(var(--safe-top) + 4.4rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + 1.2rem) calc(var(--safe-left) + 1rem);
  background:linear-gradient(180deg,rgba(6,8,22,.15) 0%,rgba(6,8,22,0) 30%,rgba(6,8,22,.62) 100%)}
.bs-card{width:min(430px,100%);padding:14px}
.bs-bar{height:10px;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden;box-shadow:inset 0 2px 0 rgba(0,0,0,.25)}
.bs-bar i{display:block;height:100%;border-radius:4px;background:repeating-linear-gradient(90deg,var(--acc) 0 8px,color-mix(in srgb,var(--acc) 75%,#fff) 8px 10px);box-shadow:0 0 12px var(--acc);transition:width .25s}
/* HUD */
.bs-hud{position:absolute;inset:0;pointer-events:none}
.bs-top{position:absolute;left:calc(var(--safe-left) + 10px);right:calc(var(--safe-right) + 64px);top:calc(var(--safe-top) + 8px);display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.bs-chip{padding:6px 10px 7px 7px;display:flex;align-items:center;gap:8px;max-width:min(62vw,330px)}
.bs-badge{display:grid;place-items:center;min-width:36px;height:36px;padding:0 6px;border-radius:9px;background:linear-gradient(180deg,var(--acc),color-mix(in srgb,var(--acc) 55%,#000));font-family:var(--font-pixel),monospace;font-weight:700;font-size:17px;box-shadow:inset 0 2px 0 rgba(255,255,255,.45),inset 0 -3px 0 rgba(0,0,0,.25)}
.bs-meters{display:flex;flex-direction:column;gap:5px;margin-top:6px;width:max-content}
.bs-meter{display:flex;align-items:center;gap:6px;padding:4px 8px 4px 6px;border-radius:10px}
.bs-mbar{position:relative;width:clamp(92px,26vw,160px);height:11px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden;box-shadow:inset 0 2px 0 rgba(0,0,0,.3)}
.bs-mbar i{position:absolute;inset:0 auto 0 0;transition:width .15s linear,background .3s}
.bs-mbar i::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(0,0,0,0) 0 9px,rgba(0,0,0,.25) 9px 10px)}
.bs-low{animation:bs-blink .55s steps(2) infinite}
@keyframes bs-blink{50%{opacity:.3}}
.bs-hearts{display:flex;gap:2px;justify-content:flex-end}
.bs-boss{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 100px);width:min(440px,82vw);padding:7px 10px 9px;text-align:center}
.bs-boss .bs-mbar{width:100%;height:13px}
.bs-powers{position:absolute;right:calc(var(--safe-right) + 10px);top:calc(var(--safe-top) + 92px);display:flex;flex-direction:column;gap:8px}
.bs-power{position:relative;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(10,12,30,.78);box-shadow:0 4px 0 rgba(0,0,0,.4)}
.bs-power svg.ring{position:absolute;inset:-3px;width:48px;height:48px;transform:rotate(-90deg)}
/* touch controls */
.bs-left{position:absolute;left:0;top:22%;bottom:0;width:46%;pointer-events:auto}
.bs-right{position:absolute;right:0;top:18%;bottom:0;width:54%;pointer-events:auto}
.bs-stick{position:absolute;width:130px;height:130px;margin:-65px 0 0 -65px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.08) 55%,rgba(255,255,255,.18) 56%,rgba(255,255,255,.08) 70%);border:2px solid rgba(255,255,255,.28);pointer-events:none}
.bs-knob{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(220,220,240,.7));box-shadow:inset 0 -4px 0 rgba(0,0,0,.18),0 6px 14px rgba(0,0,0,.4)}
.bs-stickhint{position:absolute;left:calc(var(--safe-left) + 34px);bottom:calc(var(--safe-bottom) + 40px);width:110px;height:110px;border-radius:50%;border:2px dashed rgba(255,255,255,.25);display:grid;place-items:center;font-size:11px;font-weight:800;letter-spacing:.1em;opacity:.75;pointer-events:none}
.bs-btns{position:absolute;right:calc(var(--safe-right) + 16px);bottom:calc(var(--safe-bottom) + 22px);width:190px;height:190px;pointer-events:none}
.bs-fire,.bs-jump{position:absolute;pointer-events:auto;display:grid;place-items:center;border-radius:26px;border:2px solid rgba(255,255,255,.35);
  box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -6px 0 rgba(0,0,0,.25),0 7px 0 rgba(0,0,0,.35),0 16px 30px -12px rgba(0,0,0,.6);transition:transform .07s,box-shadow .07s}
.bs-fire{right:0;bottom:0;width:104px;height:104px;background:linear-gradient(180deg,rgba(255,92,92,.72),rgba(200,30,60,.6))}
.bs-jump{left:6px;bottom:24px;width:70px;height:70px;border-radius:20px;background:linear-gradient(180deg,rgba(124,245,255,.55),rgba(46,155,255,.45))}
.bs-fire.on,.bs-jump.on{transform:translateY(5px) scale(.96);box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -3px 0 rgba(0,0,0,.25),0 2px 0 rgba(0,0,0,.35)}
.bs-fire small,.bs-jump small{position:absolute;bottom:7px;font-weight:900;font-size:10px;letter-spacing:.14em;opacity:.9}
.bs-keys{position:absolute;bottom:calc(var(--safe-bottom) + 12px);left:50%;transform:translateX(-50%);font-size:12.5px;font-weight:800;opacity:.85;white-space:nowrap;padding:6px 12px;border-radius:12px}
/* centre messages */
/* the animated messages sit in static full-width rows (their own transform belongs to the animation) */
.bs-wrap{position:absolute;left:0;right:0;display:flex;justify-content:center;pointer-events:none;padding:0 12px}
.bs-popwrap{top:31%;transform:translateY(-50%);z-index:9}.bs-streakwrap{top:44%;z-index:9}.bs-toastwrap{top:calc(var(--safe-top) + 150px);z-index:12}.bs-clearwrap{top:13%;z-index:10}
.bs-pop{text-align:center;pointer-events:none;white-space:nowrap}
.bs-big{font-family:var(--font-pixel),monospace;font-weight:700;font-size:clamp(38px,11vw,80px);line-height:.95;color:#fff;
  text-shadow:2px 2px 0 #14102a,-2px -2px 0 #14102a,2px -2px 0 #14102a,-2px 2px 0 #14102a,4px 5px 0 rgba(0,0,0,.45)}
.bs-sub{margin-top:8px;font-weight:800;font-size:15px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7)}
.bs-intro{position:absolute;left:0;right:0;top:calc(var(--safe-top) + 17%);text-align:center;pointer-events:none;padding:0 16px;z-index:8}
.bs-kicker{display:inline-block;padding:6px 14px;border-radius:9px;background:var(--acc);color:#120e26;font-weight:900;font-size:13px;letter-spacing:.14em;text-transform:uppercase;box-shadow:inset 0 2px 0 rgba(255,255,255,.5),0 4px 0 rgba(0,0,0,.35)}
.bs-goal{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:7px 13px;border-radius:11px;font-weight:800;font-size:15px}
.bs-mods{display:flex;gap:6px;justify-content:center;margin-top:8px;flex-wrap:wrap}
.bs-mods span{padding:4px 10px;border-radius:8px;background:rgba(255,90,140,.85);font-weight:900;font-size:12px;letter-spacing:.06em}
.bs-skip{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--safe-bottom) + 26px);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.7;pointer-events:none}
.bs-clear{text-align:center;pointer-events:none;width:min(92vw,520px)}
.bs-stars{display:flex;justify-content:center;gap:10px;margin-top:10px}
.bs-loot{display:flex;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap}
.bs-loot span{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:10px;font-weight:800;font-size:14px}
.bs-fade{position:absolute;inset:0;background:var(--fade);pointer-events:none;z-index:7}
.bs-toast{padding:8px 15px;border-radius:12px;font-weight:800;white-space:nowrap;pointer-events:none;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.bs-streak{font-family:var(--font-pixel),monospace;font-weight:700;font-size:26px;color:#FFD23F;text-shadow:2px 2px 0 #14102a,-2px -2px 0 #14102a,2px -2px 0 #14102a,-2px 2px 0 #14102a;pointer-events:none;white-space:nowrap}
/* sheets */
.bs-sheet{position:absolute;inset:auto 0 0 0;max-height:88%;display:flex;flex-direction:column;border-radius:24px 24px 0 0;padding:14px calc(var(--safe-right) + 16px) calc(var(--safe-bottom) + 16px) calc(var(--safe-left) + 16px);
  background:linear-gradient(180deg,#1f2348,#121430);box-shadow:0 -6px 0 rgba(255,255,255,.06),0 -20px 50px -10px rgba(0,0,0,.6);z-index:20}
.bs-grab{width:46px;height:6px;border-radius:3px;background:rgba(255,255,255,.25);margin:0 auto 12px}
.bs-scroll{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;margin:0 -4px;padding:0 4px}
.bs-scroll::-webkit-scrollbar{display:none}
.bs-veil{position:absolute;inset:0;background:rgba(4,5,14,.55);z-index:19}
.bs-tabs{display:flex;gap:6px;margin-bottom:12px}
.bs-tabs button{flex:1;padding:9px 0;border-radius:11px;font-weight:800;background:rgba(255,255,255,.08);color:#fff;border:0;cursor:pointer}
.bs-tabs button.on{background:var(--acc);color:#120e26;box-shadow:inset 0 2px 0 rgba(255,255,255,.45),0 3px 0 rgba(0,0,0,.35)}
.bs-up{display:flex;align-items:center;gap:10px;padding:10px;border-radius:13px;background:rgba(255,255,255,.06);margin-top:8px}
.bs-dots{display:flex;gap:3px;margin-top:5px}
.bs-dots i{width:12px;height:7px;border-radius:2px;background:rgba(255,255,255,.16)}
.bs-dots i.on{background:var(--acc);box-shadow:0 0 8px var(--acc)}
.bs-skins{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
.bs-skin{border-radius:16px;padding:10px;background:rgba(255,255,255,.06);border:2px solid transparent;text-align:center;color:#fff;cursor:pointer}
.bs-skin.sel{border-color:var(--acc);background:rgba(255,255,255,.12)}
.bs-skin canvas{display:block;width:96px;height:120px;margin:0 auto;image-rendering:pixelated}
.bs-worlds{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.bs-world{position:relative;border-radius:16px;overflow:hidden;aspect-ratio:16/11;background:#222;box-shadow:0 4px 0 rgba(0,0,0,.4)}
.bs-world canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}
.bs-world .bs-wl{position:absolute;inset:auto 0 0 0;padding:8px 10px;background:linear-gradient(0deg,rgba(0,0,0,.8),rgba(0,0,0,0));font-weight:800;font-size:14px}
.bs-world.lock{filter:grayscale(.85) brightness(.55)}
.bs-world.now{outline:3px solid var(--acc);outline-offset:-3px}
.bs-toggle{position:relative;width:52px;height:30px;border-radius:9px;background:rgba(255,255,255,.18);border:0;cursor:pointer;flex:none}
.bs-toggle i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:7px;background:#fff;transition:transform .15s}
.bs-toggle.on{background:#3EE08F}.bs-toggle.on i{transform:translateX(22px)}
@media (orientation:landscape) and (max-height:520px){
  .bs-home{padding-top:calc(var(--safe-top) + 3.4rem)}
  .bs-logo .l1{font-size:clamp(34px,9vh,64px)}.bs-logo .l2{font-size:clamp(40px,11vh,76px)}
  .bs-btns{width:170px;height:170px;bottom:calc(var(--safe-bottom) + 14px)}
  .bs-fire{width:92px;height:92px}
  .bs-powers{top:calc(var(--safe-top) + 74px)}
  .bs-boss{top:calc(var(--safe-top) + 64px)}
  .bs-intro{top:calc(var(--safe-top) + 10%)}
}
`;
