import { expect, test, type Page } from "@playwright/test";
import { rootsFactorsLayout } from "../activities/roots-factors/rootsFactorsLayout";

const slider = (page: Page) => page.getByRole("slider", { name: "Movable root" });
const graph = (page: Page) => page.getByRole("img", { name: "Quadratic graph", exact: true });
const host = (page: Page) => page.locator("[data-spv-settled-root]");
const screenPoint = async (page: Page, root: number) => graph(page).evaluate((element, value) => {
  const svg = element as SVGSVGElement;
  const clip = svg.querySelector("clipPath rect")!;
  const current = Number(svg.parentElement!.getAttribute("data-spv-graphical-root"));
  const fixed = svg.querySelector('[data-spv-root="fixed-root"] circle')!.getBoundingClientRect();
  const moving = svg.querySelector('[data-spv-root="moving-root"] circle')!.getBoundingClientRect();
  const centre = { x: moving.x + moving.width / 2, y: moving.y + moving.height / 2 };
  if (current !== 1) return { x: centre.x + (value - current) * (centre.x - fixed.x - fixed.width / 2) / (current - 1), y: centre.y + (value - current) * (centre.y - fixed.y - fixed.height / 2) / (current - 1) };
  const bounds = svg.getBoundingClientRect();
  return { x: bounds.x + (Number(clip.getAttribute("x")) + Number(clip.getAttribute("width")) * (value + 6) / 12) * bounds.width / svg.viewBox.baseVal.width, y: bounds.y + (Number(clip.getAttribute("y")) + Number(clip.getAttribute("height")) / 2) * bounds.height / svg.viewBox.baseVal.height };
}, root);
const value = async (page: Page, root: number) => expect(slider(page)).toHaveAttribute("aria-valuenow", String(root));
const expectPointerPosition = async (page: Page, expected: number) => {
  // Native WebKit mouse input rounds client coordinates to CSS pixels. A continuous
  // root follows that delivered input, not the subpixel coordinate requested by CDP.
  const pixel = await graph(page).evaluate((element) => {
    const svg = element as SVGSVGElement;
    const plotWidth = Number(svg.querySelector("clipPath rect")!.getAttribute("width"));
    return 12 / (plotWidth * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width);
  });
  expect(Number.isFinite(pixel) && pixel > 0).toBe(true);
  const actual = Number(await host(page).getAttribute("data-spv-graphical-root"));
  expect(Math.abs(actual - expected)).toBeLessThan(pixel + 0.000001);
};
const beginDrag = async (page: Page, offset = 0) => {
  const current = Number(await slider(page).getAttribute("aria-valuenow"));
  const start = await screenPoint(page, current);
  await page.mouse.move(start.x + offset, start.y);
  await page.mouse.down();
  await expect(host(page)).toHaveAttribute("data-spv-editing", "true");
  return start;
};

test.beforeEach(async ({ page }) => {
  await page.goto("/step-visuals");
  await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
  await page.getByRole("combobox", { name: "Layout preview" }).selectOption("orientation");
});

test("dragging synchronises preview geometry, factors and position before committing", async ({ page }) => {
  const before = await graph(page).locator("[data-spv-curve]").getAttribute("d");
  await beginDrag(page);
  const point = await screenPoint(page, 4);
  await page.mouse.move(point.x, point.y);
  await value(page, 4);
  await expect(host(page)).toHaveAttribute("data-spv-settled-root", "3");
  await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times (x − 4)");
  expect(await graph(page).locator("[data-spv-curve]").getAttribute("d")).not.toBe(before);
  await page.mouse.up();
  await expect(graph(page)).toHaveAccessibleDescription(/Vertex at \(2.5, −2.25\)/);
  await expect(host(page)).toHaveAttribute("data-spv-settled-root", "4");
  await expect(host(page)).toHaveAttribute("data-spv-editing", "false");
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
});

test("off-centre grabs do not jump; snapping respects half steps and endpoints", async ({ page }) => {
  const start = await beginDrag(page, 18);
  await value(page, 3);
  const four = await screenPoint(page, 4);
  await page.mouse.move(four.x + 18, start.y);
  await value(page, 4);
  await page.mouse.move(four.x + 500, start.y);
  await value(page, 5);
  await page.mouse.move(start.x - 500, start.y);
  await value(page, 0);
  await page.mouse.up();
  await slider(page).focus();
  await page.keyboard.press("ArrowLeft");
  await value(page, 0);
});

test("final release coordinates, not the last preview, determine the commit", async ({ page }) => {
  await beginDrag(page);
  const final = await screenPoint(page, 5);
  await slider(page).dispatchEvent("pointerup", { pointerId: 1, clientX: final.x, clientY: final.y, button: 0, isPrimary: true });
  await page.mouse.up();
  await value(page, 5);
  await expect(host(page)).toHaveAttribute("data-spv-settled-root", "5");
});

test("pointer cancellation restores the settled root and ignores late events", async ({ page }) => {
  await beginDrag(page);
  const four = await screenPoint(page, 4);
  await page.mouse.move(four.x, four.y);
  await value(page, 4);
  await slider(page).dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await value(page, 3);
  await page.mouse.move(four.x + 40, four.y);
  await page.mouse.up();
  await value(page, 3);
  await expect(host(page)).toHaveAttribute("data-spv-editing", "false");
});

test("rounded labels change only across integer midpoints and coincidence remains draggable", async ({ page }) => {
  await beginDrag(page);
  for (const [coordinate, root] of [[3.49, 3], [3.51, 4], [4.49, 4], [4.51, 5]]) {
    const point = await screenPoint(page, coordinate);
    // Precise browser PointerEvents test both sides of the midpoint independently
    // of native mouse pixel quantisation. Other drag tests use real mouse input.
    await slider(page).dispatchEvent("pointermove", { pointerId: 1, clientX: point.x, clientY: point.y, buttons: 1, isPrimary: true });
    await value(page, root);
    expect(Number(await host(page).getAttribute("data-spv-graphical-root"))).toBeCloseTo(coordinate, 5);
  }
  await page.mouse.up();
  await slider(page).focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await beginDrag(page);
  const two = await screenPoint(page, 2);
  await page.mouse.move(two.x, two.y);
  await page.mouse.up();
  await value(page, 2);
});

test("fractional dragging moves marker and accurate curve together while notation stays integer-only", async ({ page }) => {
  const baseline = await graph(page).evaluate((element) => ({ rect: element.getBoundingClientRect().toJSON(), box: element.getAttribute("viewBox"), axes: element.children[4].outerHTML }));
  await beginDrag(page);
  let previousPath = await graph(page).locator("[data-spv-curve]").getAttribute("d");
  for (const [root, label] of [[3.1, 3], [3.25, 3], [3.4, 3], [3.6, 4], [3.9, 4]]) {
    const point = await screenPoint(page, root);
    await page.mouse.move(point.x, point.y);
    await value(page, label);
    const actualRoot = Number(await host(page).getAttribute("data-spv-graphical-root"));
    await expectPointerPosition(page, root);
    expect(Number.isInteger(actualRoot)).toBe(false);
    await expect(host(page)).toHaveAttribute("data-spv-settled-root", "3");
    await expect(graph(page).locator('[data-spv-root="moving-root"] text')).toHaveText(`x = ${label}`);
    await expect(page.locator("[data-spv-adjustments]")).toHaveCount(0);
    await expect(page.getByRole("math")).toHaveAccessibleName(`f of x equals (x − 1) times (x − ${label})`);
    const geometry = await graph(page).evaluate((element) => {
      const svg = element as SVGSVGElement;
      const marker = svg.querySelector('[data-spv-root="moving-root"] circle')!;
      return { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height, x: Number(marker.getAttribute("cx")), y: Number(marker.getAttribute("cy")) };
    });
    const expected = rootsFactorsLayout({ movingRoot: actualRoot }, geometry);
    expect(geometry.x).toBeCloseTo(expected.graph.roots.markers[1].center.x, 8);
    expect(geometry.y).toBeCloseTo(expected.graph.roots.markers[1].center.y, 8);
    const path = await graph(page).locator("[data-spv-curve]").getAttribute("d");
    expect(path).toBe(expected.graph.curve.path);
    expect(path).not.toBe(previousPath);
    expect(path).not.toBe(rootsFactorsLayout({ movingRoot: label }, geometry).graph.curve.path);
    previousPath = path;
    expect(await graph(page).evaluate((element) => ({ rect: element.getBoundingClientRect().toJSON(), box: element.getAttribute("viewBox"), axes: element.children[4].outerHTML }))).toEqual(baseline);
  }
  await page.mouse.up();
  await expect(host(page)).toHaveAttribute("data-spv-graphical-root", "4");
  await expect(host(page)).toHaveAttribute("data-spv-settled-root", "4");
  await expect(host(page)).toHaveAttribute("data-spv-editing", "false");
  const size = await graph(page).evaluate((element) => ({ width: (element as SVGSVGElement).viewBox.baseVal.width, height: (element as SVGSVGElement).viewBox.baseVal.height }));
  expect(await graph(page).locator("[data-spv-curve]").getAttribute("d")).toBe(rootsFactorsLayout({ movingRoot: 4 }, size).graph.curve.path);
});

test("continuous negative dragging, fractional cancellation and final-coordinate snapping", async ({ page }) => {
  await page.getByRole("combobox", { name: "Layout preview" }).selectOption("retrieval");
  await beginDrag(page);
  for (const [root, label] of [[-3.25, -3], [-3.6, -4], [-4.99, -5], [-5.5, -5]]) {
    const point = await screenPoint(page, root);
    await page.mouse.move(point.x, point.y);
    await value(page, label);
    await expectPointerPosition(page, Math.max(-5, root));
    await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times a hidden factor");
  }
  await slider(page).dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await page.mouse.up();
  await expect(host(page)).toHaveAttribute("data-spv-graphical-root", "-3");
  await beginDrag(page);
  const intermediate = await screenPoint(page, -3.25);
  await page.mouse.move(intermediate.x, intermediate.y);
  const final = await screenPoint(page, -3.7);
  await slider(page).dispatchEvent("pointerup", { pointerId: 1, clientX: final.x, clientY: final.y, button: 0, isPrimary: true });
  await page.mouse.up();
  await expect(host(page)).toHaveAttribute("data-spv-graphical-root", "-4");
  await expect(host(page)).toHaveAttribute("data-spv-settled-root", "-4");
});

test("diagnostic continuous frame updates keep curve and marker coherent", async ({ page, browserName }) => {
  await beginDrag(page);
  const start = await screenPoint(page, 3);
  const end = await screenPoint(page, 4);
  const report = await slider(page).evaluate(async (element, points) => {
    const surface = element.parentElement!;
    const svg = surface.querySelector("svg")!;
    const path = svg.querySelector("[data-spv-curve]")!;
    const marker = svg.querySelector('[data-spv-root="moving-root"] circle')!;
    const clip = svg.querySelector("clipPath rect")!;
    const px = Number(clip.getAttribute("x"));
    const py = Number(clip.getAttribute("y"));
    const width = Number(clip.getAttribute("width"));
    const height = Number(clip.getAttribute("height"));
    const timings: number[] = [];
    const roots: number[] = [];
    let incoherent = 0;
    for (let index = 1; index <= 30; index++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const elapsed = await new Promise<number>((resolve, reject) => {
        const began = performance.now();
        const observer = new MutationObserver(() => {
          clearTimeout(timeout);
          observer.disconnect();
          resolve(performance.now() - began);
        });
        const timeout = setTimeout(() => { observer.disconnect(); reject(new Error("Continuous frame did not render")); }, 2000);
        observer.observe(path, { attributes: true, attributeFilter: ["d"] });
        element.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, isPrimary: true, buttons: 1,
          clientX: points.start.x + (points.end.x - points.start.x) * index / 30, clientY: points.start.y }));
      });
      timings.push(elapsed);
      const root = Number(surface.getAttribute("data-spv-graphical-root"));
      roots.push(root);
      const first = /^M([^,]+),([^L]+)/.exec(path.getAttribute("d")!);
      // First sample is x = −6: f(−6) = 7(6 + r). Both DOM attributes
      // must describe the same real-valued reducer commit, never separate loops.
      const expectedX = px + width * (root + 6) / 12;
      const expectedFirstY = py + height * (10 - 7 * (6 + root)) / 20;
      if (Math.abs(Number(marker.getAttribute("cx")) - expectedX) > 0.00001 ||
          !first || Math.abs(Number(first[2]) - expectedFirstY) > 0.00001) incoherent++;
    }
    const sorted = [...timings].sort((a, b) => a - b);
    return { frames: roots.length, distinctRoots: new Set(roots).size, fractionalFrames: roots.filter((root) => !Number.isInteger(root)).length,
      incoherent, medianEventToDOMMs: sorted[15], p95EventToDOMMs: sorted[28] };
  }, { start, end });
  expect(report.frames).toBe(30);
  expect(report.distinctRoots).toBe(30);
  expect(report.fractionalFrames).toBeGreaterThanOrEqual(29);
  expect(report.incoherent).toBe(0);
  console.log(JSON.stringify({ environment: `${browserName} local synthetic pointer diagnostic; not a phone guarantee`, ...report }));
  await page.mouse.up();
});

test("unexpected capture loss cancels instead of submitting a placement", async ({ page }) => {
  await beginDrag(page);
  const four = await screenPoint(page, 4);
  await page.mouse.move(four.x, four.y);
  await slider(page).evaluate((element) => element.releasePointerCapture(1));
  await page.mouse.move(four.x + 1, four.y);
  await page.mouse.up();
  await value(page, 3);
});

test("keyboard respects bounds and retains focus through coincident roots", async ({ page }) => {
  await slider(page).focus();
  await page.keyboard.press("Home");
  await value(page, 0);
  await page.keyboard.press("ArrowLeft");
  await value(page, 0);
  await page.keyboard.press("ArrowRight");
  await value(page, 1);
  await expect(slider(page)).toBeFocused();
  const circles = await graph(page).locator("[data-spv-root] circle").evaluateAll((elements) => elements.map((element) => ({ x: element.getAttribute("cx"), y: element.getAttribute("cy"), radius: element.getAttribute("r") })));
  expect(circles[0].x).toBe(circles[1].x);
  expect(circles[0].y).toBe(circles[1].y);
  expect(circles[0].radius).not.toBe(circles[1].radius);
  await expect(graph(page)).toHaveAccessibleDescription(/Vertex at \(1, 0\)/);
  await page.keyboard.press("End");
  await value(page, 5);
  await page.keyboard.press("ArrowRight");
  await value(page, 5);
  await page.keyboard.press("ArrowLeft");
  await value(page, 4);
});

test("locked previews reject manipulation; retrieval stays masked and cannot complete", async ({ page }) => {
  for (const mode of ["prediction", "incorrect-reveal", "assistance"]) {
    await page.getByRole("combobox", { name: "Layout preview" }).selectOption(mode);
    await expect(slider(page)).toHaveAttribute("aria-disabled", "true");
    const previous = await slider(page).getAttribute("aria-valuenow");
    await slider(page).dispatchEvent("keydown", { key: "End" });
    await expect(slider(page)).toHaveAttribute("aria-valuenow", previous!);
  }
  await page.getByRole("combobox", { name: "Layout preview" }).selectOption("retrieval");
  await slider(page).focus();
  await page.keyboard.press("ArrowLeft");
  await value(page, -4);
  await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times a hidden factor");
  await expect(page.getByRole("button", { name: "Check", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Activity complete" })).toHaveCount(0);
});

test("resize, focus interruption and menu suspension cancel active edits", async ({ page }) => {
  await beginDrag(page);
  let four = await screenPoint(page, 4);
  await page.mouse.move(four.x, four.y);
  await page.setViewportSize({ width: 360, height: 640 });
  await value(page, 3);
  await page.mouse.up();
  await beginDrag(page);
  four = await screenPoint(page, 4);
  await page.mouse.move(four.x, four.y);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await value(page, 3);
  await page.mouse.up();
  await beginDrag(page);
  await page.mouse.move(four.x, four.y);
  await page.getByRole("button", { name: "Open visualisations menu" }).dispatchEvent("click");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await value(page, 3);
});

test("secondary pointers and revision-stale events cannot steal the edit", async ({ page }) => {
  await beginDrag(page);
  const five = await screenPoint(page, 5);
  await slider(page).dispatchEvent("pointerdown", { pointerId: 2, isPrimary: false, button: 0, clientX: five.x, clientY: five.y });
  await slider(page).dispatchEvent("pointermove", { pointerId: 2, isPrimary: false, clientX: five.x, clientY: five.y });
  await value(page, 3);
  await page.getByRole("combobox", { name: "Layout preview" }).selectOption("incorrect-reveal");
  await slider(page).dispatchEvent("pointerup", { pointerId: 1, isPrimary: true, clientX: five.x, clientY: five.y });
  await page.mouse.up();
  await value(page, -3);
});

test("document visibility interruption restores settled maths", async ({ page }) => {
  await beginDrag(page);
  const four = await screenPoint(page, 4);
  await page.mouse.move(four.x, four.y);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    delete (document as unknown as { hidden?: boolean }).hidden;
  });
  await page.mouse.up();
  await value(page, 3);
});

test("committed root survives menu dismissal/current selection and resets on leaving the experience", async ({ page }) => {
  await slider(page).focus();
  await page.keyboard.press("ArrowRight");
  await value(page, 4);
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.keyboard.press("Escape");
  await value(page, 4);
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.getByRole("button", { name: "Interactive visualisation", exact: true }).click();
  await value(page, 4);
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.getByRole("button", { name: "Sparkline preview", exact: true }).click();
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.getByRole("button", { name: "Interactive visualisation", exact: true }).click();
  await value(page, 3);
});

test("graph frame and tick geometry are stable through every root placement and preview", async ({ page }) => {
  const baseline = await graph(page).evaluate((element) => ({ rect: element.getBoundingClientRect().toJSON(), box: element.getAttribute("viewBox"), ticks: [...element.querySelectorAll("text")].filter((text) => !text.closest("[data-spv-roots]")).map((text) => text.outerHTML) }));
  for (const mode of ["orientation", "prediction", "incorrect-reveal", "retrieval", "assistance"]) {
    await page.getByRole("combobox", { name: "Layout preview" }).selectOption(mode);
    for (const key of mode === "orientation" || mode === "retrieval" ? ["Home", "ArrowRight", "End"] : []) { await slider(page).focus(); await page.keyboard.press(key); }
    const current = await graph(page).evaluate((element) => ({ rect: element.getBoundingClientRect().toJSON(), box: element.getAttribute("viewBox"), ticks: [...element.querySelectorAll("text")].filter((text) => !text.closest("[data-spv-roots]")).map((text) => text.outerHTML) }));
    expect(current).toEqual(baseline);
  }
});

test("screen conversion works inside a translated, rotated and scaled surface", async ({ page }) => {
  await graph(page).evaluate((element) => { (element.parentElement as HTMLElement).style.transform = "translate(8px, 5px) rotate(4deg) scale(0.85)"; });
  await beginDrag(page, 10);
  const four = await screenPoint(page, 4);
  await page.mouse.move(four.x + 10, four.y);
  await page.mouse.up();
  await value(page, 4);
});

test("Chromium real touch events drag the handle without scrolling the page", async ({ page, browserName, context }) => {
  test.skip(browserName !== "chromium", "WebKit exposes no equivalent browser-protocol touch-drag API; real Safari touch remains a device check.");
  const cdp = await context.newCDPSession(page);
  const start = await screenPoint(page, 3);
  const end = await screenPoint(page, 3.6);
  const scroll = await page.evaluate(() => window.scrollY);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start.x, y: start.y, id: 0 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: end.x, y: end.y + 30, id: 0 }] });
  await value(page, 4);
  expect(Number(await host(page).getAttribute("data-spv-graphical-root"))).toBeCloseTo(3.6, 5);
  await expect(host(page)).toHaveAttribute("data-spv-settled-root", "3");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(host(page)).toHaveAttribute("data-spv-settled-root", "4");
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
});
