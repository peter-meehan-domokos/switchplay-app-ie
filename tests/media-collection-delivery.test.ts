import assert from "node:assert/strict";
import { test } from "node:test";
import { groupMediaVideoFile } from "../src/lib/mediaCollection/videoFile";
import type { GroupMediaRepository } from "../src/lib/groupExperiences/media/repository";
import { requestCardVideoReadiness } from "../src/lib/cardMediaClient";
const target = { viewerUserId: "bob", cardTemplateId: "card", sourceCardTemplateId: "card", mediaItemId: "group", groupMedia: { contributionId: "group", mediaType: "video" as const } };
test("Group video file proxy checks authority again after bytes arrive and preserves Range", async () => {
  let calls = 0, revoked = false;
  const repo = { authorized: async () => { calls++; if (revoked) throw Error("revoked"); return { row: { kind: "video", revision: 2 } }; },
    deliver: async () => Response.json({ status: "ready", filename: "practice.mp4", url: "https://videodelivery.net/signed/downloads/default.mp4" }) } as unknown as GroupMediaRepository;
  const response = await groupMediaVideoFile(repo, "bob", "group", { kind: "owner" }, new Request("http://local/file", { headers: { Range: "bytes=0-3" } }), async (_url, init) => {
    assert.equal((init?.headers as Record<string, string>).Range, "bytes=0-3"); return new Response("test", { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 0-3/4" } });
  });
  assert.equal(calls, 2); assert.equal(await response.text(), "test"); assert.equal(response.status, 206);
  assert.equal(response.headers.get("Vary"), "Cookie");
  await assert.rejects(groupMediaVideoFile(repo, "bob", "group", { kind: "owner" }, new Request("http://local/file"), async () => { revoked = true; return new Response("secret", { headers: { "Content-Type": "video/mp4" } }); }), /revoked/);
});
test("Group video grants use exact actor headers and expire through existing grant checks", async t => {
  let actor = "alice";
  t.mock.method(globalThis, "fetch", async () => Response.json({ status: "ready", grant: { assetId: "provider-id", manifestUrl: "https://videodelivery.net/signed/manifest/video.m3u8", thumbnailUrl: "https://videodelivery.net/signed/thumbnails/thumbnail.jpg", expiresAt: Date.now() + 3600000 } }, { headers: { "X-Group-Viewer": actor } }));
  await assert.rejects(requestCardVideoReadiness(target, new AbortController().signal), /account changed/);
  actor = "bob"; assert.equal((await requestCardVideoReadiness(target, new AbortController().signal)).grant?.assetId, "provider-id");
});
