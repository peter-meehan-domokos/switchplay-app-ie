import { workingCardStore } from "../cards/workingCardStore";
import { collectionKey, isFollowerSharedAdminItem, isIncludedGroupAdminItem, type MediaCollectionContext, type MediaCollectionPage, type MediaSource } from "./contracts";
import { fetchMediaCollection } from "./transport";
export type CollectionLoader = (context: MediaCollectionContext, cursor?: string, signal?: AbortSignal, limit?: number) => Promise<MediaCollectionPage>;
export type GallerySeed = { page: MediaCollectionPage; selectedKey: string };
export type CollectionState = { page: MediaCollectionPage | null; selectedKey: string | null; loading: boolean; error: string | null };
export class MediaCollectionController {
  private state: CollectionState = { page: null, selectedKey: null, loading: false, error: null };
  private listeners = new Set<() => void>(); private generation = 0; private abort?: AbortController; private currentCursor?: string; private disposed = false; private pending?: { cursor?: string; promise: Promise<void> };
  private readonly session: number;
  private offClear?: () => void;
  private offGroup?: () => void;
  private revoked = false;
  private lastChange?: Event;
  private preparationVersion = 0;
  private fresh = false;
  constructor(readonly context: MediaCollectionContext, readonly request: CollectionLoader = fetchMediaCollection, readonly limit = 30, private readonly initial?: GallerySeed) {
    workingCardStore.trackUser(context.viewerUserId);
    this.session = workingCardStore.session(context.viewerUserId);
    if (initial) { this.validate(initial.page); this.state = { page: initial.page, selectedKey: initial.selectedKey, loading: false, error: null }; }
    this.bindScope();
  }
  private bindScope() {
    this.offClear ??= workingCardStore.onClear(actor => { if (actor === this.context.viewerUserId) this.dispose(true); });
    this.offGroup ??= workingCardStore.onGroupClear((actor, experience) => { if (actor === this.context.viewerUserId && experience === this.context.experienceId) this.dispose(true); });
  }
  private validate(page: MediaCollectionPage) {
    if (page.viewerUserId !== this.context.viewerUserId || page.cardTemplateId !== this.context.cardTemplateId
      || (this.context.experienceId && page.experienceId !== this.context.experienceId)
      || (this.context.kind === "group" && (page.accessEpoch !== this.context.accessEpoch || page.adoptionRevision !== this.context.adoptionRevision || (this.context.structureRevision !== undefined && page.structureRevision !== this.context.structureRevision) || (page.subjectUserId ?? null) !== (this.context.subjectUserId ?? null)))) throw Object.assign(Error("Media authority changed. Reopen the Card."), { status: 409 });
    if (!Array.isArray(page.items) || page.items.length > this.limit || !Number.isSafeInteger(page.total) || page.total < page.items.length
      || new Set(page.items.map(collectionKey)).size !== page.items.length
      // Owner pages hold the viewer's own items; Me of a Group also this Group's Admin contributions (V1, 4.5b).
      || page.items.some(i => this.context.kind === "owner" ? i.authorUserId !== this.context.viewerUserId && !isFollowerSharedAdminItem(i, this.context.experienceId)
        : i.private || i.source.kind !== "group" || i.source.experienceId !== this.context.experienceId
        || Boolean(this.context.subjectUserId && i.authorUserId !== this.context.subjectUserId && !isIncludedGroupAdminItem(i, this.context)))) throw Object.assign(Error("Invalid media collection response."), { status: 409 });
  }
  activate() {
    if (this.revoked || workingCardStore.session(this.context.viewerUserId) !== this.session) return;
    if (this.disposed && this.initial) this.state = { page: this.initial.page, selectedKey: this.initial.selectedKey, loading: false, error: null };
    this.disposed = false;
    this.bindScope();
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(value: Partial<CollectionState>) { this.state = { ...this.state, ...value }; this.listeners.forEach(l => l()); }
  selected() { return this.state.page?.items.find(i => collectionKey(i) === this.state.selectedKey) ?? null; }
  select(key: string) { if (this.state.page?.items.some(i => collectionKey(i) === key)) this.set({ selectedKey: key }); }
  load(cursor?: string, edge?: "first" | "last"): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.pending && this.pending.cursor === cursor) return this.pending.promise;
    const promise = this.read(cursor, edge); this.pending = { cursor, promise };
    void promise.finally(() => { if (this.pending?.promise === promise) this.pending = undefined; });
    return promise;
  }
  preparationToken() { return this.preparationVersion; }
  isFresh() { return this.fresh; }
  acceptPrepared(page: MediaCollectionPage, token = 0) {
    if (this.disposed || this.revoked || workingCardStore.session(this.context.viewerUserId) !== this.session || token !== this.preparationVersion) return false;
    this.validate(page); ++this.generation; this.abort?.abort(); this.pending = undefined; ++this.preparationVersion; this.fresh = true;
    if (JSON.stringify(page) !== JSON.stringify(this.state.page)) this.set({ page, loading: false, error: null });
    else if (this.state.loading || this.state.error) this.set({ loading: false, error: null });
    return true;
  }
  invalidate() { this.fresh = false; ++this.preparationVersion; ++this.generation; this.abort?.abort(); this.pending = undefined; }
  changed(event: Event) { if (this.lastChange !== event) { this.lastChange = event; this.invalidate(); } }
  removed(source: MediaSource, action: "delete" | "hide") {
    const page = this.state.page; if (!page) return;
    const key = collectionKey({ source });
    if (!page.items.some(item => collectionKey(item) === key)) return;
    if (action === "hide" && this.context.kind === "owner") {
      if (source.kind === "group" && this.context.experienceId === source.experienceId) this.set({ page: { ...page, items: page.items.map(item => collectionKey(item) === key ? { ...item, private: true } : item) } });
      return;
    }
    this.set({ page: { ...page, total: Math.max(0, page.total - 1), items: page.items.filter(item => collectionKey(item) !== key) } });
  }
  private async read(cursor?: string, edge?: "first" | "last") {
    const generation = ++this.generation; this.abort?.abort(); const abort = new AbortController(); this.abort = abort;
    const previous = this.state.selectedKey, index = this.state.page?.items.findIndex(i => collectionKey(i) === previous) ?? 0;
    this.set({ loading: true, error: null });
    try {
      const page = await this.request(this.context, cursor, abort.signal, this.limit);
      if (this.disposed || workingCardStore.session(this.context.viewerUserId) !== this.session || generation !== this.generation || abort.signal.aborted) return;
      this.validate(page);
      const found = page.items.findIndex(i => collectionKey(i) === previous);
      const chosen = edge === "first" ? 0 : edge === "last" ? page.items.length - 1 : found >= 0 ? found : Math.max(0, Math.min(index, page.items.length - 1));
      ++this.preparationVersion; this.currentCursor = cursor; this.fresh = true;
      this.set({ page, selectedKey: page.items[chosen] ? collectionKey(page.items[chosen]) : null, loading: false });
    } catch (error) {
      if (this.disposed || workingCardStore.session(this.context.viewerUserId) !== this.session || generation !== this.generation || abort.signal.aborted) return;
      const status = (error as { status?: number }).status;
      const denied = [401, 403, 404, 409].includes(status ?? 0);
      if (denied) this.revoked = true;
      this.set({ ...(denied ? { page: null, selectedKey: null } : {}), loading: false, error: error instanceof Error ? error.message : "Media unavailable." });
      if (status === 401) workingCardStore.clearUser(this.context.viewerUserId);
      else if (denied && this.context.experienceId) workingCardStore.clearGroup(this.context.viewerUserId, this.context.experienceId);
    }
  }
  refresh = (fromNewest = false) => this.load(fromNewest ? undefined : this.state.page?.refresh ?? this.currentCursor);
  async navigate(direction: -1 | 1) {
    if (this.state.loading || !this.state.page) return;
    const { items, older, newer } = this.state.page;
    const index = items.findIndex(i => collectionKey(i) === this.state.selectedKey), next = index + direction;
    if (next >= 0 && next < items.length) this.select(collectionKey(items[next]));
    else if (direction === -1 && older) await this.load(older, "last");
    else if (direction === 1 && newer) await this.load(newer, "first");
  }
  dispose(revoked = false) { this.revoked ||= revoked; this.disposed = true; this.offClear?.(); this.offGroup?.(); this.offClear = this.offGroup = undefined; this.invalidate(); this.set({ page: null, selectedKey: null, loading: false, error: this.state.error }); }
}

// Only Card preview windows are retained. Gallery cursor/selection stays local.
const previews = new Map<string, MediaCollectionController>();
const previewKey = (c: MediaCollectionContext) => JSON.stringify([c.viewerUserId, c.cardTemplateId, c.kind, c.experienceId ?? null, c.kind === "group" ? c.subjectUserId ?? null : null, c.accessEpoch ?? null, c.kind === "group" ? c.adoptionRevision : null, c.kind === "group" ? c.structureRevision ?? null : null,
  c.kind === "group" ? c.includeGroupContent ?? null : null]);
export function hasPreparedMedia(context: MediaCollectionContext) { return !!previews.get(previewKey(context))?.snapshot().page; }
export function captureMediaPreparation(actor: string) { return new Map([...previews].filter(([, c]) => c.context.viewerUserId === actor).map(([key, c]) => [key, c.preparationToken()])); }
export function acceptMediaPreparation(context: MediaCollectionContext, page: MediaCollectionPage, tokens: Map<string, number>) {
  const controller = retainedMediaPreview(context);
  return controller.acceptPrepared(page, tokens.get(previewKey(context)) ?? 0) || controller.snapshot().page !== null;
}
export function retainedMediaPreview(context: MediaCollectionContext, loader?: CollectionLoader, limit = 5) {
  const key = previewKey(context);
  let controller = previews.get(key);
  if (controller && (controller.request !== (loader ?? fetchMediaCollection) || controller.limit !== limit)) { controller.dispose(); previews.delete(key); controller = undefined; }
  if (!controller) { controller = new MediaCollectionController(context, loader, limit); previews.set(key, controller); }
  return controller;
}
export function invalidateMediaPreviews(viewerUserId: string, cardTemplateId: string, experienceId?: string, removed?: { source: MediaSource; action: "delete" | "hide" }) {
  for (const controller of previews.values()) if (controller.context.kind === "owner" ? controller.context.viewerUserId === viewerUserId
    : controller.context.cardTemplateId === cardTemplateId && controller.context.experienceId === experienceId) {
    controller.invalidate(); if (removed) controller.removed(removed.source, removed.action);
  }
}
export function retireGroupMedia(actor: string, experience: string, current?: { accessEpoch: number; adoptionRevision: number; structureRevision: number }) {
  for (const [key, controller] of previews) {
    const c = controller.context;
    if (c.viewerUserId !== actor || c.experienceId !== experience || c.kind !== "group") continue;
    if (current ? c.accessEpoch === current.accessEpoch && c.adoptionRevision === current.adoptionRevision && c.structureRevision === current.structureRevision : !c.subjectUserId) continue;
    controller.dispose(true); previews.delete(key);
  }
}
workingCardStore.onClear(actor => {
  for (const [key, controller] of previews) if (controller.context.viewerUserId === actor) { controller.dispose(true); previews.delete(key); }
});
workingCardStore.onGroupClear((actor, experienceId) => {
  for (const [key, controller] of previews) if (controller.context.viewerUserId === actor && controller.context.experienceId === experienceId) { controller.dispose(true); previews.delete(key); }
});
