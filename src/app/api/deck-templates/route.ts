import { MongoServerError, ObjectId } from "mongodb";
import {
  DECK_TEMPLATES_COLLECTION,
  type DeckTemplateDocument,
} from "@/lib/deckTemplateDocuments";
import { getCurrentUser } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb";
import { validateDeckTemplateForSave } from "@/app/api/deck-templates/_lib/templateSaveValidation";

function createDeckTemplateResponse(document: DeckTemplateDocument) {
  return {
    deckTemplateId: document.deckTemplateId,
    ownerUserId: document.ownerUserId,
    visibility: document.visibility,
    template: document.template,
    savedTemplate: document.savedTemplate,
    savedAt: document.savedAt,
    publishedAt: document.publishedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function isDuplicateKeyError(error: unknown) {
  return error instanceof MongoServerError && error.code === 11000;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!ObjectId.isValid(user.id)) {
      return Response.json({ error: "Invalid authenticated user." }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateDeckTemplateForSave(body);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const { template } = validation;
    const deckTemplateId = template.deckTemplateId.trim();
    const collection = await getCollection<DeckTemplateDocument>(DECK_TEMPLATES_COLLECTION);
    const existingTemplate = await collection.findOne(
      { deckTemplateId },
      { projection: { deckTemplateId: 1 } },
    );

    if (existingTemplate) {
      return Response.json({ error: "Deck template already exists." }, { status: 409 });
    }

    const now = new Date();
    const publishedTemplate = {
      ...template,
      deckTemplateId,
    };
    const documentToInsert: DeckTemplateDocument = {
      deckTemplateId,
      ownerUserId: user.id,
      visibility: "private",
      template: publishedTemplate,
      savedTemplate: publishedTemplate,
      savedAt: now,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(documentToInsert);

    return Response.json({
      created: true,
      deckTemplate: createDeckTemplateResponse(documentToInsert),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (isDuplicateKeyError(error)) {
      return Response.json({ error: "Deck template already exists." }, { status: 409 });
    }

    console.error("Unable to create deck template", error);
    return Response.json({ error: "Unable to create deck template." }, { status: 500 });
  }
}
