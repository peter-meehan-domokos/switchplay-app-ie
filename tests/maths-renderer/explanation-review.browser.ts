import { expect, test, devices } from "@playwright/test";
import type { MathsResult } from "../../src/components/maths-renderer/types";

const referenceURL = process.env.MATHS_INFO_REFERENCE_BASE_URL ?? "http://127.0.0.1:4193";

test("five authored explanations match the actual text-only Info Card at mobile and desktop widths", async ({ page, context }, info) => {
  const reference = await context.newPage();
  const evidence = [];
  for (const width of [320, 390, 430, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    await reference.setViewportSize({ width, height: 844 });
    await reference.goto(`${referenceURL}/info-cards`);
    await reference.getByRole("button", { name: "Static open", exact: true }).click();
    await reference.getByRole("combobox").selectOption("maths");
    await reference.getByRole("checkbox", { name: "Media", exact: true }).uncheck();
    const actual = await reference.locator("[data-info-card-face]").evaluate(node => {
      const root = node as HTMLElement, body = root.querySelector<HTMLElement>("[data-info-card-body]")!;
      const scale = root.getBoundingClientRect().height / root.offsetHeight;
      const css = getComputedStyle(root), bodyCSS = getComputedStyle(body);
      return { width: root.getBoundingClientRect().width / scale, height: root.offsetHeight,
        bodyWidth: body.getBoundingClientRect().width / scale, bodyHeight: body.getBoundingClientRect().height / scale,
        screenWidth: root.getBoundingClientRect().width, screenHeight: root.getBoundingClientRect().height,
        screenBodyWidth: body.getBoundingClientRect().width, screenBodyHeight: body.getBoundingClientRect().height,
        padding: css.padding, border: css.borderWidth, sizing: css.boxSizing,
        bodyPadding: bodyCSS.padding, bodyBorder: bodyCSS.borderWidth, fontSize: css.fontSize, lineHeight: css.lineHeight };
    });
    await page.goto("/dev/maths-renderer#five-explanations");
    const boxes = page.locator("[data-explanation-review]");
    await expect(boxes).toHaveCount(5);
    await page.evaluate(async () => { await document.fonts.ready; });
    for (let i = 0; i < 5; i++) {
      const box = boxes.nth(i);
      let result: MathsResult | undefined;
      await expect.poll(async () => {
        const next = JSON.parse((await box.locator("[data-explanation-result]").textContent()) ?? "null");
        if (next?.status === "ready") result = next;
        return next?.status;
      }).toBe("ready");
      if (!result) throw new Error("Expected a ready renderer result");
      expect(result.diagnostics).toEqual([]);
      if (result.status !== "ready") throw new Error("Expected reliable measurement");
      const geometry = await box.evaluate(node => {
        const frame = node.querySelector<HTMLElement>("[data-explanation-frame]")!, viewport = node.querySelector<HTMLElement>("[data-explanation-viewport]")!;
        const css = getComputedStyle(frame), bodyCSS = getComputedStyle(viewport), rect = viewport.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect(), scale = frameRect.height / frame.offsetHeight;
        return { width: frameRect.width / scale, height: frame.offsetHeight,
          bodyWidth: rect.width / scale, bodyHeight: rect.height / scale,
          screenWidth: frameRect.width, screenHeight: frameRect.height, screenBodyWidth: rect.width, screenBodyHeight: rect.height,
          padding: css.padding, border: css.borderWidth, sizing: css.boxSizing,
          bodyPadding: bodyCSS.padding, bodyBorder: bodyCSS.borderWidth, fontSize: css.fontSize, lineHeight: css.lineHeight,
          overflowX: bodyCSS.overflowX, overflowY: bodyCSS.overflowY };
      });
      // 0.05 CSS px accommodates subpixel conversion through the real consultation's scale.
      for (const key of ["width", "height", "bodyWidth", "bodyHeight", "screenWidth", "screenHeight", "screenBodyWidth", "screenBodyHeight"] as const) expect(Math.abs(geometry[key] - actual[key]), key).toBeLessThan(0.05);
      for (const key of ["padding", "border", "sizing", "bodyPadding", "bodyBorder", "fontSize", "lineHeight"] as const) expect(geometry[key], key).toBe(actual[key]);
      expect(geometry.overflowX).toBe("auto"); expect(geometry.overflowY).toBe("auto");
      expect(Math.abs(result.layout.available.width - actual.bodyWidth)).toBeLessThan(0.05);
      expect(Math.abs(result.layout.available.height! - actual.bodyHeight)).toBeLessThan(0.05);
      expect(result.fits).toBe(!result.layout.overflowX && !result.layout.overflowY);
      expect(result.layout.overflowY).toBe(result.layout.excess.top > 0 || result.layout.excess.bottom > 0);
      await expect(box.locator(".katex-error")).toHaveCount(0);
      await expect(box.locator("math")).toHaveCount([3, 1, 4, 4, 1][i]);
      if (i === 0) {
        await expect(box.locator("[data-maths-paragraph]")).toHaveCount(2);
        await expect(box.locator("[data-maths-paragraph]").nth(1)).toHaveText("Example");
        await expect(box.locator("[data-maths-expression='inline']")).toHaveCount(1);
        await expect(box.locator("math annotation").first()).toHaveText(String.raw`(g\circ f)(x)\quad\text{or}\quad g(f(x))\quad\text{means apply }f\text{ then }g`);
        await expect(box.locator("math annotation").nth(1)).toHaveText(String.raw`f(x)=2x+1,\quad g(x)=5x`);
        await expect(box.locator("math annotation").nth(2)).toHaveText("g(f(x))=5(2x+1)");
      }
      if (i === 1) {
        const working = await box.locator(".katex-html .mtable").evaluate(table => {
          const columns = [...table.children].filter(node => node.matches(".col-align-l,.col-align-r"));
          const cells = (column: Element) => [...column.querySelector(":scope > .vlist-t > .vlist-r > .vlist")!.children].map(row => row.lastElementChild!);
          const equations = cells(columns[1]), annotations = cells(columns[3]);
          const equals = equations.map(cell => [...cell.querySelectorAll(".mrel")].find(node => node.textContent === "=")!);
          const annotation = annotations[1];
          const position = (node: Element) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
          return { equals: equals.map(position), equations: equations.map(position), annotation: position(annotation),
            firstAnnotation: annotations[0].textContent, text: annotation.textContent?.replace(/\s+/g, " "),
            italic: [...annotation.querySelectorAll(".textit")].map(node => ({ text: node.textContent, style: getComputedStyle(node).fontStyle })),
            mathRows: [...table.querySelectorAll(".col-align-r")].length };
        });
        expect(Math.abs(working.equals[0].left - working.equals[1].left)).toBeLessThan(0.5);
        expect(working.firstAnnotation).toBe("");
        expect(working.text).toBe("[×x all terms]");
        expect(working.italic.map(item => item.text?.replace(/\s+/g, " "))).toEqual(["[", "all terms]"]);
        expect(working.italic.every(item => item.style === "italic")).toBe(true);
        expect(working.annotation.left).toBeGreaterThan(Math.max(...working.equations.map(row => row.right)));
        expect(working.annotation.top).toBeGreaterThan(working.equals[0].bottom);
        expect(Math.abs(working.annotation.top - working.equations[1].top)).toBeLessThan(0.5);
        await info.attach(`annotation-${width}`, { body: JSON.stringify(working, null, 2), contentType: "application/json" });
      }
      if (i === 2 || i === 3) {
        const rule = box.locator(".katex-html").first();
        expect(await rule.locator(".boldsymbol").count()).toBeGreaterThan(0);
        expect(await rule.locator(".boldsymbol").evaluateAll(nodes => nodes.every(node => getComputedStyle(node).fontWeight === "700"))).toBe(true);
        expect(await rule.locator(".mathbf").count()).toBeGreaterThan(0);
        expect(await box.locator("math").first().textContent()).toContain("\\boldsymbol");
      }
      evidence.push({ width, example: i + 1, actual, geometry, result });
    }
    for (let i = 1; i < 5; i++) {
      const previous = await boxes.nth(i - 1).boundingBox(), next = await boxes.nth(i).boundingBox();
      expect(next!.y).toBeGreaterThan(previous!.y + previous!.height);
    }
  }
  await info.attach("real-card-comparison", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
  await reference.close();
});

test("each review viewport scrolls independently when space is insufficient and retains intrinsic overflow reporting", async ({ page }) => {
  await page.goto("/dev/maths-renderer");
  const boxes = page.locator("[data-explanation-review]");
  // Test-only reduced allocation exercises scrolling even for authored examples that fit.
  for (let i = 0; i < 5; i++) {
    const box = boxes.nth(i);
    await box.locator("[data-explanation-viewport]").evaluate(node => { (node as HTMLElement).style.height = "12px"; });
    await expect.poll(async () => {
      const r = JSON.parse((await box.locator("[data-explanation-result]").textContent()) ?? "null");
      return r?.status === "ready" && r.layout.available.height === 12 && r.layout.overflowY;
    }).toBe(true);
    await box.locator("[data-explanation-viewport]").evaluate(node => { node.scrollTop = node.scrollHeight; });
    expect(await box.locator("[data-explanation-viewport]").evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    const result = JSON.parse((await box.locator("[data-explanation-result]").textContent()) ?? "null");
    expect(result.fits).toBe(false); expect(result.layout.overflowY).toBe(true);
    await box.locator("[data-explanation-viewport]").evaluate(node => { (node as HTMLElement).style.removeProperty("height"); node.scrollTop = 0; });
    await expect.poll(async () => JSON.parse((await box.locator("[data-explanation-result]").textContent()) ?? "null")?.layout?.available.height).toBeGreaterThan(100);
    expect(await boxes.locator("[data-explanation-viewport]").evaluateAll(nodes => nodes.every(node => node.scrollTop === 0))).toBe(true);
  }
  // Narrow only the test allocation: the source remains intact and width overflow stays detectable.
  await boxes.first().locator("[data-explanation-viewport]").evaluate(node => { (node as HTMLElement).style.width = "40px"; });
  await expect.poll(async () => JSON.parse((await boxes.first().locator("[data-explanation-result]").textContent()) ?? "null")?.layout?.overflowX).toBe(true);
});

test("iPhone Safari review page renders all five explanations over the LAN", async ({ browser, browserName }, info) => {
  test.skip(browserName !== "webkit", "Mobile Safari verification uses WebKit");
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto("http://192.168.1.38:4181/dev/maths-renderer#five-explanations");
  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-explanation-review]")).toHaveCount(5);
  await expect.poll(async () => page.locator("[data-explanation-result]").evaluateAll(nodes => nodes.every(node => JSON.parse(node.textContent!)?.status === "ready"))).toBe(true);
  await page.screenshot({ path: info.outputPath("iphone-five-explanations.png"), fullPage: true });
  expect(errors).toEqual([]);
  await context.close();
});
