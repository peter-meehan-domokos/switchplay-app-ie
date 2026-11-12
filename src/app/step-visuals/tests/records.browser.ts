import { expect, test, type Page } from "@playwright/test";
import type { Card1LearningEvent, Card1LearningResult, Card1SessionRecords } from "../public";

type Capture = { records: Card1SessionRecords; receivedEvents: Card1LearningEvent[]; receivedCompletions: Card1LearningResult[] };
const slider = (page: Page) => page.getByRole("slider", { name: "Movable root" });
const surface = (page: Page) => page.locator("[data-spv-learning-stage]");
const capture = async (page: Page): Promise<Capture> => JSON.parse(await page.locator("[data-spv-records]").innerText());
const rootTo = async (page: Page, root: number) => {
  await slider(page).focus();
  const from = Number(await slider(page).getAttribute("aria-valuenow"));
  for (let step = 0; step < Math.abs(root - from); step++) await page.keyboard.press(root < from ? "ArrowLeft" : "ArrowRight");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", String(root));
};
const enterTry = async (page: Page) => {
  await rootTo(page, 4);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "(x − 3)", exact: true }).click();
  await expect.poll(async () => (await capture(page)).records.current.prediction?.correct).toBeNull();
  await rootTo(page, -3);
  await page.getByRole("button", { name: "Next", exact: true }).click();
};
const startDrag = async (page: Page) => {
  await slider(page).scrollIntoViewIfNeeded();
  const box = await slider(page).boundingBox();
  await page.mouse.move(box!.x + 24, box!.y + 24);
  await page.mouse.down();
  await expect(surface(page)).toHaveAttribute("data-spv-editing", "true");
};
const moveDrag = async (page: Page, root: number) => {
  const position = await page.getByRole("img", { name: "Quadratic graph", exact: true }).evaluate((element, value) => {
    const box = element.getBoundingClientRect();
    const plot = element.querySelector("clipPath rect")!;
    return { x: box.x + Number(plot.getAttribute("x")) + Number(plot.getAttribute("width")) * (value + 6) / 12,
      y: box.y + Number(plot.getAttribute("y")) + Number(plot.getAttribute("height")) / 2 };
  }, root);
  await page.mouse.move(position.x, position.y);
};

test.beforeEach(async ({ page }) => {
  await page.goto("/step-visuals");
  await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
});

test("lab callback consumer receives one startup under Strict Mode without hidden record markup", async ({ page }) => {
  await expect(page.locator("[data-spv-records]")).toHaveCount(0);
  await page.getByText("Learning records", { exact: true }).click();
  await expect.poll(async () => (await capture(page)).receivedEvents.length).toBe(1);
  const data = await capture(page);
  expect(data.records.current).toMatchObject({ schemaVersion: 1, activityVersion: 1, attemptNumber: 1, settledRoot: 3, status: "in-progress" });
  expect(data.receivedEvents[0].type).toBe("attempt-started");
  expect(data.receivedCompletions).toEqual([]);
  await page.getByText("Learning records", { exact: true }).click();
  await expect(page.locator("[data-spv-records]")).toHaveCount(0);
});

for (const assisted of [false, true]) test(`public callbacks retain ${assisted ? "assisted" : "independent"} completion across Start again and preview navigation`, async ({ page }) => {
  await page.getByText("Learning records", { exact: true }).click();
  await enterTry(page);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  if (assisted) await page.getByRole("button", { name: "Show explanation", exact: true }).click();
  await rootTo(page, -4);
  expect((await capture(page)).receivedCompletions).toEqual([]);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect.poll(async () => (await capture(page)).receivedCompletions.length).toBe(1);
  const data = await capture(page);
  const result = data.receivedCompletions[0];
  expect(result).toMatchObject({ finalRoot: -4, checkAttempts: 2, incorrectChecks: 1, assistanceRequested: assisted, successMode: assisted ? "assisted" : "independent" });
  expect(result.checks.map((check) => check.root)).toEqual([-3, -4]);
  expect(result.checks.map((check) => check.assistanceRequested)).toEqual([false, assisted]);
  expect(result.prediction.correct).toBe(false);
  expect(data.receivedEvents).toEqual(data.records.events);
  expect(new Set(data.receivedEvents.map((event) => event.eventId)).size).toBe(data.receivedEvents.length);
  await page.getByRole("button", { name: "Start again", exact: true }).click();
  await expect.poll(async () => (await capture(page)).records.current.attemptNumber).toBe(2);
  const restarted = await capture(page);
  expect(restarted.records.current.attemptId).not.toBe(result.attemptId);
  expect(restarted.records.current).toMatchObject({ settledRoot: 3, prediction: null, checks: [], placements: [], assistanceRequested: false });
  expect(restarted.records.completedAttempts).toEqual([result]);
  expect(restarted.receivedCompletions).toEqual([result]);
  const eventCount = restarted.receivedEvents.length;
  const dropdown = page.getByRole("combobox", { name: "Layout preview" });
  await dropdown.selectOption("assistance");
  await dropdown.selectOption("sparkline");
  await page.getByRole("combobox", { name: "Sparkline root" }).selectOption("-4");
  await dropdown.selectOption("guided");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "3");
  expect((await capture(page)).receivedEvents.length).toBe(eventCount);
  expect((await capture(page)).receivedCompletions).toEqual([result]);
});

test("fractional pointer updates and cancellation emit nothing; release records one snapped mathematical placement", async ({ page }) => {
  await page.getByText("Learning records", { exact: true }).click();
  await startDrag(page);
  for (const root of [3.1, 3.25, 3.6, 4.2]) await moveDrag(page, root);
  expect((await capture(page)).receivedEvents.length).toBe(1);
  expect((await capture(page)).records.current.settledRoot).toBe(3);
  await slider(page).dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await page.mouse.up();
  expect((await capture(page)).receivedEvents.length).toBe(1);
  await startDrag(page);
  await moveDrag(page, 4.35);
  expect((await capture(page)).receivedEvents.length).toBe(1);
  await page.mouse.up();
  await expect.poll(async () => (await capture(page)).records.current.placements.length).toBe(1);
  expect((await capture(page)).records.current.placements).toEqual([{ stage: "orientation", fromRoot: 3, toRoot: 4, input: "pointer" }]);
});

test("explicit lab restart and Exit deliver partial records before navigation unmounts the activity", async ({ page }) => {
  await page.getByText("Learning records", { exact: true }).click();
  await rootTo(page, 4);
  const firstId = (await capture(page)).records.current.attemptId;
  await page.getByRole("button", { name: "Restart guided activity", exact: true }).click();
  await expect.poll(async () => (await capture(page)).records.current.attemptNumber).toBe(2);
  let data = await capture(page);
  expect(data.records.partialAttempts[0]).toMatchObject({ attemptId: firstId, settledRoot: 4, status: "restarted" });
  expect(data.receivedCompletions).toEqual([]);
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  data = await capture(page);
  expect(data.records.exited).toBe(true);
  expect(data.records.current.status).toBe("exited");
  expect(data.receivedEvents.at(-1)?.type).toBe("attempt-exited");
  expect(data.receivedCompletions).toEqual([]);
  await expect(surface(page)).toHaveCount(0);
});

test("leaving through a preview or burger experience records the preserved Guided attempt", async ({ page }) => {
  await page.getByText("Learning records", { exact: true }).click();
  await rootTo(page, 4);
  await page.getByRole("combobox", { name: "Layout preview" }).selectOption("orientation");
  await slider(page).focus();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await capture(page)).records.current.settledRoot).toBe(4);
  await page.getByRole("button", { name: "Interactive visualisation", exact: true }).click();
  await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.getByRole("button", { name: "Sparkline preview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sparkline preview", exact: true })).toBeFocused();
  expect((await capture(page)).records.exited).toBe(true);
  expect((await capture(page)).receivedEvents.at(-1)?.type).toBe("attempt-exited");
});
