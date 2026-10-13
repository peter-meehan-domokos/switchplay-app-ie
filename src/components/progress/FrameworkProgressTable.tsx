"use client";
import { Fragment, useId, useState } from "react";
import type { CalculationResult } from "@/lib/frameworks/calculations";
import { readAreaExpansion, writeAreaExpansion, type ProgressSummary } from "@/lib/frameworks/progressClient";
import ItemTestsCell from "./ItemTestsCell";

function Metric({ value, progress, unavailable, label }: { value: number | null; progress: CalculationResult; unavailable: boolean; label: "Completion" | "Confidence" }) {
  if (unavailable || progress.state === "incomplete") return <td className="progress-metric"><span className="progress-unavailable" aria-label={`${label} unavailable`} title="Some required information is unavailable." /></td>;
  return <td className="progress-metric" aria-label={value === null ? `${label} not set` : undefined}>
    {value !== null ? label === "Completion" ? `${value}%` : value : null}
  </td>;
}
export default function FrameworkProgressTable({ actor, framework, unavailable = false, onArea, onItem }: { actor: string; framework: ProgressSummary; unavailable?: boolean; onArea?: (id: string, title: string) => void; onItem?: (id: string, title: string) => void }) {
  const prefix = useId();
  const [expansion, setExpansion] = useState(() => {
    try { return readAreaExpansion(sessionStorage, actor, framework.id); } catch { return {}; }
  });
  const toggle = (id: string) => {
    const next = { ...expansion, [id]: !(expansion[id] ?? true) };
    setExpansion(next);
    try { writeAreaExpansion(sessionStorage, actor, framework.id, next); } catch { /* No storage in restricted browsers. */ }
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
            <Metric label="Completion" value={area.progress.completion} progress={area.progress} unavailable={unavailable} />
            <Metric label="Confidence" value={area.progress.confidence} progress={area.progress} unavailable={unavailable} /><td />
          </tr></tbody>
          <tbody id={itemsId} hidden={!expanded}>{area.items.map((item) => <tr key={item.id} className="progress-item-row" data-item-id={item.id}>
            <th scope="row"><button type="button" className="progress-content-title" disabled={!onItem || !item.hasConfiguredCards} onClick={() => onItem?.(item.id, item.title)}>{item.title}</button></th>
            <Metric label="Completion" value={item.progress.completion} progress={item.progress} unavailable={unavailable} />
            <Metric label="Confidence" value={item.progress.confidence} progress={item.progress} unavailable={unavailable} />
            <ItemTestsCell actor={actor} itemId={item.id} title={item.title} assessments={item.assessments} unavailable={unavailable} />
          </tr>)}</tbody>
        </Fragment>;
      })}
    </table>
    {!framework.areas.length ? <p className="progress-notice">No Areas are configured for this Framework yet.</p> : null}
    <p className="progress-help">Select an Area to find Decks, or an Item to choose a Card.</p>
  </>;
}
