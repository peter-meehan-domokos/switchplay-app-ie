import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

let bundle: string, componentCss: string;
test.beforeAll(async () => {
  const compiled = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React, { useState } from 'react'; import { createRoot } from 'react-dom/client';
    import DeckScene from './src/components/decks/DeckScene';
    import FocusedCardView from './src/components/decks/FocusedCardView';
    const video = id => ({id,assetId:id,mediaType:'video',provider:'cloudflare-stream',src:'https://videodelivery.net/'+id,description:id,width:1920,height:1080});
    const query=new URLSearchParams(location.search), canonical=query.has('canonical'), count=Number(query.get('count')||4), initial=Number(query.get('active')||0);
    function App(){
      const [actor,setActor]=useState('alice'),[visible,setVisible]=useState(true); window.switchActor=()=>setActor('bob'); window.closeDeck=()=>setVisible(false);
      const cards=Array.from({length:count},(_,i)=>({id:'card'+i,cardTemplateId:'card'+i,label:'Card '+(i+1),creator:{username:'Creator',immediateSourceUsername:null},
        intro:{title:'Introduction '+(i+1),description:'Description',mediaItem:video('intro'+i)},
        steps:[1,2,3].map(n=>({stepId:'card'+i+'step'+n,title:'Step '+n,description:'Instruction',mediaItem:video('card'+i+'step'+n)})),
        ...(canonical?{surface:'canonical',version:1}:{adoptedVersion:1,dataOwnerUserId:actor,targetDate:'2026-10-15',signals:[],progressPercentage:0,reflection:'',mediaItems:[],chats:[]})}));
      const deck={id:'deck',deckTemplateId:'deck',title:'Thumbnail preparation',category:'Maths',introduction:null,cards,
        ...(canonical?{surface:'canonical',version:1,ownerUsername:'Creator',showOwnerTag:true}:{adoptedVersion:1,dataOwnerUserId:actor,activeCardId:'card'+initial,progressPercentage:0,confidenceScore:null})};
      return visible?<DeckScene key={actor} deck={deck} playbackViewerUserId={actor} initialCardTemplateId={'card'+initial} onBack={()=>{}} transition={{duration:0}}
        renderFocusedCard={props=><><div className="fixture-controls"><button onClick={props.onNext}>Next Card</button><button onClick={props.onPrevious}>Previous Card</button><button onClick={props.onClose}>Close focus</button></div>
          <FocusedCardView {...props} playbackViewerUserId={actor}/></>}/>:null;
    }
    createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
  ` }, bundle: true, write: false, outfile: "fixture.js", platform: "browser", format: "iife", jsx: "automatic", define: {
    "process.env.NODE_ENV": JSON.stringify("test"), "process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA": JSON.stringify("1"),
    "process.env.NEXT_PUBLIC_PHASE2_MOCK_MEDIA": JSON.stringify("0"), "process.env": "{}",
  } });
  bundle = compiled.outputFiles!.find(file => file.path.endsWith(".js"))!.text;
  componentCss = compiled.outputFiles!.find(file => file.path.endsWith(".css"))?.text ?? "";
});
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#ac6330"/><text x="10" y="180" fill="white" font-size="40">Introduction</text></svg>';
type Harness = { switchActor(): void; closeDeck(): void; decoded: string[]; frame(): void };
async function setup(page: Page, query: string, holdCold = false) {
  const requests: { asset: string; kind: string; actor?: string; time: number }[] = [];
  let release!: () => Promise<void>;
  await page.addInitScript(() => {
    const win = window as unknown as Harness; win.decoded = [];
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () { await decode.call(this); win.decoded.push(this.src); };
    HTMLMediaElement.prototype.canPlayType = () => "probably";
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  });
  await page.route("https://fixture.invalid/**", async route => {
    const url = new URL(route.request().url()), q = url.searchParams, kind = q.get("format"), asset = q.get("identity")!;
    if (url.pathname === "/api/media/protected") {
      requests.push({ asset, kind: kind!, actor: route.request().headers()["x-personal-viewer"], time: Date.now() });
      if (kind === "grant") return route.fulfill({ json: { viewerUserId: route.request().headers()["x-personal-viewer"], assetId: asset,
        manifestUrl: `https://videodelivery.net/${asset}/manifest/video.m3u8`, thumbnailUrl: `https://videodelivery.net/${asset}/thumbnails/thumbnail.jpg`, expiresAt: Date.now() + 3600000, reuseUntil: Date.now() + 600000 } });
      if (holdCold && asset === `intro${new URLSearchParams(query).get("active") ?? 0}`) {
        await new Promise<void>(done => { release = async () => { await route.fulfill({ contentType: "image/svg+xml", body: svg }); done(); }; }); return;
      }
      return route.fulfill({ contentType: "image/svg+xml", body: svg });
    }
    if (url.pathname.includes("/api/")) return route.fulfill({ json: { status: "ready" } });
    return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
  });
  await page.route("https://videodelivery.net/**", async route => {
    const url = new URL(route.request().url()), asset = url.pathname.split("/")[1];
    requests.push({ asset, kind: url.pathname.includes("thumbnail") ? "image" : "video", time: Date.now() });
    if (url.pathname.includes("thumbnail")) return route.fulfill({ contentType: "image/svg+xml", body: svg, headers: { "Cache-Control": "no-store" } });
    return route.abort();
  });
  await page.goto(`https://fixture.invalid/?${query}`);
  await page.addStyleTag({ content: await readFile("src/app/globals.css", "utf8") + componentCss });
  await page.addScriptTag({ content: bundle });
  return { requests, release: async () => { await expect.poll(() => !!release).toBe(true); await release(); } };
}

for (const mode of ["working", "canonical"]) for (let active = 0; active < 4; active++) {
  test(`${mode}: four Cards opened at ${active + 1} prepare the whole Deck after cold active decode`, async ({ page }) => {
    const f = await setup(page, `${mode}&active=${active}`, true);
    await expect(page.locator(".deck-card.is-active .intro-media-thumbnail")).toBeVisible();
    await page.waitForTimeout(150);
    expect(f.requests.filter(r => r.kind === "grant" || r.kind === "image")).toHaveLength(0);
    await f.release();
    await expect.poll(() => f.requests.filter(r => r.kind === "image").length).toBe(3);
    await expect.poll(() => page.evaluate(() => (window as unknown as Harness).decoded.filter(url => url.includes("videodelivery.net")).length)).toBe(3);
    expect(f.requests.filter(r => r.kind === "grant").map(r => r.asset).sort()).toEqual([0, 1, 2, 3].filter(i => i !== active).map(i => "intro" + i));
    expect(f.requests.some(r => r.kind === "video")).toBe(false);
    await page.evaluate(() => (window as unknown as Harness).closeDeck());
  });
}

for (const mode of ["working", "canonical"]) test(`${mode}: prepared image is shared by stack, focused front and poster without duplicate requests`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const f = await setup(page, mode);
  await expect.poll(() => f.requests.filter(r => r.kind === "image").length).toBe(3);
  await expect.poll(() => page.evaluate(() => (window as unknown as Harness).decoded.filter(url => url.includes("videodelivery.net")).length)).toBe(3);
  await page.locator(".deck-card.is-active").press("Enter");
  await page.getByRole("button", { name: "Next Card", exact: true }).dispatchEvent("click");
  await expect(page.locator(".active-card-front--focused")).toHaveCount(1);
  await expect(page.locator(".deck-card.is-active canvas.intro-media-thumbnail")).toBeVisible();
  await expect(page.locator(".active-card-front--focused canvas.intro-media-thumbnail")).toBeVisible();
  const intro = page.locator(".active-card-front--focused .active-card-identity");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: width > 1000 ? 900 : 844 });
    await page.waitForTimeout(300); // Let the existing responsive Card animation settle.
    await page.screenshot({ path: `/tmp/switchplay-deck-thumbnail-front-${mode}-${width}.png` });
  }
  await intro.press("Enter");
  await expect(page.locator(".switchplay-video-poster")).toBeVisible();
  await expect(page.locator(".switchplay-video-poster")).toHaveAttribute("src", /intro1\/thumbnails/);
  expect(f.requests.filter(r => r.asset === "intro1" && r.kind === "image")).toHaveLength(1);
  expect(f.requests.filter(r => r.asset === "intro1" && r.kind === "grant")).toHaveLength(1);
  const extra = f.requests.filter(r => r.kind === "grant").length;
  await page.waitForTimeout(100); expect(f.requests.filter(r => r.kind === "grant").length).toBe(extra);
  for (const width of [390, 320, 1280]) {
    await page.setViewportSize({ width, height: width > 1000 ? 900 : 844 });
    await page.screenshot({ path: `/tmp/switchplay-deck-thumbnails-${mode}-${width}.png` });
    const bounds = await page.locator(".active-card-front--focused .intro-media-thumb").boundingBox();
    expect(bounds?.width).toBeGreaterThan(20);
  }
  expect(errors).toEqual([]);
  await page.evaluate(() => (window as unknown as Harness).closeDeck());
});

test("100-Card Deck limits proactive work; rapid navigation and learner change discard old contexts", async ({ page }) => {
  const f = await setup(page, "canonical&count=100");
  await expect.poll(() => f.requests.filter(r => r.kind === "image").length).toBe(6);
  expect(f.requests.filter(r => r.kind === "grant").map(r => r.asset).sort()).toEqual([1, 2, 3, 4, 5, 6].map(i => "intro" + i));
  await page.locator(".deck-card.is-active").press("Enter");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Next Card", exact: true }).dispatchEvent("click");
  await expect(page.locator(".active-card-front--focused")).toHaveCount(1);
  await expect(page.locator(".active-card-front--focused")).toContainText("Introduction 6");
  await page.getByRole("button", { name: "Previous Card", exact: true }).dispatchEvent("click");
  await expect(page.locator(".active-card-front--focused")).toHaveCount(1);
  await expect(page.locator(".active-card-front--focused")).toContainText("Introduction 5");
  await page.evaluate(() => (window as unknown as Harness).switchActor());
  await expect(page.locator(".active-card-front--focused")).toHaveCount(0);
  await expect.poll(() => f.requests.filter(r => r.actor === "bob").length).toBe(6);
  await page.evaluate(() => (window as unknown as Harness).closeDeck());
  const count = f.requests.length;
  await page.waitForTimeout(150); expect(f.requests.length).toBe(count);
});

test("opening the active introduction suspends slow neighbouring images before playback starts", async ({ page }) => {
  const f = await setup(page, "working&count=20", true);
  const pending: (() => void)[] = [];
  await page.route("https://videodelivery.net/**", async route => {
    if (!/\/intro[12]\/thumbnails\//.test(route.request().url())) return route.fallback();
    await new Promise<void>(resolve => { pending.push(resolve); });
    await route.abort().catch(() => {});
  });
  try {
    await f.release(); await expect.poll(() => pending.length).toBe(2);
    await page.locator(".deck-card.is-active").press("Enter");
    await page.locator(".active-card-front--focused .active-card-identity").press("Enter");
    await expect(page.getByRole("region", { name: "INTRO detail", exact: true })).toBeVisible();
    await expect(page.locator(".switchplay-video-poster")).toBeVisible();
    await page.waitForTimeout(150);
    // Intro 3 cannot start behind two slow neighbours while active video loads.
    expect(f.requests.filter(r => r.kind === "grant" && /^intro[1-9]/.test(r.asset)).map(r => r.asset).sort()).toEqual(["intro1", "intro2"]);
    // The foreground grant starts despite both occupied background slots.
    // Development StrictMode may cancel and restart its initial mount request.
    expect(f.requests.some(r => r.kind === "grant" && r.asset === "intro0")).toBe(true);
  } finally {
    await page.evaluate(() => (window as unknown as Harness).closeDeck());
    for (const finish of pending) finish();
  }
});
