"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OpenVisual, VisualPersistence } from "@/lib/interactiveVisuals/persistence";
import { createVisualPersistence, type VisualPersistenceClient } from "@/lib/visualLearningRecords/client";
import { bootstrapVisualGuest } from "@/lib/visualLearningRecords/guestClient";
import type { VisualGuestLoginContext } from "@/lib/visualLearningRecords/guestLoginContext";
import { createBrowserVisualStore } from "@/lib/visualLearningRecords/browserStore";
import { rememberVisualGuestClaim, VisualClaimTransportError } from "@/lib/visualLearningRecords/claimClient";
import { resumeVisualGuestClaim, startVisualGuestLoginHandoff } from "@/lib/visualLearningRecords/loginHandoff";
import InteractiveVisualPreview from "./InteractiveVisualPreview";
import styles from "./InteractiveVisualEntry.module.css";

export default function InteractiveVisualEntry({ activityId, title, accountId, claimId, guestContext }: {
  activityId: string; title: string; accountId?: string; claimId?: string; guestContext?: VisualGuestLoginContext;
}) {
  const router = useRouter(), [retry, setRetry] = useState(0);
  const [ready, setReady] = useState<{ service: VisualPersistenceClient; persistence: VisualPersistence; learner: string; resume: boolean } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false, service: VisualPersistenceClient | undefined;
    async function initialize() {
      const store = createBrowserVisualStore();
      let resume = false;
      if (accountId) {
        if (guestContext) {
          const journal = await startVisualGuestLoginHandoff(accountId, guestContext, store);
          resume = journal.claimId === claimId && journal.activityId === activityId;
        } else if (claimId && await store.readClaim(claimId)) {
          const journal = await resumeVisualGuestClaim(accountId, claimId, store);
          resume = journal.activityId === activityId;
        }
      }
      const learner = accountId ? `account:${accountId}` : await bootstrapVisualGuest(activityId);
      if (cancelled) return;
      service = createVisualPersistence({ learner, store });
      const activeService = service;
      const remember = (opened: OpenVisual) => {
        if (!accountId) void rememberVisualGuestClaim({ guestLearner: learner, activityId, foregroundAttemptId: opened.attemptId }, store).catch(() => {});
        return opened;
      };
      const persistence: VisualPersistence = { ...activeService,
        open: async (id, origin) => remember(await activeService.open(id, origin)),
        startNewAttempt: async opened => remember(await activeService.startNewAttempt!(opened)),
      };
      setReady({ learner, service: activeService, persistence, resume }); setFailed(null);
    }
    void initialize().catch(error => { if (!cancelled) setFailed(error instanceof VisualClaimTransportError && error.status === 409
      ? "Progress changed in another session. Your existing work is kept."
      : "Unable to restore progress. Your existing work is kept."); });
    return () => { cancelled = true; service?.dispose(); };
  }, [accountId, activityId, claimId, guestContext, retry]);
  const signIn = ready && !accountId ? async (opened: OpenVisual) => {
    await ready.service.settleLocal();
    const journal = await rememberVisualGuestClaim({ guestLearner: ready.learner, activityId, foregroundAttemptId: opened.attemptId });
    const returnTo = `/interactive-visuals/${encodeURIComponent(activityId)}?claimId=${journal.claimId}`;
    ready.service.dispose();
    router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  } : undefined;
  return <main className={styles.entry}>
    <h1>{title}</h1>
    {failed ? <p role="status">{failed} <button type="button" onClick={() => { setFailed(null); setRetry(value => value + 1); }}>Retry</button></p> :
      ready ? <div className={styles.preview}><InteractiveVisualPreview activityId={activityId} origin={{ kind: "direct" }} persistence={ready.persistence}
        onSignIn={signIn} autoOpen={ready.resume} /></div> : <p role="status">Preparing interactive visual…</p>}
  </main>;
}
