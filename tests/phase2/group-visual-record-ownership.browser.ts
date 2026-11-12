import { expect, test, type Locator, type Page } from "@playwright/test";
import { enterGroup, expectSameScene, focusStepView, leaveStepView, login, markScene, openGroupStepView, seedGroupWithStepMedia, selectPerspective, switchPerspectiveInPlace, type GroupStepMedia } from "./helpers/groupStepMediaFixture";

// Visual Learning Records belong to the signed-in user, whatever Group perspective is shown. An admin
// who inspects a follower is still the actor: the visual starts from the admin's own state, every
// record request names the admin, and the follower's records, attempts and events are never read into
// the visual nor changed. Perspective switches expose nothing of another user. The first two tests enter
// each perspective by loading the page; the third switches perspective IN PLACE through the picker, with
// the Group scene mounted and no navigation. Requires --group-experiences.
let g: GroupStepMedia;
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }) => { test.setTimeout(240_000); g = await seedGroupWithStepMedia(browser); });
test.afterAll(async () => { await g?.client.close(); });

const principal = (id: string) => `account:${id}`;
async function recordsOf(userId: string) {
  const records = await g.db.collection("visualRecords").find({ principalKey: principal(userId) }).sort({ recordId: 1 }).toArray();
  const attempts = await g.db.collection("visualAttempts").find({ recordId: { $in: records.map(record => record.recordId) } }).sort({ attemptId: 1 }).toArray();
  const events = await g.db.collection("visualEvents").find({ attemptId: { $in: attempts.map(attempt => attempt.attemptId) } }).sort({ eventId: 1 }).toArray();
  return { records, attempts, events };
}
const personalData = async (userId: string) => (await g.db.collection("users").findOne({ username: userId === g.followerId ? g.followerName : "phase2" }))!.cardsData;

/** Records which learner every visual-record request names. */
function watchLearners(page: Page) {
  const learners: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/visual-")) learners.push(request.headers()["x-visual-learner"] ?? "(none)"); });
  return learners;
}
/** In a mounted Group scene: from the focused Card's Step View, opens the Roots and Factors visual. */
async function openRootsFromStepView(page: Page, step: Locator) {
  await step.getByRole("button", { name: "Next", exact: true }).click(); await expect(step).toHaveCount(1);
  await step.getByRole("tab", { name: "Explore", exact: true }).click();
  await step.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Roots and Factors", exact: true }); await expect(dialog).toBeVisible();
  return { dialog, slider: dialog.getByRole("slider") };
}
/** Initial page entry into the Group, then the visual. */
async function startRoots(page: Page) { return openRootsFromStepView(page, await openGroupStepView(page, g.experienceId)); }
/** Reopens the visual in the already mounted Group scene, without loading the page. */
async function reopenRootsInMountedGroup(page: Page) { return openRootsFromStepView(page, await focusStepView(page)); }
const closeVisual = async (page: Page, dialog: Locator) => { await dialog.getByRole("button", { name: "Close interactive visual" }).click(); await expect(dialog).toHaveCount(0); };
const nudge = async (page: Page, slider: Locator, key: "ArrowLeft" | "ArrowRight", to: string) => {
  await slider.focus(); await page.keyboard.press(key); await expect(slider).toHaveAttribute("aria-valuenow", to);
};
const saved = (dialog: Locator) => expect(dialog).toHaveAttribute("data-visual-save-status", "Saved");

test("a follower works in their own perspective and owns that record", async ({ page }) => {
  page.setDefaultTimeout(20_000); await login(page, g.followerName);
  await selectPerspective(page, g.experienceId, g.cardId, { perspective: "self" });
  const learners = watchLearners(page);
  const { dialog, slider } = await startRoots(page);
  await expect(slider).toHaveAttribute("aria-valuenow", "3");
  await nudge(page, slider, "ArrowRight", "4"); await nudge(page, slider, "ArrowRight", "5"); await saved(dialog);
  expect(learners.length).toBeGreaterThan(0);
  expect(new Set(learners)).toEqual(new Set([principal(g.followerId)]));
  const mine = await recordsOf(g.followerId);
  expect(mine.records).toHaveLength(1); expect(mine.attempts).toHaveLength(1);
  expect(mine.attempts[0].snapshot.state.root).toBe(5);
  expect((await recordsOf(g.adminId)).records, "the admin has no record yet").toHaveLength(0);
});

test("an admin viewing a follower works on their own record and cannot read or change the follower", async ({ page }) => {
  page.setDefaultTimeout(20_000); await login(page, "phase2");
  const follower = await recordsOf(g.followerId), followerData = await personalData(g.followerId);
  await selectPerspective(page, g.experienceId, g.cardId, { perspective: "follower", subjectUserId: g.followerId });
  const learners = watchLearners(page);
  const { dialog, slider } = await startRoots(page);
  await expect(page.locator(".group-picker-current")).toHaveText(new RegExp(g.followerName)); // Truly the follower perspective.
  // The visual starts from the admin's own state (the default), not the follower's value of 5.
  await expect(slider).toHaveAttribute("aria-valuenow", "3");
  await nudge(page, slider, "ArrowRight", "4"); await saved(dialog);

  expect(learners.length).toBeGreaterThan(0);
  expect(new Set(learners), "every record request names the signed-in admin").toEqual(new Set([principal(g.adminId)]));
  const own = await recordsOf(g.adminId);
  expect(own.records).toHaveLength(1); expect(own.records[0].activityId).toBe("roots-and-factors");
  expect(own.attempts).toHaveLength(1); expect(own.attempts[0].snapshot.state.root).toBe(4);
  expect(await recordsOf(g.followerId), "the follower records, attempts and events are untouched").toEqual(follower);
  expect(await personalData(g.followerId)).toEqual(followerData);

  // The server refuses to act for, or read, another learner even when asked directly.
  const followerRecord = follower.records[0].recordId;
  expect((await page.request.get(`/api/visual-records/${followerRecord}/current`, { headers: { "X-Visual-Learner": principal(g.followerId) } })).ok(), "claiming to be the follower").toBe(false);
  expect((await page.request.get(`/api/visual-records/${followerRecord}/current`, { headers: { "X-Visual-Learner": principal(g.adminId) } })).status(), "reading the follower record as the admin").toBe(403);
  expect(await recordsOf(g.followerId)).toEqual(follower);
});

test("switching perspective in place exposes and overwrites no other learner's work", async ({ browser, page }) => {
  page.setDefaultTimeout(20_000); await login(page, "phase2");
  const follower = await recordsOf(g.followerId), admin = await recordsOf(g.adminId);

  // Admin: Group -> follower -> Group. The page is entered once; every switch uses the picker on the mounted scene.
  await selectPerspective(page, g.experienceId, g.cardId, { perspective: "group" });
  await enterGroup(page, g.experienceId); await markScene(page);
  const learners = watchLearners(page);
  let expectedValue = "4"; // The admin's own saved value from the previous test, in every perspective.
  for (const [index, key] of ["group", g.followerId, "group"].entries()) {
    if (index > 0) await switchPerspectiveInPlace(page, key);
    await expectSameScene(page, key);
    if (key === g.followerId) await expect(page.locator(".group-picker-current")).toHaveText(new RegExp(g.followerName));
    const from = learners.length;
    const { dialog, slider } = await reopenRootsInMountedGroup(page);
    await expect(slider, `the admin's own state is restored after switching to ${key}`).toHaveAttribute("aria-valuenow", expectedValue); await saved(dialog);
    expect(new Set(learners.slice(from)), `every record request after switching to ${key} names the signed-in admin`).toEqual(new Set([principal(g.adminId)]));
    if (index === 2) { // After the round trip, an edit is the admin's and reaches nobody else.
      await nudge(page, slider, "ArrowLeft", "3"); await saved(dialog); expectedValue = "3";
    }
    await closeVisual(page, dialog); await leaveStepView(page);
    await expectSameScene(page, key);
  }
  expect(await recordsOf(g.followerId), "the admin never touched the follower").toEqual(follower);
  const afterEdit = await recordsOf(g.adminId);
  expect(afterEdit.attempts, "only the admin attempt exists and it holds the edit").toHaveLength(1); expect(afterEdit.attempts[0].snapshot.state.root).toBe(3);
  expect(afterEdit.attempts.length, "no attempt was added").toBe(admin.attempts.length);

  // Follower: Me -> Group -> Me, in a separate authenticated context. Their own value (5) in every perspective, never the admin's.
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL });
  try {
    const fPage = await context.newPage(); fPage.setDefaultTimeout(20_000); await login(fPage, g.followerName);
    await selectPerspective(fPage, g.experienceId, g.cardId, { perspective: "self" });
    await enterGroup(fPage, g.experienceId); await markScene(fPage);
    const fLearners = watchLearners(fPage);
    let own = "5";
    for (const [index, key] of [g.followerId, "group", g.followerId].entries()) {
      if (index > 0) await switchPerspectiveInPlace(fPage, key);
      await expectSameScene(fPage, key);
      const from = fLearners.length;
      const { dialog, slider } = await reopenRootsInMountedGroup(fPage);
      await expect(slider, `the follower's own state is restored in ${key === "group" ? "Group" : "Me"}`).toHaveAttribute("aria-valuenow", own); await saved(dialog);
      expect(new Set(fLearners.slice(from))).toEqual(new Set([principal(g.followerId)]));
      if (index === 2) { await nudge(fPage, slider, "ArrowLeft", "4"); await saved(dialog); own = "4"; }
      await closeVisual(fPage, dialog); await leaveStepView(fPage);
      await expectSameScene(fPage, key);
    }
  } finally { await context.close(); }
  const followerAfter = await recordsOf(g.followerId);
  expect(followerAfter.attempts).toHaveLength(1); expect(followerAfter.attempts[0].snapshot.state.root).toBe(4);
  expect(await recordsOf(g.adminId), "the follower never touched the admin").toEqual(afterEdit);
});
