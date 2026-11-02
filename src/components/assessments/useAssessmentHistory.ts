"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import { readAssessmentHistory, type AssessmentHistoryResponse } from "@/lib/assessments/historyClient";
import type { ScopedProgressAssessmentHistory } from "@/lib/groupExperiences/progressReads";
import { groupFetch } from "@/components/group-experiences/groupClient";
import type { AssessmentSource } from "@/lib/assessments/contracts";

export type AssessmentContext = { viewerUserId: string; source: AssessmentSource; deckTemplateId?: string; canCreate: boolean; showOrigin?: boolean; group?: { experienceId: string; frameworkId: string; subjectUserId?: string } };
export function useAssessmentHistory(context: AssessmentContext) {
  const { viewerUserId: actor, source } = context;
  const id = source.kind === "card" ? source.cardTemplateId : source.itemId, kind = source.kind;
  const group = context.group, groupKey = JSON.stringify(group ?? null);
  const key = JSON.stringify([actor, kind, id, groupKey]);
  const subscribe = useCallback((listener: () => void) => workingCardStore.subscribe(actor, listener), [actor]);
  const snapshot = useCallback(() => workingCardStore.epoch(actor), [actor]);
  const epoch = useSyncExternalStore(subscribe, snapshot, () => 0);
  const [request, setRequest] = useState(0);
  const refresh = useCallback(() => setRequest((value) => value + 1), []);
  const readKey = JSON.stringify([key, epoch, request]);
  const [state, setState] = useState<{ key: string; readKey: string; data?: AssessmentHistoryResponse | (ScopedProgressAssessmentHistory & { configured: boolean }); error?: string }>({ key, readKey: "" });
  useEffect(() => {
    const controller = new AbortController();
    const target: AssessmentSource = kind === "card" ? { kind, cardTemplateId: id } : { kind, itemId: id };
    const read = async () => {
      if (!group) return readAssessmentHistory(actor, target, controller.signal);
      const base = `/api/group-experiences/${encodeURIComponent(group.experienceId)}/frameworks/${encodeURIComponent(group.frameworkId)}`;
      const path = kind === "item" ? `/items/${encodeURIComponent(id)}/history` : `/cards/${encodeURIComponent(id)}/history`;
      const value = await groupFetch<ScopedProgressAssessmentHistory>(actor, `${base}${path}${group.subjectUserId ? `?${new URLSearchParams({ subjectUserId: group.subjectUserId })}` : ""}`, controller.signal);
      if (value.experienceId !== group.experienceId || value.frameworkId !== group.frameworkId
        || (group.subjectUserId ? value.owner.kind !== "personal" || value.owner.userId !== group.subjectUserId : value.owner.kind !== "group")) throw Error("Assessment context changed. Reopen history.");
      if ((kind === "card" ? !("cardTemplateId" in value.target) || value.target.cardTemplateId !== id : !("frameworkItemId" in value.target) || value.target.frameworkItemId !== id)
        || !Number.isFinite(Date.parse(value.leaseExpiresAt)) || Date.parse(value.leaseExpiresAt) <= Date.now()) throw Error("Assessment scope or authority changed. Refresh history.");
      return { ...value, configured: true };
    };
    void read().then((data) => {
      if (!controller.signal.aborted) setState({ key, readKey, data });
    }, (error: unknown) => {
      if (!controller.signal.aborted) setState((previous) => ({ key, readKey, data: !group && previous.key === key ? previous.data : undefined,
        error: error instanceof Error ? error.message : "Unable to load assessment history." }));
    });
    return () => controller.abort();
  // groupKey captures the immutable experience, owner and Framework context.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, kind, id, key, readKey, groupKey]);
  useEffect(() => {
    if (!groupKey || groupKey === "null") return;
    const revalidate = () => {
      setState(previous => ({ ...previous, data: undefined }));
      if (document.visibilityState !== "hidden") refresh();
    };
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") refresh(); }, 4000);
    window.addEventListener("focus", revalidate); document.addEventListener("visibilitychange", revalidate);
    return () => { clearInterval(timer); window.removeEventListener("focus", revalidate); document.removeEventListener("visibilitychange", revalidate); };
  }, [groupKey, refresh]);
  useEffect(() => {
    const data = state.data;
    if (!data || !("leaseExpiresAt" in data)) return;
    const timer = setTimeout(() => setState(previous => previous.data === data ? { ...previous, data: undefined, error: "Current assessment authority expired. Refresh history." } : previous), Math.max(0, Date.parse(data.leaseExpiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [state.data]);
  return { data: state.key === key ? state.data : undefined, loading: state.readKey !== readKey,
    error: state.readKey === readKey ? state.error : undefined, refresh };
}
