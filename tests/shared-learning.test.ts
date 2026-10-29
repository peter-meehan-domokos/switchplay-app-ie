import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultCardContent } from "../src/lib/cards/creatorDefaults";
import { initialCardData } from "../src/lib/cards/domain";
import { projectLearning, projectPersonalLearning, reconcileLearning } from "../src/lib/cards/learning";
import { cardLearningContextKey, learningOwnerKey, type CardLearningContext } from "../src/lib/cards/learningContext";
import { mergeRetainedAssignments } from "../src/lib/cards/retainedAssignments";
import { WorkingCardStore } from "../src/lib/cards/workingCardStore";
import { PersonalWork } from "../src/lib/cards/personalWork";
import { buildCardLayout } from "../src/components/cards/cardLayout";

const v1 = createDefaultCardContent(["a", "b", "c"]);
const v2 = { ...v1, steps: [v1.steps[1], v1.steps[0], v1.steps[2]] };
const v3 = { ...v1, steps: [...v1.steps.slice(0, 2), { ...v1.steps[2], stepId: "d" }] };
const data = () => ({ ...initialCardData("x", 2, v2, new Date()), reflection: "private reflection", targetDate: "2027-01-01",
  tests: [{ id: "private-test", result: true, date: "2026-10-29", createdAt: new Date() }], personalInfoCardIds: ["private-info"] });

test("explicit version projections share stable values, default new IDs and expose no private fields", () => {
  const record = data(); record.items.find(item => item.stepId === "a")!.completionStatus = "done";
  record.signalReadings.find(signal => signal.stepId === "a")!.reading = 6.42;
  const before = structuredClone(record);
  for (const [index, content] of [v1, v2, v3].entries()) {
    const result = projectPersonalLearning("x", index + 1, content, [record]);
    assert.equal(result.items.find(item => item.stepId === "a")!.completionStatus, "done");
    assert.equal(result.signalReadings.find(signal => signal.stepId === "a")!.reading, 6.42);
    assert.deepEqual(Object.keys(result).sort(), ["cardTemplateId", "items", "signalReadings", "version"]);
    assert.ok(!JSON.stringify(result).includes("private"));
    assert.deepEqual(result.items.map(item => item.stepId), content.steps.map(step => step.stepId));
  }
  assert.equal(projectLearning(v3, record).items[2].completionStatus, "todo");
  assert.equal(projectLearning(v3, record).signalReadings[2].reading, null);
  assert.deepEqual(record, before);
});

test("reconciliation retains obsolete Step values without leaking extra fields or mutating the authority", () => {
  const record = data(); record.items[2].completionStatus = "skipped"; record.signalReadings[2].reading = 9;
  const original = structuredClone(record), next = reconcileLearning(record, v3);
  assert.equal(next.items.find(item => item.stepId === "c")!.completionStatus, "skipped");
  assert.equal(next.signalReadings.find(signal => signal.stepId === "c")!.reading, 9);
  assert.equal(projectLearning(v1, next).items[2].completionStatus, "skipped");
  assert.deepEqual(record, original);
});

test("unstarted defaults are explicit and do not disguise duplicate or malformed learning", () => {
  assert.throws(() => projectPersonalLearning("x", 1, v1, []), { code: "MISSING_CARD_DATA" });
  assert.deepEqual(projectPersonalLearning("x", 1, v1, [], true).items.map(item => item.completionStatus), ["todo", "todo", "todo"]);
  const record = data();
  assert.throws(() => projectPersonalLearning("x", 1, v1, [record, record], true), { code: "AMBIGUOUS_CARD_DATA" });
  for (const broken of [{ ...record, items: [...record.items, record.items[0]] },
    { ...record, signalReadings: [{ stepId: "a", reading: NaN }] },
    { ...record, items: [{ stepId: "obsolete", completionStatus: "bad" }] }]) {
    assert.throws(() => projectLearning(v1, broken as ReturnType<typeof data>));
  }
});

test("retained assignment references deduplicate and select only the highest actually assigned version", () => {
  const before = [{ cardTemplateId: "x", version: 2 }];
  const after = mergeRetainedAssignments(before, [{ cardTemplateId: "y", version: 1 }]);
  assert.deepEqual(after, [...before, { cardTemplateId: "y", version: 1 }]);
  assert.deepEqual(mergeRetainedAssignments(after, [{ cardTemplateId: "x", version: 1 }, { cardTemplateId: "x", version: 3 }]),
    [{ cardTemplateId: "x", version: 3 }, { cardTemplateId: "y", version: 1 }]);
  assert.deepEqual(before, [{ cardTemplateId: "x", version: 2 }]);
  assert.throws(() => mergeRetainedAssignments([], [{ cardTemplateId: "x", version: 0 }]));
});

test("presentation keys isolate viewer, experience, subject, version and perspective; learning owner keys intentionally reuse", () => {
  const contexts: CardLearningContext[] = [
    { kind: "personal", deckTemplateId: "deck", cardTemplateId: "x", version: 1 },
    { kind: "experience", experienceId: "A", cardTemplateId: "x", version: 1, perspective: "self" },
    { kind: "experience", experienceId: "B", cardTemplateId: "x", version: 1, perspective: "self" },
    { kind: "experience", experienceId: "A", cardTemplateId: "x", version: 1, perspective: "group" },
    { kind: "experience", experienceId: "A", cardTemplateId: "x", version: 1, perspective: "follower", subjectUserId: "bob" },
    { kind: "experience", experienceId: "A", cardTemplateId: "x", version: 1, perspective: "follower", subjectUserId: "charlie" },
    { kind: "experience", experienceId: "A", cardTemplateId: "x", version: 3, perspective: "self" },
  ];
  const keys = contexts.flatMap(context => ["alice", "bob"].map(actor => cardLearningContextKey(actor, context)));
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(learningOwnerKey("alice", "x"), learningOwnerKey("alice", "x"));
  assert.notEqual(learningOwnerKey("a:b", "c"), learningOwnerKey("a", "b:c"));
});

function layout() {
  return buildCardLayout({ id: "x", cardTemplateId: "x", adoptedVersion: 1, dataOwnerUserId: "alice", label: "Card 1", targetDate: "2027-01-01",
    intro: v1.intro, steps: v1.steps.map(step => ({ ...step, completionStatus: "todo" })), signals: [], reflection: "Private",
    chats: [], mediaItems: [], personalInfoCardIds: ["note"], personalInfoRevision: 2 }, { currentUserId: "alice", users: [] });
}

test("personal presentation cache refuses group/foreign payloads and invalidates stale reads and signed-out sessions", () => {
  const store = new WorkingCardStore(), card = layout();
  store.accept("alice", [card]); const epoch = store.epoch("alice"), session = store.session("alice");
  assert.throws(() => store.accept("alice", [card], { kind: "experience", experienceId: "A", cardTemplateId: "x", version: 1, perspective: "self" }));
  assert.throws(() => store.accept("bob", [card]), { code: "PERSONAL_CACHE_OWNER_MISMATCH" });
  store.invalidateLearning("alice", "x");
  assert.equal(store.personal("alice", "x"), undefined);
  assert.equal(store.accept("alice", [card], undefined, epoch), false);
  assert.deepEqual(store.projectPersonal("alice", card).personalInfoCardIds, ["note"]);
  store.clearUser("alice");
  assert.equal(store.accept("alice", [card], undefined, undefined, session), false);
  assert.equal(store.personal("alice", "x"), undefined);
});

test("contribution work and failures are isolated while shared learning barriers span Decks", async () => {
  const work = new PersonalWork();
  const a = { userId: "alice", cardIds: ["x"], context: { kind: "experience-contribution" as const, experienceId: "A" } };
  const b = { ...a, context: { ...a.context, experienceId: "B" } };
  const learning = { userId: "alice", cardIds: ["x"] };
  let release!: () => void;
  const operation = work.run(a, "same", () => new Promise<void>(resolve => { release = resolve; }));
  await Promise.resolve();
  assert.equal(work.hasWork(a), true); assert.equal(work.hasWork(b), false); assert.equal(work.hasWork(learning), false);
  await work.run(b, "same", async () => {});
  assert.equal(work.hasWork(a), true); release(); await operation;
  const unlock = work.lock(learning);
  await assert.rejects(work.run({ ...learning, deckId: "other-deck" }, "signal", async () => {}), /wait for Update/);
  await work.run(a, "upload", async () => {}); unlock();
  await assert.rejects(work.run(a, "save", async () => { throw Error("A only"); }));
  await work.wait(b); await work.wait(learning); await assert.rejects(work.wait(a), /A only/);
});
