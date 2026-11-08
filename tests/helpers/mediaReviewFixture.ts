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
  const scenes = index % 8, variant = index >= 8;
  const put = (x: number, y: number, colour: number[]) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    if (variant) x = w - 1 - x;
    const p = y * (w * 4 + 1) + 1 + x * 4;
    pixels[p] = colour[0]; pixels[p + 1] = colour[1]; pixels[p + 2] = colour[2]; pixels[p + 3] = 255;
  };
  const background = variant ? [[214, 199, 159], [169, 197, 193], [201, 177, 149], [176, 196, 207], [194, 181, 208], [207, 177, 166], [180, 201, 164], [202, 190, 152]][scenes] : [[34, 71, 95], [37, 101, 78], [96, 72, 127], [38, 83, 125], [139, 75, 45], [104, 52, 77], [48, 102, 111], [137, 105, 38]][scenes];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, background);
  const rect = (x: number, y: number, width: number, height: number, colour: number[]) => {
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) put(x + dx, y + dy, colour);
  };
  const line = (x: number, y: number, endX: number, endY: number, colour = variant ? [50, 61, 72] : [240, 233, 212], thickness = 5) => {
    const steps = Math.max(Math.abs(endX - x), Math.abs(endY - y));
    for (let n = 0; n <= steps; n++) rect(Math.round(x + (endX - x) * n / (steps || 1)), Math.round(y + (endY - y) * n / (steps || 1)), thickness, thickness, colour);
  };
  const circle = (x: number, y: number, radius: number, colour: number[]) => {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (dx * dx + dy * dy <= radius * radius) put(x + dx, y + dy, colour);
  };
  const ball = (x: number, y: number, radius = 24) => {
    circle(x, y, radius + 3, [32, 28, 25]); circle(x, y, radius, [239, 135, 39]);
    line(x - radius + 3, y, x + radius - 3, y, [95, 47, 23], 3);
    line(x, y - radius + 3, x, y + radius - 3, [95, 47, 23], 3);
  };
  const person = (x: number, y: number, shirt = [223, 225, 234]) => {
    circle(x, y - 55, 17, [208, 159, 112]); rect(x - 19, y - 33, 38, 58, shirt);
    line(x - 10, y + 25, x - 27, y + 72, [35, 33, 46], 11); line(x + 8, y + 25, x + 27, y + 72, [35, 33, 46], 11);
  };
  // Eight distinct basketball scenes. No origin or visibility information is
  // printed into the images: those facts come from the production metadata.
  line(20, 290, 455, 290); line(20, 270, 455, 270, [175, 162, 138], 2);
  if (scenes === 0) { // Hoop and ball.
    rect(235, 35, 150, 80, [233, 232, 219]); rect(285, 62, 55, 39, background);
    line(278, 114, 354, 114, [233, 105, 39], 8);
    for (let i = 0; i < 5; i++) line(280 + i * 17, 122, 292 + i * 11, 164, [244, 238, 219], 2);
    ball(143, 170, 45);
  } else if (scenes === 1) { // Three orange cones and a ball.
    for (const [x, y] of [[85, 135], [225, 190], [365, 130]]) {
      for (let row = 0; row < 80; row++) rect(x - Math.floor(row / 3), y + row, Math.max(1, Math.floor(row * 2 / 3)), 1, [247, 135, 35]);
      rect(x - 36, y + 80, 75, 10, [242, 216, 164]);
    }
    ball(125, 245, 26);
  } else if (scenes === 2) { // Athlete on a balance board.
    person(238, 163, [134, 205, 190]); line(215, 140, 151, 152); line(257, 140, 323, 127);
    rect(170, 246, 146, 10, [217, 182, 113]); circle(240, 267, 15, [41, 34, 57]);
  } else if (scenes === 3) { // Yellow footwork ladder.
    line(135, 35, 105, 250, [247, 209, 73], 9); line(305, 35, 335, 250, [247, 209, 73], 9);
    for (let y = 50; y < 245; y += 38) line(133 - Math.round((y - 35) / 7), y, 305 + Math.round((y - 35) / 7), y, [247, 209, 73], 7);
    rect(180, 130, 30, 53, [227, 225, 216]); rect(243, 180, 30, 53, [227, 225, 216]);
  } else if (scenes === 4) { // Two players passing.
    person(105, 175, [132, 189, 216]); person(355, 175, [132, 189, 216]);
    line(123, 157, 165, 165); line(334, 157, 295, 165); ball(237, 155, 26);
    line(180, 110, 285, 110); line(270, 98, 285, 110); line(270, 122, 285, 110);
  } else if (scenes === 5) { // Rebound beneath a backboard.
    rect(194, 22, 136, 61, [227, 229, 221]); line(220, 85, 302, 85, [238, 133, 45], 8);
    person(240, 195, [190, 172, 221]); line(222, 173, 199, 112); line(259, 173, 278, 112); ball(240, 105, 22);
  } else if (scenes === 6) { // Defensive stance and lateral arrows.
    person(235, 169, [206, 220, 127]); line(215, 147, 150, 171); line(252, 147, 320, 171);
    line(65, 220, 130, 220); line(65, 220, 82, 202); line(65, 220, 82, 238);
    line(345, 220, 410, 220); line(393, 202, 410, 220); line(393, 238, 410, 220);
  } else { // Dribbling player and low ball.
    person(215, 165, [127, 180, 227]); line(233, 145, 289, 188); ball(308, 235, 30);
    line(305, 125, 305, 178); line(294, 166, 305, 178); line(317, 166, 305, 178);
  }
  if (variant) { ball(415, 250, 16); ball(443, 275, 12); }
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) { c ^= v; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, bytes: Buffer) => { const b = Buffer.concat([Buffer.from(type), bytes]), size = Buffer.alloc(4), sum = Buffer.alloc(4); size.writeUInt32BE(bytes.length); sum.writeUInt32BE(crc(b)); return Buffer.concat([size, b, sum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(w); header.writeUInt32BE(h, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}
export const REVIEW_MEDIA_FILENAMES = ["basketball-hoop.png", "training-cones.png", "balance-board.png", "footwork-ladder.png", "passing-practice.png", "rebound-practice.png", "defensive-positioning.png", "dribbling-practice.png", "free-throw-session.png", "cone-dribble-course.png", "single-leg-balance.png", "agility-ladder.png", "chest-pass-drill.png", "basket-rebound.png", "lateral-defence.png", "low-dribble-practice.png"] as const;
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
export async function seedMediaReview(client: MongoClient, database: string, group: Awaited<ReturnType<typeof seedGroupReview>>, fixture: ReturnType<typeof createMediaReviewHandler>, publicBase: string, removeFromOtherOrigin = true) {
  if (!/^switchplay_phase2_browser_/.test(database)) throw Error("Disposable media fixture only");
  const cards = new CardRepository(client.db(database), client), groups = new GroupExperienceRepository(cards);
  await createGroupMediaIndexes(cards.db);
  await cards.ensureDeckData(group.adminId, group.deckId, 1);
  await cards.ensureDeckData(group.otherId, group.deckId, 1);
  await cards.users().updateOne({ _id: new ObjectId(group.otherId) }, { $set: { username: "Aoife Kelly" } });
  const cardId = group.cardIds[0];
  for (const actor of [group.otherId, group.adminId]) {
    let index = actor === group.adminId ? 8 : 0;
    const personal = Array.from({ length: 2 }, (_, n) => {
      const id = randomUUID(), key = `user-cards/${actor}/${cardId}/${id}.png`; fixture.add(key, index++);
      return { id: `image-${id}`, mediaType: "image", provider: "cloudflare-r2", assetId: key, src: `${publicBase}/${key}`, description: REVIEW_MEDIA_FILENAMES[index - 1], originalFilename: REVIEW_MEDIA_FILENAMES[index - 1], uploadedAt: new Date(Date.now() - (12 - n) * 86400000).toISOString() };
    });
    await cards.users().updateOne({ _id: new ObjectId(actor), "cardsData.cardTemplateId": cardId }, { $set: { "cardsData.$.mediaItems": personal } });
    const count = actor === group.adminId ? 5 : 4;
    for (let n = 0; n < count + (actor === group.adminId ? 1 : 2); n++) {
      const origin = n < count ? group.experienceId : group.secondId, contributionId = randomUUID();
      const row: GroupMediaRecord = { contributionId, operationId: randomUUID(), operationHash: "disposable-seed", authorUserId: actor, experienceId: origin,
        cardTemplateId: cardId, deckTemplateId: group.deckId, accessEpoch: 0, version: 1, adoptionRevision: 0, kind: "image", contentType: "image/png", originalFilename: REVIEW_MEDIA_FILENAMES[index], size: png(index).length,
        state: "attached", groupVisible: !(actor === group.otherId && n === 0), revision: 2, allocation: "ready", asset: { provider: "r2", assetId: `group-media/${contributionId}.png`, bucket: "disposable-group-media" },
        createdAt: new Date(Date.now() - (10 - n) * 86400000), uploadedAt: new Date(Date.now() - (10 - n) * 86400000) };
      fixture.add(contributionId, index++); fixture.records.set(contributionId, row); await cards.db.collection("groupMediaContributions").insertOne(row);
    }
  }
  // Retained author history survives removal from the other origin Group.
  if (removeFromOtherOrigin) await groups.changeMember(group.adminId, group.secondId, { kind: "remove-follower", targetUserId: group.otherId, operationId: randomUUID(), expectedStructureRevision: 0 });
  return { cardId, personalDeckId: group.deckId, experienceId: group.experienceId, follower: "Aoife Kelly" };
}
