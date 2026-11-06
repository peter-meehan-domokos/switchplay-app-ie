import type { GroupBootstrap, GroupPerspectivePage, GroupAggregates } from "@/lib/groupExperiences/presentationReads";
import type { PerspectiveSelection } from "@/lib/groupExperiences/model";
import type { PersonalLearningChange } from "@/lib/cards/learning";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import { personalWork } from "@/lib/cards/personalWork";
import { groupFetch, GroupRequestError } from "./groupClient";

export const GROUP_AUTHORITY_MS = 5_000;
export type LoadedGroup = { bootstrap: GroupBootstrap; followers: GroupPerspectivePage["followers"]; aggregates: GroupAggregates["cards"] };
export type GroupResourceState = { data?: LoadedGroup; verified: boolean; loading: boolean; error?: string; mutationError?: string };
type Reader = typeof groupFetch;
type Authority = { viewerUserId: string; experienceId: string; structureRevision: number; accessEpoch: number; adoptionRevision: number };
function withChange(data: LoadedGroup, actor: string, cardId: string, owner: "group" | "personal", change: PersonalLearningChange): LoadedGroup {
  const apply = (rows: GroupBootstrap["group"]) => rows.map(row => row.cardTemplateId !== cardId ? row : { ...row,
    ...(change.kind === "completion" ? { items: row.items.map(item => item.stepId === change.stepId ? { ...item, completionStatus: change.completionStatus } : item) }
      : { signalReadings: row.signalReadings.map(signal => signal.stepId === change.stepId ? { ...signal, reading: change.reading } : signal) }) });
  return { ...data, bootstrap: { ...data.bootstrap, group: owner === "group" ? apply(data.bootstrap.group) : data.bootstrap.group,
    own: owner === "personal" && data.bootstrap.own ? apply(data.bootstrap.own) : data.bootstrap.own },
    followers: owner === "personal" ? data.followers.map(row => row.userId === actor ? { ...row, learning: apply(row.learning) } : row) : data.followers };
}

export function createGroupResource(actor: string, experienceId: string, options: { read?: Reader; now?: () => number;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>; cancel?: (timer: ReturnType<typeof setTimeout>) => void } = {}) {
  const read = options.read ?? groupFetch, now = options.now ?? Date.now, schedule = options.schedule ?? setTimeout, cancel = options.cancel ?? clearTimeout;
  const base = `/api/group-experiences/${encodeURIComponent(experienceId)}`;
  let state: GroupResourceState = { verified: false, loading: false }, disposed = false, generation = 0, workRevision = 0, writes = 0;
  let requiredStructureRevision = 0, verificationOrder = 0, lastGrantedOrder = 0;
  let pending: Promise<void> | undefined, renewal: Promise<boolean> | undefined, expiry: ReturnType<typeof setTimeout> | undefined, expiresAt = 0;
  const abort = new AbortController(), listeners = new Set<() => void>(), lanes = new Map<string, Promise<void>>();
  const confirmed = new Map<string, PersonalLearningChange>(), fieldTokens = new Map<string, symbol>();
  let navigationTail = Promise.resolve(), navigationGeneration = 0;
  function update(value: GroupResourceState) { if (!disposed) { state = value; for (const listener of listeners) listener(); } }
  function invalidate() { expiresAt = 0; if (expiry) cancel(expiry); update({ ...state, verified: false }); }
  function grant(checkedAt: number, order: number) {
    lastGrantedOrder = Math.max(lastGrantedOrder, order);
    expiresAt = Math.max(expiresAt, checkedAt + GROUP_AUTHORITY_MS);
    if (expiry) cancel(expiry);
    expiry = schedule(() => { if (now() >= expiresAt) invalidate(); }, Math.max(0, expiresAt - now()));
  }
  function verificationFailed(cause: unknown, order: number) {
    const hard = cause instanceof GroupRequestError && ([401, 403].includes(cause.status)
      || ["GROUP_SESSION_CONFLICT", "GROUP_CONTEXT_CONFLICT", "GROUP_SCOPE_CONFLICT"].includes(cause.code));
    // A transient failure says nothing about a later successful read. Keep only
    // its existing request-start lease; actual denial/scope changes still win.
    if (!hard && order < lastGrantedOrder && state.verified && now() < expiresAt) return;
    // Account changes and confirmed revocation also clear owner-specific data.
    const clearData = cause instanceof GroupRequestError && ([401, 403].includes(cause.status)
      || ["GROUP_SESSION_CONFLICT", "GROUP_CONTEXT_CONFLICT"].includes(cause.code));
    invalidate(); update({ ...state, data: clearData ? undefined : state.data,
      loading: false, error: cause instanceof Error ? cause.message : "Unable to verify experience." });
  }
  function checkAuthority(reference: Authority, value: Authority) {
    if (reference.viewerUserId !== actor || value.viewerUserId !== actor || reference.experienceId !== experienceId || value.experienceId !== experienceId) {
      throw new GroupRequestError("GROUP_CONTEXT_CONFLICT", 409);
    }
    if (value.structureRevision !== reference.structureRevision || value.accessEpoch !== reference.accessEpoch
      || value.adoptionRevision !== reference.adoptionRevision) throw new GroupRequestError("GROUP_SCOPE_CONFLICT", 409);
  }
  async function renewAuthority() {
    if (renewal) return renewal;
    if (disposed || !state.data) return false;
    const snapshot = state.data.bootstrap;
    const isCurrent = () => state.data?.bootstrap.structureRevision === snapshot.structureRevision
      && state.data.bootstrap.accessEpoch === snapshot.accessEpoch && state.data.bootstrap.adoptionRevision === snapshot.adoptionRevision;
    const checkedAt = now(), order = ++verificationOrder;
    renewal = (async () => {
      try {
        const reference = await read<Authority>(actor, `${base}/authority`, abort.signal);
        if (disposed || !state.data) return false;
        if (!isCurrent()) return state.verified;
        const current = state.data.bootstrap;
        if (current.structureRevision !== reference.structureRevision || current.accessEpoch !== reference.accessEpoch
          || current.adoptionRevision !== reference.adoptionRevision) {
          update({ ...state, data: { ...state.data, followers: state.data.followers.filter(row => row.userId === actor) }, verified: false });
        }
        checkAuthority(current, reference);
        if (reference.structureRevision < requiredStructureRevision || current.structureRevision < requiredStructureRevision) {
          throw new GroupRequestError("GROUP_SCOPE_CONFLICT", 409);
        }
        if (now() - checkedAt >= GROUP_AUTHORITY_MS) throw new Error("Access verification expired. Retry.");
        // Renew only matching current authority, never content or a longer lease.
        // Content pagination can take longer than the lease on hosted services.
        grant(checkedAt, order); update({ ...state, verified: true });
        return true;
      } catch (cause) {
        if (!disposed && isCurrent()) verificationFailed(cause, order);
        return state.verified;
      } finally { renewal = undefined; }
    })();
    return renewal;
  }
  async function load() {
    if (pending) return pending;
    if (disposed) return;
    const token = ++generation, revision = workRevision;
    let order = ++verificationOrder;
    update({ ...state, loading: true, error: undefined });
    pending = (async () => {
      try {
        const reference = await read<Authority>(actor, `${base}/authority`, abort.signal);
        if (state.data && (state.data.bootstrap.structureRevision !== reference.structureRevision || state.data.bootstrap.accessEpoch !== reference.accessEpoch)) {
          // A viewer epoch does not change when somebody ELSE leaves. Structure
          // revocation must purge previously fetched peers before accepting pages.
          update({ ...state, data: state.data ? { ...state.data, followers: state.data.followers.filter(row => row.userId === actor) } : undefined,
            loading: true, verified: false });
        }
        let bootstrap: GroupBootstrap | undefined;
        const followers = new Map<string, GroupPerspectivePage["followers"][number]>(), aggregates: GroupAggregates["cards"] = [];
        let offset: number | null = 0;
        while (offset !== null) {
          const [page, firstPeers, aggregate]: [GroupBootstrap, GroupPerspectivePage, GroupAggregates] = await Promise.all([
            read<GroupBootstrap>(actor, `${base}/presentation?cardOffset=${offset}`, abort.signal),
            read<GroupPerspectivePage>(actor, `${base}/perspectives?cardOffset=${offset}`, abort.signal),
            read<GroupAggregates>(actor, `${base}/aggregates?cardOffset=${offset}`, abort.signal),
          ]);
          checkAuthority(reference, page);
          if (!bootstrap) bootstrap = page;
          else bootstrap = { ...bootstrap, deck: { ...bootstrap.deck, cards: [...bootstrap.deck.cards, ...page.deck.cards] },
            group: [...bootstrap.group, ...page.group], own: bootstrap.own && page.own ? [...bootstrap.own, ...page.own] : null,
            ownDates: bootstrap.ownDates && page.ownDates ? [...bootstrap.ownDates, ...page.ownDates] : null };
          let cursor: string | null = null;
          do {
            const batch: GroupPerspectivePage = cursor === null ? firstPeers
              : await read(actor, `${base}/perspectives?cardOffset=${offset}&after=${encodeURIComponent(cursor)}`, abort.signal);
            checkAuthority(reference, batch);
            for (const row of batch.followers) {
              const previous = followers.get(row.userId);
              followers.set(row.userId, { ...row, learning: [...(previous?.learning ?? []), ...row.learning] });
            }
            cursor = batch.nextCursor;
          } while (cursor);
          checkAuthority(reference, aggregate); aggregates.push(...aggregate.cards);
          offset = page.nextCardOffset;
        }
        order = ++verificationOrder;
        const checkedAt = now(), latest = await read<Authority>(actor, `${base}/authority`, abort.signal); checkAuthority(reference, latest);
        // Lease starts before the final authority read, not when a delayed read
        // eventually resolves. Received bytes cannot be recalled; stale peer
        // display is hidden on expiry, focus loss or verification failure.
        if (now() - checkedAt >= GROUP_AUTHORITY_MS) throw new Error("Access verification expired. Retry.");
        if (reference.structureRevision < requiredStructureRevision) throw new GroupRequestError("GROUP_SCOPE_CONFLICT", 409);
        if (disposed || token !== generation || writes || workRevision !== revision) return;
        grant(checkedAt, order);
        update({ data: { bootstrap: bootstrap!, followers: [...followers.values()], aggregates }, verified: true, loading: false, mutationError: state.mutationError });
      } catch (cause) {
        if (!disposed && token === generation) {
          verificationFailed(cause, order);
        }
      } finally {
        pending = undefined;
        if (!disposed && state.loading) update({ ...state, loading: false });
      }
    })();
    return pending;
  }
  async function save(cardId: string, owner: "group" | "personal", version: number, accessEpoch: number, change: PersonalLearningChange) {
    if (disposed) return;
    const key = JSON.stringify([owner, cardId, change.kind, change.stepId]);
    const previous = lanes.get(key) ?? Promise.resolve();
    const token = Symbol(); fieldTokens.set(key, token);
    workRevision++; writes++;
    const data = state.data;
    if (data) {
      const row = (owner === "group" ? data.bootstrap.group : data.bootstrap.own)?.find(row => row.cardTemplateId === cardId);
      if (row && !confirmed.has(key)) confirmed.set(key, change.kind === "completion" ? { ...change, completionStatus: row.items.find(item => item.stepId === change.stepId)!.completionStatus }
        : { ...change, reading: row.signalReadings.find(signal => signal.stepId === change.stepId)!.reading });
      update({ ...state, mutationError: undefined, data: withChange(data, actor, cardId, owner, change) });
    }
    const operation = previous.catch(() => {}).then(async () => {
      const run = async () => {
        // Disposing the view cancels reads, not already accepted scalar saves.
        // Keep queued writes bound to their original actor/Card/version/epoch;
        // current server authority still decides whether they may commit.
        await read(actor, `${base}/cards/${encodeURIComponent(cardId)}/${owner === "group" ? "group" : "personal"}-learning`, undefined,
          "PATCH", { version, accessEpoch, change });
        confirmed.set(key, change);
        if (owner === "personal") workingCardStore.invalidateLearning(actor, cardId);
      };
      try {
        // Same authoritative personal row across personal Decks and groups.
        // This barrier is owner/Card scoped; group state has its own lane.
        if (owner === "personal") await personalWork.run({ userId: actor, cardIds: [cardId] }, key, run); else await run();
      } catch (cause) {
        const rollback = confirmed.get(key);
        update({ ...state, data: state.data && rollback && fieldTokens.get(key) === token ? withChange(state.data, actor, cardId, owner, rollback) : state.data,
          mutationError: cause instanceof Error ? cause.message : "Change could not be saved." });
      }
    }).finally(async () => {
      writes--; if (lanes.get(key) === operation) { lanes.delete(key); confirmed.delete(key); fieldTokens.delete(key); }
      if (!writes && !disposed) { if (pending) await pending; await load(); }
    });
    lanes.set(key, operation); return operation;
  }
  return { snapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load, renewAuthority, invalidate, save,
    async revalidate(minimumStructureRevision: number) {
      if (!Number.isSafeInteger(minimumStructureRevision) || minimumStructureRevision < 0) return false;
      requiredStructureRevision = Math.max(requiredStructureRevision, minimumStructureRevision);
      // A settings/adoption acknowledgement can arrive while a poll begun
      // before that commit still owns the coalesced load. It cannot certify
      // the acknowledged revision; finish it, then make one fresh read.
      const wasPending = Boolean(pending);
      const current = () => state.verified && (state.data?.bootstrap.structureRevision ?? -1) >= minimumStructureRevision;
      invalidate(); await load();
      if (wasPending && !current() && !disposed) { invalidate(); await load(); }
      return current();
    },
    async navigate(selection: PerspectiveSelection, activeCardId?: string) {
      const current = state.data?.bootstrap; if (!current || !state.verified) return;
      const token = ++navigationGeneration;
      const body = { accessEpoch: current.accessEpoch, expectedStructureRevision: current.structureRevision, selection, ...(activeCardId ? { activeCardId } : {}) };
      // Visual switching is immediate. Persist in order so a slow earlier click
      // cannot become the remembered perspective after a later selection.
      navigationTail = navigationTail.catch(() => {}).then(async () => {
        if (!disposed && token === navigationGeneration) await read(actor, `${base}/navigation`, abort.signal, "PATCH", body);
      });
      await navigationTail;
    },
    dispose() { disposed = true; generation++; abort.abort(); if (expiry) cancel(expiry); listeners.clear(); state = { loading: false, verified: false }; },
  };
}
