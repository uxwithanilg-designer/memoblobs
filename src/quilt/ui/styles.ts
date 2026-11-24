// Quiltfold's look: a cosy craft room — warm linen with a woven texture, patches like puffy felt with white running
// stitches, sewn-on number buttons, stitched-edge cards. Different from the clay (Sudoku) and aurora (Trailfold) games.
export const QUILT_CSS = `
.qlt-root{position:absolute;inset:0;overflow:hidden;color:#2d2440;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:
    repeating-linear-gradient(0deg,rgba(120,90,60,.045) 0 2px,transparent 2px 6px),
    repeating-linear-gradient(90deg,rgba(120,90,60,.045) 0 2px,transparent 2px 6px),
    radial-gradient(100% 60% at 0% 0%,#ffe3cf 0%,transparent 60%),radial-gradient(80% 60% at 100% 100%,#dff3ea 0%,transparent 60%),#fbf3e6}
.qlt-root *{box-sizing:border-box}
.qlt-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none}
.qlt-scroll::-webkit-scrollbar{display:none}
.qlt-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.qlt-stitched{position:relative;border-radius:22px;background:#fffaf2;box-shadow:0 14px 30px -18px rgba(90,50,30,.45);border:1px solid #f0e2cd}
.qlt-stitched::before{content:"";position:absolute;inset:6px;border:2px dashed rgba(170,120,80,.32);border-radius:16px;pointer-events:none}
.qlt-sheet{background:#fffaf2!important}
.qlt-grad{background:linear-gradient(100deg,#ff8a5b,#e8456b 50%,#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent}
.qlt-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.qlt-btn:active{transform:translateY(2px) scale(.98)}
.qlt-cta{color:#fff;background:linear-gradient(180deg,#ff8a5b,#e8456b);box-shadow:0 6px 0 #b8304f,0 14px 24px -12px #e8456b}
.qlt-cta:active{box-shadow:0 2px 0 #b8304f}
.qlt-host{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;touch-action:none}
.qlt-board{touch-action:none;border-radius:24px;background:#f3e6d3;box-shadow:inset 0 0 0 2px #e6d3b8,0 26px 50px -26px rgba(90,50,30,.55)}
.qlt-cell{fill:#fffaf1;stroke:rgba(170,120,80,.28);stroke-width:1;stroke-dasharray:3 3}
.qlt-gap{fill:#e3d2bb;stroke:rgba(120,80,50,.35);stroke-width:1.5;stroke-dasharray:4 3}
.qlt-patch{animation:qlt-drop .28s cubic-bezier(.3,1.5,.5,1) both;transform-box:fill-box;transform-origin:center}
@keyframes qlt-drop{0%{transform:scale(.86);opacity:.4}100%{transform:scale(1);opacity:1}}
.qlt-patch.qlt-good rect:first-child{filter:drop-shadow(0 3px 3px rgba(90,40,30,.25))}
.qlt-patch.qlt-bad rect:first-child{fill:#c9bcd6!important}
.qlt-patch.qlt-open rect:first-child{fill:#cfc6db!important}
.qlt-badfill{pointer-events:none}
.qlt-fence{stroke:#6b3f1f;stroke-linecap:round;stroke-dasharray:1 0;filter:drop-shadow(0 1px 0 #fff)}
.qlt-num{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;pointer-events:none}
.qlt-button{pointer-events:none}
.qlt-preview rect{fill:rgba(255,255,255,.35);stroke:#2d2440;stroke-width:2.5;stroke-dasharray:7 5;animation:qlt-ants .6s linear infinite}
.qlt-preview text{fill:#2d2440;font-family:var(--font-lilita),sans-serif;opacity:.75}
@keyframes qlt-ants{to{stroke-dashoffset:-24}}
.qlt-flash{fill:none;stroke:#ffd23d;stroke-width:5;animation:qlt-flash 1.4s ease both}
@keyframes qlt-flash{0%,60%{opacity:1}100%{opacity:0}}
.qlt-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:#5c4b6e}
.qlt-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:48px;border-radius:18px;background:#fffaf2;border:1px solid #f0e2cd;box-shadow:0 5px 0 #ead6bb}
.qlt-tool:active .qlt-tool-ico{transform:translateY(3px);box-shadow:0 2px 0 #ead6bb}
.qlt-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:#e8456b;color:#fff;font-size:10px;font-weight:900;display:grid;place-items:center}
.qlt-shine{position:relative;overflow:hidden}
.qlt-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.4) 50%,transparent 60%);animation:qlt-sweep 3.4s ease-in-out infinite}
@keyframes qlt-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.qlt-patch,.qlt-shine::after,.qlt-preview rect{animation:none}}
`;
