import { expect, test, type Page } from "@playwright/test";
import { STAGE_THREE_START_DELAY_MS, STAGE_THREE_ANIMATION_DURATION_MS } from "../activities/integration-area/use-stage-motion";
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true }).click();
const previous = (page: Page) => page.getByRole("button", { name: "Previous", exact: true }).click();
const open = async (page: Page) => {
  await page.goto("/step-visuals");
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.getByRole("button", { name: "Integration", exact: true }).click();
  await page.locator("li").getByRole("button", { name: "Integration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1. Area under a graph", exact: true })).toBeVisible();
};
const toThree = async (page: Page) => { await open(page); await next(page); await next(page); };
const toStage = async (page: Page, stage: number) => {
  await toThree(page);
  if (stage === 3) return;
  await page.getByRole("button", { name: "It quadrupled", exact: true }).click();
  for (let i = 3; i < stage; i++) await next(page);
};
const graph = (page: Page) => page.locator("[data-integration-graph]");
const handle = (page: Page) => graph(page).getByRole("slider", { name: "Right boundary", exact: true });
const range = (page: Page) => page.locator('[data-integration-later] input[type="range"]');
const choose = (page: Page, label: string, value: string) => page.getByRole("combobox", { name: label, exact: true }).selectOption(value);
const answer = (page: Page) => page.getByRole("textbox", { name: "Your answer", exact: true });
const check = async (page: Page, value: string) => { await answer(page).fill(value); await page.getByRole("button", { name: "Check calculation", exact: true }).click(); };
const records = async (page: Page) => {
  const inspector = page.locator("details").filter({ has: page.getByText("Learning records", { exact: true }) });
  if (await inspector.getAttribute("open") === null) await inspector.locator("summary").click();
  return JSON.parse((await page.locator("[data-spv-records]").textContent())!);
};
test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });

test("Stage 3 halves the start delay only and preserves its continuous 900ms animation and prediction timing", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" }); await page.clock.install(); await toThree(page);
  expect(STAGE_THREE_START_DELAY_MS).toBe(2140); expect(STAGE_THREE_ANIMATION_DURATION_MS).toBe(900);
  const path = page.locator("[data-integration-region]");
  const initial = await path.getAttribute("d");
  await page.screenshot({ path: info.outputPath("03-growth-before-animation.png"), fullPage: true });
  await page.clock.runFor(2000); expect(await path.getAttribute("d")).toBe(initial);
  await expect(page.getByText("What happened to the shaded area?", { exact: true })).toHaveCount(0);
  await page.clock.runFor(350); expect(await path.getAttribute("d")).not.toBe(initial);
  await expect(page.getByRole("button", { name: "It doubled", exact: true })).toHaveCount(0);
  await page.clock.runFor(1000); await expect(page.getByRole("button", { name: "It quadrupled", exact: true })).toBeEnabled();
  await expect(page.locator("[data-integration-reference]")).toHaveCount(1);
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page.getByRole("button", { name: "y = x²", exact: true }).click();
  await page.clock.runFor(2460);
  await page.screenshot({ path: info.outputPath("03-growth-square-intermediate.png"), fullPage: true });
  await page.clock.runFor(800);
  await expect(graph(page).locator("svg")).toHaveAttribute("data-y-domain", "-3,18");
  await expect(page.locator("[data-integration-plane]")).toContainText("16");
  await expect(page.getByRole("button", { name: "It increased eightfold", exact: true })).toBeEnabled();
  expect(await page.locator("[data-integration-later]").textContent()).not.toMatch(/8\/3|64\/3|b³/);
});

test("Stage 3 cached function replays then restores its first answer without duplicate evidence", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" }); await page.clock.install(); await toThree(page);
  await page.getByRole("button", { name: "y = x", exact: true }).click();
  await page.clock.runFor(5400); await page.getByRole("button", { name: "It doubled", exact: true }).click();
  await page.getByRole("button", { name: "y = 2", exact: true }).click(); await page.clock.runFor(5400);
  await page.getByRole("button", { name: "It doubled", exact: true }).click();
  await page.getByRole("button", { name: "y = x", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  await expect(page.getByText("Not quite. The area actually quadrupled.", { exact: true })).toHaveCount(0);
  await page.clock.runFor(5400);
  await expect(page.locator("p").getByText("Not quite. The area actually quadrupled.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "It doubled", exact: true })).toHaveAttribute("aria-pressed", "true");
  await next(page); await previous(page);
  await expect(page.getByRole("button", { name: "It doubled", exact: true })).toHaveAttribute("aria-pressed", "true");
  const snapshot = await records(page);
  expect(snapshot.records.current.predictions).toHaveLength(2);
  expect(snapshot.records.events.filter((e: { type: string }) => e.type === "comparison-demonstrated")).toHaveLength(2);
});

test("Stage 4 both constructions, six-stop control, tab memory and exact tooltip", async ({ page }) => {
  await toStage(page, 4);
  const geometry = await graph(page).boundingBox();
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.locator("[data-integration-enclosing]")).toHaveCount(1);
  await page.getByRole("button", { name: "y = x²", exact: true }).click();
  await expect(range(page)).toHaveAttribute("max", "5");
  await expect(page.locator('[data-rectangle-role="lower"]')).toHaveCount(4);
  await expect(page.locator('[data-rectangle-role="upper"]')).toHaveCount(4);
  await expect(page.getByText("≈ 5.9", { exact: true })).toBeVisible(); await expect(page.getByText("≈ 12.7", { exact: true })).toBeVisible();
  await range(page).press("End");
  await expect(page.locator('[data-rectangle-role="lower"]')).toHaveCount(128);
  await expect(page.getByText("≈ 8.9", { exact: true })).toBeVisible(); await expect(page.getByText("≈ 9.1", { exact: true })).toBeVisible();
  const term = page.getByRole("button", { name: "Why exactly one-third?", exact: true });
  await term.focus(); await page.keyboard.press("Enter");
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText("Differentiation confirms it.");
  await expect(tip.getByRole("math", { name: /d over db.*b³ over 3.*b²/ })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(tip).toHaveCount(0); await expect(term).toBeFocused();
  await page.getByRole("button", { name: "y = x", exact: true }).click();
  await page.getByRole("button", { name: "y = x²", exact: true }).click();
  await expect(range(page)).toHaveValue("5");
  expect(await graph(page).boundingBox()).toEqual(geometry);
});

test("Stage 5 tracks continuously, smoothly settles, preserves exclusion and has an honest zero annotation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" }); await toStage(page, 5);
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "3");
  await range(page).press("End");
  const geometry = await graph(page).boundingBox(), plane = await page.locator("[data-integration-plane]").innerHTML();
  const excluded = await page.locator("[data-integration-excluded]").getAttribute("d");
  const box = (await handle(page).boundingBox())!, unit = ((await graph(page).boundingBox())!.width - 54) / 5;
  await page.mouse.move(box.x + 24, box.y + 24); await page.mouse.down(); await page.mouse.move(box.x + 24 - 1.66 * unit, box.y + 24);
  expect(Number(await handle(page).getAttribute("aria-valuenow"))).toBeCloseTo(2.34, 5);
  await page.evaluate(() => {
    const samples: number[] = []; (window as unknown as { samples: number[] }).samples = samples;
    const node = document.querySelector('[data-integration-graph] [role="slider"]')!;
    const observer = new MutationObserver(() => { samples.push(Number(node.getAttribute("aria-valuenow"))); if (node.getAttribute("aria-valuenow") === "2") observer.disconnect(); });
    observer.observe(node, { attributes: true, attributeFilter: ["aria-valuenow"] });
  });
  await page.mouse.up(); await expect(handle(page)).toHaveAttribute("aria-valuenow", "2");
  expect(await page.evaluate(() => (window as unknown as { samples: number[] }).samples.some(v => v > 2 && v < 2.34))).toBe(true);
  expect(await page.locator("[data-integration-excluded]").getAttribute("d")).toBe(excluded);
  await range(page).press("Home");
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "1");
  await expect(page.locator('[data-integration-annotation="Area we want = 0"]')).toHaveCount(1);
  await expect(page.locator('[data-integration-annotation="Area we want"]')).toHaveCount(0);
  await expect(page.locator("[data-integration-region]")).toHaveCount(0);
  await expect(graph(page).getByText("a = 1", { exact: true })).toBeVisible(); await expect(graph(page).getByText("b = 1", { exact: true })).toBeVisible();
  await range(page).press("ArrowRight"); await expect(page.locator('[data-integration-annotation="Area we want"]')).toHaveCount(1);
  const term = page.getByRole("button", { name: "constant of integration", exact: true });
  await term.click(); await expect(page.getByRole("tooltip")).toContainText("A different starting point would give a different constant.");
  await expect(page.getByRole("tooltip").getByRole("math", { name: /A\(b\).*b² over 2/ })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await graph(page).boundingBox()).toEqual(geometry); expect(await page.locator("[data-integration-plane]").innerHTML()).toBe(plane);
});

test("Stage 6 left-stacked selectors/right slider, reversals, crossing lobes and continuous release", async ({ page }) => {
  await toStage(page, 6);
  const geometry = await graph(page).boundingBox(), plane = await page.locator("[data-integration-plane]").innerHTML();
  const original = await page.locator("[data-integration-region]").getAttribute("d");
  const first = (await page.getByRole("combobox", { name: "First curve", exact: true }).boundingBox())!, second = (await page.getByRole("combobox", { name: "Second curve", exact: true }).boundingBox())!, slider = (await range(page).boundingBox())!;
  expect(first.x).toBe(second.x); expect(second.y).toBeGreaterThan(first.y); expect(slider.x).toBeGreaterThan(first.x + first.width);
  await choose(page, "First curve", "lower"); await choose(page, "Second curve", "rising");
  expect(await page.locator("[data-integration-region]").getAttribute("d")).toBe(original);
  await choose(page, "Second curve", "axis"); await range(page).press("End");
  await expect(page.locator("[data-integration-region]")).toHaveCount(2);
  await expect(page.locator("p").getByText("The curves cross at x = 3. The curve on top changes there, so we add the areas on both sides.", { exact: true })).toBeVisible();
  await expect(page.getByRole("math", { name: "Area = Integral from a to b of |x² − 3x| with respect to x", exact: true })).toBeVisible();
  const box = (await handle(page).boundingBox())!;
  await page.mouse.move(box.x + 24, box.y + 24); await page.mouse.down(); await page.mouse.move(box.x + 5, box.y + 24); await page.mouse.up();
  const value = Number(await handle(page).getAttribute("aria-valuenow"));
  expect(value).toBeGreaterThan(3); expect(value).toBeLessThan(4); expect(value).not.toBe(Math.round(value * 10) / 10);
  await choose(page, "First curve", "axis");
  await expect(page.locator("[data-integration-region]")).toHaveCount(0); await expect(page.locator("[data-integration-strip]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Check/ })).toHaveCount(0);
  expect(await graph(page).boundingBox()).toEqual(geometry); expect(await page.locator("[data-integration-plane]").innerHTML()).toBe(plane);
});

test("Stage 7 all controls coexist; empty input is not assessed; edits require rechecking and recap uses latest check", async ({ page }) => {
  await toStage(page, 7);
  await expect(page.getByRole("heading", { name: "Choose what area to measure", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose where to measure", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Calculate the area", exact: true })).toBeVisible();
  await expect(page.getByRole("math", { name: /Integral from 1 to 2 of 9 \+ 2x − 3x²/ })).toBeVisible();
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page.getByRole("button", { name: "Check calculation", exact: true }).click();
  await expect(page.locator("p").getByText("Enter an area before checking.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Finish", exact: true })).toBeDisabled();
  await check(page, "5");
  await expect(page.getByRole("button", { name: "Finish", exact: true })).toBeEnabled();
  await answer(page).fill("6");
  await expect(page.getByRole("button", { name: "Finish", exact: true })).toBeDisabled();
  await expect(page.locator("p").getByText("Correct! The shaded area is 5 square units.", { exact: true })).toHaveCount(0);
  await answer(page).fill("5"); await expect(page.getByRole("button", { name: "Finish", exact: true })).toBeDisabled();
  await check(page, "6"); await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByText("Your answer: 6 square units", { exact: true })).toBeVisible();
  await expect(page.getByText("Correct area: 5 square units", { exact: true })).toBeVisible();
  const snapshot = await records(page);
  expect(snapshot.records.current.checks.map((c: { submitted: number }) => c.submitted)).toEqual([5, 6]);
  expect(snapshot.records.completedAttempts[0]).toMatchObject({ schemaVersion: 2, outcome: "incorrect", area: 5, finalCalculation: { submitted: 6 } });
  expect(snapshot.receivedCompletions).toHaveLength(1);
  await page.getByRole("button", { name: "Start again", exact: true }).click();
  expect((await records(page)).records.completedAttempts).toHaveLength(1);
});

test("Stage 7 hint evidence persists, changing choices clears stale work and correct Finish is explicit", async ({ page }) => {
  await toStage(page, 7); await check(page, "6");
  await expect(page.getByText("Correct area: 5 square units", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show hint", exact: true }).click();
  await expect(page.getByRole("tooltip")).toContainText("Use the power rule to integrate each term. Then subtract the lower value from the upper value.");
  await choose(page, "Second curve", "axis");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(answer(page)).toHaveValue(""); await expect(page.getByRole("button", { name: "Finish", exact: true })).toBeDisabled();
  await page.getByRole("radio", { name: "From 0 to 2", exact: true }).check();
  await check(page, "22"); await expect(answer(page)).not.toBeFocused();
  await expect(page.getByRole("heading", { name: "Your area calculation", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  expect((await records(page)).records.completedAttempts[0]).toMatchObject({ outcome: "correct", successMode: "assisted", area: 22 });
});

test("Stage 7 identical selections have zero integrand and their specific optional hint", async ({ page }) => {
  await toStage(page, 7); await choose(page, "Second curve", "upper");
  await expect(page.locator("[data-integration-region]")).toHaveCount(0); await expect(page.locator("[data-integration-strip]")).toHaveCount(0);
  await expect(page.getByRole("math", { name: /Integral from 1 to 2 of 0/ })).toBeVisible();
  await check(page, "1"); await page.getByRole("button", { name: "Show hint", exact: true }).click();
  await expect(page.getByRole("tooltip")).toContainText("The two curves are the same, so the height between them is 0 everywhere.");
  await page.keyboard.press("Escape"); await check(page, "0"); await page.getByRole("button", { name: "Finish", exact: true }).click();
  expect((await records(page)).records.completedAttempts[0]).toMatchObject({ area: 0, successMode: "assisted" });
});

test("drag interruptions cancel without changing settled state or evidence", async ({ page }) => {
  await toStage(page, 5); const initial = await handle(page).getAttribute("aria-valuenow");
  const box = (await handle(page).boundingBox())!;
  await page.mouse.move(box.x + 24, box.y + 24); await page.mouse.down(); await page.mouse.move(box.x - 35, box.y + 24);
  await page.getByRole("button", { name: "Open visualisations menu" }).evaluate(node => (node as HTMLButtonElement).click());
  await page.mouse.up(); await page.getByRole("button", { name: "Close visualisations menu" }).click();
  await expect(handle(page)).toHaveAttribute("aria-valuenow", initial!);
  const snapshot = await records(page);
  expect(snapshot.records.events.filter((e: { type: string }) => e.type === "boundary-committed")).toHaveLength(0);
});

test("200% text and narrow screens reflow without row overlap or horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await toThree(page);
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await page.getByRole("button", { name: "It quadrupled", exact: true }).click();
  for (let stage = 3; stage <= 7; stage++) {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const rows = await page.locator("[data-integration-later]").evaluate(node => [...node.children].map(child => { const box = child.getBoundingClientRect(); return { top: box.top, bottom: box.bottom }; }));
    for (let i = 1; i < rows.length; i++) expect(rows[i].top).toBeGreaterThanOrEqual(rows[i - 1].bottom);
    if (stage === 4) {
      await page.getByRole("button", { name: "The rule", exact: true }).click();
      await expect(page.getByText("n ≠ −1", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await page.getByRole("button", { name: "y = x²", exact: true }).click(); await range(page).press("End");
    }
    if (stage !== 7) await next(page);
  }
  await check(page, "6"); await page.getByRole("button", { name: "Show hint", exact: true }).click();
  const tip = (await page.getByRole("tooltip").boundingBox())!;
  expect(tip.x).toBeGreaterThanOrEqual(8); expect(tip.x + tip.width).toBeLessThanOrEqual(382);
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Start again", exact: true }).click();
  await page.addStyleTag({ content: "html { font-size: 100%; }" }); await page.setViewportSize({ width: 320, height: 568 });
  await next(page); await next(page); await page.getByRole("button", { name: "It quadrupled", exact: true }).click();
  await next(page); await next(page); await range(page).press("Home");
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "1");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

for (const viewport of [{ width: 414, height: 896 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) test("all later stages fit at " + viewport.width + " × " + viewport.height, async ({ page }) => {
  await page.setViewportSize(viewport); await toStage(page, 4);
  for (let stage = 4; stage <= 7; stage++) {
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height);
    expect((await graph(page).boundingBox())!.height).toBeGreaterThanOrEqual(200);
    if (stage !== 7) await next(page);
  }
});
