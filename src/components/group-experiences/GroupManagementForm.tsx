"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import LibraryDialog from "@/components/library/LibraryDialog";
import type { LibraryPreviewManifest } from "@/lib/cards/libraryProjection";
import { COMPACT_GROUP_NAME_LENGTH } from "@/lib/groupExperiences/namePresentation";
import { clientId } from "@/lib/clientId";
import { groupFetch, GroupRequestError } from "./groupClient";
import { ensureUserDirectory, useUserDirectory } from "./userDirectory";
import { loadGroupSettings, type GroupSettings, type ManagementResult } from "./groupManagementClient";
import { Identity } from "./PerspectivePicker";
import "./group-management.css";

function SelectedMembersArea({ children, animate, reduced }: { children: ReactNode; animate: boolean; reduced: boolean }) {
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      // The native dialog can initially be closed. Do not collapse the area
      // using that zero measurement before its first visible layout.
      if (entry.contentRect.height > 0) setHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // Animate real flow height, not a scale/FLIP transform: the users list and
  // footer move together while every identity Card retains its exact geometry.
  return <motion.div className="group-management-selected" aria-label="Selected identities" initial={false}
    animate={{ height: height ?? "auto" }} transition={{ duration: animate && !reduced ? .18 : 0, ease: "easeOut" }} style={{ overflow: "hidden" }}>
    <div ref={content}>{children}</div>
  </motion.div>;
}

export default function GroupManagementForm({ actor, manifest, experienceId, onCancel, onSaved }: {
  actor: string; manifest?: LibraryPreviewManifest; experienceId?: string; onCancel(): void; onSaved(result: ManagementResult): void | Promise<void>;
}) {
  const editing = Boolean(experienceId), directory = useUserDirectory(actor);
  const [values, setValues] = useState<GroupSettings | null>(() => editing ? null : { name: "", adminIds: [actor], followerIds: [], allowFollowerInspection: false, expectedStructureRevision: 0 });
  const [error, setError] = useState(""), [loading, setLoading] = useState(editing), [saving, setSaving] = useState(false), [uncertain, setUncertain] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [animateMembers, setAnimateMembers] = useState(false);
  const reduced = Boolean(useReducedMotion());
  const running = useRef(false), live = useRef(true);
  const attempt = useRef<{ method: string; url: string; body: unknown } | null>(null);
  const committed = useRef<ManagementResult | null>(null);
  useEffect(() => {
    live.current = true; const abort = new AbortController();
    void ensureUserDirectory(actor).catch(() => {});
    if (experienceId) void loadGroupSettings(actor, experienceId, abort.signal).then(value => {
      if (!abort.signal.aborted) { setValues(value); setLoading(false); setError(""); }
    }).catch(cause => { if (!abort.signal.aborted) { setLoading(false); setError(cause instanceof Error ? cause.message : "Unable to load Group."); } });
    return () => { live.current = false; abort.abort(); };
  }, [actor, experienceId, loadAttempt]);
  const locked = saving || uncertain;
  const cancel = () => { if (!running.current && !uncertain) onCancel(); };
  const toggle = (field: "adminIds" | "followerIds", id: string) => {
    setAnimateMembers(true);
    setValues(previous => previous ? { ...previous,
      [field]: previous[field].includes(id) ? previous[field].filter(value => value !== id) : [...previous[field], id] } : previous);
  };
  async function submit() {
    if (!values || running.current) return;
    running.current = true; setSaving(true); setError("");
    const hadAttempt = attempt.current !== null;
    let submitted = false;
    try {
      if (!attempt.current) {
        const { expectedStructureRevision, ...fields } = values;
        attempt.current = { method: editing ? "PATCH" : "POST", url: editing ? `/api/group-experiences/${encodeURIComponent(experienceId!)}/management` : "/api/group-experiences",
          body: { ...fields, operationId: clientId(), ...(editing ? { expectedStructureRevision } : { manifest }) } };
      }
      const request = attempt.current;
      // Even a confirmed commit may be followed by a failed refresh or another
      // Admin revoking access. Exact replay rechecks the current actor/access;
      // never reuse an old success object to bypass that boundary on Retry.
      submitted = true;
      const result = await groupFetch<ManagementResult>(actor, request.url, undefined, request.method, request.body);
      committed.current = result;
      if (live.current) await onSaved(result);
    } catch (cause) {
      if (!live.current) return;
      if (!submitted && !hadAttempt && !committed.current) {
        // Preparation failed before transport was invoked: nothing can have
        // committed. Keep the draft editable, unlike an uncertain sent request.
        attempt.current = null; setUncertain(false);
        setError("Unable to prepare this request. Your selections are kept. Please try again.");
      } else if (!committed.current && cause instanceof GroupRequestError && cause.status < 500) {
        attempt.current = null; setUncertain(false);
        const message = cause.status === 401 || cause.code === "GROUP_SESSION_CONFLICT" ? "Your sign-in changed. Sign in again before retrying."
          : cause.status === 409 ? "Group settings or the publication changed. Your selections are kept. Reload the current Group or Library preview before submitting again."
          : cause.status === 403 ? "You no longer have permission to save these settings."
          : "Unable to save. Check the Group name, registered users and at least one Admin.";
        setError(message);
      } else {
        // A timeout/500 is not proof of rollback. Freeze this exact command;
        // Retry acknowledges its receipt even after successful self-removal.
        setUncertain(true); setError(committed.current ? "Saved, but the view could not refresh. Retry to finish returning." : "Save has not been confirmed. Retry to confirm the same request before leaving.");
      }
    } finally { running.current = false; if (live.current) setSaving(false); }
  }
  const users = directory.users ?? [];
  return <LibraryDialog title={editing ? "Group settings" : "Create Group"} className="group-management-dialog" isolateInteractions onCancel={cancel}>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      {loading ? <p role="status">Loading Group settings…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!values && !loading ? <button type="button" onClick={() => { setLoading(true); setLoadAttempt(value => value + 1); }}>Retry loading settings</button> : null}
      {values ? <fieldset disabled={locked} className="group-management-fields">
        <label>Group name<input name="groupName" aria-describedby={Array.from(values.name).length > COMPACT_GROUP_NAME_LENGTH ? "group-name-length-warning" : undefined} value={values.name} maxLength={120} required onChange={event => setValues({ ...values, name: event.target.value })} /></label>
        {Array.from(values.name).length > COMPACT_GROUP_NAME_LENGTH ? <p id="group-name-length-warning" className="creator-modal-counter creator-modal-counter--warning" role="status">Longer names may be shortened in some parts of the app.</p> : null}
        <label className="group-management-policy"><input type="checkbox" role="switch" checked={values.allowFollowerInspection}
          onChange={event => setValues({ ...values, allowFollowerInspection: event.target.checked })} />Can followers view each other&apos;s Cards?</label>
        <SelectedMembersArea animate={animateMembers} reduced={reduced}>
          {([{ title: "Admins", ids: values.adminIds }, { title: "Followers", ids: values.followerIds }] as const)
            .filter(section => section.title === "Admins" || section.ids.length > 0)
            .map(section => <section className="group-management-role-section" aria-label={section.title} key={section.title}>
              <h3>{section.title}</h3>
              <div className="group-management-selected-grid">
                {users.filter(user => section.ids.includes(user.id)).map(user => <motion.div className="group-management-identity" key={user.id}
                  initial={animateMembers && !reduced ? { opacity: 0 } : false} animate={{ opacity: 1 }}
                  transition={{ duration: reduced ? 0 : .06, delay: animateMembers && !reduced ? .15 : 0 }}>
                  <Identity choice={{ key: user.id, name: user.name, selection: { perspective: "self" } }} />
                </motion.div>)}
              </div>
            </section>)}
        </SelectedMembersArea>
        <section className="group-management-users" aria-label="Registered users">
          <div className="group-management-user-head"><span>Registered users</span><span>Admin</span><span>Follower</span></div>
          {directory.loading ? <p role="status">Loading registered users…</p> : null}
          {directory.error ? <p role="alert">{directory.error} <button type="button" onClick={() => void ensureUserDirectory(actor).catch(() => {})}>Retry users</button></p> : null}
          <div className="group-management-directory">{users.map(user => <div className="group-management-user" key={user.id}>
            <span>{user.name}</span>
            <input type="checkbox" aria-label={`${user.name}, Admin`} checked={values.adminIds.includes(user.id)} disabled={!editing && user.id === actor} onChange={() => toggle("adminIds", user.id)} />
            <input type="checkbox" aria-label={`${user.name}, Follower`} checked={values.followerIds.includes(user.id)} onChange={() => toggle("followerIds", user.id)} />
          </div>)}</div>
        </section>
      </fieldset> : null}
      <footer className="group-management-actions">
        <button type="button" disabled={locked} onClick={cancel}>Cancel</button>
        <button type="submit" disabled={saving || !values || !values.name.trim() || !values.adminIds.length || !directory.users || Boolean(directory.error)}>
          {saving ? "Saving…" : uncertain ? "Retry Save" : editing ? "Save" : "Create"}
        </button>
      </footer>
    </form>
  </LibraryDialog>;
}
