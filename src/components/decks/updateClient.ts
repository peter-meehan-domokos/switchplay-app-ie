import type { UpdateReviewResult } from "@/lib/cards/updateAdoption";

export class WorkingRequestError extends Error {
  constructor(readonly code: string, readonly latestReview?: UpdateReviewResult) {
    super(code === "UPDATE_SESSION_CONFLICT" || code === "Unauthorized" ? "Your sign-in changed. Reload My Decks before continuing." : "Unable to complete Update. Retry or cancel; your personal work is retained.");
  }
}
async function workingData<T>(userId: string, url: string, method: string, body: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { method, cache: "no-store", signal,
    headers: { "Content-Type": "application/json", "X-Personal-Viewer": userId },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await response.json();
  if (!response.ok) throw new WorkingRequestError(payload.code ?? payload.error ?? "REQUEST_FAILED", payload.latestReview);
  if (response.headers.get("X-Personal-Viewer") !== userId || (payload.viewerUserId && payload.viewerUserId !== userId)) throw new WorkingRequestError("UPDATE_SESSION_CONFLICT");
  return payload;
}
async function checkWorkingActor(userId: string, signal: AbortSignal) {
  const authentication = await fetch("/api/auth/me", { cache: "no-store", signal });
  if ([401, 403].includes(authentication.status)) throw new WorkingRequestError("UPDATE_SESSION_CONFLICT");
  if (!authentication.ok) throw new Error("Your sign-in could not be checked. Retry when connected.");
  const session = await authentication.json();
  if (session.user?.id !== userId) throw new WorkingRequestError("UPDATE_SESSION_CONFLICT");
}
export async function workingRequest<T>(userId: string, url: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  signal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  const payload = await workingData<T>(userId, url, method, body, signal);
  await checkWorkingActor(userId, signal); return payload;
}
// Refreshing one Personal view needs two existing protected reads. Check the
// current cookie once AFTER both responses, never reuse an earlier actor check.
export async function workingReadBatch<T extends unknown[]>(userId: string, urls: { [K in keyof T]: string }, signal?: AbortSignal): Promise<T> {
  signal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  const values = await Promise.all(urls.map(url => workingData(userId, url, "GET", undefined, signal!)));
  await checkWorkingActor(userId, signal); return values as T;
}
export const updateUrl = (kind: "card" | "deck", id: string) => `/api/${kind === "card" ? "cards" : "decks"}-data/${encodeURIComponent(id)}/update`;
