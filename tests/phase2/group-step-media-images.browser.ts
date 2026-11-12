import { expect, test, type Page } from "@playwright/test";
import { instructionalImageUrl, type InstructionalImageContext } from "../../src/lib/instructionalImageContext";
import { INTRO_IMAGE, INTRO_IMAGE_V2, STEP_IMAGE, STEP_IMAGE_V2, login, openGroupStepView, seedGroupWithStepMedia, selectPerspective, type GroupStepMedia } from "./helpers/groupStepMediaFixture";

// A Group Card carries main's Step media (tabs of images and interactive visuals) and main's
// instructional image delivery. A Group Card is never a personal Card, so its images are delivered in
// canonical mode, pinned to the Card and Deck versions in the Group manifest, for the signed-in viewer
// only. The fixture publishes real Card and Deck versions 1 and 2 with different images and pins the Group
// to version 1: the Group must show and request version 1 only, on first open and when reopened, in every
// perspective, even though version 2 exists and is itself accessible.
// The canonical image endpoint is NOT restricted to the Group pin: it serves any accessible public
// version of a Deck the viewer may read. The pin is enforced by the manifest the Group presents, which
// is what the browser assertions below observe. Requires --group-experiences.
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
  test(`${perspective} perspective: Group Card shows its pinned version 1 Step media tabs and loads pinned canonical images for the signed-in admin`, async ({ page }) => {
    page.setDefaultTimeout(20_000); await login(page, "phase2");
    // Version 2 really exists, is public and is itself deliverable, so only the pin keeps it out of the Group.
    const versions = await g.db.collection("cardTemplateVersions").find({ cardTemplateId: g.cardId }).sort({ version: 1 }).toArray();
    expect(versions.map(version => [version.version, version.visibility])).toEqual([[1, "public"], [2, "public"]]);
    expect((await g.db.collection("deckTemplates").findOne({ deckTemplateId: g.deckId }))!.latestVersion).toBe(2);
    const newerContext: InstructionalImageContext = { viewerUserId: g.adminId, cardTemplateId: g.cardId, version: 2, mode: "canonical", deckTemplateId: g.deckId, deckVersion: 2, stepId: g.stepId, attachmentId: g.newer.stepImageId };
    expect((await page.request.get(instructionalImageUrl(newerContext))).status(), "version 2 is accessible by its own route").toBe(200);
    // Replacing an image keeps the attachment (tab) identity and stores a different image asset: the two
    // versions differ in the stored asset and the alternative text, which is what the Group must not mix.
    const assets = (content: { intro: { mediaItems: { media: { assetId: string; description: string } }[] }; steps: { mediaItems: { kind: string; media: { assetId: string; description: string } }[] }[] }) =>
      [content.intro.mediaItems[0].media, content.steps[0].mediaItems.find(item => item.kind === "image")!.media].map(media => [media.assetId, media.description]);
    const [v1, v2] = versions.map(version => assets(version.content));
    expect(v1.map(([, description]) => description)).toEqual([INTRO_IMAGE, STEP_IMAGE]);
    expect(v2.map(([, description]) => description)).toEqual([INTRO_IMAGE_V2, STEP_IMAGE_V2]);
    expect(new Set([...v1, ...v2].map(([assetId]) => assetId)).size, "the versions store four different image assets").toBe(4);

    await selectPerspective(page, g.experienceId, g.cardId, perspective === "follower" ? { perspective, subjectUserId: g.followerId } : { perspective });
    // The same checks run on first open and again after leaving and reopening the Group.
    for (const pass of ["first open", "reopened"]) {
      if (pass === "reopened") await page.goto("/decks");
      const { served, groupReads } = watchImages(page);
      const step = await openGroupStepView(page, g.experienceId);
      // Read-only Group scene in the selected perspective, with no authoring affordances.
      await expect(page.locator(".group-experience"), pass).toHaveAttribute("data-current-card", g.cardId);
      await expect(page.getByRole("button", { name: "Creator", exact: true })).toHaveCount(0);
      if (perspective === "follower") await expect(page.locator(".group-picker-current")).toHaveText(new RegExp(g.followerName));

      // A single introduction image has no tab bar. It is the version 1 image, not version 2.
      const intro = step.locator(`img[alt='${INTRO_IMAGE}']`); await expect(intro, pass).toBeVisible(); await loaded(intro);
      await expect(step.locator(`img[alt='${INTRO_IMAGE_V2}']`)).toHaveCount(0);
      await expect(step.getByRole("tab")).toHaveCount(0);

      // The observed Step navigation and tab selections issue no Group reads or writes of their own. Authority
      // checks are excluded: the Group's refresh clock (groupResource lease renewal) issues them on a timer,
      // independently of Step view, so they can fall inside any window and would make a stricter check depend
      // on timing. The Group's entry-time access verification is allowed to finish before the window opens.
      await expect(page.locator(".group-verification")).toHaveCount(0); await page.waitForLoadState("networkidle");
      const readsBefore = groupReads.length;
      await step.getByRole("button", { name: "Next", exact: true }).click();
      await expect(step).toHaveCount(1); // The outgoing layer has left.
      await expect(step).not.toHaveAttribute("data-step-view-item", "intro");
      await expect(step.getByRole("tab")).toHaveCount(2);
      expect(await step.getByRole("tab").allTextContents()).toEqual(["Image", "Explore"]);
      await expect(step.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
      const stepImage = step.locator(`img[alt='${STEP_IMAGE}']`); await expect(stepImage, pass).toBeVisible(); await loaded(stepImage);
      await expect(step.locator(`img[alt='${STEP_IMAGE_V2}']`)).toHaveCount(0);
      await step.getByRole("tab", { name: "Explore", exact: true }).click();
      // "Start" for a new learner, "Continue" once the signed-in user already has a record for this visual.
      await expect(step.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ })).toBeVisible();
      await step.getByRole("tab", { name: "Image", exact: true }).click(); await expect(stepImage).toBeVisible();
      expect(groupReads.slice(readsBefore).filter(read => !/^GET \/api\/group-experiences\/[^/]+\/authority$/.test(read)),
        `${pass}: Step navigation and tab selection must not issue Group requests other than clock-driven authority checks`).toEqual([]);

      // Every image was delivered by the canonical route, pinned to the manifest versions, for the signed-in viewer.
      expect(new Set(served.map(entry => entry.context.attachmentId)), pass).toEqual(new Set([g.introImageId, g.stepImageId]));
      for (const { context, status } of served) {
        expect(status).toBe(200);
        expect(context).toMatchObject({ viewerUserId: g.adminId, cardTemplateId: g.cardId, deckTemplateId: g.deckId, mode: "canonical", version: "1", deckVersion: "1" });
        expect(context.stepId).toBe(context.attachmentId === g.introImageId ? "intro" : g.stepId);
      }
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
    await expect(step.locator(`img[alt='${STEP_IMAGE_V2}']`), "the pinned version 1, not the newer version 2").toHaveCount(0);
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
    // The route resolves an accessible attachment of an existing version. It does not resolve versions that
    // do not exist, attachments that are not in that version, the wrong step, or working mode for a Group.
    // (Version 2 does exist and resolves for a viewer who may read it; the Group pin is covered above.)
    for (const [label, change] of [
      ["a nonexistent Card version", { version: 3 }], ["a nonexistent Deck version", { deckVersion: 3 }],
      ["a forged attachment", { attachmentId: "forged" }], ["the wrong step", { stepId: "intro" }], ["working mode", { mode: "working" }],
    ] as const) expect((await follower.request.get(instructionalImageUrl({ ...forFollower, ...change } as InstructionalImageContext))).status(), label).not.toBe(200);
  } finally { await follower.close(); await anonymous.close(); }
});
