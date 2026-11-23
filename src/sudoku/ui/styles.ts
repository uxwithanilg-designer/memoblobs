// Sudoku Ninefold's own look: night-violet room with drifting clay blobs, coloured clay trays, cream clay tiles that press in
// when tapped, chunky Lilita numbers, and the wave / shake / pop animations.
export const SUDOKU_CSS = `
.cdk-root{position:absolute;inset:0;overflow:hidden;background:radial-gradient(120% 80% at 50% -10%,#3a1f78 0%,#1b0f3c 45%,#110828 100%);color:#fff;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none}
.cdk-root *{box-sizing:border-box}
.cdk-blob{position:absolute;border-radius:50%;filter:blur(40px);opacity:.38;animation:cdk-drift 18s ease-in-out infinite alternate;pointer-events:none}
@keyframes cdk-drift{0%{transform:translate(0,0) scale(1)}100%{transform:translate(40px,-30px) scale(1.15)}}
.cdk-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.cdk-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.cdk-clay-text{color:#FFF4E2;text-shadow:0 2px 0 #f0b45a,0 4px 0 #d9822b,0 6px 0 #a8501b,0 10px 18px rgba(0,0,0,.45)}
.cdk-card{border-radius:22px;background:linear-gradient(160deg,rgba(255,255,255,.10),rgba(255,255,255,.03));box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 18px 40px -22px rgba(0,0,0,.8);border:1px solid rgba(255,255,255,.08)}
.cdk-sheet{background:linear-gradient(180deg,#2e1b60,#1d1142)!important}
.cdk-btn{border-radius:999px;font-weight:800;transition:transform .12s ease,filter .12s ease;box-shadow:0 5px 0 rgba(0,0,0,.28),inset 0 2px 0 rgba(255,255,255,.35)}
.cdk-btn:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.28),inset 0 2px 0 rgba(255,255,255,.35)}
.cdk-board-host{position:relative;width:100%;height:100%;display:flex;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch}
.cdk-tray{position:relative;flex:none;border-radius:26px;background:linear-gradient(155deg,var(--c1),var(--c2));box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -6px 0 rgba(0,0,0,.18),0 26px 60px -26px rgba(0,0,0,.9)}
.cdk-tray-open{background:none!important;box-shadow:none!important}
.cdk-subtray{position:absolute;border-radius:22px}
.cdk-tile{position:absolute;padding:0;border:0;background:transparent;cursor:pointer;touch-action:manipulation}
.cdk-face{position:absolute;inset:1.5px;border-radius:24%;display:flex;align-items:center;justify-content:center;font-family:var(--font-lilita),var(--font-fredoka),sans-serif;line-height:1;background:linear-gradient(180deg,#fffaf2,#f6e6cf);color:#3a2a5c;box-shadow:inset 0 -3px 0 rgba(150,105,60,.22),0 2px 2px rgba(60,20,40,.18);transition:background .15s ease,color .15s ease,transform .12s ease}
.cdk-given .cdk-face{background:linear-gradient(180deg,#f3dfc0,#e6c79c);color:#3b2350}
.cdk-user .cdk-face{color:var(--c2);background:linear-gradient(180deg,#ffffff,#f4ecff)}
.cdk-empty .cdk-face{background:linear-gradient(180deg,#fff7ea,#f3e2c8)}
.cdk-peer .cdk-face{background:linear-gradient(180deg,#fff1dc,#eedcc0);filter:brightness(.96) saturate(1.1);box-shadow:inset 0 0 0 999px color-mix(in srgb,var(--c1) 16%,transparent),inset 0 -3px 0 rgba(150,105,60,.22)}
.cdk-same .cdk-face{box-shadow:inset 0 0 0 999px color-mix(in srgb,var(--c1) 38%,transparent),inset 0 -3px 0 rgba(0,0,0,.12)}
.cdk-sel .cdk-face{background:linear-gradient(180deg,#ffffff,#ffe9b8);box-shadow:0 0 0 2.5px #fff,0 0 0 5px var(--c2),0 6px 14px rgba(0,0,0,.35);transform:scale(1.06);z-index:2}
.cdk-sel{z-index:2}
.cdk-wrong .cdk-face{color:#e11d48;background:linear-gradient(180deg,#ffe4ea,#ffc9d4)}
.cdk-notes{display:grid;width:86%;height:86%;align-items:center;justify-items:center;color:#7a6a92;font-family:var(--font-fredoka),sans-serif;font-weight:700}
.cdk-overlay{position:absolute;left:0;top:0;pointer-events:none;z-index:3}
@keyframes cdk-wave{0%{transform:scale(1)}35%{transform:scale(1.22) rotate(-4deg);background:linear-gradient(180deg,#fff,#fff3a8);color:#c2410c}100%{transform:scale(1)}}
@keyframes cdk-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
.cdk-key{position:relative;border-radius:16px;font-family:var(--font-lilita),var(--font-fredoka),sans-serif;color:#3a2a5c;background:linear-gradient(180deg,#fffaf2,#f1dcbd);box-shadow:inset 0 -4px 0 rgba(150,105,60,.3),0 4px 0 rgba(0,0,0,.3);transition:transform .1s ease}
.cdk-key:active{transform:translateY(3px);box-shadow:inset 0 -2px 0 rgba(150,105,60,.3),0 1px 0 rgba(0,0,0,.3)}
.cdk-key[disabled]{opacity:.28}
.cdk-key-notes{background:linear-gradient(180deg,#efe6ff,#d9c8ff);color:#5b3fb0}
.cdk-tool{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;font-weight:800;color:rgba(255,255,255,.82)}
.cdk-tool-ico{position:relative;display:grid;place-items:center;width:46px;height:46px;border-radius:16px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.cdk-tool-on .cdk-tool-ico{background:linear-gradient(180deg,#ffd36b,#ff9f2e);color:#3b1d00;border-color:transparent}
.cdk-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:#ff5c7a;color:#fff;font-size:10px;font-weight:900;display:grid;place-items:center}
.cdk-shine{position:relative;overflow:hidden}
.cdk-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.28) 50%,transparent 60%);animation:cdk-shine 3.6s ease-in-out infinite}
@keyframes cdk-shine{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
@keyframes cdk-pop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}
.cdk-pop{animation:cdk-pop .5s cubic-bezier(.3,1.5,.5,1) both}
.cdk-mini-grid{display:grid;gap:2px;padding:6px;border-radius:12px;background:rgba(255,255,255,.22)}
.cdk-mini-grid>span{border-radius:3px;background:rgba(255,255,255,.75)}
.cdk-hide-scroll::-webkit-scrollbar{display:none}
.cdk-hide-scroll{scrollbar-width:none}
@media (prefers-reduced-motion:reduce){.cdk-blob,.cdk-shine::after{animation:none}}
`;
