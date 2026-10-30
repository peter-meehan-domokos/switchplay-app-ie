import type { CompletionStatus } from "@/components/decks/types";

type ProgressItem = {
  completionStatus: string;
};

export function normalizeCompletionStatus(completionStatus: string): CompletionStatus {
  if (
    completionStatus === "inProgress" ||
    completionStatus === "done" ||
    completionStatus === "skipped"
  ) {
    return completionStatus;
  }

  return "todo";
}

export function getProgressPercentage(steps: ProgressItem[]): number | null {
  if (!steps.length) return null;
  const includedSteps = steps.filter((step) => step.completionStatus !== "skipped");

  if (!includedSteps.length) return 100;

  const completedCount = includedSteps.filter(
    (step) => step.completionStatus === "done"
  ).length;

  return Math.round((completedCount / includedSteps.length) * 100);
}

// A percentage is presentation, not proof of completion: personal displays
// historically show 100 for all-skipped input, and rounding can also reach 100.
// Skipped is neutral. Only a nonempty set of explicitly done eligible Steps
// establishes completion; partial work is doing, and todo remains unstarted.
export function classifyProgress(steps: readonly ProgressItem[]) {
  const eligible = steps.filter(step => step.completionStatus !== "skipped");
  const done = eligible.filter(step => step.completionStatus === "done").length;
  const doing = eligible.filter(step => step.completionStatus === "inProgress").length;
  const isComplete = eligible.length > 0 && done === eligible.length;
  const status = !eligible.length ? null : isComplete ? "done" : done || doing ? "inProgress" : "todo";
  return { eligibleCount: eligible.length, done, doing, isComplete, status };
}
