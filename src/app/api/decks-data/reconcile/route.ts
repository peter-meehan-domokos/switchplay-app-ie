import { ObjectId } from "mongodb";
import type { UserDocument } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { reconcileDeckDataWithTemplate } from "@/lib/deckDataReconciliation";
import { getVisibleDeckTemplateByIdForUser } from "@/lib/deckTemplateQueries";
import { getCollection } from "@/lib/mongodb";

const USERS_COLLECTION = "users";

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function persistReconciledDeckData(input: {
  userId: string;
  newDeckTemplateId: string;
  reconciledDeckData: UserDocument["decksData"][number];
}) {
  const users = await getCollection<UserDocument>(USERS_COLLECTION);
  const userObjectId = new ObjectId(input.userId);
  const now = new Date();
  const reconciledDeckData = {
    ...input.reconciledDeckData,
    updatedAt: now.toISOString(),
  };

  const existingNewDeckDataUpdate = await users.updateOne(
    {
      _id: userObjectId,
      "decksData.deckTemplateId": input.newDeckTemplateId,
    },
    {
      $set: {
        "decksData.$": reconciledDeckData,
        updatedAt: now,
      },
    },
  );

  if (existingNewDeckDataUpdate.matchedCount === 1) {
    return { created: false, deckData: reconciledDeckData };
  }

  const pushResult = await users.updateOne(
    {
      _id: userObjectId,
      "decksData.deckTemplateId": { $ne: input.newDeckTemplateId },
    },
    {
      $push: { decksData: reconciledDeckData },
      $set: { updatedAt: now },
    },
  );

  if (pushResult.modifiedCount === 1) {
    return { created: true, deckData: reconciledDeckData };
  }

  const refreshedUser = await users.findOne(
    { _id: userObjectId },
    { projection: { decksData: 1 } },
  );
  const existingAfterRace = refreshedUser?.decksData.find((deckData) => deckData.deckTemplateId === input.newDeckTemplateId);

  if (existingAfterRace) {
    return { created: false, deckData: existingAfterRace };
  }

  return null;
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

    if (!isPlainObject(body)) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const oldDeckTemplateId = hasNonEmptyString(body.oldDeckTemplateId) ? body.oldDeckTemplateId.trim() : "";
    const newDeckTemplateId = hasNonEmptyString(body.newDeckTemplateId) ? body.newDeckTemplateId.trim() : "";

    if (!oldDeckTemplateId) {
      return Response.json({ error: "oldDeckTemplateId is required." }, { status: 400 });
    }

    if (!newDeckTemplateId) {
      return Response.json({ error: "newDeckTemplateId is required." }, { status: 400 });
    }

    const oldTemplate = await getVisibleDeckTemplateByIdForUser(user, oldDeckTemplateId);

    if (!oldTemplate) {
      return Response.json({ error: "Old deck template not found." }, { status: 404 });
    }

    const newTemplate = await getVisibleDeckTemplateByIdForUser(user, newDeckTemplateId);

    if (!newTemplate) {
      return Response.json({ error: "New deck template not found." }, { status: 404 });
    }

    const existingDeckData = user.decksData.find((deckData) => deckData.deckTemplateId === oldDeckTemplateId);

    if (!existingDeckData) {
      return Response.json({ error: "Deck data not found for old deck template." }, { status: 404 });
    }

    const reconciledDeckData = reconcileDeckDataWithTemplate({
      oldTemplate,
      newTemplate,
      existingDeckData,
      outputDeckTemplateId: newDeckTemplateId,
    });
    const persistenceResult = await persistReconciledDeckData({
      userId: user.id,
      newDeckTemplateId,
      reconciledDeckData,
    });

    if (!persistenceResult) {
      return Response.json({ error: "Unable to persist reconciled deck data." }, { status: 500 });
    }

    return Response.json({
      reconciled: true,
      created: persistenceResult.created,
      deckData: persistenceResult.deckData,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    console.error("Unable to reconcile deck data", error);
    return Response.json({ error: "Unable to reconcile deck data." }, { status: 500 });
  }
}
