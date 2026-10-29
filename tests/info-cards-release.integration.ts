import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test, type TestContext } from "node:test";
import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createInfoCardIndexes, InfoCardRepository } from "../src/lib/infoCards/repository";
import { createInfoUpload, deliverInfoMedia, productionMediaSecurity, signInfoUpload } from "../src/lib/infoCards/media";
import { INFO_MEDIA_COLLECTION } from "../src/lib/infoCards/mediaRegistry";
import type { InfoDraft, InfoMedia } from "../src/lib/infoCards/model";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
const originalSecret = process.env.SESSION_SECRET;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(mongo.getUri()).connect();
  process.env.SESSION_SECRET = "phase5-disposable-release-test-secret";
});
after(async () => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = originalSecret;
  await client?.close(); await mongo?.stop();
});
const database = () => client.db(`switchplay_test_info_release_${sequence++}`);
const collections = ["infoCards", "infoCardVersions", "infoCardSeries", INFO_MEDIA_COLLECTION, "cardTemplates", "cardTemplateVersions"];
const content = (mediaItem: InfoMedia | null = null): InfoDraft => ({ title: "Signs", body: "Keep the sign with the number.", seriesId: "series", mediaItem });
const video = (id: string): InfoMedia => ({ id, provider: "cloudflare-stream", mediaType: "video", assetId: id, src: `https://iframe.videodelivery.net/${id}`, description: "Video" });

function environment(t: TestContext, values: Record<string, string | undefined>) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
}
async function snapshot(db: Db) {
  return Object.fromEntries(await Promise.all(collections.map(async name => [name, await db.collection(name).find().sort({ _id: 1 }).toArray()])));
}
async function indexes(db: Db) {
  return Object.fromEntries(await Promise.all(collections.map(async name => [name, await db.collection(name).listIndexes().toArray()])));
}
async function setupCLI(db: Db) {
  // Supply an explicit disposable local database; no .env file, production URI,
  // provider credentials or application session secret are read by this child.
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, SWITCHPLAY_DATABASE_MODE: "disposable",
    MONGODB_URI: mongo.getUri(), MONGODB_DB: db.databaseName };
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/setup-info-cards.ts"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const timeout = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Disposable index CLI timed out")); }, 30_000);
    child.stdout.on("data", chunk => { output += String(chunk); }); child.stderr.on("data", chunk => { output += String(chunk); });
    child.on("error", error => { clearTimeout(timeout); reject(error); });
    child.on("exit", code => { clearTimeout(timeout); resolve({ code, output }); });
  });
}
async function mediaDraft() {
  const db = database(); await createInfoCardIndexes(db);
  const repo = new InfoCardRepository(db, client, { async assertReady() {} });
  await repo.createSeries("alice", "series", "Basics"); const root = await repo.create("alice", "card");
  const media = video("first-video");
  await repo.save("alice", "card", 0, content(media), "private", await signInfoUpload(root, media));
  return { repo, media };
}

test("release setup CLI is idempotent and preserves existing roots, publications and historical references", async () => {
  const db = database(); for (const name of collections) await db.createCollection(name);
  await db.collection("infoCards").insertOne({ infoCardId: "legacy-info", ownerUserId: "alice", latestVersion: 1, revision: 2, visibility: "public", draft: null });
  await db.collection("infoCardVersions").insertOne({ infoCardId: "legacy-info", version: 1, sourceRevision: 1, content: content() });
  await db.collection("infoCardSeries").insertOne({ seriesId: "series", createdByUserId: "alice", normalisedTitle: "basics", title: "Basics" });
  await db.collection("cardTemplates").insertOne({ cardTemplateId: "main", draft: { infoCardIds: ["legacy-info"] } });
  await db.collection("cardTemplateVersions").insertOne({ cardTemplateId: "main", version: 1, content: { infoCardIds: ["legacy-info"] } });
  const before = await snapshot(db);
  const first = await setupCLI(db); assert.equal(first.code, 0, first.output); assert.match(first.output, /Info Cards indexes ready/);
  await new InfoCardRepository(db, client).assertIndexesReady(true); const firstIndexes = await indexes(db);
  const second = await setupCLI(db); assert.equal(second.code, 0, second.output);
  assert.deepEqual(await indexes(db), firstIndexes); assert.deepEqual(await snapshot(db), before);
});

test("release setup CLI rejects conflicting existing identities without silently repairing or deleting content", async () => {
  const db = database(); await db.collection("infoCards").insertMany([
    { infoCardId: "duplicate", ownerUserId: "alice", draft: { title: "First" } },
    { infoCardId: "duplicate", ownerUserId: "bob", draft: { title: "Second" } },
  ]);
  const before = await db.collection("infoCards").find().toArray();
  const result = await setupCLI(db); assert.notEqual(result.code, 0); assert.match(result.output, /duplicate key|E11000/);
  assert.deepEqual(await db.collection("infoCards").find().toArray(), before);
  await assert.rejects(new InfoCardRepository(db, client).assertIndexesReady(true), { code: "INFO_INDEX_SETUP_REQUIRED" });
});

test("identity readiness rejects sparse, partial and nonunique substitutes and recovers after explicit repair", async () => {
  for (const options of [{ unique: true, sparse: true }, { unique: true, partialFilterExpression: { infoCardId: { $exists: true } } }, {}]) {
    const db = database(); await createInfoCardIndexes(db); const repo = new InfoCardRepository(db, client);
    await db.collection("infoCards").dropIndex("infoCardId_1");
    await db.collection("infoCards").createIndex({ infoCardId: 1 }, options);
    await assert.rejects(repo.assertIndexesReady(), { code: "INFO_INDEX_SETUP_REQUIRED" });
    await db.collection("infoCards").dropIndex("infoCardId_1"); await createInfoCardIndexes(db);
    await repo.assertIndexesReady(true);
  }
});

test("reference readiness rejects partial main-reference indexes before canonical attachment use", async () => {
  for (const [collection, field] of [["cardTemplates", "draft.infoCardIds"], ["cardTemplateVersions", "content.infoCardIds"]]) {
    const db = database(); await createInfoCardIndexes(db); const repo = new InfoCardRepository(db, client);
    await db.collection(collection).dropIndex(`${field}_1`);
    await db.collection(collection).createIndex({ [field]: 1 }, { partialFilterExpression: { [field]: { $exists: true } } });
    await repo.assertIndexesReady();
    await assert.rejects(repo.assertIndexesReady(true), { code: "INFO_INDEX_SETUP_REQUIRED" });
    await db.collection(collection).dropIndex(`${field}_1`); await createInfoCardIndexes(db); await repo.assertIndexesReady(true);
  }
});

test("both provider acknowledgements are required before upload, media publication or delivery can contact providers", async t => {
  environment(t, { NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: undefined, INFO_CARDS_PRIVATE_MEDIA_VERIFIED: undefined });
  const { repo, media } = await mediaDraft();
  const guarded = new InfoCardRepository(repo.db, client, productionMediaSecurity); const before = await repo.owner("alice", "card");
  let calls = 0; t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("Provider must not be contacted"); });
  for (const [protectedFlag, verifiedFlag] of [[undefined, undefined], ["1", undefined], [undefined, "1"], ["0", "1"], ["1", "0"]]) {
    if (protectedFlag === undefined) delete process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA; else process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA = protectedFlag;
    if (verifiedFlag === undefined) delete process.env.INFO_CARDS_PRIVATE_MEDIA_VERIFIED; else process.env.INFO_CARDS_PRIVATE_MEDIA_VERIFIED = verifiedFlag;
    await assert.rejects(createInfoUpload(repo, "alice", "card", "video"), { code: "INFO_MEDIA_PROVIDER_VERIFICATION_REQUIRED" });
    await assert.rejects(guarded.publish("alice", "card", 1), { code: "INFO_MEDIA_PROVIDER_VERIFICATION_REQUIRED" });
    await assert.rejects(deliverInfoMedia(repo, "alice", { kind: "draft", infoCardId: "card", revision: 1 }), { code: "INFO_MEDIA_PROVIDER_VERIFICATION_REQUIRED" });
    assert.equal(calls, 0); assert.deepEqual(await repo.owner("alice", "card"), before);
    assert.equal(await repo.versions().countDocuments(), 0); assert.equal(await repo.db.collection(INFO_MEDIA_COLLECTION).countDocuments(), 0);
  }
  assert.equal((await repo.owner("alice", "card")).draft?.mediaItem?.assetId, media.assetId);
});

test("nested-media reauthorisation stays on the exact public publication after replacement and fails closed on provider refusal", async t => {
  environment(t, { NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: "1", INFO_CARDS_PRIVATE_MEDIA_VERIFIED: "1", CLOUDFLARE_ACCOUNT_ID: "disposable", CLOUDFLARE_STREAM_API_TOKEN: "disposable" });
  const { repo } = await mediaDraft(); await repo.publish("alice", "card", 1); // Private-era publication.
  await repo.save("alice", "card", 2, content(video("first-video")), "public"); await repo.publish("alice", "card", 3);
  const next = video("replacement-video");
  await repo.save("alice", "card", 4, content(next), "public", await signInfoUpload(await repo.owner("alice", "card"), next));
  await repo.publish("alice", "card", 5);
  const requests: string[] = []; let refuse = false;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    requests.push(String(url)); assert.equal(init?.method, "POST"); assert.equal(init?.cache, "no-store");
    const expiry = JSON.parse(String(init?.body)).exp; assert.ok(expiry > Date.now() / 1000 + 3500 && expiry <= Date.now() / 1000 + 3600);
    return refuse ? Response.json({ success: false }, { status: 403 }) : Response.json({ success: true, result: { token: `signed-${requests.length}` } });
  });
  await assert.rejects(deliverInfoMedia(repo, "bob", { kind: "publication", infoCardId: "card", version: 1 }), { code: "INFO_MEDIA_FORBIDDEN" });
  assert.equal(requests.length, 0);
  for (let opening = 0; opening < 2; opening++) {
    const response = await deliverInfoMedia(repo, "bob", { kind: "publication", infoCardId: "card", version: 2 });
    assert.equal(response.headers.get("Cache-Control"), "private, no-store"); assert.equal(response.headers.get("Vary"), "Cookie");
    const grant = await response.json(); assert.equal(grant.assetId, "first-video"); assert.match(grant.manifestUrl, /^https:\/\/videodelivery\.net\/signed-/);
    assert.match(requests.at(-1)!, /\/stream\/first-video\/token$/);
  }
  refuse = true;
  await assert.rejects(deliverInfoMedia(repo, "bob", { kind: "publication", infoCardId: "card", version: 2 }), { code: "STREAM_TOKEN_FAILED" });
  assert.match(requests.at(-1)!, /\/stream\/first-video\/token$/);
  assert.equal((await repo.owner("alice", "card")).latestVersion, 3);
});
