import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import type { VisualClaimJournal } from "../../src/lib/visualLearningRecords/claimOutbox";
import type { VisualOutbox } from "../../src/lib/visualLearningRecords/outbox";

let client: MongoClient, bundle: string;
test.beforeAll(async () => {
  assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect();
  bundle = (await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import {createBrowserVisualStore} from './src/lib/visualLearningRecords/browserStore';
    import {rememberVisualGuestClaim,completeVisualGuestClaim} from './src/lib/visualLearningRecords/claimClient';
    const store=createBrowserVisualStore();window.claimRows=learner=>store.list(learner);window.claimJournal=id=>store.readClaim(id);
    window.rememberClaim=async guestLearner=>{const rows=await store.list(guestLearner),current=rows.find(row=>row.key===guestLearner+'|roots-and-factors');return rememberVisualGuestClaim({guestLearner,activityId:'roots-and-factors',foregroundAttemptId:current.session.attemptId},store);};
    window.completeClaim=(claimId,accountLearner)=>completeVisualGuestClaim({claimId,accountLearner,store});
    const put=IDBObjectStore.prototype.put;window.failPreparedJournal=()=>{IDBObjectStore.prototype.put=function(value,...rest){if(this.name==='claims'&&value.phase==='prepared')throw new DOMException('Injected journal quota','QuotaExceededError');return put.call(this,value,...rest);};};
    window.restoreClaimWrites=()=>{IDBObjectStore.prototype.put=put;};
  ` }, bundle: true, write: false, platform: "browser", format: "iife", define: { "process.env.NODE_ENV": '"test"' } })).outputFiles![0].text;
});
test.afterAll(async () => { await client?.close(); });
type Harness = { claimRows(learner: string): Promise<VisualOutbox[]>; claimJournal(id: string): Promise<VisualClaimJournal>;
  rememberClaim(learner: string): Promise<VisualClaimJournal>; completeClaim(id: string, account: string): Promise<VisualClaimJournal>;
  failPreparedJournal(): void; restoreClaimWrites(): void };
const db = () => client.db(process.env.MONGODB_DB!);
async function fixture() {
  const seed = (await db().collection("users").findOne({ username: "phase2" }))!, id = new ObjectId(), username = `claim-${randomUUID()}`, now = new Date();
  await db().collection("users").insertOne({ _id: id, username, email: `${username}@example.invalid`, passwordHash: seed.passwordHash, cardsData: [], decksData: [], createdAt: now, updatedAt: now });
  return { username, learner: `account:${id.toHexString()}` };
}
async function login(page: Page, username: string) { expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).ok()).toBe(true); }
async function open(page: Page, guest = false) {
  await page.goto("/dev/interactive-visual-host"); await page.getByRole("button", { name: guest ? "Open guest database review" : "Open database review", exact: true }).click();
  await page.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ }).click(); return page.getByRole("dialog", { name: "Roots and Factors", exact: true });
}
const status = (page: Page) => page.locator('[data-visual-host-footer] [role="status"], [data-visual-host-footer] [role="alert"]');
async function inject(page: Page) { await page.addScriptTag({ content: bundle }); }
async function menu(page: Page) { await page.goto("/dev/interactive-visual-host"); await inject(page); }
async function newAttempt(page: Page) { page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "New", exact: true }).click(); await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "3"); }
async function changeRoot(page: Page, count = 1) { await page.getByRole("slider").focus(); for (let i = 0; i < count; i++) await page.keyboard.press("ArrowRight"); }
async function guestLearner(page: Page) { return `guest:${(await page.context().cookies()).find(cookie => cookie.name === "switchplay_visual_guest")!.value.split(".")[0]}`; }
async function rows(page: Page, learner: string) { return page.evaluate(learner => (window as unknown as Harness).claimRows(learner), learner); }
async function remember(page: Page, learner: string) { return page.evaluate(learner => (window as unknown as Harness).rememberClaim(learner), learner); }
async function complete(page: Page, claimId: string, learner: string) { return page.evaluate(([id, learner]) => (window as unknown as Harness).completeClaim(id, learner), [claimId, learner]); }

test("lost claim response reload preserves pending account history, multiple offline guest attempts and foreground state", async ({ page }) => {
  const account = await fixture(); await login(page, account.username);
  let holdAccount = false, holdGuest = false, dropped = false;
  await page.route("**/api/visual-attempts/*/batches", route => {
    const actor = route.request().headers()["x-visual-learner"];
    return (actor === account.learner ? holdAccount : holdGuest) ? route.abort("internetdisconnected") : route.continue();
  });
  await page.route("**/api/visual-guests/claim", async route => { if (!dropped) { dropped = true; await route.fetch(); await route.abort("connectionreset"); } else await route.continue(); });
  await open(page); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved"); holdAccount = true; await changeRoot(page, 2); await expect(status(page)).toContainText("pending");
  await inject(page); await expect.poll(async () => (await rows(page, account.learner)).some(row => !!row.flight)).toBe(true);
  const pending = (await rows(page, account.learner)).find(row => row.key === `${account.learner}|roots-and-factors`)!;
  await page.request.post("/api/auth/logout"); await open(page, true); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved");
  const guest = await guestLearner(page); holdGuest = true; await changeRoot(page);
  await newAttempt(page); await changeRoot(page); await newAttempt(page); await changeRoot(page); await expect(status(page)).toContainText("pending");
  await menu(page); const before = await rows(page, guest), current = before.find(row => row.key === `${guest}|roots-and-factors`)!;
  expect(before).toHaveLength(3); expect(current.session.attemptNumber).toBe(3);
  const journal = await remember(page, guest); await login(page, account.username); holdGuest = false;
  const failure = await page.evaluate(async ([id, learner]) => { try { await (window as unknown as Harness).completeClaim(id, learner); return "unexpected success"; } catch (error) { return String(error); } }, [journal.claimId, account.learner]);
  expect(failure).not.toBe("unexpected success"); expect(dropped).toBe(true);
  expect((await page.evaluate(id => (window as unknown as Harness).claimJournal(id), journal.claimId)).phase).toBe("prepared");
  await page.context().clearCookies({ name: "switchplay_visual_guest" }); await page.reload(); await inject(page);
  const switched = await page.evaluate(async id => { try { await (window as unknown as Harness).completeClaim(id, "account:other"); return "unexpected success"; } catch (error) { return String(error); } }, journal.claimId);
  expect(switched).toContain("VISUAL_SESSION_CONFLICT");
  expect((await complete(page, journal.claimId, account.learner)).phase).toBe("installed"); expect(await rows(page, guest)).toEqual([]);
  const moved = await rows(page, account.learner), active = moved.find(row => row.key === `${account.learner}|roots-and-factors`)!;
  expect(active.session.attemptId).toBe(current.session.attemptId); expect(active.session.attemptNumber).toBe(3); expect(active.session.nextAttemptNumber).toBe(5);
  expect(moved.find(row => row.session.attemptId === pending.session.attemptId)!.flight).toEqual(pending.flight);
  await open(page); await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "4"); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved");
  holdAccount = false; await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await db().collection("visualAttempts").findOne({ attemptId: pending.session.attemptId }))!.snapshot.state.root).toBe(5);
  const root = (await db().collection("visualRecords").findOne({ principalKey: account.learner }))!;
  expect(root.activeAttemptId).toBe(current.session.attemptId); expect(root.attemptCount).toBe(4);
  const events = await db().collection("visualEvents").find({ attemptId: current.session.attemptId }).toArray();
  expect(events.filter(event => event.type === "attempt-started")).toHaveLength(1); expect(new Set(events.map(event => event.eventId)).size).toBe(events.length);
});

test("already-confirmed offline account attempts register before claim changes the merged allocation", async ({ page }) => {
  const account = await fixture(); await login(page, account.username); let held = false;
  await page.route("**/api/visual-attempts/*/batches", route => held && route.request().headers()["x-visual-learner"] === account.learner ? route.abort("internetdisconnected") : route.continue());
  await open(page); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved"); held = true; await changeRoot(page);
  await newAttempt(page); await changeRoot(page); await newAttempt(page); await changeRoot(page); await expect(status(page)).toContainText("pending");
  await menu(page); const accountRows = await rows(page, account.learner); expect(accountRows).toHaveLength(3); expect(accountRows.filter(row => row.command)).toHaveLength(2);
  await page.request.post("/api/auth/logout"); await open(page, true); await changeRoot(page); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved");
  const guest = await guestLearner(page); await menu(page); const journal = await remember(page, guest); await login(page, account.username); held = false;
  const installed = await complete(page, journal.claimId, account.learner); expect(installed.phase).toBe("installed");
  const root = (await db().collection("visualRecords").findOne({ principalKey: account.learner }))!; expect(root.attemptCount).toBe(4); expect(root.activeAttemptId).toBe(journal.foregroundAttemptId);
  for (const row of accountRows) {
    const attempt = (await db().collection("visualAttempts").findOne({ attemptId: row.session.attemptId }))!;
    expect(attempt.attemptNumber).toBe(row.session.attemptNumber); expect(attempt.snapshot.attemptNumber).toBe(row.snapshot!.attemptNumber);
  }
  expect((await rows(page, account.learner)).find(row => row.key === `${account.learner}|roots-and-factors`)!.session.nextAttemptNumber).toBe(5);
});

test("pending guest saves and a failed durable journal both stop before server claim and remain safely retryable", async ({ page }) => {
  const account = await fixture(); let held = false, claims = 0;
  await page.route("**/api/visual-attempts/*/batches", route => held ? route.abort("internetdisconnected") : route.continue());
  await page.route("**/api/visual-guests/claim", route => { claims++; return route.continue(); });
  await open(page, true); await expect(page.locator("dialog[data-visual-save-status]")).toHaveAttribute("data-visual-save-status", "Saved"); const guest = await guestLearner(page); held = true; await changeRoot(page); await expect(status(page)).toContainText("pending");
  await menu(page); const journal = await remember(page, guest); await login(page, account.username);
  const tryClaim = () => page.evaluate(async ([id, learner]) => { try { await (window as unknown as Harness).completeClaim(id, learner); return "unexpected success"; } catch (error) { return String(error); } }, [journal.claimId, account.learner]);
  expect(await tryClaim()).toContain("PENDING_WORK"); expect(claims).toBe(0);
  held = false; await page.evaluate(() => (window as unknown as Harness).failPreparedJournal());
  expect(await tryClaim()).toContain("Injected journal quota"); expect(claims).toBe(0);
  expect((await db().collection("visualGuests").findOne({ guestId: guest.slice(6) }))!.status).toBe("active");
  await page.evaluate(() => (window as unknown as Harness).restoreClaimWrites());
  expect((await complete(page, journal.claimId, account.learner)).phase).toBe("installed"); expect(claims).toBe(1);
  const root = (await db().collection("visualRecords").findOne({ principalKey: account.learner }))!;
  expect((await db().collection("visualAttempts").findOne({ attemptId: root.activeAttemptId }))!.snapshot.state.root).toBe(4);
});
