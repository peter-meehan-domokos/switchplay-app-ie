import { isRecord, nonblank, requireCondition } from "../cards/domain";

export type AssessmentProvenance = {
  enteredByUserId: string | null; entryMethod: "manual" | "import" | "automated" | null;
  groupExperienceId: string | null; deckTemplateId: string | null;
};
export type AssessmentOrigin = { kind: "personal" | "group" | "other-group" | "unknown"; label: string };
export type AssessmentEntryContext = { groupExperienceId: string | null; deckTemplateId: string | null };
const identity = (value: unknown) => value === null || nonblank(value) && value.trim() === value && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);

export function readAssessmentProvenance(value: unknown): AssessmentProvenance | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 4 || !identity(value.enteredByUserId)
    || !identity(value.groupExperienceId) || !identity(value.deckTemplateId)
    || ![null, "manual", "import", "automated"].includes(value.entryMethod as AssessmentProvenance["entryMethod"])) return undefined;
  return { enteredByUserId: value.enteredByUserId as string | null, entryMethod: value.entryMethod as AssessmentProvenance["entryMethod"],
    groupExperienceId: value.groupExperienceId as string | null, deckTemplateId: value.deckTemplateId as string | null };
}
export function manualAssessmentProvenance(actor: string, context: AssessmentEntryContext): AssessmentProvenance {
  requireCondition(nonblank(actor) && identity(actor) && identity(context.groupExperienceId) && identity(context.deckTemplateId), "INVALID_ASSESSMENT_ENTRY_CONTEXT");
  return { enteredByUserId: actor, entryMethod: "manual", ...context };
}
export function sameAssessmentEntry(a: AssessmentProvenance, b: AssessmentProvenance) {
  return a.enteredByUserId === b.enteredByUserId && a.entryMethod === b.entryMethod
    && a.groupExperienceId === b.groupExperienceId && a.deckTemplateId === b.deckTemplateId;
}
// The caller supplies only server-authorised names. Unknown historical origin
// must not become Personal or be inferred from concurrent Group memberships.
export function assessmentOrigin(value: unknown, authorisedNames: ReadonlyMap<string, string> = new Map()): AssessmentOrigin {
  const provenance = readAssessmentProvenance(value);
  if (!provenance) return { kind: "unknown", label: "Unknown" };
  if (provenance.groupExperienceId === null) return { kind: "personal", label: "Personal" };
  const name = authorisedNames.get(provenance.groupExperienceId);
  return nonblank(name) ? { kind: "group", label: name } : { kind: "other-group", label: "Other group" };
}
// Assessment provenance only: other fields still require the scoped assessment
// allowlist. Do not spread raw origin IDs into a future foreign history DTO.
export function projectAssessmentOrigin<T extends { provenance?: AssessmentProvenance }>(result: T, names: ReadonlyMap<string, string> = new Map()) {
  const { provenance, ...fields } = result;
  return { ...fields, origin: assessmentOrigin(provenance, names) };
}
