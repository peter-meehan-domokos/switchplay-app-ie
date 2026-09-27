import { ObjectId } from "mongodb";
import type { AuthUser, UserDocument } from "@/lib/auth";
import type { UserDeckData } from "@/components/decks/types";
import type { getDeckTemplateById, getVisibleDeckTemplateByIdForUser } from "@/lib/deckTemplateQueries";
import { isModernUserCardMediaItem } from "@/lib/userCardMedia";
import type { CardMediaRequest } from "@/lib/cardMediaViewer";

export class CardMediaAccessError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function readCardMediaRequest(value: unknown): CardMediaRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CardMediaAccessError("Invalid media request.", 400);
  const fields = ["deckUserId", "deckTemplateId", "cardId", "mediaItemId"] as const;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !fields.includes(key as typeof fields[number])) ||
      fields.some((key) => typeof record[key] !== "string" || !(record[key] as string).trim() || (record[key] as string).length > 240)) {
    throw new CardMediaAccessError("Invalid card or media identity.", 400);
  }
  if (!ObjectId.isValid(record.deckUserId as string)) throw new CardMediaAccessError("Invalid deck user.", 400);
  return Object.fromEntries(fields.map((key) => [key, (record[key] as string).trim()])) as CardMediaRequest;
}

type AccessDependencies = {
  loadOwnerDecks: (ownerId: string) => Promise<UserDeckData[] | null>;
  loadTemplate: typeof getDeckTemplateById;
  loadVisibleTemplate: typeof getVisibleDeckTemplateByIdForUser;
};
const dependencies: AccessDependencies = {
  loadOwnerDecks: async (ownerId) => {
    const { getCollection } = await import("@/lib/mongodb");
    const users = await getCollection<UserDocument>("users");
    const owner = await users.findOne({ _id: new ObjectId(ownerId) }, { projection: { decksData: 1 } });
    return owner?.decksData ?? null;
  },
  loadTemplate: async (id) => (await import("@/lib/deckTemplateQueries")).getDeckTemplateById(id),
  loadVisibleTemplate: async (user, id) => (await import("@/lib/deckTemplateQueries")).getVisibleDeckTemplateByIdForUser(user, id),
};

// Read access is deliberately separate from upload/mutation authorization.
export async function resolveAccessibleCardMedia(user: AuthUser, target: CardMediaRequest, deps = dependencies) {
  const isOwnData = target.deckUserId === user.id;
  const sharedReference = user.sharedDeckData.some((entry) => entry.deckUserId === target.deckUserId && entry.deckTemplateId === target.deckTemplateId);
  if (!isOwnData && !user.isAdmin && !sharedReference) throw new CardMediaAccessError("You do not have access to this card media.", 403);
  const decks = isOwnData ? user.decksData : await deps.loadOwnerDecks(target.deckUserId);
  const deck = decks?.find((candidate) => candidate.deckTemplateId === target.deckTemplateId);
  if (!deck) throw new CardMediaAccessError("Card media was not found.", 404);
  if (!isOwnData && !user.isAdmin && !deck.sharedWithUserIds.includes(user.id)) throw new CardMediaAccessError("This deck is no longer shared with you.", 403);
  const template = isOwnData && !user.isAdmin
    ? await deps.loadVisibleTemplate(user, target.deckTemplateId)
    : await deps.loadTemplate(target.deckTemplateId);
  if (!template?.cards.some((card) => card.cardId === target.cardId)) throw new CardMediaAccessError("Card media was not found.", 404);
  const item = deck.cards.find((card) => card.cardId === target.cardId)?.mediaItems.find((media) => media.id === target.mediaItemId);
  if (!isModernUserCardMediaItem(item)) throw new CardMediaAccessError("Card media was not found.", 404);
  if (item.mediaType === "image") {
    const prefix = `user-decks/${target.deckUserId}/${target.deckTemplateId}/cards/${target.cardId}/`;
    if (!item.assetId.startsWith(prefix) || !/^[a-zA-Z0-9-]+\.(avif|gif|jpg|jpeg|png|webp)$/i.test(item.assetId.slice(prefix.length))) {
      throw new CardMediaAccessError("The stored image is unavailable.", 422);
    }
  } else if (!/^[a-zA-Z0-9_-]+$/.test(item.assetId)) {
    throw new CardMediaAccessError("The stored video is unavailable.", 422);
  }
  return item;
}
