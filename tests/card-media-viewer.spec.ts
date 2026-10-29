import { expect, test } from "@playwright/test";
import { boundImageTransform, gallerySwipeDirection, resolveMediaSelection, type CardMediaRequest } from "@/lib/cardMediaViewer";
import { CardMediaAccessError, readCardMediaRequest, resolveAccessibleCardMedia } from "@/lib/cardMediaAccess";
import { createCardMediaHandler } from "@/lib/cardMediaApi";
import { createCardMediaFileHandler } from "@/lib/cardMediaFile";
import { createCardMediaVideoFileHandler } from "@/lib/cardMediaVideoFile";
import { getCardMediaDownload, mediaDownloadFilename } from "@/lib/cardMediaDownloads";
import { startCardMediaDownload, type DownloadState } from "@/lib/cardMediaClient";
import { personalMediaKey } from "@/lib/cards/personalHistoryProjection";
import { r2Location, streamPlaybackGrant } from "@/lib/cards/protectedMedia";
import type { CardData } from "@/lib/cards/model";
import { requestCloudflareStreamDownload } from "@/lib/cloudflareStream";
import type { AuthUser } from "@/lib/auth";
import type { ModernUserCardMediaItem } from "@/lib/userCardMedia";

const ownerId = "507f1f77bcf86cd799439011";
const viewerId = "507f1f77bcf86cd799439012";
const target: CardMediaRequest = { viewerUserId: ownerId, cardTemplateId: "card-1", sourceCardTemplateId: "card-1", mediaItemId: "image-1" };
const image: ModernUserCardMediaItem = { id: "image-1", mediaType: "image", provider: "cloudflare-r2", assetId: `user-decks/${ownerId}/deck-1/cards/card-1/abc.png`, src: "https://images.example/abc.png", description: "Written work.png" };
const video: ModernUserCardMediaItem = { id: "stream-1", mediaType: "video", provider: "cloudflare-stream", assetId: "video-1", src: "https://iframe.videodelivery.net/video-1", description: "Practice.mov" };
const items: ModernUserCardMediaItem[] = [image, video, { ...video, id: "stream-2" }, ...Array.from({ length: 5 }, (_, i) => ({ ...image, id: `image-${i + 2}` }))];
const record = { cardTemplateId: "card-1", mediaItems: items, tests: [], chats: [], cardTemplateVersion: 1 } as unknown as CardData;
const owner: AuthUser = { id: ownerId, isAdmin: false, username: "learner", email: "learner@example.invalid", createdAt: "2026-10-01", updatedAt: "2026-10-01" };
const viewer: AuthUser = { ...owner, id: viewerId };
const accessDeps = { loadCards: async (actor: string) => actor === ownerId ? [record] : [] };
const grant = async (assetId: string) => ({ assetId, manifestUrl: "https://videodelivery.net/signed-token/manifest/video.m3u8", thumbnailUrl: "https://videodelivery.net/signed-token/thumbnails/thumbnail.jpg", expiresAt: Date.now() + 3600000, reuseUntil: Date.now() + 600000 });

test("selection uses stable IDs, preserves mixed order beyond five, and finds nearest after removal", () => {
  items.forEach((item, index) => expect(resolveMediaSelection(items, { mediaItemId: personalMediaKey(item), index: 0 })).toEqual({ mediaItemId: personalMediaKey(item), index }));
  const reversed = [...items].reverse();
  expect(resolveMediaSelection(reversed, { mediaItemId: personalMediaKey(image), index: 0 })?.index).toBe(7);
  expect(resolveMediaSelection(items.slice(0, 7), { mediaItemId: personalMediaKey(items[7]), index: 7 })).toEqual({ mediaItemId: personalMediaKey(items[6]), index: 6 });
  expect(resolveMediaSelection([], { mediaItemId: personalMediaKey(image), index: 0 })).toBeNull();
  expect(resolveMediaSelection([image], { mediaItemId: "gone", index: 8 })?.index).toBe(0);
});

test("swipes reject short and vertical movements; pan stays bounded from fit through 4x", () => {
  expect([gallerySwipeDirection(-90, 10), gallerySwipeDirection(60, 20), gallerySwipeDirection(40, 1), gallerySwipeDirection(60, 100)]).toEqual([1, -1, 0, 0]);
  expect(boundImageTransform({ scale: 1, x: 100, y: -100 }, { width: 300, height: 600 }, { width: 1000, height: 1000 })).toEqual({ scale: 1, x: 0, y: 0 });
  expect(boundImageTransform({ scale: 10, x: 5000, y: -5000 }, { width: 300, height: 600 }, { width: 1000, height: 1000 })).toEqual({ scale: 4, x: 450, y: -300 });
});

test("personal access is actor scoped, includes inherited history and never grants admin or template-owner access", async () => {
  expect(await resolveAccessibleCardMedia(owner, target, accessDeps)).toEqual(image);
  await expect(resolveAccessibleCardMedia(viewer, target, accessDeps)).rejects.toMatchObject({ status: 403 });
  await expect(resolveAccessibleCardMedia({ ...viewer, isAdmin: true }, target, accessDeps)).rejects.toMatchObject({ status: 403 });
  await expect(resolveAccessibleCardMedia(viewer, { ...target, viewerUserId: viewerId }, accessDeps)).rejects.toMatchObject({ status: 404 });
  await expect(resolveAccessibleCardMedia(owner, { ...target, mediaItemId: "foreign" }, accessDeps)).rejects.toMatchObject({ status: 404 });
  const fork = { ...record, cardTemplateId: "fork", historySourceCardTemplateId: "card-1", mediaItems: [] };
  const inherited = { ...target, cardTemplateId: "fork" };
  expect(await resolveAccessibleCardMedia(owner, inherited, { loadCards: async () => [fork, record] })).toEqual(image);
  await expect(resolveAccessibleCardMedia(owner, { ...inherited, sourceCardTemplateId: "unrelated" }, { loadCards: async () => [fork, record] })).rejects.toMatchObject({ status: 404 });
  await expect(resolveAccessibleCardMedia(owner, target, { loadCards: async () => [record, record] })).rejects.toMatchObject({ status: 404 });
  expect(() => readCardMediaRequest({ ...target, url: "https://attacker.example" })).toThrow(CardMediaAccessError);
  expect(() => readCardMediaRequest({ ...target, deckUserId: viewerId })).toThrow(CardMediaAccessError);
});

test("source-aware selection does not confuse matching media IDs from an original and fork", () => {
  const inherited = { ...image, sourceCardTemplateId: "source" };
  expect(resolveMediaSelection([image, inherited], { mediaItemId: personalMediaKey(inherited), index: 0 })?.index).toBe(1);
});

test("API authenticates, checks origin, and uses only the authorized persisted asset", async () => {
  const assets: string[] = [];
  const handler = createCardMediaHandler({ currentUser: async () => owner, resolveMedia: (user, request) => resolveAccessibleCardMedia(user, request, accessDeps),
    download: async (item) => { assets.push(item.assetId); return { status: "ready", url: "https://delivery.example/file.png", filename: "file.png" }; }, grant, videoStatus: async () => ({ status: "ready" }) });
  const post = (body: unknown, origin = "https://app.example") => handler(new Request("https://app.example/api/media/card", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) }));
  const imageResponse = await post(target);
  expect(imageResponse.status).toBe(200);
  expect(await imageResponse.json()).toEqual({ status: "ready", url: `/api/media/card/file?${new URLSearchParams(target)}`, filename: "Written-work.png" });
  expect((await post({ ...target, mediaItemId: video.id })).status).toBe(200);
  expect(assets).toEqual([video.assetId]);
  expect((await post(target, "https://other.example")).status).toBe(403);
  expect((await post({ ...target, assetId: "arbitrary" })).status).toBe(400);
  expect((await post({ ...target, mediaItemId: "other" })).status).toBe(404);
  const unauthenticated = createCardMediaHandler({ currentUser: async () => null, resolveMedia: async () => { throw new Error("must not run"); }, download: async () => ({ status: "failed" }), grant, videoStatus: async () => ({ status: "ready" }) });
  expect((await unauthenticated(new Request("https://app.example/api/media/card"))).status).toBe(401);
});

test("downloads preserve image format and use direct MP4 delivery; generation is POST only and reused", async () => {
  const calls: string[] = [];
  const deps = { grant, videoStatus: async () => ({ status: "ready" as const }),
    download: async (_asset: string, method: "GET" | "POST" = "GET") => { calls.push(method); return method === "GET" ? null : { status: "inprogress" as const, percentComplete: 12 }; } };
  expect(mediaDownloadFilename(image)).toBe("Written-work.png");
  expect(mediaDownloadFilename(video)).toBe("Practice.mp4");
  expect(await getCardMediaDownload(video, false, deps)).toEqual({ status: "not-requested" });
  expect(await getCardMediaDownload(video, true, deps)).toEqual({ status: "preparing", progress: 12 });
  expect(calls).toEqual(["GET", "GET", "POST"]);
  const readyDeps = { ...deps, download: async (_asset: string, method: "GET" | "POST" = "GET") => { expect(method).toBe("GET"); return { status: "ready" as const, url: "https://customer-test.cloudflarestream.com/video-1/downloads/default.mp4" }; } };
  expect(await getCardMediaDownload(video, true, readyDeps)).toMatchObject({ status: "ready", url: "https://videodelivery.net/signed-token/downloads/default.mp4?filename=Practice" });
  expect(await getCardMediaDownload(video, true, { ...deps, videoStatus: async () => ({ status: "processing" as const }) })).toEqual({ status: "preparing", progress: undefined });
  expect(await getCardMediaDownload(video, false, { ...deps, download: async () => ({ status: "error" as const }) })).toEqual({ status: "failed" });
});

test("image resolution preserves historical and Card-scoped keys without assuming Deck-derived paths", () => {
  const key = "path-templates/old/introduction/abc.png";
  const origins = ["https://assets.tebostudio.com", "https://pub-121cf28a94a14f79a0d3145eac12674b.r2.dev"];
  const env = { CLOUDFLARE_R2_BUCKET_NAME: "canonical", CLOUDFLARE_R2_USER_DATA_BUCKET_NAME: "personal", CLOUDFLARE_R2_USER_DATA_PUBLIC_BASE_URL: "https://personal.example", CLOUDFLARE_R2_LEGACY_ORIGINS: JSON.stringify(Object.fromEntries(origins.map(origin => [origin, "canonical"]))) };
  origins.forEach(origin => expect(r2Location({ ...image, src: `${origin}/${key}`, assetId: key }, env)).toEqual({ bucket: "canonical", key }));
  const cardKey = `user-cards/${ownerId}/card-1/media.png`;
  expect(r2Location({ ...image, src: `https://personal.example/${cardKey}`, assetId: cardKey }, env)).toEqual({ bucket: "personal", key: cardKey });
  expect(() => r2Location({ ...image, src: "https://attacker.example/a.png" }, env)).toThrow();
});

test("download-enabled Stream tokens are requested separately from ordinary playback tokens", async () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: "fixture", CLOUDFLARE_STREAM_API_TOKEN: "fixture" };
  const old = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const bodies: Array<Record<string, unknown>> = [];
  try {
    const fetchToken: typeof fetch = async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return Response.json({ success: true, result: { token: "signed-token" } }); };
    await streamPlaybackGrant("video-1", fetchToken);
    await streamPlaybackGrant("video-1", fetchToken, true);
    expect(bodies[0].downloadable).toBeUndefined();
    expect(bodies[1].downloadable).toBe(true);
  } finally { Object.entries(old).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value); }
});

test("image download streams the authorized full image with attachment headers", async () => {
  const requested: string[] = [];
  const handler = createCardMediaFileHandler({ currentUser: async () => owner,
    resolveMedia: (user, request) => resolveAccessibleCardMedia(user, request, accessDeps),
    readImage: async (item) => { requested.push(item.src); return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-length": "3", "content-type": "image/png" } }); },
  });
  const response = await handler(new Request(`https://app.example/api/media/card/file?${new URLSearchParams(target)}`));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toBe('attachment; filename="Written-work.png"');
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect(requested).toEqual([image.src]);
  expect((await handler(new Request(`https://app.example/api/media/card/file?${new URLSearchParams({ ...target, mediaItemId: "missing" })}`))).status).toBe(404);
});

test("Safari video delivery streams an authorized MP4 with attachment headers and no Cloudflare API credentials", async () => {
  const requestTarget = { ...target, mediaItemId: video.id };
  const url = `https://app.example/api/media/card/video-file?${new URLSearchParams(requestTarget)}`;
  const upstreamUrl = "https://customer-test.cloudflarestream.com/video-1/downloads/default.mp4?filename=Practice";
  const handler = createCardMediaVideoFileHandler({
    currentUser: async () => owner,
    resolveMedia: (user, request) => resolveAccessibleCardMedia(user, request, accessDeps),
    download: async () => ({ status: "ready", url: upstreamUrl, filename: "Practice.mp4" }),
    fetchVideo: async (input, init) => {
      expect(String(input)).toBe(upstreamUrl);
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      expect(new Headers(init?.headers).get("origin")).toBe("https://app.example");
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "video/mp4", "Content-Length": "3", "Access-Control-Allow-Origin": "*" } });
    },
  });
  const response = await handler(new Request(url));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("video/mp4");
  expect(response.headers.get("content-length")).toBe("3");
  expect(response.headers.get("content-disposition")).toBe('attachment; filename="Practice.mp4"');
  expect(response.headers.has("x-media-upstream-url")).toBe(false);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect((await handler(new Request(`https://app.example/api/media/card/video-file?${new URLSearchParams(target)}`))).status).toBe(400);
  expect((await handler(new Request(`https://app.example/api/media/card/video-file?${new URLSearchParams({ ...target, mediaItemId: "missing" })}`))).status).toBe(404);
});

test("Cloudflare MP4 provider follows documented GET/POST envelope and keeps token server-side", async () => {
  const oldFetch = globalThis.fetch;
  const env = { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "test-token", CLOUDFLARE_STREAM_CUSTOMER_CODE: "test" };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  const methods: string[] = [];
  globalThis.fetch = async (input, init) => {
    expect(String(input)).toBe("https://api.cloudflare.com/client/v4/accounts/account/stream/video-1/downloads");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-token");
    methods.push(init?.method ?? "GET");
    return Response.json({ success: true, result: { default: { status: "inprogress", percentComplete: 35 } } });
  };
  try {
    expect(await requestCloudflareStreamDownload("video-1")).toMatchObject({ status: "inprogress" });
    await requestCloudflareStreamDownload("video-1", "POST");
    expect(methods).toEqual(["GET", "POST"]);
    globalThis.fetch = async () => Response.json({ success: false }, { status: 404 });
    expect(await requestCloudflareStreamDownload("video-1")).toBeNull();
  }
  finally { globalThis.fetch = oldFetch; Object.entries(previous).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value); }
});

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
test("download polling cancels obsolete work and never starts a late download", async () => {
  let resolve!: (value: { status: "ready"; url: string; filename: string }) => void;
  const states: DownloadState[] = [];
  let ready = false;
  let signal!: AbortSignal;
  const stop = startCardMediaDownload(target, (state) => states.push(state), () => { ready = true; }, { request: async (_target, _prepare, nextSignal) => { signal = nextSignal; return new Promise((done) => { resolve = done; }); } });
  stop(); resolve({ status: "ready", url: "https://delivery.example/file", filename: "work.png" }); await flush();
  expect(signal.aborted).toBe(true); expect(ready).toBe(false); expect(states).toEqual([{ status: "preparing" }]);
});

test("download polls with a bound, reports timeout, and can be retried", async () => {
  const states: DownloadState[] = [];
  const callbacks: Array<() => void> = [];
  const methods: boolean[] = [];
  const stop = startCardMediaDownload(target, (state) => states.push(state), () => {}, { maxChecks: 2, request: async (_target, prepare) => { methods.push(prepare); return { status: "preparing" }; }, schedule: (callback) => { callbacks.push(callback); return 1 as unknown as ReturnType<typeof setTimeout>; }, cancel: () => {} });
  await flush(); callbacks.shift()!(); await flush(); stop();
  expect(methods).toEqual([true, false]); expect(states.at(-1)).toMatchObject({ status: "error" });
  let ready = false;
  const retry = startCardMediaDownload(target, () => {}, () => { ready = true; }, { request: async () => ({ status: "ready", url: "https://delivery.example/file", filename: "work.png" }) });
  await flush(); expect(ready).toBe(true); retry();
});
