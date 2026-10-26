export class CreatorRequestError extends Error {
  constructor(readonly status: number, readonly code: string, readonly details?: Record<string, unknown>) { super(code); }
}
export async function creatorRequest<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, signal: AbortSignal.timeout(15000), cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new CreatorRequestError(response.status, result.code ?? result.error ?? "REQUEST_FAILED", result);
  return result;
}
export type CreatorTransport = (<T>(url: string, method?: string, body?: unknown) => Promise<T>) & { allowDetachedCard?: (id: string) => void };

export function actorCreatorTransport(actor: string, live: (url: string, method: string, body?: unknown) => boolean = () => true, allowDetachedCard?: (id: string) => void): CreatorTransport {
  const transport: CreatorTransport = async <T>(url: string, method = "GET", body?: unknown): Promise<T> => {
    if (!live(url, method, body)) throw new CreatorRequestError(409, "CREATOR_SESSION_CONFLICT");
    const current = await creatorRequest<{ user: { id: string } | null }>("/api/auth/me");
    if (current.user?.id !== actor || !live(url, method, body)) throw new CreatorRequestError(409, "CREATOR_SESSION_CONFLICT");
    const response = await fetch(url, { method, signal: AbortSignal.timeout(method === "POST" && /^\/api\/info-cards\/[^/]+\/publish$/.test(url) ? 45000 : 15000), cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Creator-Actor": actor }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    if (!response.ok) throw new CreatorRequestError(response.status, result.code ?? result.error ?? "REQUEST_FAILED", result);
    const after = await creatorRequest<{ user: { id: string } | null }>("/api/auth/me");
    if (after.user?.id !== actor || !live(url, method, body)) throw new CreatorRequestError(409, "CREATOR_SESSION_CONFLICT");
    return result as T;
  };
  transport.allowDetachedCard = allowDetachedCard;
  return transport;
}

export class CreatorActorLifetime {
  private active = true;
  private detachedCards = new Set<string>();
  setActive(value: boolean) { this.active = value; }
  allowDetachedCard(id: string) { this.detachedCards.add(`/api/card-templates/${encodeURIComponent(id)}`); }
  isActive(url?: string, method?: string, body?: unknown) {
    return this.active || !!url && this.detachedCards.has(url) && (method === "GET" || method === "PATCH" &&
      typeof body === "object" && body !== null && "type" in body && body.type === "save");
  }
}
