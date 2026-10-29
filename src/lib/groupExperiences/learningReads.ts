import { ObjectId, type ClientSession } from "mongodb";
import type { CardRepository } from "../cards/repository";
import type { CardTemplateVersion } from "../cards/model";
import { projectPersonalLearning, type LearningFields } from "../cards/learning";
import { requireCondition } from "../cards/domain";
import { id } from "./contracts";

export function userKey(value: string) {
  id(value);
  if (!/^[a-f\d]{24}$/i.test(value)) return value;
  requireCondition(value === value.toLowerCase(), "INVALID_GROUP_USER_ID");
  return new ObjectId(value);
}
export type LearningProjection = ReturnType<typeof projectPersonalLearning>;
type SelectedUser = { _id: ObjectId | string; cardsData: (LearningFields & { cardTemplateId: string })[] };

// Foreign reads never load full CardData. Batches bound query inputs; the DTO
// contains neither personal adoption pointers nor any private content/timestamps.
export async function personalLearningForUsers(repo: CardRepository, userIds: string[], cards: CardTemplateVersion[], session: ClientSession) {
  const output = new Map<string, LearningProjection[]>(userIds.map(userId => [userId, []]));
  for (let u = 0; u < userIds.length; u += 100) {
    const users = userIds.slice(u, u + 100);
    for (let c = 0; c < cards.length; c += 100) {
      const batch = cards.slice(c, c + 100), ids = batch.map(card => card.cardTemplateId);
      const selected = await repo.users().aggregate<SelectedUser>([
        { $match: { _id: { $in: users.map(userKey) } } },
        { $project: { _id: 1, cardsData: { $map: {
          input: { $filter: { input: "$cardsData", as: "card", cond: { $in: ["$$card.cardTemplateId", { $literal: ids }] } } },
          as: "card", in: { cardTemplateId: "$$card.cardTemplateId",
            items: { $map: { input: "$$card.items", as: "step", in: { stepId: "$$step.stepId", completionStatus: "$$step.completionStatus" } } },
            signalReadings: { $map: { input: "$$card.signalReadings", as: "signal", in: { stepId: "$$signal.stepId", reading: "$$signal.reading" } } },
          },
        } } } },
      ], { session }).toArray();
      const missing: string[] = [];
      for (const userId of users) {
        const user = selected.find(user => String(user._id) === userId);
        requireCondition(user && Array.isArray(user.cardsData), "INVALID_GROUP_PERSONAL_DATA");
        if (batch.some(card => !user.cardsData.some(data => data.cardTemplateId === card.cardTemplateId))) missing.push(userId);
      }
      // Missing ordinary personal rows are corruption, not group defaults. Resolve
      // only required Card IDs in Mongo; no private Deck data leaves this query.
      const required = missing.length ? await repo.users().aggregate<{ _id: ObjectId | string; valid: boolean; requiredCards: string[] }>([
        { $match: { _id: { $in: missing.map(userKey) } } },
        { $lookup: { from: "deckTemplateVersions", let: { memberships: { $map: { input: "$decksData", as: "deck",
          in: { deckTemplateId: "$$deck.deckTemplateId", version: "$$deck.deckTemplateVersion" } } } }, pipeline: [
          { $match: { $expr: { $in: [{ deckTemplateId: "$deckTemplateId", version: "$version" }, "$$memberships"] } } },
          { $project: { _id: 0, "content.cards.cardTemplateId": 1 } },
        ], as: "requiredDecks" } },
        { $project: { _id: 1, valid: { $eq: [{ $size: "$decksData" }, { $size: "$requiredDecks" }] }, requiredCards: {
          $reduce: { input: "$requiredDecks", initialValue: [], in: { $concatArrays: ["$$value", "$$this.content.cards.cardTemplateId"] } },
        } } },
      ], { session }).toArray() : [];
      for (const userId of users) {
        const user = selected.find(user => String(user._id) === userId)!;
        const ordinary = required.find(row => String(row._id) === userId);
        if (ordinary) requireCondition(ordinary.valid && Array.isArray(ordinary.requiredCards), "INVALID_GROUP_PERSONAL_DATA");
        for (const card of batch) output.get(userId)!.push(projectPersonalLearning(card.cardTemplateId, card.version, card.content,
          user.cardsData, !ordinary?.requiredCards.includes(card.cardTemplateId)));
      }
    }
  }
  return output;
}
