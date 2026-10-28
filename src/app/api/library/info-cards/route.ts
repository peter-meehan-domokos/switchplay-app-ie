import { infoRequest, infoQuery } from "@/lib/infoCards/http";
import { infoCatalogue } from "@/lib/infoCards/queries";
export async function GET(request: Request) { return infoRequest(request, (repo, actor) => infoCatalogue(repo, actor, infoQuery(request))); }
