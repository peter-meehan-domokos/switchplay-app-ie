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
