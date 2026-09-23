"use client";

import { useRef, type ChangeEvent } from "react";
import CloudflareStreamPlayer from "@/components/media/CloudflareStreamPlayer";
import type { ImageMediaItem, VideoMediaItem } from "@/lib/media";
import { isCloudflareStreamVideoMediaItem } from "@/lib/media";
import { clearSelectedFileInput } from "@/lib/mediaUploadClient";

type MediaUploadPanelProps = {
  image: ImageMediaItem | null;
  imageError?: string | null;
  isImageUploading?: boolean;
  isVideoUploading?: boolean;
  onRemoveImage: () => void;
  onUploadImage: (file: File) => void;
  onUploadVideo: (file: File) => void;
  video: VideoMediaItem | null;
  videoError?: string | null;
};

export default function MediaUploadPanel({
  image,
  imageError,
  isImageUploading = false,
  isVideoUploading = false,
  onRemoveImage,
  onUploadImage,
  onUploadVideo,
  video,
  videoError,
}: MediaUploadPanelProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const hasVideo = video !== null;
  const streamVideo = isCloudflareStreamVideoMediaItem(video) ? video : null;

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
        <h2>Intro image</h2>
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
        <h2>Intro video</h2>
        <div className="creator-deck-introduction-video-shell">
          {streamVideo ? (
            <div className="creator-deck-introduction-video-preview" data-creator-pan-exempt>
              <CloudflareStreamPlayer mediaItem={streamVideo} />
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
              {hasVideo ? "Replace video" : isVideoUploading ? "Uploading..." : "Add video"}
            </button>
          </div>
          {videoError ? <p className="creator-modal-error">{videoError}</p> : null}
        </div>
      </section>
    </>
  );
}
