import { assessmentRequest } from "@/lib/assessments/http";

export async function PATCH(request: Request, context: RouteContext<'/api/cards-data/[cardTemplateId]/tests/[testId]'>) {
  const { cardTemplateId, testId } = await context.params;
  return assessmentRequest(request, { kind: "card", cardTemplateId }, "update", testId);
}
export async function DELETE(request: Request, context: RouteContext<'/api/cards-data/[cardTemplateId]/tests/[testId]'>) {
  const { cardTemplateId, testId } = await context.params;
  return assessmentRequest(request, { kind: "card", cardTemplateId }, "delete", testId);
}
