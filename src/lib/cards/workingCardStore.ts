import { withCardMediaItems, withUpdatedReflection, withUpdatedSignalReading, type CardLayout } from "../../components/cards/cardLayout";
import type { CompletionStatus } from "../../components/decks/types";
import { normalizeCompletionStatus } from "../progress";
import { learningOwnerKey, type CardLearningContext } from "./learningContext";
import { requireCondition } from "./domain";

type PersonalFields = Pick<CardLayout, "targetDate" | "reflection" | "mediaItems"> & {
  adoptedVersion: number | undefined;
  completion: Map<string, CompletionStatus>;
  readings: Map<string, number | null>;
};
// Deck labels, themes, chats and navigation are deliberately absent from this cache.
export class WorkingCardStore {
  private infoRecords = new Map<string, { personalInfoRevision: number; personalInfoCardIds: string[]; personalInfoCardAttachedAt: Record<string, string> }>();
  acceptPersonal(userId: string, source: { cardTemplateId: string; personalInfoRevision?: number; personalInfoCardIds?: string[]; personalInfoCardAttachedAt?: Record<string, string> }) {
    const key = this.key(userId, source.cardTemplateId), previous = this.infoRecords.get(key);
    const revision = source.personalInfoRevision ?? 0;
    if (!previous || revision >= previous.personalInfoRevision) this.infoRecords.set(key, {
      personalInfoRevision: revision, personalInfoCardIds: [...(source.personalInfoCardIds ?? [])], personalInfoCardAttachedAt: { ...source.personalInfoCardAttachedAt },
    });
  }
  private epochs = new Map<string, number>();
  private sessions = new Map<string, number>();
  private listeners = new Map<string, Set<() => void>>();
  epoch(userId: string) { return this.epochs.get(userId) ?? 0; }
  session(userId: string) { return this.sessions.get(userId) ?? 0; }
  subscribe(userId: string, listener: () => void) {
    const listeners = this.listeners.get(userId) ?? new Set<() => void>();
    listeners.add(listener); this.listeners.set(userId, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(userId); };
  }
  invalidate(userId: string) {
    this.epochs.set(userId, this.epoch(userId) + 1);
    for (const listener of [...(this.listeners.get(userId) ?? [])]) listener();
  }
  private records = new Map<string, PersonalFields>();
  private key(userId: string, cardId: string) { return learningOwnerKey(userId, cardId); }
  // The default is the existing personal-only call boundary. Future experience
  // adapters must pass their context and cannot insert private/group DTOs here.
  accept(userId: string, cards: CardLayout[], context?: CardLearningContext, expectedEpoch = this.epoch(userId), expectedSession = this.session(userId)) {
    requireCondition(!context || context.kind === "personal", "PERSONAL_CACHE_CONTEXT_REQUIRED");
    requireCondition(cards.every(card => !card.dataOwnerUserId || card.dataOwnerUserId === userId), "PERSONAL_CACHE_OWNER_MISMATCH");
    if (context) requireCondition(cards.every(card => (card.cardTemplateId ?? card.id) === context.cardTemplateId
      && card.adoptedVersion === context.version), "PERSONAL_CACHE_CONTEXT_MISMATCH");
    if (expectedEpoch !== this.epoch(userId) || expectedSession !== this.session(userId)) return false;
    for (const card of cards) {
      this.acceptPersonal(userId, { ...card, cardTemplateId: card.cardTemplateId ?? card.id });
      for (const source of card.personalHistory ?? []) this.acceptPersonal(userId, source);
      const previous = this.personal(userId, card.id);
      if ((previous?.adoptedVersion ?? 0) > (card.adoptedVersion ?? 0)) continue;
      this.records.set(this.key(userId, card.id), {
      adoptedVersion: card.adoptedVersion, targetDate: card.targetDate, reflection: card.reflection, mediaItems: card.mediaItems,
      completion: new Map(card.steps.map((step) => [step.stepId, normalizeCompletionStatus(step.completionStatus)])),
      readings: new Map(card.signals.map((signal) => [signal.id, signal.rawReading])),
    });
    }
    return true;
  }
  personal(userId: string, cardId: string) { return this.records.get(this.key(userId, cardId)); }
  removeMedia(userId: string, cardId: string, mediaItemId: string) {
    const record = this.personal(userId, cardId);
    if (record) record.mediaItems = record.mediaItems.filter((item) => item.id !== mediaItemId);
  }
  projectPersonal(userId: string, card: CardLayout): CardLayout {
    const info = this.infoRecords.get(this.key(userId, card.id));
    return { ...card, ...(info ?? {}), personalHistory: card.personalHistory?.map(source => ({ ...source,
      ...(this.infoRecords.get(this.key(userId, source.cardTemplateId)) ?? {}) })) };
  }
  project(userId: string, card: CardLayout): CardLayout {
    card = this.projectPersonal(userId, card);
    const data = this.personal(userId, card.id);
    if (!data || data.adoptedVersion !== card.adoptedVersion) return card;
    let result = withUpdatedReflection(withCardMediaItems({ ...card, targetDate: data.targetDate,
      steps: card.steps.map((step) => ({ ...step, completionStatus: data.completion.get(step.stepId) ?? step.completionStatus })) }, data.mediaItems), data.reflection);
    for (const signal of card.signals) if (data.readings.has(signal.id)) result = withUpdatedSignalReading(result, signal.id, data.readings.get(signal.id)!);
    return result;
  }
  clearUser(userId: string) {
    for (const map of [this.records, this.infoRecords]) for (const key of map.keys()) if (JSON.parse(key)[0] === userId) map.delete(key);
    this.sessions.set(userId, this.session(userId) + 1);
    this.invalidate(userId);
  }
  // Shared learning may change through any authorized context. Remove the
  // mixed private-presentation overlay, keeping independent Info revisions.
  // Epoch consumers already reject stale reads and refresh Progress/history.
  invalidateLearning(userId: string, cardTemplateId: string) {
    this.records.delete(this.key(userId, cardTemplateId));
    this.invalidate(userId);
  }
}
export const workingCardStore = new WorkingCardStore();
