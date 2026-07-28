import { ObjectId } from "mongodb";
import type { UserDocument } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb";

const USERS_COLLECTION = "users";
const COMMENT_MAX_LENGTH = 20;

type SharedCommentRouteContext = {
  params: Promise<{
    deckTemplateId: string;
    cardId: string;
  }>;
};

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request, context: SharedCommentRouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!ObjectId.isValid(user.id)) {
      return Response.json({ error: "Invalid authenticated user." }, { status: 401 });
    }

    const { deckTemplateId: rawDeckTemplateId, cardId: rawCardId } = await context.params;
    const deckTemplateId = hasNonEmptyString(rawDeckTemplateId) ? rawDeckTemplateId.trim() : "";
    const cardId = hasNonEmptyString(rawCardId) ? rawCardId.trim() : "";

    if (!deckTemplateId) {
      return Response.json({ error: "deckTemplateId is required." }, { status: 400 });
    }

    if (!cardId) {
      return Response.json({ error: "cardId is required." }, { status: 400 });
    }

    const body = await request.json();

    if (!isPlainObject(body)) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const deckUserIdRaw = body.deckUserId;
    const textRaw = body.text;
    const deckUserId = hasNonEmptyString(deckUserIdRaw) ? deckUserIdRaw.trim() : "";

    if (!deckUserId || !ObjectId.isValid(deckUserId)) {
      return Response.json({ error: "deckUserId is required." }, { status: 400 });
    }

    if (typeof textRaw !== "string") {
      return Response.json({ error: "text is required." }, { status: 400 });
    }

    const text = textRaw.trim();

    if (!text) {
      return Response.json({ error: "Comment text is required." }, { status: 400 });
    }

    if (text.length > COMMENT_MAX_LENGTH) {
      return Response.json({ error: `Comment must be ${COMMENT_MAX_LENGTH} characters or fewer.` }, { status: 400 });
    }

    const viewerHasSharedReference = user.sharedDeckData.some(
      (entry) => entry.deckTemplateId === deckTemplateId && entry.deckUserId === deckUserId,
    );

    if (!viewerHasSharedReference) {
      return Response.json({ error: "This deck is not shared with the current user." }, { status: 403 });
    }

    const users = await getCollection<UserDocument>(USERS_COLLECTION);
    const owner = await users.findOne(
      { _id: new ObjectId(deckUserId) },
      { projection: { decksData: 1 } },
    );

    if (!owner) {
      return Response.json({ error: "Deck owner was not found." }, { status: 404 });
    }

    const ownerDeckData = owner.decksData.find((deckData) => deckData.deckTemplateId === deckTemplateId);

    if (!ownerDeckData) {
      return Response.json({ error: "Deck data was not found for this shared deck." }, { status: 404 });
    }

    if (!ownerDeckData.sharedWithUserIds.includes(user.id)) {
      return Response.json({ error: "This deck is no longer shared with the current user." }, { status: 403 });
    }

    const ownerCard = ownerDeckData.cards.find((card) => card.cardId === cardId);

    if (!ownerCard) {
      return Response.json({ error: "cardId is not part of the shared deck data." }, { status: 404 });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const comment = {
      id: `comment-${new ObjectId().toHexString()}`,
      creatorId: user.id,
      createdAt: nowIso,
      text,
      isRetained: true,
    };
    const chat = {
      id: `chat-${new ObjectId().toHexString()}`,
      comments: [comment],
    };

    const updateResult = await users.updateOne(
      {
        _id: new ObjectId(deckUserId),
        "decksData.deckTemplateId": deckTemplateId,
      },
      {
        $push: {
          "decksData.$[deck].cards.$[card].chats": chat,
        },
        $set: {
          "decksData.$[deck].updatedAt": nowIso,
          updatedAt: now,
        },
      },
      {
        arrayFilters: [{ "deck.deckTemplateId": deckTemplateId }, { "card.cardId": cardId }],
      },
    );

    if (updateResult.matchedCount === 0) {
      return Response.json({ error: "Shared deck data was not found." }, { status: 404 });
    }

    if (!updateResult.acknowledged || updateResult.modifiedCount === 0) {
      return Response.json({ error: "Unable to persist shared comment." }, { status: 500 });
    }

    return Response.json({
      ok: true,
      deckTemplateId,
      deckUserId,
      cardId,
      chat,
      comment,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    console.error("Unable to create shared comment", error);
    return Response.json({ error: "Unable to create shared comment." }, { status: 500 });
  }
}