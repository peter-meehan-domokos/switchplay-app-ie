"use client";
import { useCallback, useEffect, useState } from "react";
import OverviewMenu from "@/components/layout/OverviewMenu";
import { readProgressMetadata, type ProgressMetadata } from "@/lib/frameworks/progressClient";
import FrameworkProgressTable from "./FrameworkProgressTable";
import { useProgressSummary } from "./useProgressSummary";
import styles from "./progress.module.css";

export default function ProgressShell({ currentUserId, userName }: { currentUserId: string; userName: string }) {
  return <ProgressSession key={currentUserId} actor={currentUserId} userName={userName} />;
}
function ProgressSession({ actor, userName }: { actor: string; userName: string }) {
  const [metadata, setMetadata] = useState<ProgressMetadata>(), [metadataError, setMetadataError] = useState("");
  const [metadataRequest, setMetadataRequest] = useState(0), [selected, setSelected] = useState("");
  const summary = useProgressSummary(actor, selected);
  useEffect(() => {
    const controller = new AbortController();
    void readProgressMetadata(actor, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setMetadata(data); setMetadataError("");
      const requested = new URLSearchParams(window.location.search).get("framework");
      setSelected((previous) => data.some((framework) => framework.id === previous) ? previous
        : data.find((framework) => framework.id === requested)?.id ?? data[0]?.id ?? "");
    }, (cause: unknown) => { if (!controller.signal.aborted) setMetadataError(cause instanceof Error ? cause.message : "Progress configuration is unavailable."); });
    return () => controller.abort();
  }, [actor, metadataRequest]);
  const select = useCallback((id: string) => {
    setSelected(id);
    const url = new URL(window.location.href); url.searchParams.set("framework", id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  useEffect(() => {
    const back = () => {
      const id = new URLSearchParams(window.location.search).get("framework");
      if (metadata?.some((framework) => framework.id === id)) setSelected(id!);
    };
    window.addEventListener("popstate", back); return () => window.removeEventListener("popstate", back);
  }, [metadata]);
  return <main className={`app-shell ${styles.shell}`}>
    <OverviewMenu username={userName} userId={actor} />
    <header className="overview-header"><p className="eyebrow">{userName}</p><h1>Progress</h1></header>
    {metadataError ? <p className="progress-notice" role="alert">{metadataError} <button type="button" onClick={() => setMetadataRequest((value) => value + 1)}>Retry configuration</button></p> : null}
    {!metadata && !metadataError ? <p role="status">Loading Frameworks…</p> : null}
    {metadata?.length === 0 ? <p className="progress-notice">No Frameworks are available yet.</p> : null}
    {metadata?.length ? <>
      <label className="progress-framework-selector">Framework<select aria-label="Framework" value={selected} onChange={(event) => select(event.target.value)}>
        {metadata.map((framework) => <option key={framework.id} value={framework.id}>{framework.title}</option>)}
      </select></label>
      {summary.error ? <p className="progress-notice" role="alert">{summary.error} <button type="button" onClick={summary.refresh}>Refresh progress</button></p> : null}
      {summary.loading ? <p className="progress-refresh" role="status">{summary.data ? "Refreshing progress…" : "Loading progress…"}</p> : null}
      {summary.data ? <section aria-label={summary.data.title} aria-busy={summary.loading}>
        <FrameworkProgressTable key={JSON.stringify([actor, selected])} actor={actor} framework={summary.data} unavailable={!!summary.error} />
      </section> : null}
    </> : null}
  </main>;
}
