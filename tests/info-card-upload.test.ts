import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadInfoCardMedia } from "../src/components/info-cards/infoCardUpload";
import { InfoCardEditorController } from "../src/components/info-cards/infoCardEditorController";
import type { CreatorTransport } from "../src/components/creator/creatorRequest";
import type { InfoMedia, InfoRoot } from "../src/lib/infoCards/model";
import { EMPTY_INFO_DRAFT } from "../src/lib/infoCards/model";

const media: InfoMedia = { id: "new", provider: "cloudflare-r2", mediaType: "image", src: "https://private.invalid/new.png", assetId: "new", description: "Image" };
const uploadHeaders = { "Content-Type": "image/png", "If-None-Match": "*", "x-amz-meta-creator": "alice", "x-amz-meta-info-card-id": "a" };
function fixture() {
  const root: InfoRoot = { infoCardId: "a", ownerUserId: "alice", visibility: "private", draftVisibility: "private", draft: { ...EMPTY_INFO_DRAFT }, revision: 0, latestVersion: 0, referenceRevision: 0, createdAt: new Date(), updatedAt: new Date() };
  const saves: Record<string, unknown>[] = [];
  const request: CreatorTransport = async <T>(url: string, method = "GET", body?: unknown) => {
    if (url.endsWith("/upload")) return { media, proof: "target-proof", uploadURL: "https://upload.invalid/object", headers: uploadHeaders } as T;
    if (method === "PATCH") { const command = body as { content: typeof EMPTY_INFO_DRAFT }; saves.push(body as Record<string, unknown>); root.draft = command.content; root.revision++; }
    return structuredClone(root) as T;
  };
  return { editor: new InfoCardEditorController("a", "alice", { root: structuredClone(root), publication: null, selectedSeries: null }, request), root, saves };
}

test("image upload honours server headers/proof and merges into text edited during transfer", async t => {
  const f = fixture(); let finish!: () => void, started!: () => void;
  const beginning = new Promise<void>(resolve => { started = resolve; }), transfer = new Promise<void>(resolve => { finish = resolve; });
  t.mock.method(globalThis, "fetch", async (_input: unknown, init: RequestInit) => {
    assert.equal(init.method, "PUT"); assert.deepEqual(init.headers, uploadHeaders); started(); await transfer; return new Response(null, { status: 200 });
  });
  const pending = uploadInfoCardMedia(f.editor, new File(["image"], "a.png", { type: "image/png" }), new AbortController().signal);
  await beginning; f.editor.edit({ ...f.editor.desired, body: "Newer text survives" }); finish(); await pending;
  assert.equal(f.root.draft?.body, "Newer text survives"); assert.deepEqual(f.root.draft?.mediaItem, media);
  assert.equal(f.saves.at(-1)?.mediaProof, "target-proof"); f.editor.stopTimer();
});
test("failed or cancelled replacement retains previous media and never installs stale allocation", async t => {
  const f = fixture(), previous = { ...media, id: "old", assetId: "old", src: "https://private.invalid/old.png" };
  f.editor.edit({ ...f.editor.desired, mediaItem: previous }); await f.editor.flush();
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 500 }));
  await assert.rejects(uploadInfoCardMedia(f.editor, new File(["image"], "a.png", { type: "image/png" }), new AbortController().signal));
  assert.deepEqual(f.editor.desired.mediaItem, previous);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(uploadInfoCardMedia(f.editor, new File(["image"], "a.png", { type: "image/png" }), abort.signal), { name: "AbortError" });
  assert.deepEqual(f.editor.desired.mediaItem, previous); f.editor.stopTimer();
});
test("invalid file never allocates credentials or changes the draft", async () => {
  const f = fixture(); await assert.rejects(uploadInfoCardMedia(f.editor, new File(["text"], "a.txt", { type: "text/plain" }), new AbortController().signal), /INVALID_INFO_UPLOAD_FILE/);
  assert.equal(f.saves.length, 0); assert.equal(f.editor.desired.mediaItem, null);
});
