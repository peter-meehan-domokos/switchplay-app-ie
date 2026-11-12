import { recordObject as object, fields, count, finite, identityFields } from "../../core/recordShape";

const stages = ["orientation", "prediction", "reveal-position", "reveal-explanation", "retrieval", "completed"];
const root = (v: unknown) => Number.isInteger(v) && Number(v) >= -5 && Number(v) <= 5;
const prediction = (v: unknown) => object(v) && fields(v, ["proposedRoot", "chosenFactorRoot", "rootAtSubmission", "correct"])
  && v.proposedRoot === -3 && (v.chosenFactorRoot === 3 || v.chosenFactorRoot === -3) && root(v.rootAtSubmission) && (v.correct === null || typeof v.correct === "boolean");
const placement = (v: unknown) => object(v) && fields(v, ["stage", "fromRoot", "toRoot", "input"]) && stages.includes(String(v.stage))
  && root(v.fromRoot) && root(v.toRoot) && ["pointer", "keyboard"].includes(String(v.input));
const check = (v: unknown) => object(v) && fields(v, ["checkNumber", "root", "targetFactorConstant", "factorValue", "correct", "assistanceRequested"])
  && count(v.checkNumber) && v.checkNumber > 0 && root(v.root) && v.targetFactorConstant === 4 && finite(v.factorValue) && typeof v.correct === "boolean" && typeof v.assistanceRequested === "boolean";
function result(v: unknown, event: Record<string, unknown>) {
  return object(v) && fields(v, ["schemaVersion", "activityVersion", "activityId", "attemptId", "attemptNumber", "status", "stage", "settledRoot", "prediction", "placements", "checks", "checkAttempts", "incorrectChecks", "assistanceRequested", "successMode", "finalRoot"])
    && ["schemaVersion", "activityVersion", "activityId", "attemptId", "attemptNumber"].every(k => v[k] === event[k])
    && v.status === "completed" && v.stage === "completed" && v.settledRoot === -4 && v.finalRoot === -4
    && prediction(v.prediction) && object(v.prediction) && typeof v.prediction.correct === "boolean"
    && Array.isArray(v.placements) && v.placements.every(placement) && Array.isArray(v.checks) && v.checks.every(check)
    && count(v.checkAttempts) && v.checkAttempts > 0 && count(v.incorrectChecks) && v.incorrectChecks < v.checkAttempts
    && typeof v.assistanceRequested === "boolean" && ["assisted", "independent"].includes(String(v.successMode));
}
/** Validate the existing meaningful vocabulary; outcomes are reported facts, never re-graded here. */
export function isHostedRootsEvent(v: unknown): boolean {
  if (!object(v) || !count(v.attemptNumber) || v.attemptNumber < 1) return false;
  const shape = (...keys: string[]) => fields(v, [...identityFields, ...keys]);
  switch (v.type) {
    case "attempt-started": return shape("root") && v.root === 3;
    case "root-placed": return shape("placement") && placement(v.placement);
    case "prediction-submitted": return shape("prediction") && prediction(v.prediction) && object(v.prediction) && v.prediction.correct === null;
    case "prediction-tested": return shape("prediction") && prediction(v.prediction) && object(v.prediction) && typeof v.prediction.correct === "boolean";
    case "stage-changed": return shape("from", "to") && stages.includes(String(v.from)) && stages.includes(String(v.to));
    case "answer-checked": return shape("check") && check(v.check);
    case "assistance-requested": return shape("root") && root(v.root);
    case "attempt-completed": return shape("result") && result(v.result, v);
    default: return false;
  }
}
