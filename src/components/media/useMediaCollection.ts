"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { MediaCollectionController, retainedMediaPreview, type CollectionLoader, type GallerySeed } from "@/lib/mediaCollection/controller";
import type { MediaCollectionContext } from "@/lib/mediaCollection/contracts";
import { MEDIA_COLLECTION_CHANGED } from "@/lib/mediaCollection/invalidation";
import type { GroupRefreshOwner } from "@/lib/groupExperiences/refreshOwner";
export function useMediaCollection(context: MediaCollectionContext | null, limit = 30, refreshKey = "", loader?: CollectionLoader, refreshFromNewest = false, initial?: GallerySeed, refreshOwner?: GroupRefreshOwner) {
  const key = JSON.stringify(context);
  // The seed is the already-authorised opening snapshot, not a controller identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const controller = useMemo(() => key === "null" || typeof window === "undefined" ? null : refreshFromNewest ? retainedMediaPreview(JSON.parse(key), loader, limit) : new MediaCollectionController(JSON.parse(key), loader, limit, initial), [key, limit, loader, refreshFromNewest]);
  const empty = useMemo(() => ({ page: null, selectedKey: null, loading: false, error: null }), []);
  const state = useSyncExternalStore(controller?.subscribe ?? (() => () => {}), controller?.snapshot ?? (() => empty), () => empty);
  useEffect(() => {
    if (!controller) return;
    controller.activate(); if (!controller.snapshot().page || !refreshFromNewest) void controller.load();
    const refresh = () => { if (document.visibilityState !== "hidden") void controller.refresh(refreshFromNewest); };
    const changed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && ((controller.context.kind === "owner" && detail.viewerUserId === controller.context.viewerUserId)
        || (detail.cardTemplateId === controller.context.cardTemplateId && detail.experienceId === controller.context.experienceId))) {
        controller.changed(e);
        if (detail.removed) controller.removed(detail.removed.source, detail.removed.action);
        if (refreshOwner) void refreshOwner.refresh(); else refresh();
      }
    };
    window.addEventListener(MEDIA_COLLECTION_CHANGED, changed);
    const off = refreshOwner && !refreshFromNewest ? refreshOwner.onRefresh(() => controller.refresh()) : undefined;
    if (!refreshOwner) { window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh); }
    const timer = !refreshOwner ? window.setInterval(refresh, 15000) : undefined;
    return () => { off?.(); if (!refreshFromNewest) controller.dispose(); if (timer) clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.removeEventListener(MEDIA_COLLECTION_CHANGED, changed); };
  }, [controller, refreshKey, refreshFromNewest, refreshOwner]);
  return { ...state, controller };
}
