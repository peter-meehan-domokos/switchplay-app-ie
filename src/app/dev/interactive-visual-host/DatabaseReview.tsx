"use client";

import { useEffect, useState } from "react";
import { createAccountVisualPersistence } from "@/lib/visualLearningRecords/client";
import InteractiveVisualPreview from "@/components/interactiveVisuals/InteractiveVisualPreview";

/** Internal persistence probe, excluded from production routing and the published catalogue. */
export default function DatabaseReview() {
  const [service, setService] = useState<ReturnType<typeof createAccountVisualPersistence> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true, persistence: ReturnType<typeof createAccountVisualPersistence> | undefined;
    void fetch("/api/auth/me", { cache: "no-store" }).then(response => response.json()).then(({ user }) => {
      if (!active) return;
      if (!user?.id) { setError("Sign in through the existing application before using this review."); return; }
      persistence = createAccountVisualPersistence({ learner: `account:${user.id}` }); setService(persistence);
    }).catch(() => { if (active) setError("Unable to verify the current account."); });
    return () => { active = false; persistence?.dispose(); };
  }, []);
  return <section aria-label="Database visual review"><h1>Database visual review</h1>{error ? <p>{error}</p> : null}
    {service ? <div style={{ display: "flex", height: 400, gap: 16 }}>
      <InteractiveVisualPreview activityId="roots-and-factors" origin={{ kind: "direct" }} persistence={service} />
      <InteractiveVisualPreview activityId="integration-area" origin={{ kind: "direct" }} persistence={service} />
    </div> : null}
  </section>;
}
