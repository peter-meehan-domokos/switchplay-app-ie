export class GroupRequestError extends Error {
  constructor(readonly code: string, readonly status: number) { super(status === 401 || code === "GROUP_SESSION_CONFLICT"
    ? "Your sign-in changed. Reload My Decks." : "This experience could not be verified. Retry to load current access and learning."); }
}
export async function groupFetch<T>(actor: string, url: string, signal?: AbortSignal, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
    cache: "no-store", headers: { "Content-Type": "application/json", "X-Group-Viewer": actor },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  if (!response.ok) throw new GroupRequestError(value.code ?? value.error ?? "REQUEST_FAILED", response.status);
  if (response.headers.get("X-Group-Viewer") !== actor || value.viewerUserId !== actor) throw new GroupRequestError("GROUP_SESSION_CONFLICT", 409);
  return value as T;
}
