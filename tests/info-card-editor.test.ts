import assert from "node:assert/strict";
import { test } from "node:test";
import { InfoCardEditorController, type InfoEditorDTO } from "../src/components/info-cards/infoCardEditorController";
import { CreatorRequestError, type CreatorTransport } from "../src/components/creator/creatorRequest";
import { EMPTY_INFO_DRAFT, type InfoRoot } from "../src/lib/infoCards/model";

function fixture() {
  const root: InfoRoot = { infoCardId: "a", ownerUserId: "alice", visibility: "private", draftVisibility: "private", draft: { ...EMPTY_INFO_DRAFT }, latestVersion: 0, revision: 0, referenceRevision: 0, createdAt: new Date(), updatedAt: new Date() };
  let dto: InfoEditorDTO = { root, publication: null, selectedSeries: null };
  let loseSave = false, loseCreate = false, losePublish = false;
  const receipts = new Map<number, NonNullable<InfoEditorDTO["publication"]>>();
  const calls: { method: string; body: unknown }[] = [];
  const request: CreatorTransport = async <T>(url: string, method = "GET", data?: unknown) => {
    calls.push({ method, body: structuredClone(data) });
    if (method === "POST" && url === "/api/info-cards") { if (loseCreate) { loseCreate = false; throw Error("lost create response"); } return structuredClone(root) as T; }
    if (method === "PATCH") {
      const body = data as { revision: number; content: typeof EMPTY_INFO_DRAFT; visibility: "private" | "public" };
      if (root.revision === body.revision + 1 && JSON.stringify(root.draft) === JSON.stringify(body.content)) return structuredClone(root) as T;
      if (root.revision !== body.revision) throw new CreatorRequestError(409, "STALE_INFO_REVISION");
      root.revision++; root.draft = structuredClone(body.content); root.draftVisibility = body.visibility;
      if (loseSave) { loseSave = false; throw Error("lost save response"); }
      return structuredClone(root) as T;
    }
    if (method === "POST") {
      const { revision } = data as { revision: number };
      if (!receipts.has(revision)) {
        if (root.revision !== revision) throw new CreatorRequestError(409, "STALE_INFO_REVISION");
        root.latestVersion++; root.revision++;
        dto.publication = { infoCardId: "a", version: root.latestVersion, content: { ...root.draft!, seriesId: "s" }, visibility: root.draftVisibility, sourceRevision: revision, publishedAt: new Date(), publishedByUserId: "alice" };
        receipts.set(revision, structuredClone(dto.publication)); root.draft = null; root.visibility = root.draftVisibility;
      }
      if (losePublish) { losePublish = false; throw Error("lost publish response"); }
      return structuredClone(receipts.get(revision)) as T;
    }
    return structuredClone(dto) as T;
  };
  return { request, calls, root, get dto() { return dto; }, set dto(value) { dto = value; },
    loseSave() { loseSave = true; }, loseCreate() { loseCreate = true; }, losePublish() { losePublish = true; } };
}

test("clean published editor does not save or create a spurious draft", async () => {
  const f = fixture(); f.root.latestVersion = 1; f.root.draft = null;
  f.dto = { ...f.dto, publication: { infoCardId: "a", version: 1, content: { ...EMPTY_INFO_DRAFT, title: "Signs", body: "Keep signs.", seriesId: "s" }, visibility: "private", sourceRevision: 0, publishedAt: new Date(), publishedByUserId: "alice" } };
  const editor = new InfoCardEditorController("a", "alice", structuredClone(f.dto), f.request);
  await editor.flush(); assert.equal(editor.dirty, false); assert.equal(editor.outstanding, false); assert.equal(f.calls.length, 0);
  assert.equal(editor.confirmedPublicationVersion, null);
});
test("incomplete drafts autosave independently and lost save/create responses retry stable commands", async () => {
  const f = fixture(), editor = new InfoCardEditorController("a", "alice", null, f.request);
  editor.edit({ ...EMPTY_INFO_DRAFT, title: "Incomplete" }); f.loseCreate();
  await assert.rejects(editor.flush()); await editor.retry(); assert.equal(f.root.draft?.title, "Incomplete");
  editor.edit({ ...editor.desired, body: "Retained body" }); f.loseSave(); await assert.rejects(editor.flush());
  const revision = f.root.revision; await editor.retry(); assert.equal(f.root.revision, revision); assert.equal(editor.dirty, false); editor.stopTimer();
});
test("revision conflicts preserve local content and block navigation flush", async () => {
  const f = fixture(), editor = new InfoCardEditorController("a", "alice", structuredClone(f.dto), f.request);
  editor.edit({ ...EMPTY_INFO_DRAFT, title: "Local" }); f.root.revision++;
  await assert.rejects(editor.flush(), /STALE_INFO_REVISION/); assert.equal(editor.desired.title, "Local"); await assert.rejects(editor.flush()); editor.stopTimer();
});
test("lost publication uses the consumed revision receipt, without a history read or second publication", async () => {
  const f = fixture(), editor = new InfoCardEditorController("a", "alice", null, f.request);
  editor.edit({ title: "Signs", body: "Keep signs.", seriesId: "s", mediaItem: null }); await editor.flush();
  f.losePublish(); await assert.rejects(editor.publish()); assert.notEqual(editor.pendingPublication, undefined);
  assert.equal(editor.confirmedPublicationVersion, null);
  editor.edit({ ...editor.desired, title: "Must stay locked" }); assert.equal(editor.desired.title, "Signs");
  await editor.retry(); assert.equal(f.root.latestVersion, 1); assert.equal(editor.pendingPublication, undefined); assert.equal(editor.outstanding, false); editor.stopTimer();
  assert.equal(editor.confirmedPublicationVersion, 1);
});
test("submitted save recovers after reload without discarding a committed command", async () => {
  const f = fixture(), values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  const first = new InfoCardEditorController("a", "alice", structuredClone(f.dto), f.request); first.configureRecovery(storage);
  first.edit({ ...EMPTY_INFO_DRAFT, title: "Submitted text" }); f.loseSave(); await assert.rejects(first.flush());
  const resumed = new InfoCardEditorController("a", "alice", structuredClone(f.dto), f.request); resumed.configureRecovery(storage); await resumed.flush();
  assert.equal(resumed.desired.title, "Submitted text"); assert.equal(values.size, 0); first.stopTimer(); resumed.stopTimer();
});

test("a rejected publication does not prevent corrected draft text from autosaving", async () => {
  const f = fixture();
  const request: CreatorTransport = async <T>(url: string, method = "GET", body?: unknown) => {
    if (url.endsWith("/publish")) throw new CreatorRequestError(422, "INFO_CAPACITY_EXCEEDED", { capacity: { issues: ["Shorten the explanation."] } });
    return f.request<T>(url, method, body);
  };
  const editor = new InfoCardEditorController("a", "alice", null, request);
  editor.edit({ ...EMPTY_INFO_DRAFT, title: "Too long" }); await assert.rejects(editor.publish());
  editor.edit({ ...editor.desired, body: "Corrected draft" }); await editor.flush();
  assert.equal(f.root.draft?.body, "Corrected draft"); assert.equal(editor.error, null); editor.stopTimer();
});

test("lost creation followed by reload recovers the submitted first text", async () => {
  const f = fixture(), values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  const editor = new InfoCardEditorController("a", "alice", null, f.request); editor.configureRecovery(storage);
  editor.edit({ ...EMPTY_INFO_DRAFT, title: "Recover after create" }); f.loseCreate(); await assert.rejects(editor.flush());
  const resumed = new InfoCardEditorController("a", "alice", structuredClone(f.dto), f.request); resumed.configureRecovery(storage); await resumed.flush();
  assert.equal(f.root.draft?.title, "Recover after create"); assert.equal(values.size, 0); editor.stopTimer(); resumed.stopTimer();
});
test("a rejected series save can be corrected without replaying the invalid selection", async () => {
  const f = fixture();
  const request: CreatorTransport = async <T>(url: string, method = "GET", body?: unknown) => {
    if (method === "PATCH" && (body as { content: typeof EMPTY_INFO_DRAFT }).content.seriesId === "hidden") throw new CreatorRequestError(403, "SERIES_FORBIDDEN");
    return f.request<T>(url, method, body);
  };
  const editor = new InfoCardEditorController("a", "alice", structuredClone(f.dto), request);
  editor.edit({ ...EMPTY_INFO_DRAFT, title: "Retained", seriesId: "hidden" }); await assert.rejects(editor.flush());
  editor.edit({ ...editor.desired, seriesId: "eligible" }); await editor.flush(); assert.equal(f.root.draft?.title, "Retained"); assert.equal(f.root.draft?.seriesId, "eligible"); editor.stopTimer();
});

test("reload of uncertain publication exposes recovery and reuses its receipt", async () => {
  const f = fixture(), values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  const editor = new InfoCardEditorController("a", "alice", null, f.request); editor.configureRecovery(storage);
  editor.edit({ ...EMPTY_INFO_DRAFT, title: "Signs", body: "Keep signs.", seriesId: "s" }); f.losePublish(); await assert.rejects(editor.publish());
  const resumed = new InfoCardEditorController("a", "alice", structuredClone(f.dto), f.request); resumed.configureRecovery(storage);
  assert(resumed.error); assert.notEqual(resumed.pendingPublication, undefined); await resumed.retry();
  assert.equal(f.root.latestVersion, 1); assert.equal(values.size, 0); editor.stopTimer(); resumed.stopTimer();
  assert.equal(resumed.confirmedPublicationVersion, 1);
});
