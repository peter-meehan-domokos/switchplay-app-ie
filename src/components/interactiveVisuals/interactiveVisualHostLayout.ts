import type { VisualHostControls } from "@/app/step-visuals/core/host";

/** Routine persistence is silent. Preserve unrecognised messages and all failures. */
export function visualPersistenceNotice(status: string): string | null {
  const routine = /^(?:saved|development session only|changes pending|pending changes|pending|saving|syncing|synchroni[sz]ing|previous attempt kept|previous attempt pending backup)[.…]*$/i;
  return !status.trim() || routine.test(status.trim()) ? null : status;
}

export function buildInteractiveVisualHostLayout(title: string, controls: VisualHostControls | null, status: string, hasNewAttemptService = false) {
  return {
    title, status, stageId: controls?.stageId ?? null,
    previous: controls?.previous ?? null, next: controls?.next ?? null,
    backToStart: controls?.completed ? controls.backToStart ?? null : null,
    startNewAttempt: controls?.atStart ? controls.startNewAttempt ?? null : null,
    showStartNewAttempt: !!controls?.atStart && hasNewAttemptService,
  } as const;
}
