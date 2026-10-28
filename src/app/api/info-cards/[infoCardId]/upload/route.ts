import { fields } from "@/lib/cards/http";
import { infoRequest } from "@/lib/infoCards/http";
import { createInfoUpload } from "@/lib/infoCards/media";
export async function POST(request: Request, context: { params: Promise<{ infoCardId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["kind", "contentType"]);
    return createInfoUpload(repo, actor, (await context.params).infoCardId, body.kind as "image" | "video", body.contentType as string | undefined);
  });
}
