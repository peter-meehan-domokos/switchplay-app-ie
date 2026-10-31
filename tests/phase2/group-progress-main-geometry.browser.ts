import { chromium, webkit, expect, test, type Browser, type Page } from "@playwright/test";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { relative } from "node:path";

// Pin the reviewed personal presentation, rather than accepting a screenshot
// of the currently broken Group layout as a new baseline. Needs local Git
// history for these two commits. No app server, account or database is used.
const mainReference = "cbffc8d58bd23f129548a113fc15beaebac33725";
const groupReference = "2d9be477f8319b54dbbaeedbbe15fc28c23c1523";
type Version = "main" | "committed" | "working";
type Fixture = { js: string; css: string };
type State = { name: string; focused: boolean; editable: boolean; group: boolean; eligible?: number; scale?: number; personal?: boolean };
const states: State[] = [
  { name: "ordinary Group with counts", focused: false, editable: false, group: true },
  { name: "focused Group editable", focused: true, editable: true, group: true },
  { name: "focused Group read-only", focused: true, editable: false, group: true },
  { name: "Card 2 Bob ordinary", focused: false, editable: false, group: false },
  { name: "Card 2 Bob focused", focused: true, editable: false, group: false },
  { name: "own follower focused editable", focused: true, editable: true, group: false },
  { name: "ordinary Group zero eligible", focused: false, editable: false, group: true, eligible: 0 },
  { name: "focused Group zero eligible", focused: true, editable: true, group: true, eligible: 0 },
  { name: "expanded Group", focused: true, editable: true, group: true, scale: (844 * .62 - 18) / 1.45 / 252 },
  { name: "expanded Bob", focused: true, editable: false, group: false, scale: (844 * .62 - 18) / 1.45 / 252 },
  { name: "existing personal ordinary", focused: false, editable: false, group: false, personal: true },
  { name: "existing personal focused", focused: true, editable: true, group: false, personal: true },
];

async function bundle(version: Version): Promise<Fixture> {
  const ref = version === "main" ? mainReference : version === "committed" ? groupReference : null;
  const source = async (file: string) => ref ? execFileSync("git", ["show", `${ref}:${file}`], { encoding: "utf8" }) : readFile(file, "utf8");
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import Item from "./src/components/cards/StepItem";
    const root = createRoot(document.getElementById("fixture"));
    window.mount = ({group, editable, focused, eligible = 15, scale = 1, personal}) => root.render(
      <div className={personal ? "" : "group-experience"} style={{width:252, transform:"scale("+scale+")", transformOrigin:"top left"}}>
        <div className={focused ? "focused-card-content" : "deck-card-content"}>
          <div className={"active-card-front active-card-front--"+(focused ? "focused" : "active")}>
            <ol className="active-step-list">{["Prepare","Practise","Reflect"].map((title,index) =>
              <Item key={index} index={index} step={{stepId:"group-1-"+index,title,description:"Take your time and notice what changes.",completionStatus:"todo"}}
                onOpenStepView={focused ? ()=>{} : undefined} onCycleStatus={editable ? ()=>{} : undefined}
                experienceProgress={!personal}
                followerProgress={group ? {eligibleTotal:eligible,doing:0,done:0} : undefined}/>
            )}</ol>
          </div>
        </div>
      </div>);
  ` }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: "tsconfig.json",
    define: { "process.env.NODE_ENV": '"production"' }, plugins: ref ? [{ name: "reviewed-reference", setup(builder) {
      builder.onLoad({ filter: /\/src\/components\/cards\/(StepItem|StepProgressStrip)\.tsx$/ }, async args => ({ contents: await source(relative(process.cwd(), args.path)), loader: "tsx" }));
    } }] : [] });
  return { js: result.outputFiles[0].text, css: await source("src/app/globals.css") + (version === "main" ? "" : "\n" + await source("src/components/group-experiences/group-experience.css")) };
}

async function measure(page: Page, fixture: Fixture, state: State) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/*", route => route.abort());
  await page.setContent(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${fixture.css}</style></head><body><div id="fixture"></div></body></html>`);
  await page.addScriptTag({ content: fixture.js });
  await page.evaluate(state => (window as unknown as { mount: (state: State) => void }).mount(state), state);
  await page.waitForFunction(() => document.querySelectorAll(".active-step-item").length === 3);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return page.locator(".active-step-item").evaluateAll((elements, scale) => {
    const listTop = elements[0].getBoundingClientRect().top;
    return elements.map(element => {
      const copy = element.querySelector(".step-copy")!, description = element.querySelector(".step-description")!;
      const bar = element.querySelector(".step-progress-strip")!, row = copy.children[1];
      const counts = element.querySelector(".group-step-counts"), button = element.querySelector(".step-progress-hit-area");
      const d = description.getBoundingClientRect(), b = bar.getBoundingClientRect(), r = row.getBoundingClientRect(), s = element.getBoundingClientRect();
      const c = counts?.getBoundingClientRect(), h = button?.getBoundingClientRect(), rs = getComputedStyle(row);
      const range = document.createRange(); range.selectNodeContents(description);
      const textBottom = Math.max(...Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.top < d.bottom).map(rect => Math.min(rect.bottom, d.bottom)));
      return { stepTop: (s.top - listTop) / scale, stepHeight: s.height / scale, descriptionBottom: (d.bottom - s.top) / scale,
        barTop: (b.top - s.top) / scale, barCentre: (b.top + b.height / 2 - s.top) / scale,
        descriptionGap: (b.top - d.bottom) / scale, textGap: (b.top - textBottom) / scale,
        rowFlowHeight: r.height / scale + parseFloat(rs.marginTop) + parseFloat(rs.marginBottom),
        countGap: c ? (c.left - b.right) / scale : null, countCentreDifference: c ? Math.abs(c.top + c.height / 2 - b.top - b.height / 2) / scale : null,
        target: h ? { width: h.width / scale, height: h.height / scale, top: (h.top - s.top) / scale } : null };
    });
  }, state.scale ?? 1);
}

for (const browserName of ["chromium", "webkit"] as const) test.describe(`${browserName}: progress geometry against reviewed main`, () => {
  let browser: Browser;
  let fixtures: Record<Version, Fixture>;
  test.beforeAll(async () => { browser = await (browserName === "chromium" ? chromium : webkit).launch(); fixtures = { main: await bundle("main"), committed: await bundle("committed"), working: await bundle("working") }; });
  test.afterAll(async () => { await browser?.close(); });
  for (const state of states) test(state.name, async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
    const referencePage = await context.newPage(), committedPage = await context.newPage();
    try {
      // A read-only Group perspective must LOOK like the reviewed personal
      // focused Card without gaining that personal Card's editing capability.
      const referenceState = { ...state, group: false, editable: state.focused, personal: true };
      const reference = await measure(referencePage, fixtures.main, referenceState);
      const committed = await measure(committedPage, fixtures.committed, state);
      const working = await measure(page, fixtures.working, state);
      console.log(JSON.stringify({ browserName, state: state.name, main: reference, committed, working }));
      for (let i = 0; i < 3; i++) {
        for (const key of ["stepTop", "stepHeight", "descriptionBottom", "barTop", "barCentre", "descriptionGap", "textGap", "rowFlowHeight"] as const) {
          expect(Math.abs(working[i][key] - reference[i][key]), `Step ${i + 1} ${key} must preserve main`).toBeLessThanOrEqual(.1);
        }
        if (state.group && (state.eligible ?? 15) > 0) {
          expect(working[i].countGap).toBeCloseTo(6, 1); expect(working[i].countCentreDifference).toBeLessThan(.1);
        } else expect(working[i].countGap).toBeNull();
        if (state.editable) {
          expect(working[i].target?.width).toBeCloseTo(52, 1); expect(working[i].target?.height).toBeCloseTo(24, 1);
          expect(Math.abs(working[i].target!.top - reference[i].target!.top)).toBeLessThanOrEqual(.1);
        } else expect(working[i].target).toBeNull();
      }
    } finally { await context.close(); }
  });
});
