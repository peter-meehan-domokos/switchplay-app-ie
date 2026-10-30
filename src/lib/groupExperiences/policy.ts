import { requireCondition } from "../cards/domain";
import type { GroupExperience, GroupMember, PerspectiveSelection } from "./model";

export function canInspectPeers(experience: GroupExperience, viewer: GroupMember) {
  return viewer.isAdmin || viewer.followerStatus === "active" && experience.allowFollowerInspection === true;
}
// Peer visibility grants active learning only. It never grants private sources,
// foreign writes, management roles or access to removed-follower snapshots.
export function canSelect(experience: GroupExperience, viewer: GroupMember, selection: PerspectiveSelection, subject?: GroupMember | null) {
  if (selection.perspective === "group") return viewer.isAdmin || viewer.followerStatus === "active";
  if (selection.perspective === "self") return viewer.followerStatus === "active";
  return Boolean(subject?.followerStatus === "active" && subject.experienceId === experience.experienceId
    && subject.userId === selection.subjectUserId && canInspectPeers(experience, viewer));
}
export function assertSelection(experience: GroupExperience, viewer: GroupMember, selection: PerspectiveSelection, subject?: GroupMember | null) {
  requireCondition(canSelect(experience, viewer, selection, subject), "GROUP_PERSPECTIVE_FORBIDDEN");
}
export function defaultPerspective(member: GroupMember): PerspectiveSelection {
  return { perspective: member.isAdmin ? "group" : "self" };
}
