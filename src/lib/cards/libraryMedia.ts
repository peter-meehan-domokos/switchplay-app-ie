import type { CardRepository } from "./repository";
import { nonblank, requireCondition } from "./domain";
import { isCloudflareStreamVideoMediaItem } from "../media";
// Public-only even for owners. Authorization proves exact immutable membership
// before contacting Stream; possession of a UID does not confer access.
export async function authorizeLibraryVideo(repo: CardRepository, actor: string, context: {
  kind: "card" | "deck"; templateId: string; version: number; assetId: string;
}) {
  requireCondition(nonblank(actor) && nonblank(context.templateId) && context.templateId.length <= 200 && nonblank(context.assetId) && context.assetId.length <= 200
    && Number.isInteger(context.version) && context.version >= 1, "INVALID_LIBRARY_MEDIA_CONTEXT");
  return repo.transaction(async (session) => {
    if (context.kind === "card") {
      const root = await repo.cards().findOne({ cardTemplateId: context.templateId, visibility: "public", latestVersion: { $gte: context.version } }, { session });
      const version = await repo.cardVersions().findOne({ cardTemplateId: context.templateId, version: context.version, visibility: "public" }, { session });
      requireCondition(root && version, "LIBRARY_MEDIA_FORBIDDEN");
      const media = [version.content.intro.mediaItem, ...version.content.steps.map((step) => step.mediaItem)];
      requireCondition(media.some((item) => isCloudflareStreamVideoMediaItem(item) && item.assetId === context.assetId), "MEDIA_OUTSIDE_CONTEXT");
    } else {
      const root = await repo.decks().findOne({ deckTemplateId: context.templateId, visibility: "public", latestVersion: { $gte: context.version } }, { session });
      const version = await repo.deckVersions().findOne({ deckTemplateId: context.templateId, version: context.version, visibility: "public" }, { session });
      requireCondition(root && version, "LIBRARY_MEDIA_FORBIDDEN");
      const media = version.content.introduction?.video;
      requireCondition(isCloudflareStreamVideoMediaItem(media) && media.assetId === context.assetId, "MEDIA_OUTSIDE_CONTEXT");
    }
  });
}
