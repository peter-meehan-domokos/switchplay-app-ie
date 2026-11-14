"use client";
import VisibilityIndicator from "./VisibilityIndicator";
import { requestCardVideoReadiness } from "@/lib/cardMediaClient";
import type { GalleryMediaRequest } from "@/lib/cardMediaViewer";
import type { PersonalMediaDisplayItem } from "@/lib/cards/personalHistoryProjection";

import { imageDeliveryUrl } from "@/lib/mediaDelivery";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { startStreamVideoReadinessPolling, useStreamVideoReadiness, type StreamVideoReadinessState } from "@/components/media/useStreamVideoReadiness";
import type { UserCardMediaUploadState, UserCardMediaUploadTarget } from "@/components/media/useKeyedUserCardMediaUploadController";
import { getCloudflareStreamThumbnailUrl } from "@/lib/cloudflareStreamPlayback";
import type { ImageMediaItem, VideoMediaItem, MediaItem } from "@/lib/media";
import { clearSelectedFileInput } from "@/lib/mediaUploadClient";
import { isCloudflareStreamVideoMediaItem } from "@/lib/media";

export type UserCardMediaRemovalState = {
  error: string | null;
  isRemoving: boolean;
};

type UserCardMediaUploadPanelProps = {
  getMetadata?: (item: MediaItem) => { filename: string; origin: string; uploader?: string };
  canUpload?: boolean;
  mutationDisabled?: boolean;
  canRemoveMedia?: (item: MediaItem) => boolean;
  // The viewer's own item outside its creation context: where it was created, shown in place of Delete (C1).
  getCreatedIn?: (item: MediaItem) => string | null;
  showPrivate?: boolean;
  getReadinessTarget?: (item: VideoMediaItem) => GalleryMediaRequest | undefined;
  images: ImageMediaItem[];
  videos: VideoMediaItem[];
  target: UserCardMediaUploadTarget;
  uploadState: UserCardMediaUploadState;
  removalStatesById: Record<string, UserCardMediaRemovalState | undefined>;
  onAddImage: (file: File) => void;
  onAddVideo: (file: File) => void;
  onRemoveMedia: (item: MediaItem) => void;
  getMediaKey?: (item: MediaItem) => string;
  getVideoTarget?: (item: VideoMediaItem) => UserCardMediaUploadTarget;
};

// Non-interactive: a small "Created in:" above the originating context name.
function CreatedIn({ label }: { label: string | null | undefined }) {
  return label ? <p className="user-card-media-tile-created-in"><span className="user-card-media-tile-created-in-label">Created in:</span><span>{label}</span></p> : null;
}

function VideoTile({ item, target, removalState, onRemove, canRemove = true, mutationDisabled = false, showPrivate = false, readinessTarget, getMetadata, createdIn }: {
  getMetadata?: UserCardMediaUploadPanelProps["getMetadata"]; createdIn?: string | null;
  item: VideoMediaItem; canRemove?: boolean; mutationDisabled?: boolean; showPrivate?: boolean; readinessTarget?: GalleryMediaRequest;
  target: UserCardMediaUploadTarget;
  removalState?: UserCardMediaRemovalState;
  onRemove: () => void;
}) {
  const { retry, state: streamState } = useStreamVideoReadiness(target, item.assetId, isCloudflareStreamVideoMediaItem(item) && !readinessTarget);
  const [collectionState, setCollectionState] = useState<StreamVideoReadinessState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0), requestKey = JSON.stringify(readinessTarget), targetKey = JSON.stringify(target);
  useEffect(() => {
    if (!requestKey) return;
    return startStreamVideoReadinessPolling(JSON.parse(targetKey), item.assetId, setCollectionState, { requestStatus: (_target, _asset, signal) => requestCardVideoReadiness(JSON.parse(requestKey), signal) });
  }, [requestKey, targetKey, item.assetId, attempt]);
  const state = readinessTarget ? collectionState : isCloudflareStreamVideoMediaItem(item) ? streamState : { status: "ready" as const };
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const showThumbnail = state.status === "ready" && !thumbnailFailed;
  const canRetry = state.status === "waiting" || state.status === "failed" || state.status === "unavailable";
  const statusText = state.status === "ready"
    ? "Ready"
    : state.status === "failed"
      ? "Video processing failed."
      : state.status === "unavailable"
        ? "Unable to check video status."
        : state.status === "waiting"
          ? "Still processing. Check again."
          : state.status === "processing" && state.progress !== undefined
            ? `Processing video… ${Math.round(state.progress)}%`
            : "Processing video…";

  return (
    <li className="user-card-media-tile" data-media-item-id={item.id}>
      <div className="user-card-media-tile-preview user-card-media-tile-preview--video">
        {showThumbnail ? (
          // Stream thumbnail delivery is resolved by the existing playback helper.
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" onError={() => setThumbnailFailed(true)} src={isCloudflareStreamVideoMediaItem(item) ? (item as PersonalMediaDisplayItem).collection?.source.kind === "group" ? item.thumbnailSrc : getCloudflareStreamThumbnailUrl(item) : item.thumbnailSrc ?? item.src} />
        ) : <span aria-hidden="true">Video</span>}
      </div>
      {showPrivate ? <span className="media-centre-private-label"><VisibilityIndicator visible={(item as PersonalMediaDisplayItem).collection?.private === false} /></span> : null}
      <p className="user-card-media-tile-name" title={getMetadata?.(item).filename ?? item.description}>{getMetadata?.(item).filename ?? item.description}</p>
      {getMetadata ? <p className="user-card-media-tile-origin">{getMetadata(item).uploader !== undefined ? `By: ${getMetadata(item).uploader}` : `In: ${getMetadata(item).origin}`}</p> : null}
      <p className="user-card-media-tile-status" role={state.status === "failed" || state.status === "unavailable" ? "alert" : "status"}>
        {statusText}
      </p>
      {canRetry ? (
        <button className="user-card-media-tile-retry" onClick={() => readinessTarget ? setAttempt(v => v + 1) : retry()} type="button">
          Check again
        </button>
      ) : null}
      <CreatedIn label={createdIn} />
      {canRemove ? <button
        aria-label={`Remove video ${item.description} (${item.id})`}
        className="creator-modal-secondary user-card-media-tile-remove"
        disabled={mutationDisabled || removalState?.isRemoving}
        onClick={onRemove}
        type="button"
      >
        {removalState?.isRemoving ? "Removing…" : "Remove"}
      </button> : null}
      {removalState?.error ? <p className="creator-modal-error" role="alert">{removalState.error}</p> : null}
    </li>
  );
}

export default function UserCardMediaUploadPanel({
  images,
  videos,
  target,
  uploadState,
  removalStatesById,
  onAddImage,
  onAddVideo,
  onRemoveMedia,
  getMetadata, canUpload = true, mutationDisabled = false, canRemoveMedia = () => true, getCreatedIn = () => null, showPrivate = false, getReadinessTarget,
  getMediaKey = (item) => item.id,
  getVideoTarget = () => target,
}: UserCardMediaUploadPanelProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    clearSelectedFileInput(event.currentTarget);
    if (file) onAddImage(file);
  }

  function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    clearSelectedFileInput(event.currentTarget);
    if (file) onAddVideo(file);
  }

  return (
    <div className="user-card-media-panel">
      <section className="creator-deck-introduction-section" aria-label="Images">
        <div className="user-card-media-section-header">
          <h2>Image</h2>
          {canUpload ? <input
            accept="image/*"
            aria-label="Choose image"
            className="creator-deck-introduction-image-input"
            disabled={mutationDisabled || uploadState.isImageUploading}
            onChange={handleImageChange}
            ref={imageInputRef}
            type="file"
          /> : null}
          {canUpload ? <button
            className="creator-modal-secondary"
            disabled={mutationDisabled || uploadState.isImageUploading}
            onClick={() => imageInputRef.current?.click()}
            type="button"
          >
            + Add image
          </button> : null}
        </div>
        {uploadState.isImageUploading ? (
          <p className="user-card-media-upload-status" role="status">
            {uploadState.imageUploadStage === "saving" ? "Saving image…" : "Uploading image…"}
          </p>
        ) : null}
        {uploadState.imageError ? <p className="creator-modal-error" role="alert">{uploadState.imageError}</p> : null}
        <ul className={`user-card-media-rail${showPrivate && images.length > 0 ? " user-card-media-rail--visibility" : ""}`} aria-label="Uploaded images">
          {images.map((item) => {
            const removalState = removalStatesById[getMediaKey(item)];

            return (
              <li className="user-card-media-tile" data-media-item-id={item.id} key={getMediaKey(item)}>
                <div className="user-card-media-tile-preview">
                  {/* Protected mode serves retained images through session-authorized delivery. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={item.description} src={imageDeliveryUrl(item.src)} />
                </div>
                {showPrivate ? <span className="media-centre-private-label"><VisibilityIndicator visible={(item as PersonalMediaDisplayItem).collection?.private === false} /></span> : null}
                <p className="user-card-media-tile-name" title={getMetadata?.(item).filename ?? item.description}>{getMetadata?.(item).filename ?? item.description}</p>
                {getMetadata ? <p className="user-card-media-tile-origin">{getMetadata(item).uploader !== undefined ? `By: ${getMetadata(item).uploader}` : `In: ${getMetadata(item).origin}`}</p> : null}
                <CreatedIn label={getCreatedIn(item)} />
                {canRemoveMedia(item) ? <button
                  aria-label={`Remove image ${item.description} (${item.id})`}
                  className="creator-modal-secondary user-card-media-tile-remove"
                  disabled={mutationDisabled || removalState?.isRemoving}
                  onClick={() => onRemoveMedia(item)}
                  type="button"
                >
                  {removalState?.isRemoving ? "Removing…" : "Remove"}
                </button> : null}
                {removalState?.error ? <p className="creator-modal-error" role="alert">{removalState.error}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="creator-deck-introduction-section" aria-label="Videos">
        <div className="user-card-media-section-header">
          <h2>Video</h2>
          {canUpload ? <input
            accept="video/*"
            aria-label="Choose video"
            className="creator-deck-introduction-image-input"
            disabled={mutationDisabled || uploadState.isVideoUploading}
            onChange={handleVideoChange}
            ref={videoInputRef}
            type="file"
          /> : null}
          {canUpload ? <button
            className="creator-modal-secondary"
            disabled={mutationDisabled || uploadState.isVideoUploading}
            onClick={() => videoInputRef.current?.click()}
            type="button"
          >
            + Add video
          </button> : null}
        </div>
        {uploadState.isVideoUploading ? (
          <p className="user-card-media-upload-status" role="status">
            {uploadState.videoUploadStage === "saving" ? "Saving video…" : "Uploading video…"}
          </p>
        ) : null}
        {uploadState.videoError ? <p className="creator-modal-error" role="alert">{uploadState.videoError}</p> : null}
        <ul className={`user-card-media-rail${showPrivate && videos.length > 0 ? " user-card-media-rail--visibility user-card-media-rail--videos" : ""}`} aria-label="Uploaded videos">
          {videos.map((item) => (
            <VideoTile
              item={item}
              getMetadata={getMetadata} showPrivate={showPrivate} canRemove={canRemoveMedia(item)} createdIn={getCreatedIn(item)} mutationDisabled={mutationDisabled} readinessTarget={getReadinessTarget?.(item)}
              key={getMediaKey(item)}
              onRemove={() => onRemoveMedia(item)}
              removalState={removalStatesById[getMediaKey(item)]}
              target={getVideoTarget(item)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
