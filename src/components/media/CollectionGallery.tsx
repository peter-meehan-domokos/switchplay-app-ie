"use client";
import { useEffect, useRef, type RefObject } from "react";
import { useMediaCollection } from "./useMediaCollection";
import type { GroupRefreshOwner } from "@/lib/groupExperiences/refreshOwner";
import { collectionDisplayItem } from "@/lib/mediaCollection/presentation";
import { collectionKey, type MediaCollectionContext, type MediaCollectionPage } from "@/lib/mediaCollection/contracts";
import CardMediaViewer from "./CardMediaViewer";
export default function CollectionGallery({ context, selectedKey, sourceRef, backgroundRef, onClose, initialPage, suspended = false, refreshOwner }: {
  refreshOwner?: GroupRefreshOwner;
  initialPage?: MediaCollectionPage; suspended?: boolean; context: MediaCollectionContext; selectedKey: string; sourceRef: RefObject<HTMLButtonElement | null>;
  backgroundRef: RefObject<HTMLElement | null>; onClose(): void;
}) {
  const collection = useMediaCollection(context, 30, "", undefined, false, initialPage ? { page: initialPage, selectedKey } : undefined, refreshOwner), initial = useRef(false);
  useEffect(() => {
    if (!collection.page || !collection.controller || initial.current) return;
    initial.current = true; collection.controller.select(selectedKey);
  }, [collection.page, collection.controller, selectedKey]);
  useEffect(() => { if (collection.page && !collection.loading && !collection.page.items.length) onClose(); }, [collection.error, collection.page, collection.loading, onClose]);
  if (suspended || !collection.controller) return null;
  const c = collection.controller, selected = c.selected(), index = Math.max(0, (collection.page?.items ?? []).findIndex(i => collectionKey(i) === (initial.current ? selected ? collectionKey(selected) : selectedKey : selectedKey)));
  return <CardMediaViewer items={(collection.page?.items ?? []).map(i => collectionDisplayItem(i, context))} index={index}
    collectionStatus={{ loading: collection.loading, error: collection.error, retry: () => { void c.refresh(); } }}
    target={{ viewerUserId: context.viewerUserId, cardTemplateId: context.cardTemplateId, sourceCardTemplateId: context.cardTemplateId }} collectionContext={context}
    paging={{ older: Boolean(collection.page?.older), newer: Boolean(collection.page?.newer), loading: collection.loading, total: collection.page?.total ?? 0, start: collection.page?.start ?? 0, navigate: direction => { void c.navigate(direction); } }}
    sourceRef={sourceRef} backgroundRef={backgroundRef} onClose={onClose} onSelect={key => c.select(key)} />;
}
