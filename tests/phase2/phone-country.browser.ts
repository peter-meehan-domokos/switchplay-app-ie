import { test, expect, type Browser } from "@playwright/test";

// Initial country of the shared phone input: IP country, else browser language, else Ireland; a user choice always wins.
const origin = process.env.PHASE2_BASE_URL!;
let counter = 0;
async function visit(browser: Browser, path: string, options: { ip?: string; locale?: string; width?: number } = {}) {
  const ctx = await browser.newContext({ viewport: { width: options.width ?? 390, height: 844 }, hasTouch: true, locale: options.locale ?? "en", extraHTTPHeaders: {
    "x-forwarded-for": `10.9.${++counter % 250}.${Math.floor(Math.random() * 250)}`, ...(options.ip ? { "x-vercel-ip-country": options.ip } : {}) },
    storageState: { cookies: [{ name: "site", value: "puckle", domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
  const page = await ctx.newPage(); await page.goto(`${origin}${path}`);
  if (path.includes("early-access")) await page.getByRole("radio", { name: "Parent or guardian" }).check(); // the enquiry form reveals its phone field after this choice
  return { ctx, page };
}
const FORMS: [string, string][] = [["/contact", "contact"], ["/#early-access", "enquiry"]];
for (const [path, name] of FORMS) {
  test(`${name}: IP country first, then browser language, then Ireland`, async ({ browser }) => {
    let v = await visit(browser, path, { ip: "GB", locale: "fr-FR" }); await expect(v.page.locator(".PhoneInputCountrySelect").first()).toHaveValue("GB"); await v.ctx.close();
    v = await visit(browser, path, { locale: "fr-FR" }); await expect(v.page.locator(".PhoneInputCountrySelect").first()).toHaveValue("FR"); await v.ctx.close();
    v = await visit(browser, path, { ip: "ZZ", locale: "en" }); await expect(v.page.locator(".PhoneInputCountrySelect").first()).toHaveValue("IE"); await v.ctx.close();
  });
}
test("a country chosen by the user is never overridden by detection", async ({ browser }) => {
  const { page } = await visit(browser, "/contact", { ip: "GB" });
  const select = page.locator(".PhoneInputCountrySelect").first(); await select.selectOption("US"); await page.waitForTimeout(600);
  await expect(select).toHaveValue("US");
});
for (const [choice, label] of [["student", "I'm here to learn"], ["teacher", "I'm a teacher"]]) {
  test(`Join (${choice}) uses the IP country, with the selector fitting at 390px`, async ({ browser }) => {
    const { page } = await visit(browser, "/join", { ip: "US" });
    await page.getByRole("radio", { name: label }).check();
    await expect(page.locator(".PhoneInputCountrySelect").first()).toHaveValue("US");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
