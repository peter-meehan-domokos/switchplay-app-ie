import { assessmentRequest } from "@/lib/assessments/http";

export async function GET(request: Request, context: RouteContext<'/api/items-data/[itemId]/tests'>) {
  return assessmentRequest(request, { kind: "item", itemId: (await context.params).itemId });
}
export async function POST(request: Request, context: RouteContext<'/api/items-data/[itemId]/tests'>) {
  return assessmentRequest(request, { kind: "item", itemId: (await context.params).itemId }, "add");
}
