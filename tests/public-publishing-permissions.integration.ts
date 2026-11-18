import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient, ObjectId, type ClientSession } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { InfoCardRepository, createInfoCardIndexes } from "../src/lib/infoCards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../src/lib/cards/forks";
import { deckContentHash } from "../src/lib/cards/cardReuse";
import { publishedSnapshot } from "../src/lib/infoCards/queries";
import { withMongoTransaction } from "../src/lib/mongodb";
import { requirePublicPublishing } from "../src/lib/userPermissions";
let server: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
async function setup(permissions: unknown = { publicPublishing: false }, objectId = false) {
  const db = client.db(`switchplay_test_publishing_${sequence++}`); await createFoundationIndexes(db); await createInfoCardIndexes(db);
  const _id = objectId ? new ObjectId() : "author", actor = _id.toString();
  await db.collection("users").insertOne({ _id, ...(permissions === undefined ? {} : { permissions }), cardsData: [], decksData: [],
    passwordHash: "preserved", email: "preserved@example.invalid", isAdmin: true,
    safeguarding: { groupExperienceApproval: { status: "approved" } }, registrationCategory: "teacher" } as never);
  const main = new CardRepository(db, client), info = new InfoCardRepository(db, client);
  await info.createSeries(actor, "series", "Basics");
  const grant = (value: boolean) => db.collection("users").updateOne({ _id } as never, { $set: { "permissions.publicPublishing": value } });
  return { db, main, info, actor, _id, grant };
}
const cardContent = () => ({ ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: "Practice", description: null, mediaItem: null } });
const deckContent = () => ({ ...createDefaultDeckContent([]), title: "Practice Deck" });
async function drafts(f: Awaited<ReturnType<typeof setup>>, visibility: "public" | "private") {
  const card = await f.main.createCardDraft(f.actor, cardContent(), visibility);
  const deck = await f.main.createDeckDraft(f.actor, deckContent(), visibility);
  const id = randomUUID(); await f.info.create(f.actor, id); await f.info.save(f.actor, id, 0, { title: "Signs", body: "Keep the sign with its number.", seriesId: "series", mediaItem: null }, visibility);
  return { card, deck, id, publish: [() => f.main.publishCard(f.actor, card.cardTemplateId, 0), () => f.main.publishDeck(f.actor, deck.deckTemplateId, 0), () => f.info.publish(f.actor, id, 1)] };
}
for (const [label, permissions] of Object.entries({ false: { publicPublishing: false }, missing: {}, null: null, string: { publicPublishing: "true" }, number: { publicPublishing: 1 }, array: { publicPublishing: [true] }, objectArray: [{ publicPublishing: true }] })) {
  test(`${label} grant denies every public boundary, including admin/teacher/approved-parent accounts`, async () => {
    const f = await setup(permissions), d = await drafts(f, "public");
    const before = await f.db.collection("users").findOne({ _id: f._id } as never);
    for (const publish of d.publish) await assert.rejects(publish(), { code: "PUBLIC_PUBLISHING_FORBIDDEN" });
    assert.equal(await f.main.cardVersions().countDocuments(), 0); assert.equal(await f.main.deckVersions().countDocuments(), 0); assert.equal(await f.info.versions().countDocuments(), 0);
    assert.deepEqual(await f.db.collection("users").findOne({ _id: f._id } as never), before);
    assert.equal((await f.main.cards().findOne({ cardTemplateId: d.card.cardTemplateId }))!.revision, 0);
  });
}
test("absent permissions record denies; private Card/Deck/Info publication still works without a user guard", async () => {
  const f = await setup(); await f.db.collection("users").updateOne({ _id: f._id } as never, { $unset: { permissions: "" } });
  const publicDrafts = await drafts(f, "public"); for (const publish of publicDrafts.publish) await assert.rejects(publish(), { code: "PUBLIC_PUBLISHING_FORBIDDEN" });
  const privateDrafts = await drafts(f, "private"); for (const publish of privateDrafts.publish) await publish();
  assert.equal((await f.db.collection("users").findOne({ _id: f._id } as never))!.publicPublishingRevision, undefined);
  assert.equal((await f.main.getPersonalUser(f.actor))!.decksData.length, 1);
});
for (const objectId of [false, true]) test(`grants/revocation/regrant cover new versions and preserve prior public content (${objectId ? "ObjectId" : "string"})`, async () => {
  const f = await setup({ publicPublishing: true }, objectId), d = await drafts(f, "public");
  for (const publish of d.publish) await publish();
  const original = await f.db.collection("users").findOne({ _id: f._id } as never);
  assert.equal(original!.publicPublishingRevision, 3);
  const oldCard = await f.main.getCardVersion(d.card.cardTemplateId, 1), oldDeck = await f.main.getDeckVersion(d.deck.deckTemplateId, 1), oldInfo = await f.info.versions().findOne({ infoCardId: d.id, version: 1 });
  await f.main.saveCardDraft(f.actor, d.card.cardTemplateId, 1, { ...d.card.draft!, intro: { ...d.card.draft!.intro, title: "Updated" } });
  await f.main.saveDeckDraft(f.actor, d.deck.deckTemplateId, 1, { ...d.deck.draft!, title: "Updated Deck" });
  await f.info.save(f.actor, d.id, 2, { ...oldInfo!.content, title: "Updated" }, "public");
  await f.grant(false);
  const updates = [() => f.main.publishCard(f.actor, d.card.cardTemplateId, 2), () => f.main.publishDeck(f.actor, d.deck.deckTemplateId, 2), () => f.info.publish(f.actor, d.id, 3)];
  for (const publish of updates) await assert.rejects(publish(), { code: "PUBLIC_PUBLISHING_FORBIDDEN" });
  assert.deepEqual(await f.main.getCardVersion(d.card.cardTemplateId, 1), oldCard); assert.deepEqual(await f.main.getDeckVersion(d.deck.deckTemplateId, 1), oldDeck);
  assert.deepEqual(await f.info.versions().findOne({ infoCardId: d.id, version: 1 }), oldInfo);
  assert.equal((await publishedSnapshot(f.info, "viewer", [d.id])).length, 1);
  // Existing Info publication receipts are read-only and still recoverable after revocation.
  assert.equal((await f.info.publish(f.actor, d.id, 1)).version, 1);
  assert.equal((await f.db.collection("users").findOne({ _id: f._id } as never))!.publicPublishingRevision, 3);
  await f.grant(true); for (const publish of updates) await publish();
  const saved = (await f.db.collection("users").findOne({ _id: f._id } as never))!;
  assert.equal(saved.publicPublishingRevision, 6); assert.deepEqual(saved.cardsData, original!.cardsData); assert.deepEqual(saved.decksData, original!.decksData); assert.equal(saved.passwordHash, original!.passwordHash);
});
test("public Copy is atomic on denial; private Copy works; committed public Copy receipt recovery writes nothing", async () => {
  const f = await setup({ publicPublishing: true }), d = await drafts(f, "public"); for (const publish of d.publish) await publish();
  const command = { deckTemplateId: d.deck.deckTemplateId, revision: 1, contentHash: deckContentHash(d.deck.draft!) };
  await f.grant(false);
  const beforeCard = await f.main.cards().findOne({ cardTemplateId: d.card.cardTemplateId }), beforeDeck = await f.main.decks().findOne({ deckTemplateId: d.deck.deckTemplateId });
  await assert.rejects(f.main.copyOwnedCard(f.actor, d.card.cardTemplateId, command), { code: "PUBLIC_PUBLISHING_FORBIDDEN" });
  assert.deepEqual(await f.main.cards().findOne({ cardTemplateId: d.card.cardTemplateId }), beforeCard);
  assert.deepEqual(await f.main.decks().findOne({ deckTemplateId: d.deck.deckTemplateId }), beforeDeck); assert.equal(await f.main.deckVersions().countDocuments(), 1);
  const privateDeck = await f.main.createDeckDraft(f.actor, deckContent()); await f.main.publishDeck(f.actor, privateDeck.deckTemplateId, 0);
  const privateCopy = await f.main.copyOwnedCard(f.actor, d.card.cardTemplateId, { deckTemplateId: privateDeck.deckTemplateId, revision: 1, contentHash: deckContentHash(privateDeck.draft!) });
  assert.equal(privateCopy.outcome, "published"); assert.equal((await f.main.getDeckVersion(privateDeck.deckTemplateId, 2))!.visibility, "private");
  await f.grant(true); const receipt = await f.main.copyOwnedCard(f.actor, d.card.cardTemplateId, command); assert.equal(receipt.outcome, "published");
  await f.grant(false); const user = await f.db.collection("users").findOne({ _id: f._id } as never);
  assert.deepEqual(await f.main.copyOwnedCard(f.actor, d.card.cardTemplateId, command), receipt);
  assert.deepEqual(await f.db.collection("users").findOne({ _id: f._id } as never), user); assert.equal(await f.main.deckVersions().countDocuments(), 4);
});
test("public visibility staging is allowed and can be returned to private before first publication", async () => {
  const f = await setup(), d = await drafts(f, "public");
  await f.main.saveCardDraft(f.actor, d.card.cardTemplateId, 0, d.card.draft!, "private"); await f.main.publishCard(f.actor, d.card.cardTemplateId, 1);
  await f.main.saveDeckDraft(f.actor, d.deck.deckTemplateId, 0, d.deck.draft!, "private"); await f.main.publishDeck(f.actor, d.deck.deckTemplateId, 1);
  const content = (await f.info.roots().findOne({ infoCardId: d.id }))!.draft!;
  await f.info.save(f.actor, d.id, 1, content, "private"); await f.info.publish(f.actor, d.id, 2);
});
for (const kind of ["card", "deck", "info"] as const) test(`${kind} publication retries an old snapshot after revocation and denies without a public write`, async () => {
  const f = await setup({ publicPublishing: true }), d = await drafts(f, "public");
  let arrived!: () => void, release!: () => void, first = true;
  const ready = new Promise<void>(r => { arrived = r; }), gate = new Promise<void>(r => { release = r; });
  const transaction = <T>(operation: (session: ClientSession) => Promise<T>) => withMongoTransaction(client, async session => {
    if (first) { first = false; await f.db.collection("users").findOne({ _id: f._id } as never, { session }); arrived(); await gate; }
    return operation(session);
  });
  if (kind === "info") f.info.transaction = transaction; else f.main.transaction = transaction;
  const publishing = d.publish[{ card: 0, deck: 1, info: 2 }[kind]]();
  const rejected = assert.rejects(publishing, { code: "PUBLIC_PUBLISHING_FORBIDDEN" });
  await ready; await f.grant(false); release(); await rejected;
  assert.equal(await f.main.cardVersions().countDocuments() + await f.main.deckVersions().countDocuments() + await f.info.versions().countDocuments(), 0);
});
test("public write lock serialises revocation; targeted grant guard preserves concurrent personal writes", async () => {
  const f = await setup({ publicPublishing: true });
  const session = client.startSession(); session.startTransaction();
  await requirePublicPublishing(f.db, f.actor, session);
  const revoke = f.grant(false); // Waits for the public transaction's user write.
  await session.commitTransaction(); await session.endSession(); await revoke;
  await assert.rejects(withMongoTransaction(client, s => requirePublicPublishing(f.db, f.actor, s)), { code: "PUBLIC_PUBLISHING_FORBIDDEN" });
  await f.grant(true);
  await Promise.all([withMongoTransaction(client, s => requirePublicPublishing(f.db, f.actor, s)), f.db.collection("users").updateOne({ _id: f._id } as never, { $set: { personalMarker: "preserved" } })]);
  assert.equal((await f.db.collection("users").findOne({ _id: f._id } as never))!.personalMarker, "preserved");
});

test("an unapproved learner can fork public sources and publish both private forks", async () => {
  const f = await setup({ publicPublishing: true }), d = await drafts(f, "public");
  for (const publish of d.publish) await publish();
  const learner = "unapproved-learner";
  await f.db.collection("users").insertOne({ _id: learner, permissions: { publicPublishing: false }, cardsData: [], decksData: [] } as never);
  const stepIds = [randomUUID(), randomUUID(), randomUUID()], cardId = randomUUID(), deckId = randomUUID();
  const source = { cardTemplateId: d.card.cardTemplateId, version: 1 };
  const baseline = forkCardContent(d.card.draft!, source, stepIds);
  await f.main.createCardFork(learner, { source, cardTemplateId: cardId, stepIds, context: { kind: "library" }, content: { ...baseline, intro: { ...baseline.intro, title: "My private variation" } } });
  await f.main.publishCard(learner, cardId, 0);
  await f.main.createDeckFork(learner, { source: { deckTemplateId: d.deck.deckTemplateId, version: 1 }, deckTemplateId: deckId, context: { kind: "library" }, content: { ...d.deck.draft!, title: "My private deck" } });
  await f.main.publishDeck(learner, deckId, 0, undefined, undefined, { enterMyDecks: true });
  assert.equal((await f.main.getCardVersion(cardId, 1))!.visibility, "private");
  assert.equal((await f.main.getDeckVersion(deckId, 1))!.visibility, "private");
  assert.equal((await f.main.getPersonalUser(learner))!.decksData.length, 1);
  // Receipt-only retries do not require a public grant or repeat personal entry.
  assert.equal(await f.main.publishCard(learner, cardId, 0), 1);
  assert.equal(await f.main.publishDeck(learner, deckId, 0, undefined, undefined, { enterMyDecks: true }), 1);
});
