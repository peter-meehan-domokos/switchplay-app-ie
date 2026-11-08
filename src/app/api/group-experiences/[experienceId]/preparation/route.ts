import { fields } from "@/lib/cards/http";
import { selectionCommand } from "@/lib/groupExperiences/navigation";
import { groupRequest, query } from "@/lib/groupExperiences/http";
import { prepareGroup } from "@/lib/groupExperiences/preparation";
import { requireCondition } from "@/lib/cards/domain";
import type { PerspectiveSelection } from "@/lib/groupExperiences/model";
export function GET(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => {
    const params = query(request, ["perspective", "subjectUserId"]), perspective = params.get("perspective");
    requireCondition(perspective === null || ["group", "self", "follower"].includes(perspective), "GROUP_PERSPECTIVE_FORBIDDEN");
    const selection = perspective ? { perspective, ...(perspective === "follower" ? { subjectUserId: params.get("subjectUserId") } : {}) } as PerspectiveSelection : undefined;
    return prepareGroup(repo, actor, (await context.params).experienceId, selection);
  });
}

export function POST(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => {
    query(request, []);
    const body = await request.json(); fields(body, ["selection", "cardTemplateId"]);
    return prepareGroup(repo, actor, (await context.params).experienceId, body.selection === undefined ? undefined : selectionCommand(body.selection), { cardTemplateId: body.cardTemplateId as string | undefined });
  });
}
