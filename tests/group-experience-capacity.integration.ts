import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { cpus, platform, arch } from "node:os";
import { groupFixture, signal } from "./helpers/groupExperiences";

let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
const percentile = (samples: number[], fraction: number) => [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * fraction) - 1];
test("20 by 12 summary and concurrent writes meet local repository budgets with indexed roster access", async () => {
  const f = await groupFixture(client, { cardCount: 12, followers: [] });
  const followers = Array.from({ length: 20 }, (_, i) => `f${String(i).padStart(2, "0")}`);
  await f.cards.users().insertMany(followers.map(_id => ({ _id, cardsData: [], decksData: [] })));
  const group = await f.repo.create("alice", { ...f.command, operationId: "capacity", adminIds: ["bob", "carol"], followerIds: followers });
  const times: number[] = [], attempts: number[] = [];
  const transaction = f.cards.transaction.bind(f.cards);
  f.cards.transaction = async run => { let count = 0; try { return await transaction(session => { count++; return run(session); }); } finally { attempts.push(count); } };
  await Promise.all(followers.map(async actor => {
    for (let i = 0; i < 10; i++) {
      const start = performance.now(); await f.repo.writeLearning(actor, group.experienceId, f.ids[0], "personal", signal("a0", i + 1)); times.push(performance.now() - start);
    }
  }));
  for (const actor of followers) {
    const cards = (await f.cards.getPersonalUser(actor))!.cardsData;
    assert.equal(cards.length, 1); assert.equal(cards[0].signalReadings[0].reading, 10); assert.equal(cards[0].targetDate, null);
  }
  const summary = await f.repo.summary("alice", group.experienceId);
  assert.equal(summary.followers.total, 20); assert.equal(summary.followers.confidence, 10);
  const bytes = Buffer.byteLength(JSON.stringify(summary)); assert.ok(bytes <= 250_000);
  const batch = await f.repo.perspectives("alice", group.experienceId, f.ids[0]); assert.ok(Buffer.byteLength(JSON.stringify(batch)) <= 100_000);
  for (let i = 0; i < 5; i++) await f.repo.summary("alice", group.experienceId);
  const reads: number[] = []; for (let i = 0; i < 100; i++) { const start = performance.now(); await f.repo.summary("alice", group.experienceId); reads.push(performance.now() - start); }
  assert.ok(percentile(reads, .95) <= 300, `summary p95 ${percentile(reads, .95)}ms`);
  assert.ok(percentile(times, .95) <= 500, `write p95 ${percentile(times, .95)}ms`);
  const explain = await f.repo.members().find({ experienceId: group.experienceId, followerStatus: "active" }).sort({ userId: 1 }).explain("queryPlanner");
  assert.ok(JSON.stringify(explain.queryPlanner.winningPlan).includes("group_roster"));
  console.log(JSON.stringify({ fixture: "20 followers, 3 admins, 12 Cards", node: process.version, platform: platform(), architecture: arch(), cpu: cpus()[0]?.model,
    warmupReads: 5, sampleReads: reads.length, summaryBytes: bytes, summaryP95Ms: percentile(reads, .95), writes: times.length,
    writeP95Ms: percentile(times, .95), transactionMaxAttempts: Math.max(...attempts), retriedTransactions: attempts.filter(n => n > 1).length }));
});
test("40 by 24 supports a second roster/perspective page without a product membership cap", async () => {
  const f = await groupFixture(client, { cardCount: 24, followers: [] });
  const followers = Array.from({ length: 40 }, (_, i) => `p${String(i).padStart(2, "0")}`);
  await f.cards.users().insertMany(followers.map(_id => ({ _id, cardsData: [], decksData: [] })));
  const group = await f.repo.create("alice", { ...f.command, operationId: "paging", followerIds: followers });
  const first = await f.repo.perspectives("alice", group.experienceId, f.ids[0]), second = await f.repo.perspectives("alice", group.experienceId, f.ids[0], first.nextCursor!);
  assert.equal(first.followers.length, 30); assert.equal(second.followers.length, 10); assert.equal(second.nextCursor, null);
  const summary = await f.repo.summary("alice", group.experienceId); assert.equal(summary.cards.length, 24); assert.equal(summary.followers.total, 40);
});
