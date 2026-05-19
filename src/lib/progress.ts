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

export function getCardProgressPercentage(items: ProgressItem[]): number {
  const includedItems = items.filter((item) => item.completionStatus !== "skipped");

  if (!includedItems.length) return 0;

  const completedCount = includedItems.filter(
    (item) => item.completionStatus === "done"
  ).length;

  return Math.round((completedCount / includedItems.length) * 100);
}
