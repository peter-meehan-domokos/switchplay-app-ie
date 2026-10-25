import katex from "katex";

export type TypesetIssue = { code: string; message: string; severity: "warning" | "error"; position?: number; length?: number };

// Core accepts one unchanged TeX expression. Delimiters/prose belong to parsing.
export function typesetMath(latex: string, display = true):
  | { ok: true; html: string; issues: TypesetIssue[] }
  | { ok: false; message: string; issues: TypesetIssue[] } {
  const issues: TypesetIssue[] = [];
  try {
    const html = katex.renderToString(latex, {
      displayMode: display,
      output: "htmlAndMathml",
      throwOnError: true,
      trust: context => {
        issues.push({ code: "UNSAFE_COMMAND", message: `The resource or HTML command ${context.command} is disabled.`, severity: "error" });
        return false;
      },
      strict: (code, message, token) => {
        if (!issues.some(issue => issue.code === code && issue.message === message)) {
          issues.push({ code, message, severity: "warning", position: token?.loc?.start, length: token?.text?.length });
        }
        return "ignore";
      },
      // Aligned rows reserve 1.2em × arraystretch plus 0.3em inter-row space.
      // 1.3125 gives 1.875em instead of 1.5em: 25% more ordinary row spacing.
      // KaTeX still expands rows naturally for tall fractions and radicals.
      macros: { "\\arraystretch": "2.3125" },
    });
    // Retain the TeX metadata for MathML consumers, but expose only the
    // presentation branch to accessibility APIs. WebKit otherwise includes
    // the raw annotation alongside the mathematical expression.
    const accessibleHtml = html.replace('<annotation encoding="application/x-tex">', '<annotation encoding="application/x-tex" aria-hidden="true">');
    const error = issues.find(issue => issue.severity === "error");
    return error ? { ok: false, message: error.message, issues } : { ok: true, html: accessibleHtml, issues };
  } catch (error) {
    if (!(error instanceof katex.ParseError)) throw error;
    const detail = error as Error & { position?: number; length?: number };
    issues.push({ code: "INVALID_LATEX", message: error.message, severity: "error", position: detail.position, length: detail.length });
    return { ok: false, message: error.message, issues };
  }
}
