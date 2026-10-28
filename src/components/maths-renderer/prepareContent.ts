import { parseContent, type ContentPart } from "./parseContent";
import { typesetMath } from "./typesetMath";
import type { MathsDiagnostic } from "./types";

export function prepareContent(source: string) {
  const parsed = parseContent(source);
  const diagnostics: MathsDiagnostic[] = [...parsed.diagnostics];
  const mathematics = new Map<ContentPart, ReturnType<typeof typesetMath>>();
  for (const block of parsed.blocks) {
    for (const part of block.kind === "display" ? [block.part] : block.parts) {
      if (part.kind !== "math") continue;
      const result = typesetMath(part.latex, part.display);
      mathematics.set(part, result);
      for (const issue of result.issues) {
        const start = issue.position === undefined ? part.source.start : Math.min(part.source.end, part.expressionStart + issue.position);
        diagnostics.push({ code: issue.code, message: issue.message, severity: issue.severity,
          source: { start, end: issue.position === undefined ? part.source.end : Math.min(part.source.end, start + Math.max(1, issue.length ?? 1)) } });
      }
    }
  }
  return { blocks: parsed.blocks, mathematics, diagnostics, invalid: diagnostics.some(issue => issue.severity === "error") };
}
