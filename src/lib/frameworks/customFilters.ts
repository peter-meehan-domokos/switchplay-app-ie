import { salvaAgeFilter } from "./basketball/salva-age-mapping";

// Framework-specific presentation filters. They only decide which Items are shown;
// they never touch Framework data, Card mappings or progress. Definitions live in code,
// separate from the canonical Framework, because they contain functions.
export type CustomFilter = {
  readonly id: string;
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly defaultValue: string;
  readonly includesItem: (itemId: string, value: string) => boolean;
};
// Selected values for one Framework's filters, keyed by filter id.
export type CustomFilterValues = Readonly<Record<string, string>>;

const customFiltersByFramework: Readonly<Record<string, readonly CustomFilter[]>> = {
  "salva-skills-plan": [salvaAgeFilter],
};

const none: readonly CustomFilter[] = [];
export function getFrameworkCustomFilters(frameworkId: string): readonly CustomFilter[] {
  return Object.hasOwn(customFiltersByFramework, frameworkId) ? customFiltersByFramework[frameworkId] : none;
}

export const customFilterValue = (filter: CustomFilter, values: CustomFilterValues): string => values[filter.id] ?? filter.defaultValue;

// Filters combine with AND: an Item is shown only if every filter includes it.
export const isItemVisible = (filters: readonly CustomFilter[], values: CustomFilterValues, itemId: string): boolean =>
  filters.every((filter) => filter.includesItem(itemId, customFilterValue(filter, values)));
