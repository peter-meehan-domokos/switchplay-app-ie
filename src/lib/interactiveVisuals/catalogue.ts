/** Public metadata only. Never import React, credentials or activity implementations here. */
export type InteractiveVisualRelease = Readonly<{
  id: string;
  title: string;
  status: "published" | "retired";
  activityVersion: number;
  snapshotSchema: number;
  eventSchema: number;
  preview: string | null;
}>;

// Each code release owns its immutable metadata. Cards and Frameworks store stable IDs.
// Keep published IDs after retirement so existing immutable cards and history stay valid.
// Retirement removes new selection; server emergency disabling also prevents execution.
// Preview assets are added with the host slice, before any new creator selection UI.
export const interactiveVisualCatalogue: readonly InteractiveVisualRelease[] = Object.freeze([
  Object.freeze({ id: "roots-and-factors", title: "Roots and Factors", status: "published" as const,
    activityVersion: 1, snapshotSchema: 1, eventSchema: 1, preview: "/interactive-visuals/roots-and-factors-v1.png" }),
  Object.freeze({ id: "integration-area", title: "Integration", status: "published" as const,
    activityVersion: 2, snapshotSchema: 1, eventSchema: 2, preview: "/interactive-visuals/integration-area-v2.png" }),
]);

export function getInteractiveVisual(id: string): InteractiveVisualRelease | undefined {
  return interactiveVisualCatalogue.find((visual) => visual.id === id);
}

/** Retirement prevents new selection; emergency disabling also prevents existing execution.
 * The server supplies its disable list. Public metadata is never an authorization decision.
 */
export function resolveInteractiveVisual(
  id: string,
  options: { forSelection?: boolean; disabledIds?: readonly string[] } = {},
): InteractiveVisualRelease | undefined {
  const visual = getInteractiveVisual(id);
  if (!visual || options.disabledIds?.includes(id) || (options.forSelection && visual.status !== "published")) return undefined;
  return visual;
}
