"use client";
import { useRef } from "react";
import { createPortal } from "react-dom";
import InfoCardEditor from "./InfoCardEditor";
import type { InfoEditorDTO, PersonalEditorContext } from "./infoCardEditorController";
import type { PersonalInfoAssociation } from "@/lib/infoCards/model";
import { containInfoCardFocus, useInfoCardDialog } from "./useInfoCardDialog";
import { creatorNavigation } from "../creator/creatorNavigation";
import styles from "./InfoCardConsultation.module.css";

export default function PersonalInfoEditorDialog({ id, actor, username, initial, context, source, onSaved, onCancel }: {
  id: string; actor: string; username: string; initial: InfoEditorDTO | null; context: PersonalEditorContext; source?: HTMLElement;
  onSaved: (id: string, association?: PersonalInfoAssociation) => Promise<void>; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  useInfoCardDialog(dialog, cancel, source, true);
  return createPortal(<dialog ref={dialog} className={styles.editorDialog} aria-label="Personal Info Card editor" aria-modal="true"
    onCancel={event => { event.preventDefault(); cancel.current?.click(); }}
    onKeyDown={event => { containInfoCardFocus(event); if (event.key === "Escape") { event.preventDefault(); cancel.current?.click(); } }}>
    <InfoCardEditor id={id} actor={actor} username={username} initial={initial} navigation={creatorNavigation({}, !initial)}
      personal={{ ...context, onSaved, onCancel, cancelRef: cancel }} />
  </dialog>, document.body);
}
