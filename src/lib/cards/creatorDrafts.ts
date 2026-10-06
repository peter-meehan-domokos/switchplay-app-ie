import type { CardRepository } from "./repository";
import { requireCondition, nonblank } from "./domain";

export type CreatorDraftSummary = {
  deckTemplateId: string;
  title: string;
  status: "unpublished" | "deck-draft" | "card-drafts";
  updatedAt: string;
};
type Composition = { title: string; cards: { cardTemplateId: string }[] };
type DraftRoot = { deckTemplateId: string; latestVersion: number; draft?: Composition | null; updatedAt: Date };
type Baseline = { deckTemplateId: string; content: Composition };

// Creator ownership is independent of adoption/archive state. All reads are
// projected and batched: no personal data or Card content is loaded for this list.
export async function creatorDrafts(repo: CardRepository, actor: string): Promise<CreatorDraftSummary[]> {
  requireCondition(nonblank(actor), "INVALID_ENTITY_ID");
  const roots = await repo.decks().find<DraftRoot>({ ownerUserId: actor }, { projection: {
    _id: 0, deckTemplateId: 1, latestVersion: 1, "draft.title": 1, "draft.cards": 1, updatedAt: 1,
  } }).toArray();
  // A dotted projection omits the parent when the stored draft is null.
  const clean = roots.filter((root) => root.draft == null && root.latestVersion >= 1);
  const versions = clean.length ? await repo.deckVersions().find<Baseline>({ $or: clean.map((root) => ({
    deckTemplateId: root.deckTemplateId, version: root.latestVersion,
  })) }, { projection: { _id: 0, deckTemplateId: 1, "content.title": 1, "content.cards": 1 } }).toArray() : [];
  const baselines = new Map(versions.map((version) => [version.deckTemplateId, version.content]));
  const compositions = roots.map((root) => {
    const content = root.draft ?? baselines.get(root.deckTemplateId);
    requireCondition(content, root.latestVersion ? "MISSING_DECK_VERSION" : "MISSING_DRAFT");
    return { root, content };
  });
  const ids = [...new Set(compositions.flatMap(({ content }) => content.cards.map((card) => card.cardTemplateId)))];
  const cards = ids.length ? await repo.cards().find<{ cardTemplateId: string; updatedAt: Date }>({
    ownerUserId: actor, cardTemplateId: { $in: ids }, draft: { $ne: null },
  }, { projection: { _id: 0, cardTemplateId: 1, updatedAt: 1 } }).toArray() : [];
  const cardDates = new Map(cards.map((card) => [card.cardTemplateId, card.updatedAt.getTime()]));
  return compositions.flatMap(({ root, content }) => {
    const outstanding = content.cards.flatMap((ref) => cardDates.has(ref.cardTemplateId) ? [cardDates.get(ref.cardTemplateId)!] : []);
    if (root.draft == null && outstanding.length === 0) return [];
    return [{ deckTemplateId: root.deckTemplateId, title: content.title,
      status: root.latestVersion === 0 ? "unpublished" as const : root.draft != null ? "deck-draft" as const : "card-drafts" as const,
      updatedAt: new Date(Math.max(root.updatedAt.getTime(), ...outstanding)).toISOString() }];
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.deckTemplateId.localeCompare(b.deckTemplateId));
}
