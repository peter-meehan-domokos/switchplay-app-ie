import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { BSON, MongoClient } from "mongodb";

// Standalone audit: no application imports, asset requests, normalization or repairs.
export const SOURCE_PROJECTIONS = {
  deckTemplates: { savedTemplate: 0, previousVersions: 0 },
  users: { _id: 1, decksData: 1, sharedDeckData: 1, sharedWithUserIds: 1, createdAt: 1, updatedAt: 1, isAdmin: 1 },
};
const own = (value, key) => Object.hasOwn(value, key);
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
const id = (value) => typeof value === "string" && value.trim().length > 0;
const nullableText = (value) => value === null || typeof value === "string";
const POSITIONAL_IDS = ["0", "1", "2"];
const COMPLETIONS = ["todo", "inProgress", "done", "skipped"];
const DISCARDED_FINDING_CODES = new Set([
  "OBSOLETE_TEMPLATE_SIGNAL_FIELD", "MISSING_SIGNAL_ARRAY", "DUPLICATE_SIGNAL_ID", "MISSING_POSITIONAL_READINGS",
  "UNEXPECTED_SIGNAL_ID", "MALFORMED_SIGNAL_VALUE", "SIGNAL_OUT_OF_RANGE", "AMBIGUOUS_POSITIONAL_SIGNAL_MAPPING",
  "MALFORMED_COMPLETION_ITEMS", "DUPLICATE_COMPLETION_ITEM_ID", "MALFORMED_COMPLETION_ITEM", "UNKNOWN_COMPLETION_STEP",
  "INVALID_COMPLETION_VALUE", "MALFORMED_CHATS", "CHAT_CONTEXT_UNRESOLVED", "MALFORMED_CHAT", "MALFORMED_COMMENT",
  "MISSING_PERSONAL_MEDIA_ARRAY",
]);
const CANONICAL_STRUCTURE_CODES = new Set([
  "MALFORMED_TEXT", "MALFORMED_CARD_INTRO", "MALFORMED_DECK_INTRODUCTION", "MALFORMED_THEMES", "MALFORMED_THEME",
  "DUPLICATE_THEME_ID", "MALFORMED_CATEGORY", "MALFORMED_RICH_TEXT", "INVALID_SUGGESTED_DATE",
]);

class AuditError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AuditError";
    this.code = code;
  }
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  return value;
}

// Canonical decoded BSON value hash. Object key order is ignored; array order is retained.
export function fingerprint(value) {
  const serialized = BSON.EJSON.serialize({ present: value !== undefined, value: value ?? null }, { relaxed: false });
  return createHash("sha256").update(JSON.stringify(sorted(serialized))).digest("hex");
}

function identifier(value) {
  if (value?.toHexString instanceof Function) return value.toHexString();
  if (typeof value === "string" && /^[A-Za-z0-9._-]{1,160}$/.test(value)) return value;
  return value === undefined ? null : `sha256:${fingerprint(value)}`;
}

function groups(values, getKey) {
  const result = new Map();
  values.forEach((value, index) => {
    const key = getKey(value);
    if (!id(key)) return;
    const entries = result.get(key) ?? [];
    entries.push({ value, index });
    result.set(key, entries);
  });
  return result;
}

function validDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;
  const [year, month, day] = value.trim().split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year >= 1 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validTimestamp(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value !== "string") return false;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/);
  return Boolean(match && validDateOnly(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4]) < 60 && Number.isFinite(Date.parse(value)));
}

function sourceView(collection, document) {
  if (collection === "deckTemplates") {
    return Object.fromEntries(Object.entries(document).filter(([key]) => key !== "savedTemplate" && key !== "previousVersions"));
  }
  return Object.fromEntries(Object.keys(SOURCE_PROJECTIONS.users).filter((key) => own(document, key)).map((key) => [key, document[key]]));
}

export function sourceManifest(sources) {
  return Object.keys(SOURCE_PROJECTIONS).flatMap((collection) => sources[collection].map((raw, index) => {
    const document = sourceView(collection, raw);
    const sharing = [];
    if (collection === "users") {
      for (const field of ["sharedDeckData", "sharedWithUserIds"]) {
        sharing.push({ path: field, present: own(document, field), hash: fingerprint(document[field]) });
      }
      if (Array.isArray(document.decksData)) document.decksData.forEach((deck, deckIndex) => {
        if (record(deck)) sharing.push({
          path: `decksData[${deckIndex}].sharedWithUserIds`, present: own(deck, "sharedWithUserIds"),
          hash: fingerprint(deck.sharedWithUserIds),
        });
      });
    }
    return {
      collection, documentId: identifier(document._id), scanIndex: index,
      ...(collection === "deckTemplates" ? {
        deckTemplateId: identifier(document.deckTemplateId),
        cardInventory: Array.isArray(document.template?.cards) ? document.template.cards.map((card, cardIndex) => ({
          index: cardIndex, cardId: identifier(card?.cardId), hash: fingerprint(card),
          stepCount: Array.isArray(card?.steps) ? card.steps.length : null,
          stepIds: Array.isArray(card?.steps) ? card.steps.map((step) => identifier(step?.stepId)) : null,
        })) : null,
      } : {}),
      hash: fingerprint(document), sharing,
    };
  }));
}

export function compareManifests(first, second) {
  const key = (entry) => `${entry.collection}:${entry.documentId ?? `scan-index-${entry.scanIndex}`}`;
  const before = new Map(first.map((entry) => [key(entry), entry]));
  const after = new Map(second.map((entry) => [key(entry), entry]));
  return [...new Set([...before.keys(), ...after.keys()])].flatMap((entryKey) => {
    const a = before.get(entryKey);
    const b = after.get(entryKey);
    return a?.hash === b?.hash ? [] : [{
      collection: (a ?? b).collection, documentId: (a ?? b).documentId,
      change: !a ? "added" : !b ? "removed" : "changed", firstHash: a?.hash ?? null, secondHash: b?.hash ?? null,
    }];
  });
}

/**
 * @param {{deckTemplates: object[], users: object[]}} sources Raw projected documents.
 * @param {{databaseName?: string, startedAt?: string, endedAt?: string, drift?: ReturnType<typeof compareManifests>}} [options]
 */
export function auditSources(sources, { databaseName = "fixture-data", startedAt = new Date().toISOString(), endedAt = new Date().toISOString(), drift = [] } = {}) {
  const findings = [];
  const counts = {
    deckTemplates: sources.deckTemplates.length, users: sources.users.length,
    liveCards: 0, liveSteps: 0, personalDeckData: 0, personalCardStates: 0, accountedPersonalCardStates: 0,
    uninspectableDeckDataContainers: 0, uninspectablePersonalCardContainers: 0,
    signalReadings: 0, positionalSignalReadings: 0, unexpectedSignalIds: 0,
    unambiguouslyAttributedSignalReadings: 0, personalCardsWithAmbiguousSignals: 0,
    liveTemplatesWithLegacySignalFields: 0, liveCardsWithLegacySignalFields: 0, legacySignalFields: 0, legacySignalDefinitions: 0,
    emptySuggestedDates: 0, mediaReferences: 0, canonicalMediaReferences: 0, personalMediaReferences: 0,
    legacyProviderlessImageReferences: 0, chats: 0, comments: 0, chatsWithRecoverableDeckContext: 0,
    sharedDeckDataFields: 0, sharedDeckDataEntries: 0, sharedWithUserIdsFields: 0, sharedWithUserIdsEntries: 0,
    expectedMembershipAdditions: 0, ambiguousMembershipCandidates: 0,
    mediaBearingPersonalCardStates: 0, mappedMediaBearingCardStates: 0, orphanedMediaBearingCardStates: 0,
    ambiguousMediaBearingCardStates: 0, totalPersonalMediaItems: 0, malformedPersonalMediaItems: 0,
    safePersonalMediaItems: 0, personalMediaItemsWithUnknownDestination: 0, uninspectablePersonalMediaContainers: 0,
  };
  const personalMediaCandidates = [];
  function finding(ctx, severity, code, path, reason, details = {}, suggestedResolution = "Review the raw source before migration; this audit makes no repairs.") {
    let impact = ctx.collection === "deckTemplates" ? "canonical" : "membership";
    if (["AMBIGUOUS_OWNER_MEMBERSHIP", "OWNER_MEMBERSHIP_TO_CREATE"].includes(code)) impact = "membership";
    if (code === "SOURCE_CHANGED_DURING_SCAN" || code === "EMPTY_SOURCE_COLLECTION") impact = "audit";
    if (/SHARING/.test(code)) impact = "sharing";
    if (DISCARDED_FINDING_CODES.has(code) || (ctx.collection === "users" && /\.cards\[\d+\]\.(targetDate|reflection|tests)(?:[.\[]|$)/.test(path))) {
      impact = "discarded-learning-state";
    }
    if (["ORPHAN_OR_AMBIGUOUS_PERSONAL_CARD", "MALFORMED_PERSONAL_CARD", "MALFORMED_PERSONAL_CARDS", "DUPLICATE_PERSONAL_CARD"].includes(code)) {
      impact = details.containsMedia || details.mayContainMedia ? "personal-media" : "discarded-learning-state";
    }
    if (code === "MALFORMED_MEDIA" || code === "MALFORMED_PERSONAL_MEDIA_ARRAY" || code === "MEDIA_ID_CONFLICT") {
      impact = ctx.collection === "deckTemplates" ? "canonical" : "personal-media";
      severity = "blocker";
    }
    if (impact === "canonical" && CANONICAL_STRUCTURE_CODES.has(code)) severity = "blocker";
    if (impact === "discarded-learning-state") {
      severity = "information";
      reason += " This legacy learning state will be discarded/reset; it does not affect migration readiness.";
      suggestedResolution = "Discard during migration; recreate completion as todo and Step-linked signal readings as null. No reset is performed by this audit.";
    }
    findings.push({ severity, code, impact, collection: ctx.collection, documentId: ctx.documentId,
      ...(ctx.deckTemplateId ? { deckTemplateId: identifier(ctx.deckTemplateId) } : {}),
      path, details, reason, suggestedResolution });
  }
  function checkText(value, ctx, path, nullable = false) {
    if (!(nullable ? nullableText(value) : typeof value === "string")) finding(ctx, "warning", "MALFORMED_TEXT", path, "Stored content has an unexpected type.");
  }
  function checkDate(value, ctx, path, suggested = false) {
    if (suggested && typeof value === "string" && value.trim() === "") {
      counts.emptySuggestedDates++;
      return;
    }
    if (!validDateOnly(value)) finding(ctx, "warning", suggested ? "INVALID_SUGGESTED_DATE" : "INVALID_TARGET_DATE", path, "Expected a real calendar date in YYYY-MM-DD format.", { valueType: value === null ? "null" : typeof value });
    else if (value !== value.trim()) finding(ctx, "warning", "DATE_WHITESPACE", path, "Date is parseable but contains surrounding whitespace.");
  }
  function timestamps(object, ctx, path, required) {
    for (const field of ["createdAt", "updatedAt", "openedAt", "publishedAt", "savedAt"]) {
      if (!own(object, field) && !required.includes(field)) continue;
      if (object[field] === null && field === "openedAt") continue;
      if (!validTimestamp(object[field])) finding(ctx, "warning", "INVALID_TIMESTAMP", `${path}${field}`, "Timestamp is missing, malformed or an impossible calendar date.");
    }
  }
  function media(value, ctx, path, context, expectedType) {
    if ((value === undefined || value === null) && context === "canonical") return true;
    counts.mediaReferences++;
    counts[context === "canonical" ? "canonicalMediaReferences" : "personalMediaReferences"]++;
    if (!record(value)) {
      if (context === "personal") counts.malformedPersonalMediaItems++;
      finding(ctx, "warning", "MALFORMED_MEDIA", path, "Media reference is not an object.");
      return false;
    }
    const errors = [];
    if (!id(value.id)) errors.push("id");
    if (!id(value.description)) errors.push("description");
    if (!["image", "video"].includes(value.mediaType) || (expectedType && value.mediaType !== expectedType)) errors.push("mediaType");
    const legacyImage = value.mediaType === "image" && value.provider === undefined;
    if (legacyImage) counts.legacyProviderlessImageReferences++;
    const supported = legacyImage || (value.mediaType === "image" && value.provider === "cloudflare-r2") || (value.mediaType === "video" && ["cloudflare-stream", "youtube"].includes(value.provider));
    if (!supported) errors.push("provider");
    if (!legacyImage && !id(value.assetId)) errors.push("assetId");
    else if (typeof value.assetId === "string" && /[\u0000-\u001f]|(^|\/)\.\.(\/|$)/.test(value.assetId)) errors.push("assetId");
    for (const field of ["src", "thumbnailSrc"]) {
      if (field === "thumbnailSrc" && value[field] === undefined) continue;
      let valid = false;
      if (id(value[field])) {
        if (legacyImage && field === "src" && /^\/(?!\/)/.test(value[field])) valid = true;
        else {
          try { const url = new URL(value[field]); valid = ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { /* Invalid metadata only; never fetch. */ }
        }
      }
      if (!valid) errors.push(field);
    }
    for (const field of ["width", "height"]) if (own(value, field) && (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] <= 0)) errors.push(field);
    if (errors.length) {
      if (context === "personal") counts.malformedPersonalMediaItems++;
      finding(ctx, "warning", "MALFORMED_MEDIA", path, "Media metadata fails the supported shape or URL checks; safe automatic preservation is not established. No asset was requested.", { invalidFields: [...new Set(errors)], referenceHash: fingerprint(value) });
    }
    return errors.length === 0;
  }
  function intro(value, ctx, path) {
    if (!record(value)) { finding(ctx, "warning", "MALFORMED_CARD_INTRO", path, "Expected a Card intro object."); return; }
    checkText(value.title, ctx, `${path}.title`, true);
    checkText(value.description, ctx, `${path}.description`, true);
    if (!own(value, "mediaItem")) finding(ctx, "warning", "MISSING_INTRO_MEDIA_SLOT", `${path}.mediaItem`, "Expected a media reference or explicit null.");
    media(value.mediaItem, ctx, `${path}.mediaItem`, "canonical");
  }
  function themes(value, ctx, path) {
    if (!Array.isArray(value)) { finding(ctx, "warning", "MALFORMED_THEMES", path, "Expected an array of theme/stream records."); return; }
    if (value.length !== 3) finding(ctx, "warning", "THEME_COUNT", path, "Current Creator has three theme rows.", { count: value.length });
    value.forEach((entry, index) => {
      if (!record(entry) || !id(entry.id) || typeof entry.title !== "string") finding(ctx, "warning", "MALFORMED_THEME", `${path}[${index}]`, "Expected id and title fields.");
    });
    for (const [themeId, entries] of groups(value, (entry) => entry?.id)) if (entries.length > 1) finding(ctx, "warning", "DUPLICATE_THEME_ID", path, "Repeated theme identity.", { id: identifier(themeId), indices: entries.map((entry) => entry.index) });
  }
  function metadata(value, ctx, path) {
    if (own(value, "cadence")) finding(ctx, "decision", "EXISTING_CADENCE_METADATA", `${path}cadence`, "The current application has no persisted cadence contract; determine how to interpret this existing field.", { valueType: typeof value.cadence, hash: fingerprint(value.cadence) });
    for (const field of ["targetDate", "startDate", "endDate", "suggestedTargetDate"]) if (own(value, field)) checkDate(value[field], ctx, `${path}${field}`, field === "suggestedTargetDate");
  }
  function legacyDefinitions(value, ctx, path, affectedCards) {
    if (Array.isArray(value)) { value.forEach((entry, index) => legacyDefinitions(entry, ctx, `${path}[${index}]`, affectedCards)); return; }
    if (!record(value)) return;
    for (const [field, entry] of Object.entries(value)) {
      const fieldPath = `${path}.${field}`;
      if (["signals", "signalDefinitions", "signalTemplates"].includes(field)) {
        counts.legacySignalFields++;
        const definitionCount = Array.isArray(entry) ? entry.length : entry == null ? 0 : 1;
        counts.legacySignalDefinitions += definitionCount;
        const cardPath = fieldPath.match(/^template\.cards\[\d+\]/)?.[0];
        if (cardPath) affectedCards.add(cardPath);
        finding(ctx, "information", "OBSOLETE_TEMPLATE_SIGNAL_FIELD", fieldPath, "Obsolete template-level Signal definitions are intentionally discarded.", {
          definitionCount, valueType: Array.isArray(entry) ? "array" : typeof entry,
          representativeIds: (Array.isArray(entry) ? entry : [entry]).slice(0, 5).map((definition) => identifier(definition?.signalId)),
        });
      } else legacyDefinitions(entry, ctx, fieldPath, affectedCards);
    }
  }
  function labels(cards, ctx) {
    const parsed = cards.map((card, index) => {
      const match = typeof card?.label === "string" ? card.label.match(/^(.+?)\s+([1-9]\d*)$/) : null;
      return { index, prefix: match?.[1], number: match ? Number(match[2]) : null, labelHash: fingerprint(card?.label) };
    });
    const prefixes = [...new Set(parsed.filter((label) => label.prefix).map((label) => label.prefix))];
    const custom = parsed.filter((label) => !label.prefix);
    const wrongPositions = parsed.filter((label) => label.number !== null && label.number !== label.index + 1);
    const details = {
      cardCount: cards.length, indicesAreZeroBased: true,
      prefixes: prefixes.map((prefix) => ({ value: /^[\p{L} -]{1,60}$/u.test(prefix) ? prefix : identifier(prefix), count: parsed.filter((label) => label.prefix === prefix).length })),
      custom: custom.map(({ index, labelHash }) => ({ index, labelHash })),
      positionalMismatches: wrongPositions.map(({ index, number }) => ({ index, storedNumber: number, expectedNumber: index + 1 })),
      safelyReducible: custom.length === 0 && prefixes.length === 1 && wrongPositions.length === 0,
    };
    finding(ctx, details.safelyReducible ? "information" : "decision", details.safelyReducible ? "CONSISTENT_CARD_LABEL_PREFIX" : "CARD_LABEL_DECISION", "template.cards[*].label",
      details.safelyReducible ? "Labels can be reduced to one Deck prefix plus Card position." : "Custom labels, inconsistent prefixes or skipped/repeated numbers need an explicit content decision.", details);
  }

  const decksById = groups(sources.deckTemplates, (deck) => deck.deckTemplateId);
  const userIds = new Set(sources.users.map((user) => identifier(user._id)));
  const deckInfos = new Map();
  const stepOccurrences = new Map();
  for (const [deckId, entries] of decksById) if (entries.length > 1) finding({ collection: "deckTemplates", documentId: identifier(entries[0].value._id), deckTemplateId: deckId }, "blocker", "DUPLICATE_DECK_TEMPLATE_ID", "deckTemplateId", "DeckData cannot be assigned unambiguously to one live template.", { documents: entries.map(({ value }) => identifier(value._id)) });

  sources.deckTemplates.forEach((deck, deckIndex) => {
    const ctx = { collection: "deckTemplates", documentId: identifier(deck._id), deckTemplateId: deck.deckTemplateId };
    if (!id(deck.deckTemplateId)) finding(ctx, "blocker", "MISSING_DECK_TEMPLATE_ID", "deckTemplateId", "Live Deck identity is absent or malformed.");
    if (!id(deck.ownerUserId)) finding(ctx, "blocker", "MISSING_OWNER", "ownerUserId", "Template ownership cannot be assigned.");
    else if (!userIds.has(identifier(deck.ownerUserId))) finding(ctx, "blocker", "OWNER_USER_NOT_FOUND", "ownerUserId", "Owner does not resolve to an inspected User.", { ownerUserId: identifier(deck.ownerUserId) });
    if (!["public", "private"].includes(deck.visibility)) finding(ctx, "blocker", "INVALID_VISIBILITY", "visibility", "Card visibility cannot safely inherit from this Deck.");
    timestamps(deck, ctx, "", ["createdAt", "updatedAt"]);
    metadata(deck, ctx, "");
    const template = deck.template;
    if (!record(template)) { finding(ctx, "blocker", "MALFORMED_LIVE_TEMPLATE", "template", "No usable current live template; snapshots are deliberately ignored."); return; }
    const affectedCards = new Set();
    const definitionsBefore = counts.legacySignalFields;
    legacyDefinitions(template, ctx, "template", affectedCards);
    if (counts.legacySignalFields > definitionsBefore) counts.liveTemplatesWithLegacySignalFields++;
    counts.liveCardsWithLegacySignalFields += affectedCards.size;
    if (template.deckTemplateId !== deck.deckTemplateId || !id(template.deckTemplateId)) finding(ctx, "blocker", "ROOT_TEMPLATE_ID_MISMATCH", "template.deckTemplateId", "Root and live-template identities differ or are missing.", { templateId: identifier(template.deckTemplateId) });
    checkText(template.title, ctx, "template.title");
    if (!nullableText(template.category)) finding(ctx, "warning", "MALFORMED_CATEGORY", "template.category", "Expected a string or null category.");
    if (template.introduction != null) {
      if (!record(template.introduction)) finding(ctx, "warning", "MALFORMED_DECK_INTRODUCTION", "template.introduction", "Expected null or an introduction object.");
      else {
        if (!own(template.introduction, "image") || !own(template.introduction, "video")) finding(ctx, "warning", "INCOMPLETE_DECK_INTRODUCTION", "template.introduction", "Introduction object is missing an image/video slot.");
        media(template.introduction.image, ctx, "template.introduction.image", "canonical", "image");
        media(template.introduction.video, ctx, "template.introduction.video", "canonical", "video");
      }
    }
    if (own(template, "streams")) themes(template.streams, ctx, "template.streams");
    else if (own(template, "channels")) {
      finding(ctx, "warning", "LEGACY_CHANNELS_FIELD", "template.channels", "Stored themes use the older channels field; no normalization was applied.");
      themes(template.channels, ctx, "template.channels");
    } else themes(undefined, ctx, "template.streams");
    if (own(template, "streams") && own(template, "channels")) finding(ctx, "warning", "MULTIPLE_THEME_FIELDS", "template", "Both streams and channels exist; review their intended source.");
    if (own(template, "themes")) {
      finding(ctx, "warning", "ADDITIONAL_THEMES_FIELD", "template.themes", "Current persisted contract uses streams; review this extra metadata.");
      themes(template.themes, ctx, "template.themes");
    }
    metadata(template, ctx, "template.");
    if (!Array.isArray(template.cards)) { finding(ctx, "blocker", "MALFORMED_CARDS", "template.cards", "Live Cards cannot be enumerated."); return; }
    counts.liveCards += template.cards.length;
    if (!template.cards.length) finding(ctx, "warning", "ZERO_CARD_DECK", "template.cards", "Deck contains no live Cards.");
    else labels(template.cards, ctx);
    const cardsById = groups(template.cards, (card) => card?.cardId);
    deckInfos.set(deckIndex, { template, cardsById, identityMatches: template.deckTemplateId === deck.deckTemplateId });
    for (const [cardId, entries] of cardsById) if (entries.length > 1) finding(ctx, "blocker", "DUPLICATE_LOCAL_CARD_ID", "template.cards", "Personal state cannot be mapped unambiguously within this Deck.", { cardId: identifier(cardId), indices: entries.map((entry) => entry.index) });
    template.cards.forEach((card, cardIndex) => {
      const path = `template.cards[${cardIndex}]`;
      if (!record(card)) { finding(ctx, "blocker", "MALFORMED_CARD", path, "Live Card is not an object."); return; }
      if (!id(card.cardId)) finding(ctx, "blocker", "MISSING_LOCAL_CARD_ID", `${path}.cardId`, "Card identity is missing or blank.");
      intro(card.intro, ctx, `${path}.intro`);
      checkDate(card.suggestedTargetDate, ctx, `${path}.suggestedTargetDate`, true);
      media(card.mediaItem, ctx, `${path}.mediaItem`, "canonical");
      if (!Array.isArray(card.steps)) { finding(ctx, "blocker", "MISSING_STEP_ARRAY", `${path}.steps`, "Canonical Step content cannot be enumerated."); return; }
      counts.liveSteps += card.steps.length;
      if (card.steps.length !== 3) finding(ctx, "blocker", "STEP_COUNT_NOT_THREE", `${path}.steps`, "Canonical Card structure requires exactly three current live Steps.", { count: card.steps.length });
      for (const [stepId, entries] of groups(card.steps, (step) => step?.stepId)) if (entries.length > 1) finding(ctx, "blocker", "DUPLICATE_STEP_ID_IN_CARD", `${path}.steps`, "Canonical Step identity is ambiguous within this Card.", { stepId: identifier(stepId), indices: entries.map((entry) => entry.index) });
      card.steps.forEach((step, stepIndex) => {
        const stepPath = `${path}.steps[${stepIndex}]`;
        if (!record(step)) { finding(ctx, "blocker", "MALFORMED_STEP", stepPath, "Step slot is not an object."); return; }
        if (!id(step.stepId)) finding(ctx, "blocker", "MISSING_STEP_ID", `${stepPath}.stepId`, "Step identity is absent or blank.");
        else {
          const occurrences = stepOccurrences.get(step.stepId) ?? [];
          occurrences.push({ documentId: ctx.documentId, deckTemplateId: identifier(deck.deckTemplateId), cardIndex, cardId: identifier(card.cardId), stepIndex });
          stepOccurrences.set(step.stepId, occurrences);
        }
        if (own(step, "title")) checkText(step.title, ctx, `${stepPath}.title`);
        checkText(step.description, ctx, `${stepPath}.description`, true);
        if (own(step, "descriptionContent") && (!Array.isArray(step.descriptionContent) || step.descriptionContent.some((span) => !record(span) || !["text", "link"].includes(span.type) || typeof span.text !== "string" || (span.type === "link" && !id(span.url))))) finding(ctx, "warning", "MALFORMED_RICH_TEXT", `${stepPath}.descriptionContent`, "Rich text contains unsupported spans.");
        media(step.mediaItem, ctx, `${stepPath}.mediaItem`, "canonical");
      });
    });
  });
  for (const [stepId, occurrences] of stepOccurrences) {
    const cards = new Set(occurrences.map((entry) => `${entry.documentId}:${entry.cardIndex}`));
    if (cards.size > 1) finding({ collection: "deckTemplates", documentId: occurrences[0].documentId }, "warning", "STEP_ID_REUSED_ACROSS_CARDS", "template.cards[*].steps[*].stepId", "Step IDs repeat across Cards; later global identity migration must resolve this explicitly.", { stepId: identifier(stepId), occurrences });
  }

  function sharing(value, ctx, path, deckReferences) {
    if (value === undefined) return;
    counts[deckReferences ? "sharedDeckDataFields" : "sharedWithUserIdsFields"]++;
    if (!Array.isArray(value)) { finding(ctx, "warning", "MALFORMED_SHARING", path, "Sharing field is not an array; preserve its raw value.", { hash: fingerprint(value) }); return; }
    counts[deckReferences ? "sharedDeckDataEntries" : "sharedWithUserIdsEntries"] += value.length;
    value.forEach((entry, index) => {
      if (deckReferences ? !record(entry) || !id(entry.deckTemplateId) || !id(entry.deckUserId) || Object.keys(entry).some((key) => !["deckTemplateId", "deckUserId"].includes(key)) : !id(entry)) finding(ctx, "warning", "MALFORMED_SHARING_ENTRY", `${path}[${index}]`, "Unexpected stored sharing shape; authorization is not reconstructed.", { hash: fingerprint(entry) });
    });
  }
  function chats(value, ctx, path, sourceResolved) {
    if (!Array.isArray(value)) { finding(ctx, "warning", "MALFORMED_CHATS", path, "Expected a chat array."); return; }
    counts.chats += value.length;
    if (sourceResolved) counts.chatsWithRecoverableDeckContext += value.length;
    else if (value.length) finding(ctx, "warning", "CHAT_CONTEXT_UNRESOLVED", path, "Chats have no unambiguous live Deck/Card context.", { count: value.length });
    value.forEach((chat, index) => {
      const chatPath = `${path}[${index}]`;
      if (!record(chat) || !id(chat.id) || !Array.isArray(chat.comments)) { finding(ctx, "warning", "MALFORMED_CHAT", chatPath, "Expected chat id and comments array."); return; }
      counts.comments += chat.comments.length;
      chat.comments.forEach((comment, commentIndex) => {
        if (!record(comment) || !id(comment.id) || !id(comment.creatorId) || !validTimestamp(comment.createdAt) || typeof comment.text !== "string" || typeof comment.isRetained !== "boolean") finding(ctx, "warning", "MALFORMED_COMMENT", `${chatPath}.comments[${commentIndex}]`, "Comment shape is malformed; body is omitted from the report.");
      });
    });
  }
  function signals(card, sourceCard, ctx, path) {
    const steps = sourceCard?.steps;
    const validSteps = Array.isArray(steps) && steps.length === 3 && steps.every((step) => record(step) && id(step.stepId)) && new Set(steps.map((step) => step.stepId)).size === 3;
    let ambiguous = !validSteps;
    if (!Array.isArray(card.signalReadings)) {
      finding(ctx, "blocker", "MISSING_SIGNAL_ARRAY", `${path}.signalReadings`, "Persisted readings cannot be fully accounted for.");
      counts.personalCardsWithAmbiguousSignals++;
      return;
    }
    const byId = groups(card.signalReadings, (signal) => signal?.signalId);
    for (const [signalId, entries] of byId) if (entries.length > 1) {
      ambiguous = true;
      finding(ctx, "blocker", "DUPLICATE_SIGNAL_ID", `${path}.signalReadings`, "More than one reading exists for the same signal position.", { signalId: identifier(signalId), indices: entries.map((entry) => entry.index) });
    }
    const missingPositions = POSITIONAL_IDS.filter((position) => !byId.has(position));
    if (missingPositions.length) finding(ctx, "information", "MISSING_POSITIONAL_READINGS", `${path}.signalReadings`, "Legacy positions have no stored reading; all new readings will start unset.", { missingPositions });
    card.signalReadings.forEach((signal, index) => {
      counts.signalReadings++;
      const signalPath = `${path}.signalReadings[${index}]`;
      const positional = record(signal) && POSITIONAL_IDS.includes(signal.signalId);
      if (positional) counts.positionalSignalReadings++;
      else {
        counts.unexpectedSignalIds++;
        ambiguous = true;
        finding(ctx, "information", "UNEXPECTED_SIGNAL_ID", `${signalPath}.signalId`, "Legacy reading has an ID outside 0, 1 and 2; no interpretation or compatibility is required.", { signalId: identifier(signal?.signalId), valueType: typeof signal?.signalId });
      }
      if (positional && validSteps && byId.get(signal.signalId).length === 1) counts.unambiguouslyAttributedSignalReadings++;
      if (!record(signal) || !(signal.reading === null || (typeof signal.reading === "number" && Number.isFinite(signal.reading)))) finding(ctx, "warning", "MALFORMED_SIGNAL_VALUE", `${signalPath}.reading`, "Reading must be a finite number or null; it was not coerced.");
      else if (signal.reading !== null && (signal.reading < 1 || signal.reading > 10)) finding(ctx, "warning", "SIGNAL_OUT_OF_RANGE", `${signalPath}.reading`, "Numeric reading is outside 1–10; it was not clamped.", { reading: signal.reading });
    });
    if (ambiguous) {
      counts.personalCardsWithAmbiguousSignals++;
      finding(ctx, "blocker", "AMBIGUOUS_POSITIONAL_SIGNAL_MAPPING", `${path}.signalReadings`, "Not all stored positional readings can be mapped to exactly three identifiable current live Steps.");
    }
  }

  const membershipByUser = new Map();
  sources.users.forEach((user) => {
    const userId = identifier(user._id);
    const userCtx = { collection: "users", documentId: userId };
    timestamps(user, userCtx, "", ["createdAt", "updatedAt"]);
    sharing(user.sharedDeckData, userCtx, "sharedDeckData", true);
    if (own(user, "sharedWithUserIds")) {
      finding(userCtx, "warning", "UNEXPECTED_USER_SHARING_FIELD", "sharedWithUserIds", "This sharing field normally belongs inside DeckData; preserve it for review.");
      sharing(user.sharedWithUserIds, userCtx, "sharedWithUserIds", false);
    }
    if (!Array.isArray(user.decksData)) {
      counts.uninspectableDeckDataContainers++;
      finding(userCtx, "blocker", "MALFORMED_DECK_DATA_ARRAY", "decksData", "Personal state and My Decks membership cannot be fully enumerated.");
      return;
    }
    const memberships = groups(user.decksData, (deck) => deck?.deckTemplateId);
    membershipByUser.set(userId, memberships);
    for (const [deckId, entries] of memberships) if (entries.length > 1) {
      counts.ambiguousMembershipCandidates++;
      const statesByCard = new Map();
      entries.forEach(({ value }) => {
        if (Array.isArray(value.cards)) value.cards.forEach((card) => {
          if (!id(card?.cardId)) return;
          const hashes = statesByCard.get(card.cardId) ?? new Set();
          hashes.add(fingerprint(card)); statesByCard.set(card.cardId, hashes);
        });
      });
      finding({ ...userCtx, deckTemplateId: deckId }, "blocker", "DUPLICATE_USER_DECK_DATA", "decksData", "One retained user/Deck membership is ambiguous; duplicate records must not be silently dropped.", {
        indices: entries.map((entry) => entry.index), differingRecords: new Set(entries.map(({ value }) => fingerprint(value))).size > 1,
        conflictingCardIds: [...statesByCard].filter(([, hashes]) => hashes.size > 1).map(([cardId]) => identifier(cardId)),
      });
    }
    user.decksData.forEach((deckData, deckDataIndex) => {
      counts.personalDeckData++;
      const path = `decksData[${deckDataIndex}]`;
      if (!record(deckData)) { counts.uninspectablePersonalCardContainers++; counts.uninspectablePersonalMediaContainers++; finding(userCtx, "blocker", "MALFORMED_DECK_DATA", path, "DeckData is not an object; membership and possible media cannot be enumerated."); return; }
      const ctx = { ...userCtx, deckTemplateId: deckData.deckTemplateId };
      if (!id(deckData.deckTemplateId)) finding(ctx, "blocker", "MISSING_DECK_DATA_TEMPLATE_ID", `${path}.deckTemplateId`, "Personal Deck source cannot be resolved.");
      const candidates = decksById.get(deckData.deckTemplateId) ?? [];
      if (candidates.length === 0) finding(ctx, "blocker", "DECK_DATA_MISSING_TEMPLATE", `${path}.deckTemplateId`, "Current DeckData points to no live DeckTemplate.");
      const info = candidates.length === 1 ? deckInfos.get(candidates[0].index) : undefined;
      const resolvedInfo = info?.identityMatches ? info : undefined;
      timestamps(deckData, ctx, `${path}.`, ["createdAt", "updatedAt"]);
      sharing(deckData.sharedWithUserIds, ctx, `${path}.sharedWithUserIds`, false);
      for (const field of Object.keys(deckData)) if (/shar/i.test(field) && field !== "sharedWithUserIds") finding(ctx, "warning", "UNEXPECTED_DECK_SHARING_FIELD", `${path}.${field}`, "Unexpected sharing metadata is preserved, not interpreted.", { hash: fingerprint(deckData[field]) });
      if (!id(deckData.activeCardId)) finding(ctx, "warning", "INVALID_ACTIVE_CARD_ID", `${path}.activeCardId`, "Active Card reference is missing, blank or malformed.", { zeroCardDeck: resolvedInfo?.template.cards.length === 0 });
      else if ((resolvedInfo?.cardsById.get(deckData.activeCardId)?.length ?? 0) !== 1) finding(ctx, "warning", "UNRESOLVED_ACTIVE_CARD", `${path}.activeCardId`, "Active Card does not resolve to exactly one live Card. This selection does not determine personal media destinations.", { cardId: identifier(deckData.activeCardId), zeroCardDeck: resolvedInfo?.template.cards.length === 0 });
      if (!Array.isArray(deckData.cards)) {
        counts.uninspectablePersonalCardContainers++;
        const mayContainMedia = deckData.cards != null;
        if (mayContainMedia) counts.uninspectablePersonalMediaContainers++;
        finding(ctx, "blocker", "MALFORMED_PERSONAL_CARDS", `${path}.cards`, "Personal Card records cannot be enumerated.", { mayContainMedia });
        return;
      }
      for (const [cardId, entries] of groups(deckData.cards, (card) => card?.cardId)) if (entries.length > 1) finding(ctx, "warning", "DUPLICATE_PERSONAL_CARD", `${path}.cards`, "Multiple personal states exist for one local Card; learning-state differences are discarded, but all media references must be retained and checked for conflicting IDs.", {
        cardId: identifier(cardId), indices: entries.map((entry) => entry.index), conflictingState: new Set(entries.map(({ value }) => fingerprint(value))).size > 1,
        containsMedia: entries.some(({ value }) => Array.isArray(value.mediaItems) && value.mediaItems.length > 0),
        mayContainMedia: entries.some(({ value }) => value.mediaItems != null && !Array.isArray(value.mediaItems)),
      });
      deckData.cards.forEach((card, cardIndex) => {
        counts.personalCardStates++;
        const cardPath = `${path}.cards[${cardIndex}]`;
        if (!record(card)) {
          counts.personalCardsWithAmbiguousSignals++;
          const mayContainMedia = Array.isArray(card) && card.length > 0;
          if (mayContainMedia) counts.uninspectablePersonalMediaContainers++;
          finding(ctx, "blocker", "MALFORMED_PERSONAL_CARD", cardPath, "Personal Card state is not an object.", { mayContainMedia });
          return;
        }
        const sourceCards = resolvedInfo?.cardsById.get(card.cardId) ?? [];
        const sourceCard = sourceCards.length === 1 ? sourceCards[0].value : undefined;
        const containsMedia = Array.isArray(card.mediaItems) && card.mediaItems.length > 0;
        const mayContainMedia = card.mediaItems != null && !Array.isArray(card.mediaItems);
        const missingSource = (id(deckData.deckTemplateId) && candidates.length === 0) || (resolvedInfo && id(card.cardId) && sourceCards.length === 0);
        const mapping = sourceCard ? "mapped" : missingSource ? "orphaned" : "ambiguous";
        if (containsMedia) {
          counts.mediaBearingPersonalCardStates++;
          counts[`${mapping}MediaBearingCardStates`]++;
        }
        if (sourceCard) counts.accountedPersonalCardStates++;
        else finding(ctx, "blocker", "ORPHAN_OR_AMBIGUOUS_PERSONAL_CARD", `${cardPath}.cardId`, "No unique live Card exists for this personal state.", {
          cardId: identifier(card.cardId), containsMedia, mayContainMedia, mediaItemCount: Array.isArray(card.mediaItems) ? card.mediaItems.length : null, mapping,
        });
        checkDate(card.targetDate, ctx, `${cardPath}.targetDate`);
        if (!Array.isArray(card.items)) finding(ctx, "blocker", "MALFORMED_COMPLETION_ITEMS", `${cardPath}.items`, "Stored completion cannot be fully accounted for.");
        else {
          for (const [itemId, entries] of groups(card.items, (item) => item?.itemId)) if (entries.length > 1) finding(ctx, "blocker", "DUPLICATE_COMPLETION_ITEM_ID", `${cardPath}.items`, "Completion has multiple entries for one Step ID.", { itemId: identifier(itemId), indices: entries.map((entry) => entry.index) });
          card.items.forEach((item, itemIndex) => {
            const itemPath = `${cardPath}.items[${itemIndex}]`;
            if (!record(item) || !id(item.itemId)) finding(ctx, "blocker", "MALFORMED_COMPLETION_ITEM", itemPath, "Completion item ID is missing or malformed.");
            else if (!Array.isArray(sourceCard?.steps) || sourceCard.steps.filter((step) => step?.stepId === item.itemId).length !== 1) finding(ctx, "blocker", "UNKNOWN_COMPLETION_STEP", `${itemPath}.itemId`, "Completion cannot be assigned to one live Step.", { itemId: identifier(item.itemId) });
            if (!COMPLETIONS.includes(item?.completionStatus)) finding(ctx, "warning", "INVALID_COMPLETION_VALUE", `${itemPath}.completionStatus`, "Expected todo, inProgress, done or skipped.");
          });
        }
        signals(card, sourceCard, ctx, cardPath);
        checkText(card.reflection, ctx, `${cardPath}.reflection`);
        if (!Array.isArray(card.mediaItems)) {
          if (mayContainMedia) {
            counts.uninspectablePersonalMediaContainers++;
            finding(ctx, "blocker", "MALFORMED_PERSONAL_MEDIA_ARRAY", `${cardPath}.mediaItems`, "Non-array media container could contain retained assets; automatic preservation cannot be established.", { valueType: typeof card.mediaItems, referenceHash: fingerprint(card.mediaItems) });
          } else finding(ctx, "information", "MISSING_PERSONAL_MEDIA_ARRAY", `${cardPath}.mediaItems`, "No personal media array is stored; no retained media items are present at this path.");
        } else card.mediaItems.forEach((entry, mediaIndex) => {
          counts.totalPersonalMediaItems++;
          if (!sourceCard) counts.personalMediaItemsWithUnknownDestination++;
          const mediaPath = `${cardPath}.mediaItems[${mediaIndex}]`;
          personalMediaCandidates.push({
            ctx, path: mediaPath, value: entry, metadataValid: media(entry, ctx, mediaPath, "personal"), sourceResolved: Boolean(sourceCard),
            destinationKey: JSON.stringify([userId, deckData.deckTemplateId, card.cardId]), conflict: false,
          });
        });
        chats(card.chats, ctx, `${cardPath}.chats`, Boolean(sourceCard));
      });
    });
  });
  // Same destination and media ID cannot silently choose between incompatible references.
  // Count occurrences, without deduplicating, copying or rewriting any persisted metadata.
  const mediaByDestinationAndId = new Map();
  for (const candidate of personalMediaCandidates) {
    if (!candidate.sourceResolved || !id(candidate.value?.id)) continue;
    const key = JSON.stringify([candidate.destinationKey, candidate.value.id]);
    const entries = mediaByDestinationAndId.get(key) ?? [];
    entries.push(candidate); mediaByDestinationAndId.set(key, entries);
  }
  for (const entries of mediaByDestinationAndId.values()) {
    if (new Set(entries.map((entry) => fingerprint(entry.value))).size <= 1) continue;
    entries.forEach((entry) => { entry.conflict = true; });
    const first = entries[0];
    finding(first.ctx, "blocker", "MEDIA_ID_CONFLICT", first.path, "One future personal Card destination has incompatible metadata for the same media ID; automatic merging could lose an uploaded asset.", {
      mediaId: identifier(first.value.id), paths: entries.map((entry) => entry.path), referenceHashes: entries.map((entry) => fingerprint(entry.value)),
    });
  }
  counts.safePersonalMediaItems = personalMediaCandidates.filter((entry) => entry.sourceResolved && entry.metadataValid && !entry.conflict).length;
  sources.deckTemplates.forEach((deck, deckIndex) => {
    if (!id(deck.ownerUserId) || !userIds.has(identifier(deck.ownerUserId)) || !id(deck.deckTemplateId)) return;
    const memberships = membershipByUser.get(identifier(deck.ownerUserId));
    const ctx = { collection: "deckTemplates", documentId: identifier(deck._id), deckTemplateId: deck.deckTemplateId };
    if (!memberships) {
      counts.ambiguousMembershipCandidates++;
      finding(ctx, "blocker", "AMBIGUOUS_OWNER_MEMBERSHIP", "ownerUserId", "Owner DeckData cannot be enumerated, so existing membership is unknown.");
      return;
    }
    if (memberships.has(deck.deckTemplateId)) return;
    if ((decksById.get(deck.deckTemplateId)?.length ?? 0) !== 1 || !deckInfos.get(deckIndex)?.identityMatches) {
      counts.ambiguousMembershipCandidates++;
      finding(ctx, "blocker", "AMBIGUOUS_OWNER_MEMBERSHIP", "ownerUserId", "Missing owner DeckData cannot safely be turned into explicit membership.");
    } else {
      counts.expectedMembershipAdditions++;
      finding(ctx, "information", "OWNER_MEMBERSHIP_TO_CREATE", "ownerUserId", "Owned live template has no owner DeckData; this is expected migration work for current My Decks behaviour.", { ownerUserId: identifier(deck.ownerUserId) });
    }
  });
  for (const change of drift) finding(change, "warning", "SOURCE_CHANGED_DURING_SCAN", "", "Source scans differ; rerun the audit on a quiet database before migration planning.", change);
  for (const collection of Object.keys(SOURCE_PROJECTIONS)) if (!sources[collection].length) finding({ collection, documentId: null }, "warning", "EMPTY_SOURCE_COLLECTION", "", "Collection is empty; verify the selected database before trusting readiness.");
  const bySeverity = { blocker: 0, decision: 0, warning: 0, information: 0 };
  const byCode = {};
  const byImpact = {};
  findings.forEach(({ severity, code, impact }) => {
    bySeverity[severity]++;
    byCode[code] ??= { total: 0, blocker: 0, decision: 0, warning: 0, information: 0 };
    byCode[code].total++; byCode[code][severity]++;
    byImpact[impact] ??= { total: 0, blocker: 0, decision: 0, warning: 0, information: 0 };
    byImpact[impact].total++; byImpact[impact][severity]++;
  });
  const everyPersonalCardAccountedFor = counts.personalCardStates === counts.accountedPersonalCardStates && counts.uninspectableDeckDataContainers === 0 && counts.uninspectablePersonalCardContainers === 0;
  const canonicalBlockers = byImpact.canonical?.blocker ?? 0;
  const mediaPreservationBlockers = byImpact["personal-media"]?.blocker ?? 0;
  const mediaAccountingComplete = counts.uninspectablePersonalMediaContainers === 0 && counts.uninspectableDeckDataContainers === 0;
  const everyMediaBearingCardMapped = mediaAccountingComplete && counts.mediaBearingPersonalCardStates === counts.mappedMediaBearingCardStates;
  const everyPersonalMediaItemSafelyPreservable = mediaAccountingComplete && counts.totalPersonalMediaItems === counts.safePersonalMediaItems;
  const structurallyReady = bySeverity.blocker === 0 && everyMediaBearingCardMapped && everyPersonalMediaItemSafelyPreservable;
  const reviewRequired = bySeverity.decision > 0 || drift.length > 0 || counts.deckTemplates === 0 || counts.users === 0;
  const summary = {
    schemaVersion: 2, status: "complete", auditTimestamp: endedAt, startedAt, endedAt,
    databaseName, collectionsAudited: Object.keys(SOURCE_PROJECTIONS), sourceCounts: counts,
    findingCounts: { bySeverity, byCode, byImpact },
    preservationPolicy: {
      name: "personal-card-media-only", retainedPersonalCardFields: ["mediaItems"],
      discardedPersonalCardState: ["completion", "signalReadings", "signal IDs", "reflection", "chats/comments", "tests", "targetDate", "other learning/demo state"],
      discardObsoleteTemplateSignalDefinitions: true,
      futureInitialization: { completionStatus: "todo", signalIdentity: "current Step ID", signalReading: null },
      note: "Policy metadata only. This audit does not reset, migrate or modify any source data.",
    },
    legacySourceAccounting: { everyPersonalCardAccountedFor, requiredForReadiness: false },
    drift: { status: drift.length ? "potentially changed during scan" : "stable", observedChanges: drift.length,
      method: "Two full primary/majority reads of relevant projected sources; stable means no observed difference, not a snapshot guarantee." },
    readiness: { status: !structurallyReady ? "blocked" : reviewRequired ? "review-required" : bySeverity.warning ? "ready-with-warnings" : "ready",
      structurallyReady, subjectToListedDecisions: bySeverity.decision > 0, canonicalStructurallyMigratable: canonicalBlockers === 0,
      everyMediaBearingCardMapped, everyPersonalMediaItemSafelyPreservable, mediaAccountingComplete,
      canonicalBlockers, mediaPreservationBlockers,
      membershipBlockers: byImpact.membership?.blocker ?? 0, sharingBlockers: byImpact.sharing?.blocker ?? 0,
      intentionallyDiscardedLearningStateAnomalies: byImpact["discarded-learning-state"]?.total ?? 0 },
    sourceScope: "Current live template only; savedTemplate/previousVersions and user credentials excluded. Counts include malformed array entries; media counts are reference occurrences, not distinct assets.",
    mongoOperations: ["connect", "find", "sort (_id)", "cursor iteration / getMore", "close / cursor cleanup"],
  };
  return { summary, findings, manifest: sourceManifest(sources) };
}

/**
 * @param {object} database
 * @param {(stage: string) => void} [onStage]
 */
export async function readSources(database, onStage = () => {}) {
  const sources = {};
  for (const [collection, projection] of Object.entries(SOURCE_PROJECTIONS)) {
    onStage(`read ${collection}`);
    sources[collection] = await database.collection(collection).find({}, { projection, batchSize: 200, maxTimeMS: 60_000 }).sort({ _id: 1 }).toArray();
  }
  return sources;
}

export function summaryText(summary) {
  const c = summary.sourceCounts;
  const f = summary.findingCounts.bySeverity;
  return [
    "Read-only pre-Library migration audit", `Database: ${summary.databaseName}`,
    `Audit: ${summary.startedAt} to ${summary.endedAt}`, `Drift: ${summary.drift.status}`,
    `DeckTemplates: ${c.deckTemplates}; Users: ${c.users}; live Cards: ${c.liveCards}; live Steps: ${c.liveSteps}`,
    `Personal DeckData: ${c.personalDeckData}; personal Card states: ${c.personalCardStates}; accounted: ${c.accountedPersonalCardStates}`,
    `Signals: ${c.signalReadings} total; ${c.positionalSignalReadings} positional; ${c.unexpectedSignalIds} unexpected IDs`,
    `Obsolete template Signal fields: ${c.legacySignalFields}; definitions: ${c.legacySignalDefinitions}; affected Decks/Cards: ${c.liveTemplatesWithLegacySignalFields}/${c.liveCardsWithLegacySignalFields}`,
    `Empty suggested dates (valid): ${c.emptySuggestedDates}; media references: ${c.mediaReferences}; chats/comments: ${c.chats}/${c.comments}`,
    `Sharing fields/entries: sharedDeckData ${c.sharedDeckDataFields}/${c.sharedDeckDataEntries}; sharedWithUserIds ${c.sharedWithUserIdsFields}/${c.sharedWithUserIdsEntries}`,
    `Blockers: ${f.blocker}; decisions: ${f.decision}; warnings: ${f.warning}; information: ${f.information}`,
    `Expected owner membership additions: ${c.expectedMembershipAdditions}; ambiguous membership candidates: ${c.ambiguousMembershipCandidates}`,
    "Preservation policy: retain personal Card media only; discard/reset all other personal Card learning/demo state and obsolete template Signal definitions.",
    "Future initialization (not performed): completion todo per current Step; signal reading null per current Step ID.",
    `Media-bearing Card states: ${c.mediaBearingPersonalCardStates}; mapped: ${c.mappedMediaBearingCardStates}; orphaned: ${c.orphanedMediaBearingCardStates}; ambiguous: ${c.ambiguousMediaBearingCardStates}`,
    `Personal media items: ${c.totalPersonalMediaItems}; safe to preserve automatically: ${c.safePersonalMediaItems}; malformed metadata: ${c.malformedPersonalMediaItems}; unknown destination: ${c.personalMediaItemsWithUnknownDestination}`,
    `Uninspectable media containers: ${c.uninspectablePersonalMediaContainers}; uninspectable DeckData containers: ${c.uninspectableDeckDataContainers}`,
    `Canonical Deck/Card/Step structurally migratable: ${summary.readiness.canonicalStructurallyMigratable ? "yes" : "NO"}; canonical blockers: ${summary.readiness.canonicalBlockers}`,
    `Every media-bearing Card state maps unambiguously: ${summary.readiness.everyMediaBearingCardMapped ? "yes" : "NO"}`,
    `Every personal media item safely preservable: ${summary.readiness.everyPersonalMediaItemSafelyPreservable ? "yes" : "NO"}; media-preservation blockers: ${summary.readiness.mediaPreservationBlockers}`,
    `Membership blockers: ${summary.readiness.membershipBlockers}; sharing blockers: ${summary.readiness.sharingBlockers}`,
    `Legacy learning-state anomalies intentionally ignored/reset: ${summary.readiness.intentionallyDiscardedLearningStateAnomalies} findings (not distinct records)`,
    `Legacy personal Card source accounting (diagnostic only): ${summary.legacySourceAccounting.everyPersonalCardAccountedFor ? "complete" : "incomplete; non-media records do not block readiness"}`,
    `Structural readiness: ${summary.readiness.structurallyReady ? "yes, subject to listed decisions/warnings" : "NO"}; status: ${summary.readiness.status}`,
    c.unexpectedSignalIds === 0 && c.legacySignalFields === 0 ? "No unexpected legacy Signal IDs or template-level Signal definitions were found." : "Legacy Signal counts are historical information only; all old readings/IDs/definitions are discarded, without mapping or compatibility requirements.",
    "Reports contain identifiers, paths and hashes; no chat bodies, reflections, credentials or asset URLs.",
    "Stable is an observational check, not a transactional snapshot. No MongoDB writes or asset requests were performed.",
  ].join("\n") + "\n";
}

function csvCell(value) {
  let text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  // Prevent spreadsheet formula evaluation, including leading whitespace/control characters.
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function writeReports(result, outputDirectory) {
  const files = {
    "summary.json": JSON.stringify(result.summary, null, 2) + "\n",
    "findings.jsonl": result.findings.map((entry) => JSON.stringify(entry)).join("\n") + (result.findings.length ? "\n" : ""),
    "source-manifest.jsonl": result.manifest.map((entry) => JSON.stringify(entry)).join("\n") + (result.manifest.length ? "\n" : ""),
    "review.csv": [
      ["severity", "code", "impact", "collection", "documentId", "deckTemplateId", "path", "reason", "details", "suggestedResolution"].map(csvCell).join(","),
      ...result.findings.map((entry) => [entry.severity, entry.code, entry.impact, entry.collection, entry.documentId, entry.deckTemplateId, entry.path, entry.reason, entry.details, entry.suggestedResolution].map(csvCell).join(",")),
    ].join("\n") + "\n",
    "summary.txt": summaryText(result.summary),
  };
  for (const [filename, contents] of Object.entries(files)) await writeFile(join(outputDirectory, filename), contents, { mode: 0o600, flag: "wx" });
}

const HELP = `Usage: node --env-file=.env.local scripts/audit-pre-library-migration.mjs [--output migration-audit]
Required for Atlas: MONGODB_URI and MONGODB_DB (existing app variables).
Offline: node scripts/audit-pre-library-migration.mjs --fixtures tests/fixtures/migration-audit-clean.json
Optional --output DIRECTORY chooses the local parent directory; each run creates a unique subdirectory.
Exit 0: ready/ready-with-warnings; 2: blocked/review-required; 1: failed/incomplete.
Only MongoDB reads are used. No asset requests. A read-only Atlas database role provides an additional permission boundary.
`;

export function failureDiagnostics(error, stage) {
  // Copy only token-shaped diagnostic fields, never message/stack/errorResponse.
  const token = (value) => typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(value) ? value : null;
  const errorName = token(error?.name) ?? "Error";
  const errorCode = typeof error?.code === "number" && Number.isSafeInteger(error.code) ? error.code : null;
  const errorCodeName = token(error?.codeName);
  let reason = "Audit incomplete. Check the reported stage, local inputs and file permissions; no readiness conclusion is valid.";
  if (error instanceof AuditError) reason = error.message;
  else if (errorCode === 13 || errorCodeName === "Unauthorized") reason = "MongoDB denied the required read operation. Verify collection read permissions for the selected database.";
  else if (errorCode === 18 || errorCodeName === "AuthenticationFailed") reason = "MongoDB authentication failed. Check local connection credentials and authentication settings.";
  else if (errorName.startsWith("Mongo")) reason = "MongoDB could not complete the reported operation. Check the error code, local connection settings and collection read permissions.";
  return { errorCategory: error instanceof AuditError ? error.code : errorName, errorName, errorCode, errorCodeName, stage, reason };
}

/**
 * @param {string[]} [args]
 * @param {Record<string, string | undefined>} [env]
 * @param {(uri: string, options: import("mongodb").MongoClientOptions) => { connect(): Promise<unknown>, db(name: string): object, close(): Promise<void> }} [createClient] Test injection; CLI always uses MongoClient.
 */
export async function main(args = process.argv.slice(2), env = process.env, createClient = (uri, options) => new MongoClient(uri, options)) {
  if (args.includes("--help")) { console.log(HELP); return 0; }
  let fixturePath;
  let outputParent = "migration-audit";
  for (let index = 0; index < args.length; index++) {
    if (!["--fixtures", "--output"].includes(args[index]) || !args[index + 1] || args[index + 1].startsWith("--")) throw new AuditError("INVALID_ARGUMENTS", "Invalid arguments. Use --help.");
    if (args[index] === "--fixtures") fixturePath = args[++index];
    else outputParent = args[++index];
  }
  if (!fixturePath && (!env.MONGODB_URI?.trim() || !env.MONGODB_DB?.trim())) throw new AuditError("MISSING_CONFIGURATION", "MONGODB_URI and MONGODB_DB must both be set. No connection was attempted.");
  const startedAt = new Date().toISOString();
  await mkdir(resolve(outputParent), { recursive: true, mode: 0o700 });
  const outputDirectory = await mkdtemp(join(resolve(outputParent), `audit-${startedAt.replaceAll(":", "-")}-`));
  const statusPath = join(outputDirectory, "run-status.json");
  await writeFile(statusPath, JSON.stringify({ status: "incomplete", startedAt }) + "\n", { mode: 0o600 });
  let client;
  let stage = "read fixtures";
  let scanPass = null;
  try {
    let sources;
    let drift = [];
    if (fixturePath) {
      sources = BSON.EJSON.parse(await readFile(resolve(fixturePath), "utf8"));
      if (!Array.isArray(sources.deckTemplates) || !Array.isArray(sources.users) || [...sources.deckTemplates, ...sources.users].some((entry) => !record(entry))) throw new AuditError("INVALID_FIXTURE", "Fixture must contain deckTemplates and users document arrays.");
    } else {
      stage = "connect";
      client = createClient(env.MONGODB_URI.trim(), { appName: "switchplay-read-only-migration-audit", readPreference: "primary", readConcern: { level: "majority" }, serverSelectionTimeoutMS: 15_000, socketTimeoutMS: 90_000 });
      await client.connect();
      stage = "select database";
      const database = client.db(env.MONGODB_DB.trim());
      const onStage = (nextStage) => { stage = nextStage; };
      scanPass = "initial";
      sources = await readSources(database, onStage);
      scanPass = "verification";
      const verificationSources = await readSources(database, onStage);
      stage = "compare source manifests";
      drift = compareManifests(sourceManifest(sources), sourceManifest(verificationSources));
    }
    stage = "audit sources";
    const result = auditSources(sources, { databaseName: fixturePath ? "fixture-data (offline)" : env.MONGODB_DB.trim(), startedAt, endedAt: new Date().toISOString(), drift });
    result.summary.endedAt = new Date().toISOString();
    result.summary.auditTimestamp = result.summary.endedAt;
    if (fixturePath) result.summary.drift = { status: "stable", observedChanges: 0, method: "Offline fixture; no MongoDB connection or concurrent data source." };
    if (fixturePath) result.summary.mongoOperations = [];
    stage = "write reports";
    await writeReports(result, outputDirectory);
    await writeFile(statusPath, JSON.stringify({ status: "complete", startedAt, endedAt: result.summary.endedAt, readiness: result.summary.readiness.status }) + "\n", { mode: 0o600 });
    console.log(summaryText(result.summary));
    console.log(`Reports: ${outputDirectory}`);
    return ["blocked", "review-required"].includes(result.summary.readiness.status) ? 2 : 0;
  } catch (error) {
    const diagnostics = failureDiagnostics(error, stage);
    await writeFile(statusPath, JSON.stringify({ status: "failed", startedAt, endedAt: new Date().toISOString(), scanPass, ...diagnostics }) + "\n", { mode: 0o600 });
    console.error(`Audit failed/incomplete at ${stage}. ${diagnostics.reason} Reports: ${outputDirectory}. Raw driver messages are withheld to protect connection details.`);
    return 1;
  } finally {
    if (client) await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error instanceof AuditError ? error.message : "Audit could not start or finish. Check arguments (--help), required MONGODB_URI/MONGODB_DB and local output permissions. No readiness report is valid.");
    process.exitCode = 1;
  });
}
