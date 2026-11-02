import type { GroupProgressSummary } from "@/lib/groupExperiences/progressReads";
import type { GroupMode } from "./groupProgressDisplay";
type Row = GroupProgressSummary["framework"]["areas"][number];
function completion(value: NonNullable<Row["groupScores"]>) {
  return value.state === "skipped" ? "skip" : value.state === "incomplete" ? "Unavailable" : value.completion === null ? "No observations" : `${value.completion}%`;
}
export function comparisonLines(row: Row, mode: GroupMode, label: "Completion" | "Confidence", extrema: boolean) {
  const group = row.groupScores, players = row.playerAverages;
  if (!group || !players) return [];
  if (mode === "playerAverages") return [label === "Completion" ? `Group completion: ${completion(group)}` : `Group confidence: ${group.confidence ?? "Not set"}`];
  if (label === "Completion") return [`Player completion: ${completion(players)}`,
    players.doing === null || players.done === null ? "Player progress unavailable" : `${players.doing} doing, ${players.done} done`];
  return [`Player confidence: ${players.confidence ?? "Not set"}`, ...(extrema ? [`Lowest: ${players.confidenceMinimum ?? "Not set"}`, `Highest: ${players.confidenceMaximum ?? "Not set"}`] : [])];
}
