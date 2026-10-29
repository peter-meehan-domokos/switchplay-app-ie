import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const graph = (page: Page) => page.locator("[data-integration-graph]");
async function open(page: Page) {
  await page.goto("/step-visuals"); await button(page, "Open visualisations menu").click(); await button(page, "Integration").click();
  await page.locator("li").getByRole("button", { name: "Integration", exact: true }).click();
}
async function advance(page: Page, target: number, from = 1) {
  for (let stage = from; stage < target; stage++) {
    if (stage === 3) await button(page, "It doubled").click();
    await button(page, "Next").click();
  }
}

for (const viewport of [{ width: 390, height: 844 }, { width: 393, height: 852 }]) {
  test(`six corrections: fresh/restored boundary, substituted integrals, hint and all 27 worked recaps at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: "reduce" }); await open(page);
    const measurements: Record<string, unknown> = {};
    async function capture(name: string) {
      const geometry = await page.evaluate(() => {
        const box = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        return { width: innerWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth,
          graph: box("[data-integration-graph]"), navigation: box('[data-integration-stage] nav'),
          lines: [...document.querySelectorAll("[data-worked-line]")].map(node => { const r = node.getBoundingClientRect(); return { text: node.textContent, top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }) };
      });
      expect(geometry.scrollHeight, name).toBeLessThanOrEqual(viewport.height + 1); expect(geometry.scrollWidth, name).toBeLessThanOrEqual(viewport.width);
      for (const [index, line] of geometry.lines.entries()) {
        expect(line.top, name).toBeGreaterThanOrEqual(0); expect(line.bottom, name).toBeLessThanOrEqual(geometry.navigation.y);
        expect(line.left, name).toBeGreaterThanOrEqual(0); expect(line.right, name).toBeLessThanOrEqual(viewport.width);
        expect(line.text!.trim().startsWith("="), name + " equality chain").toBe(index > 0);
      }
      if (geometry.lines.length) {
        const alignment = await page.locator('[data-worked-calculation]').evaluate(node => {
          const block = node.getBoundingClientRect();
          const starts = [...node.querySelectorAll('[data-worked-line]')].map(line => {
            const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
            let text: Node | null;
            while ((text = walker.nextNode())) {
              if (!text.textContent?.trim()) continue;
              const range = document.createRange(); range.setStart(text, 0); range.setEnd(text, 1);
              return range.getBoundingClientRect().x;
            }
            return NaN;
          });
          const integral = node.querySelector('[role="math"]')!.getBoundingClientRect();
          return { centre: block.x + block.width / 2, starts, integralLeft: integral.x };
        });
        expect(alignment.centre, name + ' centred working block').toBeCloseTo(viewport.width / 2, 1);
        expect(alignment.starts[1], name + ' shared equals axis').toBeCloseTo(alignment.starts[2], 2);
        expect(alignment.starts[1], name + ' shared equals axis').toBeCloseTo(alignment.starts[3], 2);
        expect(alignment.integralLeft - alignment.starts[1], name + ' integral inset').toBe(14);
      }
      measurements[name] = geometry; await page.screenshot({ path: info.outputPath(name + ".png"), fullPage: true });
      await writeFile(info.outputPath("viewport-measurements.json"), JSON.stringify(measurements, null, 2));
    }
    await button(page, "Next").click();
    await expect(page.getByText("The rectangles fit the constant-height graph exactly at every width. What about when y = x?", { exact: true })).toBeVisible(); await capture("02-second-graph-prompt");
    await advance(page, 5, 2);
    const range = page.locator('[data-integration-later] input[type="range"]');
    await expect(range).toHaveValue("3"); const fiveGraph = await graph(page).boundingBox();
    expect(fiveGraph).toEqual({ x: 12, y: 154.1875, width: viewport.width - 24, height: viewport.width === 390 ? 213.8125 : 221.8125 });
    await capture("05-fresh-b3"); await range.press("End"); await button(page, "Next").click(); await button(page, "Previous").click(); await expect(range).toHaveValue("4");
    await button(page, "Previous").click(); await button(page, "Next").click(); await expect(range).toHaveValue("4"); expect(await graph(page).boundingBox()).toEqual(fiveGraph); await capture("05-restored-b4");
    await button(page, "Next").click();
    const sixGraph = await graph(page).boundingBox(); expect(sixGraph).toEqual({ x: 12, y: 173.796875, width: viewport.width - 24, height: viewport.width === 390 ? 270.203125 : 278.203125 });
    const first = page.getByRole("combobox", { name: "First curve", exact: true }), second = page.getByRole("combobox", { name: "Second curve", exact: true });
    await first.selectOption("rising"); await second.selectOption("axis");
    await expect(page.getByRole("math", { name: "Area = Integral from a to b of x with respect to x", exact: true })).toBeVisible(); await capture("06-integral-x");
    await first.selectOption("lower");
    await expect(page.getByRole("math", { name: "Area = Integral from a to b of 3x − x² with respect to x", exact: true })).toBeVisible(); await capture("06-integral-parabola-below-axis");
    await range.press("End"); await expect(page.getByRole("math", { name: "Area = Integral from a to b of |x² − 3x| with respect to x", exact: true })).toBeVisible();
    await expect(page.locator("[data-integration-region]")).toHaveCount(2); await capture("06-integral-crossing");
    await first.selectOption("axis"); await capture("06-integral-identical"); expect(await graph(page).boundingBox()).toEqual(sixGraph);
    await button(page, "Next").click();
    const finalGraph = await graph(page).boundingBox();
    const answer = page.getByRole("textbox", { name: "Your answer", exact: true });
    await expect(page.locator("[data-worked-calculation]")).toHaveCount(0); await answer.fill("6"); await button(page, "Check calculation").click(); await button(page, "Show hint").click();
    await expect(page.getByRole("tooltip")).toContainText("Use the power rule to integrate each term. Then subtract the lower value from the upper value.");
    await expect(page.getByRole("tooltip").getByRole("math")).toHaveAttribute("aria-label", "Area equals Upper value at x equals b minus Lower value at x equals a");
    const equation = page.getByRole("tooltip").getByRole("math");
    expect((await equation.boundingBox())!.height).toBeLessThan(25);
    const popupBox = (await page.getByRole("tooltip").boundingBox())!;
    expect(popupBox.width).toBeGreaterThan(360); expect(popupBox.x).toBeGreaterThanOrEqual(8);
    expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(viewport.width - 8);
    await capture("07-revised-hint"); await page.keyboard.press("Escape"); await expect(button(page, "Show hint")).toBeFocused();
    await button(page, "Finish").click();
    await expect(page.locator("[data-worked-line]")).toHaveCount(4);
    await expect(page.locator('[data-worked-line="evaluation"]')).toContainText("[9x + x² − x³]");
    await expect(page.locator('[data-worked-line="substitution"]')).toHaveText("= (9 × 2 + 2² − 2³) − (9 × 1 + 1² − 1³)");
    expect((await page.locator('[data-worked-line="substitution"]').boundingBox())!.height).toBeLessThan(28);
    await expect(page.locator('[data-worked-line="subtraction"]')).toContainText("14 − 9 = 5");
    const label = page.locator('p').filter({ hasText: /^Strip height:/ }); const height = label.getByRole("math");
    expect((await label.boundingBox())!.height).toBeLessThan(28); await expect(height).toBeVisible();
    expect(await graph(page).boundingBox()).toEqual(finalGraph); await capture("07-reference-four-lines-incorrect");
    const curves = ["upper", "parabola", "axis"] as const;
    const values = { upper: [0, 10, 22], parabola: [0, 1, 8], axis: [0, 0, 0] } as const;
    for (const left of curves) for (const right of curves) for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) {
      await button(page, "Start again").click(); await advance(page, 7);
      await first.selectOption(left); await second.selectOption(right); await page.getByRole("radio", { name: `From ${a} to ${b}`, exact: true }).check();
      const ordered = [left, right].sort((x, y) => curves.indexOf(x) - curves.indexOf(y));
      const upper = values[ordered[0]][b] - values[ordered[1]][b], lower = values[ordered[0]][a] - values[ordered[1]][a];
      const expected = upper - lower;
      // Incorrect answers retain the longest recap; assessment must still allow Finish.
      await answer.fill(String(expected + 1)); await button(page, "Check calculation").click(); await expect(button(page, "Finish")).toBeEnabled(); await button(page, "Finish").click();
      await expect(page.locator("[data-worked-line]")).toHaveCount(4);
      await expect(page.locator('[data-worked-line="subtraction"]')).toContainText(`${upper} − ${lower} = ${expected}`);
      expect(await graph(page).boundingBox()).toEqual(finalGraph); await capture(`07-worked-${left}-${right}-${a}-${b}`);
    }
  });
}
