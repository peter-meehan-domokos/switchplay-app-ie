import type { ClientSession } from "mongodb";
import type { CardRepository } from "../cards/repository";
import { assertCardContent, assertDeckContent, requireCondition } from "../cards/domain";
import { deckDraftContent } from "../cards/publicationRules";
import { assertCardVersionAccess, assertDeckVersionAccess } from "../cards/versionAccess";
import type { LibraryPreviewManifest } from "../cards/libraryProjection";
import type { CardTemplateVersion } from "../cards/model";
import type { GroupExperience } from "./model";

export async function publicDeck(repo: CardRepository, deckTemplateId: string, version: number, session: ClientSession) {
  const root = await repo.decks().findOne({ deckTemplateId }, { session });
  const selected = await repo.getDeckVersion(deckTemplateId, version, session);
  requireCondition(root && selected, "GROUP_PUBLIC_CONTENT_FORBIDDEN");
  assertDeckVersionAccess(null, root, selected); assertDeckContent(deckDraftContent(selected.content));
  return { root, selected };
}
export async function publicCards(repo: CardRepository, refs: LibraryPreviewManifest["cards"], session: ClientSession) {
  const result: CardTemplateVersion[] = [];
  requireCondition(new Set(refs.map(ref => ref.cardTemplateId)).size === refs.length, "INVALID_GROUP_SELECTIONS");
  for (let start = 0; start < refs.length; start += 100) {
    const batch = refs.slice(start, start + 100);
    const roots = await repo.cards().find({ cardTemplateId: { $in: batch.map(ref => ref.cardTemplateId) } }, { session }).toArray();
    const versions = await repo.cardVersions().find({ $or: batch }, { session }).toArray();
    for (const ref of batch) {
      const root = roots.find(root => root.cardTemplateId === ref.cardTemplateId), selected = versions.find(v => v.cardTemplateId === ref.cardTemplateId && v.version === ref.version);
      requireCondition(root && selected, "GROUP_PUBLIC_CONTENT_FORBIDDEN");
      assertCardVersionAccess(null, root, selected); assertCardContent(selected.content); result.push(selected);
    }
  }
  return result;
}
export async function selectedContent(repo: CardRepository, experience: GroupExperience, session: ClientSession) {
  const { selected: deck } = await publicDeck(repo, experience.deckTemplateId, experience.deckVersion, session);
  const refs = deck.content.cards.map(({ cardTemplateId }) => {
    const selected = experience.cardSelections.filter(ref => ref.cardTemplateId === cardTemplateId);
    requireCondition(selected.length === 1, "INVALID_GROUP_SELECTIONS"); return selected[0];
  });
  return { deck, cards: await publicCards(repo, refs, session) };
}
export async function selectedCard(repo: CardRepository, experience: GroupExperience, cardTemplateId: string, session: ClientSession) {
  const { selected: deck } = await publicDeck(repo, experience.deckTemplateId, experience.deckVersion, session);
  requireCondition(deck.content.cards.some(ref => ref.cardTemplateId === cardTemplateId), "GROUP_CARD_FORBIDDEN");
  const refs = experience.cardSelections.filter(ref => ref.cardTemplateId === cardTemplateId);
  requireCondition(refs.length === 1, "INVALID_GROUP_SELECTIONS");
  return (await publicCards(repo, refs, session))[0];
}
export async function validateCreationManifest(repo: CardRepository, manifest: LibraryPreviewManifest, session: ClientSession) {
  const { root, selected } = await publicDeck(repo, manifest.deckTemplateId, manifest.deckVersion, session);
  requireCondition(root.latestVersion === manifest.deckVersion && selected.content.cards.length === manifest.cards.length
    && selected.content.cards.every((card, index) => card.cardTemplateId === manifest.cards[index].cardTemplateId), "GROUP_PREVIEW_CONFLICT");
  await publicCards(repo, manifest.cards, session);
  // Same canonical lock order as personal entry: Card roots sorted, then Deck.
  for (const ref of [...manifest.cards].sort((a, b) => a.cardTemplateId.localeCompare(b.cardTemplateId))) {
    const result = await repo.cards().updateOne({ cardTemplateId: ref.cardTemplateId, visibility: "public", latestVersion: ref.version },
      { $inc: { referenceRevision: 1 } }, { session });
    requireCondition(result.matchedCount === 1, "GROUP_PREVIEW_CONFLICT");
  }
  const result = await repo.decks().updateOne({ deckTemplateId: manifest.deckTemplateId, visibility: "public", latestVersion: manifest.deckVersion },
    { $inc: { publicationGuard: 1 } }, { session });
  requireCondition(result.matchedCount === 1, "GROUP_PREVIEW_CONFLICT");
}

// Renewal needs the selected publication's continued visibility, not its media,
// step content, creator attribution or restored navigation. Project only the
// immutable references and visibility while still checking every selected Card.
export async function verifySelectedVisibility(repo: CardRepository, experience: GroupExperience, session: ClientSession) {
  type Deck = { visibility: string; versions: { visibility: string; content: { cards: { cardTemplateId: string }[] } }[] };
  const deck = await repo.decks().aggregate<Deck>([
    { $match: { deckTemplateId: experience.deckTemplateId } },
    { $lookup: { from: repo.deckVersions().collectionName, pipeline: [
      { $match: { deckTemplateId: experience.deckTemplateId, version: experience.deckVersion } },
      { $project: { _id: 0, visibility: 1, "content.cards.cardTemplateId": 1 } },
    ], as: "versions" } },
    { $project: { _id: 0, visibility: 1, versions: 1 } },
  ], { session }).next();
  requireCondition(deck?.visibility === "public" && deck.versions.length === 1 && deck.versions[0].visibility === "public", "GROUP_PUBLIC_CONTENT_FORBIDDEN");
  const refs = deck.versions[0].content.cards.map(({ cardTemplateId }) => {
    const selected = experience.cardSelections.filter(ref => ref.cardTemplateId === cardTemplateId);
    requireCondition(selected.length === 1, "INVALID_GROUP_SELECTIONS"); return selected[0];
  });
  requireCondition(new Set(refs.map(ref => ref.cardTemplateId)).size === refs.length, "INVALID_GROUP_SELECTIONS");
  for (let start = 0; start < refs.length; start += 100) {
    const batch = refs.slice(start, start + 100);
    type Card = { cardTemplateId: string; visibility: string; versions: { version: number; visibility: string }[] };
    const roots = await repo.cards().aggregate<Card>([
      { $match: { cardTemplateId: { $in: batch.map(ref => ref.cardTemplateId) } } },
      { $lookup: { from: repo.cardVersions().collectionName, let: { id: "$cardTemplateId" }, pipeline: [
        { $match: { $expr: { $eq: ["$cardTemplateId", "$$id"] }, version: { $in: [...new Set(batch.map(ref => ref.version))] } } },
        { $project: { _id: 0, version: 1, visibility: 1 } },
      ], as: "versions" } },
      { $project: { _id: 0, cardTemplateId: 1, visibility: 1, versions: 1 } },
    ], { session }).toArray();
    for (const ref of batch) {
      const root = roots.find(row => row.cardTemplateId === ref.cardTemplateId);
      requireCondition(root?.visibility === "public" && root.versions.some(row => row.version === ref.version && row.visibility === "public"), "GROUP_PUBLIC_CONTENT_FORBIDDEN");
    }
  }
}
