import type { WeeklyCard } from "../../components/decks/types";
import type { MediaItem } from "../media";

export type PersonalMediaDisplayItem = MediaItem & {
  sourceCardTemplateId?: string;
  historyReadOnly?: true;
};

// Historical segments never become current upload inputs. Their viewer-owned
// personal media can be deleted at its source record.
export function personalMediaKey(item: MediaItem & { sourceCardTemplateId?: string }) {
  return JSON.stringify([item.sourceCardTemplateId ?? null, item.id]);
}
export function inheritedHistory(card: Pick<WeeklyCard, "id" | "personalHistory">) {
  return card.personalHistory?.filter((segment) => segment.cardTemplateId !== card.id) ?? [];
}
export function visiblePersonalMedia(card: Pick<WeeklyCard, "id" | "personalHistory" | "mediaItems">): PersonalMediaDisplayItem[] {
  return [...card.mediaItems, ...inheritedHistory(card).flatMap((segment) => segment.mediaItems.map((item) => ({ ...item,
    sourceCardTemplateId: segment.cardTemplateId, historyReadOnly: true as const })))];
}
export function contextualPersonalChats(card: Pick<WeeklyCard, "id" | "personalHistory" | "chats">) {
  return [{ cardTemplateId: card.id, chats: card.chats }, ...inheritedHistory(card)]
    .flatMap((segment) => segment.chats.map((chat) => ({ cardTemplateId: segment.cardTemplateId, chat })));
}
