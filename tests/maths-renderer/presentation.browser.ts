import { devices, expect, test, type Locator, type Page } from "@playwright/test";
import { recommendedPresentation, reviewSettings, reviewSizes } from "../../src/app/dev/maths-renderer/presentationSamples";
import { typesetMath } from "../../src/components/maths-renderer/typesetMath";

const tolerance = 0.5; // Independent geometry comparison, not a fit allowance.
const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
async function open(page: Page) {
  await page.goto("/dev/maths-renderer");
  await page.waitForFunction(() => document.querySelectorAll("[data-review-result]").length === 9 && [...document.querySelectorAll("[data-review-result]")].every(element => JSON.parse(element.textContent!)?.status === "ready"));
}

async function geometry(sample: Locator) {
  return sample.locator("[data-maths-renderer]").evaluate(root => {
    const box = (element: Element) => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
    const cells = (column: Element) => [...column.querySelector(":scope > .vlist-t > .vlist-r > .vlist")!.children].map(row => row.lastElementChild!);
    function visibleBoxes(element: Element) {
      const result = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, parent = node.parentElement!;
        if (!node.textContent?.replace(/\u200b/g, "").trim() || parent.closest(".katex-mathml,.pstrut,.vlist-s") || getComputedStyle(parent).color === "transparent") continue;
        const range = document.createRange(); range.selectNodeContents(node);
        result.push(...[...range.getClientRects()].map(r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })));
      }
      for (const rule of element.querySelectorAll(".frac-line,.hide-tail")) result.push(box(rule));
      return result;
    }
    const blocks = [...root.querySelectorAll("[data-maths-display]")];
    const tables = [...root.querySelectorAll(".katex-html .mtable")].map((table, index) => {
      const columns = [...table.children]; const left = cells(columns[0]), right = cells(columns[1]);
      const rows = right.map((cell, row) => {
        const relationCell = index === 0 ? cell : left[row];
        const equals = [...relationCell.children].find(atom => atom.classList.contains("mrel") && atom.textContent === "=");
        const atoms = [...cell.children].filter(atom => atom.textContent && !atom.classList.contains("mspace"));
        const expression = index === 0 ? atoms[atoms.indexOf(equals!) + 1] : atoms[0];
        return { leftEnd: box(left[row]).right, equals: equals ? box(equals) : null, expression: box(expression), boxes: [...visibleBoxes(left[row]), ...visibleBoxes(cell)] };
      });
      return { indent: box(table).left - box(root).left, rows };
    });
    const inline = [...root.querySelectorAll("[data-maths-expression='inline']")].map(math => {
      const paragraph = math.parentElement!;
      const prose = [...paragraph.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).flatMap(node => {
        const range = document.createRange(); range.selectNodeContents(node); return [...range.getClientRects()].map(r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }));
      });
      return { outer: box(math), content: visibleBoxes(math), prose, fragments: math.querySelector(".katex-html")!.getClientRects().length };
    });
    return { fontSize: parseFloat(getComputedStyle(root).fontSize), lineHeight: parseFloat(getComputedStyle(root).lineHeight),
      mathSize: parseFloat(getComputedStyle(root.querySelector(".katex")!).fontSize),
      tables, inline, blockGaps: blocks.map(block => ({ before: box(block.querySelector(".katex-display")!).top - box(block.previousElementSibling!).bottom, after: box(block.nextElementSibling!).top - box(block.querySelector(".katex-display")!).bottom })) };
  });
}

test("presentation settings preserve alignment, row clearance, scale, indentation and gaps", async ({ page }, info) => {
  await open(page); const evidence = [];
  for (const setting of reviewSettings) for (const size of reviewSizes) {
    const sample = page.locator(`[data-review-case='${setting.id}-${size.id}']`);
    const actual = await geometry(sample);
    const settings = { ...recommendedPresentation, ...setting.changes };
    const result = JSON.parse((await sample.locator("[data-review-result]").textContent())!);
    expect(result.fits, `${setting.id}-${size.id}`).toBe(true);
    expect(actual.fontSize).toBe(size.fontSizePx);
    expect(Math.abs(actual.mathSize / actual.fontSize - settings.mathScale)).toBeLessThan(0.005);
    expect(Math.abs(actual.lineHeight / actual.fontSize - 1.5)).toBeLessThan(0.005);
    for (const [index, table] of actual.tables.entries()) {
      expect(Math.abs(table.indent - size.fontSizePx * settings.displayIndentEm)).toBeLessThanOrEqual(tolerance);
      expect(spread(table.rows.map(row => row.expression.left))).toBeLessThanOrEqual(tolerance);
      const equals = table.rows.flatMap(row => row.equals ? [row.equals] : []);
      expect(equals).toHaveLength(index === 0 ? 3 : 2);
      expect(spread(equals.map(eq => eq.left))).toBeLessThanOrEqual(tolerance);
      if (index === 0) expect(spread(table.rows.map(row => row.leftEnd))).toBeLessThanOrEqual(tolerance);
      else for (const row of table.rows.slice(1)) expect(row.equals!.right).toBeLessThan(row.expression.left);
      for (let row = 1; row < table.rows.length; row++) for (const previous of table.rows[row - 1].boxes) for (const current of table.rows[row].boxes) {
        if (Math.min(previous.right, current.right) - Math.max(previous.left, current.left) > tolerance) expect(current.top - previous.bottom).toBeGreaterThanOrEqual(-tolerance);
      }
    }
    for (const gap of actual.blockGaps) {
      expect(Math.abs(gap.before - settings.displayGapEm * size.fontSizePx)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(gap.after - settings.displayGapEm * size.fontSizePx)).toBeLessThanOrEqual(tolerance);
    }
    for (const math of actual.inline) {
      expect(math.fragments).toBe(1);
      for (const fragment of math.content) {
        expect(fragment.top).toBeGreaterThanOrEqual(math.outer.top - tolerance);
        expect(fragment.bottom).toBeLessThanOrEqual(math.outer.bottom + tolerance);
      }
      for (const prose of math.prose) {
        const sharedWidth = Math.min(prose.right, math.outer.right) - Math.max(prose.left, math.outer.left);
        const sharedHeight = Math.min(prose.bottom, math.outer.bottom) - Math.max(prose.top, math.outer.top);
        if (sharedWidth > tolerance) expect(sharedHeight).toBeLessThanOrEqual(tolerance);
      }
    }
    evidence.push({ setting: setting.id, size: size.id, ...actual });
  }
  await info.attach("presentation-geometry", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
});

test("working-row pitch retains the approved 25 percent increase", async ({ page }, info) => {
  await open(page);
  const source = String.raw`\begin{aligned}x&=1\\xy&=2\\xyz&=3\end{aligned}`;
  const adjusted = typesetMath(source), baseline = typesetMath(`\\def\\arraystretch{1}${source}`);
  if (!adjusted.ok || !baseline.ok) throw new Error("Pitch fixture must typeset");
  const pitches = await page.evaluate(({ adjusted, baseline }) => {
    const read = (html: string) => {
      const wrapper = document.createElement("div"); wrapper.className = "switchplay-maths-katex"; wrapper.style.fontSize = "18px"; wrapper.innerHTML = html; document.body.append(wrapper);
      const rows = [...wrapper.querySelector(".mtable > .col-align-r > .vlist-t > .vlist-r > .vlist")!.children];
      const tops = rows.map(row => row.lastElementChild!.getBoundingClientRect().top); wrapper.remove();
      return tops.slice(1).map((top, i) => top - tops[i]);
    };
    return { adjusted: read(adjusted), baseline: read(baseline) };
  }, { adjusted: adjusted.html, baseline: baseline.html });
  for (let i = 0; i < pitches.adjusted.length; i++) expect(Math.abs(pitches.adjusted[i] / pitches.baseline[i] - 1.25)).toBeLessThan(0.005);
  await info.attach("working-row-pitch", { body: JSON.stringify(pitches), contentType: "application/json" });
});

test("hanging prose spaces do not create false overflow; authored text and gaps survive", async ({ page }) => {
  await open(page);
  await page.locator("[data-regression-fixtures]").evaluate(element => { (element as HTMLDetailsElement).open = true; });
  await page.waitForFunction(() => !!window.mathsFixtures?.mixed);
  const source = "Prose wraps naturally with preserved spaces between its words.\n\nNext paragraph.";
  await page.evaluate(source => window.mathsFixtures!.mixed.update({ content: source, width: 150, height: null }), source);
  await expect.poll(async () => JSON.parse((await page.locator("[data-capacity-case='mixed'] [data-capacity-result]").textContent())!)?.status).toBe("ready");
  let result = JSON.parse((await page.locator("[data-capacity-case='mixed'] [data-capacity-result]").textContent())!);
  expect(result.fits).toBe(true);
  const paragraphs = page.locator("[data-capacity-case='mixed'] [data-maths-paragraph]");
  expect(await paragraphs.allTextContents()).toEqual(source.split("\n\n"));
  const gap = await paragraphs.evaluateAll(elements => elements[1].getBoundingClientRect().top - elements[0].getBoundingClientRect().bottom);
  expect(Math.abs(gap - 18 * .8)).toBeLessThanOrEqual(tolerance);
  await page.evaluate(() => window.mathsFixtures!.mixed.update({ content: "Before\n$$x=1$$$$y=2$$\nAfter", width: 400 }));
  await expect.poll(async () => (await page.locator("[data-capacity-case='mixed'] [data-maths-display]").count())).toBe(2);
  await expect.poll(async () => {
    const result = JSON.parse((await page.locator("[data-capacity-case='mixed'] [data-capacity-result]").textContent())!);
    return result?.status === "ready" ? result.layout.available.width : null;
  }).toBe(400);
  const spacing = await page.locator("[data-capacity-case='mixed'] .katex-display").evaluateAll(elements => elements[1].getBoundingClientRect().top - elements[0].getBoundingClientRect().bottom);
  expect(Math.abs(spacing - 18 * .6)).toBeLessThanOrEqual(tolerance);
  result = JSON.parse((await page.locator("[data-capacity-case='mixed'] [data-capacity-result]").textContent())!);
  expect(result.status).not.toBe("invalid-input");
});

test("prose/math accessibility order exposes one MathML alternative per expression", async ({ page, context }, info) => {
  await open(page);
  const root = page.locator("[data-review-case='balanced-medium'] [data-maths-renderer]");
  await expect(root.locator("math")).toHaveCount(5);
  await expect(root.locator(".katex-html[aria-hidden='true']")).toHaveCount(5);
  expect(await root.locator("math").evaluateAll(elements => elements.every(element => element.namespaceURI === "http://www.w3.org/1998/Math/MathML" && !element.closest("[aria-hidden='true']")))).toBe(true);
  expect(await root.locator("math").evaluateAll(elements => elements.map(element => element.getAttribute("display")))).toEqual([null, null, "block", "block", null]);
  await expect(root.locator("[role='img'],[aria-label],[aria-live]")).toHaveCount(0);
  const snapshot = await root.ariaSnapshot();
  expect(snapshot.match(/^\s*- math:/gm)).toHaveLength(5);
  expect(snapshot).not.toContain("\\frac"); expect(snapshot).not.toContain("\\begin");
  expect(snapshot.indexOf("First, solve")).toBeLessThan(snapshot.indexOf("- math:"));
  expect(snapshot.indexOf("Therefore,")).toBeLessThan(snapshot.indexOf("Finally,"));
  expect(snapshot.indexOf("Finally,")).toBeLessThan(snapshot.indexOf("This is a new paragraph"));
  await info.attach("accessible-reading-order", { body: snapshot, contentType: "text/plain" });
  if (info.project.name === "chromium") {
    const client = await context.newCDPSession(page);
    const { root: documentRoot } = await client.send("DOM.getDocument");
    const { nodeId } = await client.send("DOM.querySelector", { nodeId: documentRoot.nodeId, selector: "[data-review-case='balanced-medium'] [data-maths-renderer]" });
    const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId, selector: "math" });
    const mathIds = await Promise.all(nodeIds.map(async nodeId => (await client.send("DOM.describeNode", { nodeId })).node.backendNodeId));
    const { nodes } = await client.send("Accessibility.getFullAXTree");
    const byId = new Map(nodes.map(node => [node.nodeId, node]));
    const mathNodes = nodes.filter(entry => mathIds.includes(entry.backendDOMNodeId!));
    expect(mathNodes).toHaveLength(5);
    expect(mathNodes.every(entry => !entry.ignored && /math/i.test(entry.role?.value ?? ""))).toBe(true);
    const collected: typeof nodes = [];
    const visit = (id: string) => { const entry = byId.get(id)!; collected.push(entry); for (const child of entry.childIds ?? []) visit(child); };
    for (const entry of mathNodes) visit(entry.nodeId);
    expect(collected.some(entry => !entry.ignored && /\\frac|\\begin/.test(entry.name?.value ?? ""))).toBe(false);
    await info.attach("native-accessibility-tree", { body: JSON.stringify(collected.map(entry => ({ role: entry.role?.value, name: entry.name?.value, ignored: entry.ignored })), null, 2), contentType: "application/json" });
  }
});

test("mobile and desktop review containers respond without shrinking or clipping mathematics", async ({ page }, info) => {
  for (const width of [390, 1100]) {
    await page.setViewportSize({ width, height: 844 }); await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    for (const setting of reviewSettings) {
      const sample = page.locator(`[data-review-case='${setting.id}-medium']`);
      const actual = await sample.locator("[data-maths-renderer]").evaluate(element => {
        const s = getComputedStyle(element); return { size: parseFloat(s.fontSize), overflow: s.overflow, maxHeight: s.maxHeight, transform: s.transform, right: element.getBoundingClientRect().right };
      });
      expect(actual.size).toBe(18); expect(actual.overflow).toBe("visible"); expect(actual.maxHeight).toBe("none"); expect(actual.transform).toBe("none"); expect(actual.right).toBeLessThanOrEqual(width);
      await sample.screenshot({ path: info.outputPath(`${width}-${setting.id}.png`) });
    }
  }
});

test("mobile prose wrapping excludes nonpainting line-boundary carets from capacity", async ({ browser, browserName, baseURL }, info) => {
  const context = await browser.newContext(browserName === "firefox"
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true }
    : devices["iPhone 13"]);
  try {
    const page = await context.newPage();
    await page.goto(new URL("/dev/maths-renderer", baseURL!).href);
    await page.waitForFunction(() => document.querySelectorAll("[data-review-result]").length === 9 && [...document.querySelectorAll("[data-review-result]")].every(element => JSON.parse(element.textContent!)?.status === "ready"));
    for (const sample of await page.locator("[data-review-case]").all()) {
      const result = JSON.parse((await sample.locator("[data-review-result]").textContent())!);
      expect(result.fits, await sample.getAttribute("data-review-case") ?? "sample").toBe(true);
      expect(result.layout.bounds.right).toBeLessThanOrEqual(result.layout.available.width + 0.01);
    }
    const fragments = await page.locator("[data-review-case='balanced-small'] [data-maths-renderer]").evaluate(root => {
      const paragraph = root.querySelector("[data-maths-paragraph]:last-child")!;
      const node = paragraph.firstChild!, origin = root.getBoundingClientRect();
      return [...node.textContent!.matchAll(/\S+/g)].flatMap(match => {
        const range = document.createRange(); range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
        return [...range.getClientRects()].map(rect => ({ word: match[0], width: rect.width, right: rect.right - origin.left, budget: origin.width }));
      });
    });
    expect(fragments.filter(rect => rect.width > 0).every(rect => rect.right <= rect.budget + tolerance)).toBe(true);
    await info.attach("mobile-prose-fragments", { body: JSON.stringify(fragments, null, 2), contentType: "application/json" });
  } finally { await context.close(); }
});
