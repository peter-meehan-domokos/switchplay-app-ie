import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import type { VisualClaimJournal } from "../src/lib/visualLearningRecords/claimOutbox";
import type { VisualOutbox } from "../src/lib/visualLearningRecords/outbox";
import type { claimFixture } from "./helpers/visual-claim-fixtures";

let bundle: string;
test.beforeAll(async () => {
  bundle = (await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import {createBrowserVisualStore} from './src/lib/visualLearningRecords/browserStore';
    import {claimFixture} from './tests/helpers/visual-claim-fixtures';
    const f=claimFixture(),name='visual-claim-'+crypto.randomUUID();let store=createBrowserVisualStore(name);
    window.fixture=f;
    window.seed=async()=>{await store.update(f.guest.key,()=>f.guest);await store.update(f.pending.key,()=>f.pending);await store.writeClaim(f.journal);};
    window.install=()=>store.installClaim(f.journal.claimId,f.receipt);
    window.installReordered=()=>store.installClaim(f.journal.claimId,Object.fromEntries(Object.entries({...f.receipt,mappings:f.receipt.mappings.map(mapping=>Object.fromEntries(Object.entries(mapping).reverse()))}).reverse()));
    window.snapshot=async()=>({guest:await store.list(f.journal.guestLearner),account:await store.list(f.receipt.learner),journal:await store.readClaim(f.journal.claimId)});
    window.edit=()=>store.update(f.accountKey,row=>({...row,generation:row.generation+1}));
    const put=IDBObjectStore.prototype.put;window.failWrites=()=>{let count=0;IDBObjectStore.prototype.put=function(...args){if(this.name==='outboxes'&&++count===2)throw new DOMException('Injected quota after archive','QuotaExceededError');return put.apply(this,args);};};
    window.restoreWrites=()=>{IDBObjectStore.prototype.put=put;};
    window.legacy=async()=>{
      const name='visual-old-'+crypto.randomUUID();
      await new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>{request.result.createObjectStore('outboxes',{keyPath:'key'});request.result.createObjectStore('opening');};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('outboxes','readwrite');tx.objectStore('outboxes').put(f.pending);tx.oncomplete=()=>{db.close();resolve();};};});
      store=createBrowserVisualStore(name);const old=await store.read(f.pending.key);await store.writeClaim(f.journal);
      const journal=await store.readClaim(f.journal.claimId);return {old,journal};
    };
  ` }, bundle: true, write: false, platform: "browser", format: "iife", define: { "process.env.NODE_ENV": '"test"' } })).outputFiles![0].text;
});
type Harness = { fixture: ReturnType<typeof claimFixture>; seed(): Promise<void>; install(): Promise<VisualClaimJournal>; installReordered(): Promise<VisualClaimJournal>; edit(): Promise<VisualOutbox>;
  snapshot(): Promise<{ guest: VisualOutbox[]; account: VisualOutbox[]; journal: VisualClaimJournal }>;
  failWrites(): void; restoreWrites(): void; legacy(): Promise<{ old: VisualOutbox; journal: VisualClaimJournal }> };
async function setup(page: Page) {
  await page.route("https://fixture.invalid/**", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.goto("https://fixture.invalid/"); await page.addScriptTag({ content: bundle });
  return page.evaluate(() => (window as unknown as Harness).fixture);
}
test("native IndexedDB claim install is atomic through quota failure and retry never replaces later account work", async ({ page }) => {
  const f = await setup(page); await page.evaluate(() => (window as unknown as Harness).seed());
  const before = await page.evaluate(() => (window as unknown as Harness).snapshot());
  await page.evaluate(() => (window as unknown as Harness).failWrites());
  const error = await page.evaluate(async () => { try { await (window as unknown as Harness).install(); return "unexpected success"; } catch (error) { return String(error); } });
  expect(error).toContain("Injected quota"); expect(await page.evaluate(() => (window as unknown as Harness).snapshot())).toEqual(before);
  await page.evaluate(() => (window as unknown as Harness).restoreWrites());
  expect((await page.evaluate(() => (window as unknown as Harness).install())).phase).toBe("installed");
  const after = await page.evaluate(() => (window as unknown as Harness).snapshot()); expect(after.guest).toEqual([]); expect(after.account).toHaveLength(2);
  expect(after.account.find(row => row.key === f.accountKey)!.snapshot).toEqual(f.guest.snapshot);
  expect(after.account.find(row => row.key.endsWith(`|${f.pending.session.attemptId}`))!.flight).toEqual(f.pending.flight);
  const changed = await page.evaluate(() => (window as unknown as Harness).edit()); await page.evaluate(() => (window as unknown as Harness).installReordered());
  expect((await page.evaluate(() => (window as unknown as Harness).snapshot())).account.find(row => row.key === f.accountKey)).toEqual(changed);
});
test("additive storage upgrade retains version-one pending batches and adds only the claim journal", async ({ page }) => {
  const f = await setup(page), upgraded = await page.evaluate(() => (window as unknown as Harness).legacy());
  expect(upgraded.old).toEqual(f.pending); expect(upgraded.journal).toEqual(f.journal);
});
