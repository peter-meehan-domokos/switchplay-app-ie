import assert from "node:assert/strict";
import { test } from "node:test";
import { assertFrameworkConfiguration, createFrameworkAccess, getFrameworks, getFramework, getFrameworkItem, hasConfiguredCards, hasConfiguredAreaCards, validateFrameworkConfiguration } from "../src/lib/frameworks/configuration";
import { resolveEffectiveMapping, validateFrameworkAncestry } from "../src/lib/frameworks/mapping";
import { collectPersonalEligibility } from "../src/lib/frameworks/eligibility";
import { calculateCardProgress, calculateMappedProgress, resolveAdoptedCardCalculation } from "../src/lib/frameworks/calculations";
import { getProgressPercentage } from "../src/lib/progress";
import { getConfidenceScore } from "../src/lib/signals";
import { cardFixture, deckFixture, frameworkFixtures } from "./fixtures/frameworks";

const codes = (value: unknown) => validateFrameworkConfiguration(value).map((issue) => issue.code);
const cards = () => [cardFixture("original"), cardFixture("second"), cardFixture("speed"), cardFixture("fork", "original"), cardFixture("nested", "fork"), cardFixture("unrelated")];
const graph = () => new Map(cards().map((card) => [card.root.cardTemplateId, card.root]));
function calculation(card: ReturnType<typeof cardFixture>) { return resolveAdoptedCardCalculation("alice", card.root.cardTemplateId, [card.root], [card.version], [card.data]); }
const eligible = (ids: string[]) => ({ cardTemplateIds: ids, unknownComposition: false, issues: [] });

test("configured Card presence does not require resolved, accessible or personally eligible Cards", () => {
  assert.equal(hasConfiguredCards({ id: "empty", title: "Empty", cardTemplateIds: [] }), false);
  assert.equal(hasConfiguredCards({ id: "missing", title: "Missing", cardTemplateIds: ["missing-source"] }), true);
  assert.equal(hasConfiguredCards(frameworkFixtures()[0].areas[0].items[0]), true);
});

test("Area configured Card presence checks its Items, including empty Areas and unresolved mapped Cards", () => {
  const empty = { id: "empty", title: "Empty", cardTemplateIds: [] };
  const missing = { id: "mapped", title: "Mapped", cardTemplateIds: ["missing-source"] };
  assert.equal(hasConfiguredAreaCards({ id: "area", title: "Area", items: [] }), false);
  assert.equal(hasConfiguredAreaCards({ id: "area", title: "Area", items: [empty] }), false);
  assert.equal(hasConfiguredAreaCards({ id: "area", title: "Area", items: [empty, missing] }), true);
});

test("sample catalogue retains its identities/order; injected empty Frameworks, Areas, Items and mappings are valid", () => {
  assertFrameworkConfiguration(getFrameworks());
  assert.deepEqual(getFrameworks().map((framework) => framework.id), ["leaving-cert-hl"]);
  assert.deepEqual(getFrameworks()[0].areas.map((area) => area.id), ["algebra", "calculus", "trigonometry"]);
  assert.deepEqual(getFrameworks()[0].areas.flatMap((area) => area.items.map((item) => item.id)),
    ["quadratic-equations", "factor-theorem", "solving-cubics", "differentiation", "stationary-points", "integration"]);
  assert.deepEqual(getFrameworks()[0].areas[2].items, []);
  assert.deepEqual(createFrameworkAccess([]).getFrameworks(), []);
  assert.equal(getFramework("missing"), undefined); assert.equal(getFrameworkItem("missing"), undefined);
  const fixtures = frameworkFixtures(); assertFrameworkConfiguration(fixtures);
  assert.deepEqual(fixtures[0].areas[0].items.map((item) => item.id), ["practice-control", "practice-speed", "practice-empty"]);
  assert.deepEqual(validateFrameworkConfiguration([]), []);
});

test("configuration rejects duplicate identities, global Item collisions, repeated mappings and obsolete Area mappings", () => {
  const fixtures = frameworkFixtures();
  assert.ok(codes([...fixtures, fixtures[0]]).includes("DUPLICATE_FRAMEWORK_ID"));
  const duplicatedArea = structuredClone(fixtures); duplicatedArea[0].areas.push(duplicatedArea[0].areas[0]);
  assert.ok(codes(duplicatedArea).includes("DUPLICATE_AREA_ID"));
  const duplicateItem = structuredClone(fixtures); duplicateItem[1].areas[0].items[0] = fixtures[0].areas[0].items[0];
  assert.ok(codes(duplicateItem).includes("DUPLICATE_ITEM_ID"));
  const duplicateMapping = structuredClone(fixtures); duplicateMapping[0].areas[0].items[1].cardTemplateIds = ["original"];
  assert.ok(codes(duplicateMapping).includes("DUPLICATE_CARD_MAPPING"));
  assert.ok(codes([{ ...fixtures[0], areas: [{ ...fixtures[0].areas[0], deckTemplateIds: [] }] }]).includes("INVALID_CONFIGURATION_ENTITY"));
  assert.ok(codes([{ ...fixtures[0], id: " bad " }]).includes("INVALID_CONFIGURATION_ENTITY"));
  assert.ok(codes({}).includes("INVALID_CATALOGUE"));
});

test("fork-of-fork mapping is canonical and independent in different Frameworks", () => {
  const fixtures = frameworkFixtures(), ancestry = graph();
  const first = resolveEffectiveMapping(fixtures[0], "nested", ancestry), second = resolveEffectiveMapping(fixtures[1], "nested", ancestry);
  assert.equal(first.state, "mapped"); if (first.state === "mapped") assert.equal(first.itemId, "practice-control");
  assert.equal(second.state, "mapped"); if (second.state === "mapped") assert.equal(second.itemId, "alternative-speed");
  assert.deepEqual(resolveEffectiveMapping(fixtures[0], "unrelated", ancestry), { state: "unmapped" });
  assert.deepEqual(validateFrameworkAncestry(fixtures[0], ancestry), []);
});

test("different Framework mappings are legitimate and an ancestry conflict leaves another Framework's calculations valid", () => {
  const frameworks = frameworkFixtures(), ancestry = graph(), entries = cards();
  assertFrameworkConfiguration(frameworks);
  const first = resolveEffectiveMapping(frameworks[0], "original", ancestry);
  const second = resolveEffectiveMapping(frameworks[1], "original", ancestry);
  assert.equal(first.state, "mapped"); assert.equal(second.state, "mapped");
  if (first.state === "mapped" && second.state === "mapped") assert.notEqual(first.itemId, second.itemId);
  entries[0].data.items.forEach((step) => { step.completionStatus = "done"; });
  entries[0].data.signalReadings[0].reading = 8;
  const nested = entries.find((card) => card.root.cardTemplateId === "nested")!;
  nested.data.items[0].completionStatus = "done"; nested.data.signalReadings[0].reading = 6;
  const calculations = new Map(entries.map((card) => [card.root.cardTemplateId, calculation(card)]));
  const membership = eligible(["original", "nested"]);
  const baseline = calculateMappedProgress(frameworks[1], { itemId: "alternative-speed" }, ancestry, membership, calculations);
  assert.equal(baseline.state, "complete"); assert.equal(baseline.completion, 67); assert.equal(baseline.confidence, 7);
  frameworks[0].areas[0].items[1].cardTemplateIds = ["nested"];
  assertFrameworkConfiguration(frameworks); // Cross-Framework mappings are valid; the conflict requires ancestry validation.
  const invalid = calculateMappedProgress(frameworks[0], { areaId: "skills" }, ancestry, membership, calculations);
  assert.equal(invalid.state, "incomplete"); assert.equal(invalid.completion, null); assert.equal(invalid.confidence, null);
  assert.ok(invalid.issues.some((issue) => issue.code === "MAPPING_CONFLICT"));
  assert.deepEqual(calculateMappedProgress(frameworks[1], { itemId: "alternative-speed" }, ancestry, membership, calculations), baseline);
  const validArea = calculateMappedProgress(frameworks[1], { areaId: "skills" }, ancestry, membership, calculations);
  assert.equal(validArea.state, "complete"); assert.equal(validArea.completion, 67); assert.equal(validArea.confidence, 7);
});

test("mapping conflict beyond the nearest explicit source reports the Framework, Items and full Card chain", () => {
  const framework = frameworkFixtures()[0]; framework.areas[0].items[1].cardTemplateIds = ["nested", "fork"];
  const result = resolveEffectiveMapping(framework, "nested", graph());
  assert.equal(result.state, "incomplete"); if (result.state !== "incomplete") return;
  assert.equal(result.issues[0].code, "MAPPING_CONFLICT"); assert.equal(result.issues[0].frameworkId, "practice");
  assert.deepEqual(result.issues[0].itemIds, ["practice-speed", "practice-control"]);
  assert.deepEqual(result.issues[0].cardTemplateIds, ["nested", "fork", "original"]);
  assert.ok(validateFrameworkAncestry(framework, graph()).length > 0);
  const result2 = calculateMappedProgress(framework, { areaId: "skills" }, graph(), eligible([]), new Map());
  assert.equal(result2.state, "incomplete"); assert.equal(result2.completion, null);
});

test("missing, malformed and cyclic ancestry cannot masquerade as unmapped or mapped", () => {
  const framework = frameworkFixtures()[0];
  for (const [parent, code] of [[undefined, "MALFORMED_CANONICAL_ANCESTRY"], [{ cardTemplateId: "original", version: 0 }, "MALFORMED_CANONICAL_ANCESTRY"],
    [{ cardTemplateId: "missing", version: 1 }, "MISSING_CANONICAL_ANCESTOR"], [{ cardTemplateId: "fork", version: 1 }, "ANCESTRY_CYCLE"]] as const) {
    const ancestry = new Map<string, unknown>(graph()); ancestry.set("fork", { cardTemplateId: "fork", forkedFrom: parent });
    const result = resolveEffectiveMapping(framework, "fork", ancestry);
    assert.equal(result.state, "incomplete"); if (result.state === "incomplete") assert.equal(result.issues[0].code, code);
  }
  const ancestry = new Map<string, unknown>(graph()); ancestry.delete("original");
  assert.ok(validateFrameworkAncestry(framework, ancestry).some((issue) => issue.code === "MISSING_CANONICAL_ANCESTOR"));
});

test("active and archived memberships deduplicate references; archived-only work remains eligible", () => {
  const decks = [deckFixture("active", ["original", "unrelated"]), deckFixture("archived", ["original", "fork"], true)];
  const result = collectPersonalEligibility("alice", decks.map((d) => d.data), decks.map((d) => d.root), decks.map((d) => d.version));
  assert.deepEqual(result.cardTemplateIds, ["original", "unrelated", "fork"]); assert.equal(result.unknownComposition, false);
  assert.deepEqual(collectPersonalEligibility("alice", [decks[1].data], [decks[1].root], [decks[1].version]).cardTemplateIds, ["original", "fork"]);
  // Canonical owned/Library content and retained personal records establish no membership.
  assert.deepEqual(collectPersonalEligibility("alice", [], decks.map((d) => d.root), decks.map((d) => d.version)).cardTemplateIds, []);
});

test("eligibility uses adopted Deck composition, and distinguishes unavailable membership from an empty Deck", () => {
  const deck = deckFixture("adopted", ["original"]), newer = { ...deck.version, version: 2, content: { ...deck.version.content, cards: [{ cardTemplateId: "second", cardVersionAtPublish: 1 }] } };
  assert.deepEqual(collectPersonalEligibility("alice", [deck.data], [deck.root], [deck.version, newer]).cardTemplateIds, ["original"]);
  assert.equal(collectPersonalEligibility("alice", [deck.data], [deck.root], [newer]).unknownComposition, true);
  const empty = deckFixture("empty", []);
  assert.deepEqual(collectPersonalEligibility("alice", [empty.data], [empty.root], [empty.version]), eligible([]));
  assert.equal(collectPersonalEligibility("bob", [deck.data], [deck.root], [deck.version]).unknownComposition, true);
  assert.equal(collectPersonalEligibility("alice", [deck.data, deck.data], [deck.root], [deck.version]).unknownComposition, true);
  assert.equal(collectPersonalEligibility("alice", [deck.data], [deck.root], [{ ...deck.version, content: null as never }]).unknownComposition, true);
});

test("adopted Card Steps control calculation; old entries and newer publications are excluded", () => {
  const card = cardFixture("original"); card.data.items[0].completionStatus = "done";
  card.data.items.push({ stepId: "obsolete", completionStatus: "done" }); card.data.signalReadings.push({ stepId: "obsolete", reading: 10 });
  const newer = { ...card.version, version: 2, content: cardFixture("rewritten").version.content };
  const resolved = resolveAdoptedCardCalculation("alice", "original", [card.root], [newer, card.version], [card.data]);
  assert.equal(resolved.state, "complete"); if (resolved.state !== "complete") return;
  assert.equal(resolved.adoptedVersion, 1); assert.deepEqual(resolved.steps.map((step) => step.stepId), ["original-1", "original-2", "original-3"]);
  assert.equal(calculateCardProgress([resolved]).completion, 33); assert.equal(calculateCardProgress([resolved]).confidence, null);
});

test("optional individual Step state defaults normally; malformed required state and duplicate identities fail explicitly", () => {
  const card = cardFixture("original"); card.data.items = []; card.data.signalReadings = [];
  assert.equal(calculateCardProgress([calculation(card)]).completion, 0);
  card.data.items = [{ stepId: "original-1", completionStatus: "done" }, { stepId: "original-1", completionStatus: "todo" }];
  assert.equal(calculation(card).state, "incomplete");
  card.data.items = []; card.data.signalReadings = [{ stepId: "original-1", reading: 11 }]; assert.equal(calculation(card).state, "incomplete");
  card.data.signalReadings = undefined as never; assert.equal(calculation(card).state, "incomplete");
  card.data.signalReadings = []; card.version.content.steps.pop(); assert.equal(calculation(card).state, "incomplete");
});

test("original and fork contribute independently; unrelated Cards in the same Deck do not inherit mappings", () => {
  const entries = cards(); entries.find((c) => c.root.cardTemplateId === "fork")!.data.items.forEach((step) => { step.completionStatus = "done"; });
  const calculations = new Map(entries.map((card) => [card.root.cardTemplateId, calculation(card)]));
  const result = calculateMappedProgress(frameworkFixtures()[0], { itemId: "practice-control" }, graph(), eligible(["original", "fork", "original", "unrelated"]), calculations);
  assert.equal(result.completion, 50); assert.equal(result.eligibleCardCount, 2);
  assert.equal(calculateMappedProgress(frameworkFixtures()[0], { itemId: "practice-empty" }, graph(), eligible(["unrelated"]), calculations).state, "empty");
});

test("confirmed unmapped Cards do not taint metrics, but unresolved mapping is not silently excluded", () => {
  const framework = frameworkFixtures()[0], ancestry = graph(), card = cardFixture("original");
  card.data.items.forEach((step) => { step.completionStatus = "done"; }); card.data.signalReadings[0].reading = 8;
  const calculations = new Map([["original", calculation(card)]]);
  const baseline = calculateMappedProgress(framework, { areaId: "skills" }, ancestry, eligible(["original"]), calculations);
  assert.equal(baseline.state, "complete"); assert.equal(baseline.completion, 100); assert.equal(baseline.confidence, 8);
  // This eligible Card has proven unmapped ancestry and unavailable learning data.
  calculations.set("unrelated", { state: "incomplete", cardTemplateId: "unrelated",
    issues: [{ code: "MISSING_OR_AMBIGUOUS_CARD_DATA", cardTemplateIds: ["unrelated"] }] });
  assert.deepEqual(calculateMappedProgress(framework, { areaId: "skills" }, ancestry, eligible(["original", "unrelated"]), calculations), baseline);
  const unknown = calculateMappedProgress(framework, { areaId: "skills" }, ancestry, eligible(["original", "missing"]), calculations);
  assert.equal(unknown.state, "incomplete"); assert.equal(unknown.completion, null); assert.equal(unknown.confidence, null);
  assert.equal(unknown.eligibleCardCount, null); assert.equal(unknown.resolvedCardCount, 1);
  assert.ok(unknown.issues.some((issue) => issue.code === "MISSING_CANONICAL_ANCESTOR" && issue.cardTemplateIds?.includes("missing")));
});

test("Area completion and confidence aggregate underlying distinct Cards, not Item scores", () => {
  const entries = cards(), original = entries[0], second = entries[1], speed = entries[2];
  original.data.items.forEach((step) => { step.completionStatus = "done"; });
  second.data.items.forEach((step) => { step.completionStatus = "skipped"; });
  speed.data.items[1].completionStatus = "skipped"; speed.data.items[2].completionStatus = "skipped";
  original.data.signalReadings[0].reading = 1.49; second.data.signalReadings.forEach((signal) => { signal.reading = 2.49; }); speed.data.signalReadings[0].reading = 9.49;
  const calculations = new Map(entries.map((card) => [card.root.cardTemplateId, calculation(card)]));
  const framework = frameworkFixtures()[0], membership = eligible(["original", "second", "speed"]);
  const item = calculateMappedProgress(framework, { itemId: "practice-control" }, graph(), membership, calculations);
  const area = calculateMappedProgress(framework, { areaId: "skills" }, graph(), membership, calculations);
  assert.equal(item.completion, 100); assert.equal(item.confidence, 2);
  assert.equal(area.completion, 75); assert.equal(area.confidence, 4); // raw mean 3.69, not mean of rounded Item scores (6).
  assert.equal(area.eligibleCardCount, 3);
});

test("all-skipped is complete, zero is distinct from empty, and confidence retains skipped readings", () => {
  assert.equal(getProgressPercentage([]), null); assert.equal(getProgressPercentage([{ completionStatus: "todo" }]), 0);
  assert.equal(getProgressPercentage([{ completionStatus: "skipped" }]), 100);
  const card = cardFixture("original"); card.data.items.forEach((step) => { step.completionStatus = "skipped"; });
  card.data.signalReadings[0].reading = 1; card.data.signalReadings[1].reading = 10;
  const result = calculateCardProgress([calculation(card)]); assert.equal(result.state, "complete"); assert.equal(result.completion, 100); assert.equal(result.confidence, 6);
  assert.equal(calculateCardProgress([]).state, "empty"); assert.equal(getConfidenceScore([null, undefined]), null);
});

test("partial failures suppress affected scores, preserve unrelated Item scores, and unknown mappings suppress possible contributors", () => {
  const entries = cards(); entries[0].data.signalReadings[0].reading = 4; entries[2].data.signalReadings[0].reading = 8;
  const calculations = new Map(entries.map((card) => [card.root.cardTemplateId, calculation(card)]));
  calculations.delete("second"); const framework = frameworkFixtures()[0], membership = eligible(["original", "second", "speed"]);
  const affected = calculateMappedProgress(framework, { itemId: "practice-control" }, graph(), membership, calculations);
  assert.equal(affected.state, "incomplete"); assert.equal(affected.completion, null); assert.equal(affected.confidence, null); assert.equal(affected.resolvedCardCount, 1);
  const unrelated = calculateMappedProgress(framework, { itemId: "practice-speed" }, graph(), membership, calculations);
  assert.equal(unrelated.state, "complete"); assert.equal(unrelated.completion, 0); assert.equal(unrelated.confidence, 8);
  const area = calculateMappedProgress(framework, { areaId: "skills" }, graph(), membership, calculations);
  assert.equal(area.state, "incomplete"); assert.equal(area.completion, null); assert.equal(area.confidence, null);
  const unknown = calculateMappedProgress(framework, { itemId: "practice-speed" }, graph(), eligible(["missing"]), calculations);
  assert.equal(unknown.state, "incomplete"); assert.equal(unknown.eligibleCardCount, null);
  assert.equal(calculateMappedProgress(framework, { areaId: "skills" }, graph(), { ...membership, unknownComposition: true }, calculations).state, "incomplete");
  assert.equal(calculateMappedProgress(framework, { areaId: "absent" }, graph(), membership, calculations).state, "incomplete");
  assert.equal(calculateMappedProgress(framework, { itemId: "practice-empty" }, graph(), { ...membership, unknownComposition: true }, calculations).state, "empty");
  assert.equal(calculateMappedProgress(framework, { areaId: "empty" }, graph(), eligible(["missing"]), calculations).state, "empty");
});

test("shared calculation validates three-Step inputs and deduplicates identical Card projections", () => {
  const card = calculation(cardFixture("original")); assert.equal(card.state, "complete"); if (card.state !== "complete") return;
  assert.equal(calculateCardProgress([card, structuredClone(card)]).eligibleCardCount, 1);
  assert.equal(calculateCardProgress([{ ...card, steps: [] }]).state, "incomplete");
  const different = structuredClone(card); different.steps[0].completionStatus = "done";
  assert.equal(calculateCardProgress([card, different]).state, "incomplete");
  assert.equal(calculateCardProgress([{ state: "incomplete", cardTemplateId: "missing", issues: [] }]).state, "incomplete");
  const mismatched = calculateMappedProgress(frameworkFixtures()[0], { itemId: "practice-control" }, graph(), eligible(["original"]),
    new Map([["original", { ...card, cardTemplateId: "unrelated" }]]));
  assert.equal(mismatched.state, "incomplete"); assert.equal(mismatched.issues[0].code, "CARD_CALCULATION_ID_MISMATCH");
});
