import { fields } from "@/lib/cards/http";
import { preparationSelectionCommand } from "@/lib/groupExperiences/navigation";
import { groupRequest, query } from "@/lib/groupExperiences/http";
import { prepareGroup } from "@/lib/groupExperiences/preparation";
import { requireCondition } from "@/lib/cards/domain";
export function GET(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => {
    const params = query(request, ["perspective", "subjectUserId"]), perspective = params.get("perspective");
    requireCondition(perspective === null || ["default", "group", "self", "follower"].includes(perspective), "GROUP_PERSPECTIVE_FORBIDDEN");
    const selection = perspective ? preparationSelectionCommand({ perspective, ...(perspective === "follower" ? { subjectUserId: params.get("subjectUserId") } : {}) }) : undefined;
    return prepareGroup(repo, actor, (await context.params).experienceId, selection);
  });
}

export function POST(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => {
    query(request, []);
    const body = await request.json(); fields(body, ["selection", "cardTemplateId"]);
    return prepareGroup(repo, actor, (await context.params).experienceId, body.selection === undefined ? undefined : preparationSelectionCommand(body.selection), { cardTemplateId: body.cardTemplateId as string | undefined });
  });
}
