"use client";

import { assertUuid, requireVisual } from "./contracts";

export class VisualGuestSessionError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export function createVisualGuestBootstrap(send: typeof fetch = fetch) {
  let pending: Promise<string> | undefined;
  return (activityId: string): Promise<string> => {
    // One in-flight issuance per browser module, including Strict Mode replay
    // and two simultaneous direct entries. Otherwise responses could install
    // different cookies after a service has bound itself to the other handle.
    if (pending) return pending;
    pending = (async () => {
      const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12000);
      try {
        const response = await send("/api/visual-guests/session", { method: "POST", credentials: "same-origin", cache: "no-store", signal: abort.signal,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activityId }) });
        const body = await response.json();
        if (!response.ok) throw new VisualGuestSessionError(response.status, typeof body.code === "string" ? body.code : "VISUAL_GUEST_SESSION_FAILED");
        requireVisual(typeof body.learner === "string" && body.learner.startsWith("guest:"), "VISUAL_SESSION_CONFLICT");
        assertUuid(body.learner.slice(6)); return body.learner as string;
      } finally { clearTimeout(timer); }
    })().finally(() => { pending = undefined; });
    return pending;
  };
}
export const bootstrapVisualGuest = createVisualGuestBootstrap();
