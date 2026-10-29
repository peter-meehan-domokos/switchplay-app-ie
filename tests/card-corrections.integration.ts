// Product regressions replacing the temporary second-opinion probes.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../src/lib/cards/forks";
import { membershipDTO, workingDTO, personalCardHistoryDTO } from "../src/lib/cards/readModels";
import { resolveDeckPreview, resolveWorkingDeck } from "../src/lib/cards/resolvers";
import { copyDestinations } from "../src/lib/cards/cardReuse";
import { deckDraftContent } from "../src/lib/cards/publicationRules";
import type { CardContent, Visibility } from "../src/lib/cards/model";

let server: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
async function setup() {
  const repo = new CardRepository(client.db(`switchplay_test_probe_${sequence++}`), client); await createFoundationIndexes(repo.db);
  await repo.users().insertMany(["alice", "bob"].map((_id) => ({ _id, decksData: [], cardsData: [] })));
  return repo;
}
const content = (title: string): CardContent => ({ ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title, description: null, mediaItem: null } });
async function card(repo: CardRepository, owner: string, title: string, visibility: Visibility) {
  const c = await repo.createCardDraft(owner, content(title), visibility); await repo.publishCard(owner, c.cardTemplateId, 0); return c;
}
async function deck(repo: CardRepository, owner: string, ids: string[], visibility: Visibility, title = "Programme") {
  const d = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title, cards: ids.map((cardTemplateId) => ({ cardTemplateId })) }, visibility);
  await repo.publishDeck(owner, d.deckTemplateId, 0); return d;
}

test("public Deck cannot demote; followers keep adopted access and membership", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "public"); const d = await deck(repo, "bob", [x.cardTemplateId], "public");
  await repo.ensureDeckData("alice", d.deckTemplateId, 1);
  const root = (await repo.decks().findOne({ deckTemplateId: d.deckTemplateId }))!;
  await assert.rejects(repo.saveDeckDraft("bob", d.deckTemplateId, root.revision, deckDraftContent((await repo.getDeckVersion(d.deckTemplateId, 1))!.content), "private"), { code: "PUBLIC_VISIBILITY_PERMANENT" });
  assert.deepEqual(await repo.decks().findOne({ deckTemplateId: d.deckTemplateId }), root);
  assert.equal((await resolveWorkingDeck(repo, "alice", d.deckTemplateId))!.version.version, 1);
  assert.equal((await membershipDTO(repo, "alice"))[0].availability, "available");
});

test("Deck draft visibility is private until publication; private Cards block without leaking draft content", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "private"); const d = await deck(repo, "bob", [x.cardTemplateId], "private");
  const root = (await repo.decks().findOne({ deckTemplateId: d.deckTemplateId }))!;
  await repo.saveDeckDraft("bob", d.deckTemplateId, root.revision, { ...deckDraftContent((await repo.getDeckVersion(d.deckTemplateId, 1))!.content), title: "Draft title" }, "public");
  assert.equal((await repo.decks().findOne({ deckTemplateId: d.deckTemplateId }))!.visibility, "private");
  await assert.rejects(resolveDeckPreview(repo, d.deckTemplateId, "alice"), { code: "DECK_FORBIDDEN" });
  await assert.rejects(repo.publishDeck("bob", d.deckTemplateId, root.revision + 1), { code: "PRIVATE_CARDS_BLOCK_PUBLIC_DECK" });
  await repo.promoteCard("bob", x.cardTemplateId, 1);
  await repo.publishCard("bob", x.cardTemplateId, 2);
  await repo.publishDeck("bob", d.deckTemplateId, root.revision + 1);
  assert.equal((await resolveDeckPreview(repo, d.deckTemplateId, "alice")).version.content.title, "Draft title");
});

test("Deck publication never bumps a Card content revision; subsequent Card autosave remains valid", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "public");
  const before = (await repo.cards().findOne({ cardTemplateId: x.cardTemplateId }))!.revision;
  await deck(repo, "bob", [x.cardTemplateId], "public");
  assert.equal((await repo.cards().findOne({ cardTemplateId: x.cardTemplateId }))!.revision, before);
  const original = (await repo.getCardVersion(x.cardTemplateId, 1))!.content;
  await repo.saveCardDraft("bob", x.cardTemplateId, before, { ...original, intro: { ...original.intro, title: "Edited" } });
});

test("Library-context fork carries viewer current state and retains source history without duplicating it", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "public"); const d = await deck(repo, "bob", [x.cardTemplateId], "public");
  await repo.ensureDeckData("alice", d.deckTemplateId, 1); await repo.openWorkingDeck("alice", d.deckTemplateId, "2026-10-07");
  const source = (await repo.getCardVersion(x.cardTemplateId, 1))!;
  await repo.setCompletion("alice", d.deckTemplateId, x.cardTemplateId, source.content.steps[0].stepId, "done");
  await repo.setReflection("alice", d.deckTemplateId, x.cardTemplateId, "my reflection");
  const ref = { cardTemplateId: x.cardTemplateId, version: 1 }, stepIds = [randomUUID(), randomUUID(), randomUUID()];
  const base = forkCardContent(source.content, ref, stepIds); const id = randomUUID();
  await repo.createCardFork("alice", { source: ref, cardTemplateId: id, stepIds, context: { kind: "library" }, content: { ...base, intro: { ...base.intro, title: "Mine" } } });
  await repo.publishCard("alice", id, 0);
  const forked = (await repo.getPersonalUser("alice"))!.cardsData.find((c) => c.cardTemplateId === id)!;
  assert.equal(forked.items[0].completionStatus, "done");
  assert.equal(forked.reflection, "my reflection"); assert.equal(forked.historySourceCardTemplateId, x.cardTemplateId);
  assert.deepEqual([forked.chats, forked.tests, forked.mediaItems], [[], [], []]);
});

test("restoring an archived Deck preserves adoption while preview and update metadata report latest", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "public"); const y = await card(repo, "bob", "Y", "public");
  const d = await deck(repo, "bob", [x.cardTemplateId], "public");
  await repo.ensureDeckData("alice", d.deckTemplateId, 1); await repo.archiveDeckData("alice", d.deckTemplateId);
  const root = (await repo.decks().findOne({ deckTemplateId: d.deckTemplateId }))!;
  await repo.saveDeckDraft("bob", d.deckTemplateId, root.revision, { ...root.draft ?? deckDraftContent((await repo.getDeckVersion(d.deckTemplateId, 1))!.content), cards: [x, y].map((c) => ({ cardTemplateId: c.cardTemplateId })) });
  await repo.publishDeck("bob", d.deckTemplateId, root.revision + 1);
  assert.equal((await resolveDeckPreview(repo, d.deckTemplateId, "alice")).cards.length, 2);
  const data = await repo.ensureDeckData("alice", d.deckTemplateId, 2);
  assert.equal(data.deckTemplateVersion, 1); assert.equal(data.archivedAt, null);
  assert.equal((await membershipDTO(repo, "alice"))[0].updateAvailable, true);
});

test("new entry adopts latest Card, existing adoption wins, and immutable Deck publish pins never change", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "public");
  const carolDeck = await deck(repo, "alice", [x.cardTemplateId], "public", "Alice's deck using Bob's card");
  await repo.saveCardDraft("bob", x.cardTemplateId, 1, content("Bob rewrote this completely")); await repo.publishCard("bob", x.cardTemplateId, 2);
  await repo.users().insertOne({ _id: "dave", decksData: [], cardsData: [] } as never);
  await repo.ensureDeckData("dave", carolDeck.deckTemplateId, 1);
  const v = (await repo.getDeckVersion(carolDeck.deckTemplateId, 1))!;
  assert.equal(v.content.cards[0].cardVersionAtPublish, 1);
  assert.equal((await repo.getPersonalUser("dave"))!.cardsData[0].cardTemplateVersion, 2);
});

test("unchanged Card keeps viewer CardData and original-context chats through adapted Decks", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "public"); const y = await card(repo, "bob", "Y", "public");
  const d = await deck(repo, "bob", [x.cardTemplateId, y.cardTemplateId], "public");
  await repo.ensureDeckData("alice", d.deckTemplateId, 1); await repo.openWorkingDeck("alice", d.deckTemplateId, "2026-10-07");
  await repo.users().updateOne({ _id: "alice" as never }, { $set: { "cardsData.1.chats": [{ id: "c", deckTemplateId: d.deckTemplateId, comments: [{ id: "m", creatorId: "coach", createdAt: "2026-10-07", text: "Coach feedback", isRetained: true }] }] } });
  const forkId = randomUUID(); const v1 = (await repo.getDeckVersion(d.deckTemplateId, 1))!;
  await repo.createDeckFork("alice", { source: { deckTemplateId: d.deckTemplateId, version: 1 }, deckTemplateId: forkId,
    context: { kind: "my-decks", deckTemplateId: d.deckTemplateId }, content: { ...deckDraftContent(v1.content), cards: [y, x].map((c) => ({ cardTemplateId: c.cardTemplateId })) } });
  await repo.publishDeck("alice", forkId, 0, undefined, undefined, { enterMyDecks: true });
  await repo.openWorkingDeck("alice", forkId, "2026-10-08");
  const original = await workingDTO(repo, "alice", d.deckTemplateId), adapted = await workingDTO(repo, "alice", forkId);
  assert.equal(original.cards.find((c) => c.id === y.cardTemplateId)!.chats.length, 1);
  assert.equal(adapted.cards.find((c) => c.id === y.cardTemplateId)!.chats.length, 1);
  assert.equal(adapted.cards.find((c) => c.id === y.cardTemplateId)!.chats[0].deckTemplateId, d.deckTemplateId);
  assert.equal((await membershipDTO(repo, "alice")).filter((m) => m.archivedAt === null).length, 2); // both programmes listed
});

test("one global target date per Card is established by its first relevant Deck open", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "public"); const y = await card(repo, "bob", "Y", "public");
  const a = await deck(repo, "bob", [x.cardTemplateId], "public", "A"); const b = await deck(repo, "bob", [y.cardTemplateId, x.cardTemplateId], "public", "B");
  await repo.ensureDeckData("alice", a.deckTemplateId, 1); await repo.ensureDeckData("alice", b.deckTemplateId, 1);
  await repo.openWorkingDeck("alice", b.deckTemplateId, "2026-10-07");
  await repo.openWorkingDeck("alice", a.deckTemplateId, "2026-10-07");
  const xa = (await workingDTO(repo, "alice", a.deckTemplateId)).cards[0];
  assert.equal(xa.targetDate, "2026-10-21"); // B position 2 (14 days), not A position 1 (2026-10-14)
});

test("Copy private Card into clean public Deck is draft-only, private and exactly recoverable", async () => {
  const repo = await setup(); const z = await card(repo, "alice", "Private note-to-self", "private"); const other = await card(repo, "alice", "Shared", "public");
  const d = await deck(repo, "alice", [other.cardTemplateId], "public");
  const dest = (await copyDestinations(repo, "alice", z.cardTemplateId, "none")).find((x) => x.deckTemplateId === d.deckTemplateId)!;
  const result = await repo.copyOwnedCard("alice", z.cardTemplateId, { deckTemplateId: dest.deckTemplateId, revision: dest.revision, contentHash: dest.contentHash });
  assert.equal(result.outcome, "draft");
  assert.deepEqual(await repo.copyOwnedCard("alice", z.cardTemplateId, { deckTemplateId: dest.deckTemplateId, revision: dest.revision, contentHash: dest.contentHash }), result);
  assert.equal((await repo.cards().findOne({ cardTemplateId: z.cardTemplateId }))!.visibility, "private");
  assert.equal((await repo.cards().findOne({ cardTemplateId: z.cardTemplateId }))!.revision, 1);
  assert.equal(await repo.deckVersions().countDocuments({ deckTemplateId: d.deckTemplateId }), 1);
  await assert.rejects(repo.publishDeck("alice", d.deckTemplateId, result.revision), { code: "PRIVATE_CARDS_BLOCK_PUBLIC_DECK" });
  await repo.promoteCard("alice", z.cardTemplateId, 1); await repo.publishCard("alice", z.cardTemplateId, 2);
  // A later explicit Card publication cannot reinterpret the original Copy result.
  assert.deepEqual(await repo.copyOwnedCard("alice", z.cardTemplateId, { deckTemplateId: dest.deckTemplateId, revision: dest.revision, contentHash: dest.contentHash }), result);
});

test("unpublished public intent is inaccessible and explicit Card visibility only takes effect on publication", async () => {
  const repo = await setup(), c = content("Draft");
  const x = await repo.createCardDraft("bob", c, "public");
  assert.equal(x.visibility, "private"); assert.equal(x.draftVisibility, "public");
  await assert.rejects(repo.createCardFork("alice", { source: { cardTemplateId: x.cardTemplateId, version: 1 }, cardTemplateId: randomUUID(),
    stepIds: [randomUUID(), randomUUID(), randomUUID()], content: c, context: { kind: "library" } }), { code: "CARD_FORBIDDEN" });
  const d = await repo.createDeckDraft("bob", { ...createDefaultDeckContent([]), title: "Draft" }, "public");
  await assert.rejects(resolveDeckPreview(repo, d.deckTemplateId, "alice"), { code: "DECK_FORBIDDEN" });
  assert.deepEqual((await repo.getPersonalUser("bob"))!.cardsData, []);
  await repo.publishCard("bob", x.cardTemplateId, 0);
  await assert.rejects(repo.saveCardDraft("bob", x.cardTemplateId, 1, c, "private"), { code: "PUBLIC_VISIBILITY_PERMANENT" });
  assert.equal((await repo.getCardVersion(x.cardTemplateId, 1))!.visibility, "public");
  assert.deepEqual((await repo.getPersonalUser("bob"))!.cardsData, []);
  const privateCard = await card(repo, "bob", "Private", "private"), original = (await repo.getCardVersion(privateCard.cardTemplateId, 1))!;
  await repo.saveCardDraft("bob", privateCard.cardTemplateId, 1, original.content, "public");
  assert.equal((await repo.cards().findOne({ cardTemplateId: privateCard.cardTemplateId }))!.visibility, "private");
  // A subsequent content autosave must retain pending publication intent.
  await repo.saveCardDraft("bob", privateCard.cardTemplateId, 2, original.content);
  await repo.publishCard("bob", privateCard.cardTemplateId, 3);
  assert.equal((await repo.cards().findOne({ cardTemplateId: privateCard.cardTemplateId }))!.visibility, "public");
  assert.deepEqual((await repo.getCardVersion(privateCard.cardTemplateId, 2))!.content, original.content);
});

test("bad or inaccessible memberships remain explicit without breaking valid entries or revealing private content", async () => {
  const repo = await setup(), x = await card(repo, "bob", "X", "public");
  const valid = await deck(repo, "bob", [x.cardTemplateId], "public");
  const inaccessible = await deck(repo, "bob", [], "private", "Secret title");
  await repo.ensureDeckData("alice", valid.deckTemplateId, 1);
  const sample = (await repo.getPersonalUser("alice"))!.decksData[0];
  await repo.users().updateOne({ _id: "alice" as never }, { $push: { decksData: { $each: [
    { ...sample, deckTemplateId: inaccessible.deckTemplateId }, { ...sample, deckTemplateId: "missing" },
    { ...sample, deckTemplateId: "corrupt", deckTemplateVersion: 0 },
  ] } } });
  const before = await repo.getPersonalUser("alice"), memberships = await membershipDTO(repo, "alice");
  assert.equal(memberships.length, 4);
  assert.equal(memberships[0].availability, "available");
  assert.ok(memberships.slice(1).every((entry) => entry.availability === "unavailable" && entry.display === null));
  assert.ok(!JSON.stringify(memberships).includes("Secret title"));
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
});

test("fork history is viewer-owned; canonical preview contains no personal state, authoring context or recovery receipt", async () => {
  const repo = await setup(), x = await card(repo, "bob", "X", "public"), sourceDeck = await deck(repo, "bob", [x.cardTemplateId], "public");
  await repo.ensureDeckData("alice", sourceDeck.deckTemplateId, 1);
  await repo.setReflection("alice", sourceDeck.deckTemplateId, x.cardTemplateId, "Alice private reflection");
  await repo.users().updateOne({ _id: "alice" as never }, { $set: { "cardsData.0.chats": [{ id: "chat", deckTemplateId: sourceDeck.deckTemplateId,
    comments: [{ id: "comment", creatorId: "alice", createdAt: "2026-10-07", text: "Alice private history", isRetained: true }] }],
    "cardsData.0.tests": [{ id: "test", date: "2026-10-07", result: true, createdAt: new Date() }] } });
  const source = { cardTemplateId: x.cardTemplateId, version: 1 }, ids = [randomUUID(), randomUUID(), randomUUID()], forkId = randomUUID();
  const baseline = forkCardContent((await repo.getCardVersion(x.cardTemplateId, 1))!.content, source, ids);
  await repo.createCardFork("alice", { source, cardTemplateId: forkId, stepIds: ids, context: { kind: "library" },
    content: { ...baseline, intro: { ...baseline.intro, title: "Alice canonical fork" } } });
  const draft = (await repo.cards().findOne({ cardTemplateId: forkId }))!;
  await repo.saveCardDraft("alice", forkId, 0, draft.draft!, "public"); await repo.publishCard("alice", forkId, 1);
  const forkDeck = await deck(repo, "alice", [forkId], "public");
  const authorHistory = await personalCardHistoryDTO(repo, "alice", forkId);
  assert.equal(authorHistory.segments[1].chats[0].deckTemplateId, sourceDeck.deckTemplateId);
  assert.equal(authorHistory.segments.flatMap((segment) => segment.tests).length, 1);
  for (const viewer of ["alice", "bob", null]) {
    const preview = await resolveDeckPreview(repo, forkDeck.deckTemplateId, viewer);
    assert.equal(preview.cards[0].data, null);
    assert.ok(!Object.hasOwn(preview.cards[0].root, "forkContext"));
    assert.ok(!Object.hasOwn(preview.cards[0].version, "forkPublicationReceipt"));
    assert.ok(!JSON.stringify(preview).includes("Alice private"));
  }
  await repo.ensureDeckData("bob", forkDeck.deckTemplateId, 1);
  const bobWorking = await workingDTO(repo, "bob", forkDeck.deckTemplateId);
  assert.equal(bobWorking.cards[0].reflection, "");
  assert.equal(bobWorking.cards[0].personalHistory!.length, 1);
  assert.ok(!JSON.stringify(bobWorking).includes("Alice private"));
  await repo.ensureDeckData("alice", forkDeck.deckTemplateId, 1);
  const aliceWorking = await workingDTO(repo, "alice", forkDeck.deckTemplateId);
  assert.equal(aliceWorking.cards[0].reflection, "Alice private reflection");
  assert.equal(aliceWorking.cards[0].personalHistory!.flatMap((segment) => segment.tests).length, 1);
  assert.deepEqual(aliceWorking.cards[0].chats, []);
});
