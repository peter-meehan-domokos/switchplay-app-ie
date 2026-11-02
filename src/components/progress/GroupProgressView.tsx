"use client";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OverviewMenu from "@/components/layout/OverviewMenu";
import { readProgressMetadata, type ProgressMetadata } from "@/lib/frameworks/progressClient";
import { progressChoices } from "@/lib/groupExperiences/progressClient";
import { recalledGroupHref, rememberProgressPosition, readProgressPosition } from "@/lib/frameworks/progressNavigation";
import { groupFetch, GroupRequestError } from "@/components/group-experiences/groupClient";
import { createGroupProgressResource, type GroupProgressState } from "./groupProgressResource";
import ComparisonPopover, { type Comparison } from "./ComparisonPopover";
import { groupProgressDisplay, type GroupMode } from "./groupProgressDisplay";
import FrameworkProgressTable from "./FrameworkProgressTable";
import AreaDeckDialog from "./AreaDeckDialog";
import ItemCardDialog from "./ItemCardDialog";
import styles from "./progress.module.css";
const empty: GroupProgressState = { loading: true, verified: false };
const emptySnapshot = () => empty, noSubscribe = () => () => {};
export default function GroupProgressView({ actor, userName, experienceId }: { actor: string; userName: string; experienceId: string }) {
  const router = useRouter(), entryQuery = useSearchParams();
  const [entryFramework] = useState(() => entryQuery.get("framework"));
  const [entryArea] = useState(() => entryQuery.get("area"));
  const [resource, setResource] = useState<ReturnType<typeof createGroupProgressResource>>();
  const state = useSyncExternalStore(resource?.subscribe ?? noSubscribe, resource?.snapshot ?? emptySnapshot, resource?.snapshot ?? emptySnapshot);
  const [mode, setMode] = useState<GroupMode>("groupScores"), [popover, setPopover] = useState<(Comparison & { context: string })>();
  const comparisonId = useId(), closeComparison = useCallback(() => setPopover(undefined), []);
  const [metadata, setMetadata] = useState<ProgressMetadata>(), [error, setError] = useState("");
  const [frameworkId, setFramework] = useState(""), [dialog, setDialog] = useState<{ kind: "area" | "item"; id: string; title: string }>();
  const [initialPerspective] = useState(() => {
    const userId = entryQuery.get("subjectUserId");
    return userId ? { kind: "player" as const, userId } : entryQuery.get("perspective") === "group" ? { kind: "group" as const } : undefined;
  });
  useEffect(() => {
    const controller = new AbortController();
    void readProgressMetadata(actor, controller.signal).then(value => {
      if (controller.signal.aborted) return; setMetadata(value);
      const requested = entryFramework;
      setFramework(value.find(row => row.id === requested)?.id ?? value[0]?.id ?? "");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Frameworks unavailable."); });
    return () => controller.abort();
  }, [actor, entryFramework]);
  useEffect(() => {
    const value = createGroupProgressResource(actor, experienceId, { perspective: initialPerspective });
    // The resource owns effect-lifetime transports, including Strict Mode trials.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResource(value);
    const refresh = () => { if (document.visibilityState !== "hidden") void value.load(); };
    const revalidate = () => { value.invalidate(); refresh(); };
    const timer = setInterval(refresh, 4000);
    window.addEventListener("focus", revalidate); window.addEventListener("pageshow", revalidate); document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("group-assessment-changed", refresh);
    return () => { clearInterval(timer); value.dispose(); window.removeEventListener("focus", revalidate); window.removeEventListener("pageshow", revalidate);
      document.removeEventListener("visibilitychange", revalidate); window.removeEventListener("group-assessment-changed", refresh); };
  }, [actor, experienceId, initialPerspective]);
  useEffect(() => {
    if (!resource || !frameworkId) return;
    void resource.change(frameworkId);
  }, [resource, frameworkId]);
  useEffect(() => { if (state.denied) router.replace("/decks"); }, [state.denied, router]);
  const namespace = JSON.stringify([actor, experienceId]);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !state.data) return;
    restored.current = true;
    if (entryArea !== null) {
      const position = readProgressPosition(sessionStorage, namespace, frameworkId);
      if (position !== null) requestAnimationFrame(() => window.scrollTo({ top: position, behavior: "instant" }));
    }
  }, [state.data, namespace, frameworkId, entryArea]);
  const leave = useCallback(() => { rememberProgressPosition(sessionStorage, namespace, frameworkId, window.scrollY); }, [namespace, frameworkId]);
  const choose = (value: string) => {
    const choice = state.nav && progressChoices(actor, state.nav).find(choice => choice.value === value);
    if (!choice) return; setDialog(undefined); setPopover(undefined); void resource?.change(frameworkId, choice.perspective);
  };
  const choices = state.nav && state.verified ? progressChoices(actor, state.nav) : [];
  const selected = state.perspective?.kind === "player" ? state.perspective.userId : "group", index = choices.findIndex(choice => choice.value === selected);
  const definition = metadata?.find(value => value.id === frameworkId);
  const shown = definition ? groupProgressDisplay(definition, state.verified ? state.data : undefined, mode) : undefined;
  const group = { experienceId, ...(state.perspective?.kind === "player" ? { subjectUserId: state.perspective.userId } : {}) };
  const comparisonContext = JSON.stringify([actor, experienceId, frameworkId, state.perspective, state.data?.structureRevision, state.data?.adoptionRevision, state.data?.accessEpoch, mode]);
  return <main className={`app-shell ${styles.shell} ${styles.groupShell}`} data-progress-experience={experienceId}>
    <OverviewMenu username={userName} userId={actor} />
    <header className="overview-header"><p className="eyebrow">{userName}</p><h1>Progress</h1></header>
    <button type="button" className="progress-back" onClick={async () => {
      try { await groupFetch(actor, `/api/group-experiences/${encodeURIComponent(experienceId)}`); router.push(recalledGroupHref(sessionStorage, actor, experienceId)); }
      catch (cause) { if (cause instanceof GroupRequestError && [401, 403].includes(cause.status)) router.replace("/decks"); else setError("Current Group access could not be checked. Retry Back."); }
    }}>Back to Group Deck</button>
    <div className="group-progress-controls">
      <label className="progress-framework-selector">Framework<select aria-label="Framework" value={frameworkId} onChange={event => {
        setDialog(undefined); setPopover(undefined); setFramework(event.target.value); const url = new URL(window.location.href); url.searchParams.set("framework", event.target.value); window.history.replaceState(null, "", url.pathname + url.search);
      }}>{metadata?.map(value => <option key={value.id} value={value.id}>{value.title}</option>)}</select></label>
      <div className="group-progress-perspective"><button type="button" aria-label="Previous Progress perspective" disabled={index <= 0} onClick={() => choose(choices[index - 1].value)}>‹</button>
        <select aria-label="Progress perspective" value={choices.length ? selected : ""} disabled={!choices.length} onChange={event => choose(event.target.value)}>
          {!choices.length ? <option value="">Verifying perspectives…</option> : choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </select><button type="button" aria-label="Next Progress perspective" disabled={index < 0 || index >= choices.length - 1} onClick={() => choose(choices[index + 1].value)}>›</button></div>
      <p className="group-progress-metadata">{state.nav?.name ?? ""}{state.nav ? ` · ${state.nav.activeFollowerCount} ${state.nav.activeFollowerCount === 1 ? "follower" : "followers"}` : ""}</p>
      <div className="group-progress-mode-slot">{state.perspective?.kind === "group" ? <div className="group-progress-modes" role="group" aria-label="Group metric display">
        <button type="button" aria-pressed={mode === "groupScores"} onClick={() => { setMode("groupScores"); setPopover(undefined); }}>Group scores</button>
        <button type="button" aria-pressed={mode === "playerAverages"} onClick={() => { setMode("playerAverages"); setPopover(undefined); }}>Player averages</button>
      </div> : null}</div>
    </div>
    {error || state.error ? <p className="progress-notice" role="alert">{error || state.error} <button type="button" onClick={() => { setError(""); void resource?.load(); }}>Refresh Progress</button></p> : null}
    <div className="group-progress-loading" role="status">{state.loading || !state.verified ? "Loading progress…" : ""}</div>
    {shown ? <section aria-label={shown.title} aria-busy={!state.verified || !state.data}>
      <FrameworkProgressTable key={JSON.stringify([actor, experienceId, frameworkId])} actor={actor} framework={shown} expansionScope={namespace} groupData={state.verified ? state.data : undefined} mode={mode} comparisonId={comparisonId}
        onCompare={value => setPopover(previous => previous?.key === value.key && previous.context === comparisonContext ? undefined : { ...value, context: comparisonContext })} unavailable={!state.verified || !state.data}
        assessmentContext={itemId => ({ viewerUserId: actor, source: { kind: "item", itemId }, canCreate: !!state.data?.canCreateAssessments, group: { ...group, frameworkId }, showOrigin: true })}
        onArea={(id, title) => { if (state.verified) setDialog({ kind: "area", id, title }); }} onItem={(id, title) => { if (state.verified) setDialog({ kind: "item", id, title }); }} />
    </section> : null}
    {popover && popover.context === comparisonContext && state.verified && state.data ? <ComparisonPopover value={popover} id={comparisonId} onClose={closeComparison} /> : null}
    {dialog && state.verified ? dialog.kind === "area" ? <AreaDeckDialog key={JSON.stringify([group, frameworkId, dialog.id])} actor={actor} group={group} frameworkId={frameworkId} areaId={dialog.id} title={dialog.title} onClose={() => setDialog(undefined)} onLeaving={leave} />
      : <ItemCardDialog key={JSON.stringify([group, frameworkId, dialog.id])} actor={actor} group={group} frameworkId={frameworkId} itemId={dialog.id} title={dialog.title} onClose={() => setDialog(undefined)} onLeaving={leave} /> : null}
  </main>;
}
