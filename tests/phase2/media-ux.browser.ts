import { test, expect, type Page } from "@playwright/test";
const fixture = JSON.parse(process.env.PHASE7_MEDIA_REVIEW!);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l5kAAAAASUVORK5CYII=", "base64");
async function login(page: Page, player = "phase2") { expect((await page.request.post("/api/auth/login", { data: { identifier: player, password: "local-test-only" } })).ok()).toBeTruthy(); }
// Clean only uploads made by these tests in this disposable dataset. Seeded
// history is several days old and is never reset, hidden or deleted here.
async function cleanRecentUploads(page: Page) {
  const history = await (await page.request.get(`/api/media/history?cardTemplateId=${fixture.cardId}`)).json();
  for (const item of history.items ?? []) if (item.source.kind === "group" && Date.parse(item.uploadedAt) > Date.now() - 86400000) {
    expect((await page.request.delete(`/api/group-media/${item.source.contributionId}`, { data: { expectedRevision: item.revision } })).ok()).toBeTruthy();
  }
}
test.beforeEach(async ({ page }) => {
  await login(page); await cleanRecentUploads(page);
  await login(page, "Aoife Kelly"); await cleanRecentUploads(page);
});
async function openBack(page: Page, group = false, focus = true) {
  await page.goto(`/decks?${group ? "openExperience=" + fixture.experienceId : "openDeck=" + fixture.personalDeckId}`);
  await expect(page.locator(".deck-card.is-active")).toBeVisible();
  if (focus) { await page.locator(".deck-card.is-active").press("Enter"); await expect(page.locator(".focused-card-layer")).toBeVisible(); }
  const front = page.locator(focus ? ".focused-card-surface--front .card-title-anchor" : ".deck-card.is-active .deck-card-surface--front .card-title-anchor");
  const box = (await front.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
  if (focus) await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
  else await expect(page.locator(".deck-card.is-active .deck-card-surface--back")).toHaveAttribute("aria-hidden", "false");

}
function centre(page: Page) { return page.getByRole("dialog", { name: "Card media", exact: true }); }
test("Personal icon/count, exact Gallery selection, separate Centre, upload and immediate creator Remove", async ({ page }) => {
  await login(page); await openBack(page);
  const control = page.locator(".focused-card-surface--back").getByRole("button", { name: "Media Centre", exact: true });
  await expect(control).toHaveText("8"); await expect(control.locator(".media-centre-icon")).toHaveCount(1);
  const thumbs = page.locator(".focused-card-surface--back .back-card-media-carousel button");
  await expect(thumbs).toHaveCount(5); await expect(page.locator(".media-private-label")).toHaveCount(0);
  expect(await thumbs.evaluateAll(nodes => nodes.map(n => [(n as HTMLElement).offsetWidth, (n as HTMLElement).offsetHeight]))).toEqual(Array.from({ length: 5 }, () => [46, 58]));
  await thumbs.first().click();
  const gallery = page.getByRole("dialog", { name: "Card media viewer" }); await expect(gallery.getByText("4 of 8")).toBeVisible();
  await expect(centre(page)).toHaveCount(0); await gallery.getByRole("button", { name: "Previous media" }).click(); await expect(gallery.getByText("3 of 8")).toBeVisible();
  await gallery.getByRole("button", { name: "Close media viewer" }).click(); await control.click();
  await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8);
  await expect(gallery).toHaveCount(0);
  await centre(page).getByLabel("Choose image").setInputFiles({ name: "added-training.png", mimeType: "image/png", buffer: png });
  await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(9);
  const added = centre(page).locator(".user-card-media-tile").filter({ hasText: "added-training.png" });
  await added.getByRole("button", { name: /Remove image/ }).click(); await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8);
  await centre(page).getByRole("button", { name: "Close", exact: true }).click(); await expect(control).toHaveText("8");
});
test("own Group history contains shared and Private media, Group upload and creator deletion", async ({ page }) => {
  await login(page, "Aoife Kelly"); await openBack(page, true);
  const control = page.locator(".focused-card-surface--back").getByRole("button", { name: "Media Centre", exact: true }); await expect(control).toHaveText("8");
  const thumbs = page.locator(".focused-card-surface--back .back-card-media-carousel button"); await expect(thumbs).toHaveCount(5);
  await expect(page.locator(".focused-card-surface--back .media-private-label")).toHaveCount(2);
  expect(await thumbs.evaluateAll(nodes => nodes.map(n => [(n as HTMLElement).offsetWidth, (n as HTMLElement).offsetHeight]))).toEqual(Array.from({ length: 5 }, () => [46, 58]));
  expect(await page.locator(".focused-card-surface--back").evaluate(back => {
    const bottom = Math.max(...Array.from(back.querySelectorAll(".media-private-label")).map(label => label.getBoundingClientRect().bottom));
    return bottom < back.querySelector(".focused-card-back-signals")!.getBoundingClientRect().top;
  })).toBe(true);
  await thumbs.last().click(); const gallery = page.getByRole("dialog", { name: "Card media viewer" }); await expect(gallery.getByText("Private", { exact: true })).toBeVisible();
  await gallery.getByRole("button", { name: "Close media viewer" }).click(); await control.click();
  await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8); await expect(centre(page).getByRole("img", { name: "Private", exact: true })).toHaveCount(5);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(centre(page)).toBeVisible(); await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8);
  await centre(page).getByLabel("Choose image").setInputFiles({ name: "group-training.png", mimeType: "image/png", buffer: png });
  await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(9);
  const newest = centre(page).locator(".user-card-media-tile").last();
  await newest.getByRole("button", { name: /Remove image/ }).click(); await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8);
});
test("Admin inspection Centre is remove-only; removal hides the Group contribution and retains creator history", async ({ page }) => {
  await login(page);
  const current = await (await page.request.get(`/api/group-experiences/${fixture.experienceId}`)).json();
  const people = await (await page.request.get(`/api/group-experiences/${fixture.experienceId}/perspectives`)).json();
  const player = people.followers.find((p: { username: string }) => p.username === "Aoife Kelly");
  expect(player).toBeTruthy();
  await page.request.patch(`/api/group-experiences/${fixture.experienceId}/navigation`, { data: { accessEpoch: current.accessEpoch, expectedStructureRevision: current.structureRevision, activeCardId: fixture.cardId, selection: { perspective: "follower", subjectUserId: player.userId } } });
  await openBack(page, true);
  await page.locator(".focused-card-surface--back").getByRole("button", { name: "Media Centre", exact: true }).click();
  await expect(centre(page).getByRole("button", { name: "+ Add image", exact: true })).toHaveCount(0);
  await expect(centre(page).getByRole("img", { name: "Private", exact: true })).toHaveCount(0);
  // Hide only a newly allocated fixture contribution so both browser projects retain the seeded examples.
  const playerContext = await page.context().browser()!.newContext({ baseURL: new URL(page.url()).origin }); const playerPage = await playerContext.newPage();
  await login(playerPage, "Aoife Kelly");
  const before = await (await playerPage.request.get(`/api/media/history?cardTemplateId=${fixture.cardId}&experienceId=${fixture.experienceId}`)).json();
  const allocation = await (await playerPage.request.post(`/api/group-experiences/${fixture.experienceId}/cards/${fixture.cardId}/media`, { data: { operationId: crypto.randomUUID(), accessEpoch: 0, version: 1, kind: "image", contentType: "image/png", size: png.length } })).json();
  expect(allocation.contributionId).toBeTruthy();
  await playerPage.request.put(allocation.uploadURL, { data: png, headers: allocation.headers });
  expect((await playerPage.request.post(`/api/group-experiences/${fixture.experienceId}/cards/${fixture.cardId}/media/${allocation.contributionId}/commit`, { data: { expectedRevision: allocation.revision, proof: allocation.proof } })).ok()).toBeTruthy();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const tile = centre(page).locator(`[data-media-item-id*="${allocation.contributionId}"]`); await expect(tile).toBeVisible();
  await tile.getByRole("button", { name: /Remove image/ }).click();
  await expect(centre(page).getByRole("status")).toHaveText("Removed from this Group. The creator still has their copy.");
  const after = await (await playerPage.request.get(`/api/media/history?cardTemplateId=${fixture.cardId}&experienceId=${fixture.experienceId}`)).json();
  expect(after.total).toBe(before.total + 1); expect(after.items.find((i: { source: { contributionId?: string } }) => i.source.contributionId === allocation.contributionId).private).toBe(true);
  const hidden = after.items.find((i: { source: { contributionId?: string } }) => i.source.contributionId === allocation.contributionId);
  expect((await playerPage.request.delete(`/api/group-media/${allocation.contributionId}`, { data: { expectedRevision: hidden.revision } })).ok()).toBeTruthy();
  await playerContext.close();
});

test("ordinary Personal Deck retains the same icon/Centre and thumbnail geometry", async ({ page }) => {
  await login(page); await openBack(page, false, false);
  const card = page.locator(".deck-card.is-active"), control = card.getByRole("button", { name: "Media Centre", exact: true });
  await expect(control).toHaveText("8"); await expect(card.locator(".back-card-media-carousel button")).toHaveCount(5);
  await control.click(); await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8);
  await expect(page.locator(".focused-card-layer")).toHaveCount(0);
  await centre(page).getByRole("button", { name: "Close", exact: true }).click(); await expect(control).toBeFocused();
});

test("Group-wide Admin upload remains author-owned and exposes no Private media", async ({ page }) => {
  await login(page);
  const current = await (await page.request.get(`/api/group-experiences/${fixture.experienceId}`)).json();
  expect((await page.request.patch(`/api/group-experiences/${fixture.experienceId}/navigation`, { data: { accessEpoch: current.accessEpoch, expectedStructureRevision: current.structureRevision, activeCardId: fixture.cardId, selection: { perspective: "group" } } })).ok()).toBeTruthy();
  await openBack(page, true);
  const control = page.locator(".focused-card-surface--back").getByRole("button", { name: "Media Centre", exact: true });
  await expect(control).toHaveText("8"); await expect(page.locator(".focused-card-surface--back .media-private-label")).toHaveCount(0);
  await control.click(); await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8);
  await centre(page).getByLabel("Choose image").setInputFiles({ name: "coach-practice.png", mimeType: "image/png", buffer: png });
  await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(9);
  const before = await (await page.request.get(`/api/media/history?cardTemplateId=${fixture.cardId}`)).json(); expect(before.total).toBe(9);
  await centre(page).locator(".user-card-media-tile").last().getByRole("button", { name: /Remove image/ }).click();
  await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8); await expect(centre(page).getByText("Removed from this Group. The creator still has their copy.")).toHaveCount(0);
});

test("peer inspection is Gallery-only and revocation closes/purges the foreign Gallery", async ({ page }) => {
  await login(page, "Alice");
  const current = await (await page.request.get(`/api/group-experiences/${fixture.experienceId}`)).json();
  const people = await (await page.request.get(`/api/group-experiences/${fixture.experienceId}/perspectives`)).json(), player = people.followers.find((p: { username: string }) => p.username === "Aoife Kelly");
  await page.request.patch(`/api/group-experiences/${fixture.experienceId}/navigation`, { data: { accessEpoch: current.accessEpoch, expectedStructureRevision: current.structureRevision, activeCardId: fixture.cardId, selection: { perspective: "follower", subjectUserId: player.userId } } });
  await openBack(page, true);
  const back = page.locator(".focused-card-surface--back"); await expect(back.getByRole("button", { name: "Media Centre", exact: true })).toHaveCount(0);
  await expect(back.locator(".media-private-label")).toHaveCount(0); await expect(back.locator(".back-card-media-carousel button")).toHaveCount(3);
  await back.locator(".back-card-media-carousel button").first().click(); const gallery = page.getByRole("dialog", { name: "Card media viewer" }); await expect(gallery).toBeVisible();
  const admin = await page.context().browser()!.newContext({ baseURL: new URL(page.url()).origin }), adminPage = await admin.newPage(); await login(adminPage);
  const setPeers = async (allowFollowerInspection: boolean) => {
    const group = await (await adminPage.request.get(`/api/group-experiences/${fixture.experienceId}`)).json();
    expect((await adminPage.request.patch(`/api/group-experiences/${fixture.experienceId}/settings`, { data: { operationId: crypto.randomUUID(), expectedStructureRevision: group.structureRevision, allowFollowerInspection } })).ok()).toBeTruthy();
  };
  try { await setPeers(false); await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect(gallery).toHaveCount(0); await expect(back.locator(".back-card-media-carousel button")).toHaveCount(0); }
  finally { await setPeers(true); await admin.close(); }
});

test("Media Centre alone loads every metadata page while the Gallery remains bounded", async ({ page }) => {
  await login(page);
  const actor = (await (await page.request.get("/api/auth/me")).json()).user.id;
  const records = Array.from({ length: 35 }, (_, n) => ({ source: { kind: "personal", cardTemplateId: fixture.cardId, mediaItemId: `older-${n}` }, authorUserId: actor, mediaType: "image", description: `Training ${n}`, uploadedAt: null, originName: "Personal", private: false,
    media: { id: `older-${n}`, mediaType: "image", src: "/__phase7-media/assets/missing.png", description: `Training ${n}` } }));
  const limits: number[] = [];
  await page.route("**/api/media/history?*", route => {
    const p = new URL(route.request().url()).searchParams, limit = Number(p.get("limit")), old = p.has("cursor"); limits.push(limit);
    return route.fulfill({ json: { viewerUserId: actor, cardTemplateId: fixture.cardId, total: 35, start: old ? 0 : 35 - limit, olderCount: old ? 0 : 35 - limit, items: old ? records.slice(0, 5) : records.slice(-limit), older: old ? null : "older", newer: null } });
  });
  await openBack(page); await expect(page.locator(".focused-card-surface--back .back-card-media-carousel button")).toHaveCount(5);
  expect(limits.every(n => n === 5)).toBe(true);
  await page.locator(".focused-card-surface--back").getByRole("button", { name: "Media Centre", exact: true }).click();
  await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(35);
  expect(limits.includes(30)).toBe(true); expect(limits.every(n => n <= 30)).toBe(true);
  await expect(centre(page).getByRole("button", { name: /Previous|Next/ })).toHaveCount(0);
});
