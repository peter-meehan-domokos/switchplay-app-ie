import { test, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

const origin = process.env.PHASE2_BASE_URL!;
let client: MongoClient, db: Db, counter = 0;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); db = client.db(process.env.MONGODB_DB); });
test.afterAll(async () => { await client?.close(); });
const year = new Date().getFullYear();
const unique = (tag: string) => `${tag}${Date.now().toString(36)}${++counter}`;
async function outbox() { return await fetch(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/emails`).then(r => r.json()) as { to: string[]; text: string }[]; }
async function codeFor(address: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) { const found = (await outbox()).filter(m => m.to.includes(address) && /\b\d{6}\b/.test(m.text)).at(-1); if (found) return found.text.match(/\b\d{6}\b/)![0]; await new Promise(r => setTimeout(r, 200)); }
  throw new Error("no code");
}
async function context(browser: Browser, options: { login?: string; password?: string; reducedMotion?: "reduce" | "no-preference" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: "en-IE", reducedMotion: options.reducedMotion, extraHTTPHeaders: { "x-forwarded-for": `10.7.${counter % 250}.${Math.floor(Math.random() * 250)}` } });
  if (options.login) expect((await ctx.request.post(`${origin}/api/auth/login`, { data: { identifier: options.login, password: options.password ?? "local-test-only" } })).status()).toBe(200);
  return ctx;
}
/** Registers a student through the real form; resolves with the page, at the moment the success is submitted. */
async function registerStudent(browser: Browser, reducedMotion?: "reduce") {
  const phases: { phase: string; animation: string; at: number }[] = [];
  const ctx = await context(browser, { reducedMotion }), page = await ctx.newPage(), email = `${unique("welcome")}@example.invalid`;
  await page.goto(`${origin}/join`);
  await page.getByLabel("First name").fill("Ada"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Choose a username").fill(unique("Wel")); await page.getByLabel("Choose a password").fill("a perfectly good passphrase");
  await page.locator("#join-dobDay").fill("14"); await page.locator("#join-dobMonth").fill("6"); await page.locator("#join-dobYear").fill(String(year - 17));
  await page.locator("#join-course").selectOption("gcse"); await page.locator("#join-level").selectOption("higher-tier");
  await page.locator("button[type=submit]").click(); await page.locator("#join-code").fill(await codeFor(email));
  // Phase changes are reported to Node by a binding that survives the final navigation to My Decks.
  await page.exposeFunction("__reportPhase", (phase: string, animation: string) => { phases.push({ phase, animation, at: Date.now() }); });
  await page.evaluate(() => {
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="registration-welcome"]'); if (!el) return;
      const phase = el.getAttribute("data-phase")!, card = el.querySelector("[role=status]")!;
      if ((window as unknown as { __last?: string }).__last !== phase) { (window as unknown as { __last?: string }).__last = phase; (window as unknown as { __reportPhase: (p: string, a: string) => void }).__reportPhase(phase, getComputedStyle(card).animationName); }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-phase"] });
  });
  const navigations: number[] = []; page.on("framenavigated", frame => { if (frame === page.mainFrame() && new URL(frame.url()).pathname === "/decks") navigations.push(Date.now()); });
  await page.locator("button[type=submit]").click();
  return { page, navigations, email, phases };
}
const overlay = (page: Page) => page.getByTestId("registration-welcome");

test("registration welcome: fades in, stays readable ~5 s over a covered page, fades out, and only then opens My Decks", async ({ browser }) => {
  const { page, navigations, phases } = await registerStudent(browser);
  await expect(overlay(page)).toBeVisible(); const shown = Date.now();
  await expect(overlay(page).getByRole("heading", { name: "Welcome to Puckle!" })).toBeVisible();
  // Entrance is an animation, and the Join page behind it is covered completely (no header or form peeking through).
  expect(await overlay(page).evaluate(el => getComputedStyle(el).animationName)).toMatch(/welcomeIn$/);
  expect(await page.evaluate(() => { const el = document.elementFromPoint(195, 40); return !!el?.closest('[data-testid="registration-welcome"]'); })).toBe(true);
  await page.waitForTimeout(1500); await expect(overlay(page)).toHaveAttribute("data-phase", "hold"); expect(await overlay(page).locator("[role=status]").evaluate(el => getComputedStyle(el).opacity)).toBe("1");
  await page.waitForTimeout(2500); // ~4.5 s after it appeared: still readable, My Decks has not been revealed
  await expect(overlay(page)).toHaveAttribute("data-phase", "hold"); expect(navigations).toEqual([]); expect(new URL(page.url()).pathname).toBe("/join");
  await page.waitForURL(`${origin}/decks`); const total = navigations[0] - shown;
  expect(total).toBeGreaterThan(5400); expect(total).toBeLessThan(8500);
  expect(phases.map(entry => entry.phase)).toEqual(["enter", "hold", "exit"]);
  const [enter, hold, exit] = phases; expect(enter.animation).toMatch(/cardIn$/); expect(exit.animation).toMatch(/cardOut$/);
  expect(hold.at - enter.at).toBeGreaterThan(400); expect(hold.at - enter.at).toBeLessThan(900); // entrance ~0.5 s
  expect(exit.at - hold.at).toBeGreaterThan(4800); expect(exit.at - hold.at).toBeLessThan(5500); // fully readable ~5 s
  expect(navigations[0]).toBeGreaterThan(exit.at + 400); // My Decks opens only after the exit animation has run
  expect((await page.request.get(`${origin}/api/auth/me`)).status()).toBe(200);
});
test("reduced motion: no animation at all, but the message still stays about five seconds", async ({ browser }) => {
  const { page, navigations, phases } = await registerStudent(browser, "reduce");
  await expect(overlay(page)).toBeVisible(); const shown = Date.now();
  expect(await overlay(page).evaluate(el => getComputedStyle(el).animationName)).toBe("none"); expect(await overlay(page).locator("[role=status]").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await page.waitForTimeout(4000); expect(navigations).toEqual([]);
  await page.waitForURL(`${origin}/decks`); const total = navigations[0] - shown; expect(total).toBeGreaterThan(4700); expect(total).toBeLessThan(7000);
  expect(phases.every(entry => entry.animation === "none")).toBe(true); expect(phases.at(-1)!.phase).toBe("exit"); expect(navigations[0] - phases.at(-1)!.at).toBeLessThan(900); // no exit animation to wait for
});
test("Open Puckle skips the wait; ordinary sign-ins never show the registration welcome", async ({ browser }) => {
  const { page, email } = await registerStudent(browser); await expect(overlay(page)).toBeVisible();
  const started = Date.now(); await overlay(page).getByRole("link", { name: "Open Puckle" }).click(); await page.waitForURL(`${origin}/decks`); expect(Date.now() - started).toBeLessThan(4000);
  const user = (await db.collection("users").findOne({ email }))!;
  const again = await (await context(browser, { login: user.username as string, password: "a perfectly good passphrase" })).newPage(); // plain sign-in then /decks
  await again.goto(`${origin}/decks`); await again.waitForTimeout(1200); await expect(overlay(again)).toHaveCount(0); expect(new URL(again.url()).pathname).toBe("/decks");
});

async function account(options: { dob?: string; eligible?: boolean; approval?: Record<string, unknown> } = {}) {
  const _id = new ObjectId(), username = unique("Rem"), now = new Date();
  await db.collection("users").insertOne({ _id, email: `${username.toLowerCase()}@example.invalid`, username, passwordHash: await bcrypt.hash("local-test-only", 4), cardsData: [], decksData: [], sharedDeckData: [], permissions: { publicPublishing: false },
    safeguarding: { dateOfBirth: options.dob ?? `${year - 14}-01-01`, dobSource: "self-declared", dobRecordedAt: now, ageAssurance: { verification: "none" }, ...(options.approval ? { groupExperienceApproval: { scopeId: "shared-group-experiences", generation: 1, explanation: { version: "v", text: "t" }, history: [], ...options.approval } } : {}) }, createdAt: now, updatedAt: now });
  await db.collection("puckleMemberships").insertOne({ userId: _id, name: "Niamh", registrationCategory: "student", mobile: null, initialRegistrationSource: "join", welcome: { eligible: options.eligible ?? false }, createdAt: now, updatedAt: now });
  return { _id, username };
}
const declined = () => account({ approval: { status: "declined", guardianEmail: "g@example.invalid" } });
const reminder = (page: Page) => page.locator('[data-onboarding="reminder"]');
const refocus = async (page: Page) => { await page.waitForTimeout(500); await page.evaluate(() => { window.dispatchEvent(new Event("blur")); window.dispatchEvent(new Event("focus")); }); };

test("reminder dismissal lasts the browser session, per account: survives reload and navigation, not a new session, not another account", async ({ browser }) => {
  const a = await declined(), b = await declined(), ctx = await context(browser, { login: a.username }), page = await ctx.newPage();
  await page.goto(`${origin}/library`); await expect(reminder(page)).toBeVisible();
  await reminder(page).getByRole("button", { name: "Dismiss" }).click(); await expect(reminder(page)).toHaveCount(0);
  await page.reload(); await page.waitForTimeout(1500); await expect(reminder(page)).toHaveCount(0);
  await page.goto(`${origin}/decks`); await page.waitForTimeout(1500); await expect(reminder(page)).toHaveCount(0);
  await refocus(page); await page.waitForTimeout(800); await expect(reminder(page)).toHaveCount(0);
  // Another account in the same browser session is unaffected by A's dismissal.
  await ctx.request.post(`${origin}/api/auth/login`, { data: { identifier: b.username, password: "local-test-only" } }); await page.reload(); await expect(reminder(page)).toBeVisible();
  // ...and back to A: still dismissed for this session.
  await ctx.request.post(`${origin}/api/auth/login`, { data: { identifier: a.username, password: "local-test-only" } }); await page.reload(); await page.waitForTimeout(1500); await expect(reminder(page)).toHaveCount(0);
  // A later browser session (new context = new session storage): the outstanding reminder returns; nothing was permanently dismissed.
  const later = await (await context(browser, { login: a.username })).newPage(); await later.goto(`${origin}/library`); await expect(reminder(later)).toBeVisible();
  expect(await db.collection("users").findOne({ _id: a._id }, { projection: { onboarding: 1 } })).not.toHaveProperty("onboarding");
});

test("explicit sign-in and sign-out are new sessions: an eligible student gets the full welcome, never the small button", async ({ browser }) => {
  const first = await account({ eligible: true }), second = await account({ eligible: true }), ctx = await context(browser), page = await ctx.newPage();
  await page.goto(`${origin}/decks`); await page.mouse.click(180, 400); await page.keyboard.press("Tab"); // plenty of outside interaction before signing in
  await page.getByLabel("Username or email").fill(first.username); await page.getByLabel("Password").fill("local-test-only"); await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator('[data-onboarding="welcome"]')).toBeVisible(); await expect(page.locator('[data-onboarding="pill"]')).toHaveCount(0);
  await page.locator('[data-onboarding="welcome"]').getByRole("button", { name: "Explore Puckle" }).click();
  await page.mouse.click(180, 300); // interaction in the first session, then sign out and a different student signs in on the same URL
  await ctx.request.post(`${origin}/api/auth/logout`); await page.evaluate(() => window.dispatchEvent(new CustomEvent("switchplay:auth-changed"))); await page.waitForTimeout(600);
  await expect(page.locator("[data-onboarding] ")).toHaveCount(0);
  await ctx.request.post(`${origin}/api/auth/login`, { data: { identifier: second.username, password: "local-test-only" } }); await page.evaluate(() => window.dispatchEvent(new CustomEvent("switchplay:auth-changed")));
  await expect(page.locator('[data-onboarding="welcome"]')).toBeVisible(); await expect(page.locator('[data-onboarding="pill"]')).toHaveCount(0);
});
