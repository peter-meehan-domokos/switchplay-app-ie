import type { OpenVisual, VisualPersistence } from "./persistence";
import type { VisualHostEvent } from "../../app/step-visuals/core/host";

// Internal vertical slice only. This must never masquerade as durable Visual Learning Records.
export function createDevelopmentVisualPersistence(): VisualPersistence {
  const attempts = new Map<string, OpenVisual>();
  const events = new Map<string, VisualHostEvent>();
  const guard = () => { if (process.env.NODE_ENV === "production") throw new Error("Development persistence is unavailable."); };
  return {
    statusLabel: "Development session only",
    async hasAttempt(activityId) { guard(); return attempts.has(activityId); },
    async open(activityId) {
      guard();
      const previous = attempts.get(activityId);
      if (previous) return structuredClone(previous);
      const opened = { activityId, attemptId: crypto.randomUUID(), snapshot: null };
      attempts.set(activityId, opened);
      return opened;
    },
    async save(opened, snapshot, additions) {
      guard();
      if (attempts.get(opened.activityId)?.attemptId !== opened.attemptId) throw new Error("Attempt changed.");
      additions.forEach((event) => events.set(`${opened.attemptId}:${event.eventId}`, structuredClone(event)));
      attempts.set(opened.activityId, { ...opened, snapshot: structuredClone(snapshot) });
    },
  };
}
