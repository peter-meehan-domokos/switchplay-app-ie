import type { UpdateReviewResult } from "@/lib/cards/updateAdoption";

export class WorkingRequestError extends Error {
  constructor(readonly code: string, readonly latestReview?: UpdateReviewResult) {
    super(code === "UPDATE_SESSION_CONFLICT" || code === "Unauthorized" ? "Your sign-in changed. Reload My Decks before continuing." : "Unable to complete Update. Retry or cancel; your personal work is retained.");
  }
}
export async function workingRequest<T>(userId: string, url: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  signal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  const response = await fetch(url, { method, cache: "no-store", signal,
    headers: { "Content-Type": "application/json", "X-Personal-Viewer": userId },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await response.json();
  if (!response.ok) throw new WorkingRequestError(payload.code ?? payload.error ?? "REQUEST_FAILED", payload.latestReview);
  if (response.headers.get("X-Personal-Viewer") !== userId || (payload.viewerUserId && payload.viewerUserId !== userId)) throw new WorkingRequestError("UPDATE_SESSION_CONFLICT");
  const authentication = await fetch("/api/auth/me", { cache: "no-store", signal });
  const session = await authentication.json();
  if (!authentication.ok || session.user?.id !== userId) throw new WorkingRequestError("UPDATE_SESSION_CONFLICT");
  return payload;
}
export const updateUrl = (kind: "card" | "deck", id: string) => `/api/${kind === "card" ? "cards" : "decks"}-data/${encodeURIComponent(id)}/update`;
