import { expect, test, devices } from "@playwright/test";
import { readFile } from "node:fs/promises";
import baseline from "../fixtures/interactive-visual-fullscreen-baseline/geometry.json";

test.use({ ...devices["iPhone 13"], deviceScaleFactor: 1, contextOptions: { reducedMotion: "reduce" } });
const reference = "tests/fixtures/interactive-visual-fullscreen-baseline/";
for (const [width, height] of [[320, 568], [375, 667], [390, 844], [390, 600]]) {
  test(`host and Roots geometry retain the pre-redesign bounds at ${width}x${height}`, async ({ page, browserName }) => {
    test.skip(process.platform !== "darwin" || browserName !== "webkit", "Reference pixels are macOS WebKit; portable host assertions run separately.");
    await page.setViewportSize({ width, height });
    await page.goto("/dev/interactive-visual-host"); await page.getByRole("button", { name: "Open guest database review", exact: true }).click();
    async function compare(activity: string, stage: number | string) {
      const host = page.getByRole("dialog", { name: activity, exact: true });
      await expect(host).toHaveAttribute("data-visual-save-status", "Saved");
      await page.evaluate(() => document.fonts.ready);
      await host.evaluate(() => { const active = document.activeElement; if (active instanceof HTMLElement && active.closest("[data-visual-host-header],[data-visual-host-footer]")) active.blur(); });
      const expected = baseline.samples.find(row => row.activity === activity && String(row.stage) === String(stage) && row.width === width && row.height === height)!;
      const actual = await host.evaluate(node => {
        const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const measure = (element: Element) => ({ tag: element.tagName, text: (element.textContent ?? "").trim().slice(0, 140), ...rect(element), visibility: getComputedStyle(element).visibility, clip: getComputedStyle(element).clipPath });
        const content = node.querySelector("[data-visual-host-content]")!, shell = node.firstElementChild!;
        return { dialog: rect(node), shell: rect(shell), padding: getComputedStyle(shell).padding, rows: getComputedStyle(shell).gridTemplateRows,
          hostTitle: measure(node.querySelector("h2")!), content: rect(content),
          graphParents: [...content.querySelectorAll("svg")].map(svg => rect(svg.parentElement!)),
          passed: [...content.querySelectorAll("[data-visual-content-width]")].map(element => ({ width: element.getAttribute("data-visual-content-width"), height: element.getAttribute("data-visual-content-height") })),
          math: [...content.querySelectorAll("h1,h2,h3,p,label,input,select,button,svg,[role=slider],[role=group]")].map(measure) };
      });
      for (const key of ["dialog", "shell", "padding", "rows", "hostTitle", "content", "passed"] as const) expect(actual[key], `${activity} ${stage}: ${key} absolute geometry`).toEqual(expected[key]);
      // Integration now owns a container-responsive layout. Its historical mathematical
      // pixels are intentionally superseded by integration-container.spec.ts; host
      // geometry and unchanged Roots still use the original immutable references.
      if (activity === "Integration") return;
      for (const key of ["graphParents", "math"] as const) expect(actual[key], `${activity} ${stage}: ${key} absolute geometry`).toEqual(expected[key]);
      await page.screenshot({ path: test.info().outputPath(`${activity}-${stage}-actual.png`), animations: "disabled", scale: "css" });
      const suppression = await page.addStyleTag({ content: '[data-visual-host-header], [data-visual-host-footer] { background: transparent !important; } [data-visual-host-header] button, [data-visual-host-footer] button, [data-visual-host-footer] p { visibility: hidden !important; }' });
      const png = await page.screenshot({ animations: "disabled", scale: "css" }); await suppression.evaluate(node => node.parentNode?.removeChild(node));
      const stem = `${activity === "Integration" ? "integration" : "roots"}-${stage}-${width}x${height}`;
      const original = await readFile(`${reference}${stem}.png`);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([width, height]);
      expect(png.equals(original), `${stem}: full-viewport image, including title and overflow`).toBe(true);
    }
    await page.getByRole("button", { name: "Start: Integration", exact: true }).click(); await compare("Integration", 1);
    const next = page.getByRole("dialog").getByRole("button", { name: "Next", exact: true }); await next.click(); await next.click();
    await page.getByRole("group", { name: /area/i }).getByRole("button").first().click(); await compare("Integration", 3);
    for (let i = 0; i < 4; i++) await next.click(); await compare("Integration", 7);
    await page.getByRole("button", { name: "Close interactive visual" }).click();
    await page.getByRole("button", { name: "Start: Roots and Factors", exact: true }).click(); await compare("Roots and Factors", "orientation");
    const slider = page.getByRole("dialog").getByRole("slider"); await slider.focus(); await page.keyboard.press("ArrowRight"); await next.click();
    await page.getByRole("button", { name: "(x + 3)", exact: true }).focus(); await page.keyboard.press("Enter");
    await slider.focus(); await page.keyboard.press("Home"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    await compare("Roots and Factors", "reveal-explanation");
  });
}
