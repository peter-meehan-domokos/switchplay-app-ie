import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, type Db } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

// Communication preferences on the Join form: approved copy, nothing preselected, conditional channels, inline errors and stored results.
const origin = process.env.PHASE2_BASE_URL!;
let client: MongoClient, db: Db, counter = 0;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); db = client.db(process.env.MONGODB_DB); });
test.afterAll(async () => { await client?.close(); });
const unique = (tag: string) => `${tag}${Date.now().toString(36)}${++counter}`;
const emailOf = (tag: string) => `${unique(tag)}@example.invalid`;
const year = new Date().getFullYear();
async function outbox() { return await fetch(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/emails`).then(r => r.json()) as { to: string[]; subject: string; text: string }[]; }
async function mailTo(address: string, pattern: RegExp, wait = 15_000) {
  const deadline = Date.now() + wait;
  while (Date.now() < deadline) { const found = (await outbox()).filter(m => m.to.includes(address) && pattern.test(m.text)); if (found.length) return found.at(-1)!; await new Promise(r => setTimeout(r, 200)); }
  throw new Error("expected email did not arrive");
}
const codeFor = async (address: string) => (await mailTo(address, /\b\d{6}\b/)).text.match(/\b\d{6}\b/)![0];
async function open(browser: Browser, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 600, locale: "en-IE",
    extraHTTPHeaders: { "x-forwarded-for": `10.13.${++counter % 250}.${Math.floor(Math.random() * 250)}` } });
  const page = await context.newPage(); await page.goto(`${origin}/join`); return page;
}
const section = (page: Page) => page.locator('[data-preferences="join"]');
const submit = (page: Page) => page.locator("button[type=submit]");
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
const group = (page: Page, title: string) => section(page).getByRole("radiogroup", { name: title });
const answer = (page: Page, title: string, value: "Yes" | "No") => group(page, title).getByRole("radio", { name: value }).check();
const titles = async (page: Page) => section(page).locator("span[id$='-title']").allTextContents();
async function fillStudent(page: Page, email: string, username: string) {
  await page.getByLabel("First name").fill("Ada"); await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Choose a username").fill(username); await page.getByLabel("Choose a password").fill("a perfectly good passphrase");
  await page.locator("#join-dobDay").fill("14"); await page.locator("#join-dobMonth").fill("6"); await page.locator("#join-dobYear").fill(String(year - 17));
  await page.locator("#join-course").selectOption("gcse"); await page.locator("#join-level").selectOption("higher-tier");
}

for (const width of [390, 1280]) {
  test(`student registration asks two questions with the approved copy at ${width}px; nothing is preselected`, async ({ browser }) => {
    const page = await open(browser, width);
    await expect(section(page).getByRole("heading", { name: "Stay in touch with Puckle" })).toBeVisible();
    expect(await titles(page)).toEqual(["Puckle Updates", "Occasional personal contact"]);
    for (const line of ["Maths content, group invites and occasional offers", "We may get in touch to offer help or ask for feedback."]) await expect(section(page).getByText(line, { exact: true })).toBeVisible();
    expect(await section(page).locator("input[type=radio]:checked").count()).toBe(0);
    await expect(section(page).getByRole("group", { name: /Receive updates/ })).toHaveCount(0);
    await noOverflow(page);
    for (const row of await section(page).getByRole("radiogroup").all()) { await expect(row.getByText("Yes", { exact: true })).toBeVisible(); await expect(row.getByText("No", { exact: true })).toBeVisible(); }
    const box = await section(page).locator("p", { hasText: "Maths content" }).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: `phase2-test-results/preferences-${width}.png`, fullPage: true });
  });
}
for (const width of [390, 768]) {
  test(`each description reads as one item with its title, never runs under the Yes | No buttons, and wraps after "invites" and "help" only when it must at ${width}px`, async ({ browser }) => {
    const page = await open(browser, width);
    const rows = await section(page).locator("div[class*='row']").evaluateAll(elements => elements.map(row => {
      const title = row.querySelector("span[id$='-title']")!.getBoundingClientRect(), text = row.querySelector("p")!, box = text.getBoundingClientRect(), buttons = row.querySelector("[role='radiogroup']")!.getBoundingClientRect(), rowBox = row.getBoundingClientRect();
      const range = document.createRange(), lines: string[] = []; let last: number | null = null;
      const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT); const marks: [Text, number][] = [];
      for (let current = walker.nextNode() as Text | null; current; current = walker.nextNode() as Text | null) for (let index = 0; index < current.length; index++) marks.push([current, index]);
      for (const [textNode, index] of marks) { range.setStart(textNode, index); range.setEnd(textNode, index + 1); const top = Math.round(range.getBoundingClientRect().top); if (top !== last) { lines.push(""); last = top; } lines[lines.length - 1] += textNode.data[index]; }
      return { lines: lines.map(line => line.trim()), gap: box.top - title.bottom, textRight: box.right, buttonsLeft: buttons.left, buttonsTop: buttons.top - rowBox.top, buttonsRight: rowBox.right - buttons.right };
    }));
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.gap, `${width}px: title and description are grouped`).toBeLessThanOrEqual(8); expect(row.textRight, `${width}px: description stays clear of the buttons`).toBeLessThanOrEqual(row.buttonsLeft);
      expect(row.buttonsRight, `${width}px: buttons stay at the right edge`).toBeLessThanOrEqual(1); expect(row.buttonsTop, `${width}px: buttons stay at the top of the row`).toBeLessThanOrEqual(15.5);
    }
    if (width === 390) {
      expect(rows[0].lines, "Puckle Updates").toEqual(["Maths content, group invites", "and occasional offers"]); expect(rows[1].lines, "Occasional personal contact").toEqual(["We may get in touch to offer help", "or ask for feedback."]);
    } else { expect(rows[0].lines).toHaveLength(1); expect(rows[1].lines).toHaveLength(1); }
    await noOverflow(page); await page.screenshot({ path: `phase2-test-results/preferences-rows-${width}.png`, fullPage: true });
  });
}
test("teachers see their own Puckle Updates wording, interested parties keep their three separate choices", async ({ browser }) => {
  const page = await open(browser);
  await page.getByRole("radio", { name: "I'm a teacher" }).check();
  expect(await titles(page)).toEqual(["Puckle Updates", "Occasional personal contact"]);
  await expect(section(page).getByText("Teaching resources, collaboration opportunities, news and occasional offers.", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "I'm interested in Puckle" }).check();
  expect(await titles(page)).toEqual(["Puckle Updates", "News and offers", "Occasional personal contact"]);
  await answer(page, "Puckle Updates", "Yes");
  await expect(section(page).getByRole("group", { name: "Receive updates by" })).toBeVisible();
  // Interested parties answer for themselves: nothing carries over from the other forms.
  await page.getByRole("radio", { name: "I'm here to learn" }).check();
  await expect(group(page, "Puckle Updates").getByRole("radio", { name: "Yes" })).toBeChecked();
  await page.getByRole("radio", { name: "I'm interested in Puckle" }).check();
  await expect(group(page, "News and offers").locator("input:checked")).toHaveCount(0);
});
test("the channel box follows Puckle Updates, starts unchecked, and personal contact alone never shows it", async ({ browser }) => {
  const page = await open(browser), box = section(page).getByRole("group", { name: "Receive updates and invitations by" });
  await answer(page, "Occasional personal contact", "Yes"); await expect(box).toHaveCount(0);
  await answer(page, "Puckle Updates", "Yes"); await expect(box).toBeVisible();
  await expect(box.getByRole("checkbox", { name: "Email" })).not.toBeChecked(); await expect(box.getByRole("checkbox", { name: "Text message" })).not.toBeChecked();
  await box.getByRole("checkbox", { name: "Email" }).check(); await box.getByRole("checkbox", { name: "Text message" }).check();
  await expect(box.getByRole("checkbox", { name: "Email" })).toBeChecked(); await expect(box.getByRole("checkbox", { name: "Text message" })).toBeChecked();
  await answer(page, "Puckle Updates", "No"); await expect(box).toHaveCount(0);
  await answer(page, "Puckle Updates", "Yes"); await expect(box).toBeVisible();
  await expect(box.getByRole("checkbox", { name: "Email" })).not.toBeChecked(); // hidden choices never linger
  await noOverflow(page);
});
test("unanswered choices and a missing channel or mobile are blocked inline, keeping what was entered; then registration stores the Yes answers", async ({ browser }) => {
  const page = await open(browser), email = emailOf("prefs"), username = unique("Prf");
  await fillStudent(page, email, username);
  await submit(page).click();
  await expect(section(page).getByText("Choose Yes or No.")).toHaveCount(2);
  await expect(group(page, "Puckle Updates").locator("input").first()).toBeFocused();
  await expect(page.getByLabel("First name")).toHaveValue("Ada");
  await answer(page, "Puckle Updates", "Yes"); await answer(page, "Occasional personal contact", "No");
  await submit(page).click();
  await expect(section(page).getByText("Choose email, text message or both.")).toBeVisible();
  const box = section(page).getByRole("group", { name: "Receive updates and invitations by" });
  await expect(box.getByRole("checkbox").first()).toBeFocused();
  await box.getByRole("checkbox", { name: "Text message" }).check(); await submit(page).click();
  await expect(section(page).getByText(/valid mobile number above to receive text messages/)).toBeVisible();
  await box.getByRole("checkbox", { name: "Text message" }).uncheck(); await box.getByRole("checkbox", { name: "Email" }).check();
  await page.locator("#join-phone").fill("871234567"); await box.getByRole("checkbox", { name: "Text message" }).check();
  await submit(page).click(); await expect(page.getByText(email)).toBeVisible();
  await page.locator("#join-code").fill(await codeFor(email)); await submit(page).click(); await page.waitForURL(`${origin}/decks`);
  const user = (await db.collection("users").findOne({ email }))!;
  const membership = (await db.collection("puckleMemberships").findOne({ userId: user._id }))!;
  expect(membership.communicationPreferences).toMatchObject({ answers: { puckleUpdates: "yes", newsAndOffers: "yes", occasionalPersonalContact: "no", guidedMathsInvitations: "yes" },
    channels: { email: true, sms: true }, source: "join-form", wordingVersion: "puckle-communication-preferences-v2" });
  expect(membership.communicationPreferences.recordedAt).toBeInstanceOf(Date);
  await expect.poll(async () => (await outbox()).some(m => m.to.includes("founder@example.invalid") && m.subject.includes("NEW STUDENT") && /Puckle Updates: Yes/.test(m.text) && /Delivery: Email and Text message/.test(m.text))).toBe(true);
});
test("an all-No set is a valid sign-up for a mobile-only contact request, which offers Text but not Email", async ({ browser }) => {
  const page = await open(browser), name = unique("Allno");
  await page.getByLabel("First name").fill(name); await page.getByRole("button", { name: "Don't have an email address?" }).click();
  await page.locator("#join-dobDay").fill("3"); await page.locator("#join-dobMonth").fill("3"); await page.locator("#join-dobYear").fill(String(year - 16)); await page.locator("#join-course").selectOption("a-level");
  await page.locator("#join-phone").fill("871234567");
  await answer(page, "Puckle Updates", "Yes");
  const box = section(page).getByRole("group", { name: "Receive updates and invitations by" });
  await expect(box.getByRole("checkbox", { name: "Email" })).toHaveCount(0); await expect(box.getByRole("checkbox", { name: "Text message" })).toBeVisible();
  await answer(page, "Puckle Updates", "No"); await answer(page, "Occasional personal contact", "No");
  await submit(page).click(); await expect(page.getByRole("heading", { name: "Thanks, we have your details." })).toBeVisible();
  const saved = (await db.collection("puckleJoinContactRequests").findOne({ name }))!;
  expect(saved.communicationPreferences).toMatchObject({ channels: { email: false, sms: false }, answers: { puckleUpdates: "no", newsAndOffers: "no", guidedMathsInvitations: "no", occasionalPersonalContact: "no" } });
});
