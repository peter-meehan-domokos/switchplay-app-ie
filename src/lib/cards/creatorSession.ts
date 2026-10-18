import type { CardRepository } from "./repository";
import type { CardContent, CardForkSource, DeckContent, DeckForkSource, ForkContext } from "./model";
import type { CreatorDTO } from "./readModels";
import { resolveCreatorCard, resolveCreatorDeck } from "./resolvers";
import { assertCardVersionAccess, assertDeckVersionAccess } from "./versionAccess";
import { assertAdoption, requireCondition } from "./domain";
import { deckDraftContent } from "./publicationRules";
import { jsonDTO } from "./http";

export type CreatorSessionDTO = {
  actor: string;
  context: ForkContext;
  deck: { kind: "owned"; owned: Omit<CreatorDTO, "cards"> } | { kind: "foreign"; source: DeckForkSource; content: DeckContent; ownerUserId: string };
  cards: ({ kind: "owned"; owned: CreatorDTO["cards"][number] } | { kind: "foreign"; source: CardForkSource; content: CardContent; ownerUserId: string })[];
};

// Foreign authoring is an exact immutable selection, never a draft or a personal projection.
export async function creatorSessionDTO(repo: CardRepository, actor: string, id: string,
  context: ForkContext = { kind: "library" }, selectedDeckVersion?: number, selectedCards?: CardForkSource[]): Promise<CreatorSessionDTO> {
  const root = await repo.decks().findOne({ deckTemplateId: id });
  requireCondition(root, "MISSING_DECK_REFERENCE");
  let deck: CreatorSessionDTO["deck"], content: DeckContent;
  const selections = new Map<string, number>();
  requireCondition(selectedCards === undefined || Array.isArray(selectedCards), "INVALID_FOREIGN_SELECTIONS");
  if (context.kind === "library") for (const ref of selectedCards ?? []) { assertAdoption(ref.version); selections.set(ref.cardTemplateId, ref.version); }
  // Working entry selects adopted foreign Cards even when the Deck itself is
  // owned. Saved authoring selections below take precedence on draft reopening.
  const personal = context.kind === "my-decks" ? await repo.getPersonalUser(actor) : null;
  if (personal) for (const card of personal.cardsData) selections.set(card.cardTemplateId, card.cardTemplateVersion);
  if (root.ownerUserId === actor) {
    const own = await resolveCreatorDeck(repo, actor, id);
    const { _id, ...ownedRoot } = own.root; void _id;
    deck = { kind: "owned", owned: { root: ownedRoot, content: own.content, publishedContent: own.publishedContent } };
    content = own.content;
    for (const ref of root.foreignCardSelections ?? []) selections.set(ref.cardTemplateId, ref.version);
  } else {
    let version = selectedDeckVersion ?? root.latestVersion;
    if (context.kind === "my-decks") {
      requireCondition(context.deckTemplateId === id, "FORK_OUTSIDE_PERSONAL_CONTEXT");
      const user = personal;
      const data = user?.decksData.find((item) => item.deckTemplateId === id && item.archivedAt === null);
      requireCondition(data, "FORK_OUTSIDE_PERSONAL_CONTEXT");
      requireCondition(selectedDeckVersion === undefined || selectedDeckVersion === data.deckTemplateVersion, "FORK_OUTSIDE_PERSONAL_CONTEXT");
      version = data.deckTemplateVersion;
    }
    assertAdoption(version);
    const published = await repo.getDeckVersion(id, version);
    requireCondition(published && version <= root.latestVersion, "MISSING_DECK_VERSION");
    assertDeckVersionAccess(actor, root, published);
    content = deckDraftContent(published.content);
    deck = { kind: "foreign", source: { deckTemplateId: id, version }, content, ownerUserId: root.ownerUserId };
  }
  const cards: CreatorSessionDTO["cards"] = [];
  for (const ref of content.cards) {
    const card = await repo.cards().findOne({ cardTemplateId: ref.cardTemplateId });
    requireCondition(card, "MISSING_CARD_REFERENCE");
    if (card.ownerUserId === actor) {
      const own = await resolveCreatorCard(repo, actor, card.cardTemplateId);
      const { _id, ...ownedRoot } = own.root; void _id;
      cards.push({ kind: "owned", owned: { ...own, root: ownedRoot } });
    } else {
      const version = selections.get(card.cardTemplateId) ?? card.latestVersion;
      assertAdoption(version);
      const published = await repo.getCardVersion(card.cardTemplateId, version);
      requireCondition(published && version <= card.latestVersion, "MISSING_CARD_VERSION");
      assertCardVersionAccess(actor, card, published);
      cards.push({ kind: "foreign", source: { cardTemplateId: card.cardTemplateId, version }, content: published.content, ownerUserId: card.ownerUserId });
    }
  }
  return jsonDTO({ actor, context, deck, cards });
}
