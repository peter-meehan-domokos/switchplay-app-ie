import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import AppShell from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { CardRepository } from "@/lib/cards/repository";
import { membershipDTO } from "@/lib/cards/readModels";
import { GroupExperienceRepository } from "@/lib/groupExperiences/repository";
export default async function DecksPage() {
  const user = await getCurrentUser();
  if (!user) return <EmbeddedAuthScreen />;
  const repo = await CardRepository.application();
  const memberships = await membershipDTO(repo, user.id);
  // Direct server repository calls do not pass through the HTTP feature gate.
  let groups;
  if (process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED === "1") {
    const groupRepo = new GroupExperienceRepository(repo); groups = await groupRepo.collectionTiles(user.id);
    while (groups.nextCursor) {
      const next = await groupRepo.collectionTiles(user.id, groups.nextCursor);
      groups = { ...next, entries: [...groups.entries, ...next.entries] };
    }
  }
  return <AppShell memberships={memberships} groups={groups} currentUserId={user.id} userName={user.username} />;
}
