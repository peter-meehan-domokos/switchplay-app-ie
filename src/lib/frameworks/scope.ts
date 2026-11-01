import { isRecord, nonblank, requireCondition } from "../cards/domain";
import type { RetainedCardAssignment } from "../cards/retainedAssignments";
import { assertFrameworkConfiguration, type Framework, type FrameworkIssue } from "./configuration";
import { resolveEffectiveMapping, validateFrameworkAncestry, type CanonicalAncestry } from "./mapping";

// A Progress context selects coverage, not a personal owner or permission grant.
// Ordinary Cards continue to use their existing shared CardData and selectors.
export type ProgressContext = { kind: "personal" } | { kind: "group"; experienceId: string };
export type ProgressCoverage = "inside" | "outside" | "unknown";
export type ProgressItemScope = {
  frameworkItemId: string; coverage: ProgressCoverage; cardTemplateIds: string[];
  directAssessmentTarget: { frameworkItemId: string } | null;
};
export type ProgressScope = {
  context: ProgressContext; frameworkId: string; cards: RetainedCardAssignment[];
  areas: { areaId: string; coverage: ProgressCoverage; cardTemplateIds: string[]; items: ProgressItemScope[] }[];
  issues: FrameworkIssue[];
};

// Detached selections are retained adoption evidence, never current coverage.
export function currentGroupAssignments(composition: readonly { cardTemplateId: string }[], selections: readonly RetainedCardAssignment[]) {
  const seen = new Set<string>();
  return composition.map(({ cardTemplateId }) => {
    requireCondition(nonblank(cardTemplateId) && !seen.has(cardTemplateId), "INVALID_GROUP_COMPOSITION"); seen.add(cardTemplateId);
    const matches = selections.filter(ref => ref.cardTemplateId === cardTemplateId);
    requireCondition(matches.length === 1 && Number.isInteger(matches[0].version) && matches[0].version >= 1, "INVALID_GROUP_SELECTIONS");
    return { cardTemplateId, version: matches[0].version };
  });
}

// Callers supply server-resolved assignment evidence. This pure plan is shared
// by metrics, histories and projections; it never discovers authority from IDs.
export function resolveProgressScope(framework: Framework, context: ProgressContext, assignments: readonly RetainedCardAssignment[],
  graph: CanonicalAncestry, options: { unknownComposition?: boolean; issues?: readonly FrameworkIssue[] } = {}): ProgressScope {
  assertFrameworkConfiguration([framework]);
  const issues = [...(options.issues ?? []), ...validateFrameworkAncestry(framework, graph)];
  const selected = new Map<string, RetainedCardAssignment>();
  for (const ref of assignments) {
    if (!isRecord(ref) || !nonblank(ref.cardTemplateId) || !Number.isInteger(ref.version) || ref.version < 1) {
      issues.push({ code: "INVALID_PROGRESS_ASSIGNMENT" }); continue;
    }
    const previous = selected.get(ref.cardTemplateId);
    // Even personal inputs are already version-resolved. Group scopes must not
    // silently apply the personal lifetime max rule to conflicting selections.
    if (previous && previous.version !== ref.version) issues.push({ code: "AMBIGUOUS_PROGRESS_VERSION", cardTemplateIds: [ref.cardTemplateId] });
    else selected.set(ref.cardTemplateId, { cardTemplateId: ref.cardTemplateId, version: ref.version });
  }
  const byItem = new Map<string, string[]>();
  for (const id of selected.keys()) {
    const mapping = resolveEffectiveMapping(framework, id, graph);
    if (mapping.state === "incomplete") issues.push(...mapping.issues);
    else if (mapping.state === "mapped") byItem.set(mapping.itemId, [...(byItem.get(mapping.itemId) ?? []), id]);
  }
  const uncertain = options.unknownComposition === true || issues.length > 0;
  const coverage = (ids: string[]): ProgressCoverage => uncertain ? "unknown" : context.kind === "personal" || ids.length > 0 ? "inside" : "outside";
  return { context, frameworkId: framework.id, cards: [...selected.values()], issues,
    areas: framework.areas.map(area => {
      const items = area.items.map(item => {
        const cardTemplateIds = [...new Set(byItem.get(item.id) ?? [])];
        const state = coverage(cardTemplateIds);
        return { frameworkItemId: item.id, coverage: state, cardTemplateIds,
          directAssessmentTarget: state === "inside" ? { frameworkItemId: item.id } : null };
      });
      const cardTemplateIds = [...new Set(items.flatMap(item => item.cardTemplateIds))];
      return { areaId: area.id, coverage: coverage(cardTemplateIds), cardTemplateIds, items };
    }) };
}

export type AssessmentLineageSource = { cardTemplateId: string; historySourceCardTemplateId?: string };
// Assessment-only evidence closure. Canonical mapping ancestry, siblings and
// unrelated same-Item Cards are not inputs; no private Card fields are needed.
export function resolveAssessmentEvidence(cardTemplateIds: readonly string[], sources: readonly AssessmentLineageSource[], virtualCardIds: readonly string[] = []) {
  const evidence = new Map<string, Set<string>>(), issues: { code: string; cardTemplateId: string }[] = [];
  for (const root of new Set(cardTemplateIds)) {
    const seen = new Set<string>(); let id: string | undefined = root;
    while (id !== undefined) {
      if (seen.has(id)) { issues.push({ code: "PERSONAL_HISTORY_CYCLE", cardTemplateId: id }); break; }
      seen.add(id);
      const matches = sources.filter(source => source.cardTemplateId === id);
      if (!matches.length && id === root && virtualCardIds.includes(root)) break;
      if (matches.length !== 1) { issues.push({ code: matches.length ? "AMBIGUOUS_PERSONAL_HISTORY_SOURCE" : "MISSING_PERSONAL_HISTORY_SOURCE", cardTemplateId: id }); break; }
      evidence.set(id, new Set([...(evidence.get(id) ?? []), root]));
      const next = matches[0].historySourceCardTemplateId;
      if (next !== undefined && !nonblank(next)) { issues.push({ code: "MALFORMED_PERSONAL_HISTORY_SOURCE", cardTemplateId: id }); break; }
      id = next;
    }
  }
  return { sources: [...evidence].map(([cardTemplateId, exposedThrough]) => ({ cardTemplateId, exposedThroughCardTemplateIds: [...exposedThrough].sort() })), issues };
}
