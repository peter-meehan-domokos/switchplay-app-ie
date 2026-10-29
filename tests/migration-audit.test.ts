import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { BSON, ObjectId } from "mongodb";
import {
  auditSources, compareManifests, failureDiagnostics, fingerprint, main, readSources, SOURCE_PROJECTIONS, sourceManifest, writeReports,
} from "../scripts/audit-pre-library-migration.mjs";

const cleanFixture = JSON.parse(readFileSync(new URL("./fixtures/migration-audit-clean.json", import.meta.url), "utf8"));
function fixture() { return structuredClone(cleanFixture); }
type Sources = typeof cleanFixture;
function codes(sources: Sources) { return auditSources(sources).findings.map((entry: { code: string }) => entry.code); }
function personalImage() {
  return { id: "personal-image", mediaType: "image", provider: "cloudflare-r2", assetId: "legacy/deck/card/upload.webp", src: "https://assets.example.com/upload.webp", description: "Uploaded image" };
}

test("clean raw source is ready; null and real 1 remain intact, and empty suggested dates are valid", () => {
  const sources = fixture();
  const before = structuredClone(sources);
  const result = auditSources(sources);
  assert.equal(result.summary.readiness.status, "ready");
  assert.equal(result.summary.legacySourceAccounting.everyPersonalCardAccountedFor, true);
  assert.equal(result.summary.readiness.everyMediaBearingCardMapped, true);
  assert.equal(result.summary.readiness.everyPersonalMediaItemSafelyPreservable, true);
  assert.equal(result.summary.sourceCounts.emptySuggestedDates, 1);
  assert.equal(result.summary.sourceCounts.positionalSignalReadings, 3);
  assert.equal(result.summary.sourceCounts.unexpectedSignalIds, 0);
  assert.equal(result.summary.sourceCounts.legacySignalDefinitions, 0);
  assert.deepEqual(sources, before);
});

const cases: Array<[string, (sources: Sources) => void, string]> = [
  ["duplicate local Card", (s) => s.deckTemplates[0].template.cards.push(structuredClone(s.deckTemplates[0].template.cards[0])), "DUPLICATE_LOCAL_CARD_ID"],
  ["missing Step array", (s) => delete s.deckTemplates[0].template.cards[0].steps, "MISSING_STEP_ARRAY"],
  ["two Steps", (s) => s.deckTemplates[0].template.cards[0].steps.pop(), "STEP_COUNT_NOT_THREE"],
  ["malformed Step", (s) => s.deckTemplates[0].template.cards[0].steps[0] = null, "MALFORMED_STEP"],
  ["missing Step ID", (s) => s.deckTemplates[0].template.cards[0].steps[0].stepId = "", "MISSING_STEP_ID"],
  ["duplicate Step ID", (s) => s.deckTemplates[0].template.cards[0].steps[1].stepId = "fixture-step-1", "DUPLICATE_STEP_ID_IN_CARD"],
  ["orphan personal Card", (s) => s.users[0].decksData[0].cards[0].cardId = "removed-card", "ORPHAN_OR_AMBIGUOUS_PERSONAL_CARD"],
  ["invalid date", (s) => s.users[0].decksData[0].cards[0].targetDate = "2026-02-30", "INVALID_TARGET_DATE"],
  ["unexpected Signal ID", (s) => s.users[0].decksData[0].cards[0].signalReadings[0].signalId = "old-signal", "UNEXPECTED_SIGNAL_ID"],
  ["duplicate Signal reading", (s) => s.users[0].decksData[0].cards[0].signalReadings.push({ signalId: "0", reading: 4 }), "DUPLICATE_SIGNAL_ID"],
  ["stale active Card", (s) => s.users[0].decksData[0].activeCardId = "removed-card", "UNRESOLVED_ACTIVE_CARD"],
  ["root/template mismatch", (s) => s.deckTemplates[0].template.deckTemplateId = "different-deck", "ROOT_TEMPLATE_ID_MISMATCH"],
  ["unknown completion Step", (s) => s.users[0].decksData[0].cards[0].items[0].itemId = "missing-step", "UNKNOWN_COMPLETION_STEP"],
  ["invalid timestamp", (s) => s.users[0].decksData[0].createdAt = "2026-02-30T00:00:00Z", "INVALID_TIMESTAMP"],
];
for (const [name, mutate, expectedCode] of cases) {
  test(`detects ${name}`, () => { const sources = fixture(); mutate(sources); assert.ok(codes(sources).includes(expectedCode)); });
}

test("repeated local Card IDs across Decks are expected; repeated Step IDs across Cards are separately warned", () => {
  const sources = fixture();
  const second = structuredClone(sources.deckTemplates[0]);
  second._id = "second-document";
  second.deckTemplateId = "second-deck";
  second.template.deckTemplateId = "second-deck";
  sources.deckTemplates.push(second);
  const result = auditSources(sources);
  assert.ok(!result.findings.some((entry: { code: string }) => entry.code === "DUPLICATE_LOCAL_CARD_ID"));
  assert.equal(result.findings.filter((entry: { code: string }) => entry.code === "STEP_ID_REUSED_ACROSS_CARDS").length, 3);
  assert.equal(result.summary.sourceCounts.expectedMembershipAdditions, 1);
});

test("duplicate DeckData reports conflicting Card state and ambiguous membership, even when IDs match", () => {
  const sources = fixture();
  const duplicate = structuredClone(sources.users[0].decksData[0]);
  duplicate.cards[0].targetDate = "2027-01-01";
  sources.users[0].decksData.push(duplicate);
  const result = auditSources(sources);
  const finding = result.findings.find((entry: { code: string }) => entry.code === "DUPLICATE_USER_DECK_DATA");
  assert.deepEqual(finding?.details.conflictingCardIds, ["card-001"]);
  assert.equal(result.summary.readiness.status, "blocked");
});

test("obsolete live Signal definitions are discarded information, while savedTemplate/previousVersions are ignored", () => {
  const sources = fixture();
  sources.deckTemplates[0].savedTemplate = { signals: [{ signalId: "ignored-draft" }] };
  sources.deckTemplates[0].previousVersions = [{ template: { signals: [{ signalId: "ignored-history" }] } }];
  assert.equal(auditSources(sources).summary.sourceCounts.legacySignalFields, 0);
  sources.deckTemplates[0].template.cards[0].signals = [{ signalId: "obsolete" }];
  const result = auditSources(sources);
  assert.equal(result.summary.sourceCounts.liveCardsWithLegacySignalFields, 1);
  assert.equal(result.summary.sourceCounts.legacySignalDefinitions, 1);
  assert.ok(result.findings.some((entry: { path: string }) => entry.path === "template.cards[0].signals"));
  assert.equal(result.summary.readiness.status, "ready");
  assert.equal(result.findings.find((entry: { code: string }) => entry.code === "OBSOLETE_TEMPLATE_SIGNAL_FIELD")?.severity, "information");
});

test("custom/mixed/skipped labels need decisions, including a consistent prefix with wrong position numbers", () => {
  for (const label of ["Custom content", "Stage 2", "Card 9"]) {
    const sources = fixture();
    sources.deckTemplates[0].template.cards[0].label = label;
    assert.ok(codes(sources).includes("CARD_LABEL_DECISION"));
  }
  const sources = fixture();
  const second = structuredClone(sources.deckTemplates[0].template.cards[0]);
  second.cardId = "card-002";
  second.label = "Stage 2";
  sources.deckTemplates[0].template.cards.push(second);
  assert.ok(codes(sources).includes("CARD_LABEL_DECISION"));
});

test("absent Card state does not imply media; uninspectable DeckData prevents membership/media accounting", () => {
  const sources = fixture();
  sources.users[0].decksData[0].cards = null;
  assert.equal(auditSources(sources).summary.legacySourceAccounting.everyPersonalCardAccountedFor, false);
  assert.equal(auditSources(sources).summary.readiness.status, "ready");
  sources.users[0].decksData = null;
  assert.equal(auditSources(sources).summary.readiness.mediaAccountingComplete, false);
  const zero = fixture();
  zero.deckTemplates[0].template.cards = [];
  assert.ok(codes(zero).includes("ZERO_CARD_DECK"));
  const finding = auditSources(zero).findings.find((entry: { code: string }) => entry.code === "UNRESOLVED_ACTIVE_CARD");
  assert.equal(finding?.details.zeroCardDeck, true);
});

test("readings are not coerced/clamped and missing positions are reported without inventing readings", () => {
  const sources = fixture();
  sources.users[0].decksData[0].cards[0].signalReadings = [{ signalId: "0", reading: 11 }, { signalId: "1", reading: "1" }];
  const result = auditSources(sources);
  assert.ok(codes(sources).includes("SIGNAL_OUT_OF_RANGE"));
  assert.ok(codes(sources).includes("MALFORMED_SIGNAL_VALUE"));
  assert.ok(codes(sources).includes("MISSING_POSITIONAL_READINGS"));
  assert.equal(result.summary.sourceCounts.signalReadings, 2);
  assert.equal(sources.users[0].decksData[0].cards[0].signalReadings[0].reading, 11);
});

test("orphan personal Card without media is discarded information and does not block readiness", () => {
  const sources = fixture();
  sources.users[0].decksData[0].cards[0].cardId = "removed-card";
  const result = auditSources(sources);
  const orphan = result.findings.find((entry: { code: string }) => entry.code === "ORPHAN_OR_AMBIGUOUS_PERSONAL_CARD");
  assert.equal(orphan?.severity, "information");
  assert.equal(orphan?.impact, "discarded-learning-state");
  assert.equal(orphan?.details.containsMedia, false);
  assert.equal(result.summary.readiness.status, "ready");
  assert.equal(result.summary.legacySourceAccounting.everyPersonalCardAccountedFor, false);
});

test("orphan media-bearing Card blocks preservation and counts its unknown destination", () => {
  const sources = fixture();
  const card = sources.users[0].decksData[0].cards[0];
  card.cardId = "removed-card";
  card.mediaItems = [personalImage()];
  const result = auditSources(sources);
  const orphan = result.findings.find((entry: { code: string }) => entry.code === "ORPHAN_OR_AMBIGUOUS_PERSONAL_CARD");
  assert.equal(orphan?.severity, "blocker");
  assert.equal(orphan?.impact, "personal-media");
  assert.equal(orphan?.details.containsMedia, true);
  assert.equal(result.summary.sourceCounts.orphanedMediaBearingCardStates, 1);
  assert.equal(result.summary.sourceCounts.personalMediaItemsWithUnknownDestination, 1);
  assert.equal(result.summary.sourceCounts.safePersonalMediaItems, 0);
  assert.equal(result.summary.readiness.canonicalStructurallyMigratable, true);
  assert.equal(result.summary.readiness.everyMediaBearingCardMapped, false);
  assert.equal(result.summary.readiness.mediaPreservationBlockers, 1);
  assert.equal(result.summary.readiness.status, "blocked");
});

test("ambiguous local Card identity blocks canonical migration and media destination accounting", () => {
  const sources = fixture();
  sources.deckTemplates[0].template.cards.push(structuredClone(sources.deckTemplates[0].template.cards[0]));
  sources.users[0].decksData[0].cards[0].mediaItems = [personalImage()];
  const result = auditSources(sources);
  assert.equal(result.summary.sourceCounts.ambiguousMediaBearingCardStates, 1);
  assert.equal(result.summary.sourceCounts.safePersonalMediaItems, 0);
  assert.equal(result.summary.readiness.canonicalStructurallyMigratable, false);
});

test("legacy Signal IDs, duplicate readings, stale completion and other discarded learning state do not block", () => {
  const sources = fixture();
  const card = sources.users[0].decksData[0].cards[0];
  card.signalReadings = [{ signalId: "old-signal", reading: "invalid" }, { signalId: "old-signal", reading: 99 }];
  card.items = [{ itemId: "missing-step", completionStatus: "invalid" }, { itemId: "missing-step", completionStatus: "done" }, null];
  card.targetDate = "2026-02-30";
  card.reflection = {};
  card.chats = [{ id: "invalid-chat", comments: null }];
  sources.deckTemplates[0].template.cards[0].signals = [{ signalId: "obsolete" }];
  const before = structuredClone(sources);
  const result = auditSources(sources);
  assert.equal(result.summary.readiness.status, "ready");
  assert.equal(result.summary.findingCounts.bySeverity.blocker, 0);
  assert.ok(result.summary.readiness.intentionallyDiscardedLearningStateAnomalies >= 10);
  assert.equal(result.summary.sourceCounts.unexpectedSignalIds, 2);
  assert.equal(result.summary.sourceCounts.legacySignalDefinitions, 1);
  assert.equal("everySignalReadingAttributable" in result.summary.readiness, false);
  assert.equal(result.summary.preservationPolicy.futureInitialization.completionStatus, "todo");
  assert.equal(result.summary.preservationPolicy.futureInitialization.signalReading, null);
  assert.deepEqual(sources, before);
  card.items = null;
  assert.equal(auditSources(sources).summary.readiness.status, "ready");
});

test("clean media-bearing Card preserves trusted references and is counted as automatically safe", () => {
  const sources = fixture();
  sources.users[0].decksData[0].cards[0].mediaItems = [personalImage()];
  const before = structuredClone(sources);
  const result = auditSources(sources);
  const counts = result.summary.sourceCounts;
  assert.equal(counts.mediaBearingPersonalCardStates, 1);
  assert.equal(counts.mappedMediaBearingCardStates, 1);
  assert.equal(counts.totalPersonalMediaItems, 1);
  assert.equal(counts.safePersonalMediaItems, 1);
  assert.equal(counts.malformedPersonalMediaItems, 0);
  assert.equal(result.summary.readiness.everyPersonalMediaItemSafelyPreservable, true);
  assert.equal(result.summary.readiness.status, "ready");
  assert.deepEqual(sources, before);
});

test("malformed personal media blocks preservation even when its destination is known", () => {
  const sources = fixture();
  sources.users[0].decksData[0].cards[0].mediaItems = [{ ...personalImage(), src: "not-a-url" }, null];
  const result = auditSources(sources);
  assert.equal(result.summary.sourceCounts.totalPersonalMediaItems, 2);
  assert.equal(result.summary.sourceCounts.malformedPersonalMediaItems, 2);
  assert.equal(result.summary.sourceCounts.safePersonalMediaItems, 0);
  assert.equal(result.summary.readiness.everyMediaBearingCardMapped, true);
  assert.equal(result.summary.readiness.everyPersonalMediaItemSafelyPreservable, false);
  assert.equal(result.summary.readiness.mediaPreservationBlockers, 2);
  assert.equal(result.summary.readiness.status, "blocked");
});

test("non-array media containers block accounting, while missing media arrays do not", () => {
  const sources = fixture();
  const card = sources.users[0].decksData[0].cards[0];
  delete card.mediaItems;
  assert.equal(auditSources(sources).summary.readiness.status, "ready");
  card.mediaItems = { unexpected: personalImage() };
  const result = auditSources(sources);
  assert.equal(result.summary.readiness.mediaAccountingComplete, false);
  assert.equal(result.summary.sourceCounts.uninspectablePersonalMediaContainers, 1);
  assert.equal(result.summary.readiness.status, "blocked");
  sources.users[0].decksData[0].cards = { unexpected: card };
  assert.equal(auditSources(sources).summary.readiness.mediaAccountingComplete, false);
});

test("duplicate personal Card learning state is harmless; conflicting retained media IDs require review", () => {
  const sources = fixture();
  const card = sources.users[0].decksData[0].cards[0];
  const duplicate = structuredClone(card);
  duplicate.targetDate = "2027-01-01";
  sources.users[0].decksData[0].cards.push(duplicate);
  assert.equal(auditSources(sources).summary.readiness.status, "ready");
  card.mediaItems = [personalImage()];
  duplicate.mediaItems = [{ ...personalImage(), assetId: "different-asset", src: "https://assets.example.com/different.webp" }];
  const result = auditSources(sources);
  assert.ok(result.findings.some((entry: { code: string; severity: string }) => entry.code === "MEDIA_ID_CONFLICT" && entry.severity === "blocker"));
  assert.equal(result.summary.sourceCounts.mappedMediaBearingCardStates, 2);
  assert.equal(result.summary.sourceCounts.safePersonalMediaItems, 0);
  assert.equal(result.summary.readiness.status, "blocked");
});

test("canonical content and media corruption remain blockers despite discarded personal state", () => {
  for (const corrupt of [
    (s: Sources) => { s.deckTemplates[0].template.cards[0].intro = null; },
    (s: Sources) => { s.deckTemplates[0].template.cards[0].steps[0].description = {}; },
    (s: Sources) => { s.deckTemplates[0].template.cards[0].intro.mediaItem = { ...personalImage(), src: "invalid" }; },
  ]) {
    const sources = fixture();
    corrupt(sources);
    const result = auditSources(sources);
    assert.equal(result.summary.readiness.canonicalStructurallyMigratable, false);
    assert.equal(result.summary.readiness.status, "blocked");
  }
});

test("manifests hash decoded BSON, ignore credentials/snapshots, and retain sharing values and array order", () => {
  const sources = fixture();
  sources.deckTemplates[0]._id = new ObjectId("507f1f77bcf86cd799439011");
  sources.deckTemplates[0].createdAt = new Date("2026-01-01T00:00:00Z");
  const before = sourceManifest(sources);
  sources.users[0].passwordHash = "excluded-password";
  sources.deckTemplates[0].savedTemplate = { title: "excluded-draft" };
  assert.deepEqual(sourceManifest(sources), before);
  const userManifest = before.find((entry: { collection: string }) => entry.collection === "users");
  assert.equal(userManifest?.sharing.find((entry: { path: string }) => entry.path === "sharedDeckData")?.hash, fingerprint([]));
  assert.notEqual(fingerprint(undefined), fingerprint(null));
  assert.equal(fingerprint({ a: 1, b: 2 }), fingerprint({ b: 2, a: 1 }));
  assert.notEqual(fingerprint([1, 2]), fingerprint([2, 1]));
  assert.doesNotThrow(() => BSON.EJSON.stringify(before));
});

test("second scan detects changed, added and removed sources and makes readiness require review", () => {
  const sources = fixture();
  const before = sourceManifest(sources);
  sources.deckTemplates[0].template.title = "Changed";
  const drift = compareManifests(before, sourceManifest(sources));
  assert.equal(drift[0].change, "changed");
  const result = auditSources(sources, { drift });
  assert.equal(result.summary.drift.status, "potentially changed during scan");
  assert.equal(result.summary.readiness.status, "review-required");
  assert.equal(compareManifests(before, [])[0].change, "removed");
  assert.equal(compareManifests([], before)[0].change, "added");
});

test("Mongo read adapter only performs projected finds, cursor sort and materialization", async () => {
  const calls: unknown[] = [];
  const database = { collection(name: string) {
    calls.push(["collection", name]);
    return { find(filter: unknown, options: unknown) {
      calls.push(["find", filter, options]);
      return { sort(order: unknown) { calls.push(["sort", order]); return { async toArray() { return []; } }; } };
    } };
  } };
  await readSources(database);
  assert.deepEqual(calls, Object.entries(SOURCE_PROJECTIONS).flatMap(([name, projection]) => [
    ["collection", name], ["find", {}, { projection, batchSize: 200, maxTimeMS: 60_000 }], ["sort", { _id: 1 }],
  ]));
});

test("reports contain no credentials, free-text bodies or asset URLs; sharing remains fingerprinted", async () => {
  const sources = fixture();
  sources.users[0].passwordHash = "PASSWORD-SECRET";
  sources.users[0].email = "PRIVATE-EMAIL";
  const card = sources.users[0].decksData[0].cards[0];
  card.reflection = "REFLECTION-SECRET";
  card.chats = [{ id: "chat-1", comments: [{ id: "comment-1", creatorId: "fixture-owner", text: "CHAT-SECRET", isRetained: true, createdAt: "2026-01-01T00:00:00Z" }] }];
  card.mediaItems = [{ id: "image-1", mediaType: "image", description: "MEDIA-SECRET", provider: "cloudflare-r2", assetId: "some-key", src: "https://private.example.com/ASSET-SECRET?token=SECRET" }];
  sources.users[0].sharedDeckData = [{ deckTemplateId: "fixture-deck", deckUserId: "other-user" }];
  const directory = await mkdtemp(join(tmpdir(), "switchplay-audit-reports-"));
  await writeReports(auditSources(sources), directory);
  const files = await readdir(directory);
  assert.equal(files.length, 5);
  const allReports = (await Promise.all(files.map((file) => readFile(join(directory, file), "utf8")))).join("\n");
  for (const secret of ["PASSWORD-SECRET", "PRIVATE-EMAIL", "REFLECTION-SECRET", "CHAT-SECRET", "MEDIA-SECRET", "ASSET-SECRET", "token=SECRET"]) assert.ok(!allReports.includes(secret));
  assert.equal(auditSources(sources).summary.sourceCounts.chatsWithRecoverableDeckContext, 1);
  assert.equal((await stat(join(directory, "summary.json"))).mode & 0o777, 0o600);
});

test("CLI fixture mode writes complete reports without connection config; missing config fails before connecting", async () => {
  const directory = await mkdtemp(join(tmpdir(), "switchplay-audit-cli-"));
  const env = { ...process.env };
  delete env.MONGODB_URI;
  delete env.MONGODB_DB;
  const args = ["scripts/audit-pre-library-migration.mjs", "--fixtures", "tests/fixtures/migration-audit-clean.json", "--output", directory];
  const run = spawnSync(process.execPath, args, { env, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const [runDirectory] = await readdir(directory);
  const summary = JSON.parse(await readFile(join(directory, runDirectory, "summary.json"), "utf8"));
  assert.deepEqual(summary.mongoOperations, []);
  assert.equal(JSON.parse(await readFile(join(directory, runDirectory, "run-status.json"), "utf8")).status, "complete");
  const missing = spawnSync(process.execPath, ["scripts/audit-pre-library-migration.mjs"], { env, encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.ok(missing.stderr.includes("MONGODB_URI and MONGODB_DB"));
});

test("unknown owner membership is blocked rather than silently counted as an expected addition", () => {
  const sources = fixture();
  sources.users[0].decksData = null;
  const result = auditSources(sources);
  assert.equal(result.summary.sourceCounts.expectedMembershipAdditions, 0);
  assert.equal(result.summary.sourceCounts.ambiguousMembershipCandidates, 1);
  assert.ok(codes(sources).includes("AMBIGUOUS_OWNER_MEMBERSHIP"));
});

test("duplicate root Deck IDs cannot silently select a source for personal state", () => {
  const sources = fixture();
  const duplicate = structuredClone(sources.deckTemplates[0]);
  duplicate._id = "duplicate-root";
  sources.deckTemplates.push(duplicate);
  const result = auditSources(sources);
  assert.ok(codes(sources).includes("DUPLICATE_DECK_TEMPLATE_ID"));
  assert.equal(result.summary.legacySourceAccounting.everyPersonalCardAccountedFor, false);
});

test("providerless images stay valid, malformed videos/chats/sharing are counted and fingerprinted", () => {
  const sources = fixture();
  sources.deckTemplates[0].template.introduction = { image: { id: "legacy-image", mediaType: "image", description: "Legacy image", src: "/images/legacy.png" }, video: null };
  assert.ok(!codes(sources).includes("MALFORMED_MEDIA"));
  sources.users[0].decksData[0].cards[0].mediaItems = [{ id: "bad-video", mediaType: "video", description: "Bad video", src: "https://example.com/video" }];
  sources.users[0].decksData[0].cards[0].chats = [{ id: "broken-chat", comments: null }];
  sources.users[0].sharedDeckData = { unexpected: "stored-value" };
  const result = auditSources(sources);
  for (const code of ["MALFORMED_MEDIA", "MALFORMED_CHAT", "MALFORMED_SHARING"]) assert.ok(codes(sources).includes(code));
  assert.equal(result.summary.sourceCounts.mediaReferences, 2);
  assert.equal(result.summary.sourceCounts.legacyProviderlessImageReferences, 1);
  assert.equal(result.summary.sourceCounts.chats, 1);
  const manifest = result.manifest.find((entry: { collection: string }) => entry.collection === "users");
  assert.equal(manifest?.sharing.find((entry: { path: string }) => entry.path === "sharedDeckData")?.hash, fingerprint(sources.users[0].sharedDeckData));
});

test("CLI distinguishes a complete blocked audit from a failed offline scan", async () => {
  const directory = await mkdtemp(join(tmpdir(), "switchplay-audit-failure-"));
  const sources = fixture();
  sources.users[0].decksData[0].cards[0].cardId = "orphan";
  sources.users[0].decksData[0].cards[0].mediaItems = [personalImage()];
  const fixturePath = join(directory, "anomalies.json");
  await writeFile(fixturePath, JSON.stringify(sources));
  const output = join(directory, "reports");
  const run = spawnSync(process.execPath, ["scripts/audit-pre-library-migration.mjs", "--fixtures", fixturePath, "--output", output], { encoding: "utf8" });
  assert.equal(run.status, 2, run.stderr);
  const [runDirectory] = await readdir(output);
  const status = JSON.parse(await readFile(join(output, runDirectory, "run-status.json"), "utf8"));
  assert.equal(status.status, "complete");
  assert.equal(status.readiness, "blocked");
  const failedOutput = join(directory, "failed");
  const failed = spawnSync(process.execPath, ["scripts/audit-pre-library-migration.mjs", "--fixtures", join(directory, "absent.json"), "--output", failedOutput], { encoding: "utf8" });
  assert.equal(failed.status, 1);
  const [failedDirectory] = await readdir(failedOutput);
  const failedStatus = JSON.parse(await readFile(join(failedOutput, failedDirectory, "run-status.json"), "utf8"));
  assert.equal(failedStatus.status, "failed");
  assert.ok(!(await readdir(join(failedOutput, failedDirectory))).includes("summary.json"));
});

test("Mongo diagnostics omit raw messages, stacks, responses and unsafe diagnostic strings", () => {
  const diagnostics = failureDiagnostics({
    name: "MongoServerError", code: 13, codeName: "Unauthorized",
    message: "mongodb://PRIVATE-USER:PRIVATE-PASSWORD@PRIVATE-HOST.example/db",
    stack: "PRIVATE-STACK", errorResponse: { errmsg: "PRIVATE-RESPONSE" },
  }, "read users");
  assert.equal(diagnostics.errorName, "MongoServerError");
  assert.equal(diagnostics.errorCode, 13);
  assert.equal(diagnostics.errorCodeName, "Unauthorized");
  assert.equal(diagnostics.stage, "read users");
  assert.ok(diagnostics.reason.includes("read permissions"));
  assert.ok(!JSON.stringify(diagnostics).includes("PRIVATE-"));
  const unsafe = failureDiagnostics({ name: "user@host.example", code: "secret", codeName: "mongodb://user:password@host" }, "connect");
  assert.equal(unsafe.errorName, "Error");
  assert.equal(unsafe.errorCode, null);
  assert.equal(unsafe.errorCodeName, null);
});

for (const failedStage of [null, "connect", "read deckTemplates", "read users"]) {
  test(`main uses only projected finds and records safe diagnostics${failedStage ? ` for ${failedStage}` : " on success"}`, async (t) => {
    t.mock.method(console, "log", () => {});
    t.mock.method(console, "error", () => {});
    const directory = await mkdtemp(join(tmpdir(), "switchplay-audit-mongo-mock-"));
    const sources = fixture();
    const calls: string[] = [];
    const mongoError = Object.assign(new Error("mongodb://PRIVATE-USER:PRIVATE-PASSWORD@PRIVATE-HOST.example/db"), { name: "MongoServerError", code: 13, codeName: "Unauthorized" });
    const client = {
      async connect() { calls.push("connect"); if (failedStage === "connect") throw mongoError; },
      db() { return {
        collection(collection: "deckTemplates" | "users") { return {
          find(filter: unknown, options: { projection: unknown }) {
            assert.deepEqual(filter, {});
            assert.deepEqual(options.projection, SOURCE_PROJECTIONS[collection]);
            return { sort(order: unknown) {
              assert.deepEqual(order, { _id: 1 });
              return { async toArray() {
                calls.push(`read ${collection}`);
                if (failedStage === `read ${collection}`) throw mongoError;
                return sources[collection];
              } };
            } };
          },
        }; },
      }; },
      async close() { calls.push("close"); },
    };
    const exit = await main(["--output", directory], { MONGODB_URI: "mocked-no-network", MONGODB_DB: "fixture-only" }, () => client);
    assert.equal(exit, failedStage ? 1 : 0);
    const [runDirectory] = await readdir(directory);
    const statusText = await readFile(join(directory, runDirectory, "run-status.json"), "utf8");
    const status = JSON.parse(statusText);
    assert.ok(!statusText.includes("PRIVATE-"));
    assert.equal(calls.at(-1), "close");
    if (failedStage) {
      assert.equal(status.status, "failed");
      assert.equal(status.stage, failedStage);
      assert.equal(status.errorName, "MongoServerError");
      assert.equal(status.errorCode, 13);
      assert.equal(status.errorCodeName, "Unauthorized");
      assert.equal(status.scanPass, failedStage === "connect" ? null : "initial");
    } else {
      assert.deepEqual(calls, ["connect", "read deckTemplates", "read users", "read deckTemplates", "read users", "close"]);
      assert.equal(status.status, "complete");
    }
  });
}
