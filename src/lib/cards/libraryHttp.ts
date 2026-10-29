import type { CardRepository } from "./repository";
import { cardRequest } from "./http";
import { requireCondition } from "./domain";

// Both contracts require authentication. Viewer status must never be share-cached;
// canonical reads are also no-store until a deliberate Library caching policy exists.
export async function libraryRequest(run: (repo: CardRepository, actor: string) => Promise<unknown>, request?: Request) {
  const response = await cardRequest((repo, actor) => {
    // Bind a UI mutation to the session that initiated it. A cookie changed
    // between the browser's auth check and POST must not act for a new account.
    const expectedViewer = request?.headers.get("X-Library-Viewer");
    requireCondition(expectedViewer === undefined || expectedViewer === null || expectedViewer === actor, "LIBRARY_SESSION_CONFLICT");
    return run(repo, actor);
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
export function libraryQuery(request: Request, allowed: string[]) {
  const query = new URL(request.url).searchParams;
  requireCondition([...query.keys()].every((key) => allowed.includes(key)), "INVALID_LIBRARY_QUERY");
  return query;
}
