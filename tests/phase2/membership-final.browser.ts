import { test, expect } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { cardFixture, deckFixture } from "../fixtures/frameworks";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const db = () => client.db(process.env.MONGODB_DB);

for (const failChunk of [false, true]) test(`welcome is acknowledged only after its view renders (chunk ${failChunk ? "fails" : "is delayed"})`, async ({ browser }) => {
  const _id = new ObjectId(), now = new Date(), username = `final-${_id}`;
  await db().collection("users").insertOne({ _id, username, email: `${username}@example.invalid`, passwordHash: await bcrypt.hash("local-test-only", 4),
    cardsData: [], decksData: [], permissions: { publicPublishing: false }, createdAt: now, updatedAt: now });
  await db().collection("puckleMemberships").insertOne({ userId: _id, name: "Final check", registrationCategory: "student", welcome: { eligible: true }, createdAt: now, updatedAt: now });
  const ctx = await browser.newContext(), page = await ctx.newPage();
  expect((await ctx.request.post(`${process.env.PHASE2_BASE_URL}/api/auth/login`, { data: { identifier: username, password: "local-test-only" } })).status()).toBe(200);
  let release!: () => void, held = false, statusLoaded = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  page.on("response", response => { if (response.url().endsWith("/api/account/onboarding") && response.request().method() === "GET") statusLoaded = true; });
  await page.route("**/_next/static/**/*.js*", async route => {
    const response = await route.fetch();
    const code = await response.text();
    // Identify the lazy view by its rendered input ID, in dev and minified production chunks.
    if (code.includes("onboarding-guardian")) {
      held = true; await gate;
      if (failChunk) return route.abort();
    }
    await route.fulfill({ response });
  });
  const seen = async () => (await db().collection("puckleMemberships").findOne({ userId: _id }))!.welcome.seenAt;
  try {
    await page.goto("/decks", { waitUntil: "domcontentloaded" });
    await expect.poll(() => held && statusLoaded).toBe(true);
    await page.waitForTimeout(600); // allow the host effects to run while the view is unavailable
    expect(await seen()).toBeUndefined();
    await expect(page.locator('[data-onboarding="welcome"]')).toHaveCount(0);
    release();
    if (failChunk) {
      await page.waitForTimeout(800);
      await expect(page.locator('[data-onboarding="welcome"]')).toHaveCount(0);
      expect(await seen()).toBeUndefined();
      await page.getByRole("button", { name: "Overview menu" }).click();
      await expect(page.getByRole("menuitem", { name: "Progress", exact: true })).toBeVisible();
    } else {
      await expect(page.locator('[data-onboarding="welcome"]')).toBeVisible();
      await expect.poll(seen).toBeTruthy();
    }
  } finally { release(); await ctx.close(); }
});

test("public static pages and own-account responses retain their production cache boundaries", async ({ request, page }) => {
  const visual = await request.get("/step-visuals");
  expect(visual.status()).toBe(200);
  if (process.env.NODE_ENV === "production") {
    expect(visual.headers()["x-nextjs-cache"]).toBe("HIT");
    expect(visual.headers()["cache-control"]).toContain("s-maxage");
  }
  for (const path of ["/", "/contact", "/privacy"]) {
    const publicPage = await request.get(path);
    expect(publicPage.status()).toBe(200);
    expect(publicPage.headers()["cache-control"]).toContain("no-store");
  }
  expect((await request.get("/api/account/onboarding")).status()).toBe(401);
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto("/step-visuals");
  // Chromium accepts Secure cookies on loopback; Playwright's API-only cookie jar does not.
  // Exercise the browser's actual production cookie without weakening its security flags.
  const status = await page.evaluate(async () => { const r = await fetch("/api/account/onboarding"); return { status: r.status, cache: r.headers.get("cache-control"), vary: r.headers.get("vary") }; });
  expect(status.status).toBe(200);
  expect(status.cache).toBe("private, no-store");
  expect(status.vary).toContain("Cookie");
  let calls = 0;
  page.on("request", r => { if (r.url().includes("/api/account/onboarding")) calls++; });
  await page.goto("/step-visuals");
  await page.getByRole("heading").first().waitFor();
  await page.mouse.wheel(0, 300); await page.keyboard.press("Tab");
  await page.waitForTimeout(500);
  expect(calls).toBe(0);
});

test("browser login/logout and Secure production sessions work on all three sites without a Puckle profile", async ({ browser }) => {
  const origin = process.env.PHASE2_BASE_URL!;
  for (const site of ["puckle", "switchplay", "strat17"]) {
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "site", value: site, url: origin }]);
    const page = await ctx.newPage();
    try {
      const login = await ctx.request.post(`${origin}/api/auth/login`, { data: { identifier: " PHASE2-0@EXAMPLE.INVALID ", password: "local-test-only" } });
      expect(login.status()).toBe(200);
      if (process.env.NODE_ENV === "production") expect(login.headers()["set-cookie"]).toMatch(/; Secure/i);
      await page.goto(`${origin}/decks`);
      await expect(page.getByRole("heading", { name: "My Decks", exact: true })).toBeVisible();
      expect(await page.evaluate(async () => (await fetch("/api/auth/me")).status)).toBe(200);
      expect(await page.evaluate(async () => (await fetch("/api/auth/logout", { method: "POST" })).status)).toBe(200);
      expect(await page.evaluate(async () => (await fetch("/api/auth/me")).status)).toBe(401);
    } finally { await ctx.close(); }
  }
});

for (const width of [320, 390]) test(`onboarding preserves private learning DOM, progress and swipe/flip at ${width}px`, async ({ browser }) => {
  const _id = new ObjectId(), actor = _id.toHexString(), now = new Date(), username = `learn-${actor}`;
  const card = cardFixture(`card-${actor}`), deck = deckFixture(`deck-${actor}`, [card.root.cardTemplateId]);
  card.root.ownerUserId = deck.root.ownerUserId = actor;
  card.version.publishedByUserId = deck.version.publishedByUserId = actor;
  deck.root.draft!.title = deck.version.content.title = "Final private path";
  await db().collection("users").insertOne({ _id, username, email: `${username}@example.invalid`, passwordHash: await bcrypt.hash("local-test-only", 4),
    cardsData: [card.data], decksData: [deck.data], permissions: { publicPublishing: false }, createdAt: now, updatedAt: now,
    safeguarding: { dateOfBirth: `${now.getFullYear() - 14}-01-01`, dobSource: "self-declared", ageAssurance: { verification: "none" } } });
  await db().collection("puckleMemberships").insertOne({ userId: _id, name: "Learner", registrationCategory: "student", welcome: { eligible: false }, createdAt: now, updatedAt: now });
  await db().collection("cardTemplates").insertOne(card.root); await db().collection("cardTemplateVersions").insertOne(card.version);
  await db().collection("deckTemplates").insertOne(deck.root); await db().collection("deckTemplateVersions").insertOne(deck.version);
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true }), page = await ctx.newPage();
  try {
    await ctx.request.post(`${process.env.PHASE2_BASE_URL}/api/auth/login`, { data: { identifier: username, password: "local-test-only" } });
    let requests = 0;
    page.on("request", request => { if (request.url().includes("/api/account/onboarding")) requests++; });
    await page.goto("/decks");
    const reminder = page.locator('[data-onboarding="reminder"]');
    await expect(reminder).toBeVisible();
    const open = page.getByRole("button", { name: "Open Final private path", exact: true }).last(); await expect(open).toBeVisible();
    const box = (await reminder.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
    const app = await page.locator("main").first().elementHandle();
    await page.evaluate(el => { const probe = window as unknown as { learningMutations: number }; probe.learningMutations = 0;
      new MutationObserver(records => { probe.learningMutations += records.length; }).observe(el!, { subtree: true, attributes: true, childList: true, characterData: true }); }, app);
    await page.getByLabel("Parent or guardian's email").fill("partly.typed@example.invalid");
    await reminder.getByRole("button", { name: "Dismiss" }).click();
    expect(await page.evaluate(() => (window as unknown as { learningMutations: number }).learningMutations)).toBe(0);
    expect(await app!.evaluate(el => el.isConnected)).toBe(true);
    const initialRequests = requests;
    await open.click(); await expect(page.locator(".deck-detail h1")).toHaveText("Final private path");
    await page.locator(".deck-card[role=button]").press("Enter");
    await page.getByRole("button", { name: "Update step progress. Current status: todo", exact: true }).first().click();
    await expect.poll(async () => (await db().collection("users").findOne({ _id }))!.cardsData[0].items[0].completionStatus).toBe("inProgress");
    const title = page.locator(".focused-card-surface--front .card-title-anchor");
    await expect(title).toBeVisible(); await page.waitForTimeout(400); // allow the existing card focus animation to settle
    const rect = (await title.boundingBox())!;
    await page.mouse.move(rect.x + rect.width * 0.25, rect.y + rect.height * 0.5); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.25 + 210, rect.y + rect.height * 0.5, { steps: 12 }); await page.mouse.up();
    await expect(page.getByRole("button", { name: "Add media", exact: true })).toBeVisible();
    expect(requests).toBe(initialRequests);
    expect((await db().collection("users").findOne({ _id }))!.safeguarding.groupExperienceApproval).toBeUndefined();
  } finally { await ctx.close(); }
});
