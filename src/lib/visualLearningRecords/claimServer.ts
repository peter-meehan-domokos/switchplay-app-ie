import { getCurrentUser } from "../auth";
import { getDatabase, getMongoClient } from "../mongodb";
import { createVisualClaimApi } from "./claimApi";
import { VisualGuestClaims } from "./guestClaims";
import { readVisualGuestCookie, writeVisualGuestCookie } from "./guestServer";
import { VisualLearningRecordRepository } from "./repository";
import { createVisualRequestBudget } from "./requestBudget";

const consumeBudget = createVisualRequestBudget(() => Date.now(), 20);
export function visualClaimApi() {
  return createVisualClaimApi({ expectedOrigin: process.env.SWITCHPLAY_APP_ORIGIN, consumeBudget,
    authenticateAccount: async () => { const user = await getCurrentUser(); return user ? { kind: "account", id: user.id } : null; },
    readCredential: readVisualGuestCookie,
    retireCredential: () => writeVisualGuestCookie("", 0),
    claims: async () => new VisualGuestClaims(new VisualLearningRecordRepository(await getDatabase(), await getMongoClient())),
  });
}
