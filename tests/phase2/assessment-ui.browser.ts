import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import { build } from "esbuild";
import { CardRepository } from "../../src/lib/cards/repository";
import { cardFixture, deckFixture } from "../fixtures/frameworks";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import type { AssessmentContext } from "../../src/components/assessments/useAssessmentHistory";
import { geometry } from "./helpers/presentationGeometry";
import { itemFixtureRoutes } from "./helpers/assessmentFixtureRoutes";
import { createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../../src/lib/cards/forks";
import { initialCardData } from "../../src/lib/cards/domain";
import type { Framework } from "../../src/lib/frameworks/configuration";
import type { AssessmentHistory } from "../../src/lib/assessments/history";
let bundle: string;
test.beforeAll(async () => { bundle = (await build({ entryPoints: ["tests/fixtures/assessmentHarness.tsx"], bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: "tsconfig.json", define: { "process.env.NODE_ENV": '"development"' } })).outputFiles[0].text; });
async function harness(page: Page, contexts: AssessmentContext[]) {
  await page.goto("/library");
  const styles = await page.evaluate(() => Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).map((node) => node.outerHTML).join(""));
  await page.route("**/__assessment-fixture", (route) => route.fulfill({ contentType: "text/html", body: `<html><head>${styles}</head><body><div id="fixture"></div></body></html>` }));
  await page.goto("/__assessment-fixture"); await page.addScriptTag({ content: bundle });
  await page.evaluate((contexts) => (window as unknown as { mountAssessmentFixture: (contexts: AssessmentContext[]) => void }).mountAssessmentFixture(contexts), contexts);
}
async function fixture(page: Page, isolatedActor = false) {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client);
  const actor = isolatedActor ? new ObjectId().toHexString() : process.env.PHASE2_USER_ID!;
  const identifier = isolatedActor ? `acceptance-${randomUUID()}` : "phase2";
  if (isolatedActor) {
    const user = { _id: new ObjectId(actor), username: identifier, email: `${identifier}@example.invalid`,
      passwordHash: hashSync("local-test-only", 4), decksData: [], cardsData: [], createdAt: new Date(), updatedAt: new Date() };
    await repo.users().insertOne(user);
  }
  const source = cardFixture(randomUUID()), b = cardFixture(randomUUID(), source.root.cardTemplateId), c = cardFixture(randomUUID(), b.root.cardTemplateId);
  const deck = deckFixture(randomUUID(), [source.root.cardTemplateId, b.root.cardTemplateId, c.root.cardTemplateId]);
  const title = `Assessment journey ${deck.root.deckTemplateId}`;
  deck.root.ownerUserId = actor; deck.root.draft!.title = title; deck.version.content.title = title;
  for (const card of [source, b, c]) { card.root.ownerUserId = actor; card.version.content.intro.title = "Shared practice"; card.root.draft!.intro.title = "Shared practice"; }
  await repo.cards().insertMany([source.root, b.root, c.root]); await repo.cardVersions().insertMany([source.version, b.version, c.version]);
  await repo.decks().insertOne(deck.root); await repo.deckVersions().insertOne(deck.version); await repo.ensureDeckData(actor, deck.root.deckTemplateId, 1);
  const tests = [0, 1, 2, 3].map((n) => ({ id: randomUUID(), date: `2026-10-${String(n + 5).padStart(2, "0")}`, result: n % 2 === 0, createdAt: new Date(`2026-10-${String(n + 5).padStart(2, "0")}T10:00:00Z`) }));
  await repo.users().updateOne({ _id: new ObjectId(actor) }, { $set: { "cardsData.$[source].tests": tests,
    "cardsData.$[b].historySourceCardTemplateId": source.root.cardTemplateId, "cardsData.$[c].historySourceCardTemplateId": b.root.cardTemplateId } },
    { arrayFilters: [{ "source.cardTemplateId": source.root.cardTemplateId }, { "b.cardTemplateId": b.root.cardTemplateId }, { "c.cardTemplateId": c.root.cardTemplateId }] });
  expect((await page.request.post("/api/auth/login", { data: { identifier, password: "local-test-only" } })).status()).toBe(200);
  const context = (id: string): AssessmentContext => ({ viewerUserId: actor, source: { kind: "card", cardTemplateId: id }, deckTemplateId: deck.root.deckTemplateId, canCreate: true });
  return { client, repo, actor, source, b, c, deck, tests, title, context };
}
const dialog = (page: Page) => page.getByRole("dialog", { name: "Assessment history", exact: true });
async function changeForm(page: Page, date: string, result: "Pass" | "Fail") { await dialog(page).getByLabel("Date", { exact: true }).fill(date); await dialog(page).getByLabel("Result", { exact: true }).selectOption({ label: result }); }

async function swipeHeader(page: Page, selector: string, direction: -1 | 1) {
  const rect = (await geometry(page, [selector]))[selector];
  await page.mouse.move(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2); await page.mouse.down();
  await page.mouse.move(rect[0] + rect[2] / 2 + direction * 220, rect[1] + rect[3] / 2, { steps: 12 }); await page.mouse.up();
}

test("connected assessments, actual fork publication, archived Framework summaries and Card updates preserve original sources", async ({ page }) => {
  // Other browser journeys deliberately retain broken memberships. This learner
  // starts independently so those faults cannot contaminate connected metrics.
  const f = await fixture(page, true);
  try {
    const sourceId = f.source.root.cardTemplateId, unmappedId = f.b.root.cardTemplateId;
    const bob = (await f.repo.users().findOne({ username: "other" }))!._id.toString();
    // Prepare published foreign content, an unrelated Card and retained orphan data.
    await f.repo.cards().updateOne({ cardTemplateId: sourceId }, { $set: { ownerUserId: bob, visibility: "public" } });
    await f.repo.cardVersions().updateOne({ cardTemplateId: sourceId, version: 1 }, { $set: { visibility: "public" } });
    await f.repo.cards().updateOne({ cardTemplateId: unmappedId }, { $set: { forkedFrom: null } });
    await f.repo.deckVersions().updateOne({ deckTemplateId: f.deck.root.deckTemplateId, version: 1 }, { $set: { "content.cards": f.deck.version.content.cards.slice(0, 2) } });
    await f.repo.users().updateOne({ _id: new ObjectId(f.actor) }, { $set: { "cardsData.$[source].tests": [] }, $unset: { "cardsData.$[other].historySourceCardTemplateId": "" } },
      { arrayFilters: [{ "source.cardTemplateId": sourceId }, { "other.cardTemplateId": unmappedId }] });
    const privateResult = { id: randomUUID(), date: "2026-10-30", result: false, createdAt: new Date() };
    const bobData = initialCardData(sourceId, 1, f.source.version.content, new Date()); bobData.tests = [privateResult];
    await f.repo.users().updateOne({ _id: new ObjectId(bob) }, { $push: { cardsData: bobData } });
    for (const [index, status] of ["done", "skipped", "todo"].entries()) {
      await f.repo.setCompletion(f.actor, f.deck.root.deckTemplateId, sourceId, f.source.version.content.steps[index].stepId, status as "done" | "skipped" | "todo");
      await f.repo.setCompletion(f.actor, f.deck.root.deckTemplateId, unmappedId, f.b.version.content.steps[index].stepId, "done");
    }
    for (const [index, reading] of [2.2, 7.8].entries()) await f.repo.setSignalReading(f.actor, f.deck.root.deckTemplateId, sourceId, f.source.version.content.steps[index].stepId, reading);
    const open = async (title: string) => { await page.goto("/decks"); await page.getByRole("button", { name: `Open ${title}`, exact: true }).last().click(); await expect(page.locator(".deck-card.is-active")).toBeVisible(); };
    await page.setViewportSize({ width: 390, height: 844 }); await open(f.title);
    await expect(page.locator(".detail-progress")).toHaveText("Completion 80%"); // Includes the unrelated Card.
    await page.locator(".deck-card.is-active").press("Enter");
    await swipeHeader(page, ".focused-card-surface--front .assessment-indicator", 1);
    const back = page.locator(".focused-card-surface--back .card-semantic-anchors");
    await back.getByRole("button", { name: "Add first test" }).click();
    await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await changeForm(page, "2026-10-10", "Pass");
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click(); await expect(dialog(page).locator("tbody tr")).toHaveCount(1);
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    const sourceEvent = (await f.repo.getPersonalUser(f.actor))!.cardsData.find((card) => card.cardTemplateId === sourceId)!.tests[0];

    const fork = async (id: string, content: typeof f.source.version.content, deckId: string, title: string) => {
      const targetId = randomUUID(), stepIds = [randomUUID(), randomUUID(), randomUUID()];
      const edited = forkCardContent(content, { cardTemplateId: id, version: 1 }, stepIds); edited.intro.title = title;
      const created = await page.request.post(`/api/card-templates/${id}/fork`, { data: { sourceVersion: 1, cardTemplateId: targetId, stepIds, content: edited, context: { kind: "my-decks", deckTemplateId: deckId } } });
      expect(created.status(), await created.text()).toBe(200);
      expect((await page.request.patch(`/api/card-templates/${targetId}`, { data: { type: "publish", revision: 0 } })).status()).toBe(200);
      return { id: targetId, content: edited };
    };
    const first = await fork(sourceId, f.source.version.content, f.deck.root.deckTemplateId, "Connected Card fork");
    const forkDeck = await f.repo.createDeckDraft(f.actor, { ...createDefaultDeckContent([]), title: `Connected forks ${randomUUID()}`, cards: [{ cardTemplateId: first.id }] });
    await f.repo.publishDeck(f.actor, forkDeck.deckTemplateId, 0);
    for (const step of first.content.steps) await f.repo.setCompletion(f.actor, forkDeck.deckTemplateId, first.id, step.stepId, "done");
    await f.repo.setSignalReading(f.actor, forkDeck.deckTemplateId, first.id, first.content.steps[0].stepId, 8);
    await f.repo.setSignalReading(f.actor, forkDeck.deckTemplateId, first.id, first.content.steps[1].stepId, null);
    const nested = await fork(first.id, first.content, forkDeck.deckTemplateId, "Connected nested fork");
    await f.repo.saveDeckDraft(f.actor, forkDeck.deckTemplateId, 1, { ...forkDeck.draft!, cards: [first.id, nested.id].map((cardTemplateId) => ({ cardTemplateId })) });
    await f.repo.publishDeck(f.actor, forkDeck.deckTemplateId, 2);
    const repeated = await f.repo.createDeckDraft(f.actor, { ...createDefaultDeckContent([]), title: `Repeated fork ${randomUUID()}`, cards: [{ cardTemplateId: nested.id }] });
    await f.repo.publishDeck(f.actor, repeated.deckTemplateId, 0);
    await f.repo.archiveDeckData(f.actor, repeated.deckTemplateId); await f.repo.archiveDeckData(f.actor, f.deck.root.deckTemplateId);
    const stored = (await f.repo.getPersonalUser(f.actor))!;
    expect(stored.cardsData.find((card) => card.cardTemplateId === first.id)!.tests).toEqual([]);
    expect(stored.cardsData.find((card) => card.cardTemplateId === nested.id)!.tests).toEqual([]);
    expect(stored.cardsData.find((card) => card.cardTemplateId === nested.id)!.historySourceCardTemplateId).toBe(first.id);

    const itemId = `connected-${randomUUID()}`, directOnlyId = `direct-only-${randomUUID()}`, alternativeItemId = `alternative-${randomUUID()}`;
    const frameworks: Framework[] = [{ id: "connected", title: "Connected", areas: [{ id: "practice", title: "Practice", items: [
      { id: itemId, title: "Mapped practice", cardTemplateIds: [sourceId] }, { id: directOnlyId, title: "Direct only", cardTemplateIds: [] }] }, { id: "empty", title: "Empty Area", items: [] }] },
    { id: "alternative", title: "Alternative", areas: [{ id: "different", title: "Different", items: [{ id: alternativeItemId, title: "Different mapping", cardTemplateIds: [sourceId] }] }] }];
    await itemFixtureRoutes(page, f.repo, f.actor, frameworks);
    const read = async <T,>(url: string): Promise<T> => page.evaluate(async ({ url, actor }) => {
      const response = await fetch(url, { headers: { "X-Personal-Viewer": actor }, cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`); return response.json();
    }, { url, actor: f.actor });
    type Summary = Awaited<ReturnType<typeof import("../../src/lib/frameworks/readModels").readFrameworkSummaries>>;
    const summary = () => read<Summary>("/api/frameworks/summary");
    const beforeReads = await f.repo.getPersonalUser(f.actor), metrics = await summary();
    expect(metrics.frameworks.map((framework) => framework.id)).toEqual(["connected", "alternative"]);
    const mapped = metrics.frameworks[0].areas[0].items[0];
    expect(mapped.progress).toMatchObject({ state: "complete", eligibleCardCount: 3, completion: 88, confidence: 7 }); // Rounded 7/8 underlying Steps.
    expect(metrics.frameworks[0].areas[0].progress).toEqual(mapped.progress);
    expect(metrics.frameworks[1].areas[0].items[0].progress).toEqual(mapped.progress);
    expect(mapped.assessments).toMatchObject({ count: 1, readableCount: 1 });
    expect(mapped.assessments.latestThree[0].id).toBe(sourceEvent.id);
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(beforeReads);

    // Publication and explicit adoption reorder stable Steps without losing state.
    const publishedContent = { ...f.source.version.content, intro: { ...f.source.version.content.intro, title: "Adopted source title" }, steps: [f.source.version.content.steps[2], f.source.version.content.steps[0], f.source.version.content.steps[1]] };
    await f.repo.saveCardDraft(bob, sourceId, 1, publishedContent); await f.repo.publishCard(bob, sourceId, 2, "Reordered stable Steps");
    const historyUrl = `/api/items-data/${itemId}/history`;
    let combined = (await read<{ history: AssessmentHistory }>(historyUrl)).history;
    expect(combined.results[0].sourceTitle).toBe("Shared practice");
    const review = await (await page.request.get(`/api/cards-data/${sourceId}/update`)).json();
    expect((await page.request.post(`/api/cards-data/${sourceId}/update`, { data: { command: review.review.command } })).status()).toBe(200);
    expect((await summary()).frameworks[0].areas[0].items[0].progress).toEqual(mapped.progress);
    combined = (await read<{ history: AssessmentHistory }>(historyUrl)).history; expect(combined.results[0].sourceTitle).toBe("Adopted source title");

    await open(forkDeck.draft!.title!); await page.locator(".deck-card.is-active").press("Enter");
    await swipeHeader(page, ".focused-card-surface--front .assessment-indicator", 1);
    await back.getByRole("button", { name: "Open assessment history" }).click();
    await expect(dialog(page).getByText("Source Card", { exact: true })).toHaveCount(1);
    await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await changeForm(page, "2026-10-15", "Pass");
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click(); await expect(dialog(page).locator("tbody tr")).toHaveCount(2);
    await dialog(page).getByRole("button", { name: "Edit test 2026-10-10 from Adopted source title", exact: true }).click(); await changeForm(page, "2026-10-16", "Fail");
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click(); await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await open(forkDeck.draft!.title!); await page.locator(".deck-card.is-active").press("Enter"); await swipeHeader(page, ".focused-card-surface--front .assessment-indicator", 1);
    await expect(back.locator(".assessment-indicator .assessment-pass, .assessment-indicator .assessment-fail")).toHaveText(["✓", "●"]);

    await harness(page, [itemId, directOnlyId].map((id) => ({ viewerUserId: f.actor, source: { kind: "item" as const, itemId: id }, canCreate: true })));
    for (const index of [1, 2]) {
      const region = page.getByRole("region", { name: `Assessment view ${index}` });
      await region.locator(".assessment-indicator").click(); await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await changeForm(page, "2026-10-12", "Fail");
      await dialog(page).getByRole("button", { name: "Save test", exact: true }).click(); await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    }
    combined = (await read<{ history: AssessmentHistory }>(historyUrl)).history;
    expect(combined.results.map((result) => result.date)).toEqual(["2026-10-16", "2026-10-15", "2026-10-12"]);
    expect(combined.results.filter((result) => result.id === sourceEvent.id)).toHaveLength(1);
    expect(combined.results.some((result) => result.id === privateResult.id)).toBe(false);
    expect(combined.latestThree.map((result) => result.result)).toEqual([false, true, false]);
    const withDirect = (await summary()).frameworks[0].areas[0].items;
    expect(withDirect[1].progress).toMatchObject({ state: "empty", completion: null, confidence: null }); expect(withDirect[1].assessments.count).toBe(1);
    expect(withDirect[0].progress).toEqual(mapped.progress);
    const after = (await f.repo.getPersonalUser(f.actor))!;
    expect(after.cardsData.find((card) => card.cardTemplateId === sourceId)!.tests).toMatchObject([{ id: sourceEvent.id, date: "2026-10-16", result: false, createdAt: sourceEvent.createdAt }]);
    expect(after.cardsData.find((card) => card.cardTemplateId === first.id)!.tests).toHaveLength(1); expect(after.cardsData.find((card) => card.cardTemplateId === nested.id)!.tests).toEqual([]);
    expect(after.itemTests).toHaveLength(2);
    const denied = await page.request.post(`/api/cards-data/${sourceId}/tests`, { data: { viewerUserId: f.actor, source: { kind: "card", cardTemplateId: sourceId }, action: "add", id: randomUUID(), expectedRevision: 2, date: "2026-10-17", result: true, deckTemplateId: f.deck.root.deckTemplateId } });
    expect(denied.status()).toBe(400); expect((await denied.json()).code).toBe("WORKING_DECK_REQUIRED");
    await open(forkDeck.draft!.title!); await page.locator(".deck-card.is-active").press("Enter"); await swipeHeader(page, ".focused-card-surface--front .assessment-indicator", 1);
    await back.getByRole("button", { name: "Open assessment history" }).click();
    await dialog(page).getByRole("button", { name: "Delete test 2026-10-16 from Adopted source title", exact: true }).click(); await dialog(page).getByRole("button", { name: "Confirm delete", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click(); await page.reload();
    const retained = (await read<{ history: AssessmentHistory }>(historyUrl)).history;
    expect(retained.results).toHaveLength(2); expect(retained.results.some((result) => result.id === sourceEvent.id)).toBe(false);
    expect((await f.repo.getPersonalUser(bob))!.cardsData.find((card) => card.cardTemplateId === sourceId)!.tests).toEqual([privateResult]);
    const beforeFaultRead = await f.repo.getPersonalUser(f.actor);
    await f.repo.cardVersions().deleteOne({ cardTemplateId: nested.id, version: 1 });
    const unavailable = (await summary()).frameworks[0].areas[0];
    expect(unavailable.items[0].progress).toMatchObject({ state: "incomplete", completion: null, confidence: null });
    expect(unavailable.items[0].assessments.count).toBe(2); expect(unavailable.items[1].progress.state).toBe("empty");
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(beforeFaultRead);
  } finally { await f.client.close(); }
});

for (const width of [320, 390, 1440]) test(`quiet back metadata and + Test at ${width}px preserve media layout, focus and gestures`, async ({ page }, testInfo) => {
  const f = await fixture(page);
  try {
    const cardId = f.source.root.cardTemplateId;
    await f.repo.users().updateOne({ _id: new ObjectId(f.actor) }, { $set: { "cardsData.$[card].tests": [] } }, { arrayFilters: [{ "card.cardTemplateId": cardId }] });
    const response = await page.request.patch(`/api/decks-data/${f.deck.root.deckTemplateId}`, { headers: { "X-Personal-Viewer": f.actor },
      data: { type: "signal", cardTemplateId: cardId, stepId: f.source.version.content.steps[0].stepId, reading: 7 } });
    expect(response.ok()).toBe(true);
    await page.setViewportSize({ width, height: width === 320 ? 740 : 900 });
    const backSelector = ".focused-card-surface--back .card-semantic-anchors";
    let headerDimensions: number[] | undefined;
    await page.route("**/quiet-header-evidence.png", (route) => route.fulfill({ contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") }));
    for (const mediaCount of [0, 1, 3]) {
      const mediaItems = Array.from({ length: mediaCount }, (_, index) => ({ id: `evidence-${index}`, mediaType: "image", provider: "cloudflare-r2",
        assetId: `user-cards/${f.actor}/${cardId}/${index}.png`, src: new URL("/quiet-header-evidence.png", process.env.PHASE2_BASE_URL!).toString(), description: `Evidence ${index + 1}` }));
      await f.repo.users().updateOne({ _id: new ObjectId(f.actor) }, { $set: { "cardsData.$[card].mediaItems": mediaItems } }, { arrayFilters: [{ "card.cardTemplateId": cardId }] });
      await page.goto("/decks"); await page.getByRole("button", { name: `Open ${f.title}`, exact: true }).last().click();
      const active = page.locator(".deck-card.is-active"); await expect(active).toBeVisible();
      // Both rendered Card surfaces retain the visible, bordered first-test entry.
      await expect(active.locator(".deck-card-surface--back")).toHaveAttribute("inert", "");
      await expect(active.locator(".deck-card-surface--front .assessment-empty-control")).toHaveText("+ Test");
      await swipeHeader(page, ".deck-card.is-active .deck-card-surface--front .assessment-indicator", 1);
      const activeBack = page.locator(".deck-card.is-active .deck-card-surface--back .card-semantic-anchors");
      const activeEmptyControl = activeBack.locator(".assessment-empty-control");
      await expect(activeBack.getByRole("button", { name: "Add first test" })).toBeVisible();
      await expect(activeEmptyControl).toHaveText("+ Test");
      const activeEmptyAppearance = await activeEmptyControl.evaluate((node) => {
        const style = getComputedStyle(node);
        return { borderWidth: style.borderWidth, borderStyle: style.borderStyle, borderRadius: style.borderRadius,
          padding: style.padding, gap: style.gap, color: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight };
      });
      expect(activeEmptyAppearance).toMatchObject({ borderWidth: "1px", borderStyle: "solid", borderRadius: "4px",
        padding: "3px 4px", gap: "3px", fontWeight: "600" });
      const activeIndicatorPosition = await activeBack.locator(".assessment-indicator").evaluate((node) => {
        const style = getComputedStyle(node); return { top: style.top, left: style.left, width: style.width, height: style.height };
      });
      expect(activeIndicatorPosition).toEqual({ top: "-41px", left: "-29px", width: "94px", height: "94px" });
      await swipeHeader(page, ".deck-card.is-active .deck-card-surface--back .assessment-indicator", -1);
      await expect(active).toHaveAttribute("data-deck-flipped", "false");
      const activeBox = (await active.boundingBox())!;
      await active.click({ position: { x: activeBox.width / 2, y: activeBox.height / 2 } });
      const front = ".focused-card-surface--front .card-semantic-anchors";
      await expect(page.locator(front)).toBeVisible(); await swipeHeader(page, `${front} .assessment-indicator`, 1);
      const header = page.locator(backSelector);
      await expect(page.getByRole("button", { name: "Add media", exact: true })).toBeVisible();
      await expect(header.locator(".assessment-empty-control")).toHaveText("+ Test");
      await expect(header.getByLabel("Confidence 7 out of 10")).toHaveText("7");
      const dimensions = (await geometry(page, [backSelector]))[backSelector];
      if (headerDimensions) dimensions.forEach((value, index) => expect(Math.abs(value - headerDimensions![index])).toBeLessThanOrEqual(1));
      headerDimensions = dimensions;
      const appearance = await header.evaluate((node) => {
        const h = node.getBoundingClientRect(), score = node.querySelector(".card-confidence")!, c = score.getBoundingClientRect();
        const control = node.querySelector(".assessment-indicator")!.getBoundingClientRect(), visibleControl = node.querySelector(".assessment-empty-control")!.getBoundingClientRect(), date = node.querySelector(".deck-card-date")!;
        const cs = getComputedStyle(score), ds = getComputedStyle(date), label = node.querySelector("h2")!.getBoundingClientRect();
        return { centerOffset: Math.abs(c.x + c.width / 2 - h.x - h.width / 2), scoreColor: cs.color, dateColor: ds.color,
          scoreSize: cs.fontSize, dateSize: ds.fontSize, weight: Number(cs.fontWeight), controlWidth: control.width, controlHeight: control.height,
          noCollision: label.right < visibleControl.x && control.right < c.x && c.right < date.getBoundingClientRect().x };
      });
      expect(appearance.centerOffset).toBeLessThan(1); expect(appearance.scoreColor).toBe(appearance.dateColor);
      expect(appearance.scoreSize).toBe(appearance.dateSize); expect(appearance.weight).toBe(600);
      expect(appearance.controlWidth, JSON.stringify(appearance)).toBeGreaterThanOrEqual(40); expect(appearance.controlHeight).toBeGreaterThanOrEqual(40); expect(appearance.noCollision).toBe(true);
      await expect(page.locator(".focused-card-surface--back .back-card-media-carousel-item")).toHaveCount(mediaCount);
      if (mediaCount) {
        const media = await page.locator(".focused-card-surface--back .back-card-media-carousel").boundingBox();
        const signals = await page.locator(".focused-card-surface--back .focused-card-back-signals").boundingBox();
        expect(media!.y).toBeGreaterThan(dimensions[1] + dimensions[3]); expect(media!.y + media!.height).toBeLessThanOrEqual(signals!.y);
      }
      await page.screenshot({ path: `/tmp/switchplay-quiet-header-${width}-${mediaCount}.png`, fullPage: true });
      await header.getByRole("button", { name: "Add first test" }).press("Enter");
      await expect(dialog(page)).toBeVisible(); await expect(dialog(page).getByRole("button", { name: "Add test", exact: true })).toBeEnabled();
      await expect(dialog(page).getByLabel("Date", { exact: true })).toHaveCount(0); // Normal history, not an automatically opened Add form.
      await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
      await expect(header.getByRole("button", { name: "Add first test" })).toBeFocused();
      await swipeHeader(page, `${backSelector} .assessment-indicator`, -1);
      await expect(dialog(page)).toHaveCount(0); await expect(page.locator(front).getByRole("button", { name: "Move target date one day later" })).toBeVisible();
      await page.locator(front).getByRole("button", { name: "Move target date one day later" }).click();
    }
    // Real back entry switches from + Test to exactly one/two/three symbols.
    await swipeHeader(page, ".focused-card-surface--front .assessment-indicator", 1);
    const header = page.locator(backSelector);
    await header.getByRole("button", { name: "Add first test" }).click();
    for (let count = 1; count <= 4; count++) {
      await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await changeForm(page, `2026-10-${20 + count}`, count % 2 ? "Pass" : "Fail");
      await dialog(page).getByRole("button", { name: "Save test", exact: true }).click(); await expect(dialog(page).locator("tbody tr")).toHaveCount(count);
      await expect(header.locator(".assessment-pass, .assessment-fail")).toHaveCount(Math.min(count, 3));
      await expect(header.locator(".assessment-empty-control")).toHaveCount(0);
    }
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await header.getByRole("button", { name: "Open assessment history" }).click(); await expect(dialog(page)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`back-assessment-${width}.png`), fullPage: true });
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Close focused card", exact: true }).press("Enter");
    await expect(page.locator(".focused-card-layer")).toHaveCount(0);
    await swipeHeader(page, ".deck-card.is-active .deck-card-surface--front .assessment-indicator", 1);
    const stackedHeader = page.locator(".deck-card.is-active .deck-card-surface--back .card-semantic-anchors");
    await expect(stackedHeader.getByRole("button", { name: "Open assessment history" })).toBeVisible();
    await geometry(page, [".deck-card.is-active", ".deck-card.is-active .deck-card-surface--back .card-semantic-anchors"]);
    const stackedControl = await stackedHeader.locator(".assessment-indicator").boundingBox();
    expect(stackedControl!.width).toBeGreaterThanOrEqual(44); expect(stackedControl!.height).toBeGreaterThanOrEqual(44);
    await stackedHeader.getByRole("button", { name: "Open assessment history" }).click();
    await expect(dialog(page)).toBeVisible(); await expect(page.locator(".focused-card-layer")).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.locator(".deck-card.is-compressed .card-semantic-anchors")).toHaveCount(0);
    await page.screenshot({ path: `/tmp/switchplay-quiet-header-stacked-${width}.png`, fullPage: true });
  } finally { await f.client.close(); }
});

test("back unset confidence and incomplete history never invent a score or a + Test empty state", async ({ page }) => {
  const f = await fixture(page);
  try {
    await f.repo.users().updateOne({ _id: new ObjectId(f.actor) }, { $set: { "cardsData.$[card].historySourceCardTemplateId": randomUUID() } },
      { arrayFilters: [{ "card.cardTemplateId": f.source.root.cardTemplateId }] });
    await page.setViewportSize({ width: 320, height: 740 }); await page.goto("/decks");
    await page.getByRole("button", { name: `Open ${f.title}`, exact: true }).last().click();
    await expect(page.locator(".deck-card.is-active")).toBeVisible(); await page.locator(".deck-card.is-active").press("Enter");
    await swipeHeader(page, ".focused-card-surface--front .assessment-indicator", 1);
    const header = page.locator(".focused-card-surface--back .card-semantic-anchors");
    await expect(header.getByLabel("Confidence not set")).toBeEmpty();
    await expect(header.getByRole("button", { name: "Assessment history incomplete" })).toBeVisible();
    await expect(header.locator(".assessment-empty-control")).toHaveCount(0);
    await header.getByRole("button", { name: "Assessment history incomplete" }).click();
    await expect(dialog(page).getByText(/Some assessment history is unavailable/)).toBeVisible(); await expect(dialog(page).locator("tbody tr")).toHaveCount(4);
  } finally { await f.client.close(); }
});

test("two mounted fork histories and indicators immediately refresh source edits/deletions without duplicating source data", async ({ page }) => {
  const f = await fixture(page);
  try {
    await harness(page, [f.context(f.b.root.cardTemplateId), f.context(f.c.root.cardTemplateId)]);
    const first = page.getByRole("region", { name: "Assessment view 1" }); // section accessible name gives region
    const second = page.getByRole("region", { name: "Assessment view 2" });
    await expect(first.locator("output span")).toHaveCount(4); await expect(second.locator("output span")).toHaveCount(4);
    await expect(first.locator(".assessment-indicator span")).toHaveCount(3);
    await expect(first.locator(".assessment-indicator span")).toHaveText(["●", "✓", "●"]);
    await expect(first.locator(".assessment-pass")).toHaveCSS("color", "rgb(22, 117, 180)");
    await expect(first.locator(".assessment-fail").first()).toHaveCSS("color", "rgb(201, 66, 73)");
    await expect(first.locator(".assessment-indicator span").first()).toHaveAttribute("aria-label", "2026-10-06: Fail");
    await expect(first.locator(".assessment-indicator span").last()).toHaveAttribute("aria-label", "2026-10-08: Fail");
    await first.getByRole("button", { name: "Open assessment history" }).click();
    await expect(dialog(page).getByText("Source Card", { exact: true })).toHaveCount(4);
    await dialog(page).getByRole("button", { name: "Edit test 2026-10-08 from Shared practice", exact: true }).click();
    await changeForm(page, "2026-10-14", "Pass"); await dialog(page).getByRole("button", { name: "Save test", exact: true }).click();
    await expect(second.locator(`output [data-result-id="${f.tests[3].id}"]`)).toHaveAttribute("data-result", "pass");
    await expect(second.locator(`output [data-result-id="${f.tests[3].id}"]`)).toHaveAttribute("data-date", "2026-10-14");
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await expect(second.locator(".assessment-indicator span").last()).toHaveAttribute("aria-label", "2026-10-14: Pass");
    await first.getByRole("button", { name: "Open assessment history" }).click();
    await dialog(page).getByRole("button", { name: "Delete test 2026-10-14 from Shared practice", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Confirm delete", exact: true }).click();
    await expect(second.locator(`output [data-result-id="${f.tests[3].id}"]`)).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await expect(second.locator(".assessment-indicator span").last()).toHaveAttribute("aria-label", "2026-10-07: Pass");
    const user = (await f.repo.getPersonalUser(f.actor))!;
    expect(user.cardsData.find((card) => card.cardTemplateId === f.source.root.cardTemplateId)!.tests.length).toBe(3);
    expect(user.cardsData.find((card) => card.cardTemplateId === f.b.root.cardTemplateId)!.tests).toEqual([]);
    expect(user.cardsData.find((card) => card.cardTemplateId === f.c.root.cardTemplateId)!.tests).toEqual([]);
  } finally { await f.client.close(); }
});

test("working Card header confidence, assessment CRUD, mobile layout and focus preserve Card geometry and gestures", async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/decks");
    await page.getByRole("button", { name: `Open ${f.title}`, exact: true }).last().click();
    const header = page.locator(".deck-card.is-active .deck-card-surface--front .card-semantic-anchors");
    await expect(header.getByLabel("Confidence not set")).toBeEmpty();
    const before = (await geometry(page, [".deck-card.is-active"]))[".deck-card.is-active"];
    await header.getByRole("button", { name: "Open assessment history" }).click();
    await expect(page.locator(".focused-card-layer")).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await changeForm(page, "2026-10-15", "Pass");
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click();
    await expect(dialog(page).locator("tbody tr")).toHaveCount(5);
    const overflow = await dialog(page).evaluate((element) => element.scrollWidth > element.clientWidth); expect(overflow).toBe(false);
    await page.keyboard.press("Escape"); await expect(dialog(page)).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Open assessment history" })).toBeFocused();
    const after = (await geometry(page, [".deck-card.is-active"]))[".deck-card.is-active"]; expect(Math.abs(after[2] - before[2])).toBeLessThanOrEqual(1); expect(Math.abs(after[3] - before[3])).toBeLessThanOrEqual(1);
    await page.locator(".deck-card.is-active").press("Enter"); await expect(page.locator(".focused-card-stage")).toBeVisible();
    const focused = page.locator(".focused-card-surface--front .card-semantic-anchors");
    await focused.getByRole("button", { name: "Open assessment history" }).press("Enter");
    await dialog(page).getByRole("button", { name: "Delete test 2026-10-15 from Shared practice", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Confirm delete", exact: true }).click();
    await expect(dialog(page).locator("tbody tr")).toHaveCount(4); await page.keyboard.press("Escape");
    await focused.getByRole("button", { name: "Move target date one day later" }).click();
    await expect(focused.getByLabel("Confidence not set")).toHaveCount(1);
    const control = focused.locator(".assessment-indicator"), rect = await control.boundingBox();
    await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2); await page.mouse.down();
    await page.mouse.move(rect!.x + rect!.width / 2 + 220, rect!.y + rect!.height / 2, { steps: 12 }); await page.mouse.up();
    await expect(page.getByRole("button", { name: "Add media", exact: true })).toBeVisible(); await expect(dialog(page)).toHaveCount(0);
    const backSelector = ".focused-card-surface--back .card-title-anchor", back = (await geometry(page, [backSelector]))[backSelector];
    await page.mouse.move(back[0] + back[2] / 2, back[1] + back[3] / 2); await page.mouse.down();
    await page.mouse.move(back[0] + back[2] / 2 - 220, back[1] + back[3] / 2, { steps: 12 }); await page.mouse.up();
    await control.click(); await expect(dialog(page)).toBeVisible(); await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    const card = (await f.repo.getPersonalUser(f.actor))!.cardsData.find((card) => card.cardTemplateId === f.source.root.cardTemplateId)!;
    expect(card.tests.length).toBe(4); expect(card.cardTemplateVersion).toBe(1);
    // The center remains at the header midpoint regardless of label/indicators.
    const center = await focused.locator(".card-confidence").evaluate((node) => {
      const h = node.parentElement!.getBoundingClientRect(), c = node.getBoundingClientRect(); return Math.abs(c.x + c.width / 2 - h.x - h.width / 2);
    }); expect(center).toBeLessThan(1);
  } finally { await f.client.close(); }
});

test("stale edit retains entered values and explicitly resubmits; a remotely deleted test is never recreated", async ({ page }) => {
  const f = await fixture(page);
  try {
    await harness(page, [f.context(f.b.root.cardTemplateId)]);
    await page.getByRole("button", { name: "Open assessment history" }).click();
    await dialog(page).getByRole("button", { name: "Edit test 2026-10-08 from Shared practice", exact: true }).click();
    await changeForm(page, "2026-10-20", "Pass");
    const url = `/api/cards-data/${f.source.root.cardTemplateId}/tests/${f.tests[3].id}`;
    await page.request.patch(url, { data: { viewerUserId: f.actor, source: { kind: "card", cardTemplateId: f.source.root.cardTemplateId }, id: f.tests[3].id, action: "update", expectedRevision: 0, date: "2026-10-12", result: false } });
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click();
    await expect(dialog(page).getByText(/Currently saved: 2026-10-12, Fail/)).toBeVisible();
    await expect(dialog(page).getByLabel("Date", { exact: true })).toHaveValue("2026-10-20"); await expect(dialog(page).getByLabel("Result", { exact: true })).toHaveValue("pass");
    await dialog(page).getByRole("button", { name: "Resubmit reviewed change" }).click();
    await expect(dialog(page).getByRole("form", { name: "Edit assessment" })).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Edit test 2026-10-20 from Shared practice", exact: true }).click(); await changeForm(page, "2026-10-21", "Fail");
    await page.request.delete(url, { data: { viewerUserId: f.actor, source: { kind: "card", cardTemplateId: f.source.root.cardTemplateId }, id: f.tests[3].id, action: "delete", expectedRevision: 2 } });
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click();
    await expect(dialog(page).getByText(/This test was deleted elsewhere/)).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Resubmit reviewed change" })).toBeDisabled();
    await dialog(page).getByRole("button", { name: "Cancel", exact: true }).click(); await dialog(page).getByRole("button", { name: "Discard changes" }).click();
    const user = (await f.repo.getPersonalUser(f.actor))!; expect(user.cardsData.find((card) => card.cardTemplateId === f.source.root.cardTemplateId)!.tests.some((test) => test.id === f.tests[3].id)).toBe(false);
  } finally { await f.client.close(); }
});

test("Item mode supports direct-only CRUD and shared-list conflicts without memberships or lost input", async ({ page }) => {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = process.env.PHASE2_USER_ID!;
    const ids = [randomUUID(), randomUUID()];
    // A different fixture-only actor has no Cards or Decks; no auth account or
    // application catalogue needs to be created for this isolated UI harness.
    const fixtureActor = new ObjectId();
    await repo.users().insertOne({ _id: fixtureActor, cardsData: [], decksData: [], itemTests: [], itemTestsRevision: 0 });
    const userId = fixtureActor.toHexString();
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    await itemFixtureRoutes(page, repo, userId, [{ id: "assessment-fixture", title: "Fixture", areas: [{ id: "area", title: "Area", items: ids.map((id) => ({ id, title: id, cardTemplateIds: [] })) }] }]);
    await harness(page, ids.map((itemId) => ({ viewerUserId: userId, source: { kind: "item", itemId }, canCreate: true })));
    const first = page.getByRole("region", { name: "Assessment view 1" }), second = page.getByRole("region", { name: "Assessment view 2" });
    await first.getByRole("button", { name: "Add first test" }).click(); await dialog(page).getByRole("button", { name: "Add test", exact: true }).click();
    await changeForm(page, "2026-10-15", "Fail"); await dialog(page).getByRole("button", { name: "Save test", exact: true }).click();
    await expect(dialog(page).getByText("Item test", { exact: true })).toBeVisible(); await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await second.getByRole("button", { name: "Add first test" }).click(); await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await changeForm(page, "2026-10-16", "Pass");
    // Concurrent change to a different Item advances the deliberately shared revision.
    await repo.users().updateOne({ _id: fixtureActor }, { $inc: { itemTestsRevision: 1 } });
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click();
    await expect(dialog(page).getByLabel("Date", { exact: true })).toHaveValue("2026-10-16");
    await expect(dialog(page).getByRole("button", { name: "Resubmit reviewed change" })).toBeVisible();
    await dialog(page).getByRole("button", { name: "Resubmit reviewed change" }).click(); await expect(dialog(page).getByText("Item test", { exact: true })).toBeVisible();
    await dialog(page).getByRole("button", { name: "Edit test 2026-10-16 from Item test", exact: true }).click(); await changeForm(page, "2026-10-17", "Fail");
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click();
    await dialog(page).getByRole("button", { name: "Delete test 2026-10-17 from Item test", exact: true }).click(); await dialog(page).getByRole("button", { name: "Confirm delete", exact: true }).click();
    await expect(dialog(page).getByText("No tests recorded yet.")).toBeVisible();
    const user = (await repo.getPersonalUser(userId))!; expect(user.cardsData).toEqual([]); expect(user.decksData).toEqual([]); expect(user.itemTests!.length).toBe(1);
    expect(await repo.getPersonalUser(actor)).not.toBeNull();
  } finally { await client.close(); }
});

async function invalidate(page: Page, actor: string) {
  await page.evaluate((actor) => (window as unknown as { invalidateAssessmentFixture: (actor: string) => void }).invalidateAssessmentFixture(actor), actor);
}
test("empty/one/two indicators, partial histories and archived source mutations remain distinct", async ({ page }) => {
  const f = await fixture(page);
  try {
    const forkId = f.b.root.cardTemplateId;
    await f.repo.users().updateOne({ _id: new ObjectId(f.actor) }, { $set: { "cardsData.$[source].tests": [] } }, { arrayFilters: [{ "source.cardTemplateId": f.source.root.cardTemplateId }] });
    await harness(page, [f.context(forkId)]);
    await expect(page.getByRole("button", { name: "Add first test" })).toBeVisible();
    await expect(page.locator(".assessment-indicator .assessment-pass, .assessment-indicator .assessment-fail")).toHaveCount(0);
    await page.getByRole("button", { name: "Add first test" }).click();
    for (const [index, result] of ["Pass", "Fail"].entries()) {
      await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await changeForm(page, `2026-10-${16 + index}`, result as "Pass" | "Fail");
      await dialog(page).getByRole("button", { name: "Save test", exact: true }).click(); await expect(dialog(page).locator("tbody tr")).toHaveCount(index + 1);
      await expect(page.locator(".assessment-indicator .assessment-pass, .assessment-indicator .assessment-fail")).toHaveCount(index + 1);
    }
    expect((await f.repo.getPersonalUser(f.actor))!.cardsData.find((card) => card.cardTemplateId === f.source.root.cardTemplateId)!.tests).toEqual([]);
    await f.repo.users().updateOne({ _id: new ObjectId(f.actor) }, { $pull: { cardsData: { cardTemplateId: f.source.root.cardTemplateId } } });
    await invalidate(page, f.actor);
    await expect(dialog(page).getByText(/Some assessment history is unavailable/)).toBeVisible(); await expect(dialog(page).locator("tbody tr")).toHaveCount(2);
    await expect(page.locator(".assessment-indicator .assessment-pass, .assessment-indicator .assessment-fail")).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await f.repo.archiveDeckData(f.actor, f.deck.root.deckTemplateId);
    await page.evaluate((context) => (window as unknown as { mountAssessmentFixture: (contexts: AssessmentContext[]) => void }).mountAssessmentFixture([{ ...context, canCreate: false }]), f.context(forkId));
    await page.getByRole("button", { name: "Assessment history incomplete" }).click(); await expect(dialog(page).getByRole("button", { name: "Add test", exact: true })).toBeDisabled();
    await dialog(page).getByRole("button", { name: "Edit test 2026-10-17 from Shared practice", exact: true }).click(); await changeForm(page, "2026-10-18", "Pass");
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click(); await expect(dialog(page).getByRole("button", { name: "Edit test 2026-10-18 from Shared practice", exact: true })).toBeVisible();
    const rejected = await page.request.post(`/api/cards-data/${forkId}/tests`, { data: { viewerUserId: f.actor, source: { kind: "card", cardTemplateId: forkId }, action: "add", id: randomUUID(), expectedRevision: 3, date: "2026-10-18", result: true, deckTemplateId: f.deck.root.deckTemplateId } });
    expect(rejected.ok()).toBe(false); expect((await rejected.json()).code).toBe("WORKING_DECK_REQUIRED");
  } finally { await f.client.close(); }
});

test("unavailable source titles retain tests; failed refreshes retain rows but suppress uncertain indicators", async ({ page }) => {
  const f = await fixture(page);
  try {
    await f.repo.cardVersions().deleteMany({ cardTemplateId: f.source.root.cardTemplateId });
    await harness(page, [f.context(f.b.root.cardTemplateId)]);
    await page.getByRole("button", { name: "Open assessment history" }).click();
    await expect(dialog(page).getByText("Card title unavailable", { exact: true })).toHaveCount(4); await expect(dialog(page).getByText("Source Card", { exact: true })).toHaveCount(4);
    let fail = true;
    await page.route(`**/api/cards-data/${f.b.root.cardTemplateId}/assessment-history`, async (route) => fail ? route.fulfill({ status: 500, headers: { "X-Personal-Viewer": f.actor }, json: { error: "Fixture database read failed" } }) : route.continue());
    await invalidate(page, f.actor);
    await expect(dialog(page).getByText(/results below may be out of date/)).toBeVisible(); await expect(dialog(page).locator("tbody tr")).toHaveCount(4);
    await expect(page.locator(".assessment-indicator .assessment-pass, .assessment-indicator .assessment-fail")).toHaveCount(0);
    fail = false; await dialog(page).getByRole("button", { name: "Refresh history" }).click();
    await expect(dialog(page).getByText(/results below may be out of date/)).toHaveCount(0); await expect(page.locator(".assessment-indicator span")).toHaveCount(3);
  } finally { await f.client.close(); }
});

test("lost-response reconciliation and explicit network retry preserve intent without duplicates or unrelated writes", async ({ page }) => {
  const f = await fixture(page);
  try {
    await harness(page, [f.context(f.b.root.cardTemplateId)]);
    const before = (await f.repo.getPersonalUser(f.actor))!; let posts = 0, phase: "lost" | "uncommitted" | "healthy" = "lost";
    await page.route(`**/api/cards-data/${f.b.root.cardTemplateId}/tests`, async (route) => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      posts++;
      if (phase === "lost") { await route.fetch(); await route.abort("failed"); phase = "healthy"; }
      else if (phase === "uncommitted") { await route.abort("failed"); phase = "healthy"; }
      else await route.continue();
    });
    await page.getByRole("button", { name: "Open assessment history" }).click();
    await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await changeForm(page, "2026-10-19", "Pass");
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click(); await expect(dialog(page).locator("tbody tr")).toHaveCount(5); expect(posts).toBe(1);
    phase = "uncommitted";
    await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await changeForm(page, "2026-10-20", "Fail");
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click(); await expect(dialog(page).getByRole("button", { name: "Check and retry save" })).toBeVisible();
    await expect(dialog(page).getByLabel("Date", { exact: true })).toHaveValue("2026-10-20"); await expect(dialog(page).getByLabel("Result", { exact: true })).toHaveValue("fail");
    await dialog(page).getByRole("button", { name: "Check and retry save" }).click(); await expect(dialog(page).locator("tbody tr")).toHaveCount(6); expect(posts).toBe(3);
    const after = (await f.repo.getPersonalUser(f.actor))!; expect(after.decksData).toEqual(before.decksData);
    for (const card of after.cardsData) {
      const old = before.cardsData.find((data) => data.cardTemplateId === card.cardTemplateId)!;
      if (card.cardTemplateId !== f.b.root.cardTemplateId) { expect(card).toEqual(old); continue; }
      const unrelated = (value: typeof card) => Object.fromEntries(Object.entries(value).filter(([key]) => !["tests", "testsRevision", "updatedAt"].includes(key)));
      expect(unrelated(card)).toEqual(unrelated(old));
    }
    const own = after.cardsData.find((card) => card.cardTemplateId === f.b.root.cardTemplateId)!.tests; expect(own.length).toBe(2); expect(new Set(own.map((test) => test.id)).size).toBe(2);
  } finally { await f.client.close(); }
});

test("Item presentation combines direct, eligible own and inherited tests with explicit original-source edits", async ({ page }) => {
  const f = await fixture(page);
  try {
    const itemId = randomUUID(), ownTestId = randomUUID(), directTestId = randomUUID();
    await f.repo.deckVersions().updateOne({ deckTemplateId: f.deck.root.deckTemplateId, version: 1 }, { $set: { "content.cards": [{ cardTemplateId: f.b.root.cardTemplateId, cardVersionAtPublish: 1 }, { cardTemplateId: f.c.root.cardTemplateId, cardVersionAtPublish: 1 }] } });
    await f.repo.users().updateOne({ _id: new ObjectId(f.actor) }, { $set: { "cardsData.$[fork].tests": [{ id: ownTestId, date: "2026-10-18", result: false, createdAt: new Date("2026-10-18T10:00:00Z") }], itemTests: [{ itemId, id: directTestId, date: "2026-10-19", result: true, createdAt: new Date("2026-10-19T10:00:00Z") }], itemTestsRevision: 0 } }, { arrayFilters: [{ "fork.cardTemplateId": f.b.root.cardTemplateId }] });
    await itemFixtureRoutes(page, f.repo, f.actor, [{ id: "assessment-combined", title: "Fixture", areas: [{ id: "area", title: "Area", items: [{ id: itemId, title: "Combined", cardTemplateIds: [f.source.root.cardTemplateId] }] }] }]);
    await harness(page, [{ viewerUserId: f.actor, source: { kind: "item", itemId }, canCreate: true }]);
    await expect(page.locator("output span")).toHaveCount(6);
    await expect(page.locator(".assessment-indicator span").last()).toHaveAttribute("aria-label", "2026-10-19: Pass");
    await page.getByRole("button", { name: "Open assessment history" }).click(); await expect(dialog(page).locator("tbody tr")).toHaveCount(6);
    await expect(dialog(page).getByText("Item test", { exact: true })).toHaveCount(1); await expect(dialog(page).getByText("Source Card", { exact: true })).toHaveCount(4);
    await dialog(page).getByRole("button", { name: "Edit test 2026-10-08 from Shared practice", exact: true }).click(); await changeForm(page, "2026-10-20", "Pass");
    await dialog(page).getByRole("button", { name: "Save test", exact: true }).click(); await expect(dialog(page).getByRole("button", { name: "Edit test 2026-10-20 from Shared practice", exact: true })).toBeVisible(); await expect(dialog(page).locator("tbody tr")).toHaveCount(6);
    const user = (await f.repo.getPersonalUser(f.actor))!;
    expect(user.cardsData.find((card) => card.cardTemplateId === f.source.root.cardTemplateId)!.tests.find((test) => test.id === f.tests[3].id)!.date).toBe("2026-10-20");
    expect(user.cardsData.find((card) => card.cardTemplateId === f.b.root.cardTemplateId)!.tests.map((test) => test.id)).toEqual([ownTestId]); expect(user.itemTests![0].id).toBe(directTestId);
  } finally { await f.client.close(); }
});

test("set raw confidence stays centered on a narrow Card and the native dialog traps/restores keyboard focus", async ({ page }, testInfo) => {
  const f = await fixture(page);
  try {
    const cardId = f.source.root.cardTemplateId, deckId = f.deck.root.deckTemplateId;
    for (const [index, reading] of [2.1, 8.8].entries()) {
      const response = await page.request.patch(`/api/decks-data/${deckId}`, { headers: { "X-Personal-Viewer": f.actor }, data: { type: "signal", cardTemplateId: cardId, stepId: f.source.version.content.steps[index].stepId, reading } });
      expect(response.ok()).toBe(true);
    }
    await page.setViewportSize({ width: 320, height: 740 }); await page.goto("/decks");
    await page.getByRole("button", { name: `Open ${f.title}`, exact: true }).last().click();
    await expect(page.locator(".deck-card.is-active")).toBeVisible();
    await geometry(page, [".deck-card.is-active"]);
    const header = page.locator(".deck-card.is-active .deck-card-surface--front .card-semantic-anchors");
    await expect(header.getByLabel("Confidence 5 out of 10")).toHaveText("5");
    const gap = await header.evaluate((node) => {
      const h = node.getBoundingClientRect(), c = node.querySelector(".card-confidence")!.getBoundingClientRect();
      const label = node.querySelector("h2")!.getBoundingClientRect(), indicator = node.querySelector(".assessment-indicator")!.getBoundingClientRect();
      return { offset: Math.abs(c.x + c.width / 2 - h.x - h.width / 2), labelBeforeIndicator: label.right <= indicator.x + 5, controlBeforeCenter: indicator.right <= c.x + 1 };
    }); expect(gap.offset).toBeLessThan(1); expect(gap.labelBeforeIndicator).toBe(true); expect(gap.controlBeforeCenter).toBe(true);
    await header.getByRole("button", { name: "Open assessment history" }).press("Enter");
    await expect(dialog(page)).toBeVisible();
    for (let index = 0; index < 16; index++) { await page.keyboard.press("Tab"); expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true); }
    await dialog(page).getByRole("button", { name: "Add test", exact: true }).click(); await changeForm(page, "2026-10-22", "Pass");
    await dialog(page).getByRole("button", { name: "Close", exact: true }).focus(); await page.keyboard.press("Escape"); await expect(dialog(page).getByText("Discard your entered changes?")).toBeVisible();
    await dialog(page).getByRole("button", { name: "Keep editing" }).click(); await expect(dialog(page).getByLabel("Date", { exact: true })).toHaveValue("2026-10-22");
    await page.screenshot({ path: testInfo.outputPath("assessment-mobile-320.png"), fullPage: true });
    await dialog(page).getByRole("button", { name: "Close", exact: true }).focus(); await page.keyboard.press("Escape"); await dialog(page).getByRole("button", { name: "Discard changes" }).click(); await expect(dialog(page)).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Open assessment history" })).toBeFocused();
    await expect(page.locator(".focused-card-layer")).toHaveCount(0);
  } finally { await f.client.close(); }
});
