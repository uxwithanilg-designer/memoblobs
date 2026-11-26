// Slide Splash worker: builds stages off the main thread.
import { buildStage } from "./stage";

type Msg = { id: number; stage: number };

self.onmessage = (m: MessageEvent<Msg>) => {
  const d = m.data;
  try {
    (self as unknown as Worker).postMessage({ id: d.id, def: buildStage(d.stage) });
  } catch (e) {
    (self as unknown as Worker).postMessage({ id: d.id, error: String(e) });
  }
};
