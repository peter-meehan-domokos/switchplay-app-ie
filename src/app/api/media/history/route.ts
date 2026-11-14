import { mediaRequest } from "@/lib/groupExperiences/media/http";
import { query } from "@/lib/groupExperiences/http";
import { readOwnerMediaPage } from "@/lib/mediaCollection/ownerHistory";
import { requireCondition } from "@/lib/cards/domain";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mediaRequest(request, false, (repo, actor) => {
    const p = query(request, ["cardTemplateId", "experienceId", "includeAdminContent", "cursor", "limit"]);
    // Include admin content: only in Me of a Group, and only as "1".
    requireCondition(!p.has("includeAdminContent") || p.has("experienceId") && p.get("includeAdminContent") === "1", "INVALID_MEDIA_PAGE");
    return readOwnerMediaPage(repo.groups.cards, actor, p.get("cardTemplateId") ?? "", { experienceId: p.get("experienceId") ?? undefined,
      ...(p.has("includeAdminContent") ? { includeAdminContent: true } : {}),
      cursor: p.get("cursor") ?? undefined, limit: p.has("limit") ? Number(p.get("limit")) : undefined });
  });
}
