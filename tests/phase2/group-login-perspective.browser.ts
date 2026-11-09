import { expect, test, type Page } from "@playwright/test";
const group = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null");
test.skip(!group, "Requires disposable Group fixture");
async function signIn(page: Page, identifier: string) {
  await page.getByLabel("Username or email").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill("local-test-only");
  const response = page.waitForResponse(value => value.url().includes("/api/auth/login") && value.request().method() === "POST");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await response).ok()).toBeTruthy();
  await page.waitForFunction(() => sessionStorage.getItem("switchplay-group-login") !== null);
}
for (const engine of ["chromium", "webkit"] as const) for (const admin of [true, false]) {
 test(`${engine}: fresh ${admin ? "Admin" : "follower"} login starts primary view and preserves later session selection`, async ({ playwright }) => {
  const browser = await playwright[engine].launch();
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), actor = admin ? group.adminId : group.otherId, identifier = admin ? "phase2" : "Aoife Kelly";
  try {
   expect((await context.request.post("/api/auth/login", { data: { identifier, password: "local-test-only" } })).ok()).toBeTruthy();
   if (process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
   const current = await (await context.request.get(`/api/group-experiences/${group.experienceId}`)).json();
   expect((await context.request.patch(`/api/group-experiences/${group.experienceId}/navigation`, { data: { accessEpoch: current.accessEpoch,
    expectedStructureRevision: current.structureRevision, selection: admin ? { perspective: "follower", subjectUserId: group.otherId } : { perspective: "group" } } })).ok()).toBeTruthy();
   await context.request.post("/api/auth/logout");
   if (engine === "webkit" && process.env.PHASE2_OPTIMIZED === "1") {
    // WebKit rejects Secure Set-Cookie over HTTP loopback. Adapt only this
    // disposable response transport; deployed HTTPS cookies stay unchanged.
    await page.route("**/api/auth/login", async route => {
     const response = await route.fetch(), headers = response.headers();
     const cookie = headers["set-cookie"]?.match(/^([^=]+)=([^;]+)/);
     if (cookie) {
      await context.addCookies([{ name: cookie[1], value: cookie[2], url: process.env.PHASE2_BASE_URL!, httpOnly: true, sameSite: "Lax", secure: false }]);
      delete headers["set-cookie"];
     }
     await route.fulfill({ response, headers });
    });
   }
   // A stale pre-login Progress URL must not restore its previous perspective.
   await page.goto(`/decks?openExperience=${group.experienceId}&progressScene=1&progressPerspective=${admin ? "follower" : "group"}${admin ? `&progressSubject=${group.otherId}` : ""}`);
   await signIn(page, identifier);
   const scene = page.locator(".group-experience"), primary = admin ? "group" : actor;
   await expect(scene).toHaveAttribute("data-perspective-key", primary);
   await expect(page.locator(".deck-card.is-active")).toBeVisible();
   await page.waitForTimeout(4500); // Include a normal refresh, not just first paint.
   await expect(scene).toHaveAttribute("data-perspective-key", primary);
   await page.reload();
   await expect(scene).toHaveAttribute("data-perspective-key", primary);
   await page.locator(".group-picker-current").click();
   if (admin) await page.getByRole("button", { name: "All followers", exact: true }).click();
   await page.locator(`.group-perspective-list [data-perspective-key="${admin ? group.otherId : "group"}"]`).click();
   const chosen = admin ? group.otherId : "group";
   await expect(scene).toHaveAttribute("data-perspective-key", chosen);
   await page.getByRole("button", { name: "Back to My Decks", exact: true }).click();
   await page.locator(`[data-collection-item-id="${group.experienceId}"] .deck-tile-open-action`).click();
   await expect(scene).toHaveAttribute("data-perspective-key", chosen);
   await context.request.post("/api/auth/logout"); await page.reload();
   await signIn(page, identifier);
   await expect(scene).toHaveAttribute("data-perspective-key", primary);
  } finally { await context.close(); await browser.close(); }
 });
}
