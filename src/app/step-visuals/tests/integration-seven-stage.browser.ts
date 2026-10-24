import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

async function openIntegration(page: Page) {
  await page.goto("/step-visuals");
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.getByRole("button", { name: "Integration", exact: true }).click();
  await page.locator("li").getByRole("button", { name: "Integration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1. Area under a graph", exact: true })).toBeVisible();
}
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: false }).click();

for (const viewport of [{ width: 390, height: 844 }, { width: 393, height: 852 }]) {
  test(`seven-stage demanding rendered compositions at ${viewport.width} × ${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const recordLogs: string[] = [];
    page.on("console", message => { if (message.text().startsWith("[Step Visuals · Integration")) recordLogs.push(message.text()); });
    const measurements: Record<string, unknown> = {};
    const frames = new Map<string, { x: number; y: number; width: number; height: number; axes: string }>();
    const capture = async (name: string) => {
      await page.waitForTimeout(80);
      measurements[name] = await page.evaluate(() => {
        const graph = document.querySelector("[data-integration-graph]")!.getBoundingClientRect();
        const svg = document.querySelector("[data-integration-graph] svg")!;
        return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, scrollY,
          visualViewport: window.visualViewport ? { width: visualViewport!.width, height: visualViewport!.height, offsetTop: visualViewport!.offsetTop } : null,
          graph: { x: graph.x, y: graph.y, width: graph.width, height: graph.height }, domains: [svg.getAttribute("data-x-domain"), svg.getAttribute("data-y-domain")],
          controls: [...document.querySelectorAll("[data-integration-later] button, [data-integration-later] select, [data-integration-later] input")].map(node => { const box = node.getBoundingClientRect(); return { name: node.textContent || node.getAttribute("aria-label"), x: box.x, y: box.y, width: box.width, height: box.height }; }) };
      });
      const current = await page.locator("[data-integration-graph]").evaluate(node => {
        const box = node.getBoundingClientRect(), svg = node.querySelector("svg")!;
        return { key: document.querySelector("[data-integration-stage]")!.getAttribute("data-integration-stage") + ":" + svg.getAttribute("data-frame")!, box: { x: box.x, y: box.y, width: box.width, height: box.height, axes: node.querySelector("[data-integration-plane]")!.innerHTML } };
      });
      if (frames.has(current.key)) expect(current.box, name + " stable graph").toEqual(frames.get(current.key));
      else frames.set(current.key, current.box);
      const rows = await page.locator("[data-integration-later]").evaluate(node => [...node.children].map(child => { const box = child.getBoundingClientRect(); return { top: box.top, bottom: box.bottom }; }));
      for (let i = 1; i < rows.length; i++) expect(rows[i].top, name + " rows").toBeGreaterThanOrEqual(rows[i - 1].bottom);
      const boxes = await page.locator("[data-integration-later] button, [data-integration-later] select, [data-integration-later] input, [data-integration-later] p, [data-integration-later] h1, [data-integration-later] h2").evaluateAll(nodes => nodes.map(node => { const b = node.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; }));
      for (const box of boxes) { expect(box.top, name).toBeGreaterThanOrEqual(0); expect(box.bottom, name).toBeLessThanOrEqual(viewport.height); expect(box.left, name).toBeGreaterThanOrEqual(0); expect(box.right, name).toBeLessThanOrEqual(viewport.width); }
      const tip = page.getByRole("tooltip");
      if (await tip.count()) { const b = (await tip.boundingBox())!; expect(b.x).toBeGreaterThanOrEqual(8); expect(b.y).toBeGreaterThanOrEqual(8); expect(b.x + b.width).toBeLessThanOrEqual(viewport.width - 8); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height - 8); }
      await page.screenshot({ path: testInfo.outputPath(name + ".png"), fullPage: true });
      await writeFile(testInfo.outputPath("viewport-measurements.json"), JSON.stringify(measurements, null, 2));
      expect(await page.evaluate(() => document.documentElement.scrollHeight), name).toBeLessThanOrEqual(viewport.height + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), name).toBeLessThanOrEqual(viewport.width);
    };
    for (const kind of ["rising", "flat", "square"] as const) for (const outcome of ["correct", "incorrect"] as const) {
      await openIntegration(page); await next(page); await next(page);
      const label = ({ rising: "y = x", flat: "y = 2", square: "y = x²" })[kind];
      await page.getByRole("button", { name: label, exact: true }).click();
      const correct = ({ rising: "It quadrupled", flat: "It doubled", square: "It increased eightfold" })[kind];
      await page.getByRole("button", { name: outcome === "correct" ? correct : kind === "flat" ? "It quadrupled" : "It doubled", exact: true }).click();
      await capture("03-growth-" + kind + "-" + outcome);
    }
    await next(page); await capture("04-division-line");
    await page.getByRole("button", { name: "y = x²", exact: true }).click(); await capture("04-division-square-n4");
    await page.getByRole("slider", { name: /Rectangle width/ }).press("End"); await capture("04-division-square-n128");
    await page.getByRole("button", { name: "Why exactly one-third?", exact: true }).click(); await capture("04-division-tooltip");
    await page.keyboard.press("Escape"); await page.getByRole("button", { name: "y = x", exact: true }).click(); await capture("04-division-return-line");
    await next(page); await capture("05-offset-initial");
    for (const b of [1, 2, 3]) {
      const range = page.locator('[data-integration-later] input[type="range"]');
      await range.press("Home"); for (let i = 1; i < b; i++) await range.press("ArrowRight");
      await capture("05-offset-b" + b);
    }
    const root = page.locator('[data-integration-graph] [role="slider"]'), box = (await root.boundingBox())!, unit = ((await page.locator("[data-integration-graph]").boundingBox())!.width - 54) / 5;
    await page.mouse.move(box.x + 24, box.y + 24); await page.mouse.down(); await page.mouse.move(box.x + 24 - .63 * unit, box.y + 24);
    await capture("05-offset-fractional-drag");
    await page.mouse.up(); await expect(root).toHaveAttribute("aria-valuenow", "2"); await capture("05-offset-released");
    await page.getByRole("button", { name: "constant of integration", exact: true }).click(); await capture("05-offset-constant-tooltip"); await page.keyboard.press("Escape");
    await next(page); await capture("06-between-initial");
    const first = page.getByRole("combobox", { name: "First curve", exact: true }), second = page.getByRole("combobox", { name: "Second curve", exact: true });
    await first.selectOption("lower"); await second.selectOption("rising"); await capture("06-between-reversed");
    for (const curve of ["rising", "lower", "axis"]) { await first.selectOption(curve); await second.selectOption(curve); await capture("06-between-equal-" + curve); }
    await first.selectOption("lower"); await second.selectOption("axis");
    await page.locator('[data-integration-later] input[type="range"]').press("End"); await capture("06-between-crossing-b4");
    await page.locator('[data-integration-later] input[type="range"]').press("ArrowLeft"); await capture("06-between-crossing-b3.9");
    await page.locator('[data-integration-later] input[type="range"]').press("Home"); await capture("06-between-zero-width");
    await next(page); await capture("07-calculation-initial");
    await page.getByRole("button", { name: "Check calculation", exact: true }).click(); await capture("07-calculation-empty");
    const answer = page.getByRole("textbox", { name: "Your answer", exact: true }), check = page.getByRole("button", { name: "Check calculation", exact: true });
    await answer.fill("6"); await check.click(); await capture("07-calculation-incorrect");
    await page.getByRole("button", { name: "Show hint", exact: true }).click(); await capture("07-calculation-hint"); await page.keyboard.press("Escape");
    await answer.fill("5"); await capture("07-calculation-edited-disabled-finish"); await check.click(); await capture("07-calculation-correct");
    await page.getByRole("radio", { name: "From 0 to 2", exact: true }).check(); await capture("07-calculation-changed-interval");
    await first.selectOption("parabola"); await second.selectOption("upper"); await capture("07-calculation-reversed");
    await second.selectOption("parabola"); await capture("07-calculation-identical");
    await answer.fill("1"); await check.click(); await page.getByRole("button", { name: "Show hint", exact: true }).click(); await capture("07-calculation-identical-hint"); await page.keyboard.press("Escape");
    await first.selectOption("upper"); await second.selectOption("parabola"); await page.getByRole("radio", { name: "From 1 to 2", exact: true }).check();
    await answer.fill("6"); await check.click(); await page.getByRole("button", { name: "Finish", exact: true }).click(); await capture("07-incorrect-recap");
    await page.getByRole("button", { name: "Start again", exact: true }).click();
    await next(page); await next(page); await page.getByRole("button", { name: "It quadrupled", exact: true }).click();
    for (let i = 3; i < 7; i++) await next(page);
    await answer.fill("5"); await check.click(); await page.getByRole("button", { name: "Finish", exact: true }).click(); await capture("07-correct-recap");
    console.log("SEVEN_STAGE_VIEWPORTS", JSON.stringify({ viewport, capturedStates: Object.keys(measurements).length, measurements: testInfo.outputPath("viewport-measurements.json") }));
    if (process.env.SPV_CONSOLE_PRODUCTION === "1") expect(recordLogs).toEqual([]);
  });
}
