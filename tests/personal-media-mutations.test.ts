import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { appendCardMediaItem, flushPersonalMutations, removePersonalCardMediaItem } from "../src/lib/deckMutations";

test("source-media deletion serializes with source uploads and navigation waits for both acknowledgements", async () => {
  const requests: { url: string; method: string | undefined; complete: (value: Response) => void }[] = [];
  const fetchMock = mock.method(globalThis, "fetch", (url: string, init?: RequestInit) => new Promise<Response>((complete) => {
    requests.push({ url, method: init?.method, complete });
  }));
  try {
    const item = { id: "image", mediaType: "image" as const, provider: "cloudflare-r2" as const, assetId: "key", src: "https://example.invalid/image", description: "Evidence" };
    const upload = appendCardMediaItem("original-deck", "source", item);
    const deletion = removePersonalCardMediaItem("source", "image");
    let navigated = false;
    const navigation = flushPersonalMutations().then(() => { navigated = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(requests.length, 1); assert.equal(navigated, false);
    requests[0].complete(Response.json({ ok: true, cardId: "source", deckTemplateId: "original-deck", mediaItems: [item] }));
    await upload;
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(requests.length, 2); assert.equal(navigated, false);
    assert.equal(requests[1].url, "/api/cards-data/source/media/image"); assert.equal(requests[1].method, "DELETE");
    requests[1].complete(Response.json({ ok: true, cardId: "source", mediaItems: [] }));
    await Promise.all([deletion, navigation]); assert.equal(navigated, true);
  } finally { fetchMock.mock.restore(); }
});

test("personal deletion failure blocks pending navigation and keeps an explicit error", async () => {
  let complete!: (value: Response) => void;
  const fetchMock = mock.method(globalThis, "fetch", () => new Promise<Response>((resolve) => { complete = resolve; }));
  try {
    const deletion = removePersonalCardMediaItem("source", "image"), navigation = flushPersonalMutations();
    const checks = [assert.rejects(deletion, /PERSONAL_MEDIA_FORBIDDEN/), assert.rejects(navigation, /PERSONAL_MEDIA_FORBIDDEN/)];
    await new Promise<void>((resolve) => setImmediate(resolve));
    complete(Response.json({ error: "PERSONAL_MEDIA_FORBIDDEN" }, { status: 403 }));
    await Promise.all(checks);
  } finally { fetchMock.mock.restore(); }
});
