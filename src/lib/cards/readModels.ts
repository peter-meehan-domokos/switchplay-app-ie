import type { CardRepository } from "./repository";
import { resolveWorkingDeck, resolveCreatorDeck, resolveCreatorCard, capabilities } from "./resolvers";
import { assertAdoption, requireCondition, stepLinkedSignals, CardArchitectureError, assertCardContent, assertDeckContent } from "./domain";
import { deckDraftContent } from "./publicationRules";
import type { Deck } from "../../components/decks/types";
import { jsonDTO } from "./http";
import { layoutCardLabels } from "./layout";
import { personalHistorySegments } from "./forks";
import { assertCardVersionAccess, assertDeckVersionAccess } from "./versionAccess";

// Actor-scoped current reads: retain each event's original Card/Deck context.
// Membership is not required for retained personal history.
export async function personalCardHistoryDTO(repo: CardRepository, actor: string, cardTemplateId: string) {
  requireCondition(typeof cardTemplateId === "string" && cardTemplateId.trim() !== "", "INVALID_ENTITY_ID");
  const user = await repo.getPersonalUser(actor);
  requireCondition(user && Array.isArray(user.cardsData), "NEW_MODEL_USER_REQUIRED");
  return jsonDTO({ cardTemplateId, segments: personalHistorySegments(user.cardsData, cardTemplateId) });
}

export async function creatorDTO(repo: CardRepository, actor: string, id: string) {
  const deck = await resolveCreatorDeck(repo, actor, id);
  requireCondition(deck.cards.every((card) => card.root.ownerUserId === actor), "FOREIGN_EDIT_DEFERRED");
  const { _id, ...root } = deck.root; void _id;
  return jsonDTO({ ...deck, root, cards: deck.cards.map((card) => {
    const { _id, ...root } = card.root; void _id;
    return { ...card, root };
  }) });
}
export type CreatorDTO = Awaited<ReturnType<typeof creatorDTO>>;
export async function creatorCardDTO(repo: CardRepository, actor: string, id: string) {
  const card = await resolveCreatorCard(repo, actor, id);
  const { _id, ...root } = card.root; void _id;
  return jsonDTO({ ...card, root });
}
export async function workingDTO(repo: CardRepository, actor: string, id: string): Promise<Deck> {
  const deck = await resolveWorkingDeck(repo, actor, id);
  requireCondition(deck?.mode === "working", "WORKING_DECK_REQUIRED");
  return projectWorking(deck, actor);
}
function projectWorking(deck: Extract<NonNullable<Awaited<ReturnType<typeof resolveWorkingDeck>>>, { mode: "working" }>, actor: string): Deck {
  requireCondition(Array.isArray(deck.version.content?.cards), "INVALID_CARD_REFERENCES");
  assertDeckContent(deckDraftContent(deck.version.content));
  requireCondition(deck.data.createdAt instanceof Date && Number.isFinite(deck.data.createdAt.getTime())
    && deck.data.updatedAt instanceof Date && Number.isFinite(deck.data.updatedAt.getTime())
    && (deck.data.openedAt === null || deck.data.openedAt instanceof Date && Number.isFinite(deck.data.openedAt.getTime())), "INVALID_PERSONAL_TIMESTAMPS");
  const id = deck.root.deckTemplateId;
  const labels = layoutCardLabels(deck.version.content.labelPrefix, deck.version.content.cards);
  return { id, deckTemplateId: id, hasUserDeckData: true, createdAt: deck.data.createdAt.toISOString(),
    updatedAt: deck.data.updatedAt.toISOString(), openedAt: deck.data.openedAt?.toISOString() ?? null,
    // Compatibility fields are presentation only. Components use the explicit permissions below.
    canMutate: true, isOwnedByCurrentUser: deck.permissions.canEditDeck, ownerUserId: deck.root.ownerUserId,
    ownerUsername: "", showOwnerTag: false, activeCardId: deck.data.activeCardId ?? "",
    templateOwnerUserId: deck.root.ownerUserId, dataOwnerUserId: actor, context: "working",
    adoptedVersion: deck.version.version, permissions: deck.permissions,
    title: deck.version.content.title, category: deck.version.content.categories[0] ?? null,
    introduction: deck.version.content.introduction, streams: deck.version.content.themes,
    cards: deck.cards.map((card, index) => {
      requireCondition(card.data !== null, "MISSING_CARD_DATA");
      assertCardContent(card.version.content);
      requireCondition(Array.isArray(card.data.items) && Array.isArray(card.data.signalReadings), "INVALID_CARD_DATA");
      const history = personalHistorySegments(deck.personalRecords, card.root.cardTemplateId);
      return { id: card.root.cardTemplateId, cardTemplateId: card.root.cardTemplateId, adoptedVersion: card.version.version,
        templateOwnerUserId: card.root.ownerUserId, dataOwnerUserId: actor, permissions: card.permissions,
        label: labels[index].label, targetDate: card.data.targetDate ?? "", intro: card.version.content.intro,
        steps: card.version.content.steps.map((step) => ({ ...step,
          completionStatus: card.data!.items.find((item) => item.stepId === step.stepId)?.completionStatus ?? "todo" })),
        signals: stepLinkedSignals(card.version.content, card.data).map((signal) => ({ id: signal.stepId,
          title: signal.title, reading: signal.reading, rawReading: signal.reading, order: "increasing", unit: null })),
        mediaItems: history[0]?.mediaItems ?? [], reflection: card.data.reflection,
        chats: history[0]?.chats ?? [],
        personalHistory: history.map((segment) => ({ ...segment,
          tests: segment.tests.map((test) => ({ ...test, createdAt: test.createdAt.toISOString() })) })),
      };
    }),
  };
}
export async function membershipDTO(repo: CardRepository, actor: string) {
  const user = await repo.getPersonalUser(actor);
  requireCondition(user && Array.isArray(user.cardsData) && Array.isArray(user.decksData), "NEW_MODEL_USER_REQUIRED");
  const published = user.decksData;
  const roots = await repo.decks().find({ deckTemplateId: { $in: published.map((data) => data.deckTemplateId) } }).toArray();
  const versions = published.length ? await repo.deckVersions().find({ $or: published.map((data) => ({ deckTemplateId: data.deckTemplateId, version: data.deckTemplateVersion! })) }).toArray() : [];
  const cardIds = [...new Set(versions.flatMap((version) => Array.isArray(version.content?.cards)
    ? version.content.cards.flatMap((card) => typeof card?.cardTemplateId === "string" ? [card.cardTemplateId] : []) : []))];
  const cardRoots = await repo.cards().find({ cardTemplateId: { $in: cardIds } }).toArray();
  const requests = cardRoots.flatMap((root) => {
    const personal = user.cardsData.find((data) => data.cardTemplateId === root.cardTemplateId);
    return personal && Number.isInteger(personal.cardTemplateVersion) && personal.cardTemplateVersion >= 1
      ? [{ cardTemplateId: root.cardTemplateId, version: personal.cardTemplateVersion }] : [];
  });
  const cardVersions = requests.length ? await repo.cardVersions().find({ $or: requests }).toArray() : [];
  return jsonDTO(published.map((data) => {
    const base = { deckTemplateId: data.deckTemplateId, archivedAt: data.archivedAt, openedAt: data.openedAt,
      adoptedVersion: data.deckTemplateVersion, context: "working" as const, dataOwnerUserId: actor };
    try {
      requireCondition(!Object.hasOwn(data, "cards"), "LEGACY_USER_REFUSED");
      assertAdoption(data.deckTemplateVersion);
      const root = roots.find((root) => root.deckTemplateId === data.deckTemplateId);
      requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "DECK_FORBIDDEN");
      const version = versions.find((item) => item.deckTemplateId === data.deckTemplateId && item.version === data.deckTemplateVersion);
      requireCondition(version, "MISSING_DECK_VERSION");
      assertDeckVersionAccess(actor, root, version);
      const content = version.content;
      requireCondition(Array.isArray(content?.cards) && content.cards.every((ref) => typeof ref?.cardTemplateId === "string"), "INVALID_CARD_REFERENCES");
      const cards = version.content.cards.map((ref) => {
        const card = cardRoots.find((root) => root.cardTemplateId === ref.cardTemplateId);
        requireCondition(card && (card.ownerUserId === actor || card.visibility === "public"), "CARD_FORBIDDEN");
        const personal = user.cardsData.find((item) => item.cardTemplateId === ref.cardTemplateId);
        requireCondition(personal, "MISSING_CARD_DATA"); assertAdoption(personal.cardTemplateVersion);
        const selected = personal.cardTemplateVersion;
        const cardVersion = cardVersions.find((item) => item.cardTemplateId === ref.cardTemplateId && item.version === selected);
        requireCondition(cardVersion, "MISSING_CARD_VERSION");
        assertCardVersionAccess(actor, card, cardVersion);
        return { root: { ...card, draft: null }, version: cardVersion, data: personal, permissions: capabilities(actor, actor, root, card, personal) };
      });
      const display = projectWorking({ mode: "working", root: { ...root, draft: null }, version, data, cards, personalRecords: user.cardsData, permissions: capabilities(actor, actor, root) }, actor);
      return { ...base, availability: "available" as const, unavailableReason: null, display, title: content.title, cardCount: content.cards.length,
        latestVersion: root.latestVersion, updateAvailable: root.latestVersion > data.deckTemplateVersion,
        cardUpdatesAvailable: cardsWithUpdates(content.cards, user.cardsData, cardRoots),
        templateOwnerUserId: root.ownerUserId, canEditDeck: root.ownerUserId === actor };
    } catch (error) {
      if (!(error instanceof CardArchitectureError)) throw error;
      // Preserve the membership explicitly. Never hide it or expose inaccessible
      // canonical content, and never convert database failures into empty tiles.
      return { ...base, availability: "unavailable" as const, unavailableReason: error.code, display: null,
        title: "Unavailable Deck", cardCount: 0, latestVersion: null, updateAvailable: false, cardUpdatesAvailable: [],
        templateOwnerUserId: null, canEditDeck: false };
    }
  }));
}
function cardsWithUpdates(refs: { cardTemplateId: string }[], personal: import("./model").CardData[], roots: import("./model").CardTemplateRoot[]) {
  return refs.flatMap((ref) => {
    const data = personal.find((data) => data.cardTemplateId === ref.cardTemplateId);
    const root = roots.find((root) => root.cardTemplateId === ref.cardTemplateId);
    return data && root && root.latestVersion > data.cardTemplateVersion
      ? [{ cardTemplateId: ref.cardTemplateId, adoptedVersion: data.cardTemplateVersion, latestVersion: root.latestVersion }] : [];
  });
}
export type MembershipDTO = Awaited<ReturnType<typeof membershipDTO>>[number];
