import { recordObject as object, fields, count, finite, identityFields } from "../../core/recordShape";
import { stageId, type IntegrationStage } from "./model";

const growth = (v: unknown) => ["flat", "rising", "square"].includes(String(v));
const stage = (v: unknown): v is IntegrationStage => count(v) && v >= 1 && v <= 7;
const region = (v: unknown) => object(v) && fields(v, ["curves", "a", "b"]) && Array.isArray(v.curves) && v.curves.length === 2
  && v.curves.every(c => ["flat", "rising", "square", "lower", "upper", "parabola", "axis"].includes(c)) && finite(v.a) && finite(v.b) && v.a >= 0 && v.a <= v.b && v.b <= 4;
const prediction = (v: unknown) => object(v) && fields(v, ["function", "multiplier", "observed", "correct"]) && growth(v.function)
  && typeof v.multiplier === "number" && [2, 4, 8].includes(v.multiplier) && typeof v.observed === "boolean" && (v.correct === null || typeof v.correct === "boolean");
const calculation = (v: unknown) => object(v) && fields(v, ["number", "region", "submitted", "expected", "correct", "assisted", "problemRevision", "answerRevision"])
  && count(v.number) && v.number > 0 && region(v.region) && finite(v.submitted) && finite(v.expected) && typeof v.correct === "boolean"
  && typeof v.assisted === "boolean" && count(v.problemRevision) && count(v.answerRevision);
const view = (v: unknown) => object(v) && fields(v, ["region"], ["subsection"]) && region(v.region) && (v.subsection === undefined || growth(v.subsection) || v.subsection === "rule");
function result(v: unknown, event: Record<string, unknown>) {
  return object(v) && fields(v, ["schemaVersion", "activityVersion", "activityId", "attemptId", "attemptNumber", "stage", "stageId", "status", "region", "predictions", "checks", "assistanceRequested", "successMode", "area", "outcome", "finalCalculation"])
    && ["schemaVersion", "activityVersion", "activityId", "attemptId", "attemptNumber"].every(k => v[k] === event[k]) && v.status === "completed" && v.stage === 7 && v.stageId === stageId(7)
    && region(v.region) && Array.isArray(v.predictions) && v.predictions.every(prediction) && Array.isArray(v.checks) && v.checks.every(calculation)
    && typeof v.assistanceRequested === "boolean" && [null, "assisted", "independent"].includes(v.successMode as string | null)
    && finite(v.area) && ["correct", "incorrect"].includes(String(v.outcome)) && calculation(v.finalCalculation);
}
export function isHostedIntegrationEvent(v: unknown): boolean {
  if (!object(v) || !count(v.attemptNumber) || v.attemptNumber < 1 || !stage(v.stage) || v.stageId !== stageId(v.stage)) return false;
  const shape = (keys: string[], optional: string[] = []) => fields(v, [...identityFields, "stage", "stageId", ...keys], optional);
  switch (v.type) {
    case "attempt-started": return shape([], ["view"]) && (v.view === undefined || view(v.view));
    case "boundary-committed": return shape(["boundary", "from", "to", "input"]) && ["a", "b"].includes(String(v.boundary)) && finite(v.from) && finite(v.to) && ["pointer", "keyboard", "value"].includes(String(v.input));
    case "function-selected": return shape(["function"]) && growth(v.function);
    case "division-mode-selected": return shape(["function"]) && ["rising", "square"].includes(String(v.function));
    case "division-rule-viewed": return shape([]);
    case "comparison-demonstrated": return shape(["function", "from", "to"]) && growth(v.function) && v.from === 2 && v.to === 4;
    case "refinement-changed": return shape(["rectangles"]) && count(v.rectangles) && v.rectangles >= 1 && v.rectangles <= 128;
    case "prediction-submitted": case "prediction-tested": return shape(["prediction"]) && prediction(v.prediction);
    case "region-selected": case "interval-selected": case "assistance-requested": return shape(["region"]) && region(v.region);
    case "stage-changed": return shape(["from", "to", "part"], ["direction", "view"]) && stage(v.from) && stage(v.to) && ["compare", "refine", "calculate", "finished"].includes(String(v.part))
      && (v.direction === undefined || ["previous", "next"].includes(String(v.direction))) && (v.view === undefined || view(v.view));
    case "calculation-checked": return shape(["calculation"]) && calculation(v.calculation);
    case "attempt-completed": return shape(["result"]) && result(v.result, v);
    default: return false;
  }
}
