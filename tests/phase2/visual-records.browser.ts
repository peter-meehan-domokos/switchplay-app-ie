import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { VisualLearningRecordRepository } from "../../src/lib/visualLearningRecords/repository";
import { restoreRootsHostedState, reduceRootsHostedState, rootsSnapshot } from "../../src/app/step-visuals/activities/roots-factors/hostState";

async function fixture(page: Page) {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect(), db = client.db(process.env.MONGODB_DB!);
  const id = new ObjectId(), username = `visual-${randomUUID()}`, now = new Date();
  await db.collection("users").insertOne({ _id: id, username, email: `${username}@example.invalid`, passwordHash: bcrypt.hashSync("local-test-only", 4),
    cardsData: [], decksData: [], createdAt: now, updatedAt: now });
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).ok()).toBe(true);
  return { client, db, learner: `account:${id.toHexString()}` };
}
async function open(page: Page) {
  await page.goto("/dev/interactive-visual-host");
  await page.getByRole("button", { name: "Open database review", exact: true }).click();
  await page.getByRole("button", { name: "Open Roots and Factors", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Roots and Factors", exact: true });
  await expect(dialog).toBeVisible(); return dialog;
}

test("real IndexedDB and API restore across reload and offline reconnect without duplicate history", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  let offline = false;
  await page.route("**/api/visual-**", route => offline ? route.abort("internetdisconnected") : route.continue());
  try {
    let dialog = await open(page), slider = dialog.getByRole("slider");
    await slider.focus(); await page.keyboard.press("ArrowRight"); await expect(slider).toHaveAttribute("aria-valuenow", "4");
    const status = () => dialog.locator("[data-visual-host-footer]").getByRole("status");
    await expect(status()).toHaveText("Saved");
    const record = await db.collection("visualRecords").findOne({ principalKey: learner }); expect(record).toBeTruthy();
    const originalAttempt = record!.activeAttemptId;
    dialog = await open(page); slider = dialog.getByRole("slider"); await expect(slider).toHaveAttribute("aria-valuenow", "4");
    offline = true;
    await slider.focus(); await page.keyboard.press("ArrowLeft"); await expect(slider).toHaveAttribute("aria-valuenow", "3");
    await expect(status()).toContainText("pending");
    dialog = await open(page); slider = dialog.getByRole("slider"); await expect(slider).toHaveAttribute("aria-valuenow", "3");
    await expect(status()).not.toHaveText("Saved");
    offline = false; await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(status()).toHaveText("Saved");
    const attempt = await db.collection("visualAttempts").findOne({ attemptId: originalAttempt });
    expect(attempt!.snapshot.state.root).toBe(3);
    const events = await db.collection("visualEvents").find({ attemptId: originalAttempt }).toArray();
    expect(events.filter(e => e.type === "attempt-started")).toHaveLength(1);
    expect(events.filter(e => e.type === "root-placed")).toHaveLength(2);
    expect(new Set(events.map(e => e.eventId)).size).toBe(events.length);
    expect(await db.collection("visualAttempts").countDocuments({ recordId: record!.recordId })).toBe(1);
    expect((await db.collection("users").findOne({ _id: new ObjectId(learner.split(":")[1]) }))!.cardsData).toEqual([]);
  } finally { await client.close(); }
});

test("lost server response retries the frozen batch after reload without duplicate events", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  const bodies: string[] = []; let dropped = false;
  await page.route("**/api/visual-attempts/*/batches", async route => {
    bodies.push(route.request().postData()!);
    if (!dropped) { dropped = true; await route.fetch(); await route.abort("connectionreset"); }
    else await route.continue();
  });
  try {
    let dialog = await open(page);
    await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toContainText("Waiting to reconnect");
    dialog = await open(page);
    await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toHaveText("Saved");
    expect(bodies.length).toBeGreaterThanOrEqual(2); expect(bodies[0]).toBe(bodies[1]);
    const record = await db.collection("visualRecords").findOne({ principalKey: learner });
    expect(await db.collection("visualEvents").countDocuments({ attemptId: record!.activeAttemptId, type: "attempt-started" })).toBe(1);
  } finally { await client.close(); }
});

test("quota failure never displays Saved and leaves the server snapshot unchanged", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  try {
    const dialog = await open(page), status = dialog.locator("[data-visual-host-footer]").getByRole("status");
    await expect(status).toHaveText("Saved");
    const record = await db.collection("visualRecords").findOne({ principalKey: learner });
    await page.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException("Injected test quota", "QuotaExceededError"); }; });
    await dialog.getByRole("slider").focus(); await page.keyboard.press("ArrowRight");
    await expect(status).toContainText("failed"); await expect(status).not.toHaveText("Saved");
    expect((await db.collection("visualAttempts").findOne({ attemptId: record!.activeAttemptId }))!.snapshot.state.root).toBe(3);
  } finally { await client.close(); }
});

test("stale state reports conflict and preserves the local candidate across reload", async ({ page }) => {
  const { client, db, learner } = await fixture(page); let blocked = false;
  await page.route("**/api/visual-attempts/*/batches", route => blocked ? route.abort("internetdisconnected") : route.continue());
  try {
    let dialog = await open(page); const status = () => dialog.locator("[data-visual-host-footer]").getByRole("status");
    await expect(status()).toHaveText("Saved");
    const repo = new VisualLearningRecordRepository(db, client), actor = { kind: "account" as const, id: learner.split(":")[1] };
    const record = (await repo.records().findOne({ principalKey: learner }))!, attempt = (await repo.attempts().findOne({ attemptId: record.activeAttemptId }))!;
    const visit = (await repo.visits().findOne({ attemptId: attempt.attemptId }))!;
    const other = reduceRootsHostedState(restoreRootsHostedState(attempt.snapshot), { type: "root", action: { type: "place", root: 5, revision: 0 } });
    const event = other.recorded.records.events[0];
    blocked = true; await dialog.getByRole("slider").focus(); await page.keyboard.press("ArrowRight");
    await expect(dialog.getByRole("slider")).toHaveAttribute("aria-valuenow", "4");
    await repo.append(actor, attempt.attemptId, { writeId: randomUUID(), expectedStateRevision: attempt.stateRevision, visitId: visit.visitId,
      activityVersion: 1, snapshotSchema: 1, snapshot: rootsSnapshot(other), events: [{ eventId: randomUUID(), writerId: randomUUID(), clientSequence: event.sequence,
        clientOccurredAt: new Date().toISOString(), activityVersion: 1, eventSchema: 1, type: event.type, payload: event }] });
    blocked = false; await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(status()).toContainText("conflict");
    const serverSnapshot = (await repo.attempts().findOne({ attemptId: attempt.attemptId }))!.snapshot!;
    if (serverSnapshot.activityId !== "roots-and-factors") throw new Error("Unexpected activity snapshot.");
    expect(serverSnapshot.state.root).toBe(5);
    dialog = await open(page); await expect(dialog.getByRole("slider")).toHaveAttribute("aria-valuenow", "4"); await expect(status()).toContainText("conflict");
    expect(await repo.events().countDocuments({ attemptId: attempt.attemptId, type: "root-placed" })).toBe(2);
  } finally { await client.close(); }
});

test("Integration saves an unchecked draft without inventing a calculation event", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  try {
    await page.setViewportSize({ width: 1000, height: 1200 }); await page.goto("/dev/interactive-visual-host");
    await page.getByRole("button", { name: "Open database review", exact: true }).click();
    await page.getByRole("button", { name: "Open Integration", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Integration", exact: true }), content = dialog.locator("[data-visual-host-content]");
    const next = dialog.locator("[data-visual-host-footer]").getByRole("button", { name: "Next", exact: true });
    await next.click(); await next.click(); await content.getByRole("group", { name: /area/i }).getByRole("button").first().click();
    for (let i = 0; i < 4; i++) await next.click();
    await content.getByRole("textbox", { name: "Your answer", exact: true }).fill("12.34");
    await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toHaveText("Saved");
    const record = await db.collection("visualRecords").findOne({ principalKey: learner, activityId: "integration-area" });
    expect((await db.collection("visualAttempts").findOne({ attemptId: record!.activeAttemptId }))!.snapshot.panel.draft).toBe("12.34");
    expect(await db.collection("visualEvents").countDocuments({ attemptId: record!.activeAttemptId, type: "calculation-checked" })).toBe(0);
    await page.reload(); await page.getByRole("button", { name: "Open database review", exact: true }).click();
    await page.getByRole("button", { name: "Open Integration", exact: true }).click();
    await expect(content.getByRole("textbox", { name: "Your answer", exact: true })).toHaveValue("12.34");
  } finally { await client.close(); }
});

test("a new account session retries pending work without reopening that visual", async ({ page }) => {
  const { client, db, learner } = await fixture(page); let blocked = false;
  await page.route("**/api/visual-attempts/*/batches", route => blocked ? route.abort("internetdisconnected") : route.continue());
  try {
    const dialog = await open(page), status = dialog.locator("[data-visual-host-footer]").getByRole("status");
    await expect(status).toHaveText("Saved");
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    blocked = true; await dialog.getByRole("slider").focus(); await page.keyboard.press("ArrowRight"); await expect(status).toContainText("pending");
    blocked = false; await page.reload(); await page.getByRole("button", { name: "Open database review", exact: true }).click();
    await expect.poll(async () => (await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!.snapshot.state.root).toBe(4);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally { await client.close(); }
});
