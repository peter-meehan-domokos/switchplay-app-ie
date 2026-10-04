import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { ObjectId, type ClientSession, type Db, type MongoClient } from "mongodb";
import { getDatabase, getMongoClient, withMongoTransaction } from "../mongodb";
import { assertAdoption, assertCardContent, assertDeckContent, initialCardData, nonblank, requireCondition, swapConstructionSteps } from "./domain";
import type { AdoptedVersion, CardContent, CardTemplateRoot, CardTemplateVersion, DeckContent, DeckData, DeckTemplateRoot, DeckTemplateVersion, PersonalUser, Visibility } from "./model";
import type { CompletionStatus } from "../../components/decks/types";
import { isIsoDateOnlyString } from "../dateOnly";

export const COLLECTIONS = { cards: "cardTemplates", cardVersions: "cardTemplateVersions", decks: "deckTemplates", deckVersions: "deckTemplateVersions", users: "users" } as const;
function entityId(value: unknown) { requireCondition(nonblank(value), "INVALID_ENTITY_ID"); }
const userKey = (userId: string) => { entityId(userId); return /^[a-f\d]{24}$/i.test(userId) ? new ObjectId(userId) : userId; };

// Explicit setup only. Never create indexes on module import or through legacy routes.
export async function createFoundationIndexes(db: Db) {
  await db.collection(COLLECTIONS.cards).createIndex({ cardTemplateId: 1 }, { unique: true });
  await db.collection(COLLECTIONS.cards).createIndex({ ownerUserId: 1, cardTemplateId: 1 });
  await db.collection(COLLECTIONS.cards).createIndex({ stepIds: 1 }, { unique: true, partialFilterExpression: { "stepIds.0": { $exists: true } } });
  await db.collection(COLLECTIONS.cardVersions).createIndex({ cardTemplateId: 1, version: 1 }, { unique: true });
  await db.collection(COLLECTIONS.decks).createIndex({ deckTemplateId: 1 }, { unique: true });
  await db.collection(COLLECTIONS.decks).createIndex({ ownerUserId: 1, deckTemplateId: 1 });
  await db.collection(COLLECTIONS.deckVersions).createIndex({ deckTemplateId: 1, version: 1 }, { unique: true });
  await db.collection(COLLECTIONS.deckVersions).createIndex({ "content.cards.cardTemplateId": 1, deckTemplateId: 1 });
}

export class CardRepository {
  constructor(readonly db: Db, readonly client: MongoClient) {}
  static async application() { return new CardRepository(await getDatabase(), await getMongoClient()); }
  cards() { return this.db.collection<CardTemplateRoot>(COLLECTIONS.cards); }
  cardVersions() { return this.db.collection<CardTemplateVersion>(COLLECTIONS.cardVersions); }
  decks() { return this.db.collection<DeckTemplateRoot>(COLLECTIONS.decks); }
  deckVersions() { return this.db.collection<DeckTemplateVersion>(COLLECTIONS.deckVersions); }
  users() { return this.db.collection<PersonalUser>(COLLECTIONS.users); }
  transaction<T>(operation: (session: ClientSession) => Promise<T>) { return withMongoTransaction(this.client, operation); }
  getCardVersion(cardTemplateId: string, version: number, session?: ClientSession) {
    entityId(cardTemplateId);
    requireCondition(Number.isInteger(version) && version >= 1, "INVALID_VERSION");
    return this.cardVersions().findOne({ cardTemplateId, version }, { session });
  }
  getDeckVersion(deckTemplateId: string, version: number, session?: ClientSession) {
    entityId(deckTemplateId);
    requireCondition(Number.isInteger(version) && version >= 1, "INVALID_VERSION");
    return this.deckVersions().findOne({ deckTemplateId, version }, { session });
  }
  async cardUpdateNotes(actor: string, cardTemplateId: string, afterVersion: number) {
    entityId(actor); entityId(cardTemplateId);
    requireCondition(Number.isInteger(afterVersion) && afterVersion >= 1, "INVALID_VERSION");
    const root = await this.cards().findOne({ cardTemplateId });
    requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "CARD_FORBIDDEN");
    const versions = await this.cardVersions().find({ cardTemplateId, version: { $gt: afterVersion, $lte: root.latestVersion }, updateNote: { $exists: true } }).sort({ version: 1 }).toArray();
    return versions.filter((version) => version.updateNote?.trim()).map(({ version, updateNote }) => ({ version, updateNote: updateNote! }));
  }
  getPersonalUser(userId: string, session?: ClientSession) {
    return this.users().findOne({ _id: userKey(userId) }, { projection: { decksData: 1, cardsData: 1 }, session });
  }
  private async ownerCard(actor: string, cardTemplateId: string, expectedRevision: number, session: ClientSession) {
    entityId(actor); entityId(cardTemplateId);
    const root = await this.cards().findOne({ cardTemplateId }, { session });
    requireCondition(root?.ownerUserId === actor, "CARD_FORBIDDEN");
    requireCondition(root.revision === expectedRevision, "STALE_REVISION"); return root;
  }
  private async ownerDeck(actor: string, deckTemplateId: string, expectedRevision: number, session: ClientSession) {
    entityId(actor); entityId(deckTemplateId);
    const root = await this.decks().findOne({ deckTemplateId }, { session });
    requireCondition(root?.ownerUserId === actor, "DECK_FORBIDDEN");
    requireCondition(root.revision === expectedRevision, "STALE_REVISION"); return root;
  }
  private async assertUser(userId: string, session?: ClientSession) {
    const user = await this.getPersonalUser(userId, session);
    requireCondition(user && Array.isArray(user.decksData) && Array.isArray(user.cardsData), "NEW_MODEL_USER_REQUIRED");
    requireCondition(user.decksData.every((deck) => !Object.hasOwn(deck, "cards")), "LEGACY_USER_REFUSED"); return user;
  }
  private async deckReferences(actor: string, content: DeckContent, session: ClientSession) {
    const roots = await this.cards().find({ cardTemplateId: { $in: content.cards.map((ref) => ref.cardTemplateId) } }, { session }).toArray();
    requireCondition(roots.length === content.cards.length, "MISSING_CARD_REFERENCE");
    requireCondition(roots.every((card) => card.ownerUserId === actor || card.visibility === "public"), "PRIVATE_FOREIGN_CARD");
    requireCondition(roots.every((card) => card.ownerUserId === actor || card.latestVersion >= 1), "UNPUBLISHED_FOREIGN_CARD"); return roots;
  }
  async createCardDraft(actor: string, content: CardContent, visibility: Visibility = "private") {
    assertCardContent(content); requireCondition(["public", "private"].includes(visibility), "INVALID_VISIBILITY");
    const now = new Date();
    const root: CardTemplateRoot = { cardTemplateId: randomUUID(), ownerUserId: actor, visibility, latestVersion: 0,
      draft: structuredClone(content), stepIds: content.steps.map((step) => step.stepId), revision: 0, forkedFrom: null, createdAt: now, updatedAt: now };
    await this.transaction(async (session) => { await this.assertUser(actor, session); await this.cards().insertOne(root, { session }); });
    return root;
  }
  async createDeckDraft(actor: string, content: DeckContent, visibility: Visibility = "private") {
    assertDeckContent(content); requireCondition(["public", "private"].includes(visibility), "INVALID_VISIBILITY");
    const now = new Date(); const root: DeckTemplateRoot = { deckTemplateId: randomUUID(), ownerUserId: actor, visibility,
      latestVersion: 0, draft: structuredClone(content), revision: 0, forkedFrom: null, createdAt: now, updatedAt: now };
    await this.transaction(async (session) => {
      await this.assertUser(actor, session); await this.deckReferences(actor, content, session);
      await this.decks().insertOne(root, { session });
      await this.ensureDeckDataInSession(actor, root, null, now, session);
    }); return root;
  }
  async saveCardDraft(actor: string, cardTemplateId: string, expectedRevision: number, content: CardContent) {
    assertCardContent(content);
    return this.transaction(async (session) => {
      const root = await this.ownerCard(actor, cardTemplateId, expectedRevision, session);
      const latest = root.latestVersion >= 1 ? await this.getCardVersion(cardTemplateId, root.latestVersion, session) : null;
      requireCondition(root.latestVersion === 0 || latest !== null, "MISSING_CARD_VERSION");
      const draft = latest && isDeepStrictEqual(content, latest.content) ? null : content;
      const stepIds = [...new Set([...root.stepIds, ...content.steps.map((step) => step.stepId)])];
      // A root retains historical identities; no other Card may claim them.
      const result = await this.cards().updateOne({ cardTemplateId, revision: expectedRevision }, {
        $set: { draft, stepIds, updatedAt: new Date() }, $inc: { revision: 1 },
      }, { session }); requireCondition(result.matchedCount === 1, "STALE_REVISION"); return expectedRevision + 1;
    });
  }
  async saveDeckDraft(actor: string, deckTemplateId: string, expectedRevision: number, content: DeckContent, visibility?: Visibility) {
    assertDeckContent(content);
    return this.transaction(async (session) => {
      const root = await this.ownerDeck(actor, deckTemplateId, expectedRevision, session);
      if (visibility !== undefined) requireCondition(["private", "public"].includes(visibility), "INVALID_VISIBILITY");
      await this.deckReferences(actor, content, session);
      const latest = root.latestVersion >= 1 ? await this.getDeckVersion(deckTemplateId, root.latestVersion, session) : null;
      requireCondition(root.latestVersion === 0 || latest !== null, "MISSING_DECK_VERSION");
      const publishedContent = latest ? { ...latest.content, cards: latest.content.cards.map(({ cardTemplateId }) => ({ cardTemplateId })) } : null;
      const visibilityChanged = visibility !== undefined && visibility !== root.visibility;
      const draft = !visibilityChanged && latest && isDeepStrictEqual(content, publishedContent) ? null : content;
      const result = await this.decks().updateOne({ deckTemplateId, revision: expectedRevision }, {
        $set: { draft, ...(visibility === undefined ? {} : { visibility }), updatedAt: new Date() }, $inc: { revision: 1 },
      }, { session }); requireCondition(result.matchedCount === 1, "STALE_REVISION"); return expectedRevision + 1;
    });
  }
  private note(updateNote?: string) {
    requireCondition(updateNote === undefined || (typeof updateNote === "string" && updateNote.length <= 2000), "INVALID_UPDATE_NOTE");
    return updateNote?.trim() ? { updateNote: updateNote.trim() } : {};
  }
  async publishCard(actor: string, cardTemplateId: string, expectedRevision: number, updateNote?: string) {
    const note = this.note(updateNote);
    return this.transaction(async (session) => {
      const root = await this.ownerCard(actor, cardTemplateId, expectedRevision, session);
      requireCondition(root.draft !== null, "NO_UNPUBLISHED_CHANGES"); assertCardContent(root.draft);
      const version = root.latestVersion + 1; const now = new Date();
      await this.cardVersions().insertOne({ cardTemplateId, version, content: root.draft, ...note, publishedAt: now, publishedByUserId: actor }, { session });
      const result = await this.cards().updateOne({ cardTemplateId, revision: expectedRevision }, { $set: { latestVersion: version, draft: null, updatedAt: now }, $inc: { revision: 1 } }, { session });
      requireCondition(result.matchedCount === 1, "STALE_REVISION");
      // Field-level update: no reconciliation, replacement, deletion or follower adoption.
      await this.users().updateOne({ _id: userKey(actor), "cardsData.cardTemplateId": cardTemplateId }, {
        $set: { "cardsData.$[card].cardTemplateVersion": version, "cardsData.$[card].updatedAt": now },
      }, { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] }); return version;
    });
  }
  async publishDeck(actor: string, deckTemplateId: string, expectedRevision: number, updateNote?: string) {
    const note = this.note(updateNote);
    return this.transaction(async (session) => {
      const root = await this.ownerDeck(actor, deckTemplateId, expectedRevision, session);
      requireCondition(root.draft !== null, "NO_UNPUBLISHED_CHANGES"); assertDeckContent(root.draft);
      const cards = await this.deckReferences(actor, root.draft, session);
      requireCondition(cards.every((card) => card.latestVersion >= 1), "UNPUBLISHED_CARDS_BLOCK_DECK");
      const versions = cards.length ? await this.cardVersions().find({ $or: cards.map((card) => ({ cardTemplateId: card.cardTemplateId, version: card.latestVersion })) }, { session }).toArray() : [];
      if (cards.length) requireCondition(versions.length === cards.length, "MISSING_CARD_VERSION");
      const now = new Date();
      if (root.visibility === "public") {
        for (const card of cards) {
          requireCondition(card.visibility === "public" || card.ownerUserId === actor, "PRIVATE_FOREIGN_CARD");
          if (card.visibility === "private") await this.cards().updateOne({ cardTemplateId: card.cardTemplateId, revision: card.revision }, {
            $set: { visibility: "public", updatedAt: now }, $inc: { revision: 1 },
          }, { session });
        }
      }
      const byId = new Map(cards.map((card) => [card.cardTemplateId, card])); const version = root.latestVersion + 1;
      await this.deckVersions().insertOne({ deckTemplateId, version, content: { ...root.draft,
        cards: root.draft.cards.map(({ cardTemplateId }) => ({ cardTemplateId, cardVersionAtPublish: byId.get(cardTemplateId)!.latestVersion })),
      }, ...note, publishedAt: now, publishedByUserId: actor }, { session });
      const result = await this.decks().updateOne({ deckTemplateId, revision: expectedRevision }, { $set: { latestVersion: version, draft: null, updatedAt: now }, $inc: { revision: 1 } }, { session });
      requireCondition(result.matchedCount === 1, "STALE_REVISION");
      await this.users().updateOne({ _id: userKey(actor), "decksData.deckTemplateId": deckTemplateId }, {
        $set: { "decksData.$[deck].deckTemplateVersion": version, "decksData.$[deck].updatedAt": now },
      }, { session, arrayFilters: [{ "deck.deckTemplateId": deckTemplateId }] }); return version;
    });
  }
  async promoteCard(actor: string, cardTemplateId: string, expectedRevision: number) {
    return this.transaction(async (session) => {
      await this.ownerCard(actor, cardTemplateId, expectedRevision, session);
      await this.cards().updateOne({ cardTemplateId, revision: expectedRevision }, { $set: { visibility: "public", updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
      return expectedRevision + 1;
    }); // No API for public -> private.
  }
  private async ensureDeckDataInSession(actor: string, root: DeckTemplateRoot, version: AdoptedVersion, now: Date, session: ClientSession) {
    await this.users().updateOne({ _id: userKey(actor), "decksData.deckTemplateId": { $ne: root.deckTemplateId } }, {
      $push: { decksData: { deckTemplateId: root.deckTemplateId, deckTemplateVersion: version, activeCardId: null,
        archivedAt: null, sharedWithUserIds: [], createdAt: now, updatedAt: now, openedAt: null } },
    }, { session });
  }
  async ensureDeckData(actor: string, deckTemplateId: string, version: AdoptedVersion) {
    entityId(deckTemplateId);
    assertAdoption(version);
    await this.transaction(async (session) => {
      await this.assertUser(actor, session); const root = await this.decks().findOne({ deckTemplateId }, { session });
      requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "DECK_FORBIDDEN");
      if (version === null) requireCondition(root.ownerUserId === actor && root.latestVersion === 0, "INVALID_NULL_ADOPTION");
      else requireCondition(await this.getDeckVersion(deckTemplateId, version, session), "MISSING_DECK_VERSION");
      await this.ensureDeckDataInSession(actor, root, version, new Date(), session);
    });
    return (await this.getPersonalUser(actor))!.decksData.find((data) => data.deckTemplateId === deckTemplateId)!;
  }
  async ensureCardData(actor: string, cardTemplateId: string, version: AdoptedVersion, targetDate: string | null = null) {
    entityId(cardTemplateId);
    assertAdoption(version);
    await this.transaction(async (session) => {
      await this.assertUser(actor, session); const root = await this.cards().findOne({ cardTemplateId }, { session });
      requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "CARD_FORBIDDEN");
      let content: CardContent;
      if (version === null) { requireCondition(root.ownerUserId === actor && root.latestVersion === 0 && root.draft !== null, "INVALID_NULL_ADOPTION"); content = root.draft; }
      else { const adopted = await this.getCardVersion(cardTemplateId, version, session); requireCondition(adopted, "MISSING_CARD_VERSION"); content = adopted.content; }
      await this.users().updateOne({ _id: userKey(actor), "cardsData.cardTemplateId": { $ne: cardTemplateId } }, {
        $push: { cardsData: initialCardData(cardTemplateId, version, content, new Date(), targetDate) },
      }, { session });
    });
    return (await this.getPersonalUser(actor))!.cardsData.find((data) => data.cardTemplateId === cardTemplateId)!;
  }
  private async setArchive(actor: string, deckTemplateId: string, archivedAt: Date | null) {
    entityId(deckTemplateId);
    const result = await this.users().updateOne({ _id: userKey(actor), "decksData.deckTemplateId": deckTemplateId }, {
      $set: { "decksData.$[deck].archivedAt": archivedAt, "decksData.$[deck].updatedAt": new Date() },
    }, { arrayFilters: [{ "deck.deckTemplateId": deckTemplateId }] }); requireCondition(result.matchedCount === 1, "MISSING_MEMBERSHIP");
  }
  archiveDeckData(actor: string, deckTemplateId: string) { return this.setArchive(actor, deckTemplateId, new Date()); }
  reactivateDeckData(actor: string, deckTemplateId: string) { return this.setArchive(actor, deckTemplateId, null); }
  async activeMemberships(actor: string): Promise<DeckData[]> {
    const user = await this.getPersonalUser(actor); return user?.decksData.filter((deck) => deck.archivedAt === null) ?? [];
  }
  private async workingCard(actor: string, deckTemplateId: string, cardTemplateId: string, session: ClientSession) {
    const user = await this.assertUser(actor, session);
    const membership = user.decksData.find((data) => data.deckTemplateId === deckTemplateId);
    requireCondition(membership && membership.archivedAt === null && membership.deckTemplateVersion !== null, "WORKING_DECK_REQUIRED");
    const deck = await this.decks().findOne({ deckTemplateId }, { session });
    requireCondition(deck && (deck.ownerUserId === actor || deck.visibility === "public"), "DECK_FORBIDDEN");
    const version = await this.getDeckVersion(deckTemplateId, membership.deckTemplateVersion, session);
    requireCondition(version?.content.cards.some((ref) => ref.cardTemplateId === cardTemplateId), "CARD_OUTSIDE_WORKING_CONTEXT");
    const root = await this.cards().findOne({ cardTemplateId }, { session });
    requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "CARD_FORBIDDEN");
    const data = user.cardsData.find((card) => card.cardTemplateId === cardTemplateId);
    requireCondition(data && data.cardTemplateVersion !== null, "MISSING_CARD_DATA");
    const cardVersion = await this.getCardVersion(cardTemplateId, data.cardTemplateVersion, session);
    requireCondition(cardVersion, "MISSING_CARD_VERSION"); return { data, cardVersion };
  }
  async setCompletion(actor: string, deckTemplateId: string, cardTemplateId: string, stepId: string, completionStatus: CompletionStatus) {
    requireCondition(["todo", "inProgress", "done", "skipped"].includes(completionStatus), "INVALID_COMPLETION");
    await this.transaction(async (session) => {
      const { data, cardVersion } = await this.workingCard(actor, deckTemplateId, cardTemplateId, session);
      requireCondition(cardVersion.content.steps.some((step) => step.stepId === stepId), "STEP_OUTSIDE_ADOPTED_CARD");
      if (!data.items.some((item) => item.stepId === stepId)) {
        await this.users().updateOne({ _id: userKey(actor) }, { $push: { "cardsData.$[card].items": { stepId, completionStatus } }, $set: { "cardsData.$[card].updatedAt": new Date() } },
          { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] }); return;
      }
      const result = await this.users().updateOne({ _id: userKey(actor) }, { $set: {
        "cardsData.$[card].items.$[step].completionStatus": completionStatus, "cardsData.$[card].updatedAt": new Date(),
      } }, { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }, { "step.stepId": stepId }] });
      requireCondition(result.matchedCount === 1, "MISSING_CARD_DATA");
    });
  }
  async setSignalReading(actor: string, deckTemplateId: string, cardTemplateId: string, stepId: string, reading: number | null) {
    requireCondition(reading === null || (typeof reading === "number" && Number.isFinite(reading) && reading >= 1 && reading <= 10), "INVALID_SIGNAL_READING");
    await this.transaction(async (session) => {
      const { data, cardVersion } = await this.workingCard(actor, deckTemplateId, cardTemplateId, session);
      requireCondition(cardVersion.content.steps.some((step) => step.stepId === stepId), "STEP_OUTSIDE_ADOPTED_CARD");
      if (!data.signalReadings.some((item) => item.stepId === stepId)) {
        await this.users().updateOne({ _id: userKey(actor) }, { $push: { "cardsData.$[card].signalReadings": { stepId, reading } }, $set: { "cardsData.$[card].updatedAt": new Date() } },
          { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] }); return;
      }
      await this.users().updateOne({ _id: userKey(actor) }, { $set: {
        "cardsData.$[card].signalReadings.$[step].reading": reading, "cardsData.$[card].updatedAt": new Date(),
      } }, { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }, { "step.stepId": stepId }] });
    });
  }
  async setTargetDate(actor: string, deckTemplateId: string, cardTemplateId: string, targetDate: string | null) {
    requireCondition(targetDate === null || isIsoDateOnlyString(targetDate), "INVALID_TARGET_DATE");
    await this.transaction(async (session) => {
      await this.workingCard(actor, deckTemplateId, cardTemplateId, session);
      await this.users().updateOne({ _id: userKey(actor) }, { $set: { "cardsData.$[card].targetDate": targetDate, "cardsData.$[card].updatedAt": new Date() } },
        { session, arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] });
    });
  }
  async moveConstructionStep(actor: string, deckTemplateId: string, sourceId: string, destinationId: string, sourceIndex: number, destinationIndex: number,
    revisions: { deck: number; source: number; destination: number }) {
    return this.transaction(async (session) => {
      const deck = await this.ownerDeck(actor, deckTemplateId, revisions.deck, session);
      const source = await this.ownerCard(actor, sourceId, revisions.source, session);
      const destination = await this.ownerCard(actor, destinationId, revisions.destination, session);
      requireCondition(deck.draft?.cards.some((ref) => ref.cardTemplateId === sourceId) && deck.draft.cards.some((ref) => ref.cardTemplateId === destinationId), "CARD_OUTSIDE_DECK");
      const moved = swapConstructionSteps(source, destination, deck, sourceIndex, destinationIndex);
      const sourceStepId = source.draft!.steps[sourceIndex].stepId;
      const destinationStepId = destination.draft!.steps[destinationIndex].stepId;
      const sourceStepIds = [...new Set([...source.stepIds.filter((id) => id !== sourceStepId), destinationStepId])];
      const destinationStepIds = [...new Set([...destination.stepIds.filter((id) => id !== destinationStepId), sourceStepId])];
      // Release both never-published reservations before transferring identities atomically.
      await this.cards().updateMany({ cardTemplateId: { $in: [sourceId, destinationId] } }, { $set: { stepIds: [] } }, { session });
      await this.cards().updateOne({ cardTemplateId: sourceId }, { $set: { draft: moved.source, stepIds: sourceStepIds, updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
      await this.cards().updateOne({ cardTemplateId: destinationId }, { $set: { draft: moved.destination, stepIds: destinationStepIds, updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
      await this.decks().updateOne({ deckTemplateId }, { $inc: { revision: 1 } }, { session });
      // No personal completion/signal transfer. Normally no CardData exists during construction.
      return moved;
    });
  }
}
