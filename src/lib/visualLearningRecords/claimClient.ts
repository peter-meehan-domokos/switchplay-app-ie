"use client";

import { createBrowserVisualStore, type VisualClaimStore } from "./browserStore";
import { createVisualPersistence, type VisualPersistenceClient } from "./client";
import { assertVisualClaimJournal, assertVisualClaimReceipt, type VisualClaimJournal } from "./claimOutbox";
import { assertUuid, requireVisual } from "./contracts";
import { hasPendingVisualWork, visualOutboxKey } from "./outbox";

export class VisualClaimTransportError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
/** Store public identity/context before leaving for the existing sign-in page.
 * No credential secret or caller-supplied account ownership is written here. */
export async function rememberVisualGuestClaim(input: { guestLearner: string; activityId: string; foregroundAttemptId: string }, store: VisualClaimStore = createBrowserVisualStore()) {
  const existing = await store.findClaim(input.guestLearner);
  if (existing) {
    assertVisualClaimJournal(existing);
    if (existing.phase === "awaiting-login" && !existing.accountLearner) {
      return store.writeClaim({ ...existing, activityId: input.activityId, foregroundAttemptId: input.foregroundAttemptId });
    }
    requireVisual(existing.foregroundAttemptId === input.foregroundAttemptId && existing.activityId === input.activityId, "VISUAL_CLAIM_LOCAL_CONFLICT"); return existing;
  }
  const journal: VisualClaimJournal = { ...input, claimId: crypto.randomUUID(), createdAt: new Date().toISOString(), phase: "awaiting-login" };
  assertVisualClaimJournal(journal); return store.writeClaim(journal);
}

export async function completeVisualGuestClaim(options: {
  claimId: string; accountLearner: string; store?: VisualClaimStore; fetch?: typeof fetch;
  persistence?: (learner: string, store: VisualClaimStore, send: typeof fetch) => VisualPersistenceClient;
}) {
  assertUuid(options.claimId);
  const store = options.store ?? createBrowserVisualStore(), send = options.fetch ?? fetch;
  let journal = await store.readClaim(options.claimId); assertVisualClaimJournal(journal);
  requireVisual(!journal.accountLearner || journal.accountLearner === options.accountLearner, "VISUAL_SESSION_CONFLICT");
  if (journal.phase === "installed") return journal;
  const service = options.persistence ?? ((learner, store, fetch) => createVisualPersistence({ learner, store, fetch }));
  if (journal.phase === "awaiting-login") {
    const guest = service(journal.guestLearner, store, send);
    try { await guest.drain(); } finally { guest.dispose(); }
    const latest = await store.readClaim(journal.claimId); assertVisualClaimJournal(latest);
    requireVisual(latest.phase === "awaiting-login" && latest.guestLearner === journal.guestLearner, "VISUAL_CLAIM_LOCAL_CONFLICT");
    journal = latest;
    const foreground = await store.read(visualOutboxKey(journal.guestLearner, journal.activityId));
    if (foreground) {
      // A just-confirmed local attempt can finish its IndexedDB transition while
      // sign-in navigation starts. Drain first, then freeze the settled identity.
      requireVisual(foreground.learner === journal.guestLearner && foreground.session.activityId === journal.activityId, "VISUAL_SESSION_CONFLICT");
      requireVisual(!hasPendingVisualWork(foreground) && !foreground.conflict, "VISUAL_CLAIM_PENDING_WORK");
      journal = await store.writeClaim({ ...journal, foregroundAttemptId: foreground.session.attemptId });
    }
    // Pre-existing account offline attempts have immutable snapshots/numbers.
    // Register their commands before merging counts, even if ordinary account
    // snapshots/events will instead be preserved as pending archive rows.
    if ((await store.list(options.accountLearner)).some(row => row.command)) {
      const account = service(options.accountLearner, store, send);
      try { await account.drainAttemptCommands(); } finally { account.dispose(); }
    }
    journal = { ...journal, accountLearner: options.accountLearner, phase: "prepared" };
    assertVisualClaimJournal(journal);
    await store.writeClaim(journal); // Must be durable before server ownership changes.
  }
  requireVisual(journal.accountLearner === options.accountLearner, "VISUAL_SESSION_CONFLICT");
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 20_000);
  try {
    const response = await send("/api/visual-guests/claim", { method: "POST", credentials: "same-origin", cache: "no-store", signal: abort.signal,
      headers: { "Content-Type": "application/json", "X-Visual-Learner": options.accountLearner },
      body: JSON.stringify({ claimId: journal.claimId, foregroundAttemptId: journal.foregroundAttemptId }) });
    const receipt = await response.json();
    if (!response.ok) throw new VisualClaimTransportError(response.status, typeof receipt.code === "string" ? receipt.code : "VISUAL_CLAIM_FAILED");
    requireVisual(response.headers.get("X-Visual-Learner") === options.accountLearner, "VISUAL_SESSION_CONFLICT");
    assertVisualClaimReceipt(receipt, journal);
    return await store.installClaim(journal.claimId, receipt);
  } finally { clearTimeout(timeout); }
}
