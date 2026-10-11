import { workingCardStore } from "../../src/lib/cards/workingCardStore";
import { createRoot } from "react-dom/client";
import AssessmentControl from "../../src/components/assessments/AssessmentControl";
import { useAssessmentHistory, type AssessmentContext } from "../../src/components/assessments/useAssessmentHistory";
function Probe({ context }: { context: AssessmentContext }) {
  const state = useAssessmentHistory(context);
  return <output data-history-state={state.error ? "error" : state.data?.history.state}>
    {state.data?.history.results.map((row) => <span key={JSON.stringify([row.source, row.id])} data-result-id={row.id} data-result={row.result ? "pass" : "fail"} data-date={row.date}>{row.sourceTitle}</span>)}
  </output>;
}
const root = createRoot(document.getElementById("fixture")!);
Object.assign(window, { invalidateAssessmentFixture: (actor: string) => workingCardStore.invalidate(actor), mountAssessmentFixture: (contexts: AssessmentContext[]) => root.render(<main>
  {contexts.map((context, index) => <section key={JSON.stringify([context.viewerUserId, context.source])} aria-label={`Assessment view ${index + 1}`} style={{ position: "relative", margin: "60px", minHeight: "60px" }}>
    <AssessmentControl context={context} /><Probe context={context} />
  </section>)}
</main>) });
