export type ContributionWorkContext = { kind: "experience-contribution" | "experience-assessment"; experienceId: string };
export type PersonalWorkScope = { userId: string; deckId?: string; cardIds: readonly string[]; context?: ContributionWorkContext };
type Entry = { scope: PersonalWorkScope; promise?: Promise<unknown>; operation?: Promise<unknown>; retry?: () => Promise<unknown>; error?: Error; token: symbol };
const namespace = (scope: PersonalWorkScope) => scope.context ? JSON.stringify([scope.context.kind, scope.context.experienceId]) : "personal";
const identity = (scope: PersonalWorkScope, key: string) => JSON.stringify([scope.userId, namespace(scope), key]);
// Learning work omits contribution context and therefore shares one queue/barrier
// across all Deck/experience views. Content work is isolated per experience.
const overlaps = (a: PersonalWorkScope, b: PersonalWorkScope) => a.userId === b.userId && namespace(a) === namespace(b) &&
  ((a.deckId !== undefined && a.deckId === b.deckId) || a.cardIds.some((id) => b.cardIds.includes(id)));

// Tracks in-memory saves, uploads and editor-readiness markers, never editing
// content. It does not persist drafts, cancel uploads, or schedule general jobs.
// Failed writes retain their exact
// retry operation until a successful newer write to the same field supersedes it.
export class PersonalWork {
  private entries = new Map<string, Entry>();
  private changes = new Map<string, { scope: PersonalWorkScope; revision: number }>();
  revision(scope: PersonalWorkScope) { return [...this.changes.values()].filter((entry) => overlaps(scope, entry.scope)).reduce((total, entry) => total + entry.revision, 0); }
  private locks = new Set<PersonalWorkScope>();
  run<T>(scope: PersonalWorkScope, key: string, operation: () => Promise<T>): Promise<T> {
    if ([...this.locks].some((lock) => overlaps(lock, scope))) return Promise.reject(new Error("Please wait for Update to finish."));
    const operationId = identity(scope, key);
    this.changes.set(operationId, { scope, revision: (this.changes.get(operationId)?.revision ?? 0) + 1 });
    const entry: Entry = { scope, token: Symbol(), retry: () => this.run(scope, key, operation) };
    const promise = Promise.resolve().then(operation);
    entry.promise = promise; entry.operation = promise; this.entries.set(operationId, entry);
    void promise.then(() => { if (this.entries.get(operationId) === entry) this.entries.delete(operationId); }, (error) => {
      if (this.entries.get(operationId) === entry) { entry.promise = undefined; entry.error = error instanceof Error ? error : new Error("Personal work could not be saved."); }
    });
    return promise;
  }
  // Whole upload lifetime, including provider transfer and its final attachment.
  begin(scope: PersonalWorkScope, key: string) {
    if (this.isLocked(scope)) throw new Error("Please wait for Update to finish.");
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
    const tracked = this.run(scope, key, () => promise);
    void tracked.catch(() => {});
    return (error?: Error, retry?: () => Promise<unknown>) => {
      const entry = this.entries.get(identity(scope, key));
      if (entry?.promise === tracked) entry.retry = retry ? () => this.run(scope, key, retry) : undefined;
      if (error) reject(error); else resolve();
    };
  }
  async wait(scope: PersonalWorkScope, signal?: AbortSignal) {
    for (;;) {
      if (signal?.aborted) throw new DOMException("Update cancelled", "AbortError");
      const entries = [...this.entries.values()].filter((entry) => overlaps(scope, entry.scope));
      const pending = entries.flatMap((entry) => entry.promise ? [entry.promise] : []);
      if (!pending.length) {
        // Signal coalescing can enqueue its next write in a completion microtask.
        await Promise.resolve();
        const current = [...this.entries.values()].filter((entry) => overlaps(scope, entry.scope));
        if (current.some((entry) => entry.promise)) continue;
        const failed = current.find((entry) => entry.error);
        if (failed) throw new Error(`Some personal work could not be saved. ${failed.error!.message}`);
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const abort = () => { cleanup(); reject(new DOMException("Update cancelled", "AbortError")); };
        const cleanup = () => signal?.removeEventListener("abort", abort);
        signal?.addEventListener("abort", abort, { once: true });
        void Promise.allSettled(pending).then(() => { cleanup(); resolve(); });
      });
    }
  }
  async retry(scope: PersonalWorkScope) {
    const failed = [...this.entries.values()].filter((entry) => overlaps(scope, entry.scope) && entry.error);
    if (failed.some((entry) => !entry.retry)) throw new Error("Retry the failed upload in the Card media editor before updating. Your saved personal work is retained.");
    await Promise.all(failed.map((entry) => [...this.entries.values()].includes(entry) ? entry.retry?.() : undefined));
  }
  lock(scope: PersonalWorkScope) {
    if ([...this.entries.values()].some((entry) => overlaps(scope, entry.scope))) throw new Error("Personal work is still pending. Retry Update.");
    this.locks.add(scope);
    return () => this.locks.delete(scope);
  }
  hasWork(scope: PersonalWorkScope) { return [...this.entries.values()].some((entry) => overlaps(scope, entry.scope)); }
  // Only the caller holding this exact settled operation can abandon its failure.
  // Never release an in-flight operation or a newer save occupying the same key.
  discardFailed(userId: string, key: string, operation: Promise<unknown>, context?: ContributionWorkContext) {
    const operationId = identity({ userId, cardIds: [], context }, key), entry = this.entries.get(operationId);
    if (entry?.operation === operation && !entry.promise && entry.error) this.entries.delete(operationId);
  }
  retryFailed(userId: string, key: string, operation: Promise<unknown>, context?: ContributionWorkContext) {
    const entry = this.entries.get(identity({ userId, cardIds: [], context }, key));
    if (entry?.operation !== operation || entry.promise || !entry.error || !entry.retry) throw new Error("This save has changed. Refresh before retrying.");
    return entry.retry();
  }
  isLocked(scope: PersonalWorkScope) { return [...this.locks].some((lock) => overlaps(scope, lock)); }
}
export const personalWork = new PersonalWork();
