import assert from "node:assert/strict";
import { test } from "node:test";
import { CreatorRecoveryJournal, type SubmittedCreatorOperation } from "../src/components/creator/creatorRecovery";
import { createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
class MemoryStorage {
  values = new Map<string,string>(); get length(){return this.values.size;} key(i:number){return [...this.values.keys()][i]??null;}
  getItem(k:string){return this.values.get(k)??null;} setItem(k:string,v:string){this.values.set(k,v);} removeItem(k:string){this.values.delete(k);}
}
const operation = (): SubmittedCreatorOperation => ({schema:1,actor:"alice",sessionId:"tab",sourceDeckId:"source",origin:"?returnTo=library&returnDeckId=source",submittedAt:Date.now(),kind:"deck",
  command:{source:{deckTemplateId:"source",version:2},deckTemplateId:"target",context:{kind:"library"},content:{...createDefaultDeckContent([]),title:"First submitted edit"}}});
test("operation journal survives reload with exact command and origin; acknowledgment clears",()=>{
  const storage=new MemoryStorage(), journal=new CreatorRecoveryJournal(storage,"alice","source"), command=operation();
  journal.write(command); assert.deepEqual(new CreatorRecoveryJournal(storage,"alice","source").read(),command);
  assert.throws(()=>journal.write({...command,command:{...command.command,deckTemplateId:"different"}}),{code:"CREATOR_RECOVERY_UNAVAILABLE"});
  journal.clear(); assert.equal(journal.read(),null);
});
test("journal is isolated by actor and source Deck; account switch purges foreign pending content",()=>{
  const storage=new MemoryStorage();new CreatorRecoveryJournal(storage,"alice","source").write(operation());
  assert.equal(new CreatorRecoveryJournal(storage,"alice","other").read(),null);
  assert.equal(new CreatorRecoveryJournal(storage,"bob","source").read(),null); assert.equal(storage.length,0);
});
test("unavailable, malformed or expired storage fails closed before submission",()=>{
  const storage=new MemoryStorage(), journal=new CreatorRecoveryJournal(storage,"alice","source");
  storage.setItem("switchplay:creator-operation:v1:alice:source","{"); assert.throws(()=>journal.read(),{code:"CREATOR_RECOVERY_UNAVAILABLE"});
  storage.values.clear(); assert.throws(()=>journal.write({...operation(),submittedAt:0}),{code:"CREATOR_RECOVERY_UNAVAILABLE"});
  storage.setItem=()=>{throw new Error("Quota");}; assert.throws(()=>journal.write(operation()),{code:"CREATOR_RECOVERY_UNAVAILABLE"});
});

import { actorCreatorTransport, CreatorActorLifetime } from "../src/components/creator/creatorRequest";
test("actor-bound transport rejects account changes before writing and before installing a delayed response",async(t)=>{
  let actor="bob", writes=0;
  t.mock.method(globalThis,"fetch",async(url:string|URL|Request,options?:RequestInit)=>{
    if (String(url)==="/api/auth/me") return Response.json({user:{id:actor}});
    assert.equal((options?.headers as Record<string,string>)["X-Creator-Actor"],"alice"); writes++; actor="bob";return Response.json({ok:true});
  });
  const transport=actorCreatorTransport("alice"); await assert.rejects(transport("/write","POST",{}),{code:"CREATOR_SESSION_CONFLICT"});assert.equal(writes,0);
  actor="alice"; await assert.rejects(transport("/write","POST",{}),{code:"CREATOR_SESSION_CONFLICT"});assert.equal(writes,1);
  const lifetime=new CreatorActorLifetime(); lifetime.setActive(false);
  await assert.rejects(actorCreatorTransport("alice",()=>lifetime.isActive())("/write","POST",{}),{code:"CREATOR_SESSION_CONFLICT"});assert.equal(writes,1);
});
import { CreatorPersistenceCoordinator } from "../src/components/creator/creatorPersistenceCoordinator";
test("actor-bound transport preserves publication error messages when no code is provided",async(t)=>{
  t.mock.method(globalThis,"fetch",async(url:string|URL|Request)=>String(url)==="/api/auth/me"
    ? Response.json({user:{id:"alice"}}) : Response.json({error:"Simulated final Deck failure"},{status:500}));
  await assert.rejects(actorCreatorTransport("alice")("/publish","POST",{}),{code:"Simulated final Deck failure"});
});
import { blankPrivateBoard, privateGraph } from "../src/components/creator/cardArchitectureAdapter";
import { appendCreatorCard } from "../src/components/creator/creatorBoardState";
test("ordinary new owned Cards are creating, never foreign-confirmation targets",()=>{
  const c=new CreatorPersistenceCoordinator(blankPrivateBoard(),null,async()=>new Promise(()=>{}));
  assert.equal(c.binding(),"owned");
  const board=appendCreatorCard(blankPrivateBoard()),graph=privateGraph(board),card=graph.cards[0];
  c.addCard(card.cardTemplateId,card.content.steps.map((step)=>step.stepId),graph.content);
  assert.equal(c.binding(card.cardTemplateId),"creating");
});
test("detached upload saves may finish after SPA leave, without enabling other stale-session operations",()=>{
  const lifetime=new CreatorActorLifetime(); lifetime.allowDetachedCard("retained"); lifetime.setActive(false);
  assert.equal(lifetime.isActive("/api/card-templates/retained","PATCH",{type:"save"}),true);
  assert.equal(lifetime.isActive("/api/card-templates/retained","PATCH",{type:"publish"}),false);
  assert.equal(lifetime.isActive("/api/card-templates/other","PATCH",{type:"save"}),false);
  assert.equal(lifetime.isActive("/api/deck-templates/source/fork","POST",{}),false);
});
import { signProspectiveAttachment } from "../src/lib/cards/prospectiveUpload";
import { jwtVerify } from "jose";
import { createStreamVideoReadinessRequestUrl } from "../src/lib/mediaUploadClient";
test("foreign canonical readiness reads the exact public version without an owner upload context",()=>{
  const url=new URL(createStreamVideoReadinessRequestUrl({scope:"deck-introduction",deckTemplateId:"source",publishedVersion:2},"asset"),"http://localhost");
  assert.equal(url.pathname,"/api/library/media/stream-status");
  assert.equal(url.searchParams.get("kind"),"deck");assert.equal(url.searchParams.get("templateId"),"source");assert.equal(url.searchParams.get("version"),"2");
  assert.equal(createStreamVideoReadinessRequestUrl({scope:"deck-introduction",deckTemplateId:"owned"},"asset").startsWith("/api/media/stream/status?"),true);
});
test("prospective attachment proofs cannot be used as authentication session tokens",async()=>{
  const previous=process.env.SESSION_SECRET;process.env.SESSION_SECRET="isolated-proof-purpose-test";
  try {
    const proof=await signProspectiveAttachment("alice",{kind:"card",source:{cardTemplateId:"source",version:1},targetId:"target",slot:"intro",context:{kind:"library"}},"asset","cloudflare-stream");
    await assert.rejects(jwtVerify(proof,new TextEncoder().encode(process.env.SESSION_SECRET),{algorithms:["HS256"]}));
  } finally { if(previous===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=previous; }
});
