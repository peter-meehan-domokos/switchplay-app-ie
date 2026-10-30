import type { Db } from "mongodb";
import { resolveInteractiveVisual } from "../interactiveVisuals/catalogue";
import { assertVisualMutationOrigin, readVisualJson } from "./api";
import { exactFields, principalKey, recordObject, requireVisual, VisualRecordError } from "./contracts";
import { authenticateVisualGuest, issueVisualGuest, touchVisualGuest, VISUAL_GUEST_DURATION_SECONDS } from "./guestCredentials";

export function createVisualGuestApi(deps: {
  enabled: boolean; expectedOrigin?: string; disabledIds?: readonly string[];
  database: () => Promise<Db>; readCredential: () => Promise<string | undefined>;
  writeCredential: (credential: string, maxAge: number) => Promise<void>;
  consumeIssuanceBudget: () => boolean; consumeSessionBudget?: (learner: string) => boolean;
  consumeRequestBudget?: () => boolean;
}) {
  return async (request: Request) => {
    const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
    try {
      if (!deps.enabled) return Response.json({ code: "VISUAL_FEATURE_DISABLED" }, { status: 404, headers });
      assertVisualMutationOrigin(request, deps.expectedOrigin);
      const body = await readVisualJson(request, 4096);
      requireVisual(recordObject(body) && exactFields(body, ["activityId"]) && typeof body.activityId === "string", "INVALID_VISUAL_GUEST_SESSION");
      requireVisual(resolveInteractiveVisual(body.activityId, { disabledIds: deps.disabledIds }), "VISUAL_UNAVAILABLE");
      if (deps.consumeRequestBudget && !deps.consumeRequestBudget()) return Response.json({ code: "VISUAL_RATE_LIMIT" }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
      const credential = await deps.readCredential();
      if (!credential && !deps.consumeIssuanceBudget()) return Response.json({ code: "VISUAL_RATE_LIMIT" }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
      const db = await deps.database();
      if (credential) {
        const actor = await authenticateVisualGuest(db, credential);
        if (!actor) {
          await deps.writeCredential("", 0);
          return Response.json({ code: "VISUAL_GUEST_SESSION_EXPIRED" }, { status: 401, headers });
        }
        const learner = principalKey(actor);
        if (deps.consumeSessionBudget && !deps.consumeSessionBudget(learner)) return Response.json({ code: "VISUAL_RATE_LIMIT" }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
        await touchVisualGuest(db, actor); await deps.writeCredential(credential, VISUAL_GUEST_DURATION_SECONDS);
        return Response.json({ learner }, { headers });
      }
      const created = await issueVisualGuest(db);
      await deps.writeCredential(created.credential, VISUAL_GUEST_DURATION_SECONDS);
      // The opaque principal is a routing handle, never a credential. The secret
      // is present only in the HttpOnly cookie and is never returned as JSON.
      return Response.json({ learner: principalKey(created.principal) }, { headers });
    } catch (error) {
      const code = error instanceof VisualRecordError ? error.code : error instanceof SyntaxError || error instanceof TypeError ? "INVALID_VISUAL_JSON" : "VISUAL_REQUEST_FAILED";
      const status = code.includes("FORBIDDEN") ? 403 : code.includes("LIMIT") ? 413 : code === "VISUAL_UNAVAILABLE" ? 404 : code === "VISUAL_REQUEST_FAILED" || code.includes("SETUP_REQUIRED") ? 503 : 400;
      return Response.json({ code }, { status, headers });
    }
  };
}
