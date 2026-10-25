import { expect, test, type Page } from "@playwright/test";
import type { MathsPresentation, MathsResult } from "../../src/components/maths-renderer/types";
import { alignmentFixtures } from "../../src/app/dev/maths-renderer/fixtures";

const sample = (page: Page, id: string) => page.locator(`[data-capacity-case="${id}"]`);
async function read(page: Page, id: string): Promise<MathsResult> {
  return JSON.parse((await sample(page, id).locator("[data-capacity-result]").textContent())!);
}
async function ready(page: Page, id: string) {
  let result: MathsResult | null = null;
  await expect.poll(async () => { result = await read(page, id); return result?.status; }).toBe("ready");
  result = result as MathsResult | null;
  if (!result) throw new Error("Expected a result");
  if (result.status !== "ready") throw new Error("Expected reliable measurement");
  return result;
}
async function open(page: Page) {
  await page.goto("/dev/maths-renderer");
  await page.waitForFunction(() => !!window.mathsFixtures?.mixed);
}
async function update(page: Page, id: string, patch: Record<string, unknown>) {
  const previous = await read(page, id);
  await page.evaluate(({ id, patch }) => window.mathsFixtures![id].update(patch), { id, patch });
  await expect.poll(async () => (await read(page, id)).generation).toBeGreaterThan(previous.generation);
}
const presentation: MathsPresentation = { fontFamily: "Arial, sans-serif", fontSizePx: 18, lineHeight: 1.5, mathScale: 1, paragraphGapEm: 0.8, displayIndentEm: 1, displayGapEm: 0.6 };

test("empty mathematical regions are accepted without fallback or diagnostics", async ({ page }) => {
  await open(page); await ready(page, "mixed");
  for (const content of ["$$$$", "$ $", "$$ \n\t $$", "$\t\n $"]) {
    await update(page, "mixed", { content });
    const result = await ready(page, "mixed");
    expect(result.fits).toBe(true);
    expect(result.diagnostics).toEqual([]);
    await expect(sample(page, "mixed").locator("[data-maths-fallback]")).toHaveCount(0);
    await expect(sample(page, "mixed").locator("[data-maths-expression]")).toHaveCount(1);
    expect(await sample(page, "mixed").locator(".katex-html").textContent()).toBe("");
    expect(Number.isFinite(result.layout.width)).toBe(true);
    expect(Number.isFinite(result.layout.height)).toBe(true);
  }
  await update(page, "mixed", { content: "Before $ $ after" }); await ready(page, "mixed");
  const prose = await sample(page, "mixed").locator("[data-maths-paragraph]").evaluate(paragraph =>
    [...paragraph.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(""));
  expect(prose).toBe("Before  after");
});

test("actual occupied bounds, equivalent constraints and independent overflow axes", async ({ page }, info) => {
  await open(page);
  const explicit = await ready(page, "mixed"), container = await ready(page, "container");
  expect(explicit.fits).toBe(true); expect(container.layout).toEqual(explicit.layout);
  expect(explicit.layout.width).toBeLessThan(explicit.layout.available.width - 50);
  const width = await ready(page, "wide"), height = await ready(page, "tall");
  expect([width.layout.overflowX, width.layout.overflowY]).toEqual([true, false]);
  expect([height.layout.overflowX, height.layout.overflowY]).toEqual([false, true]);
  expect(height.layout.height).toBeGreaterThan(4 * height.layout.available.height!);
  const actual = await sample(page, "wide").locator("[data-maths-renderer]").evaluate(root => {
    const rect = root.getBoundingClientRect();
    const expression = root.querySelector("[data-maths-expression]")!;
    let right = expression.getBoundingClientRect().right;
    const walk = document.createTreeWalker(expression.querySelector(".katex-html")!, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) { const range = document.createRange(); range.selectNodeContents(walk.currentNode); for (const box of range.getClientRects()) right = Math.max(right, box.right); }
    return { height: rect.height, right: right - rect.left, overflow: getComputedStyle(root).overflow };
  });
  expect(Math.abs(actual.right - width.layout.bounds.right)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(actual.height - width.layout.height)).toBeLessThanOrEqual(0.5);
  expect(actual.overflow).toBe("visible");
  await info.attach("capacity-geometry", { body: JSON.stringify({ explicit, container, width, height, actual }, null, 2), contentType: "application/json" });
  await sample(page, "mixed").screenshot({ path: info.outputPath("mixed-content.png") });
});

test("nested radicals ignore construction SVG width and overhanging descendants are included", async ({ page }) => {
  await open(page);
  const nested = await ready(page, "nested"); expect(nested.fits).toBe(true);
  expect(nested.layout.width).toBeLessThan(650);
  const overhang = await ready(page, "overhang");
  expect(overhang.layout.excess.left).toBeGreaterThan(10);
  expect(overhang.layout.overflowX).toBe(true); expect(overhang.layout.overflowY).toBe(true);
  // Independent browser Range reads show why the natural parent box is not
  // sufficient for smashed/overlapping content.
  const actual = await sample(page, "overhang").locator("[data-maths-renderer]").evaluate(root => {
    const origin = root.getBoundingClientRect(); let left = origin.left, bottom = origin.bottom;
    const walk = document.createTreeWalker(root.querySelector(".katex-html")!, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) { if (walk.currentNode.parentElement!.closest(".vlist-s")) continue; const r = document.createRange(); r.selectNodeContents(walk.currentNode); for (const box of r.getClientRects()) { left = Math.min(left, box.left); bottom = Math.max(bottom, box.bottom); } }
    return { left: left - origin.left, bottom: bottom - origin.top };
  });
  expect(overhang.layout.bounds.left).toBeLessThanOrEqual(actual.left + 0.5);
  expect(overhang.layout.bounds.bottom).toBeGreaterThanOrEqual(actual.bottom - 0.5);
});

test("container resizing, padding/borders, zero height and unbounded height", async ({ page }) => {
  await open(page); await ready(page, "container");
  await update(page, "container", { width: 130, height: 25 });
  let current = await ready(page, "container");
  expect(current.layout.available).toEqual({ width: 130, height: 25 }); expect(current.fits).toBe(false);
  // Resize the host without React props. The content box excludes padding and
  // borders, including when the consumer uses border-box dimensions.
  await sample(page, "container").locator("[data-capacity-host]").evaluate(host => {
    Object.assign((host as HTMLElement).style, { boxSizing: "border-box", width: "526px", height: "326px" });
  });
  await expect.poll(async () => (await ready(page, "container")).layout.available).toEqual({ width: 500, height: 300 });
  expect((await ready(page, "container")).fits).toBe(true);
  await update(page, "mixed", { height: 0 }); current = await ready(page, "mixed");
  expect(current.layout.available.height).toBe(0); expect(current.layout.overflowY).toBe(true);
  const unbounded = await ready(page, "unbounded");
  expect(unbounded.layout.available.height).toBeNull(); expect(unbounded.layout.overflowY).toBe(false);
});

test("prose breaks and paragraph gaps survive; inline mathematics stays atomic with tall clearance", async ({ page }) => {
  await open(page); await ready(page, "inline");
  await update(page, "inline", { content: "First\nSecond\n\n\nThird", width: 500 }); await ready(page, "inline");
  const paragraphs = sample(page, "inline").locator("[data-maths-paragraph]");
  await expect(paragraphs).toHaveCount(2);
  expect(await paragraphs.allTextContents()).toEqual(["First\nSecond", "Third"]);
  const gap = await paragraphs.evaluateAll(ps => ps[1].getBoundingClientRect().top - ps[0].getBoundingClientRect().bottom);
  expect(Math.abs(gap - 18 * 0.8)).toBeLessThan(0.5);
  await update(page, "inline", { content: String.raw`Before words $\dfrac{\sqrt{x^2+1}}{\dfrac{a}{b}}$ after words.
Therefore,
done.`, width: 180 });
  await ready(page, "inline");
  const geometry = await sample(page, "inline").locator("[data-maths-renderer]").evaluate(root => {
    const math = root.querySelector<HTMLElement>("[data-maths-expression]")!;
    const rect = math.getBoundingClientRect();
    const following = document.createRange(); following.selectNodeContents(math.nextSibling!);
    return { rectCount: math.getClientRects().length, display: getComputedStyle(math).display, nowrap: getComputedStyle(math).whiteSpace, math: { top: rect.top, bottom: rect.bottom }, prose: [...following.getClientRects()].map(r => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })), root: root.getBoundingClientRect().left };
  });
  expect(geometry.rectCount).toBe(1); expect(geometry.display).toBe("inline-block"); expect(geometry.nowrap).toBe("nowrap");
  expect(geometry.prose.some(rect => rect.top >= geometry.math.bottom - 0.5)).toBe(true);
  await update(page, "inline", { content: String.raw`$a+b+c+d+e+f+g+h+i+j+k+l+m+n+o+p=q$`, width: 80 });
  expect((await ready(page, "inline")).layout.overflowX).toBe(true);
  expect(await sample(page, "inline").locator("[data-maths-expression]").evaluate(el => el.getClientRects().length)).toBe(1);
  expect(await sample(page, "inline").locator(".katex-html").evaluate(el => el.getClientRects().length)).toBe(1);
});

test("typography and rapid content changes invalidate old results without cross-instance changes", async ({ page }) => {
  await open(page);
  const initial = await ready(page, "mixed"), other = await ready(page, "container");
  await update(page, "mixed", { presentation: { ...presentation, fontFamily: "Georgia, serif", fontSizePx: 30, lineHeight: 1.8, mathScale: 1.2 } });
  const large = await ready(page, "mixed"); expect(large.layout.height).toBeGreaterThan(initial.layout.height);
  await page.evaluate(() => {
    const fixture = window.mathsFixtures!.mixed;
    fixture.history.length = 0;
    fixture.update({ content: "intermediate $x=3$", width: 60 });
    fixture.update({ content: "Final $x=1$", width: 600, height: 200 });
  });
  await expect(sample(page, "mixed").locator("[data-capacity-source]")).toHaveText("Final $x=1$");
  await expect.poll(async () => (await ready(page, "mixed")).layout.available.width).toBe(600);
  expect((await ready(page, "mixed")).fits).toBe(true);
  const history = await page.evaluate(() => window.mathsFixtures!.mixed.history);
  expect(history.filter(item => item.result.status === "ready").every(item => item.content === "Final $x=1$")).toBe(true);
  expect((await ready(page, "container")).layout).toEqual(other.layout);
});

test("translations, nested nonuniform positive scales and unsupported transforms", async ({ page }) => {
  await open(page); const initial = await ready(page, "container");
  await update(page, "container", { transform: "translate(23px, 17px) scale(1.4, .75)" });
  await sample(page, "container").evaluate(node => { (node as HTMLElement).style.transform = "scale(.8, 1.2)"; });
  let transformed = await ready(page, "container");
  expect(Math.abs(transformed.layout.width - initial.layout.width)).toBeLessThan(0.5);
  expect(Math.abs(transformed.layout.height - initial.layout.height)).toBeLessThan(0.5);
  expect(transformed.fits).toBe(initial.fits);
  await update(page, "container", { transform: "rotate(10deg)" });
  await expect.poll(async () => (await read(page, "container")).status).toBe("measurement-unavailable");
  const unavailable = await read(page, "container"); expect("fits" in unavailable).toBe(false);
  if (unavailable.status === "measurement-unavailable") expect(unavailable.reason).toBe("UNSUPPORTED_TRANSFORM");
  await update(page, "container", { transform: "none" }); transformed = await ready(page, "container"); expect(transformed.fits).toBe(true);
});

test("hidden hosts recover, invalid constraints cannot fit and invalid source retains diagnostics", async ({ page }) => {
  await open(page); await ready(page, "mixed");
  await update(page, "mixed", { hidden: true });
  await expect.poll(async () => (await read(page, "mixed")).status).toBe("measurement-unavailable");
  expect("fits" in await read(page, "mixed")).toBe(false);
  await update(page, "mixed", { hidden: false }); await ready(page, "mixed");
  await update(page, "mixed", { width: -1 });
  await expect.poll(async () => (await read(page, "mixed")).status).toBe("measurement-unavailable");
  await update(page, "mixed", { width: 300, presentation: { ...presentation, fontSizePx: 0 } });
  await expect.poll(async () => (await read(page, "mixed")).status).toBe("measurement-unavailable");
  const invalid = await read(page, "invalid"), unmatched = await read(page, "unmatched");
  expect(invalid.status).toBe("invalid-input"); expect(unmatched.status).toBe("invalid-input");
  expect("fits" in invalid).toBe(false);
  await expect(sample(page, "invalid").locator("[data-maths-fallback]")).toHaveText(String.raw`$$\frac{1}$$`);
  await expect(sample(page, "invalid").locator("[data-maths-expression]")).toHaveCount(1);
  expect(await sample(page, "unmatched").locator("[data-maths-fallback]").textContent()).toBe("$$unclosed\nLater $x=3$ stays literal.");
  await update(page, "invalid", { hidden: true });
  await expect.poll(async () => (await read(page, "invalid")).diagnostics.map(d => d.code)).toContain("HIDDEN_CONTENT");
});

test("font loading remains pending, source changes discard stale work, and release measures the new content", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let intercepted = 0;
  await page.route(/KaTeX.*\.(?:woff2?|ttf)(?:\?|$)/, async route => { intercepted++; await held; await route.continue(); });
  try {
    await page.goto("/dev/maths-renderer", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.mathsFixtures?.mixed);
    await expect.poll(() => intercepted).toBeGreaterThan(0);
    await expect.poll(async () => (await read(page, "mixed"))?.status).toBe("pending");
    await update(page, "mixed", { content: String.raw`New $\mathbb{R}+\sqrt{y}$ only.`, width: 500, height: 180 });
    await expect.poll(async () => (await read(page, "mixed")).status).toBe("pending");
    expect(await page.evaluate(() => window.mathsFixtures!.mixed.history.some(item => item.result.status === "ready"))).toBe(false);
    release(); const result = await ready(page, "mixed"); expect(result.fits).toBe(true);
    const history = await page.evaluate(() => window.mathsFixtures!.mixed.history);
    expect(history.filter(item => item.result.status === "ready").every(item => item.content.startsWith("New "))).toBe(true);
  } finally { release(); }
});

test("failed mathematical fonts never produce a ready fit", async ({ page }) => {
  await page.route(/KaTeX.*\.(?:woff2?|ttf)(?:\?|$)/, route => route.abort());
  await open(page);
  await expect.poll(async () => (await read(page, "mixed"))?.status).toBe("measurement-unavailable");
  const result = await read(page, "mixed");
  expect("fits" in result).toBe(false); expect(result.diagnostics.some(d => d.code === "FONT_LOAD_FAILED")).toBe(true);
  expect(await page.evaluate(() => window.mathsFixtures!.mixed.history.some(item => item.result.status === "ready"))).toBe(false);
});

test("font changes after a ready result invalidate it; unmount cancels delayed work", async ({ page }) => {
  await open(page); await ready(page, "mixed");
  await page.evaluate(() => {
    const existing = [...document.fonts].find(face => face.family === "KaTeX_Main" && face.status === "loaded")!;
    // An explicit, controlled extra font face makes post-ready font events
    // deterministic without modifying application font configuration.
    const face = new FontFace("ReviewFailure", "url(/dev/maths-renderer/missing-test-font.woff2)");
    document.fonts.add(face);
    void face.load().catch(() => {});
    if (!existing) throw new Error("Required engine font missing");
  });
  // Unrelated failed faces do not invalidate already verified required faces.
  expect((await ready(page, "mixed")).fits).toBe(true);
  await update(page, "mixed", { presentation: { ...presentation, fontFamily: "ReviewFailure, Arial" } });
  await expect.poll(async () => (await read(page, "mixed")).status).toBe("measurement-unavailable");
  expect((await read(page, "mixed")).diagnostics.some(d => d.code === "FONT_LOAD_FAILED")).toBe(true);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/delayed-review.woff2", async route => { await held; await route.abort(); });
  try {
    await page.evaluate(() => { document.fonts.add(new FontFace("ReviewDelayed", "url(/delayed-review.woff2)")); });
    await update(page, "mixed", { presentation: { ...presentation, fontFamily: "ReviewDelayed, Arial" } });
    await expect.poll(async () => (await read(page, "mixed")).status).toBe("pending");
    expect((await ready(page, "container")).fits).toBe(true);
    await page.evaluate(() => window.mathsFixtures!.mixed.update({ mounted: false }));
    await expect(sample(page, "mixed").locator("[data-maths-renderer]")).toHaveCount(0);
    const count = await page.evaluate(() => window.mathsFixtures!.mixed.history.length);
    release();
    await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
    expect(await page.evaluate(() => window.mathsFixtures!.mixed.history.length)).toBe(count);
  } finally { release(); }
});

test("the public mixed-content path retains both alignment candidates and indentation", async ({ page }) => {
  await open(page); await ready(page, "mixed");
  for (const fixture of alignmentFixtures.filter(f => f.variant === "tall")) {
    await update(page, "mixed", { content: `Before\n$$${fixture.latex}$$\nTherefore`, width: 650, height: 600 });
    expect((await ready(page, "mixed")).fits).toBe(true);
    const geometry = await sample(page, "mixed").locator("[data-maths-renderer]").evaluate((root, layout) => {
      const table = root.querySelector(".katex-html .mtable")!;
      const cols = [...table.children];
      const cells = (col: Element) => [...col.querySelector(":scope > .vlist-t > .vlist-r > .vlist")!.children].map(row => row.lastElementChild!);
      const left = cells(cols[0]), right = cells(cols[1]);
      return { indent: table.getBoundingClientRect().left - root.getBoundingClientRect().left,
        starts: right.map(cell => { const atoms = [...cell.children].filter(child => child.textContent && !child.classList.contains("mspace")); const relation = atoms.findIndex(child => child.classList.contains("mrel") && child.textContent === "="); const expression = layout === "B-columns" ? atoms[0] : atoms[relation + 1]; return expression.getBoundingClientRect().left; }),
        leftEnds: left.map(cell => cell.getBoundingClientRect().right) };
    }, fixture.layout);
    expect(Math.max(...geometry.starts) - Math.min(...geometry.starts)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(geometry.indent - 18)).toBeLessThanOrEqual(0.5);
    if (fixture.layout === "A") expect(Math.max(...geometry.leftEnds) - Math.min(...geometry.leftEnds)).toBeLessThanOrEqual(0.5);
  }
});

test("subpixel capacity boundaries and intentional mathematical space are measured", async ({ page }) => {
  await open(page); await ready(page, "mixed");
  await update(page, "mixed", { content: "$abcdefghij+klmnop=qrst$", width: 600, height: 200 });
  const intrinsic = (await ready(page, "mixed")).layout.width;
  await update(page, "mixed", { width: intrinsic + 0.1 }); expect((await ready(page, "mixed")).fits).toBe(true);
  await update(page, "mixed", { width: intrinsic - 0.1 }); expect((await ready(page, "mixed")).layout.overflowX).toBe(true);
  await update(page, "mixed", { content: String.raw`$$x\kern{30em}$$`, width: 200 });
  const spaced = await ready(page, "mixed"); expect(spaced.layout.width).toBeGreaterThan(500); expect(spaced.layout.overflowX).toBe(true);
  await update(page, "mixed", { content: "", height: 0 });
  const empty = await ready(page, "mixed"); expect(empty.fits).toBe(true); expect(empty.layout.width).toBe(0); expect(empty.layout.height).toBe(0);
  await update(page, "container", { width: 0 });
  await expect.poll(async () => (await read(page, "container")).status).toBe("measurement-unavailable");
});

test("font timeout is unavailable, never fit, and successful completion can recover", async ({ page }) => {
  test.setTimeout(25000);
  await open(page); await ready(page, "mixed");
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let intercepted = false;
  await page.route("**/review-timeout.woff2", async route => {
    intercepted = true; await held;
    await route.fulfill({ status: 200, contentType: "font/woff2", path: "node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2" });
  });
  try {
    await page.evaluate(() => { document.fonts.add(new FontFace("ReviewTimeout", "url(/review-timeout.woff2)")); });
    await update(page, "mixed", { presentation: { ...presentation, fontFamily: "ReviewTimeout, Arial" } });
    await expect.poll(() => intercepted).toBe(true);
    await expect.poll(async () => (await read(page, "mixed")).status, { timeout: 13000 }).toBe("measurement-unavailable");
    const timedOut = await read(page, "mixed");
    expect("fits" in timedOut).toBe(false); expect(timedOut.diagnostics.some(d => d.code === "FONT_TIMEOUT")).toBe(true);
    expect((await ready(page, "container")).fits).toBe(true);
    release(); expect((await ready(page, "mixed")).fits).toBe(true);
  } finally { release(); }
});

test("an active ancestor transform animation cannot retain an earlier fit", async ({ page }) => {
  await open(page); await ready(page, "mixed");
  await sample(page, "mixed").locator("[data-capacity-host]").evaluate(host => {
    (host as HTMLElement).style.transition = "transform .2s linear";
    (host as HTMLElement).style.transform = "rotate(12deg)";
  });
  await expect.poll(async () => (await read(page, "mixed")).status).toBe("measurement-unavailable");
  await sample(page, "mixed").locator("[data-capacity-host]").evaluate(host => { (host as HTMLElement).style.transform = "none"; });
  expect((await ready(page, "mixed")).fits).toBe(true);
});
