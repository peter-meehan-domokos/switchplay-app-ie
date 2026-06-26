import { MongoServerError, ObjectId } from "mongodb";
import {
  DECK_TEMPLATES_COLLECTION,
  type DeckTemplateDocument,
} from "@/lib/deckTemplateDocuments";
import { getCurrentUser } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb";
import {
  hasNonEmptyString,
  validateDeckTemplateForSave,
} from "@/app/api/deck-templates/_lib/templateSaveValidation";

type SavedDeckTemplateRouteContext = {
  params: Promise<{
    deckTemplateId: string;
  }>;
};

function createCreatorDeckTemplateId() {
  return `deck-${crypto.randomUUID()}`;
}

function createDeckTemplateResponse(document: DeckTemplateDocument) {
  return {
    deckTemplateId: document.deckTemplateId,
    ownerUserId: document.ownerUserId,
    visibility: document.visibility,
    template: document.template,
    savedTemplate: document.savedTemplate,
    previousVersions: document.previousVersions ?? [],
    savedAt: document.savedAt,
    publishedAt: document.publishedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function isDuplicateKeyError(error: unknown) {
  return error instanceof MongoServerError && error.code === 11000;
}

async function resolveCopyDeckTemplateId(input: {
  collection: Awaited<ReturnType<typeof getCollection<DeckTemplateDocument>>>;
  incomingDeckTemplateId: string;
  sourceDeckTemplateId: string;
}) {
  if (input.incomingDeckTemplateId !== input.sourceDeckTemplateId) {
    return input.incomingDeckTemplateId;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidateDeckTemplateId = createCreatorDeckTemplateId();
    const existingCandidate = await input.collection.findOne(
      { deckTemplateId: candidateDeckTemplateId },
      { projection: { deckTemplateId: 1 } },
    );

    if (!existingCandidate) {
      return candidateDeckTemplateId;
    }
  }

  throw new Error("Unable to allocate deck template id.");
}

export async function PATCH(request: Request, context: SavedDeckTemplateRouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!ObjectId.isValid(user.id)) {
      return Response.json({ error: "Invalid authenticated user." }, { status: 401 });
    }

    const { deckTemplateId: rawDeckTemplateId } = await context.params;
    const deckTemplateId = hasNonEmptyString(rawDeckTemplateId) ? rawDeckTemplateId.trim() : "";

    if (!deckTemplateId) {
      return Response.json({ error: "deckTemplateId is required." }, { status: 400 });
    }

    const body = await request.json();
    const validation = validateDeckTemplateForSave(body);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const { template } = validation;
    const incomingDeckTemplateId = template.deckTemplateId.trim();
    const collection = await getCollection<DeckTemplateDocument>(DECK_TEMPLATES_COLLECTION);
    const existingTemplate = await collection.findOne({ deckTemplateId });

    if (!existingTemplate) {
      return Response.json({ error: "Deck template not found." }, { status: 404 });
    }

    const now = new Date();

    if (existingTemplate.ownerUserId === user.id) {
      if (incomingDeckTemplateId !== deckTemplateId) {
        return Response.json({ error: "template.deckTemplateId must match route deckTemplateId." }, { status: 400 });
      }

      const savedTemplate = {
        ...template,
        deckTemplateId,
      };
      const updateResult = await collection.findOneAndUpdate(
        { deckTemplateId, ownerUserId: user.id },
        {
          $set: {
            savedTemplate,
            savedAt: now,
            updatedAt: now,
          },
        },
        { returnDocument: "after" },
      );

      if (!updateResult) {
        return Response.json({ error: "Deck template not found." }, { status: 404 });
      }

      return Response.json({
        saved: true,
        copied: false,
        deckTemplateId,
        deckTemplate: createDeckTemplateResponse(updateResult),
      });
    }

    if (existingTemplate.visibility !== "public") {
      return Response.json({ error: "You do not have access to save this deck template." }, { status: 403 });
    }

    const copyDeckTemplateId = await resolveCopyDeckTemplateId({
      collection,
      incomingDeckTemplateId,
      sourceDeckTemplateId: deckTemplateId,
    });
    const copyTemplate = {
      ...template,
      deckTemplateId: copyDeckTemplateId,
    };
    const existingCopy = await collection.findOne(
      { deckTemplateId: copyDeckTemplateId },
      { projection: { deckTemplateId: 1 } },
    );

    if (existingCopy) {
      return Response.json({ error: "Deck template already exists." }, { status: 409 });
    }

    const documentToInsert: DeckTemplateDocument = {
      deckTemplateId: copyDeckTemplateId,
      ownerUserId: user.id,
      visibility: "private",
      template: copyTemplate,
      savedTemplate: copyTemplate,
      savedAt: now,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(documentToInsert);

    return Response.json({
      saved: true,
      copied: true,
      deckTemplateId: copyDeckTemplateId,
      sourceDeckTemplateId: deckTemplateId,
      deckTemplate: createDeckTemplateResponse(documentToInsert),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (isDuplicateKeyError(error)) {
      return Response.json({ error: "Deck template already exists." }, { status: 409 });
    }

    console.error("Unable to save deck template draft", error);
    return Response.json({ error: "Unable to save deck template draft." }, { status: 500 });
  }
}
