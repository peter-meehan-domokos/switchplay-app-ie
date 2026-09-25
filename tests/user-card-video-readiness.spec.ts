import { expect, test } from "@playwright/test";
import { startStreamVideoReadinessPolling, type StreamVideoReadinessState } from "@/components/media/useStreamVideoReadiness";

const target = { scope: "user-card", deckTemplateId: "deck-1", cardId: "card-1" } as const;

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
