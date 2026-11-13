"use client";

import { useRef } from "react";
import { UploadIcon } from "@/components/icons/uploadIcon";
import type { InfoCardMediaAction, InfoCardMediaLayout } from "./infoCardMediaLayout";
import styles from "./InfoCardEditor.module.css";

// Renders the media layout projection and nothing else: the layout decides which message and actions exist.
// File selection, upload, Retry, Cancel and Remove are the editor's existing handlers, passed in unchanged.
const LABELS: Record<InfoCardMediaAction, string> = {
  choose: "Choose file", replace: "Replace media", chooseAnother: "Choose another file", retry: "Retry upload", cancel: "Cancel upload", remove: "Remove media",
};

export default function InfoCardMediaArea({ layout, hasRetryFile, onChoose, onRetry, onCancel, onRemove, onUnavailable, describedBy }: {
  layout: InfoCardMediaLayout;
  hasRetryFile: boolean;
  onChoose: (file: File) => void;
  onRetry: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onUnavailable: () => void;
  describedBy?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const run = (action: InfoCardMediaAction) => ({ choose: () => input.current?.click(), replace: () => input.current?.click(), chooseAnother: () => input.current?.click(),
    retry: onRetry, cancel: onCancel, remove: onRemove })[action]();
  return <section className={styles.media} aria-label="Info Card media" data-media-state={layout.state}>
    {layout.state === "unavailable" ? <button type="button" aria-disabled="true" aria-describedby={describedBy} onClick={onUnavailable}>Image/video (optional)</button> : <>
      {/* One file input serves every choose, replace and choose-another action. It stays in the page so a phone
          opens its photo library from a real tap, and is only visually hidden. */}
      <input ref={input} className={styles.mediaFile} type="file" aria-label="Upload Info Card media" accept="image/*,video/*" tabIndex={-1} aria-hidden="true" disabled={layout.state === "uploading"}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onChoose(file); }} />
      {layout.message && <p className={styles.mediaMessage} role={layout.tone === "alert" ? "alert" : layout.tone === "status" ? "status" : undefined}>
        {layout.state === "empty" && <UploadIcon className={styles.mediaIcon} />}{layout.message}</p>}
      <div className={styles.mediaActions}>
        {layout.actions.filter(action => action !== "retry" || hasRetryFile).map(action => <button key={action} type="button" onClick={() => run(action)}>{LABELS[action]}</button>)}
      </div>
    </>}
  </section>;
}
