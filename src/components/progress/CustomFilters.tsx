import { customFilterValue, type CustomFilter, type CustomFilterValues } from "@/lib/frameworks/customFilters";

// Renders one labelled dropdown per custom filter, styled exactly like the Framework selector
// (same label class). With no filters it renders nothing, so layout is unchanged.
export default function CustomFilters({ filters, values, onChange }: {
  filters: readonly CustomFilter[]; values: CustomFilterValues; onChange: (filterId: string, value: string) => void;
}) {
  return <>{filters.map((filter) => <label key={filter.id} className="progress-framework-selector progress-custom-filter">{filter.label}
    <select aria-label={filter.label} value={customFilterValue(filter, values)} onChange={(event) => onChange(filter.id, event.target.value)}>
      {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>)}</>;
}
