"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { clientId } from "@/lib/clientId";
import { getInteractiveVisual, interactiveVisualCatalogue } from "@/lib/interactiveVisuals/catalogue";
import { isCloudflareStreamVideoMediaItem } from "@/lib/media";
import { isPhase2MockVideo, PHASE2_MOCK_VIDEO_NOTICE } from "@/lib/phase2MediaFixture";
import { MAX_STEP_MEDIA, validStepMediaItems, validStepMediaLabels, type StepMediaItem } from "@/lib/stepMedia";
import type { MediaUploadTarget } from "@/lib/mediaUploadClient";
import { useStreamVideoReadiness } from "@/components/media/useStreamVideoReadiness";
import { stepMediaLabelsFit } from "@/components/decks/measureStepMediaTabs";
import { defaultStepMediaLabel, putStepMedia, selectedStepVisual } from "./creatorStepMedia";
import styles from "./CreatorStepMediaModal.module.css";

type Props = {
  multimediaEnabled: boolean;
  title: string; items: readonly StepMediaItem[]; uploading: boolean; disabled: boolean; saveError?: boolean;
  readinessTarget: MediaUploadTarget;
  returnFocus: HTMLElement;
  onChange: (items: StepMediaItem[]) => void;
  onUpload: (kind: "video" | "image", file: File, replacementId?: string) => Promise<void>;
  onCancelUpload: () => void; onClose: () => void;
};
const labelError = "Use short, single-line labels that fit together on a 320px screen (12 characters each, 32 altogether).";
function validLabels(items: readonly StepMediaItem[]) { return validStepMediaItems(items) && stepMediaLabelsFit(items.map(item => item.label)); }
function VideoStatus({ item, target }: { item: StepMediaItem & { kind: "video" }; target: MediaUploadTarget }) {
  const stream = isCloudflareStreamVideoMediaItem(item.media) ? item.media : null;
  const mock = stream && isPhase2MockVideo(stream.assetId);
  const { state, retry } = useStreamVideoReadiness(target, stream?.assetId ?? "", !!stream && !mock);
  if (!stream) return <small>Video attached</small>;
  if (mock) return <small>{PHASE2_MOCK_VIDEO_NOTICE}</small>;
  const text = state.status === "ready" ? "Video ready" : state.status === "failed" ? "Video processing failed."
    : state.status === "unavailable" ? "Unable to check video processing status." : state.status === "waiting" ? "Video is still processing. Check again." : "Processing video…";
  return <div role={state.status === "failed" || state.status === "unavailable" ? "alert" : "status"}>
    <small>{text}</small>{["failed", "unavailable", "waiting"].includes(state.status) ? <button type="button" className="creator-modal-secondary" onClick={retry}>Check again</button> : null}
  </div>;
}
function MediaLabel({ item, items, disabled, onChange }: Pick<Props, "items" | "onChange" | "disabled"> & { item: StepMediaItem }) {
  const [value, setValue] = useState(item.label), id = useId();
  // Rendering must not measure layout. Invalid local text stays visible, while
  // the last accepted draft label remains unchanged until the next valid edit.
  const [invalid, setInvalid] = useState(false);
  return <label className={styles.field}>Tab label
    <input aria-label="Tab label" value={value} disabled={disabled} aria-invalid={invalid} aria-describedby={invalid ? id : undefined} onChange={event => {
      const label = event.currentTarget.value; setValue(label);
      const next = items.map(existing => existing.id === item.id ? { ...existing, label } : existing);
      const valid = validLabels(next); setInvalid(!valid); if (valid) onChange(next);
    }} />
    {invalid ? <span className={styles.error} id={id}>{labelError}</span> : null}
  </label>;
}
export default function CreatorStepMediaModal(props: Props) {
  const { title, items, uploading, disabled, saveError, readinessTarget, returnFocus, onChange, onUpload, onCancelUpload, onClose } = props;
  const dialog = useRef<HTMLDialogElement>(null), close = useRef(onClose);
  const [error, setError] = useState("");
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const origin = returnFocus, element = dialog.current!;
    element.showModal();
    return () => { element.close(); if (origin?.isConnected) origin.focus({ preventScroll: true }); };
  }, [returnFocus]);
  const blocked = disabled || uploading;
  function change(next: StepMediaItem[]) {
    if (blocked) return;
    if (!validLabels(next)) { setError(labelError); return; }
    try { onChange(next); setError(""); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to change media."); }
  }
  function visual(activityId: string, previous?: StepMediaItem) {
    if (!activityId || blocked) return;
    try { change(putStepMedia(items, selectedStepVisual(activityId, previous?.id ?? clientId(), previous), previous?.id)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to change media."); }
  }
  async function upload(kind: "image" | "video", event: ChangeEvent<HTMLInputElement>, previous?: StepMediaItem) {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
    if (!file || blocked) return;
    const labels = previous ? items.map(item => item.label) : [...items.map(item => item.label), defaultStepMediaLabel(kind)];
    if (!validStepMediaLabels(labels) || !stepMediaLabelsFit(labels)) { setError(labelError); return; }
    setError("");
    try { await onUpload(kind, file, previous?.id); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Upload failed. Your existing media is kept."); }
  }
  const uploadChoices = (previous?: StepMediaItem) => <div className={styles.actions}>
    {(props.multimediaEnabled ? ["video", "image"] as const : ["video"] as const).map(kind => <label className="creator-modal-secondary" key={kind}>
      {previous ? `Replace with ${kind}` : `Add ${kind}`}
      <input type="file" accept={`${kind}/*`} aria-label={previous ? `Replace ${previous.label} with ${kind}` : `Add ${kind}`} disabled={blocked || !previous && items.length >= (props.multimediaEnabled ? MAX_STEP_MEDIA : 1)}
        onChange={event => void upload(kind, event, previous)} />
    </label>)}
    {props.multimediaEnabled ? <label className={styles.field}>{previous ? "Replace with Interactive Visual" : "Add Interactive Visual"}
      <select aria-label={previous ? `Replace ${previous.label} with Interactive Visual` : "Add Interactive Visual"} value="" disabled={blocked || !previous && items.length >= MAX_STEP_MEDIA}
        onChange={event => visual(event.currentTarget.value, previous)}>
        <option value="">Choose a published visual</option>
        {interactiveVisualCatalogue.filter(entry => entry.status === "published").map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
      </select>
    </label> : null}
  </div>;
  return <dialog ref={dialog} className={styles.dialog} aria-label={title} data-creator-pan-exempt data-creator-step-media
    onCancel={event => { event.preventDefault(); close.current(); }} onClick={event => event.stopPropagation()}
    onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <header className={styles.header}><h2>{title}</h2><button type="button" className="creator-modal-close" onClick={onClose}>Close</button></header>
    <p className={styles.description}>{props.multimediaEnabled ? "Up to four media items. " : ""}Valid changes save to the card draft; publish with the existing card controls.</p>
    <ol className={styles.list}>
      {items.map((item, index) => <li className={styles.item} key={item.id} data-attachment-id={item.id}>
        <strong>{index + 1}. {item.kind === "activity" ? getInteractiveVisual(item.activityId)?.title ?? "Interactive Visual unavailable" : item.media.description}</strong>
        {props.multimediaEnabled ? <MediaLabel item={item} items={items} disabled={blocked} onChange={change} /> : null}
        {props.multimediaEnabled && item.kind === "image" ? <label className={styles.field}>Image description
          <input value={item.alt} maxLength={1000} disabled={blocked} onChange={event => change(items.map(existing => existing.id === item.id ? { ...item, alt: event.currentTarget.value } : existing))} />
        </label> : null}
        {item.kind === "video" ? <VideoStatus item={item} target={readinessTarget} /> : null}
        <div className={styles.actions}>
          {props.multimediaEnabled ? <><button type="button" className="creator-modal-secondary" disabled={blocked || index === 0} onClick={() => { const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; change(next); }}>Move up</button>
          <button type="button" className="creator-modal-secondary" disabled={blocked || index === items.length - 1} onClick={() => { const next = [...items]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; change(next); }}>Move down</button></> : null}
          <button type="button" className="creator-modal-secondary" disabled={blocked} onClick={() => change(items.filter(existing => existing.id !== item.id))}>Remove</button>
        </div>
        {uploadChoices(item)}
      </li>)}
    </ol>
    {uploadChoices()}
    {uploading ? <p role="status">Uploading… <button type="button" className="creator-modal-secondary" onClick={onCancelUpload}>Cancel upload</button></p> : null}
    {error || saveError ? <p className={styles.error} role="alert">{error || "The card draft could not be saved. Your current media is kept for retry in Creator."}</p> : null}
  </dialog>;
}
