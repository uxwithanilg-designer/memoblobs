// Trailfold's look: a bright aurora room (peach, lilac, sky) with frosted glass panels, soft white tiles, navy stops
// and a glowing ribbon for the line — light and airy, the opposite of the clay games.
export const TRAIL_CSS = `
.trl-root{position:absolute;inset:0;overflow:hidden;color:#1c1533;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:radial-gradient(90% 60% at 10% 0%,#ffd9c7 0%,transparent 60%),radial-gradient(80% 60% at 100% 20%,#dcd2ff 0%,transparent 60%),radial-gradient(90% 70% at 50% 110%,#c8f1ff 0%,transparent 60%),#f6f1ff}
.trl-root *{box-sizing:border-box}
.trl-orb{position:absolute;border-radius:50%;filter:blur(50px);opacity:.55;pointer-events:none;animation:trl-float 16s ease-in-out infinite alternate}
@keyframes trl-float{to{transform:translate(30px,-40px) scale(1.12)}}
.trl-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none}
.trl-scroll::-webkit-scrollbar{display:none}
.trl-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.005em}
.trl-grad-text{background:linear-gradient(100deg,#ff7a45,#ff3d7f 40%,#7a4dff 75%,#2fa8ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.trl-glass{background:rgba(255,255,255,.62);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.85);box-shadow:0 18px 40px -24px rgba(60,30,120,.45),inset 0 1px 0 #fff;border-radius:24px}
.trl-btn{border-radius:999px;font-weight:800;transition:transform .12s ease,box-shadow .12s ease}
.trl-btn:active{transform:translateY(2px) scale(.98)}
.trl-cta{color:#fff;background:linear-gradient(100deg,#ff7a45,#ff3d7f);box-shadow:0 10px 24px -10px #ff3d7f}
.trl-host{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;touch-action:none}
.trl-board{touch-action:none;border-radius:26px;background:rgba(255,255,255,.55);box-shadow:0 30px 60px -30px rgba(60,30,120,.55),inset 0 0 0 1px rgba(255,255,255,.9);backdrop-filter:blur(10px)}
.trl-tile{fill:#ffffff;stroke:rgba(60,30,120,.08);stroke-width:1;transition:fill .2s ease}
.trl-tile-on{fill:#fff6f1}
.trl-tile-glow{fill:#fff1a8;animation:trl-blink .8s ease-in-out 3}
@keyframes trl-blink{50%{fill:#ffd36b}}
.trl-line{filter:drop-shadow(0 3px 4px rgba(120,40,90,.25))}
.trl-wall{fill:#2a2244}
.trl-arrow path{fill:#2a2244;opacity:.82}
.trl-ring{fill:#fff;stroke:#2a2244}
.trl-diamond{fill:#2a2244}
.trl-stop-n{fill:#fff;font-family:var(--font-lilita),var(--font-fredoka),sans-serif;pointer-events:none}
.trl-head{fill:#fff;opacity:.95;animation:trl-pulse 1.1s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes trl-pulse{50%{transform:scale(1.35);opacity:.6}}
.trl-bump{fill:none;stroke:#ff3d5a;stroke-width:3;animation:trl-bump .45s ease both}
@keyframes trl-bump{0%{opacity:1}100%{opacity:0}}
.trl-solved .trl-line{animation:trl-shine 1.2s ease}
@keyframes trl-shine{30%{filter:drop-shadow(0 0 14px #fff) brightness(1.3)}}
.trl-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:#4b3f6b}
.trl-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:48px;border-radius:18px;background:rgba(255,255,255,.75);border:1px solid #fff;box-shadow:0 8px 18px -12px rgba(60,30,120,.6)}
.trl-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:#ff3d7f;color:#fff;font-size:10px;font-weight:900;display:grid;place-items:center}
.trl-shine{position:relative;overflow:hidden}
.trl-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.45) 50%,transparent 60%);animation:trl-sweep 3.4s ease-in-out infinite}
@keyframes trl-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
.trl-sheet{background:linear-gradient(180deg,#ffffff,#f6f0ff)!important}
@media (prefers-reduced-motion:reduce){.trl-orb,.trl-shine::after,.trl-head{animation:none}}
`;
