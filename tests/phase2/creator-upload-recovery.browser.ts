import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { writeFile } from "node:fs/promises";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

let client: MongoClient;
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const modal = (page: Page) => page.locator("dialog[data-creator-step-media]");
const db = () => client.db(process.env.MONGODB_DB!);
const root = (id: string) => db().collection("cardTemplates").findOne({ cardTemplateId: id });
const image = { name: "diagnostic.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") };
const video = { name: "diagnostic.mp4", mimeType: "video/mp4", buffer: Buffer.from("fixture video") };
const uploads = () => `${process.env.PHASE2_MEDIA_FIXTURE_ORIGIN}/upload**`;
const gate = () => { let release!: () => void; const promise = new Promise<void>(r => { release = r; }); return { promise, release }; };
async function setup(page: Page, name: string) {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto("/creator/new");
  await page.getByRole("button", { name: "Edit deck title and introduction" }).tap();
  await page.locator(".creator-modal textarea").fill(name);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).tap();
  await expect(page).toHaveURL(/\/creator\/edit\//);
  await page.getByRole("button", { name: "Add card", exact: true }).tap();
  const id = (await page.locator(".creator-column[data-card-template-id]").last().getAttribute("data-card-template-id"))!;
  const column = page.locator(`.creator-column[data-card-template-id="${id}"]`);
  await expect.poll(async () => !!await root(id)).toBe(true);
  await column.locator(".creator-card-title-button").tap();
  await page.locator(".creator-modal").getByRole("textbox").fill(name);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).tap();
  async function edit(text: string) {
    await column.locator(".creator-pair-step").first().tap(); await page.locator(".creator-modal textarea").fill(text);
    await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).tap();
  }
  await edit("Examine the graph and identify the roots.");
  await expect.poll(async () => (await root(id))?.draft.steps[0].description).toBe("Examine the graph and identify the roots.");
  const open = () => column.getByRole("button", { name: "Manage step media", exact: true }).first().tap();
  const close = () => modal(page).getByRole("button", { name: "Close", exact: true }).tap();
  return { id, column, open, close, edit, origin: page.url() };
}
async function capture(page: Page, name: string) {
  const data = await page.evaluate(() => {
    const rect = (el: Element) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { x:r.x,y:r.y,width:r.width,height:r.height,zIndex:s.zIndex,centerHit:hit?.className,centerReceivesHit:!!hit && el.contains(hit) }; };
    return { url: location.pathname, messages: [...document.querySelectorAll(".creator-feedback p, dialog[open] [role=alert], .creator-navigation-status")].map(el=>({ text:el.textContent,...rect(el) })), canvas: [...document.querySelectorAll(".creator-scroll-shell,.creator-card-header,.creator-pair")].map(el=>({ className:el.className,...rect(el) })) };
  });
  await page.screenshot({ path: `/private/tmp/creator-errors-${name}.png` });
  await writeFile(`/private/tmp/creator-errors-${name}.json`, JSON.stringify(data,null,2));
  return data;
}
async function failedImage(page: Page) {
  await page.route(uploads(), route => route.abort("failed"));
  await modal(page).getByLabel("Add image", { exact: true }).setInputFiles(image);
  await expect(modal(page).getByRole("alert")).toHaveText("Image upload failed. You can try again or continue without the image.");
  await expect(modal(page).getByRole("button", { name: "Cancel upload", exact: true })).toHaveCount(0);
}
test("failed unattached image leaves normally without any upload recovery action",async({page})=>{
  const f=await setup(page,"Failed image can leave"), before=await root(f.id);
  await f.open(); await failedImage(page); await capture(page,"fixed-failed-image");
  expect((await root(f.id))!.draft).toEqual(before!.draft);
  await expect(modal(page).locator("li[data-attachment-id]")).toHaveCount(0);
  await f.close(); await expect(page.locator(".creator-feedback")).toBeEmpty();
  await page.locator(".creator-back-link").tap();
  const leave=page.getByRole("dialog",{name:"Leave Creator confirmation"});
  await expect(leave).toContainText("Your drafts are saved");
  await leave.getByRole("button",{name:"Leave without publishing",exact:true}).tap();
  await expect(page).toHaveURL(/\/decks(?:\?.*)?$/);
  expect((await root(f.id))!.draft).toEqual(before!.draft);
});

test("failed replacement retains media; editing, video replacement and publication clear only resolved errors",async({page})=>{
  const f=await setup(page,"Replace and publish"); await f.open();
  await modal(page).getByRole("combobox",{name:"Add Interactive Visual",exact:true}).selectOption("integration-area");
  await expect.poll(async()=>(await root(f.id))?.draft.steps[0].mediaItems?.length).toBe(1);
  const original=(await root(f.id))!.draft.steps[0].mediaItems;
  await page.route(uploads(),route=>route.abort("failed"));
  await modal(page).getByLabel("Replace Explore with image",{exact:true}).setInputFiles(image);
  await expect(modal(page).getByRole("alert")).toHaveText("Image upload failed. You can try again or continue without the image.");
  expect((await root(f.id))!.draft.steps[0].mediaItems).toEqual(original);
  await f.close(); await f.edit("Keep working after a failed image upload.");
  await expect.poll(async()=>(await root(f.id))?.draft.steps[0].description).toBe("Keep working after a failed image upload.");
  await f.open(); await failedImage(page); await page.unroute(uploads());
  await modal(page).getByLabel("Replace Explore with video",{exact:true}).setInputFiles(video);
  await expect.poll(async()=>(await root(f.id))?.draft.steps[0].mediaItems?.[0]?.kind).toBe("video");
  await expect(modal(page).getByRole("alert")).toHaveCount(0); await f.close();
  await expect(page.locator(".creator-feedback")).toBeEmpty();
  await f.column.getByRole("combobox",{name:"Card 1 publication visibility",exact:true}).selectOption("public");
  await expect.poll(async()=>(await root(f.id))?.draftVisibility).toBe("public");
  await f.column.getByRole("button",{name:"Publish Card 1",exact:true}).tap();
  await page.getByRole("dialog",{name:"Confirm public publication"}).getByRole("button",{name:"Publish publicly",exact:true}).tap();
  await expect(f.column.getByRole("button",{name:"Publish Card 1",exact:true})).toHaveText("Published");
  await page.getByRole("button",{name:"Publish Deck",exact:true}).tap();
  await expect(page.getByRole("button",{name:"Publish Deck",exact:true})).toHaveText("Published");
  await expect(page.locator(".creator-feedback")).toBeEmpty(); await capture(page,"fixed-published");
});

test("failed upload and unrelated pending edits save before departure without moving the grid",async({page})=>{
  const f=await setup(page,"Save unrelated edits"),hold=gate();let started=false;
  await f.open();await failedImage(page);await f.close();
  await page.route(`**/api/card-templates/${f.id}`,async route=>{
    if(route.request().method()==="PATCH"){started=true;await hold.promise;} await route.continue();
  });
  try{
    await f.edit("These unrelated edits must be saved before leaving.");await expect.poll(()=>started).toBe(true);
    const canvas=await page.locator(".creator-scroll-shell").boundingBox(),cells=await f.column.locator(".creator-cell").all();
    const boxes=await Promise.all(cells.map(cell=>cell.boundingBox()));
    await page.locator(".creator-back-link").tap();await expect(page.locator(".creator-navigation-status")).toBeVisible();
    expect(await page.locator(".creator-scroll-shell").boundingBox()).toEqual(canvas);
    expect(await Promise.all(cells.map(cell=>cell.boundingBox()))).toEqual(boxes);
    const status=await page.locator(".creator-navigation-status").boundingBox();expect(status!.y+status!.height).toBeLessThanOrEqual(canvas!.y);
    await capture(page,"fixed-waiting-save");
    hold.release();const leave=page.getByRole("dialog",{name:"Leave Creator confirmation"});await expect(leave).toBeVisible();
    expect((await root(f.id))!.draft.steps[0].description).toBe("These unrelated edits must be saved before leaving.");
    await leave.getByRole("button",{name:"Cancel",exact:true}).tap();await expect(page.locator(".creator-feedback")).toBeEmpty();
    await page.locator(".creator-back-link").tap();await leave.getByRole("button",{name:"Leave without publishing",exact:true}).tap();
    await expect(page).toHaveURL(/\/decks(?:\?.*)?$/);
  }finally{hold.release();}
});

test("genuine saves retain independent Card errors and Retry Save clears only the recovered Card",async({page})=>{
  const f=await setup(page,"Actual save failures");
  await page.getByRole("button",{name:"Add card",exact:true}).tap();
  const other=page.locator(".creator-column[data-card-template-id]").last(),otherId=(await other.getAttribute("data-card-template-id"))!;
  await expect.poll(async()=>!!await root(otherId)).toBe(true);
  for(const id of [f.id,otherId]) await page.route(`**/api/card-templates/${id}`,async route=>{
    if(route.request().method()==="PATCH") await route.fulfill({status:400,json:{code:"INVALID_CONTENT"}});else await route.continue();
  });
  await f.edit("Retain the first Card local edits.");
  await expect(page.locator(".creator-entity-save-error").first()).toContainText("Your changes could not be saved. Select Retry Save to try again.");
  await other.locator(".creator-pair-step").first().tap();await page.locator(".creator-modal textarea").fill("Retain the second Card local edits.");
  await page.locator(".creator-modal").getByRole("button",{name:"Save",exact:true}).tap();
  await expect(page.getByRole("button",{name:"Retry Save Card 2",exact:true})).toBeVisible();
  await page.locator(".creator-back-link").tap();await expect(page.getByRole("dialog",{name:"Leave Creator confirmation"})).toHaveCount(0);
  expect(page.url()).toBe(f.origin);await expect(f.column).toContainText("Retain the first Card local edits.");
  await page.unroute(`**/api/card-templates/${f.id}`);await page.getByRole("button",{name:"Retry Save Card 1",exact:true}).tap();
  await expect.poll(async()=>(await root(f.id))?.draft.steps[0].description).toBe("Retain the first Card local edits.");
  await expect(page.getByRole("button",{name:"Retry Save Card 1",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Retry Save Card 2",exact:true})).toBeVisible();
  await page.unroute(`**/api/card-templates/${otherId}`);await page.getByRole("button",{name:"Retry Save Card 2",exact:true}).tap();
  await expect.poll(async()=>(await root(otherId))?.draft.steps[0].description).toBe("Retain the second Card local edits.");
  await expect(page.locator(".creator-feedback")).toBeEmpty();await capture(page,"fixed-retry-success");
  await page.locator(".creator-back-link").tap();await page.getByRole("button",{name:"Leave without publishing",exact:true}).tap();
  await expect(page).toHaveURL(/\/decks(?:\?.*)?$/);
});
