import { test, expect, type Page } from "@playwright/test";
const review = JSON.parse(process.env.PHASE10_REVIEW!), group = review.groupReview, fixture = review.reflectionReview;
async function login(page: Page, actor = "Aoife Kelly") { expect((await page.request.post("/api/auth/login", { data: { identifier: actor, password: "local-test-only" } })).ok()).toBeTruthy(); }
async function open(page: Page, personal = false, cardId = fixture.cardId, perspective = "self") {
  const query = personal ? new URLSearchParams({ openDeck: group.deckId, openCard: cardId }) : new URLSearchParams({ openExperience: group.experienceId, progressScene: "1", progressFace: "front", progressFocused: "0", progressPerspective: perspective, openCard: cardId });
  await page.goto(`/decks?${query}`);
  await expect(page.locator(".deck-card.is-active")).toBeVisible();
  await page.locator(".deck-card.is-active").press("Enter"); await expect(page.locator(".focused-card-layer")).toBeVisible();
  const front = page.locator(".focused-card-surface--front .card-title-anchor"), box = (await front.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
  await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
}
const area = (p: Page) => p.locator(".focused-card-surface--back .reflection-area");
const text = (p: Page) => area(p).locator(".focused-card-back-reflection-fragment");
test("own Group history uses manual distinct arrow, source-aware modal and reference SVG", async ({ page }, info) => {
  await login(page); await open(page);
  await expect(text(page)).toHaveText("I contributed well to our Galway U18 group today.");
  await page.waitForTimeout(5400); await expect(text(page)).toHaveText("I contributed well to our Galway U18 group today.");
  await text(page).click(); const edit = page.getByRole("dialog", { name: "Edit reflection" }); await expect(edit).toBeVisible();
  await expect(edit.getByRole("button", { name: "Delete", exact: true })).toBeVisible(); await edit.getByRole("button", { name: "Close", exact: true }).click();
  const next = area(page).getByRole("button", { name: "Next reflection" });
  const rect = (await next.boundingBox())!; expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
  const svg = next.locator("svg"); await expect(svg).toHaveAttribute("viewBox", "0 0 48 48"); expect(await svg.locator("linearGradient").count()).toBe(2);
  const visibleWidth = await svg.evaluate(n => n.getBoundingClientRect().width); expect(visibleWidth).toBeGreaterThanOrEqual(22); expect(visibleWidth).toBeLessThanOrEqual(24);
  await next.click(); await expect(text(page)).toHaveText("I enjoyed working with the Galway development group today.");
  await text(page).click(); const read = page.getByRole("dialog", { name: "View reflection" });
  await expect(read.getByRole("textbox")).toHaveAttribute("readonly", ""); await expect(read).toContainText("no longer a member");
  await expect(read.getByRole("button", { name: "Save", exact: true })).toHaveCount(0); await expect(read.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  await read.getByRole("button", { name: "Close", exact: true }).first().click();
  await next.click(); await expect(text(page)).toHaveText("I enjoyed this card and improved my footwork today."); await expect(area(page)).toContainText("Personal · Private");
  await next.click(); await expect(text(page)).toHaveText("I contributed well to our Galway U18 group today.");
  await page.screenshot({ path: `/private/tmp/phase10-${info.project.name}-reflection-arrow.png` });
});
test("ordinary Personal Card prioritises Personal and opens other origins read-only", async ({ page }) => {
  await login(page); await open(page, true);
  await expect(text(page)).toHaveText("I enjoyed this card and improved my footwork today.");
  await expect(area(page)).not.toContainText("Private"); await text(page).click(); await expect(page.getByRole("dialog", { name: "Edit reflection" })).toBeVisible();
  await page.keyboard.press("Escape"); await area(page).getByRole("button", { name: "Next reflection" }).click();
  await expect(text(page)).toContainText("Galway development"); await text(page).click(); await expect(page.getByRole("dialog", { name: "View reflection" })).toBeVisible();
});
test("Admin Group working reflection opens editor; carousel auto-rotates and foreign modal only hides", async ({ page }) => {
  await login(page, "phase2"); await open(page, false, fixture.cardId, "group");
  await expect(text(page)).toHaveText("Our group communicated better during the defensive drills today.");
  await text(page).click(); const edit = page.getByRole("dialog", { name: "Edit reflection" }); await expect(edit).toBeVisible(); await edit.getByRole("button", { name: "Close", exact: true }).click();
  // Remove keyboard focus to exercise Group-only automatic rotation.
  await page.locator(".focused-card-surface--back").evaluate(n => (n.querySelector(":focus") as HTMLElement | null)?.blur());
  await expect(text(page)).not.toHaveText("Our group communicated better during the defensive drills today.", { timeout: 8000 });
  await text(page).click(); const read = page.getByRole("dialog", { name: "View reflection" }); await expect(read).toBeVisible();
  await expect(read.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0); await expect(read.getByRole("button", { name: "Remove from Group", exact: true })).toBeVisible();
  await expect(read.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
});
test("server rejects forged scopes, foreign mutation, stale revisions and cross-origin writes", async ({ page }) => {
  await login(page);
  const me = await page.request.get(`/api/reflections?cardTemplateId=${fixture.cardId}&experienceId=${group.experienceId}&mode=own&accessEpoch=0`);
  expect(me.ok()).toBeTruthy(); const data = await me.json(); expect(data.items).toHaveLength(3);
  const source = data.items[0].entry.source;
  const stale = await page.request.post("/api/reflections", { data: { action: "save", source, text: "Must not overwrite", expectedRevision: 999, operationId: crypto.randomUUID(), accessEpoch: 0 } }); expect(stale.status()).toBe(409);
  const forged = await page.request.get(`/api/reflections?cardTemplateId=forged&experienceId=${group.experienceId}&mode=group&accessEpoch=0`); expect(forged.status()).toBe(403);
  const origin = await page.request.post("/api/reflections", { headers: { Origin: "https://unrelated.invalid" }, data: { action: "delete", source, expectedRevision: 1, operationId: crypto.randomUUID() } }); expect(origin.status()).toBe(403);
  const other = await page.request.get(`/api/reflections?cardTemplateId=${fixture.cardId}&experienceId=${group.experienceId}&mode=group&accessEpoch=0`);
  const foreign = (await other.json()).items.find((i: {entry:{authorUserId:string}}) => i.entry.authorUserId === group.adminId);
  const deny = await page.request.post("/api/reflections", { data: { action: "delete", source: foreign.entry.source, expectedRevision: foreign.entry.revision, operationId: crypto.randomUUID() } }); expect(deny.status()).toBe(403);
});

async function exactGroup(page: Page, cardId: string, perspective = "self", subject?: string) {
  const query = new URLSearchParams({ openExperience: group.experienceId, progressScene: "1", progressFace: "back", progressFocused: "1", progressPerspective: perspective, openCard: cardId });
  if (subject) query.set("progressSubject", subject);
  await page.goto(`/decks?${query}`); await expect(page.locator(".focused-card-layer")).toBeVisible();
}
test("empty current slot adds exact source; Admin hiding persists across logins and author Delete restores Add", async ({ page }) => {
  await login(page);
  const value = "Our group helped me stay balanced during practice today.";
  // Clean only this test's exact temporary text after an interrupted run. Never
  // reset fixture records, membership, visibility or original creation dates.
  const before = await (await page.request.get(`/api/reflections?cardTemplateId=${fixture.emptyCardId}&experienceId=${group.experienceId}&mode=own&accessEpoch=0`)).json();
  const pending = before.items.find((i: {entry:{text:string}}) => i.entry.text === value)?.entry;
  if (pending) expect((await page.request.post("/api/reflections", { data: { action: "delete", source: pending.source, expectedRevision: pending.revision, operationId: crypto.randomUUID() } })).ok()).toBeTruthy();
  await exactGroup(page, fixture.emptyCardId);
  await expect(text(page)).toHaveText("Add a reflection..."); await text(page).click();
  const editor = page.getByRole("dialog", { name: "Edit reflection" });
  await editor.getByRole("textbox").fill(value); await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toHaveCount(0); await expect(text(page)).toHaveText(value);
  const ownerFeed = await (await page.request.get(`/api/reflections?cardTemplateId=${fixture.emptyCardId}&experienceId=${group.experienceId}&mode=own&accessEpoch=0`)).json();
  const target = ownerFeed.items.find((i: {entry:{text:string}}) => i.entry.text === value).entry;
  // Re-authoring an already hidden slot in the second browser must stay hidden.
  // Capture the exact source as its author, never retrieve hidden foreign text.
  await login(page, "phase2");
  const feed = await (await page.request.get(`/api/reflections?cardTemplateId=${fixture.emptyCardId}&experienceId=${group.experienceId}&mode=group&accessEpoch=0`)).json();
  expect(feed.items.some((i: {entry:{text:string}}) => i.entry.text === value)).toBe(target.groupVisible);
  expect((await page.request.post("/api/reflections", { data: { action: "hide", source: target.source, expectedRevision: target.revision, accessEpoch: 0, operationId: crypto.randomUUID() } })).ok()).toBeTruthy();
  const shared = await (await page.request.get(`/api/reflections?cardTemplateId=${fixture.emptyCardId}&experienceId=${group.experienceId}&mode=group&accessEpoch=0`)).json();
  expect(shared.items.some((i: {entry:{text:string}}) => i.entry.text === value)).toBe(false);
  await login(page); await exactGroup(page, fixture.emptyCardId); await expect(text(page)).toHaveText(value); await expect(area(page)).toContainText("Private");
  await text(page).click(); await page.getByRole("dialog", { name: "Edit reflection" }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(text(page)).toHaveText("Add a reflection...");
  await area(page).getByRole("button", { name: "Next reflection" }).click(); await expect(text(page)).toContainText("Galway development");
  await exactGroup(page, fixture.emptyCardId); await expect(text(page)).toHaveText("Add a reflection...");
});
test("long text is clipped only on Card; Admin empty Group working slot and inspection remain distinct", async ({ page }) => {
  await login(page); await exactGroup(page, fixture.longCardId); await expect(text(page)).toContainText("I found the first defensive drill difficult");
  expect(await text(page).evaluate(n => n.scrollHeight > n.clientHeight)).toBe(true);
  await text(page).click(); const dialog = page.getByRole("dialog", { name: "Edit reflection" });
  await expect(dialog.getByRole("textbox")).toHaveValue(/throughout the practice\.$/); await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await login(page, "phase2"); await exactGroup(page, fixture.longCardId, "group");
  await expect(text(page)).toHaveText("Add a reflection..."); await text(page).click(); await expect(page.getByRole("dialog", { name: "Edit reflection" })).toBeVisible(); await page.keyboard.press("Escape");
  await exactGroup(page, fixture.cardId, "follower", group.otherId); await expect(text(page)).toContainText("I contributed well");
  await expect(area(page).getByRole("button", { name: "Next reflection" })).toHaveCount(0);
  await text(page).click(); const read = page.getByRole("dialog", { name: "View reflection" }); await expect(read).toBeVisible();
  await expect(read.getByRole("button", { name: "Save", exact: true })).toHaveCount(0); await expect(read.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  await expect(read.getByRole("button", { name: "Remove from Group", exact: true })).toBeVisible();
});

test("reduced motion stops autoplay and fade while preserving the separate manual arrow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await login(page, "phase2"); await exactGroup(page, fixture.cardId, "group");
  const initial = "Our group communicated better during the defensive drills today.";
  await expect(text(page)).toHaveText(initial); await page.waitForTimeout(5400); await expect(text(page)).toHaveText(initial);
  await area(page).getByRole("button", { name: "Next reflection" }).click(); await expect(text(page)).not.toHaveText(initial);
  expect(await area(page).locator(".reflection-area-content").evaluate(n => getComputedStyle(n).transitionDuration)).toBe("0s");
  await text(page).click(); await expect(page.getByRole("dialog", { name: "View reflection" })).toBeVisible();
});
test("late inspected reflection responses cannot replace the current Group working context", async ({ page }) => {
  await login(page, "phase2"); let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }); let intercepted = false;
  await page.route("**/api/reflections?**", async route => {
    if (new URL(route.request().url()).searchParams.get("mode") === "inspection") { intercepted = true; await gate; }
    await route.continue().catch(() => {});
  });
  await exactGroup(page, fixture.cardId, "follower", group.otherId);
  await expect.poll(() => intercepted).toBe(true);
  await exactGroup(page, fixture.cardId, "group"); await expect(text(page)).toHaveText("Our group communicated better during the defensive drills today.");
  release(); await page.waitForTimeout(400); await expect(text(page)).toHaveText("Our group communicated better during the defensive drills today.");
  await text(page).click(); await expect(page.getByRole("dialog", { name: "Edit reflection" })).toBeVisible();
});

test("ordinary Personal Add Save and Delete preserve the current source and legacy unknown date", async ({ page }) => {
  await login(page);
  const value = "I practised my balance before our basketball training today.";
  const before = await (await page.request.get(`/api/reflections?cardTemplateId=${fixture.emptyCardId}`)).json();
  const pending = before.items.find((i: {entry:{text:string}}) => i.entry.text === value)?.entry;
  if (pending) expect((await page.request.post("/api/reflections", { data: { action: "delete", source: pending.source, expectedRevision: pending.revision, operationId: crypto.randomUUID() } })).ok()).toBeTruthy();
  await open(page, true, fixture.emptyCardId); await expect(text(page)).toHaveText("Add a reflection...");
  await text(page).click(); const editor = page.getByRole("dialog", { name: "Edit reflection" });
  await editor.getByRole("textbox").fill(value); await editor.getByRole("button", { name: "Save", exact: true }).click(); await expect(editor).toHaveCount(0);
  await expect(text(page)).toHaveText(value);
  const saved = await (await page.request.get(`/api/reflections?cardTemplateId=${fixture.emptyCardId}`)).json();
  expect(saved.items[0].entry.source.kind).toBe("personal"); expect(saved.items[0].entry.createdAt).toBeNull();
  await text(page).click(); await page.getByRole("dialog", { name: "Edit reflection" }).getByRole("button", { name: "Delete", exact: true }).click(); await expect(text(page)).toHaveText("Add a reflection...");
});
