import { expect, test } from "@playwright/test";
import { build } from "esbuild";

let bundle: string, protectedBundle: string;
test.beforeAll(async () => {
  const options: import("esbuild").BuildOptions = { stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React, { useState, useRef } from 'react';
    import { createRoot } from 'react-dom/client';
    import Player from './src/components/media/CloudflareHlsVideoPlayer';
    import { createCardPlaybackGrants } from './src/lib/cardPlaybackGrants';
    const gates = new Map(); window.events = []; window.plays = []; window.intents = [];
    const guard = (item) => new Promise((resolve, reject) => gates.set(item.assetId, { resolve, reject }));
    window.finishGuard = (id, failed = false) => gates.get(id)[failed ? 'reject' : 'resolve']();
    // Browser layout is real; media readiness/authorization are controlled so no
    // decoder, network service or database is involved in these race tests.
    const nativeAdd = HTMLMediaElement.prototype.addEventListener;
    const nativeRemove = HTMLMediaElement.prototype.removeEventListener;
    const wrappers = new WeakMap(); window.sources = new Map();
    HTMLMediaElement.prototype.addEventListener = function(type, listener, options) {
      if (!wrappers.has(listener)) wrappers.set(listener, function(event) { if (!event.isTrusted) listener.call(this, event); });
      nativeAdd.call(this, type, wrappers.get(listener), options);
    };
    HTMLMediaElement.prototype.removeEventListener = function(type, listener, options) {
      nativeRemove.call(this, type, wrappers.get(listener), options);
    };
    let ready = 0, current = '';
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => ready });
    Object.defineProperty(HTMLMediaElement.prototype, 'currentSrc', { get: () => current });
    HTMLMediaElement.prototype.canPlayType = () => location.search.includes('hls') ? '' : 'probably';
    HTMLMediaElement.prototype.load = function () { ready = 0; current = ''; };
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () { window.plays.push(this.src); return Promise.resolve(); };
    window.frame = (id, state = 2, event = 'loadeddata') => {
      const video = document.querySelector('video'); ready = state;
      current = window.sources.get(id) ?? 'https://videodelivery.net/' + id + '/manifest/video.m3u8';
      video.dispatchEvent(new Event(event));
    };
    window.grantRequests = [];
    const grantReader = createCardPlaybackGrants({ viewerUserId: 'alice', cardTemplateId: 'card', version: 1,
      mode: location.search.includes('canonical') ? 'canonical' : 'working' }, async (input) => {
      const assetId = new URL(input, location.origin).searchParams.get('identity'); window.grantRequests.push(assetId);
      return Response.json({ viewerUserId: 'alice', assetId, manifestUrl: 'https://videodelivery.net/' + assetId + '/manifest/video.m3u8',
        thumbnailUrl: 'https://videodelivery.net/' + assetId + '/thumbnails/thumbnail.jpg', expiresAt: Date.now()+3600000, reuseUntil: Date.now()+300000 });
    });
    const resolvePlayback = process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA === '1' ? (item, signal) => grantReader.read(item, signal) : undefined;
    function App() {
      const [item, setItem] = useState(null), ref = useRef(null);
      window.select = (id, autoplay = false) => {
        const next = { id, assetId: id, mediaType: 'video', provider: 'cloudflare-stream',
          src: 'https://videodelivery.net/' + id, description: id };
        ref.current.loadMedia(next, { shouldPlay: autoplay }); setItem(next);
      };
      return <Player ref={ref} mediaItem={item} resolvePlayback={resolvePlayback} beforeLoad={location.search.includes('canonical') ? guard : undefined}
        onMediaDisplayStateChange={state => window.events.push(state)} onPlaybackIntentChange={intent => window.intents.push(intent)} />;
    }
    createRoot(document.getElementById('root')).render(<App />);
  ` }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA": '"0"', "process.env.NEXT_PUBLIC_PHASE2_MOCK_MEDIA": '"0"' },
    plugins: [{ name: "controlled-hls", setup(builder) {
      builder.onResolve({ filter: /^hls\.js$/ }, () => ({ path: "hls", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `export default class Hls {
        static isSupported() { return true; } static Events = { ERROR: 'error', MANIFEST_PARSED: 'manifest' };
        on(name, fn) { this[name] = fn; } attachMedia(video) { this.video = video; }
        loadSource(src) { const id = new URL(src).pathname.split('/')[1]; this.video.src = 'blob:https://fixture.invalid/' + id; window.sources.set(id, this.video.src); window.hlsInstances.push(this); this.manifest?.(); }
        destroy() {} } window.hlsInstances = [];`, loader: "js" }));
    } }] };
  const result = await build(options); bundle = result.outputFiles![0].text;
  protectedBundle = (await build({ ...options, define: { ...options.define, "process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA": JSON.stringify("1") } })).outputFiles![0].text;
});

type Fixture = Window & { select(id: string, autoplay?: boolean): void; finishGuard(id: string, failed?: boolean): void;
  frame(id: string, state?: number, event?: string): void; plays: string[]; grantRequests: string[]; intents: string[]; events: { assetId: string; state: string }[];
  hlsInstances: { error?: (event: string, data: { fatal: boolean }) => void }[] };

for (const protectedDelivery of [false, true]) for (const transport of ["native", "hls"]) for (const context of ["working", "canonical"]) {
  test(`${protectedDelivery ? "grants" : "direct"} ${context} ${transport}: delayed/failed and superseded videos stay concealed; autoplay and pause survive`, async ({ page }) => {
    await page.route("https://fixture.invalid/**", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
    await page.route("https://videodelivery.net/**", route => route.abort());
    await page.goto(`https://fixture.invalid/?${transport}&${context}`);
    page.on("pageerror", error => { throw error; });
    await page.addScriptTag({ content: protectedDelivery ? protectedBundle : bundle });
    const video = page.locator("video"); await expect(video).toHaveCount(1);
    const identity = await video.getAttribute("data-diag-video-id");
    const select = async (id: string, autoplay = false) => page.evaluate(([id, autoplay]) => (window as unknown as Fixture).select(id as string, autoplay as boolean), [id, autoplay]);
    const authorize = async (id: string) => { if (context === "canonical") await page.evaluate(id => (window as unknown as Fixture).finishGuard(id), id); };
    await select("a", true); await authorize("a");
    await expect(video).toBeHidden();
    await page.evaluate(() => (window as unknown as Fixture).frame("a", 1, "loadedmetadata")); await expect(video).toBeHidden();
    await page.evaluate(() => (window as unknown as Fixture).frame("a")); await expect(video).toBeVisible();
    // Check concealment in the same task as navigation, before React commits.
    expect(await page.evaluate(() => { (window as unknown as Fixture).select("b", true); return getComputedStyle(document.querySelector('video')!).visibility; })).toBe("hidden");
    await expect(page.getByRole("status")).toHaveText("Preparing video…");
    if (context === "canonical") await expect(video).not.toHaveAttribute("src");
    await select("c", false);
    if (context === "canonical") { await authorize("b"); await expect(video).not.toHaveAttribute("src"); }
    await authorize("c");
    await page.evaluate(() => (window as unknown as Fixture).frame("b", 2, "playing")); await expect(video).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as Fixture).intents)).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as Fixture).events.filter(e => e.assetId === "b" && e.state === "renderable"))).toEqual([]);
    await page.evaluate(() => (window as unknown as Fixture).frame("c")); await expect(video).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as Fixture).plays.some(src => /\/c(?:\/|$)/.test(src)))).toBe(false);
    // Reverse direction back to the first video while keeping the player instance.
    await select("a", false); await authorize("a"); await expect(video).toBeHidden();
    await page.evaluate(() => (window as unknown as Fixture).frame("c")); await expect(video).toBeHidden();
    await page.evaluate(() => (window as unknown as Fixture).frame("a")); await expect(video).toBeVisible();
    await select("d", true); await authorize("d"); await expect(video).toBeHidden();
    await page.evaluate(() => (window as unknown as Fixture).frame("d")); await expect(video).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as Fixture).plays.some(src => /\/d(?:\/|$)/.test(src)))).toBe(true);
    await select("failure");
    if (context === "canonical") await page.evaluate(() => (window as unknown as Fixture).finishGuard("failure", true));
    else if (transport === "hls") await page.evaluate(() => (window as unknown as Fixture).hlsInstances.at(-1)!.error!("error", { fatal: true }));
    else await video.dispatchEvent("error");
    await expect(page.getByText("Video unavailable.", { exact: true })).toBeVisible(); await expect(video).toBeHidden();
    await page.evaluate(() => (window as unknown as Fixture).frame("d")); await expect(video).toBeHidden();
    await page.evaluate(() => (window as unknown as Fixture).frame("failure")); await expect(video).toBeHidden();
    await expect(video).toHaveAttribute("data-diag-video-id", identity!);
    if (protectedDelivery) expect(await page.evaluate(() => (window as unknown as Fixture).grantRequests.filter(id => id === "a"))).toHaveLength(1);
  });
}
