import { test, expect, type Page } from "@playwright/test";
const review = JSON.parse(process.env.PHASE10_REVIEW!), group = review.groupReview, fixture = review.reflectionReview;
async function login(page: Page, identifier = "Aoife Kelly") {
  expect((await page.request.post("/api/auth/login", { data: { identifier, password: "local-test-only" } })).ok()).toBeTruthy();
}
async function exactGroup(page: Page, cardId = fixture.cardId, perspective = "self", subject?: string) {
  const q = new URLSearchParams({ openExperience: group.experienceId, progressScene: "1", progressFace: "back", progressFocused: "1", progressPerspective: perspective, openCard: cardId });
  if (subject) q.set("progressSubject", subject);
  await page.goto(`/decks?${q}`); await expect(page.locator(".focused-card-layer")).toBeVisible();
}
async function personal(page: Page, cardId = fixture.cardId) {
  await page.goto(`/decks?${new URLSearchParams({ openDeck: group.deckId, openCard: cardId })}`);
  await page.locator(".deck-card.is-active").press("Enter"); await expect(page.locator(".focused-card-layer")).toBeVisible();
  const box = (await page.locator(".focused-card-surface--front .card-title-anchor").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
  await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
}
const note = (p: Page) => p.locator(".focused-card-surface--back .reflection-area p");
const member = (p: Page) => p.locator(".focused-card-surface--back .reflection-member-area p");
const groupQuery = (cardId = fixture.cardId) => `/api/reflections?${new URLSearchParams({ cardTemplateId: cardId, experienceId: group.experienceId, mode: "group", accessEpoch: "0" })}`;
async function saveShared(page: Page, text: string, cardId = fixture.cardId) {
  const feed = await (await page.request.get(groupQuery(cardId))).json();
  const response = await page.request.post("/api/reflections", { data: { action: "save", source: feed.collective.source, text, expectedRevision: feed.collective.revision, operationId: crypto.randomUUID(), accessEpoch: 0 } });
  expect(response.ok()).toBeTruthy(); return response.json();
}
async function noHistoryControls(page: Page) {
  const back = page.locator(".focused-card-surface--back");
  for (const selector of [".reflection-next", ".reflection-context", ".reflection-next-icon"]) await expect(back.locator(selector)).toHaveCount(0);
  await expect(back.locator(".reflection-area svg")).toHaveCount(0);
}

test("ordinary Personal Card shows only Personal, opens the original editor and preserves full stored history", async ({ page }) => {
  await login(page); await personal(page);
  await expect(note(page)).toHaveText("I enjoyed this card and improved my footwork today."); await noHistoryControls(page);
  await expect(member(page)).toHaveCount(0);
  await note(page).click(); const editor = page.getByRole("dialog", { name: "Edit reflection" }); await expect(editor).toBeVisible();
  await expect(editor.getByRole("textbox")).toHaveValue("I enjoyed this card and improved my footwork today."); await editor.getByRole("button", { name: "Close", exact: true }).click();
  const history = await (await page.request.get(`/api/reflections?cardTemplateId=${fixture.cardId}`)).json();
  expect(history.items.some((i: {entry:{text:string}}) => i.entry.text.includes("Galway development"))).toBe(true);
  expect(history.items.some((i: {entry:{text:string}}) => i.entry.text.includes("Galway U18"))).toBe(true);
});

test("own and inspected individual Cards select only the current Group with the normal empty Add slot", async ({ page }) => {
  await login(page); await exactGroup(page);
  await expect(note(page)).toHaveText("I contributed well to our Galway U18 group today."); await noHistoryControls(page);
  await page.waitForTimeout(5300); await expect(note(page)).toHaveText("I contributed well to our Galway U18 group today.");
  await note(page).click(); await expect(page.getByRole("dialog", { name: "Edit reflection" })).toBeVisible(); await page.keyboard.press("Escape");
  await exactGroup(page, fixture.emptyCardId); await expect(note(page)).toHaveText("Add a reflection..."); await noHistoryControls(page);
  await login(page, "phase2"); await exactGroup(page, fixture.cardId, "follower", group.otherId);
  await expect(note(page)).toContainText("I contributed well"); await note(page).click();
  const read = page.getByRole("dialog", { name: "View reflection" }); await expect(read).toBeVisible(); await expect(read.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  await expect(read.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0); await expect(read.getByRole("button", { name: "Remove from Group" })).toHaveCount(0);
});

test("Group Card separates its shared note from a manual attributed member carousel for Admins and followers", async ({ page }) => {
  await login(page, "phase2"); await saveShared(page, "Our group improved.");
  try {
    await exactGroup(page, fixture.cardId, "group"); await expect(note(page)).toHaveText("Our group improved."); await noHistoryControls(page);
    const first = await member(page).textContent(); expect(first).toMatch(/^[^:]+: /);
    await page.waitForTimeout(5400); await expect(member(page)).toHaveText(first!);
    await note(page).click(); const editor = page.getByRole("dialog", { name: "Edit reflection" }); await expect(editor.getByRole("textbox")).toHaveValue("Our group improved."); await page.keyboard.press("Escape");
    await member(page).click(); await expect(member(page)).not.toHaveText(first!); await expect(page.getByRole("dialog")).toHaveCount(0);
    const feed = await (await page.request.get(groupQuery())).json(); const sources = new Set(feed.items.filter((i: {empty:boolean;entry:{groupVisible:boolean}}) => !i.empty && i.entry.groupVisible).map((i: {entry:{authorUserId:string}}) => i.entry.authorUserId));
    for (let i = 1; i < sources.size; i++) await member(page).click();
    await expect(member(page)).toHaveText(first!);
    await login(page); await exactGroup(page, fixture.cardId, "group"); await expect(note(page)).toHaveText("Our group improved.");
    await note(page).click(); const read = page.getByRole("dialog", { name: "View reflection" }); await expect(read).toBeVisible(); await expect(read.getByRole("button", { name: "Save", exact: true })).toHaveCount(0); await page.keyboard.press("Escape");
    const previous = await member(page).textContent(); await member(page).click(); await expect(member(page)).not.toHaveText(previous!);
  } finally { await login(page, "phase2"); await saveShared(page, ""); }
});

test("Group notes keep fixed widths and gap, left-aligned member text and an adjustable twelve-pixel stagger", async ({ page }, info) => {
  await login(page, "phase2"); await saveShared(page, "Good teamwork.");
  try {
    await exactGroup(page, fixture.cardId, "group"); await expect(note(page)).toHaveText("Good teamwork."); await expect(member(page)).toBeVisible();
    // Layout-only stress text: no fixture record or author identity is changed.
    await member(page).evaluate(n => { const name = document.createElement("span"); name.className = "focused-card-back-reflection-prefix"; name.textContent = "Aoife Kelly: "; n.replaceChildren(name, document.createTextNode("My passing felt much better today after slowing down and finding space beside my teammates during our defensive basketball drills.")); });
    const rects = await page.locator(".focused-card-surface--back").evaluate(back => {
      const right = back.querySelector<HTMLElement>(".reflection-area p")!, left = back.querySelector<HTMLElement>(".reflection-member-area p")!;
      const data = (n: HTMLElement) => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); const range = document.createRange(); range.selectNodeContents(n);
        const visibleLines = [...range.getClientRects()].filter(l => l.bottom <= r.bottom + .5 && l.top >= r.top - .5);
        return { alignment: s.textAlign, areaBottom: n.parentElement!.getBoundingClientRect().bottom, width: parseFloat(s.width), left: r.left, right: r.right, bottom: r.bottom, lastLine: Math.max(...visibleLines.map(l => l.bottom)), lineHeight: parseFloat(s.lineHeight), height: n.offsetHeight, lines: s.webkitLineClamp, size: s.fontSize, cardWidth: back.getBoundingClientRect().width }; };
      return { right: data(right), left: data(left) };
    });
    expect(rects.right.width).toBe(102); expect(rects.left.width).toBe(130);
    const scale = (await note(page).boundingBox())!.width / 102;
    expect(rects.right.left - rects.left.right).toBeCloseTo(20 * scale, 1);
    expect(rects.left.alignment).toBe("left"); expect(rects.right.alignment).toBe("right");
    expect(rects.right.areaBottom - rects.left.areaBottom).toBeCloseTo(12 * scale, 1);
    await expect(page.locator(".reflection-member-remove")).toHaveCount(0);
    const initialText = (await member(page).boundingBox())!;
    for (const offset of [8, 16]) {
      await page.locator(".reflection-member-area").evaluate((n, value) => (n as HTMLElement).style.setProperty("--reflection-member-offset", `${value}px`), offset);
      expect((await member(page).boundingBox())!.y - initialText.y).toBeCloseTo((12 - offset) * scale, 1);
      expect((await note(page).boundingBox())!.y).toBeCloseTo(rects.right.bottom - (await note(page).boundingBox())!.height, 1);
    }
    await page.locator(".reflection-member-area").evaluate(n => (n as HTMLElement).style.removeProperty("--reflection-member-offset"));
    expect(rects.right.height).toBeLessThanOrEqual(rects.right.lineHeight + 1); expect(rects.left.lines).toBe("3"); expect(rects.left.height).toBeLessThanOrEqual(rects.left.lineHeight * 3 + 1); expect(rects.left.size).toBe(rects.right.size);
    await expect(member(page)).toContainText(/^Aoife Kelly:/); await noHistoryControls(page);
    await page.screenshot({ path: `/private/tmp/phase10-staggered-notes-${info.project.name}.png` });
    await member(page).evaluate(n => {
      const name = document.createElement("span"); name.className = "focused-card-back-reflection-prefix"; name.textContent = "Alice: ";
      n.replaceChildren(name, document.createTextNode("Good passing."));
    });
    const short = await member(page).evaluate(n => ({ height: (n as HTMLElement).offsetHeight, bottom: n.parentElement!.getBoundingClientRect().bottom }));
    expect(short.height).toBeLessThanOrEqual(rects.left.lineHeight + 1); expect(short.bottom).toBeCloseTo(rects.left.areaBottom, 1);
    expect((await note(page).boundingBox())!.y).toBeCloseTo(rects.right.bottom - (await note(page).boundingBox())!.height, 1);
    await page.screenshot({ path: `/private/tmp/phase10-staggered-short-notes-${info.project.name}.png` });
  } finally { await saveShared(page, ""); }
});

test("empty collective note and no visible member contributions add no extra controls or placeholders", async ({ page }) => {
  await login(page, "phase2"); await saveShared(page, "", fixture.longCardId);
  // Mock an empty authorised feed to verify presentation without hiding or deleting real fixture contributions.
  await page.route("**/api/reflections?**", async route => { try { const response = await route.fetch(); const data = await response.json(); if (data.view?.mode === "group") data.items = []; await route.fulfill({ response, json: data }); } catch { await route.abort().catch(() => {}); } });
  await exactGroup(page, fixture.longCardId, "group"); await expect(note(page)).toHaveText("Add a reflection..."); await expect(member(page)).toHaveCount(0);
  await note(page).click(); await expect(page.getByRole("dialog", { name: "Edit reflection" })).toBeVisible(); await page.keyboard.press("Escape");
  await login(page); await exactGroup(page, fixture.longCardId, "group"); await expect(member(page)).toHaveCount(0); await expect(note(page)).toHaveCount(0);
});

test("touch opens the collective editor and advances members without flipping the Card", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: review.baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  try {
    await login(page, "phase2"); await exactGroup(page, fixture.cardId, "group");
    await expect(note(page)).toHaveText("Add a reflection...");
    await note(page).tap(); await expect(page.getByRole("dialog", { name: "Edit reflection" })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).tap();
    const first = await member(page).textContent();
    await expect(page.locator(".reflection-member-remove")).toHaveCount(0);
    await member(page).tap();
    await expect(member(page)).not.toHaveText(first!); await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
  } finally { await context.close(); }
});

test("Group reflection moderation controls are absent for Admins and followers", async ({ page }) => {
  for (const account of ["phase2", "Aoife Kelly"]) {
    await login(page, account); await exactGroup(page, fixture.cardId, "group");
    await expect(member(page)).toBeVisible();
    await expect(page.locator(".reflection-member-area button")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
    const first = await member(page).textContent(); await member(page).click();
    await expect(member(page)).not.toHaveText(first!); await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("collective API denies follower writes, stale revisions, foreign IDs and cross-origin requests", async ({ page }) => {
  await login(page, "phase2"); const feed = await (await page.request.get(groupQuery())).json();
  const body = { action: "save", source: feed.collective.source, text: "Must not be written", operationId: crypto.randomUUID(), accessEpoch: 0, expectedRevision: feed.collective.revision + 99 };
  expect((await page.request.post("/api/reflections", { data: body })).status()).toBe(409);
  expect((await page.request.post("/api/reflections", { data: { ...body, source: { ...body.source, cardTemplateId: "forged" } } })).status()).toBe(403);
  expect((await page.request.post("/api/reflections", { headers: { Origin: "https://unrelated.invalid" }, data: body })).status()).toBe(403);
  await login(page); expect((await page.request.post("/api/reflections", { data: { ...body, expectedRevision: feed.collective.revision } })).status()).toBe(403);
});

test("ordinary Personal Add Save Delete still works without displaying cross-context history", async ({ page }) => {
  // Plain HTTP iPhone review has getRandomValues but not randomUUID.
  await page.addInitScript(() => { Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: undefined }); });
  await login(page); const value = "I practised my balance before our basketball training today.";
  const before = await (await page.request.get(`/api/reflections?cardTemplateId=${fixture.emptyCardId}`)).json();
  const existing = before.items.find((i: {entry:{text:string}}) => i.entry.text === value)?.entry;
  if (existing) await page.request.post("/api/reflections", { data: { action: "delete", source: existing.source, expectedRevision: existing.revision, operationId: crypto.randomUUID() } });
  await personal(page, fixture.emptyCardId); await expect(note(page)).toHaveText("Add a reflection..."); await noHistoryControls(page);
  await note(page).click(); const editor = page.getByRole("dialog", { name: "Edit reflection" }); await editor.getByRole("textbox").fill(value); await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(note(page)).toHaveText(value); await note(page).click(); await editor.getByRole("button", { name: "Delete", exact: true }).click(); await expect(note(page)).toHaveText("Add a reflection...");
  const after = await (await page.request.get(`/api/reflections?cardTemplateId=${fixture.emptyCardId}`)).json(); expect(after.items.some((i: {entry:{text:string}}) => i.entry.text.includes("Galway development"))).toBe(true);
});

for (const account of ["phase2", "Aoife Kelly"]) test(`${account} saves and edits Group reflections without secure-context randomUUID`, async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: undefined }); });
  await login(page, account);
  const mode = account === "phase2" ? "group" : "own";
  const query = groupQuery().replace("mode=group", `mode=${mode}`);
  const initial = await (await page.request.get(query)).json();
  const target = (feed: typeof initial) => mode === "group" ? feed.collective : feed.items.find((i: { entry: { authorUserId: string; source: { kind: string; experienceId?: string } } }) =>
    i.entry.authorUserId === feed.viewerUserId && i.entry.source.kind === "group" && i.entry.source.experienceId === group.experienceId)?.entry;
  const original = target(initial); expect(original).toBeTruthy();
  try {
    await exactGroup(page, fixture.cardId, mode === "group" ? "group" : "self");
    expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined");
    for (const value of ["Our passing improved during basketball practice today.", "We communicated more clearly during our passing drills today."]) {
      await note(page).click(); const editor = page.getByRole("dialog", { name: "Edit reflection" });
      await editor.getByRole("textbox").fill(value);
      const saved = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/reflections", { timeout: 12000 });
      await editor.getByRole("button", { name: "Save", exact: true }).click();
      expect((await saved).ok()).toBeTruthy(); await expect(editor).toHaveCount(0); await expect(note(page)).toHaveText(value);
    }
    await page.reload(); await expect(note(page)).toHaveText("We communicated more clearly during our passing drills today.");
  } finally {
    const latest = target(await (await page.request.get(query)).json());
    const restored = await page.request.post("/api/reflections", { data: { action: "save", source: latest.source, text: original.text,
      expectedRevision: latest.revision, operationId: crypto.randomUUID(), accessEpoch: initial.accessEpoch } });
    expect(restored.ok()).toBeTruthy();
  }
});

test("late inspected-history responses cannot replace the shared Group note", async ({ page }) => {
  await login(page, "phase2"); let release!: () => void; const gate = new Promise<void>(r => { release = r; }); let intercepted = false;
  await page.route("**/api/reflections?**", async route => { if (new URL(route.request().url()).searchParams.get("mode") === "inspection") { intercepted = true; await gate; } await route.continue().catch(() => {}); });
  await exactGroup(page, fixture.cardId, "follower", group.otherId); await expect.poll(() => intercepted).toBe(true);
  await exactGroup(page, fixture.cardId, "group"); await expect(note(page)).toHaveText("Add a reflection..."); release(); await page.waitForTimeout(400);
  await expect(note(page)).toHaveText("Add a reflection..."); await note(page).click(); await expect(page.getByRole("dialog", { name: "Edit reflection" })).toBeVisible();
});
