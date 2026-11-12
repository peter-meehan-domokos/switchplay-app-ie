import assert from "node:assert/strict";
import test from "node:test";
import { getInteractiveVisual, interactiveVisualCatalogue, resolveInteractiveVisual } from "../src/lib/interactiveVisuals/catalogue";
import { getFrameworkItem, hasConfiguredCards, validateFrameworkConfiguration } from "../src/lib/frameworks/configuration";

const configuration = (interactiveVisualIds?: unknown) => [{ id: "f", title: "Framework", areas: [
  { id: "a", title: "Area", items: [{ id: "item", title: "Item", cardTemplateIds: [],
    ...(interactiveVisualIds === undefined ? {} : { interactiveVisualIds }) }] },
] }];

test("only existing stable Interactive Visual IDs resolve; metadata cannot be mutated", () => {
  assert.deepEqual(interactiveVisualCatalogue.map((v) => [v.id, v.activityVersion]), [["roots-and-factors", 1], ["integration-area", 2]]);
  assert.equal(getInteractiveVisual("card-1-interactive"), undefined);
  assert.equal(getInteractiveVisual("https://untrusted.example/visual"), undefined);
  assert.ok(Object.isFrozen(interactiveVisualCatalogue));
  assert.ok(interactiveVisualCatalogue.every(Object.isFrozen));
  assert.equal(resolveInteractiveVisual("integration-area", { disabledIds: ["integration-area"] }), undefined);
  assert.equal(resolveInteractiveVisual("integration-area", { forSelection: true }), getInteractiveVisual("integration-area"));
});

test("Framework visual references support absent, empty and independent known mappings", () => {
  for (const ids of [undefined, [], ["integration-area"], ["roots-and-factors", "integration-area"]]) {
    assert.deepEqual(validateFrameworkConfiguration(configuration(ids)), []);
  }
  const item = getFrameworkItem("integration")!;
  assert.deepEqual(item.interactiveVisualIds, ["integration-area"]);
  assert.equal(hasConfiguredCards(item), false);
  const duplicateAcrossItems = configuration(["integration-area"]);
  duplicateAcrossItems[0].areas[0].items.push({ ...duplicateAcrossItems[0].areas[0].items[0], id: "another-item" });
  assert.deepEqual(validateFrameworkConfiguration(duplicateAcrossItems), []);
});

test("Framework validation rejects malformed, unknown and duplicated visual references", () => {
  for (const ids of [null, "integration-area", ["unknown"], ["integration-area", "integration-area"], [" integration-area"], [3]]) {
    assert.ok(validateFrameworkConfiguration(configuration(ids)).length > 0, JSON.stringify(ids));
  }
});
