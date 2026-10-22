import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

async function ready(page: Page) {
  await page.goto("/info-cards");
  await expect(page.locator(".step-view-layer")).toBeVisible();
  await expect(page.locator(".step-view-layer")).toHaveCSS("transform", "none");
  await expect(page.locator(".focused-card-object")).not.toHaveCSS("transform", "none");
}

async function screenshot(page: Page, name: string, info: TestInfo) {
  const directory = process.env.INFO_CARDS_CAPTURE_DIR;
  const path = directory ? resolve(directory, `${name}.png`) : info.outputPath(`${name}.png`);
  if (directory) mkdirSync(directory, { recursive: true });
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const element = (selector: string) => document.querySelector<HTMLElement>(selector)!;
    const rect = (node: Element) => {
      const value = node.getBoundingClientRect();
      return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    };
    const previous = element(".step-view-actions > button:first-of-type");
    const next = element(".step-view-actions > button:last-of-type");
    const step = element(".step-view-layer");
    const face = document.querySelector<HTMLElement>("[data-info-card-face]");
    const body = face?.querySelector<HTMLElement>("[data-info-card-body]");
    const header = face?.querySelector<HTMLElement>("[data-info-card-header]");
    const paragraphs = body ? Array.from(body.querySelectorAll("p")) : [];
    const lines = paragraphs.flatMap((paragraph) => {
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      return Array.from(range.getClientRects()).filter(value => value.width > 0).map(value => ({ y: value.y, height: value.height }));
    });
    const scale = element(".focused-card-object").getBoundingClientRect().width / element(".focused-card-object").offsetWidth;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      previous: rect(previous), next: rect(next), index: rect(element(".step-view-actions > span")),
      step: rect(step), footer: rect(element(".step-view-actions")), video: rect(element(".step-view-video-placeholder")),
      bodyHeight: element(".step-view-body").getBoundingClientRect().height,
      pouch: document.querySelector("button[aria-controls], button[aria-expanded][aria-label*='attached']") ? rect(element("button[aria-label*='attached']")) : null,
      pouchIcon: document.querySelector("[data-info-card-pouch-icon]") ? rect(element("[data-info-card-pouch-icon]")) : null,
      pouchCount: document.querySelector("[data-info-card-pouch-count]") ? rect(element("[data-info-card-pouch-count]")) : null,
      close: document.querySelector("button[aria-label='Close information card stack']") ? rect(element("button[aria-label='Close information card stack']")) : null,
      backings: Array.from(document.querySelectorAll("[data-info-card-backing]")).map(rect),
      face: face ? {
        ...rect(face), headerFits: header!.scrollWidth <= header!.clientWidth + 1,
        title: rect(face.querySelector("[data-info-card-title]")!), body: rect(body!),
        media: face.querySelector("button:not([aria-expanded])") ? rect(face.querySelector("button:not([aria-expanded])")!) : null,
        layoutHeight: parseFloat(getComputedStyle(face).height),
        paddingPx: parseFloat(getComputedStyle(face).paddingLeft) * scale,
        bodyFits: body!.scrollHeight <= body!.clientHeight + 1,
        bodyAvailableHeight: body!.clientHeight * scale, bodyContentHeight: body!.scrollHeight * scale,
        bodyUsedHeight: paragraphs.length ? paragraphs[paragraphs.length - 1].getBoundingClientRect().bottom - body!.getBoundingClientRect().top : 0,
        headerAvailableWidth: header!.clientWidth * scale, headerRequiredWidth: header!.scrollWidth * scale,
        bodyFontPx: parseFloat(getComputedStyle(body!).fontSize) * scale,
        lineHeightPx: parseFloat(getComputedStyle(body!).lineHeight) * scale,
        headerGapPx: parseFloat(getComputedStyle(header!).marginBottom) * scale,
        paragraphGapPx: paragraphs[1] ? parseFloat(getComputedStyle(paragraphs[1]).marginTop) * scale : 0,
        // Preserved spaces can create extra Range rects on the same visual line.
        lines: new Set(lines.map(line => Math.round(line.y * 10))).size,
        paragraphs: paragraphs.length, characters: body!.textContent!.length,
        headerText: header!.textContent, bodyText: body!.textContent,
        seriesFontPx: parseFloat(getComputedStyle(face.querySelector("button[aria-expanded]")!).fontSize) * scale,
        titleFontPx: parseFloat(getComputedStyle(face.querySelector("[data-info-card-title]")!).fontSize) * scale,
        seriesWeight: getComputedStyle(face.querySelector("button[aria-expanded]")!).fontWeight,
        titleWeight: getComputedStyle(face.querySelector("[data-info-card-title]")!).fontWeight,
        background: getComputedStyle(face).backgroundImage,
        mediaHeight: face.querySelector("button:not([aria-expanded])")?.getBoundingClientRect().height ?? 0,
        overflow: getComputedStyle(body!).overflow,
      } : null,
    };
  });
}

for (const viewport of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 430, height: 764 }]) {
  test(`actual footer and complete static face at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await ready(page);
    const closed = await measure(page);
    expect(Math.abs(closed.previous.width - closed.next.width)).toBeLessThan(0.2);
    expect(Math.abs(closed.previous.height - closed.next.height)).toBeLessThan(0.2);
    expect(Math.abs(closed.index.x + closed.index.width / 2 - closed.video.x - closed.video.width / 2)).toBeLessThan(0.5);
    expect(Math.abs(closed.previous.x + closed.previous.width / 2 + closed.next.x + closed.next.width / 2 - 2 * closed.index.x - closed.index.width)).toBeLessThan(0.5);
    expect(Math.abs(closed.pouch!.x - closed.step.x)).toBeLessThan(0.25);
    expect(Math.abs(closed.pouch!.bottom - closed.step.bottom)).toBeLessThan(0.25);
    expect(closed.pouch!.y).toBeLessThan(closed.footer.bottom);
    expect(closed.pouch!.right).toBeLessThan(closed.previous.x);
    expect(closed.pouch!.width).toBeGreaterThanOrEqual(44);
    expect(closed.pouchCount!.x).toBeGreaterThan(closed.pouchIcon!.right);
    // Keep the complete count below the diagonal, not just its centre/hit target.
    expect(closed.pouchCount!.right - closed.pouch!.x).toBeLessThanOrEqual(closed.pouchCount!.y - closed.pouch!.y + 0.25);
    expect(Math.abs(closed.pouchIcon!.y + closed.pouchIcon!.height / 2 - closed.pouchCount!.y - closed.pouchCount!.height / 2)).toBeLessThan(0.2);
    await expect(page.locator("[data-info-card-pouch-icon] circle")).toHaveCount(2);
    await expect(page.locator("[data-info-card-pouch-icon] path")).toHaveCount(1);
    expect(closed.video.width / closed.step.width).toBeGreaterThan(0.52);
    expect(closed.video.width / closed.step.width).toBeLessThan(0.56);
    expect(closed.face).toBeNull();
    const prefix = viewport.height === 764 ? "430-reference-aspect" : String(viewport.width);
    await screenshot(page, `${prefix}-closed`, info);
    expect(await page.locator("[data-info-card-pouch]").evaluate(pouch => {
      const r = pouch.getBoundingClientRect();
      return [[0.12, 0.3], [0.3, 0.75], [0.7, 0.9]].every(([x, y]) =>
        document.elementFromPoint(r.x + r.width * x, r.y + r.height * y)?.closest("[data-info-card-pouch]") === pouch);
    })).toBe(true);

    await page.getByRole("checkbox", { name: "Attachments", exact: true }).uncheck();
    await expect(page.getByRole("button", { name: /information cards/ })).toHaveCount(0);
    const absent = await measure(page);
    expect(Math.abs(absent.bodyHeight - closed.bodyHeight)).toBeLessThan(0.2);
    await page.getByRole("checkbox", { name: "Attachments", exact: true }).check();
    await page.getByRole("button", { name: /^Open information cards/ }).click();
    const open = await measure(page);
    expect(open.face!.headerFits).toBe(true);
    expect(open.face!.bodyFits).toBe(true);
    expect(open.face!.paragraphs).toBe(2);
    expect(open.face!.lines).toBe(5);
    expect(open.face!.width).toBeGreaterThan(open.face!.height);
    expect(open.face!.layoutHeight / 116).toBeCloseTo(1.35, 2);
    expect(open.face!.width / open.step.width).toBeGreaterThan(0.94);
    expect((open.step.bottom - open.face!.bottom) / open.step.height).toBeLessThan(0.05);
    expect(open.face!.bottom).toBeGreaterThan(open.footer.y);
    expect(open.face!.y - open.video.y).toBeGreaterThan(40);
    expect(Math.abs(open.bodyHeight - closed.bodyHeight)).toBeLessThan(0.2);
    expect(open.face!.headerGapPx).toBeGreaterThan(open.face!.paragraphGapPx);
    expect(open.face!.mediaHeight).toBeGreaterThanOrEqual(42);
    expect(open.face!.seriesFontPx).toBeLessThan(open.face!.titleFontPx);
    expect(Number(open.face!.seriesWeight)).toBeLessThan(Number(open.face!.titleWeight));
    expect(open.face!.background).toContain("linear-gradient");
    expect(open.close!.width).toBeGreaterThanOrEqual(42);
    expect(open.close!.y).toBeCloseTo(open.face!.y, 1);
    expect(open.close!.right).toBeCloseTo(open.face!.right, 1);
    expect(open.close!.x).toBeGreaterThan(open.face!.title.right);
    expect(open.close!.bottom).toBeLessThanOrEqual(open.face!.body.y);
    expect(open.face!.media!.bottom).toBeLessThan(open.face!.bottom - 10);
    expect(open.face!.media!.y).toBeGreaterThan(open.face!.body.y + open.face!.bodyUsedHeight);
    expect(open.backings[0].x).toBeLessThan(open.face!.x);
    expect(open.backings[1].right).toBeGreaterThan(open.face!.right);
    expect(open.face!.y - open.backings[0].y).toBeLessThan(12);
    await expect(page.locator("[data-info-card-backing]")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
    await expect(page.locator("[data-info-card-face] img, [data-info-card-face] video")).toHaveCount(0);
    await expect(page.locator("[data-info-card-face]")).not.toContainText(/\d+\s*\/\s*\d+|\bINFO\b/);
    await screenshot(page, `${prefix}-open`, info);
    await page.locator("[data-info-card-body]").click();
    await expect(page.locator("[data-info-card-face]")).toBeVisible();
    await page.getByRole("button", { name: /^Close information cards/ }).click();
    await expect(page.locator("[data-info-card-face]")).toHaveCount(0);
    await expect(page.locator(".step-view-actions > span")).toHaveText("1/4");
    await page.getByRole("button", { name: /^Open information cards/ }).click();
    await page.getByRole("button", { name: "Close information card stack", exact: true }).click();
    await expect(page.locator("[data-info-card-face]")).toHaveCount(0);
    await expect(page.locator(".step-view-layer")).toHaveCount(1);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".step-view-actions > span")).toHaveCount(1);
    await expect(page.locator(".step-view-actions > span")).toHaveText("2/4");
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.locator(".step-view-actions > span")).toHaveCount(1);
    await expect(page.locator(".step-view-actions > span")).toHaveText("1/4");
    expect(errors).toEqual([]);
    await info.attach("measurements", { body: JSON.stringify({ closed, open, noAttachments: absent }, null, 2), contentType: "application/json" });
  });
}

test("attribution is secondary, hoverable, keyboard accessible and dismissible", async ({ page }, info) => {
  await ready(page);
  await page.getByRole("button", { name: "Static open", exact: true }).click();
  const series = page.getByRole("button", { name: /^Series What You Need/ });
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  const before = await measure(page);
  await series.hover();
  await expect(page.getByRole("tooltip")).toHaveText("peter");
  expect((await measure(page)).face!.height).toBe(before.face!.height);
  await screenshot(page, "390-attribution", info);
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.keyboard.press("Tab");
  await series.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(series).toBeFocused();
  await expect(page.locator("[data-info-card-face]")).toBeVisible();
  await page.getByRole("button", { name: "Watch video", exact: true }).click();
  await expect(page.locator("p[role=status]")).toContainText("Phase 1C");
});

test("approved-image comparisons preserve proportions and show the corrected actual Step View", async ({ page }, info) => {
  // 430×764 has the same aspect ratio as the 941×1672 supplied references.
  await page.setViewportSize({ width: 430, height: 764 });
  await ready(page);
  await expect(page.locator(".step-view-video-placeholder image")).toHaveAttribute("href", "/info-card-references/closed-step-view.png");
  const closed = await page.locator(".step-view-layer").screenshot();
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  const open = await page.locator(".step-view-layer").screenshot();
  for (const [state, capture, filename, bounds] of [
    ["closed", closed, "closed-step-view.png", "38 294 867 1204"],
    ["open", open, "open-info-card-bundle.png", "37 294 869 1260"],
  ] as const) {
    const reference = readFileSync(resolve("docs/design/features/info-cards", filename)).toString("base64");
    const ratio = state === "closed" ? "867 / 1204" : "869 / 1260";
    await page.setViewportSize({ width: 920, height: 760 });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;padding:20px;background:#10151d;color:#e2e7ee;font:14px/1.4 Arial,sans-serif}
      h1{font-size:18px;margin:0 0 12px}.columns{display:grid;grid-template-columns:430px 430px;gap:20px}
      p{margin:0 0 8px}svg,img{display:block;width:430px;height:auto}small{display:block;margin-top:10px;color:#b2bdcc}
      </style></head><body><h1>Phase 1A ${state}: approved reference / corrected implementation</h1>
      <div class="columns"><section><p>Approved reference — Step View crop</p><svg viewBox="${bounds}" style="aspect-ratio:${ratio}"><image href="data:image/png;base64,${reference}" width="941" height="1672" /></svg></section>
      <section><p>Actual Step View — captured at 430 × 764</p><img alt="Corrected static ${state} Step View" src="data:image/png;base64,${capture.toString("base64")}" /></section></div>
      <small>Matched Step View widths; each aspect ratio is preserved. Reference crop bounds are manually measured. Later decisions require a 35% taller face, minimalist header, two backing edges and integrated consultation X; older reference indices/headings do not apply.</small></body></html>`);
    await screenshot(page, `${state}-reference-comparison`, info);
  }
});

test("series attribution supports touch without opening media or closing the face", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await ready(page);
    await page.getByRole("button", { name: /^Open information cards/ }).tap();
    const series = page.getByRole("button", { name: /^Series What You Need/ });
    await series.tap();
    await expect(page.getByRole("tooltip")).toHaveText("peter");
    await page.locator("[data-info-card-body]").tap();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(page.locator("[data-info-card-face]")).toBeVisible();
    await expect(page.locator("p[role=status]")).toHaveCount(0);
  } finally { await context.close(); }
});

test("capacity samples disclose overflow without clipping or shrinking text", async ({ page }, info) => {
  await ready(page);
  await page.getByRole("button", { name: "Static open", exact: true }).click();
  const samples = [];
  for (const name of ["maths", "basketball", "tall-lines", "long-header", "over-capacity"]) {
    await page.getByRole("combobox", { name: "Sample", exact: true }).selectOption(name);
    const value = await measure(page);
    samples.push({ name, ...value.face });
    if (name === "long-header") expect(value.face!.headerFits).toBe(false);
    else expect(value.face!.headerFits).toBe(true);
    if (name === "over-capacity") {
      expect(value.face!.bodyFits).toBe(false);
      expect(value.face!.paragraphs).toBe(10);
      await expect(page.locator("[data-capacity-report]")).toContainText("OVER CAPACITY");
    } else expect(value.face!.bodyFits).toBe(true);
    expect(value.face!.overflow).toBe("visible");
    if (name === "basketball" || name === "tall-lines") await screenshot(page, `390-${name}`, info);
  }
  await page.getByRole("combobox", { name: "Sample", exact: true }).selectOption("maths");
  await page.getByRole("checkbox", { name: "Media", exact: true }).uncheck();
  await expect(page.getByRole("button", { name: /Watch video|View image/ })).toHaveCount(0);
  const without = await measure(page);
  expect(without.face!.bodyFits).toBe(true);
  expect(without.face!.height).toBe(samples[0].height);
  samples.push({ name: "no-media", ...without.face });
  await screenshot(page, "390-no-media", info);
  await info.attach("capacity-samples", { body: JSON.stringify(samples, null, 2), contentType: "application/json" });
});

test("records short-landscape geometry without claiming an exceptional-size fallback", async ({ page }, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await ready(page);
  await page.getByRole("button", { name: "Static open", exact: true }).click();
  const value = await measure(page);
  await screenshot(page, "844-landscape-observation", info);
  await info.attach("landscape-observation", { body: JSON.stringify(value, null, 2), contentType: "application/json" });
  await expect(page.locator("meta[name=viewport]")).not.toHaveAttribute("content", /user-scalable=no|maximum-scale=1/);
});
