import type { CardContent, DeckContent, DeckPublicationReview } from "@/lib/cards/model";
import type { CreatorDTO } from "@/lib/cards/readModels";
import { cardPublicationIssue, deckPublicationIssue, sameContent } from "@/lib/cards/publicationRules";
import { createDefaultCardContent } from "@/lib/cards/creatorDefaults";
import { privateGraph } from "./cardArchitectureAdapter";
import type { BoardState } from "./creatorBoardState";
import { creatorRequest, CreatorRequestError, type CreatorTransport } from "./creatorRequest";

type CardAck = CreatorDTO["cards"][number];
type DeckAck = Pick<CreatorDTO, "root" | "content" | "publishedContent">;
type Ack<C> = { root: { ownerUserId: string; revision: number; latestVersion: number; draft: C | null }; content: C; publishedContent: C | null };
export type SaveFailure = { kind: "transient" | "recovery" | "conflict" | "rejected"; code: string };
export { creatorRequest, CreatorRequestError, type CreatorTransport } from "./creatorRequest";
const failure = (error: unknown): SaveFailure => {
  if (!(error instanceof CreatorRequestError)) return { kind: "transient", code: "NETWORK_ERROR" };
  return { kind: error.code === "ADD_CARD_RECOVERY_CONFLICT" ? "recovery" : error.status === 409 ? "conflict" : error.status >= 500 ? "transient" : "rejected", code: error.code };
};
const conflict = () => new CreatorRequestError(409, "RECOVERY_REVISION_CONFLICT");
const retryDelays = [1000, 3000, 8000];
const clone = <T>(value: T): T => structuredClone(value);

// Operational client state only. A response acknowledges its captured generation;
// desired content is never replaced by a response or a remote refresh.
export class EntityLane<C, A extends Ack<C>> {
  desired: C;
  ack: A | null;
  generation = 0;
  acknowledgedGeneration = 0;
  running: Promise<void> | null = null;
  retryAttempt = 0;
  error: SaveFailure | null = null;
  detached = false;
  locked = false;
  publishing = false;
  pendingOperations = 0;
  creationPending = false;
  uncertainSaves: { content: C; generation: number; before: A }[] = [];
  uncertainPublication: { before: A; generation: number; note?: string } | null = null;
  tasks: (() => Promise<void>)[] = [];
  private unlocked: (() => void)[] = [];
  constructor(content: C, ack: A | null, readonly changed: () => void,
    readonly save: (content: C, revision: number) => Promise<A>, readonly read: () => Promise<A>,
    readonly readPublished?: (version: number) => Promise<{ version: number; content: C; updateNote?: string; publishedByUserId: string }>) {
    this.desired = clone(content); this.ack = ack ? clone(ack) : null;
  }
  get dirty() { return !this.ack || !sameContent(this.desired, this.ack.content); }
  set(content: C) {
    if (sameContent(this.desired, content)) return;
    this.desired = clone(content); this.generation++; this.changed(); this.kick();
  }
  accept(ack: A, generation: number) {
    this.ack = clone(ack); this.acknowledgedGeneration = generation; this.changed();
  }
  async bounded<T>(operation: () => Promise<T>): Promise<T> {
    this.retryAttempt = 0;
    for (;;) {
      try { return await operation(); }
      catch (error) {
        const classified = failure(error);
        if (classified.kind !== "transient" || this.retryAttempt === retryDelays.length) { this.error = classified; this.changed(); throw error; }
        const delay = retryDelays[this.retryAttempt++]; this.changed();
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  kick() {
    if (this.running || this.locked || this.error || this.creationPending || (!this.tasks.length && !this.dirty && !this.uncertainPublication && !this.uncertainSaves.length)) return;
    this.running = this.drain().catch(() => {}).finally(() => { this.running = null; this.changed(); this.kick(); });
    this.changed();
  }
  private async drain() {
    while (this.tasks.length || this.dirty || this.uncertainPublication || this.uncertainSaves.length) {
      if (this.uncertainPublication) { await this.bounded(() => this.recoverPublication()); continue; }
      if (this.tasks.length) {
        await this.bounded(this.tasks[0]); this.tasks.shift(); continue;
      }
      if (!this.ack) throw conflict();
      await this.bounded(async () => {
        if (this.uncertainSaves.length && await this.reconcileSave()) return;
        const content = clone(this.desired), generation = this.generation, revision = this.ack!.root.revision;
        let next: A;
        try { next = await this.save(content, revision); }
        catch (error) {
          const uncertain = failure(error).kind === "transient";
          // A late commit can surface as STALE_REVISION on a guarded retry.
          // Keep all bounded attempt snapshots until the outcome is acknowledged.
          if (!uncertain && !(error instanceof CreatorRequestError && error.code === "STALE_REVISION" && this.uncertainSaves.length)) throw error;
          if (uncertain && !this.uncertainSaves.some((attempt) => attempt.before.root.revision === revision && sameContent(attempt.content, content))) this.uncertainSaves.push({ content, generation, before: clone(this.ack!) });
          if (await this.reconcileSave()) return;
          throw error;
        }
        if (next.root.revision !== revision + 1 || !sameContent(next.content, content)) throw conflict();
        this.uncertainSaves = []; this.accept(next, generation);
      });
    }
    this.retryAttempt = 0; this.acknowledgedGeneration = this.generation;
  }
  private async reconcileSave() {
    const remote = await this.read();
    const committed = this.uncertainSaves.find((attempt) => remote.root.revision === attempt.before.root.revision + 1 && sameContent(remote.content, attempt.content));
    if (committed) { this.accept(remote, committed.generation); this.uncertainSaves = []; return true; }
    if (remote.root.revision !== this.ack!.root.revision || !sameContent(remote.content, this.ack!.content)) throw conflict();
    // This read establishes current state, not proof that an older timed-out
    // transaction cannot still commit. Guard the next write with the same revision.
    return false;
  }
  async flush() {
    if (this.locked) await new Promise<void>((resolve) => this.unlocked.push(resolve));
    if (this.creationPending) throw new CreatorRequestError(409, "CREATION_PENDING");
    this.kick();
    while (this.running) await this.running;
    if (this.error) throw new CreatorRequestError(this.error.kind === "transient" ? 503 : 409, this.error.code);
    if (this.dirty || this.tasks.length || this.uncertainPublication || this.uncertainSaves.length) throw conflict();
  }
  async recoverPublication() {
    const pending = this.uncertainPublication!;
    const remote = await this.read(), before = pending.before;
    if (remote.root.latestVersion === before.root.latestVersion + 1 && remote.root.revision === before.root.revision + 1 && sameContent(remote.publishedContent, before.content)) {
      if (!this.readPublished) throw conflict();
      const receipt = await this.readPublished(before.root.latestVersion + 1);
      if (receipt.version !== before.root.latestVersion + 1 || receipt.publishedByUserId !== before.root.ownerUserId || !sameContent(receipt.content, before.content) || receipt.updateNote !== pending.note) throw conflict();
      this.accept(remote, pending.generation);
    }
    else if (remote.root.revision !== before.root.revision || !sameContent(remote.content, before.content)) throw conflict();
    this.uncertainPublication = null; this.changed();
  }
  retry() {
    if (this.error?.kind === "conflict" || this.error?.kind === "recovery") return;
    this.error = null; this.retryAttempt = 0; this.changed(); this.kick();
  }
  async acquire(): Promise<void> {
    if (this.locked) throw new CreatorRequestError(409, "ENTITY_BUSY");
    await this.flush();
    if (this.locked) throw new CreatorRequestError(409, "ENTITY_BUSY");
    // No await between the final dirty check and the lock.
    if (this.running || this.dirty) return this.acquire();
    this.locked = true; this.changed();
  }
  release() { this.locked = false; this.publishing = false; for (const resolve of this.unlocked.splice(0)) resolve(); this.changed(); this.kick(); }
}

export class CreatorPersistenceCoordinator {
  readonly deck: EntityLane<DeckContent, DeckAck>;
  readonly cards = new Map<string, EntityLane<CardContent, CardAck>>();
  readonly deckTemplateId: string;
  private listeners = new Set<() => void>();
  private attached = new Set<string>();
  private initialQueued = false;
  constructor(board: BoardState, initial: CreatorDTO | null, readonly request: CreatorTransport = creatorRequest) {
    const graph = privateGraph(board, initial); this.deckTemplateId = graph.deckTemplateId;
    this.deck = new EntityLane(graph.content, initial, this.changed,
      (content, revision) => this.request(this.deckURL + "/saved", "PATCH", { content, revision }), () => this.request(this.deckURL), (version) => this.request(this.deckURL + `/publish?version=${version}`));
    for (const card of graph.cards) this.makeCard(card.cardTemplateId, card.content, initial?.cards.find((item) => item.root.cardTemplateId === card.cardTemplateId) ?? null);
    this.attached = new Set(graph.cards.map((card) => card.cardTemplateId));
  }
  private get deckURL() { return `/api/deck-templates/${encodeURIComponent(this.deckTemplateId)}`; }
  private cardURL(id: string) { return `/api/card-templates/${encodeURIComponent(id)}`; }
  private changed = () => { for (const listener of this.listeners) listener(); };
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  get dto(): CreatorDTO | null {
    return this.deck.ack ? { ...this.deck.ack, cards: [...this.attached].flatMap((id) => this.cards.get(id)?.ack ? [this.cards.get(id)!.ack!] : []) } : null;
  }
  private makeCard(id: string, content: CardContent, ack: CardAck | null) {
    const lane = new EntityLane(content, ack, this.changed,
      (content, revision) => this.request(this.cardURL(id), "PATCH", { type: "save", content, revision }), () => this.request(this.cardURL(id)), (version) => this.request(this.cardURL(id) + `?version=${version}`));
    this.cards.set(id, lane); return lane;
  }
  private ensureInitial(content: DeckContent, cards: { cardTemplateId: string; content: CardContent }[] = []) {
    if (this.deck.ack || this.initialQueued) return;
    this.initialQueued = true;
    const graph = clone({ deckTemplateId: this.deckTemplateId, content, cards });
    this.deck.tasks.push(async () => {
      // Stable initial graph retry is recognized server-side. Do not substitute
      // a newer graph after an uncertain response.
      const dto = await this.request<CreatorDTO>("/api/deck-templates", "POST", graph);
      if (!sameContent(dto.content, graph.content) || dto.root.revision !== 0) throw conflict();
      this.deck.accept(dto, 0);
      for (const card of dto.cards) {
        const lane = this.cards.get(card.root.cardTemplateId)!;
        lane.accept(card, 0); lane.creationPending = false; lane.kick();
      }
    });
  }
  editDeck(content: DeckContent) { this.ensureInitial(content); this.deck.set(content); this.deck.kick(); }
  beginCardUpload(id: string) { return this.beginUpload(this.cards.get(id)!); }
  beginDeckUpload() { return this.beginUpload(this.deck); }
  private beginUpload(lane: { pendingOperations: number }) {
    lane.pendingOperations++; this.changed();
    return () => { lane.pendingOperations--; this.changed(); };
  }
  private async waitForUploads() {
    const pending = () => this.deck.pendingOperations > 0 || [...this.attached].some((id) => this.cards.get(id)!.pendingOperations > 0);
    if (!pending()) return;
    await new Promise<void>((resolve) => {
      const stop = this.subscribe(() => { if (!pending()) { stop(); resolve(); } });
    });
  }
  editCard(id: string, content: CardContent) {
    const lane = this.cards.get(id); if (!lane) throw new Error("Unknown Card identity"); lane.set(content);
  }
  addCard(id: string, stepIds: string[], nextDeck: DeckContent) {
    const defaults = createDefaultCardContent(stepIds), lane = this.makeCard(id, defaults, null);
    lane.creationPending = true; this.attached.add(id);
    if (!this.deck.ack && !this.initialQueued) this.ensureInitial(nextDeck, [{ cardTemplateId: id, content: defaults }]);
    else {
      let command: { revision: number; cardTemplateId: string; stepIds: string[]; content: DeckContent } | null = null;
      this.deck.tasks.push(async () => {
        if (!command) command = { revision: this.deck.ack!.root.revision, cardTemplateId: id, stepIds,
          content: { ...clone(nextDeck), cards: nextDeck.cards.filter((ref) => ref.cardTemplateId === id || this.cards.get(ref.cardTemplateId)?.ack) } };
        const result = await this.request<{ deck: DeckAck; card: CardAck }>(this.deckURL + "/cards", "POST", command);
        if (result.deck.root.revision !== command.revision + 1 || !sameContent(result.deck.content, command.content)) throw conflict();
        this.deck.accept(result.deck, this.deck.acknowledgedGeneration);
        lane.accept(result.card, 0); lane.creationPending = false; lane.kick();
      });
    }
    this.deck.set(nextDeck); this.deck.kick(); this.changed();
  }
  detachCard(id: string, nextDeck: DeckContent) {
    this.attached.delete(id); const lane = this.cards.get(id); if (lane) lane.detached = true;
    // TODO: expose recovery for detached independent Card drafts in a later UI.
    this.editDeck(nextDeck); this.changed();
  }
  async flushCard(id: string) {
    const lane = this.cards.get(id)!;
    if (lane.creationPending) {
      // Wait only until this creation is acknowledged, not unrelated Deck work.
      await new Promise<void>((resolve, reject) => {
        const check = () => {
          if (!lane.creationPending) { stop(); resolve(); }
          else if (this.deck.error) { stop(); reject(new CreatorRequestError(409, this.deck.error.code)); }
        };
        const stop = this.subscribe(check); check();
      });
    }
    await lane.flush();
  }
  async flushAll() {
    if (!this.deck.ack && !this.initialQueued) return; // untouched local session
    await Promise.all([this.deck.flush(), ...[...this.attached].map((id) => this.flushCard(id))]);
  }
  async prepareToNavigate() {
    // Detached work deliberately continues independently after SPA navigation.
    await this.waitForUploads();
    await this.flushAll();
  }
  retryDeck() { this.deck.retry(); }
  retryCard(id: string) {
    if (this.cards.get(id)?.creationPending) this.deck.retry(); else this.cards.get(id)?.retry();
  }
  publicationState() {
    const deck = this.deck.ack;
    const roots = [...this.cards.values()].flatMap((lane) => lane.ack ? [lane.ack.root] : []);
    const cards = Object.fromEntries([...this.attached].map((id) => {
      const lane = this.cards.get(id)!, saved = lane.ack;
      return [id, !!saved && !lane.error && !lane.publishing && cardPublicationIssue(saved.root.latestVersion, saved.root.draft, saved.publishedContent) === null];
    }));
    return { deck: !!deck && !this.deck.error && !this.deck.publishing && deckPublicationIssue(deck.root.latestVersion, deck.root.draft, deck.publishedContent, roots) === null,
      cards, any: this.hasWork() };
  }
  hasWork() {
    if (!this.deck.ack && !this.initialQueued) return false;
    return this.deck.dirty || this.deck.running !== null || this.deck.uncertainSaves.length > 0 || !!this.deck.uncertainPublication || this.deck.pendingOperations > 0 || this.deck.tasks.length > 0 || !!this.deck.ack?.root.draft || [...this.attached].some((id) => {
      const lane = this.cards.get(id)!; return lane.dirty || lane.running !== null || lane.uncertainSaves.length > 0 || !!lane.uncertainPublication || lane.pendingOperations > 0 || !!lane.ack?.root.draft;
    });
  }
  async publishCard(id: string, note?: string) {
    await this.flushCard(id); const lane = this.cards.get(id)!; await lane.acquire(); lane.publishing = true; this.changed();
    try {
      const ack = lane.ack!, issue = cardPublicationIssue(ack.root.latestVersion, ack.root.draft, ack.publishedContent);
      if (issue === "NO_UNPUBLISHED_CHANGES") return;
      if (issue) throw new CreatorRequestError(400, issue);
      const generation = lane.acknowledgedGeneration;
      const result = await this.publishSafely(lane, () => this.request<CardAck>(this.cardURL(id), "PATCH", { type: "publish", revision: ack.root.revision, updateNote: note }), note);
      lane.accept(result, generation);
    } finally { lane.release(); }
  }
  private async publishSafely<C, A extends Ack<C>>(lane: EntityLane<C, A>, publish: () => Promise<A>, note?: string): Promise<A> {
    const before = clone(lane.ack!);
    lane.uncertainPublication = { before, generation: lane.acknowledgedGeneration, note: note?.trim() || undefined };
    try {
      const result = await publish();
      if (result.root.latestVersion !== before.root.latestVersion + 1 || result.root.revision !== before.root.revision + 1 || !sameContent(result.publishedContent, before.content)) throw conflict();
      lane.uncertainPublication = null; return result;
    } catch (error) {
      const kind = failure(error).kind;
      if (kind !== "transient") {
        lane.uncertainPublication = null;
        if (kind === "conflict" || kind === "recovery") { lane.error = failure(error); this.changed(); }
        throw error;
      }
      // If reconciliation itself is unavailable, retain this exact publication
      // snapshot. The save lane recovers it before any later save or publication.
      await lane.recoverPublication();
      if (lane.ack!.root.latestVersion === before.root.latestVersion + 1) return lane.ack!;
      throw error;
    }
  }

  warningCards(review: DeckPublicationReview) {
    return review.cards.filter((card) => {
      const lane = this.cards.get(card.cardTemplateId);
      return card.hasDraft || !!lane && (lane.dirty || !!lane.error || lane.creationPending || lane.pendingOperations > 0);
    }).map((card) => card.cardTemplateId);
  }
  private reviewFingerprint(review: DeckPublicationReview) {
    return JSON.stringify({ review, generation: this.deck.generation, cards: review.cards.map((card) => {
      const lane = this.cards.get(card.cardTemplateId); return [card.cardTemplateId, lane?.generation, lane?.ack?.root.revision, lane?.error, lane?.pendingOperations];
    }) });
  }
  async publishDeck(note: string | undefined, confirm: (ids: string[]) => Promise<boolean>) {
    await this.deck.acquire(); this.deck.publishing = true; this.changed();
    try {
      const ack = this.deck.ack!;
      if (!ack.root.draft) return true;
      const review = await this.request<DeckPublicationReview>(this.deckURL + `/publish?revision=${ack.root.revision}`);
      const warning = this.warningCards(review), fingerprint = this.reviewFingerprint(review);
      if (warning.length && !await confirm(warning)) return false;
      if (fingerprint !== this.reviewFingerprint(review)) throw new CreatorRequestError(409, "DECK_PUBLICATION_REVIEW_CONFLICT");
      const result = await this.publishSafely(this.deck, () => this.request<CreatorDTO>(this.deckURL + "/publish", "POST", {
        revision: ack.root.revision, review, acceptCardDrafts: warning.length > 0, updateNote: note }), note);
      this.deck.accept(result, this.deck.acknowledgedGeneration); return true;
    } catch (error) {
      if (error instanceof CreatorRequestError && error.code === "STALE_REVISION") { this.deck.error = failure(error); this.changed(); }
      throw error;
    } finally { this.deck.release(); }
  }
  async publishAndLeave(notes: Record<string, string>, confirm: (ids: string[]) => Promise<boolean>) {
    await this.waitForUploads(); await this.flushAll();
    for (const id of this.attached) if (this.cards.get(id)!.ack!.root.draft) await this.publishCard(id, notes[id]);
    if (this.deck.ack?.root.draft && !await this.publishDeck(notes.deck, confirm)) return false;
    await this.flushAll();
    return !this.hasWork();
  }
  async move(sourceId: string, destinationId: string, sourceIndex: number, destinationIndex: number) {
    await Promise.all([this.deck.flush(), this.flushCard(sourceId), this.flushCard(destinationId)]);
    const source = this.cards.get(sourceId)!, destination = this.cards.get(destinationId)!;
    const lanes = [this.deck, source, destination];
    for (const lane of lanes) { if (lane.locked || lane.running || lane.dirty) throw conflict(); }
    if (source.pendingOperations || destination.pendingOperations) throw new CreatorRequestError(409, "STEP_MOVE_UPLOAD_IN_PROGRESS");
    for (const lane of lanes) lane.locked = true;
    this.changed();
    const revisions = { deck: this.deck.ack!.root.revision, source: source.ack!.root.revision, destination: destination.ack!.root.revision };
    const beforeDeck = clone(this.deck.ack!.content), beforeSource = clone(source.ack!.content), beforeDestination = clone(destination.ack!.content);
    const nextSource = clone(beforeSource), nextDestination = clone(beforeDestination);
    [nextSource.steps[sourceIndex], nextDestination.steps[destinationIndex]] = [nextDestination.steps[destinationIndex], nextSource.steps[sourceIndex]];
    const matches = (dto: CreatorDTO, committed: boolean) => {
      const offset = committed ? 1 : 0, a = dto.cards.find((card) => card.root.cardTemplateId === sourceId), b = dto.cards.find((card) => card.root.cardTemplateId === destinationId);
      return dto.root.revision === revisions.deck + offset && a?.root.revision === revisions.source + offset && b?.root.revision === revisions.destination + offset
        && sameContent(dto.content, beforeDeck) && sameContent(a.content, committed ? nextSource : beforeSource) && sameContent(b.content, committed ? nextDestination : beforeDestination);
    };
    try {
      let result: CreatorDTO;
      try { result = await this.request<CreatorDTO>(this.deckURL + "/move-step", "POST", { sourceId, destinationId, sourceIndex, destinationIndex, revisions }); }
      catch (error) {
        if (failure(error).kind !== "transient") throw error;
        const remote = await this.request<CreatorDTO>(this.deckURL);
        if (matches(remote, true)) result = remote;
        else if (matches(remote, false)) throw error;
        else throw conflict();
      }
      if (!matches(result, true)) throw conflict();
      // Only these three acknowledgements participate in the barrier. Other Cards
      // may have independent in-flight edits and must never be reset by this DTO.
      if (this.deck.generation !== this.deck.acknowledgedGeneration || source.generation !== source.acknowledgedGeneration || destination.generation !== destination.acknowledgedGeneration) throw conflict();
      this.deck.accept(result, this.deck.generation);
      for (const id of [sourceId, destinationId]) { const lane = this.cards.get(id)!, next = result.cards.find((card) => card.root.cardTemplateId === id)!; lane.desired = clone(next.content); lane.accept(next, lane.generation); }
      return this.dto!;
    } catch (error) {
      if (failure(error).kind === "conflict" || failure(error).kind === "recovery") { for (const lane of lanes) lane.error = failure(error); this.changed(); }
      throw error;
    } finally { for (const lane of lanes) lane.release(); }
  }
}
