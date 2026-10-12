"use client";
import { useId, useRef, useState } from "react";
import AssessmentSymbols from "@/components/assessments/AssessmentSymbols";
import AssessmentModal from "@/components/assessments/AssessmentModal";
import { useAssessmentHistory, type AssessmentContext } from "@/components/assessments/useAssessmentHistory";
import type { CompactAssessmentHistory } from "@/lib/assessments/history";

function ItemHistoryModal({ context, onClose }: { context: AssessmentContext; onClose: () => void }) {
  const history = useAssessmentHistory(context);
  return <AssessmentModal context={context} history={history} onClose={onClose} />;
}
export default function ItemTestsCell({ actor, itemId, title, assessments, unavailable = false }: {
  actor: string; itemId: string; title: string; assessments: CompactAssessmentHistory; unavailable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), descriptionId = useId();
  const status = unavailable ? "unavailable" : assessments.state === "incomplete" ? "incomplete" : undefined;
  const results = status ? [] : assessments.latestThree;
  const label = `${title}: ${status ? "assessment history unavailable" : results.length ? "open assessment history" : "add first test"}`;
  return <td className="progress-tests-cell">
    <button ref={trigger} type="button" className="progress-tests-trigger" aria-label={label} aria-haspopup="dialog" aria-describedby={descriptionId}
      onClick={() => setOpen(true)}>
      <AssessmentSymbols results={results} status={status} showTestLabel />
    </button>
    <span id={descriptionId} className="progress-sr-only">{status ? "Some assessment history is unavailable." : results.length
      ? results.map((result) => `${result.date}: ${result.result ? "Pass" : "Fail"}`).join(", ") : "No tests recorded yet."}</span>
    {open ? <ItemHistoryModal context={{ viewerUserId: actor, source: { kind: "item", itemId }, canCreate: true }}
      onClose={() => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }} /> : null}
  </td>;
}
