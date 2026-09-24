"use client";

import { useRef, type ChangeEvent } from "react";
import StreamVideoReadinessPreview from "@/components/media/StreamVideoReadinessPreview";
import type { ImageMediaItem, VideoMediaItem } from "@/lib/media";
import { isCloudflareStreamVideoMediaItem } from "@/lib/media";
import { clearSelectedFileInput, type MediaUploadTarget } from "@/lib/mediaUploadClient";

type MediaUploadPanelProps = {
  image: ImageMediaItem | null;
  imageError?: string | null;
  imageHeading?: string;
  isImageUploading?: boolean;
  isVideoUploading?: boolean;
  onRemoveImage: () => void;
  onUploadImage: (file: File) => void;
  onUploadVideo: (file: File) => void;
  video: VideoMediaItem | null;
  videoError?: string | null;
  videoHeading?: string;
  videoReadinessTarget?: MediaUploadTarget;
  videoUploadStage?: "idle" | "saving" | "uploading";
};

export default function MediaUploadPanel({
  image,
  imageError,
  imageHeading = "Intro image",
  isImageUploading = false,
  isVideoUploading = false,
  onRemoveImage,
  onUploadImage,
  onUploadVideo,
  video,
  videoError,
  videoHeading = "Intro video",
  videoReadinessTarget,
  videoUploadStage = "idle",
}: MediaUploadPanelProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const hasVideo = video !== null;
  const streamVideo = isCloudflareStreamVideoMediaItem(video) ? video : null;
  const videoUploadLabel = videoUploadStage === "saving" ? "Saving video…" : "Uploading video…";

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0] ?? null;

    clearSelectedFileInput(event.currentTarget);

    if (selectedFile) {
      onUploadImage(selectedFile);
    }
  }

  function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0] ?? null;

    clearSelectedFileInput(event.currentTarget);

    if (selectedFile) {
      onUploadVideo(selectedFile);
    }
  }

  return (
    <>
      <section className="creator-deck-introduction-section">
        <h2>{imageHeading}</h2>
        <div className="creator-deck-introduction-image-shell">
          {image ? (
            // The extracted creator preview deliberately retains the existing raw image behavior.
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={image.description} className="creator-deck-introduction-image-preview" src={image.src} />
          ) : null}
          <div className="creator-deck-introduction-image-actions">
            <input
              accept="image/*"
              className="creator-deck-introduction-image-input"
              disabled={isImageUploading}
              onChange={handleImageChange}
              ref={imageInputRef}
              type="file"
            />
            <button
              className="creator-modal-secondary"
              disabled={isImageUploading}
              onClick={() => imageInputRef.current?.click()}
              type="button"
            >
              {image ? "Replace image" : isImageUploading ? "Uploading..." : "Add image"}
            </button>
            {image ? (
              <button className="creator-modal-secondary" disabled={isImageUploading} onClick={onRemoveImage} type="button">
                Remove image
              </button>
            ) : null}
          </div>
          {imageError ? <p className="creator-modal-error">{imageError}</p> : null}
        </div>
      </section>
      <section className="creator-deck-introduction-section">
        <h2>{videoHeading}</h2>
        <div className="creator-deck-introduction-video-shell">
          {isVideoUploading ? (
            <div className="creator-deck-introduction-placeholder" aria-live="polite" aria-label="Video upload status">
              <span>{videoUploadLabel}</span>
            </div>
          ) : streamVideo && !videoError && videoReadinessTarget ? (
            <div className="creator-deck-introduction-video-preview" data-creator-pan-exempt>
              <StreamVideoReadinessPreview key={streamVideo.assetId} mediaItem={streamVideo} target={videoReadinessTarget} />
            </div>
          ) : (
            <div className="creator-deck-introduction-placeholder" aria-label="Intro video upload placeholder">
              <span>{hasVideo ? video?.description ?? "Intro video attached" : "Add video"}</span>
            </div>
          )}
          <div className="creator-deck-introduction-image-actions">
            <input
              accept="video/*"
              className="creator-deck-introduction-image-input"
              disabled={isVideoUploading}
              onChange={handleVideoChange}
              ref={videoInputRef}
              type="file"
            />
            <button
              className="creator-modal-secondary"
              disabled={isVideoUploading}
              onClick={() => videoInputRef.current?.click()}
              type="button"
            >
              {isVideoUploading ? videoUploadLabel : hasVideo ? "Replace video" : "Add video"}
            </button>
          </div>
          {videoError ? <p className="creator-modal-error">{videoError}</p> : null}
        </div>
      </section>
    </>
  );
}
