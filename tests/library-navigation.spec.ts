import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { navigationEntry } from "./fixtures/libraryNavigation";
import type { LibraryEntry } from "../src/lib/cards/libraryProjection";

let bundle: string;
let productionBundle: string;
test.beforeAll(async () => {
  for (const mode of ["development", "production"]) {
  const output = (await build({ stdin: { loader: "tsx", resolveDir: process.cwd(), contents: `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import LibraryShell from './src/components/library/LibraryShell';import{navigationEntry}from'./tests/fixtures/libraryNavigation';
    const query=new URLSearchParams(location.search),direct=query.get('direct');
    createRoot(document.getElementById('fixture')).render(<React.StrictMode><LibraryShell
      initialCollection={direct===null?{entries:Array.from({length:20},(_,i)=>navigationEntry(i)),nextCursor:'page2'}:undefined}
      initialEntry={direct===null?undefined:navigationEntry(Number(direct))} currentUserId="alice" userName="Alice"/></React.StrictMode>);
  ` }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: {
    "process.env.NODE_ENV": JSON.stringify(mode), "process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA": '"1"', "process.env": "{}",
  }, plugins: [{ name: "next-navigation-fixture", setup(builder) {
    builder.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "jsx", resolveDir: process.cwd(), contents: args.path === "next/link"
      ? `import React from 'react';export default function Link({prefetch,children,...props}){return <a {...props}>{children}</a>}`
      : `import {useSyncExternalStore}from'react';const subscribe=fn=>{window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)};
        const snapshot=()=>location.href;export const usePathname=()=>new URL(useSyncExternalStore(subscribe,snapshot)).pathname;
        export const useSearchParams=()=>new URL(useSyncExternalStore(subscribe,snapshot)).searchParams;
        const router={push:url=>{window.routerPushes.push(url);history.pushState(null,'',url)},refresh:()=>{window.refreshes++}};export const useRouter=()=>router;
        window.routerPushes=[];window.refreshes=0;const push=history.pushState.bind(history);history.pushState=(...args)=>{push(...args);window.dispatchEvent(new PopStateEvent('popstate'))};` }));
  } }] })).outputFiles[0].text;
  if (mode === "development") bundle = output; else productionBundle = output;
  }
});

type ResponseSpec = { status?: number; value?: LibraryEntry; wait?: Promise<void> };
async function fixture(page: Page, width = 390, direct?: number, progress = false, production = false) {
  const details = new Map<string, ResponseSpec>(), requests: { path: string; method: string }[] = [], errors: string[] = [];
  let viewer = "alice";
  let firstPage: LibraryEntry[] = Array.from({ length: 20 }, (_, index) => navigationEntry(index));
  let listWait: Promise<void> | undefined;
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 844 });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== "https://fixture.invalid") return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.fulfill({ contentType: "text/html", body: '<div id="fixture"></div>' });
    requests.push({ path: url.pathname + url.search, method: route.request().method() });
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { user: { id: viewer } } });
    if (url.pathname === "/api/library/decks") {
      const entries = url.search ? Array.from({ length: 20 }, (_, index) => navigationEntry(index + 20)) : firstPage;
      if (listWait) await listWait;
      return route.fulfill({ json: { entries, nextCursor: url.search ? null : "page2" } });
    }
    if (url.pathname === "/api/library/viewer-status") return route.fulfill({ json: { viewerUserId: viewer,
      decks: [{ deckTemplateId: url.searchParams.get("deckTemplateId"), state: "not-added", membershipRevision: null, canEditInCreator: true }], cards: [] } });
    const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
    const response = details.get(id) ?? {};
    if (response.wait) await response.wait;
    return route.fulfill(response.status ? { status: response.status, json: { code: response.status === 403 ? "LIBRARY_DECK_FORBIDDEN" : "READ_FAILED" } }
      : { json: response.value ?? navigationEntry(Number(id.split("-").at(-1))) });
  });
  await page.goto(`https://fixture.invalid/library${direct === undefined ? "" : `/programme-${direct}`}?${direct === undefined ? "" : `direct=${direct}&`}${progress ? "progressFramework=maths&progressArea=algebra" : ""}`);
  await page.addStyleTag({ content: await readFile("src/app/globals.css", "utf8") });
  await page.addScriptTag({ content: production ? productionBundle : bundle });
  await expect(page.locator(direct === undefined ? ".deck-grid" : ".deck-detail")).toBeVisible();
  return { details, requests, errors, changeViewer: (value: string) => { viewer = value; },
    setFirstPage: (entries: LibraryEntry[]) => { firstPage = entries; }, holdList: (wait?: Promise<void>) => { listWait = wait; } };
}
const open = (page: Page, index: number) => page.getByRole("button", { name: `Open Programme ${index}`, exact: true }).last().click();
const back = (page: Page) => page.getByRole("button", { name: "Back", exact: true }).click();
const heading = (page: Page) => page.locator('.library-view:not([aria-hidden="true"]) .deck-detail h1');

for (const [width, production] of [[320, false], [390, false], [1280, false], [390, true]] as const) test(`${width}px ${production ? "production" : "development"}: real tile-to-Deck animation remains visible with delayed validation; warm return is instant`, async ({ page }, info) => {
  await page.clock.install();
  const f = await fixture(page, width, undefined, false, production);
  let release!: () => void;
  f.details.set("programme-0", { wait: new Promise<void>(resolve => { release = resolve; }) });
  const tile = page.locator(".deck-tile").filter({ hasText: "Programme 0" });
  // The initial grid must have painted before measuring its shared-layout origin.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  // Advance real Motion/DOM frames deterministically; a busy test machine must
  // not skip the entire spring between two wall-clock samples.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const initial = (await tile.boundingBox())!;
  await page.evaluate(() => {
    const frames: { width: number; visible: boolean; source: boolean }[] = [];
    (window as unknown as { framesTaken: typeof frames }).framesTaken = frames;
    document.addEventListener("click", () => {
      const start = performance.now();
      const sample = () => {
        const detail = document.querySelector(".deck-detail"), tiles = document.querySelector(".deck-grid");
        frames.push({ width: detail?.getBoundingClientRect().width ?? 0, visible: !!detail || !!tiles, source: !!tiles });
        if (performance.now() - start < 900) requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    }, { capture: true, once: true });
  });
  const openRect = (await page.getByRole("button", { name: "Open Programme 0", exact: true }).last().boundingBox())!;
  await page.mouse.click(openRect.x + openRect.width / 2, openRect.y + openRect.height / 2);
  await page.clock.runFor(64);
  await expect(page).toHaveURL(/\/library\/programme-0$/);
  await expect(heading(page)).toHaveText("Programme 0");
  await page.screenshot({ path: info.outputPath("opening.png") });
  await page.clock.runFor(950);
  const frames = await page.evaluate(() => (window as unknown as { framesTaken: { width: number; visible: boolean; source: boolean }[] }).framesTaken);
  expect(frames.length).toBeGreaterThan(15); expect(frames.every(frame => frame.visible)).toBe(true);
  const final = (await page.locator(".deck-detail").boundingBox())!;
  await info.attach("opening-frames", { body: JSON.stringify({ initial, final, frames }), contentType: "application/json" });
  expect(frames.some(frame => frame.width > initial.width + 5 && frame.width < final.width - 5), JSON.stringify({ initial, final, frames })).toBe(true);
  expect(frames.some(frame => frame.source && frame.width > 0)).toBe(true);
  await page.clock.resume();
  await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Add to My Decks", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  release();
  await expect.poll(() => f.requests.filter(request => request.path.startsWith("/api/library/decks/programme-0")).length).toBe(1);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.evaluate(() => {
    const frames: number[] = [];
    (window as unknown as { closingFrames: number[] }).closingFrames = frames;
    document.addEventListener("click", () => {
      const start = performance.now();
      const sample = () => {
        frames.push(document.querySelector(".deck-tile")?.getBoundingClientRect().width ?? 0);
        if (performance.now() - start < 700) requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    }, { capture: true, once: true });
  });
  const backRect = (await page.getByRole("button", { name: "Back", exact: true }).boundingBox())!;
  await page.mouse.click(backRect.x + backRect.width / 2, backRect.y + backRect.height / 2);
  await page.clock.runFor(750);
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  const closing = await page.evaluate(() => (window as unknown as { closingFrames: number[] }).closingFrames);
  expect(closing.some(value => value > initial.width + 5 && value < final.width - 5)).toBe(true);
  await page.clock.resume();
  expect(f.requests.some(request => request.path === "/api/library/decks")).toBe(false);
  expect(f.requests.every(request => request.method === "GET")).toBe(true);
  expect(f.errors).toEqual([]);
});

test("pagination, scroll, repeated selections and browser Back/Forward retain the loaded list", async ({ page }) => {
  const f = await fixture(page);
  await page.getByRole("button", { name: "More Decks", exact: true }).click();
  await expect(page.locator(".deck-tile")).toHaveCount(40);
  await page.getByRole("button", { name: "Open Programme 22", exact: true }).last().scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  await open(page, 22); await expect(heading(page)).toHaveText("Programme 22");
  await back(page); await expect(page.locator(".deck-tile")).toHaveCount(40);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0);
  await open(page, 23); await expect(heading(page)).toHaveText("Programme 23");
  await page.goBack(); await expect(page.locator(".deck-grid")).toBeVisible();
  await page.goForward(); await expect(heading(page)).toHaveText("Programme 23");
  await back(page); await open(page, 22); await expect(heading(page)).toHaveText("Programme 22");
  expect(f.requests.filter(request => request.path === "/api/library/decks?cursor=page2")).toHaveLength(1);
  expect(f.requests.filter(request => request.path === "/api/library/decks")).toHaveLength(0);
  expect(f.errors).toEqual([]);
});

test("a paginated, scrolled tile opens from its visible position rather than outside the viewport", async ({ page }) => {
  await fixture(page);
  await page.getByRole("button", { name: "More Decks", exact: true }).click();
  const target = page.getByRole("button", { name: "Open Programme 22", exact: true }).last();
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const frames: { top: number; bottom: number }[] = [];
    (window as unknown as { scrolledOpening: typeof frames }).scrolledOpening = frames;
    document.addEventListener("click", () => {
      const start = performance.now();
      const sample = () => {
        const rect = document.querySelector(".deck-detail")?.getBoundingClientRect();
        if (rect) frames.push({ top: rect.top, bottom: rect.bottom });
        if (performance.now() - start < 700) requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    }, { capture: true, once: true });
  });
  await target.click(); await expect(heading(page)).toHaveText("Programme 22");
  await page.waitForTimeout(750);
  const frames = await page.evaluate(() => (window as unknown as { scrolledOpening: { top: number; bottom: number }[] }).scrolledOpening);
  expect(frames.length).toBeGreaterThan(10);
  expect(frames.every(frame => frame.top < 844 && frame.bottom > 0)).toBe(true);
});

test("browser Back immediately releases the focused Deck rather than retaining live focused controls during exit", async ({ page }) => {
  await fixture(page); await open(page, 0);
  await page.locator('.library-view:not([aria-hidden="true"]) .deck-card.is-active').press("Enter");
  await expect(page.locator(".focused-card-stage")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  expect(await page.locator(".focused-card-stage,.deck-detail").count()).toBe(0);
});

test("publication changes require an explicit refresh; revoked and failed reads never grant actions", async ({ page }) => {
  const f = await fixture(page);
  f.details.set("programme-0", { value: navigationEntry(0, 2) });
  await open(page, 0);
  await expect(page.getByRole("status")).toContainText("A newer publication is available");
  await expect(heading(page)).toHaveText("Programme 0");
  await page.getByRole("button", { name: "Refresh preview", exact: true }).click();
  await expect(heading(page)).toHaveText("Programme 0 revised 2");
  await back(page);
  f.details.set("programme-1", { status: 403 });
  await open(page, 1); await expect(page.getByRole("heading", { name: "Unavailable Deck", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to Library", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Programme 1", exact: true })).toHaveCount(0);
  f.details.set("programme-2", { status: 503 });
  await open(page, 2); await expect(page.getByRole("alert")).toBeVisible();
  await expect(heading(page)).toHaveText("Programme 2");
  await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Add to My Decks", exact: true })).toBeDisabled();
});

test("obsolete reads and learner changes cannot replace the current destination or retain old status", async ({ page }) => {
  const f = await fixture(page);
  let release!: () => void;
  f.details.set("programme-0", { status: 403, wait: new Promise<void>(resolve => { release = resolve; }) });
  await open(page, 0); await back(page); await open(page, 1); release();
  await expect(heading(page)).toHaveText("Programme 1");
  f.changeViewer("bob"); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toContainText("Your session changed");
  await expect(page.locator(".deck-detail,.deck-grid")).toHaveCount(0);
});

test("direct entry stays supported, and Progress keeps its existing return route", async ({ page }) => {
  await fixture(page, 390, 3, true);
  await expect(heading(page)).toHaveText("Programme 3");
  await expect(page.getByRole("button", { name: "Back to Progress", exact: true })).toHaveClass(/deck-back-overlay/);
  await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { routerPushes: string[] }).routerPushes.at(-1))).toBe("/progress?framework=maths&area=algebra");
});

test("a visible Library refresh retains loaded pages and scroll rather than resetting to page one", async ({ page }) => {
  await page.clock.install();
  const f = await fixture(page);
  await page.getByRole("button", { name: "More Decks", exact: true }).click();
  await expect(page.locator(".deck-tile")).toHaveCount(40);
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.clock.fastForward(61_000);
  await expect.poll(() => f.requests.filter(request => request.path === "/api/library/decks?cursor=page2").length).toBe(2);
  await expect(page.locator(".deck-tile")).toHaveCount(40);
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(500);
});

test("a refreshed tile's publication takes precedence over an older visited detail", async ({ page }) => {
  await page.clock.install();
  const f = await fixture(page);
  await open(page, 0); await back(page);
  const next = navigationEntry(0, 2);
  f.setFirstPage([next, ...Array.from({ length: 19 }, (_, index) => navigationEntry(index + 1))]);
  f.details.set("programme-0", { value: next });
  await page.clock.fastForward(61_000);
  const tile = page.getByRole("button", { name: "Open Programme 0 revised 2", exact: true }).last();
  await expect(tile).toBeVisible(); await tile.click();
  await expect(heading(page)).toHaveText("Programme 0 revised 2");
  await expect(page.getByText("A newer publication is available.")).toHaveCount(0);
});

test("a delayed list refresh stays visible and cannot overwrite a newer selected publication", async ({ page }) => {
  await page.clock.install();
  const f = await fixture(page);
  let release!: () => void;
  f.holdList(new Promise<void>(resolve => { release = resolve; }));
  await page.clock.fastForward(61_000);
  await expect.poll(() => f.requests.filter(item => item.path === "/api/library/decks").length).toBe(1);
  await expect(page.locator(".deck-tile")).toHaveCount(20);
  await expect(page.getByRole("status")).toHaveCount(0);
  const next = navigationEntry(0, 2);
  f.details.set("programme-0", { value: next });
  await open(page, 0);
  await expect(page.getByRole("status")).toContainText("A newer publication is available");
  await page.getByRole("button", { name: "Refresh preview", exact: true }).click();
  await expect(heading(page)).toHaveText("Programme 0 revised 2");
  f.setFirstPage([next]); f.holdList();
  await back(page);
  await expect.poll(() => f.requests.filter(item => item.path === "/api/library/decks").length).toBe(2);
  release();
  await expect(page.getByRole("button", { name: "Open Programme 0 revised 2", exact: true }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Programme 0", exact: true })).toHaveCount(0);
});
