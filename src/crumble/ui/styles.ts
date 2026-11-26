// Crumble Crew's interface: a 2026 pixel-heist look — panels with stepped pixel corners and hard offset shadows, a
// blocky extruded logo in orange and teal, segmented pixel health bars, accents in the district's colour, solid dark
// capsules (no blur, so phones stay smooth), big round thumb buttons (USE with its tool, JUMP), a tool bar along the
// bottom with ammo counts (a column on the right on phones), the BOMB button with its kind arrow, the controls tutorial, the loot meter, a flashing ALARM badge, a floating move stick, banners that slide in for
// "… Job started!", each goal, site and the boss with no pages in between, and safe areas on every edge.
// Animations are transform / opacity only.
export const CRUMBLE_CSS = `
.cc-root{position:absolute;inset:0;overflow:hidden;background:#070914;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:none}
.cc-root *{box-sizing:border-box}
.cc-stage{position:absolute;inset:0}
.cc-canvas{position:absolute;inset:0;display:block}
.cc-overlay{position:absolute;inset:0;display:block;pointer-events:none}
.cc-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.02em}
.cc-ui{position:absolute;inset:0;pointer-events:none;z-index:5}
.cc-ui > *{pointer-events:auto}
/* pixel panels: stepped corners, a hard drop shadow */
.cc-px{clip-path:polygon(0 6px,6px 6px,6px 0,calc(100% - 6px) 0,calc(100% - 6px) 6px,100% 6px,100% calc(100% - 6px),calc(100% - 6px) calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,6px calc(100% - 6px),0 calc(100% - 6px))}
.cc-cap{background:rgba(10,12,28,.84);border:2px solid rgba(255,255,255,.14)}
.cc-pill{display:inline-flex;align-items:center;gap:.4rem;padding:.32rem .75rem .32rem .4rem;font-weight:800;font-size:15px;line-height:1}
/* buttons */
.cc-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:0;font-weight:800;cursor:pointer;color:#141426;background:#F2F4FA;box-shadow:0 5px 0 #8A90A8;transition:transform .1s ease,box-shadow .1s ease}
.cc-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #8A90A8}
.cc-btn:focus-visible{outline:3px solid var(--acc);outline-offset:3px}
.cc-cta{color:#fff;background:linear-gradient(180deg,#FFB05A 0%,#FF7A2A 60%,#D8541A 100%);box-shadow:0 6px 0 #8A3010,0 14px 26px -10px rgba(255,130,50,.7);text-shadow:0 2px 0 rgba(90,30,0,.55)}
.cc-cta:active{box-shadow:0 2px 0 #8A3010}
.cc-ghost{color:#fff;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 2px rgba(255,255,255,.22),0 4px 0 rgba(0,0,0,.35)}
.cc-ghost:active{box-shadow:inset 0 0 0 2px rgba(255,255,255,.22),0 0 0 rgba(0,0,0,.35)}
.cc-btn:disabled{opacity:.45;cursor:default}
/* the logo: blocky letters with a stepped 3D extrusion */
.cc-logo{display:flex;flex-direction:column;align-items:center;line-height:.86}
.cc-logo span{font-family:var(--font-lilita),sans-serif;letter-spacing:.04em;color:var(--c);text-shadow:2px 2px 0 var(--d),4px 4px 0 var(--d),6px 6px 0 var(--d),8px 8px 0 #0a0818,9px 10px 12px rgba(0,0,0,.45)}
.cc-logo .l1{font-size:clamp(44px,13vw,92px);animation:cc-in .6s steps(6) both}
.cc-logo .l2{font-size:clamp(40px,12vw,84px);animation:cc-in .6s steps(6) .15s both}
@keyframes cc-in{0%{transform:translateY(-40px);opacity:0}100%{transform:none;opacity:1}}
.cc-tag{font-weight:800;font-size:13px;letter-spacing:.24em;text-transform:uppercase;color:rgba(255,255,255,.92);text-shadow:0 2px 0 #000}
/* home */
.cc-home{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:calc(var(--safe-top) + 4.2rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + 1.1rem) calc(var(--safe-left) + 1rem);
  background:linear-gradient(180deg,rgba(5,6,16,.35) 0%,rgba(5,6,16,0) 30%,rgba(5,6,16,0) 45%,rgba(5,6,16,.78) 100%)}
.cc-card{position:relative;width:min(420px,100%);padding:13px 15px 12px;color:#fff;background:#141834;border:2px solid color-mix(in srgb,var(--acc) 60%,transparent)}
.cc-card .cc-strip{position:absolute;left:0;right:0;top:0;height:4px;background:var(--acc)}
.cc-kicker{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;background:var(--acc);color:#0d0b1e;font-weight:900;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase}
.cc-progress{height:8px;background:rgba(255,255,255,.12)}
.cc-progress i{display:block;height:100%;background:repeating-linear-gradient(90deg,var(--acc) 0 6px,color-mix(in srgb,var(--acc) 70%,#000) 6px 8px)}
.cc-bots{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.cc-bot{display:flex;align-items:center;gap:4px;padding:3px 7px 3px 3px;background:rgba(255,255,255,.07);font-size:12px;font-weight:800}
/* HUD */
.cc-hud{position:absolute;inset:0;pointer-events:none}
.cc-hud > *{transition:opacity .4s ease}
.cc-hud.cc-cine > *:not(.cc-keep){opacity:0}
.cc-tl{position:absolute;left:calc(var(--safe-left) + 10px);top:calc(var(--safe-top) + 8px);display:flex;flex-direction:column;gap:6px;width:min(46vw,230px)}
.cc-hp{position:relative;height:16px;padding:2px;background:#0a0b18;border:2px solid rgba(255,255,255,.2)}
.cc-hp i{display:block;height:100%;background:repeating-linear-gradient(90deg,var(--hc) 0 9px,color-mix(in srgb,var(--hc) 70%,#000) 9px 11px);transition:width .15s linear}
.cc-hp b{position:absolute;inset:0;display:grid;place-items:center;font-size:10.5px;font-weight:900;text-shadow:0 1px 0 #000}
.cc-hearts{display:flex;gap:2px}
.cc-mates{display:flex;gap:6px}
.cc-mate{display:flex;align-items:center;gap:4px;padding:2px 6px 2px 2px;font-size:11px;font-weight:800}
.cc-mate .bar{width:34px;height:5px;background:rgba(255,255,255,.15)}
.cc-mate .bar i{display:block;height:100%}
.cc-mate.down{opacity:.5}
.cc-tc{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 8px);display:flex;flex-direction:column;align-items:center;gap:6px}
.cc-wave{display:flex;align-items:center;gap:8px;padding:5px 12px;font-weight:900;font-size:13px;white-space:nowrap}
.cc-wave em{font-style:normal;color:var(--acc)}
.cc-wave .op{display:contents}
@media (max-width:520px){.cc-wave{font-size:12px;padding:5px 9px;gap:5px}.cc-wave .op{display:none}.cc-obj{width:min(58vw,260px)}}
.cc-obj{width:min(74vw,320px);padding:5px 10px 7px;text-align:center;background:rgba(14,16,40,.78)}
.cc-obj .t{font-family:var(--font-lilita),sans-serif;font-size:14px;letter-spacing:.04em;color:var(--oc);line-height:1.15}
.cc-obj .l{font-weight:900;font-size:12px;opacity:.92;line-height:1.3}
.cc-obj .bar{height:6px;background:rgba(255,255,255,.14);margin-top:3px}
.cc-obj .bar i{display:block;height:100%;background:var(--oc);transition:width .25s}
.cc-obj.done{animation:ccPop .5s ease}
@keyframes ccPop{0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)}}
.cc-sectors{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.cc-sec{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;background:rgba(255,255,255,.07);font-size:11px;font-weight:800;opacity:.75}
.cc-sec.now{background:var(--acc);color:#0d0b1e;opacity:1}
.cc-sec.done{opacity:.5;text-decoration:line-through}
.cc-boss{width:min(70vw,340px);padding:5px 8px 7px;text-align:center}
.cc-boss p{font-family:var(--font-lilita),sans-serif;font-size:14px;color:#FF5A7A;letter-spacing:.06em}
.cc-boss .bar{height:10px;background:#2a0a14;margin-top:3px}
.cc-boss .bar i{display:block;height:100%;background:repeating-linear-gradient(90deg,#FF2A5A 0 8px,#C01A40 8px 10px);transition:width .2s}
.cc-tr{position:absolute;right:calc(var(--safe-right) + 64px);top:calc(var(--safe-top) + 8px)}
.cc-powers{display:flex;gap:6px}
.cc-power{position:relative;width:34px;height:34px;display:grid;place-items:center;background:rgba(10,12,28,.84)}
.cc-power svg.ring{position:absolute;inset:0;transform:rotate(-90deg)}
/* thumb controls */
.cc-look{position:absolute;top:0;bottom:0;right:0;width:55%;pointer-events:auto}
.cc-move{position:absolute;top:30%;bottom:0;left:0;width:45%;pointer-events:auto}
.cc-stick{position:absolute;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;border:2px solid rgba(255,255,255,.3);background:rgba(10,12,28,.35);pointer-events:none;transition:opacity .2s}
.cc-stick i{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(circle at 40% 35%,rgba(255,255,255,.85),rgba(200,210,235,.55));box-shadow:0 4px 0 rgba(0,0,0,.35)}
.cc-stick.idle{opacity:.45}
.cc-acts{position:absolute;right:calc(var(--safe-right) + 14px);bottom:calc(var(--safe-bottom) + 16px);width:200px;height:210px;pointer-events:none}
.cc-act{position:absolute;pointer-events:auto;border:0;border-radius:50%;display:grid;place-items:center;color:#fff;cursor:pointer;
  background:radial-gradient(circle at 50% 35%,var(--b1),var(--b2));box-shadow:0 6px 0 rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.35);transition:transform .07s,box-shadow .07s}
.cc-act.on{transform:translateY(5px) scale(.95);box-shadow:0 1px 0 rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.35)}
.cc-act.off{filter:grayscale(.7);opacity:.6}
.cc-act svg.ring{position:absolute;inset:-6px;width:calc(100% + 12px);height:calc(100% + 12px);transform:rotate(-90deg);pointer-events:none}
.cc-act small{position:absolute;bottom:-16px;font-weight:900;font-size:10px;letter-spacing:.12em;white-space:nowrap;text-shadow:0 1px 3px #000}
.cc-fire{right:0;bottom:0;width:98px;height:98px;--b1:#FFB05A;--b2:#E0541A}
.cc-jet{right:106px;bottom:4px;width:70px;height:70px;--b1:#7CE0FF;--b2:#1E7AD8}
.cc-swap{right:138px;bottom:96px;width:54px;height:54px;--b1:#FFE07A;--b2:#D8A020;color:#2a1a00}
.cc-view{right:84px;bottom:100px;width:44px;height:44px;--b1:#B8B8D8;--b2:#5A5A7A}
/* bombs: the throw button (its colour is the bomb's), the count, the little arrow that changes the kind */
.cc-bomb{right:8px;bottom:116px;width:62px;height:62px;--b2:#2A2D3A}
.cc-bomb .cc-cnt{position:absolute;right:-4px;top:-4px;min-width:22px;height:22px;padding:0 5px;display:grid;place-items:center;border-radius:11px;background:#14102a;border:2px solid #fff;font-size:12px;font-weight:900}
.cc-bombnext{position:absolute;right:64px;bottom:166px;width:30px;height:30px;border-radius:50%;border:2px solid rgba(255,255,255,.7);background:#FFD23F;color:#2a1a00;display:grid;place-items:center;pointer-events:auto;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.4)}
.cc-bombnext:active{transform:translateY(2px)}
/* the ammo count (tap to reload) */
.cc-ammo{position:absolute;right:calc(var(--safe-right) + 118px);bottom:calc(var(--safe-bottom) + 170px);display:flex;flex-direction:column;align-items:center;border:0;background:transparent;color:#fff;font-family:var(--font-lilita),sans-serif;font-size:18px;line-height:1;text-shadow:0 2px 0 #000;pointer-events:auto;cursor:pointer;padding:2px 4px;min-width:54px}
.cc-ammo i{font-style:normal;font-family:var(--font-fredoka),sans-serif;font-weight:900;font-size:8.5px;letter-spacing:.14em;opacity:.75;margin-top:2px}
.cc-ammo i.gold{color:#FFD23F;opacity:1}
.cc-swap small{color:#fff}
.cc-ammo i.r{display:block;width:50px;height:6px;background:rgba(255,255,255,.2);margin:6px 0 2px;opacity:1}
.cc-ammo i.r span{display:block;height:100%;background:#FFD23F}
.cc-pwr{padding:3px 8px;font-weight:900;font-size:11px;color:#FFD23F;letter-spacing:.06em}
@media (hover:hover) and (pointer:fine){
  .cc-acts{transform:scale(.82);transform-origin:bottom right}
}
.cc-keys{position:absolute;bottom:calc(var(--safe-bottom) + 14px);left:calc(var(--safe-left) + 14px);font-size:12.5px;font-weight:800;opacity:.9;white-space:nowrap;padding:7px 12px}
.cc-aimhint{position:absolute;left:50%;top:58%;transform:translateX(-50%);font-weight:900;font-size:14px;padding:8px 14px;white-space:nowrap}
/* the tool bar, the loot meter, the alarm */
.cc-tools{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--safe-bottom) + 10px);display:flex;gap:5px;pointer-events:auto;padding:5px;background:rgba(10,12,28,.8)}
.cc-tool{position:relative;width:50px;height:44px;display:grid;place-items:center;border:2px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);cursor:pointer;color:#fff;padding:0}
.cc-tool.on{border-color:var(--acc);background:rgba(255,255,255,.18);transform:translateY(-3px)}
.cc-tool b{position:absolute;right:2px;bottom:0;font-size:10px;font-weight:900;text-shadow:0 1px 0 #000}
.cc-tool .k,.cc-tool .k2{position:absolute;left:2px;top:1px;font-size:9px;font-weight:900;color:var(--acc)}
.cc-tool .k2{left:auto;right:2px}
.cc-tool.empty{opacity:.45}
.cc-tool.mission{border-color:#FFD23F;animation:cc-gold 1.2s ease-in-out infinite}
@keyframes cc-gold{0%,100%{background:rgba(255,210,63,.1)}50%{background:rgba(255,210,63,.32)}}
.cc-tool.bombslot{border-color:var(--bc);cursor:default}
@media (hover:hover) and (pointer:fine){.cc-tools{bottom:calc(var(--safe-bottom) + 52px)}}
.cc-alarm{padding:4px 10px;font-weight:900;font-size:12px;letter-spacing:.16em;color:#fff;background:#D8203A;animation:cc-blink 1s steps(2) infinite}
@keyframes cc-blink{0%{opacity:1}100%{opacity:.55}}
.cc-loot{display:flex;align-items:center;gap:6px;padding:4px 8px;font-weight:900;font-size:12px}
.cc-loot .bar{width:70px;height:6px;background:rgba(255,255,255,.15)}
.cc-loot .bar i{display:block;height:100%;background:#5CE07A}
.cc-oil{width:86px;height:6px;background:rgba(255,255,255,.14)}
.cc-oil i{display:block;height:100%;background:#FF8A3A}
.cc-radio{position:absolute;left:calc(var(--safe-left) + 10px);bottom:calc(var(--safe-bottom) + 150px);max-width:min(70vw,300px);padding:7px 10px;font-weight:800;font-size:13px;z-index:11;pointer-events:none;display:flex;gap:8px;align-items:center}
@media (max-width:520px){.cc-tool{width:44px;height:36px}.cc-tools{flex-direction:column-reverse;gap:3px;padding:4px;bottom:calc(var(--safe-bottom) + 258px);left:auto;right:calc(var(--safe-right) + 8px);transform:none}.cc-tool.on{transform:translateX(-4px)}}
/* banners */
.cc-banner{position:absolute;left:0;right:0;top:24%;display:flex;flex-direction:column;align-items:center;text-align:center;pointer-events:none;padding:0 12px;z-index:9}
.cc-big{font-family:var(--font-lilita),sans-serif;font-size:clamp(34px,10vw,72px);line-height:.95;color:var(--c,#fff);text-shadow:3px 3px 0 #0a0818,6px 6px 0 rgba(0,0,0,.35)}
.cc-sub{margin-top:8px;font-weight:900;font-size:15px;letter-spacing:.06em;color:#fff;text-shadow:0 2px 0 #000;padding:4px 12px;background:rgba(10,12,28,.7)}
.cc-toast{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 112px);padding:7px 14px;font-weight:900;white-space:nowrap;z-index:12;pointer-events:none;font-size:14px}
.cc-hurt{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px 20px rgba(255,30,50,.55);opacity:0}
.cc-flash{animation:cc-flash .4s ease-out forwards}
@keyframes cc-flash{0%{opacity:.85}100%{opacity:0}}
.cc-low{animation:cc-low 1s ease-in-out infinite}
@keyframes cc-low{0%,100%{opacity:.35}50%{opacity:.6}}
/* sheets */
.cc-sheet{position:absolute;inset:auto 0 0 0;max-height:88%;display:flex;flex-direction:column;padding:14px calc(var(--safe-right) + 16px) calc(var(--safe-bottom) + 16px) calc(var(--safe-left) + 16px);background:#12152c;border-top:3px solid var(--acc);z-index:20}
@media (min-width:760px){.cc-sheet{width:min(760px,94vw);margin:0 auto}}
.cc-scroll{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;margin:0 -4px;padding:0 4px 4px}
.cc-scroll::-webkit-scrollbar{display:none}
.cc-veil{position:absolute;inset:0;background:rgba(4,5,14,.6);z-index:19}
.cc-tabs{display:flex;gap:6px;margin-bottom:10px}
.cc-tab{flex:1;padding:8px 4px;font-weight:900;font-size:13px;color:#fff;background:rgba(255,255,255,.07);border:2px solid transparent;cursor:pointer}
.cc-tab.on{border-color:var(--acc);background:rgba(255,255,255,.13)}
.cc-item{display:flex;align-items:center;gap:10px;padding:9px 10px;background:rgba(255,255,255,.06);margin-top:8px;border:2px solid transparent}
.cc-item.sel{border-color:var(--acc)}
.cc-dots{display:flex;gap:3px;margin-top:4px}
.cc-dots i{width:12px;height:6px;background:rgba(255,255,255,.18)}
.cc-dots i.on{background:var(--acc)}
.cc-item.mission{border-color:rgba(255,210,63,.5)}
.cc-slotbtn{display:inline-grid;place-items:center;width:26px;height:22px;font-size:11px;font-weight:900;color:#fff;background:rgba(255,255,255,.12);border:0;cursor:pointer}
.cc-slotbtn.on{background:var(--acc);color:#0d0b1e}
/* the controls tutorial */
.cc-tut{position:absolute;inset:0;z-index:30;display:grid;place-items:center;padding:calc(var(--safe-top) + 12px) calc(var(--safe-right) + 12px) calc(var(--safe-bottom) + 12px) calc(var(--safe-left) + 12px);background:rgba(4,5,14,.78)}
.cc-tutcard{width:min(520px,100%);max-height:100%;overflow-y:auto;padding:16px 16px 14px;background:#141834;border:2px solid var(--acc);color:#fff}
.cc-tutbody{margin-top:8px;font-size:15px;line-height:1.45}
.cc-tutbody p{margin-top:10px}
.cc-demo{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;padding:14px 8px;background:rgba(255,255,255,.05);margin-top:6px}
.cc-key{display:inline-grid;place-items:center;min-width:40px;height:40px;padding:0 9px;border-radius:7px;background:linear-gradient(180deg,#F4F6FC,#C8CCDA);color:#141426;font-weight:900;font-size:15px;box-shadow:0 4px 0 #6A7088,inset 0 -2px 0 rgba(0,0,0,.12)}
.cc-key.wide{min-width:74px;font-size:13px}
.cc-plus{font-weight:900;opacity:.7}
.cc-pad{display:inline-flex;flex-direction:column;align-items:center;gap:6px}
.cc-pad .dot{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;color:#fff;background:radial-gradient(circle at 50% 35%,var(--b1),color-mix(in srgb,var(--b1) 55%,#000));box-shadow:0 5px 0 rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.35);animation:cc-tap 1.4s ease-in-out infinite}
.cc-pad small{font-weight:900;font-size:10px;letter-spacing:.12em}
@keyframes cc-tap{0%,70%,100%{transform:none}80%{transform:translateY(4px) scale(.94)}}
.cc-gunrow{display:flex;gap:4px}
.cc-gunmock{width:48px;height:36px;display:grid;place-items:center;border:2px solid rgba(255,255,255,.2);background:rgba(10,12,28,.8)}
.cc-gunmock.gold{border-color:#FFD23F;box-shadow:0 0 12px rgba(255,210,63,.6)}
.cc-bombrow{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px;margin-top:10px;font-size:12.5px;font-weight:800}
.cc-bombrow span{display:flex;align-items:center;gap:6px;padding:4px 6px;background:rgba(255,255,255,.06)}
.cc-dotsrow{display:flex;justify-content:center;gap:6px;margin-top:12px}
.cc-dotsrow i{width:9px;height:9px;background:rgba(255,255,255,.2)}
.cc-dotsrow i.on{background:var(--acc)}
.cc-slot{display:inline-grid;place-items:center;min-width:26px;height:22px;padding:0 6px;font-size:11px;font-weight:900;background:var(--acc);color:#0d0b1e}
.cc-worlds{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.cc-world{position:relative;aspect-ratio:16/11;overflow:hidden;background:#222}
.cc-world canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}
.cc-world .lbl{position:absolute;inset:auto 0 0 0;padding:7px 9px;background:linear-gradient(0deg,rgba(0,0,0,.82),rgba(0,0,0,0));font-weight:800;font-size:13.5px}
.cc-world.lock{filter:grayscale(.85) brightness(.55)}
.cc-world.now{outline:3px solid var(--acc);outline-offset:-3px}
@media (orientation:landscape) and (max-height:500px){
  .cc-home{padding:calc(var(--safe-top) + 3.2rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + .7rem) calc(var(--safe-left) + 1rem);flex-direction:row;align-items:center;justify-content:center;gap:clamp(16px,4vw,48px)}
  .cc-home > div:first-child{flex:none}
  .cc-home > div:last-child{width:min(420px,56vw);gap:8px}
  .cc-home .cc-card{padding:9px 12px}
  .cc-home .cc-short{display:none}
  .cc-home .cc-sectors,.cc-home .cc-bots{display:none}
  .cc-logo .l1{font-size:clamp(34px,10vh,60px)}.cc-logo .l2{font-size:clamp(30px,9vh,54px)}
  .cc-acts{transform:scale(.8);transform-origin:bottom right}
  .cc-tools{flex-direction:row;top:auto;right:auto;left:50%;transform:translateX(-50%);bottom:calc(var(--safe-bottom) + 6px)}
  .cc-tool{width:46px;height:38px}
  .cc-tool.on{transform:translateY(-3px)}
  .cc-ammo{bottom:calc(var(--safe-bottom) + 140px)}
  .cc-banner{top:16%}
  .cc-toast{top:calc(var(--safe-top) + 64px)}
}
`;
