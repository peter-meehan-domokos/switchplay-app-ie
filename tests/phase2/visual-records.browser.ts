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
  await page.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ }).click();
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
    const status = () => dialog.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]');
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    const record = await db.collection("visualRecords").findOne({ principalKey: learner }); expect(record).toBeTruthy();
    const originalAttempt = record!.activeAttemptId;
    dialog = await open(page); slider = dialog.getByRole("slider"); await expect(slider).toHaveAttribute("aria-valuenow", "4");
    offline = true;
    await slider.focus(); await page.keyboard.press("ArrowLeft"); await expect(slider).toHaveAttribute("aria-valuenow", "3");
    await expect(status()).toContainText("pending");
    dialog = await open(page); slider = dialog.getByRole("slider"); await expect(slider).toHaveAttribute("aria-valuenow", "3");
    await expect(dialog).not.toHaveAttribute("data-visual-save-status", "Saved");
    offline = false; await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
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
    await expect(dialog.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]')).toContainText("Waiting to reconnect");
    dialog = await open(page);
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    expect(bodies.length).toBeGreaterThanOrEqual(2); expect(bodies[0]).toBe(bodies[1]);
    const record = await db.collection("visualRecords").findOne({ principalKey: learner });
    expect(await db.collection("visualEvents").countDocuments({ attemptId: record!.activeAttemptId, type: "attempt-started" })).toBe(1);
  } finally { await client.close(); }
});

test("quota failure never displays Saved and leaves the server snapshot unchanged", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  try {
    const dialog = await open(page), status = dialog.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]');
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    await expect(dialog.getByText("Saved", { exact: true })).toHaveCount(0);
    const record = await db.collection("visualRecords").findOne({ principalKey: learner });
    await page.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException("Injected test quota", "QuotaExceededError"); }; });
    await dialog.getByRole("slider").focus(); await page.keyboard.press("ArrowRight");
    await expect(status).toContainText("failed"); await expect(dialog).not.toHaveAttribute("data-visual-save-status", "Saved");
    expect((await db.collection("visualAttempts").findOne({ attemptId: record!.activeAttemptId }))!.snapshot.state.root).toBe(3);
  } finally { await client.close(); }
});

test("stale state reports conflict and preserves the local candidate across reload", async ({ page }) => {
  const { client, db, learner } = await fixture(page); let blocked = false;
  await page.route("**/api/visual-attempts/*/batches", route => blocked ? route.abort("internetdisconnected") : route.continue());
  try {
    let dialog = await open(page); const status = () => dialog.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]');
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
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
    expect(restoreRootsHostedState(serverSnapshot).recorded.learning.manipulation.math.movingRoot).toBe(5);
    dialog = await open(page); await expect(dialog.getByRole("slider")).toHaveAttribute("aria-valuenow", "4"); await expect(status()).toContainText("conflict");
    expect(await repo.events().countDocuments({ attemptId: attempt.attemptId, type: "root-placed" })).toBe(2);
  } finally { await client.close(); }
});

test("Integration saves an unchecked draft without inventing a calculation event", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  try {
    await page.setViewportSize({ width: 1000, height: 1200 }); await page.goto("/dev/interactive-visual-host");
    await page.getByRole("button", { name: "Open database review", exact: true }).click();
    await page.getByRole("button", { name: /^(Start|Continue): Integration$/ }).click();
    const dialog = page.getByRole("dialog", { name: "Integration", exact: true }), content = dialog.locator("[data-visual-host-content]");
    const next = dialog.locator("[data-visual-host-footer]").getByRole("button", { name: "Next", exact: true });
    await next.click(); await next.click(); await content.getByRole("group", { name: /area/i }).getByRole("button").first().click();
    for (let i = 0; i < 4; i++) await next.click();
    await content.getByRole("textbox", { name: "Your answer", exact: true }).fill("12.34");
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    const record = await db.collection("visualRecords").findOne({ principalKey: learner, activityId: "integration-area" });
    expect((await db.collection("visualAttempts").findOne({ attemptId: record!.activeAttemptId }))!.snapshot.panel.draft).toBe("12.34");
    expect(await db.collection("visualEvents").countDocuments({ attemptId: record!.activeAttemptId, type: "calculation-checked" })).toBe(0);
    await page.reload(); await page.getByRole("button", { name: "Open database review", exact: true }).click();
    await page.getByRole("button", { name: /^(Start|Continue): Integration$/ }).click();
    await expect(content.getByRole("textbox", { name: "Your answer", exact: true })).toHaveValue("12.34");
    await content.getByRole("button", { name: "Check calculation", exact: true }).click();
    await dialog.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Rewind", exact: true })).toBeVisible();
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    const completedAt = (await db.collection("visualAttempts").findOne({ attemptId: record!.activeAttemptId }))!.firstCompletedAt;
    await dialog.getByRole("button", { name: "Rewind", exact: true }).click();
    for (let i = 0; i < 6; i++) await next.click();
    await expect(content.getByRole("textbox", { name: "Your answer", exact: true })).toHaveValue("12.34");
    await expect(content.locator("[data-integration-part]")).toHaveAttribute("data-integration-part", "calculate");
    await dialog.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    expect(await db.collection("visualEvents").countDocuments({ attemptId: record!.activeAttemptId, type: "attempt-completed" })).toBe(2);
    expect((await db.collection("visualAttempts").findOne({ attemptId: record!.activeAttemptId }))!.firstCompletedAt).toEqual(completedAt);
  } finally { await client.close(); }
});

test("Roots Rewind preserves its attempt and stored return state", async ({ page }) => {
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
    await expect(dialog.getByRole("button", { name: "Rewind", exact: true })).toBeVisible();
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    await dialog.getByRole("button", { name: "Rewind", exact: true }).click();
    await expect(slider).toHaveAttribute("aria-valuenow", "4");
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
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
    const dialog = await open(page), status = dialog.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]');
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    blocked = true; await dialog.getByRole("slider").focus(); await page.keyboard.press("ArrowRight"); await expect(status).toContainText("pending");
    blocked = false; await page.reload(); await page.getByRole("button", { name: "Open database review", exact: true }).click();
    await expect.poll(async () => (await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!.snapshot.state.root).toBe(4);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally { await client.close(); }
});

test("New requires confirmation and double activation creates one retained attempt", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  try {
    const dialog = await open(page), slider = dialog.getByRole("slider");
    await slider.focus(); await page.keyboard.press("ArrowRight"); await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    const button = dialog.getByRole("button", { name: "New", exact: true });
    page.once("dialog", async confirmation => { expect(confirmation.message()).toContain("history will be kept"); await confirmation.dismiss(); });
    await button.click(); await expect(slider).toHaveAttribute("aria-valuenow", "4");
    expect(await db.collection("visualAttempts").countDocuments({ recordId: record.recordId })).toBe(1);
    await page.evaluate(() => { window.confirm = () => true; });
    await button.evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
    await expect(slider).toHaveAttribute("aria-valuenow", "3"); await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    const current = (await db.collection("visualRecords").findOne({ recordId: record.recordId }))!;
    expect(current.activeAttemptId).not.toBe(record.activeAttemptId);
    expect(await db.collection("visualAttempts").countDocuments({ recordId: record.recordId })).toBe(2);
    expect((await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!.snapshot.state.root).toBe(4);
    expect((await db.collection("visualAttempts").findOne({ attemptId: current.activeAttemptId }))!.snapshot.attemptNumber).toBe(2);
    expect(await db.collection("visualEvents").countDocuments({ attemptId: current.activeAttemptId, type: "attempt-started" })).toBe(1);
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      const header = dialog.locator("[data-visual-host-header]");
      await expect.poll(async () => (await header.boundingBox())!.width).toBeLessThanOrEqual(width * .35 + .1);
      const next = await dialog.getByRole("button", { name: "Next", exact: true }).boundingBox();
      const start = await button.boundingBox(), close = await dialog.getByRole("button", { name: "Close interactive visual" }).boundingBox();
      expect(next!.x + next!.width).toBeLessThanOrEqual(width - 7.9);
      expect(start!.y).toBeCloseTo(close!.y, 1); expect(close!.x - start!.x - start!.width).toBeCloseTo(8, 1);
      expect(start!.width).toBeCloseTo(close!.width, 1); expect(close!.x + close!.width).toBeCloseTo(width - 12, 1);
      expect(start!.width).toBeGreaterThanOrEqual(44); expect(close!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: `/private/tmp/visual-ux-new-close-${width}.png` });
    }
  } finally { await client.close(); }
});

test("multiple confirmed offline attempts survive reload and register in order without losing earlier work", async ({ page }) => {
  const { client, db, learner } = await fixture(page); let offline = false;
  await page.route("**/api/visual-**", route => offline ? route.abort("internetdisconnected") : route.continue());
  try {
    let dialog = await open(page), slider = dialog.getByRole("slider");
    const status = () => dialog.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]');
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    offline = true; await slider.focus(); await page.keyboard.press("ArrowRight"); await expect(status()).toContainText("pending");
    for (let i = 0; i < 2; i++) {
      page.once("dialog", confirmation => confirmation.accept());
      await dialog.getByRole("button", { name: "New", exact: true }).click();
      await expect(slider).toHaveAttribute("aria-valuenow", "3");
      await slider.focus(); await page.keyboard.press("ArrowRight"); await expect(slider).toHaveAttribute("aria-valuenow", "4");
      await expect(status()).toContainText("pending");
    }
    dialog = await open(page); slider = dialog.getByRole("slider"); await expect(slider).toHaveAttribute("aria-valuenow", "4");
    await expect(dialog).not.toHaveAttribute("data-visual-save-status", "Saved"); offline = false; await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
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
    let dialog = await open(page); await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    page.once("dialog", confirmation => confirmation.accept());
    await dialog.getByRole("button", { name: "New", exact: true }).click();
    await expect(dialog.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]')).toContainText("Waiting to reconnect");
    dialog = await open(page); await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    expect(commands.length).toBeGreaterThanOrEqual(2); expect(commands[0]).toBe(commands[1]);
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    expect(await db.collection("visualAttempts").countDocuments({ recordId: record.recordId })).toBe(2);
    expect((await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!.attemptNumber).toBe(2);
  } finally { await client.close(); }
});

test("a local transition failure cannot partially archive or replace the current attempt", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  try {
    const dialog = await open(page), status = dialog.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]');
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    await page.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException("Injected transition quota", "QuotaExceededError"); }; });
    page.once("dialog", confirmation => confirmation.accept());
    await dialog.getByRole("button", { name: "New", exact: true }).click();
    await expect(status).toContainText("Unable to start"); await expect(dialog.getByRole("slider")).toHaveAttribute("aria-valuenow", "3");
    const count = await page.evaluate(() => new Promise<number>((resolve, reject) => {
      const request = indexedDB.open("switchplay-visual-learning-records");
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

for (const kind of ["version", "schema", "invalid-state"] as const) {
  test(`unsafe ${kind} restore preserves the historical attempt and requires confirmed recovery`, async ({ page }) => {
    const { client, db, learner } = await fixture(page);
    try {
      let dialog = await open(page); await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
      const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
      const changes = kind === "version" ? { activityVersion: 0 } : kind === "schema" ? { snapshotSchema: 99 } : { snapshot: { cannotHydrate: true } };
      await db.collection("visualAttempts").updateOne({ attemptId: record.activeAttemptId }, { $set: changes });
      const before = await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId });
      dialog = await open(page); await expect(dialog.getByRole("slider")).toHaveCount(0);
      await expect(dialog.getByText(/saved attempt cannot be restored/)).toBeVisible();
      page.once("dialog", confirmation => confirmation.dismiss()); await dialog.getByRole("button", { name: "New", exact: true }).click();
      expect(await db.collection("visualAttempts").countDocuments({ recordId: record.recordId })).toBe(1);
      page.once("dialog", confirmation => confirmation.accept()); await dialog.getByRole("button", { name: "New", exact: true }).click();
      await expect(dialog.getByRole("slider")).toHaveAttribute("aria-valuenow", "3");
      await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
      expect(await db.collection("visualAttempts").countDocuments({ recordId: record.recordId })).toBe(2);
      const historical = await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId });
      expect(historical!.snapshot).toEqual(before!.snapshot); expect(historical!.activityVersion).toBe(before!.activityVersion); expect(historical!.snapshotSchema).toBe(before!.snapshotSchema);
      expect(await db.collection("visualEvents").countDocuments({ attemptId: record.activeAttemptId, type: "attempt-started" })).toBe(1);
    } finally { await client.close(); }
  });
}

for (const kind of ["invalid-state", "version"] as const) {
  test(`pending ${kind} recovery backs up offline work before registering the confirmed next attempt`, async ({ page }) => {
    const { client, db, learner } = await fixture(page);
    let offline = false, allowBackupAck = false, dropped = false;
    const bodies: string[] = [];
    await page.route("**/api/visual-**", async route => {
      if (offline) return route.abort("internetdisconnected");
      if (route.request().url().includes("/recovery-batches")) {
        bodies.push(route.request().postData()!);
        if (!allowBackupAck) {
          if (!dropped) { const response = await route.fetch(); expect(response.ok()).toBe(true); dropped = true; }
          return route.abort("connectionreset");
        }
      }
      return route.continue();
    });
    try {
      let dialog = await open(page);
      const status = () => dialog.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]');
      await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
      const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
      offline = true; await dialog.getByRole("slider").focus(); await page.keyboard.press("ArrowRight");
      await expect(dialog.getByRole("slider")).toHaveAttribute("aria-valuenow", "4"); await expect(status()).toContainText("pending");
      await db.collection("visualAttempts").updateOne({ attemptId: record.activeAttemptId }, { $set: kind === "version" ? { activityVersion: 99 } : { snapshot: { cannotHydrate: true } } });
      const unsafe = (await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!;
      offline = false; dialog = await open(page);
      await expect(dialog.getByRole("slider")).toHaveCount(0);
      // Recovery remains queued internally; routine backup progress is silent.
      await expect(dialog).toHaveAttribute("data-visual-save-status", "Previous attempt pending backup");
      await expect(dialog.locator("[data-visual-host-footer]")).not.toContainText("pending backup");
      await expect.poll(() => dropped).toBe(true);
      await expect.poll(() => db.collection("visualSnapshotCheckpoints").countDocuments({ attemptId: record.activeAttemptId, reason: "restore-recovery" })).toBe(1);
      page.once("dialog", confirmation => confirmation.accept()); await dialog.getByRole("button", { name: "New", exact: true }).click();
      await expect(dialog.getByRole("slider")).toHaveAttribute("aria-valuenow", "3"); await expect(dialog).not.toHaveAttribute("data-visual-save-status", "Saved");
      allowBackupAck = true; dialog = await open(page);
      await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");
      expect(bodies.length).toBeGreaterThanOrEqual(2); expect(bodies.every(body => body === bodies[0])).toBe(true);
      expect(await db.collection("visualAttempts").countDocuments({ recordId: record.recordId })).toBe(2);
      expect(await db.collection("visualEvents").countDocuments({ attemptId: record.activeAttemptId, type: "root-placed" })).toBe(1);
      const backup = (await db.collection("visualSnapshotCheckpoints").findOne({ attemptId: record.activeAttemptId, reason: "restore-recovery" }))!;
      expect(backup.snapshot.state.root).toBe(4);
      const historical = (await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!;
      expect(historical.snapshot).toEqual(unsafe.snapshot); expect(historical.activityVersion).toBe(unsafe.activityVersion);
      expect((await db.collection("visualRecords").findOne({ recordId: record.recordId }))!.activeAttemptId).not.toBe(record.activeAttemptId);
    } finally { await client.close(); }
  });
}

test("emergency unavailability stops rendering and keeps the pending local change", async ({ page }) => {
  const { client, db, learner } = await fixture(page);
  try {
    const dialog = await open(page), status = dialog.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]');
    await expect(dialog).toHaveAttribute("data-visual-save-status", "Saved"); const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    await page.route("**/api/visual-attempts/*/batches", route => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "VISUAL_UNAVAILABLE" }) }));
    await dialog.getByRole("slider").focus(); await page.keyboard.press("ArrowRight");
    await expect(dialog.locator("[data-visual-host-content]").getByRole("alert")).toContainText("unavailable"); await expect(dialog.getByRole("slider")).toHaveCount(0);
    await expect(status).toContainText("Pending work is kept on this device");
    await expect(dialog.getByRole("button", { name: "New", exact: true })).toHaveCount(0);
    expect((await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!.snapshot.state.root).toBe(3);
    await dialog.getByRole("button", { name: "Close interactive visual" }).click();
    await expect(page.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ })).toBeFocused();
  } finally { await client.close(); }
});

test("a visual render failure leaves the generic Close action and origin focus available", async ({ page }) => {
  await page.goto("/dev/interactive-visual-host");
  const trigger = page.getByRole("button", { name: "Open failing mock", exact: true }); await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Development failing mock", exact: true });
  await expect(dialog.locator("[data-visual-host-content]").getByRole("alert")).toContainText("unavailable");
  await dialog.getByRole("button", { name: "Close interactive visual" }).click(); await expect(trigger).toBeFocused();
});

test("a stale browser tab cannot overwrite progress through the shared local outbox", async ({ page }) => {
  const { client, db, learner } = await fixture(page), other = await page.context().newPage();
  try {
    const first = await open(page); await expect(first).toHaveAttribute("data-visual-save-status", "Saved");
    const second = await open(other);
    await expect(second).toHaveAttribute("data-visual-save-status", "Saved");
    await second.getByRole("slider").focus(); await other.keyboard.press("ArrowRight"); await other.keyboard.press("ArrowRight");
    await expect(second.getByRole("slider")).toHaveAttribute("aria-valuenow", "5"); await expect(second).toHaveAttribute("data-visual-save-status", "Saved");
    await first.getByRole("slider").focus(); await page.keyboard.press("ArrowRight");
    await expect(first.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]')).toContainText("Another tab changed");
    const record = (await db.collection("visualRecords").findOne({ principalKey: learner }))!;
    expect((await db.collection("visualAttempts").findOne({ attemptId: record.activeAttemptId }))!.snapshot.state.root).toBe(5);
    expect(await db.collection("visualEvents").countDocuments({ attemptId: record.activeAttemptId, type: "root-placed" })).toBe(2);
  } finally { await other.close(); await client.close(); }
});
