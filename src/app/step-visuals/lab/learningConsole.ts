import type { Card1LearningCallbacks, Card1LearningEvent, Card1LearningResult, Card1SessionRecords } from "../activities/roots-factors/learningRecords";

/** Lab-only callback consumer. The delivery adapter sends events/results before the snapshot,
 * and exit after it; the snapshot therefore closes one accepted-action notification batch. */
export const createLearningConsole = (output: Pick<Console, "groupCollapsed" | "log" | "groupEnd"> = console): Card1LearningCallbacks & { onExit: () => void } => {
  let events: Card1LearningEvent[] = [];
  let completions: Card1LearningResult[] = [];
  let previous: Card1SessionRecords | null = null;
  return {
    onEvent(event) {
      if (process.env.NODE_ENV === "development") events.push(event);
    },
    onComplete(result) {
      if (process.env.NODE_ENV === "development") completions.push(result);
    },
    onRecordsChange(records) {
      if (process.env.NODE_ENV !== "development" || previous === records) return;
      previous = records;
      const deliveredEvents = events;
      const deliveredCompletions = completions;
      events = [];
      completions = [];
      // One action can emit several events (for example Check also completes the attempt).
      const trigger = deliveredEvents.find((event) => event.type === "attempt-restarted")
        ?? deliveredEvents.find((event) => event.type === "answer-checked")
        ?? deliveredEvents.find((event) => event.type === "prediction-tested")
        ?? deliveredEvents[0];
      output.groupCollapsed(`[Step Visuals · Roots and factors · Attempt ${records.current.attemptNumber}] ${trigger?.type ?? "session-snapshot"}`);
      try { output.log({ records, deliveredEvents, deliveredCompletions }); }
      finally { output.groupEnd(); }
    },
    onExit() {
      // The exit event and final snapshot have already been logged. No second exit log.
      events = [];
      completions = [];
    },
  };
};
