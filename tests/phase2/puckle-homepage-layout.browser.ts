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

test("Explore keeps a sensible text width from 900px up now its video is capped at 500px; Learn and Test yourself are untouched", async ({ browser }) => {
  const expected: Record<number, { explore: number; learn: number }> = { 900: { explore: 283, learn: 300 }, 1024: { explore: 394, learn: 414 }, 1100: { explore: 464, learn: 484 }, 1280: { explore: 544, learn: 544 }, 1440: { explore: 544, learn: 544 } };
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

test("following a link to the registration form puts its heading at the top at every size, with the content below it supplying the scroll room", async ({ browser }) => {
  for (const [width, height] of [[320, 568], [390, 600], [390, 844], [768, 1024], [820, 700], [1024, 768], [1280, 600], [1280, 800], [1440, 900], [1440, 1000], [1440, 1300]] as const) {
    const page = await open(browser, width, height); await follow(page); const where = await landing(page);
    expect(Math.abs(where.sectionTop), `${width}x${height}: lands on the top of the section`).toBeLessThanOrEqual(2);
    expect(Math.abs(where.titleTop - where.padding - 1), `${width}x${height}: the section top padding is visible above the heading`).toBeLessThanOrEqual(4);
    expect(where.spare, `${width}x${height}: Beyond the Maths and the footer sit below the form`).toBeGreaterThan(400);
    await page.context().close();
  }
});

test("an expanded registration form is fully reachable and the heading still lands at the top when the link is followed again", async ({ browser }) => {
  for (const [width, height] of [[390, 844], [1024, 768], [1280, 800]] as const) {
    const page = await open(browser, width, height);
    await page.locator("#early-access").scrollIntoViewIfNeeded();
    await page.getByRole("radio", { name: "Parent or guardian" }).check();
    await expect(page.getByRole("button", { name: "Request a free session" })).toBeVisible();
    await page.getByRole("button", { name: "Request a free session" }).scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
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
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(500); await page.screenshot({ path: `phase2-test-results/homepage-${name}-bottom.png` });
    await noOverflow(page);
  });
}

test("a collapsed form leaves no blank gap: Beyond the Maths follows it directly, and the form lands at the top without extra reserved space", async ({ browser }) => {
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900]] as const) {
    const page = await open(browser, width, height);
    const gap = await page.evaluate(() => { const form = document.getElementById("early-access")!, last = form.lastElementChild!.getBoundingClientRect(), next = document.getElementById("beyond-title")!.closest("section")!.getBoundingClientRect();
      return { blank: next.top - last.bottom, formHeight: form.getBoundingClientRect().height, viewport: innerHeight }; });
    expect(gap.blank, `${width}x${height}: space between the form's last content and the next section`).toBeLessThanOrEqual(150);
    expect(gap.formHeight, `${width}x${height}: the collapsed form no longer reserves a full screen`).toBeLessThan(gap.viewport);
    await page.context().close();
  }
});

const beyond = (page: Page) => page.evaluate(() => {
  const section = document.getElementById("beyond-title")!.closest("section")!, cards = [...section.querySelectorAll("ul > li")] as HTMLElement[], rect = (element: Element) => element.getBoundingClientRect();
  const invite = section.querySelector("a[href='/contact']") as HTMLElement | null, footer = document.querySelector("footer")!;
  return {
    eyebrow: section.querySelector("p")!.textContent, heading: section.querySelector("h2")!.textContent, subtitle: section.querySelectorAll("header > *").length,
    cards: cards.map(card => { const img = card.querySelector("img")!, title = card.querySelector("h3")!, [label, description] = [...card.querySelectorAll("p")].filter(paragraph => paragraph.getClientRects().length > 0);
      return { title: title.textContent, label: label.textContent, description: description.textContent, links: card.querySelectorAll("a").length, box: rect(card).toJSON(),
        ratio: rect(img).width / rect(img).height, natural: img.naturalWidth / img.naturalHeight, imgWidth: rect(img).width, loaded: img.complete && img.naturalWidth > 0,
        artBottom: rect(img).bottom, artWidth: rect(img).width, panelWidth: rect(card).width, textTop: rect(title).top, titleSize: parseFloat(getComputedStyle(title).fontSize), descSize: parseFloat(getComputedStyle(description).fontSize), titleTop: rect(title).top, labelTop: rect(label).top,
        clipped: [title, label, description].some(element => element.scrollWidth > element.clientWidth + 1) }; }),
    invite: invite && { href: invite.getAttribute("href"), text: invite.textContent, top: rect(invite).top, height: rect(invite).height, bg: getComputedStyle(invite).backgroundColor },
    prompt: section.querySelector("a[href='/contact']")!.previousElementSibling!.textContent, cardsBottom: Math.max(...cards.map(card => rect(card).bottom)),
    footerLinks: [...footer.querySelectorAll("nav a")].map(link => [link.textContent, link.getAttribute("href")]), footerWidth: rect(footer).width,
    wordmark: rect(footer.querySelector("[aria-hidden='true']:not(svg)")!).right, navBottom: rect(footer.querySelector("nav")!).bottom, wavesTop: rect(footer.querySelector("svg")!).top, footerBottom: rect(footer).bottom + scrollY, docHeight: document.documentElement.scrollHeight,
  };
});

test("Beyond the Maths shows both projects side by side with the approved copy, undistorted artwork and no links, at every size", async ({ browser }) => {
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900]] as const) {
    const page = await open(browser, width, height); await page.locator("footer").scrollIntoViewIfNeeded(); await page.waitForTimeout(800); const m = await beyond(page), at = `${width}x${height}`;
    expect(m.eyebrow).toBe("BEYOND THE MATHS"); expect(m.heading).toBe("There’s more to Puckle."); expect(m.subtitle, `${at}: eyebrow and heading only`).toBe(2);
    expect(m.cards.map(card => [card.title, card.label, card.description])).toEqual([["Puckle Yard", "COMING SOON", "An experimental space where anyone can create and share projects for others to follow."],
      ["Puckle Clubs", "COMING SOON", width >= 900 ? "Player development tailored to age and need, built on shared coaching knowledge." : "Structured player development tailored to age and need, built on shared coaching knowledge."]]);
    const [yard, clubs] = m.cards;
    expect(Math.abs(yard.box.top - clubs.box.top), `${at}: side by side`).toBeLessThanOrEqual(1); expect(clubs.box.left, `${at}: second panel to the right`).toBeGreaterThanOrEqual(yard.box.right);
    expect(Math.abs(yard.box.width - clubs.box.width), `${at}: balanced widths`).toBeLessThanOrEqual(1); expect(Math.abs(yard.box.height - clubs.box.height), `${at}: balanced heights`).toBeLessThanOrEqual(1);
    for (const card of m.cards) {
      expect(card.loaded, `${at}: ${card.title} artwork loaded`).toBe(true); expect(Math.abs(card.ratio / card.natural - 1), `${at}: ${card.title} artwork keeps its ratio`).toBeLessThanOrEqual(0.01);
      expect(card.links, `${at}: no links in the project panels`).toBe(0); expect(card.clipped, `${at}: ${card.title} text is not clipped`).toBe(false);
      expect(card.titleSize, `${at}: title stays readable`).toBeGreaterThanOrEqual(16); expect(card.descSize, `${at}: description stays readable`).toBeGreaterThanOrEqual(13);
    }
    expect(Math.abs(yard.labelTop - clubs.labelTop), `${at}: the labels line up`).toBeLessThanOrEqual(1);
    for (const card of m.cards) { expect(card.artBottom, `${at}: ${card.title} artwork stays clear of the title`).toBeLessThanOrEqual(card.textTop + 1); expect(card.artWidth / card.panelWidth, `${at}: ${card.title} artwork is substantial`).toBeGreaterThan(0.85); }
    expect(m.navBottom, `${at}: footer links sit above the waves, on the dark background`).toBeLessThanOrEqual(m.wavesTop);
    expect(m.invite, `${at}: contact invitation link`).toMatchObject({ href: "/contact", text: "Get in touch." }); expect(m.prompt).toBe("Want to know more or be involved?");
    expect(m.invite!.top, `${at}: invitation sits below the panels`).toBeGreaterThan(m.cardsBottom); expect(m.invite!.height).toBeGreaterThanOrEqual(44); expect(m.invite!.bg).toBe("rgb(255, 250, 240)");
    expect(m.footerLinks, `${at}: footer navigation`).toEqual([["Home", "/"], ["Contact", "/contact"], ["Privacy", "/privacy"]]);
    expect(m.footerWidth, `${at}: the footer spans the page`).toBe(width); expect(m.wordmark, `${at}: wordmark inside the viewport`).toBeLessThanOrEqual(width);
    await noOverflow(page); await page.context().close();
  }
});

test("the Beyond the Maths section and footer keep to their approved caps: 900px section, 438px panels, 40px titles, 136px wordmark, 200px waves, full-width waves, artwork scaling", async ({ browser }) => {
  for (const [width, height] of [[390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]] as const) {
    const page = await open(browser, width, height); await page.locator("footer").scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const section = document.getElementById("beyond-title")!.closest("section")!, card = section.querySelector("ul > li") as HTMLElement, footer = document.querySelector("footer")!, svg = footer.querySelector("svg")!;
      const box = section.getBoundingClientRect(), style = getComputedStyle(card), content = card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return { sectionW: box.width, left: box.left, right: innerWidth - box.right, panelW: card.getBoundingClientRect().width, title: parseFloat(getComputedStyle(card.querySelector("h3")!).fontSize),
        art: card.querySelector("img")!.getBoundingClientRect().width / content, wordmark: parseFloat(getComputedStyle(footer.querySelector("[aria-hidden='true']:not(svg)")!).fontSize),
        waveH: svg.getBoundingClientRect().height, waveW: svg.getBoundingClientRect().width, waveRight: svg.getBoundingClientRect().right, innerLeft: footer.querySelector("nav")!.getBoundingClientRect().left };
    });
    const at = `${width}px`;
    expect(m.sectionW, `${at}: section no wider than 900px`).toBeLessThanOrEqual(900.5); expect(Math.abs(m.left - m.right), `${at}: section is centred`).toBeLessThanOrEqual(1);
    expect(m.panelW, `${at}: panels no wider than 438px`).toBeLessThanOrEqual(439); expect(m.title, `${at}: titles no larger than 40px`).toBeLessThanOrEqual(40);
    expect(m.wordmark, `${at}: wordmark no larger than 136px`).toBeLessThanOrEqual(136); expect(m.waveH, `${at}: wave band no taller than 200px`).toBeLessThanOrEqual(200.5);
    expect(m.waveW, `${at}: waves span the full width`).toBeGreaterThanOrEqual(width - 1); expect(Math.abs(m.waveRight - width), `${at}: waves reach the right edge`).toBeLessThanOrEqual(1);
    expect(Math.abs(m.art - (width < 760 ? 1.22 : 1.12)), `${at}: artwork scale`).toBeLessThanOrEqual(0.03);
    if (width >= 1280) expect(m.innerLeft, `${at}: footer navigation keeps the 1120px alignment`).toBeLessThan(m.left);
    await noOverflow(page); await page.context().close();
  }
});

test("the Clubs description loses \"Structured\" from 900px: exactly one wording is shown at 899px and at 900px", async ({ browser }) => {
  for (const [width, wording] of [[899, "Structured player development tailored to age and need, built on shared coaching knowledge."], [900, "Player development tailored to age and need, built on shared coaching knowledge."]] as const) {
    const page = await open(browser, width, 900);
    const shown = await page.evaluate(() => [...document.querySelectorAll("section[aria-labelledby='beyond-title'] li p")].filter(paragraph => paragraph.getClientRects().length > 0 && /player development/i.test(paragraph.textContent!)).map(paragraph => paragraph.textContent));
    expect(shown, `${width}px`).toEqual([wording]); await page.context().close();
  }
});

test("on a very narrow phone the invitation stacks and the panels stay side by side", async ({ browser }) => {
  const page = await open(browser, 320, 568); await page.locator("footer").scrollIntoViewIfNeeded(); const m = await beyond(page);
  expect(m.invite!.top).toBeGreaterThan(m.cardsBottom); await noOverflow(page);
  const prompt = await page.evaluate(() => { const link = document.getElementById("beyond-title")!.closest("section")!.querySelector("a[href='/contact']")!, text = link.previousElementSibling!.getBoundingClientRect(); return link.getBoundingClientRect().top >= text.bottom - 1; });
  expect(prompt, "button sits beneath the question on a narrow phone").toBe(true);
});

test("both project artworks load and fill their panels on a 2x retina phone at 320px and 390px", async ({ browser }) => {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 700 }, deviceScaleFactor: 2 }), page = await context.newPage(); await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.locator("footer").scrollIntoViewIfNeeded(); const images = page.locator("section[aria-labelledby='beyond-title'] img");
    for (const index of [0, 1]) await expect.poll(() => images.nth(index).evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0), { message: `${width}px: artwork ${index} loads`, timeout: 20000 }).toBe(true);
    await noOverflow(page); await context.close();
  }
});

test("the Beyond the Maths section and footer are homepage only: other Puckle pages keep their plain footer", async ({ browser }) => {
  const page = await open(browser, 1280, 800); await page.goto(`${origin}/privacy`, { waitUntil: "networkidle" });
  expect(await page.locator("footer svg").count()).toBe(0); expect(await page.locator("footer nav a").allTextContents()).toEqual(["Home", "Contact", "Privacy"]);
  expect(await page.locator("footer").evaluate(element => element.getBoundingClientRect().width)).toBeLessThan(1280); await page.context().close();
});

test("screenshots of Beyond the Maths and the footer for review", async ({ browser }) => {
  for (const [name, width, height] of [["phone", 390, 844], ["ipad-landscape", 1024, 768], ["laptop", 1440, 900]] as const) {
    const page = await open(browser, width, height); await page.locator("footer").scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
    const top = await page.evaluate(() => document.getElementById("beyond-title")!.getBoundingClientRect().top + scrollY - 40);
    await page.screenshot({ path: `phase2-test-results/beyond-${name}.png`, fullPage: true, clip: { x: 0, y: top, width, height: (await page.evaluate(() => document.documentElement.scrollHeight)) - top } }); await page.context().close();
  }
});

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

test("the Learning heading introduces all three steps: 56px above Learn from 1024px, unchanged spacing on phones and tablet portrait, and the Explore video is sized with the others", async ({ browser }) => {
  for (const [width, heading] of [[390, 36], [768, 36], [1024, 56], [1280, 56], [1440, 56], [1920, 56]] as const) {
    const page = await open(browser, width, 800), gaps = await page.evaluate(() => {
      const top = (element: Element) => element.getBoundingClientRect();
      const h2 = document.getElementById("learning-title")!, beats = [...h2.closest("section")!.querySelectorAll(":scope > div")];
      return { heading: top(beats[0]).top - top(h2).bottom, between: top(beats[1]).top - top(beats[0]).bottom };
    });
    expect(Math.abs(gaps.heading - heading), `${width}px: heading to first step is about ${heading}px`).toBeLessThanOrEqual(2);
    if (width >= 900) expect(gaps.between, `${width}px: gap between steps unchanged`).toBeGreaterThanOrEqual(55);
    const learn = await columns(page, "Explanations"), explore = await columns(page, "Interactive");
    if (width < 900) expect(Math.abs(explore.media - learn.media), `${width}px: Explore is the same width as Learn`).toBeLessThanOrEqual(1);
    else expect(explore.media, `${width}px: Explore is capped at 500px`).toBeLessThanOrEqual(500.5);
    await noOverflow(page); await page.screenshot({ path: `phase2-test-results/homepage-learning-${width}.png` });
    await page.context().close();
  }
});

test("an early Request a free session button sits centred under the hero bridge text, and the Keep / Learn ideas stack on small phones", async ({ browser }) => {
  for (const [width, height] of [[360, 740], [390, 844], [480, 900], [700, 900], [1024, 768], [1280, 800]] as const) {
    const page = await open(browser, width, height);
    if (width >= 760) { // the hero has its own button from here, so the early one must not be shown
      await expect(page.getByText("Free 20–30 minute online maths session."), `${width}px: early button hidden`).toBeHidden();
    }
    const early = width >= 760 ? null : await page.evaluate(() => {
      const bridge = [...document.querySelectorAll("p")].find(p => p.textContent === "Card by Card. Step by step.")!.parentElement!;
      const link = bridge.querySelector("a[href='#early-access']")!, note = bridge.querySelector("a + p, div > p:last-child")!, rect = (e: Element) => e.getBoundingClientRect();
      const text = bridge.querySelector("p:nth-child(2)")!, next = document.querySelector("#learning-title")!.closest("section")!;
      return { label: link.textContent, note: note.textContent, centre: (rect(link).left + rect(link).right) / 2 - (rect(bridge).left + rect(bridge).right) / 2,
        below: rect(link).top - rect(text).bottom, noteGap: rect(note).top - rect(link).bottom, gapAfter: rect(next).top - rect(note).bottom };
    });
    if (early) {
      expect(early.label).toBe("Request a free session"); expect(early.note).toBe("Free 20–30 minute online maths session.");
      expect(Math.abs(early.centre), `${width}px: button centred in the block`).toBeLessThanOrEqual(2);
      expect(early.below, `${width}px: space above`).toBeGreaterThanOrEqual(16); expect(early.gapAfter, `${width}px: space before the next section`).toBeGreaterThan(24);
    }
    const ideas = await page.evaluate(() => {
      const items = [...document.querySelectorAll("li")].filter(li => /^(Keep what helps|Learn from others)\./.test(li.textContent!)).map(li => li.getBoundingClientRect());
      return { sideBySide: Math.abs(items[0].top - items[1].top) < 4, gap: items[1].top - items[0].bottom, overflow: items.some(r => r.left < -1 || r.right > innerWidth + 1) };
    });
    expect(ideas.overflow, `${width}px: no overflow`).toBe(false);
    expect(ideas.sideBySide, `${width}px: ideas ${width < 480 ? "stacked" : "side by side"}`).toBe(width >= 480);
    if (width < 480) expect(ideas.gap).toBeGreaterThanOrEqual(8);
    await noOverflow(page);
    await page.screenshot({ path: `phase2-test-results/homepage-early-cta-${width}.png`, fullPage: false });
    if (early) {
      await page.getByText("Free 20–30 minute online maths session.").locator("..").locator("a").click(); await page.waitForTimeout(600);
      expect(Math.abs((await landing(page)).sectionTop), `${width}px: early button reaches the registration section`).toBeLessThanOrEqual(2);
    }
    await page.context().close();
  }
});

test("the hero area shows exactly one Request a free session button at every width: under the image on phones, in the text block from 760px", async ({ browser }) => {
  for (const [width, height] of [[320, 568], [390, 844], [480, 900], [700, 900], [759, 900], [760, 900], [768, 1024], [834, 1112], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]] as const) {
    const page = await open(browser, width, height);
    const visible = await page.evaluate(() => {
      const hero = document.getElementById("home-hero-title")!.closest("section")!;
      return [...hero.querySelectorAll("a[href='#early-access']")].filter(link => { const box = link.getBoundingClientRect(); return box.width > 0 && box.height > 0; }).length;
    });
    expect(visible, `${width}px: visible hero buttons`).toBe(1); await page.context().close();
  }
});

test("Test yourself is one complete 4:3 image: loaded, undistorted, sized like Learn, with no separately rendered worksheet, thumbnail, label or panel", async ({ browser }) => {
  for (const [width, height] of [[390, 844], [768, 1024], [1024, 768], [1440, 900]] as const) {
    const page = await open(browser, width, height);
    const beat = page.locator("h3", { hasText: "Comments on your work" }).locator("xpath=../..");
    await beat.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const copy = [...document.querySelectorAll("h3")].find(element => element.textContent!.startsWith("Comments"))!.parentElement!, beatEl = copy.parentElement!, figure = copy.nextElementSibling as HTMLElement;
      const learnFigure = ([...document.querySelectorAll("h3")].find(element => element.textContent!.startsWith("Explanations"))!.parentElement!.nextElementSibling) as HTMLElement;
      const image = figure.querySelector("img")!, box = image.getBoundingClientRect();
      return { tag: figure.tagName, images: beatEl.querySelectorAll("img").length, roleImg: beatEl.querySelectorAll("[role='img']").length, label: beatEl.textContent!.includes("Personal video feedback"),
        src: decodeURIComponent(image.currentSrc), loaded: image.complete && image.naturalWidth > 0, ratio: box.width / box.height, natural: image.naturalWidth / image.naturalHeight,
        width: figure.getBoundingClientRect().width, learnWidth: learnFigure.getBoundingClientRect().width, alt: image.alt };
    });
    const at = `${width}px`;
    expect(m.tag).toBe("FIGURE"); expect(m.images, `${at}: one image only`).toBe(1); expect(m.roleImg, `${at}: no wrapper panel`).toBe(0); expect(m.label, `${at}: no separate label`).toBe(false);
    expect(m.src, `${at}: uses test-yourself-v2`).toContain("test-yourself-v2.png"); expect(m.loaded).toBe(true); expect(m.alt).toContain("Kane");
    expect(Math.abs(m.ratio - 4 / 3), `${at}: 4:3 ratio`).toBeLessThan(0.02); expect(Math.abs(m.ratio - m.natural)).toBeLessThan(0.01);
    if (width < 900) expect(Math.abs(m.width - m.learnWidth), `${at}: same width as Learn`).toBeLessThanOrEqual(1); else expect(Math.abs(m.width - 480), `${at}: 480px column`).toBeLessThanOrEqual(1);
    await noOverflow(page); await beat.screenshot({ path: `phase2-test-results/test-yourself-${width}.png` }); await page.context().close();
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
      const box = element.getBoundingClientRect(), strip = element.parentElement!.nextElementSibling!.getBoundingClientRect(), figureBox = figure.getBoundingClientRect(), style = getComputedStyle(figure);
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
  expect(await paused(blockedPage)).toBe(true); expect(await blockedPage.locator("img[data-explore-poster]").getAttribute("src"), "poster stays over the video").toContain("cone-poster-v2");
  await blockedPage.getByRole("button", { name: "Play" }).click(); await expect.poll(() => paused(blockedPage)).toBe(false); await blocked.close();
});

test("the Explore animation never shows the dark page through while its first frame loads: the poster covers it until a frame is painted", async ({ browser }) => {
  const sharp = (await import("sharp")).default;
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } }), page = await context.newPage();
  await page.route("**/cone-unroll-v2.mp4", async (route) => { await new Promise((resolve) => setTimeout(resolve, 700)); await route.continue(); }); // a cold, slow first load
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  const video = exploreVideo(page), poster = page.locator("img[data-explore-poster]");
  await expect(poster).toHaveCount(1); await bringIntoView(page);
  const box = (await video.boundingBox())!, brightness: number[] = [];
  for (let sample = 0; sample < 16; sample++) {
    const { data, info } = await sharp(await page.screenshot({ clip: { x: box.x + 20, y: box.y + 10, width: box.width - 40, height: box.height - 20 } })).raw().toBuffer({ resolveWithObject: true });
    let sum = 0; for (let index = 0; index < data.length; index += info.channels) sum += data[index] + data[index + 1] + data[index + 2];
    brightness.push(Math.round(sum / (data.length / info.channels) / 3));
  }
  expect(Math.min(...brightness), `no dark frames while loading: ${brightness}`).toBeGreaterThan(150);
  await expect.poll(() => paused(page)).toBe(false); await expect(poster).toHaveCount(0); // removed once a frame is painted
  await context.close();
});
