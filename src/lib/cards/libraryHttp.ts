import type { CardRepository } from "./repository";
import { cardRequest } from "./http";
import { requireCondition } from "./domain";

// Both contracts require authentication. Viewer status must never be share-cached;
// canonical reads are also no-store until a deliberate Library caching policy exists.
export async function libraryRequest(run: (repo: CardRepository, actor: string) => Promise<unknown>) {
  const response = await cardRequest(run);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
export function libraryQuery(request: Request, allowed: string[]) {
  const query = new URL(request.url).searchParams;
  requireCondition([...query.keys()].every((key) => allowed.includes(key)), "INVALID_LIBRARY_QUERY");
  return query;
}
