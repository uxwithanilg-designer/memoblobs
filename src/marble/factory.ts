// Stage supply for the UI: a worker builds stages (main-thread fallback), results are remembered, and the stage after
// the one you're playing is always built ahead, so "next stage" is instant.
import type { StageDef } from "./stage";

let worker: Worker | null = null, broken = false, nextId = 0;
const waits = new Map<number, { ok: (d: StageDef) => void; fail: (e: Error) => void }>();

function ask(stage: number): Promise<StageDef> {
  return new Promise((ok, fail) => {
    try {
      if (!worker) {
        worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (m: MessageEvent<{ id: number; def?: StageDef; error?: string }>) => {
          const w = waits.get(m.data.id);
          if (!w) return;
          waits.delete(m.data.id);
          if (m.data.error || !m.data.def) w.fail(new Error(m.data.error ?? "worker")); else w.ok(m.data.def);
        };
        worker.onerror = () => { broken = true; for (const w of waits.values()) w.fail(new Error("worker")); waits.clear(); worker = null; };
      }
      const id = ++nextId;
      waits.set(id, { ok, fail });
      worker.postMessage({ id, stage });
    } catch (e) { broken = true; fail(e as Error); }
  });
}

async function onMain(stage: number): Promise<StageDef> {
  const { buildStage } = await import("./stage");
  await new Promise((r) => setTimeout(r, 0));
  return buildStage(stage);
}

const made = new Map<number, Promise<StageDef>>();
export function getStage(stage: number): Promise<StageDef> {
  let p = made.get(stage);
  if (!p) {
    p = broken ? onMain(stage) : ask(stage).catch(() => onMain(stage));
    p.catch(() => made.delete(stage));
    made.set(stage, p);
    if (made.size > 12) made.delete(made.keys().next().value as number);
  }
  return p;
}
export const prepareStage = (stage: number) => { void getStage(stage).catch(() => {}); };
