import assert from "node:assert/strict";
import { test } from "node:test";
import { groupDeckHref, readGroupDeckReturn, rememberGroupReturn, recalledGroupHref, withProgressReturn, readProgressReturn, progressReturnHref } from "../src/lib/frameworks/progressNavigation";
import { progressChoices, defaultProgressPerspective, readProgressNavigationPages, type ProgressNavigation } from "../src/lib/groupExperiences/progressClient";
import { createGroupProgressResource } from "../src/components/progress/groupProgressResource";
import type { GroupProgressSummary } from "../src/lib/groupExperiences/progressReads";

function navigation(follower = true): ProgressNavigation { return { viewerUserId: "alice", experienceId: "A", structureRevision: 0, adoptionRevision: 0, accessEpoch: 0,
  name: "A", isFollower: follower, capabilities: { canInspectFollowers: true, canViewConfidenceExtrema: true, canManageGroupAssessments: true, canManageMembers: true },
  followers: [{ userId: "alice", username: "Alice" }, { userId: "bob", username: "Bob" }], activeFollowerCount: 2, nextCursor: null }; }
const response = (perspective: GroupProgressSummary["perspective"], lease = 60000) => ({ viewerUserId: "alice", experienceId: "A", frameworkId: "skills", perspective,
  structureRevision: 0, adoptionRevision: 0, accessEpoch: 0, leaseExpiresAt: new Date(Date.now() + lease).toISOString(), framework: { frameworkId: "skills", title: perspective.kind === "group" ? "Group" : perspective.userId, areas: [] } }) as unknown as GroupProgressSummary;

test("Group Back preserves physical scene and rejects forged storage or another experience", () => {
  const scene = { experienceId: "A", cardId: "card", rotation: 540, focused: true, selection: { perspective: "follower" as const, subjectUserId: "bob" } };
  const href = groupDeckHref(scene), restored = readGroupDeckReturn(new URL(href, "http://local").searchParams, "A")!;
  assert.equal(restored.rotation, 180); assert.equal(restored.focused, true); assert.deepEqual(restored.selection, scene.selection);
  assert.equal(readGroupDeckReturn(new URL(href, "http://local").searchParams, "B"), undefined);
  const storage = new Map<string, string>(), adapter = { setItem: (key: string, value: string) => { storage.set(key, value); }, getItem: (key: string) => storage.get(key) ?? null };
  rememberGroupReturn(adapter, "alice", scene); assert.equal(recalledGroupHref(adapter, "alice", "A"), href);
  assert.equal(recalledGroupHref(adapter, "bob", "A"), "/decks?openExperience=A");
  storage.forEach((_value, key) => storage.set(key, "https://evil.invalid/decks?openExperience=A"));
  assert.equal(recalledGroupHref(adapter, "alice", "A"), "/decks?openExperience=A");
});
test("normal Progress remains personal while fixed Group return retains explicit selected player", () => {
  assert.equal(progressReturnHref({ frameworkId: "skills" }), "/progress?framework=skills");
  const href = withProgressReturn("/decks?openExperience=A", { frameworkId: "skills", areaId: "area", experienceId: "A", subjectUserId: "bob" });
  const value = readProgressReturn(new URL(href, "http://local").searchParams)!;
  assert.equal(progressReturnHref(value), "/group-experiences/A/progress?framework=skills&area=area&subjectUserId=bob");
  assert.match(progressReturnHref({ frameworkId: "skills", experienceId: "A" }), /perspective=group/);
});
test("follower-first defaults include dual roles and authorised choices never duplicate self", () => {
  const nav = navigation(); assert.deepEqual(defaultProgressPerspective("alice", nav), { kind: "player", userId: "alice" });
  assert.deepEqual(defaultProgressPerspective("alice", navigation(false)), { kind: "group" });
  assert.deepEqual(progressChoices("alice", nav).map(choice => choice.label), ["Group", "My Progress in Group", "Bob"]);
});
test("roster pages require consistent authority and include all active followers", async () => {
  const nav = navigation(); let reads = 0;
  const read = async () => { reads++; return reads === 2 ? { ...nav, followers: nav.followers.slice(1), nextCursor: null } : { ...nav, followers: nav.followers.slice(0, 1), nextCursor: "next" }; };
  const result = await readProgressNavigationPages("alice", "A", undefined, read as never);
  assert.equal(result.followers.length, 2); assert.equal(reads, 3);
  await assert.rejects(readProgressNavigationPages("alice", "A", undefined, (async () => ({ ...nav, experienceId: "B" })) as never));
});
test("rapid perspective selection cancels obsolete reads and keeps live roster controls without stale subject payloads", async () => {
  let release!: (value: GroupProgressSummary) => void;
  const resource = createGroupProgressResource("alice", "A", { navigation: async () => navigation(), summary: async (_actor, _group, _framework, target) => target.kind === "player" && target.userId === "bob"
    ? new Promise(resolve => { release = resolve; }) : response(target) });
  try {
    await resource.change("skills"); assert.equal(resource.snapshot().data!.perspective.kind, "player");
    const pending = resource.change("skills", { kind: "player", userId: "bob" });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(resource.snapshot().data, undefined); assert.equal(resource.snapshot().verified, true);
    await resource.change("skills", { kind: "group" }); release(response({ kind: "player", userId: "bob" })); await pending;
    assert.equal(resource.snapshot().data!.perspective.kind, "group");
  } finally { resource.dispose(); }
});
test("authority expiry hides cached values and a removed subject is replaced by the authorised default", async () => {
  let nav = navigation();
  const resource = createGroupProgressResource("alice", "A", { navigation: async () => nav, summary: async (_actor, _group, _framework, target) => response(target, 50) });
  try {
    await resource.change("skills", { kind: "player", userId: "bob" });
    await new Promise(resolve => setTimeout(resolve, 80)); assert.equal(resource.snapshot().data, undefined); assert.equal(resource.snapshot().verified, false);
    nav = { ...nav, followers: nav.followers.slice(0, 1), activeFollowerCount: 1 }; await resource.load();
    assert.deepEqual(resource.snapshot().perspective, { kind: "player", userId: "alice" });
  } finally { resource.dispose(); }
});
