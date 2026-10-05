import { cardRequest } from "@/lib/cards/http";
import { authorizeUpload } from "@/lib/cards/uploadAuthorization";
import { requireCondition } from "@/lib/cards/domain";
import { isCloudflareStreamVideoMediaItem } from "@/lib/media";
import { videoStatus } from "@/lib/cards/mediaProviders";
export async function GET(request: Request) {
  return cardRequest(async (repo, actor) => {
    const body = Object.fromEntries(new URL(request.url).searchParams);
    const target = await authorizeUpload(repo, actor, body, ["assetId"]);
    requireCondition(target.media.some((item) => isCloudflareStreamVideoMediaItem(item) && item.assetId === body.assetId), "MEDIA_OUTSIDE_CONTEXT");
    return videoStatus(body.assetId);
  });
}
