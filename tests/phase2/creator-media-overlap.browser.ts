import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { MongoClient } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });

test.use({ hasTouch: true });
test("Creator step media stays inside every cell and opens by touch on short phones", async ({ page, browserName }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 });
  expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).ok()).toBe(true);
  await page.goto("/creator/new");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  const column = page.locator(".creator-column[data-card-template-id]").last();
  await expect(page).toHaveURL(/\/creator\/edit\//);
  const id = (await column.getAttribute("data-card-template-id"))!;
  const root = () => client.db(process.env.MONGODB_DB!).collection("cardTemplates").findOne({ cardTemplateId: id });
  await column.locator(".creator-card-title-button").click();
  await page.locator(".creator-modal").getByRole("textbox").fill("Graphs, factors and area");
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
  const modal = page.locator("dialog[data-creator-step-media]");
  for (const [index, activity] of ["integration-area", "roots-and-factors", "integration-area", "roots-and-factors"].entries()) {
    await modal.getByRole("combobox", { name: "Add Interactive Visual", exact: true }).selectOption(activity);
    await expect(modal.locator("li[data-attachment-id]")).toHaveCount(index + 1);
  }
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  const measurements = [];
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 1280, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300);
    const button = column.getByRole("button", { name: "Manage step media", exact: true }).first();
    const geometry = await button.evaluate(node => {
      const box = (element: Element) => {
        const r = element.getBoundingClientRect(), s = getComputedStyle(element);
        return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom,
          rows: s.gridTemplateRows, padding: s.padding, overflow: s.overflow, minHeight: s.minHeight };
      };
      const pair = node.closest(".creator-pair")!, cell = node.closest(".creator-cell")!;
      const r = node.getBoundingClientRect();
      return { button: box(node), slot: box(node.parentElement!), pair: box(pair), cell: box(cell),
        nextCell: box(cell.nextElementSibling!), children: [...pair.children].map(box),
        hits: [0.1, 0.5, 0.9].map(f => {
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height * f);
          return { fraction: f, reachable: !!hit && node.contains(hit), element: hit?.className };
        }) };
    });
    const screenshot = `/private/tmp/creator-overlap-after-${browserName}-${viewport.width}.png`;
    await page.screenshot({ path: screenshot });
    measurements.push({ viewport, ...geometry, screenshot });
    await testInfo.attach(`geometry-${viewport.width}`, { body: JSON.stringify(geometry), contentType: "application/json" });
    expect(geometry.hits.every(hit => hit.reachable)).toBe(true);
    expect(geometry.button.bottom).toBeLessThanOrEqual(geometry.pair.bottom);
    expect(geometry.cell.bottom).toBeCloseTo(geometry.nextCell.y, 1);
    for (const control of await column.getByRole("button", { name: "Manage step media", exact: true }).all()) {
      const fitsAndReceivesTouches = await control.evaluate(node => {
        const r = node.getBoundingClientRect(), cell = node.closest(".creator-cell")!.getBoundingClientRect();
        return r.top >= cell.top && r.bottom <= cell.bottom && [0.1, 0.5, 0.9].every(x =>
          [0.1, 0.5, 0.9].every(y => {
            const hit = document.elementFromPoint(r.x + r.width * x, r.y + r.height * y);
            return hit !== null && node.contains(hit);
          }));
      });
      expect(fitsAndReceivesTouches).toBe(true);
      await control.tap(); await expect(modal).toBeVisible();
      await modal.getByRole("button", { name: "Close", exact: true }).tap();
    }
  }
  await writeFile(`/private/tmp/creator-overlap-after-${browserName}.json`, JSON.stringify(measurements, null, 2));
  await testInfo.attach("geometry", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
  // Exercise editing, attachment and reload at the original failing viewport.
  await page.setViewportSize({ width: 375, height: 667 });
  await column.locator(".creator-pair-step").first().tap();
  const instruction = "Sketch the graph carefully and identify every root. Explain how the factors determine the curve and compare the intercepts.";
  await page.locator(".creator-modal textarea").fill(instruction);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).tap();
  await column.getByRole("button", { name: "Manage step media", exact: true }).first().tap();
  await modal.getByRole("combobox", { name: "Add Interactive Visual", exact: true }).selectOption("integration-area");
  await expect.poll(async () => (await root())?.draft.steps[0].mediaItems?.[0]?.activityId).toBe("integration-area");
  await modal.getByRole("button", { name: "Close", exact: true }).tap();
  await page.reload();
  const step = column.locator(".creator-pair-step").first();
  await expect(step).toContainText(instruction);
  const populated = await step.evaluate(node => {
    const pair = node.closest(".creator-pair")!, cell = pair.closest(".creator-cell")!.getBoundingClientRect();
    return [...pair.children].map(child => {
      const r = child.getBoundingClientRect();
      return { className: child.className, top: r.top, bottom: r.bottom, withinCell: r.top >= cell.top && r.bottom <= cell.bottom };
    });
  });
  await testInfo.attach("populated-step", { body: JSON.stringify(populated), contentType: "application/json" });
  expect(populated.every(child => child.withinCell)).toBe(true);
  await page.screenshot({ path: `/private/tmp/creator-overlap-populated-${browserName}.png` });
  await column.getByRole("button", { name: "Long press to reorder pair", exact: true }).first().tap();
  await column.getByRole("button", { name: "Manage step media", exact: true }).first().tap();
  await expect(modal.locator("li[data-attachment-id]")).toHaveCount(1);
});
