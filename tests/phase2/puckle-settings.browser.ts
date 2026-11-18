import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

// Settings (signed-in students and teachers), the signed management link (no account) and the text-us wording. Pre-launch off.
const origin = process.env.PHASE2_BASE_URL!;
let client: MongoClient, db: Db, counter = 0;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); db = client.db(process.env.MONGODB_DB); });
test.afterAll(async () => { await client?.close(); });
const unique = (tag: string) => `${tag}${Date.now().toString(36)}${++counter}`;
async function student(category: "student" | "teacher" = "student") {
  const _id = new ObjectId(), username = unique("Set"), now = new Date();
  await db.collection("users").insertOne({ _id, email: `${username.toLowerCase()}@example.invalid`, username, passwordHash: await bcrypt.hash("local-test-only", 4), cardsData: [], decksData: [], sharedDeckData: [], permissions: { publicPublishing: false }, isAdmin: false, sessionVersion: 0, createdAt: now, updatedAt: now });
  await db.collection("puckleMemberships").insertOne({ userId: _id, name: "Niamh", registrationCategory: category, mobile: null, initialRegistrationSource: "join", welcome: { eligible: false, seenAt: now }, createdAt: now, updatedAt: now });
  return { _id, username };
}
async function context(browser: Browser, width: number, login?: string, site = "puckle") {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 600, locale: "en-IE",
    extraHTTPHeaders: { "x-forwarded-for": `10.14.${++counter % 250}.${Math.floor(Math.random() * 250)}` },
    storageState: { cookies: [{ name: "site", value: site, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
  if (login) expect((await ctx.request.post(`${origin}/api/auth/login`, { data: { identifier: login, password: "local-test-only" } })).status()).toBe(200);
  return ctx;
}
const section = (page: Page) => page.locator('[data-preferences="settings"]');
const group = (page: Page, title: string) => section(page).getByRole("radiogroup", { name: title });
const answer = (page: Page, title: string, value: "Yes" | "No") => group(page, title).getByRole("radio", { name: value }).check();
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
const stored = async (id: ObjectId) => (await db.collection("puckleMemberships").findOne({ userId: id }))!.communicationPreferences;

for (const width of [390, 1280]) {
  test(`Settings at ${width}px: reached from the app menu, view, change, save and persist`, async ({ browser }) => {
    const user = await student(), ctx = await context(browser, width, user.username), page = await ctx.newPage();
    await page.goto(`${origin}/decks`);
    await page.getByRole("button", { name: "Overview menu" }).click();
    const item = page.getByRole("menuitem", { name: "Settings", exact: true });
    await expect(item).toBeVisible(); await item.click(); await page.waitForURL(`${origin}/settings`);
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Communication preferences" })).toBeVisible();
    // An existing member with nothing saved sees every choice unanswered, never a Yes or a No.
    expect(await section(page).locator("input[type=radio]:checked").count()).toBe(0);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(section(page).getByText("Choose Yes or No.")).toHaveCount(4);
    // Update choices are nested under Puckle Updates; personal contact is a separate group.
    const updates = section(page).getByRole("group", { name: "Puckle Updates" }), personal = section(page).getByRole("group", { name: "Personal contact" });
    await expect(updates.getByRole("radiogroup")).toHaveCount(3); await expect(personal.getByRole("radiogroup")).toHaveCount(1);
    await expect(updates.getByText("Choose which updates and invitations you would like to receive.")).toBeVisible();
    await expect(updates.getByText("A fortnightly roundup of new lessons, interactive activities and revision materials.")).toBeVisible();
    await expect(updates.getByText("Invitations to join teacher-guided maths and revision activities you complete at your own pace.")).toBeVisible();
    await expect(group(page, "New maths content").locator("input").first()).toBeFocused();
    await answer(page, "New maths content", "Yes"); await answer(page, "News and offers", "No"); await answer(page, "Occasional personal contact", "Yes"); await answer(page, "Group invites", "No");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(section(page).getByText("Choose email, text message or both.")).toBeVisible();
    const box = section(page).getByRole("group", { name: "Receive updates and invitations by" });
    await box.getByRole("checkbox", { name: "Text message" }).check();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/valid mobile number above to receive text messages/)).toBeVisible();
    await expect(page.locator("#settings-mobile-phone")).toBeVisible();
    // The number is asked for directly beneath the delivery choices, inside the Puckle Updates group.
    await expect(updates.locator("#settings-mobile-phone")).toBeVisible(); await expect(personal.locator("#settings-mobile-phone")).toHaveCount(0);
    const boxBottom = await box.boundingBox().then(rect => rect!.y + rect!.height), mobileTop = await page.locator("#settings-mobile-phone").boundingBox().then(rect => rect!.y);
    expect(mobileTop).toBeGreaterThanOrEqual(boxBottom);
    await page.locator("#settings-mobile-phone").fill("871234567"); await box.getByRole("checkbox", { name: "Email" }).check();
    await noOverflow(page);
    await page.screenshot({ path: `phase2-test-results/settings-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Your choices are saved.")).toBeVisible();
    expect(await stored(user._id)).toMatchObject({ answers: { puckleUpdates: "yes", newsAndOffers: "no", occasionalPersonalContact: "yes", guidedMathsInvitations: "no" }, channels: { email: true, sms: true }, source: "account-settings" });
    expect((await db.collection("puckleMemberships").findOne({ userId: user._id }))!.mobile).toBe("+353871234567");
    // Saved choices come back pre-populated, and opting out persists.
    await page.reload();
    await expect(group(page, "New maths content").getByRole("radio", { name: "Yes" })).toBeChecked(); await expect(group(page, "News and offers").getByRole("radio", { name: "No" })).toBeChecked();
    await expect(section(page).getByRole("checkbox", { name: "Email" })).toBeChecked(); await expect(page.locator("#settings-mobile-phone")).toHaveCount(0);
    await answer(page, "New maths content", "No"); await expect(section(page).getByRole("group", { name: /Receive updates/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Save changes" }).click(); await expect(page.getByText("Your choices are saved.")).toBeVisible();
    expect(await stored(user._id)).toMatchObject({ channels: { email: false, sms: false } });
    await noOverflow(page);
  });
}
test("Settings needs a sign-in, serves teachers their own invitation choice, and the app menu has no Settings on other websites", async ({ browser }) => {
  const out = await (await context(browser, 390)).newPage(); await out.goto(`${origin}/settings`); await out.waitForURL(/\/login/);
  const teacher = await student("teacher"), page = await (await context(browser, 390, teacher.username)).newPage(); await page.goto(`${origin}/settings`);
  await expect(section(page).locator("span[id$='-title']")).toHaveText(["New maths content", "News and offers", "Teacher collaboration invitations", "Occasional personal contact"]);
  const other = await (await context(browser, 390, teacher.username, "switchplay")).newPage(); await other.goto(`${origin}/decks`);
  await other.getByRole("button", { name: "Overview menu" }).click(); await expect(other.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await expect(other.getByRole("menuitem", { name: "Settings" })).toHaveCount(0);
  const publicMenu = await (await context(browser, 390)).newPage(); await publicMenu.goto(`${origin}/contact`); await publicMenu.getByRole("button", { name: "Open menu" }).click();
  await expect(publicMenu.getByRole("link", { name: "Settings" })).toHaveCount(0);
});

async function interestByEmail(page: Page, email: string) {
  await page.getByRole("radio", { name: "I'm interested in Puckle" }).check();
  await page.getByLabel("Your name").fill(unique("Manage")); await page.getByLabel("Email", { exact: false }).first().fill(email);
  const join = page.locator('[data-preferences="join"]');
  await join.getByRole("radiogroup", { name: "Puckle Updates" }).getByRole("radio", { name: "Yes" }).check();
  for (const title of ["News and offers", "Occasional personal contact"]) await join.getByRole("radiogroup", { name: title }).getByRole("radio", { name: "No" }).check();
  await join.getByRole("checkbox", { name: "Email" }).check();
  await page.locator("button[type=submit]").click();
}
test("an email sign-up gets a signed link to change or unsubscribe without an account", async ({ browser }) => {
  const email = `${unique("link").toLowerCase()}@example.invalid`, usersBefore = await db.collection("users").countDocuments();
  const page = await (await context(browser, 390)).newPage(); await page.goto(`${origin}/join`);
  await interestByEmail(page, email);
  const link = page.getByRole("link", { name: "change or unsubscribe from your choices" });
  await expect(link).toBeVisible(); expect(await link.getAttribute("href")).toMatch(/^\/preferences\/manage#[0-9a-f]{24}\.[0-9a-f]{64}$/);
  await link.click(); await page.waitForURL(`${origin}/preferences/manage`);
  expect(new URL(page.url()).hash, "the token is removed from the address bar").toBe("");
  const manage = page.locator('[data-preferences="manage"]'); await expect(manage).toBeVisible();
  await expect(manage.getByRole("radiogroup", { name: "Puckle Updates" }).getByRole("radio", { name: "Yes" })).toBeChecked();
  await expect(manage.getByRole("checkbox", { name: "Email" })).toBeChecked();
  await manage.getByRole("radiogroup", { name: "News and offers" }).getByRole("radio", { name: "Yes" }).check(); await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your choices are saved.")).toBeVisible();
  const row = async () => (await db.collection("puckleInterestContacts").findOne({ email }))!;
  expect((await row()).communicationPreferences).toMatchObject({ answers: { puckleUpdates: "yes", newsAndOffers: "yes" }, source: "preferences-link" });
  await page.getByRole("button", { name: "Unsubscribe from everything" }).click(); await expect(page.getByText("Your choices are saved.")).toBeVisible();
  expect((await row()).communicationPreferences).toMatchObject({ answers: { puckleUpdates: "no", newsAndOffers: "no", occasionalPersonalContact: "no" }, channels: { email: false, sms: false } });
  expect(await db.collection("users").countDocuments()).toBe(usersBefore); await noOverflow(page);
  await page.screenshot({ path: "phase2-test-results/manage-390.png", fullPage: true });
});
test("an altered or missing link shows a clear message and reveals nothing", async ({ browser }) => {
  const page = await (await context(browser, 390)).newPage();
  for (const hash of ["", "#nonsense", `#${"a".repeat(24)}.${"b".repeat(64)}`]) {
    await page.goto(`${origin}/preferences/manage${hash}`);
    await expect(page.getByText("This link isn't valid.")).toBeVisible(); await expect(page.locator('[data-preferences="manage"]')).toHaveCount(0);
  }
});
test("mobile-only sign-ups are told to text Puckle to change or withdraw their choices", async ({ browser }) => {
  const text = /text Puckle on \+353 85 207 6241 \(Ireland\) or \+44 7547 196642 \(UK\)/;
  const interest = await (await context(browser, 390)).newPage(); await interest.goto(`${origin}/join`);
  await interest.getByRole("radio", { name: "I'm interested in Puckle" }).check(); await interest.getByLabel("Your name").fill(unique("Text"));
  await interest.getByRole("button", { name: "Don't have an email address?" }).click(); await interest.locator("#join-phone").fill("871234569");
  for (const radio of await interest.locator('[data-preferences="join"] input[type=radio][value=no]').all()) await radio.check();
  await interest.locator("button[type=submit]").click(); await expect(interest.getByRole("heading", { name: "You're on the list." })).toBeVisible();
  await expect(interest.getByText(text)).toBeVisible(); await expect(interest.getByRole("link", { name: /unsubscribe/i })).toHaveCount(0);
  const request = await (await context(browser, 390)).newPage(); await request.goto(`${origin}/join`);
  await request.getByLabel("First name").fill(unique("Req")); await request.getByRole("button", { name: "Don't have an email address?" }).click();
  await request.locator("#join-dobDay").fill("3"); await request.locator("#join-dobMonth").fill("3"); await request.locator("#join-dobYear").fill(String(new Date().getFullYear() - 16)); await request.locator("#join-course").selectOption("a-level");
  await request.locator("#join-phone").fill("871234568");
  for (const radio of await request.locator('[data-preferences="join"] input[type=radio][value=no]').all()) await radio.check();
  await request.locator("button[type=submit]").click(); await expect(request.getByRole("heading", { name: "Thanks, we have your details." })).toBeVisible();
  await expect(request.getByText(text)).toBeVisible();
});
