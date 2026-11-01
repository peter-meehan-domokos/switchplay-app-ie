import type { ClientSession } from "mongodb";
import { requireCondition } from "../cards/domain";
import type { CardRepository } from "../cards/repository";
import { getFrameworks, type Framework } from "../frameworks/configuration";
import { GroupExperienceRepository } from "./repository";
import { groupProgressContext, type ProgressPerspective } from "./progressContext";
import { cardContentPresentation } from "../cards/libraryProjection";
import { cardCreatorAttributions } from "../cards/creatorAttribution";
import { layoutCardLabels } from "../cards/layout";
import type { DeckFrontPresentation } from "../../components/decks/deckFrontPresentation";
import { publicDeck } from "./publicVersions";
import { publishedLibraryEntries } from "../cards/libraryReadModels";
import { deckFrontPresentation } from "../../components/decks/deckFrontPresentation";
import { readCanonicalAncestry } from "../frameworks/mappingRepository";
import { resolveEffectiveMapping } from "../frameworks/mapping";
import type { LibraryDeckDestination, ItemCardDestination } from "../frameworks/destinations";
import type { CanonicalCardPresentation } from "../../components/decks/presentation";

export type ExperienceDestination = { kind: "experience"; experienceId: string; name: string; deckTemplateId: string; adoptedDeckVersion: number;
  adoptionRevision: number; structureRevision: number; matchingCardCount: number; availability: "available"; front: DeckFrontPresentation };
export type ExperienceCardDestination = { cardTemplateId: string; version: number; presentation: CanonicalCardPresentation; context: ExperienceDestination };
export async function experienceDestinations(repo: GroupExperienceRepository, actor: string, experienceId: string, frameworkId: string,
  scope: { areaId: string } | { itemId: string }, perspective: ProgressPerspective, session: ClientSession, frameworks: readonly Framework[] = getFrameworks()) {
  const context = await groupProgressContext(repo, actor, experienceId, frameworkId, perspective, session, frameworks);
  const area = context.scope.areas.find(area => "areaId" in scope ? area.areaId === scope.areaId : area.items.some(item => item.frameworkItemId === scope.itemId));
  requireCondition(area, "GROUP_PROGRESS_SOURCE_FORBIDDEN");
  const selected = "itemId" in scope ? area.items.find(item => item.frameworkItemId === scope.itemId)! : area;
  requireCondition(selected.coverage !== "unknown", "GROUP_PROGRESS_SCOPE_UNAVAILABLE");
  const cards = context.cards.filter(card => selected.cardTemplateIds.includes(card.cardTemplateId));
  const roots = cards.length ? await repo.cards.cards().find({ cardTemplateId: { $in: cards.map(card => card.cardTemplateId) } }, { session }).toArray() : [];
  const creators = await cardCreatorAttributions(repo.cards, roots, session);
  const { selected: deck } = await publicDeck(repo.cards, context.experience.deckTemplateId, context.experience.deckVersion, session);
  const labels = layoutCardLabels(deck.content.labelPrefix, deck.content.cards);
  const entry: ExperienceDestination = { kind: "experience", experienceId, name: context.experience.name, deckTemplateId: context.experience.deckTemplateId,
    adoptedDeckVersion: context.experience.deckVersion, adoptionRevision: context.experience.adoptionRevision, structureRevision: context.experience.structureRevision,
    matchingCardCount: cards.length, availability: "available", front: { context: "canonical", id: experienceId, title: context.experience.name,
      category: null, ownerUsername: "", showOwnerTag: false, cardCount: context.cards.length, cardIds: context.cards.slice(0, 3).map(card => card.cardTemplateId), themes: [], posterSrc: null, hasIntroVideo: false } };
  return { ...context.authority, areaId: area.areaId, ...( "itemId" in scope ? { itemId: scope.itemId } : {}), entry: cards.length ? entry : null,
    cards: cards.map(card => ({ cardTemplateId: card.cardTemplateId, version: card.version, context: entry,
      presentation: cardContentPresentation(card, labels.find(label => label.cardTemplateId === card.cardTemplateId)!.label, creators.get(card.cardTemplateId)!) })) };
}
export async function personalExperienceDestinations(repo: CardRepository, actor: string, frameworkId: string, scope: { areaId: string } | { itemId: string },
  session: ClientSession, frameworks: readonly Framework[]) {
  const groups = new GroupExperienceRepository(repo);
  const members = await groups.members().find({ userId: actor, followerStatus: "active" }, { session, projection: { _id: 0, experienceId: 1 } }).toArray();
  const results: Awaited<ReturnType<typeof experienceDestinations>>[] = [];
  for (const member of members) results.push(await experienceDestinations(groups, actor, member.experienceId, frameworkId, scope, { kind: "player", userId: actor }, session, frameworks));
  return results;
}

export async function readGroupProgressDestinations(repo: GroupExperienceRepository, actor: string, experienceId: string, frameworkId: string,
  scope: { areaId: string } | { itemId: string }, perspective: ProgressPerspective, frameworks: readonly Framework[] = getFrameworks()) {
  return repo.transaction(async session => {
    const selected = await experienceDestinations(repo, actor, experienceId, frameworkId, scope, perspective, session, frameworks);
    const empty = { state: "empty" as const, count: 0, entries: [], issues: [] };
    const library: { state: "empty" | "complete" | "incomplete"; count: number | null; entries: LibraryDeckDestination[]; issues: { code: string }[] } = { ...empty, entries: [] };
    const publicCards = new Map<string, ItemCardDestination>();
    // Outside learning can be browsed canonically through the existing Library.
    // This supplies no assignment, personal learning or wider Group destination.
    if (!selected.entry) {
      const framework = frameworks.find(value => value.id === frameworkId)!;
      const published = (await publishedLibraryEntries(repo.cards, actor, session)).filter(value => value.availability === "available");
      const graph = await readCanonicalAncestry(repo.cards, [framework], published.flatMap(value => value.availability === "available" ? value.manifest.cards.map(card => card.cardTemplateId) : []), session);
      for (const entry of published) {
        if (entry.availability !== "available") continue;
        // This is canonical Library discovery, not another Group learning
        // plan. Current Group numeric/evidence scope stays unchanged above.
        const matches = entry.manifest.cards.map(card => ({ id: card.cardTemplateId, mapping: resolveEffectiveMapping(framework, card.cardTemplateId, graph) }));
        if (matches.some(value => value.mapping.state === "incomplete")) { library.issues.push({ code: "UNRESOLVED_CARD_MAPPING" }); continue; }
        const ids = matches.filter(value => value.mapping.state === "mapped" && ("itemId" in scope ? value.mapping.itemId === scope.itemId : value.mapping.areaId === scope.areaId)).map(value => value.id);
        if (!ids.length) continue;
        const destination: LibraryDeckDestination = { kind: "library", deckTemplateId: entry.deckTemplateId, matchingCardCount: ids.length, manifest: entry.manifest, front: deckFrontPresentation(entry.deck) };
        library.entries.push(destination);
        for (const presentation of entry.deck.cards.filter(card => ids.includes(card.cardTemplateId))) {
          const previous = publicCards.get(presentation.cardTemplateId), context = { ...destination, cardVersion: presentation.version };
          if (previous) previous.contexts.push(context);
          else publicCards.set(presentation.cardTemplateId, { cardTemplateId: presentation.cardTemplateId, presentation, presentationContext: "library", versionsDiffer: false, contexts: [context] });
        }
      }
      library.count = library.issues.length ? null : library.entries.length; library.state = library.issues.length ? "incomplete" : library.count ? "complete" : "empty";
    }
    const common = { ...selected, myDecks: empty, archived: empty, library, experiences: { entries: selected.entry ? [selected.entry] : [] } };
    const cards: ItemCardDestination[] = selected.cards.map(card => ({ cardTemplateId: card.cardTemplateId, presentation: card.presentation,
      presentationContext: "experience", versionsDiffer: false, contexts: [{ ...card.context, cardVersion: card.version }] }));
    cards.push(...publicCards.values());
    return "itemId" in scope ? { ...common, itemId: scope.itemId, state: cards.length ? "complete" as const : "empty" as const,
      count: cards.length, issues: [], cards } : common;
  });
}
