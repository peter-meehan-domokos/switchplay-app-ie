import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { CardRepository } from "../../src/lib/cards/repository";
import { createStep } from "../../src/lib/cards/domain";
import { randomUUID } from "node:crypto";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const database = () => client.db(process.env.MONGODB_DB!);
const actor = () => new ObjectId(process.env.PHASE2_USER_ID!);
async function login(page: Page) {
  await page.goto("/decks"); await page.getByLabel("Username or email").fill("phase2"); await page.getByLabel("Password", { exact: true }).fill("local-test-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page.getByRole("heading", { name: "My decks" })).toBeVisible();
}
async function title(page: Page, value: string) {
  await page.getByRole("button", { name: "Edit deck title and introduction" }).click();
  await page.locator(".creator-modal textarea").fill(value); await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/creator\/edit\//);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect.poll(async () => (await database().collection("deckTemplates").findOne({ deckTemplateId: id }))?.draft?.title).toBe(value);
}
async function add(page: Page, value: string) {
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  const column = page.locator(".creator-column[data-card-template-id]").last();
  const id = (await column.getAttribute("data-card-template-id"))!;
  await column.locator(".creator-card-title-button").click(); await page.locator(".creator-modal textarea").fill(value);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await database().collection("cardTemplates").findOne({ cardTemplateId: id }))?.draft?.intro.title).toBe(value);
  return id;
}
async function publishCard(page: Page, index: number) {
  const response = page.waitForResponse((response) => response.url().includes("/api/card-templates/") && response.request().method() === "PATCH" && response.request().postDataJSON()?.type === "publish");
  const button = page.getByRole("button", { name: `Publish Card ${index}`, exact: true });
  await expect(button).toBeEnabled(); await button.click(); expect((await response).ok()).toBeTruthy();
  await expect(button).toHaveClass(/creator-save-button--published/);
}
async function note(page: Page, entity: string, value: string) {
  await page.getByRole("button", { name: `Add note for ${entity}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Update note for ${entity}`, exact: true });
  await dialog.getByRole("textbox").fill(value);
  await dialog.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function flip(page: Page) {
  const header = page.locator(".focused-card-surface--front .card-title-anchor");
  let previous = "";
  await expect.poll(async () => {
    const rect = await header.boundingBox(); const current = JSON.stringify(rect); const stable = current === previous; previous = current; return stable;
  }).toBe(true);
  const box = await header.boundingBox(); expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.75, box!.y + box!.height * 0.5);
  await page.mouse.down(); await page.mouse.move(box!.x + box!.width * 0.75 + 220, box!.y + box!.height * 0.5, { steps: 12 }); await page.mouse.up();
  await expect(page.getByRole("button", { name: "Add media", exact: true })).toBeVisible();
}
test("private Creator → adopted work → media/state → recoverable publication → archive/restore", async ({ page }) => {
  // Asset delivery is mocked; actual upload authorization and metadata persistence remain real.
  await page.route(/https:\/\/(.*cloudflare.*|.*videodelivery.*|.*youtube.*)\//, (route) => route.abort());
  await login(page); await page.getByRole("link", { name: "Create Deck", exact: true }).click();
  await expect(page.locator(".creator-column[data-card-template-id]")).toHaveCount(0);
  await title(page, "Phase 2 path");
  const cardIds = [await add(page, "First practice"), await add(page, "Second practice")];
  await page.locator(".creator-pair-step").first().click(); await page.getByLabel("Title (optional)").fill("Start");
  await page.locator(".creator-modal textarea").fill("Take one deliberate step"); await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await database().collection("cardTemplates").findOne({ cardTemplateId: cardIds[0] }))?.draft?.steps[0].title).toBe("Start");
  const id = page.url().split("/").at(-1)!;
  let user = await database().collection("users").findOne({ _id: actor() });
  expect(user!.decksData.some((data: { deckTemplateId: string }) => data.deckTemplateId === id)).toBe(false);
  expect(user!.cardsData.filter((data: { cardTemplateId: string }) => cardIds.includes(data.cardTemplateId))).toHaveLength(0);
  await page.goto("/decks"); await expect(page.getByRole("link", { name: "Phase 2 path — Draft" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open Phase 2 path", exact: true })).toHaveCount(0);
  await expect(page.getByText("Shared with me", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Create Deck", exact: true }).click();
  await page.getByRole("button", { name: "My Drafts", exact: true }).click();
  await page.getByRole("dialog", { name: "My Drafts", exact: true }).getByRole("button", { name: "Phase 2 path", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}`));
  const blocked = page.getByRole("button", { name: "Publish Deck", exact: true });
  await expect(blocked).toBeEnabled(); await expect(blocked.getByRole("img", { name: "Publication blocked" })).toBeVisible();
  await blocked.click(); await expect(page.getByRole("dialog", { name: "Publication blocked" })).toContainText("published at least once");
  await page.getByRole("dialog", { name: "Publication blocked" }).getByRole("button", { name: "Close", exact: true }).click();
  for (let index = 1; index <= cardIds.length; index++) {
    await note(page, `Card ${index}`, `Card ${index} first`);
    await publishCard(page, index);
  }
  await note(page, "Deck", "Deck first");
  await page.getByRole("button", { name: "Publish Deck", exact: true }).click();
  await expect.poll(async () => (await database().collection("deckTemplates").findOne({ deckTemplateId: id }))?.latestVersion).toBe(1);
  expect((await database().collection("deckTemplateVersions").findOne({ deckTemplateId: id, version: 1 }))!.updateNote).toBe("Deck first");
  const firstCard = await database().collection("cardTemplates").findOne({ "draft": null, cardTemplateId: (await page.request.get(`/api/deck-templates/${id}`).then((response) => response.json())).cards[0].root.cardTemplateId });
  expect((await database().collection("cardTemplateVersions").findOne({ cardTemplateId: firstCard!.cardTemplateId, version: 1 }))!.updateNote).toBe("Card 1 first");
  // Card-only edits leave the Deck cue inactive; reverting clears the Card cue too.
  await page.locator(".creator-pair-step").first().click();
  await page.getByLabel("Title (optional)").fill("Temporary Card-only edit");
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await database().collection("cardTemplates").findOne({ cardTemplateId: cardIds[0] }))?.draft?.steps[0].title).toBe("Temporary Card-only edit");
  await expect(page.getByRole("button", { name: "Publish Deck", exact: true })).toHaveClass(/creator-save-button--published/);
  await expect(page.getByRole("button", { name: "Publish Card 1", exact: true })).not.toHaveClass(/creator-save-button--published/);
  await expect(page.getByRole("button", { name: "Publish Card 2", exact: true })).toHaveClass(/creator-save-button--published/);
  await page.locator(".creator-pair-step").first().click(); await page.getByLabel("Title (optional)").fill("Start");
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish Card 1", exact: true })).toHaveClass(/creator-save-button--published/);
  user = await database().collection("users").findOne({ _id: actor() });
  expect(user!.cardsData.filter((data: { cardTemplateId: string }) => cardIds.includes(data.cardTemplateId))).toHaveLength(cardIds.length);
  const admitted = user!.decksData.find((data: { deckTemplateId: string }) => data.deckTemplateId === id);
  expect(admitted.deckTemplateVersion).toBe(1); expect(admitted.openedAt).toBeNull(); expect(admitted.cadenceAnchorDate).toBeNull();
  await page.goto("/decks"); await page.getByRole("button", { name: "Open Phase 2 path", exact: true }).last().click();
  await expect(page.locator(".deck-detail h1")).toHaveText("Phase 2 path");
  user = await database().collection("users").findOne({ _id: actor() });
  expect(user!.cardsData.filter((data: { cardTemplateId: string }) => cardIds.includes(data.cardTemplateId))).toHaveLength(cardIds.length);
  const membership = user!.decksData.find((data: { deckTemplateId: string }) => data.deckTemplateId === id);
  const anchor = membership.cadenceAnchorDate, cardId = membership.activeCardId;
  const stepId = user!.cardsData.find((data: { cardTemplateId: string }) => data.cardTemplateId === cardId).items[0].stepId;
  const opened = await (await page.request.get(`/api/decks-data/${id}`)).json(); expect(opened.cards[0].steps[0].title).toBe("Start");
  await page.locator(".deck-card[role=button]").press("Enter");
  const completionSaved = page.waitForResponse((response) => response.request().method() === "PATCH" && response.request().postDataJSON()?.type === "completion");
  await page.getByRole("button", { name: "Update step progress. Current status: todo", exact: true }).first().click();
  expect((await completionSaved).ok()).toBeTruthy();
  let rejectCompletion = true;
  await page.route(`**/api/decks-data/${id}`, (route) => {
    if (rejectCompletion && route.request().method() === "PATCH" && route.request().postDataJSON()?.type === "completion") {
      rejectCompletion = false; return route.fulfill({ status: 500, json: { error: "Simulated completion save failure" } });
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "Update step progress. Current status: inProgress", exact: true }).first().click();
  await expect(page.getByRole("alert").filter({ hasText: "Simulated completion save failure" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Update step progress. Current status: inProgress", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Move target date one day later", exact: true }).click();
  await flip(page);
  let signalPosition = "";
  await expect.poll(async () => {
    const current = JSON.stringify(await page.getByRole("button", { name: "Adjust Start reading", exact: true }).boundingBox());
    const stable = current === signalPosition; signalPosition = current; return stable;
  }).toBe(true);
  const signalBox = await page.getByRole("button", { name: "Adjust Start reading", exact: true }).boundingBox();
  let rejectSignal = true;
  await page.route(`**/api/decks-data/${id}`, (route) => {
    if (rejectSignal && route.request().method() === "PATCH" && route.request().postDataJSON()?.type === "signal") {
      rejectSignal = false; return route.fulfill({ status: 500, json: { error: "Simulated signal save failure" } });
    }
    return route.fallback();
  });
  const failedSignal = page.waitForResponse((response) => response.request().method() === "PATCH" && response.request().postDataJSON()?.type === "signal");
  await page.mouse.move(signalBox!.x + signalBox!.width * 0.3, signalBox!.y + signalBox!.height / 2);
  await page.mouse.down(); await page.mouse.move(signalBox!.x + signalBox!.width * 0.6, signalBox!.y + signalBox!.height / 2, { steps: 8 }); await page.mouse.up();
  expect((await failedSignal).status()).toBe(500);
  await expect(page.getByRole("button", { name: "Adjust Start reading", exact: true })).toContainText("Drag to set");
  const unsetCard = (await database().collection("users").findOne({ _id: actor() }))!.cardsData.find((card: { cardTemplateId: string }) => card.cardTemplateId === cardId);
  expect(unsetCard.signalReadings.find((item: { stepId: string }) => item.stepId === stepId).reading).toBeNull();
  const signalSaved = page.waitForResponse((response) => response.request().method() === "PATCH" && response.request().postDataJSON()?.type === "signal", { timeout: 15_000 });
  await page.mouse.move(signalBox!.x + signalBox!.width * 0.3, signalBox!.y + signalBox!.height / 2);
  await page.mouse.down(); await page.mouse.move(signalBox!.x + signalBox!.width * 0.6, signalBox!.y + signalBox!.height / 2, { steps: 8 }); await page.mouse.up();
  expect((await signalSaved).ok()).toBeTruthy();
  await page.getByRole("button", { name: "Add a reflection", exact: true }).click();
  await page.locator(".reflection-editor-modal textarea").fill("A useful private reflection"); await page.locator(".reflection-editor-modal").getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Add media", exact: true }).click();
  await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") });
  await expect(page.getByRole("button", { name: /Remove image proof/ })).toBeVisible();
  await page.getByRole("dialog", { name: "Card media", exact: true }).getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Close focused card", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Back", exact: true }).click(); await expect(page.getByRole("heading", { name: "My decks" })).toBeVisible();
  user = await database().collection("users").findOne({ _id: actor() });
  const personal = user!.cardsData.find((card: { cardTemplateId: string }) => card.cardTemplateId === cardId);
  expect(personal.items.find((item: { stepId: string }) => item.stepId === stepId).completionStatus).toBe("inProgress");
  expect(personal.signalReadings.find((item: { stepId: string }) => item.stepId === stepId).reading).not.toBeNull();
  expect(personal.reflection).toBe("A useful private reflection"); expect(personal.mediaItems[0].assetId).toMatch(new RegExp(`^user-cards/${actor().toHexString()}/${cardId}/`));
  await page.reload(); await page.getByRole("button", { name: "Open Phase 2 path", exact: true }).last().click();
  const reopened = await (await page.request.get(`/api/decks-data/${id}`)).json();
  expect(reopened.cards[0].adoptedVersion).toBe(1); expect(reopened.cards[0].reflection).toBe(personal.reflection); expect(reopened.cards[0].targetDate).toBe(personal.targetDate);
  await page.getByRole("button", { name: "Deck menu", exact: true }).click(); await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await title(page, "Phase 2 revised");
  await page.locator(".creator-pair-step").first().click(); await page.getByLabel("Title (optional)").fill("Updated Start"); await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  let failOnce = true;
  await page.route(`**/api/deck-templates/${id}/publish`, (route) => {
    if (failOnce && route.request().method() === "POST") { failOnce = false; return route.fulfill({ status: 500, json: { error: "Simulated final Deck failure" } }); }
    return route.continue();
  });
  await page.getByRole("link", { name: "Deck", exact: true }).click();
  await page.getByRole("button", { name: "Publish and leave", exact: true }).click();
  await expect(page.getByText(/Simulated final Deck failure/)).toBeVisible(); await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}`));
  expect((await database().collection("cardTemplates").findOne({ cardTemplateId: cardId }))!.latestVersion).toBe(2);
  expect((await database().collection("deckTemplates").findOne({ deckTemplateId: id }))!.latestVersion).toBe(1);
  await page.getByRole("link", { name: "Deck", exact: true }).click();
  await page.getByRole("button", { name: "Publish and leave", exact: true }).click(); await expect(page.locator(".deck-detail h1")).toHaveText("Phase 2 revised");
  expect((await database().collection("cardTemplates").findOne({ cardTemplateId: cardId }))!.latestVersion).toBe(2);
  user = await database().collection("users").findOne({ _id: actor() });
  const updatedPersonal = user!.cardsData.find((data: { cardTemplateId: string }) => data.cardTemplateId === cardId);
  expect(updatedPersonal.cardTemplateVersion).toBe(2); expect(updatedPersonal.reflection).toBe(personal.reflection);
  await page.getByRole("button", { name: "Archive Deck", exact: true }).click(); await expect(page.getByRole("button", { name: "Open Phase 2 revised", exact: true })).toHaveCount(0);
  await page.getByText("Archived decks", { exact: true }).click(); await page.getByRole("button", { name: "Restore Phase 2 revised", exact: true }).click();
  await page.getByRole("button", { name: "Open Phase 2 revised", exact: true }).last().click();
  user = await database().collection("users").findOne({ _id: actor() });
  const restored = user!.decksData.find((data: { deckTemplateId: string }) => data.deckTemplateId === id);
  expect(restored.cadenceAnchorDate).toBe(anchor); expect(user!.cardsData.find((data: { cardTemplateId: string }) => data.cardTemplateId === cardId).mediaItems).toEqual(personal.mediaItems);
  expect(user!.sharedDeckData).toEqual([{ parked: "preserve exactly" }]); expect(restored.sharedWithUserIds).toEqual([]);
  const shared = await page.request.get("/api/decks-data/shared"); expect(shared.status()).toBe(410);
  const disabled = await page.request.post("/api/decks-data/shared/missing/cards/missing/comments", { data: "invalid JSON" }); expect(disabled.status()).toBe(410);
  // Fixture-only rewind proves the actual route resolves retained adoption, not latest.
  await database().collection("users").updateOne({ _id: actor() }, { $set: { "decksData.$[deck].deckTemplateVersion": 1, "cardsData.$[card].cardTemplateVersion": 1 } },
    { arrayFilters: [{ "deck.deckTemplateId": id }, { "card.cardTemplateId": cardId }] });
  await page.reload(); await expect(page.locator(".deck-detail h1")).toHaveText("Phase 2 path");
  const historicalWork = await (await page.request.get(`/api/decks-data/${id}`)).json(); expect(historicalWork.adoptedVersion).toBe(1); expect(historicalWork.cards[0].adoptedVersion).toBe(1);
  expect(historicalWork.cards[0].steps[0].title).toBe("Start");
  const identity = await (await page.request.get("/api/auth/me")).json(); expect(identity.user.decksData).toBeUndefined(); expect(identity.user.cardsData).toBeUndefined(); expect(identity.user.passwordHash).toBeUndefined();
});
test("disabled sharing needs no login; another actor cannot mutate or upload private state", async ({ page }) => {
  expect((await page.request.get("/api/decks-data/shared")).status()).toBe(410);
  // Independent setup: this security test also runs without the journey test.
  const repo = new CardRepository(database(), client), id = randomUUID(), cardTemplateId = randomUUID();
  await repo.createPrivateGraph(actor().toHexString(), id, { title: "Private authorization fixture", introduction: null,
    categories: [], themes: [], cadence: { intervalDays: 7 }, labelPrefix: "Card", cards: [{ cardTemplateId }] },
    [{ cardTemplateId, content: { intro: { title: "Private authorization Card", description: null, mediaItem: null }, suggestedTargetDate: "", steps: [createStep(), createStep(), createStep()] } }]);
  await repo.publishCard(actor().toHexString(), cardTemplateId, 0); await repo.publishDeck(actor().toHexString(), id, 0);
  const before = await database().collection("users").findOne({ username: "other" });
  await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  expect((await page.request.get(`/api/deck-templates/${id}`)).status()).toBe(403);
  expect((await page.request.get(`/api/card-templates/${cardTemplateId}`)).status()).toBe(403);
  expect((await page.request.patch(`/api/card-templates/${cardTemplateId}`, { data: { type: "publish", revision: 1 } })).status()).toBe(403);
  expect((await page.request.post("/api/decks-data", { data: { deckTemplateId: id, localDate: "2026-10-04" } })).ok()).toBeFalsy();
  expect((await page.request.post("/api/media/images/direct-upload", { data: { scope: "user-card", deckTemplateId: id, cardTemplateId, contentType: "image/png" } })).ok()).toBeFalsy();
  const other = await database().collection("users").findOne({ username: "other" }); expect(other!.cardsData).toEqual(before!.cardsData); expect(other!.decksData).toEqual(before!.decksData);
});

for (const width of [375, 390]) {
  test(`Creator mobile ${width}px confines scrolling and preserves modal/header geometry`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 812 }, isMobile: true, hasTouch: true, baseURL: process.env.PHASE2_BASE_URL });
    const page = await context.newPage();
    try {
      await login(page);
      await page.getByRole("link", { name: "Create Deck", exact: true }).click();
      await title(page, `Mobile layout ${width}`);
      await add(page, `Mobile first ${width}`); await add(page, `Mobile second ${width}`);
      await expect(page.getByText(/draft outstanding/)).toHaveCount(0);
      await expect(page.locator('.creator-header input:not([type="file"]), .creator-card-header input:not([type="file"])')).toHaveCount(0);
      const geometry = await page.evaluate(() => {
        const shell = document.querySelector(".creator-scroll-shell")!;
        const header = document.querySelector(".creator-column:nth-child(2) .creator-card-header")!;
        const upload = header.querySelector(".creator-card-intro-media-slot")!;
        const headerRect = header.getBoundingClientRect(), uploadRect = upload.getBoundingClientRect();
        return { documentWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth,
          shellWidth: shell.getBoundingClientRect().width, canvasWidth: shell.scrollWidth,
          headerHeight: headerRect.height, headerWidth: headerRect.width, rows: getComputedStyle(header).gridTemplateRows,
          uploadTop: uploadRect.top, uploadBottom: uploadRect.bottom, headerBottom: headerRect.bottom,
          labelFont: getComputedStyle(header.querySelector(".creator-card-label-button")!).fontSize };
      });
      expect(geometry.documentWidth).toBe(geometry.viewportWidth);
      expect(geometry.shellWidth).toBe(width);
      expect(geometry.canvasWidth).toBeGreaterThan(width);
      expect(geometry.headerHeight).toBe(100);
      expect(geometry.headerWidth).toBeLessThanOrEqual(172);
      expect(geometry.rows).toBe("18px 42px 20px");
      expect(geometry.uploadBottom).toBeLessThanOrEqual(geometry.headerBottom - 8);
      expect(geometry.headerBottom - geometry.uploadTop).toBeGreaterThanOrEqual(28);
      expect(geometry.headerBottom - geometry.uploadTop).toBeLessThanOrEqual(29);
      expect(geometry.labelFont).toBe("12px");
      await page.locator(".creator-pair-step").first().click();
      const modal = await page.locator(".creator-modal").boundingBox();
      expect(modal!.x).toBeCloseTo(16);
      expect(width - modal!.x - modal!.width).toBeCloseTo(16);
      await page.locator(".creator-modal").getByRole("button", { name: "Close", exact: true }).click();
      await note(page, "Deck", "Only visible in the modal");
      await expect(page.getByText("Only visible in the modal", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Add note for Deck", exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("textbox")).toHaveValue("Only visible in the modal");
      const noteModal = await page.locator(".creator-note-modal").boundingBox();
      expect(noteModal!.x).toBeCloseTo(16);
      expect(width - noteModal!.x - noteModal!.width).toBeCloseTo(16);
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
      // A long server error must not expand the page or displace the Deck control.
      await publishCard(page, 1); await publishCard(page, 2);
      const publish = page.getByRole("button", { name: "Publish Deck", exact: true });
      const before = await publish.boundingBox();
      await page.route("**/api/deck-templates/*/publish", (route) => route.fulfill({ status: 500, json: { error: "A deliberately long publication failure message ".repeat(8) } }));
      await publish.click();
      await expect(page.getByText(/A deliberately long publication failure/)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const after = await publish.boundingBox();
      expect(after!.x).toBeCloseTo(before!.x);
    } finally { await context.close(); }
  });
}
