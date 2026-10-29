import type { LearningFields, PersonalLearningChange } from "../cards/learning";
import type { LibraryPreviewManifest } from "../cards/libraryProjection";
import type { RetainedCardAssignment } from "../cards/retainedAssignments";

export type GroupExperience = {
  experienceId: string; name: string; creatorUserId: string; operationId: string; creationHash: string;
  deckTemplateId: string; deckVersion: number; cardSelections: RetainedCardAssignment[];
  structureRevision: number; adoptionRevision: number; adminCount: number;
  createdAt: Date; updatedAt: Date;
};
export type GroupMember = {
  experienceId: string; userId: string; isAdmin: boolean; followerStatus: "never" | "active" | "removed";
  accessEpoch: number; writeFence: number; joinedAt: Date | null; removedAt: Date | null;
  activeCardId: string | null; openedAt: Date | null; retainedCardAssignments: RetainedCardAssignment[];
  rejoinedAt?: Date | null; latestRemoval?: RemovalManifest;
};
export type RemovalManifest = { generation: string; snapshotAt: Date; deckVersion: number; cards: RetainedCardAssignment[] };
export type RemovalLearning = LearningFields & { experienceId: string; userId: string; cardTemplateId: string; version: number; generation: string; snapshotAt: Date };
export type GroupCardState = LearningFields & {
  experienceId: string; cardTemplateId: string; revision: number; createdAt: Date; updatedAt: Date;
};
export type GroupReceipt = {
  experienceId: string; actor: string; operationId: string; commandHash: string;
  structureRevision: number; createdAt: Date;
};
export type CreateExperience = { operationId: string; name: string; adminIds: string[]; followerIds: string[]; manifest: LibraryPreviewManifest };
export type MemberCommand = { operationId: string; expectedStructureRevision: number; targetUserId: string } & (
  { kind: "add-follower" | "remove-follower" } | { kind: "set-admin"; isAdmin: boolean }
);
export type LearningCommand = { accessEpoch: number; version: number; change: PersonalLearningChange };
export type Perspective = "group" | "self" | "follower";
export type GroupUpdateCommand = {
  viewerUserId: string; experienceId: string; perspective: "group"; kind: "card" | "deck"; entityId: string;
  sourceVersion: number; targetVersion: number; expectedAdoptionRevision: number; expectedStructureRevision: number;
  cards: RetainedCardAssignment[];
};
