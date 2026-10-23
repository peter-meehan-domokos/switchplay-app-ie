import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

let bundle: string, componentCss: string;
test.beforeAll(async () => {
  const compiled = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import DeckGrid from './src/components/decks/DeckGrid';
      import DeckScene from './src/components/decks/DeckScene';
      const query = new URLSearchParams(location.search), canonical = query.has('canonical');
      const makeDeck = id => {
        const personal = {dataOwnerUserId:'alice',adoptedVersion:1};
        const card = {id:'card-'+id,cardTemplateId:'card-'+id,label:'Card',intro:{title:'Card'},steps:[],
          ...(canonical ? {surface:'canonical',version:1} : {...personal,targetDate:'2026-10-16',mediaItems:[],signals:[],chats:[]})};
        return {id,deckTemplateId:id,title:id,category:null,ownerUsername:'Creator',showOwnerTag:false,
          ...(canonical ? {surface:'canonical',version:1} : {...personal,progressPercentage:0,confidenceScore:null}),
          introduction:{image:null,video:{id:'intro-'+id,assetId:id,mediaType:'video',provider:'cloudflare-stream',
            src:'https://iframe.videodelivery.net/'+id,description:'Introduction',width:640,height:360}},cards:[card]};
      };
      const decks = ['first','second'].map(makeDeck);
      const view = query.has('grid') ? <DeckGrid decks={decks} instantiatingDeckTemplateId={null}
        isInteractionLocked={false} onSelectDeck={()=>{}} transition={{duration:0}} /> :
        <DeckScene deck={decks[0]} onBack={()=>{}} transition={{duration:0}} />;
      createRoot(document.getElementById('root')).render(<React.StrictMode>{view}</React.StrictMode>);
    ` },
    bundle: true, write: false, outfile: "fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  });
  bundle = compiled.outputFiles!.find(file => file.path.endsWith(".js"))!.text;
  componentCss = compiled.outputFiles!.find(file => file.path.endsWith(".css"))?.text ?? "";
});

async function setup(page: Page, context: string, canonical: boolean) {
  const video = await readFile("tests/fixtures/handoff-red.webm");
  const pending = new Map<string, { promise: Promise<void>; release: () => void }>();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.addInitScript(() => {
    // Real local decoding through the native-source branch; this is not a
    // claim of real Safari HLS/provider acceptance. Lifecycle and rendering are real.
    const canPlay = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type) {
      return /mpegurl/i.test(type) ? "probably" : canPlay.call(this, type);
    };
    const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src")!;
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      ...src, set(value: string) { src.set!.call(this, value.replace("/manifest/video.m3u8", "/fixture.webm")); },
    });
  });
  await page.route("https://**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === "https://fixture.invalid") {
      if (url.pathname === "/api/library/media/stream-status") return route.fulfill({ json: { status: "ready" } });
      return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
    }
    if (url.origin !== "https://videodelivery.net") return route.abort();
    if (url.pathname.includes("thumbnail")) return route.fulfill({ contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="blue"/></svg>' });
    const asset = url.pathname.split("/")[1];
    // Deliberately hold each incoming source to verify it stays concealed until ready.
    if (!pending.has(asset)) {
      let release!: () => void;
      const promise = new Promise<void>(resolve => { release = resolve; });
      pending.set(asset, { promise, release });
    }
    await pending.get(asset)!.promise;
    const range = route.request().headers()["range"]?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]), end = Math.min(range[2] ? Number(range[2]) : video.length - 1, video.length - 1);
      return route.fulfill({ status: 206, contentType: "video/webm", headers: {
        "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${video.length}`,
      }, body: video.subarray(start, end + 1) });
    }
    return route.fulfill({ contentType: "video/webm", headers: { "Accept-Ranges": "bytes" }, body: video });
  });
  await page.goto(`https://fixture.invalid/?${context}${canonical ? "&canonical" : ""}`);
  await page.addStyleTag({ content: await readFile("src/app/globals.css", "utf8") + componentCss });
  await page.addScriptTag({ content: bundle });
  return { errors, release: async (asset: string) => {
    await expect.poll(() => pending.has(asset)).toBe(true);
    pending.get(asset)!.release();
  } };
}

async function expectPlaying(page: Page) {
  const video = page.locator("video");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(2);
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => !node.paused && node.currentTime > 0)).toBe(true);
}

for (const canonical of [false, true]) for (const context of ["grid", "scene"]) {
  test(`${canonical ? "Library" : "working"} ${context}: imperative Deck introduction remains visible while playing`, async ({ page }, info) => {
    const fixture = await setup(page, context, canonical);
    const video = page.locator("video");
    const play = () => page.getByRole("button", { name: context === "grid" ? "Play introduction for first" : "Play introduction video for first", exact: true }).last().click();
    await play();
    await expect(video).toHaveCSS("visibility", "hidden");
    await fixture.release("first");
    await expectPlaying(page);
    const originalNode = await video.elementHandle();
    await page.screenshot({ path: info.outputPath("playing-introduction.png") });

    if (context === "grid") {
      await page.locator(".deck-grid-intro-host").getByRole("button", { name: "Pause introduction for first", exact: true }).click();
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
      await expect(video).toBeVisible();
      await play();
      await expectPlaying(page);
      await page.getByRole("button", { name: "Expand video", exact: true }).click();
      await expect(page.locator(".deck-grid-intro-host")).toHaveClass(/--expanded/);
      await expect(video).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator(".deck-grid-intro-host")).not.toHaveClass(/--expanded/);
      await expectPlaying(page);
      await page.getByRole("button", { name: "Play introduction for second", exact: true }).click();
      await expect(video).toHaveCSS("visibility", "hidden");
      await fixture.release("second");
      await expectPlaying(page);
      expect(await video.evaluate((node: HTMLVideoElement) => node.currentSrc)).toContain("/second/");
    } else {
      await page.getByRole("button", { name: "Close enlarged video", exact: true }).click();
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
      await play();
      await expectPlaying(page);
      // Replay after natural end exercises the full reset path, not just resume.
      await video.evaluate((node: HTMLVideoElement) => { node.currentTime = node.duration - 0.05; });
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.ended)).toBe(true);
      await page.getByRole("button", { name: "Close enlarged video", exact: true }).click();
      await play();
      await expectPlaying(page);
    }
    expect(await originalNode!.evaluate((node, current) => node === current, await video.elementHandle())).toBe(true);
    expect(fixture.errors).toEqual([]);
  });
}
