import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFramework, getFrameworks } from "../src/lib/frameworks/configuration";
import { customFilterValue, getFrameworkCustomFilters, isItemVisible, type CustomFilter } from "../src/lib/frameworks/customFilters";
import { isAvailableAtAge, itemMinimumAge, salvaAgeFilter } from "../src/lib/frameworks/basketball/salva-age-mapping";
import { buildFrameworkProgressTableLayout } from "../src/components/progress/frameworkProgressTableLayout";
import CustomFilters from "../src/components/progress/CustomFilters";
import type { ProgressSummary } from "../src/lib/frameworks/progressClient";

const salva = getFramework("salva-skills-plan")!;
const salvaFilters = getFrameworkCustomFilters("salva-skills-plan");
const atAge = (age: number) => ({ age: String(age) });

// The Personal progress summary shape (not the raw catalogue): metrics and assessments
// are given distinctive values so any loss or alteration would be detected.
const progress = (n: number) => ({ state: "complete" as const, observationState: "inProgress" as const, completion: n, confidence: 5,
  eligibleCardCount: 2, resolvedCardCount: 2, issues: [] });
const summaryOf = (framework: { id: string; title: string; areas: readonly { id: string; title: string; items: readonly { id: string; title: string }[] }[] }) => ({
  id: framework.id, title: framework.title,
  areas: framework.areas.map((area, a) => ({ id: area.id, title: area.title, hasConfiguredCards: true, progress: progress(a + 1),
    items: area.items.map((item, i) => ({ id: item.id, title: item.title, hasConfiguredCards: i % 2 === 0, progress: progress(10 * (a + 1) + i),
      assessments: { state: "empty" as const, count: i, readableCount: i, latestThree: [], issues: [] } })) })),
}) as unknown as ProgressSummary;
const ids = (summary: ProgressSummary) => summary.areas.flatMap((area) => area.items.map((item) => item.id));
const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === "object") { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
};

test("Salva Skills Plan is addressable by its kebab-case id and defines exactly one Age filter", () => {
  assert.equal(salva.id, "salva-skills-plan");
  assert.equal(getFramework("salvaSkillsPlan"), undefined);
  assert.deepEqual(salvaFilters.map((filter) => filter.id), ["age"]);
  assert.deepEqual(salvaAgeFilter.options.map((option) => option.value), ["9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"]);
  assert.equal(salvaAgeFilter.defaultValue, "20");
});

test("every mapping entry names a real Salva Item, and all 94 Items are currently mapped", () => {
  const items = salva.areas.flatMap((area) => area.items.map((item) => item.id));
  assert.equal(items.length, 94);
  assert.deepEqual(Object.keys(itemMinimumAge).filter((id) => !items.includes(id)), []);
  assert.deepEqual(items.filter((id) => !(id in itemMinimumAge)), []);
  assert.ok(Object.values(itemMinimumAge).every((age) => Number.isInteger(age) && age >= 9 && age <= 20));
});

test("age thresholds are inclusive at the minimum age", () => {
  assert.equal(isAvailableAtAge("helps-on-defense", 12), false);
  assert.equal(isAvailableAtAge("helps-on-defense", 13), true);
  assert.equal(isAvailableAtAge("helps-on-defense", 20), true);
  assert.equal(isAvailableAtAge("mix-defense-3and-2-box-and-one", 18), false);
  assert.equal(isAvailableAtAge("mix-defense-3and-2-box-and-one", 19), true);
});

test("the three defensive-rebound Items are distinct, mapped to age 12 and shown in their own Areas", () => {
  const rebound = ["defensive-rebound", "defensive-rebound-offensive", "defensive-rebound-offensive-collective"];
  assert.deepEqual(rebound.map((id) => itemMinimumAge[id]), [12, 12, 12]);
  const summary = summaryOf(salva);
  assert.deepEqual(rebound.filter((id) => ids(buildFrameworkProgressTableLayout(summary, salvaFilters, atAge(11))).includes(id)), []);
  const shown = buildFrameworkProgressTableLayout(summary, salvaFilters, atAge(12));
  const areaOf = (id: string) => shown.areas.find((area) => area.items.some((item) => item.id === id))?.id;
  assert.deepEqual(rebound.map(areaOf), [
    "defensive-technical-tactical-fundamentals-individual-defence",
    "offensive-technical-tactical-fundamentals-other",
    "offensive-collective-tactics"]);
});

test("visible Item counts across ages 9-20; age 20 is the complete Framework", () => {
  const summary = summaryOf(salva);
  const counts = Array.from({ length: 12 }, (_, i) => ids(buildFrameworkProgressTableLayout(summary, salvaFilters, atAge(9 + i))).length);
  assert.deepEqual(counts, [42, 42, 42, 54, 70, 85, 85, 93, 93, 93, 94, 94]);
  assert.deepEqual(buildFrameworkProgressTableLayout(summary, salvaFilters, atAge(20)), summary);
  // No value selected means the default of 20.
  assert.deepEqual(buildFrameworkProgressTableLayout(summary, salvaFilters, {}), summary);
});

test("Areas with no visible Items are removed, and visible Areas and Items keep their canonical order", () => {
  const summary = summaryOf(salva), areaIds = (age: number) => buildFrameworkProgressTableLayout(summary, salvaFilters, atAge(age)).areas.map((area) => area.id);
  const all = summary.areas.map((area) => area.id);
  const hiddenAt = (age: number) => all.filter((id) => !areaIds(age).includes(id));
  assert.deepEqual(hiddenAt(9), ["defensive-technical-tactical-fundamentals-team-defence",
    "defensive-technical-tactical-fundamentals-defending-screen-cutting-actions",
    "defensive-technical-tactical-fundamentals-defending-the-post", "offensive-technical-tactical-fundamentals-other"]);
  assert.deepEqual(hiddenAt(12).length, 3);
  assert.deepEqual(hiddenAt(13), ["defensive-technical-tactical-fundamentals-defending-the-post"]);
  assert.deepEqual(hiddenAt(14), []);
  for (let age = 9; age <= 20; age++) {
    const shown = buildFrameworkProgressTableLayout(summary, salvaFilters, atAge(age));
    assert.deepEqual(ids(shown), ids(summary).filter((id) => isAvailableAtAge(id, age)));
    assert.deepEqual(shown.areas.map((area) => area.id), all.filter((id) => shown.areas.some((area) => area.id === id)));
  }
});

test("Items without an age mapping are visible at every age, and an Area of only unmapped Items stays", () => {
  const summary = summaryOf({ ...salva, areas: [...salva.areas, { id: "static-area", title: "Static", items: [
    { id: "static-item", title: "Static item", cardTemplateIds: [] }] }] });
  for (let age = 9; age <= 20; age++) {
    const shown = buildFrameworkProgressTableLayout(summary, salvaFilters, atAge(age));
    assert.ok(ids(shown).includes("static-item"), `age ${age}`);
    assert.equal(shown.areas.at(-1)!.id, "static-area");
  }
  assert.equal(salvaAgeFilter.includesItem("not-in-mapping", "9"), true);
});

test("filtering preserves progress figures and Item properties without mutating its input", () => {
  const summary = summaryOf(salva), before = structuredClone(summary);
  deepFreeze(summary);
  const shown = buildFrameworkProgressTableLayout(summary, salvaFilters, atAge(13));
  assert.deepEqual(summary, before);
  for (const area of shown.areas) {
    const original = summary.areas.find((value) => value.id === area.id)!;
    assert.deepEqual(area.progress, original.progress); // Area figures are intentionally unchanged
    assert.equal(area.hasConfiguredCards, original.hasConfiguredCards);
    area.items.forEach((item) => assert.equal(item, original.items.find((value) => value.id === item.id)));
  }
  // The canonical catalogue is untouched too.
  assert.equal(getFramework("salva-skills-plan"), salva);
  assert.equal(salva.areas.flatMap((area) => area.items).length, 94);
});

test("Frameworks without custom filters are returned untouched, including Areas with no Items", () => {
  const maths = getFramework("leaving-cert-hl")!, summary = summaryOf(maths);
  assert.deepEqual(getFrameworkCustomFilters("leaving-cert-hl"), []);
  assert.deepEqual(getFrameworkCustomFilters("unknown"), []);
  assert.deepEqual(getFrameworkCustomFilters("toString"), []);
  assert.equal(buildFrameworkProgressTableLayout(summary, getFrameworkCustomFilters(maths.id), atAge(9)), summary);
  assert.ok(summary.areas.some((area) => area.items.length === 0));
  // Only Salva defines filters in the current catalogue.
  assert.deepEqual(getFrameworks().filter((framework) => getFrameworkCustomFilters(framework.id).length).map((framework) => framework.id), ["salva-skills-plan"]);
});

test("several filters combine with AND, and a filter uses its default until a value is chosen", () => {
  const onlyDefence: CustomFilter = { id: "kind", label: "Kind", options: [{ value: "defence", label: "Defence" }], defaultValue: "defence",
    includesItem: (itemId) => itemId.includes("defense") };
  assert.equal(customFilterValue(salvaAgeFilter, {}), "20");
  assert.equal(customFilterValue(salvaAgeFilter, { age: "9" }), "9");
  const both = [salvaAgeFilter, onlyDefence];
  assert.equal(isItemVisible(both, atAge(9), "basic-defensive-position"), false); // fails the second filter
  assert.equal(isItemVisible(both, atAge(9), "line-pass-defense"), true); // age 9 and defence
  assert.equal(isItemVisible(both, atAge(12), "helps-on-defense"), false); // fails the age filter (13)
  assert.equal(isItemVisible(both, atAge(13), "helps-on-defense"), true); // passes both
  assert.equal(isItemVisible(both, atAge(20), "euro-step"), false); // passes age, fails second
  assert.equal(isItemVisible([], {}, "anything"), true);
});

test("the Custom Filters area renders only when a Framework defines filters", () => {
  const render = (frameworkId: string, values = {}) => renderToStaticMarkup(createElement(CustomFilters, { filters: getFrameworkCustomFilters(frameworkId), values, onChange: () => {} }));
  assert.equal(render("leaving-cert-hl"), "");
  assert.equal(render("functions-and-graphs"), "");
  const html = render("salva-skills-plan");
  assert.match(html, /aria-label="Age"/);
  assert.match(html, /progress-framework-selector/); // shares the Framework selector's styling
  assert.equal((html.match(/<option/g) ?? []).length, 12);
  assert.match(html, /<option value="20" selected="">20<\/option>/);
  assert.match(render("salva-skills-plan", { age: "9" }), /<option value="9" selected="">9<\/option>/);
});
