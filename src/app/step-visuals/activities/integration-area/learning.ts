import { immutable } from "../../core/immutable";
import { analyseRegion, divisionCounts, isStage6Region, isStage7Region, stageId, type GrowthFunction, type IntegrationFunction } from "./model";
import type { Calculation, DivisionSubsection, IntegrationView, IntegrationResultV2, IntegrationStage, Region, Prediction, IntegrationRecordsV2, IntegrationAttemptV2, IntegrationEventDetail, IntegrationEventV2 } from "./records";

export type Boundary = "a" | "b";
export type Edit = Readonly<{ id: number; boundary: Boundary | "rectangles"; candidate: number; source: "graph" | "range"; settleTo?: number }>;
export type ComparisonMemory = Readonly<{ prediction: Prediction | null; demonstrated: boolean }>;
export type IntegrationPanel = Readonly<{
  stage: IntegrationStage; part: "compare" | "refine" | "calculate" | "finished";
  region: Region; function: GrowthFunction; rectangles: number;
  divisionSubsection: DivisionSubsection;
  prediction: Prediction | null; comparisons: Readonly<Partial<Record<GrowthFunction, ComparisonMemory>>>;
  demonstration: number; comparisonRun: number;
  draft: string; feedback: "correct" | "incorrect" | "invalid" | "empty" | null; helpOpen: boolean;
  checked: Calculation | null; problemRevision: number; answerRevision: number;
}>;
export type IntegrationState = IntegrationPanel & Readonly<{
  edit: Edit | null; revision: number; lastEditId: number;
  previousPanels: readonly IntegrationPanel[]; nextPanels: readonly IntegrationPanel[];
  records: IntegrationRecordsV2;
}>;
type Context = Readonly<{ revision: number }>;
export type IntegrationAction = Context & (
  | Readonly<{ type: "begin"; boundary: Boundary | "rectangles"; id: number; source?: "graph" | "range" }>
  | Readonly<{ type: "preview" | "release" | "commit"; id: number; value: number }>
  | Readonly<{ type: "demonstrate"; progress: number }>
  | Readonly<{ type: "cancel"; id: number }>
  | Readonly<{ type: "place"; boundary: Boundary; value: number; input: "keyboard" | "value" }>
  | Readonly<{ type: "next" | "previous" }>
  | Readonly<{ type: "function"; function: GrowthFunction }>
  | Readonly<{ type: "division-subsection"; subsection: DivisionSubsection }>
  | Readonly<{ type: "refine"; rectangles: number }>
  | Readonly<{ type: "predict"; multiplier: number }>
  | Readonly<{ type: "select"; boundary: "top" | "bottom"; value: IntegrationFunction }>
  | Readonly<{ type: "interval"; a: number; b: number }>
  | Readonly<{ type: "draft"; value: string }>
  | Readonly<{ type: "check" | "help" | "finish" }>
  | Readonly<{ type: "restart"; attemptId: string }>
  | Readonly<{ type: "exit" }>
) | Readonly<{ type: "suspend" }>;

export const initialIntegration = (attemptId: string, attemptNumber = 1, revision = 0): IntegrationState => {
  if (!attemptId.trim()) throw new Error("An attempt identity is required.");
  const region: Region = { curves: ["flat", "axis"], a: 0, b: 1 };
  const current: IntegrationAttemptV2 = { schemaVersion: 2, activityVersion: 2, activityId: "integration-area", attemptId, attemptNumber,
    stage: 1, stageId: stageId(1), status: "in-progress", region, predictions: [], checks: [], assistanceRequested: false, successMode: null };
  return record({ stage: 1, part: "compare", region, function: "flat", rectangles: 4, divisionSubsection: "rising", prediction: null, comparisons: {}, demonstration: 0, comparisonRun: 0,
    edit: null, revision, lastEditId: 0, draft: "", feedback: null, helpOpen: false, checked: null, problemRevision: 0, answerRevision: 0,
    previousPanels: Object.freeze([]), nextPanels: Object.freeze([]),
    records: { current, events: [], completedAttempts: Object.freeze([]), partialAttempts: Object.freeze([]), exited: false } }, [{ type: "attempt-started", view: { region } }]);
};

/** Describe the destination after restoration, not an inferred default or a transient frame. */
const arrivalView = (state: IntegrationPanel): IntegrationView => ({ region: state.stage === 3 ? { ...state.region, b: 2 + 2 * state.demonstration } : state.region,
  ...(state.stage === 4 ? { subsection: state.divisionSubsection } : state.stage === 2 || state.stage === 3 ? { subsection: state.function } : {}) });

/** Only accepted semantic actions visit history. Pointer previews never traverse it. */
const record = (state: IntegrationState, details: readonly IntegrationEventDetail[], currentChanges: Partial<IntegrationAttemptV2> = {}): IntegrationState => {
  const current = immutable({ ...state.records.current, region: { ...state.region, curves: [...state.region.curves] as const }, stage: state.stage, stageId: stageId(state.stage), ...currentChanges });
  const events = details.map((detail, index): IntegrationEventV2 => immutable({
    ...detail, schemaVersion: 2, activityVersion: 2, activityId: "integration-area", attemptId: current.attemptId,
    attemptNumber: current.attemptNumber, sequence: state.records.events.length + index + 1,
    eventId: current.attemptId + ":" + (state.records.events.length + index + 1), stage: state.stage, stageId: stageId(state.stage),
  }));
  return Object.freeze({ ...state, region: current.region, records: Object.freeze({ ...state.records, current, events: Object.freeze([...state.records.events, ...events]) }) });
};

export const effectiveRegion = (state: IntegrationState): Region => state.stage === 3 ? { ...state.region, b: 2 + 2 * state.demonstration } : state.edit && state.edit.boundary !== "rectangles" ? { ...state.region, [state.edit.boundary]: state.edit.candidate } : state.region;
export const effectiveRectangleCount = (state: IntegrationState): number => state.edit?.boundary === "rectangles" ? state.edit.candidate : state.rectangles;
export const boundaryBounds = (state: IntegrationState, boundary: Boundary): readonly [number, number] | null => {
  if (state.records.exited || state.part === "finished" || boundary !== "b") return null;
  if (state.stage === 1) return [0, 4];
  if (state.stage === 5 || state.stage === 6) return [1, 4];
  return null;
};
export const releasePolicy = (stage: IntegrationStage) => stage === 5 ? "integer" : "continuous";
const constrained = (state: IntegrationState, boundary: Boundary, value: number) => {
  const bounds = boundaryBounds(state, boundary);
  return bounds && Number.isFinite(value) ? Math.max(bounds[0], Math.min(bounds[1], value)) : null;
};
const settled = (state: IntegrationState, value: number) => releasePolicy(state.stage) === "integer" ? Math.round(value) : value;
const validRefinement = (state: IntegrationState, count: number) => Number.isInteger(count) && (state.stage === 2 ? count >= 1 && count <= 128 : state.stage === 4 && state.divisionSubsection === "square" && (divisionCounts as readonly number[]).includes(count));
const refinement = (state: IntegrationState, rectangles: number): IntegrationState => {
  if (!validRefinement(state, rectangles) || (!state.edit && rectangles === state.rectangles)) return state;
  const next = { ...state, rectangles, edit: null, revision: state.revision + 1 };
  return rectangles === state.rectangles ? Object.freeze(next) : record(next, [{ type: "refinement-changed", rectangles }]);
};
const placement = (state: IntegrationState, boundary: Boundary, value: number, input: "pointer" | "keyboard" | "value"): IntegrationState => {
  const candidate = constrained(state, boundary, value);
  if (candidate === null) return state;
  const to = settled(state, candidate), from = state.region[boundary];
  const next = { ...state, edit: null, revision: state.revision + 1 };
  if (to === from) return Object.freeze(next);
  return record({ ...next, region: Object.freeze({ ...state.region, [boundary]: to }) }, [{ type: "boundary-committed", boundary, from, to, input }]);
};
export const canAdvance = (state: IntegrationState) => !state.edit && !state.records.exited && state.stage < 7 && (state.stage !== 3 || !!state.prediction?.observed);
export const canFinish = (state: IntegrationState) => !state.edit && !state.records.exited && state.stage === 7 && state.part === "calculate" && !!state.checked && state.checked.problemRevision === state.problemRevision && state.checked.answerRevision === state.answerRevision;
export const canGoPrevious = (state: IntegrationState) => !state.edit && !state.records.exited && state.part !== "finished" && state.previousPanels.length > 0;

const panelSnapshot = ({ stage, part, region, function: comparison, rectangles, divisionSubsection, prediction, comparisons, demonstration, comparisonRun, draft, feedback, helpOpen, checked, problemRevision, answerRevision }: IntegrationPanel): IntegrationPanel =>
  Object.freeze({ stage, part, region, function: comparison, rectangles, divisionSubsection, prediction, comparisons, demonstration: stage === 3 && prediction ? 1 : demonstration, comparisonRun, draft, feedback, helpOpen, checked, problemRevision, answerRevision });
const previousStage = (state: IntegrationState): IntegrationState => {
  if (!canGoPrevious(state)) return state;
  const panel = state.previousPanels.at(-1)!;
  return record({ ...state, ...panel, revision: state.revision + 1,
    previousPanels: Object.freeze(state.previousPanels.slice(0, -1)), nextPanels: Object.freeze([panelSnapshot(state), ...state.nextPanels]) },
  [{ type: "stage-changed", from: state.stage, to: panel.stage, part: panel.part, direction: "previous", view: arrivalView(panel) }]);
};
export const parseCalculation = (value: string): number | null => {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isFinite(number) ? (number === 0 ? 0 : number) : null;
};
export const CALCULATION_ABSOLUTE_TOLERANCE = 1e-9;
export const CALCULATION_RELATIVE_TOLERANCE = 1e-9;

const nextStage = (state: IntegrationState): IntegrationState => {
  if (!canAdvance(state)) return state;
  let next: IntegrationState = { ...state, revision: state.revision + 1, draft: "", feedback: null, helpOpen: false };
  if (state.stage === 1) next = { ...next, stage: 2, part: "refine", function: "flat", rectangles: 4, region: { curves: ["flat", "axis"], a: 0, b: 3 } };
  else if (state.stage === 2) next = { ...next, stage: 3, part: "compare", function: "flat", region: { curves: ["flat", "axis"], a: 0, b: 2 }, prediction: null, demonstration: 0, comparisonRun: state.comparisonRun + 1 };
  else if (state.stage === 3) next = { ...next, stage: 4, part: "compare", function: "rising", divisionSubsection: "rising", rectangles: 4, region: { curves: ["rising", "axis"], a: 0, b: 3 } };
  else if (state.stage === 4) next = { ...next, stage: 5, function: "rising", region: { curves: ["rising", "axis"], a: 1, b: 3 } };
  else if (state.stage === 5) next = { ...next, stage: 6, region: { curves: ["rising", "lower"], a: 1, b: 3 } };
  else next = { ...next, stage: 7, part: "calculate", region: { curves: ["upper", "parabola"], a: 1, b: 2 }, checked: null, problemRevision: 0, answerRevision: 0 };
  const saved = state.nextPanels[0];
  if (saved && saved.stage === next.stage) next = { ...next, ...saved };
  next = { ...next, previousPanels: Object.freeze([...state.previousPanels, panelSnapshot(state)]), nextPanels: Object.freeze(state.nextPanels.slice(1)) };
  return record(next, [{ type: "stage-changed", from: state.stage, to: next.stage, part: next.part, direction: "next", view: arrivalView(next) }]);
};

export const integrationReducer = (state: IntegrationState, action: IntegrationAction, active = true): IntegrationState => {
  if (action.type === "suspend") return state.edit ? Object.freeze({ ...state, edit: null, revision: state.revision + 1 }) : state;
  if (action.revision !== state.revision || state.records.exited) return state;
  if (!active && action.type !== "exit" && action.type !== "restart" && action.type !== "cancel") return state;
  if (action.type === "demonstrate") {
    if (state.stage !== 3 || !Number.isFinite(action.progress) || action.progress <= state.demonstration || action.progress > 1) return state;
    const cached = state.comparisons[state.function];
    const moving = Object.freeze({ ...state, demonstration: action.progress });
    if (action.progress !== 1) return moving;
    const finished = { ...moving, region: { ...state.region, b: 4 }, comparisons: Object.freeze({ ...state.comparisons, [state.function]: Object.freeze({ prediction: state.prediction, demonstrated: true }) }) };
    return cached?.demonstrated ? Object.freeze(finished) : record(finished, [{ type: "comparison-demonstrated", function: state.function, from: 2, to: 4 }]);
  }
  if (action.type === "restart") {
    if (!action.attemptId.trim() || action.attemptId === state.records.current.attemptId || state.records.completedAttempts.some((attempt) => attempt.attemptId === action.attemptId) || state.records.partialAttempts.some((attempt) => attempt.attemptId === action.attemptId)) return state;
    const archived = record({ ...state, edit: null }, [{ type: "attempt-restarted", nextAttemptId: action.attemptId }]);
    const partialAttempts = state.records.current.status === "completed" ? state.records.partialAttempts : Object.freeze([...state.records.partialAttempts, immutable({ ...state.records.current, status: "restarted" as const })]);
    const fresh = initialIntegration(action.attemptId, state.records.current.attemptNumber + 1, state.revision + 1);
    return record({ ...fresh, records: { ...fresh.records, events: archived.records.events, partialAttempts, completedAttempts: state.records.completedAttempts } }, [{ type: "attempt-started", view: arrivalView(fresh) }]);
  }
  if (action.type === "exit") {
    const exited = record({ ...state, edit: null, revision: state.revision + 1 }, [{ type: "attempt-exited" }], state.records.current.status === "completed" ? {} : { status: "exited" });
    return Object.freeze({ ...exited, records: Object.freeze({ ...exited.records, exited: true,
      partialAttempts: state.records.current.status === "completed" ? exited.records.partialAttempts : Object.freeze([...exited.records.partialAttempts, exited.records.current]) }) });
  }
  if (action.type === "cancel") return state.edit?.id === action.id ? Object.freeze({ ...state, edit: null, revision: state.revision + 1 }) : state;
  if (action.type === "begin") {
    const permitted = action.boundary === "rectangles" ? state.stage === 2 || (state.stage === 4 && state.divisionSubsection === "square") : boundaryBounds(state, action.boundary);
    if (state.edit || !permitted || !Number.isSafeInteger(action.id) || action.id <= state.lastEditId) return state;
    return Object.freeze({ ...state, lastEditId: action.id, edit: Object.freeze({ id: action.id, boundary: action.boundary, candidate: action.boundary === "rectangles" ? state.rectangles : state.region[action.boundary], source: action.source ?? "graph" }) });
  }
  if (action.type === "preview" || action.type === "release" || action.type === "commit") {
    if (state.edit?.id !== action.id) return state;
    if (state.edit.boundary === "rectangles") {
      if (!validRefinement(state, action.value)) return state;
      if (action.type !== "preview") return refinement(state, action.value);
      return action.value === state.edit.candidate ? state : Object.freeze({ ...state, edit: Object.freeze({ ...state.edit, candidate: action.value }) });
    }
    const value = constrained(state, state.edit.boundary, action.value);
    if (value === null) return state;
    if (action.type === "release" && releasePolicy(state.stage) === "integer" && value !== Math.round(value)) return Object.freeze({ ...state, edit: Object.freeze({ ...state.edit, candidate: value, settleTo: Math.round(value) }) });
    if (action.type !== "preview") return placement(state, state.edit.boundary, value, "pointer");
    return value === state.edit.candidate ? state : Object.freeze({ ...state, edit: Object.freeze({ ...state.edit, candidate: value }) });
  }
  if (state.edit) return state;
  if (action.type === "place") return placement(state, action.boundary, action.value, action.input);
  if (state.part === "finished") return state;
  if (action.type === "previous") return previousStage(state);
  if (action.type === "next") return nextStage(state);
  if (action.type === "division-subsection" || (action.type === "function" && state.stage === 4)) {
    const subsection = action.type === "division-subsection" ? action.subsection : action.function;
    if (state.stage !== 4 || !["rising", "square", "rule"].includes(subsection) || subsection === state.divisionSubsection) return state;
    if (subsection === "rule") return record({ ...state, divisionSubsection: "rule", revision: state.revision + 1 }, [{ type: "division-rule-viewed" }]);
    const graph = subsection as "rising" | "square";
    return record({ ...state, divisionSubsection: graph, function: graph, region: { ...state.region, curves: [graph, "axis"] }, revision: state.revision + 1 }, [{ type: "division-mode-selected", function: graph }]);
  }
  if (action.type === "function") {
    const allowed = state.stage === 2 ? ["flat", "rising"] : state.stage === 3 ? ["flat", "rising", "square"] : state.stage === 4 ? ["rising", "square"] : [];
    if (!allowed.includes(action.function) || action.function === state.function) return state;
    const compare = state.stage === 3;
    return record({ ...state, function: action.function, region: { ...state.region, curves: [action.function, "axis"], ...(compare ? { b: state.comparisons[action.function]?.demonstrated ? 4 : 2 } : {}) },
      ...(compare ? { prediction: state.comparisons[action.function]?.prediction ?? null, demonstration: 0, comparisonRun: state.comparisonRun + 1 } : {}),
      revision: state.revision + 1 }, [state.stage === 4 ? { type: "division-mode-selected", function: action.function as "rising" | "square" } : { type: "function-selected", function: action.function }]);
  }
  if (action.type === "refine") return refinement(state, action.rectangles);
  if (action.type === "predict") {
    if (state.stage !== 3 || state.demonstration !== 1 || state.prediction || ![2, 4, 8].includes(action.multiplier)) return state;
    const submitted: Prediction = immutable({ function: state.function, multiplier: action.multiplier, observed: false, correct: null });
    const prediction: Prediction = immutable({ ...submitted, observed: true, correct: action.multiplier === ({ flat: 2, rising: 4, square: 8 })[state.function] });
    return record({ ...state, prediction, comparisons: immutable({ ...state.comparisons, [state.function]: { prediction, demonstrated: true } }), revision: state.revision + 1 },
      [{ type: "prediction-submitted", prediction: submitted }, { type: "prediction-tested", prediction }], { predictions: [...state.records.current.predictions, prediction] });
  }
  if (action.type === "select") {
    if (state.stage !== 6 && state.stage !== 7) return state;
    const allowed = state.stage === 6 ? ["rising", "lower", "axis"] : ["upper", "parabola", "axis"];
    if (!allowed.includes(action.value)) return state;
    const index = action.boundary === "top" ? 0 : 1;
    if (state.region.curves[index] === action.value) return state;
    const curves = state.region.curves.map((value, position) => position === index ? action.value : value) as unknown as Region["curves"];
    const region = { ...state.region, curves };
    if (!(state.stage === 6 ? isStage6Region(region) : isStage7Region(region))) return state;
    return record({ ...state, region, draft: "", feedback: null, helpOpen: false, checked: null, problemRevision: state.problemRevision + 1, answerRevision: state.answerRevision + 1, revision: state.revision + 1 }, [{ type: "region-selected", region }]);
  }
  if (action.type === "interval") {
    if (state.stage !== 7 || ![[0, 1], [1, 2], [0, 2]].some(([a, b]) => a === action.a && b === action.b) || (state.region.a === action.a && state.region.b === action.b)) return state;
    const region = { ...state.region, a: action.a, b: action.b };
    return record({ ...state, region, draft: "", feedback: null, helpOpen: false, checked: null, problemRevision: state.problemRevision + 1, answerRevision: state.answerRevision + 1, revision: state.revision + 1 }, [{ type: "interval-selected", region }]);
  }
  if (state.stage !== 7 || state.part !== "calculate") return state;
  if (action.type === "draft") return action.value === state.draft ? state : Object.freeze({ ...state, draft: action.value, feedback: null, checked: null, helpOpen: false, answerRevision: state.answerRevision + 1, revision: state.revision + 1 });
  if (action.type === "help") {
    if (!state.checked || state.checked.correct || state.helpOpen) return state;
    return record({ ...state, helpOpen: true, revision: state.revision + 1 }, [{ type: "assistance-requested", region: state.region }], { assistanceRequested: true });
  }
  if (action.type === "finish") {
    if (!canFinish(state)) return state;
    const calculation = state.checked!;
    const result: IntegrationResultV2 = immutable({ ...state.records.current, status: "completed", successMode: calculation.correct ? calculation.assisted ? "assisted" : "independent" : null,
      outcome: calculation.correct ? "correct" : "incorrect", finalCalculation: calculation, area: calculation.expected });
    return record({ ...state, part: "finished", revision: state.revision + 1, helpOpen: false, records: { ...state.records, completedAttempts: Object.freeze([...state.records.completedAttempts, result]) } }, [{ type: "attempt-completed", result }], result);
  }
  if (action.type === "check") {
    const submitted = parseCalculation(state.draft);
    if (submitted === null) {
      const feedback = state.draft.trim() ? "invalid" : "empty";
      return state.feedback === feedback ? state : Object.freeze({ ...state, feedback, revision: state.revision + 1 });
    }
    const expected = analyseRegion(state.region).area;
    const correct = Math.abs(submitted - expected) <= CALCULATION_ABSOLUTE_TOLERANCE + CALCULATION_RELATIVE_TOLERANCE * Math.max(1, Math.abs(expected));
    const calculation: Calculation = immutable({ number: state.records.current.checks.length + 1, region: { ...state.region, curves: [...state.region.curves] }, submitted, expected, correct, assisted: state.records.current.assistanceRequested, problemRevision: state.problemRevision, answerRevision: state.answerRevision });
    return record({ ...state, checked: calculation, revision: state.revision + 1, feedback: correct ? "correct" : "incorrect" }, [{ type: "calculation-checked", calculation }], { checks: [...state.records.current.checks, calculation] });
  }
  return state;
};
