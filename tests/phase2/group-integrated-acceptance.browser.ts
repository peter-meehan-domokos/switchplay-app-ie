import { test, expect, type Page, type APIRequestContext, type APIResponse } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
const review = JSON.parse(process.env.PHASE11_REVIEW!), people = review.groupReview;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l5kAAAAASUVORK5CYII=", "base64");
async function json(response: Promise<Pick<APIResponse, "ok" | "status" | "text" | "json">>) { const r = await response; expect(r.ok(), `${r.status()} ${await r.text()}`).toBeTruthy(); return r.json(); }
async function login(page: Page, identifier: string) { await json(page.request.post("/api/auth/login", { data: { identifier, password: "local-test-only" } })); }
async function publish(request: APIRequestContext, deckId: string) {
  const current = await json(request.get(`/api/deck-templates/${deckId}`));
  for (const card of current.cards) if (card.root.latestVersion === 0) await json(request.patch(`/api/card-templates/${card.root.cardTemplateId}`, { data: { type: "publish", revision: card.root.revision } }));
  const revision = current.root.revision, publication = await json(request.get(`/api/deck-templates/${deckId}/publish?revision=${revision}`));
  await json(request.post(`/api/deck-templates/${deckId}/publish`, { data: { revision, review: publication, acceptCardDrafts: true, updateNote: "Add another basketball practice Card" } }));
}
async function publishedDeck(request: APIRequestContext) {
  const deckId = randomUUID(), cards = [randomUUID(), randomUUID()], steps = cards.map(() => [randomUUID(), randomUUID(), randomUUID()]);
  const contents = cards.map((cardTemplateId, i) => ({ cardTemplateId, content: { ...createDefaultCardContent(steps[i]), intro: { title: i ? "Finish the pass" : "Find your balance", description: null, mediaItem: null } } }));
  const content = { ...createDefaultDeckContent([]), title: "Court movement", categories: ["basketball"], cards: cards.map(cardTemplateId => ({ cardTemplateId })) };
  await json(request.post("/api/deck-templates", { data: { deckTemplateId: deckId, content, cards: contents } }));
  for (const card of contents) await json(request.patch(`/api/card-templates/${card.cardTemplateId}`, { data: { type: "save", revision: 0, content: card.content, visibility: "public" } }));
  await json(request.patch("/api/creator/session", { data: { deckTemplateId: deckId, revision: 0, content, visibility: "public" } }));
  await publish(request, deckId);
  const manifest = (await json(request.get(`/api/library/decks/${deckId}`))).manifest;
  return { deckId, cards, steps, content, manifest };
}
async function back(page: Page, experience: string, card: string, perspective = "group", subject?: string) {
  await page.goto(`/decks?${new URLSearchParams({ openExperience: experience, openCard: card, progressScene: "1", progressFocused: "1", progressFace: "back", progressPerspective: perspective, ...(subject ? { progressSubject: subject } : {}) })}`);
  await expect(page.locator(".focused-card-layer")).toBeVisible();
}
const note = (p: Page) => p.locator(".focused-card-surface--back .reflection-area p");
async function writeNote(page: Page, value: string) {
  await note(page).click(); const modal = page.getByRole("dialog", { name: "Edit reflection", exact: true });
  await modal.getByRole("textbox").fill(value); await modal.getByRole("button", { name: "Save", exact: true }).click(); await expect(modal).toHaveCount(0); await expect(note(page)).toHaveText(value);
}
async function upload(request: APIRequestContext, base: string, filename: string) {
  const allocated = await json(request.post(`${base}/media`, { data: { operationId: randomUUID(), accessEpoch: 0, version: 1, kind: "image", contentType: "image/png", size: png.length, originalFilename: filename, creationContext: "self" } }));
  expect((await request.put(allocated.uploadURL, { data: png, headers: allocated.headers })).ok()).toBeTruthy();
  await json(request.post(`${base}/media/${allocated.contributionId}/commit`, { data: { expectedRevision: allocated.revision, proof: allocated.proof } })); return allocated.contributionId as string;
}
function reflectionQuery(id: string, card: string, mode = "group") { return `/api/reflections?${new URLSearchParams({ experienceId: id, cardTemplateId: card, mode, accessEpoch: "0" })}`; }

test("club journey joins creation, learning, media, shared reflections, account changes and revocation", async ({ browser }, info) => {
  test.setTimeout(240000);
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ baseURL: review.baseURL, viewport: { width: 390, height: 844 } })));
  const [admin, member, second] = await Promise.all(contexts.map(c => c.newPage()));
  try {
    await login(admin, "phase2"); await login(member, "Aoife Kelly"); await login(second, "Alice");
    const deck = await publishedDeck(admin.request);
    await admin.goto(`/library/${deck.deckId}`); await admin.getByRole("button", { name: "Deck menu", exact: true }).click(); await admin.getByRole("menuitem", { name: "Add as Group", exact: true }).click();
    const create = admin.getByRole("dialog", { name: "Create Group", exact: true }); await create.getByLabel("Group name", { exact: true }).fill(`Galway U18 ${info.project.name}`);
    await create.getByLabel("Alice, Admin", { exact: true }).check(); await create.getByLabel("Aoife Kelly, Follower", { exact: true }).check(); await create.getByLabel("Bob, Follower", { exact: true }).check(); await create.getByRole("switch").check();
    const created = admin.waitForResponse(r => new URL(r.url()).pathname === "/api/group-experiences" && r.request().method() === "POST"); await create.getByRole("button", { name: "Create", exact: true }).click();
    const id = (await json(created)).experienceId;
    await expect(admin).toHaveURL(new RegExp(`createdGroup=${id}`));
    const base = `/api/group-experiences/${id}`, card = deck.cards[0], cardBase = `${base}/cards/${card}`;
    for (const [page, expected] of [[admin, "group"], [member, "self"], [second, "group"]] as const) {
      await page.goto(`/decks?openExperience=${id}`); await expect(page.locator(".group-experience")).toHaveAttribute("data-perspective-key", expected === "self" ? people.otherId : expected);
      const meta = await json(page.request.get(base)); expect(meta.isAdmin).toBe(expected === "group"); expect(meta.isFollower).toBe(expected === "self");
      if (page !== second) {
        await page.getByRole("button", { name: "Deck menu", exact: true }).click();
        await page.getByRole("menuitem", { name: "Progress", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/group-experiences/${id}/progress`));
        await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Back to Group Deck", exact: true }).click();
        await expect(page.locator(".group-experience")).toHaveAttribute("data-perspective-key", expected === "self" ? people.otherId : expected);
      }
    }
    const learning = async (page: Page, owner: string, change: unknown) => json(page.request.patch(`${cardBase}/${owner}-learning`, { data: { accessEpoch: 0, version: 1, change } }));
    await learning(admin, "group", { kind: "completion", stepId: deck.steps[0][0], completionStatus: "done" }); await learning(admin, "group", { kind: "signal", stepId: deck.steps[0][0], reading: 8 });
    expect((await json(member.request.get(`${cardBase}?perspective=group`))).learning.signalReadings[0].reading).toBe(8);
    await learning(member, "personal", { kind: "completion", stepId: deck.steps[0][0], completionStatus: "done" }); await learning(member, "personal", { kind: "signal", stepId: deck.steps[0][0], reading: 4 });
    await learning(member, "personal", { kind: "completion", stepId: deck.steps[0][1], completionStatus: "skipped" });
    const summary = await json(admin.request.get(`${base}/summary`)), first = summary.cards.find((r: { cardTemplateId: string }) => r.cardTemplateId === card);
    expect(first.group).toEqual({ completion: 33, confidence: 8 }); expect(first.followers).toMatchObject({ activeTotal: 2, doing: 1, done: 0, confidence: 4 });
    await back(member, id, card, "self"); await writeNote(member, "Our teammates helped me keep my balance today.");
    await back(admin, id, card); await expect(admin.locator(".reflection-member-area p")).toContainText("Aoife Kelly: Our teammates helped");
    const stale = (await json(second.request.get(reflectionQuery(id, card)))).collective;
    await writeNote(admin, "Our group communicated better during the passing drills today.");
    expect((await second.request.post("/api/reflections", { data: { action: "save", source: stale.source, text: "Stale draft", operationId: randomUUID(), expectedRevision: stale.revision, accessEpoch: 0 } })).status()).toBe(409);
    await back(second, id, card); await writeNote(second, "Our group improved its balance and passing together today.");
    await back(member, id, card); await note(member).click(); await expect(member.getByRole("dialog", { name: "View reflection" }).getByRole("button", { name: "Save", exact: true })).toHaveCount(0); await member.keyboard.press("Escape");
    expect((await json(admin.request.get(`${base}/summary`))).cards).toEqual(summary.cards);
    await back(member, id, card, "self"); await member.getByRole("button", { name: "Media Centre", exact: true }).click(); const centre = member.getByRole("dialog", { name: "Card media", exact: true });
    await centre.getByLabel("Choose image").setInputFiles({ name: "passing-practice.png", mimeType: "image/png", buffer: png }); await expect(centre.locator(".user-card-media-tile-name")).toHaveText("passing-practice.png"); await expect(centre.locator(".user-card-media-tile-origin")).toHaveText("By: Aoife Kelly"); await centre.getByRole("button", { name: "Close", exact: true }).click();
    const historyUrl = `/api/media/history?cardTemplateId=${card}&experienceId=${id}`, original = (await json(member.request.get(historyUrl))).items[0];
    await back(admin, id, card); await admin.getByRole("button", { name: "Media Centre", exact: true }).click(); const management = admin.getByRole("dialog", { name: "Card media", exact: true });
    await management.getByRole("button", { name: /Remove image/ }).click(); await expect(management.getByRole("status")).toHaveText("Removed from this Group. The creator still has their copy."); await management.getByRole("button", { name: "Close", exact: true }).click();
    const hidden = (await json(member.request.get(historyUrl))).items[0]; expect(hidden.source).toEqual(original.source); expect(hidden.private).toBe(true); expect(hidden.authorUserId).toBe(people.otherId); expect(hidden.originalFilename).toBe("passing-practice.png");
    expect((await member.request.get(`/api/group-media/${original.source.contributionId}`)).ok()).toBeTruthy(); expect((await json(admin.request.get(`${cardBase}/media`))).items).toHaveLength(0);
    await member.request.post("/api/auth/logout"); await login(member, "phase2"); await back(member, id, card); await expect(member.locator(".back-card-media-carousel button")).toHaveCount(0);
    await member.request.post("/api/auth/logout"); await login(member, "Aoife Kelly"); await back(member, id, card, "self"); await expect(member.locator(".focused-card-surface--back .lucide-eye-off")).toHaveCount(1);
    expect((await json(member.request.get(historyUrl))).items[0].source).toEqual(original.source);
    await admin.getByRole("button", { name: "Close focused card", exact: true }).click({ position: { x: 5, y: 5 } });
    await admin.getByRole("button", { name: "Deck menu", exact: true }).click(); await admin.getByRole("menuitem", { name: "Group settings", exact: true }).click(); const settings = admin.getByRole("dialog", { name: "Group settings", exact: true }); await settings.getByRole("switch").uncheck(); await settings.getByLabel("Alice, Admin", { exact: true }).uncheck(); await settings.getByLabel("Group name", { exact: true }).fill("Galway U18 team"); await settings.getByRole("button", { name: "Save", exact: true }).click(); await expect(settings).toHaveCount(0);
    expect((await second.request.get(base)).status()).toBe(403); expect((await member.request.get(`${cardBase}?perspective=follower&subjectUserId=${people.followers[2]}`)).status()).toBe(403);
    await member.reload(); expect((await json(member.request.get(base))).name).toBe("Galway U18 team"); await expect(note(member)).toHaveText("Our teammates helped me keep my balance today.");
    const meta = await json(admin.request.get(base)); await json(admin.request.post(`${base}/members`, { data: { operationId: randomUUID(), kind: "remove-follower", targetUserId: people.otherId, expectedStructureRevision: meta.structureRevision } }));
    expect((await member.request.get(base)).status()).toBe(403); expect((await member.request.patch(`${cardBase}/personal-learning`, { data: { accessEpoch: 0, version: 1, change: { kind: "signal", stepId: deck.steps[0][0], reading: 10 } } })).status()).toBe(403);
    const retained = await json(member.request.get(`/api/media/history?cardTemplateId=${card}`)); expect(retained.items[0].source).toEqual(original.source);
    const ownNotes = await json(member.request.get(`/api/reflections?cardTemplateId=${card}`)); expect(ownNotes.items.some((r: { entry: { text: string } }) => r.entry.text === "Our teammates helped me keep my balance today.")).toBe(true);
    const current = await json(admin.request.get(base)); await json(admin.request.post(`${base}/members`, { data: { operationId: randomUUID(), kind: "add-follower", targetUserId: people.otherId, expectedStructureRevision: current.structureRevision } }));
    const rejoined = await json(member.request.get(`${cardBase}?perspective=self`)); expect(rejoined.learning.signalReadings[0].reading).toBe(4); expect(rejoined.learning.items[1].completionStatus).toBe("skipped");
    expect((await json(member.request.get(historyUrl))).items[0].private).toBe(true);
    await json(member.request.delete(`/api/group-media/${original.source.contributionId}`, { data: { expectedRevision: hidden.revision } }));
  } finally { await Promise.allSettled(contexts.map(c => c.close())); }
});

test("published Deck adds a Card only after explicit non-creator Admin Group Update and preserves all existing state", async ({ browser }, info) => {
  test.setTimeout(240000);
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ baseURL: review.baseURL, viewport: { width: 390, height: 844 } })));
  const [publisher, admin, follower] = await Promise.all(contexts.map(c => c.newPage()));
  try {
    await login(publisher, "phase2"); await login(admin, "Alice"); await login(follower, "Aoife Kelly");
    const deck = await publishedDeck(publisher.request);
    const created = await json(admin.request.post("/api/group-experiences", { data: { name: "Galway U18 movement", operationId: randomUUID(), manifest: deck.manifest, adminIds: [], followerIds: [people.otherId] } }));
    const id = created.experienceId, base = `/api/group-experiences/${id}`, first = deck.cards[0], cardBase = `${base}/cards/${first}`;
    // Deck ownership is not Group authority: its creator is not a member here.
    expect((await publisher.request.get(base)).status()).toBe(403);
    await json(follower.request.post(`/api/library/decks/${deck.deckId}/add`, { data: { manifest: deck.manifest } }));
    await json(follower.request.get(`/api/decks-data/${deck.deckId}`));
    await json(follower.request.patch(`/api/decks-data/${deck.deckId}`, { data: { type: "target-date", cardTemplateId: first, targetDate: "2027-01-15" } }));
    await json(admin.request.patch(`${cardBase}/group-learning`, { data: { accessEpoch: 0, version: 1, change: { kind: "signal", stepId: deck.steps[0][0], reading: 7 } } }));
    await json(admin.request.patch(`${cardBase}/group-learning`, { data: { accessEpoch: 0, version: 1, change: { kind: "completion", stepId: deck.steps[0][0], completionStatus: "done" } } }));
    await json(follower.request.patch(`${cardBase}/personal-learning`, { data: { accessEpoch: 0, version: 1, change: { kind: "completion", stepId: deck.steps[0][0], completionStatus: "done" } } }));
    await back(follower, id, first, "self"); await writeNote(follower, "I kept my balance during our passing practice today.");
    await back(admin, id, first); await writeNote(admin, "Our group improved its passing rhythm throughout practice today.");
    const contribution = await upload(follower.request, cardBase, "footwork-practice.png");
    const ownerUrl = `/api/media/history?cardTemplateId=${first}&experienceId=${id}`;
    const lastBase = `${base}/cards/${deck.cards[1]}`;
    await json(follower.request.patch(`/api/decks-data/${deck.deckId}`, { data: { type: "target-date", cardTemplateId: deck.cards[1], targetDate: "2027-01-22" } }));
    for (const [page, owner, reading] of [[admin, "group", 3], [follower, "personal", 2]] as const) {
      await json(page.request.patch(`${lastBase}/${owner}-learning`, { data: { accessEpoch: 0, version: 1, change: { kind: "signal", stepId: deck.steps[1][0], reading } } }));
      await json(page.request.patch(`${lastBase}/${owner}-learning`, { data: { accessEpoch: 0, version: 1, change: { kind: "completion", stepId: deck.steps[1][0], completionStatus: "inProgress" } } }));
    }
    const lastCollective = (await json(admin.request.get(reflectionQuery(id, deck.cards[1])))).collective;
    await json(admin.request.post("/api/reflections", { data: { action: "save", source: lastCollective.source, text: "Our group communicated better while practising the final pass.", expectedRevision: 0, operationId: randomUUID(), accessEpoch: 0 } }));
    await json(follower.request.post("/api/reflections", { data: { action: "save", source: { kind: "group", experienceId: id, cardTemplateId: deck.cards[1], reflectionId: null }, text: "My passing improved after slowing down and finding space.", expectedRevision: 0, operationId: randomUUID(), accessEpoch: 0 } }));
    const lastContribution = await upload(follower.request, lastBase, "defensive-positioning.png");
    const lastBefore = { group: await json(admin.request.get(`${lastBase}?perspective=group`)), self: await json(follower.request.get(`${lastBase}?perspective=self`)),
      collective: (await json(admin.request.get(reflectionQuery(id, deck.cards[1])))).collective, notes: (await json(follower.request.get(reflectionQuery(id, deck.cards[1], "own")))).items,
      media: (await json(follower.request.get(`/api/media/history?cardTemplateId=${deck.cards[1]}&experienceId=${id}`))).items };
    const before = { owner: await json(follower.request.get(`/api/decks-data/${deck.deckId}`)), group: await json(admin.request.get(`${cardBase}?perspective=group`)),
      self: await json(follower.request.get(`${cardBase}?perspective=self`)), media: await json(follower.request.get(ownerUrl)),
      ownNotes: await json(follower.request.get(reflectionQuery(id, first, "own"))), collective: (await json(admin.request.get(reflectionQuery(id, first)))).collective };
    const addedId = randomUUID(), addedSteps = [randomUUID(), randomUUID(), randomUUID()];
    const root = await json(publisher.request.get(`/api/deck-templates/${deck.deckId}`));
    const content = { ...deck.content, cards: [{ cardTemplateId: first }, { cardTemplateId: addedId }, { cardTemplateId: deck.cards[1] }] };
    await json(publisher.request.post(`/api/deck-templates/${deck.deckId}/cards`, { data: { revision: root.root.revision, cardTemplateId: addedId, stepIds: addedSteps, content } }));
    const added = await json(publisher.request.get(`/api/card-templates/${addedId}`));
    await json(publisher.request.patch(`/api/card-templates/${addedId}`, { data: { type: "save", revision: added.root.revision, content: { ...createDefaultCardContent(addedSteps), intro: { title: "Control the landing", description: null, mediaItem: null } }, visibility: "public" } }));
    await publish(publisher.request, deck.deckId);
    for (const page of [admin, follower]) { const prior = await json(page.request.get(base)); expect(prior.deckVersion).toBe(1); expect(prior.cards.map((c: { cardTemplateId: string }) => c.cardTemplateId)).toEqual(deck.cards); }
    expect((await follower.request.get(`${base}/updates?kind=deck&entityId=${deck.deckId}&perspective=group`)).status()).toBe(403);
    await back(follower, id, first); await expect(follower.locator(".working-update-button")).toHaveCount(0);
    await back(admin, id, first, "follower", people.otherId); await expect(admin.locator(".working-update-button")).toHaveCount(0);
    await admin.goto(`/decks?openExperience=${id}`);
    // Explicit navigation chooses the Group perspective; a remembered inspection
    // must not gain Update merely because its viewer happens to be an Admin.
    const meta = await json(admin.request.get(base));
    await json(admin.request.patch(`${base}/navigation`, { data: { accessEpoch: meta.accessEpoch, expectedStructureRevision: meta.structureRevision, selection: { perspective: "group" }, activeCardId: deck.cards[1] } }));
    await admin.reload(); await expect(admin.locator(".group-experience")).toHaveAttribute("data-perspective-key", "group");
    const update = admin.getByRole("button", { name: "Update Court movement", exact: true }); await expect(update).toBeVisible();
    await update.click(); const dialog = admin.getByRole("dialog", { name: "Update Court movement", exact: true }); await expect(dialog).toContainText("Add another basketball practice Card");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); expect((await json(admin.request.get(base))).deckVersion).toBe(1);
    const submitted: unknown[] = [];
    await admin.route(`**${base}/updates`, async route => {
      if (route.request().method() !== "POST") return route.continue();
      submitted.push(route.request().postDataJSON());
      if (submitted.length === 1) {
        const committed = await route.fetch(); expect(committed.ok()).toBeTruthy();
        return route.fulfill({ status: 503, json: { error: "Simulated lost response after commit" } });
      }
      await route.continue();
    });
    await update.click(); await dialog.getByRole("button", { name: "Update", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Retry", exact: true }).click(); await expect(dialog).toHaveCount(0);
    expect(submitted).toHaveLength(2); expect(submitted[1]).toEqual(submitted[0]);
    for (const page of [admin, follower]) {
      await page.reload(); const after = await json(page.request.get(base)); expect(after.experienceId).toBe(id); expect(after.deckVersion).toBe(2);
      expect(after.cards.map((c: { cardTemplateId: string }) => c.cardTemplateId)).toEqual([first, addedId, deck.cards[1]]);
      if (page === admin) { expect(after.activeCardId).toBe(deck.cards[1]); await expect(page.locator(".group-experience")).toHaveAttribute("data-current-card", deck.cards[1]); }
    }
    for (const [page, perspective, prior] of [[admin, "group", before.group], [follower, "self", before.self]] as const) {
      const old = await json(page.request.get(`${cardBase}?perspective=${perspective}`)); expect(old.learning).toEqual(prior.learning); expect(old.capabilities).toEqual(prior.capabilities); expect(old.content).toEqual(prior.content);
      const fresh = await json(page.request.get(`${base}/cards/${addedId}?perspective=${perspective}`));
      expect(fresh.learning.items.map((v: { completionStatus: string }) => v.completionStatus)).toEqual(["todo", "todo", "todo"]);
      expect(fresh.learning.signalReadings.map((v: { reading: number | null }) => v.reading)).toEqual([null, null, null]);
    }
    expect((await json(admin.request.get(`${base}/summary`))).group).toEqual({ completion: 11, confidence: 5 });
    expect((await json(admin.request.get(`${lastBase}?perspective=group`))).learning).toEqual(lastBefore.group.learning);
    expect((await json(follower.request.get(`${lastBase}?perspective=self`))).learning).toEqual(lastBefore.self.learning);
    expect((await json(admin.request.get(reflectionQuery(id, deck.cards[1])))).collective).toEqual(lastBefore.collective);
    expect((await json(follower.request.get(reflectionQuery(id, deck.cards[1], "own")))).items).toEqual(lastBefore.notes);
    expect((await json(follower.request.get(`/api/media/history?cardTemplateId=${deck.cards[1]}&experienceId=${id}`))).items).toEqual(lastBefore.media);
    expect((await json(follower.request.get(`/api/decks-data/${deck.deckId}`))).cards).toEqual(before.owner.cards);
    expect((await json(follower.request.get(ownerUrl))).items).toEqual(before.media.items);
    expect((await json(follower.request.get(reflectionQuery(id, first, "own")))).items).toEqual(before.ownNotes.items);
    expect((await json(admin.request.get(reflectionQuery(id, first)))).collective).toEqual(before.collective);
    expect((await json(admin.request.get(reflectionQuery(id, addedId)))).collective).toMatchObject({ text: "", revision: 0 });
    await back(admin, id, addedId); await expect(note(admin)).toHaveText("Add a reflection...");
    await follower.request.post("/api/auth/logout"); await login(follower, "Aoife Kelly"); await back(follower, id, addedId, "self"); await expect(note(follower)).toHaveText("Add a reflection...");
    await expect(follower.locator(".focused-card-surface--back .back-card-media-carousel button")).toHaveCount(0);
    await admin.screenshot({ path: `/private/tmp/phase11-added-card-${info.project.name}.png` });
    // Card Update uses the same Admin-only Group surface, without adopting the
    // Card for Personal Decks or changing the already adopted Deck version.
    const oldRoot = await json(publisher.request.get(`/api/card-templates/${first}`));
    await json(publisher.request.patch(`/api/card-templates/${first}`, {
      data: {
        type: "save", revision: oldRoot.root.revision,
        content: { ...createDefaultCardContent(deck.steps[0]), intro: { title: "Find your balance", description: "Keep your weight balanced.", mediaItem: null } },
      },
    }));
    await json(publisher.request.patch(`/api/card-templates/${first}`, { data: { type: "publish", revision: oldRoot.root.revision + 1, updateNote: "Refine the balance instructions" } }));
    await admin.goto(`/decks?${new URLSearchParams({ openExperience: id, openCard: first, progressScene: "1", progressFocused: "1", progressFace: "front", progressPerspective: "group" })}`);
    const cardUpdate = admin.locator(".focused-card-surface--front").getByRole("button", { name: "Update Find your balance", exact: true });
    await expect(cardUpdate).toBeVisible(); await cardUpdate.click();
    const cardDialog = admin.getByRole("dialog", { name: "Update Find your balance", exact: true });
    await cardDialog.getByRole("button", { name: "Update", exact: true }).click(); await expect(cardDialog).toHaveCount(0);
    const selected = await json(admin.request.get(base)); expect(selected.deckVersion).toBe(2);
    expect(selected.cards.find((c: { cardTemplateId: string }) => c.cardTemplateId === first).version).toBe(2);
    const changed = await json(admin.request.get(`${cardBase}?perspective=group`));
    expect(changed.learning.items).toEqual(before.group.learning.items); expect(changed.learning.signalReadings).toEqual(before.group.learning.signalReadings);
    const personal = await json(follower.request.get(`/api/decks-data/${deck.deckId}`)); expect(personal.adoptedVersion).toBe(1); expect(personal.cards[0].adoptedVersion).toBe(1);
    const lastOwned = (await json(follower.request.get(`/api/media/history?cardTemplateId=${deck.cards[1]}&experienceId=${id}`))).items.find((i: { source: { contributionId?: string } }) => i.source.contributionId === lastContribution);
    await json(follower.request.delete(`/api/group-media/${lastContribution}`, { data: { expectedRevision: lastOwned.revision } }));
    const owned = (await json(follower.request.get(ownerUrl))).items.find((i: { source: { contributionId?: string } }) => i.source.contributionId === contribution);
    await json(follower.request.delete(`/api/group-media/${contribution}`, { data: { expectedRevision: owned.revision } }));
  } finally { await Promise.allSettled(contexts.map(c => c.close())); }
});
