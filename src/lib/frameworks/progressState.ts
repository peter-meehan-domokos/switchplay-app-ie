import { isRecord } from "../cards/domain";
import { classifyProgress, getProgressPercentage } from "../progress";
import type { ProgressCoverage } from "./scope";

export type ProgressObservationState = {
  state: "outside" | "incomplete" | "empty" | "skipped" | "unstarted" | "inProgress" | "done";
  observationCount: number | null; eligibleCount: number | null; completion: number | null; isComplete: boolean;
};

// Skipped is neutral, not vacuous completion. A zero denominator alone cannot
// distinguish explicitly skipped work from zero players/Steps or invalid data.
// This foundation does not change the existing Card/Deck rendering consumers.
export function progressObservationState(observations: unknown, coverage: ProgressCoverage = "inside"): ProgressObservationState {
  const unavailable = (state: "outside" | "incomplete"): ProgressObservationState => ({ state, observationCount: null, eligibleCount: null, completion: null, isComplete: false });
  if (coverage === "outside") return unavailable("outside");
  if (coverage === "unknown" || !Array.isArray(observations) || observations.some(step => !isRecord(step)
    || typeof step.completionStatus !== "string" || !["todo", "inProgress", "done", "skipped"].includes(step.completionStatus))) return unavailable("incomplete");
  const classified = classifyProgress(observations);
  return { state: !observations.length ? "empty" : !classified.eligibleCount ? "skipped"
    : classified.isComplete ? "done" : classified.status === "todo" ? "unstarted" : "inProgress",
  observationCount: observations.length, eligibleCount: classified.eligibleCount,
  completion: classified.eligibleCount ? getProgressPercentage(observations) : null, isComplete: classified.isComplete };
}
