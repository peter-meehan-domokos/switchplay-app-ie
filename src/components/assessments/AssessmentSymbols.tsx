import type { CompactAssessmentHistory } from "@/lib/assessments/history";

// Presentation only: callers supply the established latest-three projection.
export default function AssessmentSymbols({ results, status, showTestLabel = false }: {
  results: CompactAssessmentHistory["latestThree"]; status?: "loading" | "unavailable" | "incomplete"; showTestLabel?: boolean;
}) {
  if (status) return <span className="assessment-empty" aria-hidden="true">{status === "loading" ? "…" : "!"}</span>;
  if (results.length) return results.map((result) => <span key={JSON.stringify([result.source, result.id])}
    className={result.result ? "assessment-pass" : "assessment-fail"} aria-label={`${result.date}: ${result.result ? "Pass" : "Fail"}`}>
    {result.result ? "✓" : "●"}
  </span>);
  return showTestLabel ? <span className="assessment-empty-control" aria-hidden="true"><span>+</span> Test</span>
    : <span className="assessment-empty" aria-hidden="true">+</span>;
}
