// Explicitly authored fixtures, not parser output or automatic algebra rewrites.
export const alignmentFixtures = [
  {
    id: "a-basic", layout: "A", title: "A · Two-sided equations", variant: "basic",
    latex: String.raw`\begin{aligned}
2(x+3) &= 14 \\
2x+6 &= 14 \\
2x &= 8 \\
x &= 4
\end{aligned}`,
  },
  {
    id: "b-columns-basic", layout: "B-columns", title: "B · Separate equals column", variant: "basic",
    latex: String.raw`\begin{aligned}
{} & x^2+5x+6 \\
={} & x^2+2x+3x+6 \\
={} & x(x+2)+3(x+2) \\
={} & (x+2)(x+3)
\end{aligned}`,
  },
  {
    id: "b-phantom-basic", layout: "B-phantom", title: "B · Original phantom candidate", variant: "basic",
    latex: String.raw`\begin{aligned}
&\phantom{={}}x^2+5x+6 \\
&=x^2+2x+3x+6 \\
&=x(x+2)+3(x+2) \\
&=(x+2)(x+3)
\end{aligned}`,
  },
  {
    id: "a-tall", layout: "A", title: "A · Fractions, powers and roots", variant: "tall",
    latex: String.raw`\begin{aligned}
\frac{(x+1)^2}{\sqrt{x+2}} &= \frac{x^2+2x+1}{\sqrt{x+2}} \\
\frac{x^2+2x+1}{\sqrt{x+2}} &= \sqrt{x+2}+\frac{x^2+x-1}{\sqrt{x+2}} \\
y &= \frac{1}{\sqrt{2}}
\end{aligned}`,
  },
  {
    id: "b-columns-tall", layout: "B-columns", title: "B · Separate column, tall working", variant: "tall",
    latex: String.raw`\begin{aligned}
{} & \frac{(x+1)^2}{\sqrt{x+2}} \\
={} & \frac{x^2+2x+1}{\sqrt{x+2}} \\
={} & \sqrt{x+2}+\frac{x^2+x-1}{\sqrt{x+2}}
\end{aligned}`,
  },
  {
    id: "b-phantom-tall", layout: "B-phantom", title: "B · Phantom, tall working", variant: "tall",
    latex: String.raw`\begin{aligned}
&\phantom{={}}\frac{(x+1)^2}{\sqrt{x+2}} \\
&=\frac{x^2+2x+1}{\sqrt{x+2}} \\
&=\sqrt{x+2}+\frac{x^2+x-1}{\sqrt{x+2}}
\end{aligned}`,
  },
] as const;

// Provisional development settings only. None are embedded in the renderer.
export const presentationFixtures = [
  { id: "small", title: "Small · 280px · 14px prose", width: 280, fontSize: 14, fontFamily: "Arial, sans-serif" },
  { id: "medium", title: "Medium · 460px · 18px prose", width: 460, fontSize: 18, fontFamily: "Arial, sans-serif" },
  { id: "large", title: "Large · 700px · 22px prose", width: 700, fontSize: 22, fontFamily: "Georgia, serif" },
] as const;
