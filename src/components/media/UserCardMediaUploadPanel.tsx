"use client";

import { imageDeliveryUrl } from "@/lib/mediaDelivery";
import { useRef, useState, type ChangeEvent } from "react";
import { useStreamVideoReadiness } from "@/components/media/useStreamVideoReadiness";
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

function VideoTile({ item, target, removalState, onRemove }: {
  item: VideoMediaItem;
  target: UserCardMediaUploadTarget;
  removalState?: UserCardMediaRemovalState;
  onRemove: () => void;
}) {
  const { retry, state: streamState } = useStreamVideoReadiness(target, item.assetId, isCloudflareStreamVideoMediaItem(item));
  const state = isCloudflareStreamVideoMediaItem(item) ? streamState : { status: "ready" as const };
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
          <img alt="" onError={() => setThumbnailFailed(true)} src={isCloudflareStreamVideoMediaItem(item) ? getCloudflareStreamThumbnailUrl(item) : item.thumbnailSrc ?? item.src} />
        ) : <span aria-hidden="true">Video</span>}
      </div>
      <p className="user-card-media-tile-name" title={item.description}>{item.description}</p>
      <p className="user-card-media-tile-status" role={state.status === "failed" || state.status === "unavailable" ? "alert" : "status"}>
        {statusText}
      </p>
      {canRetry ? (
        <button className="user-card-media-tile-retry" onClick={retry} type="button">
          Check again
        </button>
      ) : null}
      <button
        aria-label={`Remove video ${item.description} (${item.id})`}
        className="creator-modal-secondary user-card-media-tile-remove"
        disabled={removalState?.isRemoving}
        onClick={onRemove}
        type="button"
      >
        {removalState?.isRemoving ? "Removing…" : "Remove"}
      </button>
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
          <input
            accept="image/*"
            aria-label="Choose image"
            className="creator-deck-introduction-image-input"
            disabled={uploadState.isImageUploading}
            onChange={handleImageChange}
            ref={imageInputRef}
            type="file"
          />
          <button
            className="creator-modal-secondary"
            disabled={uploadState.isImageUploading}
            onClick={() => imageInputRef.current?.click()}
            type="button"
          >
            + Add image
          </button>
        </div>
        {uploadState.isImageUploading ? (
          <p className="user-card-media-upload-status" role="status">
            {uploadState.imageUploadStage === "saving" ? "Saving image…" : "Uploading image…"}
          </p>
        ) : null}
        {uploadState.imageError ? <p className="creator-modal-error" role="alert">{uploadState.imageError}</p> : null}
        <ul className="user-card-media-rail" aria-label="Uploaded images">
          {images.map((item) => {
            const removalState = removalStatesById[getMediaKey(item)];

            return (
              <li className="user-card-media-tile" data-media-item-id={item.id} key={getMediaKey(item)}>
                <div className="user-card-media-tile-preview">
                  {/* Protected mode serves retained images through session-authorized delivery. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={item.description} src={imageDeliveryUrl(item.src)} />
                </div>
                <p className="user-card-media-tile-name" title={item.description}>{item.description}</p>
                <button
                  aria-label={`Remove image ${item.description} (${item.id})`}
                  className="creator-modal-secondary user-card-media-tile-remove"
                  disabled={removalState?.isRemoving}
                  onClick={() => onRemoveMedia(item)}
                  type="button"
                >
                  {removalState?.isRemoving ? "Removing…" : "Remove"}
                </button>
                {removalState?.error ? <p className="creator-modal-error" role="alert">{removalState.error}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="creator-deck-introduction-section" aria-label="Videos">
        <div className="user-card-media-section-header">
          <h2>Video</h2>
          <input
            accept="video/*"
            aria-label="Choose video"
            className="creator-deck-introduction-image-input"
            disabled={uploadState.isVideoUploading}
            onChange={handleVideoChange}
            ref={videoInputRef}
            type="file"
          />
          <button
            className="creator-modal-secondary"
            disabled={uploadState.isVideoUploading}
            onClick={() => videoInputRef.current?.click()}
            type="button"
          >
            + Add video
          </button>
        </div>
        {uploadState.isVideoUploading ? (
          <p className="user-card-media-upload-status" role="status">
            {uploadState.videoUploadStage === "saving" ? "Saving video…" : "Uploading video…"}
          </p>
        ) : null}
        {uploadState.videoError ? <p className="creator-modal-error" role="alert">{uploadState.videoError}</p> : null}
        <ul className="user-card-media-rail" aria-label="Uploaded videos">
          {videos.map((item) => (
            <VideoTile
              item={item}
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
