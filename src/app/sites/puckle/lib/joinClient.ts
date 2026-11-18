// Browser-side transport for the Join form. Never logs payloads; passwords only travel in the request body.
export type JoinResponse = { status: number; body: Record<string, unknown> | null };
async function post(path: string, payload: unknown): Promise<JoinResponse> {
  try {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
    const body = await response.json().catch(() => null);
    return { status: response.status, body: body && typeof body === "object" ? body as Record<string, unknown> : null };
  } catch { return { status: 0, body: null }; }
}
export type Binding = { challengeId: string; flowToken: string };
export const requestEmailCode = (email: string, binding: Binding | null) =>
  post("/api/auth/email-verification", { action: "request", email, ...(binding ? { binding } : {}) });
export const verifyEmailCode = (binding: Binding, email: string, code: string) =>
  post("/api/auth/email-verification", { action: "verify", ...binding, email, code });
export const submitAccount = (payload: unknown) => post("/api/public/puckle/membership", payload);
export const submitJoinContact = (payload: unknown) => post("/api/public/puckle/join-contact", payload);
export const submitInterest = (payload: unknown) => post("/api/public/puckle/interest", payload);
export const bindingFrom = (body: Record<string, unknown> | null): Binding | null =>
  typeof body?.challengeId === "string" && typeof body.flowToken === "string" ? { challengeId: body.challengeId, flowToken: body.flowToken } : null;
export const currentTimeMs = () => Date.now();
