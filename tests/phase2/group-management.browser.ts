import { expect, test, type Page } from "@playwright/test";
const fixture = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null") as { experienceId: string; secondId: string; deckId: string; cardIds: string[] } | null;
test.skip(!fixture, "Requires disposable --group-experiences fixtures");
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
});
async function create(page: Page, followerIds: string[] = []) {
  const response = await page.request.post("/api/group-experiences", { data: { operationId: crypto.randomUUID(), name: `Settings ${crypto.randomUUID()}`,
    adminIds: [], followerIds, manifest: { deckTemplateId: fixture!.deckId, deckVersion: 1, cards: fixture!.cardIds.map(cardTemplateId => ({ cardTemplateId, version: 1 })) } } });
  expect(response.status()).toBe(200); return response.json() as Promise<{ experienceId: string }>;
}
async function settings(page: Page, id: string) {
  await page.goto(`/decks?openExperience=${id}`); await expect(page.locator(".group-picker-current")).toBeVisible();
  await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Group…", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Group settings", exact: true });
  await expect(dialog.getByLabel("Group name", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("phase2, Admin", { exact: true })).toBeChecked();
  return dialog;
}
test("Library Create/Cancel uses a cached alphabetical directory, explicit dual roles and preserves My Decks ordering", async ({ page }) => {
  await page.goto("/decks");
  const prior = await page.locator("[data-collection-item-id]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-collection-item-id")));
  let directoryReads = 0, writes = 0;
  page.on("request", request => { if (request.url().endsWith("/api/users")) directoryReads++; if (request.method() === "POST" && request.url().endsWith("/api/group-experiences")) writes++; });
  await page.goto(`/library/${fixture!.deckId}`);
  const open = async () => {
    await page.getByRole("button", { name: "Deck menu", exact: true }).click(); await page.getByRole("menuitem", { name: "Add as Group", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create Group", exact: true });
    await expect(dialog.getByLabel("phase2, Admin", { exact: true })).toBeChecked(); return dialog;
  };
  let dialog = await open();
  await expect(dialog.getByLabel("phase2, Follower", { exact: true })).not.toBeChecked();
  await expect(dialog.getByRole("switch")).not.toBeChecked(); await expect(dialog.getByRole("searchbox")).toHaveCount(0);
  const names = await dialog.locator(".group-management-user > span").allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
  await dialog.getByLabel("Group name", { exact: true }).fill("Discarded"); await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); expect(writes).toBe(0);
  dialog = await open(); await expect(dialog.getByLabel("Group name", { exact: true })).toHaveValue(""); expect(directoryReads).toBe(1);
  await dialog.getByLabel("Group name", { exact: true }).fill("Created through Library");
  await dialog.getByLabel("Alice, Admin", { exact: true }).check(); await dialog.getByLabel("Alice, Follower", { exact: true }).check();
  await expect(dialog.getByLabel("Selected identities")).toContainText("Alice");
  await dialog.getByRole("switch").check();
  const response = page.waitForResponse(response => response.url().endsWith("/api/group-experiences") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Create", exact: true }).click(); const result = await (await response).json();
  await expect(page).toHaveURL(new RegExp(`/decks\\?createdGroup=${result.experienceId}`));
  await expect(page.locator("[data-collection-item-id]").first()).toHaveAttribute("data-collection-item-id", result.experienceId);
  const after = await page.locator("[data-collection-item-id]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-collection-item-id")));
  expect(after.slice(1)).toEqual(prior); await expect(page.locator(".deck-detail")).toHaveCount(0); expect(writes).toBe(1);
  const meta = await (await page.request.get(`/api/group-experiences/${result.experienceId}`)).json();
  expect(meta.isAdmin).toBe(true); expect(meta.isFollower).toBe(false); expect(meta.allowFollowerInspection).toBe(true);
});
test("zero-follower Group settings Cancel and atomic Save retain the mounted Deck and active Card", async ({ page }) => {
  const group = await create(page), dialog = await settings(page, group.experienceId);
  const scene = await page.locator(".deck-detail").elementHandle();
  await expect(dialog.locator('.group-management-user input[aria-label$=", Follower"]:checked')).toHaveCount(0);
  await dialog.getByLabel("Group name", { exact: true }).fill("Discard settings"); await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await (await page.request.get(`/api/group-experiences/${group.experienceId}`)).json()).name).not.toBe("Discard settings");
  await page.getByRole("button", { name: "Deck menu", exact: true }).click(); await page.getByRole("menuitem", { name: "Group…", exact: true }).click();
  const reopened = page.getByRole("dialog", { name: "Group settings", exact: true });
  await reopened.getByLabel("Group name", { exact: true }).fill("Saved together"); await reopened.getByRole("switch").check();
  await reopened.getByLabel("phase2, Follower", { exact: true }).check();
  const cardId = await page.locator(".group-experience").getAttribute("data-current-card"), face = await page.locator(".group-experience").getAttribute("data-face");
  await reopened.getByRole("button", { name: "Save", exact: true }).click(); await expect(reopened).toHaveCount(0);
  expect(await scene!.evaluate(node => node.isConnected && node === document.querySelector(".deck-detail"))).toBe(true);
  await expect(page.locator(".group-experience")).toHaveAttribute("data-current-card", cardId!); await expect(page.locator(".group-experience")).toHaveAttribute("data-face", face!);
  const meta = await (await page.request.get(`/api/group-experiences/${group.experienceId}`)).json();
  expect(meta.name).toBe("Saved together"); expect(meta.allowFollowerInspection).toBe(true); expect(meta.isFollower).toBe(true); expect(meta.structureRevision).toBe(1);
});
test("stale settings preserve the draft and cannot partially overwrite a newer Save", async ({ page }) => {
  const group = await create(page), dialog = await settings(page, group.experienceId);
  await dialog.getByLabel("Group name", { exact: true }).fill("My unsaved draft"); await dialog.getByRole("switch").check();
  const current = await (await page.request.get(`/api/group-experiences/${group.experienceId}`)).json();
  const actor = (await (await page.request.get("/api/auth/me")).json()).user.id;
  expect((await page.request.patch(`/api/group-experiences/${group.experienceId}/management`, { data: { operationId: crypto.randomUUID(), expectedStructureRevision: current.structureRevision,
    name: "Other Admin intent", adminIds: [actor], followerIds: [], allowFollowerInspection: false } })).status()).toBe(200);
  await dialog.getByRole("button", { name: "Save", exact: true }).click(); await expect(dialog.getByRole("alert")).toContainText("Your selections are kept");
  await expect(dialog.getByLabel("Group name", { exact: true })).toHaveValue("My unsaved draft"); await expect(dialog.getByRole("switch")).toBeChecked();
  expect((await (await page.request.get(`/api/group-experiences/${group.experienceId}`)).json()).name).toBe("Other Admin intent");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});
test("settings retain a non-default follower, Card 2, back face and the same physical scene", async ({ page }) => {
  const users = (await (await page.request.get("/api/users")).json()).users as { id: string; name: string }[];
  const alice = users.find(user => user.name === "Alice")!.id, group = await create(page, [alice]);
  expect((await page.request.patch(`/api/group-experiences/${group.experienceId}/navigation`, { data: { accessEpoch: 0, expectedStructureRevision: 0,
    selection: { perspective: "follower", subjectUserId: alice }, activeCardId: fixture!.cardIds[1] } })).status()).toBe(200);
  await page.goto(`/decks?openExperience=${group.experienceId}`);
  const scene = page.locator(".group-experience"); await expect(scene).toHaveAttribute("data-perspective-key", alice);
  const title = await page.locator(".deck-card.is-active .card-title-anchor").first().boundingBox();
  expect(title).not.toBeNull(); const x = title!.x + title!.width / 2, y = title!.y + title!.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 150, y, { steps: 12 }); await page.mouse.up();
  await expect(scene).toHaveAttribute("data-face", "back");
  const physical = await page.locator(".deck-detail").elementHandle();
  await page.getByRole("button", { name: "Deck menu", exact: true }).click(); await page.getByRole("menuitem", { name: "Group…", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Group settings", exact: true });
  await expect(dialog.getByLabel("Alice, Follower", { exact: true })).toBeChecked();
  await dialog.getByLabel("Group name", { exact: true }).fill("Context retained"); await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(scene).toHaveAttribute("data-perspective-key", alice);
  await expect(scene).toHaveAttribute("data-current-card", fixture!.cardIds[1]); await expect(scene).toHaveAttribute("data-face", "back");
  expect(await physical!.evaluate(node => node.isConnected && node === document.querySelector(".deck-detail"))).toBe(true);
});
test("lost Save response after self-removal retains the exact retry and returns to My Decks only after acknowledgement", async ({ page }) => {
  const group = await create(page), dialog = await settings(page, group.experienceId);
  await dialog.getByLabel("Alice, Admin", { exact: true }).check(); await dialog.getByLabel("phase2, Admin", { exact: true }).uncheck();
  const payloads: string[] = [];
  await page.route(`**/api/group-experiences/${group.experienceId}/management`, async route => {
    payloads.push(route.request().postData()!);
    if (payloads.length === 1) { const response = await route.fetch(); expect(response.status()).toBe(200); await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Lost acknowledgement" }) }); }
    else await route.continue();
  });
  await dialog.getByRole("button", { name: "Save", exact: true }).click(); await expect(dialog.getByRole("alert")).toContainText("not been confirmed");
  await expect(page).toHaveURL(new RegExp(`openExperience=${group.experienceId}`)); await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Retry Save", exact: true }).click(); await expect(page).toHaveURL(/\/decks$/);
  expect(payloads).toHaveLength(2); expect(payloads[0]).toBe(payloads[1]);
  await expect(page.locator(`[data-collection-item-id="${group.experienceId}"]`)).toHaveCount(0);
  expect((await page.request.get(`/api/group-experiences/${group.experienceId}`)).status()).toBe(403);
});
test("followers cannot open Group management", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  await page.goto(`/decks?openExperience=${fixture!.secondId}`); await expect(page.locator(".group-picker-current")).toBeVisible();
  await expect(page.getByRole("button", { name: "Deck menu", exact: true })).toHaveCount(0);
});
test("85-percent user list preserves inner scrolling and leaves a native outer-scroll strip", async ({ page, browserName }) => {
  await page.goto(`/library/${fixture!.deckId}`); await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add as Group", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create Group", exact: true });
  await expect(dialog.getByLabel("phase2, Admin", { exact: true })).toBeChecked();
  // Populate only the local draft so the outer form has room to scroll.
  for (const checkbox of await dialog.locator('.group-management-user input[aria-label$=", Follower"]').all()) await checkbox.check({ force: true });
  const inner = dialog.locator(".group-management-directory");
  const setup = async () => dialog.evaluate(element => {
    const list = element.querySelector<HTMLElement>(".group-management-directory")!;
    list.scrollTop = 0;
    element.scrollTop += list.getBoundingClientRect().top - 600;
    const rect = list.getBoundingClientRect(), parent = element.querySelector(".group-management-fields")!.getBoundingClientRect();
    const section = element.querySelector(".group-management-users")!, style = getComputedStyle(section);
    const rightX = rect.right + (parent.right - rect.right) / 2, y = Math.min(rect.top + 50, window.innerHeight - 50);
    return { ratio: rect.width / parent.width, left: rect.left - parent.left, height: rect.height,
      maxHeight: getComputedStyle(list).maxHeight, rightX, innerX: rect.left + 20, y,
      stripInsideList: Boolean(document.elementFromPoint(rightX, y)?.closest(".group-management-directory")),
      borderRight: style.borderRightWidth, outer: element.scrollTop, inner: list.scrollTop,
      room: element.scrollHeight - element.clientHeight - element.scrollTop };
  });
  let position = await setup();
  expect(position.ratio).toBeCloseTo(.85, 2); expect(Math.abs(position.left)).toBeLessThan(1);
  // Engines serialize the same 42dvh computed value at different precision.
  expect(Number.parseFloat(position.maxHeight)).toBeCloseTo(844 * .42, 4); expect(position.height).toBeCloseTo(844 * .42, 0);
  expect(position.borderRight).toBe("0px"); expect(position.stripInsideList).toBe(false); expect(position.room).toBeGreaterThan(80);
  const cdp = browserName === "chromium" ? await page.context().newCDPSession(page) : null;
  if (cdp) await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const scrollAt = async (x: number, y: number) => {
    if (cdp) await cdp.send("Input.synthesizeScrollGesture", { x, y, yDistance: -100, speed: 400, gestureSourceType: "touch" });
    else { await page.mouse.move(x, y); await page.mouse.wheel(0, 100); }
  };
  try {
    await scrollAt(position.rightX, position.y);
    await expect.poll(() => dialog.evaluate(element => element.scrollTop)).toBeGreaterThan(position.outer + 20);
    await expect.poll(() => inner.evaluate(element => element.scrollTop)).toBe(0);
    position = await setup();
    await scrollAt(position.innerX, position.y);
    await expect.poll(() => inner.evaluate(element => element.scrollTop)).toBeGreaterThan(20);
    expect(await dialog.evaluate(element => element.scrollTop)).toBeCloseTo(position.outer, 0);
    const checkbox = await dialog.getByLabel("phase2, Follower", { exact: true }).evaluate(element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return { width: rect.width, height: rect.height, margin: style.margin };
    });
    expect(checkbox).toEqual({ width: 22, height: 22, margin: "8px" });
    console.log(JSON.stringify({ browserName, input: cdp ? "native touch gestures" : "native wheel", listWidthRatio: position.ratio, listHeight: position.height, stripOutsideInner: true }));
  } finally { await cdp?.detach(); }
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});
test("selected identities use compact Admins then Followers sections without per-Card role labels", async ({ page }) => {
  await page.goto(`/library/${fixture!.deckId}`); await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add as Group", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create Group", exact: true });
  await expect(dialog.getByLabel("phase2, Admin", { exact: true })).toBeChecked();
  await expect(dialog.locator(".group-management-user-head > span")).toHaveText(["Registered users", "Admin", "Follower"]);
  const selected = dialog.getByLabel("Selected identities");
  await expect(selected.getByRole("heading")).toHaveText(["Admins"]);
  await dialog.getByLabel("Alice, Admin", { exact: true }).check(); await dialog.getByLabel("Alice, Follower", { exact: true }).check();
  await expect(selected.getByRole("heading")).toHaveText(["Admins", "Followers"]);
  const admins = selected.getByRole("region", { name: "Admins", exact: true }), followers = selected.getByRole("region", { name: "Followers", exact: true });
  await expect(admins.locator(".group-management-identity")).toHaveCount(2);
  await expect(followers.locator(".group-management-identity")).toHaveCount(1);
  await expect(admins.locator(".group-identity-name")).toContainText(["Alice", "phase2"]);
  await expect(followers.locator(".group-identity-name")).toHaveText(["Alice"]);
  await expect(selected.locator(".group-management-identity small")).toHaveCount(0);
  const geometry = await admins.locator(".group-management-identity").first().evaluate(element => {
    const rect = element.getBoundingClientRect(), grid = getComputedStyle(element.parentElement!), style = getComputedStyle(element);
    return { width: rect.width, height: rect.height, gap: grid.gap, columns: grid.gridTemplateColumns.split(" ").length, align: style.alignItems };
  });
  expect(geometry.height).toBeLessThan(100); expect(geometry.width).toBeGreaterThan(geometry.height);
  expect(geometry.gap).toBe("10px"); expect(geometry.columns).toBe(3); expect(geometry.align).toBe("center");
  await dialog.getByLabel("Alice, Follower", { exact: true }).uncheck();
  await expect(selected.getByRole("heading")).toHaveText(["Admins"]);
  await expect(admins.locator(".group-identity-name")).toContainText(["Alice", "phase2"]);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});
test("directory loading errors expose Retry without dropping the local creation draft", async ({ page }) => {
  let reads = 0;
  await page.route("**/api/users", async route => {
    reads++;
    if (reads === 1) await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "fixture failure" }) });
    else await route.continue();
  });
  await page.goto(`/library/${fixture!.deckId}`); await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add as Group", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create Group", exact: true });
  await dialog.getByLabel("Group name", { exact: true }).fill("Keep my draft");
  await expect(dialog.getByRole("alert")).toContainText("Unable to load registered users");
  await expect(dialog.getByRole("button", { name: "Create", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Retry users", exact: true }).click();
  await expect(dialog.getByLabel("phase2, Admin", { exact: true })).toBeChecked();
  await expect(dialog.getByLabel("Group name", { exact: true })).toHaveValue("Keep my draft"); expect(reads).toBe(2);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});
test("self-demotion retains follower access and a valid Group perspective without remounting", async ({ page }) => {
  const group = await create(page), dialog = await settings(page, group.experienceId);
  const physical = await page.locator(".deck-detail").elementHandle();
  await dialog.getByLabel("Alice, Admin", { exact: true }).check();
  await dialog.getByLabel("phase2, Follower", { exact: true }).check(); await dialog.getByLabel("phase2, Admin", { exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Save", exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`openExperience=${group.experienceId}`));
  await expect(page.locator(".group-experience")).toHaveAttribute("data-perspective-key", "group");
  await expect(page.getByRole("button", { name: "Deck menu", exact: true })).toHaveCount(0);
  expect(await physical!.evaluate(node => node.isConnected && node === document.querySelector(".deck-detail"))).toBe(true);
  const meta = await (await page.request.get(`/api/group-experiences/${group.experienceId}`)).json();
  expect(meta.isAdmin).toBe(false); expect(meta.isFollower).toBe(true);
});
test("Retry after a committed Save and subsequent revocation acknowledges success without restoring access", async ({ page, browser }) => {
  const group = await create(page), dialog = await settings(page, group.experienceId);
  await dialog.getByLabel("Alice, Admin", { exact: true }).check();
  const second = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL });
  try {
    await second.request.post("/api/auth/login", { data: { identifier: "Alice", password: "local-test-only" } });
    const alice = (await (await second.request.get("/api/auth/me")).json()).user.id;
    let calls = 0;
    await page.route(`**/api/group-experiences/${group.experienceId}/management`, async route => {
      calls++;
      if (calls === 1) {
        const saved = await route.fetch(); expect(saved.status()).toBe(200);
        expect((await second.request.patch(`/api/group-experiences/${group.experienceId}/management`, { data: {
          operationId: crypto.randomUUID(), expectedStructureRevision: 1, name: "Later revocation", adminIds: [alice], followerIds: [], allowFollowerInspection: false,
        } })).status()).toBe(200);
        await route.fulfill({ response: saved });
      } else await route.continue();
    });
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Saved, but the view could not refresh");
    await dialog.getByRole("button", { name: "Retry Save", exact: true }).click();
    await expect(page).toHaveURL(/\/decks$/); expect(calls).toBe(2);
    expect((await page.request.get(`/api/group-experiences/${group.experienceId}`)).status()).toBe(403);
  } finally { await second.close(); }
});
