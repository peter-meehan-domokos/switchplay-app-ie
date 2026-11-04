"use client";

import { useEffect, useState } from "react";
import { createVisualPersistence } from "@/lib/visualLearningRecords/client";
import InteractiveVisualPreview from "@/components/interactiveVisuals/InteractiveVisualPreview";
import { bootstrapVisualGuest } from "@/lib/visualLearningRecords/guestClient";

/** Internal persistence probe, excluded from production routing and the published catalogue. */
export default function DatabaseReview({ guest = false }: { guest?: boolean }) {
  const [service, setService] = useState<ReturnType<typeof createVisualPersistence> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true, persistence: ReturnType<typeof createVisualPersistence> | undefined;
    void (async () => {
      let learner: string;
      if (guest) learner = await bootstrapVisualGuest("roots-and-factors");
      else {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) throw new Error("Session unavailable");
        const { user } = await response.json();
        if (!user?.id) { if (active) setError("Sign in through the existing application before using this review."); return; }
        learner = `account:${user.id}`;
      }
      if (!active) return;
      persistence = createVisualPersistence({ learner }); setService(persistence);
    })().catch(() => { if (active) setError("Unable to verify the current learner."); });
    return () => { active = false; persistence?.dispose(); };
  }, [guest]);
  return <section aria-label="Database visual review"><h1>Database visual review</h1>{error ? <p>{error}</p> : null}
    {service ? <div style={{ display: "flex", height: 400, gap: 16 }}>
      <InteractiveVisualPreview activityId="roots-and-factors" origin={{ kind: "direct" }} persistence={service} />
      <InteractiveVisualPreview activityId="integration-area" origin={{ kind: "direct" }} persistence={service} />
    </div> : null}
  </section>;
}
