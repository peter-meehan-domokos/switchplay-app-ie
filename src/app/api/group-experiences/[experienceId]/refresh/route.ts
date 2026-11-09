import { groupRequest, query } from "@/lib/groupExperiences/http";
import { selectionCommand } from "@/lib/groupExperiences/navigation";
import { revision } from "@/lib/groupExperiences/contracts";
import { refreshGroup, pageGroupRefresh } from "@/lib/groupExperiences/refresh";
import { requireCondition } from "@/lib/cards/domain";
export function GET(request: Request, context: { params: Promise<{ experienceId: string }> }) {
  return groupRequest(request, async (repo, actor) => {
    const p = query(request, ["perspective", "subjectUserId", "accessEpoch", "adoptionRevision", "structureRevision", "aggregates", "after"]);
    const selection = selectionCommand({ perspective: p.get("perspective"), ...(p.has("subjectUserId") ? { subjectUserId: p.get("subjectUserId") } : {}) });
    const expected = { accessEpoch: Number(p.get("accessEpoch")), adoptionRevision: Number(p.get("adoptionRevision")), structureRevision: Number(p.get("structureRevision")) };
    for (const key of ["accessEpoch", "adoptionRevision", "structureRevision"] as const) { requireCondition(p.has(key), "INVALID_GROUP_QUERY"); revision(expected[key]); }
    requireCondition(!p.has("aggregates") || ["true", "false"].includes(p.get("aggregates")!), "INVALID_GROUP_QUERY");
    return pageGroupRefresh(await refreshGroup(repo, actor, (await context.params).experienceId, selection, expected, p.get("aggregates") !== "false"), p.get("after") ?? undefined);
  });
}
