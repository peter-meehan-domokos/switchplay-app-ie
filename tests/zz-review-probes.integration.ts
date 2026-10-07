// TEMPORARY second-opinion probes. Each test asserts the CURRENT behaviour that the
// review flags as questionable, so a passing test confirms the finding.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../src/lib/cards/forks";
import { membershipDTO, workingDTO } from "../src/lib/cards/readModels";
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

test("P1 Deck visibility is NOT monotonic: saveDeckDraft can demote a public Deck and break followers' whole My Decks", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "public"); const d = await deck(repo, "bob", [x.cardTemplateId], "public");
  await repo.ensureDeckData("alice", d.deckTemplateId, 1);
  const root = (await repo.decks().findOne({ deckTemplateId: d.deckTemplateId }))!;
  await repo.saveDeckDraft("bob", d.deckTemplateId, root.revision, deckDraftContent((await repo.getDeckVersion(d.deckTemplateId, 1))!.content), "private");
  assert.equal((await repo.decks().findOne({ deckTemplateId: d.deckTemplateId }))!.visibility, "private");
  await assert.rejects(resolveWorkingDeck(repo, "alice", d.deckTemplateId), { code: "DECK_FORBIDDEN" });
  await assert.rejects(membershipDTO(repo, "alice"), { code: "DECK_FORBIDDEN" }); // entire list fails, not just one Deck
});

test("P2 visibility changes at draft save, not publication: published private Deck becomes 'public' with private Cards; preview breaks", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "private"); const d = await deck(repo, "bob", [x.cardTemplateId], "private");
  const root = (await repo.decks().findOne({ deckTemplateId: d.deckTemplateId }))!;
  await repo.saveDeckDraft("bob", d.deckTemplateId, root.revision, { ...deckDraftContent((await repo.getDeckVersion(d.deckTemplateId, 1))!.content), title: "Draft title" }, "public");
  assert.equal((await repo.decks().findOne({ deckTemplateId: d.deckTemplateId }))!.visibility, "public"); // v1 now flagged public before any publication
  await assert.rejects(resolveDeckPreview(repo, d.deckTemplateId, "alice"), { code: "CARD_FORBIDDEN" });
});

test("P3 public Deck publication bumps owned Card content revisions -> the Creator Card lane's next autosave gets STALE_REVISION", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "private");
  const before = (await repo.cards().findOne({ cardTemplateId: x.cardTemplateId }))!.revision;
  await deck(repo, "bob", [x.cardTemplateId], "public");
  await assert.rejects(repo.saveCardDraft("bob", x.cardTemplateId, before, content("Edited")), { code: "STALE_REVISION" });
});

test("P4 Library-context fork still inherits completion/signals/targetDate (but not reflection/history): partial continuity", async () => {
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
  assert.equal(forked.reflection, ""); assert.equal(forked.historySourceCardTemplateId, undefined);
});

test("P5 re-importing an archived Deck silently keeps the old adopted version while Library preview shows latest", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "public"); const y = await card(repo, "bob", "Y", "public");
  const d = await deck(repo, "bob", [x.cardTemplateId], "public");
  await repo.ensureDeckData("alice", d.deckTemplateId, 1); await repo.archiveDeckData("alice", d.deckTemplateId);
  const root = (await repo.decks().findOne({ deckTemplateId: d.deckTemplateId }))!;
  await repo.saveDeckDraft("bob", d.deckTemplateId, root.revision, { ...root.draft ?? deckDraftContent((await repo.getDeckVersion(d.deckTemplateId, 1))!.content), cards: [x, y].map((c) => ({ cardTemplateId: c.cardTemplateId })) });
  await repo.publishDeck("bob", d.deckTemplateId, root.revision + 1);
  assert.equal((await resolveDeckPreview(repo, d.deckTemplateId, "alice")).cards.length, 2);
  const data = await repo.ensureDeckData("alice", d.deckTemplateId, 2);
  assert.equal(data.deckTemplateVersion, 1); assert.equal(data.archivedAt, null);
});

test("P6 entry pins Card root latest, not the Deck version's cardVersionAtPublish (foreign Card owner can change what new followers get)", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "public");
  const carolDeck = await deck(repo, "alice", [x.cardTemplateId], "public", "Alice's deck using Bob's card");
  await repo.saveCardDraft("bob", x.cardTemplateId, 1, content("Bob rewrote this completely")); await repo.publishCard("bob", x.cardTemplateId, 2);
  await repo.users().insertOne({ _id: "dave", decksData: [], cardsData: [] } as never);
  await repo.ensureDeckData("dave", carolDeck.deckTemplateId, 1);
  const v = (await repo.getDeckVersion(carolDeck.deckTemplateId, 1))!;
  assert.equal(v.content.cards[0].cardVersionAtPublish, 1);
  assert.equal((await repo.getPersonalUser("dave"))!.cardsData[0].cardTemplateVersion, 2);
});

test("P7 self-use Deck fork: unchanged Card keeps CardData but its chats vanish from the new Deck's working view", async () => {
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
  assert.equal(adapted.cards.find((c) => c.id === y.cardTemplateId)!.chats.length, 0);
  assert.equal((await membershipDTO(repo, "alice")).filter((m) => m.archivedAt === null).length, 2); // both programmes listed
});

test("P8 one targetDate per Card across Decks: whichever Deck is opened first fixes it from that Deck's position/cadence", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "X", "public"); const y = await card(repo, "bob", "Y", "public");
  const a = await deck(repo, "bob", [x.cardTemplateId], "public", "A"); const b = await deck(repo, "bob", [y.cardTemplateId, x.cardTemplateId], "public", "B");
  await repo.ensureDeckData("alice", a.deckTemplateId, 1); await repo.ensureDeckData("alice", b.deckTemplateId, 1);
  await repo.openWorkingDeck("alice", b.deckTemplateId, "2026-10-07");
  await repo.openWorkingDeck("alice", a.deckTemplateId, "2026-10-07");
  const xa = (await workingDTO(repo, "alice", a.deckTemplateId)).cards[0];
  assert.equal(xa.targetDate, "2026-10-21"); // B position 2 (14 days), not A position 1 (2026-10-14)
});

test("P9 Copy into a clean public Deck auto-publishes and irreversibly makes a private Card public, with no confirmation", async () => {
  const repo = await setup(); const z = await card(repo, "alice", "Private note-to-self", "private"); const other = await card(repo, "alice", "Shared", "public");
  const d = await deck(repo, "alice", [other.cardTemplateId], "public");
  const dest = (await copyDestinations(repo, "alice", z.cardTemplateId, "none")).find((x) => x.deckTemplateId === d.deckTemplateId)!;
  const result = await repo.copyOwnedCard("alice", z.cardTemplateId, { deckTemplateId: dest.deckTemplateId, revision: dest.revision, contentHash: dest.contentHash });
  assert.equal(result.outcome, "published");
  assert.equal((await repo.cards().findOne({ cardTemplateId: z.cardTemplateId }))!.visibility, "public");
});
