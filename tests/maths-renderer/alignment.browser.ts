import { expect, test, type Locator } from "@playwright/test";
import { alignmentFixtures, presentationFixtures } from "../../src/app/dev/maths-renderer/fixtures";

// These geometry readers exist only in tests. They are not the Stage 2 capacity
// pipeline. KaTeX 0.19.1 emits each aligned column as a vertical list of cells.
const tolerance = 0.5; // CSS px: subpixel layout rounding, not a visual allowance.
const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

async function readAlignment(sample: Locator) {
  return sample.evaluate(node => {
    function rect(element: Element) {
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
    }
    function cells(column: Element) {
      const list = column.querySelector(":scope > .vlist-t > .vlist-r > .vlist")!;
      return [...list.children].map(row => row.lastElementChild!);
    }
    function visible(element: Element) {
      const css = getComputedStyle(element);
      return css.visibility !== "hidden" && css.color !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(css.color);
    }
    function atoms(cell: Element) {
      return [...cell.children].filter(child => child.textContent && !child.classList.contains("mspace"));
    }
    // Text ranges avoid the engine's deliberately oversized positioning struts.
    // Fraction bars contribute visible vertical extent even when there is no text.
    function contentBounds(cell: Element) {
      const boxes: DOMRect[] = [];
      const walk = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const text = walk.currentNode;
        const parent = text.parentElement!;
        if (!text.textContent?.replace(/\u200b/g, "").trim() || parent.closest(".vlist-s") || !visible(parent)) continue;
        const range = document.createRange(); range.selectNodeContents(text);
        boxes.push(...range.getClientRects());
      }
      for (const rule of cell.querySelectorAll(".frac-line,.hide-tail")) boxes.push(rule.getBoundingClientRect());
      return { top: Math.min(...boxes.map(r => r.top)), bottom: Math.max(...boxes.map(r => r.bottom)),
        boxes: boxes.map(r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })) };
    }
    const table = node.querySelector(".katex-html .mtable")!;
    const columns = [...table.children].filter(el => el.matches(".col-align-l,.col-align-r"));
    const left = cells(columns[0]), right = cells(columns[1]);
    const layout = (node as HTMLElement).dataset.layout!;
    const rows = right.map((cell, index) => {
      const rightAtoms = atoms(cell);
      const relationCell = layout === "B-columns" ? left[index] : cell;
      const relation = [...relationCell.children].find(child => child.classList.contains("mrel") && child.textContent === "=");
      const expressionAtoms = layout === "B-columns" ? rightAtoms : rightAtoms.slice(rightAtoms.findIndex(atom => atom === relation) + 1);
      const expression = expressionAtoms.find(atom => visible(atom))!;
      const lb = contentBounds(left[index]), rb = contentBounds(cell);
      return {
        leftStart: rect(left[index]).left,
        leftEnd: rect(left[index]).right,
        expressionStart: rect(expression).left,
        expressionEnd: rect(cell).right,
        equals: relation ? { ...rect(relation), visible: visible(relation) } : null,
        top: Math.min(lb.top, rb.top), bottom: Math.max(lb.bottom, rb.bottom),
        boxes: [...lb.boxes, ...rb.boxes],
      };
    });
    return { rows, indent: rect(table).left - rect(node.querySelector("[data-prose-before]")!).left,
      fontSize: parseFloat(getComputedStyle(node.querySelector("[data-maths-container]")!).fontSize),
      proseBottom: rect(node.querySelector("[data-prose-before]")!).bottom,
      proseAfterTop: rect(node.querySelector("[data-prose-after]")!).top };
  });
}

async function loadReview(page: import("@playwright/test").Page) {
  await page.goto("/dev/maths-renderer");
  await expect(page.locator("[data-maths-stage='1']")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].filter(face => face.family.startsWith("KaTeX") && face.status !== "unloaded");
    if (!faces.length || faces.some(face => face.status !== "loaded")) throw new Error("Required mathematical fonts did not load");
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await expect(page.locator("[data-maths-error]")).toHaveCount(0);
}

for (const presentation of presentationFixtures) {
  test(`column alignment and row clearance · ${presentation.id}`, async ({ page }, info) => {
    await loadReview(page);
    const measurements = [];
    for (const fixture of alignmentFixtures) {
      const sample = page.locator(`[data-presentation="${presentation.id}"] [data-fixture="${fixture.id}"]`);
      const actual = await readAlignment(sample);
      measurements.push({ fixture: fixture.id, ...actual });
      const rows = actual.rows;
      expect(rows).toHaveLength(fixture.variant === "basic" ? 4 : 3);
      expect(spread(rows.map(row => row.expressionStart)), fixture.id).toBeLessThanOrEqual(tolerance);
      const equals = rows.flatMap(row => row.equals?.visible ? [row.equals] : []);
      expect(equals).toHaveLength(fixture.layout === "A" ? rows.length : rows.length - 1);
      expect(spread(equals.map(eq => eq.left)), fixture.id).toBeLessThanOrEqual(tolerance);

      if (fixture.layout === "A") {
        expect(spread(rows.map(row => row.leftEnd))).toBeLessThanOrEqual(tolerance);
        expect(spread(rows.map(row => row.leftStart))).toBeGreaterThan(actual.fontSize);
        const before = rows.map(row => row.equals!.left - row.leftEnd);
        const after = rows.map(row => row.expressionStart - row.equals!.right);
        expect(Math.min(...before)).toBeGreaterThan(0);
        expect(Math.min(...after)).toBeGreaterThan(0);
        expect(spread(before)).toBeLessThanOrEqual(tolerance);
        expect(spread(after)).toBeLessThanOrEqual(tolerance);
        expect(Math.abs(before[0] - after[0])).toBeLessThanOrEqual(tolerance);
      } else {
        expect(rows[0].equals?.visible ?? false).toBe(false);
        expect(spread(rows.map(row => row.expressionEnd - row.expressionStart))).toBeGreaterThan(actual.fontSize);
        for (const row of rows.slice(1)) expect(row.equals!.right).toBeLessThan(row.expressionStart);
      }
      expect(Math.abs(actual.indent - actual.fontSize)).toBeLessThanOrEqual(tolerance);
      expect(rows[0].top - actual.proseBottom).toBeGreaterThanOrEqual(-tolerance);
      expect(actual.proseAfterTop - rows.at(-1)!.bottom).toBeGreaterThanOrEqual(-tolerance);
      for (let index = 1; index < rows.length; index++) {
        expect(rows[index].top).toBeGreaterThan(rows[index - 1].top);
        // A whole-row envelope can overlap vertically where the actual content
        // occupies different columns. Check clearance where content shares x.
        for (const previous of rows[index - 1].boxes) for (const current of rows[index].boxes) {
          const sharedWidth = Math.min(previous.right, current.right) - Math.max(previous.left, current.left);
          if (sharedWidth > tolerance) expect(current.top - previous.bottom, `${fixture.id}, row ${index}`).toBeGreaterThanOrEqual(-tolerance);
        }
      }
    }
    await info.attach("alignment-geometry", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
  });
}

test("iPhone-sized viewport preserves authored alignment and captures visual evidence", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadReview(page);
  for (const fixture of alignmentFixtures) {
    const actual = await readAlignment(page.locator(`[data-presentation="small"] [data-fixture="${fixture.id}"]`));
    expect(spread(actual.rows.map(row => row.expressionStart)), fixture.id).toBeLessThanOrEqual(tolerance);
  }
  await page.screenshot({ path: info.outputPath("iphone-alignment-review.png"), fullPage: true });
});

test("desktop visual evidence and source candidates remain independently authored", async ({ page }, info) => {
  await loadReview(page);
  for (const fixture of alignmentFixtures) {
    const sample = page.locator(`[data-presentation="medium"] [data-fixture="${fixture.id}"]`);
    await expect(sample.locator("pre code")).toHaveText(`$$\n${fixture.latex}\n$$`);
    await sample.screenshot({ path: info.outputPath(`${fixture.id}.png`) });
  }
  const rules = await page.evaluate(() => [...document.styleSheets].flatMap(sheet => {
    try { return [...sheet.cssRules].map(rule => rule.cssText); } catch { return []; }
  }));
  expect(rules.some(rule => /^body\s*\{/.test(rule) && /katexEqnNo/.test(rule))).toBe(false);
});
