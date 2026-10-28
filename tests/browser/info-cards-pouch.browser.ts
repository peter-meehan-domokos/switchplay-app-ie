import { expect, test, type Locator } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

test.use({ deviceScaleFactor: 3 });

test.describe("inward pouch touch target", () => {
  test.use({ hasTouch: true });
  for (const width of [360, 390, 430, 844]) test(`invisible extension opens without taking Previous or media input at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    await page.goto("/info-cards/integration");
    await page.locator(".deck-card.is-active").click();
    await page.locator(".focused-card-layer .active-card-identity").click();
    const step = page.locator(".step-view-layer");
    await expect(step).toHaveCSS("transform", "none");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(step).toHaveCount(1);
    await expect(step).toHaveCSS("transform", "none");
    const pouch = step.locator("[data-info-card-pouch]");
    const geometry = await pouch.evaluate(button => {
      const pouch = button.getBoundingClientRect(), step = button.closest(".step-view-layer")!;
      const previous = step.querySelector("footer > button")!.getBoundingClientRect();
      return { pouch: pouch.toJSON(), previous: previous.toJSON(), scale: pouch.width / 46 };
    });
    await info.attach("touch-target-geometry", { body: JSON.stringify(geometry), contentType: "application/json" });
    const point = (x: number, y: number) => ({ x: geometry.pouch.left + x * geometry.scale, y: geometry.pouch.top + y * geometry.scale });
    // Both points are above/right of the visible y=x seam; the latter uses
    // the available space nearest Previous, without extending the button box.
    for (const [x, y] of [[24, 14], [41, 24]]) {
      const p = point(x, y);
      expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest("[data-info-card-pouch]")), p)).toBe(true);
      await page.touchscreen.tap(p.x, p.y);
      await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
      await expect(page.locator(".step-view-actions > span")).toHaveText("2/4");
      await page.getByRole("button", { name: "Close information card stack", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Info card consultation", exact: true })).toHaveCount(0);
    }
    // Interior artwork must paint identically. Exclude the outermost CSS pixel:
    // moving the same clip to a visual child can round its edge antialiasing.
    const box = (await pouch.boundingBox())!;
    const artwork = () => page.screenshot({ clip: { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 } });
    const enlarged = await artwork();
    await pouch.evaluate(button => {
      (button as HTMLElement).style.clipPath = "polygon(0 0, 100% 100%, 0 100%)";
      // Historical painting clipped the button, not its visual wrapper as well.
      button.querySelector<HTMLElement>(":scope > span")!.style.clipPath = "none";
    });
    const original = await artwork();
    await info.attach("expanded-hit-artwork", { body: enlarged, contentType: "image/png" });
    await info.attach("historical-hit-artwork", { body: original, contentType: "image/png" });
    await pouch.evaluate(button => {
      (button as HTMLElement).style.removeProperty("clip-path");
      button.querySelector<HTMLElement>(":scope > span")!.style.removeProperty("clip-path");
    });
    expect(enlarged.equals(original)).toBe(true);
    const hitRight = point(42, 24).x;
    expect(geometry.previous.left - hitRight).toBeGreaterThanOrEqual(4 * geometry.scale - 0.1);
    const gap = { x: (hitRight + geometry.previous.left) / 2, y: geometry.previous.top + geometry.previous.height / 2 };
    expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest("[data-info-card-pouch]")), gap)).toBe(false);
    await page.touchscreen.tap(gap.x, gap.y);
    await expect(page.getByRole("dialog", { name: "Info card consultation", exact: true })).toHaveCount(0);
    await expect(page.locator(".step-view-actions > span")).toHaveText("2/4");
    await page.touchscreen.tap(geometry.previous.left + 2, gap.y);
    await expect(step).toHaveCount(1);
    await expect(page.locator(".step-view-actions > span")).toHaveText("1/4");
    await expect(page.locator(".focused-card-object")).not.toHaveClass(/is-flipped/);
    await page.touchscreen.tap(point(24, 14).x, point(24, 14).y);
    await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
    await page.getByRole("button", { name: "View image", exact: true }).tap();
    await expect(page.getByRole("dialog", { name: "Info card media", exact: true })).toBeVisible();
  });
});

// Measure visible artwork, not the SVG viewport or the text line box. These
// checks supplement the retained screenshots; they are not visual acceptance.
async function measure(pouch: Locator) {
  return pouch.evaluate(button => {
    const rect = button.getBoundingClientRect();
    const scale = rect.width / 46;
    const label = button.querySelector<HTMLElement>("[data-info-card-pouch-label]")!;
    const count = button.querySelector<HTMLElement>("[data-info-card-pouch-count]")!;
    const range = document.createRange();
    range.selectNodeContents(count);
    const textRect = range.getBoundingClientRect();
    const css = getComputedStyle(count);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    const metrics = ctx.measureText(count.textContent!);
    const baseline = textRect.top + metrics.fontBoundingBoxAscent * scale;
    const ink = {
      left: (textRect.left - rect.left) / scale - metrics.actualBoundingBoxLeft,
      top: (baseline - rect.top) / scale - metrics.actualBoundingBoxAscent,
      right: (textRect.left - rect.left) / scale + metrics.actualBoundingBoxRight,
      bottom: (baseline - rect.top) / scale + metrics.actualBoundingBoxDescent,
    };
    const shape = button.closest("[data-info-pouch-alignment]") ?? document.querySelector(".step-view-layer")!;
    const radius = parseFloat(getComputedStyle(shape).borderBottomLeftRadius);
    const arcCentre = { x: radius, y: 46 - radius };
    const clearance = (x: number, y: number) => ({
      left: x, bottom: 46 - y, diagonal: (y - x) / Math.SQRT2,
      roundedCorner: x < radius && y > 46 - radius
        ? radius - Math.hypot(x - arcCentre.x, y - arcCentre.y) : Infinity,
    });
    const points = [clearance(ink.left, ink.top), clearance(ink.right, ink.top),
      clearance(ink.left, ink.bottom), clearance(ink.right, ink.bottom)];
    const icon = button.querySelector<SVGSVGElement>("[data-info-card-pouch-icon]");
    let artwork = { ...ink };
    if (icon) {
      const r = icon.getBoundingClientRect();
      const x = (r.left + r.width / 2 - rect.left) / scale;
      const y = (r.top + r.height / 2 - rect.top) / scale;
      const outerRadius = 7.1 * r.width / 16 / scale;
      const centreClearance = clearance(x, y);
      points.push({ left: x - outerRadius, bottom: 46 - y - outerRadius,
        diagonal: centreClearance.diagonal - outerRadius,
        roundedCorner: radius - Math.hypot(x - arcCentre.x, y - arcCentre.y) - outerRadius });
      artwork = { left: Math.min(ink.left, x - outerRadius), top: Math.min(ink.top, y - outerRadius),
        right: Math.max(ink.right, x + outerRadius), bottom: Math.max(ink.bottom, y + outerRadius) };
    }
    const labelRect = label.getBoundingClientRect();
    const minimum = Object.fromEntries(["left", "bottom", "diagonal", "roundedCorner"].map(key => [key,
      Math.min(...points.map(p => p[key as keyof typeof p]))]));
    return { pouch: rect.toJSON(), scale, radius, position: count.textContent,
      label: labelRect.toJSON(), artwork, clearance: minimum,
      artworkCentre: { x: (artwork.left + artwork.right) / 2, y: (artwork.top + artwork.bottom) / 2 } };
  });
}

for (const width of [360, 390, 430]) test(`rounded triangular pouch composition at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 360 ? 780 : width === 390 ? 844 : 932 });
  await page.goto("/info-cards/integration");
  const count = width === 430 ? 12 : 5;
  await page.getByRole("combobox", { name: "Cards", exact: true }).selectOption(String(count));
  await page.locator(".deck-card.is-active").click();
  await page.locator(".focused-card-layer .active-card-identity").click();
  await expect(page.locator(".step-view-layer")).toHaveCSS("transform", "none");
  await page.evaluate(() => document.fonts.ready);
  const output: Record<string, Awaited<ReturnType<typeof measure>>> = {};
  const capture = async (name: string) => {
    const directory = process.env.INFO_CARDS_POUCH_CAPTURE_DIR;
    if (directory) mkdirSync(directory, { recursive: true });
    const path = directory ? resolve(directory, `${width}-${name}.png`) : info.outputPath(`${width}-${name}.png`);
    await page.screenshot({ path });
    await info.attach(name, { path, contentType: "image/png" });
  };
  const closed = page.locator('[data-info-card-pouch][aria-expanded="false"]');
  output.closed = await measure(closed);
  await capture("pouch-closed");
  await closed.click();
  await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
  const open = page.locator('dialog [data-info-card-pouch]');
  await expect(open.locator("[data-info-card-pouch-icon]")).toHaveCount(0);
  await expect(open.locator("[data-info-card-pouch-count]")).toHaveText("1");
  output.open = await measure(open);
  await capture("pouch-open");
  await page.getByRole("button", { name: "Close information card stack", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(open.locator("[data-info-card-pouch-count]")).toHaveText("2");
  if (count === 12) {
    await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
    await page.keyboard.press("ArrowUp");
    await expect(open.locator("[data-info-card-pouch-count]")).toHaveText("1");
    await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
    await page.keyboard.press("ArrowUp");
    await expect(open.locator("[data-info-card-pouch-count]")).toHaveText("12");
    output.openTwoDigits = await measure(open);
    await capture("pouch-open-12");
  }
  await page.getByRole("button", { name: "Close information card stack", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Info card consultation", exact: true })).toHaveCount(0);
  await expect(closed.locator("[data-info-card-pouch-count]")).toHaveText(String(count));
  await closed.click();
  await expect(open.locator("[data-info-card-pouch-count]")).toHaveText("1");
  await info.attach("pouch-geometry", { body: JSON.stringify(output, null, 2), contentType: "application/json" });
  for (const result of Object.values(output)) {
    expect(result.radius).toBe(30);
    expect(result.clearance.diagonal).toBeGreaterThan(2);
    expect(result.clearance.roundedCorner).toBeGreaterThan(2);
    expect(result.clearance.bottom).toBeGreaterThan(2);
  }
  expect(output.open.artworkCentre.x).toBeCloseTo(15.8934, 0);
  expect(output.open.artworkCentre.y).toBeCloseTo(30.1066, 0);
});
