import { cardRequest, fields } from "@/lib/cards/http";
import { authorizeUpload } from "@/lib/cards/uploadAuthorization";
import { nonblank, requireCondition } from "@/lib/cards/domain";
import { isCloudflareStreamVideoMediaItem } from "@/lib/media";
import { videoStatus } from "@/lib/cards/mediaProviders";
export async function GET(request: Request) {
  return cardRequest(async (repo, actor) => {
    const body = Object.fromEntries(new URL(request.url).searchParams);
    // Status is a read of the viewer's existing personal upload, not permission
    // to upload into a Card. Inherited items may outlive active Deck membership.
    let media;
    if (body.scope === "user-card") {
      fields(body, ["scope", "deckTemplateId", "cardTemplateId", "assetId"]);
      requireCondition(nonblank(body.cardTemplateId) && nonblank(body.deckTemplateId) && nonblank(body.assetId), "INVALID_ENTITY_ID");
      media = await repo.personalMedia(actor, body.cardTemplateId);
    } else {
      media = (await authorizeUpload(repo, actor, body, ["assetId"])).media;
    }
    requireCondition(media.some((item) => isCloudflareStreamVideoMediaItem(item) && item.assetId === body.assetId), "MEDIA_OUTSIDE_CONTEXT");
    return videoStatus(body.assetId);
  });
}
