import { expect, test, type Page } from "@playwright/test";
import { instructionalImageUrl, type InstructionalImageContext } from "../../src/lib/instructionalImageContext";
import { INTRO_IMAGE, STEP_IMAGE, login, openGroupStepView, seedGroupWithStepMedia, selectPerspective, type GroupStepMedia } from "./helpers/groupStepMediaFixture";

// A Group Card carries main's Step media (tabs of images and interactive visuals) and main's
// instructional image delivery. A Group Card is never a personal Card, so its images are delivered in
// canonical mode, pinned to the Card version in the Group manifest, for the signed-in viewer only.
// This must hold in every perspective, without changing how the Group loads. Requires --group-experiences.
const IMAGE_ROUTE = "/api/media/instructional-image";
let g: GroupStepMedia;
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }) => { test.setTimeout(240_000); g = await seedGroupWithStepMedia(browser); });
test.afterAll(async () => { await g?.client.close(); });

type Served = { context: InstructionalImageContext; status: number };
function watchImages(page: Page) {
  const served: Served[] = [], groupReads: string[] = [];
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.pathname === IMAGE_ROUTE) served.push({ context: Object.fromEntries(url.searchParams) as unknown as InstructionalImageContext, status: response.status() });
    if (url.pathname.startsWith("/api/group-experiences/")) groupReads.push(`${response.request().method()} ${url.pathname}`);
  });
  return { served, groupReads };
}
const loaded = (image: ReturnType<Page["locator"]>) => expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth)).toBeGreaterThan(0);

// "Me" exists only for a member; the admin is not one, so it is exercised by the follower below.
for (const perspective of ["group", "follower"] as const) {
  test(`${perspective} perspective: Group Card shows its Step media tabs and loads pinned canonical images for the signed-in admin`, async ({ page }) => {
    page.setDefaultTimeout(20_000); await login(page, "phase2");
    await selectPerspective(page, g.experienceId, g.cardId, perspective === "follower" ? { perspective, subjectUserId: g.followerId } : { perspective });
    const { served, groupReads } = watchImages(page);
    const step = await openGroupStepView(page, g.experienceId);
    // Read-only Group scene in the selected perspective, with no authoring affordances.
    await expect(page.locator(".group-experience")).toHaveAttribute("data-current-card", g.cardId);
    await expect(page.getByRole("button", { name: "Creator", exact: true })).toHaveCount(0);
    if (perspective === "follower") await expect(page.locator(".group-picker-current")).toHaveText(new RegExp(g.followerName));

    // A single introduction image has no tab bar.
    const intro = step.locator(`img[alt='${INTRO_IMAGE}']`); await expect(intro).toBeVisible(); await loaded(intro);
    await expect(step.getByRole("tab")).toHaveCount(0);

    // Opening Step media does not re-read the Group: its loading architecture is untouched.
    const readsBefore = groupReads.length;
    await step.getByRole("button", { name: "Next", exact: true }).click();
    await expect(step).toHaveCount(1); // The outgoing layer has left.
    await expect(step).not.toHaveAttribute("data-step-view-item", "intro");
    await expect(step.getByRole("tab")).toHaveCount(2);
    expect(await step.getByRole("tab").allTextContents()).toEqual(["Image", "Explore"]);
    await expect(step.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
    const stepImage = step.locator(`img[alt='${STEP_IMAGE}']`); await expect(stepImage).toBeVisible(); await loaded(stepImage);
    await step.getByRole("tab", { name: "Explore", exact: true }).click();
    await expect(step.getByRole("button", { name: "Start: Roots and Factors", exact: true })).toBeVisible();
    await step.getByRole("tab", { name: "Image", exact: true }).click(); await expect(stepImage).toBeVisible();
    expect(groupReads.slice(readsBefore), "Step media must not trigger Group reads").toEqual([]);

    // Every image was delivered by the canonical route, pinned to the manifest versions, for the signed-in viewer.
    expect(new Set(served.map(entry => entry.context.attachmentId))).toEqual(new Set([g.introImageId, g.stepImageId]));
    for (const { context, status } of served) {
      expect(status).toBe(200);
      expect(context).toMatchObject({ viewerUserId: g.adminId, cardTemplateId: g.cardId, deckTemplateId: g.deckId, mode: "canonical", version: "1", deckVersion: "1" });
      expect(context.stepId).toBe(context.attachmentId === g.introImageId ? "intro" : g.stepId);
    }
  });
}

test("a follower in their own Group (Me) loads the same pinned images, and the route admits only the signed-in viewer", async ({ browser, page }) => {
  page.setDefaultTimeout(20_000);
  const follower = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL }), anonymous = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL });
  try {
    const fPage = await follower.newPage(); fPage.setDefaultTimeout(20_000); await login(fPage, g.followerName);
    await selectPerspective(fPage, g.experienceId, g.cardId, { perspective: "self" }); // Me
    const { served } = watchImages(fPage);
    const step = await openGroupStepView(fPage, g.experienceId);
    const intro = step.locator(`img[alt='${INTRO_IMAGE}']`); await expect(intro).toBeVisible(); await loaded(intro);
    await step.getByRole("button", { name: "Next", exact: true }).click(); await expect(step).toHaveCount(1); await expect(step.getByRole("tab")).toHaveCount(2);
    const stepImage = step.locator(`img[alt='${STEP_IMAGE}']`); await expect(stepImage).toBeVisible(); await loaded(stepImage);
    expect(served.length).toBeGreaterThanOrEqual(2);
    for (const { context, status } of served) {
      expect(status).toBe(200);
      expect(context).toMatchObject({ viewerUserId: g.followerId, cardTemplateId: g.cardId, mode: "canonical", version: "1", deckVersion: "1" });
    }

    const forFollower: InstructionalImageContext = { viewerUserId: g.followerId, cardTemplateId: g.cardId, version: 1, mode: "canonical", deckTemplateId: g.deckId, deckVersion: 1, stepId: g.stepId, attachmentId: g.stepImageId };
    await login(page, "phase2");
    expect((await follower.request.get(instructionalImageUrl(forFollower))).status(), "the participant").toBe(200);
    expect((await page.request.get(instructionalImageUrl(forFollower))).status(), "another signed-in user cannot borrow the participant context").toBe(403);
    expect((await anonymous.request.get(instructionalImageUrl(forFollower))).status(), "unauthenticated").toBe(401);
    // Only the pinned Card and Deck versions and the exact attachment identity resolve.
    for (const [label, change] of [
      ["an unpinned Card version", { version: 2 }], ["an unpinned Deck version", { deckVersion: 2 }],
      ["a forged attachment", { attachmentId: "forged" }], ["the wrong step", { stepId: "intro" }], ["working mode", { mode: "working" }],
    ] as const) expect((await follower.request.get(instructionalImageUrl({ ...forFollower, ...change } as InstructionalImageContext))).status(), label).not.toBe(200);
  } finally { await follower.close(); await anonymous.close(); }
});
