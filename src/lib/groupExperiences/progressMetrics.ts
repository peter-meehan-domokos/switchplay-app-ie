import { progressObservationState } from "../frameworks/progressState";
import type { ProgressCoverage } from "../frameworks/scope";
import { getConfidenceScore } from "../signals";
import type { LearningFields } from "../cards/learning";

export type ProgressLearning = { cards: ReadonlyMap<string, LearningFields>; issues: readonly { code: string }[] };
export function scopedMetrics(ids: readonly string[], coverage: ProgressCoverage, learning: ProgressLearning) {
  const selected = [...new Set(ids)].map(id => learning.cards.get(id));
  const invalid = learning.issues.length > 0 || selected.some(card => !card || !Array.isArray(card.signalReadings)
    || card.signalReadings.some(signal => signal.reading !== null && (typeof signal.reading !== "number" || !Number.isFinite(signal.reading) || signal.reading < 1 || signal.reading > 10)));
  const progress = progressObservationState(selected.flatMap(card => card?.items ?? []), coverage === "outside" ? "outside" : invalid ? "unknown" : coverage);
  const readings = selected.flatMap(card => Array.isArray(card?.signalReadings) ? card.signalReadings.map(signal => signal.reading) : []);
  const confidence = progress.state === "outside" || progress.state === "incomplete" ? null : getConfidenceScore(readings);
  return { ...progress, completedStepCount: progress.eligibleCount === null ? null : selected.flatMap(card => card?.items ?? []).filter(item => item.completionStatus === "done").length, confidence, confidenceReadingCount: progress.state === "outside" || progress.state === "incomplete" ? null : readings.filter(value => value !== null).length };
}
export function scopedCohortMetrics(ids: readonly string[], coverage: ProgressCoverage, followers: readonly ProgressLearning[], extrema: boolean) {
  const combined = new Map<string, LearningFields>();
  // Each player's Card observations remain separate. Card identity is deduped
  // within a scope, never across people; no rounded percentage/mean is an input.
  for (const id of new Set(ids)) combined.set(id, { items: followers.flatMap(person => person.cards.get(id)?.items ?? []),
    signalReadings: followers.flatMap(person => person.cards.get(id)?.signalReadings ?? []) });
  const people = followers.map(person => scopedMetrics(ids, coverage, person));
  const invalid = people.some(person => person.state === "incomplete");
  const total = scopedMetrics(ids, coverage, { cards: combined, issues: invalid ? [{ code: "INCOMPLETE_FOLLOWER_LEARNING" }] : [] });
  const eligible = people.filter(person => person.eligibleCount !== null && person.eligibleCount > 0);
  const scores = people.flatMap(person => person.confidence === null ? [] : [person.confidence]);
  return { ...total, activeTotal: followers.length, eligibleTotal: invalid ? null : eligible.length,
    doing: invalid ? null : people.filter(person => person.state === "inProgress").length,
    done: invalid ? null : people.filter(person => person.isComplete).length,
    ...(extrema ? { confidenceMinimum: invalid || !scores.length ? null : Math.min(...scores),
      confidenceMaximum: invalid || !scores.length ? null : Math.max(...scores) } : {}) };
}
