import { personalWork } from "./cards/personalWork";
import type { CompletionStatus } from "@/components/decks/types";
import type { MediaItem } from "@/lib/media";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";
const queues = new Map<string, Promise<unknown>>();
const pending = new Set<Promise<unknown>>();
export async function flushPersonalMutations() {
  while (pending.size) await Promise.all([...pending]);
}
export function enqueuePersonalMutation<Result>(key: string, operation: () => Promise<Result>) {
  const result = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
  queues.set(key, result); pending.add(result);
  void result.then(() => { pending.delete(result); if (queues.get(key) === result) queues.delete(key); }, () => { pending.delete(result); if (queues.get(key) === result) queues.delete(key); });
  return result;
}
async function mutate(deckTemplateId: string, key: string, body: unknown, userId?: string, cardId?: string) {
  const operation = () => enqueuePersonalMutation(JSON.stringify([userId, key]), async () => {
    const response = await fetch(`/api/decks-data/${encodeURIComponent(deckTemplateId)}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...(userId ? { "X-Personal-Viewer": userId } : {}) }, body: JSON.stringify(body) });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Unable to save change"); return payload;
  });
  return userId ? personalWork.run({ userId, ...(cardId ? {} : { deckId: deckTemplateId }), cardIds: cardId ? [cardId] : [] }, key, operation) : operation();
}
export function createCardMediaAppendRequestBody(cardId: string, mediaItem: ModernUserCardMediaItem) { return { type: "append-card-media" as const, cardTemplateId: cardId, mediaItem }; }
export function createCardMediaRemovalRequestBody(cardId: string, mediaItemId: string) { return { type: "remove-card-media" as const, cardTemplateId: cardId, mediaItemId }; }
export function persistActiveCardId(deck: string, id: string, userId?: string) { return mutate(deck, `deck:${deck}:active`, { type: "active", activeCardId: id }, userId); }
export function persistStepCompletionStatus(deck: string, card: string, step: string, completionStatus: CompletionStatus, userId?: string) { return mutate(deck, `card:${card}:completion:${step}`, { type: "completion", cardTemplateId: card, stepId: step, completionStatus }, userId, card); }
export function persistCardTargetDate(deck: string, card: string, targetDate: string, userId?: string) { return mutate(deck, `card:${card}:date`, { type: "target-date", cardTemplateId: card, targetDate }, userId, card); }
export function persistCardReflection(deck: string, card: string, reflection: string | null, userId?: string) { return mutate(deck, `card:${card}:reflection`, { type: "reflection", cardTemplateId: card, reflection: reflection ?? "" }, userId, card); }
export function persistSignalReading(deck: string, card: string, step: string, reading: number, userId?: string) { return mutate(deck, `card:${card}:signal:${step}`, { type: "signal", cardTemplateId: card, stepId: step, reading }, userId, card); }
export function appendCardMediaItem(deck: string, card: string, item: ModernUserCardMediaItem, userId?: string): Promise<{ cardId: string; deckTemplateId: string; mediaItems: MediaItem[]; ok: true }> { return mutate(deck, `card:${card}:media`, createCardMediaAppendRequestBody(card, item), userId, card); }
export function removeCardMediaItem(deck: string, card: string, id: string, userId?: string): Promise<{ cardId: string; deckTemplateId: string; mediaItems: MediaItem[]; ok: true }> { return mutate(deck, `card:${card}:media`, createCardMediaRemovalRequestBody(card, id), userId, card); }
export async function removePersonalCardMediaItem(card: string, id: string, userId?: string): Promise<{ cardId: string; mediaItems: MediaItem[]; ok: true }> {
  const operation = () => enqueuePersonalMutation(JSON.stringify([userId, `card:${card}:media`]), async () => {
    const response = await fetch(`/api/cards-data/${encodeURIComponent(card)}/media/${encodeURIComponent(id)}`, { method: "DELETE", headers: userId ? { "X-Personal-Viewer": userId } : {} });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Unable to remove personal media");
    return payload;
  });
  return userId ? personalWork.run({ userId, cardIds: [card] }, `card:${card}:media`, operation) : operation();
}
