import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, openGroupStepView, seedGroupWithStepMedia, selectPerspective, type GroupStepMedia } from "./helpers/groupStepMediaFixture";

// Visual Learning Records belong to the signed-in user, whatever Group perspective is shown. An admin
// who inspects a follower is still the actor: the visual starts from the admin's own state, every
// record request names the admin, and the follower's records, attempts and events are never read into
// the visual nor changed. Perspective switches expose nothing of another user. Requires --group-experiences.
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
// Reopening your own visual only advances that record's bookkeeping; its attempts and events are unchanged.
const content = (data: Awaited<ReturnType<typeof recordsOf>>) => ({ ...data, records: data.records.map(record => Object.fromEntries(Object.entries(record).filter(([key]) => key !== "revision" && key !== "updatedAt"))) });
const personalData = async (userId: string) => (await g.db.collection("users").findOne({ username: userId === g.followerId ? g.followerName : "phase2" }))!.cardsData;

/** Records which learner every visual-record request names. */
function watchLearners(page: Page) {
  const learners: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/visual-")) learners.push(request.headers()["x-visual-learner"] ?? "(none)"); });
  return learners;
}
async function startRoots(page: Page) {
  const step = await openGroupStepView(page, g.experienceId);
  await step.getByRole("button", { name: "Next", exact: true }).click(); await expect(step).toHaveCount(1);
  await step.getByRole("tab", { name: "Explore", exact: true }).click();
  await step.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Roots and Factors", exact: true }); await expect(dialog).toBeVisible();
  return { dialog, slider: dialog.getByRole("slider") };
}
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

test("switching between Group, follower and Me exposes and overwrites no other learner's work", async ({ browser, page }) => {
  page.setDefaultTimeout(20_000); await login(page, "phase2");
  const follower = await recordsOf(g.followerId), admin = await recordsOf(g.adminId);
  // Admin: Group, then the follower perspective, then Group again. Always the admin's own value (4).
  for (const selection of [{ perspective: "group" }, { perspective: "follower", subjectUserId: g.followerId }, { perspective: "group" }] as const) {
    await selectPerspective(page, g.experienceId, g.cardId, selection);
    const learners = watchLearners(page);
    const { dialog, slider } = await startRoots(page);
    await expect(slider).toHaveAttribute("aria-valuenow", "4"); await saved(dialog);
    expect(new Set(learners)).toEqual(new Set([principal(g.adminId)]));
  }
  expect(content(await recordsOf(g.adminId)), "viewing again did not rewrite the admin work").toEqual(content(admin));
  expect(await recordsOf(g.followerId), "the admin never touched the follower").toEqual(follower);

  // The follower, in Me, still sees only their own value (5), never the admin's (4).
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL });
  try {
    const fPage = await context.newPage(); fPage.setDefaultTimeout(20_000); await login(fPage, g.followerName);
    await selectPerspective(fPage, g.experienceId, g.cardId, { perspective: "self" });
    const learners = watchLearners(fPage), { dialog, slider } = await startRoots(fPage);
    await expect(slider).toHaveAttribute("aria-valuenow", "5"); await saved(dialog);
    expect(new Set(learners)).toEqual(new Set([principal(g.followerId)]));
  } finally { await context.close(); }
  expect(content(await recordsOf(g.followerId))).toEqual(content(follower));
  expect(content(await recordsOf(g.adminId))).toEqual(content(admin));
});
