import { ObjectId } from "mongodb";
import type { UserDocument } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb";
import { deckTemplates } from "@/mocks/deckTemplates";
import { getVisibleDeckTemplatesForUser } from "@/mocks/templateAccess";

type CompletionStatus = "todo" | "inProgress" | "done" | "skipped";

const USERS_COLLECTION = "users";
const completionStatusValues: CompletionStatus[] = ["todo", "inProgress", "done", "skipped"];
const isoDateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

type DeckDataRouteContext = {
  params: Promise<{
    deckTemplateId: string;
  }>;
};

function isCompletionStatus(value: unknown): value is CompletionStatus {
  return typeof value === "string" && completionStatusValues.includes(value as CompletionStatus);
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOwnProperty(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDateOnlyString(value: unknown): value is string {
  if (!hasNonEmptyString(value)) {
    return false;
  }

  const trimmedValue = value.trim();

  if (!isoDateOnlyRegex.test(trimmedValue)) {
    return false;
  }

  const [yearRaw, monthRaw, dayRaw] = trimmedValue.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const candidateDate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidateDate.getUTCFullYear() === year &&
    candidateDate.getUTCMonth() === month - 1 &&
    candidateDate.getUTCDate() === day
  );
}

export async function PATCH(request: Request, context: DeckDataRouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!ObjectId.isValid(user.id)) {
      return Response.json({ error: "Invalid authenticated user." }, { status: 401 });
    }

    const { deckTemplateId: rawDeckTemplateId } = await context.params;
    const deckTemplateId = typeof rawDeckTemplateId === "string" ? rawDeckTemplateId.trim() : "";

    if (!deckTemplateId) {
      return Response.json({ error: "deckTemplateId is required." }, { status: 400 });
    }

    const body = await request.json();
    if (!isPlainObject(body)) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }
    const bodyRecord = body as Record<string, unknown>;

    const hasActiveCardField = hasOwnProperty(bodyRecord, "activeCardId");
    const hasCardIdField = hasOwnProperty(bodyRecord, "cardId");
    const hasItemIdField = hasOwnProperty(bodyRecord, "itemId");
    const hasCompletionStatusField = hasOwnProperty(bodyRecord, "completionStatus");
    const hasTargetDateField = hasOwnProperty(bodyRecord, "targetDate");
    const hasCardMutationFields = hasCardIdField || hasItemIdField || hasCompletionStatusField || hasTargetDateField;
    const hasCompletionStatusMutation = hasItemIdField || hasCompletionStatusField;
    const hasTargetDateMutation = hasTargetDateField || (hasCardIdField && !hasCompletionStatusMutation);

    if (hasActiveCardField && hasCardMutationFields) {
      return Response.json({ error: "Request body must contain only one mutation shape." }, { status: 400 });
    }

    if (hasTargetDateMutation && hasCompletionStatusMutation && hasTargetDateField) {
      return Response.json({ error: "Request body must contain only one mutation shape." }, { status: 400 });
    }

    const hasActiveCardMutation = hasNonEmptyString(bodyRecord.activeCardId);

    if (hasActiveCardField && !hasActiveCardMutation) {
      return Response.json({ error: "activeCardId is required." }, { status: 400 });
    }

    const templateById = deckTemplates.find((deckTemplate) => deckTemplate.deckTemplateId === deckTemplateId);

    if (!templateById) {
      return Response.json({ error: "Invalid deckTemplateId." }, { status: 400 });
    }

    const visibleDeckTemplates = getVisibleDeckTemplatesForUser(user.username, deckTemplates);
    const template = visibleDeckTemplates.find((deckTemplate) => deckTemplate.deckTemplateId === deckTemplateId);

    if (!template) {
      return Response.json({ error: "You do not have access to this deck template." }, { status: 403 });
    }

    const existingDeckData = user.decksData.find((deckData) => deckData.deckTemplateId === deckTemplateId);

    if (!existingDeckData) {
      return Response.json({ error: "Deck data has not been initialized." }, { status: 404 });
    }

    const users = await getCollection<UserDocument>(USERS_COLLECTION);
    const userObjectId = new ObjectId(user.id);
    const now = new Date();

    if (hasActiveCardMutation) {
      const activeCardIdRaw = bodyRecord.activeCardId;

      if (!hasNonEmptyString(activeCardIdRaw)) {
        return Response.json({ error: "activeCardId is required." }, { status: 400 });
      }

      const activeCardId = activeCardIdRaw.trim();

      const templateHasCard = template.cards.some((card) => card.cardId === activeCardId);

      if (!templateHasCard) {
        return Response.json({ error: "activeCardId does not belong to this deck template." }, { status: 400 });
      }

      const updateResult = await users.updateOne(
        {
          _id: userObjectId,
          "decksData.deckTemplateId": deckTemplateId,
        },
        {
          $set: {
            "decksData.$.activeCardId": activeCardId,
            "decksData.$.updatedAt": now.toISOString(),
            updatedAt: now,
          },
        },
      );

      if (updateResult.matchedCount === 0) {
        return Response.json({ error: "Deck data has not been initialized." }, { status: 404 });
      }

      return Response.json({
        success: true,
        deckTemplateId,
        activeCardId,
      });
    }

    if (hasTargetDateMutation) {
      const cardIdRaw = bodyRecord.cardId;
      const targetDateRaw = bodyRecord.targetDate;

      if (!hasNonEmptyString(cardIdRaw)) {
        return Response.json({ error: "cardId is required." }, { status: 400 });
      }

      if (!hasNonEmptyString(targetDateRaw)) {
        return Response.json({ error: "targetDate is required." }, { status: 400 });
      }

      const cardId = cardIdRaw.trim();
      const targetDate = targetDateRaw.trim();
      const templateCard = template.cards.find((card) => card.cardId === cardId);

      if (!templateCard) {
        return Response.json({ error: "cardId is not part of this deck template." }, { status: 400 });
      }

      if (!isIsoDateOnlyString(targetDate)) {
        return Response.json({ error: "targetDate must be an ISO date string in YYYY-MM-DD format." }, { status: 400 });
      }

      const existingCardData = existingDeckData.cards.find((card) => card.cardId === cardId);

      if (!existingCardData) {
        return Response.json({ error: "Failed Mongo update for targetDate." }, { status: 500 });
      }

      const updateResult = await users.updateOne(
        {
          _id: userObjectId,
          "decksData.deckTemplateId": deckTemplateId,
        },
        {
          $set: {
            "decksData.$[deck].cards.$[card].targetDate": targetDate,
            "decksData.$[deck].updatedAt": now.toISOString(),
            updatedAt: now,
          },
        },
        {
          arrayFilters: [{ "deck.deckTemplateId": deckTemplateId }, { "card.cardId": cardId }],
        },
      );

      if (updateResult.matchedCount === 0) {
        return Response.json({ error: "Deck data has not been initialized." }, { status: 404 });
      }

      if (!updateResult.acknowledged) {
        return Response.json({ error: "Failed Mongo update for targetDate." }, { status: 500 });
      }

      if (updateResult.modifiedCount === 0 && existingCardData.targetDate !== targetDate) {
        return Response.json({ error: "Failed Mongo update for targetDate." }, { status: 500 });
      }

      return Response.json({
        ok: true,
        deckTemplateId,
        cardId,
        targetDate,
      });
    }

    if (hasCompletionStatusMutation) {
      const cardIdRaw = bodyRecord.cardId;
      const itemIdRaw = bodyRecord.itemId;
      const completionStatusRaw = bodyRecord.completionStatus;

      if (!hasNonEmptyString(cardIdRaw)) {
        return Response.json({ error: "cardId is required." }, { status: 400 });
      }

      if (!hasNonEmptyString(itemIdRaw)) {
        return Response.json({ error: "itemId is required." }, { status: 400 });
      }

      if (!isCompletionStatus(completionStatusRaw)) {
        return Response.json({ error: "completionStatus must be one of todo, inProgress, done, or skipped." }, { status: 400 });
      }

      const cardId = cardIdRaw.trim();
      const itemId = itemIdRaw.trim();
      const completionStatus = completionStatusRaw;
      const templateCard = template.cards.find((card) => card.cardId === cardId);

      if (!templateCard) {
        return Response.json({ error: "cardId is not part of this deck template." }, { status: 400 });
      }

      const templateCardHasItem = templateCard.items.some((item) => item.itemId === itemId);

      if (!templateCardHasItem) {
        return Response.json({ error: "itemId is not part of that card." }, { status: 400 });
      }

      const updateResult = await users.updateOne(
        {
          _id: userObjectId,
          "decksData.deckTemplateId": deckTemplateId,
        },
        {
          $set: {
            "decksData.$[deck].cards.$[card].items.$[item].completionStatus": completionStatus,
            "decksData.$[deck].updatedAt": now.toISOString(),
            updatedAt: now,
          },
        },
        {
          arrayFilters: [
            { "deck.deckTemplateId": deckTemplateId },
            { "card.cardId": cardId },
            { "item.itemId": itemId },
          ],
        },
      );

      if (updateResult.matchedCount === 0) {
        return Response.json({ error: "Deck data has not been initialized." }, { status: 404 });
      }

      return Response.json({
        success: true,
        deckTemplateId,
        cardId,
        itemId,
        completionStatus,
      });
    }

    return Response.json({ error: "Request body must contain either activeCardId, cardId/targetDate, or cardId/itemId/completionStatus." }, { status: 400 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    console.error("Unable to update deck data", error);
    return Response.json({ error: "Unable to update deck data." }, { status: 500 });
  }
}