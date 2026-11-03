import { chromium, webkit, expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { GroupExperienceRepository } from "../../src/lib/groupExperiences/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

const live = JSON.parse(process.env.PHASE5_LIVE_PROGRESS ?? "null") as { experienceId: string; frameworkId: string; followers: string[] } | null;
test.skip(!live, "Requires --group-progress-live disposable data");
const groupUrl = () => `/group-experiences/${live!.experienceId}/progress?framework=${live!.frameworkId}`;
const item = (page: Page) => page.locator('tr[data-item-id="review-item-1-1"]');
async function login(page: Page) {
  expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).status()).toBe(200);
}

for (const engine of ["chromium", "webkit"] as const) for (const width of [390, 1280]) {
  test(`review labels, outside styling and interactive account/modal layers: ${engine} ${width}`, async () => {
    const browser = await (engine === "chromium" ? chromium : webkit).launch();
    try {
      const page = await browser.newPage({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width, height: 844 }, hasTouch: true, isMobile: width === 390 });
      await login(page); await page.goto(groupUrl());
      const selector = page.getByLabel("Progress perspective", { exact: true });
      await expect(selector).toHaveValue("group");
      await expect(page.locator(".group-progress-metadata")).toHaveText("Galway U18 · 4 followers");
      await expect(page.getByLabel("Framework", { exact: true }).locator("option:checked")).toHaveText("U18 Movement & Skills");
      expect(await selector.locator("option").allTextContents()).toEqual(["Group", "Aoife Kelly", "Ben O'Connor", "Emma Walsh", "Jack Murphy"]);
      expect(await selector.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(["group", live!.followers[0], live!.followers[3], live!.followers[2], live!.followers[1]]);

      const outside = page.locator('tr[data-item-id="review-outside-item"] .progress-content-title');
      // Browsers may serialize 8-bit alpha as .5 rather than .502. Compare
      // against the exact authored colours through that same browser engine.
      const colors = await page.evaluate(() => {
        const probe = document.createElement("span"); probe.style.position = "fixed"; document.body.append(probe);
        const color = (value: string) => { probe.style.color = value; return getComputedStyle(probe).color; };
        const result = { full: color("#b5bdc9"), half: color("#b5bdc980"), faint: color("#b5bdc928") }; probe.remove(); return result;
      });
      await outside.hover();
      expect(await outside.evaluate(element => { const style = getComputedStyle(element); return { line: style.textDecorationLine, thickness: style.textDecorationThickness, color: style.textDecorationColor }; }))
        .toEqual({ line: "line-through", thickness: "2px", color: colors.full });
      expect(await item(page).locator(".progress-content-title").evaluate(element => getComputedStyle(element).textDecorationLine)).not.toContain("line-through");
      expect(await page.locator('tr[data-area-id="review-outside-area"] .progress-content-title').evaluate(element => getComputedStyle(element).textDecorationLine)).toContain("line-through");
      expect(await page.locator('tr[data-area-id="review-area-1"] .progress-content-title').evaluate(element => getComputedStyle(element).textDecorationLine)).not.toContain("line-through");
      await expect(page.locator('tr[data-item-id="review-outside-item"] td')).toHaveText(["—", "—", "—"]);
      for (const dash of await page.locator('tr[data-item-id="review-outside-item"] .progress-outside').all())
        expect(await dash.evaluate(element => getComputedStyle(element).color)).toBe(colors.faint);
      await selector.selectOption(live!.followers[0]);
      const skipped = page.locator('tr[data-item-id="review-item-3-1"] .progress-skip');
      await expect(skipped).toHaveText("skip");
      expect(await skipped.evaluate(element => getComputedStyle(element).color)).toBe(colors.half);
      await selector.selectOption("group"); await page.evaluate(() => window.scrollTo(0, 0)); await item(page).locator(".progress-tests-trigger").click();
      const modal = page.getByRole("dialog", { name: "Assessment history", exact: true });
      await expect(modal.getByRole("columnheader")).toHaveText(["Date", "Result", "Recorded in", "Actions"]);
      await expect(modal.locator("tbody td:nth-child(3)").filter({ hasText: /^Progress$/ })).toHaveCount(3);
      await expect(modal.locator("tbody td:nth-child(3)").filter({ hasText: /^Control the movement$/ })).toHaveCount(2);
      await expect(modal.getByText("Galway U18", { exact: true })).not.toHaveCount(0);
      await expect(modal.getByText("Unknown", { exact: true })).not.toHaveCount(0);
      await expect(modal.locator("tbody td:nth-child(3) button, tbody td:nth-child(3) a")).toHaveCount(0);
      // Force the background menu state to prove that native showModal still
      // wins even if the account menu was left open by an unrelated render.
      await page.getByRole("button", { name: "Overview menu", exact: true, includeHidden: true }).evaluate(element => (element as HTMLButtonElement).click());
      const signout = page.getByRole("menuitem", { name: "Sign out", exact: true, includeHidden: true });
      expect(await signout.evaluate(element => { const rect = element.getBoundingClientRect(); return !!document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest("dialog"); })).toBe(true);
      expect(await modal.evaluate(element => element.contains(document.activeElement))).toBe(true);
      await page.getByRole("button", { name: "Overview menu", exact: true, includeHidden: true }).evaluate(element => (element as HTMLButtonElement).click());
      await modal.getByRole("button", { name: "Close", exact: true }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await item(page).getByRole("button", { name: /^Confidence comparison\./ }).tap();
      await expect(page.locator(".progress-comparison")).toBeVisible();
      await page.getByRole("button", { name: "Overview menu", exact: true }).tap();
      await expect(page.locator(".progress-comparison")).toHaveCount(0);
      await page.getByRole("button", { name: "Overview menu", exact: true }).tap();
      await expect(page.getByRole("menu")).toHaveCount(0);

      // Actual pointer hit testing and logout, in both Progress contexts. A
      // nonzero scroll keeps the existing absolute account trigger visible.
      for (const path of [groupUrl(), "/progress"]) {
        await login(page); await page.goto(path);
        if (path === "/progress") await expect(page.getByRole("heading", { name: "My Progress", exact: true })).toBeVisible();
        else await expect(selector).toBeEnabled();
        await expect(page.locator(".progress-table")).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 32));
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
        await page.getByRole("button", { name: "Overview menu", exact: true }).tap();
        for (const entry of await page.getByRole("menuitem").all()) {
          expect(await entry.evaluate(element => { const rect = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)); })).toBe(true);
        }
        await Promise.all([page.waitForResponse(response => response.url().endsWith("/api/auth/logout") && response.status() === 200),
          page.getByRole("menuitem", { name: "Sign out", exact: true }).tap()]);
        expect((await page.request.get("/api/auth/me")).status()).toBe(401);
        // Logout refreshes this route asynchronously. Finish that refresh before
        // the next API login/navigation rather than racing the previous page.
        await expect(page.getByRole("button", { name: "Overview menu", exact: true })).toHaveCount(0);
      }
    } finally { await browser.close(); }
  });
}

test("metadata uses current data with singular grammar, dual roles counted once and removed followers excluded", async ({ page }) => {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const groups = new GroupExperienceRepository(new CardRepository(client.db(process.env.MONGODB_DB!), client)), actor = process.env.PHASE2_USER_ID!;
    const template = await groups.get(actor, live!.experienceId);
    const created = await groups.create(actor, { name: "Galway U18", operationId: randomUUID(), adminIds: [live!.followers[0]], followerIds: [live!.followers[0]],
      manifest: { deckTemplateId: template.deckTemplateId, deckVersion: template.deckVersion, cards: template.cards.map(card => ({ cardTemplateId: card.cardTemplateId, version: card.version })) } });
    await login(page); await page.goto(`/group-experiences/${created.experienceId}/progress?framework=${live!.frameworkId}`);
    await expect(page.locator(".group-progress-metadata")).toHaveText("Galway U18 · 1 follower");
    await groups.changeMember(actor, created.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, kind: "remove-follower", targetUserId: live!.followers[0] });
    await expect(page.locator(".group-progress-metadata")).toHaveText("Galway U18 · 0 followers");
  } finally { await client.close(); }
});


test("live review stores distinct club and player histories with realistic origins and activity", async () => {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const db = client.db(process.env.MONGODB_DB!);
    const groups = new GroupExperienceRepository(new CardRepository(db, client));
    const club = await groups.experiences().findOne({ experienceId: live!.experienceId });
    expect(club).not.toBeNull();
    const states = await groups.cardData().find({ experienceId: live!.experienceId }).toArray();
    const clubTests = [...states.flatMap(state => state.tests ?? []), ...(club!.itemTests ?? [])];
    expect(clubTests.filter(test => !test.provenance)).toHaveLength(1); // explicit September legacy import
    for (const test of clubTests.filter(test => test.provenance)) expect(test.provenance!.groupExperienceId).toBe(live!.experienceId);
    expect(clubTests.some(test => test.result)).toBe(true);
    expect(clubTests.some(test => !test.result)).toBe(true);
    expect(states.some(state => state.tests?.length === 0)).toBe(true);
    const counts: number[] = [];
    for (const id of live!.followers) {
      const user = await groups.cards.users().findOne({ _id: new (await import("mongodb")).ObjectId(id) });
      const cardTests = user!.cardsData.flatMap(card => card.tests).filter(test => test.id.startsWith("player-"));
      const direct = user!.itemTests ?? [];
      expect(direct.length).toBeGreaterThan(0);
      expect(direct.some(test => test.provenance?.groupExperienceId === live!.experienceId)).toBe(true);
      expect(direct.some(test => test.provenance?.groupExperienceId === null)).toBe(true);
      expect(cardTests.some(test => !test.provenance)).toBe(true);
      expect(cardTests.filter(test => test.provenance?.groupExperienceId === live!.experienceId).length).toBeGreaterThan(cardTests.filter(test => test.provenance?.groupExperienceId && test.provenance.groupExperienceId !== live!.experienceId).length);
      for (const test of [...cardTests, ...direct]) expect(clubTests.some(clubTest => clubTest.id === test.id)).toBe(false);
      counts.push(cardTests.length + direct.length);
    }
    expect(new Set(counts).size).toBe(4);
  } finally { await client.close(); }
});
