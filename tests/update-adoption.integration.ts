import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient, type Collection, type Document } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { deckDraftContent } from "../src/lib/cards/publicationRules";
import { workingDTO } from "../src/lib/cards/readModels";
import type { CardContent, DeckContent } from "../src/lib/cards/model";
import type { UpdateCommand } from "../src/lib/cards/updateAdoption";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
async function card(repo: CardRepository) {
  const content = { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: "Practice", description: "", mediaItem: null } };
  const root = await repo.createCardDraft("bob", content, "public"); await repo.publishCard("bob", root.cardTemplateId, 0); return root.cardTemplateId;
}
async function deck(repo: CardRepository, ids: string[]) {
  const root = await repo.createDeckDraft("bob", { ...createDefaultDeckContent([]), title: "Programme", cards: ids.map((cardTemplateId) => ({ cardTemplateId })) }, "public");
  await repo.publishDeck("bob", root.deckTemplateId, 0); return root.deckTemplateId;
}
async function fixture() {
  const repo = new CardRepository(client.db(`switchplay_test_updates_${sequence++}`), client); await createFoundationIndexes(repo.db);
  await repo.users().insertMany(["alice", "bob", "carol"].map((_id) => ({ _id, decksData: [], cardsData: [] })));
  const ids = [await card(repo), await card(repo)], id = await deck(repo, ids);
  await repo.ensureDeckData("alice", id, 1); return { repo, ids, id };
}
async function cardPublication(repo: CardRepository, id: string, note?: string, edit?: (content: CardContent) => CardContent) {
  const root = (await repo.cards().findOne({ cardTemplateId: id }))!, content = (await repo.getCardVersion(id, root.latestVersion))!.content;
  await repo.saveCardDraft("bob", id, root.revision, edit ? edit(content) : { ...content, intro: { ...content.intro, title: `Practice v${root.latestVersion + 1}` } });
  await repo.publishCard("bob", id, root.revision + 1, note);
}
async function deckPublication(repo: CardRepository, id: string, note?: string, edit?: (content: DeckContent) => DeckContent) {
  const root = (await repo.decks().findOne({ deckTemplateId: id }))!, content = deckDraftContent((await repo.getDeckVersion(id, root.latestVersion))!.content);
  await repo.saveDeckDraft("bob", id, root.revision, edit ? edit(content) : { ...content, title: `Programme v${root.latestVersion + 1}` });
  await repo.publishDeck("bob", id, root.revision + 1, note);
}
async function review(repo: CardRepository, kind: UpdateCommand["kind"], id: string) { const result = await repo.reviewUpdate("alice", kind, id); assert.ok(result.review); return result.review!; }
async function personalState(repo: CardRepository, id: string) {
  await repo.users().updateOne({ _id: "alice" }, { $set: {
    "cardsData.$[card].items.0.completionStatus": "skipped", "cardsData.$[card].items.1.completionStatus": "done", "cardsData.$[card].signalReadings.0.reading": 6.42,
    "cardsData.$[card].reflection": "Keep my reflection", "cardsData.$[card].targetDate": "2027-02-03", "cardsData.$[card].historySourceCardTemplateId": "earlier-personal-source",
    "cardsData.$[card].mediaItems": [{ id: "media", description: "Keep", mediaType: "image", src: "https://example.test/my.png" }],
    "cardsData.$[card].chats": [{ id: "chat", deckTemplateId: "original-context", comments: [] }], "cardsData.$[card].tests": [{ id: "test", result: true, date: "2026-10-10", createdAt: new Date() }],
  } }, { arrayFilters: [{ "card.cardTemplateId": id }] });
}
function pauseGuard(repo: CardRepository, collectionKind: "cards" | "decks" = "cards") {
  const adopting = new CardRepository(repo.db, client);
  let enter!: () => void, release!: () => void, once = true;
  const entered = new Promise<void>((resolve) => { enter = resolve; }), resumed = new Promise<void>((resolve) => { release = resolve; });
  function intercept<T extends Document>(collection: Collection<T>) {
    const update = collection.updateOne.bind(collection);
    collection.updateOne = async (...args: Parameters<typeof update>) => {
      if (once && !Array.isArray(args[1]) && args[1].$inc) { once = false; enter(); await resumed; } return update(...args);
    };
    return collection;
  }
  if (collectionKind === "cards") { const collection = intercept(adopting.cards()); adopting.cards = () => collection; }
  else { const collection = intercept(adopting.decks()); adopting.decks = () => collection; }
  return { adopting, entered, release };
}

test("reviews are read-only, skip blank notes, gather chronological intervening notes and never return canonical drafts or personal state", async () => {
  const { repo, id, ids } = await fixture(); const before = await repo.getPersonalUser("alice");
  assert.deepEqual(await repo.reviewUpdate("alice", "card", ids[0]), { viewerUserId: "alice", review: null });
  await cardPublication(repo, ids[0], " Second "); await cardPublication(repo, ids[0], " "); await cardPublication(repo, ids[0], "Fourth");
  await deckPublication(repo, id, "Second deck"); await deckPublication(repo, id, " "); await deckPublication(repo, id, "Fourth deck");
  const c = await review(repo, "card", ids[0]), d = await review(repo, "deck", id);
  assert.deepEqual(c.notes, [{ version: 2, updateNote: "Second" }, { version: 4, updateNote: "Fourth" }]);
  assert.deepEqual(d.notes, [{ version: 2, updateNote: "Second deck" }, { version: 4, updateNote: "Fourth deck" }]);
  assert.deepEqual(Object.keys(c).sort(), ["command", "notes", "title"]); assert.deepEqual(await repo.getPersonalUser("alice"), before);
});

test("Card Update preserves all current state and history, continuing stable Steps globally, while Deck adoption and immutable versions stay unchanged", async () => {
  const { repo, id, ids } = await fixture(), other = await deck(repo, [ids[0]]); await repo.ensureDeckData("alice", other, 1); await personalState(repo, ids[0]);
  const before = (await repo.getPersonalUser("alice"))!, immutable = await repo.getDeckVersion(id, 1), root = (await repo.cards().findOne({ cardTemplateId: ids[0] }))!;
  await cardPublication(repo, ids[0], "Reworded", (c) => ({ ...c, steps: [...c.steps].reverse().map((s) => ({ ...s, description: "New wording" })) }));
  const authoring = (await repo.cards().findOne({ cardTemplateId: ids[0] }))!, command = (await review(repo, "card", ids[0])).command;
  const result = await repo.adoptUpdate("alice", command); assert.equal(result.outcome, "updated"); assert.equal(result.adoptedVersion, 2);
  const after = (await repo.getPersonalUser("alice"))!, changed = after.cardsData.find((c) => c.cardTemplateId === ids[0])!, original = before.cardsData.find((c) => c.cardTemplateId === ids[0])!;
  assert.deepEqual({ ...changed, cardTemplateVersion: 1, updatedAt: original.updatedAt }, original); assert.deepEqual(after.decksData, before.decksData);
  assert.equal((await workingDTO(repo, "alice", id)).cards[0].adoptedVersion, 2); assert.equal((await workingDTO(repo, "alice", other)).cards[0].adoptedVersion, 2);
  assert.deepEqual(await repo.getDeckVersion(id, 1), immutable); assert.equal((await repo.cards().findOne({ cardTemplateId: ids[0] }))!.revision, authoring.revision);
  assert.equal(authoring.revision, root.revision + 2); assert.deepEqual((await repo.getPersonalUser("bob"))!.cardsData, []);
});

test("Deck Update changes composition independently, chooses latest missing Cards, preserves existing older CardData and retains removed data", async () => {
  const { repo, id, ids } = await fixture(); await personalState(repo, ids[0]); await repo.openWorkingDeck("alice", id, "2026-10-01", ids[1]);
  const extra = await card(repo), extraHistorical = (await repo.getCardVersion(extra, 1))!;
  await deckPublication(repo, id, "New order", (d) => ({ ...d, cards: [{ cardTemplateId: extra }, { cardTemplateId: ids[0] }], cadence: { intervalDays: 2 } }));
  await cardPublication(repo, extra); await cardPublication(repo, ids[0]);
  const before = (await repo.getPersonalUser("alice"))!, command = (await review(repo, "deck", id)).command;
  assert.deepEqual(command.missingCards, [{ cardTemplateId: extra, version: 2 }]);
  const result = await repo.adoptUpdate("alice", command); assert.equal(result.adoptedVersion, 2);
  assert.deepEqual(result.adoptedCards, [{ cardTemplateId: extra, version: 2 }, { cardTemplateId: ids[0], version: 1 }]);
  const after = (await repo.getPersonalUser("alice"))!; assert.deepEqual(after.cardsData.slice(0, 2), before.cardsData);
  assert.equal(after.decksData[0].activeCardId, extra); assert.equal(after.decksData[0].cadenceAnchorDate, "2026-10-01"); assert.deepEqual(after.decksData[0].openedAt, before.decksData[0].openedAt);
  assert.equal(after.cardsData[2].targetDate, null); assert.equal((await repo.getDeckVersion(id, 2))!.content.cards[0].cardVersionAtPublish, extraHistorical.version);
  await repo.openWorkingDeck("alice", id, "2026-10-15"); assert.equal((await repo.getPersonalUser("alice"))!.cardsData[2].targetDate, "2026-10-03");
});

test("Deck Update preserves active Card when retained and never opens a never-opened or empty Deck", async () => {
  const { repo, id, ids } = await fixture(); await deckPublication(repo, id, undefined, (d) => ({ ...d, cards: [...d.cards].reverse() }));
  await repo.adoptUpdate("alice", (await review(repo, "deck", id)).command);
  let data = (await repo.getPersonalUser("alice"))!.decksData[0]; assert.equal(data.openedAt, null); assert.equal(data.cadenceAnchorDate, null); assert.equal(data.activeCardId, ids[1]);
  await repo.openWorkingDeck("alice", id, "2026-10-10", ids[0]); await deckPublication(repo, id);
  await repo.adoptUpdate("alice", (await review(repo, "deck", id)).command); data = (await repo.getPersonalUser("alice"))!.decksData[0]; assert.equal(data.activeCardId, ids[0]);
  await deckPublication(repo, id, undefined, (d) => ({ ...d, cards: [] })); await repo.adoptUpdate("alice", (await review(repo, "deck", id)).command);
  const user = (await repo.getPersonalUser("alice"))!; assert.equal(user.decksData[0].activeCardId, null); assert.equal(user.cardsData.length, 2);
});

test("stale Card or Deck review is rejected with refreshed chronological review, without partial adoption", async () => {
  for (const kind of ["card", "deck"] as const) {
    const { repo, id, ids } = await fixture(), entity = kind === "card" ? ids[0] : id;
    if (kind === "card") await cardPublication(repo, entity); else await deckPublication(repo, entity);
    const command = (await review(repo, kind, entity)).command, before = await repo.getPersonalUser("alice");
    if (kind === "card") await cardPublication(repo, entity, "Unreviewed"); else await deckPublication(repo, entity, "Unreviewed");
    await assert.rejects(repo.adoptUpdate("alice", command), (error: unknown) => {
      const conflict = error as { code: string; latestReview: { review: { command: UpdateCommand } } }; assert.equal(conflict.code, "UPDATE_REVIEW_CONFLICT"); assert.equal(conflict.latestReview.review.command.targetVersion, 3); return true;
    });
    assert.deepEqual(await repo.getPersonalUser("alice"), before);
  }
});

test("Deck freshness covers missing Cards only; existing adopted Cards and draft saves cannot invalidate review", async () => {
  const { repo, id, ids } = await fixture(), extra = await card(repo); await deckPublication(repo, id, undefined, (d) => ({ ...d, cards: [...d.cards, { cardTemplateId: extra }] }));
  const command = (await review(repo, "deck", id)).command; await cardPublication(repo, ids[0]);
  const extraRoot = (await repo.cards().findOne({ cardTemplateId: extra }))!;
  await repo.saveCardDraft("bob", extra, extraRoot.revision, { ...extraRoot.draft ?? (await repo.getCardVersion(extra, 1))!.content, intro: { title: "Unpublished only", description: "", mediaItem: null } });
  await repo.adoptUpdate("alice", command); assert.equal((await repo.getPersonalUser("alice"))!.cardsData[0].cardTemplateVersion, 1);
  const next = await card(repo); await deckPublication(repo, id, undefined, (d) => ({ ...d, cards: [...d.cards, { cardTemplateId: next }] }));
  const stale = (await review(repo, "deck", id)).command; await cardPublication(repo, next);
  await assert.rejects(repo.adoptUpdate("alice", stale), { code: "UPDATE_REVIEW_CONFLICT" });
});

test("CardData created through another Deck after review is reused, not overwritten or treated as a stale missing Card", async () => {
  const { repo, id } = await fixture(), extra = await card(repo); await deckPublication(repo, id, undefined, (d) => ({ ...d, cards: [...d.cards, { cardTemplateId: extra }] }));
  const command = (await review(repo, "deck", id)).command; await repo.ensureCardData("alice", extra, 1); await personalState(repo, extra); await cardPublication(repo, extra);
  const before = (await repo.getPersonalUser("alice"))!.cardsData.find((c) => c.cardTemplateId === extra);
  await repo.adoptUpdate("alice", command); assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData.find((c) => c.cardTemplateId === extra), before);
});

test("concurrent duplicate Updates, lost-response retries and superseded retries never replay state or reverse Archive", async () => {
  const { repo, id, ids } = await fixture(); await cardPublication(repo, ids[0]); const c = (await review(repo, "card", ids[0])).command;
  const results = await Promise.all([repo.adoptUpdate("alice", c), repo.adoptUpdate("alice", c)]); assert.deepEqual(results.map((r) => r.outcome).sort(), ["already-adopted", "updated"]);
  await personalState(repo, ids[0]); const after = await repo.getPersonalUser("alice"); await repo.adoptUpdate("alice", c); assert.deepEqual(await repo.getPersonalUser("alice"), after);
  await cardPublication(repo, ids[0]); await repo.adoptUpdate("alice", (await review(repo, "card", ids[0])).command);
  assert.equal((await repo.adoptUpdate("alice", c)).outcome, "superseded");
  await deckPublication(repo, id); const d = (await review(repo, "deck", id)).command; await repo.adoptUpdate("alice", d); await repo.archiveDeckData("alice", id);
  const archived = await repo.getPersonalUser("alice"); const retry = await repo.adoptUpdate("alice", d); assert.equal(retry.membershipState, "archived"); assert.deepEqual(await repo.getPersonalUser("alice"), archived);
});

test("actor isolation, private-era metadata and missing retained versions fail closed without personal writes", async () => {
  const { repo, id, ids } = await fixture(); await cardPublication(repo, ids[0]); const command = (await review(repo, "card", ids[0])).command;
  await assert.rejects(repo.adoptUpdate("carol", command), { code: "UPDATE_SESSION_CONFLICT" }); await assert.rejects(repo.reviewUpdate("carol", "card", ids[0]), { code: "PERSONAL_UPDATE_FORBIDDEN" });
  const before = await repo.getPersonalUser("alice"); await repo.cardVersions().updateOne({ cardTemplateId: ids[0], version: 2 }, { $unset: { visibility: "" } });
  await assert.rejects(repo.reviewUpdate("alice", "card", ids[0]), { code: "CARD_VERSION_FORBIDDEN" }); await assert.rejects(repo.adoptUpdate("alice", command), { code: "CARD_VERSION_FORBIDDEN" });
  await deckPublication(repo, id); await repo.deckVersions().updateOne({ deckTemplateId: id, version: 2 }, { $set: { visibility: "private" } });
  await assert.rejects(repo.reviewUpdate("alice", "deck", id), { code: "DECK_VERSION_FORBIDDEN" }); assert.deepEqual(await repo.getPersonalUser("alice"), before);
});

for (const kind of ["card", "deck", "missing-card"] as const) test(`competing ${kind} publication cannot commit unreviewed adoption after freshness reads`, async () => {
  const { repo, id, ids } = await fixture(); let extra: string | undefined;
  if (kind === "card") await cardPublication(repo, ids[0]);
  else { extra = await card(repo); await deckPublication(repo, id, undefined, (d) => ({ ...d, cards: [...d.cards, { cardTemplateId: extra! }] })); }
  const command = (await review(repo, kind === "card" ? "card" : "deck", kind === "card" ? ids[0] : id)).command;
  const { adopting, entered, release } = pauseGuard(repo), pending = adopting.adoptUpdate("alice", command), rejected = assert.rejects(pending, { code: "UPDATE_REVIEW_CONFLICT" });
  await entered; try { if (kind === "deck") await deckPublication(repo, id); else await cardPublication(repo, kind === "card" ? ids[0] : extra!); } finally { release(); }
  await rejected; const user = (await repo.getPersonalUser("alice"))!; assert.equal(user.decksData[0].deckTemplateVersion, 1); assert.equal(user.cardsData[0].cardTemplateVersion, 1); assert.equal(user.cardsData.length, 2);
});

test("concurrent personal edits produce a coherent retried Card adoption without overwriting reflection or Step state", async () => {
  const { repo, id, ids } = await fixture(); await cardPublication(repo, ids[0]); const command = (await review(repo, "card", ids[0])).command;
  const { adopting, entered, release } = pauseGuard(repo), pending = adopting.adoptUpdate("alice", command); await entered;
  try { await personalState(repo, ids[0]); } finally { release(); } await pending;
  const data = (await repo.getPersonalUser("alice"))!.cardsData[0]; assert.equal(data.items[0].completionStatus, "skipped"); assert.equal(data.signalReadings[0].reading, 6.42); assert.equal(data.reflection, "Keep my reflection");
  assert.equal((await workingDTO(repo, "alice", id)).cards[0].adoptedVersion, 2);
});

test("a competing Archive is never undone by Deck Update, including an empty target Deck", async () => {
  const { repo, id } = await fixture(); await deckPublication(repo, id, undefined, (d) => ({ ...d, cards: [] })); const command = (await review(repo, "deck", id)).command;
  const { adopting, entered, release } = pauseGuard(repo, "decks"), pending = adopting.adoptUpdate("alice", command), rejected = assert.rejects(pending, { code: "WORKING_DECK_REQUIRED" });
  await entered; try { await repo.archiveDeckData("alice", id); } finally { release(); } await rejected;
  const user = (await repo.getPersonalUser("alice"))!; assert.equal(user.decksData[0].deckTemplateVersion, 1); assert.ok(user.decksData[0].archivedAt);
});

test("injected failure after missing Card creation rolls back the whole Deck adoption and normal retry succeeds", async () => {
  const { repo, id } = await fixture(), extra = await card(repo); await deckPublication(repo, id, undefined, (d) => ({ ...d, cards: [...d.cards, { cardTemplateId: extra }] })); const command = (await review(repo, "deck", id)).command;
  const before = await repo.getPersonalUser("alice"), adopting = new CardRepository(repo.db, client), collection = adopting.users(), update = collection.updateOne.bind(collection);
  collection.updateOne = async (...args: Parameters<typeof update>) => { if (!Array.isArray(args[1]) && args[1].$set?.["decksData.$[deck].deckTemplateVersion"]) throw new Error("Injected adoption failure"); return update(...args); };
  adopting.users = () => collection; await assert.rejects(adopting.adoptUpdate("alice", command), /Injected adoption failure/); assert.deepEqual(await repo.getPersonalUser("alice"), before);
  await repo.adoptUpdate("alice", command); assert.equal((await repo.getPersonalUser("alice"))!.cardsData.length, 3);
});

test("concurrent Deck Updates and Add sharing newly introduced Cards create one global CardData and exact independent adoptions", async () => {
  const { repo, id, ids } = await fixture(), second = await deck(repo, ids); await repo.ensureDeckData("alice", second, 1);
  const extra = await card(repo), third = await deck(repo, [extra]);
  for (const entity of [id, second]) await deckPublication(repo, entity, undefined, (d) => ({ ...d, cards: [...d.cards, { cardTemplateId: extra }] }));
  const first = (await review(repo, "deck", id)).command, next = (await review(repo, "deck", second)).command;
  const results = await Promise.all([repo.adoptUpdate("alice", first), repo.adoptUpdate("alice", first), repo.adoptUpdate("alice", next),
    repo.addLibraryDeck("alice", { deckTemplateId: third, deckVersion: 1, cards: [{ cardTemplateId: extra, version: 1 }] })]);
  assert.equal(results.filter((r) => r.outcome === "updated").length, 2);
  const user = (await repo.getPersonalUser("alice"))!; assert.equal(user.cardsData.filter((c) => c.cardTemplateId === extra).length, 1);
  assert.equal(user.decksData.length, 3); assert.deepEqual(user.decksData.map((d) => d.deckTemplateVersion).sort(), [1, 2, 2]);
});

test("unexpected intermediate adoption conflicts rather than skipping reviewed notes or downgrading", async () => {
  const { repo, ids } = await fixture(); await cardPublication(repo, ids[0]);
  await cardPublication(repo, ids[0]); const third = (await review(repo, "card", ids[0])).command;
  // Simulate an unexpected intervening adoption (e.g. repaired local data).
  // The reviewed source version must still be authoritative for a new write.
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.0.cardTemplateVersion": 2 } });
  const before = await repo.getPersonalUser("alice"); await assert.rejects(repo.adoptUpdate("alice", third), { code: "UPDATE_ADOPTION_CONFLICT" });
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
});

test("Update root guards acquire sorted missing Cards before Deck and never mutate canonical content or authoring revision", async () => {
  const { repo, id } = await fixture(), extra = [await card(repo), await card(repo)];
  await deckPublication(repo, id, undefined, (d) => ({ ...d, cards: [...d.cards, ...extra.map((cardTemplateId) => ({ cardTemplateId }))] }));
  const command = (await review(repo, "deck", id)).command, adopting = new CardRepository(repo.db, client), order: string[] = [];
  const cards = adopting.cards(), decks = adopting.decks(), cardWrite = cards.updateOne.bind(cards), deckWrite = decks.updateOne.bind(decks);
  cards.updateOne = async (...args: Parameters<typeof cardWrite>) => { order.push(`card:${args[0].cardTemplateId}`); return cardWrite(...args); };
  decks.updateOne = async (...args: Parameters<typeof deckWrite>) => { order.push(`deck:${args[0].deckTemplateId}`); return deckWrite(...args); };
  adopting.cards = () => cards; adopting.decks = () => decks;
  const before = (await repo.decks().findOne({ deckTemplateId: id }))!, immutable = await repo.getDeckVersion(id, 2);
  await adopting.adoptUpdate("alice", command); assert.deepEqual(order, [...extra.sort().map((id) => `card:${id}`), `deck:${id}`]);
  const after = (await repo.decks().findOne({ deckTemplateId: id }))!;
  const { publicationGuard: beforeGuard, ...beforeContent } = before, { publicationGuard: afterGuard, ...afterContent } = after;
  assert.equal(afterGuard, (beforeGuard ?? 0) + 1); assert.deepEqual(afterContent, beforeContent);
  assert.deepEqual(await repo.getDeckVersion(id, 2), immutable);
});

test("missing exact immutable versions and ambiguous personal identities never partially advance adoption", async () => {
  const { repo, ids } = await fixture(); await cardPublication(repo, ids[0]); const command = (await review(repo, "card", ids[0])).command;
  const user = (await repo.getPersonalUser("alice"))!;
  await repo.users().updateOne({ _id: "alice" }, { $push: { cardsData: user.cardsData[0] } });
  await assert.rejects(repo.adoptUpdate("alice", command), { code: "AMBIGUOUS_PERSONAL_UPDATE_CONFLICT" });
  await repo.users().updateOne({ _id: "alice" }, { $set: { cardsData: user.cardsData } });
  await repo.cardVersions().deleteOne({ cardTemplateId: ids[0], version: 2 }); await assert.rejects(repo.adoptUpdate("alice", command), { code: "MISSING_CARD_VERSION" });
  assert.deepEqual(await repo.getPersonalUser("alice"), user);
  const other = await fixture(); await deckPublication(other.repo, other.id); const d = (await review(other.repo, "deck", other.id)).command;
  const before = await other.repo.getPersonalUser("alice"); await other.repo.deckVersions().deleteOne({ deckTemplateId: other.id, version: 1 });
  await assert.rejects(other.repo.adoptUpdate("alice", d), { code: "MISSING_DECK_VERSION" }); assert.deepEqual(await other.repo.getPersonalUser("alice"), before);
});

test("working refresh after Deck Update initializes only missing dates using the retained cadence anchor", async () => {
  const { repo, ids, id } = await fixture();
  await repo.openWorkingDeck("alice", id, "2026-10-09");
  const before = (await repo.getPersonalUser("alice"))!, oldDeck = before.decksData.find((data) => data.deckTemplateId === id)!;
  const extra = await card(repo);
  await deckPublication(repo, id, "Added practice", (content) => ({ ...content, cards: [...content.cards, { cardTemplateId: extra }] }));
  const selected = await review(repo, "deck", id); await repo.adoptUpdate("alice", selected.command);
  const adopted = (await repo.getPersonalUser("alice"))!;
  assert.equal(adopted.cardsData.find((data) => data.cardTemplateId === extra)!.targetDate, null);
  await repo.openWorkingDeck("alice", id, "2026-10-20");
  const opened = (await repo.getPersonalUser("alice"))!;
  assert.equal(opened.decksData.find((data) => data.deckTemplateId === id)!.cadenceAnchorDate, oldDeck.cadenceAnchorDate);
  for (const cardId of ids) assert.equal(opened.cardsData.find((data) => data.cardTemplateId === cardId)!.targetDate, before.cardsData.find((data) => data.cardTemplateId === cardId)!.targetDate);
  assert.ok(opened.cardsData.find((data) => data.cardTemplateId === extra)!.targetDate);
});
