import { recordImageAllocation } from "@/lib/cards/instructionalImageOwnership";
import { authorizeProspectiveUpload, signProspectiveAttachment } from "@/lib/cards/prospectiveUpload";
import { fields } from "@/lib/cards/http";
import { creatorRequestBoundary } from "@/lib/cards/http";
import { authorizeUpload } from "@/lib/cards/uploadAuthorization";
import { requireCondition } from "@/lib/cards/domain";
import { isSupportedImageUploadContentType } from "@/lib/imageUploadContentTypes";
import { instructionalImageUpload, personalImageUpload } from "@/lib/cards/mediaProviders";
export async function POST(request: Request) {
  return creatorRequestBoundary(request, async (repo, actor) => {
    const body = await request.json();
    if (body.prospective !== undefined) {
      fields(body, ["scope", "deckTemplateId", "cardTemplateId", "contentType", "prospective"]);
      const prospective = await authorizeProspectiveUpload(repo, actor, body.prospective);
      requireCondition(isSupportedImageUploadContentType(body.contentType), "INVALID_IMAGE_CONTENT_TYPE");
      const destination = { scope: prospective.kind, targetId: prospective.targetId };
      const upload = await instructionalImageUpload({ creator: actor, contentType: body.contentType, ...destination });
      await recordImageAllocation(repo.db, actor, destination, upload);
      return { ...upload, attachmentProof: await signProspectiveAttachment(actor, prospective, upload.assetId, "cloudflare-r2", upload.deliveryUrl) };
    }
    const target = await authorizeUpload(repo, actor, body, ["contentType"]);
    requireCondition(isSupportedImageUploadContentType(body.contentType), "INVALID_IMAGE_CONTENT_TYPE");
    if (target.scope === "user-card") return personalImageUpload({ creator: actor,
      contentType: body.contentType, deckTemplateId: target.deckTemplateId, cardId: target.cardTemplateId, cardTemplateId: target.cardTemplateId });
    const destination = target.scope === "card-template" ? { scope: "card" as const, targetId: target.cardTemplateId }
      : { scope: "deck" as const, targetId: target.deckTemplateId };
    const upload = await instructionalImageUpload({ creator: actor, contentType: body.contentType, ...destination });
    await recordImageAllocation(repo.db, actor, destination, upload);
    return upload;
  });
}
