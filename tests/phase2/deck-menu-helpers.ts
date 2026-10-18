import { type Page } from "@playwright/test";

export async function libraryDeckAction(page: Page, name: string | RegExp, allowMissingMenu = false) {
  const trigger = page.getByRole("button", { name: "Deck menu", exact: true });
  if (!allowMissingMenu) await trigger.waitFor({ state: "visible", timeout: 15000 });
  // Unavailable/overview pages intentionally have no Deck menu.
  if (await trigger.count() && await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  return page.getByRole("menuitem", { name, exact: typeof name === "string" });
}

export async function confirmArchive(page: Page) {
  await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  await page.getByRole("dialog", { name: /^Archive / }).getByRole("button", { name: "Archive", exact: true }).click();
}
