import { isRecord, nonblank } from "../cards/domain";

export type FrameworkItem = { readonly id: string; readonly title: string; readonly cardTemplateIds: readonly string[] };
// Configured identities only: this does not establish accessible Deck destinations.
export function hasConfiguredCards(item: FrameworkItem): boolean {
  return item.cardTemplateIds.length > 0;
}
export type FrameworkArea = { readonly id: string; readonly title: string; readonly items: readonly FrameworkItem[] };
export function hasConfiguredAreaCards(area: FrameworkArea): boolean {
  return area.items.some(hasConfiguredCards);
}
export type Framework = { readonly id: string; readonly title: string; readonly areas: readonly FrameworkArea[] };
export type FrameworkIssue = {
  code: string;
  frameworkId?: string;
  areaId?: string;
  itemIds?: string[];
  cardTemplateIds?: string[];
  deckTemplateId?: string;
  path?: string;
};

export class FrameworkConfigurationError extends Error {
  constructor(readonly issues: FrameworkIssue[]) {
    super(`Invalid Framework configuration: ${issues.map((issue) => `${issue.code} at ${issue.path}`).join("; ")}`);
    this.name = "FrameworkConfigurationError";
  }
}
const identifier = (value: unknown): value is string => nonblank(value) && value.trim() === value;

// No database reads. In particular, old Area -> Deck mappings are rejected.
export function validateFrameworkConfiguration(value: unknown): FrameworkIssue[] {
  const issues: FrameworkIssue[] = [];
  const report = (code: string, path: string, frameworkId?: string) => issues.push({ code, path, frameworkId });
  const entity = (value: unknown, fields: string[], path: string, frameworkId?: string): value is Record<string, unknown> => {
    if (!isRecord(value) || !identifier(value.id) || !nonblank(value.title) || Object.keys(value).some((key) => !fields.includes(key))) {
      report("INVALID_CONFIGURATION_ENTITY", path, frameworkId); return false;
    }
    return true;
  };
  if (!Array.isArray(value)) return [{ code: "INVALID_CATALOGUE", path: "frameworks" }];
  const frameworkIds = new Set<string>(), itemIds = new Set<string>();
  value.forEach((framework, fi) => {
    const path = `frameworks[${fi}]`;
    if (!entity(framework, ["id", "title", "areas"], path)) return;
    const id = framework.id as string;
    if (frameworkIds.has(id)) report("DUPLICATE_FRAMEWORK_ID", path, id);
    frameworkIds.add(id);
    if (!Array.isArray(framework.areas)) { report("INVALID_AREAS", path, id); return; }
    const areaIds = new Set<string>(), mappings = new Map<string, string>();
    framework.areas.forEach((area, ai) => {
      const ap = `${path}.areas[${ai}]`;
      if (!entity(area, ["id", "title", "items"], ap, id)) return;
      if (areaIds.has(area.id as string)) report("DUPLICATE_AREA_ID", ap, id);
      areaIds.add(area.id as string);
      if (!Array.isArray(area.items)) { report("INVALID_ITEMS", ap, id); return; }
      area.items.forEach((item, ii) => {
        const ip = `${ap}.items[${ii}]`;
        if (!entity(item, ["id", "title", "cardTemplateIds"], ip, id)) return;
        const itemId = item.id as string;
        if (itemIds.has(itemId)) report("DUPLICATE_ITEM_ID", ip, id);
        itemIds.add(itemId);
        if (!Array.isArray(item.cardTemplateIds)) { report("INVALID_CARD_MAPPINGS", ip, id); return; }
        item.cardTemplateIds.forEach((cardId: unknown) => {
          if (!identifier(cardId)) { report("INVALID_CARD_ID", ip, id); return; }
          if (mappings.has(cardId)) issues.push({ code: "DUPLICATE_CARD_MAPPING", path: ip, frameworkId: id,
            itemIds: [mappings.get(cardId)!, itemId], cardTemplateIds: [cardId] });
          else mappings.set(cardId, itemId);
        });
      });
    });
  });
  return issues;
}

export function assertFrameworkConfiguration(value: unknown): asserts value is readonly Framework[] {
  const issues = validateFrameworkConfiguration(value);
  if (issues.length) throw new FrameworkConfigurationError(issues);
}

export function createFrameworkAccess(catalogue: readonly Framework[]) {
  const getFrameworks = (): readonly Framework[] => { assertFrameworkConfiguration(catalogue); return catalogue; };
  return {
    getFrameworks,
    getFramework: (id: string): Framework | undefined => getFrameworks().find((framework) => framework.id === id),
    getFrameworkItem: (id: string): FrameworkItem | undefined => getFrameworks()
      .flatMap((framework) => framework.areas.flatMap((area) => area.items)).find((item) => item.id === id),
  };
}
