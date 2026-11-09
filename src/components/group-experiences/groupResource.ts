import type { PreparedGroup } from "@/lib/groupExperiences/preparation";
import { captureCardPreparation, acceptCardPreparation, hasInitialGroupPreparation } from "@/lib/cards/preparationClient";
import { PreparationAssembly, type PreparationPage } from "@/lib/groupExperiences/preparationPages";
import { assembledGroup } from "@/lib/groupExperiences/primaryPreparationAssembly";
import type { FollowerPreparationCard, FollowerPreparationHeader } from "@/lib/groupExperiences/followerPreparation";
import type { GroupBootstrap, GroupPerspectivePage, GroupAggregates } from "@/lib/groupExperiences/presentationReads";
import type { GroupPreparationSelection, PerspectiveSelection } from "@/lib/groupExperiences/model";
import type { PersonalLearningChange } from "@/lib/cards/learning";
import { aggregateLearning, metrics } from "@/lib/groupExperiences/readModels";
import { workingCardStore } from "@/lib/cards/workingCardStore";
import { personalWork } from "@/lib/cards/personalWork";
import { groupFetch, GroupRequestError } from "./groupClient";

export const GROUP_AUTHORITY_MS = 5_000;
export type LoadedGroup = { bootstrap: GroupBootstrap; followers: GroupPerspectivePage["followers"]; aggregates: GroupAggregates["cards"]; aggregatePending?: Record<string, { progress?: boolean; confidence?: boolean; progressSteps?: string[] }> };
export type GroupResourceState = { data?: LoadedGroup; verified: boolean; loading: boolean; error?: string; mutationError?: string;
  preparation?: { followers: "idle" | "loading" | "ready" | "paused" | "error"; error?: string } };
type TransportProgress = { assembly: PreparationAssembly; first?: PreparationPage; after?: string; itemStart?: string };
type FollowupTask = { scope: string; capture: ReturnType<typeof captureCardPreparation>; stamp: number; order: number; explicit: boolean; progress: TransportProgress; pending?: Promise<boolean> };
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
  workingCardStore.trackUser(actor);
  const base = `/api/group-experiences/${encodeURIComponent(experienceId)}`;
  let state: GroupResourceState = { verified: false, loading: false }, disposed = false, generation = 0, mutationStamp = 0, writes = 0;
  const session = workingCardStore.session(actor);
  const changes = new Map<string, { cardId: string; owner: "group" | "personal"; change: PersonalLearningChange; stamp: number; pending: boolean; version?: number }>();
  let readOrder = 0, preparationGeneration = 0;
  const acceptedLearning = new Map<string, number>(), acceptedAggregates = new Map<string, number>();
  const dirty = new Map<string, { progress?: number; confidence?: number; progressSteps?: Set<string> }>();
  let aggregateRead: Promise<void> | undefined, active = true;
  const live = () => !disposed && workingCardStore.session(actor) === session;
  let requiredStructureRevision = 0, requiredAccessEpoch = 0, requiredAdoptionRevision = 0, verificationOrder = 0, lastGrantedOrder = 0;
  let initialOpen: Promise<void> | undefined;
  const initialRequests = new Map<string, Promise<void>>();
  const perspectives = new Map<string, FollowupTask>();
  let followerTask: FollowupTask | undefined, followerReadyScope: string | undefined;
  let groupReadyScope: string | undefined;
  let backgroundAllowed: () => boolean = () => false;
  let pending: Promise<void> | undefined, renewal: Promise<boolean> | undefined, expiry: ReturnType<typeof setTimeout> | undefined, expiresAt = 0;
  const abort = new AbortController(), listeners = new Set<() => void>(), lanes = new Map<string, Promise<void>>();
  const confirmed = new Map<string, PersonalLearningChange>(), fieldTokens = new Map<string, symbol>();
  let navigationTail = Promise.resolve(), navigationGeneration = 0;
  function update(value: GroupResourceState) { if (live()) { state = value.data ? { ...value, data: { ...value.data, aggregatePending: Object.fromEntries([...dirty].map(([id, fields]) => {
    const unknown = !followerRows(value.data!, id);
    return [id, { progress: unknown && fields.progress !== undefined, confidence: unknown && fields.confidence !== undefined, progressSteps: unknown ? [...(fields.progressSteps ?? [])] : [] }];
  })) } } : value; for (const listener of listeners) listener(); } }
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
    if (cause instanceof GroupRequestError && (cause.status === 401 || cause.code === "GROUP_SESSION_CONFLICT")) {
      workingCardStore.clearUser(actor);
      // Disposal has already notified the view. Keep a terminal explanation
      // rather than leaving its now-empty scene on an endless loading message.
      state = { ...state, error: cause.message };
      return;
    }
    else if (clearData) workingCardStore.clearGroup(actor, experienceId);
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
  const scope = (data = state.data) => data ? JSON.stringify([preparationGeneration, data.bootstrap.viewerUserId, experienceId, data.bootstrap.accessEpoch,
    data.bootstrap.structureRevision, data.bootstrap.adoptionRevision, data.bootstrap.isAdmin, data.bootstrap.isFollower, data.bootstrap.canInspectFollowers,
    data.bootstrap.deck.version, data.bootstrap.deck.cards.map(card => [card.id, card.version])]) : "";
  const selectionKey = (selection: PerspectiveSelection) => selection.perspective === "follower" ? selection.subjectUserId : selection.perspective;
  function prepared(selection: PerspectiveSelection) {
    const data = state.data;
    if (!data || !hasInitialGroupPreparation(actor, data.bootstrap, selection)) return false;
    const rows = selection.perspective === "group" ? data.bootstrap.group : selection.perspective === "self" ? data.bootstrap.own
      : data.bootstrap.canInspectFollowers ? data.followers.find(row => row.userId === selection.subjectUserId)?.learning : undefined;
    if (!rows || data.bootstrap.deck.cards.some(card => !rows.some(row => row.cardTemplateId === card.id && row.version === card.version))) return false;
    if (selection.perspective !== "group") return true;
    const ready = data.bootstrap.deck.cards.every(card => data.aggregates.some(row => row.cardTemplateId === card.id)
      && (!dirty.has(card.id) || !!followerRows(data, card.id) || groupReadyScope === scope()));
    if (ready) groupReadyScope = scope();
    return ready;
  }
  function setPreparation(status: NonNullable<GroupResourceState["preparation"]>["followers"], error?: string) {
    update({ ...state, preparation: { followers: status, ...(error ? { error } : {}) } });
  }
  function acceptsTask(task: FollowupTask) { return live() && !!state.data && task.scope === scope(); }
  function canContinue(task: FollowupTask) { return active && live() && (task.explicit || !writes && backgroundAllowed()
    && (task !== followerTask || (state.data?.followers.length ?? Infinity) <= 20)); }
  function transportPage(task: TransportProgress, page: PreparationPage) {
    checkAuthority(page, page);
    if (task.first) checkAuthority(task.first, page); else task.first = page;
    const unfinished = page.parts.find(part => "text" in part && !part.last);
    if (unfinished && "offset" in unfinished && !unfinished.offset) task.itemStart = task.after;
    task.assembly.accept(page); task.after = page.next ?? undefined;
    if (!unfinished) task.itemStart = undefined;
  }
  async function readPrepared(selection: GroupPreparationSelection | undefined, opening: boolean, cardTemplateId?: string,
    progress: TransportProgress = { assembly: new PreparationAssembly() }, allowed = () => true): Promise<PreparedGroup | undefined> {
    if (!progress.first) {
      const params = selection ? `?${new URLSearchParams({ perspective: selection.perspective, ...(selection.perspective === "follower" ? { subjectUserId: selection.subjectUserId } : {}) })}` : "";
      const result = opening ? await read<PreparedGroup | PreparationPage>(actor, `${base}/preparation`, abort.signal, "POST", { ...(selection ? { selection } : {}), ...(cardTemplateId ? { cardTemplateId } : {}) })
        : await read<PreparedGroup | PreparationPage>(actor, `${base}/preparation${params}`, abort.signal);
      if (!("paged" in result)) return result;
      transportPage(progress, result);
    }
    while (progress.after) {
      if (!allowed()) return;
      const selected = progress.first!.selection!;
      const params = new URLSearchParams({ perspective: selected.perspective, ...(selected.perspective === "follower" ? { subjectUserId: selected.subjectUserId } : {}), after: progress.after });
      transportPage(progress, await read<PreparationPage>(actor, `${base}/preparation?${params}`, abort.signal));
    }
    return assembledGroup(progress.assembly, progress.first!);
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
        if (reference.viewerUserId === actor && reference.experienceId === experienceId) {
          requiredStructureRevision = Math.max(requiredStructureRevision, reference.structureRevision);
          requiredAccessEpoch = Math.max(requiredAccessEpoch, reference.accessEpoch);
          requiredAdoptionRevision = Math.max(requiredAdoptionRevision, reference.adoptionRevision);
        }
        if (current.structureRevision !== reference.structureRevision || current.accessEpoch !== reference.accessEpoch
          || current.adoptionRevision !== reference.adoptionRevision) {
          workingCardStore.clearGroup(actor, experienceId);
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
  function reconcileCollective(data: LoadedGroup): LoadedGroup {
    return { ...data, aggregates: data.aggregates.map(aggregate => {
      const row = data.bootstrap.group.find(card => card.cardTemplateId === aggregate.cardTemplateId);
      const followers = dirty.has(aggregate.cardTemplateId) ? followerRows(data, aggregate.cardTemplateId) : undefined;
      if (row && followers) return aggregateLearning([row], followers.map(value => [value])).cards[0];
      return !row ? aggregate : { ...aggregate, group: metrics([row]), steps: aggregate.steps.map(step => ({ ...step,
        group: metrics([{ items: row.items.filter(item => item.stepId === step.stepId), signalReadings: row.signalReadings.filter(item => item.stepId === step.stepId) }]) })) };
    }) };
  }
  function reconcileLearning(incoming: LoadedGroup, stamp: number, order: number): LoadedGroup {
    const prior = scope(incoming) === scope() ? state.data : undefined;
    if (!prior && !changes.size) return incoming;
    const rows = (owner: string, values: GroupBootstrap["group"], known?: GroupBootstrap["group"]) => values.length ? values.map(row => {
      const key = JSON.stringify([owner, row.cardTemplateId]);
      if ((acceptedLearning.get(key) ?? 0) > order) return known?.find(value => value.cardTemplateId === row.cardTemplateId) ?? row;
      acceptedLearning.set(key, order); return row;
    }) : known ?? values;
    let next: LoadedGroup = { ...incoming, aggregates: incoming.aggregates.length ? incoming.aggregates : prior?.aggregates ?? [], bootstrap: { ...incoming.bootstrap,
      group: rows("collective", incoming.bootstrap.group, prior?.bootstrap.group),
      own: incoming.bootstrap.own ? rows(`member:${actor}`, incoming.bootstrap.own, prior?.bootstrap.own ?? undefined) : prior?.bootstrap.own ?? null,
      ownDates: incoming.bootstrap.ownDates ?? prior?.bootstrap.ownDates ?? null },
      followers: incoming.followers.map(row => ({ ...row, learning: rows(`member:${row.userId}`, row.learning, prior?.followers.find(old => old.userId === row.userId)?.learning) })) };
    for (const entry of changes.values()) if (entry.pending || entry.stamp > stamp) {
      if (entry.owner !== "group" || next.bootstrap.group.some(row => row.cardTemplateId === entry.cardId && row.version === entry.version)) next = withChange(next, actor, entry.cardId, entry.owner, entry.change);
    }
    return next;
  }
  function hydrate(prepared: { bootstrap: GroupBootstrap; contributions: PreparedGroup["contributions"] }, capture: ReturnType<typeof captureCardPreparation>) {
    const b = prepared.bootstrap, selected = b.selection, own = selected.perspective === "self";
    acceptCardPreparation(capture, prepared.contributions, b.deck.cards.map(card => card.id),
      cardTemplateId => own ? { kind: "owner", viewerUserId: actor, cardTemplateId, experienceId }
        : { kind: "group", viewerUserId: actor, cardTemplateId, experienceId, accessEpoch: b.accessEpoch, adoptionRevision: b.adoptionRevision, structureRevision: b.structureRevision,
          ...(selected.perspective === "follower" ? { subjectUserId: selected.subjectUserId } : {}) },
      cardTemplateId => ({ viewerUserId: actor, cardTemplateId, adoptionRevision: b.adoptionRevision, structureRevision: b.structureRevision,
        view: { kind: "group", experienceId, mode: own ? "own" : selected.perspective === "group" ? "group" : "inspection", accessEpoch: b.accessEpoch,
          ...(selected.perspective === "follower" ? { subjectUserId: selected.subjectUserId } : {}) } }));
  }
  function taskFailure(task: FollowupTask, cause: unknown) {
    if (!acceptsTask(task)) return;
    if (cause instanceof GroupRequestError && cause.code === "GROUP_PREPARATION_CONTENT_CHANGED") {
      task.progress.after = task.progress.itemStart; task.progress.assembly.resetFragment();
      if (!task.progress.itemStart) task.progress.first = undefined;
    }
    if (cause instanceof GroupRequestError && ([401, 403].includes(cause.status) || ["GROUP_SCOPE_CONFLICT", "GROUP_SESSION_CONFLICT", "GROUP_CONTEXT_CONFLICT"].includes(cause.code))) {
      if (followerTask === task) followerTask = undefined;
      for (const [key, pending] of perspectives) if (pending === task) perspectives.delete(key);
      verificationFailed(cause, ++verificationOrder);
    }
    else setPreparation("error", cause instanceof Error ? cause.message : "Preparation failed. Retry.");
  }
  function newTask(explicit: boolean): FollowupTask { return { scope: scope(), capture: captureCardPreparation(actor), stamp: mutationStamp, order: ++readOrder, explicit, progress: { assembly: new PreparationAssembly() } }; }
  async function preparePerspective(selection: PerspectiveSelection, explicit = true): Promise<boolean> {
    if (!state.data || !live()) return false;
    if (prepared(selection)) return true;
    const key = selectionKey(selection);
    let task = perspectives.get(key);
    if (!task || task.scope !== scope()) { task = newTask(explicit); perspectives.set(key, task); }
    if (explicit) task.explicit = true;
    if (task.pending) return task.pending;
    if (state.preparation?.error) setPreparation(followersReady() ? "ready" : "idle");
    const current = task, order = current.order;
    current.pending = (async () => {
      try {
        const value = await readPrepared(selection, false, undefined, current.progress, () => canContinue(current));
        if (!value || !acceptsTask(current) || !state.data) return false;
        checkAuthority(state.data.bootstrap, value.bootstrap);
        const incoming = { bootstrap: value.bootstrap, followers: value.followers, aggregates: value.aggregates };
        if (scope(incoming) !== current.scope) throw new GroupRequestError("GROUP_SCOPE_CONFLICT", 409);
        if (selectionKey(value.bootstrap.selection) !== key) throw new GroupRequestError("GROUP_CONTEXT_CONFLICT", 409);
        const data = reconcileLearning(incoming, current.stamp, order), old = state.data;
        data.bootstrap = { ...data.bootstrap, selection: old.bootstrap.selection, activeCardId: old.bootstrap.activeCardId };
        data.aggregates = value.aggregates.length ? mergeAggregates(value.aggregates, current.stamp, order) : old.aggregates;
        hydrate(value, current.capture);
        update({ ...state, data: reconcileCollective(data) });
        if (selection.perspective === "group" && !prepared(selection) && dirty.size) {
          await Promise.all([...lanes.values()]);
          await personalWork.wait({ userId: actor, cardIds: data.bootstrap.deck.cards.map(card => card.id) }, abort.signal);
          if (acceptsTask(current)) await refreshAggregates();
        }
        return acceptsTask(current) && prepared(selection);
      } catch (cause) { taskFailure(current, cause); return false; }
      finally { current.pending = undefined; if (prepared(selection)) perspectives.delete(key); }
    })();
    return current.pending;
  }
  function followersReady() {
    return !!state.data?.bootstrap.canInspectFollowers && followerReadyScope === scope()
      && state.data.followers.every(row => prepared(row.userId === actor ? { perspective: "self" } : { perspective: "follower", subjectUserId: row.userId }));
  }
  async function prepareFollowers(explicit = true): Promise<boolean> {
    if (!live() || !state.data?.bootstrap.canInspectFollowers) return false;
    if (followersReady()) return true;
    if (!followerTask || followerTask.scope !== scope()) followerTask = newTask(explicit);
    const task = followerTask;
    if (explicit) task.explicit = true;
    if (task.pending) return task.pending;
    const order = task.order;
    setPreparation("loading");
    task.pending = (async () => {
      try {
        if (state.data!.bootstrap.isFollower && !prepared({ perspective: "self" }) && !await preparePerspective({ perspective: "self" }, explicit)) return false;
        while (!task.progress.first || task.progress.after) {
          if (!canContinue(task)) { setPreparation("paused"); return false; }
          const params = task.progress.after ? `?${new URLSearchParams({ after: task.progress.after })}` : "";
          const page = await read<PreparationPage>(actor, `${base}/preparation/followers${params}`, abort.signal);
          if (!acceptsTask(task) || !state.data) return false;
          checkAuthority(state.data.bootstrap, page); transportPage(task.progress, page);
        }
        const header = task.progress.assembly.values.get(0) as FollowerPreparationHeader | undefined;
        const data = state.data!;
        if (!header || JSON.stringify(header.cards) !== JSON.stringify(data.bootstrap.deck.cards.map(card => ({ cardTemplateId: card.id, version: card.version })))
          || JSON.stringify(header.followers.map(row => row.userId)) !== JSON.stringify(data.followers.map(row => row.userId))) throw new GroupRequestError("GROUP_SCOPE_CONFLICT", 409);
        const expected = header.followers.filter(row => row.userId !== actor).flatMap(row => header.cards.map(card => ({ user: row.userId, card: card.cardTemplateId })));
        const followers = data.followers.map(row => ({ ...row, learning: row.userId === actor ? data.bootstrap.own ?? [] : [] }));
        for (const [i, target] of expected.entries()) {
          const row = task.progress.assembly.values.get(i + 1) as FollowerPreparationCard | undefined;
          if (!row || row.subjectUserId !== target.user || row.cardTemplateId !== target.card || row.learning.cardTemplateId !== target.card) throw Error("Follower preparation is incomplete. Retry.");
          const view: PerspectiveSelection = { perspective: "follower", subjectUserId: target.user };
          hydrate({ bootstrap: { ...data.bootstrap, selection: view, deck: { ...data.bootstrap.deck, cards: data.bootstrap.deck.cards.filter(card => card.id === target.card) } },
            contributions: { media: { [target.card]: row.media }, reflections: { [target.card]: row.reflection } } }, task.capture);
          followers.find(member => member.userId === target.user)!.learning.push(row.learning);
        }
        if (!acceptsTask(task)) return false;
        update({ ...state, data: reconcileCollective(reconcileLearning({ ...state.data!, followers }, task.stamp, order)) });
        followerReadyScope = task.scope; setPreparation("ready"); followerTask = undefined;
        return followersReady();
      } catch (cause) { taskFailure(task, cause); return false; }
      finally { task.pending = undefined; }
    })();
    return task.pending;
  }
  function followerRows(data: LoadedGroup, cardId: string) {
    const selected = data.bootstrap.group.find(row => row.cardTemplateId === cardId), total = data.aggregates.find(row => row.cardTemplateId === cardId)?.followers.activeTotal;
    const members = new Map(data.followers.map(member => [member.userId, member.learning]));
    if (data.bootstrap.isFollower && data.bootstrap.own) members.set(actor, data.bootstrap.own);
    if (!selected || total === undefined || members.size !== total) return undefined;
    const rows = [...members.values()].map(cards => cards.find(row => row.cardTemplateId === cardId));
    if (rows.some(row => !row || row.version !== selected.version || row.items.length !== selected.items.length || row.signalReadings.length !== selected.signalReadings.length
      || row.items.some((item, index) => item.stepId !== selected.items[index].stepId) || row.signalReadings.some((item, index) => item.stepId !== selected.signalReadings[index].stepId))) return undefined;
    return rows as GroupBootstrap["group"];
  }
  function pendingFor(cardId: string, kind?: PersonalLearningChange["kind"]) { return [...changes.values()].some(entry => entry.cardId === cardId && entry.owner === "personal" && entry.pending && (!kind || entry.change.kind === kind)); }
  function recordChange(cardId: string, owner: "group" | "personal", change: PersonalLearningChange, isPending: boolean) {
    if (!live()) return;
    const key = JSON.stringify([owner, cardId, change.kind, change.stepId]);
    changes.set(key, { cardId, owner, change, stamp: ++mutationStamp, pending: isPending, version: owner === "group" ? state.data?.bootstrap.group.find(row => row.cardTemplateId === cardId)?.version : undefined });
    if (owner === "personal" && state.data?.bootstrap.isFollower) {
      const previous = dirty.get(cardId);
      dirty.set(cardId, { ...previous, [change.kind === "signal" ? "confidence" : "progress"]: mutationStamp,
        ...(change.kind === "completion" ? { progressSteps: new Set([...(previous?.progressSteps ?? []), change.stepId]) } : {}) });
    }
    if (state.data) update({ ...state, data: reconcileCollective(withChange(state.data, actor, cardId, owner, change)) });
  }
  const unsubscribeLearning = workingCardStore.onLearning(notice => {
    if (notice.userId !== actor || state.data && (!state.data.bootstrap.isFollower || !state.data.bootstrap.deck.cards.some(row => row.id === notice.cardId)
      && !state.data.bootstrap.own?.some(row => row.cardTemplateId === notice.cardId))) return;
    recordChange(notice.cardId, "personal", notice.change, notice.pending);
    if (!notice.pending) void refreshAggregates();
  });
  const unsubscribeClear = workingCardStore.onClear(user => { if (user === actor) dispose(); });
  const unsubscribeGroup = workingCardStore.onGroupClear((user, experience) => {
    if (user !== actor || experience !== experienceId) return;
    preparationGeneration++; perspectives.clear(); followerTask = undefined; followerReadyScope = undefined; groupReadyScope = undefined;
    acceptedLearning.clear(); acceptedAggregates.clear(); setPreparation("idle");
  });
  function dispose() {
    if (disposed) return;
    disposed = true; unsubscribeLearning(); unsubscribeClear(); unsubscribeGroup(); generation++; abort.abort(); if (expiry) cancel(expiry);
    perspectives.clear(); followerTask = undefined;
    state = { loading: false, verified: false }; listeners.forEach(listener => listener()); listeners.clear();
  }
  function mergeAggregates(rows: GroupAggregates["cards"], readStamp: number, order = ++readOrder) {
    return rows.map(row => {
      const prior = state.data?.aggregates.find(value => value.cardTemplateId === row.cardTemplateId);
      if ((acceptedAggregates.get(row.cardTemplateId) ?? 0) > order && prior) return prior;
      acceptedAggregates.set(row.cardTemplateId, order);
      const fields = dirty.get(row.cardTemplateId);
      if (!fields) return row;
      const old = state.data?.aggregates.find(value => value.cardTemplateId === row.cardTemplateId);
      if ((fields.progress ?? Infinity) <= readStamp && !pendingFor(row.cardTemplateId, "completion")) { delete fields.progress; delete fields.progressSteps; }
      if ((fields.confidence ?? Infinity) <= readStamp && !pendingFor(row.cardTemplateId, "signal")) delete fields.confidence;
      if (fields.progress === undefined && fields.confidence === undefined) dirty.delete(row.cardTemplateId);
      const retain = (value: typeof row.followers, known: typeof row.followers | undefined, stepId?: string) => !known ? value : { ...value,
        ...(fields.confidence !== undefined ? { confidence: known.confidence } : {}),
        ...(fields.progress !== undefined && (!stepId || fields.progressSteps?.has(stepId)) ? { doing: known.doing, done: known.done, eligibleTotal: known.eligibleTotal } : {}) };
      return { ...row, followers: retain(row.followers, old?.followers), steps: row.steps.map(step => ({ ...step,
        followers: retain(step.followers, old?.steps.find(value => value.stepId === step.stepId)?.followers, step.stepId) })) };
    });
  }
  async function refreshAggregates(): Promise<void> {
    if (aggregateRead) return aggregateRead;
    if (!active || !live() || !dirty.size || writes || [...changes.values()].some(entry => entry.pending) || !state.data) return;
    const reference = state.data.bootstrap, stamp = mutationStamp, order = ++readOrder;
    aggregateRead = (async () => {
      try {
        const cards: GroupAggregates["cards"] = []; let offset: number | null = 0;
        while (offset !== null) {
          const page: GroupAggregates = await read(actor, `${base}/aggregates?cardOffset=${offset}`, abort.signal);
          checkAuthority(reference, page); cards.push(...page.cards); offset = page.nextCardOffset;
        }
        if (!live() || !state.data) return;
        checkAuthority(reference, state.data.bootstrap);
        const replacements = new Map(cards.map(row => [row.cardTemplateId, row]));
        const aggregates = mergeAggregates(state.data.aggregates.map(row => replacements.get(row.cardTemplateId) ?? row), stamp, order);
        update({ ...state, data: reconcileCollective({ ...state.data, aggregates }) });
      } catch (cause) { if (live()) verificationFailed(cause, ++verificationOrder); }
    })().finally(() => {
      aggregateRead = undefined;
      if (active && live() && mutationStamp > stamp && dirty.size && !writes && ![...changes.values()].some(entry => entry.pending)) void refreshAggregates();
    });
    await aggregateRead;
  }
  async function load(preparation?: { selection?: GroupPreparationSelection; cardTemplateId?: string; opening?: boolean }) {
    if (pending) return pending;
    if (disposed) return;
    const token = ++generation, readStamp = mutationStamp, navigationAtRead = navigationGeneration, sourceOrder = ++readOrder;
    let order = ++verificationOrder;
    update({ ...state, loading: true, error: undefined });
    pending = (async () => {
      try {
        const capture = captureCardPreparation(actor);
        let prepared: PreparedGroup | undefined;
        let checkedAt = now();
        let reference: Authority, bootstrap: GroupBootstrap | undefined;
        const followers = new Map<string, GroupPerspectivePage["followers"][number]>(), aggregates: GroupAggregates["cards"] = [];
        if (preparation) {
          const selection = preparation.selection ?? state.data?.bootstrap.selection;
          prepared = await readPrepared(selection, !!preparation.opening, preparation.cardTemplateId);
          if (!prepared) return;
          reference = bootstrap = prepared.bootstrap;
          checkAuthority(reference, prepared);
          for (const row of prepared.followers) followers.set(row.userId, row);
          aggregates.push(...prepared.aggregates);
          if (state.data && (state.data.bootstrap.structureRevision !== reference.structureRevision || state.data.bootstrap.accessEpoch !== reference.accessEpoch || state.data.bootstrap.adoptionRevision !== reference.adoptionRevision)) {
            workingCardStore.clearGroup(actor, experienceId);
            update({ ...state, data: { ...state.data, followers: state.data.followers.filter(row => row.userId === actor) }, loading: true, verified: false });
          }
        } else {
        reference = await read<Authority>(actor, `${base}/authority`, abort.signal);
        if (state.data && (state.data.bootstrap.structureRevision !== reference.structureRevision || state.data.bootstrap.accessEpoch !== reference.accessEpoch || state.data.bootstrap.adoptionRevision !== reference.adoptionRevision)) {
          workingCardStore.clearGroup(actor, experienceId);
          // A viewer epoch does not change when somebody ELSE leaves. Structure
          // revocation must purge previously fetched peers before accepting pages.
          update({ ...state, data: state.data ? { ...state.data, followers: state.data.followers.filter(row => row.userId === actor) } : undefined,
            loading: true, verified: false });
        }
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
        checkedAt = now(); const latest = await read<Authority>(actor, `${base}/authority`, abort.signal); checkAuthority(reference, latest);
        // Lease starts before the final authority read, not when it resolves.
        // Expiry restricts edits; only confirmed denial or incompatible scope
        // withdraws retained content.
        if (now() - checkedAt >= GROUP_AUTHORITY_MS) throw new Error("Access verification expired. Retry.");
        }
        if (reference.structureRevision < requiredStructureRevision || reference.accessEpoch < requiredAccessEpoch || reference.adoptionRevision < requiredAdoptionRevision) throw new GroupRequestError("GROUP_SCOPE_CONFLICT", 409);
        if (!live() || token !== generation) return;
        let incoming: LoadedGroup = { bootstrap: bootstrap!, followers: [...followers.values()], aggregates };
        incoming = reconcileLearning(incoming, readStamp, sourceOrder);
        for (const [key, entry] of changes) {
          if (entry.owner === "group" && entry.version !== incoming.bootstrap.group.find(row => row.cardTemplateId === entry.cardId)?.version) { changes.delete(key); continue; }
          if (entry.pending || entry.stamp > readStamp) {
            incoming = withChange(incoming, actor, entry.cardId, entry.owner, entry.change);
            if (entry.owner === "personal" && incoming.bootstrap.isFollower && incoming.bootstrap.own?.some(row => row.cardTemplateId === entry.cardId)) {
              const previous = dirty.get(entry.cardId);
              dirty.set(entry.cardId, { ...previous, [entry.change.kind === "signal" ? "confidence" : "progress"]: entry.stamp,
                ...(entry.change.kind === "completion" ? { progressSteps: new Set([...(previous?.progressSteps ?? []), entry.change.stepId]) } : {}) });
            }
          }
        }
        if (navigationAtRead !== navigationGeneration && state.data) {
          const selected = state.data.bootstrap.selection;
          const permitted = selected.perspective === "group" || selected.perspective === "self" && incoming.bootstrap.isFollower
            || selected.perspective === "follower" && incoming.bootstrap.canInspectFollowers && incoming.followers.some(row => row.userId === selected.subjectUserId);
          incoming.bootstrap = { ...incoming.bootstrap, ...(permitted ? { selection: selected } : {}),
            ...(incoming.bootstrap.deck.cards.some(card => card.id === state.data!.bootstrap.activeCardId) ? { activeCardId: state.data.bootstrap.activeCardId } : {}) };
        }
        incoming.aggregates = mergeAggregates(incoming.aggregates, readStamp, sourceOrder);
        incoming = reconcileCollective(incoming);
        // R1 is post-presentation feedback, never a new initial placeholder.
        // Rare overlapping owner saves can settle while the first load runs.
        // Keep accepted sections in this accumulator and repair only aggregates.
        while (!state.data && dirty.size && live() && (!prepared || prepared.bootstrap.selection.perspective === "group")) {
          await personalWork.wait({ userId: actor, cardIds: incoming.bootstrap.own?.map(row => row.cardTemplateId) ?? [] }, abort.signal);
          const stamp = mutationStamp, aggregateOrder = ++readOrder, fresh: GroupAggregates["cards"] = []; let offset: number | null = 0;
          while (offset !== null) {
            const page: GroupAggregates = await read(actor, `${base}/aggregates?cardOffset=${offset}`, abort.signal);
            checkAuthority(reference, page); fresh.push(...page.cards); offset = page.nextCardOffset;
          }
          for (const entry of changes.values()) incoming = withChange(incoming, actor, entry.cardId, entry.owner, entry.change);
          incoming.aggregates = mergeAggregates(fresh, stamp, aggregateOrder);
        }
        if (!live() || token !== generation) return;
        if (now() - checkedAt >= GROUP_AUTHORITY_MS) {
          order = ++verificationOrder; checkedAt = now();
          checkAuthority(reference, await read<Authority>(actor, `${base}/authority`, abort.signal));
          if (now() - checkedAt >= GROUP_AUTHORITY_MS) throw Error("Access verification expired. Retry.");
        }
        if (prepared) {
          const b = incoming.bootstrap, selected = prepared.bootstrap.selection, own = selected.perspective === "self";
          if (selected.perspective === "group" && b.deck.cards.some(card => !incoming.aggregates.some(row => row.cardTemplateId === card.id))) throw Error("Group aggregate preparation is incomplete. Retry opening the Deck.");
          acceptCardPreparation(capture, prepared.contributions, b.deck.cards.map(card => card.id),
            cardTemplateId => own ? { kind: "owner", viewerUserId: actor, cardTemplateId, experienceId }
              : { kind: "group", viewerUserId: actor, cardTemplateId, experienceId, accessEpoch: b.accessEpoch, adoptionRevision: b.adoptionRevision, structureRevision: b.structureRevision, ...(selected.perspective === "follower" ? { subjectUserId: selected.subjectUserId } : {}) },
            cardTemplateId => ({ viewerUserId: actor, cardTemplateId, adoptionRevision: b.adoptionRevision, structureRevision: b.structureRevision,
              view: { kind: "group", experienceId, mode: own ? "own" : selected.perspective === "group" ? "group" : "inspection", subjectUserId: selected.perspective === "follower" ? selected.subjectUserId : undefined, accessEpoch: b.accessEpoch } }));
        }
        grant(checkedAt, order);
        update({ ...state, data: incoming, verified: true, loading: false, mutationError: state.mutationError });
        if (prepared) { const selected = prepared.bootstrap.selection; if (selected.perspective === "group") groupReadyScope = scope(); }
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
    writes++;
    const data = state.data;
    if (data) {
      const row = (owner === "group" ? data.bootstrap.group : data.bootstrap.own)?.find(row => row.cardTemplateId === cardId);
      if (row && !confirmed.has(key)) confirmed.set(key, change.kind === "completion" ? { ...change, completionStatus: row.items.find(item => item.stepId === change.stepId)!.completionStatus }
        : { ...change, reading: row.signalReadings.find(signal => signal.stepId === change.stepId)!.reading });
      update({ ...state, mutationError: undefined, data: withChange(data, actor, cardId, owner, change) });
    }
    recordChange(cardId, owner, change, true);
    if (owner === "personal") workingCardStore.publishLearning(actor, cardId, change, "start");
    const operation = previous.catch(() => {}).then(async () => {
      const run = async () => {
        // Disposing the view cancels reads, not already accepted scalar saves.
        // Keep queued writes bound to their original actor/Card/version/epoch;
        // current server authority still decides whether they may commit.
        await read(actor, `${base}/cards/${encodeURIComponent(cardId)}/${owner === "group" ? "group" : "personal"}-learning`, undefined,
          "PATCH", { version, accessEpoch, change });
        confirmed.set(key, change);
        // Keep the owner media/reflection overlay; publish the exact learning field below.
      };
      try {
        // Same authoritative personal row across personal Decks and groups.
        // This barrier is owner/Card scoped; group state has its own lane.
        if (owner === "personal") await personalWork.run({ userId: actor, cardIds: [cardId] }, key, run); else await run();
      } catch (cause) {
        const rollback = confirmed.get(key);
        update({ ...state, data: state.data && rollback && fieldTokens.get(key) === token && (owner === "personal" || state.data.bootstrap.group.some(row => row.cardTemplateId === cardId && row.version === version)) ? withChange(state.data, actor, cardId, owner, rollback) : state.data,
          mutationError: cause instanceof Error ? cause.message : "Change could not be saved." });
        verificationFailed(cause, ++verificationOrder);
      }
    }).finally(async () => {
      writes--;
      if (lanes.get(key) === operation) {
        const row = (owner === "group" ? state.data?.bootstrap.group : state.data?.bootstrap.own)?.find(row => row.cardTemplateId === cardId);
        const current: PersonalLearningChange = change.kind === "completion" ? { ...change, completionStatus: row?.items.find(item => item.stepId === change.stepId)?.completionStatus ?? change.completionStatus }
          : { ...change, reading: row?.signalReadings.find(item => item.stepId === change.stepId)?.reading ?? null };
        if (owner === "personal" || row?.version === version) recordChange(cardId, owner, current, false); else changes.delete(key);

        lanes.delete(key); confirmed.delete(key); fieldTokens.delete(key);
      }
      if (owner === "personal" && live()) {
        const latest = changes.get(key)?.change ?? change;
        workingCardStore.publishLearning(actor, cardId, latest, "settled");
      }
      if (!writes && live()) await refreshAggregates();
    });
    lanes.set(key, operation); return operation;
  }
  return { isDisposed: () => disposed, snapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load, prepare(selection?: GroupPreparationSelection, cardTemplateId?: string) {
      const key = JSON.stringify([selection ?? null, cardTemplateId ?? null]), existing = initialRequests.get(key);
      if (existing) return existing;
      const previous = initialOpen;
      const operation = Promise.resolve(previous).catch(() => {}).then(async () => {
        // Only compatible initial requests share a result. An already running
        // refresh or another entry intent must finish before this scope starts.
        while (pending) await pending;
        await load({ selection, cardTemplateId, opening: true });
      });
      initialOpen = operation; initialRequests.set(key, operation);
      void operation.finally(() => { if (initialRequests.get(key) === operation) initialRequests.delete(key); });
      return operation;
    }, renewAuthority, invalidate, save,
    isPrepared: prepared, preparePerspective, prepareFollowers, followersReady,
    releasePerspectiveIntent() { for (const task of perspectives.values()) task.explicit = false; },
    setFollowerIntent(value: boolean) { if (followerTask) followerTask.explicit = value; },
    async prepareNext(allowed: () => boolean) {
      backgroundAllowed = allowed;
      if (!active || !live() || !state.verified || !state.data || writes || state.preparation?.error || !allowed()) return false;
      if (!prepared({ perspective: "group" })) { await preparePerspective({ perspective: "group" }, false); return true; }
      if (state.data.bootstrap.isFollower && !prepared({ perspective: "self" })) { await preparePerspective({ perspective: "self" }, false); return true; }
      if (state.data.bootstrap.canInspectFollowers && state.data.followers.length <= 20 && !followersReady()) { await prepareFollowers(false); return true; }
      return false;
    },
    setActive(value: boolean) { active = value; },
    async revalidate(minimumStructureRevision: number) {
      if (!Number.isSafeInteger(minimumStructureRevision) || minimumStructureRevision < 0) return false;
      requiredStructureRevision = Math.max(requiredStructureRevision, minimumStructureRevision);
      // A settings/adoption acknowledgement can arrive while a poll begun
      // before that commit still owns the coalesced load. It cannot certify
      // the acknowledged revision; finish it, then make one fresh read.
      const wasPending = Boolean(pending);
      const current = () => state.verified && (state.data?.bootstrap.structureRevision ?? -1) >= minimumStructureRevision;
      invalidate(); await load({ selection: state.data?.bootstrap.selection });
      if (wasPending && !current() && !disposed) { invalidate(); await load({ selection: state.data?.bootstrap.selection }); }
      return current();
    },
    async navigate(selection: PerspectiveSelection, activeCardId?: string) {
      const current = state.data?.bootstrap; if (!current || !state.verified) return;
      const token = ++navigationGeneration;
      if (state.data) update({ ...state, data: { ...state.data, bootstrap: { ...current, selection, ...(activeCardId ? { activeCardId } : {}) } } });
      const body = { accessEpoch: current.accessEpoch, expectedStructureRevision: current.structureRevision, selection, ...(activeCardId ? { activeCardId } : {}) };
      // Visual switching is immediate. Persist in order so a slow earlier click
      // cannot become the remembered perspective after a later selection.
      const opening = initialOpen;
      navigationTail = navigationTail.catch(() => {}).then(async () => {
        await opening;
        if (!disposed && token === navigationGeneration) await read(actor, `${base}/navigation`, abort.signal, "PATCH", body);
      });
      await navigationTail;
    },
    dispose,
  };
}

// Called from the mounted client adapter, never from a server read.
const retainedGroups = new Map<string, ReturnType<typeof createGroupResource>>();
export function retainedGroupResource(actor: string, experienceId: string) {
  const key = JSON.stringify([actor, experienceId]);
  let resource = retainedGroups.get(key);
  if (!resource || resource.isDisposed()) { resource = createGroupResource(actor, experienceId); retainedGroups.set(key, resource); }
  return resource;
}
workingCardStore.onClear(actor => {
  for (const [key, resource] of retainedGroups) if (JSON.parse(key)[0] === actor) { resource.dispose(); retainedGroups.delete(key); }
});
