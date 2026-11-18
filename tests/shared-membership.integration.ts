import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { preparePuckleMembership, MEMBERSHIP_INDEXES, main } from "../scripts/prepare-puckle-membership";
import { correctDateOfBirth, getSafeguardingFacts } from "../src/lib/userSafeguarding";
import { GROUP_EXPERIENCE_SCOPE } from "../src/lib/parentalApprovalScope";
let server: MongoMemoryReplSet, client: MongoClient, db: Db;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); db = client.db("switchplay_test_membership"); });
after(async () => { await client?.close(); await server?.stop(); });
const user = (name: string) => ({ _id: new ObjectId(), username: name, email: `${name.toLowerCase()}@example.com`, passwordHash: "unchanged", cardsData: [], decksData: [], createdAt: new Date() });
test("import/CLI without explicit apply does not connect or prepare anything", async () => { assert.equal(await main([]), 1); assert.equal(await db.listCollections().toArray().then(x => x.length), 0); });
test("preparation is repeatable and preserves account data; identity indexes use binary case", async () => {
  const original = user("Trusted"); await db.collection("users").insertOne(original);
  const first = await preparePuckleMembership(db); assert.ok(first.indexesAdded > 0);
  assert.equal((await preparePuckleMembership(db)).indexesAdded, 0);
  assert.deepEqual(await db.collection("users").findOne({ _id: original._id }), original);
  assert.deepEqual((await db.listCollections().toArray()).map(x => x.name).sort(), Object.keys(MEMBERSHIP_INDEXES).sort());
  await db.collection("users").insertOne({ ...user("trusted"), email: "different@example.com" });
  await assert.rejects(db.collection("users").insertOne({ ...user("Other"), email: original.email }), { code: 11000 });
  await assert.rejects(db.collection("users").insertOne({ ...user("Trusted"), email: "third@example.com" }), { code: 11000 });
  await db.collection("puckleMemberships").insertOne({ userId: original._id });
  await assert.rejects(db.collection("puckleMemberships").insertOne({ userId: original._id }), { code: 11000 });
  for (const name of ["users", "puckleMemberships", "puckleJoinContactRequests", "puckleInterestContacts", "puckleTuitionEnquiries"]) assert.ok((await db.collection(name).listIndexes().toArray()).every(x => x.expireAfterSeconds === undefined));
  for (const name of ["accountEmailChallenges", "accountEmailActions", "emailRequestLimits"]) assert.ok((await db.collection(name).listIndexes().toArray()).some(x => x.expireAfterSeconds === 0));
});
test("preflight reports duplicates, incompatible indexes and identity formats without repairs/DDL", async () => {
  const duplicateDb = client.db("switchplay_test_membership_duplicates");
  await duplicateDb.collection("users").insertMany([user("A"), { ...user("B"), username: "A" }]);
  await assert.rejects(preparePuckleMembership(duplicateDb), /DUPLICATE/);
  assert.equal((await duplicateDb.listCollections().toArray()).length, 1);
  const conflictDb = client.db("switchplay_test_membership_conflict");
  await conflictDb.collection("users").createIndex({ email: 1 });
  await assert.rejects(preparePuckleMembership(conflictDb), /CONFLICTING/);
  await conflictDb.collection("users").insertOne({ ...user("X"), email: "X@EXAMPLE.COM" });
  await assert.rejects(preparePuckleMembership(conflictDb), /IDENTITY_FORMAT/);
});
test("shared facts need no Puckle profile or mandatory DOB/permissions for existing users", async () => {
  const original = user("Existing"); await db.collection("users").insertOne(original);
  const facts = await getSafeguardingFacts(db, original._id, "2026-11-14");
  assert.equal(facts.age, null); assert.equal(facts.approvalStatus, "not-requested");
  assert.equal(await db.collection("puckleMemberships").findOne({ userId: original._id }), null);
  assert.deepEqual(await db.collection("users").findOne({ _id: original._id }), original);
  await assert.rejects(getSafeguardingFacts(db, new ObjectId()), /ACCOUNT_NOT_FOUND/);
});
test("one stored approval is shared across site contexts; DOB source does not imply assurance", async () => {
  const original = user("Shared");
  const approval = { scopeId: GROUP_EXPERIENCE_SCOPE.scopeId, status: "approved", generation: 1,
    explanation: { version: "test-only", text: "Fixture, not launch wording" }, history: [] };
  await db.collection("users").insertOne({ ...original, safeguarding: { dateOfBirth: "2011-11-14", dobSource: "self-declared", ageAssurance: { verification: "none" }, groupExperienceApproval: approval } });
  for (const site of GROUP_EXPERIENCE_SCOPE.sites) {
    const facts = await getSafeguardingFacts(db, original._id, "2026-11-14");
    assert.equal(facts.age, 15, site); assert.equal(facts.ageAssurance.verification, "none", site); assert.deepEqual(facts.groupExperienceApproval, approval, site);
  }
});
test("reviewed correction invalidates assurance, appends history and preserves concurrent learning/approval/permission writes", async () => {
  const original = user("Corrected"); const at = new Date("2026-11-14T12:00:00Z");
  await db.collection("users").insertOne({ ...original, permissions: { publicPublishing: true }, safeguarding: {
    dateOfBirth: "2010-01-01", dobSource: "self-declared", ageAssurance: { verification: "independent", method: "fixture", verifiedAt: at, evidenceReference: "fixture" }, groupExperienceApproval: { status: "pending" },
  } });
  const correction = { expected: "2010-01-01", next: "2011-01-01", source: "operator-entered" as const, actor: "reviewer", reason: "Reviewed correction", at };
  await Promise.all([correctDateOfBirth(db, original._id, correction), db.collection<{ cardsData: { cardTemplateId: string }[] }>("users").updateOne({ _id: original._id }, { $push: { cardsData: { cardTemplateId: "preserved" } } })]);
  const saved = await db.collection("users").findOne({ _id: original._id });
  assert.equal(saved!.passwordHash, original.passwordHash); assert.equal(saved!.email, original.email); assert.deepEqual(saved!.permissions, { publicPublishing: true });
  assert.deepEqual(saved!.cardsData, [{ cardTemplateId: "preserved" }]); assert.deepEqual(saved!.decksData, []);
  assert.equal(saved!.safeguarding.groupExperienceApproval.status, "pending");
  assert.equal(saved!.safeguarding.ageAssurance.verification, "none"); assert.equal(saved!.safeguarding.dobSource, "operator-entered");
  assert.equal(saved!.safeguarding.dateOfBirthHistory[0].invalidatedAssurance.verification, "independent");
  await assert.rejects(correctDateOfBirth(db, original._id, correction), /CONFLICT/);
  await correctDateOfBirth(db, original._id, { ...correction, expected: correction.next });
  assert.equal((await db.collection("users").findOne({ _id: original._id }))!.safeguarding.dateOfBirthHistory.length, 1);
});

test("preparation reuses compatible pre-existing unique indexes without dropping them", async () => {
  const target = client.db("switchplay_test_membership_compatible");
  await target.collection("users").createIndex({ email: 1 }, { unique: true, name: "existing_email_unique" });
  await preparePuckleMembership(target);
  assert.equal((await target.collection("users").listIndexes().toArray()).find(x => x.key.email === 1)!.name, "existing_email_unique");
  assert.equal((await preparePuckleMembership(target)).indexesAdded, 0);
  const actions = target.collection("accountEmailActions");
  await actions.insertOne({ tokenDigest: "same-digest" });
  await assert.rejects(actions.insertOne({ tokenDigest: "same-digest" }), { code: 11000 });
  const challenges = target.collection("accountEmailChallenges");
  await challenges.insertMany([{ challengeId: "a", codeDigest: "same-code" }, { challengeId: "b", codeDigest: "same-code" }]);
  await assert.rejects(challenges.insertOne({ challengeId: "a" }), { code: 11000 });
});
test("competing reviewed corrections cannot both replace the same expected DOB", async () => {
  const original = user("Race");
  await db.collection("users").insertOne({ ...original, safeguarding: { dateOfBirth: "2010-01-01" } });
  const change = { expected: "2010-01-01", source: "operator-entered" as const, actor: "reviewer", reason: "Reviewed", at: new Date("2026-11-14") };
  const results = await Promise.allSettled([correctDateOfBirth(db, original._id, { ...change, next: "2011-01-01" }), correctDateOfBirth(db, original._id, { ...change, next: "2012-01-01" })]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
  assert.equal((await db.collection("users").findOne({ _id: original._id }))!.safeguarding.dateOfBirthHistory.length, 1);
});
