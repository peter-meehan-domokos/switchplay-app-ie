import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { CardArchitectureError } from "../src/lib/cards/domain";
import { creatorDTO, creatorCardDTO } from "../src/lib/cards/readModels";
import { jsonDTO } from "../src/lib/cards/http";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { deckDraftContent } from "../src/lib/cards/publicationRules";
import { libraryCollection, libraryDetail } from "../src/lib/cards/libraryReadModels";
import { resolveHistoricalDeck } from "../src/lib/cards/resolvers";
import { assertCardVersionAccess } from "../src/lib/cards/versionAccess";
import { CreatorPersistenceCoordinator, CreatorRequestError, type CreatorTransport } from "../src/components/creator/creatorPersistenceCoordinator";
import { blankPrivateBoard, creatorBoard } from "../src/components/creator/cardArchitectureAdapter";
import type { CardContent, DeckContent, DeckPublicationReview, Visibility } from "../src/lib/cards/model";

let server: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
async function setup() {
  const repo = new CardRepository(client.db(`switchplay_test_creator_visibility_${sequence++}`), client); await createFoundationIndexes(repo.db);
  await repo.users().insertMany(["alice", "bob"].map((_id) => ({ _id, username: _id, decksData: [], cardsData: [] }))); return repo;
}
const ids = () => [randomUUID(), randomUUID(), randomUUID()];
async function fixture(repo: CardRepository, published = false) {
  const deckId = randomUUID(), cardId = randomUUID(), card = createDefaultCardContent(ids()); card.intro.title = "Useful Card";
  const content = { ...createDefaultDeckContent(ids()), title: "Useful programme", cards: [{ cardTemplateId: cardId }] };
  await repo.createPrivateGraph("alice", deckId, content, [{ cardTemplateId: cardId, content: card }]);
  if (published) { await repo.publishCard("alice", cardId, 0); await repo.publishDeck("alice", deckId, 0); }
  return { deckId, cardId, coordinator: new CreatorPersistenceCoordinator(creatorBoard(await creatorDTO(repo, "alice", deckId)), await creatorDTO(repo, "alice", deckId), transport(repo)) };
}
// Matches the existing route contracts, including Deck receipt normalization.
function transport(repo: CardRepository, intercept?: (url: string, method: string, before: boolean) => Promise<void>): CreatorTransport {
  return async <T>(url: string, method = "GET", body?: unknown): Promise<T> => {
    const data = body as { revision: number; content: CardContent & DeckContent; visibility: Visibility; type: string; updateNote?: string; review: DeckPublicationReview; acceptCardDrafts: boolean; deckTemplateId: string; cardTemplateId: string; stepIds: string[]; cards: { cardTemplateId: string; content: CardContent }[] };
    try {
      await intercept?.(url, method, true); const parsed = new URL(url, "http://local.invalid"), path = parsed.pathname;
      let result: unknown;
      if (path.includes("card-templates")) {
        const id = path.split("/").at(-1)!;
        if (method === "PATCH") {
          if (data.type === "save") await repo.saveCardDraft("alice", id, data.revision, data.content, data.visibility);
          else await repo.publishCard("alice", id, data.revision, data.updateNote);
        }
        result = parsed.searchParams.has("version") ? jsonDTO(await repo.getCardVersion(id, Number(parsed.searchParams.get("version")))) : await creatorCardDTO(repo, "alice", id);
      } else if (path === "/api/deck-templates") {
        await repo.createPrivateGraph("alice", data.deckTemplateId, data.content, data.cards); result = await creatorDTO(repo, "alice", data.deckTemplateId);
      } else {
        const id = path.split("/")[3];
        if (path.endsWith("/cards")) result = jsonDTO(await repo.createAndAttachCard("alice", {
          deckTemplateId: id, expectedDeckRevision: data.revision, cardTemplateId: data.cardTemplateId, stepIds: data.stepIds, nextDeckContent: data.content,
        }));
        if (path.endsWith("/saved")) await repo.saveDeckDraft("alice", id, data.revision, data.content, data.visibility);
        if (path.endsWith("/publish")) {
          if (method === "POST") await repo.publishDeck("alice", id, data.revision, data.updateNote, { review: data.review, acceptCardDrafts: data.acceptCardDrafts });
          else if (parsed.searchParams.has("version")) {
            const version = (await repo.getDeckVersion(id, Number(parsed.searchParams.get("version"))))!;
            result = jsonDTO({ ...version, content: deckDraftContent(version.content) });
          } else result = await repo.prepareDeckPublication("alice", id, Number(parsed.searchParams.get("revision")));
        }
        result ??= await creatorDTO(repo, "alice", id);
      }
      await intercept?.(url, method, false); return result as T;
    } catch (error) {
      if (error instanceof CardArchitectureError) throw new CreatorRequestError(error.code.includes("REVISION") || error.code.includes("CONFLICT") ? 409 : 400, error.code);
      throw error;
    }
  };
}

test("real Creator visibility autosave persists intent but no published access or personal data; public Card precedes Deck", async () => {
  const repo = await setup(), { deckId, cardId, coordinator: c } = await fixture(repo);
  c.setCardVisibility(cardId, "public"); c.setDeckVisibility("public"); await c.prepareToNavigate();
  assert.equal((await repo.cards().findOne({ cardTemplateId: cardId }))!.visibility, "private");
  assert.equal((await repo.decks().findOne({ deckTemplateId: deckId }))!.visibility, "private");
  assert.deepEqual((await libraryCollection(repo, "bob")).entries, []);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []); assert.deepEqual((await repo.getPersonalUser("alice"))!.decksData, []);
  const counts: number[] = [];
  assert.equal(await c.publishAndLeave({}, async () => true, async (review) => { counts.push(review.cards.length, Number(!!review.deck)); return true; }), true);
  assert.deepEqual(counts, [1, 1]);
  const preview = await libraryDetail(repo, "bob", deckId); assert.equal(preview.availability, "available");
  if (preview.availability === "available") assert.deepEqual(preview.manifest, { deckTemplateId: deckId, deckVersion: 1, cards: [{ cardTemplateId: cardId, version: 1 }] });
  assert.deepEqual((await repo.getPersonalUser("alice"))!.decksData, []); assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []);
});

test("private-era Deck and Card versions stay private after visibility-only public publication; personal state is preserved", async () => {
  const repo = await setup(), { deckId, cardId, coordinator: c } = await fixture(repo, true);
  const source = (await repo.getCardVersion(cardId, 1))!;
  await repo.setCompletion("alice", deckId, cardId, source.content.steps[0].stepId, "skipped");
  await repo.setSignalReading("alice", deckId, cardId, source.content.steps[0].stepId, 7);
  const oldCard = await repo.getCardVersion(cardId, 1), oldDeck = await repo.getDeckVersion(deckId, 1);
  c.setCardVisibility(cardId, "public"); c.setDeckVisibility("public"); await c.flushAll();
  await assert.rejects(libraryDetail(repo, "bob", deckId));
  assert.equal(await c.publishAndLeave({}, async () => true, async () => true), true);
  assert.deepEqual(await repo.getCardVersion(cardId, 1), oldCard); assert.deepEqual(await repo.getDeckVersion(deckId, 1), oldDeck);
  await assert.rejects(resolveHistoricalDeck(repo, deckId, 1, "bob"), { code: "DECK_VERSION_FORBIDDEN" });
  assert.throws(() => assertCardVersionAccess("bob", c.cards.get(cardId)!.ack!.root, oldCard!), { code: "CARD_VERSION_FORBIDDEN" });
  const personal = (await repo.getPersonalUser("alice"))!.cardsData[0];
  assert.equal(personal.items[0].completionStatus, "skipped"); assert.equal(personal.signalReadings[0].reading, 7);
  await assert.rejects(repo.saveCardDraft("alice", cardId, c.cards.get(cardId)!.ack!.root.revision, c.cards.get(cardId)!.desired, "private"), { code: "PUBLIC_VISIBILITY_PERMANENT" });
  await assert.rejects(repo.saveDeckDraft("alice", deckId, c.deck.ack!.root.revision, c.deck.desired, "private"), { code: "PUBLIC_VISIBILITY_PERMANENT" });
});

test("public Deck staging does not promote private Card; failed publication changes neither canonical visibility nor Card revision", async () => {
  const repo = await setup(), { deckId, cardId, coordinator: c } = await fixture(repo, true); c.setDeckVisibility("public"); await c.flushAll();
  const before = await repo.cards().findOne({ cardTemplateId: cardId });
  await assert.rejects(c.publishAndLeave({}, async () => true, async () => true), /PRIVATE_CARDS_BLOCK_PUBLIC_DECK/);
  assert.deepEqual(await repo.cards().findOne({ cardTemplateId: cardId }), before); assert.equal((await repo.decks().findOne({ deckTemplateId: deckId }))!.visibility, "private");
  assert.equal(await repo.deckVersions().countDocuments({ deckTemplateId: deckId }), 1);
});

test("lost visibility-save and public-publication responses recover through actual repositories without duplicate immutable versions", async () => {
  const repo = await setup(), { deckId, cardId } = await fixture(repo); const dto = await creatorDTO(repo, "alice", deckId);
  const lost = new Set<string>();
  const c = new CreatorPersistenceCoordinator(creatorBoard(dto), dto, transport(repo, async (url, method, before) => {
    if (!before && (method === "PATCH" || method === "POST") && !lost.has(url)) { lost.add(url); throw new Error("response lost after commit"); }
  }));
  c.setDeckVisibility("public"); c.setCardVisibility(cardId, "public");
  // Separate save and publication on the Card share an endpoint; lose the save
  // once, then explicitly lose the Deck publication as well.
  assert.equal(await c.publishAndLeave({}, async () => true, async () => true), true);
  assert.equal(await repo.cardVersions().countDocuments({ cardTemplateId: cardId }), 1); assert.equal(await repo.deckVersions().countDocuments({ deckTemplateId: deckId }), 1);
  assert.equal(await c.publishAndLeave({}, async () => true, async () => { throw new Error("must not re-confirm"); }), true);
});

test("unsaved Deck visibility persists on its stable identity and can reopen without creating membership", async () => {
  const repo = await setup(), board = blankPrivateBoard(); const c = new CreatorPersistenceCoordinator(board, null, transport(repo));
  c.setDeckVisibility("public"); await c.prepareToNavigate();
  const dto = await creatorDTO(repo, "alice", board.deckTemplateId); const reopened = new CreatorPersistenceCoordinator(creatorBoard(dto), dto, transport(repo));
  assert.equal(reopened.deck.desiredVisibility, "public"); assert.equal(reopened.deck.dirty, false); assert.equal(dto.root.visibility, "private");
  assert.equal(await repo.deckVersions().countDocuments(), 0); assert.deepEqual((await repo.getPersonalUser("alice"))!.decksData, []);
});

test("visibility and content edited immediately after Add wait behind the same creation identity", async () => {
  const repo = await setup(), { deckId } = await fixture(repo); const dto = await creatorDTO(repo, "alice", deckId);
  let release!: () => void; const held = new Promise<void>((resolve) => { release = resolve; });
  const c = new CreatorPersistenceCoordinator(creatorBoard(dto), dto, transport(repo, async (url, _method, before) => { if (before && url.endsWith("/cards")) await held; }));
  const cardId = randomUUID(); c.addCard(cardId, ids(), { ...c.deck.desired, cards: [...c.deck.desired.cards, { cardTemplateId: cardId }] });
  c.setCardVisibility(cardId, "public"); c.editCard(cardId, { ...c.cards.get(cardId)!.desired, intro: { title: "Immediate edit", description: null, mediaItem: null } });
  assert.equal(await repo.cards().countDocuments({ cardTemplateId: cardId }), 0); release(); await c.flushAll();
  const root = (await repo.cards().findOne({ cardTemplateId: cardId }))!;
  assert.equal(root.revision, 1); assert.equal(root.draftVisibility, "public"); assert.equal(root.visibility, "private"); assert.equal(root.draft!.intro.title, "Immediate edit");
  assert.equal(c.deck.ack!.content.cards.filter((ref) => ref.cardTemplateId === cardId).length, 1);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []);
});
