import { mediaRequest } from "@/lib/groupExperiences/media/http";
import { query } from "@/lib/groupExperiences/http";
import { readOwnerMediaPage } from "@/lib/mediaCollection/ownerHistory";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mediaRequest(request, false, (repo, actor) => {
    const p = query(request, ["cardTemplateId", "experienceId", "cursor", "limit"]);
    return readOwnerMediaPage(repo.groups.cards, actor, p.get("cardTemplateId") ?? "", { experienceId: p.get("experienceId") ?? undefined,
      cursor: p.get("cursor") ?? undefined, limit: p.has("limit") ? Number(p.get("limit")) : undefined });
  });
}
