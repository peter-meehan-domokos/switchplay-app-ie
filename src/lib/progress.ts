type CompletionStatus = "todo" | "inProgress" | "done";

type ProgressItem = {
  completionStatus: CompletionStatus;
};

export function getCardProgressPercentage(items: ProgressItem[]): number {
  if (!items.length) return 0;

  const completedCount = items.filter(
    (item) => item.completionStatus === "done"
  ).length;

  return Math.round((completedCount / items.length) * 100);
}