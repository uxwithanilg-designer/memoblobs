// Sproutpop's look: a sunny garden behind a glass greenhouse — the sky, hills and glow tinted by the current garden,
// drifting petals and floating soap bubbles, leafy-green glass panels, glossy bubble buttons.
export const SPROUT_CSS = `
.spp-root{position:absolute;inset:0;overflow:hidden;color:#1f4a2a;font-family:var(--font-fredoka),system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  background:radial-gradient(60% 34% at 50% 6%,rgba(255,255,255,.6),transparent 70%),linear-gradient(180deg,var(--s1),var(--s2) 55%,var(--s3));transition:background 1.2s ease}
.spp-root *{box-sizing:border-box}
.spp-night{color:#e8f0ff}
/* the sun (or moon) glow */
.spp-sun{position:absolute;top:6%;right:12%;width:150px;height:150px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,var(--glow) 0 30%,transparent 70%);opacity:.75;filter:blur(2px);animation:spp-pulse 7s ease-in-out infinite}
@keyframes spp-pulse{50%{transform:scale(1.1);opacity:.6}}
/* rolling hills along the bottom */
.spp-hills{position:absolute;left:-10%;right:-10%;bottom:-6%;height:34%;pointer-events:none;
  background:radial-gradient(60% 70% at 20% 100%,var(--ground) 60%,transparent 61%),radial-gradient(55% 60% at 80% 100%,color-mix(in srgb,var(--ground) 80%,#000) 60%,transparent 61%),radial-gradient(70% 50% at 50% 100%,color-mix(in srgb,var(--ground) 70%,#fff) 60%,transparent 61%);opacity:.85}
/* drifting petals */
.spp-petals{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.spp-petals i{position:absolute;top:-20px;width:10px;height:7px;border-radius:70% 0 70% 0;opacity:.8;animation:spp-fall linear infinite}
@keyframes spp-fall{0%{transform:translate(0,-20px) rotate(var(--r))}50%{transform:translate(40px,55vh) rotate(calc(var(--r) + 180deg))}100%{transform:translate(-10px,110vh) rotate(calc(var(--r) + 360deg))}}
/* floating soap bubbles (home) */
.spp-soap{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.spp-soap i{position:absolute;bottom:-60px;border-radius:50%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.95) 0 8%,rgba(255,255,255,.15) 18%,transparent 55%),conic-gradient(from 40deg,rgba(255,120,200,.35),rgba(120,220,255,.35),rgba(180,255,140,.35),rgba(255,230,120,.35),rgba(255,120,200,.35));
  box-shadow:inset 0 0 8px rgba(255,255,255,.7);animation:spp-rise linear infinite}
@keyframes spp-rise{0%{transform:translate(0,0)}50%{transform:translate(24px,-55vh)}100%{transform:translate(-12px,-115vh)}}
.spp-title3d{position:relative;width:100%;height:clamp(140px,min(48vw,27vh),290px);margin-top:2px;filter:drop-shadow(0 14px 18px rgba(20,90,40,.3))}
.spp-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;z-index:2}
.spp-scroll::-webkit-scrollbar{display:none}
.spp-display{font-family:var(--font-lilita),var(--font-fredoka),sans-serif;letter-spacing:.01em}
.spp-title{font-size:62px;line-height:.92}
@media (min-width:640px){.spp-title{font-size:84px}}
.spp-grad{background:linear-gradient(180deg,#8bf07a,#2fbf5a 55%,#178a3a);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #fff) drop-shadow(0 6px 10px rgba(20,90,40,.3))}
.spp-glass{position:relative;border-radius:22px;background:rgba(255,255,255,.62);border:1px solid rgba(255,255,255,.9);box-shadow:0 10px 24px -14px rgba(20,70,40,.5);backdrop-filter:blur(10px);color:#1f4a2a}
.spp-sheet{border-radius:26px;background:linear-gradient(180deg,#fbfff6,#eefbe8);box-shadow:0 30px 60px -20px rgba(20,60,30,.5);color:#1f4a2a}
.spp-head{background:linear-gradient(140deg,#3fd36b,#3ea8ff);border-bottom-left-radius:50% 18px;border-bottom-right-radius:50% 18px}
.spp-btn{border-radius:999px;font-weight:800;transition:transform .12s ease}
.spp-btn:active{transform:translateY(2px) scale(.98)}
.spp-cta{color:#fff;background:linear-gradient(180deg,#6fe58a,#22b04f);box-shadow:0 4px 0 #148a3a,0 10px 24px -8px rgba(34,176,79,.7)}
.spp-cta:active{box-shadow:0 2px 0 #148a3a}
.spp-soft{color:#1f4a2a;background:rgba(31,74,42,.08)}
.spp-stage{position:absolute;inset:0}
.spp-tool{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:800;color:inherit}
.spp-tool-ico{position:relative;display:grid;place-items:center;width:52px;height:46px;border-radius:18px;background:rgba(255,255,255,.78);border:1px solid #fff;box-shadow:0 4px 0 rgba(40,120,70,.3);color:#1f4a2a}
.spp-tool-on .spp-tool-ico{background:linear-gradient(180deg,#fff7c0,#ffd34a);box-shadow:0 0 0 3px #fff,0 0 18px 4px rgba(255,211,74,.8)}
.spp-badge{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#22b04f;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center}
.spp-float{position:absolute;transform:translate(-50%,-50%);pointer-events:none;font-family:var(--font-lilita),sans-serif;font-size:24px;color:#fff;-webkit-text-stroke:2px #178a3a;paint-order:stroke;animation:spp-pop 1.1s ease-out forwards;z-index:5;white-space:nowrap}
.spp-float-big{font-size:30px;color:#fff3a0;-webkit-text-stroke:2px #e07a00}
@keyframes spp-pop{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.12)}100%{opacity:0;transform:translate(-50%,-170%) scale(1)}}
.spp-sproutpill{display:flex;align-items:center;gap:6px}
.spp-sproutpill .spp-bump{animation:spp-bump .45s ease}
@keyframes spp-bump{40%{transform:scale(1.35)}}
.spp-shots{font-variant-numeric:tabular-nums}
.spp-low{color:#e0283a;animation:spp-blink 1s ease-in-out infinite}
@keyframes spp-blink{50%{opacity:.55}}
.spp-shine{position:relative;overflow:hidden}
.spp-shine::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);animation:spp-sweep 3.6s ease-in-out infinite;pointer-events:none}
@keyframes spp-sweep{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}
.spp-banner{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);pointer-events:none;z-index:6;text-align:center;white-space:nowrap}
@media (prefers-reduced-motion:reduce){.spp-shine::after,.spp-petals i,.spp-soap i,.spp-sun{animation:none}}
`;
