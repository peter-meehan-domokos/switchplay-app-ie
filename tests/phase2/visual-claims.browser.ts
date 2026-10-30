import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { VisualLearningRecordRepository } from "../../src/lib/visualLearningRecords/repository";
import { createRootsHostedState, reduceRootsHostedState, rootsSnapshot } from "../../src/app/step-visuals/activities/roots-factors/hostState";

test("real claim endpoint retains account history, restores foreground guest and allocates the next attempt from the merged count", async ({ page }) => {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const repo = new VisualLearningRecordRepository(client.db(process.env.MONGODB_DB!), client), account = { kind: "account" as const, id: process.env.PHASE2_USER_ID! };
    const existing = await repo.open(account, "roots-and-factors", randomUUID(), { kind: "direct" });
    const state = reduceRootsHostedState(createRootsHostedState(existing.attempt.attemptId), { type: "root", action: { type: "place", root: 5, revision: 0 } });
    await repo.append(account, existing.attempt.attemptId, { writeId: randomUUID(), expectedStateRevision: 0, visitId: existing.visit.visitId, activityVersion: 1, snapshotSchema: 1,
      snapshot: rootsSnapshot(state), events: state.recorded.records.events.map(event => ({ eventId: randomUUID(), writerId: randomUUID(), clientSequence: event.sequence,
        clientOccurredAt: new Date().toISOString(), activityVersion: 1, eventSchema: 1, type: event.type, payload: event })) });
    await page.goto("/dev/interactive-visual-host"); await page.getByRole("button", { name: "Open guest database review", exact: true }).click();
    await page.getByRole("button", { name: "Open Roots and Factors", exact: true }).click();
    let host = page.getByRole("dialog", { name: "Roots and Factors", exact: true });
    await host.getByRole("slider").focus(); await page.keyboard.press("ArrowRight");
    await expect(host.locator("[data-visual-host-footer]").getByRole("status")).toHaveText("Saved");
    const cookie = (await page.context().cookies()).find(cookie => cookie.name === "switchplay_visual_guest")!, guestLearner = `guest:${cookie.value.split(".")[0]}`;
    const guestRoot = (await repo.records().findOne({ principalKey: guestLearner }))!, foreground = guestRoot.activeAttemptId;
    const payload = { claimId: randomUUID(), foregroundAttemptId: foreground }, headers = { Origin: process.env.PHASE2_BASE_URL!, "X-Visual-Learner": `account:${account.id}` };
    expect((await page.request.post("/api/visual-guests/claim", { data: payload, headers })).status()).toBe(401);
    expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).ok()).toBe(true);
    expect((await page.request.post("/api/visual-guests/claim", { data: payload, headers: { ...headers, Origin: "https://attacker.invalid" } })).status()).toBe(403);
    const response = await page.request.post("/api/visual-guests/claim", { data: payload, headers }); expect(response.ok()).toBe(true);
    const receipt = await response.json(); expect(receipt.mappings[0].nextAttemptNumber).toBe(3);
    expect((await page.context().cookies()).some(cookie => cookie.name === "switchplay_visual_guest")).toBe(false);
    expect((await repo.current(account, existing.record.recordId)).attempt.attemptId).toBe(foreground);
    expect(await repo.attempts().countDocuments({ recordId: existing.record.recordId })).toBe(2);
    expect((await repo.attempts().findOne({ attemptId: existing.attempt.attemptId }))!.snapshot).toEqual(rootsSnapshot(state));
    expect((await page.request.get(`/api/visual-records/${guestRoot.recordId}/current`, { headers: { "X-Visual-Learner": guestLearner } })).status()).toBe(401);
    // S15a proves the real account pipeline. S15b separately migrates local queues.
    await page.goto("/dev/interactive-visual-host"); await page.getByRole("button", { name: "Open database review", exact: true }).click();
    await page.getByRole("button", { name: "Open Roots and Factors", exact: true }).click(); host = page.getByRole("dialog", { name: "Roots and Factors", exact: true });
    await expect(host.getByRole("slider")).toHaveAttribute("aria-valuenow", "4");
    page.once("dialog", dialog => dialog.accept()); await host.getByRole("button", { name: "Start New Attempt", exact: true }).click();
    await expect(host.getByRole("slider")).toHaveAttribute("aria-valuenow", "3"); await expect(host.locator("[data-visual-host-footer]").getByRole("status")).toHaveText("Saved");
    const next = await repo.current(account, existing.record.recordId); expect(next.attempt.attemptNumber).toBe(3); expect(next.attempt.attemptId).not.toBe(foreground);
    expect(await repo.attempts().countDocuments({ recordId: existing.record.recordId })).toBe(3);
    expect(await repo.events().countDocuments({ attemptId: foreground, type: "attempt-started" })).toBe(1);
    const retry = await page.request.post("/api/visual-guests/claim", { data: payload, headers }); expect(await retry.json()).toEqual(receipt);
    expect((await repo.current(account, existing.record.recordId)).attempt.attemptId).toBe(next.attempt.attemptId);
  } finally { await client.close(); }
});
