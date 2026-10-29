import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

for (const width of [390, 1440]) test(`completion distinguishes empty, zero and all-skipped in working views ${width}`, async ({ page }) => {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = process.env.PHASE2_USER_ID!;
    const emptyTitle = `Empty foundation ${width}`, skippedTitle = `Skipped foundation ${width}`;
    const empty = await repo.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: emptyTitle });
    await repo.publishDeck(actor, empty.deckTemplateId, 0);
    const content = createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]); content.intro.title = "Completion practice";
    const card = await repo.createCardDraft(actor, content); await repo.publishCard(actor, card.cardTemplateId, 0);
    const deck = await repo.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: skippedTitle, cards: [{ cardTemplateId: card.cardTemplateId }] });
    await repo.publishDeck(actor, deck.deckTemplateId, 0);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    await page.goto("/decks");
    const emptyTile = page.locator(".deck-tile").filter({ hasText: emptyTitle });
    await expect(emptyTile.locator(".deck-tile-meta")).toHaveText("0 cards");
    await emptyTile.getByRole("button", { name: `Open ${emptyTitle}`, exact: true }).last().click();
    await expect(page.locator(".deck-detail h1")).toHaveText(emptyTitle);
    await expect(page.locator(".detail-progress")).toBeEmpty();
    await expect(page.locator(".deck-card")).toHaveCount(0);
    await page.goto("/decks");
    const zeroTile = page.locator(".deck-tile").filter({ hasText: skippedTitle });
    await expect(zeroTile.locator(".deck-tile-meta")).toContainText("0%");
    for (const step of content.steps) await repo.setCompletion(actor, deck.deckTemplateId, card.cardTemplateId, step.stepId, "skipped");
    await page.reload();
    await expect(zeroTile.locator(".deck-tile-meta")).toContainText("Completed");
    await zeroTile.getByRole("button", { name: `Open ${skippedTitle}`, exact: true }).last().click();
    await expect(page.locator(".detail-progress")).toHaveText("Completed");
    await expect(page.locator(".deck-card.is-active .completion-strip-fill")).toHaveAttribute("style", /width: 100%/);
    await page.locator(".deck-card[role=button]").press("Enter");
    await expect(page.locator(".focused-card-surface--front .completion-strip-fill")).toHaveAttribute("style", /width: 100%/);
    await expect(page.locator(".focused-card-surface--front .step-progress-hit-area")).toHaveCount(3);
  } finally { await client.close(); }
});
