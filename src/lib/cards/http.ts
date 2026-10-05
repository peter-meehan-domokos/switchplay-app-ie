import { getCurrentUser } from "../auth";
import { CardRepository } from "./repository";
import { CardArchitectureError, requireCondition, isRecord } from "./domain";

export async function cardRequest(run: (repo: CardRepository, actor: string) => Promise<unknown>) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const result = await run(await CardRepository.application(), user.id);
    return Response.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CardArchitectureError) return Response.json({ error: error.code, code: error.code }, {
      status: error.code.includes("FORBIDDEN") || error.code.includes("CONTEXT") ? 403 : error.code.includes("REVISION") || error.code.includes("CONFLICT") ? 409 : 400,
    });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400 });
    console.error("Private Card request failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Request failed. Retry or reload before continuing." }, { status: 500 });
  }
}
export function fields(body: unknown, allowed: string[]): asserts body is Record<string, unknown> {
  requireCondition(isRecord(body) && Object.keys(body).every((field) => allowed.includes(field)), "INVALID_REQUEST_FIELDS");
}
export function jsonDTO<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
