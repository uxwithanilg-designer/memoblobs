"use client";
// The Bubble Breeze title, in light 2D: chunky glossy letters, each in a bubble colour with a white highlight and a
// soft outline, drop in one by one and then bob on a breeze wave; glossy bubbles drift around them. A tap makes the
// letters hop. Pure CSS animation, no canvas.
import { useState } from "react";

const TOP = "BUBBLE", WORD = "BREEZE";
const COLS = ["#ff3b4e", "#ffcc1f", "#2fa4ff", "#3bd14f", "#a64dff", "#ff8a1f"];

export function Title() {
  const [hop, setHop] = useState(0);
  return (
    <div className="brz-title" role="img" aria-label="Bubble Breeze" onPointerDown={() => setHop((h) => h + 1)}>
      {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className="brz-tbub" style={{ ["--c" as string]: COLS[i], left: `${[4, 14, 82, 92, 24, 72][i]}%`, top: `${[18, 70, 12, 62, 4, 80][i]}%`, width: `${[34, 22, 30, 24, 18, 20][i]}px`, height: `${[34, 22, 30, 24, 18, 20][i]}px`, animationDelay: `${i * 0.4}s` }} />)}
      {[TOP, WORD].map((w, line) => (
        <div key={w} className={line ? "brz-tl2" : "brz-tl1"}>
          {[...w].map((ch, i) => (
            <span key={`${i}-${hop}`} className={`brz-letter ${hop ? "brz-hop" : ""}`} style={{ ["--c" as string]: COLS[(i + line * 3) % COLS.length], animationDelay: `${(line ? 0.35 : 0) + i * 0.07}s, ${1 + i * 0.12}s` }}>{ch}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
