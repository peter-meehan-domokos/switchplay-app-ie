import type { CloudflareR2ImageMediaItem, CloudflareStreamVideoMediaItem } from "../media";
import type { Visibility } from "../cards/model";
import { isCreationContext, type CreationContext } from "../groupExperiences/media/contributionIdentity";

export type InfoMedia = CloudflareR2ImageMediaItem | CloudflareStreamVideoMediaItem;
export type InfoDraft = { title: string; body: string; seriesId: string | null; mediaItem: InfoMedia | null; bodyFormat?: "latex-v1" };
export type InfoContent = Omit<InfoDraft, "seriesId"> & { seriesId: string };
export type InfoRoot = {
  kind?: "creator" | "personal" | "group";
  originCardTemplateId?: string;
  // Group contributions only (kind "group", checkpoint 4.2), mirroring groupMediaContributions: the originating
  // Group, the immutable creation identity (contributionIdentity.ts) and Group visibility, which admins may hide.
  experienceId?: string; creationContext?: CreationContext; groupVisible?: boolean;
  infoCardId: string; ownerUserId: string; visibility: Visibility; draftVisibility: Visibility;
  draft: InfoDraft | null; latestVersion: number; revision: number; referenceRevision: number;
  createdAt: Date; updatedAt: Date;
  // A content-free reservation after deletion prevents ID/publication reuse.
  deletedAt?: Date;
  // Publish or Save pressed while the draft video was still processing (checkpoint 10). Optional: missing means
  // none. Cleared by completion, by a recorded failure, or by any newer draft save.
  pendingPublication?: PendingPublication;
  // The last pending request that could not complete, kept so the failure can be shown for that revision.
  lastPublicationFailure?: PublicationFailure;
};
// `context` keeps a standalone Personal first-save context without its list revision: completion reads the
// user's current personalInfoRevision itself, so other notes saved meanwhile do not invalidate the request.
export type PendingPublication = { revision: number; requestedAt: Date; context?: { deckTemplateId: string; version: number } };
export type PublicationFailure = { revision: number; at: Date; code: string };
export type PendingPublicationReceipt = { status: "pending"; infoCardId: string; revision: number };
// The visible outcome of a pending request, for the editor and every list that resumes checking.
export type PublicationRequestState = { infoCardId: string; title: string; kind: "creator" | "personal" } & (
  { status: "pending" } | { status: "published"; version: number } | { status: "failed"; code: string });
export type InfoPublication = {
  infoCardId: string; version: number; content: InfoContent; visibility: Visibility;
  publishedByUserId: string; publishedAt: Date; sourceRevision: number;
  // Historical Chromium acceptance only; new publications do not require it.
  mathsValidation?: { version: 1 };
};
export type InfoSeries = { seriesId: string; title: string; normalisedTitle: string; createdByUserId: string; createdAt: Date };
export type PublishedInfo = {
  kind?: "creator" | "personal" | "group";
  originCardTemplateId?: string;
  experienceId?: string; creationContext?: CreationContext;
  infoCardId: string; version: number; content: InfoContent; visibility: Visibility;
  ownerUserId: string; creatorUsername: string;
  series: { seriesId: string; title: string; createdByUserId: string; creatorUsername: string };
};
// `experienceId` reads a Group contribution shared with that Group as one of its current members (checkpoint 4.3),
// as Group media are delivered; without it only the owner, or a public Creator Info Card, is delivered.
export type MediaContext = { infoCardId: string } & ({ kind: "draft"; revision: number } | { kind: "publication"; version: number; experienceId?: string });
export type PersonalInfoSource = { cardTemplateId: string; personalInfoRevision: number };
export type PersonalInfoAssociation = PersonalInfoSource & { personalInfoCardIds: string[]; personalInfoCardAttachedAt: Record<string, string> };
// `source` "group" is a Group contribution: the viewer own Follower contribution in their own contexts (checkpoint
// 4.2), or any contribution shared with the Group in the Group perspective and follower inspection (checkpoint 4.3). `private` is set only where the
// viewer own Info Cards are shown inside a Group (Me), with the meaning of the media private icon: not shared with
// this Group, because it is standalone, from another Group, or hidden here.
export type InfoConsultationEntry = ({ status: "available"; info: PublishedInfo; source?: "shared" | "personal" | "group";
  sourceCardTemplateId?: string; attachedAt?: string | null; private?: boolean;
  // Group contributions only: their originating Group name, or null when unavailable.
  originName?: string | null } | { status: "unavailable" }) & { key?: string };
export type InfoConsultationSnapshot = { mainCardId: string; mainCardVersion: number; entries: InfoConsultationEntry[]; personalSources?: PersonalInfoSource[];
  publications?: PublicationRequestState[];
  // Group mode only: whether the viewer, as a current admin of this Group, may hide its contributions (C2).
  canHide?: boolean };
// "experience" is the follower own Me perspective of one Group: the Card at the Group selected version.
// "group" is the Group perspective of one Group, or, with `subjectUserId`, the inspection of one of its followers
// (checkpoint 4.3), at the Group selected version.
export type MainInfoContext = { mode: "working" | "canonical" | "experience" | "group"; version: number; deckTemplateId?: string; experienceId?: string; subjectUserId?: string };
export type PersonalInfoContext = { deckTemplateId: string; version: number; personalInfoRevision: number };
export function isCreatorInfo(root: { kind?: unknown; originCardTemplateId?: unknown }) {
  return (root.kind === undefined || root.kind === "creator") && root.originCardTemplateId === undefined;
}
export function isPersonalInfo(root: { kind?: unknown; originCardTemplateId?: unknown }) {
  return root.kind === "personal" && typeof root.originCardTemplateId === "string" && root.originCardTemplateId.trim().length > 0;
}
export function isGroupInfo(root: { kind?: unknown; originCardTemplateId?: unknown; experienceId?: unknown; creationContext?: unknown }) {
  return root.kind === "group" && typeof root.originCardTemplateId === "string" && root.originCardTemplateId.trim().length > 0
    && typeof root.experienceId === "string" && root.experienceId.trim().length > 0 && isCreationContext(root.creationContext);
}
// Private notes saved rather than published: standalone Personal Info Cards and Group contributions.
export function isNoteInfo(root: Parameters<typeof isGroupInfo>[0]) { return isPersonalInfo(root) || isGroupInfo(root); }
export const CREATOR_INFO_FILTER = { $or: [{ kind: { $exists: false } }, { kind: "creator" as const }], originCardTemplateId: { $exists: false } };
export const EMPTY_INFO_DRAFT: InfoDraft = { title: "", body: "", seriesId: null, mediaItem: null };
