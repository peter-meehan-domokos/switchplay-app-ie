import { authorizeProspectiveUpload, signProspectiveAttachment } from "@/lib/cards/prospectiveUpload";
import { fields } from "@/lib/cards/http";
import { creatorRequestBoundary } from "@/lib/cards/http";
import { authorizeUpload } from "@/lib/cards/uploadAuthorization";
import { requireCondition } from "@/lib/cards/domain";
import { videoUpload } from "@/lib/cards/mediaProviders";
export async function POST(request: Request) {
  return creatorRequestBoundary(request, async (repo, actor) => {
    const body = await request.json();
    if (body.prospective !== undefined) {
      fields(body, ["scope", "deckTemplateId", "cardTemplateId", "originalFilename", "prospective"]);
      const prospective = await authorizeProspectiveUpload(repo, actor, body.prospective);
      requireCondition(typeof body.originalFilename === "string" && body.originalFilename.length <= 120 && body.originalFilename.trim() !== "", "INVALID_FILENAME");
      const upload = await videoUpload({ creator: actor, name: `prospective / ${actor} / ${prospective.targetId} / ${body.originalFilename}` });
      return { ...upload, attachmentProof: await signProspectiveAttachment(actor, prospective, upload.uid, "cloudflare-stream") };
    }
    const target = await authorizeUpload(repo, actor, body, ["originalFilename"]);
    requireCondition(typeof body.originalFilename === "string" && body.originalFilename.trim() !== "" && body.originalFilename.length <= 120, "INVALID_FILENAME");
    return videoUpload({ creator: actor,
      name: `${target.scope} / ${actor} / ${target.cardTemplateId ?? target.deckTemplateId} / ${body.originalFilename}` });
  });
}
