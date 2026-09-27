"use client";

import { useEffect, useRef, useState } from "react";
import { startCardMediaDownload, type DownloadState } from "@/lib/cardMediaClient";
import type { CardMediaRequest } from "@/lib/cardMediaViewer";
import styles from "./CardMediaViewer.module.css";

export default function CardMediaDownloadButton({ target, isVideo }: { target: CardMediaRequest; isVideo: boolean }) {
  const [state, setState] = useState<DownloadState>({ status: "idle" });
  const stopRef = useRef<(() => void) | null>(null);
  const busy = useRef(false);
  useEffect(() => () => { stopRef.current?.(); }, []);
  useEffect(() => {
    if (state.status !== "ready") return;
    // R2 links expire after five minutes; require a fresh authorized URL before then.
    const timer = setTimeout(() => setState({ status: "idle" }), 240_000);
    return () => clearTimeout(timer);
  }, [state.status]);

  const start = () => {
    if (busy.current) return;
    busy.current = true;
    stopRef.current?.();
    stopRef.current = startCardMediaDownload(target, (next) => {
      if (next.status === "error" || next.status === "ready") busy.current = false;
      setState(next);
    }, (download) => {
      const link = document.createElement("a");
      link.href = download.url;
      link.download = download.filename;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    });
  };

  return <div className={styles.download}>
    {state.status === "ready" ? <a className={styles.control} href={state.url} download={state.filename} target="_blank" rel="noopener noreferrer">Download ready</a> :
      <button className={styles.control} type="button" disabled={state.status === "preparing"} onClick={start} aria-label={isVideo ? "Download encoded MP4" : "Download image"}>
        {state.status === "preparing" ? "Preparing…" : state.status === "error" ? "Retry download" : "Download"}
      </button>}
    {state.status === "preparing" ? <span className={styles.downloadStatus} role="status">Preparing download{typeof state.progress === "number" ? ` · ${Math.round(state.progress)}%` : ""}</span> : null}
    {state.status === "error" ? <span className={styles.downloadStatus} role="alert">{state.message}</span> : null}
  </div>;
}
