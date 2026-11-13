import { exact, id, revision } from "../contracts";
import { CardArchitectureError, requireCondition } from "../../cards/domain";
import { isSupportedImageUploadContentType } from "../../imageUploadContentTypes";
import { isOriginalMediaFilename } from "../../media";
import { isCreationContext, type CreationContext } from "./contributionIdentity";
export function allocationCommand(input: unknown) {
  exact(input, ["operationId", "accessEpoch", "version", "kind", "contentType", "size", "originalFilename", "creationContext"]);
  // The perspective the upload is made from. It is part of the operation hash, so a retry cannot change it.
  requireCondition(isCreationContext(input.creationContext), "INVALID_GROUP_MEDIA_PERSPECTIVE");
  requireCondition(input.originalFilename === undefined || isOriginalMediaFilename(input.originalFilename), "INVALID_GROUP_MEDIA_FILENAME");
  id(input.operationId); revision(input.accessEpoch); revision(input.version);
  requireCondition(Number(input.version) > 0 && (input.kind === "image" || input.kind === "video"), "INVALID_GROUP_MEDIA");
  requireCondition(typeof input.contentType === "string" && (input.kind === "image" ? isSupportedImageUploadContentType(input.contentType)
    : /^video\/[a-zA-Z0-9.+-]+$/.test(input.contentType)), "INVALID_GROUP_MEDIA");
  requireCondition(Number.isSafeInteger(input.size) && Number(input.size) > 0 && (input.kind === "video" || Number(input.size) <= 10 * 1024 * 1024), "INVALID_GROUP_MEDIA_SIZE");
  return input as { operationId: string; accessEpoch: number; version: number; kind: "image" | "video"; contentType: string; size: number; originalFilename?: string; creationContext: CreationContext };
}
// A Group-context delete names the identity acting: "group" from the Group perspective, "self" from Me.
export function groupDeleteCommand(input: unknown) {
  exact(input, ["expectedRevision", "accessEpoch", "perspective"]);
  revision(input.expectedRevision); revision(input.accessEpoch);
  requireCondition(isCreationContext(input.perspective), "INVALID_GROUP_MEDIA_PERSPECTIVE");
  return input as { expectedRevision: number; accessEpoch: number; perspective: CreationContext };
}
export function mutationCommand(input: unknown, kind: "commit" | "hide" | "delete") {
  exact(input, kind === "commit" ? ["expectedRevision", "proof"] : kind === "hide" ? ["expectedRevision", "accessEpoch"] : ["expectedRevision"]);
  revision(input.expectedRevision);
  if (kind === "commit") requireCondition(typeof input.proof === "string" && input.proof.length <= 8192, "GROUP_MEDIA_PROOF_FORBIDDEN");
  if (kind === "hide") revision(input.accessEpoch);
  return input as { expectedRevision: number; proof?: string; accessEpoch?: number };
}

export class GroupMediaAllocationUncertain extends CardArchitectureError {
  constructor(readonly contributionId: string) { super("GROUP_MEDIA_ALLOCATION_UNCERTAIN"); }
}
