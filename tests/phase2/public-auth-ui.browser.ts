import { test, expect, type Browser } from "@playwright/test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

// Public website menu Sign out, "Sign in" wording and Show password on the sign-in form. Mode independent.
const origin = process.env.PHASE2_BASE_URL!;
let client: MongoClient, db: Db, counter = 0;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); db = client.db(process.env.MONGODB_DB); });
test.afterAll(async () => { await client?.close(); });
async function user() {
  const _id = new ObjectId(), username = `Menu${Date.now().toString(36)}${++counter}`, now = new Date();
  await db.collection("users").insertOne({ _id, email: `${username.toLowerCase()}@example.invalid`, username, passwordHash: await bcrypt.hash("local-test-only", 4), cardsData: [], decksData: [], sharedDeckData: [], permissions: { publicPublishing: false }, createdAt: now, updatedAt: now });
  return username;
}
async function context(browser: Browser, site: string, width: number, login?: string) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 600, extraHTTPHeaders: { "x-forwarded-for": `10.8.${counter % 250}.${Math.floor(Math.random() * 250)}` },
    storageState: { cookies: [{ name: "site", value: site, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
  if (login) expect((await ctx.request.post(`${origin}/api/auth/login`, { data: { identifier: login, password: "local-test-only" } })).status()).toBe(200);
  return ctx;
}
const noOverflow = async (page: import("@playwright/test").Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

for (const [site, width] of [["puckle", 390], ["puckle", 1280], ["switchplay", 390], ["strat17", 1280]] as const) {
  test(`${site} public menu at ${width}px: Sign in when signed out, Sign out when signed in, and back again afterwards`, async ({ browser }) => {
    const out = await context(browser, site, width), visitor = await out.newPage(); await visitor.goto(`${origin}/contact`);
    const burger = visitor.getByRole("button", { name: "Open menu" });
    if (site === "puckle" && width < 760) await burger.click();
    const nav = visitor.getByRole("navigation", { name: "Public navigation" });
    await expect(nav.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login");
    await expect(visitor.getByText("Log in", { exact: false })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    await out.close();

    const ctx = await context(browser, site, width, await user()), page = await ctx.newPage(); await page.goto(`${origin}/contact`);
    if (site === "puckle" && width < 760) await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("navigation", { name: "Public navigation" });
    await expect(menu.getByRole("link", { name: "Open App", exact: true })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
    await noOverflow(page);
    await menu.getByRole("button", { name: "Sign out" }).click();
    await expect.poll(async () => (await ctx.request.get(`${origin}/api/auth/me`)).status()).toBe(401);
    if (site === "puckle" && width < 760) await page.getByRole("button", { name: "Open menu" }).click();
    await expect(menu.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Open App", exact: true })).toHaveCount(0);
    await ctx.close();
  });
}

test("the sign-in form can show and hide the password, keeps what was typed, and fits a phone", async ({ browser }) => {
  const ctx = await context(browser, "puckle", 390), page = await ctx.newPage(); await page.goto(`${origin}/login`);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  const field = page.getByLabel("Password", { exact: true }), toggle = page.getByRole("checkbox", { name: "Show password" });
  await expect(field).toHaveAttribute("type", "password"); await expect(toggle).not.toBeChecked();
  await page.getByLabel("Username or email").fill("someone"); await field.fill("a secret passphrase");
  await toggle.check(); await expect(field).toHaveAttribute("type", "text"); await expect(field).toHaveValue("a secret passphrase");
  await toggle.uncheck(); await expect(field).toHaveAttribute("type", "password"); await expect(field).toHaveValue("a secret passphrase");
  await expect(page.getByLabel("Username or email")).toHaveValue("someone");
  const box = (await toggle.boundingBox())!; expect(box.width).toBeLessThan(40); // not stretched like a text field
  const label = (await page.locator(".auth-show-password").boundingBox())!; expect(label.x).toBeGreaterThanOrEqual(0); expect(label.x + label.width).toBeLessThanOrEqual(390.5);
  await noOverflow(page);
  // Signing in is unchanged.
  const name = await user(); await page.getByLabel("Username or email").fill(name); await field.fill("local-test-only"); await toggle.check();
  await page.getByRole("button", { name: "Sign in" }).click(); await expect.poll(async () => (await ctx.request.get(`${origin}/api/auth/me`)).status()).toBe(200);
  await ctx.close();
});

test("the embedded sign-in on My Decks has the same Show password option", async ({ browser }) => {
  const ctx = await context(browser, "strat17", 390), page = await ctx.newPage(); await page.goto(`${origin}/decks`);
  await page.getByLabel("Password", { exact: true }).fill("x"); await page.getByRole("checkbox", { name: "Show password" }).check();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text"); await noOverflow(page); await ctx.close();
});
