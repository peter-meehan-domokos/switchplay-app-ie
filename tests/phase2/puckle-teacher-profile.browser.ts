import { test, expect, type Browser, type Page } from "@playwright/test";

// Personal Support: the teacher profile beneath the portrait and its "Read more" dialog.
const origin = process.env.PHASE2_BASE_URL!;
async function open(browser: Browser, width: number, height: number, options: { reducedMotion?: "reduce" } = {}): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height }, locale: "en-IE", ...options });
  const page = await context.newPage(); await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  await page.locator("#tuition-title").scrollIntoViewIfNeeded(); return page;
}
const trigger = (page: Page) => page.getByRole("button", { name: "Read more" });
const dialog = (page: Page) => page.getByRole("dialog", { name: "Peter Meehan-Domokos" });
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
const settled = (page: Page) => page.waitForTimeout(450);

test("the profile shows the supplied text under the unchanged photograph, grouped, without overflow, at every size", async ({ browser }) => {
  for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1024, 768], [1440, 900]] as const) {
    const page = await open(browser, width, height), at = `${width}px`;
    const m = await page.evaluate(() => {
      const section = document.querySelector("section[aria-labelledby='tuition-title']")!, figure = section.querySelector("figure")!, image = figure.querySelector("img")!, caption = figure.querySelector("figcaption")!;
      const [name, quals, experience] = [...caption.querySelectorAll(":scope > p")] as HTMLElement[], rect = (e: Element) => e.getBoundingClientRect(), button = caption.querySelector("button")!;
      return { src: decodeURIComponent(image.currentSrc), photoW: rect(image).width, ratio: rect(image).width / rect(image).height, radius: getComputedStyle(image).borderRadius, texts: [name.textContent, quals.textContent, [...experience.children].map(c => c.textContent), button.textContent],
        gapName: rect(name).top - rect(image).bottom, gapQuals: rect(quals).top - rect(name).bottom, gapExp: rect(experience).top - rect(quals).bottom, lines: [...experience.children].map(c => Math.round(rect(c).height)), nameSize: parseFloat(getComputedStyle(name).fontSize),
        within: [name, quals, experience, button].every(e => rect(e).right <= innerWidth + 1), buttonH: rect(button).height, captionRight: rect(caption).right, paragraphGap: rect(section.querySelector("p[class*='body']")!).top - rect(caption).bottom, family: getComputedStyle(name).fontFamily };
    });
    expect(m.src, `${at}: existing photograph`).toContain("puckle-tutor-photo-v2.jpg"); expect(Math.abs(m.ratio - 0.75)).toBeLessThan(0.01); expect(m.radius).toBe("20px");
    expect(m.photoW, `${at}: photo width`).toBeCloseTo(width < 720 ? 220 : width < 900 ? 260 : 286, 0);
    expect(m.texts).toEqual(["Peter Meehan-Domokos", "PGCE · MSc · Qualified Teacher Status", ["15+ years teaching secondary maths"], "Read more"]);
    expect(m.family, `${at}: Space Grotesk name`).toContain("Space Grotesk"); expect(m.nameSize).toBeGreaterThanOrEqual(20); expect(m.nameSize).toBeLessThanOrEqual(24);
    expect(m.gapName, `${at}: photo to name`).toBeGreaterThanOrEqual(14); expect(m.gapName).toBeLessThanOrEqual(22); expect(m.gapQuals).toBeLessThanOrEqual(7); expect(m.gapExp).toBeGreaterThanOrEqual(9); expect(m.gapExp).toBeLessThanOrEqual(13);
    expect(m.within, `${at}: nothing past the viewport`).toBe(true); expect(m.buttonH, `${at}: comfortable tap target`).toBeGreaterThanOrEqual(44);
    if (width < 720) { expect(m.paragraphGap, `${at}: gap before the description`).toBeGreaterThanOrEqual(15); expect(m.paragraphGap).toBeLessThanOrEqual(17); }
    await noOverflow(page); await page.locator("section[aria-labelledby='tuition-title']").screenshot({ path: `phase2-test-results/teacher-profile-${width}.png` }); await page.context().close();
  }
});

// Personal Support layout: stacked on phones, heading over photo | description on tablet portrait (from 720px), photo | heading and description
// from 900px. In both two-column layouts the right-hand content starts level with the photo and the heading never sinks below it.
test("Personal Support lays out stacked below 720px, in two columns with a full-width heading from 720px, and heading plus description beside the photo from 900px", async ({ browser }) => {
  for (const [width, height] of [[390, 844], [719, 1000], [720, 1000], [744, 1133], [768, 1024], [834, 1194], [899, 1000], [900, 1000], [1024, 768], [1133, 744], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440]] as const) {
    const page = await open(browser, width, height), at = `${width}x${height}`;
    const m = await page.evaluate(() => {
      const section = document.querySelector("section[aria-labelledby='tuition-title']")!, origin = section.getBoundingClientRect(), rect = (element: Element) => { const box = element.getBoundingClientRect(); return { left: box.left - origin.left, top: box.top - origin.top, width: box.width, height: box.height, bottom: box.bottom - origin.top }; };
      const figure = rect(section.querySelector("figure")!), header = rect(section.querySelector("header")!), copy = rect(section.querySelector("div[class*='tuitionCopy']")!), image = section.querySelector("figure img")!, imageBox = image.getBoundingClientRect();
      const pills = [...section.querySelectorAll("ul[aria-label='Ways to learn'] li")].map(li => li.getBoundingClientRect()), cta = section.querySelector("a[href='#early-access']")!.getBoundingClientRect(), box = section.getBoundingClientRect();
      return { figure, header, copy, section: rect(section), radius: getComputedStyle(image).borderRadius, imageW: imageBox.width, pillsRight: Math.max(...pills.map(pill => pill.right)) - box.left, ctaRight: cta.right - box.left, pillCount: pills.length, sectionWidth: box.width };
    });
    expect(m.radius, `${at}: rounded corners unchanged`).toBe("20px"); expect(m.pillCount).toBe(3);
    expect(m.pillsRight, `${at}: option pills stay inside the section`).toBeLessThanOrEqual(m.sectionWidth + 1); expect(m.ctaRight).toBeLessThanOrEqual(m.sectionWidth + 1);
    if (width < 720) { expect(m.copy.top, `${at}: stacked, description below the profile`).toBeGreaterThanOrEqual(m.figure.bottom - 9); expect(m.copy.left).toBeLessThan(2); expect(m.figure.top).toBeGreaterThan(m.header.bottom - 1); }
    else if (width < 900) {
      expect(m.header.width, `${at}: heading has a full-width row`).toBeGreaterThanOrEqual(600); expect(m.figure.top, `${at}: photo below the heading`).toBeGreaterThanOrEqual(m.header.bottom + 20);
      expect(Math.abs(m.copy.top - m.figure.top), `${at}: description starts level with the photo`).toBeLessThanOrEqual(2); expect(m.figure.width).toBeCloseTo(260, 0); expect(m.copy.left, `${at}: description in the right column`).toBeGreaterThanOrEqual(m.figure.width + 30);
      expect(m.copy.width, `${at}: description column wide enough`).toBeGreaterThanOrEqual(340);
    } else {
      expect(Math.abs(m.header.top - m.figure.top), `${at}: heading starts level with the photo`).toBeLessThanOrEqual(2); expect(m.figure.width).toBeCloseTo(286, 0); expect(m.copy.left - m.figure.width, `${at}: 30px between photo and text`).toBeCloseTo(30, 0);
      expect(m.copy.top - m.header.bottom, `${at}: heading and description form one block`).toBeLessThanOrEqual(18); expect(m.copy.bottom).toBeLessThanOrEqual(m.figure.bottom + 1);
      expect(m.figure.bottom - m.copy.bottom, `${at}: only modest whitespace below the description`).toBeLessThanOrEqual(170);
    }
    await noOverflow(page); await page.locator("section[aria-labelledby='tuition-title']").screenshot({ path: `phase2-test-results/personal-support-${width}.png` }); await page.context().close();
  }
});

test("Read more opens a labelled modal dialog with the supplied content, and Escape, the close button and the backdrop each close it and return focus", async ({ browser }) => {
  const page = await open(browser, 1024, 768), before = page.url();
  await trigger(page).click(); await expect(dialog(page)).toBeVisible(); await settled(page);
  expect(page.url(), "no navigation").toBe(before);
  for (const text of ["TEACHER PROFILE", "Qualified secondary mathematics teacher", "PGCE · MSc · Qualified Teacher Status (QTS)", "Over 15 years teaching secondary mathematics, with experience helping students develop conceptual understanding and confidence in their mathematical ability.",
    "I believe students learn mathematics best when they understand why something works, not simply memorise methods. I use clear explanations, practical examples and opportunities to explore ideas for themselves.", "Evidence of teaching qualifications and professional references is available on request."]) await expect(dialog(page).getByText(text, { exact: true })).toBeVisible();
  expect(await dialog(page).getByRole("heading", { level: 3 }).allTextContents()).toEqual(["Qualifications", "Teaching experience", "My approach", "Qualifications and references"]);
  expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null), "focus moved into the dialog").toBe(true);
  expect(await page.evaluate(() => document.documentElement.style.overflow), "page scroll locked").toBe("hidden");
  for (let index = 0; index < 5; index++) { await page.keyboard.press("Tab"); expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null), "Tab stays inside").toBe(true); }
  await page.keyboard.press("Shift+Tab"); expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);
  const box = (await dialog(page).boundingBox())!; expect(box.width).toBeLessThanOrEqual(512.5); expect(box.width).toBeGreaterThanOrEqual(480);
  await dialog(page).getByText("Over 15 years teaching").click(); await settled(page); await expect(dialog(page), "click inside does not dismiss").toBeVisible();
  await page.keyboard.press("Escape"); await expect(dialog(page)).toBeHidden(); await expect(trigger(page), "focus returns to Read more").toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow), "page scroll restored").toBe("");
  await trigger(page).click(); await expect(dialog(page)).toBeVisible(); await dialog(page).getByRole("button", { name: "Close teacher profile" }).click(); await expect(dialog(page)).toBeHidden(); await expect(trigger(page)).toBeFocused();
  await trigger(page).click(); await expect(dialog(page)).toBeVisible(); await settled(page); await page.mouse.click(6, 6); await expect(dialog(page), "backdrop click closes").toBeHidden(); await expect(trigger(page)).toBeFocused();
  await page.context().close();
});

test("rapid interaction leaves the dialog in a consistent state: repeated clicks, repeated Escape and reopening straight after closing", async ({ browser }) => {
  const page = await open(browser, 390, 844);
  await trigger(page).evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); }); await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await expect(dialog(page)).toBeHidden();
  expect(await page.evaluate(() => document.querySelectorAll("dialog[open]").length)).toBe(0); expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  for (let round = 0; round < 3; round++) { await trigger(page).click(); await page.keyboard.press("Escape"); await page.waitForTimeout(60); }
  await expect(dialog(page)).toBeHidden(); await expect(trigger(page)).toBeFocused();
  await trigger(page).click(); await expect(dialog(page)).toBeVisible(); await settled(page);
  expect(await dialog(page).evaluate(element => getComputedStyle(element).opacity), "fully open after the rapid sequence").toBe("1");
  await page.keyboard.press("Escape"); await expect(dialog(page)).toBeHidden(); await page.context().close();
});

test("on a short phone screen the biography scrolls inside the dialog while the close button stays on screen, with no page scrolling or overflow", async ({ browser }) => {
  const page = await open(browser, 390, 520);
  await trigger(page).click(); await expect(dialog(page)).toBeVisible(); await settled(page);
  const scrollBefore = await page.evaluate(() => scrollY); // after opening: the click itself scrolls Read more into view on a short screen
  const m = await page.evaluate(() => { const body = document.querySelector("dialog[open] [class*='dialogBody']") as HTMLElement, box = document.querySelector("dialog[open]")!.getBoundingClientRect(); return { scrollable: body.scrollHeight > body.clientHeight + 1, fits: box.top >= 15 && box.bottom <= innerHeight - 15, left: box.left, right: innerWidth - box.right }; });
  expect(m.scrollable, "content scrolls inside the dialog").toBe(true); expect(m.fits, "dialog stays within the viewport with margins").toBe(true); expect(m.left).toBeGreaterThanOrEqual(15.5); expect(m.right).toBeGreaterThanOrEqual(15.5);
  await dialog(page).locator("[class*='dialogBody']").evaluate(element => { element.scrollTop = element.scrollHeight; });
  const close = (await dialog(page).getByRole("button", { name: "Close teacher profile" }).boundingBox())!; expect(close.y).toBeGreaterThanOrEqual(0); expect(close.y + close.height).toBeLessThanOrEqual(520); expect(close.width).toBeGreaterThanOrEqual(44);
  await page.mouse.wheel(0, 400); expect(await page.evaluate(() => scrollY), "the page behind does not scroll").toBe(scrollBefore); await noOverflow(page);
  await page.screenshot({ path: "phase2-test-results/teacher-profile-modal-390x520.png" }); await page.keyboard.press("Escape"); await expect(dialog(page)).toBeHidden(); await page.context().close();
});

test("with reduced motion the dialog appears and disappears without animation", async ({ browser }) => {
  const page = await open(browser, 768, 1024, { reducedMotion: "reduce" });
  await trigger(page).click(); await expect(dialog(page)).toBeVisible();
  expect(await dialog(page).evaluate(element => getComputedStyle(element).transitionDuration), "no transition").toBe("0s");
  await page.keyboard.press("Escape"); await expect(dialog(page)).toBeHidden({ timeout: 150 }); await page.context().close();
});

for (const [name, width, height] of [["phone", 390, 844], ["ipad", 768, 1024], ["laptop", 1440, 900]] as const) {
  test(`modal screenshots: ${name}`, async ({ browser }) => {
    const page = await open(browser, width, height); await trigger(page).click(); await expect(dialog(page)).toBeVisible(); await settled(page);
    await page.screenshot({ path: `phase2-test-results/teacher-modal-${name}.png` }); await noOverflow(page); await page.context().close();
  });
}
