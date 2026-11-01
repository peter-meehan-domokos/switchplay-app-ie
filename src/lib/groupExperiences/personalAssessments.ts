import { requireCondition } from "../cards/domain";
import { ensurePersonalLearningInSession } from "../cards/personalLearning";
import { assessmentTarget, AssessmentConflict, assertAssessmentCommand, assertAssessmentSource, sameAssessmentSource, type AssessmentCommand, type AssessmentList, type AssessmentSource } from "../assessments/contracts";
import { mutateAssessmentInSession, readAssessmentListInSession } from "../assessments/repository";
import { getFrameworks, type Framework } from "../frameworks/configuration";
import { currentGroupAssessmentContext } from "./assessmentContext";
import { personalLearningForUsers } from "./learningReads";
import type { GroupExperienceRepository } from "./repository";

export type GroupPersonalAssessmentList = AssessmentList & { experienceId: string; owner: { kind: "personal"; userId: string }; target: ReturnType<typeof assessmentTarget> };

export async function personalGroupAssessments(repo: GroupExperienceRepository, actor: string, experienceId: string, source: AssessmentSource,
  command?: AssessmentCommand, frameworks: readonly Framework[] = getFrameworks(), frameworkId?: string) {
  assertAssessmentSource(source);
  if (command) { assertAssessmentCommand(command); requireCondition(command.viewerUserId === actor, "ASSESSMENT_SESSION_CONFLICT");
    requireCondition(sameAssessmentSource(command.source, source), "ASSESSMENT_SOURCE_CONFLICT"); }
  return repo.transaction(async session => {
    const context = await currentGroupAssessmentContext(repo, actor, experienceId, source, "follower", session, frameworks, frameworkId);
    if (command) await repo.fence([context.member], session);
    const decorate = <T extends AssessmentList>(list: T): T & GroupPersonalAssessmentList => ({ ...list, experienceId, owner: { kind: "personal", userId: actor }, target: assessmentTarget(source) });
    if (source.kind === "card") {
      const card = context.cards.find(card => card.cardTemplateId === source.cardTemplateId)!;
      // The existing scalar reader distinguishes legitimate absent Group rows
      // from a broken required personal membership; never hide that corruption.
      await personalLearningForUsers(repo.cards, [actor], [card], session);
      if (command?.action === "add") {
        await ensurePersonalLearningInSession(repo.cards, actor, card, session, { scheduling: "experience" });
      } else if (!command && !(await repo.cards.getPersonalLearning(actor, source.cardTemplateId, session))!.cardsData.length) {
        return decorate({ viewerUserId: actor, source, revision: 0, tests: [] });
      }
    }
    if (!command) return decorate(await readAssessmentListInSession(repo.cards, actor, source, session));
    const entryContext = { groupExperienceId: experienceId, deckTemplateId: source.kind === "card" ? context.experience.deckTemplateId : null };
    try { return decorate(await mutateAssessmentInSession(repo.cards, actor, command, frameworks, session, entryContext)); }
    catch (error) { if (error instanceof AssessmentConflict) throw new AssessmentConflict(decorate(error.latestList)); throw error; }
  });
}
