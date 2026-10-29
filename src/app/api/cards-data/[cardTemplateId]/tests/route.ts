import { assessmentRequest } from "@/lib/assessments/http";

export async function GET(request: Request, context: RouteContext<'/api/cards-data/[cardTemplateId]/tests'>) {
  return assessmentRequest(request, { kind: "card", cardTemplateId: (await context.params).cardTemplateId });
}
export async function POST(request: Request, context: RouteContext<'/api/cards-data/[cardTemplateId]/tests'>) {
  return assessmentRequest(request, { kind: "card", cardTemplateId: (await context.params).cardTemplateId }, "add");
}
