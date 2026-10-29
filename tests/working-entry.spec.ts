import { expect, test, type Page, type Route } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { entryDeck, entryMembership } from "./fixtures/workingEntry";
import type { Deck } from "../src/components/decks/types";
import { geometry } from "./phase2/helpers/presentationGeometry";

const bundles = new Map<string, string>();
test.beforeAll(async () => {
  for (const mode of ["production", "development"]) {
    bundles.set(mode, (await build({ stdin: { loader: "tsx", resolveDir: process.cwd(), contents: `
      import React,{useState} from 'react';import{createRoot}from'react-dom/client';
      import AppShell from './src/components/layout/AppShell';import{entryDeck,entryMembership}from'./tests/fixtures/workingEntry';
      import{workingCardStore}from'./src/lib/cards/workingCardStore';import{personalWork}from'./src/lib/cards/personalWork';
      import{buildDeckLayout}from'./src/components/decks/deckLayout';
      function Harness(){const[actor,setActor]=useState('alice');window.changeActor=setActor;
        window.invalidate=()=>workingCardStore.invalidate(actor);
        window.completeNewerSave=async()=>{await personalWork.run({userId:actor,cardIds:['shared-0']},'newer',async()=>{});};
        window.setSharedReflection=()=>workingCardStore.accept(actor,buildDeckLayout({...entryDeck(0,actor),cards:entryDeck(0,actor).cards.map(c=>({...c,reflection:'Newer shared reflection'}))},{currentUserId:actor,users:[]}).cards);
        const decks=[entryDeck(0,actor),entryDeck(1,actor)];
        if(location.search.includes('cold')){decks[0].openedAt=null;decks[0].cards.forEach(c=>c.targetDate='');}
        return <AppShell memberships={decks.map(entryMembership)} currentUserId={actor} userName={actor}/>;
      }createRoot(document.getElementById('fixture')).render(<React.StrictMode><Harness/></React.StrictMode>);
    ` }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: {
      "process.env.NODE_ENV": JSON.stringify(mode), "process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA": '"0"', "process.env": "{}",
    }, plugins: [{ name: "navigation", setup(builder) {
      builder.onLoad({ filter: /\.module\.css$/ }, () => ({ loader: "js", contents: "export default {}" }));
      builder.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "jsx", resolveDir: process.cwd(), contents: args.path === "next/link"
        ? `import React from'react';export default function Link({prefetch,children,...props}){return <a {...props}>{children}</a>}`
        : `import{useSyncExternalStore}from'react';const subscribe=fn=>{window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)};
          export const useSearchParams=()=>new URL(useSyncExternalStore(subscribe,()=>location.href)).searchParams;
          const router={push:url=>{window.pushes.push(url);history.pushState(null,'',url)},refresh:()=>{window.refreshes++}};export const useRouter=()=>router;
          window.pushes=[];window.refreshes=0;const replace=history.replaceState.bind(history);history.replaceState=(...args)=>{replace(...args);window.dispatchEvent(new PopStateEvent('popstate'))};` }));
    } }] })).outputFiles[0].text);
  }
});
const deferred = () => { let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; }); return { wait, release }; };
async function fixture(page: Page, { mode = "production", width = 390, query = "" } = {}) {
  const requests: { path: string; method: string; body: Record<string, string>; at: number }[] = [], errors: string[] = [];
  const decks = [entryDeck(), entryDeck(1)];
  let post: ((route: Route, deck: Deck) => Promise<void>) | undefined, authActor = "alice", heldGet: Promise<void> | undefined;
  const headers = { "X-Personal-Viewer": "alice" };
  await page.setViewportSize({ width, height: 1000 });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const url = new URL(route.request().url()), method = route.request().method();
    if (url.origin !== "https://fixture.invalid") return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.fulfill({ contentType: "text/html", body: '<div id="fixture"></div>' });
    const body = method === "GET" ? {} : route.request().postDataJSON() ?? {};
    requests.push({ path: url.pathname, method, body, at: Date.now() });
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { user: { id: authActor } } });
    if (url.pathname === "/api/decks-data") {
      if (method === "POST") {
        const deck = structuredClone(decks.find(deck => deck.id === body.deckTemplateId)!);
        if (body.cardTemplateId) deck.activeCardId = body.cardTemplateId;
        if (post) return post(route, deck);
        return route.fulfill({ json: deck, headers });
      }
      if (heldGet) await heldGet;
      return route.fulfill({ json: decks.map(entryMembership), headers });
    }
    if (method === "PATCH") {
      if (body.type === "active") decks.find(deck => deck.id === url.pathname.split("/").at(-1))!.activeCardId = body.activeCardId;
      if (body.type === "completion") decks.forEach(deck => { deck.cards.find(card => card.id === body.cardTemplateId)!.steps.find(step => step.stepId === body.stepId)!.completionStatus = body.completionStatus as "inProgress"; });
      return route.fulfill({ json: { ok: true }, headers });
    }
    if (url.pathname.endsWith("/assessment-history")) return route.fulfill({ headers, json: { viewerUserId: "alice", cardTemplateId: url.pathname.split("/")[3], history: { state: "empty", results: [], latestThree: [], sources: [], issues: [] } } });
    return route.fulfill({ headers, json: { review: null } });
  });
  await page.goto(`https://fixture.invalid/decks${query}`);
  await page.addStyleTag({ content: await readFile("src/app/globals.css", "utf8") });
  await page.addScriptTag({ content: bundles.get(mode)! });
  await expect(page.locator(".deck-grid")).toBeVisible();
  return { decks, requests, errors, holdPost: (fn?: typeof post) => { post = fn; }, switchAuth: (actor: string) => { authActor = actor; }, holdGet: (value?: Promise<void>) => { heldGet = value; } };
}
const open = (page: Page, index = 0) => page.getByRole("button", { name: `Open Ready Deck ${index}`, exact: true }).last().click();
const ready = (page: Page) => expect(page.locator("main")).toHaveAttribute("data-working-ready", "true");
async function place(page: Page) {
  const card = page.locator(".deck-card.is-active .deck-card-surface--front .card-title-anchor"), box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 180, { steps: 10 }); await page.mouse.up();
}

for (const mode of ["production", "development"]) for (const width of [320, 1280]) {
  test(`${mode} ${width}px: immediate warm animation, visual navigation and coordinated editing`, async ({ page }, info) => {
    const f = await fixture(page, { mode, width }), hold = deferred();
    f.holdPost(async (route, deck) => { await hold.wait; return route.fulfill({ json: deck, headers: { "X-Personal-Viewer": "alice" } }); });
    await open(page); await expect(page.locator(".deck-detail h1")).toHaveText("Ready Deck 0");
    await expect(page.locator("main")).toHaveAttribute("data-working-ready", "false");
    await page.locator(".deck-detail").evaluate(element => { (window as unknown as { originalDeck: Element }).originalDeck = element; });
    await expect(page.locator(".working-entry-status")).toBeVisible();
    await geometry(page, [".deck-detail", ".deck-card.is-active"]);
    await page.screenshot({ path: info.outputPath("warm-opening.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(f.requests.filter(request => request.path.endsWith("/update"))).toHaveLength(0);
    await page.locator(".deck-card.is-active").press("Enter");
    await expect(page.locator(".focused-card-surface--front .step-progress-hit-area")).toHaveCount(0);
    await page.getByRole("button", { name: "Close focused card", exact: true }).press("Enter");
    await expect(page.locator(".focused-card-stage")).toHaveCount(0);
    await place(page); await expect(page.locator(".deck-card.is-active")).toContainText("Practice 2");
    expect(f.requests.filter(request => request.method === "PATCH")).toHaveLength(0);
    hold.release(); await ready(page);
    await expect.poll(() => f.requests.filter(request => request.body.type === "active").map(request => request.body.activeCardId)).toEqual(["shared-1"]);
    await expect(page.locator(".deck-card.is-active")).toContainText("Practice 2");
    expect(await page.locator(".deck-detail").evaluate(element => (window as unknown as { originalDeck: Element }).originalDeck === element)).toBe(true);
    await page.locator(".deck-card.is-active").press("Enter");
    await expect(page.locator(".focused-card-surface--front .step-progress-hit-area")).toHaveCount(3);
    await page.locator(".focused-card-surface--front .step-progress-hit-area").first().click();
    await expect.poll(() => f.requests.filter(request => request.body.type === "completion").length).toBe(1);
    await info.attach("network-order", { body: JSON.stringify(f.requests), contentType: "application/json" });
    expect(f.errors).toEqual([]);
  });
}

test("repeated warm opens reuse current memberships and shared state across Decks", async ({ page }) => {
  const f = await fixture(page);
  await open(page); await ready(page);
  await page.locator(".deck-card.is-active").press("Enter");
  await page.locator(".focused-card-surface--front .step-progress-hit-area").first().click();
  await page.getByRole("button", { name: "Close focused card", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator(".deck-grid")).toBeVisible();
  for (const index of [1, 0]) {
    const hold = deferred(); f.holdPost(async (route, deck) => { await hold.wait; return route.fulfill({ json: deck, headers: { "X-Personal-Viewer": "alice" } }); });
    await open(page, index); await expect(page.locator(".deck-detail")).toBeVisible();
    await expect(page.locator(".deck-card.is-active .step-progress-strip--inProgress")).toHaveCount(1);
    hold.release(); await ready(page); f.holdPost(undefined);
    await page.getByRole("button", { name: "Back", exact: true }).click(); await expect(page.locator(".deck-grid")).toBeVisible();
  }
  expect(f.errors).toEqual([]);
});

test("slow failure retains a non-editable selection, Retry verifies in place, and denial withdraws it", async ({ page }) => {
  const f = await fixture(page);
  f.holdPost(route => route.fulfill({ status: 500, json: { code: "READ_FAILED" } }));
  await open(page); await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".deck-detail h1")).toHaveText("Ready Deck 0");
  await expect(page.locator("main")).toHaveAttribute("data-working-ready", "false");
  await page.locator(".deck-detail").evaluate(element => { (window as unknown as { retryDeck: Element }).retryDeck = element; });
  f.holdPost(undefined); await page.getByRole("button", { name: "Retry opening Deck", exact: true }).click(); await ready(page);
  expect(await page.locator(".deck-detail").evaluate(element => (window as unknown as { retryDeck: Element }).retryDeck === element)).toBe(true);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  f.holdPost(route => route.fulfill({ status: 403, json: { code: "DECK_FORBIDDEN" } }));
  await open(page); await expect(page.getByRole("alert")).toBeVisible(); await expect(page.locator(".deck-detail")).toHaveCount(0);
});

test("closing during verification ignores its result and serializes the next opening", async ({ page }) => {
  const f = await fixture(page), hold = deferred();
  f.holdPost(async (route, deck) => { if (deck.id === "deck-0") await hold.wait; return route.fulfill({ json: deck, headers: { "X-Personal-Viewer": "alice" } }); });
  await open(page); await expect.poll(() => f.requests.filter(request => request.method === "POST").length).toBe(1);
  await page.getByRole("button", { name: "Back", exact: true }).click(); await expect(page.locator(".deck-grid")).toBeVisible();
  await open(page, 1); expect(f.requests.filter(request => request.method === "POST")).toHaveLength(1);
  hold.release(); await ready(page); await expect(page.locator(".deck-detail h1")).toHaveText("Ready Deck 1");
  expect(new URL(page.url()).searchParams.get("openDeck")).toBe("deck-1");
});

for (const change of ["invalidate", "completeNewerSave"]) test(`${change}: a changed epoch or completed newer save invalidates an old opening response`, async ({ page }) => {
  const f = await fixture(page), hold = deferred();
  f.holdPost(async (route, deck) => { await hold.wait; return route.fulfill({ json: deck, headers: { "X-Personal-Viewer": "alice" } }); });
  await open(page); await expect.poll(() => f.requests.filter(request => request.method === "POST").length).toBe(1);
  await page.evaluate(async change => { await (window as unknown as Record<string, () => void | Promise<void>>)[change](); }, change);
  hold.release(); await expect(page.getByRole("alert")).toContainText("Personal state changed");
  await expect(page.locator("main")).toHaveAttribute("data-working-ready", "false");
});

test("account change while opening removes the previous learner's presentation", async ({ page }) => {
  const f = await fixture(page), hold = deferred();
  f.holdPost(async (route, deck) => { await hold.wait; return route.fulfill({ json: deck, headers: { "X-Personal-Viewer": "alice" } }); });
  await open(page); await expect(page.locator(".deck-detail")).toBeVisible(); f.switchAuth("bob"); hold.release();
  await expect(page.locator(".deck-detail")).toHaveCount(0); await expect(page.locator(".deck-tile")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { refreshes: number }).refreshes)).toBeGreaterThan(0);
});

test("learner prop changes isolate mounted state and ignore the previous learner's late response", async ({ page }) => {
  const f = await fixture(page), hold = deferred();
  f.holdPost(async (route, deck) => { await hold.wait; return route.fulfill({ json: deck, headers: { "X-Personal-Viewer": "alice" } }); });
  await open(page); await expect(page.locator(".deck-detail")).toBeVisible();
  await page.evaluate(() => (window as unknown as { changeActor: (actor: string) => void }).changeActor("bob"));
  await expect(page.locator(".session-chip")).toHaveText("bob"); hold.release();
  await expect(page.locator(".deck-detail")).toHaveCount(0); expect(new URL(page.url()).searchParams.has("openDeck")).toBe(false);
});

test("first opening and return after tab inactivity use authoritative initialization", async ({ page }) => {
  const f = await fixture(page, { query: "?cold" }), hold = deferred();
  f.holdPost(async (route, deck) => { await hold.wait; return route.fulfill({ json: deck, headers: { "X-Personal-Viewer": "alice" } }); });
  await open(page); await expect.poll(() => f.requests.filter(request => request.method === "POST").length).toBe(1);
  await expect(page.locator(".deck-detail")).toHaveCount(0); hold.release(); await ready(page);
  await page.getByRole("button", { name: "Back", exact: true }).click(); await expect(page.locator(".deck-grid")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const again = deferred(); f.holdPost(async (route, deck) => { await again.wait; return route.fulfill({ json: deck, headers: { "X-Personal-Viewer": "alice" } }); });
  await open(page); await expect(page.locator(".deck-detail")).toHaveCount(0); again.release(); await ready(page);
});

test("verification reconciles changed composition and authoritative active selection without remounting", async ({ page }) => {
  const f = await fixture(page), hold = deferred();
  f.holdPost(async (route, deck) => { await hold.wait; return route.fulfill({ json: { ...deck, adoptedVersion: 2, cards: deck.cards.slice(1), activeCardId: "shared-2" }, headers: { "X-Personal-Viewer": "alice" } }); });
  await open(page); await page.locator(".deck-detail").evaluate(element => { (window as unknown as { originalDeck: Element }).originalDeck = element; });
  hold.release(); await ready(page); await expect(page.locator(".deck-card.is-active")).toContainText("Practice 3");
  expect(await page.locator(".deck-detail").evaluate(element => (window as unknown as { originalDeck: Element }).originalDeck === element)).toBe(true);
  expect(f.requests.filter(request => request.body.type === "active")).toHaveLength(0);
});

test("warm opening has real intermediate animation frames while validation is delayed", async ({ page }, info) => {
  await page.clock.install();
  const f = await fixture(page, { width: 390 }), hold = deferred();
  f.holdPost(async (route, deck) => { await hold.wait; return route.fulfill({ json: deck, headers: { "X-Personal-Viewer": "alice" } }); });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const initial = (await page.locator(".deck-tile").first().boundingBox())!;
  await page.evaluate(() => {
    const frames: { visible: boolean; width: number; height: number }[] = [];
    (window as unknown as { openingFrames: typeof frames }).openingFrames = frames;
    document.addEventListener("click", () => {
      const start = performance.now(), sample = () => {
        const deck = document.querySelector(".deck-detail"), rect = deck?.getBoundingClientRect();
        frames.push({ visible: !!deck || !!document.querySelector(".deck-grid"), width: rect?.width ?? 0, height: rect?.height ?? 0 });
        if (performance.now() - start < 900) requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    }, { once: true, capture: true });
  });
  const button = (await page.getByRole("button", { name: "Open Ready Deck 0", exact: true }).last().boundingBox())!;
  await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
  for (let frame = 0; frame < 60; frame++) await page.clock.runFor(17);
  const frames = await page.evaluate(() => (window as unknown as { openingFrames: { visible: boolean; width: number; height: number }[] }).openingFrames);
  const final = (await page.locator(".deck-detail").boundingBox())!;
  expect(frames.every(frame => frame.visible)).toBe(true);
  expect(frames.some(frame => Math.abs(frame.width - initial.width) > 2 && Math.abs(frame.width - final.width) > 2)).toBe(true);
  await info.attach("opening-frames", { body: JSON.stringify({ initial, final, frames }), contentType: "application/json" });
  await page.screenshot({ path: info.outputPath("checking-deck.png") });
  hold.release(); await page.clock.resume(); await ready(page);
});

test("verification during a placement transition preserves the incoming Card and saves that selection", async ({ page }) => {
  const f = await fixture(page), hold = deferred();
  f.holdPost(async (route, deck) => { await hold.wait; return route.fulfill({ json: deck, headers: { "X-Personal-Viewer": "alice" } }); });
  await open(page); await expect(page.locator(".deck-card.is-active")).toBeVisible();
  await place(page); hold.release(); await ready(page);
  await expect(page.locator(".deck-card.is-active")).toContainText("Practice 2");
  await expect.poll(() => f.requests.filter(request => request.body.type === "active").map(request => request.body.activeCardId)).toEqual(["shared-1"]);
});

test("same-composition confirmation uses the server active Card when the learner has not navigated", async ({ page }) => {
  const f = await fixture(page), hold = deferred();
  f.holdPost(async (route, deck) => { await hold.wait; return route.fulfill({ json: { ...deck, activeCardId: "shared-2" }, headers: { "X-Personal-Viewer": "alice" } }); });
  await open(page); await expect(page.locator(".deck-card.is-active")).toContainText("Practice 1");
  hold.release(); await ready(page); await expect(page.locator(".deck-card.is-active")).toContainText("Practice 3");
  expect(f.requests.filter(request => request.body.type === "active")).toHaveLength(0);
});

test("a newer completed save during close cannot install an obsolete membership presentation", async ({ page }) => {
  const f = await fixture(page), hold = deferred();
  await open(page); await ready(page); f.holdGet(hold.wait);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect.poll(() => f.requests.filter(request => request.path === "/api/decks-data" && request.method === "GET").length).toBe(1);
  await page.evaluate(async () => { await (window as unknown as { completeNewerSave: () => Promise<void> }).completeNewerSave(); });
  hold.release(); await expect(page.getByRole("alert")).toContainText("Personal state changed while closing");
  await expect(page.locator(".deck-detail")).toBeVisible();
});
