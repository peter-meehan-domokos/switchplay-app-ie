import { test, expect, type Browser, type Page } from "@playwright/test";

// Responsive checks for the public Puckle homepage: hero alignment, numbered steps, Explore column balance and the
// registration section's scroll-to-top behaviour. Measured in a real browser at phone, tablet and laptop sizes.
const origin = process.env.PHASE2_BASE_URL!;
async function open(browser: Browser, width: number, height: number): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height }, locale: "en-IE" });
  const page = await context.newPage(); await page.goto(`${origin}/`, { waitUntil: "networkidle" }); return page;
}
const noOverflow = async (page: Page) => {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth, `page scrollWidth ${scrollWidth} vs viewport ${innerWidth}`).toBeLessThanOrEqual(innerWidth + 1);
};

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
const landing = (page: Page) => page.evaluate(() => ({ sectionTop: document.getElementById("early-access")!.getBoundingClientRect().top,
  padding: parseFloat(getComputedStyle(document.getElementById("early-access")!).paddingTop), titleTop: document.getElementById("enquiry-title")!.getBoundingClientRect().top,
  spare: document.documentElement.scrollHeight - innerHeight - scrollY }));

test("following a link to the registration form puts its heading at the top, with little spare scroll room on tablet and up", async ({ browser }) => {
  for (const [width, height] of [[390, 600], [390, 844], [768, 1024], [820, 700], [1024, 768], [1280, 600], [1280, 800], [1440, 1000], [1440, 1300]] as const) {
    const page = await open(browser, width, height); await follow(page); const where = await landing(page);
    expect(Math.abs(where.sectionTop), `${width}x${height}: lands on the top of the section`).toBeLessThanOrEqual(2);
    expect(Math.abs(where.titleTop - where.padding - 1), `${width}x${height}: the section top padding is visible above the heading`).toBeLessThanOrEqual(4);
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
    expect((await landing(page)).sectionTop, `${width}x${height}: section at top with the form expanded`).toBeLessThanOrEqual(2);
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
    const button = page.locator("#home-hero-title").locator("..").locator("a[href='#early-access']");
    if (width < 760) { await expect(button, "hidden on phones").toBeHidden(); await page.context().close(); continue; }
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
    expect(top, `${width}px: heading sits below the section padding after click`).toBeGreaterThan(40); expect(top).toBeLessThan(90);
    await page.context().close();
  }
});

test("the Learning heading sits closer to the first step on laptop, with the steps themselves unchanged", async ({ browser }) => {
  for (const [width, expectMax] of [[1280, 40], [1024, 40], [390, 400]] as const) {
    const page = await open(browser, width, 800), gaps = await page.evaluate(() => {
      const top = (element: Element) => element.getBoundingClientRect();
      const h2 = document.getElementById("learning-title")!, beats = [...h2.closest("section")!.querySelectorAll(":scope > div")];
      return { heading: top(beats[0]).top - top(h2).bottom, between: top(beats[1]).top - top(beats[0]).bottom };
    });
    expect(gaps.heading, `${width}px: heading to first step`).toBeLessThanOrEqual(expectMax);
    if (width >= 900) expect(gaps.between, `${width}px: gap between steps unchanged`).toBeGreaterThanOrEqual(56);
    await page.screenshot({ path: `phase2-test-results/homepage-learning-${width}.png` });
    await page.context().close();
  }
});

test("an early Request a free session button sits centred under the hero bridge text, and the Keep / Learn ideas stack on small phones", async ({ browser }) => {
  for (const [width, height] of [[360, 740], [390, 844], [480, 900], [700, 900], [1024, 768], [1280, 800]] as const) {
    const page = await open(browser, width, height);
    const early = await page.evaluate(() => {
      const bridge = [...document.querySelectorAll("p")].find(p => p.textContent === "Card by Card. Step by step.")!.parentElement!;
      const link = bridge.querySelector("a[href='#early-access']")!, note = bridge.querySelector("a + p, div > p:last-child")!, rect = (e: Element) => e.getBoundingClientRect();
      const text = bridge.querySelector("p:nth-child(2)")!, next = document.querySelector("#learning-title")!.closest("section")!;
      return { label: link.textContent, note: note.textContent, centre: (rect(link).left + rect(link).right) / 2 - (rect(bridge).left + rect(bridge).right) / 2,
        below: rect(link).top - rect(text).bottom, noteGap: rect(note).top - rect(link).bottom, gapAfter: rect(next).top - rect(note).bottom };
    });
    expect(early.label).toBe("Request a free session"); expect(early.note).toBe("Free 20–30 minute online maths session.");
    expect(Math.abs(early.centre), `${width}px: button centred in the block`).toBeLessThanOrEqual(2);
    expect(early.below, `${width}px: space above`).toBeGreaterThanOrEqual(16); expect(early.gapAfter, `${width}px: space before the next section`).toBeGreaterThan(24);
    const ideas = await page.evaluate(() => {
      const items = [...document.querySelectorAll("li")].filter(li => /^(Keep what helps|Learn from others)\./.test(li.textContent!)).map(li => li.getBoundingClientRect());
      return { sideBySide: Math.abs(items[0].top - items[1].top) < 4, gap: items[1].top - items[0].bottom, overflow: items.some(r => r.left < -1 || r.right > innerWidth + 1) };
    });
    expect(ideas.overflow, `${width}px: no overflow`).toBe(false);
    expect(ideas.sideBySide, `${width}px: ideas ${width < 480 ? "stacked" : "side by side"}`).toBe(width >= 480);
    if (width < 480) expect(ideas.gap).toBeGreaterThanOrEqual(8);
    await noOverflow(page);
    await page.screenshot({ path: `phase2-test-results/homepage-early-cta-${width}.png`, fullPage: false });
    await page.getByText("Free 20–30 minute online maths session.").locator("..").locator("a").click(); await page.waitForTimeout(600);
    expect(Math.abs((await landing(page)).sectionTop), `${width}px: early button reaches the registration section`).toBeLessThanOrEqual(2);
    await page.context().close();
  }
});

// Explore animation: the cropped 936x696 asset, shown borderless with its own controls beneath. Aspect ratio comes from the asset.
const ASSET_RATIO = 936 / 696;
const exploreVideo = (page: Page) => page.locator("video[aria-label^='Unroll the cone']");
const paused = (page: Page) => exploreVideo(page).evaluate((video: HTMLVideoElement) => video.paused);
const bringIntoView = (page: Page) => exploreVideo(page).evaluate((video) => video.scrollIntoView({ block: "center" }));
const scrollAway = (page: Page) => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

test("the Explore animation keeps the 936 x 696 ratio, sits in the old image position with no frame, and its controls are beneath it", async ({ browser }) => {
  for (const width of [390, 768, 1024, 1280]) {
    const page = await open(browser, width, 900), video = exploreVideo(page);
    await bringIntoView(page);
    const metrics = await page.evaluate(() => {
      const element = document.querySelector("video[aria-label^='Unroll the cone']") as HTMLVideoElement, figure = element.closest("figure")!;
      const box = element.getBoundingClientRect(), strip = element.nextElementSibling!.getBoundingClientRect(), figureBox = figure.getBoundingClientRect(), style = getComputedStyle(figure);
      return { w: box.width, h: box.height, stripTop: strip.top, videoBottom: box.bottom, figureW: figureBox.width, left: box.left - figureBox.left,
        border: style.borderTopWidth, nativeControls: element.controls, loop: element.loop, muted: element.muted, inline: element.playsInline, vw: window.innerWidth };
    });
    expect(Math.abs(metrics.w / metrics.h - ASSET_RATIO), `${width}px ratio`).toBeLessThan(0.01);
    expect(metrics.border, `${width}px figure border`).toBe("0px");
    expect(Math.abs(metrics.w - metrics.figureW)).toBeLessThanOrEqual(1); expect(metrics.left).toBeLessThanOrEqual(1);
    expect(metrics.stripTop, `${width}px strip below the video`).toBeGreaterThanOrEqual(metrics.videoBottom - 0.5);
    expect(metrics.nativeControls).toBe(false); expect(metrics.loop).toBe(true); expect(metrics.muted).toBe(true); expect(metrics.inline).toBe(true);
    await expect(video).toBeVisible(); await noOverflow(page); await page.context().close();
  }
});

test("the Explore animation has no frame or corner remnants: the edges are card cream and the corners show the page behind", async ({ browser }) => {
  const sharp = (await import("sharp")).default;
  const page = await open(browser, 1280, 900), video = exploreVideo(page);
  await bringIntoView(page); await video.evaluate((element: HTMLVideoElement) => { element.pause(); element.currentTime = 40; });
  await page.waitForTimeout(600);
  const box = (await video.boundingBox())!, pad = 6;
  const shot = await sharp(await page.screenshot({ clip: { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad } })).raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => { const scale = shot.info.width / (box.width + 2 * pad), px = (Math.round(y * scale) * shot.info.width + Math.round(x * scale)) * shot.info.channels; return [...shot.data.subarray(px, px + 3)]; };
  const page_bg = at(2, 2), isCream = (c: number[]) => c[0] > 225 && c[1] > 225 && c[2] > 215;
  for (const [x, y] of [[pad + 1, pad + box.height / 2], [pad + box.width - 2, pad + box.height / 2], [pad + box.width / 2, pad + 1], [pad + box.width / 2, pad + box.height - 2]]) expect(isCream(at(x, y)), `edge ${x},${y} is cream`).toBe(true);
  for (const [x, y] of [[pad, pad], [pad + box.width - 1, pad], [pad, pad + box.height - 1], [pad + box.width - 1, pad + box.height - 1]]) {
    const corner = at(x, y); expect(corner.every((channel, index) => Math.abs(channel - page_bg[index]) <= 12), `corner ${x},${y} shows the page, not a navy remnant: ${corner} vs ${page_bg}`).toBe(true);
  }
  await page.context().close();
});

test("the Explore animation autoplays muted when seen, pauses when left, and a deliberate pause survives scrolling and fullscreen", async ({ browser }) => {
  const page = await open(browser, 390, 800), video = exploreVideo(page);
  expect(await paused(page)).toBe(true);
  await bringIntoView(page); await expect.poll(() => paused(page)).toBe(false);
  expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
  await scrollAway(page); await expect.poll(() => paused(page)).toBe(true);
  await bringIntoView(page); await expect.poll(() => paused(page)).toBe(false);
  await video.click(); await expect.poll(() => paused(page)).toBe(true); // tapping the video is a deliberate pause
  await scrollAway(page); await page.waitForTimeout(400); await bringIntoView(page); await page.waitForTimeout(800);
  expect(await paused(page), "deliberate pause preserved").toBe(true);
  await page.getByRole("button", { name: "Play" }).click(); await expect.poll(() => paused(page)).toBe(false);
  await page.getByRole("button", { name: "Pause" }).click(); await expect.poll(() => paused(page)).toBe(true);
  const target = await video.evaluate((element: HTMLVideoElement) => element.duration / 2);
  await page.getByRole("slider", { name: "Seek" }).fill(String(Math.round(target * 10) / 10)); await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(target - 1);
  expect(await paused(page), "seeking does not change a pause").toBe(true);
  await page.context().close();
});

test("fullscreen shows the whole player including the strip, and does not interrupt or change playback", async ({ browser }) => {
  const page = await open(browser, 1280, 800), video = exploreVideo(page);
  await bringIntoView(page); await expect.poll(() => paused(page)).toBe(false);
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.querySelector("video[aria-label^='Unroll the cone']") !== null && document.fullscreenElement !== null)).toBe(true);
  await page.waitForTimeout(500); expect(await paused(page), "still playing in fullscreen").toBe(false);
  await expect(page.getByRole("slider", { name: "Seek" })).toBeVisible();
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await page.waitForTimeout(500); expect(await paused(page), "still playing after fullscreen").toBe(false);
  await video.click(); await expect.poll(() => paused(page)).toBe(true);
  await page.getByRole("button", { name: "Enter fullscreen" }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Exit fullscreen" }).click(); await page.waitForTimeout(800);
  expect(await paused(page), "a pause survives a fullscreen round trip").toBe(true);
  await page.context().close();
});

test("reduced motion never autoplays, and blocked autoplay leaves the poster with working manual controls", async ({ browser }) => {
  const calm = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: "reduce" }), calmPage = await calm.newPage();
  await calmPage.goto(`${origin}/`, { waitUntil: "networkidle" }); await bringIntoView(calmPage); await calmPage.waitForTimeout(1000);
  expect(await paused(calmPage)).toBe(true);
  await calmPage.getByRole("button", { name: "Play" }).click(); await expect.poll(() => paused(calmPage)).toBe(false); await calm.close();

  const blocked = await browser.newContext({ viewport: { width: 390, height: 800 } }), blockedPage = await blocked.newPage();
  await blockedPage.addInitScript(() => { const play = HTMLMediaElement.prototype.play; let first = true;
    HTMLMediaElement.prototype.play = function () { if (first) { first = false; return Promise.reject(new DOMException("blocked", "NotAllowedError")); } return play.call(this); }; });
  await blockedPage.goto(`${origin}/`, { waitUntil: "networkidle" }); await bringIntoView(blockedPage); await blockedPage.waitForTimeout(800);
  expect(await paused(blockedPage)).toBe(true); expect(await exploreVideo(blockedPage).getAttribute("poster")).toContain("cone-poster-v2");
  await blockedPage.getByRole("button", { name: "Play" }).click(); await expect.poll(() => paused(blockedPage)).toBe(false); await blocked.close();
});
