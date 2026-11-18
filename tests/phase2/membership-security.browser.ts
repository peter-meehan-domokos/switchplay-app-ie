import { test, expect } from "@playwright/test";
import { MongoClient } from "mongodb";
import { SignJWT } from "jose";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { prepareAccountCredentials, insertAccount } from "../../src/lib/auth";
import { withMongoTransaction } from "../../src/lib/mongodb";
const origin = process.env.PHASE2_BASE_URL!;
const headers = { Origin: origin };
async function database() {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  return { client, db: client.db(process.env.MONGODB_DB) };
}
async function emails() { return await fetch(`${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/emails`).then(r => r.json()) as { to: string[]; text: string }[]; }
test("existing auth responses, legacy cookies and recovery work in all three site contexts", async ({ playwright }) => {
  for (const site of ["puckle", "switchplay", "strat17"]) {
    const request = await playwright.request.newContext({ baseURL: origin, storageState: { cookies: [{ name: "site", value: site, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
    const missing = await request.post("/api/auth/login", { data: {} }); expect(missing.status()).toBe(400); expect(await missing.json()).toEqual({ error: "Username/email and password are required." });
    const invalid = await request.post("/api/auth/login", { data: { identifier: "phase2", password: "wrong" } }); expect(invalid.status()).toBe(401); expect(await invalid.json()).toEqual({ error: "Invalid login details." });
    const malformed = await request.post("/api/auth/login", { data: "{" }); expect(malformed.status()).toBe(400);
    for (const identifier of ["phase2", " PHASE2-0@EXAMPLE.INVALID "]) {
      const login = await request.post("/api/auth/login", { data: { identifier, password: "local-test-only" } }); expect(login.status()).toBe(200);
      expect(Object.keys((await login.json()).user).sort()).toEqual(["createdAt", "email", "id", "isAdmin", "updatedAt", "username"]);
      const cookie = login.headers()["set-cookie"]; expect(cookie).toContain("switchplay_session="); expect(cookie).toMatch(/HttpOnly/i); expect(cookie).toMatch(/SameSite=lax/i); expect(cookie).toMatch(/Max-Age=2592000/i);
      expect((await request.get("/api/auth/me")).status()).toBe(200);
      await request.post("/api/auth/logout"); expect((await request.get("/api/auth/me")).status()).toBe(401);
    }
    await request.dispose();
  }
});
test("verification HTTP proves email without creating a membership and denies cross-origin requests", async ({ request }) => {
  const { client, db } = await database();
  try {
    const before = await db.collection("users").countDocuments();
    expect((await request.post("/api/auth/email-verification", { headers: { Origin: "https://untrusted.invalid" }, data: { action: "request", email: "verify@example.invalid" } })).status()).toBe(400);
    const sent = await request.post("/api/auth/email-verification", { headers, data: { action: "request", email: "verify@example.invalid" } }); expect(sent.status()).toBe(200);
    const binding = await sent.json(), message = (await emails()).find(x => x.to.includes("verify@example.invalid"))!;
    const code = message.text.match(/\b\d{6}\b/)![0];
    const verified = await request.post("/api/auth/email-verification", { headers, data: { action: "verify", ...binding, email: "verify@example.invalid", code } }); expect(verified.status()).toBe(200); expect((await verified.json()).proof).toHaveLength(43);
    expect(await db.collection("users").countDocuments()).toBe(before); expect(await db.collection("puckleMemberships").countDocuments()).toBe(0);
  } finally { await client.close(); }
});
test("isolated action tabs remove fragments, require explicit reset and preserve unrelated session", async ({ browser, request }) => {
  const { client, db } = await database();
  const context = await browser.newContext();
  const requests: string[] = [], errors: string[] = [];
  context.on("request", r => requests.push(r.url()));
  try {
    await context.request.post(`${origin}/api/auth/login`, { data: { identifier: "other", password: "local-test-only" } });
    // Two links for different users are independent, despite one unrelated signed-in browser.
    const tokens: string[] = [];
    for (const email of ["phase2-0@example.invalid", "phase2-1@example.invalid"]) {
      expect((await request.post("/api/auth/password-reset/request", { headers, data: { email } })).status()).toBe(200);
      tokens.push((await emails()).filter(x => x.to.includes(email)).at(-1)!.text.match(/#([\w-]{43})/)![1]);
    }
    const user = (await db.collection("users").findOne({ username: "phase2" }))!;
    const legacy = await new SignJWT({ email: user.email, username: user.username }).setProtectedHeader({ alg: "HS256" }).setSubject(user._id.toString()).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    expect((await request.get("/api/auth/me", { headers: { Cookie: `switchplay_session=${legacy}` } })).status()).toBe(200);
    const page = await context.newPage(), other = await context.newPage();
    for (const tab of [page, other]) tab.on("console", message => errors.push(message.text()));
    const response = await page.goto(`${origin}/api/account-actions/open#${tokens[0]}`); await other.goto(`${origin}/api/account-actions/open#${tokens[1]}`);
    expect(response!.headers()["cache-control"]).toBe("no-store"); expect(response!.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    await expect(page.locator("#reset")).toBeVisible(); await expect(other.locator("#reset")).toBeVisible();
    expect(page.url()).toBe(`${origin}/api/account-actions/open`); expect(other.url()).toBe(`${origin}/api/account-actions/open`);
    expect((await db.collection("users").findOne({ _id: user._id }))!.passwordHash).toBe(user.passwordHash);
    expect((await context.request.get(`${origin}/api/auth/me`)).status()).toBe(200);
    await page.locator("#password").fill("changed-password"); await page.locator("#confirm").fill("changed-password"); await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByRole("status")).toHaveText("Password changed. You can now sign in.");
    expect((await request.get("/api/auth/me", { headers: { Cookie: `switchplay_session=${legacy}` } })).status()).toBe(401);
    expect((await context.request.get(`${origin}/api/auth/me`)).status()).toBe(200); // Other user remains signed in.
    const preserved = (await db.collection("users").findOne({ _id: user._id }))!;
    expect(preserved.cardsData).toEqual(user.cardsData); expect(preserved.decksData).toEqual(user.decksData); expect(preserved.email).toBe(user.email);
    await expect(other.locator("#reset")).toBeVisible();
    expect((await request.post("/api/account-actions/password-reset", { headers, data: { token: tokens[0], password: "another-password" } })).status()).toBe(400);
    for (const token of tokens) { expect(requests.every(url => !url.includes(token))).toBe(true); expect(errors.join("\n")).not.toContain(token); }
    expect(requests.every(url => url.startsWith(origin))).toBe(true); expect(requests.join("\n")).not.toMatch(/analytics|vercel-insights/);
    await other.reload(); await expect(other.getByRole("status")).toContainText("Reopen the link");
    expect((await request.get("/api/account-actions/password-reset")).status()).toBe(405);
  } finally { await context.close(); await client.close(); }
});
test("a helper-created account opens personal learning without a Puckle profile; recovery request UI works", async ({ page, context }) => {
  const { client, db } = await database();
  try {
    const prepared = await prepareAccountCredentials({ username: "FreshUser", email: "fresh@example.invalid", password: "fresh-password" });
    await withMongoTransaction(client, session => insertAccount(db, session, prepared, new Date()));
    await context.addCookies([{ name: "switchplay_session", value: prepared.sessionToken, url: origin, httpOnly: true, sameSite: "Lax" }]);
    const response = await page.goto("/decks"); expect(response!.status()).toBe(200); await expect(page.locator("body")).not.toContainText("NEW_MODEL_USER_REQUIRED");
    const me = await context.request.get(`${origin}/api/auth/me`); expect((await me.json()).user.username).toBe("FreshUser");
    await page.goto("/login/forgot-password"); await page.getByLabel("Email").fill("absent@example.invalid"); await page.getByRole("button", { name: "Request reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account uses that email");
  } finally { await client.close(); }
});
for (const site of ["puckle", "switchplay", "strat17"]) test(`password recovery completes in ${site} context without a membership`, async ({ playwright }) => {
  const { client, db } = await database();
  const request = await playwright.request.newContext({ baseURL: origin, storageState: { cookies: [{ name: "site", value: site, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
  try {
    const prepared = await prepareAccountCredentials({ username: `Recovery_${site}`, email: `${site}@example.invalid`, password: "before-password" });
    await withMongoTransaction(client, session => insertAccount(db, session, prepared, new Date()));
    const login = await request.post("/api/auth/login", { data: { identifier: prepared.user.username, password: "before-password" } }); expect(login.status()).toBe(200);
    const reset = await request.post("/api/auth/password-reset/request", { headers, data: { email: prepared.user.email } }); expect(reset.status()).toBe(200);
    const token = (await emails()).filter(x => x.to.includes(prepared.user.email)).at(-1)!.text.match(/#([\w-]{43})/)![1];
    expect((await request.post("/api/account-actions/password-reset", { headers, data: { token, password: "after-password" } })).status()).toBe(200);
    expect((await request.get("/api/auth/me")).status()).toBe(401);
    expect((await request.post("/api/auth/login", { data: { identifier: prepared.user.username, password: "after-password" } })).status()).toBe(200);
  } finally { await request.dispose(); await client.close(); }
});
