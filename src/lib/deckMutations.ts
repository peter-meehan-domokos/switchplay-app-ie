import type { CompletionStatus } from "@/components/decks/types";
import type { MediaItem } from "@/lib/media";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";
const queues = new Map<string, Promise<unknown>>();
const pending = new Set<Promise<unknown>>();
export async function flushPersonalMutations() {
  while (pending.size) await Promise.all([...pending]);
}
async function mutate(deckTemplateId: string, key: string, body: unknown) {
  const result = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const response = await fetch(`/api/decks-data/${encodeURIComponent(deckTemplateId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Unable to save change"); return payload;
  });
  queues.set(key, result); pending.add(result);
  void result.then(() => { pending.delete(result); if (queues.get(key) === result) queues.delete(key); }, () => { pending.delete(result); if (queues.get(key) === result) queues.delete(key); });
  return result;
}
export function createCardMediaAppendRequestBody(cardId: string, mediaItem: ModernUserCardMediaItem) { return { type: "append-card-media" as const, cardTemplateId: cardId, mediaItem }; }
export function createCardMediaRemovalRequestBody(cardId: string, mediaItemId: string) { return { type: "remove-card-media" as const, cardTemplateId: cardId, mediaItemId }; }
export function persistActiveCardId(deck: string, id: string) { return mutate(deck, `deck:${deck}:active`, { type: "active", activeCardId: id }); }
export function persistStepCompletionStatus(deck: string, card: string, step: string, completionStatus: CompletionStatus) { return mutate(deck, `card:${card}:completion:${step}`, { type: "completion", cardTemplateId: card, stepId: step, completionStatus }); }
export function persistCardTargetDate(deck: string, card: string, targetDate: string) { return mutate(deck, `card:${card}:date`, { type: "target-date", cardTemplateId: card, targetDate }); }
export function persistCardReflection(deck: string, card: string, reflection: string | null) { return mutate(deck, `card:${card}:reflection`, { type: "reflection", cardTemplateId: card, reflection: reflection ?? "" }); }
export function persistSignalReading(deck: string, card: string, step: string, reading: number) { return mutate(deck, `card:${card}:signal:${step}`, { type: "signal", cardTemplateId: card, stepId: step, reading }); }
export function appendCardMediaItem(deck: string, card: string, item: ModernUserCardMediaItem): Promise<{ cardId: string; deckTemplateId: string; mediaItems: MediaItem[]; ok: true }> { return mutate(deck, `card:${card}:media`, createCardMediaAppendRequestBody(card, item)); }
export function removeCardMediaItem(deck: string, card: string, id: string): Promise<{ cardId: string; deckTemplateId: string; mediaItems: MediaItem[]; ok: true }> { return mutate(deck, `card:${card}:media`, createCardMediaRemovalRequestBody(card, id)); }
