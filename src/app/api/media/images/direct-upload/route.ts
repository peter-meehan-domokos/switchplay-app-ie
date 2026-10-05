import { cardRequest } from "@/lib/cards/http";
import { authorizeUpload } from "@/lib/cards/uploadAuthorization";
import { requireCondition } from "@/lib/cards/domain";
import { isSupportedImageUploadContentType } from "@/lib/imageUploadContentTypes";
import { imageUpload, personalImageUpload } from "@/lib/cards/mediaProviders";
export async function POST(request: Request) {
  return cardRequest(async (repo, actor) => {
    const body = await request.json();
    const target = await authorizeUpload(repo, actor, body, ["contentType"]);
    requireCondition(isSupportedImageUploadContentType(body.contentType), "INVALID_IMAGE_CONTENT_TYPE");
    return target.scope === "user-card" ? personalImageUpload({ creator: actor,
      contentType: body.contentType, deckTemplateId: target.deckTemplateId, cardId: target.cardTemplateId, cardTemplateId: target.cardTemplateId }) :
      imageUpload({ creator: actor, contentType: body.contentType, deckTemplateId: target.deckTemplateId });
  });
}
