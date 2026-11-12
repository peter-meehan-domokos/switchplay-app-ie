import { expect, test } from "@playwright/test";

test("lab logs actual callback batches without drag, preview, completion or restart duplicates", async ({ page }) => {
  const development = process.env.SPV_CONSOLE_PRODUCTION !== "1";
  const groups: string[] = [];
  const payloads: { records: { current: { attemptNumber: number; settledRoot: number }; completedAttempts: unknown[] }; deliveredEvents: { type: string }[]; deliveredCompletions: unknown[] }[] = [];
  page.on("console", async (message) => {
    if (message.type() === "startGroupCollapsed" && message.text().startsWith("[Step Visuals")) groups.push(message.text());
    if (message.type() === "log" && message.args().length === 1) {
      const value = await message.args()[0].jsonValue().catch(() => null);
      if (value?.records && value?.deliveredEvents) payloads.push(value);
    }
  });
  await page.goto("/step-visuals");
  const root = page.getByRole("slider", { name: "Movable root" });
  await expect(root).toHaveAttribute("aria-valuenow", "3");
  if (development) await expect.poll(() => groups.length).toBe(1);
  let count = development ? 1 : 0;
  const action = async (run: () => Promise<unknown>) => {
    await run();
    if (development) await expect.poll(() => groups.length).toBe(++count);
  };
  await root.scrollIntoViewIfNeeded();
  const box = (await root.boundingBox())!;
  await page.mouse.move(box.x + 24, box.y + 24);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 24, { steps: 15 });
  await expect(page.locator("[data-spv-learning-stage]")).toHaveAttribute("data-spv-editing", "true");
  expect(groups.length).toBe(count);
  await root.dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await page.mouse.up();
  await expect(root).toHaveAttribute("aria-valuenow", "3");
  await action(async () => { await root.focus(); await page.keyboard.press("ArrowRight"); });
  await action(() => page.getByRole("button", { name: "Next", exact: true }).click());
  await action(() => page.getByRole("button", { name: "(x + 3)", exact: true }).click());
  await action(async () => { await root.focus(); await page.keyboard.press("Home"); });
  await action(() => page.keyboard.press("ArrowRight"));
  await action(() => page.keyboard.press("ArrowRight"));
  await action(() => page.getByRole("button", { name: "Next", exact: true }).click());
  await action(() => page.getByRole("button", { name: "Check", exact: true }).click());
  await action(() => page.getByRole("button", { name: "Show explanation", exact: true }).click());
  await action(async () => { await root.focus(); await page.keyboard.press("ArrowLeft"); });
  await action(() => page.getByRole("button", { name: "Check", exact: true }).click());
  await expect(page.getByRole("heading", { name: "Finished", exact: true })).toBeVisible();
  if (development) {
    await expect.poll(() => payloads.at(-1)?.deliveredCompletions.length).toBe(1);
    expect(groups.at(-1)).toContain("answer-checked");
  }
  await action(() => page.getByRole("button", { name: "Start again", exact: true }).click());
  if (development) {
    await expect.poll(() => payloads.at(-1)?.records.current.attemptNumber).toBe(2);
    expect(payloads.at(-1)?.records.completedAttempts).toHaveLength(1);
    expect(groups.at(-1)).toContain("attempt-restarted");
  }
  const dropdown = page.getByRole("combobox", { name: "Layout preview" });
  await dropdown.selectOption("assistance");
  await dropdown.selectOption("guided");
  await expect(root).toHaveAttribute("aria-valuenow", "3");
  expect(groups.length).toBe(count);
  await action(() => page.getByRole("button", { name: "Exit", exact: true }).click());
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(groups.length).toBe(count);
  if (!development) expect(payloads).toEqual([]);
});
