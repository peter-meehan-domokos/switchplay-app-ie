import { MATHS_COURSES, type EnquiryFormValues, type MathsCourse } from "./publicTuitionEnquiry";

/** Pure helpers for the signed-in-student variant of the existing tuition form. */
export type TuitionContext =
  | { mode: "unknown" }
  | { mode: "student-under-18"; studentName: string; mathsCourse: MathsCourse | null }
  | { mode: "student-adult"; name: string; mathsCourse: MathsCourse | null; email: string; phone: string | null };

const text = (value: unknown) => (typeof value === "string" ? value : "");
const course = (value: unknown): MathsCourse | null => ((MATHS_COURSES as readonly unknown[]).includes(value) ? value as MathsCourse : null);
/** Anything unexpected keeps the original selection flow; the backend remains authoritative either way. */
export function parseTuitionContext(value: unknown): TuitionContext {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (data.mode === "student-under-18" && text(data.studentName)) return { mode: "student-under-18", studentName: text(data.studentName), mathsCourse: course(data.mathsCourse) };
  if (data.mode === "student-adult" && text(data.name)) {
    return { mode: "student-adult", name: text(data.name), mathsCourse: course(data.mathsCourse), email: text(data.email), phone: text(data.phone) || null };
  }
  return { mode: "unknown" };
}
export const hidesEnquirerSelector = (context: TuitionContext) => context.mode !== "unknown";
/** Fills only fields the person has not already typed into; everything stays editable. */
export function applyTuitionContext(values: EnquiryFormValues, context: TuitionContext): EnquiryFormValues {
  const fill = (current: string, next: string | null) => (current.trim() || !next ? current : next);
  if (context.mode === "student-under-18") {
    return { ...values, enquirerType: "student-under-18", studentName: fill(values.studentName, context.studentName),
      mathsCourse: values.mathsCourse || context.mathsCourse || "" };
  }
  if (context.mode === "student-adult") {
    return { ...values, enquirerType: "student-adult", contactName: fill(values.contactName, context.name), email: fill(values.email, context.email),
      phone: fill(values.phone, context.phone), mathsCourse: values.mathsCourse || context.mathsCourse || "" };
  }
  return values;
}
