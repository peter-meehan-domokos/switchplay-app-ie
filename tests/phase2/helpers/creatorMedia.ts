import type { Locator, Page } from "@playwright/test";

/** Exercise the current creator entry point while allowing transfer to continue after Close. */
export async function uploadCreatorIntroVideo(page: Page, column: Locator, file: Parameters<Locator["setInputFiles"]>[0]) {
  await column.locator(".creator-card-intro-media-slot .creator-media-upload-control").click();
  const modal = page.locator("dialog[data-creator-step-media]");
  await modal.getByLabel("Add video", { exact: true }).setInputFiles(file);
  await modal.getByRole("button", { name: "Close", exact: true }).click();
}
