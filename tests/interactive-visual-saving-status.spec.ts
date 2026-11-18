import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

declare global { interface Window { visualStatusTest: { publish: (status: string) => void; failNext: () => void; counts: () => { saves: number; flushes: number; attempts: number } } } }
let html: string;
test.use({ viewport: { width: 390, height: 844 }, contextOptions: { reducedMotion: "reduce" } });
test.beforeAll(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import { useCallback, useLayoutEffect, useState } from "react"; import { createRoot } from "react-dom/client";
    import Host from "./src/components/interactiveVisuals/InteractiveVisualHost";
    const listeners = new Set(); let status = "Saved", snapshot = null, attempt = 1, saves = 0, flushes = 0, fail = false;
    const publish = value => { status = value; listeners.forEach(listener => listener(value)); };
    const opened = () => ({ activityId: "status-test", attemptId: String(attempt), snapshot });
    const persistence = { statusLabel: "Changes pending", hasAttempt: async () => true, open: async () => opened(),
      subscribe: (id, listener) => { listeners.add(listener); listener(status); return () => listeners.delete(listener); },
      save: async (session, value) => { saves++; publish("Changes pending"); if (fail) { fail = false; publish("Saving failed. Device storage is unavailable."); throw Error("storage"); } snapshot = value; },
      flush: async () => { flushes++; }, startNewAttempt: async () => { attempt++; snapshot = null; publish("Changes pending"); return opened(); } };
    window.visualStatusTest = { publish, failNext: () => { fail = true; }, counts: () => ({ saves, flushes, attempts: attempt }) };
    function Visual({ initialSnapshot, onControls, onChange }) {
      const [stage, setStage] = useState(initialSnapshot?.stage ?? 1);
      const move = useCallback(value => { setStage(value); void onChange({ stage: value }, []).catch(() => {}); }, [onChange]);
      useLayoutEffect(() => onControls({ stageId: String(stage), atStart: stage === 1, completed: stage === 3,
        previous: stage > 1 ? { enabled: true, run: () => move(stage - 1) } : undefined,
        next: stage < 3 ? { enabled: true, run: () => move(stage + 1) } : undefined,
        backToStart: stage === 3 ? () => move(1) : undefined }), [stage, move, onControls]);
      return <p>Stage {stage}</p>;
    }
    function App() { const [session, setSession] = useState(null); return <><button onClick={e => setSession({ source: e.currentTarget, opened: opened() })}>Open</button>
      {session && <Host title="Status fixture" Visual={Visual} opened={session.opened} persistence={persistence} returnFocus={session.source} onClose={() => setSession(null)} />}</>; }
    createRoot(document.getElementById("root")).render(<App />);
  ` }, bundle: true, write: false, outfile: "status.js", jsx: "automatic", define: { "process.env.NODE_ENV": '"test"' } });
  html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${await readFile("src/app/globals.css", "utf8")}\n${result.outputFiles.find(f => f.path.endsWith(".css"))!.text}</style><div id="root"></div><script>${result.outputFiles.find(f => f.path.endsWith(".js"))!.text}</script>`;
});
async function open(page: Page) {
  await page.route("https://visual-status.invalid/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://visual-status.invalid/"); await page.getByRole("button", { name: "Open", exact: true }).click();
}
test("routine save states stay silent through navigation and attempt lifecycle", async ({ page }, info) => {
  await open(page); const host = page.getByRole("dialog"), footer = host.locator("[data-visual-host-footer]");
  const quiet = () => expect(footer.locator("p")).toHaveCount(0);
  await host.getByRole("button", { name: "Next", exact: true }).click();
  await expect(host).toHaveAttribute("data-visual-save-status", "Changes pending");
  await page.screenshot({ path: info.outputPath("navigation-pending.png") }); await quiet();
  for (const status of ["Saved", "Saving…", "Syncing", "Changes pending", "Previous attempt pending backup", "Previous attempt kept"]) {
    await page.evaluate(value => window.visualStatusTest.publish(value), status); await expect(host).toHaveAttribute("data-visual-save-status", status); await quiet();
  }
  await host.getByRole("button", { name: "Back", exact: true }).click(); await quiet();
  await host.getByRole("button", { name: "Next", exact: true }).click(); await host.getByRole("button", { name: "Next", exact: true }).click();
  await host.getByRole("button", { name: "Rewind", exact: true }).click(); await quiet();
  expect((await page.evaluate(() => window.visualStatusTest.counts())).attempts).toBe(1);
  page.once("dialog", dialog => dialog.accept()); await host.getByRole("button", { name: "New", exact: true }).click(); await quiet();
  expect((await page.evaluate(() => window.visualStatusTest.counts())).attempts).toBe(2);
  await host.getByRole("button", { name: "Next", exact: true }).click(); await quiet();
  await host.getByRole("button", { name: "Close interactive visual" }).click();
  expect((await page.evaluate(() => window.visualStatusTest.counts())).flushes).toBe(1);
  await page.getByRole("button", { name: "Open", exact: true }).click(); await quiet();
  await expect(host.getByText("Stage 2", { exact: true })).toBeVisible();
  expect((await page.evaluate(() => window.visualStatusTest.counts())).saves).toBeGreaterThanOrEqual(5);
});
test("actual write failure and existing conflict or reconnect warnings remain visible", async ({ page }) => {
  await open(page); const host = page.getByRole("dialog"), footer = host.locator("[data-visual-host-footer]");
  await page.evaluate(() => window.visualStatusTest.failNext()); await host.getByRole("button", { name: "Next", exact: true }).click();
  await expect(footer.getByRole("alert")).toHaveText("Saving failed. Device storage is unavailable.");
  for (const status of ["Saving conflict. Your pending work is kept on this device.", "Changes pending. Waiting to reconnect.", "Saving stopped. Your pending work is kept on this device.", "Saving failed. Changes are not safely stored on this device."]) {
    await page.evaluate(value => window.visualStatusTest.publish(value), status); await expect(footer.getByRole("alert")).toHaveText(status);
  }
  const changed = "Another tab changed this attempt. Reload before editing.";
  await page.evaluate(value => window.visualStatusTest.publish(value), changed); await expect(footer.locator("p")).toHaveText(changed);
});
