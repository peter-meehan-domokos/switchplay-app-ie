import { randomUUID } from "node:crypto";
import { BSON, type Document } from "mongodb";
import { auditSources, fingerprint, sourceManifest } from "../audit-pre-library-migration.mjs";
import { assertCardContent, assertDeckContent, initialCardData, isRecord, requireCondition } from "../../src/lib/cards/domain";
import type { CardContent, CardData, CardTemplateRoot, CardTemplateVersion, DeckContent, DeckData, DeckTemplateRoot, DeckTemplateVersion } from "../../src/lib/cards/model";

export type LegacySources = { deckTemplates: Document[]; users: Document[] };
export type MigrationPlan = {
  schemaVersion: 1; runId: string; createdAt: Date; sourceHash: string; planHash: string;
  mappings: { deckTemplateId: string; localCardId: string; cardTemplateId: string; steps: { index: number; oldStepId: string; stepId: string }[] }[];
  targets: { cardTemplates: CardTemplateRoot[]; cardTemplateVersions: CardTemplateVersion[]; deckTemplates: DeckTemplateRoot[]; deckTemplateVersions: DeckTemplateVersion[]; users: Document[] };
  sourceManifest: ReturnType<typeof sourceManifest>;
  preservation: { personalMedia: { userId: string; cardTemplateId: string; hash: string }[]; sharing: { userId: string; path: string; present: boolean; hash: string }[] };
  counts: { decks: number; cards: number; steps: number; users: number; deckData: number; cardData: number; personalMedia: number; discardedOrphanCardStates: number; membershipAdditions: 0 };
};
const clone = <T>(value: T): T => BSON.deserialize(BSON.serialize({ value })).value;
const idText = (value: unknown): string => value instanceof BSON.ObjectId ? value.toHexString() : String(value);
const presentHash = (value: Document, key: string) => ({ present: Object.hasOwn(value, key), hash: fingerprint(value[key]) });
function asDate(value: unknown, fallback: Date) { const date = new Date(value as string); return Number.isFinite(date.getTime()) ? date : fallback; }
export function planFingerprint(plan: MigrationPlan) { const { planHash: _ignored, ...body } = plan; void _ignored; return fingerprint(body); }

function assertLegacyKeys(value: Document, permitted: string[], context: string) {
  // Unknown authored fields must never silently disappear at the migration boundary.
  requireCondition(Object.keys(value).every((key) => permitted.includes(key)), `UNKNOWN_CANONICAL_FIELD:${context}`);
}
function canonicalCard(raw: Document, mapping: MigrationPlan["mappings"][number]): CardContent {
  assertLegacyKeys(raw, ["cardId", "label", "intro", "steps", "suggestedTargetDate", "signals", "signalDefinitions", "signalTemplates", "mediaItem"], "card");
  const steps = raw.steps.map((step: Document, index: number) => {
    assertLegacyKeys(step, ["stepId", "title", "description", "descriptionContent", "mediaItem", "signals", "signalDefinitions", "signalTemplates"], "step");
    const { signals: _signals, signalDefinitions: _defs, signalTemplates: _templates, ...content } = step;
    void _signals; void _defs; void _templates;
    return { ...clone(content), stepId: mapping.steps[index].stepId };
  });
  const intro = clone(raw.intro);
  intro.mediaItem ??= null;
  for (const key of ["signals", "signalDefinitions", "signalTemplates"]) delete intro[key];
  const content: CardContent = { intro, suggestedTargetDate: raw.suggestedTargetDate ?? "", steps,
    ...(Object.hasOwn(raw, "mediaItem") ? { mediaItem: clone(raw.mediaItem) } : {}) };
  assertCardContent(content); return content;
}
function canonicalDeck(raw: Document, refs: DeckContent["cards"]): DeckContent {
  assertLegacyKeys(raw, ["deckTemplateId", "title", "category", "categories", "introduction", "streams", "channels", "themes", "cards", "signals", "signalDefinitions", "signalTemplates", "cadence", "labelPrefix"], "deck");
  const themeFields = ["themes", "streams", "channels"].filter((field) => Object.hasOwn(raw, field));
  requireCondition(themeFields.length > 0, "MISSING_LEGACY_THEMES");
  requireCondition(new Set(themeFields.map((field) => fingerprint(raw[field]))).size === 1, "CONFLICTING_LEGACY_THEMES");
  const content: DeckContent = { title: raw.title, introduction: clone(raw.introduction ?? null),
    categories: Object.hasOwn(raw, "categories") ? clone(raw.categories) : raw.category == null ? [] : [raw.category],
    themes: clone(raw[themeFields[0]]), cadence: raw.cadence ?? { intervalDays: 7 }, labelPrefix: "Card", cards: refs };
  if (content.introduction) { content.introduction.image ??= null; content.introduction.video ??= null; }
  assertDeckContent(content); return content;
}

export function createMigrationPlan(sources: LegacySources, previous?: MigrationPlan): MigrationPlan {
  requireCondition(isRecord(sources) && Array.isArray(sources.deckTemplates) && Array.isArray(sources.users) && [...sources.deckTemplates, ...sources.users].every(isRecord), "INVALID_SOURCE_CONTAINER");
  const currentDecks = sources.deckTemplates.map(({ savedTemplate: _saved, previousVersions: _previous, ...current }) => { void _saved; void _previous; return current; });
  const sourceHash = fingerprint({ deckTemplates: currentDecks, users: sources.users }); // Current source drift guard, including untouched user metadata.
  if (previous) {
    requireCondition(previous.sourceHash === sourceHash, "SOURCE_DRIFT_REQUIRES_NEW_PLAN");
    validateMigrationPlan(previous); return previous;
  }
  const audit = auditSources(sources);
  requireCondition(audit.summary.findingCounts.bySeverity.blocker === 0, "SOURCE_AUDIT_BLOCKERS");
  // Label choices are settled; sharing shapes are copied verbatim, not interpreted.
  // Canonical shape validation below handles optional fields more precisely than the audit.
  const now = new Date();
  const plan: MigrationPlan = { schemaVersion: 1, runId: randomUUID(), createdAt: now, sourceHash, planHash: "", mappings: [],
    targets: { cardTemplates: [], cardTemplateVersions: [], deckTemplates: [], deckTemplateVersions: [], users: [] },
    sourceManifest: sourceManifest(sources), preservation: { personalMedia: [], sharing: [] },
    counts: { decks: sources.deckTemplates.length, users: sources.users.length, cards: 0, steps: 0, deckData: 0, cardData: 0, personalMedia: 0, discardedOrphanCardStates: 0, membershipAdditions: 0 } };
  const cardsByLegacyIdentity = new Map<string, { mapping: MigrationPlan["mappings"][number]; content: CardContent }>();
  const deckRoots = new Map<string, DeckTemplateRoot>();
  for (const deck of sources.deckTemplates) {
    const refs = [];
    for (const card of deck.template.cards) {
      const mapping = { deckTemplateId: deck.deckTemplateId, localCardId: card.cardId, cardTemplateId: randomUUID(),
        steps: card.steps.map((step: Document, index: number) => ({ index, oldStepId: step.stepId, stepId: randomUUID() })) };
      plan.mappings.push(mapping); const content = canonicalCard(card, mapping); refs.push({ cardTemplateId: mapping.cardTemplateId });
      cardsByLegacyIdentity.set(JSON.stringify([deck.deckTemplateId, card.cardId]), { mapping, content });
      const root: CardTemplateRoot = { cardTemplateId: mapping.cardTemplateId, ownerUserId: deck.ownerUserId, visibility: deck.visibility,
        latestVersion: 1, draft: null, revision: 0, forkedFrom: null, stepIds: content.steps.map((step) => step.stepId),
        createdAt: asDate(deck.createdAt, now), updatedAt: now };
      plan.targets.cardTemplates.push(root);
      plan.targets.cardTemplateVersions.push({ cardTemplateId: root.cardTemplateId, version: 1, content,
        publishedAt: asDate(deck.publishedAt, now), publishedByUserId: root.ownerUserId });
    }
    const content = canonicalDeck(deck.template, refs);
    const root: DeckTemplateRoot = { deckTemplateId: deck.deckTemplateId, ownerUserId: deck.ownerUserId, visibility: deck.visibility,
      latestVersion: 1, draft: null, revision: 0, forkedFrom: null, createdAt: asDate(deck.createdAt, now), updatedAt: now };
    deckRoots.set(root.deckTemplateId, root); plan.targets.deckTemplates.push(root);
    plan.targets.deckTemplateVersions.push({ deckTemplateId: root.deckTemplateId, version: 1,
      content: { ...content, cards: content.cards.map((ref) => ({ ...ref, cardVersionAtPublish: 1 })) },
      publishedAt: asDate(deck.publishedAt, now), publishedByUserId: root.ownerUserId });
  }
  for (const sourceUser of sources.users) {
    requireCondition(!Object.hasOwn(sourceUser, "cardsData"), "EXISTING_SOURCE_CARD_DATA_REFUSED");
    const user = clone(sourceUser); const userId = idText(user._id); const cardsById = new Map<string, CardData>();
    const decks: DeckData[] = [];
    for (const field of ["sharedDeckData", "sharedWithUserIds"]) plan.preservation.sharing.push({ userId, path: field, ...presentHash(sourceUser, field) });
    for (const [deckIndex, oldDeck] of sourceUser.decksData.entries()) {
      requireCondition(deckRoots.has(oldDeck.deckTemplateId), "MISSING_MEMBERSHIP_TEMPLATE");
      const oldActive = cardsByLegacyIdentity.get(JSON.stringify([oldDeck.deckTemplateId, oldDeck.activeCardId]));
      const firstCard = plan.targets.deckTemplateVersions.find((version) => version.deckTemplateId === oldDeck.deckTemplateId)!.content.cards[0];
      const { cards: _discarded, ...deckFields } = clone(oldDeck); void _discarded;
      const data: DeckData = { ...deckFields, deckTemplateId: oldDeck.deckTemplateId, deckTemplateVersion: 1,
        activeCardId: oldActive?.mapping.cardTemplateId ?? firstCard?.cardTemplateId ?? null,
        archivedAt: oldDeck.archivedAt == null ? null : asDate(oldDeck.archivedAt, now),
        createdAt: asDate(oldDeck.createdAt, now), updatedAt: now, openedAt: oldDeck.openedAt == null ? null : asDate(oldDeck.openedAt, now) };
      decks.push(data); plan.counts.deckData++;
      plan.preservation.sharing.push({ userId, path: `decksData[${deckIndex}].sharedWithUserIds`, ...presentHash(oldDeck, "sharedWithUserIds") });
      for (const oldCard of Array.isArray(oldDeck.cards) ? oldDeck.cards : []) {
        const resolved = cardsByLegacyIdentity.get(JSON.stringify([oldDeck.deckTemplateId, oldCard?.cardId]));
        if (!resolved) { requireCondition(!oldCard?.mediaItems?.length, "ORPHAN_MEDIA_REFUSED"); plan.counts.discardedOrphanCardStates++; continue; }
        let cardData = cardsById.get(resolved.mapping.cardTemplateId);
        if (!cardData) {
          cardData = initialCardData(resolved.mapping.cardTemplateId, 1, resolved.content, now);
          cardData.targetDate = null; // Discard personal dates; Phase 2 initialization can apply canonical/cadence precedence.
          cardsById.set(cardData.cardTemplateId, cardData);
        }
        for (const item of oldCard.mediaItems ?? []) {
          cardData.mediaItems.push(clone(item));
          plan.preservation.personalMedia.push({ userId, cardTemplateId: cardData.cardTemplateId, hash: fingerprint(item) });
          plan.counts.personalMedia++;
        }
      }
    }
    user.decksData = decks; user.cardsData = [...cardsById.values()]; plan.counts.cardData += cardsById.size;
    plan.targets.users.push(user);
  }
  plan.counts.cards = plan.targets.cardTemplates.length;
  plan.counts.steps = plan.targets.cardTemplateVersions.reduce((count, version) => count + version.content.steps.length, 0);
  plan.planHash = planFingerprint(plan); validateMigrationPlan(plan); return plan;
}

export function validateMigrationPlan(plan: MigrationPlan) {
  requireCondition(plan.schemaVersion === 1 && plan.planHash === planFingerprint(plan), "INVALID_PLAN_HASH");
  const { targets } = plan;
  const cards = new Map(targets.cardTemplates.map((root) => [root.cardTemplateId, root]));
  const decks = new Map(targets.deckTemplates.map((root) => [root.deckTemplateId, root]));
  requireCondition(cards.size === targets.cardTemplates.length && decks.size === targets.deckTemplates.length, "DUPLICATE_TARGET_ID");
  requireCondition(targets.cardTemplateVersions.length === cards.size && targets.deckTemplateVersions.length === decks.size, "HALF_CREATED_TARGET_GRAPH");
  const cardVersions = new Map(targets.cardTemplateVersions.map((version) => [version.cardTemplateId, version]));
  const deckVersions = new Map(targets.deckTemplateVersions.map((version) => [version.deckTemplateId, version]));
  const owners = new Set(targets.users.map((user) => idText(user._id)));
  requireCondition(owners.size === targets.users.length, "DUPLICATE_USER_ID");
  const noObsoleteDefinitions = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.every(noObsoleteDefinitions);
    if (value !== null && typeof value === "object") return Object.entries(value).every(([key, entry]) => !["signals", "signalDefinitions", "signalTemplates", "channels", "streams", "label"].includes(key) && noObsoleteDefinitions(entry));
    return true;
  };
  const stepIds = new Set();
  for (const root of cards.values()) {
    const version = cardVersions.get(root.cardTemplateId);
    requireCondition(root.latestVersion === 1 && root.draft === null && version?.version === 1, "INVALID_CARD_V1");
    assertCardContent(version.content);
    requireCondition(owners.has(root.ownerUserId) && ["public", "private"].includes(root.visibility) && noObsoleteDefinitions(version.content), "INVALID_CANONICAL_CARD_GRAPH");
    requireCondition(fingerprint(root.stepIds) === fingerprint(version.content.steps.map((step) => step.stepId)), "INVALID_STEP_RESERVATION");
    for (const step of version.content.steps) { requireCondition(!stepIds.has(step.stepId), "NON_UNIQUE_GLOBAL_STEP_ID"); stepIds.add(step.stepId); }
  }
  for (const root of decks.values()) {
    const version = deckVersions.get(root.deckTemplateId);
    requireCondition(root.latestVersion === 1 && root.draft === null && version?.version === 1, "INVALID_DECK_V1");
    assertDeckContent({ ...version.content, cards: version.content.cards.map(({ cardTemplateId }) => ({ cardTemplateId })) });
    requireCondition(owners.has(root.ownerUserId) && ["public", "private"].includes(root.visibility) && noObsoleteDefinitions(version.content), "INVALID_CANONICAL_DECK_GRAPH");
    requireCondition(version.content.labelPrefix === "Card", "LEGACY_CUSTOM_LABEL_SURVIVED");
    for (const ref of version.content.cards) {
      requireCondition(cards.has(ref.cardTemplateId) && ref.cardVersionAtPublish === 1, "DANGLING_DECK_CARD");
      requireCondition(root.visibility !== "public" || cards.get(ref.cardTemplateId)!.visibility === "public", "PRIVATE_CARD_IN_PUBLIC_DECK");
    }
  }
  const foundMedia = []; const foundSharing = [];
  for (const user of targets.users) {
    const userId = idText(user._id); const memberships = new Set(); const personalCards = new Set();
    for (const field of ["sharedDeckData", "sharedWithUserIds"]) foundSharing.push({ userId, path: field, ...presentHash(user, field) });
    for (const [index, data] of user.decksData.entries()) {
      requireCondition(decks.has(data.deckTemplateId) && data.deckTemplateVersion === 1 && !Object.hasOwn(data, "cards") && !memberships.has(data.deckTemplateId), "INVALID_MIGRATED_MEMBERSHIP");
      memberships.add(data.deckTemplateId);
      requireCondition(data.activeCardId === null || deckVersions.get(data.deckTemplateId)!.content.cards.some((ref) => ref.cardTemplateId === data.activeCardId), "INVALID_ACTIVE_CARD_MAPPING");
      foundSharing.push({ userId, path: `decksData[${index}].sharedWithUserIds`, ...presentHash(data, "sharedWithUserIds") });
    }
    for (const data of user.cardsData as CardData[]) {
      requireCondition(cards.has(data.cardTemplateId) && data.cardTemplateVersion === 1 && !personalCards.has(data.cardTemplateId), "INVALID_MIGRATED_CARD_DATA");
      personalCards.add(data.cardTemplateId); const steps = cardVersions.get(data.cardTemplateId)!.content.steps;
      requireCondition(fingerprint(data.items) === fingerprint(steps.map(({ stepId }) => ({ stepId, completionStatus: "todo" }))), "COMPLETION_NOT_RESET");
      requireCondition(fingerprint(data.signalReadings) === fingerprint(steps.map(({ stepId }) => ({ stepId, reading: null }))), "SIGNALS_NOT_RESET");
      requireCondition(data.reflection === "" && data.chats.length === 0 && data.tests.length === 0 && data.targetDate === null, "DEMO_STATE_NOT_RESET");
      for (const item of data.mediaItems) foundMedia.push({ userId, cardTemplateId: data.cardTemplateId, hash: fingerprint(item) });
    }
  }
  const sort = (items: unknown[]) => items.map((item) => fingerprint(item)).sort();
  requireCondition(fingerprint(sort(foundMedia)) === fingerprint(sort(plan.preservation.personalMedia)), "PERSONAL_MEDIA_NOT_PRESERVED");
  requireCondition(fingerprint(foundSharing) === fingerprint(plan.preservation.sharing), "SHARING_NOT_PRESERVED");
  requireCondition(plan.counts.decks === decks.size && plan.counts.cards === cards.size && plan.counts.steps === stepIds.size && plan.counts.users === targets.users.length && plan.counts.personalMedia === foundMedia.length, "INVALID_PLAN_COUNTS");
  requireCondition(plan.counts.deckData === targets.users.reduce((count, user) => count + user.decksData.length, 0) && plan.counts.cardData === targets.users.reduce((count, user) => count + user.cardsData.length, 0), "INVALID_PERSONAL_STATE_COUNTS");
  requireCondition(plan.mappings.length === cards.size && new Set(plan.mappings.map((mapping) => JSON.stringify([mapping.deckTemplateId, mapping.localCardId]))).size === cards.size, "INVALID_SOURCE_MAPPING");
  for (const mapping of plan.mappings) {
    requireCondition(cards.has(mapping.cardTemplateId) && decks.has(mapping.deckTemplateId) && fingerprint(mapping.steps.map((step) => step.stepId)) === fingerprint(cards.get(mapping.cardTemplateId)!.stepIds), "INVALID_SOURCE_MAPPING");
  }
  return { valid: true, ...plan.counts };
}
