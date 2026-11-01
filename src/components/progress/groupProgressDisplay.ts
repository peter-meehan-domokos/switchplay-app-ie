import type { ProgressMetadata } from "@/lib/frameworks/progressClient";
import type { GroupProgressSummary } from "@/lib/groupExperiences/progressReads";
import type { CalculationResult } from "@/lib/frameworks/calculations";
export type GroupMode = "groupScores" | "playerAverages";
export function groupProgressDisplay(metadata: ProgressMetadata[number], data?: GroupProgressSummary, mode: GroupMode = "groupScores") {
  const metric = (value?: GroupProgressSummary["framework"]["areas"][number]) => value && ("player" in value ? value.player : value[mode]);
  const calculation = (value: ReturnType<typeof metric>, cardCount: number): CalculationResult & { observationState?: string } => ({
    state: !value || value.state === "incomplete" ? "incomplete" : value.state === "empty" || value.state === "outside" ? "empty" : "complete",
    completion: value?.completion ?? null, confidence: value?.confidence ?? null, eligibleCardCount: cardCount, resolvedCardCount: cardCount, issues: [], observationState: value?.state,
  });
  return { id: metadata.id, title: metadata.title, areas: metadata.areas.map(area => {
    const row = data?.framework.areas.find(value => value.areaId === area.id);
    return { id: area.id, title: area.title, hasConfiguredCards: true, coverage: row?.coverage,
      progress: calculation(metric(row), row?.cardTemplateIds.length ?? 0), items: area.items.map(item => {
        const value = row?.items.find(value => value.frameworkItemId === item.id);
        return { id: item.id, title: item.title, hasConfiguredCards: true, coverage: value?.coverage,
          progress: calculation(metric(value as typeof row), value?.cardTemplateIds.length ?? 0),
          assessments: value?.assessments ?? { state: "empty" as const, count: 0, readableCount: 0, latestThree: [], issues: [] } };
      }) };
  }) };
}
export type GroupDisplayFramework = ReturnType<typeof groupProgressDisplay>;
