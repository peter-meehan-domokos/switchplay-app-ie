import { assessmentRequest } from "@/lib/assessments/http";

export async function PATCH(request: Request, context: RouteContext<'/api/items-data/[itemId]/tests/[testId]'>) {
  const { itemId, testId } = await context.params;
  return assessmentRequest(request, { kind: "item", itemId }, "update", testId);
}
export async function DELETE(request: Request, context: RouteContext<'/api/items-data/[itemId]/tests/[testId]'>) {
  const { itemId, testId } = await context.params;
  return assessmentRequest(request, { kind: "item", itemId }, "delete", testId);
}
