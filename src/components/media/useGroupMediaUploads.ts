"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GroupMediaUpload, type GroupUploadContext } from "@/lib/mediaCollection/operations";
import { personalWork } from "@/lib/cards/personalWork";
import { initialUserCardMediaUploadState, type UserCardMediaUploadState } from "./useKeyedUserCardMediaUploadController";

type Kind = "image" | "video";
type Pending = { operation: GroupMediaUpload; abort: AbortController; fileKey: string };

// Group uploads belong to the Group Experience, not to the Media Centre dialog:
// closing the dialog (or moving Card) leaves them running, as Personal uploads
// do. Each operation keeps the Group, Card and creation context it started with;
// the server validates everything else when the upload is allocated and committed.
// Leaving the Group Experience aborts outstanding uploads.
export function useGroupMediaUploads() {
  const [states, setStates] = useState<Record<string, UserCardMediaUploadState>>({});
  const pending = useRef(new Map<string, Pending>()), mounted = useRef(true);
  useEffect(() => {
    mounted.current = true; const uploads = pending.current;
    return () => { mounted.current = false; uploads.forEach(entry => entry.abort.abort()); uploads.clear(); };
  }, []);
  const getState = useCallback((cardTemplateId: string) => states[cardTemplateId] ?? initialUserCardMediaUploadState, [states]);
  const upload = useCallback(async (context: GroupUploadContext, kind: Kind, file: File) => {
    const card = context.cardTemplateId, key = `${card}:${kind}`, fileKey = JSON.stringify([file.name, file.type, file.size, file.lastModified]);
    const patch = (change: Partial<UserCardMediaUploadState>) => { if (mounted.current) setStates(all => ({ ...all, [card]: { ...(all[card] ?? initialUserCardMediaUploadState), ...change } })); };
    const busy = kind === "image" ? "isImageUploading" : "isVideoUploading";
    let entry = pending.current.get(key);
    // An exact retry of a failed upload reuses its operation; a different file starts a new one.
    if (!entry || entry.fileKey !== fileKey) { entry?.abort.abort(); entry = { operation: new GroupMediaUpload(context, file), abort: new AbortController(), fileKey }; pending.current.set(key, entry); }
    patch({ [busy]: true, [`${kind}UploadStage`]: "uploading", [`${kind}Error`]: null });
    let finish: ReturnType<typeof personalWork.begin> | undefined;
    try {
      finish = personalWork.begin({ userId: context.viewerUserId, cardIds: [card], context: { kind: "experience-contribution", experienceId: context.experienceId } }, `upload:${entry.operation.operationId}`);
      await entry.operation.run(entry.abort.signal); finish(); pending.current.delete(key);
    } catch (error) {
      finish?.();
      if (!entry.abort.signal.aborted) patch({ [`${kind}Error`]: error instanceof Error ? error.message : "Upload failed." });
    } finally { patch({ [busy]: false, [`${kind}UploadStage`]: "idle" }); }
  }, []);
  return { getState, upload };
}

export type GroupMediaUploads = ReturnType<typeof useGroupMediaUploads>;
