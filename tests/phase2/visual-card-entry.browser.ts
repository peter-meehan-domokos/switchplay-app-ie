import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { geometry } from "./helpers/presentationGeometry";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
async function fixture(page: Page, working: boolean) {
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client, "1"), actor = process.env.PHASE2_USER_ID!;
  const owner = (await repo.users().findOne({ username: "other" }))!._id.toString();
  const cards = [];
  for (const label of ["First", "Second"]) {
    const defaults = createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]);
    const card = await repo.createCardDraft(owner, { ...defaults,
      intro: { title: `${label} visual practice`, description: null, mediaItems: [{ id: randomUUID(), label: "Explore", kind: "activity", activityId: "roots-and-factors" }] },
      steps: defaults.steps.map((step, index) => index === 0 ? { stepId: step.stepId, title: "Integration", description: "Explore area.",
        mediaItems: [{ id: randomUUID(), label: "Explore", kind: "activity", activityId: "integration-area" }] } : { ...step, description: "Continue practice." }),
    }, "public");
    await repo.publishCard(owner, card.cardTemplateId, 0); cards.push(card);
  }
  const deck = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: `Visual record entry ${randomUUID()}`,
    cards: cards.map(card => ({ cardTemplateId: card.cardTemplateId })) }, "public");
  await repo.publishDeck(owner, deck.deckTemplateId, 0);
  if (working) {
    await repo.ensureDeckData(actor, deck.deckTemplateId, 1); await repo.openWorkingDeck(actor, deck.deckTemplateId, "2026-10-30");
    await repo.setCompletion(actor, deck.deckTemplateId, cards[0].cardTemplateId, cards[0].draft!.steps[0].stepId, "skipped");
  }
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  return { repo, actor, deck, cards };
}
async function focus(page: Page) {
  await page.locator(".deck-card.is-active").press("Enter"); await geometry(page, [".focused-card-surface--front"]);
}
async function intro(page: Page) {
  await page.locator(".focused-card-surface--front .active-card-identity[role=button]").click();
  const preview = page.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ });
  await expect(preview).toBeEnabled(); return preview;
}

test("real working Card visual shares durable progress across Cards and restores the exact origin without ticking steps", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1100 });
  const { repo, actor, deck, cards } = await fixture(page, true), before = await repo.getPersonalUser(actor);
  await page.goto(`/decks?openDeck=${deck.deckTemplateId}&openCard=${cards[0].cardTemplateId}`); await focus(page);
  expect(await repo.db.collection("visualRecords").countDocuments({ principalKey: `account:${actor}` })).toBe(0);
  let preview = await intro(page);
  expect(await repo.db.collection("visualRecords").countDocuments({ principalKey: `account:${actor}` })).toBe(0); // inert preview
  await preview.click();
  let dialog = page.getByRole("dialog", { name: "Roots and Factors", exact: true });
  await dialog.getByRole("slider").focus(); await page.keyboard.press("ArrowRight");
  await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
  await dialog.getByRole("button", { name: "Close interactive visual" }).click(); await expect(preview).toBeFocused();
  await expect(page.locator(".step-view-layer")).toHaveAttribute("data-step-view-item", "intro");
  await page.goto(`/decks?openDeck=${deck.deckTemplateId}&openCard=${cards[1].cardTemplateId}`); await focus(page);
  preview = await intro(page); await preview.click(); dialog = page.getByRole("dialog", { name: "Roots and Factors", exact: true });
  await expect(dialog.getByRole("slider")).toHaveAttribute("aria-valuenow", "4");
  const records = await repo.db.collection("visualRecords").find({ principalKey: `account:${actor}`, activityId: "roots-and-factors" }).toArray();
  expect(records).toHaveLength(1);
  const visits = await repo.db.collection("visualVisits").find({ attemptId: records[0].activeAttemptId }).toArray();
  expect(new Set(visits.map(visit => visit.source.cardId))).toEqual(new Set(cards.map(card => card.cardTemplateId)));
  for (const visit of visits) { expect(visit.source.mode).toBe("working"); expect(visit.source.deckId).toBe(deck.deckTemplateId); expect(visit.source.deckVersion).toBe(1); expect(visit.source.cardVersion).toBe(1); }
  expect(await repo.db.collection("visualEvents").countDocuments({ attemptId: records[0].activeAttemptId, type: "attempt-started" })).toBe(1);
  const after = await repo.getPersonalUser(actor);
  for (const card of cards) expect(after!.cardsData.find(item => item.cardTemplateId === card.cardTemplateId)!.items)
    .toEqual(before!.cardsData.find(item => item.cardTemplateId === card.cardTemplateId)!.items);
});

test("canonical Card entry carries its actual deck version and creates no personal CardData or DeckData", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1100 });
  const { repo, actor, deck } = await fixture(page, false), before = await repo.getPersonalUser(actor);
  await page.goto(`/library/${deck.deckTemplateId}`); await focus(page);
  await page.getByRole("button", { name: "IntegrationExplore area.", exact: true }).click();
  const preview = page.getByRole("button", { name: /^(Start|Continue): Integration$/ }); await expect(preview).toBeEnabled(); await preview.click();
  const dialog = page.getByRole("dialog", { name: "Integration", exact: true });
  await expect(dialog.getByRole("slider", { name: "Right boundary", exact: true })).toBeVisible();
  await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
  await dialog.getByRole("button", { name: "Close interactive visual" }).click(); await expect(preview).toBeFocused();
  const record = (await repo.db.collection("visualRecords").findOne({ principalKey: `account:${actor}`, activityId: "integration-area" }))!;
  const visit = (await repo.db.collection("visualVisits").findOne({ attemptId: record.activeAttemptId }))!;
  expect(visit.source.mode).toBe("canonical"); expect(visit.source.deckId).toBe(deck.deckTemplateId); expect(visit.source.deckVersion).toBe(1);
  const after = await repo.getPersonalUser(actor); expect(after!.cardsData).toEqual(before!.cardsData); expect(after!.decksData).toEqual(before!.decksData);
});

test("real Card preview recovers failed status and opening requests without passive visits or duplicate attempts", async ({ page }) => {
  const { repo, actor, deck, cards } = await fixture(page, true);
  const counts = () => Promise.all([repo.db.collection("visualRecords").countDocuments(), repo.db.collection("visualAttempts").countDocuments(), repo.db.collection("visualVisits").countDocuments()]);
  const before = await counts();
  let failStatus = true, failOpen = true;
  await page.route("**/api/visual-sessions/existing?**", route => failStatus
    ? route.fulfill({ status: 503, json: { code: "VISUAL_REQUEST_FAILED" } }) : route.continue());
  await page.route("**/api/visual-sessions/open", route => failOpen
    ? route.fulfill({ status: 503, json: { code: "VISUAL_REQUEST_FAILED" } }) : route.continue());
  await page.goto(`/decks?openDeck=${deck.deckTemplateId}&openCard=${cards[0].cardTemplateId}`); await focus(page);
  await page.locator(".focused-card-surface--front .active-card-identity[role=button]").click();
  const preview = page.locator("[data-interactive-visual-preview]");
  await expect(preview).toHaveAccessibleName("Retry checking progress: Roots and Factors");
  await expect(preview).toBeEnabled(); await expect(preview).not.toHaveAttribute("aria-busy", "true");
  expect(await counts()).toEqual(before);
  failStatus = false; await preview.click();
  await expect(preview).toHaveAccessibleName(/^(Start|Continue): Roots and Factors$/);
  expect(await counts()).toEqual(before);
  await preview.click(); await expect(page.locator(".step-view-layer").getByRole("alert")).toContainText("Unable to open");
  await expect(preview).toBeEnabled(); expect(await counts()).toEqual(before);
  failOpen = false; await preview.click();
  const host = page.getByRole("dialog", { name: "Roots and Factors", exact: true }); await expect(host).toBeVisible();
  const record = (await repo.db.collection("visualRecords").findOne({ principalKey: `account:${actor}`, activityId: "roots-and-factors" }))!;
  const attempts = await repo.db.collection("visualAttempts").countDocuments({ recordId: record.recordId });
  await host.getByRole("button", { name: "Close interactive visual" }).click();
  await expect(preview).toHaveAccessibleName("Continue: Roots and Factors"); await preview.click();
  await expect(host).toBeVisible();
  expect((await repo.db.collection("visualRecords").findOne({ recordId: record.recordId }))!.activeAttemptId).toBe(record.activeAttemptId);
  expect(await repo.db.collection("visualAttempts").countDocuments({ recordId: record.recordId })).toBe(attempts);
});
