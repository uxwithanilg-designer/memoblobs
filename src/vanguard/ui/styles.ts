// Voxel Vanguard's interface: a 2026 pixel-arcade look — panels with stepped pixel corners and hard offset shadows,
// a blocky extruded logo, segmented pixel health bars, neon accents in the world's colour, solid dark capsules (no
// blur, so phones stay smooth), big round thumb buttons with gauges (fire, jetpack with its oil ring, swap, view),
// a floating move stick, banners that slide in for "Stage N started", waves and bosses, and safe areas on every edge.
// Animations are transform / opacity only.
export const VANGUARD_CSS = `
.vv-root{position:absolute;inset:0;overflow:hidden;background:#070914;color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:none}
.vv-root *{box-sizing:border-box}
.vv-stage{position:absolute;inset:0}
.vv-canvas{position:absolute;inset:0;display:block}
.vv-overlay{position:absolute;inset:0;display:block;pointer-events:none}
.vv-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.02em}
.vv-ui{position:absolute;inset:0;pointer-events:none;z-index:5}
.vv-ui > *{pointer-events:auto}
/* pixel panels: stepped corners, a hard drop shadow */
.vv-px{clip-path:polygon(0 6px,6px 6px,6px 0,calc(100% - 6px) 0,calc(100% - 6px) 6px,100% 6px,100% calc(100% - 6px),calc(100% - 6px) calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,6px calc(100% - 6px),0 calc(100% - 6px))}
.vv-cap{background:rgba(10,12,28,.84);border:2px solid rgba(255,255,255,.14)}
.vv-pill{display:inline-flex;align-items:center;gap:.4rem;padding:.32rem .75rem .32rem .4rem;font-weight:800;font-size:15px;line-height:1}
/* buttons */
.vv-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border:0;font-weight:800;cursor:pointer;color:#141426;background:#F2F4FA;box-shadow:0 5px 0 #8A90A8;transition:transform .1s ease,box-shadow .1s ease}
.vv-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #8A90A8}
.vv-btn:focus-visible{outline:3px solid var(--acc);outline-offset:3px}
.vv-cta{color:#fff;background:linear-gradient(180deg,#5CF08A 0%,#22C05A 60%,#169A44 100%);box-shadow:0 6px 0 #0B5A26,0 14px 26px -10px rgba(40,220,110,.7);text-shadow:0 2px 0 rgba(0,60,20,.55)}
.vv-cta:active{box-shadow:0 2px 0 #0B5A26}
.vv-ghost{color:#fff;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 2px rgba(255,255,255,.22),0 4px 0 rgba(0,0,0,.35)}
.vv-ghost:active{box-shadow:inset 0 0 0 2px rgba(255,255,255,.22),0 0 0 rgba(0,0,0,.35)}
.vv-btn:disabled{opacity:.45;cursor:default}
/* the logo: blocky letters with a stepped 3D extrusion */
.vv-logo{display:flex;flex-direction:column;align-items:center;line-height:.86}
.vv-logo span{font-family:var(--font-lilita),sans-serif;letter-spacing:.04em;color:var(--c);text-shadow:2px 2px 0 var(--d),4px 4px 0 var(--d),6px 6px 0 var(--d),8px 8px 0 #0a0818,9px 10px 12px rgba(0,0,0,.45)}
.vv-logo .l1{font-size:clamp(44px,13vw,92px);animation:vv-in .6s steps(6) both}
.vv-logo .l2{font-size:clamp(40px,12vw,84px);animation:vv-in .6s steps(6) .15s both}
@keyframes vv-in{0%{transform:translateY(-40px);opacity:0}100%{transform:none;opacity:1}}
.vv-tag{font-weight:800;font-size:13px;letter-spacing:.24em;text-transform:uppercase;color:rgba(255,255,255,.92);text-shadow:0 2px 0 #000}
/* home */
.vv-home{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:calc(var(--safe-top) + 4.2rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + 1.1rem) calc(var(--safe-left) + 1rem);
  background:linear-gradient(180deg,rgba(5,6,16,.35) 0%,rgba(5,6,16,0) 30%,rgba(5,6,16,0) 45%,rgba(5,6,16,.78) 100%)}
.vv-card{position:relative;width:min(420px,100%);padding:13px 15px 12px;color:#fff;background:#141834;border:2px solid color-mix(in srgb,var(--acc) 60%,transparent)}
.vv-card .vv-strip{position:absolute;left:0;right:0;top:0;height:4px;background:var(--acc)}
.vv-kicker{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;background:var(--acc);color:#0d0b1e;font-weight:900;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase}
.vv-progress{height:8px;background:rgba(255,255,255,.12)}
.vv-progress i{display:block;height:100%;background:repeating-linear-gradient(90deg,var(--acc) 0 6px,color-mix(in srgb,var(--acc) 70%,#000) 6px 8px)}
.vv-bots{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.vv-bot{display:flex;align-items:center;gap:4px;padding:3px 7px 3px 3px;background:rgba(255,255,255,.07);font-size:12px;font-weight:800}
/* HUD */
.vv-hud{position:absolute;inset:0;pointer-events:none}
.vv-hud > *{transition:opacity .4s ease}
.vv-hud.vv-cine > *:not(.vv-keep){opacity:0}
.vv-tl{position:absolute;left:calc(var(--safe-left) + 10px);top:calc(var(--safe-top) + 8px);display:flex;flex-direction:column;gap:6px;width:min(46vw,230px)}
.vv-hp{position:relative;height:16px;padding:2px;background:#0a0b18;border:2px solid rgba(255,255,255,.2)}
.vv-hp i{display:block;height:100%;background:repeating-linear-gradient(90deg,var(--hc) 0 9px,color-mix(in srgb,var(--hc) 70%,#000) 9px 11px);transition:width .15s linear}
.vv-hp b{position:absolute;inset:0;display:grid;place-items:center;font-size:10.5px;font-weight:900;text-shadow:0 1px 0 #000}
.vv-hearts{display:flex;gap:2px}
.vv-mates{display:flex;gap:6px}
.vv-mate{display:flex;align-items:center;gap:4px;padding:2px 6px 2px 2px;font-size:11px;font-weight:800}
.vv-mate .bar{width:34px;height:5px;background:rgba(255,255,255,.15)}
.vv-mate .bar i{display:block;height:100%}
.vv-mate.down{opacity:.5}
.vv-tc{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 8px);display:flex;flex-direction:column;align-items:center;gap:6px}
.vv-wave{display:flex;align-items:center;gap:8px;padding:5px 12px;font-weight:900;font-size:13px;white-space:nowrap}
.vv-wave em{font-style:normal;color:var(--acc)}
.vv-wave .op{display:contents}
@media (max-width:520px){.vv-wave{font-size:12px;padding:5px 9px;gap:5px}.vv-wave .op{display:none}.vv-obj{width:min(58vw,260px)}}
.vv-obj{width:min(74vw,320px);padding:5px 10px 7px;text-align:center;background:rgba(14,16,40,.78)}
.vv-obj .t{font-family:var(--font-lilita),sans-serif;font-size:14px;letter-spacing:.04em;color:var(--oc);line-height:1.15}
.vv-obj .l{font-weight:900;font-size:12px;opacity:.92;line-height:1.3}
.vv-obj .bar{height:6px;background:rgba(255,255,255,.14);margin-top:3px}
.vv-obj .bar i{display:block;height:100%;background:var(--oc);transition:width .25s}
.vv-obj.done{animation:vvPop .5s ease}
@keyframes vvPop{0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)}}
.vv-sectors{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.vv-sec{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;background:rgba(255,255,255,.07);font-size:11px;font-weight:800;opacity:.75}
.vv-sec.now{background:var(--acc);color:#0d0b1e;opacity:1}
.vv-sec.done{opacity:.5;text-decoration:line-through}
.vv-boss{width:min(70vw,340px);padding:5px 8px 7px;text-align:center}
.vv-boss p{font-family:var(--font-lilita),sans-serif;font-size:14px;color:#FF5A7A;letter-spacing:.06em}
.vv-boss .bar{height:10px;background:#2a0a14;margin-top:3px}
.vv-boss .bar i{display:block;height:100%;background:repeating-linear-gradient(90deg,#FF2A5A 0 8px,#C01A40 8px 10px);transition:width .2s}
.vv-tr{position:absolute;right:calc(var(--safe-right) + 64px);top:calc(var(--safe-top) + 8px)}
.vv-powers{display:flex;gap:6px}
.vv-power{position:relative;width:34px;height:34px;display:grid;place-items:center;background:rgba(10,12,28,.84)}
.vv-power svg.ring{position:absolute;inset:0;transform:rotate(-90deg)}
/* thumb controls */
.vv-look{position:absolute;top:0;bottom:0;right:0;width:55%;pointer-events:auto}
.vv-move{position:absolute;top:30%;bottom:0;left:0;width:45%;pointer-events:auto}
.vv-stick{position:absolute;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;border:2px solid rgba(255,255,255,.3);background:rgba(10,12,28,.35);pointer-events:none;transition:opacity .2s}
.vv-stick i{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(circle at 40% 35%,rgba(255,255,255,.85),rgba(200,210,235,.55));box-shadow:0 4px 0 rgba(0,0,0,.35)}
.vv-stick.idle{opacity:.45}
.vv-acts{position:absolute;right:calc(var(--safe-right) + 14px);bottom:calc(var(--safe-bottom) + 16px);width:200px;height:210px;pointer-events:none}
.vv-act{position:absolute;pointer-events:auto;border:0;border-radius:50%;display:grid;place-items:center;color:#fff;cursor:pointer;
  background:radial-gradient(circle at 50% 35%,var(--b1),var(--b2));box-shadow:0 6px 0 rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.35);transition:transform .07s,box-shadow .07s}
.vv-act.on{transform:translateY(5px) scale(.95);box-shadow:0 1px 0 rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.35)}
.vv-act.off{filter:grayscale(.7);opacity:.6}
.vv-act svg.ring{position:absolute;inset:-6px;width:calc(100% + 12px);height:calc(100% + 12px);transform:rotate(-90deg);pointer-events:none}
.vv-act small{position:absolute;bottom:-16px;font-weight:900;font-size:10px;letter-spacing:.12em;white-space:nowrap;text-shadow:0 1px 3px #000}
.vv-fire{right:0;bottom:0;width:96px;height:96px;--b1:#FF7A6A;--b2:#D8203A}
.vv-jet{right:104px;bottom:6px;width:70px;height:70px;--b1:#7CE0FF;--b2:#1E7AD8}
.vv-swap{right:12px;bottom:118px;width:62px;height:62px;--b1:#FFE07A;--b2:#D8A020;color:#2a1a00}
.vv-view{right:88px;bottom:98px;width:46px;height:46px;--b1:#B8B8D8;--b2:#5A5A7A}
.vv-ammo{position:absolute;right:calc(var(--safe-right) + 118px);bottom:calc(var(--safe-bottom) + 92px);font-family:var(--font-lilita),sans-serif;font-size:18px;text-shadow:0 2px 0 #000}
@media (hover:hover) and (pointer:fine){
  .vv-acts{transform:scale(.82);transform-origin:bottom right}
}
.vv-keys{position:absolute;bottom:calc(var(--safe-bottom) + 14px);left:calc(var(--safe-left) + 14px);font-size:12.5px;font-weight:800;opacity:.9;white-space:nowrap;padding:7px 12px}
.vv-aimhint{position:absolute;left:50%;top:58%;transform:translateX(-50%);font-weight:900;font-size:14px;padding:8px 14px;white-space:nowrap}
/* banners */
.vv-banner{position:absolute;left:0;right:0;top:24%;display:flex;flex-direction:column;align-items:center;text-align:center;pointer-events:none;padding:0 12px;z-index:9}
.vv-big{font-family:var(--font-lilita),sans-serif;font-size:clamp(34px,10vw,72px);line-height:.95;color:var(--c,#fff);text-shadow:3px 3px 0 #0a0818,6px 6px 0 rgba(0,0,0,.35)}
.vv-sub{margin-top:8px;font-weight:900;font-size:15px;letter-spacing:.06em;color:#fff;text-shadow:0 2px 0 #000;padding:4px 12px;background:rgba(10,12,28,.7)}
.vv-toast{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--safe-top) + 112px);padding:7px 14px;font-weight:900;white-space:nowrap;z-index:12;pointer-events:none;font-size:14px}
.vv-hurt{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px 20px rgba(255,30,50,.55);opacity:0}
.vv-flash{animation:vv-flash .4s ease-out forwards}
@keyframes vv-flash{0%{opacity:.85}100%{opacity:0}}
.vv-low{animation:vv-low 1s ease-in-out infinite}
@keyframes vv-low{0%,100%{opacity:.35}50%{opacity:.6}}
/* sheets */
.vv-sheet{position:absolute;inset:auto 0 0 0;max-height:88%;display:flex;flex-direction:column;padding:14px calc(var(--safe-right) + 16px) calc(var(--safe-bottom) + 16px) calc(var(--safe-left) + 16px);background:#12152c;border-top:3px solid var(--acc);z-index:20}
@media (min-width:760px){.vv-sheet{width:min(760px,94vw);margin:0 auto}}
.vv-scroll{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;margin:0 -4px;padding:0 4px 4px}
.vv-scroll::-webkit-scrollbar{display:none}
.vv-veil{position:absolute;inset:0;background:rgba(4,5,14,.6);z-index:19}
.vv-tabs{display:flex;gap:6px;margin-bottom:10px}
.vv-tab{flex:1;padding:8px 4px;font-weight:900;font-size:13px;color:#fff;background:rgba(255,255,255,.07);border:2px solid transparent;cursor:pointer}
.vv-tab.on{border-color:var(--acc);background:rgba(255,255,255,.13)}
.vv-item{display:flex;align-items:center;gap:10px;padding:9px 10px;background:rgba(255,255,255,.06);margin-top:8px;border:2px solid transparent}
.vv-item.sel{border-color:var(--acc)}
.vv-dots{display:flex;gap:3px;margin-top:4px}
.vv-dots i{width:12px;height:6px;background:rgba(255,255,255,.18)}
.vv-dots i.on{background:var(--acc)}
.vv-slot{display:inline-grid;place-items:center;min-width:26px;height:22px;padding:0 6px;font-size:11px;font-weight:900;background:var(--acc);color:#0d0b1e}
.vv-worlds{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.vv-world{position:relative;aspect-ratio:16/11;overflow:hidden;background:#222}
.vv-world canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}
.vv-world .lbl{position:absolute;inset:auto 0 0 0;padding:7px 9px;background:linear-gradient(0deg,rgba(0,0,0,.82),rgba(0,0,0,0));font-weight:800;font-size:13.5px}
.vv-world.lock{filter:grayscale(.85) brightness(.55)}
.vv-world.now{outline:3px solid var(--acc);outline-offset:-3px}
@media (orientation:landscape) and (max-height:500px){
  .vv-home{padding:calc(var(--safe-top) + 3.2rem) calc(var(--safe-right) + 1rem) calc(var(--safe-bottom) + .7rem) calc(var(--safe-left) + 1rem);flex-direction:row;align-items:center;justify-content:center;gap:clamp(16px,4vw,48px)}
  .vv-home > div:first-child{flex:none}
  .vv-home > div:last-child{width:min(420px,56vw);gap:8px}
  .vv-home .vv-card{padding:9px 12px}
  .vv-home .vv-short{display:none}
  .vv-home .vv-sectors,.vv-home .vv-bots{display:none}
  .vv-logo .l1{font-size:clamp(34px,10vh,60px)}.vv-logo .l2{font-size:clamp(30px,9vh,54px)}
  .vv-acts{transform:scale(.8);transform-origin:bottom right}
  .vv-banner{top:16%}
  .vv-toast{top:calc(var(--safe-top) + 64px)}
}
`;
