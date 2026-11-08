import { withCardMediaItems, withUpdatedReflection, withUpdatedSignalReading, type CardLayout } from "../../components/cards/cardLayout";
import type { CompletionStatus } from "../../components/decks/types";
import { normalizeCompletionStatus } from "../progress";
import { learningOwnerKey, type CardLearningContext } from "./learningContext";
import { requireCondition } from "./domain";
import type { PersonalLearningChange } from "./learning";

export type LearningNotice = { userId: string; cardId: string; change: PersonalLearningChange; pending: boolean };

type PersonalFields = Pick<CardLayout, "targetDate" | "reflection" | "mediaItems"> & {
  adoptedVersion: number | undefined;
  completion: Map<string, CompletionStatus>;
  readings: Map<string, number | null>;
};
// Deck labels, themes, chats and navigation are deliberately absent from this cache.
export class WorkingCardStore {
  private clearListeners = new Set<(userId: string) => void>();
  private learningListeners = new Set<(notice: LearningNotice) => void>();
  private groupClearListeners = new Set<(userId: string, experienceId: string) => void>();
  private learningPending = new Map<string, number>();
  private sourceStamps = new Map<string, number>();
  private stampKey(userId: string, cardId: string, field: string) { return JSON.stringify([userId, cardId, field]); }
  private mark(userId: string, cardId: string, field: string) { this.sourceStamps.set(this.stampKey(userId, cardId, field), this.epoch(userId) + 1); }
  onClear(listener: (userId: string) => void) { this.clearListeners.add(listener); return () => { this.clearListeners.delete(listener); }; }
  onLearning(listener: (notice: LearningNotice) => void) { this.learningListeners.add(listener); return () => { this.learningListeners.delete(listener); }; }
  onGroupClear(listener: (userId: string, experienceId: string) => void) { this.groupClearListeners.add(listener); return () => { this.groupClearListeners.delete(listener); }; }
  clearGroup(userId: string, experienceId: string) { for (const listener of this.groupClearListeners) listener(userId, experienceId); }
  // Existing queues own ordering and rollback. This publishes their current
  // reconciled field, never a second queue or a foreign learning record.
  publishLearning(userId: string, cardId: string, change: PersonalLearningChange, phase: "start" | "settled") {
    const key = JSON.stringify([userId, cardId, change.kind, change.stepId]);
    const count = Math.max(0, (this.learningPending.get(key) ?? 0) + (phase === "start" ? 1 : -1));
    if (count) this.learningPending.set(key, count); else this.learningPending.delete(key);
    const record = this.personal(userId, cardId);
    if (record) {
      if (change.kind === "completion") record.completion.set(change.stepId, change.completionStatus);
      else record.readings.set(change.stepId, change.reading);
    }
    this.mark(userId, cardId, JSON.stringify([change.kind, change.stepId]));
    this.invalidate(userId);
    for (const listener of this.learningListeners) listener({ userId, cardId, change, pending: count > 0 });
  }
  setReflection(userId: string, cardId: string, text: string) {
    const record = this.personal(userId, cardId);
    if (record) record.reflection = text;
    this.mark(userId, cardId, "reflection");
    this.invalidate(userId);
  }
  setMedia(userId: string, cardId: string, media: CardLayout["mediaItems"]) {
    const record = this.personal(userId, cardId); if (record) record.mediaItems = media;
    this.mark(userId, cardId, "media"); this.invalidate(userId);
  }
  setTargetDate(userId: string, cardId: string, date: string) {
    const record = this.personal(userId, cardId); if (record) record.targetDate = date;
    this.mark(userId, cardId, "date"); this.invalidate(userId);
  }
  private infoRecords = new Map<string, { personalInfoRevision: number; personalInfoCardIds: string[]; personalInfoCardAttachedAt: Record<string, string> }>();
  acceptPersonal(userId: string, source: { cardTemplateId: string; personalInfoRevision?: number; personalInfoCardIds?: string[]; personalInfoCardAttachedAt?: Record<string, string> }) {
    this.trackUser(userId);
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
  trackUser(userId: string) { if (!this.sessions.has(userId)) this.sessions.set(userId, 0); }
  clearSession() { for (const userId of [...this.sessions.keys()]) this.clearUser(userId); }
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
    if (expectedSession !== this.session(userId)) return false;
    this.trackUser(userId);
    for (const card of cards) {
      this.acceptPersonal(userId, { ...card, cardTemplateId: card.cardTemplateId ?? card.id });
      for (const source of card.personalHistory ?? []) this.acceptPersonal(userId, source);
      const previous = this.personal(userId, card.id);
      if ((previous?.adoptedVersion ?? 0) > (card.adoptedVersion ?? 0)) continue;
      const changed = (field: string) => (this.sourceStamps.get(this.stampKey(userId, card.id, field)) ?? 0) > expectedEpoch;
      const keepLearning = (kind: string, step: string) => changed("learning") || changed(JSON.stringify([kind, step]))
        || (this.learningPending.get(JSON.stringify([userId, card.id, kind, step])) ?? 0) > 0;
      this.records.set(this.key(userId, card.id), {
      adoptedVersion: card.adoptedVersion, targetDate: previous && changed("date") ? previous.targetDate : card.targetDate,
      reflection: previous && changed("reflection") ? previous.reflection : card.reflection,
      mediaItems: previous && changed("media") ? previous.mediaItems : card.mediaItems,
      completion: new Map(card.steps.map((step) => [step.stepId, previous && keepLearning("completion", step.stepId) ? previous.completion.get(step.stepId) ?? normalizeCompletionStatus(step.completionStatus) : normalizeCompletionStatus(step.completionStatus)])),
      readings: new Map(card.signals.map((signal) => [signal.id, previous && keepLearning("signal", signal.id) ? previous.readings.get(signal.id) ?? null : signal.rawReading])),
    });
    }
    return true;
  }
  personal(userId: string, cardId: string) { return this.records.get(this.key(userId, cardId)); }
  removeMedia(userId: string, cardId: string, mediaItemId: string) {
    const record = this.personal(userId, cardId);
    if (record) this.setMedia(userId, cardId, record.mediaItems.filter((item) => item.id !== mediaItemId));
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
    for (const key of this.learningPending.keys()) if (JSON.parse(key)[0] === userId) this.learningPending.delete(key);
    for (const key of this.sourceStamps.keys()) if (JSON.parse(key)[0] === userId) this.sourceStamps.delete(key);
    for (const listener of this.clearListeners) listener(userId);
    this.invalidate(userId);
  }
  // Unknown external learning changes require a fresh learning read, not loss
  // of the known private media/reflection/date layout.
  invalidateLearning(userId: string, cardTemplateId: string) {
    this.mark(userId, cardTemplateId, "learning");
    this.invalidate(userId);
  }
}
export const workingCardStore = new WorkingCardStore();
