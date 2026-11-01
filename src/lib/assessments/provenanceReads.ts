import type { ClientSession } from "mongodb";
import type { CardRepository } from "../cards/repository";
import { GROUP_COLLECTIONS } from "../groupExperiences/indexes";
import type { GroupExperience, GroupMember } from "../groupExperiences/model";
import { authorize } from "../groupExperiences/authorization";
import { CardArchitectureError } from "../cards/domain";
import { readAssessmentProvenance } from "./provenance";

// Result visibility is not permission to discover another Group's identity.
// Resolve names only for current membership of the actual authenticated viewer.
export async function authorisedAssessmentOriginNames(repo: CardRepository, actor: string, tests: readonly { provenance?: unknown }[], session: ClientSession) {
  const ids = [...new Set(tests.flatMap(test => {
    const value = readAssessmentProvenance(test.provenance); return value?.groupExperienceId ? [value.groupExperienceId] : [];
  }))];
  const names = new Map<string, string>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const members = await repo.db.collection<GroupMember>(GROUP_COLLECTIONS.members).find({ userId: actor, experienceId: { $in: batch },
      $or: [{ isAdmin: true }, { followerStatus: "active" }] }, { session, projection: { _id: 0, experienceId: 1, isAdmin: 1, followerStatus: 1, accessEpoch: 1 } }).toArray();
    const authorised = members.filter(member => {
      try { authorize(member, "member"); return true; }
      catch (error) { if (!(error instanceof CardArchitectureError)) throw error; return false; }
    });
    if (!authorised.length) continue;
    const groups = await repo.db.collection<GroupExperience>(GROUP_COLLECTIONS.experiences).find({ experienceId: { $in: authorised.map(member => member.experienceId) } },
      { session, projection: { _id: 0, experienceId: 1, name: 1 } }).toArray();
    for (const group of groups) if (typeof group.name === "string" && group.name.trim()) names.set(group.experienceId, group.name);
  }
  return names;
}
