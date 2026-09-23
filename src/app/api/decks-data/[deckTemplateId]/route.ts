import { ObjectId } from "mongodb";
import type { UserDocument } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { getDeckTemplateById, getVisibleDeckTemplateByIdForUser } from "@/lib/deckTemplateQueries";
import { createR2UserDataPublicObjectUrl } from "@/lib/cloudflareR2";
import { getCollection } from "@/lib/mongodb";
import { IMPLICIT_SIGNAL_IDS, SIGNAL_MAX, SIGNAL_MIN } from "@/lib/signals";
import { validateUserCardMediaItem } from "@/lib/userCardMedia";

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

    const hasTypeField = hasOwnProperty(bodyRecord, "type");
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
    // - type: "record-open"
    // - type: "update-card-reflection" + cardId + reflection
    // - type: "upsert-card-media" + cardId + mediaItem
    // - type: "remove-card-media" + cardId + mediaItemId
    //
    // New mutations (reflections, media, chats, etc.) must be added carefully to
    // avoid ambiguous request bodies and silent routing to the wrong branch.

    if (hasTypeField) {
      if (
        bodyRecord.type !== "record-open" &&
        bodyRecord.type !== "update-card-reflection" &&
        bodyRecord.type !== "upsert-card-media" &&
        bodyRecord.type !== "remove-card-media"
      ) {
        return Response.json({ error: "Unknown mutation type." }, { status: 400 });
      }

      const allowedMutationFields =
        bodyRecord.type === "record-open"
          ? new Set(["type"])
          : bodyRecord.type === "update-card-reflection"
            ? new Set(["type", "cardId", "reflection"])
            : bodyRecord.type === "upsert-card-media"
              ? new Set(["type", "cardId", "mediaItem"])
              : new Set(["type", "cardId", "mediaItemId"]);
      const hasUnexpectedField = Object.keys(bodyRecord).some((key) => !allowedMutationFields.has(key));

      if (hasUnexpectedField) {
        return Response.json({ error: "Request body must contain only one mutation shape." }, { status: 400 });
      }
    }

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
    const sharedWithUserIds = existingDeckData.sharedWithUserIds ?? [];

    if (bodyRecord.type === "record-open") {
      const openedAt = now.toISOString();
      const updateResult = await users.updateOne(
        {
          _id: userObjectId,
          "decksData.deckTemplateId": deckTemplateId,
        },
        {
          $set: {
            "decksData.$.openedAt": openedAt,
          },
        },
      );

      if (updateResult.matchedCount === 0) {
        return Response.json({ error: "Deck data has not been initialized." }, { status: 404 });
      }

      if (!updateResult.acknowledged) {
        return Response.json({ error: "Failed Mongo update for deck opening." }, { status: 500 });
      }

      return Response.json({
        ok: true,
        deckTemplateId,
        openedAt,
      });
    }

    if (bodyRecord.type === "update-card-reflection") {
      const cardIdRaw = bodyRecord.cardId;
      const reflectionRaw = bodyRecord.reflection;

      if (!hasNonEmptyString(cardIdRaw)) {
        return Response.json({ error: "cardId is required." }, { status: 400 });
      }

      if (!hasOwnProperty(bodyRecord, "reflection")) {
        return Response.json({ error: "reflection is required." }, { status: 400 });
      }

      if (typeof reflectionRaw !== "string" && reflectionRaw !== null) {
        return Response.json({ error: "reflection must be a string or null." }, { status: 400 });
      }

      const cardId = cardIdRaw.trim();
      const reflection = reflectionRaw === null ? "" : reflectionRaw.trim();
      const templateCard = template.cards.find((card) => card.cardId === cardId);

      if (!templateCard) {
        return Response.json({ error: "cardId is not part of this deck template." }, { status: 400 });
      }

      const existingCardData = existingDeckData.cards.find((card) => card.cardId === cardId);

      if (!existingCardData) {
        return Response.json({ error: "Failed Mongo update for card reflection." }, { status: 500 });
      }

      const updateResult = await users.updateOne(
        {
          _id: userObjectId,
          "decksData.deckTemplateId": deckTemplateId,
        },
        {
          $set: {
            "decksData.$[deck].cards.$[card].reflection": reflection,
            "decksData.$[deck].sharedWithUserIds": sharedWithUserIds,
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
        return Response.json({ error: "Failed Mongo update for card reflection." }, { status: 500 });
      }

      if (updateResult.modifiedCount === 0 && existingCardData.reflection !== reflection) {
        return Response.json({ error: "Failed Mongo update for card reflection." }, { status: 500 });
      }

      return Response.json({
        ok: true,
        deckTemplateId,
        cardId,
        reflection,
      });
    }

    if (bodyRecord.type === "upsert-card-media" || bodyRecord.type === "remove-card-media") {
      const cardIdRaw = bodyRecord.cardId;

      if (!hasNonEmptyString(cardIdRaw)) {
        return Response.json({ error: "cardId is required." }, { status: 400 });
      }

      const cardId = cardIdRaw.trim();
      const templateCard = template.cards.find((card) => card.cardId === cardId);

      if (!templateCard) {
        return Response.json({ error: "cardId is not part of this deck template." }, { status: 400 });
      }

      const existingCardData = existingDeckData.cards.find((card) => card.cardId === cardId);

      if (!existingCardData) {
        return Response.json({ error: "cardId is not part of this initialized deck data." }, { status: 400 });
      }

      let retainedMediaCondition: Record<string, unknown>;
      let appendedMediaItems: Record<string, unknown> | unknown[] = [];

      if (bodyRecord.type === "upsert-card-media") {
        if (!hasOwnProperty(bodyRecord, "mediaItem")) {
          return Response.json({ error: "mediaItem is required." }, { status: 400 });
        }

        const validation = validateUserCardMediaItem(
          bodyRecord.mediaItem,
          {
            userId: user.id,
            deckTemplateId,
            cardId,
          },
          createR2UserDataPublicObjectUrl,
        );

        if (!validation.ok) {
          return Response.json({ error: validation.error }, { status: 400 });
        }

        retainedMediaCondition = { $ne: ["$$mediaItem.mediaType", validation.mediaItem.mediaType] };
        appendedMediaItems = { $literal: [validation.mediaItem] };
      } else {
        if (!hasNonEmptyString(bodyRecord.mediaItemId)) {
          return Response.json({ error: "mediaItemId is required." }, { status: 400 });
        }

        const mediaItemId = bodyRecord.mediaItemId.trim();

        if (!existingCardData.mediaItems.some((mediaItem) => mediaItem.id === mediaItemId)) {
          return Response.json({ error: "mediaItemId is not part of this card." }, { status: 404 });
        }

        retainedMediaCondition = { $ne: ["$$mediaItem.id", mediaItemId] };
      }

      const updatedDocument = await users.findOneAndUpdate(
        {
          _id: userObjectId,
          decksData: {
            $elemMatch: {
              deckTemplateId,
              cards: { $elemMatch: { cardId } },
            },
          },
        },
        [
          {
            $set: {
              decksData: {
                $map: {
                  input: "$decksData",
                  as: "deck",
                  in: {
                    $cond: [
                      { $eq: ["$$deck.deckTemplateId", deckTemplateId] },
                      {
                        $mergeObjects: [
                          "$$deck",
                          {
                            cards: {
                              $map: {
                                input: "$$deck.cards",
                                as: "card",
                                in: {
                                  $cond: [
                                    { $eq: ["$$card.cardId", cardId] },
                                    {
                                      $mergeObjects: [
                                        "$$card",
                                        {
                                          mediaItems: {
                                            $concatArrays: [
                                              {
                                                $filter: {
                                                  input: { $ifNull: ["$$card.mediaItems", []] },
                                                  as: "mediaItem",
                                                  cond: retainedMediaCondition,
                                                },
                                              },
                                              appendedMediaItems,
                                            ],
                                          },
                                        },
                                      ],
                                    },
                                    "$$card",
                                  ],
                                },
                              },
                            },
                            sharedWithUserIds,
                            updatedAt: now.toISOString(),
                          },
                        ],
                      },
                      "$$deck",
                    ],
                  },
                },
              },
              updatedAt: now,
            },
          },
        ],
        { returnDocument: "after" },
      );

      if (!updatedDocument) {
        return Response.json({ error: "Deck data has not been initialized." }, { status: 404 });
      }

      const updatedDeckData = updatedDocument.decksData.find((deckData) => deckData.deckTemplateId === deckTemplateId);
      const updatedCardData = updatedDeckData?.cards.find((card) => card.cardId === cardId);

      if (!updatedCardData) {
        return Response.json({ error: "Unable to update card media." }, { status: 500 });
      }

      return Response.json({
        ok: true,
        deckTemplateId,
        cardId,
        mediaItems: updatedCardData.mediaItems,
      });
    }

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
            "decksData.$.sharedWithUserIds": sharedWithUserIds,
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
              "decksData.$[deck].sharedWithUserIds": sharedWithUserIds,
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
            "decksData.$[deck].sharedWithUserIds": sharedWithUserIds,
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
            "decksData.$[deck].sharedWithUserIds": sharedWithUserIds,
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
            "decksData.$[deck].sharedWithUserIds": sharedWithUserIds,
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
