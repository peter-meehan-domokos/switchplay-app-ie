import { ObjectId } from "mongodb";
import type { UserDocument } from "@/lib/auth";
import type { DeckTemplate, UserDeckData } from "@/components/decks/types";
import { getCurrentUser } from "@/lib/auth";
import { getVisibleDeckTemplateByIdForUser } from "@/lib/deckTemplateQueries";
import { getCollection } from "@/lib/mongodb";
import { DEFAULT_SIGNAL_READING, IMPLICIT_SIGNAL_IDS } from "@/lib/signals";

const USERS_COLLECTION = "users";

function createServerUserDeckDataFromTemplate(template: DeckTemplate): UserDeckData {
  const timestamp = new Date().toISOString();

  return {
    deckTemplateId: template.deckTemplateId,
    activeCardId: template.cards[0]?.cardId ?? "",
    cards: template.cards.map((card) => ({
      cardId: card.cardId,
      targetDate: card.suggestedTargetDate,
      items: card.steps.map((step) => ({
        itemId: step.stepId,
        completionStatus: "todo",
      })),
      signalReadings: IMPLICIT_SIGNAL_IDS.map((signalId) => ({
        signalId,
        reading: DEFAULT_SIGNAL_READING,
      })),
      reflection: "",
      mediaItems: [],
      chats: [],
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
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
    const deckTemplateId = typeof body.deckTemplateId === "string" ? body.deckTemplateId.trim() : "";

    if (!deckTemplateId) {
      return Response.json({ error: "deckTemplateId is required." }, { status: 400 });
    }

    const template = await getVisibleDeckTemplateByIdForUser(user, deckTemplateId);

    if (!template) {
      return Response.json({ error: "Deck template not found." }, { status: 404 });
    }

    const existingDeckData = user.decksData.find((deckData) => deckData.deckTemplateId === deckTemplateId);

    if (existingDeckData) {
      return Response.json({ created: false, deckData: existingDeckData });
    }

    const users = await getCollection<UserDocument>(USERS_COLLECTION);
    const userObjectId = new ObjectId(user.id);
    const deckDataToCreate = createServerUserDeckDataFromTemplate(template);

    const updateResult = await users.updateOne(
      {
        _id: userObjectId,
        "decksData.deckTemplateId": { $ne: deckTemplateId },
      },
      {
        $push: { decksData: deckDataToCreate },
        $set: { updatedAt: new Date() },
      },
    );

    if (updateResult.modifiedCount === 1) {
      return Response.json({ created: true, deckData: deckDataToCreate });
    }

    const refreshedUser = await users.findOne(
      { _id: userObjectId },
      { projection: { decksData: 1 } },
    );
    const existingAfterRace = refreshedUser?.decksData.find((deckData) => deckData.deckTemplateId === deckTemplateId);

    if (existingAfterRace) {
      return Response.json({ created: false, deckData: existingAfterRace });
    }

    return Response.json({ error: "Unable to initialize deck data." }, { status: 500 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    console.error("Unable to initialize decks data", error);
    return Response.json({ error: "Unable to initialize deck data." }, { status: 500 });
  }
}
