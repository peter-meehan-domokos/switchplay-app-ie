import { fields } from "@/lib/cards/http";
import { infoRequest } from "@/lib/infoCards/http";
import { checkInfoMathsRendering } from "@/lib/infoCards/trustedMaths";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ infoCardId: string }> }) {
  return infoRequest(request, async (repo, actor) => {
    const body = await request.json(); fields(body, ["revision"]);
    return repo.checkRendering(actor, (await context.params).infoCardId, body.revision as number,
      checkInfoMathsRendering(process.env.VERCEL === "1" ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin));
  });
}
