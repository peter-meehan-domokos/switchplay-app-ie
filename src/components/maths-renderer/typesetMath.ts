import katex from "katex";

// Stage 1 accepts an explicitly supplied TeX expression, without delimiters.
// Mixed prose parsing and the public capacity/diagnostic contract are later stages.
export function typesetMath(latex: string, display = true):
  | { ok: true; html: string }
  | { ok: false; message: string } {
  try {
    return { ok: true, html: katex.renderToString(latex, {
      displayMode: display,
      output: "htmlAndMathml",
      throwOnError: true,
      trust: false,
      // Aligned rows reserve 1.2em × arraystretch plus 0.3em inter-row space.
      // 1.3125 gives 1.875em instead of 1.5em: 25% more ordinary row spacing.
      // KaTeX still expands rows naturally for tall fractions and radicals.
      macros: { "\\arraystretch": "1.3125" },
    }) };
  } catch (error) {
    if (!(error instanceof katex.ParseError)) throw error;
    return { ok: false, message: error.message };
  }
}
