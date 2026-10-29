import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
test("warm Deck presentation and editable readiness timings against real disposable MongoDB", async ({ page }, info) => {
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = process.env.PHASE2_USER_ID!;
  const ids: string[] = [];
  for (let position = 0; position < 4; position++) {
    const card = await repo.createCardDraft(actor, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: `Timing instruction ${position}`, description: "Disposable data", mediaItem: null } }, "private");
    await repo.publishCard(actor, card.cardTemplateId, 0); ids.push(card.cardTemplateId);
  }
  const title = `Reopening ${randomUUID()}`;
  const root = await repo.createDeckDraft(actor, { ...createDefaultDeckContent([]), title, cards: ids.map(cardTemplateId => ({ cardTemplateId })) }, "private");
  await repo.publishDeck(actor, root.deckTemplateId, 0);
  await repo.ensureDeckData(actor, root.deckTemplateId, 1);
  await repo.openWorkingDeck(actor, root.deckTemplateId, "2026-10-19");
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto("/decks");
  const samples: { visibleMs: number; editableMs: number; visibleToEditableMs: number }[] = [];
  const requests: { path: string; ms: number }[] = [];
  page.on("response", response => {
    const request = response.request(), url = new URL(response.url());
    if (url.pathname === "/api/decks-data" && request.method() === "POST" || url.pathname === "/api/auth/me") {
      const timing = request.timing(); requests.push({ path: url.pathname, ms: Math.round(timing.responseStart) });
    }
  });
  for (let visit = 0; visit < 5; visit++) {
    await expect(page.getByRole("button", { name: `Open ${title}`, exact: true }).last()).toBeVisible();
    await page.evaluate(() => {
      const timing = { start: 0, visible: 0, ready: 0 };
      (window as unknown as { entryTiming: typeof timing }).entryTiming = timing;
      document.addEventListener("click", () => {
        timing.start = performance.now();
        const sample = () => {
          const deck = document.querySelector<HTMLElement>(".deck-detail");
          if (deck && !timing.visible) {
            const bounds = deck.getBoundingClientRect(), style = getComputedStyle(deck);
            if (bounds.width > 0 && bounds.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0) timing.visible = performance.now();
          }
          if (timing.visible && document.querySelector('main[data-working-ready="true"]')) timing.ready = performance.now();
          else requestAnimationFrame(sample);
        }; requestAnimationFrame(sample);
      }, { once: true, capture: true });
    });
    await page.getByRole("button", { name: `Open ${title}`, exact: true }).last().click();
    await expect(page.locator("main")).toHaveAttribute("data-working-ready", "true");
    await expect.poll(() => page.evaluate(() => (window as unknown as { entryTiming: { ready: number } }).entryTiming.ready)).toBeGreaterThan(0);
    const timing = await page.evaluate(() => (window as unknown as { entryTiming: { start: number; visible: number; ready: number } }).entryTiming);
    samples.push({ visibleMs: Math.round(timing.visible - timing.start), editableMs: Math.round(timing.ready - timing.start), visibleToEditableMs: Math.round(timing.ready - timing.visible) });
    await page.getByRole("button", { name: "Back", exact: true }).click();
  }
  const data = (await repo.getPersonalUser(actor))!, membership = data.decksData.find(deck => deck.deckTemplateId === root.deckTemplateId)!;
  expect(membership.activeCardId).toBe(ids[0]); expect(membership.cadenceAnchorDate).toBe("2026-10-19");
  expect(data.cardsData.filter(card => ids.includes(card.cardTemplateId)).every(card => card.items.every(step => step.completionStatus === "todo"))).toBe(true);
  await info.attach("warm-opening-timings", { body: JSON.stringify({ environment: "Next development server + isolated local MongoDB; no media", samples, requests }, null, 2), contentType: "application/json" });
  console.log("Disposable warm opening timings:", JSON.stringify(samples));
});
