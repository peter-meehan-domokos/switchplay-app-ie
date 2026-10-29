import { assertAdoption, nonblank, requireCondition } from "./domain";

// Server-recorded evidence of assignment, not a navigation or media grant.
// A group member can reuse the same shape later without copying learning data.
export type RetainedCardAssignment = { cardTemplateId: string; version: number };

export function mergeRetainedAssignments(existing: readonly RetainedCardAssignment[] = [],
  assigned: readonly RetainedCardAssignment[] = []): RetainedCardAssignment[] {
  requireCondition(Array.isArray(existing) && Array.isArray(assigned), "INVALID_RETAINED_ASSIGNMENTS");
  const versions = new Map<string, number>();
  for (const ref of [...existing, ...assigned]) {
    requireCondition(ref && nonblank(ref.cardTemplateId), "INVALID_RETAINED_ASSIGNMENTS");
    assertAdoption(ref.version);
    versions.set(ref.cardTemplateId, Math.max(versions.get(ref.cardTemplateId) ?? 0, ref.version));
  }
  return [...versions].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([cardTemplateId, version]) => ({ cardTemplateId, version }));
}
