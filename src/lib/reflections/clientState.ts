import { reflectionSlotKey, type CollectiveReflectionSource, type ReflectionSource } from "./model";
import type { ReflectionFeed } from "./reads";

// A submitted edit changes only its original slot. The server acknowledgement
// supplies its persisted revision/row identity; no history fetch is needed.
export function patchReflectionFeed(feed: ReflectionFeed, source: ReflectionSource | CollectiveReflectionSource, text: string,
  ack?: { revision: number; reflectionId?: string | null }): ReflectionFeed {
  if (source.cardTemplateId !== feed.cardTemplateId) throw Error("Invalid reflection source.");
  if (source.kind === "group-card") {
    if (!feed.collective || feed.collective.source.experienceId !== source.experienceId) throw Error("Invalid collective reflection source.");
    return { ...feed, collective: { ...feed.collective, text, revision: ack?.revision ?? feed.collective.revision } };
  }
  const key = reflectionSlotKey({ source, authorUserId: feed.viewerUserId });
  if (!feed.items.some(item => reflectionSlotKey(item.entry) === key)) throw Error("Invalid reflection source.");
  return { ...feed, items: feed.items.map(item => reflectionSlotKey(item.entry) !== key ? item : { ...item,
    empty: !text.trim(), canDelete: !!text.trim(), entry: { ...item.entry, text, revision: ack?.revision ?? item.entry.revision,
      source: source.kind === "group" && ack?.reflectionId !== undefined ? { ...source, reflectionId: ack.reflectionId } : item.entry.source } }) };
}
