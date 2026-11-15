import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { preparePuckleMembership } from "../scripts/prepare-puckle-membership";
import { acknowledgeWelcome, onboardingStatus } from "../src/lib/onboarding";

let server: MongoMemoryReplSet, client: MongoClient, db: Db;
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = await new MongoClient(server.getUri()).connect(); db = client.db("switchplay_test_onboarding"); await preparePuckleMembership(db);
});
after(async () => { await client?.close(); await server?.stop(); });
const now = new Date("2026-11-14T10:00:00Z");
async function account(options: { dob?: string; category?: "student" | "teacher"; eligible?: boolean; seen?: boolean; profile?: boolean; approval?: object } = {}) {
  const _id = new ObjectId();
  await db.collection("users").insertOne({ _id, email: `${_id}@example.invalid`, username: `U${_id}`, passwordHash: "h", cardsData: [{ keep: 1 }], decksData: [], permissions: { publicPublishing: false },
    ...(options.dob || options.approval ? { safeguarding: { ...(options.dob ? { dateOfBirth: options.dob, dobSource: "self-declared", ageAssurance: { verification: "none" } } : {}), ...(options.approval ? { groupExperienceApproval: options.approval } : {}) } } : {}), createdAt: now, updatedAt: now });
  if (options.profile !== false) await db.collection("puckleMemberships").insertOne({ userId: _id, name: "N", registrationCategory: options.category ?? "student", mobile: null, initialRegistrationSource: "join",
    welcome: { eligible: options.eligible ?? true, ...(options.seen ? { seenAt: now } : {}) }, createdAt: now, updatedAt: now });
  return _id;
}
test("welcome is server-owned: eligible and unseen only; acknowledgement is idempotent and keeps the first time", async () => {
  const id = await account({ dob: "2000-01-01" });
  assert.equal((await onboardingStatus(db, id, "puckle") as { welcomePending: boolean }).welcomePending, true);
  await acknowledgeWelcome(db, id, now); await acknowledgeWelcome(db, id, new Date(now.getTime() + 9999));
  const profile = (await db.collection("puckleMemberships").findOne({ userId: id }))!; assert.equal(profile.welcome.seenAt.getTime(), now.getTime());
  assert.equal((await onboardingStatus(db, id, "puckle") as { welcomePending: boolean }).welcomePending, false);
});
test("backfilled/ineligible profiles, teachers and accounts without a profile never get a welcome", async () => {
  for (const options of [{ eligible: false }, { category: "teacher" as const, eligible: false }, { profile: false }]) {
    const status = await onboardingStatus(db, await account(options), "puckle") as { welcomePending: boolean };
    assert.equal(!!status.welcomePending, false, JSON.stringify(options));
  }
  const noProfile = await account({ profile: false }); await acknowledgeWelcome(db, noProfile);
  assert.equal(await db.collection("puckleMemberships").findOne({ userId: noProfile }), null, "acknowledging never creates a profile");
});
test("status exposes only the actor, welcome state and the shared approval summary; other sites get no onboarding content", async () => {
  const id = await account({ dob: "2013-02-02", approval: { scopeId: "shared-group-experiences", status: "pending", generation: 1, guardianEmail: "mum@example.invalid", delivery: { status: "failed" }, history: [] } });
  const status = await onboardingStatus(db, id, "puckle") as { actorId: string; approval: { status: string; eligibility: string; guardianEmail: string; delivery: string } };
  assert.deepEqual([status.actorId, status.approval.status, status.approval.eligibility, status.approval.delivery], [id.toHexString(), "pending", "eligible", "failed"]);
  assert.ok(!JSON.stringify(status).includes("mum@") && !JSON.stringify(status).includes("2013"), "masked guardian, no DOB");
  for (const site of ["switchplay", "strat17"]) assert.deepEqual(await onboardingStatus(db, id, site), { actorId: id.toHexString(), show: false });
});
test("age transitions: turning 16 ends the under-16 reminder facts; unknown DOB is not eligible", async () => {
  const sixteen = await onboardingStatus(db, await account({ dob: "2010-01-01" }), "puckle") as { approval: { eligibility: string; canRequest: boolean } };
  assert.deepEqual([sixteen.approval.eligibility, sixteen.approval.canRequest], ["not-required", false]);
  assert.equal((await onboardingStatus(db, await account({}), "puckle") as { approval: { eligibility: string } }).approval.eligibility, "age-unknown");
});
test("status and acknowledgement change nothing else on the account", async () => {
  const id = await account({ dob: "2013-02-02" }), before = JSON.stringify(await db.collection("users").findOne({ _id: id }));
  await onboardingStatus(db, id, "puckle"); await acknowledgeWelcome(db, id);
  assert.equal(JSON.stringify(await db.collection("users").findOne({ _id: id })), before);
});
