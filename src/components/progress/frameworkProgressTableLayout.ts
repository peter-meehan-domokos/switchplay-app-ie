import { isItemVisible, type CustomFilter, type CustomFilterValues } from "@/lib/frameworks/customFilters";

type FilterableFramework = { readonly areas: readonly { readonly items: readonly { readonly id: string }[] }[] };

// Presentation projection of a Framework progress summary: which Areas and Items are shown.
// Visible Areas and Items keep their original order and their progress, assessments and
// Card flags exactly as received; nothing in the input is mutated. A Framework with no
// custom filters is returned untouched, including Areas that have no Items.
// Area-level figures are computed on the server over the whole Area, so they still
// include progress from Items hidden here (a known, accepted limitation).
export function buildFrameworkProgressTableLayout<T extends FilterableFramework>(
  framework: T, filters: readonly CustomFilter[], values: CustomFilterValues,
): T {
  if (!filters.length) return framework;
  const areas = framework.areas
    .map((area) => ({ ...area, items: area.items.filter((item) => isItemVisible(filters, values, item.id)) }))
    .filter((area) => area.items.length > 0);
  return { ...framework, areas };
}
