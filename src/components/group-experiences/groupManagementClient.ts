import { groupFetch } from "./groupClient";
export type GroupFormValues = { name: string; adminIds: string[]; followerIds: string[]; allowFollowerInspection: boolean };
export type GroupSettings = GroupFormValues & { expectedStructureRevision: number };
export type ManagementResult = { viewerUserId: string; experienceId: string; hasAccess: boolean; outcome: string };
type Meta = { structureRevision: number; name: string; allowFollowerInspection: boolean; isAdmin: boolean };
type Roster = { structureRevision: number; members: { userId: string; username: string; isAdmin: boolean; followerStatus: string }[]; nextCursor: string | null };
export async function loadGroupSettings(actor: string, experienceId: string, signal?: AbortSignal): Promise<GroupSettings> {
  const base = `/api/group-experiences/${encodeURIComponent(experienceId)}`;
  const meta = await groupFetch<Meta>(actor, base, signal);
  if (!meta.isAdmin) throw Error("Only Group Admins can change these settings.");
  const members: Roster["members"] = []; let cursor: string | null = null;
  do {
    const page: Roster = await groupFetch(actor, `${base}/members?limit=100${cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`, signal);
    if (page.structureRevision !== meta.structureRevision) throw Error("Group membership changed while loading. Please retry.");
    members.push(...page.members); cursor = page.nextCursor;
  } while (cursor);
  const final = await groupFetch<Meta>(actor, base, signal);
  if (!final.isAdmin || final.structureRevision !== meta.structureRevision) throw Error("Group settings changed while loading. Please retry.");
  return { name: meta.name, allowFollowerInspection: meta.allowFollowerInspection, expectedStructureRevision: meta.structureRevision,
    adminIds: members.filter(row => row.isAdmin).map(row => row.userId), followerIds: members.filter(row => row.followerStatus === "active").map(row => row.userId) };
}

// Move only the newly created Group; never sort or otherwise disturb the
// existing personal/Group ordering. The destination verifies the ID is assigned.
export function promoteCreatedGroup<T extends { id: string }>(entries: T[], id: string | null): T[] {
  const created = entries.find(row => row.id === id);
  return created ? [created, ...entries.filter(row => row.id !== id)] : entries;
}
