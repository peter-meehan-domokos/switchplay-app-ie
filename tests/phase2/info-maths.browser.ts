import { expect, test, chromium, firefox, webkit, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mathsHostToken } from "../../src/lib/infoCards/mathsHostAuth";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
const explanationReviews = [...readFileSync("src/app/dev/maths-renderer/ExplanationReviewFixtures.tsx", "utf8").matchAll(/content:\s*String\.raw`([^`]+)`/g)].map(match => ({ content: match[1] }));

test("real editor autosaves exact maths, publishes without Chromium, Library and consultation retain the format", async ({ page, request, browser }) => {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  expect((await request.get("/internal/info-maths")).status()).toBe(404);
  await page.goto("/creator/info-cards/new");
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption({ label: "Basics (phase2)" });
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Maths");
  const input = page.getByRole("textbox", { name: "Explanation", exact: true });
  for (const source of explanationReviews) {
    await input.fill(source.content);
    await expect(page.getByText("Explanation fits.", { exact: true })).toBeVisible();
    await expect(page.locator("[data-maths-renderer] .katex").first()).toBeVisible();
    expect(await input.inputValue()).toBe(source.content);
    const geometry = await page.locator("[data-info-card-face]").evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, padding: getComputedStyle(el).padding }));
    expect(geometry).toEqual({ width: 240, height: 204, padding: "12px" });
  }
  const source = explanationReviews[2].content;
  await input.fill(source); await expect(page.getByText("Explanation fits.", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const saved = await (await page.request.get(`/api/info-cards/${id}`)).json();
  expect(saved.root.draft.body).toBe(source); expect(saved.root.draft.bodyFormat).toBe("latex-v1");
  expect((await page.request.post(`/api/info-cards/${id}/publish`, { data: { revision: saved.root.revision, fits: true } })).status()).toBe(400);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible({ timeout: 45000 });
  const published = await (await page.request.get(`/api/info-cards/${id}`)).json();
  expect(published.publication.mathsValidation).toBeUndefined(); expect(published.publication.content.body).toBe(source);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.locator(`[data-info-id='${id}'] [data-maths-renderer] .katex`).first()).toBeVisible();
  await page.locator(`[data-info-id='${id}'] [data-info-card-face]`).screenshot({ path: test.info().outputPath("library-maths.png") });
  const snapshot = await (await page.request.get(`/api/info-cards/${id}/publication`)).json();
  expect(snapshot.content.body).toBe(source); expect(snapshot.content.bodyFormat).toBe("latex-v1");
  // Real main/deck publications exercise learner reads, physical stack scaling
  // and navigation between maths and legacy cards, without another validation.
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  let deckId: string;
  try {
    const main = new CardRepository(client.db(process.env.MONGODB_DB!), client), owner = process.env.PHASE2_USER_ID!;
    await new InfoCardRepository(main.db, client).assertIndexesReady(true);
    const card = await main.createCardDraft(owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), infoCardIds: [id, "demo-owner-public"],
      intro: { title: "Maths practice", description: "Main instruction remains mounted", mediaItem: null },
      steps: [0, 1, 2].map(index => ({ stepId: randomUUID(), title: `Practice ${index + 1}`, description: "Keep working.", mediaItem: null })) }, "private");
    await main.publishCard(owner, card.cardTemplateId, 0);
    const deck = await main.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "Maths integration", cards: [{ cardTemplateId: card.cardTemplateId }] }, "private");
    await main.publishDeck(owner, deck.deckTemplateId, 0); deckId = deck.deckTemplateId;
    await main.ensureDeckData(owner, deckId, 1); await main.ensureCardData(owner, card.cardTemplateId, 1);
  } finally { await client.close(); }
  await page.goto(`/decks?openDeck=${deckId}`); await page.locator(".deck-card.is-active").press("Enter");
  await page.locator(".focused-card-layer .active-card-identity").click();
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  const stack = page.locator("[data-info-card-stack]"); await expect(stack).toHaveAttribute("data-info-stack-phase", "open");
  await expect(page.locator('[data-info-card-current="true"] [data-maths-renderer] .katex').first()).toBeVisible();
  await expect(stack.getByRole("alert")).toHaveCount(0);
  await stack.screenshot({ path: test.info().outputPath("consultation-maths.png") });
  await page.keyboard.press("ArrowDown"); await expect(page.locator('[data-info-card-current="true"]')).toHaveAttribute("data-info-card-id", "demo-owner-public");
  await page.keyboard.press("ArrowUp"); await expect(page.locator('[data-info-card-current="true"]')).toHaveAttribute("data-info-card-id", id);
  await expect(stack).toHaveAttribute("data-info-stack-phase", "open"); await expect(stack.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Close information card stack", exact: true }).click();
  const deniedContext = await browser.newContext({ storageState: await page.context().storageState() });
  try {
    const denied = await deniedContext.newPage(); await denied.route(/\.(woff2?|ttf)(\?|$)/, route => route.abort());
    await denied.goto(new URL("/library?tab=info-cards", page.url()).href);
    const visible = denied.locator(`[data-info-id='${id}']`);
    await expect(visible.locator("[data-maths-renderer]")).toHaveAttribute("data-maths-status", "measurement-unavailable");
    await expect(visible.locator("[data-maths-renderer]")).toBeVisible();
    await expect(visible.locator(".katex").first()).toBeVisible();
    await expect(visible.getByRole("alert")).toHaveCount(0);
  } finally { await deniedContext.close(); }
  // Invalid input remains saved and cannot be published via direct API.
  await page.goto(`/creator/info-cards/${id}`); await input.fill("Before $$\\frac{1}{2}");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.locator("[data-maths-fallback]")).toBeVisible();
  const invalid = await (await page.request.get(`/api/info-cards/${id}`)).json();
  const failure = await page.request.post(`/api/info-cards/${id}/publish`, { data: { revision: invalid.root.revision }, timeout: 45000 });
  expect(failure.status()).toBe(422); expect((await failure.json()).error).toBe("INFO_MATHS_INVALID");
});

for (const browserName of ["chromium", "firefox", "webkit"] as const) test(`real shared maths face · ${browserName}: media, padding and physical overflow`, async () => {
  const browser = await ({ chromium, firefox, webkit })[browserName].launch();
  const page = await browser.newPage({ baseURL: process.env.PHASE2_BASE_URL });
  try {
    await page.setExtraHTTPHeaders({ "x-info-maths-host": mathsHostToken() });
    await page.goto("/internal/info-maths"); await page.waitForFunction(() => !!window.infoMaths);
    for (const mediaKind of [undefined, "image"] as const) for (const sample of explanationReviews) {
      await page.evaluate(card => window.infoMaths!.mount(card), { title: "Maths", seriesTitle: "Basics", seriesCreatorUsername: "", bodyFormat: "latex-v1" as const, body: sample.content, mediaKind });
      await page.waitForFunction(() => window.infoMaths?.current?.result.status === "ready");
      const measured = await page.evaluate(() => window.infoMaths!.current!);
      expect(measured.safe).toBe(true); expect(measured.headerFits).toBe(true);
      const box = await page.locator("[data-info-card-face]").evaluate(el => ({ height: el.getBoundingClientRect().height, padding: getComputedStyle(el).padding, width: el.querySelector("[data-info-card-body]")!.getBoundingClientRect().width }));
      expect(box).toEqual({ height: 204, padding: "12px", width: 214 });
      expect(await page.locator(".katex-error").count()).toBe(0);
    }
    // Existing bottom padding absorbs overflow, then the physical boundary
    // rejects additional lines. Engines have different actual line metrics.
    let borrowedPadding = false, physicallyUnsafe = false;
    for (const lines of [14, 15, 16, 17, 18]) {
      await page.evaluate(body => window.infoMaths!.mount({ title: "Maths", seriesTitle: "Basics", seriesCreatorUsername: "", bodyFormat: "latex-v1", body }), Array(lines).fill("Line").join("\n"));
      await page.waitForFunction(() => window.infoMaths?.current?.result.status === "ready");
      const measured = await page.evaluate(() => window.infoMaths!.current!);
      expect(measured.result.status).toBe("ready");
      borrowedPadding ||= measured.result.status === "ready" && measured.result.layout.overflowY && measured.safe;
      physicallyUnsafe ||= !measured.safe;
    }
    expect(borrowedPadding).toBe(true); expect(physicallyUnsafe).toBe(true);
    await page.evaluate(() => window.infoMaths!.mount({ title: "Maths", seriesTitle: "Basics", seriesCreatorUsername: "", bodyFormat: "latex-v1", body: "$$\\rule{400px}{1px}$$" }));
    await page.waitForFunction(() => window.infoMaths?.current?.result.status === "ready");
    expect((await page.evaluate(() => window.infoMaths!.current!)).safe).toBe(false);
    // Legacy currency/backslashes are literal; no mathematical parser is mounted.
    await page.evaluate(() => window.infoMaths!.mount({ title: "Legacy", seriesTitle: "Basics", seriesCreatorUsername: "", body: "$5 and $10; \\frac{1}{2}" }));
    await expect(page.locator("[data-info-card-body]")).toHaveText("$5 and $10; \\frac{1}{2}");
    await expect(page.locator("[data-maths-renderer]")).toHaveCount(0);
  } finally { await browser.close(); }
});

for (const engine of ["chromium", "firefox", "webkit"] as const) test(`unmasked Library explanation · ${engine}: pending, fits, overflow, header and unavailable`, async () => {
  const browser = await ({ chromium, firefox, webkit })[engine].launch();
  const context = await browser.newContext({ ...(engine === "webkit" ? devices["iPhone 13"] : {}), baseURL: process.env.PHASE2_BASE_URL });
  const page = await context.newPage();
  let releaseFonts!: () => void;
  const fonts = new Promise<void>(resolve => { releaseFonts = resolve; });
  let body = "Visible explanation", title = "Maths";
  const id = "visible-maths";
  await page.route("**/api/library/info-cards?*", route => route.fulfill({ json: { items: [{
    infoCardId: id, version: 1, visibility: "public", ownerUserId: process.env.PHASE2_USER_ID, creatorUsername: "phase2",
    content: { title, body, bodyFormat: "latex-v1", seriesId: "demo-series-owner", mediaItem: null },
    series: { seriesId: "demo-series-owner", title: "Basics", createdByUserId: process.env.PHASE2_USER_ID, creatorUsername: "phase2" },
  }], nextOffset: null } }));
  const root = page.locator(`[data-info-id='${id}'] [data-maths-renderer]`);
  const face = page.locator(`[data-info-id='${id}'] [data-info-card-face]`);
  const visible = async () => {
    await expect(root).toBeVisible();
    expect(await root.evaluate(el => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        if (node.getAttribute("aria-hidden") === "true" || getComputedStyle(node).opacity === "0" || node.hasAttribute("inert")) return false;
      }
      return true;
    })).toBe(true);
    await expect(face.getByRole("alert")).toHaveCount(0);
    expect(await face.evaluate(el => ({ height: el.getBoundingClientRect().height, padding: getComputedStyle(el).padding, width: el.querySelector("[data-info-card-body]")!.getBoundingClientRect().width }))).toEqual({ height: 204, padding: "12px", width: 214 });
  };
  try {
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    await page.goto("/library?tab=info-cards");
    await expect(root).toHaveAttribute("data-maths-status", "ready"); await visible();
    // Delay a newly required mathematical font after the real Library mounts,
    // so a WebKit document preload cannot block the app's initial hydration.
    await page.route(/\.woff2?(\?|$)/, async route => { await fonts; await route.continue(); });
    body = "Visible explanation $\\mathbb{R}$";
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(root).toHaveAttribute("data-maths-status", "pending"); await visible();
    releaseFonts();
    await expect(root).toHaveAttribute("data-maths-status", "ready"); await visible();
    body = "Visible overflow $$\\rule{400px}{1px}$$";
    await page.reload(); await expect(root).toHaveAttribute("data-maths-status", "ready"); await visible();
    expect(await root.evaluate(el => el.getBoundingClientRect().width < el.scrollWidth)).toBe(true);
    body = Array(30).fill("Visible vertical overflow $x$").join("\n");
    await page.reload(); await expect(root).toHaveAttribute("data-maths-status", "ready"); await visible();
    expect(await root.evaluate(el => el.getBoundingClientRect().height > el.closest("[data-info-card-body]")!.getBoundingClientRect().height)).toBe(true);
    title = "Long title ".repeat(20); body = "Visible despite header $x=4$";
    await page.reload(); await expect(root).toHaveAttribute("data-maths-status", "ready"); await visible();
    expect(await face.evaluate(el => el.querySelector("[data-info-card-title]")!.getBoundingClientRect().right > el.getBoundingClientRect().right)).toBe(true);
    // Unsupported ancestor transforms make measurement unavailable, without hiding output.
    await face.evaluate(el => { el.style.transform = "rotate(2deg)"; });
    await expect(root).toHaveAttribute("data-maths-status", "measurement-unavailable");
    await expect(root).toBeVisible(); await expect(face.getByRole("alert")).toHaveCount(0);
  } finally { releaseFonts(); await browser.close(); }
});

test("mobile WebKit real consultation keeps an overflowing maths card visible", async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({ ...devices["iPhone 13"], baseURL: process.env.PHASE2_BASE_URL });
  const page = await context.newPage();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    assertDisposableDatabase();
    const main = new CardRepository(client.db(process.env.MONGODB_DB!), client), owner = process.env.PHASE2_USER_ID!;
    const card = await main.createCardDraft(owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), infoCardIds: ["demo-owner-public"],
      intro: { title: "Mobile maths", description: "Instruction", mediaItem: null },
      steps: [0, 1, 2].map(index => ({ stepId: randomUUID(), title: `Step ${index}`, description: "Instruction", mediaItem: null })) }, "private");
    await main.publishCard(owner, card.cardTemplateId, 0);
    const deck = await main.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "Mobile consultation", cards: [{ cardTemplateId: card.cardTemplateId }] }, "private");
    await main.publishDeck(owner, deck.deckTemplateId, 0); await main.ensureDeckData(owner, deck.deckTemplateId, 1); await main.ensureCardData(owner, card.cardTemplateId, 1);
    await page.route("**/api/card-templates/*/info-cards?*", async route => {
      const response = await route.fetch(), snapshot = await response.json();
      snapshot.entries[0].info.content = { ...snapshot.entries[0].info.content, bodyFormat: "latex-v1", body: "Visible overflow $$\\rule{400px}{1px}$$" };
      await route.fulfill({ response, json: snapshot });
    });
    let trustedReads = 0;
    page.on("request", req => { if (req.url().includes("/internal/info-maths")) trustedReads++; });
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    await page.goto(`/decks?openDeck=${deck.deckTemplateId}`); await page.locator(".deck-card.is-active").press("Enter");
    await page.locator(".focused-card-layer .active-card-identity").click();
    await page.getByRole("button", { name: /^Open information cards/ }).click();
    const stack = page.locator("[data-info-card-stack]"); await expect(stack).toHaveAttribute("data-info-stack-phase", "open");
    const maths = page.locator('[data-info-card-current="true"] [data-maths-renderer]');
    await expect(maths).toHaveAttribute("data-maths-status", "ready");
    await expect(maths).toBeVisible(); await expect(maths.locator(".katex")).toBeVisible();
    await expect(stack.getByRole("alert")).toHaveCount(0);
    expect(await maths.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(trustedReads).toBe(0);
  } finally { await client.close(); await browser.close(); }
});

test("Check rendering flushes current source, returns the actual card screenshot and never gates publication", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto("/creator/info-cards/new");
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption("demo-series-owner");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Maths check");
  const input = page.getByRole("textbox", { name: "Explanation", exact: true });
  await input.fill(explanationReviews[2].content);
  const response = page.waitForResponse(r => /\/check-rendering$/.test(r.url()) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Check rendering", exact: true }).click();
  await expect(page.getByText("Checking rendering…", { exact: true })).toBeVisible();
  const checked = await response, result = await checked.json(); expect(checked.status()).toBe(200);
  expect(result.measurement.result.status).toBe("ready"); expect(result.measurement.result.layout.available.width).toBe(214);
  expect(result.screenshot.width).toBe(240); expect(result.screenshot.height).toBe(204);
  const image = page.getByRole("img", { name: "Info Card rendered in Chromium" }); await expect(image).toBeVisible();
  expect(await image.evaluate(el => ({ width: (el as HTMLImageElement).naturalWidth, height: (el as HTMLImageElement).naturalHeight }))).toEqual({ width: 240, height: 204 });
  await test.info().attach("chromium-card", { body: Buffer.from(result.screenshot.dataUrl.split(",")[1], "base64"), contentType: "image/png" });
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const saved = await (await page.request.get(`/api/info-cards/${id}`)).json();
  expect(saved.root.revision).toBe(result.revision); expect(saved.root.latestVersion).toBe(0); expect(saved.root.draft.body).toBe(explanationReviews[2].content);
  // Delayed old result must disappear on edits while autosave keeps working.
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/check-rendering", async route => { await gate; await route.fulfill({ json: result }); });
  await page.getByRole("button", { name: "Check rendering", exact: true }).click();
  await input.fill("New explanation $x=4$"); release();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible(); await expect(image).toHaveCount(0);
  await page.unroute("**/check-rendering");
  // A real overflowing diagnostic remains visible and has an expanded image.
  await input.fill("$$\\rule{400px}{1px}$$\n" + Array(25).fill("Working $x$").join("\n"));
  const overflowResponse = page.waitForResponse(r => /\/check-rendering$/.test(r.url()));
  await page.getByRole("button", { name: "Check rendering", exact: true }).click();
  const overflow = await (await overflowResponse).json(); expect(overflow.measurement.result.layout.overflowX).toBe(true); expect(overflow.measurement.result.layout.overflowY).toBe(true);
  expect(overflow.screenshot.width).toBeGreaterThan(400); expect(overflow.screenshot.height).toBeGreaterThan(204);
  await expect(image).toBeVisible(); await expect(page.locator("[data-info-card-face] [data-maths-renderer]")).toBeVisible();
  // Publication still succeeds without a fit certificate, regardless of that diagnostic.
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible();
  const published = await (await page.request.get(`/api/info-cards/${id}`)).json(); expect(published.publication.mathsValidation).toBeUndefined();
});
