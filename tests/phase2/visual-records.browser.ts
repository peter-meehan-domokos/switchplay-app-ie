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
    await content.getByRole("button", { name: "Check calculation", exact: true }).click();
    await dialog.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Back to Start", exact: true })).toBeVisible();
    await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toHaveText("Saved");
    const completedAt = (await db.collection("visualAttempts").findOne({ attemptId: record!.activeAttemptId }))!.firstCompletedAt;
    await dialog.getByRole("button", { name: "Back to Start", exact: true }).click();
    for (let i = 0; i < 6; i++) await next.click();
    await expect(content.getByRole("textbox", { name: "Your answer", exact: true })).toHaveValue("12.34");
    await expect(content.locator("[data-integration-part]")).toHaveAttribute("data-integration-part", "calculate");
    await dialog.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toHaveText("Saved");
    expect(await db.collection("visualEvents").countDocuments({ attemptId: record!.activeAttemptId, type: "attempt-completed" })).toBe(2);
    expect((await db.collection("visualAttempts").findOne({ attemptId: record!.activeAttemptId }))!.firstCompletedAt).toEqual(completedAt);
  } finally { await client.close(); }
});

test("Roots Back to Start preserves its attempt and stored return state", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  try {
    await page.setViewportSize({ width: 900, height: 1100 });
    let dialog = await open(page), slider = dialog.getByRole("slider");
    await slider.focus(); await page.keyboard.press("ArrowRight");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.getByRole("button", { name: "(x + 3)", exact: true }).click();
    await slider.focus(); await page.keyboard.press("Home"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await slider.focus(); await page.keyboard.press("ArrowLeft");
    const check = dialog.getByRole("button", { name: "Check", exact: true });
    // Existing Roots layout places Check below this viewport. Verify its keyboard
    // action and persistence; do not disguise this visual-specific layout limitation.
    const checkBox = await check.boundingBox();
    test.info().annotations.push({ type: "visual-layout-backlog", description: `Roots Check at 900x1100: top=${checkBox?.y}, height=${checkBox?.height}; pointer overflow remains outside this project.` });
    await check.focus(); await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: "Back to Start", exact: true })).toBeVisible();
    await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toHaveText("Saved");
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    await dialog.getByRole("button", { name: "Back to Start", exact: true }).click();
    await expect(slider).toHaveAttribute("aria-valuenow", "4");
    await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toHaveText("Saved");
    dialog = await open(page); slider = dialog.getByRole("slider"); await expect(slider).toHaveAttribute("aria-valuenow", "4");
    expect((await db.collection("visualRecords").findOne({ recordId: record.recordId }))!.activeAttemptId).toBe(record.activeAttemptId);
    expect(await db.collection("visualEvents").countDocuments({ attemptId: record.activeAttemptId, type: "attempt-started" })).toBe(1);
    expect((await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!.snapshot.attemptEvidence.checkAttempts).toBe(1);
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

test("Start New Attempt requires confirmation and double activation creates one retained attempt", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  try {
    const dialog = await open(page), slider = dialog.getByRole("slider"), status = dialog.locator("[data-visual-host-footer]").getByRole("status");
    await slider.focus(); await page.keyboard.press("ArrowRight"); await expect(status).toHaveText("Saved");
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    const button = dialog.getByRole("button", { name: "Start New Attempt", exact: true });
    page.once("dialog", async confirmation => { expect(confirmation.message()).toContain("history will be kept"); await confirmation.dismiss(); });
    await button.click(); await expect(slider).toHaveAttribute("aria-valuenow", "4");
    expect(await db.collection("visualAttempts").countDocuments({ recordId: record.recordId })).toBe(1);
    await page.evaluate(() => { window.confirm = () => true; });
    await button.evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
    await expect(slider).toHaveAttribute("aria-valuenow", "3"); await expect(status).toHaveText("Saved");
    const current = (await db.collection("visualRecords").findOne({ recordId: record.recordId }))!;
    expect(current.activeAttemptId).not.toBe(record.activeAttemptId);
    expect(await db.collection("visualAttempts").countDocuments({ recordId: record.recordId })).toBe(2);
    expect((await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!.snapshot.state.root).toBe(4);
    expect((await db.collection("visualAttempts").findOne({ attemptId: current.activeAttemptId }))!.snapshot.attemptNumber).toBe(2);
    expect(await db.collection("visualEvents").countDocuments({ attemptId: current.activeAttemptId, type: "attempt-started" })).toBe(1);
    // Same Stage1 controls also fit the supported narrow multimedia host.
    await page.setViewportSize({ width: 320, height: 568 });
    const next = await dialog.getByRole("button", { name: "Next", exact: true }).boundingBox();
    const start = await button.boundingBox();
    expect(next!.x + next!.width).toBeLessThanOrEqual(308.1); expect(start!.x).toBeGreaterThanOrEqual(11.9);
  } finally { await client.close(); }
});

test("multiple confirmed offline attempts survive reload and register in order without losing earlier work", async ({ page }) => {
  const { client, db, learner } = await fixture(page); let offline = false;
  await page.route("**/api/visual-**", route => offline ? route.abort("internetdisconnected") : route.continue());
  try {
    let dialog = await open(page), slider = dialog.getByRole("slider");
    const status = () => dialog.locator("[data-visual-host-footer]").getByRole("status");
    await expect(status()).toHaveText("Saved");
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    offline = true; await slider.focus(); await page.keyboard.press("ArrowRight"); await expect(status()).toContainText("pending");
    for (let i = 0; i < 2; i++) {
      page.once("dialog", confirmation => confirmation.accept());
      await dialog.getByRole("button", { name: "Start New Attempt", exact: true }).click();
      await expect(slider).toHaveAttribute("aria-valuenow", "3");
      await slider.focus(); await page.keyboard.press("ArrowRight"); await expect(slider).toHaveAttribute("aria-valuenow", "4");
      await expect(status()).toContainText("pending");
    }
    dialog = await open(page); slider = dialog.getByRole("slider"); await expect(slider).toHaveAttribute("aria-valuenow", "4");
    await expect(status()).not.toHaveText("Saved"); offline = false; await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(status()).toHaveText("Saved");
    const attempts = await db.collection("visualAttempts").find({ recordId: record.recordId }).sort({ attemptNumber: 1 }).toArray();
    expect(attempts.map(a => a.attemptNumber)).toEqual([1, 2, 3]);
    expect(attempts.map(a => a.snapshot.state.root)).toEqual([4, 4, 4]);
    expect((await db.collection("visualRecords").findOne({ recordId: record.recordId }))!.activeAttemptId).toBe(attempts[2].attemptId);
    for (const attempt of attempts) expect(await db.collection("visualEvents").countDocuments({ attemptId: attempt.attemptId, type: "attempt-started" })).toBe(1);
  } finally { await client.close(); }
});

test("a lost new-attempt command response retries identically after reload", async ({ page }) => {
  const { client, db, learner } = await fixture(page), commands: string[] = []; let dropped = false;
  await page.route("**/api/visual-records/*/attempts", async route => {
    commands.push(route.request().postData()!);
    if (!dropped) { dropped = true; await route.fetch(); await route.abort("connectionreset"); } else await route.continue();
  });
  try {
    let dialog = await open(page); await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toHaveText("Saved");
    page.once("dialog", confirmation => confirmation.accept());
    await dialog.getByRole("button", { name: "Start New Attempt", exact: true }).click();
    await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toContainText("Waiting to reconnect");
    dialog = await open(page); await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toHaveText("Saved");
    expect(commands.length).toBeGreaterThanOrEqual(2); expect(commands[0]).toBe(commands[1]);
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    expect(await db.collection("visualAttempts").countDocuments({ recordId: record.recordId })).toBe(2);
    expect((await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!.attemptNumber).toBe(2);
  } finally { await client.close(); }
});

test("a local transition failure cannot partially archive or replace the current attempt", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  try {
    const dialog = await open(page), status = dialog.locator("[data-visual-host-footer]").getByRole("status");
    await expect(status).toHaveText("Saved");
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    await page.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException("Injected transition quota", "QuotaExceededError"); }; });
    page.once("dialog", confirmation => confirmation.accept());
    await dialog.getByRole("button", { name: "Start New Attempt", exact: true }).click();
    await expect(status).toContainText("Unable to start"); await expect(dialog.getByRole("slider")).toHaveAttribute("aria-valuenow", "3");
    const count = await page.evaluate(() => new Promise<number>((resolve, reject) => {
      const request = indexedDB.open("switchplay-visual-learning-records", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction("outboxes"), rows = transaction.objectStore("outboxes").getAll();
        rows.onsuccess = () => resolve(rows.result.length); rows.onerror = () => reject(rows.error);
        transaction.oncomplete = () => request.result.close();
      };
    }));
    expect(count).toBe(1); expect(await db.collection("visualAttempts").countDocuments({ recordId: record.recordId })).toBe(1);
    expect((await db.collection("visualRecords").findOne({ recordId: record.recordId }))!.activeAttemptId).toBe(record.activeAttemptId);
  } finally { await client.close(); }
});
