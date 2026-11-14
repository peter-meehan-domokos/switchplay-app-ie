import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { createFoundationIndexes } from "../src/lib/cards/repository";
import { createInfoCardIndexes, InfoCardRepository } from "../src/lib/infoCards/repository";
import { networkInterfaces } from "node:os";
import { preparePuckleMembership } from "./prepare-puckle-membership";
import { loadEnvConfig } from "@next/env";

// This runner never uses an environment URI. It owns and destroys its replica set.
let mongo: MongoMemoryReplSet | undefined, client: MongoClient | undefined, app: ChildProcess | undefined;
const capturedEmails: unknown[] = [];
const media = createServer((request, response) => {
  if (request.url === "/emails" && request.method === "GET") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(capturedEmails)); return; }
  if (request.url === "/email" && request.method === "POST") {
    let body = ""; request.on("data", chunk => { body += chunk; });
    request.on("end", () => { const message = JSON.parse(body); capturedEmails.push(message);
      // Manual review only: the code is otherwise invisible to a phone. Local fixture mail, never sent anywhere.
      if (interactive) console.log(`[captured email] to ${String(message.to)} | ${message.subject}\n${message.text}\n`); response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ id: "fixture-accepted" })); }); return;
  }
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "PUT,POST,GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "*");
  if (request.method === "OPTIONS" || request.method === "PUT") { request.resume(); response.end(); return; }
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(request.url === "/stream" ? { uid: `fixture-${randomUUID()}`, uploadURL: `${mediaOrigin}/upload`, maxDurationSeconds: 3600 } : { status: "ready" }));
});
let mediaOrigin = "";
const output: string[] = [];
const interactive = process.argv.includes("--dev");
const lan = interactive && process.argv.includes("--lan");
const infoCards = process.argv.includes("--info-cards");
// Opt-in provider checks still own a disposable database. Never forward an
// environment database URI; only the provider credentials are used live.
const liveInfoMedia = process.argv.includes("--live-info-media");
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
  client = await new MongoClient(uri).connect(); const db = client.db(database); await createFoundationIndexes(db); await createInfoCardIndexes(db); await preparePuckleMembership(db);
  const now = new Date(); const userId = new ObjectId();
  await db.collection("users").insertMany([userId, new ObjectId()].map((_id, index) => ({ _id, email: `phase2-${index}@example.invalid`, username: index === 0 ? "phase2" : "other", passwordHash: bcrypt.hashSync("local-test-only", 4),
    permissions: { publicPublishing: true }, decksData: [], cardsData: [], sharedDeckData: [{ parked: "preserve exactly" }], createdAt: now, updatedAt: now })));
  // Manual review only: an account that starts WITHOUT public-publishing approval, so denial can be tested without editing the database.
  if (interactive) await db.collection("users").insertOne({ _id: new ObjectId(), email: "phase2-unapproved@example.invalid", username: "unapproved", passwordHash: bcrypt.hashSync("local-test-only", 4), permissions: { publicPublishing: false }, decksData: [], cardsData: [], sharedDeckData: [], createdAt: now, updatedAt: now });
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
  }
  media.listen(0, "127.0.0.1"); await once(media, "listening"); const address = media.address();
  if (!address || typeof address === "string") throw new Error("Missing media fixture port");
  mediaOrigin = `http://127.0.0.1:${address.port}`;
  const probe = createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening"); const appAddress = probe.address();
  if (!appAddress || typeof appAddress === "string") throw new Error("Missing app port");
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  const appPort = Number(process.env.PHASE2_APP_PORT ?? (lan ? process.env.SWITCHPLAY_REVIEW_PORT ?? "4181" : appAddress.port));
  if (!Number.isSafeInteger(appPort) || appPort < 1024 || appPort > 65535) throw new Error("Invalid review port");
  const baseURL = `http://127.0.0.1:${appPort}`;
  const lanIPs = Object.values(networkInterfaces()).flatMap(rows => rows ?? []).filter(row => row.family === "IPv4" && !row.internal).map(row => row.address);
  const env = { ...process.env, SWITCHPLAY_DATABASE_MODE: "disposable", MONGODB_URI: uri, MONGODB_DB: database, SESSION_SECRET: "local-phase2-browser-test-secret-only",
    SWITCHPLAY_REVIEW_ORIGINS: ["127.0.0.1", "localhost", "*.localhost", ...(lan ? lanIPs : [])].join(","),
    PHASE2_BROWSER_TEST: "1", PHASE2_INTERACTIVE: interactive ? "1" : "0", NEXT_PUBLIC_PHASE2_MOCK_MEDIA: "1", NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: "0", INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL: "0", PHASE2_BASE_URL: baseURL, PHASE2_USER_ID: userId.toHexString(), PHASE2_MEDIA_FIXTURE_ORIGIN: mediaOrigin,
    CLOUDFLARE_ACCOUNT_ID: "local-fixture", CLOUDFLARE_R2_ACCESS_KEY_ID: "local-fixture", CLOUDFLARE_R2_SECRET_ACCESS_KEY: "local-fixture",
    CLOUDFLARE_R2_BUCKET_NAME: "local-fixture", CLOUDFLARE_R2_PUBLIC_BASE_URL: `${mediaOrigin}/assets`,
    CLOUDFLARE_R2_USER_DATA_BUCKET_NAME: "local-fixture", CLOUDFLARE_R2_USER_DATA_PUBLIC_BASE_URL: `${mediaOrigin}/assets`,
    CLOUDFLARE_STREAM_API_TOKEN: "local-fixture",
    ACCOUNT_EMAIL_SECRET: "local-only-email-secret-at-least-32-bytes", ACCOUNT_EMAIL_TEST_ENDPOINT: `${mediaOrigin}/email`,
    ACCOUNT_EMAIL_PUCKLE_ORIGIN: baseURL, ACCOUNT_EMAIL_PUCKLE_FROM: "Puckle fixture <security@example.invalid>",
    PUCKLE_FOUNDER_EMAIL: "founder@example.invalid", ACCOUNT_TRUST_PROXY_IP: "1", // tests/reviewers present distinct forwarded addresses; unset means one shared bucket
    ...(lan ? { ACCOUNT_EMAIL_LAN_REVIEW: "1", ACCOUNT_EMAIL_PUCKLE_ALLOWED_ORIGINS: lanIPs.filter(ip => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)).map(ip => `http://${ip}:${appPort}`).join(",") } : {}),
    ACCOUNT_EMAIL_SWITCHPLAY_ORIGIN: baseURL, ACCOUNT_EMAIL_SWITCHPLAY_FROM: "Switchplay fixture <security@example.invalid>",
    ACCOUNT_EMAIL_STRAT17_ORIGIN: baseURL, ACCOUNT_EMAIL_STRAT17_FROM: "Strat17 fixture <security@example.invalid>",
  };
  if (liveInfoMedia) Object.assign(env, {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith("CLOUDFLARE_"))),
    PHASE2_LIVE_INFO_MEDIA: "1", NEXT_PUBLIC_PHASE2_MOCK_MEDIA: "0", NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA: "1",
    INFO_CARDS_PRIVATE_MEDIA_VERIFIED: "0", INFO_CARDS_ALLOW_PUBLIC_IMAGE_TRIAL: "1", PHASE2_MEDIA_FIXTURE_ORIGIN: "",
  });
  await mkdir("phase2-test-results", { recursive: true });
  await writeFile(`phase2-test-results/tsconfig-${mode}.json`, JSON.stringify({ extends: "../tsconfig.json",
    include: ["../next-env.d.ts", "../src/**/*.ts", "../src/**/*.tsx", `../${env.PHASE2_INTERACTIVE === "1" ? ".next-phase2" : ".next-phase2-test"}/dev/types/**/*.ts`] }, null, 2));
  // Next rewrites the public-site routes through a request URL it normalises to "localhost". Binding by that
  // name (resolved to IPv4, so still loopback-only) keeps those rewrites internal; "127.0.0.1" makes them loop.
  const appEnv = { ...env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --dns-result-order=ipv4first`.trim() };
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", lan ? "0.0.0.0" : "localhost", "--port", String(appPort)], { env: appEnv, stdio: ["ignore", "pipe", "pipe"] });
  app.stdout!.on("data", (value) => { output.push(String(value)); if (interactive) process.stdout.write(value); });
  app.stderr!.on("data", (value) => { output.push(String(value)); if (interactive) process.stderr.write(value); });
  const deadline = Date.now() + 90_000;
  while (true) {
    if (app.exitCode !== null) throw new Error("Local Next server exited");
    try { const response = await fetch(`${baseURL}/api/auth/me`); if (response.status < 500) break; } catch {}
    if (Date.now() >= deadline) throw new Error("Local Next server did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (process.argv.includes("--dev")) {
    const phoneURLs = lan ? Object.values(networkInterfaces()).flatMap(rows => rows ?? []).filter(row => row.family === "IPv4" && !row.internal).map(row => `http://${row.address}:${appPort}/library?tab=info-cards`) : [];
    await writeFile("phase2-test-results/review-server.json", JSON.stringify({ pid: process.pid, appPid: app.pid, baseURL, phoneURLs, database, mongoUri: uri, infoCards }, null, 2));
    console.log(`Disposable app: ${baseURL}/library?tab=info-cards\n${phoneURLs.map(url => `Phone: ${url}`).join("\n")}\nSign in: phase2 / local-test-only (or other / local-test-only)\nInfo media remains gated. Main-card media services are mocked. Data is discarded when stopped. Press Ctrl+C to stop. PID ${process.pid}`);
    await new Promise<void>((resolve) => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  } else {
    const runner = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.phase2.config.ts", ...process.argv.slice(2).filter(arg => !["--info-cards", "--lan", "--live-info-media"].includes(arg))], { env, stdio: "inherit" });
    const [code] = await once(runner, "exit"); process.exitCode = typeof code === "number" ? code : 1;
  }
  if (process.argv.includes("membership-security.browser.ts")) {
    for (const message of capturedEmails as { text: string }[]) {
      for (const match of message.text.matchAll(/#([A-Za-z0-9_-]{43})/g)) {
        if (output.join("").includes(match[1])) throw new Error("Security test: action secret appeared in server logs");
      }
    }
  }
  await writeFile(`phase2-test-results/server-${mode}.log`, output.join(""));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Phase 2 browser runner failed"); process.exitCode = 1;
} finally {
  await mkdir("phase2-test-results", { recursive: true });
  await writeFile(`phase2-test-results/server-${mode}.log`, output.join(""));
  await stop(app); await client?.close(); await mongo?.stop();
  await new Promise<void>((resolve) => media.close(() => resolve()));
}

}
void main();
