import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import AppShell from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { CardRepository } from "@/lib/cards/repository";
import { membershipDTO } from "@/lib/cards/readModels";
export default async function DecksPage() {
  const user = await getCurrentUser();
  if (!user) return <EmbeddedAuthScreen />;
  const memberships = await membershipDTO(await CardRepository.application(), user.id);
  return <AppShell memberships={memberships} currentUserId={user.id} userName={user.username} />;
}
