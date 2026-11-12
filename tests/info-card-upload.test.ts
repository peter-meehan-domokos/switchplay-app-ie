import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadInfoCardMedia } from "../src/components/info-cards/infoCardUpload";
import { CreatorRequestError } from "../src/components/creator/creatorRequest";
import { infoCardError } from "../src/components/info-cards/infoCardErrors";
import { InfoCardEditorController } from "../src/components/info-cards/infoCardEditorController";
import type { CreatorTransport } from "../src/components/creator/creatorRequest";
import type { InfoMedia, InfoRoot } from "../src/lib/infoCards/model";
import { EMPTY_INFO_DRAFT } from "../src/lib/infoCards/model";

const media: InfoMedia = { id: "new", provider: "cloudflare-r2", mediaType: "image", src: "https://private.invalid/new.png", assetId: "new", description: "Image" };
const uploadHeaders = { "Content-Type": "image/png", "If-None-Match": "*", "x-amz-meta-creator": "alice", "x-amz-meta-info-card-id": "a" };
function fixture(personal = false) {
  const root: InfoRoot = { infoCardId: "a", ownerUserId: "alice", visibility: "private", draftVisibility: "private", draft: { ...EMPTY_INFO_DRAFT }, revision: 0, latestVersion: 0, referenceRevision: 0, createdAt: new Date(), updatedAt: new Date() };
  if (personal) { root.kind = "personal"; root.originCardTemplateId = "main"; }
  const saves: Record<string, unknown>[] = [];
  const request: CreatorTransport = async <T>(url: string, method = "GET", body?: unknown) => {
    if (url.endsWith("/upload")) return { media, proof: "target-proof", uploadURL: "https://upload.invalid/object", headers: uploadHeaders } as T;
    if (method === "PATCH") { const command = body as { content: typeof EMPTY_INFO_DRAFT }; saves.push(body as Record<string, unknown>); root.draft = command.content; root.revision++; }
    return structuredClone(root) as T;
  };
  return { editor: new InfoCardEditorController("a", "alice", { root: structuredClone(root), publication: null, selectedSeries: null }, request), root, saves };
}

for (const personal of [false, true]) test(`image upload honours headers/proof and newer text (personal: ${personal})`, async t => {
  const f = fixture(personal); let finish!: () => void, started!: () => void;
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

for (const kind of ["image", "video"] as const) test(`a ${kind} transfer that never reaches storage reads as a failed transfer and leaves the draft untouched`, async t => {
  const f = fixture(), previous = { ...media, id: "old", assetId: "old", src: "https://private.invalid/old.png" };
  f.editor.edit({ ...f.editor.desired, mediaItem: previous }); await f.editor.flush();
  // A browser network or CORS failure rejects fetch itself with a TypeError, not a response.
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  const file = kind === "image" ? new File(["image"], "a.png", { type: "image/png" }) : new File(["video"], "a.mp4", { type: "video/mp4" });
  await assert.rejects(uploadInfoCardMedia(f.editor, file, new AbortController().signal), (error: unknown) =>
    error instanceof CreatorRequestError && error.code === (kind === "image" ? "INFO_IMAGE_UPLOAD_FAILED" : "INFO_VIDEO_UPLOAD_FAILED"));
  assert.deepEqual(f.editor.desired.mediaItem, previous, "the previous media reference is kept");
  assert.match(infoCardError(new CreatorRequestError(0, kind === "image" ? "INFO_IMAGE_UPLOAD_FAILED" : "INFO_VIDEO_UPLOAD_FAILED")), new RegExp(`The ${kind} transfer failed\\. Retry the upload`));
  f.editor.stopTimer();
});
test("a cancelled transfer stays an abort and is not reported as a failed transfer", async t => {
  const f = fixture(), abort = new AbortController();
  t.mock.method(globalThis, "fetch", async () => { abort.abort(); throw new DOMException("aborted", "AbortError"); });
  await assert.rejects(uploadInfoCardMedia(f.editor, new File(["image"], "a.png", { type: "image/png" }), abort.signal), { name: "AbortError" });
  f.editor.stopTimer();
});
