import { ensureGroupReadiness } from "../readiness";
import { memberMediaCapabilities } from "../../mediaCollection/permissions";
import { randomUUID } from "node:crypto";
import { MongoServerError, type ClientSession } from "mongodb";
import { requireCondition } from "../../cards/domain";
import { id, hash } from "../contracts";
import type { GroupExperienceRepository } from "../repository";
import { selectedCard } from "../publicVersions";
import { canInspectPeers } from "../policy";
import { GROUP_MEDIA_COLLECTION } from "./indexes";
import { allocationCommand, mutationCommand, GroupMediaAllocationUncertain } from "./contracts";
import type { GroupMediaRecord, GroupMediaProvider, MediaAuthority } from "./model";
import { signGroupUpload, verifyGroupUpload } from "./proof";
import { productionGroupMediaProvider } from "./providers";
import { readMediaPage } from "./reads";
import { creationContextOf, identityRole, type CreationContext } from "./contributionIdentity";

export class GroupMediaRepository {
  constructor(readonly groups: GroupExperienceRepository, readonly provider: GroupMediaProvider = productionGroupMediaProvider) {}
  records() { return this.groups.cards.db.collection<GroupMediaRecord>(GROUP_MEDIA_COLLECTION); }
  async transaction<T>(run: (session: ClientSession) => Promise<T>) {
    await ensureGroupReadiness(this.groups.cards, "media");
    return this.groups.transaction(run);
  }
  async creationAuthority(actor: string, experienceId: string, cardTemplateId: string, epoch: number, version: number, session: ClientSession,
    creationContext: CreationContext, adoptionRevision?: number) {
    const { experience, member } = await this.groups.access(actor, experienceId, "member", session, epoch);
    // Server enforcement of the perspective rule: Admin contributions only from a current admin, Follower
    // contributions only from an active follower. A role change also changes accessEpoch, so an in-flight
    // upload across it fails here and its stored creationContext always matches the role at creation.
    requireCondition(identityRole(creationContext) === "admin" ? member.isAdmin : member.followerStatus === "active", "GROUP_MEDIA_PERSPECTIVE_FORBIDDEN");
    const card = await selectedCard(this.groups.cards, experience, cardTemplateId, session);
    requireCondition(card.version === version && (adoptionRevision === undefined || adoptionRevision === experience.adoptionRevision), "GROUP_MEDIA_SCOPE_CONFLICT");
    // Reuse the Group-assessment adoption fence: every adoption touches its
    // acting Admin. This also covers an Admin-only uploader and another Admin
    // adopting concurrently, without adding a second experience revision.
    const admins = await this.groups.members().find({ experienceId, isAdmin: true }, { session }).toArray();
    await this.groups.fence([member, ...admins], session);
    return { experience, member };
  }
  async allocate(actor: string, experienceId: string, cardTemplateId: string, input: unknown) {
    id(actor); id(experienceId); id(cardTemplateId); const cmd = allocationCommand(input);
    this.provider.checkConfiguration(cmd.kind);
    const operationHash = hash({ ...cmd, experienceId, cardTemplateId });
    const reserve = () => this.transaction(async session => {
      const { experience } = await this.creationAuthority(actor, experienceId, cardTemplateId, cmd.accessEpoch, cmd.version, session, cmd.creationContext);
      const prior = await this.records().findOne({ authorUserId: actor, operationId: cmd.operationId }, { session });
      if (prior) {
        requireCondition(prior.operationHash === operationHash, "GROUP_MEDIA_OPERATION_CONFLICT");
        requireCondition(prior.state !== "deleted", "GROUP_MEDIA_DELETED_CONFLICT");
        requireCondition(prior.adoptionRevision === experience.adoptionRevision, "GROUP_MEDIA_SCOPE_CONFLICT");
        return prior;
      }
      const row: GroupMediaRecord = { ...cmd, contributionId: randomUUID(), operationHash, authorUserId: actor, experienceId, cardTemplateId,
        deckTemplateId: experience.deckTemplateId, adoptionRevision: experience.adoptionRevision, state: "pending", groupVisible: true,
        revision: 0, allocation: "reserved", createdAt: new Date() };
      await this.records().insertOne(row, { session }); return row;
    });
    let row: GroupMediaRecord;
    try { row = await reserve(); } catch (error) { if (!(error instanceof MongoServerError && error.code === 11000)) throw error; row = await reserve(); }
    // Check signing configuration before issuing any provider allocation.
    await signGroupUpload(row);
    const claim = await this.records().updateOne({ contributionId: row.contributionId, state: "pending", allocation: "reserved" }, { $set: { allocation: "allocating" } });
    if (claim.modifiedCount) {
      try {
        const allocated = await this.provider.allocate(row);
        // Preserve a late provider result even if deletion won. It is a cleanup
        // locator/reservation, never permission to attach or restore the item.
        await this.transaction(async session => {
          const current = (await this.records().findOne({ contributionId: row.contributionId }, { session }))!;
          const deleted = current.state === "deleted";
          await this.records().updateOne({ contributionId: row.contributionId, allocation: "allocating" }, {
            $set: { asset: allocated.asset, allocation: "ready", ...(allocated.expiresAt ? { uploadExpiresAt: allocated.expiresAt } : {}),
              ...(deleted ? { cleanup: "pending" } : { uploadURL: allocated.uploadURL, uploadHeaders: allocated.headers }) }, $inc: { revision: 1 },
          }, { session });
        });
      } catch {
        // Never automatically issue another non-idempotent provider allocation.
        await this.records().updateOne({ contributionId: row.contributionId, allocation: "allocating" }, { $set: { allocation: "uncertain" } });
        throw new GroupMediaAllocationUncertain(row.contributionId);
      }
    }
    row = (await this.records().findOne({ contributionId: row.contributionId }))!;
    if (row.state === "deleted") { await this.cleanup(row); requireCondition(false, "GROUP_MEDIA_DELETED_CONFLICT"); }
    if (!(row.allocation === "ready" && row.asset && (row.state === "attached" || row.uploadURL))) throw new GroupMediaAllocationUncertain(row.contributionId);
    // Provider latency cannot turn an old membership into a fresh upload grant.
    await this.transaction(async session => {
      await this.creationAuthority(actor, experienceId, cardTemplateId, row.accessEpoch, row.version, session, creationContextOf(row), row.adoptionRevision);
      const current = await this.records().findOne({ contributionId: row.contributionId }, { session, projection: { state: 1, revision: 1 } });
      requireCondition(current && current.state !== "deleted", "GROUP_MEDIA_DELETED_CONFLICT");
      requireCondition(current.revision === row.revision, "GROUP_MEDIA_REVISION_CONFLICT");
    });
    return { contributionId: row.contributionId, revision: row.revision, state: row.state, uploadURL: row.uploadURL,
      headers: row.uploadHeaders, proof: await signGroupUpload(row), viewerUserId: actor, experienceId, cardTemplateId, accessEpoch: row.accessEpoch };
  }
  async commit(actor: string, experienceId: string, cardTemplateId: string, contributionId: string, input: unknown) {
    id(actor); id(experienceId); id(cardTemplateId); id(contributionId); const cmd = mutationCommand(input, "commit");
    const prepare = async (session: ClientSession) => {
      const row = await this.records().findOne({ contributionId, authorUserId: actor, experienceId, cardTemplateId }, { session });
      requireCondition(row, "GROUP_MEDIA_FORBIDDEN");
      requireCondition(row.state !== "deleted", "GROUP_MEDIA_DELETED_CONFLICT");
      await verifyGroupUpload(row, cmd.proof!);
      await this.creationAuthority(actor, experienceId, cardTemplateId, row.accessEpoch, row.version, session, creationContextOf(row), row.adoptionRevision);
      requireCondition(row.allocation === "ready" && row.asset, "GROUP_MEDIA_ALLOCATION_UNCERTAIN");
      if (row.state === "pending") requireCondition(row.revision === cmd.expectedRevision, "GROUP_MEDIA_REVISION_CONFLICT");
      return row;
    };
    const row = await this.transaction(prepare);
    if (row.state === "attached") return this.dto(row);
    requireCondition((await this.provider.status(row)).status === "ready", "GROUP_MEDIA_NOT_READY");
    return this.transaction(async session => {
      const current = await prepare(session);
      if (current.state === "attached") return this.dto(current);
      const attached = { ...current, state: "attached" as const, uploadedAt: new Date(), revision: current.revision + 1 };
      await this.records().updateOne({ contributionId, state: "pending", revision: current.revision }, {
        $set: { state: "attached", uploadedAt: attached.uploadedAt }, $inc: { revision: 1 },
        // No upload credential is needed after acknowledgement. A duplicate
        // commit uses its bound proof, not another allocation.
        $unset: { uploadURL: "", uploadHeaders: "" },
      }, { session });
      return this.dto(attached);
    });
  }
  async hide(actor: string, experienceId: string, contributionId: string, input: unknown) {
    id(contributionId); const cmd = mutationCommand(input, "hide");
    return this.transaction(async session => {
      const { member } = await this.groups.access(actor, experienceId, "admin", session, cmd.accessEpoch);
      const row = await this.records().findOne({ contributionId, experienceId, state: "attached" }, { session });
      requireCondition(row, "GROUP_MEDIA_FORBIDDEN");
      await this.groups.fence([member], session);
      if (!row.groupVisible) return { contributionId, revision: row.revision, groupVisible: false };
      requireCondition(row.revision === cmd.expectedRevision, "GROUP_MEDIA_REVISION_CONFLICT");
      await this.records().updateOne({ contributionId, revision: row.revision, state: "attached" }, { $set: { groupVisible: false }, $inc: { revision: 1 } }, { session });
      return { contributionId, revision: row.revision + 1, groupVisible: false };
    });
  }
  // Deletion happens only in the exact creation context (C1, refining R1). From a Group context the acting
  // perspective must match the stored creationContext, in the originating Group, and the author must currently hold
  // that identity's role there: an admin for an Admin contribution (Group perspective), an active follower for a
  // Follower contribution (Me). A former follower or admin therefore cannot delete until they rejoin (C4). The
  // owner route has no creation context: it only cancels unattached uploads of either identity. The stored
  // identity is compared, never the current role, and nobody deletes another author's item.
  async delete(actor: string, contributionId: string, input: unknown, context?: { experienceId: string; accessEpoch: number; perspective: CreationContext }) {
    id(actor); id(contributionId); const cmd = mutationCommand(input, "delete");
    const row = await this.transaction(async session => {
      if (context) {
        id(context.experienceId);
        const { member } = await this.groups.access(actor, context.experienceId, identityRole(context.perspective), session, context.accessEpoch);
        await this.groups.fence([member], session);
      }
      const current = await this.records().findOne({ contributionId, authorUserId: actor }, { session });
      requireCondition(current, "GROUP_MEDIA_FORBIDDEN");
      requireCondition(!context || current.experienceId === context.experienceId, "GROUP_MEDIA_FORBIDDEN");
      requireCondition(context ? creationContextOf(current) === context.perspective : current.state !== "attached", "GROUP_MEDIA_FORBIDDEN");
      if (current.state === "deleted") return current;
      requireCondition(current.revision === cmd.expectedRevision, "GROUP_MEDIA_REVISION_CONFLICT");
      await this.records().updateOne({ contributionId, revision: current.revision }, { $set: { state: "deleted", groupVisible: false,
        deletedAt: new Date(), cleanup: "pending" }, $inc: { revision: 1 }, $unset: { uploadURL: "", uploadHeaders: "", uploadedAt: "" } }, { session });
      return (await this.records().findOne({ contributionId }, { session }))!;
    });
    const cleanup = await this.cleanup(row);
    return { viewerUserId: actor, contributionId, cardTemplateId: row.cardTemplateId, state: "deleted" as const, revision: row.revision, cleanup };
  }
  async cleanup(row: GroupMediaRecord) {
    if (row.cleanup === "succeeded") return row.cleanup;
    if (row.state !== "deleted" || !row.asset) return "pending" as const;
    let cleanup: "succeeded" | "failed" | "pending";
    try {
      await this.provider.remove(row);
      // A previously granted conditional PUT may still finish. Keep cleanup
      // retryable until its upload permission expires, even after a successful DELETE.
      cleanup = row.uploadExpiresAt && row.uploadExpiresAt.getTime() > Date.now() ? "pending" : "succeeded";
    } catch { cleanup = "failed"; }
    try { await this.records().updateOne({ contributionId: row.contributionId, state: "deleted", cleanup: { $ne: "succeeded" } }, { $set: { cleanup } }); }
    catch { return "pending" as const; } // Tombstone committed; cleanup acknowledgement can be retried.
    return cleanup;
  }
  async groupAuthority(actor: string, experienceId: string, cardTemplateId: string, session: ClientSession, subjectUserId?: string) {
    const { experience, member } = await this.groups.access(actor, experienceId, "member", session);
    const card = await selectedCard(this.groups.cards, experience, cardTemplateId, session);
    if (subjectUserId !== undefined) {
      id(subjectUserId);
      requireCondition(subjectUserId === actor || canInspectPeers(experience, member), "GROUP_MEDIA_FORBIDDEN");
      const subject = await this.groups.members().findOne({ experienceId, userId: subjectUserId, followerStatus: "active" }, { session, projection: { _id: 1 } });
      requireCondition(subject, "GROUP_MEDIA_FORBIDDEN");
    }
    return { viewerUserId: actor, experienceId, cardTemplateId, capabilities: memberMediaCapabilities(member, subjectUserId), accessEpoch: member.accessEpoch,
      structureRevision: experience.structureRevision, adoptionRevision: experience.adoptionRevision, version: card.version };
  }
  async authorized(actor: string, contributionId: string, authority: MediaAuthority, allowPending = false) {
    id(actor); id(contributionId);
    return this.transaction(async session => {
      // Filter private/deleted foreign rows in Mongo, not after retrieval.
      const row = await this.records().findOne({ contributionId, ...(authority.kind === "owner" ? { authorUserId: actor,
        state: allowPending ? { $in: ["pending", "attached"] as GroupMediaRecord["state"][] } : "attached" as const }
        : { experienceId: authority.experienceId, groupVisible: true, state: "attached" as const,
          ...(authority.subjectUserId ? { authorUserId: authority.subjectUserId } : {}) }) }, { session });
      requireCondition(row, "GROUP_MEDIA_FORBIDDEN");
      const context = authority.kind === "owner" ? { viewerUserId: actor } : await this.groupAuthority(actor, authority.experienceId, row.cardTemplateId, session, authority.subjectUserId);
      return { row, context };
    });
  }
  async status(actor: string, contributionId: string, authority: MediaAuthority) {
    const { row, context } = await this.authorized(actor, contributionId, authority, true);
    // The owner can inspect/cancel an interrupted reservation without a provider
    // locator or originating membership. This does not grant upload permission.
    if (row.allocation !== "ready" || !row.asset) return { ...context, contributionId, revision: row.revision,
      state: row.state, status: row.allocation === "uncertain" ? "allocation-uncertain" as const : "allocating" as const };

    const status = await this.provider.status(row);
    const latest = await this.authorized(actor, contributionId, authority, true);
    requireCondition(latest.row.revision === row.revision, "GROUP_MEDIA_REVISION_CONFLICT");
    return { ...status, ...latest.context, contributionId, revision: row.revision };
  }
  async deliver(actor: string, contributionId: string, authority: MediaAuthority, action: "playback" | "download" | "prepare-download", signal?: AbortSignal) {
    const { row } = await this.authorized(actor, contributionId, authority);
    const response = await this.provider.deliver(row, action, signal);
    try {
      const latest = await this.authorized(actor, contributionId, authority);
      requireCondition(latest.row.revision === row.revision, "GROUP_MEDIA_REVISION_CONFLICT");
      if ("accessEpoch" in latest.context) {
        response.headers.set("X-Group-Access-Epoch", String(latest.context.accessEpoch));
        response.headers.set("X-Group-Structure-Revision", String(latest.context.structureRevision));
        response.headers.set("X-Group-Adoption-Revision", String(latest.context.adoptionRevision));
      }
    } catch (error) { await response.body?.cancel(); throw error; }
    response.headers.set("Cache-Control", "private, no-store"); response.headers.set("Vary", "Cookie");
    response.headers.set("X-Group-Viewer", actor); response.headers.set("X-Contribution-Revision", String(row.revision));
    return response;
  }
  dto(row: GroupMediaRecord) {
    return { contributionId: row.contributionId, authorUserId: row.authorUserId, experienceId: row.experienceId,
      cardTemplateId: row.cardTemplateId, kind: row.kind, uploadedAt: row.uploadedAt!.toISOString(), revision: row.revision,
      groupVisible: row.groupVisible, creationContext: creationContextOf(row), ...(row.originalFilename !== undefined ? { originalFilename: row.originalFilename } : {}) };
  }
  ownerFeed(actor: string, cardTemplateId: string, options: { after?: string; before?: string; limit?: number } = {}) { return readMediaPage(this, actor, cardTemplateId, { kind: "owner" }, options); }
  async groupFeed(actor: string, experienceId: string, cardTemplateId: string, options: { after?: string; before?: string; limit?: number; subjectUserId?: string; includeGroupContent?: boolean } = {}) {
    requireCondition(!options.includeGroupContent || options.subjectUserId !== undefined, "INVALID_GROUP_MEDIA_PAGE");
    return readMediaPage(this, actor, cardTemplateId, { kind: "group", experienceId, subjectUserId: options.subjectUserId,
      ...(options.includeGroupContent ? { includeGroupContent: true } : {}) }, options);
  }
}
