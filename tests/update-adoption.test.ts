import assert from "node:assert/strict";
import { test } from "node:test";
import { initialCardData } from "../src/lib/cards/domain";
import { createDefaultCardContent } from "../src/lib/cards/creatorDefaults";
import { assertUpdateCommand, reconcileCardUpdate } from "../src/lib/cards/updateAdoption";

const command = { viewerUserId: "alice", kind: "deck", entityId: "deck", adoptedVersion: 1, targetVersion: 3, missingCards: [{ cardTemplateId: "card", version: 2 }] };
test("Update commands allow only actor-bound positive forward selections and unique missing Card identities", () => {
  assert.doesNotThrow(() => assertUpdateCommand(command));
  assert.doesNotThrow(() => assertUpdateCommand({ ...command, kind: "card", missingCards: [] }));
  for (const value of [null, {}, { ...command, actor: "bob" }, { ...command, viewerUserId: "" }, { ...command, targetVersion: 1 },
    { ...command, adoptedVersion: null }, { ...command, kind: "card" }, { ...command, missingCards: [...command.missingCards, ...command.missingCards] },
    { ...command, missingCards: [{ cardTemplateId: "card", version: 0 }] }, { ...command, missingCards: [{ ...command.missingCards[0], revision: 1 }] }]) {
    assert.throws(() => assertUpdateCommand(value));
  }
});
test("continuing Step identity retains skipped/completion and readings despite rewording, new media and reordering", () => {
  const content = createDefaultCardContent(["a", "b", "c"]), data = initialCardData("card", 1, content, new Date());
  data.items[0].completionStatus = "skipped"; data.items[1].completionStatus = "done"; data.signalReadings[0].reading = 6.42;
  const target = { ...content, steps: [...content.steps].reverse().map((step) => ({ ...step, description: "Radically reworded", mediaItem: { id: "image", description: "New image", mediaType: "image" as const, src: "https://example.test/new.png" } })) };
  const before = structuredClone(data); assert.deepEqual(reconcileCardUpdate(data, target), { items: data.items, signalReadings: data.signalReadings }); assert.deepEqual(data, before);
});
test("defensive new Steps default normally and absent stable identities remain retained without matching title or position", () => {
  const content = createDefaultCardContent(["a", "b", "c"]), data = initialCardData("card", 1, content, new Date());
  data.items[0].completionStatus = "done"; data.signalReadings[0].reading = 7;
  const next = reconcileCardUpdate(data, { ...content, steps: [{ ...content.steps[0], stepId: "new" }, ...content.steps.slice(1)] });
  assert.deepEqual(next.items, [...data.items, { stepId: "new", completionStatus: "todo" }]);
  assert.deepEqual(next.signalReadings, [...data.signalReadings, { stepId: "new", reading: null }]);
});
test("ambiguous or malformed current Step values fail safely rather than choosing or discarding learning state", () => {
  const content = createDefaultCardContent(["a", "b", "c"]), data = initialCardData("card", 1, content, new Date());
  for (const broken of [{ ...data, items: [...data.items, data.items[0]] }, { ...data, signalReadings: [...data.signalReadings, data.signalReadings[0]] },
    { ...data, signalReadings: [{ stepId: "a", reading: NaN }] }]) assert.throws(() => reconcileCardUpdate(broken, content));
});
