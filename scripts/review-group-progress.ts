import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { networkInterfaces } from "node:os";
import { hashSync } from "bcryptjs";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { seedGroupProgressReview, startGroupProgressPreview } from "../tests/helpers/groupProgressReview";

// A companion preview, leaving the existing phone-review app/database alive.
// Like test-phase2, this owns its Mongo URI; .env/Atlas are never consulted.
async function main() {
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
const client = await new MongoClient(mongo.getUri()).connect();
let preview: Awaited<ReturnType<typeof startGroupProgressPreview>> | undefined;
try {
  const review = JSON.parse(await readFile("phase2-test-results/review-server.json", "utf8")) as { baseURL: string };
  const database = `switchplay_phase2_progress_${randomUUID().replaceAll("-", "")}`, db = client.db(database);
  await createFoundationIndexes(db);
  const actors = [new ObjectId(), new ObjectId()], now = new Date();
  await db.collection("users").insertMany(actors.map((_id, i) => ({ _id, username: i ? "other" : "phase2",
    email: `preview-${i}@example.invalid`, passwordHash: hashSync("local-test-only", 4), cardsData: [], decksData: [], createdAt: now, updatedAt: now })));
  const fixture = await seedGroupProgressReview(new CardRepository(db, client), mongo.getUri(), actors[0].toHexString(), actors[1].toHexString());
  const port = Number(process.env.GROUP_PROGRESS_PREVIEW_PORT ?? "4182");
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw Error("Invalid preview port");
  preview = await startGroupProgressPreview(fixture.data, review.baseURL, "0.0.0.0", port);
  const phoneURLs = Object.values(networkInterfaces()).flatMap(rows => rows ?? []).filter(row => row.family === "IPv4" && !row.internal)
    .map(row => `http://${row.address}:${preview!.port}/__group-progress-preview`);
  await mkdir("phase2-test-results", { recursive: true });
  await writeFile("phase2-test-results/group-progress-review.json", JSON.stringify({ pid: process.pid, database,
    baseURL: preview.baseURL, url: `${preview.baseURL}/__group-progress-preview`, phoneURLs,
    styleBaseURL: review.baseURL, experienceId: fixture.data.experienceId }, null, 2));
  console.log(`Fixture-only, read-only Group Progress: ${preview.baseURL}/__group-progress-preview\n${phoneURLs.join("\n")}\nNo sign-in needed: synthetic fixture data only. Existing Group review app remains at ${review.baseURL}.\nStop with Ctrl+C or SIGTERM PID ${process.pid}.`);
  await Promise.race([once(process, "SIGINT"), once(process, "SIGTERM")]);
} finally {
  if (preview) await new Promise<void>((resolve, reject) => preview!.server.close(error => error ? reject(error) : resolve()));
  await client.close(); await mongo.stop();
}
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
