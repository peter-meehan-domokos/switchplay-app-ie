import { ObjectId } from "mongodb";
import type { Deck } from "@/components/decks/types";
import type { AuthUser, UserDocument } from "@/lib/auth";
import { mergeDeckTemplatesWithUserData } from "@/lib/deckData";
import { normalizeDeckTemplateForRuntime, serverDeckDataItemsToClientDeckDataSteps } from "@/lib/deckApiTransforms";
import {
  DECK_TEMPLATES_COLLECTION,
  type DeckTemplateDocument,
} from "@/lib/deckTemplateDocuments";
import { getCollection } from "@/lib/mongodb";

const USERS_COLLECTION = "users";

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getSharedReferenceKey(deckUserId: string, deckTemplateId: string) {
  return `${deckUserId}:${deckTemplateId}`;
}

export async function getSharedDecksForUser(user: AuthUser): Promise<Deck[]> {
  const uniqueReferences = Array.from(
    new Map(
      user.sharedDeckData
        .filter((entry): entry is { deckTemplateId: string; deckUserId: string } =>
          hasNonEmptyString(entry.deckTemplateId) && hasNonEmptyString(entry.deckUserId)
        )
        .map((entry) => [getSharedReferenceKey(entry.deckUserId.trim(), entry.deckTemplateId.trim()), entry]),
    ).values(),
  );

  if (uniqueReferences.length === 0) {
    return [];
  }

  const validReferences = uniqueReferences.filter(
    (entry) => ObjectId.isValid(entry.deckUserId.trim()) && hasNonEmptyString(entry.deckTemplateId),
  );

  if (validReferences.length === 0) {
    return [];
  }

  const ownerUserIds = [...new Set(validReferences.map((entry) => entry.deckUserId.trim()))];
  const templateIds = [...new Set(validReferences.map((entry) => entry.deckTemplateId.trim()))];
  const usersCollection = await getCollection<UserDocument>(USERS_COLLECTION);
  const templatesCollection = await getCollection<DeckTemplateDocument>(DECK_TEMPLATES_COLLECTION);
  const ownerDocuments = await usersCollection
    .find(
      { _id: { $in: ownerUserIds.map((ownerUserId) => new ObjectId(ownerUserId)) } },
      { projection: { username: 1, decksData: 1 } },
    )
    .toArray();
  const templateDocuments = await templatesCollection
    .find({ deckTemplateId: { $in: templateIds } })
    .toArray();
  const ownerDocumentById = new Map(ownerDocuments.map((document) => [document._id.toHexString(), document]));
  const templateById = new Map(
    templateDocuments.map((document) => [document.deckTemplateId, normalizeDeckTemplateForRuntime(document.template)]),
  );

  return validReferences.flatMap((reference) => {
    const deckUserId = reference.deckUserId.trim();
    const deckTemplateId = reference.deckTemplateId.trim();
    const ownerDocument = ownerDocumentById.get(deckUserId);

    if (!ownerDocument) {
      return [];
    }

    const sharedDeckData = ownerDocument.decksData.find((deckData) => deckData.deckTemplateId === deckTemplateId);

    if (!sharedDeckData || !sharedDeckData.sharedWithUserIds.includes(user.id)) {
      return [];
    }

    const template = templateById.get(deckTemplateId);

    if (!template) {
      return [];
    }

    const sharedClientDeckData = serverDeckDataItemsToClientDeckDataSteps([sharedDeckData])[0];

    if (!sharedClientDeckData) {
      return [];
    }

    const sharedDeckId = getSharedReferenceKey(deckUserId, deckTemplateId);

    return mergeDeckTemplatesWithUserData([template], [sharedClientDeckData], sharedDeckId, {
      canMutate: false,
      currentUserId: user.id,
      ownerUserId: deckUserId,
      ownerUsername: ownerDocument.username || deckUserId,
      showOwnerTag: true,
    });
  });
}