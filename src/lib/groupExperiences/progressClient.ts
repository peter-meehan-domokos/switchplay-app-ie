import { groupFetch, GroupRequestError } from "../../components/group-experiences/groupClient";
import type { readProgressNavigation } from "./progressNavigationReads";
import type { GroupProgressSummary } from "./progressReads";
import type { ProgressPerspective } from "./progressContext";
export type ProgressNavigation = Awaited<ReturnType<typeof readProgressNavigation>>;
export function progressChoices(actor: string, nav: ProgressNavigation) {
  return [{ value: "group", label: "Group", perspective: { kind: "group" } as ProgressPerspective },
    ...(nav.isFollower ? [{ value: actor, label: "My Progress in Group", perspective: { kind: "player", userId: actor } as ProgressPerspective }] : []),
    ...nav.followers.filter(row => row.userId !== actor).map(row => ({ value: row.userId, label: row.username, perspective: { kind: "player", userId: row.userId } as ProgressPerspective }))];
}
export function defaultProgressPerspective(actor: string, nav: ProgressNavigation): ProgressPerspective {
  return nav.isFollower ? { kind: "player", userId: actor } : { kind: "group" };
}
const sameAuthority = (a: ProgressNavigation, b: ProgressNavigation) => a.viewerUserId === b.viewerUserId && a.experienceId === b.experienceId
  && a.accessEpoch === b.accessEpoch && a.adoptionRevision === b.adoptionRevision && a.structureRevision === b.structureRevision;
export async function readProgressNavigationPages(actor: string, experienceId: string, signal?: AbortSignal, read = groupFetch): Promise<ProgressNavigation> {
  const base = `/api/group-experiences/${encodeURIComponent(experienceId)}/progress-navigation`;
  let cursor: string | null = null, result: ProgressNavigation | undefined;
  const seen = new Set<string>();
  do {
    const page: ProgressNavigation = await read(actor, base + (cursor ? `?after=${encodeURIComponent(cursor)}` : ""), signal);
    if (page.experienceId !== experienceId || page.viewerUserId !== actor || result && !sameAuthority(result, page)) throw new GroupRequestError("GROUP_CONTEXT_CONFLICT", 409);
    if (cursor && seen.has(cursor)) throw new Error("Invalid Group roster page"); if (cursor) seen.add(cursor);
    result = result ? { ...result, followers: [...result.followers, ...page.followers] } : page;
    cursor = page.nextCursor;
  } while (cursor);
  const latest: ProgressNavigation = await read(actor, base, signal);
  if (!sameAuthority(result!, latest)) throw new GroupRequestError("GROUP_CONTEXT_CONFLICT", 409);
  const unique = new Map(result!.followers.map(row => [row.userId, row]));
  if (unique.size !== (result!.capabilities.canInspectFollowers ? result!.activeFollowerCount : result!.isFollower ? 1 : 0)) throw new Error("Group roster changed. Refresh Progress.");
  return { ...result!, followers: [...unique.values()], nextCursor: null };
}
export async function readScopedProgress(actor: string, experienceId: string, frameworkId: string, perspective: ProgressPerspective, signal?: AbortSignal) {
  const query = perspective.kind === "player" ? `?${new URLSearchParams({ subjectUserId: perspective.userId })}` : "";
  const value = await groupFetch<GroupProgressSummary>(actor, `/api/group-experiences/${encodeURIComponent(experienceId)}/frameworks/${encodeURIComponent(frameworkId)}/summary${query}`, signal);
  if (value.experienceId !== experienceId || value.frameworkId !== frameworkId || JSON.stringify(value.perspective) !== JSON.stringify(perspective)
    || !value.framework || value.framework.frameworkId !== frameworkId || !Array.isArray(value.framework.areas)
    || !Number.isFinite(Date.parse(value.leaseExpiresAt)) || Date.parse(value.leaseExpiresAt) <= Date.now()) throw new GroupRequestError("GROUP_CONTEXT_CONFLICT", 409);
  return value;
}
