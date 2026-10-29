import { immutable } from "../../core/immutable";
import { analyseRegion, formatValue, rightEndpointEstimate } from "./model";
import { canAdvance, effectiveRectangleCount, effectiveRegion, type IntegrationState } from "./learning";
import { distanceExpression } from "./math-presentation";
import { stageOneReadout } from "./display-policy";

export type TermText = readonly Readonly<{ text: string; explanation?: "estimated" }>[];
export type MathLine = Readonly<{ text: string; role: "formula" | "value"; parts?: TermText }>;
export type IntegrationPresentation = Readonly<{
  heading: string; instruction: string; note: string; lines: readonly MathLine[];
  subheading?: string; question?: string; hint?: string; paragraphs?: readonly string[]; transition?: string;
  instructionParts?: TermText;
  areaFeedback?: Readonly<{ label: string; calculation: string; units: string; description: string }>;
  feedback: string | null; announcement: string; nextEnabled: boolean; nextReason?: string;
  integral: Readonly<{ a: string; b: string; integrand: string; description: string; parentheses?: boolean }> | null;
  choices: readonly Readonly<{ multiplier: number; label: string }>[];
}>;
const value = (number: number) => {
  const formatted = formatValue(number);
  return `${formatted.approximate ? "≈" : "="} ${formatted.text}`;
};
const numeric = (number: number) => formatValue(number).text;
const multiplierName = (multiplier: number) => ({ 2: "It doubled", 4: "It quadrupled", 8: "It increased eightfold" })[multiplier as 2 | 4 | 8];
export const estimatedExplanation = Object.freeze({ title: "Estimated area", content: "The estimated area is found by adding together the areas of all the rectangles." });

/** Stage policy and algebra belong here; the renderer maps prepared roles, not mathematical rules. */
export function integrationPresentation(state: IntegrationState): IntegrationPresentation {
  const region = effectiveRegion(state);
  const lines: MathLine[] = [];
  const formula = (text: string) => lines.push({ text, role: "formula" });
  let heading = "", instruction = "", note = "", feedback: string | null = null;
  let integral: IntegrationPresentation["integral"] = null;
  let choices: IntegrationPresentation["choices"] = [];
  let instructionParts: TermText | undefined;
  let areaFeedback: IntegrationPresentation["areaFeedback"];
  let subheading: string | undefined, question: string | undefined, hint: string | undefined;
  let paragraphs: readonly string[] | undefined, transition: string | undefined;
  if (state.stage === 1) {
    heading = "Area under a graph";
    instruction = "Move the right boundary and watch the shaded area change.";
    const readout = stageOneReadout(region.b);
    areaFeedback = { label: "Shaded area", calculation: `A = 2b = 2 × ${readout.boundaryText} = ${readout.areaText}`, units: "square units",
      description: "The calculation uses the boundary rounded to one decimal place. The graph position remains continuous." };
    note = "The height stays at 2. Each extra unit of width adds 2 square units of area.";
  } else if (state.stage === 2) {
    heading = "Refine the rectangles";
    instruction = "Make the rectangles narrower. Compare the estimated and actual areas.";
    instructionParts = [{ text: "Make the rectangles narrower. Compare the " }, { text: "estimated", explanation: "estimated" }, { text: " and actual areas." }];
    const estimated = rightEndpointEstimate(state.function as "flat" | "rising", region.b, effectiveRectangleCount(state));
    const actual = analyseRegion(region).area;
    const estimate = formatValue(estimated, 2);
    const estimateText = ` area ${estimated !== actual || estimate.approximate ? "≈" : "="} ${estimate.text} square units`;
    lines.push({ text: `Estimated${estimateText}`, role: "value", parts: [{ text: "Estimated", explanation: "estimated" }, { text: estimateText }] });
    formula(`Actual area ${value(analyseRegion(region).area)} square units`);
    note = state.function === "flat" ? "The rectangles fit the constant-height graph exactly at every width. What about when y = x?" : "Narrower rectangles follow the rising line more closely, so the estimated area approaches the actual area.";
  } else if (state.stage === 3) {
    heading = "How area grows";
    instruction = "Watch the width change from 2 to 4.";
    if (state.demonstration === 1) question = "What happened to the shaded area?";
    choices = [2, 4, 8].map((multiplier) => ({ multiplier, label: multiplierName(multiplier) }));
    if (state.prediction && state.demonstration === 1) {
      const result = { flat: "doubled", rising: "quadrupled", square: "increased eightfold" }[state.function];
      feedback = state.prediction.correct ? "Correct! The area " + result + "." : "Not quite. The area actually " + result + ".";
      if (state.function === "square") paragraphs = [
        "The width doubled from 2 to 4.",
        "But for y = x², doubling x makes the corresponding height four times as large.",
        "So the whole region is twice as wide and four times as tall: 2 × 4 = 8.",
        "The area is eight times as large.",
      ];
      else note = state.function === "rising" ? "Both the width and the height doubled, so the area became four times as large." : "The width doubled, but the height stayed at 2. So the area doubled too.";
      const next = (["flat", "rising", "square"] as const).find(kind => !state.comparisons[kind]?.prediction);
      transition = !next ? "We've seen how differently the areas grow. Next, we'll see why we divide by 2 or 3 when calculating them."
        : state.function === "flat" && next === "rising" ? "Now try y = x. Does the area grow in the same way?"
        : state.function === "rising" && next === "square" ? "Now try y = x². Does the area grow even faster?"
        : `Now try ${{ flat: "y = 2", rising: "y = x", square: "y = x²" }[next]}.`;
    }
  } else if (state.stage === 4) {
    heading = "Why do we divide?";
    instruction = state.divisionSubsection === "rule" ? "Compare the two area formulas to see the pattern behind the power rule for integration."
      : state.divisionSubsection === "square" ? "Move the slider towards Narrower. Watch the estimates of the area under the graph get closer together."
      : "See how the diagonal divides the rectangle in half. Then tap y = x² to compare.";
    if (state.divisionSubsection === "square") {
      note = "The estimates approach 9. That's one-third of the whole rectangle, which has area 27 (as you can see on the graph).";
    } else if (state.divisionSubsection === "rule") {
      paragraphs = ["These examples show the pattern: increase the power by one, then divide by that new power.", "We'll explore the constant C in the next stage."];
    }
  } else if (state.stage === 5) {
    heading = "Changing the area";
    instruction = "We've found the area starting at 0. But what if we start at 1 instead?";
    note = "Move the right boundary and watch how the area changes.";
  } else if (state.stage === 6) {
    heading = "Area between curves";
    instruction = "Choose two curves, then move the right boundary b. Watch how the shaded area between a = 1 and b changes.";
    const analysis = analyseRegion(region);
    note = analysis.identical ? "The two curves are the same, so there is no gap between them. The shaded area is 0." : analysis.crossings.length ? "The curves cross at x = 3. The curve on top changes there, so we add the areas on both sides." : "At any position x, the strip's height h(x) is the vertical distance between the two curves.";
    const integrand = distanceExpression(region.curves, region.a, region.b);
    integral = { a: "a", b: "b", integrand, parentheses: / [−+] /.test(integrand) && !integrand.startsWith("|"), description: "Integral from a to b of " + integrand + " with respect to x" };
  } else {
    heading = "Choose and calculate an area";
    instruction = state.part === "finished" ? "" : "Choose two curves and an interval. Then calculate the shaded area.";
    const integrand = distanceExpression(region.curves, region.a, region.b);
    integral = { a: numeric(region.a), b: numeric(region.b), integrand,
      description: "Integral from " + numeric(region.a) + " to " + numeric(region.b) + " of " + integrand + " with respect to x" };
    if (state.part === "finished") subheading = "Your area calculation";
    if (state.feedback === "incorrect") feedback = "Not quite. Try calculating the area again.";
    if (state.feedback === "correct") feedback = "Correct! The shaded area is " + numeric(state.checked!.expected) + " square units.";
    if (state.feedback === "empty") feedback = "Enter an area before checking.";
    if (state.feedback === "invalid") feedback = "Enter a number for the area, then check your calculation.";
    hint = region.curves[0] === region.curves[1] ? "The two curves are the same, so the height between them is 0 everywhere." : "Use the power rule to integrate each term. Then subtract the lower value from the upper value.";
  }
  const stageHeading = state.stage + ". " + heading;
  return immutable({ heading: stageHeading, subheading, question, hint, paragraphs, transition, instruction, instructionParts, areaFeedback, note, lines, feedback, integral, choices,
    announcement: state.stage === 3 && state.prediction && state.demonstration === 1 ? [feedback, note, ...(paragraphs ?? [])].join(" ") : state.helpOpen && state.feedback !== "correct" ? hint! : state.part === "finished" ? "Your area calculation" : feedback ?? stageHeading + ". " + instruction,
    nextEnabled: canAdvance(state), nextReason: state.stage === 3 && !state.prediction ? "Choose an answer first." : undefined });
}
