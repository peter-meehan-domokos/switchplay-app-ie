import { personalUpdateRequest, fields } from "@/lib/cards/http";
import { workingDTO } from "@/lib/cards/readModels";
import { requireCondition } from "@/lib/cards/domain";
import { validateNewPersonalImage } from "@/lib/cards/media";
import { createR2UserDataPublicObjectUrl } from "@/lib/cloudflareR2";
import { validateUserCardMediaItem } from "@/lib/userCardMedia";
import { isCloudflareR2ImageMediaItem, type MediaItem } from "@/lib/media";
import type { CompletionStatus } from "@/components/decks/types";
export async function GET(request: Request, context: RouteContext<'/api/decks-data/[deckTemplateId]'>) {
  return personalUpdateRequest(request, async (repo, actor) => workingDTO(repo, actor, (await context.params).deckTemplateId));
}
export async function PATCH(request: Request, context: RouteContext<'/api/decks-data/[deckTemplateId]'>) {
  return personalUpdateRequest(request, async (repo, actor) => {
    const { deckTemplateId } = await context.params;
    const body = await request.json();
    fields(body, ["type", "cardTemplateId", "stepId", "completionStatus", "reading", "targetDate", "reflection", "mediaItem", "mediaItemId", "activeCardId", "membershipRevision"]);
    const cardId = body.cardTemplateId as string;
    switch (body.type) {
      case "archive": await repo.archiveDeckData(actor, deckTemplateId); break;
      case "restore": return repo.restoreLibraryDeck(actor, deckTemplateId, body.membershipRevision as number);
      case "active": await repo.setActiveCard(actor, deckTemplateId, body.activeCardId as string); break;
      case "completion": await repo.setCompletion(actor, deckTemplateId, cardId, body.stepId as string, body.completionStatus as CompletionStatus); break;
      case "signal": await repo.setSignalReading(actor, deckTemplateId, cardId, body.stepId as string, body.reading as number | null); break;
      case "target-date": await repo.setTargetDate(actor, deckTemplateId, cardId, body.targetDate as string | null); break;
      case "reflection": await repo.setReflection(actor, deckTemplateId, cardId, body.reflection as string); break;
      case "append-card-media": case "remove-card-media": {
        const mediaItems = await repo.mutateMedia(actor, deckTemplateId, cardId, body.type === "append-card-media" ? { append: body.mediaItem as MediaItem } : { remove: body.mediaItemId as string }, (item) => {
          if (isCloudflareR2ImageMediaItem(item)) return validateNewPersonalImage(item, actor, cardId, createR2UserDataPublicObjectUrl);
          const validation = validateUserCardMediaItem(item, { userId: actor, cardId, deckTemplateId }, createR2UserDataPublicObjectUrl);
          requireCondition(validation.ok, "INVALID_PERSONAL_VIDEO"); return validation.mediaItem;
        });
        return { ok: true, cardId, cardTemplateId: cardId, deckTemplateId, mediaItems };
      }
      default: requireCondition(false, "INVALID_PERSONAL_OPERATION");
    }
    return { ok: true };
  });
}
