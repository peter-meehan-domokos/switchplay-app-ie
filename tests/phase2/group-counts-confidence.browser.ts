import { chromium, webkit, expect, test, type Browser, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

// Real components, in-memory document, no app server/account/fixture database.
// Legacy Pair is the per-state footprint reference approved by the user.
let script: string, css: string;
test.beforeAll(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React from "react";
    import {createRoot} from "react-dom/client";
    import Pair from "./src/components/group-experiences/ConfidencePair";
    import Back from "./src/components/group-experiences/GroupCardBack";
    const root=createRoot(document.getElementById("fixture"));
    window.pairs=(group,follower,total,face,focused=false)=>root.render(<>
      {[false,true].map(groupCard=><div key={String(groupCard)} data-pair={groupCard?"group":"legacy"} className={focused?"active-card-front--focused":undefined} style={{position:"relative",width:252,height:80,transform:"scale("+(focused?372/252:1)+")",transformOrigin:"top left"}}>
        <header className={"card-semantic-anchors card-semantic-anchors--"+face}><span className="card-confidence"><Pair group={group} follower={follower} activeTotal={total} groupCard={groupCard}/></span></header>
      </div>)}
    </>);
    window.back=(focused,doing,done)=>{
      const steps=["Prepare","Practise","Reflect"].map((title,i)=>({stepId:"s"+i,title,description:"Instruction",completionStatus:"todo"}));
      const card={surface:"experience",id:"card",cardTemplateId:"card",version:1,label:"Card 2",confidence:7,completion:0,canWriteLearning:true,steps,
        learning:{items:[],signalReadings:steps.map(s=>({stepId:s.stepId,reading:4}))},
        aggregates:{followers:{activeTotal:16,confidence:4},steps:steps.map(s=>({stepId:s.stepId,followers:{activeTotal:16,eligibleTotal:16,doing,done,confidence:4}}))}};
      root.render(<div style={{position:"relative",width:252,height:366}}><Back card={card} focused={focused} onChange={()=>{}}/></div>);
    };
  ` }, bundle: true, write: false, outdir: "/tmp/not-written-group-counts-test", platform: "browser", format: "iife", jsx: "automatic", tsconfig: "tsconfig.json",
    loader: { ".ttf": "dataurl", ".woff": "dataurl", ".woff2": "dataurl" }, define: { "process.env.NODE_ENV": '"development"' } });
  script = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  css = await readFile("src/app/globals.css", "utf8") + "\n" + await readFile("src/components/group-experiences/group-experience.css", "utf8")
    + "\n" + result.outputFiles.filter(file => file.path.endsWith(".css")).map(file => file.text).join("\n");
});

async function mount(page: Page) {
  await page.route("**/*", route => route.abort());
  await page.setContent(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="fixture"></div></body></html>`);
  await page.addScriptTag({ content: script });
}

for (const engine of ["chromium", "webkit"] as const) test.describe(`${engine}: scoped count and confidence appearance`, () => {
  let browser: Browser;
  test.beforeAll(async () => { browser = await (engine === "chromium" ? chromium : webkit).launch(); });
  test.afterAll(async () => { await browser?.close(); });

  test("all four G/F states preserve legacy per-state geometry and numeric styling", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await mount(page);
      for (const focused of [false,true]) for (const face of ["front", "back"]) for (const [group, follower] of [[7, 4], [7, null], [null, 4], [null, null], [10, 10], [0, 0]] as const) {
        await page.evaluate(([g, f, face, focused]) => (window as unknown as { pairs: (g: number | null, f: number | null, t: number, face: string, focused: boolean) => void }).pairs(g as number | null, f as number | null, 15, face as string, focused as boolean), [group, follower, face, focused]);
        await expect(page.locator('[data-pair="group"] .group-confidence-pair[data-group-card]')).toHaveCount(1);
        await expect(page.locator('[data-pair="group"] .group-confidence-pair > span')).toHaveText([`${group ?? "—"}G`, `${follower ?? "—"}F`]);
        const appearance = await page.locator("[data-pair]").evaluateAll(elements => elements.map(frame => {
          const origin = frame.getBoundingClientRect(), pair = frame.querySelector(".group-confidence-pair")!, p = pair.getBoundingClientRect();
          return { rect: [p.x-origin.x,p.y-origin.y,p.width,p.height], gap: getComputedStyle(pair).gap,
            slots: Array.from(pair.children).map(slot => {
              const r = slot.getBoundingClientRect(), s = getComputedStyle(slot), sup = slot.querySelector("sup")!, ss = getComputedStyle(sup);
              const mark = getComputedStyle(slot, "::before");
              return { rect: [r.x-origin.x,r.y-origin.y,r.width,r.height], colour: s.color, size: s.fontSize, weight: s.fontWeight,
                supOpacity: Number(ss.opacity), markHeight: parseFloat(mark.height), markOpacity: Number(mark.opacity), missing: slot.classList.contains("group-confidence-missing") };
            }) };
        }));
        const [legacy, quiet] = appearance;
        for (let i = 0; i < 4; i++) expect(Math.abs(quiet.rect[i]-legacy.rect[i])).toBeLessThanOrEqual(.05);
        expect(quiet.gap).toBe("12px"); expect(quiet.slots).toHaveLength(2);
        for (let i = 0; i < 2; i++) {
          const before = legacy.slots[i], after = quiet.slots[i], missing = [group,follower][i] === null;
          for (let j = 0; j < 4; j++) expect(Math.abs(after.rect[j]-before.rect[j])).toBeLessThanOrEqual(.05);
          expect(after.size).toBe(before.size); expect(after.weight).toBe(before.weight); expect(after.supOpacity).toBeLessThanOrEqual(.3);
          expect(after.missing).toBe(missing);
          if (missing) { expect(after.colour).toBe("rgba(0, 0, 0, 0)"); expect(after.markHeight).toBeGreaterThan(0); expect(after.markHeight).toBeLessThanOrEqual(.5); expect(after.markOpacity).toBeLessThanOrEqual(.25); }
          else expect(after.colour).toBe(before.colour);
        }
      }
      await page.evaluate(() => (window as unknown as { pairs: (g: null, f: null, t: number, face: string) => void }).pairs(null,null,0,"front"));
      await expect(page.locator('[data-pair="group"] sup')).toHaveText(["G","F"]);
      await expect(page.locator('[data-pair="legacy"] sup')).toHaveText(["G"]);
    } finally { await page.close(); }
  });

  test("back counts precede markers without changing headings or signal geometry", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await mount(page);
      for (const focused of [false,true]) for (const [doing,done] of [[6,7],[2,3],[0,16]]) {
        await page.evaluate(([focused,doing,done]) => (window as unknown as { back: (f: boolean,d: number,n: number) => void }).back(focused as boolean,doing as number,done as number), [focused,doing,done]);
        await expect(page.locator(".group-back-heading")).toHaveCount(3);
        const headings = page.locator(".group-back-heading");
        for (const heading of await headings.all()) {
          expect(await heading.locator(".group-step-counts").textContent()).toBe(`${doing}\u00a0\u00a0${done}`);
          expect(await heading.evaluate(el => el.children[1].className)).toBe("group-step-counts");
        }
        const measure = () => headings.evaluateAll(elements => elements.map(el => {
          const rect = (node: Element) => { const r = node.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; };
          const title = el.children[0], counts = el.querySelector(".group-step-counts")!, marker = el.querySelector(".step-progress-strip")!;
          const t = title.getBoundingClientRect(), c = counts.getBoundingClientRect(), b = marker.getBoundingClientRect();
          return { title: rect(title), headingY: el.getBoundingClientRect().y, headingHeight: el.getBoundingClientRect().height,
            marker: rect(marker), signal: rect(el.closest(".focused-card-signal-slot")!.querySelector("svg")!),
            noOverlap: t.right <= c.left && c.right <= b.left, lines: counts.getClientRects().length };
        }));
        const current = await measure();
        // Reconstruct only the previous authorised heading order/content in
        // this private document, then compare the surrounding real geometry.
        await headings.evaluateAll((elements, values) => { for (const el of elements) {
          const counts = el.querySelector(".group-step-counts")!, marker = el.querySelector(".step-progress-strip")!;
          counts.textContent = `${values[0]} · ${values[1]}`; marker.after(counts);
        } }, [doing,done]);
        const previous = await measure();
        for (let i = 0; i < 3; i++) {
          expect(current[i].noOverlap).toBe(true); expect(current[i].lines).toBe(1);
          for (const key of ["title","signal"] as const) for (let j = 0; j < 4; j++) expect(Math.abs(current[i][key][j]-previous[i][key][j])).toBeLessThanOrEqual(.05);
          expect(current[i].headingY).toBe(previous[i].headingY); expect(current[i].headingHeight).toBe(previous[i].headingHeight);
          for (const j of [1,2,3]) expect(Math.abs(current[i].marker[j]-previous[i].marker[j])).toBeLessThanOrEqual(.05);
        }
        await headings.evaluateAll((elements, values) => { for (const el of elements) {
          const counts = el.querySelector(".group-step-counts")!, marker = el.querySelector(".step-progress-strip")!;
          counts.textContent = `${values[0]}\u00a0\u00a0${values[1]}`; marker.before(counts);
        } }, [doing,done]);
      }
    } finally { await page.close(); }
  });
});
