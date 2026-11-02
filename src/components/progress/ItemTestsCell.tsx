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
export default function ItemTestsCell({ actor, itemId, title, assessments, unavailable = false, context }: {
  actor: string; itemId: string; title: string; assessments: CompactAssessmentHistory | ReturnType<typeof import("@/lib/groupExperiences/progressAssessments").compactScopedHistory>; unavailable?: boolean; context?: AssessmentContext;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), descriptionId = useId();
  if (context?.group && unavailable && open) setOpen(false);
  const status = unavailable ? "unavailable" : assessments.state === "incomplete" ? "incomplete" : undefined;
  const results = unavailable && context?.group ? [] : assessments.latestThree;
  const label = `${title}: ${status ? "assessment history unavailable" : results.length ? "open assessment history" : "add first test"}`;
  return <td className="progress-tests-cell">
    <button ref={trigger} type="button" className="progress-tests-trigger" aria-label={label} aria-haspopup="dialog" aria-describedby={descriptionId} disabled={!!context?.group && unavailable}
      onClick={() => setOpen(true)}>
      <AssessmentSymbols results={results} showTestLabel />
      {status ? <span className="progress-tests-warning" aria-hidden="true">!</span> : null}
    </button>
    <span id={descriptionId} className="progress-sr-only">{status ? "Some assessment history may be missing. Indicators show only the latest known results. " : ""}
      {results.length ? results.map((result) => `${result.date}: ${result.result ? "Pass" : "Fail"}`).join(", ")
        : status ? "No readable results are currently known." : "No tests recorded yet."}</span>
    {open && (!context?.group || !unavailable) ? <ItemHistoryModal context={context ?? { viewerUserId: actor, source: { kind: "item", itemId }, canCreate: true, showOrigin: true }}
      onClose={() => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }} /> : null}
  </td>;
}
