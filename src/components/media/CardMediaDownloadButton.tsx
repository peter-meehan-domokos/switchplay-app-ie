"use client";

import { useEffect, useRef, useState } from "react";
import { startCardMediaDownload, type DownloadState } from "@/lib/cardMediaClient";
import { fetchShareableVideoFile, formatVideoFetchDiagnostic, isIphoneOrIpadSafari, isShareCancellation, type VideoFetchDiagnostic } from "@/lib/iosVideoShare";
import { cardMediaVideoFileUrl, type CardMediaRequest } from "@/lib/cardMediaViewer";
import styles from "./CardMediaViewer.module.css";

type IosDeliveryState =
  | { status: "ready"; message?: string }
  | { status: "loading" | "sharing" }
  | { status: "tap-again" | "fallback" | "error"; message: string };

export default function CardMediaDownloadButton({ target, isVideo }: { target: CardMediaRequest; isVideo: boolean }) {
  const [state, setState] = useState<DownloadState>({ status: "idle" });
  const [iosDelivery, setIosDelivery] = useState<IosDeliveryState>({ status: "ready" });
  const [deliveryDiagnostics, setDeliveryDiagnostics] = useState<string[]>([]);
  const stopRef = useRef<(() => void) | null>(null);
  const fileFetchRef = useRef<AbortController | null>(null);
  const shareFileRef = useRef<File | null>(null);
  const shareAttempts = useRef(0);
  const mounted = useRef(true);
  const busy = useRef(false);
  const lastFallbackOpen = useRef(0);
  const isIosVideo = isVideo && typeof navigator !== "undefined" && isIphoneOrIpadSafari(navigator);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stopRef.current?.(); fileFetchRef.current?.abort(); shareFileRef.current = null; };
  }, []);
  useEffect(() => {
    if (state.status !== "ready" || isIosVideo) return;
    // R2 links expire after five minutes; require a fresh authorized URL before then.
    const timer = setTimeout(() => setState({ status: "idle" }), 240_000);
    return () => clearTimeout(timer);
  }, [isIosVideo, state.status]);

  const start = () => {
    if (busy.current) return;
    busy.current = true;
    stopRef.current?.();
    stopRef.current = startCardMediaDownload(target, (next) => {
      if (next.status === "error" || next.status === "ready") busy.current = false;
      setState(next);
    }, (download) => {
      if (isIosVideo) return;
      const link = document.createElement("a");
      link.href = download.url;
      link.download = download.filename;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    });
  };

  const shareVideo = async () => {
    if (busy.current || state.status !== "ready") return;
    busy.current = true;
    try {
      if (!navigator.canShare || !navigator.share) {
        setIosDelivery({ status: "fallback", message: "File sharing is unavailable in Safari. Use Download in new tab; Safari may save it in Files → Downloads." });
        return;
      }
      let file = shareFileRef.current;
      if (!file) {
        setIosDelivery({ status: "loading" });
        setDeliveryDiagnostics([]);
        const controller = new AbortController();
        fileFetchRef.current = controller;
        const record = (source: string) => (details: VideoFetchDiagnostic) => {
          if (!mounted.current) return;
          // Temporary real-device diagnostic. URLs stay in the device console; the UI redacts path tokens.
          console.info("Safari video delivery diagnostic", source, details);
          setDeliveryDiagnostics((previous) => [...previous, `${source}: ${formatVideoFetchDiagnostic(details)}`]);
        };
        try {
          file = await fetchShareableVideoFile(state.url, state.filename, controller.signal, fetch, record("Cloudflare"));
        } catch {
          if (!mounted.current || controller.signal.aborted) return;
          file = await fetchShareableVideoFile(cardMediaVideoFileUrl(target), state.filename, controller.signal, fetch, record("App delivery"));
        }
        fileFetchRef.current = null;
        if (!mounted.current) return;
        if (!file) {
          setIosDelivery({ status: "fallback", message: "This video is too large to share from Safari. Use Download in new tab; Safari may save it in Files → Downloads." });
          return;
        }
        shareFileRef.current = file;
        shareAttempts.current = 0;
      }
      if (!navigator.canShare({ files: [file] })) {
        shareFileRef.current = null;
        setIosDelivery({ status: "fallback", message: "File sharing is unavailable in Safari. Use Download in new tab; Safari may save it in Files → Downloads." });
        return;
      }
      if (navigator.userActivation && !navigator.userActivation.isActive) {
        setIosDelivery({ status: "tap-again", message: "Video is ready to share. Tap Open share sheet to continue." });
        return;
      }
      setIosDelivery({ status: "sharing" });
      shareAttempts.current += 1;
      try {
        await navigator.share({ files: [file], title: state.filename });
        shareAttempts.current = 0;
        if (mounted.current) setIosDelivery({ status: "ready", message: "Share sheet closed. Check Photos or Files for the video." });
      } catch (error) {
        if (!mounted.current) return;
        if (isShareCancellation(error)) {
          shareAttempts.current = 0;
          setIosDelivery({ status: "ready", message: "Sharing cancelled. The video is still ready." });
        }
        else if (error instanceof DOMException && error.name === "NotAllowedError" && shareAttempts.current === 1) {
          setIosDelivery({ status: "tap-again", message: "Safari needs another tap to open the share sheet." });
        } else setIosDelivery({ status: "error", message: "Safari could not share the video. Please retry." });
      }
    } catch {
      if (mounted.current && !fileFetchRef.current?.signal.aborted) {
        setIosDelivery({ status: "error", message: "The video could not be loaded for sharing. Please retry." });
      }
    } finally {
      busy.current = false;
      fileFetchRef.current = null;
    }
  };

  const openDownloadInNewTab = () => {
    if (state.status !== "ready") return;
    if (Date.now() - lastFallbackOpen.current < 2_000) return;
    lastFallbackOpen.current = Date.now();
    window.open(cardMediaVideoFileUrl(target), "_blank", "noopener,noreferrer");
  };

  return <div className={`${styles.download}${isIosVideo ? ` ${styles.iosDownload}` : ""}`}>
    {state.status === "ready" && isIosVideo ? <>
      {iosDelivery.status === "fallback" ? <button className={styles.control} type="button" onClick={openDownloadInNewTab}>Download in new tab</button> :
      <button className={styles.control} type="button" disabled={iosDelivery.status === "loading" || iosDelivery.status === "sharing"} onClick={() => { void shareVideo(); }}>
        {iosDelivery.status === "loading" ? "Loading video…" : iosDelivery.status === "sharing" ? "Opening share sheet…" :
          iosDelivery.status === "tap-again" ? "Open share sheet" : iosDelivery.status === "error" ? "Retry save" : "Save video"}
      </button>}
      {iosDelivery.status === "error" ?
        <button className={styles.control} type="button" onClick={openDownloadInNewTab}>Download in new tab</button> : null}
      {iosDelivery.status === "tap-again" || iosDelivery.status === "fallback" || iosDelivery.status === "error" ?
        <span className={styles.downloadStatus} role={iosDelivery.status === "error" ? "alert" : "status"}>{iosDelivery.message}</span> : null}
      {iosDelivery.status === "ready" && iosDelivery.message ? <span className={styles.downloadStatus} role="status">{iosDelivery.message}</span> : null}
      {deliveryDiagnostics.length ? <details className={styles.deliveryDiagnostics}>
        <summary>Video delivery details</summary>
        {deliveryDiagnostics.map((detail, index) => <p key={index}>{detail}</p>)}
        <p>Browser request: CORS mode, no custom headers, no Cloudflare cookies or API credentials. A rejected fetch has no readable HTTP response; compare the app delivery result to investigate CORS.</p>
      </details> : null}
    </> : state.status === "ready" ? <a className={styles.control} href={state.url} download={state.filename} target="_blank" rel="noopener noreferrer">Download ready</a> :
      <button className={styles.control} type="button" disabled={state.status === "preparing"} onClick={start} aria-label={isVideo ? "Download encoded MP4" : "Download image"}>
        {state.status === "preparing" ? "Preparing…" : state.status === "error" ? "Retry download" : "Download"}
      </button>}
    {state.status === "preparing" ? <span className={styles.downloadStatus} role="status">Preparing download{typeof state.progress === "number" ? ` · ${Math.round(state.progress)}%` : ""}</span> : null}
    {state.status === "error" ? <span className={styles.downloadStatus} role="alert">{state.message}</span> : null}
  </div>;
}
