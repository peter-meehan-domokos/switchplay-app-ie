import { randomUUID } from "node:crypto";
import { MongoServerError, type ClientSession } from "mongodb";
import { CardRepository } from "../cards/repository";
import { requireCondition } from "../cards/domain";
import { assertLearningChange, projectLearning } from "../cards/learning";
import { ensurePersonalLearningInSession, mutatePersonalLearningInSession } from "../cards/personalLearning";
import { mergeRetainedAssignments } from "../cards/retainedAssignments";
import { cardContentPresentation } from "../cards/libraryProjection";
import { cardCreatorAttributions, creatorUsernames } from "../cards/creatorAttribution";
import { GROUP_COLLECTIONS, assertGroupExperienceIndexes } from "./indexes";
import type { GroupExperience, GroupMember, GroupCardData, GroupReceipt, Perspective, RemovalLearning } from "./model";
import { authorize, type GroupRole } from "./authorization";
import { createCommand, memberCommand, learningCommand, hash, id, page, revision } from "./contracts";
import { publicCards, selectedCard, selectedContent, validateCreationManifest } from "./publicVersions";
import { personalLearningForUsers, userKey } from "./learningReads";
import { aggregateLearning, entry, identity } from "./readModels";
import { formerCardLearning, removalSnapshot, snapshotRemoval } from "./lifecycle";
import { adoptGroupUpdate, reviewGroupUpdate } from "./adoption";
import { canInspectPeers, assertSelection } from "./policy";
import { restoredPerspective, saveNavigation, saveSettings } from "./navigation";
import { activeIdentities } from "./identities";
import { bootstrap, perspectivePage, cardAggregates, collectionTiles } from "./presentationReads";
import { manageExperience } from "./management";

export class GroupExperienceRepository {
  constructor(readonly cards: CardRepository) {}
  experiences() { return this.cards.db.collection<GroupExperience>(GROUP_COLLECTIONS.experiences); }
  members() { return this.cards.db.collection<GroupMember>(GROUP_COLLECTIONS.members); }
  cardData() { return this.cards.db.collection<GroupCardData>(GROUP_COLLECTIONS.cardData); }
  receipts() { return this.cards.db.collection<GroupReceipt>(GROUP_COLLECTIONS.receipts); }
  removals() { return this.cards.db.collection<RemovalLearning>(GROUP_COLLECTIONS.removals); }
  private ready = false;
  async transaction<T>(run: (session: ClientSession) => Promise<T>) {
    if (!this.ready) { await assertGroupExperienceIndexes(this.cards.db); this.ready = true; }
    return this.cards.transaction(run);
  }
  async access(actor: string, experienceId: string, role: GroupRole, session: ClientSession, epoch?: number) {
    id(actor); id(experienceId);
    const member = await this.members().findOne({ experienceId, userId: actor }, { session }); authorize(member, role, epoch);
    const experience = await this.experiences().findOne({ experienceId }, { session });
    requireCondition(experience, "GROUP_FORBIDDEN"); return { experience, member };
  }
  async fence(members: GroupMember[], session: ClientSession) {
    for (const member of [...new Map(members.map(member => [member.userId, member])).values()].sort((a, b) => a.userId.localeCompare(b.userId))) {
      const result = await this.members().updateOne({ experienceId: member.experienceId, userId: member.userId, accessEpoch: member.accessEpoch },
        { $inc: { writeFence: 1 } }, { session }); requireCondition(result.matchedCount === 1, "GROUP_ACCESS_CONFLICT");
    }
  }
  async registered(userIds: string[], session: ClientSession) {
    for (let start = 0; start < userIds.length; start += 100) {
      const batch = userIds.slice(start, start + 100);
      const users = await this.cards.users().find({ _id: { $in: batch.map(userKey) } }, { session, projection: { _id: 1 } }).toArray();
      requireCondition(users.length === batch.length, "GROUP_USER_UNAVAILABLE");
    }
  }
  newMember(experienceId: string, userId: string, isAdmin: boolean, isFollower: boolean, refs: GroupExperience["cardSelections"], now: Date): GroupMember {
    return { experienceId, userId, isAdmin, followerStatus: isFollower ? "active" : "never", accessEpoch: 0, writeFence: 0,
      joinedAt: isFollower ? now : null, removedAt: null, activeCardId: null, openedAt: null,
      retainedCardAssignments: isFollower ? mergeRetainedAssignments([], refs) : [] };
  }
  async create(actor: string, input: unknown) {
    id(actor); const command = createCommand(input), creationHash = hash(command), experienceId = randomUUID(), now = new Date();
    const run = () => this.transaction(async session => {
      const prior = await this.experiences().findOne({ creatorUserId: actor, operationId: command.operationId }, { session });
      if (prior) {
        requireCondition(prior.creationHash === creationHash, "GROUP_OPERATION_CONFLICT");
        const member = await this.members().findOne({ experienceId: prior.experienceId, userId: actor }, { session });
        if (!member || !member.isAdmin && member.followerStatus !== "active") {
          // A lost creation response can be acknowledged after another Admin
          // removed the creator. This receipt grants no access or current data.
          return { viewerUserId: actor, experienceId: prior.experienceId, hasAccess: false, outcome: "already-created" as const };
        }
        return { ...entry(actor, prior, member), hasAccess: true, outcome: "already-created" as const };
      }
      const admins = [...new Set([actor, ...command.adminIds])], users = [...new Set([...admins, ...command.followerIds])].sort();
      await this.registered(users, session); await validateCreationManifest(this.cards, command.manifest, session);
      const experience: GroupExperience = { experienceId, name: command.name, creatorUserId: actor, operationId: command.operationId, creationHash,
        deckTemplateId: command.manifest.deckTemplateId, deckVersion: command.manifest.deckVersion, cardSelections: command.manifest.cards,
        structureRevision: 0, adoptionRevision: 0, adminCount: admins.length, allowFollowerInspection: command.allowFollowerInspection ?? false, createdAt: now, updatedAt: now };
      await this.experiences().insertOne(experience, { session });
      const members = users.map(userId => this.newMember(experienceId, userId, admins.includes(userId), command.followerIds.includes(userId), command.manifest.cards, now));
      await this.members().insertMany(members, { session });
      return { ...entry(actor, experience, members.find(member => member.userId === actor)!), hasAccess: true, outcome: "created" as const };
    });
    try { return await run(); } catch (error) { if (error instanceof MongoServerError && error.code === 11000) return run(); throw error; }
  }
  manage(actor: string, experienceId: string, input: unknown) { return manageExperience(this, actor, experienceId, input); }
  async list(actor: string, after?: string, limit?: number) {
    id(actor); const paging = page(after, limit);
    return this.transaction(async session => {
      const members = await this.members().find({ userId: actor, $or: [{ isAdmin: true }, { followerStatus: "active" }],
        ...(paging.after ? { experienceId: { $gt: paging.after } } : {}) }, { session }).sort({ experienceId: 1 }).limit(paging.limit + 1).toArray();
      const rows = members.slice(0, paging.limit), experiences = await this.experiences().find({ experienceId: { $in: rows.map(member => member.experienceId) } }, { session }).toArray();
      return { viewerUserId: actor, entries: rows.map(member => {
        const experience = experiences.find(experience => experience.experienceId === member.experienceId);
        requireCondition(experience, "INVALID_GROUP_MEMBERSHIP"); return entry(actor, experience, member);
      }), nextCursor: members.length > paging.limit ? rows.at(-1)!.experienceId : null };
    });
  }
  async get(actor: string, experienceId: string) {
    return this.transaction(async session => {
      const { experience, member } = await this.access(actor, experienceId, "member", session);
      const { deck, cards } = await selectedContent(this.cards, experience, session);
      return { ...entry(actor, experience, member), title: deck.content.title,
        allowFollowerInspection: experience.allowFollowerInspection === true, canInspectFollowers: canInspectPeers(experience, member),
        selection: await restoredPerspective(this, experience, member, session),
        cards: cards.map(card => ({ cardTemplateId: card.cardTemplateId, version: card.version, title: card.content.intro.title })) };
    });
  }
  async replay(actor: string, experience: GroupExperience, operationId: string, commandHash: string, session: ClientSession) {
    const receipt = await this.receipts().findOne({ experienceId: experience.experienceId, actor, operationId }, { session });
    if (!receipt) return null;
    requireCondition(receipt.commandHash === commandHash, "GROUP_OPERATION_CONFLICT");
    return { viewerUserId: actor, experienceId: experience.experienceId, structureRevision: experience.structureRevision,
      outcome: receipt.structureRevision === experience.structureRevision ? "already-applied" as const : "superseded" as const };
  }
  async record(actor: string, experienceId: string, operationId: string, commandHash: string, structureRevision: number, now: Date, session: ClientSession) {
    await this.receipts().insertOne({ experienceId, actor, operationId, commandHash, structureRevision, createdAt: now }, { session });
  }
  async changeMember(actor: string, experienceId: string, input: unknown) {
    const command = memberCommand(input), commandHash = hash(command), now = new Date(), generation = randomUUID();
    return this.transaction(async session => {
      const { experience, member } = await this.access(actor, experienceId, "admin", session);
      const replay = await this.replay(actor, experience, command.operationId, commandHash, session); if (replay) return replay;
      requireCondition(experience.structureRevision === command.expectedStructureRevision, "GROUP_STRUCTURE_CONFLICT");
      await this.registered([command.targetUserId], session);
      const target = await this.members().findOne({ experienceId, userId: command.targetUserId }, { session });
      await this.fence(target ? [member, target] : [member], session);
      const selected = (await selectedContent(this.cards, experience, session)).cards;
      const refs = selected.map(({ cardTemplateId, version }) => ({ cardTemplateId, version }));
      const next = target ? { ...target } : this.newMember(experienceId, command.targetUserId, false, false, [], now);
      if (command.kind === "set-admin") next.isAdmin = command.isAdmin;
      else if (command.kind === "remove-follower") {
        requireCondition(target && target.followerStatus !== "never", "GROUP_FOLLOWER_FORBIDDEN");
        if (target.followerStatus === "active") {
          next.latestRemoval = await snapshotRemoval(this, experience, target, selected, generation, now, session);
          next.followerStatus = "removed"; next.removedAt = now; next.activeCardId = null;
          next.retainedCardAssignments = mergeRetainedAssignments(next.retainedCardAssignments, refs);
        }
      }
      else {
        if (next.followerStatus === "removed") next.rejoinedAt = now;
        next.followerStatus = "active"; next.joinedAt ??= now;
        next.removedAt = null;
        next.retainedCardAssignments = mergeRetainedAssignments(next.retainedCardAssignments, refs);
      }
      const adminCount = experience.adminCount + Number(next.isAdmin) - Number(target?.isAdmin ?? false);
      requireCondition(adminCount >= 1, "GROUP_FINAL_ADMIN_CONFLICT");
      if (target) {
        await this.members().updateOne({ experienceId, userId: next.userId }, { $set: { isAdmin: next.isAdmin, followerStatus: next.followerStatus,
          joinedAt: next.joinedAt, removedAt: next.removedAt, rejoinedAt: next.rejoinedAt ?? null, activeCardId: next.activeCardId,
          ...(next.latestRemoval ? { latestRemoval: next.latestRemoval } : {}),
          retainedCardAssignments: next.retainedCardAssignments }, $inc: { accessEpoch: 1 } }, { session });
      } else await this.members().insertOne(next, { session });
      const update = await this.experiences().updateOne({ experienceId, structureRevision: command.expectedStructureRevision },
        { $set: { adminCount, updatedAt: now }, $inc: { structureRevision: 1 } }, { session });
      requireCondition(update.matchedCount === 1, "GROUP_STRUCTURE_CONFLICT");
      await this.record(actor, experienceId, command.operationId, commandHash, experience.structureRevision + 1, now, session);
      return { viewerUserId: actor, experienceId, structureRevision: experience.structureRevision + 1, outcome: "applied" as const };
    });
  }
  async roster(actor: string, experienceId: string, after?: string, limit?: number) {
    const paging = page(after, limit);
    return this.transaction(async session => {
      const { experience, member } = await this.access(actor, experienceId, "admin", session);
      const rows = await this.members().find({ experienceId, ...(paging.after ? { userId: { $gt: paging.after } } : {}) }, { session })
        .sort({ userId: 1 }).limit(paging.limit + 1).toArray();
      const visible = rows.slice(0, paging.limit), names = await creatorUsernames(this.cards, visible.map(row => row.userId), session);
      return { ...identity(actor, experience, member), members: visible.map(row => ({ userId: row.userId, username: names.get(row.userId) ?? "Unknown user",
        isAdmin: row.isAdmin, followerStatus: row.followerStatus })), nextCursor: rows.length > paging.limit ? visible.at(-1)!.userId : null };
    });
  }
  async open(actor: string, experienceId: string, accessEpoch: number, cardTemplateId?: string) {
    revision(accessEpoch); if (cardTemplateId !== undefined) id(cardTemplateId);
    return this.transaction(async session => {
      const { experience, member } = await this.access(actor, experienceId, "member", session, accessEpoch);
      await this.fence([member], session);
      const { cards } = await selectedContent(this.cards, experience, session);
      const selected = cards.find(card => card.cardTemplateId === (cardTemplateId ?? member.activeCardId)) ?? (cardTemplateId ? undefined : cards[0]);
      requireCondition(cardTemplateId === undefined || selected, "GROUP_CARD_FORBIDDEN");
      if (member.followerStatus === "active" && selected) {
        await personalLearningForUsers(this.cards, [actor], [selected], session);
        await ensurePersonalLearningInSession(this.cards, actor, selected, session, { scheduling: "experience" });
      }
      await this.members().updateOne({ experienceId, userId: actor }, { $set: { activeCardId: selected?.cardTemplateId ?? null, openedAt: new Date() } }, { session });
      return { ...identity(actor, experience, member), activeCardId: selected?.cardTemplateId ?? null };
    });
  }
  async groupLearning(experienceId: string, cards: Awaited<ReturnType<typeof selectedContent>>["cards"], session: ClientSession) {
    const rows: GroupCardData[] = [];
    for (let start = 0; start < cards.length; start += 100) rows.push(...await this.cardData().find({ experienceId,
      cardTemplateId: { $in: cards.slice(start, start + 100).map(card => card.cardTemplateId) } }, {
      session, projection: { _id: 0, cardTemplateId: 1, items: 1, signalReadings: 1 },
    }).toArray());
    return cards.map(card => ({ cardTemplateId: card.cardTemplateId, version: card.version,
      ...projectLearning(card.content, rows.find(row => row.cardTemplateId === card.cardTemplateId) ?? { items: [], signalReadings: [] }) }));
  }
  async card(actor: string, experienceId: string, cardTemplateId: string, perspective: Perspective, subjectUserId?: string) {
    id(cardTemplateId); requireCondition(["group", "self", "follower"].includes(perspective), "INVALID_GROUP_PERSPECTIVE");
    requireCondition(perspective === "follower" ? subjectUserId !== undefined : subjectUserId === undefined, "INVALID_GROUP_SUBJECT");
    if (subjectUserId !== undefined) id(subjectUserId);
    return this.transaction(async session => {
      const { experience, member } = await this.access(actor, experienceId, perspective === "self" ? "follower" : "member", session);
      const { cards } = await selectedContent(this.cards, experience, session), selected = cards.find(card => card.cardTemplateId === cardTemplateId);
      requireCondition(selected, "GROUP_CARD_FORBIDDEN");
      const subject = perspective === "self" ? actor : subjectUserId;
      const subjectMember = subject ? await this.members().findOne({ experienceId, userId: subject }, { session }) : null;
      const former = perspective === "follower" && subjectMember?.followerStatus === "removed";
      if (former) requireCondition(member.isAdmin, "GROUP_SNAPSHOT_FORBIDDEN");
      else assertSelection(experience, member, perspective === "follower" ? { perspective, subjectUserId: subject! } : { perspective }, subjectMember);
      if (subject && !former) authorize(subjectMember, "follower");
      const learning = former ? await formerCardLearning(this, subjectMember!, selected, session)
        : perspective === "group" ? (await this.groupLearning(experienceId, [selected], session))[0]
          : (await personalLearningForUsers(this.cards, [subject!], [selected], session)).get(subject!)![0];
      const root = (await this.cards.cards().findOne({ cardTemplateId }, { session }))!;
      const attribution = (await cardCreatorAttributions(this.cards, [root], session)).get(cardTemplateId)!;
      return { ...identity(actor, experience, member), perspective, subjectUserId: subject ?? null,
        content: cardContentPresentation(selected, `Card ${cards.indexOf(selected) + 1}`, attribution), learning,
        capabilities: { canWriteLearning: perspective === "group" ? member.isAdmin : perspective === "self", canInspectFollowers: canInspectPeers(experience, member) } };
    });
  }
  async summary(actor: string, experienceId: string) {
    return this.transaction(async session => {
      const { experience, member } = await this.access(actor, experienceId, "member", session);
      const { cards } = await selectedContent(this.cards, experience, session);
      const followers = await this.members().find({ experienceId, followerStatus: "active" }, { session, projection: { userId: 1 } }).toArray();
      const personal = await personalLearningForUsers(this.cards, followers.map(row => row.userId), cards, session);
      return { ...identity(actor, experience, member), ...aggregateLearning(await this.groupLearning(experienceId, cards, session), [...personal.values()]) };
    });
  }
  async perspectives(actor: string, experienceId: string, cardTemplateId: string, after?: string, limit?: number) {
    id(cardTemplateId); const paging = page(undefined, limit);
    return this.transaction(async session => {
      const { experience, member } = await this.access(actor, experienceId, "member", session);
      requireCondition(canInspectPeers(experience, member), "GROUP_PERSPECTIVE_FORBIDDEN");
      const selected = await selectedCard(this.cards, experience, cardTemplateId, session);
      const visible = await activeIdentities(this, experience, member, session, after, paging.limit), users = visible.followers.map(row => row.userId);
      const personal = await personalLearningForUsers(this.cards, users, [selected], session);
      return { ...identity(actor, experience, member), cardTemplateId, version: selected.version,
        group: (await this.groupLearning(experienceId, [selected], session))[0], followers: users.map(userId => ({ userId,
          username: visible.followers.find(row => row.userId === userId)!.username, learning: personal.get(userId)![0] })), nextCursor: visible.nextCursor };
    });
  }
  async writeLearning(actor: string, experienceId: string, cardTemplateId: string, owner: "group" | "personal", input: unknown) {
    id(cardTemplateId); requireCondition(owner === "group" || owner === "personal", "INVALID_GROUP_LEARNING_OWNER");
    const command = learningCommand(input);
    return this.transaction(async session => {
      const { experience, member } = await this.access(actor, experienceId, owner === "group" ? "admin" : "follower", session, command.accessEpoch);
      await this.fence([member], session);
      const selected = await selectedCard(this.cards, experience, cardTemplateId, session);
      requireCondition(command.version <= selected.version, "GROUP_VERSION_CONFLICT");
      if (command.version !== selected.version) {
        const submitted = (await publicCards(this.cards, [{ cardTemplateId, version: command.version }], session))[0];
        assertLearningChange(submitted.content, command.change);
      }
      assertLearningChange(selected.content, command.change);
      if (owner === "personal") {
        const existing = await this.cards.getPersonalLearning(actor, cardTemplateId, session);
        requireCondition(existing && Array.isArray(existing.cardsData), "INVALID_GROUP_PERSONAL_DATA");
        if (!existing.cardsData.length) {
          await personalLearningForUsers(this.cards, [actor], [selected], session);
          await ensurePersonalLearningInSession(this.cards, actor, selected, session, { scheduling: "experience" });
        }
        await mutatePersonalLearningInSession(this.cards, actor, selected, command.change, session);
      } else {
        const row = await this.cardData().findOne({ experienceId, cardTemplateId }, { session }), now = new Date();
        if (!row) await this.cardData().insertOne({ experienceId, cardTemplateId, items: [], signalReadings: [], revision: 0, createdAt: now, updatedAt: now }, { session });
        projectLearning(selected.content, row ?? { items: [], signalReadings: [] });
        const change = command.change, completion = change.kind === "completion", field = completion ? "items" : "signalReadings";
        const valueField = completion ? "completionStatus" : "reading", value = completion ? change.completionStatus : change.reading;
        const exists = row?.[field].some(item => item.stepId === change.stepId);
        if (exists) await this.cardData().updateOne({ experienceId, cardTemplateId }, {
          $set: { [`${field}.$[step].${valueField}`]: value, updatedAt: now }, $inc: { revision: 1 },
        }, { session, arrayFilters: [{ "step.stepId": change.stepId }] });
        else await this.cardData().updateOne({ experienceId, cardTemplateId }, { $push: { [field]: { stepId: change.stepId, [valueField]: value } },
          $set: { updatedAt: now }, $inc: { revision: 1 } }, { session });
      }
      return { ...identity(actor, experience, member), cardTemplateId, version: selected.version, owner, ok: true };
    });
  }
  async snapshot(actor: string, experienceId: string, userId: string) {
    id(userId);
    return this.transaction(async session => {
      const { experience, member } = await this.access(actor, experienceId, "admin", session);
      const subject = await this.members().findOne({ experienceId, userId }, { session });
      requireCondition(subject, "GROUP_SNAPSHOT_FORBIDDEN");
      return { ...identity(actor, experience, member), subjectUserId: userId, ...await removalSnapshot(this, subject, session) };
    });
  }
  reviewUpdate(actor: string, experienceId: string, kind: "card" | "deck", entityId: string) {
    return reviewGroupUpdate(this, actor, experienceId, kind, entityId);
  }
  adoptUpdate(actor: string, experienceId: string, input: unknown) { return adoptGroupUpdate(this, actor, experienceId, input); }
  saveSettings(actor: string, experienceId: string, input: unknown) { return saveSettings(this, actor, experienceId, input); }
  saveNavigation(actor: string, experienceId: string, input: unknown) { return saveNavigation(this, actor, experienceId, input); }
  async identities(actor: string, experienceId: string, after?: string, limit?: number) {
    return this.transaction(async session => {
      const { experience, member } = await this.access(actor, experienceId, "member", session);
      return { ...identity(actor, experience, member), ...await activeIdentities(this, experience, member, session, after, limit) };
    });
  }
  bootstrap(actor: string, experienceId: string, offset?: number) { return bootstrap(this, actor, experienceId, offset); }
  perspectivePage(actor: string, experienceId: string, after?: string, limit?: number, offset?: number) { return perspectivePage(this, actor, experienceId, after, limit, offset); }
  cardAggregates(actor: string, experienceId: string, offset?: number) { return cardAggregates(this, actor, experienceId, offset); }
  collectionTiles(actor: string, after?: string) { return collectionTiles(this, actor, after); }
}
