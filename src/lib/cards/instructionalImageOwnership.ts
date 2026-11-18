import { createHash } from "node:crypto";
import type { ClientSession, Db } from "mongodb";
import { isCloudflareR2ImageMediaItem, type MediaItem } from "../media";
import { requireCondition, isRecord } from "./domain";
import { assertNotInfoMedia } from "../infoCards/mediaRegistry";
import { instructionalImageReady } from "./mediaProviders";

export const INSTRUCTIONAL_IMAGE_ALLOCATIONS = "instructionalImageAllocations";
export type ImageDestination = { scope: "card" | "deck"; targetId: string };
export type InstructionalImageAllocation = {
  _id: string; assetId: string; src: string; ownerUserId: string;
  destination: ImageDestination; destinationOwnerUserId: string;
  uploadScope: "card" | "deck"; uploadTargetId: string; ready: boolean; createdAt: Date;
};
// The standard unique _id index is sufficient: no additional indexes or Card schema changes.
export function imageAllocationId(destination: ImageDestination, assetId: string) {
  return createHash("sha256").update(JSON.stringify([destination.scope, destination.targetId, assetId])).digest("hex");
}
export function contentImages(value: unknown): MediaItem[] {
  if (Array.isArray(value)) return value.flatMap(contentImages);
  if (!isRecord(value)) return [];
  if (value.mediaType === "image") return [value as MediaItem];
  return Object.values(value).flatMap(contentImages);
}
function sameImage(a: MediaItem, b: MediaItem) {
  return a.mediaType === "image" && b.mediaType === "image" && a.src === b.src
    && ("assetId" in a ? "assetId" in b && a.assetId === b.assetId : !("assetId" in b) && a.id === b.id);
}
export async function imageAllocation(db: Db, destination: ImageDestination, image: MediaItem, session?: ClientSession) {
  requireCondition(isCloudflareR2ImageMediaItem(image), "INSTRUCTIONAL_IMAGE_FORBIDDEN");
  await assertNotInfoMedia(db, "r2", image.src, session);
  const record = await db.collection<InstructionalImageAllocation>(INSTRUCTIONAL_IMAGE_ALLOCATIONS)
    .findOne({ _id: imageAllocationId(destination, image.assetId), assetId: image.assetId, src: image.src }, { session });
  requireCondition(record, "INSTRUCTIONAL_IMAGE_FORBIDDEN");
  return record;
}
export async function recordImageAllocation(db: Db, actor: string, destination: ImageDestination, upload: { assetId: string; deliveryUrl: string }) {
  // Explicit provisioning avoids silently creating schema in a shared Atlas database.
  requireCondition(await db.listCollections({ name: INSTRUCTIONAL_IMAGE_ALLOCATIONS }, { nameOnly: true }).hasNext(), "INSTRUCTIONAL_IMAGE_SETUP_REQUIRED");
  await db.collection<InstructionalImageAllocation>(INSTRUCTIONAL_IMAGE_ALLOCATIONS).insertOne({
    _id: imageAllocationId(destination, upload.assetId), assetId: upload.assetId, src: upload.deliveryUrl,
    ownerUserId: actor, destination, destinationOwnerUserId: actor, uploadScope: destination.scope,
    uploadTargetId: destination.targetId, ready: false, createdAt: new Date(),
  });
}
export async function assertImageAttachments(db: Db, actor: string, destination: ImageDestination,
  content: unknown, session: ClientSession, previous?: unknown) {
  for (const image of contentImages(content)) {
    // Existing legacy references may survive unrelated draft edits, but gain no provenance or delivery rights.
    if (previous && contentImages(previous).some(prior => sameImage(prior, image))) continue;
    const allocation = await imageAllocation(db, destination, image, session);
    requireCondition(allocation.destinationOwnerUserId === actor, "INSTRUCTIONAL_IMAGE_FORBIDDEN");
  }
}
// Called only inside an already-authorised exact-version fork transaction. It is
// not a URL-based grant endpoint, and cannot legitimise an unverified source.
export async function inheritImageAllocations(db: Db, actor: string, source: ImageDestination, target: ImageDestination,
  before: unknown, after: unknown, session: ClientSession) {
  for (const image of contentImages(after)) {
    if (!contentImages(before).some(prior => sameImage(prior, image))) continue;
    const allocation = await imageAllocation(db, source, image, session);
    const _id = imageAllocationId(target, allocation.assetId);
    await db.collection<InstructionalImageAllocation>(INSTRUCTIONAL_IMAGE_ALLOCATIONS).updateOne({ _id }, { $setOnInsert: {
      ...allocation, _id, destination: target, destinationOwnerUserId: actor,
    } }, { upsert: true, session });
  }
}
// Provider I/O stays outside retriable Card publication transactions. Conditional
// create makes verified bytes immutable through our upload API. Revisions are
// checked again by the existing publication transaction.
export async function prepareImagePublication(db: Db, actor: string, destination: ImageDestination, content: unknown) {
  for (const image of contentImages(content)) {
    const allocation = await imageAllocation(db, destination, image);
    requireCondition(allocation.destinationOwnerUserId === actor, "INSTRUCTIONAL_IMAGE_FORBIDDEN");
    if (allocation.ready) continue; // Previously verified write-once bytes, including authorised inheritance.
    await instructionalImageReady(allocation);
    await db.collection<InstructionalImageAllocation>(INSTRUCTIONAL_IMAGE_ALLOCATIONS).updateOne({ _id: allocation._id }, { $set: { ready: true } });
  }
}
export async function assertImageDelivery(db: Db, destination: ImageDestination, image: MediaItem, session?: ClientSession, published = true) {
  const allocation = await imageAllocation(db, destination, image, session);
  requireCondition(!published || allocation.ready, "INSTRUCTIONAL_IMAGE_FORBIDDEN");
}

export async function assertImagePublication(db: Db, destination: ImageDestination, content: unknown, session: ClientSession) {
  for (const image of contentImages(content)) await assertImageDelivery(db, destination, image, session);
}
