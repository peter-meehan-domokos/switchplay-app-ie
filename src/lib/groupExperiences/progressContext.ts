import type { ClientSession } from "mongodb";
import { CardArchitectureError, requireCondition } from "../cards/domain";
import type { CardTemplateVersion } from "../cards/model";
import { assertFrameworkConfiguration, getFrameworks, type Framework } from "../frameworks/configuration";
import { readCanonicalAncestry } from "../frameworks/mappingRepository";
import { resolveProgressScope } from "../frameworks/scope";
import { assertAssessmentId } from "../assessments/contracts";
import { assertSelection, groupCapabilities } from "./policy";
import { selectedContent } from "./publicVersions";
import { authorize } from "./authorization";
import { identity } from "./readModels";
import type { GroupExperienceRepository } from "./repository";

export type ProgressPerspective = { kind: "group" } | { kind: "player"; userId: string };
// Every reader consumes this snapshot plan. Self is an owner/capability choice,
// never a reason to expand the Group's selected learning or assessment scope.
export async function groupProgressContext(repo: GroupExperienceRepository, actor: string, experienceId: string,
  frameworkId: string, perspective: ProgressPerspective, session: ClientSession, frameworks: readonly Framework[] = getFrameworks()) {
  assertAssessmentId(frameworkId); assertFrameworkConfiguration(frameworks);
  requireCondition(perspective.kind === "group" || perspective.kind === "player", "INVALID_GROUP_PROGRESS_PERSPECTIVE");
  const { experience, member } = await repo.access(actor, experienceId, "member", session);
  const framework = frameworks.find(value => value.id === frameworkId);
  requireCondition(framework, "GROUP_PROGRESS_FRAMEWORK_FORBIDDEN");
  if (perspective.kind === "player") assertAssessmentId(perspective.userId);
  const subject = perspective.kind === "player" ? await repo.members().findOne({ experienceId, userId: perspective.userId }, { session }) : null;
  if (perspective.kind === "player") {
    authorize(subject, "follower");
    assertSelection(experience, member, perspective.userId === actor ? { perspective: "self" } : { perspective: "follower", subjectUserId: perspective.userId }, subject);
    requireCondition(subject?.followerStatus === "active", "GROUP_PERSPECTIVE_FORBIDDEN");
  }
  let cards: CardTemplateVersion[] = [], issues: { code: string }[] = [];
  try { cards = (await selectedContent(repo.cards, experience, session)).cards; }
  catch (error) { if (!(error instanceof CardArchitectureError)) throw error; issues = [{ code: error.code }]; }
  const graph = await readCanonicalAncestry(repo.cards, [framework], cards.map(card => card.cardTemplateId), session);
  const scope = resolveProgressScope(framework, { kind: "group", experienceId }, cards.map(({ cardTemplateId, version }) => ({ cardTemplateId, version })), graph,
    { unknownComposition: issues.length > 0, issues });
  const now = Date.now();
  return { experience, member, subject, framework, cards, scope, perspective,
    capabilities: groupCapabilities(experience, member),
    authority: { ...identity(actor, experience, member), frameworkId, perspective,
      subjectAccessEpoch: subject?.accessEpoch ?? null, verifiedAt: new Date(now).toISOString(), leaseExpiresAt: new Date(now + 5000).toISOString() } };
}
export type GroupProgressContext = Awaited<ReturnType<typeof groupProgressContext>>;
export function progressItem(context: GroupProgressContext, frameworkItemId: string) {
  assertAssessmentId(frameworkItemId);
  const item = context.scope.areas.flatMap(area => area.items).find(value => value.frameworkItemId === frameworkItemId);
  requireCondition(item, "GROUP_PROGRESS_ITEM_FORBIDDEN");
  return item;
}
