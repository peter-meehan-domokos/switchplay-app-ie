import type { InfoCardConsultationCard } from "./InfoCardConsultation";

// The three-dot menu of a card in a pouch (checkpoints 4.2b and 4.4, C1 and C2).
//   + New: wherever the viewer may create in the current context; it changes nothing displayed.
//   Edit and Remove or Delete: only on the viewer's own note in its exact creation context.
//     Delete permanently deletes a Group note. Remove, on a standalone Personal Info Card, only detaches it from the
//     Card: the record stays in the database, unreachable, because a Personal Info Card may later be converted into a
//     Creator Info Card. That is why the two labels differ.
//   Hide: a current admin, for any other contribution shared with their Group, their own Follower one included.
//     It only removes the contribution from the Group and never deletes.
//   Origin: the viewer's own note outside its creation context names where it was created; never a disabled
//     Edit or Remove. Creator Info Cards carry no origin.
// Null when the card has no menu at all in this context.
export type InfoCardMenuLayout = { create: boolean; manage: boolean; removeLabel: "Remove" | "Delete" | null; hide: boolean; origin: string | null };
export function buildInfoCardMenuLayout(card: InfoCardConsultationCard | undefined, canCreate = true): InfoCardMenuLayout | null {
  const available = card && !card.unavailable ? card : undefined;
  const manage = Boolean(available?.personal && (available.personalSource || available.groupNote?.editable));
  const hide = !manage && available?.groupNote?.canHide === true;
  const origin = available?.personal && !manage ? available.origin ?? null : null;
  if (!canCreate && !manage && !hide && !origin) return null;
  return { create: canCreate, manage, removeLabel: manage ? (available?.personalSource ? "Remove" : "Delete") : null, hide, origin };
}
