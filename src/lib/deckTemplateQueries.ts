import type { Filter } from "mongodb";
import type { DeckTemplate } from "@/components/decks/types";
import type { AuthUser } from "@/lib/auth";
import {
  DECK_TEMPLATES_COLLECTION,
  type DeckTemplateDocument,
} from "@/lib/deckTemplateDocuments";
import { normalizeDeckTemplateForRuntime } from "@/lib/deckApiTransforms";
import { getCollection } from "@/lib/mongodb";

function createVisibleTemplateQuery(
  user: AuthUser,
  deckTemplateId?: string,
): Filter<DeckTemplateDocument> {
  return {
    ...(deckTemplateId ? { deckTemplateId } : {}),
    $or: [
      { ownerUserId: user.id },
      //{ visibility: "public" },
    ],
  };
}

async function getDeckTemplatesCollection() {
  return getCollection<DeckTemplateDocument>(DECK_TEMPLATES_COLLECTION);
}

function normalizeDeckTemplateDocumentForRuntime(document: DeckTemplateDocument): DeckTemplateDocument {
  return {
    ...document,
    template: normalizeDeckTemplateForRuntime(document.template),
    savedTemplate: document.savedTemplate ? normalizeDeckTemplateForRuntime(document.savedTemplate) : undefined,
  };
}

export async function getVisibleDeckTemplatesForUser(user: AuthUser): Promise<DeckTemplate[]> {
  const documents = await getVisibleDeckTemplateDocumentsForUser(user);

  return documents.map((document) => document.template);
}

export async function getVisibleDeckTemplateDocumentsForUser(user: AuthUser): Promise<DeckTemplateDocument[]> {
  const collection = await getDeckTemplatesCollection();
  const documents = await collection
    .find(createVisibleTemplateQuery(user))
    .sort({ createdAt: 1, deckTemplateId: 1 })
    .toArray();

  return documents.map(normalizeDeckTemplateDocumentForRuntime);
}

export async function getVisibleDeckTemplateByIdForUser(
  user: AuthUser,
  deckTemplateId: string,
): Promise<DeckTemplate | null> {
  const collection = await getDeckTemplatesCollection();
  const document = await collection.findOne(createVisibleTemplateQuery(user, deckTemplateId));

  return document ? normalizeDeckTemplateForRuntime(document.template) : null;
}

export async function getVisibleDeckTemplateDocumentByIdForUser(
  user: AuthUser,
  deckTemplateId: string,
): Promise<DeckTemplateDocument | null> {
  const collection = await getDeckTemplatesCollection();

  const document = await collection.findOne(createVisibleTemplateQuery(user, deckTemplateId));

  return document ? normalizeDeckTemplateDocumentForRuntime(document) : null;
}

export async function getDeckTemplateById(deckTemplateId: string): Promise<DeckTemplate | null> {
  const collection = await getDeckTemplatesCollection();
  const document = await collection.findOne({ deckTemplateId });

  return document ? normalizeDeckTemplateForRuntime(document.template) : null;
}

export async function assertDeckTemplateVisibleToUser(
  user: AuthUser,
  deckTemplateId: string,
): Promise<DeckTemplate> {
  const template = await getVisibleDeckTemplateByIdForUser(user, deckTemplateId);

  if (!template) {
    throw new Error(`Deck template is not visible to user: ${deckTemplateId}`);
  }

  return template;
}
