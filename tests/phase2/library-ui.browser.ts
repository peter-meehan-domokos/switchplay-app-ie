import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { deckDraftContent } from "../../src/lib/cards/publicationRules";
import { geometry } from "./helpers/presentationGeometry";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
async function fixture(count = 2, title = `Library programme ${randomUUID()}`) {
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), owner = process.env.PHASE2_USER_ID!;
  const viewer = (await repo.db.collection("users").findOne({ username: "other" }))!._id.toString();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const c = await repo.createCardDraft(owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]),
      intro: { title: `Library practice ${i + 1} ${randomUUID()}`, description: "Canonical instruction", mediaItem: null },
      steps: [0, 1, 2].map((index) => ({ stepId: randomUUID(), title: `Activity ${index + 1}`, description: `Instruction ${index + 1}`, mediaItem: null })) }, "public");
    await repo.publishCard(owner, c.cardTemplateId, 0); ids.push(c.cardTemplateId);
  }
  const d = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title, cards: ids.map((cardTemplateId) => ({ cardTemplateId })) }, "public");
  await repo.publishDeck(owner, d.deckTemplateId, 0);
  return { repo, owner, viewer, id: d.deckTemplateId, ids, title: d.draft!.title };
}
async function login(page: Page, username = "other") {
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).ok()).toBeTruthy();
}
async function detail(page: Page, id: string) {
  await page.goto(`/library/${id}`); await expect(page.getByRole("button", { name: /^(Add to|Open in|Restore to) My Decks$/ })).toBeEnabled();
}
async function focus(page: Page) {
  await page.locator(".deck-card.is-active").press("Enter"); await expect(page.locator(".focused-card-stage")).toBeVisible();
}
async function nextCard(page: Page) {
  const selector = ".focused-card-surface--front .card-title-anchor";
  const rect = (await geometry(page, [selector]))[selector];
  await page.mouse.move(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2);
  await page.mouse.down(); await page.mouse.move(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2 + 170, { steps: 12 }); await page.mouse.up();
  await expect(page.locator(".focused-card-surface--front .active-card-identity").last()).toContainText("Library practice 2");
  await expect(page.locator(".focused-card-surface--front .active-card-identity")).toHaveCount(1);
}

test("Library owner Edit opens the same Creator identity without membership and publishes the next immutable version", async ({ page }) => {
  const { repo, owner, viewer, id, ids, title } = await fixture(1);
  const before = await repo.getPersonalUser(owner), otherBefore = await repo.getPersonalUser(viewer);
  const version = await repo.getDeckVersion(id, 1);
  await login(page, "phase2"); await detail(page, id);
  await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  const edit = page.getByRole("menuitem", { name: "Edit", exact: true });
  await expect(edit).toHaveAttribute("href", `/creator/edit/${id}?returnTo=library`); await edit.click();
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}\\?returnTo=library$`));
  await expect(page.getByRole("button", { name: "Edit deck title and introduction" })).toContainText(title);
  await expect(page.locator(`.creator-column[data-card-template-id="${ids[0]}"]`)).toBeVisible();
  expect(await repo.getPersonalUser(owner)).toEqual(before);
  await page.getByRole("button", { name: "Edit deck title and introduction" }).click();
  const nextTitle = `Edited Library programme ${randomUUID()}`;
  await page.locator(".creator-modal textarea").fill(nextTitle);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await repo.decks().findOne({ deckTemplateId: id }))?.draft?.title).toBe(nextTitle);
  const publish = page.getByRole("button", { name: "Publish Deck", exact: true });
  await expect(publish).toBeEnabled(); await publish.click(); await expect(publish).toHaveText("Published");
  expect((await repo.decks().findOne({ deckTemplateId: id }))!.forkedFrom).toBeNull();
  expect((await repo.getDeckVersion(id, 2))!.content.cards.map((card) => card.cardTemplateId)).toEqual(ids);
  expect(await repo.getDeckVersion(id, 1)).toEqual(version);
  expect(await repo.deckVersions().countDocuments({ deckTemplateId: id })).toBe(2);
  expect(await repo.cardVersions().countDocuments({ cardTemplateId: ids[0] })).toBe(1);
  expect(await repo.getPersonalUser(owner)).toEqual(before);
  expect(await repo.getPersonalUser(viewer)).toEqual(otherBefore);
  await expect(page.locator(".creator-back-link")).toHaveAttribute("href", "/library");
  await page.locator(".creator-back-link").click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("dialog", { name: "Leave Creator confirmation" })).toHaveCount(0);
});

for (const origin of ["library", "my-decks"] as const) test(`${origin} Creator return retains origin across autosave/reload, waits for saves and preserves Cancel/Publish and leave`, async ({ page }) => {
  const { repo, owner, id } = await fixture(1);
  if (origin === "my-decks") await repo.ensureDeckData(owner, id, 1);
  await login(page, "phase2");
  const enter = async () => {
    if (origin === "library") await detail(page, id);
    else { await page.goto(`/decks?openDeck=${id}`); await expect(page.locator(".deck-detail h1")).toBeVisible(); }
    await page.getByRole("button", { name: "Deck menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit deck title and introduction" })).toBeVisible();
  };
  const returnHref = origin === "library" ? "/library" : `/decks?openDeck=${id}`;
  const expectReturned = async () => {
    await expect(page).toHaveURL(origin === "library" ? /\/library$/ : new RegExp(`/decks\\?openDeck=${id}$`));
  };
  const editTitle = async (value: string) => {
    await page.getByRole("button", { name: "Edit deck title and introduction" }).click();
    await page.locator(".creator-modal textarea").fill(value);
    await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  };
  await enter();
  await expect(page.locator(".creator-back-link")).toHaveAttribute("href", returnHref);
  let release!: () => void, started = false;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/deck-templates/${id}/saved`, async (route) => { started = true; await pending; await route.continue(); }, { times: 1 });
  try {
    await editTitle(`Saved programme ${randomUUID()}`);
    await expect.poll(() => started).toBe(true);
    await page.locator(".creator-back-link").click();
    await expect(page.locator(".creator-navigation-status")).toContainText("Finishing saves and uploads");
    await expect(page.getByRole("dialog", { name: "Leave Creator confirmation" })).toHaveCount(0);
  } finally { release(); }
  const leave = page.getByRole("dialog", { name: "Leave Creator confirmation" });
  await leave.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(leave).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(origin === "library" ? "library" : "deck");
  await page.reload();
  await expect(page.locator(".creator-back-link")).toHaveAttribute("href", returnHref);
  await page.locator(".creator-back-link").click();
  await leave.getByRole("button", { name: "Leave without publishing", exact: true }).click();
  await expectReturned();
  expect((await repo.decks().findOne({ deckTemplateId: id }))!.latestVersion).toBe(1);
  await enter();
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  const added = page.locator(".creator-column[data-card-template-id]").last();
  await added.locator(".creator-card-title-button").click();
  await page.locator(".creator-modal textarea").fill("New public practice");
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await added.getByRole("combobox", { name: "Card 2 publication visibility" }).selectOption("public");
  const cardId = (await added.getAttribute("data-card-template-id"))!;
  const publicConfirmation = page.getByRole("dialog", { name: "Confirm public publication" });
  await page.locator(".creator-back-link").click();
  await leave.getByRole("button", { name: "Publish and leave", exact: true }).click();
  await expect(publicConfirmation).toContainText("1 Card and 0 Decks");
  await publicConfirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(publicConfirmation).toHaveCount(0);
  await expect(page.locator(".creator-back-link")).toHaveAttribute("href", returnHref);
  expect((await repo.cards().findOne({ cardTemplateId: cardId }))!.latestVersion).toBe(0);
  await page.locator(".creator-back-link").click();
  await leave.getByRole("button", { name: "Publish and leave", exact: true }).click();
  await publicConfirmation.getByRole("button", { name: "Publish publicly", exact: true }).click();
  await expectReturned();
  expect((await repo.cards().findOne({ cardTemplateId: cardId }))!.latestVersion).toBe(1);
  expect((await repo.decks().findOne({ deckTemplateId: id }))!.latestVersion).toBe(2);
});

test("Library-origin Creator stays on failed saves; direct Creator entry retains its normal My Decks return", async ({ page }) => {
  const { id } = await fixture(0); await login(page, "phase2"); await detail(page, id);
  await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await page.route(`**/api/deck-templates/${id}/saved`, (route) => route.fulfill({ status: 400, json: { code: "INVALID_CONTENT" } }));
  await page.getByRole("button", { name: "Edit deck title and introduction" }).click();
  await page.locator(".creator-modal textarea").fill("Unsaved local work");
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry Save Deck", exact: true })).toBeVisible();
  await page.locator(".creator-back-link").click();
  await expect(page.getByText("Current work could not be saved. Review the save or upload errors before leaving.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}\\?returnTo=library$`));
  await expect(page.getByRole("dialog", { name: "Leave Creator confirmation" })).toHaveCount(0);
  await page.unroute(`**/api/deck-templates/${id}/saved`);
  await page.getByRole("button", { name: "Retry Save Deck", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry Save Deck", exact: true })).toHaveCount(0);
  await page.locator(".creator-back-link").click();
  await page.getByRole("dialog", { name: "Leave Creator confirmation" }).getByRole("button", { name: "Leave without publishing", exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  await page.goto(`/creator/edit/${id}`);
  await expect(page.locator(".creator-back-link")).toHaveAttribute("href", "/decks");
  await page.locator(".creator-back-link").click();
  await page.getByRole("dialog", { name: "Leave Creator confirmation" }).getByRole("button", { name: "Leave without publishing", exact: true }).click();
  await expect(page).toHaveURL(/\/decks$/);
});

test("Library does not offer Edit to a non-owner or an owner whose current Creator composition contains foreign Cards", async ({ page }) => {
  const { repo, owner, viewer, id, ids } = await fixture(1);
  await login(page); await detail(page, id);
  await expect(page.getByRole("button", { name: "Deck menu", exact: true })).toHaveCount(0);
  const foreign = await repo.createCardDraft(viewer, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]),
    intro: { title: "Another creator's practice", description: null, mediaItem: null } }, "public");
  await repo.publishCard(viewer, foreign.cardTemplateId, 0);
  const mixed = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "Owned Deck with a shared Card",
    cards: [{ cardTemplateId: foreign.cardTemplateId }] }, "public"); await repo.publishDeck(owner, mixed.deckTemplateId, 0);
  await login(page, "phase2"); await detail(page, mixed.deckTemplateId);
  await expect(page.getByRole("button", { name: "Deck menu", exact: true })).toHaveCount(0);
  // A foreign reference in an unpublished draft must also suppress Edit, even
  // though the Library correctly continues showing the all-owned publication.
  await repo.saveDeckDraft(owner, id, 1, { ...deckDraftContent((await repo.getDeckVersion(id, 1))!.content),
    cards: [...ids.map((cardTemplateId) => ({ cardTemplateId })), { cardTemplateId: foreign.cardTemplateId }] });
  await detail(page, id);
  await expect(page.getByRole("button", { name: "Deck menu", exact: true })).toHaveCount(0);
  expect((await page.request.get(`/api/deck-templates/${id}`)).ok()).toBe(false);
});

test("Library owner Edit opens an empty public Deck without creating membership or Cards", async ({ page }) => {
  const { repo, owner, id } = await fixture(0);
  const before = await repo.getPersonalUser(owner);
  await login(page, "phase2"); await detail(page, id);
  await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${id}\\?returnTo=library$`));
  await expect(page.getByRole("button", { name: "Add card", exact: true })).toBeVisible();
  await expect(page.locator(".creator-column[data-card-template-id]")).toHaveCount(0);
  expect(await repo.getPersonalUser(owner)).toEqual(before);
});

test("Library collection and full preview share presentation and never mount a personal layer or issue personal writes", async ({ page }) => {
  const { repo, viewer, id, ids, title } = await fixture(); await repo.ensureDeckData(viewer, id, 1);
  await repo.users().updateOne({ _id: new ObjectId(viewer) }, { $set: { "cardsData.$[card].reflection": "SECRET REFLECTION", "cardsData.$[card].targetDate": "2032-12-31" } }, { arrayFilters: [{ "card.cardTemplateId": ids[0] }] });
  const before = await repo.getPersonalUser(viewer); await login(page);
  const mutations: string[] = [], personalReads: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") && request.method() !== "GET") mutations.push(`${request.method()} ${url.pathname}`);
    if (/\/personal-history|\/api\/cards-data|\/api\/decks-data/.test(url.pathname)) personalReads.push(url.pathname);
  });
  await page.goto("/library"); await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Open ${title}`, exact: true }).last().click();
  await expect(page.locator(".deck-detail h1")).toHaveText(title); await focus(page);
  await page.locator(".focused-card-surface--front .active-step-item").first().press("Enter");
  await expect(page.locator(".step-view-layer")).toBeVisible();
  await page.getByRole("button", { name: "Close step view" }).click();
  await nextCard(page);
  await expect(page.locator(".focused-card-surface--front .active-card-identity")).toContainText("Library practice 2");
  await expect(page.locator(".focused-card-surface--back, button.step-progress-hit-area, .completion-strip-fill, .signal-editor")).toHaveCount(0);
  await expect(page.getByText("SECRET REFLECTION")).toHaveCount(0);
  await expect(page.locator(".focused-card-surface--front .card-creator-attribution")).toHaveText("phase2");
  expect(mutations).toEqual([]); expect(personalReads).toEqual([]);
  expect(await repo.getPersonalUser(viewer)).toEqual(before);
});

test("Add stays in Library, pins personal records unopened, then Open runs normal first-open initialization", async ({ page }) => {
  const { repo, viewer, id, ids } = await fixture(); await login(page); await detail(page, id);
  await expect(page.getByRole("button", { name: "Open Card in My Decks" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add to My Decks", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open in My Decks", exact: true })).toBeEnabled(); expect(page.url()).toContain(`/library/${id}`);
  const user = (await repo.getPersonalUser(viewer))!, data = user.decksData.find((item) => item.deckTemplateId === id)!;
  expect(data.openedAt).toBeNull(); expect(data.cadenceAnchorDate).toBeNull();
  expect(user.cardsData.filter((item) => ids.includes(item.cardTemplateId)).every((item) => item.targetDate === null)).toBeTruthy();
  // The route changes before AppShell finishes its separate first-open request.
  // Assert initialization only after that exact working operation commits.
  const workingOpen = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/decks-data"
    && response.request().method() === "POST" && response.request().postDataJSON()?.deckTemplateId === id);
  await page.getByRole("button", { name: "Open in My Decks", exact: true }).click();
  expect((await workingOpen).ok()).toBeTruthy();
  await expect(page.locator(".deck-detail h1")).toBeVisible(); await expect(page).toHaveURL(new RegExp(`/decks\\?openDeck=${id}`));
  const opened = (await repo.getPersonalUser(viewer))!.decksData.find((item) => item.deckTemplateId === id)!;
  expect(opened.openedAt).not.toBeNull(); expect(opened.cadenceAnchorDate).not.toBeNull();
});

test("Restore stays in Library and preserves older adopted composition and learning state", async ({ page }) => {
  const { repo, owner, viewer, id, ids } = await fixture(); await repo.ensureDeckData(viewer, id, 1); await repo.archiveDeckData(viewer, id);
  const old = (await repo.getPersonalUser(viewer))!;
  const content = deckDraftContent((await repo.getDeckVersion(id, 1))!.content);
  await repo.saveDeckDraft(owner, id, 1, { ...content, title: "Latest canonical programme", cards: [] }); await repo.publishDeck(owner, id, 2);
  await login(page); await detail(page, id); await page.getByRole("button", { name: "Restore to My Decks", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open in My Decks", exact: true })).toBeEnabled(); expect(page.url()).toContain(`/library/${id}`);
  const user = (await repo.getPersonalUser(viewer))!, data = user.decksData.find((item) => item.deckTemplateId === id)!;
  expect(data.deckTemplateVersion).toBe(1); expect(data.archivedAt).toBeNull(); expect(data.openedAt).toBeNull(); expect(data.cadenceAnchorDate).toBeNull();
  expect(user.cardsData.filter((item) => ids.includes(item.cardTemplateId))).toEqual(old.cardsData.filter((item) => ids.includes(item.cardTemplateId)));
});

for (const kind of ["Card", "Deck"] as const) test(`stale ${kind} preview blocks Add; Cancel keeps preview, Refresh restarts at first Card`, async ({ page }) => {
  const { repo, owner, viewer, id, ids } = await fixture(); await login(page); await detail(page, id); await focus(page); await nextCard(page);
  await expect(page.locator(".focused-card-surface--front .active-card-identity")).toContainText("Library practice 2");
  await page.getByRole("button", { name: "Close focused card" }).click({ position: { x: 4, y: 4 } });
  if (kind === "Card") { const old = (await repo.getCardVersion(ids[0], 1))!.content; await repo.saveCardDraft(owner, ids[0], 1, { ...old, intro: { ...old.intro, title: "Fresh published Card" } }); await repo.publishCard(owner, ids[0], 2); }
  else { const old = deckDraftContent((await repo.getDeckVersion(id, 1))!.content); await repo.saveDeckDraft(owner, id, 1, { ...old, title: "Fresh published Deck" }); await repo.publishDeck(owner, id, 2); }
  await page.getByRole("button", { name: "Add to My Decks", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Preview has changed" })).toBeVisible();
  expect((await repo.getPersonalUser(viewer))!.decksData.some((item) => item.deckTemplateId === id)).toBe(false);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Library practice 2");
  await page.getByRole("button", { name: "Add to My Decks", exact: true }).click();
  await page.getByRole("button", { name: "Refresh preview", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText(kind === "Card" ? "Fresh published Card" : "Library practice 1");
  await page.getByRole("button", { name: "Add to My Decks", exact: true }).click(); await expect(page.getByRole("button", { name: "Open in My Decks", exact: true })).toBeEnabled();
});

test("one exact Card destination opens directly at adopted version and initializes a never-opened Deck", async ({ page }) => {
  const { repo, owner, viewer, id, ids } = await fixture(); await repo.ensureDeckData(viewer, id, 1);
  const old = (await repo.getCardVersion(ids[0], 1))!.content;
  await repo.saveCardDraft(owner, ids[0], 1, { ...old, intro: { ...old.intro, title: "New Library-only Card v2" } }); await repo.publishCard(owner, ids[0], 2);
  await login(page); await detail(page, id); await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("New Library-only Card v2");
  await focus(page); await nextCard(page); await expect(page.locator(".focused-card-surface--front .active-card-identity")).toContainText("Library practice 2");
  await page.getByRole("button", { name: "Open Card in My Decks", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/decks\\?openDeck=${id}`)); await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Library practice 2");
  let data = (await repo.getPersonalUser(viewer))!.decksData.find((item) => item.deckTemplateId === id)!;
  expect(data.activeCardId).toBe(ids[1]); expect(data.cadenceAnchorDate).not.toBeNull();
  await page.reload(); await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Library practice 2");
  expect((await repo.getPersonalUser(viewer))!.decksData.find((item) => item.deckTemplateId === id)!.cadenceAnchorDate).toBe(data.cadenceAnchorDate);
  await detail(page, id); await page.getByRole("button", { name: "Open Card in My Decks", exact: true }).click();
  await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText(old.intro.title!);
  expect((await repo.getPersonalUser(viewer))!.cardsData.find((item) => item.cardTemplateId === ids[0])!.cardTemplateVersion).toBe(1);
  await detail(page, id); await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("New Library-only Card v2");
  data = (await repo.getPersonalUser(viewer))!.decksData.find((item) => item.deckTemplateId === id)!; expect(data.activeCardId).toBe(ids[0]);
});

test("multiple exact Card destinations are distinguished; stale chooser never restores an archived destination", async ({ page }) => {
  const { repo, owner, viewer, id, ids, title } = await fixture(); await repo.ensureDeckData(viewer, id, 1);
  const second = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title, introduction: { video: null, image: { id: "cover", description: "Programme cover", mediaType: "image", provider: "cloudflare-r2", assetId: "destination-cover", src: "https://example.invalid/destination-cover.png" } }, cards: [{ cardTemplateId: ids[0] }] }, "public");
  await repo.publishDeck(owner, second.deckTemplateId, 0); await repo.ensureDeckData(viewer, second.deckTemplateId, 1);
  await login(page); await detail(page, id); await page.getByRole("button", { name: "Open Card in My Decks", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "Open Card in My Decks" }); await expect(chooser).toBeVisible(); await expect(chooser.locator(".library-destination")).toHaveCount(2);
  await expect(chooser.locator(".library-destination small").first()).toHaveText("phase2");
  await expect(chooser.locator(".library-destination-cover")).toHaveCount(1);
  await repo.archiveDeckData(viewer, second.deckTemplateId);
  await chooser.locator(`[data-deck-template-id="${second.deckTemplateId}"]`).click();
  await expect(page.locator(".library-error")).toContainText("no longer available"); expect(page.url()).toContain(`/library/${id}`);
  await page.getByRole("button", { name: "Open Card in My Decks", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/decks\\?openDeck=${id}`));
  expect((await repo.getPersonalUser(viewer))!.decksData.find((item) => item.deckTemplateId === second.deckTemplateId)!.archivedAt).not.toBeNull();
});

test("retained CardData without active membership hides Open Card; empty and broken public Decks remain safe", async ({ page }) => {
  const { repo, viewer, id } = await fixture(); await repo.ensureDeckData(viewer, id, 1); await repo.archiveDeckData(viewer, id);
  await login(page); await detail(page, id); await expect(page.getByRole("button", { name: "Open Card in My Decks" })).toHaveCount(0);
  const empty = await fixture(0); await detail(page, empty.id); await expect(page.locator(".deck-card, .deck-scene-frame")).toHaveCount(0);
  await page.getByRole("button", { name: "Add to My Decks", exact: true }).click(); await expect(page.getByRole("button", { name: "Open in My Decks" })).toBeEnabled();
  await empty.repo.deckVersions().updateOne({ deckTemplateId: empty.id, version: 1 }, { $set: { "content.cards": [{ cardTemplateId: "missing-private-content" }] } });
  await page.goto(`/library/${empty.id}`); await expect(page.getByRole("heading", { name: "Unavailable Deck" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to My Decks" })).toHaveCount(0);
  await page.goto("/library"); await expect(page.getByRole("link", { name: "Unavailable Deck" }).last()).toBeVisible();
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) test(`Library and My Decks retain shared visible geometry ${viewport.width}`, async ({ page }, info) => {
  const { repo, viewer, id } = await fixture(2, `Presentation ${viewport.width}`); await repo.ensureDeckData(viewer, id, 1); await page.setViewportSize(viewport); await login(page);
  await page.goto(`/decks?openDeck=${id}`); await expect(page.locator(".deck-card.is-active")).toBeVisible();
  const selectors = [".deck-scene-frame", ".deck-card.is-active", ".deck-card.is-active .active-card-identity", ".deck-card.is-active .active-step-list"];
  const working = await geometry(page, selectors); await focus(page);
  const focusedSelectors = [".focused-card-stage", ".focused-card-object", ".focused-card-surface--front .active-card-identity", ".focused-card-surface--front .active-step-list"];
  const focused = await geometry(page, focusedSelectors);
  await detail(page, id); const canonical = await geometry(page, selectors); await focus(page); const canonicalFocused = await geometry(page, focusedSelectors);
  await info.attach("geometry", { body: JSON.stringify({ working, focused, canonical, canonicalFocused }), contentType: "application/json" });
  for (const [left, right] of [[canonical, working], [canonicalFocused, focused]]) for (const [selector, rect] of Object.entries(left)) rect.forEach((value, index) => expect(Math.abs(value - right[selector][index]), `${selector} coordinate ${index}`).toBeLessThanOrEqual(1));
  await page.screenshot({ path: info.outputPath(`library-${viewport.width}.png`) });
});

test("published instructional video status is authorized and lazy; browsing idle tiles never probes Stream", async ({ page }) => {
  const { repo, owner, id, ids } = await fixture();
  const video = { id: "library-video", description: "Instructional video", mediaType: "video" as const, provider: "cloudflare-stream" as const,
    assetId: "phase2-library-video", src: "https://videodelivery.net/phase2-library-video/manifest/video.m3u8", width: 1280, height: 720 };
  const old = (await repo.getCardVersion(ids[0], 1))!.content;
  await repo.saveCardDraft(owner, ids[0], 1, { ...old, intro: { ...old.intro, mediaItem: video } }); await repo.publishCard(owner, ids[0], 2);
  const content = deckDraftContent((await repo.getDeckVersion(id, 1))!.content);
  await repo.saveDeckDraft(owner, id, 1, { ...content, introduction: { image: null, video } }); await repo.publishDeck(owner, id, 2);
  const statusRequests: string[] = [];
  await page.route("**/api/library/media/stream-status?**", async (route) => {
    statusRequests.push(route.request().url());
    await route.fulfill({ json: { status: "processing" } });
  });
  await login(page); await page.goto("/library"); await expect(page.locator(".deck-grid")).toBeVisible();
  expect(statusRequests).toEqual([]); await detail(page, id); expect(statusRequests).toEqual([]);
  await page.getByRole("button", { name: `Play introduction video for ${content.title}` }).click();
  await expect(page.getByRole("status")).toContainText("Preparing video");
  expect(statusRequests[0]).toContain("kind=deck"); expect(statusRequests[0]).toContain(`templateId=${id}`); expect(statusRequests[0]).toContain("version=2");
  await page.goto(`/library/${id}`); await focus(page);
  await page.locator(".focused-card-surface--front .active-card-identity").press("Enter");
  await expect.poll(() => statusRequests.some((url) => url.includes("kind=card") && url.includes(ids[0]) && url.includes("version=2"))).toBeTruthy();
  const url = `/api/library/media/stream-status?kind=card&templateId=${ids[0]}&version=2&assetId=arbitrary-uid`;
  expect((await page.request.get(url)).status()).toBe(403);
});

test("a delayed viewer-status response cannot install another account's actions", async ({ page }) => {
  const { repo, viewer, id } = await fixture(); await repo.ensureDeckData(viewer, id, 1); await login(page);
  let release!: () => void, captured!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; }), ready = new Promise<void>((resolve) => { captured = resolve; });
  await page.route("**/api/library/viewer-status?**", async (route) => {
    const response = await route.fetch(); captured(); await held; await route.fulfill({ response });
  });
  await page.goto(`/library/${id}`); await ready;
  await login(page, "phase2"); release();
  await expect(page.getByRole("button", { name: "Add to My Decks", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Open Card in My Decks", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open in My Decks", exact: true })).toHaveCount(0);
});

test("Library is authenticated and private content is unavailable even to its owner on the Library surface", async ({ page }) => {
  const { repo, owner } = await fixture(0);
  const privateDeck = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "PRIVATE SECRET TITLE" });
  await repo.publishDeck(owner, privateDeck.deckTemplateId, 0);
  await page.goto("/library"); await expect(page.getByLabel("Username or email")).toBeVisible();
  await login(page, "phase2"); await page.goto(`/library/${privateDeck.deckTemplateId}`);
  await expect(page.getByText("PRIVATE SECRET TITLE")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add to My Decks" })).toHaveCount(0);
  await page.goto("/library"); await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  await expect(page.getByText("PRIVATE SECRET TITLE")).toHaveCount(0);
});

test("lost Add response followed by Archive cannot be undone by the UI's retry", async ({ page }) => {
  const { repo, viewer, id } = await fixture(); await login(page); await detail(page, id);
  await page.route(`**/api/library/decks/${id}/add`, async (route) => { await route.fetch(); await route.abort("failed"); }, { times: 1 });
  await page.getByRole("button", { name: "Add to My Decks", exact: true }).click(); await expect(page.locator(".library-error")).toBeVisible();
  expect((await repo.getPersonalUser(viewer))!.decksData.some((item) => item.deckTemplateId === id)).toBeTruthy();
  await repo.archiveDeckData(viewer, id);
  await page.getByRole("button", { name: "Add to My Decks", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restore to My Decks", exact: true })).toBeEnabled();
  const data = (await repo.getPersonalUser(viewer))!.decksData.filter((item) => item.deckTemplateId === id); expect(data).toHaveLength(1); expect(data[0].archivedAt).not.toBeNull();
});

test("a forked Card front shows its creator and only the immediate source attribution on tap", async ({ page }) => {
  const { repo, viewer, ids } = await fixture();
  const { forkCardContent } = await import("../../src/lib/cards/forks");
  const source = { cardTemplateId: ids[0], version: 1 }, stepIds = [randomUUID(), randomUUID(), randomUUID()];
  const content = forkCardContent((await repo.getCardVersion(ids[0], 1))!.content, source, stepIds), cardTemplateId = randomUUID();
  await repo.createCardFork(viewer, { source, cardTemplateId, stepIds, context: { kind: "library" }, content: { ...content, intro: { ...content.intro, title: "Edited public practice" } } });
  await repo.promoteCard(viewer, cardTemplateId, 0); await repo.publishCard(viewer, cardTemplateId, 1);
  const programme = await repo.createDeckDraft(viewer, { ...createDefaultDeckContent([]), title: "Attribution programme", cards: [{ cardTemplateId }] }, "public"); await repo.publishDeck(viewer, programme.deckTemplateId, 0);
  await login(page); await detail(page, programme.deckTemplateId);
  const front = page.locator(".deck-card.is-active .card-creator-attribution"); await expect(front).toHaveText("other");
  await front.getByRole("button").click(); await expect(front.getByRole("status")).toHaveText("Source: phase2");
  await expect(page.locator(".focused-card-stage")).toHaveCount(0); // Attribution tap is not Card activation.
  await front.getByRole("button").press("Escape"); await expect(front.getByRole("status")).toHaveCount(0);
});

test("account change between the UI auth check and POST cannot add content to the new account", async ({ page }) => {
  const { repo, owner, viewer, id } = await fixture(); await login(page); await detail(page, id);
  await page.route(`**/api/library/decks/${id}/add`, async (route) => {
    expect(route.request().headers()["x-library-viewer"]).toBe(viewer);
    await login(page, "phase2");
    // Request.fetch uses the current cookie jar, reproducing a session change
    // after the old UI's check but before the authenticated mutation begins.
    const response = await page.request.post(route.request().url(), { data: route.request().postDataJSON(), headers: { "X-Library-Viewer": viewer } });
    expect(response.status()).toBe(409); expect((await response.json()).code).toBe("LIBRARY_SESSION_CONFLICT");
    await route.fulfill({ response });
  }, { times: 1 });
  await page.getByRole("button", { name: "Add to My Decks", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add to My Decks", exact: true })).toBeEnabled();
  for (const actor of [owner, viewer]) expect((await repo.getPersonalUser(actor))!.decksData.some((item) => item.deckTemplateId === id)).toBe(false);
});

test("Open Card through another personal Deck does not add the Library Deck or initialize its membership", async ({ page }) => {
  const { repo, owner, viewer, id, ids } = await fixture();
  const personal = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "Existing learning programme", cards: [{ cardTemplateId: ids[0] }] }, "public");
  await repo.publishDeck(owner, personal.deckTemplateId, 0); await repo.ensureDeckData(viewer, personal.deckTemplateId, 1);
  await login(page); await detail(page, id);
  await expect(page.getByRole("button", { name: "Add to My Decks", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Open Card in My Decks", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/decks\\?openDeck=${personal.deckTemplateId}`));
  await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Library practice 1");
  const user = (await repo.getPersonalUser(viewer))!;
  expect(user.decksData.some((data) => data.deckTemplateId === id)).toBe(false);
  expect(user.cardsData.filter((data) => data.cardTemplateId === ids[0])).toHaveLength(1);
  expect(user.decksData.find((data) => data.deckTemplateId === personal.deckTemplateId)!.activeCardId).toBe(ids[0]);
});
