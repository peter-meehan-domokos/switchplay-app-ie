import type { WeeklyCardItem } from "@/components/decks/types";
// Semantic gateway rollback: trace lane import paused for easy restoration.
// import SemanticTraceLane from "@/components/cards/SemanticTraceLane";
// Semantic gateway rollback: trace family import paused for easy restoration.
// import type { SemanticTraceFamily } from "@/components/cards/SemanticTraceGlyph";
import StepProgressStrip from "@/components/cards/StepProgressStrip";
import { normalizeCompletionStatus } from "@/lib/progress";

type StepItemProps = {
  index: number;
  item: WeeklyCardItem;
  onCycleStatus?: (itemId: string) => void;
};

/*
 * Semantic gateway rollback: mock trace combinations paused for easy restoration.
 *
 * type MockSemanticTraceCombination = {
 *   id: "progression-a" | "progression-b" | "progression-c";
 *   families: SemanticTraceFamily[];
 * };
 *
 * const mockSemanticTraceCombinations: MockSemanticTraceCombination[] = [
 *   { id: "progression-a", families: ["media", "questionnaire", "substeps"] },
 *   { id: "progression-b", families: ["media", "substeps"] },
 *   { id: "progression-c", families: ["questionnaire", "substeps"] },
 * ];
 *
 * function getMockSemanticTraceCombination(index: number) {
 *   return mockSemanticTraceCombinations[index % mockSemanticTraceCombinations.length];
 * }
 */

export default function StepItem({ index, item, onCycleStatus }: StepItemProps) {
  const completionStatus = normalizeCompletionStatus(item.completionStatus);
  /*
   * Semantic gateway rollback: mock trace selection paused for easy restoration.
   *
   * const semanticTrace = getMockSemanticTraceCombination(index);
   */

  return (
    <li className="active-step-item">
      <span className="step-play-icon" aria-hidden="true" />
      <span className="step-copy">
        <span className="step-description">{item.description}</span>
        <StepProgressStrip
          completionStatus={completionStatus}
          onCycleStatus={onCycleStatus ? () => onCycleStatus(item.id) : undefined}
        />
        {/*
          Semantic gateway rollback: lane wrapper and trace rendering paused for easy restoration.

          <span className={`step-semantic-lane step-semantic-lane--${semanticTrace.id}`}>
            <StepProgressStrip
              completionStatus={completionStatus}
              onCycleStatus={onCycleStatus ? () => onCycleStatus(item.id) : undefined}
            />
            <SemanticTraceLane families={semanticTrace.families} pattern={semanticTrace.id} />
          </span>
        */}
      </span>
    </li>
  );
}
