import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

/**
 * Pre-launch mode, end to end: real Next server, disposable MongoDB, captured mail, phone width.
 * Run twice: with PUCKLE_PRELAUNCH_MODE=1 and PUCKLE_PRELAUNCH_ACCESS="  Allowed-One@Example.invalid , allowed-two@example.invalid ,, "
 * (the "on" group), and with neither set (the "off" group). Registration of allowed-three@example.invalid happens once per database.
 */
const origin = process.env.PHASE2_BASE_URL!;
const on = process.env.PUCKLE_PRELAUNCH_MODE === "1";
const ALLOWED_ONE = "allowed-one@example.invalid", ALLOWED_TWO = "allowed-two@example.invalid", ALLOWED_REGISTERING = "allowed-three@example.invalid"; // the last is only ever registered through Join
let client: MongoClient, db: Db, counter = 0;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); db = client.db(process.env.MONGODB_DB); });
test.afterAll(async () => { await client?.close(); });
const year = new Date().getFullYear();
const unique = (tag: string) => `${tag}${Date.now().toString(36)}${++counter}`;
async function outbox() { return await fetch(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/emails`).then(r => r.json()) as { to: string[]; subject: string; text: string }[]; }
type Options = { dob?: string | null; category?: "student" | "teacher" | null; eligible?: boolean; email?: string; approval?: Record<string, unknown> };
async function account(options: Options = {}) {
  const _id = new ObjectId(), username = unique("Pre"), now = new Date();
  if (options.email) { // fixed addresses (the access list) can be reused by several tests
    const old = await db.collection("users").findOne({ email: options.email }, { projection: { _id: 1 } });
    if (old) { await db.collection("puckleMemberships").deleteMany({ userId: old._id }); await db.collection("users").deleteOne({ _id: old._id }); }
  }
  const dob = options.dob === undefined ? `${year - 17}-03-03` : options.dob;
  await db.collection("users").insertOne({ _id, email: options.email ?? `${username.toLowerCase()}@example.invalid`, username, passwordHash: await bcrypt.hash("local-test-only", 4), cardsData: [], decksData: [], sharedDeckData: [], permissions: { publicPublishing: false },
    safeguarding: { ...(dob ? { dateOfBirth: dob, dobSource: "self-declared", dobRecordedAt: now, ageAssurance: { verification: "none" } } : {}),
      ...(options.approval ? { groupExperienceApproval: { scopeId: "shared-group-experiences", generation: 1, explanation: { version: "v", text: "t" }, history: [], ...options.approval } } : {}) }, createdAt: now, updatedAt: now });
  if (options.category !== null) await db.collection("puckleMemberships").insertOne({ userId: _id, name: "Niamh", registrationCategory: options.category ?? "student", mobile: null, initialRegistrationSource: "join", welcome: { eligible: options.eligible ?? true }, createdAt: now, updatedAt: now });
  return { _id, username };
}
async function context(browser: Browser, login?: string, site = "puckle") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: "en-IE", extraHTTPHeaders: { "x-forwarded-for": `10.7.${counter % 250}.${Math.floor(Math.random() * 250)}` },
    storageState: { cookies: [{ name: "site", value: site, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
  if (login) expect((await ctx.request.post(`${origin}/api/auth/login`, { data: { identifier: login, password: "local-test-only" } })).status()).toBe(200);
  return ctx;
}
async function open(browser: Browser, login: string, path = "/decks", site = "puckle") { const ctx = await context(browser, login, site); const page = await ctx.newPage(); await page.goto(`${origin}${path}`); return { ctx, page }; }
const welcome = (page: Page) => page.getByTestId("prelaunch-welcome");
const original = (page: Page) => page.locator('[data-onboarding="welcome"]');
const seenAt = async (id: ObjectId) => (await db.collection("puckleMemberships").findOne({ userId: id }))!.welcome.seenAt;
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
const myDecks = (page: Page) => page.getByRole("heading", { name: "My Decks", exact: true });
const MESSAGES = {
  studentLead: "New maths content starts arriving in early December.",
  studentBody: "You're here from the beginning. Improve your maths and help shape what we create next.",
  studentFollow: "Maths lessons with Puckle are available today. Or join us for a free introductory session to see how the platform works and discuss your maths.",
  teacherBody: "You're joining us from the beginning, with an opportunity to help shape how Puckle supports teachers and students.",
  otherLead: "We're opening in early December.",
  otherBody: "You're joining Puckle at the beginning. We're creating new ways to learn maths, and we'd love you to be part of what comes next.",
  thanks: "Thanks for your interest!",
  received: "We've received your details and will be in touch. In the meantime, if you have more ideas or questions, you're always welcome to contact us.",
};

test.describe("pre-launch mode on", () => {
  test.skip(!on, "needs PUCKLE_PRELAUNCH_MODE=1");

  test("a student not on the list gets the student welcome, centred and legible at 390px, with the tuition enquiry action", async ({ browser }) => {
    const student = await account(), { ctx, page } = await open(browser, student.username);
    await expect(welcome(page)).toBeVisible();
    await expect(page.getByText("EARLY ACCESS", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome to Puckle!", level: 1 })).toBeVisible();
    for (const text of [MESSAGES.studentLead, MESSAGES.studentBody, MESSAGES.studentFollow]) await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Want to get started now?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Request a free session" })).toHaveAttribute("href", "/#early-access");
    await page.getByRole("link", { name: "Request a free session" }).click(); // the existing tuition enquiry form, unchanged and still reachable
    await expect(page).toHaveURL(`${origin}/#early-access`); await expect(page.getByRole("heading", { name: "Try Puckle for yourself." })).toBeVisible();
    await page.goBack();
    await expect(page.getByText(/one-to-one/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /get in touch/i })).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/decks");
    await expect(myDecks(page)).toHaveCount(0);
    await expect(page.locator(".app-shell, .library-shell")).toHaveCount(0);
    await noOverflow(page);
    const box = (await page.locator("section[aria-labelledby=prelaunch-title]").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390.5);
    expect(Math.abs(box.x + box.width / 2 - 195)).toBeLessThan(2); // centred horizontally
    expect(Math.abs(box.y + box.height / 2 - 422)).toBeLessThan(box.height > 560 ? 160 : 70); // centred vertically (allowing for the sign-out row below)
    // The backdrop is decorative: hidden from assistive technology, no readable content or links.
    const backdrop = page.locator('[data-prelaunch="backdrop"]');
    await expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect((await backdrop.innerText()).trim()).toBe("");
    expect(await backdrop.locator("a, button, input").count()).toBe(0);
    await ctx.close();
  });

  test("the pre-launch welcome never records the original welcome, even after reloads and sign-in again", async ({ browser }) => {
    const student = await account({ eligible: true }), { ctx, page } = await open(browser, student.username);
    await expect(welcome(page)).toBeVisible(); await page.waitForTimeout(1500);
    expect(await seenAt(student._id)).toBeUndefined(); await expect(original(page)).toHaveCount(0);
    await page.reload(); await expect(welcome(page)).toBeVisible(); await page.waitForTimeout(1000);
    expect(await seenAt(student._id)).toBeUndefined();
    // The server also refuses to record it, even if a client asked.
    const refused = await page.evaluate(async id => (await fetch("/api/account/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "acknowledge", expectedUserId: id }) })).status, student._id.toHexString());
    expect(refused).toBe(403); expect(await seenAt(student._id)).toBeUndefined();
    await ctx.close();
  });

  test("every restricted learning page shows the pre-launch welcome, and the sign-in page leads to it", async ({ browser }) => {
    const student = await account(), ctx = await context(browser, student.username), page = await ctx.newPage();
    for (const path of ["/decks", "/library", "/library?tab=info-cards", "/library/does-not-exist", "/progress", "/creator", "/creator/new", "/creator/info-cards/new"]) {
      await page.goto(`${origin}${path}`); await expect(welcome(page), path).toBeVisible();
      expect(new URL(page.url()).pathname, path).toBe(path.split("?")[0] === "/creator" ? "/creator" : new URL(`${origin}${path}`).pathname);
      await expect(original(page)).toHaveCount(0);
    }
    await ctx.close();
    // Subsequent sign-in: the embedded sign-in screen on My Decks leads to the pre-launch welcome.
    const fresh = await context(browser), signIn = await fresh.newPage();
    await signIn.goto(`${origin}/decks`); await expect(signIn.getByRole("heading", { name: "Sign in" })).toBeVisible(); await expect(welcome(signIn)).toHaveCount(0);
    await signIn.getByLabel("Username or email").fill(student.username); await signIn.getByLabel("Password", { exact: true }).fill("local-test-only"); await signIn.getByRole("button", { name: "Sign in" }).click();
    await expect(welcome(signIn)).toBeVisible();
    await signIn.goto(`${origin}/login`); await expect(signIn).toHaveURL(`${origin}/decks`); await expect(welcome(signIn)).toBeVisible();
    await fresh.close();
  });

  // Signs in through the real form, so it also works against a production build (Secure cookies are only accepted by the browser itself).
  test("browser sign-in: a member lands on the pre-launch welcome at 390px and a listed account on the platform", async ({ browser }) => {
    for (const listed of [false, true]) {
      const person = await account(listed ? { email: ALLOWED_ONE } : {}), ctx = await context(browser), page = await ctx.newPage();
      await page.goto(`${origin}/decks`); await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await page.getByLabel("Username or email").fill(person.username); await page.getByLabel("Password", { exact: true }).fill("local-test-only"); await page.getByRole("button", { name: "Sign in" }).click();
      if (listed) { await expect(myDecks(page)).toBeVisible(); await expect(welcome(page)).toHaveCount(0); }
      else {
        await expect(welcome(page)).toBeVisible(); await expect(myDecks(page)).toHaveCount(0); await noOverflow(page);
        const status = await page.evaluate(async () => { const r = await fetch("/api/decks-data"); return r.status; }); expect(status).toBe(403);
        await page.reload(); await expect(welcome(page)).toBeVisible(); await page.getByRole("button", { name: "Sign out" }).click(); await expect(page).toHaveURL(`${origin}/`);
      }
      await ctx.close();
    }
  });

  test("restricted APIs refuse a non-exempt signed-in member while registration, sign-in, tuition, approval and sign-out stay open", async ({ browser }) => {
    const student = await account({ dob: `${year - 14}-01-01` }), ctx = await context(browser, student.username), api = ctx.request;
    const blocked = ["/api/decks-data", "/api/decks-data/shared", "/api/library/decks", "/api/library/info-cards", "/api/frameworks", "/api/frameworks/summary", "/api/creator/drafts", "/api/deck-templates", "/api/info-cards", "/api/users", "/api/account/public-publishing", "/api/media/protected"];
    for (const path of blocked) { const response = await api.get(`${origin}${path}`); expect(response.status(), path).toBe(403); expect((await response.json()).code, path).toBe("PRELAUNCH"); expect(response.headers()["cache-control"], path).toContain("no-store"); }
    for (const [method, path] of [["POST", "/api/deck-templates"], ["PATCH", "/api/decks-data/abc"], ["POST", "/api/cards-data/abc/update"], ["DELETE", "/api/library/decks/abc"]] as const) {
      expect((await api.fetch(`${origin}${path}`, { method, data: {} })).status(), `${method} ${path}`).toBe(403);
    }
    expect((await api.get(`${origin}/api/auth/me`)).status()).toBe(200);
    const status = await api.get(`${origin}/api/account/onboarding`); expect(status.status()).toBe(200); expect(await status.json()).toEqual({ actorId: student._id.toHexString(), show: false });
    expect((await api.get(`${origin}/api/public/puckle/tuition-context`)).status()).toBe(200);
    expect((await api.post(`${origin}/api/account/parental-approval`, { headers: { origin }, data: { action: "request", guardianEmail: `${unique("parent")}@example.invalid`, expectedUserId: student._id.toHexString() } })).status()).toBe(200);
    expect((await api.post(`${origin}/api/auth/logout`)).status()).toBe(200);
    expect((await api.get(`${origin}/api/auth/me`)).status()).toBe(401);
    // Signed out: restricted APIs answer exactly as before (unauthenticated), not with the pre-launch message.
    expect((await api.get(`${origin}/api/decks-data`)).status()).toBe(401);
    await ctx.close();
  });

  test("accounts on the list (whitespace and case ignored) keep the real platform on the same domain, including the original welcome", async ({ browser }) => {
    for (const email of [ALLOWED_ONE, ALLOWED_TWO.toUpperCase().toLowerCase()]) {
      const tester = await account({ email, eligible: true }), { ctx, page } = await open(browser, tester.username).catch(() => { throw new Error(`login failed for ${email}`); });
      await expect(welcome(page)).toHaveCount(0);
      await expect(original(page)).toBeVisible(); // the original welcome, by its existing rules
      await expect.poll(() => seenAt(tester._id)).toBeTruthy();
      await page.goto(`${origin}/library`); await expect(page.locator("main").first()).toBeVisible(); await expect(welcome(page)).toHaveCount(0);
      expect((await ctx.request.get(`${origin}/api/decks-data`)).status()).toBe(200);
      expect((await ctx.request.get(`${origin}/api/library/decks`)).status()).toBe(200);
      expect((await ctx.request.get(`${origin}/api/frameworks`)).status()).toBe(200);
      await ctx.close();
    }
  });

  test("signed-out visitors see the existing sign-in screen and 401s, and the public site is untouched", async ({ browser }) => {
    const ctx = await context(browser), page = await ctx.newPage();
    for (const path of ["/decks", "/library", "/progress"]) { await page.goto(`${origin}${path}`); await expect(page.getByRole("heading", { name: "Sign in" }), path).toBeVisible(); await expect(welcome(page)).toHaveCount(0); }
    for (const path of ["/api/decks-data", "/api/library/decks", "/api/frameworks"]) expect((await ctx.request.get(`${origin}${path}`)).status(), path).toBe(401);
    for (const path of ["/", "/contact", "/privacy", "/login"]) { expect((await ctx.request.get(`${origin}${path}`)).status(), path).toBe(200); }
    await ctx.close();
  });

  test("Switchplay and Strat17 are not affected, for the same signed-in account", async ({ browser }) => {
    const student = await account();
    for (const site of ["switchplay", "strat17"]) {
      const { ctx, page } = await open(browser, student.username, "/decks", site);
      await expect(welcome(page), site).toHaveCount(0); await expect(myDecks(page), site).toBeVisible();
      expect((await ctx.request.get(`${origin}/api/decks-data`)).status(), site).toBe(200);
      expect((await ctx.request.get(`${origin}/api/library/decks`)).status(), site).toBe(200);
      await ctx.close();
    }
  });

  test("a teacher gets the teacher welcome with a plain email link, no button and no second form", async ({ browser }) => {
    const teacher = await account({ category: "teacher", dob: null }), { ctx, page } = await open(browser, teacher.username);
    await expect(welcome(page)).toBeVisible();
    for (const text of [MESSAGES.studentLead, MESSAGES.teacherBody, MESSAGES.received]) await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: MESSAGES.thanks })).toBeVisible();
    await expect(page.getByRole("link", { name: "hello@puckleup.com" })).toHaveAttribute("href", "mailto:hello@puckleup.com");
    await expect(page.getByRole("link", { name: /get in touch|enquire|free session/i })).toHaveCount(0); await expect(page.getByRole("button")).toHaveCount(1); // only Sign out
    await expect(page.locator("form, input, textarea")).toHaveCount(0);
    await expect(page.locator('[data-prelaunch="approval"]')).toHaveCount(0); await noOverflow(page); await ctx.close();
  });

  test("a signed-in account without a student or teacher membership gets the general welcome", async ({ browser }) => {
    const other = await account({ category: null, dob: null }), { ctx, page } = await open(browser, other.username);
    await expect(welcome(page)).toBeVisible();
    for (const text of [MESSAGES.otherLead, MESSAGES.otherBody, MESSAGES.received]) await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: MESSAGES.thanks })).toBeVisible();
    await expect(page.getByRole("link", { name: "hello@puckleup.com" })).toHaveAttribute("href", "mailto:hello@puckleup.com");
    await expect(page.getByRole("link", { name: /get in touch|enquire|free session/i })).toHaveCount(0); await expect(page.locator("form, input, textarea")).toHaveCount(0);
    await ctx.close();
  });

  test("the parent or guardian section appears only while approval is genuinely needed, stays secondary, and uses the existing request", async ({ browser }) => {
    const kid = await account({ dob: `${year - 14}-01-01` }), { ctx, page } = await open(browser, kid.username);
    const section = page.locator('[data-prelaunch="approval"]');
    await expect(section).toBeVisible(); await expect(section.getByRole("heading", { name: "Parent or guardian approval" })).toBeVisible();
    await expect(section.getByText("Some sharing features require permission from a parent or guardian.", { exact: true })).toBeVisible();
    await expect(welcome(page).getByText(/group learning/i)).toHaveCount(0);
    await expect(page.getByLabel("Parent or guardian's email")).toHaveCount(0); // collapsed until asked, so a phone stays uncluttered
    await noOverflow(page);
    await section.getByRole("button", { name: "Ask a parent or guardian" }).click();
    await expect(page.getByText("Group features need a parent or guardian's approval. Want to ask now? You can keep learning privately either way.", { exact: true })).toBeVisible(); // the original form introduction, unchanged
    const guardian = `${unique("mum")}@example.invalid`;
    await page.getByLabel("Parent or guardian's email").fill(guardian); await page.getByRole("button", { name: "Send approval request" }).click();
    await expect.poll(async () => (await db.collection("users").findOne({ _id: kid._id }))!.safeguarding.groupExperienceApproval?.status).toBe("pending");
    expect((await db.collection("users").findOne({ _id: kid._id }))!.safeguarding.groupExperienceApproval.guardianEmail).toBe(guardian);
    await expect.poll(async () => (await outbox()).some(m => m.to.includes(guardian) && /approv/i.test(m.subject + m.text))).toBe(true); // the existing parent email
    await expect(section.getByText(/Sent to/)).toBeVisible(); await noOverflow(page);
    expect(await seenAt(kid._id)).toBeUndefined();
    await ctx.close();
    for (const [label, options] of [["a student of 16 or over", { dob: `${year - 17}-01-01` }], ["a student with no known date of birth", { dob: null }],
      ["an approved student", { dob: `${year - 14}-01-01`, approval: { status: "approved", guardianEmail: "p@example.invalid", requestedAt: new Date(), decidedAt: new Date() } }]] as const) {
      const other = await account(options), opened = await open(browser, other.username);
      await expect(welcome(opened.page), label).toBeVisible(); await expect(opened.page.locator('[data-prelaunch="approval"]'), label).toHaveCount(0); await opened.ctx.close();
    }
  });

  test("Join shows the pre-launch wording above the student and teacher forms only, and leaves the interest choice alone", async ({ browser }) => {
    const ctx = await context(browser), page = await ctx.newPage(); await page.goto(`${origin}/join`);
    const notice = page.locator('[data-join="prelaunch-notice"]');
    await expect(notice.getByRole("heading", { name: "Join Puckle now" })).toBeVisible();
    await expect(notice.getByText("New maths content starts arriving in early December. Sign up today to be among the first to use it.", { exact: true })).toBeVisible();
    await expect(notice.getByText("Want to get started now? Maths lessons with Puckle are already available, using our interactive learning platform.")).toBeVisible();
    await expect(page.getByLabel("First name")).toBeVisible(); // the existing form is intact
    await expect(page.getByText("Join free to learn maths with Puckle's cards", { exact: false })).toHaveCount(0); // replaced, never shown together
    // Spacing at 390px: heading to first paragraph about 20% more than the 8px base, first paragraph to the get-started line about 25% more.
    const gaps = await notice.evaluate(el => { const [h, a, b] = [el.querySelector("h2")!, ...el.querySelectorAll("p")].map(n => n.getBoundingClientRect()); return { headingToText: a.top - h.bottom, textToStart: b.top - a.bottom }; });
    expect(gaps.headingToText).toBeGreaterThan(9); expect(gaps.headingToText).toBeLessThan(11);
    expect(gaps.textToStart).toBeGreaterThan(9.5); expect(gaps.textToStart).toBeLessThan(12);
    await noOverflow(page);
    await page.getByRole("radio", { name: "I'm a teacher" }).check();
    await expect(notice.getByRole("heading", { name: "Join Puckle as a teacher" })).toBeVisible();
    await expect(notice.getByText("New maths content starts arriving in early December. Join now to get early access and help shape how Puckle supports maths teaching and learning.", { exact: true })).toBeVisible();
    await expect(notice.getByText("Want to get started now?")).toHaveCount(0);
    await expect(page.getByText("Teachers are welcome to explore Puckle and help shape it.", { exact: false })).toBeVisible(); // teacher introduction kept
    await page.getByRole("radio", { name: "I'm interested in Puckle" }).check(); await expect(notice).toHaveCount(0);
    await page.getByRole("radio", { name: "I'm here to learn" }).check(); await noOverflow(page);
    await ctx.close();
  });

  test("a new student registers, lands on the pre-launch welcome with the original welcome unrecorded; a listed email gets the normal welcome", async ({ browser }) => {
    for (const listed of [false, true]) {
      const email = listed ? ALLOWED_REGISTERING : `${unique("newstudent")}@example.invalid`, username = unique("reg");
      const ctx = await context(browser), page = await ctx.newPage(); await page.goto(`${origin}/join`);
      await page.getByLabel("First name").fill("Ada"); await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Choose a username").fill(username); await page.getByLabel("Choose a password").fill("a perfectly good passphrase");
      await page.locator("#join-dobDay").fill("14"); await page.locator("#join-dobMonth").fill("6"); await page.locator("#join-dobYear").fill(String(year - 17));
      await page.locator("#join-course").selectOption("gcse"); await page.locator("#join-level").selectOption("higher-tier");
      for (const radio of await page.locator('[data-preferences="join"] input[type=radio][value=no]').all()) await radio.check();
      await page.locator("button[type=submit]").click();
      const deadline = Date.now() + 15_000; let code = "";
      while (!code && Date.now() < deadline) { code = (await outbox()).filter(m => m.to.includes(email) && /\b\d{6}\b/.test(m.text)).at(-1)?.text.match(/\b\d{6}\b/)?.[0] ?? ""; if (!code) await new Promise(r => setTimeout(r, 200)); }
      expect(code, "verification email").not.toBe("");
      await page.getByLabel(/6-digit code|code/i).first().fill(code); await page.locator("button[type=submit]").click();
      const user = async () => (await db.collection("users").findOne({ username }))!;
      if (listed) { await expect(page.getByTestId("registration-welcome")).toContainText("Taking you to your space…"); await page.waitForURL(`${origin}/decks`, { timeout: 20_000 }); await expect(myDecks(page)).toBeVisible(); await expect.poll(async () => (await db.collection("puckleMemberships").findOne({ userId: (await user())._id }))?.welcome.seenAt).toBeTruthy(); }
      else {
        await page.waitForURL(`${origin}/decks`, { timeout: 20_000 }); await expect(welcome(page)).toBeVisible(); await expect(page.getByTestId("registration-welcome")).toHaveCount(0);
        await page.waitForTimeout(1500);
        const membership = (await db.collection("puckleMemberships").findOne({ userId: (await user())._id }))!;
        expect(membership.welcome).toEqual({ eligible: true }); // still eligible and unseen for the full launch
      }
      await ctx.close();
    }
  });
});

test.describe("pre-launch mode off", () => {
  test.skip(on, "needs PUCKLE_PRELAUNCH_MODE unset or 0");

  test("everyone gets the normal platform and the original welcome; Join has no pre-launch wording", async ({ browser }) => {
    const student = await account({ eligible: true }), { ctx, page } = await open(browser, student.username);
    await expect(welcome(page)).toHaveCount(0); await expect(original(page)).toBeVisible(); await expect.poll(() => seenAt(student._id)).toBeTruthy();
    expect((await ctx.request.get(`${origin}/api/decks-data`)).status()).toBe(200);
    await ctx.close();
    const visitor = await context(browser), join = await visitor.newPage(); await join.goto(`${origin}/join`);
    await expect(join.locator('[data-join="prelaunch-notice"]')).toHaveCount(0);
    await expect(join.getByText("Join free to learn maths with Puckle's cards and keep track of your progress.", { exact: true })).toBeVisible(); // the original student introduction
    await expect(join.getByText("early December", { exact: false })).toHaveCount(0);
    await visitor.close();
  });

  test("an access list without pre-launch mode changes nothing", async ({ browser }) => {
    const other = await account({ category: "teacher", dob: null }), { ctx, page } = await open(browser, other.username);
    await expect(welcome(page)).toHaveCount(0); await expect(myDecks(page)).toBeVisible(); await ctx.close();
  });
});
