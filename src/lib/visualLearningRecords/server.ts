import { getCurrentUser } from "../auth";
import { getDatabase, getMongoClient } from "../mongodb";
import { CardRepository } from "../cards/repository";
import { createVisualApi } from "./api";
import { VisualLearningRecordRepository } from "./repository";
import { authorizeVisualSource } from "./sourceAccess";
import { createVisualRequestBudget } from "./requestBudget";

const consumeBudget = createVisualRequestBudget();

// Independent server gate; neither preview imports nor public metadata enable persistence routes.
export function visualApi() {
  return createVisualApi({ enabled: process.env.SWITCHPLAY_PLUGGED_IN_VISUALS === "1", consumeBudget,
    authenticate: async () => { const user = await getCurrentUser(); return user ? { kind: "account", id: user.id } : null; },
    repository: async () => new VisualLearningRecordRepository(await getDatabase(), await getMongoClient(),
      (process.env.SWITCHPLAY_DISABLED_INTERACTIVE_VISUAL_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean)),
    authorizeSource: async (actor, activityId, source) => authorizeVisualSource(await CardRepository.application("1"), actor, activityId, source),
  });
}
