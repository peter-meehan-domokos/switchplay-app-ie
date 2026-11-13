import { prepareContent } from "../maths-renderer/prepareContent";
import type { MathsDiagnostic } from "../maths-renderer/types";
import { buildInfoCardContentLayout, infoContentItems } from "./infoCardContentLayout";

// Syntax and security check of an Info Card body, as the face will render it: formatting tags are removed and
// each item goes through the renderer's own source preparation, so tags never reach KaTeX as text. No DOM work.
export function validateInfoCardContent(body: string): { invalid: boolean; diagnostics: MathsDiagnostic[] } {
  const layout = buildInfoCardContentLayout(body);
  const diagnostics = [...layout.diagnostics, ...infoContentItems(layout).flatMap(item => prepareContent(item.source).diagnostics
    .map(issue => issue.source ? { ...issue, source: { start: issue.source.start + item.offset, end: issue.source.end + item.offset } } : issue))];
  return { invalid: diagnostics.some(issue => issue.severity === "error"), diagnostics };
}
