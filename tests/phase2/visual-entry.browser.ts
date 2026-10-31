import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const db = () => client.db(process.env.MONGODB_DB!);
const status = (page: Page) => page.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]');
async function fixture() {
  const seed = (await db().collection("users").findOne({ username: "phase2" }))!, id = new ObjectId(), username = `entry-${randomUUID()}`, now = new Date();
  await db().collection("users").insertOne({ _id: id, username, email: `${username}@example.invalid`, passwordHash: seed.passwordHash, cardsData: [], decksData: [], createdAt: now, updatedAt: now });
  return { username, learner: `account:${id.toHexString()}` };
}
async function open(page: Page) { await page.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ }).click(); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved"); }
async function progress(page: Page) {
  await page.getByRole("slider").focus(); await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "4");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("[data-visual-host-content]")).toHaveAttribute("data-visual-stage", "prediction");
}
async function login(page: Page, username: string, password = "local-test-only") {
  await page.getByRole("textbox", { name: "Username or email" }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("public preview is inert and contextual sign-in restores foreground guest over retained account history", async ({ page }) => {
  const account = await fixture();
  await page.request.post("/api/auth/login", { data: { identifier: account.username, password: "local-test-only" } });
  await page.goto("/interactive-visuals/roots-and-factors"); await open(page); await progress(page); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved");
  const original = (await db().collection("visualRecords").findOne({ principalKey: account.learner }))!;
  await page.getByRole("button", { name: "Close interactive visual", exact: true }).click();
  await page.request.post("/api/auth/logout");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/interactive-visuals/roots-and-factors");
  const preview = page.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ }); await expect(preview).toBeEnabled();
  const credential = (await page.context().cookies()).find(cookie => cookie.name === "switchplay_visual_guest")!;
  expect(credential.httpOnly).toBe(true); const guest = `guest:${credential.value.split(".")[0]}`;
  expect(await db().collection("visualRecords").countDocuments({ principalKey: guest })).toBe(0);
  await open(page); await expect(page.getByRole("button", { name: "Sign in to keep progress across devices" })).toHaveCount(0);
  await progress(page); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved");
  const foreground = (await db().collection("visualRecords").findOne({ principalKey: guest }))!;
  const header = await page.locator("[data-visual-host-header]").boundingBox(); expect(header!.width).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Sign in to keep progress across devices" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await login(page, account.username, "incorrect"); await expect(page).toHaveURL(/\/login/);
  expect((await db().collection("visualGuests").findOne({ guestId: guest.slice(6) }))!.status).toBe("active");
  await login(page, account.username); await expect(page).toHaveURL(/\/interactive-visuals\/roots-and-factors\?claimId=/);
  await expect(page.locator("[data-visual-host-content]")).toHaveAttribute("data-visual-stage", "prediction"); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved");
  await expect(page.getByRole("button", { name: "Sign in to keep progress across devices" })).toHaveCount(0);
  const merged = (await db().collection("visualRecords").findOne({ principalKey: account.learner }))!;
  expect(merged.activeAttemptId).toBe(foreground.activeAttemptId); expect(merged.attemptCount).toBe(2);
  expect(await db().collection("visualAttempts").countDocuments({ recordId: merged.recordId })).toBe(2);
  expect(await db().collection("visualAttempts").findOne({ attemptId: original.activeAttemptId })).toBeTruthy();
  expect(await db().collection("visualEvents").countDocuments({ attemptId: foreground.activeAttemptId, type: "attempt-started" })).toBe(1);
  expect(await db().collection("cardData").countDocuments({ userId: account.learner.slice(8) })).toBe(0);
  // An owned server receipt recovers this explicit return even after local
  // journal eviction and credential retirement. No new guest/attempt is issued.
  await page.getByRole("button", { name: "Close interactive visual", exact: true }).click();
  await page.evaluate(() => new Promise<void>((resolve, reject) => { const request = indexedDB.open("switchplay-visual-learning-records", 2); request.onsuccess = () => { const database = request.result, tx = database.transaction(["claims", "outboxes", "opening"], "readwrite"); for (const name of ["claims", "outboxes", "opening"]) tx.objectStore(name).clear(); tx.oncomplete = () => { database.close(); resolve(); }; tx.onabort = () => reject(tx.error); }; request.onerror = () => reject(request.error); }));
  await page.reload(); await expect(page.locator("[data-visual-host-content]")).toHaveAttribute("data-visual-stage", "prediction");
  expect(await db().collection("visualAttempts").countDocuments({ recordId: merged.recordId })).toBe(2);
});

test("successful login survives interrupted claim and the explicit return retries retained work", async ({ page }) => {
  const account = await fixture(); await page.goto("/interactive-visuals/roots-and-factors"); await open(page);
  let holdSaves = true;
  await page.route("**/api/visual-attempts/*/batches", route => holdSaves ? route.abort("internetdisconnected") : route.continue());
  await progress(page); await expect(status(page)).toContainText("pending");
  let blocked = true;
  await page.route("**/api/visual-guests/claim", route => blocked ? route.abort("internetdisconnected") : route.continue());
  await page.getByRole("button", { name: "Sign in to keep progress across devices" }).click(); await login(page, account.username);
  await expect(page).toHaveURL(/\/interactive-visuals\/roots-and-factors\?claimId=/);
  await expect(page.getByRole("status")).toContainText("Your existing work is kept");
  expect((await (await page.request.get("/api/auth/me")).json()).user.id).toBe(account.learner.slice(8));
  blocked = false; holdSaves = false; await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator("[data-visual-host-content]")).toHaveAttribute("data-visual-stage", "prediction"); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved");
});

test("ordinary login associates existing guest progress without changing default navigation or creating discovery attempts", async ({ page }) => {
  const account = await fixture(); await page.goto("/interactive-visuals/roots-and-factors"); await open(page); await progress(page); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved");
  const guestId = (await page.context().cookies()).find(cookie => cookie.name === "switchplay_visual_guest")!.value.split(".")[0];
  const before = (await db().collection("visualRecords").findOne({ principalKey: `guest:${guestId}` }))!;
  await page.getByRole("button", { name: "Close interactive visual", exact: true }).click();
  await page.goto("/login"); await login(page, account.username); await expect(page).toHaveURL(/\/decks$/);
  await expect.poll(async () => (await db().collection("visualRecords").findOne({ principalKey: account.learner }))?.activeAttemptId).toBe(before.activeAttemptId);
  expect(await db().collection("visualAttempts").countDocuments({ recordId: before.recordId })).toBe(1);
  await page.goto("/interactive-visuals/not-a-visual"); await expect(page.getByRole("button", { name: /^(Start|Continue): Roots/ })).toHaveCount(0);
});

test("unowned return handles never open or create an account attempt", async ({ page }) => {
  const account = await fixture();
  await page.request.post("/api/auth/login", { data: { identifier: account.username, password: "local-test-only" } });
  await page.goto(`/interactive-visuals/roots-and-factors?claimId=${randomUUID()}`);
  await expect(page.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ })).toBeEnabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await db().collection("visualRecords").countDocuments({ principalKey: account.learner })).toBe(0);
});
