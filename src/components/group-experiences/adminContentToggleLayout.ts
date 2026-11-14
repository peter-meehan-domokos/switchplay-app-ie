import type { PerspectiveSelection } from "@/lib/groupExperiences/model";

// The Include admin content toggle (checkpoint 4.5c, refined after it). One central setting for the Group deck that
// decides whether the Group's Admin Info Cards and media are shown in a follower perspective: the viewer's own Me and
// any inspected follower alike. In the Group perspective it changes nothing, since that already shows Admin content,
// but it stays enabled there so it can be set before a follower is chosen. It is offered wherever the chooser lists
// a follower perspective. Its default follows the viewer's role (defaultIncludeAdminContent). When it applies and is
// on, a "+ Admin" tag follows the name. "Admin" will later follow the Group's configured role names (backlog).
export type AdminContentToggleLayout = { visible: boolean; checked: boolean; applies: boolean; tag: string | null };
export const ADMIN_CONTENT_LABEL = "Include admin content";
export const ADMIN_CONTENT_TAG = "+ Admin";

export function buildAdminContentToggleLayout(input: { hasFollowerPerspectives: boolean; selection: PerspectiveSelection; includeAdminContent: boolean }): AdminContentToggleLayout {
  const applies = input.selection.perspective !== "group" && input.includeAdminContent;
  return { visible: input.hasFollowerPerspectives, checked: input.includeAdminContent, applies, tag: applies ? ADMIN_CONTENT_TAG : null };
}
