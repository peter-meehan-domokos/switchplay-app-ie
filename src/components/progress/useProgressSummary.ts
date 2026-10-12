"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import { flushPersonalMutations } from "@/lib/deckMutations";
import { readProgressSummary, type ProgressSummary } from "@/lib/frameworks/progressClient";

export function useProgressSummary(actor: string, frameworkId: string) {
  const subscribe = useCallback((listener: () => void) => workingCardStore.subscribe(actor, listener), [actor]);
  const snapshot = useCallback(() => workingCardStore.epoch(actor), [actor]);
  const epoch = useSyncExternalStore(subscribe, snapshot, () => 0);
  const [request, setRequest] = useState(0);
  const refresh = useCallback(() => setRequest((value) => value + 1), []);
  const key = JSON.stringify([actor, frameworkId]), readKey = JSON.stringify([key, epoch, request]);
  const [state, setState] = useState<{ key: string; readKey: string; data?: ProgressSummary; error?: string }>({ key, readKey: "" });
  useEffect(() => {
    if (!frameworkId) return;
    const controller = new AbortController();
    void (async () => {
      await flushPersonalMutations();
      if (controller.signal.aborted) return;
      const data = await readProgressSummary(actor, frameworkId, controller.signal);
      if (!controller.signal.aborted) setState({ key, readKey, data });
    })().catch((cause: unknown) => {
      if (!controller.signal.aborted) setState((previous) => ({ key, readKey, data: previous.key === key ? previous.data : undefined,
        error: cause instanceof Error ? cause.message : "Progress could not be refreshed." }));
    });
    return () => controller.abort();
  }, [actor, frameworkId, key, readKey]);
  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState !== "hidden") refresh(); };
    window.addEventListener("focus", refreshVisible); window.addEventListener("pageshow", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => { window.removeEventListener("focus", refreshVisible); window.removeEventListener("pageshow", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible); };
  }, [refresh]);
  return { data: state.key === key ? state.data : undefined, loading: !!frameworkId && state.readKey !== readKey,
    error: state.key === key && state.readKey === readKey ? state.error : undefined, refresh };
}
