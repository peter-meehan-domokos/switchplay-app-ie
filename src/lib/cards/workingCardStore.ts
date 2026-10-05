import { withCardMediaItems, withUpdatedReflection, withUpdatedSignalReading, type CardLayout } from "../../components/cards/cardLayout";
import type { CompletionStatus } from "../../components/decks/types";
import { normalizeCompletionStatus } from "../progress";

type PersonalFields = Pick<CardLayout, "targetDate" | "reflection" | "mediaItems"> & {
  adoptedVersion: number | undefined;
  completion: Map<string, CompletionStatus>;
  readings: Map<string, number | null>;
};
// Deck labels, themes, chats and navigation are deliberately absent from this cache.
export class WorkingCardStore {
  private records = new Map<string, PersonalFields>();
  private key(userId: string, cardId: string) { return JSON.stringify([userId, cardId]); }
  accept(userId: string, cards: CardLayout[]) {
    for (const card of cards) this.records.set(this.key(userId, card.id), {
      adoptedVersion: card.adoptedVersion, targetDate: card.targetDate, reflection: card.reflection, mediaItems: card.mediaItems,
      completion: new Map(card.steps.map((step) => [step.stepId, normalizeCompletionStatus(step.completionStatus)])),
      readings: new Map(card.signals.map((signal) => [signal.id, signal.rawReading])),
    });
  }
  personal(userId: string, cardId: string) { return this.records.get(this.key(userId, cardId)); }
  project(userId: string, card: CardLayout): CardLayout {
    const data = this.personal(userId, card.id);
    if (!data || data.adoptedVersion !== card.adoptedVersion) return card;
    let result = withUpdatedReflection(withCardMediaItems({ ...card, targetDate: data.targetDate,
      steps: card.steps.map((step) => ({ ...step, completionStatus: data.completion.get(step.stepId) ?? step.completionStatus })) }, data.mediaItems), data.reflection);
    for (const signal of card.signals) if (data.readings.has(signal.id)) result = withUpdatedSignalReading(result, signal.id, data.readings.get(signal.id)!);
    return result;
  }
  clearUser(userId: string) { for (const key of this.records.keys()) if (JSON.parse(key)[0] === userId) this.records.delete(key); }
}
export const workingCardStore = new WorkingCardStore();
