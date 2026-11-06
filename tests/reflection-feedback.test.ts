import assert from "node:assert/strict";
import { test } from "node:test";
import { patchReflectionFeed } from "../src/lib/reflections/clientState";
import type { ReflectionFeed } from "../src/lib/reflections/reads";

function fixture(): ReflectionFeed {
  return { viewerUserId: "aoife", cardTemplateId: "card", view: { kind: "personal" }, accessEpoch: null, adoptionRevision: null,
    collective: { source: { kind: "group-card", experienceId: "galway", cardTemplateId: "card" }, text: "Collective", revision: 4, canEdit: true },
    items: ["personal", "galway", "development"].map(kind => ({ entry: {
      source: kind === "personal" ? { kind: "personal", cardTemplateId: "card" } : { kind: "group", experienceId: kind, cardTemplateId: "card", reflectionId: null },
      authorUserId: "aoife", authorName: "Aoife Kelly", text: kind, revision: 2, createdAt: null, originName: kind, groupVisible: kind === "galway",
    }, empty: false, label: kind, private: kind !== "galway", canEdit: true, canDelete: true, canHide: false, explanation: null })) };
}
test("optimistic Personal and Group reflection feedback changes only the exact author/source, preserving history and visibility", () => {
  for (const index of [0, 1, 2]) {
    const before = fixture(), source = before.items[index].entry.source;
    const pending = patchReflectionFeed(before, source, "New reflection");
    assert.equal(pending.items[index].entry.text, "New reflection");
    assert.equal(pending.items[index].entry.revision, 2);
    assert.equal(pending.items[index].entry.groupVisible, before.items[index].entry.groupVisible);
    assert.equal(before.items[index].entry.text, index === 0 ? "personal" : index === 1 ? "galway" : "development");
    assert.equal(pending.collective, before.collective);
    for (const other of [0, 1, 2].filter(i => i !== index)) assert.equal(pending.items[other], before.items[other]);
    const saved = patchReflectionFeed(pending, source, "New reflection", { revision: 3, reflectionId: "allocated-row" });
    assert.equal(saved.items[index].entry.revision, 3);
    if (saved.items[index].entry.source.kind === "group") assert.equal(saved.items[index].entry.source.reflectionId, "allocated-row");
    const cleared = patchReflectionFeed(saved, saved.items[index].entry.source, "", { revision: 4 });
    assert.equal(cleared.items[index].empty, true); assert.equal(cleared.items[index].canDelete, false);
  }
});
test("collective feedback updates the shared slot alone and preserves its independent revision", () => {
  const before = fixture(), source = before.collective!.source;
  const pending = patchReflectionFeed(before, source, "Shared update");
  assert.equal(pending.collective!.text, "Shared update"); assert.equal(pending.collective!.revision, 4);
  assert.equal(pending.items, before.items);
  const saved = patchReflectionFeed(pending, source, "Shared update", { revision: 5 });
  assert.equal(saved.collective!.revision, 5); assert.equal(before.collective!.text, "Collective");
  assert.throws(() => patchReflectionFeed(before, { ...source, experienceId: "elsewhere" }, "Wrong slot"));
});
