import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { CardRepository } from "../../src/lib/cards/repository";
import { GroupExperienceRepository } from "../../src/lib/groupExperiences/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
const group = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null");
test.skip(!group || !process.env.PHASE7_MEDIA_REVIEW, "Requires disposable --group-media --complete-loading fixtures");
async function swipe(page: Page, selector: string, x: number, y: number) {
 const rect = (await page.locator(selector).boundingBox())!;
 await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
 await page.mouse.move(rect.x + rect.width / 2 + x, rect.y + rect.height / 2 + y, { steps: 12 }); await page.mouse.up();
}
for (const browserName of ["chromium", "webkit"] as const) {
 test(`${browserName}: early Group selection retains complete Me and joins the background request`, async ({ playwright }) => {
  const browser = await playwright[browserName].launch();
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  context.setDefaultTimeout(15_000);
  const page = await context.newPage(); let release = () => {}, calls = 0;
  try {
   expect((await page.request.post("/api/auth/login", { data: { identifier: "Aoife Kelly", password: "local-test-only" } })).ok()).toBeTruthy();
   if (browserName === "webkit" && process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
   const held = new Promise<void>(resolve => { release = resolve; });
   await page.route("**/preparation?perspective=group", async route => { calls++; const start = Date.now(), response = await route.fetch(); console.log("CP3_FOLLOWUP_HTTP", JSON.stringify({ browserName, path: new URL(route.request().url()).pathname, localFetchMs: Date.now() - start, bytes: (await response.body()).length })); await held; await route.fulfill({ response }); });
   await page.goto(`/decks?openExperience=${group.experienceId}&openCard=${group.cardIds[0]}&progressScene=1&progressPerspective=self`);
   const scene = page.locator(".group-experience"), picker = page.locator(".group-picker-current");
   await expect(scene).toHaveAttribute("data-perspective-key", group.otherId);
   await expect.poll(() => calls).toBe(1);
   const card = await page.locator(".deck-card.is-active").elementHandle();
   await picker.tap(); await page.locator('.group-perspective-list [data-perspective-key="group"]').tap();
   await expect(picker).toContainText("Loading…");
   await expect(scene).toHaveAttribute("data-perspective-key", group.otherId);
   expect(await card!.evaluate(node => node.isConnected)).toBe(true); expect(calls).toBe(1);
   release(); await expect(scene).toHaveAttribute("data-perspective-key", "group");
   await expect(picker).not.toContainText("Loading…");
   expect(await card!.evaluate(node => node.isConnected)).toBe(true);
   await page.route("**/preparation?perspective=*", route => route.abort("failed"));
   for (let i = 0; i < 4; i++) {
    await picker.tap(); await page.locator(`.group-perspective-list [data-perspective-key="${i % 2 ? "group" : group.otherId}"]`).tap();
    await expect(scene).toHaveAttribute("data-perspective-key", i % 2 ? "group" : group.otherId);
    await expect(picker).not.toContainText("Loading…");
   }
  } finally { release(); await context.unrouteAll({ behavior: "ignoreErrors" }); await browser.close(); }
 });

 test(`${browserName}: followers join one batch, keep the physical Card and switch all prepared Cards without metadata waits`, async ({ playwright }) => {
  const browser = await playwright[browserName].launch();
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  context.setDefaultTimeout(15_000);
  const page = await context.newPage(); let release = () => {}, calls = 0;
  try {
   await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
   if (browserName === "webkit" && process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
   const held = new Promise<void>(resolve => { release = resolve; });
   await page.route("**/preparation/followers*", async route => { calls++; const start = Date.now(), response = await route.fetch(); console.log("CP3_FOLLOWUP_HTTP", JSON.stringify({ browserName, path: new URL(route.request().url()).pathname, localFetchMs: Date.now() - start, bytes: (await response.body()).length })); await held; await route.fulfill({ response }); });
   await page.goto(`/decks?openExperience=${group.experienceId}&openCard=${group.cardIds[0]}&progressScene=1&progressPerspective=group`);
   const scene = page.locator(".group-experience"), picker = page.locator(".group-picker-current");
   await expect(scene).toHaveAttribute("data-perspective-key", "group");
   await expect.poll(() => calls).toBe(1);
   const stack = await page.locator(".card-stack").elementHandle();
   await picker.tap(); await page.getByRole("button", { name: "All followers", exact: true }).tap();
   const list = page.getByLabel("All followers", { exact: true });
   await expect(list.getByRole("status")).toHaveText("Loading followers…"); await expect(list.locator("button[data-perspective-key]")).toHaveCount(0);
   await page.locator(".deck-card.is-active").press("Enter");
   const panel = page.getByRole("region", { name: "Follower comparison" });
   await expect(panel.getByRole("status")).toHaveText("Loading followers…");
   const card = await page.locator(".focused-card-object").elementHandle();
   await expect(panel.locator("button[data-perspective-key]")).toHaveCount(0);
   release(); await expect(panel.locator(".group-identity-card")).toHaveCount(group.followers.length + 1);
   expect(calls).toBe(1); expect(await stack!.evaluate(node => node.isConnected)).toBe(true); expect(await card!.evaluate(node => node.isConnected)).toBe(true);
   let blocked = 0;
   await page.route(/\/api\/(reflections\?|media\/history\?|group-experiences\/[^/]+\/(preparation|presentation\?|perspectives\?|aggregates\?|cards\/[^/]+\/media\?))/, route => { blocked++; return route.abort("failed"); });
   for (const subject of [group.followers[1], group.otherId, group.followers[2], group.otherId]) {
    await panel.locator(`[data-perspective-key="${subject}"]`).tap(); await expect(scene).toHaveAttribute("data-perspective-key", subject);
    await expect(panel.getByRole("status")).toHaveCount(0);
    expect(await card!.evaluate(node => node.isConnected)).toBe(true);
   }
   await panel.getByRole("button", { name: "Collapse follower comparison" }).tap();
   await page.waitForTimeout(700); // Existing comparison/focus geometry must settle before the next gesture.
   await swipe(page, ".focused-card-surface--front .card-title-anchor", 180, 0);
   await expect(scene).toHaveAttribute("data-face", "back");
   for (let i = 0; i < 6; i++) {
    await expect(scene).toHaveAttribute("data-current-card", group.cardIds[i]);
    await expect(page.locator(".focused-card-surface--back .back-card-media-carousel-item")).toHaveCount(3);
    await expect(page.locator(".focused-card-surface--back .reflection-area")).toContainText(`Player reflection for Card ${i + 1}`);
    if (i !== 5) { await page.waitForTimeout(700); await swipe(page, ".focused-card-surface--back .card-title-anchor", 0, 170); }
   }
   await picker.tap(); await page.getByRole("button", { name: "All followers", exact: true }).tap();
   await expect(panel.locator(".group-identity-card")).toHaveCount(group.followers.length + 1);
   await expect(panel.getByRole("status")).toHaveCount(0);
   console.log("CP3_PREPARED_BROWSER", JSON.stringify({ browserName, followerRequests: calls, readySelections: 4, completeCardsBrowsed: 6, backgroundMetadataBlocked: blocked }));
  } finally { release(); await context.unrouteAll({ behavior: "ignoreErrors" }); await browser.close(); }
 });

 test(`${browserName}: failed follower preparation shows retry without removing the complete Card`, async ({ playwright }) => {
  const browser = await playwright[browserName].launch();
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  context.setDefaultTimeout(15_000);
  const page = await context.newPage(); let failed = true;
  try {
   await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
   if (browserName === "webkit" && process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
   await page.route("**/preparation/followers*", route => failed ? route.fulfill({ status: 503, json: { error: "Temporary follower preparation failure" } }) : route.continue());
   await page.goto(`/decks?openExperience=${group.experienceId}&openCard=${group.cardIds[0]}&progressScene=1&progressPerspective=group`);
   await expect(page.locator(".group-picker-current")).toBeVisible();
   await page.locator(".group-picker-current").tap(); await page.getByRole("button", { name: "All followers", exact: true }).tap();
   const list = page.getByLabel("All followers", { exact: true });
   await expect(list.getByRole("alert")).toContainText("could not be verified");
   await expect(page.locator(".deck-card.is-active")).toBeVisible(); await expect(page.locator(".group-experience")).toHaveAttribute("data-perspective-key", "group");
   failed = false; await list.getByRole("button", { name: "Retry" }).tap();
   await expect(list.locator("button[data-perspective-key]")).toHaveCount(group.followers.length + 1);
   await expect(list.getByRole("alert")).toHaveCount(0);
  } finally { await context.unrouteAll({ behavior: "ignoreErrors" }); await browser.close(); }
 });
}

for (const browserName of ["chromium", "webkit"] as const) test(`${browserName}: 100 members prepare on intent, resume pages and retain one dual-role Me identity`, async ({ playwright }) => {
 assertDisposableDatabase();
 const client = await new MongoClient(process.env.MONGODB_URI!).connect();
 const browser = await playwright[browserName].launch();
 const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
 context.setDefaultTimeout(15_000);
  const page = await context.newPage(); let release = () => {}, calls = 0;
 try {
  const cards = new CardRepository(client.db(process.env.MONGODB_DB!), client), repo = new GroupExperienceRepository(cards);
  const users = Array.from({ length: 97 }, (_, i) => ({ _id: new ObjectId(), username: `CP3 ${browserName} player ${i.toString().padStart(3, "0")}`, cardsData: [], decksData: [] }));
  await cards.users().insertMany(users);
  const created = await repo.create(group.adminId, { operationId: `cp3-${browserName}-large`, name: "Large preparation fixture", adminIds: group.followers.slice(1, 3),
   followerIds: [group.adminId, ...users.map(row => row._id.toHexString())], manifest: { deckTemplateId: group.deckId, deckVersion: 1, cards: group.cardIds.map((cardTemplateId: string) => ({ cardTemplateId, version: 1 })) } });
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  if (browserName === "webkit" && process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
  const held = new Promise<void>(resolve => { release = resolve; }); let first = true;
  await page.route("**/preparation/followers*", async route => { calls++; const start = Date.now(), response = await route.fetch(); console.log("CP3_LARGE_PAGE", JSON.stringify({ browserName, page: calls, localFetchMs: Date.now() - start, bytes: (await response.body()).length })); if (first) { first = false; await held; } await route.fulfill({ response }); });
  await page.goto(`/decks?openExperience=${created.experienceId}&openCard=${group.cardIds[0]}&progressScene=1&progressPerspective=group`);
  const picker = page.locator(".group-picker-current"), scene = page.locator(".group-experience");
  await expect(scene).toHaveAttribute("data-perspective-key", "group");
  await page.waitForTimeout(700); expect(calls).toBe(0);
  await picker.tap(); await page.getByRole("button", { name: "All followers", exact: true }).tap();
  const list = page.getByLabel("All followers", { exact: true });
  await expect(list.getByRole("status")).toHaveText("Loading followers…"); await expect.poll(() => calls).toBe(1);
  await picker.tap(); release(); await page.waitForTimeout(600); expect(calls).toBe(1);
  await picker.tap(); await page.getByRole("button", { name: "All followers", exact: true }).tap();
  await expect(list.locator("button[data-perspective-key]")).toHaveCount(99);
  expect(calls).toBe(5); await expect(list.locator(`[data-perspective-key="${group.adminId}"]`)).toHaveCount(1);
  await page.route("**/preparation*", route => route.abort("failed"));
  const start = Date.now();
  for (const id of [users[0]._id.toHexString(), users.at(-1)!._id.toHexString(), group.adminId]) {
   await list.locator(`[data-perspective-key="${id}"]`).tap(); await expect(scene).toHaveAttribute("data-perspective-key", id);
   await expect(picker).not.toContainText("Loading…");
   await picker.tap(); await page.getByRole("button", { name: "All followers", exact: true }).tap();
   await expect(list.getByRole("status")).toHaveCount(0);
  }
  console.log("CP3_LARGE_BROWSER", JSON.stringify({ browserName, members: 100, followers: 98, requests: calls, retainedSelections: 3, interactionSequenceMs: Date.now() - start }));
 } finally { release(); await context.unrouteAll({ behavior: "ignoreErrors" }); await browser.close(); await client.close(); }
});
