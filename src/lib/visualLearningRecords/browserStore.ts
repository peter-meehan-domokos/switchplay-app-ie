import type { PendingVisualVisit, VisualOutbox } from "./outbox";
import type { VisualClaimReceipt } from "./model";
import { assertVisualClaimJournal, assertVisualClaimReceipt, planVisualClaimInstall, sameVisualClaimReceipt, type VisualClaimJournal } from "./claimOutbox";
import { requireVisual } from "./contracts";

export interface VisualOutboxStore {
  list(learner: string): Promise<VisualOutbox[]>;
  read(key: string): Promise<VisualOutbox | undefined>;
  update(key: string, change: (row: VisualOutbox | undefined) => VisualOutbox): Promise<VisualOutbox>;
  opening(key: string, next?: PendingVisualVisit | null): Promise<PendingVisualVisit | undefined>;
  transition(key: string, attemptId: string, create: (previous: VisualOutbox) => VisualOutbox): Promise<VisualOutbox>;
}
export interface VisualClaimStore extends VisualOutboxStore {
  readClaim(claimId: string): Promise<VisualClaimJournal | undefined>;
  findClaim(guestLearner: string): Promise<VisualClaimJournal | undefined>;
  claimsForAccount(accountLearner: string): Promise<VisualClaimJournal[]>;
  writeClaim(journal: VisualClaimJournal): Promise<VisualClaimJournal>;
  installClaim(claimId: string, receipt: VisualClaimReceipt): Promise<VisualClaimJournal>;
}

/** Each update is a single IndexedDB read/write transaction, including event IDs and snapshot. */
export function createBrowserVisualStore(databaseName = "switchplay-visual-learning-records"): VisualClaimStore {
  let connection: Promise<IDBDatabase> | undefined;
  const database = () => connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("outboxes")) db.createObjectStore("outboxes", { keyPath: "key" });
      if (!db.objectStoreNames.contains("opening")) db.createObjectStore("opening");
      if (!db.objectStoreNames.contains("claims")) {
        const claims = db.createObjectStore("claims", { keyPath: "claimId" }); claims.createIndex("guestLearner", "guestLearner", { unique: true });
      }
    };
    request.onerror = () => { connection = undefined; reject(request.error); };
    request.onblocked = () => { connection = undefined; reject(new Error("Visual storage upgrade is blocked.")); };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = undefined; }; resolve(request.result); };
  });
  async function operation<T>(name: "outboxes" | "opening" | "claims", write: boolean, run: (store: IDBObjectStore, done: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
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
    readClaim: claimId => operation("claims", false, (store, done) => { const request = store.get(claimId); request.onsuccess = () => done(request.result); }),
    findClaim: guestLearner => operation("claims", false, (store, done) => { const request = store.index("guestLearner").get(guestLearner); request.onsuccess = () => done(request.result); }),
    claimsForAccount: accountLearner => operation("claims", false, (store, done) => {
      const request = store.getAll(); request.onsuccess = () => done(request.result.filter((journal: VisualClaimJournal) => journal.accountLearner === accountLearner));
    }),
    writeClaim: journal => operation("claims", true, (store, done, fail) => {
      try { assertVisualClaimJournal(journal); requireVisual(journal.phase !== "installed", "VISUAL_CLAIM_LOCAL_CONFLICT"); } catch (error) { fail(error); return; }
      const request = store.get(journal.claimId);
      request.onsuccess = () => {
        try {
          const previous: VisualClaimJournal | undefined = request.result;
          const preparing = previous?.phase === "awaiting-login" && journal.phase === "awaiting-login"
            && (!previous.accountLearner || previous.accountLearner === journal.accountLearner);
          requireVisual(!previous || previous.guestLearner === journal.guestLearner
            && (preparing || previous.foregroundAttemptId === journal.foregroundAttemptId && previous.activityId === journal.activityId)
            && previous.createdAt === journal.createdAt && previous.phase !== "installed"
            && (!previous.accountLearner || previous.accountLearner === journal.accountLearner)
            && !(previous.phase === "prepared" && journal.phase === "awaiting-login"), "VISUAL_CLAIM_LOCAL_CONFLICT");
          store.put(journal); done(journal);
        } catch (error) { fail(error); }
      };
    }),
    installClaim: async (claimId, receipt) => {
      const db = await database();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["outboxes", "claims"], "readwrite"), outboxes = transaction.objectStore("outboxes"), claims = transaction.objectStore("claims");
        let result: VisualClaimJournal, thrown: unknown;
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(thrown ?? transaction.error);
        transaction.onabort = () => reject(thrown ?? transaction.error ?? new Error("Visual claim transaction aborted."));
        const fail = (error: unknown) => { thrown = error; transaction.abort(); };
        const request = claims.get(claimId);
        request.onsuccess = () => {
          try {
            const journal: VisualClaimJournal = request.result; assertVisualClaimJournal(journal); assertVisualClaimReceipt(receipt, journal);
            if (journal.phase === "installed") { requireVisual(sameVisualClaimReceipt(journal.receipt!, receipt), "VISUAL_CLAIM_LOCAL_CONFLICT"); result = journal; return; }
            requireVisual(journal.phase === "prepared", "VISUAL_CLAIM_LOCAL_CONFLICT");
            const guests = outboxes.getAll(IDBKeyRange.bound(`${journal.guestLearner}|`, `${journal.guestLearner}|\uffff`));
            const accounts = outboxes.getAll(IDBKeyRange.bound(`${journal.accountLearner}|`, `${journal.accountLearner}|\uffff`));
            let completed = 0;
            const install = () => {
              if (++completed !== 2) return;
              try {
                const plan = planVisualClaimInstall(journal, receipt, guests.result, accounts.result);
                for (const key of plan.deletes) outboxes.delete(key);
                for (const row of plan.puts) outboxes.put(row);
                claims.put(plan.journal); result = plan.journal;
              } catch (error) { fail(error); }
            };
            guests.onsuccess = install; accounts.onsuccess = install;
          } catch (error) { fail(error); }
        };
      });
    },
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
