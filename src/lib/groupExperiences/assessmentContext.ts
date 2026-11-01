import type { ClientSession } from "mongodb";
import { requireCondition } from "../cards/domain";
import { assertAssessmentSource, type AssessmentSource } from "../assessments/contracts";
import { getFrameworks, assertFrameworkConfiguration, type Framework } from "../frameworks/configuration";
import { readCanonicalAncestry } from "../frameworks/mappingRepository";
import { resolveProgressScope } from "../frameworks/scope";
import { selectedContent } from "./publicVersions";
import type { GroupExperienceRepository } from "./repository";
import type { GroupRole } from "./authorization";

export async function currentGroupAssessmentContext(repo: GroupExperienceRepository, actor: string, experienceId: string,
  source: AssessmentSource, role: GroupRole, session: ClientSession, frameworks: readonly Framework[] = getFrameworks(), frameworkId?: string) {
  assertAssessmentSource(source); assertFrameworkConfiguration(frameworks);
  const { experience, member } = await repo.access(actor, experienceId, role, session);
  const selected = await selectedContent(repo.cards, experience, session);
  let assessmentCards = selected.cards;
  if (source.kind === "card") requireCondition(selected.cards.some(card => card.cardTemplateId === source.cardTemplateId), "GROUP_ASSESSMENT_SOURCE_FORBIDDEN");
  else {
    const framework = frameworks.find(f => (frameworkId === undefined || f.id === frameworkId)
      && f.areas.some(area => area.items.some(item => item.id === source.itemId)));
    requireCondition(framework, "GROUP_ASSESSMENT_SOURCE_FORBIDDEN");
    const graph = await readCanonicalAncestry(repo.cards, [framework], selected.cards.map(card => card.cardTemplateId), session);
    const scope = resolveProgressScope(framework, { kind: "group", experienceId }, selected.cards.map(({ cardTemplateId, version }) => ({ cardTemplateId, version })), graph);
    const item = scope.areas.flatMap(area => area.items).find(item => item.frameworkItemId === source.itemId)!;
    requireCondition(item.coverage !== "unknown", "GROUP_ASSESSMENT_SCOPE_UNAVAILABLE");
    requireCondition(item.coverage === "inside", "GROUP_ASSESSMENT_SOURCE_FORBIDDEN");
    assessmentCards = selected.cards.filter(card => item.cardTemplateIds.includes(card.cardTemplateId));
  }
  if (source.kind === "card") assessmentCards = selected.cards.filter(card => card.cardTemplateId === source.cardTemplateId);
  return { experience, member, ...selected, assessmentCards };
}
