import { assertCardContent, CardArchitectureError, isRecord, nonblank, requireCondition } from "../cards/domain";
import type { CardData, CardTemplateRoot, CardTemplateVersion } from "../cards/model";
import { assertCardVersionAccess } from "../cards/versionAccess";
import type { CompletionStatus } from "../../components/decks/types";
import { getProgressPercentage } from "../progress";
import { getConfidenceScore } from "../signals";
import type { Framework, FrameworkIssue } from "./configuration";
import type { PersonalEligibility } from "./eligibility";
import { resolveEffectiveMapping, validateFrameworkAncestry, type CanonicalAncestry } from "./mapping";

export type CardCalculation =
  | { state: "complete"; cardTemplateId: string; adoptedVersion: number;
      steps: { stepId: string; completionStatus: CompletionStatus }[]; readings: (number | null)[] }
  | { state: "incomplete"; cardTemplateId: string; issues: FrameworkIssue[] };
export type CalculationResult = {
  state: "complete" | "empty" | "incomplete";
  completion: number | null;
  confidence: number | null;
  eligibleCardCount: number | null;
  resolvedCardCount: number;
  issues: FrameworkIssue[];
};

// Use only the actor's personal records. Canonical ancestry does not authorize
// access to another user's CardData. Historical Step entries are not inputs.
export function resolveAdoptedCardCalculation(actor: string, id: string, roots: readonly CardTemplateRoot[], versions: readonly CardTemplateVersion[], records: readonly CardData[]): CardCalculation {
  const fail = (code: string): CardCalculation => ({ state: "incomplete", cardTemplateId: id, issues: [{ code, cardTemplateIds: [id] }] });
  const selectedRoots = roots.filter((root) => root.cardTemplateId === id);
  const selectedData = records.filter((data) => data.cardTemplateId === id);
  if (selectedRoots.length !== 1) return fail("MISSING_OR_AMBIGUOUS_CARD_ROOT");
  if (selectedData.length !== 1) return fail("MISSING_OR_AMBIGUOUS_CARD_DATA");
  const root = selectedRoots[0], data = selectedData[0];
  if (!Number.isInteger(data.cardTemplateVersion) || data.cardTemplateVersion < 1) return fail("INVALID_ADOPTED_VERSION");
  const selected = versions.filter((version) => version.cardTemplateId === id && version.version === data.cardTemplateVersion);
  if (selected.length !== 1) return fail("MISSING_OR_AMBIGUOUS_CARD_VERSION");
  const version = selected[0];
  try {
    assertCardVersionAccess(actor, root, version);
    assertCardContent(version.content);
    requireCondition(Array.isArray(data.items) && Array.isArray(data.signalReadings), "INVALID_PERSONAL_STEP_STATE");
    requireCondition([...data.items, ...data.signalReadings].every((entry) => isRecord(entry) && nonblank(entry.stepId)), "INVALID_PERSONAL_STEP_STATE");
    const steps = version.content.steps.map((step) => {
      const values = data.items.filter((entry) => entry.stepId === step.stepId);
      requireCondition(values.length <= 1, "AMBIGUOUS_COMPLETION_STATE");
      const completionStatus = values.length ? values[0].completionStatus : "todo";
      requireCondition(["todo", "inProgress", "done", "skipped"].includes(completionStatus), "INVALID_COMPLETION_STATE");
      return { stepId: step.stepId, completionStatus };
    });
    const readings = version.content.steps.map((step) => {
      const values = data.signalReadings.filter((entry) => entry.stepId === step.stepId);
      requireCondition(values.length <= 1, "AMBIGUOUS_SIGNAL_STATE");
      const reading = values.length ? values[0].reading : null;
      requireCondition(reading === null || typeof reading === "number" && Number.isFinite(reading) && reading >= 1 && reading <= 10, "INVALID_SIGNAL_STATE");
      return reading;
    });
    return { state: "complete", cardTemplateId: id, adoptedVersion: version.version, steps, readings };
  } catch (error) {
    if (!(error instanceof CardArchitectureError)) throw error;
    return fail(error.code);
  }
}

export function calculateCardProgress(cards: readonly CardCalculation[], unknownEligibility = false, issues: readonly FrameworkIssue[] = []): CalculationResult {
  // Reuse across Decks is counted once; original/fork identities stay independent.
  const byId = new Map<string, CardCalculation>();
  const errors = [...issues];
  for (const card of cards) {
    const previous = byId.get(card.cardTemplateId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(card)) errors.push({ code: "AMBIGUOUS_CARD_CALCULATION", cardTemplateIds: [card.cardTemplateId] });
    else byId.set(card.cardTemplateId, card);
  }
  const distinct = [...byId.values()];
  const complete = distinct.filter((card) => card.state === "complete");
  const unresolved = distinct.filter((card) => card.state === "incomplete");
  errors.push(...unresolved.flatMap((card) => card.issues));
  const resolved = complete.filter((card) => {
    if (!Number.isInteger(card.adoptedVersion) || card.adoptedVersion < 1 || !Array.isArray(card.steps) || card.steps.length !== 3
      || new Set(card.steps.map((step) => step.stepId)).size !== 3
      || card.steps.some((step) => !nonblank(step.stepId) || !["todo", "inProgress", "done", "skipped"].includes(step.completionStatus))
      || !Array.isArray(card.readings) || card.readings.length !== 3
      || card.readings.some((reading) => reading !== null && (typeof reading !== "number" || !Number.isFinite(reading) || reading < 1 || reading > 10))) {
      errors.push({ code: "INVALID_CARD_CALCULATION", cardTemplateIds: [card.cardTemplateId] });
      return false;
    }
    return true;
  });
  const count = unknownEligibility ? null : distinct.length;
  if (unresolved.length || errors.length || count === null) return { state: "incomplete", completion: null, confidence: null,
    eligibleCardCount: count, resolvedCardCount: resolved.length, issues: errors };
  if (!distinct.length) return { state: "empty", completion: null, confidence: null, eligibleCardCount: 0, resolvedCardCount: 0, issues: [] };
  return { state: "complete", completion: getProgressPercentage(resolved.flatMap((card) => card.steps)),
    confidence: getConfidenceScore(resolved.flatMap((card) => card.readings)), eligibleCardCount: count, resolvedCardCount: resolved.length, issues: [] };
}

// Pure scoped aggregation foundation, not a Framework endpoint or discovery reader.
// Areas union their children's Cards, never their displayed Item scores.
export function calculateMappedProgress(framework: Framework, scope: { itemId: string } | { areaId: string }, graph: CanonicalAncestry,
  eligibility: PersonalEligibility, cards: ReadonlyMap<string, CardCalculation>): CalculationResult {
  const configurationIssues = validateFrameworkAncestry(framework, graph);
  const validScope = "itemId" in scope ? framework.areas.some((area) => area.items.some((item) => item.id === scope.itemId))
    : framework.areas.some((area) => area.id === scope.areaId);
  if (!validScope) configurationIssues.push({ code: "UNKNOWN_CALCULATION_SCOPE", frameworkId: framework.id });
  if (configurationIssues.length) return calculateCardProgress([], true, configurationIssues);
  const scopeItems = framework.areas.flatMap((area) => "itemId" in scope ? area.items.filter((item) => item.id === scope.itemId)
    : area.id === scope.areaId ? area.items : []);
  // No explicit mapping means no Card or descendant can qualify for this scope,
  // even if an unrelated membership is unavailable.
  if (scopeItems.every((item) => item.cardTemplateIds.length === 0)) return calculateCardProgress([]);
  const selected: CardCalculation[] = [], issues = [...eligibility.issues];
  let unknownMapping = false;
  for (const id of new Set(eligibility.cardTemplateIds)) {
    const mapping = resolveEffectiveMapping(framework, id, graph);
    if (mapping.state === "incomplete") { issues.push(...mapping.issues); unknownMapping = true; continue; }
    if (mapping.state === "unmapped") continue;
    if ("itemId" in scope ? mapping.itemId !== scope.itemId : mapping.areaId !== scope.areaId) continue;
    const calculation = cards.get(id);
    selected.push(calculation?.cardTemplateId === id ? calculation : { state: "incomplete", cardTemplateId: id,
      issues: [{ code: calculation ? "CARD_CALCULATION_ID_MISMATCH" : "MISSING_CARD_CALCULATION", cardTemplateIds: [id] }] });
  }
  return calculateCardProgress(selected, eligibility.unknownComposition || unknownMapping, issues);
}
