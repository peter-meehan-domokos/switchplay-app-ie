import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

let bundle: string;
test.beforeAll(async () => {
  bundle = (await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import DeckTile from './src/components/decks/DeckTile';
    const image={id:'cover',mediaType:'image',provider:'cloudflare-r2',assetId:'decks/cover.png',src:'https://assets.example.com/decks/cover.png',description:'Cover'};
    const video={id:'intro',mediaType:'video',provider:'cloudflare-stream',assetId:'intro',src:'https://iframe.videodelivery.net/intro',description:'Introduction'};
    const media=new URLSearchParams(location.search).get('media');
    const deck={surface:'canonical',id:'deck',deckTemplateId:'deck',version:1,title:'Media selection',category:null,ownerUsername:'Creator',showOwnerTag:true,
      introduction:media==='neither'?null:{image:media==='both'?image:null,video},cards:[{id:'card'}],streams:[]};
    createRoot(document.getElementById('root')).render(<DeckTile deck={deck} transition={{duration:0}} onSelect={()=>{}} onFrontCardAction={()=>{}} onIntroAnchorChange={()=>{}}/>);
  ` }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: {
    "process.env.NODE_ENV": JSON.stringify("test"), "process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA": JSON.stringify("1"),
  } })).outputFiles![0].text;
});

for (const media of ["both", "video", "neither"]) for (const status of [200, 401, 403, 503]) {
  if (media === "neither" && status !== 200) continue;
  test(`${media}: delivery ${status} preserves cover priority, Stream fallback and protected requests`, async ({ page }) => {
    const requests: URL[] = [];
    const externalRequests: string[] = [];
    await page.route("https://**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== "https://fixture.invalid") { externalRequests.push(url.origin); return route.abort(); }
      if (url.pathname === "/api/media/protected") {
        requests.push(url);
        return route.fulfill(status === 200 ? { contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="#ac6330"/></svg>' }
          : { status, contentType: "application/json", body: '{"error":"Media unavailable"}' });
      }
      return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
    });
    await page.goto(`https://fixture.invalid/?media=${media}`);
    await page.addStyleTag({ content: await readFile("src/app/globals.css", "utf8") });
    await page.addScriptTag({ content: bundle });
    if (media === "neither") {
      await expect(page.locator(".tile-mini-card-poster")).toHaveCount(0);
      expect(requests).toHaveLength(0);
    } else {
      const image = page.locator(".tile-mini-card-poster");
      await expect(image).toHaveCount(1);
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete)).toBe(true);
      expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth > 0)).toBe(status === 200);
      expect(requests).toHaveLength(1);
      const request = requests[0];
      expect(request.searchParams.get("provider")).toBe(media === "both" ? "r2" : "stream");
      expect(request.searchParams.get("format")).toBe(media === "both" ? "image" : "thumbnail");
      expect(request.searchParams.get("identity")).toBe(media === "both" ? "https://assets.example.com/decks/cover.png" : "intro");
      // Failure must never silently substitute a video for an explicit cover,
      // retry via an unprotected public URL, or mount a playback controller.
      await page.waitForTimeout(50); expect(requests).toHaveLength(1);
    }
    expect(externalRequests).toEqual([]);
    await expect(page.locator("video,iframe")).toHaveCount(0);
  });
}
