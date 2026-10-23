import type { AuthUser } from "@/lib/auth";
import { CardRepository } from "@/lib/cards/repository";
import { personalHistorySegments } from "@/lib/cards/forks";
import type { CardData } from "@/lib/cards/model";
import type { CardMediaRequest } from "@/lib/cardMediaViewer";
import type { MediaItem } from "@/lib/media";
import { assertNotInfoMedia } from "@/lib/infoCards/mediaRegistry";

export class CardMediaAccessError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function readCardMediaRequest(value: unknown): CardMediaRequest {
  const fields = ["viewerUserId", "cardTemplateId", "sourceCardTemplateId", "mediaItemId"] as const;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CardMediaAccessError("Invalid media request.", 400);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== fields.length || Object.keys(record).some(key => !fields.includes(key as typeof fields[number])) ||
    fields.some(key => typeof record[key] !== "string" || !(record[key] as string).trim() || (record[key] as string).length > 240))
    throw new CardMediaAccessError("Invalid Card or media identity.", 400);
  return Object.fromEntries(fields.map(key => [key, record[key]])) as CardMediaRequest;
}
const dependencies = {
  loadCards: async (actor: string): Promise<CardData[] | undefined> => (await (await CardRepository.application()).getPersonalUser(actor))?.cardsData,
  assertMediaScope: async (item: MediaItem) => {
    const repo = await CardRepository.application();
    try {
      if (item.mediaType === "image") await assertNotInfoMedia(repo.db, "r2", item.src);
      else if (item.provider === "cloudflare-stream") await assertNotInfoMedia(repo.db, "stream", item.assetId);
    } catch { throw new CardMediaAccessError("Card media is unavailable.", 403); }
  },
};
// Only the signed-in learner's retained personal history grants read/download access.
// Deck/template ownership, admin status and canonical ancestry grant no other user's media.
export async function resolveAccessibleCardMedia(user: AuthUser, target: CardMediaRequest,
  deps: { loadCards: typeof dependencies.loadCards; assertMediaScope?: typeof dependencies.assertMediaScope } = dependencies) {
  if (target.viewerUserId !== user.id) throw new CardMediaAccessError("Your account changed. Reopen the media viewer.", 403);
  const records = await deps.loadCards(user.id);
  if (!Array.isArray(records) || records.filter(card => card?.cardTemplateId === target.cardTemplateId).length !== 1) throw new CardMediaAccessError("Card media is unavailable.", 404);
  const segments = personalHistorySegments(records, target.cardTemplateId);
  const segment = segments.find(source => source.cardTemplateId === target.sourceCardTemplateId);
  const item = segment?.mediaItems.find(media => media.id === target.mediaItemId);
  if (!item) throw new CardMediaAccessError("Card media is unavailable.", 404);
  await deps.assertMediaScope?.(item);
  return item;
}
