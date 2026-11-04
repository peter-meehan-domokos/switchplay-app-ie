"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { VisualPersistence } from "@/lib/interactiveVisuals/persistence";

type Service = VisualPersistence & { dispose: () => void };
const Context = createContext<{ service: VisualPersistence | null; unavailable: boolean }>({ service: null, unavailable: false });

function AccountRecords({ accountId, children }: { accountId?: string; children: ReactNode }) {
  const [service, setService] = useState<Service | null>(null), [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!accountId) return;
    let active = true, current: Service | undefined;
    // Keep IndexedDB, network requests and listener registration out of render.
    // Cancellation also covers the development Strict Mode setup/cleanup cycle.
    void import("@/lib/visualLearningRecords/client").then(({ createAccountVisualPersistence }) => {
      if (!active) return;
      current = createAccountVisualPersistence({ learner: `account:${accountId}` }); setService(current);
    }).catch(() => { if (active) setUnavailable(true); });
    return () => { active = false; current?.dispose(); };
  }, [accountId]);
  return <Context.Provider value={{ service, unavailable }}>{children}</Context.Provider>;
}

/** One service across focused Cards. An account change discards decoded state and requests. */
export function VisualLearningRecordsProvider({ accountId, children }: { accountId?: string; children: ReactNode }) {
  return <AccountRecords key={accountId ?? "read-only"} accountId={accountId}>{children}</AccountRecords>;
}
export const useVisualLearningRecords = () => useContext(Context);
