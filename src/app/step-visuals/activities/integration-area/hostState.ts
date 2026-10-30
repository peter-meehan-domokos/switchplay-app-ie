import { immutable } from "../../core/immutable";
import { canAdvance, canFinish, canGoPrevious, initialIntegration, integrationReducer, type IntegrationAction, type IntegrationPanel, type IntegrationState } from "./learning";
import { divisionCounts, isStage6Region, isStage7Region, stageId } from "./model";
import type { Calculation, IntegrationAttemptV2, Prediction, Region } from "./records";

/** Bounded resumption evidence. Full checks, predictions and events live in Visual Learning Records. */
type Evidence = Readonly<{ assistanceRequested: boolean; predictions: readonly Prediction[]; lastCheck: Calculation | null }>;
export type IntegrationSnapshot = Readonly<{
  snapshotSchema: 1; activityId: "integration-area"; activityVersion: 2;
  attemptId: string; attemptNumber: number; sequence: number;
  panel: IntegrationPanel; previousPanels: readonly IntegrationPanel[]; nextPanels: readonly IntegrationPanel[]; evidence: Evidence;
}>;
export type IntegrationHostedState = Readonly<{ state: IntegrationState; sequence: number }>;

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const fields = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < Number.MAX_SAFE_INTEGER - 100;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const growth = (v: unknown) => v === "flat" || v === "rising" || v === "square";
const region = (v: unknown): v is Region => object(v) && fields(v, ["curves", "a", "b"])
  && Array.isArray(v.curves) && v.curves.length === 2 && v.curves.every(c => ["flat", "rising", "square", "lower", "upper", "parabola", "axis"].includes(c))
  && finite(v.a) && finite(v.b) && v.a >= 0 && v.a <= v.b && v.b <= 4;
const prediction = (v: unknown): v is Prediction => object(v) && fields(v, ["function", "multiplier", "observed", "correct"])
  && growth(v.function) && [2, 4, 8].includes(Number(v.multiplier)) && typeof v.multiplier === "number"
  && v.observed === true && typeof v.correct === "boolean";
const calculation = (v: unknown): v is Calculation => object(v) && fields(v, ["number", "region", "submitted", "expected", "correct", "assisted", "problemRevision", "answerRevision"])
  && count(v.number) && v.number > 0 && region(v.region) && isStage7Region(v.region) && finite(v.submitted) && finite(v.expected)
  && v.expected >= 0 && typeof v.correct === "boolean" && typeof v.assisted === "boolean" && count(v.problemRevision) && count(v.answerRevision);

function validPanel(v: unknown): v is IntegrationPanel {
  if (!object(v) || !fields(v, ["stage", "part", "region", "function", "rectangles", "divisionSubsection", "prediction", "comparisons", "demonstration", "comparisonRun", "draft", "feedback", "helpOpen", "checked", "problemRevision", "answerRevision"])
    || !count(v.stage) || v.stage < 1 || v.stage > 7 || !region(v.region) || !growth(v.function)
    || !count(v.rectangles) || v.rectangles < 1 || v.rectangles > 128 || !["rising", "square", "rule"].includes(String(v.divisionSubsection))
    || (v.prediction !== null && !prediction(v.prediction)) || !object(v.comparisons)
    || !Object.entries(v.comparisons).every(([key, saved]) => growth(key) && object(saved) && fields(saved, ["prediction", "demonstrated"])
      && typeof saved.demonstrated === "boolean" && (saved.prediction === null || prediction(saved.prediction) && saved.prediction.function === key && saved.demonstrated))
    || (v.demonstration !== 0 && v.demonstration !== 1) || !count(v.comparisonRun) || typeof v.draft !== "string" || v.draft.length > 4096
    || ![null, "correct", "incorrect", "invalid", "empty"].includes(v.feedback as string | null) || typeof v.helpOpen !== "boolean"
    || (v.checked !== null && !calculation(v.checked)) || !count(v.problemRevision) || !count(v.answerRevision)) return false;
  const p = v as unknown as IntegrationPanel, r = p.region;
  if (p.stage === 1 && (r.curves[0] !== "flat" || r.curves[1] !== "axis" || r.a !== 0 || p.part !== "compare")) return false;
  if (p.stage === 2 && (!["flat", "rising"].includes(p.function) || r.curves[0] !== p.function || r.curves[1] !== "axis" || r.a !== 0 || r.b !== 3 || p.part !== "refine")) return false;
  if (p.stage === 3 && (r.curves[0] !== p.function || r.curves[1] !== "axis" || r.a !== 0 || r.b !== 2 + 2 * p.demonstration || p.part !== "compare"
    || !!p.prediction && (p.prediction.function !== p.function || p.demonstration !== 1))) return false;
  if (p.stage === 4 && (!(["rising", "square"] as string[]).includes(p.function) || r.curves[0] !== p.function || r.curves[1] !== "axis" || r.a !== 0 || r.b !== 3 || p.part !== "compare"
    || p.divisionSubsection !== "rule" && p.divisionSubsection !== p.function || !(divisionCounts as readonly number[]).includes(p.rectangles))) return false;
  if (p.stage === 5 && (r.curves[0] !== "rising" || r.curves[1] !== "axis" || r.a !== 1 || !Number.isInteger(r.b) || r.b < 1 || p.part !== "compare")) return false;
  if (p.stage === 6 && (!isStage6Region(r) || p.part !== "compare")) return false;
  if (p.stage === 7 && (!isStage7Region(r) || !["calculate", "finished"].includes(p.part))) return false;
  if (p.checked && (p.stage !== 7 || p.checked.problemRevision !== p.problemRevision || p.checked.answerRevision !== p.answerRevision
    || p.checked.region.a !== r.a || p.checked.region.b !== r.b || p.checked.region.curves.some((c, i) => c !== r.curves[i])
    || p.feedback !== (p.checked.correct ? "correct" : "incorrect"))) return false;
  if ((p.feedback === "correct" || p.feedback === "incorrect" || p.part === "finished") && !p.checked) return false;
  return !p.helpOpen || !!p.checked && !p.checked.correct;
}

export function isIntegrationSnapshot(v: unknown): v is IntegrationSnapshot {
  if (!object(v) || !fields(v, ["snapshotSchema", "activityId", "activityVersion", "attemptId", "attemptNumber", "sequence", "panel", "previousPanels", "nextPanels", "evidence"])
    || v.snapshotSchema !== 1 || v.activityId !== "integration-area" || v.activityVersion !== 2
    || typeof v.attemptId !== "string" || !v.attemptId.trim() || v.attemptId.length > 200 || !count(v.attemptNumber) || v.attemptNumber < 1 || !count(v.sequence)
    || !validPanel(v.panel) || !Array.isArray(v.previousPanels) || !Array.isArray(v.nextPanels)
    || v.previousPanels.length !== v.panel.stage - 1 || v.nextPanels.length > 7 - v.panel.stage
    || !v.previousPanels.every((p, i) => validPanel(p) && p.stage === i + 1)
    || !v.nextPanels.every((p, i) => validPanel(p) && p.stage === (v.panel as IntegrationPanel).stage + i + 1)
    || !object(v.evidence) || !fields(v.evidence, ["assistanceRequested", "predictions", "lastCheck"])
    || typeof v.evidence.assistanceRequested !== "boolean" || !Array.isArray(v.evidence.predictions) || v.evidence.predictions.length > 3
    || !v.evidence.predictions.every(prediction) || new Set(v.evidence.predictions.map(p => p.function)).size !== v.evidence.predictions.length
    || v.evidence.lastCheck !== null && !calculation(v.evidence.lastCheck)) return false;
  const panels = [...v.previousPanels, v.panel, ...v.nextPanels] as IntegrationPanel[];
  const last = v.evidence.lastCheck as Calculation | null;
  return panels.every(p => (!p.checked || !!last && p.checked.number <= last.number) && (!p.helpOpen || v.evidence && (v.evidence as Evidence).assistanceRequested));
}

/** A partly animated comparison resumes from its semantic beginning, never invented completion. */
function panelSnapshot(state: IntegrationPanel): IntegrationPanel {
  const { stage, part, region, function: selected, rectangles, divisionSubsection, prediction, comparisons, comparisonRun, draft, feedback, helpOpen, checked, problemRevision, answerRevision } = state;
  const demonstration = stage === 3 ? state.demonstration === 1 || !!prediction || !!comparisons[selected]?.demonstrated ? 1 : 0 : state.demonstration;
  return immutable({ stage, part, region: stage === 3 ? { ...region, b: 2 + 2 * demonstration } : region, function: selected,
    rectangles, divisionSubsection, prediction, comparisons, demonstration, comparisonRun, draft, feedback, helpOpen, checked, problemRevision, answerRevision });
}
const boundedPredictions = (values: readonly Prediction[]) => [...new Map(values.map(p => [p.function, p])).values()];
export function integrationSnapshot({ state, sequence }: IntegrationHostedState): IntegrationSnapshot {
  const current = state.records.current;
  return immutable({ snapshotSchema: 1, activityId: "integration-area", activityVersion: 2, attemptId: current.attemptId, attemptNumber: current.attemptNumber, sequence,
    panel: panelSnapshot(state), previousPanels: state.previousPanels.map(panelSnapshot), nextPanels: state.nextPanels.map(panelSnapshot),
    evidence: { assistanceRequested: current.assistanceRequested, predictions: boundedPredictions(current.predictions), lastCheck: current.checks.at(-1) ?? null } });
}
export function createIntegrationHostedState(attemptId: string, attemptNumber = 1): IntegrationHostedState {
  if (!Number.isSafeInteger(attemptNumber) || attemptNumber < 1) throw new RangeError("Invalid attempt number.");
  return immutable({ state: initialIntegration(attemptId, attemptNumber), sequence: 1 });
}
/** No constructor, notification, completion replay or event allocation on hydration. */
export function restoreIntegrationHostedState(value: unknown): IntegrationHostedState {
  if (!isIntegrationSnapshot(value)) throw new RangeError("Invalid Integration snapshot.");
  const saved = structuredClone(value), p = saved.panel;
  const current: IntegrationAttemptV2 = { schemaVersion: 2, activityVersion: 2, activityId: "integration-area", attemptId: saved.attemptId, attemptNumber: saved.attemptNumber,
    stage: p.stage, stageId: stageId(p.stage), status: p.part === "finished" ? "completed" : "in-progress", region: p.region,
    predictions: saved.evidence.predictions, checks: saved.evidence.lastCheck ? [saved.evidence.lastCheck] : [], assistanceRequested: saved.evidence.assistanceRequested,
    successMode: p.part === "finished" && p.checked?.correct ? p.checked.assisted ? "assisted" : "independent" : null };
  return immutable({ sequence: saved.sequence, state: { ...p, previousPanels: saved.previousPanels, nextPanels: saved.nextPanels, edit: null, revision: 0, lastEditId: 0,
    records: { current, events: [], completedAttempts: [], partialAttempts: [], exited: false } } });
}
export function reduceIntegrationHostedState(hosted: IntegrationHostedState, action: IntegrationAction): IntegrationHostedState {
  if (action.type === "restart" || action.type === "exit") return hosted;
  const previous = hosted.state;
  const input = { ...previous, records: { ...previous.records, events: [], completedAttempts: [], partialAttempts: [],
    current: { ...previous.records.current, predictions: boundedPredictions(previous.records.current.predictions), checks: previous.records.current.checks.slice(-1) } } };
  const next = integrationReducer(input, action);
  if (next === input) return hosted;
  const events = next.records.events.map((event, index) => ({ ...event, sequence: hosted.sequence + index + 1, eventId: `${event.attemptId}:${hosted.sequence + index + 1}` }));
  return immutable({ sequence: hosted.sequence + events.length, state: { ...next, records: { ...next.records, events: [...previous.records.events, ...events] } } });
}
export function acknowledgeIntegrationEvents(hosted: IntegrationHostedState, through: number): IntegrationHostedState {
  if (!count(through) || through > hosted.sequence) throw new RangeError("Invalid event acknowledgement.");
  return immutable({ ...hosted, state: { ...hosted.state, records: { ...hosted.state.records, events: hosted.state.records.events.filter(e => e.sequence > through) } } });
}
export function integrationBackToStart(hosted: IntegrationHostedState): IntegrationHostedState {
  const previous = hosted.state;
  if (previous.part !== "finished" || previous.previousPanels.length !== 6) return hosted;
  const first = previous.previousPanels[0], sequence = hosted.sequence + 1, current = previous.records.current;
  const last: IntegrationPanel = { ...panelSnapshot(previous), part: "calculate" };
  return immutable({ sequence, state: { ...previous, ...first, edit: null, revision: previous.revision + 1,
    previousPanels: [], nextPanels: [...previous.previousPanels.slice(1), last],
    records: { ...previous.records, current: { ...current, stage: 1, stageId: stageId(1), region: first.region, status: "in-progress", successMode: null },
      events: [...previous.records.events, { schemaVersion: 2, activityVersion: 2, activityId: "integration-area", attemptId: current.attemptId,
        attemptNumber: current.attemptNumber, eventId: `${current.attemptId}:${sequence}`, sequence, stage: 1, stageId: stageId(1), type: "stage-changed",
        from: 7, to: 1, part: first.part, direction: "previous", view: { region: first.region } }] } } });
}
export function integrationHostNavigation({ state }: IntegrationHostedState) {
  return { stageId: stageId(state.stage), atStart: state.stage === 1, completed: state.part === "finished",
    hasMeaningfulProgress: state.stage > 1 || state.nextPanels.length > 0,
    previous: state.stage > 1 && state.part !== "finished" ? { enabled: canGoPrevious(state), action: "previous" as const } : null,
    next: state.part === "finished" ? null : state.stage === 7 ? { enabled: canFinish(state), action: "finish" as const, label: "Finish" as const }
      : { enabled: canAdvance(state), action: "next" as const, label: "Next" as const } };
}
