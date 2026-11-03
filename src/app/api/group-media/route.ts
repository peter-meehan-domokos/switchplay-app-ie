import { mediaRequest } from "@/lib/groupExperiences/media/http";
import { query, pagination } from "@/lib/groupExperiences/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return mediaRequest(request, false, async (repo, actor) => {
    const p = query(request, ["cardTemplateId", "after", "limit"]);
    return repo.ownerFeed(actor, p.get("cardTemplateId") ?? "", pagination(p));
  });
}
