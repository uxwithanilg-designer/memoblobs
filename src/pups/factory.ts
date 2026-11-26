// Stage supply for the UI. Boards build in a few milliseconds, so they're made on the main thread (after a tick, so
// the spinner can paint) and remembered; the next stage is prepared while you play.
import { buildStage, type StageDef } from "./stage";

const made = new Map<number, StageDef>();
export function getStageNow(stage: number): StageDef {
  let d = made.get(stage);
  if (!d) {
    d = buildStage(stage);
    made.set(stage, d);
    if (made.size > 12) made.delete(made.keys().next().value as number);
  }
  return d;
}
export const getStage = (stage: number) => new Promise<StageDef>((ok) => setTimeout(() => ok(getStageNow(stage)), 0));
export const prepareStage = (stage: number) => { setTimeout(() => getStageNow(stage), 400); };
