import { groupRequest, openCommand, query } from "@/lib/groupExperiences/http";
export async function POST(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => { query(request, []); const command = openCommand(await request.json());
    return repo.open(actor, (await context.params).experienceId, command.accessEpoch, command.cardTemplateId); });
}
