"use client";
import { useCallback } from "react";
import type { InfoMedia, MediaContext } from "@/lib/infoCards/model";
import type { PlaybackGrant } from "@/lib/cardPlaybackGrants";
import type { CloudflareStreamVideoMediaItem } from "@/lib/media";
import { CreatorRequestError } from "../creator/creatorRequest";
import InfoCardMediaViewer from "./InfoCardMediaViewer";

export default function InfoCardRemoteMediaViewer({ media, context, actor, onClose, returnFocus }: {
  media: InfoMedia; context: MediaContext; actor: string; onClose: () => void; returnFocus?: HTMLElement;
}) {
  const query = context.kind === "draft" ? `revision=${context.revision}` : `version=${context.version}`;
  const url = `/api/info-cards/${encodeURIComponent(context.infoCardId)}/media?${query}`;
  const resolve = useCallback(async (item: CloudflareStreamVideoMediaItem, signal: AbortSignal) => {
    const response = await fetch(url, { cache: "no-store", signal, headers: { "X-Creator-Actor": actor } });
    const value = await response.json();
    if (!response.ok) throw new CreatorRequestError(response.status, value.error ?? "INFO_MEDIA_FORBIDDEN");
    if (value.assetId !== item.assetId || typeof value.manifestUrl !== "string" || typeof value.thumbnailUrl !== "string"
      || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) throw new Error("Invalid info media grant");
    return value as PlaybackGrant;
  }, [url, actor]);
  return <InfoCardMediaViewer media={media} imageSrc={url} resolvePlayback={resolve} onClose={onClose} returnFocus={returnFocus} />;
}
