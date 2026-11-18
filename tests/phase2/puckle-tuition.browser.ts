import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

// Real Next server, disposable MongoDB, captured mail; phone width and Irish locale (the phone field's default country).
const origin = process.env.PHASE2_BASE_URL!;
let client: MongoClient, db: Db, counter = 0;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); db = client.db(process.env.MONGODB_DB); });
test.afterAll(async () => { await client?.close(); });
const year = new Date().getFullYear();
const unique = (tag: string) => `${tag}${Date.now().toString(36)}${++counter}`;
async function outbox() { return await fetch(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/emails`).then(r => r.json()) as { to: string[]; subject: string; text: string }[]; }
async function waitFor<T>(read: () => Promise<T | null | undefined | false>, wait = 15_000): Promise<T> {
  const deadline = Date.now() + wait;
  while (Date.now() < deadline) { const value = await read(); if (value) return value; await new Promise(r => setTimeout(r, 200)); }
  throw new Error("condition not reached");
}
async function member(options: { dob?: string; category?: "student" | "teacher" } = {}) {
  const _id = new ObjectId(), username = unique("Tut"), email = `${username.toLowerCase()}@example.invalid`, now = new Date();
  await db.collection("users").insertOne({ _id, email, username, passwordHash: await bcrypt.hash("local-test-only", 4), cardsData: [{ keep: 1 }], decksData: [], sharedDeckData: [], permissions: { publicPublishing: false },
    ...(options.dob ? { safeguarding: { dateOfBirth: options.dob, dobSource: "self-declared", dobRecordedAt: now, ageAssurance: { verification: "none" } } } : {}), createdAt: now, updatedAt: now });
  await db.collection("puckleMemberships").insertOne({ userId: _id, name: "Aoife", registrationCategory: options.category ?? "student", mobile: "+353871234567",
    education: { course: "gcse", courseOther: null, level: "higher-tier", levelOther: null }, initialRegistrationSource: "join", welcome: { eligible: false }, createdAt: now, updatedAt: now });
  return { _id, username, email };
}
async function open(browser: Browser, login?: string, path = "/"): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: "en-IE" });
  if (login) expect((await context.request.post(`${origin}/api/auth/login`, { data: { identifier: login, password: "local-test-only" } })).status()).toBe(200);
  const page = await context.newPage(); await page.goto(`${origin}${path}`); return page;
}
const submit = (page: Page) => page.getByRole("button", { name: "Request a free session" });
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
const rows = () => db.collection("puckleTuitionEnquiries");

test("visitors keep the original three-way choice and submit without an account; nothing but the enquiry is created", async ({ browser }) => {
  const page = await open(browser), users = await db.collection("users").countDocuments(), memberships = await db.collection("puckleMemberships").countDocuments();
  await page.locator("#early-access").scrollIntoViewIfNeeded();
  for (const label of ["Student under 18", "Student aged 18 or over", "Parent or guardian"]) await expect(page.getByRole("radio", { name: label })).toBeVisible();
  await page.getByRole("radio", { name: "Parent or guardian" }).check();
  const parent = unique("Parent");
  await page.locator("#enquiry-contactName").fill(parent); await page.locator("#enquiry-studentName").fill("Jamie"); await page.locator("#enquiry-mathsCourse").selectOption("gcse");
  await page.locator("#enquiry-email").fill(`${parent.toLowerCase()}@example.invalid`);
  await expect(page.getByRole("radio", { name: "Email" })).toBeChecked(); await noOverflow(page);
  await submit(page).click();
  await expect(page.getByRole("heading", { name: "Thanks — I’ll be in touch!" })).toBeVisible(); await expect(page.getByText(/arrange your free online session/)).toBeVisible();
  const saved = (await rows().findOne({ contactName: parent }))!; expect(saved).toMatchObject({ enquirerType: "parent-guardian", studentName: "Jamie", contactRelationship: "parent-guardian" }); expect(saved.userId).toBeUndefined();
  expect(await db.collection("users").countDocuments()).toBe(users); expect(await db.collection("puckleMemberships").countDocuments()).toBe(memberships);
  await waitFor(async () => (await rows().findOne({ _id: saved._id }))?.founderNotification?.status === "sent");
  const mail = (await outbox()).filter(m => m.to.includes("founder@example.invalid") && m.text.includes(parent)).at(-1)!; expect(mail.subject).toMatch(/^\[ACTION\] 📩 TUITION ENQUIRY: parent of Jamie, gcse$/);
});
test("adult visitor and validation errors keep what was typed", async ({ browser }) => {
  const page = await open(browser); await page.getByRole("radio", { name: "Student aged 18 or over" }).check();
  await page.locator("#enquiry-contactName").fill("Sam Adult"); await submit(page).click();
  await expect(page.getByText("Please select the maths course.")).toBeVisible(); await expect(page.getByText("Please add an email address or a mobile number.")).toBeVisible();
  await expect(page.locator("#enquiry-contactName")).toHaveValue("Sam Adult");
});
test("a signed-in under-18 skips the selector, is prefilled safely, must give guardian details and is linked to their own account", async ({ browser }) => {
  const student = await member({ dob: `${year - 15}-01-01` }), page = await open(browser, student.username);
  const before = JSON.stringify(await db.collection("users").findOne({ _id: student._id }));
  await expect(page.locator("#enquiry-studentName")).toHaveValue("Aoife"); await expect(page.locator("#enquiry-mathsCourse")).toHaveValue("gcse");
  await expect(page.getByRole("radio", { name: "Parent or guardian" })).toHaveCount(0); await expect(page.getByLabel("Parent or guardian’s name")).toHaveValue("");
  await expect(page.locator("#enquiry-email")).toHaveValue(""); await expect(page.locator("#enquiry-phone")).toHaveValue("+353"); /* blank: only the country prefix */ await expect(page.getByText(/parent or guardian’s contact details/i)).toBeVisible();
  await noOverflow(page);
  await submit(page).click(); await expect(page.getByText("Please enter a parent or guardian’s name.")).toBeVisible(); await expect(page.locator("#enquiry-studentName")).toHaveValue("Aoife");
  const guardian = unique("Guardian"); await page.getByLabel("Parent or guardian’s name").fill(guardian); await page.locator("#enquiry-email").fill(`${guardian.toLowerCase()}@example.invalid`); await submit(page).click();
  await expect(page.getByText(/contact your parent or guardian/)).toBeVisible();
  const saved = (await rows().findOne({ contactName: guardian }))!;
  expect(saved).toMatchObject({ enquirerType: "student-under-18", contactRelationship: "parent-guardian", email: `${guardian.toLowerCase()}@example.invalid`, phone: null });
  expect(saved.userId.equals(student._id)).toBe(true); expect(JSON.stringify(await db.collection("users").findOne({ _id: student._id }))).toBe(before);
  expect(await db.collection("puckleMemberships").countDocuments({ userId: student._id })).toBe(1);
});
test("a forged adult payload from a signed-in under-18 is refused by the backend", async ({ browser }) => {
  const student = await member({ dob: `${year - 16}-06-15` }), page = await open(browser, student.username);
  const forged = await page.request.post("/api/public/puckle/early-access", { data: { enquirerType: "student-adult", contactName: "Me Myself", mathsCourse: "gcse", phone: "+353871234568", preferredContactMethod: "text" } });
  expect(forged.status()).toBe(400); expect((await forged.json()).fieldErrors.studentName).toBeTruthy();
  expect(await rows().findOne({ contactName: "Me Myself" })).toBeNull();
  // The same payload from a visitor without an account keeps its original, valid adult behaviour.
  const visitor = await (await browser.newContext()).request.post(`${origin}/api/public/puckle/early-access`, { data: { enquirerType: "student-adult", contactName: "Plain Adult", mathsCourse: "gcse", phone: "+353871234568", preferredContactMethod: "text" } });
  expect(visitor.status()).toBe(201);
});
test("a signed-in adult student gets editable prefill and a linked enquiry", async ({ browser }) => {
  const student = await member({ dob: `${year - 30}-02-02` }), page = await open(browser, student.username);
  await expect(page.getByRole("radio", { name: "Student under 18" })).toHaveCount(0);
  await expect(page.locator("#enquiry-contactName")).toHaveValue("Aoife"); await expect(page.locator("#enquiry-email")).toHaveValue(student.email); await expect(page.locator("#enquiry-phone")).toHaveValue(/^\+353 ?87 ?123 ?4567$/);
  const edited = `edited-${student.username.toLowerCase()}@example.invalid`; await page.locator("#enquiry-email").fill(edited);
  await page.getByRole("radio", { name: "Email" }).check(); await submit(page).click();
  await expect(page.getByText(/contact you using your preferred method/)).toBeVisible();
  const saved = (await rows().findOne({ email: edited }))!; expect(saved).toMatchObject({ enquirerType: "student-adult", contactRelationship: "self" }); expect(saved.userId.equals(student._id)).toBe(true);
  expect((await db.collection("users").findOne({ _id: student._id }))!.email).toBe(student.email);
});
test("unknown DOB and teachers keep the original flow; a failing context request never enables a bypass", async ({ browser }) => {
  for (const person of [await member({}), await member({ dob: "1990-01-01", category: "teacher" })]) {
    const page = await open(browser, person.username); await expect(page.getByRole("radio", { name: "Student aged 18 or over" })).toBeVisible(); await expect(page.locator("#enquiry-contactName")).toHaveCount(0);
  }
  const adult = await member({ dob: "1990-01-01" }), context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-IE" });
  await context.request.post(`${origin}/api/auth/login`, { data: { identifier: adult.username, password: "local-test-only" } });
  const page = await context.newPage(); await page.route("**/api/public/puckle/tuition-context", route => route.fulfill({ status: 503, body: "{}" })); await page.goto(`${origin}/`);
  await expect(page.getByRole("radio", { name: "Student aged 18 or over" })).toBeVisible();
});
test("the context endpoint is private, Puckle-only and never reveals the date of birth", async ({ browser, playwright }) => {
  const student = await member({ dob: `${year - 15}-03-03` }), page = await open(browser, student.username);
  const response = await page.request.get("/api/public/puckle/tuition-context"); const text = await response.text();
  expect(response.headers()["cache-control"]).toContain("no-store"); expect(JSON.parse(text).mode).toBe("student-under-18"); expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}|example\.invalid|\+353/);
  const anonymous = await playwright.request.newContext({ baseURL: origin }); expect(await (await anonymous.get("/api/public/puckle/tuition-context")).json()).toEqual({ mode: "unknown" });
  for (const site of ["switchplay", "strat17"]) {
    const other = await browser.newContext({ storageState: { cookies: [{ name: "site", value: site, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
    await other.request.post(`${origin}/api/auth/login`, { data: { identifier: student.username, password: "local-test-only" } });
    expect((await other.request.get(`${origin}/api/public/puckle/tuition-context`)).status()).toBe(404);
    const home = await (await other.newPage()).goto(`${origin}/`); expect(home!.status()).toBe(200);
  }
});
