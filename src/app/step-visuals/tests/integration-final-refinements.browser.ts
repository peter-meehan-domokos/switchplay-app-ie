import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true }).click();
const previous = (page: Page) => page.getByRole("button", { name: "Previous", exact: true }).click();
const graph = (page: Page) => page.locator("[data-integration-graph]");
const frame = (page: Page) => page.locator("[data-integration-later]");
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const range = (page: Page) => frame(page).locator('input[type="range"]');

for (const viewport of [{ width: 390, height: 844 }, { width: 393, height: 852 }]) {
  test(`approved final refinements and preserved geometry at ${viewport.width} × ${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: "reduce" });
    const measurements: Record<string, unknown> = {};
    const capture = async (name: string) => {
      const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
      expect(dimensions.scrollWidth, name).toBeLessThanOrEqual(viewport.width);
      expect(dimensions.scrollHeight, name).toBeLessThanOrEqual(viewport.height + 1);
      measurements[name] = { ...dimensions, graph: await graph(page).count() ? await graph(page).boundingBox() : null, navigation: await page.getByRole("navigation", { name: "Activity progression" }).boundingBox() };
      const boxes = await page.locator('[data-integration-stage] h1, [data-integration-stage] h2, [data-integration-stage] p, [data-integration-stage] [role="math"], [data-integration-stage] select, [data-integration-stage] input, [data-integration-stage] button').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }));
      for (const box of boxes) { expect(box.top, name).toBeGreaterThanOrEqual(0); expect(box.bottom, name).toBeLessThanOrEqual(viewport.height); expect(box.left, name).toBeGreaterThanOrEqual(0); expect(box.right, name).toBeLessThanOrEqual(viewport.width); }
      const standaloneMaths = page.locator([
        '[data-stage="4"] [class*="panel"] > [role="math"]',
        '[data-stage="4"] [class*="panel"] > div > [role="math"]',
        '[class*="ruleAside"] > [role="math"]',
        '[class*="ruleContent"] > div > [role="math"]',
        '[class*="geometricSteps"] > div > [role="math"]',
        '[class*="stripIntegral"] > [role="math"]',
        '[class*="setupSection"] > [role="math"]',
      ].join(', '));
      for (const maths of await standaloneMaths.all()) {
        const centre = await maths.evaluate(node => {
          const boxes = [...node.children].map(child => child.getBoundingClientRect());
          return (Math.min(...boxes.map(box => box.left)) + Math.max(...boxes.map(box => box.right))) / 2;
        });
        // Fractions retain their existing 1px inline margins.
        expect(Math.abs(centre - viewport.width / 2), name + ' centred standalone mathematics').toBeLessThanOrEqual(1);
      }
      await page.screenshot({ path: info.outputPath(name + ".png"), fullPage: true });
      await writeFile(info.outputPath("viewport-measurements.json"), JSON.stringify(measurements, null, 2));
    };
    const subsectionOrder = async () => {
      const heading = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      const selector = (await page.getByRole("group", { name: "Graph selector" }).boundingBox())!;
      const instruction = (await frame(page).locator(':scope > p').boundingBox())!;
      expect(selector.y).toBeGreaterThanOrEqual(heading.y + heading.height); expect(instruction.y).toBeGreaterThanOrEqual(selector.y + selector.height);
    };
    await page.goto("/step-visuals"); await button(page, "Open visualisations menu").click(); await button(page, "Integration").click(); await page.locator("li").getByRole("button", { name: "Integration", exact: true }).click();
    await next(page); await expect(button(page, "y = 2")).toHaveAttribute("aria-pressed", "true");
    const selectorBox = (await page.getByRole("group", { name: "Graph selector" }).boundingBox())!;
    const instructionBox = (await page.getByText("Make the rectangles narrower.", { exact: false }).first().boundingBox())!;
    expect(selectorBox.y + selectorBox.height).toBeLessThanOrEqual(instructionBox.y);
    await capture("02-constant"); await button(page, "y = x").click(); await capture("02-rising");
    await next(page); await subsectionOrder(); await expect(button(page, "y = 2")).toHaveAttribute("aria-pressed", "true");
    await button(page, "It doubled").click(); await expect(page.getByText("Now try y = x. Does the area grow in the same way?", { exact: true })).toBeVisible(); await capture("03-flat-suggestion");
    await button(page, "y = x").click(); await button(page, "It quadrupled").click(); await expect(page.getByText("Now try y = x². Does the area grow even faster?", { exact: true })).toBeVisible(); await capture("03-linear-suggestion");
    await button(page, "y = x²").click(); await button(page, "It doubled").click(); await capture("03-square-incorrect-all-answered");
    await next(page); await subsectionOrder(); const divisionGraph = await graph(page).boundingBox();
    await expect(page.getByRole("math", { name: /Integral of x with respect to x equals x² over 2/ })).toBeVisible(); await capture("04-linear-preview");
    await button(page, "y = x²").click(); await range(page).press("End"); await capture("04-quadratic-128");
    await button(page, "The rule").click(); await expect(graph(page)).toHaveCount(0); await expect(page.getByRole("slider")).toHaveCount(0);
    await expect(page.getByText("n ≠ −1", { exact: true })).toBeVisible(); await expect(page.getByRole("math", { name: /Integral of xⁿ.*n \+ 1/ })).toBeVisible(); await capture("04-rule");
    await button(page, "y = x²").click(); await expect(range(page)).toHaveValue("5"); expect(await graph(page).boundingBox()).toEqual(divisionGraph); await capture("04-restored-quadratic");
    await button(page, "The rule").click(); await next(page); await previous(page); await expect(button(page, "The rule")).toHaveAttribute("aria-pressed", "true"); await next(page);
    const expectedFive = { x: 12, y: 154.1875, width: viewport.width - 24, height: viewport.width === 390 ? 213.8125 : 221.8125 };
    expect(await graph(page).boundingBox()).toEqual(expectedFive); await capture("05-unchanged");
    await next(page);
    const expectedSix = { x: 12, y: 173.796875, width: viewport.width - 24, height: viewport.width === 390 ? 270.203125 : 278.203125 };
    const navigation = await page.getByRole("navigation", { name: "Activity progression" }).boundingBox();
    expect(await graph(page).boundingBox()).toEqual(expectedSix); expect(navigation?.y).toBe(viewport.height - 108);
    const controls = (await page.locator('[class*="betweenControls"]').boundingBox())!; const slider = (await range(page).boundingBox())!;
    expect(slider.x + slider.width).toBeCloseTo(controls.x + controls.width, 3); expect(slider.width).toBeGreaterThan(200);
    await expect(page.getByText("Add these narrow strips using integration:", { exact: true })).toBeVisible(); await capture("06-full-width-slider-integral");
    const first = page.getByRole("combobox", { name: "First curve", exact: true }), second = page.getByRole("combobox", { name: "Second curve", exact: true });
    await first.selectOption("lower"); await second.selectOption("axis"); await range(page).press("End"); await capture("06-crossing");
    expect(await graph(page).boundingBox()).toEqual(expectedSix); expect(await page.getByRole("navigation", { name: "Activity progression" }).boundingBox()).toEqual(navigation);
    await first.selectOption("axis"); await capture("06-identical"); expect(await graph(page).boundingBox()).toEqual(expectedSix);
    await next(page); const calculationGraph = await graph(page).boundingBox();
    await capture("07-input-integral");
    const answer = page.getByRole("textbox", { name: "Your answer", exact: true }); await answer.fill("6"); await button(page, "Check calculation").click(); await button(page, "Show hint").click();
    const tip = page.getByRole("tooltip"); await expect(tip).toContainText("Use the power rule to integrate each term. Then subtract the lower value from the upper value.");
    const tipBox = (await tip.boundingBox())!; expect(tipBox.y).toBeGreaterThanOrEqual(8); expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(viewport.height - 8); await capture("07-approved-hint");
    await page.keyboard.press("Escape"); await expect(tip).toHaveCount(0); await expect(button(page, "Show hint")).toBeFocused();
    await button(page, "Finish").click(); await expect(page.getByText("Strip height:", { exact: false })).toBeVisible(); expect(await graph(page).boundingBox()).toEqual(calculationGraph); await capture("07-spaced-incorrect-recap");
    const inspector = page.locator("details").filter({ has: page.getByText("Learning records", { exact: true }) }); await inspector.locator("summary").click();
    const records = JSON.parse((await page.locator("[data-spv-records]").textContent())!).records;
    expect(records.events[0]).toMatchObject({ type: "attempt-started", view: { region: { curves: ["flat", "axis"], a: 0, b: 1 } } });
    expect(records.events.filter((event: { type: string }) => event.type === "division-rule-viewed")).toHaveLength(2);
    expect(records.events.filter((event: { type: string }) => event.type === "stage-changed").every((event: { view?: unknown }) => !!event.view)).toBe(true);
  });
}
