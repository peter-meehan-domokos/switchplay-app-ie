import assert from "node:assert/strict";
import { test } from "node:test";
import { entryDigest, liveApplyAllowed, parseManifest, permissionState, type ManifestEntry } from "../src/lib/knownUserBackfill";

const id = "a".repeat(24);
const base = (over: Record<string, unknown> = {}) => ({ manifestId: "m1", reviewedBy: "founder", reviewedAt: "2026-11-14T10:00:00Z", accounts: [{ userId: id, publicPublishing: true, currentPublicPublishing: "missing", ...over }] });
const problems = (raw: unknown) => parseManifest(raw).problems;

test("a complete minimal manifest is valid; every disposition must be an explicit boolean", () => {
  assert.deepEqual(problems(base()), []);
  for (const bad of [null, undefined, "true", 1]) assert.match(problems(base({ publicPublishing: bad })).join(), /explicitly true or false/);
  assert.match(problems(base({ currentPublicPublishing: "yes" })).join(), /currentPublicPublishing/);
  assert.match(problems(base({ currentPublicPublishing: undefined })).join(), /currentPublicPublishing/, "the expected current state is mandatory");
});
test("unknown fields, duplicates and unidentified accounts are rejected", () => {
  assert.match(problems(base({ isAdmin: true })).join(), /unexpected field "isAdmin"/);
  assert.match(problems(base({ permissions: { publicPublishing: true } })).join(), /unexpected field "permissions"/);
  assert.match(problems({ ...base(), accounts: [...base().accounts, ...base().accounts] }).join(), /duplicate/);
  assert.match(problems(base({ userId: undefined })).join(), /identify the account/);
  assert.match(problems(base({ userId: "xyz" })).join(), /24-character/);
  assert.match(problems({ manifestId: "", accounts: [] }).join(), /manifestId/);
  assert.match(problems([]).join(), /accounts array/);
});
test("date of birth evidence: real past dates; self-declared only with provenance; independent only with full evidence; corrections carry actor and reason", () => {
  const sg = (over: Record<string, unknown>) => problems(base({ safeguarding: { dateOfBirth: "2011-04-02", ...over } })).join();
  assert.equal(sg({}), "");
  assert.match(sg({ dateOfBirth: "2011-02-30" }), /real, past/); assert.match(sg({ dateOfBirth: "2999-01-01" }), /real, past/);
  assert.match(sg({ dobSource: "self-declared" }), /selfDeclarationProvenance/); assert.equal(sg({ dobSource: "self-declared", selfDeclarationProvenance: "typed on the old signup form" }), "");
  assert.match(sg({ dobSource: "verified" }), /dobSource/);
  assert.match(sg({ ageAssurance: { verification: "independent", method: "x" } }), /needs method/);
  assert.equal(sg({ ageAssurance: { verification: "independent", method: "document check", verifiedAt: "2026-11-01T00:00:00Z", evidenceReference: "ref-7" } }), "");
  assert.match(sg({ correction: { actor: "", reason: "r" } }), /actor/);
  assert.match(sg({ correction: { actor: "founder", reason: "typo" }, ageAssurance: { verification: "independent", method: "m", verifiedAt: "2026-11-01T00:00:00Z", evidenceReference: "r" } }), /invalidates assurance/);
});
test("Puckle details: student/teacher rules, A-level null, malformed education and mobile are refused", () => {
  const pk = (over: Record<string, unknown>) => problems(base({ puckle: { name: "Ada", registrationCategory: "student", ...over } })).join();
  assert.equal(pk({}), "", "incomplete historical student facts may stay unknown");
  assert.equal(pk({ education: { course: "a-level", courseOther: "", level: null, levelOther: "" } }), "");
  assert.match(pk({ education: { course: "a-level", level: "higher" } }), /education/); assert.match(pk({ education: { course: "gcse", level: "ordinary" } }), /education/);
  assert.match(pk({ registrationCategory: "teacher", education: { course: "gcse", level: "higher-tier" } }), /no maths course/); assert.match(pk({ teacherIntroduction: "hi" }), /only teachers/);
  assert.match(pk({ registrationCategory: "parent" }), /student or teacher/); assert.match(pk({ mobile: "12" }), /mobile/); assert.equal(pk({ mobile: "+353871234567" }), "");
});
test("permission states: missing, boolean or malformed; malformed is never guessed at", () => {
  assert.equal(permissionState(undefined), "missing"); assert.equal(permissionState({}), "missing");
  assert.equal(permissionState({ publicPublishing: true }), true); assert.equal(permissionState({ publicPublishing: false }), false);
  for (const odd of [null, [], [{ publicPublishing: true }], { publicPublishing: "true" }, { publicPublishing: null }, { publicPublishing: true, extra: 1 }, "x", 0]) assert.equal(permissionState(odd), "malformed", JSON.stringify(odd));
});
test("the entry digest is stable under key order and changes with any reviewed value", () => {
  const entry = base().accounts[0] as unknown as ManifestEntry;
  assert.equal(entryDigest(entry), entryDigest({ currentPublicPublishing: "missing", publicPublishing: true, userId: id } as ManifestEntry));
  assert.notEqual(entryDigest(entry), entryDigest({ ...entry, publicPublishing: false })); assert.notEqual(entryDigest(entry), entryDigest({ ...entry, puckle: { name: "x", registrationCategory: "teacher" } }));
});
test("writes need a disposable database, or production mode plus the exact manifest id typed as confirmation", () => {
  const ok = (over: Partial<Parameters<typeof liveApplyAllowed>[0]>) => liveApplyAllowed({ disposable: false, mode: undefined, confirmation: undefined, manifestId: "m1", ...over });
  assert.equal(ok({ disposable: true }), true); assert.equal(ok({}), false);
  assert.equal(ok({ mode: "production" }), false); assert.equal(ok({ mode: "production", confirmation: "wrong" }), false); assert.equal(ok({ confirmation: "m1" }), false, "not without production mode");
  assert.equal(ok({ mode: "production", confirmation: "m1" }), true); assert.equal(ok({ mode: "production", confirmation: "", manifestId: "" }), false);
});
