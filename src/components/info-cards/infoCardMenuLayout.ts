import type { InfoCardConsultationCard } from "./InfoCardConsultation";

// The three-dot menu of a card in the viewer's own pouch (checkpoint 4.2b, C1). + New is always offered: it
// creates a new Info Card in the current context and changes nothing displayed. Edit and Remove appear only on
// the viewer's own note in its exact creation context. Outside it, the menu names where the note was created
// instead; never a disabled Edit or Remove. Creator Info Cards carry no origin.
export type InfoCardMenuLayout = { manage: boolean; origin: string | null };
export function buildInfoCardMenuLayout(card: InfoCardConsultationCard | undefined): InfoCardMenuLayout {
  if (!card || card.unavailable || !card.personal) return { manage: false, origin: null };
  const manage = Boolean(card.personalSource || card.groupNote?.editable);
  return { manage, origin: manage ? null : card.origin ?? null };
}
