import { expect, test, type Page } from "@playwright/test";

const sample = (page: Page) => page.locator("[data-capacity-case='mixed']");
async function open(page: Page) {
  await page.goto("/dev/maths-renderer");
  await page.waitForFunction(() => !!window.mathsFixtures?.mixed);
  await page.locator("[data-regression-fixtures]").evaluate(element => { (element as HTMLDetailsElement).open = true; });
}
async function render(page: Page, content: string) {
  await page.evaluate(content => window.mathsFixtures!.mixed.update({ content, width: 520, height: null }), content);
  await expect(sample(page).locator("[data-capacity-source]")).toHaveText(content);
  await expect.poll(async () => JSON.parse((await sample(page).locator("[data-capacity-result]").textContent())!)?.status).toBe("ready");
  return sample(page).locator("[data-maths-renderer]");
}

test("specification examples preserve authored prose, dollars, currency and literal markup", async ({ page }) => {
  await open(page);
  let root = await render(page, String.raw`Solve $x^2=9$, so $x=\pm3$.`);
  await expect(root.locator("[data-maths-expression='inline']")).toHaveCount(2);
  await expect(root.locator("[data-maths-paragraph]")).toHaveCount(1);
  root = await render(page, "First, divide both sides by 3.\n$$x=\\frac{12}{3}$$\nTherefore,\n$$x=4$$");
  expect(await root.evaluate(element => [...element.children].map(child => child.hasAttribute("data-maths-display") ? "math" : child.textContent))).toEqual(["First, divide both sides by 3.", "math", "Therefore,", "math"]);
  root = await render(page, String.raw`Costs: \$5, €6 and £7. Maths: $\$5+\pounds7+\text{€}6$.
**No Markdown** <img src=x onerror=alert(1)>`);
  await expect(root.locator("[data-maths-expression='inline']")).toHaveCount(1);
  await expect(root.locator("img,script,strong,em")).toHaveCount(0);
  const prose = await root.locator("[data-maths-paragraph]").evaluate(element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(""));
  expect(prose).toBe("Costs: $5, €6 and £7. Maths: .\n**No Markdown** <img src=x onerror=alert(1)>");
});

test("long display working stays natural and reports both insufficient dimensions", async ({ page }, info) => {
  await open(page);
  const source = String.raw`Before.
$$\begin{aligned}a+b+c+d+e+f+g+h+i+j+k+l+m+n+o+p&=\sqrt{\frac{x^2+1}{y+2}}\\x&=\frac{12}{3}\\x&=4\end{aligned}$$
Therefore.`;
  await render(page, source);
  await page.evaluate(() => window.mathsFixtures!.mixed.update({ width: 90, height: 20 }));
  await expect.poll(async () => {
    const result = JSON.parse((await sample(page).locator("[data-capacity-result]").textContent())!);
    return result?.status === "ready" ? [result.layout.available.width, result.layout.overflowX, result.layout.overflowY] : null;
  }).toEqual([90, true, true]);
  const geometry = await sample(page).locator("[data-maths-renderer]").evaluate(element => {
    const style = getComputedStyle(element), math = element.querySelector(".katex-html")!;
    return { height: element.getBoundingClientRect().height, overflow: style.overflow, maxHeight: style.maxHeight, transform: style.transform,
      // KaTeX can append an empty positioning span; only cell-bearing spans
      // represent authored working rows.
      visualRows: [...math.querySelectorAll(".mtable > .col-align-r > .vlist-t > .vlist-r > .vlist > span")].filter(row => row.lastElementChild !== null).length,
      // The .katex-html block follows the constrained width; its intrinsic
      // table is the overflowing mathematical content that must stay intact.
      mathWidth: math.querySelector(".mtable")!.getBoundingClientRect().width, fontSize: parseFloat(style.fontSize) };
  });
  expect(geometry.height).toBeGreaterThan(20); expect(geometry.mathWidth).toBeGreaterThan(90);
  expect(geometry.visualRows).toBe(3); expect(geometry.fontSize).toBe(18);
  expect(geometry.overflow).toBe("visible"); expect(geometry.maxHeight).toBe("none"); expect(geometry.transform).toBe("none");
  await expect(sample(page).locator("[data-capacity-source]")).toHaveText(source);
  await info.attach("acceptance-overflow", { body: JSON.stringify(geometry), contentType: "application/json" });
});

test("loading the renderer stylesheet leaves neighbouring prose and engine-like class names unchanged", async ({ page }) => {
  async function neighbour() {
    return page.evaluate(() => {
      const host = document.createElement("div"); host.style.cssText = "font: 17px/25px Arial; width:300px";
      host.innerHTML = '<p>Neighbour prose</p><span class="katex">Outside the renderer</span>';
      document.body.append(host);
      const read = (element: Element) => { const s = getComputedStyle(element), r = element.getBoundingClientRect(); return { fontSize: s.fontSize, fontFamily: s.fontFamily, lineHeight: s.lineHeight, whiteSpace: s.whiteSpace, display: s.display, counterReset: s.counterReset, width: r.width, height: r.height }; };
      const result = { bodyCounter: getComputedStyle(document.body).counterReset, prose: read(host.firstElementChild!), outside: read(host.lastElementChild!) };
      host.remove(); return result;
    });
  }
  await page.goto("/maths-acceptance-nonexistent"); const before = await neighbour();
  await page.goto("/dev/maths-renderer"); await page.waitForFunction(() => !!window.mathsFixtures?.mixed);
  expect(await neighbour()).toEqual(before);
});
