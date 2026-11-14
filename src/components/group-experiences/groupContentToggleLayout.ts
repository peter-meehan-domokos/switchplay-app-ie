import type { PerspectiveSelection } from "@/lib/groupExperiences/model";

// The Include Group content toggle (checkpoint 4.5c, decisions V3 to V5). One central setting for the Group deck:
// while a follower is inspected it adds the Group's Admin Info Cards and media to that follower's own
// contributions. It is off by default and is only offered to viewers who can inspect followers. It stays visible
// but disabled while the Group perspective or the viewer's own Me is selected, where it has no effect, so the
// chooser does not change height. When it applies and is on, a "+ Group" tag follows the follower's name.
export type GroupContentToggleLayout = { visible: boolean; checked: boolean; disabled: boolean; applies: boolean; tag: string | null };
export const GROUP_CONTENT_LABEL = "Include Group content";
export const GROUP_CONTENT_TAG = "+ Group";

export function buildGroupContentToggleLayout(input: { canInspectFollowers: boolean; selection: PerspectiveSelection; includeGroupContent: boolean }): GroupContentToggleLayout {
  const applies = input.selection.perspective === "follower";
  return { visible: input.canInspectFollowers, checked: input.includeGroupContent, disabled: !applies, applies: applies && input.includeGroupContent,
    tag: applies && input.includeGroupContent ? GROUP_CONTENT_TAG : null };
}
