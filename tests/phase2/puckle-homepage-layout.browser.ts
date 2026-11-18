import { test, expect, type Browser, type Page } from "@playwright/test";

// Responsive checks for the public Puckle homepage: hero alignment, numbered steps, Explore column balance and the
// registration section's scroll-to-top behaviour. Measured in a real browser at phone, tablet and laptop sizes.
const origin = process.env.PHASE2_BASE_URL!;
async function open(browser: Browser, width: number, height: number): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height }, locale: "en-IE" });
  const page = await context.newPage(); await page.goto(`${origin}/`, { waitUntil: "networkidle" }); return page;
}
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

const heroMetrics = (page: Page) => page.evaluate(() => {
  const copy = document.getElementById("home-hero-title")!.parentElement!, fig = copy.parentElement!.querySelector("figure")!, img = fig.querySelector("img")!;
  const rect = (element: Element) => element.getBoundingClientRect(), caption = fig.nextElementSibling!;
  return { dy: (rect(copy).top + rect(copy).height / 2) - (rect(img).top + rect(img).height / 2), imgW: rect(img).width, imgH: rect(img).height,
    captionGap: rect(caption).top - rect(img).bottom, copyAboveImage: rect(copy).bottom <= rect(img).top };
});
const columns = (page: Page, heading: string) => page.evaluate((start) => {
  const copy = [...document.querySelectorAll("h3")].find(element => element.textContent!.startsWith(start))!.parentElement!;
  return { text: Math.round(copy.getBoundingClientRect().width), media: Math.round(copy.nextElementSibling!.getBoundingClientRect().width) };
}, heading);

test("the hero headline is centred on the image itself, the caption stays directly beneath, and phones stay stacked", async ({ browser }) => {
  for (const [width, imageWidth] of [[840, 322], [900, 345], [1024, 392], [1280, 467], [1440, 467]] as const) {
    const page = await open(browser, width, 800), hero = await heroMetrics(page);
    expect(Math.abs(hero.dy), `${width}px: headline centre vs image centre`).toBeLessThanOrEqual(3);
    expect(Math.abs(hero.imgW - imageWidth), `${width}px: image keeps its size`).toBeLessThanOrEqual(2);
    expect(hero.captionGap, `${width}px: caption directly beneath`).toBeGreaterThanOrEqual(12); expect(hero.captionGap).toBeLessThanOrEqual(16);
    await noOverflow(page); await page.context().close();
  }
  for (const width of [390, 768, 834]) {
    const page = await open(browser, width, 800), hero = await heroMetrics(page);
    expect(hero.copyAboveImage, `${width}px: stacked`).toBe(true); expect(hero.captionGap).toBeGreaterThanOrEqual(12); await noOverflow(page); await page.context().close();
  }
});

test("the three learning steps are numbered at every size, keeping the uppercase label style", async ({ browser }) => {
  for (const width of [320, 390, 834, 1280]) {
    const page = await open(browser, width, 800);
    const labels = await page.evaluate(() => [...document.querySelectorAll("p")].filter(element => /^[123]\. /.test(element.textContent!)).map(element => [element.textContent, (element as HTMLElement).innerText]));
    expect(labels, `${width}px`).toEqual([["1. Learn", "1. LEARN"], ["2. Explore", "2. EXPLORE"], ["3. Test yourself", "3. TEST YOURSELF"]]);
    await noOverflow(page); await page.context().close();
  }
});

test("Explore keeps a sensible text width at 900-1100px and is unchanged on wider laptops; Learn and Test yourself are untouched", async ({ browser }) => {
  const expected: Record<number, { explore: number; learn: number }> = { 900: { explore: 283, learn: 300 }, 1024: { explore: 329, learn: 414 }, 1100: { explore: 357, learn: 484 }, 1280: { explore: 412, learn: 544 }, 1440: { explore: 412, learn: 544 } };
  for (const [width, want] of Object.entries(expected)) {
    const page = await open(browser, Number(width), 800), explore = await columns(page, "Interactive"), learn = await columns(page, "Explanations"), test = await columns(page, "Comments");
    expect(Math.abs(explore.text - want.explore), `${width}px Explore text`).toBeLessThanOrEqual(3);
    expect(Math.abs(learn.text - want.learn), `${width}px Learn text`).toBeLessThanOrEqual(3); expect(test.text).toBe(learn.text); expect(learn.media).toBe(480);
    await noOverflow(page); await page.context().close();
  }
  for (const width of [840, 899]) { // still stacked: every beat's text is full width
    const page = await open(browser, width, 800), explore = await columns(page, "Interactive"); expect(explore.text).toBeGreaterThan(500); await page.context().close();
  }
});

const follow = async (page: Page) => { await page.evaluate(() => { location.hash = "#early-access"; }); await page.waitForTimeout(600); };
const landing = (page: Page) => page.evaluate(() => ({ titleTop: document.getElementById("enquiry-title")!.getBoundingClientRect().top,
  spare: document.documentElement.scrollHeight - innerHeight - scrollY }));

test("following a link to the registration form puts its heading at the top, with little spare scroll room on tablet and up", async ({ browser }) => {
  for (const [width, height] of [[390, 600], [390, 844], [768, 1024], [820, 700], [1024, 768], [1280, 600], [1280, 800], [1440, 1000], [1440, 1300]] as const) {
    const page = await open(browser, width, height); await follow(page); const where = await landing(page);
    expect(where.titleTop, `${width}x${height}: heading near the top`).toBeGreaterThanOrEqual(8); expect(where.titleTop).toBeLessThanOrEqual(26);
    if (width >= 760) expect(where.spare, `${width}x${height}: spare scroll room`).toBeLessThanOrEqual(30); // phones keep their existing room
    await page.context().close();
  }
});

test("an expanded registration form is fully reachable and the heading still lands at the top when the link is followed again", async ({ browser }) => {
  for (const [width, height] of [[390, 844], [1024, 768], [1280, 800]] as const) {
    const page = await open(browser, width, height);
    await page.locator("#early-access").scrollIntoViewIfNeeded();
    await page.getByRole("radio", { name: "Parent or guardian" }).check();
    await expect(page.getByRole("button", { name: "Request a free session" })).toBeVisible();
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(300);
    const button = await page.getByRole("button", { name: "Request a free session" }).boundingBox();
    expect(button!.y + button!.height, `${width}x${height}: submit button reachable`).toBeLessThanOrEqual(height);
    await page.evaluate(() => scrollTo(0, 0)); await follow(page);
    expect((await landing(page)).titleTop, `${width}x${height}: heading at top with the form expanded`).toBeLessThanOrEqual(26);
    await page.context().close();
  }
});

for (const [name, width, height] of [["phone", 390, 844], ["ipad-portrait", 820, 1180], ["ipad-landscape", 1024, 768], ["laptop", 1280, 800]] as const) {
  test(`homepage screenshots: ${name}`, async ({ browser }) => {
    const page = await open(browser, width, height);
    await page.screenshot({ path: `phase2-test-results/homepage-${name}-top.png` });
    await page.locator("h3", { hasText: "Interactive" }).scrollIntoViewIfNeeded(); await page.screenshot({ path: `phase2-test-results/homepage-${name}-explore.png` });
    await follow(page); await page.screenshot({ path: `phase2-test-results/homepage-${name}-form.png` });
    await noOverflow(page);
  });
}

test("the hero has a Request a free session button that sits inside the centred text block and scrolls to the registration heading", async ({ browser }) => {
  for (const [width, height] of [[390, 800], [834, 1112], [1024, 768], [1280, 800]] as const) {
    const page = await open(browser, width, height);
    const button = page.locator("section[aria-labelledby=home-hero-title] a[href='#early-access']");
    await expect(button).toHaveText("Request a free session");
    const inside = await page.evaluate(() => {
      const copy = document.getElementById("home-hero-title")!.parentElement!, link = copy.querySelector("a[href='#early-access']")!.getBoundingClientRect();
      return { fits: link.right <= copy.getBoundingClientRect().right + 1 && link.bottom <= copy.getBoundingClientRect().bottom + 1 };
    });
    expect(inside.fits, `${width}px: button within hero text`).toBe(true);
    if (width >= 840) expect(Math.abs((await heroMetrics(page)).dy), `${width}px: block still centred`).toBeLessThanOrEqual(3);
    await noOverflow(page);
    await page.screenshot({ path: `phase2-test-results/homepage-hero-cta-${width}.png` });
    await button.click(); await page.waitForTimeout(800);
    const top = await page.evaluate(() => document.getElementById("enquiry-title")!.getBoundingClientRect().top);
    expect(top, `${width}px: heading near the top after click`).toBeLessThan(60); expect(top).toBeGreaterThan(0);
    await page.context().close();
  }
});
