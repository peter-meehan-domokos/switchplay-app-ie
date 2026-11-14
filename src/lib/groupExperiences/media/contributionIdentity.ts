// Group media contribution identity (checkpoint 4.0).
//
// Every Group media contribution records the perspective it was created in, as `creationContext`:
//   "self"  — created by a follower in their Me perspective (a Follower contribution);
//   "group" — created by an admin in the Group perspective (an Admin contribution).
//
// The two have different cross-context visibility on purpose:
//   - Follower contributions are the author's own learning record. They join the author's cross-context history
//     for the same Card: the standalone Card, Me in every Group (marked private outside their origin) and
//     inspection of that follower, as well as their originating Group feed.
//   - Admin contributions are made on behalf of the Group. They belong only to their originating Group
//     perspective and never appear on the author's standalone Card, in another Group, in the author's Me, or
//     when anyone inspects the author as a follower.
//   - A user who is both admin and follower has two separate identities. Their Admin contributions are not
//     theirs as a follower, and the reverse: each is listed, counted and deleted only by its own identity.
//   - Classification comes from the stored creation perspective, never from the author's current role. A
//     promotion or demotion after creation changes nothing; the server only checks the role at creation.
//   - A record without `creationContext` predates this field and was created by a follower (verified against
//     the existing data), so it reads as "self". No migration.
//   - Info Cards in Group Experiences must follow the same distinction, using these same helpers.
//
// Creation-context management (checkpoint 4.2b, decisions C1 to C4):
//   - An item is edited or permanently deleted only by its author, in the exact context where it was created:
//     the standalone Card, Group A Me ("self" in A) or Group A Group ("group" in A). Group A and Group B are
//     different contexts even for the same Card template.
//   - The stored record is the only authority for that context: a Group record carries experienceId and
//     creationContext, a standalone item is identified by living in CardData. A client never declares it.
//   - Visibility and hiding do not follow this rule. Admins still hide any contribution from their Group.
//   - The interface decides where Edit, Remove and Delete appear (sameOrigin); the server checks the author and
//     the current role in the originating Group (identityRole) on every write.
//
// Every owner-history read, follower inspection, delete permission and "own" count uses this module, so the rule
// lives in one place. It is pure and shared by the server and the client.
export type CreationContext = "self" | "group";

export function isCreationContext(value: unknown): value is CreationContext {
  return value === "self" || value === "group";
}
export function creationContextOf(row: { creationContext?: CreationContext | null }): CreationContext {
  return row.creationContext === "group" ? "group" : "self";
}
// Mongo condition selecting Follower contributions only, a missing value counting as "self". Used for owner
// history, owner previews and follower inspection.
export const FOLLOWER_CONTRIBUTIONS = { creationContext: { $ne: "group" as const } };
// Admin contributions also reach the Me perspective of every active follower of their Group (V1, checkpoint 4.5).
// A later per-contribution option (V6) may keep one in the Group perspective only, stored as `audience`. Nothing
// writes it yet; a missing value means the contribution is shown in followers' Me, so the option needs no migration.
export type ContributionAudience = "group-perspective-only";
export const GROUP_PERSPECTIVE_ONLY: ContributionAudience = "group-perspective-only";
// Mongo condition selecting the Admin contributions that followers see in Me (with experienceId and the Card added).
export const ADMIN_CONTRIBUTIONS_FOR_FOLLOWERS = { creationContext: "group" as const, audience: { $ne: GROUP_PERSPECTIVE_ONLY } };
// Mongo condition selecting the contributions of one identity of one author.
export function identityFilter(authorUserId: string, identity: CreationContext) {
  return identity === "group" ? { authorUserId, creationContext: "group" as const } : { authorUserId, ...FOLLOWER_CONTRIBUTIONS };
}
// The identity a viewer acts as in a perspective: the Group perspective is the Admin identity; Me and the
// standalone Card are the Follower identity. Inspecting another follower acts as no contributing identity.
export function viewerIdentity(perspective: { kind: "owner" } | { kind: "group"; subjectUserId?: string | null }): CreationContext {
  return perspective.kind === "group" && !perspective.subjectUserId ? "group" : "self";
}
export function sameIdentity(item: { authorUserId: string; creationContext?: CreationContext | null }, viewerUserId: string, identity: CreationContext) {
  return item.authorUserId === viewerUserId && creationContextOf(item) === identity;
}

// The exact context an item was created in (C1).
export type CreationOrigin = { kind: "standalone" } | { kind: "group"; experienceId: string; identity: CreationContext };
export const STANDALONE_ORIGIN: CreationOrigin = { kind: "standalone" };
// A media item: personal sources live in CardData; Group sources carry their Group and stored identity.
export function mediaOrigin(item: { source: { kind: "personal" } | { kind: "group"; experienceId: string }; creationContext?: CreationContext | null }): CreationOrigin {
  return item.source.kind === "group" ? { kind: "group", experienceId: item.source.experienceId, identity: creationContextOf(item) } : STANDALONE_ORIGIN;
}
// An Info Card note: a Group root carries its Group and stored identity; anything else is standalone.
export function infoCardOrigin(root: { kind?: string; experienceId?: string | null; creationContext?: CreationContext | null }): CreationOrigin {
  return root.kind === "group" && typeof root.experienceId === "string" ? { kind: "group", experienceId: root.experienceId, identity: creationContextOf(root) } : STANDALONE_ORIGIN;
}
// The context a viewer is acting in: no Group is the standalone Card; in a Group, the identity of the perspective.
export function actingOrigin(experienceId: string | undefined | null, identity: CreationContext): CreationOrigin {
  return experienceId ? { kind: "group", experienceId, identity } : STANDALONE_ORIGIN;
}
export function sameOrigin(a: CreationOrigin, b: CreationOrigin) {
  return a.kind === "standalone" ? b.kind === "standalone" : b.kind === "group" && a.experienceId === b.experienceId && a.identity === b.identity;
}
// The Group role an identity needs to act: an admin for Admin contributions, an active follower for Follower ones.
export function identityRole(identity: CreationContext): "admin" | "follower" {
  return identity === "group" ? "admin" : "follower";
}
// The read-only "Created in" name shown outside an item's creation context.
export function originLabel(origin: CreationOrigin, groupName?: string | null) {
  if (origin.kind === "standalone") return "Personal Card";
  return `${groupName?.trim() || "Group unavailable"} · ${origin.identity === "group" ? "Group" : "Me"}`;
}
