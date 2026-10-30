import type { InteractiveVisualRelease } from "../interactiveVisuals/catalogue";
import type { VisualRestoration } from "../interactiveVisuals/persistence";
import { assertVisualSnapshot } from "./contracts";
import type { VisualAttempt } from "./model";

/** Never hydrate unknown state or rewrite history as an implicit fresh attempt. */
export function inspectVisualRestoration(attempt: VisualAttempt, release: InteractiveVisualRelease | undefined): VisualRestoration {
  if (!release || release.id !== attempt.activityId) return { status: "unavailable" };
  const recovery = (reason: "version" | "schema" | "invalid-state"): VisualRestoration => ({ status: "new-attempt-required", reason,
    storedActivityVersion: attempt.activityVersion, storedSnapshotSchema: attempt.snapshotSchema });
  if (attempt.activityVersion !== release.activityVersion) return recovery("version");
  if (attempt.snapshotSchema !== release.snapshotSchema) return recovery("schema");
  if (attempt.snapshot !== null) {
    try {
      assertVisualSnapshot(attempt.snapshot, attempt.activityId, attempt.attemptId);
      if (attempt.snapshot.attemptNumber !== attempt.attemptNumber) return recovery("invalid-state");
    }
    catch { return recovery("invalid-state"); }
  }
  return { status: "ready" };
}
