import { test, expect } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { applyBackfill, assessAccounts, parseManifest } from "../../src/lib/knownUserBackfill";

// Real server: an account that existed before membership keeps its credentials and sessions on all three
// websites after a reviewed backfill, and is not treated as a newly registered student.
const origin = process.env.PHASE2_BASE_URL!;
test("legacy credentials and sessions survive a reviewed backfill on every website; no welcome appears", async ({ browser }) => {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect(), db = client.db(process.env.MONGODB_DB);
  try {
    const _id = new ObjectId(), username = `Legacy${Date.now().toString(36)}`, now = new Date("2025-02-02");
    await db.collection("users").insertOne({ _id, email: `${username.toLowerCase()}@example.invalid`, username, passwordHash: await bcrypt.hash("legacy-password", 4), cardsData: [{ keep: 1 }], decksData: [{ keep: 2 }], sharedDeckData: [], createdAt: now, updatedAt: now });
    const legacyToken = await new SignJWT({ email: `${username.toLowerCase()}@example.invalid`, username }).setProtectedHeader({ alg: "HS256" }).setSubject(_id.toHexString()).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    const site = (name: string) => ({ cookies: [{ name: "site", value: name, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const }, { name: "switchplay_session", value: legacyToken, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: true, secure: false, sameSite: "Lax" as const }], origins: [] });
    for (const name of ["puckle", "switchplay", "strat17"]) { const ctx = await browser.newContext({ storageState: site(name) }); expect((await ctx.request.get(`${origin}/api/auth/me`)).status()).toBe(200); await ctx.close(); }
    // Every existing account needs a reviewed disposition; here each keeps exactly what it has, and only the target is trusted.
    const draft = await assessAccounts(db);
    const accounts = draft.accounts.map(row => ({ userId: row.userId, publicPublishing: row.userId === _id.toHexString() ? true : row.currentPublicPublishing === true,
      currentPublicPublishing: row.currentPublicPublishing as "missing" | boolean, ...(row.userId === _id.toHexString() ? { puckle: { name: "Lena", registrationCategory: "student" as const } } : {}) }));
    const { manifest, problems } = parseManifest({ manifestId: `browser-${Date.now()}`, reviewedBy: "founder", reviewedAt: new Date().toISOString(), accounts }); expect(problems).toEqual([]);
    await applyBackfill(db, client, manifest);
    for (const name of ["puckle", "switchplay", "strat17"]) {
      const ctx = await browser.newContext({ storageState: site(name) }); expect((await ctx.request.get(`${origin}/api/auth/me`)).status(), `legacy session on ${name}`).toBe(200);
      const fresh = await browser.newContext({ storageState: { cookies: [site(name).cookies[0]], origins: [] } });
      expect((await fresh.request.post(`${origin}/api/auth/login`, { data: { identifier: username, password: "legacy-password" } })).status(), `legacy login on ${name}`).toBe(200);
      await ctx.close(); await fresh.close();
    }
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: site("puckle") })).newPage(); await page.goto(`${origin}/decks`); await page.waitForTimeout(1500);
    await expect(page.locator("[data-onboarding-host] section")).toHaveCount(0); // not a newly registered student
    const saved = (await db.collection("users").findOne({ _id }))!; expect(saved.permissions).toEqual({ publicPublishing: true }); expect(saved.cardsData).toEqual([{ keep: 1 }]);
    expect((await db.collection("puckleMemberships").findOne({ userId: _id }))!.welcome).toEqual({ eligible: false });
  } finally { await client.close(); }
});
