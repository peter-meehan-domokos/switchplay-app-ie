import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createVisualLearningRecordIndexes } from "../src/lib/visualLearningRecords/repository";
import { createInfoCardIndexes, InfoCardRepository } from "../src/lib/infoCards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../src/lib/cards/forks";
import { networkInterfaces } from "node:os";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";
import { seedVisualReview } from "./fixtures/plugged-in-review";
import { createVisualReviewServer } from "./fixtures/plugged-in-review-server";
import { createMediaReviewHandler, seedMediaReview } from "../tests/helpers/mediaReviewFixture";
import { seedLiveGroupProgress } from "../tests/helpers/groupProgressLiveReview";
import { seedReflectionReview } from "../tests/helpers/reflectionReviewFixture";
import { GroupReflectionRepository } from "../src/lib/reflections/groupRepository";
import { saveCollectiveReflection } from "../src/lib/reflections/collective";
import { GroupExperienceRepository } from "../src/lib/groupExperiences/repository";
import { seedGroupReview } from "../tests/helpers/groupReviewFixture";
import { seedGroupProgressReview, startGroupProgressPreview } from "../tests/helpers/groupProgressReview";
import { createGroupExperienceIndexes } from "../src/lib/groupExperiences/indexes";

// This runner never uses an environment URI. It owns and destroys its replica set.
let mongo: MongoMemoryReplSet | undefined, client: MongoClient | undefined, app: ChildProcess | undefined;
let progressPreview: Awaited<ReturnType<typeof startGroupProgressPreview>> | undefined;
let reviewHandler: Awaited<ReturnType<typeof createVisualReviewServer>> | undefined;
const imageObjects = new Map<string, { bytes: Buffer; headers: Record<string, string> }>();
const mediaFixture = createMediaReviewHandler();
const media = createServer(async (request, response) => {
  if (await mediaFixture.handle(request, response)) return;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "PUT,POST,GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "*");
  response.setHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges");
  if (reviewHandler && await reviewHandler(request, response)) return;
  if (request.method === "PUT" && request.url?.startsWith("/upload?key=")) {
    const key = new URL(request.url, "http://fixture").searchParams.get("key")!;
    if (imageObjects.has(key) && request.headers["if-none-match"] === "*") { request.resume(); response.writeHead(412); response.end(); return; }
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    imageObjects.set(key, { bytes: Buffer.concat(chunks), headers: Object.fromEntries(Object.entries(request.headers)
      .filter(([key, value]) => typeof value === "string" && (key.startsWith("x-amz-meta-") || key === "content-type"))) as Record<string, string> });
    response.end(); return;
  }
  if (["GET", "HEAD"].includes(request.method ?? "") && request.url?.startsWith("/assets/instructional-images/")) {
    const key = decodeURIComponent(request.url.slice("/assets/".length)), image = imageObjects.get(key);
    if (!image) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { ...image.headers, "Content-Length": image.bytes.length });
    response.end(request.method === "HEAD" ? undefined : image.bytes); return;
  }
  if (request.method === "OPTIONS" || request.method === "PUT") { request.resume(); response.end(); return; }
  if (request.method === "GET" && request.url?.startsWith("/assets/")) {
    response.setHeader("Content-Type", "image/png");
    response.end(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64")); return;
  }
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(request.url === "/stream" ? { uid: `fixture-${randomUUID()}`, uploadURL: `${mediaOrigin}/upload`, maxDurationSeconds: 3600 } : { status: "ready" }));
});
let mediaOrigin = "";
const output: string[] = [];
const interactive = process.argv.includes("--dev");
const lan = interactive && process.argv.includes("--lan");
const infoCards = process.argv.includes("--info-cards");
const liveProgress = process.argv.includes("--group-progress-live");
const groupProgress = process.argv.includes("--group-progress");
const completeLoading = process.argv.includes("--complete-loading");
const mediaReview = process.argv.includes("--group-media");
const groupExperiences = mediaReview || process.argv.includes("--group-experiences") || groupProgress || liveProgress;
const optimized = process.argv.includes("--optimized");
const visualReview = process.argv.includes("--visual-review");
if (visualReview && (!interactive || !lan || process.argv.includes("--live-info-media"))) throw new Error("Visual review requires --dev --lan and local providers only.");
// Opt-in provider checks still own a disposable database. Never forward an
// environment database URI; only the provider credentials are used live.
const liveInfoMedia = process.argv.includes("--live-info-media");
if (optimized && (lan || liveInfoMedia)) throw new Error("Optimized fixtures are loopback-only with mocked providers. Use normal --dev --lan for phone review.");
if (liveInfoMedia && (interactive || !process.argv.includes("info-cards-live-media.browser.ts")
  || process.argv.slice(2).some(arg => arg.endsWith(".browser.ts") && arg !== "info-cards-live-media.browser.ts"))) {
  throw new Error("Live providers are restricted to the explicitly authorised, self-cleaning info-cards-live-media.browser.ts check.");
}
if (liveInfoMedia) loadEnvConfig(process.cwd(), true);
const mode = interactive ? "dev" : "test";
async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), new Promise<void>((resolve) => setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 5000))]);
}
async function main() {
try {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const uri = mongo.getUri(), database = `switchplay_phase2_browser_${randomUUID().replaceAll("-", "")}`;
  client = await new MongoClient(uri).connect(); const db = client.db(database); await db.createCollection("instructionalImageAllocations"); await createFoundationIndexes(db); await createInfoCardIndexes(db);
  await createVisualLearningRecordIndexes(db);
  // Full-app My Decks always reads Group entries, including when none are seeded.
  await createGroupExperienceIndexes(db);
  const now = new Date(); const userId = new ObjectId();
  await db.collection("users").insertMany([userId, new ObjectId()].map((_id, index) => ({ _id, email: `phase2-${index}@example.invalid`, username: index === 0 ? "phase2" : "other", passwordHash: bcrypt.hashSync("local-test-only", 4),
    decksData: [], cardsData: [], sharedDeckData: [{ parked: "preserve exactly" }], createdAt: now, updatedAt: now })));
  let personalReview: { deckId: string; emptyCardId: string; mixedCardId: string; inheritedDeckId: string; inheritedCardId: string } | undefined;
  if (infoCards) {
    const repo = new InfoCardRepository(db, client), other = (await db.collection("users").findOne({ username: "other" }))!._id.toString();
    for (const [actor, suffix] of [[userId.toHexString(), "owner"], [other, "other"]]) {
      await repo.createSeries(actor, `demo-series-${suffix}`, "Basics");
      for (const intent of ["public", "private"] as const) {
        const id = `demo-${suffix}-${intent}`;
        await repo.create(actor, id);
        await repo.save(actor, id, 0, { title: intent === "public" ? "Signs" : "Private tip", body: "Keep the sign attached to its number.\n\nCheck each step before continuing.", seriesId: `demo-series-${suffix}`, mediaItem: null }, intent);
        await repo.publish(actor, id, 1);
      }
    }
    if (interactive) {
      // Review-only content in this runner's OWN memory replica set. Never
      // seed the normal development database, even when .env.local uses Atlas.
      const main = new CardRepository(db, client), actor = userId.toHexString();
      const makeCard = async (title: string, shared = false) => {
        const card = await main.createCardDraft(actor, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]),
          intro: { title, description: "Open the corner pouch. The working Card stays mounted while you make private notes.", mediaItem: null },
          ...(shared ? { infoCardIds: ["demo-owner-public", "demo-other-public"] } : {}) }, "public");
        await main.publishCard(actor, card.cardTemplateId, 0); return card.cardTemplateId;
      };
      const makeDeck = async (title: string, ids: string[]) => {
        const deck = await main.createDeckDraft(actor, { ...createDefaultDeckContent([]), title,
          cards: ids.map(cardTemplateId => ({ cardTemplateId })) }, "public");
        await main.publishDeck(actor, deck.deckTemplateId, 0); await main.ensureDeckData(actor, deck.deckTemplateId, 1);
        return deck.deckTemplateId;
      };
      const emptyCardId = await makeCard("Empty pouch"), mixedCardId = await makeCard("Mixed pouch", true);
      const deckId = await makeDeck("Personal Info Cards review", [emptyCardId, mixedCardId]);
      for (const [index, maths] of [false, true].entries()) {
        const id = randomUUID(), context = { deckTemplateId: deckId, version: 1, personalInfoRevision: index };
        await repo.createPersonal(actor, id, mixedCardId, context);
        await repo.save(actor, id, 0, { title: maths ? "My algebra" : "My reminder", seriesId: "demo-series-owner", mediaItem: null,
          body: maths ? "Keep $x^2 + 1$ together." : "This note belongs only to phase2.\n\nEdit or remove it from the three-dot menu.",
          ...(maths ? { bodyFormat: "latex-v1" as const } : {}) }, "private");
        await repo.savePersonal(actor, id, 1, context);
      }
      const source = { cardTemplateId: mixedCardId, version: 1 }, inheritedCardId = randomUUID();
      const original = (await main.getCardVersion(mixedCardId, 1))!.content, stepIds = [randomUUID(), randomUUID(), randomUUID()];
      await main.createCardFork(actor, { source, cardTemplateId: inheritedCardId, stepIds, context: { kind: "library" }, visibility: "public",
        content: { ...forkCardContent(original, source, stepIds), intro: { ...original.intro, title: "Adapted pouch" } } });
      await main.publishCard(actor, inheritedCardId, 0);
      const inheritedDeckId = await makeDeck("Inherited personal notes review", [inheritedCardId]);
      personalReview = { deckId, emptyCardId, mixedCardId, inheritedDeckId, inheritedCardId };
    }
  }
  const groupReview = groupExperiences ? await seedGroupReview(client, database, userId.toHexString(), (await db.collection("users").findOne({ username: "other" }))!._id.toString(), completeLoading ? 6 : 3) : undefined;
  const liveProgressReview = liveProgress ? await seedLiveGroupProgress(new CardRepository(db, client), uri, userId.toHexString(),
    (await db.collection("users").findOne({ username: "other" }))!._id.toString(), groupReview?.cardIds ?? []) : undefined;
  const frameworkFixture = liveProgressReview ? resolve(`phase2-test-results/framework-${mode}.ts`) : undefined;
  if (liveProgressReview && frameworkFixture) {
    await mkdir("phase2-test-results", { recursive: true });
    await writeFile(frameworkFixture, `export * from "../src/lib/frameworks/configurationContracts";\nimport { createFrameworkAccess } from "../src/lib/frameworks/configurationContracts";\nexport const { getFrameworks, getFramework, getFrameworkItem } = createFrameworkAccess(${JSON.stringify(liveProgressReview.frameworks)});\n`);
  }
  media.listen(visualReview ? Number(process.env.PHASE2_REVIEW_MEDIA_PORT ?? 0) : 0, visualReview ? "0.0.0.0" : "127.0.0.1"); await once(media, "listening"); const address = media.address();
  if (!address || typeof address === "string") throw new Error("Missing media fixture port");
  mediaOrigin = `http://127.0.0.1:${address.port}`;
  const probe = createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening"); const appAddress = probe.address();
  if (!appAddress || typeof appAddress === "string") throw new Error("Missing app port");
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  const appPort = Number(process.env.PHASE2_APP_PORT ?? (lan ? process.env.SWITCHPLAY_REVIEW_PORT ?? "4181" : appAddress.port));
  if (!Number.isSafeInteger(appPort) || appPort < 1024 || appPort > 65535) throw new Error("Invalid review port");
  // The API test transport honours Secure cookies on localhost. Keep the real
  // production cookie policy in optimized tests; never loosen auth for fixtures.
  const baseURL = `http://${optimized ? "localhost" : "127.0.0.1"}:${appPort}`;
  const lanIPs = Object.values(networkInterfaces()).flatMap(rows => rows ?? []).filter(row => row.family === "IPv4" && !row.internal).map(row => row.address);
  const mediaReviewData = mediaReview && groupReview ? await seedMediaReview(client, database, groupReview, mediaFixture, `http://${lan ? lanIPs[0] : "127.0.0.1"}:${appPort}/__phase7-media/assets`) : undefined;
  if (completeLoading && groupReview && mediaReview) {
    for (const cardId of groupReview.cardIds.slice(1)) await seedMediaReview(client, database, { ...groupReview, cardIds: [cardId] }, mediaFixture, `http://${lan ? lanIPs[0] : "127.0.0.1"}:${appPort}/__phase7-media/assets`, false);
    const groupRepo = new GroupExperienceRepository(new CardRepository(db, client)), notes = new GroupReflectionRepository(groupRepo);
    for (const [i, cardTemplateId] of groupReview.cardIds.entries()) {
      await db.collection("users").updateOne({ _id: new ObjectId(groupReview.otherId) }, { $set: { "cardsData.$[card].reflection": `Personal reflection for Card ${i + 1}` } }, { arrayFilters: [{ "card.cardTemplateId": cardTemplateId }] });
      await notes.save(groupReview.otherId, groupReview.experienceId, cardTemplateId, { operationId: randomUUID(), accessEpoch: 0, expectedRevision: 0, text: `Player reflection for Card ${i + 1}` });
      await saveCollectiveReflection(groupRepo, groupReview.adminId, groupReview.experienceId, cardTemplateId, { operationId: randomUUID(), accessEpoch: 0, expectedRevision: 0, text: `Collective reflection for Card ${i + 1}` });
    }
  }
  const reflectionReview = process.argv.includes("--group-reflections") && groupReview ? await seedReflectionReview(client, database, groupReview) : undefined;
  const reviewHost = networkInterfaces().en0?.find(row => row.family === "IPv4" && !row.internal)?.address ?? lanIPs.find(ip => ip.startsWith("192.168.") || ip.startsWith("10."));
  if (visualReview && !reviewHost) throw new Error("No local Wi-Fi address is available for phone review.");
  const reviewMediaOrigin = visualReview ? `http://${reviewHost}:${address.port}` : undefined;
  const deckPath = visualReview ? await seedVisualReview(db, client, userId.toHexString(), mediaOrigin, uri) : undefined;
  const entryPath = visualReview ? `/review/${randomUUID()}` : undefined;
  if (visualReview) reviewHandler = await createVisualReviewServer({ appOrigin: baseURL, appPort, hosts: ["localhost", "127.0.0.1", ...lanIPs], actor: userId.toHexString(), entryPath: entryPath!, deckPath: deckPath! });
  const env = { ...process.env, SWITCHPLAY_DATABASE_MODE: "disposable", MONGODB_URI: uri, MONGODB_DB: database, SESSION_SECRET: "local-phase2-browser-test-secret-only",
    SWITCHPLAY_REVIEW_ORIGINS: ["127.0.0.1", ...(lan ? lanIPs : [])].join(","),
    NEXT_PUBLIC_PHASE2_VISUAL_REVIEW: visualReview ? "1" : "0", NEXT_PUBLIC_PHASE2_VISUAL_REVIEW_MEDIA_ORIGIN: reviewMediaOrigin ?? "",
    PHASE2_BROWSER_TEST: "1", PHASE2_INTERACTIVE: interactive ? "1" : "0", PHASE2_OPTIMIZED: optimized ? "1" : "0", NEXT_PUBLIC_PHASE2_MOCK_MEDIA: "1", NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: "0", INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL: "0", PHASE2_BASE_URL: baseURL, PHASE2_USER_ID: userId.toHexString(), PHASE2_MEDIA_FIXTURE_ORIGIN: mediaOrigin, PHASE2_MEDIA_REVIEW: mediaReview ? "1" : "0", ...(mediaReviewData ? { PHASE7_MEDIA_REVIEW: JSON.stringify(mediaReviewData) } : {}),
    CLOUDFLARE_ACCOUNT_ID: "local-fixture", CLOUDFLARE_R2_ACCESS_KEY_ID: "local-fixture", CLOUDFLARE_R2_SECRET_ACCESS_KEY: "local-fixture",
    CLOUDFLARE_R2_BUCKET_NAME: "local-fixture", CLOUDFLARE_R2_PUBLIC_BASE_URL: `${mediaOrigin}/assets`,
    CLOUDFLARE_R2_USER_DATA_BUCKET_NAME: "local-fixture", CLOUDFLARE_R2_USER_DATA_PUBLIC_BASE_URL: mediaReview ? `http://${lan ? lanIPs[0] : "127.0.0.1"}:${appPort}/__phase7-media/assets` : `${mediaOrigin}/assets`,
    CLOUDFLARE_STREAM_API_TOKEN: "local-fixture", PHASE2_GROUP_FIXTURE: JSON.stringify(groupReview ?? null), ...(frameworkFixture ? { PHASE2_FRAMEWORK_FIXTURE_FILE: frameworkFixture, PHASE5_LIVE_PROGRESS: JSON.stringify(liveProgressReview) } : {}) };
  if (liveInfoMedia) Object.assign(env, {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith("CLOUDFLARE_"))),
    PHASE2_LIVE_INFO_MEDIA: "1", NEXT_PUBLIC_PHASE2_MOCK_MEDIA: "0", NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: "1",
    INFO_CARDS_PRIVATE_MEDIA_VERIFIED: "0", INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL: "1", PHASE2_MEDIA_FIXTURE_ORIGIN: "",
  });
  await mkdir("phase2-test-results", { recursive: true });
  await writeFile(`phase2-test-results/tsconfig-${mode}.json`, JSON.stringify({ extends: "../tsconfig.json", compilerOptions: { baseUrl: ".." },
    include: ["../next-env.d.ts", "../src/**/*.ts", "../src/**/*.tsx", optimized ? "../.next-phase2-optimized/types/**/*.ts"
      : `../${env.PHASE2_INTERACTIVE === "1" ? ".next-phase2" : ".next-phase2-test"}/dev/types/**/*.ts`] }, null, 2));
  if (optimized) {
    // Measure/review actual optimized React, not JSX development stack capture.
    // Build without any database connection; only the local runtime receives
    // this harness's disposable URI. Public media flags remain fixture mocks.
    app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build", ...(frameworkFixture || mediaReview ? ["--webpack"] : [])], {
      env: { ...env, MONGODB_URI: "", MONGODB_DB: mediaReview ? database : "" }, stdio: ["ignore", "pipe", "pipe"],
    });
    app.stdout!.on("data", value => { output.push(String(value)); if (interactive) process.stdout.write(value); });
    app.stderr!.on("data", value => { output.push(String(value)); if (interactive) process.stderr.write(value); });
    const [code] = await once(app, "exit");
    if (code !== 0) throw new Error("Optimized disposable build failed; see the fixture server log.");
  }
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", optimized ? "start" : "dev", ...(!optimized && (frameworkFixture || mediaReview) ? ["--webpack"] : []), "--hostname", lan ? "0.0.0.0" : "127.0.0.1", "--port", String(appPort)], { env, stdio: ["ignore", "pipe", "pipe"] });
  app.stdout!.on("data", (value) => { output.push(String(value)); if (interactive) process.stdout.write(value); });
  app.stderr!.on("data", (value) => { output.push(String(value)); if (interactive) process.stderr.write(value); });
  const deadline = Date.now() + 90_000;
  while (true) {
    if (app.exitCode !== null) throw new Error("Local Next server exited");
    try { const response = await fetch(`${baseURL}/api/auth/me`); if (response.status === 200 || response.status === 401) break; } catch {}
    if (Date.now() >= deadline) throw new Error("Local Next server did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (process.argv.includes("--dev")) {
    const reviewURL = visualReview ? `${reviewMediaOrigin}${entryPath}` : undefined;
    const phoneURLs = lan ? Object.values(networkInterfaces()).flatMap(rows => rows ?? []).filter(row => row.family === "IPv4" && !row.internal).map(row => `http://${row.address}:${appPort}/${groupExperiences ? "decks" : "library?tab=info-cards"}`) : [];
    await writeFile("phase2-test-results/review-server.json", JSON.stringify({ pid: process.pid, appPid: app.pid, baseURL, phoneURLs, database, optimized, infoCards, personalReview, groupReview, liveProgressReview, mediaReviewData, reflectionReview, reviewURL, deckPath, mediaPort: address.port }, null, 2));
    if (visualReview) console.log(`iPhone review: ${reviewURL}\nFour published demonstration cards are ready. This link signs into the disposable learner and opens the real deck.\nProgress lasts until this runner stops. Local silent MP4 samples do not validate Cloudflare HLS. PID ${process.pid}`);
    else console.log(`Disposable app: ${baseURL}/${groupExperiences ? "decks" : "library?tab=info-cards"}\n${phoneURLs.map(url => `Phone: ${url}`).join("\n")}\nSign in: phase2 / local-test-only (or ${liveProgressReview?.followerLogin ?? mediaReviewData?.follower ?? "other"} / local-test-only)\nInfo media remains gated. Main-card media services are mocked. Data is discarded when stopped. Press Ctrl+C to stop. PID ${process.pid}`);
    if (!visualReview && mediaReviewData) console.log(`Media review: ${baseURL}/decks?openExperience=${mediaReviewData.experienceId}\nPersonal: ${baseURL}/decks?openDeck=${mediaReviewData.personalDeckId}\nFollower: Aoife Kelly / local-test-only\nImages and uploads use the local mock provider; live Stream video is not enabled.`);
    if (!visualReview && liveProgressReview) console.log(`Live Group Progress: ${baseURL}/group-experiences/${liveProgressReview.experienceId}/progress?framework=${liveProgressReview.frameworkId}`);
    if (!visualReview && personalReview) console.log(`Personal review: ${baseURL}/decks?openDeck=${personalReview.deckId}\nInherited review: ${baseURL}/decks?openDeck=${personalReview.inheritedDeckId}`);
    if (!visualReview && groupReview) console.log(`Group review: ${baseURL}/decks?openExperience=${groupReview.experienceId}\nAdmin: phase2 / local-test-only\nFollower: ${liveProgressReview?.followerLogin ?? mediaReviewData?.follower ?? "other"} / local-test-only\nPeer-visible Galway U18, peer-hidden Galway development, Empty squad and No Cards yet are disposable fixtures.`);
    await new Promise<void>((resolve) => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  } else {
    if (groupProgress) {
      const progress = await seedGroupProgressReview(new CardRepository(db, client), uri, userId.toHexString(),
        (await db.collection("users").findOne({ username: "other" }))!._id.toString());
      progressPreview = await startGroupProgressPreview(progress.data, baseURL);
      Object.assign(env, { PHASE5_PROGRESS_PREVIEW_URL: progressPreview.baseURL, PHASE5_PROGRESS_EXPERIENCE: progress.data.experienceId });
    }
    const runner = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.phase2.config.ts", ...process.argv.slice(2).filter(arg => !["--info-cards", "--lan", "--live-info-media", "--group-experiences", "--group-progress", "--group-progress-live", "--group-media", "--optimized", "--complete-loading", "--visuals"].includes(arg))], { env, stdio: "inherit" });
    const [code] = await once(runner, "exit"); process.exitCode = typeof code === "number" ? code : 1;
  }
  await writeFile(`phase2-test-results/server-${mode}.log`, output.join(""));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Phase 2 browser runner failed"); process.exitCode = 1;
} finally {
  await mkdir("phase2-test-results", { recursive: true });
  await writeFile(`phase2-test-results/server-${mode}.log`, output.join(""));
  if (progressPreview) await new Promise<void>((resolve, reject) => progressPreview!.server.close(error => error ? reject(error) : resolve()));
  await stop(app); await client?.close(); await mongo?.stop();
  await new Promise<void>((resolve) => media.close(() => resolve()));
}

}
void main();
