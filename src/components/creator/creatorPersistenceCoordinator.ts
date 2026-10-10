import type { CardContent, DeckContent, DeckPublicationReview, Visibility } from "@/lib/cards/model";
import type { CreatorDTO } from "@/lib/cards/readModels";
import { cardPublicationIssue, deckPublicationIssue, sameContent, publicationVisibility, type PublicationVisibility } from "@/lib/cards/publicationRules";
import { createDefaultCardContent } from "@/lib/cards/creatorDefaults";
import { privateGraph } from "./cardArchitectureAdapter";
import type { CreatorSessionDTO } from "@/lib/cards/creatorSession";
import type { CardForkCommand, DeckForkCommand, CardForkSource } from "@/lib/cards/model";
import { CreatorRecoveryJournal, type SubmittedCreatorOperation } from "./creatorRecovery";
import { forkCardContent } from "@/lib/cards/forks";
import { sessionBoardDTO, type CreatorBoardDTO } from "./cardArchitectureAdapter";
import type { BoardState } from "./creatorBoardState";
import { creatorRequest, CreatorRequestError, type CreatorTransport } from "./creatorRequest";

type CardAck = CreatorDTO["cards"][number];
type DeckAck = Pick<CreatorDTO, "root" | "content" | "publishedContent">;
type Ack<C> = { root: { ownerUserId: string; revision: number; latestVersion: number; draft: C | null } & Partial<PublicationVisibility>; content: C; publishedContent: C | null };
export type SaveFailure = { kind: "transient" | "recovery" | "conflict" | "rejected"; code: string };
export { creatorRequest, CreatorRequestError, type CreatorTransport } from "./creatorRequest";
const failure = (error: unknown): SaveFailure => {
  if (!(error instanceof CreatorRequestError)) return { kind: "transient", code: "NETWORK_ERROR" };
  return { kind: error.code === "ADD_CARD_RECOVERY_CONFLICT" ? "recovery" : error.status === 409 ? "conflict" : error.status >= 500 ? "transient" : "rejected", code: error.code };
};
const conflict = () => new CreatorRequestError(409, "RECOVERY_REVISION_CONFLICT");
const retryDelays = [1000, 3000, 8000];
const clone = <T>(value: T): T => structuredClone(value);
const intent = (root: Partial<PublicationVisibility>) => root.draftVisibility ?? root.visibility ?? "private";
export type PublicPublicationReview = {
  cards: { cardTemplateId: string; revision: number; generation: number }[];
  deck: { deckTemplateId: string; revision: number; generation: number } | null;
};
export type ConfirmPublicPublication = (review: PublicPublicationReview) => Promise<boolean>;
const cancelPublicPublication: ConfirmPublicPublication = async () => false;

// Operational client state only. A response acknowledges its captured generation;
// desired content is never replaced by a response or a remote refresh.
export class EntityLane<C, A extends Ack<C>> {
  desired: C;
  desiredVisibility: Visibility;
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
  uncertainSaves: { content: C; visibility: Visibility; generation: number; before: A }[] = [];
  uncertainPublication: { before: A; generation: number; note?: string } | null = null;
  tasks: (() => Promise<void>)[] = [];
  private unlocked: (() => void)[] = [];
  constructor(content: C, ack: A | null, readonly changed: () => void,
    readonly save: (content: C, revision: number, visibility: Visibility) => Promise<A>, readonly read: () => Promise<A>,
    readonly readPublished?: (version: number) => Promise<{ version: number; content: C; visibility?: import("@/lib/cards/model").Visibility; updateNote?: string; publishedByUserId: string }>) {
    this.desired = clone(content); this.ack = ack ? clone(ack) : null;
    this.desiredVisibility = ack ? intent(ack.root) : "private";
  }
  get dirty() { return !this.ack || !sameContent(this.desired, this.ack.content) || this.desiredVisibility !== intent(this.ack.root); }
  setVisibility(visibility: Visibility) {
    if (visibility !== "private" && visibility !== "public") throw new CreatorRequestError(400, "INVALID_VISIBILITY");
    if (this.ack?.root.visibility === "public" && visibility !== "public") throw new CreatorRequestError(400, "PUBLIC_VISIBILITY_PERMANENT");
    if (visibility === this.desiredVisibility) return;
    this.desiredVisibility = visibility; this.generation++; this.changed(); this.kick();
  }
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
        const content = clone(this.desired), visibility = this.desiredVisibility, generation = this.generation, revision = this.ack!.root.revision;
        let next: A;
        try { next = await this.save(content, revision, visibility); }
        catch (error) {
          const uncertain = failure(error).kind === "transient";
          // A late commit can surface as STALE_REVISION on a guarded retry.
          // Keep all bounded attempt snapshots until the outcome is acknowledged.
          if (!uncertain && !(error instanceof CreatorRequestError && error.code === "STALE_REVISION" && this.uncertainSaves.length)) throw error;
          if (uncertain && !this.uncertainSaves.some((attempt) => attempt.before.root.revision === revision && sameContent(attempt.content, content) && attempt.visibility === visibility)) this.uncertainSaves.push({ content, visibility, generation, before: clone(this.ack!) });
          if (await this.reconcileSave()) return;
          throw error;
        }
        if (next.root.revision !== revision + 1 || next.root.latestVersion !== this.ack!.root.latestVersion
          || next.root.visibility !== this.ack!.root.visibility || !sameContent(next.content, content) || intent(next.root) !== visibility) throw conflict();
        this.uncertainSaves = []; this.accept(next, generation);
      });
    }
    this.retryAttempt = 0; this.acknowledgedGeneration = this.generation;
  }
  private async reconcileSave() {
    const remote = await this.read();
    const committed = this.uncertainSaves.find((attempt) => remote.root.revision === attempt.before.root.revision + 1
      && remote.root.latestVersion === attempt.before.root.latestVersion && remote.root.visibility === attempt.before.root.visibility
      && sameContent(remote.content, attempt.content) && intent(remote.root) === attempt.visibility);
    if (committed) { this.accept(remote, committed.generation); this.uncertainSaves = []; return true; }
    if (remote.root.revision !== this.ack!.root.revision || !sameContent(remote.content, this.ack!.content) || intent(remote.root) !== intent(this.ack!.root)) throw conflict();
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
      if (receipt.version !== before.root.latestVersion + 1 || receipt.publishedByUserId !== before.root.ownerUserId || !sameContent(receipt.content, before.content) || receipt.updateNote !== pending.note
        || before.root.visibility && (receipt.visibility ?? remote.root.visibility) !== publicationVisibility(before.root as PublicationVisibility)) throw conflict();
      this.accept(remote, pending.generation);
    }
    else if (remote.root.revision !== before.root.revision || !sameContent(remote.content, before.content) || intent(remote.root) !== intent(before.root)) throw conflict();
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
  deckTemplateId: string;
  private listeners = new Set<() => void>();
  private attached = new Set<string>();
  private initialQueued = false;
  private reusedCards = new Set<string>();
  noteCardReused(id: string) { this.reusedCards.add(id); this.changed(); }
  constructor(board: BoardState, initial: CreatorDTO | null, readonly request: CreatorTransport = creatorRequest, readonly session?: CreatorSessionDTO) {
    const graph = privateGraph(board, initial ?? (session ? sessionBoardDTO(session) : null)); this.deckTemplateId = graph.deckTemplateId;
    this.deck = new EntityLane(graph.content, initial, this.changed,
      (content, revision, visibility) => this.saveDeck(content, revision, visibility), () => this.readDeck(), (version) => this.request(this.deckURL + `/publish?version=${version}`));
    for (const card of graph.cards) this.makeCard(card.cardTemplateId, card.content, initial?.cards.find((item) => item.root.cardTemplateId === card.cardTemplateId) ?? null);
    this.attached = new Set(graph.cards.map((card) => card.cardTemplateId));
    if (session) {
      if (session.deck.kind === "foreign") { this.deckSource = session.deck; this.deck.creationPending = true; }
      else { this.deck.accept(session.deck.owned, 0); this.deck.desiredVisibility = intent(session.deck.owned.root); }
      for (const card of session.cards) {
        const id = card.kind === "owned" ? card.owned.root.cardTemplateId : card.source.cardTemplateId;
        const lane = this.cards.get(id)!;
        if (card.kind === "owned") { lane.accept(card.owned, 0); lane.desiredVisibility = intent(card.owned.root); }
        else { this.foreignCards.set(id, card); lane.creationPending = true; }
      }
    }
  }
  private deckSource: Extract<CreatorSessionDTO["deck"], { kind: "foreign" }> | null = null;
  private foreignCards = new Map<string, Extract<CreatorSessionDTO["cards"][number], { kind: "foreign" }>>();
  private creatingCards = new Set<string>();
  private targets = new Map<string, { id: string; steps: Map<string, string> }>();
  private deckCreationQueued = false;
  private journal: CreatorRecoveryJournal | null = null;
  private submitted: SubmittedCreatorOperation | null = null;
  private creationAcknowledged = false;
  recovering = false;
  private sessionId = globalThis.crypto.randomUUID();
  private origin = "";
  private reservedDeckId: string | null = null;
  private mediaProofs = new Map<string, string[]>();
  binding(id?: string): "foreign" | "creating" | "owned" | "uncertain" {
    const lane = id ? this.cards.get(id)! : this.deck;
    if (!(id ? this.foreignCards.has(id) : this.deckSource)) return lane.creationPending ? "creating" : "owned";
    if (lane.error && (id ? this.creatingCards.has(id) : this.deckCreationQueued)) return "uncertain";
    if (lane.ack) return "owned";
    return (id ? this.creatingCards.has(id) : this.deckCreationQueued) ? "creating" : "foreign";
  }
  cardIdentity(id: string) { return this.cards.get(id)?.ack ? this.targets.get(id)?.id ?? id : id; }
  get deckReadinessTarget(): import("@/lib/mediaUploadClient").MediaUploadTarget {
    return { scope: "deck-introduction", deckTemplateId: this.deckTemplateId,
      ...(this.deckSource && !this.deck.ack ? { publishedVersion: this.deckSource.source.version } : {}) };
  }
  private selections(): CardForkSource[] {
    return [...this.foreignCards].filter(([id]) => this.attached.has(id) && !this.cards.get(id)!.ack).map(([, card]) => card.source);
  }
  get presentation(): CreatorBoardDTO {
    return { root: { deckTemplateId: this.deckTemplateId }, content: this.deck.desired,
      cards: [...this.attached].map((id) => ({ root: { cardTemplateId: id }, content: this.cards.get(id)!.desired,
        publishedContent: this.cards.get(id)!.ack?.publishedContent ?? this.foreignCards.get(id)?.content ?? null })) };
  }
  private deckContent(content: DeckContent) { return { ...clone(content), cards: content.cards.map((ref) => ({ cardTemplateId: this.cardIdentity(ref.cardTemplateId) })) }; }
  private cardContent(id: string, content: CardContent) {
    const mapping = this.targets.get(id)?.steps;
    return { ...clone(content), steps: content.steps.map((step) => ({ ...clone(step), stepId: mapping?.get(step.stepId) ?? step.stepId })) };
  }
  private normalizeCard(id: string, ack: CardAck): CardAck {
    const reverse = new Map([...(this.targets.get(id)?.steps ?? [])].map(([a, b]) => [b, a]));
    const normalize = (content: CardContent) => ({ ...content, steps: content.steps.map((step) => ({ ...step, stepId: reverse.get(step.stepId) ?? step.stepId })) });
    return { ...ack, root: { ...ack.root, cardTemplateId: id, draft: ack.root.draft ? normalize(ack.root.draft) : null },
      content: normalize(ack.content), publishedContent: ack.publishedContent ? normalize(ack.publishedContent) : null };
  }
  private normalizeDeck(ack: DeckAck): DeckAck {
    const reverse = new Map([...this.targets].filter(([id]) => this.cards.get(id)?.ack).map(([id, target]) => [target.id, id]));
    const normalize = (content: DeckContent) => ({ ...content, cards: content.cards.map((ref) => ({ cardTemplateId: reverse.get(ref.cardTemplateId) ?? ref.cardTemplateId })) });
    return { ...ack, content: normalize(ack.content), publishedContent: ack.publishedContent ? normalize(ack.publishedContent) : null,
      root: { ...ack.root, draft: ack.root.draft ? normalize(ack.root.draft) : null } };
  }
  private async readDeck(): Promise<DeckAck> {
    if (!this.session || !this.deckSource && !this.foreignCards.size) return this.request(this.deckURL);
    const session = await this.request<CreatorSessionDTO>(`/api/creator/session?deckTemplateId=${encodeURIComponent(this.deckTemplateId)}`);
    if (session.actor !== this.session.actor || session.deck.kind !== "owned") throw conflict();
    if (this.recovering) for (const card of session.cards) {
      if (card.kind !== "foreign" || this.creatingCards.has(card.source.cardTemplateId)) continue;
      this.foreignCards.set(card.source.cardTemplateId, card);
      const lane = this.cards.get(card.source.cardTemplateId);
      if (lane && !lane.ack) lane.desired = clone(card.content);
    }
    return this.normalizeDeck(session.deck.owned);
  }
  private async saveDeck(content: DeckContent, revision: number, visibility: Visibility): Promise<DeckAck> {
    if (!this.session || !this.deckSource && !this.foreignCards.size) return this.request(this.deckURL + "/saved", "PATCH", { content, revision, visibility });
    const result = await this.request<CreatorSessionDTO>("/api/creator/session", "PATCH", {
      deckTemplateId: this.deckTemplateId, content: this.deckContent(content), revision, visibility, foreignCardSelections: this.selections() });
    if (result.actor !== this.session.actor || result.deck.kind !== "owned") throw conflict();
    return this.normalizeDeck(result.deck.owned);
  }
  configureRecovery(storage: import("./creatorRecovery").CreatorRecoveryStorage, origin: string) {
    if (!this.session) return;
    this.origin = origin;
    this.journal = new CreatorRecoveryJournal(storage, this.session.actor,
      this.session.deck.kind === "foreign" ? this.session.deck.source.deckTemplateId : this.deckTemplateId);
    this.journal.isolate();
    // A reload can land on the owned URL between installing it and clearing the
    // submitted Deck command. Find only the command naming this exact target.
    if (this.session.deck.kind === "owned" && !this.journal.read()) {
      const sourceId = this.session.deck.owned.root.forkedFrom?.deckTemplateId;
      if (sourceId) {
        const previous = new CreatorRecoveryJournal(storage, this.session.actor, sourceId);
        const operation = previous.read();
        if (operation?.kind === "deck" && (operation.command as DeckForkCommand).deckTemplateId === this.deckTemplateId) this.journal = previous;
      }
    }
  }
  routeInstalled() {
    if (this.submitted && this.deck.ack && this.creationAcknowledged) {
      this.journal?.clear(); this.submitted = null;
    }
  }
  recordMediaProof(id: string, proof: string | undefined) {
    if (proof) this.mediaProofs.set(id, [...(this.mediaProofs.get(id) ?? []), proof]);
  }
  async prepareUploadTarget(id: string | undefined, slot: string) {
    // A creation already submitted owns its frozen target. Wait for that binding
    // rather than allocating a second prospective identity during handoff.
    if (id && this.binding(id) !== "foreign") await this.flushCard(id);
    else if (!id && this.deckSource && this.binding() !== "foreign") await this.deck.flush();
    return this.uploadTarget(id, slot);
  }
  uploadTarget(id: string | undefined, slot: string): import("@/lib/mediaUploadClient").MediaUploadTarget {
    if (id) {
      const card = this.foreignCards.get(id), target = card && !this.cards.get(id)!.ack ? this.target(id) : null;
      return { scope: "card-template", deckTemplateId: this.deckTemplateId, cardTemplateId: target?.id ?? this.cardIdentity(id),
        creatorActor: this.session?.actor, ...(card && target ? { prospective: { kind: "card", source: card.source, targetId: target.id, slot, context: this.session!.context } } : {}) };
    }
    if (this.deckSource && !this.deck.ack) this.reservedDeckId ??= crypto.randomUUID();
    return { scope: "deck-introduction", deckTemplateId: this.reservedDeckId ?? this.deckTemplateId, creatorActor: this.session?.actor,
      ...(this.deckSource && !this.deck.ack ? { prospective: { kind: "deck", source: this.deckSource.source, targetId: this.reservedDeckId!, slot: slot as "image" | "video", context: this.session!.context } } : {}) };
  }
  private target(id: string) {
    let target = this.targets.get(id);
    if (!target) {
      // Lineage allocation follows the immutable source order, even when the
      // first meaningful edit is a reorder of the visible Steps.
      const source = this.foreignCards.get(id)?.content ?? this.cards.get(id)!.desired;
      target = { id: crypto.randomUUID(), steps: new Map(source.steps.map((step) => [step.stepId, crypto.randomUUID()])) };
      this.targets.set(id, target);
    }
    return target;
  }
  private forkCommand(id: string, content: CardContent, visibility?: Visibility): CardForkCommand {
    const source = this.foreignCards.get(id)!, target = this.target(id);
    const baseline = forkCardContent(source.content, source.source, [...target.steps.values()]);
    return { source: source.source, context: this.session!.context, cardTemplateId: target.id, stepIds: [...target.steps.values()], mediaProofs: this.mediaProofs.get(id),
      ...(visibility ? { visibility } : {}), content: { ...clone(content), steps: content.steps.map((step) => ({ ...clone(step),
        stepId: target.steps.get(step.stepId)!, forkedFrom: baseline.steps.find((item) => item.stepId === target.steps.get(step.stepId))!.forkedFrom })) } };
  }
  private queueForeignDeck(content: DeckContent, visibility?: Visibility, cardFork?: CardForkCommand, newCards?: DeckForkCommand["newCards"]) {
    if (this.deckCreationQueued || this.deck.ack) return;
    this.deckCreationQueued = true;
    const command: DeckForkCommand = { source: this.deckSource!.source, deckTemplateId: this.reservedDeckId ?? crypto.randomUUID(),
      context: this.session!.context, content: clone(content), ...(visibility ? { visibility } : {}),
      mediaProofs: this.mediaProofs.get("deck"), foreignCardSelections: this.selections().filter((ref) => ref.cardTemplateId !== cardFork?.source.cardTemplateId), ...(cardFork ? { cardFork } : {}), ...(newCards ? { newCards } : {}) };
    this.enqueueFork("deck", command);
  }
  private queueForeignCard(id: string, content: CardContent, visibility?: Visibility) {
    if (this.creatingCards.has(id)) return;
    this.creatingCards.add(id);
    const command = this.forkCommand(id, content, visibility);
    if (!this.deck.ack && !this.deckCreationQueued) this.queueForeignDeck(this.deck.desired, undefined, command);
    else this.enqueueFork("card", command);
  }
  private enqueueFork(kind: "card" | "deck", first: CardForkCommand | DeckForkCommand, recovering?: SubmittedCreatorOperation) {
    const generation = this.deck.generation;
    const cardId = kind === "card" ? (first as CardForkCommand).source.cardTemplateId : (first as DeckForkCommand).cardFork?.source.cardTemplateId;
    const cardGeneration = cardId ? this.cards.get(cardId)!.generation : 0;
    let frozen: SubmittedCreatorOperation | null = recovering ?? null;
    this.deck.tasks.push(async () => {
      if (!this.journal) throw new CreatorRequestError(409, "CREATOR_RECOVERY_UNAVAILABLE");
      if (!frozen) {
        const command = clone(first);
        if (kind === "card") {
          const card = command as CardForkCommand;
          if (!this.deck.ack) throw conflict();
          card.attachTo = { deckTemplateId: this.deckTemplateId, revision: this.deck.ack.root.revision,
            nextDeckContent: { ...this.deckContent(this.deck.ack.content), cards: this.deckContent(this.deck.ack.content).cards.map((ref) =>
              ref.cardTemplateId === card.source.cardTemplateId ? { cardTemplateId: card.cardTemplateId } : ref) } };
        }
        frozen = { schema: 1, actor: this.session!.actor, sessionId: this.sessionId,
          sourceDeckId: this.session!.deck.kind === "foreign" ? this.session!.deck.source.deckTemplateId : this.session!.deck.owned.root.deckTemplateId,
          origin: this.origin, submittedAt: Date.now(), kind, command };
      }
      this.journal.write(frozen); this.submitted = frozen; this.creationAcknowledged = false;
      const command = frozen.command;
      const sourceId = kind === "deck" ? (command as DeckForkCommand).source.deckTemplateId : (command as CardForkCommand).source.cardTemplateId;
      const { source, ...body } = command;
      await this.request(`/api/${kind === "deck" ? "deck" : "card"}-templates/${encodeURIComponent(sourceId)}/fork`, "POST", { ...body, sourceVersion: source.version });
      if (kind === "deck") {
        this.deckTemplateId = (command as DeckForkCommand).deckTemplateId;
        for (const card of (command as DeckForkCommand).newCards ?? []) {
          const lane = this.cards.get(card.cardTemplateId)!;
          const ack = await this.request<CardAck>(`/api/card-templates/${encodeURIComponent(card.cardTemplateId)}`);
          if (ack.root.revision !== 0 || ack.root.latestVersion !== 0 || !sameContent(ack.content, card.content)) throw conflict();
          lane.accept(ack, 0); lane.creationPending = false; lane.kick();
        }
      }
      if (cardId) {
        const target = kind === "card" ? command as CardForkCommand : (command as DeckForkCommand).cardFork!;
        const lane = this.cards.get(cardId)!;
        const ack = this.normalizeCard(cardId, await this.request<CardAck>(`/api/card-templates/${encodeURIComponent(target.cardTemplateId)}`));
        if (ack.root.revision !== 0 || ack.root.latestVersion !== 0 || !sameContent(this.cardContent(cardId, ack.content), target.content)
          || intent(ack.root) !== (target.visibility ?? "private")) throw conflict();
        // Lineage changes persistence identity, never the board/pair keys or newer user edits.
        lane.desired = { ...lane.desired, steps: lane.desired.steps.map((step) => ({ ...step,
          forkedFrom: ack.content.steps.find((item) => item.stepId === step.stepId)?.forkedFrom })) };
        lane.accept(ack, cardGeneration); lane.creationPending = false; this.creatingCards.delete(cardId);
        if (lane.detached) this.request.allowDetachedCard?.(target.cardTemplateId);
      }
      const ack = await this.readDeck();
      const expected = kind === "deck" ? 0 : (command as CardForkCommand).attachTo!.revision + 1;
      if (ack.root.revision !== expected || kind === "deck" && ack.root.latestVersion !== 0) throw conflict();
      this.deckCreationQueued = false; this.recovering = false; this.creationAcknowledged = true; this.deck.accept(ack, generation);
      this.routeInstalled();
      if (cardId) this.cards.get(cardId)!.kick();
    });
    this.deck.creationPending = false; this.deck.kick(); this.changed();
  }
  recoverSubmitted() {
    if (this.submitted || this.deckCreationQueued || this.creatingCards.size) return false;
    const operation = this.journal?.read(); if (!operation) return false;
    if (operation.actor !== this.session?.actor) throw conflict();
    const command = operation.command;
    const card = operation.kind === "card" ? command as CardForkCommand : (command as DeckForkCommand).cardFork;
    // On an owned-route reload, the server session may already contain the exact
    // committed replacement. Prove it before clearing; never replay over edits.
    if (this.deck.ack && (operation.kind === "deck" || card && !this.foreignCards.has(card.source.cardTemplateId))) {
      this.recovering = true;
      const deckCommand = operation.kind === "deck" ? command as DeckForkCommand : null;
      const expectedContent = deckCommand ? { ...deckCommand.content, cards: deckCommand.content.cards.map((ref) =>
        ref.cardTemplateId === card?.source.cardTemplateId ? { cardTemplateId: card.cardTemplateId } : ref) } : card!.attachTo?.nextDeckContent;
      const expectedRevision = deckCommand ? 0 : card!.attachTo!.revision + 1;
      if (!expectedContent || this.deckTemplateId !== (deckCommand?.deckTemplateId ?? card!.attachTo?.deckTemplateId)
        || this.deck.ack.root.revision !== expectedRevision || !sameContent(this.deck.ack.content, expectedContent)
        || deckCommand && (this.deck.ack.root.latestVersion !== 0 || !sameContent(this.deck.ack.root.forkedFrom, deckCommand.source)
          || !sameContent(this.deck.ack.root.forkContext, deckCommand.context)
          || !sameContent(this.deck.ack.root.foreignCardSelections, deckCommand.foreignCardSelections)
          || intent(this.deck.ack.root) !== (deckCommand.visibility ?? "private"))) throw conflict();
      for (const expected of [...(card ? [card] : []), ...(deckCommand?.newCards ?? [])]) {
        const ack = this.cards.get(expected.cardTemplateId)?.ack;
        if (!ack || ack.root.revision !== 0 || ack.root.latestVersion !== 0 || !sameContent(ack.content, expected.content)) throw conflict();
      }
      if (card) {
        const root = this.cards.get(card.cardTemplateId)!.ack!.root;
        if (!sameContent(root.forkedFrom, card.source) || !("forkContext" in root) || !sameContent(root.forkContext, card.context)
          || !sameContent(root.stepIds, card.stepIds) || intent(root) !== (card.visibility ?? "private")) throw conflict();
      }
      this.submitted = operation; this.creationAcknowledged = true;
      this.routeInstalled(); this.recovering = false;
      return false;
    }
    if (card) {
      const id = card.source.cardTemplateId, lane = this.cards.get(id);
      if (!lane || !this.foreignCards.has(id)) throw conflict();
      this.targets.set(id, { id: card.cardTemplateId, steps: new Map(card.content.steps.map((step) => [step.forkedFrom!.stepId, step.stepId])) });
      const reverse = new Map([...this.targets.get(id)!.steps].map(([a,b]) => [b,a]));
      lane.desired = { ...clone(card.content), steps: card.content.steps.map((step) => ({ ...step, stepId: reverse.get(step.stepId)! })) };
      this.creatingCards.add(id);
    }
    if (operation.kind === "deck") {
      this.deck.desired = clone((command as DeckForkCommand).content); this.deckCreationQueued = true;
      for (const card of (command as DeckForkCommand).newCards ?? []) {
        const lane = this.makeCard(card.cardTemplateId, card.content, null); lane.creationPending = true; this.attached.add(card.cardTemplateId);
      }
    }
    this.origin = operation.origin; this.recovering = true;
    this.enqueueFork(operation.kind, command, operation);
    return true;
  }
  private get deckURL() { return `/api/deck-templates/${encodeURIComponent(this.deckTemplateId)}`; }
  private cardURL(id: string) { return `/api/card-templates/${encodeURIComponent(this.cardIdentity(id))}`; }
  private changed = () => { for (const listener of this.listeners) listener(); };
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  get dto(): CreatorDTO | null {
    return this.deck.ack ? { ...this.deck.ack, cards: [...this.attached].flatMap((id) => this.cards.get(id)?.ack ? [this.cards.get(id)!.ack!] : []) } : null;
  }
  private makeCard(id: string, content: CardContent, ack: CardAck | null) {
    const lane = new EntityLane(content, ack, this.changed,
      async (content, revision, visibility) => this.normalizeCard(id, await this.request(this.cardURL(id), "PATCH", { type: "save", content: this.cardContent(id, content), revision, visibility })), async () => this.normalizeCard(id, await this.request(this.cardURL(id))), (version) => this.request(this.cardURL(id) + `?version=${version}`));
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
  editDeck(content: DeckContent) { if (this.deckSource && !this.deck.ack) { this.deck.set(content); this.queueForeignDeck(content); }
    else { this.ensureInitial(content); this.deck.set(content); this.deck.kick(); } }
  setDeckVisibility(visibility: Visibility) {
    if (visibility === this.deck.desiredVisibility) return;
    if (this.deckSource && !this.deck.ack) { this.deck.setVisibility(visibility); this.queueForeignDeck(this.deck.desired, visibility); }
    else { this.ensureInitial(this.deck.desired); this.deck.setVisibility(visibility); this.deck.kick(); }
  }
  setCardVisibility(id: string, visibility: Visibility) {
    const lane = this.cards.get(id); if (!lane) throw new Error("Unknown Card identity"); lane.setVisibility(visibility);
    if (this.foreignCards.has(id) && !lane.ack) this.queueForeignCard(id, lane.desired, visibility);
  }
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
    if (this.foreignCards.has(id) && !lane.ack) this.queueForeignCard(id, content);
  }
  addCard(id: string, stepIds: string[], nextDeck: DeckContent) {
    const defaults = createDefaultCardContent(stepIds), lane = this.makeCard(id, defaults, null);
    lane.creationPending = true; this.attached.add(id);
    if (this.deckSource && !this.deck.ack && !this.deckCreationQueued) this.queueForeignDeck(nextDeck, undefined, undefined, [{ cardTemplateId: id, content: defaults }]);
    else if (!this.deck.ack && !this.initialQueued && !this.deckSource) this.ensureInitial(nextDeck, [{ cardTemplateId: id, content: defaults }]);
    else {
      let command: { revision: number; cardTemplateId: string; stepIds: string[]; content: DeckContent } | null = null;
      this.deck.tasks.push(async () => {
        if (!command) command = { revision: this.deck.ack!.root.revision, cardTemplateId: id, stepIds,
          content: this.deckContent({ ...clone(nextDeck), cards: nextDeck.cards.filter((ref) => ref.cardTemplateId === id || this.cards.get(ref.cardTemplateId)?.ack || this.foreignCards.has(ref.cardTemplateId)) }) };
        const result = await this.request<{ deck: DeckAck; card: CardAck }>(this.deckURL + "/cards", "POST", command);
        if (result.deck.root.revision !== command.revision + 1 || !sameContent(result.deck.content, command.content)) throw conflict();
        this.deck.accept(this.normalizeDeck(result.deck), this.deck.acknowledgedGeneration);
        lane.accept(result.card, 0); lane.creationPending = false; lane.kick();
      });
    }
    this.deck.set(nextDeck); this.deck.kick(); this.changed();
  }
  detachCard(id: string, nextDeck: DeckContent) {
    this.attached.delete(id); const lane = this.cards.get(id); if (lane) { lane.detached = true; this.request.allowDetachedCard?.(this.cardIdentity(id)); }
    // TODO: expose recovery for detached independent Card drafts in a later UI.
    this.editDeck(nextDeck); this.changed();
  }
  async ensureCardCreated(id: string) {
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
  }
  async flushCard(id: string) {
    if (this.foreignCards.has(id) && !this.cards.get(id)!.ack && !this.creatingCards.has(id)) return;
    await this.ensureCardCreated(id);
    await this.cards.get(id)!.flush();
  }
  async flushAll() {
    if (this.deckSource && !this.deck.ack && !this.deck.tasks.length && !this.deck.running) {
      await Promise.all([...this.attached].filter((id) => this.cards.get(id)!.ack).map((id) => this.flushCard(id))); return;
    }
    if (!this.deck.ack && !this.initialQueued && !this.deckSource) return; // untouched local session
    await Promise.all([this.deck.flush(), ...[...this.attached].filter((id) => !this.foreignCards.has(id) || !!this.cards.get(id)!.ack || this.creatingCards.has(id)).map((id) => this.flushCard(id))]);
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
      return [id, !!saved && !lane.error && !lane.publishing && cardPublicationIssue(saved.root.latestVersion, saved.root.draft, saved.publishedContent, saved.root) === null];
    }));
    return { deck: !!deck && !this.deck.error && !this.deck.publishing && deckPublicationIssue(deck.root.latestVersion, deck.root.draft, deck.publishedContent, roots, deck.root) === null,
      cards, any: this.hasWork() };
  }
  hasWork() {
    if (!this.deck.ack && !this.initialQueued && !this.deck.tasks.length && !this.deck.running)
      return [...this.cards.values()].some((lane) => !!lane.ack && (lane.dirty || !!lane.running || !!lane.ack.root.draft || lane.pendingOperations > 0));
    return this.deck.dirty || this.deck.running !== null || this.deck.uncertainSaves.length > 0 || !!this.deck.uncertainPublication || this.deck.pendingOperations > 0 || this.deck.tasks.length > 0 || !!this.deck.ack?.root.draft || [...this.attached].some((id) => {
      const lane = this.cards.get(id)!; return (!this.foreignCards.has(id) || !!lane.ack || this.creatingCards.has(id)) && (lane.dirty || lane.running !== null || lane.uncertainSaves.length > 0 || !!lane.uncertainPublication || lane.pendingOperations > 0 || !!lane.ack?.root.draft);
    });
  }
  private publicReview(cardIds: string[], includeDeck: boolean): PublicPublicationReview {
    const firstPublic = <C, A extends Ack<C>>(lane: EntityLane<C, A>) => !!lane.ack?.root.draft && lane.ack.root.visibility !== "public" && intent(lane.ack.root) === "public";
    return { cards: cardIds.flatMap((id) => {
      const lane = this.cards.get(id)!;
      return firstPublic(lane) ? [{ cardTemplateId: id, revision: lane.ack!.root.revision, generation: lane.generation }] : [];
    }), deck: includeDeck && firstPublic(this.deck)
      ? { deckTemplateId: this.deckTemplateId, revision: this.deck.ack!.root.revision, generation: this.deck.generation } : null };
  }
  private async approvePublic(review: PublicPublicationReview, confirm: ConfirmPublicPublication) {
    if (!review.cards.length && !review.deck) return true;
    if (!await confirm(clone(review))) return false;
    if (!sameContent(review, this.publicReview(review.cards.map((card) => card.cardTemplateId), review.deck !== null))) {
      throw new CreatorRequestError(409, "PUBLIC_PUBLICATION_REVIEW_CHANGED");
    }
    return true;
  }
  async publishCard(id: string, note?: string, confirmPublic: ConfirmPublicPublication = cancelPublicPublication) {
    await this.flushCard(id); const lane = this.cards.get(id)!; await lane.acquire(); lane.publishing = true; this.changed();
    try {
      const ack = lane.ack!, issue = cardPublicationIssue(ack.root.latestVersion, ack.root.draft, ack.publishedContent, ack.root);
      if (issue === "NO_UNPUBLISHED_CHANGES") return true;
      if (issue) throw new CreatorRequestError(400, issue);
      if (!await this.approvePublic(this.publicReview([id], false), confirmPublic)) return false;
      const generation = lane.acknowledgedGeneration;
      const result = await this.publishSafely(lane, () => this.request<CardAck>(this.cardURL(id), "PATCH", { type: "publish", revision: ack.root.revision, updateNote: note }).then((result) => this.normalizeCard(id, result)), note);
      lane.accept(result, generation);
      return true;
    } finally { lane.release(); }
  }
  private async publishSafely<C, A extends Ack<C>>(lane: EntityLane<C, A>, publish: () => Promise<A>, note?: string): Promise<A> {
    const before = clone(lane.ack!);
    lane.uncertainPublication = { before, generation: lane.acknowledgedGeneration, note: note?.trim() || undefined };
    try {
      const result = await publish();
      if (result.root.latestVersion !== before.root.latestVersion + 1 || result.root.revision !== before.root.revision + 1 || !sameContent(result.publishedContent, before.content)
        || before.root.visibility && result.root.visibility !== publicationVisibility(before.root as PublicationVisibility)) throw conflict();
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
  async publishDeck(note: string | undefined, confirm: (ids: string[]) => Promise<boolean>, confirmPublic: ConfirmPublicPublication = cancelPublicPublication) {
    await this.deck.acquire(); this.deck.publishing = true; this.changed();
    try {
      const ack = this.deck.ack!;
      if (!ack.root.draft) return true;
      const review = await this.request<DeckPublicationReview>(this.deckURL + `/publish?revision=${ack.root.revision}`);
      const warning = this.warningCards(review), fingerprint = this.reviewFingerprint(review);
      if (warning.length && !await confirm(warning)) return false;
      if (!await this.approvePublic(this.publicReview([], true), confirmPublic)) return false;
      if (fingerprint !== this.reviewFingerprint(review)) throw new CreatorRequestError(409, "DECK_PUBLICATION_REVIEW_CONFLICT");
      const result = await this.publishSafely(this.deck, () => this.request<CreatorDTO>(this.deckURL + "/publish", "POST", {
        revision: ack.root.revision, review, acceptCardDrafts: warning.length > 0, updateNote: note }), note);
      this.deck.accept(result, this.deck.acknowledgedGeneration); return true;
    } catch (error) {
      if (error instanceof CreatorRequestError && error.code === "STALE_REVISION") { this.deck.error = failure(error); this.changed(); }
      throw error;
    } finally { this.deck.release(); }
  }
  async publishAndLeave(notes: Record<string, string>, confirm: (ids: string[]) => Promise<boolean>, confirmPublic: ConfirmPublicPublication = cancelPublicPublication) {
    await this.waitForUploads(); await this.flushAll();
    const approved = this.publicReview([...this.attached], true);
    if (!await this.approvePublic(approved, confirmPublic)) return false;
    // One confirmation covers the exact saved generations. A later change must
    // stop rather than quietly becoming part of that approval. Successful public
    // publications disappear from the next attempt's first-public review.
    const confirmed: ConfirmPublicPublication = async (review) => {
      if (review.cards.some((card) => !approved.cards.some((item) => sameContent(item, card)))
        || review.deck && !sameContent(review.deck, approved.deck)) throw new CreatorRequestError(409, "PUBLIC_PUBLICATION_REVIEW_CHANGED");
      return true;
    };
    for (const id of this.attached) if (this.cards.get(id)!.ack?.root.draft && !await this.publishCard(id, notes[id], confirmed)) return false;
    if (this.deck.ack?.root.draft && !await this.publishDeck(notes.deck, confirm, confirmed)) return false;
    await this.flushAll();
    return !this.hasWork();
  }
  async move(sourceId: string, destinationId: string, sourceIndex: number, destinationIndex: number) {
    if (this.deckSource || [sourceId, destinationId].some((id) => this.foreignCards.has(id))) throw new CreatorRequestError(400, "CROSS_CARD_MOVE_AFTER_PUBLICATION");
    if ([sourceId, destinationId].some((id) => this.reusedCards.has(id) || this.cards.get(id)?.ack?.root.firstReusedAt)) throw new CreatorRequestError(400, "CROSS_CARD_MOVE_AFTER_REUSE");
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
