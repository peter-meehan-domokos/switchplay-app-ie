import type { MathsPresentation } from "../../../src/components/maths-renderer/types";

export const presentation: MathsPresentation = {
  fontFamily: "Arial, Helvetica, sans-serif", fontSizePx: 9.5, fontWeight: 400,
  lineHeight: 1.25, mathScale: 1, displayIndentEm: 1, displayGapEm: .6, paragraphGapEm: .8,
};

// The five review explanations are read unchanged from their current source by
// run.mts. These additional cases do not replace or shorten those explanations.
export const additional = [
  { id: "inline-composition", content: String.raw`$(g\circ f)(x)$ or $g(f(x))$: first $f$, then $g$.` },
  { id: "chain", content: String.raw`Therefore,
$$\begin{aligned}{} & x^2+5x+6 \\ ={} & x^2+2x+3x+6 \\ ={} & (x+2)(x+3)\end{aligned}$$` },
  { id: "oversized", content: String.raw`$$\underbrace{x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x+x}_{\text{deliberately wide}}$$` },
  { id: "invalid", content: String.raw`Before $\frac{1}{$ after.` },
  { id: "incomplete", content: String.raw`Before $$\frac{1}{2}` },
  { id: "currency", content: String.raw`Prices: €12, £8 and \$5. In mathematics: $\text{€}12$, $\pounds 8$, $\$5$.` },
  { id: "unsafe", content: String.raw`$\href{https://example.invalid/secret}{x}$` },
  { id: "expensive", content: String.raw`$\def\a{\a}\a$` },
  { id: "large", content: "Ordinary explanatory prose. ".repeat(3500) },
] as const;
