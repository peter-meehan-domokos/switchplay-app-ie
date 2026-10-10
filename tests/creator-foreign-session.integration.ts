import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { creatorSessionDTO } from "../src/lib/cards/creatorSession";
import { creatorCardDTO } from "../src/lib/cards/readModels";
import { CreatorPersistenceCoordinator, CreatorRequestError, type CreatorTransport } from "../src/components/creator/creatorPersistenceCoordinator";
import { creatorBoard, sessionBoardDTO } from "../src/components/creator/cardArchitectureAdapter";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import type { CardForkCommand, DeckForkCommand, DeckPublicationReview, ForkDeckEntry } from "../src/lib/cards/model";
import { deckDraftContent } from "../src/lib/cards/publicationRules";
import { jsonDTO } from "../src/lib/cards/http";
import { copyDestinations, deckContentHash } from "../src/lib/cards/cardReuse";
import { forkCardContent } from "../src/lib/cards/forks";
import { authorizeProspectiveUpload, signProspectiveAttachment } from "../src/lib/cards/prospectiveUpload";
let server: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
class MemoryStorage {
  values = new Map<string, string>(); get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; } setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); } key(index: number) { return [...this.values.keys()][index] ?? null; }
}
async function setup(ownDeck = false, ownCard = false) {
  const repo = new CardRepository(client.db(`switchplay_test_foreign_session_${sequence++}`), client); await createFoundationIndexes(repo.db);
  await repo.users().insertMany(["alice", "bob"].map((_id) => ({ _id, decksData: [], cardsData: [] })));
  const a = await repo.createCardDraft(ownCard ? "alice" : "bob", { ...createDefaultCardContent([randomUUID(),randomUUID(),randomUUID()]), intro: { title: "Practice", description: null, mediaItem: null } }, "public");
  const b = await repo.createCardDraft("bob", { ...createDefaultCardContent([randomUUID(),randomUUID(),randomUUID()]), intro: { title: "Unchanged", description: null, mediaItem: null } }, "public");
  await repo.publishCard(a.ownerUserId, a.cardTemplateId, 0); await repo.publishCard("bob", b.cardTemplateId, 0);
  const deck = await repo.createDeckDraft(ownDeck ? "alice" : "bob", { ...createDefaultDeckContent([]), title: "Programme", cadence: { intervalDays: 4 }, cards: [a,b].map((card) => ({ cardTemplateId: card.cardTemplateId })) }, "public");
  await repo.publishDeck(deck.ownerUserId, deck.deckTemplateId, 0);
  const session = await creatorSessionDTO(repo, "alice", deck.deckTemplateId);
  const calls: { url: string; method: string; body: unknown }[] = [];
  let intercept: ((url: string, body: unknown, run: () => Promise<unknown>) => Promise<unknown>) | null = null;
  const request: CreatorTransport = async <T>(url: string, method = "GET", body?: unknown): Promise<T> => {
    calls.push({ url, method, body: structuredClone(body) });
    const run = async () => {
      const query = new URL(url, "http://localhost"), id = query.pathname.split("/").at(-1)!;
      if (url.includes("/creator/session")) {
        if (method === "PATCH") {
          const cmd = body as { deckTemplateId: string; revision: number; content: typeof deck.draft; visibility: "private" | "public"; foreignCardSelections: [] };
          await repo.saveDeckDraft("alice", cmd.deckTemplateId, cmd.revision, cmd.content!, cmd.visibility, cmd.foreignCardSelections);
          return creatorSessionDTO(repo, "alice", cmd.deckTemplateId);
        }
        return creatorSessionDTO(repo, "alice", query.searchParams.get("deckTemplateId")!);
      }
      if (id === "fork") {
        const cmd = body as Record<string, unknown>, sourceId = query.pathname.split("/").at(-2)!;
        try {
          return url.includes("deck-templates") ? await repo.createDeckFork("alice", { ...cmd, source: { deckTemplateId: sourceId, version: cmd.sourceVersion } } as DeckForkCommand)
            : await repo.createCardFork("alice", { ...cmd, source: { cardTemplateId: sourceId, version: cmd.sourceVersion } } as CardForkCommand);
        } catch (error) { throw new CreatorRequestError(409, (error as Error & {code:string}).code); }
      }
      if (id === "publish") {
        const deckId = query.pathname.split("/").at(-2)!;
        if (method === "GET") {
          if (query.searchParams.has("version")) {
            const version = (await repo.getDeckVersion(deckId, Number(query.searchParams.get("version"))))!;
            return jsonDTO({ ...version, content: deckDraftContent(version.content) });
          }
          return repo.prepareDeckPublication("alice", deckId, Number(query.searchParams.get("revision")));
        }
        const cmd = body as { revision: number; updateNote?: string; review: DeckPublicationReview; acceptCardDrafts: boolean; acceptNewerForeignCards?: boolean; forkEntry?: ForkDeckEntry };
        try { await repo.publishDeck("alice", deckId, cmd.revision, cmd.updateNote, cmd, cmd.forkEntry); }
        catch (error) { throw new CreatorRequestError(409, (error as Error & {code:string}).code); }
        const result = await creatorSessionDTO(repo, "alice", deckId);
        assert.equal(result.deck.kind, "owned"); return result.deck.kind === "owned" ? result.deck.owned : null;
      }
      if (query.searchParams.has("version")) return jsonDTO(await repo.getCardVersion(id, Number(query.searchParams.get("version"))));
      if (method === "PATCH") {
        const cmd = body as { type: string; content: typeof a.draft; revision: number; visibility: "private" | "public"; updateNote?: string };
        if (cmd.type === "publish") await repo.publishCard("alice", id, cmd.revision, cmd.updateNote);
        else await repo.saveCardDraft("alice", id, cmd.revision, cmd.content!, cmd.visibility);
      }
      return creatorCardDTO(repo, "alice", id);
    };
    return await (intercept ? intercept(url, body, run) : run()) as T;
  };
  const storage = new MemoryStorage();
  const make = () => { const c = new CreatorPersistenceCoordinator(creatorBoard(sessionBoardDTO(session)), null, request, session); c.configureRecovery(storage, `?returnTo=library&returnDeckId=${deck.deckTemplateId}`); return c; };
  return { repo, a, b, deck, session, calls, storage, make, intercept(fn: typeof intercept) { intercept = fn; } };
}
const title = (c: CreatorPersistenceCoordinator, id: string, value: string) => c.editCard(id, { ...c.cards.get(id)!.desired, intro: { ...c.cards.get(id)!.desired.intro, title: value } });

test("foreign session allow-list excludes private drafts, revisions, receipts and personal state", async () => {
  const h = await setup(); await h.repo.saveCardDraft("bob", h.a.cardTemplateId, 1, { ...h.a.draft!, intro: { ...h.a.draft!.intro, title: "Secret draft" } });
  const session = await creatorSessionDTO(h.repo, "alice", h.deck.deckTemplateId);
  assert.deepEqual(Object.keys(session.deck).sort(), ["content","kind","ownerUserId","source"]);
  assert.deepEqual(Object.keys(session.cards[0]).sort(), ["content","kind","ownerUserId","source"]);
  assert.equal(session.cards[0].kind === "foreign" && session.cards[0].content.intro.title, "Practice");
  assert.equal(JSON.stringify(session).includes("Secret draft"), false);
  const c = h.make(); await c.prepareToNavigate(); assert.equal(h.calls.length, 0);
});

test("frozen combined first command retains visual/lane identities and later edits; no personal data", async () => {
  const h = await setup(), c = h.make(), lane = c.cards.get(h.a.cardTemplateId)!;
  let release!: () => void; const gate = new Promise<void>((resolve) => release = resolve);
  h.intercept(async (url, _body, run) => { if (url.endsWith("/fork")) await gate; return run(); });
  title(c, h.a.cardTemplateId, "First"); title(c, h.a.cardTemplateId, "Second");
  c.editDeck({ ...c.deck.desired, title: "Later programme change" });
  assert.equal(c.binding(h.a.cardTemplateId), "creating"); release(); await c.flushAll();
  assert.equal(c.cards.get(h.a.cardTemplateId), lane); assert.equal(lane.desired.intro.title, "Second");
  assert.equal(c.presentation.cards[0].root.cardTemplateId, h.a.cardTemplateId);
  assert.equal(c.deck.desired.cadence.intervalDays, 4);
  const forkCall = h.calls.find((call) => call.url.endsWith("/fork"))!;
  assert.equal((forkCall.body as {cardFork: CardForkCommand}).cardFork.content.intro.title, "First");
  const targetId = c.cardIdentity(h.a.cardTemplateId), root = (await h.repo.cards().findOne({ cardTemplateId: targetId }))!;
  assert.notEqual(targetId, h.a.cardTemplateId); assert.equal(root.draft!.intro.title, "Second");
  assert.deepEqual(root.draft!.steps.map((step) => step.forkedFrom), h.a.draft!.steps.map((step) => ({ cardTemplateId: h.a.cardTemplateId, version: 1, stepId: step.stepId })));
  assert.deepEqual((await h.repo.decks().findOne({ deckTemplateId: c.deckTemplateId }))!.draft!.cards, [{ cardTemplateId: targetId }, { cardTemplateId: h.b.cardTemplateId }]);
  assert.equal((await h.repo.decks().findOne({ deckTemplateId: c.deckTemplateId }))!.draft!.title, "Later programme change");
  assert.deepEqual((await h.repo.getPersonalUser("alice"))!.decksData, []); assert.deepEqual((await h.repo.getPersonalUser("alice"))!.cardsData, []);
  assert.equal(h.storage.length, 0);
});

test("two foreign Card first edits serialize destination writes and create exactly one Deck", async () => {
  const h = await setup(), c = h.make(); title(c,h.a.cardTemplateId,"A edited"); title(c,h.b.cardTemplateId,"B edited"); await c.flushAll();
  assert.equal(await h.repo.decks().countDocuments({ ownerUserId: "alice" }), 1);
  assert.equal(await h.repo.cards().countDocuments({ ownerUserId: "alice" }), 2);
  assert.equal(new Set(c.deck.desired.cards.map((ref) => c.cardIdentity(ref.cardTemplateId))).size, 2);
});

test("a first-edit Step reorder allocates lineage by stable source identity rather than edited position",async()=>{
  const h=await setup(),c=h.make(),before=c.cards.get(h.a.cardTemplateId)!.desired;
  const steps=[before.steps[1],before.steps[0],before.steps[2]];
  c.editCard(h.a.cardTemplateId,{...before,steps});await c.flushAll();
  const root=(await h.repo.cards().findOne({cardTemplateId:c.cardIdentity(h.a.cardTemplateId)}))!;
  assert.deepEqual(root.draft!.steps.map((step)=>step.forkedFrom!.stepId),steps.map((step)=>step.stepId));
  assert.equal(root.draft!.steps.some((step)=>before.steps.some((old)=>old.stepId===step.stepId)),false);
  assert.deepEqual(c.cards.get(h.a.cardTemplateId)!.desired.steps.map((step)=>step.stepId),steps.map((step)=>step.stepId));
});

test("removal during handoff keeps the owned Card and binds detached saves to its canonical identity",async()=>{
  const h=await setup(),allowed:string[]=[],c=h.make();c.request.allowDetachedCard=(id)=>allowed.push(id);
  let release!:()=>void;const gate=new Promise<void>((resolve)=>release=resolve);
  h.intercept(async(url,_body,run)=>{if(url.endsWith("/fork"))await gate;return run();});
  title(c,h.a.cardTemplateId,"First edit");c.detachCard(h.a.cardTemplateId,{...c.deck.desired,cards:[{cardTemplateId:h.b.cardTemplateId}]});
  release();await c.flushAll();const target=c.cardIdentity(h.a.cardTemplateId);
  assert.notEqual(target,h.a.cardTemplateId);assert.ok(allowed.includes(target));
  title(c,h.a.cardTemplateId,"Retained detached work");await c.flushCard(h.a.cardTemplateId);
  assert.equal((await h.repo.cards().findOne({cardTemplateId:target}))!.draft!.intro.title,"Retained detached work");
  assert.deepEqual((await h.repo.decks().findOne({deckTemplateId:c.deckTemplateId}))!.draft!.cards,[{cardTemplateId:h.b.cardTemplateId}]);
  assert.deepEqual((await h.repo.getPersonalUser("alice"))!.cardsData,[]);
});

test("owner Card edit inside foreign Deck retains identity and creates no Deck", async () => {
  const h = await setup(false,true), c = h.make(); title(c,h.a.cardTemplateId,"Owned improvement"); await c.prepareToNavigate();
  assert.equal(c.cardIdentity(h.a.cardTemplateId),h.a.cardTemplateId); assert.equal(await h.repo.decks().countDocuments({ ownerUserId: "alice" }),0);
});

test("visibility-only first edit includes intent atomically; reversal retains target identity", async () => {
  const h = await setup(true), c = h.make(); c.setCardVisibility(h.a.cardTemplateId,"public"); await c.flushAll();
  const id = c.cardIdentity(h.a.cardTemplateId); assert.notEqual(id,h.a.cardTemplateId);
  assert.equal((await h.repo.cards().findOne({cardTemplateId:id}))!.draftVisibility,"public");
  c.setCardVisibility(h.a.cardTemplateId,"private"); await c.flushAll(); assert.equal(c.cardIdentity(h.a.cardTemplateId),id);
  assert.equal((await h.repo.cards().findOne({cardTemplateId:h.a.cardTemplateId}))!.visibility,"public");
});

test("uncertain submitted operation recovers across reload with original IDs; advanced targets conflict safely", async () => {
  const h = await setup(); const c = h.make();
  h.intercept(async (url, _body, run) => { const result = await run(); if (url.endsWith("/fork")) throw new CreatorRequestError(409,"SIMULATED_UNKNOWN_OUTCOME"); return result; });
  c.editDeck({...c.deck.desired,title:"Submitted"}); await assert.rejects(c.flushAll());
  assert.equal(h.storage.length,1); const target = (await h.repo.decks().findOne({ownerUserId:"alice"}))!;
  h.intercept(null); const recovered = h.make(); recovered.recoverSubmitted(); await recovered.flushAll();
  assert.equal(recovered.deckTemplateId,target.deckTemplateId); assert.equal(h.storage.length,0);
  assert.equal(await h.repo.decks().countDocuments({ownerUserId:"alice"}),1);
});

test("foreign version selections survive source publication and owned draft reload", async () => {
  const h = await setup(), c = h.make(); c.editDeck({...c.deck.desired,title:"My draft"}); await c.flushAll();
  await h.repo.saveCardDraft("bob",h.a.cardTemplateId,1,{...h.a.draft!,intro:{...h.a.draft!.intro,title:"New public"}}); await h.repo.publishCard("bob",h.a.cardTemplateId,2);
  const reopened = await creatorSessionDTO(h.repo,"alice",c.deckTemplateId);
  assert.equal(reopened.cards[0].kind === "foreign" && reopened.cards[0].source.version,1);
  assert.equal(reopened.cards[0].kind === "foreign" && reopened.cards[0].content.intro.title,"Practice");
});

test("prospective upload proof is bound to actor/source/target/slot/asset and private versions fail closed", async () => {
  const h = await setup(); process.env.SESSION_SECRET = "isolated-creator-attachment-test-secret";
  const targetId = randomUUID(), prospective = {kind:"card" as const, source:{cardTemplateId:h.a.cardTemplateId,version:1},targetId,slot:"intro",context:{kind:"library" as const}};
  await authorizeProspectiveUpload(h.repo,"alice",prospective);
  const item = {id:"uploaded",mediaType:"video" as const,provider:"cloudflare-stream" as const,assetId:"allocated-asset",src:"https://iframe.videodelivery.net/allocated-asset",description:"New upload"};
  const proof = await signProspectiveAttachment("alice",prospective,item.assetId,item.provider);
  const steps = [randomUUID(),randomUUID(),randomUUID()], content = forkCardContent(h.a.draft!,prospective.source,steps);
  const cmd:CardForkCommand={source:prospective.source,cardTemplateId:targetId,stepIds:steps,context:prospective.context,content:{...content,intro:{...content.intro,mediaItem:item}},mediaProofs:[proof]};
  await assert.rejects(h.repo.createCardFork("alice",{...cmd,cardTemplateId:randomUUID()}),{code:"INVALID_UPLOAD_ATTACHMENT"});
  await assert.rejects(h.repo.createCardFork("alice",{...cmd,mediaProofs:[]}),{code:"INVALID_UPLOAD_ATTACHMENT"});
  await h.repo.createCardFork("alice",cmd); assert.equal((await h.repo.cards().findOne({cardTemplateId:targetId}))!.latestVersion,0);
  assert.deepEqual((await h.repo.getPersonalUser("alice"))!.cardsData,[]);
});


test("a lost response retries the exact immutable first command, never a new identity",async()=>{
  const h=await setup(), c=h.make(); let lost=true;
  h.intercept(async(url,_body,run)=>{const result=await run();if(url.endsWith("/fork")&&lost){lost=false;throw new Error("Lost response");}return result;});
  c.editDeck({...c.deck.desired,title:"Exact first edit"});await c.flushAll();
  const commands=h.calls.filter((call)=>call.url.endsWith("/fork"));assert.equal(commands.length,2);assert.deepEqual(commands[0].body,commands[1].body);
  assert.equal(await h.repo.decks().countDocuments({ownerUserId:"alice"}),1);assert.equal(h.storage.length,0);
});

test("advanced committed target returns conflict and never creates a replacement identity",async()=>{
  const h=await setup(),c=h.make();
  h.intercept(async(url,_body,run)=>{const result=await run();if(url.endsWith("/fork")){const root=(await h.repo.decks().findOne({ownerUserId:"alice"}))!;
    await h.repo.saveDeckDraft("alice",root.deckTemplateId,0,{...root.draft!,title:"Another tab"});throw new CreatorRequestError(409,"UNKNOWN");}return result;});
  c.editDeck({...c.deck.desired,title:"First"});await assert.rejects(c.flushAll());h.intercept(null);
  const recovered=h.make();recovered.recoverSubmitted();await assert.rejects(recovered.flushAll(),{code:"DECK_FORK_RECOVERY_CONFLICT"});
  assert.equal(await h.repo.decks().countDocuments({ownerUserId:"alice"}),1);assert.equal((await h.repo.decks().findOne({ownerUserId:"alice"}))!.draft!.title,"Another tab");
});

test("failed combined destination write rolls back Card, Deck and Step reservations",async()=>{
  const h=await setup(),c=h.make();await h.repo.db.command({collMod:"deckTemplates",validator:{ownerUserId:{$ne:"alice"}},validationLevel:"strict"});
  title(c,h.a.cardTemplateId,"First");await assert.rejects(c.flushAll());
  assert.equal(await h.repo.cards().countDocuments({ownerUserId:"alice"}),0);assert.equal(await h.repo.decks().countDocuments({ownerUserId:"alice"}),0);
  assert.equal(h.storage.length,1);
});

test("first Add Card forks Deck atomically and preserves all unchanged foreign references",async()=>{
  const h=await setup(),c=h.make(),id=randomUUID(),steps=[randomUUID(),randomUUID(),randomUUID()];
  c.addCard(id,steps,{...c.deck.desired,cards:[...c.deck.desired.cards,{cardTemplateId:id}]});await c.flushAll();
  const root=(await h.repo.decks().findOne({deckTemplateId:c.deckTemplateId}))!;
  assert.deepEqual(root.draft!.cards,[{cardTemplateId:h.a.cardTemplateId},{cardTemplateId:h.b.cardTemplateId},{cardTemplateId:id}]);
  assert.equal((await h.repo.cards().findOne({cardTemplateId:id}))!.ownerUserId,"alice");assert.deepEqual((await h.repo.getPersonalUser("alice"))!.decksData,[]);
});

test("frozen authoring sources from My Decks use exact adopted versions, without changing personal records",async()=>{
  const h=await setup();await h.repo.ensureDeckData("alice",h.deck.deckTemplateId,1);const before=await h.repo.getPersonalUser("alice");
  await h.repo.saveCardDraft("bob",h.a.cardTemplateId,1,{...h.a.draft!,intro:{...h.a.draft!.intro,title:"Newer"}});await h.repo.publishCard("bob",h.a.cardTemplateId,2);
  const session=await creatorSessionDTO(h.repo,"alice",h.deck.deckTemplateId,{kind:"my-decks",deckTemplateId:h.deck.deckTemplateId});
  assert.equal(session.cards[0].kind==="foreign"&&session.cards[0].source.version,1);
  assert.deepEqual(await h.repo.getPersonalUser("alice"),before);
});

test("owned Deck working entry preserves adopted foreign Card versions; saved authoring selections win on reopening",async()=>{
  const h=await setup(true);await h.repo.ensureDeckData("alice",h.deck.deckTemplateId,1);
  await h.repo.saveCardDraft("bob",h.a.cardTemplateId,1,{...h.a.draft!,intro:{...h.a.draft!.intro,title:"Newer public version"}});await h.repo.publishCard("bob",h.a.cardTemplateId,2);
  const context={kind:"my-decks" as const,deckTemplateId:h.deck.deckTemplateId};
  const session=await creatorSessionDTO(h.repo,"alice",h.deck.deckTemplateId,context);
  assert.equal(session.cards[0].kind==="foreign"&&session.cards[0].source.version,1);
  await h.repo.saveDeckDraft("alice",h.deck.deckTemplateId,1,{...h.deck.draft!,title:"Saved selected draft"},"public",[{cardTemplateId:h.a.cardTemplateId,version:2}]);
  const reopened=await creatorSessionDTO(h.repo,"alice",h.deck.deckTemplateId,context);
  assert.equal(reopened.cards[0].kind==="foreign"&&reopened.cards[0].source.version,2);
  const c=new CreatorPersistenceCoordinator(creatorBoard(sessionBoardDTO(reopened)),null,h.make().request,reopened);
  c.configureRecovery(h.storage,`?returnTo=deck&returnDeckId=${h.deck.deckTemplateId}`);
  title(c,h.a.cardTemplateId,"Edit the selected v2");await c.flushAll();
  assert.equal((await h.repo.cards().findOne({cardTemplateId:c.cardIdentity(h.a.cardTemplateId)}))!.forkedFrom!.version,2);
  assert.equal((await h.repo.getPersonalUser("alice"))!.cardsData.find((card)=>card.cardTemplateId===h.a.cardTemplateId)!.cardTemplateVersion,1);
});

test("owned-route reload recognizes a committed Card replacement without replaying or losing its recovery journal",async()=>{
  const h=await setup(true),c=h.make();
  h.intercept(async(url,_body,run)=>{const result=await run();if(url.endsWith("/fork"))throw new CreatorRequestError(409,"UNKNOWN_OUTCOME");return result;});
  title(c,h.a.cardTemplateId,"Submitted replacement");await assert.rejects(c.flushAll());h.intercept(null);
  const session=await creatorSessionDTO(h.repo,"alice",h.deck.deckTemplateId);
  const recovered=new CreatorPersistenceCoordinator(creatorBoard(sessionBoardDTO(session)),null,c.request,session);
  recovered.configureRecovery(h.storage,`?returnTo=library&returnDeckId=${h.deck.deckTemplateId}`);
  const before=h.calls.filter((call)=>call.url.endsWith("/fork")).length;
  assert.equal(recovered.recoverSubmitted(),false);assert.equal(h.storage.length,0);
  assert.equal(h.calls.filter((call)=>call.url.endsWith("/fork")).length,before);
  assert.equal(await h.repo.cards().countDocuments({ownerUserId:"alice"}),1);
});

test("owned Deck URL installation interrupted before journal clearing recognizes the exact original command",async()=>{
  const h=await setup(),c=h.make();
  h.intercept(async(url,_body,run)=>{const result=await run();if(url.endsWith("/fork"))throw new CreatorRequestError(409,"UNKNOWN_OUTCOME");return result;});
  c.editDeck({...c.deck.desired,title:"Committed first command"});await assert.rejects(c.flushAll());h.intercept(null);
  const root=(await h.repo.decks().findOne({ownerUserId:"alice"}))!;
  const session=await creatorSessionDTO(h.repo,"alice",root.deckTemplateId);
  const recovered=new CreatorPersistenceCoordinator(creatorBoard(sessionBoardDTO(session)),null,c.request,session);
  recovered.configureRecovery(h.storage,`?returnTo=library&returnDeckId=${h.deck.deckTemplateId}`);
  assert.equal(recovered.recoverSubmitted(),false);assert.equal(h.storage.length,0);
  assert.equal(recovered.deckTemplateId,root.deckTemplateId);
});

// Checkpoint 4: publication/reopening uses the same mixed session contracts as the API.
test("private Library Deck copy publishes once into My Decks and retains unchanged Card identities", async () => {
  const h = await setup(), c = h.make();
  c.editDeck({ ...c.deck.desired, title: "My programme" }); await c.flushAll();
  const id = c.deckTemplateId;
  assert.equal((await h.repo.getPersonalUser("alice"))!.decksData.length, 0);
  assert.equal(await c.publishAndLeave({}, async () => true), true);
  const data = (await h.repo.getPersonalUser("alice"))!;
  assert.equal(data.decksData[0].deckTemplateId, id);
  assert.equal(data.decksData[0].openedAt, null); assert.equal(data.decksData[0].cadenceAnchorDate, null);
  assert.deepEqual(data.cardsData.map((card) => card.cardTemplateId).sort(), [h.a.cardTemplateId, h.b.cardTemplateId].sort());
  assert.deepEqual((await h.repo.getDeckVersion(id, 1))!.content.cards.map((ref) => ref.cardTemplateId), [h.a.cardTemplateId, h.b.cardTemplateId]);
  const reopened = await creatorSessionDTO(h.repo, "alice", id);
  assert.equal(reopened.deck.kind, "owned"); assert.ok(reopened.cards.every((card) => card.kind === "foreign"));
  const next = new CreatorPersistenceCoordinator(creatorBoard(sessionBoardDTO(reopened)), null, h.make().request, reopened);
  assert.equal(next.hasWork(), false); assert.equal(await next.publishAndLeave({}, async () => true), true);
  assert.equal(await h.repo.deckVersions().countDocuments({ deckTemplateId: id }), 1);
  assert.equal((await h.repo.decks().findOne({ deckTemplateId: h.deck.deckTemplateId }))!.latestVersion, 1);
});

test("public Library Deck copy remains canonical-only; foreign drafts are not exposed or published", async () => {
  const h = await setup(), c = h.make();
  await h.repo.saveCardDraft("bob", h.a.cardTemplateId, 1, { ...h.a.draft!, intro: { ...h.a.draft!.intro, title: "Private working draft" } });
  c.setDeckVisibility("public"); await c.flushAll();
  const review = await h.repo.prepareDeckPublication("alice", c.deckTemplateId, 0);
  assert.equal(review.cards[0].hasDraft, false); assert.equal(Object.hasOwn(review.cards[0], "revision"), false);
  assert.equal(await c.publishAndLeave({}, async () => { throw new Error("Foreign drafts must not prompt"); }, async () => true), true);
  assert.equal((await h.repo.getPersonalUser("alice"))!.decksData.length, 0);
  assert.equal((await h.repo.getPersonalUser("alice"))!.cardsData.length, 0);
  assert.equal((await h.repo.cards().findOne({ cardTemplateId: h.a.cardTemplateId }))!.latestVersion, 1);
  assert.equal((await h.repo.cards().findOne({ cardTemplateId: h.a.cardTemplateId }))!.draft!.intro.title, "Private working draft");
});

test("combined publication normalizes canonical identities and recovers lost Card and Deck responses without v2", async () => {
  const h = await setup(), c = h.make();
  title(c, h.a.cardTemplateId, "My practice"); await c.flushAll();
  let cardLost = false, deckLost = false;
  h.intercept(async (url, body, run) => {
    const result = await run();
    if (url.includes("card-templates") && (body as {type?:string})?.type === "publish" && !cardLost) { cardLost = true; throw new Error("Lost Card response"); }
    if (url.includes("/publish?session=1") && !deckLost) { deckLost = true; throw new Error("Lost Deck response"); }
    return result;
  });
  assert.equal(await c.publishAndLeave({}, async () => true), true);
  assert.ok(cardLost && deckLost);
  assert.equal(c.cards.get(h.a.cardTemplateId)!.ack!.root.latestVersion, 1);
  assert.equal(c.deck.ack!.root.latestVersion, 1);
  assert.equal(c.deck.ack!.content.cards[0].cardTemplateId, h.a.cardTemplateId); // Stable visual identity.
  const actualCard = c.cardIdentity(h.a.cardTemplateId);
  assert.notEqual(actualCard, h.a.cardTemplateId);
  assert.equal((await h.repo.getDeckVersion(c.deckTemplateId, 1))!.content.cards[0].cardTemplateId, actualCard);
  assert.equal(await c.publishAndLeave({}, async () => true), true);
  assert.equal(await h.repo.cardVersions().countDocuments({cardTemplateId: actualCard}), 1);
  assert.equal(await h.repo.deckVersions().countDocuments({deckTemplateId: c.deckTemplateId}), 1);
});

test("newer foreign Card publication requires review confirmation and never changes frozen authoring selections", async () => {
  const h = await setup(), c = h.make();
  c.editDeck({ ...c.deck.desired, title: "Selected v1 programme" }); await c.flushAll();
  await h.repo.saveCardDraft("bob", h.a.cardTemplateId, 1, { ...h.a.draft!, intro: { ...h.a.draft!.intro, title: "Latest v2" } });
  await h.repo.publishCard("bob", h.a.cardTemplateId, 2);
  const review = await h.repo.prepareDeckPublication("alice", c.deckTemplateId, 0);
  await assert.rejects(h.repo.publishDeck("alice", c.deckTemplateId, 0, undefined, { review, acceptCardDrafts: false }, {enterMyDecks:true}), {code:"NEWER_FOREIGN_CARD_CONFIRMATION_REQUIRED"});
  assert.equal(await c.publishDeck(undefined, async (_ids, newer) => { assert.equal(newer![0].selectedVersion, 1); assert.equal(newer![0].latestVersion, 2); return false; }), false);
  assert.equal(await c.publishDeck(undefined, async () => true), true);
  assert.equal((await h.repo.getDeckVersion(c.deckTemplateId, 1))!.content.cards[0].cardVersionAtPublish, 2);
  const reopened = await creatorSessionDTO(h.repo, "alice", c.deckTemplateId);
  assert.equal(reopened.cards[0].kind === "foreign" && reopened.cards[0].source.version, 1);
  assert.equal(reopened.cards[0].kind === "foreign" && reopened.cards[0].content.intro.title, "Practice");
});

test("another foreign publication during review invalidates consent and writes no partial Deck publication", async () => {
  const h = await setup(), c = h.make(); c.editDeck({ ...c.deck.desired, title:"Review race" }); await c.flushAll();
  await h.repo.saveCardDraft("bob", h.a.cardTemplateId, 1, { ...h.a.draft!, intro:{ ...h.a.draft!.intro, title:"v2" } }); await h.repo.publishCard("bob", h.a.cardTemplateId, 2);
  await assert.rejects(c.publishDeck(undefined, async () => {
    await h.repo.saveCardDraft("bob", h.a.cardTemplateId, 3, { ...h.a.draft!, intro:{ ...h.a.draft!.intro, title:"v3" } }); await h.repo.publishCard("bob", h.a.cardTemplateId, 4); return true;
  }), {code:"DECK_PUBLICATION_REVIEW_CONFLICT"});
  assert.equal(await h.repo.deckVersions().countDocuments({deckTemplateId:c.deckTemplateId}), 0);
  assert.equal((await h.repo.getPersonalUser("alice"))!.decksData.length, 0);
  assert.equal(await c.publishDeck(undefined, async () => true), true);
});

test("self-use Deck copy keeps source membership, carries continuity and returns the new personal Deck", async () => {
  const h = await setup(); await h.repo.ensureDeckData("alice", h.deck.deckTemplateId, 1);
  await h.repo.users().updateOne({_id:"alice"}, {$set:{"decksData.0.cadenceAnchorDate":"2030-01-01", "decksData.0.activeCardId":h.a.cardTemplateId}});
  const before = (await h.repo.getPersonalUser("alice"))!.decksData[0];
  const session = await creatorSessionDTO(h.repo,"alice",h.deck.deckTemplateId,{kind:"my-decks",deckTemplateId:h.deck.deckTemplateId});
  const c = new CreatorPersistenceCoordinator(creatorBoard(sessionBoardDTO(session)),null,h.make().request,session);
  c.configureRecovery(new MemoryStorage(),`?returnTo=deck&returnDeckId=${h.deck.deckTemplateId}`);
  title(c,h.a.cardTemplateId,"Continuing practice"); await c.flushAll();
  assert.equal(await c.publishAndLeave({},async()=>true),true);
  const user = (await h.repo.getPersonalUser("alice"))!;
  assert.deepEqual(user.decksData.find((data)=>data.deckTemplateId===h.deck.deckTemplateId),before);
  const added = user.decksData.find((data)=>data.deckTemplateId===c.deckTemplateId)!;
  assert.equal(added.activeCardId,c.cardIdentity(h.a.cardTemplateId)); assert.equal(added.cadenceAnchorDate,"2030-01-01"); assert.equal(added.openedAt,null); assert.equal(added.archivedAt,null);
  assert.equal(c.publishedPersonalDeckHref(),`/decks?openDeck=${c.deckTemplateId}`);
});

test("eligible foreign Copy reuses identity, protects privacy and retains exact retry/auto-publication behaviour",async()=>{
  const h=await setup(); const dest=await h.repo.createDeckDraft("alice",{...createDefaultDeckContent([]),title:"Reusable destination"},"public"); await h.repo.publishDeck("alice",dest.deckTemplateId,0);
  const selected=(await copyDestinations(h.repo,"alice",h.a.cardTemplateId,h.deck.deckTemplateId)).find((deck)=>deck.deckTemplateId===dest.deckTemplateId)!;
  const cmd={deckTemplateId:dest.deckTemplateId,revision:selected.revision,contentHash:selected.contentHash,sourceVersion:1};
  const before=await h.repo.getPersonalUser("alice");
  const result=await h.repo.copyOwnedCard("alice",h.a.cardTemplateId,cmd); assert.equal(result.outcome,"published");
  assert.deepEqual(await h.repo.copyOwnedCard("alice",h.a.cardTemplateId,cmd),result);
  assert.equal((await h.repo.getDeckVersion(dest.deckTemplateId,2))!.content.cards[0].cardTemplateId,h.a.cardTemplateId);
  assert.deepEqual(await h.repo.getPersonalUser("alice"),before);
  assert.equal((await h.repo.cards().findOne({cardTemplateId:h.a.cardTemplateId}))!.ownerUserId,"bob");
  await h.repo.saveCardDraft("bob",h.a.cardTemplateId,1,{...h.a.draft!,intro:{...h.a.draft!.intro,title:"Published after Copy"}});await h.repo.publishCard("bob",h.a.cardTemplateId,2);
  const reopened=await creatorSessionDTO(h.repo,"alice",dest.deckTemplateId);
  assert.equal(reopened.cards[0].kind==="foreign"&&reopened.cards[0].source.version,1);
  assert.deepEqual(await h.repo.copyOwnedCard("alice",h.a.cardTemplateId,cmd),result); // Retry cannot refresh the selection.
  await h.repo.saveDeckDraft("alice",dest.deckTemplateId,3,{...dest.draft!,cards:[]});
  assert.deepEqual((await h.repo.decks().findOne({deckTemplateId:dest.deckTemplateId}))!.foreignCardSelections,[]);
  await h.repo.publishDeck("alice",dest.deckTemplateId,4);
  assert.equal((await h.repo.getDeckVersion(dest.deckTemplateId,3))!.content.cards.length,0);
  assert.ok((await h.repo.cards().findOne({cardTemplateId:h.a.cardTemplateId}))!.firstReusedAt);
  assert.deepEqual(await h.repo.getPersonalUser("alice"),before);
  await assert.rejects(h.repo.copyOwnedCard("alice",h.a.cardTemplateId,cmd),{code:"STALE_REVISION"});
  const privateCard=await h.repo.createCardDraft("bob",{...createDefaultCardContent([randomUUID(),randomUUID(),randomUUID()]),intro:{title:"Private source",description:null,mediaItem:null}});await h.repo.publishCard("bob",privateCard.cardTemplateId,0);
  await assert.rejects(copyDestinations(h.repo,"alice",privateCard.cardTemplateId,h.deck.deckTemplateId),{code:"CARD_FORBIDDEN"});
  await assert.rejects(h.repo.copyOwnedCard("alice",privateCard.cardTemplateId,{...cmd,revision:3,contentHash:deckContentHash({ ...dest.draft!,cards:[{cardTemplateId:h.a.cardTemplateId}] })}),{code:"CARD_FORBIDDEN"});
});

test("publishing an owned Card inside a foreign Deck retains both canonical identities and never copies the Deck",async()=>{
  const h=await setup(false,true),c=h.make(); title(c,h.a.cardTemplateId,"Owned refinement");await c.flushAll();
  assert.equal(await c.publishAndLeave({},async()=>true),true);
  assert.equal(c.deckTemplateId,h.deck.deckTemplateId); assert.equal(c.deck.ack,null);
  assert.equal((await h.repo.cards().findOne({cardTemplateId:h.a.cardTemplateId}))!.latestVersion,2);
  assert.equal((await h.repo.decks().findOne({deckTemplateId:h.deck.deckTemplateId}))!.latestVersion,1);
  assert.equal(await h.repo.decks().countDocuments({ownerUserId:"alice"}),0);
});

test("foreign private draft edits do not invalidate reviewed published references or reveal their revision",async()=>{
  const h=await setup(),c=h.make(); c.editDeck({...c.deck.desired,title:"Stable public selection"});await c.flushAll();
  const review=await h.repo.prepareDeckPublication("alice",c.deckTemplateId,0);
  await h.repo.saveCardDraft("bob",h.a.cardTemplateId,1,{...h.a.draft!,intro:{...h.a.draft!.intro,title:"Unpublished private work"}});
  assert.deepEqual(await h.repo.prepareDeckPublication("alice",c.deckTemplateId,0),review);
  await h.repo.publishDeck("alice",c.deckTemplateId,0,undefined,{review,acceptCardDrafts:false},{enterMyDecks:true});
  assert.equal((await h.repo.getDeckVersion(c.deckTemplateId,1))!.content.cards[0].cardVersionAtPublish,1);
});

test("Copy into a clean Deck with an unreviewed newer foreign selection stays draft-only and retries exactly",async()=>{
  const h=await setup(true), content={...h.deck.draft!,title:"Published selected programme"};
  await h.repo.saveDeckDraft("alice",h.deck.deckTemplateId,1,content,"public",[h.a,h.b].map((card)=>({cardTemplateId:card.cardTemplateId,version:1})));
  await h.repo.publishDeck("alice",h.deck.deckTemplateId,2);
  await h.repo.saveCardDraft("bob",h.a.cardTemplateId,1,{...h.a.draft!,intro:{...h.a.draft!.intro,title:"Newer shared publication"}});await h.repo.publishCard("bob",h.a.cardTemplateId,2);
  const fresh=await h.repo.createCardDraft("alice",{...createDefaultCardContent([randomUUID(),randomUUID(),randomUUID()]),intro:{title:"Another published practice",description:null,mediaItem:null}},"public");await h.repo.publishCard("alice",fresh.cardTemplateId,0);
  const dest=(await copyDestinations(h.repo,"alice",fresh.cardTemplateId,randomUUID())).find((deck)=>deck.deckTemplateId===h.deck.deckTemplateId)!;
  const cmd={deckTemplateId:dest.deckTemplateId,revision:dest.revision,contentHash:dest.contentHash};
  const result=await h.repo.copyOwnedCard("alice",fresh.cardTemplateId,cmd);
  assert.equal(result.outcome,"draft");assert.equal((await h.repo.decks().findOne({deckTemplateId:dest.deckTemplateId}))!.latestVersion,2);
  assert.deepEqual(await h.repo.copyOwnedCard("alice",fresh.cardTemplateId,cmd),result);
  const review=await h.repo.prepareDeckPublication("alice",dest.deckTemplateId,result.revision);
  assert.equal(review.cards[0].selectedVersion,1);assert.equal(review.cards[0].latestVersion,2);
  await assert.rejects(h.repo.publishDeck("alice",dest.deckTemplateId,result.revision,undefined,{review,acceptCardDrafts:false}),{code:"NEWER_FOREIGN_CARD_CONFIRMATION_REQUIRED"});
});

test("Copy of a selected older foreign publication waits for explicit review and cannot access private-era versions",async()=>{
  const h=await setup();await h.repo.saveCardDraft("bob",h.a.cardTemplateId,1,{...h.a.draft!,intro:{...h.a.draft!.intro,title:"New canonical publication"}});await h.repo.publishCard("bob",h.a.cardTemplateId,2);
  const dest=await h.repo.createDeckDraft("alice",{...createDefaultDeckContent([]),title:"Public destination"},"public");await h.repo.publishDeck("alice",dest.deckTemplateId,0);
  const selected=(await copyDestinations(h.repo,"alice",h.a.cardTemplateId,h.deck.deckTemplateId)).find((root)=>root.deckTemplateId===dest.deckTemplateId)!;
  const cmd={deckTemplateId:dest.deckTemplateId,revision:selected.revision,contentHash:selected.contentHash,sourceVersion:1};
  const result=await h.repo.copyOwnedCard("alice",h.a.cardTemplateId,cmd);assert.equal(result.outcome,"draft");
  assert.equal((await h.repo.decks().findOne({deckTemplateId:dest.deckTemplateId}))!.latestVersion,1);
  assert.deepEqual(await h.repo.copyOwnedCard("alice",h.a.cardTemplateId,cmd),result);
  await assert.rejects(h.repo.copyOwnedCard("alice",h.a.cardTemplateId,{...cmd,sourceVersion:2}),{code:"COPY_CARD_RECOVERY_CONFLICT"});
  const review=await h.repo.prepareDeckPublication("alice",dest.deckTemplateId,result.revision);
  assert.equal(review.cards[0].selectedVersion,1);assert.equal(review.cards[0].latestVersion,2);
  await h.repo.publishDeck("alice",dest.deckTemplateId,result.revision,undefined,{review,acceptCardDrafts:false,acceptNewerForeignCards:true});
  assert.equal((await h.repo.getDeckVersion(dest.deckTemplateId,2))!.content.cards[0].cardVersionAtPublish,2);
  const privateCard=await h.repo.createCardDraft("bob",{...createDefaultCardContent([randomUUID(),randomUUID(),randomUUID()]),intro:{title:"Private era",description:null,mediaItem:null}});await h.repo.publishCard("bob",privateCard.cardTemplateId,0);
  await h.repo.saveCardDraft("bob",privateCard.cardTemplateId,1,privateCard.draft!,"public");await h.repo.publishCard("bob",privateCard.cardTemplateId,2);
  await assert.rejects(h.repo.copyOwnedCard("alice",privateCard.cardTemplateId,{...cmd,sourceVersion:1}),{code:"CARD_VERSION_FORBIDDEN"});
  assert.equal((await h.repo.cards().findOne({cardTemplateId:privateCard.cardTemplateId}))!.firstReusedAt,undefined);
});
