"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import OverviewMenu from "@/components/layout/OverviewMenu";
import { readProgressMetadata, type ProgressMetadata } from "@/lib/frameworks/progressClient";
import FrameworkProgressTable from "./FrameworkProgressTable";
import { useProgressSummary } from "./useProgressSummary";
import styles from "./progress.module.css";
import ItemCardDialog from "./ItemCardDialog";
import AreaDeckDialog from "./AreaDeckDialog";
import { readProgressPosition, rememberProgressPosition } from "@/lib/frameworks/progressNavigation";

export default function ProgressShell({ currentUserId, userName }: { currentUserId: string; userName: string }) {
  return <ProgressSession key={currentUserId} actor={currentUserId} userName={userName} />;
}
function ProgressSession({ actor, userName }: { actor: string; userName: string }) {
  const [metadata, setMetadata] = useState<ProgressMetadata>(), [metadataError, setMetadataError] = useState("");
  const [metadataRequest, setMetadataRequest] = useState(0), [selected, setSelected] = useState("");
  const [area, setArea] = useState<{ id: string; title: string } | null>(null);
  const [item, setItem] = useState<{ id: string; title: string } | null>(null);
  const restoredPosition = useRef(false);
  const summary = useProgressSummary(actor, selected);
  useEffect(() => {
    if (!summary.data || summary.loading || restoredPosition.current) return;
    restoredPosition.current = true;
    if (!new URLSearchParams(window.location.search).has("area")) return;
    let position: number | null = null;
    try { position = readProgressPosition(sessionStorage, actor, selected); } catch { /* Session storage is optional. */ }
    if (position !== null) {
      const frame = requestAnimationFrame(() => window.scrollTo({ top: position, behavior: "instant" }));
      return () => cancelAnimationFrame(frame);
    }
  }, [actor, selected, summary.data, summary.loading]);
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
    setSelected(id); setArea(null); setItem(null);
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
        <FrameworkProgressTable key={JSON.stringify([actor, selected])} actor={actor} framework={summary.data} unavailable={!!summary.error}
          onArea={(id, title) => { setItem(null); setArea({ id, title }); }} onItem={(id, title) => { setArea(null); setItem({ id, title }); }} />
      </section> : null}
    </> : null}
    {item ? <ItemCardDialog key={JSON.stringify([actor, selected, item.id])} actor={actor} frameworkId={selected}
      itemId={item.id} title={item.title} onClose={() => setItem(null)}
      onLeaving={() => { try { rememberProgressPosition(sessionStorage, actor, selected, window.scrollY); } catch { /* Session storage is optional. */ } }} /> : null}
    {area ? <AreaDeckDialog key={JSON.stringify([actor, selected, area.id])} actor={actor} frameworkId={selected}
      areaId={area.id} title={area.title} onClose={() => setArea(null)}
      onLeaving={() => { try { rememberProgressPosition(sessionStorage, actor, selected, window.scrollY); } catch { /* Navigation must work without storage. */ } }} /> : null}
  </main>;
}
