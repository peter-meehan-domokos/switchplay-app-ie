import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReflectionEntry, ReflectionContext } from "../src/lib/reflections/model";
import { reflectionSlotKey } from "../src/lib/reflections/model";
import { ownReflectionItems, sharedReflectionItems } from "../src/lib/reflections/presentation";
const personal = (text = "Personal practice", createdAt: string | null = null): ReflectionEntry => ({ source: { kind: "personal", cardTemplateId: "card" }, authorUserId: "aoife", authorName: "Aoife Kelly", text, createdAt, revision: 0, originName: "Personal", groupVisible: false });
const group = (id: string, createdAt: string, extra: Partial<ReflectionEntry> = {}): ReflectionEntry => ({ ...personal(), source: { kind: "group", cardTemplateId: "card", experienceId: id, reflectionId: `row-${id}` }, originName: id === "galway" ? "Galway U18" : "Galway development", createdAt, groupVisible: true, ...extra });
const context: ReflectionContext = { kind: "personal", cardTemplateId: "card", viewerUserId: "aoife" };
const monday = group("galway", "2026-11-02T12:00:00Z"), tuesday = group("development", "2026-11-03T12:00:00Z");
test("Personal first slot remains first even empty; other origins follow original creation date", () => {
  const empty = personal(""); const rows = ownReflectionItems(context, empty, [tuesday, monday]);
  assert.deepEqual(rows.map(r => r.entry.originName), ["Personal", "Galway development", "Galway U18"]);
  assert.equal(rows[0].empty, true); assert.equal(rows[0].label, "Personal");
  assert.deepEqual(rows[0].entry.source, empty.source); assert.equal(rows[0].entry.createdAt, null);
  assert.equal(ownReflectionItems(context, personal(), [])[0].label, null);
});
test("own Group slot stays first, including hidden or empty, with undated legacy Personal last", () => {
  const ctx: ReflectionContext = { ...context, kind: "group", experienceId: "galway" };
  const hidden = { ...monday, groupVisible: false };
  const rows = ownReflectionItems(ctx, hidden, [personal(), tuesday, hidden]);
  assert.deepEqual(rows.map(r => r.entry.originName), ["Galway U18", "Galway development", "Personal"]);
  assert.deepEqual(rows.map(r => r.private), [true, true, true]);
  assert.equal(ownReflectionItems(ctx, monday, [personal()])[0].private, false);
  const empty = { ...monday, text: "", source: { ...monday.source, reflectionId: null } } as ReflectionEntry;
  assert.equal(ownReflectionItems(ctx, empty, [personal(), tuesday])[0].empty, true);
});
test("same-date ordering is stable; text edits never change source identity or original-date priority", () => {
  const sameTime = { ...tuesday, createdAt: monday.createdAt };
  const one = ownReflectionItems(context, personal(), [monday, sameTime]);
  const two = ownReflectionItems(context, personal(), [sameTime, { ...monday, text: "Edited later", revision: 4 }]);
  assert.deepEqual(one.map(r => reflectionSlotKey(r.entry)), two.map(r => reflectionSlotKey(r.entry)));
  const edited = { ...monday, text: "Edited", revision: 7 };
  assert.equal(reflectionSlotKey(monday), reflectionSlotKey(edited));
});
test("foreign author, wrong current context, duplicates and invalid dates are rejected", () => {
  assert.throws(() => ownReflectionItems(context, personal(), [{ ...monday, authorUserId: "another" }]));
  assert.throws(() => ownReflectionItems(context, monday, []));
  assert.throws(() => ownReflectionItems(context, personal(), [monday, monday]));
  assert.throws(() => ownReflectionItems(context, personal(), [{ ...monday, createdAt: "not-a-date" }]));
});
test("Group shared and inspected lists have no empty slots or private/other-origin inputs", () => {
  const ctx = { ...context, kind: "group" as const, experienceId: "galway" };
  const admin = group("galway", "2026-11-04T12:00:00Z", { authorUserId: "phase2", authorName: "phase2" });
  const rows = sharedReflectionItems(ctx, [monday, admin]);
  assert.deepEqual(rows.map(r => r.label), ["phase2", "Aoife Kelly"]);
  assert.equal(sharedReflectionItems(ctx, [monday], "aoife")[0].label, "Galway U18");
  for (const row of [{ ...monday, groupVisible: false }, tuesday, personal(), { ...monday, text: "" }]) assert.throws(() => sharedReflectionItems(ctx, [row]));
  assert.throws(() => sharedReflectionItems(ctx, [admin], "aoife"));
});

test("compact reflection Group names keep full stored values and shorten only beyond fifteen characters", async () => {
  const { compactGroupName } = await import("../src/lib/groupExperiences/namePresentation");
  assert.equal(compactGroupName("Galway U18"), "Galway U18");
  assert.equal(compactGroupName("123456789012345"), "123456789012345");
  assert.equal(compactGroupName("1234567890123456"), "12345678901234…");
  const original = "Galway development team";
  assert.equal(compactGroupName(original), "Galway develop…");
  assert.equal(Array.from(compactGroupName(original)).length, 15);
  assert.equal(original, "Galway development team");
});

test("individual previews contain only the exact current context, including its empty slot", async () => {
  const { currentContextReflection } = await import("../src/lib/reflections/presentation");
  const p = personal(), groupContext = { ...context, kind: "group" as const, experienceId: "galway" };
  const personalHistory = ownReflectionItems(context, p, [monday, tuesday]);
  assert.equal(currentContextReflection(context, personalHistory)?.entry.text, p.text);
  const empty = { ...monday, text: "" };
  const ownGroup = ownReflectionItems(groupContext, empty, [p, tuesday]);
  assert.equal(currentContextReflection(groupContext, ownGroup)?.empty, true);
  assert.equal(currentContextReflection(groupContext, personalHistory)?.entry.text, monday.text);
  assert.equal(currentContextReflection({ ...groupContext, experienceId: "missing" }, personalHistory), null);
});

test("member carousel contains only current Group visible nonblank author contributions", async () => {
  const { memberReflectionItems } = await import("../src/lib/reflections/presentation");
  const ctx = { ...context, kind: "group" as const, experienceId: "galway" };
  const rows = ownReflectionItems(ctx, monday, [personal(), tuesday]);
  const hidden = { entry: { ...monday, authorUserId: "other-member", groupVisible: false }, empty: false, private: true, label: null };
  const empty = { entry: { ...monday, authorUserId: "third-member", text: "" }, empty: true, private: false, label: null };
  const carousel = memberReflectionItems(ctx, [...rows, hidden, empty]);
  assert.equal(carousel.length, 1); assert.equal(carousel[0].entry.authorName, "Aoife Kelly");
  assert.equal(memberReflectionItems(ctx, [hidden, empty]).length, 0);
});
