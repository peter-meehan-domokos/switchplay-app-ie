import { expect, test } from "@playwright/test";
import { createLearningConsole } from "../lab/learningConsole";
import { initialRecordedLearning, recordedLearningReducer } from "../activities/roots-factors/recordedLearning";
import { createLearningDeliveryCursor, deliverLearningNotifications } from "../platform/web/learningNotifications";

for (const environment of ["development", "production", "test"]) test(`lab console callback batching in ${environment}`, () => {
  const original = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: environment });
  const labels: string[] = [];
  const objects: unknown[] = [];
  let endings = 0;
  const logger = createLearningConsole({ groupCollapsed: (label) => labels.push(label), log: (record) => objects.push(record), groupEnd: () => endings++ });
  const cursor = createLearningDeliveryCursor();
  try {
    const initial = initialRecordedLearning("console-first");
    deliverLearningNotifications(initial.records, cursor, logger);
    deliverLearningNotifications(initial.records, cursor, logger);
    const started = recordedLearningReducer(initial, { type: "lesson", action: { type: "root", action: { type: "start", sessionId: 1, revision: 0 } } });
    const preview = recordedLearningReducer(started, { type: "lesson", action: { type: "root", action: { type: "preview", sessionId: 1, revision: 0, root: 3.7 } } });
    deliverLearningNotifications(preview.records, cursor, logger);
    const restarted = recordedLearningReducer(preview, { type: "restart", revision: null, nextAttemptId: "console-second", reason: "restart-request" });
    deliverLearningNotifications(restarted.records, cursor, logger);
    const exited = recordedLearningReducer(restarted, { type: "exit", revision: null });
    deliverLearningNotifications(exited.records, cursor, logger);
    if (environment === "development") {
      expect(labels).toEqual([
        "[Step Visuals · Roots and factors · Attempt 1] attempt-started",
        "[Step Visuals · Roots and factors · Attempt 2] attempt-restarted",
        "[Step Visuals · Roots and factors · Attempt 2] attempt-exited",
      ]);
      expect(objects[1]).toMatchObject({ records: { current: { attemptNumber: 2 }, partialAttempts: [{ attemptId: "console-first" }] },
        deliveredEvents: [{ type: "attempt-restarted" }, { type: "attempt-started" }], deliveredCompletions: [] });
      expect(endings).toBe(3);
    } else {
      expect(labels).toEqual([]);
      expect(objects).toEqual([]);
      expect(endings).toBe(0);
    }
  } finally { Object.assign(process.env, { NODE_ENV: original }); }
});
