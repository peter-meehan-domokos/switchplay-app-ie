import { isRecord, nonblank } from "../cards/domain";
import { assertFrameworkConfiguration, type Framework, type FrameworkIssue } from "./configuration";

// Minimal canonical root metadata. Never personal-history records or content.
export type CanonicalAncestry = ReadonlyMap<string, unknown>;
export type EffectiveMapping =
  | { state: "mapped"; frameworkId: string; areaId: string; itemId: string; mappedCardTemplateId: string }
  | { state: "unmapped" }
  | { state: "incomplete"; issues: FrameworkIssue[] };

export function canonicalParent(root: unknown): string | null | undefined {
  if (!isRecord(root) || !nonblank(root.cardTemplateId)) return undefined;
  if (root.forkedFrom === null) return null;
  const from = root.forkedFrom;
  if (!isRecord(from) || !nonblank(from.cardTemplateId) || !Number.isInteger(from.version) || Number(from.version) < 1) return undefined;
  return from.cardTemplateId;
}

export function resolveEffectiveMapping(framework: Framework, cardTemplateId: string, graph: CanonicalAncestry): EffectiveMapping {
  assertFrameworkConfiguration([framework]);
  const explicit = new Map(framework.areas.flatMap((area) => area.items.flatMap((item) => item.cardTemplateIds.map((id) =>
    [id, { frameworkId: framework.id, areaId: area.id, itemId: item.id, mappedCardTemplateId: id }] as const))));
  const chain: string[] = [], seen = new Set<string>();
  const matches: NonNullable<ReturnType<typeof explicit.get>>[] = [];
  let id: string | null = cardTemplateId;
  const fail = (code: string): EffectiveMapping => {
    const itemIds = [...new Set(matches.map((match) => match.itemId))];
    const codes = itemIds.length > 1 && code !== "MAPPING_CONFLICT" ? [code, "MAPPING_CONFLICT"] : [code];
    return { state: "incomplete", issues: codes.map((code) => ({ code, frameworkId: framework.id, itemIds, cardTemplateIds: [...chain] })) };
  };
  while (id !== null) {
    chain.push(id);
    if (seen.has(id)) return fail("ANCESTRY_CYCLE");
    seen.add(id);
    const match = explicit.get(id); if (match) matches.push(match);
    const root = graph.get(id);
    if (!root) return fail("MISSING_CANONICAL_ANCESTOR");
    if (!isRecord(root) || root.cardTemplateId !== id) return fail("MALFORMED_CANONICAL_ANCESTRY");
    const parent = canonicalParent(root);
    if (parent === undefined) return fail("MALFORMED_CANONICAL_ANCESTRY");
    id = parent;
  }
  // Traverse past the nearest explicit mapping: a distant ancestor may conflict.
  if (new Set(matches.map((match) => match.itemId)).size > 1) return fail("MAPPING_CONFLICT");
  return matches.length ? { state: "mapped", ...matches[0] } : { state: "unmapped" };
}

export function validateFrameworkAncestry(framework: Framework, graph: CanonicalAncestry): FrameworkIssue[] {
  assertFrameworkConfiguration([framework]);
  return framework.areas.flatMap((area) => area.items.flatMap((item) => item.cardTemplateIds.flatMap((id) => {
    const result = resolveEffectiveMapping(framework, id, graph);
    return result.state === "incomplete" ? result.issues : [];
  })));
}
