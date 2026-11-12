import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

declare global { interface Window { recoveryProbe: {
  respond: (status: number) => void; failStorage: () => Promise<void>;
  state: () => { bodies: string[]; pending: boolean; events: number; flight: boolean };
} } }
let html: string;
test.use({ viewport: { width: 390, height: 844 }, contextOptions: { reducedMotion: "reduce" } });
test.beforeAll(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import { useState } from "react"; import { createRoot } from "react-dom/client";
    import Host from "./src/components/interactiveVisuals/InteractiveVisualHost";
    import { createAccountVisualPersistence } from "./src/lib/visualLearningRecords/client";
    import { initialVisualOutbox, enqueueVisualChange, hasPendingVisualWork } from "./src/lib/visualLearningRecords/outbox";
    import { createRootsHostedState, rootsSnapshot } from "./src/app/step-visuals/activities/roots-factors/hostState";
    const attemptId = crypto.randomUUID(), learner = "account:recovery-test";
    const session = { learner, recordId: crypto.randomUUID(), activityId: "roots-and-factors", attemptId, activeAttemptId: attemptId,
      attemptNumber: 1, stateRevision: 0, activityVersion: 1, snapshotSchema: 1, snapshot: null, visitId: crypto.randomUUID() };
    const roots = createRootsHostedState(attemptId);
    let row = enqueueVisualChange(initialVisualOutbox(session, crypto.randomUUID()), rootsSnapshot(roots), roots.recorded.records.events, () => crypto.randomUUID(), new Date().toISOString());
    const restoration = { status: "new-attempt-required", reason: "version", storedActivityVersion: 99, storedSnapshotSchema: 1 };
    row = { ...row, session: { ...row.session, restoration } };
    let quota = false, response, status = 0; const bodies = [];
    const store = { list: async () => [structuredClone(row)], read: async () => structuredClone(row),
      update: async (key, change) => { if (quota) throw Error("Injected storage quota"); row = change(structuredClone(row)); return structuredClone(row); } };
    const service = createAccountVisualPersistence({ learner, store, fetch: async (path, init) => {
      if (!path.endsWith("/recovery-batches")) throw Error("Unexpected request");
      bodies.push(init.body); const batch = JSON.parse(init.body);
      const code = status || await new Promise(resolve => { response = resolve; });
      return code === 200 ? Response.json({ writeId: batch.writeId, acceptedEventIds: batch.events.map(e => e.eventId), checkpointAccepted: true, validation: "known-codec" },
        { headers: { "X-Visual-Learner": learner } }) : Response.json({ code: code === 403 ? "VISUAL_RECORD_FORBIDDEN" : "VISUAL_REQUEST_FAILED" }, { status: code });
    } });
    const opened = { activityId: session.activityId, attemptId, attemptNumber: 1, snapshot: null, restoration };
    window.recoveryProbe = {
      respond: code => { status = code; response?.(code); },
      failStorage: async () => { quota = true; await service.save(opened, row.snapshot, []).catch(() => {}); },
      state: () => ({ bodies: [...bodies], pending: hasPendingVisualWork(row), events: row.events.length, flight: !!row.flight })
    };
    function App() { const [source, setSource] = useState(null); return <><button onClick={e => setSource(e.currentTarget)}>Open recovery</button>
      {source && <Host title="Recovery status test" Visual={() => null} opened={opened} persistence={service} returnFocus={source} onClose={() => setSource(null)} />}</>; }
    createRoot(document.getElementById("root")).render(<App />);
  ` }, bundle: true, write: false, outfile: "recovery.js", jsx: "automatic", define: { "process.env.NODE_ENV": '"test"' } });
  html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${await readFile("src/app/globals.css", "utf8")}\n${result.outputFiles.find(f => f.path.endsWith(".css"))!.text}</style><div id="root"></div><script>${result.outputFiles.find(f => f.path.endsWith(".js"))!.text}</script>`;
});
async function open(page: Page) {
  await page.route("https://recovery-status.invalid/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://recovery-status.invalid/"); await page.getByRole("button", { name: "Open recovery", exact: true }).click();
  const host = page.getByRole("dialog");
  await expect(host).toHaveAttribute("data-visual-save-status", "Previous attempt pending backup");
  await expect.poll(() => page.evaluate(() => window.recoveryProbe.state().flight)).toBe(true);
  await expect(host.locator("[data-visual-host-footer] p")).toHaveCount(0);
  return host;
}
test("normal pending and successful recovery stay silent through the real client", async ({ page }) => {
  const host = await open(page);
  expect((await page.evaluate(() => window.recoveryProbe.state())).pending).toBe(true);
  await page.evaluate(() => window.recoveryProbe.respond(200));
  await expect(host).toHaveAttribute("data-visual-save-status", "Previous attempt kept");
  await expect(host.locator("[data-visual-host-footer] p")).toHaveCount(0);
  expect((await page.evaluate(() => window.recoveryProbe.state())).pending).toBe(false);
});
for (const code of [503, 403]) test(`recovery ${code} reaches the host without changing retry or request identity`, async ({ page }) => {
  const host = await open(page), footer = host.locator("[data-visual-host-footer]");
  await page.evaluate(code => window.recoveryProbe.respond(code), code);
  const error = code === 503 ? "Changes pending. Waiting to reconnect." : "Saving stopped. Your pending work is kept on this device.";
  await expect(footer.getByRole("alert")).toHaveText(error);
  const pending = await page.evaluate(() => window.recoveryProbe.state()); expect(pending.pending).toBe(true); expect(pending.flight).toBe(true);
  if (code === 503) {
    await page.evaluate(() => window.recoveryProbe.respond(200));
    await expect(host).toHaveAttribute("data-visual-save-status", "Previous attempt kept");
    await expect(footer.locator("p")).toHaveCount(0);
    const saved = await page.evaluate(() => window.recoveryProbe.state());
    expect(saved.bodies).toEqual([pending.bodies[0], pending.bodies[0]]); expect(saved.pending).toBe(false); expect(saved.events).toBe(0);
  } else {
    await page.waitForTimeout(1400); expect(await page.evaluate(() => window.recoveryProbe.state())).toEqual(pending);
    await expect(footer.getByRole("alert")).toHaveText(error);
  }
});
test("local storage failure retains priority while recovery work is pending", async ({ page }) => {
  const host = await open(page);
  await page.evaluate(() => window.recoveryProbe.failStorage());
  await expect(host.locator("[data-visual-host-footer]").getByRole("alert")).toHaveText("Saving failed. Changes are not safely stored on this device.");
  expect((await page.evaluate(() => window.recoveryProbe.state())).pending).toBe(true);
});
