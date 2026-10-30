import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { VISUAL_GUEST_COLLECTION } from "../../src/lib/visualLearningRecords/guestCredentials";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const db = () => client.db(process.env.MONGODB_DB!);
async function open(page: Page) {
  await page.goto("/dev/interactive-visual-host"); await page.getByRole("button", { name: "Open guest database review", exact: true }).click();
  const preview = page.getByRole("button", { name: "Open Roots and Factors", exact: true }); await expect(preview).toBeEnabled(); await preview.click();
  const host = page.getByRole("dialog", { name: "Roots and Factors", exact: true }); await expect(host).toBeVisible(); return host;
}
const status = (page: Page) => page.locator("[data-visual-host-footer]").getByRole("status");
async function identity(page: Page) {
  const cookie = (await page.context().cookies()).find(cookie => cookie.name === "switchplay_visual_guest")!;
  expect(cookie).toBeTruthy(); expect(cookie.httpOnly).toBe(true); expect(cookie.path).toBe("/"); expect(cookie.sameSite).toBe("Lax");
  const guestId = cookie.value.split(".")[0]; return { cookie, guestId, learner: `guest:${guestId}` };
}

test("anonymous browser uses the common DB and IndexedDB pipeline through offline reload, reconnect and a later account cookie", async ({ page }) => {
  const userCount = await db().collection("users").countDocuments(); let offline = false;
  const accountRecordsBefore = await db().collection("visualRecords").find({ principalKey: `account:${process.env.PHASE2_USER_ID}` }).sort({ recordId: 1 }).toArray();
  await page.route("**/api/visual-attempts/*/batches", route => offline ? route.abort("internetdisconnected") : route.continue());
  let host = await open(page); await expect(status(page)).toHaveText("Saved");
  const { learner, cookie, guestId } = await identity(page);
  expect(await page.evaluate(() => document.cookie)).not.toContain(cookie.name);
  const credential = (await db().collection(VISUAL_GUEST_COLLECTION).findOne({ guestId }))!;
  expect(credential.credentialHash).toMatch(/^[a-f0-9]{64}$/); expect(JSON.stringify(credential)).not.toContain(cookie.value.split(".")[1]);
  await host.getByRole("slider").focus(); await page.keyboard.press("ArrowRight"); await expect(status(page)).toHaveText("Saved");
  const record = (await db().collection("visualRecords").findOne({ principalKey: learner }))!;
  offline = true; await host.getByRole("slider").focus(); await page.keyboard.press("ArrowRight"); await expect(status(page)).toContainText("pending");
  host = await open(page); await expect(host.getByRole("slider")).toHaveAttribute("aria-valuenow", "5"); await expect(status(page)).not.toHaveText("Saved");
  expect((await identity(page)).learner).toBe(learner);
  offline = false; await page.evaluate(() => window.dispatchEvent(new Event("online"))); await expect(status(page)).toHaveText("Saved");
  expect((await db().collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!.snapshot.state.root).toBe(5);
  expect(await db().collection("visualEvents").countDocuments({ attemptId: record.activeAttemptId, type: "attempt-started" })).toBe(1);
  expect(await db().collection("visualEvents").countDocuments({ attemptId: record.activeAttemptId, type: "root-placed" })).toBe(2);
  // Login does not implicitly retarget an explicit guest outbox. S15 claims it.
  expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).ok()).toBe(true);
  await host.getByRole("slider").focus(); await page.keyboard.press("ArrowLeft"); await expect(host.getByRole("slider")).toHaveAttribute("aria-valuenow", "4");
  await expect(status(page)).toHaveText("Saved");
  await expect.poll(async () => (await db().collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!.snapshot.state.root).toBe(4);
  expect(await db().collection("visualRecords").find({ principalKey: `account:${process.env.PHASE2_USER_ID}` }).sort({ recordId: 1 }).toArray()).toEqual(accountRecordsBefore);
  expect(await db().collection("users").countDocuments()).toBe(userCount);
  const visit = (await db().collection("visualVisits").findOne({ attemptId: record.activeAttemptId }))!;
  expect(visit.principalKindAtAccess).toBe("guest"); expect(visit.source).toEqual({ kind: "direct" });
});

test("guessed guest or attempt IDs and forged credentials grant no access; guest Card contexts remain denied", async ({ page, browser }) => {
  await open(page); await expect(status(page)).toHaveText("Saved"); const { learner, cookie } = await identity(page);
  const record = (await db().collection("visualRecords").findOne({ principalKey: learner }))!;
  const other = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL });
  try {
    const url = `/api/visual-records/${record.recordId}/current`, headers = { "X-Visual-Learner": learner };
    expect((await other.request.get(url, { headers })).status()).toBe(401);
    await other.addCookies([{ ...cookie, value: `${cookie.value.split(".")[0]}.${"b".repeat(43)}` }]);
    expect((await other.request.get(url, { headers })).status()).toBe(401);
    const denied = await page.request.post("/api/visual-sessions/open", { headers: { ...headers, Origin: process.env.PHASE2_BASE_URL! }, data: {
      activityId: "roots-and-factors", visitId: crypto.randomUUID(), source: { kind: "card", mode: "canonical", cardId: "private", cardVersion: 1, stepId: "intro", attachmentId: "visual" },
    } }); expect(denied.status()).toBe(403);
    expect((await page.request.get("/api/media/instructional-image?viewerUserId=forged")).status()).toBe(401);
  } finally { await other.close(); }
});

test("expired guest cookies clear without deleting prior histories or silently recovering them under a new principal", async ({ page }) => {
  await open(page); await expect(status(page)).toHaveText("Saved"); const { learner, guestId } = await identity(page);
  const record = (await db().collection("visualRecords").findOne({ principalKey: learner }))!;
  await db().collection(VISUAL_GUEST_COLLECTION).updateOne({ guestId }, { $set: { expiresAt: new Date(0) } });
  const response = await page.request.post("/api/visual-guests/session", { headers: { Origin: process.env.PHASE2_BASE_URL! }, data: { activityId: "roots-and-factors" } });
  expect(response.status()).toBe(401); expect((await response.json()).code).toBe("VISUAL_GUEST_SESSION_EXPIRED");
  expect((await page.context().cookies()).some(cookie => cookie.name === "switchplay_visual_guest")).toBe(false);
  const next = await page.request.post("/api/visual-guests/session", { headers: { Origin: process.env.PHASE2_BASE_URL! }, data: { activityId: "roots-and-factors" } });
  expect(next.ok()).toBe(true); expect((await next.json()).learner).not.toBe(learner);
  expect(await db().collection("visualAttempts").countDocuments({ attemptId: record.activeAttemptId })).toBe(1);
  expect((await page.request.get(`/api/visual-records/${record.recordId}/current`, { headers: { "X-Visual-Learner": (await identity(page)).learner } })).status()).toBe(403);
});
