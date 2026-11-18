import { assertVisualMutationOrigin, readVisualJson } from "./api";
import { assertUuid, exactFields, principalKey, recordObject, requireVisual, VisualRecordError } from "./contracts";
import type { VisualGuestClaims } from "./guestClaims";
import type { LearnerPrincipal } from "./model";
import { parseVisualGuestCredential } from "./guestCredentials";

export function createVisualClaimApi(deps: {
  expectedOrigin?: string; authenticateAccount: () => Promise<LearnerPrincipal | null>;
  readCredential: () => Promise<string | undefined>; claims: () => Promise<VisualGuestClaims>; consumeBudget?: (learner: string) => boolean;
  retireCredential?: () => Promise<void>;
}) {
  return async (request: Request) => {
    const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, X-Visual-Learner" }; let learner: string | undefined;
    try {
      assertVisualMutationOrigin(request, deps.expectedOrigin);
      const account = await deps.authenticateAccount();
      if (!account || account.kind !== "account") return Response.json({ code: "UNAUTHENTICATED" }, { status: 401, headers });
      learner = principalKey(account); requireVisual(request.headers.get("X-Visual-Learner") === learner, "VISUAL_SESSION_CONFLICT");
      if (deps.consumeBudget && !deps.consumeBudget(learner)) return Response.json({ code: "VISUAL_RATE_LIMIT" }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
      const body = await readVisualJson(request, 4096);
      requireVisual(recordObject(body) && exactFields(body, ["claimId", "foregroundAttemptId"]), "INVALID_VISUAL_CLAIM");
      assertUuid(body.claimId); assertUuid(body.foregroundAttemptId);
      const credential = await deps.readCredential();
      const receipt = await (await deps.claims()).claim(account, credential, { claimId: body.claimId, foregroundAttemptId: body.foregroundAttemptId });
      // Retrying an old account-owned receipt must not erase an unrelated new
      // guest credential. Lost clear-cookie responses remain safely retryable.
      const parsed = parseVisualGuestCredential(credential);
      if (parsed && receipt.guestLearner === `guest:${parsed.guestId}`) await deps.retireCredential?.();
      return Response.json(receipt, { headers: { ...headers, "X-Visual-Learner": learner } });
    } catch (error) {
      const code = error instanceof VisualRecordError ? error.code : error instanceof SyntaxError || error instanceof TypeError ? "INVALID_VISUAL_JSON" : "VISUAL_REQUEST_FAILED";
      const status = code.includes("FORBIDDEN") ? 403 : code.includes("CONFLICT") ? 409 : code.includes("LIMIT") ? 413 : code.includes("SETUP_REQUIRED") || code === "VISUAL_REQUEST_FAILED" ? 503 : 400;
      return Response.json({ code }, { status, headers: { ...headers, ...(learner ? { "X-Visual-Learner": learner } : {}) } });
    }
  };
}
