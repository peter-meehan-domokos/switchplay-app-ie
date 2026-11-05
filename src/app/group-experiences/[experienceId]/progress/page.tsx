import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import ProgressShell from "@/components/progress/ProgressShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CardRepository } from "@/lib/cards/repository";
import { GroupExperienceRepository } from "@/lib/groupExperiences/repository";
import { CardArchitectureError } from "@/lib/cards/domain";
export default async function GroupProgressPage({ params }: { params: Promise<{ experienceId: string }> }) {
  const user = await getCurrentUser(); if (!user) return <EmbeddedAuthScreen />;
  const { experienceId } = await params, repo = new GroupExperienceRepository(await CardRepository.application());
  try { await repo.transaction(session => repo.access(user.id, experienceId, "member", session)); }
  catch (error) { if (error instanceof CardArchitectureError && error.code.includes("FORBIDDEN")) redirect("/decks"); throw error; }
  return <ProgressShell currentUserId={user.id} userName={user.username} experienceId={experienceId} />;
}
