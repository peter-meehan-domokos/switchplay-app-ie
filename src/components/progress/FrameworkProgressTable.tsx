"use client";
import { Fragment, useId, useState } from "react";
import type { CalculationResult } from "@/lib/frameworks/calculations";
import { readAreaExpansion, writeAreaExpansion, type ProgressSummary } from "@/lib/frameworks/progressClient";
import type { GroupDisplayFramework } from "./groupProgressDisplay";
import type { AssessmentContext } from "@/components/assessments/useAssessmentHistory";
import { comparisonLines } from "./progressComparisons";
import ItemTestsCell from "./ItemTestsCell";

function Metric({ value, progress, unavailable, label, outside = false, compare, comparisonId }: { value: number | null; progress: CalculationResult; unavailable: boolean; label: "Completion" | "Confidence";
  outside?: boolean; compare?: (anchor: HTMLButtonElement) => void; comparisonId?: string }) {
  if (outside) return <td className="progress-metric"><span className="progress-outside" aria-label="Outside this Group's learning">—</span></td>;
  if (unavailable || progress.state === "incomplete") return <td className="progress-metric"><span className="progress-unavailable" aria-label={`${label} unavailable`} title="Some required information is unavailable." /></td>;
  const skipped = label === "Completion" && progress.observationState === "skipped";
  const content = skipped ? <span className="progress-skip" aria-label="All relevant Steps skipped">skip</span> : value !== null ? label === "Completion" ? `${value}%` : value : null;
  return <td className="progress-metric" aria-label={value === null && !skipped ? label === "Completion" ? "No eligible observations" : "Confidence not set" : undefined}>
    {compare && content !== null ? <button type="button" className="progress-metric-button" aria-label={`${label} comparison. ${skipped ? "All relevant Steps skipped" : `${value}${label === "Completion" ? "%" : " out of 10"}`}`} aria-haspopup="dialog" aria-controls={comparisonId}
      onClick={event => compare(event.currentTarget)}>{content}</button> : content}
  </td>;
}
export default function FrameworkProgressTable({ actor, framework, unavailable = false, onArea, onItem, assessmentContext, expansionScope, groupData, mode = "groupScores", onCompare, comparisonId }: { actor: string; framework: ProgressSummary | GroupDisplayFramework; assessmentContext?: (itemId: string) => AssessmentContext; expansionScope?: string; groupData?: import("@/lib/groupExperiences/progressReads").GroupProgressSummary; mode?: import("./groupProgressDisplay").GroupMode; onCompare?: (value: import("./ComparisonPopover").Comparison) => void; comparisonId?: string; unavailable?: boolean; onArea?: (id: string, title: string) => void; onItem?: (id: string, title: string) => void }) {
  const prefix = useId();
  const [expansion, setExpansion] = useState(() => {
    try { return readAreaExpansion(sessionStorage, expansionScope ?? actor, framework.id); } catch { return {}; }
  });
  const toggle = (id: string) => {
    const next = { ...expansion, [id]: !(expansion[id] ?? true) };
    setExpansion(next);
    try { writeAreaExpansion(sessionStorage, expansionScope ?? actor, framework.id, next); } catch { /* No storage in restricted browsers. */ }
  };
  const comparison = (id: string, item: boolean, label: "Completion" | "Confidence") => {
    if (!groupData || groupData.perspective.kind !== "group" || unavailable || !onCompare) return undefined;
    const row = item ? groupData.framework.areas.flatMap(area => area.items).find(row => row.frameworkItemId === id) : groupData.framework.areas.find(area => area.areaId === id);
    if (!row || row.coverage !== "inside") return undefined;
    return (anchor: HTMLButtonElement) => onCompare({ anchor, key: JSON.stringify([item, id, label]), label,
      lines: comparisonLines(row as import("@/lib/groupExperiences/progressReads").GroupProgressSummary["framework"]["areas"][number], mode, label, groupData.capabilities.canViewConfidenceExtrema) });
  };
  return <>
    <table className="progress-table"><caption className="progress-sr-only">{framework.title}: learning progress and assessments</caption>
      <thead><tr><th scope="col">Area / Item</th><th scope="col">Completion</th><th scope="col">Confidence</th><th scope="col">Tests</th></tr></thead>
      {framework.areas.map((area, index) => {
        const expanded = area.items.length > 0 && (expansion[area.id] ?? true), itemsId = `${prefix}-items-${index}`;
        return <Fragment key={area.id}>
          <tbody><tr className="progress-area-row" data-area-id={area.id}>
            <th scope="row"><div className="progress-area-heading">
              <button type="button" className="progress-area-toggle" aria-label={`${expanded ? "Collapse" : "Expand"} ${area.title}`}
                aria-expanded={expanded} aria-controls={itemsId} disabled={!area.items.length} onClick={() => toggle(area.id)}>
                <span aria-hidden="true">{expanded ? "⌄" : "›"}</span>
              </button>
              <button type="button" className="progress-content-title" disabled={!onArea || !area.hasConfiguredCards}
                onClick={() => onArea?.(area.id, area.title)}>{area.title}</button>
            </div></th>
            <Metric label="Completion" value={area.progress.completion} progress={area.progress} unavailable={unavailable} outside={"coverage" in area && area.coverage === "outside"} compare={comparison(area.id, false, "Completion")} comparisonId={comparisonId} />
            <Metric label="Confidence" value={area.progress.confidence} progress={area.progress} unavailable={unavailable} outside={"coverage" in area && area.coverage === "outside"} compare={comparison(area.id, false, "Confidence")} comparisonId={comparisonId} /><td>{"coverage" in area && area.coverage === "outside" ? <span className="progress-outside" aria-label="Outside this Group's learning">—</span> : null}</td>
          </tr></tbody>
          <tbody id={itemsId} hidden={!expanded}>{area.items.map((item) => <tr key={item.id} className="progress-item-row" data-item-id={item.id}>
            <th scope="row"><button type="button" className={`progress-content-title${"coverage" in item && item.coverage === "outside" ? " progress-outside-title" : ""}`} disabled={!onItem || !item.hasConfiguredCards} onClick={() => onItem?.(item.id, item.title)}>{item.title}</button></th>
            <Metric label="Completion" value={item.progress.completion} progress={item.progress} unavailable={unavailable} outside={"coverage" in item && item.coverage === "outside"} compare={comparison(item.id, true, "Completion")} comparisonId={comparisonId} />
            <Metric label="Confidence" value={item.progress.confidence} progress={item.progress} unavailable={unavailable} outside={"coverage" in item && item.coverage === "outside"} compare={comparison(item.id, true, "Confidence")} comparisonId={comparisonId} />
            {"coverage" in item && item.coverage === "outside" ? <td className="progress-metric"><span className="progress-outside" aria-label="Outside this Group's learning">—</span></td> : <ItemTestsCell key={JSON.stringify([item.id, assessmentContext?.(item.id).group])} actor={actor} itemId={item.id} title={item.title} assessments={item.assessments} unavailable={unavailable} context={assessmentContext?.(item.id)} />}
          </tr>)}</tbody>
        </Fragment>;
      })}
    </table>
    {!framework.areas.length ? <p className="progress-notice">No Areas are configured for this Framework yet.</p> : null}
    <p className="progress-help">Select an Area to find Decks, or an Item to choose a Card.</p>
  </>;
}
