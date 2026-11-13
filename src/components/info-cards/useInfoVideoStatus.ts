"use client";
import { useEffect, useState } from "react";
import type { InfoCardEditorController } from "./infoCardEditorController";
import { infoCardError } from "./infoCardErrors";
import type { InfoCardVideoStatus } from "./infoCardMediaLayout";

export function useInfoVideoStatus(controller: InfoCardEditorController): InfoCardVideoStatus {
  const root = controller.ack?.root;
  const asset = controller.desired.mediaItem;
  const key = root?.draft?.mediaItem?.mediaType === "video" && root.draft.mediaItem.assetId === asset?.assetId
    ? `${root.revision}:${asset.assetId}` : "";
  const [result, setResult] = useState<InfoCardVideoStatus & { key: string }>({ key: "", state: "", error: "" });
  useEffect(() => {
    if (!key) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const value = await controller.request<{ status: "processing" | "ready" | "failed"; progress?: number }>(`${controller.url}/media/status?revision=${key.split(":")[0]}`);
        if (!active) return;
        setResult({ key, state: value.status, progress: value.progress, error: "" });
        if (value.status === "processing") timer = setTimeout(() => void load(), 2000);
      } catch (cause) { if (active) setResult({ key, state: "", error: infoCardError(cause) }); }
    };
    timer = setTimeout(() => void load(), 0);
    return () => { active = false; clearTimeout(timer); };
  }, [controller, key]);
  return result.key === key ? result : { state: key ? "checking" : "", error: "" } satisfies InfoCardVideoStatus;
}
