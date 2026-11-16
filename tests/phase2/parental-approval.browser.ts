import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

// Real Next server, disposable MongoDB and captured mail. Parent screens at phone width.
const origin = process.env.PHASE2_BASE_URL!;
let client: MongoClient, db: Db, counter = 0;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); db = client.db(process.env.MONGODB_DB); });
test.afterAll(async () => { await client?.close(); });
const year = new Date().getFullYear();
const unique = (tag: string) => `${tag}${Date.now().toString(36)}${++counter}`;
async function outbox() { return await fetch(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/emails`).then(r => r.json()) as { to: string[]; subject: string; text: string }[]; }
async function tokenFor(to: string, pattern: RegExp) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) { const found = (await outbox()).filter(m => m.to.includes(to) && pattern.test(m.subject)).at(-1); if (found) return found.text.match(/#([\w-]{43})/)![1]; await new Promise(r => setTimeout(r, 200)); }
  throw new Error("expected email did not arrive");
}
async function child(dob = `${year - 14}-01-01`) {
  const _id = new ObjectId(), username = unique("Kid"), now = new Date();
  await db.collection("users").insertOne({ _id, email: `${username.toLowerCase()}@example.invalid`, username, passwordHash: await bcrypt.hash("local-test-only", 4), cardsData: [{ keep: true }], decksData: [], sharedDeckData: [],
    permissions: { publicPublishing: false }, safeguarding: { dateOfBirth: dob, dobSource: "self-declared", dobRecordedAt: now, ageAssurance: { verification: "none" } }, createdAt: now, updatedAt: now });
  await db.collection("puckleMemberships").insertOne({ userId: _id, name: "Niamh", registrationCategory: "student", mobile: null, initialRegistrationSource: "join", welcome: { eligible: true }, createdAt: now, updatedAt: now });
  return { _id, username };
}
async function signedIn(browser: Browser, username: string, site = "puckle") {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, extraHTTPHeaders: { "x-forwarded-for": `10.5.${counter % 250}.${Math.floor(Math.random() * 250)}` },
    storageState: { cookies: [{ name: "site", value: site, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
  expect((await context.request.post(`${origin}/api/auth/login`, { data: { identifier: username, password: "local-test-only" } })).status()).toBe(200);
  return context;
}
const ask = (context: Awaited<ReturnType<typeof signedIn>>, data: Record<string, unknown>, headers: Record<string, string> = { Origin: origin }) =>
  context.request.post(`${origin}/api/account/parental-approval`, { headers, data });
const approvalOf = async (_id: ObjectId) => (await db.collection("users").findOne({ _id }))!.safeguarding.groupExperienceApproval;
async function parentPage(browser: Browser, token: string): Promise<{ page: Page; requests: string[] }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const requests: string[] = []; context.on("request", r => requests.push(r.url()));
  const page = await context.newPage(); await page.goto(`${origin}/api/account-actions/open#${token}`); return { page, requests };
}
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

test("a signed-in under-16 requests approval; forged fields and other origins are ignored or refused; status is the same on every site", async ({ browser, playwright }) => {
  const kid = await child(), guardian = `${unique("parent")}@example.invalid`, context = await signedIn(browser, kid.username);
  expect((await (await playwright.request.newContext({ baseURL: origin })).get("/api/account/parental-approval")).status()).toBe(401);
  expect((await ask(context, { action: "request", guardianEmail: guardian }, { Origin: "https://evil.invalid" })).status()).toBe(400);
  expect((await ask(context, { action: "request", guardianEmail: guardian, expectedUserId: new ObjectId().toHexString() })).status()).toBe(409);
  const sent = await ask(context, { action: "request", guardianEmail: guardian, status: "approved", scopeId: "puckle-only", guardianDeclaration: { textVersion: "x" } });
  expect(sent.status()).toBe(200); expect(await sent.json()).toMatchObject({ status: "pending", delivery: "sent" });
  const record = await approvalOf(kid._id); expect(record).toMatchObject({ status: "pending", scopeId: "shared-group-experiences", generation: 1 }); expect(record.guardianDeclaration).toBeUndefined();
  for (const site of ["puckle", "switchplay", "strat17"]) {
    const other = await signedIn(browser, kid.username, site); const summary = await (await other.request.get(`${origin}/api/account/parental-approval`)).json();
    expect(summary).toMatchObject({ scopeId: "shared-group-experiences", status: "pending", eligibility: "eligible" }); expect(JSON.stringify(summary)).not.toContain(guardian);
  }
  const adult = await child(`${year - 17}-01-01`), adultContext = await signedIn(browser, adult.username);
  expect((await ask(adultContext, { action: "request", guardianEmail: `${unique("p")}@example.invalid` })).status()).toBe(409);
  expect(await db.collection("users").countDocuments({ email: guardian })).toBe(0);
});
test("parent approves on a phone: explanation, explicit declaration, no sign-in, no token leaks; no follow-up email; the founder is told", async ({ browser }) => {
  const kid = await child(), guardian = `${unique("parent")}@example.invalid`, kidContext = await signedIn(browser, kid.username);
  await ask(kidContext, { action: "request", guardianEmail: guardian });
  const token = await tokenFor(guardian, /approval needed/);
  const { page, requests } = await parentPage(browser, token);
  await expect(page.getByRole("heading", { name: "Parent or guardian approval" })).toBeVisible();
  expect(page.url()).toBe(`${origin}/api/account-actions/open`);
  await expect(page.locator("#parent .child")).toHaveText("Niamh"); await expect(page.getByText(/one approval covers equivalent Group Experiences anywhere in Puckle/)).toBeVisible();
  await expect(page.getByText(/not permission for live tuition/)).toBeVisible();
  const declaration = page.getByRole("checkbox", { name: /parent or legal guardian/ }); await expect(declaration).not.toBeChecked(); await noOverflow(page);
  expect((await approvalOf(kid._id)).status).toBe("pending"); // Opening and reading decided nothing.
  await page.getByRole("button", { name: "Approve" }).click(); await expect(page.getByRole("status")).toContainText("tick the box");
  expect((await approvalOf(kid._id)).status).toBe("pending");
  await declaration.check(); await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("status")).toContainText("Your approval has been recorded. You do not need to do anything else"); await expect(page.getByRole("button", { name: "Approve" })).toBeHidden();
  const record = await approvalOf(kid._id); expect(record).toMatchObject({ status: "approved", guardianDeclaration: { textVersion: "guardian-declaration-v1" } });
  expect((await db.collection("users").findOne({ _id: kid._id }))!.cardsData).toEqual([{ keep: true }]);
  expect(requests.every(url => url.startsWith(origin) && !url.includes(token))).toBe(true); expect(requests.join("\n")).not.toMatch(/analytics|vercel/);
  expect((await page.context().request.get(`${origin}/api/auth/me`)).status()).toBe(401); // The parent is not signed in as anyone.
  expect((await kidContext.request.get(`${origin}/api/auth/me`)).status()).toBe(200); // The child's own session is unaffected.
  await page.reload(); await expect(page.getByRole("status")).toContainText("Reopen the link");
  // No second email to the parent, and no withdrawal link of any kind.
  await page.waitForTimeout(1500); expect((await outbox()).filter(m => m.to.includes(guardian)).length).toBe(1);
  expect(await db.collection("accountEmailActions").countDocuments({ userId: kid._id, purpose: { $ne: "parent-request" } })).toBe(0);
  // The founder is told, after the response.
  await expect.poll(async () => (await outbox()).some(m => m.to.includes("founder@example.invalid") && /^\[FYI\] ✅ PARENT APPROVED: Niamh$/.test(m.subject))).toBe(true);
  await expect.poll(async () => (await approvalOf(kid._id)).decisionFounderNotification?.status).toBe("sent");
  expect(await (await kidContext.request.get(`${origin}/api/account/parental-approval`)).json()).toMatchObject({ status: "approved", canRequest: false });
});
test("a used link and a second tab cannot change a decision; decline is recorded", async ({ browser }) => {
  const kid = await child(), guardian = `${unique("parent")}@example.invalid`, kidContext = await signedIn(browser, kid.username);
  await ask(kidContext, { action: "request", guardianEmail: guardian }); const token = await tokenFor(guardian, /approval needed/);
  const first = (await parentPage(browser, token)).page, second = (await parentPage(browser, token)).page;
  await expect(second.getByRole("button", { name: "Approve" })).toBeVisible();
  await first.getByRole("checkbox").check(); await first.getByRole("button", { name: "Decline" }).click(); await expect(first.getByRole("status")).toContainText("decision to decline has been recorded");
  await expect.poll(async () => (await outbox()).some(m => m.to.includes("founder@example.invalid") && /^\[FYI\] ❌ PARENT DECLINED: Niamh$/.test(m.subject))).toBe(true);
  await second.getByRole("checkbox").check(); await second.getByRole("button", { name: "Approve" }).click(); await expect(second.getByRole("status")).toContainText("can no longer be used");
  expect((await approvalOf(kid._id)).status).toBe("declined");
  const reopened = (await parentPage(browser, token)).page; await expect(reopened.getByRole("status")).toContainText("already been used"); await expect(reopened.getByRole("button", { name: "Approve" })).toHaveCount(0);
});
test("an expired link offers only a fresh email to the guardian on record", async ({ browser }) => {
  const kid = await child(), guardian = `${unique("parent")}@example.invalid`, kidContext = await signedIn(browser, kid.username);
  await ask(kidContext, { action: "request", guardianEmail: guardian }); const token = await tokenFor(guardian, /approval needed/);
  await db.collection("accountEmailActions").updateOne({ userId: kid._id, purpose: "parent-request", usedAt: { $exists: false } }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const page = (await parentPage(browser, token)).page;
  await expect(page.getByRole("status")).toContainText("expired"); await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  // Real renewals happen days later; clear this disposable database's one-minute cooldown rather than waiting.
  await db.collection("emailRequestLimits").deleteMany({});
  const before = (await outbox()).filter(m => m.to.includes(guardian)).length;
  await page.getByRole("button", { name: "Email me a new link" }).click(); await expect(page.getByRole("status")).toContainText("If this link can be renewed");
  await expect.poll(async () => (await outbox()).filter(m => m.to.includes(guardian)).length).toBe(before + 1);
  const fresh = await tokenFor(guardian, /approval needed/); expect(fresh).not.toBe(token);
  const renewed = (await parentPage(browser, fresh)).page; await expect(renewed.getByRole("button", { name: "Approve" })).toBeVisible();
});
