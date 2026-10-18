// Permanent regressions replacing Claude's temporary R1–R6 round-two probes.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../src/lib/cards/forks";
import { membershipDTO, workingDTO, personalCardHistoryDTO } from "../src/lib/cards/readModels";
import type { CardContent, Visibility } from "../src/lib/cards/model";
import type { MediaItem } from "../src/lib/media";
import { resolveDeckPreview, resolveHistoricalDeck } from "../src/lib/cards/resolvers";
import { deckDraftContent } from "../src/lib/cards/publicationRules";

let server: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
async function setup() {
  const repo = new CardRepository(client.db(`switchplay_test_probe2_${sequence++}`), client); await createFoundationIndexes(repo.db);
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
async function libraryFork(repo: CardRepository, actor: string, sourceId: string, version: number, title: string) {
  const source = (await repo.getCardVersion(sourceId, version))!; const ref = { cardTemplateId: sourceId, version };
  const stepIds = [randomUUID(), randomUUID(), randomUUID()], base = forkCardContent(source.content, ref, stepIds), id = randomUUID();
  await repo.createCardFork(actor, { source: ref, cardTemplateId: id, stepIds, context: { kind: "library" }, content: { ...base, intro: { ...base.intro, title } } });
  await repo.publishCard(actor, id, 0); return id;
}
// Alice follows Bob's public Deck D containing X and has personal media on X.
async function followingWithMedia(repo: CardRepository) {
  const x = await card(repo, "bob", "X", "public"), d = await deck(repo, "bob", [x.cardTemplateId], "public");
  await repo.ensureDeckData("alice", d.deckTemplateId, 1); await repo.openWorkingDeck("alice", d.deckTemplateId, "2026-10-07");
  const media: MediaItem = { id: "selfie-video", mediaType: "image", src: "https://example.invalid/alice.jpg", description: "Alice's evidence" };
  await repo.users().updateOne({ _id: "alice" as never }, { $set: { "cardsData.0.mediaItems": [media] } });
  return { x, d };
}

test("R1 foreign access and forks reject private-era and unclassified versions after public promotion", async () => {
  const repo = await setup(); const x = await card(repo, "bob", "Secret v1 notes", "private");
  const original = (await repo.getCardVersion(x.cardTemplateId, 1))!.content;
  const d = await deck(repo, "bob", [x.cardTemplateId], "private");
  await repo.saveCardDraft("bob", x.cardTemplateId, 1, { ...original, intro: { ...original.intro, title: "Public v2" } }, "public"); await repo.publishCard("bob", x.cardTemplateId, 2);
  await repo.saveDeckDraft("bob", d.deckTemplateId, 1, d.draft!, "public"); await repo.publishDeck("bob", d.deckTemplateId, 2);
  assert.equal((await repo.getCardVersion(x.cardTemplateId, 1))!.visibility, "private");
  await assert.rejects(libraryFork(repo, "alice", x.cardTemplateId, 1, "Private-era fork"), { code: "CARD_VERSION_FORBIDDEN" });
  await assert.rejects(repo.ensureCardData("alice", x.cardTemplateId, 1), { code: "CARD_VERSION_FORBIDDEN" });
  await assert.rejects(resolveHistoricalDeck(repo, d.deckTemplateId, 1, "alice"), { code: "DECK_VERSION_FORBIDDEN" });
  assert.equal((await resolveHistoricalDeck(repo, d.deckTemplateId, 1, "bob")).cards[0].version.version, 1);
  assert.equal((await resolveDeckPreview(repo, d.deckTemplateId, "alice")).cards[0].version.version, 2);
  assert.ok(await libraryFork(repo, "bob", x.cardTemplateId, 1, "Owner private-era fork"));
  assert.ok(await libraryFork(repo, "alice", x.cardTemplateId, 2, "Public fork"));
  await repo.cardVersions().updateOne({ cardTemplateId: x.cardTemplateId, version: 1 }, { $unset: { visibility: "" } });
  await assert.rejects(libraryFork(repo, "alice", x.cardTemplateId, 1, "Unknown visibility"), { code: "CARD_VERSION_FORBIDDEN" });
  assert.equal((await resolveHistoricalDeck(repo, d.deckTemplateId, 1, "bob")).cards[0].version.version, 1);
});

test("R1 private-era update notes and corrupted private-era adoption cannot disclose canonical history", async () => {
  const repo = await setup(), c = await card(repo, "bob", "Private", "private");
  const base = (await repo.getCardVersion(c.cardTemplateId, 1))!.content;
  await repo.saveCardDraft("bob", c.cardTemplateId, 1, { ...base, intro: { ...base.intro, title: "Still private" } });
  await repo.publishCard("bob", c.cardTemplateId, 2, "Private note");
  await repo.saveCardDraft("bob", c.cardTemplateId, 3, { ...base, intro: { ...base.intro, title: "Public" } }, "public");
  await repo.publishCard("bob", c.cardTemplateId, 4, "Public note");
  assert.deepEqual(await repo.cardUpdateNotes("alice", c.cardTemplateId, 1), [{ version: 3, updateNote: "Public note" }]);
  assert.deepEqual(await repo.cardUpdateNotes("bob", c.cardTemplateId, 1), [{ version: 2, updateNote: "Private note" }, { version: 3, updateNote: "Public note" }]);
  const d = await deck(repo, "bob", [c.cardTemplateId], "public");
  await repo.ensureDeckData("alice", d.deckTemplateId, 1);
  await repo.users().updateOne({ _id: "alice" as never }, { $set: { "cardsData.0.cardTemplateVersion": 1 } });
  await assert.rejects(workingDTO(repo, "alice", d.deckTemplateId), { code: "CARD_VERSION_FORBIDDEN" });
  await assert.rejects(repo.openWorkingDeck("alice", d.deckTemplateId, "2026-10-07"), { code: "CARD_VERSION_FORBIDDEN" });
  await assert.rejects(repo.setCompletion("alice", d.deckTemplateId, c.cardTemplateId, base.steps[0].stepId, "done"), { code: "CARD_VERSION_FORBIDDEN" });
  assert.equal((await membershipDTO(repo, "alice"))[0].unavailableReason, "CARD_VERSION_FORBIDDEN");
  assert.equal((await repo.getPersonalUser("alice"))!.decksData.length, 1);
});

test("Deck private-era and unclassified versions cannot be viewed, adopted or forked after promotion, even with public Cards", async () => {
  const repo = await setup(), c = await card(repo, "bob", "Public Card", "public");
  const d = await deck(repo, "bob", [c.cardTemplateId], "private", "Private programme notes");
  const privateVersion = (await repo.getDeckVersion(d.deckTemplateId, 1))!;
  await repo.saveDeckDraft("bob", d.deckTemplateId, 1, { ...d.draft!, title: "Public programme" }, "public");
  await repo.publishDeck("bob", d.deckTemplateId, 2);
  assert.deepEqual(await repo.getDeckVersion(d.deckTemplateId, 1), privateVersion);
  const fork = (actor: string, version: number) => repo.createDeckFork(actor, { source: { deckTemplateId: d.deckTemplateId, version },
    deckTemplateId: randomUUID(), context: { kind: "library" }, content: { ...deckDraftContent(privateVersion.content), title: "Adapted" } });
  const before = await repo.getPersonalUser("alice");
  for (const actor of ["alice", null]) await assert.rejects(resolveHistoricalDeck(repo, d.deckTemplateId, 1, actor), { code: "DECK_VERSION_FORBIDDEN" });
  await assert.rejects(fork("alice", 1), { code: "DECK_VERSION_FORBIDDEN" });
  const cardForkId = randomUUID(), stepIds = [randomUUID(), randomUUID(), randomUUID()];
  const cardSource = { cardTemplateId: c.cardTemplateId, version: 1 }, copiedCard = forkCardContent((await repo.getCardVersion(c.cardTemplateId, 1))!.content, cardSource, stepIds);
  await assert.rejects(repo.createDeckFork("alice", { source: { deckTemplateId: d.deckTemplateId, version: 1 }, deckTemplateId: randomUUID(),
    context: { kind: "library" }, content: { ...deckDraftContent(privateVersion.content), title: "Combined" },
    cardFork: { source: cardSource, cardTemplateId: cardForkId, stepIds, context: { kind: "library" }, content: { ...copiedCard, intro: { ...copiedCard.intro, title: "Edited" } } },
  }), { code: "DECK_VERSION_FORBIDDEN" });
  assert.equal(await repo.cards().findOne({ cardTemplateId: cardForkId }), null);
  await assert.rejects(repo.ensureDeckData("alice", d.deckTemplateId, 1), { code: "DECK_VERSION_FORBIDDEN" });
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  assert.equal((await resolveHistoricalDeck(repo, d.deckTemplateId, 1, "bob")).version.content.title, "Private programme notes");
  assert.ok(await fork("bob", 1));
  assert.equal((await resolveDeckPreview(repo, d.deckTemplateId, "alice")).version.version, 2);
  assert.ok(await fork("alice", 2));
  await repo.ensureDeckData("alice", d.deckTemplateId, 2);
  const personal = await repo.getPersonalUser("alice");
  // Corrupt/legacy personal pointers must not bypass immutable-version privacy.
  await repo.users().updateOne({ _id: "alice" as never }, { $set: { "decksData.0.deckTemplateVersion": 1 } });
  await assert.rejects(workingDTO(repo, "alice", d.deckTemplateId), { code: "DECK_VERSION_FORBIDDEN" });
  await assert.rejects(repo.openWorkingDeck("alice", d.deckTemplateId, "2026-10-07"), { code: "DECK_VERSION_FORBIDDEN" });
  await assert.rejects(repo.setReflection("alice", d.deckTemplateId, c.cardTemplateId, "Must not save"), { code: "DECK_VERSION_FORBIDDEN" });
  await assert.rejects(repo.createCardFork("alice", { source: cardSource, cardTemplateId: cardForkId, stepIds,
    context: { kind: "my-decks", deckTemplateId: d.deckTemplateId }, content: { ...copiedCard, intro: { ...copiedCard.intro, title: "Edited" } },
  }), { code: "DECK_VERSION_FORBIDDEN" });
  assert.equal((await membershipDTO(repo, "alice"))[0].unavailableReason, "DECK_VERSION_FORBIDDEN");
  await repo.archiveDeckData("alice", d.deckTemplateId);
  await assert.rejects(repo.ensureDeckData("alice", d.deckTemplateId, 2), { code: "DECK_VERSION_FORBIDDEN" });
  assert.notEqual((await repo.getPersonalUser("alice"))!.decksData[0].archivedAt, null);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, personal!.cardsData);
  await repo.deckVersions().updateOne({ deckTemplateId: d.deckTemplateId, version: 1 }, { $unset: { visibility: "" } });
  await assert.rejects(resolveHistoricalDeck(repo, d.deckTemplateId, 1, "alice"), { code: "DECK_VERSION_FORBIDDEN" });
  await assert.rejects(fork("alice", 1), { code: "DECK_VERSION_FORBIDDEN" });
  assert.equal((await resolveHistoricalDeck(repo, d.deckTemplateId, 1, "bob")).version.version, 1);
  assert.ok(await fork("bob", 1));
  // Even latest preview fails closed if visibility cannot be proven.
  await repo.deckVersions().updateOne({ deckTemplateId: d.deckTemplateId, version: 2 }, { $unset: { visibility: "" } });
  await assert.rejects(resolveDeckPreview(repo, d.deckTemplateId, "alice"), { code: "DECK_VERSION_FORBIDDEN" });
  assert.equal((await resolveDeckPreview(repo, d.deckTemplateId, "bob")).version.version, 2);
});

test("R2 owner deletes one source-stored personal item across descendants even without active source membership", async () => {
  const repo = await setup(); const { x, d } = await followingWithMedia(repo);
  const canonical = await repo.getCardVersion(x.cardTemplateId, 1);
  const video: MediaItem = { id: "personal-video", mediaType: "video", provider: "cloudflare-stream", assetId: "personal-uid",
    src: "https://example.invalid/personal.m3u8", description: "Alice's personal video" };
  await repo.users().updateOne({ _id: "alice" as never }, { $push: { "cardsData.0.mediaItems": video } });
  const forkId = await libraryFork(repo, "alice", x.cardTemplateId, 1, "Mine");
  const e = await deck(repo, "alice", [forkId], "private", "My adapted programme"); // first private publication enters My Decks
  await repo.archiveDeckData("alice", d.deckTemplateId);
  assert.deepEqual(await repo.personalMedia("alice", x.cardTemplateId), (await repo.getPersonalUser("alice"))!.cardsData[0].mediaItems);
  await assert.rejects(repo.personalMedia("bob", x.cardTemplateId), { code: "PERSONAL_MEDIA_FORBIDDEN" });
  const shown = (await workingDTO(repo, "alice", e.deckTemplateId)).cards[0].personalHistory!.flatMap((s) => s.mediaItems);
  assert.equal(shown.length, 2); // Two source-stored items, not copied to the fork.
  const sibling = await libraryFork(repo, "alice", x.cardTemplateId, 1, "Sibling");
  const descendant = await libraryFork(repo, "alice", forkId, 1, "Descendant");
  await assert.rejects(repo.removePersonalMedia("bob", x.cardTemplateId, "selfie-video"), { code: "PERSONAL_MEDIA_FORBIDDEN" });
  assert.deepEqual(await repo.removePersonalMedia("alice", x.cardTemplateId, "selfie-video"), [video]);
  assert.deepEqual(await repo.removePersonalMedia("alice", x.cardTemplateId, "selfie-video"), [video]); // Lost-response retry.
  assert.deepEqual(await repo.removePersonalMedia("alice", x.cardTemplateId, video.id), []);
  for (const id of [x.cardTemplateId, forkId, sibling, descendant]) {
    assert.equal((await personalCardHistoryDTO(repo, "alice", id)).segments.flatMap((s) => s.mediaItems).length, 0);
  }
  assert.equal((await workingDTO(repo, "alice", e.deckTemplateId)).cards[0].personalHistory!.flatMap((s) => s.mediaItems).length, 0);
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData.find((data) => data.cardTemplateId === forkId)!.mediaItems.length, 0);
  assert.deepEqual(await repo.getCardVersion(x.cardTemplateId, 1), canonical); // No canonical/template-media mutation.
});

test("R3 malformed source items do not disable current or descendant Decks; valid history survives", async () => {
  const repo = await setup(); const { x, d } = await followingWithMedia(repo);
  const forkId = await libraryFork(repo, "alice", x.cardTemplateId, 1, "Mine");
  const e = await deck(repo, "alice", [forkId], "private", "My adapted programme");
  // e.g. a test timestamp that went through JSON or a hand-repair as a string
  await repo.users().updateOne({ _id: "alice" as never }, { $set: { "cardsData.0.tests": [null,
    { id: "invalid", date: "2026-10-07", result: true, createdAt: "garbage" },
    { id: "t", date: "2026-10-07", result: true, createdAt: "2026-10-07T10:00:00Z" }],
    "cardsData.0.chats": [null, { id: "valid-chat", deckTemplateId: d.deckTemplateId, comments: [null,
      { id: "comment", creatorId: "alice", createdAt: "2026-10-07", text: "Still visible", isRetained: true }] }],
    "cardsData.0.mediaItems": [null, ...(await repo.getPersonalUser("alice"))!.cardsData[0].mediaItems, { id: "bad" }],
  } });
  const list = await membershipDTO(repo, "alice");
  assert.ok(list.every((m) => m.availability === "available"));
  for (const id of [e.deckTemplateId, d.deckTemplateId]) {
    const shown = (await workingDTO(repo, "alice", id)).cards[0];
    assert.equal(shown.personalHistory!.flatMap((s) => s.tests).length, 1);
    assert.equal(shown.personalHistory!.flatMap((s) => s.chats)[0].comments.length, 1);
    assert.equal(shown.personalHistory!.flatMap((s) => s.mediaItems).length, 1);
  }
});

test("R4 sibling forks intentionally each project their shared source's stored-once history", async () => {
  const repo = await setup(); const { x } = await followingWithMedia(repo);
  const a = await libraryFork(repo, "alice", x.cardTemplateId, 1, "Variant A"), b = await libraryFork(repo, "alice", x.cardTemplateId, 1, "Variant B");
  for (const id of [a, b]) {
    const history = await personalCardHistoryDTO(repo, "alice", id);
    assert.equal(history.segments.flatMap((s) => s.mediaItems).length, 1);
  }
});

test("R5 inherited personal CardData intentionally survives without target Deck membership", async () => {
  const repo = await setup(); const { x } = await followingWithMedia(repo);
  const forkId = await libraryFork(repo, "alice", x.cardTemplateId, 1, "Something new for my athletes");
  const user = (await repo.getPersonalUser("alice"))!;
  assert.ok(user.cardsData.some((c) => c.cardTemplateId === forkId));
  assert.ok(!user.decksData.some((dd) => dd.deckTemplateId !== user.decksData[0].deckTemplateId));
});

test("R6 inherited personal commitment intentionally takes precedence over a new Deck cadence", async () => {
  const repo = await setup(); const { x } = await followingWithMedia(repo);
  const inherited = (await repo.getPersonalUser("alice"))!.cardsData[0].targetDate; // set from Bob's Deck cadence
  const forkId = await libraryFork(repo, "alice", x.cardTemplateId, 1, "Mine");
  const e = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Monthly plan", cadence: { intervalDays: 30 }, cards: [{ cardTemplateId: forkId }] });
  await repo.publishDeck("alice", e.deckTemplateId, 0); await repo.openWorkingDeck("alice", e.deckTemplateId, "2027-01-01");
  assert.equal((await workingDTO(repo, "alice", e.deckTemplateId)).cards[0].targetDate, inherited); // not 2027-01-31
});
