import { test, expect, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
let client: MongoClient;
test.beforeAll(async()=>{ assertDisposableDatabase(); client=await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async()=>{ await client?.close(); });
async function setup(page:Page, ownedDeck=false){
  const repo=new CardRepository(client.db(process.env.MONGODB_DB!),client), actor=new ObjectId(process.env.PHASE2_USER_ID!).toHexString();
  const bob=(await repo.db.collection("users").findOne({username:"other"}))!._id.toString();
  const card=await repo.createCardDraft(bob,{...createDefaultCardContent([randomUUID(),randomUUID(),randomUUID()]),intro:{title:"Foreign practice",description:null,mediaItem:null}},"public");
  await repo.publishCard(bob,card.cardTemplateId,0);
  const deck=await repo.createDeckDraft(ownedDeck?actor:bob,{...createDefaultDeckContent([]),title:"Foreign programme",cards:[{cardTemplateId:card.cardTemplateId}]},"public");
  await repo.publishDeck(deck.ownerUserId,deck.deckTemplateId,0);
  await page.request.post("/api/auth/login",{data:{identifier:"phase2",password:"local-test-only"}});
  return {repo,actor,bob,card,deck,href:`/creator/edit/${deck.deckTemplateId}?returnTo=library&returnDeckId=${deck.deckTemplateId}`};
}
async function title(page:Page,id:string,value:string){
  await page.locator(`[data-card-template-id="${id}"] .creator-card-title-button`).click();
  const modal=page.getByRole("dialog",{name:"Edit Card title",exact:true});
  await page.locator(".creator-modal textarea").fill(value);
  await page.locator(".creator-modal").getByRole("button",{name:"Save",exact:true}).click();
  void modal;
}
test("foreign entry cancellation writes nothing; combined first command hands off without duplicate Cards or personal data",async({page})=>{
  const h=await setup(page), before=await h.repo.getPersonalUser(h.actor), count=await h.repo.decks().countDocuments({ownerUserId:h.actor});
  await page.goto(h.href); await page.getByRole("dialog",{name:"Edit your own Deck"}).getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(page).toHaveURL(`/library/${h.deck.deckTemplateId}`);
  expect(await h.repo.decks().countDocuments({ownerUserId:h.actor})).toBe(count);
  await page.goto(h.href); await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  let release!:()=>void; const gate=new Promise<void>((resolve)=>release=resolve);
  await page.route("**/api/deck-templates/*/fork",async(route)=>{const response=await route.fetch();await gate;await route.fulfill({response});});
  await title(page,h.card.cardTemplateId,"First change");
  await page.getByRole("dialog",{name:"Edit your own Card"}).getByRole("button",{name:"Continue editing",exact:true}).click();
  await expect.poll(()=>h.repo.decks().countDocuments({ownerUserId:h.actor})).toBe(count+1);
  await title(page,h.card.cardTemplateId,"Later change"); release();
  await expect.poll(async()=>{const root=await h.repo.cards().findOne({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId});return root?.draft?.intro.title;}).toBe("Later change");
  await expect(page.locator(".creator-column[data-card-template-id]")).toHaveCount(1);
  await expect(page.locator(`[data-card-template-id="${h.card.cardTemplateId}"]`)).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>Object.keys(sessionStorage).filter((key)=>key.startsWith("switchplay:creator-operation:")).length)).toBe(0);
  expect((await h.repo.getPersonalUser(h.actor))!.cardsData).toEqual(before!.cardsData);
  expect((await h.repo.getPersonalUser(h.actor))!.decksData).toEqual(before!.decksData);
  expect((await h.repo.cards().findOne({cardTemplateId:h.card.cardTemplateId}))!.draft).toBe(null);
  const destination=await h.repo.createDeckDraft(h.actor,{...createDefaultDeckContent([]),title:"Copy after identity handoff"});
  const target=(await h.repo.cards().findOne({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId}))!;
  await page.locator(`[data-card-template-id="${h.card.cardTemplateId}"] .creator-card-title-button`).click();
  await page.getByRole("button",{name:"Copy to…",exact:true}).click();
  await page.getByRole("button",{name:"Copy after identity handoff",exact:true}).click();
  await expect(page.getByText("Copied to the destination draft. Publish that Deck to make it live.",{exact:true})).toBeVisible();
  expect((await h.repo.decks().findOne({deckTemplateId:destination.deckTemplateId}))!.draft!.cards).toEqual([{cardTemplateId:target.cardTemplateId}]);
  await page.locator(".creator-modal").getByRole("button",{name:"Cancel",exact:true}).click();
  await page.getByRole("link",{name:"Decks",exact:true}).click();
  await page.getByRole("dialog",{name:"Leave Creator confirmation"}).getByRole("button",{name:"Leave without publishing",exact:true}).click();
  await expect(page).toHaveURL(`/library/${h.deck.deckTemplateId}`);
});
test("cancel foreign visibility confirmation saves nothing; confirmation creates only a Card in an owned Deck",async({page})=>{
  const h=await setup(page,true), before=await h.repo.getPersonalUser(h.actor);
  await page.goto(h.href); const control=page.locator(`[data-card-template-id="${h.card.cardTemplateId}"]`).getByRole("button",{name:/Card 1 visibility/});
  // Native select is deliberately used by the existing compact visibility control.
  const select=page.locator(`[data-card-template-id="${h.card.cardTemplateId}"] select`);
  await select.selectOption("public"); await page.getByRole("dialog",{name:"Edit your own Card"}).getByRole("button",{name:"Cancel",exact:true}).click();
  expect(await h.repo.cards().countDocuments({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId})).toBe(0);
  await select.selectOption("public"); await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  await expect.poll(()=>h.repo.cards().countDocuments({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId})).toBe(1);
  expect((await h.repo.decks().findOne({deckTemplateId:h.deck.deckTemplateId}))!.forkedFrom).toBe(null);
  expect((await h.repo.getPersonalUser(h.actor))!.cardsData).toEqual(before!.cardsData); void control;
});
test("creator requests are actor-bound and private-era source versions cannot open",async({page})=>{
  const h=await setup(page);
  const response=await page.request.post(`/api/deck-templates/${h.deck.deckTemplateId}/fork`,{headers:{"X-Creator-Actor":h.bob},data:{}});
  expect(response.status()).toBe(409); expect((await response.json()).code).toBe("CREATOR_SESSION_CONFLICT");
  const privateDeck=await h.repo.createDeckDraft(h.bob,{...createDefaultDeckContent([]),title:"Private history"}); await h.repo.publishDeck(h.bob,privateDeck.deckTemplateId,0);
  await h.repo.saveDeckDraft(h.bob,privateDeck.deckTemplateId,1,{...privateDeck.draft!,title:"Public later"},"public"); await h.repo.publishDeck(h.bob,privateDeck.deckTemplateId,2);
  const read=await page.request.get(`/api/creator/session?deckTemplateId=${privateDeck.deckTemplateId}&version=1`);
  expect(read.status()).toBe(403);
});
test("media-first foreign edit uploads without creating an unchanged copy, then attaches once with lineage",async({page})=>{
  const h=await setup(page), before=await h.repo.getPersonalUser(h.actor);await page.goto(h.href);await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  let release!:()=>void;const gate=new Promise<void>((resolve)=>release=resolve);
  await page.route("**/api/media/stream/direct-upload",async(route)=>{const response=await route.fetch();await gate;await route.fulfill({response});});
  const column=page.locator(`[data-card-template-id="${h.card.cardTemplateId}"]`);
  await column.locator('.creator-card-intro-media-slot input[type="file"]').setInputFiles({name:"first-edit.mp4",mimeType:"video/mp4",buffer:Buffer.from("fixture video")});
  await page.getByRole("dialog",{name:"Edit your own Card"}).getByRole("button",{name:"Continue editing",exact:true}).click();
  await expect(column.getByText("Uploading...",{exact:true})).toBeVisible();
  expect(await h.repo.cards().countDocuments({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId})).toBe(0);
  release();await expect.poll(async()=>{const root=await h.repo.cards().findOne({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId});return root?.draft?.intro.mediaItem?.description;}).toBe("first-edit.mp4");
  const target=(await h.repo.cards().findOne({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId}))!;
  expect(target.draft!.steps[0].forkedFrom?.stepId).toBe(h.card.draft!.steps[0].stepId);
  expect((await h.repo.getPersonalUser(h.actor))!.cardsData).toEqual(before!.cardsData);
});
test("reload recovers the submitted first edit with the same target and Library origin",async({page})=>{
  const h=await setup(page);await page.goto(h.href);await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  await page.route("**/api/deck-templates/*/fork",async(route)=>{await route.fetch();await route.abort("failed");},{times:1});
  await page.getByRole("button",{name:"Edit deck title and introduction"}).click();await page.locator(".creator-modal textarea").fill("Recover submitted change");
  await page.locator(".creator-modal").getByRole("button",{name:"Save",exact:true}).click();
  await expect.poll(()=>h.repo.decks().countDocuments({ownerUserId:h.actor,"forkedFrom.deckTemplateId":h.deck.deckTemplateId})).toBe(1);
  const root=(await h.repo.decks().findOne({ownerUserId:h.actor,"forkedFrom.deckTemplateId":h.deck.deckTemplateId}))!;
  await page.reload();await expect(page).toHaveURL(new RegExp(`/creator/edit/${root.deckTemplateId}\\?returnTo=library`));
  await expect(page.getByRole("button",{name:"Edit deck title and introduction"})).toContainText("Recover submitted change");
  expect(await h.repo.decks().countDocuments({ownerUserId:h.actor,"forkedFrom.deckTemplateId":h.deck.deckTemplateId})).toBe(1);
  await expect.poll(()=>page.evaluate(()=>Object.keys(sessionStorage).filter((key)=>key.startsWith("switchplay:creator-operation:")).length)).toBe(0);
});

test("account switch before a held first command rejects the old actor without creating either user's copy",async({page})=>{
  const h=await setup(page);await page.goto(h.href);await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  let release!:()=>void,submitted!:()=>void;
  const gate=new Promise<void>((resolve)=>release=resolve),sent=new Promise<void>((resolve)=>submitted=resolve);
  await page.route("**/api/deck-templates/*/fork",async(route)=>{submitted();await gate;await route.continue();});
  await page.getByRole("button",{name:"Edit deck title and introduction"}).click();await page.locator(".creator-modal textarea").fill("Old actor's edit");
  await page.locator(".creator-modal").getByRole("button",{name:"Save",exact:true}).click();await sent;
  await page.request.post("/api/auth/login",{data:{identifier:"other",password:"local-test-only"}});
  const rejected=page.waitForResponse((response)=>response.url().endsWith("/fork")&&response.status()===409);release();await rejected;
  expect(await h.repo.decks().countDocuments({"forkedFrom.deckTemplateId":h.deck.deckTemplateId})).toBe(0);
  await page.goto(`/creator/edit/${h.deck.deckTemplateId}?returnTo=library`);
  await expect.poll(()=>page.evaluate(()=>Object.keys(sessionStorage).filter((key)=>key.startsWith("switchplay:creator-operation:")).length)).toBe(0);
  expect((await h.repo.decks().findOne({deckTemplateId:h.deck.deckTemplateId}))!.draft).toBe(null);
});

test("owned Deck reload recognizes a committed Card replacement after its response is lost",async({page})=>{
  const h=await setup(page,true);await page.goto(h.href);
  await page.route("**/api/card-templates/*/fork",async(route)=>{await route.fetch();await route.abort("failed");},{times:1});
  await title(page,h.card.cardTemplateId,"Recover replaced Card");await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  await expect.poll(()=>h.repo.cards().countDocuments({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId})).toBe(1);
  const target=(await h.repo.cards().findOne({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId}))!;
  await page.reload();
  await expect(page.locator(`[data-card-template-id="${target.cardTemplateId}"] .creator-card-title-button`)).toContainText("Recover replaced Card");
  await expect.poll(()=>page.evaluate(()=>Object.keys(sessionStorage).filter((key)=>key.startsWith("switchplay:creator-operation:")).length)).toBe(0);
  expect(await h.repo.cards().countDocuments({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId})).toBe(1);
  expect((await h.repo.cards().findOne({cardTemplateId:h.card.cardTemplateId}))!.draft).toBe(null);
});

test("foreign Deck introduction uses public-version status, and a media-first edit binds the owned Deck",async({page})=>{
  const h=await setup(page),video={id:"source-intro",description:"Source instructional introduction",mediaType:"video" as const,provider:"cloudflare-stream" as const,
    assetId:"source-intro-public",src:"https://videodelivery.net/source-intro-public/manifest/video.m3u8",width:1280,height:720};
  await h.repo.saveDeckDraft(h.bob,h.deck.deckTemplateId,1,{...h.deck.draft!,introduction:{image:null,video}});await h.repo.publishDeck(h.bob,h.deck.deckTemplateId,2);
  const reads:string[]=[];
  await page.route("**/api/library/media/stream-status?**",async(route)=>{reads.push(route.request().url());await route.fulfill({json:{status:"processing"}});});
  await page.goto(h.href);await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  await page.getByRole("button",{name:"Edit deck title and introduction"}).click();
  await expect.poll(()=>reads.length).toBeGreaterThan(0);const read=new URL(reads[0]);
  expect(read.searchParams.get("kind")).toBe("deck");expect(read.searchParams.get("templateId")).toBe(h.deck.deckTemplateId);expect(read.searchParams.get("version")).toBe("2");
  expect(await h.repo.decks().countDocuments({"forkedFrom.deckTemplateId":h.deck.deckTemplateId})).toBe(0);
  await page.locator('.creator-deck-introduction-video-shell input[type="file"]').setInputFiles({name:"adapted-intro.mp4",mimeType:"video/mp4",buffer:Buffer.from("fixture")});
  await expect.poll(async()=>{const root=await h.repo.decks().findOne({ownerUserId:h.actor,"forkedFrom.deckTemplateId":h.deck.deckTemplateId});return root?.draft?.introduction?.video?.description;}).toBe("adapted-intro.mp4");
  const root=(await h.repo.decks().findOne({ownerUserId:h.actor,"forkedFrom.deckTemplateId":h.deck.deckTemplateId}))!;
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${root.deckTemplateId}`));
  expect(root.forkedFrom!.version).toBe(2);expect(root.latestVersion).toBe(0);
  expect(root.draft!.cards).toEqual([{cardTemplateId:h.card.cardTemplateId}]);
});

async function editDeckTitle(page:Page,value:string){
  await page.getByRole("button",{name:"Edit deck title and introduction",exact:true}).click();
  await page.locator(".creator-modal textarea").fill(value);
  await page.locator(".creator-modal").getByRole("button",{name:"Save",exact:true}).click();
}
async function enterLibraryEdit(page:Page,id:string){
  await page.goto(`/library/${id}`);
  await page.getByRole("button",{name:"Deck menu",exact:true}).click();
  await page.getByRole("menuitem",{name:"Edit",exact:true}).click();
}
test("Library foreign Edit confirms without a write; private publication/reload uses owned identity and returns original detail",async({page})=>{
  const h=await setup(page), before=await h.repo.getPersonalUser(h.actor);
  await enterLibraryEdit(page,h.deck.deckTemplateId);
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${h.deck.deckTemplateId}`));
  expect(new URL(page.url()).searchParams.get("version")).toBe("1");
  expect(JSON.parse(new URL(page.url()).searchParams.get("cards")!)).toEqual([{cardTemplateId:h.card.cardTemplateId,version:1}]);
  await page.getByRole("dialog",{name:"Edit your own Deck"}).getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(page).toHaveURL(`/library/${h.deck.deckTemplateId}`);
  expect(await h.repo.getPersonalUser(h.actor)).toEqual(before);
  await enterLibraryEdit(page,h.deck.deckTemplateId); await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  await editDeckTitle(page,"My private adapted programme");
  await expect.poll(()=>h.repo.decks().countDocuments({ownerUserId:h.actor,"forkedFrom.deckTemplateId":h.deck.deckTemplateId})).toBe(1);
  const fork=(await h.repo.decks().findOne({ownerUserId:h.actor,"forkedFrom.deckTemplateId":h.deck.deckTemplateId}))!;
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${fork.deckTemplateId}`));
  await page.reload(); await expect(page.getByRole("dialog",{name:"Edit your own Deck"})).toHaveCount(0);
  await expect(page.locator(".creator-card-title-button")).toHaveText("Foreign practice");
  await page.locator(".creator-back-link").click();
  await page.getByRole("dialog",{name:"Leave Creator confirmation"}).getByRole("button",{name:"Publish and leave",exact:true}).click();
  await expect(page).toHaveURL(`/library/${h.deck.deckTemplateId}`);
  const user=(await h.repo.getPersonalUser(h.actor))!;
  const data=user.decksData.find((item)=>item.deckTemplateId===fork.deckTemplateId)!;
  expect(data).toBeTruthy(); expect(data.openedAt).toBe(null); expect(data.cadenceAnchorDate).toBe(null);
  expect(user.cardsData.filter((item)=>item.cardTemplateId===h.card.cardTemplateId)).toHaveLength(1);
  expect((await h.repo.getDeckVersion(fork.deckTemplateId,1))!.content.cards[0].cardTemplateId).toBe(h.card.cardTemplateId);
  expect(await h.repo.cards().countDocuments({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId})).toBe(0);
});

test("public Library copy first-public confirmation publishes Cards before Deck and remains outside My Decks",async({page})=>{
  const h=await setup(page), before=await h.repo.getPersonalUser(h.actor);
  await enterLibraryEdit(page,h.deck.deckTemplateId); await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  await title(page,h.card.cardTemplateId,"My public adapted practice");
  await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  await expect.poll(()=>h.repo.cards().countDocuments({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId})).toBe(1);
  const column=page.locator(`[data-card-template-id="${h.card.cardTemplateId}"]`);
  await column.getByRole("combobox",{name:"Card 1 publication visibility"}).selectOption("public");
  await page.getByRole("combobox",{name:"Deck publication visibility"}).selectOption("public");
  await page.locator(".creator-back-link").click();
  await page.getByRole("button",{name:"Publish and leave",exact:true}).click();
  const confirmation=page.getByRole("dialog",{name:"Confirm public publication"});
  await expect(confirmation).toContainText("1 Card"); await expect(confirmation).toContainText("1 Deck");
  await confirmation.getByRole("button",{name:"Cancel",exact:true}).click();
  expect((await h.repo.cards().findOne({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId}))!.latestVersion).toBe(0);
  expect((await h.repo.decks().findOne({ownerUserId:h.actor,"forkedFrom.deckTemplateId":h.deck.deckTemplateId}))!.latestVersion).toBe(0);
  await page.locator(".creator-back-link").click(); await page.getByRole("button",{name:"Publish and leave",exact:true}).click();
  await confirmation.getByRole("button",{name:"Publish publicly",exact:true}).click();
  await expect(page).toHaveURL(`/library/${h.deck.deckTemplateId}`);
  const fork=(await h.repo.decks().findOne({ownerUserId:h.actor,"forkedFrom.deckTemplateId":h.deck.deckTemplateId}))!;
  const card=(await h.repo.cards().findOne({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId}))!;
  expect(fork.latestVersion).toBe(1); expect(card.latestVersion).toBe(1);
  expect((await h.repo.getDeckVersion(fork.deckTemplateId,1))!.content.cards[0]).toEqual({cardTemplateId:card.cardTemplateId,cardVersionAtPublish:1});
  expect(await h.repo.getPersonalUser(h.actor)).toEqual(before);
});

test("newer foreign publication review cancels safely, invalidates on another publication and retries fresh review",async({page})=>{
  const h=await setup(page,true); await page.goto(h.href); await editDeckTitle(page,"Programme with selected v1");
  await expect.poll(async()=> (await h.repo.decks().findOne({deckTemplateId:h.deck.deckTemplateId}))!.revision).toBe(2);
  const publishSource=async(revision:number,title:string)=>{
    await h.repo.saveCardDraft(h.bob,h.card.cardTemplateId,revision,{...h.card.draft!,intro:{...h.card.draft!.intro,title}}); await h.repo.publishCard(h.bob,h.card.cardTemplateId,revision+1);
  };
  await publishSource(1,"New v2 practice");
  await page.getByRole("button",{name:"Publish Deck",exact:true}).click();
  const review=page.getByRole("dialog",{name:"Newer Card publications"});
  await expect(review).toContainText("Foreign practice: selected version 1, published version 2");
  await review.getByRole("button",{name:"Cancel",exact:true}).click();
  expect((await h.repo.decks().findOne({deckTemplateId:h.deck.deckTemplateId}))!.latestVersion).toBe(1);
  await page.getByRole("button",{name:"Publish Deck",exact:true}).click(); await expect(review).toBeVisible();
  await publishSource(3,"New v3 practice"); await review.getByRole("button",{name:"Publish anyway",exact:true}).click();
  await expect(page.getByText("The Cards or Deck changed during publication review. Review and confirm again. Earlier successful publications are retained.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Publish Deck",exact:true}).click();
  await expect(review).toContainText("published version 3"); await review.getByRole("button",{name:"Publish anyway",exact:true}).click();
  await expect.poll(async()=> (await h.repo.decks().findOne({deckTemplateId:h.deck.deckTemplateId}))!.latestVersion).toBe(2);
  expect((await h.repo.getDeckVersion(h.deck.deckTemplateId,2))!.content.cards[0].cardVersionAtPublish).toBe(3);
  await page.reload(); await expect(page.locator(".creator-card-title-button")).toHaveText("Foreign practice");
});

test("Copy a foreign public Card uses a reference without copying source identity or personal state",async({page})=>{
  const h=await setup(page,true), before=await h.repo.getPersonalUser(h.actor);
  const dest=await h.repo.createDeckDraft(h.actor,{...createDefaultDeckContent([]),title:"Foreign Copy destination"});
  await page.goto(h.href); await expect(page.locator(".creator-card-title-button")).toHaveText("Foreign practice");
  await h.repo.saveCardDraft(h.bob,h.card.cardTemplateId,1,{...h.card.draft!,intro:{...h.card.draft!.intro,title:"Upstream after selection"}});await h.repo.publishCard(h.bob,h.card.cardTemplateId,2);
  await page.locator(".creator-card-title-button").click();
  await page.getByRole("button",{name:"Copy to…",exact:true}).click();
  await expect(page.getByText("Reuse this shared Card in another owned Deck without changing the original.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Foreign Copy destination",exact:true}).click();
  await expect(page.getByText("Copied to the destination draft. Publish that Deck to make it live.",{exact:true})).toBeVisible();
  expect((await h.repo.decks().findOne({deckTemplateId:dest.deckTemplateId}))!.draft!.cards).toEqual([{cardTemplateId:h.card.cardTemplateId}]);
  expect(await h.repo.cards().countDocuments({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId})).toBe(0);
  expect(await h.repo.getPersonalUser(h.actor)).toEqual(before);
  expect((await h.repo.decks().findOne({deckTemplateId:dest.deckTemplateId}))!.foreignCardSelections).toEqual([{cardTemplateId:h.card.cardTemplateId,version:1}]);
  await page.goto(`/creator/edit/${dest.deckTemplateId}`);await expect(page.locator(".creator-card-title-button")).toHaveText("Foreign practice");
});

test("self-use Publish and leave opens the new personal programme and retains the original",async({page})=>{
  const h=await setup(page); await h.repo.ensureDeckData(h.actor,h.deck.deckTemplateId,1);
  await page.goto(`/creator/edit/${h.deck.deckTemplateId}?returnTo=deck&returnDeckId=${h.deck.deckTemplateId}`);
  await page.getByRole("button",{name:"Continue editing",exact:true}).click(); await editDeckTitle(page,"Continuing programme");
  await expect.poll(()=>h.repo.decks().countDocuments({ownerUserId:h.actor,"forkedFrom.deckTemplateId":h.deck.deckTemplateId})).toBe(1);
  const fork=(await h.repo.decks().findOne({ownerUserId:h.actor,"forkedFrom.deckTemplateId":h.deck.deckTemplateId}))!;
  await page.locator(".creator-back-link").click(); await page.getByRole("button",{name:"Publish and leave",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/decks\\?openDeck=${fork.deckTemplateId}`));
  await expect(page.getByRole("heading",{name:"Continuing programme",exact:true})).toHaveText("Continuing programme");
  const user=(await h.repo.getPersonalUser(h.actor))!;
  expect(user.decksData.find((item)=>item.deckTemplateId===h.deck.deckTemplateId)!.archivedAt).toBe(null);
  expect(user.decksData.find((item)=>item.deckTemplateId===fork.deckTemplateId)).toBeTruthy();
});

test("Library Card copy publication carries the actor's current state once while preserving source identity and history",async({page})=>{
  const h=await setup(page);await h.repo.ensureDeckData(h.actor,h.deck.deckTemplateId,1);
  await h.repo.users().updateOne({_id:new ObjectId(h.actor)},{$set:{
    "cardsData.$[card].items":h.card.draft!.steps.map((step,index)=>({stepId:step.stepId,completionStatus:index===0?"skipped":"todo"})),
    "cardsData.$[card].signalReadings":h.card.draft!.steps.map((step,index)=>({stepId:step.stepId,reading:index===0?2:null})),
    "cardsData.$[card].reflection":"Existing personal reflection", "cardsData.$[card].targetDate":"2030-01-01",
  }},{arrayFilters:[{"card.cardTemplateId":h.card.cardTemplateId}]});
  const source=(await h.repo.getPersonalUser(h.actor))!.cardsData.find((item)=>item.cardTemplateId===h.card.cardTemplateId)!;
  await enterLibraryEdit(page,h.deck.deckTemplateId);await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  await title(page,h.card.cardTemplateId,"My continuing practice");await page.getByRole("button",{name:"Continue editing",exact:true}).click();
  await expect.poll(()=>h.repo.cards().countDocuments({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId})).toBe(1);
  const fork=(await h.repo.cards().findOne({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId}))!;
  await page.getByRole("button",{name:"Publish Card 1",exact:true}).click();
  await expect.poll(async()=> (await h.repo.cards().findOne({cardTemplateId:fork.cardTemplateId}))!.latestVersion).toBe(1);
  const user=(await h.repo.getPersonalUser(h.actor))!,data=user.cardsData.find((item)=>item.cardTemplateId===fork.cardTemplateId)!;
  expect(data.cardTemplateVersion).toBe(1);expect(data.items[0]).toEqual({stepId:fork.stepIds[0],completionStatus:"skipped"});
  expect(data.signalReadings[0]).toEqual({stepId:fork.stepIds[0],reading:2});expect(data.reflection).toBe(source.reflection);expect(data.targetDate).toBe(source.targetDate);
  expect(data.historySourceCardTemplateId).toBe(h.card.cardTemplateId);expect([data.chats,data.tests,data.mediaItems]).toEqual([[],[],[]]);
  expect(user.cardsData.find((item)=>item.cardTemplateId===h.card.cardTemplateId)).toEqual(source);
  await page.reload();await expect(page.getByRole("dialog",{name:"Edit your own Deck"})).toHaveCount(0);
  expect(await h.repo.cards().countDocuments({ownerUserId:h.actor,"forkedFrom.cardTemplateId":h.card.cardTemplateId})).toBe(1);
  expect((await h.repo.getPersonalUser(h.actor))!.cardsData.find((item)=>item.cardTemplateId===fork.cardTemplateId)).toEqual(data);
});
