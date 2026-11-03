import { collectionKey, type MediaCollectionContext, type MediaCollectionPage } from "./contracts";
import { fetchMediaCollection } from "./transport";
export type CollectionLoader = (context: MediaCollectionContext, cursor?: string, signal?: AbortSignal, limit?: number) => Promise<MediaCollectionPage>;
export type CollectionState = { page: MediaCollectionPage | null; selectedKey: string | null; loading: boolean; error: string | null };
export class MediaCollectionController {
  private state: CollectionState = { page: null, selectedKey: null, loading: false, error: null };
  private listeners = new Set<() => void>(); private generation = 0; private abort?: AbortController; private currentCursor?: string; private disposed = false;
  constructor(readonly context: MediaCollectionContext, readonly request: CollectionLoader = fetchMediaCollection, readonly limit = 30) {}
  activate() { this.disposed = false; }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(value: Partial<CollectionState>) { this.state = { ...this.state, ...value }; this.listeners.forEach(l => l()); }
  selected() { return this.state.page?.items.find(i => collectionKey(i) === this.state.selectedKey) ?? null; }
  select(key: string) { if (this.state.page?.items.some(i => collectionKey(i) === key)) this.set({ selectedKey: key }); }
  async load(cursor?: string, edge?: "first" | "last") {
    const generation = ++this.generation; this.abort?.abort(); const abort = new AbortController(); this.abort = abort;
    const previous = this.state.selectedKey, index = this.state.page?.items.findIndex(i => collectionKey(i) === previous) ?? 0;
    this.set({ loading: true, error: null });
    try {
      const page = await this.request(this.context, cursor, abort.signal, this.limit);
      if (this.disposed || generation !== this.generation || abort.signal.aborted) return;
      if (page.viewerUserId !== this.context.viewerUserId || page.cardTemplateId !== this.context.cardTemplateId
        || (this.context.experienceId && page.experienceId !== this.context.experienceId)
        || (this.context.kind === "group" && (page.accessEpoch !== this.context.accessEpoch || page.adoptionRevision !== this.context.adoptionRevision || (page.subjectUserId ?? null) !== (this.context.subjectUserId ?? null)))) throw Error("Media authority changed. Reopen the Card.");
      if (!Array.isArray(page.items) || page.items.length > this.limit || !Number.isSafeInteger(page.total) || page.total < page.items.length
        || new Set(page.items.map(collectionKey)).size !== page.items.length
        || page.items.some(i => this.context.kind === "owner" ? i.authorUserId !== this.context.viewerUserId
          : i.private || i.source.kind !== "group" || i.source.experienceId !== this.context.experienceId
            || Boolean(this.context.subjectUserId && i.authorUserId !== this.context.subjectUserId))) throw Error("Invalid media collection response.");
      const found = page.items.findIndex(i => collectionKey(i) === previous);
      const chosen = edge === "first" ? 0 : edge === "last" ? page.items.length - 1 : found >= 0 ? found : Math.max(0, Math.min(index, page.items.length - 1));
      this.currentCursor = cursor;
      this.set({ page, selectedKey: page.items[chosen] ? collectionKey(page.items[chosen]) : null, loading: false });
    } catch (error) {
      if (this.disposed || generation !== this.generation || abort.signal.aborted) return;
      // Clear stale authorised payloads on every failed refresh; never keep a
      // removed viewer's old foreign media visible after a permission failure.
      this.set({ page: null, selectedKey: null, loading: false, error: error instanceof Error ? error.message : "Media unavailable." });
    }
  }
  refresh = () => this.load(this.state.page?.refresh ?? this.currentCursor);
  async navigate(direction: -1 | 1) {
    if (this.state.loading || !this.state.page) return;
    const { items, older, newer } = this.state.page;
    const index = items.findIndex(i => collectionKey(i) === this.state.selectedKey), next = index + direction;
    if (next >= 0 && next < items.length) this.select(collectionKey(items[next]));
    else if (direction === -1 && older) await this.load(older, "last");
    else if (direction === 1 && newer) await this.load(newer, "first");
  }
  dispose() { this.disposed = true; ++this.generation; this.abort?.abort(); this.state = { page: null, selectedKey: null, loading: false, error: null }; }
}
