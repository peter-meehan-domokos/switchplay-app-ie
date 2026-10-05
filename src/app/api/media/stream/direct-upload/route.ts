import { cardRequest } from "@/lib/cards/http";
import { authorizeUpload } from "@/lib/cards/uploadAuthorization";
import { requireCondition } from "@/lib/cards/domain";
import { videoUpload } from "@/lib/cards/mediaProviders";
export async function POST(request: Request) {
  return cardRequest(async (repo, actor) => {
    const body = await request.json();
    const target = await authorizeUpload(repo, actor, body, ["originalFilename"]);
    requireCondition(typeof body.originalFilename === "string" && body.originalFilename.trim() !== "" && body.originalFilename.length <= 120, "INVALID_FILENAME");
    return videoUpload({ creator: actor,
      name: `${target.scope} / ${actor} / ${target.cardTemplateId ?? target.deckTemplateId} / ${body.originalFilename}` });
  });
}
