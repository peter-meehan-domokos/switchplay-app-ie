export class CreatorRequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
export async function creatorRequest<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, signal: AbortSignal.timeout(15000), cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new CreatorRequestError(response.status, result.code ?? result.error ?? "REQUEST_FAILED");
  return result;
}
export type CreatorTransport = <T>(url: string, method?: string, body?: unknown) => Promise<T>;
