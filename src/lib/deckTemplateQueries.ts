import type { Filter } from "mongodb";
import type { RuntimeDeckTemplate } from "@/components/decks/types";
import type { AuthUser } from "@/lib/auth";
import {
  DECK_TEMPLATES_COLLECTION,
  type DeckTemplateDocument,
} from "@/lib/deckTemplateDocuments";
import { normalizeDeckTemplateForRuntime } from "@/lib/deckApiTransforms";
import { getCollection } from "@/lib/mongodb";

type RuntimeDeckTemplatePreviousVersion = Omit<NonNullable<DeckTemplateDocument["previousVersions"]>[number], "template"> & {
  template: RuntimeDeckTemplate;
};

type RuntimeDeckTemplateDocument = Omit<DeckTemplateDocument, "previousVersions" | "savedTemplate" | "template"> & {
  template: RuntimeDeckTemplate;
  savedTemplate?: RuntimeDeckTemplate;
  previousVersions?: RuntimeDeckTemplatePreviousVersion[];
};

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

function normalizeDeckTemplateDocumentForRuntime(document: DeckTemplateDocument): RuntimeDeckTemplateDocument {
  return {
    ...document,
    template: normalizeDeckTemplateForRuntime(document.template),
    savedTemplate: document.savedTemplate ? normalizeDeckTemplateForRuntime(document.savedTemplate) : undefined,
    previousVersions: document.previousVersions?.map((previousVersion) => ({
      ...previousVersion,
      template: normalizeDeckTemplateForRuntime(previousVersion.template),
    })),
  };
}

export async function getVisibleDeckTemplatesForUser(user: AuthUser): Promise<RuntimeDeckTemplate[]> {
  const documents = await getVisibleDeckTemplateDocumentsForUser(user);

  return documents.map((document) => document.template);
}

export async function getVisibleDeckTemplateDocumentsForUser(user: AuthUser): Promise<RuntimeDeckTemplateDocument[]> {
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
): Promise<RuntimeDeckTemplate | null> {
  const collection = await getDeckTemplatesCollection();
  const document = await collection.findOne(createVisibleTemplateQuery(user, deckTemplateId));

  return document ? normalizeDeckTemplateForRuntime(document.template) : null;
}

export async function getVisibleDeckTemplateDocumentByIdForUser(
  user: AuthUser,
  deckTemplateId: string,
): Promise<RuntimeDeckTemplateDocument | null> {
  const collection = await getDeckTemplatesCollection();

  const document = await collection.findOne(createVisibleTemplateQuery(user, deckTemplateId));

  return document ? normalizeDeckTemplateDocumentForRuntime(document) : null;
}

export async function getDeckTemplateById(deckTemplateId: string): Promise<RuntimeDeckTemplate | null> {
  const collection = await getDeckTemplatesCollection();
  const document = await collection.findOne({ deckTemplateId });

  return document ? normalizeDeckTemplateForRuntime(document.template) : null;
}

export async function assertDeckTemplateVisibleToUser(
  user: AuthUser,
  deckTemplateId: string,
): Promise<RuntimeDeckTemplate> {
  const template = await getVisibleDeckTemplateByIdForUser(user, deckTemplateId);

  if (!template) {
    throw new Error(`Deck template is not visible to user: ${deckTemplateId}`);
  }

  return template;
}
