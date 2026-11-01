import { readProgressNavigationPages, readScopedProgress, defaultProgressPerspective, progressChoices, type ProgressNavigation } from "@/lib/groupExperiences/progressClient";
import type { GroupProgressSummary } from "@/lib/groupExperiences/progressReads";
import type { ProgressPerspective } from "@/lib/groupExperiences/progressContext";
import { GroupRequestError } from "@/components/group-experiences/groupClient";
export type GroupProgressState = { nav?: ProgressNavigation; perspective?: ProgressPerspective; data?: GroupProgressSummary; loading: boolean; verified: boolean; error?: string; denied?: boolean };
export function createGroupProgressResource(actor: string, experienceId: string, options: {
  navigation?: typeof readProgressNavigationPages; summary?: typeof readScopedProgress; now?: () => number; perspective?: ProgressPerspective;
} = {}) {
  const navRead = options.navigation ?? readProgressNavigationPages, summaryRead = options.summary ?? readScopedProgress, now = options.now ?? Date.now;
  let state: GroupProgressState = { loading: false, verified: false }, disposed = false, generation = 0, pending: Promise<void> | undefined;
  let framework = "", desired: ProgressPerspective | undefined = options.perspective, abort = new AbortController(), expiry: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const update = (value: GroupProgressState) => { if (!disposed) { state = value; listeners.forEach(listener => listener()); } };
  const invalidate = () => { if (expiry) clearTimeout(expiry); update({ ...state, data: undefined, verified: false }); };
  async function load(retry = false): Promise<void> {
    if (disposed || !framework) return;
    if (pending) return pending;
    const token = ++generation, signal = abort.signal, requested = framework;
    update({ ...state, loading: true, error: undefined });
    pending = (async () => {
      let hasNavigation = false;
      try {
        const nav = await navRead(actor, experienceId, signal); hasNavigation = true;
        const allowed = progressChoices(actor, nav);
        const target = desired && allowed.some(choice => JSON.stringify(choice.perspective) === JSON.stringify(desired)) ? desired : defaultProgressPerspective(actor, nav);
        // A structural change may revoke a subject while the viewer remains a
        // member. Purge before requesting new values, never relabel old data.
        if (state.nav && (state.nav.structureRevision !== nav.structureRevision || state.nav.accessEpoch !== nav.accessEpoch || state.nav.adoptionRevision !== nav.adoptionRevision)) invalidate();
        const data = await summaryRead(actor, experienceId, requested, target, signal);
        if (data.structureRevision !== nav.structureRevision || data.adoptionRevision !== nav.adoptionRevision || data.accessEpoch !== nav.accessEpoch) throw new Error("Group authority changed. Refresh Progress.");
        if (disposed || token !== generation || signal.aborted) return;
        const remaining = Date.parse(data.leaseExpiresAt) - now();
        if (remaining <= 0) throw new Error("Group access verification expired. Retry.");
        desired = target; if (expiry) clearTimeout(expiry);
        expiry = setTimeout(invalidate, remaining);
        update({ nav, perspective: target, data, verified: true, loading: false });
      } catch (error) {
        if (disposed || token !== generation || signal.aborted) return;
        invalidate();
        if (hasNavigation && error instanceof GroupRequestError && error.status === 403 && !retry) {
          desired = undefined; queueMicrotask(() => { if (!disposed) void load(true); });
        }
        update({ ...state, loading: false, denied: error instanceof GroupRequestError && (!hasNavigation && [401, 403].includes(error.status) || error.status === 401 || error.code === "GROUP_SESSION_CONFLICT"),
          error: error instanceof Error ? error.message : "Group Progress is unavailable." });
      } finally { if (token === generation) pending = undefined; }
    })();
    return pending;
  }
  function change(frameworkId: string, perspective?: ProgressPerspective) {
    if (framework === frameworkId && (!perspective || JSON.stringify(perspective) === JSON.stringify(desired))) return load();
    framework = frameworkId; if (perspective) desired = perspective;
    generation++; abort.abort(); abort = new AbortController(); pending = undefined;
    // Retain the still-live roster lease for rapid selection; discard only the
    // prior subject payload. Its original expiry still hides all foreign data.
    update({ ...state, data: undefined, perspective: desired, loading: true }); return load();
  }
  return { snapshot: () => state, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load, change, invalidate, dispose() { disposed = true; generation++; abort.abort(); if (expiry) clearTimeout(expiry); listeners.clear(); } };
}
