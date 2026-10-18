"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import { readAssessmentHistory, type AssessmentHistoryResponse } from "@/lib/assessments/historyClient";
import type { AssessmentSource } from "@/lib/assessments/contracts";

export type AssessmentContext = { viewerUserId: string; source: AssessmentSource; deckTemplateId?: string; canCreate: boolean };
export function useAssessmentHistory(context: AssessmentContext) {
  const { viewerUserId: actor, source } = context;
  const id = source.kind === "card" ? source.cardTemplateId : source.itemId, kind = source.kind;
  const key = JSON.stringify([actor, kind, id]);
  const subscribe = useCallback((listener: () => void) => workingCardStore.subscribe(actor, listener), [actor]);
  const snapshot = useCallback(() => workingCardStore.epoch(actor), [actor]);
  const epoch = useSyncExternalStore(subscribe, snapshot, () => 0);
  const [request, setRequest] = useState(0);
  const refresh = useCallback(() => setRequest((value) => value + 1), []);
  const readKey = JSON.stringify([key, epoch, request]);
  const [state, setState] = useState<{ key: string; readKey: string; data?: AssessmentHistoryResponse; error?: string }>({ key, readKey: "" });
  useEffect(() => {
    const controller = new AbortController();
    const target: AssessmentSource = kind === "card" ? { kind, cardTemplateId: id } : { kind, itemId: id };
    void readAssessmentHistory(actor, target, controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ key, readKey, data });
    }, (error: unknown) => {
      if (!controller.signal.aborted) setState((previous) => ({ key, readKey, data: previous.key === key ? previous.data : undefined,
        error: error instanceof Error ? error.message : "Unable to load assessment history." }));
    });
    return () => controller.abort();
  }, [actor, kind, id, key, readKey]);
  return { data: state.key === key ? state.data : undefined, loading: state.readKey !== readKey,
    error: state.readKey === readKey ? state.error : undefined, refresh };
}
