import type { IncomingMessage, ServerResponse } from "node:http";
import { deflateSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { ObjectId, type MongoClient } from "mongodb";
import { CardRepository } from "../../src/lib/cards/repository";
import { GroupExperienceRepository } from "../../src/lib/groupExperiences/repository";
import { createGroupMediaIndexes } from "../../src/lib/groupExperiences/media/indexes";
import type { GroupMediaRecord } from "../../src/lib/groupExperiences/media/model";
import type { seedGroupReview } from "./groupReviewFixture";

function png(index: number) {
  const w = 480, h = 320, pixels = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * (w * 4 + 1) + 1 + x * 4;
    const line = x % 120 < 3 || y % 80 < 3, ball = (x - 240) ** 2 + (y - 160) ** 2 < (45 + index % 4 * 6) ** 2;
    pixels[p] = ball ? 225 : line ? 215 : 40 + index * 17 % 100; pixels[p + 1] = ball ? 115 : line ? 220 : 75 + index * 23 % 90;
    pixels[p + 2] = ball ? 35 : line ? 225 : 90 + index * 13 % 100; pixels[p + 3] = 255;
  }
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) { c ^= v; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, bytes: Buffer) => { const b = Buffer.concat([Buffer.from(type), bytes]), size = Buffer.alloc(4), sum = Buffer.alloc(4); size.writeUInt32BE(bytes.length); sum.writeUInt32BE(crc(b)); return Buffer.concat([size, b, sum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(w); header.writeUInt32BE(h, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}
export function createMediaReviewHandler() {
  const assets = new Map<string, { bytes: Buffer; contentType: string }>(), records = new Map<string, GroupMediaRecord>();
  const add = (key: string, index: number) => assets.set(key, { bytes: png(index), contentType: "image/png" });
  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", "http://fixture.invalid"), path = url.pathname;
    if (!/^\/(group|assets|upload)\//.test(path)) return false;
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk)); const body = Buffer.concat(chunks);
    response.setHeader("Cache-Control", "no-store"); response.setHeader("Content-Type", "application/json");
    if (path === "/group/allocate") {
      const row = JSON.parse(body.toString()) as GroupMediaRecord; records.set(row.contributionId, row);
      response.end(JSON.stringify({ provider: row.kind === "image" ? "r2" : "stream", assetId: row.kind === "image" ? `group-media/${row.contributionId}.png` : row.contributionId.replaceAll("-", ""), ...(row.kind === "image" ? { bucket: "disposable-group-media" } : {}) })); return true;
    }
    if (path === "/group/status") {
      const row = JSON.parse(body.toString()) as GroupMediaRecord, stored = records.get(row.contributionId);
      if (!stored || ["authorUserId", "cardTemplateId", "experienceId"].some(k => stored[k as keyof GroupMediaRecord] !== row[k as keyof GroupMediaRecord])) response.statusCode = 403;
      response.end(JSON.stringify({ status: assets.has(row.contributionId) ? "ready" : "processing" })); return true;
    }
    if (path.startsWith("/group/remove/")) { assets.delete(path.slice(14)); response.end("{}"); return true; }
    if (path.startsWith("/upload/")) {
      const id = path.slice(8) === "personal" ? url.searchParams.get("key")! : path.slice(8);
      assets.set(id, { bytes: body, contentType: String(request.headers["content-type"] ?? "image/png") }); response.end("{}"); return true;
    }
    const asset = assets.get(decodeURIComponent(path.slice(8)));
    if (!asset) { response.statusCode = 404; response.end("{}"); return true; }
    response.setHeader("Content-Type", asset.contentType); response.end(asset.bytes); return true;
  }
  return { handle, add, records, assets };
}
export async function seedMediaReview(client: MongoClient, database: string, group: Awaited<ReturnType<typeof seedGroupReview>>, fixture: ReturnType<typeof createMediaReviewHandler>, publicBase: string) {
  if (!/^switchplay_phase2_browser_/.test(database)) throw Error("Disposable media fixture only");
  const cards = new CardRepository(client.db(database), client), groups = new GroupExperienceRepository(cards);
  await createGroupMediaIndexes(cards.db);
  await cards.ensureDeckData(group.adminId, group.deckId, 1);
  await cards.ensureDeckData(group.otherId, group.deckId, 1);
  await cards.users().updateOne({ _id: new ObjectId(group.otherId) }, { $set: { username: "Aoife Kelly" } });
  const cardId = group.cardIds[0]; let index = 0;
  for (const actor of [group.otherId, group.adminId]) {
    const personal = Array.from({ length: 2 }, (_, n) => {
      const id = randomUUID(), key = `user-cards/${actor}/${cardId}/${id}.png`; fixture.add(key, index++);
      return { id: `image-${id}`, mediaType: "image", provider: "cloudflare-r2", assetId: key, src: `${publicBase}/${key}`, description: `Training photo ${n + 1}`, uploadedAt: new Date(Date.now() - (12 - n) * 86400000).toISOString() };
    });
    await cards.users().updateOne({ _id: new ObjectId(actor), "cardsData.cardTemplateId": cardId }, { $set: { "cardsData.$.mediaItems": personal } });
    const count = actor === group.adminId ? 5 : 4;
    for (let n = 0; n < count + (actor === group.adminId ? 1 : 2); n++) {
      const origin = n < count ? group.experienceId : group.secondId, contributionId = randomUUID();
      const row: GroupMediaRecord = { contributionId, operationId: randomUUID(), operationHash: "disposable-seed", authorUserId: actor, experienceId: origin,
        cardTemplateId: cardId, deckTemplateId: group.deckId, accessEpoch: 0, version: 1, adoptionRevision: 0, kind: "image", contentType: "image/png", size: png(index).length,
        state: "attached", groupVisible: !(actor === group.otherId && n === 0), revision: 2, allocation: "ready", asset: { provider: "r2", assetId: `group-media/${contributionId}.png`, bucket: "disposable-group-media" },
        createdAt: new Date(Date.now() - (10 - n) * 86400000), uploadedAt: new Date(Date.now() - (10 - n) * 86400000) };
      fixture.add(contributionId, index++); fixture.records.set(contributionId, row); await cards.db.collection("groupMediaContributions").insertOne(row);
    }
  }
  // Retained author history survives removal from the other origin Group.
  await groups.changeMember(group.adminId, group.secondId, { kind: "remove-follower", targetUserId: group.otherId, operationId: randomUUID(), expectedStructureRevision: 0 });
  return { cardId, personalDeckId: group.deckId, experienceId: group.experienceId, follower: "Aoife Kelly" };
}
