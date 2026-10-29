import { expect, test, type Page } from "@playwright/test";
import type { MathsResult } from "../../src/components/maths-renderer/types";

type ObserverRecord = { kind: string; owner: boolean; targets: Node[] };
declare global { interface Window { mathsObserverRecords: ObserverRecord[]; retainedMathsHost?: HTMLElement } }

async function open(page: Page) {
  await page.goto("/dev/maths-renderer");
  await page.waitForFunction(() => !!window.mathsFixtures?.mixed);
  await page.locator("[data-regression-fixtures]").evaluate(element => { (element as HTMLDetailsElement).open = true; });
  await page.waitForFunction(() => !!window.mathsLifecycle);
  await ready(page);
}
async function result(page: Page): Promise<MathsResult> { return JSON.parse((await page.locator("[data-lifecycle-result]").textContent())!); }
async function ready(page: Page) {
  let value: MathsResult | null = null;
  await expect.poll(async () => { value = await result(page); return value?.status; }).toBe("ready");
  value = value as MathsResult | null;
  if (!value || value.status !== "ready") throw new Error("Expected current ready result");
  return value;
}
async function settle(page: Page) {
  await page.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
}

test("detached hosts become unavailable and recover with observers on their new ancestors", async ({ page }) => {
  await open(page);
  await page.evaluate(() => { const host = document.querySelector<HTMLElement>("[data-lifecycle-outer]")!; window.retainedMathsHost = host; host.remove(); });
  await expect.poll(async () => (await result(page)).status).toBe("measurement-unavailable");
  expect("fits" in await result(page)).toBe(false);
  await page.evaluate(() => {
    const parent = document.createElement("div"); parent.dataset.reparentedMaths = "";
    document.querySelector("[data-lifecycle-fixture]")!.append(parent);
    parent.append(window.retainedMathsHost!);
  });
  await ready(page);
  await page.locator("[data-reparented-maths]").evaluate(element => { (element as HTMLElement).style.transform = "skewX(5deg)"; });
  await expect.poll(async () => (await result(page)).status).toBe("measurement-unavailable");
  const unavailable = await result(page);
  if (unavailable.status === "measurement-unavailable") expect(unavailable.reason).toBe("UNSUPPORTED_TRANSFORM");
  await page.locator("[data-reparented-maths]").evaluate(element => { (element as HTMLElement).style.transform = "translate(12px, 7px) scale(1.25, .8)"; });
  await ready(page);
});

test("a stable host ref can change target and observes the replacement height budget", async ({ page }) => {
  await open(page);
  expect((await ready(page)).layout.available.height).toBe(50);
  await page.evaluate(() => window.mathsLifecycle!.useHost("outer"));
  await expect.poll(async () => (await ready(page)).layout.available.height).toBe(300);
  expect((await ready(page)).fits).toBe(true);
  await page.locator("[data-lifecycle-outer]").evaluate(element => { (element as HTMLElement).style.height = "30px"; });
  await expect.poll(async () => (await ready(page)).layout.available.height).toBe(30);
  expect((await ready(page)).layout.overflowY).toBe(true);
  await page.evaluate(() => window.mathsLifecycle!.useHost("inner"));
  await expect.poll(async () => (await ready(page)).layout.available.height).toBe(50);
});

test("visibility and native disclosure changes recover without an old fit", async ({ page }) => {
  await open(page);
  const fixture = page.locator("[data-lifecycle-fixture]");
  for (const property of ["visibility", "contentVisibility"] as const) {
    await fixture.evaluate((element, property) => { (element as HTMLElement).style[property] = "hidden"; }, property);
    await expect.poll(async () => (await result(page)).status).toBe("measurement-unavailable");
    expect("fits" in await result(page)).toBe(false);
    await fixture.evaluate((element, property) => { (element as HTMLElement).style[property] = "visible"; }, property);
    await ready(page);
  }
  await page.locator("[data-regression-fixtures]").evaluate(element => { (element as HTMLDetailsElement).open = false; });
  await expect.poll(async () => (await result(page)).status).toBe("measurement-unavailable");
  await page.locator("[data-regression-fixtures]").evaluate(element => { (element as HTMLDetailsElement).open = true; });
  await ready(page);
});

test("unrelated fonts, paint changes and equivalent consumer rerenders do not repeat callbacks", async ({ page }) => {
  await page.route("**/unused-stage4.woff2", route => route.abort());
  await open(page); await settle(page);
  await page.evaluate(async () => {
    window.mathsLifecycle!.history.length = 0;
    window.mathsLifecycle!.update({ revision: 1 });
    document.querySelector<HTMLElement>("[data-lifecycle-outer]")!.style.color = "rgb(25, 40, 50)";
    window.dispatchEvent(new Event("resize"));
    const face = new FontFace("UnusedStage4", "url(/unused-stage4.woff2)");
    document.fonts.add(face); await face.load().catch(() => {});
  });
  await settle(page);
  expect(await page.evaluate(() => window.mathsLifecycle!.history)).toEqual([]);
  const previous = (await ready(page)).generation;
  await page.evaluate(() => window.mathsLifecycle!.update({ content: "New $y=2$ content." }));
  await expect.poll(async () => (await ready(page)).generation).toBeGreaterThan(previous);
  const history = await page.evaluate(() => window.mathsLifecycle!.history);
  expect(history.filter(entry => entry.result.status === "ready")).toHaveLength(1);
  expect(history.every(entry => entry.content === "New $y=2$ content.")).toBe(true);
});

test("strict mounting and repeated remounts clean up all instance-owned observers", async ({ page }) => {
  await page.addInitScript(() => {
    window.mathsObserverRecords = [];
    const Resize = window.ResizeObserver, Mutation = window.MutationObserver;
    window.ResizeObserver = class extends Resize {
      record: ObserverRecord = { kind: "resize", owner: false, targets: [] };
      constructor(callback: ResizeObserverCallback) { super(callback); window.mathsObserverRecords.push(this.record); }
      observe(target: Element, options?: ResizeObserverOptions) { this.record.owner ||= !!target.closest("[data-lifecycle-fixture]"); this.record.targets.push(target); super.observe(target, options); }
      disconnect() { this.record.targets.length = 0; super.disconnect(); }
    };
    window.MutationObserver = class extends Mutation {
      record: ObserverRecord = { kind: "mutation", owner: false, targets: [] };
      constructor(callback: MutationCallback) { super(callback); window.mathsObserverRecords.push(this.record); }
      observe(target: Node, options?: MutationObserverInit) { this.record.owner ||= target instanceof Element && !!target.closest("[data-lifecycle-fixture]"); this.record.targets.push(target); super.observe(target, options); }
      disconnect() { this.record.targets.length = 0; super.disconnect(); }
    };
  });
  await open(page); await settle(page);
  expect(await page.evaluate(() => window.mathsObserverRecords.filter(record => record.owner && record.kind === "resize").length)).toBeGreaterThanOrEqual(2);
  for (let cycle = 0; cycle < 3; cycle++) {
    expect(await page.evaluate(() => window.mathsObserverRecords.filter(record => record.owner && record.targets.length > 0).map(record => record.kind).sort())).toEqual(["mutation", "resize"]);
    await page.evaluate(() => window.mathsLifecycle!.update({ mounted: false }));
    await expect(page.locator("[data-lifecycle-fixture] [data-maths-renderer]")).toHaveCount(0);
    const count = await page.evaluate(() => window.mathsLifecycle!.history.length);
    await settle(page);
    expect(await page.evaluate(() => window.mathsObserverRecords.filter(record => record.owner && record.targets.length > 0))).toEqual([]);
    expect(await page.evaluate(() => window.mathsLifecycle!.history.length)).toBe(count);
    await page.evaluate(() => { window.mathsLifecycle!.history.length = 0; window.mathsLifecycle!.update({ mounted: true }); });
    await ready(page); await settle(page);
    expect(await page.evaluate(() => window.mathsLifecycle!.history.filter(entry => entry.result.status === "ready").length)).toBe(1);
  }
});

test("missing ResizeObserver reports unavailable instead of a fit or a component crash", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.mathsLifecycle!.update({ mounted: false }));
  await expect(page.locator("[data-lifecycle-fixture] [data-maths-renderer]")).toHaveCount(0);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const nativeObserver = await page.evaluateHandle(() => window.ResizeObserver);
  await page.evaluate(() => { Object.defineProperty(window, "ResizeObserver", { value: undefined, configurable: true }); window.mathsLifecycle!.update({ mounted: true }); });
  await expect.poll(async () => { const value = await result(page); return value.status === "measurement-unavailable" ? value.reason : null; }).toBe("RESIZE_OBSERVER_UNAVAILABLE");
  await page.evaluate(observer => { window.ResizeObserver = observer; }, nativeObserver);
  await nativeObserver.dispose();
  expect(errors).toEqual([]);
});
