import { expect, test } from "@playwright/test";
import { startStreamVideoReadinessPolling, type StreamVideoReadinessState } from "@/components/media/useStreamVideoReadiness";
import { StreamVideoReadinessRequestError } from "@/lib/mediaUploadClient";

const target = { scope: "user-card", deckTemplateId: "deck-1", cardId: "card-1" } as const;

test("genuine permission denial remains unavailable and does not retry", async () => {
  const states: StreamVideoReadinessState[] = [], scheduled: number[] = [];
  const stop = startStreamVideoReadinessPolling(target, "denied", state => states.push(state), {
    requestStatus: async () => { throw new StreamVideoReadinessRequestError("MEDIA_OUTSIDE_CONTEXT", false); },
    schedule: (_callback, delay) => { scheduled.push(delay); return 1; },
  });
  await Promise.resolve(); expect(states).toEqual([{ status: "unavailable" }]); expect(scheduled).toEqual([]); stop();
});

test("provider transport failure keeps the existing processing retry and eventual ready state", async () => {
  const states: StreamVideoReadinessState[] = [], callbacks: (() => void)[] = [], delays: number[] = []; let calls = 0;
  const stop = startStreamVideoReadinessPolling(target, "provider-retry", state => states.push(state), {
    requestStatus: async () => { if (++calls === 1) throw new StreamVideoReadinessRequestError("Provider unavailable", true); return { status: "ready" }; },
    schedule: (callback, delay) => { callbacks.push(callback); delays.push(delay); return 1; }, cancelScheduled: () => {},
  });
  await Promise.resolve(); expect(states).toEqual([{ status: "processing" }]); expect(delays).toEqual([3000]);
  callbacks[0](); await Promise.resolve(); expect(states).toEqual([{ status: "processing" }, { status: "ready" }]); stop();
});

test("removing a processing video cancels its scheduled check", async () => {
  const states: StreamVideoReadinessState[] = [];
  const cancelled: number[] = [];
  const signals: AbortSignal[] = [];
  let scheduledDelay: number | null = null;

  const stop = startStreamVideoReadinessPolling(target, "uid-1", (state) => states.push(state), {
    requestStatus: async (_target, _assetId, requestSignal) => {
      signals.push(requestSignal);
      return { status: "processing" };
    },
    schedule: (_callback, delayMs) => {
      scheduledDelay = delayMs;
      return 7;
    },
    cancelScheduled: (timeoutId) => cancelled.push(timeoutId),
  });

  await Promise.resolve();
  expect(states).toEqual([{ status: "processing" }]);
  expect(scheduledDelay).toBe(3_000);

  stop();
  expect(signals[0]?.aborted).toBe(true);
  expect(cancelled).toEqual([7]);
});

test("a removed video ignores a late readiness response and other video polls remain independent", async () => {
  const firstStates: StreamVideoReadinessState[] = [];
  const secondStates: StreamVideoReadinessState[] = [];
  let resolveFirst!: (status: { status: "ready" }) => void;
  const firstSignals: AbortSignal[] = [];

  const stopFirst = startStreamVideoReadinessPolling(target, "uid-1", (state) => firstStates.push(state), {
    requestStatus: (_target, assetId, signal) => {
      expect(assetId).toBe("uid-1");
      firstSignals.push(signal);
      return new Promise((resolve) => { resolveFirst = resolve; });
    },
  });
  const stopSecond = startStreamVideoReadinessPolling(target, "uid-2", (state) => secondStates.push(state), {
    requestStatus: async (_target, assetId) => {
      expect(assetId).toBe("uid-2");
      return { status: "ready" };
    },
  });

  stopFirst();
  resolveFirst({ status: "ready" });
  await Promise.resolve();

  expect(firstSignals[0]?.aborted).toBe(true);
  expect(firstStates).toEqual([]);
  expect(secondStates).toEqual([{ status: "ready" }]);
  stopSecond();
});
