import type { PendingVisualVisit, VisualOutbox } from "./outbox";

export interface VisualOutboxStore {
  list(learner: string): Promise<VisualOutbox[]>;
  read(key: string): Promise<VisualOutbox | undefined>;
  update(key: string, change: (row: VisualOutbox | undefined) => VisualOutbox): Promise<VisualOutbox>;
  opening(key: string, next?: PendingVisualVisit | null): Promise<PendingVisualVisit | undefined>;
  transition(key: string, attemptId: string, create: (previous: VisualOutbox) => VisualOutbox): Promise<VisualOutbox>;
}

/** Each update is a single IndexedDB read/write transaction, including event IDs and snapshot. */
export function createBrowserVisualStore(databaseName = "switchplay-visual-learning-records"): VisualOutboxStore {
  let connection: Promise<IDBDatabase> | undefined;
  const database = () => connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("outboxes", { keyPath: "key" }); request.result.createObjectStore("opening"); };
    request.onerror = () => { connection = undefined; reject(request.error); };
    request.onblocked = () => { connection = undefined; reject(new Error("Visual storage upgrade is blocked.")); };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = undefined; }; resolve(request.result); };
  });
  async function operation<T>(name: "outboxes" | "opening", write: boolean, run: (store: IDBObjectStore, done: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(name, write ? "readwrite" : "readonly"), store = transaction.objectStore(name);
      let result: T, thrown: unknown;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(thrown ?? transaction.error);
      transaction.onabort = () => reject(thrown ?? transaction.error ?? new Error("Visual storage transaction aborted."));
      const fail = (error: unknown) => { thrown = error; transaction.abort(); };
      try { run(store, value => { result = value; }, fail); }
      catch (error) { fail(error); }
    });
  }
  return {
    transition: (key, attemptId, create) => operation("outboxes", true, (store, done, fail) => {
      const request = store.get(key);
      request.onsuccess = () => {
        try {
          const previous: VisualOutbox | undefined = request.result;
          if (!previous || previous.session.attemptId !== attemptId) throw new Error("VISUAL_ACTIVE_ATTEMPT_CONFLICT");
          const next = create(previous), archiveKey = `${key}|${attemptId}`;
          if (next.key !== key || next.command?.predecessorKey !== archiveKey) throw new Error("VISUAL_ATTEMPT_COMMAND_MISMATCH");
          store.add({ ...previous, key: archiveKey }); store.put(next); done(next);
        } catch (error) { fail(error); }
      };
    }),
    list: learner => operation("outboxes", false, (store, done) => {
      const request = store.getAll(IDBKeyRange.bound(`${learner}|`, `${learner}|\uffff`));
      request.onsuccess = () => done(request.result);
    }),
    read: key => operation("outboxes", false, (store, done) => { const request = store.get(key); request.onsuccess = () => done(request.result); }),
    update: (key, change) => operation("outboxes", true, (store, done, fail) => {
      const request = store.get(key);
      request.onsuccess = () => {
        try { const row = change(request.result); store.put(row); done(row); }
        catch (error) { fail(error); }
      };
    }),
    opening: (key, next) => operation("opening", next !== undefined, (store, done) => {
      if (next === null) { store.delete(key); done(undefined); }
      else if (next) { store.put(next, key); done(next); }
      else { const request = store.get(key); request.onsuccess = () => done(request.result); }
    }),
  };
}
