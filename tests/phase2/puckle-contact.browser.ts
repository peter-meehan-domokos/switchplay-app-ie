import { test, expect, type Browser } from "@playwright/test";

// Puckle Contact and support page: panel content, link destinations, form preserved, no overflow. Native app hand-off needs a real phone.
const origin = process.env.PHASE2_BASE_URL!;
async function open(browser: Browser, width: number) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 600,
    extraHTTPHeaders: { "x-forwarded-for": `10.12.${width % 250}.${Math.floor(Math.random() * 250)}` },
    storageState: { cookies: [{ name: "site", value: "puckle", domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] } });
  const page = await ctx.newPage(); await page.goto(`${origin}/contact`); return page;
}
for (const width of [390, 1280]) {
  test(`contact page at ${width}px: panel, destinations, preserved form, no overflow`, async ({ browser }) => {
    const page = await open(browser, width);
    await expect(page.getByText("Prefer email?")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Technical support" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "General enquiries" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Call or text" })).toBeVisible();
    await expect(page.getByRole("link", { name: "WhatsApp support" })).toHaveAttribute("href", "https://wa.me/353852076241");
    await expect(page.getByRole("link", { name: "WhatsApp Puckle" })).toHaveAttribute("href", "https://wa.me/353852076241");
    await expect(page.getByRole("link", { name: "support@puckleup.com" })).toHaveAttribute("href", "mailto:support@puckleup.com");
    await expect(page.getByRole("link", { name: "hello@puckleup.com" })).toHaveAttribute("href", "mailto:hello@puckleup.com");
    await expect(page.getByRole("link", { name: "+353 85 207 6241" })).toHaveAttribute("href", "tel:+353852076241");
    await expect(page.getByRole("link", { name: "Call Ireland number" })).toHaveAttribute("href", "tel:+353852076241");
    await expect(page.getByRole("link", { name: "Text Ireland number" })).toHaveAttribute("href", "sms:+353852076241");
    await expect(page.getByRole("link", { name: "+44 7547 196642" })).toHaveAttribute("href", "tel:+447547196642");
    await expect(page.getByRole("link", { name: "Call UK number" })).toHaveAttribute("href", "tel:+447547196642");
    await expect(page.getByRole("link", { name: "Text UK number" })).toHaveAttribute("href", "sms:+447547196642");
    expect(await page.locator('a[href*="wa.me"]').evaluateAll(els => els.map(e => e.getAttribute("href")))).toEqual(["https://wa.me/353852076241", "https://wa.me/353852076241"]);
    // The existing form follows "Or send us a message" and keeps its fields.
    const heading = page.getByRole("heading", { name: "Or send us a message" }); await expect(heading).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible(); await expect(page.getByLabel("Email address")).toBeVisible(); await expect(page.locator(".PhoneInputCountrySelect")).toHaveCount(1);
    const order = await page.evaluate(() => { const y = (el: Element | null) => el?.getBoundingClientRect().top ?? -1; const h = [...document.querySelectorAll("h2")].find(e => e.textContent === "Or send us a message"); return [y(document.querySelector("#contact-phone")), y(h ?? null), y(document.querySelector("form"))]; });
    expect(order[0]).toBeLessThan(order[1]); expect(order[1]).toBeLessThan(order[2]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    for (const link of await page.locator("a[href^='tel:'], a[href^='sms:']").all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    await page.screenshot({ path: `phase2-test-results/contact-${width}.png`, fullPage: true });
  });
}
