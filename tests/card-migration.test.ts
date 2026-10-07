import assert from "node:assert/strict";
import { readFile, mkdtemp, readdir, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { BSON } from "mongodb";
import { fingerprint } from "../scripts/audit-pre-library-migration.mjs";
import { createMigrationPlan, planFingerprint, validateMigrationPlan, type LegacySources } from "../scripts/migration/plan";
import { decodePlan } from "../scripts/migrate-first-class-cards";
import type { CardData } from "../src/lib/cards/model";
import { layoutCardLabels } from "../src/lib/cards/layout";

async function fixture(): Promise<LegacySources> { return JSON.parse(await readFile("tests/fixtures/first-class-migration.json", "utf8")); }
test("migration preserves stored creation titles instead of applying new Creator defaults or first-publication gates", async () => {
  const sources = await fixture();
  sources.deckTemplates[0].template.title = "My Next Path";
  sources.deckTemplates[0].template.cards[0].intro.title = "My New Card";
  sources.deckTemplates[1].template.cards[0].intro.title = "My Next Card";
  const before = structuredClone(sources), plan = createMigrationPlan(sources);
  assert.equal(plan.targets.deckTemplateVersions[0].content.title, "My Next Path");
  assert.deepEqual(plan.targets.cardTemplateVersions.map((version) => version.content.intro.title), ["My New Card", "My Next Card"]);
  assert.ok(plan.targets.deckTemplates.every((root) => root.latestVersion === 1 && root.draft === null));
  assert.ok(plan.targets.cardTemplates.every((root) => root.latestVersion === 1 && root.draft === null));
  assert.equal(validateMigrationPlan(plan).valid, true); assert.deepEqual(sources, before);
});
test("migration extracts independent Cards/versions, regenerates global Step IDs and defaults themes/labels", async () => {
  const sources = await fixture(); const before = structuredClone(sources); const plan = createMigrationPlan(sources);
  assert.equal(plan.counts.decks, 2); assert.equal(plan.counts.cards, 2); assert.equal(plan.counts.steps, 6);
  assert.equal(plan.counts.personalMedia, 3); assert.equal(plan.counts.membershipAdditions, 0);
  assert.equal(new Set(plan.targets.cardTemplates.map((card) => card.cardTemplateId)).size, 2);
  const ids = plan.targets.cardTemplateVersions.flatMap((version) => version.content.steps.map((step) => step.stepId));
  assert.equal(new Set(ids).size, 6); assert.ok(ids.every((id) => !id.startsWith("old-step")));
  for (const deck of plan.targets.deckTemplateVersions) {
    assert.equal(deck.content.labelPrefix, "Card"); assert.equal(deck.content.cadence.intervalDays, 7);
    assert.ok(deck.content.themes.length === 3); assert.ok(!("streams" in deck.content) && !("channels" in deck.content));
  }
  assert.equal(plan.targets.deckTemplateVersions[0].content.categories[0], "Practice");
  assert.equal(plan.targets.cardTemplates[1].visibility, "public");
  assert.equal(plan.targets.cardTemplates[0].ownerUserId, "alice");
  assert.deepEqual(sources, before); assert.equal(validateMigrationPlan(plan).valid, true);
  const labels = layoutCardLabels("Stage", plan.targets.cardTemplates.map((root) => ({ root, version: plan.targets.cardTemplateVersions.find((version) => version.cardTemplateId === root.cardTemplateId)! })));
  assert.deepEqual(labels.map((card) => card.label), ["Stage 1", "Stage 2"]);
});
test("all personal media/sharing/auth metadata are retained exactly; all learning/demo state resets", async () => {
  const sources = await fixture(); const plan = createMigrationPlan(sources); const user = plan.targets.users[0];
  assert.equal(user.passwordHash, sources.users[0].passwordHash);
  assert.equal(fingerprint(user.sharedDeckData), fingerprint(sources.users[0].sharedDeckData));
  for (const [index, deck] of user.decksData.entries()) {
    assert.ok(!Object.hasOwn(deck, "cards")); assert.equal(deck.deckTemplateVersion, 1);
    assert.equal(fingerprint(deck.sharedWithUserIds), fingerprint(sources.users[0].decksData[index].sharedWithUserIds));
    const mapping = plan.mappings.find((mapping) => mapping.deckTemplateId === deck.deckTemplateId)!;
    assert.equal(deck.activeCardId, mapping.cardTemplateId);
  }
  for (const [index, card] of (user.cardsData as CardData[]).entries()) {
    assert.equal(card.cardTemplateVersion, 1); assert.equal(card.targetDate, null); assert.equal(card.reflection, "");
    assert.deepEqual(card.chats, []); assert.deepEqual(card.tests, []);
    assert.ok(card.items.every((item) => item.completionStatus === "todo" && !Object.hasOwn(item, "itemId")));
    assert.ok(card.signalReadings.every((signal) => signal.reading === null && !Object.hasOwn(signal, "signalId")));
    assert.equal(fingerprint(card.mediaItems), fingerprint(sources.users[0].decksData[index].cards[0].mediaItems));
  }
  assert.ok(!JSON.stringify(plan.targets.cardTemplateVersions).includes("signalId"));
});
test("stored plan reuses exact mappings and rejects source drift and tampering", async () => {
  const sources = await fixture(); const plan = createMigrationPlan(sources);
  const stored = decodePlan(BSON.EJSON.stringify(plan, { relaxed: false }));
  assert.deepEqual(stored.mappings, plan.mappings); assert.equal(validateMigrationPlan(stored).valid, true);
  assert.equal(createMigrationPlan(sources, stored).runId, plan.runId);
  sources.deckTemplates[0].template.title = "Changed";
  assert.throws(() => createMigrationPlan(sources, stored), { code: "SOURCE_DRIFT_REQUIRES_NEW_PLAN" });
  stored.targets.cardTemplates[0].latestVersion = 2;
  assert.throws(() => validateMigrationPlan(stored), { code: "INVALID_PLAN_HASH" });
});
test("migration pins every membership Card even without old demo state, and rejects incomplete coverage", async () => {
  const sources = await fixture(); sources.users[0].decksData[1].cards = [];
  const before = structuredClone(sources), plan = createMigrationPlan(sources);
  assert.equal(plan.counts.cardData, 2);
  const missingLegacyCard = plan.targets.users[0].cardsData[1] as CardData;
  assert.equal(missingLegacyCard.cardTemplateVersion, 1);
  assert.deepEqual(missingLegacyCard.mediaItems, []);
  assert.ok(missingLegacyCard.items.every((item) => item.completionStatus === "todo"));
  assert.ok(missingLegacyCard.signalReadings.every((signal) => signal.reading === null));
  assert.equal(fingerprint(plan.targets.users[0].cardsData[0].mediaItems), fingerprint(sources.users[0].decksData[0].cards[0].mediaItems));
  assert.equal(validateMigrationPlan(plan).valid, true); assert.deepEqual(sources, before);
  plan.targets.users[0].cardsData.pop(); plan.planHash = planFingerprint(plan);
  assert.throws(() => validateMigrationPlan(plan), { code: "MISSING_MIGRATED_CARD_DATA" });
});
test("graph validator rejects dangling versions, duplicate Steps, retained learning state and media loss", async () => {
  const plan = createMigrationPlan(await fixture());
  for (const mutate of [
    (p: typeof plan) => { p.targets.cardTemplateVersions.pop(); },
    (p: typeof plan) => { p.targets.cardTemplateVersions[1].content.steps[0].stepId = p.targets.cardTemplateVersions[0].content.steps[0].stepId; },
    (p: typeof plan) => { p.targets.users[0].cardsData[0].signalReadings[0].reading = 1; },
    (p: typeof plan) => { p.targets.users[0].cardsData[0].mediaItems.pop(); },
    (p: typeof plan) => { p.targets.users[0].sharedDeckData = []; },
    (p: typeof plan) => { p.targets.users[0].cardsData.push(p.targets.users[0].cardsData[0]); },
  ]) {
    const changed = decodePlan(BSON.EJSON.stringify(plan, { relaxed: false })); mutate(changed); changed.planHash = planFingerprint(changed);
    assert.throws(() => validateMigrationPlan(changed));
  }
});
test("migration refuses ambiguous canonical/media sources but ignores discarded orphan learning state", async () => {
  const sources = await fixture();
  sources.users[0].decksData[0].cards.push({ cardId: "gone", mediaItems: [], signalReadings: [{ signalId: "unmappable", reading: 5 }], items: null });
  assert.equal(createMigrationPlan(sources).counts.discardedOrphanCardStates, 1);
  sources.users[0].decksData[0].cards.at(-1).mediaItems = [sources.users[0].decksData[0].cards[0].mediaItems[0]];
  assert.throws(() => createMigrationPlan(sources), { code: "SOURCE_AUDIT_BLOCKERS" });
  const duplicate = await fixture(); duplicate.deckTemplates[0].template.cards.push(duplicate.deckTemplates[0].template.cards[0]);
  assert.throws(() => createMigrationPlan(duplicate), { code: "SOURCE_AUDIT_BLOCKERS" });
  const unknown = await fixture(); unknown.deckTemplates[0].template.cards[0].unknownCanonicalContent = "Do not silently lose me";
  assert.throws(() => createMigrationPlan(unknown), { code: "UNKNOWN_CANONICAL_FIELD:card" });
});
test("missing legacy optional intro media slot becomes explicit null without fabricating media", async () => {
  const sources = await fixture(); delete sources.deckTemplates[1].template.cards[0].intro.mediaItem;
  const migration = createMigrationPlan(sources);
  assert.equal(migration.targets.cardTemplateVersions[1].content.intro.mediaItem, null);
  assert.equal(migration.counts.personalMedia, 3);
});
test("59 uploaded fixture references survive unchanged without hardcoded migration counts", async () => {
  const sources = await fixture(); const card = sources.users[0].decksData[0].cards[0];
  card.mediaItems = Array.from({ length: 58 }, (_, index) => ({ ...card.mediaItems[1], id: `uploaded-${index}`, assetId: `legacy/${index}.webp`, src: `https://assets.example.com/${index}.webp` }));
  const plan = createMigrationPlan(sources); assert.equal(plan.counts.personalMedia, 59);
  assert.equal(fingerprint(plan.targets.users[0].cardsData[0].mediaItems), fingerprint(card.mediaItems));
  assert.equal(validateMigrationPlan(plan).valid, true);
});
test("CLI plans offline, reuses reviewed output and rejects production apply before any connection", async () => {
  await mkdir("migration-plans", { recursive: true });
  const directory = await mkdtemp(join("migration-plans", "cli-fixture-"));
  try {
    const path = join(directory, "plan.ejson");
    const args = ["--import", "tsx", "scripts/migrate-first-class-cards.ts", "--fixtures", "tests/fixtures/first-class-migration.json", "--plan", path];
    const first = spawnSync(process.execPath, args, { encoding: "utf8" }); assert.equal(first.status, 0, first.stderr);
    const before = await readFile(path, "utf8");
    const second = spawnSync(process.execPath, args, { encoding: "utf8" }); assert.equal(second.status, 0, second.stderr);
    assert.equal(await readFile(path, "utf8"), before);
    const apply = spawnSync(process.execPath, ["--import", "tsx", "scripts/migrate-first-class-cards.ts", "--apply", "--plan", path], {
      encoding: "utf8", env: { ...process.env, MIGRATION_TARGET_URI: "mongodb+srv://example.invalid", MIGRATION_TARGET_DB: "production" },
    });
    assert.equal(apply.status, 1); assert.ok(apply.stderr.includes("LOCAL_MIGRATION_TARGET_REQUIRED"));
    assert.ok((await readdir(directory)).includes("run-status.json"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
