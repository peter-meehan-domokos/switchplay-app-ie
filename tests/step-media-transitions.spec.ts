import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

let bundle: string, css: string;
test.beforeAll(async () => {
  const compiled = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
    import FocusedCardView from './src/components/decks/FocusedCardView';
    const video=(id,label)=>({id,label,kind:'video',media:{id,mediaType:'video',provider:'cloudflare-stream',assetId:id,src:'https://iframe.videodelivery.net/'+id,description:id,width:1920,height:1080}});
    const image={id:'diagram',label:'Image',kind:'image',alt:'Diagram',media:{id:'diagram',mediaType:'image',provider:'cloudflare-r2',assetId:'diagram.png',src:'https://invalid.example/diagram.png',description:'Diagram'}};
    const root={id:'root',label:'Explore',kind:'activity',activityId:'roots-and-factors'};
    const card={id:'card',cardTemplateId:'card',label:'Card 1',dataOwnerUserId:'alice',adoptedVersion:1,targetDate:'2026-10-30',signals:[],progressPercentage:0,reflection:'',mediaItems:[],chats:[],
      intro:{title:'Introduction',description:null,mediaItems:[video('a','Watch'),video('b','Again'),image,root]},
      steps:[{stepId:'one',description:'First',mediaItems:[video('b','Watch'),{...video('b','Repeat'),id:'repeat'}]},{stepId:'two',description:'Second',mediaItem:video('c','Watch').media},{stepId:'three',description:'Third',mediaItem:video('d','Watch').media}]};
    function App(){const [actor,setActor]=useState('alice');window.mountCard=(actor='alice')=>setActor(actor);window.unmountCard=()=>setActor(null);
      return actor ? <FocusedCardView key={actor} card={{...card,dataOwnerUserId:actor}} deckTemplateId="deck" deckVersion={1} cardIndex={0} totalCards={1} isDeckFlipped={false}
        onClose={()=>{}} onPrevious={()=>{}} onNext={()=>{}} traversalDirection="next" transition={{duration:0}}/> : null;}
    createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, outfile: "fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    loader: { ".ttf": "dataurl", ".woff": "dataurl", ".woff2": "dataurl" },
    define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA": 'window.fixtureProtected', "process.env.NEXT_PUBLIC_PHASE2_MOCK_MEDIA": '"0"', "process.env": "{}" } });
  bundle = compiled.outputFiles!.find(file => file.path.endsWith(".js"))!.text;
  css = await readFile("src/app/globals.css", "utf8") + (compiled.outputFiles!.find(file => file.path.endsWith(".css"))?.text ?? "");
});
type Controls = { plays: string[]; endVideo(video: HTMLVideoElement): void; stallVideo(video: HTMLVideoElement): void;
  mountCard(actor?: string): void; unmountCard(): void; holdSeek: boolean; finishSeek(video: HTMLVideoElement): void };
async function setup(page: Page, protectedMode = true, grantGate?: (assetId: string) => Promise<void>) {
  page.on("pageerror", error => { throw error; });
  await page.addInitScript(() => {
    const win = window as unknown as Controls; win.plays = [];
    const paused = new WeakMap<HTMLMediaElement, boolean>(), ended = new WeakMap<HTMLMediaElement, boolean>();
    const positions = new WeakMap<HTMLMediaElement, number>(), seeks = new WeakMap<HTMLMediaElement, number>();
    Object.defineProperty(HTMLMediaElement.prototype, "duration", { configurable: true, get() { return 120; } });
    Object.defineProperty(HTMLMediaElement.prototype, "seeking", { configurable: true, get() { return seeks.has(this); } });
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", { configurable: true, get() { return positions.get(this) ?? 0; }, set(value: number) {
      if (win.holdSeek) seeks.set(this, value); else positions.set(this, value);
    } });
    win.finishSeek = video => { positions.set(video, seeks.get(video) ?? 0); seeks.delete(video); video.dispatchEvent(new Event("seeked")); };
    const add = HTMLMediaElement.prototype.addEventListener, remove = HTMLMediaElement.prototype.removeEventListener;
    const wrappers = new WeakMap<EventListenerOrEventListenerObject, EventListener>();
    HTMLMediaElement.prototype.addEventListener = function(this: HTMLMediaElement, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
      if (!listener) return;
      if (!wrappers.has(listener)) wrappers.set(listener, function(this: HTMLMediaElement, event: Event) { if (!event.isTrusted) { if (typeof listener === "function") listener.call(this, event); else listener.handleEvent(event); } });
      add.call(this, type, wrappers.get(listener)!, options);
    };
    HTMLMediaElement.prototype.removeEventListener = function(this: HTMLMediaElement, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) { if (listener) remove.call(this, type, wrappers.get(listener) ?? listener, options); };
    Object.defineProperty(HTMLMediaElement.prototype, "paused", { configurable: true, get() { return paused.get(this) ?? true; } });
    Object.defineProperty(HTMLMediaElement.prototype, "ended", { configurable: true, get() { return ended.get(this) ?? false; } });
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get() { return this.getAttribute("src") ? 2 : 0; } });
    Object.defineProperty(HTMLMediaElement.prototype, "currentSrc", { configurable: true, get() { return this.src; } });
    HTMLMediaElement.prototype.canPlayType = () => "probably";
    HTMLMediaElement.prototype.pause = function() { const wasPlaying = paused.get(this) === false; paused.set(this, true); if (wasPlaying) this.dispatchEvent(new Event("pause")); };
    HTMLMediaElement.prototype.play = function() { paused.set(this, false); ended.set(this, false); win.plays.push(this.src); this.dispatchEvent(new Event("play")); return Promise.resolve(); };
    HTMLMediaElement.prototype.load = function() {
      paused.set(this, true); ended.set(this, false); positions.set(this, 0); seeks.delete(this); const src = this.getAttribute("src");
      if (src) setTimeout(() => { if (this.getAttribute("src") === src) for (const type of ["loadedmetadata", "loadeddata", "canplay"]) this.dispatchEvent(new Event(type)); }, 0);
    };
    HTMLVideoElement.prototype.requestVideoFrameCallback = callback => requestAnimationFrame(time => callback(time, {} as VideoFrameCallbackMetadata));
    HTMLVideoElement.prototype.cancelVideoFrameCallback = id => cancelAnimationFrame(id);
    win.endVideo = video => { ended.set(video, true); paused.set(video, true); video.dispatchEvent(new Event("ended")); video.dispatchEvent(new Event("pause")); };
    win.stallVideo = video => { video.dispatchEvent(new Event("waiting")); video.dispatchEvent(new Event("stalled")); };
  });
  await page.route("https://fixture.invalid/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/media/protected") {
      const assetId = url.searchParams.get("identity");
      await grantGate?.(assetId!);
      return route.fulfill({ json: { viewerUserId: "alice", assetId, manifestUrl: `https://videodelivery.net/${assetId}/manifest/video.m3u8`, thumbnailUrl: `https://videodelivery.net/${assetId}/thumbnails/thumbnail.jpg`, expiresAt: Date.now() + 3600000, reuseUntil: Date.now() + 600000 } });
    }
    if (url.pathname === "/api/media/instructional-image") return route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") });
    return route.fulfill({ contentType: "text/html", body: `<style>${css}</style><div id="root"></div><script>window.fixtureProtected="${protectedMode ? "1" : "0"}";${bundle}</script>` });
  });
  await page.route("https://videodelivery.net/**", route => route.request().url().includes("/thumbnails/")
    ? route.fulfill({ contentType: "image/svg+xml", headers: { "Access-Control-Allow-Origin": "*" }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#345"/></svg>' }) : route.abort());
  await page.goto("https://fixture.invalid/");
  await page.locator(".focused-card-surface--front .active-card-identity").click();
  await expect(page.locator(".switchplay-video-host video")).toHaveAttribute("src", /\/a\/manifest/);
  await expect(page.locator(".switchplay-video-host video")).toBeVisible();
}
const video = (page: Page) => page.locator(".switchplay-video-host video");
const plays = (page: Page) => page.evaluate(() => (window as unknown as Controls).plays);
test("protected host navigation continues only from video intent and keeps one element across video tabs and repeated sources", async ({ page }) => {
  await setup(page); const identity = await video(page).getAttribute("data-diag-video-id");
  expect(identity).toBeTruthy();
  expect(await plays(page)).toHaveLength(0); await video(page).evaluate(node => (node as HTMLVideoElement).play());
  await page.getByRole("tab", { name: "Again", exact: true }).click(); await expect.poll(async () => (await plays(page)).length).toBe(2);
  expect((await plays(page)).at(-1)).toContain("/b/manifest"); expect(await video(page).getAttribute("data-diag-video-id")).toBe(identity);
  await video(page).evaluate(node => (node as HTMLVideoElement).pause()); await page.getByRole("tab", { name: "Watch", exact: true }).click();
  await expect(video(page)).toHaveAttribute("src", /\/a\/manifest/); expect(await plays(page)).toHaveLength(2);
  await video(page).evaluate(node => (node as HTMLVideoElement).play()); await page.getByRole("tab", { name: "Image", exact: true }).click(); await expect(video(page)).toHaveCount(0);
  await page.getByRole("tab", { name: "Again", exact: true }).click(); await expect(video(page)).toHaveAttribute("src", /\/b\/manifest/); expect(await plays(page)).toHaveLength(3);
  await video(page).evaluate(node => (node as HTMLVideoElement).play()); await page.getByRole("tab", { name: "Explore", exact: true }).click(); await expect(video(page)).toHaveCount(0);
  await page.getByRole("tab", { name: "Again", exact: true }).click(); await expect(video(page)).toHaveAttribute("src", /\/b\/manifest/); expect(await plays(page)).toHaveLength(4);
  await video(page).evaluate(node => (node as HTMLVideoElement).play()); await page.locator(".step-view-layer").getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".step-view-layer")).toHaveCount(1); await expect(video(page)).toBeVisible(); const repeated = await video(page).getAttribute("data-diag-video-id");
  await page.getByRole("tab", { name: "Repeat", exact: true }).click(); await expect(video(page)).toBeVisible();
  expect(await video(page).getAttribute("data-diag-video-id")).toBe(repeated); await expect(page.locator(".switchplay-video-loading-cover")).toHaveCount(0);
});
test("ended, stalled and rapid Next preserve the legacy continuation chain through real host controls", async ({ page }) => {
  await setup(page); await video(page).evaluate(node => (node as HTMLVideoElement).play());
  await video(page).evaluate(node => (window as unknown as Controls).endVideo(node as HTMLVideoElement));
  await page.locator(".step-view-layer").getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".step-view-layer")).toHaveCount(1); await expect.poll(async () => (await plays(page)).length).toBe(2);
  await video(page).evaluate(node => (window as unknown as Controls).stallVideo(node as HTMLVideoElement));
  await page.locator(".step-view-layer").getByRole("button", { name: "Next", exact: true }).evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click(); });
  await expect(video(page)).toHaveAttribute("src", /\/d\/manifest/); await expect.poll(async () => (await plays(page)).at(-1)).toContain("/d/manifest");
  expect(await page.locator("video").count()).toBe(1);
});

for (const protectedMode of [false, true]) {
  test(`${protectedMode ? "protected" : "direct"} positions survive tabs, close and Card remount but reset at an account boundary`, async ({ page }) => {
    await setup(page, protectedMode);
    await video(page).evaluate(node => { (node as HTMLVideoElement).currentTime = 17; });
    await page.getByRole("tab", { name: "Again", exact: true }).click(); await expect(video(page)).toHaveAttribute("src", /\/b\/manifest/);
    await video(page).evaluate(node => { (node as HTMLVideoElement).currentTime = 29; });
    await page.getByRole("tab", { name: "Image", exact: true }).click(); await expect(video(page)).toHaveCount(0);
    await page.getByRole("tab", { name: "Again", exact: true }).click();
    await expect.poll(() => video(page).evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(29);
    await page.getByRole("tab", { name: "Watch", exact: true }).click();
    await expect.poll(() => video(page).evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(17);
    await page.locator(".step-view-layer").getByRole("button", { name: "Close step view" }).click();
    await expect(page.locator(".step-view-layer")).toHaveCount(0);
    await page.locator(".focused-card-surface--front .active-card-identity").click();
    await expect.poll(() => video(page).evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(17);
    await video(page).evaluate(node => { (node as HTMLVideoElement).currentTime = 31; });
    await page.evaluate(() => (window as unknown as Controls).unmountCard()); await expect(video(page)).toHaveCount(0);
    await page.evaluate(() => (window as unknown as Controls).mountCard()); await page.locator(".active-card-identity").click();
    await expect.poll(() => video(page).evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(31);
    await page.evaluate(() => (window as unknown as Controls).mountCard("bob")); await page.locator(".active-card-identity").click();
    await expect.poll(() => video(page).evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(0);
    await page.evaluate(() => (window as unknown as Controls).mountCard("alice")); await page.locator(".active-card-identity").click();
    await expect.poll(() => video(page).evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(0);
    expect(await plays(page)).toHaveLength(0);
  });
}

test("separate attachments sharing one source keep their own positions and expansion keeps the element and playback", async ({ page }) => {
  await setup(page);
  await page.locator(".step-view-layer").getByRole("button", { name: "Next", exact: true }).click(); await expect(page.locator(".step-view-layer")).toHaveCount(1);
  await expect(video(page)).toBeVisible(); await video(page).evaluate(node => { (node as HTMLVideoElement).currentTime = 23; });
  await page.getByRole("tab", { name: "Repeat", exact: true }).click(); await expect.poll(() => video(page).evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(0);
  await video(page).evaluate(node => { (node as HTMLVideoElement).currentTime = 7; });
  await page.getByRole("tab", { name: "Watch", exact: true }).click(); await expect.poll(() => video(page).evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(23);
  await page.getByRole("tab", { name: "Repeat", exact: true }).click(); await expect.poll(() => video(page).evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(7);
  await video(page).evaluate(node => (node as HTMLVideoElement).play()); const identity = await video(page).getAttribute("data-diag-video-id"), count = (await plays(page)).length;
  await page.getByRole("button", { name: "Expand video", exact: true }).click();
  const expanded = page.getByRole("dialog", { name: "Enlarged step video", exact: true }); await expect(expanded).toBeVisible();
  await expect(expanded.getByRole("button", { name: "Close enlarged video" })).toBeFocused();
  expect(await video(page).getAttribute("data-diag-video-id")).toBe(identity); expect(await plays(page)).toHaveLength(count);
  await page.keyboard.press("Escape"); await expect(expanded).toHaveCount(0); await expect(page.getByRole("button", { name: "Expand video", exact: true })).toBeFocused();
  expect(await video(page).getAttribute("data-diag-video-id")).toBe(identity);
  expect(await video(page).evaluate(node => ({ time: (node as HTMLVideoElement).currentTime, paused: (node as HTMLVideoElement).paused }))).toEqual({ time: 7, paused: false });
});

test("restored nonzero sources remain covered until the seek completes and stale seek events cannot reveal another source", async ({ page }) => {
  await setup(page); await video(page).evaluate(node => { (node as HTMLVideoElement).currentTime = 18; });
  await page.getByRole("tab", { name: "Again", exact: true }).click(); await expect(video(page)).toBeVisible();
  await page.evaluate(() => { (window as unknown as Controls).holdSeek = true; });
  await page.getByRole("tab", { name: "Watch", exact: true }).click(); await expect(video(page)).toHaveAttribute("src", /\/a\/manifest/);
  await expect(video(page)).toBeHidden();
  await page.getByRole("tab", { name: "Again", exact: true }).click(); await expect(video(page)).toHaveAttribute("src", /\/b\/manifest/);
  await page.evaluate(() => { (window as unknown as Controls).holdSeek = false; });
  await video(page).evaluate(node => (node as HTMLVideoElement).dispatchEvent(new Event("seeked")));
  await expect(video(page)).toBeVisible(); expect(await video(page).evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(0);
  await page.getByRole("tab", { name: "Watch", exact: true }).click();
  await expect.poll(() => video(page).evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(18);
});

test("a delayed protected grant cannot replace or play over a later source after rapid navigation", async ({ page }) => {
  let release!: () => void, waiting = false;
  const held = new Promise<void>(resolve => { release = resolve; });
  try {
    await setup(page, true, async id => { if (id === "b") { waiting = true; await held; } });
    await expect.poll(() => waiting).toBe(true);
    await video(page).evaluate(node => (node as HTMLVideoElement).play());
    await page.locator(".step-view-layer").getByRole("button", { name: "Next", exact: true }).click();
    await expect(video(page)).not.toHaveAttribute("src");
    await expect(page.locator(".step-view-layer")).toHaveCount(1);
    await page.locator(".step-view-layer").getByRole("button", { name: "Next", exact: true }).evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click(); });
    await expect(video(page)).toHaveAttribute("src", /\/d\/manifest/); await expect.poll(async () => (await plays(page)).at(-1)).toContain("/d/manifest");
    release(); await page.getByRole("button", { name: "Expand video", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Enlarged step video", exact: true })).toBeVisible();
    expect((await plays(page)).some(src => src.includes("/b/manifest"))).toBe(false);
    await expect(video(page)).toHaveAttribute("src", /\/d\/manifest/);
  } finally { release(); }
});

test("a blocked Play or source failure breaks continuation while native Play remains available", async ({ page }) => {
  await setup(page);
  await video(page).evaluate(node => (node as HTMLVideoElement).play());
  await page.evaluate(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("Blocked by browser", "NotAllowedError")); });
  const blocked = page.waitForEvent("console", { predicate: message => message.text().includes("Unable to play Cloudflare Stream HLS video.") });
  await page.getByRole("tab", { name: "Again", exact: true }).click(); await expect(video(page)).toHaveAttribute("src", /\/b\/manifest/);
  // A rejected explicit play reports paused intent before the next navigation.
  await blocked;
  const count = (await plays(page)).length;
  await page.getByRole("tab", { name: "Watch", exact: true }).click(); await expect(video(page)).toHaveAttribute("src", /\/a\/manifest/);
  expect(await plays(page)).toHaveLength(count); await expect(video(page)).toHaveAttribute("controls", "");
  await video(page).dispatchEvent("play"); await video(page).dispatchEvent("error");
  await expect(page.locator(".switchplay-video-loading-cover")).toContainText("Video unavailable.");
  await page.getByRole("tab", { name: "Again", exact: true }).click(); await expect(video(page)).toHaveAttribute("src", /\/b\/manifest/);
  expect(await plays(page)).toHaveLength(count);
});
