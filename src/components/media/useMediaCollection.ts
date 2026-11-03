"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { MediaCollectionController } from "@/lib/mediaCollection/controller";
import type { MediaCollectionContext } from "@/lib/mediaCollection/contracts";
import { MEDIA_COLLECTION_CHANGED } from "@/lib/mediaCollection/invalidation";
export function useMediaCollection(context: MediaCollectionContext | null, limit = 30, refreshKey = "") {
  const key = JSON.stringify(context);
  const controller = useMemo(() => key === "null" ? null : new MediaCollectionController(JSON.parse(key), undefined, limit), [key, limit]);
  const empty = useMemo(() => ({ page: null, selectedKey: null, loading: false, error: null }), []);
  const state = useSyncExternalStore(controller?.subscribe ?? (() => () => {}), controller?.snapshot ?? (() => empty), () => empty);
  useEffect(() => {
    if (!controller) return;
    controller.activate(); void controller.load();
    const refresh = () => { if (document.visibilityState !== "hidden") void controller.refresh(); };
    const changed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && ((controller.context.kind === "owner" && detail.viewerUserId === controller.context.viewerUserId)
        || (detail.cardTemplateId === controller.context.cardTemplateId && detail.experienceId === controller.context.experienceId))) refresh();
    };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh); window.addEventListener(MEDIA_COLLECTION_CHANGED, changed);
    const timer = window.setInterval(refresh, 15000);
    return () => { controller.dispose(); clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.removeEventListener(MEDIA_COLLECTION_CHANGED, changed); };
  }, [controller, refreshKey]);
  return { ...state, controller };
}
