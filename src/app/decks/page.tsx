import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { CardRepository } from "@/lib/cards/repository";
import { membershipDTO } from "@/lib/cards/readModels";
export default async function DecksPage() {
  const user = await getCurrentUser();
  if (!user) return <EmbeddedAuthScreen />;
  const memberships = await membershipDTO(await CardRepository.application(), user.id);
  // A member with no decks at all (not even archived ones) has nothing to show here: send them to the Library on the
  // server, before anything renders, so there is no flash of an empty My Decks. Archived decks are managed here, so keep those users.
  if (memberships.length === 0) redirect("/library");
  return <AppShell memberships={memberships} currentUserId={user.id} userName={user.username} />;
}
