import type { VisualHostControls } from "@/app/step-visuals/core/host";

export function buildInteractiveVisualHostLayout(title: string, controls: VisualHostControls | null, status: string, hasNewAttemptService = false) {
  return {
    title, status, stageId: controls?.stageId ?? null,
    previous: controls?.previous ?? null, next: controls?.next ?? null,
    backToStart: controls?.completed ? controls.backToStart ?? null : null,
    startNewAttempt: controls?.atStart ? controls.startNewAttempt ?? null : null,
    showStartNewAttempt: !!controls?.atStart && hasNewAttemptService,
  } as const;
}
