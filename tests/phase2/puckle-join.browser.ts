import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent } from "../../src/lib/cards/creatorDefaults";

// Real Next server + disposable MongoDB + captured email. Phone-width viewport throughout.
const origin = process.env.PHASE2_BASE_URL!;
let client: MongoClient, db: Db, counter = 0;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); db = client.db(process.env.MONGODB_DB); });
test.afterAll(async () => { await client?.close(); });
const unique = (tag: string) => `${tag}${Date.now().toString(36)}${++counter}`;
const emailOf = (tag: string) => `${unique(tag)}@example.invalid`;
const thisYear = new Date().getFullYear();
async function outbox() { return await fetch(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/emails`).then(r => r.json()) as { to: string[]; subject: string; text: string }[]; }
async function mailTo(address: string, pattern: RegExp, wait = 15_000) {
  const deadline = Date.now() + wait;
  while (Date.now() < deadline) { const found = (await outbox()).filter(m => m.to.includes(address) && pattern.test(m.text)); if (found.length) return found.at(-1)!; await new Promise(r => setTimeout(r, 200)); }
  throw new Error("expected email did not arrive");
}
const codeFor = async (address: string) => (await mailTo(address, /\b\d{6}\b/)).text.match(/\b\d{6}\b/)![0];
/** Each test is its own requester, so the shared rate-limit buckets never couple unrelated tests. */
async function open(browser: Browser, path = "/join") {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: "en-IE", // the phone field defaults its country from the browser locale
     extraHTTPHeaders: { "x-forwarded-for": `10.9.${counter % 250}.${Math.floor(Math.random() * 250)}` } });
  const page = await context.newPage(); await page.goto(`${origin}${path}`); return page;
}
const choose = (page: Page, label: string) => page.getByRole("radio", { name: label }).check();
async function fillStudent(page: Page, v: { name?: string; username: string; email: string; password?: string; day?: string; month?: string; year?: string; course?: string; level?: string }) {
  await page.getByLabel("First name").fill(v.name ?? "Ada"); await page.getByLabel("Email", { exact: true }).fill(v.email);
  await page.getByLabel("Choose a username").fill(v.username); await page.getByLabel("Choose a password").fill(v.password ?? "a perfectly good passphrase");
  await page.locator("#join-dobDay").fill(v.day ?? "14"); await page.locator("#join-dobMonth").fill(v.month ?? "6"); await page.locator("#join-dobYear").fill(v.year ?? String(thisYear - 17));
  await page.locator("#join-course").selectOption(v.course ?? "gcse");
  if ((v.course ?? "gcse") !== "a-level") await page.locator("#join-level").selectOption(v.level ?? "higher-tier");
}
const submit = (page: Page) => page.locator("button[type=submit]");
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
async function waitFor<T>(read: () => Promise<T | null | undefined>, wait = 15_000): Promise<T> {
  const deadline = Date.now() + wait;
  while (Date.now() < deadline) { const value = await read(); if (value) return value; await new Promise(r => setTimeout(r, 200)); }
  throw new Error("condition not reached");
}

test("Join opens directly with Student selected, mobile and the no-email route on every choice, and fits a phone", async ({ browser }) => {
  const home = await open(browser, "/");
  await expect(home.getByRole("link", { name: "Join" }).first()).toHaveAttribute("href", "/join");
  const page = await open(browser);
  await expect(page.getByRole("heading", { name: "Join Puckle." })).toBeVisible();
  await expect(page.getByRole("radio", { name: "I'm here to learn" })).toBeChecked();
  for (const label of ["I'm here to learn", "I'm a teacher", "I'm interested in Puckle"]) {
    await choose(page, label);
    await expect(page.locator("#join-phone")).toBeVisible(); await expect(page.getByRole("button", { name: "Don't have an email address?" })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: false }).first()).toBeVisible(); await noOverflow(page);
  }
  expect(new URL(page.url()).pathname).toBe("/join");
  await expect(page.getByRole("link", { name: "Request a free session" })).toHaveAttribute("href", "/#early-access");
  await choose(page, "I'm a teacher"); await expect(page.getByText("Tell us a little about yourself and how you'd like to use Puckle.")).toBeVisible();
});
test("choices keep what was typed, validation keeps it too, and errors appear on the right fields", async ({ browser }) => {
  const page = await open(browser);
  await page.getByLabel("First name").fill("Ada"); await page.getByLabel("Email", { exact: true }).fill("ada@example.invalid");
  await submit(page).click();
  for (const message of ["Choose a username of 3–30", "Use at least 12 characters", "Enter your date of birth.", "Choose your maths course."]) await expect(page.getByText(message).first()).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveValue("Ada"); await expect(page.getByLabel("Email", { exact: true })).toHaveValue("ada@example.invalid");
  await expect(page.locator("#join-username")).toBeFocused();
  await choose(page, "I'm a teacher"); await expect(page.getByLabel("Your name")).toHaveValue("Ada"); await expect(page.getByLabel("Email", { exact: true })).toHaveValue("ada@example.invalid");
  await choose(page, "I'm here to learn"); await expect(page.getByLabel("First name")).toHaveValue("Ada");
  await page.locator("#join-dobDay").fill("1"); await page.locator("#join-dobMonth").fill("1"); await page.locator("#join-dobYear").fill(String(thisYear - 12));
  await page.getByLabel("Choose a username").fill("ada_l"); await page.getByLabel("Choose a password").fill("short");
  await page.locator("#join-course").selectOption("leaving-cert"); await submit(page).click();
  await expect(page.getByText("You need to be at least 13 to join Puckle.")).toBeVisible(); await expect(page.getByText("Use at least 12 characters")).toBeVisible(); await expect(page.getByText("Choose your level.")).toBeVisible();
  await page.getByRole("checkbox", { name: "Show password" }).check(); await expect(page.locator("#join-password")).toHaveAttribute("type", "text");
  await noOverflow(page);
  expect((await outbox()).some(m => m.to.includes("ada@example.invalid"))).toBe(false);
});
test("course and level behave as specified, including A-level disabling and clearing level", async ({ browser }) => {
  const page = await open(browser); const level = page.locator("#join-level"), course = page.locator("#join-course");
  await expect(level).toHaveCount(0);
  await course.selectOption("gcse"); await expect(level).toBeEnabled(); expect(await level.locator("option").allTextContents()).toEqual(["Choose your level", "Higher tier", "Foundation tier", "Other", "Don't know"]);
  await level.selectOption("other"); await page.getByLabel("Which level?").fill("Cambridge"); await course.selectOption("a-level");
  await expect(level).toHaveCount(0); await expect(page.getByText("Level", { exact: true })).toHaveCount(0); await expect(page.getByLabel("Which level?")).toHaveCount(0);
  await course.selectOption("leaving-cert"); await expect(level).toBeEnabled(); await expect(level).toHaveValue(""); expect(await level.locator("option").allTextContents()).toEqual(["Choose your level", "Higher", "Ordinary", "Foundation", "Other", "Don't know"]);
  await course.selectOption("other"); await expect(page.getByLabel("Which course?")).toBeVisible(); expect(await level.locator("option").allTextContents()).toEqual(["Choose your level", "Other", "Don't know"]);
  await course.selectOption("dont-know"); await expect(page.getByLabel("Which course?")).toHaveCount(0); expect(await level.locator("option").allTextContents()).toEqual(["Choose your level", "Other", "Don't know"]);
});
test("student: verify email, account is created, session starts and the Library opens (My Decks is empty); private learning works and public publishing stays forbidden", async ({ browser }) => {
  const page = await open(browser), email = emailOf("student"), username = unique("Stu");
  const usersBefore = await db.collection("users").countDocuments();
  await fillStudent(page, { username, email });
  await expect(submit(page)).toHaveText("Email me a verification code"); await submit(page).click();
  await expect(page.getByText(email)).toBeVisible(); await expect(submit(page)).toHaveText("Verify and create my account");
  expect(await db.collection("users").countDocuments()).toBe(usersBefore); expect(await db.collection("users").findOne({ email })).toBeNull();
  const code = await codeFor(email), wrong = code === "000000" ? "000001" : "000000";
  await page.locator("#join-code").fill(wrong); await submit(page).click();
  await expect(page.getByText("That code isn't right, or it has expired.")).toBeVisible(); expect(await db.collection("users").findOne({ email })).toBeNull();
  await noOverflow(page);
  await page.locator("#join-code").fill(code); await submit(page).click();
  await page.waitForURL(`${origin}/library`);
  const session = (await page.context().cookies()).find(c => c.name === "switchplay_session"); expect(session?.httpOnly).toBe(true);
  const me = await page.request.get("/api/auth/me"); expect(me.status()).toBe(200); expect((await me.json()).user.username).toBe(username);
  const user = (await db.collection("users").findOne({ email }))!;
  expect([user.cardsData, user.decksData, user.permissions, user.isAdmin]).toEqual([[], [], { publicPublishing: false }, false]);
  expect(user.safeguarding).toMatchObject({ dateOfBirth: `${thisYear - 17}-06-14`, dobSource: "self-declared", ageAssurance: { verification: "none" } });
  const membership = (await db.collection("puckleMemberships").findOne({ userId: user._id }))!; expect(membership).toMatchObject({ registrationCategory: "student", name: "Ada", mobile: null, welcome: { eligible: true } });
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
  // Immediate personal learning, no NEW_MODEL_USER_REQUIRED and no second login.
  const actor = user._id.toHexString(), main = new CardRepository(db, client);
  const content = () => ({ ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: "My first card", description: null, mediaItem: null } });
  const privateCard = await main.createCardDraft(actor, content(), "private"), publicCard = await main.createCardDraft(actor, content(), "public");
  expect((await page.request.patch(`/api/card-templates/${privateCard.cardTemplateId}`, { data: { type: "publish", revision: 0 } })).status()).toBe(200);
  const denied = await page.request.patch(`/api/card-templates/${publicCard.cardTemplateId}`, { data: { type: "publish", revision: 0 } });
  expect(denied.status()).toBe(403); expect((await denied.json()).code).toBe("PUBLIC_PUBLISHING_FORBIDDEN");
  expect((await page.request.get("/api/auth/me")).status()).toBe(200);
  // The same credentials then work through the unchanged login route, by username and by email.
  await page.request.post("/api/auth/logout"); expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  for (const identifier of [username, email.toUpperCase()]) {
    const login = await page.request.post("/api/auth/login", { data: { identifier, password: "a perfectly good passphrase" } }); expect(login.status()).toBe(200);
    expect(Object.keys((await login.json()).user).sort()).toEqual(["createdAt", "email", "id", "isAdmin", "updatedAt", "username"]);
    await page.request.post("/api/auth/logout");
  }
});
test("a taken username is flagged on its field, everything else is kept, and the same verified email completes without a new code", async ({ browser }) => {
  await db.collection("users").insertOne({ _id: new ObjectId(), email: emailOf("owner"), username: "Taken_One", passwordHash: await bcrypt.hash("x", 4), cardsData: [], decksData: [], createdAt: new Date(), updatedAt: new Date() });
  const page = await open(browser), email = emailOf("conflict");
  await fillStudent(page, { username: "Taken_One", email, name: "Nia" }); await submit(page).click();
  await page.locator("#join-code").fill(await codeFor(email)); await submit(page).click();
  await expect(page.getByText("That username is already taken.")).toBeVisible(); await expect(page.locator("#join-username")).toBeFocused();
  await expect(page.getByLabel("First name")).toHaveValue("Nia"); await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email); await expect(page.locator("#join-course")).toHaveValue("gcse");
  await expect(page.locator("#join-dobYear")).toHaveValue(String(thisYear - 17)); await expect(page.getByLabel("Choose a password")).toHaveValue("a perfectly good passphrase");
  expect(await db.collection("users").findOne({ email })).toBeNull();
  await expect(submit(page)).toHaveText("Create my account");
  await page.getByLabel("Choose a username").fill("taken_one"); await submit(page).click(); await page.waitForURL(`${origin}/library`);
  expect((await outbox()).filter(m => m.to.includes(email)).length).toBe(1);
  expect(await db.collection("users").findOne({ email })).toMatchObject({ username: "taken_one" });
});
test("A-level registers with level stored as null; a 15-year-old sees the private-learning wording and is allowed in", async ({ browser }) => {
  const page = await open(browser), email = emailOf("alevel"), username = unique("Alv");
  await fillStudent(page, { username, email, course: "a-level", day: "1", month: "1", year: String(thisYear - 14) });
  await expect(page.getByText("You're good to go! You can start learning privately on Puckle now. Some group features will need a parent or guardian's approval.")).toBeVisible();
  await submit(page).click(); await page.locator("#join-code").fill(await codeFor(email)); await submit(page).click(); await page.waitForURL(`${origin}/library`);
  const user = (await db.collection("users").findOne({ email }))!;
  expect((await db.collection("puckleMemberships").findOne({ userId: user._id }))!.education).toEqual({ course: "a-level", courseOther: null, level: null, levelOther: null });
  expect(user.safeguarding.dateOfBirth).toBe(`${thisYear - 14}-01-01`);
  expect(user.safeguarding.groupExperienceApproval).toBeUndefined(); // allowed in without any approval; the Library then offers the optional parent request
});
test("teacher: blank introduction is fine, ordinary rights only, confirmation and a founder alert; no DOB asked", async ({ browser }) => {
  const page = await open(browser), email = emailOf("teacher"), username = unique("Tea");
  await choose(page, "I'm a teacher");
  await expect(page.locator("#join-dobDay")).toHaveCount(0); await expect(page.locator("#join-course")).toHaveCount(0);
  await page.getByLabel("Your name").fill("Mr Byrne"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Choose a username").fill(username); await page.getByLabel("Choose a password").fill("another good passphrase");
  await submit(page).click(); await page.locator("#join-code").fill(await codeFor(email)); await submit(page).click();
  await expect(page.getByRole("heading", { name: "Thanks, you're in!" })).toBeVisible(); await expect(page.getByText("will be in touch personally")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/join"); await noOverflow(page);
  expect((await page.request.get("/api/auth/me")).status()).toBe(200);
  const user = (await db.collection("users").findOne({ email }))!; expect(user.permissions).toEqual({ publicPublishing: false }); expect(user.isAdmin).toBe(false); expect(user.safeguarding).toBeUndefined();
  const membership = (await db.collection("puckleMemberships").findOne({ userId: user._id }))!; expect(membership).toMatchObject({ registrationCategory: "teacher", welcome: { eligible: false } });
  expect(membership.teacherIntroduction).toBeUndefined();
  await waitFor(async () => (await db.collection("puckleMemberships").findOne({ _id: membership._id }))?.founderNotification?.status === "sent");
  expect((await mailTo("founder@example.invalid", new RegExp(email))).subject).toMatch(/^\[ACTION\] 🍎 NEW TEACHER: /);
  await page.getByRole("link", { name: "Open Puckle" }).click(); await page.waitForURL(`${origin}/library`);
});
test("no-email student and teacher: credentials are cleared and hidden, mobile is required, a contact request is saved and no account exists", async ({ browser }) => {
  const page = await open(browser), name = unique("Nomail"), before = await db.collection("users").countDocuments();
  await page.getByLabel("First name").fill(name); await page.getByLabel("Email", { exact: true }).fill("typed@example.invalid"); await page.getByLabel("Choose a username").fill("typed_name"); await page.getByLabel("Choose a password").fill("typed password long");
  await page.getByRole("button", { name: "Don't have an email address?" }).click();
  for (const hidden of ["Email", "Choose a username", "Choose a password"]) await expect(page.getByLabel(hidden, { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("submission-notice")).toContainText("No account will be created"); await expect(submit(page)).toHaveText("Send my details"); await noOverflow(page);
  await page.getByRole("button", { name: "I do have an email address" }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(""); await expect(page.getByLabel("Choose a username")).toHaveValue(""); await expect(page.getByLabel("Choose a password")).toHaveValue("");
  await page.getByRole("button", { name: "Don't have an email address?" }).click();
  await page.locator("#join-dobDay").fill("3"); await page.locator("#join-dobMonth").fill("3"); await page.locator("#join-dobYear").fill(String(thisYear - 16)); await page.locator("#join-course").selectOption("a-level");
  await submit(page).click(); await expect(page.getByText("Enter a mobile number so we can contact you.")).toBeVisible(); await expect(page.locator("#join-phone")).toBeFocused();
  await page.locator("#join-phone").fill("871234567"); await submit(page).click();
  await expect(page.getByRole("heading", { name: "Thanks, we have your details." })).toBeVisible(); await expect(page.getByText("No account has been created yet.")).toBeVisible();
  const saved = (await db.collection("puckleJoinContactRequests").findOne({ name }))!;
  expect(saved).toMatchObject({ kind: "no-email-join-request", registrationCategory: "student", mobile: "+353871234567", submittedDateOfBirth: `${thisYear - 16}-03-03` });
  expect(Object.keys(saved).filter(key => /password|username|^email$|userId/i.test(key))).toEqual([]);
  expect(await db.collection("users").countDocuments()).toBe(before); expect(await db.collection("users").findOne({ username: "typed_name" })).toBeNull();
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await waitFor(async () => (await db.collection("puckleJoinContactRequests").findOne({ _id: saved._id }))?.founderNotification?.status === "sent");
  expect((await mailTo("founder@example.invalid", new RegExp(name))).subject).toMatch(/^\[ACTION\] 📱 CALL BACK \(no email, student\): /);
  const teacher = await open(browser); const teacherName = unique("Nomailteach"); await choose(teacher, "I'm a teacher");
  await teacher.getByLabel("Your name").fill(teacherName); await teacher.getByRole("button", { name: "Don't have an email address?" }).click(); await teacher.locator("#join-phone").fill("871234568"); await submit(teacher).click();
  await expect(teacher.getByRole("heading", { name: "Thanks, we have your details." })).toBeVisible();
  expect(await db.collection("puckleJoinContactRequests").findOne({ name: teacherName })).toMatchObject({ registrationCategory: "teacher", mobile: "+353871234568" });
  expect(await db.collection("users").countDocuments()).toBe(before);
});
test("interest is an updates sign-up: no checkbox, submitting is the request, mobile-only is follow-up only, never an account", async ({ browser }) => {
  const page = await open(browser), name = unique("Curious"), email = emailOf("interest"), before = await db.collection("users").countDocuments();
  await choose(page, "I'm interested in Puckle");
  await expect(page.getByText("Interested in Puckle? Leave your details and we'll send you occasional updates as it develops.")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0); await expect(page.locator("#join-phone")).toBeVisible(); await expect(submit(page)).toHaveText("Keep me updated");
  await submit(page).click(); await expect(page.getByText("Enter an email address or a mobile number.")).toBeVisible(); await expect(page.getByText("Tell us what brings you")).toHaveCount(0);
  await page.getByLabel("Your name").fill(name); await page.getByLabel("Email", { exact: false }).first().fill(email); await submit(page).click();
  await expect(page.getByRole("heading", { name: "You're on the list." })).toBeVisible(); await expect(page.getByText(/asked for occasional Puckle updates by email/)).toBeVisible();
  await expect(page.getByRole("link", { name: /@/ })).toHaveAttribute("href", /^mailto:/); await expect(page.getByText(/No account was created/)).toBeVisible(); await noOverflow(page);
  const saved = (await db.collection("puckleInterestContacts").findOne({ name }))!;
  expect(saved).toMatchObject({ email, mobile: null, reason: "", communication: { emailUpdates: true, source: "join-interest-form", wordingVersion: "puckle-updates-signup-v1" } });
  expect(saved.communication.recordedAt).toBeInstanceOf(Date);
  expect(await db.collection("users").countDocuments()).toBe(before); expect(await db.collection("users").findOne({ email })).toBeNull(); expect(await db.collection("puckleMemberships").findOne({ name })).toBeNull();
  await waitFor(async () => (await db.collection("puckleInterestContacts").findOne({ _id: saved._id }))?.founderNotification?.status === "sent");
  const second = await open(browser), mobileOnly = unique("Mobileonly"); await choose(second, "I'm interested in Puckle");
  await second.getByLabel("Your name").fill(mobileOnly); await second.getByLabel("What brings you to Puckle? (optional)").fill("teacher");
  await second.getByRole("button", { name: "Don't have an email address?" }).click();
  await expect(second.getByText(/No marketing texts/)).toBeVisible(); await expect(second.getByLabel("Email", { exact: true })).toHaveCount(0);
  await second.locator("#join-phone").fill("871234569"); await submit(second).click();
  await expect(second.getByRole("heading", { name: "You're on the list." })).toBeVisible(); await expect(second.getByText(/follow up on this request/)).toBeVisible(); await expect(second.getByText(/asked for occasional/)).toHaveCount(0);
  expect(await db.collection("puckleInterestContacts").findOne({ name: mobileOnly })).toMatchObject({ email: null, mobile: "+353871234569", reason: "teacher", communication: { emailUpdates: false } });
  expect(await db.collection("users").countDocuments()).toBe(before);
});
test("an existing email gets the same on-screen result and only sign-in guidance; no account is created or reused", async ({ browser }) => {
  const existing = emailOf("existing"), owner = { _id: new ObjectId(), email: existing, username: unique("Own"), passwordHash: await bcrypt.hash("x", 4), cardsData: [], decksData: [], createdAt: new Date(), updatedAt: new Date() };
  await db.collection("users").insertOne(owner); const page = await open(browser);
  await fillStudent(page, { username: unique("Dup"), email: existing }); await submit(page).click();
  await expect(page.getByText(existing)).toBeVisible(); await expect(submit(page)).toHaveText("Verify and create my account");
  expect((await mailTo(existing, /already uses this email/)).text).toMatch(/\/login\/forgot-password/);
  await page.locator("#join-code").fill("123456"); await submit(page).click(); await expect(page.getByText("That code isn't right, or it has expired.")).toBeVisible();
  expect(await db.collection("users").countDocuments({ email: existing })).toBe(1); expect(await db.collection("puckleMemberships").findOne({ userId: owner._id })).toBeNull();
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
});
test("changing the email invalidates the earlier code; Change my details returns with everything kept", async ({ browser }) => {
  const page = await open(browser), first = emailOf("first"), second = emailOf("second");
  await fillStudent(page, { username: unique("Chg"), email: first }); await submit(page).click(); const firstCode = await codeFor(first);
  await page.getByRole("button", { name: "Change my email or details" }).click(); await expect(page.getByLabel("Email", { exact: true })).toHaveValue(first);
  await expect(submit(page)).toHaveText("Enter my verification code");
  await page.getByLabel("Email", { exact: true }).fill(second); await expect(submit(page)).toHaveText("Email me a verification code"); await submit(page).click();
  await page.locator("#join-code").fill(firstCode); await submit(page).click(); await expect(page.getByText("That code isn't right, or it has expired.")).toBeVisible();
  expect(await db.collection("users").findOne({ email: { $in: [first, second] } })).toBeNull();
  await page.locator("#join-code").fill(await codeFor(second)); await submit(page).click(); await page.waitForURL(`${origin}/library`);
  expect(await db.collection("users").findOne({ email: second })).not.toBeNull(); expect(await db.collection("users").findOne({ email: first })).toBeNull();
});
test("resend is limited by a visible cooldown", async ({ browser }) => {
  const page = await open(browser), email = emailOf("resend");
  await fillStudent(page, { username: unique("Rsd"), email }); await submit(page).click();
  const resend = page.getByRole("button", { name: /Send a new code/ }); await expect(resend).toBeDisabled(); await expect(resend).toContainText(/in \d+s/);
  expect((await outbox()).filter(m => m.to.includes(email)).length).toBe(1);
});
test("an already signed-in visitor is not offered registration", async ({ browser }) => {
  const page = await open(browser, "/");
  expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).status()).toBe(200);
  await page.goto(`${origin}/join`); await expect(page.getByRole("heading", { name: "You're already signed in." })).toBeVisible(); await expect(page.getByLabel("Choose a username")).toHaveCount(0);
});
test("Join is Puckle-only: other websites have no page and refuse the APIs; bad requests are refused without storing anything", async ({ browser, playwright }) => {
  for (const site of ["switchplay", "strat17"]) {
    const context = await browser.newContext({ storageState: { cookies: [{ name: "site", value: site, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
    const page = await context.newPage(); expect((await page.goto(`${origin}/join`))!.status()).toBe(404);
    for (const path of ["membership", "join-contact", "interest"]) {
      const response = await context.request.post(`${origin}/api/public/puckle/${path}`, { headers: { Origin: origin }, data: { details: {} } }); expect(response.status(), `${site}/${path}`).toBe(404);
    }
    await context.close();
  }
  const forwarded = { "x-forwarded-for": "10.77.0.1" }, request = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: forwarded });
  const post = (path: string, data: unknown, headers: Record<string, string> = { Origin: origin }) => request.post(`/api/public/puckle/${path}`, { headers, data });
  const before = [await db.collection("users").countDocuments(), await db.collection("puckleJoinContactRequests").countDocuments(), await db.collection("puckleInterestContacts").countDocuments()];
  expect((await post("interest", { details: {} }, { Origin: "https://evil.invalid" })).status()).toBe(400);
  expect((await request.post("/api/public/puckle/interest", { headers: { Origin: origin, "Content-Type": "text/plain" }, data: "{}" })).status()).toBe(400);
  expect((await post("interest", { details: {}, permissions: { publicPublishing: true } })).status()).toBe(400);
  const proofless = await post("membership", { details: { registrationCategory: "student" }, username: "x", password: "y", challengeId: "c", flowToken: "f", proof: "p" });
  expect(proofless.status()).toBe(400); expect(proofless.headers()["set-cookie"]).toBeUndefined();
  const forged = await post("membership", { details: { registrationCategory: "teacher", name: "T", email: "forged@example.invalid", permissions: { publicPublishing: true }, teacherIntroduction: "" }, username: "forged_one", password: "a perfectly good passphrase", challengeId: "c".repeat(43), flowToken: "f".repeat(43), proof: "p".repeat(43) });
  expect(forged.status()).toBe(400); expect((await forged.json()).code).toBe("UNEXPECTED_FIELD");
  expect((await post("join-contact", { details: { registrationCategory: "teacher", name: "T", email: "", mobile: "+353871234567", password: "never" } })).status()).toBe(400);
  const honey = await post("interest", { details: { name: "Bot", email: "bot@example.invalid", mobile: "", reason: "spam" }, companyWebsite: "http://spam.invalid" }); expect(honey.status()).toBe(201);
  expect([await db.collection("users").countDocuments(), await db.collection("puckleJoinContactRequests").countDocuments(), await db.collection("puckleInterestContacts").countDocuments()]).toEqual(before);
  expect(await db.collection("puckleInterestContacts").findOne({ name: "Bot" })).toBeNull();
  const noCache = await post("interest", { details: {} }); expect(noCache.headers()["cache-control"]).toBe("no-store");
  await request.dispose();
});
test("contact submissions are rate limited per requester", async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { "x-forwarded-for": "10.88.0.1" } });
  const statuses: number[] = [];
  for (let index = 0; index < 11; index += 1) statuses.push((await request.post("/api/public/puckle/interest", { headers: { Origin: origin }, data: { details: { name: `Limit ${index}`, email: "", mobile: "+353871234567", reason: "testing", message: "" } } })).status());
  expect(statuses.slice(0, 10)).toEqual(Array(10).fill(201)); expect(statuses[10]).toBe(429); await request.dispose();
});
