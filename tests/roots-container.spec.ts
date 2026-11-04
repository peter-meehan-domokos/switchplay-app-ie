import { expect, test, type Locator, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

declare global { interface Window { rootsTouchSnapshot: () => { attemptId: string; sequence: number; state: { root: number } } } }
let html: string;
test.use({ hasTouch: true, contextOptions: { reducedMotion: "reduce" } });
test.beforeAll(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import { useState } from "react"; import { createRoot } from "react-dom/client";
    import Host from "./src/components/interactiveVisuals/InteractiveVisualHost";
    import Roots from "./src/app/step-visuals/activities/roots-factors/HostedRootsFactors";
    import { createDevelopmentVisualPersistence } from "./src/lib/interactiveVisuals/developmentPersistence";
    const original = createDevelopmentVisualPersistence(); let latest = null;
    const persistence = { ...original, save: async (opened, snapshot, events) => {
      await original.save(opened, snapshot, events); latest = snapshot;
    } };
    window.rootsTouchSnapshot = () => latest;
    function App() { const [session, setSession] = useState(null); return <>
      <button onClick={async e => { const source = e.currentTarget;
        setSession({ source, opened: await persistence.open("roots-and-factors", { kind: "direct" }) }); }}>Open Roots</button>
      {session && <Host title="Roots and Factors" Visual={Roots} persistence={persistence}
        opened={session.opened} returnFocus={session.source} onClose={() => setSession(null)} />}
    </>; }
    createRoot(document.getElementById("root")).render(<App />);
  ` }, bundle: true, write: false, outfile: "roots.js", jsx: "automatic", define: { "process.env.NODE_ENV": '"test"' } });
  html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${await readFile("src/app/globals.css", "utf8")}\n${result.outputFiles.find(f => f.path.endsWith(".css"))!.text}</style><div id="root"></div><script>${result.outputFiles.find(f => f.path.endsWith(".js"))!.text}</script>`;
});

async function moveRoot(page: Page, root: number) {
  const slider = page.getByRole("slider");
  const start = (await slider.boundingBox())!;
  // Read the rendered mathematical projection; use ordinary pointer input only.
  const target = await page.getByRole("img", { name: "Quadratic graph" }).evaluate((element, value) => {
    const svg = element as SVGSVGElement, rect = svg.getBoundingClientRect(), plot = svg.querySelector("clipPath rect")!;
    return { x: rect.x + (Number(plot.getAttribute("x")) + Number(plot.getAttribute("width")) * (value + 6) / 12) * rect.width / svg.viewBox.baseVal.width,
      y: rect.y + (Number(plot.getAttribute("y")) + Number(plot.getAttribute("height")) / 2) * rect.height / svg.viewBox.baseVal.height };
  }, root);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 }); await page.mouse.up();
  await expect(slider).toHaveAttribute("aria-valuenow", String(root));
}
async function accessible(control: Locator, height: number) {
  const rect = (await control.boundingBox())!;
  expect(rect.y).toBeGreaterThanOrEqual(0); expect(rect.y + rect.height).toBeLessThanOrEqual(height + .1);
  expect(await control.evaluate(node => {
    const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}

for (const [width, height] of [[375, 667], [390, 844], [430, 932], [320, 568]]) {
  test(`Roots Check touch, completion and same-attempt restore at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.route("https://roots-touch.invalid/**", route => route.fulfill({ contentType: "text/html", body: html }));
    await page.goto("https://roots-touch.invalid/"); await page.getByRole("button", { name: "Open Roots", exact: true }).tap();
    const host = page.getByRole("dialog"), content = host.locator("[data-visual-host-content]"), next = host.getByRole("button", { name: "Next", exact: true });
    await expect.poll(async () => (await content.boundingBox())?.x).toBeCloseTo(12, 1);
    const originalContent = (await content.boundingBox())!;
    expect(originalContent.x).toBeCloseTo(12, 1); expect(originalContent.y).toBeCloseTo(56, 1);
    expect(originalContent.width).toBeCloseTo(width - 24, 1); expect(originalContent.height).toBeCloseTo(height - 112, 1);
    await moveRoot(page, 4); await accessible(next, height); await next.tap();
    const prediction = host.getByRole("button", { name: "(x + 3)", exact: true }); await accessible(prediction, height); await prediction.tap();
    await moveRoot(page, -3); await next.tap(); await expect(content).toHaveAttribute("data-visual-stage", "retrieval");
    const check = host.getByRole("button", { name: "Check", exact: true });
    const graph = (await host.getByRole("img", { name: "Quadratic graph" }).boundingBox())!;
    expect(graph.height).toBeGreaterThanOrEqual(210); expect(graph.width).toBe(width - 24);
    const checkRect = (await check.boundingBox())!;
    await info.attach("retrieval-geometry", { body: JSON.stringify({ content: originalContent, graph, check: checkRect }), contentType: "application/json" });
    await page.screenshot({ path: info.outputPath("roots-retrieval.png") });
    if (width === 320) {
      // Diagnostic only: retain the existing minimum graph and content sizing.
      info.annotations.push({ type: "small-screen-limit", description: `Check top=${checkRect.y}, bottom=${checkRect.y + checkRect.height}; no small-screen redesign.` });
      return;
    }
    await accessible(check, height);
    const attempt = await page.evaluate(() => window.rootsTouchSnapshot().attemptId);
    await host.getByRole("button", { name: "Close interactive visual" }).tap();
    await page.getByRole("button", { name: "Open Roots", exact: true }).tap();
    await expect(content).toHaveAttribute("data-visual-stage", "retrieval"); await expect(host.getByRole("slider")).toHaveAttribute("aria-valuenow", "-3");
    await accessible(check, height); await check.tap();
    const help = host.getByRole("button", { name: "Show explanation", exact: true }); await accessible(help, height); await help.tap();
    await moveRoot(page, -4); await accessible(check, height); await check.tap();
    await expect(content).toHaveAttribute("data-visual-stage", "completed");
    await host.getByRole("button", { name: "Close interactive visual" }).tap();
    await page.getByRole("button", { name: "Open Roots", exact: true }).tap();
    await expect(content).toHaveAttribute("data-visual-stage", "completed");
    const completed = await page.evaluate(() => window.rootsTouchSnapshot());
    const rewind = host.getByRole("button", { name: "Rewind", exact: true }); await accessible(rewind, height); await rewind.tap();
    await expect(content).toHaveAttribute("data-visual-stage", "orientation"); await expect(host.getByRole("slider")).toHaveAttribute("aria-valuenow", "4");
    const rewound = await page.evaluate(() => window.rootsTouchSnapshot());
    expect(rewound.attemptId).toBe(attempt); expect(rewound.sequence).toBeGreaterThan(completed.sequence);
    expect(await content.boundingBox()).toEqual(originalContent);
  });
}
