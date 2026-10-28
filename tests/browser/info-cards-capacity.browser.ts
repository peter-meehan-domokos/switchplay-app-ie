import { expect, test } from "@playwright/test";
import { INFO_CAPACITY, measureInfoCapacity, textWidth } from "../../src/lib/infoCards/capacity";

for (const viewport of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
  test(`server capacity bounds real face at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await page.goto("/info-cards");
    await page.getByRole("button", { name: "Static open", exact: true }).click();
    const face = page.locator("[data-info-card-face]"); await expect(face).toBeVisible();
    const measurements = [];
    for (const sample of ["maths", "basketball", "long-header", "over-capacity", "no-media"]) {
      await page.getByRole("combobox").selectOption(sample === "no-media" ? "maths" : sample);
      await page.getByRole("checkbox", { name: "Media", exact: true }).setChecked(sample !== "no-media");
      const actual = await face.evaluate(node => {
        const root = node as HTMLElement, header = root.querySelector<HTMLElement>("[data-info-card-header]")!, body = root.querySelector<HTMLElement>("[data-info-card-body]")!;
        const paragraphs = [...body.querySelectorAll("p")];
        const series = root.querySelector("button[aria-expanded]")!;
        const scale = root.getBoundingClientRect().height / root.offsetHeight;
        const range = document.createRange(); range.selectNodeContents(header);
        const bounds = range.getBoundingClientRect();
        return { title: root.querySelector("[data-info-card-title]")!.textContent!, seriesTitle: series.textContent!, body: paragraphs.map(p => p.textContent).join("\n\n"), hasMedia: !!root.querySelector("button:not([aria-expanded])"),
          width: root.getBoundingClientRect().width / scale, height: root.offsetHeight,
          headerWidth: bounds.width / scale,
          availableHeader: header.clientWidth - parseFloat(getComputedStyle(header).paddingRight),
          bodyUsed: (paragraphs.at(-1)!.getBoundingClientRect().bottom - body.getBoundingClientRect().top) / scale,
          bodyAvailable: body.getBoundingClientRect().height / scale };
      });
      const predicted = measureInfoCapacity(actual); measurements.push({ sample, actual, predicted });
      expect(actual.width).toBeCloseTo(INFO_CAPACITY.width, 1); expect(actual.height).toBe(204); // Legacy estimator stays conservative at its original height.
      expect(predicted.headerWidth + 0.1).toBeGreaterThanOrEqual(actual.headerWidth);
      expect(predicted.bodyHeight + 0.1).toBeGreaterThanOrEqual(actual.bodyUsed);
      expect(INFO_CAPACITY.headerWidth).toBeLessThanOrEqual(actual.availableHeader);
      expect(predicted.availableBodyHeight).toBeLessThanOrEqual(actual.bodyAvailable + 0.1);
      if (predicted.fits) { expect(actual.bodyUsed).toBeLessThanOrEqual(actual.bodyAvailable); expect(actual.headerWidth).toBeLessThanOrEqual(actual.availableHeader); }
      expect(predicted.fits).toBe(["maths", "basketball", "no-media"].includes(sample));
    }
    await info.attach("capacity", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
  });
}

test("Unicode, explicit breaks, narrow/wide words and near-capacity wrapping stay conservative", async ({ page }) => {
  await page.goto("/info-cards"); await page.getByRole("button", { name: "Static open", exact: true }).click();
  const face = page.locator("[data-info-card-face]"); await expect(face).toBeVisible();
  const samples = ["é α β − π 中文\n\nSigns stay attached.", "W".repeat(23), "i".repeat(90), "word ".repeat(40), "line\nline\nline\n\nlast", "a     b ".repeat(20), "👋🏽 👨‍👩‍👧‍👦 café" ];
  for (const body of samples) {
    const actual = await face.evaluate((node, value) => {
      const root = node as HTMLElement, body = root.querySelector<HTMLElement>("[data-info-card-body]")!;
      // Test only: use the unchanged real face styles, with arbitrary author text.
      body.replaceChildren(...value.split(/\n\s*\n/).map(text => { const p = document.createElement("p"); p.textContent = text; return p; }));
      const scale = root.getBoundingClientRect().height / root.offsetHeight;
      return (body.lastElementChild!.getBoundingClientRect().bottom - body.getBoundingClientRect().top) / scale;
    }, body);
    const predicted = measureInfoCapacity({ title: "Signs", seriesTitle: "Basics", body, hasMedia: true });
    expect(predicted.bodyHeight + 0.1, body).toBeGreaterThanOrEqual(actual);
  }
});

test("font table conservatively bounds every ASCII glyph in the real face fonts", async ({ page }) => {
  const glyphs = await page.evaluate(() => {
    const context = document.createElement("canvas").getContext("2d")!;
    return [400, 700].flatMap(weight => {
      context.font = `${weight} 9.5px Arial`;
      return Array.from({ length: 95 }, (_, i) => { const char = String.fromCharCode(32 + i); return { char, weight, width: context.measureText(char).width }; });
    });
  });
  for (const glyph of glyphs) expect(textWidth(glyph.char, 9.5, glyph.weight === 700 ? "bold" : "regular") + 0.001).toBeGreaterThanOrEqual(glyph.width);
});
