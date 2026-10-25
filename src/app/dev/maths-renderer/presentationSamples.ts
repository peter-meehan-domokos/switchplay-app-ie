import type { MathsPresentation } from "@/components/maths-renderer/types";

// Balanced is approved; alternatives remain comparisons. Consumers supply typography.
export const recommendedPresentation: MathsPresentation = {
  fontFamily: "Arial, sans-serif", fontSizePx: 18, fontWeight: 400, lineHeight: 1.5,
  mathScale: 1, paragraphGapEm: 0.8, displayIndentEm: 1, displayGapEm: 0.6,
};
export const reviewSettings = [
  { id: "balanced", title: "Balanced · approved", description: "Maths at 1× prose size; 1em display indent; 0.6em display gaps.", changes: {} },
  { id: "larger-maths", title: "Larger mathematics · alternative", description: "Maths at 1.1× prose size. All prose and spacing settings match Balanced.", changes: { mathScale: 1.1 } },
  { id: "more-space", title: "More display space · alternative", description: "A 1.5em display indent and 0.8em display gaps. Maths and prose sizes match Balanced.", changes: { displayIndentEm: 1.5, displayGapEm: 0.8 } },
] as const;
export const reviewSizes = [
  { id: "small", label: "Small · up to 280px · 14px Arial", width: 280, fontSizePx: 14, fontFamily: "Arial, sans-serif" },
  { id: "medium", label: "Medium · up to 460px · 18px Arial", width: 460, fontSizePx: 18, fontFamily: "Arial, sans-serif" },
  { id: "large", label: "Large · up to 700px · 22px Georgia", width: 700, fontSizePx: 22, fontFamily: "Georgia, serif" },
] as const;

export const reviewContent = String.raw`First, solve $3x=12$. An inline fraction $\frac{x^2+1}{\sqrt{x+2}}$ stays with the surrounding prose.
$$\begin{aligned}
3x &= 12 \\
x &= \frac{12}{3} \\
x &= 4
\end{aligned}$$
Therefore,
$$\begin{aligned}
{} & \frac{x^2+5x+6}{\sqrt{x+2}} \\
={} & \frac{x(x+2)+3(x+2)}{\sqrt{x+2}} \\
={} & \frac{(x+2)(x+3)}{\sqrt{x+2}}
\end{aligned}$$
Finally, a tall inline expression $\dfrac{1+\sqrt{\frac{x^2+1}{y+2}}}{\frac{a^3+b}{c^2}}$ receives its own vertical space.
The next authored line remains separate.

This is a new paragraph. The mathematical working keeps its authored rows.`;
