import { test, expect } from "@playwright/test";
import { OptimisticSignalManager } from "@/lib/OptimisticSignalManager";
import type { SignalState } from "@/lib/OptimisticSignalManager";

// Helper to simulate the async behavior in tests
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe("OptimisticSignalManager (Serialized per-signal)", () => {
  test("One successful initial null -> number save", async () => {
    let persistedReading: number | null = null;
    let rollbackCalled = false;

    const manager = new OptimisticSignalManager(
      async (cardId, signalId, reading) => {
        persistedReading = reading;
      },
      () => {
        rollbackCalled = true;
      }
    );

    manager.getConfirmedSignal("c1", "s1", null, null);
    manager.setOptimisticReading("c1", "s1", 5);

    // Wait for async queue
    await delay(10);

    expect(persistedReading).toBe(5);
    expect(rollbackCalled).toBe(false);
  });

  test("One failed initial save restoring null", async () => {
    let restoredState: SignalState | null = null;

    const manager = new OptimisticSignalManager(
      async () => {
        throw new Error("API Failed");
      },
      (cardId, signalId, restored) => {
        restoredState = restored;
      }
    );

    manager.getConfirmedSignal("c1", "s1", null, null);
    manager.setOptimisticReading("c1", "s1", 5);

    await delay(10);

    expect(restoredState).toEqual({ reading: null, rawReading: null });
  });

  test("Rapid A -> B adjustments queue and execute in order", async () => {
    const executed: number[] = [];

    const manager = new OptimisticSignalManager(
      async (cardId, signalId, reading) => {
        await delay(20); // API takes time
        executed.push(reading);
      },
      () => {}
    );

    manager.getConfirmedSignal("c1", "s1", null, null);
    manager.setOptimisticReading("c1", "s1", 5); // Req A
    manager.setOptimisticReading("c1", "s1", 7); // Req B (queued)

    // A is running, B is queued.
    expect(executed).toEqual([]);

    await delay(50); // wait for both

    // Both executed in order
    expect(executed).toEqual([5, 7]);
  });

  test("A fails, then queued B succeeds", async () => {
    const executed: number[] = [];
    let rollbackCalled = false;

    const manager = new OptimisticSignalManager(
      async (cardId, signalId, reading) => {
        await delay(10);
        if (reading === 5) {
          throw new Error("A failed");
        }
        executed.push(reading);
      },
      () => {
        rollbackCalled = true;
      }
    );

    manager.getConfirmedSignal("c1", "s1", null, null);
    manager.setOptimisticReading("c1", "s1", 5); // Req A (will fail)
    manager.setOptimisticReading("c1", "s1", 7); // Req B (queued, will succeed)

    await delay(50);

    expect(executed).toEqual([7]);
    // Rollback is NOT called for A because B was queued and took over the optimistic state!
    expect(rollbackCalled).toBe(false);
  });

  test("A succeeds, then B fails: local state returns to A (the last confirmed value)", async () => {
    let restoredState: SignalState | null = null;

    const manager = new OptimisticSignalManager(
      async (cardId, signalId, reading) => {
        await delay(10);
        if (reading === 7) {
          throw new Error("B failed");
        }
      },
      (cardId, signalId, restored) => {
        restoredState = restored;
      }
    );

    manager.getConfirmedSignal("c1", "s1", null, null);
    manager.setOptimisticReading("c1", "s1", 5); // Req A
    manager.setOptimisticReading("c1", "s1", 7); // Req B (queued)

    await delay(50);

    // B fails. Rollback is called. It should restore to A (5) because A succeeded and became the confirmed baseline.
    expect(restoredState).toEqual({ reading: 5, rawReading: 5 });
  });

  test("Several rapid adjustments coalesce to the latest unsent value", async () => {
    const executed: number[] = [];

    const manager = new OptimisticSignalManager(
      async (cardId, signalId, reading) => {
        await delay(20);
        executed.push(reading);
      },
      () => {}
    );

    manager.getConfirmedSignal("c1", "s1", null, null);
    manager.setOptimisticReading("c1", "s1", 1); // Starts immediately
    manager.setOptimisticReading("c1", "s1", 2); // Queued
    manager.setOptimisticReading("c1", "s1", 3); // Overwrites 2 in queue
    manager.setOptimisticReading("c1", "s1", 4); // Overwrites 3 in queue

    await delay(60);

    // Only 1 and 4 are executed. 2 and 3 were coalesced.
    expect(executed).toEqual([1, 4]);
  });

  test("Two different signals save independently", async () => {
    const executed: { signalId: string; reading: number }[] = [];

    const manager = new OptimisticSignalManager(
      async (cardId, signalId, reading) => {
        await delay(20);
        executed.push({ signalId, reading });
      },
      () => {}
    );

    manager.getConfirmedSignal("c1", "s1", null, null);
    manager.getConfirmedSignal("c1", "s2", null, null);

    manager.setOptimisticReading("c1", "s1", 5); // Starts immediately
    manager.setOptimisticReading("c1", "s2", 8); // Starts immediately (independent queue)

    // Wait slightly less than completion time to ensure both are in-flight
    // Since there's no way to easily test "in-flight" we just ensure they both resolve
    await delay(30);

    // They ran concurrently and both finished
    expect(executed).toHaveLength(2);
    expect(executed).toContainEqual({ signalId: "s1", reading: 5 });
    expect(executed).toContainEqual({ signalId: "s2", reading: 8 });
  });
});
