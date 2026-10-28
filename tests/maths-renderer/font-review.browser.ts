import { expect, test, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/dev/maths-renderer/ExplanationReviewFixtures.tsx", "utf8");
const originals = [...source.matchAll(/content:\s*String\.raw`([^`]+)`/g)].map(match => match[1]);

test("open-font review preserves sources, maths, actual constraints and taller height results", async ({ page, browserName }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/dev/maths-fonts");
  await expect(page.locator("[data-font-profile]")).toHaveCount(3);
  await expect.poll(() => page.locator("[data-font-result]").evaluateAll(nodes => nodes.length === 24 && nodes.every(node => JSON.parse(node.textContent!)?.status === "ready"))).toBe(true);
  const results = [];
  for (const profile of ["current", "liberation", "arimo"]) {
    const section = page.locator(`[data-font-profile='${profile}']`);
    for (let i = 0; i < 5; i++) {
      const example = section.locator("[data-font-example]").nth(i);
      await expect(example.locator("[data-font-source]")).toHaveText(originals[i]);
      await expect(example.locator("math")).toHaveCount([3, 1, 4, 4, 1][i]);
      const result = JSON.parse((await example.locator("[data-font-result]").textContent())!);
      expect(result.diagnostics).toEqual([]);
      const geometry = await example.locator("[data-font-frame]").evaluate(frame => {
        const budget = frame.querySelector("[data-font-budget]")!, root = budget.querySelector("[data-maths-renderer]")!;
        const math = root.querySelector(".katex")!;
        return { frame: [frame.getBoundingClientRect().width, frame.getBoundingClientRect().height], budget: [budget.getBoundingClientRect().width, budget.getBoundingClientRect().height],
          font: getComputedStyle(root).fontSize, math: getComputedStyle(math).fontSize, indent: parseFloat(getComputedStyle(root.querySelector("[data-maths-expression='display']")!).paddingInlineStart),
          overflow: getComputedStyle(root).overflow };
      });
      expect(geometry.frame).toEqual([240, 157]); expect(geometry.budget[0]).toBe(214);
      expect(Math.abs(geometry.budget[1] - result.layout.available.height)).toBeLessThan(.001);
      expect([geometry.font, geometry.math, geometry.overflow]).toEqual(["9.5px", "9.5px", "visible"]);
      expect(geometry.indent).toBe(9.5); results.push({ profile, example: i + 1, geometry, result });
    }
    const small = JSON.parse((await section.locator("[data-font-panel='160'] [data-font-result]").textContent())!);
    const large = JSON.parse((await section.locator("[data-font-panel='320'] [data-font-result]").textContent())!);
    expect(small.layout.available).toEqual({ width: 214, height: 160 }); expect(small.fits).toBe(false); expect(small.layout.overflowY).toBe(true);
    expect(large.layout.available).toEqual({ width: 214, height: 320 });
    expect(large.layout.excess.bottom).toBe(0); expect(large.layout.height).toBeLessThan(320);
    // Firefox's already-documented top overhang is independent of this bottom
    // allocation. Keep its result visible; do not change the fit threshold.
    if (browserName !== "firefox") expect(large.fits).toBe(true);
    // Independent boxes far down the page can differ by ~0.00025px after
    // viewport-coordinate subtraction. This is a geometry comparison only.
    expect(Math.abs(large.layout.height - small.layout.height)).toBeLessThan(.001);
    results.push({ profile, tall: { small, large } });
  }
  expect(errors).toEqual([]);
  await info.attach("font-profile-measurements", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  // Full-page capture can itself resize the viewport and invalidate otherwise
  // ready results. Establish the capture size first, then await callbacks.
  await page.setViewportSize({ width: page.viewportSize()!.width, height: await page.evaluate(() => document.documentElement.scrollHeight) });
  await expect.poll(() => page.locator("[data-font-result]").evaluateAll(nodes => nodes.every(node => JSON.parse(node.textContent!)?.status === "ready"))).toBe(true);
  await page.screenshot({ path: info.outputPath("font-comparison.png") });
});

test("Chromium verifies actual candidate prose, serif styles and unchanged KaTeX fonts", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium", "Actual platform font inspection uses Chromium CDP");
  await page.goto("/dev/maths-fonts");
  await expect.poll(() => page.locator("[data-font-result]").evaluateAll(nodes => nodes.length === 24 && nodes.every(node => JSON.parse(node.textContent!)?.status === "ready"))).toBe(true);
  const cdp = await page.context().newCDPSession(page); await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const fonts = [];
  for (const profile of ["liberation", "arimo"]) {
    const section = page.locator(`[data-font-profile='${profile}']`);
    const probes = await section.evaluate((section, profile) => {
      const bold = [...section.querySelectorAll("[data-font-example='3'] .boldsymbol")].find(node => [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()))!;
      const nodes = [section.querySelectorAll("[data-font-example='1'] [data-maths-paragraph]")[1], bold];
      const text = document.createTreeWalker(section.querySelector("[data-font-panel='reading']")!, NodeFilter.SHOW_TEXT);
      while (text.nextNode()) if (text.currentNode.textContent === "€" && !text.currentNode.parentElement!.closest(".katex-mathml")) nodes.push(text.currentNode.parentElement!);
      return nodes.map((node, i) => { const id = `${profile}-${i}`; node.setAttribute("data-font-probe", id); return { selector: `[data-font-probe='${id}']`, css: getComputedStyle(node).fontFamily }; });
    }, profile);
    const actual = [];
    for (const probe of probes) {
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: probe.selector });
      actual.push({ ...probe, fonts: (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts });
    }
    expect(actual[0].fonts.some(face => face.familyName.toLowerCase().includes(profile === "arimo" ? "arimo" : "liberation"))).toBe(true);
    expect(actual[1].fonts.some(face => face.familyName.startsWith("KaTeX"))).toBe(true);
    expect(actual.slice(2)).toHaveLength(4);
    expect(actual.slice(2).every(entry => entry.fonts.some(face => face.isCustomFont && face.familyName.toLowerCase().includes(profile === "arimo" ? "tinos" : "liberation serif")))).toBe(true);
    fonts.push({ profile, actual });
  }
  await info.attach("actual-open-fonts", { body: JSON.stringify(fonts, null, 2), contentType: "application/json" });
  await cdp.detach();
});

test("font review is readable on mobile WebKit over the existing Wi-Fi server", async ({ browser, browserName }, info) => {
  test.skip(browserName !== "webkit", "Mobile Safari profile uses WebKit");
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  try {
    const page = await context.newPage(); const response = await page.goto("http://192.168.1.38:4181/dev/maths-fonts");
    expect(response?.status()).toBe(200); await expect(page.getByRole("heading", { name: "Open fonts · visual comparison" })).toBeVisible();
    await expect.poll(() => page.locator("[data-font-result]").evaluateAll(nodes => nodes.length === 24 && nodes.every(node => JSON.parse(node.textContent!)?.status === "ready"))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: page.viewportSize()!.width, height: await page.evaluate(() => document.documentElement.scrollHeight) });
    await expect.poll(() => page.locator("[data-font-result]").evaluateAll(nodes => nodes.every(node => JSON.parse(node.textContent!)?.status === "ready"))).toBe(true);
    await page.screenshot({ path: info.outputPath("iphone-font-comparison.png") });
  } finally { await context.close(); }
});
