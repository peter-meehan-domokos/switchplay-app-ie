import type { MongoClient } from "mongodb";
import type { CardRepository } from "../cards/repository";
import { assertGroupExperienceIndexes } from "./indexes";
import { GROUP_MEDIA_COLLECTION, assertGroupMediaIndexes } from "./media/indexes";
import { assertGroupReflectionIndexes } from "../reflections/indexes";

// Indexes are explicitly provisioned, not request data. Validate once per
// connected client/database/schema, sharing an in-flight check across routes.
// Failed checks are retried; authority and publication reads are never cached.
const checked = new WeakMap<MongoClient, Map<string, Promise<void>>>();
export function ensureGroupReadiness(cards: CardRepository, schema: "core" | "media" | "reflections" = "core") {
  let databases = checked.get(cards.client);
  if (!databases) { databases = new Map(); checked.set(cards.client, databases); }
  const key = JSON.stringify([cards.db.databaseName, schema]), existing = databases.get(key);
  if (existing) return existing;
  const check = schema === "core" ? assertGroupExperienceIndexes : schema === "media" ? assertGroupMediaIndexes : assertGroupReflectionIndexes;
  const pending = check(cards.db).catch(error => { databases.delete(key); throw error; });
  databases.set(key, pending); return pending;
}

// Personal-only installations may not have Group storage yet. Cache a positive
// readiness result, but never a missing collection that could be created later.
export async function groupMediaAvailable(cards: CardRepository) {
  const existing = checked.get(cards.client)?.get(JSON.stringify([cards.db.databaseName, "media"]));
  if (existing) { await existing; return true; }
  if (!await cards.db.listCollections({ name: GROUP_MEDIA_COLLECTION }, { nameOnly: true }).hasNext()) return false;
  await ensureGroupReadiness(cards, "media"); return true;
}
