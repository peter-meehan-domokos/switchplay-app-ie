import type { CreationContext } from "./contributionIdentity";
// Contribution identity and owner survive membership and Group lifecycle changes.
// Provider locators are internal: clients receive contextual application URLs.
export type GroupMediaAsset = { provider: "r2"; assetId: string; bucket: string } | { provider: "stream"; assetId: string };
export type GroupMediaRecord = {
  contributionId: string; operationId: string; operationHash: string;
  authorUserId: string; experienceId: string; cardTemplateId: string; deckTemplateId: string;
  // Immutable creation perspective: Follower ("self", Me) or Admin ("group", Group perspective). Missing on
  // records that predate it, which read as "self". See contributionIdentity.ts.
  creationContext?: CreationContext;
  accessEpoch: number; version: number; adoptionRevision: number;
  kind: "image" | "video"; contentType: string; size: number; originalFilename?: string;
  state: "pending" | "attached" | "deleted"; groupVisible: boolean; revision: number;
  allocation: "reserved" | "allocating" | "ready" | "uncertain";
  asset?: GroupMediaAsset; uploadURL?: string; uploadHeaders?: Record<string, string>;
  uploadExpiresAt?: Date; createdAt: Date; uploadedAt?: Date; deletedAt?: Date;
  cleanup?: "pending" | "succeeded" | "failed";
};
export type MediaAuthority = { kind: "owner" } | { kind: "group"; experienceId: string; subjectUserId?: string };
export type MediaStatus = { status: "ready" | "processing" | "failed" };
export interface GroupMediaProvider {
  checkConfiguration(kind: GroupMediaRecord["kind"]): void;
  allocate(row: GroupMediaRecord): Promise<{ asset: GroupMediaAsset; uploadURL: string; headers: Record<string, string>; expiresAt?: Date }>;
  status(row: GroupMediaRecord): Promise<MediaStatus>;
  remove(row: GroupMediaRecord): Promise<void>;
  deliver(row: GroupMediaRecord, action: "playback" | "download" | "prepare-download", signal?: AbortSignal): Promise<Response>;
}
