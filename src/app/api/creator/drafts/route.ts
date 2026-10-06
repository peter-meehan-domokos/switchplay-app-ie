import { cardRequest } from "@/lib/cards/http";
import { creatorDrafts } from "@/lib/cards/creatorDrafts";

export function GET() { return cardRequest((repo, actor) => creatorDrafts(repo, actor)); }
