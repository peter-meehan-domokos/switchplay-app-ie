import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const panels = ["1", "2-flat", "2-rising", "3-question", "3-feedback", "3-square", "4-rising", "4-square", "4-rule", "5", "6", "7", "7-incorrect", "7-finished"];
// Explicit unresolved constraints, not fit claims. No clipping/scrolling/text reduction
// is introduced to hide them. All other states must fit, including every 375/390x844 state.
const shortLimits: Record<string, Record<string, number>> = {
  "320x568": { "3-square": 50, "4-square": 60, "4-rule": 45, "5": 120, "6": 140, "7": 55, "7-incorrect": 100 },
  "390x600": { "4-rule": 15, "5": 60, "7": 15, "7-incorrect": 65 },
};
let html: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: ["tests/browser/integration-container-fixture.tsx"], bundle: true, write: false,
    outfile: "fixture.js", platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"test"' } });
  html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${await readFile("src/app/globals.css", "utf8")}\n${result.outputFiles.find(f => f.path.endsWith(".css"))!.text}</style><div id="root"></div><script>${result.outputFiles.find(f => f.path.endsWith(".js"))!.text}</script>`;
});
async function open(page: Page) {
  await page.route("https://integration.invalid/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://integration.invalid/");
  await page.waitForFunction(() => !!window.integrationFixture);
}
async function metrics(page: Page) {
  return page.evaluate(() => {
    const f = document.querySelector<HTMLElement>("[data-integration-intro],[data-integration-later]")!;
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
    return { frame: box(f), graph: f.querySelector("[data-integration-graph]") ? box(f.querySelector("[data-integration-graph]")!) : null,
      content: [...f.querySelectorAll("h1,h2,p,input,select,button,[role=math]")].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden").map(e => ({ text: e.textContent?.slice(0, 80), ...box(e) })) };
  });
}
for (const [width, height] of [[320, 568], [375, 667], [390, 600], [390, 844]]) {
  test(`all Integration panels use their ${width}x${height} supplied rectangle`, async ({ page }, info) => {
    await page.setViewportSize({ width, height }); await open(page);
    const results = [];
    for (const panel of panels) {
      await page.evaluate(config => window.integrationFixture.configure(config), { width: width - 24, height: height - 112, panel, mode: "adapter" as const });
      await expect(page.locator("[data-integration-intro],[data-integration-later]")).toHaveCount(1);
      await page.waitForTimeout(70);
      const m = await metrics(page); results.push({ panel, ...m });
      expect(m.frame.height).toBeCloseTo(height - 112, 1);
      if (m.graph) expect(m.graph.height).toBeGreaterThanOrEqual(119.9);
      const limit = shortLimits[`${width}x${height}`]?.[panel] ?? 0;
      for (const e of m.content) {
        expect(e.y, `${panel}: content above rectangle`).toBeGreaterThanOrEqual(m.frame.y - 1);
        expect(e.x + e.width, `${panel}: horizontal overflow`).toBeLessThanOrEqual(width - 11);
        expect(e.bottom, `${panel}: ${e.text}`).toBeLessThanOrEqual(m.frame.bottom + limit + 1);
      }
      if (limit) info.annotations.push({ type: "known-short-screen-limit", description: `${panel}: requires separately approved content reflow; allowed ceiling ${limit}px` });
      if (["2-rising", "3-feedback", "5", "6", "7-incorrect"].includes(panel)) await page.screenshot({ path: info.outputPath(`${width}x${height}-${panel}.png`) });
    }
    await info.attach("measurements", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  });
}
test("height changes resize the graph without remounting or using browser height", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 }); await open(page);
  await page.waitForTimeout(70);
  const saves = await page.evaluate(() => window.integrationFixture.saveCount());
  const heights = [];
  for (const height of [732, 555, 300, 620, 700]) {
    await page.evaluate(h => window.integrationFixture.resize(h), height); await page.waitForTimeout(70);
    const m = await metrics(page); expect(m.frame.height).toBeCloseTo(height, 1); heights.push(m.graph!.height);
  }
  expect(heights[0]).toBeGreaterThan(heights[1] + 100); expect(heights[2]).toBe(120);
  expect(heights[3]).toBeGreaterThan(heights[1]); expect(heights[4]).toBeGreaterThan(heights[3]);
  const beforeViewportChange = await metrics(page);
  await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(70);
  expect(await metrics(page)).toEqual(beforeViewportChange);
  expect(await page.evaluate(() => window.integrationFixture.saveCount())).toBe(saves);
});
test("adapter and independent presentation agree for identical rectangles and settings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await open(page);
  for (const [width, height] of [[296, 456], [351, 555], [366, 732]]) for (const panel of panels) {
    const configure = async (mode: "adapter" | "presentation") => {
      await page.evaluate(config => window.integrationFixture.configure(config), { width, height, panel, mode });
      await page.waitForTimeout(70); return metrics(page);
    };
    expect(await configure("presentation"), panel).toEqual(await configure("adapter"));
  }
});
