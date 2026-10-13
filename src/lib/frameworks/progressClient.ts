import { assertFrameworkConfiguration, type Framework } from "./configurationContracts";
import type { frameworkMetadata, readFrameworkSummary } from "./readModels";

export type ProgressMetadata = ReturnType<typeof frameworkMetadata>;
export type ProgressSummary = Awaited<ReturnType<typeof readFrameworkSummary>>["framework"];

async function progressRequest(actor: string, url: string, signal?: AbortSignal) {
  const response = await fetch(url, { headers: { "X-Personal-Viewer": actor }, cache: "no-store", signal });
  if (response.status === 401 || response.status === 409 || response.headers.get("X-Personal-Viewer") !== actor)
    throw new Error("Your sign-in session changed. Reload Progress after signing in.");
  const body = await response.json();
  if (!response.ok) throw new Error("Progress could not be loaded. Please retry.");
  if (body.viewerUserId !== actor) throw new Error("Your sign-in session changed. Reload Progress after signing in.");
  return body;
}
export async function readProgressMetadata(actor: string, signal?: AbortSignal): Promise<ProgressMetadata> {
  const body = await progressRequest(actor, "/api/frameworks", signal);
  if (!Array.isArray(body.frameworks)) throw new Error("Progress configuration is unavailable.");
  try {
    assertFrameworkConfiguration(body.frameworks.map((framework: ProgressMetadata[number]) => ({ ...framework,
      areas: framework.areas.map((area) => ({ ...area, items: area.items.map((item) => ({ ...item, cardTemplateIds: [] })) })) })));
  } catch { throw new Error("Progress configuration is unavailable."); }
  return body.frameworks;
}
export async function readProgressSummary(actor: string, frameworkId: string, signal?: AbortSignal): Promise<ProgressSummary> {
  const body = await progressRequest(actor, `/api/frameworks/${encodeURIComponent(frameworkId)}/summary`, signal);
  const summary = body.framework;
  try {
    if (summary?.id !== frameworkId) throw new Error();
    const structure: Framework = { id: summary.id, title: summary.title, areas: summary.areas.map((area: ProgressSummary["areas"][number]) => ({
      id: area.id, title: area.title, items: area.items.map((item) => ({ id: item.id, title: item.title, cardTemplateIds: [] })),
    })) };
    assertFrameworkConfiguration([structure]);
    for (const area of summary.areas as ProgressSummary["areas"]) {
      if (typeof area.hasConfiguredCards !== "boolean") throw new Error();
      for (const progress of [area.progress, ...area.items.map((item) => item.progress)]) {
        if (!progress || !["complete", "empty", "incomplete"].includes(progress.state)
          || progress.state !== "complete" && (progress.completion !== null || progress.confidence !== null)
          || progress.state === "complete" && (typeof progress.completion !== "number" || !Number.isFinite(progress.completion) || progress.completion < 0 || progress.completion > 100)
          || progress.confidence !== null && (!Number.isInteger(progress.confidence) || progress.confidence < 1 || progress.confidence > 10)) throw new Error();
      }
      for (const item of area.items) {
        if (typeof item.hasConfiguredCards !== "boolean" || !item.assessments || !["complete", "empty", "incomplete"].includes(item.assessments.state)
          || !Array.isArray(item.assessments.latestThree) || item.assessments.latestThree.length > 3
          || item.assessments.state === "incomplete" && item.assessments.latestThree.length) throw new Error();
      }
    }
  } catch { throw new Error("Progress results are unavailable. Please retry."); }
  return summary;
}

export type AreaExpansion = Record<string, boolean>;
const expansionKey = (actor: string, framework: string) => JSON.stringify(["progress-areas", actor, framework]);
export function readAreaExpansion(storage: Pick<Storage, "getItem">, actor: string, framework: string): AreaExpansion {
  try {
    const value = JSON.parse(storage.getItem(expansionKey(actor, framework)) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter(([, expanded]) => typeof expanded === "boolean")) as AreaExpansion : {};
  } catch { return {}; }
}
export function writeAreaExpansion(storage: Pick<Storage, "setItem">, actor: string, framework: string, expansion: AreaExpansion) {
  try { storage.setItem(expansionKey(actor, framework), JSON.stringify(expansion)); } catch { /* Session storage may be disabled. */ }
}
