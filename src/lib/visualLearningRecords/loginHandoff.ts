"use client";

import { createBrowserVisualStore, type VisualClaimStore } from "./browserStore";
import { completeVisualGuestClaim, rememberVisualGuestClaim } from "./claimClient";
import { assertVisualClaimJournal, type VisualClaimJournal } from "./claimOutbox";
import { assertUuid, principalKey, requireVisual, safeId } from "./contracts";
import type { VisualGuestLoginContext } from "./guestLoginContext";

const pending = new Map<string, Promise<VisualClaimJournal>>();
function serialize(account: string, guest: string, action: () => Promise<VisualClaimJournal>) {
  const key = `${account}|${guest}`, previous = pending.get(key); if (previous) return previous;
  const task = action().finally(() => pending.delete(key)); pending.set(key, task); return task;
}
/** Shares one handoff between sign-in navigation, the direct entry and the
 * existing account menu. No component unmount cancels committed ownership. */
export function startVisualGuestLoginHandoff(accountId: string, context: VisualGuestLoginContext, store: VisualClaimStore = createBrowserVisualStore()) {
  const account = principalKey({ kind: "account", id: accountId });
  requireVisual(typeof context.guestLearner === "string" && context.guestLearner.startsWith("guest:") && safeId(context.activityId), "INVALID_VISUAL_CLAIM_CONTEXT");
  assertUuid(context.guestLearner.slice(6)); assertUuid(context.foregroundAttemptId);
  return serialize(account, context.guestLearner, async () => {
    let journal = await store.findClaim(context.guestLearner);
    if (context.claimId) {
      assertUuid(context.claimId); requireVisual(context.createdAt && Number.isFinite(Date.parse(context.createdAt)), "INVALID_VISUAL_CLAIM_CONTEXT");
      if (!journal) journal = await store.writeClaim({ claimId: context.claimId, guestLearner: context.guestLearner, accountLearner: account,
        activityId: context.activityId, foregroundAttemptId: context.foregroundAttemptId, createdAt: context.createdAt, phase: "prepared" });
      requireVisual(journal.claimId === context.claimId && journal.foregroundAttemptId === context.foregroundAttemptId, "VISUAL_CLAIM_LOCAL_CONFLICT");
      if (journal.phase === "awaiting-login") journal = await store.writeClaim({ ...journal, accountLearner: account, phase: "prepared" });
    } else {
      journal ??= await rememberVisualGuestClaim({ guestLearner: context.guestLearner, activityId: context.activityId, foregroundAttemptId: context.foregroundAttemptId }, store);
      if (journal.phase === "awaiting-login") journal = await store.writeClaim({ ...journal, accountLearner: account });
    }
    assertVisualClaimJournal(journal); requireVisual(journal.accountLearner === account, "VISUAL_SESSION_CONFLICT");
    return completeVisualGuestClaim({ claimId: journal.claimId, accountLearner: account, store });
  });
}
export async function resumeVisualGuestClaim(accountId: string, claimId: string, store: VisualClaimStore = createBrowserVisualStore()) {
  assertUuid(claimId);
  const journal = await store.readClaim(claimId); assertVisualClaimJournal(journal);
  const account = principalKey({ kind: "account", id: accountId });
  requireVisual(!journal.accountLearner || journal.accountLearner === account, "VISUAL_SESSION_CONFLICT");
  return serialize(account, journal.guestLearner, () => completeVisualGuestClaim({ claimId, accountLearner: account, store }));
}
export async function resumeAccountVisualClaims(accountId: string) {
  const account = principalKey({ kind: "account", id: accountId }), store = createBrowserVisualStore();
  const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" }); if (!response.ok) return;
  const body = await response.json(); if (body.user?.id !== accountId) return;
  const journals = (await store.claimsForAccount(account)).filter(journal => journal.phase !== "installed").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const journal of journals) {
    try { await resumeVisualGuestClaim(accountId, journal.claimId, store); } catch { /* Durable journal/queues remain for reconnect. */ }
  }
  if (body.visualGuest) {
    try { await startVisualGuestLoginHandoff(accountId, body.visualGuest, store); } catch { /* Login and ordinary navigation remain successful. */ }
  }
}
