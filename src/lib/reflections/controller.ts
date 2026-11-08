import { workingCardStore } from "../cards/workingCardStore";
import { personalWork } from "../cards/personalWork";
import { clientId } from "../clientId";
import { patchReflectionFeed } from "./clientState";
import { reflectionSlotKey, type ReflectionSource, type CollectiveReflectionSource } from "./model";
import type { ReflectionFeed, ReflectionView } from "./reads";

export type ReflectionAreaContext = { viewerUserId: string; cardTemplateId: string; view: ReflectionView; deckTemplateId?: string; adoptionRevision?: number; structureRevision?: number };
type Source = ReflectionSource | CollectiveReflectionSource;
type Ack = { revision: number; reflectionId?: string | null };
type Command = { action: "save" | "delete"; source: Source; text: string; operationId: string; expectedRevision: number; accessEpoch?: number; deckTemplateId?: string };
type Transport = { read(): Promise<ReflectionFeed>; write(command: Command): Promise<Ack> };
type State = { feed: ReflectionFeed | null; saving: boolean; error: string | null };
const keyFor = (source: Source, actor: string) => source.kind === "group-card" ? JSON.stringify(source) : reflectionSlotKey({ source, authorUserId: actor });
const denied = (cause: unknown, reading = false) => {
  const error = cause as { status?: number; code?: string };
  return [401, 403, 404].includes(error?.status ?? 0) || error?.status === 409 && (reading || Boolean(error.code?.startsWith("GROUP_")));
};

function transport(context: ReflectionAreaContext): Transport {
  const { viewerUserId: actor, cardTemplateId: card, view } = context;
  const params = new URLSearchParams({ cardTemplateId: card });
  if (view.kind === "group") {
    params.set("experienceId", view.experienceId); params.set("mode", view.mode); params.set("accessEpoch", String(view.accessEpoch));
    if (view.subjectUserId) params.set("subjectUserId", view.subjectUserId);
  }
  const request = async <T>(method: string, body?: Command): Promise<T> => {
    const response = await fetch(method === "GET" ? `/api/reflections?${params}` : "/api/reflections", { method, cache: "no-store",
      headers: { "X-Personal-Viewer": actor, ...(view.kind === "group" ? { "X-Group-Viewer": actor } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(Error(result.code?.includes("CONFLICT") ? "This reflection changed. Close and reopen it before trying again." : "Unable to update reflection. Check your access and try again."), { status: response.status, code: result.code });
    return result;
  };
  return { read: () => request<ReflectionFeed>("GET"), write: command => request<Ack>("POST", command) };
}

export class ReflectionController {
  private state: State = { feed: null, saving: false, error: null };
  private listeners = new Set<() => void>();
  private pending?: Promise<void>; private pendingKey?: string; private generation = 0; private stamp = 0; private disposed = false;
  private changes = new Map<string, number>();
  private operation?: { key: string; action: string; text: string; operationId: string };
  private readonly session: number;
  private readonly offClear: () => void;
  private readonly offGroup: () => void;
  constructor(readonly context: ReflectionAreaContext, private readonly request: Transport = transport(context)) {
    workingCardStore.trackUser(context.viewerUserId);
    this.session = workingCardStore.session(context.viewerUserId);
    this.offClear = workingCardStore.onClear(actor => { if (actor === context.viewerUserId) this.dispose(); });
    this.offGroup = workingCardStore.onGroupClear((actor, experience) => { if (actor === context.viewerUserId && context.view.kind === "group" && context.view.experienceId === experience) this.dispose(); });
  }
  private live() { return !this.disposed && workingCardStore.session(this.context.viewerUserId) === this.session; }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<State>) { if (this.live()) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); } }
  private validate(feed: ReflectionFeed) {
    const { viewerUserId, cardTemplateId, view, adoptionRevision } = this.context;
    if (feed.viewerUserId !== viewerUserId || feed.cardTemplateId !== cardTemplateId || feed.view?.kind !== view.kind
      || (view.kind === "group" && (feed.view.kind !== "group" || feed.view.experienceId !== view.experienceId || feed.view.mode !== view.mode
        || feed.view.accessEpoch !== view.accessEpoch || feed.view.subjectUserId !== view.subjectUserId))
      || (adoptionRevision !== undefined && feed.adoptionRevision !== adoptionRevision)) throw Object.assign(Error("Current reflection access could not be verified."), { status: 409 });
    const owner = view.kind === "personal" || view.mode === "own";
    if (feed.items.some(item => item.entry.source.cardTemplateId !== cardTemplateId || owner && item.entry.authorUserId !== viewerUserId)
      || feed.collective && (view.kind !== "group" || view.mode !== "group" || feed.collective.source.experienceId !== view.experienceId || feed.collective.source.cardTemplateId !== cardTemplateId)) {
      throw Object.assign(Error("Invalid reflection source."), { status: 409 });
    }
    if (view.kind === "group" && view.mode !== "own" && feed.items.some(item => item.entry.source.kind !== "group" || item.entry.source.experienceId !== view.experienceId
      || item.entry.source.cardTemplateId !== cardTemplateId || (view.mode === "inspection" && item.entry.authorUserId !== view.subjectUserId)
      || (item.entry.authorUserId !== viewerUserId && !item.entry.groupVisible))) throw Object.assign(Error("Invalid reflection scope."), { status: 409 });
  }
  refresh = (): Promise<void> => {
    if (this.pending) return this.pending;
    if (!this.live()) return Promise.resolve();
    const generation = this.generation, stamp = this.stamp;
    this.pending = (async () => {
      try {
        let feed = await this.request.read();
        if (!this.live() || generation !== this.generation) return;
        this.validate(feed);
        const previous = this.state.feed;
        if (previous) {
          const items = new Map(previous.items.map(item => [reflectionSlotKey(item.entry), item]));
          feed = { ...feed, items: feed.items.map(item => {
            const key = reflectionSlotKey(item.entry), known = items.get(key);
            if (!known) return item;
            if (known.entry.revision > item.entry.revision) return known;
            // Protect local text, not obsolete permissions/visibility carried
            // beside it. A newer visibility decision still wins immediately.
            return this.pendingKey === key || (this.changes.get(key) ?? 0) > stamp ? { ...item, empty: known.empty, entry: { ...item.entry, text: known.entry.text, revision: known.entry.revision } } : item;
          }) };
          if (previous.collective && feed.collective && previous.collective.source.experienceId === feed.collective.source.experienceId
            && (this.pendingKey === keyFor(feed.collective.source, feed.viewerUserId) || (this.changes.get(keyFor(feed.collective.source, feed.viewerUserId)) ?? 0) > stamp || previous.collective.revision > feed.collective.revision)) feed = { ...feed, collective: previous.collective };
        }
        this.set({ feed, error: null });
      } catch (cause) {
        if (!this.live() || generation !== this.generation) return;
        this.set({ ...(denied(cause, true) ? { feed: null } : {}), error: cause instanceof Error ? cause.message : "Unable to load reflections." });
        if ((cause as { status?: number }).status === 401) workingCardStore.clearUser(this.context.viewerUserId);
        else if (denied(cause, true) && this.context.view.kind === "group") workingCardStore.clearGroup(this.context.viewerUserId, this.context.view.experienceId);
      }
    })().finally(() => { this.pending = undefined; });
    return this.pending;
  };
  async save(source: Source, text: string, revision: number, action: "save" | "delete", deckTemplateId = this.context.deckTemplateId) {
    const previous = this.state.feed;
    if (!previous || this.state.saving || !this.live()) throw Error("Reflection is not ready.");
    const key = keyFor(source, this.context.viewerUserId), submitted = action === "delete" ? "" : text.trim();
    const target = source.kind === "group-card" ? previous.collective : previous.items.find(item => reflectionSlotKey(item.entry) === key);
    if (!target || !(source.kind === "group-card" ? previous.collective?.canEdit : action === "delete" ? (target as ReflectionFeed["items"][number]).canDelete : (target as ReflectionFeed["items"][number]).canEdit)) throw Error("Reflection is read-only.");
    if (this.operation?.key !== key || this.operation.action !== action || this.operation.text !== text) this.operation = { key, action, text, operationId: clientId() };
    const operation = this.operation;
    this.changes.set(key, ++this.stamp); this.pendingKey = key;
    this.set({ feed: patchReflectionFeed(previous, source, submitted), saving: true, error: null });
    try {
      const scope = { userId: this.context.viewerUserId, cardIds: [source.cardTemplateId],
        ...(source.kind === "personal" ? {} : { context: { kind: "experience-contribution" as const, experienceId: source.experienceId } }) };
      const ack = await personalWork.run(scope, `reflection-save:${key}`, () => this.request.write({ action, source, text: text.trim(), expectedRevision: revision, operationId: operation.operationId,
        ...(this.context.view.kind === "group" ? { accessEpoch: this.context.view.accessEpoch } : {}), ...(deckTemplateId ? { deckTemplateId } : {}) }));
      if (!this.live()) return;
      if (!Number.isSafeInteger(ack.revision) || ack.revision < revision) throw Error("Unable to verify the saved reflection. Try again.");
      this.changes.set(key, ++this.stamp);
      this.set({ feed: patchReflectionFeed(this.state.feed ?? previous, source, submitted, ack) });
      if (source.kind === "personal") workingCardStore.setReflection(this.context.viewerUserId, source.cardTemplateId, submitted);
      this.operation = undefined;
      for (const controller of retained.values()) if (controller !== this) controller.sourceChanged(source, submitted, ack, this.context.viewerUserId);
    } catch (cause) {
      if (this.live()) {
        this.changes.set(key, ++this.stamp);
        const feed = this.state.feed;
        this.set({ feed: denied(cause) ? null : feed ? { ...feed,
          items: feed.items.map(item => {
            const old = reflectionSlotKey(item.entry) === key ? previous.items.find(old => reflectionSlotKey(old.entry) === key) : undefined;
            return old ? { ...item, empty: old.empty, entry: { ...item.entry, text: old.entry.text, revision: old.entry.revision } } : item;
          }),
          collective: source.kind === "group-card" && previous.collective && feed.collective ? { ...feed.collective, text: previous.collective.text, revision: previous.collective.revision } : feed.collective } : previous,
          error: cause instanceof Error ? cause.message : "Unable to update reflection." });
        if ((cause as { status?: number }).status === 401) workingCardStore.clearUser(this.context.viewerUserId);
        else if (denied(cause) && this.context.view.kind === "group") workingCardStore.clearGroup(this.context.viewerUserId, this.context.view.experienceId);
        // The failed source may be uncertain or conflicted. Reconcile after an
        // earlier read settles, without replacing the editor draft.
        const old = this.pending; void Promise.resolve(old).then(() => this.refresh());
      }
      throw cause;
    } finally { this.pendingKey = undefined; this.set({ saving: false }); }
  }
  private sourceChanged(source: Source, text: string, ack: Ack, actor: string) {
    if (this.context.viewerUserId !== actor || this.context.cardTemplateId !== source.cardTemplateId || !this.state.feed) return;
    const feed = this.state.feed, key = keyFor(source, actor);
    const applicable = source.kind === "group-card" ? feed.collective?.source.experienceId === source.experienceId
      : feed.items.some(item => reflectionSlotKey(item.entry) === key);
    this.changes.set(key, ++this.stamp);
    if (applicable) this.set({ feed: patchReflectionFeed(feed, source, text, ack) });
    else if (this.listeners.size && source.kind === "group" && this.context.view.kind === "group" && this.context.view.experienceId === source.experienceId) {
      const old = this.pending; void Promise.resolve(old).then(() => this.refresh());
    }
  }
  dispose() { this.offClear(); this.offGroup(); this.generation++; this.state = { feed: null, saving: false, error: this.state.error }; this.disposed = true; this.listeners.forEach(listener => listener()); }
}

const retained = new Map<string, ReflectionController>();
// Accessed by the client component only; server snapshots are always empty.
export function retainedReflection(context: ReflectionAreaContext, request?: Transport) {
  const key = JSON.stringify({ ...context, deckTemplateId: undefined }); let controller = retained.get(key);
  if (!controller) { controller = new ReflectionController(context, request); retained.set(key, controller); }
  return controller;
}
workingCardStore.onClear(actor => { for (const [key, controller] of retained) if (controller.context.viewerUserId === actor) { controller.dispose(); retained.delete(key); } });
workingCardStore.onGroupClear((actor, experienceId) => {
  for (const [key, controller] of retained) if (controller.context.viewerUserId === actor && controller.context.view.kind === "group" && controller.context.view.experienceId === experienceId) { controller.dispose(); retained.delete(key); }
});
