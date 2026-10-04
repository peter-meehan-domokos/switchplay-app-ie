import type { CardRepository } from "./repository";
import { assertAdoption, nonblank, requireCondition } from "./domain";
import type { Capabilities, CardData, CardTemplateRoot, DeckData, DeckTemplateRoot, PublishedDeckContent } from "./model";

export function capabilities(actor: string, dataOwnerUserId: string, deck: DeckTemplateRoot, card?: CardTemplateRoot, data?: CardData | null): Capabilities {
  const ownData = actor === dataOwnerUserId;
  return { templateOwnerUserId: card?.ownerUserId ?? deck.ownerUserId, dataOwnerUserId,
    canEditDeck: actor === deck.ownerUserId, canPublishDeck: actor === deck.ownerUserId, canArchiveDeck: ownData,
    canEditCard: card?.ownerUserId === actor, canPublishCard: card?.ownerUserId === actor,
    canForkCard: card !== undefined && (card.visibility === "public" || card.ownerUserId === actor),
    canMutateCardData: ownData && data != null,
    canUpdateCard: ownData && data != null && data.cardTemplateVersion !== null && card !== undefined && data.cardTemplateVersion < card.latestVersion,
  };
}

async function resolveCards(repo: CardRepository, refs: PublishedDeckContent["cards"], actor: string | null, data: CardData[], selection: "adopted" | "latest" | "historical") {
  if (refs.length === 0) return [];
  const roots = await repo.cards().find({ cardTemplateId: { $in: refs.map((ref) => ref.cardTemplateId) } }).toArray();
  const rootsById = new Map(roots.map((root) => [root.cardTemplateId, root]));
  const dataById = new Map(data.map((item) => [item.cardTemplateId, item]));
  const requests = refs.map((ref) => {
    const root = rootsById.get(ref.cardTemplateId); requireCondition(root, "MISSING_CARD_REFERENCE");
    requireCondition(root.visibility === "public" || root.ownerUserId === actor, "CARD_FORBIDDEN");
    const personal = dataById.get(ref.cardTemplateId) ?? null;
    if (personal) assertAdoption(personal.cardTemplateVersion);
    const version = selection === "historical" ? ref.cardVersionAtPublish : selection === "adopted" && personal !== null ? personal.cardTemplateVersion : root.latestVersion;
    // null is an explicit unpublished adoption, not an instruction to use latest.
    requireCondition(version !== null && version >= 1, "UNPUBLISHED_CARD_ADOPTION");
    return { root, personal, version };
  });
  const versions = await repo.cardVersions().find({ $or: requests.map(({ root, version }) => ({ cardTemplateId: root.cardTemplateId, version })) }).toArray();
  const byVersion = new Map(versions.map((version) => [`${version.cardTemplateId}@${version.version}`, version]));
  return requests.map(({ root, personal, version }) => {
    const adopted = byVersion.get(`${root.cardTemplateId}@${version}`); requireCondition(adopted, "MISSING_CARD_VERSION");
    return { root: { ...root, draft: null }, version: adopted, data: personal };
  });
}

export async function resolveWorkingDeck(repo: CardRepository, actor: string, deckTemplateId: string) {
  const user = await repo.getPersonalUser(actor);
  const data = user?.decksData.find((item) => item.deckTemplateId === deckTemplateId);
  if (!data || data.archivedAt !== null) return null; // Ownership is never a membership fallback.
  assertAdoption(data.deckTemplateVersion);
  const root = await repo.decks().findOne({ deckTemplateId }); requireCondition(root, "MISSING_DECK_REFERENCE");
  requireCondition(root.ownerUserId === actor || root.visibility === "public", "DECK_FORBIDDEN");
  if (data.deckTemplateVersion === null) {
    requireCondition(root.ownerUserId === actor, "UNPUBLISHED_DECK_FORBIDDEN");
    return { mode: "creator" as const, root, data, permissions: capabilities(actor, actor, root) };
  }
  const version = await repo.getDeckVersion(deckTemplateId, data.deckTemplateVersion); requireCondition(version, "MISSING_DECK_VERSION");
  const cards = await resolveCards(repo, version.content.cards, actor, user?.cardsData ?? [], "adopted");
  return { mode: "working" as const, root: { ...root, draft: null }, version, data, permissions: capabilities(actor, actor, root),
    cards: cards.map((card) => ({ ...card, permissions: capabilities(actor, actor, root, card.root, card.data) })) };
}

// Template-only: never reads personal data or mutates adoption.
export async function resolveDeckPreview(repo: CardRepository, deckTemplateId: string, actor: string | null = null) {
  requireCondition(nonblank(deckTemplateId), "INVALID_ENTITY_ID");
  const root = await repo.decks().findOne({ deckTemplateId }); requireCondition(root, "MISSING_DECK_REFERENCE");
  requireCondition(root.visibility === "public" || root.ownerUserId === actor, "DECK_FORBIDDEN");
  requireCondition(root.latestVersion >= 1, "UNPUBLISHED_DECK");
  const version = await repo.getDeckVersion(deckTemplateId, root.latestVersion); requireCondition(version, "MISSING_DECK_VERSION");
  return { root: { ...root, draft: null }, version, cards: await resolveCards(repo, version.content.cards, actor, [], "latest") };
}
export async function resolveHistoricalDeck(repo: CardRepository, deckTemplateId: string, deckVersion: number, actor: string | null = null) {
  requireCondition(nonblank(deckTemplateId), "INVALID_ENTITY_ID");
  const root = await repo.decks().findOne({ deckTemplateId }); requireCondition(root, "MISSING_DECK_REFERENCE");
  requireCondition(root.visibility === "public" || root.ownerUserId === actor, "DECK_FORBIDDEN");
  const version = await repo.getDeckVersion(deckTemplateId, deckVersion); requireCondition(version, "MISSING_DECK_VERSION");
  return { root: { ...root, draft: null }, version, cards: await resolveCards(repo, version.content.cards, actor, [], "historical") };
}
export async function resolveCreatorDeck(repo: CardRepository, actor: string, deckTemplateId: string) {
  requireCondition(nonblank(actor) && nonblank(deckTemplateId), "INVALID_ENTITY_ID");
  const root = await repo.decks().findOne({ deckTemplateId }); requireCondition(root?.ownerUserId === actor, "DECK_FORBIDDEN");
  const published = root.latestVersion >= 1 ? await repo.getDeckVersion(deckTemplateId, root.latestVersion) : null;
  const content = root.draft ?? (published ? { ...published.content,
    cards: published.content.cards.map(({ cardTemplateId }) => ({ cardTemplateId })),
  } : null); requireCondition(content, "MISSING_DRAFT");
  const cards = content.cards.length ? await repo.cards().find({ cardTemplateId: { $in: content.cards.map((ref) => ref.cardTemplateId) } }).toArray() : [];
  requireCondition(cards.length === content.cards.length, "MISSING_CARD_REFERENCE");
  requireCondition(cards.every((card) => card.ownerUserId === actor || card.visibility === "public"), "PRIVATE_FOREIGN_CARD");
  const publishedCards = cards.filter((card) => card.latestVersion >= 1);
  const versions = publishedCards.length ? await repo.cardVersions().find({ $or: publishedCards.map((card) => ({ cardTemplateId: card.cardTemplateId, version: card.latestVersion })) }).toArray() : [];
  const byId = new Map(cards.map((card) => [card.cardTemplateId, card]));
  const byVersion = new Map(versions.map((version) => [version.cardTemplateId, version]));
  return { root, content, cards: content.cards.map((ref) => {
    const card = byId.get(ref.cardTemplateId)!;
    const cardContent = card.ownerUserId === actor ? card.draft ?? byVersion.get(card.cardTemplateId)?.content : byVersion.get(card.cardTemplateId)?.content;
    requireCondition(cardContent, "MISSING_CARD_VERSION");
    // Never return another owner's draft.
    return { root: card.ownerUserId === actor ? card : { ...card, draft: null }, content: cardContent };
  }) };
}

export async function authorizeWorkingCard(repo: CardRepository, actor: string, deckTemplateId: string, cardTemplateId: string) {
  const deck = await resolveWorkingDeck(repo, actor, deckTemplateId);
  requireCondition(deck?.mode === "working", "WORKING_DECK_REQUIRED");
  const card = deck.cards.find((item) => item.root.cardTemplateId === cardTemplateId);
  requireCondition(card?.data && card.permissions.canMutateCardData, "CARD_OUTSIDE_WORKING_CONTEXT");
  return { deck, card }; // Must be derived on the server before each mutation/upload.
}

export function activeDeckData(records: DeckData[]) { return records.filter((data) => data.archivedAt === null); }
