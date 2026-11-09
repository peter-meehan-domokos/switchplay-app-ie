import { requireCondition } from "./domain";
import type { ClientSession } from "mongodb";
import type { Deck } from "../../components/decks/types";
import { workingSelection } from "./resolvers";
import { prepareCardAssessmentHistories } from "../frameworks/readModels";
import type { MediaCollectionPage } from "../mediaCollection/contracts";
import type { ReflectionFeed } from "../reflections/reads";
import type { CardRepository } from "./repository";
import { workingDTO, workingSelectionDTO } from "./readModels";
import { GroupExperienceRepository } from "../groupExperiences/repository";
import { groupMediaAvailable } from "../groupExperiences/readiness";
import { ownerPreviewPages } from "../mediaCollection/preparation";
import { readReflectionFeedsInSession } from "../reflections/reads";
import { personalPreparationIdentity } from "./preparationIdentity";

// Known-empty pages/feeds are required entries, never omitted placeholders.
export type PreparedContributions = { media: Record<string, MediaCollectionPage>; reflections: Record<string, ReflectionFeed> };
export async function preparePersonalDeck(repo: CardRepository, actor: string, deckId: string) {
  const hasGroups = await groupMediaAvailable(repo);
  return repo.transaction(async session => preparePersonalInSession(repo, actor, await workingDTO(repo, actor, deckId, session), session, hasGroups));
}
async function preparePersonalInSession(repo: CardRepository, actor: string, deck: Deck, session: ClientSession, hasGroups: boolean) {
    const ids = deck.cards.map(card => card.id);
    const media = await ownerPreviewPages(repo, actor, ids, session, hasGroups);
    const reflections = await readReflectionFeedsInSession(new GroupExperienceRepository(repo), actor, ids, { kind: "personal" }, session, undefined, true);
    // Full owner histories remain available through the history/Gallery readers.
    // The scene needs only the exact retained preview window, not every image.
    for (const card of deck.cards) {
      const selected = media[card.id].items.filter(item => item.source.kind === "personal");
      const keep = (source: string, id: string) => selected.some(item => item.source.kind === "personal" && item.source.cardTemplateId === source && item.source.mediaItemId === id);
      card.mediaItems = card.mediaItems.filter(item => keep(card.id, item.id));
      card.personalHistory = card.personalHistory?.map(segment => ({ ...segment, mediaItems: segment.mediaItems.filter(item => keep(segment.cardTemplateId, item.id)) }));
    }
    deck.preparedAssessments = await prepareCardAssessmentHistories(repo, actor, ids, session);
    return { viewerUserId: actor, deck, contributions: { media, reflections } satisfies PreparedContributions };
}


export async function openPreparedPersonalDeck(repo: CardRepository, actor: string, deckId: string, localDate: string, cardId?: string, expectedVersion?: number, preparedComposition?: string) {
  const hasGroups = await groupMediaAvailable(repo);
  const result = await repo.openWorkingDeck(actor, deckId, localDate, cardId, expectedVersion, async (opened, session) => {
    const selection = workingSelection(actor, opened.user, opened.root, opened.version, opened.cards);
    const deck = await workingSelectionDTO(repo, actor, selection, session);
    // The browser already holds complete authorised preview resources. Actual
    // entry still resolves current membership/content and initialises dates.
    // A changed composition falls back to the full existing composed reader.
    if (preparedComposition === personalPreparationIdentity(deck)) return { viewerUserId: actor, deck,
      contributions: { media: {}, reflections: {} } as PreparedContributions, reusePrepared: true };
    return preparePersonalInSession(repo, actor, deck, session, hasGroups);
  });
  requireCondition(result, "WORKING_DECK_REQUIRED"); return result;
}
