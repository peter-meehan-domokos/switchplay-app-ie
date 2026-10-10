import { ObjectId, type ClientSession, type Document } from "mongodb";
import type { CardRepository } from "./repository";
import { COLLECTIONS } from "./repository";
import { creatorUsernames as usernames } from "./creatorAttribution";
import { CardArchitectureError, assertAdoption, assertDeckContent, isRecord, nonblank, requireCondition } from "./domain";
import type { CardTemplateRoot, CardTemplateVersion, DeckTemplateRoot, DeckTemplateVersion } from "./model";
import { deckDraftContent } from "./publicationRules";
import { assertCardVersionAccess, assertDeckVersionAccess } from "./versionAccess";
import { creatorSessionDTO } from "./creatorSession";
import { canonicalIntroductionDTO, libraryCardPresentation, libraryDeckPresentation, previewManifest, publicationTimestamp, type LibraryEntry } from "./libraryProjection";

type DeckSelection = Pick<DeckTemplateRoot, "deckTemplateId" | "ownerUserId" | "visibility" | "latestVersion"> & {
  version?: DeckTemplateVersion;
  publicationOrder: Date | null;
};
const deckProjection = { _id: 0, deckTemplateId: 1, ownerUserId: 1, visibility: 1, latestVersion: 1 };
const cardProjection = { _id: 0, cardTemplateId: 1, ownerUserId: 1, visibility: 1, latestVersion: 1, forkedFrom: 1 };
const versionProjection = { _id: 0, deckTemplateId: 1, cardTemplateId: 1, version: 1, visibility: 1, content: 1, publishedAt: 1 };
export const UNAVAILABLE_LIBRARY_CREATOR = "Unknown creator";

function authenticated(actor: string) { requireCondition(nonblank(actor), "LIBRARY_AUTHENTICATION_REQUIRED"); }
function entityIds(ids: string[]) {
  requireCondition(Array.isArray(ids) && ids.length <= 50 && ids.every((id) => nonblank(id) && id.length <= 200), "INVALID_LIBRARY_IDS");
  return [...new Set(ids)];
}
type Cursor = { publishedAt: string | null; deckTemplateId: string };
export function decodeLibraryCursor(value: string): Cursor {
  requireCondition(typeof value === "string" && value.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(value), "INVALID_LIBRARY_CURSOR");
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")); }
  catch { throw new CardArchitectureError("INVALID_LIBRARY_CURSOR"); }
  requireCondition(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed), "INVALID_LIBRARY_CURSOR");
  const cursor = parsed as Record<string, unknown>;
  requireCondition(Object.keys(cursor).length === 3 && cursor.v === 1 && nonblank(cursor.deckTemplateId) && cursor.deckTemplateId.length <= 200
    && (cursor.publishedAt === null || typeof cursor.publishedAt === "string" && publicationTimestamp(new Date(cursor.publishedAt)) === cursor.publishedAt), "INVALID_LIBRARY_CURSOR");
  return { publishedAt: cursor.publishedAt as string | null, deckTemplateId: cursor.deckTemplateId };
}
function encodeCursor(selection: DeckSelection) {
  return Buffer.from(JSON.stringify({ v: 1, publishedAt: publicationTimestamp(selection.publicationOrder), deckTemplateId: selection.deckTemplateId })).toString("base64url");
}

function validateDeckVersion(version: DeckTemplateVersion) {
  requireCondition(isRecord(version.content) && Array.isArray(version.content.cards)
    && version.content.cards.every((ref) => isRecord(ref) && nonblank(ref.cardTemplateId)), "INVALID_CARD_REFERENCES");
  assertAdoption(version.version);
  assertDeckContent(deckDraftContent(version.content));
}


function unavailable(selection: DeckSelection): LibraryEntry {
  return { availability: "unavailable", deckTemplateId: selection.deckTemplateId, title: "Unavailable Deck",
    publishedAt: publicationTimestamp(selection.publicationOrder), reason: "PUBLIC_CONTENT_UNAVAILABLE" };
}

// Bounded batches within a read-only snapshot. No owner bypass and no personal
// record reads: Library selection is identical for every authenticated viewer.
async function projectSelections(repo: CardRepository, selections: DeckSelection[], session: ClientSession): Promise<LibraryEntry[]> {
  const validDecks = new Map<string, DeckTemplateVersion>();
  for (const selection of selections) {
    try {
      const version = selection.version;
      requireCondition(version?.visibility === "public" && publicationTimestamp(version.publishedAt), "INVALID_PUBLIC_VERSION");
      validateDeckVersion(version);
      requireCondition(version.version === selection.latestVersion, "INVALID_PUBLIC_VERSION");
      validDecks.set(selection.deckTemplateId, version);
    } catch (error) { if (!(error instanceof CardArchitectureError)) throw error; }
  }
  const cardIds = [...new Set([...validDecks.values()].flatMap((version) => version.content.cards.map((ref) => ref.cardTemplateId)))];
  const roots = cardIds.length ? await repo.cards().find({ cardTemplateId: { $in: cardIds } }, { session, projection: cardProjection }).toArray() : [];
  const rootsById = new Map(roots.map((root) => [root.cardTemplateId, root]));
  const requests = roots.filter((root) => root.visibility === "public" && Number.isInteger(root.latestVersion) && root.latestVersion >= 1)
    .map((root) => ({ cardTemplateId: root.cardTemplateId, version: root.latestVersion, visibility: "public" as const }));
  const versions = requests.length ? await repo.cardVersions().find({ $or: requests }, { session, projection: versionProjection }).toArray() : [];
  const versionsById = new Map(versions.map((version) => [version.cardTemplateId, version]));
  const sources = [...new Set(roots.flatMap((root) => root.forkedFrom && nonblank(root.forkedFrom.cardTemplateId) ? [root.forkedFrom.cardTemplateId] : []))];
  const sourceRoots = sources.length ? await repo.cards().find({ cardTemplateId: { $in: sources } }, { session, projection: { _id: 0, cardTemplateId: 1, ownerUserId: 1 } }).toArray() : [];
  const sourceOwners = new Map(sourceRoots.map((root) => [root.cardTemplateId, root.ownerUserId]));
  const names = await usernames(repo, [...selections.map((root) => root.ownerUserId), ...roots.map((root) => root.ownerUserId), ...sourceRoots.map((root) => root.ownerUserId)], session);
  return selections.map((selection) => {
    try {
      const version = validDecks.get(selection.deckTemplateId); requireCondition(version, "INVALID_PUBLIC_VERSION");
      const cards = version.content.cards.map((ref, index) => {
        const root = rootsById.get(ref.cardTemplateId), selected = versionsById.get(ref.cardTemplateId);
        requireCondition(root?.visibility === "public" && selected?.visibility === "public" && selected.version === root.latestVersion, "LIBRARY_CARD_FORBIDDEN");
        const sourceOwner = root.forkedFrom ? sourceOwners.get(root.forkedFrom.cardTemplateId) : undefined;
        return libraryCardPresentation(selected, `${version.content.labelPrefix} ${index + 1}`, {
          username: names.get(root.ownerUserId) ?? UNAVAILABLE_LIBRARY_CREATOR,
          immediateSourceUsername: root.forkedFrom ? names.get(sourceOwner ?? "") ?? UNAVAILABLE_LIBRARY_CREATOR : null,
        });
      });
      const deck = libraryDeckPresentation(version, names.get(selection.ownerUserId) ?? UNAVAILABLE_LIBRARY_CREATOR, cards);
      return { availability: "available" as const, deckTemplateId: selection.deckTemplateId,
        publishedAt: publicationTimestamp(version.publishedAt)!, deck, manifest: previewManifest(deck) };
    } catch (error) {
      if (!(error instanceof CardArchitectureError)) throw error;
      // Only malformed/inaccessible canonical data is isolated. Database failures
      // propagate. Diagnostics identify the public Deck, never private contents.
      console.warn("Library public Deck unavailable", selection.deckTemplateId, error.code);
      return unavailable(selection);
    }
  });
}

export async function libraryCollection(repo: CardRepository, actor: string, options: { limit?: number; cursor?: string } = {}) {
  authenticated(actor);
  const limit = options.limit ?? 20;
  requireCondition(Number.isInteger(limit) && limit >= 1 && limit <= 50, "INVALID_LIBRARY_LIMIT");
  const cursor = options.cursor === undefined ? null : decodeLibraryCursor(options.cursor);
  return repo.transaction(async (session) => {
    const pipeline: Document[] = [
      { $match: { visibility: "public", latestVersion: { $gte: 1 } } },
      { $project: deckProjection },
      { $lookup: { from: COLLECTIONS.deckVersions, let: { id: "$deckTemplateId", selected: "$latestVersion" }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$deckTemplateId", "$$id"] }, { $eq: ["$version", "$$selected"] }] } } },
        { $project: versionProjection },
      ], as: "versions" } },
      { $set: { version: { $arrayElemAt: ["$versions", 0] } } },
      { $set: { publicationOrder: { $cond: [{ $and: [{ $eq: ["$version.visibility", "public"] }, { $eq: [{ $type: "$version.publishedAt" }, "date"] }] }, "$version.publishedAt", null] } } },
      { $unset: "versions" },
    ];
    if (cursor) pipeline.push({ $match: cursor.publishedAt === null
      ? { publicationOrder: null, deckTemplateId: { $gt: cursor.deckTemplateId } }
      : { $or: [{ publicationOrder: { $lt: new Date(cursor.publishedAt) } }, { publicationOrder: null },
        { publicationOrder: new Date(cursor.publishedAt), deckTemplateId: { $gt: cursor.deckTemplateId } }] } });
    pipeline.push({ $sort: { publicationOrder: -1, deckTemplateId: 1 } }, { $limit: limit + 1 });
    const selections = await repo.decks().aggregate<DeckSelection>(pipeline, { session }).toArray();
    const page = selections.slice(0, limit);
    return { entries: await projectSelections(repo, page, session), nextCursor: selections.length > limit ? encodeCursor(page[page.length - 1]) : null };
  });
}

export async function libraryDetail(repo: CardRepository, actor: string, deckTemplateId: string): Promise<LibraryEntry> {
  authenticated(actor); entityIds([deckTemplateId]);
  return repo.transaction(async (session) => {
    const root = await repo.decks().findOne({ deckTemplateId, visibility: "public", latestVersion: { $gte: 1 } }, { session, projection: deckProjection });
    requireCondition(root, "LIBRARY_DECK_FORBIDDEN");
    const version = Number.isInteger(root.latestVersion) ? await repo.deckVersions().findOne({ deckTemplateId, version: root.latestVersion }, { session, projection: versionProjection }) : null;
    const publicationOrder = version?.visibility === "public" && publicationTimestamp(version.publishedAt) ? version.publishedAt : null;
    return (await projectSelections(repo, [{ ...root, version: version ?? undefined, publicationOrder }], session))[0];
  });
}

export type LibraryCardDestination = { deckTemplateId: string; title: string; creatorUsername: string; introduction: ReturnType<typeof canonicalIntroductionDTO> };
// Viewer-specific metadata only. No current-state values, events or personal media.
export async function libraryViewerStatus(repo: CardRepository, actor: string, requested: { deckTemplateIds: string[]; cardTemplateIds: string[] }) {
  authenticated(actor);
  const deckIds = entityIds(requested.deckTemplateIds), cardIds = entityIds(requested.cardTemplateIds);
  return repo.transaction(async (session) => {
    // Status never loads learning values or histories, even internally.
    const user = await repo.users().findOne({ _id: /^[a-f\d]{24}$/i.test(actor) ? new ObjectId(actor) : actor }, { session, projection: {
      "decksData.deckTemplateId": 1, "decksData.deckTemplateVersion": 1, "decksData.archivedAt": 1,
      "decksData.membershipRevision": 1,
      "cardsData.cardTemplateId": 1, "cardsData.cardTemplateVersion": 1,
    } });
    requireCondition(user && Array.isArray(user.decksData) && Array.isArray(user.cardsData), "NEW_MODEL_USER_REQUIRED");
    const publicDecks = deckIds.length ? await repo.decks().find({ deckTemplateId: { $in: deckIds }, visibility: "public", latestVersion: { $gte: 1 } }, { session, projection: deckProjection }).toArray() : [];
    const publicCards = cardIds.length ? await repo.cards().find({ cardTemplateId: { $in: cardIds }, visibility: "public", latestVersion: { $gte: 1 } }, { session, projection: cardProjection }).toArray() : [];
    const personalCards = new Map(user.cardsData.map((data) => [data.cardTemplateId, data]));
    const memberships = user.decksData.filter((data) => data.archivedAt === null || deckIds.includes(data.deckTemplateId));
    const roots = memberships.length ? await repo.decks().find({ deckTemplateId: { $in: memberships.map((data) => data.deckTemplateId) } }, { session, projection: deckProjection }).toArray() : [];
    const selections = memberships.filter((data) => Number.isInteger(data.deckTemplateVersion) && data.deckTemplateVersion >= 1)
      .map((data) => ({ deckTemplateId: data.deckTemplateId, version: data.deckTemplateVersion }));
    const versions = selections.length ? await repo.deckVersions().find({ $or: selections }, { session, projection: versionProjection }).toArray() : [];
    const rootById = new Map(roots.map((root) => [root.deckTemplateId, root]));
    const versionById = new Map(versions.map((version) => [version.deckTemplateId, version]));
    const names = await usernames(repo, roots.map((root) => root.ownerUserId), session);
    const destinations = new Map<string, LibraryCardDestination[]>();
    const available = new Set<string>();
    for (const membership of memberships) {
      try {
        const root = rootById.get(membership.deckTemplateId), version = versionById.get(membership.deckTemplateId);
        requireCondition(root && version, "MISSING_DECK_VERSION");
        assertDeckVersionAccess(actor, root as DeckTemplateRoot, version);
        validateDeckVersion(version);
        const introduction = canonicalIntroductionDTO(version.content.introduction);
        available.add(membership.deckTemplateId);
        if (membership.archivedAt !== null) continue;
        for (const card of publicCards) {
          const data = personalCards.get(card.cardTemplateId);
          if (!data || !version.content.cards.some((ref) => ref.cardTemplateId === card.cardTemplateId)) continue;
          // The actual adopted Card must also be accessible; no retained private-era bypass.
          if (!Number.isInteger(data.cardTemplateVersion) || data.cardTemplateVersion < 1) continue;
          const list = destinations.get(card.cardTemplateId) ?? [];
          list.push({ deckTemplateId: root.deckTemplateId, title: version.content.title,
            creatorUsername: names.get(root.ownerUserId) ?? UNAVAILABLE_LIBRARY_CREATOR, introduction });
          destinations.set(card.cardTemplateId, list);
        }
      } catch (error) { if (!(error instanceof CardArchitectureError)) throw error; }
    }
    const adoptedRequests = publicCards.flatMap((card) => {
      const data = personalCards.get(card.cardTemplateId);
      return data && Number.isInteger(data.cardTemplateVersion) && data.cardTemplateVersion >= 1
        ? [{ cardTemplateId: card.cardTemplateId, version: data.cardTemplateVersion }] : [];
    });
    const adopted = adoptedRequests.length ? await repo.cardVersions().find({ $or: adoptedRequests }, { session, projection: { cardTemplateId: 1, version: 1, visibility: 1 } }).toArray() : [];
    // Check only requested Decks (normally the current detail Deck).
    // Reuse the mixed-ownership Creator boundary. No membership or personal writes.
    const editableDecks = new Set<string>();
    for (const root of publicDecks) {
      try {
        await creatorSessionDTO(repo, actor, root.deckTemplateId);
        editableDecks.add(root.deckTemplateId);
      } catch (error) { if (!(error instanceof CardArchitectureError)) throw error; }
    }
    return { viewerUserId: actor,
      decks: publicDecks.map((root) => {
        const data = user.decksData.find((data) => data.deckTemplateId === root.deckTemplateId);
        return { deckTemplateId: root.deckTemplateId, state: !data ? "not-added" as const : data.archivedAt === null ? "active" as const : "archived" as const,
          membershipRevision: data ? data.membershipRevision ?? 0 : null,
          adoptedVersion: data?.deckTemplateVersion ?? null, latestVersion: root.latestVersion,
          updateAvailable: !!data && root.latestVersion > data.deckTemplateVersion,
          canEditInCreator: editableDecks.has(root.deckTemplateId),
          retainedDeckVersionAvailable: !!data && available.has(root.deckTemplateId) };
      }),
      cards: publicCards.map((root) => {
        const data = personalCards.get(root.cardTemplateId), selected = adopted.find((version) => version.cardTemplateId === root.cardTemplateId);
        let canOpen = false;
        if (selected) {
          try { assertCardVersionAccess(actor, root as CardTemplateRoot, selected as CardTemplateVersion); canOpen = true; }
          catch (error) { if (!(error instanceof CardArchitectureError)) throw error; }
        }
        return { cardTemplateId: root.cardTemplateId, hasPersonalData: !!data,
          adoptedVersion: data?.cardTemplateVersion ?? null, latestVersion: root.latestVersion,
          updateAvailable: !!data && root.latestVersion > data.cardTemplateVersion,
          activeDecks: canOpen ? (destinations.get(root.cardTemplateId) ?? []).sort((a, b) => a.title.localeCompare(b.title) || a.deckTemplateId.localeCompare(b.deckTemplateId)) : [] };
      }),
    };
  });
}

export type LibraryCollectionDTO = Awaited<ReturnType<typeof libraryCollection>>;
export type LibraryViewerStatusDTO = Awaited<ReturnType<typeof libraryViewerStatus>>;
