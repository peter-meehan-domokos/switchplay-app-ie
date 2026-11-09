import { expect, test, type BrowserContext, type Locator, type Page, type Request } from "@playwright/test";
const group = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null");
test.skip(!group || !process.env.PHASE7_MEDIA_REVIEW, "Requires disposable --group-media --complete-loading fixtures");
type Role = "Personal" | "Admin Group" | "Follower Me" | "Inspected player" | "Follower Group";
type Point = readonly [number, number];
const back = (page: Page) => page.locator(".focused-card-surface--back");
const track = (page: Page) => back(page).locator(".focused-card-signal-track").nth(1);
const title = (page: Page) => back(page).locator(".card-title-anchor");
function signalRequest(request: Request) {
  if (request.method() !== "PATCH") return false;
  const body = request.postDataJSON();
  return body?.type === "signal" || body?.change?.kind === "signal";
}
const vertical = (dy: number): Point[] => Array.from({ length: 12 }, (_, i) => [0, dy * (i + 1) / 12]);
async function drag(engine: string, context: BrowserContext, page: Page, target: Locator, points: Point[],
  options: { finish?: "cancel" | "lost"; afterMove?(index: number): Promise<void> } = {}) {
  // WebKit has no native touch-drag API. Its mouse fallback can select text
  // after vertical handoff; dragging that selection consumes the next down
  // in native HTML drag-and-drop. Independent touch sequences have no such
  // mouse selection. Clear it without altering application CSS or handlers.
  if (engine === "webkit") await page.evaluate(() => document.getSelection()?.removeAllRanges());
  const rect = (await target.boundingBox())!, x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  await page.evaluate(() => { (window as unknown as { signalPointer: number }).signalPointer = -1;
    document.addEventListener("pointerdown", event => { (window as unknown as { signalPointer: number }).signalPointer = event.pointerId; }, { once: true, capture: true }); });
  const cdp = engine === "chromium" ? await context.newCDPSession(page) : undefined;
  try {
    if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    else { await page.mouse.move(x, y); await page.mouse.down(); }
    for (const [index, [dx, dy]] of points.entries()) {
      if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx, y: y + dy }] });
      else await page.mouse.move(x + dx, y + dy);
      await page.waitForTimeout(20);
      await options.afterMove?.(index);
    }
    if (options.finish === "lost") await target.evaluate(element => {
      const owner = element.closest(".focused-card-signal-slot")!, id = (window as unknown as { signalPointer: number }).signalPointer;
      if (!owner.hasPointerCapture(id)) throw Error("The real gesture must own pointer capture before testing its loss");
      owner.releasePointerCapture(id);
    });
    if (options.finish === "cancel" && !cdp) await target.dispatchEvent("pointercancel", { pointerId: await page.evaluate(() => (window as unknown as { signalPointer: number }).signalPointer) });
    if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: options.finish === "cancel" ? "touchCancel" : "touchEnd", touchPoints: [] });
    else await page.mouse.up();
  } finally { await cdp?.detach(); }
}
const position = (page: Page) => track(page).evaluate(node => (node as HTMLElement).style.getPropertyValue("--signal-value-position"));

for (const engine of ["chromium", "webkit"] as const) for (const role of ["Personal", "Admin Group", "Follower Me", "Inspected player", "Follower Group"] as Role[]) {
  test(`${engine}: ${role} arbitrates signal previews, vertical navigation and genuine edits`, async ({ playwright }) => {
    const browser = await playwright[engine].launch();
    const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    context.setDefaultTimeout(15_000);
    const page = await context.newPage(), readonly = role === "Inspected player" || role === "Follower Group", personal = role === "Personal";
    const writes: Request[] = [], responses: number[] = [];
    try {
      const identifier = role === "Admin Group" || role === "Inspected player" ? "phase2" : "Aoife Kelly";
      expect((await context.request.post("/api/auth/login", { data: { identifier, password: "local-test-only" } })).ok()).toBeTruthy();
      if (process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
      const metadata = await (await context.request.get(`/api/group-experiences/${group.experienceId}`)).json();
      const learningUrl = `/api/group-experiences/${group.experienceId}/cards/${group.cardIds[1]}/${role === "Admin Group" ? "group" : "personal"}-learning`;
      if (!readonly) expect((await context.request.patch(personal ? `/api/decks-data/${group.deckId}` : learningUrl, { data: personal
        ? { type: "signal", cardTemplateId: group.cardIds[1], stepId: "group-1-b", reading: 5 }
        : { version: 1, accessEpoch: metadata.accessEpoch, change: { kind: "signal", stepId: "group-1-b", reading: 5 } } })).ok()).toBeTruthy();
      const selection = role === "Follower Me" ? "self" : role === "Inspected player" ? "follower" : "group";
      const readStored = async () => {
        const response = await context.request.get(personal ? `/api/decks-data/${group.deckId}` : `/api/group-experiences/${group.experienceId}/cards/${group.cardIds[1]}?perspective=${selection}${selection === "follower" ? `&subjectUserId=${group.otherId}` : ""}`);
        expect(response.ok()).toBeTruthy(); const value = await response.json();
        return personal ? value.cards.find((card: { id: string }) => card.id === group.cardIds[1]).signals.find((signal: { id: string }) => signal.id === "group-1-b").reading
          : value.learning.signalReadings.find((signal: { stepId: string }) => signal.stepId === "group-1-b").reading;
      };
      async function open(index: number) {
        const query = new URLSearchParams({ [personal ? "openDeck" : "openExperience"]: personal ? group.deckId : group.experienceId, openCard: group.cardIds[index],
          ...(personal ? {} : { progressScene: "1", progressFocused: "1", progressFace: "back", progressPerspective: selection, ...(selection === "follower" ? { progressSubject: group.otherId } : {}) }) });
        await page.goto(`/decks?${query}`, { waitUntil: "domcontentloaded" });
        if (personal) {
          await page.locator(".deck-card.is-active").press("Enter"); await page.waitForTimeout(700);
          await drag(engine, context, page, page.locator(".focused-card-surface--front .card-title-anchor"), [[20, 0], [60, 0], [110, 0], [150, 0]]);
        }
        await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
        await expect(title(page)).toContainText(`Card ${index + 1}`); await page.waitForTimeout(700);
      }
      async function settledCard(label: string) {
        // Both physical Cards coexist during the established traversal animation.
        await expect(title(page)).toHaveCount(1);
        await expect(title(page)).toContainText(label);
        await expect(page.locator(".focused-card-object")).toHaveCount(1);
        // Personal focus retains its own face; a newly traversed Card may use
        // the Deck front. Preserve that existing convention rather than retune it.
        if (personal && !(await page.locator(".focused-card-object").getAttribute("class"))!.includes("is-flipped")) {
          await page.waitForTimeout(700);
          await drag(engine, context, page, page.locator(".focused-card-surface--front .card-title-anchor"), Array.from({ length: 12 }, (_, i) => [150 * (i + 1) / 12, 0]));
          await page.waitForTimeout(700);
        }
        await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
      }
      await open(1);
      await page.evaluate(() => {
        const events: unknown[] = [];
        (window as unknown as { signalEvents: unknown[] }).signalEvents = events;
        for (const kind of ["pointerdown", "pointermove", "pointerup", "pointercancel", "gotpointercapture", "lostpointercapture", "dragstart", "selectionchange"]) {
          document.addEventListener(kind, event => {
            const pointer = event as PointerEvent, element = event.target as Element;
            events.push({ kind, x: pointer.clientX, y: pointer.clientY, id: pointer.pointerId,
              target: element?.tagName, className: element?.getAttribute?.("class"),
              selection: document.getSelection()?.toString(), time: performance.now() });
          }, true);
        }
      });
      page.on("request", request => { if (signalRequest(request)) writes.push(request); });
      page.on("response", response => { if (signalRequest(response.request())) responses.push(response.status()); });
      const initial = await readStored();
      // All these starts must navigate with no confidence write or even a brief permission warning.
      await page.evaluate(() => { (window as unknown as { permissionHints: string[] }).permissionHints = [];
        new MutationObserver(() => { const text = document.querySelector('[role="tooltip"]')?.textContent; if (text) (window as unknown as { permissionHints: string[] }).permissionHints.push(text); }).observe(document.body, { childList: true, subtree: true }); });
      for (const [points, destination, reverse] of [
        [vertical(180), 3, -180], [vertical(-180), 1, 180],
        [[[12, 0], [12, 15], [12, 35], [12, 80], [12, 180]], 3, -180],
        [[[-12, 0], [-12, -15], [-12, -35], [-12, -80], [-12, -180]], 1, 180],
        [[[8, 7], [14, 20], [16, 60], [20, 180]], 3, -180],
      ] as [Point[], number, number][]) {
        await drag(engine, context, page, track(page), points);
        await settledCard(`Card ${destination}`);
        await page.waitForTimeout(700);
        await drag(engine, context, page, track(page), vertical(reverse));
        await settledCard("Card 2"); await page.waitForTimeout(700);
      }
      expect(writes).toHaveLength(0); expect(await readStored()).toBe(initial);
      expect(await page.evaluate(() => (window as unknown as { permissionHints: string[] }).permissionHints)).toEqual([]);
      // A preview that ends ambiguous, or below the unchanged dead zone, cannot persist.
      const baseline = await position(page);
      for (const points of [[[12, 0], [20, 10], [50, 50]], [[6, 0]]] as Point[][]) {
        await drag(engine, context, page, track(page), points);
        await expect(title(page)).toContainText("Card 2"); expect(writes).toHaveLength(0); expect(await position(page)).toBe(baseline);
        await expect(page.getByRole("tooltip")).toHaveCount(0);
      }
      // Check per-move preview before release, even below the axis decision threshold.
      let previewMs: number | undefined;
      const count = writes.length;
      await drag(engine, context, page, track(page), [[6, 0], [12, 0]], { afterMove: async index => {
        if (index) return;
        const start = Date.now();
        if (readonly) { expect(await position(page)).toBe(baseline); await expect(page.getByRole("tooltip")).toHaveCount(0); }
        else { await expect.poll(() => position(page)).not.toBe(baseline); previewMs = Date.now() - start; }
        expect(writes).toHaveLength(count);
      } });
      if (readonly) {
        await expect(page.getByRole("tooltip")).toHaveText(role === "Inspected player" ? "Only this member can change this value." : "Only a Group Admin can change this value.");
        expect(writes).toHaveLength(0); expect(await position(page)).toBe(baseline); await page.keyboard.press("Escape");
      } else {
        await expect.poll(() => responses.length).toBe(1); expect(responses).toEqual([200]);
        expect(await readStored()).not.toBe(initial); await page.waitForTimeout(150);
      }
      // Ordinary longer horizontal dragging still uses the full-width signal and saves once.
      await drag(engine, context, page, track(page), [[6, 0], [12, 0], [30, 0], [60, 0], [100, 0]]);
      await expect(title(page)).toContainText("Card 2");
      if (readonly) { await expect(page.getByRole("tooltip")).toBeVisible(); expect(writes).toHaveLength(0); await page.keyboard.press("Escape"); }
      else { await expect.poll(() => responses.length).toBe(2); expect(responses.at(-1)).toBe(200); }
      // A firm horizontal adjustment stays horizontal even after a large late vertical excursion.
      await drag(engine, context, page, track(page), [[30, 0], [30, 60], [30, 180]]);
      await expect(title(page)).toContainText("Card 2");
      if (readonly) { await expect(page.getByRole("tooltip")).toBeVisible(); expect(writes).toHaveLength(0); await page.keyboard.press("Escape"); }
      else { await expect.poll(() => responses.length).toBe(3); expect(responses.at(-1)).toBe(200); }
      // Lost capture and cancellation must discard previews and permit the next real gesture.
      for (const finish of ["cancel", "lost"] as const) {
        const before = writes.length, atRest = await position(page);
        await drag(engine, context, page, track(page), [[30, 0]], { finish });
        await page.waitForTimeout(100); expect(writes).toHaveLength(before); expect(await position(page)).toBe(atRest);
        await expect(page.getByRole("tooltip")).toHaveCount(0);
      }
      expect(await page.evaluate(() => (window as unknown as { signalEvents: { kind: string }[] }).signalEvents.some(event => event.kind === "dragstart")),
        "Native mouse drag-and-drop must not consume simulated touch sequences").toBe(false);
      // Existing traversal locks and boundaries still apply; neither may turn a swipe into an edit.
      for (const [index, dy] of [[0, -180], [5, 180]]) {
        await open(index); const before = writes.length, object = await page.locator(".focused-card-object").elementHandle();
        await drag(engine, context, page, track(page), vertical(dy)); await drag(engine, context, page, track(page), vertical(dy));
        await expect(title(page)).toContainText(`Card ${index + 1}`); expect(writes).toHaveLength(before); expect(await object!.evaluate(node => node.isConnected)).toBe(true);
      }
      console.log("SIGNAL_ARBITRATION", JSON.stringify({ engine, role, previewObservedBeforeReleaseMs: previewMs, signalSaves: writes.length, nativeTouch: engine === "chromium" }));
    } catch (error) {
      await test.info().attach("signal-pointer-events", {
        body: JSON.stringify(await page.evaluate(() => (window as unknown as { signalEvents?: unknown[] }).signalEvents).catch(() => [])), contentType: "application/json",
      });
      throw error;
    } finally {
      await context.close(); await browser.close();
    }
  });
}
