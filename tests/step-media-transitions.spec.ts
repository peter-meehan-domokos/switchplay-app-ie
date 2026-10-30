import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

let bundle: string, css: string;
test.beforeAll(async () => {
  const compiled = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import FocusedCardView from './src/components/decks/FocusedCardView';
    const video=(id,label)=>({id,label,kind:'video',media:{id,mediaType:'video',provider:'cloudflare-stream',assetId:id,src:'https://iframe.videodelivery.net/'+id,description:id,width:1920,height:1080}});
    const image={id:'diagram',label:'Image',kind:'image',alt:'Diagram',media:{id:'diagram',mediaType:'image',provider:'cloudflare-r2',assetId:'diagram.png',src:'https://invalid.example/diagram.png',description:'Diagram'}};
    const root={id:'root',label:'Explore',kind:'activity',activityId:'roots-and-factors'};
    const card={id:'card',cardTemplateId:'card',label:'Card 1',dataOwnerUserId:'alice',adoptedVersion:1,targetDate:'2026-10-30',signals:[],progressPercentage:0,reflection:'',mediaItems:[],chats:[],
      intro:{title:'Introduction',description:null,mediaItems:[video('a','Watch'),video('b','Again'),image,root]},
      steps:[{stepId:'one',description:'First',mediaItems:[video('b','Watch'),video('b','Repeat')]},{stepId:'two',description:'Second',mediaItem:video('c','Watch').media},{stepId:'three',description:'Third',mediaItem:video('d','Watch').media}]};
    createRoot(document.getElementById('root')).render(<FocusedCardView card={card} deckTemplateId="deck" deckVersion={1} cardIndex={0} totalCards={1} isDeckFlipped={false}
      onClose={()=>{}} onPrevious={()=>{}} onNext={()=>{}} traversalDirection="next" transition={{duration:0}}/>);
  ` }, bundle: true, write: false, outfile: "fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    loader: { ".ttf": "dataurl", ".woff": "dataurl", ".woff2": "dataurl" },
    define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA": '"1"', "process.env.NEXT_PUBLIC_PHASE2_MOCK_MEDIA": '"0"', "process.env": "{}" } });
  bundle = compiled.outputFiles!.find(file => file.path.endsWith(".js"))!.text;
  css = await readFile("src/app/globals.css", "utf8") + (compiled.outputFiles!.find(file => file.path.endsWith(".css"))?.text ?? "");
});
type Controls = { plays: string[]; endVideo(video: HTMLVideoElement): void; stallVideo(video: HTMLVideoElement): void };
async function setup(page: Page) {
  await page.addInitScript(() => {
    const win = window as unknown as Controls; win.plays = [];
    const paused = new WeakMap<HTMLMediaElement, boolean>(), ended = new WeakMap<HTMLMediaElement, boolean>();
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
      paused.set(this, true); ended.set(this, false); const src = this.getAttribute("src");
      if (src) setTimeout(() => { if (this.getAttribute("src") === src) for (const type of ["loadedmetadata", "loadeddata", "canplay"]) this.dispatchEvent(new Event(type)); }, 0);
    };
    HTMLVideoElement.prototype.requestVideoFrameCallback = callback => requestAnimationFrame(time => callback(time, {} as VideoFrameCallbackMetadata));
    HTMLVideoElement.prototype.cancelVideoFrameCallback = cancelAnimationFrame;
    win.endVideo = video => { ended.set(video, true); paused.set(video, true); video.dispatchEvent(new Event("ended")); video.dispatchEvent(new Event("pause")); };
    win.stallVideo = video => { video.dispatchEvent(new Event("waiting")); video.dispatchEvent(new Event("stalled")); };
  });
  await page.route("https://fixture.invalid/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/media/protected") {
      const assetId = url.searchParams.get("identity");
      return route.fulfill({ json: { viewerUserId: "alice", assetId, manifestUrl: `https://videodelivery.net/${assetId}/manifest/video.m3u8`, thumbnailUrl: `https://videodelivery.net/${assetId}/thumbnails/thumbnail.jpg`, expiresAt: Date.now() + 3600000, reuseUntil: Date.now() + 600000 } });
    }
    if (url.pathname === "/api/media/instructional-image") return route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") });
    return route.fulfill({ contentType: "text/html", body: `<style>${css}</style><div id="root"></div><script>${bundle}</script>` });
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
