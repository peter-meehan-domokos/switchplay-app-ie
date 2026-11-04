import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { seedVisualReview } from "../../scripts/fixtures/plugged-in-review";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

test("seeded four-card deck recovers Introduction lookup and resumes both visuals at every attached step", async ({ page }) => {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect(), db = client.db(process.env.MONGODB_DB!);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    const deckPath = await seedVisualReview(db, client, process.env.PHASE2_USER_ID!, process.env.PHASE2_MEDIA_FIXTURE_ORIGIN!, process.env.MONGODB_URI!);
    expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).ok()).toBe(true);
    let failRead = true;
    await page.route("**/api/visual-sessions/existing?**", route => {
      if (failRead && route.request().url().includes("integration-area")) { failRead = false; return route.fulfill({ status: 503, json: { code: "VISUAL_REQUEST_FAILED" } }); }
      return route.continue();
    });
    await page.route("https://videodelivery.net/**", route => route.abort());
    const attempts = new Map<string, string>();
    async function card(id: string) {
      const url = new URL(deckPath, process.env.PHASE2_BASE_URL!); url.searchParams.set("openCard", id);
      await page.goto(url.href); await page.locator(".deck-card.is-active").press("Enter");
      await page.locator(".focused-card-surface--front .active-card-identity[role=button]").click();
      await expect(page.locator(".step-view-layer")).toHaveAttribute("data-step-view-item", "intro");
    }
    async function exercise(activity: string, label: string, first = false) {
      const step = page.locator(".step-view-layer"), tab = step.getByRole("tab", { name: label, exact: true }); await tab.click();
      const preview = page.locator("[data-interactive-visual-preview]");
      if (first) {
        await expect(preview).toHaveAccessibleName("Retry checking progress: Integration");
        expect(await db.collection("visualRecords").countDocuments()).toBe(0); expect(await db.collection("visualVisits").countDocuments()).toBe(0);
        await preview.click(); await expect(preview).toHaveAccessibleName("Start: Integration");
        expect(await db.collection("visualRecords").countDocuments()).toBe(0); expect(await db.collection("visualVisits").countDocuments()).toBe(0);
      }
      await expect(preview).toHaveAccessibleName(new RegExp(`^(Start|Continue): ${activity}$`));
      if (activity === "Roots and Factors" && !attempts.has(activity)) await expect(preview).toHaveAccessibleName("Start: Roots and Factors");
      for (let visit = 0; visit < 2; visit++) {
        const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/visual-sessions/open") && response.request().method() === "POST");
        await preview.click(); const response = await responsePromise; expect(response.ok()).toBe(true); const dto = await response.json();
        const fresh = !attempts.has(activity);
        if (!fresh) expect(dto.attemptId).toBe(attempts.get(activity)); attempts.set(activity, dto.attemptId);
        const host = page.getByRole("dialog", { name: activity, exact: true }), content = host.locator("[data-visual-host-content]");
        await expect(host).toBeVisible();
        if (activity === "Integration") {
          await expect(content.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", String(dto.snapshot?.panel.stage ?? 1));
          if (fresh) await host.getByRole("button", { name: "Next", exact: true }).click();
          await expect(content.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", "2");
        } else {
          const slider = host.getByRole("slider");
          if (fresh) { await slider.focus(); await page.keyboard.press("ArrowRight"); }
          await expect(slider).toHaveAttribute("aria-valuenow", "4");
        }
        await expect.poll(async () => (await content.boundingBox())!.x).toBeCloseTo(12, 1);
        const bounds = await content.boundingBox(); expect(bounds!.y).toBeCloseTo(56, 1); expect(bounds!.width).toBeCloseTo(366, 1); expect(bounds!.height).toBeCloseTo(732, 1);
        await expect(host).toHaveAttribute("data-visual-save-status", "Saved");
        await host.getByRole("button", { name: "Close interactive visual" }).click();
        await expect(tab).toHaveAttribute("aria-selected", "true"); await expect(preview).toBeFocused();
        await expect(preview).toHaveAccessibleName(`Continue: ${activity}`); await expect(preview).not.toHaveAttribute("aria-busy", "true");
      }
    }
    async function next(page: Page) { await page.locator(".step-view-layer").getByRole("button", { name: "Next", exact: true }).click(); await expect(page.locator(".step-view-layer")).toHaveCount(1); }
    await card("review-integration"); await exercise("Integration", "Explore", true);
    for (const label of ["Explore", "Explore", "Check"]) { await next(page); await exercise("Integration", label); }
    await card("review-roots");
    for (const label of ["Explore", "Try", "Recall"]) { await next(page); await exercise("Roots and Factors", label); }
    expect(await db.collection("visualRecords").countDocuments()).toBe(2); expect(await db.collection("visualAttempts").countDocuments()).toBe(2);
    expect(await db.collection("visualEvents").countDocuments({ type: "attempt-started" })).toBe(2);
    expect(await db.collection("visualVisits").countDocuments()).toBe(14);
  } finally { await client.close(); }
});
