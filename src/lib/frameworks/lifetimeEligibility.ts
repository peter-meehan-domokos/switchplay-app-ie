import type { ClientSession } from "mongodb";
import type { CardRepository } from "../cards/repository";
import type { PersonalUser } from "../cards/model";
import { CardArchitectureError, isRecord, nonblank } from "../cards/domain";
import { mergeRetainedAssignments, type RetainedCardAssignment } from "../cards/retainedAssignments";
import { GROUP_COLLECTIONS } from "../groupExperiences/indexes";
import type { GroupExperience, GroupMember } from "../groupExperiences/model";
import { selectedContent } from "../groupExperiences/publicVersions";
import type { PersonalEligibility } from "./eligibility";

export type LifetimeEligibility = PersonalEligibility & {
  assignments: RetainedCardAssignment[]; requiredPersonalCardIds: string[];
};

// Owner-only evidence reader. Removed members contribute their frozen references,
// never the former experience's later composition; an Admin-only role adds none.
export async function lifetimeEligibility(repo: CardRepository, actor: string, user: PersonalUser,
  ordinary: PersonalEligibility, session: ClientSession): Promise<LifetimeEligibility> {
  const issues = [...ordinary.issues], required = new Set(ordinary.cardTemplateIds);
  let assignments: RetainedCardAssignment[] = [];
  const add = (refs: readonly RetainedCardAssignment[]) => {
    try { assignments = mergeRetainedAssignments(assignments, refs); }
    catch (error) { if (!(error instanceof CardArchitectureError)) throw error; issues.push({ code: error.code }); }
  };
  for (const id of ordinary.cardTemplateIds) {
    const rows = user.cardsData.filter(row => row.cardTemplateId === id);
    if (rows.length !== 1 || !Number.isInteger(rows[0].cardTemplateVersion) || rows[0].cardTemplateVersion < 1) {
      // The assignment identity/composition is still known. The selected Card
      // calculation reports its bad record only where that Card actually maps;
      // an unmapped missing record must not poison unrelated Framework Items.
      continue;
    }
    add([{ cardTemplateId: id, version: rows[0].cardTemplateVersion }]);
  }
  if (user.retainedCardAssignments !== undefined) {
    add(user.retainedCardAssignments);
    if (Array.isArray(user.retainedCardAssignments)) for (const ref of user.retainedCardAssignments) {
      if (isRecord(ref) && nonblank(ref.cardTemplateId)) required.add(ref.cardTemplateId);
    }
  }
  const members = await repo.db.collection<GroupMember>(GROUP_COLLECTIONS.members).find({ userId: actor }, { session,
    projection: { _id: 0, experienceId: 1, followerStatus: 1, retainedCardAssignments: 1 } }).toArray();
  const seen = new Set<string>();
  for (const member of members) {
    if (!nonblank(member.experienceId) || seen.has(member.experienceId) || !["never", "active", "removed"].includes(member.followerStatus)) {
      issues.push({ code: "INVALID_GROUP_ASSIGNMENT_EVIDENCE" }); continue;
    }
    seen.add(member.experienceId);
    if (member.retainedCardAssignments !== undefined) add(member.retainedCardAssignments);
    if (member.followerStatus !== "active") continue;
    const experience = await repo.db.collection<GroupExperience>(GROUP_COLLECTIONS.experiences).findOne({ experienceId: member.experienceId }, { session });
    try {
      if (!experience) throw new CardArchitectureError("MISSING_GROUP_ASSIGNMENT");
      const { cards } = await selectedContent(repo, experience, session);
      add(cards.map(({ cardTemplateId, version }) => ({ cardTemplateId, version })));
    } catch (error) { if (!(error instanceof CardArchitectureError)) throw error; issues.push({ code: error.code }); }
  }
  return { cardTemplateIds: [...new Set([...ordinary.cardTemplateIds, ...assignments.map(ref => ref.cardTemplateId)])],
    assignments, requiredPersonalCardIds: [...required], issues, unknownComposition: ordinary.unknownComposition || issues.length > 0 };
}

export function allowsVirtualPersonalCard(eligible: LifetimeEligibility, cardTemplateId: string) {
  return eligible.assignments.some(ref => ref.cardTemplateId === cardTemplateId) && !eligible.requiredPersonalCardIds.includes(cardTemplateId);
}
