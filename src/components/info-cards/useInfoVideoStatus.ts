"use client";
import { useEffect, useRef, useState } from "react";
import type { InfoCardEditorController, SettledPublication } from "./infoCardEditorController";
import { infoCardError } from "./infoCardErrors";
import type { InfoCardVideoStatus } from "./infoCardMediaLayout";

// Polls the draft video while it processes. The same request completes a stored Publish or Save once the
// video is ready (checkpoint 10), so `onPublication` hears the outcome while the editor stays open.
export function useInfoVideoStatus(controller: InfoCardEditorController, onPublication?: (state: SettledPublication) => void): InfoCardVideoStatus {
  const root = controller.ack?.root;
  const asset = controller.desired.mediaItem;
  const key = root?.draft?.mediaItem?.mediaType === "video" && root.draft.mediaItem.assetId === asset?.assetId
    ? `${root.revision}:${asset.assetId}` : "";
  const [result, setResult] = useState<InfoCardVideoStatus & { key: string }>({ key: "", state: "", error: "" });
  const settled = useRef(onPublication);
  useEffect(() => { settled.current = onPublication; });
  useEffect(() => {
    if (!key) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      // Never check while a draft save is about to cancel the request: the save must win.
      if (controller.dirty || controller.running) { timer = setTimeout(() => void load(), 500); return; }
      try {
        const value = await controller.request<{ status: "processing" | "ready" | "failed"; progress?: number; publication?: SettledPublication }>(`${controller.url}/media/status?revision=${key.split(":")[0]}`);
        if (!active) return;
        setResult({ key, state: value.status, progress: value.progress, error: "" });
        if (value.publication) settled.current?.(value.publication);
        if (value.status === "processing") timer = setTimeout(() => void load(), 2000);
      } catch (cause) { if (active) setResult({ key, state: "", error: infoCardError(cause) }); }
    };
    timer = setTimeout(() => void load(), 0);
    return () => { active = false; clearTimeout(timer); };
  }, [controller, key]);
  return result.key === key ? result : { state: key ? "checking" : "", error: "" } satisfies InfoCardVideoStatus;
}
