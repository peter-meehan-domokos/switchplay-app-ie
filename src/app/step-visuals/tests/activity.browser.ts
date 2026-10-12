import { expect, test } from "@playwright/test";

test("initial static graph and expression are server-rendered with accessible descriptions", async ({ page, request }) => {
  const response = await request.get("/step-visuals");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("<svg");
  expect(html).toContain("(x − 3)");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/step-visuals");
  const graph = page.getByRole("img", { name: "Quadratic graph", exact: true });
  await expect(graph).toBeVisible();
  await expect(graph).toHaveAccessibleDescription(/Fixed root at x = 1; movable root at x = 3\. Vertex at \(2, −1\)/);
  await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times (x − 3)");
  await expect(graph.locator("[data-spv-root]")).toHaveCount(2);
  await expect(page.getByRole("slider", { name: "Movable root" })).toHaveAttribute("aria-valuenow", "3");
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Move root (left|right)/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
  test(`static graph geometry, clipping and measurement at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/step-visuals");
    const graph = page.getByRole("img", { name: "Quadratic graph", exact: true });
    await expect.poll(async () => graph.evaluate((element) => {
      const svg = element as SVGSVGElement;
      const box = svg.getBoundingClientRect();
      return Math.abs(svg.viewBox.baseVal.width - box.width) < 0.1 && Math.abs(svg.viewBox.baseVal.height - box.height) < 0.1;
    })).toBe(true);
    const geometry = await graph.evaluate((element) => {
      const svg = element as SVGSVGElement;
      const clip = svg.querySelector("clipPath rect")!;
      const fixed = svg.querySelector('[data-spv-root="fixed-root"] circle')!;
      const moving = svg.querySelector('[data-spv-root="moving-root"] circle')!;
      const path = svg.querySelector("[data-spv-curve]")!;
      const numeric = (node: Element, name: string) => Number(node.getAttribute(name));
      return {
        width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height,
        clip: { x: numeric(clip, "x"), y: numeric(clip, "y"), width: numeric(clip, "width"), height: numeric(clip, "height") },
        fixed: { x: numeric(fixed, "cx"), y: numeric(fixed, "cy") },
        moving: { x: numeric(moving, "cx"), y: numeric(moving, "cy") },
        path: path.getAttribute("d"), clipReference: path.parentElement!.getAttribute("clip-path"), clipId: clip.parentElement!.id,
        rootsClipped: svg.querySelector("[data-spv-roots]")!.hasAttribute("clip-path"),
      };
    });
    expect(geometry.clip.width).toBeCloseTo(geometry.width - 54);
    expect(geometry.clip.height).toBeCloseTo(geometry.height - 52);
    expect(geometry.fixed.x).toBeCloseTo(geometry.clip.x + geometry.clip.width * 7 / 12);
    expect(geometry.moving.x).toBeCloseTo(geometry.clip.x + geometry.clip.width * 9 / 12);
    expect(geometry.fixed.y).toBeCloseTo(geometry.clip.y + geometry.clip.height / 2);
    expect(geometry.moving.y).toBeCloseTo(geometry.fixed.y);
    expect(geometry.clipReference).toBe(`url(#${geometry.clipId})`);
    expect(geometry.rootsClipped).toBe(false);
    expect(geometry.path).not.toMatch(/NaN|Infinity/);
    await expect(graph.getByText("x = 1", { exact: true })).toBeVisible();
    await expect(graph.getByText("x = 3", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("static-graph.png"), fullPage: true });
  });
}

test("resize recomputes scene coordinates without altering the settled mathematics", async ({ page }) => {
  await page.goto("/step-visuals");
  const graph = page.getByRole("img", { name: "Quadratic graph", exact: true });
  const moving = graph.locator('[data-spv-root="moving-root"] circle');
  await page.getByRole("slider", { name: "Movable root" }).click();
  await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times (x − 3)");
  const before = await moving.getAttribute("cx");
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => moving.getAttribute("cx")).not.toBe(before);
  await expect(graph).toHaveAccessibleDescription(/movable root at x = 3/);
});

test("fixed root label has a quiet outlined surface and paints above the curve", async ({ page }) => {
  await page.goto("/step-visuals");
  const slider = page.getByRole("slider", { name: "Movable root" });
  await expect(slider).toHaveAttribute("aria-disabled", "false");
  await page.getByRole("combobox", { name: "Layout preview" }).selectOption("retrieval");
  const graph = page.getByRole("img", { name: "Quadratic graph", exact: true });
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await expect(slider).toHaveAttribute("aria-disabled", "false");
    await slider.focus();
    await page.keyboard.press("Home");
    for (let root = -5; root <= 5; root++) {
      if (root !== -5) await page.keyboard.press("ArrowRight");
      await expect(slider).toHaveAttribute("aria-valuenow", String(root));
      const label = await graph.evaluate((element) => {
        const group = element.querySelector('[data-spv-root="fixed-root"]')!;
        const text = group.querySelector("text")!;
        const backing = group.querySelector("rect")!;
        const curve = element.querySelector("[data-spv-curve]")!;
        const textBox = text.getBBox();
        const plateBox = backing.getBBox();
        const svg = element as SVGSVGElement;
        const tickLabels = [...element.children[4].querySelectorAll("text")].map((node) => node.getBBox());
        const plateStyle = getComputedStyle(backing);
        return { fill: getComputedStyle(text).fill, weight: getComputedStyle(text).fontWeight,
          plateFill: plateStyle.fill, plateOpacity: plateStyle.fillOpacity, plateStroke: plateStyle.stroke, plateStrokeWidth: plateStyle.strokeWidth,
          textAfterCurve: Boolean(curve.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING),
          plateAfterCurve: Boolean(curve.compareDocumentPosition(backing) & Node.DOCUMENT_POSITION_FOLLOWING),
          textAfterPlate: Boolean(backing.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING),
          textProtected: textBox.x >= plateBox.x && textBox.y >= plateBox.y && textBox.x + textBox.width <= plateBox.x + plateBox.width && textBox.y + textBox.height <= plateBox.y + plateBox.height,
          ticksClear: tickLabels.every((box) => box.x + box.width <= plateBox.x || box.x >= plateBox.x + plateBox.width || box.y + box.height <= plateBox.y || box.y >= plateBox.y + plateBox.height),
          contained: textBox.x >= 0 && textBox.y >= 0 && textBox.x + textBox.width <= svg.viewBox.baseVal.width && textBox.y + textBox.height <= svg.viewBox.baseVal.height };
      });
      expect(label).toEqual({ fill: "rgb(62, 94, 78)", weight: "600", plateFill: "rgb(255, 253, 248)", plateOpacity: "0.96", plateStroke: "rgb(204, 214, 203)", plateStrokeWidth: "0.75px", textAfterCurve: true, plateAfterCurve: true, textAfterPlate: true, textProtected: true, ticksClear: true, contained: true });
    }
  }
});
