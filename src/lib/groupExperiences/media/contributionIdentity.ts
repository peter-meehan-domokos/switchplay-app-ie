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
