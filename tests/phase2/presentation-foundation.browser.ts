import { geometry } from "./helpers/presentationGeometry";
import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { readFile, writeFile } from "node:fs/promises";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { build } from "esbuild";
import { canonicalPresentationFixture } from "../fixtures/canonicalPresentation";
import type { CanonicalDeckPresentation } from "../../src/components/decks/presentation";
import { randomUUID } from "node:crypto";

let canonicalBundle: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ["tests/fixtures/canonicalPresentationHarness.tsx"], bundle: true, write: false,
    platform: "browser", format: "iife", jsx: "automatic", tsconfig: "tsconfig.json",
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_PHASE2_MOCK_MEDIA": '"1"' },
    plugins: [{ name: "no-working-dependencies", setup(builder) {
      builder.onResolve({ filter: /workingCardStore|useWorkingDeck|WorkingFocusedCardView|BackCardFaceContent|useKeyedUserCardMediaUploadController|userCardMediaMutationQueue/ }, ({ path }) => {
        throw new Error(`Canonical presentation must not initialize working dependency: ${path}`);
      });
    } }],
  });
  canonicalBundle = result.outputFiles[0].text;
});

function compareGeometry(actual: Record<string, number[]>, expected: Record<string, number[]>) {
  for (const [selector, rect] of Object.entries(actual)) rect.forEach((value, index) =>
    expect(Math.abs(value - expected[selector][index]), `${selector} coordinate ${index}`).toBeLessThanOrEqual(1));
}

test("working upload survives focused Card navigation and saves against its original identity", async ({ page }) => {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  let releaseUpload!: () => void;
  const heldUpload = new Promise<void>((resolve) => { releaseUpload = resolve; });
  try {
    const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = process.env.PHASE2_USER_ID!;
    const deckId = randomUUID(), cardIds = [randomUUID(), randomUUID()];
    const cards = cardIds.map((cardTemplateId, index) => ({ cardTemplateId, content: {
      ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]),
      intro: { title: `Upload practice ${index + 1}`, description: null, mediaItem: null },
    } }));
    await repo.createPrivateGraph(actor, deckId, { ...createDefaultDeckContent([]), title: "Upload lifetime fixture", cards: cardIds.map((cardTemplateId) => ({ cardTemplateId })) }, cards);
    for (const cardId of cardIds) await repo.publishCard(actor, cardId, 0);
    await repo.publishDeck(actor, deckId, 0);
    await page.goto("/decks");
    await page.getByLabel("Username or email").fill("phase2"); await page.getByLabel("Password", { exact: true }).fill("local-test-only");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Open Upload lifetime fixture", exact: true }).last().click();
    await page.locator(".deck-card[role=button]").press("Enter");
    const headerSelector = ".focused-card-surface--front .card-title-anchor";
    const header = (await geometry(page, [headerSelector]))[headerSelector];
    await page.mouse.move(header[0] + header[2] * .75, header[1] + header[3] / 2);
    await page.mouse.down(); await page.mouse.move(header[0] + header[2] * .75 + 220, header[1] + header[3] / 2, { steps: 12 }); await page.mouse.up();
    await page.getByRole("button", { name: "Add media", exact: true }).click();
    let requestStarted = false;
    await page.route("**/api/media/images/direct-upload", async (route) => {
      requestStarted = true; await heldUpload; await route.continue();
    });
    await page.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "pending-evidence.png", mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") });
    await expect.poll(() => requestStarted).toBe(true);
    const mediaDialog = page.getByRole("dialog", { name: "Card media", exact: true });
    await mediaDialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(mediaDialog).toHaveCount(0);
    const backHeaderSelector = ".focused-card-surface--back .card-title-anchor";
    const backHeader = (await geometry(page, [backHeaderSelector]))[backHeaderSelector];
    await page.mouse.move(backHeader[0] + backHeader[2] / 2, backHeader[1] + backHeader[3] / 2);
    await page.mouse.down(); await page.mouse.move(backHeader[0] + backHeader[2] / 2, backHeader[1] + backHeader[3] / 2 + 170, { steps: 12 }); await page.mouse.up();
    await expect(page.locator(".focused-card-surface--front .active-card-identity")).toHaveCount(1);
    await expect(page.locator(".focused-card-surface--front .active-card-identity")).toContainText("Upload practice 2");
    releaseUpload();
    await expect.poll(async () => (await repo.getPersonalUser(actor))!.cardsData.find((data) => data.cardTemplateId === cardIds[0])!.mediaItems.length).toBe(1);
    const user = (await repo.getPersonalUser(actor))!;
    expect(user.cardsData.find((data) => data.cardTemplateId === cardIds[1])!.mediaItems).toEqual([]);
    const media = user.cardsData.find((data) => data.cardTemplateId === cardIds[0])!.mediaItems[0];
    expect("assetId" in media ? media.assetId : "").toContain(cardIds[0]);
    await expect(page.locator(".focused-card-surface--front .active-card-identity")).toContainText("Upload practice 2");
  } finally { releaseUpload(); await client.close(); }
});

async function renderCanonical(page: Page, deck: CanonicalDeckPresentation, collection = false) {
  await page.evaluate(({ deck, collection }) => {
    (window as unknown as { renderPresentationFixture: (deck: CanonicalDeckPresentation, collection: boolean) => void }).renderPresentationFixture(deck, collection);
  }, { deck, collection });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  for (const username of ["Ada", "a_creator_with_an_exceptionally_long_username"]) {
    test(`Card attribution remains face-anchored and proportional across active/focused/past views ${viewport.width} ${username}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
      await page.goto("/library");
      const styles = await page.evaluate(() => Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).map((node) => node.outerHTML).join(""));
      const bodyClass = await page.locator("body").getAttribute("class");
      await page.route("**/__attribution-fixture", (route) => route.fulfill({ contentType: "text/html",
        body: `<html><head>${styles}</head><body class="${bodyClass ?? ""}"><div id="fixture"></div></body></html>` }));
      await page.goto("/__attribution-fixture");
      await page.addScriptTag({ content: canonicalBundle });
      const source = canonicalPresentationFixture(viewport.width);
      const immediateSourceUsername = username === "Ada" ? null : "Earlier creator";
      await renderCanonical(page, { ...source, cards: source.cards.map((card) => ({ ...card, creator: { username, immediateSourceUsername } })) });
      const inspect = async (selector: string, view: string) => {
        const attribution = `${selector} .card-creator-attribution`;
        await geometry(page, [selector, attribution]);
        const values = await page.locator(attribution).evaluate((element) => {
          const face = element.parentElement as HTMLElement, label = element as HTMLElement;
          const name = label.querySelector<HTMLElement>(".card-creator-name")!;
          return {
            faceAnchored: label.offsetParent === face,
            bottomProportion: (face.clientHeight - label.offsetTop - label.offsetHeight) / face.clientHeight,
            fontProportion: parseFloat(getComputedStyle(label).fontSize) / face.clientWidth,
            centered: Math.abs(label.offsetLeft - face.clientWidth / 2) <= 1,
            fits: label.offsetWidth <= face.clientWidth - 39 && name.clientWidth <= label.clientWidth,
            name: name.textContent, title: name.title,
            overflow: getComputedStyle(name).textOverflow,
            scale: getComputedStyle(face.parentElement!).transform,
          };
        });
        expect(values.faceAnchored).toBe(true);
        expect(values.centered).toBe(true);
        expect(values.bottomProportion).toBeGreaterThanOrEqual(.03);
        expect(values.bottomProportion).toBeLessThanOrEqual(.05);
        expect(values.fontProportion).toBeGreaterThan(.025);
        expect(values.fontProportion).toBeLessThan(.045);
        expect(values.fits).toBe(true);
        expect(values.name).toBe(username); expect(values.title).toBe(username);
        expect(values.overflow).toBe("ellipsis");
        await testInfo.attach(`${view}-attribution`, { body: JSON.stringify(values, null, 2), contentType: "application/json" });
        await page.screenshot({ path: testInfo.outputPath(`${view}.png`), fullPage: true });
        // The existing past-Card position can extend below the viewport. Capture
        // its complete face as well, without changing the Card or viewport size.
        if (view === "past") await page.locator(selector).screenshot({ path: testInfo.outputPath("past-card.png") });
        return values;
      };
      await expect(page.locator(".deck-card.is-active")).toBeVisible();
      const active = await inspect(".deck-card.is-active .deck-card-surface--front", "active");
      await page.locator(".deck-card.is-active").press("Enter");
      const focused = await inspect(".focused-card-surface--front", "focused");
      expect(Math.abs(active.fontProportion - focused.fontProportion)).toBeLessThan(.001);
      expect(Math.abs(active.bottomProportion - focused.bottomProportion)).toBeLessThan(.003);
      if (immediateSourceUsername) {
        await page.locator(".focused-card-surface--front .card-creator-name").click();
        await expect(page.locator(".focused-card-surface--front .card-source-attribution")).toHaveText("Source: Earlier creator");
        await page.locator(".focused-card-surface--front .card-creator-name").press("Escape");
      }
      const headerSelector = ".focused-card-surface--front .card-title-anchor";
      const rect = (await geometry(page, [headerSelector]))[headerSelector];
      await page.mouse.move(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2);
      await page.mouse.down(); await page.mouse.move(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2 + 170, { steps: 12 }); await page.mouse.up();
      // The outgoing and incoming faces coexist while the navigation animation runs.
      await expect(page.locator(".focused-card-surface--front .active-card-identity")).toHaveCount(1);
      await expect(page.locator(".focused-card-surface--front .active-card-identity")).toContainText("Practice 2");
      await page.getByRole("button", { name: "Close focused card", exact: true }).click({ position: { x: 8, y: 8 } });
      const past = await inspect(".deck-card.is-past .deck-card-surface--front", "past");
      expect(Math.abs(active.fontProportion - past.fontProportion)).toBeLessThan(.001);
      expect(Math.abs(active.bottomProportion - past.bottomProportion)).toBeLessThan(.003);
      expect(past.scale).toMatch(/^matrix\(0\.58/); // Existing whole-Card scale applies to attribution too.
    });
  }
}


for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`working presentation geometry ${viewport.width}`, async ({ page }, testInfo) => {
    assertDisposableDatabase();
    const client = await new MongoClient(process.env.MONGODB_URI!).connect();
    const deckId = `presentation-foundation-${viewport.width}`;
    try {
      const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client);
      const actor = process.env.PHASE2_USER_ID!;
      // Isolate collection geometry from other independent browser fixtures.
      await repo.users().updateOne({ _id: new ObjectId(actor) }, { $set: { decksData: [] } });
      const cards = [0, 1, 2].map((index) => {
        const cardTemplateId = `${deckId}-card-${index}`;
        const content = createDefaultCardContent([0, 1, 2].map((step) => `${cardTemplateId}-step-${step}`));
        content.intro.title = `Practice ${index + 1}`;
        content.steps = content.steps.map((step, position) => ({ ...step, title: `Step ${position + 1}`, description: `Instruction ${position + 1}` }));
        return { cardTemplateId, content };
      });
      const content = { ...createDefaultDeckContent(["theme-1", "theme-2", "theme-3"]), title: `Presentation ${viewport.width}`, cards: cards.map(({ cardTemplateId }) => ({ cardTemplateId })) };
      await repo.createPrivateGraph(actor, deckId, content, cards);
      for (const card of cards) await repo.publishCard(actor, card.cardTemplateId, 0);
      await repo.publishDeck(actor, deckId, 0);
      // Personal dates are real fixture state, fixed so geometry does not depend
      // on the wall clock. The normal open still establishes the cadence anchor.
      await repo.users().updateOne({ _id: new ObjectId(actor) }, { $set: Object.fromEntries(cards.map((_, index) =>
        [`cardsData.$[c${index}].targetDate`, `2026-10-${15 + index * 7}`])) },
      { arrayFilters: cards.map((card, index) => ({ [`c${index}.cardTemplateId`]: card.cardTemplateId })) });
      await page.setViewportSize(viewport);
      await page.goto("/decks");
      await page.getByLabel("Username or email").fill("phase2");
      await page.getByLabel("Password", { exact: true }).fill("local-test-only");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.getByRole("heading", { name: "My decks" })).toBeVisible();
      // A fresh runner supplies only this fixture. Collection placement is part of the baseline.
      const tile = page.locator(".deck-tile").filter({ hasText: content.title });
      await expect(tile).toBeVisible();
      const collection = await geometry(page, [".deck-grid", ".deck-tile", ".tile-card-stack", ".deck-tile-title", ".deck-tile-meta"]);
      await page.getByRole("button", { name: `Open ${content.title}`, exact: true }).last().click();
      await expect(page.locator(".deck-detail h1")).toHaveText(content.title);
      const detail = await geometry(page, [".deck-detail", ".detail-heading", ".deck-scene-frame", ".deck-card.is-active", ".deck-card.is-active .card-title-anchor", ".deck-card.is-active .deck-card-date-shell", ".deck-card.is-active .active-card-identity", ".deck-card.is-active .active-step-list"]);
      const detailTitle = await geometry(page, [".deck-card.is-active .card-title-anchor h2"]);
      await page.locator(".deck-card[role=button]").press("Enter");
      await expect(page.locator(".focused-card-stage")).toBeVisible();
      const focused = await geometry(page, [".focused-card-stage", ".focused-card-object", ".focused-card-surface--front .card-title-anchor", ".focused-card-surface--front .deck-card-date-shell", ".focused-card-surface--front .active-card-identity", ".focused-card-surface--front .active-step-list", ".focused-card-surface--front .active-step-item"]);
      const focusedTitle = await geometry(page, [".focused-card-surface--front .card-title-anchor h2"]);
      const actual = { collection, detail, focused };
      const baselinePath = `tests/fixtures/presentation-${viewport.width}.json`;
      if (process.env.PHASE4_CAPTURE_BASELINE === "1") {
        await writeFile(`/tmp/p4-c1-geometry-${viewport.width}.json`, JSON.stringify(actual, null, 2));
      } else {
        const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as typeof actual;
        for (const section of ["collection", "detail", "focused"] as const) for (const [selector, rect] of Object.entries(actual[section])) {
          rect.forEach((value, index) => expect(Math.abs(value - baseline[section][selector][index]), `${section} ${selector} coordinate ${index}`).toBeLessThanOrEqual(1));
        }
      }
      await page.screenshot({ path: testInfo.outputPath(`working-${viewport.width}.png`), fullPage: true });
      // Keep the fixture's state explicit: the normal working opening establishes the anchor.
      const user = await repo.users().findOne({ _id: new ObjectId(actor) });
      expect(user!.decksData.find((deck) => deck.deckTemplateId === deckId)!.cadenceAnchorDate).not.toBeNull();

      // Next dev can inject styles inline; preserve both modes and font URL bases.
      const styles = await page.evaluate(() => Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).map((node) => node.outerHTML).join(""));
      const bodyClass = await page.locator("body").getAttribute("class");
      const canonicalRequests: string[] = [];
      page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) canonicalRequests.push(request.url()); });
      // A test-intercepted document keeps fonts/styles same-origin without loading
      // any application route, working scripts, or personal controllers.
      await page.route("**/__presentation-fixture", (route) => route.fulfill({ contentType: "text/html",
        body: `<html><head>${styles}</head><body class="${bodyClass ?? ""}"><div id="fixture"></div></body></html>` }));
      await page.goto("/__presentation-fixture");
      await expect.poll(() => page.locator("body").evaluate((body) => getComputedStyle(body).margin)).toBe("0px");
      await page.addScriptTag({ content: canonicalBundle });
      const canonical = canonicalPresentationFixture(viewport.width);
      await renderCanonical(page, canonical, true);
      await expect(page.locator(".deck-tile")).toBeVisible();
      compareGeometry(await geometry(page, Object.keys(collection)), collection);
      await page.getByRole("button", { name: `Open ${content.title}`, exact: true }).last().click();
      await expect(page.locator(".deck-detail h1")).toHaveText(content.title);
      // Personal date width varies with its text; all remaining visible anchors must coincide.
      const detailAnchors = Object.keys(detail).filter((selector) => !selector.includes("card-title-anchor") && !selector.includes("date-shell"));
      compareGeometry(await geometry(page, detailAnchors), detail);
      compareGeometry(await geometry(page, Object.keys(detailTitle)), detailTitle);
      await page.locator(".deck-card[role=button]").press("Enter");
      await expect(page.locator(".focused-card-stage")).toBeVisible();
      const focusedAnchors = Object.keys(focused).filter((selector) => !selector.includes("card-title-anchor") && !selector.includes("date-shell"));
      compareGeometry(await geometry(page, focusedAnchors), focused);
      compareGeometry(await geometry(page, Object.keys(focusedTitle)), focusedTitle);
      await expect(page.getByLabel("Progress preview")).toHaveCount(0);
      await expect(page.locator(".completion-strip-fill, .step-progress-fill, .focused-card-surface--back, .card-reflection-editor, .user-card-media-editor")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /target date|completion|Add media|Add reflection/i })).toHaveCount(0);
      await expect(page.locator(".deck-card-date").first()).toBeEmpty();
      await page.screenshot({ path: testInfo.outputPath(`canonical-${viewport.width}.png`), fullPage: true });

      // Instructional navigation is real, with no completion callback or personal projection.
      await page.locator(".focused-card-surface--front .active-step-item").first().click();
      await expect(page.getByRole("region", { name: "STEP 1 detail" })).toContainText("Instruction 1");
      await page.getByRole("region", { name: "STEP 1 detail" }).getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByRole("region", { name: "STEP 2 detail" })).toContainText("Instruction 2");
      await page.getByRole("region", { name: "STEP 2 detail" }).getByRole("button", { name: "Close step view", exact: true }).click();
      await expect(page.locator(".step-view-close")).toHaveCount(0);
      const header = await page.locator(".focused-card-surface--front .card-semantic-anchors").boundingBox();
      await page.mouse.move(header!.x + header!.width / 2, header!.y + header!.height / 2);
      await page.mouse.down(); await page.mouse.move(header!.x + header!.width / 2 + 180, header!.y + header!.height / 2, { steps: 12 }); await page.mouse.up();
      await expect(page.locator(".focused-card-surface--back")).toHaveCount(0);
      // Immutable identity changes reset presentation state, independently of any working cache.
      await renderCanonical(page, { ...canonical, version: 2, title: "Revised canonical presentation" });
      await expect(page.locator(".deck-detail h1")).toHaveText("Revised canonical presentation");
      await expect(page.locator(".focused-card-layer")).toHaveCount(0);
      await renderCanonical(page, { ...canonical, version: 3, cards: [] });
      await expect(page.locator(".deck-detail h1")).toHaveText(content.title);
      await expect(page.locator(".deck-card, .focused-card-layer")).toHaveCount(0);

      expect(canonicalRequests).toEqual([]);
      // These presentation-only fixtures have no public database counterparts.
      // Playback now performs a public-version-authorized read; mock that read
      // here, while the real Library/API suites test its authorization boundary.
      await page.route("**/api/library/media/stream-status?**", (route) => {
        expect(route.request().method()).toBe("GET");
        return route.fulfill({ json: { status: "ready" } });
      });
      // Exercise the shared media hosts with deterministic unavailable delivery,
      // rather than relying on a real external Stream account in this fixture.
      await page.route("https://videodelivery.net/**", (route) => route.fulfill({ status: 404, body: "Fixture media unavailable" }));
      const video = (index: number) => ({ id: `fixture-video-${index}`, description: `Canonical instructional video ${index}`, mediaType: "video" as const, provider: "cloudflare-stream" as const,
        assetId: `fixture-video-${index}`, src: `https://videodelivery.net/fixture-video-${index}`, width: 1920, height: 1080 });
      await renderCanonical(page, { ...canonical, version: 4, introduction: { image: null, video: video(0) },
        cards: canonical.cards.map((card, index) => index ? card : { ...card, steps: card.steps.map((step, position) => ({ ...step, mediaItem: video(position + 1) })) }) });
      const introPlayer = page.locator(".deck-intro-viewer-layer video");
      await expect(introPlayer).toHaveCount(1);
      const introPlayerId = await introPlayer.getAttribute("data-diag-video-id");
      expect(introPlayerId).toBeTruthy();
      await page.getByRole("button", { name: `Play introduction video for ${content.title}`, exact: true }).click();
      await page.getByRole("button", { name: "Close enlarged video", exact: true }).click();
      await expect(introPlayer).toHaveAttribute("data-diag-video-id", introPlayerId!);
      await page.locator(".deck-card[role=button]").press("Enter");
      await page.locator(".focused-card-surface--front .active-step-item").first().click();
      const stepPlayer = page.locator(".switchplay-video-host video");
      await expect(stepPlayer).toHaveCount(1);
      const stepPlayerId = await stepPlayer.getAttribute("data-diag-video-id");
      expect(stepPlayerId).toBeTruthy();
      await page.getByRole("region", { name: "STEP 1 detail" }).getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByRole("region", { name: "STEP 2 detail" })).toBeVisible();
      await expect(stepPlayer).toHaveAttribute("data-diag-video-id", stepPlayerId!);
      await expect(page.locator(".focused-card-surface--back")).toHaveCount(0);
      expect(canonicalRequests.length).toBeGreaterThan(0);
      expect(canonicalRequests.every((url) => new URL(url).pathname === "/api/library/media/stream-status")).toBe(true);
      // Poster/overlay rerenders must not restart authorization or polling.
      for (const asset of ["fixture-video-0", "fixture-video-1", "fixture-video-2"]) {
        expect(canonicalRequests.filter((url) => new URL(url).searchParams.get("assetId") === asset)).toHaveLength(1);
      }
    } finally { await client.close(); }
  });
}
