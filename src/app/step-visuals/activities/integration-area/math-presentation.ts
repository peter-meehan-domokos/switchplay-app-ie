import { analyseRegion, curveLabel, formatValue, functionExpression, heightExpression, heightPolynomial, orderedRegion, primitive, primitiveExpression, quadraticEstimates, type IntegrationFunction, type RegionSelection } from "./model";
import { effectiveRectangleCount, effectiveRegion, type IntegrationState } from "./learning";
import { immutable } from "../../core/immutable";

export type MathPart = Readonly<{ text: string } | { numerator: string; denominator: string }>;
export type MathExpression = readonly MathPart[];
export type IndefiniteIntegralScene = Readonly<{ integrand: string; primitive: MathExpression }>;
export const powerRuleScenes: Readonly<{ linear: IndefiniteIntegralScene; quadratic: IndefiniteIntegralScene; general: IndefiniteIntegralScene }> = immutable({
  linear: { integrand: "x", primitive: [{ numerator: "x²", denominator: "2" }, { text: " + C" }] },
  quadratic: { integrand: "x²", primitive: [{ numerator: "x³", denominator: "3" }, { text: " + C" }] },
  general: { integrand: "xⁿ", primitive: [{ numerator: "xⁿ⁺¹", denominator: "n + 1" }, { text: " + C" }] },
});
export const fraction = (numerator: string, denominator = "2"): MathPart => ({ numerator, denominator });
export const text = (value: string): MathPart => ({ text: value });
export const mathDescription = (parts: MathExpression): string => parts.map((part) => "text" in part ? part.text : " " + part.numerator + " over " + part.denominator + " ").join("").trim();
export const amount = (value: number): MathExpression => {
  for (const denominator of [1, 2, 3, 6]) {
    const numerator = Math.round(value * denominator);
    if (Math.abs(numerator / denominator - value) > 1e-10) continue;
    if (denominator === 1) return [text(String(numerator === 0 ? 0 : numerator))];
    const whole = Math.trunc(numerator / denominator), remainder = numerator % denominator;
    return [...(whole ? [text(String(whole))] : []), fraction(String(remainder), String(denominator))];
  }
  return [text("≈ " + formatValue(value).text)];
};
export const trianglePresentation = (b: number): readonly Readonly<{ label: string; expression: MathExpression; units?: string }>[] => {
  const whole = amount(b * b / 2), shaded = amount((b * b - 1) / 2);
  const approximate = "text" in whole[0] && whole[0].text.startsWith("≈");
  return [
    { label: "First, the whole triangle from 0 to " + (Number.isInteger(b) ? b : "b") + " has area:", expression: [fraction(Number.isInteger(b) ? b + " × " + b : "b × b"), text(approximate ? " " : " = "), ...whole] },
    { label: "But we start at 1, so we leave out this small triangle:", expression: [fraction("1 × 1"), text(" = "), fraction("1")] },
    { label: "So the shaded area we want is:", expression: Number.isInteger(b) ? [...whole, text(" − "), fraction("1"), text(" = "), ...shaded] : shaded, units: "square units" },
  ];
};
export const selectionLabel = (id: IntegrationFunction) => id === "axis" ? "x-axis (y = 0)" : curveLabel(id);
export const distanceExpression = (curves: readonly [IntegrationFunction, IntegrationFunction], a: number, b: number): string => {
  const region = analyseRegion({ curves, a, b });
  if (region.identical) return "0";
  if (region.crossings.length) return "|x² − 3x|";
  const ordered = region.pieces[0] ?? orderedRegion(curves[0], curves[1], a, b);
  return heightExpression(ordered.top, ordered.bottom);
};

export type WorkedAreaScene = Readonly<{
  a: string; b: string; integrated: string; substitution: string; subtraction: string;
  upperValue: number; lowerValue: number; area: number;
}>;

/** The supported final-task family has integer primitive coefficients and integer limits.
 * Derive every line from the canonical polynomials; never infer algebra from a display string.
 */
export const workedAreaLayout = (region: RegionSelection): WorkedAreaScene => {
  if (!region.curves.every(curve => ["upper", "parabola", "axis"].includes(curve)) ||
      !Number.isInteger(region.a) || !Number.isInteger(region.b) || region.a < 0 || region.b > 2) {
    throw new RangeError("Worked calculations require the supported final-task curves and limits.");
  }
  const analysis = analyseRegion(region);
  if (analysis.crossings.length) throw new RangeError("A worked calculation must not hide a crossing.");
  const ordered = analysis.pieces[0] ?? orderedRegion(region.curves[0], region.curves[1], region.a, region.b);
  const coefficients = heightPolynomial(ordered.top, ordered.bottom).map((coefficient, index) => coefficient / (index + 1));
  if (!coefficients.every(Number.isInteger)) throw new RangeError("Unsupported fractional primitive coefficient.");
  const substitute = (boundary: number) => coefficients.flatMap((coefficient, index) => {
    if (!coefficient) return [];
    const power = index + 1;
    const value = formatValue(boundary).text + (power === 1 ? "" : power === 2 ? "²" : "³");
    return [{ negative: coefficient < 0, body: (Math.abs(coefficient) === 1 ? "" : Math.abs(coefficient) + " × ") + value }];
  }).map((term, index) => (term.negative ? index === 0 ? "−" : " − " : index === 0 ? "" : " + ") + term.body).join("") || "0";
  const upperValue = primitive(ordered.top, region.b) - primitive(ordered.bottom, region.b);
  const lowerValue = primitive(ordered.top, region.a) - primitive(ordered.bottom, region.a);
  return immutable({ a: String(region.a), b: String(region.b), integrated: primitiveExpression(ordered.top, ordered.bottom),
    substitution: `(${substitute(region.b)}) − (${substitute(region.a)})`,
    subtraction: `${formatValue(upperValue).text} − ${formatValue(lowerValue).text} = ${formatValue(analysis.area).text}`,
    upperValue, lowerValue, area: analysis.area });
};

export type LaterMathScene = Readonly<{
  triangles: ReturnType<typeof trianglePresentation>; area: MathExpression; strip: MathExpression;
  constant: MathExpression; fixedTerm: MathExpression;
  comparison: readonly Readonly<{ label: string; expression: MathExpression }>[];
  recapRegion: string; recapInterval: string; height: MathExpression; submitted: string;
  worked: WorkedAreaScene | null;
  division: Readonly<{ lower: string; upper: string; rectangle: MathExpression; half: MathExpression; formula: MathExpression; derivative: MathExpression }>;
}>;
/** Prepare only the active stage's algebra; no histories or DOM objects enter this pipeline. */
export const laterMathLayout = (state: IntegrationState): LaterMathScene => {
  const region = effectiveRegion(state);
  const activeArea = state.stage === 6 || (state.stage === 7 && state.part === "finished");
  const area = activeArea ? amount(analyseRegion(region).area) : [];
  let strip: MathExpression = [];
  if (state.stage === 6 && region.curves[0] !== region.curves[1]) {
    const analysis = analyseRegion(region);
    const piece = analysis.pieces[0] ?? orderedRegion(region.curves[0], region.curves[1], region.a, region.b);
    strip = [text(analysis.crossings.length ? "h(x) = |x² − 3x|" : "h(x) = " + functionExpression(piece.top) + " − (" + functionExpression(piece.bottom) + ") = " + heightExpression(piece.top, piece.bottom))];
  }
  const square = state.function === "square";
  const estimates = state.stage === 4 && state.divisionSubsection === "square" ? quadraticEstimates(3, effectiveRectangleCount(state)) : null;
  return immutable({
    triangles: state.stage === 5 ? trianglePresentation(region.b) : [],
    area, strip,
    constant: [text("A(b) = "), fraction("b²"), text(" − "), fraction("1")],
    fixedTerm: [text("C = −"), fraction("1")],
    comparison: state.stage === 3 && state.prediction && state.demonstration === 1 && !square ? [2, 4].map((width) => ({
      label: width === 2 ? "Before:" : "After:", expression: state.function === "rising" ? [fraction(width + " × " + width), text(" = " + width * width / 2)] : [text("2 × " + width + " = " + 2 * width)],
    })) : [],
    recapRegion: state.part === "finished" ? "Between " + selectionLabel(region.curves[0]) + " and " + selectionLabel(region.curves[1]) : "",
    recapInterval: state.part === "finished" ? "From x = " + region.a + " to x = " + region.b : "",
    height: state.stage === 7 ? [text("h(x) = " + distanceExpression(region.curves, region.a, region.b))] : [],
    submitted: state.checked ? String(state.checked.submitted) : "",
    worked: state.stage === 7 && state.part === "finished" ? workedAreaLayout(region) : null,
    division: {
      lower: estimates?.lower.toFixed(1) ?? "", upper: estimates?.upper.toFixed(1) ?? "",
      rectangle: [text("3 × 3 = 9")], half: [fraction("1"), text(" × 9 = "), ...amount(4.5)],
      formula: [text("Area = "), fraction(square ? "b³" : "b²", square ? "3" : "2")],
      derivative: [fraction("d", "db"), text(" ("), fraction("b³", "3"), text(") = b²")],
    },
  });
};
