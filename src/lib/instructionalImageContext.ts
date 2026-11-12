export type InstructionalImageContext = Readonly<{
  viewerUserId: string; cardTemplateId: string; version: number; mode: "working" | "canonical";
  deckTemplateId: string; deckVersion: number; stepId: string; attachmentId: string;
}>;
const fields = ["viewerUserId", "cardTemplateId", "version", "mode", "deckTemplateId", "deckVersion", "stepId", "attachmentId"] as const;
export function readInstructionalImageContext(query: URLSearchParams): InstructionalImageContext | null {
  if (query.toString().length > 4096 || [...query.keys()].length !== fields.length || fields.some(key => query.getAll(key).length !== 1)) return null;
  const values = Object.fromEntries(query);
  if (!fields.filter(key => !["version", "deckVersion", "mode"].includes(key)).every(key =>
    values[key].length > 0 && values[key].length <= 200 && values[key].trim() === values[key] && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(values[key]))) return null;
  if (!["working", "canonical"].includes(values.mode) || ![values.version, values.deckVersion].every(value => /^[1-9]\d{0,8}$/.test(value))) return null;
  return { ...values, version: Number(values.version), deckVersion: Number(values.deckVersion) } as InstructionalImageContext;
}
/** The client supplies identity only; no source URL, object key or provider credentials. */
export function instructionalImageUrl(context: InstructionalImageContext): string {
  return `/api/media/instructional-image?${new URLSearchParams(Object.fromEntries(fields.map(key => [key, String(context[key])])))}`;
}
