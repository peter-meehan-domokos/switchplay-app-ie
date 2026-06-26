import { ObjectId } from "mongodb";
import {
  DECK_TEMPLATES_COLLECTION,
  type DeckTemplateDocument,
  type DeckTemplatePreviousVersion,
} from "@/lib/deckTemplateDocuments";
import type { UserDocument } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { reconcileDeckDataWithTemplate } from "@/lib/deckDataReconciliation";
import { getCollection } from "@/lib/mongodb";
import {
  hasNonEmptyString,
  validateDeckTemplateForSave,
} from "@/app/api/deck-templates/_lib/templateSaveValidation";

type PublishDeckTemplateRouteContext = {
  params: Promise<{
    deckTemplateId: string;
  }>;
};

const MAX_PREVIOUS_VERSIONS = 3;
const USERS_COLLECTION = "users";

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

async function reconcileOwnerDeckData(input: {
  userId: string;
  deckTemplateId: string;
  existingDeckData: UserDocument["decksData"][number];
  oldTemplate: DeckTemplateDocument["template"];
  newTemplate: DeckTemplateDocument["template"];
  updatedAt: Date;
}) {
  const users = await getCollection<UserDocument>(USERS_COLLECTION);
  const reconciledDeckData = {
    ...reconcileDeckDataWithTemplate({
      oldTemplate: input.oldTemplate,
      newTemplate: input.newTemplate,
      existingDeckData: input.existingDeckData,
      outputDeckTemplateId: input.deckTemplateId,
    }),
    updatedAt: input.updatedAt.toISOString(),
  };
  const updateResult = await users.updateOne(
    {
      _id: new ObjectId(input.userId),
      "decksData.deckTemplateId": input.deckTemplateId,
    },
    {
      $set: {
        "decksData.$": reconciledDeckData,
        updatedAt: input.updatedAt,
      },
    },
  );

  return updateResult.matchedCount === 1;
}

export async function POST(_request: Request, context: PublishDeckTemplateRouteContext) {
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

    const collection = await getCollection<DeckTemplateDocument>(DECK_TEMPLATES_COLLECTION);
    const existingTemplate = await collection.findOne({ deckTemplateId });

    if (!existingTemplate) {
      return Response.json({ error: "Deck template not found." }, { status: 404 });
    }

    if (existingTemplate.ownerUserId !== user.id) {
      return Response.json({ error: "You do not own this deck template." }, { status: 403 });
    }

    const publishedAt = new Date();
    const publishedTemplate = {
      ...(existingTemplate.savedTemplate ?? existingTemplate.template),
      deckTemplateId,
    };
    const validation = validateDeckTemplateForSave({ template: publishedTemplate });

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const previousVersions: DeckTemplatePreviousVersion[] = [
      {
        template: existingTemplate.template,
        savedAt: publishedAt,
      },
      ...(existingTemplate.previousVersions ?? []),
    ].slice(0, MAX_PREVIOUS_VERSIONS);

    const updateResult = await collection.findOneAndUpdate(
      { deckTemplateId, ownerUserId: user.id },
      {
        $set: {
          template: publishedTemplate,
          savedTemplate: publishedTemplate,
          previousVersions,
          savedAt: publishedAt,
          publishedAt,
          updatedAt: publishedAt,
        },
      },
      { returnDocument: "after" },
    );

    if (!updateResult) {
      return Response.json({ error: "Deck template not found." }, { status: 404 });
    }

    const existingDeckData = user.decksData.find((deckData) => deckData.deckTemplateId === deckTemplateId);
    let deckDataReconciled = false;

    if (existingDeckData) {
      deckDataReconciled = await reconcileOwnerDeckData({
        userId: user.id,
        deckTemplateId,
        existingDeckData,
        oldTemplate: existingTemplate.template,
        newTemplate: publishedTemplate,
        updatedAt: publishedAt,
      });

      if (!deckDataReconciled) {
        return Response.json({ error: "Deck template published, but deck data reconciliation failed." }, { status: 500 });
      }
    }

    return Response.json({
      published: true,
      deckDataReconciled,
      deckTemplate: createDeckTemplateResponse(updateResult),
    });
  } catch (error) {
    console.error("Unable to publish deck template", error);
    return Response.json({ error: "Unable to publish deck template." }, { status: 500 });
  }
}
