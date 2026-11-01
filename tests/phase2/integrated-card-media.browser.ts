import { readFileSync } from "node:fs";
import { expect, test, type Page, type Locator } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { libraryDeckAction } from "./deck-menu-helpers";
import { geometry } from "./helpers/presentationGeometry";

const image = (name = "Graph.png") => ({ name, mimeType: "image/png", buffer: readFileSync("public/interactive-visuals/roots-and-factors-v1.png") });
const video = { name: "Example.mp4", mimeType: "video/mp4", buffer: Buffer.from("disposable provider upload fixture") };
async function login(page: Page, username: string) {
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).ok()).toBe(true);
}
async function moveRoot(page: Page, root: number) {
  const slider = page.getByRole("dialog").getByRole("slider"), start = (await slider.boundingBox())!;
  const target = await page.getByRole("img", { name: "Quadratic graph" }).evaluate((element, value) => {
    const svg = element as SVGSVGElement, rect = svg.getBoundingClientRect(), plot = svg.querySelector("clipPath rect")!;
    return { x: rect.x + (Number(plot.getAttribute("x")) + Number(plot.getAttribute("width")) * (value + 6) / 12) * rect.width / svg.viewBox.baseVal.width,
      y: rect.y + (Number(plot.getAttribute("y")) + Number(plot.getAttribute("height")) / 2) * rect.height / svg.viewBox.baseVal.height };
  }, root);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 }); await page.mouse.up();
  await expect(slider).toHaveAttribute("aria-valuenow", String(root));
}
async function reachable(control: Locator, height: number) {
  const r = (await control.boundingBox())!; expect(r.y).toBeGreaterThanOrEqual(0); expect(r.y + r.height).toBeLessThanOrEqual(height + .2);
  expect(await control.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
}
async function saved(host: Locator) {
  await expect(host).toHaveAttribute("data-visual-save-status", "Saved");
  await expect(host.locator('[role="status"], [role="alert"]').filter({ hasText: /^(Saved|Saving|Changes pending|Previous attempt pending backup)[.…]*$/ })).toHaveCount(0);
}
async function focusIntro(page: Page) {
  await page.locator(".deck-card.is-active").click(); await geometry(page, [".focused-card-surface--front"]);
  await page.locator(".focused-card-surface--front .active-card-identity[role=button]").click();
  await expect(page.locator(".step-view-layer")).toHaveAttribute("data-step-view-item", "intro");
}

test("desktop Creator publication and two mobile learners retain independent mixed-media visual work", async ({ browser, browserName }, info) => {
  test.setTimeout(240_000); assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect(), db = client.db(process.env.MONGODB_DB!);
  const viewport = browserName === "webkit" ? { width: 375, height: 667 } : { width: 390, height: 844 };
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport, hasTouch: true, reducedMotion: "reduce" })));
  try {
    // Only disposable account fixtures are inserted. Every Card, Deck, attachment,
    // publication and adoption below is created through the ordinary interface.
    const passwordHash = (await db.collection("users").findOne({ username: "phase2" }))!.passwordHash;
    const users = ["creator", "a", "b"].map(role => ({ _id: new ObjectId(), username: `integrated-${role}-${randomUUID()}`, email: `${role}-${randomUUID()}@example.invalid`, passwordHash, cardsData: [], decksData: [], createdAt: new Date(), updatedAt: new Date() }));
    await db.collection("users").insertMany(users);
    const [creator, a, b] = await Promise.all(contexts.map(c => c.newPage()));
    // The existing Creator grid clips step-media hit targets at 375x667 WebKit.
    // Do not force-click or alter its CSS: author on desktop; learners stay mobile.
    await creator.setViewportSize({ width: 1280, height: 1000 });
    for (const [index, page] of [creator, a, b].entries()) { page.setDefaultTimeout(20_000); await login(page, users[index].username); }
    await creator.goto("/creator/new");
    await creator.getByRole("button", { name: "Add card", exact: true }).click();
    const column = creator.locator(".creator-column[data-card-template-id]").last(), cardId = (await column.getAttribute("data-card-template-id"))!;
    const card = () => db.collection("cardTemplates").findOne({ cardTemplateId: cardId });
    await expect.poll(async () => !!await card()).toBe(true); await expect(creator).toHaveURL(/\/creator\/edit\/[^/]+$/);
    const deckId = new URL(creator.url()).pathname.split("/").at(-1)!, deckTitle = `Integrated mathematics ${randomUUID()}`;
    await column.locator(".creator-card-title-button").click(); await creator.locator(".creator-modal").getByRole("textbox").fill("Graphs, factors and area");
    await creator.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
    await creator.evaluate(() => {
      const writes: { current: string; target: string }[] = [];
      (window as unknown as { creatorRouteWrites: typeof writes }).creatorRouteWrites = writes;
      const replace = window.history.replaceState.bind(window.history);
      window.history.replaceState = (data, title, url) => {
        if (data === null && String(url).startsWith("/creator/edit/")) writes.push({ current: location.pathname + location.search + location.hash, target: String(url) });
        return replace(data, title, url);
      };
    });
    const modal = creator.locator("dialog[data-creator-step-media]"), rows = modal.locator("li[data-attachment-id]");
    async function media(destination: number) {
      await (destination < 0 ? column.locator(".creator-card-intro-media-slot .creator-media-upload-control") : column.getByRole("button", { name: "Manage step media", exact: true }).nth(destination)).click();
    }
    async function upload(kind: "image" | "video") {
      const count = await rows.count(); await modal.getByLabel(`Add ${kind}`, { exact: true }).setInputFiles(kind === "image" ? image() : video); await expect(rows).toHaveCount(count + 1);
    }
    async function visual(id: string) { const count = await rows.count(); await modal.getByRole("combobox", { name: "Add Interactive Visual", exact: true }).selectOption(id); await expect(rows).toHaveCount(count + 1); }
    async function closeMedia() { await modal.getByRole("button", { name: "Close", exact: true }).click(); }
    await media(-1); await upload("video"); await upload("image"); await visual("integration-area"); await visual("roots-and-factors");
    for (const [index, label] of ["Watch", "Plot", "Area", "Roots"].entries()) await rows.nth(index).getByRole("textbox", { name: "Tab label", exact: true }).fill(label);
    await expect(modal.getByLabel("Add image", { exact: true })).toBeDisabled(); await closeMedia();
    await media(0); await upload("video"); await visual("integration-area"); await closeMedia();
    await media(1); await visual("roots-and-factors"); await upload("image"); await closeMedia();
    await media(2); await visual("roots-and-factors"); await visual("integration-area"); await closeMedia();
    await expect.poll(async () => (await card())?.draft.steps.map((s: { mediaItems: unknown[] }) => s.mediaItems?.length)).toEqual([2, 2, 2]);
    const routeWrites = await creator.evaluate(() => (window as unknown as { creatorRouteWrites: { current: string; target: string }[] }).creatorRouteWrites);
    expect(routeWrites).toEqual([]); // The installed edit URL must remain untouched during media save notifications.
    const draft = (await card())!.draft; await creator.reload(); await media(-1);
    expect((await card())!.draft).toEqual(draft);
    expect(await rows.getByRole("textbox", { name: "Tab label", exact: true }).evaluateAll(nodes => nodes.map(n => (n as HTMLInputElement).value))).toEqual(["Watch", "Plot", "Area", "Roots"]); await closeMedia();
    await column.getByRole("combobox", { name: "Card 1 publication visibility" }).selectOption("public");
    await column.getByRole("button", { name: /^Publish Card/ }).click();
    await creator.getByRole("dialog", { name: "Confirm public publication" }).getByRole("button", { name: "Publish publicly", exact: true }).click();
    await expect.poll(async () => (await card())?.latestVersion).toBe(1);
    await creator.getByRole("button", { name: "Edit deck title and introduction" }).click(); await creator.locator(".creator-modal textarea").fill(deckTitle);
    await creator.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
    await creator.getByRole("combobox", { name: "Deck publication visibility" }).selectOption("public"); await creator.getByRole("button", { name: "Publish Deck", exact: true }).click();
    await creator.getByRole("dialog", { name: "Confirm public publication" }).getByRole("button", { name: "Publish publicly", exact: true }).click();
    await expect.poll(async () => (await db.collection("deckTemplates").findOne({ deckTemplateId: deckId }))?.latestVersion).toBe(1);
    for (const page of [a, b]) {
      await page.goto("/library"); await page.getByRole("button", { name: `Open ${deckTitle}`, exact: true }).last().click();
      await (await libraryDeckAction(page, "Add to My Decks")).click();
      await (await libraryDeckAction(page, "Open in My Decks")).click(); await expect(page).toHaveURL(/\/decks\?/); await focusIntro(page);
    }
    const step = a.locator(".step-view-layer");
    expect(await step.getByRole("tab").allTextContents()).toEqual(["Watch", "Plot", "Area", "Roots"]);
    await step.getByRole("tab", { name: "Plot", exact: true }).tap();
    const diagram = step.getByRole("img", { name: "Graph.png", exact: true }); await expect(diagram).toBeVisible();
    await expect.poll(() => diagram.evaluate((n: HTMLImageElement) => n.complete && n.naturalWidth)).toBeGreaterThan(0);
    expect(await diagram.evaluate(n => getComputedStyle(n).objectFit)).toBe("contain");
    await a.screenshot({ path: info.outputPath("mixed-media-image.png") });
    await step.getByRole("tab", { name: "Area", exact: true }).tap();
    expect(await db.collection("visualRecords").countDocuments({ principalKey: `account:${users[1]._id}` })).toBe(0);
    await step.getByRole("button", { name: "Start: Integration", exact: true }).tap();
    let area = a.getByRole("dialog", { name: "Integration", exact: true });
    await area.getByRole("button", { name: "Next", exact: true }).tap(); await area.getByRole("button", { name: "Next", exact: true }).tap();
    await area.getByRole("group", { name: /area/i }).getByRole("button").first().tap();
    await area.getByRole("button", { name: "Next", exact: true }).tap(); await saved(area);
    const areaStage = await area.locator("[data-integration-stage]").getAttribute("data-integration-stage");
    await a.screenshot({ path: info.outputPath("integration-fullscreen.png") });
    await area.getByRole("button", { name: "Close interactive visual" }).tap();
    await expect(step.getByRole("tab", { name: "Area", exact: true })).toHaveAttribute("aria-selected", "true");
    await step.getByRole("tab", { name: "Plot", exact: true }).tap(); await step.getByRole("tab", { name: "Area", exact: true }).tap();
    await step.getByRole("button", { name: "Continue: Integration", exact: true }).tap();
    area = a.getByRole("dialog", { name: "Integration", exact: true }); await expect(area.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", areaStage!);
    await area.getByRole("button", { name: "Close interactive visual" }).tap();
    // Step entry resets to its first tab; the same activity resumes across attachments.
    for (const labels of [["Watch", "Explore"], ["Explore", "Image"], ["Explore", "Explore"]]) {
      await step.getByRole("button", { name: "Next", exact: true }).tap(); await expect(step).toHaveCount(1);
      await expect.poll(() => step.getByRole("tab").allTextContents()).toEqual(labels);
      await expect(step.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
    }
    await step.getByRole("tab").nth(1).tap(); await step.getByRole("button", { name: "Continue: Integration", exact: true }).tap();
    await expect(area.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", areaStage!); await area.getByRole("button", { name: "Close interactive visual" }).tap();
    for (let i = 0; i < 3; i++) { await step.getByRole("button", { name: "Previous", exact: true }).tap(); await expect(step).toHaveCount(1); }
    await expect(step.getByRole("tab", { name: "Watch", exact: true })).toHaveAttribute("aria-selected", "true");
    await step.getByRole("tab", { name: "Roots", exact: true }).tap();
    const personal = () => db.collection("users").findOne({ _id: users[1]._id });
    const completionBefore = (await personal())!.cardsData;
    await step.getByRole("button", { name: "Start: Roots and Factors", exact: true }).tap();
    const roots = a.getByRole("dialog", { name: "Roots and Factors", exact: true }), content = roots.locator("[data-visual-host-content]");
    await moveRoot(a, 4); const next = roots.getByRole("button", { name: "Next", exact: true }); await reachable(next, viewport.height); await next.tap();
    await roots.getByRole("button", { name: "(x + 3)", exact: true }).tap(); await moveRoot(a, -3); await next.tap();
    const check = roots.getByRole("button", { name: "Check", exact: true }); await reachable(check, viewport.height); await check.tap();
    await roots.getByRole("button", { name: "Show explanation", exact: true }).tap(); await moveRoot(a, -4); await check.tap();
    await expect(content).toHaveAttribute("data-visual-stage", "completed"); await saved(roots);
    await a.screenshot({ path: info.outputPath("roots-completed.png") });
    expect((await personal())!.cardsData.map((c: { items: unknown }) => c.items)).toEqual(completionBefore.map((c: { items: unknown }) => c.items));
    const rootRecord = (await db.collection("visualRecords").findOne({ principalKey: `account:${users[1]._id}`, activityId: "roots-and-factors" }))!;
    await roots.getByRole("button", { name: "Rewind", exact: true }).tap(); await expect(content).toHaveAttribute("data-visual-stage", "orientation"); await saved(roots);
    expect((await db.collection("visualRecords").findOne({ recordId: rootRecord.recordId }))!.activeAttemptId).toBe(rootRecord.activeAttemptId);
    a.once("dialog", async d => { expect(d.message()).toContain("history will be kept"); await d.accept(); }); await roots.getByRole("button", { name: "New", exact: true }).tap();
    await expect(roots.getByRole("slider")).toHaveAttribute("aria-valuenow", "3"); await saved(roots);
    expect(await db.collection("visualAttempts").countDocuments({ recordId: rootRecord.recordId })).toBe(2);
    await roots.getByRole("button", { name: "Close interactive visual" }).tap();
    const aRecordIds = (await db.collection("visualRecords").find({ principalKey: `account:${users[1]._id}` }).toArray()).map(r => r.recordId);
    const historyA = () => db.collection("visualAttempts").find({ recordId: { $in: aRecordIds } }).sort({ attemptId: 1 }).toArray();
    const aHistory = await historyA();
    expect(aHistory).toHaveLength(3);
    const denied = await b.request.get(`/api/visual-records/${rootRecord.recordId}/current`, { headers: { "X-Visual-Learner": `account:${users[2]._id}` } });
    expect(denied.status()).toBe(403);
    await b.locator(".step-view-layer").getByRole("tab", { name: "Area", exact: true }).tap(); await b.getByRole("button", { name: "Start: Integration", exact: true }).tap();
    const bArea = b.getByRole("dialog", { name: "Integration", exact: true }); await expect(bArea.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", "1");
    await bArea.getByRole("button", { name: "Next", exact: true }).tap(); await saved(bArea); await bArea.getByRole("button", { name: "Close interactive visual" }).tap();
    await b.reload(); await focusIntro(b); await b.getByRole("tab", { name: "Area", exact: true }).tap(); await b.getByRole("button", { name: "Continue: Integration", exact: true }).tap();
    await expect(bArea.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", "2"); await bArea.getByRole("button", { name: "Close interactive visual" }).tap();
    await b.getByRole("tab", { name: "Roots", exact: true }).tap(); await b.getByRole("button", { name: "Start: Roots and Factors", exact: true }).tap();
    const bRoots = b.getByRole("dialog", { name: "Roots and Factors", exact: true }); await expect(bRoots.getByRole("slider")).toHaveAttribute("aria-valuenow", "3");
    await moveRoot(b, 5); await saved(bRoots); await bRoots.getByRole("button", { name: "Close interactive visual" }).tap();
    await b.reload(); await focusIntro(b); await b.getByRole("tab", { name: "Roots", exact: true }).tap(); await b.getByRole("button", { name: "Continue: Roots and Factors", exact: true }).tap();
    await expect(bRoots.getByRole("slider")).toHaveAttribute("aria-valuenow", "5"); await bRoots.getByRole("button", { name: "Close interactive visual" }).tap();
    expect(await historyA()).toEqual(aHistory);
    await a.request.post("/api/auth/logout"); await login(a, users[1].username); await a.goto(`/decks?openDeck=${deckId}&openCard=${cardId}`); await focusIntro(a);
    await a.getByRole("tab", { name: "Plot", exact: true }).tap(); await expect(diagram).toBeVisible();
    await a.getByRole("tab", { name: "Area", exact: true }).tap(); await a.getByRole("button", { name: "Continue: Integration", exact: true }).tap();
    await expect(area.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", areaStage!); await area.getByRole("button", { name: "Close interactive visual" }).tap();
    const beforeRemoval = await historyA();
    // Normal author edits publish a new version without deleting learning records or changing version1.
    await creator.goto(`/creator/edit/${deckId}`); await media(-1);
    await rows.last().getByRole("button", { name: "Remove", exact: true }).click();
    await rows.nth(1).getByLabel("Replace Plot with image", { exact: true }).setInputFiles(image("Updated.png"));
    await expect.poll(async () => (await card())?.draft.intro.mediaItems[1].media.description).toBe("Updated.png");
    await rows.nth(2).getByRole("button", { name: "Move up", exact: true }).click(); await closeMedia();
    await column.getByRole("button", { name: /^Publish Card/ }).click(); await expect.poll(async () => (await card())?.latestVersion).toBe(2);
    expect((await db.collection("cardTemplateVersions").findOne({ cardTemplateId: cardId, version: 1 }))!.content.intro.mediaItems).toEqual(draft.intro.mediaItems);
    expect((await db.collection("cardTemplateVersions").findOne({ cardTemplateId: cardId, version: 2 }))!.content.intro.mediaItems.map((m: { label: string }) => m.label)).toEqual(["Watch", "Area", "Plot"]);
    expect(await historyA()).toEqual(beforeRemoval);
    await info.attach("integration-evidence", { body: JSON.stringify({ viewport, creatorViewport: { width: 1280, height: 1000 }, creatorInterface: true, libraryAdoption: true, independentLearners: true, cardVersions: [1, 2], realVideoPlayback: "Covered separately by existing player transition tests; this provider uses a synthetic Stream ID" }), contentType: "application/json" });
  } finally { await Promise.all(contexts.map(c => c.close())); await client.close(); }
});
