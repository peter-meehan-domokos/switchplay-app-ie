import type { CardRepository } from "./repository";
import { resolveWorkingDeck, resolveCreatorDeck, resolveCreatorCard, capabilities } from "./resolvers";
import { requireCondition, stepLinkedSignals, initialCardData } from "./domain";
import type { Deck } from "../../components/decks/types";
import { jsonDTO } from "./http";
import { layoutCardLabels } from "./layout";

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
      return { id: card.root.cardTemplateId, cardTemplateId: card.root.cardTemplateId, adoptedVersion: card.version.version,
        templateOwnerUserId: card.root.ownerUserId, dataOwnerUserId: actor, permissions: card.permissions,
        label: labels[index].label, targetDate: card.data.targetDate ?? "", intro: card.version.content.intro,
        steps: card.version.content.steps.map((step) => ({ ...step,
          completionStatus: card.data!.items.find((item) => item.stepId === step.stepId)?.completionStatus ?? "todo" })),
        signals: stepLinkedSignals(card.version.content, card.data).map((signal) => ({ id: signal.stepId,
          title: signal.title, reading: signal.reading, rawReading: signal.reading, order: "increasing", unit: null })),
        mediaItems: card.data.mediaItems, reflection: card.data.reflection,
        chats: card.data.chats.filter((chat) => chat.deckTemplateId === id),
      };
    }),
  };
}
export async function membershipDTO(repo: CardRepository, actor: string) {
  const user = await repo.getPersonalUser(actor);
  requireCondition(user && Array.isArray(user.cardsData) && Array.isArray(user.decksData) && user.decksData.every((data) => !Object.hasOwn(data, "cards")), "NEW_MODEL_USER_REQUIRED");
  const roots = await repo.decks().find({ deckTemplateId: { $in: user.decksData.map((data) => data.deckTemplateId) } }).toArray();
  const published = user.decksData.filter((data) => data.deckTemplateVersion !== null);
  const versions = published.length ? await repo.deckVersions().find({ $or: published.map((data) => ({ deckTemplateId: data.deckTemplateId, version: data.deckTemplateVersion! })) }).toArray() : [];
  const cardIds = [...new Set(versions.flatMap((version) => version.content.cards.map((card) => card.cardTemplateId)))];
  const cardRoots = await repo.cards().find({ cardTemplateId: { $in: cardIds } }).toArray();
  const requests = cardRoots.map((root) => ({ cardTemplateId: root.cardTemplateId,
    version: user.cardsData.find((data) => data.cardTemplateId === root.cardTemplateId)?.cardTemplateVersion ?? root.latestVersion }));
  const cardVersions = requests.length ? await repo.cardVersions().find({ $or: requests }).toArray() : [];
  return jsonDTO(user.decksData.map((data) => {
    const root = roots.find((root) => root.deckTemplateId === data.deckTemplateId);
    requireCondition(root && (root.ownerUserId === actor || root.visibility === "public"), "DECK_FORBIDDEN");
    const content = data.deckTemplateVersion === null ? root.draft : versions.find((version) => version.deckTemplateId === data.deckTemplateId && version.version === data.deckTemplateVersion)?.content;
    requireCondition(content && (data.deckTemplateVersion !== null || root.ownerUserId === actor), "MISSING_DECK_VERSION");
    const version = versions.find((item) => item.deckTemplateId === data.deckTemplateId && item.version === data.deckTemplateVersion);
    let display: Deck | null = null;
    if (version) {
      const cards = version.content.cards.map((ref) => {
        const card = cardRoots.find((root) => root.cardTemplateId === ref.cardTemplateId);
        requireCondition(card && (card.ownerUserId === actor || card.visibility === "public"), "CARD_FORBIDDEN");
        const personal = user.cardsData.find((item) => item.cardTemplateId === ref.cardTemplateId);
        const selected = personal ? personal.cardTemplateVersion : card.latestVersion;
        requireCondition(selected !== null, "UNPUBLISHED_CARD_ADOPTION");
        const cardVersion = cardVersions.find((item) => item.cardTemplateId === ref.cardTemplateId && item.version === selected);
        requireCondition(cardVersion, "MISSING_CARD_VERSION");
        // Listing is read-only; missing personal data is initialized only by working open.
        const cardData = personal ?? initialCardData(ref.cardTemplateId, selected, cardVersion.content, new Date());
        return { root: { ...card, draft: null }, version: cardVersion, data: cardData, permissions: capabilities(actor, actor, root, card, personal) };
      });
      display = projectWorking({ mode: "working", root: { ...root, draft: null }, version, data, cards, permissions: capabilities(actor, actor, root) }, actor);
    }
    return { display, deckTemplateId: data.deckTemplateId, title: content.title, cardCount: content.cards.length,
      archivedAt: data.archivedAt, openedAt: data.openedAt, adoptedVersion: data.deckTemplateVersion,
      context: data.deckTemplateVersion === null ? "creator" as const : "working" as const,
      templateOwnerUserId: root.ownerUserId, dataOwnerUserId: actor, canEditDeck: root.ownerUserId === actor };
  }));
}
export type MembershipDTO = Awaited<ReturnType<typeof membershipDTO>>[number];
