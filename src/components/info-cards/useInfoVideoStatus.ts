"use client";
import { useEffect, useState } from "react";
import type { InfoCardEditorController } from "./infoCardEditorController";
import { infoCardError } from "./infoCardErrors";

export function useInfoVideoStatus(controller: InfoCardEditorController) {
  const root = controller.ack?.root;
  const asset = controller.desired.mediaItem;
  const key = root?.draft?.mediaItem?.mediaType === "video" && root.draft.mediaItem.assetId === asset?.assetId
    ? `${root.revision}:${asset.assetId}` : "";
  const [result, setResult] = useState({ key: "", status: "", error: "" });
  useEffect(() => {
    if (!key) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const value = await controller.request<{ status: "processing" | "ready" | "failed"; progress?: number }>(`${controller.url}/media/status?revision=${key.split(":")[0]}`);
        if (!active) return;
        setResult({ key, status: value.status === "processing" ? `Processing video${value.progress === undefined ? "…" : `: ${Math.round(value.progress)}%`}` : value.status === "ready" ? "Video ready" : "Video processing failed; replace or remove it.", error: "" });
        if (value.status === "processing") timer = setTimeout(() => void load(), 2000);
      } catch (cause) { if (active) setResult({ key, status: "", error: infoCardError(cause) }); }
    };
    timer = setTimeout(() => void load(), 0);
    return () => { active = false; clearTimeout(timer); };
  }, [controller, key]);
  return result.key === key ? result : { status: key ? "Checking video…" : "", error: "" };
}
