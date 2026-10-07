import { createHash } from "node:crypto";
import type { CardRepository } from "./repository";
import { requireCondition } from "./domain";
import type { DeckContent } from "./model";
import { deckDraftContent } from "./publicationRules";

export type CopyDestination = { deckTemplateId: string; title: string; revision: number; contentHash: string; alreadyContains: boolean };
export type CopyCardCommand = { deckTemplateId: string; revision: number; contentHash: string };
export type CopyCardResult = {
  deckTemplateId: string; revision: number; firstReusedAt: Date;
} & ({ outcome: "draft"; publishedVersion: null } | { outcome: "published"; publishedVersion: number });
// Opaque server-generated content comparison token, never Card identity.
export function deckContentHash(content: DeckContent) {
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
    : value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])) : value;
  return createHash("sha256").update(JSON.stringify(stable(content))).digest("hex");
}
export async function copyDestinations(repo: CardRepository, actor: string, cardTemplateId: string, currentDeckTemplateId: string): Promise<CopyDestination[]> {
  requireCondition(typeof cardTemplateId === "string" && typeof currentDeckTemplateId === "string", "INVALID_ENTITY_ID");
  const source = await repo.cards().findOne({ cardTemplateId }, { projection: { ownerUserId: 1 } });
  requireCondition(source?.ownerUserId === actor, "CARD_FORBIDDEN");
  const roots = await repo.decks().find({ ownerUserId: actor, deckTemplateId: { $ne: currentDeckTemplateId } }).toArray();
  const clean = roots.filter((root) => root.draft === null);
  const versions = clean.length ? await repo.deckVersions().find({ $or: clean.map((root) => ({ deckTemplateId: root.deckTemplateId, version: root.latestVersion })) }).toArray() : [];
  return roots.map((root) => {
    const published = versions.find((version) => version.deckTemplateId === root.deckTemplateId);
    const content = root.draft ?? (published ? deckDraftContent(published.content) : null);
    requireCondition(content, "MISSING_DECK_CONTENT");
    return { deckTemplateId: root.deckTemplateId, title: content.title, revision: root.revision,
      contentHash: deckContentHash(content), alreadyContains: content.cards.some((ref) => ref.cardTemplateId === cardTemplateId) };
  }).sort((a, b) => a.title.localeCompare(b.title) || a.deckTemplateId.localeCompare(b.deckTemplateId));
}
