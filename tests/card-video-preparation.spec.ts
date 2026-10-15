import { expect, test, webkit, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
let bundle: string, decodedBundle: string;
test.beforeAll(async () => {
  const options: import("esbuild").BuildOptions = { stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React, { useState } from 'react'; import { createRoot } from 'react-dom/client';
    import FocusedCardView from './src/components/decks/FocusedCardView';
    window.setHidden = hidden => { Object.defineProperty(document, 'visibilityState', {configurable:true,get:()=>hidden?'hidden':'visible'}); document.dispatchEvent(new Event('visibilitychange')); };
    const video = assetId => ({ id: assetId, assetId, mediaType: 'video', provider: 'cloudflare-stream',
      src: 'https://videodelivery.net/'+assetId, description: assetId, width: 1920, height: 1080 });
    function App() {
      const [scope, setScope] = useState(null); window.mountCard = (actor='alice', version=1) => setScope({actor, version});
      window.unmountCard = () => setScope(null);
      if (!scope) return null;
      const canonical = location.search.includes('canonical');
      const card = { id: 'card', cardTemplateId: 'card', label: 'Card 1', intro: {title:'Introduction',description:'intro',mediaItem:video('intro')},
        steps: [1,2,3].map(i=>({stepId:'step'+i,title:'Step '+i,description:'instruction',mediaItem:video('step'+i)})),
        ...(canonical ? {surface:'canonical',version:scope.version} : {adoptedVersion:scope.version,dataOwnerUserId:scope.actor,
          targetDate:'2026-10-15',signals:[],progressPercentage:0,reflection:'',mediaItems:[],chats:[]}) };
      return <FocusedCardView card={card} cardIndex={0} totalCards={1} deckTemplateId="deck" isDeckFlipped={false}
        playbackViewerUserId={scope.actor} onClose={()=>{}} onPrevious={()=>{}} onNext={()=>{}} traversalDirection="next" transition={{duration:0}} />;
    }
    createRoot(document.getElementById('root')).render(<App />);
  ` }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: {
    "process.env.NODE_ENV": JSON.stringify("test"), "process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA": JSON.stringify("1"),
    "process.env.NEXT_PUBLIC_PHASE2_MOCK_MEDIA": JSON.stringify("0"), "process.env": "{}",
  } };
  bundle = (await build(options)).outputFiles![0].text;
  // Only the transport URL adapter is replaced for real decoder tests: local
  // WebM fixtures are not HLS manifests. Card/player/poster code stays real.
  decodedBundle=(await build({...options,define:{...options.define,"process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA":JSON.stringify("0")},plugins:[{
    name:"local-video-fixtures",setup(builder){
      builder.onResolve({filter:/cloudflareStreamPlayback$/},()=>({path:"playback",namespace:"fixture"}));
      builder.onLoad({filter:/.*/,namespace:"fixture"},()=>({loader:"js",contents:`
        export const getCloudflareStreamHlsManifestUrl = media => 'https://fixture.invalid/videos/'+media.assetId+'.webm';
        export const getCloudflareStreamThumbnailUrl = media => 'https://fixture.invalid/thumbnails/'+media.assetId+'.svg';
        export const createCloudflareStreamIframeUrl = id => 'https://fixture.invalid/unused/'+id;
      `}));
    }
  }]})).outputFiles![0].text;
});

const thumbnail = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#ac6330"/><text x="40" y="180" fill="white" font-size="30">Prepared thumbnail</text></svg>';
async function controlledFrames(page: Page) {
  await page.addInitScript(() => {
    // Image downloads/decoding and CSS are real. Only video decoding is
    // controlled, allowing assertions before and after current-frame readiness.
    let ready = 0, source = "";
    const win = window as unknown as { frame(id: string, state?: number, present?: boolean): void; present(): void; decoded: string[] };
    const callbacks=new Map<number, VideoFrameRequestCallback>(); let nextCallback=0;
    HTMLVideoElement.prototype.requestVideoFrameCallback=function(callback) {callbacks.set(++nextCallback,callback);return nextCallback;};
    HTMLVideoElement.prototype.cancelVideoFrameCallback=function(id) {callbacks.delete(id);};
    win.present=()=>{for(const [id,callback] of [...callbacks]){callbacks.delete(id);callback(performance.now(),{} as VideoFrameCallbackMetadata);}};
    win.decoded = [];
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () { await decode.call(this); win.decoded.push(this.src); };
    const add = HTMLMediaElement.prototype.addEventListener, remove = HTMLMediaElement.prototype.removeEventListener;
    const wrappers = new WeakMap<EventListenerOrEventListenerObject, EventListener>();
    HTMLMediaElement.prototype.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
      if (!listener) return;
      if (!wrappers.has(listener)) wrappers.set(listener, function (this: HTMLMediaElement, event) {
        if (!event.isTrusted) { if (typeof listener === "function") listener.call(this, event); else listener.handleEvent(event); }
      });
      add.call(this, type, wrappers.get(listener)!, options);
    };
    HTMLMediaElement.prototype.removeEventListener = function (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
      if (listener) remove.call(this, type, wrappers.get(listener)!, options);
    };
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", { get: () => ready });
    Object.defineProperty(HTMLMediaElement.prototype, "currentSrc", { get: () => source });
    HTMLMediaElement.prototype.canPlayType = () => "probably";
    HTMLMediaElement.prototype.load = function () { ready = 0; source = ""; };
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    win.frame = (id, state = 2, present = true) => {
      source = `https://videodelivery.net/${id}/manifest/video.m3u8`; ready = state;
      document.querySelector("video")!.dispatchEvent(new Event("loadeddata"));
      if(present)win.present();
    };
  });
}

for (const mode of ["working", "canonical"]) test(`${mode}: each grant prepares its decoded image immediately; navigation moves the same images without new downloads`, async ({page}) => {
  const grants = new Map<string, () => Promise<void>>(), downloads: string[] = [];
  await controlledFrames(page);
  await page.route("https://fixture.invalid/**", async route => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get("format") === "grant") {
      const id = q.get("identity")!;
      await new Promise<void>(done => grants.set(id, async () => {
        await route.fulfill({json:{viewerUserId:"alice",assetId:id,manifestUrl:`https://videodelivery.net/${id}/manifest/video.m3u8`,
          thumbnailUrl:`https://videodelivery.net/${id}/thumbnails/thumbnail.jpg`,expiresAt:Date.now()+3600000,reuseUntil:Date.now()+600000}}); done();
      })); return;
    }
    if (route.request().url().includes("stream-status")) return route.fulfill({json:{status:"ready"}});
    if (route.request().url().includes("/api/")) return route.fulfill({status:404,body:"unused"});
    return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'});
  });
  await page.route("https://videodelivery.net/**", async route => {
    if (route.request().url().endsWith("thumbnail.jpg")) {
      downloads.push(new URL(route.request().url()).pathname.split("/")[1]);
      return route.fulfill({contentType:"image/svg+xml",body:thumbnail});
    }
    return route.abort();
  });
  await page.goto(`https://fixture.invalid/?${mode}`);
  await page.addStyleTag({content:await readFile("src/app/globals.css", "utf8")});
  await page.addScriptTag({content:bundle});
  try {
    await page.evaluate(() => (window as unknown as Harness).mountCard()); await expect.poll(()=>grants.size).toBe(4);
    await grants.get("intro")!();
    await expect.poll(()=>page.evaluate(()=>(window as unknown as {decoded:string[]}).decoded.length)).toBe(1);
    expect(downloads).toEqual(["intro"]); // Other three grants have not returned.
    await page.locator(".active-card-identity").press("Enter");
    const poster = page.locator(".switchplay-video-poster"); await expect(poster).toBeVisible();
    await expect(page.locator(".switchplay-video-content [role=status]")).toHaveCount(0);
    await page.evaluate(() => { (window as unknown as {introPoster:Element}).introPoster=document.querySelector(".switchplay-video-poster")!; });
    for (const id of ["step1","step2","step3"]) await grants.get(id)!();
    await expect.poll(()=>page.evaluate(()=>(window as unknown as {decoded:string[]}).decoded.length)).toBe(4);
    for (const label of ["INTRO","STEP 1","STEP 2"]) {
      await page.getByRole("region",{name:`${label} detail`,exact:true}).getByRole("button",{name:"Next",exact:true}).dispatchEvent("click");
      await expect(poster).toBeVisible();
    }
    for (const label of ["STEP 3","STEP 2","STEP 1"]) await page.getByRole("region",{name:`${label} detail`,exact:true}).getByRole("button",{name:"Previous",exact:true}).dispatchEvent("click");
    await expect(poster).toHaveAttribute("src", "https://videodelivery.net/intro/thumbnails/thumbnail.jpg");
    await expect.poll(()=>page.evaluate(()=>{
      const anchor=document.querySelector('[aria-label="INTRO detail"] .step-view-video-anchor')!.getBoundingClientRect();
      const host=document.querySelector('.switchplay-video-host')!.getBoundingClientRect();
      return Math.abs(anchor.left-host.left)+Math.abs(anchor.top-host.top);
    })).toBeLessThan(2);
    if (mode==="working") { await page.waitForTimeout(800); await page.screenshot({path:"/tmp/switchplay-thumbnail-prepared-desktop.png"}); }
    expect(await page.evaluate(()=>(window as unknown as {introPoster:Element}).introPoster===document.querySelector(".switchplay-video-poster"))).toBe(true);
    expect(downloads.sort()).toEqual(["intro","step1","step2","step3"]); // Route interception disables HTTP caching.
    await expect(page.locator("video")).not.toHaveAttribute("poster");
    await page.evaluate(()=>(window as unknown as {frame(id:string,state?:number):void}).frame("step3"));
    await expect(poster).toHaveCSS("opacity","1"); await expect(page.locator("video")).toBeHidden();
    await page.evaluate(()=>(window as unknown as {frame(id:string,state?:number):void}).frame("intro",1));
    await expect(poster).toHaveCSS("opacity","1");
    await page.evaluate(()=>(window as unknown as {frame(id:string,state?:number,present?:boolean):void}).frame("intro",2,false));
    await page.waitForTimeout(300); await expect(poster).toHaveCSS("opacity","1");
    await page.evaluate(()=>(window as unknown as {present():void}).present());
    await expect(page.locator("video")).toBeVisible(); await expect(poster).toHaveCount(0);
  } finally {
    await page.evaluate(()=>(window as unknown as Harness).unmountCard());
    for(const finish of grants.values()) await finish().catch(()=>{});
  }
});

test("renewed grants replace thumbnails; learner/version changes and closing release retained image nodes", async ({page}) => {
  const counts=new Map<string,number>(), downloads:string[]=[];
  const start=Date.now(); await page.clock.setFixedTime(new Date(start)); await controlledFrames(page);
  await page.route("https://fixture.invalid/**", async route => {
    const q=new URL(route.request().url()).searchParams;
    if(q.get("format")==="grant") {
      const id=q.get("identity")!,actor=route.request().headers()["x-personal-viewer"],version=q.get("version");
      const key=`${actor}-${version}-${id}`,count=(counts.get(key)??0)+1;counts.set(key,count);
      return route.fulfill({json:{viewerUserId:actor,assetId:id,manifestUrl:`https://videodelivery.net/${id}/manifest/video.m3u8`,
        thumbnailUrl:`https://videodelivery.net/${id}/thumbnails/thumbnail.jpg?context=${key}&grant=${count}`,
        expiresAt:start+3600000+count*600000,reuseUntil:start+count*600000}});
    }
    if(route.request().url().includes("/api/")) return route.fulfill({status:404,body:"unused"});
    return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'});
  });
  await page.route("https://videodelivery.net/**", async route => {
    if(route.request().url().includes("thumbnail.jpg")) {downloads.push(route.request().url());return route.fulfill({contentType:"image/svg+xml",body:thumbnail});}
    return route.abort();
  });
  await page.goto("https://fixture.invalid/?working");await page.addStyleTag({content:await readFile("src/app/globals.css","utf8")});await page.addScriptTag({content:bundle});
  await page.evaluate(()=>(window as unknown as Harness).mountCard());
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {decoded:string[]}).decoded.length)).toBe(4);
  await page.locator(".active-card-identity").press("Enter");await expect(page.locator(".switchplay-video-poster")).toBeVisible();
  await page.evaluate(()=>{(window as unknown as {oldImage:Element}).oldImage=document.querySelector(".switchplay-video-poster")!;});
  await page.clock.setFixedTime(new Date(start+540000));
  await page.getByRole("region",{name:"INTRO detail",exact:true}).getByRole("button",{name:"Next",exact:true}).dispatchEvent("click");
  await expect.poll(()=>downloads.length).toBe(8);
  await expect(page.locator(".switchplay-video-poster")).toHaveAttribute("src",/grant=2$/);
  expect(await page.evaluate(()=>(window as unknown as {oldImage:Element}).oldImage.hasAttribute("src"))).toBe(false);
  await page.evaluate(()=>(window as unknown as Harness).mountCard("bob",2));
  await expect(page.getByRole("region",{name:"STEP 1 detail",exact:true})).toHaveCount(0);
  await expect.poll(()=>downloads.length).toBe(12);
  expect(downloads.slice(-4).every(url=>url.includes("context=bob-2-"))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {decoded:string[]}).decoded.length)).toBe(12);
  await page.locator(".active-card-identity").press("Enter");
  await expect(page.locator(".switchplay-video-poster")).toHaveAttribute("src",/context=bob-2-intro/);
  await page.evaluate(()=>{(window as unknown as {closingImage:Element}).closingImage=document.querySelector(".switchplay-video-poster")!;});
  await page.evaluate(()=>(window as unknown as Harness).unmountCard());
  expect(await page.evaluate(()=>{const image=(window as unknown as {closingImage:Element}).closingImage;return !image.isConnected&&!image.hasAttribute("src");})).toBe(true);
});

test("delayed and failed thumbnails leave a visible loading message; video readiness ends loading independently", async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await controlledFrames(page);
  let releaseImage!: () => Promise<void>;
  await page.route("https://fixture.invalid/**", async route => {
    const q=new URL(route.request().url()).searchParams;
    if(q.get("format")==="grant") {const id=q.get("identity")!;return route.fulfill({json:{viewerUserId:"alice",assetId:id,
      manifestUrl:`https://videodelivery.net/${id}/manifest/video.m3u8`,thumbnailUrl:`https://videodelivery.net/${id}/thumbnails/thumbnail.jpg`,expiresAt:Date.now()+3600000,reuseUntil:Date.now()+600000}});}
    if(route.request().url().includes("/api/")) return route.fulfill({status:404,body:"unused"});
    return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'});
  });
  await page.route("https://videodelivery.net/**", async route => {
    if(route.request().url().includes("/intro/thumbnails/")) {await new Promise<void>(done=>{releaseImage=async()=>{await route.abort();done();};});return;}
    return route.abort();
  });
  await page.goto("https://fixture.invalid/?working"); await page.addStyleTag({content:await readFile("src/app/globals.css","utf8")}); await page.addScriptTag({content:bundle});
  try {
    await page.evaluate(()=>(window as unknown as Harness).mountCard()); await expect.poll(()=>!!releaseImage).toBe(true);
    await page.locator(".active-card-identity").press("Enter");
    const loading=page.locator(".switchplay-video-content .switchplay-video-loading-cover > [role=status]");
    await expect(loading).toBeVisible(); await expect(loading).toHaveText("Preparing video…");
    await expect(page.locator(".switchplay-video-player-layer")).toHaveCSS("visibility","hidden");
    await page.waitForTimeout(800); await page.screenshot({path:"/tmp/switchplay-thumbnail-loading-390.png"});
    await releaseImage(); await expect(loading).toBeVisible();
    await page.setViewportSize({width:320,height:720}); await page.waitForTimeout(800); await page.screenshot({path:"/tmp/switchplay-thumbnail-loading-320.png"});
    await page.evaluate(()=>(window as unknown as {frame(id:string):void}).frame("intro"));
    await expect(page.locator("video")).toBeVisible(); await expect(loading).toHaveCount(0);
  } finally { await page.evaluate(()=>(window as unknown as Harness).unmountCard()); }
});

async function renderedPixel(page: Page) {
  const rect=await page.locator(".switchplay-video-host").boundingBox();
  const png=await page.screenshot({clip:{x:Math.floor(rect!.x+rect!.width/4),y:Math.floor(rect!.y+rect!.height/4),width:1,height:1}});
  // A single pixel has no preceding pixel/row, so every PNG row filter has a
  // zero predictor. This reads the actual composited screenshot, not video state.
  expect(png[24]).toBe(8);expect([2,6]).toContain(png[25]);
  const chunks:Buffer[]=[];
  for(let p=8;p<png.length;){const size=png.readUInt32BE(p);if(png.toString("ascii",p+4,p+8)==="IDAT")chunks.push(png.subarray(p+8,p+8+size));p+=12+size;}
  return [...inflateSync(Buffer.concat(chunks)).subarray(1,4)];
}

for(const engine of ["chromium","webkit"]) for(const paused of [true,false]) test(`${engine} actual decoded frames: ${paused ? "paused" : "playing"} thumbnail handoff has no black composited gap`, async ({page:chromiumPage})=>{
  const browser=engine==="webkit"?await webkit.launch():null;
  const page=browser?await browser.newPage({viewport:{width:1024,height:900}}):chromiumPage;
  const red=await readFile("tests/fixtures/handoff-red.webm"),green=await readFile("tests/fixtures/handoff-green.webm");
  await page.addInitScript(()=>{
    // Real decoding/compositing using small local WebM fixtures; force the
    // player's native-source branch without pretending this is real Safari HLS.
    const canPlay=HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType=function(type){return type.includes("mpegurl")||type.includes("mpegURL")?"probably":canPlay.call(this,type);};
    const win=window as unknown as {hold:boolean;held:(()=>void)[]};win.hold=false;win.held=[];
    const frame=HTMLVideoElement.prototype.requestVideoFrameCallback;
    HTMLVideoElement.prototype.requestVideoFrameCallback=function(callback){return frame.call(this,(now,metadata)=>{
      const deliver=()=>callback(now,metadata);if(win.hold)win.held.push(deliver);else deliver();
    });};
  });
  await page.route("https://fixture.invalid/**",async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith("/thumbnails/"))return route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="rgb(40,90,210)"/></svg>'});
    if(url.pathname.startsWith("/videos/")) {
      const bytes=url.pathname.includes("/intro.")?red:green;
      const range=route.request().headers()["range"]?.match(/^bytes=(\d+)-(\d*)$/);
      if(range){const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):bytes.length-1,bytes.length-1);return route.fulfill({status:206,contentType:"video/webm",headers:{"Accept-Ranges":"bytes","Content-Range":`bytes ${start}-${end}/${bytes.length}`},body:bytes.subarray(start,end+1)});}
      return route.fulfill({contentType:"video/webm",headers:{"Accept-Ranges":"bytes"},body:bytes});
    }
    if(route.request().url().includes("/api/"))return route.fulfill({status:404,body:"unused"});
    return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'});
  });
  try {
    await page.goto("https://fixture.invalid/?working");await page.addStyleTag({content:await readFile("src/app/globals.css","utf8")});await page.addScriptTag({content:decodedBundle});
    await expect.poll(()=>page.evaluate(()=>typeof (window as unknown as Harness).mountCard)).toBe("function");
    await page.evaluate(()=>(window as unknown as Harness).mountCard());await page.locator(".active-card-identity").press("Enter");
    const video=page.locator("video"),poster=page.locator(".switchplay-video-poster");
    await expect(poster).toHaveCount(0);await expect(video).toBeVisible();
    await page.waitForTimeout(800);expect((await renderedPixel(page))[0]).toBeGreaterThan(150);
    if(!paused)await video.evaluate((element:HTMLVideoElement)=>element.play());
    await page.evaluate(()=>(window as unknown as {hold:boolean}).hold=true);
    await page.getByRole("region",{name:"INTRO detail",exact:true}).getByRole("button",{name:"Next",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as unknown as {held:unknown[]}).held.length)).toBeGreaterThan(0);
    await page.waitForTimeout(300);await expect(poster).toHaveCSS("opacity","1");
    expect((await renderedPixel(page))[2]).toBeGreaterThan(150);
    expect(await video.evaluate((element:HTMLVideoElement)=>element.paused)).toBe(paused);
    await page.evaluate(()=>{const win=window as unknown as {hold:boolean;held:(()=>void)[]};win.hold=false;win.held.splice(0).forEach(deliver=>deliver());});
    for(let i=0;i<10;i++){
      const pixel=await renderedPixel(page);
      expect(Math.max(...pixel),`black composited pixel at handoff sample ${i}: ${pixel}`).toBeGreaterThan(60);
      expect(pixel[0],`outgoing red frame at handoff sample ${i}`).toBeLessThan(100);
    }
    await expect(poster).toHaveCount(0);expect((await renderedPixel(page))[1]).toBeGreaterThan(130);
    await page.screenshot({path:`/tmp/switchplay-handoff-${engine}-${paused?"paused":"playing"}.png`});
  } finally {if(browser)await browser.close();}
});
type Harness = { mountCard(actor?: string, version?: number): void; unmountCard(): void; setHidden(hidden: boolean): void };
for (const mode of ["working", "canonical"]) test(`${mode} focused Card prepares four independent grants and preserves them through Next/Previous`, async ({ page }) => {
  const grants: string[] = [], statuses: string[] = [];
  await page.route("https://fixture.invalid/**", async route => {
    const query = new URL(route.request().url()).searchParams;
    if (query.get("format") === "grant") {
      const id = query.get("identity")!; grants.push(id);
      return route.fulfill({ json: {viewerUserId:"alice",assetId:id,manifestUrl:`https://videodelivery.net/${id}/manifest/video.m3u8`,
        thumbnailUrl:`https://videodelivery.net/${id}/thumbnails/thumbnail.jpg`, expiresAt:Date.now()+3600000,reuseUntil:Date.now()+600000} });
    }
    if (route.request().url().includes("stream-status")) { statuses.push(query.get("assetId")!); return route.fulfill({json:{status:"ready"}}); }
    if (route.request().url().includes("/api/")) return route.fulfill({status:404,body:"unused legacy media route"});
    return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'});
  });
  await page.route("https://videodelivery.net/**", route => route.abort());
  page.on("pageerror", error => { throw error; });
  await page.goto(`https://fixture.invalid/?${mode}`); await page.addScriptTag({content:bundle});
  await page.evaluate(() => (window as unknown as Harness).mountCard());
  await expect.poll(() => grants.length).toBe(4);
  if (mode === "canonical") await expect.poll(() => statuses.length).toBe(4);
  await page.locator(".active-card-identity").press("Enter");
  for (const label of ["INTRO", "STEP 1", "STEP 2", "STEP 3"]) {
    const detail = page.getByRole("region", {name:`${label} detail`,exact:true}); await expect(detail).toBeAttached();
    if (label !== "STEP 3") await detail.getByRole("button",{name:"Next",exact:true}).dispatchEvent("click");
  }
  for (const label of ["STEP 3", "STEP 2", "STEP 1"]) await page.getByRole("region",{name:`${label} detail`,exact:true}).getByRole("button",{name:"Previous",exact:true}).dispatchEvent("click");
  await expect(page.getByRole("region",{name:"INTRO detail",exact:true})).toBeAttached();
  expect(grants.sort()).toEqual(["intro","step1","step2","step3"]); expect(statuses.length).toBe(mode === "canonical" ? 4 : 0);
  await page.evaluate(() => (window as unknown as Harness).unmountCard());
  await expect(page.locator(".focused-card-layer")).toHaveCount(0);
});


test("actual focused Card cancels preparation on hiding, learner/version change and unmount", async ({page}) => {
  const records: { actor: string | undefined; version: string | null; release: () => void }[] = [];
  let aborted = 0;
  page.on("requestfailed", request => { if (request.url().includes("format=grant")) aborted++; });
  await page.route("https://fixture.invalid/**", async route => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get("format") === "grant") {
      await new Promise<void>(release => records.push({actor:route.request().headers()["x-personal-viewer"],version:q.get("version"),release}));
      await route.abort().catch(() => {}); return;
    }
    if (route.request().url().includes("/api/")) return route.fulfill({status:404,body:"unused"});
    return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'});
  });
  try {
    await page.goto("https://fixture.invalid/?working"); await page.addScriptTag({content:bundle});
    await page.evaluate(() => (window as unknown as Harness).mountCard()); await expect.poll(()=>records.length).toBe(4);
    await page.evaluate(() => (window as unknown as Harness).setHidden(true)); await expect.poll(()=>aborted).toBe(4);
    await page.evaluate(() => (window as unknown as Harness).setHidden(false)); await expect.poll(()=>records.length).toBe(8);
    await page.evaluate(() => (window as unknown as Harness).mountCard("bob",2)); await expect.poll(()=>records.length).toBe(12);
    await expect.poll(()=>aborted).toBe(8); expect(records.slice(-4).every(r=>r.actor==="bob"&&r.version==="2")).toBe(true);
    await page.evaluate(() => (window as unknown as Harness).unmountCard()); await expect.poll(()=>aborted).toBe(12);
  } finally { for(const record of records) record.release(); }
});
