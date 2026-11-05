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
  await expect(centre(page).locator(".user-card-media-tile-origin").filter({ hasText: "In: Personal" })).toHaveCount(2);
  await expect(centre(page).getByRole("button", { name: /Remove image/ })).toHaveCount(8);
  await centre(page).getByLabel("Choose image").setInputFiles({ name: "added-training.png", mimeType: "image/png", buffer: png });
  await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(9);
  const added = centre(page).locator(".user-card-media-tile").filter({ hasText: "added-training.png" });
  await expect(added.locator(".user-card-media-tile-name")).toHaveText("added-training.png");
  await expect(added.locator(".user-card-media-tile-origin")).toHaveText("In: Personal");
  await added.getByRole("button", { name: /Remove image/ }).click(); await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8);
  await centre(page).getByRole("button", { name: "Close", exact: true }).click(); await expect(control).toHaveText("8");
});
test("own Group history contains shared and Private media, Group upload and creator deletion", async ({ page }) => {
  await login(page, "Aoife Kelly"); await selectPerspective(page, { perspective: "self" }); await openBack(page, true);
  const control = page.locator(".focused-card-surface--back").getByRole("button", { name: "Media Centre", exact: true }); await expect(control).toHaveText("8");
  const thumbs = page.locator(".focused-card-surface--back .back-card-media-carousel button"); await expect(thumbs).toHaveCount(5);
  await expect(page.locator(".focused-card-surface--back .media-private-label")).toHaveCount(5);
  expect(await thumbs.evaluateAll(nodes => nodes.map(n => [(n as HTMLElement).offsetWidth, (n as HTMLElement).offsetHeight]))).toEqual(Array.from({ length: 5 }, () => [46, 58]));
  // is-flipped marks the start of the existing 680ms transition. Measure
  // settled spacing rather than a transient 3D bounding box during that flip.
  await expect.poll(() => page.locator(".focused-card-surface--back").evaluate(back => {
    const bottom = Math.max(...Array.from(back.querySelectorAll(".media-private-label")).map(label => label.getBoundingClientRect().bottom));
    return bottom < back.querySelector(".focused-card-back-signals")!.getBoundingClientRect().top;
  })).toBe(true);
  await thumbs.last().click(); const gallery = page.getByRole("dialog", { name: "Card media viewer" }); await expect(gallery.getByText("Private", { exact: true })).toBeVisible();
  await gallery.getByRole("button", { name: "Close media viewer" }).click(); await control.click();
  await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8); await expect(centre(page).getByRole("img", { name: "Private in this Group", exact: true })).toHaveCount(5);
  await expect(centre(page).locator(".user-card-media-tile-name")).toHaveText(["basketball-hoop.png", "training-cones.png", "balance-board.png", "footwork-ladder.png", "passing-practice.png", "rebound-practice.png", "defensive-positioning.png", "dribbling-practice.png"]);
  await expect(centre(page).locator(".user-card-media-tile-origin")).toHaveText(Array(8).fill("By: Aoife Kelly"));
  await expect(centre(page).getByRole("button", { name: /Remove image/ })).toHaveCount(4);
  const hiddenSeed = centre(page).locator(".user-card-media-tile").filter({ hasText: "balance-board.png" });
  await expect(hiddenSeed.getByRole("img", { name: "Private in this Group", exact: true })).toBeVisible();
  await expect(hiddenSeed.getByRole("button", { name: /Remove image/ })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(centre(page)).toBeVisible(); await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8);
  await centre(page).getByLabel("Choose image").setInputFiles({ name: "group-training.png", mimeType: "image/png", buffer: png });
  await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(9);
  const newest = centre(page).locator(".user-card-media-tile").last();
  await expect(newest.locator(".user-card-media-tile-name")).toHaveText("group-training.png");
  await expect(newest.locator(".user-card-media-tile-origin")).toHaveText("By: Aoife Kelly");
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
  const allocation = await (await playerPage.request.post(`/api/group-experiences/${fixture.experienceId}/cards/${fixture.cardId}/media`, { data: { operationId: crypto.randomUUID(), accessEpoch: 0, version: 1, kind: "image", contentType: "image/png", size: png.length, originalFilename: "team-passing.png" } })).json();
  expect(allocation.contributionId).toBeTruthy();
  await playerPage.request.put(allocation.uploadURL, { data: png, headers: allocation.headers });
  expect((await playerPage.request.post(`/api/group-experiences/${fixture.experienceId}/cards/${fixture.cardId}/media/${allocation.contributionId}/commit`, { data: { expectedRevision: allocation.revision, proof: allocation.proof } })).ok()).toBeTruthy();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const tile = centre(page).locator(`[data-media-item-id*="${allocation.contributionId}"]`); await expect(tile).toBeVisible();
  await expect(tile.locator(".user-card-media-tile-name")).toHaveText("team-passing.png");
  await expect(tile.locator(".user-card-media-tile-origin")).toHaveText("By: Aoife Kelly");
  await tile.getByRole("button", { name: /Remove image/ }).click();
  await expect(centre(page).getByRole("status")).toHaveText("Removed from this Group. The creator still has their copy.");
  const after = await (await playerPage.request.get(`/api/media/history?cardTemplateId=${fixture.cardId}&experienceId=${fixture.experienceId}`)).json();
  expect(after.total).toBe(before.total + 1); expect(after.items.find((i: { source: { contributionId?: string } }) => i.source.contributionId === allocation.contributionId).private).toBe(true);
  const hidden = after.items.find((i: { source: { contributionId?: string } }) => i.source.contributionId === allocation.contributionId);
  expect(hidden.originalFilename).toBe("team-passing.png"); expect(hidden.originName).toBe("Galway U18");
  expect(hidden.authorName).toBe("Aoife Kelly");
  await playerPage.request.post("/api/auth/logout"); await login(playerPage, "Aoife Kelly");
  const relogged = await (await playerPage.request.get(`/api/media/history?cardTemplateId=${fixture.cardId}&experienceId=${fixture.experienceId}`)).json();
  const same = relogged.items.find((i: { source: { contributionId?: string } }) => i.source.contributionId === allocation.contributionId);
  expect(same).toMatchObject({ authorUserId: hidden.authorUserId, authorName: "Aoife Kelly", originalFilename: "team-passing.png", originName: "Galway U18", private: true });
  expect(await (await playerPage.request.get(`/api/group-media/${allocation.contributionId}`)).body()).toEqual(png);
  expect(relogged.items.filter((i: { source: { contributionId?: string } }) => i.source.contributionId !== allocation.contributionId).map((i: { source: unknown }) => i.source)).toEqual(before.items.map((i: { source: unknown }) => i.source));

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

async function selectPerspective(page: Page, selection: { perspective: "group" | "self" } | { perspective: "follower"; subjectUserId: string }) {
  const current = await (await page.request.get(`/api/group-experiences/${fixture.experienceId}`)).json();
  expect((await page.request.patch(`/api/group-experiences/${fixture.experienceId}/navigation`, { data: { accessEpoch: current.accessEpoch, expectedStructureRevision: current.structureRevision, activeCardId: fixture.cardId, selection } })).ok()).toBeTruthy();
}
async function dragSignal(page: Page, index = 0, dx = 120) {
  const box = (await page.locator(".focused-card-surface--back .focused-card-signal-track").nth(index).boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + 20 + dx, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
}
test("owner media and layout survive delayed first and existing confidence saves and temporary verification", async ({ page }) => {
  await login(page, "Aoife Kelly"); await selectPerspective(page, { perspective: "self" });
  const path = `/api/group-experiences/${fixture.experienceId}/cards/${fixture.cardId}/personal-learning`;
  const reset = () => page.request.patch(path, { data: { accessEpoch: 0, version: 1, change: { kind: "signal", stepId: "group-0-b", reading: null } } });
  expect((await reset()).ok()).toBeTruthy(); await openBack(page, true); await page.waitForTimeout(700);
  const back = page.locator(".focused-card-surface--back"); await expect(back.locator(".back-card-media-carousel button")).toHaveCount(5);
  await page.evaluate(() => {
    const samples: { count: number; noMedia: boolean }[] = [];
    const sample = () => { const back = document.querySelector(".focused-card-surface--back"); samples.push({ count: back?.querySelectorAll(".back-card-media-carousel button").length ?? -1, noMedia: !!back?.querySelector(".focused-card-back-signals--no-media") }); };
    const observer = new MutationObserver(sample); observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    (window as unknown as { mediaSamples: typeof samples; stopMediaProbe(): void }).mediaSamples = samples;
    (window as unknown as { stopMediaProbe(): void }).stopMediaProbe = () => observer.disconnect(); sample();
  });
  await page.route("**/personal-learning", async route => { const response = await route.fetch(); await new Promise(resolve => setTimeout(resolve, 6000)); await route.fulfill({ response }); });
  try {
    for (const dx of [70, 35]) {
      const top = (await back.locator(".group-back-signals").boundingBox())!.y;
      const saved = page.waitForResponse(response => response.url().endsWith("/personal-learning") && response.request().method() === "PATCH");
      await dragSignal(page, 1, dx);
      await expect(page.locator(".group-verification")).toBeVisible({ timeout: 10000 });
      await expect(back.locator(".back-card-media-carousel button")).toHaveCount(5);
      await dragSignal(page, 0, 40);
      await expect(page.getByRole("tooltip")).toHaveText("Checking your access. Try again in a moment.");
      await page.keyboard.press("Escape"); await expect(page.getByRole("tooltip")).toHaveCount(0);
      expect((await saved).ok()).toBeTruthy();
      await expect(page.locator(".group-verification")).toHaveCount(0, { timeout: 15000 });
      expect((await back.locator(".group-back-signals").boundingBox())!.y).toBeCloseTo(top, 1);
    }
    const samples = await page.evaluate(() => { const w = window as unknown as { mediaSamples: { count: number; noMedia: boolean }[]; stopMediaProbe(): void }; w.stopMediaProbe(); return w.mediaSamples; });
    expect(samples.length).toBeGreaterThan(1); expect(samples.every(s => s.count === 5 && !s.noMedia)).toBe(true);
  } finally { await page.unroute("**/personal-learning"); await reset(); }
});

test("read-only Group signals own mouse and touch gestures, explain permissions, and preserve outside flipping", async ({ page, browserName }) => {
  await login(page, "Aoife Kelly"); await selectPerspective(page, { perspective: "group" }); await openBack(page, true); await page.waitForTimeout(700);
  const back = page.locator(".focused-card-surface--back");
  await back.getByRole("button", { name: "Media Centre", exact: true }).click();
  await expect(centre(page).locator(".user-card-media-tile")).toHaveCount(8);
  await expect(centre(page).locator(".user-card-media-tile-origin").filter({ hasText: "By: Aoife Kelly" })).toHaveCount(3);
  await expect(centre(page).locator(".user-card-media-tile-origin").filter({ hasText: "By: phase2" })).toHaveCount(5);
  await expect(centre(page).getByRole("button", { name: /Remove image/ })).toHaveCount(3);
  const filenames = await centre(page).locator(".user-card-media-tile-name").allTextContents(); expect(new Set(filenames).size).toBe(8);
  await centre(page).getByRole("button", { name: "Close", exact: true }).click(); await expect(centre(page)).toHaveCount(0); await page.waitForTimeout(700);
  const writes: string[] = []; page.on("request", request => { if (/\/(personal|group)-learning$/.test(request.url()) && request.method() === "PATCH") writes.push(request.url()); });
  await dragSignal(page);
  await expect(page.getByRole("tooltip")).toHaveText("Only a Group Admin can change this value."); await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
  await page.keyboard.press("Escape"); await expect(page.getByRole("tooltip")).toHaveCount(0);
  await dragSignal(page); const outside = (await back.boundingBox())!; await page.mouse.click(outside.x + outside.width - 25, outside.y + outside.height - 25); await expect(page.getByRole("tooltip")).toHaveCount(0);
  if (browserName === "chromium") {
    const session = await page.context().newCDPSession(page); await session.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    const box = (await back.locator(".focused-card-signal-track").first().boundingBox())!, x = box.x + 20, y = box.y + box.height / 2;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    for (let i = 1; i <= 12; i++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 130 * i / 12, y, id: 1 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await session.detach();
    await expect(page.getByRole("tooltip")).toHaveText("Only a Group Admin can change this value.");
  } else await dragSignal(page);
  await expect(page.getByRole("tooltip")).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/); expect(writes).toEqual([]);
  const box = (await back.boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + box.height - 45); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height - 45, { steps: 12 }); await page.mouse.up();
  await expect(page.locator(".focused-card-object")).not.toHaveClass(/is-flipped/);
});

test("inspected member signals explain owner-only editing and clear the tooltip on perspective change", async ({ page }) => {
  await login(page); const people = await (await page.request.get(`/api/group-experiences/${fixture.experienceId}/perspectives`)).json();
  const subject = people.followers.find((p: { username: string }) => p.username === "Aoife Kelly");
  await selectPerspective(page, { perspective: "follower", subjectUserId: subject.userId }); await openBack(page, true); await page.waitForTimeout(700);
  await dragSignal(page); await expect(page.getByRole("tooltip")).toHaveText("Only this member can change this value.");
  await page.getByRole("button", { name: /Choose perspective/ }).click();
  await page.locator(".group-perspective-list").getByRole("button", { name: "Galway U18", exact: true }).click();
  await expect(page.getByRole("tooltip")).toHaveCount(0); await expect(page.locator("main.group-experience")).toHaveAttribute("data-perspective-key", "group");
});

test("Group settings remains Admin-only and opens without changing membership", async ({ page }) => {
  for (const user of ["Aoife Kelly", "phase2"]) {
    await login(page, user); await page.goto(`/decks?openExperience=${fixture.experienceId}`);
    await page.getByRole("button", { name: "Deck menu", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Group settings", exact: true })).toHaveCount(user === "phase2" ? 1 : 0);
    if (user === "phase2") { await page.getByRole("menuitem", { name: "Group settings", exact: true }).click(); await expect(page.getByRole("textbox", { name: "Group name", exact: true })).toHaveValue("Galway U18"); await page.getByRole("button", { name: "Cancel", exact: true }).click(); }
  }
});

test("read-only Group signal previews also intercept swipes outside Focused Card view", async ({ page }) => {
  await login(page, "Aoife Kelly"); await selectPerspective(page, { perspective: "group" }); await openBack(page, true, false); await page.waitForTimeout(700);
  const back = page.locator(".deck-card.is-active .deck-card-surface--back"), box = (await back.locator(".focused-card-signal-track").first().boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + 150, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
  await expect(page.getByRole("tooltip")).toHaveText("Only a Group Admin can change this value.");
  await expect(back).toHaveAttribute("aria-hidden", "false"); await expect(page.locator(".focused-card-layer")).toHaveCount(0);
});

test("visibility icons use equal tracks on own Group thumbnails, Centre metadata and both date faces", async ({ page }) => {
  await login(page, "Aoife Kelly"); await selectPerspective(page, { perspective: "self" }); await openBack(page, true); await page.waitForTimeout(700);
  const back = page.locator(".focused-card-surface--back");
  await expect(back.locator(".media-private-label svg")).toHaveCount(5);
  await expect(back.locator(".media-private-label .lucide-eye-off")).toHaveCount(2);
  await expect(back.locator(".media-private-label .lucide-eye")).toHaveCount(3);
  for (const face of ["front", "back"]) {
    await expect(page.locator(`.focused-card-surface--${face} .date-visibility-indicator .lucide-eye-off`)).toHaveCount(1);
    await expect(page.locator(`.focused-card-surface--${face} .deck-card-date-hit-zone`)).toHaveCount(0);
  }
  await back.getByRole("button", { name: "Media Centre", exact: true }).click();
  const modal = centre(page), tiles = modal.locator(".user-card-media-tile"); await expect(tiles).toHaveCount(8);
  expect(await modal.getByRole("list", { name: "Uploaded videos", exact: true }).evaluate(node => getComputedStyle(node).display)).toBe("flex");
  await expect(modal.locator(".media-centre-private-label svg")).toHaveCount(8);
  await expect(modal.locator(".media-centre-private-label .lucide-eye-off")).toHaveCount(5);
  await expect(modal.locator(".media-centre-private-label .lucide-eye")).toHaveCount(3);
  await expect(modal.locator(".user-card-media-tile-origin")).toHaveText(Array(8).fill("By: Aoife Kelly"));
  const positions = await tiles.evaluateAll(rows => rows.map(row => {
    const rect = (selector: string) => { const node = row.querySelector(selector); if (!node) return null; const b = node.getBoundingClientRect(); return { y: b.y, width: b.width, height: b.height }; };
    const icon = row.querySelector(".group-visibility-icon")!;
    return { icon: rect(".group-visibility-icon")!, name: rect(".user-card-media-tile-name")!, by: rect(".user-card-media-tile-origin")!, remove: rect(".user-card-media-tile-remove"), stroke: getComputedStyle(icon).strokeWidth };
  }));
  for (const row of positions) {
    expect(row.icon.width).toBeCloseTo(positions[0].icon.width, 2); expect(row.icon.height).toBeCloseTo(positions[0].icon.height, 2);
    expect(row.icon.y).toBeCloseTo(positions[0].icon.y, 2); expect(row.name.y).toBeCloseTo(positions[0].name.y, 2); expect(row.by.y).toBeCloseTo(positions[0].by.y, 2); expect(row.stroke).toBe("2px");
  }
  const removes = positions.flatMap(p => p.remove ? [p.remove.y] : []); expect(removes).toHaveLength(4); for (const y of removes) expect(y).toBeCloseTo(removes[0], 2);
  await modal.getByRole("button", { name: "Close", exact: true }).click(); await expect(modal).toHaveCount(0);
  await selectPerspective(page, { perspective: "group" }); await openBack(page, true); await expect(page.locator(".date-visibility-indicator")).toHaveCount(0);
  await openBack(page, false); await expect(page.locator(".group-visibility-icon")).toHaveCount(0);
});
