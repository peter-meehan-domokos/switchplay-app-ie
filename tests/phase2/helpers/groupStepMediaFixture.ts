import { readFileSync } from "node:fs";
import { expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { assertDisposableDatabase } from "../../../src/lib/cards/localDatabase";
import { CardRepository } from "../../../src/lib/cards/repository";
import { GroupExperienceRepository } from "../../../src/lib/groupExperiences/repository";

// Shared set-up for the Group Step media and visual ownership tests. Every Card, image upload,
// attachment, publication and Group is created through the ordinary Creator interface and the real
// repositories; only disposable user accounts are inserted directly. Requires --group-experiences.
const png = (name: string) => ({ name, mimeType: "image/png", buffer: readFileSync("public/interactive-visuals/roots-and-factors-v1.png") });
export const INTRO_IMAGE = "Intro.png", STEP_IMAGE = "Graph.png";

export type GroupStepMedia = {
  client: MongoClient; db: ReturnType<MongoClient["db"]>;
  experienceId: string; deckId: string; cardId: string; stepId: string;
  adminId: string; followerId: string; followerName: string; outsiderName: string;
  introImageId: string; stepImageId: string; stepVisualId: string;
};

export async function login(page: Page, identifier: string) {
  expect((await page.request.post("/api/auth/login", { data: { identifier, password: "local-test-only" } })).ok()).toBe(true);
}

export async function seedGroupWithStepMedia(browser: Browser): Promise<GroupStepMedia> {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect(), db = client.db(process.env.MONGODB_DB!);
  const admin = (await db.collection("users").findOne({ username: "phase2" }))!;
  const now = new Date(), person = (role: string) => ({ _id: new ObjectId(), username: `${role}-${randomUUID().slice(0, 8)}`, email: `${role}-${randomUUID()}@example.invalid`,
    passwordHash: admin.passwordHash, cardsData: [], decksData: [], createdAt: now, updatedAt: now });
  const follower = person("follower"), outsider = person("outsider");
  await db.collection("users").insertMany([follower, outsider]);

  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 1280, height: 1000 } });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(20_000); await login(page, "phase2");
    await page.goto("/creator/new"); await page.getByRole("button", { name: "Add card", exact: true }).click();
    const column = page.locator(".creator-column[data-card-template-id]").last(), cardId = (await column.getAttribute("data-card-template-id"))!;
    const root = () => db.collection("cardTemplates").findOne({ cardTemplateId: cardId });
    await expect.poll(async () => !!await root()).toBe(true);
    await expect(page).toHaveURL(/\/creator\/edit\/[^/]+$/);
    const deckId = new URL(page.url()).pathname.split("/").at(-1)!;
    await column.locator(".creator-card-title-button").click();
    await page.locator(".creator-modal").getByRole("textbox").fill("Group Step media");
    await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();

    const modal = page.locator("dialog[data-creator-step-media]"), close = () => modal.getByRole("button", { name: "Close", exact: true }).click();
    const items = async (intro: boolean) => ((intro ? (await root())!.draft.intro : (await root())!.draft.steps[0]).mediaItems ?? []) as unknown[];
    await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
    await modal.getByLabel("Add image", { exact: true }).setInputFiles(png(INTRO_IMAGE));
    await expect.poll(async () => (await items(true)).length).toBe(1); await close();
    await column.getByRole("button", { name: "Manage step media", exact: true }).first().click();
    await modal.getByLabel("Add image", { exact: true }).setInputFiles(png(STEP_IMAGE));
    await expect.poll(async () => (await items(false)).length).toBe(1);
    await modal.getByRole("combobox", { name: "Add Interactive Visual", exact: true }).selectOption("roots-and-factors");
    await expect.poll(async () => (await items(false)).length).toBe(2); await close();

    await column.getByRole("combobox", { name: "Card 1 publication visibility" }).selectOption("public");
    await column.getByRole("button", { name: /^Publish Card/ }).click();
    await page.getByRole("dialog", { name: "Confirm public publication" }).getByRole("button", { name: "Publish publicly", exact: true }).click();
    await expect.poll(async () => (await root())?.latestVersion).toBe(1);
    await page.getByRole("button", { name: "Edit deck title and introduction" }).click();
    await page.locator(".creator-modal textarea").fill("Group Step media deck");
    await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("combobox", { name: "Deck publication visibility" }).selectOption("public");
    await page.getByRole("button", { name: "Publish Deck", exact: true }).click();
    await page.getByRole("dialog", { name: "Confirm public publication" }).getByRole("button", { name: "Publish publicly", exact: true }).click();
    await expect.poll(async () => (await db.collection("deckTemplates").findOne({ deckTemplateId: deckId }))?.latestVersion).toBe(1);

    const content = (await db.collection("cardTemplateVersions").findOne({ cardTemplateId: cardId, version: 1 }))!.content;
    const stepMedia = content.steps[0].mediaItems as { id: string; kind: string }[];
    const cards = new CardRepository(db, client), groups = new GroupExperienceRepository(cards), adminId = admin._id.toHexString();
    const group = await groups.create(adminId, { name: "Step media Group", operationId: randomUUID(), adminIds: [], followerIds: [follower._id.toHexString()],
      manifest: { deckTemplateId: deckId, deckVersion: 1, cards: [{ cardTemplateId: cardId, version: 1 }] } });
    await groups.saveSettings(adminId, group.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, allowFollowerInspection: true });
    return { client, db, experienceId: group.experienceId, deckId, cardId, stepId: content.steps[0].stepId, adminId, followerId: follower._id.toHexString(),
      followerName: follower.username, outsiderName: outsider.username, introImageId: content.intro.mediaItems[0].id,
      stepImageId: stepMedia.find(item => item.kind === "image")!.id, stepVisualId: stepMedia.find(item => item.kind === "activity")!.id };
  } finally { await context.close(); }
}

/** Selects the stored Group perspective for the signed-in user, as the existing Group tests do. */
export async function selectPerspective(page: Page, experienceId: string, cardId: string, selection: { perspective: "group" | "self" } | { perspective: "follower"; subjectUserId: string }) {
  const current = await (await page.request.get(`/api/group-experiences/${experienceId}`)).json();
  expect((await page.request.patch(`/api/group-experiences/${experienceId}/navigation`, { data: { accessEpoch: current.accessEpoch,
    expectedStructureRevision: current.structureRevision, selection, activeCardId: cardId } })).ok()).toBe(true);
}

/** Opens the Group, focuses the active Card and enters Step View on its introduction. */
export async function openGroupStepView(page: Page, experienceId: string) {
  await page.goto(`/decks?openExperience=${experienceId}`);
  await expect(page.locator(".group-picker-current")).toBeEnabled();
  await page.locator(".deck-card.is-active").press("Enter");
  await expect(page.locator(".focused-card-layer")).toBeVisible();
  await page.locator(".focused-card-surface--front .active-card-identity[role=button]").click();
  const step = page.locator(".step-view-layer"); await expect(step).toHaveAttribute("data-step-view-item", "intro");
  return step;
}
