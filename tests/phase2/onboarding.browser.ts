import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

// Real Next server, disposable MongoDB, captured mail, phone width. The application subtree is never modified.
const origin = process.env.PHASE2_BASE_URL!;
let client: MongoClient, db: Db, counter = 0;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); db = client.db(process.env.MONGODB_DB); });
test.afterAll(async () => { await client?.close(); });
const year = new Date().getFullYear();
const unique = (tag: string) => `${tag}${Date.now().toString(36)}${++counter}`;
async function outbox() { return await fetch(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/emails`).then(r => r.json()) as { to: string[]; subject: string; text: string }[]; }
async function account(options: { dob?: string | null; category?: "student" | "teacher"; eligible?: boolean; approval?: Record<string, unknown> } = {}) {
  const _id = new ObjectId(), username = unique("Onb"), now = new Date();
  const dob = options.dob === undefined ? `${year - 17}-03-03` : options.dob;
  await db.collection("users").insertOne({ _id, email: `${username.toLowerCase()}@example.invalid`, username, passwordHash: await bcrypt.hash("local-test-only", 4), cardsData: [], decksData: [], sharedDeckData: [], permissions: { publicPublishing: false },
    safeguarding: { ...(dob ? { dateOfBirth: dob, dobSource: "self-declared", dobRecordedAt: now, ageAssurance: { verification: "none" } } : {}), ...(options.approval ? { groupExperienceApproval: { scopeId: "shared-group-experiences", generation: 1, explanation: { version: "v", text: "t" }, history: [], ...options.approval } } : {}) }, createdAt: now, updatedAt: now });
  await db.collection("puckleMemberships").insertOne({ userId: _id, name: "Niamh", registrationCategory: options.category ?? "student", mobile: null, initialRegistrationSource: "join", welcome: { eligible: options.eligible ?? true }, createdAt: now, updatedAt: now });
  return { _id, username };
}
const young = () => account({ dob: `${year - 14}-01-01` });
async function context(browser: Browser, login?: string, site = "puckle") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, extraHTTPHeaders: { "x-forwarded-for": `10.6.${counter % 250}.${Math.floor(Math.random() * 250)}` },
    storageState: { cookies: [{ name: "site", value: site, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
  if (login) expect((await ctx.request.post(`${origin}/api/auth/login`, { data: { identifier: login, password: "local-test-only" } })).status()).toBe(200);
  return ctx;
}
async function open(browser: Browser, login: string, path = "/decks") { const ctx = await context(browser, login); const page = await ctx.newPage(); await page.goto(`${origin}${path}`); return { ctx, page }; }
const welcome = (page: Page) => page.locator('[data-onboarding="welcome"]');
const reminder = (page: Page) => page.locator('[data-onboarding="reminder"]');
const pill = (page: Page) => page.locator('[data-onboarding="pill"]');
const host = (page: Page) => page.locator("[data-onboarding-host]");
const seenAt = async (id: ObjectId) => (await db.collection("puckleMemberships").findOne({ userId: id }))!.welcome.seenAt;
const refocus = async (page: Page) => { await page.waitForTimeout(500); /* past the focus-refresh coalescing window */ await page.evaluate(() => { window.dispatchEvent(new Event("blur")); window.dispatchEvent(new Event("focus")); }); };
const fits = async (page: Page, locator: ReturnType<typeof welcome>) => { const box = (await locator.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390.5); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(844.5); };
async function appRoot(page: Page) { return page.evaluateHandle(() => { const el = [...document.body.children].find(child => !child.hasAttribute("data-onboarding-host") && child.tagName !== "SCRIPT" && child.tagName !== "NEXT-ROUTE-ANNOUNCER" && child.id !== "__next-route-announcer__" && !child.hasAttribute("data-nextjs-toast"))!; el.setAttribute("data-probe", "1"); return el; }); }

test("a new adult student sees the welcome once: two actions, acknowledged after presentation, never repeated", async ({ browser }) => {
  const student = await account(), { page } = await open(browser, student.username);
  await expect(welcome(page)).toBeVisible(); await expect(welcome(page).getByRole("button", { name: "Request a free session" })).toBeVisible(); await expect(welcome(page).getByRole("button", { name: "Explore Puckle" })).toBeVisible();
  await expect(page.getByLabel("Parent or guardian's email")).toHaveCount(0); await fits(page, welcome(page));
  await expect.poll(() => seenAt(student._id)).toBeTruthy();
  const tuition = await db.collection("puckleTuitionEnquiries").countDocuments(); await welcome(page).getByRole("button", { name: "Explore Puckle" }).click(); await expect(welcome(page)).toHaveCount(0);
  expect(await db.collection("puckleTuitionEnquiries").countDocuments()).toBe(tuition); // showing or dismissing creates no enquiry
  await page.reload(); await expect(page.getByRole("heading", { name: /My Decks|Library/i }).or(page.locator("main")).first()).toBeVisible(); await page.waitForTimeout(1500); await expect(host(page).locator("section")).toHaveCount(0);
});
test("Request a free session leaves for the existing tuition form without booking anything", async ({ browser }) => {
  const student = await account(), { page } = await open(browser, student.username); const before = await db.collection("puckleTuitionEnquiries").countDocuments();
  await welcome(page).getByRole("button", { name: "Request a free session" }).click(); await page.waitForURL(`${origin}/#early-access`);
  expect(await db.collection("puckleTuitionEnquiries").countDocuments()).toBe(before); await expect(page.locator("#early-access")).toBeVisible();
});
test("teachers, backfilled accounts and other websites get no welcome; excluded and public routes have no onboarding at all", async ({ browser }) => {
  for (const person of [await account({ category: "teacher", eligible: false }), await account({ eligible: false })]) { const { page } = await open(browser, person.username); await page.waitForTimeout(1500); await expect(host(page).locator("section")).toHaveCount(0); }
  const student = await account(), ctx = await context(browser, student.username, "switchplay"), other = await ctx.newPage(); await other.goto(`${origin}/decks`); await other.waitForTimeout(1500); await expect(host(other).locator("section")).toHaveCount(0);
  expect(await seenAt(student._id)).toBeUndefined();
  const { page } = await open(browser, (await account()).username, "/");
  for (const path of ["/", "/progress"]) { await page.goto(`${origin}${path}`); await page.waitForTimeout(800); if (!["/decks", "/library"].includes(new URL(page.url()).pathname)) await expect(host(page)).toHaveCount(0); }
  const visitor = await (await context(browser)).newPage(); await visitor.goto(`${origin}/login`); await visitor.waitForTimeout(800); await expect(host(visitor)).toHaveCount(0);
});
test("the server renders nothing for onboarding (no SSR output, no new server-side dependency)", async ({ browser }) => {
  const student = await account(), ctx = await context(browser, student.username); const html = await (await ctx.request.get(`${origin}/decks`)).text();
  expect(html).not.toContain("data-onboarding-host"); expect(html).not.toContain("Welcome to Puckle");
});
test("under-16 first welcome: optional guardian email sends the real request; status, delivery and re-entry are truthful", async ({ browser }) => {
  const kid = await young(), { page } = await open(browser, kid.username), guardian = `${unique("mum")}@example.invalid`;
  await expect(welcome(page).getByText(/under 16/)).toBeVisible(); await expect(welcome(page).getByRole("button", { name: "Explore Puckle" })).toBeVisible(); await fits(page, welcome(page));
  const send = welcome(page).getByRole("button", { name: "Send approval request" }); await expect(send).toBeDisabled();
  await page.getByLabel("Parent or guardian's email").fill(guardian); await send.click();
  await expect(welcome(page).getByText(/emailed your parent or guardian/)).toBeVisible();
  const record = (await db.collection("users").findOne({ _id: kid._id }))!.safeguarding.groupExperienceApproval; expect(record).toMatchObject({ status: "pending", scopeId: "shared-group-experiences" }); expect(record.guardianEmail).toBe(guardian);
  expect((await outbox()).some(m => m.to.includes(guardian) && /approval needed/.test(m.subject))).toBe(true);
  await welcome(page).getByRole("button", { name: "Explore Puckle" }).click();
  await page.goto(`${origin}/library`); await expect(reminder(page)).toBeVisible(); await expect(reminder(page).getByText(/Sent to m/)).toBeVisible(); await expect(welcome(page)).toHaveCount(0);
  await expect(reminder(page).getByRole("button", { name: "Send it again" })).toBeDisabled(); await fits(page, reminder(page));
  await reminder(page).getByRole("button", { name: "Dismiss" }).click(); await expect(reminder(page)).toHaveCount(0);
  await refocus(page); await page.waitForTimeout(800); await expect(reminder(page)).toHaveCount(0); // quiet refresh never reopens it
});
test("under-16 welcome: the parent's mobile is optional; a parent with no email gets a personal-contact request, the founder is alerted, nothing is approved", async ({ browser }) => {
  const kid = await young(), { page } = await open(browser, kid.username); await expect(welcome(page)).toBeVisible();
  const send = welcome(page).getByRole("button", { name: "Send approval request" });
  await expect(page.getByLabel("Parent or guardian's mobile (optional)")).toBeVisible(); await expect(welcome(page).getByText(/don't use email/)).toBeVisible(); await expect(send).toBeDisabled(); await fits(page, welcome(page));
  await page.getByLabel("Parent or guardian's mobile (optional)").fill("+353 87 111 2222"); await expect(send).toBeEnabled(); await send.click();
  await expect(welcome(page).getByText(/passed your parent or guardian's number/)).toBeVisible();
  expect((await db.collection("users").findOne({ _id: kid._id }))!.safeguarding.groupExperienceApproval).toBeUndefined();
  const row = (await db.collection("puckleJoinContactRequests").findOne({ studentUserId: kid._id }))!; expect(row).toMatchObject({ kind: "guardian-approval-contact-request", guardianMobile: "+353871112222" });
  await expect.poll(async () => (await outbox()).some(m => m.to.includes("founder@example.invalid") && m.text.includes("+353871112222"))).toBe(true);
  const mail = (await outbox()).find(m => m.to.includes("founder@example.invalid") && m.text.includes("+353871112222"))!;
  expect(mail.subject).toMatch(/^\[ACTION\] 📞 PARENT HAS NO EMAIL, PLEASE CALL: Niamh$/);
  await page.getByLabel("Parent or guardian's mobile (optional)").fill("not a number"); await send.click(); await expect(welcome(page).getByRole("alert")).toContainText("valid mobile number");
});
test("private learning stays available: skipping the guardian step changes nothing", async ({ browser }) => {
  const kid = await young(), { page } = await open(browser, kid.username); await expect(welcome(page)).toBeVisible();
  await welcome(page).getByRole("button", { name: "Explore Puckle" }).click();
  expect((await db.collection("users").findOne({ _id: kid._id }))!.safeguarding.groupExperienceApproval).toBeUndefined();
  expect(await page.evaluate(async () => (await fetch("/api/auth/me")).status)).toBe(200); await expect(page.locator("main").first()).toBeVisible();
});
test("approved hides reminders; declined and withdrawn are truthful with an explicit ask-again; 16 and unknown DOB show nothing", async ({ browser }) => {
  const cases: [Awaited<ReturnType<typeof account>>, RegExp | null][] = [
    [await account({ dob: `${year - 14}-01-01`, eligible: false, approval: { status: "approved", guardianEmail: "g@example.invalid" } }), null],
    [await account({ dob: `${year - 14}-01-01`, eligible: false, approval: { status: "declined", guardianEmail: "g@example.invalid" } }), /declined/],
    [await account({ dob: `${year - 14}-01-01`, eligible: false, approval: { status: "withdrawn", guardianEmail: "g@example.invalid" } }), /withdrew/],
    [await account({ dob: `${year - 16}-01-01`, eligible: false }), null], [await account({ dob: null, eligible: false }), null],
  ];
  for (const [person, text] of cases) {
    const { page } = await open(browser, person.username, "/library");
    if (text) { await expect(reminder(page).getByText(text)).toBeVisible(); await expect(reminder(page).getByRole("button", { name: "Ask again" })).toBeVisible(); }
    else { await page.waitForTimeout(1500); await expect(host(page).locator("section")).toHaveCount(0); }
  }
});
test("the application subtree is untouched: same nodes, zero DOM mutations during every onboarding interaction", async ({ browser }) => {
  const kid = await young(), { page } = await open(browser, kid.username); await expect(welcome(page)).toBeVisible();
  const app = await appRoot(page);
  await page.evaluate(el => { (window as unknown as { __mutations: number }).__mutations = 0; new MutationObserver(records => { (window as unknown as { __mutations: number }).__mutations += records.length; }).observe(el as Element, { subtree: true, childList: true, attributes: true, characterData: true }); }, app);
  await page.getByLabel("Parent or guardian's email").fill(`${unique("p")}@example.invalid`); await refocus(page);
  await welcome(page).getByRole("button", { name: "Send approval request" }).click(); await expect(welcome(page).getByText(/emailed|saved/)).toBeVisible();
  await welcome(page).getByRole("button", { name: "Explore Puckle" }).click(); await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __mutations: number }).__mutations)).toBe(0);
  expect(await app.evaluate(el => (el as Element).getAttribute("data-probe"))).toBe("1");
});
test("an expanded Deck introduction or a modal dialog hides onboarding; it returns when they close", async ({ browser }) => {
  const student = await account(), { page } = await open(browser, student.username); await expect(welcome(page)).toBeVisible();
  for (const markup of ['<div class="deck-grid-intro-host deck-grid-intro-host--expanded" id="probe"></div>', '<div class="deck-intro-viewer-host deck-intro-viewer-host--expanded" id="probe"></div>', '<div role="dialog" aria-modal="true" id="probe"></div>']) {
    await page.evaluate(html => document.body.insertAdjacentHTML("beforeend", html), markup); await refocus(page); await expect(welcome(page)).toHaveCount(0);
    await page.evaluate(() => document.getElementById("probe")!.remove()); await refocus(page); await expect(welcome(page)).toBeVisible();
  }
});
test("guardian draft survives blur and app switching; account change or sign-out clears it; uncertain network never shows it", async ({ browser }) => {
  const kid = await young(), other = await young(), { ctx, page } = await open(browser, kid.username); await expect(welcome(page)).toBeVisible();
  const input = page.getByLabel("Parent or guardian's email"); await input.fill("half.typed@exam");
  await refocus(page); await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(input).toHaveValue("half.typed@exam");
  await page.route("**/api/account/onboarding", route => route.abort()); await refocus(page); await expect(welcome(page)).toHaveCount(0); // network uncertainty: hidden, not exposed
  await page.unroute("**/api/account/onboarding"); await refocus(page); await expect(input).toHaveValue("half.typed@exam"); // same actor: restored
  await ctx.request.post(`${origin}/api/auth/login`, { data: { identifier: other.username, password: "local-test-only" } }); await refocus(page);
  await expect(page.getByLabel("Parent or guardian's email")).toHaveValue(""); // different actor: cleared
  await page.getByLabel("Parent or guardian's email").fill("second@example.invalid"); await ctx.request.post(`${origin}/api/auth/logout`); await refocus(page);
  await expect(welcome(page)).toHaveCount(0); expect(await page.locator("body").innerText()).not.toContain("second@example.invalid");
});
test("embedded sign-in and sign-out on the same URL start and end onboarding without a reload; late old responses never render for the new account", async ({ browser }) => {
  const student = await account(), ctx = await context(browser), page = await ctx.newPage(); await page.goto(`${origin}/decks`);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible(); await page.waitForTimeout(600); await expect(host(page).locator("section")).toHaveCount(0);
  await page.getByLabel("Username or email").fill(student.username); await page.getByLabel("Password").fill("local-test-only"); await page.getByRole("button", { name: "Sign in" }).click();
  await expect(welcome(page)).toBeVisible();
  // A slow response for the first account arrives after a different, welcome-less account has signed in.
  const kid = await young(), teacher = await account({ category: "teacher", eligible: false });
  const second = await context(browser, kid.username), slow = await second.newPage(); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await slow.route("**/api/account/onboarding", async route => { if (route.request().method() !== "GET") return route.continue(); const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  await slow.goto(`${origin}/decks`); await slow.waitForTimeout(500);
  await second.request.post(`${origin}/api/auth/login`, { data: { identifier: teacher.username, password: "local-test-only" } });
  await slow.evaluate(() => window.dispatchEvent(new CustomEvent("switchplay:auth-changed"))); release(); await slow.waitForTimeout(1200);
  await expect(host(slow).locator("section")).toHaveCount(0); await expect(slow.getByLabel("Parent or guardian's email")).toHaveCount(0);
});
test("a slow connection still welcomes an idle student after two seconds; early outside interaction collapses it without acknowledging", async ({ browser }) => {
  const idle = await account(), a = { page: await (await context(browser, idle.username)).newPage() };
  await a.page.route("**/api/account/onboarding", async route => { if (route.request().method() !== "GET") return route.continue(); await new Promise(r => setTimeout(r, 2500)); await route.continue(); });
  await a.page.goto(`${origin}/library`); await expect(welcome(a.page)).toBeVisible({ timeout: 10_000 });
  const busy = await account(), b = { page: await (await context(browser, busy.username)).newPage() };
  await b.page.route("**/api/account/onboarding", async route => { if (route.request().method() !== "GET") return route.continue(); await new Promise(r => setTimeout(r, 2500)); await route.continue(); });
  await b.page.goto(`${origin}/library`); await expect(host(b.page)).toBeAttached(); await b.page.mouse.click(180, 400);
  await expect(pill(b.page)).toBeVisible({ timeout: 10_000 }); await expect(welcome(b.page)).toHaveCount(0); expect(await seenAt(busy._id)).toBeUndefined();
  await pill(b.page).click(); await expect(welcome(b.page)).toBeVisible(); await expect.poll(() => seenAt(busy._id)).toBeTruthy();
});
test("a failing status endpoint or acknowledgement never affects the application", async ({ browser }) => {
  const student = await account(), ctx = await context(browser, student.username), page = await ctx.newPage();
  await page.route("**/api/account/onboarding", route => route.fulfill({ status: 500, body: "{}" })); await page.goto(`${origin}/decks`); await page.waitForTimeout(1500);
  await expect(host(page).locator("section")).toHaveCount(0); await expect(page.locator("main").first()).toBeVisible(); expect(await seenAt(student._id)).toBeUndefined();
  const other = await account(), second = await context(browser, other.username), p2 = await second.newPage();
  await p2.route("**/api/account/onboarding", route => (route.request().method() === "POST" ? route.abort() : route.continue())); await p2.goto(`${origin}/decks`);
  await expect(welcome(p2)).toBeVisible(); await p2.reload(); await expect(welcome(p2)).toBeVisible(); // not acknowledged: may show again, never traps the learner
  await welcome(p2).getByRole("button", { name: "Explore Puckle" }).click(); await expect(p2.locator("main").first()).toBeVisible();
});
