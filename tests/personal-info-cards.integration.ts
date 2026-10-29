import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../src/lib/cards/forks";
import { workingDTO } from "../src/lib/cards/readModels";
import { InfoCardRepository, createInfoCardIndexes } from "../src/lib/infoCards/repository";
import { discoverSeries, infoCatalogue, mainInfoConsultation, publishedSnapshot } from "../src/lib/infoCards/queries";
import { authorizeInfoMedia, signInfoUpload } from "../src/lib/infoCards/media";
import { withInfoAttachmentDates } from "../src/lib/infoCards/attachmentDates";
import type { InfoDraft, PersonalInfoContext } from "../src/lib/infoCards/model";

let mongo: MongoMemoryReplSet, client: MongoClient, seq = 0;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(mongo.getUri()).connect();
  process.env.SESSION_SECRET = "personal-info-disposable-test-only";
});
after(async () => { await client?.close(); await mongo?.stop(); });
const body = (title = "Note"): InfoDraft => ({ title, body: "Keep the sign with its number.", seriesId: "personal-series", mediaItem: null });
async function setup() {
  const db = client.db(`switchplay_test_personal_info_${seq++}`);
  const main = new CardRepository(db, client), info = new InfoCardRepository(db, client, { async assertReady() {} });
  await createFoundationIndexes(db); await createInfoCardIndexes(db);
  await main.users().insertMany(["alice", "bob"].map(_id => ({ _id, username: _id, cardsData: [], decksData: [] })));
  await info.createSeries("alice", "personal-series", "Personal basics");
  const content = { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: "Practice", description: null, mediaItem: null } };
  await main.createCardDraft("alice", content, "public", "main"); await main.publishCard("alice", "main", 0);
  const deck = await main.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Practice Deck", cards: [{ cardTemplateId: "main" }] }, "public");
  await main.publishDeck("alice", deck.deckTemplateId, 0);
  await main.ensureDeckData("alice", deck.deckTemplateId, 1); await main.ensureCardData("alice", "main", 1);
  const context: PersonalInfoContext = { deckTemplateId: deck.deckTemplateId, version: 1, personalInfoRevision: 0 };
  return { main, info, context };
}
async function note(info: InfoCardRepository, context: PersonalInfoContext, id = "note", origin = "main") {
  await info.createPersonal("alice", id, origin, context);
  await info.save("alice", id, 0, body(), "private");
  return info.savePersonal("alice", id, 1, context);
}
test("shared dates are server assigned, retained through draft/retry/publication, and forged redating is ignored", async () => {
  const { main, info } = await setup();
  await info.create("alice", "shared"); await info.save("alice", "shared", 0, body(), "public"); await info.publish("alice", "shared", 1);
  const base = (await main.getCardVersion("main", 1))!.content;
  await main.saveCardDraft("alice", "main", 1, { ...base, infoCardIds: ["shared"] });
  const first = (await main.cards().findOne({ cardTemplateId: "main" }))!.draft!;
  assert.ok(first.infoCardAttachedAt?.shared);
  await main.saveCardDraft("alice", "main", 2, { ...first, infoCardAttachedAt: { shared: "2099-01-01T00:00:00.000Z" } });
  assert.deepEqual((await main.cards().findOne({ cardTemplateId: "main" }))!.draft!.infoCardAttachedAt, first.infoCardAttachedAt);
  await main.publishCard("alice", "main", 3);
  assert.deepEqual((await main.getCardVersion("main", 2))!.content.infoCardAttachedAt, first.infoCardAttachedAt);
  assert.deepEqual(withInfoAttachmentDates({ ...base, infoCardIds: ["shared"] }, { ...base, infoCardIds: ["shared"] }).infoCardAttachedAt, undefined);
});
test("first personal Save is private/atomic and later Save/no-op preserves ID, origin and date", async () => {
  const { main, info, context } = await setup(); const first = await note(info, context);
  const source = (await main.getPersonalUser("alice"))!.cardsData[0];
  assert.equal(first.visibility, "private"); assert.deepEqual(source.personalInfoCardIds, ["note"]);
  assert.ok(source.personalInfoCardAttachedAt?.note instanceof Date); assert.equal(source.personalInfoRevision, 1);
  await info.save("alice", "note", 2, body("Edited"), "private"); await info.savePersonal("alice", "note", 3);
  await info.savePersonal("alice", "note", 4);
  const after = (await main.getPersonalUser("alice"))!.cardsData[0];
  assert.deepEqual(after, source); assert.equal(await info.versions().countDocuments({ infoCardId: "note" }), 2);
  assert.equal((await info.owner("alice", "note")).originCardTemplateId, "main");
});
test("removing and re-adding a shared reference creates a new publishable association, not a no-op", async () => {
  const { main, info } = await setup();
  await info.create("alice", "shared"); await info.save("alice", "shared", 0, body(), "public"); await info.publish("alice", "shared", 1);
  const base = (await main.getCardVersion("main", 1))!.content;
  await main.saveCardDraft("alice", "main", 1, { ...base, infoCardIds: ["shared"] }); await main.publishCard("alice", "main", 2);
  const oldDate = "2000-01-01T00:00:00.000Z";
  await main.cardVersions().updateOne({ cardTemplateId: "main", version: 2 }, { $set: { "content.infoCardAttachedAt.shared": oldDate } });
  const previous = (await main.getCardVersion("main", 2))!.content;
  await main.saveCardDraft("alice", "main", 3, { ...base, infoCardIds: [] });
  await main.saveCardDraft("alice", "main", 4, previous);
  const root = (await main.cards().findOne({ cardTemplateId: "main" }))!;
  assert.ok(root.draft); assert.notEqual(root.draft.infoCardAttachedAt?.shared, oldDate);
  await main.publishCard("alice", "main", 5);
  assert.equal((await main.getCardVersion("main", 3))!.content.infoCardAttachedAt?.shared, root.draft.infoCardAttachedAt?.shared);
});
test("permanent purpose prevents generic publish, shared attach, catalogue and public series leakage", async () => {
  const { main, info, context } = await setup(); await note(info, context);
  await assert.rejects(info.publish("alice", "note", 1), { code: "INFO_FORBIDDEN" });
  await assert.rejects(info.save("alice", "note", 2, body(), "public"), { code: "PERSONAL_INFO_PRIVATE_ONLY" });
  await assert.rejects(info.create("alice", "note"), { code: "INFO_CREATE_RECOVERY_CONFLICT" });
  const content = (await main.getCardVersion("main", 1))!.content;
  await assert.rejects(main.saveCardDraft("alice", "main", 1, { ...content, infoCardIds: ["note"] }), { code: "INFO_REFERENCE_FORBIDDEN" });
  await info.roots().updateOne({ infoCardId: "note" }, { $set: { visibility: "public" } });
  await info.versions().updateOne({ infoCardId: "note", version: 1 }, { $set: { visibility: "public" } });
  for (const actor of ["alice", "bob"]) assert.equal((await infoCatalogue(info, actor)).items.length, 0);
  assert.equal((await discoverSeries(info, "bob")).items.length, 0);
  await assert.rejects(publishedSnapshot(info, "bob", ["note"]), { code: "INFO_PUBLICATION_FORBIDDEN" });
});
test("remove retains content and a lost first-Save receipt cannot resurrect or redate it", async () => {
  const { main, info, context } = await setup(); const receipt = await note(info, context);
  await info.removePersonal("alice", "main", "note", 1);
  assert.deepEqual(await info.savePersonal("alice", "note", 1, context), receipt);
  const data = (await main.getPersonalUser("alice"))!.cardsData[0];
  assert.deepEqual(data.personalInfoCardIds, []); assert.deepEqual(data.personalInfoCardAttachedAt, {});
  assert.equal(data.personalInfoRevision, 2); assert.equal((await info.owner("alice", "note")).latestVersion, 1);
  await info.save("alice", "note", 2, body("Removed edit"), "private"); await info.savePersonal("alice", "note", 3);
  assert.deepEqual((await main.getPersonalUser("alice"))!.cardsData[0].personalInfoCardIds, []);
});
test("unfinished My Drafts includes unsaved and dirty attached personal work, excludes clean and removed", async () => {
  const { info, context } = await setup();
  await info.createPersonal("alice", "unfinished", "main", context);
  assert.deepEqual((await info.drafts("alice")).items.map(item => item.infoCardId), ["unfinished"]);
  await note(info, context); assert.equal((await info.drafts("alice")).items.length, 1);
  await info.save("alice", "note", 2, body("Dirty"), "private");
  assert.equal((await info.drafts("alice", 0, 1)).nextOffset, 1);
  await info.removePersonal("alice", "main", "note", 1);
  assert.deepEqual((await info.drafts("alice")).items.map(item => item.infoCardId), ["unfinished"]);
  assert.equal((await info.drafts("bob")).items.length, 0);
});
test("transaction failure after association update rolls back both attachment/date and version", async () => {
  const { main, info, context } = await setup();
  await info.createPersonal("alice", "note", "main", context); await info.save("alice", "note", 0, body(), "private");
  const before = await main.getPersonalUser("alice"), versions = info.versions();
  const original = versions.insertOne; versions.insertOne = async () => { throw Error("injected insert failure"); };
  const factory = info.versions; info.versions = () => versions;
  await assert.rejects(info.savePersonal("alice", "note", 1, context), /injected/);
  versions.insertOne = original; info.versions = factory;
  assert.deepEqual(await main.getPersonalUser("alice"), before);
  assert.equal((await info.owner("alice", "note")).latestVersion, 0);
  assert.equal(await info.versions().countDocuments(), 0);
});
test("concurrent first Saves use list CAS; both drafts survive and explicit retry attaches once", async () => {
  const { main, info, context } = await setup();
  for (const id of ["one", "two"]) { await info.createPersonal("alice", id, "main", context); await info.save("alice", id, 0, body(), "private"); }
  const results = await Promise.allSettled(["one", "two"].map(id => info.savePersonal("alice", id, 1, context)));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const failed = results.findIndex(result => result.status === "rejected");
  await info.savePersonal("alice", ["one", "two"][failed], 1, { ...context, personalInfoRevision: 1 });
  assert.equal((await main.getPersonalUser("alice"))!.cardsData[0].personalInfoCardIds!.length, 2);
});
test("concurrent identical first Saves return one immutable receipt and one association", async () => {
  const { main, info, context } = await setup();
  await info.createPersonal("alice", "note", "main", context); await info.save("alice", "note", 0, body(), "private");
  const results = await Promise.all([info.savePersonal("alice", "note", 1, context), info.savePersonal("alice", "note", 1, context)]);
  assert.deepEqual(results[0], results[1]); assert.equal(await info.versions().countDocuments({ infoCardId: "note" }), 1);
  const data = (await main.getPersonalUser("alice"))!.cardsData[0];
  assert.deepEqual(data.personalInfoCardIds, ["note"]); assert.equal(data.personalInfoRevision, 1);
});
test("first Save winning a concurrent delete retains the protected reference and private version", async () => {
  const { main, info, context } = await setup();
  await info.createPersonal("alice", "note", "main", context); await info.save("alice", "note", 0, body(), "private");
  let release!: () => void, reached!: () => void, deleteRead!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const atCommit = new Promise<void>(resolve => { reached = resolve; });
  const atDeleteRead = new Promise<void>(resolve => { deleteRead = resolve; });
  const transaction = info.transaction.bind(info);
  info.transaction = run => transaction(async session => { const result = await run(session); reached(); await held; return result; });
  const saving = info.savePersonal("alice", "note", 1, context); await atCommit;
  const deletingRepo = new InfoCardRepository(main.db, client), owner = deletingRepo.owner.bind(deletingRepo);
  deletingRepo.owner = async (...args) => { const root = await owner(...args); deleteRead(); return root; };
  const deleting = deletingRepo.delete("alice", "note", 1);
  const rejected = assert.rejects(deleting, (error: unknown) => ["STALE_INFO_REVISION", "INFO_REFERENCED_CONFLICT"].includes((error as { code: string }).code));
  await atDeleteRead; release(); await saving; await rejected;
  assert.deepEqual((await main.getPersonalUser("alice"))!.cardsData[0].personalInfoCardIds, ["note"]);
  assert.equal(await info.versions().countDocuments({ infoCardId: "note" }), 1);
  await assert.rejects(deletingRepo.delete("alice", "note", 2), { code: "INFO_REFERENCED_CONFLICT" });
});
test("personal associations survive archive and the same Card reused in another Deck", async () => {
  const { main, info, context } = await setup(); await note(info, context);
  const second = await main.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Other practice", cards: [{ cardTemplateId: "main" }] }, "public");
  await main.publishDeck("alice", second.deckTemplateId, 0); await main.ensureDeckData("alice", second.deckTemplateId, 1);
  const before = (await main.getPersonalUser("alice"))!.cardsData[0];
  await main.archiveDeckData("alice", context.deckTemplateId);
  const snapshot = await mainInfoConsultation(info, "alice", "main", { mode: "working", version: 1, deckTemplateId: second.deckTemplateId });
  assert.equal(snapshot.entries[0].status === "available" && snapshot.entries[0].info.infoCardId, "note");
  const after = (await main.getPersonalUser("alice"))!.cardsData;
  assert.equal(after.filter(data => data.cardTemplateId === "main").length, 1); assert.deepEqual(after[0], before);
});
test("foreign contexts and missing indexes fail closed; setup is idempotent without document mutation", async () => {
  const { main, info, context } = await setup();
  await assert.rejects(info.createPersonal("bob", "foreign", "main", context));
  await assert.rejects(info.createPersonal("alice", "foreign", "main", { ...context, version: 2 }));
  await note(info, context); await assert.rejects(info.owner("bob", "note"), { code: "INFO_FORBIDDEN" });
  await assert.rejects(info.removePersonal("bob", "main", "note", 1), { code: "PERSONAL_INFO_FORBIDDEN" });
  const before = await main.getPersonalUser("alice"); await createInfoCardIndexes(main.db); await createInfoCardIndexes(main.db);
  assert.deepEqual(await main.getPersonalUser("alice"), before);
  await main.users().dropIndex("cardsData.personalInfoCardIds_1");
  const isolated = new MongoClient(mongo.getUri()); await isolated.connect();
  try { await assert.rejects(new InfoCardRepository(main.db, isolated).assertIndexesReady(true, true), { code: "INFO_INDEX_SETUP_REQUIRED" }); }
  finally { await isolated.close(); }
});
test("combined consultation uses attachment date, pins content, and canonical/other users exclude personal refs", async () => {
  const { main, info, context } = await setup(); await note(info, context);
  const old = await mainInfoConsultation(info, "alice", "main", { ...context, mode: "working" });
  await info.create("alice", "old-shared"); await info.save("alice", "old-shared", 0, body("Shared"), "public"); await info.publish("alice", "old-shared", 1);
  await info.roots().updateOne({ infoCardId: "old-shared" }, { $set: { createdAt: new Date("2020-01-01") } });
  const content = (await main.getCardVersion("main", 1))!.content;
  await main.saveCardDraft("alice", "main", 1, { ...content, infoCardIds: ["old-shared"] }); await main.publishCard("alice", "main", 2);
  const next = await mainInfoConsultation(info, "alice", "main", { ...context, mode: "working", version: 2 });
  assert.deepEqual(next.entries.map(entry => entry.status === "available" ? entry.info.infoCardId : null), ["old-shared", "note"]);
  await info.save("alice", "note", 2, body("Changed"), "private"); await info.savePersonal("alice", "note", 3);
  assert.equal(old.entries[0].status === "available" && old.entries[0].info.content.title, "Note");
  assert.equal((await mainInfoConsultation(info, "bob", "main", { mode: "canonical", version: 2 })).entries.length, 1);
  const canonical = await mainInfoConsultation(info, "alice", "main", { mode: "canonical", version: 2 });
  assert.equal(canonical.personalSources, undefined); assert.equal(canonical.entries.length, 1);
});
test("multi-generation forks reuse original records/dates; inherited Remove acts on the source", async () => {
  const { main, info, context } = await setup(); await note(info, context);
  let parent = "main";
  for (const id of ["fork-y", "fork-z"]) {
    const source = { cardTemplateId: parent, version: 1 }, stepIds = [randomUUID(), randomUUID(), randomUUID()];
    const original = (await main.getCardVersion(parent, 1))!.content;
    await main.createCardFork("alice", { cardTemplateId: id, source, context: { kind: "library" }, stepIds, visibility: "public",
      content: { ...forkCardContent(original, source, stepIds), intro: { ...original.intro, title: id } } });
    await main.publishCard("alice", id, 0); parent = id;
  }
  const deck = (await main.decks().findOne({ deckTemplateId: context.deckTemplateId }))!;
  const originalDeck = (await main.getDeckVersion(context.deckTemplateId, 1))!.content;
  await main.saveDeckDraft("alice", context.deckTemplateId, deck.revision, { ...originalDeck, cards: [{ cardTemplateId: "fork-z" }] });
  await main.publishDeck("alice", context.deckTemplateId, deck.revision + 1);
  const snapshot = await mainInfoConsultation(info, "alice", "fork-z", { mode: "working", ...context });
  assert.equal(snapshot.entries.length, 1);
  assert.equal(snapshot.entries[0].status === "available" && snapshot.entries[0].sourceCardTemplateId, "main");
  const records = (await main.getPersonalUser("alice"))!.cardsData;
  assert.equal(records.find(data => data.cardTemplateId === "fork-y")!.personalInfoCardIds, undefined);
  assert.equal(records.find(data => data.cardTemplateId === "fork-z")!.personalInfoCardIds, undefined);
  await info.removePersonal("alice", "main", "note", 1);
  assert.equal((await mainInfoConsultation(info, "alice", "fork-z", { mode: "working", ...context })).entries.length, 0);
  assert.equal((await workingDTO(main, "alice", context.deckTemplateId)).cards[0].personalHistory!.length, 3);
});
test("unavailable personal slots reveal no protected identity and retained refs block deletion", async () => {
  const { info, context } = await setup(); await note(info, context);
  await assert.rejects(info.delete("alice", "note", 2), { code: "INFO_REFERENCED_CONFLICT" });
  await info.versions().deleteOne({ infoCardId: "note", version: 1 });
  const snapshot = await mainInfoConsultation(info, "alice", "main", { mode: "working", ...context });
  assert.equal(snapshot.entries.length, 1); assert.equal(snapshot.entries[0].status, "unavailable");
  assert.deepEqual(Object.keys(snapshot.entries[0]).sort(), ["key", "status"]);
  assert.equal(JSON.stringify(snapshot.entries).includes("note"), false);
});

test("a follower's notes inherit through their own fork history, never the main creator's CardData", async () => {
  const { main, info, context } = await setup(); await note(info, context);
  await main.ensureDeckData("bob", context.deckTemplateId, 1); await main.ensureCardData("bob", "main", 1);
  await info.createSeries("bob", "bob-series", "Bob notes");
  await info.createPersonal("bob", "bob-note", "main", context);
  await info.save("bob", "bob-note", 0, { ...body(), seriesId: "bob-series" }, "private");
  await info.savePersonal("bob", "bob-note", 1, context);
  const own = await mainInfoConsultation(info, "alice", "main", { mode: "working", ...context });
  const followed = await mainInfoConsultation(info, "bob", "main", { mode: "working", ...context });
  assert.deepEqual(own.entries.flatMap(entry => entry.status === "available" ? [entry.info.infoCardId] : []), ["note"]);
  assert.deepEqual(followed.entries.flatMap(entry => entry.status === "available" ? [entry.info.infoCardId] : []), ["bob-note"]);
  const source = { cardTemplateId: "main", version: 1 }, stepIds = [randomUUID(), randomUUID(), randomUUID()];
  const original = (await main.getCardVersion("main", 1))!.content;
  await main.createCardFork("bob", { source, cardTemplateId: "bob-fork", context: { kind: "library" }, stepIds,
    content: { ...forkCardContent(original, source, stepIds), intro: { ...original.intro, title: "Bob adaptation" } } });
  await main.publishCard("bob", "bob-fork", 0);
  const user = (await main.getPersonalUser("bob"))!;
  assert.equal(user.cardsData.find(data => data.cardTemplateId === "bob-fork")!.historySourceCardTemplateId, "main");
  assert.equal(user.cardsData.find(data => data.cardTemplateId === "bob-fork")!.personalInfoCardIds, undefined);
  await assert.rejects(info.owner("alice", "bob-note"), { code: "INFO_FORBIDDEN" });
});

test("concurrent stable personal creation recovers one root and cannot change its origin", async () => {
  const { info, context } = await setup();
  const results = await Promise.all([info.createPersonal("alice", "same", "main", context), info.createPersonal("alice", "same", "main", context)]);
  assert.equal(results[0].infoCardId, results[1].infoCardId); assert.equal(await info.roots().countDocuments({ infoCardId: "same" }), 1);
  await assert.rejects(info.create("alice", "same"), { code: "INFO_CREATE_RECOVERY_CONFLICT" });
});

test("deletion winning a delayed personal Save never leaves a dangling attachment or publication", async () => {
  const { main, info, context } = await setup();
  let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
  const media = { id: "image", provider: "cloudflare-r2" as const, mediaType: "image" as const, assetId: "race-image", src: "https://example.invalid/race.png", description: "Image" };
  await info.createPersonal("alice", "race-note", "main", context);
  await info.save("alice", "race-note", 0, { ...body(), mediaItem: media }, "private", await signInfoUpload(await info.owner("alice", "race-note"), media));
  const delayed = new InfoCardRepository(main.db, client, { async assertReady() { entered(); await held; } });
  const saving = delayed.savePersonal("alice", "race-note", 1, context); await reached;
  await info.delete("alice", "race-note", 1); release(); await assert.rejects(saving, { code: "INFO_FORBIDDEN" });
  assert.equal((await main.getPersonalUser("alice"))!.cardsData[0].personalInfoCardIds, undefined);
  assert.equal(await info.versions().countDocuments({ infoCardId: "race-note" }), 0);
});
for (const kind of ["image", "video"] as const) test(`personal ${kind} grants are owner/exact-publication bound even with corrupt public visibility`, async () => {
  const { info, context } = await setup(); await info.createPersonal("alice", "note", "main", context);
  const media = kind === "image" ? { id: "image", provider: "cloudflare-r2" as const, mediaType: "image" as const, assetId: "private-key", src: "https://example.invalid/private.png", description: "Image" }
    : { id: "video", provider: "cloudflare-stream" as const, mediaType: "video" as const, assetId: "private-video", src: "https://iframe.videodelivery.net/private-video", description: "Video" };
  const proof = await signInfoUpload(await info.owner("alice", "note"), media);
  await info.save("alice", "note", 0, { ...body(), mediaItem: media }, "private", proof); await info.savePersonal("alice", "note", 1, context);
  assert.deepEqual(await authorizeInfoMedia(info, "alice", { infoCardId: "note", kind: "publication", version: 1 }), media);
  await info.save("alice", "note", 2, { ...body("Updated note"), mediaItem: null }, "private"); await info.savePersonal("alice", "note", 3);
  assert.deepEqual(await authorizeInfoMedia(info, "alice", { infoCardId: "note", kind: "publication", version: 1 }), media);
  await assert.rejects(authorizeInfoMedia(info, "alice", { infoCardId: "note", kind: "publication", version: 2 }), { code: "INFO_MEDIA_FORBIDDEN" });
  await info.roots().updateOne({ infoCardId: "note" }, { $set: { visibility: "public" } });
  await info.versions().updateOne({ infoCardId: "note", version: 1 }, { $set: { visibility: "public" } });
  await assert.rejects(authorizeInfoMedia(info, "bob", { infoCardId: "note", kind: "publication", version: 1 }), { code: "INFO_MEDIA_FORBIDDEN" });
});
