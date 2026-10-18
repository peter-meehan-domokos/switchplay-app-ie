import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CreatorPersistenceCoordinator, CreatorRequestError, EntityLane, type CreatorTransport, type PublicPublicationReview } from "../src/components/creator/creatorPersistenceCoordinator";
import { blankPrivateBoard, creatorBoard } from "../src/components/creator/cardArchitectureAdapter";
import CreatorVisibilityControl from "../src/components/creator/CreatorVisibilityControl";
import CreatorPublicConfirmation from "../src/components/creator/CreatorPublicConfirmation";
import { cardPublicationPresentation, deckPublicationPresentation } from "../src/components/creator/creatorPublicationPresentation";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { publicationVisibility, sameContent } from "../src/lib/cards/publicationRules";
import type { CreatorDTO } from "../src/lib/cards/readModels";
import type { Visibility } from "../src/lib/cards/model";

const copy = <T>(value: T): T => structuredClone(value);
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
function gate<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function ack(content: { text: string }, revision = 0, visibility: Visibility = "private", draftVisibility?: Visibility) {
  return { root: { ownerUserId: "alice", revision, latestVersion: 1, visibility, ...(draftVisibility ? { draftVisibility } : {}), draft: content }, content, publishedContent: content };
}
function harness() {
  const now = new Date(), base = { ownerUserId: "alice", visibility: "private" as Visibility, latestVersion: 1, revision: 1, forkedFrom: null, createdAt: now, updatedAt: now };
  const content = { ...createDefaultDeckContent(["t1", "t2", "t3"]), title: "Programme", cards: [{ cardTemplateId: "a" }, { cardTemplateId: "b" }] };
  const dto: CreatorDTO = { root: { ...base, deckTemplateId: "deck", draft: null }, content, publishedContent: copy(content),
    cards: ["a", "b"].map((id) => { const content = createDefaultCardContent([`${id}-1`, `${id}-2`, `${id}-3`]); content.intro.title = id;
      return { root: { ...base, cardTemplateId: id, stepIds: content.steps.map((step) => step.stepId), draft: null }, content, publishedContent: copy(content) }; }) };
  const calls: { url: string; body: Record<string, unknown> }[] = [], receipts = new Map<string, unknown>();
  let intercept: ((url: string, body: Record<string, unknown>) => Promise<void>) | undefined;
  let loseSave = false, losePublish = false;
  const request: CreatorTransport = async <T>(url: string, method = "GET", body?: unknown): Promise<T> => {
    const data = body as Record<string, unknown>; calls.push({ url, body: data });
    const id = url.includes("card-templates") ? url.split("?")[0].split("/").at(-1)! : "deck";
    const entity = id === "deck" ? dto : dto.cards.find((card) => card.root.cardTemplateId === id)!;
    const root = entity.root as typeof entity.root & { draftVisibility?: Visibility };
    if (url.includes("?version=")) return copy(receipts.get(id)) as T;
    if (method === "GET" && url.includes("/publish?revision=")) {
      if (publicationVisibility(dto.root) === "public" && dto.cards.some((card) => card.root.visibility !== "public")) throw new CreatorRequestError(400, "PRIVATE_CARDS_BLOCK_PUBLIC_DECK");
      return { deckTemplateId: "deck", revision: dto.root.revision, cards: dto.cards.map((card) => ({ cardTemplateId: card.root.cardTemplateId, revision: card.root.revision,
        latestVersion: card.root.latestVersion, hasDraft: !!card.root.draft })) } as T;
    }
    if (method === "GET") return copy(entity) as T;
    await intercept?.(url, data);
    if (data.revision !== entity.root.revision) throw new CreatorRequestError(409, "STALE_REVISION");
    if (data.type === "save" || url.endsWith("/saved")) {
      entity.content = copy(data.content) as never;
      const visibility = data.visibility as Visibility;
      if (visibility !== entity.root.visibility) root.draftVisibility = visibility;
      else delete root.draftVisibility;
      entity.root.draft = sameContent(entity.content, entity.publishedContent) && visibility === entity.root.visibility ? null : copy(entity.content) as never;
      entity.root.revision++;
      if (loseSave) { loseSave = false; throw new Error("lost response"); }
    } else {
      entity.root.visibility = publicationVisibility(entity.root); delete root.draftVisibility;
      entity.root.latestVersion++; entity.root.revision++; entity.root.draft = null; entity.publishedContent = copy(entity.content) as never;
      receipts.set(id, { version: entity.root.latestVersion, content: copy(entity.content), visibility: entity.root.visibility, publishedByUserId: "alice" });
      if (losePublish) { losePublish = false; throw new Error("lost publication response"); }
    }
    return copy(entity) as T;
  };
  const coordinator = new CreatorPersistenceCoordinator(creatorBoard(dto), copy(dto), request);
  return { dto, coordinator, calls, intercept(fn: typeof intercept) { intercept = fn; }, loseSave() { loseSave = true; }, losePublish() { losePublish = true; } };
}

test("visibility and content coalesce in one lane without an old acknowledgement replacing newer intent", async () => {
  let remote = ack({ text: "old" }), active = 0, maxActive = 0; const held = gate<void>(), writes: unknown[] = [];
  const lane = new EntityLane(remote.content, remote, () => {}, async (content, revision, visibility) => {
    active++; maxActive = Math.max(maxActive, active); writes.push({ content, visibility });
    if (writes.length === 1) await held.promise;
    remote = ack(content, revision + 1, "private", visibility); active--; return copy(remote);
  }, async () => copy(remote));
  lane.set({ text: "first" }); await turn(); lane.setVisibility("public"); lane.set({ text: "newest" });
  assert.equal(lane.generation, 3); held.resolve(); await lane.flush();
  assert.equal(maxActive, 1); assert.deepEqual(writes, [{ content: { text: "first" }, visibility: "private" }, { content: { text: "newest" }, visibility: "public" }]);
  assert.equal(lane.desiredVisibility, "public"); assert.equal(lane.ack!.root.visibility, "private"); assert.equal(lane.ack!.root.draftVisibility, "public");
  assert.equal(lane.dirty, false); assert.equal(lane.acknowledgedGeneration, 3);
});

test("bounded visibility retry uses the newest desired content and intent", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const initial = ack({ text: "old" }); let fail = true; const attempts: Visibility[] = [];
  const lane = new EntityLane(initial.content, initial, () => {}, async (content, revision, visibility) => {
    attempts.push(visibility); if (fail) throw new Error("network"); return ack(content, revision + 1, "private", visibility);
  }, async () => copy(initial));
  lane.setVisibility("public"); await turn(); lane.setVisibility("private"); lane.set({ text: "latest" });
  fail = false; t.mock.timers.tick(1000); await lane.flush();
  assert.deepEqual(attempts, ["public", "private"]); assert.equal(lane.ack!.content.text, "latest"); assert.equal(lane.desiredVisibility, "private");
});

test("visibility-only uncertain save is reconciled by revision AND intent before later edits", async () => {
  const h = harness(); h.loseSave(); h.coordinator.setCardVisibility("a", "public"); await h.coordinator.flushCard("a");
  assert.equal(h.calls.filter((call) => call.body?.type === "save").length, 1);
  assert.equal(publicationVisibility(h.coordinator.cards.get("a")!.ack!.root), "public");
  assert.equal(h.dto.cards[0].root.visibility, "private");
  assert.equal(h.coordinator.cards.get("b")!.generation, 0); assert.equal(h.coordinator.deck.generation, 0);
});

test("same content at a different visibility cannot prove a lost save outcome", async () => {
  const initial = ack({ text: "same" }); let remote = copy(initial);
  const lane = new EntityLane(initial.content, initial, () => {}, async () => { remote = ack(initial.content, 1); throw new Error("lost response"); }, async () => copy(remote));
  lane.setVisibility("public"); await assert.rejects(lane.flush(), /RECOVERY_REVISION_CONFLICT/);
  assert.equal(lane.error?.kind, "conflict"); assert.equal(lane.desiredVisibility, "public");
});

test("a concurrent publication cannot be mistaken for a visibility-only save acknowledgement", async () => {
  const initial = ack({ text: "same" }); const published = { ...initial, root: { ...initial.root, visibility: "public" as const, latestVersion: 2, revision: 1 } };
  const lane = new EntityLane(initial.content, initial, () => {}, async () => { throw new Error("lost response"); }, async () => copy(published));
  lane.setVisibility("public"); await assert.rejects(lane.flush(), /RECOVERY_REVISION_CONFLICT/);
  assert.equal(lane.desiredVisibility, "public"); assert.equal(lane.ack!.root.latestVersion, 1);
});

test("visibility rejection retains local intent without blindly retrying", async () => {
  const initial = ack({ text: "same" }); let writes = 0;
  const lane = new EntityLane(initial.content, initial, () => {}, async () => { writes++; throw new CreatorRequestError(403, "FORBIDDEN"); }, async () => copy(initial));
  lane.setVisibility("public"); await assert.rejects(lane.flush());
  assert.equal(writes, 1); assert.equal(lane.error?.kind, "rejected"); assert.equal(lane.desiredVisibility, "public");
});

test("visibility edit on untouched Deck creates a stable private root before saving public intent", async () => {
  const board = blankPrivateBoard(), writes: string[] = []; let dto: CreatorDTO;
  const request: CreatorTransport = async <T>(url: string, method?: string, body?: unknown) => {
    writes.push(`${method} ${url}`); const data = body as { content: CreatorDTO["content"]; visibility: Visibility };
    if (method === "POST") dto = { root: { deckTemplateId: board.deckTemplateId, ownerUserId: "alice", visibility: "private", latestVersion: 0,
      revision: 0, draft: data.content, forkedFrom: null, createdAt: new Date(), updatedAt: new Date() }, content: data.content, publishedContent: null, cards: [] };
    else { dto.root.revision++; dto.root.draftVisibility = data.visibility; }
    return copy(dto) as T;
  };
  const c = new CreatorPersistenceCoordinator(board, null, request); c.setDeckVisibility("public"); await c.prepareToNavigate();
  assert.deepEqual(writes, ["POST /api/deck-templates", `PATCH /api/deck-templates/${board.deckTemplateId}/saved`]);
  assert.equal(c.deck.ack!.root.visibility, "private"); assert.equal(c.deck.ack!.root.draftVisibility, "public");
});

test("first-public Card confirmation can cancel; success is irreversible and subsequent publications do not warn", async () => {
  const h = harness(), c = h.coordinator; c.setCardVisibility("a", "public"); const reviews: PublicPublicationReview[] = [];
  assert.equal(await c.publishCard("a", undefined, async (review) => { reviews.push(review); return false; }), false);
  assert.equal(h.dto.cards[0].root.latestVersion, 1); assert.equal(h.dto.cards[0].root.visibility, "private");
  assert.equal(await c.publishCard("a", undefined, async (review) => { reviews.push(review); return true; }), true);
  assert.equal(reviews.length, 2); assert.equal(reviews[0].cards.length, 1); assert.equal(reviews[0].deck, null);
  assert.throws(() => c.setCardVisibility("a", "private"), /PUBLIC_VISIBILITY_PERMANENT/);
  const lane = c.cards.get("a")!; c.editCard("a", { ...lane.desired, suggestedTargetDate: "2026-10-08" });
  await c.publishCard("a", undefined, async () => { throw new Error("unexpected repeat warning"); });
  assert.equal(h.dto.cards[0].root.latestVersion, 3);
});

test("confirmation invalidates on a newer edit without losing it or publishing it", async () => {
  const h = harness(), c = h.coordinator; c.setCardVisibility("a", "public");
  await assert.rejects(c.publishCard("a", undefined, async () => { c.editCard("a", { ...c.cards.get("a")!.desired, suggestedTargetDate: "2026-12-01" }); return true; }), /PUBLIC_PUBLICATION_REVIEW_CHANGED/);
  await c.flushCard("a"); assert.equal(h.dto.cards[0].root.latestVersion, 1); assert.equal(h.dto.cards[0].content.suggestedTargetDate, "2026-12-01");
});

test("Publish and leave flushes pending visibility, confirms exact public counts, and publishes Cards before Deck", async () => {
  const h = harness(), c = h.coordinator, held = gate<void>(); h.intercept(async (_url, body) => { if (body?.type === "save") await held.promise; });
  c.setCardVisibility("a", "public"); c.setCardVisibility("b", "public"); c.setDeckVisibility("public");
  const reviews: PublicPublicationReview[] = [];
  const pending = c.publishAndLeave({}, async () => true, async (review) => { reviews.push(review); return true; });
  await turn(); assert.equal(reviews.length, 0); held.resolve(); assert.equal(await pending, true);
  assert.equal(reviews.length, 1); assert.equal(reviews[0].cards.length, 2); assert.equal(reviews[0].deck?.deckTemplateId, "deck");
  assert.deepEqual(h.calls.filter((call) => call.body?.type === "publish" || call.url.endsWith("/publish")).map((call) => call.url),
    ["/api/card-templates/a", "/api/card-templates/b", "/api/deck-templates/deck/publish"]);
  assert.equal(c.hasWork(), false);
});

test("Publish and leave cancellation publishes nothing; a private Card is never promoted for the Deck", async () => {
  const h = harness(), c = h.coordinator; c.setDeckVisibility("public");
  assert.equal(await c.publishAndLeave({}, async () => true, async () => false), false);
  assert.equal(h.dto.root.visibility, "private"); assert.equal(h.dto.cards[0].root.visibility, "private");
  await assert.rejects(c.publishAndLeave({}, async () => true, async () => true), /PRIVATE_CARDS_BLOCK_PUBLIC_DECK/);
  assert.equal(h.dto.cards[0].root.revision, 1); assert.equal(h.dto.root.latestVersion, 1);
});

test("partial public success is retained; retry counts only remaining first-public entities", async () => {
  const h = harness(), c = h.coordinator; c.setCardVisibility("a", "public"); c.setCardVisibility("b", "public"); c.setDeckVisibility("public");
  const reviews: PublicPublicationReview[] = []; h.intercept(async (url, body) => { if (url.endsWith("/b") && body?.type === "publish") throw new CreatorRequestError(400, "TEST_PUBLICATION_FAILURE"); });
  await assert.rejects(c.publishAndLeave({}, async () => true, async (review) => { reviews.push(review); return true; }), /TEST_PUBLICATION_FAILURE/);
  assert.equal(h.dto.cards[0].root.latestVersion, 2); assert.equal(h.dto.root.visibility, "private");
  h.intercept(undefined); assert.equal(await c.publishAndLeave({}, async () => true, async (review) => { reviews.push(review); return true; }), true);
  assert.deepEqual(reviews.map((review) => review.cards.map((card) => card.cardTemplateId)), [["a", "b"], ["b"]]);
  assert.equal(h.dto.cards[0].root.latestVersion, 2);
});

test("lost response after visibility-only publication reconciles exact public version without republishing", async () => {
  const h = harness(), c = h.coordinator; c.setCardVisibility("a", "public"); h.losePublish();
  assert.equal(await c.publishCard("a", undefined, async () => true), true);
  assert.equal(c.cards.get("a")!.ack!.root.visibility, "public"); assert.equal(c.cards.get("a")!.dirty, false);
  assert.equal(h.calls.filter((call) => call.body?.type === "publish").length, 1);
  await c.publishCard("a", undefined, async () => { throw new Error("reconfirmed recovered publication"); });
  assert.equal(h.dto.cards[0].root.latestVersion, 2);
});

test("unsaved visibility changes are outstanding immediately, and default controls remain hidden until work exists", async () => {
  const h = harness(), card = h.coordinator.cards.get("a")!; card.locked = true; card.setVisibility("public");
  assert.equal(cardPublicationPresentation(card).outstanding, true); assert.equal(cardPublicationPresentation(card).cleanPublished, false);
  const deck = h.coordinator.deck; deck.locked = true; deck.setVisibility("public");
  assert.equal(deckPublicationPresentation(deck, h.dto.cards.map((card) => card.root)).outstanding, true);
  card.release(); deck.release();
  await h.coordinator.flushAll();
});

test("visibility control describes next-publication intent and disables public demotion; confirmation gives counts", () => {
  const html = renderToStaticMarkup(createElement(CreatorVisibilityControl, { label: "Deck", value: "public", publishedPublic: true, onChange: () => {} }));
  assert.match(html, /aria-label="Deck publication visibility"/); assert.match(html, /disabled=/); assert.match(html, /permanent/);
  const confirmation = renderToStaticMarkup(createElement(CreatorPublicConfirmation, { review: { cards: [{ cardTemplateId: "a", revision: 1, generation: 1 }], deck: { deckTemplateId: "d", revision: 1, generation: 1 } }, onConfirm: () => {}, onCancel: () => {} }));
  assert.match(confirmation, /1 Card and 1 Deck/); assert.match(confirmation, /cannot be made private again/);
});
