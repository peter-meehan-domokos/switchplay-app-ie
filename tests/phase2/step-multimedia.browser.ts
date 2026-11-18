import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import type { StepMediaItem } from "../../src/lib/stepMedia";
import { geometry } from "./helpers/presentationGeometry";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
async function fixture(page: Page, options: { fourVisuals?: boolean; canonical?: boolean; introCount?: 1 | 2 | 3; videoFirst?: boolean } = {}) {
  const thumbnails: string[] = [];
  await page.route("https://videodelivery.net/**", route => route.abort());
  await page.route("https://videodelivery.net/**/thumbnails/**", route => { thumbnails.push(route.request().url()); return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#234"/></svg>' }); });
  const db = client.db(process.env.MONGODB_DB!), repo = new CardRepository(db, client, "1");
  const seed = (await db.collection("users").findOne({ username: "phase2" }))!, id = new ObjectId(), username = `media-${randomUUID()}`, now = new Date();
  await db.collection("users").insertOne({ _id: id, username, email: `${username}@example.invalid`, passwordHash: seed.passwordHash, cardsData: [], decksData: [], createdAt: now, updatedAt: now });
  const actor = id.toHexString();
  const video = (id: string, label: string): StepMediaItem & { kind: "video" } => ({ id, label, kind: "video", media: {
    id, mediaType: "video", provider: "cloudflare-stream", assetId: `fixture-${id}`, src: `https://iframe.videodelivery.net/fixture-${id}`, description: id, width: 1920, height: 1080,
  } });
  const image: StepMediaItem = { id: "diagram", label: "Image", kind: "image", alt: "A mathematical diagram", media: {
    id: "image", mediaType: "image", provider: "cloudflare-r2", assetId: "fixtures/diagram.png", src: `${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/assets/fixtures/diagram.png`, description: "Diagram",
  } };
  const visual = (id: string): StepMediaItem => ({ id, label: "Explore", kind: "activity", activityId: "roots-and-factors" });
  const a = video("a", "Watch"), b = video("b", "Again"), defaults = createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]);
  const card = await repo.createCardDraft(actor, { ...defaults, intro: { title: "Mixed media practice", description: null,
    mediaItems: options.fourVisuals ? [visual("one"), visual("two"), visual("three"), visual("four")]
      : (options.videoFirst ? [a, image, visual("roots"), b] : [image, a, visual("roots"), b]).slice(0, options.introCount ?? 4) },
    steps: defaults.steps.map((step, index) => index === 0 ? { stepId: step.stepId, title: "Try", description: "Compare media.", mediaItems: [a, { ...a, id: "repeat", label: "Repeat" }, visual("practice"), image] }
      : index === 1 ? { stepId: step.stepId, description: "Explore roots.", mediaItems: [visual("only")] } : { ...step, description: "No media." }),
  }, "public");
  await repo.publishCard(actor, card.cardTemplateId, 0);
  const deck = await repo.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Multimedia", cards: [{ cardTemplateId: card.cardTemplateId }] }, "public");
  await repo.publishDeck(actor, deck.deckTemplateId, 0);
  if (!options.canonical) { await repo.ensureDeckData(actor, deck.deckTemplateId, 1); await repo.openWorkingDeck(actor, deck.deckTemplateId, "2026-10-30"); }
  await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } });
  return { repo, actor, card, deck, thumbnails, url: options.canonical ? `/library/${deck.deckTemplateId}` : `/decks?openDeck=${deck.deckTemplateId}` };
}
async function openIntro(page: Page, url: string) {
  await page.goto(url); await page.locator(".deck-card.is-active").press("Enter"); await geometry(page, [".focused-card-surface--front"]);
  await page.locator(".focused-card-surface--front .active-card-identity[role=button]").click();
  const step = page.locator(".step-view-layer"); await expect(step).toHaveAttribute("data-step-view-item", "intro"); await geometry(page, [".step-view-layer"]); return step;
}
async function navigate(page: Page, name: "Next" | "Previous") {
  await page.locator(".step-view-layer").getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".step-view-layer")).toHaveCount(1);
}

test("mixed tabs preserve the Introduction video thumbnail, embedded image, visual origin and first selection on step entry", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 }); const f = await fixture(page), before = await f.repo.getPersonalUser(f.actor);
  const step = await openIntro(page, f.url);
  await expect(page.locator(".focused-card-surface--front .intro-media-thumb")).toHaveAttribute("aria-label", "a");
  await expect.poll(() => f.thumbnails.some(url => url.includes("/fixture-a/"))).toBe(true);
  await expect(step.getByRole("tab")).toHaveCount(4); await expect(step.getByRole("tab", { name: "Image", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(step.getByRole("img", { name: "A mathematical diagram", exact: true })).toBeVisible();
  expect(await step.getByRole("img", { name: "A mathematical diagram", exact: true }).evaluate(node => getComputedStyle(node).objectFit)).toBe("contain");
  await expect.poll(() => step.getByRole("img", { name: "A mathematical diagram", exact: true }).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await step.getByRole("tab", { name: "Explore", exact: true }).click();
  const preview = step.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ }); await expect(preview).toBeEnabled();
  await expect(preview).toHaveAccessibleName("Start: Roots and Factors");
  expect(await client.db(process.env.MONGODB_DB!).collection("visualRecords").countDocuments({ principalKey: `account:${f.actor}` })).toBe(0);
  expect(await client.db(process.env.MONGODB_DB!).collection("visualVisits").countDocuments({ "source.cardId": f.card.cardTemplateId })).toBe(0);
  const previewBox = await preview.boundingBox(), panelBox = await step.getByRole("tabpanel").boundingBox(), labelBox = await preview.getByText("Start", { exact: true }).boundingBox();
  expect(previewBox!.width).toBeCloseTo(panelBox!.width, 1);
  expect(labelBox!.x + labelBox!.width / 2).toBeCloseTo(previewBox!.x + previewBox!.width / 2, 1);
  expect(labelBox!.y + labelBox!.height / 2).toBeCloseTo(previewBox!.y + previewBox!.height / 2, 1);
  await step.screenshot({ path: "/private/tmp/visual-ux-preview-start-320.png" });
  await preview.click({ position: { x: 5, y: 5 } });
  const host = page.getByRole("dialog", { name: "Roots and Factors", exact: true }); await host.getByRole("slider").focus(); await page.keyboard.press("ArrowRight");
  await expect(host).toHaveAttribute("data-visual-save-status", "Saved");
  await host.getByRole("button", { name: "Close interactive visual" }).click(); await expect(preview).toBeFocused();
  await expect(preview).toHaveAccessibleName("Continue: Roots and Factors");
  await expect(step.getByRole("tab", { name: "Explore", exact: true })).toHaveAttribute("aria-selected", "true");
  await navigate(page, "Next");
  await expect(step.getByRole("tab", { name: "Watch", exact: true })).toHaveAttribute("aria-selected", "true");
  await step.getByRole("tab", { name: "Image", exact: true }).click(); await navigate(page, "Previous");
  await expect(step.getByRole("tab", { name: "Image", exact: true })).toHaveAttribute("aria-selected", "true");
  await navigate(page, "Next"); await navigate(page, "Next");
  await expect(step.getByRole("tablist")).toHaveCount(0); await expect(step.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ })).toBeVisible();
  await navigate(page, "Next"); await expect(step.getByRole("tablist")).toHaveCount(0); await expect(step).toContainText("Video placeholder");
  const after = await f.repo.getPersonalUser(f.actor); expect(after!.cardsData[0].items).toEqual(before!.cardsData[0].items);
});

test("four untruncated Explore labels fit together at 320px with stable readable typography and keyboard tabs", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 }); const f = await fixture(page, { fourVisuals: true, canonical: true });
  const step = await openIntro(page, f.url); await expect(page.locator(".focused-card-surface--front .intro-media-thumb")).toHaveCount(0);
  const tabs = step.getByRole("tab"), row = step.getByRole("tablist"); await expect(tabs).toHaveCount(4);
  const bounds = await row.evaluate(element => {
    const row = element.getBoundingClientRect(), tabs = [...element.children].map(child => {
      const box = child.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(child);
      const text = range.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, textX: text.x, textRight: text.right,
        font: parseFloat(getComputedStyle(child).fontSize) * row.width / (element as HTMLElement).offsetWidth };
    }); return { x: row.x, right: row.right, tabs };
  });
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(320);
  for (const tab of bounds.tabs) { expect(tab.y).toBeCloseTo(bounds.tabs[0].y, 1); expect(tab.right).toBeLessThanOrEqual(bounds.right + 0.2); expect(tab.textX).toBeGreaterThanOrEqual(tab.x); expect(tab.textRight).toBeLessThanOrEqual(tab.right); expect(tab.font).toBeCloseTo(14, 1); }
  await tabs.first().focus(); await page.keyboard.press("ArrowRight"); await expect(tabs.nth(1)).toBeFocused(); await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End"); await expect(tabs.last()).toBeFocused(); await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
  const colours = await tabs.evaluateAll(nodes => nodes.map(node => { const css = getComputedStyle(node); return { selected: node.getAttribute("aria-selected"), background: css.backgroundColor, colour: css.color, shadow: css.boxShadow }; }));
  expect(colours[3].background).not.toBe(colours[0].background); expect(colours[3].colour).not.toBe(colours[0].colour); expect(colours[3].shadow).not.toBe("none");
  await step.screenshot({ path: "/private/tmp/plugged-in-learner-tabs-320.png" });
});

for (const count of [1, 2, 3] as const) {
  test(`${count} ordered media keep the first video embedded with a tab bar only when there are multiple items`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    const f = await fixture(page, { introCount: count, videoFirst: true }), step = await openIntro(page, f.url);
    await expect(page.locator(".switchplay-video-host video")).toHaveCount(1);
    await expect(page.locator(".switchplay-video-host video")).toHaveAttribute("controls", "");
    // Interactive Visual cover/cropping styles must never reach legacy video geometry.
    expect(await step.locator(".step-view-video-placeholder").evaluate(node => ({ aspect: getComputedStyle(node).aspectRatio, padding: getComputedStyle(node).padding }))).toEqual({ aspect: "16 / 9", padding: "0px" });
    await expect(step.getByRole("tab")).toHaveCount(count === 1 ? 0 : count);
    if (count > 1) {
      await expect(step.getByRole("tab", { name: "Watch", exact: true })).toHaveAttribute("aria-selected", "true");
      await step.getByRole("tab", { name: "Image", exact: true }).click();
      await expect(step.getByRole("img", { name: "A mathematical diagram", exact: true })).toBeVisible(); await expect(page.locator(".switchplay-video-host video")).toHaveCount(0);
      expect(await step.getByRole("img", { name: "A mathematical diagram", exact: true }).evaluate(node => getComputedStyle(node).objectFit)).toBe("contain");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });
}

test("image expansion reuses exact-context bytes, keeps its selected tab and revokes resources when the Card closes", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.addInitScript(() => {
    const revoke = URL.revokeObjectURL;
    (window as unknown as { revokedImageUrls: string[] }).revokedImageUrls = [];
    URL.revokeObjectURL = url => { (window as unknown as { revokedImageUrls: string[] }).revokedImageUrls.push(url); revoke.call(URL, url); };
  });
  const requests: string[] = []; page.on("request", request => { if (request.url().includes("/api/media/instructional-image?")) requests.push(request.url()); });
  const f = await fixture(page), step = await openIntro(page, f.url), image = step.getByRole("img", { name: "A mathematical diagram", exact: true });
  await expect(image).toBeVisible(); await expect(step.getByRole("button", { name: "Expand image", exact: true })).toBeEnabled();
  const initialRequests = requests.length; // Development Strict Mode can cancel its first setup request.
  const source = await image.getAttribute("src"); expect(source).toMatch(/^blob:/);
  await step.getByRole("button", { name: "Expand image", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Expanded instructional image", exact: true }); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "A mathematical diagram", exact: true })).toHaveAttribute("src", source!);
  await expect(dialog.getByRole("button", { name: "Close expanded image", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Zoom in", exact: true }).click(); await expect(dialog.getByLabel("Zoom level", { exact: true })).toHaveText("150%");
  await expect(dialog.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  expect(await dialog.evaluate(element => ({ width: element.getBoundingClientRect().width, scroll: element.scrollHeight > element.clientHeight }))).toEqual({ width: 320, scroll: false });
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(step.getByRole("button", { name: "Expand image", exact: true })).toBeFocused();
  await expect(step.getByRole("tab", { name: "Image", exact: true })).toHaveAttribute("aria-selected", "true");
  await step.getByRole("tab", { name: "Explore", exact: true }).click(); await step.getByRole("tab", { name: "Image", exact: true }).click();
  await expect(image).toHaveAttribute("src", source!); expect(requests).toHaveLength(initialRequests);
  await step.getByRole("button", { name: "Close step view" }).click(); await expect(step).toHaveCount(0);
  await page.locator(".focused-card-surface--front .active-card-identity").click(); await expect(image).toHaveAttribute("src", source!); expect(requests).toHaveLength(initialRequests);
  await step.getByRole("button", { name: "Close step view" }).click(); await expect(step).toHaveCount(0);
  await page.getByRole("button", { name: "Close focused card", exact: true }).focus(); await page.keyboard.press("Enter"); await expect(page.locator(".focused-card-layer")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { revokedImageUrls: string[] }).revokedImageUrls)).toContain(source);
});

test("denied image bytes have no provider fallback, and explicit Retry recovers without changing the tab or Card state", async ({ page }) => {
  const f = await fixture(page); let requests = 0, allowed = false;
  await page.route("**/api/media/instructional-image?**", route => { requests++; return allowed ? route.continue() : route.fulfill({ status: 403, json: { code: "FORBIDDEN" } }); });
  const step = await openIntro(page, f.url); await expect(step).toContainText("Image unavailable."); await expect(step.getByRole("img")).toHaveCount(0);
  await expect(step.getByRole("button", { name: "Expand image", exact: true })).toHaveCount(0);
  const deniedRequests = requests; allowed = true;
  await step.getByRole("button", { name: "Retry image", exact: true }).click();
  await expect(step.getByRole("img", { name: "A mathematical diagram", exact: true })).toBeVisible(); await expect(step.getByRole("button", { name: "Expand image", exact: true })).toBeEnabled();
  await expect(step.getByRole("tab", { name: "Image", exact: true })).toHaveAttribute("aria-selected", "true"); expect(requests).toBe(deniedRequests + 1);
});
