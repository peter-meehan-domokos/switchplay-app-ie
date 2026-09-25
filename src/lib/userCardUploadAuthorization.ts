import type { AuthUser } from "@/lib/auth";
import { getDeckTemplateById, getVisibleDeckTemplateByIdForUser } from "@/lib/deckTemplateQueries";

type UserCardUploadAuthorizationResult =
  | { ok: true }
  | { ok: false; error: string; status: 400 | 403 | 404 };

export async function authorizeUserCardUpload(
  user: AuthUser,
  deckTemplateId: string,
  cardId: string,
): Promise<UserCardUploadAuthorizationResult> {
  const templateById = await getDeckTemplateById(deckTemplateId);

  if (!templateById) {
    return { ok: false, error: "Invalid deckTemplateId.", status: 400 };
  }

  const template = await getVisibleDeckTemplateByIdForUser(user, deckTemplateId);

  if (!template) {
    return { ok: false, error: "You do not have access to this deck template.", status: 403 };
  }

  const deckData = user.decksData.find((deck) => deck.deckTemplateId === deckTemplateId);

  if (!deckData) {
    return { ok: false, error: "Deck data has not been initialized.", status: 404 };
  }

  if (!template.cards.some((card) => card.cardId === cardId)) {
    return { ok: false, error: "cardId is not part of this deck template.", status: 400 };
  }

  if (!deckData.cards.some((card) => card.cardId === cardId)) {
    return { ok: false, error: "cardId is not part of this initialized deck data.", status: 400 };
  }

  return { ok: true };
}
