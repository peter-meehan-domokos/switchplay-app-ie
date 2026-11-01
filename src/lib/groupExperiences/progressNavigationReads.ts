import { groupCapabilities } from "./policy";
import { identity } from "./readModels";
import { activeIdentities } from "./identities";
import type { GroupExperienceRepository } from "./repository";

export function readProgressNavigation(repo: GroupExperienceRepository, actor: string, experienceId: string, after?: string) {
  return repo.transaction(async session => {
    const { experience, member } = await repo.access(actor, experienceId, "member", session);
    const roster = await activeIdentities(repo, experience, member, session, after, 100);
    return { ...identity(actor, experience, member), name: experience.name, isFollower: member.followerStatus === "active",
      capabilities: groupCapabilities(experience, member), ...roster,
      activeFollowerCount: await repo.members().countDocuments({ experienceId, followerStatus: "active" }, { session }) };
  });
}
