import { getCurrentUser } from "../auth";
import { CardRepository } from "./repository";
import { CardArchitectureError, requireCondition, isRecord } from "./domain";
import { LibraryPreviewConflict } from "./libraryEntry";
import { UpdateReviewConflict } from "./updateAdoption";
import { AssessmentConflict } from "../assessments/contracts";

export async function cardRequest(run: (repo: CardRepository, actor: string) => Promise<unknown>) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const result = await run(await CardRepository.application(), user.id);
    return Response.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AssessmentConflict) return Response.json({ error: error.code, code: error.code,
      refreshRequired: true, latestList: error.latestList }, { status: 409 });
    if (error instanceof UpdateReviewConflict) return Response.json({ error: error.code, code: error.code,
      refreshRequired: true, latestReview: error.latestReview }, { status: 409 });
    if (error instanceof LibraryPreviewConflict) return Response.json({ error: error.code, code: error.code,
      refreshRequired: true, latestManifest: error.latestManifest }, { status: 409 });
    if (error instanceof CardArchitectureError) return Response.json({ error: error.code, code: error.code }, {
      status: error.code.includes("FORBIDDEN") || error.code.includes("CONTEXT") ? 403 : error.code.includes("REVISION") || error.code.includes("CONFLICT") ? 409 : 400,
    });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400 });
    console.error("Private Card request failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Request failed. Retry or reload before continuing." }, { status: 500 });
  }
}
// The command itself binds writes to the actor who reviewed it. Reads also
// accept the initiating actor so a delayed request cannot return another account's state.
export async function personalUpdateRequest(request: Request, run: (repo: CardRepository, actor: string) => Promise<unknown>) {
  let authenticatedActor: string | undefined;
  const response = await cardRequest((repo, actor) => {
    const expectedActor = request.headers.get("X-Personal-Viewer");
    requireCondition(expectedActor === null || expectedActor === actor, "UPDATE_SESSION_CONFLICT");
    authenticatedActor = actor;
    return run(repo, actor);
  });
  if (authenticatedActor) response.headers.set("X-Personal-Viewer", authenticatedActor);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
export function fields(body: unknown, allowed: string[]): asserts body is Record<string, unknown> {
  requireCondition(isRecord(body) && Object.keys(body).every((field) => allowed.includes(field)), "INVALID_REQUEST_FIELDS");
}
export function jsonDTO<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

// Creator commands use the initiating actor, not whichever cookie happens to be
// present when a queued request eventually leaves the browser.
export async function creatorRequestBoundary(request: Request, run: (repo: CardRepository, actor: string) => Promise<unknown>) {
  const response = await cardRequest((repo, actor) => {
    const expected = request.headers.get("X-Creator-Actor");
    requireCondition(expected === null || expected === actor, "CREATOR_SESSION_CONFLICT");
    return run(repo, actor);
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
