import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { InfoCardRepository, createInfoCardIndexes, InfoCapacityError } from "../src/lib/infoCards/repository";
import { discoverSeries, infoCatalogue, publishedSnapshot, infoEditor } from "../src/lib/infoCards/queries";
import { authorizeInfoMedia, signInfoUpload, productionMediaSecurity, createInfoUpload } from "../src/lib/infoCards/media";
import { assertNotInfoMedia, INFO_MEDIA_COLLECTION } from "../src/lib/infoCards/mediaRegistry";
import { createHmac } from "node:crypto";
import { decodeJwt, SignJWT } from "jose";
import { EMPTY_INFO_DRAFT, type InfoDraft, type InfoMedia } from "../src/lib/infoCards/model";

let server: MongoMemoryReplSet, client: MongoClient, seq = 0;
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(server.getUri()).connect();
  process.env.SESSION_SECRET = "info-cards-disposable-test-secret";
});
after(async () => { await client?.close(); await server?.stop(); });
async function setup() {
  const db = client.db(`switchplay_info_cards_test_${seq++}`); await createInfoCardIndexes(db);
  await db.collection("users").insertMany(["alice", "bob", "carol"].map(id => ({ _id: id, username: `${id}-name` })) as never);
  return new InfoCardRepository(db, client, { async assertReady() {} });
}
const content = (seriesId = "s", title = "Signs"): InfoDraft => ({ title, body: "Keep the sign with its number.\n\nUse brackets to make it clear.", seriesId, mediaItem: null });
async function draft(repo: InfoCardRepository, id = "a", owner = "alice", intent: "public" | "private" = "private", seriesId = "s") {
  await repo.createSeries(owner, seriesId, "Basics"); await repo.create(owner, id);
  return repo.save(owner, id, 0, content(seriesId), intent);
}
async function publish(repo: InfoCardRepository, id = "a", owner = "alice", intent: "public" | "private" = "public", seriesId = "s") {
  await draft(repo, id, owner, intent, seriesId); return repo.publish(owner, id, 1);
}

test("stable empty creation is recoverable without decks; foreign IDs and mutated retries fail", async () => {
  const repo = await setup();
  const [a, b] = await Promise.all([repo.create("alice", "a"), repo.create("alice", "a")]);
  assert.equal(a.infoCardId, b.infoCardId); assert.equal(await repo.roots().countDocuments(), 1);
  assert.deepEqual(a.draft, EMPTY_INFO_DRAFT); assert.equal((await repo.drafts("alice")).items.length, 1);
  assert.equal((await repo.drafts("bob")).items.length, 0);
  await assert.rejects(repo.create("bob", "a"), { code: "INFO_CREATE_RECOVERY_CONFLICT" });
  await repo.save("alice", "a", 0, { ...EMPTY_INFO_DRAFT, body: "unfinished" }, "private");
  await assert.rejects(repo.create("alice", "a"), { code: "INFO_CREATE_RECOVERY_CONFLICT" });
  await assert.rejects(repo.publish("alice", "a", 1), { code: "INFO_PUBLICATION_INCOMPLETE" });
  assert.equal((await repo.drafts("alice")).items.length, 1);
});

test("series uniqueness is per creator, normalised and concurrency safe", async () => {
  const repo = await setup();
  const [a, b] = await Promise.all([repo.createSeries("alice", "s1", "  What  You Need "), repo.createSeries("alice", "s2", "WHAT YOU NEED")]);
  assert.equal(a.seriesId, b.seriesId); assert.equal(await repo.series().countDocuments(), 1);
  const c = await repo.createSeries("bob", "s3", "What You Need"); assert.notEqual(c.seriesId, a.seriesId);
  await assert.rejects(repo.createSeries("bob", a.seriesId, "Other"), { code: "SERIES_ID_CONFLICT" });
  assert.equal((await discoverSeries(repo, "carol")).items.length, 0);
  assert.equal((await discoverSeries(repo, "alice")).items.length, 1);
});

test("save CAS, lost-response recovery, owner-only access and clean reversion", async () => {
  const repo = await setup(); await publish(repo);
  for (const id of ["a", "absent"]) await assert.rejects(repo.owner("bob", id), { code: "INFO_FORBIDDEN" });
  await assert.rejects(repo.save("bob", "a", 2, content(), "public"), { code: "INFO_FORBIDDEN" });
  const changed = content("s", "Brackets");
  const results = await Promise.allSettled([repo.save("alice", "a", 2, changed, "public"), repo.save("alice", "a", 2, content("s", "Other"), "public")]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const root = await repo.owner("alice", "a");
  const retry = await repo.save("alice", "a", 2, root.draft!, "public"); assert.equal(retry.revision, 3);
  assert.equal((await repo.drafts("alice")).items.length, 1);
  await repo.save("alice", "a", 3, content(), "public");
  assert.equal((await repo.drafts("alice")).items.length, 0);
  await assert.rejects(repo.publish("alice", "a", 4), { code: "INFO_PUBLICATION_INCOMPLETE" });
});

test("atomic publication retries return the same immutable receipt even after later edits", async () => {
  const repo = await setup(); await draft(repo, "a", "alice", "public");
  const [first, retry] = await Promise.all([repo.publish("alice", "a", 1), repo.publish("alice", "a", 1)]);
  assert.deepEqual(first, retry); assert.equal(await repo.versions().countDocuments(), 1);
  assert.equal((await repo.owner("alice", "a")).draft, null);
  await repo.save("alice", "a", 2, content("s", "New"), "public");
  assert.deepEqual(await repo.publish("alice", "a", 1), first);
  assert.equal((await repo.owner("alice", "a")).draft?.title, "New");
  await repo.publish("alice", "a", 3);
  assert.deepEqual(await repo.publish("alice", "a", 1), first);
  assert.equal(await repo.versions().countDocuments(), 2);
  assert.equal(await repo.db.collection("cardTemplates").countDocuments(), 0);
  assert.equal(await repo.db.collection("deckTemplates").countDocuments(), 0);
  assert.equal((await repo.db.collection("users").findOne({ username: "alice-name" }))?.cardsData, undefined);
});

test("publication and deletion roll back all writes when a transaction fails", async () => {
  const repo = await setup(); await draft(repo, "a", "alice", "public");
  const transaction = repo.transaction.bind(repo);
  repo.transaction = run => transaction(async session => { await run(session); throw new Error("injected failure after writes"); });
  await assert.rejects(repo.publish("alice", "a", 1), /injected failure/);
  assert.equal(await repo.versions().countDocuments(), 0); assert.equal((await repo.owner("alice", "a")).revision, 1);
  repo.transaction = transaction; await repo.publish("alice", "a", 1);
  repo.transaction = run => transaction(async session => { await run(session); throw new Error("injected failure after writes"); });
  await assert.rejects(repo.delete("alice", "a", 2), /injected failure/);
  repo.transaction = transaction;
  assert.equal(await repo.versions().countDocuments(), 1); assert.equal((await repo.owner("alice", "a")).referenceRevision, 0);
});

test("capacity failures preserve drafts and public intent does not expose content", async () => {
  const repo = await setup(); await draft(repo, "a", "alice", "public");
  await repo.save("alice", "a", 1, { ...content(), body: "A long explanation. ".repeat(100) }, "public");
  await assert.rejects(repo.publish("alice", "a", 2), (error: unknown) => error instanceof InfoCapacityError && !error.capacity.fits);
  assert.equal((await repo.owner("alice", "a")).latestVersion, 0);
  assert.equal((await infoCatalogue(repo, "bob")).items.length, 0);
  assert.equal((await discoverSeries(repo, "bob")).items.length, 0);
});

test("catalogue uses published content, owner-private access, attribution and literal bounded search", async () => {
  const repo = await setup(); await publish(repo); await publish(repo, "private", "bob", "private", "bob-s");
  await repo.save("alice", "a", 2, content("s", "SECRET DRAFT"), "public");
  const alice = await infoCatalogue(repo, "alice"); assert.equal(alice.items.length, 1); assert.equal(alice.items[0].content.title, "Signs");
  assert.equal(alice.items[0].series.creatorUsername, "alice-name");
  assert.equal((await infoCatalogue(repo, "bob")).items.length, 2);
  await assert.rejects(publishedSnapshot(repo, "alice", ["private"]), { code: "INFO_PUBLICATION_FORBIDDEN" });
  assert.equal((await publishedSnapshot(repo, "bob", ["private"]))[0].infoCardId, "private");
  assert.equal((await infoCatalogue(repo, "carol", { search: "SECRET" })).items.length, 0);
  assert.equal((await infoCatalogue(repo, "carol", { search: "bob-name" })).items.length, 0);
  assert.equal((await infoCatalogue(repo, "carol", { search: "alice-name" })).items.length, 1);
  assert.equal((await infoCatalogue(repo, "carol", { search: ".*" })).items.length, 0);
  await assert.rejects(infoCatalogue(repo, "carol", { limit: 1000 }), { code: "INVALID_INFO_QUERY" });
  const page = await infoCatalogue(repo, "bob", { limit: 1 }); assert.equal(page.nextOffset, 1);
  const next = await infoCatalogue(repo, "bob", { limit: 1, offset: 1 }); assert.equal(next.nextOffset, null);
  assert.notEqual(next.items[0].infoCardId, page.items[0].infoCardId);
  assert.equal(JSON.stringify(alice).includes("sourceRevision"), false);
});

test("collaboration preserves ownership; discovery uses current public membership only", async () => {
  const repo = await setup(); await publish(repo);
  await repo.create("bob", "b"); await repo.save("bob", "b", 0, content(), "private"); await repo.publish("bob", "b", 1);
  await assert.rejects(repo.save("alice", "b", 2, content(), "public"), { code: "INFO_FORBIDDEN" });
  await repo.createSeries("alice", "other", "Other");
  await repo.save("alice", "a", 2, content("other"), "public"); await repo.publish("alice", "a", 3);
  assert.equal((await discoverSeries(repo, "carol")).items.some(s => s.seriesId === "s"), false);
  assert.equal((await discoverSeries(repo, "bob")).items.some(s => s.seriesId === "s"), false);
  // Existing contributor's authorised card retains its label/selection.
  await repo.save("bob", "b", 2, content("s", "Brackets"), "private"); await repo.publish("bob", "b", 3);
  assert.equal((await publishedSnapshot(repo, "bob", ["b"]))[0].series.title, "Basics");
  assert.equal((await infoEditor(repo, "bob", "b")).selectedSeries?.creatorUsername, "alice-name");
  await repo.create("carol", "c");
  await assert.rejects(repo.save("carol", "c", 0, content(), "private"), { code: "SERIES_FORBIDDEN" });
  await repo.delete("alice", "a", 4);
  assert.equal((await discoverSeries(repo, "carol")).items.length, 0);
});

test("catalogue orders own cards then other public cards by latest publication across page boundaries", async () => {
  const repo = await setup();
  // Deliberately disagree with root creation/update times and interleave owners.
  const fixtures = [
    { id: "foreign-new", owner: "bob", time: 9, visibility: "public" },
    { id: "own-old", owner: "alice", time: 1, visibility: "public" },
    { id: "foreign-old", owner: "carol", time: 2, visibility: "public" },
    { id: "own-new", owner: "alice", time: 5, visibility: "private" },
    { id: "hidden", owner: "bob", time: 10, visibility: "private" },
    { id: "own-tie", owner: "alice", time: 5, visibility: "public" },
  ] as const;
  for (const item of fixtures) {
    await publish(repo, item.id, item.owner, item.visibility, `series-${item.owner}`);
    await repo.roots().updateOne({ infoCardId: item.id }, { $set: { createdAt: new Date(2026, 0, 20 - item.time) } });
    await repo.versions().updateOne({ infoCardId: item.id, version: 1 }, { $set: { publishedAt: new Date(2026, 0, item.time) } });
  }
  const before = await infoCatalogue(repo, "alice");
  assert.deepEqual(before.items.map(item => item.infoCardId), ["own-new", "own-tie", "own-old", "foreign-new", "foreign-old"]);
  await repo.save("alice", "own-old", 2, content("series-alice", "Republished"), "public");
  assert.deepEqual(await infoCatalogue(repo, "alice"), before); // Draft saves never promote.
  await repo.publish("alice", "own-old", 3);
  const ids: string[] = []; let offset: number | null = 0;
  do {
    const result = await infoCatalogue(repo, "alice", { limit: 2, offset });
    ids.push(...result.items.map(item => item.infoCardId)); offset = result.nextOffset;
  } while (offset !== null);
  assert.deepEqual(ids, ["own-old", "own-new", "own-tie", "foreign-new", "foreign-old"]);
});

test("public visibility is permanent, but unreferenced public deletion is permitted", async () => {
  const repo = await setup(); await publish(repo);
  await assert.rejects(repo.save("alice", "a", 2, content(), "private"), { code: "PUBLIC_VISIBILITY_PERMANENT" });
  await assert.rejects(repo.delete("bob", "a", 2), { code: "INFO_FORBIDDEN" });
  await assert.rejects(repo.delete("alice", "a", 0), { code: "STALE_INFO_REVISION" });
  await repo.delete("alice", "a", 2);
  assert.equal(await repo.roots().countDocuments({ deletedAt: { $exists: false } }), 0); assert.equal(await repo.versions().countDocuments(), 0);
  assert.deepEqual(await repo.delete("alice", "a", 2), { deleted: true });
  await assert.rejects(repo.create("alice", "a"), { code: "INFO_CREATE_RECOVERY_CONFLICT" });
  await assert.rejects(repo.create("bob", "a"), { code: "INFO_CREATE_RECOVERY_CONFLICT" });
  await assert.rejects(repo.owner("alice", "a"), { code: "INFO_FORBIDDEN" });
  assert.equal((await repo.roots().findOne({ infoCardId: "a" }))!.draft, null);
  assert.equal(await repo.series().countDocuments(), 1);
});

test("ordered snapshots pin content while subsequent openings see new publications", async () => {
  const repo = await setup(); await publish(repo); await publish(repo, "b", "bob", "public", "bs");
  const first = await publishedSnapshot(repo, "carol", ["b", "a"]);
  assert.deepEqual(first.map(c => c.infoCardId), ["b", "a"]);
  await repo.save("alice", "a", 2, content("s", "Updated"), "public"); await repo.publish("alice", "a", 3);
  assert.equal(first[1].version, 1); assert.equal(first[1].content.title, "Signs");
  assert.equal((await publishedSnapshot(repo, "carol", ["a"]))[0].version, 2);
  assert.deepEqual(await publishedSnapshot(repo, "carol", []), []);
  await assert.rejects(publishedSnapshot(repo, "carol", ["a", "missing"]), { code: "INFO_PUBLICATION_FORBIDDEN" });
  await assert.rejects(publishedSnapshot(repo, "carol", ["a", "a"]), { code: "DUPLICATE_INFO_REFERENCE" });
});

test("reference guards require publication/access and reject private attachments on public mains", async () => {
  const repo = await setup(); await publish(repo, "a", "alice", "private");
  const write = async () => true;
  await assert.rejects(repo.withReferences("bob", ["a"], "private", write), { code: "INFO_REFERENCE_FORBIDDEN" });
  await assert.rejects(repo.withReferences("alice", ["a"], "public", write), { code: "PRIVATE_INFO_BLOCKS_PUBLICATION" });
  await repo.create("alice", "empty");
  await assert.rejects(repo.withReferences("alice", ["empty"], "private", write), { code: "INFO_REFERENCE_FORBIDDEN" });
  await repo.withReferences("alice", ["a"], "private", write);
  assert.equal((await repo.owner("alice", "a")).revision, 2);
  assert.equal((await repo.owner("alice", "a")).referenceRevision, 1);
});

test("detached drafts and every historical reference block deletion with no private metadata", async () => {
  const repo = await setup(); await publish(repo);
  await repo.withReferences("bob", ["a"], "private", async (session, ids) => {
    await repo.db.collection("cardTemplates").insertOne({ cardTemplateId: "detached", ownerUserId: "bob", draft: { infoCardIds: ids, title: "SECRET" } }, { session });
  });
  await assert.rejects(repo.delete("alice", "a", 2), (e: unknown) => {
    assert.equal(JSON.stringify(e).includes("SECRET"), false);
    return (e as { blockers?: { draft: boolean } }).blockers?.draft === true;
  });
  await repo.db.collection("cardTemplates").deleteMany({});
  await repo.withReferences("bob", ["a"], "private", async (session, ids) => {
    await repo.db.collection("cardTemplateVersions").insertMany([{ cardTemplateId: "main", version: 1, content: { infoCardIds: ids } },
      { cardTemplateId: "main", version: 2, content: {} }], { session });
  });
  await assert.rejects(repo.delete("alice", "a", 2), (e: unknown) => (e as { blockers?: { historical: boolean } }).blockers?.historical === true);
});

test("attach/delete race serialises through the info guard: attach wins", async () => {
  const repo = await setup(); await publish(repo);
  let release!: () => void, locked!: () => void;
  const gate = new Promise<void>(r => { release = r; }), entered = new Promise<void>(r => { locked = r; });
  const attach = repo.withReferences("bob", ["a"], "public", async (session, ids) => {
    locked(); await gate;
    await repo.db.collection("cardTemplates").insertOne({ cardTemplateId: "main", draft: { infoCardIds: ids } }, { session });
  });
  await entered;
  const deletion = repo.delete("alice", "a", 2);
  release(); await attach;
  await assert.rejects(deletion, { code: "INFO_REFERENCED_CONFLICT" });
  assert.equal(await repo.roots().countDocuments(), 1);
});

test("delete wins before an attachment retries: no dangling reference", async () => {
  const repo = await setup(); await publish(repo);
  let release!: () => void, locked!: () => void;
  const gate = new Promise<void>(r => { release = r; }), entered = new Promise<void>(r => { locked = r; });
  const original = repo.transaction.bind(repo);
  // Hold the deletion transaction after its writes and before commit.
  const deletingRepo = new InfoCardRepository(repo.db, repo.client);
  deletingRepo.transaction = run => original(async session => { const result = await run(session); locked(); await gate; return result; });
  const deletion = deletingRepo.delete("alice", "a", 2); await entered;
  const attach = repo.withReferences("bob", ["a"], "public", async (session, ids) => {
    await repo.db.collection("cardTemplates").insertOne({ draft: { infoCardIds: ids } }, { session });
  });
  release(); await deletion;
  await assert.rejects(attach, { code: "INFO_REFERENCE_FORBIDDEN" });
  assert.equal(await repo.db.collection("cardTemplates").countDocuments(), 0);
});

test("publication/delete concurrency never leaves an orphan publication", async () => {
  const repo = await setup(); await draft(repo, "a", "alice", "public");
  const results = await Promise.allSettled([repo.publish("alice", "a", 1), repo.delete("alice", "a", 1)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const root = await repo.roots().findOne({ infoCardId: "a", deletedAt: { $exists: false } });
  assert.equal(await repo.versions().countDocuments(), root ? 1 : 0);
});

const image: InfoMedia = { id: "image", mediaType: "image", provider: "cloudflare-r2", assetId: "info-cards/alice/a/image.png", src: "https://private.invalid/info-cards/alice/a/image.png", description: "Image" };
test("media requires target/owner/asset provenance, exact draft revision and immutable visibility", async () => {
  const repo = await setup(); await draft(repo);
  const root = await repo.owner("alice", "a"), proof = await signInfoUpload(root, image);
  await assert.rejects(repo.save("alice", "a", 1, { ...content(), mediaItem: image }, "private"), { code: "INFO_MEDIA_FORBIDDEN" });
  await repo.save("alice", "a", 1, { ...content(), mediaItem: image }, "private", proof);
  assert.deepEqual(await authorizeInfoMedia(repo, "alice", { kind: "draft", infoCardId: "a", revision: 2 }), image);
  await assert.rejects(authorizeInfoMedia(repo, "bob", { kind: "draft", infoCardId: "a", revision: 2 }), { code: "INFO_MEDIA_FORBIDDEN" });
  await assert.rejects(authorizeInfoMedia(repo, "alice", { kind: "draft", infoCardId: "a", revision: 1 }), { code: "INFO_MEDIA_FORBIDDEN" });
  await repo.publish("alice", "a", 2);
  await repo.save("alice", "a", 3, { ...content(), mediaItem: image }, "public"); await repo.publish("alice", "a", 4);
  await assert.rejects(authorizeInfoMedia(repo, "bob", { kind: "publication", infoCardId: "a", version: 1 }), { code: "INFO_MEDIA_FORBIDDEN" });
  assert.deepEqual(await authorizeInfoMedia(repo, "bob", { kind: "publication", infoCardId: "a", version: 2 }), image);
  await repo.save("alice", "a", 5, content(), "public"); await repo.publish("alice", "a", 6);
  assert.deepEqual(await authorizeInfoMedia(repo, "bob", { kind: "publication", infoCardId: "a", version: 2 }), image);
  await assert.rejects(authorizeInfoMedia(repo, "bob", { kind: "publication", infoCardId: "a", version: 3 }), { code: "INFO_MEDIA_FORBIDDEN" });
});

test("upload proofs cannot be transplanted, changed or forged", async () => {
  const repo = await setup(); await draft(repo); await draft(repo, "b", "bob", "private", "bs");
  const proof = await signInfoUpload(await repo.owner("alice", "a"), image);
  await assert.rejects(repo.save("bob", "b", 1, { ...content("bs"), mediaItem: image }, "private", proof), { code: "INFO_MEDIA_FORBIDDEN" });
  await assert.rejects(repo.save("alice", "a", 1, { ...content(), mediaItem: { ...image, src: "https://evil.invalid/a.png" } }, "private", proof), { code: "INFO_MEDIA_FORBIDDEN" });
  await assert.rejects(repo.save("alice", "a", 1, { ...content(), mediaItem: image }, "private", `${proof}x`), { code: "INFO_MEDIA_FORBIDDEN" });
});

test("unverified providers fail closed; readiness failure never publishes or loses draft", async () => {
  const repo = await setup(); await draft(repo);
  const root = await repo.owner("alice", "a");
  await repo.save("alice", "a", 1, { ...content(), mediaItem: image }, "private", await signInfoUpload(root, image));
  const guarded = new InfoCardRepository(repo.db, repo.client, productionMediaSecurity);
  const saved = process.env.INFO_CARDS_PRIVATE_MEDIA_VERIFIED; delete process.env.INFO_CARDS_PRIVATE_MEDIA_VERIFIED;
  try { await assert.rejects(guarded.publish("alice", "a", 2), { code: "INFO_MEDIA_PROVIDER_VERIFICATION_REQUIRED" }); }
  finally { if (saved !== undefined) process.env.INFO_CARDS_PRIVATE_MEDIA_VERIFIED = saved; }
  assert.equal(await repo.versions().countDocuments(), 0); assert.equal((await repo.owner("alice", "a")).revision, 2);
});

test("index prerequisite fails closed and can recover after explicit setup", async () => {
  const repo = new InfoCardRepository(client.db(`switchplay_info_cards_test_${seq++}`), client);
  await assert.rejects(repo.assertIndexesReady(), { code: "INFO_INDEX_SETUP_REQUIRED" });
  await createInfoCardIndexes(repo.db); await repo.assertIndexesReady();
});

test("caller-supplied transaction keeps a consultation snapshot consistent across publications", async () => {
  const repo = await setup(); await publish(repo);
  await repo.transaction(async session => {
    const first = await publishedSnapshot(repo, "bob", ["a"], session);
    await repo.save("alice", "a", 2, content("s", "New"), "public"); await repo.publish("alice", "a", 3);
    const second = await publishedSnapshot(repo, "bob", ["a"], session);
    assert.deepEqual(second, first);
  });
  assert.equal((await publishedSnapshot(repo, "bob", ["a"]))[0].version, 2);
});

test("guarded reference write rollback leaves no partial main record or guard change", async () => {
  const repo = await setup(); await publish(repo);
  await assert.rejects(repo.withReferences("bob", ["a"], "public", async (session, ids) => {
    await repo.db.collection("cardTemplates").insertOne({ draft: { infoCardIds: ids } }, { session });
    throw new Error("rollback attachment");
  }), /rollback attachment/);
  assert.equal(await repo.db.collection("cardTemplates").countDocuments(), 0);
  assert.equal((await repo.owner("alice", "a")).referenceRevision, 0);
});

test("a late provider check cannot publish a concurrently replaced draft", async () => {
  const repo = await setup(); await draft(repo);
  const root = await repo.owner("alice", "a");
  await repo.save("alice", "a", 1, { ...content(), mediaItem: image }, "private", await signInfoUpload(root, image));
  let release!: () => void, reached!: () => void;
  const gate = new Promise<void>(r => { release = r; }), entered = new Promise<void>(r => { reached = r; });
  const guarded = new InfoCardRepository(repo.db, repo.client, { async assertReady() { reached(); await gate; } });
  const publication = guarded.publish("alice", "a", 2); await entered;
  await repo.save("alice", "a", 2, content("s", "Replaced"), "private"); release();
  await assert.rejects(publication, { code: "STALE_INFO_REVISION" });
  assert.equal(await repo.versions().countDocuments(), 0); assert.equal((await repo.owner("alice", "a")).draft?.title, "Replaced");
});

test("allocated video provenance is durable, scopes proof and blocks legacy routes even after deletion", async t => {
  const repo = await setup(); await draft(repo);
  const config = { NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: "1", INFO_CARDS_PRIVATE_MEDIA_VERIFIED: "1", CLOUDFLARE_ACCOUNT_ID: "fixture",
    CLOUDFLARE_STREAM_API_TOKEN: "fixture", CLOUDFLARE_STREAM_CUSTOMER_CODE: "fixture" };
  const previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]])); Object.assign(process.env, config);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    assert.equal(JSON.parse(String(options.body)).requireSignedURLs, true);
    return Response.json({ success: true, result: { uid: "allocated-video", uploadURL: "https://upload.invalid/only-fixture" } });
  });
  const upload = await createInfoUpload(repo, "alice", "a", "video");
  assert.equal(await repo.db.collection(INFO_MEDIA_COLLECTION).countDocuments(), 1);
  await repo.save("alice", "a", 1, { ...content(), mediaItem: upload.media }, "private", upload.proof);
  await repo.publish("alice", "a", 2);
  assert.equal((await authorizeInfoMedia(repo, "alice", { kind: "publication", infoCardId: "a", version: 1 })).assetId, "allocated-video");
  await assert.rejects(assertNotInfoMedia(repo.db, "stream", "allocated-video"), { code: "MEDIA_FORBIDDEN" });
  await assert.rejects(assertNotInfoMedia(repo.db, "stream", "allocated-video\n"), { code: "MEDIA_FORBIDDEN" });
  await repo.db.collection(INFO_MEDIA_COLLECTION).insertOne({ provider: "cloudflare-stream", assetId: "abcdef0123456789abcdef0123456789", src: "fixture", infoCardId: "a", ownerUserId: "alice" });
  await assert.rejects(assertNotInfoMedia(repo.db, "stream", "ABCDEF0123456789ABCDEF0123456789"), { code: "MEDIA_FORBIDDEN" });
  await repo.delete("alice", "a", 3);
  await assert.rejects(authorizeInfoMedia(repo, "alice", { kind: "publication", infoCardId: "a", version: 1 }), { code: "INFO_MEDIA_FORBIDDEN" });
  await assert.rejects(assertNotInfoMedia(repo.db, "stream", "allocated-video"), { code: "MEDIA_FORBIDDEN" });
});

test("expired upload proofs fail but a successful saved attachment remains recoverable", async () => {
  const repo = await setup(); await draft(repo); const root = await repo.owner("alice", "a");
  const proof = await signInfoUpload(root, image), payload = decodeJwt(proof);
  const secret = createHmac("sha256", process.env.SESSION_SECRET!).update("switchplay:info-card-upload:v1").digest();
  const expired = await new SignJWT({ ...payload, exp: 1 }).setProtectedHeader({ alg: "HS256" }).sign(secret);
  await assert.rejects(repo.save("alice", "a", 1, { ...content(), mediaItem: image }, "private", expired), { code: "INFO_MEDIA_FORBIDDEN" });
  await repo.save("alice", "a", 1, { ...content(), mediaItem: image }, "private", proof);
  assert.equal((await repo.save("alice", "a", 1, { ...content(), mediaItem: image }, "private", expired)).revision, 2);
});

test("series selector orders own series first and filters hidden names before pagination", async () => {
  const repo = await setup(); await publish(repo, "a", "alice", "public");
  await repo.createSeries("bob", "own", "Zulu"); await repo.createSeries("carol", "hidden", "AAA Secret");
  const result = await discoverSeries(repo, "bob", { limit: 1 });
  assert.equal(result.items[0].seriesId, "own"); assert.equal(result.nextOffset, 1);
  const next = await discoverSeries(repo, "bob", { offset: 1, limit: 1 });
  assert.equal(next.items[0].seriesId, "s"); assert.equal(next.nextOffset, null);
  assert.equal(JSON.stringify(result).includes("Secret"), false);
  assert.deepEqual((await discoverSeries(repo, "bob", { search: "Secret" })).items, []);
});

test("maths publication requires trusted measurement, preserves exact source and bypasses only the old body estimator", async () => {
  const repo = await setup(); await draft(repo);
  const source = String.raw`General rule:
$$\boldsymbol{\frac{a}{\frac{b}{c}}=\frac{ac}{b}}$$`;
  await repo.save("alice", "a", 1, { ...content(), body: source, bodyFormat: "latex-v1" }, "public");
  await assert.rejects(repo.publish("alice", "a", 2), { code: "INFO_MATHS_UNAVAILABLE" });
  let calls = 0;
  const validate: import("../src/lib/infoCards/mathsValidation").InfoMathsValidator = async saved => {
    calls++; assert.equal(saved.body, source); return { result: { status: "ready", fits: true, generation: 1, diagnostics: [], layout: { available: { width: 214, height: 157 }, bounds: { left: 0, top: 0, right: 100, bottom: 90 }, width: 100, height: 90, overflowX: false, overflowY: false, excess: { left: 0, right: 0, top: 0, bottom: 0 } } }, safe: true, headerFits: true };
  };
  const publication = await repo.publish("alice", "a", 2, validate);
  assert.equal(publication.content.body, source); assert.deepEqual(publication.mathsValidation, { version: 1 });
  await repo.publish("alice", "a", 2, validate); assert.equal(calls, 1);
  assert.equal((await publishedSnapshot(repo, "alice", ["a"]))[0].content.bodyFormat, "latex-v1");
  assert.equal((await infoCatalogue(repo, "alice")).items[0].content.body, source);
  await assert.rejects(repo.save("alice", "a", 3, content(), "public"), { code: "INFO_FORMAT_CONFLICT" });
});

test("maths measurement outside a transaction cannot publish a concurrently replaced revision", async () => {
  const repo = await setup(); await draft(repo);
  await repo.save("alice", "a", 1, { ...content(), bodyFormat: "latex-v1" }, "public");
  await assert.rejects(repo.publish("alice", "a", 2, async () => {
    await repo.save("alice", "a", 2, { ...content(), body: "$y$", bodyFormat: "latex-v1" }, "public");
    return { result: { status: "ready", fits: true, generation: 1, diagnostics: [], layout: { available: { width: 214, height: 157 }, bounds: { left: 0, top: 0, right: 10, bottom: 10 }, width: 10, height: 10, overflowX: false, overflowY: false, excess: { left: 0, right: 0, top: 0, bottom: 0 } } }, safe: true, headerFits: true };
  }), { code: "STALE_INFO_REVISION" });
  assert.equal(await repo.versions().countDocuments(), 0); assert.equal((await repo.owner("alice", "a")).draft?.body, "$y$");
});
