import EmbeddedAuthScreen from "@/components/auth/EmbeddedAuthScreen";
import LibraryShell from "@/components/library/LibraryShell";
import { getCurrentUser } from "@/lib/auth";
import { CardRepository } from "@/lib/cards/repository";
import { libraryCollection } from "@/lib/cards/libraryReadModels";
export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) return <EmbeddedAuthScreen />;
  const collection = await libraryCollection(await CardRepository.application(), user.id);
  return <LibraryShell key={user.id} initialCollection={collection} currentUserId={user.id} userName={user.username} />;
}
