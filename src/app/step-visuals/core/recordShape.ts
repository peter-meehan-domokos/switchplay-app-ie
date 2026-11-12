/** Small structural validators shared by activity-owned record codecs. No grading or lesson rules. */
export const recordObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export const fields = (v: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) =>
  required.every(key => Object.hasOwn(v, key)) && Object.keys(v).every(key => required.includes(key) || optional.includes(key));
export const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < Number.MAX_SAFE_INTEGER - 100;
export const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const identityFields = ["schemaVersion", "activityVersion", "activityId", "attemptId", "attemptNumber", "eventId", "sequence", "type"] as const;
