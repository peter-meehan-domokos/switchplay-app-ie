import { expect, test } from "@playwright/test";
import {
  createIntegrationAttemptId, createIntegrationCursor, deliverIntegrationNotifications,
} from "../activities/integration-area/notifications";
import type {
  IntegrationAttemptV2 as IntegrationAttempt, IntegrationCallbacks, IntegrationEventV2 as IntegrationEvent, IntegrationEventDetail,
  IntegrationRecordsV2 as IntegrationRecords, IntegrationResultV2 as IntegrationResult,
} from "../activities/integration-area/records";
import { immutable } from "../core/immutable";
import type { LegacyIntegrationAttempt, LegacyIntegrationRecords, LegacyIntegrationResult } from "../activities/integration-area/records";

test("legacy six-stage payloads retain their original version and completion delivery", () => {
  const attempt: LegacyIntegrationAttempt = { schemaVersion: 1, activityVersion: 1, activityId: "integration-area", attemptId: "legacy", attemptNumber: 1, stage: 6, status: "in-progress", region: { top: "upper", bottom: "parabola", a: 1, b: 2 }, predictions: [], checks: [], assistanceRequested: false, successMode: null };
  const result: LegacyIntegrationResult = { ...attempt, status: "completed", successMode: "independent", area: 5 };
  const envelope = { schemaVersion: 1 as const, activityVersion: 1 as const, activityId: "integration-area" as const, attemptId: "legacy", attemptNumber: 1, stage: 6 as const };
  const records: LegacyIntegrationRecords = { current: result, events: [{ ...envelope, type: "attempt-started", eventId: "legacy:1", sequence: 1 }, { ...envelope, type: "attempt-completed", eventId: "legacy:2", sequence: 2, result }], completedAttempts: [result], partialAttempts: [], exited: false };
  const cursor = createIntegrationCursor(), results: unknown[] = [];
  const callbacks = { onComplete: (value: unknown) => results.push(value) };
  deliverIntegrationNotifications(records, cursor, callbacks); deliverIntegrationNotifications(records, cursor, callbacks);
  expect(results).toEqual([result]); expect(result.schemaVersion).toBe(1);
});

const attempt = (attemptId: string, attemptNumber: number): IntegrationAttempt => ({
  schemaVersion: 2, activityVersion: 2, activityId: "integration-area", attemptId, attemptNumber,
  stage: 7, stageId: "calculate-area", status: "in-progress", region: { curves: ["upper", "parabola"], a: 1, b: 2 },
  predictions: [], checks: [], assistanceRequested: false, successMode: null,
});

const fixture = () => {
  const first = attempt("first", 1);
  const result: IntegrationResult = {
    ...first, status: "completed", successMode: "independent", area: 5, outcome: "correct",
    finalCalculation: { number: 1, region: first.region, submitted: 5, expected: 5, correct: true, assisted: false, problemRevision: 0, answerRevision: 1 },
    checks: [{ number: 1, region: first.region, submitted: 5, expected: 5, correct: true, assisted: false, problemRevision: 0, answerRevision: 1 }],
  };
  const second: IntegrationAttempt = { ...attempt("second", 2), status: "exited" };
  const details: readonly Readonly<{ attempt: IntegrationAttempt; detail: IntegrationEventDetail }>[] = [
    { attempt: first, detail: { type: "attempt-started" } },
    { attempt: result, detail: { type: "attempt-completed", result } },
    { attempt: result, detail: { type: "attempt-restarted", nextAttemptId: "second" } },
    { attempt: second, detail: { type: "attempt-started" } },
    { attempt: second, detail: { type: "attempt-exited" } },
  ];
  const events: IntegrationEvent[] = details.map(({ attempt: owner, detail }, index) => ({
    schemaVersion: 2, activityVersion: 2, activityId: "integration-area", attemptId: owner.attemptId,
    attemptNumber: owner.attemptNumber, eventId: `${owner.attemptId}:${index + 1}`, sequence: index + 1,
    stage: owner.stage, stageId: owner.stageId, ...detail,
  }));
  const records: IntegrationRecords = { current: second, events, completedAttempts: [result], partialAttempts: [second], exited: true };
  return immutable(records);
};

test("integration delivers the archived completion at its event, then snapshot before exit", () => {
  const records = fixture();
  const cursor = createIntegrationCursor();
  const order: string[] = [];
  const completed: import("../activities/integration-area/records").IntegrationResult[] = [];
  const callbacks = {
    onEvent: (event: import("../activities/integration-area/records").IntegrationEvent) => order.push(event.type),
    onComplete: (result: import("../activities/integration-area/records").IntegrationResult) => { completed.push(result); order.push("complete"); },
    onRecordsChange: (snapshot: import("../activities/integration-area/records").IntegrationRecords) => { expect(snapshot).toBe(records); order.push("snapshot"); },
    onExit: () => order.push("exit"),
  };
  deliverIntegrationNotifications(records, cursor, callbacks);
  expect(order).toEqual([
    "attempt-started", "attempt-completed", "complete", "attempt-restarted", "attempt-started",
    "attempt-exited", "snapshot", "exit",
  ]);
  expect(completed).toEqual([records.completedAttempts[0]]);
  expect(completed[0].attemptId).toBe("first");
  expect(records.current.attemptId).toBe("second");
  const deliveryCount = order.length;
  // Effect replay and changed callback identities use the same mounted-session cursor.
  deliverIntegrationNotifications(records, cursor, callbacks);
  deliverIntegrationNotifications(records, cursor, { ...callbacks });
  expect(order).toHaveLength(deliveryCount);
});

test("integration reentrant callbacks cannot duplicate any delivery", () => {
  const records = fixture();
  const cursor = createIntegrationCursor();
  const calls = { events: 0, completions: 0, snapshots: 0, exits: 0 };
  const recurse = () => deliverIntegrationNotifications(records, cursor, callbacks);
  const callbacks = {
    onEvent: () => { calls.events++; recurse(); },
    onComplete: () => { calls.completions++; recurse(); },
    onRecordsChange: () => { calls.snapshots++; recurse(); },
    onExit: () => { calls.exits++; recurse(); },
  };
  recurse();
  expect(calls).toEqual({ events: 5, completions: 1, snapshots: 1, exits: 1 });
  expect(cursor.delivering).toBe(false);
});

test("integration late subscribers inspect archives without replaying old events or completion", () => {
  const records = fixture();
  const cursor = createIntegrationCursor();
  deliverIntegrationNotifications(records, cursor, {});
  const events: import("../activities/integration-area/records").IntegrationEvent[] = [];
  const results: import("../activities/integration-area/records").IntegrationResult[] = [];
  const snapshots: import("../activities/integration-area/records").IntegrationRecords[] = [];
  let exits = 0;
  const callbacks = {
    onEvent: (value: import("../activities/integration-area/records").IntegrationEvent) => events.push(value),
    onComplete: (value: import("../activities/integration-area/records").IntegrationResult) => results.push(value),
    onRecordsChange: (value: import("../activities/integration-area/records").IntegrationRecords) => snapshots.push(value),
    onExit: () => { exits++; },
  };
  deliverIntegrationNotifications(records, cursor, callbacks);
  expect(events).toEqual([]);
  expect(results).toEqual([]);
  expect(exits).toBe(0);
  expect(snapshots).toEqual([records]);
  expect(snapshots[0].completedAttempts[0].area).toBe(5);
  // Detaching and reattaching the snapshot subscriber makes the latest archive available again.
  deliverIntegrationNotifications(records, cursor, {});
  deliverIntegrationNotifications(records, cursor, callbacks);
  expect(snapshots).toEqual([records, records]);
});

test("integration late event and completion subscribers receive subsequent facts", () => {
  const records = fixture();
  const cursor = createIntegrationCursor();
  const initial: IntegrationRecords = { ...records, events: records.events.slice(0, 1), completedAttempts: [], exited: false };
  deliverIntegrationNotifications(initial, cursor, {});
  const events: import("../activities/integration-area/records").IntegrationEvent[] = [];
  const results: import("../activities/integration-area/records").IntegrationResult[] = [];
  const callbacks: IntegrationCallbacks = {
    onEvent: (event) => events.push(event), onComplete: (result) => results.push(result),
  };
  deliverIntegrationNotifications(records, cursor, callbacks);
  expect(events).toEqual(records.events.slice(1));
  expect(results).toEqual(records.completedAttempts);
});

test("integration throwing host callbacks leave accepted evidence intact and continue delivery", () => {
  const records = fixture();
  const originalRecords = JSON.stringify(records);
  const cursor = createIntegrationCursor();
  const reached: string[] = [];
  const reported: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { reported.push(args); };
  const fail = (label: string) => { reached.push(label); throw new Error(`Host ${label} failure`); };
  const callbacks = {
    onEvent: () => fail("event"), onComplete: () => fail("complete"),
    onRecordsChange: () => fail("snapshot"), onExit: () => fail("exit"),
  };
  try {
    expect(() => deliverIntegrationNotifications(records, cursor, callbacks)).not.toThrow();
    deliverIntegrationNotifications(records, cursor, callbacks);
  } finally { console.error = originalError; }
  expect(reached).toEqual(["event", "event", "complete", "event", "event", "event", "snapshot", "exit"]);
  expect(reported).toHaveLength(8);
  expect(cursor.delivering).toBe(false);
  expect(JSON.stringify(records)).toBe(originalRecords);
});

test("integration attempt identities are opaque and unique", () => {
  const ids = Array.from({ length: 100 }, createIntegrationAttemptId);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((id) => /^[0-9a-f-]{32,36}$/i.test(id))).toBe(true);
});
