import { ObjectId } from "mongodb";
import type { UserDocument } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { getDeckTemplateById, getVisibleDeckTemplateByIdForUser } from "@/lib/deckTemplateQueries";
import { getCollection } from "@/lib/mongodb";
import { IMPLICIT_SIGNAL_IDS, SIGNAL_MAX, SIGNAL_MIN } from "@/lib/signals";

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
    const hasSignalIdField = hasOwnProperty(bodyRecord, "signalId");
    const hasReadingField = hasOwnProperty(bodyRecord, "reading");
    const hasCompletionStatusMutation = hasItemIdField || hasCompletionStatusField;
    const hasTargetDateMutation = hasTargetDateField;
    const hasSignalReadingMutation = hasSignalIdField || hasReadingField;
    const hasCardMutationFields =
      hasCardIdField || hasItemIdField || hasCompletionStatusField || hasTargetDateField || hasSignalIdField || hasReadingField;

    // IMPORTANT:
    // This route supports multiple PATCH mutation shapes through a single endpoint.
    // Whenever adding a new mutation type, explicitly review mutation-shape
    // discrimination and branch classification.
    //
    // Check:
    // 1. Can the new request shape be misclassified as an existing mutation?
    // 2. Can an existing request shape be misclassified as the new mutation?
    // 3. Are mutation shapes mutually exclusive?
    // 4. Does validation enforce exactly one mutation branch?
    //
    // Examples:
    // - activeCardId
    // - cardId + itemId + completionStatus
    // - cardId + targetDate
    // - cardId + signalId + reading
    //
    // New mutations (reflections, media, chats, etc.) must be added carefully to
    // avoid ambiguous request bodies and silent routing to the wrong branch.

    if (hasActiveCardField && hasCardMutationFields) {
      return Response.json({ error: "Request body must contain only one mutation shape." }, { status: 400 });
    }

    if (hasTargetDateMutation && hasCompletionStatusMutation) {
      return Response.json({ error: "Request body must contain only one mutation shape." }, { status: 400 });
    }

    if (hasSignalReadingMutation && (hasCompletionStatusMutation || hasTargetDateMutation)) {
      return Response.json({ error: "Request body must contain only one mutation shape." }, { status: 400 });
    }

    const hasActiveCardMutation = hasNonEmptyString(bodyRecord.activeCardId);

    if (hasActiveCardField && !hasActiveCardMutation) {
      return Response.json({ error: "activeCardId is required." }, { status: 400 });
    }

    const templateById = await getDeckTemplateById(deckTemplateId);

    if (!templateById) {
      return Response.json({ error: "Invalid deckTemplateId." }, { status: 400 });
    }

    const template = await getVisibleDeckTemplateByIdForUser(user, deckTemplateId);

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

    if (hasSignalReadingMutation) {
      const cardIdRaw = bodyRecord.cardId;
      const signalIdRaw = bodyRecord.signalId;
      const readingRaw = bodyRecord.reading;

      if (!hasNonEmptyString(cardIdRaw)) {
        return Response.json({ error: "cardId is required." }, { status: 400 });
      }

      if (!hasNonEmptyString(signalIdRaw)) {
        return Response.json({ error: "signalId is required." }, { status: 400 });
      }

      if (!hasOwnProperty(bodyRecord, "reading")) {
        return Response.json({ error: "reading is required." }, { status: 400 });
      }

      if (typeof readingRaw !== "number" || !Number.isFinite(readingRaw)) {
        return Response.json({ error: "reading must be a finite number." }, { status: 400 });
      }

      const cardId = cardIdRaw.trim();
      const signalId = signalIdRaw.trim();
      const reading = readingRaw;
      const templateCard = template.cards.find((card) => card.cardId === cardId);

      if (!templateCard) {
        return Response.json({ error: "cardId is not part of this deck template." }, { status: 400 });
      }

      const isImplicitSignalId = IMPLICIT_SIGNAL_IDS.includes(signalId as (typeof IMPLICIT_SIGNAL_IDS)[number]);
      const templateSignal = templateCard.signals?.find((signal) => signal.signalId === signalId);

      if (!isImplicitSignalId && !templateSignal) {
        return Response.json({ error: "signalId is not part of that card." }, { status: 400 });
      }

      if (reading < SIGNAL_MIN || reading > SIGNAL_MAX) {
        return Response.json(
          { error: `reading must be between ${SIGNAL_MIN} and ${SIGNAL_MAX} for this signal.` },
          { status: 400 },
        );
      }

      const existingCardData = existingDeckData.cards.find((card) => card.cardId === cardId);

      if (!existingCardData) {
        return Response.json({ error: "Failed Mongo update for signal reading." }, { status: 500 });
      }

      const existingSignalReading = existingCardData.signalReadings.find((signal) => signal.signalId === signalId);

      if (existingSignalReading) {
        const updateResult = await users.updateOne(
          {
            _id: userObjectId,
            "decksData.deckTemplateId": deckTemplateId,
          },
          {
            $set: {
              "decksData.$[deck].cards.$[card].signalReadings.$[signal].reading": reading,
              "decksData.$[deck].updatedAt": now.toISOString(),
              updatedAt: now,
            },
          },
          {
            arrayFilters: [
              { "deck.deckTemplateId": deckTemplateId },
              { "card.cardId": cardId },
              { "signal.signalId": signalId },
            ],
          },
        );

        if (updateResult.matchedCount === 0) {
          return Response.json({ error: "Deck data has not been initialized." }, { status: 404 });
        }

        if (!updateResult.acknowledged) {
          return Response.json({ error: "Failed Mongo update for signal reading." }, { status: 500 });
        }

        if (updateResult.modifiedCount === 0 && existingSignalReading.reading !== reading) {
          return Response.json({ error: "Failed Mongo update for signal reading." }, { status: 500 });
        }

        return Response.json({
          ok: true,
          deckTemplateId,
          cardId,
          signalId,
          reading,
        });
      }

      const appendResult = await users.updateOne(
        {
          _id: userObjectId,
          decksData: {
            $elemMatch: {
              deckTemplateId,
              cards: {
                $elemMatch: {
                  cardId,
                  signalReadings: {
                    $not: {
                      $elemMatch: { signalId },
                    },
                  },
                },
              },
            },
          },
        },
        {
          $push: {
            "decksData.$[deck].cards.$[card].signalReadings": {
              signalId,
              reading,
            },
          },
          $set: {
            "decksData.$[deck].updatedAt": now.toISOString(),
            updatedAt: now,
          },
        },
        {
          arrayFilters: [{ "deck.deckTemplateId": deckTemplateId }, { "card.cardId": cardId }],
        },
      );

      if (appendResult.matchedCount === 0) {
        return Response.json({ error: "Failed Mongo update for signal reading." }, { status: 500 });
      }

      if (!appendResult.acknowledged || appendResult.modifiedCount === 0) {
        return Response.json({ error: "Failed Mongo update for signal reading." }, { status: 500 });
      }

      return Response.json({
        ok: true,
        deckTemplateId,
        cardId,
        signalId,
        reading,
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

      const templateCardHasItem = templateCard.steps.some((step) => step.stepId === itemId);

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

    return Response.json(
      { error: "Request body must contain either activeCardId, cardId/targetDate, cardId/signalId/reading, or cardId/itemId/completionStatus." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    console.error("Unable to update deck data", error);
    return Response.json({ error: "Unable to update deck data." }, { status: 500 });
  }
}
